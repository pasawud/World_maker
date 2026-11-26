import { describe, expect, it } from 'vitest';
import {
  getAllFeatures,
  getFeatureMeta,
  getFeatureMetaWithCustom,
} from '../../data/features';
import { getAllTerrains, getTerrainMetaWithCustom } from '../../data/terrains';
import { BiomeId, City, TerrainId } from '../../types/map';
import {
  elevationToMeters,
  formatElevationMeters,
  sculptElevationBrush,
} from '../elevation';
import { convertHeightmapPixelsToMap } from '../heightmap';
import { extractRegionalSubMap } from '../submap';
import {
  exportLorebookHtml,
  exportLorebookMarkdown,
  getDiplomaticRelation,
  parseWikiMentions,
  upsertDiplomaticRelation,
} from '../worldbuilding';
import {
  autoDetectCliffsFromElevation,
  getCliffEdges,
  syncShallowWater,
} from '../cliffs';
import { generateCityPlan, createDefaultCityProfile } from '../cityGenerator';
import { buildCityGeometry, pointInPolygon } from '../cityGeometry';
import {
  computeRealDimensions,
  cubeToOffset,
  findHexPath,
  getCombinedMoveCost,
  getHexTerrain,
  getNeighbors,
  hexDistance,
  hexIndex,
  hexToPixel,
  isWaterBiome,
  offsetToCube,
  pixelToHex,
  validateRoadStep,
} from '../hexMath';
import { generateRiversAuto, priorityFloodFill } from '../hydrology';
import {
  computeCultureStats,
  generateCulturesFromCities,
  generateReligionsFromCities,
  generateTerritoriesFromCities,
} from '../politics';
import { parseMapFromJson, resizeMap, serializeMapToJson } from '../serialization';
import {
  createInitialTimeline,
  createNewEraFromCurrent,
  decodeRle,
  encodeRle,
  switchMapToEra,
} from '../timeline';
import { computeCityTradeOverview, estimateRouteTradeValue } from '../trade';
import {
  computeOceanCurrents,
  getCurrentKind,
  traceOceanCurrentStreams,
} from '../currents';
import {
  autoSuggestGoodsForCity,
  DEFAULT_GEOGRAPHY_CONFIG,
  generateWorld,
  getColLongitude,
  getPrevailingWindVector,
  getRowLatitude,
  recomputeBiomesFromCurrentMap,
  simulateClimate,
} from '../worldGenerator';

describe('Hex Math & Real Dimensions', () => {
  it('round-trips offset <-> cube and pixel <-> hex coordinates', () => {
    for (let r = 0; r < 15; r++) {
      for (let q = 0; q < 15; q++) {
        const cube = offsetToCube(q, r);
        expect(cube.x + cube.y + cube.z).toBe(0);
        const back = cubeToOffset(cube);
        expect(back).toEqual({ q, r });

        const px = hexToPixel(q, r, 18);
        const hex = pixelToHex(px.x, px.y, 18);
        expect(hex).toEqual({ q, r });
      }
    }
    expect(hexDistance({ q: 2, r: 2 }, { q: 2, r: 2 })).toBe(0);
    expect(hexDistance({ q: 2, r: 2 }, { q: 3, r: 2 })).toBe(1);
  });

  it('computes real-world dimensions accurately', () => {
    const dims = computeRealDimensions(240, 156, 50);
    expect(dims.widthKm).toBe(12000);
    expect(Math.round(dims.heightKm)).toBe(Math.round(156 * 50 * (Math.sqrt(3) / 2)));
    expect(dims.totalHexes).toBe(240 * 156);
    expect(dims.hexAreaKm2).toBeGreaterThan(2000);
  });
});

describe('Realistic Road & Sea Route Validation (Bug Fixes)', () => {
  it('A* land road routes around mountain/snow-peak walls and never steps on ocean', () => {
    const w = 14;
    const h = 12;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.biomes = new Array<number>(w * h).fill(BiomeId.GRASSLAND);
    map.elevation = new Array<number>(w * h).fill(0.12);
    map.features = new Array<string>(w * h).fill('');
    map.roads = [];

    // Vertical mountain wall at q=6 from r=0..8
    for (let r = 0; r <= 8; r++) {
      map.biomes[hexIndex(6, r, w)] = BiomeId.MOUNTAIN;
      map.elevation[hexIndex(6, r, w)] = 0.72;
    }

    const res = findHexPath(map, { q: 2, r: 3 }, { q: 10, r: 3 }, 'land');
    expect(res.reachable).toBe(true);
    const crossedMountain = res.hexes.some(
      (pt) => map.biomes[hexIndex(pt.q, pt.r, w)] === BiomeId.MOUNTAIN
    );
    expect(crossedMountain).toBe(false);
    expect(validateRoadStep(map, { q: 2, r: 3 }, 'stone', true)).toBe(true);
  });

  it('prevents placing sea routes on inland land and blocks sea pathfinding across land', () => {
    const w = 14;
    const h = 10;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.biomes = new Array<number>(w * h).fill(BiomeId.GRASSLAND);
    map.features = new Array<string>(w * h).fill('');
    map.roads = [];

    // Make left coast (q=0..2) and right coast (q=11..13) water, separated by solid land (q=3..10)
    for (let r = 0; r < h; r++) {
      for (let q = 0; q <= 2; q++) map.biomes[hexIndex(q, r, w)] = BiomeId.SHALLOW_WATER;
      for (let q = 11; q < w; q++) map.biomes[hexIndex(q, r, w)] = BiomeId.SHALLOW_WATER;
    }

    // Inland hex (q=6, r=5) cannot start or host a sea route
    expect(validateRoadStep(map, { q: 6, r: 5 }, 'sea', true)).toBe(false);
    expect(validateRoadStep(map, { q: 6, r: 5 }, 'sea', false)).toBe(false);
    // Coastal port hex (q=3, r=5) can be an endpoint, water (q=1, r=5) can be anywhere
    expect(validateRoadStep(map, { q: 3, r: 5 }, 'sea', true)).toBe(true);
    expect(validateRoadStep(map, { q: 1, r: 5 }, 'sea', false)).toBe(true);

    // Sea route between two inland hexes or across solid continent must fail!
    const inlandRes = findHexPath(map, { q: 5, r: 4 }, { q: 8, r: 4 }, 'sea');
    expect(inlandRes.reachable).toBe(false);

    const acrossContinentRes = findHexPath(map, { q: 1, r: 5 }, { q: 12, r: 5 }, 'sea');
    expect(acrossContinentRes.reachable).toBe(false);

    // Same-sea path between two coastal/water hexes succeeds and stays strictly on water
    const sameSea = findHexPath(map, { q: 3, r: 1 }, { q: 3, r: 8 }, 'sea');
    expect(sameSea.reachable).toBe(true);
    for (let i = 1; i < sameSea.hexes.length - 1; i++) {
      const pt = sameSea.hexes[i];
      expect(isWaterBiome(map.biomes[hexIndex(pt.q, pt.r, w)], map.customBiomes)).toBe(true);
    }
  });
});

describe('Real-Geography Climate, Hydrology, Politics, Religion & Features', () => {
  it('produces colder temperatures at poles and high mountains (lapse rate)', () => {
    const w = 20;
    const h = 21;
    const elev = new Array<number>(w * h).fill(0.1);
    elev[hexIndex(10, 10, w)] = 0.85;

    const cfg = { ...DEFAULT_GEOGRAPHY_CONFIG, latNorth: 75, latSouth: 0 };
    const { temperature } = simulateClimate(elev, w, h, cfg);

    expect(temperature[hexIndex(5, 0, w)]).toBeLessThan(temperature[hexIndex(5, 20, w)]);
    expect(temperature[hexIndex(10, 10, w)]).toBeLessThan(temperature[hexIndex(5, 10, w)] - 15);
  });

  it('produces orographic precipitation and a dry rain shadow on leeward side of mountains', () => {
    const w = 36;
    const h = 12;
    const elev = new Array<number>(w * h).fill(0.15);
    for (let r = 0; r < h; r++) {
      for (let q = 0; q < 8; q++) elev[hexIndex(q, r, w)] = -0.4;
      for (let q = 16; q <= 18; q++) elev[hexIndex(q, r, w)] = 0.78;
    }

    const cfg = { ...DEFAULT_GEOGRAPHY_CONFIG, windMode: 'west' as const, latNorth: 45, latSouth: 35 };
    const { moisture } = simulateClimate(elev, w, h, cfg);
    expect(moisture[hexIndex(15, 6, w)]).toBeGreaterThan(moisture[hexIndex(22, 6, w)] + 0.12);
  });

  it('Priority-Flood and auto-river generation flow monotonically downhill', () => {
    const map = generateWorld(70, 50, 25, {
      ...DEFAULT_GEOGRAPHY_CONFIG,
      seed: 12345,
      riverThreshold: 14,
    });
    const hydro = generateRiversAuto(map, { threshold: 14, useCurrentBiomes: false });
    expect(hydro.rivers.length).toBeGreaterThan(0);

    const isWater = new Uint8Array(map.width * map.height);
    for (let i = 0; i < map.biomes.length; i++) {
      if (map.biomes[i] === BiomeId.DEEP_OCEAN || map.biomes[i] === BiomeId.SHALLOW_WATER) {
        isWater[i] = 1;
      }
    }
    const filled = priorityFloodFill(map.elevation, map.width, map.height, isWater);

    for (const river of hydro.rivers) {
      expect(river.points.length).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < river.points.length - 1; i++) {
        const idxA = hexIndex(river.points[i].q, river.points[i].r, map.width);
        const idxB = hexIndex(river.points[i + 1].q, river.points[i + 1].r, map.width);
        expect(filled[idxB]).toBeLessThan(filled[idxA]);
      }
    }
  });

  it('generates political territories, religious zones, and valid special features', () => {
    const map = generateWorld(60, 45, 25, DEFAULT_GEOGRAPHY_CONFIG);
    const territories = generateTerritoriesFromCities(map);
    const religions = generateReligionsFromCities(map);

    expect(territories.some((t) => t !== '')).toBe(true);
    expect(religions.some((r) => r !== '')).toBe(true);

    for (let i = 0; i < map.biomes.length; i++) {
      const water = isWaterBiome(map.biomes[i]);
      if (water) {
        // Oceans should never be claimed as political land territories or religious zones
        expect(territories[i]).toBe('');
        expect(religions[i]).toBe('');
      }
      const fId = map.features[i];
      if (fId) {
        const meta = getFeatureMeta(fId);
        expect(meta).not.toBeNull();
        if (meta?.placement === 'water') expect(water).toBe(true);
        if (meta?.placement === 'land' || meta?.placement === 'coast') expect(water).toBe(false);
      }
    }
  });
});

