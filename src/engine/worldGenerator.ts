import { getBiomeMetaWithCustom } from '../data/biomes';
import { DEFAULT_CULTURES, DEFAULT_GOODS, DEFAULT_KINGDOMS, DEFAULT_RELIGIONS } from '../data/goods';
import { getFeatureMetaWithCustom } from '../data/features';
import { isWaterTerrain, isWaterTerrainWithCustom } from '../data/terrains';
import {
  BiomeId,
  City,
  GeographyConfig,
  HexMapData,
  ManualCurrentPath,
  RiverPath,
  TerrainId,
  TradeRoute,
  WindMode,
} from '../types/map';
import { generateNaturalCliffs, syncShallowWater } from './cliffs';
import { computeCoastalCurrentInfluence, computeOceanCurrents } from './currents';
import { getElevationBandForTerrain } from './elevation';
import {
  findHexPath,
  getHexBrush,
  getHexTerrain,
  getNeighbors,
  hexDistance,
  hexIndex,
} from './hexMath';
import { generateRiversAuto } from './hydrology';
import { createNoise2D, mulberry32 } from './noise';
import {
  generateCulturesFromCities,
  generateReligionsFromCities,
  generateTerritoriesFromCities,
} from './politics';
import { generateRealEarthElevationField } from './realEarth';
import {
  applyTectonicFeatures,
  applyTectonicsToElevation,
  computeTectonicField,
} from './tectonics';

export const DEFAULT_GEOGRAPHY_CONFIG: GeographyConfig = {
  seed: 42081,
  landmassType: 'continent',
  seaLevel: 0.0,
  mountainScale: 1.0,
  latNorth: 74,
  latSouth: -12,
  lonWest: -180,
  lonEast: 180,
  windMode: 'latitude',
  windStrength: 1.0,
  moistureScale: 1.0,
  riverThreshold: 20,
  oceanCurrents: true,
  currentStrength: 1.0,
  coriolisDirection: 'normal',
  tectonicPlates: 8,
  tectonicStrength: 0,
};

/** Compute latitude in degrees for row r between latNorth (top) and latSouth (bottom). */
export function getRowLatitude(r: number, height: number, config: GeographyConfig): number {
  const t = height <= 1 ? 0.5 : r / (height - 1);
  return config.latNorth + (config.latSouth - config.latNorth) * t;
}

/** Compute longitude in degrees for column q between lonWest (left) and lonEast (right). */
export function getColLongitude(q: number, width: number, config: GeographyConfig): number {
  const lonW = config.lonWest ?? -180;
  const lonE = config.lonEast ?? 180;
  const t = width <= 1 ? 0.5 : q / (width - 1);
  return lonW + (lonE - lonW) * t;
}

export function formatLatitude(lat: number): string {
  if (Math.abs(lat) < 0.05) return '0°';
  return `${Math.abs(lat).toFixed(1).replace(/\.0$/, '')}°${lat >= 0 ? 'N' : 'S'}`;
}

export function formatLongitude(lon: number): string {
  if (Math.abs(lon) < 0.05) return '0°';
  return `${Math.abs(lon).toFixed(1).replace(/\.0$/, '')}°${lon >= 0 ? 'E' : 'W'}`;
}

export function formatSeaLevelMeters(seaLevel: number): string {
  const meters = Math.round(seaLevel * 800);
  if (meters === 0) return '0 ม. (ระดับปัจจุบัน)';
  return `${meters > 0 ? '+' : ''}${meters.toLocaleString()} ม.`;
}

/** Prevailing 2D wind unit vector (+dx = W->E, +dy = N->S in screen coordinates). */
export function getPrevailingWindVector(
  latDeg: number,
  lonDeg: number,
  windMode: WindMode
): { dx: number; dy: number } {
  switch (windMode) {
    case 'west':
      return { dx: 1, dy: 0 };
    case 'east':
      return { dx: -1, dy: 0 };
    case 'north':
      return { dx: 0, dy: 1 };
    case 'south':
      return { dx: 0, dy: -1 };
    case 'northwest':
      return { dx: 0.7071, dy: 0.7071 };
    case 'southwest':
      return { dx: 0.7071, dy: -0.7071 };
    case 'northeast':
      return { dx: -0.7071, dy: 0.7071 };
    case 'southeast':
      return { dx: -0.7071, dy: -0.7071 };
    case 'monsoon': {
      // South / SE / East Asia SW summer monsoon
      if (latDeg >= 0 && latDeg <= 34 && lonDeg >= 55 && lonDeg <= 145) {
        return { dx: 0.72, dy: -0.69 };
      }
      // West African monsoon
      if (latDeg >= 0 && latDeg <= 18 && lonDeg >= -18 && lonDeg <= 20) {
        return { dx: 0.55, dy: -0.83 };
      }
      // North Australian monsoon
      if (latDeg >= -24 && latDeg < 0 && lonDeg >= 110 && lonDeg <= 155) {
        return { dx: 0.6, dy: 0.8 };
      }
      // Fallback to realistic Coriolis belts
      return getPrevailingWindVector(latDeg, lonDeg, 'latitude');
    }
    case 'latitude':
    default: {
      const absLat = Math.abs(latDeg);
      if (absLat < 30) {
        // Trade Winds blow from E toward equator (NE in N-hemisphere, SE in S-hemisphere)
        return { dx: -0.88, dy: latDeg >= 0 ? 0.47 : -0.47 };
      }
      if (absLat <= 60) {
        // Westerlies blow from W toward poles (SW in N-hemisphere, NW in S-hemisphere)
        return { dx: 0.88, dy: latDeg >= 0 ? -0.47 : 0.47 };
      }
      // Polar Easterlies blow from E toward equator
      return { dx: -0.85, dy: latDeg >= 0 ? 0.52 : -0.52 };
    }
  }
}

