import { getBiomeMetaWithCustom } from '../data/biomes';
import {
  BiomeId,
  City,
  HexMapData,
  MapLabel,
  PointOfInterest,
  RoadPath,
  TerrainId,
  TradeRoute,
} from '../types/map';
import { autoDetectCliffsFromElevation, syncShallowWater } from './cliffs';
import { findHexPath, getHexTerrain, getNeighbors, hexDistance, hexIndex } from './hexMath';
import { generateRiversAuto } from './hydrology';
import { generateCultureName } from './nameGenerator';
import { mulberry32 } from './noise';
import {
  generateCulturesFromCities,
  generateReligionsFromCities,
  generateTerritoriesFromCities,
} from './politics';
import { detectStrategicChokepoints } from './strategy';
import { applyTectonicFeatures, applyTectonicsToCurrentMap, computeTectonicField } from './tectonics';
import {
  autoSuggestGoodsForCity,
  classifyBiomesFromClimate,
  recomputeBiomesFromCurrentMap,
} from './worldGenerator';

export interface AutoFeatureOptions {
  preserveExisting?: boolean;
  density?: number; // 0.4 .. 2.0 (default 1.0)
  includeGeological?: boolean;
  includeCoastalWater?: boolean;
  includeInlandEcology?: boolean;
  includeCliffs?: boolean;
  useTectonics?: boolean;
}

export interface AutoFeatureResult {
  features: string[];
  elevation: number[];
  terrains: number[];
  biomes: number[];
  placedCount: number;
  breakdown: Record<string, number>;
}

/**
 * Automatically place geographically plausible special features across the current map
 * using terrain, biomes, temperature, moisture, river courses/mouths, slopes, and tectonic fault belts.
 */
