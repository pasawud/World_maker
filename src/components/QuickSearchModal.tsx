import React, { useEffect, useMemo, useState } from 'react';
import { Bookmark, MapPin, Plus, Search, Trash2, X } from 'lucide-react';
import { HexMapData } from '../types/map';

interface QuickSearchModalProps {
  map: HexMapData;
  onJumpToCoord: (q: number, r: number, zoom?: number) => void;
  onSelectCity: (cityId: string) => void;
  onAddBookmark: (name: string, q: number, r: number, zoom: number) => void;
  onDeleteBookmark: (id: string) => void;
  onClose: () => void;
}

interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  q: number;
  r: number;
  zoom?: number;
  cityId?: string;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  map,
  onJumpToCoord,
  onSelectCity,
  onAddBookmark,
  onDeleteBookmark,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [bmName, setBmName] = useState('');

  const allHits = useMemo<SearchHit[]>(() => {
    const out: SearchHit[] = [];
    for (const bm of map.bookmarks ?? []) {
      out.push({
        id: `bm_${bm.id}`,
        title: bm.name,
        subtitle: `บุ๊กมาร์ก (${bm.q}, ${bm.r})`,
        badge: '📌 บุ๊กมาร์ก',
        q: bm.q,
        r: bm.r,
        zoom: bm.zoom,
      });
    }
    for (const c of map.cities) {
      const k = map.kingdoms.find((kk) => kk.id === c.kingdomId);
      out.push({
        id: `city_${c.id}`,
        title: c.name,
        subtitle: `${k?.name ?? 'อิสระ'} · ประชากร ${c.population.toLocaleString()} (${c.q}, ${c.r})`,
        badge: '🏰 เมือง',
        q: c.q,
        r: c.r,
        zoom: 1.15,
        cityId: c.id,
      });
    }
    for (const p of map.pois) {
      out.push({
        id: `poi_${p.id}`,
        title: p.name,
        subtitle: `จุดสำคัญ (${p.q}, ${p.r})`,
        badge: '📍 POI',
        q: p.q,
        r: p.r,
        zoom: 1.1,
      });
    }
    for (const l of map.labels) {
      out.push({
        id: `lbl_${l.id}`,
        title: l.text,
        subtitle: `ป้ายชื่อภูมิภาค (${l.q}, ${l.r})`,
        badge: '🏷️ ป้ายชื่อ',
        q: l.q,
        r: l.r,
        zoom: 0.75,
      });
    }
    for (const cp of map.campaigns ?? []) {
      if (cp.points[0]) {
        out.push({
          id: `cp_${cp.id}`,
          title: cp.name,
          subtitle: `ยุทธการ (${cp.status})`,
          badge: '⚔️ เดินทัพ',
          q: cp.points[0].q,
          r: cp.points[0].r,
          zoom: 0.9,
        });
      }
    }
    for (const w of map.wikiEntries ?? []) {
      if (w.linkedCoord) {
        out.push({
          id: `wiki_${w.id}`,
          title: w.title,
          subtitle: w.summary || `บทความ Wiki (${w.linkedCoord.q}, ${w.linkedCoord.r})`,
          badge: '📜 Wiki',
          q: w.linkedCoord.q,
          r: w.linkedCoord.r,
          zoom: 1.0,
        });
      }
    }
    return out;
  }, [map]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allHits.slice(0, 20);
    return allHits
      .filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.subtitle.toLowerCase().includes(q) ||
          h.badge.toLowerCase().includes(q)
      )
      .slice(0, 24);
  }, [allHits, query]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const activateHit = (hit: SearchHit) => {
    onJumpToCoord(hit.q, hit.r, hit.zoom);
    if (hit.cityId) onSelectCity(hit.cityId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-start justify-center pt-16 p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIdx((i) => Math.max(0, i - 1));
        } else if (e.key === 'Enter' && filtered[selectedIdx]) {
          e.preventDefault();
          activateHit(filtered[selectedIdx]);
        }
      }}
    >
      <div className="bg-[#141c27] border border-slate-700 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center gap-2">
          <Search className="w-4 h-4 text-amber-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาเมือง สถานที่ ป้ายชื่อ ยุทธการ Wiki หรือบุ๊กมาร์ก..."
            className="flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60 text-xs">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-500">ไม่พบรายการที่ค้นหา</div>
          ) : (
            filtered.map((h, i) => (
              <button
                key={h.id}
                onClick={() => activateHit(h)}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-left transition cursor-pointer ${
                  i === selectedIdx ? 'bg-amber-500/20 text-amber-100' : 'hover:bg-[#1b2533] text-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{h.title}</div>
                  <div className="text-[11px] text-slate-400 truncate">{h.subtitle}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#0f1620] border border-slate-700 text-slate-300 shrink-0 ml-2">
                  {h.badge}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Camera Bookmarks Quick Save */}
        <div className="px-3.5 py-2.5 border-t border-slate-800 bg-[#0f1620] flex flex-wrap items-center gap-2 text-xs">
          <Bookmark className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <input
            value={bmName}
            onChange={(e) => setBmName(e.target.value)}
            placeholder="ตั้งชื่อบุ๊กมาร์กจุดกึ่งกลางปัจจุบัน..."
            className="flex-1 min-w-[160px] bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100 outline-none"
          />
          <button
            onClick={() => {
              if (!bmName.trim()) return;
              onAddBookmark(bmName.trim(), Math.floor(map.width / 2), Math.floor(map.height / 2), 0.9);
              setBmName('');
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#d99b38] text-[#0e141c] font-semibold text-[11px] cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            เพิ่มบุ๊กมาร์ก
          </button>
          {(map.bookmarks ?? []).map((bm) => (
            <span
              key={bm.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#182332] border border-slate-700 text-[11px] text-slate-200"
            >
              <button
                onClick={() => {
                  onJumpToCoord(bm.q, bm.r, bm.zoom);
                  onClose();
                }}
                className="flex items-center gap-1 hover:text-amber-300 cursor-pointer"
              >
                <MapPin className="w-3 h-3 text-sky-400" />
                {bm.name}
              </button>
              <button
                onClick={() => onDeleteBookmark(bm.id)}
                className="text-slate-500 hover:text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