/** Prevailing zonal wind direction per latitude belt (+1 = West->East, -1 = East->West). */
export function getPrevailingWindDir(latDeg: number, windMode: WindMode): 1 | -1 {
  return getPrevailingWindVector(latDeg, 0, windMode).dx >= 0 ? 1 : -1;
}

/** Generate tectonic elevation (-1..1) for the chosen landmass preset (or Real Earth). */
export function generateElevationField(
  width: number,
  height: number,
  config: GeographyConfig
): number[] {
  if (config.landmassType === 'real_earth') {
    return generateRealEarthElevationField(width, height, config);
  }
  const nMain = createNoise2D(config.seed);
  const nWarp = createNoise2D(config.seed + 1013);
  const nRidge = createNoise2D(config.seed + 3037);
  const nDetail = createNoise2D(config.seed + 7001);

  const elev = new Array<number>(width * height);
  const aspect = width / Math.max(1, height);

  for (let r = 0; r < height; r++) {
    const ny = r / Math.max(1, height - 1);
    const cy = ny * 2 - 1;
    for (let q = 0; q < width; q++) {
      const nx = q / Math.max(1, width - 1);
      const cx = nx * 2 - 1;

      const wx = nWarp.fbm(nx * 3.1 * aspect, ny * 3.1, 3) * 0.16;
      const wy = nWarp.fbm(nx * 3.1 * aspect + 19.3, ny * 3.1 + 7.1, 3) * 0.16;
      const sx = nx + wx;
      const sy = ny + wy;

      const baseNoise = nMain.fbm(sx * 3.4 * aspect, sy * 3.4, 5);
      const detail = nDetail.fbm(nx * 10 * aspect, ny * 10, 3) * 0.1;

      let mask = 0;
      const dx = cx + wx * 1.4;
      const dy = cy + wy * 1.4;
      const radial = Math.hypot(dx * 0.95, dy * 1.05);

      switch (config.landmassType) {
        case 'continent': {
          mask = 0.56 - Math.pow(radial, 1.75) * 0.98;
          break;
        }
        case 'twin': {
          const dLeft = Math.hypot((dx + 0.44) * 1.35, dy * 1.12);
          const dRight = Math.hypot((dx - 0.44) * 1.35, dy * 1.12);
          const dMin = Math.min(dLeft, dRight);
          mask = 0.52 - Math.pow(dMin, 1.65) * 0.96;
          break;
        }
        case 'archipelago': {
          const edgeFade = Math.max(0, Math.hypot(cx * 0.88, cy * 0.88) - 0.55);
          mask = 0.08 + nMain.fbm(sx * 5.8 * aspect, sy * 5.8, 4) * 0.52 - edgeFade * 0.9;
          break;
        }
        case 'pangaea': {
          mask = 0.72 - Math.pow(radial, 2.2) * 0.95;
          break;
        }
        case 'inland_sea': {
          const ringDist = Math.abs(radial - 0.54);
          mask = 0.48 - ringDist * 1.28;
          if (radial > 0.92) mask -= (radial - 0.92) * 2.2;
          break;
        }
        case 'coastal': {
          const eastBias = (cx + wx * 1.2 + 0.15) * 0.55;
          const borderNS = Math.max(0, Math.abs(cy) - 0.82) * 2.0;
          mask = eastBias + 0.16 - borderNS;
          break;
        }
      }

      const ridgeVal = nRidge.ridged(sx * 3.8 * aspect + 4.2, sy * 3.8 + 11.7, 4);
      let h = mask + baseNoise * 0.46 + detail - config.seaLevel;

      if (h > 0.04) {
        const inlandFactor = Math.min(1, h / 0.45);
        const mountainBoost =
          Math.max(0, ridgeVal - 0.42) * 1.15 * config.mountainScale * inlandFactor;
        h += mountainBoost;
      }

      elev[hexIndex(q, r, width)] = Math.max(-1, Math.min(1, h));
    }
  }

  if ((config.tectonicStrength ?? 0) > 0) {
    const field = computeTectonicField(
      width,
      height,
      config.seed,
      config.tectonicPlates ?? 8
    );
    return applyTectonicsToElevation(
      elev,
      width,
      height,
      field,
      config.tectonicStrength
    );
  }

  return elev;
}