export function autoPlaceSpecialFeatures(
  map: HexMapData,
  options: AutoFeatureOptions = {}
): AutoFeatureResult {
  const { width, height } = map;
  const total = width * height;
  const density = Math.max(0.4, Math.min(2.0, options.density ?? 1.0));
  const preserveExisting = options.preserveExisting ?? false;
  const includeGeo = options.includeGeological !== false;
  const includeWater = options.includeCoastalWater !== false;
  const includeInland = options.includeInlandEcology !== false;
  const includeCliffs = options.includeCliffs !== false;
  const useTectonics = options.useTectonics !== false;

  const baseFeatures = preserveExisting
    ? [...(map.features ?? new Array<string>(total).fill(''))]
    : new Array<string>(total).fill('');

  const terrains = map.terrains ? [...map.terrains] : new Array<number>(total);
  if (!map.terrains) {
    for (let i = 0; i < total; i++) terrains[i] = getHexTerrain(map, i);
  }

  // Index river cells and river mouths for floodplain / delta placement
  const riverSet = new Set<number>();
  const mouthSet = new Set<number>();
  for (const riv of map.rivers) {
    for (let p = 0; p < riv.points.length; p++) {
      const pt = riv.points[p];
      if (pt.q >= 0 && pt.q < width && pt.r >= 0 && pt.r < height) {
        const rIdx = hexIndex(pt.q, pt.r, width);
        riverSet.add(rIdx);
        if (p === riv.points.length - 1) mouthSet.add(rIdx);
      }
    }
  }

  const tectonicField = useTectonics
    ? computeTectonicField(
        width,
        height,
        map.geography.seed,
        map.geography.tectonicPlates ?? 8,
        map.customTectonicPlates
      )
    : null;

  const rng = mulberry32(map.geography.seed + 13107);
  const features = [...baseFeatures];

  const isWaterTerr = (t: number, b: number) =>
    t === TerrainId.DEEP_OCEAN ||
    t === TerrainId.SHALLOW_WATER ||
    t === TerrainId.LAKE ||
    isWaterBiomeCheck(b);

  function isWaterBiomeCheck(b: number): boolean {
    const m = getBiomeMetaWithCustom(b, map.customBiomes);
    return m.isWater;
  }

  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const idx = hexIndex(q, r, width);
      if (preserveExisting && features[idx]) continue;

      const t = terrains[idx];
      if (t === TerrainId.LAKE) {
        features[idx] = '';
        continue;
      }

      const b = map.biomes[idx];
      const elev = map.elevation[idx] ?? 0;
      const temp = map.temperature[idx] ?? 15;
      const moist = map.moisture[idx] ?? 0.5;
      const nbs = getNeighbors(q, r, width, height);

      const isOcean =
        t === TerrainId.DEEP_OCEAN ||
        t === TerrainId.SHALLOW_WATER ||
        b === BiomeId.DEEP_OCEAN ||
        b === BiomeId.SHALLOW_WATER;

      let touchesWater = false;
      let touchesLand = false;
      let touchesCliffLand = false;
      let adjacentRiver = riverSet.has(idx);

      for (const nb of nbs) {
        const nbIdx = hexIndex(nb.q, nb.r, width);
        const nbT = terrains[nbIdx];
        const nbB = map.biomes[nbIdx];
        if (isWaterTerr(nbT, nbB)) {
          touchesWater = true;
        } else {
          touchesLand = true;
          if (features[nbIdx] === 'cliff') touchesCliffLand = true;
        }
        if (riverSet.has(nbIdx)) adjacentRiver = true;
      }

      const roll = rng() / density;

      // 1. Coastal & Oceanic Features (never on freshwater lakes)
      if (isOcean) {
        if (!includeWater) continue;
        if (t === TerrainId.SHALLOW_WATER && temp >= 18 && !touchesCliffLand) {
          if (roll < 0.048) features[idx] = 'coral_reef';
          else if (roll < 0.072 && !touchesLand) features[idx] = 'atoll';
          else if (roll < 0.095 && touchesLand) features[idx] = 'lagoon';
        } else if (t === TerrainId.DEEP_OCEAN && !touchesLand) {
          const nearFault = tectonicField && tectonicField.boundaryKind[idx] > 0;
          const vChance = nearFault && includeGeo ? 0.035 : 0.005;
          if (roll < vChance) features[idx] = 'volcanic_island';
          else if (roll < vChance + 0.01) features[idx] = 'sea_islets';
        }
        continue;
      }

      // 2. Geological Fault-Belt Features (Volcanoes / Hot Springs / Canyons)
      if (includeGeo && tectonicField) {
        const bKind = tectonicField.boundaryKind[idx];
        if (bKind === 1 && elev > 0.22 && roll < 0.14) {
          features[idx] = roll < 0.075 ? 'volcanic_soil' : 'hot_springs';
          continue;
        }
        if (bKind === 2 && elev > 0.08 && roll < 0.14) {
          features[idx] = 'canyon';
          continue;
        }
      }

      // 3. Coastal Land Features (Deltas, Fjords, Mangroves)
      if (touchesWater && includeInland) {
        const hasMouth = mouthSet.has(idx) || nbs.some((nb) => mouthSet.has(hexIndex(nb.q, nb.r, width)));
        if (hasMouth && roll < 0.65) {
          features[idx] = 'river_delta';
          continue;
        }
        if (temp <= 6 && elev >= 0.2 && roll < 0.16) {
          features[idx] = 'fjord';
          continue;
        }
        if (temp >= 20 && moist >= 0.48 && elev < 0.18 && roll < 0.17) {
          features[idx] = 'mangrove';
          continue;
        }
      }

      // 4. Mountain / Highland / Inland Ecological Features
      if (includeGeo && (t === TerrainId.MOUNTAIN || t === TerrainId.HIGH_PEAK)) {
        if (roll < 0.055) features[idx] = 'cave';
        else if (roll < 0.085) features[idx] = 'hot_springs';
        else if (roll < 0.105) features[idx] = 'volcanic_soil';
        continue;
      }

      if (includeGeo && (t === TerrainId.HILLS || t === TerrainId.HIGHLAND)) {
        if ((moist < 0.36 || adjacentRiver) && roll < 0.075) {
          features[idx] = 'canyon';
        } else if (moist >= 0.46 && roll < 0.065) {
          features[idx] = 'karst';
        }
        continue;
      }

      if (!includeInland) continue;

      if (b === BiomeId.DESERT) {
        if (roll < 0.032) features[idx] = 'oasis';
        else if (elev < 0.16 && roll < 0.052) features[idx] = 'salt_flats';
        else if (elev >= 0.16 && roll < 0.068) features[idx] = 'mesa';
      } else if (b === BiomeId.SWAMP) {
        if (roll < 0.2) features[idx] = 'peat_bog';
      } else if (
        t === TerrainId.PLAINS &&
        (b === BiomeId.GRASSLAND || b === BiomeId.WINDWARD_PLAINS || b === BiomeId.SAVANNA)
      ) {
        if (adjacentRiver && roll < 0.18) features[idx] = 'floodplain';
        else if (moist >= 0.5 && roll < 0.055) features[idx] = 'fertile_meadow';
      }
    }
  }

  // Also apply fault features gently on top if tectonics enabled & slots empty
  const faultMerged =
    useTectonics && tectonicField && includeGeo
      ? applyTectonicFeatures(features, width, height, map.elevation, tectonicField, map.geography.seed)
      : features;
  for (let i = 0; i < total; i++) {
    if (terrains[i] === TerrainId.LAKE) faultMerged[i] = '';
  }

  let outElevation = [...map.elevation];
  let outTerrains = terrains;
  let outBiomes = [...map.biomes];
  let outFeatures = faultMerged;

  if (includeCliffs) {
    const cliffRes = autoDetectCliffsFromElevation({
      width,
      height,
      biomes: outBiomes,
      elevation: outElevation,
      features: outFeatures,
      customBiomes: map.customBiomes,
      terrains: outTerrains,
    });
    const synced = syncShallowWater({
      width,
      height,
      terrains: cliffRes.terrains,
      biomes: cliffRes.biomes,
      elevation: cliffRes.elevation,
      features: cliffRes.features,
      customBiomes: map.customBiomes,
    });
    outElevation = synced.elevation;
    outTerrains = synced.terrains;
    outBiomes = synced.biomes;
    outFeatures = synced.features;
  }

  const breakdown: Record<string, number> = {};
  let placedCount = 0;
  for (let i = 0; i < total; i++) {
    const fid = outFeatures[i];
    if (!fid) continue;
    placedCount++;
    breakdown[fid] = (breakdown[fid] ?? 0) + 1;
  }

  return {
    features: outFeatures,
    elevation: outElevation,
    terrains: outTerrains,
    biomes: outBiomes,
    placedCount,
    breakdown,
  };
}