describe('Custom Biomes, Custom POIs & Serialization Backward Compatibility', () => {
  it('round-trips custom biomes, POIs, territories, religions, features, and migrates legacy JSON', () => {
    const map = generateWorld(50, 40, 20, DEFAULT_GEOGRAPHY_CONFIG, 'โลกแฟนตาซี');
    map.customBiomes.push({
      id: 100,
      nameTh: 'ทุ่งคริสตัล',
      color: '#a855f7',
      isWater: false,
      defaultElevation: 0.25,
      moveCost: 1.5,
      detailStyle: 'crystal',
    });
    map.customPoiTypes.push({
      id: 'poi_custom_portal',
      label: 'ประตูมิติ',
      symbol: '🌀',
      color: '#38bdf8',
      isCustom: true,
    });
    map.biomes[hexIndex(10, 10, map.width)] = 100;

    const json = serializeMapToJson(map);
    const restored = parseMapFromJson(json);

    expect(restored.customBiomes).toHaveLength(1);
    expect(restored.customBiomes[0].nameTh).toBe('ทุ่งคริสตัล');
    expect(restored.customPoiTypes).toHaveLength(1);
    expect(restored.biomes[hexIndex(10, 10, map.width)]).toBe(100);
    expect(restored.territories).toEqual(map.territories);
    expect(restored.religions).toEqual(map.religions);
    expect(restored.features).toEqual(map.features);

    // Legacy JSON without new fields parses cleanly
    const legacyObj = JSON.parse(json) as Record<string, unknown>;
    delete legacyObj.features;
    delete legacyObj.territories;
    delete legacyObj.religions;
    delete legacyObj.religionList;
    delete legacyObj.customBiomes;
    delete legacyObj.customPoiTypes;
    const migrated = parseMapFromJson(JSON.stringify(legacyObj));
    expect(migrated.features).toHaveLength(50 * 40);
    expect(migrated.religionList.length).toBeGreaterThan(0);

    const resized = resizeMap(restored, 55, 45, 40, 'preserve');
    expect(resized.customBiomes).toHaveLength(1);
    expect(resized.territories).toHaveLength(55 * 45);
  });
});