/** Simulates real-world climate (latitude + lapse rate + ocean currents + 2D wind moisture + rain shadows). */
export function simulateClimate(
  elevation: ArrayLike<number>,
  width: number,
  height: number,
  config: GeographyConfig,
  terrains?: ArrayLike<number>,
  manualCurrents?: ManualCurrentPath[]
): { temperature: number[]; moisture: number[] } {
  const total = width * height;
  const temperature = new Array<number>(total);
  const moisture = new Array<number>(total).fill(0);

  const useCurrents = config.oceanCurrents !== false || Boolean(manualCurrents?.length);
  const currents = useCurrents
    ? computeOceanCurrents(width, height, elevation, config, terrains, manualCurrents)
    : null;
  const coastalThermal =
    useCurrents && currents
      ? computeCoastalCurrentInfluence(width, height, elevation, currents, terrains)
      : null;

  for (let r = 0; r < height; r++) {
    const latDeg = getRowLatitude(r, height, config);
    const latRad = (latDeg * Math.PI) / 180;
    const seaLevelTemp = -22 + 52 * Math.pow(Math.cos(latRad), 1.35);

    for (let q = 0; q < width; q++) {
      const idx = hexIndex(q, r, width);
      const e = elevation[idx];
      const isLake = Boolean(terrains && terrains[idx] === TerrainId.LAKE);
      if (e <= 0) {
        const curShift = !isLake && currents ? currents.thermal[idx] * 3.6 : 0;
        temperature[idx] = Number((seaLevelTemp + curShift).toFixed(1));
      } else {
        const altCooling = Math.pow(e, 1.05) * 37;
        const coastShift = coastalThermal ? coastalThermal[idx] * 4.0 : 0;
        temperature[idx] = Number((seaLevelTemp - altCooling + coastShift).toFixed(1));
      }
    }
  }

  const vaporArr = new Float64Array(total).fill(0.65 * config.moistureScale);
  const moisturePass = new Float64Array(total);
  const sweeps: readonly [1 | -1, 1 | -1][] = [
    [1, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
    [-1, -1],
  ];

  for (let pass = 0; pass < sweeps.length; pass++) {
    const [qStep, rStep] = sweeps[pass];
    const startR = rStep === 1 ? 0 : height - 1;
    const endR = rStep === 1 ? height : -1;
    const startQ = qStep === 1 ? 0 : width - 1;
    const endQ = qStep === 1 ? width : -1;

    for (let r = startR; r !== endR; r += rStep) {
      const latDeg = getRowLatitude(r, height, config);
      const absLat = Math.abs(latDeg);
      const subtropicalDry = Math.exp(-Math.pow((absLat - 27) / 9, 2)) * 0.045;
      const itczBoost = Math.exp(-Math.pow(absLat / 12, 2)) * 0.05;

      for (let q = startQ; q !== endQ; q += qStep) {
        const idx = hexIndex(q, r, width);
        const e = elevation[idx];
        const lonDeg = getColLongitude(q, width, config);
        const { dx, dy } = getPrevailingWindVector(latDeg, lonDeg, config.windMode);

        const wx = Math.abs(dx);
        const wy = Math.abs(dy);
        const wSum = wx + wy || 1;
        const stepBackQ = dx >= 0 ? -1 : 1;
        const stepBackR = dy >= 0 ? -1 : 1;

        const uq = q + stepBackQ;
        const ur = r + stepBackR;
        const maritimeVapor = 0.65 * config.moistureScale;

        const vaporX = uq >= 0 && uq < width ? vaporArr[hexIndex(uq, r, width)] : maritimeVapor;
        const elevX =
          uq >= 0 && uq < width ? Math.max(0, elevation[hexIndex(uq, r, width)]) : 0;

        const vaporY = ur >= 0 && ur < height ? vaporArr[hexIndex(q, ur, width)] : maritimeVapor;
        const elevY =
          ur >= 0 && ur < height ? Math.max(0, elevation[hexIndex(q, ur, width)]) : 0;

        const upwindVapor = (vaporX * wx + vaporY * wy) / wSum;
        const prevElev = (elevX * wx + elevY * wy) / wSum;

        if (e <= 0) {
          const tempWarmth = Math.max(0.25, Math.min(1.15, (temperature[idx] + 15) / 45));
          const nextVapor = Math.min(
            1.15,
            upwindVapor + 0.16 * tempWarmth * config.moistureScale
          );
          vaporArr[idx] = nextVapor;
          moisturePass[idx] = Math.min(1, nextVapor);
        } else {
          const slopeUp = Math.max(0, e - prevElev);
          const orographicRain = slopeUp * 2.2 * upwindVapor;
          const basePrecip = (0.045 + itczBoost) * upwindVapor * config.moistureScale;
          const totalRain = Math.min(upwindVapor, basePrecip + orographicRain);

          const localMoisture = Math.max(
            0.02,
            Math.min(1, totalRain * 2.5 + upwindVapor * 0.48 - subtropicalDry * 2.2)
          );

          moisturePass[idx] =
            pass === 0 ? localMoisture : moisturePass[idx] * 0.35 + localMoisture * 0.65;

          const mountainBarrierLoss = e > 0.45 ? (e - 0.4) * 0.65 : 0;
          vaporArr[idx] = Math.max(
            0.03,
            upwindVapor - totalRain * 0.78 - mountainBarrierLoss - subtropicalDry
          );
        }
      }
    }
  }

  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const idx = hexIndex(q, r, width);
      if (elevation[idx] <= 0) {
        moisture[idx] = 1;
        continue;
      }
      let nearWater = false;
      for (const nb of getNeighbors(q, r, width, height)) {
        if (elevation[hexIndex(nb.q, nb.r, width)] <= 0) {
          nearWater = true;
          break;
        }
      }
      const coastMoistShift = coastalThermal ? coastalThermal[idx] * 0.11 : 0;
      const m = moisturePass[idx] + (nearWater ? 0.08 : 0) + coastMoistShift;
      moisture[idx] = Number(Math.max(0.02, Math.min(1, m)).toFixed(3));
    }
  }

  return { temperature, moisture };
}

