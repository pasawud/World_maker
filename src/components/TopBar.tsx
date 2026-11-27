import React, { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CloudSun,
  Compass,
  Crop,
  Crown,
  Flame,
  FolderOpen,
  HelpCircle,
  Landmark,
  Map as MapIcon,
  MapPin,
  Mountain,
  MousePointer2,
  Redo2,
  Route,
  Ruler,
  Search,
  Sparkles,
  Store,
  Swords,
  Trees,
  Undo2,
  Waves,
  Wind,
} from 'lucide-react';
import { HexMapData, ToolMode } from '../types/map';

interface TopBarProps {
  map: HexMapData;
  tool: ToolMode;
  onSelectTool: (t: ToolMode) => void;
  onRenameMap: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undoCount?: number;
  redoCount?: number;
  onUndo: () => void;
  onRedo: () => void;
  autosaveStatus: 'saved' | 'saving';
  showMinimap: boolean;
  onToggleMinimap: () => void;
  onOpenLibrary: () => void;
  onOpenSizeModal: () => void;
  onOpenQuickSearch: () => void;
  onOpenShortcuts?: () => void;
  onOpenParentMap?: () => void;
  onQuickGenerateWorld: () => void;
}

const TOOL_GROUPS: {
  id: ToolMode;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}[][] = [
  [
    { id: 'view', label: 'ดูแผนที่', icon: <MousePointer2 className="w-3.5 h-3.5" />, shortcut: '1' },
    { id: 'terrain', label: 'ภูมิประเทศ', icon: <Mountain className="w-3.5 h-3.5" />, shortcut: '2' },
    { id: 'biome', label: 'ไบโอม', icon: <Trees className="w-3.5 h-3.5" />, shortcut: 'B' },
    { id: 'river', label: 'วาดแม่น้ำ', icon: <Waves className="w-3.5 h-3.5" />, shortcut: '3' },
    { id: 'current', label: 'กระแสน้ำ', icon: <Wind className="w-3.5 h-3.5" />, shortcut: 'C' },
    { id: 'wind', label: 'ทิศทางลม', icon: <Compass className="w-3.5 h-3.5" />, shortcut: '' },
    { id: 'climate', label: 'ภูมิอากาศ', icon: <CloudSun className="w-3.5 h-3.5" />, shortcut: '' },
  ],
  [
    { id: 'city', label: 'วางเมือง', icon: <Building2 className="w-3.5 h-3.5" />, shortcut: '4' },
    { id: 'territory', label: 'ดินแดน', icon: <Crown className="w-3.5 h-3.5" />, shortcut: '5' },
    { id: 'religion', label: 'ศาสนา', icon: <Flame className="w-3.5 h-3.5" />, shortcut: '6' },
    { id: 'culture', label: 'วัฒนธรรม', icon: <Landmark className="w-3.5 h-3.5" />, shortcut: '' },
    { id: 'campaign', label: 'เดินทัพ', icon: <Swords className="w-3.5 h-3.5" />, shortcut: '' },
  ],
  [
    { id: 'road', label: 'ถนน / เดินเรือ', icon: <Route className="w-3.5 h-3.5" />, shortcut: '7' },
    { id: 'trade', label: 'การค้า', icon: <Store className="w-3.5 h-3.5" />, shortcut: '8' },
    { id: 'measure', label: 'วัดระยะ', icon: <Ruler className="w-3.5 h-3.5" />, shortcut: '9' },
    { id: 'poi', label: 'จุดสำคัญ', icon: <MapPin className="w-3.5 h-3.5" />, shortcut: '0' },
    { id: 'submap', label: 'เจาะโซน', icon: <Crop className="w-3.5 h-3.5" />, shortcut: '' },
  ],
];

