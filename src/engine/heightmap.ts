import { GeographyConfig, HexMapData, TerrainId } from '../types/map';
import { syncShallowWater } from './cliffs';
import { hexIndex } from './hexMath';
import { generateRiversAuto } from './hydrology';
import {
  classifyBiomesFromClimate,
  classifyTerrainsFromElevation,
  DEFAULT_GEOGRAPHY_CONFIG,
  generateSpecialFeatures,
  generateWorld,
  simulateClimate,
} from './worldGenerator';

export interface HeightmapImportOptions {
  name?: string;
  seaLevelThreshold?: number; // 0..1 normalized luminance cutoff mapped to sea level (default 0.38)
  elevationScale?: number; // 0.5..1.8 (default 1.0)
  invert?: boolean;
  geography?: Partial<GeographyConfig>;
}

/**
 * Convert an RGBA pixel buffer (heightmap / hand-drawn landmass grayscale) into a complete,
 * climate-simulated HexMapData with terrain classification, rivers, coasts, and biomes.
 */
export function convertHeightmapPixelsToMap(
  rgba: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  targetW: number,
  targetH: number,
  hexSizeKm: number,
  options: HeightmapImportOptions = {}
): HexMapData {
  const safeW = Math.max(10, Math.min(1200, Math.round(targetW)));
  const safeH = Math.max(10, Math.min(1200, Math.round(targetH)));
  const threshold = Math.max(0.05, Math.min(0.9, options.seaLevelThreshold ?? 0.38));
  const scale = Math.max(0.4, Math.min(1.8, options.elevationScale ?? 1.0));
  const invert = Boolean(options.invert);

  const geo: GeographyConfig = {
    ...DEFAULT_GEOGRAPHY_CONFIG,
    ...options.geography,
  };

  const baseMap = generateWorld(safeW, safeH, hexSizeKm, geo, options.name ?? 'แผนที่จาก Heightmap');
  const total = safeW * safeH;
  const elevation = new Array<number>(total);

  for (let r = 0; r < safeH; r++) {
    const sy = Math.min(imgH - 1, Math.floor((r / Math.max(1, safeH - 1)) * (imgH - 1)));
    for (let q = 0; q < safeW; q++) {
      const sx = Math.min(imgW - 1, Math.floor((q / Math.max(1, safeW - 1)) * (imgW - 1)));
      const pIdx = (sy * imgW + sx) * 4;
      const rr = rgba[pIdx] ?? 0;
      const gg = rgba[pIdx + 1] ?? 0;
      const bb = rgba[pIdx + 2] ?? 0;
      const alpha = (rgba[pIdx + 3] ?? 255) / 255;

      let lum = ((0.299 * rr + 0.587 * gg + 0.114 * bb) / 255) * alpha;
      if (invert) lum = 1 - lum;

      let e: number;
      if (lum <= threshold) {
        const depthT = threshold > 0 ? (threshold - lum) / threshold : 0;
        e = -0.04 - depthT * 0.86;
      } else {
        const landT = 1 - threshold > 0 ? (lum - threshold) / (1 - threshold) : 0;
        e = 0.03 + Math.pow(landT, 1.05) * 0.92 * scale;
      }
      elevation[hexIndex(q, r, safeW)] = Number(Math.max(-1, Math.min(1, e)).toFixed(3));
    }
  }

  const { temperature, moisture } = simulateClimate(elevation, safeW, safeH, geo);
  const terrains = classifyTerrainsFromElevation(elevation, safeW, safeH, moisture);
  const initialBiomes = classifyBiomesFromClimate(
    elevation,
    temperature,
    moisture,
    safeW,
    safeH,
    undefined,
    terrains
  );

  const hydro = generateRiversAuto(
    {
      width: safeW,
      height: safeH,
      terrains,
      biomes: initialBiomes,
      elevation,
      moisture,
      geography: geo,
    },
    { threshold: geo.riverThreshold, useCurrentBiomes: false }
  );

  const biomes = classifyBiomesFromClimate(
    elevation,
    temperature,
    moisture,
    safeW,
    safeH,
    hydro.riverMoistureBonus,
    terrains
  );

  const features = generateSpecialFeatures(
    safeW,
    safeH,
    biomes,
    elevation,
    temperature,
    moisture,
    hydro.rivers,
    geo.seed,
    terrains
  );

  const synced = syncShallowWater({
    width: safeW,
    height: safeH,
    terrains,
    biomes,
    elevation,
    features,
    customBiomes: [],
  });

  // Preserve land city positions only if any remain valid land; otherwise clear starter cities on imported coastline
  const validCities = baseMap.cities.filter((c) => {
    const idx = hexIndex(c.q, c.r, safeW);
    return (synced.terrains[idx] ?? TerrainId.DEEP_OCEAN) >= TerrainId.PLAINS;
  });

  return {
    ...baseMap,
    elevation: synced.elevation,
    terrains: synced.terrains,
    biomes: synced.biomes,
    temperature,
    moisture,
    features: synced.features,
    rivers: hydro.rivers,
    cities: validCities,
    territories: new Array<string>(total).fill(''),
    religions: new Array<string>(total).fill(''),
    cultures: new Array<string>(total).fill(''),
    roads: [],
    tradeRoutes: [],
  };
}