describe('Cliff System & Automatic Shallow Water', () => {
  it('turns ocean near land into shallow water and reverts orphaned shallow water back to deep ocean', () => {
    const w = 10;
    const h = 10;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.biomes = new Array<number>(w * h).fill(BiomeId.DEEP_OCEAN);
    map.elevation = new Array<number>(w * h).fill(-0.65);
    map.features = new Array<string>(w * h).fill('');

    // Place a single land hex in the middle of deep ocean
    const centerIdx = hexIndex(5, 5, w);
    map.biomes[centerIdx] = BiomeId.GRASSLAND;
    map.elevation[centerIdx] = 0.12;

    const afterPlace = syncShallowWater(map, { changedHexes: [{ q: 5, r: 5 }] });
    expect(afterPlace.changed).toBe(true);
    for (const nb of getNeighbors(5, 5, w, h)) {
      expect(afterPlace.biomes[hexIndex(nb.q, nb.r, w)]).toBe(BiomeId.SHALLOW_WATER);
    }
    // Distant hex stays deep ocean
    expect(afterPlace.biomes[hexIndex(0, 0, w)]).toBe(BiomeId.DEEP_OCEAN);

    // Erase the land hex back to deep ocean -> shallow water reverts to deep ocean
    afterPlace.biomes[centerIdx] = BiomeId.DEEP_OCEAN;
    afterPlace.elevation[centerIdx] = -0.65;
    const afterErase = syncShallowWater(
      { ...map, biomes: afterPlace.biomes, elevation: afterPlace.elevation, features: afterPlace.features },
      { changedHexes: [{ q: 5, r: 5 }] }
    );
    for (const nb of getNeighbors(5, 5, w, h)) {
      expect(afterErase.biomes[hexIndex(nb.q, nb.r, w)]).toBe(BiomeId.DEEP_OCEAN);
    }
  });

  it('prevents shallow water next to cliff coasts, clears shallow-only features, and restores on cliff removal', () => {
    const w = 12;
    const h = 10;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.biomes = new Array<number>(w * h).fill(BiomeId.DEEP_OCEAN);
    map.elevation = new Array<number>(w * h).fill(-0.65);
    map.features = new Array<string>(w * h).fill('');

    // Horizontal strip of land at r=3 from q=3..8
    for (let q = 3; q <= 8; q++) {
      const idx = hexIndex(q, 3, w);
      map.biomes[idx] = BiomeId.GRASSLAND;
      map.elevation[idx] = 0.25;
    }

    const synced1 = syncShallowWater(map);
    const seaNextToMiddle = getNeighbors(5, 3, w, h).filter((nb) =>
      isWaterBiome(synced1.biomes[hexIndex(nb.q, nb.r, w)])
    );
    expect(seaNextToMiddle.length).toBeGreaterThan(0);
    for (const nb of seaNextToMiddle) {
      expect(synced1.biomes[hexIndex(nb.q, nb.r, w)]).toBe(BiomeId.SHALLOW_WATER);
    }

    // Put coral_reef on one of the shallow hexes, then place a cliff at (5, 3)
    const testSea = seaNextToMiddle[0];
    synced1.features[hexIndex(testSea.q, testSea.r, w)] = 'coral_reef';
    synced1.features[hexIndex(5, 3, w)] = 'cliff';

    const syncedCliff = syncShallowWater(
      { ...map, biomes: synced1.biomes, elevation: synced1.elevation, features: synced1.features },
      { changedHexes: [{ q: 5, r: 3 }] }
    );
    for (const nb of seaNextToMiddle) {
      expect(syncedCliff.biomes[hexIndex(nb.q, nb.r, w)]).toBe(BiomeId.DEEP_OCEAN);
    }
    expect(syncedCliff.features[hexIndex(testSea.q, testSea.r, w)]).toBe('');

    // Non-cliff coast far enough away (e.g. neighbor of (8, 3) not touching (5, 3)) remains shallow water
    const farNonCliffSea = getNeighbors(8, 3, w, h).filter(
      (nb) =>
        isWaterBiome(syncedCliff.biomes[hexIndex(nb.q, nb.r, w)]) &&
        hexDistance(nb, { q: 5, r: 3 }) > 1
    );
    expect(farNonCliffSea.length).toBeGreaterThan(0);
    for (const nb of farNonCliffSea) {
      expect(syncedCliff.biomes[hexIndex(nb.q, nb.r, w)]).toBe(BiomeId.SHALLOW_WATER);
    }

    // Remove the cliff -> adjacent sea returns to SHALLOW_WATER
    syncedCliff.features[hexIndex(5, 3, w)] = '';
    const restored = syncShallowWater(
      { ...map, biomes: syncedCliff.biomes, elevation: syncedCliff.elevation, features: syncedCliff.features },
      { changedHexes: [{ q: 5, r: 3 }] }
    );
    for (const nb of seaNextToMiddle) {
      expect(restored.biomes[hexIndex(nb.q, nb.r, w)]).toBe(BiomeId.SHALLOW_WATER);
    }
  });

  it('preserves custom water biomes and creates shallow water around custom land biomes', () => {
    const w = 10;
    const h = 10;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.customBiomes = [
      {
        id: 100,
        nameTh: 'ทะเลอาถรรพ์',
        color: '#4c1d95',
        isWater: true,
        defaultElevation: -0.4,
        moveCost: 99,
        detailStyle: 'none',
      },
      {
        id: 101,
        nameTh: 'แผ่นดินคริสตัล',
        color: '#a855f7',
        isWater: false,
        defaultElevation: 0.25,
        moveCost: 1.5,
        detailStyle: 'crystal',
      },
    ];
    map.biomes = new Array<number>(w * h).fill(BiomeId.DEEP_OCEAN);
    map.elevation = new Array<number>(w * h).fill(-0.65);
    map.features = new Array<string>(w * h).fill('');

    // Custom water next to custom land
    map.biomes[hexIndex(5, 5, w)] = 101;
    map.elevation[hexIndex(5, 5, w)] = 0.25;
    map.biomes[hexIndex(6, 5, w)] = 100;
    map.elevation[hexIndex(6, 5, w)] = -0.4;

    const res = syncShallowWater(map);
    // Custom water (100) must not be overwritten
    expect(res.biomes[hexIndex(6, 5, w)]).toBe(100);
    // Built-in ocean neighbors of custom land (101) become SHALLOW_WATER
    expect(res.biomes[hexIndex(4, 5, w)]).toBe(BiomeId.SHALLOW_WATER);
  });

  it('computes cliff edges toward water/lower elevation, merges adjacent cliffs, and falls back on flat land', () => {
    const w = 10;
    const h = 10;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.biomes = new Array<number>(w * h).fill(BiomeId.GRASSLAND);
    map.elevation = new Array<number>(w * h).fill(0.2);
    map.features = new Array<string>(w * h).fill('');

    // Flat land fallback
    map.features[hexIndex(2, 2, w)] = 'cliff';
    const flatEdges = getCliffEdges(map, 2, 2);
    expect(flatEdges.length).toBeGreaterThan(0);

    // Chained coastal cliffs at (5, 5) and (6, 5) with water at r=6
    map.biomes[hexIndex(5, 6, w)] = BiomeId.DEEP_OCEAN;
    map.biomes[hexIndex(6, 6, w)] = BiomeId.DEEP_OCEAN;
    map.features[hexIndex(5, 5, w)] = 'cliff';
    map.features[hexIndex(6, 5, w)] = 'cliff';

    const edges55 = getCliffEdges(map, 5, 5);
    expect(edges55.length).toBeGreaterThan(0);
    // Edge 0 goes east (+1, 0) to (6, 5), which is also a cliff -> must be suppressed
    expect(edges55).not.toContain(0);

    // Inland elevation drop at (2, 7): neighbor (3, 7) is lower by > 0.06
    map.features[hexIndex(2, 7, w)] = 'cliff';
    map.elevation[hexIndex(2, 7, w)] = 0.5;
    map.elevation[hexIndex(3, 7, w)] = 0.1;
    const inlandEdges = getCliffEdges(map, 2, 7);
    expect(inlandEdges).toContain(0);
  });

  it('enforces coastal shallow-water and cliff invariant across generated worlds', () => {
    const map = generateWorld(80, 60, 25, {
      ...DEFAULT_GEOGRAPHY_CONFIG,
      seed: 77712,
    });

    for (let r = 0; r < map.height; r++) {
      for (let q = 0; q < map.width; q++) {
        const idx = hexIndex(q, r, map.width);
        const b = map.biomes[idx];
        if (b !== BiomeId.DEEP_OCEAN && b !== BiomeId.SHALLOW_WATER) continue;

        const nbs = getNeighbors(q, r, map.width, map.height);
        const touchesCliff = nbs.some((nb) => {
          const nbIdx = hexIndex(nb.q, nb.r, map.width);
          return !isWaterBiome(map.biomes[nbIdx]) && map.features[nbIdx] === 'cliff';
        });
        const touchesNonCliffLand = nbs.some((nb) => {
          const nbIdx = hexIndex(nb.q, nb.r, map.width);
          return !isWaterBiome(map.biomes[nbIdx]) && map.features[nbIdx] !== 'cliff';
        });

        if (touchesCliff) {
          expect(b).toBe(BiomeId.DEEP_OCEAN);
        } else if (touchesNonCliffLand) {
          expect(b).toBe(BiomeId.SHALLOW_WATER);
        } else {
          expect(b).toBe(BiomeId.DEEP_OCEAN);
        }
      }
    }
  });

  it('blocks sea routes from docking/starting on coastal cliffs while allowing normal coasts', () => {
    const w = 12;
    const h = 10;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.biomes = new Array<number>(w * h).fill(BiomeId.DEEP_OCEAN);
    map.elevation = new Array<number>(w * h).fill(-0.65);
    map.features = new Array<string>(w * h).fill('');
    map.roads = [];

    // Coastal cliff at (5, 4) and normal sandy coast at (5, 6)
    map.biomes[hexIndex(5, 4, w)] = BiomeId.HIGHLAND;
    map.elevation[hexIndex(5, 4, w)] = 0.5;
    map.features[hexIndex(5, 4, w)] = 'cliff';

    map.biomes[hexIndex(5, 6, w)] = BiomeId.GRASSLAND;
    map.elevation[hexIndex(5, 6, w)] = 0.12;

    expect(validateRoadStep(map, { q: 5, r: 4 }, 'sea', true)).toBe(false);
    expect(validateRoadStep(map, { q: 5, r: 6 }, 'sea', true)).toBe(true);

    const cliffSea = findHexPath(map, { q: 5, r: 4 }, { q: 2, r: 4 }, 'sea');
    expect(cliffSea.reachable).toBe(false);

    const coastSea = findHexPath(map, { q: 5, r: 6 }, { q: 2, r: 6 }, 'sea');
    expect(coastSea.reachable).toBe(true);
  });

  it('autoDetectCliffsFromElevation marks steep coastal hexes as cliffs and keeps adjacent water deep', () => {
    const w = 10;
    const h = 10;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.biomes = new Array<number>(w * h).fill(BiomeId.SHALLOW_WATER);
    map.elevation = new Array<number>(w * h).fill(-0.18);
    map.features = new Array<string>(w * h).fill('');

    const mtnIdx = hexIndex(4, 4, w);
    map.biomes[mtnIdx] = BiomeId.MOUNTAIN;
    map.elevation[mtnIdx] = 0.68;

    const flatIdx = hexIndex(7, 7, w);
    map.biomes[flatIdx] = BiomeId.GRASSLAND;
    map.elevation[flatIdx] = 0.12;

    const res = autoDetectCliffsFromElevation(map);
    expect(res.features[mtnIdx]).toBe('cliff');
    expect(res.features[flatIdx]).toBe('');
    for (const nb of getNeighbors(4, 4, w, h)) {
      expect(res.biomes[hexIndex(nb.q, nb.r, w)]).toBe(BiomeId.DEEP_OCEAN);
    }
    for (const nb of getNeighbors(7, 7, w, h)) {
      expect(res.biomes[hexIndex(nb.q, nb.r, w)]).toBe(BiomeId.SHALLOW_WATER);
    }
  });
});

describe('Culture System, Customization & City Trade Overview', () => {
  it('generates cultures from cities across land, avoids water, and computes stats accurately', () => {
    const map = generateWorld(60, 45, 25, DEFAULT_GEOGRAPHY_CONFIG);
    const cultures = generateCulturesFromCities(map);
    expect(cultures.some((c) => c !== '')).toBe(true);

    for (let i = 0; i < map.biomes.length; i++) {
      if (isWaterBiome(map.biomes[i])) {
        expect(cultures[i]).toBe('');
      }
    }

    const stats = computeCultureStats({ ...map, cultures });
    expect(stats.length).toBe(map.cultureList.length);
    const totalHexes = stats.reduce((s, st) => s + st.hexCount, 0);
    expect(totalHexes).toBeGreaterThan(0);
  });

  it('round-trips cultures and city cultureId, and migrates legacy JSON missing culture fields', () => {
    const map = generateWorld(50, 40, 20, DEFAULT_GEOGRAPHY_CONFIG);
    expect(map.cultureList.length).toBeGreaterThan(0);
    const json = serializeMapToJson(map);
    const restored = parseMapFromJson(json);

    expect(restored.cultureList).toEqual(map.cultureList);
    expect(restored.cultures).toEqual(map.cultures);
    if (restored.cities.length > 0) {
      expect(restored.cities[0].cultureId).toBe(map.cities[0].cultureId);
    }

    const legacyObj = JSON.parse(json) as Record<string, unknown>;
    delete legacyObj.cultures;
    delete legacyObj.cultureList;
    const migrated = parseMapFromJson(JSON.stringify(legacyObj));
    expect(migrated.cultures).toHaveLength(50 * 40);
    expect(migrated.cultureList.length).toBeGreaterThan(0);

    const resized = resizeMap(restored, 55, 45, 30, 'preserve');
    expect(resized.cultures).toHaveLength(55 * 45);
    expect(resized.cultureList).toEqual(restored.cultureList);
  });

  it('computes city trade overview with route direction, value, fulfilled demands, and partner suggestions', () => {
    const w = 24;
    const h = 16;
    const map = generateWorld(w, h, 25, DEFAULT_GEOGRAPHY_CONFIG);
    map.biomes = new Array<number>(w * h).fill(BiomeId.GRASSLAND);
    map.elevation = new Array<number>(w * h).fill(0.15);
    map.features = new Array<string>(w * h).fill('');
    map.roads = [];

    map.cities = [
      {
        id: 'c1',
        name: 'เมืองท่าตะวันตก',
        q: 3,
        r: 6,
        tier: 'city',
        population: 30000,
        kingdomId: map.kingdoms[0].id,
        religionId: map.religionList[0].id,
        cultureId: map.cultureList[0].id,
        producedGoods: ['wheat', 'wine'],
        demandedGoods: ['iron', 'gems'],
        notes: '',
      },
      {
        id: 'c2',
        name: 'เมืองเหมืองแร่',
        q: 10,
        r: 6,
        tier: 'town',
        population: 12000,
        kingdomId: map.kingdoms[0].id,
        religionId: map.religionList[0].id,
        cultureId: map.cultureList[0].id,
        producedGoods: ['iron', 'salt'],
        demandedGoods: ['wheat'],
        notes: '',
      },
      {
        id: 'c3',
        name: 'นครอัญมณี',
        q: 18,
        r: 6,
        tier: 'capital',
        population: 60000,
        kingdomId: map.kingdoms[1].id,
        religionId: map.religionList[1].id,
        cultureId: map.cultureList[1].id,
        producedGoods: ['gems', 'silk'],
        demandedGoods: ['wine', 'wheat'],
        notes: '',
      },
    ];

    map.tradeRoutes = [
      {
        id: 'tr1',
        fromCityId: 'c1',
        toCityId: 'c2',
        goodIds: ['wheat', 'iron'],
        mode: 'land',
        hexes: [
          { q: 3, r: 6 },
          { q: 10, r: 6 },
        ],
        distanceKm: 175,
        travelDays: 7,
      },
    ];

    const routeVal = estimateRouteTradeValue(map.tradeRoutes[0], map);
    expect(routeVal).toBeGreaterThan(0);

    const overview = computeCityTradeOverview(map, 'c1');
    expect(overview).not.toBeNull();
    expect(overview!.routes).toHaveLength(1);
    expect(overview!.routes[0].direction).toBe('mutual');
    expect(overview!.routes[0].partnerCity?.id).toBe('c2');
    expect(overview!.fulfilledDemandIds).toContain('iron');
    expect(overview!.unfulfilledDemandIds).toContain('gems');
    expect(overview!.totalEstimatedValue).toBe(routeVal);
    expect(overview!.suggestions).toHaveLength(1);
    expect(overview!.suggestions[0].partner.id).toBe('c3');
    expect(overview!.suggestions[0].totalMatches).toBeGreaterThanOrEqual(2);
  });
});

