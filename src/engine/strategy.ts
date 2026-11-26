import { getBiomeMetaWithCustom } from '../data/biomes';
import { BiomeId, HexMapData, TerrainId } from '../types/map';
import { getHexTerrain, getNeighbors, hexDistance, hexIndex, isWaterBiome } from './hexMath';

export interface RealmEconomyStat {
  kingdomId: string;
  kingdomName: string;
  color: string;
  hexCount: number;
  cityCount: number;
  population: number;
  foodSupply: number;
  foodDemand: number;
  foodBalancePct: number;
  taxRevenue: number;
  tradeRevenue: number;
  totalTreasuryIncome: number;
  standingArmy: number;
  maxLevy: number;
}

/** Calculate kingdom-level economy, food security, and military manpower from territory biomes, cities, and trade routes. */
export function computeRealmEconomics(map: HexMapData): RealmEconomyStat[] {
  const total = map.width * map.height;
  const landCountByK = new Map<string, number>();
  const foodByK = new Map<string, number>();
  const taxBonusByK = new Map<string, number>();

  for (let i = 0; i < total; i++) {
    const owner = map.territories?.[i];
    if (!owner) continue;
    const b = map.biomes[i];
    if (isWaterBiome(b, map.customBiomes)) continue;

    landCountByK.set(owner, (landCountByK.get(owner) ?? 0) + 1);
    const tId = getHexTerrain(map, i);

    let food = 1.2;
    let rich = 1.0;
    if (b === BiomeId.GRASSLAND || b === BiomeId.WINDWARD_PLAINS) food = 3.2;
    else if (b === BiomeId.DECIDUOUS_FOREST || b === BiomeId.SAVANNA) food = 2.0;
    else if (b === BiomeId.RAINFOREST) food = 2.2;
    else if (b === BiomeId.DESERT || b === BiomeId.SNOW_ICE || b === BiomeId.TUNDRA) food = 0.35;

    if (tId === TerrainId.MOUNTAIN || tId === TerrainId.HIGH_PEAK) {
      food *= 0.45;
      rich = 2.6; // mineral wealth
    } else if (tId === TerrainId.HILLS) {
      food *= 0.75;
      rich = 1.7;
    } else if (map.features?.[i] === 'floodplain' || map.features?.[i] === 'fertile_meadow') {
      food *= 1.8;
      rich = 1.5;
    }

    foodByK.set(owner, (foodByK.get(owner) ?? 0) + food);
    taxBonusByK.set(owner, (taxBonusByK.get(owner) ?? 0) + rich);
  }

  return map.kingdoms.map((k) => {
    const cities = map.cities.filter((c) => c.kingdomId === k.id);
    const population = cities.reduce((s, c) => s + c.population, 0);
    const hexCount = landCountByK.get(k.id) ?? 0;

    // Trade income from routes connected to kingdom cities
    const cityIds = new Set(cities.map((c) => c.id));
    let tradeRevenue = 0;
    for (const tr of map.tradeRoutes) {
      const touches = cityIds.has(tr.fromCityId) || cityIds.has(tr.toCityId);
      if (!touches) continue;
      const both = cityIds.has(tr.fromCityId) && cityIds.has(tr.toCityId);
      tradeRevenue += (both ? 95 : 145) + tr.goodIds.length * 45;
    }

    const landRich = taxBonusByK.get(k.id) ?? 0;
    const taxRevenue = Math.round(population * 0.018 + landRich * 2.2);
    const foodSupply = Math.round((foodByK.get(k.id) ?? 0) * 180 + cities.length * 400);
    const foodDemand = Math.max(100, Math.round(population * 0.65));
    const foodBalancePct = Math.round((foodSupply / foodDemand) * 100);

    const garrisonSum = cities.reduce(
      (s, c) => s + (c.profile?.garrisonSize ?? Math.round(c.population * 0.04)),
      0
    );
    const standingArmy = Math.max(200, Math.round(garrisonSum + hexCount * 4));
    const maxLevy = Math.round(population * 0.14 + hexCount * 10);

    return {
      kingdomId: k.id,
      kingdomName: k.name,
      color: k.color,
      hexCount,
      cityCount: cities.length,
      population,
      foodSupply,
      foodDemand,
      foodBalancePct,
      taxRevenue,
      tradeRevenue: Math.round(tradeRevenue),
      totalTreasuryIncome: taxRevenue + Math.round(tradeRevenue),
      standingArmy,
      maxLevy,
    };
  });
}

export type ChokepointKind = 'mountain_pass' | 'isthmus' | 'strait';

