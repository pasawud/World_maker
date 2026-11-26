import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Clock,
  Crop,
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
import { ClimateOverlay, HexMapData, LayerVisibility, MapTheme } from '../types/map';

interface SubBarProps {
  map: HexMapData;
  overlay: ClimateOverlay;
  onChangeOverlay: (o: ClimateOverlay) => void;
  mapTheme: MapTheme;
  onChangeMapTheme: (t: MapTheme) => void;
  layers: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  showTimelineBar: boolean;
  onToggleTimelineBar: () => void;
  onOpenSizeModal: () => void;
  onOpenEconomyModal: () => void;
  onOpenWorldbuildingModal: () => void;
  onOpenHeightmapModal: () => void;
  onOpenCustomModal: () => void;
  onOpenExportModal: () => void;
}

const PRIMARY_VIEWS: { id: ClimateOverlay; label: string }[] = [
  { id: 'none', label: 'ปกติ' },
  { id: 'terrain', label: 'ภูมิประเทศ' },
  { id: 'biome', label: 'ไบโอม' },
  { id: 'political', label: 'การปกครอง' },
  { id: 'religion', label: 'ศาสนา' },
  { id: 'culture', label: 'วัฒนธรรม' },
];

const ANALYTIC_VIEWS: { id: ClimateOverlay; label: string }[] = [
  { id: 'elevation', label: 'ความสูง / ความลึก (ม.)' },
  { id: 'temperature', label: 'อุณหภูมิ' },
  { id: 'moisture', label: 'ความชื้น / ฝน' },
  { id: 'currents', label: 'กระแสน้ำมหาสมุทร' },
];

