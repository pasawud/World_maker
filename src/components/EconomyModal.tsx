import React, { useState } from 'react';
import { Building2, Crown, Flame, Landmark, Package, Plus, Store, Trash2, X } from 'lucide-react';
import { CULTURE_TYPES, GOVERNMENT_TYPES, RELIGION_TYPES } from '../data/goods';
import {
  Culture,
  CultureType,
  GovernmentType,
  HexMapData,
  Kingdom,
  Religion,
  ReligionType,
  TradeGood,
} from '../types/map';

interface EconomyModalProps {
  map: HexMapData;
  onUpdateGoods: (goods: TradeGood[]) => void;
  onUpdateKingdoms: (kingdoms: Kingdom[]) => void;
  onUpdateReligions: (religions: Religion[]) => void;
  onUpdateCultures: (cultures: Culture[]) => void;
  onDeleteTradeRoute: (id: string) => void;
  onSelectCity: (cityId: string) => void;
  onOpenCityTrade: (cityId: string) => void;
  onClose: () => void;
}

export const EconomyModal: React.FC<EconomyModalProps> = ({
  map,
  onUpdateGoods,
  onUpdateKingdoms,
  onUpdateReligions,
  onUpdateCultures,
  onDeleteTradeRoute,
  onSelectCity,
  onOpenCityTrade,
  onClose,
}) => {
  const [tab, setTab] = useState<'goods' | 'cities' | 'routes' | 'kingdoms' | 'religions' | 'cultures'>('goods');
  const [newGoodName, setNewGoodName] = useState('');
  const [newGoodIcon, setNewGoodIcon] = useState('📦');
  const [newGoodCategory, setNewGoodCategory] = useState('หัตถกรรม');
  const [newGoodPrice, setNewGoodPrice] = useState(50);

  const [newKingdomName, setNewKingdomName] = useState('');
  const [newKingdomColor, setNewKingdomColor] = useState('#38bdf8');
  const [newKingdomGov, setNewKingdomGov] = useState<GovernmentType>('monarchy');

  const [newRelName, setNewRelName] = useState('');
  const [newRelSymbol, setNewRelSymbol] = useState('🕊️');
  const [newRelColor, setNewRelColor] = useState('#f472b6');
  const [newRelType, setNewRelType] = useState<ReligionType>('monotheism');

  const [newCultName, setNewCultName] = useState('');
  const [newCultSymbol, setNewCultSymbol] = useState('🏺');
  const [newCultColor, setNewCultColor] = useState('#2dd4bf');
  const [newCultType, setNewCultType] = useState<CultureType>('agrarian');

  const addGood = () => {
    if (!newGoodName.trim()) return;
    const next: TradeGood = {
      id: `good_${Date.now().toString(36)}`,
      name: newGoodName.trim(),
      icon: newGoodIcon || '📦',
      category: newGoodCategory,
      basePrice: Math.max(1, newGoodPrice),
    };
    onUpdateGoods([...map.goods, next]);
    setNewGoodName('');
  };

  const addKingdom = () => {
    if (!newKingdomName.trim()) return;
    onUpdateKingdoms([
      ...map.kingdoms,
      {
        id: `kingdom_${Date.now().toString(36)}`,
        name: newKingdomName.trim(),
        color: newKingdomColor,
        government: newKingdomGov,
      },
    ]);
    setNewKingdomName('');
  };

  const addReligion = () => {
    if (!newRelName.trim()) return;
    onUpdateReligions([
      ...map.religionList,
      {
        id: `rel_${Date.now().toString(36)}`,
        name: newRelName.trim(),
        symbol: newRelSymbol || '✨',
        color: newRelColor,
        type: newRelType,
      },
    ]);
    setNewRelName('');
  };

  const addCulture = () => {
    if (!newCultName.trim()) return;
    onUpdateCultures([
      ...(map.cultureList ?? []),
      {
        id: `cult_${Date.now().toString(36)}`,
        name: newCultName.trim(),
        symbol: newCultSymbol || '🏺',
        color: newCultColor,
        type: newCultType,
      },
    ]);
    setNewCultName('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141c27] border border-slate-700 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <Store className="w-4 h-4" />
            จัดการสินค้า · เมือง · การปกครอง · ศาสนา · วัฒนธรรม · เส้นการค้า
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-2 border-b border-slate-800 flex gap-2 text-xs overflow-x-auto no-scrollbar">
          {[
            { id: 'goods', label: `สินค้า (${map.goods.length})`, icon: <Package className="w-3.5 h-3.5" /> },
            { id: 'cities', label: `เมือง (${map.cities.length})`, icon: <Building2 className="w-3.5 h-3.5" /> },
            { id: 'kingdoms', label: `การปกครอง (${map.kingdoms.length})`, icon: <Crown className="w-3.5 h-3.5" /> },
            { id: 'religions', label: `ศาสนา (${map.religionList.length})`, icon: <Flame className="w-3.5 h-3.5" /> },
            { id: 'cultures', label: `วัฒนธรรม (${(map.cultureList ?? []).length})`, icon: <Landmark className="w-3.5 h-3.5" /> },
            { id: 'routes', label: `เส้นการค้า (${map.tradeRoutes.length})`, icon: <Store className="w-3.5 h-3.5" /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 whitespace-nowrap transition cursor-pointer ${
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

        <div className="flex-1 overflow-y-auto p-4 text-xs space-y-3">
          {tab === 'goods' && (
            <>
              <div className="flex flex-wrap gap-2 bg-[#0f1620] p-2.5 rounded-lg border border-slate-800">
                <input
                  value={newGoodIcon}
                  onChange={(e) => setNewGoodIcon(e.target.value)}
                  className="w-12 text-center bg-[#161f2c] border border-slate-700 rounded px-1 py-1"
                />
                <input
                  value={newGoodName}
                  onChange={(e) => setNewGoodName(e.target.value)}
                  placeholder="ชื่อสินค้าใหม่ เช่น แร่มิธริล..."
                  className="flex-1 min-w-[160px] bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
                />
                <input
                  value={newGoodCategory}
                  onChange={(e) => setNewGoodCategory(e.target.value)}
                  placeholder="หมวดหมู่"
                  className="w-28 bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                />
                <input
                  type="number"
                  value={newGoodPrice}
                  onChange={(e) => setNewGoodPrice(Number(e.target.value) || 1)}
                  className="w-20 bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                />
                <button
                  onClick={addGood}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มสินค้า
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {map.goods.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between bg-[#0f1620] border border-slate-800 rounded px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{g.icon}</span>
                      <div>
                        <div className="font-medium text-slate-100">{g.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {g.category} · ราคากลาง {g.basePrice} เหรียญทอง
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onUpdateGoods(map.goods.filter((x) => x.id !== g.id))}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'cities' && (
            <div className="space-y-2">
              {map.cities.length === 0 ? (
                <div className="text-center py-8 text-slate-500">ยังไม่มีเมืองในแผนที่</div>
              ) : (
                map.cities.map((c) => {
                  const kingdom = map.kingdoms.find((k) => k.id === c.kingdomId);
                  const rel = map.religionList.find((r) => r.id === c.religionId);
                  const cult = (map.cultureList ?? []).find((cu) => cu.id === c.cultureId);
                  return (
                    <div
                      key={c.id}
                      className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: kingdom?.color ?? '#fbbf24' }}
                          />
                          <span className="font-semibold text-amber-200">{c.name}</span>
                          <span className="text-[11px] text-slate-400">
                            ({c.population.toLocaleString()} คน · {kingdom?.name ?? 'อิสระ'} ·{' '}
                            {rel?.symbol} {rel?.name ?? 'ไม่ระบุ'}
                            {cult ? ` · ${cult.symbol} ${cult.name}` : ''})
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="text-[11px] text-emerald-400">ผลิต:</span>
                          {c.producedGoods.map((gid) => {
                            const g = map.goods.find((x) => x.id === gid);
                            return g ? (
                              <span key={gid} className="text-[11px] text-slate-300">
                                {g.icon} {g.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            onOpenCityTrade(c.id);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/45 text-sky-200 cursor-pointer"
                        >
                          ดูการค้า
                        </button>
                        <button
                          onClick={() => {
                            onSelectCity(c.id);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded bg-[#1b2636] hover:bg-[#243247] border border-slate-700 text-slate-200 cursor-pointer"
                        >
                          แก้ไขเมือง
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'kingdoms' && (
            <>
              <div className="flex flex-wrap gap-2 bg-[#0f1620] p-2.5 rounded-lg border border-slate-800">
                <input
                  type="color"
                  value={newKingdomColor}
                  onChange={(e) => setNewKingdomColor(e.target.value)}
                  className="w-9 h-7 bg-transparent border-0 cursor-pointer"
                />
                <input
                  value={newKingdomName}
                  onChange={(e) => setNewKingdomName(e.target.value)}
                  placeholder="ชื่ออาณาจักร / รัฐใหม่..."
                  className="flex-1 min-w-[160px] bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
                />
                <select
                  value={newKingdomGov}
                  onChange={(e) => setNewKingdomGov(e.target.value as GovernmentType)}
                  className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                >
                  {GOVERNMENT_TYPES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addKingdom}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มรัฐ
                </button>
              </div>
              <div className="space-y-1.5">
                {map.kingdoms.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between gap-2 bg-[#0f1620] border border-slate-800 rounded px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5 flex-1">
                      <input
                        type="color"
                        value={k.color}
                        onChange={(e) =>
                          onUpdateKingdoms(
                            map.kingdoms.map((x) =>
                              x.id === k.id ? { ...x, color: e.target.value } : x
                            )
                          )
                        }
                        className="w-6 h-6 bg-transparent border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={k.name}
                        onChange={(e) =>
                          onUpdateKingdoms(
                            map.kingdoms.map((x) =>
                              x.id === k.id ? { ...x, name: e.target.value } : x
                            )
                          )
                        }
                        className="flex-1 min-w-[120px] bg-[#161f2c] border border-slate-700/80 focus:border-amber-500 rounded px-2 py-1 font-medium text-slate-100 outline-none"
                      />
                    </div>
                    <select
                      value={k.government}
                      onChange={(e) =>
                        onUpdateKingdoms(
                          map.kingdoms.map((x) =>
                            x.id === k.id
                              ? { ...x, government: e.target.value as GovernmentType }
                              : x
                          )
                        )
                      }
                      className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 outline-none"
                    >
                      {GOVERNMENT_TYPES.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        onUpdateKingdoms(map.kingdoms.filter((x) => x.id !== k.id))
                      }
                      disabled={map.kingdoms.length <= 1}
                      className="text-slate-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'religions' && (
            <>
              <div className="flex flex-wrap gap-2 bg-[#0f1620] p-2.5 rounded-lg border border-slate-800">
                <input
                  value={newRelSymbol}
                  onChange={(e) => setNewRelSymbol(e.target.value)}
                  className="w-11 text-center bg-[#161f2c] border border-slate-700 rounded px-1 py-1"
                />
                <input
                  type="color"
                  value={newRelColor}
                  onChange={(e) => setNewRelColor(e.target.value)}
                  className="w-9 h-7 bg-transparent border-0 cursor-pointer"
                />
                <input
                  value={newRelName}
                  onChange={(e) => setNewRelName(e.target.value)}
                  placeholder="ชื่อศาสนา / ความเชื่อใหม่..."
                  className="flex-1 min-w-[150px] bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
                />
                <select
                  value={newRelType}
                  onChange={(e) => setNewRelType(e.target.value as ReligionType)}
                  className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                >
                  {RELIGION_TYPES.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addReligion}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มศาสนา
                </button>
              </div>
              <div className="space-y-1.5">
                {map.religionList.map((rel) => (
                  <div
                    key={rel.id}
                    className="flex items-center justify-between gap-2 bg-[#0f1620] border border-slate-800 rounded px-3 py-2"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="color"
                        value={rel.color}
                        onChange={(e) =>
                          onUpdateReligions(
                            map.religionList.map((x) =>
                              x.id === rel.id ? { ...x, color: e.target.value } : x
                            )
                          )
                        }
                        className="w-6 h-6 bg-transparent border-0 cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={rel.symbol}
                        onChange={(e) =>
                          onUpdateReligions(
                            map.religionList.map((x) =>
                              x.id === rel.id ? { ...x, symbol: e.target.value } : x
                            )
                          )
                        }
                        className="w-10 text-center bg-[#161f2c] border border-slate-700/80 rounded px-1 py-1 text-sm outline-none"
                      />
                      <input
                        type="text"
                        value={rel.name}
                        onChange={(e) =>
                          onUpdateReligions(
                            map.religionList.map((x) =>
                              x.id === rel.id ? { ...x, name: e.target.value } : x
                            )
                          )
                        }
                        className="flex-1 min-w-[120px] bg-[#161f2c] border border-slate-700/80 focus:border-purple-400 rounded px-2 py-1 font-medium text-slate-100 outline-none"
                      />
                    </div>
                    <select
                      value={rel.type}
                      onChange={(e) =>
                        onUpdateReligions(
                          map.religionList.map((x) =>
                            x.id === rel.id
                              ? { ...x, type: e.target.value as ReligionType }
                              : x
                          )
                        )
                      }
                      className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 outline-none"
                    >
                      {RELIGION_TYPES.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        onUpdateReligions(map.religionList.filter((x) => x.id !== rel.id))
                      }
                      disabled={map.religionList.length <= 1}
                      className="text-slate-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'cultures' && (
            <>
              <div className="flex flex-wrap gap-2 bg-[#0f1620] p-2.5 rounded-lg border border-slate-800">
                <input
                  value={newCultSymbol}
                  onChange={(e) => setNewCultSymbol(e.target.value)}
                  className="w-11 text-center bg-[#161f2c] border border-slate-700 rounded px-1 py-1"
                />
                <input
                  type="color"
                  value={newCultColor}
                  onChange={(e) => setNewCultColor(e.target.value)}
                  className="w-9 h-7 bg-transparent border-0 cursor-pointer"
                />
                <input
                  value={newCultName}
                  onChange={(e) => setNewCultName(e.target.value)}
                  placeholder="ชื่อวัฒนธรรม / อารยธรรมใหม่..."
                  className="flex-1 min-w-[150px] bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1 text-slate-100 outline-none"
                />
                <select
                  value={newCultType}
                  onChange={(e) => setNewCultType(e.target.value as CultureType)}
                  className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                >
                  {CULTURE_TYPES.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addCulture}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มวัฒนธรรม
                </button>
              </div>
              <div className="space-y-1.5">
                {(map.cultureList ?? []).map((cult) => (
                  <div
                    key={cult.id}
                    className="flex items-center justify-between gap-2 bg-[#0f1620] border border-slate-800 rounded px-3 py-2"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="color"
                        value={cult.color}
                        onChange={(e) =>
                          onUpdateCultures(
                            (map.cultureList ?? []).map((x) =>
                              x.id === cult.id ? { ...x, color: e.target.value } : x
                            )
                          )
                        }
                        className="w-6 h-6 bg-transparent border-0 cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={cult.symbol}
                        onChange={(e) =>
                          onUpdateCultures(
                            (map.cultureList ?? []).map((x) =>
                              x.id === cult.id ? { ...x, symbol: e.target.value } : x
                            )
                          )
                        }
                        className="w-10 text-center bg-[#161f2c] border border-slate-700/80 rounded px-1 py-1 text-sm outline-none"
                      />
                      <input
                        type="text"
                        value={cult.name}
                        onChange={(e) =>
                          onUpdateCultures(
                            (map.cultureList ?? []).map((x) =>
                              x.id === cult.id ? { ...x, name: e.target.value } : x
                            )
                          )
                        }
                        className="flex-1 min-w-[120px] bg-[#161f2c] border border-slate-700/80 focus:border-teal-400 rounded px-2 py-1 font-medium text-slate-100 outline-none"
                      />
                    </div>
                    <select
                      value={cult.type}
                      onChange={(e) =>
                        onUpdateCultures(
                          (map.cultureList ?? []).map((x) =>
                            x.id === cult.id
                              ? { ...x, type: e.target.value as CultureType }
                              : x
                          )
                        )
                      }
                      className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 outline-none"
                    >
                      {CULTURE_TYPES.map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        onUpdateCultures((map.cultureList ?? []).filter((x) => x.id !== cult.id))
                      }
                      disabled={(map.cultureList ?? []).length <= 1}
                      className="text-slate-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'routes' && (
            <div className="space-y-2">
              {map.tradeRoutes.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  ยังไม่มีเส้นทางการค้า — เลือกเครื่องมือ "การค้า" แล้วคลิกเชื่อมระหว่าง 2 เมือง
                </div>
              ) : (
                map.tradeRoutes.map((tr) => {
                  const from = map.cities.find((c) => c.id === tr.fromCityId);
                  const to = map.cities.find((c) => c.id === tr.toCityId);
                  return (
                    <div
                      key={tr.id}
                      className="flex items-center justify-between bg-[#0f1620] border border-slate-800 rounded-lg px-3 py-2.5"
                    >
                      <div>
                        <div className="font-semibold text-slate-100">
                          {from?.name ?? '?'} ⇄ {to?.name ?? '?'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          โหมด: {tr.mode === 'sea' ? 'ทางเรือ' : tr.mode === 'mixed' ? 'ผสมบก-เรือ' : 'ทางบก'} · ระยะทาง{' '}
                          <span className="text-sky-300 font-medium">
                            {tr.distanceKm.toLocaleString()} กม.
                          </span>{' '}
                          · ใช้เวลา ~<span className="text-amber-300">{tr.travelDays} วัน</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteTradeRoute(tr.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                        title="ลบเส้นทางการค้า"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
