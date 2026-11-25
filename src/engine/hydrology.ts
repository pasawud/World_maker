import { getTerrainMeta } from '../data/terrains';
import { BiomeId, HexMapData, RiverPath, RiverPoint } from '../types/map';
import { getHexTerrain, getNeighbors, hexIndex } from './hexMath';

/** Binary MinHeap for Priority-Flood depression filling (O(N log N)). */
class MinHeap {
  private keys: Float64Array;
  private vals: Int32Array;
  public size = 0;

  constructor(capacity: number) {
    this.keys = new Float64Array(capacity);
    this.vals = new Int32Array(capacity);
  }

  push(key: number, val: number): void {
    let i = this.size++;
    this.keys[i] = key;
    this.vals[i] = val;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      const tk = this.keys[p];
      const tv = this.vals[p];
      this.keys[p] = this.keys[i];
      this.vals[p] = this.vals[i];
      this.keys[i] = tk;
      this.vals[i] = tv;
      i = p;
    }
  }

  pop(): { key: number; val: number } {
    const key = this.keys[0];
    const val = this.vals[0];
    const n = --this.size;
    if (n > 0) {
      this.keys[0] = this.keys[n];
      this.vals[0] = this.vals[n];
      let i = 0;
      while (true) {
        let best = i;
        const l = i * 2 + 1;
        const r = i * 2 + 2;
        if (l < n && this.keys[l] < this.keys[best]) best = l;
        if (r < n && this.keys[r] < this.keys[best]) best = r;
        if (best === i) break;
        const tk = this.keys[i];
        const tv = this.vals[i];
        this.keys[i] = this.keys[best];
        this.vals[i] = this.vals[best];
        this.keys[best] = tk;
        this.vals[best] = tv;
        i = best;
      }
    }
    return { key, val };
  }
}

/**
 * Synthesize a downhill-sloping continuous elevation field from painted biomes
 * so manual maps still produce realistic rivers flowing toward coastlines.
 */
export function deriveElevationFromBiomes(
  biomes: number[],
  width: number,
  height: number,
  terrains?: number[]
): Float64Array {
  const total = width * height;
  const distFromOcean = new Int32Array(total).fill(-1);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  for (let i = 0; i < total; i++) {
    const b = biomes[i];
    if (b === BiomeId.DEEP_OCEAN || b === BiomeId.SHALLOW_WATER) {
      distFromOcean[i] = 0;
      queue[tail++] = i;
    }
  }

  // Fallback if land-only map has zero ocean cells: treat map borders as sea outlets
  if (tail === 0) {
    for (let r = 0; r < height; r++) {
      for (let q = 0; q < width; q++) {
        if (q === 0 || q === width - 1 || r === 0 || r === height - 1) {
          const idx = hexIndex(q, r, width);
          distFromOcean[idx] = 1;
          queue[tail++] = idx;
        }
      }
    }
  }

  while (head < tail) {
    const idx = queue[head++];
    const q = idx % width;
    const r = (idx - q) / width;
    const d = distFromOcean[idx];
    const neighbors = getNeighbors(q, r, width, height);
    for (const nb of neighbors) {
      const nbIdx = hexIndex(nb.q, nb.r, width);
      if (distFromOcean[nbIdx] === -1) {
        distFromOcean[nbIdx] = d + 1;
        queue[tail++] = nbIdx;
      }
    }
  }

  const elev = new Float64Array(total);
  for (let i = 0; i < total; i++) {
    const tId = getHexTerrain({ biomes, terrains, customBiomes: [] }, i);
    const meta = getTerrainMeta(tId);
    if (meta.isWater) {
      elev[i] = meta.defaultElevation;
    } else {
      const d = Math.max(1, distFromOcean[i]);
      const coastalSlope = Math.min(0.28, d * 0.015);
      // Slight deterministic micro-jitter breaks perfectly flat ties cleanly
      const q = i % width;
      const r = (i - q) / width;
      const jitter = (((q * 73856093) ^ (r * 19349663)) & 255) * 1e-5;
      elev[i] = meta.defaultElevation * 0.72 + coastalSlope + jitter;
    }
  }
  return elev;
}

/**
 * Priority-Flood algorithm (Barnes et al.): fills all inland depressions with a tiny
 * strictly-increasing epsilon gradient so every land hex drains monotonically to ocean/border.
 */
export function priorityFloodFill(
  elevation: ArrayLike<number>,
  width: number,
  height: number,
  isWaterMask?: Uint8Array
): Float64Array {
  const total = width * height;
  const filled = new Float64Array(total);
  for (let i = 0; i < total; i++) filled[i] = elevation[i];

  const visited = new Uint8Array(total);
  const heap = new MinHeap(total);

  // Seed priority queue with ocean cells and map border cells
  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const idx = hexIndex(q, r, width);
      const isBorder = q === 0 || q === width - 1 || r === 0 || r === height - 1;
      const isWater = isWaterMask ? isWaterMask[idx] === 1 : elevation[idx] <= 0;
      if (isWater || isBorder) {
        visited[idx] = 1;
        heap.push(filled[idx], idx);
      }
    }
  }

  const EPS = 1e-5;
  while (heap.size > 0) {
    const { key: curElev, val: idx } = heap.pop();
    const q = idx % width;
    const r = (idx - q) / width;
    const neighbors = getNeighbors(q, r, width, height);

    for (const nb of neighbors) {
      const nbIdx = hexIndex(nb.q, nb.r, width);
      if (visited[nbIdx]) continue;
      visited[nbIdx] = 1;
      if (filled[nbIdx] <= curElev) {
        filled[nbIdx] = curElev + EPS;
      }
      heap.push(filled[nbIdx], nbIdx);
    }
  }

  return filled;
}

