import {
  BiomeId,
  CustomBiome,
  HexCoord,
  HexMapData,
  RiverPath,
} from '../types/map';
import {
  getHexBrush,
  getNeighbors,
  getNeighborsWithEdge,
  hexIndex,
  inBounds,
  isWaterBiome,
} from './hexMath';
import { createNoise2D } from './noise';

export interface SyncShallowWaterOptions {
  changedHexes?: HexCoord[];
  preserveIndices?: Set<number>;
}

export interface SyncShallowWaterResult {
  biomes: number[];
  elevation: number[];
  features: string[];
  changedHexes: HexCoord[];
  changed: boolean;
}

const SHALLOW_ONLY_FEATURES = new Set(['coral_reef', 'lagoon', 'atoll']);

/** Return true if (q, r) is a land hex marked with the 'cliff' special feature. */
export function isCliffHex(
  map: Pick<HexMapData, 'width' | 'biomes' | 'customBiomes'> & {
    height?: number;
    features?: string[];
  },
  q: number,
  r: number
): boolean {
  if (q < 0 || q >= map.width || r < 0) return false;
  if (map.height !== undefined && r >= map.height) return false;
  const idx = hexIndex(q, r, map.width);
  if (idx < 0 || idx >= map.biomes.length) return false;
  if (isWaterBiome(map.biomes[idx], map.customBiomes)) return false;
  return map.features?.[idx] === 'cliff';
}

/**
 * Determine which hex edges (0..5) of a cliff hex represent steep escarpment drop-offs.
 * Shared edges between adjacent cliffs are omitted so cliff chains merge cleanly.
 */
export function getCliffEdges(
  map: Pick<HexMapData, 'width' | 'height' | 'biomes' | 'elevation' | 'customBiomes'> & {
    features?: string[];
  },
  q: number,
  r: number
): number[] {
  if (!inBounds(q, r, map.width, map.height) || !isCliffHex(map, q, r)) {
    return [];
  }

  const idx = hexIndex(q, r, map.width);
  const elev = map.elevation[idx] ?? 0;
  const neighbors = getNeighborsWithEdge(q, r, map.width, map.height);

  const dropEdges: number[] = [];
  const nonCliffInMapEdges: number[] = [];

  for (const nb of neighbors) {
    if (!nb.inMap) continue;
    if (isCliffHex(map, nb.q, nb.r)) continue;

    nonCliffInMapEdges.push(nb.edge);
    const nbIdx = hexIndex(nb.q, nb.r, map.width);
    const nbIsWater = isWaterBiome(map.biomes[nbIdx], map.customBiomes);
    const nbElev = map.elevation[nbIdx] ?? 0;

    if (nbIsWater || nbElev < elev - 0.06) {
      dropEdges.push(nb.edge);
    }
  }

  if (dropEdges.length > 0) {
    return dropEdges;
  }

  // Fallback for cliffs painted on flat uniform land: prefer south-facing edges (1, 2)
  const southEdges = nonCliffInMapEdges.filter((e) => e === 1 || e === 2);
  if (southEdges.length > 0) {
    return southEdges;
  }

  if (nonCliffInMapEdges.length > 0) {
    return nonCliffInMapEdges;
  }

  return [1, 2];
}

/**
 * Synchronize built-in ocean tiles (DEEP_OCEAN <-> SHALLOW_WATER) around coastlines:
 * - Water touching any cliff land hex becomes DEEP_OCEAN (sheer drop-off, no shallow shoals).
 * - Water touching non-cliff land (and no cliff) becomes SHALLOW_WATER.
 * - Open ocean touching no land becomes DEEP_OCEAN.
 * Custom water biomes (id >= 100) and land tiles are never overwritten.
 */
