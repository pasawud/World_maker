import { useCallback, useEffect, useRef, useState } from 'react';
import { getBiomeMetaWithCustom } from '../data/biomes';
import { getFeatureMeta } from '../data/features';
import { CITY_TIERS } from '../data/goods';
import { autoDetectCliffsFromElevation, syncShallowWater } from '../engine/cliffs';
import {
  findHexPath,
  floodFillHexes,
  getHexBrush,
  hexDistance,
  hexIndex,
  isCoastalHex,
  isWaterBiome,
  isWaterHex,
} from '../engine/hexMath';
import { generateRiversAuto } from '../engine/hydrology';
import {
  generateReligionsFromCities,
  generateTerritoriesFromCities,
} from '../engine/politics';
import { loadAutosave, resizeMap, saveAutosave } from '../engine/serialization';
import {
  autoSuggestGoodsForCity,
  DEFAULT_GEOGRAPHY_CONFIG,
  generateWorld,
  recomputeBiomesFromCurrentMap,
} from '../engine/worldGenerator';
import {
  BiomeId,
  City,
  ClimateOverlay,
  CustomBiome,
  CustomPoiType,
  GeographyConfig,
  HexCoord,
  HexMapData,
  LabelStyle,
  LayerVisibility,
  PoiType,
  RoadType,
  ToolMode,
  TradeMode,
  TravelSpeedId,
} from '../types/map';

const MAX_HISTORY = 40;

