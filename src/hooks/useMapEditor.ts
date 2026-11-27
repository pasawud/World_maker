import { useCallback, useEffect, useRef, useState } from 'react';
import { getBiomeMetaWithCustom } from '../data/biomes';
import { getFeatureMetaWithCustom } from '../data/features';
import { CITY_TIERS } from '../data/goods';
import { getTerrainMetaWithCustom } from '../data/terrains';
import { autoDetectCliffsFromElevation, syncShallowWater } from '../engine/cliffs';
import { createDefaultCalendar } from '../engine/calendar';
import {
  applySmoothTerrainElevation,
  sculptElevationBrush,
  SculptMode,
} from '../engine/elevation';
import {
  findHexPath,
  floodFillHexes,
  getHexBrush,
  getHexTerrain,
  hexDistance,
  hexIndex,
  isCoastalHex,
  isWaterBiome,
  isWaterHex,
} from '../engine/hexMath';
import { generateRiversAuto } from '../engine/hydrology';
import {
  generateCulturesFromCities,
  generateReligionsFromCities,
  generateTerritoriesFromCities,
} from '../engine/politics';
import { loadAutosave, resizeMap, saveAutosave } from '../engine/serialization';
import {
  createInitialTimeline,
  createNewEraFromCurrent,
  saveCurrentMapIntoActiveEra,
  switchMapToEra,
} from '../engine/timeline';
import {
  applyTectonicsToCurrentMap,
  createCustomPlatesFromCurrent,
  createTectonicPreset,
  TectonicPresetId,
} from '../engine/tectonics';
import {
  autoPlaceSpecialFeatures,
  AutoFeatureOptions,
  simulateAllFromCurrentMap,
  WorldSimulationOptions,
  WorldSimulationSummary,
} from '../engine/worldSimulator';
import {
  autoSuggestGoodsForCity,
  DEFAULT_GEOGRAPHY_CONFIG,
  generateWorld,
  generateWorldFromTectonicPlates,
  recomputeBiomesFromCurrentMap,
} from '../engine/worldGenerator';
import { upsertDiplomaticRelation } from '../engine/worldbuilding';
import {
  BiomeId,
  CameraBookmark,
  City,
  ClimateOverlay,
  Culture,
  CustomBiome,
  CustomCategoryType,
  CustomPoiType,
  CustomTectonicPlate,
  CustomTerrain,
  DiplomaticRelationType,
  GeographyConfig,
  HexCoord,
  HexMapData,
  Kingdom,
  LabelSize,
  LabelStyle,
  LayerVisibility,
  MapLabel,
  MapTheme,
  ManualWindKind,
  MilitaryCampaign,
  PoiType,
  ReferenceOverlayConfig,
  Religion,
  RoadType,
  SeasonId,
  SpecialFeatureMeta,
  SubMapBounds,
  SubMapLink,
  TerrainId,
  ToolMode,
  WorldCalendar,
  TradeMode,
  TravelSpeedId,
  WikiEntry,
  WorldTimeline,
} from '../types/map';

function getMaxHistory(m: HexMapData): number {
  const total = m.width * m.height;
  if (total > 150000) return 8;
  if (total > 60000) return 15;
  return 40;
}