export const SubBar: React.FC<SubBarProps> = ({
  map,
  overlay,
  onChangeOverlay,
  mapTheme,
  onChangeMapTheme,
  layers,
  onToggleLayer,
  showTimelineBar,
  onToggleTimelineBar,
  onOpenSizeModal,
  onOpenEconomyModal,
  onOpenWorldbuildingModal,
  onOpenHeightmapModal,
  onOpenCustomModal,
  onOpenExportModal,
}) => {
  const [layersOpen, setLayersOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!layersOpen) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setLayersOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [layersOpen]);

  const totalPop = map.cities.reduce((sum, c) => sum + c.population, 0);
  const dims = computeRealDimensions(map.width, map.height, map.hexSizeKm);

  const toggleItems: { key: keyof LayerVisibility; label: string }[] = [
    { key: 'hillshade', label: 'แสงเงาภูเขา (3D)' },
    { key: 'contours', label: 'เส้นชั้นความสูง' },
    { key: 'features', label: 'ลักษณะพิเศษ' },
    { key: 'borders', label: 'พรมแดนอาณาจักร' },
    { key: 'territories', label: 'สีดินแดน' },
    { key: 'religions', label: 'เขตศาสนา' },
    { key: 'cultures', label: 'เขตวัฒนธรรม' },
    { key: 'campaigns', label: 'ลูกศรเดินทัพ' },
    { key: 'cityNames', label: 'ชื่อเมือง & ป้าย' },
    { key: 'routes', label: 'เส้นทาง & การค้า' },
    { key: 'rivers', label: 'แม่น้ำ' },
    { key: 'pois', label: 'จุดสำคัญ (POI)' },
    { key: 'graticule', label: 'เส้นพิกัดโลก' },
    { key: 'currents', label: 'กระแสน้ำมหาสมุทร' },
  ];

  const activeLayerCount = toggleItems.filter((item) => layers[item.key]).length;
  const isAnalyticOverlay = ANALYTIC_VIEWS.some((v) => v.id === overlay);

  return (
    <div className="h-9 bg-[#151d28] border-b border-slate-800/80 px-2.5 flex items-center justify-between gap-2 text-xs select-none shrink-0 z-20 relative">
      {/* Left: Clean View Modes + Analytic Dropdown + Compact Layers Popover */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="hidden md:flex items-center gap-1 text-amber-300/90 font-medium shrink-0">
          <Eye className="w-3.5 h-3.5" />
          มุมมอง:
        </span>

        <div className="flex items-center bg-[#0f1620] rounded border border-slate-800 p-0.5 gap-0.5 shrink-0">
          {PRIMARY_VIEWS.map((m) => (
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

        <select
          value={isAnalyticOverlay ? overlay : ''}
          onChange={(e) => {
            if (e.target.value) onChangeOverlay(e.target.value as ClimateOverlay);
          }}
          className={`px-2 py-0.5 rounded border text-[11px] outline-none cursor-pointer transition ${
            isAnalyticOverlay
              ? 'bg-sky-500/20 border-sky-400/60 text-sky-200 font-semibold'
              : 'bg-[#0f1620] border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
          title="มุมมองวิเคราะห์ข้อมูลภูมิศาสตร์และสิ่งแวดล้อม"
        >
          <option value="" disabled className="bg-[#0f1620] text-slate-400">
            วิเคราะห์ข้อมูล...
          </option>
          {ANALYTIC_VIEWS.map((m) => (
            <option key={m.id} value={m.id} className="bg-[#0f1620] text-slate-100">
              {m.label}
            </option>
          ))}
        </select>

        <select
          value={mapTheme}
          onChange={(e) => onChangeMapTheme(e.target.value as MapTheme)}
          className={`px-2 py-0.5 rounded border text-[11px] outline-none cursor-pointer transition ${
            mapTheme !== 'standard'
              ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 font-semibold'
              : 'bg-[#0f1620] border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
          title="สไตล์แผนที่ (Map Theme)"
        >
          <option value="standard" className="bg-[#0f1620] text-slate-100">ธีม: มาตรฐาน</option>
          <option value="parchment" className="bg-[#0f1620] text-slate-100">ธีม: กระดาษโบราณ (Parchment)</option>
          <option value="atlas" className="bg-[#0f1620] text-slate-100">ธีม: ภูมิศาสตร์ (Atlas)</option>
          <option value="dark" className="bg-[#0f1620] text-slate-100">ธีม: กลางคืน (VTT Dark)</option>
        </select>

        <div className="h-4 w-px bg-slate-800 mx-0.5 shrink-0" />

        {/* Layers Popover */}
        <div className="relative shrink-0" ref={popoverRef}>
          <button
            onClick={() => setLayersOpen((o) => !o)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition cursor-pointer ${
              layersOpen
                ? 'bg-[#223042] border-amber-500/60 text-amber-200'
                : 'bg-[#121923] border-slate-800 text-slate-200 hover:border-slate-700'
            }`}
            title="เปิด/ปิดชั้นข้อมูลที่แสดงบนแผนที่"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>ชั้นข้อมูล</span>
            <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-300">
              {activeLayerCount}/{toggleItems.length}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {layersOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-80 bg-[#131b26] border border-slate-700 rounded-xl shadow-2xl p-3 z-40">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
                <span className="text-[11px] font-semibold text-amber-300">
                  ชั้นข้อมูลบนแผนที่ (Layers)
                </span>
                <span className="text-[10px] text-slate-400">คลิกเพื่อสลับเปิด/ปิด</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {toggleItems.map((item) => {
                  const active = layers[item.key];
                  return (
                    <button
                      key={item.key}
                      onClick={() => onToggleLayer(item.key)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[11px] text-left transition cursor-pointer ${
                        active
                          ? 'bg-amber-500/15 border-amber-500/45 text-amber-200'
                          : 'bg-[#0e151e] border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          active ? 'bg-amber-400' : 'bg-slate-600'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => onToggleLayer('grid')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition cursor-pointer shrink-0 ${
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
          title="ปรับแต่งและสร้างภูมิประเทศ ไบโอม ลักษณะพิเศษ และ POI"
        >
          <Palette className="w-3 h-3 text-violet-400" />
          <span className="hidden 2xl:inline">ปรับแต่งโลก</span>
        </button>

        <button
          onClick={onOpenWorldbuildingModal}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1b2533] hover:bg-[#243144] border border-slate-700/80 text-[11px] text-slate-200 transition cursor-pointer"
          title="การทูตระหว่างรัฐ เส้นทางเดินทัพ สารานุกรม Wiki และส่งออก Lorebook"
        >
          <BookOpen className="w-3 h-3 text-amber-300" />
          <span>การทูต & Wiki</span>
        </button>

        <button
          onClick={onOpenHeightmapModal}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1b2533] hover:bg-[#243144] border border-slate-700/80 text-[11px] text-slate-200 transition cursor-pointer"
          title="นำเข้าภาพ Heightmap / ภาพร่างลอกลาย และเจาะแผนที่ภูมิภาค Sub-Map"
        >
          <Crop className="w-3 h-3 text-sky-400" />
          <span className="hidden xl:inline">Heightmap / Sub-Map</span>
          <span className="xl:hidden">Sub-Map</span>
        </button>

        <button
          onClick={onOpenEconomyModal}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1b2533] hover:bg-[#243144] border border-slate-700/80 text-[11px] text-slate-200 transition cursor-pointer"
        >
          <Package className="w-3 h-3 text-amber-400" />
          <span className="hidden 2xl:inline">สินค้า · รัฐ · ศาสนา · วัฒนธรรม</span>
          <span className="2xl:hidden">รัฐ/เศรษฐกิจ</span>
        </button>

        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1b2533] hover:bg-[#243144] border border-slate-700/80 text-[11px] text-slate-200 transition cursor-pointer"
        >
          <Download className="w-3 h-3 text-emerald-400" />
          <span>ส่งออก</span>
        </button>
      </div>
    </div>
  );
};
