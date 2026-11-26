import React, { useEffect, useState } from 'react';
import {
  CloudRain,
  Compass,
  Globe,
  Mountain,
  RefreshCw,
  Sparkles,
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
import { ClimateOverlay, GeographyConfig, LandmassType, WindMode } from '../types/map';

interface ClimateGeneratorPanelProps {
  config: GeographyConfig;
  overlay: ClimateOverlay;
  onChangeOverlay: (o: ClimateOverlay) => void;
  onGenerateWorld: (cfg: GeographyConfig) => void;
  onAutoRivers: () => void;
  onRecomputeBiomes: (cfg: GeographyConfig) => void;
}

export const ClimateGeneratorPanel: React.FC<ClimateGeneratorPanelProps> = ({
  config,
  overlay,
  onChangeOverlay,
  onGenerateWorld,
  onAutoRivers,
  onRecomputeBiomes,
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
      </div>
    </div>
  );
};