export function useMapEditor() {
  const [map, setMap] = useState<HexMapData>(() => {
    const saved = loadAutosave();
    if (saved) return saved;
    return generateWorld(120, 80, 30, DEFAULT_GEOGRAPHY_CONFIG, 'แผนที่โลกใหม่');
  });

  const [undoStack, setUndoStack] = useState<HexMapData[]>([]);
  const [redoStack, setRedoStack] = useState<HexMapData[]>([]);

  const [tool, setTool] = useState<ToolMode>('view');
  const [activeTerrain, setActiveTerrain] = useState<number>(TerrainId.PLAINS);
  const [terrainEditMode, setTerrainEditMode] = useState<'paint' | 'sculpt'>('paint');
  const [sculptMode, setSculptMode] = useState<SculptMode>('raise');
  const [sculptIntensity, setSculptIntensity] = useState<number>(0.08);
  const [activeBiome, setActiveBiome] = useState<number>(BiomeId.GRASSLAND);
  // null = paint biome; '' = erase special feature; non-empty = paint special feature id
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [autoShallowWater, setAutoShallowWater] = useState<boolean>(true);
  const [terrainSubTool, setTerrainSubTool] = useState<'brush' | 'fill' | 'eyedropper'>('brush');
  const [riverSubTool, setRiverSubTool] = useState<'draw' | 'erase'>('draw');
  const [currentSubTool, setCurrentSubTool] = useState<'draw' | 'erase'>('draw');
  const [currentKind, setCurrentKind] = useState<'warm' | 'cold' | 'neutral'>('warm');
  const [currentDrawStrength, setCurrentDrawStrength] = useState<number>(1.2);
  const [windSubTool, setWindSubTool] = useState<'draw' | 'erase'>('draw');
  const [windKind, setWindKind] = useState<ManualWindKind>('trade');
  const [windDrawStrength, setWindDrawStrength] = useState<number>(1.0);
  const [roadType, setRoadType] = useState<RoadType>('stone');
  const [roadSubTool, setRoadSubTool] = useState<'auto' | 'manual' | 'erase'>('auto');
  const [tradeMode, setTradeMode] = useState<TradeMode>('mixed');
  const [poiSubTool, setPoiSubTool] = useState<'poi' | 'label'>('poi');
  const [poiType, setPoiType] = useState<PoiType>('ruins');
  const [labelStyle, setLabelStyle] = useState<LabelStyle>('region');
  const [labelSize, setLabelSize] = useState<LabelSize>('md');
  const [labelRotation, setLabelRotation] = useState<number>(0);
  const [labelCurve, setLabelCurve] = useState<number>(0);
  const [labelDraftText, setLabelDraftText] = useState<string>('');
  const [campaignSubTool, setCampaignSubTool] = useState<'draw' | 'erase'>('draw');
  const [campaignKingdomId, setCampaignKingdomId] = useState<string>(
    () => map.kingdoms[0]?.id ?? 'north'
  );
  const [referenceOverlay, setReferenceOverlay] = useState<ReferenceOverlayConfig | null>(null);
  const [focusTarget, setFocusTarget] = useState<{
    q: number;
    r: number;
    zoom?: number;
    nonce: number;
  } | null>(null);
  const [climateOverlay, setClimateOverlay] = useState<ClimateOverlay>('none');
  const [measureMode, setMeasureMode] = useState<'straight' | 'terrain'>('terrain');
  const [travelSpeed, setTravelSpeed] = useState<TravelSpeedId>('caravan');
  const [showMinimap, setShowMinimap] = useState<boolean>(true);
  const [activeSeason, setActiveSeason] = useState<SeasonId | null>(null);
  const [pendingSubMapBounds, setPendingSubMapBounds] = useState<SubMapBounds | null>(null);
  const [tectonicEditPlateId, setTectonicEditPlateId] = useState<string | null>(null);
  const [tectonicSubTool, setTectonicSubTool] = useState<'edit' | 'add' | 'erase'>('edit');
  const [tectonicAddOceanic, setTectonicAddOceanic] = useState<boolean>(false);
  const [selectedTectonicPlateId, setSelectedTectonicPlateId] = useState<string | null>(null);

  const [activeKingdomId, setActiveKingdomId] = useState<string>(
    () => map.kingdoms[0]?.id ?? 'north'
  );
  const [territorySubTool, setTerritorySubTool] = useState<'brush' | 'fill' | 'erase'>('brush');
  const [activeReligionId, setActiveReligionId] = useState<string>(
    () => map.religionList[0]?.id ?? 'solaris'
  );
  const [religionSubTool, setReligionSubTool] = useState<'brush' | 'fill' | 'erase'>('brush');
  const [activeCultureId, setActiveCultureId] = useState<string>(
    () => map.cultureList?.[0]?.id ?? 'valerian'
  );
  const [cultureSubTool, setCultureSubTool] = useState<'brush' | 'fill' | 'erase'>('brush');

  const [layers, setLayers] = useState<LayerVisibility>({
    grid: false,
    graticule: false,
    currents: false,
    winds: false,
    submaps: true,
    hillshade: true,
    contours: false,
    campaigns: true,
    cityNames: true,
    labels: true,
    territories: true,
    borders: true,
    religions: false,
    cultures: false,
    features: true,
    routes: true,
    rivers: true,
    pois: true,
    tectonics: false,
    chokepoints: false,
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
    const total = map.width * map.height;
    if (total > 90000) {
      setAutosaveStatus('saved');
      return;
    }
    setAutosaveStatus('saving');
    const delayMs = total > 50000 ? 2000 : 750;
    let idleId: number | null = null;
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const timer = window.setTimeout(() => {
      if (win.requestIdleCallback) {
        idleId = win.requestIdleCallback(
          () => {
            saveAutosave(map);
            setAutosaveStatus('saved');
          },
          { timeout: 1500 }
        );
      } else {
        saveAutosave(map);
        setAutosaveStatus('saved');
      }
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      if (idleId !== null && win.cancelIdleCallback) win.cancelIdleCallback(idleId);
    };
  }, [map]);

  const commitMapChange = useCallback(
    (updater: (prev: HexMapData) => HexMapData, dirtyHexes?: HexCoord[]) => {
      setMap((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        const limit = getMaxHistory(prev);
        setUndoStack((u) => [...u.slice(-(limit - 1)), prev]);
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
        terrains: [...(cur.terrains ?? cur.biomes.map((_, i) => getHexTerrain(cur, i)))],
        biomes: [...cur.biomes],
        elevation: [...cur.elevation],
        features: [...cur.features],
        territories: [...cur.territories],
        religions: [...cur.religions],
        cultures: [...(cur.cultures ?? [])],
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
          const featMeta = activeFeature
            ? getFeatureMetaWithCustom(activeFeature, prev.customFeatures, prev.featureOverrides)
            : null;
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
                terrains: prev.terrains,
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
              terrains: synced.terrains,
              biomes: synced.biomes,
              elevation: synced.elevation,
              features: synced.features,
            };
          }
          markHexesDirty(changedHexes);
          return { ...prev, features: nextFeatures };
        }

        // Physical Terrain (landform / water) painting — preserves existing land biomes and blends smooth elevations!
        const tMeta = getTerrainMetaWithCustom(
          activeTerrain,
          prev.customTerrains,
          prev.terrainOverrides
        );
        const curActiveBMeta = getBiomeMetaWithCustom(activeBiome, prev.customBiomes);
        const fallbackLandBiome =
          !curActiveBMeta.isWater &&
          activeBiome !== BiomeId.HILLS &&
          activeBiome !== BiomeId.HIGHLAND &&
          activeBiome !== BiomeId.MOUNTAIN &&
          activeBiome !== BiomeId.SNOW_PEAK
            ? activeBiome
            : BiomeId.GRASSLAND;

        const nextTerrains = [
          ...(prev.terrains ?? prev.biomes.map((_, i) => getHexTerrain(prev, i))),
        ];
        const nextBiomes = [...prev.biomes];
        const nextElev = [...prev.elevation];
        const nextTerr = [...prev.territories];
        const nextRel = [...prev.religions];
        const nextCult = [...(prev.cultures ?? new Array<string>(prev.width * prev.height).fill(''))];
        const nextFeat = [...prev.features];
        let changed = false;
        const changedHexes: HexCoord[] = [];
        const changedSet = new Set<number>();

        for (const h of brush) {
          const idx = hexIndex(h.q, h.r, prev.width);
          const curT = getHexTerrain(prev, idx);
          const curIsWater = isWaterBiome(nextBiomes[idx], prev.customBiomes);
          if (curT !== activeTerrain || curIsWater !== tMeta.isWater) {
            nextTerrains[idx] = activeTerrain;
            const { centerElev, neighborUpdates } = applySmoothTerrainElevation(
              nextElev,
              nextTerrains,
              prev.width,
              prev.height,
              h.q,
              h.r,
              activeTerrain,
              prev.customTerrains,
              prev.terrainOverrides
            );
            nextElev[idx] = centerElev;
            for (const nu of neighborUpdates) {
              nextElev[nu.idx] = nu.elev;
              if (!changedSet.has(nu.idx)) {
                changedSet.add(nu.idx);
                const nq = nu.idx % prev.width;
                const nr = (nu.idx - nq) / prev.width;
                changedHexes.push({ q: nq, r: nr });
              }
            }
            if (tMeta.isWater) {
              nextBiomes[idx] =
                activeTerrain === TerrainId.LAKE
                  ? BiomeId.LAKE
                  : activeTerrain === TerrainId.DEEP_OCEAN
                  ? BiomeId.DEEP_OCEAN
                  : BiomeId.SHALLOW_WATER;
              nextTerr[idx] = '';
              nextRel[idx] = '';
              nextCult[idx] = '';
            } else if (curIsWater) {
              nextBiomes[idx] = fallbackLandBiome;
            }
            if (nextFeat[idx]) {
              const fm = getFeatureMetaWithCustom(
                nextFeat[idx],
                prev.customFeatures,
                prev.featureOverrides
              );
              if (fm && (fm.placement === 'water') !== tMeta.isWater) {
                nextFeat[idx] = '';
              }
            }
            changed = true;
            if (!changedSet.has(idx)) {
              changedSet.add(idx);
              changedHexes.push(h);
            }
          }
        }
        if (!changed) return prev;
        if (autoShallowWater) {
          const preserveIndices =
            activeTerrain === TerrainId.SHALLOW_WATER
              ? new Set(changedHexes.map((h) => hexIndex(h.q, h.r, prev.width)))
              : undefined;
          const synced = syncShallowWater(
            {
              width: prev.width,
              height: prev.height,
              terrains: nextTerrains,
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
            terrains: synced.terrains,
            biomes: synced.biomes,
            elevation: synced.elevation,
            territories: nextTerr,
            religions: nextRel,
            cultures: nextCult,
            features: synced.features,
          };
        }
        markHexesDirty(changedHexes);
        return {
          ...prev,
          terrains: nextTerrains,
          biomes: nextBiomes,
          elevation: nextElev,
          territories: nextTerr,
          religions: nextRel,
          cultures: nextCult,
          features: nextFeat,
        };
      });
      return warning ? { warning } : {};
    },
    [activeBiome, activeFeature, activeTerrain, autoShallowWater, brushSize, markHexesDirty]
  );

  const paintBiomeAt = useCallback(
    (q: number, r: number): { warning?: string } => {
      let warning: string | undefined;
      setMap((prev) => {
        const brush = getHexBrush(q, r, brushSize - 1, prev.width, prev.height);
        if (brush.length === 0) return prev;
        const bMeta = getBiomeMetaWithCustom(activeBiome, prev.customBiomes);

        if (!bMeta.isWater) {
          const nextBiomes = [...prev.biomes];
          let changed = false;
          let skippedWater = 0;
          const changedHexes: HexCoord[] = [];
          for (const h of brush) {
            const idx = hexIndex(h.q, h.r, prev.width);
            if (isWaterHex(prev, h.q, h.r)) {
              skippedWater++;
              continue;
            }
            if (nextBiomes[idx] !== activeBiome) {
              nextBiomes[idx] = activeBiome;
              changed = true;
              changedHexes.push(h);
            }
          }
          if (!changed && skippedWater > 0) {
            warning = 'ไบโอมบนบกระบายได้เฉพาะบนพื้นดิน (ใช้เครื่องมือ "ภูมิประเทศ" เพื่อสร้างแผ่นดินก่อน)';
            return prev;
          }
          if (!changed) return prev;
          markHexesDirty(changedHexes);
          return { ...prev, biomes: nextBiomes };
        }

        // Custom water biome painting
        const nextTerrains = [
          ...(prev.terrains ?? prev.biomes.map((_, i) => getHexTerrain(prev, i))),
        ];
        const nextBiomes = [...prev.biomes];
        const nextElev = [...prev.elevation];
        const nextTerr = [...prev.territories];
        const nextRel = [...prev.religions];
        const nextCult = [...(prev.cultures ?? new Array<string>(prev.width * prev.height).fill(''))];
        const nextFeat = [...prev.features];
        let changed = false;
        const changedHexes: HexCoord[] = [];

        for (const h of brush) {
          const idx = hexIndex(h.q, h.r, prev.width);
          if (nextBiomes[idx] !== activeBiome) {
            const wasWater = isWaterBiome(nextBiomes[idx], prev.customBiomes);
            nextBiomes[idx] = activeBiome;
            if (!wasWater) {
              nextTerrains[idx] = TerrainId.SHALLOW_WATER;
              nextElev[idx] = bMeta.defaultElevation;
              nextTerr[idx] = '';
              nextRel[idx] = '';
              nextCult[idx] = '';
              if (nextFeat[idx]) {
                const fm = getFeatureMetaWithCustom(
                  nextFeat[idx],
                  prev.customFeatures,
                  prev.featureOverrides
                );
                if (fm && fm.placement !== 'water') nextFeat[idx] = '';
              }
            }
            changed = true;
            changedHexes.push(h);
          }
        }
        if (!changed) return prev;
        if (autoShallowWater) {
          const synced = syncShallowWater(
            {
              width: prev.width,
              height: prev.height,
              terrains: nextTerrains,
              biomes: nextBiomes,
              elevation: nextElev,
              features: nextFeat,
              customBiomes: prev.customBiomes,
            },
            { changedHexes }
          );
          markHexesDirty([...changedHexes, ...synced.changedHexes]);
          return {
            ...prev,
            terrains: synced.terrains,
            biomes: synced.biomes,
            elevation: synced.elevation,
            territories: nextTerr,
            religions: nextRel,
            cultures: nextCult,
            features: synced.features,
          };
        }
        markHexesDirty(changedHexes);
        return {
          ...prev,
          terrains: nextTerrains,
          biomes: nextBiomes,
          elevation: nextElev,
          territories: nextTerr,
          religions: nextRel,
          cultures: nextCult,
          features: nextFeat,
        };
      });
      return warning ? { warning } : {};
    },
    [activeBiome, autoShallowWater, brushSize, markHexesDirty]
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

  const paintCultureAt = useCallback(
    (q: number, r: number, erase = false) => {
      setMap((prev) => {
        const brush = getHexBrush(q, r, brushSize - 1, prev.width, prev.height);
        const targetId = erase ? '' : activeCultureId;
        const nextCult = [...(prev.cultures ?? new Array<string>(prev.width * prev.height).fill(''))];
        let changed = false;
        const changedHexes: HexCoord[] = [];
        for (const h of brush) {
          const idx = hexIndex(h.q, h.r, prev.width);
          if (!erase && isWaterBiome(prev.biomes[idx], prev.customBiomes)) continue;
          if (nextCult[idx] !== targetId) {
            nextCult[idx] = targetId;
            changed = true;
            changedHexes.push(h);
          }
        }
        if (!changed) return prev;
        markHexesDirty(changedHexes);
        return { ...prev, cultures: nextCult };
      });
    },
    [activeCultureId, brushSize, markHexesDirty]
  );

  const endStroke = useCallback(() => {
    const snap = strokeSnapshotRef.current;
    strokeSnapshotRef.current = null;
    if (!snap) return;
    setMap((cur) => {
      const diff =
        (cur.terrains ?? []).some((v, i) => v !== (snap.terrains ?? [])[i]) ||
        cur.elevation.some((v, i) => v !== snap.elevation[i]) ||
        cur.biomes.some((v, i) => v !== snap.biomes[i]) ||
        cur.features.some((v, i) => v !== snap.features[i]) ||
        cur.territories.some((v, i) => v !== snap.territories[i]) ||
        cur.religions.some((v, i) => v !== snap.religions[i]) ||
        (cur.cultures ?? []).some((v, i) => v !== (snap.cultures ?? [])[i]);
      if (diff) {
        const limit = getMaxHistory(snap);
        setUndoStack((u) => [...u.slice(-(limit - 1)), snap]);
        setRedoStack([]);
      }
      return cur;
    });
  }, []);

  const sculptElevationAt = useCallback(
    (q: number, r: number) => {
      setMap((prev) => {
        const baseTerrains =
          prev.terrains ?? prev.biomes.map((_, i) => getHexTerrain(prev, i));
        const res = sculptElevationBrush(
          prev.elevation,
          baseTerrains,
          prev.width,
          prev.height,
          q,
          r,
          brushSize - 1,
          sculptMode,
          sculptIntensity,
          prev.customTerrains,
          prev.terrainOverrides
        );
        if (res.changedIndices.length === 0) return prev;

        const curActiveBMeta = getBiomeMetaWithCustom(activeBiome, prev.customBiomes);
        const fallbackLandBiome =
          !curActiveBMeta.isWater &&
          activeBiome !== BiomeId.HILLS &&
          activeBiome !== BiomeId.HIGHLAND &&
          activeBiome !== BiomeId.MOUNTAIN &&
          activeBiome !== BiomeId.SNOW_PEAK
            ? activeBiome
            : BiomeId.GRASSLAND;

        const nextBiomes = [...prev.biomes];
        const nextTerr = [...prev.territories];
        const nextRel = [...prev.religions];
        const nextCult = [...(prev.cultures ?? new Array<string>(prev.width * prev.height).fill(''))];
        const nextFeat = [...prev.features];
        const changedHexes: HexCoord[] = [];

        for (const idx of res.changedIndices) {
          const hq = idx % prev.width;
          const hr = (idx - hq) / prev.width;
          changedHexes.push({ q: hq, r: hr });
          const nextTMeta = getTerrainMetaWithCustom(
            res.nextTerrains[idx],
            prev.customTerrains,
            prev.terrainOverrides
          );
          const wasWater = isWaterBiome(nextBiomes[idx], prev.customBiomes);
          if (nextTMeta.isWater) {
            nextBiomes[idx] =
              res.nextTerrains[idx] === TerrainId.LAKE
                ? BiomeId.LAKE
                : res.nextTerrains[idx] === TerrainId.DEEP_OCEAN
                ? BiomeId.DEEP_OCEAN
                : BiomeId.SHALLOW_WATER;
            nextTerr[idx] = '';
            nextRel[idx] = '';
            nextCult[idx] = '';
          } else if (wasWater) {
            nextBiomes[idx] = fallbackLandBiome;
          }
          if (nextFeat[idx]) {
            const fm = getFeatureMetaWithCustom(
              nextFeat[idx],
              prev.customFeatures,
              prev.featureOverrides
            );
            if (fm && (fm.placement === 'water') !== nextTMeta.isWater) {
              nextFeat[idx] = '';
            }
          }
        }

        if (autoShallowWater) {
          const synced = syncShallowWater(
            {
              width: prev.width,
              height: prev.height,
              terrains: res.nextTerrains,
              biomes: nextBiomes,
              elevation: res.nextElevation,
              features: nextFeat,
              customBiomes: prev.customBiomes,
            },
            { changedHexes }
          );
          markHexesDirty([...changedHexes, ...synced.changedHexes]);
          return {
            ...prev,
            terrains: synced.terrains,
            biomes: synced.biomes,
            elevation: synced.elevation,
            territories: nextTerr,
            religions: nextRel,
            cultures: nextCult,
            features: synced.features,
          };
        }

        markHexesDirty(changedHexes);
        return {
          ...prev,
          terrains: res.nextTerrains,
          biomes: nextBiomes,
          elevation: res.nextElevation,
          territories: nextTerr,
          religions: nextRel,
          cultures: nextCult,
          features: nextFeat,
        };
      });
    },
    [activeBiome, autoShallowWater, brushSize, markHexesDirty, sculptIntensity, sculptMode]
  );

  const floodFillAt = useCallback(
    (q: number, r: number) => {
      commitMapChange((prev) => {
        const baseTerrains =
          prev.terrains ?? prev.biomes.map((_, i) => getHexTerrain(prev, i));
        const targets = floodFillHexes(baseTerrains, prev.width, prev.height, q, r);
        if (targets.length === 0) return prev;
        const tMeta = getTerrainMetaWithCustom(
          activeTerrain,
          prev.customTerrains,
          prev.terrainOverrides
        );
        const curActiveBMeta = getBiomeMetaWithCustom(activeBiome, prev.customBiomes);
        const fallbackLandBiome =
          !curActiveBMeta.isWater &&
          activeBiome !== BiomeId.HILLS &&
          activeBiome !== BiomeId.HIGHLAND &&
          activeBiome !== BiomeId.MOUNTAIN &&
          activeBiome !== BiomeId.SNOW_PEAK
            ? activeBiome
            : BiomeId.GRASSLAND;

        const nextTerrains = [...baseTerrains];
        const nextBiomes = [...prev.biomes];
        const nextElev = [...prev.elevation];
        const nextTerr = [...prev.territories];
        const nextRel = [...prev.religions];
        const nextCult = [...(prev.cultures ?? new Array<string>(prev.width * prev.height).fill(''))];
        const nextFeat = [...prev.features];

        for (const h of targets) {
          const idx = hexIndex(h.q, h.r, prev.width);
          const curIsWater = isWaterBiome(nextBiomes[idx], prev.customBiomes);
          nextTerrains[idx] = activeTerrain;
          nextElev[idx] = tMeta.defaultElevation;
          if (tMeta.isWater) {
            nextBiomes[idx] =
              activeTerrain === TerrainId.LAKE
                ? BiomeId.LAKE
                : activeTerrain === TerrainId.DEEP_OCEAN
                ? BiomeId.DEEP_OCEAN
                : BiomeId.SHALLOW_WATER;
            nextTerr[idx] = '';
            nextRel[idx] = '';
            nextCult[idx] = '';
          } else if (curIsWater) {
            nextBiomes[idx] = fallbackLandBiome;
          }
          if (nextFeat[idx]) {
            const fm = getFeatureMetaWithCustom(
              nextFeat[idx],
              prev.customFeatures,
              prev.featureOverrides
            );
            if (fm && (fm.placement === 'water') !== tMeta.isWater) {
              nextFeat[idx] = '';
            }
          }
        }
        if (autoShallowWater) {
          const preserveIndices =
            activeTerrain === TerrainId.SHALLOW_WATER
              ? new Set(targets.map((h) => hexIndex(h.q, h.r, prev.width)))
              : undefined;
          const synced = syncShallowWater(
            {
              width: prev.width,
              height: prev.height,
              terrains: nextTerrains,
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
            terrains: synced.terrains,
            biomes: synced.biomes,
            elevation: synced.elevation,
            territories: nextTerr,
            religions: nextRel,
            cultures: nextCult,
            features: synced.features,
          };
        }
        markHexesDirty(targets);
        return {
          ...prev,
          terrains: nextTerrains,
          biomes: nextBiomes,
          elevation: nextElev,
          territories: nextTerr,
          religions: nextRel,
          cultures: nextCult,
          features: nextFeat,
        };
      });
    },
    [activeBiome, activeTerrain, autoShallowWater, commitMapChange, markHexesDirty]
  );

  const floodFillBiomeAt = useCallback(
    (q: number, r: number) => {
      commitMapChange((prev) => {
        const bMeta = getBiomeMetaWithCustom(activeBiome, prev.customBiomes);
        if (!bMeta.isWater) {
          if (isWaterHex(prev, q, r)) return prev;
          const targets = floodFillHexes(
            prev.biomes,
            prev.width,
            prev.height,
            q,
            r,
            12000,
            (idx) => !isWaterBiome(prev.biomes[idx], prev.customBiomes)
          );
          if (targets.length === 0) return prev;
          const nextBiomes = [...prev.biomes];
          for (const h of targets) {
            nextBiomes[hexIndex(h.q, h.r, prev.width)] = activeBiome;
          }
          markHexesDirty(targets);
          return { ...prev, biomes: nextBiomes };
        }

        const targets = floodFillHexes(prev.biomes, prev.width, prev.height, q, r);
        if (targets.length === 0) return prev;
        const nextTerrains = [
          ...(prev.terrains ?? prev.biomes.map((_, i) => getHexTerrain(prev, i))),
        ];
        const nextBiomes = [...prev.biomes];
        const nextElev = [...prev.elevation];
        const nextTerr = [...prev.territories];
        const nextRel = [...prev.religions];
        const nextCult = [...(prev.cultures ?? new Array<string>(prev.width * prev.height).fill(''))];
        const nextFeat = [...prev.features];

        for (const h of targets) {
          const idx = hexIndex(h.q, h.r, prev.width);
          const wasWater = isWaterBiome(nextBiomes[idx], prev.customBiomes);
          nextBiomes[idx] = activeBiome;
          if (!wasWater) {
            nextTerrains[idx] = TerrainId.SHALLOW_WATER;
            nextElev[idx] = bMeta.defaultElevation;
            nextTerr[idx] = '';
            nextRel[idx] = '';
            nextCult[idx] = '';
            if (nextFeat[idx]) {
              const fm = getFeatureMetaWithCustom(
                nextFeat[idx],
                prev.customFeatures,
                prev.featureOverrides
              );
              if (fm && fm.placement !== 'water') nextFeat[idx] = '';
            }
          }
        }
        markHexesDirty(targets);
        return {
          ...prev,
          terrains: nextTerrains,
          biomes: nextBiomes,
          elevation: nextElev,
          territories: nextTerr,
          religions: nextRel,
          cultures: nextCult,
          features: nextFeat,
        };
      });
    },
    [activeBiome, commitMapChange, markHexesDirty]
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

  const floodFillCultureAt = useCallback(
    (q: number, r: number, erase = false) => {
      commitMapChange((prev) => {
        if (!erase && isWaterHex(prev, q, r)) return prev;
        const baseCultures = prev.cultures ?? new Array<string>(prev.width * prev.height).fill('');
        const targets = floodFillHexes(
          baseCultures,
          prev.width,
          prev.height,
          q,
          r,
          8000,
          (idx) => !isWaterBiome(prev.biomes[idx], prev.customBiomes)
        );
        if (targets.length === 0) return prev;
        const nextCult = [...baseCultures];
        const val = erase ? '' : activeCultureId;
        for (const h of targets) {
          nextCult[hexIndex(h.q, h.r, prev.width)] = val;
        }
        markHexesDirty(targets);
        return { ...prev, cultures: nextCult };
      });
    },
    [activeCultureId, commitMapChange, markHexesDirty]
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
        cultureId: activeCultureId || map.cultureList?.[0]?.id || 'valerian',
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
    [activeCultureId, activeKingdomId, activeReligionId, commitMapChange, map]
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

  const createTradeRouteBetweenCities = useCallback(
    (fromCityId: string, toCityId: string, mode: TradeMode): { error?: string } => {
      if (fromCityId === toCityId) return {};
      const from = map.cities.find((c) => c.id === fromCityId);
      const to = map.cities.find((c) => c.id === toCityId);
      if (!from || !to) return { error: 'ไม่พบเมืองต้นทางหรือปลายทาง' };

      const path = findHexPath(map, from, to, mode);
      if (!path.reachable) {
        return {
          error:
            mode === 'sea'
              ? 'เส้นทางเดินเรือต้องเชื่อมระหว่างเมืองติดทะเล/ท่าเรือที่ไม่มีหน้าผาเท่านั้น (ลองใช้โหมด "ผสม" สำหรับเมืองในแผ่นดิน)'
              : 'ไม่สามารถคำนวณเส้นทางระหว่างสองเมืองนี้ได้ในโหมดที่เลือก',
        };
      }
      const speed = mode === 'sea' ? 140 : mode === 'mixed' ? 55 : 25;
      const matched = from.producedGoods.filter((gid) => to.demandedGoods.includes(gid));
      const goodIds = matched.length > 0 ? matched.slice(0, 3) : from.producedGoods.slice(0, 2);
      const newRoute = {
        id: `route_${Date.now().toString(36)}`,
        fromCityId: from.id,
        toCityId: to.id,
        goodIds,
        mode,
        hexes: path.hexes,
        distanceKm: Math.round(path.distanceKm),
        travelDays: Number(Math.max(0.5, path.distanceKm / speed).toFixed(1)),
      };
      commitMapChange(
        (prev) => ({ ...prev, tradeRoutes: [...prev.tradeRoutes, newRoute] }),
        []
      );
      return {};
    },
    [commitMapChange, map]
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
      const res = createTradeRouteBetweenCities(tradeStartCityId, clicked.id, tradeMode);
      if (!res.error) setTradeStartCityId(null);
      return res;
    },
    [createTradeRouteBetweenCities, map.cities, tradeMode, tradeStartCityId]
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

  const runAutoCultures = useCallback(() => {
    commitMapChange((prev) => ({
      ...prev,
      cultures: generateCulturesFromCities(prev),
    }));
  }, [commitMapChange]);

  const updateKingdoms = useCallback(
    (kingdoms: Kingdom[]) => {
      const validIds = new Set(kingdoms.map((k) => k.id));
      const fallbackId = kingdoms[0]?.id ?? '';
      commitMapChange((prev) => ({
        ...prev,
        kingdoms,
        territories: prev.territories.map((tid) => (tid && !validIds.has(tid) ? '' : tid)),
        cities: prev.cities.map((c) =>
          c.kingdomId && !validIds.has(c.kingdomId) ? { ...c, kingdomId: fallbackId } : c
        ),
      }));
      if (activeKingdomId && !validIds.has(activeKingdomId)) {
        setActiveKingdomId(fallbackId);
      }
    },
    [activeKingdomId, commitMapChange]
  );

  const updateReligions = useCallback(
    (religionList: Religion[]) => {
      const validIds = new Set(religionList.map((r) => r.id));
      const fallbackId = religionList[0]?.id ?? '';
      commitMapChange((prev) => ({
        ...prev,
        religionList,
        religions: prev.religions.map((rid) => (rid && !validIds.has(rid) ? '' : rid)),
        cities: prev.cities.map((c) =>
          c.religionId && !validIds.has(c.religionId) ? { ...c, religionId: fallbackId } : c
        ),
      }));
      if (activeReligionId && !validIds.has(activeReligionId)) {
        setActiveReligionId(fallbackId);
      }
    },
    [activeReligionId, commitMapChange]
  );

  const updateCultures = useCallback(
    (cultureList: Culture[]) => {
      const validIds = new Set(cultureList.map((c) => c.id));
      const fallbackId = cultureList[0]?.id ?? '';
      commitMapChange((prev) => ({
        ...prev,
        cultureList,
        cultures: (prev.cultures ?? []).map((cid) => (cid && !validIds.has(cid) ? '' : cid)),
        cities: prev.cities.map((c) =>
          c.cultureId && !validIds.has(c.cultureId) ? { ...c, cultureId: fallbackId } : c
        ),
      }));
      if (activeCultureId && !validIds.has(activeCultureId)) {
        setActiveCultureId(fallbackId);
      }
    },
    [activeCultureId, commitMapChange]
  );

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
          cultureList: prev.cultureList,
          customBiomes: prev.customBiomes,
          customPoiTypes: prev.customPoiTypes,
          customGovernmentTypes: prev.customGovernmentTypes,
          customReligionTypes: prev.customReligionTypes,
          customCultureTypes: prev.customCultureTypes,
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
        terrains: res.terrains,
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
        terrains: res.terrains,
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
        terrains: new Array<number>(total).fill(TerrainId.DEEP_OCEAN),
        biomes: new Array<number>(total).fill(BiomeId.DEEP_OCEAN),
        elevation: new Array<number>(total).fill(-0.65),
        features: new Array<string>(total).fill(''),
        territories: new Array<string>(total).fill(''),
        religions: new Array<string>(total).fill(''),
        cultures: new Array<string>(total).fill(''),
        rivers: [],
        cities: [],
        roads: [],
        tradeRoutes: [],
        pois: [],
        labels: [],
        timeline: undefined,
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
      setTool('biome');
      return newBiome;
    },
    [commitMapChange, map.customBiomes]
  );

  const updateCustomBiome = useCallback(
    (id: number, patch: Partial<Omit<CustomBiome, 'id'>>) => {
      commitMapChange((prev) => ({
        ...prev,
        customBiomes: prev.customBiomes.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      }));
    },
    [commitMapChange]
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

  const addCustomTerrain = useCallback(
    (terrain: Omit<CustomTerrain, 'id'>) => {
      const maxId = (map.customTerrains ?? []).reduce((m, t) => Math.max(m, t.id), 99);
      const newTerrain: CustomTerrain = { ...terrain, id: maxId + 1 };
      commitMapChange(
        (prev) => ({
          ...prev,
          customTerrains: [...(prev.customTerrains ?? []), newTerrain],
        }),
        []
      );
      setActiveTerrain(newTerrain.id);
      setActiveFeature(null);
      setTool('terrain');
      return newTerrain;
    },
    [commitMapChange, map.customTerrains]
  );

  const updateCustomTerrain = useCallback(
    (id: number, patch: Partial<Omit<CustomTerrain, 'id'>>) => {
      commitMapChange((prev) => ({
        ...prev,
        customTerrains: (prev.customTerrains ?? []).map((t) =>
          t.id === id ? { ...t, ...patch } : t
        ),
      }));
    },
    [commitMapChange]
  );

  const deleteCustomTerrain = useCallback(
    (id: number) => {
      commitMapChange((prev) => ({
        ...prev,
        customTerrains: (prev.customTerrains ?? []).filter((t) => t.id !== id),
        terrains: (prev.terrains ?? []).map((t) => (t === id ? TerrainId.PLAINS : t)),
      }));
      if (activeTerrain === id) setActiveTerrain(TerrainId.PLAINS);
    },
    [activeTerrain, commitMapChange]
  );

  const setTerrainOverride = useCallback(
    (id: number, patch: Partial<Omit<CustomTerrain, 'id'>>) => {
      commitMapChange((prev) => ({
        ...prev,
        terrainOverrides: {
          ...(prev.terrainOverrides ?? {}),
          [id]: { ...(prev.terrainOverrides?.[id] ?? {}), ...patch },
        },
      }));
    },
    [commitMapChange]
  );

  const resetTerrainOverride = useCallback(
    (id: number) => {
      commitMapChange((prev) => {
        const next = { ...(prev.terrainOverrides ?? {}) };
        delete next[id];
        return { ...prev, terrainOverrides: next };
      });
    },
    [commitMapChange]
  );

  const addCustomFeature = useCallback(
    (feature: Omit<SpecialFeatureMeta, 'id'>) => {
      const created: SpecialFeatureMeta = {
        ...feature,
        id: `feat_custom_${Date.now().toString(36)}`,
        isCustom: true,
      };
      commitMapChange(
        (prev) => ({
          ...prev,
          customFeatures: [...(prev.customFeatures ?? []), created],
        }),
        []
      );
      setActiveFeature(created.id);
      setTool('terrain');
      return created;
    },
    [commitMapChange]
  );

  const updateCustomFeature = useCallback(
    (id: string, patch: Partial<Omit<SpecialFeatureMeta, 'id'>>) => {
      commitMapChange((prev) => ({
        ...prev,
        customFeatures: (prev.customFeatures ?? []).map((f) =>
          f.id === id ? { ...f, ...patch } : f
        ),
      }));
    },
    [commitMapChange]
  );

  const deleteCustomFeature = useCallback(
    (id: string) => {
      commitMapChange((prev) => ({
        ...prev,
        customFeatures: (prev.customFeatures ?? []).filter((f) => f.id !== id),
        features: prev.features.map((f) => (f === id ? '' : f)),
      }));
      if (activeFeature === id) setActiveFeature(null);
    },
    [activeFeature, commitMapChange]
  );

  const setFeatureOverride = useCallback(
    (id: string, patch: Partial<Omit<SpecialFeatureMeta, 'id'>>) => {
      commitMapChange((prev) => ({
        ...prev,
        featureOverrides: {
          ...(prev.featureOverrides ?? {}),
          [id]: { ...(prev.featureOverrides?.[id] ?? {}), ...patch },
        },
      }));
    },
    [commitMapChange]
  );

  const resetFeatureOverride = useCallback(
    (id: string) => {
      commitMapChange((prev) => {
        const next = { ...(prev.featureOverrides ?? {}) };
        delete next[id];
        return { ...prev, featureOverrides: next };
      });
    },
    [commitMapChange]
  );

  const eraseCurrentNear = useCallback(
    (q: number, r: number) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          manualCurrents: (prev.manualCurrents ?? []).filter(
            (mc) => !mc.points.some((p) => hexDistance(p, { q, r }) <= 1)
          ),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const addManualWind = useCallback(
    (points: HexCoord[]) => {
      if (points.length < 2) return;
      commitMapChange((prev) => ({
        ...prev,
        manualWinds: [
          ...(prev.manualWinds ?? []),
          {
            id: `wind_${Date.now().toString(36)}`,
            kind: windKind,
            strength: windDrawStrength,
            points,
          },
        ],
      }));
    },
    [commitMapChange, windDrawStrength, windKind]
  );

  const eraseWindNear = useCallback(
    (q: number, r: number) => {
      commitMapChange((prev) => ({
        ...prev,
        manualWinds: (prev.manualWinds ?? []).filter(
          (mw) => !mw.points.some((p) => hexDistance(p, { q, r }) <= 2)
        ),
      }));
    },
    [commitMapChange]
  );

  const deleteManualWind = useCallback(
    (id: string) => {
      commitMapChange((prev) => ({
        ...prev,
        manualWinds: (prev.manualWinds ?? []).filter((mw) => mw.id !== id),
      }));
    },
    [commitMapChange]
  );

  const applyViewPreset = useCallback(
    (preset: 'standard' | 'parchment' | 'maritime' | 'geology' | 'strategy') => {
      const nextTheme: MapTheme =
        preset === 'parchment'
          ? 'parchment'
          : preset === 'maritime'
          ? 'atlas'
          : preset === 'strategy'
          ? 'dark'
          : 'standard';
      commitMapChange((prev) => ({ ...prev, mapTheme: nextTheme }), []);
      if (preset === 'standard') {
        setClimateOverlay('none');
        setLayers((l) => ({
          ...l,
          hillshade: true,
          contours: false,
          currents: false,
          winds: false,
          tectonics: false,
          chokepoints: false,
          territories: true,
          borders: true,
          routes: true,
          rivers: true,
          pois: true,
          labels: true,
          cityNames: true,
        }));
      } else if (preset === 'parchment') {
        setClimateOverlay('none');
        setLayers((l) => ({
          ...l,
          hillshade: true,
          contours: true,
          currents: false,
          winds: false,
          tectonics: false,
          chokepoints: false,
          territories: false,
          borders: true,
          routes: true,
          rivers: true,
          labels: true,
        }));
      } else if (preset === 'maritime') {
        setClimateOverlay('winds');
        setLayers((l) => ({
          ...l,
          currents: true,
          winds: true,
          graticule: true,
          tectonics: false,
          chokepoints: true,
          routes: true,
          territories: false,
          borders: true,
        }));
      } else if (preset === 'geology') {
        setClimateOverlay('tectonics');
        setLayers((l) => ({
          ...l,
          tectonics: true,
          contours: true,
          hillshade: true,
          winds: false,
          currents: false,
          territories: false,
        }));
      } else if (preset === 'strategy') {
        setClimateOverlay('political');
        setLayers((l) => ({
          ...l,
          territories: true,
          borders: true,
          chokepoints: true,
          campaigns: true,
          routes: true,
          winds: false,
          tectonics: false,
        }));
      }
    },
    [commitMapChange]
  );

  const registerChildSubMap = useCallback(
    (sub: SubMapLink) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          childSubMaps: [...(prev.childSubMaps ?? []).filter((c) => c.id !== sub.id), sub],
        }),
        []
      );
    },
    [commitMapChange]
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

  const addCustomGovernmentType = useCallback(
    (label: string, description?: string): CustomCategoryType => {
      const created: CustomCategoryType = {
        id: `gov_custom_${Date.now().toString(36)}`,
        label: label.trim(),
        description,
      };
      commitMapChange(
        (prev) => ({
          ...prev,
          customGovernmentTypes: [...(prev.customGovernmentTypes ?? []), created],
        }),
        []
      );
      return created;
    },
    [commitMapChange]
  );

  const deleteCustomGovernmentType = useCallback(
    (id: string) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          customGovernmentTypes: (prev.customGovernmentTypes ?? []).filter((t) => t.id !== id),
          kingdoms: prev.kingdoms.map((k) =>
            k.government === id ? { ...k, government: 'monarchy' } : k
          ),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const addCustomReligionType = useCallback(
    (label: string, description?: string): CustomCategoryType => {
      const created: CustomCategoryType = {
        id: `rel_custom_${Date.now().toString(36)}`,
        label: label.trim(),
        description,
      };
      commitMapChange(
        (prev) => ({
          ...prev,
          customReligionTypes: [...(prev.customReligionTypes ?? []), created],
        }),
        []
      );
      return created;
    },
    [commitMapChange]
  );

  const deleteCustomReligionType = useCallback(
    (id: string) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          customReligionTypes: (prev.customReligionTypes ?? []).filter((t) => t.id !== id),
          religionList: prev.religionList.map((r) =>
            r.type === id ? { ...r, type: 'monotheism' } : r
          ),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const addCustomCultureType = useCallback(
    (label: string, description?: string): CustomCategoryType => {
      const created: CustomCategoryType = {
        id: `cult_custom_${Date.now().toString(36)}`,
        label: label.trim(),
        description,
      };
      commitMapChange(
        (prev) => ({
          ...prev,
          customCultureTypes: [...(prev.customCultureTypes ?? []), created],
        }),
        []
      );
      return created;
    },
    [commitMapChange]
  );

  const deleteCustomCultureType = useCallback(
    (id: string) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          customCultureTypes: (prev.customCultureTypes ?? []).filter((t) => t.id !== id),
          cultureList: (prev.cultureList ?? []).map((c) =>
            c.type === id ? { ...c, type: 'agrarian' } : c
          ),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const ensureTimeline = useCallback(() => {
    commitMapChange(
      (prev) => (prev.timeline ? prev : { ...prev, timeline: createInitialTimeline(prev) }),
      []
    );
  }, [commitMapChange]);

  const switchEra = useCallback(
    (eraId: string) => {
      commitMapChange((prev) => switchMapToEra(prev, eraId));
      setSelectedCityId(null);
      setTradeStartCityId(null);
    },
    [commitMapChange]
  );

  const createEraFromCurrent = useCallback(
    (name: string, year: number, summary = '') => {
      commitMapChange((prev) => createNewEraFromCurrent(prev, name, year, summary), []);
    },
    [commitMapChange]
  );

  const saveActiveEra = useCallback(() => {
    commitMapChange((prev) => saveCurrentMapIntoActiveEra(prev), []);
  }, [commitMapChange]);

  const updateTimelineMeta = useCallback(
    (updater: (tl: WorldTimeline) => WorldTimeline) => {
      commitMapChange((prev) => {
        const currentTl = prev.timeline ?? createInitialTimeline(prev);
        return {
          ...prev,
          timeline: updater(currentTl),
        };
      }, []);
    },
    [commitMapChange]
  );

  const setMapTheme = useCallback(
    (theme: MapTheme) => {
      commitMapChange((prev) => ({ ...prev, mapTheme: theme }), []);
    },
    [commitMapChange]
  );

  const upsertDiplomacy = useCallback(
    (
      kingdomA: string,
      kingdomB: string,
      status: DiplomaticRelationType,
      notes?: string
    ) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          diplomacy: upsertDiplomaticRelation(prev.diplomacy, kingdomA, kingdomB, status, notes),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const addCampaign = useCallback(
    (cp: Omit<MilitaryCampaign, 'id'>) => {
      const created: MilitaryCampaign = {
        ...cp,
        id: `cp_${Date.now().toString(36)}`,
      };
      commitMapChange(
        (prev) => ({
          ...prev,
          campaigns: [...(prev.campaigns ?? []), created],
        }),
        []
      );
      return created;
    },
    [commitMapChange]
  );

  const updateCampaign = useCallback(
    (id: string, patch: Partial<MilitaryCampaign>) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          campaigns: (prev.campaigns ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const deleteCampaign = useCallback(
    (id: string) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          campaigns: (prev.campaigns ?? []).filter((c) => c.id !== id),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const eraseCampaignNear = useCallback(
    (q: number, r: number) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          campaigns: (prev.campaigns ?? []).filter(
            (c) => !c.points.some((p) => hexDistance(p, { q, r }) <= 1)
          ),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const addWikiEntry = useCallback(
    (entry: Omit<WikiEntry, 'id' | 'updatedAt'>) => {
      const created: WikiEntry = {
        ...entry,
        id: `wiki_${Date.now().toString(36)}`,
        updatedAt: new Date().toISOString(),
      };
      commitMapChange(
        (prev) => ({
          ...prev,
          wikiEntries: [...(prev.wikiEntries ?? []), created],
        }),
        []
      );
      return created;
    },
    [commitMapChange]
  );

  const updateWikiEntry = useCallback(
    (id: string, patch: Partial<WikiEntry>) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          wikiEntries: (prev.wikiEntries ?? []).map((w) =>
            w.id === id ? { ...w, ...patch, updatedAt: new Date().toISOString() } : w
          ),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const deleteWikiEntry = useCallback(
    (id: string) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          wikiEntries: (prev.wikiEntries ?? []).filter((w) => w.id !== id),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const addBookmark = useCallback(
    (name: string, q: number, r: number, zoom: number) => {
      const bm: CameraBookmark = {
        id: `bm_${Date.now().toString(36)}`,
        name: name.trim(),
        q,
        r,
        zoom,
      };
      commitMapChange(
        (prev) => ({
          ...prev,
          bookmarks: [...(prev.bookmarks ?? []), bm],
        }),
        []
      );
      return bm;
    },
    [commitMapChange]
  );

  const deleteBookmark = useCallback(
    (id: string) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          bookmarks: (prev.bookmarks ?? []).filter((b) => b.id !== id),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const updateMapLabel = useCallback(
    (id: string, patch: Partial<MapLabel>) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          labels: prev.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const deleteMapLabel = useCallback(
    (id: string) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          labels: prev.labels.filter((l) => l.id !== id),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const jumpToHex = useCallback((q: number, r: number, zoom?: number) => {
    setFocusTarget((prev) => ({ q, r, zoom, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  const updateCalendar = useCallback(
    (calendar: WorldCalendar) => {
      commitMapChange(
        (prev) => ({
          ...prev,
          calendar: calendar ?? createDefaultCalendar(),
        }),
        []
      );
    },
    [commitMapChange]
  );

  const tectonicDragSnapshotRef = useRef<HexMapData | null>(null);
  const tectonicDragMovedRef = useRef(false);

  const beginTectonicDrag = useCallback(() => {
    tectonicDragSnapshotRef.current = map;
    tectonicDragMovedRef.current = false;
  }, [map]);

  const liveUpdateCustomTectonicPlates = useCallback(
    (updater: (plates: CustomTectonicPlate[]) => CustomTectonicPlate[]) => {
      tectonicDragMovedRef.current = true;
      setMap((prev) => {
        const current = prev.customTectonicPlates ?? createCustomPlatesFromCurrent(prev);
        return {
          ...prev,
          customTectonicPlates: updater(current),
        };
      });
      markAllDirty();
    },
    [markAllDirty]
  );

  const endTectonicDrag = useCallback(() => {
    const snap = tectonicDragSnapshotRef.current;
    tectonicDragSnapshotRef.current = null;
    const moved = tectonicDragMovedRef.current;
    tectonicDragMovedRef.current = false;
    if (snap && moved) {
      const limit = getMaxHistory(snap);
      setUndoStack((u) => [...u.slice(-(limit - 1)), snap]);
      setRedoStack([]);
    }
  }, []);

  const updateCustomTectonicPlates = useCallback(
    (plates: CustomTectonicPlate[] | undefined) => {
      commitMapChange((prev) => ({
        ...prev,
        customTectonicPlates: plates,
      }));
      if (!plates) setSelectedTectonicPlateId(null);
    },
    [commitMapChange]
  );

  const initCustomTectonicPlates = useCallback(() => {
    let firstId: string | null = null;
    commitMapChange((prev) => {
      const plates = prev.customTectonicPlates ?? createCustomPlatesFromCurrent(prev);
      firstId = plates[0]?.id ?? null;
      return {
        ...prev,
        customTectonicPlates: plates,
      };
    });
    if (firstId) setSelectedTectonicPlateId(firstId);
    setLayers((l) => (l.tectonics ? l : { ...l, tectonics: true }));
    setClimateOverlay('tectonics');
  }, [commitMapChange]);

  const applyTectonicPreset = useCallback(
    (preset: TectonicPresetId, plateCount = 6) => {
      let firstId: string | null = null;
      commitMapChange((prev) => {
        const nextPlates = createTectonicPreset(preset, prev, plateCount);
        firstId = nextPlates[0]?.id ?? null;
        return {
          ...prev,
          customTectonicPlates: nextPlates,
          geography: {
            ...prev.geography,
            tectonicPlates: nextPlates.length,
          },
        };
      });
      setSelectedTectonicPlateId(firstId);
      setTectonicEditPlateId(null);
      setLayers((l) => (l.tectonics ? l : { ...l, tectonics: true }));
    },
    [commitMapChange]
  );

  const addTectonicPlateAt = useCallback(
    (q: number, r: number, isOceanic: boolean) => {
      let createdId = '';
      commitMapChange((prev) => {
        const current = prev.customTectonicPlates ?? createCustomPlatesFromCurrent(prev);
        const palette = [
          '#f59e0b',
          '#38bdf8',
          '#a78bfa',
          '#34d399',
          '#fb7185',
          '#facc15',
          '#60a5fa',
          '#2dd4bf',
        ];
        const num = current.length + 1;
        createdId = `plate_${Date.now().toString(36)}_${num}`;
        const nextPlate: CustomTectonicPlate = {
          id: createdId,
          name: `${isOceanic ? 'แผ่นสมุทร' : 'แผ่นทวีป'} #${num}`,
          color: palette[(num - 1) % palette.length],
          centerQ: Math.max(0, Math.min(prev.width - 1, q)),
          centerR: Math.max(0, Math.min(prev.height - 1, r)),
          vx: isOceanic ? -0.65 : 0.65,
          vy: 0.1,
          isOceanic,
        };
        return {
          ...prev,
          customTectonicPlates: [...current, nextPlate],
        };
      });
      if (createdId) setSelectedTectonicPlateId(createdId);
      setLayers((l) => (l.tectonics ? l : { ...l, tectonics: true }));
    },
    [commitMapChange]
  );

  const deleteTectonicPlateById = useCallback(
    (plateId: string) => {
      commitMapChange((prev) => {
        const current = prev.customTectonicPlates ?? createCustomPlatesFromCurrent(prev);
        if (current.length <= 2) return prev;
        return {
          ...prev,
          customTectonicPlates: current.filter((p) => p.id !== plateId),
        };
      });
      setSelectedTectonicPlateId((cur) => (cur === plateId ? null : cur));
    },
    [commitMapChange]
  );

  const placeOrMoveTectonicPlateAt = useCallback(
    (q: number, r: number) => {
      const targetId = tectonicEditPlateId;
      if (!targetId) return;
      commitMapChange((prev) => {
        const current = prev.customTectonicPlates ?? createCustomPlatesFromCurrent(prev);
        const idx = hexIndex(q, r, prev.width);
        const isOceanicCell = (prev.elevation[idx] ?? 0) <= 0;
        if (targetId === '__new__') {
          const palette = [
            '#f59e0b',
            '#38bdf8',
            '#a78bfa',
            '#34d399',
            '#fb7185',
            '#facc15',
            '#60a5fa',
            '#2dd4bf',
          ];
          const num = current.length + 1;
          const nextPlate: CustomTectonicPlate = {
            id: `plate_${Date.now().toString(36)}`,
            name: `แผ่นกำหนดเอง #${num}`,
            color: palette[(num - 1) % palette.length],
            centerQ: q,
            centerR: r,
            vx: 0.7,
            vy: 0.0,
            isOceanic: isOceanicCell,
          };
          return { ...prev, customTectonicPlates: [...current, nextPlate] };
        }
        return {
          ...prev,
          customTectonicPlates: current.map((p) =>
            p.id === targetId ? { ...p, centerQ: q, centerR: r } : p
          ),
        };
      });
      setTectonicEditPlateId(null);
    },
    [commitMapChange, tectonicEditPlateId]
  );

  const runApplyTectonicsToCurrentMap = useCallback(
    (strength?: number) => {
      commitMapChange((prev) =>
        applyTectonicsToCurrentMap(
          prev,
          strength ??
            (prev.geography.tectonicStrength && prev.geography.tectonicStrength > 0
              ? prev.geography.tectonicStrength
              : 0.65)
        )
      );
    },
    [commitMapChange]
  );

  const runGenerateWorldFromTectonics = useCallback(
    (strength?: number) => {
      commitMapChange((prev) =>
        generateWorldFromTectonicPlates(
          prev,
          strength ??
            (prev.geography.tectonicStrength && prev.geography.tectonicStrength > 0
              ? prev.geography.tectonicStrength
              : 0.85)
        )
      );
      setSelectedCityId(null);
      setTradeStartCityId(null);
      setLayers((l) => (l.tectonics ? l : { ...l, tectonics: true }));
      setClimateOverlay('none');
    },
    [commitMapChange]
  );

  const runAutoPlaceFeatures = useCallback(
    (options?: AutoFeatureOptions): number => {
      let placed = 0;
      commitMapChange((prev) => {
        const res = autoPlaceSpecialFeatures(prev, options);
        placed = res.placedCount;
        return {
          ...prev,
          features: res.features,
          elevation: res.elevation,
          terrains: res.terrains,
          biomes: res.biomes,
        };
      });
      return placed;
    },
    [commitMapChange]
  );

  const runSimulateAllFromCurrentMap = useCallback(
    (options: WorldSimulationOptions): WorldSimulationSummary => {
      let summary: WorldSimulationSummary = {
        rivers: 0,
        features: 0,
        cities: 0,
        roads: 0,
        tradeRoutes: 0,
        pois: 0,
        labels: 0,
      };
      commitMapChange((prev) => {
        const res = simulateAllFromCurrentMap(prev, options);
        summary = res.summary;
        return res.map;
      });
      return summary;
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
    activeTerrain,
    setActiveTerrain,
    terrainEditMode,
    setTerrainEditMode,
    sculptMode,
    setSculptMode,
    sculptIntensity,
    setSculptIntensity,
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
    currentSubTool,
    setCurrentSubTool,
    currentKind,
    setCurrentKind,
    currentDrawStrength,
    setCurrentDrawStrength,
    windSubTool,
    setWindSubTool,
    windKind,
    setWindKind,
    windDrawStrength,
    setWindDrawStrength,
    addManualWind,
    eraseWindNear,
    deleteManualWind,
    applyViewPreset,
    registerChildSubMap,
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
    labelSize,
    setLabelSize,
    labelRotation,
    setLabelRotation,
    labelCurve,
    setLabelCurve,
    labelDraftText,
    setLabelDraftText,
    campaignSubTool,
    setCampaignSubTool,
    campaignKingdomId,
    setCampaignKingdomId,
    referenceOverlay,
    setReferenceOverlay,
    focusTarget,
    jumpToHex,
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
    activeCultureId,
    setActiveCultureId,
    cultureSubTool,
    setCultureSubTool,
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
    sculptElevationAt,
    paintBiomeAt,
    paintTerritoryAt,
    paintReligionAt,
    paintCultureAt,
    endStroke,
    floodFillAt,
    floodFillBiomeAt,
    floodFillTerritoryAt,
    floodFillReligionAt,
    floodFillCultureAt,
    placeOrSelectCityAt,
    updateCity,
    deleteCity,
    createTradeRouteBetweenCities,
    handleTradeCityClick,
    runAutoRivers,
    runAutoTerritories,
    runAutoReligions,
    runAutoCultures,
    updateKingdoms,
    updateReligions,
    updateCultures,
    runGenerateWorld,
    runRecomputeClimateBiomes,
    runSyncShallowWater,
    runAutoGenerateCliffs,
    applyMapResize,
    loadImportedMap,
    clearMapEdits,
    addCustomBiome,
    updateCustomBiome,
    deleteCustomBiome,
    addCustomTerrain,
    updateCustomTerrain,
    deleteCustomTerrain,
    setTerrainOverride,
    resetTerrainOverride,
    addCustomFeature,
    updateCustomFeature,
    deleteCustomFeature,
    setFeatureOverride,
    resetFeatureOverride,
    eraseCurrentNear,
    addCustomPoiType,
    deleteCustomPoiType,
    eraseRoadNear,
    addCustomGovernmentType,
    deleteCustomGovernmentType,
    addCustomReligionType,
    deleteCustomReligionType,
    addCustomCultureType,
    deleteCustomCultureType,
    ensureTimeline,
    switchEra,
    createEraFromCurrent,
    saveActiveEra,
    updateTimelineMeta,
    setMapTheme,
    upsertDiplomacy,
    addCampaign,
    updateCampaign,
    deleteCampaign,
    eraseCampaignNear,
    addWikiEntry,
    updateWikiEntry,
    deleteWikiEntry,
    addBookmark,
    deleteBookmark,
    updateMapLabel,
    deleteMapLabel,
    activeSeason,
    setActiveSeason,
    pendingSubMapBounds,
    setPendingSubMapBounds,
    updateCalendar,
    tectonicEditPlateId,
    setTectonicEditPlateId,
    tectonicSubTool,
    setTectonicSubTool,
    tectonicAddOceanic,
    setTectonicAddOceanic,
    selectedTectonicPlateId,
    setSelectedTectonicPlateId,
    beginTectonicDrag,
    liveUpdateCustomTectonicPlates,
    endTectonicDrag,
    updateCustomTectonicPlates,
    initCustomTectonicPlates,
    applyTectonicPreset,
    addTectonicPlateAt,
    deleteTectonicPlateById,
    placeOrMoveTectonicPlateAt,
    runApplyTectonicsToCurrentMap,
    runGenerateWorldFromTectonics,
    runAutoPlaceFeatures,
    runSimulateAllFromCurrentMap,
  };
}
