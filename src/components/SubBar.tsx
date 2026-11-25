import React from 'react';
import {
  Clock,
  Download,
  Eye,
  Grid3X3,
  Layers,
  Package,
  Palette,
  Scale,
  Users,
} from 'lucide-react';
import { computeRealDimensions } from '../engine/hexMath';
import { ClimateOverlay, HexMapData, LayerVisibility } from '../types/map';

interface SubBarProps {
  map: HexMapData;
  overlay: ClimateOverlay;
  onChangeOverlay: (o: ClimateOverlay) => void;
  layers: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  showTimelineBar: boolean;
  onToggleTimelineBar: () => void;
  onOpenSizeModal: () => void;
  onOpenEconomyModal: () => void;
  onOpenCustomModal: () => void;
  onOpenExportModal: () => void;
}

const OVERLAY_MODES: { id: ClimateOverlay; label: string }[] = [
  { id: 'none', label: 'ปกติ' },
  { id: 'terrain', label: 'ภูมิประเทศ' },
  { id: 'biome', label: 'ไบโอม' },
  { id: 'political', label: 'การปกครอง' },
  { id: 'religion', label: 'ศาสนา' },
  { id: 'culture', label: 'วัฒนธรรม' },
  { id: 'elevation', label: 'ความสูง' },
  { id: 'temperature', label: 'อุณหภูมิ' },
  { id: 'moisture', label: 'ความชื้น' },
];

export const SubBar: React.FC<SubBarProps> = ({
  map,
  overlay,
  onChangeOverlay,
  layers,
  onToggleLayer,
  showTimelineBar,
  onToggleTimelineBar,
  onOpenSizeModal,
  onOpenEconomyModal,
  onOpenCustomModal,
  onOpenExportModal,
}) => {
  const totalPop = map.cities.reduce((sum, c) => sum + c.population, 0);
  const dims = computeRealDimensions(map.width, map.height, map.hexSizeKm);

  const toggleItems: { key: keyof LayerVisibility; label: string }[] = [
    { key: 'features', label: 'ลักษณะพิเศษ' },
    { key: 'borders', label: 'พรมแดน' },
    { key: 'territories', label: 'สีดินแดน' },
    { key: 'religions', label: 'เขตศาสนา' },
    { key: 'cultures', label: 'วัฒนธรรม' },
    { key: 'cityNames', label: 'ชื่อเมือง' },
    { key: 'routes', label: 'เส้นทาง' },
    { key: 'rivers', label: 'แม่น้ำ' },
    { key: 'pois', label: 'จุดสำคัญ' },
  ];

  return (
    <div className="h-9 bg-[#151d28] border-b border-slate-800/80 px-2.5 flex items-center justify-between gap-2 text-xs select-none shrink-0 z-10 overflow-x-auto no-scrollbar">
      {/* Left: Overlay View Switcher + Layer toggles */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="flex items-center gap-1 text-amber-300/90 font-medium">
          <Eye className="w-3.5 h-3.5" />
          มุมมอง:
        </span>
        <div className="flex items-center bg-[#0f1620] rounded border border-slate-800 p-0.5 gap-0.5">
          {OVERLAY_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => onChangeOverlay(m.id)}
              className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                overlay === m.id
                  ? 'bg-amber-500/25 text-amber-200 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-slate-800 mx-0.5" />

        <span className="flex items-center gap-1 text-slate-400">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
        </span>
        {toggleItems.map((item) => {
          const active = layers[item.key];
          return (
            <button
              key={item.key}
              onClick={() => onToggleLayer(item.key)}
              className={`px-1.5 py-0.5 rounded border text-[11px] transition cursor-pointer ${
                active
                  ? 'bg-[#223042] border-amber-500/45 text-amber-200'
                  : 'bg-[#121923] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}

        <button
          onClick={() => onToggleLayer('grid')}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] transition cursor-pointer ${
            layers.grid
              ? 'bg-[#223042] border-amber-500/45 text-amber-200'
              : 'bg-[#121923] border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="แสดง/ซ่อนตารางหกเหลี่ยม (คีย์ G)"
        >
          <Grid3X3 className="w-3 h-3" />
          <span>กริด</span>
        </button>
      </div>

      {/* Right: Stats + Modals */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="hidden xl:flex items-center gap-1 bg-[#111720] px-2 py-0.5 rounded border border-slate-800 text-[11px]">
          <Users className="w-3 h-3 text-amber-400" />
          <span className="font-semibold text-slate-100">{totalPop.toLocaleString()}</span>
        </div>

        <button
          onClick={onOpenSizeModal}
          className="hidden lg:flex items-center gap-1 bg-[#111720] hover:bg-[#1a2330] px-2 py-0.5 rounded border border-slate-800 hover:border-slate-700 text-[11px] transition cursor-pointer"
          title="ปรับขนาดแผนที่และระยะจริง"
        >
          <Scale className="w-3 h-3 text-sky-400" />
          <span className="text-sky-200">
            {Math.round(dims.widthKm).toLocaleString()} × {Math.round(dims.heightKm).toLocaleString()} กม.
          </span>
        </button>

        <button
          onClick={onToggleTimelineBar}
          className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition cursor-pointer ${
            showTimelineBar
              ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-medium'
              : 'bg-[#1b2533] hover:bg-[#243144] border-slate-700/80 text-slate-200'
          }`}
          title="เปิด/ปิดแถบ Timeline ประวัติศาสตร์ยุคสมัย"
        >
          <Clock className="w-3 h-3 text-amber-400" />
          <span>Timeline</span>
        </button>

        <button
          onClick={onOpenCustomModal}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1b2533] hover:bg-[#243144] border border-slate-700/80 text-[11px] text-slate-200 transition cursor-pointer"
        >
          <Palette className="w-3 h-3 text-violet-400" />
          <span>ไบโอม & POI เอง</span>
        </button>

        <button
          onClick={onOpenEconomyModal}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1b2533] hover:bg-[#243144] border border-slate-700/80 text-[11px] text-slate-200 transition cursor-pointer"
        >
          <Package className="w-3 h-3 text-amber-400" />
          <span>สินค้า · รัฐ · ศาสนา · วัฒนธรรม</span>
        </button>

        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1b2533] hover:bg-[#243144] border border-slate-700/80 text-[11px] text-slate-200 transition cursor-pointer"
        >
          <Download className="w-3 h-3 text-emerald-400" />
          <span>ส่งออก/โหลด</span>
        </button>
      </div>
    </div>
  );
};
