import React, { useEffect, useState } from 'react';
import {
  CloudRain,
  Compass,
  Crosshair,
  Globe,
  Layers,
  Mountain,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Waves,
  Wind,
} from 'lucide-react';
import {
  EARTH_REGION_PRESETS,
  LANDMASS_PRESETS,
  WIND_MODE_OPTIONS,
} from '../data/goods';
import {
  formatLatitude,
  formatLongitude,
  formatSeaLevelMeters,
} from '../engine/worldGenerator';
import {
  ClimateOverlay,
  CustomTectonicPlate,
  GeographyConfig,
  LandmassType,
  WindMode,
} from '../types/map';

interface ClimateGeneratorPanelProps {
  config: GeographyConfig;
  overlay: ClimateOverlay;
  mapWidth?: number;
  mapHeight?: number;
  customTectonicPlates?: CustomTectonicPlate[];
  tectonicEditPlateId?: string | null;
  onChangeOverlay: (o: ClimateOverlay) => void;
  onGenerateWorld: (cfg: GeographyConfig) => void;
  onAutoRivers: () => void;
  onRecomputeBiomes: (cfg: GeographyConfig) => void;
  onInitCustomPlates?: () => void;
  onUpdateCustomPlates?: (plates: CustomTectonicPlate[] | undefined) => void;
  onStartPlacePlate?: (plateId: string | null) => void;
  onApplyTectonicsToCurrent?: (strength?: number) => void;
  onAutoPlaceFeatures?: () => void;
  onOpenSimulateModal?: () => void;
  onOpenTectonicTool?: () => void;
}