export interface WorldSimulationOptions {
  applyTectonics: boolean;
  tectonicStrength: number;
  recomputeClimateBiomes: boolean;
  generateRivers: boolean;
  placeFeatures: boolean;
  featureDensity: number;
  placeCities: boolean;
  cityCount: number;
  preserveExistingCities: boolean;
  generatePolitics: boolean;
  generateRoadsAndTrade: boolean;
  placeChokepointPois: boolean;
  generateRegionLabels: boolean;
}

export const DEFAULT_WORLD_SIMULATION_OPTIONS: WorldSimulationOptions = {
  applyTectonics: false,
  tectonicStrength: 0.55,
  recomputeClimateBiomes: true,
  generateRivers: true,
  placeFeatures: true,
  featureDensity: 1.0,
  placeCities: true,
  cityCount: 6,
  preserveExistingCities: false,
  generatePolitics: true,
  generateRoadsAndTrade: true,
  placeChokepointPois: true,
  generateRegionLabels: true,
};

export interface WorldSimulationSummary {
  rivers: number;
  features: number;
  cities: number;
  roads: number;
  tradeRoutes: number;
  pois: number;
  labels: number;
}

/**
 * Full multi-dimensional simulation derived causally from the user's current map:
 * Tectonics -> Climate & Biomes -> Hydrology & River Floodplains -> Geography Features
 * -> Culturally Named Cities -> Kingdoms/Religions/Cultures -> Land Roads & Sea Trade
 * -> Chokepoint Fortresses -> Region/Sea/Mountain Curved Labels.
 */
