import React, { useState } from 'react';
import { BookOpen, Crown, Dices, Flame, Landmark, Plus, Trash2, X } from 'lucide-react';
import {
  generateCultureNameBatch,
  getEffectiveLanguageProfile,
  getPresetLanguageProfile,
  LANGUAGE_PRESETS,
  NameCategory,
} from '../engine/nameGenerator';
import {
  ARCHITECTURE_STYLES,
  CLERGY_STRUCTURES,
  getAllCultureTypes,
  getAllGovernmentTypes,
  getAllReligionTypes,
  SUCCESSION_PRESETS,
} from '../data/goods';
import {
  Culture,
  CultureDetails,
  CultureLanguageProfile,
  CustomCategoryType,
  GovernmentDetails,
  HexMapData,
  Kingdom,
  Religion,
  ReligionDeity,
  ReligionDetails,
} from '../types/map';

interface EntityLoreModalProps {
  kind: 'kingdom' | 'religion' | 'culture';
  entityId: string;
  map: HexMapData;
  onUpdateKingdoms: (kingdoms: Kingdom[]) => void;
  onUpdateReligions: (religions: Religion[]) => void;
  onUpdateCultures: (cultures: Culture[]) => void;
  onAddCustomGovernmentType: (label: string) => CustomCategoryType;
  onAddCustomReligionType: (label: string) => CustomCategoryType;
  onAddCustomCultureType: (label: string) => CustomCategoryType;
  onClose: () => void;
}

const DEFAULT_GOV_DETAILS: GovernmentDetails = {
  rulerTitle: 'กษัตริย์ / ผู้นำ',
  rulerName: '',
  succession: SUCCESSION_PRESETS[0],
  powerStructure: 'สภาขุนนางและข้าหลวงมณฑล',
  laws: [],
  motto: '',
  capitalCityId: '',
};

const DEFAULT_REL_DETAILS: ReligionDetails = {
  deities: [],
  tenets: [],
  taboos: [],
  clergyStructure: CLERGY_STRUCTURES[0],
  rituals: [],
  holyCityIds: [],
  sacredText: '',
  headTitle: '',
};

const DEFAULT_CULT_DETAILS: CultureDetails = {
  architectureStyle: 'medieval',
  languageFamily: '',
  namingStyle: '',
  traditions: [],
  values: [],
  clothingStyle: '',
};

