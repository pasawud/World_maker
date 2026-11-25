import { getBiomeMetaWithCustom, LEGACY_TERRAIN_BIOME_IDS } from '../data/biomes';
import { getFeatureMeta } from '../data/features';
import { getTerrainMeta, isWaterTerrain } from '../data/terrains';
import {
  BiomeId,
  CustomBiome,
  HexCoord,
  HexMapData,
  RoadType,
  TerrainId,
  TradeMode,
} from '../types/map';

export const SQRT3 = Math.sqrt(3);

export interface CubeCoord {
  x: number;
  y: number;
  z: number;
}

/** Convert odd-r offset hex (pointy-top) to cube coordinates. */
export function offsetToCube(q: number, r: number): CubeCoord {
  const x = q - ((r - (r & 1)) >> 1);
  const z = r;
  const y = -x - z;
  return { x, y, z };
}

/** Convert cube coordinates to odd-r offset hex (pointy-top). */
export function cubeToOffset(cube: CubeCoord): HexCoord {
  const r = cube.z;
  const q = cube.x + ((r - (r & 1)) >> 1);
  return { q, r };
}

/** Exact grid distance in hex steps between two odd-r offset coordinates. */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const ac = offsetToCube(a.q, a.r);
  const bc = offsetToCube(b.q, b.r);
  return Math.max(
    Math.abs(ac.x - bc.x),
    Math.abs(ac.y - bc.y),
    Math.abs(ac.z - bc.z)
  );
}

/** Real-world distance in km between two hexes given hex center-to-center spacing (km). */
export function realDistanceKm(a: HexCoord, b: HexCoord, hexSizeKm: number): number {
  const pa = hexToPixel(a.q, a.r, 1);
  const pb = hexToPixel(b.q, b.r, 1);
  const dx = pa.x - pb.x;
  const dy = pa.y - pb.y;
  return (Math.hypot(dx, dy) / SQRT3) * hexSizeKm;
}

/** Pointy-top odd-r hex center in pixel coordinates for a given hex circumradius. */
export function hexToPixel(q: number, r: number, radius: number): { x: number; y: number } {
  const x = radius * SQRT3 * (q + 0.5 * (r & 1));
  const y = radius * 1.5 * r;
  return { x, y };
}

/** Pixel coordinates to nearest odd-r hex coordinate. */
export function pixelToHex(px: number, py: number, radius: number): HexCoord {
  const rApprox = py / (1.5 * radius);
  const qApprox = px / (SQRT3 * radius) - 0.5 * (Math.round(rApprox) & 1);
  const baseR = Math.round(rApprox);
  const baseQ = Math.round(qApprox);
  let bestQ = baseQ;
  let bestR = baseR;
  let bestDist2 = Infinity;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dq = -1; dq <= 1; dq++) {
      const cq = baseQ + dq;
      const cr = baseR + dr;
      const c = hexToPixel(cq, cr, radius);
      const d2 = (c.x - px) * (c.x - px) + (c.y - py) * (c.y - py);
      if (d2 < bestDist2) {
        bestDist2 = d2;
        bestQ = cq;
        bestR = cr;
      }
    }
  }
  return { q: bestQ, r: bestR };
}

export function inBounds(q: number, r: number, width: number, height: number): boolean {
  return q >= 0 && q < width && r >= 0 && r < height;
}

export function hexIndex(q: number, r: number, width: number): number {
  return r * width + q;
}

const EVEN_ROW_DIRS: readonly [number, number][] = [
  [+1, 0],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, +1],
  [0, +1],
];

const ODD_ROW_DIRS: readonly [number, number][] = [
  [+1, 0],
  [+1, -1],
  [0, -1],
  [-1, 0],
  [0, +1],
  [+1, +1],
];

/** Returns valid neighbor coordinates in odd-r offset layout. */
export function getNeighbors(q: number, r: number, width: number, height: number): HexCoord[] {
  const dirs = (r & 1) === 1 ? ODD_ROW_DIRS : EVEN_ROW_DIRS;
  const out: HexCoord[] = [];
  for (let i = 0; i < dirs.length; i++) {
    const nq = q + dirs[i][0];
    const nr = r + dirs[i][1];
    if (nq >= 0 && nq < width && nr >= 0 && nr < height) {
      out.push({ q: nq, r: nr });
    }
  }
  return out;
}

