import { getBiomeMetaWithCustom } from '../data/biomes';
import { getFeatureMeta } from '../data/features';
import { BiomeId, CityTier, HexMapData } from '../types/map';
import { getNeighbors, hexIndex, isWaterBiome } from './hexMath';

function tierMaxRadiusCost(tier: CityTier, pop: number): number {
  const popBonus = Math.min(18, Math.sqrt(Math.max(1000, pop)) * 0.045);
  switch (tier) {
    case 'capital':
      return 34 + popBonus;
    case 'city':
      return 25 + popBonus;
    case 'port':
      return 21 + popBonus;
    case 'town':
      return 16 + popBonus * 0.7;
    case 'village':
    default:
      return 11 + popBonus * 0.4;
  }
}

/**
 * Multi-source Dijkstra expansion from cities across land hexes.
 * Mountains, snow peaks, cliffs, and oceans naturally shape political borders.
 */
export function generateTerritoriesFromCities(
  map: Pick<
    HexMapData,
    'width' | 'height' | 'biomes' | 'customBiomes' | 'features' | 'cities' | 'roads'
  >
): string[] {
  const { width, height, biomes, customBiomes, features, cities, roads } = map;
  const total = width * height;
  const result = new Array<string>(total).fill('');
  if (cities.length === 0) return result;

  // Road bonus makes territories stretch smoothly along highways
  const roadDiscount = new Uint8Array(total);
  for (const rd of roads) {
    if (rd.type === 'sea') continue;
    for (const h of rd.hexes) {
      if (h.q >= 0 && h.q < width && h.r >= 0 && h.r < height) {
        roadDiscount[hexIndex(h.q, h.r, width)] = 1;
      }
    }
  }

  const bestCost = new Float64Array(total).fill(Infinity);
  const maxReach = new Float64Array(total).fill(0);

  const heapCost: number[] = [];
  const heapIdx: number[] = [];
  const push = (c: number, idx: number) => {
    heapCost.push(c);
    heapIdx.push(idx);
    let i = heapCost.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapCost[p] <= heapCost[i]) break;
      [heapCost[p], heapCost[i]] = [heapCost[i], heapCost[p]];
      [heapIdx[p], heapIdx[i]] = [heapIdx[i], heapIdx[p]];
      i = p;
    }
  };
  const pop = (): { cost: number; idx: number } => {
    const cost = heapCost[0];
    const idx = heapIdx[0];
    const lc = heapCost.pop()!;
    const li = heapIdx.pop()!;
    if (heapCost.length > 0) {
      heapCost[0] = lc;
      heapIdx[0] = li;
      let i = 0;
      const n = heapCost.length;
      while (true) {
        let best = i;
        const l = i * 2 + 1;
        const r = i * 2 + 2;
        if (l < n && heapCost[l] < heapCost[best]) best = l;
        if (r < n && heapCost[r] < heapCost[best]) best = r;
        if (best === i) break;
        [heapCost[i], heapCost[best]] = [heapCost[best], heapCost[i]];
        [heapIdx[i], heapIdx[best]] = [heapIdx[best], heapIdx[i]];
        i = best;
      }
    }
    return { cost, idx };
  };

  for (const city of cities) {
    if (!city.kingdomId) continue;
    const idx = hexIndex(city.q, city.r, width);
    if (idx < 0 || idx >= total) continue;
    if (isWaterBiome(biomes[idx], customBiomes)) continue;
    bestCost[idx] = 0;
    result[idx] = city.kingdomId;
    maxReach[idx] = tierMaxRadiusCost(city.tier, city.population);
    push(0, idx);
  }

  while (heapCost.length > 0) {
    const { cost, idx } = pop();
    if (cost > bestCost[idx]) continue;
    const owner = result[idx];
    const reachLimit = maxReach[idx];
    const q = idx % width;
    const r = (idx - q) / width;

    for (const nb of getNeighbors(q, r, width, height)) {
      const nbIdx = hexIndex(nb.q, nb.r, width);
      const b = biomes[nbIdx];
      const meta = getBiomeMetaWithCustom(b, customBiomes);
      if (meta.isWater) continue;

      let step = 1.0;
      if (b === BiomeId.SNOW_PEAK) step = 8.5;
      else if (b === BiomeId.MOUNTAIN) step = 4.8;
      else if (b === BiomeId.HILLS || b === BiomeId.HIGHLAND) step = 1.7;
      else if (b === BiomeId.DESERT || b === BiomeId.SWAMP) step = 1.8;
      else step = Math.min(2.2, meta.moveCost);

      const feat = features?.[nbIdx] ? getFeatureMeta(features[nbIdx]) : null;
      if (feat?.id === 'cliff') step += 4.2;
      else if (feat?.id === 'canyon') step += 2.8;
      if (roadDiscount[nbIdx]) step *= 0.72;

      const nextCost = cost + step;
      if (nextCost > reachLimit) continue;
      if (nextCost < bestCost[nbIdx]) {
        bestCost[nbIdx] = nextCost;
        result[nbIdx] = owner;
        maxReach[nbIdx] = reachLimit;
        push(nextCost, nbIdx);
      }
    }
  }

  return result;
}

