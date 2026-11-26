import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Coins,
  Compass,
  Dices,
  Download,
  FileText,
  Handshake,
  MapPin,
  Plus,
  Shield,
  Swords,
  Trash2,
  Wheat,
  X,
} from 'lucide-react';
import { generateCultureName } from '../engine/nameGenerator';
import { computeRealmEconomics, detectStrategicChokepoints } from '../engine/strategy';
import {
  collectMentionTargets,
  DIPLOMACY_STATUS_META,
  exportLorebookHtml,
  exportLorebookMarkdown,
  getDiplomaticRelation,
  parseWikiMentions,
  WIKI_CATEGORY_META,
} from '../engine/worldbuilding';
import {
  DiplomaticRelationType,
  HexCoord,
  HexMapData,
  MilitaryCampaign,
  WikiCategory,
  WikiEntry,
} from '../types/map';

export type WorldbuildingTab = 'diplomacy' | 'campaigns' | 'wiki' | 'strategy';

interface WorldbuildingModalProps {
  map: HexMapData;
  initialTab?: WorldbuildingTab;
  onUpsertDiplomacy: (
    kingdomA: string,
    kingdomB: string,
    status: DiplomaticRelationType,
    notes?: string
  ) => void;
  onAddCampaign: (cp: Omit<MilitaryCampaign, 'id'>) => void;
  onUpdateCampaign: (id: string, patch: Partial<MilitaryCampaign>) => void;
  onDeleteCampaign: (id: string) => void;
  onAddWikiEntry: (entry: Omit<WikiEntry, 'id' | 'updatedAt'>) => void;
  onUpdateWikiEntry: (id: string, patch: Partial<WikiEntry>) => void;
  onDeleteWikiEntry: (id: string) => void;
  onJumpToCoord: (q: number, r: number, zoom?: number) => void;
  onStartDrawCampaign: (kingdomId: string) => void;
  onClose: () => void;
}