export function useMapEditor() {
  const [map, setMap] = useState<HexMapData>(() => {
    const saved = loadAutosave();
    if (saved) return saved;
    return generateWorld(120, 80, 30, DEFAULT_GEOGRAPHY_CONFIG, 'แผนที่โลกใหม่');
  });

  const [undoStack, setUndoStack] = useState<HexMapData[]>([]);
  const [redoStack, setRedoStack] = useState<HexMapData[]>([]);

  const [tool, setTool] = useState<ToolMode>('view');
  const [activeBiome, setActiveBiome] = useState<number>(BiomeId.GRASSLAND);
  // null = paint biome; '' = erase special feature; non-empty = paint special feature id
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [autoShallowWater, setAutoShallowWater] = useState<boolean>(true);
  const [terrainSubTool, setTerrainSubTool] = useState<'brush' | 'fill' | 'eyedropper'>('brush');
  const [riverSubTool, setRiverSubTool] = useState<'draw' | 'erase'>('draw');
  const [roadType, setRoadType] = useState<RoadType>('stone');
  const [roadSubTool, setRoadSubTool] = useState<'auto' | 'manual' | 'erase'>('auto');
  const [tradeMode, setTradeMode] = useState<TradeMode>('mixed');
  const [poiSubTool, setPoiSubTool] = useState<'poi' | 'label'>('poi');
  const [poiType, setPoiType] = useState<PoiType>('ruins');
  const [labelStyle, setLabelStyle] = useState<LabelStyle>('region');
  const [climateOverlay, setClimateOverlay] = useState<ClimateOverlay>('none');
  const [measureMode, setMeasureMode] = useState<'straight' | 'terrain'>('terrain');
  const [travelSpeed, setTravelSpeed] = useState<TravelSpeedId>('caravan');
  const [showMinimap, setShowMinimap] = useState<boolean>(true);

  const [activeKingdomId, setActiveKingdomId] = useState<string>(
    () => map.kingdoms[0]?.id ?? 'north'
  );
  const [territorySubTool, setTerritorySubTool] = useState<'brush' | 'fill' | 'erase'>('brush');
  const [activeReligionId, setActiveReligionId] = useState<string>(
    () => map.religionList[0]?.id ?? 'solaris'
  );
  const [religionSubTool, setReligionSubTool] = useState<'brush' | 'fill' | 'erase'>('brush');

  const [layers, setLayers] = useState<LayerVisibility>({
    grid: false,
    cityNames: true,
    labels: true,
    territories: true,
    borders: true,
    religions: false,
    features: true,
    routes: true,
    rivers: true,
    pois: true,
  });

  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [tradeStartCityId, setTradeStartCityId] = useState<string | null>(null);
  const [measurePoints, setMeasurePoints] = useState<HexCoord[]>([]);
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving'>('saved');

  const [renderVersion, setRenderVersion] = useState(0);
  const dirtyHexQueue = useRef<HexCoord[] | 'all'>([]);

  const markAllDirty = useCallback(() => {
    dirtyHexQueue.current = 'all';
    setRenderVersion((v) => v + 1);
  }, []);

  const markHexesDirty = useCallback((hexes: HexCoord[]) => {
    if (dirtyHexQueue.current !== 'all') {
      dirtyHexQueue.current.push(...hexes);
    }
    setRenderVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    setAutosaveStatus('saving');
    const timer = window.setTimeout(() => {
      saveAutosave(map);
      setAutosaveStatus('saved');
    }, 550);
    return () => window.clearTimeout(timer);
  }, [map]);

  const commitMapChange = useCallback(
    (updater: (prev: HexMapData) => HexMapData, dirtyHexes?: HexCoord[]) => {
      setMap((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        setUndoStack((u) => [...u.slice(-(MAX_HISTORY - 1)), prev]);
        setRedoStack([]);
        return next;
      });
      if (dirtyHexes) markHexesDirty(dirtyHexes);
      else markAllDirty();
    },
    [markAllDirty, markHexesDirty]
  );

  const strokeSnapshotRef = useRef<HexMapData | null>(null);

  const beginStroke = useCallback(() => {
    setMap((cur) => {
      strokeSnapshotRef.current = {
        ...cur,
        biomes: [...cur.biomes],
        elevation: [...cur.elevation],
        features: [...cur.features],
        territories: [...cur.territories],
        religions: [...cur.religions],
      };
      return cur;
    });
  }, []);

  const paintTerrainAt = useCallback(
    (q: number, r: number): { warning?: string } => {
      let warning: string | undefined;
      setMap((prev) => {
        const brush = getHexBrush(q, r, brushSize - 1, prev.width, prev.height);
        if (brush.length === 0) return prev;

        // Feature painting or erasing mode
        if (activeFeature !== null) {
          const nextFeatures = [...prev.features];
          const featMeta = activeFeature ? getFeatureMeta(activeFeature) : null;
          let changed = false;
          let cliffAffected = false;
          const changedHexes: HexCoord[] = [];
          let skippedCount = 0;

          for (const h of brush) {
            const idx = hexIndex(h.q, h.r, prev.width);
            if (activeFeature === '') {
              if (nextFeatures[idx] !== '') {
                if (nextFeatures[idx] === 'cliff') cliffAffected = true;
                nextFeatures[idx] = '';
                changed = true;
                changedHexes.push(h);
              }
              continue;
            }
            if (featMeta) {
              const water = isWaterHex(prev, h.q, h.r);
              if (featMeta.placement === 'water' && !water) {
                skippedCount++;
                continue;
              }
              if (featMeta.placement === 'land' && water) {
                skippedCount++;
                continue;
              }
              if (featMeta.placement === 'coast' && !isCoastalHex(prev, h.q, h.r)) {
                skippedCount++;
                continue;
              }
            }
            if (nextFeatures[idx] !== activeFeature) {
              if (nextFeatures[idx] === 'cliff' || activeFeature === 'cliff') {
                cliffAffected = true;
              }
              nextFeatures[idx] = activeFeature;
              changed = true;
              changedHexes.push(h);
            }
          }

          if (!changed && skippedCount > 0 && featMeta) {
            warning =
              featMeta.placement === 'water'
                ? `"${featMeta.nameTh}" วางได้เฉพาะบนช่องน้ำ/ทะเล`
                : featMeta.placement === 'coast'
                ? `"${featMeta.nameTh}" วางได้เฉพาะพื้นที่ชายฝั่งติดทะเล`
                : `"${featMeta.nameTh}" วางได้เฉพาะบนพื้นดิน`;
            return prev;
          }
          if (!changed) return prev;
          if (autoShallowWater && cliffAffected) {
            const synced = syncShallowWater(
              {
                width: prev.width,
                height: prev.height,
                biomes: prev.biomes,
                elevation: prev.elevation,
                features: nextFeatures,
                customBiomes: prev.customBiomes,
              },
              { changedHexes }
            );
            markHexesDirty([...changedHexes, ...synced.changedHexes]);
            return {
              ...prev,
              biomes: synced.biomes,
              elevation: synced.elevation,
              features: synced.features,
            };
          }
          markHexesDirty(changedHexes);
          return { ...prev, features: nextFeatures };
        }

        // Normal biome painting
        const meta = getBiomeMetaWithCustom(activeBiome, prev.customBiomes);
        const nextBiomes = [...prev.biomes];
        const nextElev = [...prev.elevation];
        const nextTerr = [...prev.territories];
        const nextRel = [...prev.religions];
        const nextFeat = [...prev.features];
        let changed = false;
        const changedHexes: HexCoord[] = [];
        for (const h of brush) {
          const idx = hexIndex(h.q, h.r, prev.width);
          if (nextBiomes[idx] !== activeBiome) {
            nextBiomes[idx] = activeBiome;
            nextElev[idx] = meta.defaultElevation;
            if (meta.isWater) {
              nextTerr[idx] = '';
              nextRel[idx] = '';
            }
            // Clear incompatible feature if land<->water flipped
            if (nextFeat[idx]) {
              const fm = getFeatureMeta(nextFeat[idx]);
              if (fm && ((fm.placement === 'water') !== meta.isWater)) {
                nextFeat[idx] = '';
              }
            }
            changed = true;
            changedHexes.push(h);
          }
        }
        if (!changed) return prev;
        if (autoShallowWater) {
          const preserveIndices =
            activeBiome === BiomeId.SHALLOW_WATER
              ? new Set(changedHexes.map((h) => hexIndex(h.q, h.r, prev.width)))
              : undefined;
          const synced = syncShallowWater(
            {
              width: prev.width,
              height: prev.height,
              biomes: nextBiomes,
              elevation: nextElev,
              features: nextFeat,
              customBiomes: prev.customBiomes,
            },
            { changedHexes, preserveIndices }
          );
          markHexesDirty([...changedHexes, ...synced.changedHexes]);
          return {
            ...prev,
            biomes: synced.biomes,
            elevation: synced.elevation,
            territories: nextTerr,
            religions: nextRel,
            features: synced.features,
          };
        }
        markHexesDirty(changedHexes);
        return {
          ...prev,
          biomes: nextBiomes,
          elevation: nextElev,
          territories: nextTerr,
          religions: nextRel,
          features: nextFeat,
        };
      });
      return warning ? { warning } : {};
    },
    [activeBiome, activeFeature, autoShallowWater, brushSize, markHexesDirty]
  );

  const paintTerritoryAt = useCallback(
    (q: number, r: number, erase = false) => {
      setMap((prev) => {
        const brush = getHexBrush(q, r, brushSize - 1, prev.width, prev.height);
        const targetId = erase ? '' : activeKingdomId;
        const nextTerr = [...prev.territories];
        let changed = false;
        const changedHexes: HexCoord[] = [];
        for (const h of brush) {
          const idx = hexIndex(h.q, h.r, prev.width);
          if (!erase && isWaterBiome(prev.biomes[idx], prev.customBiomes)) continue;
          if (nextTerr[idx] !== targetId) {
            nextTerr[idx] = targetId;
            changed = true;
            changedHexes.push(h);
          }
        }
        if (!changed) return prev;
        markHexesDirty(changedHexes);
        return { ...prev, territories: nextTerr };
      });
    },
    [activeKingdomId, brushSize, markHexesDirty]
  );

  const paintReligionAt = useCallback(
    (q: number, r: number, erase = false) => {
      setMap((prev) => {
        const brush = getHexBrush(q, r, brushSize - 1, prev.width, prev.height);
        const targetId = erase ? '' : activeReligionId;
        const nextRel = [...prev.religions];
        let changed = false;
        const changedHexes: HexCoord[] = [];
        for (const h of brush) {
          const idx = hexIndex(h.q, h.r, prev.width);
          if (!erase && isWaterBiome(prev.biomes[idx], prev.customBiomes)) continue;
          if (nextRel[idx] !== targetId) {
            nextRel[idx] = targetId;
            changed = true;
            changedHexes.push(h);
          }
        }
        if (!changed) return prev;
        markHexesDirty(changedHexes);
        return { ...prev, religions: nextRel };
      });
    },
    [activeReligionId, brushSize, markHexesDirty]
  );

  const endStroke = useCallback(() => {
    const snap = strokeSnapshotRef.current;
    strokeSnapshotRef.current = null;
    if (!snap) return;
    setMap((cur) => {
      const diff =
        cur.biomes.some((v, i) => v !== snap.biomes[i]) ||
        cur.features.some((v, i) => v !== snap.features[i]) ||
        cur.territories.some((v, i) => v !== snap.territories[i]) ||
        cur.religions.some((v, i) => v !== snap.religions[i]);
      if (diff) {
        setUndoStack((u) => [...u.slice(-(MAX_HISTORY - 1)), snap]);
        setRedoStack([]);
      }
      return cur;
    });
  }, []);

  const floodFillAt = useCallback(
    (q: number, r: number) => {
      commitMapChange((prev) => {
        const targets = floodFillHexes(prev.biomes, prev.width, prev.height, q, r);
        if (targets.length === 0) return prev;
        const meta = getBiomeMetaWithCustom(activeBiome, prev.customBiomes);
        const nextBiomes = [...prev.biomes];
        const nextElev = [...prev.elevation];
        const nextTerr = [...prev.territories];
        const nextRel = [...prev.religions];
        const nextFeat = [...prev.features];
        for (const h of targets) {
          const idx = hexIndex(h.q, h.r, prev.width);
          nextBiomes[idx] = activeBiome;
          nextElev[idx] = meta.defaultElevation;
          if (meta.isWater) {
            nextTerr[idx] = '';
            nextRel[idx] = '';
          }
          if (nextFeat[idx]) {
            const fm = getFeatureMeta(nextFeat[idx]);
            if (fm && (fm.placement === 'water') !== meta.isWater) {
              nextFeat[idx] = '';
            }
          }
        }
        if (autoShallowWater) {
          const preserveIndices =
            activeBiome === BiomeId.SHALLOW_WATER
              ? new Set(targets.map((h) => hexIndex(h.q, h.r, prev.width)))
              : undefined;
          const synced = syncShallowWater(
            {
              width: prev.width,
              height: prev.height,
              biomes: nextBiomes,
              elevation: nextElev,
              features: nextFeat,
              customBiomes: prev.customBiomes,
            },
            { changedHexes: targets, preserveIndices }
          );
          markHexesDirty([...targets, ...synced.changedHexes]);
          return {
            ...prev,
            biomes: synced.biomes,
            elevation: synced.elevation,
            territories: nextTerr,
            religions: nextRel,
            features: synced.features,
          };
        }
        markHexesDirty(targets);
        return {
          ...prev,
          biomes: nextBiomes,
          elevation: nextElev,
          territories: nextTerr,
          religions: nextRel,
          features: nextFeat,
        };
      });
    },
    [activeBiome, autoShallowWater, commitMapChange, markHexesDirty]
  );

  const floodFillTerritoryAt = useCallback(
    (q: number, r: number, erase = false) => {
      commitMapChange((prev) => {
        if (!erase && isWaterHex(prev, q, r)) return prev;
        const targets = floodFillHexes(
          prev.territories,
          prev.width,
          prev.height,
          q,
          r,
          8000,
          (idx) => !isWaterBiome(prev.biomes[idx], prev.customBiomes)
        );
        if (targets.length === 0) return prev;
        const nextTerr = [...prev.territories];
        const val = erase ? '' : activeKingdomId;
        for (const h of targets) {
          nextTerr[hexIndex(h.q, h.r, prev.width)] = val;
        }
        markHexesDirty(targets);
        return { ...prev, territories: nextTerr };
      });
    },
    [activeKingdomId, commitMapChange, markHexesDirty]
  );

  const floodFillReligionAt = useCallback(
    (q: number, r: number, erase = false) => {
      commitMapChange((prev) => {
        if (!erase && isWaterHex(prev, q, r)) return prev;
        const targets = floodFillHexes(
          prev.religions,
          prev.width,
          prev.height,
          q,
          r,
          8000,
          (idx) => !isWaterBiome(prev.biomes[idx], prev.customBiomes)
        );
        if (targets.length === 0) return prev;
        const nextRel = [...prev.religions];
        const val = erase ? '' : activeReligionId;
        for (const h of targets) {
          nextRel[hexIndex(h.q, h.r, prev.width)] = val;
        }
        markHexesDirty(targets);
        return { ...prev, religions: nextRel };
      });
    },
    [activeReligionId, commitMapChange, markHexesDirty]
  );

  const undo = useCallback(() => {
    setUndoStack((u) => {
      if (u.length === 0) return u;
      const prev = u[u.length - 1];
      setMap((cur) => {
        setRedoStack((r) => [...r, cur]);
        return prev;
      });
      markAllDirty();
      return u.slice(0, -1);
    });
  }, [markAllDirty]);

  const redo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      setMap((cur) => {
        setUndoStack((u) => [...u, cur]);
        return next;
      });
      markAllDirty();
      return r.slice(0, -1);
    });
  }, [markAllDirty]);

  const toggleLayer = useCallback((key: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const placeOrSelectCityAt = useCallback(
    (q: number, r: number) => {
      const existing = map.cities.find((c) => hexDistance(c, { q, r }) <= 1);
      if (existing) {
        setSelectedCityId(existing.id);
        return;
      }
      if (isWaterHex(map, q, r)) return;

      const { producedGoods, demandedGoods } = autoSuggestGoodsForCity(map, q, r);
      const tierInfo = CITY_TIERS[1];
      const newCity: City = {
        id: `city_${Date.now().toString(36)}`,
        name: `เมืองใหม่ ${map.cities.length + 1}`,
        q,
        r,
        tier: tierInfo.id,
        population: tierInfo.defaultPop,
        kingdomId: activeKingdomId || map.kingdoms[0]?.id || 'independent',
        religionId: activeReligionId || map.religionList[0]?.id || 'solaris',
        producedGoods,
        demandedGoods,
        notes: '',
      };

      commitMapChange(
        (prev) => ({ ...prev, cities: [...prev.cities, newCity] }),
        []
      );
      setSelectedCityId(newCity.id);
    },
    [activeKingdomId, activeReligionId, commitMapChange, map]
  );

  const updateCity = useCallback(
    (cityId: string, patch: Partial<City>) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          cities: prev.cities.map((c) => (c.id === cityId ? { ...c, ...patch } : c)),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const deleteCity = useCallback(
    (cityId: string) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          cities: prev.cities.filter((c) => c.id !== cityId),
          tradeRoutes: prev.tradeRoutes.filter(
            (tr) => tr.fromCityId !== cityId && tr.toCityId !== cityId
          ),
        }),
        []
      );
      if (selectedCityId === cityId) setSelectedCityId(null);
      if (tradeStartCityId === cityId) setTradeStartCityId(null);
    },
    [commitMapChange, selectedCityId, tradeStartCityId]
  );

  const handleTradeCityClick = useCallback(
    (q: number, r: number): { error?: string } => {
      const clicked = map.cities.find((c) => hexDistance(c, { q, r }) <= 1);
      if (!clicked) return {};
      if (!tradeStartCityId) {
        setTradeStartCityId(clicked.id);
        return {};
      }
      if (tradeStartCityId === clicked.id) {
        setTradeStartCityId(null);
        return {};
      }
      const from = map.cities.find((c) => c.id === tradeStartCityId);
      if (!from) {
        setTradeStartCityId(null);
        return {};
      }
      const path = findHexPath(map, from, clicked, tradeMode);
      if (!path.reachable) {
        return {
          error:
            tradeMode === 'sea'
              ? 'เส้นทางเดินเรือต้องเชื่อมระหว่างเมืองติดทะเล/ท่าเรือเท่านั้น (ลองใช้โหมด "ผสม" สำหรับเมืองในแผ่นดิน)'
              : 'ไม่สามารถคำนวณเส้นทางระหว่างสองเมืองนี้ได้ในโหมดที่เลือก',
        };
      }
      const speed = tradeMode === 'sea' ? 140 : tradeMode === 'mixed' ? 55 : 25;
      const newRoute = {
        id: `route_${Date.now().toString(36)}`,
        fromCityId: from.id,
        toCityId: clicked.id,
        goodIds: from.producedGoods.slice(0, 2),
        mode: tradeMode,
        hexes: path.hexes,
        distanceKm: Math.round(path.distanceKm),
        travelDays: Number(Math.max(0.5, path.distanceKm / speed).toFixed(1)),
      };
      commitMapChange(
        (prev) => ({ ...prev, tradeRoutes: [...prev.tradeRoutes, newRoute] }),
        []
      );
      setTradeStartCityId(null);
      return {};
    },
    [commitMapChange, map, tradeMode, tradeStartCityId]
  );

  const runAutoRivers = useCallback(
    (useCurrentBiomes = true) => {
      commitMapChange((prev) => {
        const res = generateRiversAuto(prev, {
          threshold: prev.geography.riverThreshold,
          useCurrentBiomes,
        });
        const manualRivers = prev.rivers.filter((rv) => rv.source === 'manual');
        return {
          ...prev,
          rivers: [...manualRivers, ...res.rivers],
        };
      });
    },
    [commitMapChange]
  );

  const runAutoTerritories = useCallback(() => {
    commitMapChange((prev) => ({
      ...prev,
      territories: generateTerritoriesFromCities(prev),
    }));
  }, [commitMapChange]);

  const runAutoReligions = useCallback(() => {
    commitMapChange((prev) => ({
      ...prev,
      religions: generateReligionsFromCities(prev),
    }));
  }, [commitMapChange]);

  const runGenerateWorld = useCallback(
    (nextConfig?: Partial<GeographyConfig>) => {
      commitMapChange((prev) => {
        const cfg: GeographyConfig = {
          ...prev.geography,
          ...nextConfig,
        };
        const fresh = generateWorld(prev.width, prev.height, prev.hexSizeKm, cfg, prev.name);
        return {
          ...fresh,
          id: prev.id,
          goods: prev.goods,
          kingdoms: prev.kingdoms,
          religionList: prev.religionList,
          customBiomes: prev.customBiomes,
          customPoiTypes: prev.customPoiTypes,
        };
      });
      setSelectedCityId(null);
      setTradeStartCityId(null);
    },
    [commitMapChange]
  );

  const runRecomputeClimateBiomes = useCallback(() => {
    commitMapChange((prev) => recomputeBiomesFromCurrentMap(prev));
  }, [commitMapChange]);

  const runSyncShallowWater = useCallback(() => {
    commitMapChange((prev) => {
      const res = syncShallowWater(prev);
      if (!res.changed) return prev;
      return {
        ...prev,
        biomes: res.biomes,
        elevation: res.elevation,
        features: res.features,
      };
    });
  }, [commitMapChange]);

  const runAutoGenerateCliffs = useCallback(() => {
    commitMapChange((prev) => {
      const res = autoDetectCliffsFromElevation(prev);
      return {
        ...prev,
        biomes: res.biomes,
        elevation: res.elevation,
        features: res.features,
      };
    });
  }, [commitMapChange]);

  const applyMapResize = useCallback(
    (newW: number, newH: number, newHexKm: number, mode: 'preserve' | 'regenerate') => {
      commitMapChange((prev) => resizeMap(prev, newW, newH, newHexKm, mode));
    },
    [commitMapChange]
  );

  const loadImportedMap = useCallback(
    (imported: HexMapData) => {
      commitMapChange(() => imported);
      setSelectedCityId(null);
      setTradeStartCityId(null);
      setMeasurePoints([]);
    },
    [commitMapChange]
  );

  const clearMapEdits = useCallback(() => {
    commitMapChange((prev) => {
      const total = prev.width * prev.height;
      return {
        ...prev,
        biomes: new Array<number>(total).fill(BiomeId.DEEP_OCEAN),
        elevation: new Array<number>(total).fill(-0.65),
        features: new Array<string>(total).fill(''),
        territories: new Array<string>(total).fill(''),
        religions: new Array<string>(total).fill(''),
        rivers: [],
        cities: [],
        roads: [],
        tradeRoutes: [],
        pois: [],
        labels: [],
      };
    });
    setSelectedCityId(null);
    setTradeStartCityId(null);
    setMeasurePoints([]);
  }, [commitMapChange]);

  const addCustomBiome = useCallback(
    (biome: Omit<CustomBiome, 'id'>) => {
      const maxId = map.customBiomes.reduce((m, b) => Math.max(m, b.id), 99);
      const newBiome: CustomBiome = { ...biome, id: maxId + 1 };
      commitMapChange(
        (prev) => ({
          ...prev,
          customBiomes: [...prev.customBiomes, newBiome],
        }),
        []
      );
      setActiveBiome(newBiome.id);
      setActiveFeature(null);
      setTool('terrain');
      return newBiome;
    },
    [commitMapChange, map.customBiomes]
  );

  const deleteCustomBiome = useCallback(
    (id: number) => {
      commitMapChange((prev) => ({
        ...prev,
        customBiomes: prev.customBiomes.filter((b) => b.id !== id),
        biomes: prev.biomes.map((b) => (b === id ? BiomeId.GRASSLAND : b)),
      }));
      if (activeBiome === id) setActiveBiome(BiomeId.GRASSLAND);
    },
    [activeBiome, commitMapChange]
  );

  const addCustomPoiType = useCallback(
    (poi: Omit<CustomPoiType, 'id'>) => {
      const newPoi: CustomPoiType = {
        ...poi,
        id: `poi_custom_${Date.now().toString(36)}`,
        isCustom: true,
      };
      commitMapChange(
        (prev) => ({
          ...prev,
          customPoiTypes: [...prev.customPoiTypes, newPoi],
        }),
        []
      );
      setPoiType(newPoi.id);
      setPoiSubTool('poi');
      setTool('poi');
      return newPoi;
    },
    [commitMapChange]
  );

  const deleteCustomPoiType = useCallback(
    (id: string) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          customPoiTypes: prev.customPoiTypes.filter((p) => p.id !== id),
          pois: prev.pois.filter((p) => p.type !== id),
        }),
        []
      );
      if (poiType === id) setPoiType('ruins');
    },
    [commitMapChange, poiType]
  );

  const eraseRoadNear = useCallback(
    (q: number, r: number) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          roads: prev.roads.filter(
            (rd) => !rd.hexes.some((h) => hexDistance(h, { q, r }) <= 1)
          ),
        }),
        []
      );
    },
    [commitMapChange]
  );

  return {
    map,
    setMap,
    commitMapChange,
    undoStack,
    redoStack,
    undo,
    redo,
    tool,
    setTool,
    activeBiome,
    setActiveBiome,
    activeFeature,
    setActiveFeature,
    brushSize,
    setBrushSize,
    autoShallowWater,
    setAutoShallowWater,
    terrainSubTool,
    setTerrainSubTool,
    riverSubTool,
    setRiverSubTool,
    roadType,
    setRoadType,
    roadSubTool,
    setRoadSubTool,
    tradeMode,
    setTradeMode,
    poiSubTool,
    setPoiSubTool,
    poiType,
    setPoiType,
    labelStyle,
    setLabelStyle,
    climateOverlay,
    setClimateOverlay,
    measureMode,
    setMeasureMode,
    travelSpeed,
    setTravelSpeed,
    showMinimap,
    setShowMinimap,
    activeKingdomId,
    setActiveKingdomId,
    territorySubTool,
    setTerritorySubTool,
    activeReligionId,
    setActiveReligionId,
    religionSubTool,
    setReligionSubTool,
    layers,
    toggleLayer,
    selectedCityId,
    setSelectedCityId,
    tradeStartCityId,
    setTradeStartCityId,
    measurePoints,
    setMeasurePoints,
    autosaveStatus,
    renderVersion,
    dirtyHexQueue,
    markAllDirty,
    beginStroke,
    paintTerrainAt,
    paintTerritoryAt,
    paintReligionAt,
    endStroke,
    floodFillAt,
    floodFillTerritoryAt,
    floodFillReligionAt,
    placeOrSelectCityAt,
    updateCity,
    deleteCity,
    handleTradeCityClick,
    runAutoRivers,
    runAutoTerritories,
    runAutoReligions,
    runGenerateWorld,
    runRecomputeClimateBiomes,
    runSyncShallowWater,
    runAutoGenerateCliffs,
    applyMapResize,
    loadImportedMap,
    clearMapEdits,
    addCustomBiome,
    deleteCustomBiome,
    addCustomPoiType,
    deleteCustomPoiType,
    eraseRoadNear,
  };
}
