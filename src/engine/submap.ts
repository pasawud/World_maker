import { BiomeId, GeographyConfig, HexMapData, SubMapBounds, TerrainId } from '../types/map';
export type { SubMapBounds };
import { syncShallowWater } from './cliffs';
import { terrainFromElevation } from './elevation';
import { getHexTerrain, hexIndex, isWaterBiome } from './hexMath';
import { generateRiversAuto } from './hydrology';
import { createNoise2D } from './noise';
import {
  classifyBiomesFromClimate,
  getColLongitude,
  getRowLatitude,
  simulateClimate,
} from './worldGenerator';

/** Compute bounding box containing a kingdom's territories or cities, padded cleanly for regional zoom. */
export function computeKingdomBounds(
  map: HexMapData,
  kingdomId: string,
  padding = 4
): SubMapBounds {
  let minQ = map.width;
  let maxQ = -1;
  let minR = map.height;
  let maxR = -1;

  for (let r = 0; r < map.height; r++) {
    for (let q = 0; q < map.width; q++) {
      if (map.territories?.[hexIndex(q, r, map.width)] === kingdomId) {
        if (q < minQ) minQ = q;
        if (q > maxQ) maxQ = q;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
      }
    }
  }
  for (const c of map.cities) {
    if (c.kingdomId === kingdomId) {
      if (c.q < minQ) minQ = c.q;
      if (c.q > maxQ) maxQ = c.q;
      if (c.r < minR) minR = c.r;
      if (c.r > maxR) maxR = c.r;
    }
  }

  if (maxQ < minQ || maxR < minR) {
    return {
      minQ: Math.floor(map.width * 0.25),
      maxQ: Math.floor(map.width * 0.75),
      minR: Math.floor(map.height * 0.25),
      maxR: Math.floor(map.height * 0.75),
    };
  }

  return {
    minQ: Math.max(0, minQ - padding),
    maxQ: Math.min(map.width - 1, maxQ + padding),
    minR: Math.max(0, minR - padding),
    maxR: Math.min(map.height - 1, maxR + padding),
  };
}

/**
 * Extract a higher-detail regional sub-map from a bounding box in sourceMap.
 * Upsamples elevation bilinearly + micro-detail, rescales coordinates, crops lat/lon, and preserves world lore/diplomacy.
 */
