import React from 'react';
import { Sparkles, Trash2, X } from 'lucide-react';
import { CITY_TIERS } from '../data/goods';
import { autoSuggestGoodsForCity } from '../engine/worldGenerator';
import { City, CityTier, HexMapData } from '../types/map';

interface CityInspectorProps {
  city: City;
  map: HexMapData;
  onUpdate: (patch: Partial<City>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export const CityInspector: React.FC<CityInspectorProps> = ({
  city,
  map,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const toggleGood = (field: 'producedGoods' | 'demandedGoods', goodId: string) => {
    const list = city[field];
    if (list.includes(goodId)) {
      onUpdate({ [field]: list.filter((id) => id !== goodId) });
    } else {
      onUpdate({ [field]: [...list, goodId] });
    }
  };

  const handleAutoSuggest = () => {
    const suggested = autoSuggestGoodsForCity(map, city.q, city.r);
    onUpdate(suggested);
  };

  return (
    <div className="bg-[#151d28] border border-amber-500/40 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-amber-300">ข้อมูลเมือง & สินค้า</h3>
          <p className="text-[11px] text-slate-400">พิกัด ({city.q}, {city.r})</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
          title="ปิด"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">ชื่อเมือง</label>
          <input
            value={city.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full bg-[#0f1620] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:border-amber-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">ระดับเมือง</label>
            <select
              value={city.tier}
              onChange={(e) => onUpdate({ tier: e.target.value as CityTier })}
              className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 outline-none"
            >
              {CITY_TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">ประชากร</label>
            <input
              type="number"
              min={0}
              step={500}
              value={city.population}
              onChange={(e) => onUpdate({ population: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">สังกัดอาณาจักร</label>
            <select
              value={city.kingdomId}
              onChange={(e) => onUpdate({ kingdomId: e.target.value })}
              className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 outline-none"
            >
              {map.kingdoms.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">ศาสนาหลัก</label>
            <select
              value={city.religionId}
              onChange={(e) => onUpdate({ religionId: e.target.value })}
              className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 outline-none"
            >
              {map.religionList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.symbol} {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={handleAutoSuggest}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 text-xs font-medium transition cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>แนะนำสินค้าตามภูมิศาสตร์รอบเมือง</span>
      </button>

      <div>
        <div className="text-[11px] text-emerald-300 font-medium mb-1">
          สินค้าที่ผลิต / ส่งออก ({city.producedGoods.length})
        </div>
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
          {map.goods.map((g) => {
            const active = city.producedGoods.includes(g.id);
            return (
              <button
                key={g.id}
                onClick={() => toggleGood('producedGoods', g.id)}
                className={`px-1.5 py-0.5 rounded text-[11px] border transition cursor-pointer ${
                  active
                    ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-100'
                    : 'bg-[#0f1620] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {g.icon} {g.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-sky-300 font-medium mb-1">
          สินค้าที่ต้องการนำเข้า ({city.demandedGoods.length})
        </div>
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
          {map.goods.map((g) => {
            const active = city.demandedGoods.includes(g.id);
            return (
              <button
                key={g.id}
                onClick={() => toggleGood('demandedGoods', g.id)}
                className={`px-1.5 py-0.5 rounded text-[11px] border transition cursor-pointer ${
                  active
                    ? 'bg-sky-500/25 border-sky-400/60 text-sky-100'
                    : 'bg-[#0f1620] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {g.icon} {g.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-slate-400 mb-1">บันทึกเพิ่มเติม</label>
        <textarea
          rows={2}
          value={city.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="ประวัติเมือง ตลาดสำคัญ..."
          className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none resize-none"
        />
      </div>

      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs transition cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>ลบเมืองนี้</span>
      </button>
    </div>
  );
};
