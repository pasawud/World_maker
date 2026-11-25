import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pause,
  Play,
  Plus,
  Save,
  X,
} from 'lucide-react';
import { WorldTimeline } from '../types/map';

interface TimelineBarProps {
  timeline: WorldTimeline;
  onSwitchEra: (eraId: string) => void;
  onSaveActiveEra: () => void;
  onCreateEra: (name: string, year: number) => void;
  onOpenTimelineModal: () => void;
  onCloseBar: () => void;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  timeline,
  onSwitchEra,
  onSaveActiveEra,
  onCreateEra,
  onOpenTimelineModal,
  onCloseBar,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);

  const sortedEras = [...timeline.eras].sort((a, b) => a.year - b.year);
  const activeIdx = Math.max(
    0,
    sortedEras.findIndex((e) => e.id === timeline.activeEraId)
  );
  const activeEra = sortedEras[activeIdx] ?? sortedEras[0];

  const [newName, setNewName] = useState(`ยุคที่ ${sortedEras.length + 1}`);
  const [newYear, setNewYear] = useState((activeEra?.year ?? 1) + 100);

  useEffect(() => {
    if (!isPlaying || sortedEras.length <= 1) return;
    const timer = window.setInterval(() => {
      const nextIdx = (activeIdx + 1) % sortedEras.length;
      onSwitchEra(sortedEras[nextIdx].id);
    }, 1700);
    return () => window.clearInterval(timer);
  }, [activeIdx, isPlaying, onSwitchEra, sortedEras]);

  if (!activeEra) return null;

  return (
    <div className="bg-[#111720]/95 border-t border-slate-800 px-3 py-2 flex flex-col gap-1.5 text-xs select-none z-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
            <Clock className="w-3.5 h-3.5" />
            Timeline:
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-100 font-medium">
            {activeEra.name} ({timeline.calendarUnit} {activeEra.year})
          </span>

          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={() => {
                if (activeIdx > 0) onSwitchEra(sortedEras[activeIdx - 1].id);
              }}
              disabled={activeIdx <= 0}
              className="p-1 rounded bg-[#182230] border border-slate-700 text-slate-300 disabled:opacity-35 cursor-pointer"
              title="ยุคก่อนหน้า"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsPlaying((p) => !p)}
              disabled={sortedEras.length <= 1}
              className={`flex items-center gap-1 px-2 py-0.5 rounded border cursor-pointer disabled:opacity-40 ${
                isPlaying
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : 'bg-[#182230] border-slate-700 text-slate-200'
              }`}
              title="เล่นไทม์ไลน์อัตโนมัติ"
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isPlaying ? 'หยุด' : 'เล่น'}</span>
            </button>
            <button
              onClick={() => {
                if (activeIdx < sortedEras.length - 1) onSwitchEra(sortedEras[activeIdx + 1].id);
              }}
              disabled={activeIdx >= sortedEras.length - 1}
              className="p-1 rounded bg-[#182230] border border-slate-700 text-slate-300 disabled:opacity-35 cursor-pointer"
              title="ยุคถัดไป"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={onSaveActiveEra}
            className="flex items-center gap-1 px-2 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/45 text-sky-200 cursor-pointer"
            title="บันทึกสภาพแผนที่ปัจจุบันลงในยุคนี้"
          >
            <Save className="w-3 h-3" />
            <span>บันทึกยุคนี้</span>
          </button>

          <button
            onClick={() => {
              setNewName(`ยุคที่ ${sortedEras.length + 1}`);
              setNewYear((activeEra?.year ?? 1) + 100);
              setShowNewForm((v) => !v);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 font-medium cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>สร้างยุคใหม่</span>
          </button>

          <button
            onClick={onOpenTimelineModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1b2533] hover:bg-[#243144] border border-slate-700 text-slate-200 cursor-pointer"
          >
            <BookOpen className="w-3 h-3 text-purple-300" />
            <span>พงศาวดาร ({timeline.events.length})</span>
          </button>

          <button
            onClick={onCloseBar}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
            title="ซ่อนแถบ Timeline"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Era Pills Scrubber */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
        {sortedEras.map((era, idx) => {
          const active = era.id === activeEra.id;
          return (
            <React.Fragment key={era.id}>
              {idx > 0 && <div className="w-4 h-px bg-slate-700 shrink-0" />}
              <button
                onClick={() => {
                  setIsPlaying(false);
                  onSwitchEra(era.id);
                }}
                className={`px-2.5 py-1 rounded-full border text-[11px] whitespace-nowrap transition cursor-pointer ${
                  active
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-semibold'
                    : 'bg-[#0f1620] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {era.year} · {era.name}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {showNewForm && (
        <div className="flex flex-wrap items-center gap-2 bg-[#0f1620] border border-amber-500/40 rounded px-2.5 py-1.5">
          <span className="text-[11px] text-amber-200">สร้างยุคใหม่จากแผนที่ปัจจุบัน:</span>
          <input
            type="number"
            value={newYear}
            onChange={(e) => setNewYear(Number(e.target.value) || 1)}
            className="w-20 bg-[#161f2c] border border-slate-700 rounded px-2 py-0.5 text-slate-100 outline-none"
            placeholder="ปี"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 min-w-[160px] bg-[#161f2c] border border-slate-700 rounded px-2 py-0.5 text-slate-100 outline-none"
            placeholder="ชื่อยุคสมัย..."
          />
          <button
            onClick={() => {
              onCreateEra(newName, newYear);
              setShowNewForm(false);
            }}
            className="px-3 py-0.5 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
          >
            สร้างและเริ่มแก้ไขยุคนี้
          </button>
        </div>
      )}
    </div>
  );
};