describe('Deep Lore Custom Types, Timeline Snapshots & City Blueprint Generator', () => {
  it('round-trips custom government/religion/culture types and deep lore details', () => {
    const map = generateWorld(40, 30, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.customGovernmentTypes = [{ id: 'gov_mage_council', label: 'สภาจอมเวท' }];
    map.customReligionTypes = [{ id: 'rel_machine', label: 'ลัทธิจักรกลศักดิ์สิทธิ์' }];
    map.customCultureTypes = [{ id: 'cult_sky', label: 'อารยธรรมลอยฟ้า' }];

    map.kingdoms[0].government = 'gov_mage_council';
    map.kingdoms[0].details = {
      rulerTitle: 'อัครมหาจอมเวท',
      rulerName: 'เซริน',
      succession: 'เลือกตั้งโดยสภา',
      powerStructure: 'สภาจอมเวทเจ็ดหอคอย',
      laws: ['ห้ามใช้ศาสตร์ต้องห้ามในเมือง'],
      motto: 'ปัญญาเหนือคมดาบ',
    };
    map.religionList[0].type = 'rel_machine';
    map.religionList[0].details = {
      deities: [{ id: 'd1', name: 'ฟันเฟืองนิรันดร์', domain: 'กลไก', symbol: '⚙️' }],
      tenets: ['จงสร้างและซ่อมแซม'],
      taboos: ['ห้ามปล่อยให้สนิมกัดกร่อน'],
      clergyStructure: 'วิศวกรนักบวช',
      rituals: ['พิธีหยอดน้ำมันปฐมฤกษ์'],
      holyCityIds: map.cities[0] ? [map.cities[0].id] : [],
      sacredText: 'ตำราแห่งเฟืองทอง',
    };

    const json = serializeMapToJson(map);
    const restored = parseMapFromJson(json);

    expect(restored.customGovernmentTypes).toHaveLength(1);
    expect(restored.customReligionTypes).toHaveLength(1);
    expect(restored.customCultureTypes).toHaveLength(1);
    expect(restored.kingdoms[0].details?.rulerName).toBe('เซริน');
    expect(restored.religionList[0].details?.deities[0].name).toBe('ฟันเฟืองนิรันดร์');
  });

  it('compresses grids with RLE and switches timeline era snapshots without losing state', () => {
    const sample = ['north', 'north', 'north', '', '', 'central', 'central', ''];
    const rle = encodeRle(sample);
    expect(rle).toEqual([
      ['north', 3],
      ['', 2],
      ['central', 2],
      ['', 1],
    ]);
    expect(decodeRle(rle, sample.length)).toEqual(sample);
    expect(encodeRle([])).toEqual([]);

    const map = generateWorld(30, 24, 20, DEFAULT_GEOGRAPHY_CONFIG);
    const era1Idx = hexIndex(5, 5, map.width);
    map.territories[era1Idx] = map.kingdoms[0].id;
    map.timeline = createInitialTimeline(map);
    const era1Id = map.timeline.activeEraId;

    // Advance to Era 2 and mutate territory + city count
    const era2Map = createNewEraFromCurrent(map, 'ยุคจักรวรรดิขยายตัว', 250);
    const era2Id = era2Map.timeline!.activeEraId;
    expect(era2Id).not.toBe(era1Id);
    era2Map.territories[era1Idx] = map.kingdoms[1].id;
    era2Map.cities = [];

    // Switch back to Era 1 -> original territory and cities return intact
    const backToEra1 = switchMapToEra(era2Map, era1Id);
    expect(backToEra1.territories[era1Idx]).toBe(map.kingdoms[0].id);
    expect(backToEra1.cities.length).toBe(map.cities.length);

    // Switch forward to Era 2 again -> Era 2 mutations remain preserved
    const backToEra2 = switchMapToEra(backToEra1, era2Id);
    expect(backToEra2.territories[era1Idx]).toBe(map.kingdoms[1].id);
    expect(backToEra2.cities.length).toBe(0);
  });

  it('generates geography-aware 2D city plans (coastal harbor, river bridge, cliff, capital walls) and round-trips JSON', () => {
    const w = 16;
    const h = 14;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.biomes = new Array<number>(w * h).fill(BiomeId.GRASSLAND);
    map.elevation = new Array<number>(w * h).fill(0.18);
    map.features = new Array<string>(w * h).fill('');
    map.rivers = [
      {
        id: 'rv1',
        source: 'manual',
        points: [
          { q: 5, r: 5, flux: 20 },
          { q: 6, r: 6, flux: 24 },
          { q: 7, r: 7, flux: 28 },
        ],
      },
    ];

    // Place ocean east of city (6, 6) -> (7, 6) and cliff north-west -> (5, 5)
    map.biomes[hexIndex(7, 6, w)] = BiomeId.SHALLOW_WATER;
    map.features[hexIndex(5, 5, w)] = 'cliff';

    const capital: City = {
      id: 'cap1',
      name: 'นครหลวงออร์เรียน',
      q: 6,
      r: 6,
      tier: 'capital',
      population: 90000,
      kingdomId: map.kingdoms[0].id,
      religionId: map.religionList[0].id,
      cultureId: map.cultureList[0].id,
      producedGoods: ['wheat', 'wine'],
      demandedGoods: ['iron'],
      notes: '',
    };
    const profile = createDefaultCityProfile(map, capital);
    const plan = generateCityPlan(map, { ...capital, profile });

    expect(plan.waterSide).toBe('east');
    expect(plan.hasRiver).toBe(true);
    expect(plan.hasCliff).toBe(true);
    expect(plan.hasWalls).toBe(true);
    expect(plan.wallStyle).toBe('citadel_double');
    expect(plan.districts.some((d) => d.type === 'harbor')).toBe(true);
    expect(plan.districts.some((d) => d.type === 'citadel')).toBe(true);
    expect(plan.districts.some((d) => d.type === 'temple')).toBe(true);
    expect(plan.roads.some((r) => r.kind === 'bridge')).toBe(true);

    capital.plan = plan;
    capital.profile = profile;
    map.cities = [capital];

    const restored = parseMapFromJson(serializeMapToJson(map));
    expect(restored.cities[0].plan?.waterSide).toBe('east');
    expect(restored.cities[0].plan?.districts.length).toBe(plan.districts.length);
    expect(restored.cities[0].profile?.defenseRating).toBe(9);
  });

  it('builds Watabou-style procedural city geometry with walls, towers, 5 water contours, piers, and non-flooded packed buildings', () => {
    const w = 16;
    const h = 14;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.biomes = new Array<number>(w * h).fill(BiomeId.GRASSLAND);
    map.elevation = new Array<number>(w * h).fill(0.18);
    map.features = new Array<string>(w * h).fill('');
    map.biomes[hexIndex(7, 6, w)] = BiomeId.SHALLOW_WATER;

    const portCity: City = {
      id: 'port_w',
      name: 'เมืองท่าเพอร์ชเมนต์',
      q: 6,
      r: 6,
      tier: 'city',
      population: 34000,
      kingdomId: map.kingdoms[0].id,
      religionId: map.religionList[0].id,
      cultureId: map.cultureList[0].id,
      producedGoods: ['fish', 'salt'],
      demandedGoods: ['wheat'],
      notes: '',
    };

    const plan = generateCityPlan(map, portCity, { seed: 4242 });
    const geom1 = buildCityGeometry(plan, portCity);
    const geom2 = buildCityGeometry(plan, portCity);

    // Deterministic output
    expect(geom1.wallPolygon.length).toBe(geom2.wallPolygon.length);
    expect(geom1.wards.length).toBe(geom2.wards.length);

    // Walls, towers, plaza, packed buildings, suburbs, farms, trees
    expect(geom1.wallPolygon.length).toBeGreaterThanOrEqual(12);
    expect(geom1.wallChains.length).toBeGreaterThan(0);
    expect(geom1.towers.length).toBeGreaterThan(4);
    expect(geom1.plazaPolygon.length).toBe(5);
    expect(geom1.wards.length).toBeGreaterThan(10);
    const totalPackedBuildings = geom1.wards.reduce((s, wd) => s + wd.buildings.length, 0);
    expect(totalPackedBuildings).toBeGreaterThan(40);
    expect(geom1.suburbBuildings.length).toBeGreaterThan(0);
    expect(geom1.farmFields.length).toBeGreaterThan(0);
    expect(geom1.treeClusters.length).toBeGreaterThan(0);

    // Coastal bay + 5 concentric shoreline contours + piers + no building inside water
    expect(geom1.waterPolygon).not.toBeNull();
    expect(geom1.waterContours).toHaveLength(5);
    expect(geom1.piers.length).toBeGreaterThan(0);
    for (const wd of geom1.wards) {
      for (const b of wd.buildings) {
        const cx = (b[0].x + b[1].x + b[2].x + b[3].x) * 0.25;
        const cy = (b[0].y + b[1].y + b[2].y + b[3].y) * 0.25;
        expect(pointInPolygon({ x: cx, y: cy }, geom1.waterPolygon!)).toBe(false);
      }
    }
  });
});

describe('Separated Terrain & Biome System', () => {
  it('generateWorld populates map.terrains separately and never outputs legacy terrain IDs in map.biomes', () => {
    const map = generateWorld(70, 50, 25, DEFAULT_GEOGRAPHY_CONFIG);
    expect(map.terrains).toHaveLength(70 * 50);

    const legacyTerrainBiomes = new Set([
      BiomeId.HILLS,
      BiomeId.HIGHLAND,
      BiomeId.MOUNTAIN,
      BiomeId.SNOW_PEAK,
    ]);
    for (let i = 0; i < map.biomes.length; i++) {
      expect(legacyTerrainBiomes.has(map.biomes[i])).toBe(false);
    }

    expect(map.terrains.some((t) => t === TerrainId.MOUNTAIN || t === TerrainId.HIGH_PEAK)).toBe(
      true
    );
    expect(map.terrains.some((t) => t === TerrainId.PLAINS)).toBe(true);
  });

  it('combines arbitrary terrain and biome for pathfinding avoidance and movement cost', () => {
    const w = 14;
    const h = 12;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.terrains = new Array<number>(w * h).fill(TerrainId.PLAINS);
    map.biomes = new Array<number>(w * h).fill(BiomeId.DESERT);
    map.elevation = new Array<number>(w * h).fill(0.14);
    map.features = new Array<string>(w * h).fill('');
    map.roads = [];

    // Paint a vertical mountain range with DESERT biome (desert mountains!)
    for (let r = 0; r <= 8; r++) {
      const idx = hexIndex(6, r, w);
      map.terrains[idx] = TerrainId.MOUNTAIN;
      map.elevation[idx] = 0.68;
    }

    const res = findHexPath(map, { q: 2, r: 3 }, { q: 10, r: 3 }, 'land');
    expect(res.reachable).toBe(true);
    const crossedMountain = res.hexes.some(
      (pt) => map.terrains[hexIndex(pt.q, pt.r, w)] === TerrainId.MOUNTAIN
    );
    expect(crossedMountain).toBe(false);

    expect(getCombinedMoveCost(TerrainId.HILLS, BiomeId.TAIGA)).toBeGreaterThan(
      getCombinedMoveCost(TerrainId.PLAINS, BiomeId.GRASSLAND)
    );
    expect(getCombinedMoveCost(TerrainId.MOUNTAIN, BiomeId.DESERT)).toBeGreaterThanOrEqual(18);
  });

  it('recomputeBiomesFromCurrentMap preserves sculpted terrains while updating land biomes from climate', () => {
    const w = 24;
    const h = 18;
    const map = generateWorld(w, h, 25, DEFAULT_GEOGRAPHY_CONFIG);
    map.terrains = new Array<number>(w * h).fill(TerrainId.PLAINS);
    map.biomes = new Array<number>(w * h).fill(BiomeId.GRASSLAND);
    map.elevation = new Array<number>(w * h).fill(0.14);
    map.features = new Array<string>(w * h).fill('');

    // Ocean edge on left, mountain ridge down middle, hills on east
    for (let r = 0; r < h; r++) {
      for (let q = 0; q < 4; q++) {
        const idx = hexIndex(q, r, w);
        map.terrains[idx] = TerrainId.DEEP_OCEAN;
        map.biomes[idx] = BiomeId.DEEP_OCEAN;
        map.elevation[idx] = -0.65;
      }
      const mIdx = hexIndex(10, r, w);
      map.terrains[mIdx] = TerrainId.MOUNTAIN;
      const hIdx = hexIndex(16, r, w);
      map.terrains[hIdx] = TerrainId.HILLS;
    }

    const updated = recomputeBiomesFromCurrentMap({
      ...map,
      geography: { ...map.geography, latNorth: 75, latSouth: 20, windMode: 'west' },
    });

    // Sculpted terrains are preserved
    expect(updated.terrains[hexIndex(0, 5, w)]).toBe(TerrainId.DEEP_OCEAN);
    expect(updated.terrains[hexIndex(10, 5, w)]).toBe(TerrainId.MOUNTAIN);
    expect(updated.terrains[hexIndex(16, 5, w)]).toBe(TerrainId.HILLS);
    // Mountain biomes were classified by climate rather than stuck as legacy BiomeId.MOUNTAIN
    expect(updated.biomes[hexIndex(10, 5, w)]).not.toBe(BiomeId.MOUNTAIN);
    expect(updated.biomes[hexIndex(16, 5, w)]).not.toBe(BiomeId.HILLS);
  });

  it('autoSuggestGoodsForCity combines mountain/hill minerals from terrains with forest goods from biomes', () => {
    const w = 15;
    const h = 15;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.terrains = new Array<number>(w * h).fill(TerrainId.PLAINS);
    map.biomes = new Array<number>(w * h).fill(BiomeId.GRASSLAND);
    map.features = new Array<string>(w * h).fill('');
    map.rivers = [];

    // Ring around (7, 7): put HILLS/MOUNTAIN terrains covered by DECIDUOUS_FOREST biome!
    for (let dq = -2; dq <= 2; dq++) {
      for (let dr = -2; dr <= 2; dr++) {
        const q = 7 + dq;
        const r = 7 + dr;
        const idx = hexIndex(q, r, w);
        map.terrains[idx] = TerrainId.HILLS;
        map.biomes[idx] = BiomeId.DECIDUOUS_FOREST;
      }
    }

    const goods = autoSuggestGoodsForCity(map, 7, 7);
    expect(goods.producedGoods).toContain('timber');
    expect(goods.producedGoods).toContain('iron');
  });

  it('round-trips terrains in JSON serialization, migrates legacy JSON, and preserves terrains on resize', () => {
    const map = generateWorld(40, 30, 20, DEFAULT_GEOGRAPHY_CONFIG);
    const json = serializeMapToJson(map);
    const restored = parseMapFromJson(json);
    expect(restored.terrains).toEqual(map.terrains);

    // Legacy JSON without `terrains` containing MOUNTAIN / SNOW_PEAK / HILLS / HIGHLAND in `biomes`
    const legacyObj = JSON.parse(json) as Record<string, unknown>;
    delete legacyObj.terrains;
    const legacyBiomes = new Array<number>(40 * 30).fill(BiomeId.GRASSLAND);
    legacyBiomes[hexIndex(2, 2, 40)] = BiomeId.SNOW_PEAK;
    legacyBiomes[hexIndex(3, 2, 40)] = BiomeId.MOUNTAIN;
    legacyBiomes[hexIndex(4, 2, 40)] = BiomeId.HIGHLAND;
    legacyBiomes[hexIndex(5, 2, 40)] = BiomeId.HILLS;
    legacyBiomes[hexIndex(6, 2, 40)] = BiomeId.DEEP_OCEAN;
    legacyObj.biomes = legacyBiomes;

    const migrated = parseMapFromJson(JSON.stringify(legacyObj));
    expect(migrated.terrains[hexIndex(2, 2, 40)]).toBe(TerrainId.HIGH_PEAK);
    expect(migrated.biomes[hexIndex(2, 2, 40)]).toBe(BiomeId.SNOW_ICE);
    expect(migrated.terrains[hexIndex(3, 2, 40)]).toBe(TerrainId.MOUNTAIN);
    expect(migrated.biomes[hexIndex(3, 2, 40)]).not.toBe(BiomeId.MOUNTAIN);
    expect(migrated.terrains[hexIndex(4, 2, 40)]).toBe(TerrainId.HIGHLAND);
    expect(migrated.terrains[hexIndex(5, 2, 40)]).toBe(TerrainId.HILLS);
    expect(migrated.terrains[hexIndex(6, 2, 40)]).toBe(TerrainId.DEEP_OCEAN);

    const resized = resizeMap(restored, 45, 35, 25, 'preserve');
    expect(resized.terrains).toHaveLength(45 * 35);
    expect(resized.terrains[hexIndex(10, 10, 45)]).toBe(restored.terrains[hexIndex(10, 10, 40)]);
  });
});

describe('Real Earth, Lat/Lon, Sea Level & 2D Wind System', () => {
  it('generates Real Earth continents, Himalayas mountains, and open Pacific Ocean', () => {
    const cfg = {
      ...DEFAULT_GEOGRAPHY_CONFIG,
      landmassType: 'real_earth' as const,
      latNorth: 85,
      latSouth: -85,
      lonWest: -180,
      lonEast: 180,
      seaLevel: 0,
      windMode: 'latitude' as const,
    };
    const w = 120;
    const h = 68;
    const map = generateWorld(w, h, 300, cfg, 'Earth');

    const findHexForCoord = (targetLat: number, targetLon: number) => {
      const r = Math.max(
        0,
        Math.min(
          h - 1,
          Math.round(((targetLat - cfg.latNorth) / (cfg.latSouth - cfg.latNorth)) * (h - 1))
        )
      );
      const q = Math.max(
        0,
        Math.min(
          w - 1,
          Math.round(((targetLon - cfg.lonWest) / (cfg.lonEast - cfg.lonWest)) * (w - 1))
        )
      );
      return hexIndex(q, r, w);
    };

    // Sahara / Central Africa -> Land
    expect(isWaterBiome(map.biomes[findHexForCoord(20, 15)])).toBe(false);
    // Central US -> Land
    expect(isWaterBiome(map.biomes[findHexForCoord(40, -95)])).toBe(false);
    // Central Australia -> Land
    expect(isWaterBiome(map.biomes[findHexForCoord(-25, 134)])).toBe(false);
    // Himalayas -> Elevated Mountain/Highland/High Peak
    const himalayasIdx = findHexForCoord(29, 86);
    expect(isWaterBiome(map.biomes[himalayasIdx])).toBe(false);
    expect(map.elevation[himalayasIdx]).toBeGreaterThan(0.4);
    // Central Pacific -> Ocean
    expect(isWaterBiome(map.biomes[findHexForCoord(0, -150)])).toBe(true);
  });

  it('supports regional lat/lon cropping and realistic sea-level land flooding/exposure', () => {
    const baseCfg = {
      ...DEFAULT_GEOGRAPHY_CONFIG,
      landmassType: 'real_earth' as const,
      latNorth: 28,
      latSouth: -12,
      lonWest: 90,
      lonEast: 142,
      windMode: 'monsoon' as const,
    };
    const countLand = (seaLevel: number) => {
      const m = generateWorld(60, 40, 80, { ...baseCfg, seaLevel });
      return m.biomes.filter((b) => !isWaterBiome(b)).length;
    };

    const iceAgeLand = countLand(-0.15);
    const presentLand = countLand(0);
    const floodedLand = countLand(0.15);

    expect(presentLand).toBeGreaterThan(50);
    expect(iceAgeLand).toBeGreaterThan(presentLand);
    expect(presentLand).toBeGreaterThan(floodedLand);
  });

  it('simulates 2D wind vectors (N/S/Monsoon/Earth) and north/south orographic rain shadows', () => {
    const w = 14;
    const h = 34;
    const elev = new Array<number>(w * h).fill(0.14);
    // East-West mountain range across rows 15..17, ocean along south rows 26..33
    for (let q = 0; q < w; q++) {
      for (let r = 26; r < h; r++) elev[hexIndex(q, r, w)] = -0.45;
      for (let r = 15; r <= 17; r++) elev[hexIndex(q, r, w)] = 0.78;
    }

    const southWind = simulateClimate(elev, w, h, {
      ...DEFAULT_GEOGRAPHY_CONFIG,
      windMode: 'south',
      latNorth: 40,
      latSouth: 20,
    });
    // Wind blowing S->N makes south slope (r=18) wetter than northern leeward shadow (r=12)
    expect(southWind.moisture[hexIndex(7, 18, w)]).toBeGreaterThan(
      southWind.moisture[hexIndex(7, 12, w)] + 0.1
    );

    // Reverse: ocean on north (r=0..7) and wind blowing N->S ('north')
    const elevN = new Array<number>(w * h).fill(0.14);
    for (let q = 0; q < w; q++) {
      for (let r = 0; r <= 7; r++) elevN[hexIndex(q, r, w)] = -0.45;
      for (let r = 15; r <= 17; r++) elevN[hexIndex(q, r, w)] = 0.78;
    }
    const northWind = simulateClimate(elevN, w, h, {
      ...DEFAULT_GEOGRAPHY_CONFIG,
      windMode: 'north',
      latNorth: 40,
      latSouth: 20,
    });
    expect(northWind.moisture[hexIndex(7, 14, w)]).toBeGreaterThan(
      northWind.moisture[hexIndex(7, 20, w)] + 0.1
    );

    // Check Coriolis Earth wind directions & Monsoon override
    expect(getPrevailingWindVector(15, 0, 'latitude').dx).toBeLessThan(0); // Trade wind E->W
    expect(getPrevailingWindVector(45, 0, 'latitude').dx).toBeGreaterThan(0); // Westerly W->E
    expect(getPrevailingWindVector(15, 100, 'monsoon').dx).toBeGreaterThan(0); // SE Asia monsoon
    expect(getColLongitude(0, 10, DEFAULT_GEOGRAPHY_CONFIG)).toBe(-180);
    expect(getRowLatitude(0, 10, DEFAULT_GEOGRAPHY_CONFIG)).toBe(74);
  });

  it('round-trips lonWest, lonEast, real_earth, and 2D windMode in serialization', () => {
    const map = generateWorld(30, 20, 100, {
      ...DEFAULT_GEOGRAPHY_CONFIG,
      landmassType: 'real_earth',
      latNorth: 55,
      latSouth: 15,
      lonWest: 72,
      lonEast: 148,
      windMode: 'southwest',
    });
    const json = serializeMapToJson(map);
    const restored = parseMapFromJson(json);
    expect(restored.geography.landmassType).toBe('real_earth');
    expect(restored.geography.lonWest).toBe(72);
    expect(restored.geography.lonEast).toBe(148);
    expect(restored.geography.windMode).toBe('southwest');

    const legacy = JSON.parse(json) as { geography: Record<string, unknown> };
    delete legacy.geography.lonWest;
    delete legacy.geography.lonEast;
    const migrated = parseMapFromJson(JSON.stringify(legacy));
    expect(migrated.geography.lonWest).toBe(-180);
    expect(migrated.geography.lonEast).toBe(180);
  });
});

describe('Ocean Currents & Freshwater Lake System', () => {
  it('computes warm western-boundary and cold eastern-boundary currents, excludes lakes/land, and traces streams', () => {
    const w = 40;
    const h = 24;
    const elev = new Array<number>(w * h).fill(-0.5);
    const terrains = new Array<number>(w * h).fill(TerrainId.DEEP_OCEAN);

    // Mid-latitude continent from q=12..26, r=4..18
    for (let r = 4; r <= 18; r++) {
      for (let q = 12; q <= 26; q++) {
        const idx = hexIndex(q, r, w);
        elev[idx] = 0.2;
        terrains[idx] = TerrainId.PLAINS;
      }
    }
    // Freshwater lake inside the continent
    const lakeIdx = hexIndex(18, 10, w);
    elev[lakeIdx] = -0.06;
    terrains[lakeIdx] = TerrainId.LAKE;

    const cfg = {
      ...DEFAULT_GEOGRAPHY_CONFIG,
      latNorth: 55,
      latSouth: 15,
      windMode: 'latitude' as const,
      oceanCurrents: true,
    };

    const currents = computeOceanCurrents(w, h, elev, cfg, terrains);
    // East of continent (western ocean boundary, q=28, r=10) -> Warm current
    const warmIdx = hexIndex(28, 10, w);
    expect(getCurrentKind(currents.thermal[warmIdx], currents.speed[warmIdx])).toBe('warm');
    // West of continent (eastern ocean boundary, q=10, r=10) -> Cold current
    const coldIdx = hexIndex(10, 10, w);
    expect(getCurrentKind(currents.thermal[coldIdx], currents.speed[coldIdx])).toBe('cold');
    // Land and Lake hexes have zero ocean current
    expect(currents.speed[hexIndex(15, 10, w)]).toBe(0);
    expect(currents.speed[lakeIdx]).toBe(0);

    const streams = traceOceanCurrentStreams(w, h, elev, currents, terrains);
    expect(streams.length).toBeGreaterThan(0);
    expect(streams.some((s) => s.kind === 'warm')).toBe(true);
    expect(streams.some((s) => s.kind === 'cold')).toBe(true);
  });

  it('ocean currents warm & humidify western-boundary coasts relative to cold eastern-boundary coasts', () => {
    const w = 40;
    const h = 24;
    const elev = new Array<number>(w * h).fill(-0.5);
    const terrains = new Array<number>(w * h).fill(TerrainId.DEEP_OCEAN);
    for (let r = 4; r <= 18; r++) {
      for (let q = 12; q <= 26; q++) {
        const idx = hexIndex(q, r, w);
        elev[idx] = 0.14;
        terrains[idx] = TerrainId.PLAINS;
      }
    }
    const cfg = {
      ...DEFAULT_GEOGRAPHY_CONFIG,
      latNorth: 55,
      latSouth: 15,
      windMode: 'latitude' as const,
      oceanCurrents: true,
    };
    const withCur = simulateClimate(elev, w, h, cfg, terrains);
    const noCur = simulateClimate(elev, w, h, { ...cfg, oceanCurrents: false }, terrains);

    const eastCoast = hexIndex(26, 10, w); // adjacent to warm western-boundary current
    const westCoast = hexIndex(12, 10, w); // adjacent to cold eastern-boundary current
    expect(withCur.temperature[eastCoast]).toBeGreaterThan(withCur.temperature[westCoast] + 2);
    expect(withCur.temperature[eastCoast]).toBeGreaterThan(noCur.temperature[eastCoast] + 1);
    expect(withCur.temperature[westCoast]).toBeLessThan(noCur.temperature[westCoast] - 1);
    expect(withCur.moisture[eastCoast]).toBeGreaterThan(noCur.moisture[eastCoast]);
    expect(withCur.moisture[westCoast]).toBeLessThan(noCur.moisture[westCoast]);
  });

  it('preserves freshwater lakes across syncShallowWater, climate recompute, goods suggestion, and JSON serialization', () => {
    const w = 16;
    const h = 14;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.terrains = new Array<number>(w * h).fill(TerrainId.PLAINS);
    map.biomes = new Array<number>(w * h).fill(BiomeId.GRASSLAND);
    map.elevation = new Array<number>(w * h).fill(0.14);
    map.features = new Array<string>(w * h).fill('');
    map.rivers = [];

    const lakeCoords = [
      { q: 7, r: 7 },
      { q: 8, r: 7 },
    ];
    for (const c of lakeCoords) {
      const idx = hexIndex(c.q, c.r, w);
      map.terrains[idx] = TerrainId.LAKE;
      map.biomes[idx] = BiomeId.LAKE;
      map.elevation[idx] = -0.06;
    }

    const synced = syncShallowWater(map);
    expect(synced.biomes[hexIndex(7, 7, w)]).toBe(BiomeId.LAKE);
    expect(synced.terrains[hexIndex(7, 7, w)]).toBe(TerrainId.LAKE);

    const recomputed = recomputeBiomesFromCurrentMap(map);
    expect(recomputed.biomes[hexIndex(7, 7, w)]).toBe(BiomeId.LAKE);
    expect(recomputed.terrains[hexIndex(7, 7, w)]).toBe(TerrainId.LAKE);

    const goods = autoSuggestGoodsForCity(map, 6, 7);
    expect(goods.producedGoods).toContain('fish');
    expect(goods.producedGoods).toContain('wheat');

    const json = serializeMapToJson(map);
    const restored = parseMapFromJson(json);
    expect(restored.terrains[hexIndex(7, 7, w)]).toBe(TerrainId.LAKE);
    expect(restored.biomes[hexIndex(7, 7, w)]).toBe(BiomeId.LAKE);
    expect(restored.geography.oceanCurrents).toBe(true);

    // Legacy JSON without `terrains` carrying BiomeId.LAKE
    const legacy = JSON.parse(json) as Record<string, unknown>;
    delete legacy.terrains;
    const migrated = parseMapFromJson(JSON.stringify(legacy));
    expect(migrated.terrains[hexIndex(7, 7, w)]).toBe(TerrainId.LAKE);
  });
});

describe('Deep Customization, Adjustable Ocean Currents & Continuous Elevation', () => {
  it('supports custom terrains, custom features, built-in overrides, pathfinding costs, and JSON round-trip', () => {
    const w = 14;
    const h = 10;
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.terrains = new Array<number>(w * h).fill(TerrainId.PLAINS);
    map.biomes = new Array<number>(w * h).fill(BiomeId.GRASSLAND);
    map.elevation = new Array<number>(w * h).fill(0.15);
    map.features = new Array<string>(w * h).fill('');
    map.roads = [];

    map.customTerrains = [
      {
        id: 100,
        nameTh: 'แคนยอนมรกต',
        color: '#4d7c0f',
        isWater: false,
        defaultElevation: 0.42,
        minElevation: 0.25,
        maxElevation: 0.55,
        moveCost: 9.5,
        reliefStyle: 'canyon',
      },
    ];
    map.terrainOverrides = {
      [TerrainId.PLAINS]: { nameTh: 'ทุ่งหญ้าหลวง', moveCost: 0.8 },
    };
    map.customFeatures = [
      {
        id: 'feat_portal',
        nameTh: 'ประตูมิติ',
        color: '#a855f7',
        placement: 'any',
        moveCostDelta: -0.4,
        goodsBonus: ['gems'],
        visualStyle: 'custom',
        symbol: '🌀',
      },
    ];
    map.featureOverrides = {
      oasis: { nameTh: 'บ่อน้ำศักดิ์สิทธิ์', moveCostDelta: -0.3 },
    };

    const allT = getAllTerrains(map.customTerrains, map.terrainOverrides);
    expect(allT.some((t) => t.id === 100 && t.nameTh === 'แคนยอนมรกต')).toBe(true);
    expect(getTerrainMetaWithCustom(TerrainId.PLAINS, map.customTerrains, map.terrainOverrides).nameTh).toBe(
      'ทุ่งหญ้าหลวง'
    );

    const allF = getAllFeatures(map.customFeatures, map.featureOverrides);
    expect(allF.some((f) => f.id === 'feat_portal')).toBe(true);
    expect(getFeatureMetaWithCustom('oasis', map.customFeatures, map.featureOverrides)?.nameTh).toBe(
      'บ่อน้ำศักดิ์สิทธิ์'
    );

    const midIdx = hexIndex(5, 5, w);
    map.terrains[midIdx] = 100;
    map.features[hexIndex(6, 5, w)] = 'feat_portal';
    expect(getHexTerrain(map, midIdx)).toBe(100);

    const path = findHexPath(map, { q: 4, r: 5 }, { q: 7, r: 5 }, 'land');
    expect(path.reachable).toBe(true);
    expect(path.weightedCost).toBeGreaterThan(2);

    const json = serializeMapToJson(map);
    const restored = parseMapFromJson(json);
    expect(restored.customTerrains).toHaveLength(1);
    expect(restored.customFeatures).toHaveLength(1);
    expect(restored.terrainOverrides?.[TerrainId.PLAINS]?.nameTh).toBe('ทุ่งหญ้าหลวง');
    expect(restored.featureOverrides?.oasis?.nameTh).toBe('บ่อน้ำศักดิ์สิทธิ์');
    expect(restored.terrains[midIdx]).toBe(100);
  });

  it('supports adjustable currentStrength, coriolisDirection polarity flip, and manual currents', () => {
    const w = 36;
    const h = 22;
    const elev = new Array<number>(w * h).fill(-0.5);
    const terrains = new Array<number>(w * h).fill(TerrainId.DEEP_OCEAN);
    for (let r = 4; r <= 16; r++) {
      for (let q = 11; q <= 23; q++) {
        const idx = hexIndex(q, r, w);
        elev[idx] = 0.14;
        terrains[idx] = TerrainId.PLAINS;
      }
    }

    const baseCfg = {
      ...DEFAULT_GEOGRAPHY_CONFIG,
      latNorth: 50,
      latSouth: 15,
      windMode: 'latitude' as const,
      oceanCurrents: true,
      currentStrength: 1.0,
      coriolisDirection: 'normal' as const,
    };

    const normalField = computeOceanCurrents(w, h, elev, baseCfg, terrains);
    const reversedField = computeOceanCurrents(
      w,
      h,
      elev,
      { ...baseCfg, coriolisDirection: 'reversed' },
      terrains
    );
    const strongField = computeOceanCurrents(
      w,
      h,
      elev,
      { ...baseCfg, currentStrength: 1.8 },
      terrains
    );

    const eastSeaIdx = hexIndex(25, 10, w);
    const westSeaIdx = hexIndex(9, 10, w);
    // Reversing Coriolis reverses the western/eastern boundary thermal contrast
    expect(normalField.thermal[eastSeaIdx]).toBeGreaterThan(normalField.thermal[westSeaIdx]);
    expect(reversedField.thermal[westSeaIdx]).toBeGreaterThan(reversedField.thermal[eastSeaIdx]);
    expect(strongField.speed[eastSeaIdx]).toBeGreaterThanOrEqual(normalField.speed[eastSeaIdx]);

    // Manual warm current warms an otherwise cold sea cell and its nearby coast
    const manualWarm = [
      {
        id: 'cur_test',
        kind: 'warm' as const,
        strength: 1.8,
        points: [
          { q: 10, r: 9 },
          { q: 10, r: 11 },
        ],
      },
    ];
    const withManualField = computeOceanCurrents(w, h, elev, baseCfg, terrains, manualWarm);
    expect(withManualField.thermal[hexIndex(10, 10, w)]).toBeGreaterThan(
      normalField.thermal[hexIndex(10, 10, w)]
    );

    const baseClimate = simulateClimate(elev, w, h, baseCfg, terrains);
    const manualClimate = simulateClimate(elev, w, h, baseCfg, terrains, manualWarm);
    expect(manualClimate.temperature[hexIndex(11, 10, w)]).toBeGreaterThan(
      baseClimate.temperature[hexIndex(11, 10, w)]
    );
  });

  it('computes monotonic meter elevation, smooth sculpting transitions, and preserves continuous bands', () => {
    expect(elevationToMeters(-1.0)).toBe(-6000);
    expect(elevationToMeters(0)).toBe(0);
    expect(elevationToMeters(1.0)).toBe(8850);
    expect(formatElevationMeters(1.0)).toBe('+8,850 ม.');
    expect(formatElevationMeters(-1.0)).toBe('-6,000 ม.');

    let prevM = -Infinity;
    for (let e = -1.0; e <= 1.0001; e += 0.1) {
      const m = elevationToMeters(e);
      expect(m).toBeGreaterThan(prevM);
      prevM = m;
    }

    const w = 15;
    const h = 15;
    const elev = new Array<number>(w * h).fill(0.14);
    const terrains = new Array<number>(w * h).fill(TerrainId.PLAINS);

    // Raise repeatedly at center -> radial falloff & smooth landform tier transition
    let curE = elev;
    let curT = terrains;
    for (let step = 0; step < 6; step++) {
      const res = sculptElevationBrush(curE, curT, w, h, 7, 7, 2, 'raise', 0.1);
      curE = res.nextElevation;
      curT = res.nextTerrains;
    }
    const centerIdx = hexIndex(7, 7, w);
    const edgeIdx = hexIndex(9, 7, w);
    expect(curE[centerIdx]).toBeGreaterThan(curE[edgeIdx]);
    expect(curE[centerIdx]).toBeGreaterThan(0.55);
    expect(curT[centerIdx]).toBeGreaterThanOrEqual(TerrainId.HIGHLAND);

    // Verify recomputeBiomesFromCurrentMap keeps distinct sculpted elevations inside mountain bands
    const map = generateWorld(w, h, 20, DEFAULT_GEOGRAPHY_CONFIG);
    map.terrains = new Array<number>(w * h).fill(TerrainId.PLAINS);
    map.biomes = new Array<number>(w * h).fill(BiomeId.GRASSLAND);
    map.elevation = new Array<number>(w * h).fill(0.14);
    const idxA = hexIndex(5, 5, w);
    const idxB = hexIndex(6, 5, w);
    map.terrains[idxA] = TerrainId.MOUNTAIN;
    map.elevation[idxA] = 0.60;
    map.terrains[idxB] = TerrainId.MOUNTAIN;
    map.elevation[idxB] = 0.76;

    const recomputed = recomputeBiomesFromCurrentMap(map);
    expect(recomputed.elevation[idxA]).toBeCloseTo(0.60, 2);
    expect(recomputed.elevation[idxB]).toBeCloseTo(0.76, 2);
  });
});

describe('Map Themes, Curved Labels, Diplomacy/Wiki, Heightmap & Sub-Map', () => {
  it('converts RGBA heightmap pixel buffers into sea and continents with rivers and climate', () => {
    const imgW = 32;
    const imgH = 24;
    const rgba = new Uint8ClampedArray(imgW * imgH * 4);
    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        const i = (y * imgW + x) * 4;
        const inCenter = x >= 8 && x <= 23 && y >= 6 && y <= 17;
        const val = inCenter ? (x === 15 && y === 11 ? 245 : 175) : 30;
        rgba[i] = val;
        rgba[i + 1] = val;
        rgba[i + 2] = val;
        rgba[i + 3] = 255;
      }
    }

    const hmMap = convertHeightmapPixelsToMap(rgba, imgW, imgH, 32, 24, 25, {
      name: 'จากภาพ Heightmap',
      seaLevelThreshold: 0.38,
    });

    expect(hmMap.name).toBe('จากภาพ Heightmap');
    const centerTerrain = hmMap.terrains[hexIndex(15, 11, 32)];
    const cornerTerrain = hmMap.terrains[hexIndex(1, 1, 32)];
    expect(centerTerrain).toBeGreaterThanOrEqual(TerrainId.MOUNTAIN);
    expect(cornerTerrain).toBe(TerrainId.DEEP_OCEAN);
  });

  it('extracts a 2x regional sub-map preserving coastline, scaled cities, labels, and diplomacy', () => {
    const src = generateWorld(40, 30, 30, DEFAULT_GEOGRAPHY_CONFIG, 'โลกต้นฉบับ');
    src.diplomacy = upsertDiplomaticRelation([], src.kingdoms[0].id, src.kingdoms[1].id, 'ally', 'พันธมิตรเก่า');
    src.labels.push({
      id: 'lbl_arc',
      text: 'มหาสมุทรตะวันตก',
      q: 15,
      r: 12,
      size: 'lg',
      style: 'water',
      rotationDeg: -15,
      curveAmount: 0.4,
    });

    const sub = extractRegionalSubMap(
      src,
      { minQ: 10, maxQ: 24, minR: 8, maxR: 18 },
      2,
      'แคว้นกลาง'
    );

    expect(sub.name).toBe('แคว้นกลาง');
    expect(sub.width).toBe(30);
    expect(sub.height).toBe(22);
    expect(sub.hexSizeKm).toBe(15);
    expect(sub.diplomacy?.length).toBe(1);
    expect(sub.labels.some((l) => l.text === 'มหาสมุทรตะวันตก' && l.curveAmount === 0.4)).toBe(true);
  });

  it('manages diplomacy relations, @mentions, Lorebook export, and full JSON serialization round-trip', () => {
    const map = generateWorld(30, 22, 25, DEFAULT_GEOGRAPHY_CONFIG, 'อาณาจักรนิยาย');
    map.mapTheme = 'parchment';
    const k1 = map.kingdoms[0];
    const k2 = map.kingdoms[1];
    map.diplomacy = upsertDiplomaticRelation([], k1.id, k2.id, 'war', 'สงครามชิงแร่เหล็ก');
    expect(getDiplomaticRelation(map.diplomacy, k2.id, k1.id)?.status).toBe('war');

    const city = map.cities[0];
    map.campaigns = [
      {
        id: 'cp1',
        name: 'ทัพหลวงสายฟ้า',
        kingdomId: k1.id,
        status: 'active',
        points: [
          { q: 5, r: 5 },
          { q: 8, r: 6 },
        ],
      },
    ];
    map.wikiEntries = [
      {
        id: 'w1',
        title: 'พงศาวดารปฐมบท',
        category: 'history',
        summary: 'จุดเริ่มต้นของสงคราม',
        content: city ? `กษัตริย์เดินทัพออกจาก @${city.name} เพื่อรบกับ @${k2.name}` : `รบกับ @${k2.name}`,
        tags: ['สงคราม', 'ประวัติศาสตร์'],
        linkedCoord: city ? { q: city.q, r: city.r } : { q: 4, r: 4 },
        updatedAt: new Date().toISOString(),
      },
    ];
    map.bookmarks = [{ id: 'bm1', name: 'เมืองหลวง', q: 5, r: 5, zoom: 1.2 }];
    map.labels.push({
      id: 'lbl_1',
      text: 'เทือกเขาเหนือ',
      q: 10,
      r: 4,
      size: 'md',
      style: 'mountain',
      rotationDeg: 10,
      curveAmount: -0.3,
    });

    if (city) {
      const tokens = parseWikiMentions(map.wikiEntries[0].content, map);
      expect(tokens.some((t) => t.mention?.kind === 'city' && t.mention.coord?.q === city.q)).toBe(true);
    }

    const md = exportLorebookMarkdown(map);
    expect(md).toContain('อาณาจักรนิยาย');
    expect(md).toContain('สงครามชิงแร่เหล็ก');
    expect(md).toContain('ทัพหลวงสายฟ้า');
    expect(md).toContain('พงศาวดารปฐมบท');

    const html = exportLorebookHtml(map);
    expect(html).toContain('<html');
    expect(html).toContain('พงศาวดารปฐมบท');

    const restored = parseMapFromJson(serializeMapToJson(map));
    expect(restored.mapTheme).toBe('parchment');
    expect(restored.diplomacy?.length).toBe(1);
    expect(restored.campaigns?.[0].name).toBe('ทัพหลวงสายฟ้า');
    expect(restored.wikiEntries?.[0].title).toBe('พงศาวดารปฐมบท');
    expect(restored.bookmarks?.[0].name).toBe('เมืองหลวง');
    expect(restored.labels.find((l) => l.id === 'lbl_1')?.curveAmount).toBe(-0.3);
  });
});
