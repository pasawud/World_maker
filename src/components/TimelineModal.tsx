import React, { useState } from 'react';
import { BookOpen, Clock, Plus, Trash2, X } from 'lucide-react';
import { TIMELINE_EVENT_CATEGORIES } from '../data/goods';
import {
  HexMapData,
  TimelineEvent,
  TimelineEventCategory,
  WorldTimeline,
} from '../types/map';

interface TimelineModalProps {
  map: HexMapData;
  timeline: WorldTimeline;
  onSwitchEra: (eraId: string) => void;
  onCreateEra: (name: string, year: number, summary?: string) => void;
  onUpdateTimeline: (updater: (tl: WorldTimeline) => WorldTimeline) => void;
  onClose: () => void;
}

export const TimelineModal: React.FC<TimelineModalProps> = ({
  map,
  timeline,
  onSwitchEra,
  onCreateEra,
  onUpdateTimeline,
  onClose,
}) => {
  const [tab, setTab] = useState<'eras' | 'events'>('eras');
  const [eraName, setEraName] = useState(`ยุคที่ ${timeline.eras.length + 1}`);
  const [eraYear, setEraYear] = useState(
    (timeline.eras[timeline.eras.length - 1]?.year ?? 1) + 100
  );
  const [eraSummary, setEraSummary] = useState('');

  const [evTitle, setEvTitle] = useState('');
  const [evYear, setEvYear] = useState(
    timeline.eras.find((e) => e.id === timeline.activeEraId)?.year ?? 1
  );
  const [evCat, setEvCat] = useState<TimelineEventCategory>('founding');
  const [evDesc, setEvDesc] = useState('');
  const [evCityId, setEvCityId] = useState('');
  const [evKingdomId, setEvKingdomId] = useState('');

  const sortedEras = [...timeline.eras].sort((a, b) => a.year - b.year);
  const sortedEvents = [...timeline.events].sort((a, b) => a.year - b.year);

  const addEvent = () => {
    if (!evTitle.trim()) return;
    const newEvent: TimelineEvent = {
      id: `ev_${Date.now().toString(36)}`,
      year: evYear,
      title: evTitle.trim(),
      category: evCat,
      description: evDesc.trim(),
      cityId: evCityId || undefined,
      kingdomId: evKingdomId || undefined,
    };
    onUpdateTimeline((tl) => ({
      ...tl,
      events: [...tl.events, newEvent],
    }));
    setEvTitle('');
    setEvDesc('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141c27] border border-amber-500/40 rounded-xl w-full max-w-4xl max-h-[86vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-[#111720]">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            ระบบ Timeline ยุคสมัย & พงศาวดารโลก
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-2 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex gap-3">
            <button
              onClick={() => setTab('eras')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 cursor-pointer ${
                tab === 'eras'
                  ? 'border-amber-400 text-amber-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              ยุคสมัย ({sortedEras.length})
            </button>
            <button
              onClick={() => setTab('events')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 cursor-pointer ${
                tab === 'events'
                  ? 'border-amber-400 text-amber-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              เหตุการณ์สำคัญ ({sortedEvents.length})
            </button>
          </div>

          <div className="flex items-center gap-1.5 pb-1">
            <span className="text-slate-400">หน่วยปฏิทิน:</span>
            <input
              value={timeline.calendarUnit}
              onChange={(e) =>
                onUpdateTimeline((tl) => ({ ...tl, calendarUnit: e.target.value }))
              }
              className="w-24 bg-[#0f1620] border border-slate-700 rounded px-2 py-0.5 text-slate-100 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-xs space-y-3">
          {tab === 'eras' && (
            <>
              <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="font-semibold text-amber-200">
                  บันทึกสถานะแผนที่ปัจจุบันเป็นยุคใหม่
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="number"
                    value={eraYear}
                    onChange={(e) => setEraYear(Number(e.target.value) || 1)}
                    className="w-24 bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                    placeholder="ปี"
                  />
                  <input
                    value={eraName}
                    onChange={(e) => setEraName(e.target.value)}
                    placeholder="ชื่อยุคสมัย..."
                    className="flex-1 min-w-[160px] bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
                  />
                  <button
                    onClick={() => {
                      onCreateEra(eraName, eraYear, eraSummary);
                      setEraName(`ยุคที่ ${sortedEras.length + 2}`);
                      setEraYear(eraYear + 100);
                      setEraSummary('');
                    }}
                    className="flex items-center gap-1 px-3 py-1 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> สร้างยุคใหม่
                  </button>
                </div>
                <input
                  value={eraSummary}
                  onChange={(e) => setEraSummary(e.target.value)}
                  placeholder="สรุปเหตุการณ์เด่นในยุคนี้ (ไม่บังคับ)..."
                  className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
                />
              </div>

              <div className="space-y-2">
                {sortedEras.map((era) => {
                  const isActive = era.id === timeline.activeEraId;
                  const totalPop = era.cities.reduce((s, c) => s + c.population, 0);
                  return (
                    <div
                      key={era.id}
                      className={`border rounded-lg p-3 space-y-2 ${
                        isActive
                          ? 'bg-amber-500/10 border-amber-500/60'
                          : 'bg-[#0f1620] border-slate-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                          <input
                            type="number"
                            value={era.year}
                            onChange={(e) =>
                              onUpdateTimeline((tl) => ({
                                ...tl,
                                eras: tl.eras.map((x) =>
                                  x.id === era.id ? { ...x, year: Number(e.target.value) || 0 } : x
                                ),
                              }))
                            }
                            className="w-20 bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-amber-200 font-semibold outline-none"
                          />
                          <input
                            value={era.name}
                            onChange={(e) =>
                              onUpdateTimeline((tl) => ({
                                ...tl,
                                eras: tl.eras.map((x) =>
                                  x.id === era.id ? { ...x, name: e.target.value } : x
                                ),
                              }))
                            }
                            className="flex-1 min-w-[140px] bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 font-semibold text-slate-100 outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onSwitchEra(era.id)}
                            className={`px-2.5 py-1 rounded border cursor-pointer ${
                              isActive
                                ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-semibold'
                                : 'bg-[#1a2433] border-slate-700 text-slate-200 hover:border-slate-500'
                            }`}
                          >
                            {isActive ? 'กำลังแสดงยุคนี้' : 'สลับไปยุคนี้'}
                          </button>
                          <button
                            onClick={() =>
                              onUpdateTimeline((tl) => {
                                if (tl.eras.length <= 1) return tl;
                                const remaining = tl.eras.filter((x) => x.id !== era.id);
                                return {
                                  ...tl,
                                  activeEraId:
                                    tl.activeEraId === era.id ? remaining[0].id : tl.activeEraId,
                                  eras: remaining,
                                };
                              })
                            }
                            disabled={sortedEras.length <= 1}
                            className="p-1 text-slate-400 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <input
                        value={era.summary}
                        onChange={(e) =>
                          onUpdateTimeline((tl) => ({
                            ...tl,
                            eras: tl.eras.map((x) =>
                              x.id === era.id ? { ...x, summary: e.target.value } : x
                            ),
                          }))
                        }
                        placeholder="บันทึกสรุปยุคสมัย..."
                        className="w-full bg-[#161f2c] border border-slate-800 rounded px-2.5 py-1 text-slate-300 outline-none"
                      />
                      <div className="text-[11px] text-slate-400 flex flex-wrap gap-3">
                        <span>เมือง: {era.cities.length}</span>
                        <span>ประชากรรวม: {totalPop.toLocaleString()} คน</span>
                        <span>อาณาจักร: {era.kingdoms.length}</span>
                        <span>เส้นทางการค้า: {era.tradeRoutes.length}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'events' && (
            <>
              <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="font-semibold text-purple-300">เพิ่มเหตุการณ์ทางประวัติศาสตร์</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="number"
                    value={evYear}
                    onChange={(e) => setEvYear(Number(e.target.value) || 1)}
                    placeholder="ปี"
                    className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                  />
                  <select
                    value={evCat}
                    onChange={(e) => setEvCat(e.target.value as TimelineEventCategory)}
                    className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                  >
                    {TIMELINE_EVENT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.symbol} {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={evTitle}
                    onChange={(e) => setEvTitle(e.target.value)}
                    placeholder="ชื่อเหตุการณ์ เช่น สนธิสัญญาซิลเวอร์ฮาร์เบอร์..."
                    className="sm:col-span-2 bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={evKingdomId}
                    onChange={(e) => setEvKingdomId(e.target.value)}
                    className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none"
                  >
                    <option value="">-- อาณาจักรที่เกี่ยวข้อง (ถ้ามี) --</option>
                    {map.kingdoms.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={evCityId}
                    onChange={(e) => setEvCityId(e.target.value)}
                    className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none"
                  >
                    <option value="">-- เมืองที่เกี่ยวข้อง (ถ้ามี) --</option>
                    {map.cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addEvent}
                    className="flex items-center justify-center gap-1 px-3 py-1 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> บันทึกเหตุการณ์
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={evDesc}
                  onChange={(e) => setEvDesc(e.target.value)}
                  placeholder="รายละเอียดเหตุการณ์..."
                  className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none resize-none"
                />
              </div>

              <div className="space-y-2">
                {sortedEvents.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    ยังไม่มีเหตุการณ์ในพงศาวดาร — เพิ่มเหตุการณ์สำคัญด้านบน
                  </div>
                ) : (
                  sortedEvents.map((ev) => {
                    const cat =
                      TIMELINE_EVENT_CATEGORIES.find((c) => c.id === ev.category) ??
                      TIMELINE_EVENT_CATEGORIES[7];
                    const city = ev.cityId ? map.cities.find((c) => c.id === ev.cityId) : null;
                    const kingdom = ev.kingdomId
                      ? map.kingdoms.find((k) => k.id === ev.kingdomId)
                      : null;
                    const nearestEra = sortedEras.reduce((best, cur) =>
                      Math.abs(cur.year - ev.year) < Math.abs(best.year - ev.year) ? cur : best
                    );

                    return (
                      <div
                        key={ev.id}
                        className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-semibold"
                              style={{
                                backgroundColor: `${cat.color}25`,
                                color: cat.color,
                              }}
                            >
                              {cat.symbol} {timeline.calendarUnit} {ev.year}
                            </span>
                            <span className="font-semibold text-slate-100">{ev.title}</span>
                            {kingdom && <span className="text-[11px] text-amber-300">👑 {kingdom.name}</span>}
                            {city && <span className="text-[11px] text-sky-300">★ {city.name}</span>}
                          </div>
                          {ev.description && (
                            <p className="text-slate-400 text-[11px]">{ev.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {nearestEra && (
                            <button
                              onClick={() => {
                                onSwitchEra(nearestEra.id);
                                onClose();
                              }}
                              className="px-2 py-1 rounded bg-[#182230] border border-slate-700 text-[11px] text-slate-200 hover:border-amber-500/50 cursor-pointer"
                            >
                              ดูยุคใกล้เคียง
                            </button>
                          )}
                          <button
                            onClick={() =>
                              onUpdateTimeline((tl) => ({
                                ...tl,
                                events: tl.events.filter((x) => x.id !== ev.id),
                              }))
                            }
                            className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