export function simulateAllFromCurrentMap(
  map: HexMapData,
  options: WorldSimulationOptions
): { map: HexMapData; summary: WorldSimulationSummary } {
  let next: HexMapData = {
    ...map,
    updatedAt: new Date().toISOString(),
  };

  // 1. Optional Tectonic Uplift / Rifting on current elevation
  if (options.applyTectonics) {
    next = applyTectonicsToCurrentMap(next, options.tectonicStrength);
  }

  // 2. Climate & Biomes recomputation preserving current landforms and lakes
  if (options.recomputeClimateBiomes) {
    next = recomputeBiomesFromCurrentMap(next);
  }

  // 3. Rivers & river-fed biome moisture
  if (options.generateRivers) {
    const hydro = generateRiversAuto(next, { useCurrentBiomes: true });
    const nextBiomes = classifyBiomesFromClimate(
      next.elevation,
      next.temperature,
      next.moisture,
      next.width,
      next.height,
      hydro.riverMoistureBonus,
      next.terrains
    );
    const total = next.width * next.height;
    for (let i = 0; i < total; i++) {
      const oldB = next.biomes[i];
      const curT = getHexTerrain(next, i);
      const oldMeta = getBiomeMetaWithCustom(oldB, next.customBiomes);
      if (oldB >= 100 || oldMeta.isWater || curT === TerrainId.LAKE) {
        nextBiomes[i] = curT === TerrainId.LAKE ? BiomeId.LAKE : oldB;
      }
    }
    const synced = syncShallowWater({
      width: next.width,
      height: next.height,
      terrains: next.terrains ?? [],
      biomes: nextBiomes,
      elevation: next.elevation,
      features: next.features,
      customBiomes: next.customBiomes,
    });
    next = {
      ...next,
      rivers: hydro.rivers,
      terrains: synced.terrains,
      biomes: synced.biomes,
      elevation: synced.elevation,
      features: synced.features,
    };
  }

  // 4. Geographic Special Features + Coastal Cliffs
  if (options.placeFeatures) {
    const featRes = autoPlaceSpecialFeatures(next, {
      preserveExisting: false,
      density: options.featureDensity,
      includeCliffs: true,
      useTectonics: true,
    });
    next = {
      ...next,
      features: featRes.features,
      elevation: featRes.elevation,
      terrains: featRes.terrains,
      biomes: featRes.biomes,
    };
  }

  const rng = mulberry32(next.geography.seed + next.cities.length * 197 + 911);

  // 5. Settlement & City Placement from Terrain, Fresh Water, Coastlines & Culture Names
  if (options.placeCities) {
    const riverSet = new Set<number>();
    for (const riv of next.rivers) {
      for (const pt of riv.points) {
        if (pt.q >= 0 && pt.q < next.width && pt.r >= 0 && pt.r < next.height) {
          riverSet.add(hexIndex(pt.q, pt.r, next.width));
        }
      }
    }

    const candidates: { q: number; r: number; score: number; isPort: boolean }[] = [];
    const marginX = Math.max(2, Math.floor(next.width * 0.05));
    const marginY = Math.max(2, Math.floor(next.height * 0.05));

    for (let r = marginY; r < next.height - marginY; r += 2) {
      for (let q = marginX; q < next.width - marginX; q += 2) {
        const idx = hexIndex(q, r, next.width);
        const t = getHexTerrain(next, idx);
        const b = next.biomes[idx];
        const bMeta = getBiomeMetaWithCustom(b, next.customBiomes);
        if (
          bMeta.isWater ||
          t === TerrainId.DEEP_OCEAN ||
          t === TerrainId.SHALLOW_WATER ||
          t === TerrainId.LAKE ||
          t === TerrainId.MOUNTAIN ||
          t === TerrainId.HIGH_PEAK ||
          b === BiomeId.SNOW_ICE ||
          next.features?.[idx] === 'cliff'
        ) {
          continue;
        }

        const nbs = getNeighbors(q, r, next.width, next.height);
        let touchesOcean = false;
        let touchesFresh = riverSet.has(idx);
        let nearbyHills = 0;
        for (const nb of nbs) {
          const nbIdx = hexIndex(nb.q, nb.r, next.width);
          const nbT = getHexTerrain(next, nbIdx);
          if (nbT === TerrainId.SHALLOW_WATER || nbT === TerrainId.DEEP_OCEAN) touchesOcean = true;
          if (nbT === TerrainId.LAKE || riverSet.has(nbIdx)) touchesFresh = true;
          if (nbT === TerrainId.HILLS || nbT === TerrainId.MOUNTAIN) nearbyHills++;
        }

        const temp = next.temperature[idx] ?? 15;
        const tempScore = temp >= 6 && temp <= 29 ? 20 : 4;
        const feat = next.features?.[idx];
        const featScore =
          feat === 'floodplain' || feat === 'fertile_meadow' || feat === 'river_delta' || feat === 'oasis'
            ? 18
            : 0;
        const score =
          (touchesFresh ? 32 : 0) +
          (touchesOcean ? 24 : 0) +
          (b === BiomeId.GRASSLAND || b === BiomeId.WINDWARD_PLAINS ? 14 : 4) +
          nearbyHills * 3 +
          tempScore +
          featScore +
          rng() * 5;
        candidates.push({ q, r, score, isPort: touchesOcean });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const targetTotal = Math.max(1, Math.min(20, Math.round(options.cityCount)));
    const placed: City[] = options.preserveExistingCities ? [...next.cities] : [];
    const minSpacing = Math.max(6, Math.floor(Math.min(next.width, next.height) / Math.max(2, Math.sqrt(targetTotal) * 1.4)));
    const kingdoms = next.kingdoms.length > 0 ? next.kingdoms : [];
    const religions = next.religionList.length > 0 ? next.religionList : [];
    const cultures = next.cultureList ?? [];

    for (const cand of candidates) {
      if (placed.length >= targetTotal) break;
      if (placed.some((p) => hexDistance(p, cand) < minSpacing)) continue;
      const i = placed.length;
      const k = kingdoms.length > 0 ? kingdoms[i % kingdoms.length] : null;
      const rel = religions.length > 0 ? religions[i % religions.length] : null;
      const cult = cultures.length > 0 ? cultures[i % cultures.length] : null;
      const tier =
        i === 0 ? 'capital' : cand.isPort ? 'port' : i <= Math.ceil(targetTotal * 0.45) ? 'city' : 'town';
      const pop =
        tier === 'capital'
          ? 62000 + Math.round(rng() * 18000)
          : tier === 'city'
          ? 24000 + Math.round(rng() * 12000)
          : tier === 'port'
          ? 17000 + Math.round(rng() * 9000)
          : 7500 + Math.round(rng() * 5000);
      const { producedGoods, demandedGoods } = autoSuggestGoodsForCity(next, cand.q, cand.r);
      const cityName = generateCultureName(cult, 'city', next.geography.seed + i * 313 + cand.q * 17);

      placed.push({
        id: `sim_city_${i + 1}`,
        name: cityName,
        q: cand.q,
        r: cand.r,
        tier,
        population: pop,
        kingdomId: k?.id ?? 'north',
        religionId: rel?.id ?? 'solaris',
        cultureId: cult?.id ?? 'valerian',
        producedGoods,
        demandedGoods,
        notes: 'วางเมืองจำลองอัตโนมัติตามแหล่งน้ำ ชายฝั่ง และความอุดมสมบูรณ์',
      });
    }
    next = { ...next, cities: placed };
  }

  // 6. Political Territories, Religions & Cultures spreading out from Cities
  if (options.generatePolitics && next.cities.length > 0) {
    next = {
      ...next,
      territories: generateTerritoriesFromCities(next),
      religions: generateReligionsFromCities(next),
      cultures: generateCulturesFromCities(next),
    };
  }

  // 7. Land Roads, Sea Lanes & Inter-City Trade Routes
  if (options.generateRoadsAndTrade && next.cities.length >= 2) {
    const newRoads: RoadPath[] = [];
    const newRoutes: TradeRoute[] = [];
    const connectedPairs = new Set<string>();

    for (let i = 0; i < next.cities.length; i++) {
      const from = next.cities[i];
      // Connect each city to its closest 2 neighbors on land or sea
      const others = next.cities
        .map((to, idx) => ({ to, idx, dist: hexDistance(from, to) }))
        .filter((o) => o.to.id !== from.id)
        .sort((a, b) => a.dist - b.dist);

      let linksForCity = 0;
      for (const target of others) {
        if (linksForCity >= 2) break;
        const pairKey = [from.id, target.to.id].sort().join('|');
        if (connectedPairs.has(pairKey)) continue;

        const isSeaPair = from.tier === 'port' && target.to.tier === 'port';
        const mode: 'land' | 'sea' | 'mixed' = isSeaPair ? 'sea' : 'land';
        let pathRes = findHexPath(next, from, target.to, mode);
        let finalMode: 'land' | 'sea' | 'mixed' = mode;
        if ((!pathRes.reachable || pathRes.hexes.length < 2) && (from.tier === 'port' || target.to.tier === 'port')) {
          pathRes = findHexPath(next, from, target.to, 'mixed');
          finalMode = 'mixed';
        }
        if (!pathRes.reachable || pathRes.hexes.length < 2) continue;

        connectedPairs.add(pairKey);
        linksForCity++;

        if (newRoads.length < 12) {
          newRoads.push({
            id: `sim_road_${newRoads.length + 1}`,
            type: finalMode === 'sea' ? 'sea' : target.dist <= 18 ? 'stone' : 'dirt',
            hexes: pathRes.hexes,
          });
        }
        if (newRoutes.length < 8) {
          const goods = Array.from(
            new Set([
              ...from.producedGoods.filter((g) => target.to.demandedGoods.includes(g)),
              ...from.producedGoods.slice(0, 1),
              ...target.to.producedGoods.slice(0, 1),
            ])
          ).slice(0, 2);
          const speedKmPerDay = finalMode === 'sea' ? 140 : finalMode === 'mixed' ? 55 : 25;
          newRoutes.push({
            id: `sim_trade_${newRoutes.length + 1}`,
            fromCityId: from.id,
            toCityId: target.to.id,
            goodIds: goods.length > 0 ? goods : ['wheat'],
            mode: finalMode,
            hexes: pathRes.hexes,
            distanceKm: Math.round(pathRes.distanceKm),
            travelDays: Number(Math.max(0.5, pathRes.distanceKm / speedKmPerDay).toFixed(1)),
          });
        }
      }
    }

    next = {
      ...next,
      roads: newRoads,
      tradeRoutes: newRoutes,
    };
  }

  // 8. Chokepoint Fortresses & Maritime Watchposts
  if (options.placeChokepointPois) {
    const cps = detectStrategicChokepoints(next, 10);
    const existingKeys = new Set(next.pois.map((p) => `${p.q}_${p.r}`));
    const addedPois: PointOfInterest[] = [...next.pois];
    let cpIdx = 0;
    for (const cp of cps) {
      if (cpIdx >= 6) break;
      const key = `${cp.q}_${cp.r}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      cpIdx++;
      addedPois.push({
        id: `sim_poi_${addedPois.length + 1}`,
        type: cp.kind === 'strait' ? 'old_port' : 'fortress',
        name:
          cp.kind === 'mountain_pass'
            ? `ป้อมช่องเขา #${cpIdx}`
            : cp.kind === 'isthmus'
            ? `ป้อมคอคอด #${cpIdx}`
            : `ด่านช่องแคบ #${cpIdx}`,
        q: cp.q,
        r: cp.r,
        notes: `จุดยุทธศาสตร์อัตโนมัติ (คะแนน ${cp.score})`,
      });
    }
    next = { ...next, pois: addedPois };
  }

  // 9. Regional, Maritime & Mountain Labels
  if (options.generateRegionLabels) {
    const labels: MapLabel[] = [];
    const cultures = next.cultureList ?? [];
    const primaryCulture = cultures[0] ?? null;

    // Kingdom territory centroids -> regional labels
    for (let ki = 0; ki < next.kingdoms.length; ki++) {
      const k = next.kingdoms[ki];
      let sumQ = 0;
      let sumR = 0;
      let cnt = 0;
      for (let i = 0; i < next.width * next.height; i++) {
        if (next.territories?.[i] === k.id) {
          const q = i % next.width;
          const r = (i - q) / next.width;
          sumQ += q;
          sumR += r;
          cnt++;
        }
      }
      if (cnt >= 12) {
        labels.push({
          id: `sim_lbl_k_${k.id}`,
          text: k.name,
          q: Math.round(sumQ / cnt),
          r: Math.round(sumR / cnt),
          size: 'lg',
          style: 'region',
          curveAmount: 0.15,
        });
      }
    }

    // Major mountain cluster label
    let mSumQ = 0;
    let mSumR = 0;
    let mCnt = 0;
    for (let i = 0; i < next.width * next.height; i++) {
      const t = getHexTerrain(next, i);
      if (t === TerrainId.MOUNTAIN || t === TerrainId.HIGH_PEAK) {
        const q = i % next.width;
        const r = (i - q) / next.width;
        mSumQ += q;
        mSumR += r;
        mCnt++;
      }
    }
    if (mCnt >= 6) {
      labels.push({
        id: 'sim_lbl_mtn',
        text: `เทือกเขา${generateCultureName(primaryCulture, 'city', next.geography.seed + 505)}`,
        q: Math.round(mSumQ / mCnt),
        r: Math.round(mSumR / mCnt),
        size: 'md',
        style: 'mountain',
        rotationDeg: -8,
        curveAmount: -0.25,
      });
    }

    // Major ocean label
    let wSumQ = 0;
    let wSumR = 0;
    let wCnt = 0;
    for (let i = 0; i < next.width * next.height; i += 3) {
      const t = getHexTerrain(next, i);
      if (t === TerrainId.DEEP_OCEAN) {
        const q = i % next.width;
        const r = (i - q) / next.width;
        wSumQ += q;
        wSumR += r;
        wCnt++;
      }
    }
    if (wCnt >= 10) {
      labels.push({
        id: 'sim_lbl_sea',
        text: generateCultureName(primaryCulture, 'sea', next.geography.seed + 808),
        q: Math.round(wSumQ / wCnt),
        r: Math.round(wSumR / wCnt),
        size: 'lg',
        style: 'water',
        curveAmount: 0.2,
      });
    }

    next = { ...next, labels };
  }

  let featCount = 0;
  for (const f of next.features ?? []) {
    if (f) featCount++;
  }

  return {
    map: next,
    summary: {
      rivers: next.rivers.length,
      features: featCount,
      cities: next.cities.length,
      roads: next.roads.length,
      tradeRoutes: next.tradeRoutes.length,
      pois: next.pois.length,
      labels: next.labels.length,
    },
  };
}