export interface AutoHydrologyResult {
  rivers: RiverPath[];
  riverMoistureBonus: Float32Array;
  flux: Float32Array;
}

/**
 * Generates geographically plausible rivers via Priority-Flood drainage routing,
 * precipitation-weighted flow accumulation, and tributary tracing.
 */
export function generateRiversAuto(
  map: Pick<HexMapData, 'width' | 'height' | 'biomes' | 'elevation' | 'moisture' | 'geography'> & {
    terrains?: number[];
  },
  options?: { threshold?: number; useCurrentBiomes?: boolean }
): AutoHydrologyResult {
  const { width, height, biomes, moisture, geography } = map;
  const total = width * height;
  const threshold = options?.threshold ?? geography.riverThreshold ?? 22;

  const isWater = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const b = biomes[i];
    if (b === BiomeId.DEEP_OCEAN || b === BiomeId.SHALLOW_WATER) {
      isWater[i] = 1;
    }
  }

  const baseElev = options?.useCurrentBiomes
    ? deriveElevationFromBiomes(biomes, width, height, map.terrains)
    : Float64Array.from(map.elevation);

  const filled = priorityFloodFill(baseElev, width, height, isWater);

  // Determine steepest downhill neighbor for every land hex
  const flowTo = new Int32Array(total).fill(-1);
  const landIndices: number[] = [];

  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const idx = hexIndex(q, r, width);
      if (isWater[idx]) continue;
      landIndices.push(idx);
      const neighbors = getNeighbors(q, r, width, height);
      let bestNb = -1;
      let bestElev = filled[idx];
      for (const nb of neighbors) {
        const nbIdx = hexIndex(nb.q, nb.r, width);
        if (filled[nbIdx] < bestElev) {
          bestElev = filled[nbIdx];
          bestNb = nbIdx;
        }
      }
      flowTo[idx] = bestNb;
    }
  }

  // Sort land hexes from highest to lowest filled elevation to accumulate upstream flux in one pass
  landIndices.sort((a, b) => filled[b] - filled[a]);

  const flux = new Float32Array(total);
  for (const idx of landIndices) {
    // Mountains & wet regions generate stronger runoff
    const m = moisture[idx] ?? 0.45;
    const e = Math.max(0, baseElev[idx]);
    const precip = 0.4 + m * 1.4 + (e > 0.45 ? 0.55 : 0);
    flux[idx] += precip;
    const target = flowTo[idx];
    if (target !== -1) {
      flux[target] += flux[idx];
    }
  }

  // Identify river cells above flux threshold
  const isRiverCell = new Uint8Array(total);
  for (const idx of landIndices) {
    if (flux[idx] >= threshold) {
      isRiverCell[idx] = 1;
    }
  }

  // Count upstream river tributaries entering each river cell to find clean headwaters
  const inDegree = new Uint8Array(total);
  for (const idx of landIndices) {
    if (!isRiverCell[idx]) continue;
    const target = flowTo[idx];
    if (target !== -1 && isRiverCell[target]) {
      inDegree[target]++;
    }
  }

  // Trace river polylines from headwaters (or highest-flux sources) downstream
  const traced = new Uint8Array(total);
  const rivers: RiverPath[] = [];

  // Process main stems first (highest downstream flux) or headwaters sorted by terminal flux
  const headwaters = landIndices.filter((idx) => isRiverCell[idx] && inDegree[idx] === 0);
  // Sort headwaters by elevation descending so long main stems trace cleanly first
  headwaters.sort((a, b) => filled[b] - filled[a]);

  let riverCounter = 1;
  for (const startIdx of headwaters) {
    const points: RiverPoint[] = [];
    let cur = startIdx;
    const guard = new Set<number>();

    while (cur !== -1 && !guard.has(cur)) {
      guard.add(cur);
      const q = cur % width;
      const r = (cur - q) / width;
      points.push({ q, r, flux: Number(flux[cur].toFixed(1)) });

      if (isWater[cur]) break;
      if (traced[cur] && points.length > 1) {
        // Joined an already-traced main stem cleanly
        break;
      }
      traced[cur] = 1;
      cur = flowTo[cur];
    }

    if (points.length >= 3) {
      rivers.push({
        id: `river_auto_${riverCounter++}`,
        source: 'auto',
        points,
      });
    }
  }

  // Compute riparian moisture bonus around river cells (radius 2)
  const riverMoistureBonus = new Float32Array(total);
  for (const river of rivers) {
    for (const pt of river.points) {
      const idx = hexIndex(pt.q, pt.r, width);
      if (isWater[idx]) continue;
      riverMoistureBonus[idx] = Math.max(riverMoistureBonus[idx], 0.35);
      for (const n1 of getNeighbors(pt.q, pt.r, width, height)) {
        const i1 = hexIndex(n1.q, n1.r, width);
        if (!isWater[i1]) {
          riverMoistureBonus[i1] = Math.max(riverMoistureBonus[i1], 0.22);
        }
        for (const n2 of getNeighbors(n1.q, n1.r, width, height)) {
          const i2 = hexIndex(n2.q, n2.r, width);
          if (!isWater[i2]) {
            riverMoistureBonus[i2] = Math.max(riverMoistureBonus[i2], 0.1);
          }
        }
      }
    }
  }

  return { rivers, riverMoistureBonus, flux };
}