export const EntityLoreModal: React.FC<EntityLoreModalProps> = ({
  kind,
  entityId,
  map,
  onUpdateKingdoms,
  onUpdateReligions,
  onUpdateCultures,
  onAddCustomGovernmentType,
  onAddCustomReligionType,
  onAddCustomCultureType,
  onClose,
}) => {
  const [newTypeName, setNewTypeName] = useState('');
  const [showNewTypeBox, setShowNewTypeBox] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [newItemText2, setNewItemText2] = useState('');
  const [newDeityName, setNewDeityName] = useState('');
  const [newDeityDomain, setNewDeityDomain] = useState('');
  const [newDeitySymbol, setNewDeitySymbol] = useState('✨');

  const [generatedNames, setGeneratedNames] = useState<string[]>([]);
  const [nameGenCat, setNameGenCat] = useState<NameCategory>('city');

  const kingdom = kind === 'kingdom' ? map.kingdoms.find((k) => k.id === entityId) : null;
  const religion = kind === 'religion' ? map.religionList.find((r) => r.id === entityId) : null;
  const culture = kind === 'culture' ? (map.cultureList ?? []).find((c) => c.id === entityId) : null;

  if (!kingdom && !religion && !culture) return null;

  const govTypes = getAllGovernmentTypes(map.customGovernmentTypes);
  const relTypes = getAllReligionTypes(map.customReligionTypes);
  const cultTypes = getAllCultureTypes(map.customCultureTypes);

  const renderTagList = (
    label: string,
    items: string[],
    placeholder: string,
    onChange: (next: string[]) => void,
    inputVal: string,
    setInputVal: (v: string) => void
  ) => (
    <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2">
      <div className="font-semibold text-slate-200">{label}</div>
      <div className="flex gap-1.5">
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && inputVal.trim()) {
              onChange([...items, inputVal.trim()]);
              setInputVal('');
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
        />
        <button
          onClick={() => {
            if (!inputVal.trim()) return;
            onChange([...items, inputVal.trim()]);
            setInputVal('');
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> เพิ่ม
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-slate-500 italic">ยังไม่มีรายการ</span>
        ) : (
          items.map((item, idx) => (
            <span
              key={`${item}_${idx}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#182230] border border-slate-700 text-slate-200"
            >
              <span>{item}</span>
              <button
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-rose-400 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141c27] border border-amber-500/40 rounded-xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-[#111720]">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            {kind === 'kingdom' ? (
              <Crown className="w-4 h-4 text-amber-400" />
            ) : kind === 'religion' ? (
              <Flame className="w-4 h-4 text-purple-400" />
            ) : (
              <Landmark className="w-4 h-4 text-teal-400" />
            )}
            <span>
              ปรับแต่งเชิงลึก:{' '}
              {kingdom ? kingdom.name : religion ? `${religion.symbol} ${religion.name}` : `${culture?.symbol} ${culture?.name}`}
            </span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-xs space-y-3">
          {/* KINGDOM LORE */}
          {kingdom && (() => {
            const det: GovernmentDetails = { ...DEFAULT_GOV_DETAILS, ...(kingdom.details ?? {}) };
            const patchKingdom = (patch: Partial<Kingdom>) =>
              onUpdateKingdoms(map.kingdoms.map((k) => (k.id === kingdom.id ? { ...k, ...patch } : k)));
            const patchDetails = (dp: Partial<GovernmentDetails>) =>
              patchKingdom({ details: { ...det, ...dp } });

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-[#0f1620] border border-slate-800 rounded-lg p-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">ชื่ออาณาจักร / ดินแดน</label>
                    <input
                      value={kingdom.name}
                      onChange={(e) => patchKingdom({ name: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">สีประจำดินแดน</label>
                    <input
                      type="color"
                      value={kingdom.color}
                      onChange={(e) => patchKingdom({ color: e.target.value })}
                      className="w-full h-8 bg-transparent border border-slate-700 rounded cursor-pointer"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-400">ระบอบการปกครอง</label>
                      <button
                        onClick={() => setShowNewTypeBox((v) => !v)}
                        className="text-[11px] text-amber-300 hover:underline cursor-pointer"
                      >
                        + เพิ่มระบอบการปกครองเอง
                      </button>
                    </div>
                    <select
                      value={kingdom.government}
                      onChange={(e) => patchKingdom({ government: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    >
                      {govTypes.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label} {g.isCustom ? '[กำหนดเอง]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">เมืองหลวงทางการ</label>
                    <select
                      value={det.capitalCityId ?? ''}
                      onChange={(e) => patchDetails({ capitalCityId: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2 py-1.5 text-slate-100 outline-none"
                    >
                      <option value="">-- ไม่ระบุ --</option>
                      {map.cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {showNewTypeBox && (
                    <div className="sm:col-span-3 flex gap-2 pt-1">
                      <input
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="ชื่อระบอบการปกครองใหม่ เช่น สภานักเวท, ระบบไพร่เสรี..."
                        className="flex-1 bg-[#161f2c] border border-amber-500/50 rounded px-2.5 py-1 text-slate-100 outline-none"
                      />
                      <button
                        onClick={() => {
                          if (!newTypeName.trim()) return;
                          const created = onAddCustomGovernmentType(newTypeName);
                          patchKingdom({ government: created.id });
                          setNewTypeName('');
                          setShowNewTypeBox(false);
                        }}
                        className="px-3 py-1 rounded bg-[#d99b38] text-[#0e141c] font-semibold cursor-pointer"
                      >
                        เพิ่มและเลือกใช้
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[#0f1620] border border-slate-800 rounded-lg p-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ตำแหน่งผู้นำ</label>
                    <input
                      value={det.rulerTitle}
                      onChange={(e) => patchDetails({ rulerTitle: e.target.value })}
                      placeholder="เช่น จักรพรรดิ, กงสุล, อัครเสนาบดี..."
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">พระนาม / ชื่อผู้นำปัจจุบัน</label>
                    <input
                      value={det.rulerName ?? ''}
                      onChange={(e) => patchDetails({ rulerName: e.target.value })}
                      placeholder="เช่น จักรพรรดิอัลเดอริกที่ 3"
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">การสืบทอดอำนาจ</label>
                    <input
                      list="succession_presets"
                      value={det.succession}
                      onChange={(e) => patchDetails({ succession: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                    <datalist id="succession_presets">
                      {SUCCESSION_PRESETS.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">โครงสร้างอำนาจ</label>
                    <input
                      value={det.powerStructure}
                      onChange={(e) => patchDetails({ powerStructure: e.target.value })}
                      placeholder="เช่น สภาขุนนาง, รัฐสภากิลด์, ราชสำนักรวมศูนย์"
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">คำขวัญอาณาจักร (Motto)</label>
                    <input
                      value={det.motto ?? ''}
                      onChange={(e) => patchDetails({ motto: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                </div>

                {renderTagList(
                  'กฎหมายและนโยบายสำคัญ (Laws & Policies)',
                  det.laws,
                  'เพิ่มกฎหมาย เช่น ห้ามค้าอาวุธเถื่อน, ยกเว้นภาษีท่าเรือ...',
                  (laws) => patchDetails({ laws }),
                  newItemText,
                  setNewItemText
                )}

                <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3">
                  <label className="block text-[11px] text-slate-400 mb-1">ประวัติ / บันทึกอาณาจักร</label>
                  <textarea
                    rows={3}
                    value={kingdom.description ?? ''}
                    onChange={(e) => patchKingdom({ description: e.target.value })}
                    className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none resize-none"
                  />
                </div>
              </>
            );
          })()}

          {/* RELIGION LORE */}
          {religion && (() => {
            const det: ReligionDetails = { ...DEFAULT_REL_DETAILS, ...(religion.details ?? {}) };
            const patchReligion = (patch: Partial<Religion>) =>
              onUpdateReligions(map.religionList.map((r) => (r.id === religion.id ? { ...r, ...patch } : r)));
            const patchDetails = (dp: Partial<ReligionDetails>) =>
              patchReligion({ details: { ...det, ...dp } });

            const addDeity = () => {
              if (!newDeityName.trim()) return;
              const nextDeity: ReligionDeity = {
                id: `deity_${Date.now().toString(36)}`,
                name: newDeityName.trim(),
                domain: newDeityDomain.trim() || 'สัจธรรม',
                symbol: newDeitySymbol.trim() || religion.symbol,
              };
              patchDetails({ deities: [...det.deities, nextDeity] });
              setNewDeityName('');
              setNewDeityDomain('');
            };

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-[#0f1620] border border-slate-800 rounded-lg p-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">สัญลักษณ์</label>
                    <input
                      value={religion.symbol}
                      onChange={(e) => patchReligion({ symbol: e.target.value })}
                      className="w-full text-center bg-[#161f2c] border border-slate-700 rounded px-2 py-1.5 text-base outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">ชื่อศาสนา / ลัทธิ</label>
                    <input
                      value={religion.name}
                      onChange={(e) => patchReligion({ name: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">สีประจำศาสนา</label>
                    <input
                      type="color"
                      value={religion.color}
                      onChange={(e) => patchReligion({ color: e.target.value })}
                      className="w-full h-8 bg-transparent border border-slate-700 rounded cursor-pointer"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-400">ประเภทศาสนา</label>
                      <button
                        onClick={() => setShowNewTypeBox((v) => !v)}
                        className="text-[11px] text-purple-300 hover:underline cursor-pointer"
                      >
                        + เพิ่มประเภทศาสนาเอง
                      </button>
                    </div>
                    <select
                      value={religion.type}
                      onChange={(e) => patchReligion({ type: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    >
                      {relTypes.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.label} {rt.isCustom ? '[กำหนดเอง]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">โครงสร้างนักบวช</label>
                    <input
                      list="clergy_presets"
                      value={det.clergyStructure}
                      onChange={(e) => patchDetails({ clergyStructure: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                    <datalist id="clergy_presets">
                      {CLERGY_STRUCTURES.map((cs) => (
                        <option key={cs} value={cs} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ตำแหน่งประมุขศาสนา</label>
                    <input
                      value={det.headTitle ?? ''}
                      onChange={(e) => patchDetails({ headTitle: e.target.value })}
                      placeholder="เช่น มหาสังฆราช"
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] text-slate-400 mb-1">คัมภีร์ / ตำราศักดิ์สิทธิ์</label>
                    <input
                      value={det.sacredText ?? ''}
                      onChange={(e) => patchDetails({ sacredText: e.target.value })}
                      placeholder="เช่น คัมภีร์สุริยวาท..."
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>

                  {showNewTypeBox && (
                    <div className="sm:col-span-4 flex gap-2 pt-1">
                      <input
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="ชื่อประเภทศาสนาใหม่ เช่น บูชาบรรพบุรุษ, ลัทธิจักรกล..."
                        className="flex-1 bg-[#161f2c] border border-purple-400/50 rounded px-2.5 py-1 text-slate-100 outline-none"
                      />
                      <button
                        onClick={() => {
                          if (!newTypeName.trim()) return;
                          const created = onAddCustomReligionType(newTypeName);
                          patchReligion({ type: created.id });
                          setNewTypeName('');
                          setShowNewTypeBox(false);
                        }}
                        className="px-3 py-1 rounded bg-purple-500 text-white font-semibold cursor-pointer"
                      >
                        เพิ่มและเลือกใช้
                      </button>
                    </div>
                  )}
                </div>

                {/* Deities */}
                <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="font-semibold text-purple-300">
                    ทวยเทพ / สิ่งศักดิ์สิทธิ์ที่บูชา ({det.deities.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <input
                      value={newDeitySymbol}
                      onChange={(e) => setNewDeitySymbol(e.target.value)}
                      className="w-11 text-center bg-[#161f2c] border border-slate-700 rounded px-1 py-1"
                    />
                    <input
                      value={newDeityName}
                      onChange={(e) => setNewDeityName(e.target.value)}
                      placeholder="นามเทพเจ้า / สิ่งศักดิ์สิทธิ์..."
                      className="flex-1 min-w-[140px] bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
                    />
                    <input
                      value={newDeityDomain}
                      onChange={(e) => setNewDeityDomain(e.target.value)}
                      placeholder="อำนาจ / โดเมน เช่น แสงสว่าง, พายุ..."
                      className="flex-1 min-w-[140px] bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
                    />
                    <button
                      onClick={addDeity}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-500/25 hover:bg-purple-500/35 border border-purple-400/50 text-purple-200 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> เพิ่มเทพ
                    </button>
                  </div>
                  <div className="space-y-1">
                    {det.deities.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between bg-[#151d28] border border-slate-800 rounded px-2.5 py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span>{d.symbol || '✨'}</span>
                          <span className="font-medium text-slate-100">{d.name}</span>
                          <span className="text-[11px] text-slate-400">— {d.domain}</span>
                        </div>
                        <button
                          onClick={() =>
                            patchDetails({ deities: det.deities.filter((x) => x.id !== d.id) })
                          }
                          className="text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {renderTagList(
                  'หลักคำสอนสำคัญ (Tenets)',
                  det.tenets,
                  'เพิ่มหลักคำสอน...',
                  (tenets) => patchDetails({ tenets }),
                  newItemText,
                  setNewItemText
                )}

                {renderTagList(
                  'ข้อห้ามทางศาสนา (Taboos)',
                  det.taboos,
                  'เพิ่มข้อห้าม...',
                  (taboos) => patchDetails({ taboos }),
                  newItemText2,
                  setNewItemText2
                )}

                <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="font-semibold text-slate-200">
                    พิธีกรรมสำคัญ (คั่นด้วยลูกน้ำ ,) และเมืองศักดิ์สิทธิ์
                  </div>
                  <input
                    value={det.rituals.join(', ')}
                    onChange={(e) =>
                      patchDetails({
                        rituals: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="เช่น พิธีจุดคบเพลิงรุ่งอรุณ, เทศกาลกลางฤดูร้อน"
                    className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                  />
                  {map.cities.length > 0 && (
                    <div className="pt-1">
                      <div className="text-[11px] text-slate-400 mb-1">เมืองศักดิ์สิทธิ์ของศาสนานี้:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {map.cities.map((c) => {
                          const active = det.holyCityIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              onClick={() =>
                                patchDetails({
                                  holyCityIds: active
                                    ? det.holyCityIds.filter((id) => id !== c.id)
                                    : [...det.holyCityIds, c.id],
                                })
                              }
                              className={`px-2 py-0.5 rounded border text-[11px] cursor-pointer ${
                                active
                                  ? 'bg-purple-500/25 border-purple-400 text-purple-100'
                                  : 'bg-[#161f2c] border-slate-700 text-slate-400'
                              }`}
                            >
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3">
                  <label className="block text-[11px] text-slate-400 mb-1">คำอธิบายศาสนา</label>
                  <textarea
                    rows={2}
                    value={religion.description ?? ''}
                    onChange={(e) => patchReligion({ description: e.target.value })}
                    className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none resize-none"
                  />
                </div>
              </>
            );
          })()}

          {/* CULTURE LORE */}
          {culture && (() => {
            const det: CultureDetails = { ...DEFAULT_CULT_DETAILS, ...(culture.details ?? {}) };
            const patchCulture = (patch: Partial<Culture>) =>
              onUpdateCultures((map.cultureList ?? []).map((c) => (c.id === culture.id ? { ...c, ...patch } : c)));
            const patchDetails = (dp: Partial<CultureDetails>) =>
              patchCulture({ details: { ...det, ...dp } });

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-[#0f1620] border border-slate-800 rounded-lg p-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">สัญลักษณ์</label>
                    <input
                      value={culture.symbol}
                      onChange={(e) => patchCulture({ symbol: e.target.value })}
                      className="w-full text-center bg-[#161f2c] border border-slate-700 rounded px-2 py-1.5 text-base outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">ชื่อวัฒนธรรม</label>
                    <input
                      value={culture.name}
                      onChange={(e) => patchCulture({ name: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">สีประจำวัฒนธรรม</label>
                    <input
                      type="color"
                      value={culture.color}
                      onChange={(e) => patchCulture({ color: e.target.value })}
                      className="w-full h-8 bg-transparent border border-slate-700 rounded cursor-pointer"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-400">ประเภทวัฒนธรรม</label>
                      <button
                        onClick={() => setShowNewTypeBox((v) => !v)}
                        className="text-[11px] text-teal-300 hover:underline cursor-pointer"
                      >
                        + เพิ่มประเภทวัฒนธรรมเอง
                      </button>
                    </div>
                    <select
                      value={culture.type}
                      onChange={(e) => patchCulture({ type: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    >
                      {cultTypes.map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.label} {ct.isCustom ? '[กำหนดเอง]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      สไตล์สถาปัตยกรรม (ใช้ในผังเมือง)
                    </label>
                    <select
                      value={det.architectureStyle}
                      onChange={(e) => patchDetails({ architectureStyle: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    >
                      {ARCHITECTURE_STYLES.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ตระกูลภาษา</label>
                    <input
                      value={det.languageFamily}
                      onChange={(e) => patchDetails({ languageFamily: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] text-slate-400 mb-1">รูปแบบการตั้งชื่อเมือง/บุคคล</label>
                    <input
                      value={det.namingStyle}
                      onChange={(e) => patchDetails({ namingStyle: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] text-slate-400 mb-1">การแต่งกายและเอกลักษณ์</label>
                    <input
                      value={det.clothingStyle ?? ''}
                      onChange={(e) => patchDetails({ clothingStyle: e.target.value })}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>

                  {/* Culture Language & Name Generator */}
                  {(() => {
                    const langProfile = getEffectiveLanguageProfile(culture);
                    const patchLang = (lp: Partial<CultureLanguageProfile>) =>
                      patchDetails({ languageProfile: { ...langProfile, ...lp } });
                    return (
                      <div className="sm:col-span-4 bg-[#111926] border border-slate-800 rounded-lg p-3 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                            <Dices className="w-3.5 h-3.5" />
                            ระบบภาษาและเครื่องสุ่มชื่อตามวัฒนธรรม
                          </span>
                          <select
                            value={langProfile.presetId ?? 'imperial'}
                            onChange={(e) => {
                              const nextPreset = getPresetLanguageProfile(e.target.value);
                              patchDetails({ languageProfile: nextPreset });
                              setGeneratedNames(
                                generateCultureNameBatch(
                                  { ...culture, details: { ...det, languageProfile: nextPreset } },
                                  nameGenCat,
                                  8,
                                  Math.floor(Math.random() * 99999)
                                )
                              );
                            }}
                            className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100 outline-none"
                          >
                            {LANGUAGE_PRESETS.map((p) => (
                              <option key={p.id} value={p.id}>
                                สไตล์ภาษา: {p.labelTh}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <label className="block text-slate-400 mb-0.5">พยางค์เริ่มต้น (คั่นด้วย ,)</label>
                            <input
                              value={langProfile.onsets.join(', ')}
                              onChange={(e) =>
                                patchLang({
                                  onsets: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="w-full bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-0.5">พยางค์กลาง (คั่นด้วย ,)</label>
                            <input
                              value={langProfile.nuclei.join(', ')}
                              onChange={(e) =>
                                patchLang({
                                  nuclei: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="w-full bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-0.5">คำลงท้ายชื่อเมือง (คั่นด้วย ,)</label>
                            <input
                              value={langProfile.citySuffixes.join(', ')}
                              onChange={(e) =>
                                patchLang({
                                  citySuffixes: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="w-full bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-0.5">คำลงท้ายชื่อบุคคล (คั่นด้วย ,)</label>
                            <input
                              value={langProfile.personSuffixes.join(', ')}
                              onChange={(e) =>
                                patchLang({
                                  personSuffixes: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="w-full bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {([
                            ['city', 'เมือง'],
                            ['river', 'แม่น้ำ'],
                            ['sea', 'ทะเล/อ่าว'],
                            ['person', 'บุคคล'],
                          ] as [NameCategory, string][]).map(([cat, lbl]) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                setNameGenCat(cat);
                                setGeneratedNames(
                                  generateCultureNameBatch(
                                    culture,
                                    cat,
                                    8,
                                    Math.floor(Math.random() * 99999)
                                  )
                                );
                              }}
                              className={`px-2 py-1 rounded border text-[11px] cursor-pointer ${
                                nameGenCat === cat
                                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                                  : 'bg-[#161f2c] border-slate-700 text-slate-300'
                              }`}
                            >
                              สุ่มชื่อ{lbl}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setGeneratedNames(
                                generateCultureNameBatch(
                                  culture,
                                  nameGenCat,
                                  8,
                                  Math.floor(Math.random() * 99999)
                                )
                              )
                            }
                            className="ml-auto px-2.5 py-1 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold text-[11px] cursor-pointer flex items-center gap-1"
                          >
                            <Dices className="w-3.5 h-3.5" /> สุ่มชุดใหม่
                          </button>
                        </div>

                        {generatedNames.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {generatedNames.map((nm, i) => (
                              <span
                                key={`${nm}_${i}`}
                                className="px-2 py-0.5 rounded bg-[#161f2c] border border-slate-700 text-[11px] text-amber-200 select-all"
                              >
                                {nm}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {showNewTypeBox && (
                    <div className="sm:col-span-4 flex gap-2 pt-1">
                      <input
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="ชื่อประเภทวัฒนธรรมใหม่ เช่น ชนเผ่าใต้ดิน, อารยธรรมลอยฟ้า..."
                        className="flex-1 bg-[#161f2c] border border-teal-400/50 rounded px-2.5 py-1 text-slate-100 outline-none"
                      />
                      <button
                        onClick={() => {
                          if (!newTypeName.trim()) return;
                          const created = onAddCustomCultureType(newTypeName);
                          patchCulture({ type: created.id });
                          setNewTypeName('');
                          setShowNewTypeBox(false);
                        }}
                        className="px-3 py-1 rounded bg-teal-500 text-slate-950 font-semibold cursor-pointer"
                      >
                        เพิ่มและเลือกใช้
                      </button>
                    </div>
                  )}
                </div>

                {renderTagList(
                  'ประเพณีและเทศกาลสำคัญ (Traditions)',
                  det.traditions,
                  'เพิ่มประเพณี...',
                  (traditions) => patchDetails({ traditions }),
                  newItemText,
                  setNewItemText
                )}

                {renderTagList(
                  'ค่านิยมหลัก (Values)',
                  det.values,
                  'เพิ่มค่านิยม...',
                  (values) => patchDetails({ values }),
                  newItemText2,
                  setNewItemText2
                )}

                <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3">
                  <label className="block text-[11px] text-slate-400 mb-1">คำอธิบายวัฒนธรรม</label>
                  <textarea
                    rows={2}
                    value={culture.description ?? ''}
                    onChange={(e) => patchCulture({ description: e.target.value })}
                    className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none resize-none"
                  />
                </div>
              </>
            );
          })()}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-800 bg-[#111720] flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-400">
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            การแก้ไขถูกบันทึกเข้าแผนที่อัตโนมัติ
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
};
