import { DEFAULT_CULTURES, DEFAULT_GOODS, DEFAULT_KINGDOMS, DEFAULT_RELIGIONS } from '../data/goods';
import {
  BiomeId,
  City,
  CustomCategoryType,
  HexMapData,
  Kingdom,
  TerrainId,
  WorldTimeline,
} from '../types/map';
import { findHexPath, getHexTerrain, hexIndex, isWaterBiome } from './hexMath';
import {
  generateCulturesFromCities,
  generateReligionsFromCities,
  generateTerritoriesFromCities,
} from './politics';
import { createSnapshotFromMap } from './timeline';
import { DEFAULT_GEOGRAPHY_CONFIG, generateWorld } from './worldGenerator';

const AUTOSAVE_KEY = 'hex-worldmaker:autosave:v1';
const LIBRARY_KEY = 'hex-worldmaker:library:v1';

export interface SavedMapSummary {
  id: string;
  name: string;
  updatedAt: string;
  width: number;
  height: number;
  hexSizeKm: number;
  cityCount: number;
}

/** Serialize HexMapData cleanly to formatted JSON. */
export function serializeMapToJson(map: HexMapData): string {
  return JSON.stringify(
    {
      ...map,
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

/** Parse and validate a JSON string into a safe HexMapData object (with legacy v1 migration). */
export function parseMapFromJson(raw: string): HexMapData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('ไฟล์ JSON ไม่ถูกต้อง (ไม่สามารถอ่านโครงสร้าง JSON ได้)');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('รูปแบบข้อมูลแผนที่ไม่ถูกต้อง');
  }

  const obj = parsed as Record<string, unknown>;
  const width = Number(obj.width);
  const height = Number(obj.height);
  const hexSizeKm = Number(obj.hexSizeKm);

  if (!Number.isInteger(width) || width < 10 || width > 400) {
    throw new Error('ความกว้างแผนที่ (width) ต้องอยู่ระหว่าง 10 ถึง 400 ช่อง');
  }
  if (!Number.isInteger(height) || height < 10 || height > 400) {
    throw new Error('ความสูงแผนที่ (height) ต้องอยู่ระหว่าง 10 ถึง 400 ช่อง');
  }
  if (!Number.isFinite(hexSizeKm) || hexSizeKm <= 0) {
    throw new Error('ขนาดระยะทางต่อช่อง (hexSizeKm) ต้องมากกว่า 0 กม.');
  }

  const expectedLen = width * height;
  if (!Array.isArray(obj.biomes) || obj.biomes.length !== expectedLen) {
    throw new Error(`ข้อมูลไบโอมไม่ตรงกับขนาดแผนที่ (${width} × ${height})`);
  }

  const ensureFloatArray = (arr: unknown, fallbackVal: number): number[] => {
    if (Array.isArray(arr) && arr.length === expectedLen) {
      return arr.map((v) => (Number.isFinite(Number(v)) ? Number(v) : fallbackVal));
    }
    return new Array<number>(expectedLen).fill(fallbackVal);
  };

  const ensureStringArray = (arr: unknown, fallbackVal = ''): string[] => {
    if (Array.isArray(arr) && arr.length === expectedLen) {
      return arr.map((v) => (typeof v === 'string' ? v : fallbackVal));
    }
    return new Array<string>(expectedLen).fill(fallbackVal);
  };

  const geoRaw = (obj.geography && typeof obj.geography === 'object' ? obj.geography : {}) as Record<
    string,
    unknown
  >;

  const religionList =
    Array.isArray(obj.religionList) && obj.religionList.length > 0
      ? (obj.religionList as HexMapData['religionList'])
      : DEFAULT_RELIGIONS.map((r) => ({ ...r }));

  const cultureList =
    Array.isArray(obj.cultureList) && obj.cultureList.length > 0
      ? (obj.cultureList as HexMapData['cultureList'])
      : DEFAULT_CULTURES.map((c) => ({ ...c }));

  const rawKingdoms =
    Array.isArray(obj.kingdoms) && obj.kingdoms.length > 0
      ? (obj.kingdoms as Partial<Kingdom>[])
      : DEFAULT_KINGDOMS;
  const kingdoms: Kingdom[] = rawKingdoms.map((k, idx) => ({
    id: k.id || `kingdom_${idx + 1}`,
    name: k.name || `อาณาจักร ${idx + 1}`,
    color: k.color || '#f59e0b',
    government: k.government || 'monarchy',
    description: k.description,
    details: k.details,
  }));

  const rawCities = Array.isArray(obj.cities) ? (obj.cities as Partial<City>[]) : [];
  const cities: City[] = rawCities.map((c, idx) => ({
    id: c.id || `city_${idx + 1}`,
    name: c.name || `เมือง ${idx + 1}`,
    q: Number(c.q) || 0,
    r: Number(c.r) || 0,
    tier: c.tier || 'town',
    population: Number(c.population) || 5000,
    kingdomId: c.kingdomId || kingdoms[0].id,
    religionId: c.religionId || religionList[0].id,
    cultureId: c.cultureId || cultureList[0].id,
    producedGoods: Array.isArray(c.producedGoods) ? c.producedGoods : [],
    demandedGoods: Array.isArray(c.demandedGoods) ? c.demandedGoods : [],
    notes: c.notes || '',
    plan: c.plan,
    profile: c.profile,
  }));

  const biomes = obj.biomes.map((b) =>
    Number.isInteger(Number(b)) ? Number(b) : BiomeId.DEEP_OCEAN
  );
  const customBiomes = Array.isArray(obj.customBiomes)
    ? (obj.customBiomes as HexMapData['customBiomes'])
    : [];
  const elevation = ensureFloatArray(obj.elevation, 0);
  const temperature = ensureFloatArray(obj.temperature, 18);
  const moisture = ensureFloatArray(obj.moisture, 0.45);

  let terrains: number[];
  if (Array.isArray(obj.terrains) && obj.terrains.length === expectedLen) {
    terrains = obj.terrains.map((t) => {
      const n = Number(t);
      return Number.isInteger(n) && ((n >= TerrainId.DEEP_OCEAN && n <= TerrainId.LAKE) || n >= 100)
        ? n
        : TerrainId.DEEP_OCEAN;
    });
  } else {
    // Legacy JSON migration: extract physical landforms into terrains & replace legacy landform biomes with pure land biomes
    terrains = new Array<number>(expectedLen);
    for (let i = 0; i < expectedLen; i++) {
      const b = biomes[i];
      if (b === BiomeId.DEEP_OCEAN) {
        terrains[i] = TerrainId.DEEP_OCEAN;
      } else if (b === BiomeId.SHALLOW_WATER) {
        terrains[i] = TerrainId.SHALLOW_WATER;
      } else if (b === BiomeId.LAKE) {
        terrains[i] = TerrainId.LAKE;
      } else if (isWaterBiome(b, customBiomes)) {
        terrains[i] = TerrainId.SHALLOW_WATER;
      } else if (b === BiomeId.SNOW_PEAK) {
        terrains[i] = TerrainId.HIGH_PEAK;
        biomes[i] = BiomeId.SNOW_ICE;
      } else if (b === BiomeId.MOUNTAIN) {
        terrains[i] = TerrainId.MOUNTAIN;
        biomes[i] = temperature[i] <= 0 ? BiomeId.SNOW_ICE : BiomeId.TUNDRA;
      } else if (b === BiomeId.HIGHLAND) {
        terrains[i] = TerrainId.HIGHLAND;
        biomes[i] = moisture[i] < 0.32 ? BiomeId.SAVANNA : BiomeId.GRASSLAND;
      } else if (b === BiomeId.HILLS) {
        terrains[i] = TerrainId.HILLS;
        biomes[i] = BiomeId.GRASSLAND;
      } else {
        terrains[i] = TerrainId.PLAINS;
      }
    }
  }
  const customPoiTypes = Array.isArray(obj.customPoiTypes)
    ? (obj.customPoiTypes as HexMapData['customPoiTypes'])
    : [];
  const roads = Array.isArray(obj.roads) ? (obj.roads as HexMapData['roads']) : [];
  const features = ensureStringArray(obj.features, '');

  const hasTerritories = Array.isArray(obj.territories) && obj.territories.length === expectedLen;
  const territories = hasTerritories
    ? ensureStringArray(obj.territories, '')
    : generateTerritoriesFromCities({
        width,
        height,
        biomes,
        customBiomes,
        features,
        cities,
        roads,
      });

  const hasReligions = Array.isArray(obj.religions) && obj.religions.length === expectedLen;
  const religions = hasReligions
    ? ensureStringArray(obj.religions, '')
    : generateReligionsFromCities({
        width,
        height,
        biomes,
        customBiomes,
        cities,
        roads,
      });

  const hasCultures = Array.isArray(obj.cultures) && obj.cultures.length === expectedLen;
  const cultures = hasCultures
    ? ensureStringArray(obj.cultures, '')
    : generateCulturesFromCities({
        width,
        height,
        biomes,
        customBiomes,
        features,
        cities,
        roads,
      });

  return {
    version: 1,
    id: typeof obj.id === 'string' && obj.id ? obj.id : `map_${Date.now().toString(36)}`,
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name : 'แผนที่ที่นำเข้า',
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
    width,
    height,
    hexSizeKm,
    geography: {
      ...DEFAULT_GEOGRAPHY_CONFIG,
      ...geoRaw,
      seed: Number(geoRaw.seed) || DEFAULT_GEOGRAPHY_CONFIG.seed,
      seaLevel: Number.isFinite(Number(geoRaw.seaLevel)) ? Number(geoRaw.seaLevel) : 0,
      mountainScale: Number(geoRaw.mountainScale) || 1,
      latNorth: Number.isFinite(Number(geoRaw.latNorth)) ? Number(geoRaw.latNorth) : 74,
      latSouth: Number.isFinite(Number(geoRaw.latSouth)) ? Number(geoRaw.latSouth) : -12,
      lonWest: Number.isFinite(Number(geoRaw.lonWest)) ? Number(geoRaw.lonWest) : -180,
      lonEast: Number.isFinite(Number(geoRaw.lonEast)) ? Number(geoRaw.lonEast) : 180,
      moistureScale: Number(geoRaw.moistureScale) || 1,
      riverThreshold: Number(geoRaw.riverThreshold) || 20,
      oceanCurrents: geoRaw.oceanCurrents !== false,
      currentStrength: Number.isFinite(Number(geoRaw.currentStrength))
        ? Math.max(0.2, Math.min(2.0, Number(geoRaw.currentStrength)))
        : 1.0,
      coriolisDirection: geoRaw.coriolisDirection === 'reversed' ? 'reversed' : 'normal',
      tectonicPlates: Number.isFinite(Number(geoRaw.tectonicPlates))
        ? Math.max(4, Math.min(16, Math.round(Number(geoRaw.tectonicPlates))))
        : 8,
      tectonicStrength: Number.isFinite(Number(geoRaw.tectonicStrength))
        ? Math.max(0, Math.min(1.5, Number(geoRaw.tectonicStrength)))
        : 0,
    },
    terrains,
    biomes,
    elevation,
    temperature,
    moisture,
    features,
    territories,
    religions,
    cultures,
    rivers: Array.isArray(obj.rivers) ? (obj.rivers as HexMapData['rivers']) : [],
    cities,
    kingdoms,
    religionList,
    cultureList,
    goods:
      Array.isArray(obj.goods) && obj.goods.length > 0
        ? (obj.goods as HexMapData['goods'])
        : DEFAULT_GOODS.map((g) => ({ ...g })),
    customBiomes,
    customTerrains: Array.isArray(obj.customTerrains)
      ? (obj.customTerrains as HexMapData['customTerrains'])
      : [],
    customFeatures: Array.isArray(obj.customFeatures)
      ? (obj.customFeatures as HexMapData['customFeatures'])
      : [],
    terrainOverrides:
      obj.terrainOverrides && typeof obj.terrainOverrides === 'object'
        ? (obj.terrainOverrides as HexMapData['terrainOverrides'])
        : {},
    featureOverrides:
      obj.featureOverrides && typeof obj.featureOverrides === 'object'
        ? (obj.featureOverrides as HexMapData['featureOverrides'])
        : {},
    manualCurrents: Array.isArray(obj.manualCurrents)
      ? (obj.manualCurrents as HexMapData['manualCurrents'])
      : [],
    customPoiTypes,
    customGovernmentTypes: Array.isArray(obj.customGovernmentTypes)
      ? (obj.customGovernmentTypes as CustomCategoryType[])
      : [],
    customReligionTypes: Array.isArray(obj.customReligionTypes)
      ? (obj.customReligionTypes as CustomCategoryType[])
      : [],
    customCultureTypes: Array.isArray(obj.customCultureTypes)
      ? (obj.customCultureTypes as CustomCategoryType[])
      : [],
    timeline:
      obj.timeline &&
      typeof obj.timeline === 'object' &&
      Array.isArray((obj.timeline as Partial<WorldTimeline>).eras)
        ? {
            calendarUnit:
              typeof (obj.timeline as Partial<WorldTimeline>).calendarUnit === 'string'
                ? (obj.timeline as WorldTimeline).calendarUnit
                : 'ปีศักราช',
            activeEraId:
              typeof (obj.timeline as Partial<WorldTimeline>).activeEraId === 'string'
                ? (obj.timeline as WorldTimeline).activeEraId
                : (obj.timeline as WorldTimeline).eras[0]?.id ?? 'era_1',
            eras: (obj.timeline as WorldTimeline).eras,
            events: Array.isArray((obj.timeline as Partial<WorldTimeline>).events)
              ? (obj.timeline as WorldTimeline).events
              : [],
          }
        : undefined,
    mapTheme:
      obj.mapTheme === 'parchment' || obj.mapTheme === 'atlas' || obj.mapTheme === 'dark'
        ? obj.mapTheme
        : 'standard',
    diplomacy: Array.isArray(obj.diplomacy)
      ? (obj.diplomacy as HexMapData['diplomacy'])
      : [],
    campaigns: Array.isArray(obj.campaigns)
      ? (obj.campaigns as HexMapData['campaigns'])
      : [],
    wikiEntries: Array.isArray(obj.wikiEntries)
      ? (obj.wikiEntries as HexMapData['wikiEntries'])
      : [],
    bookmarks: Array.isArray(obj.bookmarks)
      ? (obj.bookmarks as HexMapData['bookmarks'])
      : [],
    calendar:
      obj.calendar &&
      typeof obj.calendar === 'object' &&
      Array.isArray((obj.calendar as HexMapData['calendar'])?.months)
        ? (obj.calendar as HexMapData['calendar'])
        : undefined,
    customTectonicPlates: Array.isArray(obj.customTectonicPlates)
      ? (obj.customTectonicPlates as Record<string, unknown>[])
          .filter((p) => p && typeof p === 'object')
          .map((p, idx) => ({
            id: typeof p.id === 'string' && p.id ? p.id : `plate_${idx + 1}`,
            name: typeof p.name === 'string' && p.name.trim() ? p.name : `แผ่น ${idx + 1}`,
            color: typeof p.color === 'string' && p.color ? p.color : '#f59e0b',
            centerQ: Math.max(0, Math.min(width - 1, Number(p.centerQ) || 0)),
            centerR: Math.max(0, Math.min(height - 1, Number(p.centerR) || 0)),
            vx: Number.isFinite(Number(p.vx)) ? Number(p.vx) : 0.4,
            vy: Number.isFinite(Number(p.vy)) ? Number(p.vy) : 0.2,
            isOceanic: Boolean(p.isOceanic),
          }))
      : undefined,
    roads,
    tradeRoutes: Array.isArray(obj.tradeRoutes) ? (obj.tradeRoutes as HexMapData['tradeRoutes']) : [],
    pois: Array.isArray(obj.pois) ? (obj.pois as HexMapData['pois']) : [],
    labels: Array.isArray(obj.labels) ? (obj.labels as HexMapData['labels']) : [],
  };
}

/** Resize map dimensions and/or real-world hex scale (km/hex). */
export function resizeMap(
  map: HexMapData,
  newWidth: number,
  newHeight: number,
  newHexSizeKm: number,
  mode: 'preserve' | 'regenerate'
): HexMapData {
  const safeW = Math.max(20, Math.min(300, Math.round(newWidth)));
  const safeH = Math.max(20, Math.min(240, Math.round(newHeight)));
  const safeKm = Math.max(0.5, Math.min(500, Number(newHexSizeKm)));

  if (mode === 'regenerate') {
    const fresh = generateWorld(safeW, safeH, safeKm, map.geography, map.name);
    return {
      ...fresh,
      id: map.id,
      goods: map.goods,
      kingdoms: map.kingdoms,
      religionList: map.religionList,
      cultureList: map.cultureList,
      customBiomes: map.customBiomes,
      customTerrains: map.customTerrains ?? [],
      customFeatures: map.customFeatures ?? [],
      terrainOverrides: map.terrainOverrides ?? {},
      featureOverrides: map.featureOverrides ?? {},
      manualCurrents: [],
      customPoiTypes: map.customPoiTypes,
      customGovernmentTypes: map.customGovernmentTypes ?? [],
      customReligionTypes: map.customReligionTypes ?? [],
      customCultureTypes: map.customCultureTypes ?? [],
      mapTheme: map.mapTheme ?? 'standard',
      diplomacy: map.diplomacy ?? [],
      campaigns: [],
      wikiEntries: map.wikiEntries ?? [],
      bookmarks: [],
      calendar: map.calendar,
      customTectonicPlates: map.customTectonicPlates?.map((p) => ({
        ...p,
        centerQ: Math.max(0, Math.min(safeW - 1, Math.round((p.centerQ / Math.max(1, map.width)) * safeW))),
        centerR: Math.max(0, Math.min(safeH - 1, Math.round((p.centerR / Math.max(1, map.height)) * safeH))),
      })),
    };
  }

  const total = safeW * safeH;
  const terrains = new Array<number>(total).fill(TerrainId.DEEP_OCEAN);
  const biomes = new Array<number>(total).fill(BiomeId.DEEP_OCEAN);
  const elevation = new Array<number>(total).fill(-0.6);
  const temperature = new Array<number>(total).fill(15);
  const moisture = new Array<number>(total).fill(0.5);
  const features = new Array<string>(total).fill('');
  const territories = new Array<string>(total).fill('');
  const religions = new Array<string>(total).fill('');
  const cultures = new Array<string>(total).fill('');

  const copyW = Math.min(map.width, safeW);
  const copyH = Math.min(map.height, safeH);

  for (let r = 0; r < copyH; r++) {
    for (let q = 0; q < copyW; q++) {
      const oldIdx = hexIndex(q, r, map.width);
      const newIdx = hexIndex(q, r, safeW);
      terrains[newIdx] = getHexTerrain(map, oldIdx);
      biomes[newIdx] = map.biomes[oldIdx];
      elevation[newIdx] = map.elevation[oldIdx];
      temperature[newIdx] = map.temperature[oldIdx];
      moisture[newIdx] = map.moisture[oldIdx];
      features[newIdx] = map.features?.[oldIdx] ?? '';
      territories[newIdx] = map.territories?.[oldIdx] ?? '';
      religions[newIdx] = map.religions?.[oldIdx] ?? '';
      cultures[newIdx] = map.cultures?.[oldIdx] ?? '';
    }
  }

  const inNewBounds = (q: number, r: number) => q >= 0 && q < safeW && r >= 0 && r < safeH;

  const cities = map.cities.filter((c) => inNewBounds(c.q, c.r));
  const cityIds = new Set(cities.map((c) => c.id));
  const rivers = map.rivers
    .map((riv) => ({
      ...riv,
      points: riv.points.filter((p) => inNewBounds(p.q, p.r)),
    }))
    .filter((riv) => riv.points.length >= 2);
  const roads = map.roads
    .map((rd) => ({
      ...rd,
      hexes: rd.hexes.filter((h) => inNewBounds(h.q, h.r)),
    }))
    .filter((rd) => rd.hexes.length >= 2);
  const pois = map.pois.filter((p) => inNewBounds(p.q, p.r));
  const labels = map.labels.filter((l) => inNewBounds(l.q, l.r));
  const manualCurrents = (map.manualCurrents ?? [])
    .map((cur) => ({
      ...cur,
      points: cur.points.filter((p) => inNewBounds(p.q, p.r)),
    }))
    .filter((cur) => cur.points.length >= 2);
  const campaigns = (map.campaigns ?? [])
    .map((cp) => ({
      ...cp,
      points: cp.points.filter((p) => inNewBounds(p.q, p.r)),
      battles: (cp.battles ?? []).filter((b) => inNewBounds(b.q, b.r)),
    }))
    .filter((cp) => cp.points.length >= 2);
  const bookmarks = (map.bookmarks ?? []).filter((bm) => inNewBounds(bm.q, bm.r));
  const customTectonicPlates = map.customTectonicPlates?.map((p) => ({
    ...p,
    centerQ: Math.max(0, Math.min(safeW - 1, Math.round((p.centerQ / Math.max(1, map.width)) * safeW))),
    centerR: Math.max(0, Math.min(safeH - 1, Math.round((p.centerR / Math.max(1, map.height)) * safeH))),
  }));

  const nextMap: HexMapData = {
    ...map,
    updatedAt: new Date().toISOString(),
    width: safeW,
    height: safeH,
    hexSizeKm: safeKm,
    terrains,
    biomes,
    elevation,
    temperature,
    moisture,
    features,
    territories,
    religions,
    cultures,
    rivers,
    manualCurrents,
    campaigns,
    bookmarks,
    customTectonicPlates,
    cities,
    roads,
    pois,
    labels,
    tradeRoutes: [],
  };

  nextMap.tradeRoutes = map.tradeRoutes
    .filter((tr) => cityIds.has(tr.fromCityId) && cityIds.has(tr.toCityId))
    .map((tr) => {
      const from = cities.find((c) => c.id === tr.fromCityId)!;
      const to = cities.find((c) => c.id === tr.toCityId)!;
      const res = findHexPath(nextMap, from, to, tr.mode);
      const hexes = res.reachable ? res.hexes : tr.hexes.filter((h) => inNewBounds(h.q, h.r));
      const distanceKm = Math.round(Math.max(0, (hexes.length - 1) * safeKm));
      const speed = tr.mode === 'sea' ? 140 : tr.mode === 'mixed' ? 55 : 25;
      return {
        ...tr,
        hexes,
        distanceKm,
        travelDays: Number(Math.max(0.5, distanceKm / speed).toFixed(1)),
      };
    });

  if (nextMap.timeline) {
    const activeEra =
      nextMap.timeline.eras.find((e) => e.id === nextMap.timeline!.activeEraId) ??
      nextMap.timeline.eras[0];
    if (activeEra) {
      nextMap.timeline = {
        ...nextMap.timeline,
        activeEraId: activeEra.id,
        eras: [
          createSnapshotFromMap(
            nextMap,
            activeEra.id,
            activeEra.name,
            activeEra.year,
            activeEra.summary
          ),
        ],
      };
    }
  }

  return nextMap;
}

export function saveAutosave(map: HexMapData): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, serializeMapToJson(map));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadAutosave(): HexMapData | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    return parseMapFromJson(raw);
  } catch {
    return null;
  }
}

export function listSavedMaps(): SavedMapSummary[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const dict = JSON.parse(raw) as Record<string, string>;
    const list: SavedMapSummary[] = [];
    for (const [id, jsonStr] of Object.entries(dict)) {
      try {
        const m = parseMapFromJson(jsonStr);
        list.push({
          id,
          name: m.name,
          updatedAt: m.updatedAt,
          width: m.width,
          height: m.height,
          hexSizeKm: m.hexSizeKm,
          cityCount: m.cities.length,
        });
      } catch {
        // skip corrupted item
      }
    }
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveMapToLibrary(map: HexMapData): void {
  const raw = localStorage.getItem(LIBRARY_KEY);
  const dict: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  dict[map.id] = serializeMapToJson(map);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(dict));
}

export function loadMapFromLibrary(id: string): HexMapData | null {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return null;
    const dict = JSON.parse(raw) as Record<string, string>;
    if (!dict[id]) return null;
    return parseMapFromJson(dict[id]);
  } catch {
    return null;
  }
}

export function deleteMapFromLibrary(id: string): void {
  const raw = localStorage.getItem(LIBRARY_KEY);
  if (!raw) return;
  const dict = JSON.parse(raw) as Record<string, string>;
  delete dict[id];
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(dict));
}