/** Returns neighbor coordinates paired with their shared hex-edge index (0..5) for border drawing. */
export function getNeighborsWithEdge(
  q: number,
  r: number,
  width: number,
  height: number
): { q: number; r: number; edge: number; inMap: boolean }[] {
  // Edges correspond to vertices around pointy-top hex (angle 60*i - 30):
  // edge 0: 330..30 (E: +1,0)
  // edge 1: 30..90 (SE: odd +1,+1 / even 0,+1)
  // edge 2: 90..150 (SW: odd 0,+1 / even -1,+1)
  // edge 3: 150..210 (W: -1,0)
  // edge 4: 210..270 (NW: odd 0,-1 / even -1,-1)
  // edge 5: 270..330 (NE: odd +1,-1 / even 0,-1)
  const dirs: readonly [number, number][] =
    (r & 1) === 1
      ? [
          [+1, 0],
          [+1, +1],
          [0, +1],
          [-1, 0],
          [0, -1],
          [+1, -1],
        ]
      : [
          [+1, 0],
          [0, +1],
          [-1, +1],
          [-1, 0],
          [-1, -1],
          [0, -1],
        ];
  const out: { q: number; r: number; edge: number; inMap: boolean }[] = [];
  for (let edge = 0; edge < 6; edge++) {
    const nq = q + dirs[edge][0];
    const nr = r + dirs[edge][1];
    out.push({
      q: nq,
      r: nr,
      edge,
      inMap: nq >= 0 && nq < width && nr >= 0 && nr < height,
    });
  }
  return out;
}

/** Returns all hexes within brush radius (0 = single hex, 1 = 7 hexes, etc.). */
export function getHexBrush(
  cq: number,
  cr: number,
  radius: number,
  width: number,
  height: number
): HexCoord[] {
  if (radius <= 0) {
    return inBounds(cq, cr, width, height) ? [{ q: cq, r: cr }] : [];
  }
  const centerCube = offsetToCube(cq, cr);
  const out: HexCoord[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    const minDy = Math.max(-radius, -dx - radius);
    const maxDy = Math.min(radius, -dx + radius);
    for (let dy = minDy; dy <= maxDy; dy++) {
      const dz = -dx - dy;
      const off = cubeToOffset({
        x: centerCube.x + dx,
        y: centerCube.y + dy,
        z: centerCube.z + dz,
      });
      if (inBounds(off.q, off.r, width, height)) {
        out.push(off);
      }
    }
  }
  return out;
}

/** BFS flood-fill over matching value cells (biomes, territories, religions, etc.). */
export function floodFillHexes<T extends number | string>(
  values: ArrayLike<T>,
  width: number,
  height: number,
  startQ: number,
  startR: number,
  maxCells = 12000,
  canTraverse?: (idx: number) => boolean
): HexCoord[] {
  if (!inBounds(startQ, startR, width, height)) return [];
  const startIdx = hexIndex(startQ, startR, width);
  if (canTraverse && !canTraverse(startIdx)) return [];
  const targetVal = values[startIdx];
  const visited = new Uint8Array(width * height);
  const queue: HexCoord[] = [{ q: startQ, r: startR }];
  visited[startIdx] = 1;
  const result: HexCoord[] = [];

  let head = 0;
  while (head < queue.length && result.length < maxCells) {
    const cur = queue[head++];
    result.push(cur);
    const neighbors = getNeighbors(cur.q, cur.r, width, height);
    for (const nb of neighbors) {
      const idx = hexIndex(nb.q, nb.r, width);
      if (!visited[idx] && values[idx] === targetVal && (!canTraverse || canTraverse(idx))) {
        visited[idx] = 1;
        queue.push(nb);
      }
    }
  }
  return result;
}

export function isWaterBiome(biomeId: number, customBiomes?: CustomBiome[]): boolean {
  return getBiomeMetaWithCustom(biomeId, customBiomes).isWater;
}