/** Classify every hex into a physical landform TerrainId from tectonic elevation and moisture. */
export function classifyTerrainsFromElevation(
  elevation: ArrayLike<number>,
  width: number,
  height: number,
  moisture?: ArrayLike<number>
): number[] {
  const total = width * height;
  const terrains = new Array<number>(total);

  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const idx = hexIndex(q, r, width);
      const e = elevation[idx];
      if (e <= 0) {
        let touchesLand = false;
        for (const nb of getNeighbors(q, r, width, height)) {
          if (elevation[hexIndex(nb.q, nb.r, width)] > 0) {
            touchesLand = true;
            break;
          }
        }
        terrains[idx] = touchesLand ? TerrainId.SHALLOW_WATER : TerrainId.DEEP_OCEAN;
      } else if (e >= 0.72) {
        terrains[idx] = TerrainId.HIGH_PEAK;
      } else if (e >= 0.54) {
        terrains[idx] = TerrainId.MOUNTAIN;
      } else if (e >= 0.37) {
        const m = moisture ? moisture[idx] : 0.5;
        terrains[idx] = m < 0.34 || e >= 0.46 ? TerrainId.HIGHLAND : TerrainId.HILLS;
      } else {
        terrains[idx] = TerrainId.PLAINS;
      }
    }
  }

  return terrains;
}

/** Classify every hex into a climate/ecological BiomeId (independent of mountain/hill landform). */
export function classifyBiomesFromClimate(
  elevation: ArrayLike<number>,
  temperature: ArrayLike<number>,
  moisture: ArrayLike<number>,
  width: number,
  height: number,
  riverBonus?: ArrayLike<number>,
  terrains?: ArrayLike<number>
): number[] {
  const total = width * height;
  const biomes = new Array<number>(total);

  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const idx = hexIndex(q, r, width);
      const e = elevation[idx];
      const terrainWater = terrains ? isWaterTerrain(terrains[idx]) : false;
      if (e <= 0 || terrainWater) {
        let touchesLand = false;
        for (const nb of getNeighbors(q, r, width, height)) {
          const nbIdx = hexIndex(nb.q, nb.r, width);
          const nbWater = terrains ? isWaterTerrain(terrains[nbIdx]) : elevation[nbIdx] <= 0;
          if (!nbWater && elevation[nbIdx] > 0) {
            touchesLand = true;
            break;
          }
        }
        biomes[idx] = touchesLand ? BiomeId.SHALLOW_WATER : BiomeId.DEEP_OCEAN;
        continue;
      }

      const t = temperature[idx];
      const rBonus = riverBonus ? riverBonus[idx] : 0;
      const m = Math.min(1, moisture[idx] + rBonus);
      const isPlains = !terrains || terrains[idx] === TerrainId.PLAINS;

      if (t <= -7) {
        biomes[idx] = BiomeId.SNOW_ICE;
      } else if (t <= 1.5) {
        biomes[idx] = m < 0.25 ? BiomeId.SNOW_ICE : BiomeId.TUNDRA;
      } else if (t <= 8.5) {
        if (m >= 0.42) biomes[idx] = BiomeId.TAIGA;
        else if (m >= 0.24) biomes[idx] = BiomeId.GRASSLAND;
        else biomes[idx] = BiomeId.TUNDRA;
      } else if (t <= 19.5) {
        if (e < 0.075 && m >= 0.68 && isPlains) biomes[idx] = BiomeId.SWAMP;
        else if (m >= 0.62) biomes[idx] = BiomeId.DECIDUOUS_FOREST;
        else if (m >= 0.44) biomes[idx] = BiomeId.WINDWARD_PLAINS;
        else if (m >= 0.26) biomes[idx] = BiomeId.GRASSLAND;
        else biomes[idx] = BiomeId.DESERT;
      } else {
        if (e < 0.08 && m >= 0.72 && isPlains) biomes[idx] = BiomeId.SWAMP;
        else if (m >= 0.65) biomes[idx] = BiomeId.RAINFOREST;
        else if (m >= 0.48) biomes[idx] = BiomeId.DECIDUOUS_FOREST;
        else if (m >= 0.30) biomes[idx] = BiomeId.SAVANNA;
        else biomes[idx] = BiomeId.DESERT;
      }
    }
  }

  return biomes;
}