export const WorldbuildingModal: React.FC<WorldbuildingModalProps> = ({
  map,
  initialTab = 'diplomacy',
  onUpsertDiplomacy,
  onUpdateCampaign,
  onDeleteCampaign,
  onAddWikiEntry,
  onUpdateWikiEntry,
  onDeleteWikiEntry,
  onJumpToCoord,
  onStartDrawCampaign,
  onClose,
}) => {
  const [tab, setTab] = useState<WorldbuildingTab>(initialTab);
  const [selectedPair, setSelectedPair] = useState<{ a: string; b: string } | null>(null);
  const [dipNote, setDipNote] = useState('');

  // Wiki state
  const wikiList = map.wikiEntries ?? [];
  const [selectedWikiId, setSelectedWikiId] = useState<string | null>(
    () => wikiList[0]?.id ?? null
  );
  const [wikiTitle, setWikiTitle] = useState('');
  const [wikiCat, setWikiCat] = useState<WikiCategory>('legend');
  const [wikiSummary, setWikiSummary] = useState('');
  const [wikiContent, setWikiContent] = useState('');
  const [wikiTagsStr, setWikiTagsStr] = useState('');
  const [wikiCoordQ, setWikiCoordQ] = useState<string>('');
  const [wikiCoordR, setWikiCoordR] = useState<string>('');
  const [editingWikiId, setEditingWikiId] = useState<string | null>(null);

  const mentionTargets = useMemo(() => collectMentionTargets(map), [map]);
  const realmEconomics = useMemo(() => computeRealmEconomics(map), [map]);
  const chokepoints = useMemo(() => detectStrategicChokepoints(map, 24), [map]);
  const selectedWiki = wikiList.find((w) => w.id === selectedWikiId) ?? null;

  const startNewWiki = () => {
    setEditingWikiId(null);
    setWikiTitle('');
    setWikiCat('legend');
    setWikiSummary('');
    setWikiContent('');
    setWikiTagsStr('');
    setWikiCoordQ('');
    setWikiCoordR('');
    setSelectedWikiId('__new__');
  };

  const startEditWiki = (w: WikiEntry) => {
    setEditingWikiId(w.id);
    setWikiTitle(w.title);
    setWikiCat(w.category);
    setWikiSummary(w.summary);
    setWikiContent(w.content);
    setWikiTagsStr(w.tags.join(', '));
    setWikiCoordQ(w.linkedCoord ? String(w.linkedCoord.q) : '');
    setWikiCoordR(w.linkedCoord ? String(w.linkedCoord.r) : '');
    setSelectedWikiId('__edit__');
  };

  const handleSaveWiki = () => {
    if (!wikiTitle.trim()) return;
    const qNum = wikiCoordQ.trim() !== '' ? Number(wikiCoordQ) : NaN;
    const rNum = wikiCoordR.trim() !== '' ? Number(wikiCoordR) : NaN;
    const linkedCoord: HexCoord | undefined =
      Number.isInteger(qNum) && Number.isInteger(rNum) ? { q: qNum, r: rNum } : undefined;
    const tags = wikiTagsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingWikiId) {
      onUpdateWikiEntry(editingWikiId, {
        title: wikiTitle.trim(),
        category: wikiCat,
        summary: wikiSummary.trim(),
        content: wikiContent,
        tags,
        linkedCoord,
      });
      setSelectedWikiId(editingWikiId);
    } else {
      onAddWikiEntry({
        title: wikiTitle.trim(),
        category: wikiCat,
        summary: wikiSummary.trim(),
        content: wikiContent,
        tags,
        linkedCoord,
      });
      setSelectedWikiId(null);
    }
    setEditingWikiId(null);
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141c27] border border-slate-700 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            สตูดิโอแต่งโลก: การทูต · ยุทธการ · สารานุกรม (Worldbuilding Studio)
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                downloadFile(
                  exportLorebookMarkdown(map),
                  `${map.name.replace(/\s+/g, '_')}_Lorebook.md`,
                  'text/markdown;charset=utf-8'
                )
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1b2636] hover:bg-[#243247] border border-slate-700 text-[11px] text-emerald-300 cursor-pointer"
              title="ส่งออกหนังสือโลก Markdown"
            >
              <Download className="w-3.5 h-3.5" />
              Lorebook .MD
            </button>
            <button
              onClick={() =>
                downloadFile(
                  exportLorebookHtml(map),
                  `${map.name.replace(/\s+/g, '_')}_Lorebook.html`,
                  'text/html;charset=utf-8'
                )
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1b2636] hover:bg-[#243247] border border-slate-700 text-[11px] text-amber-300 cursor-pointer"
              title="ส่งออก Lorebook HTML เปิดอ่านสวยงาม"
            >
              <FileText className="w-3.5 h-3.5" />
              Lorebook .HTML
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 pt-2 border-b border-slate-800 flex flex-wrap gap-3 text-xs">
          {[
            { id: 'diplomacy' as const, label: 'เมทริกซ์การทูต (Diplomacy)', icon: <Handshake className="w-3.5 h-3.5" /> },
            { id: 'campaigns' as const, label: `สงคราม & ยุทธการ (${(map.campaigns ?? []).length})`, icon: <Swords className="w-3.5 h-3.5" /> },
            { id: 'strategy' as const, label: `เศรษฐกิจ & ยุทธศาสตร์ (${chokepoints.length})`, icon: <Coins className="w-3.5 h-3.5" /> },
            { id: 'wiki' as const, label: `สารานุกรมโลก (${wikiList.length})`, icon: <BookOpen className="w-3.5 h-3.5" /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition cursor-pointer ${
                tab === t.id
                  ? 'border-amber-400 text-amber-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-xs">
          {/* 1. DIPLOMACY MATRIX */}
          {tab === 'diplomacy' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 bg-[#0f1620] border border-slate-800 rounded-lg p-2.5">
                <span className="text-slate-400 font-medium">สถานะ:</span>
                {(Object.keys(DIPLOMACY_STATUS_META) as DiplomaticRelationType[]).map((st) => (
                  <span
                    key={st}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px]"
                    style={{
                      borderColor: `${DIPLOMACY_STATUS_META[st].color}70`,
                      color: DIPLOMACY_STATUS_META[st].color,
                    }}
                  >
                    ● {DIPLOMACY_STATUS_META[st].labelTh}
                  </span>
                ))}
                <span className="text-slate-500 ml-auto text-[11px]">
                  คลิกช่องตัดกันเพื่อปรับความสัมพันธ์ระหว่างอาณาจักร
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-center">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-slate-400 border-b border-slate-800">
                        อาณาจักร
                      </th>
                      {map.kingdoms.map((kb) => (
                        <th key={kb.id} className="p-2 border-b border-slate-800 text-[11px] text-slate-200">
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: kb.color }}
                            />
                            <span className="truncate max-w-[90px]">{kb.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {map.kingdoms.map((ka) => (
                      <tr key={ka.id} className="border-b border-slate-800/60">
                        <td className="p-2 text-left font-medium text-slate-200 whitespace-nowrap">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
                            style={{ backgroundColor: ka.color }}
                          />
                          {ka.name}
                        </td>
                        {map.kingdoms.map((kb) => {
                          if (ka.id === kb.id) {
                            return (
                              <td key={kb.id} className="p-1.5 bg-slate-900/50 text-slate-600">
                                —
                              </td>
                            );
                          }
                          const rel = getDiplomaticRelation(map.diplomacy, ka.id, kb.id);
                          const status = rel?.status ?? 'neutral';
                          const meta = DIPLOMACY_STATUS_META[status];
                          const isSelected =
                            selectedPair &&
                            ((selectedPair.a === ka.id && selectedPair.b === kb.id) ||
                              (selectedPair.a === kb.id && selectedPair.b === ka.id));
                          return (
                            <td key={kb.id} className="p-1">
                              <button
                                onClick={() => {
                                  setSelectedPair({ a: ka.id, b: kb.id });
                                  setDipNote(rel?.notes ?? '');
                                }}
                                className={`w-full py-1 px-1.5 rounded border text-[11px] font-medium cursor-pointer transition ${
                                  isSelected ? 'ring-2 ring-amber-400' : ''
                                }`}
                                style={{
                                  backgroundColor: `${meta.color}18`,
                                  borderColor: `${meta.color}55`,
                                  color: meta.color,
                                }}
                                title={rel?.notes || meta.labelTh}
                              >
                                {meta.short}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedPair && (() => {
                const ka = map.kingdoms.find((k) => k.id === selectedPair.a);
                const kb = map.kingdoms.find((k) => k.id === selectedPair.b);
                if (!ka || !kb) return null;
                const rel = getDiplomaticRelation(map.diplomacy, ka.id, kb.id);
                const curStatus = rel?.status ?? 'neutral';
                return (
                  <div className="bg-[#0f1620] border border-amber-500/40 rounded-lg p-3 space-y-2.5">
                    <div className="font-semibold text-amber-200">
                      ความสัมพันธ์: {ka.name} ↔ {kb.name}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(DIPLOMACY_STATUS_META) as DiplomaticRelationType[]).map((st) => {
                        const meta = DIPLOMACY_STATUS_META[st];
                        return (
                          <button
                            key={st}
                            onClick={() => onUpsertDiplomacy(ka.id, kb.id, st, dipNote)}
                            className={`px-2.5 py-1 rounded border text-[11px] cursor-pointer ${
                              curStatus === st ? 'font-semibold ring-1 ring-white/50' : 'opacity-75'
                            }`}
                            style={{
                              backgroundColor: `${meta.color}22`,
                              borderColor: meta.color,
                              color: meta.color,
                            }}
                          >
                            {meta.labelTh}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={dipNote}
                        onChange={(e) => setDipNote(e.target.value)}
                        placeholder="บันทึกสนธิสัญญา / สาเหตุสงคราม..."
                        className="flex-1 bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
                      />
                      <button
                        onClick={() => onUpsertDiplomacy(ka.id, kb.id, curStatus, dipNote)}
                        className="px-3 py-1 rounded bg-[#d99b38] text-[#0e141c] font-semibold cursor-pointer"
                      >
                        บันทึกบันทึก
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 2. CAMPAIGNS TAB */}
          {tab === 'campaigns' && (
            <div className="space-y-3">
              <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-100">วาดลูกศรการเคลื่อนทัพและสมรภูมิบนแผนที่</div>
                  <div className="text-[11px] text-slate-400">
                    เลือกอาณาจักรแล้วกดวาดบนแผนที่โดยตรงเพื่อลากเส้นเดินทัพและทำเครื่องหมายสมรภูมิ
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {map.kingdoms.slice(0, 4).map((k) => (
                    <button
                      key={k.id}
                      onClick={() => {
                        onStartDrawCampaign(k.id);
                        onClose();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#182230] hover:bg-[#223044] border border-slate-700 text-slate-200 text-[11px] cursor-pointer"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: k.color }} />
                      <span>+ วาดทัพ {k.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {(map.campaigns ?? []).length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  ยังไม่มีเส้นทางการเคลื่อนทัพ — ใช้เครื่องมือ "เดินทัพ" บนแถบด้านบนเพื่อลากเส้นยุทธการบนแผนที่
                </div>
              ) : (
                <div className="space-y-2">
                  {map.campaigns!.map((cp) => {
                    const k = map.kingdoms.find((kk) => kk.id === cp.kingdomId);
                    return (
                      <div
                        key={cp.id}
                        className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: k?.color ?? '#ef4444' }}
                          />
                          <div>
                            <input
                              value={cp.name}
                              onChange={(e) => onUpdateCampaign(cp.id, { name: e.target.value })}
                              className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-400 font-semibold text-slate-100 outline-none"
                            />
                            <div className="text-[11px] text-slate-400">
                              ฝ่าย: {k?.name ?? cp.kingdomId} · ความยาว {cp.points.length} จุด · สมรภูมิ{' '}
                              {cp.battles?.length ?? 0} แห่ง
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={cp.status}
                            onChange={(e) =>
                              onUpdateCampaign(cp.id, {
                                status: e.target.value as MilitaryCampaign['status'],
                              })
                            }
                            className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-[11px]"
                          >
                            <option value="planned">วางแผน (Planned)</option>
                            <option value="active">กำลังรุกคืบ (Active)</option>
                            <option value="victory">มีชัยชนะ (Victory)</option>
                            <option value="defeat">พ่ายแพ้/ถอนทัพ (Defeat)</option>
                          </select>
                          {cp.points[0] && (
                            <button
                              onClick={() => {
                                onJumpToCoord(cp.points[0].q, cp.points[0].r, 1.0);
                                onClose();
                              }}
                              className="px-2 py-1 rounded bg-sky-500/20 border border-sky-500/40 text-sky-200 text-[11px] cursor-pointer"
                            >
                              ไปยังทัพ
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteCampaign(cp.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. WIKI TAB */}
          {tab === 'wiki' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[420px]">
              {/* Left list */}
              <div className="space-y-2 border-r border-slate-800 pr-3">
                <button
                  onClick={startNewWiki}
                  className="w-full flex items-center justify-center gap-1 py-1.5 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  เขียนบทความใหม่
                </button>
                <div className="space-y-1 max-h-[380px] overflow-y-auto">
                  {wikiList.length === 0 ? (
                    <div className="text-slate-500 text-center py-6 text-[11px]">
                      ยังไม่มีบทความในสารานุกรม
                    </div>
                  ) : (
                    wikiList.map((w) => {
                      const cat = WIKI_CATEGORY_META[w.category];
                      return (
                        <button
                          key={w.id}
                          onClick={() => setSelectedWikiId(w.id)}
                          className={`w-full text-left px-2.5 py-2 rounded border transition cursor-pointer ${
                            selectedWikiId === w.id
                              ? 'bg-amber-500/18 border-amber-500/60 text-amber-100'
                              : 'bg-[#0f1620] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-semibold truncate">
                            {cat.icon} {w.title}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {cat.labelTh}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Editor / Reader */}
              <div className="md:col-span-2 space-y-3">
                {selectedWikiId === '__new__' || selectedWikiId === '__edit__' ? (
                  <div className="space-y-2.5 bg-[#0f1620] border border-slate-800 rounded-lg p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        value={wikiTitle}
                        onChange={(e) => setWikiTitle(e.target.value)}
                        placeholder="ชื่อเรื่อง (เช่น กษัตริย์อาร์เทอร์, สงครามมังกร...)"
                        className="sm:col-span-2 bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                      />
                      <select
                        value={wikiCat}
                        onChange={(e) => setWikiCat(e.target.value as WikiCategory)}
                        className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1.5 text-slate-100 outline-none"
                      >
                        {(Object.keys(WIKI_CATEGORY_META) as WikiCategory[]).map((cat) => (
                          <option key={cat} value={cat}>
                            {WIKI_CATEGORY_META[cat].icon} {WIKI_CATEGORY_META[cat].labelTh}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      value={wikiSummary}
                      onChange={(e) => setWikiSummary(e.target.value)}
                      placeholder="คำโปรยสั้น ๆ..."
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-slate-400">
                          เนื้อหา (พิมพ์ <code className="text-amber-300">@ชื่อเมือง/อาณาจักร</code> เพื่อเชื่อมลิงก์ไปยังแผนที่)
                        </span>
                        {(map.cultureList ?? []).length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const cult = (map.cultureList ?? [])[0] ?? null;
                              const nm = generateCultureName(cult, 'person');
                              setWikiContent((c) => `${c}${c && !c.endsWith(' ') ? ' ' : ''}${nm}`);
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#182332] hover:bg-[#223044] border border-slate-700 text-[10px] text-amber-300 cursor-pointer"
                            title="แทรกชื่อสุ่มตามวัฒนธรรมหลัก"
                          >
                            <Dices className="w-3 h-3" /> สุ่มชื่อตัวละคร
                          </button>
                        )}
                      </div>
                      {mentionTargets.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          <span className="text-[10px] text-slate-500">แทรก @mention ด่วน:</span>
                          {mentionTargets.slice(0, 8).map((mt) => (
                            <button
                              key={`${mt.kind}_${mt.id}`}
                              type="button"
                              onClick={() =>
                                setWikiContent((c) => `${c}${c && !c.endsWith(' ') ? ' ' : ''}@${mt.name} `)
                              }
                              className="px-1.5 py-0.5 rounded bg-[#182332] hover:bg-[#223044] border border-slate-700 text-[10px] text-amber-200 cursor-pointer"
                            >
                              @{mt.name}
                            </button>
                          ))}
                        </div>
                      )}
                      <textarea
                        rows={7}
                        value={wikiContent}
                        onChange={(e) => setWikiContent(e.target.value)}
                        placeholder="เขียนตำนาน ประวัติศาสตร์ หรือบันทึกความลับ..."
                        className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-2 text-slate-100 outline-none leading-relaxed"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={wikiTagsStr}
                        onChange={(e) => setWikiTagsStr(e.target.value)}
                        placeholder="แท็ก คั่นด้วย , (เช่น มังกร, ประวัติศาสตร์)"
                        className="col-span-2 bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
                      />
                      <div className="flex gap-1">
                        <input
                          value={wikiCoordQ}
                          onChange={(e) => setWikiCoordQ(e.target.value)}
                          placeholder="q"
                          className="w-1/2 bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                        />
                        <input
                          value={wikiCoordR}
                          onChange={(e) => setWikiCoordR(e.target.value)}
                          placeholder="r"
                          className="w-1/2 bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveWiki}
                        className="px-4 py-1.5 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                      >
                        บันทึกบทความ
                      </button>
                      <button
                        onClick={() => setSelectedWikiId(wikiList[0]?.id ?? null)}
                        className="px-3 py-1.5 rounded bg-[#182230] text-slate-300 cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : selectedWiki ? (
                  <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="text-[11px] text-amber-400">
                          {WIKI_CATEGORY_META[selectedWiki.category].icon}{' '}
                          {WIKI_CATEGORY_META[selectedWiki.category].labelTh}
                        </div>
                        <h3 className="text-base font-bold text-slate-100">{selectedWiki.title}</h3>
                        {selectedWiki.summary && (
                          <p className="text-[11px] text-slate-400 italic mt-0.5">
                            {selectedWiki.summary}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {selectedWiki.linkedCoord && (
                          <button
                            onClick={() => {
                              onJumpToCoord(
                                selectedWiki.linkedCoord!.q,
                                selectedWiki.linkedCoord!.r,
                                1.1
                              );
                              onClose();
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-sky-500/20 border border-sky-400/50 text-sky-200 text-[11px] cursor-pointer"
                          >
                            <MapPin className="w-3 h-3" />
                            ไปยังพิกัด ({selectedWiki.linkedCoord.q},{selectedWiki.linkedCoord.r})
                          </button>
                        )}
                        <button
                          onClick={() => startEditWiki(selectedWiki)}
                          className="px-2.5 py-1 rounded bg-[#1c2635] text-amber-200 text-[11px] cursor-pointer"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => {
                            onDeleteWikiEntry(selectedWiki.id);
                            setSelectedWikiId(null);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-slate-200 leading-relaxed whitespace-pre-wrap text-xs">
                      {parseWikiMentions(selectedWiki.content, map).map((tok, i) =>
                        tok.mention ? (
                          <button
                            key={i}
                            onClick={() => {
                              if (tok.mention?.coord) {
                                onJumpToCoord(tok.mention.coord.q, tok.mention.coord.r, 1.1);
                                onClose();
                              } else if (tok.mention?.kind === 'wiki') {
                                setSelectedWikiId(tok.mention.id);
                              }
                            }}
                            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/35 cursor-pointer"
                            title={
                              tok.mention.coord
                                ? `คลิกเพื่อซูมไปยัง (${tok.mention.coord.q}, ${tok.mention.coord.r})`
                                : 'เปิดบทความ'
                            }
                          >
                            {tok.text}
                          </button>
                        ) : (
                          <span key={i}>{tok.text}</span>
                        )
                      )}
                    </div>

                    {selectedWiki.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-800">
                        {selectedWiki.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    เลือกบทความทางซ้ายหรือคลิก "เขียนบทความใหม่" เพื่อเริ่มต้นสารานุกรมโลก
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. REALM ECONOMICS, MILITARY & STRATEGIC CHOKEPOINTS */}
          {tab === 'strategy' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-400" /> รายได้ภาษีรวมทุกอาณาจักร
                  </div>
                  <div className="text-lg font-bold text-amber-300 mt-1">
                    {realmEconomics
                      .reduce((s, r) => s + r.totalTreasuryIncome, 0)
                      .toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">Gold / ฤดู</span>
                  </div>
                </div>
                <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-rose-400" /> กำลังพลประจำการรวม
                  </div>
                  <div className="text-lg font-bold text-rose-300 mt-1">
                    {realmEconomics
                      .reduce((s, r) => s + r.standingArmy, 0)
                      .toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">นาย</span>
                  </div>
                </div>
                <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" /> จุดคอขวดทางยุทธศาสตร์ที่พบ
                  </div>
                  <div className="text-lg font-bold text-cyan-300 mt-1">
                    {chokepoints.length} <span className="text-xs font-normal text-slate-400">ตำแหน่ง</span>
                  </div>
                </div>
              </div>

              {/* Realm Economics & Military Table */}
              <div className="bg-[#0f1620] border border-slate-800 rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-800 font-semibold text-amber-300 flex items-center gap-1.5">
                  <Wheat className="w-3.5 h-3.5" /> เศรษฐกิจ กำลังทหาร และความมั่นคงทางอาหารรายอาณาจักร
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#131d2a] text-slate-400 border-b border-slate-800">
                        <th className="py-2 px-3">อาณาจักร</th>
                        <th className="py-2 px-2 text-right">พื้นที่ (ช่อง)</th>
                        <th className="py-2 px-2 text-right">ประชากรรวม</th>
                        <th className="py-2 px-2 text-right">ภาษี/ฤดู</th>
                        <th className="py-2 px-2 text-right">กำลังพล (สำรอง)</th>
                        <th className="py-2 px-2 text-right">อาหาร (ผลิต/ใช้)</th>
                        <th className="py-2 px-3 text-center">ความมั่นคงอาหาร</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realmEconomics.map((stat) => {
                        const secLabel =
                          stat.foodBalancePct >= 115
                            ? 'มั่นคง'
                            : stat.foodBalancePct >= 90
                            ? 'สมดุล'
                            : 'ขาดแคลน';
                        return (
                          <tr key={stat.kingdomId} className="border-b border-slate-800/70 hover:bg-[#16202e]">
                            <td className="py-2 px-3 font-semibold text-slate-100 flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: stat.color }}
                              />
                              <span>{stat.kingdomName}</span>
                              <span className="text-[10px] text-slate-500">({stat.cityCount} เมือง)</span>
                            </td>
                            <td className="py-2 px-2 text-right text-slate-300">{stat.hexCount}</td>
                            <td className="py-2 px-2 text-right text-slate-200">
                              {stat.population.toLocaleString()}
                            </td>
                            <td className="py-2 px-2 text-right text-amber-300 font-semibold">
                              +{stat.totalTreasuryIncome.toLocaleString()}g
                            </td>
                            <td className="py-2 px-2 text-right text-rose-300">
                              {stat.standingArmy.toLocaleString()}{' '}
                              <span className="text-slate-500">({stat.maxLevy.toLocaleString()})</span>
                            </td>
                            <td className="py-2 px-2 text-right text-slate-300">
                              {stat.foodSupply.toLocaleString()} / {stat.foodDemand.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded border text-[10px] ${
                                  stat.foodBalancePct >= 115
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                    : stat.foodBalancePct >= 90
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                                    : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                }`}
                              >
                                {secLabel} ({stat.foodBalancePct}%)
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Strategic Chokepoints List */}
              <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    จุดคอขวดและช่องเขาสำคัญทางยุทธศาสตร์ (คลิกเพื่อซูมไปยังพิกัด)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    เปิด/ปิดหมุดบนแผนที่ได้จากเมนู "ชั้นข้อมูล → จุดยุทธศาสตร์"
                  </span>
                </div>
                {chokepoints.length === 0 ? (
                  <div className="text-slate-500 py-4 text-center">
                    ยังไม่มีช่องเขา คอคอด หรือช่องแคบที่โดดเด่นบนแผนที่นี้
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {chokepoints.map((cp, idx) => {
                      const ownerId = map.territories?.[cp.r * map.width + cp.q];
                      const owner = ownerId ? map.kingdoms.find((k) => k.id === ownerId) : undefined;
                      const kindLabel =
                        cp.kind === 'mountain_pass'
                          ? '⛰️ ช่องเขา (Mountain Pass)'
                          : cp.kind === 'isthmus'
                          ? '🌉 คอคอดแผ่นดิน (Isthmus)'
                          : '⚓ ช่องแคบทางน้ำ (Strait)';
                      return (
                        <div
                          key={`${cp.q}_${cp.r}_${idx}`}
                          className="flex items-center justify-between gap-2 p-2 rounded bg-[#151e2b] border border-slate-800"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-100 truncate">{kindLabel}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>
                                พิกัด ({cp.q}, {cp.r})
                              </span>
                              <span>· ความสำคัญ {cp.score}</span>
                              {owner && (
                                <span className="inline-flex items-center gap-1 text-amber-200">
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: owner.color }}
                                  />
                                  {owner.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              onJumpToCoord(cp.q, cp.r, 1.35);
                              onClose();
                            }}
                            className="shrink-0 px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 text-[11px] cursor-pointer"
                          >
                            ไปยังจุดนี้
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