export function getHexTerrain(
  map: { biomes: number[]; customBiomes?: CustomBiome[]; terrains?: number[] },
  idx: number
): TerrainId {
  const b = map.biomes[idx];
  if (b === BiomeId.DEEP_OCEAN) return TerrainId.DEEP_OCEAN;
  if (b === BiomeId.SHALLOW_WATER) return TerrainId.SHALLOW_WATER;
  if (b === BiomeId.LAKE) return TerrainId.LAKE;
  if (isWaterBiome(b, map.customBiomes)) {
    return map.terrains?.[idx] === TerrainId.DEEP_OCEAN
      ? TerrainId.DEEP_OCEAN
      : TerrainId.SHALLOW_WATER;
  }
  if (b === BiomeId.SNOW_PEAK) return TerrainId.HIGH_PEAK;
  if (b === BiomeId.MOUNTAIN) return TerrainId.MOUNTAIN;
  if (b === BiomeId.HIGHLAND) return TerrainId.HIGHLAND;
  if (b === BiomeId.HILLS) return TerrainId.HILLS;

  const t = map.terrains?.[idx];
  if (t !== undefined && t >= TerrainId.PLAINS && t <= TerrainId.LAKE) {
    return t as TerrainId;
  }
  return TerrainId.PLAINS;
}

export function getCombinedMoveCost(
  terrainId: TerrainId,
  biomeId: number,
  customBiomes?: CustomBiome[]
): number {
  const biomeMeta = getBiomeMetaWithCustom(biomeId, customBiomes);
  if (isWaterTerrain(terrainId) || biomeMeta.isWater) return Infinity;

  let terrainCost = getTerrainMeta(terrainId).moveCost;
  if (terrainId === TerrainId.HIGH_PEAK) terrainCost = Math.max(terrainCost, 48);
  else if (terrainId === TerrainId.MOUNTAIN) terrainCost = Math.max(terrainCost, 18);

  const biomeDelta = LEGACY_TERRAIN_BIOME_IDS.has(biomeId)
    ? 0
    : Math.max(0, biomeMeta.moveCost - 1.0);
  return terrainCost + biomeDelta;
}

export function isWaterHex(
  map: Pick<HexMapData, 'width' | 'biomes' | 'customBiomes'>,
  q: number,
  r: number
): boolean {
  return isWaterBiome(map.biomes[hexIndex(q, r, map.width)], map.customBiomes);
}

export function isCoastalHex(
  map: Pick<HexMapData, 'width' | 'height' | 'biomes' | 'customBiomes'>,
  q: number,
  r: number
): boolean {
  if (isWaterHex(map, q, r)) return false;
  return getNeighbors(q, r, map.width, map.height).some((nb) => isWaterHex(map, nb.q, nb.r));
}

/** Return true if (q, r) is a coastal land hex without sheer cliffs (ships can dock/embark here). */
export function isLandingCoastHex(
  map: Pick<HexMapData, 'width' | 'height' | 'biomes' | 'customBiomes'> & { features?: string[] },
  q: number,
  r: number
): boolean {
  if (!isCoastalHex(map, q, r)) return false;
  return map.features?.[hexIndex(q, r, map.width)] !== 'cliff';
}

/** Validate whether a hex can be placed/traversed for a given road type. */
export function validateRoadStep(
  map: Pick<HexMapData, 'width' | 'height' | 'biomes' | 'customBiomes'> & { features?: string[] },
  hex: HexCoord,
  roadType: RoadType,
  isEndpoint: boolean
): boolean {
  if (!inBounds(hex.q, hex.r, map.width, map.height)) return false;
  const water = isWaterHex(map, hex.q, hex.r);
  if (roadType === 'sea') {
    if (water) return true;
    return isEndpoint && isLandingCoastHex(map, hex.q, hex.r);
  }
  return !water;
}

export interface RealDimensions {
  widthKm: number;
  heightKm: number;
  hexAreaKm2: number;
  totalAreaKm2: number;
  totalHexes: number;
}