/** Generate geographically realistic special features (oasis, coral reef, fjord, cliff, delta, etc.). */
export function generateSpecialFeatures(
  width: number,
  height: number,
  biomes: number[],
  elevation: number[],
  temperature: number[],
  moisture: number[],
  rivers: RiverPath[],
  seed: number,
  terrains?: number[]
): string[] {
  const total = width * height;
  const features = new Array<string>(total).fill('');
  const rng = mulberry32(seed + 5519);

  // Mark river cells and mouths
  const riverSet = new Set<number>();
  const mouthSet = new Set<number>();
  for (const rv of rivers) {
    for (let i = 0; i < rv.points.length; i++) {
      const pt = rv.points[i];
      const idx = hexIndex(pt.q, pt.r, width);
      riverSet.add(idx);
      if (i === rv.points.length - 1 || i === rv.points.length - 2) {
        mouthSet.add(idx);
      }
    }
  }

  for (let r = 1; r < height - 1; r++) {
    for (let q = 1; q < width - 1; q++) {
      const idx = hexIndex(q, r, width);
      const b = biomes[idx];
      const e = elevation[idx] ?? 0;
      const t = temperature[idx] ?? 15;
      const m = moisture[idx] ?? 0.5;
      const roll = rng();

      const nbs = getNeighbors(q, r, width, height);
      const isWater = b === BiomeId.DEEP_OCEAN || b === BiomeId.SHALLOW_WATER;
      const touchesWater = !isWater && nbs.some((nb) => {
        const nbb = biomes[hexIndex(nb.q, nb.r, width)];
        return nbb === BiomeId.DEEP_OCEAN || nbb === BiomeId.SHALLOW_WATER;
      });
      const touchesLand = isWater && nbs.some((nb) => {
        const nbb = biomes[hexIndex(nb.q, nb.r, width)];
        return nbb !== BiomeId.DEEP_OCEAN && nbb !== BiomeId.SHALLOW_WATER;
      });

      if (isWater) {
        if (b === BiomeId.SHALLOW_WATER && t >= 18) {
          if (roll < 0.045) features[idx] = 'coral_reef';
          else if (roll < 0.065 && !touchesLand) features[idx] = 'atoll';
          else if (roll < 0.08 && touchesLand) features[idx] = 'lagoon';
        } else if (b === BiomeId.DEEP_OCEAN && !touchesLand) {
          if (roll < 0.004) features[idx] = 'volcanic_island';
          else if (roll < 0.011) features[idx] = 'sea_islets';
        }
        continue;
      }

      // Coastal land features
      if (touchesWater) {
        if (mouthSet.has(idx) && roll < 0.55) {
          features[idx] = 'river_delta';
          continue;
        }
        if (t <= 6 && e >= 0.22 && roll < 0.14) {
          features[idx] = 'fjord';
          continue;
        }
        if (t >= 20 && m >= 0.52 && e < 0.18 && roll < 0.15) {
          features[idx] = 'mangrove';
          continue;
        }
      }

      // Inland land features
      const tId = getHexTerrain({ biomes, terrains, customBiomes: [] }, idx);
      if (tId === TerrainId.MOUNTAIN || tId === TerrainId.HIGH_PEAK) {
        if (roll < 0.045) features[idx] = 'cave';
        else if (roll < 0.072) features[idx] = 'hot_springs';
        else if (roll < 0.095) features[idx] = 'volcanic_soil';
      } else if (tId === TerrainId.HIGHLAND || tId === TerrainId.HILLS) {
        if (m < 0.35 && roll < 0.065) features[idx] = 'canyon';
        else if (m >= 0.45 && roll < 0.055) features[idx] = 'karst';
      } else if (b === BiomeId.DESERT) {
        if (roll < 0.025) features[idx] = 'oasis';
        else if (roll < 0.042) features[idx] = 'salt_flats';
        else if (roll < 0.056) features[idx] = 'mesa';
      } else if (b === BiomeId.SWAMP) {
        if (roll < 0.18) features[idx] = 'peat_bog';
      } else if (
        (b === BiomeId.GRASSLAND || b === BiomeId.WINDWARD_PLAINS) &&
        tId === TerrainId.PLAINS
      ) {
        if (riverSet.has(idx) && roll < 0.16) features[idx] = 'floodplain';
        else if (m >= 0.52 && roll < 0.045) features[idx] = 'fertile_meadow';
      }
    }
  }

  return features;
}