export const ClimateGeneratorPanel: React.FC<ClimateGeneratorPanelProps> = ({
  config,
  overlay,
  mapWidth = 120,
  mapHeight = 80,
  customTectonicPlates,
  tectonicEditPlateId,
  onChangeOverlay,
  onGenerateWorld,
  onAutoRivers,
  onRecomputeBiomes,
  onInitCustomPlates,
  onUpdateCustomPlates,
  onStartPlacePlate,
  onApplyTectonicsToCurrent,
  onAutoPlaceFeatures,
  onOpenSimulateModal,
  onOpenTectonicTool,
}) => {
  const [draft, setDraft] = useState<GeographyConfig>(() => ({
    ...config,
    lonWest: config.lonWest ?? -180,
    lonEast: config.lonEast ?? 180,
  }));

  useEffect(() => {
    setDraft({
      ...config,
      lonWest: config.lonWest ?? -180,
      lonEast: config.lonEast ?? 180,
    });
  }, [config]);

  const lonWest = draft.lonWest ?? -180;
  const lonEast = draft.lonEast ?? 180;

  const randomizeSeed = () => {
    const seed = Math.floor(10000 + Math.random() * 89999);
    const next = { ...draft, seed };
    setDraft(next);
    onGenerateWorld(next);
  };

  const applyRealEarthDefaults = () => {
    const next: GeographyConfig = {
      ...draft,
      landmassType: 'real_earth',
      latNorth: 85,
      latSouth: -85,
      lonWest: -180,
      lonEast: 180,
      seaLevel: 0,
      windMode: 'latitude',
      mountainScale: 1.0,
      moistureScale: 1.0,
    };
    setDraft(next);
    onGenerateWorld(next);
  };

  const applyRegionPreset = (presetId: string) => {
    const p = EARTH_REGION_PRESETS.find((r) => r.id === presetId);
    if (!p) return;
    const next: GeographyConfig = {
      ...draft,
      latNorth: p.latNorth,
      latSouth: p.latSouth,
      lonWest: p.lonWest,
      lonEast: p.lonEast,
      seaLevel: p.seaLevel,
      windMode: p.windMode,
    };
    setDraft(next);
  };

  return (
    <div className="bg-[#151d28] border border-slate-700/80 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
          <Compass className="w-4 h-4" />
          ภูมิศาสตร์จริง & สร้างโลก
        </h3>
        <button
          onClick={applyRealEarthDefaults}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-[10px] font-medium text-sky-200 cursor-pointer shrink-0"
          title="ใช้แผนที่โลกจริง พิกัด 85°N–85°S, 180°W–180°E, ระดับน้ำ 0 ม. และลมตามละติจูดโลกจริง"
        >
          <Globe className="w-3 h-3" />
          เหมือนโลกจริง
        </button>
      </div>

      <div>
        <label className="block text-[11px] text-slate-400 mb-1">มุมมองชั้นข้อมูลแผนที่</label>
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: 'none', label: 'ปกติ (ผสม)' },
            { id: 'terrain', label: 'ภูมิประเทศ' },
            { id: 'biome', label: 'ไบโอม' },
            { id: 'political', label: 'การปกครอง' },
            { id: 'religion', label: 'ศาสนา' },
            { id: 'culture', label: 'วัฒนธรรม' },
            { id: 'elevation', label: 'ความสูง' },
            { id: 'temperature', label: 'อุณหภูมิ' },
            { id: 'moisture', label: 'ความชื้น & ลม' },
            { id: 'currents', label: 'กระแสน้ำ' },
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => onChangeOverlay(o.id as ClimateOverlay)}
              className={`px-1.5 py-1 rounded text-[11px] border transition cursor-pointer ${
                overlay === o.id
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                  : 'bg-[#0f1620] border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-slate-400 mb-1">Seed สุ่มโลก</label>
        <div className="flex gap-1.5">
          <input
            type="number"
            value={draft.seed}
            onChange={(e) => setDraft({ ...draft, seed: Number(e.target.value) || 1 })}
            className="flex-1 bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 outline-none"
          />
          <button
            onClick={randomizeSeed}
            className="px-2.5 py-1 rounded bg-[#1d2837] hover:bg-[#263447] border border-slate-700 text-xs text-amber-300 flex items-center gap-1 cursor-pointer"
            title="สุ่ม Seed ใหม่และสร้างทันที"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            สุ่ม
          </button>
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-slate-400 mb-1">รูปแบบแผ่นดิน (Landmass)</label>
        <select
          value={draft.landmassType}
          onChange={(e) => {
            const lm = e.target.value as LandmassType;
            setDraft({
              ...draft,
              landmassType: lm,
              lonWest: draft.lonWest ?? -180,
              lonEast: draft.lonEast ?? 180,
            });
          }}
          className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 outline-none"
        >
          {LANDMASS_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} — {p.desc}
            </option>
          ))}
        </select>
      </div>

      {/* Lat/Lon Presets + Controls */}
      <div className="bg-[#0f1620] border border-slate-800 rounded-md p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-sky-300 flex items-center gap-1">
            <Globe className="w-3 h-3" />
            พิกัดละติจูด – ลองจิจูด
          </span>
          <span className="text-[10px] text-slate-500">
            {formatLatitude(draft.latNorth)}..{formatLatitude(draft.latSouth)}
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {EARTH_REGION_PRESETS.map((p) => {
            const active =
              draft.latNorth === p.latNorth &&
              draft.latSouth === p.latSouth &&
              lonWest === p.lonWest &&
              lonEast === p.lonEast;
            return (
              <button
                key={p.id}
                onClick={() => applyRegionPreset(p.id)}
                className={`px-1.5 py-0.5 rounded border text-[10px] transition cursor-pointer ${
                  active
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-medium'
                    : 'bg-[#151d28] border-slate-700/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">
              ละติจูดเหนือ ({formatLatitude(draft.latNorth)})
            </label>
            <input
              type="range"
              min={-85}
              max={90}
              value={draft.latNorth}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDraft({
                  ...draft,
                  latNorth: Math.max(v, draft.latSouth + 5),
                });
              }}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">
              ละติจูดใต้ ({formatLatitude(draft.latSouth)})
            </label>
            <input
              type="range"
              min={-90}
              max={85}
              value={draft.latSouth}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDraft({
                  ...draft,
                  latSouth: Math.min(v, draft.latNorth - 5),
                });
              }}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">
              ลองจิจูดตะวันตก ({formatLongitude(lonWest)})
            </label>
            <input
              type="range"
              min={-180}
              max={170}
              value={lonWest}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDraft({
                  ...draft,
                  lonWest: Math.min(v, lonEast - 10),
                });
              }}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">
              ลองจิจูดตะวันออก ({formatLongitude(lonEast)})
            </label>
            <input
              type="range"
              min={-170}
              max={180}
              value={lonEast}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDraft({
                  ...draft,
                  lonEast: Math.max(v, lonWest + 10),
                });
              }}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Wind Direction (2D) */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1 text-[11px] text-slate-400">
          <Wind className="w-3.5 h-3.5 text-sky-400" />
          ทิศทางลม & ระบบลมประจำถิ่น (เกิด Rain Shadow)
        </label>
        <select
          value={draft.windMode}
          onChange={(e) => setDraft({ ...draft, windMode: e.target.value as WindMode })}
          className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 outline-none"
        >
          {WIND_MODE_OPTIONS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-5 gap-1">
          {WIND_MODE_OPTIONS.map((w) => (
            <button
              key={w.id}
              onClick={() => setDraft({ ...draft, windMode: w.id })}
              className={`py-0.5 px-1 rounded border text-[10px] truncate cursor-pointer ${
                draft.windMode === w.id
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-medium'
                  : 'bg-[#0f1620] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={w.label}
            >
              {w.short}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer pt-0.5 select-none">
          <input
            type="checkbox"
            checked={draft.oceanCurrents !== false}
            onChange={(e) => setDraft({ ...draft, oceanCurrents: e.target.checked })}
            className="rounded border-slate-600 bg-[#0f1620] accent-sky-400 cursor-pointer"
          />
          <span>จำลองกระแสน้ำอุ่น/เย็น (ส่งผลต่ออุณหภูมิและฝนชายฝั่ง)</span>
        </label>
        {draft.oceanCurrents !== false && (
          <div className="bg-[#0f1620] border border-slate-800 rounded-md p-2 space-y-1.5 text-[11px]">
            <div>
              <div className="flex justify-between text-slate-300">
                <span>ความแรงกระแสน้ำมหาสมุทร</span>
                <span className="text-sky-300 font-medium">
                  {(draft.currentStrength ?? 1).toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min={0.2}
                max={2.0}
                step={0.1}
                value={draft.currentStrength ?? 1.0}
                onChange={(e) =>
                  setDraft({ ...draft, currentStrength: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">ทิศทางหมุน Coriolis</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, coriolisDirection: 'normal' })}
                  className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer ${
                    (draft.coriolisDirection ?? 'normal') === 'normal'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-[#151d28] border-slate-800 text-slate-400'
                  }`}
                >
                  ปกติ (โลกจริง)
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, coriolisDirection: 'reversed' })}
                  className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer ${
                    draft.coriolisDirection === 'reversed'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-[#151d28] border-slate-800 text-slate-400'
                  }`}
                >
                  หมุนกลับทิศ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2 text-[11px] text-slate-300">
        {/* Sea Level + Presets */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>ระดับน้ำทะเล</span>
            <span className="text-sky-300 font-medium">
              {draft.seaLevel.toFixed(2)} ({formatSeaLevelMeters(draft.seaLevel)})
            </span>
          </div>
          <input
            type="range"
            min={-0.35}
            max={0.35}
            step={0.01}
            value={draft.seaLevel}
            onChange={(e) => setDraft({ ...draft, seaLevel: Number(e.target.value) })}
            className="w-full"
          />
          <div className="grid grid-cols-3 gap-1">
            {[
              { val: -0.15, label: 'ยุคน้ำแข็ง (-120ม.)' },
              { val: 0, label: 'โลกจริง (0ม.)' },
              { val: 0.1, label: 'น้ำท่วม (+80ม.)' },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => setDraft({ ...draft, seaLevel: s.val })}
                className={`py-0.5 rounded border text-[10px] cursor-pointer ${
                  Math.abs(draft.seaLevel - s.val) < 0.005
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-[#0f1620] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-0.5">
            <span className="flex items-center gap-1">
              <Mountain className="w-3 h-3 text-stone-400" /> ความเข้มข้นเทือกเขา
            </span>
            <span className="text-slate-400">{draft.mountainScale.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={0.4}
            max={1.8}
            step={0.1}
            value={draft.mountainScale}
            onChange={(e) => setDraft({ ...draft, mountainScale: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        <div>
          <div className="flex justify-between mb-0.5">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-rose-400" /> จำนวนแผ่นเปลือกโลก (Tectonic)
            </span>
            <span className="text-slate-400">{draft.tectonicPlates ?? 8} แผ่น</span>
          </div>
          <input
            type="range"
            min={4}
            max={16}
            step={1}
            value={draft.tectonicPlates ?? 8}
            onChange={(e) => setDraft({ ...draft, tectonicPlates: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        <div>
          <div className="flex justify-between mb-0.5">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-amber-400" /> แรงธรณีแปรสัณฐาน (แนวภูเขาไฟ/ร่องลึก)
            </span>
            <span className="text-slate-400">
              {(draft.tectonicStrength ?? 0) === 0
                ? 'ปิด (0.0x)'
                : `${(draft.tectonicStrength ?? 0).toFixed(2)}x`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1.2}
            step={0.05}
            value={draft.tectonicStrength ?? 0}
            onChange={(e) => setDraft({ ...draft, tectonicStrength: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        {/* Custom Tectonic Plates Designer */}
        {onInitCustomPlates && onUpdateCustomPlates && (
          <div className="bg-[#0e151f] border border-slate-800 rounded-lg p-2.5 space-y-2">
            {onOpenTectonicTool && (
              <button
                type="button"
                onClick={onOpenTectonicTool}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-100 text-[11px] font-medium cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-rose-300" />
                เปิดสตูดิโอแปรสัณฐาน (ลากปรับบนแผนที่ + เทมเพลต)
              </button>
            )}
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                กำหนดแผ่นเปลือกโลกเอง ({customTectonicPlates?.length ?? 0})
              </span>
              <button
                type="button"
                onClick={() => onChangeOverlay(overlay === 'tectonics' ? 'none' : 'tectonics')}
                className={`px-1.5 py-0.5 rounded border text-[10px] cursor-pointer ${
                  overlay === 'tectonics'
                    ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                    : 'bg-[#16202e] border-slate-700 text-slate-300'
                }`}
              >
                {overlay === 'tectonics' ? 'ซ่อนมุมมองแผ่น' : 'ดูมุมมองแผ่น'}
              </button>
            </div>

            {!customTectonicPlates ? (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 leading-snug">
                  สร้างแผ่นเปลือกโลกกำหนดเอง เพื่อลากจุดศูนย์กลาง ตั้งเป็นทวีป/มหาสมุทร และกำหนดทิศทางชนกัน/แยกตัวได้อิสระ
                </p>
                <button
                  type="button"
                  onClick={onInitCustomPlates}
                  className="w-full py-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-200 text-[11px] font-medium cursor-pointer"
                >
                  เปิดโหมดกำหนดแผ่นเปลือกโลกเอง
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {onStartPlacePlate && (
                    <button
                      type="button"
                      onClick={() =>
                        onStartPlacePlate(tectonicEditPlateId === '__new__' ? null : '__new__')
                      }
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded border text-[10px] cursor-pointer ${
                        tectonicEditPlateId === '__new__'
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-semibold'
                          : 'bg-[#16202e] hover:bg-[#1e2c40] border-slate-700 text-slate-200'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                      {tectonicEditPlateId === '__new__' ? 'คลิกบนแผนที่...' : 'เพิ่มแผ่นบนแผนที่'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onStartPlacePlate?.(null);
                      onUpdateCustomPlates(undefined);
                    }}
                    className="px-2 py-1 rounded bg-[#16202e] hover:bg-[#1e2c40] border border-slate-700 text-[10px] text-slate-400 cursor-pointer flex items-center gap-1"
                    title="รีเซ็ตกลับไปใช้แผ่นเปลือกโลกอัตโนมัติ"
                  >
                    <RotateCcw className="w-3 h-3" /> รีเซ็ต
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
                  {customTectonicPlates.map((plate) => {
                    const isPlacing = tectonicEditPlateId === plate.id;
                    const dirButtons: [string, number, number][] = [
                      ['↖', -0.7, -0.7],
                      ['↑', 0, -1],
                      ['↗', 0.7, -0.7],
                      ['←', -1, 0],
                      ['→', 1, 0],
                      ['↙', -0.7, 0.7],
                      ['↓', 0, 1],
                      ['↘', 0.7, 0.7],
                    ];
                    return (
                      <div
                        key={plate.id}
                        className={`p-1.5 rounded border text-[10px] space-y-1 ${
                          isPlacing
                            ? 'bg-amber-500/10 border-amber-400'
                            : 'bg-[#131b26] border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={plate.color}
                            onChange={(e) =>
                              onUpdateCustomPlates(
                                customTectonicPlates.map((p) =>
                                  p.id === plate.id ? { ...p, color: e.target.value } : p
                                )
                              )
                            }
                            className="w-5 h-5 bg-transparent rounded cursor-pointer shrink-0"
                          />
                          <input
                            value={plate.name}
                            onChange={(e) =>
                              onUpdateCustomPlates(
                                customTectonicPlates.map((p) =>
                                  p.id === plate.id ? { ...p, name: e.target.value } : p
                                )
                              )
                            }
                            className="flex-1 min-w-0 bg-[#0d141e] border border-slate-700 rounded px-1.5 py-0.5 text-slate-100 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateCustomPlates(
                                customTectonicPlates.map((p) =>
                                  p.id === plate.id ? { ...p, isOceanic: !p.isOceanic } : p
                                )
                              )
                            }
                            className={`px-1.5 py-0.5 rounded border cursor-pointer shrink-0 ${
                              plate.isOceanic
                                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200'
                                : 'bg-stone-500/20 border-stone-500/40 text-stone-200'
                            }`}
                            title="สลับแผ่นทวีป / แผ่นมหาสมุทร"
                          >
                            {plate.isOceanic ? '🌊 สมุทร' : '🏔️ ทวีป'}
                          </button>
                          <button
                            type="button"
                            disabled={customTectonicPlates.length <= 2}
                            onClick={() =>
                              onUpdateCustomPlates(
                                customTectonicPlates.filter((p) => p.id !== plate.id)
                              )
                            }
                            className="text-slate-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                            title="ลบแผ่นนี้ (ต้องเหลืออย่างน้อย 2 แผ่น)"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-400 truncate">
                            ({Math.max(0, Math.min(mapWidth - 1, Math.round(plate.centerQ)))},{' '}
                            {Math.max(0, Math.min(mapHeight - 1, Math.round(plate.centerR)))})
                          </span>
                          <div className="flex items-center gap-0.5">
                            {dirButtons.map(([sym, vx, vy]) => {
                              const activeDir =
                                Math.abs(plate.vx - vx) < 0.25 && Math.abs(plate.vy - vy) < 0.25;
                              return (
                                <button
                                  key={sym}
                                  type="button"
                                  onClick={() =>
                                    onUpdateCustomPlates(
                                      customTectonicPlates.map((p) =>
                                        p.id === plate.id ? { ...p, vx, vy } : p
                                      )
                                    )
                                  }
                                  className={`w-4 h-4 rounded flex items-center justify-center cursor-pointer ${
                                    activeDir
                                      ? 'bg-amber-500 text-[#0e141c] font-bold'
                                      : 'bg-[#1a2434] text-slate-300 hover:bg-[#243247]'
                                  }`}
                                  title="กำหนดทิศทางการเคลื่อนที่ของแผ่น"
                                >
                                  {sym}
                                </button>
                              );
                            })}
                          </div>
                          {onStartPlacePlate && (
                            <button
                              type="button"
                              onClick={() => onStartPlacePlate(isPlacing ? null : plate.id)}
                              className={`px-1.5 py-0.5 rounded border cursor-pointer flex items-center gap-0.5 ${
                                isPlacing
                                  ? 'bg-amber-500 text-[#0e141c] border-amber-400 font-semibold'
                                  : 'bg-[#182230] border-slate-700 text-amber-300'
                              }`}
                              title="คลิกจุดใหม่บนแผนที่เพื่อย้ายศูนย์กลางแผ่น"
                            >
                              <Crosshair className="w-2.5 h-2.5" /> ย้าย
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {onApplyTectonicsToCurrent && (
                  <button
                    type="button"
                    onClick={() =>
                      onApplyTectonicsToCurrent(
                        (draft.tectonicStrength ?? 0) > 0 ? draft.tectonicStrength : 0.65
                      )
                    }
                    className="w-full py-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-200 text-[11px] font-medium cursor-pointer"
                  >
                    ยกเทือกเขา/ร่องลึก/ภูเขาไฟตามแผ่นบนแผนที่ปัจจุบัน
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <div className="flex justify-between mb-0.5">
            <span className="flex items-center gap-1">
              <CloudRain className="w-3 h-3 text-sky-400" /> ปริมาณฝน / ความชื้น
            </span>
            <span className="text-slate-400">{draft.moistureScale.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.7}
            step={0.1}
            value={draft.moistureScale}
            onChange={(e) => setDraft({ ...draft, moistureScale: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        <div>
          <div className="flex justify-between mb-0.5">
            <span className="flex items-center gap-1">
              <Waves className="w-3 h-3 text-cyan-400" /> เกณฑ์ต้นน้ำ (ค่าน้อย = แม่น้ำเยอะ)
            </span>
            <span className="text-slate-400">{draft.riverThreshold}</span>
          </div>
          <input
            type="range"
            min={8}
            max={50}
            step={2}
            value={draft.riverThreshold}
            onChange={(e) => setDraft({ ...draft, riverThreshold: Number(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>

      <div className="space-y-1.5 pt-1">
        <button
          onClick={() => onGenerateWorld(draft)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold text-xs transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          สร้างโลกใหม่ทั้งแผนที่
        </button>

        <button
          onClick={onAutoRivers}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-200 text-xs transition cursor-pointer"
        >
          <Waves className="w-3.5 h-3.5" />
          วางแม่น้ำอัตโนมัติ (จากแผนที่ปัจจุบัน)
        </button>

        <button
          onClick={() => onRecomputeBiomes(draft)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-200 text-xs transition cursor-pointer"
        >
          <CloudRain className="w-3.5 h-3.5" />
          คำนวณไบโอมใหม่ตามภูมิอากาศจริง
        </button>

        {onAutoPlaceFeatures && (
          <button
            onClick={onAutoPlaceFeatures}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/40 text-violet-200 text-xs transition cursor-pointer"
          >
            <Mountain className="w-3.5 h-3.5" />
            วางลักษณะพิเศษอัตโนมัติ (ตามภูมิศาสตร์)
          </button>
        )}

        {onOpenSimulateModal && (
          <button
            onClick={onOpenSimulateModal}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-200 font-semibold text-xs transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            จำลองทุกมิติจากแผนที่ปัจจุบัน...
          </button>
        )}
      </div>
    </div>
  );
};