/** Compute real-world width, height, and area from hex counts and hex spacing (km). */
export function computeRealDimensions(
  width: number,
  height: number,
  hexSizeKm: number
): RealDimensions {
  const widthKm = width * hexSizeKm;
  const heightKm = height * hexSizeKm * (SQRT3 / 2);
  const hexAreaKm2 = (SQRT3 / 2) * hexSizeKm * hexSizeKm;
  const totalHexes = width * height;
  const totalAreaKm2 = totalHexes * hexAreaKm2;
  return { widthKm, heightKm, hexAreaKm2, totalAreaKm2, totalHexes };
}

export interface PathResult {
  hexes: HexCoord[];
  distanceKm: number;
  weightedCost: number;
  reachable: boolean;
}

/**
 * A* shortest path across the hex grid accounting for terrain, elevation slope,
 * special features, existing roads, and strict land/sea separation.
 */
export function findHexPath(
  map: HexMapData,
  start: HexCoord,
  goal: HexCoord,
  mode: TradeMode
): PathResult {
  const { width, height, hexSizeKm, biomes, roads, elevation, features, customBiomes } = map;
  if (!inBounds(start.q, start.r, width, height) || !inBounds(goal.q, goal.r, width, height)) {
    return { hexes: [], distanceKm: 0, weightedCost: Infinity, reachable: false };
  }

  const startWater = isWaterHex(map, start.q, start.r);
  const goalWater = isWaterHex(map, goal.q, goal.r);

  if (mode === 'sea') {
    const startOk = startWater || isLandingCoastHex(map, start.q, start.r);
    const goalOk = goalWater || isLandingCoastHex(map, goal.q, goal.r);
    if (!startOk || !goalOk) {
      return { hexes: [], distanceKm: 0, weightedCost: Infinity, reachable: false };
    }
  } else if (mode === 'land') {
    if (startWater || goalWater) {
      return { hexes: [], distanceKm: 0, weightedCost: Infinity, reachable: false };
    }
  }

  if (start.q === goal.q && start.r === goal.r) {
    return { hexes: [start], distanceKm: 0, weightedCost: 0, reachable: true };
  }

  // Build quick road bonus lookup (only land roads give land bonus)
  const roadBonus = new Uint8Array(width * height);
  for (const road of roads) {
    if (road.type === 'sea') continue;
    for (const h of road.hexes) {
      if (inBounds(h.q, h.r, width, height)) {
        const idx = hexIndex(h.q, h.r, width);
        roadBonus[idx] = Math.max(roadBonus[idx], road.type === 'stone' ? 2 : 1);
      }
    }
  }

  const total = width * height;
  const startIdx = hexIndex(start.q, start.r, width);
  const goalIdx = hexIndex(goal.q, goal.r, width);

  const gScore = new Float64Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  gScore[startIdx] = 0;

  const heapF: number[] = [];
  const heapI: number[] = [];
  const push = (f: number, idx: number) => {
    heapF.push(f);
    heapI.push(idx);
    let i = heapF.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapF[p] <= heapF[i]) break;
      [heapF[p], heapF[i]] = [heapF[i], heapF[p]];
      [heapI[p], heapI[i]] = [heapI[i], heapI[p]];
      i = p;
    }
  };
  const pop = (): number => {
    const top = heapI[0];
    const lastF = heapF.pop()!;
    const lastI = heapI.pop()!;
    if (heapF.length > 0) {
      heapF[0] = lastF;
      heapI[0] = lastI;
      let i = 0;
      const n = heapF.length;
      while (true) {
        let best = i;
        const l = i * 2 + 1;
        const r = i * 2 + 2;
        if (l < n && heapF[l] < heapF[best]) best = l;
        if (r < n && heapF[r] < heapF[best]) best = r;
        if (best === i) break;
        [heapF[i], heapF[best]] = [heapF[best], heapF[i]];
        [heapI[i], heapI[best]] = [heapI[best], heapI[i]];
        i = best;
      }
    }
    return top;
  };

  const landCostForCell = (curIdx: number, nbIdx: number): number => {
    const b = biomes[nbIdx];
    const terrain = getHexTerrain(map, nbIdx);
    let base = getCombinedMoveCost(terrain, b, customBiomes);
    if (!Number.isFinite(base)) return Infinity;

    const feat = features?.[nbIdx] ? getFeatureMeta(features[nbIdx]) : null;
    if (feat) base = Math.max(0.6, base + feat.moveCostDelta);

    const cliffEscarpmentPenalty =
      features?.[nbIdx] === 'cliff' || features?.[curIdx] === 'cliff' ? 6 : 0;

    const elevCur = elevation[curIdx] ?? 0;
    const elevNb = elevation[nbIdx] ?? 0;
    const slopePenalty = Math.abs(elevNb - elevCur) * 14 + cliffEscarpmentPenalty;

    if (roadBonus[nbIdx] === 2) return Math.max(0.45, (base + slopePenalty * 0.4) * 0.45);
    if (roadBonus[nbIdx] === 1) return Math.max(0.6, (base + slopePenalty * 0.6) * 0.65);
    return base + slopePenalty;
  };

  const stepCost = (curIdx: number, nbIdx: number, isEndpoint: boolean): number => {
    const b = biomes[nbIdx];
    const terrain = getHexTerrain(map, nbIdx);
    const meta = getBiomeMetaWithCustom(b, customBiomes);
    const isWater = meta.isWater || isWaterTerrain(terrain);

    if (mode === 'sea') {
      // Strictly water-only between ports/coastal endpoints!
      if (!isWater) {
        return isEndpoint ? 1.4 : Infinity;
      }
      const feat = features?.[nbIdx] ? getFeatureMeta(features[nbIdx]) : null;
      const featDelta = feat ? feat.moveCostDelta : 0;
      const baseWater =
        terrain === TerrainId.LAKE ? 0.72 : terrain === TerrainId.SHALLOW_WATER ? 0.75 : 0.9;
      return baseWater + Math.max(0, featDelta);
    }

    if (mode === 'land') {
      return landCostForCell(curIdx, nbIdx);
    }

    // mixed mode
    if (isWater) {
      return terrain === TerrainId.LAKE ? 0.72 : terrain === TerrainId.SHALLOW_WATER ? 0.8 : 0.95;
    }
    return landCostForCell(curIdx, nbIdx);
  };

  push(hexDistance(start, goal) * 0.7, startIdx);

  let iterations = 0;
  const maxIter = Math.min(total * 4, 220000);

  while (heapF.length > 0 && iterations++ < maxIter) {
    const curIdx = pop();
    if (curIdx === goalIdx) {
      const hexes: HexCoord[] = [];
      let trace = goalIdx;
      while (trace !== -1) {
        const q = trace % width;
        const r = (trace - q) / width;
        hexes.push({ q, r });
        trace = cameFrom[trace];
      }
      hexes.reverse();
      const distanceKm = Math.max(0, (hexes.length - 1) * hexSizeKm);
      return {
        hexes,
        distanceKm,
        weightedCost: gScore[goalIdx],
        reachable: true,
      };
    }

    if (closed[curIdx]) continue;
    closed[curIdx] = 1;

    const cq = curIdx % width;
    const cr = (curIdx - cq) / width;
    const neighbors = getNeighbors(cq, cr, width, height);

    for (const nb of neighbors) {
      const nbIdx = hexIndex(nb.q, nb.r, width);
      if (closed[nbIdx]) continue;
      const cost = stepCost(curIdx, nbIdx, nbIdx === goalIdx);
      if (!Number.isFinite(cost)) continue;

      let transitionPenalty = 0;
      if (mode === 'mixed') {
        const curWater = isWaterBiome(biomes[curIdx], customBiomes);
        const nbWater = isWaterBiome(biomes[nbIdx], customBiomes);
        if (curWater !== nbWater) {
          const landIdx = curWater ? nbIdx : curIdx;
          transitionPenalty = features?.[landIdx] === 'cliff' ? 28 : 3.5;
        }
      }

      const tentative = gScore[curIdx] + cost + transitionPenalty;
      if (tentative < gScore[nbIdx]) {
        cameFrom[nbIdx] = curIdx;
        gScore[nbIdx] = tentative;
        const h = hexDistance(nb, goal) * 0.7;
        push(tentative + h, nbIdx);
      }
    }
  }

  return { hexes: [], distanceKm: 0, weightedCost: Infinity, reachable: false };
}