export const TopBar: React.FC<TopBarProps> = ({
  map,
  tool,
  onSelectTool,
  onRenameMap,
  canUndo,
  canRedo,
  undoCount,
  redoCount,
  onUndo,
  onRedo,
  autosaveStatus,
  showMinimap,
  onToggleMinimap,
  onOpenLibrary,
  onOpenSizeModal,
  onOpenQuickSearch,
  onOpenShortcuts,
  onOpenParentMap,
  onQuickGenerateWorld,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftName, setDraftName] = useState(map.name);

  return (
    <header className="h-11 bg-[#111720] border-b border-slate-800/90 px-2.5 flex items-center justify-between gap-2 select-none shrink-0 z-20">
      {/* Left: Library + Map Name + Dimensions */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onOpenLibrary}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#18212d] hover:bg-[#222e3e] border border-slate-700/80 text-xs text-slate-200 transition cursor-pointer shrink-0"
          title="คลังแผนที่และนำเข้า/ส่งออก"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden xl:inline">คลังแผนที่</span>
        </button>

        {map.parentMapLink && onOpenParentMap && (
          <button
            onClick={onOpenParentMap}
            className="flex items-center gap-1 px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-[11px] text-sky-200 font-medium transition cursor-pointer shrink-0"
            title={`กลับไปยังแผนที่โลกหลัก: ${map.parentMapLink.parentMapName}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">กลับแผนที่หลัก</span>
          </button>
        )}

        {editingTitle ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              if (draftName.trim()) onRenameMap(draftName.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditingTitle(false);
                if (draftName.trim()) onRenameMap(draftName.trim());
              }
            }}
            className="bg-[#1c2635] border border-amber-500/70 rounded px-2 py-0.5 text-sm font-semibold text-amber-100 outline-none w-40"
          />
        ) : (
          <button
            onClick={() => {
              setDraftName(map.name);
              setEditingTitle(true);
            }}
            className="text-sm font-semibold text-amber-100 hover:text-amber-300 truncate max-w-[130px] cursor-pointer"
            title="คลิกเพื่อเปลี่ยนชื่อแผนที่"
          >
            {map.name}
          </button>
        )}

        <button
          onClick={onOpenSizeModal}
          className="hidden 2xl:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#161e29] hover:bg-[#1f2b3a] border border-slate-700/60 text-[11px] text-slate-400 hover:text-slate-200 transition cursor-pointer shrink-0"
          title="ปรับแต่งขนาดแผนที่และมาตราส่วนระยะจริง"
        >
          <Compass className="w-3 h-3 text-amber-400/80" />
          <span>
            {map.width} × {map.height} · {map.hexSizeKm} กม.
          </span>
        </button>
      </div>

      {/* Center: Grouped Tool Mode Switcher */}
      <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        {TOOL_GROUPS.map((group, gIdx) => (
          <React.Fragment key={gIdx}>
            {gIdx > 0 && <div className="h-5 w-px bg-slate-800/90 mx-0.5 shrink-0" />}
            <div className="flex items-center gap-0.5 bg-[#0d131b]/70 border border-slate-800/70 rounded-md p-0.5">
              {group.map((item) => {
                const active = tool === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTool(item.id)}
                    title={item.shortcut ? `${item.label} (คีย์ลัด ${item.shortcut})` : item.label}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                      active
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-[0_0_10px_rgba(217,155,56,0.18)]'
                        : 'text-slate-300 hover:bg-[#1e2938] border border-transparent hover:border-slate-700/70'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </React.Fragment>
        ))}

        <div className="h-5 w-px bg-slate-800 mx-0.5 shrink-0" />

        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="ย้อนกลับ (Ctrl+Z)"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#17202b] border border-slate-800 text-slate-300 hover:bg-[#202c3b] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5" />
          {undoCount !== undefined && undoCount > 0 && (
            <span className="text-[10px] text-amber-300 tabular-nums">{undoCount}</span>
          )}
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="ทำซ้ำ (Ctrl+Y)"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#17202b] border border-slate-800 text-slate-300 hover:bg-[#202c3b] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
        >
          <Redo2 className="w-3.5 h-3.5" />
          {redoCount !== undefined && redoCount > 0 && (
            <span className="text-[10px] text-sky-300 tabular-nums">{redoCount}</span>
          )}
        </button>
      </nav>

      {/* Right: Autosave + Minimap + Generate CTA */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="hidden 2xl:inline-flex items-center gap-1.5 text-[11px] text-emerald-400/90 mr-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              autosaveStatus === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
            }`}
          />
          {autosaveStatus === 'saving' ? 'กำลังบันทึก...' : 'บันทึกแล้ว'}
        </span>

        <button
          onClick={onOpenQuickSearch}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#17202b] hover:bg-[#202c3b] border border-slate-800 text-slate-300 transition cursor-pointer"
          title="ค้นหาด่วนและบุ๊กมาร์ก (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden xl:inline text-[11px] text-slate-400">Ctrl+K</span>
        </button>

        <button
          onClick={onToggleMinimap}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition cursor-pointer ${
            showMinimap
              ? 'bg-slate-800 border-slate-600 text-slate-100'
              : 'bg-[#17202b] border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="เปิด/ปิดแผนที่ย่อ"
        >
          <MapIcon className="w-3.5 h-3.5" />
        </button>

        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#17202b] hover:bg-[#202c3b] border border-slate-800 text-slate-300 transition cursor-pointer"
            title="คีย์ลัดและการควบคุม (?)"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-300" />
          </button>
        )}

        <button
          onClick={onQuickGenerateWorld}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold text-xs transition shadow-sm cursor-pointer"
          title="สุ่มสร้างโลกใหม่ทั้งแผนที่ตามหลักภูมิศาสตร์จริง"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>สร้างโลก</span>
        </button>
      </div>
    </header>
  );
};