/** Auto-suggest produced & demanded goods for a city from surrounding 3-hex geography + special features. */
export function autoSuggestGoodsForCity(
  map: Pick<HexMapData, 'width' | 'height' | 'biomes' | 'rivers' | 'features'> & {
    terrains?: number[];
    customBiomes?: HexMapData['customBiomes'];
    customFeatures?: HexMapData['customFeatures'];
    featureOverrides?: HexMapData['featureOverrides'];
  },
  q: number,
  r: number
): { producedGoods: string[]; demandedGoods: string[] } {
  const counts = new Map<number, number>();
  const terrainCounts = new Map<number, number>();
  const featureBonuses: string[] = [];
  const ring = getHexBrush(q, r, 3, map.width, map.height);
  for (const h of ring) {
    const idx = hexIndex(h.q, h.r, map.width);
    const b = map.biomes[idx];
    const t = getHexTerrain(map, idx);
    counts.set(b, (counts.get(b) ?? 0) + 1);
    terrainCounts.set(t, (terrainCounts.get(t) ?? 0) + 1);
    const fId = map.features?.[idx];
    if (fId) {
      const fMeta = getFeatureMetaWithCustom(fId, map.customFeatures, map.featureOverrides);
      if (fMeta) featureBonuses.push(...fMeta.goodsBonus);
    }
    if (b >= 100) {
      const cb = map.customBiomes?.find((c) => c.id === b);
      if (cb?.goodsBonus && cb.goodsBonus.length > 0) {
        featureBonuses.push(...cb.goodsBonus);
      }
    }
  }

  const nearRiver = map.rivers.some((riv) =>
    riv.points.some((pt) => hexDistance({ q, r }, pt) <= 2)
  );
  const nearWater =
    (terrainCounts.get(TerrainId.SHALLOW_WATER) ?? 0) +
      (terrainCounts.get(TerrainId.DEEP_OCEAN) ?? 0) >
    0;
  const nearLake = (terrainCounts.get(TerrainId.LAKE) ?? 0) > 0;
  const mountains =
    (terrainCounts.get(TerrainId.MOUNTAIN) ?? 0) +
    (terrainCounts.get(TerrainId.HIGH_PEAK) ?? 0) +
    (terrainCounts.get(TerrainId.HILLS) ?? 0) +
    (terrainCounts.get(TerrainId.HIGHLAND) ?? 0);
  const forests =
    (counts.get(BiomeId.DECIDUOUS_FOREST) ?? 0) +
    (counts.get(BiomeId.TAIGA) ?? 0) +
    (counts.get(BiomeId.RAINFOREST) ?? 0);
  const plains =
    (counts.get(BiomeId.GRASSLAND) ?? 0) +
    (counts.get(BiomeId.WINDWARD_PLAINS) ?? 0) +
    (counts.get(BiomeId.SAVANNA) ?? 0);
  const desert = counts.get(BiomeId.DESERT) ?? 0;
  const jungle = counts.get(BiomeId.RAINFOREST) ?? 0;
  const cold =
    (counts.get(BiomeId.TUNDRA) ?? 0) +
    (counts.get(BiomeId.SNOW_ICE) ?? 0) +
    (counts.get(BiomeId.TAIGA) ?? 0);

  const produced: string[] = [];
  if (plains >= 4 || nearRiver || nearLake) produced.push('wheat');
  if (nearWater) produced.push('fish', 'salt');
  if (nearLake && !nearWater) produced.push('fish');
  if (forests >= 4) produced.push('timber', 'herbs');
  if (mountains >= 4) produced.push('iron', 'marble');
  if (mountains >= 8) produced.push('gold', 'gems');
  if (jungle >= 3) produced.push('spices', 'tea');
  if (desert >= 4) produced.push('spices', 'silk');
  if (cold >= 5) produced.push('leather');
  if (plains >= 6 && forests >= 2) produced.push('wine');
  if (featureBonuses.length > 0) produced.push(...featureBonuses.slice(0, 2));
  if (produced.length === 0) produced.push('wheat', 'leather');

  const uniqueProduced = Array.from(new Set(produced)).slice(0, 4);
  const candidateDemand = ['weapons', 'wine', 'silk', 'salt', 'iron', 'timber', 'spices', 'wheat'];
  const demandedGoods = candidateDemand.filter((g) => !uniqueProduced.includes(g)).slice(0, 3);

  return { producedGoods: uniqueProduced, demandedGoods };
}

const FANTASY_CITY_NAMES = [
  'วัลฮาเวน',
  'ซิลเวอร์ฮาร์เบอร์',
  'ออเรนการ์ด',
  'ธานีริมธาร',
  'ป้อมอรุณรุ่ง',
  'เวนดาลอร์',
  'คาร์ธาเรีย',
  'เมืองท่ามรกต',
  'ไอออนคราวน์',
  'โอเอซิสสุริยัน',
];

