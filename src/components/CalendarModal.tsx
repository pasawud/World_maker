import React, { useState } from 'react';
import {
  Calendar,
  ChevronRight,
  Moon,
  Plus,
  RotateCcw,
  Snowflake,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import {
  advanceCalendarDays,
  createDefaultCalendar,
  getCurrentSeason,
  getMoonPhase,
  SEASON_LABELS_TH,
} from '../engine/calendar';
import { CalendarMonth, HexMapData, SeasonId, WorldCalendar, WorldMoon } from '../types/map';

interface CalendarModalProps {
  map: HexMapData;
  activeSeason: SeasonId | null;
  onChangeSeason: (season: SeasonId | null) => void;
  onUpdateCalendar: (calendar: WorldCalendar) => void;
  onClose: () => void;
}

const SEASON_STYLE: Record<SeasonId, { badge: string; icon: string }> = {
  spring: { badge: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200', icon: '🌸' },
  summer: { badge: 'bg-amber-500/20 border-amber-400/50 text-amber-200', icon: '☀️' },
  autumn: { badge: 'bg-orange-500/20 border-orange-400/50 text-orange-200', icon: '🍂' },
  winter: { badge: 'bg-sky-500/20 border-sky-400/50 text-sky-200', icon: '❄️' },
};

export const CalendarModal: React.FC<CalendarModalProps> = ({
  map,
  activeSeason,
  onChangeSeason,
  onUpdateCalendar,
  onClose,
}) => {
  const cal = map.calendar ?? createDefaultCalendar();
  const curMonth = cal.months[cal.monthIdx] ?? cal.months[0];
  const curSeason = getCurrentSeason(cal);
  const [newMonthName, setNewMonthName] = useState('');
  const [newMoonName, setNewMoonName] = useState('');

  const handleAdvance = (deltaDays: number) => {
    const next = advanceCalendarDays(cal, deltaDays);
    onUpdateCalendar(next);
    if (activeSeason !== null) {
      onChangeSeason(getCurrentSeason(next));
    }
  };

  const handleAdvanceSeason = () => {
    const startSeason = curSeason;
    let probe = cal;
    for (let step = 0; step < 36; step++) {
      const m = probe.months[probe.monthIdx];
      const daysLeft = (m?.days ?? 30) - probe.day + 1;
      probe = advanceCalendarDays(probe, daysLeft);
      if (getCurrentSeason(probe) !== startSeason) break;
    }
    onUpdateCalendar(probe);
    if (activeSeason !== null) {
      onChangeSeason(getCurrentSeason(probe));
    }
  };

  const updateMonth = (idx: number, patch: Partial<CalendarMonth>) => {
    const months = cal.months.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    onUpdateCalendar({ ...cal, months });
  };

  const addMonth = () => {
    const name = newMonthName.trim() || `เดือนที่ ${cal.months.length + 1}`;
    const months: CalendarMonth[] = [
      ...cal.months,
      {
        id: `m_${Date.now().toString(36)}`,
        name,
        days: 30,
        season: curSeason,
      },
    ];
    onUpdateCalendar({ ...cal, months });
    setNewMonthName('');
  };

  const removeMonth = (idx: number) => {
    if (cal.months.length <= 1) return;
    const months = cal.months.filter((_, i) => i !== idx);
    const monthIdx = Math.min(cal.monthIdx, months.length - 1);
    const day = Math.min(cal.day, months[monthIdx]?.days ?? 1);
    onUpdateCalendar({ ...cal, months, monthIdx, day });
  };

  const updateMoon = (idx: number, patch: Partial<WorldMoon>) => {
    const moons = cal.moons.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    onUpdateCalendar({ ...cal, moons });
  };

  const addMoon = () => {
    const name = newMoonName.trim() || `จันทรา ${cal.moons.length + 1}`;
    const moons: WorldMoon[] = [
      ...cal.moons,
      {
        id: `moon_${Date.now().toString(36)}`,
        name,
        cycleDays: 36,
        color: '#bae6fd',
      },
    ];
    onUpdateCalendar({ ...cal, moons });
    setNewMoonName('');
  };

  const removeMoon = (idx: number) => {
    const moons = cal.moons.filter((_, i) => i !== idx);
    onUpdateCalendar({ ...cal, moons });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141c27] border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-300" />
            <h2 className="text-sm font-semibold text-amber-300">
              ระบบปฏิทินโลก ดวงจันทร์ และฤดูกาล (Calendar & Seasons)
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Current Date & Time Controls */}
          <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-base font-bold text-slate-100">
                  <input
                    value={cal.name}
                    onChange={(e) => onUpdateCalendar({ ...cal, name: e.target.value })}
                    className="w-36 bg-[#161f2c] border border-slate-700 rounded px-2 py-0.5 text-sm text-amber-300 outline-none"
                  />
                  <span>ปีที่</span>
                  <input
                    type="number"
                    value={cal.year}
                    onChange={(e) =>
                      onUpdateCalendar({ ...cal, year: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="w-20 bg-[#161f2c] border border-slate-700 rounded px-2 py-0.5 text-sm text-slate-100 outline-none"
                  />
                  <span>
                    · {curMonth?.name ?? 'เดือน'} วันที่ {cal.day}/{curMonth?.days ?? 30}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                  <span>ฤดูกาลปัจจุบันตามปฏิทิน:</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${SEASON_STYLE[curSeason].badge}`}
                  >
                    {SEASON_STYLE[curSeason].icon} {SEASON_LABELS_TH[curSeason]}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleAdvance(1)}
                  className="px-2.5 py-1.5 rounded bg-[#182332] hover:bg-[#223044] border border-slate-700 text-slate-200 cursor-pointer flex items-center gap-1"
                >
                  +1 วัน <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleAdvance(7)}
                  className="px-2.5 py-1.5 rounded bg-[#182332] hover:bg-[#223044] border border-slate-700 text-slate-200 cursor-pointer"
                >
                  +7 วัน
                </button>
                <button
                  onClick={() => handleAdvance(curMonth?.days ?? 30)}
                  className="px-2.5 py-1.5 rounded bg-[#182332] hover:bg-[#223044] border border-slate-700 text-amber-200 cursor-pointer"
                >
                  +1 เดือน
                </button>
                <button
                  onClick={handleAdvanceSeason}
                  className="px-2.5 py-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 cursor-pointer font-medium"
                >
                  ข้ามไปฤดูกาลถัดไป
                </button>
              </div>
            </div>

            {/* Season Simulation on Map */}
            <div className="border-t border-slate-800 pt-2.5 flex flex-wrap items-center gap-2">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                จำลองฤดูกาลบนแผนที่ (ปรับอุณหภูมิและแนวหิมะอัตโนมัติ):
              </span>
              <button
                onClick={() => onChangeSeason(null)}
                className={`px-2.5 py-1 rounded border cursor-pointer ${
                  activeSeason === null
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                    : 'bg-[#161f2c] border-slate-700 text-slate-400'
                }`}
              >
                ค่าเฉลี่ยทั้งปี (ปิด)
              </button>
              {(['spring', 'summer', 'autumn', 'winter'] as SeasonId[]).map((sid) => (
                <button
                  key={sid}
                  onClick={() => onChangeSeason(sid)}
                  className={`px-2.5 py-1 rounded border cursor-pointer flex items-center gap-1 ${
                    activeSeason === sid
                      ? SEASON_STYLE[sid].badge + ' font-semibold'
                      : 'bg-[#161f2c] border-slate-700 text-slate-300'
                  }`}
                >
                  <span>{SEASON_STYLE[sid].icon}</span>
                  <span>{SEASON_LABELS_TH[sid]}</span>
                </button>
              ))}
              <button
                onClick={() => onChangeSeason(curSeason)}
                className="ml-auto px-2 py-1 rounded bg-[#182332] hover:bg-[#223044] border border-slate-700 text-[11px] text-emerald-300 cursor-pointer"
              >
                ซิงค์กับเดือนปัจจุบัน ({SEASON_LABELS_TH[curSeason]})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Months List */}
            <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Snowflake className="w-3.5 h-3.5" />
                  เดือนและฤดูกาลในรอบปี ({cal.months.length} เดือน)
                </span>
                <button
                  onClick={() => onUpdateCalendar(createDefaultCalendar())}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                  title="รีเซ็ตปฏิทินมาตรฐาน 12 เดือน"
                >
                  <RotateCcw className="w-3 h-3" /> รีเซ็ต
                </button>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {cal.months.map((m, i) => {
                  const isCurrent = i === cal.monthIdx;
                  return (
                    <div
                      key={m.id}
                      className={`grid grid-cols-12 gap-1.5 items-center p-1.5 rounded border ${
                        isCurrent
                          ? 'bg-amber-500/10 border-amber-500/50'
                          : 'bg-[#151e2b] border-slate-800'
                      }`}
                    >
                      <button
                        onClick={() =>
                          onUpdateCalendar({
                            ...cal,
                            monthIdx: i,
                            day: Math.min(cal.day, m.days),
                          })
                        }
                        className="col-span-1 text-center text-[10px] font-mono text-slate-400 hover:text-amber-300 cursor-pointer"
                        title="ตั้งเป็นเดือนปัจจุบัน"
                      >
                        {isCurrent ? '▶' : i + 1}
                      </button>
                      <input
                        value={m.name}
                        onChange={(e) => updateMonth(i, { name: e.target.value })}
                        className="col-span-5 bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                      />
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={m.days}
                        onChange={(e) =>
                          updateMonth(i, {
                            days: Math.max(5, Math.min(120, Number(e.target.value) || 30)),
                          })
                        }
                        className="col-span-2 bg-[#0f1620] border border-slate-700 rounded px-1.5 py-1 text-center text-slate-100 outline-none"
                        title="จำนวนวันในเดือนนี้"
                      />
                      <select
                        value={m.season}
                        onChange={(e) => updateMonth(i, { season: e.target.value as SeasonId })}
                        className="col-span-3 bg-[#0f1620] border border-slate-700 rounded px-1.5 py-1 text-slate-200 outline-none"
                      >
                        {(['spring', 'summer', 'autumn', 'winter'] as SeasonId[]).map((s) => (
                          <option key={s} value={s}>
                            {SEASON_LABELS_TH[s]}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={cal.months.length <= 1}
                        onClick={() => removeMonth(i)}
                        className="col-span-1 flex justify-center text-slate-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-1.5 pt-1">
                <input
                  value={newMonthName}
                  onChange={(e) => setNewMonthName(e.target.value)}
                  placeholder="ชื่อเดือนใหม่..."
                  className="flex-1 bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
                />
                <button
                  onClick={addMonth}
                  className="px-2.5 py-1 rounded bg-[#182332] hover:bg-[#223044] border border-slate-700 text-amber-300 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มเดือน
                </button>
              </div>
            </div>

            {/* Moons List */}
            <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5" />
                  ดวงจันทร์และข้างขึ้น-ข้างแรม ({cal.moons.length} ดวง)
                </span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {cal.moons.map((moon, i) => {
                  const phase = getMoonPhase(cal, moon);
                  const illum = Math.sin(phase.ratio * Math.PI);
                  return (
                    <div
                      key={moon.id}
                      className="bg-[#151e2b] border border-slate-800 rounded-lg p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className="w-6 h-6 rounded-full border border-slate-600 shrink-0 relative overflow-hidden flex items-center justify-center text-xs"
                            style={{ backgroundColor: '#0f1620' }}
                            title={`${phase.labelTh} · สว่าง ${Math.round(illum * 100)}%`}
                          >
                            <div
                              className="absolute inset-y-0 left-0 opacity-35 transition-all"
                              style={{
                                width: `${Math.round(illum * 100)}%`,
                                backgroundColor: moon.color,
                              }}
                            />
                            <span className="relative z-10">{phase.icon}</span>
                          </div>
                          <input
                            value={moon.name}
                            onChange={(e) => updateMoon(i, { name: e.target.value })}
                            className="flex-1 bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                          />
                        </div>
                        <span className="text-[11px] text-sky-300 font-medium whitespace-nowrap">
                          {phase.labelTh} ({Math.round(illum * 100)}%)
                        </span>
                        <button
                          onClick={() => removeMoon(i)}
                          className="text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <label className="text-slate-400">รอบโคจร (วัน)</label>
                          <input
                            type="number"
                            min={4}
                            max={365}
                            value={moon.cycleDays}
                            onChange={(e) =>
                              updateMoon(i, {
                                cycleDays: Math.max(4, Number(e.target.value) || 28),
                              })
                            }
                            className="w-full mt-0.5 bg-[#0f1620] border border-slate-700 rounded px-2 py-0.5 text-slate-100 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400">สีแสงจันทร์</label>
                          <input
                            type="color"
                            value={moon.color}
                            onChange={(e) => updateMoon(i, { color: e.target.value })}
                            className="w-full h-6 mt-0.5 bg-transparent rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-1.5 pt-1">
                <input
                  value={newMoonName}
                  onChange={(e) => setNewMoonName(e.target.value)}
                  placeholder="ชื่อดวงจันทร์ดวงใหม่..."
                  className="flex-1 bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
                />
                <button
                  onClick={addMoon}
                  className="px-2.5 py-1 rounded bg-[#182332] hover:bg-[#223044] border border-slate-700 text-sky-300 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มดวงจันทร์
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
