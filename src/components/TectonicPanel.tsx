import React, { useMemo, useState } from 'react';
import {
  Crosshair,
  Eye,
  Globe,
  Layers,
  MousePointer2,
  Mountain,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  computeTectonicField,
  computeTectonicSummary,
  createCustomPlatesFromCurrent,
  TectonicPresetId,
} from '../engine/tectonics';
import { ClimateOverlay, CustomTectonicPlate, HexMapData } from '../types/map';

interface TectonicPanelProps {
  map: HexMapData;
  overlay: ClimateOverlay;
  showTectonicLayer: boolean;
  tectonicSubTool: 'edit' | 'add' | 'erase';
  tectonicAddOceanic: boolean;
  selectedPlateId: string | null;
  tectonicEditPlateId: string | null;
  onChangeOverlay: (o: ClimateOverlay) => void;
  onToggleTectonicLayer: () => void;
  onChangeSubTool: (m: 'edit' | 'add' | 'erase') => void;
  onChangeAddOceanic: (v: boolean) => void;
  onSelectPlate: (id: string | null) => void;
  onApplyPreset: (preset: TectonicPresetId, count?: number) => void;
  onInitCustomPlates: () => void;
  onUpdateCustomPlates: (plates: CustomTectonicPlate[] | undefined) => void;
  onDeletePlate: (id: string) => void;
  onStartPlacePlate: (id: string | null) => void;
  onGenerateWorldFromPlates: (strength: number) => void;
  onApplyTectonicsToCurrent: (strength: number) => void;
  onUpdateGeographyStrength: (strength: number) => void;
}

const PRESETS: { id: TectonicPresetId; label: string; desc: string }[] = [
  { id: 'supercontinent', label: 'มหาทวีปชนกัน', desc: 'ทวีปกลางชนกันเกิดเทือกเขาสูง' },
  { id: 'atlantic_rift', label: 'แยกตัวกลางสมุทร', desc: 'สันเขาใต้น้ำ & ทวีปแยกซ้าย-ขวา' },
  { id: 'ring_of_fire', label: 'วงแหวนแห่งไฟ', desc: 'แอ่งสมุทรล้อมด้วยแนวภูเขาไฟ' },
  { id: 'archipelago', label: 'หมู่เกาะภูเขาไฟ', desc: '8 แผ่นสลับทวีป-สมุทร' },
  { id: 'from_current_map', label: 'ถอดแบบจากแผนที่นี้', desc: 'สร้างแผ่นตามแผ่นดินปัจจุบัน' },
  { id: 'balanced_random', label: 'สุ่มสมดุล', desc: 'จัดวางกระจายตัวสมจริง' },
];