export function extractRegionalSubMap(
  sourceMap: HexMapData,
  bounds: SubMapBounds,
  scaleFactor: 2 | 3 | 4 | 6 = 2,
  subMapName?: string
): HexMapData {
  const minQ = Math.max(0, Math.min(sourceMap.width - 2, Math.floor(bounds.minQ)));
  const maxQ = Math.max(minQ + 4, Math.min(sourceMap.width - 1, Math.floor(bounds.maxQ)));
  const minR = Math.max(0, Math.min(sourceMap.height - 2, Math.floor(bounds.minR)));
  const maxR = Math.max(minR + 4, Math.min(sourceMap.height - 1, Math.floor(bounds.maxR)));

  const srcSpanW = maxQ - minQ + 1;
  const srcSpanH = maxR - minR + 1;
  const outW = Math.max(20, Math.min(320, srcSpanW * scaleFactor));
  const outH = Math.max(20, Math.min(240, srcSpanH * scaleFactor));
  const outHexKm = Number(Math.max(0.5, sourceMap.hexSizeKm / scaleFactor).toFixed(2));
  const total = outW * outH;

  const latNorth = Number(getRowLatitude(minR, sourceMap.height, sourceMap.geography).toFixed(1));
  const latSouth = Number(getRowLatitude(maxR, sourceMap.height, sourceMap.geography).toFixed(1));
  const lonWest = Number(getColLongitude(minQ, sourceMap.width, sourceMap.geography).toFixed(1));
  const lonEast = Number(getColLongitude(maxQ, sourceMap.width, sourceMap.geography).toFixed(1));

  const subGeo: GeographyConfig = {
    ...sourceMap.geography,
    latNorth,
    latSouth: Math.min(latSouth, latNorth - 1),
    lonWest,
    lonEast: Math.max(lonEast, lonWest + 1),
    riverThreshold: Math.max(8, Math.round(sourceMap.geography.riverThreshold * 0.75)),
  };

  const elevation = new Array<number>(total);
  const terrains = new Array<number>(total);
  const biomes = new Array<number>(total);
  const features = new Array<string>(total);
  const territories = new Array<string>(total);
  const religions = new Array<string>(total);
  const cultures = new Array<string>(total);

  const noise = createNoise2D(sourceMap.geography.seed + 901);

  for (let r = 0; r < outH; r++) {
    const srcRf = minR + (r / Math.max(1, outH - 1)) * (srcSpanH - 1);
    const r0 = Math.min(sourceMap.height - 1, Math.floor(srcRf));
    const r1 = Math.min(sourceMap.height - 1, r0 + 1);
    const fr = srcRf - r0;

    for (let q = 0; q < outW; q++) {
      const srcQf = minQ + (q / Math.max(1, outW - 1)) * (srcSpanW - 1);
      const q0 = Math.min(sourceMap.width - 1, Math.floor(srcQf));
      const q1 = Math.min(sourceMap.width - 1, q0 + 1);
      const fq = srcQf - q0;

      const i00 = hexIndex(q0, r0, sourceMap.width);
      const i10 = hexIndex(q1, r0, sourceMap.width);
      const i01 = hexIndex(q0, r1, sourceMap.width);
      const i11 = hexIndex(q1, r1, sourceMap.width);

      const e00 = sourceMap.elevation[i00] ?? 0;
      const e10 = sourceMap.elevation[i10] ?? 0;
      const e01 = sourceMap.elevation[i01] ?? 0;
      const e11 = sourceMap.elevation[i11] ?? 0;

      const eTop = e00 * (1 - fq) + e10 * fq;
      const eBot = e01 * (1 - fq) + e11 * fq;
      const baseElev = eTop * (1 - fr) + eBot * fr;

      const nearestIdx = hexIndex(Math.round(srcQf), Math.round(srcRf), sourceMap.width);
      const srcT = getHexTerrain(sourceMap, nearestIdx);
      const micro = noise.sample(q * 0.16, r * 0.16) * 0.035;
      const finalElev = Number(Math.max(-1, Math.min(1, baseElev + micro)).toFixed(3));

      const outIdx = hexIndex(q, r, outW);
      elevation[outIdx] = finalElev;

      if (srcT === TerrainId.LAKE && finalElev < 0.08) {
        terrains[outIdx] = TerrainId.LAKE;
        biomes[outIdx] = BiomeId.LAKE;
      } else if (srcT >= 100) {
        terrains[outIdx] = srcT;
        biomes[outIdx] = sourceMap.biomes[nearestIdx];
      } else {
        terrains[outIdx] = terrainFromElevation(
          finalElev,
          srcT,
          sourceMap.customTerrains,
          sourceMap.terrainOverrides
        );
        biomes[outIdx] = sourceMap.biomes[nearestIdx];
      }

      const nearestWater = isWaterBiome(sourceMap.biomes[nearestIdx], sourceMap.customBiomes);
      const nowWater = terrains[outIdx] === TerrainId.DEEP_OCEAN || terrains[outIdx] === TerrainId.SHALLOW_WATER || terrains[outIdx] === TerrainId.LAKE;

      features[outIdx] = nearestWater === nowWater ? sourceMap.features?.[nearestIdx] ?? '' : '';
      territories[outIdx] = nowWater ? '' : sourceMap.territories?.[nearestIdx] ?? '';
      religions[outIdx] = nowWater ? '' : sourceMap.religions?.[nearestIdx] ?? '';
      cultures[outIdx] = nowWater ? '' : sourceMap.cultures?.[nearestIdx] ?? '';
    }
  }

  const { temperature, moisture } = simulateClimate(
    elevation,
    outW,
    outH,
    subGeo,
    terrains,
    sourceMap.manualCurrents
  );
  const hydro = generateRiversAuto(
    {
      width: outW,
      height: outH,
      terrains,
      biomes,
      elevation,
      moisture,
      geography: subGeo,
    },
    { threshold: subGeo.riverThreshold, useCurrentBiomes: false }
  );

  const climateBiomes = classifyBiomesFromClimate(
    elevation,
    temperature,
    moisture,
    outW,
    outH,
    hydro.riverMoistureBonus,
    terrains
  );

  for (let i = 0; i < total; i++) {
    if (biomes[i] >= 100 || terrains[i] === TerrainId.LAKE) {
      if (terrains[i] === TerrainId.LAKE) biomes[i] = BiomeId.LAKE;
    } else if (terrains[i] === TerrainId.DEEP_OCEAN) {
      biomes[i] = BiomeId.DEEP_OCEAN;
    } else if (terrains[i] === TerrainId.SHALLOW_WATER) {
      biomes[i] = BiomeId.SHALLOW_WATER;
    } else {
      biomes[i] = climateBiomes[i];
    }
  }

  const synced = syncShallowWater({
    width: outW,
    height: outH,
    terrains,
    biomes,
    elevation,
    features,
    customBiomes: sourceMap.customBiomes,
  });

  const mapCoord = (q: number, r: number) => ({
    q: Math.max(0, Math.min(outW - 1, Math.round((q - minQ) * scaleFactor))),
    r: Math.max(0, Math.min(outH - 1, Math.round((r - minR) * scaleFactor))),
  });
  const inBoundsSrc = (q: number, r: number) =>
    q >= minQ && q <= maxQ && r >= minR && r <= maxR;

  const cities = sourceMap.cities
    .filter((c) => inBoundsSrc(c.q, c.r))
    .map((c) => ({ ...c, ...mapCoord(c.q, c.r) }));

  const pois = sourceMap.pois
    .filter((p) => inBoundsSrc(p.q, p.r))
    .map((p) => ({ ...p, ...mapCoord(p.q, p.r) }));

  const labels = sourceMap.labels
    .filter((l) => inBoundsSrc(l.q, l.r))
    .map((l) => ({ ...l, ...mapCoord(l.q, l.r) }));

  const roads = sourceMap.roads
    .map((rd) => ({
      ...rd,
      hexes: rd.hexes
        .filter((h) => inBoundsSrc(h.q, h.r))
        .map((h) => mapCoord(h.q, h.r)),
    }))
    .filter((rd) => rd.hexes.length >= 2);

  const campaigns = (sourceMap.campaigns ?? [])
    .map((cp) => ({
      ...cp,
      points: cp.points
        .filter((h) => inBoundsSrc(h.q, h.r))
        .map((h) => mapCoord(h.q, h.r)),
      battles: (cp.battles ?? [])
        .filter((b) => inBoundsSrc(b.q, b.r))
        .map((b) => ({ ...b, ...mapCoord(b.q, b.r) })),
    }))
    .filter((cp) => cp.points.length >= 2);

  return {
    ...sourceMap,
    id: `submap_${Date.now().toString(36)}`,
    name: subMapName?.trim() || `${sourceMap.name} (ภูมิภาค ${scaleFactor}x)`,
    updatedAt: new Date().toISOString(),
    width: outW,
    height: outH,
    hexSizeKm: outHexKm,
    geography: subGeo,
    terrains: synced.terrains,
    biomes: synced.biomes,
    elevation: synced.elevation,
    temperature,
    moisture,
    features: synced.features,
    territories,
    religions,
    cultures,
    rivers: hydro.rivers,
    cities,
    pois,
    labels,
    roads,
    campaigns,
    tradeRoutes: [],
    bookmarks: [],
  };
}