export function syncShallowWater(
  map: Pick<HexMapData, 'width' | 'height' | 'biomes' | 'elevation' | 'features' | 'customBiomes'>,
  options?: SyncShallowWaterOptions
): SyncShallowWaterResult {
  const { width, height, biomes, elevation, features, customBiomes } = map;
  const total = width * height;

  let candidateIndices: number[];
  if (options?.changedHexes && options.changedHexes.length > 0) {
    const seen = new Set<number>();
    candidateIndices = [];
    for (const h of options.changedHexes) {
      const brush = getHexBrush(h.q, h.r, 2, width, height);
      for (const cell of brush) {
        const idx = hexIndex(cell.q, cell.r, width);
        if (!seen.has(idx)) {
          seen.add(idx);
          candidateIndices.push(idx);
        }
      }
    }
  } else {
    candidateIndices = new Array<number>(total);
    for (let i = 0; i < total; i++) candidateIndices[i] = i;
  }

  let nextBiomes: number[] | null = null;
  let nextElevation: number[] | null = null;
  let nextFeatures: string[] | null = null;
  const updatedHexes: HexCoord[] = [];

  for (const idx of candidateIndices) {
    if (options?.preserveIndices?.has(idx)) continue;

    const curB = biomes[idx];
    if (curB !== BiomeId.DEEP_OCEAN && curB !== BiomeId.SHALLOW_WATER) continue;

    const q = idx % width;
    const r = (idx - q) / width;
    const nbs = getNeighbors(q, r, width, height);

    let touchesCliff = false;
    let touchesNonCliffLand = false;

    for (const nb of nbs) {
      const nbIdx = hexIndex(nb.q, nb.r, width);
      if (isWaterBiome(biomes[nbIdx], customBiomes)) continue;
      if (features?.[nbIdx] === 'cliff') {
        touchesCliff = true;
        break;
      }
      touchesNonCliffLand = true;
    }

    const targetBiome = touchesCliff
      ? BiomeId.DEEP_OCEAN
      : touchesNonCliffLand
      ? BiomeId.SHALLOW_WATER
      : BiomeId.DEEP_OCEAN;

    if (curB !== targetBiome) {
      if (!nextBiomes) nextBiomes = [...biomes];
      if (!nextElevation) nextElevation = [...elevation];
      if (!nextFeatures) nextFeatures = [...features];

      nextBiomes[idx] = targetBiome;
      const curElev = nextElevation[idx] ?? -0.5;
      if (targetBiome === BiomeId.DEEP_OCEAN) {
        nextElevation[idx] = curElev === -0.18 ? -0.65 : Math.min(curElev, -0.55);
        if (SHALLOW_ONLY_FEATURES.has(nextFeatures[idx])) {
          nextFeatures[idx] = '';
        }
      } else {
        nextElevation[idx] = Math.max(-0.22, Math.min(-0.08, curElev > -0.25 ? curElev : -0.18));
      }

      updatedHexes.push({ q, r });
    }
  }

  if (!nextBiomes) {
    return {
      biomes,
      elevation,
      features,
      changedHexes: [],
      changed: false,
    };
  }

  return {
    biomes: nextBiomes,
    elevation: nextElevation!,
    features: nextFeatures!,
    changedHexes: updatedHexes,
    changed: true,
  };
}

/**
 * Generate cohesive coastal cliffs and inland escarpments from elevation, terrain, and noise.
 * River mouths stay clear of sheer coastal cliffs so rivers/deltas meet the sea naturally.
 */
