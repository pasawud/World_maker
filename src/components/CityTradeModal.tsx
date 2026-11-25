import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Coins,
  Plus,
  Route,
  Ship,
  Sparkles,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { CITY_TIERS } from '../data/goods';
import { isLandingCoastHex } from '../engine/hexMath';
import { computeCityTradeOverview } from '../engine/trade';
import { HexMapData, TradeMode } from '../types/map';

interface CityTradeModalProps {
  cityId: string;
  map: HexMapData;
  onSelectCityId: (cityId: string) => void;
  onCreateTradeRoute: (fromCityId: string, toCityId: string, mode: TradeMode) => { error?: string };
  onDeleteTradeRoute: (routeId: string) => void;
  onNotify: (msg: string) => void;
  onClose: () => void;
}

export const CityTradeModal: React.FC<CityTradeModalProps> = ({
  cityId,
  map,
  onSelectCityId,
  onCreateTradeRoute,
  onDeleteTradeRoute,
  onNotify,
  onClose,
}) => {
  const overview = useMemo(() => computeCityTradeOverview(map, cityId), [map, cityId]);
  const [modeOverrides, setModeOverrides] = useState<Record<string, TradeMode>>({});

  if (!overview) return null;

  const { city, routes, fulfilledDemandIds, unfulfilledDemandIds, totalEstimatedValue, suggestions } =
    overview;

  const kingdom = map.kingdoms.find((k) => k.id === city.kingdomId);
  const religion = map.religionList.find((r) => r.id === city.religionId);
  const culture = (map.cultureList ?? []).find((c) => c.id === city.cultureId);
  const tierLabel = CITY_TIERS.find((t) => t.id === city.tier)?.label ?? city.tier;
  const isCoast = city.tier === 'port' || isLandingCoastHex(map, city.q, city.r);
  const goodsMap = new Map(map.goods.map((g) => [g.id, g]));

  const handleConnect = (partnerId: string, defaultMode: TradeMode) => {
    const mode = modeOverrides[partnerId] ?? defaultMode;
    const res = onCreateTradeRoute(city.id, partnerId, mode);
    if (res.error) {
      onNotify(res.error);
    } else {
      const partnerName = map.cities.find((c) => c.id === partnerId)?.name ?? 'เมืองปลายทาง';
      onNotify(`เชื่อมเส้นทางการค้า ${city.name} ⇄ ${partnerName} เรียบร้อยแล้ว`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141c27] border border-amber-500/40 rounded-xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-[#111720]">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-300">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-amber-300">หน้าต่างการค้าของเมือง</h2>
                <select
                  value={city.id}
                  onChange={(e) => onSelectCityId(e.target.value)}
                  className="bg-[#1a2433] border border-slate-700 rounded px-2 py-0.5 text-xs font-semibold text-slate-100 outline-none cursor-pointer"
                >
                  {map.cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <span>
                  {tierLabel} · ({city.q}, {city.r}) · ประชากร {city.population.toLocaleString()} คน
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded border text-[10px] ${
                    isCoast
                      ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {isCoast ? '⚓ ติดทะเลเดินเรือได้' : '🏔️ เมืองในแผ่นดิน'}
                </span>
                {kingdom && (
                  <span className="text-amber-300">👑 {kingdom.name}</span>
                )}
                {culture && (
                  <span className="text-teal-300">
                    {culture.symbol} {culture.name}
                  </span>
                )}
                {religion && (
                  <span className="text-purple-300">
                    {religion.symbol} {religion.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            title="ปิด"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400">เส้นทางการค้าที่เชื่อม</div>
              <div className="text-lg font-bold text-amber-300 mt-0.5 flex items-center gap-1.5">
                <Route className="w-4 h-4 text-amber-400/80" />
                {routes.length} เส้นทาง
              </div>
            </div>

            <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400">มูลค่าการค้ารวม</div>
              <div className="text-lg font-bold text-emerald-300 mt-0.5 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-400/80" />
                {totalEstimatedValue.toLocaleString()} <span className="text-[11px] font-normal">ทอง</span>
              </div>
            </div>

            <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400">สินค้าส่งออกของเมือง</div>
              <div className="text-lg font-bold text-sky-300 mt-0.5">
                {city.producedGoods.length} รายการ
              </div>
            </div>

            <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400">ความต้องการที่ได้รับแล้ว</div>
              <div className="text-lg font-bold text-slate-100 mt-0.5">
                <span className="text-emerald-300">{fulfilledDemandIds.length}</span> /{' '}
                {city.demandedGoods.length} รายการ
              </div>
            </div>
          </div>

          {/* Produced & Demanded Goods */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="font-semibold text-emerald-300">
                สินค้าที่เมืองผลิต / ส่งออก ({city.producedGoods.length})
              </div>
              {city.producedGoods.length === 0 ? (
                <div className="text-slate-500 italic">ยังไม่ได้กำหนดสินค้าผลิต</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {city.producedGoods.map((gid) => {
                    const g = goodsMap.get(gid);
                    if (!g) return null;
                    return (
                      <span
                        key={gid}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/12 border border-emerald-500/35 text-emerald-100"
                      >
                        <span>{g.icon}</span>
                        <span>{g.name}</span>
                        <span className="text-[10px] text-emerald-300/80">({g.basePrice}g)</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="font-semibold text-sky-300">
                สินค้าที่ต้องการนำเข้า ({city.demandedGoods.length})
              </div>
              {city.demandedGoods.length === 0 ? (
                <div className="text-slate-500 italic">ยังไม่ได้กำหนดสินค้าที่ต้องการ</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {city.demandedGoods.map((gid) => {
                    const g = goodsMap.get(gid);
                    if (!g) return null;
                    const fulfilled = fulfilledDemandIds.includes(gid);
                    return (
                      <span
                        key={gid}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${
                          fulfilled
                            ? 'bg-emerald-500/12 border-emerald-500/40 text-emerald-100'
                            : 'bg-amber-500/10 border-amber-500/35 text-amber-100'
                        }`}
                      >
                        <span>{g.icon}</span>
                        <span>{g.name}</span>
                        <span
                          className={`text-[10px] px-1 rounded ${
                            fulfilled
                              ? 'bg-emerald-500/25 text-emerald-300'
                              : 'bg-amber-500/25 text-amber-300'
                          }`}
                        >
                          {fulfilled ? 'นำเข้าแล้ว' : 'ขาดแคลน'}
                        </span>
                      </span>
                    );
                  })}
                </div>
              )}
              {unfulfilledDemandIds.length === 0 && city.demandedGoods.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>ความต้องการสินค้าทุกอย่างได้รับการจัดหาแล้ว</span>
                </div>
              )}
            </div>
          </div>

          {/* Active Trade Routes */}
          <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-amber-200 flex items-center gap-1.5">
                <ArrowLeftRight className="w-4 h-4 text-amber-400" />
                เส้นทางการค้าที่เชื่อมอยู่ ({routes.length})
              </h3>
            </div>

            {routes.length === 0 ? (
              <div className="text-center py-5 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                เมืองนี้ยังไม่มีเส้นทางการค้าเชื่อมต่อ — สามารถเลือกคู่ค้าแนะนำด้านล่างเพื่อเชื่อมได้ทันที
              </div>
            ) : (
              <div className="space-y-2">
                {routes.map(({ route, partnerCity, direction, tradedGoods, estimatedValue }) => (
                  <div
                    key={route.id}
                    className="bg-[#151d28] border border-slate-800 rounded-lg px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {partnerCity ? (
                          <button
                            onClick={() => onSelectCityId(partnerCity.id)}
                            className="font-semibold text-amber-200 hover:text-amber-300 underline-offset-2 hover:underline cursor-pointer"
                            title="คลิกเพื่อสลับไปดูหน้าต่างการค้าของเมืองคู่ค้านี้"
                          >
                            {partnerCity.name}
                          </button>
                        ) : (
                          <span className="text-slate-400">เมืองที่ไม่ทราบชื่อ</span>
                        )}

                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            direction === 'mutual'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : direction === 'export'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-purple-500/20 text-purple-300'
                          }`}
                        >
                          {direction === 'mutual'
                            ? 'แลกเปลี่ยน ⇄'
                            : direction === 'export'
                            ? 'ส่งออก →'
                            : '← นำเข้า'}
                        </span>

                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                          {route.mode === 'sea'
                            ? '⛵ ทางเรือ'
                            : route.mode === 'mixed'
                            ? '⚓ ผสมบก-เรือ'
                            : '🐪 ทางบก'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>ระยะทาง {route.distanceKm.toLocaleString()} กม.</span>
                        <span>·</span>
                        <span>ใช้เวลา ~{route.travelDays} วัน</span>
                        <span>·</span>
                        <span className="text-emerald-300 font-medium">
                          มูลค่า ~{estimatedValue.toLocaleString()} ทอง
                        </span>
                      </div>

                      {tradedGoods.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {tradedGoods.map((g) => (
                            <span
                              key={g.id}
                              className="px-1.5 py-0.5 rounded bg-[#0f1620] border border-slate-700/80 text-[10px] text-slate-200"
                            >
                              {g.icon} {g.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => onDeleteTradeRoute(route.id)}
                      className="self-end sm:self-center p-1.5 rounded bg-rose-950/35 hover:bg-rose-900/55 border border-rose-900/50 text-rose-300 cursor-pointer shrink-0"
                      title="ลบเส้นทางการค้านี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommended Trade Partners */}
          <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sky-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-400" />
                คู่ค้าแนะนำ (เรียงตามสินค้าที่ตรงกันและระยะทาง)
              </h3>
            </div>

            {suggestions.length === 0 ? (
              <div className="text-slate-500 italic py-2">
                {map.cities.length <= 1
                  ? 'ต้องมีอย่างน้อย 2 เมืองบนแผนที่จึงจะสร้างเส้นทางการค้าได้'
                  : 'เมืองนี้เชื่อมต่อการค้ากับทุกเมืองบนแผนที่แล้ว'}
              </div>
            ) : (
              <div className="space-y-2">
                {suggestions.slice(0, 6).map((s) => {
                  const selectedMode = modeOverrides[s.partner.id] ?? s.recommendedMode;
                  return (
                    <div
                      key={s.partner.id}
                      className="bg-[#151d28] border border-slate-800 rounded-lg px-3 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-100">{s.partner.name}</span>
                          <span className="text-[11px] text-slate-400">
                            ระยะเส้นตรง ~{s.straightDistanceKm.toLocaleString()} กม.
                          </span>
                          {s.totalMatches > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-medium">
                              สินค้าตรงกัน {s.totalMatches} รายการ
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 text-[11px]">
                          {s.exportMatches.length > 0 && (
                            <span className="text-emerald-300 flex items-center gap-1 flex-wrap">
                              <ArrowRight className="w-3 h-3" /> ส่งไปขาย:{' '}
                              {s.exportMatches.map((g) => `${g.icon} ${g.name}`).join(', ')}
                            </span>
                          )}
                          {s.importMatches.length > 0 && (
                            <span className="text-sky-300 flex items-center gap-1 flex-wrap">
                              ← ซื้อเข้า:{' '}
                              {s.importMatches.map((g) => `${g.icon} ${g.name}`).join(', ')}
                            </span>
                          )}
                          {s.totalMatches === 0 && (
                            <span className="text-slate-500">
                              สินค้ายังไม่ตรงความต้องการโดยตรง (ยังสามารถเชื่อมเส้นทางได้)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={selectedMode}
                          onChange={(e) =>
                            setModeOverrides((prev) => ({
                              ...prev,
                              [s.partner.id]: e.target.value as TradeMode,
                            }))
                          }
                          className="bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 outline-none"
                        >
                          <option value="land">ทางบก</option>
                          <option value="mixed">ผสมบก-เรือ</option>
                          <option value="sea">
                            {isCoast ? 'ทางเรือ' : 'ทางเรือ (เฉพาะเมืองท่า)'}
                          </option>
                        </select>
                        <button
                          onClick={() => handleConnect(s.partner.id, s.recommendedMode)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 font-medium cursor-pointer"
                        >
                          {selectedMode === 'sea' ? (
                            <Ship className="w-3.5 h-3.5" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          <span>เชื่อมเส้นการค้า</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