/**
 * Multi-source Dijkstra spread of religions from cities & settlements.
 * Religions can cross coastal straits more easily than political borders when sea lanes/ports exist.
 */
export function generateReligionsFromCities(
  map: Pick<
    HexMapData,
    'width' | 'height' | 'biomes' | 'customBiomes' | 'cities' | 'roads'
  >
): string[] {
  const { width, height, biomes, customBiomes, cities, roads } = map;
  const total = width * height;
  const result = new Array<string>(total).fill('');
  if (cities.length === 0) return result;

  const roadBonus = new Uint8Array(total);
  for (const rd of roads) {
    for (const h of rd.hexes) {
      if (h.q >= 0 && h.q < width && h.r >= 0 && h.r < height) {
        roadBonus[hexIndex(h.q, h.r, width)] = 1;
      }
    }
  }

  const bestCost = new Float64Array(total).fill(Infinity);
  const maxReach = new Float64Array(total).fill(0);

  const heapCost: number[] = [];
  const heapIdx: number[] = [];
  const push = (c: number, idx: number) => {
    heapCost.push(c);
    heapIdx.push(idx);
    let i = heapCost.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapCost[p] <= heapCost[i]) break;
      [heapCost[p], heapCost[i]] = [heapCost[i], heapCost[p]];
      [heapIdx[p], heapIdx[i]] = [heapIdx[i], heapIdx[p]];
      i = p;
    }
  };
  const pop = (): { cost: number; idx: number } => {
    const cost = heapCost[0];
    const idx = heapIdx[0];
    const lc = heapCost.pop()!;
    const li = heapIdx.pop()!;
    if (heapCost.length > 0) {
      heapCost[0] = lc;
      heapIdx[0] = li;
      let i = 0;
      const n = heapCost.length;
      while (true) {
        let best = i;
        const l = i * 2 + 1;
        const r = i * 2 + 2;
        if (l < n && heapCost[l] < heapCost[best]) best = l;
        if (r < n && heapCost[r] < heapCost[best]) best = r;
        if (best === i) break;
        [heapCost[i], heapCost[best]] = [heapCost[best], heapCost[i]];
        [heapIdx[i], heapIdx[best]] = [heapIdx[best], heapIdx[i]];
        i = best;
      }
    }
    return { cost, idx };
  };

  for (const city of cities) {
    if (!city.religionId) continue;
    const idx = hexIndex(city.q, city.r, width);
    if (idx < 0 || idx >= total) continue;
    if (isWaterBiome(biomes[idx], customBiomes)) continue;
    bestCost[idx] = 0;
    result[idx] = city.religionId;
    maxReach[idx] = tierMaxRadiusCost(city.tier, city.population) * 1.35;
    push(0, idx);
  }

  while (heapCost.length > 0) {
    const { cost, idx } = pop();
    if (cost > bestCost[idx]) continue;
    const rel = result[idx];
    const limit = maxReach[idx];
    const q = idx % width;
    const r = (idx - q) / width;

    for (const nb of getNeighbors(q, r, width, height)) {
      const nbIdx = hexIndex(nb.q, nb.r, width);
      const b = biomes[nbIdx];
      const meta = getBiomeMetaWithCustom(b, customBiomes);
      if (meta.isWater) continue;

      let step = b === BiomeId.SNOW_PEAK ? 6.0 : b === BiomeId.MOUNTAIN ? 3.5 : 1.15;
      if (roadBonus[nbIdx]) step *= 0.65;

      const nextCost = cost + step;
      if (nextCost > limit) continue;
      if (nextCost < bestCost[nbIdx]) {
        bestCost[nbIdx] = nextCost;
        result[nbIdx] = rel;
        maxReach[nbIdx] = limit;
        push(nextCost, nbIdx);
      }
    }
  }

  return result;
}

export interface TerritoryStat {
  kingdomId: string;
  hexCount: number;
  cityCount: number;
  population: number;
}

export function computeTerritoryStats(map: HexMapData): TerritoryStat[] {
  const counts = new Map<string, number>();
  for (const t of map.territories) {
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return map.kingdoms.map((k) => {
    const kCities = map.cities.filter((c) => c.kingdomId === k.id);
    return {
      kingdomId: k.id,
      hexCount: counts.get(k.id) ?? 0,
      cityCount: kCities.length,
      population: kCities.reduce((s, c) => s + c.population, 0),
    };
  });
}

export interface ReligionStat {
  religionId: string;
  hexCount: number;
  cityCount: number;
  population: number;
}

export function computeReligionStats(map: HexMapData): ReligionStat[] {
  const counts = new Map<string, number>();
  for (const r of map.religions) {
    if (r) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return map.religionList.map((rel) => {
    const rCities = map.cities.filter((c) => c.religionId === rel.id);
    return {
      religionId: rel.id,
      hexCount: counts.get(rel.id) ?? 0,
      cityCount: rCities.length,
      population: rCities.reduce((s, c) => s + c.population, 0),
    };
  });
}
