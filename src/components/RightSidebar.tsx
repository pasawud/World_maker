import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronRight,
  Compass,
  Crown,
  Download,
  Eraser,
  Flame,
  Landmark,
  Mountain,
  Plus,
  Ruler,
  SlidersHorizontal,
  Sparkles,
  Store,
  Swords,
  Trash2,
  Upload,
  Waves,
  Wind,
} from 'lucide-react';
import { getPaintableBiomes } from '../data/biomes';
import { getAllFeatures } from '../data/features';
import {
  getAllCultureTypes,
  getAllGovernmentTypes,
  getAllPoiTypes,
  getAllReligionTypes,
  TRAVEL_SPEEDS,
} from '../data/goods';
import { getAllTerrains } from '../data/terrains';
import { formatElevationMeters } from '../engine/elevation';
import {
  computeRealDimensions,
  findHexPath,
  getHexTerrain,
  isWaterBiome,
  realDistanceKm,
} from '../engine/hexMath';
import {
  computeCultureStats,
  computeReligionStats,
  computeTerritoryStats,
} from '../engine/politics';
import {
  City,
  ClimateOverlay,
  Culture,
  CultureType,
  CustomTectonicPlate,
  GeographyConfig,
  GovernmentType,
  HexCoord,
  HexMapData,
  Kingdom,
  ManualWindKind,
  MapLabel,
  MilitaryCampaign,
  Religion,
  ReligionType,
  ToolMode,
  TradeMode,
  TravelSpeedId,
  WindMode,
} from '../types/map';
import { CityInspector } from './CityInspector';
import { ClimateGeneratorPanel } from './ClimateGeneratorPanel';