/** Generate a complete geographically coherent fantasy world with starter cities, politics, religions & trade routes. */
export function generateWorld(
  width: number,
  height: number,
  hexSizeKm: number,
  config: GeographyConfig,
  existingName = 'แผนที่โลกใหม่'
): HexMapData {
  const elevation = generateElevationField(width, height, config);
  const { temperature, moisture } = simulateClimate(elevation, width, height, config);
  const terrains = classifyTerrainsFromElevation(elevation, width, height, moisture);
  const initialBiomes = classifyBiomesFromClimate(
    elevation,
    temperature,
    moisture,
    width,
    height,
    undefined,
    terrains
  );

  const hydro = generateRiversAuto({
    width,
    height,
    terrains,
    biomes: initialBiomes,
    elevation,
    moisture,
    geography: config,
  });

  const biomes = classifyBiomesFromClimate(
    elevation,
    temperature,
    moisture,
    width,
    height,
    hydro.riverMoistureBonus,
    terrains
  );

  const baseFeatures = generateSpecialFeatures(
    width,
    height,
    biomes,
    elevation,
    temperature,
    moisture,
    hydro.rivers,
    config.seed,
    terrains
  );
  const rawFeatures =
    (config.tectonicStrength ?? 0) > 0 && config.landmassType !== 'real_earth'
      ? applyTectonicFeatures(
          baseFeatures,
          width,
          height,
          elevation,
          computeTectonicField(width, height, config.seed, config.tectonicPlates ?? 8),
          config.seed
        )
      : baseFeatures;

  const cliffRes = generateNaturalCliffs(
    width,
    height,
    biomes,
    elevation,
    rawFeatures,
    hydro.rivers,
    config.seed,
    undefined,
    terrains
  );

  const waterSync = syncShallowWater({
    width,
    height,
    terrains,
    biomes,
    elevation: cliffRes.elevation,
    features: cliffRes.features,
    customBiomes: [],
  });

  const total = width * height;
  const map: HexMapData = {
    version: 1,
    id: `map_${Date.now().toString(36)}`,
    name: existingName,
    updatedAt: new Date().toISOString(),
    width,
    height,
    hexSizeKm,
    geography: { ...config },
    terrains: waterSync.terrains,
    biomes: waterSync.biomes,
    elevation: waterSync.elevation,
    temperature,
    moisture,
    features: waterSync.features,
    territories: new Array<string>(total).fill(''),
    religions: new Array<string>(total).fill(''),
    cultures: new Array<string>(total).fill(''),
    rivers: hydro.rivers,
    cities: [],
    kingdoms: DEFAULT_KINGDOMS.map((k) => ({ ...k })),
    religionList: DEFAULT_RELIGIONS.map((r) => ({ ...r })),
    cultureList: DEFAULT_CULTURES.map((c) => ({ ...c })),
    goods: DEFAULT_GOODS.map((g) => ({ ...g })),
    customBiomes: [],
    customPoiTypes: [],
    customGovernmentTypes: [],
    customReligionTypes: [],
    customCultureTypes: [],
    roads: [],
    tradeRoutes: [],
    pois: [],
    labels: [],
  };

  const rng = mulberry32(config.seed + 99);
  const candidates: { q: number; r: number; score: number; isAccessibleCoast: boolean }[] = [];
  const marginX = Math.max(4, Math.floor(width * 0.08));
  const marginY = Math.max(4, Math.floor(height * 0.08));

  for (let r = marginY; r < height - marginY; r += 2) {
    for (let q = marginX; q < width - marginX; q += 2) {
      const idx = hexIndex(q, r, width);
      const t = map.terrains[idx];
      const b = map.biomes[idx];
      if (
        t === TerrainId.DEEP_OCEAN ||
        t === TerrainId.SHALLOW_WATER ||
        t === TerrainId.LAKE ||
        t === TerrainId.MOUNTAIN ||
        t === TerrainId.HIGH_PEAK ||
        b === BiomeId.SNOW_ICE
      ) {
        continue;
      }
      const nbs = getNeighbors(q, r, width, height);
      const isCoast = nbs.some((nb) => {
        const nbB = map.biomes[hexIndex(nb.q, nb.r, width)];
        return nbB === BiomeId.SHALLOW_WATER || nbB === BiomeId.DEEP_OCEAN;
      });
      const isCliff = map.features[idx] === 'cliff';
      const isAccessibleCoast = isCoast && !isCliff;
      const fluxScore = Math.min(40, hydro.flux[idx]);
      const tempScore = temperature[idx] >= 6 && temperature[idx] <= 28 ? 18 : 4;
      const score =
        fluxScore * 1.1 +
        (isAccessibleCoast ? 22 : 0) -
        (isCliff ? 14 : 0) +
        tempScore +
        (b === BiomeId.GRASSLAND || b === BiomeId.WINDWARD_PLAINS ? 12 : 0) +
        rng() * 6;
      candidates.push({ q, r, score, isAccessibleCoast });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const minCitySpacing = Math.max(10, Math.floor(Math.min(width, height) * 0.22));
  const placed: City[] = [];

  for (const c of candidates) {
    if (placed.length >= 4) break;
    if (placed.some((p) => hexDistance(p, c) < minCitySpacing)) continue;
    const idx = placed.length;
    const { producedGoods, demandedGoods } = autoSuggestGoodsForCity(map, c.q, c.r);
    const tier = idx === 0 ? 'capital' : c.isAccessibleCoast ? 'port' : idx === 1 ? 'city' : 'town';
    const pop =
      tier === 'capital' ? 68000 : tier === 'city' ? 28000 : tier === 'port' ? 19000 : 8500;
    placed.push({
      id: `city_${idx + 1}`,
      name: FANTASY_CITY_NAMES[idx % FANTASY_CITY_NAMES.length],
      q: c.q,
      r: c.r,
      tier,
      population: pop,
      kingdomId: map.kingdoms[idx % map.kingdoms.length].id,
      religionId: map.religionList[idx % map.religionList.length].id,
      cultureId: map.cultureList[idx % map.cultureList.length].id,
      producedGoods,
      demandedGoods,
      notes: 'ตั้งถิ่นฐานอัตโนมัติตามแหล่งน้ำและภูมิศาสตร์',
    });
  }
  map.cities = placed;

  // Connect starter cities with up to 2 trade routes
  const routes: TradeRoute[] = [];
  for (let i = 0; i < placed.length - 1 && routes.length < 2; i++) {
    const from = placed[i];
    const to = placed[i + 1];
    const mode = from.tier === 'port' || to.tier === 'port' ? 'mixed' : 'land';
    const res = findHexPath(map, from, to, mode);
    if (res.reachable && res.hexes.length >= 2) {
      const speedKmPerDay = mode === 'mixed' ? 55 : 25;
      routes.push({
        id: `route_init_${i + 1}`,
        fromCityId: from.id,
        toCityId: to.id,
        goodIds: from.producedGoods.slice(0, 2),
        mode,
        hexes: res.hexes,
        distanceKm: Math.round(res.distanceKm),
        travelDays: Number(Math.max(1, res.distanceKm / speedKmPerDay).toFixed(1)),
      });
    }
  }
  map.tradeRoutes = routes;

  // Generate starter territories, religions & cultures from cities
  map.territories = generateTerritoriesFromCities(map);
  map.religions = generateReligionsFromCities(map);
  map.cultures = generateCulturesFromCities(map);

  return map;
}

/**
 * Recompute real climate (temperature, rainfall, rain shadows) and update land biomes
 * while preserving the user's current terrain landforms, sea/land silhouette, and custom biomes.
 */
export function recomputeBiomesFromCurrentMap(map: HexMapData): HexMapData {
  const { width, height, biomes, geography } = map;
  const total = width * height;
  const baseTerrains = new Array<number>(total);
  const elev = new Array<number>(total);

  for (let i = 0; i < total; i++) {
    const t = getHexTerrain(map, i);
    baseTerrains[i] = t;
    const b = biomes[i];
    const band = getElevationBandForTerrain(t, map.customTerrains, map.terrainOverrides);
    const curE = map.elevation[i];
    if (t === TerrainId.PLAINS && b === BiomeId.SWAMP) {
      elev[i] = 0.04;
    } else if (Number.isFinite(curE) && curE >= band.minE && curE <= band.maxE) {
      // Preserve continuous elevation values within the terrain's realistic band
      elev[i] = curE;
    } else if (Number.isFinite(curE)) {
      elev[i] = Math.max(band.minE, Math.min(band.maxE, curE));
    } else {
      elev[i] = band.targetE;
    }
  }

  const { temperature, moisture } = simulateClimate(
    elev,
    width,
    height,
    geography,
    baseTerrains,
    map.manualCurrents
  );
  const hydro = generateRiversAuto(
    { width, height, terrains: baseTerrains, biomes, elevation: elev, moisture, geography },
    { useCurrentBiomes: false }
  );

  const nextBiomes = classifyBiomesFromClimate(
    elev,
    temperature,
    moisture,
    width,
    height,
    hydro.riverMoistureBonus,
    baseTerrains
  );

  // Preserve water, lakes, and custom biomes/terrains (>=100), while updating climate biomes across all land terrains
  for (let i = 0; i < total; i++) {
    const b = biomes[i];
    const bMeta = getBiomeMetaWithCustom(b, map.customBiomes);
    const isTWater = isWaterTerrainWithCustom(
      baseTerrains[i],
      map.customTerrains,
      map.terrainOverrides
    );
    if (
      b >= 100 ||
      bMeta.isWater ||
      baseTerrains[i] === TerrainId.LAKE ||
      isTWater
    ) {
      nextBiomes[i] = baseTerrains[i] === TerrainId.LAKE ? BiomeId.LAKE : b;
    }
  }

  const waterSync = syncShallowWater({
    width,
    height,
    terrains: baseTerrains,
    biomes: nextBiomes,
    elevation: elev,
    features: map.features,
    customBiomes: map.customBiomes,
  });

  return {
    ...map,
    updatedAt: new Date().toISOString(),
    terrains: waterSync.terrains,
    elevation: waterSync.elevation,
    temperature,
    moisture,
    biomes: waterSync.biomes,
    features: waterSync.features,
  };
}
