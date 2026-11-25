import React, { useState } from 'react';
import { CloudRain, Compass, Mountain, RefreshCw, Sparkles, Waves, Wind } from 'lucide-react';
import { LANDMASS_PRESETS } from '../data/goods';
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
  const [draft, setDraft] = useState<GeographyConfig>(config);

  const randomizeSeed = () => {
    const seed = Math.floor(10000 + Math.random() * 89999);
    const next = { ...draft, seed };
    setDraft(next);
    onGenerateWorld(next);
  };

  return (
    <div className="bg-[#151d28] border border-slate-700/80 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
          <Compass className="w-4 h-4" />
          ภูมิศาสตร์จริง & สร้างโลก
        </h3>
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
          onChange={(e) => setDraft({ ...draft, landmassType: e.target.value as LandmassType })}
          className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 outline-none"
        >
          {LANDMASS_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} — {p.desc}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            ละติจูดเหนือ ({draft.latNorth}°)
          </label>
          <input
            type="range"
            min={-60}
            max={88}
            value={draft.latNorth}
            onChange={(e) => setDraft({ ...draft, latNorth: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            ละติจูดใต้ ({draft.latSouth}°)
          </label>
          <input
            type="range"
            min={-88}
            max={60}
            value={draft.latSouth}
            onChange={(e) => setDraft({ ...draft, latSouth: Number(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
          <Wind className="w-3.5 h-3.5 text-sky-400" />
          ระบบลมประจำถิ่น (เกิด Rain Shadow หลังภูเขา)
        </label>
        <select
          value={draft.windMode}
          onChange={(e) => setDraft({ ...draft, windMode: e.target.value as WindMode })}
          className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 outline-none"
        >
          <option value="latitude">ตามแถบละติจูดจริง (Trade Winds & Westerlies)</option>
          <option value="west">ลมตะวันตกพัดไปตะวันออก (W → E)</option>
          <option value="east">ลมตะวันออกพัดไปตะวันตก (E → W)</option>
        </select>
      </div>

      <div className="space-y-2 text-[11px] text-slate-300">
        <div>
          <div className="flex justify-between mb-0.5">
            <span>ระดับน้ำทะเล</span>
            <span className="text-slate-400">{draft.seaLevel.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={-0.25}
            max={0.25}
            step={0.02}
            value={draft.seaLevel}
            onChange={(e) => setDraft({ ...draft, seaLevel: Number(e.target.value) })}
            className="w-full"
          />
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