export function generateNaturalCliffs(
  width: number,
  height: number,
  biomes: number[],
  elevation: number[],
  features: string[],
  rivers: RiverPath[],
  seed: number,
  customBiomes?: CustomBiome[]
): { features: string[]; elevation: number[] } {
  const nextFeatures = [...features];
  const nextElevation = [...elevation];

  const mouthSet = new Set<number>();
  for (const rv of rivers) {
    for (let i = Math.max(0, rv.points.length - 2); i < rv.points.length; i++) {
      const pt = rv.points[i];
      if (inBounds(pt.q, pt.r, width, height)) {
        mouthSet.add(hexIndex(pt.q, pt.r, width));
      }
    }
  }

  const nCliff = createNoise2D(seed + 8821);

  for (let r = 1; r < height - 1; r++) {
    for (let q = 1; q < width - 1; q++) {
      const idx = hexIndex(q, r, width);
      const b = biomes[idx];
      if (isWaterBiome(b, customBiomes)) continue;
      if (nextFeatures[idx] !== '') continue;

      const e = nextElevation[idx] ?? 0;
      const nbs = getNeighbors(q, r, width, height);
      let touchesWater = false;
      let minLandNbElev = Infinity;

      for (const nb of nbs) {
        const nbIdx = hexIndex(nb.q, nb.r, width);
        if (isWaterBiome(biomes[nbIdx], customBiomes)) {
          touchesWater = true;
        } else {
          const ne = nextElevation[nbIdx] ?? 0;
          if (ne < minLandNbElev) minLandNbElev = ne;
        }
      }

      const cliffNoise = nCliff.fbm((q / Math.max(1, width)) * 6.5, (r / Math.max(1, height)) * 6.5, 3);

      if (touchesWater && !mouthSet.has(idx) && b !== BiomeId.SWAMP && b !== BiomeId.SNOW_ICE) {
        const highCoastal = e >= 0.40 || b === BiomeId.MOUNTAIN || b === BiomeId.SNOW_PEAK;
        const hillyCliff =
          (e >= 0.24 || b === BiomeId.HILLS || b === BiomeId.HIGHLAND) && cliffNoise > 0.14;
        if (highCoastal || hillyCliff) {
          nextFeatures[idx] = 'cliff';
          nextElevation[idx] = Math.max(e, 0.34);
        }
      } else if (
        !touchesWater &&
        (b === BiomeId.HIGHLAND || b === BiomeId.HILLS || b === BiomeId.MOUNTAIN)
      ) {
        if (Number.isFinite(minLandNbElev) && e - minLandNbElev >= 0.26 && cliffNoise > 0.22) {
          nextFeatures[idx] = 'cliff';
        }
      }
    }
  }

  return { features: nextFeatures, elevation: nextElevation };
}

/**
 * One-click action for user-edited maps: detect steep coastal land hexes (mountains, highlands,
 * steep hills/elevations) to mark as cliffs, then synchronize shallow water around all coastlines.
 */
export function autoDetectCliffsFromElevation(
  map: Pick<HexMapData, 'width' | 'height' | 'biomes' | 'elevation' | 'features' | 'customBiomes'>
): { features: string[]; elevation: number[]; biomes: number[]; changedHexes: HexCoord[] } {
  const { width, height, biomes, elevation, features, customBiomes } = map;
  const nextFeatures = [...features];
  const nextElevation = [...elevation];
  const cliffHexes: HexCoord[] = [];

  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const idx = hexIndex(q, r, width);
      const b = biomes[idx];
      if (isWaterBiome(b, customBiomes)) continue;
      if (nextFeatures[idx] !== '') continue;

      const touchesWater = getNeighbors(q, r, width, height).some((nb) =>
        isWaterBiome(biomes[hexIndex(nb.q, nb.r, width)], customBiomes)
      );
      if (!touchesWater) continue;

      const elev = nextElevation[idx] ?? 0;
      const isSteepCoast =
        b === BiomeId.MOUNTAIN ||
        b === BiomeId.SNOW_PEAK ||
        b === BiomeId.HIGHLAND ||
        (b === BiomeId.HILLS && elev >= 0.42) ||
        elev >= 0.42;

      if (isSteepCoast) {
        nextFeatures[idx] = 'cliff';
        nextElevation[idx] = Math.max(elev, 0.38);
        cliffHexes.push({ q, r });
      }
    }
  }

  const synced = syncShallowWater({
    width,
    height,
    biomes,
    elevation: nextElevation,
    features: nextFeatures,
    customBiomes,
  });

  return {
    biomes: synced.biomes,
    elevation: synced.elevation,
    features: synced.features,
    changedHexes: [...cliffHexes, ...synced.changedHexes],
  };
}