interface RightSidebarProps {
  map: HexMapData;
  tool: ToolMode;
  activeTerrain: number;
  onSelectTerrain: (t: number) => void;
  terrainEditMode: 'paint' | 'sculpt';
  onChangeTerrainEditMode: (m: 'paint' | 'sculpt') => void;
  currentKind: 'warm' | 'cold' | 'neutral';
  onChangeCurrentKind: (k: 'warm' | 'cold' | 'neutral') => void;
  currentDrawStrength: number;
  onChangeCurrentDrawStrength: (n: number) => void;
  onUpdateGeography: (patch: Partial<GeographyConfig>) => void;
  onDeleteManualCurrent: (id: string) => void;
  windKind: ManualWindKind;
  onChangeWindKind: (k: ManualWindKind) => void;
  windDrawStrength: number;
  onChangeWindDrawStrength: (n: number) => void;
  onDeleteManualWind: (id: string) => void;
  onOpenLinkedMap?: (mapId: string) => void;
  onOpenParentMap?: () => void;
  activeBiome: number;
  onSelectBiome: (b: number) => void;
  activeFeature: string | null;
  onSelectFeature: (f: string | null) => void;
  autoShallowWater: boolean;
  onToggleAutoShallowWater: () => void;
  onSyncShallowWater: () => void;
  onAutoGenerateCliffs: () => void;
  onAutoPlaceFeatures: () => void;
  tectonicEditPlateId: string | null;
  onInitCustomPlates: () => void;
  onUpdateCustomPlates: (plates: CustomTectonicPlate[] | undefined) => void;
  onStartPlacePlate: (plateId: string | null) => void;
  onApplyTectonicsToCurrent: (strength?: number) => void;
  onOpenSimulateModal: () => void;
  brushSize: number;
  onChangeBrushSize: (n: number) => void;
  activeKingdomId: string;
  onSelectKingdomId: (id: string) => void;
  territorySubTool: 'brush' | 'fill' | 'erase';
  onChangeTerritorySubTool: (t: 'brush' | 'fill' | 'erase') => void;
  onAutoTerritories: () => void;
  activeReligionId: string;
  onSelectReligionId: (id: string) => void;
  religionSubTool: 'brush' | 'fill' | 'erase';
  onChangeReligionSubTool: (t: 'brush' | 'fill' | 'erase') => void;
  onAutoReligions: () => void;
  activeCultureId: string;
  onSelectCultureId: (id: string) => void;
  cultureSubTool: 'brush' | 'fill' | 'erase';
  onChangeCultureSubTool: (t: 'brush' | 'fill' | 'erase') => void;
  onAutoCultures: () => void;
  onUpdateKingdoms: (kingdoms: Kingdom[]) => void;
  onUpdateReligions: (religions: Religion[]) => void;
  onUpdateCultures: (cultures: Culture[]) => void;
  onOpenCityTrade: (cityId: string) => void;
  onOpenCityBlueprint: (cityId: string) => void;
  onOpenLore: (kind: 'kingdom' | 'religion' | 'culture', id: string) => void;
  selectedCity: City | null;
  onUpdateCity: (id: string, patch: Partial<City>) => void;
  onDeleteCity: (id: string) => void;
  onCloseCity: () => void;
  climateOverlay: ClimateOverlay;
  onChangeOverlay: (o: ClimateOverlay) => void;
  onGenerateWorld: (cfg: GeographyConfig) => void;
  onAutoRivers: () => void;
  onRecomputeBiomes: (cfg: GeographyConfig) => void;
  measurePoints: HexCoord[];
  measureMode: 'straight' | 'terrain';
  onChangeMeasureMode: (m: 'straight' | 'terrain') => void;
  travelSpeed: TravelSpeedId;
  onChangeTravelSpeed: (s: TravelSpeedId) => void;
  onClearMeasure: () => void;
  tradeMode: TradeMode;
  onChangeTradeMode: (m: TradeMode) => void;
  tradeStartCityId: string | null;
  onCancelTradeStart: () => void;
  onOpenCustomModal: (tab: 'terrains' | 'biomes' | 'features' | 'pois') => void;
  onOpenWorldbuildingModal: () => void;
  campaignKingdomId: string;
  onChangeCampaignKingdomId: (id: string) => void;
  onUpdateCampaign: (id: string, patch: Partial<MilitaryCampaign>) => void;
  onDeleteCampaign: (id: string) => void;
  onUpdateMapLabel: (id: string, patch: Partial<MapLabel>) => void;
  onDeleteMapLabel: (id: string) => void;
  onJumpToCoord: (q: number, r: number, zoom?: number) => void;
  onOpenExportModal: () => void;
  onQuickPngExport: () => void;
  onClearMap: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = (props) => {
  const {
    map,
    tool,
    activeTerrain,
    onSelectTerrain,
    terrainEditMode,
    onChangeTerrainEditMode,
    currentKind,
    onChangeCurrentKind,
    currentDrawStrength,
    onChangeCurrentDrawStrength,
    onUpdateGeography,
    onDeleteManualCurrent,
    windKind,
    onChangeWindKind,
    windDrawStrength,
    onChangeWindDrawStrength,
    onDeleteManualWind,
    onOpenLinkedMap,
    onOpenParentMap,
    activeBiome,
    onSelectBiome,
    activeFeature,
    onSelectFeature,
    autoShallowWater,
    onToggleAutoShallowWater,
    onSyncShallowWater,
    onAutoGenerateCliffs,
    onAutoPlaceFeatures,
    tectonicEditPlateId,
    onInitCustomPlates,
    onUpdateCustomPlates,
    onStartPlacePlate,
    onApplyTectonicsToCurrent,
    onOpenSimulateModal,
    brushSize,
    onChangeBrushSize,
    activeKingdomId,
    onSelectKingdomId,
    territorySubTool,
    onChangeTerritorySubTool,
    onAutoTerritories,
    activeReligionId,
    onSelectReligionId,
    religionSubTool,
    onChangeReligionSubTool,
    onAutoReligions,
    activeCultureId,
    onSelectCultureId,
    cultureSubTool,
    onChangeCultureSubTool,
    onAutoCultures,
    onUpdateKingdoms,
    onUpdateReligions,
    onUpdateCultures,
    onOpenCityTrade,
    onOpenCityBlueprint,
    onOpenLore,
    selectedCity,
    onUpdateCity,
    onDeleteCity,
    onCloseCity,
    climateOverlay,
    onChangeOverlay,
    onGenerateWorld,
    onAutoRivers,
    onRecomputeBiomes,
    measurePoints,
    measureMode,
    onChangeMeasureMode,
    travelSpeed,
    onChangeTravelSpeed,
    onClearMeasure,
    tradeMode,
    onChangeTradeMode,
    tradeStartCityId,
    onCancelTradeStart,
    onOpenCustomModal,
    onOpenWorldbuildingModal,
    campaignKingdomId,
    onChangeCampaignKingdomId,
    onUpdateCampaign,
    onDeleteCampaign,
    onUpdateMapLabel,
    onDeleteMapLabel,
    onJumpToCoord,
    onOpenExportModal,
    onQuickPngExport,
    onClearMap,
  } = props;

  const allTerrains = useMemo(
    () => getAllTerrains(map.customTerrains, map.terrainOverrides),
    [map.customTerrains, map.terrainOverrides]
  );
  const allFeatures = useMemo(
    () => getAllFeatures(map.customFeatures, map.featureOverrides),
    [map.customFeatures, map.featureOverrides]
  );
  const paintableBiomes = useMemo(() => getPaintableBiomes(map.customBiomes), [map.customBiomes]);

  const [openSections, setOpenSections] = useState<
    Record<'features' | 'terrains' | 'biomes' | 'pois' | 'summary', boolean>
  >({
    features: false,
    terrains: true,
    biomes: false,
    pois: false,
    summary: true,
  });

  useEffect(() => {
    setOpenSections((prev) => {
      if (tool === 'terrain') return { ...prev, terrains: true, features: true };
      if (tool === 'biome') return { ...prev, biomes: true };
      if (tool === 'poi') return { ...prev, pois: true };
      return prev;
    });
  }, [tool]);

  const toggleSection = (k: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [k]: !prev[k] }));
  };
  const allPoiTypes = useMemo(() => getAllPoiTypes(map.customPoiTypes), [map.customPoiTypes]);
  const govTypes = useMemo(
    () => getAllGovernmentTypes(map.customGovernmentTypes),
    [map.customGovernmentTypes]
  );
  const relTypes = useMemo(
    () => getAllReligionTypes(map.customReligionTypes),
    [map.customReligionTypes]
  );
  const cultTypes = useMemo(
    () => getAllCultureTypes(map.customCultureTypes),
    [map.customCultureTypes]
  );

  const terrainCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (let i = 0; i < map.biomes.length; i++) {
      const tId = getHexTerrain(map, i);
      counts.set(tId, (counts.get(tId) ?? 0) + 1);
    }
    return counts;
  }, [map]);

  const biomeCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const b of map.biomes) counts.set(b, (counts.get(b) ?? 0) + 1);
    return counts;
  }, [map.biomes]);

  const landHexCount = useMemo(() => {
    let n = 0;
    for (const b of map.biomes) {
      if (!isWaterBiome(b, map.customBiomes)) n++;
    }
    return n;
  }, [map.biomes, map.customBiomes]);

  const dims = useMemo(
    () => computeRealDimensions(map.width, map.height, map.hexSizeKm),
    [map.width, map.height, map.hexSizeKm]
  );

  const poiCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of map.pois) counts.set(p.type, (counts.get(p.type) ?? 0) + 1);
    return counts;
  }, [map.pois]);

  const territoryStats = useMemo(() => computeTerritoryStats(map), [map]);
  const religionStats = useMemo(() => computeReligionStats(map), [map]);
  const cultureStats = useMemo(() => computeCultureStats(map), [map]);

  const activeKingdom = map.kingdoms.find((k) => k.id === activeKingdomId) ?? map.kingdoms[0] ?? null;
  const activeReligion =
    map.religionList.find((r) => r.id === activeReligionId) ?? map.religionList[0] ?? null;
  const activeCulture =
    (map.cultureList ?? []).find((c) => c.id === activeCultureId) ??
    (map.cultureList ?? [])[0] ??
    null;

  const measureStats = useMemo(() => {
    if (measurePoints.length < 2) return null;
    let straightKm = 0;
    let terrainKm = 0;
    let reachableAll = true;
    for (let i = 0; i < measurePoints.length - 1; i++) {
      const a = measurePoints[i];
      const b = measurePoints[i + 1];
      straightKm += realDistanceKm(a, b, map.hexSizeKm);
      if (measureMode === 'terrain') {
        const res = findHexPath(map, a, b, 'mixed');
        if (res.reachable) terrainKm += res.distanceKm;
        else reachableAll = false;
      }
    }
    const km = measureMode === 'terrain' && reachableAll ? terrainKm : straightKm;
    const speedObj = TRAVEL_SPEEDS.find((s) => s.id === travelSpeed) ?? TRAVEL_SPEEDS[1];
    return {
      straightKm: Math.round(straightKm),
      terrainKm: reachableAll ? Math.round(terrainKm) : null,
      days: Number((km / speedObj.kmPerDay).toFixed(1)),
      speedLabel: speedObj.label,
    };
  }, [map, measureMode, measurePoints, travelSpeed]);

  const tradeStartCity = tradeStartCityId
    ? map.cities.find((c) => c.id === tradeStartCityId)
    : null;

  return (
    <aside className="w-72 xl:w-80 bg-[#111720] border-l border-slate-800/90 flex flex-col shrink-0 overflow-y-auto p-3 space-y-3 select-none">
      {/* Contextual Panels */}
      {selectedCity && (
        <CityInspector
          city={selectedCity}
          map={map}
          onUpdate={(patch) => onUpdateCity(selectedCity.id, patch)}
          onOpenTradeWindow={() => onOpenCityTrade(selectedCity.id)}
          onOpenBlueprint={() => onOpenCityBlueprint(selectedCity.id)}
          onDelete={() => onDeleteCity(selectedCity.id)}
          onClose={onCloseCity}
        />
      )}

      {tool === 'current' && (
        <div className="bg-[#151d28] border border-sky-500/40 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-sky-300 flex items-center gap-1.5">
              <Wind className="w-4 h-4" />
              ระบบกระแสน้ำมหาสมุทร
            </h3>
            <button
              onClick={() => onChangeOverlay(climateOverlay === 'currents' ? 'none' : 'currents')}
              className={`px-2 py-0.5 rounded text-[10px] border cursor-pointer ${
                climateOverlay === 'currents'
                  ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                  : 'border-slate-700 text-slate-300'
              }`}
            >
              {climateOverlay === 'currents' ? 'กำลังดูโหมดกระแสน้ำ' : 'เปิดโหมดกระแสน้ำ'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[11px]">
            {[
              { id: 'warm' as const, label: 'น้ำอุ่น' },
              { id: 'cold' as const, label: 'น้ำเย็น' },
              { id: 'neutral' as const, label: 'กระแสกลาง' },
            ].map((k) => (
              <button
                key={k.id}
                onClick={() => onChangeCurrentKind(k.id)}
                className={`py-1 rounded border cursor-pointer ${
                  currentKind === k.id
                    ? k.id === 'warm'
                      ? 'bg-orange-500/25 border-orange-400 text-orange-200'
                      : k.id === 'cold'
                      ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                      : 'bg-teal-500/25 border-teal-400 text-teal-200'
                    : 'bg-[#0f1620] border-slate-800 text-slate-400'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 text-[11px] bg-[#0f1620] border border-slate-800 rounded p-2">
            <div>
              <div className="flex justify-between text-slate-300">
                <span>กำลังวาดกระแสน้ำ</span>
                <span className="text-amber-300">{currentDrawStrength.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.4}
                max={2.0}
                step={0.1}
                value={currentDrawStrength}
                onChange={(e) => onChangeCurrentDrawStrength(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300">
                <span>แรงกระแสน้ำโลก (Global)</span>
                <span className="text-sky-300">{(map.geography.currentStrength ?? 1).toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={2.0}
                step={0.1}
                value={map.geography.currentStrength ?? 1.0}
                onChange={(e) =>
                  onUpdateGeography({ currentStrength: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <span className="text-slate-400">การหมุน Coriolis</span>
              <div className="flex gap-1">
                <button
                  onClick={() => onUpdateGeography({ coriolisDirection: 'normal' })}
                  className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer ${
                    (map.geography.coriolisDirection ?? 'normal') === 'normal'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-[#151d28] border-slate-800 text-slate-400'
                  }`}
                >
                  ปกติ
                </button>
                <button
                  onClick={() => onUpdateGeography({ coriolisDirection: 'reversed' })}
                  className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer ${
                    map.geography.coriolisDirection === 'reversed'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-[#151d28] border-slate-800 text-slate-400'
                  }`}
                >
                  กลับทิศ
                </button>
              </div>
            </div>
          </div>

          {(map.manualCurrents ?? []).length > 0 && (
            <div className="space-y-1 max-h-36 overflow-y-auto">
              <div className="text-[11px] text-slate-400">
                กระแสน้ำที่วาดเอง ({map.manualCurrents!.length} สาย)
              </div>
              {map.manualCurrents!.map((mc, idx) => (
                <div
                  key={mc.id}
                  className="flex items-center justify-between px-2 py-1 rounded bg-[#0f1620] border border-slate-800 text-[11px]"
                >
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          mc.kind === 'warm' ? '#fb923c' : mc.kind === 'cold' ? '#38bdf8' : '#2dd4bf',
                      }}
                    />
                    <span>
                      สายที่ {idx + 1} (
                      {mc.kind === 'warm' ? 'น้ำอุ่น' : mc.kind === 'cold' ? 'น้ำเย็น' : 'กลาง'} ·{' '}
                      {mc.strength.toFixed(1)}x)
                    </span>
                  </span>
                  <button
                    onClick={() => onDeleteManualCurrent(mc.id)}
                    className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    title="ลบกระแสน้ำสายนี้"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tool === 'wind' && (
        <div className="bg-[#151d28] border border-cyan-500/40 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-1.5">
              <Compass className="w-4 h-4" />
              ระบบทิศทางลมและการเดินเรือ
            </h3>
            <button
              onClick={() => onChangeOverlay(climateOverlay === 'winds' ? 'none' : 'winds')}
              className={`px-2 py-0.5 rounded text-[10px] border cursor-pointer ${
                climateOverlay === 'winds'
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                  : 'border-slate-700 text-slate-300'
              }`}
            >
              {climateOverlay === 'winds' ? 'กำลังดูโหมดลม' : 'เปิดโหมดลม'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[10px]">
            {(
              [
                ['trade', 'ลมค้า (Trade)'],
                ['westerlies', 'ตะวันตก'],
                ['monsoon', 'มรสุม'],
                ['gale', 'พายุแรง'],
                ['calm', 'เขตลมสงบ'],
              ] as [ManualWindKind, string][]
            ).map(([id, lbl]) => (
              <button
                key={id}
                onClick={() => onChangeWindKind(id)}
                className={`py-1 px-1 rounded border cursor-pointer truncate ${
                  windKind === id
                    ? id === 'gale'
                      ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                      : id === 'calm'
                      ? 'bg-slate-600/35 border-slate-400 text-slate-200'
                      : 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                    : 'bg-[#0f1620] border-slate-800 text-slate-400'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 text-[11px] bg-[#0f1620] border border-slate-800 rounded p-2">
            <div>
              <label className="block text-slate-400 mb-0.5">รูปแบบลมหลักของโลก</label>
              <select
                value={map.geography.windMode}
                onChange={(e) => onUpdateGeography({ windMode: e.target.value as WindMode })}
                className="w-full bg-[#151d28] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100 outline-none"
              >
                <option value="latitude">ตามแถบละติจูดจริง (Trade Winds & Westerlies)</option>
                <option value="monsoon">มรสุมเขตร้อน + ลมประจำถิ่น (Monsoon)</option>
                <option value="west">ลมพัดจากตะวันตก → ตะวันออก</option>
                <option value="east">ลมพัดจากตะวันออก → ตะวันตก</option>
                <option value="north">ลมพัดจากเหนือ → ใต้</option>
                <option value="south">ลมพัดจากใต้ → เหนือ</option>
                <option value="northeast">ลมมรสุมตะวันออกเฉียงเหนือ (NE → SW)</option>
                <option value="southwest">ลมมรสุมตะวันตกเฉียงใต้ (SW → NE)</option>
                <option value="northwest">ลมตะวันตกเฉียงเหนือ (NW → SE)</option>
                <option value="southeast">ลมตะวันออกเฉียงใต้ (SE → NW)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between text-slate-300">
                <span>กำลังวาดแนวลม / พายุ</span>
                <span className="text-amber-300">{windDrawStrength.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.4}
                max={1.8}
                step={0.1}
                value={windDrawStrength}
                onChange={(e) => onChangeWindDrawStrength(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300">
                <span>ความแรงลมทั่วโลก (Global Wind)</span>
                <span className="text-cyan-300">{(map.geography.windStrength ?? 1).toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={2.0}
                step={0.1}
                value={map.geography.windStrength ?? 1.0}
                onChange={(e) => onUpdateGeography({ windStrength: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          {(map.manualWinds ?? []).length > 0 && (
            <div className="space-y-1 max-h-36 overflow-y-auto">
              <div className="text-[11px] text-slate-400">
                แนวลมที่วาดเอง ({map.manualWinds!.length} แนว)
              </div>
              {map.manualWinds!.map((mw, idx) => (
                <div
                  key={mw.id}
                  className="flex items-center justify-between px-2 py-1 rounded bg-[#0f1620] border border-slate-800 text-[11px]"
                >
                  <span className="text-slate-200 truncate">
                    แนวลม #{idx + 1} ({mw.kind} · {mw.strength.toFixed(1)}x)
                  </span>
                  <button
                    onClick={() => onDeleteManualWind(mw.id)}
                    className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    title="ลบแนวลมนี้"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tool === 'campaign' && (
        <div className="bg-[#151d28] border border-rose-500/40 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-rose-300 flex items-center gap-1.5">
              <Swords className="w-4 h-4" />
              การเคลื่อนทัพ & สมรภูมิ
            </h3>
            <button
              onClick={onOpenWorldbuildingModal}
              className="px-2 py-0.5 rounded text-[10px] border border-amber-500/50 text-amber-200 hover:bg-amber-500/15 cursor-pointer"
            >
              หน้าต่างการทูต/Wiki
            </button>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">ฝ่ายที่เดินทัพ</label>
            <select
              value={campaignKingdomId}
              onChange={(e) => onChangeCampaignKingdomId(e.target.value)}
              className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
            >
              {map.kingdoms.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {(map.campaigns ?? []).length === 0 ? (
              <div className="text-[11px] text-slate-500">ลากบนแผนที่เพื่อสร้างเส้นทางเดินทัพ</div>
            ) : (
              map.campaigns!.map((cp) => (
                <div
                  key={cp.id}
                  className="bg-[#0f1620] border border-slate-800 rounded p-2 space-y-1 text-[11px]"
                >
                  <div className="flex items-center justify-between gap-1">
                    <input
                      value={cp.name}
                      onChange={(e) => onUpdateCampaign(cp.id, { name: e.target.value })}
                      className="flex-1 bg-transparent font-semibold text-slate-100 outline-none border-b border-transparent focus:border-amber-400"
                    />
                    <button
                      onClick={() => onDeleteCampaign(cp.id)}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <select
                      value={cp.status}
                      onChange={(e) =>
                        onUpdateCampaign(cp.id, {
                          status: e.target.value as MilitaryCampaign['status'],
                        })
                      }
                      className="bg-[#161f2c] border border-slate-700 rounded px-1.5 py-0.5 text-[10px]"
                    >
                      <option value="planned">วางแผน</option>
                      <option value="active">กำลังรุกคืบ</option>
                      <option value="victory">มีชัยชนะ</option>
                      <option value="defeat">พ่ายแพ้</option>
                    </select>
                    {cp.points[0] && (
                      <button
                        onClick={() => onJumpToCoord(cp.points[0].q, cp.points[0].r, 1.0)}
                        className="text-sky-300 hover:underline text-[10px] cursor-pointer"
                      >
                        ไปยังทัพ
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tool === 'poi' && map.labels.length > 0 && (
        <div className="bg-[#151d28] border border-amber-500/35 rounded-lg p-3 space-y-2">
          <h3 className="text-xs font-semibold text-amber-300">
            ป้ายชื่อภูมิภาค & ตัวอักษรโค้ง ({map.labels.length})
          </h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {map.labels.map((lbl) => (
              <div
                key={lbl.id}
                className="bg-[#0f1620] border border-slate-800 rounded p-2 space-y-1 text-[11px]"
              >
                <div className="flex items-center justify-between gap-1">
                  <input
                    value={lbl.text}
                    onChange={(e) => onUpdateMapLabel(lbl.id, { text: e.target.value })}
                    className="flex-1 bg-transparent text-slate-100 font-medium outline-none border-b border-transparent focus:border-amber-400"
                  />
                  <button
                    onClick={() => onDeleteMapLabel(lbl.id)}
                    className="text-slate-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-400">
                  <label className="flex items-center justify-between">
                    <span>เอียง {lbl.rotationDeg ?? 0}°</span>
                    <input
                      type="range"
                      min={-75}
                      max={75}
                      step={5}
                      value={lbl.rotationDeg ?? 0}
                      onChange={(e) =>
                        onUpdateMapLabel(lbl.id, { rotationDeg: Number(e.target.value) })
                      }
                      className="w-16"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>โค้ง {(lbl.curveAmount ?? 0).toFixed(1)}</span>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.1}
                      value={lbl.curveAmount ?? 0}
                      onChange={(e) =>
                        onUpdateMapLabel(lbl.id, { curveAmount: Number(e.target.value) })
                      }
                      className="w-16"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tool === 'territory' && (
        <div className="bg-[#151d28] border border-amber-500/40 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
              <Crown className="w-4 h-4" />
              การปกครอง & ดินแดน
            </h3>
            <button
              onClick={() => onChangeOverlay(climateOverlay === 'political' ? 'none' : 'political')}
              className={`px-2 py-0.5 rounded text-[10px] border cursor-pointer ${
                climateOverlay === 'political'
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                  : 'border-slate-700 text-slate-300'
              }`}
            >
              {climateOverlay === 'political' ? 'กำลังดูโหมดการปกครอง' : 'เปิดโหมดการปกครอง'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[11px]">
            {[
              { id: 'brush', label: 'ระบายดินแดน' },
              { id: 'fill', label: 'เทสีแคว้น' },
              { id: 'erase', label: 'ลบเขตแดน' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => onChangeTerritorySubTool(m.id as typeof territorySubTool)}
                className={`py-1 rounded border cursor-pointer ${
                  territorySubTool === m.id
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                    : 'bg-[#0f1620] border-slate-800 text-slate-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <span>ขนาดพู่กัน: {brushSize}</span>
            <input
              type="range"
              min={1}
              max={6}
              value={brushSize}
              onChange={(e) => onChangeBrushSize(Number(e.target.value))}
              className="flex-1"
            />
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-slate-400">รายชื่อดินแดน ({map.kingdoms.length})</span>
            <button
              onClick={() => {
                const newId = `kingdom_${Date.now().toString(36)}`;
                onUpdateKingdoms([
                  ...map.kingdoms,
                  {
                    id: newId,
                    name: `ดินแดนใหม่ ${map.kingdoms.length + 1}`,
                    color: '#38bdf8',
                    government: 'monarchy',
                  },
                ]);
                onSelectKingdomId(newId);
                if (territorySubTool === 'erase') onChangeTerritorySubTool('brush');
              }}
              className="flex items-center gap-0.5 text-[11px] text-amber-300 hover:text-amber-200 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              เพิ่มดินแดน
            </button>
          </div>

          <div className="space-y-1 max-h-40 overflow-y-auto">
            {map.kingdoms.map((k) => {
              const st = territoryStats.find((s) => s.kingdomId === k.id);
              const gov = govTypes.find((g) => g.id === k.government)?.label ?? k.government;
              const selected = activeKingdomId === k.id && territorySubTool !== 'erase';
              return (
                <button
                  key={k.id}
                  onClick={() => {
                    onSelectKingdomId(k.id);
                    if (territorySubTool === 'erase') onChangeTerritorySubTool('brush');
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded border text-xs transition cursor-pointer ${
                    selected
                      ? 'bg-amber-500/18 border-amber-500/60'
                      : 'bg-[#0f1620] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-slate-100">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: k.color }}
                      />
                      {k.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {st?.hexCount ?? 0} ช่อง
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between">
                    <span>{gov}</span>
                    <span>
                      {st?.cityCount ?? 0} เมือง · {(st?.population ?? 0).toLocaleString()} คน
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {activeKingdom && (
            <div className="bg-[#0f1620] border border-slate-800 rounded p-2 space-y-1.5">
              <div className="text-[10px] font-medium text-amber-300/90">
                ปรับแต่งดินแดนที่เลือก
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={activeKingdom.color}
                  onChange={(e) =>
                    onUpdateKingdoms(
                      map.kingdoms.map((k) =>
                        k.id === activeKingdom.id ? { ...k, color: e.target.value } : k
                      )
                    )
                  }
                  className="w-6 h-6 bg-transparent border-0 cursor-pointer shrink-0"
                  title="เปลี่ยนสีดินแดน"
                />
                <input
                  type="text"
                  value={activeKingdom.name}
                  onChange={(e) =>
                    onUpdateKingdoms(
                      map.kingdoms.map((k) =>
                        k.id === activeKingdom.id ? { ...k, name: e.target.value } : k
                      )
                    )
                  }
                  placeholder="ชื่อดินแดน..."
                  className="flex-1 min-w-0 bg-[#151d28] border border-slate-700 focus:border-amber-500 rounded px-2 py-1 text-xs text-slate-100 outline-none"
                />
              </div>
              <select
                value={activeKingdom.government}
                onChange={(e) =>
                  onUpdateKingdoms(
                    map.kingdoms.map((k) =>
                      k.id === activeKingdom.id
                        ? { ...k, government: e.target.value as GovernmentType }
                        : k
                    )
                  )
                }
                className="w-full bg-[#151d28] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 outline-none"
              >
                {govTypes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onOpenLore('kingdom', activeKingdom.id)}
                className="w-full flex items-center justify-center gap-1 py-1 rounded bg-[#1a2433] hover:bg-[#233044] border border-slate-700 text-[11px] text-amber-200 cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                ปรับแต่งละเอียด (ผู้นำ / กฎหมาย / ระบอบเอง)
              </button>
            </div>
          )}

          <button
            onClick={onAutoTerritories}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-xs font-medium cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            สร้างพรมแดนอัตโนมัติจากเมืองและภูเขา
          </button>
        </div>
      )}

      {tool === 'religion' && (
        <div className="bg-[#151d28] border border-purple-500/40 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-1.5">
              <Flame className="w-4 h-4" />
              ระบบศาสนา & ความเชื่อ
            </h3>
            <button
              onClick={() => onChangeOverlay(climateOverlay === 'religion' ? 'none' : 'religion')}
              className={`px-2 py-0.5 rounded text-[10px] border cursor-pointer ${
                climateOverlay === 'religion'
                  ? 'bg-purple-500/25 border-purple-400 text-purple-200'
                  : 'border-slate-700 text-slate-300'
              }`}
            >
              {climateOverlay === 'religion' ? 'กำลังดูเขตศาสนา' : 'เปิดมุมมองศาสนา'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[11px]">
            {[
              { id: 'brush', label: 'ระบายศาสนา' },
              { id: 'fill', label: 'เทสีเขต' },
              { id: 'erase', label: 'ลบเขต' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => onChangeReligionSubTool(m.id as typeof religionSubTool)}
                className={`py-1 rounded border cursor-pointer ${
                  religionSubTool === m.id
                    ? 'bg-purple-500/25 border-purple-400/70 text-purple-200'
                    : 'bg-[#0f1620] border-slate-800 text-slate-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <span>ขนาดพู่กัน: {brushSize}</span>
            <input
              type="range"
              min={1}
              max={6}
              value={brushSize}
              onChange={(e) => onChangeBrushSize(Number(e.target.value))}
              className="flex-1"
            />
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-slate-400">รายชื่อศาสนา ({map.religionList.length})</span>
            <button
              onClick={() => {
                const newId = `rel_${Date.now().toString(36)}`;
                onUpdateReligions([
                  ...map.religionList,
                  {
                    id: newId,
                    name: `ศาสนาใหม่ ${map.religionList.length + 1}`,
                    color: '#f472b6',
                    symbol: '🕊️',
                    type: 'monotheism',
                  },
                ]);
                onSelectReligionId(newId);
                if (religionSubTool === 'erase') onChangeReligionSubTool('brush');
              }}
              className="flex items-center gap-0.5 text-[11px] text-purple-300 hover:text-purple-200 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              เพิ่มศาสนา
            </button>
          </div>

          <div className="space-y-1 max-h-40 overflow-y-auto">
            {map.religionList.map((rel) => {
              const st = religionStats.find((s) => s.religionId === rel.id);
              const selected = activeReligionId === rel.id && religionSubTool !== 'erase';
              return (
                <button
                  key={rel.id}
                  onClick={() => {
                    onSelectReligionId(rel.id);
                    if (religionSubTool === 'erase') onChangeReligionSubTool('brush');
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded border text-xs transition cursor-pointer ${
                    selected
                      ? 'bg-purple-500/20 border-purple-400/70'
                      : 'bg-[#0f1620] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium text-slate-100">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: rel.color }}
                      />
                      <span>{rel.symbol}</span>
                      <span>{rel.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">{st?.hexCount ?? 0} ช่อง</span>
                  </div>
                </button>
              );
            })}
          </div>

          {activeReligion && (
            <div className="bg-[#0f1620] border border-slate-800 rounded p-2 space-y-1.5">
              <div className="text-[10px] font-medium text-purple-300/90">
                ปรับแต่งศาสนาที่เลือก
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={activeReligion.color}
                  onChange={(e) =>
                    onUpdateReligions(
                      map.religionList.map((r) =>
                        r.id === activeReligion.id ? { ...r, color: e.target.value } : r
                      )
                    )
                  }
                  className="w-6 h-6 bg-transparent border-0 cursor-pointer shrink-0"
                  title="เปลี่ยนสีศาสนา"
                />
                <input
                  type="text"
                  value={activeReligion.symbol}
                  onChange={(e) =>
                    onUpdateReligions(
                      map.religionList.map((r) =>
                        r.id === activeReligion.id ? { ...r, symbol: e.target.value } : r
                      )
                    )
                  }
                  className="w-9 text-center bg-[#151d28] border border-slate-700 rounded px-1 py-1 text-xs outline-none shrink-0"
                  title="สัญลักษณ์"
                />
                <input
                  type="text"
                  value={activeReligion.name}
                  onChange={(e) =>
                    onUpdateReligions(
                      map.religionList.map((r) =>
                        r.id === activeReligion.id ? { ...r, name: e.target.value } : r
                      )
                    )
                  }
                  placeholder="ชื่อศาสนา..."
                  className="flex-1 min-w-0 bg-[#151d28] border border-slate-700 focus:border-purple-400 rounded px-2 py-1 text-xs text-slate-100 outline-none"
                />
              </div>
              <select
                value={activeReligion.type}
                onChange={(e) =>
                  onUpdateReligions(
                    map.religionList.map((r) =>
                      r.id === activeReligion.id
                        ? { ...r, type: e.target.value as ReligionType }
                        : r
                    )
                  )
                }
                className="w-full bg-[#151d28] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 outline-none"
              >
                {relTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onOpenLore('religion', activeReligion.id)}
                className="w-full flex items-center justify-center gap-1 py-1 rounded bg-[#1a2433] hover:bg-[#233044] border border-slate-700 text-[11px] text-purple-200 cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                ปรับแต่งละเอียด (เทพเจ้า / คำสอน / พิธีกรรม)
              </button>
            </div>
          )}

          <button
            onClick={onAutoReligions}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/50 text-purple-200 text-xs font-medium cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            แพร่เขตศาสนาอัตโนมัติจากเมือง
          </button>
        </div>
      )}

      {tool === 'culture' && (
        <div className="bg-[#151d28] border border-teal-500/40 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-teal-300 flex items-center gap-1.5">
              <Landmark className="w-4 h-4" />
              วัฒนธรรม & อารยธรรม
            </h3>
            <button
              onClick={() => onChangeOverlay(climateOverlay === 'culture' ? 'none' : 'culture')}
              className={`px-2 py-0.5 rounded text-[10px] border cursor-pointer ${
                climateOverlay === 'culture'
                  ? 'bg-teal-500/25 border-teal-400 text-teal-200'
                  : 'border-slate-700 text-slate-300'
              }`}
            >
              {climateOverlay === 'culture' ? 'กำลังดูวัฒนธรรม' : 'เปิดมุมมองวัฒนธรรม'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[11px]">
            {[
              { id: 'brush', label: 'ระบายวัฒนธรรม' },
              { id: 'fill', label: 'เทสีเขต' },
              { id: 'erase', label: 'ลบเขต' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => onChangeCultureSubTool(m.id as typeof cultureSubTool)}
                className={`py-1 rounded border cursor-pointer ${
                  cultureSubTool === m.id
                    ? 'bg-teal-500/25 border-teal-400/70 text-teal-200'
                    : 'bg-[#0f1620] border-slate-800 text-slate-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <span>ขนาดพู่กัน: {brushSize}</span>
            <input
              type="range"
              min={1}
              max={6}
              value={brushSize}
              onChange={(e) => onChangeBrushSize(Number(e.target.value))}
              className="flex-1"
            />
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-slate-400">
              รายชื่อวัฒนธรรม ({(map.cultureList ?? []).length})
            </span>
            <button
              onClick={() => {
                const list = map.cultureList ?? [];
                const newId = `cult_${Date.now().toString(36)}`;
                onUpdateCultures([
                  ...list,
                  {
                    id: newId,
                    name: `วัฒนธรรมใหม่ ${list.length + 1}`,
                    color: '#2dd4bf',
                    symbol: '🏺',
                    type: 'agrarian',
                  },
                ]);
                onSelectCultureId(newId);
                if (cultureSubTool === 'erase') onChangeCultureSubTool('brush');
              }}
              className="flex items-center gap-0.5 text-[11px] text-teal-300 hover:text-teal-200 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              เพิ่มวัฒนธรรม
            </button>
          </div>

          <div className="space-y-1 max-h-40 overflow-y-auto">
            {(map.cultureList ?? []).map((cult) => {
              const st = cultureStats.find((s) => s.cultureId === cult.id);
              const cultLabel =
                cultTypes.find((ct) => ct.id === cult.type)?.label ?? cult.type;
              const selected = activeCultureId === cult.id && cultureSubTool !== 'erase';
              return (
                <button
                  key={cult.id}
                  onClick={() => {
                    onSelectCultureId(cult.id);
                    if (cultureSubTool === 'erase') onChangeCultureSubTool('brush');
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded border text-xs transition cursor-pointer ${
                    selected
                      ? 'bg-teal-500/20 border-teal-400/70'
                      : 'bg-[#0f1620] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium text-slate-100">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cult.color }}
                      />
                      <span>{cult.symbol}</span>
                      <span>{cult.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">{st?.hexCount ?? 0} ช่อง</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between">
                    <span>{cultLabel}</span>
                    <span>
                      {st?.cityCount ?? 0} เมือง · {(st?.population ?? 0).toLocaleString()} คน
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {activeCulture && (
            <div className="bg-[#0f1620] border border-slate-800 rounded p-2 space-y-1.5">
              <div className="text-[10px] font-medium text-teal-300/90">
                ปรับแต่งวัฒนธรรมที่เลือก
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={activeCulture.color}
                  onChange={(e) =>
                    onUpdateCultures(
                      (map.cultureList ?? []).map((c) =>
                        c.id === activeCulture.id ? { ...c, color: e.target.value } : c
                      )
                    )
                  }
                  className="w-6 h-6 bg-transparent border-0 cursor-pointer shrink-0"
                  title="เปลี่ยนสีวัฒนธรรม"
                />
                <input
                  type="text"
                  value={activeCulture.symbol}
                  onChange={(e) =>
                    onUpdateCultures(
                      (map.cultureList ?? []).map((c) =>
                        c.id === activeCulture.id ? { ...c, symbol: e.target.value } : c
                      )
                    )
                  }
                  className="w-9 text-center bg-[#151d28] border border-slate-700 rounded px-1 py-1 text-xs outline-none shrink-0"
                  title="สัญลักษณ์"
                />
                <input
                  type="text"
                  value={activeCulture.name}
                  onChange={(e) =>
                    onUpdateCultures(
                      (map.cultureList ?? []).map((c) =>
                        c.id === activeCulture.id ? { ...c, name: e.target.value } : c
                      )
                    )
                  }
                  placeholder="ชื่อวัฒนธรรม..."
                  className="flex-1 min-w-0 bg-[#151d28] border border-slate-700 focus:border-teal-400 rounded px-2 py-1 text-xs text-slate-100 outline-none"
                />
              </div>
              <select
                value={activeCulture.type}
                onChange={(e) =>
                  onUpdateCultures(
                    (map.cultureList ?? []).map((c) =>
                      c.id === activeCulture.id
                        ? { ...c, type: e.target.value as CultureType }
                        : c
                    )
                  )
                }
                className="w-full bg-[#151d28] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 outline-none"
              >
                {cultTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onOpenLore('culture', activeCulture.id)}
                className="w-full flex items-center justify-center gap-1 py-1 rounded bg-[#1a2433] hover:bg-[#233044] border border-slate-700 text-[11px] text-teal-200 cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                ปรับแต่งละเอียด (สถาปัตยกรรม / ภาษา / ประเพณี)
              </button>
            </div>
          )}

          <button
            onClick={onAutoCultures}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/50 text-teal-200 text-xs font-medium cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            แพร่วัฒนธรรมอัตโนมัติจากเมือง
          </button>
        </div>
      )}

      {tool === 'climate' && (
        <ClimateGeneratorPanel
          config={map.geography}
          overlay={climateOverlay}
          mapWidth={map.width}
          mapHeight={map.height}
          customTectonicPlates={map.customTectonicPlates}
          tectonicEditPlateId={tectonicEditPlateId}
          onChangeOverlay={onChangeOverlay}
          onGenerateWorld={onGenerateWorld}
          onAutoRivers={onAutoRivers}
          onRecomputeBiomes={onRecomputeBiomes}
          onInitCustomPlates={onInitCustomPlates}
          onUpdateCustomPlates={onUpdateCustomPlates}
          onStartPlacePlate={onStartPlacePlate}
          onApplyTectonicsToCurrent={onApplyTectonicsToCurrent}
          onAutoPlaceFeatures={onAutoPlaceFeatures}
          onOpenSimulateModal={onOpenSimulateModal}
        />
      )}

      {tool === 'measure' && (
        <div className="bg-[#151d28] border border-sky-500/40 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-sky-300 flex items-center gap-1.5">
              <Ruler className="w-4 h-4" />
              วัดระยะทางจริง
            </h3>
            {measurePoints.length > 0 && (
              <button
                onClick={onClearMeasure}
                className="text-[11px] text-slate-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <Eraser className="w-3 h-3" /> ล้างจุด
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            คลิกบนแผนที่เพื่อวางจุดวัดระยะต่อเนื่อง (ช่องละ {map.hexSizeKm} กม.)
          </p>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <button
              onClick={() => onChangeMeasureMode('terrain')}
              className={`py-1 rounded border cursor-pointer ${
                measureMode === 'terrain'
                  ? 'bg-sky-500/20 border-sky-500/60 text-sky-200'
                  : 'bg-[#0f1620] border-slate-800 text-slate-400'
              }`}
            >
              เลี่ยงเขาตามภูมิประเทศ
            </button>
            <button
              onClick={() => onChangeMeasureMode('straight')}
              className={`py-1 rounded border cursor-pointer ${
                measureMode === 'straight'
                  ? 'bg-sky-500/20 border-sky-500/60 text-sky-200'
                  : 'bg-[#0f1620] border-slate-800 text-slate-400'
              }`}
            >
              เส้นตรง
            </button>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">ความเร็วเดินทาง</label>
            <select
              value={travelSpeed}
              onChange={(e) => onChangeTravelSpeed(e.target.value as TravelSpeedId)}
              className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 outline-none"
            >
              {TRAVEL_SPEEDS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.label} ({s.kmPerDay} กม./วัน)
                </option>
              ))}
            </select>
          </div>

          {measureStats ? (
            <div className="bg-[#0f1620] border border-slate-800 rounded p-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">ระยะเส้นตรง:</span>
                <span className="text-slate-200 font-medium">
                  {measureStats.straightKm.toLocaleString()} กม.
                </span>
              </div>
              {measureStats.terrainKm !== null && (
                <div className="flex justify-between">
                  <span className="text-slate-400">ระยะตามเส้นทางจริง:</span>
                  <span className="text-sky-300 font-semibold">
                    {measureStats.terrainKm.toLocaleString()} กม.
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-800 pt-1">
                <span className="text-slate-400">เวลาเดินทางโดยประมาณ:</span>
                <span className="text-amber-300 font-semibold">{measureStats.days} วัน</span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 italic">
              วางอย่างน้อย 2 จุดเพื่อดูผลคำนวณ
            </div>
          )}
        </div>
      )}

      {tool === 'trade' && (
        <div className="bg-[#151d28] border border-amber-500/40 rounded-lg p-3 space-y-2">
          <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
            <Store className="w-4 h-4" />
            สร้างเส้นทางการค้า
          </h3>
          <p className="text-[11px] text-slate-400">
            คลิกเมืองต้นทาง แล้วคลิกเมืองปลายทาง ระบบจะคำนวณเส้นทางอ้อมภูเขา/ทะเลให้อัตโนมัติ
          </p>
          <div className="grid grid-cols-3 gap-1 text-[11px]">
            {[
              { id: 'land', label: 'ทางบก' },
              { id: 'sea', label: 'ทางเรือ' },
              { id: 'mixed', label: 'ผสม' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => onChangeTradeMode(m.id as TradeMode)}
                className={`py-1 rounded border cursor-pointer ${
                  tradeMode === m.id
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                    : 'bg-[#0f1620] border-slate-800 text-slate-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {tradeStartCity && (
            <div className="flex items-center justify-between bg-sky-950/50 border border-sky-700/50 rounded px-2 py-1 text-xs">
              <span className="text-sky-200">ต้นทาง: {tradeStartCity.name}</span>
              <button
                onClick={onCancelTradeStart}
                className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          )}
          {map.cities.length > 0 && (
            <div className="pt-1 border-t border-slate-800 space-y-1">
              <div className="text-[11px] text-slate-400">เปิดหน้าต่างการค้าของเมือง:</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {map.cities.map((c) => {
                  const cnt = map.tradeRoutes.filter(
                    (tr) => tr.fromCityId === c.id || tr.toCityId === c.id
                  ).length;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-[#0f1620] border border-slate-800 rounded px-2 py-1 text-xs"
                    >
                      <span className="text-slate-200 truncate">{c.name}</span>
                      <button
                        onClick={() => onOpenCityTrade(c.id)}
                        className="px-2 py-0.5 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-[10px] text-sky-200 shrink-0 cursor-pointer"
                      >
                        ดูการค้า ({cnt})
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Special Features Palette (Collapsible Accordion) */}
      <div className="bg-[#151d28] border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => toggleSection('features')}
            className="flex items-center gap-1 text-xs font-semibold text-slate-200 hover:text-amber-300 cursor-pointer"
          >
            {openSections.features ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>ลักษณะพิเศษ ({allFeatures.length})</span>
          </button>
          <div className="flex items-center gap-2">
            {activeFeature !== null && (
              <button
                onClick={() => onSelectFeature(null)}
                className="text-[10px] text-amber-300 hover:underline cursor-pointer"
              >
                กลับไประบายพื้น
              </button>
            )}
            <button
              onClick={() => onOpenCustomModal('features')}
              className="flex items-center gap-0.5 text-[11px] text-amber-300 hover:text-amber-200 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              เพิ่ม/ปรับแต่ง
            </button>
          </div>
        </div>

        {openSections.features && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {allFeatures.map((f) => {
                const active = activeFeature === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => onSelectFeature(active ? null : f.id)}
                    title={
                      f.placement === 'water'
                        ? 'วางบนช่องน้ำ/ทะเล'
                        : f.placement === 'coast'
                        ? 'วางบนชายฝั่ง'
                        : f.placement === 'any'
                        ? 'วางได้ทุกที่'
                        : 'วางบนพื้นดิน'
                    }
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition cursor-pointer ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-medium'
                        : 'bg-[#101720] border-slate-700/80 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                      style={{ backgroundColor: f.color }}
                    />
                    <span>{f.nameTh}</span>
                    {f.isCustom && (
                      <span className="text-[9px] text-violet-300">★</span>
                    )}
                  </button>
                );
              })}

              <button
                onClick={() => onSelectFeature(activeFeature === '' ? null : '')}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition cursor-pointer ${
                  activeFeature === ''
                    ? 'bg-rose-500/20 border-rose-400 text-rose-200 font-medium'
                    : 'bg-[#101720] border-slate-700/80 text-slate-400 hover:border-slate-500'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-[3px] bg-slate-500/60 border border-slate-400/50 shrink-0" />
                <span>ลบลักษณะพิเศษ</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <div className="text-[11px] font-medium text-slate-300">
                ระบบหน้าผา & น้ำตื้นอัตโนมัติ
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoShallowWater}
                  onChange={onToggleAutoShallowWater}
                  className="rounded border-slate-600 bg-[#0f1620] accent-sky-400 cursor-pointer"
                />
                <span>น้ำตื้นอัตโนมัติใกล้แผ่นดิน (เว้นหน้าผา)</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={onSyncShallowWater}
                  className="flex items-center justify-center gap-1 py-1 px-2 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-[11px] text-sky-200 transition cursor-pointer"
                  title="คำนวณทะเลน้ำตื้นรอบแผ่นดินทั้งหมด (ยกเว้นบริเวณที่มีหน้าผา)"
                >
                  <Waves className="w-3 h-3 shrink-0" />
                  <span className="truncate">อัปเดตน้ำตื้นทั้งแผนที่</span>
                </button>
                <button
                  onClick={onAutoGenerateCliffs}
                  className="flex items-center justify-center gap-1 py-1 px-2 rounded bg-stone-500/20 hover:bg-stone-500/30 border border-stone-500/50 text-[11px] text-stone-200 transition cursor-pointer"
                  title="สร้างหน้าผาตามชายฝั่งสูงชันและปรับทะเลน้ำตื้น/น้ำลึกอัตโนมัติ"
                >
                  <Mountain className="w-3 h-3 shrink-0" />
                  <span className="truncate">สร้างหน้าผาชายฝั่งอัตโนมัติ</span>
                </button>
              </div>
              <button
                onClick={onAutoPlaceFeatures}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/45 text-[11px] text-violet-200 transition cursor-pointer"
                title="วิเคราะห์แนวภูเขา แม่น้ำ ชายฝั่ง ทะเลทราย และแผ่นเปลือกโลก เพื่อวางลักษณะพิเศษอัตโนมัติทั้งแผนที่"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>วางลักษณะพิเศษอัตโนมัติ (ตามหลักภูมิศาสตร์)</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Physical Terrain (Collapsible Accordion) */}
      <div className="bg-[#151d28] border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => toggleSection('terrains')}
            className="flex items-center gap-1 text-xs font-semibold text-slate-200 hover:text-amber-300 cursor-pointer"
          >
            {openSections.terrains ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>ภูมิประเทศ ({allTerrains.length})</span>
          </button>
          <button
            onClick={() => onOpenCustomModal('terrains')}
            className="flex items-center gap-0.5 text-[11px] text-amber-300 hover:text-amber-200 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            เพิ่ม/ปรับแต่ง
          </button>
        </div>

        {openSections.terrains && (
          <div className="space-y-0.5">
            {allTerrains.map((t) => {
              const count = terrainCounts.get(t.id) ?? 0;
              const selected =
                tool === 'terrain' &&
                terrainEditMode === 'paint' &&
                activeFeature === null &&
                activeTerrain === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    onSelectFeature(null);
                    onChangeTerrainEditMode('paint');
                    onSelectTerrain(t.id);
                  }}
                  title={`${t.nameTh} · มาตรฐาน ${formatElevationMeters(t.defaultElevation)}`}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition cursor-pointer ${
                    selected
                      ? 'bg-amber-500/18 border border-amber-500/60 text-amber-100'
                      : 'hover:bg-[#1c2635] border border-transparent text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="w-3.5 h-3.5 rounded-sm border border-white/20 shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="truncate">
                      {t.nameTh}
                      {t.isCustom && (
                        <span className="ml-1 text-[9px] text-violet-300">[Custom]</span>
                      )}
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums ml-2">
                    {formatElevationMeters(t.defaultElevation)} · {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Ecological Biomes (Collapsible Accordion) */}
      <div className="bg-[#151d28] border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => toggleSection('biomes')}
            className="flex items-center gap-1 text-xs font-semibold text-slate-200 hover:text-emerald-300 cursor-pointer"
          >
            {openSections.biomes ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>ไบโอม ({paintableBiomes.length})</span>
          </button>
          <button
            onClick={() => onOpenCustomModal('biomes')}
            className="flex items-center gap-0.5 text-[11px] text-amber-300 hover:text-amber-200 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            เพิ่มไบโอมเอง
          </button>
        </div>

        {openSections.biomes && (
          <div className="space-y-0.5 max-h-60 overflow-y-auto pr-0.5">
            {paintableBiomes.map((b) => {
              const count = biomeCounts.get(b.id) ?? 0;
              const selected = tool === 'biome' && activeBiome === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    onSelectFeature(null);
                    onSelectBiome(b.id);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition cursor-pointer ${
                    selected
                      ? 'bg-emerald-500/18 border border-emerald-500/60 text-emerald-100'
                      : 'hover:bg-[#1c2635] border border-transparent text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="w-3.5 h-3.5 rounded-sm border border-white/20 shrink-0"
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="truncate">
                      {b.nameTh}
                      {b.isCustom && (
                        <span className="ml-1 text-[9px] text-violet-300">[Custom]</span>
                      )}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums ml-2">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* POIs Legend (Collapsible Accordion) */}
      <div className="bg-[#151d28] border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => toggleSection('pois')}
            className="flex items-center gap-1 text-xs font-semibold text-slate-200 hover:text-amber-300 cursor-pointer"
          >
            {openSections.pois ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>สถานที่น่าสนใจ ({allPoiTypes.length})</span>
          </button>
          <button
            onClick={() => onOpenCustomModal('pois')}
            className="flex items-center gap-0.5 text-[11px] text-amber-300 hover:text-amber-200 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            เพิ่ม POI เอง
          </button>
        </div>
        {openSections.pois && (
          <div className="space-y-1">
            {allPoiTypes.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-1.5 py-0.5 text-xs text-slate-300"
              >
                <span className="flex items-center gap-2">
                  <span>{p.symbol}</span>
                  <span>{p.label}</span>
                </span>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {poiCounts.get(p.id) ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary & Export Actions */}
      <div className="bg-[#151d28] border border-slate-800 rounded-lg p-3 space-y-2.5">
        <button
          onClick={() => toggleSection('summary')}
          className="flex items-center gap-1 text-xs font-semibold text-slate-200 uppercase tracking-wide cursor-pointer"
        >
          {openSections.summary ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>ข้อมูลแผนที่</span>
        </button>
        {openSections.summary && (
          <>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">พื้นที่แผ่นดิน</span>
            <span className="text-slate-200 font-medium">
              {landHexCount.toLocaleString()} ช่อง (
              {Math.round(landHexCount * dims.hexAreaKm2).toLocaleString()} ตร.กม.)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">แม่น้ำ / เมือง</span>
            <span className="text-slate-200 font-medium">
              {map.rivers.length} สาย / {map.cities.length} เมือง
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">ถนน / เส้นการค้า</span>
            <span className="text-slate-200 font-medium">
              {map.roads.length} / {map.tradeRoutes.length}
            </span>
          </div>
        </div>

        {(map.parentMapLink || (map.childSubMaps && map.childSubMaps.length > 0)) && (
          <div className="bg-[#0f1620] border border-slate-800 rounded p-2 space-y-1.5 text-[11px]">
            <div className="font-semibold text-sky-300">แผนที่แม่-ลูก (Linked Atlas)</div>
            {map.parentMapLink && onOpenParentMap && (
              <button
                onClick={onOpenParentMap}
                className="w-full py-1 px-2 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sky-200 text-left truncate cursor-pointer"
              >
                ← กลับไปยัง "{map.parentMapLink.parentMapName}"
              </button>
            )}
            {map.childSubMaps?.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between gap-1.5">
                <span className="text-slate-300 truncate">
                  🗺️ {sub.name} ({sub.scaleFactor}x)
                </span>
                {onOpenLinkedMap && (
                  <button
                    onClick={() => onOpenLinkedMap(sub.id)}
                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-[10px] shrink-0 cursor-pointer"
                  >
                    เปิดดู
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            onClick={onQuickPngExport}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-[#1d2735] hover:bg-[#263345] border border-slate-700 text-[11px] text-slate-200 transition cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            บันทึกภาพ PNG
          </button>
          <button
            onClick={onOpenExportModal}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-[#1d2735] hover:bg-[#263345] border border-slate-700 text-[11px] text-slate-200 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            ส่งออก JSON
          </button>
          <button
            onClick={onOpenExportModal}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-[#1d2735] hover:bg-[#263345] border border-slate-700 text-[11px] text-slate-200 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            โหลดไฟล์แผนที่
          </button>
          <button
            onClick={onClearMap}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-rose-950/35 hover:bg-rose-900/50 border border-rose-900/50 text-[11px] text-rose-300 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            ล้างแผนที่
          </button>
        </div>
          </>
        )}
      </div>
    </aside>
  );
};
