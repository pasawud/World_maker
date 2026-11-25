import React, { useMemo } from 'react';
import {
  Camera,
  Crown,
  Download,
  Eraser,
  Flame,
  Mountain,
  Plus,
  Ruler,
  Sparkles,
  Store,
  Trash2,
  Upload,
  Waves,
} from 'lucide-react';
import { getAllBiomes } from '../data/biomes';
import { SPECIAL_FEATURES } from '../data/features';
import { getAllPoiTypes, GOVERNMENT_TYPES, TRAVEL_SPEEDS } from '../data/goods';
import { computeRealDimensions, findHexPath, realDistanceKm } from '../engine/hexMath';
import { computeReligionStats, computeTerritoryStats } from '../engine/politics';
import {
  BiomeId,
  City,
  ClimateOverlay,
  GeographyConfig,
  HexCoord,
  HexMapData,
  ToolMode,
  TradeMode,
  TravelSpeedId,
} from '../types/map';
import { CityInspector } from './CityInspector';
import { ClimateGeneratorPanel } from './ClimateGeneratorPanel';

interface RightSidebarProps {
  map: HexMapData;
  tool: ToolMode;
  activeBiome: number;
  onSelectBiome: (b: number) => void;
  activeFeature: string | null;
  onSelectFeature: (f: string | null) => void;
  autoShallowWater: boolean;
  onToggleAutoShallowWater: () => void;
  onSyncShallowWater: () => void;
  onAutoGenerateCliffs: () => void;
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
  onOpenCustomModal: (tab: 'biomes' | 'pois') => void;
  onOpenExportModal: () => void;
  onQuickPngExport: () => void;
  onClearMap: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = (props) => {
  const {
    map,
    tool,
    activeBiome,
    onSelectBiome,
    activeFeature,
    onSelectFeature,
    autoShallowWater,
    onToggleAutoShallowWater,
    onSyncShallowWater,
    onAutoGenerateCliffs,
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
    onOpenExportModal,
    onQuickPngExport,
    onClearMap,
  } = props;

  const allBiomes = useMemo(() => getAllBiomes(map.customBiomes), [map.customBiomes]);
  const allPoiTypes = useMemo(() => getAllPoiTypes(map.customPoiTypes), [map.customPoiTypes]);

  const biomeCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const b of map.biomes) counts.set(b, (counts.get(b) ?? 0) + 1);
    return counts;
  }, [map.biomes]);

  const landHexCount = useMemo(() => {
    let n = 0;
    for (const b of map.biomes) {
      if (b !== BiomeId.DEEP_OCEAN && b !== BiomeId.SHALLOW_WATER) n++;
    }
    return n;
  }, [map.biomes]);

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
          onDelete={() => onDeleteCity(selectedCity.id)}
          onClose={onCloseCity}
        />
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

          <div className="space-y-1 max-h-44 overflow-y-auto">
            {map.kingdoms.map((k) => {
              const st = territoryStats.find((s) => s.kingdomId === k.id);
              const gov = GOVERNMENT_TYPES.find((g) => g.id === k.government)?.label ?? k.government;
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

          <div className="space-y-1 max-h-44 overflow-y-auto">
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

          <button
            onClick={onAutoReligions}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/50 text-purple-200 text-xs font-medium cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            แพร่เขตศาสนาอัตโนมัติจากเมือง
          </button>
        </div>
      )}

      {tool === 'climate' && (
        <ClimateGeneratorPanel
          config={map.geography}
          overlay={climateOverlay}
          onChangeOverlay={onChangeOverlay}
          onGenerateWorld={onGenerateWorld}
          onAutoRivers={onAutoRivers}
          onRecomputeBiomes={onRecomputeBiomes}
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
        </div>
      )}

      {/* Special Features Palette (Matching user screenshot 2) */}
      <div className="bg-[#151d28] border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-200">ลักษณะพิเศษ</h3>
          {activeFeature !== null && (
            <button
              onClick={() => onSelectFeature(null)}
              className="text-[10px] text-amber-300 hover:underline cursor-pointer"
            >
              กลับไประบายไบโอม
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SPECIAL_FEATURES.map((f) => {
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
        </div>
      </div>

      {/* Biome Legend & Custom Biome Button */}
      <div className="bg-[#151d28] border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-200">ภูมิประเทศ & ไบโอม</h3>
          <button
            onClick={() => onOpenCustomModal('biomes')}
            className="flex items-center gap-0.5 text-[11px] text-amber-300 hover:text-amber-200 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            เพิ่มไบโอมเอง
          </button>
        </div>

        <div className="space-y-0.5 max-h-60 overflow-y-auto pr-0.5">
          {allBiomes.map((b) => {
            const count = biomeCounts.get(b.id) ?? 0;
            const selected = activeFeature === null && activeBiome === b.id;
            return (
              <button
                key={b.id}
                onClick={() => {
                  onSelectFeature(null);
                  onSelectBiome(b.id);
                }}
                className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition cursor-pointer ${
                  selected
                    ? 'bg-amber-500/18 border border-amber-500/60 text-amber-100'
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
      </div>

      {/* POIs Legend & Custom POI Button */}
      <div className="bg-[#151d28] border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-200">สถานที่น่าสนใจ</h3>
          <button
            onClick={() => onOpenCustomModal('pois')}
            className="flex items-center gap-0.5 text-[11px] text-amber-300 hover:text-amber-200 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            เพิ่ม POI เอง
          </button>
        </div>
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
      </div>

      {/* Summary & Export Actions */}
      <div className="bg-[#151d28] border border-slate-800 rounded-lg p-3 space-y-2.5">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
          ข้อมูลแผนที่
        </h3>
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
      </div>
    </aside>
  );
};