export const TectonicPanel: React.FC<TectonicPanelProps> = ({
  map,
  overlay,
  showTectonicLayer,
  tectonicSubTool,
  tectonicAddOceanic,
  selectedPlateId,
  tectonicEditPlateId,
  onChangeOverlay,
  onToggleTectonicLayer,
  onChangeSubTool,
  onChangeAddOceanic,
  onSelectPlate,
  onApplyPreset,
  onInitCustomPlates,
  onUpdateCustomPlates,
  onDeletePlate,
  onStartPlacePlate,
  onGenerateWorldFromPlates,
  onApplyTectonicsToCurrent,
  onUpdateGeographyStrength,
}) => {
  const [randomCount, setRandomCount] = useState<number>(6);
  const [strength, setStrength] = useState<number>(() =>
    map.geography.tectonicStrength && map.geography.tectonicStrength > 0
      ? map.geography.tectonicStrength
      : 0.85
  );

  const field = useMemo(
    () =>
      computeTectonicField(
        map.width,
        map.height,
        map.geography.seed,
        map.geography.tectonicPlates ?? 8,
        map.customTectonicPlates
      ),
    [
      map.customTectonicPlates,
      map.geography.seed,
      map.geography.tectonicPlates,
      map.height,
      map.width,
    ]
  );

  const summary = useMemo(() => computeTectonicSummary(field), [field]);

  const editablePlates: CustomTectonicPlate[] = useMemo(() => {
    if (map.customTectonicPlates && map.customTectonicPlates.length >= 2) {
      return map.customTectonicPlates;
    }
    return createCustomPlatesFromCurrent(map);
  }, [map]);

  const selectedPlate = useMemo(
    () =>
      editablePlates.find((p) => p.id === selectedPlateId) ?? editablePlates[0] ?? null,
    [editablePlates, selectedPlateId]
  );

  const patchSelectedPlate = (patch: Partial<CustomTectonicPlate>) => {
    if (!selectedPlate) return;
    onUpdateCustomPlates(
      editablePlates.map((p) => (p.id === selectedPlate.id ? { ...p, ...patch } : p))
    );
  };

  const dirGrid: [string, number, number][] = [
    ['↖', -0.71, -0.71],
    ['↑', 0, -1],
    ['↗', 0.71, -0.71],
    ['←', -1, 0],
    ['•', 0, 0],
    ['→', 1, 0],
    ['↙', -0.71, 0.71],
    ['↓', 0, 1],
    ['↘', 0.71, 0.71],
  ];

  const selectedSpeed = selectedPlate
    ? Math.min(1.3, Number(Math.hypot(selectedPlate.vx, selectedPlate.vy).toFixed(2)))
    : 0.7;

  return (
    <div className="space-y-3 text-xs">
      {/* Header + Display Modes */}
      <div className="bg-[#151d28] border border-slate-800 rounded-lg p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-rose-400" />
            สตูดิโอแผ่นเปลือกโลก
          </h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 tabular-nums">
            {field.plates.length} แผ่น
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => onChangeOverlay(overlay === 'tectonics' ? 'none' : 'tectonics')}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded border transition cursor-pointer ${
              overlay === 'tectonics'
                ? 'bg-rose-500/20 border-rose-400 text-rose-200 font-medium'
                : 'bg-[#0f1620] border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {overlay === 'tectonics' ? 'โหมดสีแผ่น (เปิดอยู่)' : 'ดูสีแผ่นเต็มจอ'}
          </button>
          <button
            type="button"
            onClick={onToggleTectonicLayer}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded border transition cursor-pointer ${
              showTectonicLayer
                ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-medium'
                : 'bg-[#0f1620] border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {showTectonicLayer ? 'ซ้อนรอยเลื่อน: เปิด' : 'ซ้อนรอยเลื่อน: ปิด'}
          </button>
        </div>

        {/* Canvas Direct Interaction Sub-tools */}
        <div className="grid grid-cols-3 gap-1 pt-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => onChangeSubTool('edit')}
            className={`flex items-center justify-center gap-1 py-1 rounded border cursor-pointer ${
              tectonicSubTool === 'edit'
                ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-medium'
                : 'bg-[#0f1620] border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <MousePointer2 className="w-3 h-3" /> ลาก / หมุน
          </button>
          <button
            type="button"
            onClick={() => onChangeSubTool('add')}
            className={`flex items-center justify-center gap-1 py-1 rounded border cursor-pointer ${
              tectonicSubTool === 'add'
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 font-medium'
                : 'bg-[#0f1620] border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3 h-3" /> วางแผ่นเพิ่ม
          </button>
          <button
            type="button"
            onClick={() => onChangeSubTool('erase')}
            className={`flex items-center justify-center gap-1 py-1 rounded border cursor-pointer ${
              tectonicSubTool === 'erase'
                ? 'bg-rose-500/25 border-rose-400 text-rose-200 font-medium'
                : 'bg-[#0f1620] border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trash2 className="w-3 h-3" /> คลิกเพื่อลบ
          </button>
        </div>

        {tectonicSubTool === 'add' ? (
          <div className="flex items-center justify-between gap-2 bg-[#0e151f] border border-slate-800 rounded px-2 py-1.5 text-[11px]">
            <span className="text-slate-300">ชนิดแผ่นที่จะคลิกวาง:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onChangeAddOceanic(false)}
                className={`px-2 py-0.5 rounded border cursor-pointer ${
                  !tectonicAddOceanic
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-medium'
                    : 'border-slate-700 text-slate-400'
                }`}
              >
                🏔️ ทวีป
              </button>
              <button
                type="button"
                onClick={() => onChangeAddOceanic(true)}
                className={`px-2 py-0.5 rounded border cursor-pointer ${
                  tectonicAddOceanic
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 font-medium'
                    : 'border-slate-700 text-slate-400'
                }`}
              >
                🌊 สมุทร
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400 leading-snug">
            💡 ลาก <b>วงกลมศูนย์กลาง</b> เพื่อย้ายแผ่น หรือลาก <b>จุดหัวลูกศร</b> บนแผนที่เพื่อหมุนทิศชนกัน/แยกตัวได้ทันที
          </p>
        )}
      </div>

      {/* 1-Click Presets */}
      <div className="bg-[#151d28] border border-slate-800 rounded-lg p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-sky-300">เทมเพลตแผ่นเปลือกโลก (1 คลิก)</span>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span>สุ่ม:</span>
            <select
              value={randomCount}
              onChange={(e) => setRandomCount(Number(e.target.value))}
              className="bg-[#0e151f] border border-slate-700 rounded px-1 py-0.5 text-slate-200 outline-none"
              title="จำนวนแผ่นสำหรับปุ่มสุ่มสมดุล"
            >
              {[4, 5, 6, 7, 8, 9, 10, 12].map((n) => (
                <option key={n} value={n}>
                  {n} แผ่น
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((pr) => (
            <button
              key={pr.id}
              type="button"
              onClick={() => onApplyPreset(pr.id, randomCount)}
              title={pr.desc}
              className="text-left px-2 py-1.5 rounded bg-[#0e151f] hover:bg-[#192434] border border-slate-800 hover:border-sky-500/50 transition cursor-pointer"
            >
              <div className="text-[11px] font-medium text-slate-100 truncate">{pr.label}</div>
              <div className="text-[9px] text-slate-400 truncate">{pr.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Fault Boundary Telemetry */}
      <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center">
        <div className="bg-[#151d28] border border-rose-500/35 rounded-md py-1 px-1.5">
          <div className="text-rose-300 font-semibold tabular-nums">{summary.convergent}</div>
          <div className="text-slate-400">ชนกัน (เขา/ร่อง)</div>
        </div>
        <div className="bg-[#151d28] border border-sky-500/35 rounded-md py-1 px-1.5">
          <div className="text-sky-300 font-semibold tabular-nums">{summary.divergent}</div>
          <div className="text-slate-400">แยกตัว (หุบ/สัน)</div>
        </div>
        <div className="bg-[#151d28] border border-amber-500/35 rounded-md py-1 px-1.5">
          <div className="text-amber-300 font-semibold tabular-nums">
            {summary.continentalPlates} / {summary.oceanicPlates}
          </div>
          <div className="text-slate-400">ทวีป / สมุทร</div>
        </div>
      </div>

      {/* Selected Plate Inspector */}
      {selectedPlate && (
        <div className="bg-[#151d28] border border-amber-500/40 rounded-lg p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-amber-300">
              ปรับแต่งแผ่นที่เลือก
            </span>
            <span className="text-[10px] text-slate-400 tabular-nums">
              พิกัด ({Math.round(selectedPlate.centerQ)}, {Math.round(selectedPlate.centerR)})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={selectedPlate.color}
              onChange={(e) => patchSelectedPlate({ color: e.target.value })}
              className="w-6 h-6 bg-transparent rounded cursor-pointer shrink-0"
              title="สีแผ่นเปลือกโลก"
            />
            <input
              value={selectedPlate.name}
              onChange={(e) => patchSelectedPlate({ name: e.target.value })}
              className="flex-1 min-w-0 bg-[#0d141e] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100 outline-none"
            />
            <button
              type="button"
              onClick={() => patchSelectedPlate({ isOceanic: !selectedPlate.isOceanic })}
              className={`px-2 py-1 rounded border text-[11px] cursor-pointer shrink-0 ${
                selectedPlate.isOceanic
                  ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                  : 'bg-amber-500/15 border-amber-500/50 text-amber-200'
              }`}
              title="สลับแผ่นทวีป (ยกเป็นแผ่นดิน) กับแผ่นมหาสมุทร (ยุบเป็นทะเลลึก)"
            >
              {selectedPlate.isOceanic ? '🌊 มหาสมุทร' : '🏔️ ทวีป'}
            </button>
          </div>

          <div className="flex items-center gap-3 pt-0.5">
            {/* 3x3 Compass Pad */}
            <div className="grid grid-cols-3 gap-1 shrink-0">
              {dirGrid.map(([sym, ux, uy]) => {
                const isStop = ux === 0 && uy === 0;
                const curSpeed = Math.max(0.45, selectedSpeed || 0.7);
                const active = isStop
                  ? Math.hypot(selectedPlate.vx, selectedPlate.vy) < 0.08
                  : Math.abs(selectedPlate.vx - ux * curSpeed) < 0.28 &&
                    Math.abs(selectedPlate.vy - uy * curSpeed) < 0.28 &&
                    Math.hypot(selectedPlate.vx, selectedPlate.vy) >= 0.08;
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() =>
                      patchSelectedPlate({
                        vx: isStop ? 0 : Number((ux * curSpeed).toFixed(2)),
                        vy: isStop ? 0 : Number((uy * curSpeed).toFixed(2)),
                      })
                    }
                    className={`w-6 h-6 rounded text-[11px] flex items-center justify-center border cursor-pointer ${
                      active
                        ? 'bg-amber-500 border-amber-300 text-[#0e141c] font-bold'
                        : 'bg-[#0e151f] border-slate-700 text-slate-300 hover:bg-[#1b2738]'
                    }`}
                    title={isStop ? 'หยุดนิ่ง' : `เลื่อนทิศ ${sym}`}
                  >
                    {sym}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">ความเร็วการเคลื่อนที่</span>
                <span className="text-amber-300 tabular-nums">{selectedSpeed.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.3}
                step={0.05}
                value={selectedSpeed}
                onChange={(e) => {
                  const nextSpd = Number(e.target.value);
                  const curSpd = Math.hypot(selectedPlate.vx, selectedPlate.vy);
                  const ux = curSpd > 0.05 ? selectedPlate.vx / curSpd : 1;
                  const uy = curSpd > 0.05 ? selectedPlate.vy / curSpd : 0;
                  patchSelectedPlate({
                    vx: Number((ux * nextSpd).toFixed(2)),
                    vy: Number((uy * nextSpd).toFixed(2)),
                  });
                }}
                className="w-full"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onStartPlacePlate(
                      tectonicEditPlateId === selectedPlate.id ? null : selectedPlate.id
                    )
                  }
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded border text-[10px] cursor-pointer ${
                    tectonicEditPlateId === selectedPlate.id
                      ? 'bg-amber-500 text-[#0e141c] border-amber-400 font-semibold'
                      : 'bg-[#0e151f] border-slate-700 text-amber-300 hover:bg-[#1b2738]'
                  }`}
                >
                  <Crosshair className="w-3 h-3" />
                  {tectonicEditPlateId === selectedPlate.id ? 'คลิกบนแผนที่...' : 'ย้ายศูนย์กลาง'}
                </button>
                <button
                  type="button"
                  disabled={editablePlates.length <= 2}
                  onClick={() => onDeletePlate(selectedPlate.id)}
                  className="px-2 py-1 rounded bg-[#0e151f] hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 disabled:opacity-35 cursor-pointer"
                  title="ลบแผ่นนี้"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Plates List */}
      <div className="bg-[#151d28] border border-slate-800 rounded-lg p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-200">
            รายการแผ่นเปลือกโลก ({editablePlates.length})
          </span>
          <div className="flex items-center gap-1">
            {!map.customTectonicPlates && (
              <button
                type="button"
                onClick={onInitCustomPlates}
                className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/50 text-[10px] text-amber-200 cursor-pointer"
              >
                ปลดล็อกแก้ไข
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onStartPlacePlate(null);
                onUpdateCustomPlates(undefined);
              }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#0e151f] hover:bg-[#1a2433] border border-slate-700 text-[10px] text-slate-400 cursor-pointer"
              title="รีเซ็ตกลับไปใช้แผ่นสุ่มอัตโนมัติ"
            >
              <RotateCcw className="w-2.5 h-2.5" /> รีเซ็ต
            </button>
          </div>
        </div>

        <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
          {editablePlates.map((p) => {
            const isSel = selectedPlate?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPlate(p.id)}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded border text-left transition cursor-pointer ${
                  isSel
                    ? 'bg-amber-500/15 border-amber-400/70 text-amber-100'
                    : 'bg-[#0e151f] border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/25"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-[11px] truncate">{p.name}</span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {p.isOceanic ? '🌊 สมุทร' : '🏔️ ทวีป'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Generate & Apply Actions */}
      <div className="bg-[#151d28] border border-slate-800 rounded-lg p-2.5 space-y-2">
        <div>
          <div className="flex justify-between text-[11px] mb-0.5">
            <span className="text-slate-300 font-medium">แรงชน/แยกตัว (ความสูงเทือกเขา & ร่องลึก)</span>
            <span className="text-amber-300 tabular-nums">{strength.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1.4}
            step={0.05}
            value={strength}
            onChange={(e) => {
              const v = Number(e.target.value);
              setStrength(v);
              onUpdateGeographyStrength(v);
            }}
            className="w-full"
          />
        </div>

        <button
          type="button"
          onClick={() => onGenerateWorldFromPlates(strength)}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold text-xs transition shadow-sm cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5" />
          สร้างแผ่นดินและโลกใหม่จากแผ่นเปลือกโลกนี้
        </button>

        <button
          type="button"
          onClick={() => onApplyTectonicsToCurrent(strength)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-200 text-[11px] font-medium transition cursor-pointer"
        >
          <Mountain className="w-3.5 h-3.5" />
          <span>ยกเทือกเขา / ร่องลึก / ภูเขาไฟบนแผนที่เดิม</span>
          <Sparkles className="w-3 h-3 text-amber-300" />
        </button>
      </div>
    </div>
  );
};