export interface StrategicChokepoint {
  id: string;
  kind: ChokepointKind;
  labelTh: string;
  q: number;
  r: number;
  score: number;
}

/**
 * Scan the 6-neighbor ring topology to locate strategic terrain bottlenecks:
 * - Mountain Pass: passable land hex flanked by 2 disconnected mountain/peak walls
 * - Isthmus: narrow land bridge flanked by 2 separated seas/waters
 * - Strait: narrow water channel flanked by 2 separated landmasses
 */
export function detectStrategicChokepoints(
  map: HexMapData,
  maxCount = 24
): StrategicChokepoint[] {
  const candidates: StrategicChokepoint[] = [];
  const { width, height } = map;

  const isPassableLand = (idx: number) => {
    const t = getHexTerrain(map, idx);
    const bMeta = getBiomeMetaWithCustom(map.biomes[idx], map.customBiomes);
    if (bMeta.isWater || t === TerrainId.DEEP_OCEAN || t === TerrainId.SHALLOW_WATER || t === TerrainId.LAKE) {
      return false;
    }
    return t !== TerrainId.MOUNTAIN && t !== TerrainId.HIGH_PEAK;
  };

  const isMountainWall = (idx: number) => {
    const t = getHexTerrain(map, idx);
    return t === TerrainId.MOUNTAIN || t === TerrainId.HIGH_PEAK;
  };

  const isWaterCell = (idx: number) => {
    const t = getHexTerrain(map, idx);
    const bMeta = getBiomeMetaWithCustom(map.biomes[idx], map.customBiomes);
    return bMeta.isWater || t === TerrainId.DEEP_OCEAN || t === TerrainId.SHALLOW_WATER;
  };

  for (let r = 1; r < height - 1; r++) {
    for (let q = 1; q < width - 1; q++) {
      const idx = hexIndex(q, r, width);
      const nbs = getNeighbors(q, r, width, height);
      if (nbs.length < 6) continue;

      if (isPassableLand(idx)) {
        const passableFlags = nbs.map((nb) => isPassableLand(hexIndex(nb.q, nb.r, width)));
        const mtnFlags = nbs.map((nb) => isMountainWall(hexIndex(nb.q, nb.r, width)));
        const waterFlags = nbs.map((nb) => isWaterCell(hexIndex(nb.q, nb.r, width)));

        // Count transitions around the 6-ring between passable & impassable
        let passableRuns = 0;
        let mtnCount = 0;
        let waterCount = 0;
        for (let k = 0; k < 6; k++) {
          if (passableFlags[k] && !passableFlags[(k + 5) % 6]) passableRuns++;
          if (mtnFlags[k]) mtnCount++;
          if (waterFlags[k]) waterCount++;
        }

        if (passableRuns === 2 && mtnCount >= 3) {
          candidates.push({
            id: `cp_pass_${q}_${r}`,
            kind: 'mountain_pass',
            labelTh: 'ช่องเขายุทธศาสตร์',
            q,
            r,
            score: 80 + mtnCount * 5,
          });
        } else if (passableRuns === 2 && waterCount >= 3) {
          candidates.push({
            id: `cp_isthmus_${q}_${r}`,
            kind: 'isthmus',
            labelTh: 'คอคอดแผ่นดิน',
            q,
            r,
            score: 75 + waterCount * 5,
          });
        }
      } else if (isWaterCell(idx)) {
        const waterFlags = nbs.map((nb) => isWaterCell(hexIndex(nb.q, nb.r, width)));
        const landFlags = nbs.map((nb) => isPassableLand(hexIndex(nb.q, nb.r, width)) || isMountainWall(hexIndex(nb.q, nb.r, width)));
        let waterRuns = 0;
        let landCount = 0;
        for (let k = 0; k < 6; k++) {
          if (waterFlags[k] && !waterFlags[(k + 5) % 6]) waterRuns++;
          if (landFlags[k]) landCount++;
        }
        if (waterRuns === 2 && landCount >= 2) {
          candidates.push({
            id: `cp_strait_${q}_${r}`,
            kind: 'strait',
            labelTh: 'ช่องแคบทางทะเล',
            q,
            r,
            score: 70 + landCount * 6,
          });
        }
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Deduplicate nearby chokepoints within 3 hexes
  const picked: StrategicChokepoint[] = [];
  for (const c of candidates) {
    if (picked.some((p) => hexDistance(p, c) <= 3)) continue;
    picked.push(c);
    if (picked.length >= maxCount) break;
  }
  return picked;
}
