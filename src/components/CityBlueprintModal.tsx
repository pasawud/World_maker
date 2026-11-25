import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Eye,
  EyeOff,
  MapPin,
  Move,
  Plus,
  RefreshCw,
  Route,
  Shield,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  ARCHITECTURE_STYLES,
  CITY_BUILDING_PRESETS,
  CITY_DISTRICT_META,
  CITY_TIERS,
} from '../data/goods';
import { createDefaultCityProfile, generateCityPlan } from '../engine/cityGenerator';
import { buildCityGeometry } from '../engine/cityGeometry';
import { exportCityPlanToPng, renderCityPlan } from '../engine/cityRenderer';
import {
  CardinalSide,
  City,
  CityBlueprintTheme,
  CityBuilding,
  CityBuildingCategory,
  CityDeepProfile,
  CityDemographicSlice,
  CityDistrict,
  CityDistrictType,
  CityLayoutStyle,
  CityPlanData,
  CityWallStyle,
  HexMapData,
} from '../types/map';

interface CityBlueprintModalProps {
  city: City;
  map: HexMapData;
  onUpdateCity: (cityId: string, patch: Partial<City>) => void;
  onNotify: (msg: string) => void;
  onClose: () => void;
}

type CanvasMode = 'select' | 'add_district' | 'add_building' | 'add_road';

export const CityBlueprintModal: React.FC<CityBlueprintModalProps> = ({
  city,
  map,
  onUpdateCity,
  onNotify,
  onClose,
}) => {
  const [plan, setPlan] = useState<CityPlanData>(
    () => city.plan ?? generateCityPlan(map, city)
  );
  const [profile, setProfile] = useState<CityDeepProfile>(
    () => city.profile ?? createDefaultCityProfile(map, city)
  );

  // Persist initial generated plan/profile once if city did not have one
  useEffect(() => {
    if (!city.plan || !city.profile) {
      onUpdateCity(city.id, {
        plan: city.plan ?? plan,
        profile: city.profile ?? profile,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.id]);

  const commitPlan = (next: CityPlanData) => {
    setPlan(next);
    onUpdateCity(city.id, { plan: next });
  };

  const commitProfile = (next: CityDeepProfile) => {
    setProfile(next);
    onUpdateCity(city.id, { profile: next });
  };

  const [tab, setTab] = useState<'layout' | 'profile' | 'demographics'>('layout');
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('select');
  const [newDistrictType, setNewDistrictType] = useState<CityDistrictType>('residential');
  const [newBuildingCat, setNewBuildingCat] = useState<CityBuildingCategory>('temple');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [roadStart, setRoadStart] = useState<{ x: number; y: number } | null>(null);

  const [cam, setCam] = useState({ x: 500, y: 500, zoom: 0.78 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewSize, setViewSize] = useState({ w: 620, h: 560 });

  const geometry = useMemo(
    () => buildCityGeometry(plan, { ...city, plan, profile }),
    [city, plan, profile]
  );

  const draggingRef = useRef<
    | { kind: 'pan'; mx: number; my: number; cx: number; cy: number }
    | { kind: 'district'; id: string }
    | { kind: 'building'; id: string }
    | null
  >(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const upd = () => setViewSize({ w: el.clientWidth, h: el.clientHeight });
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(viewSize.w * dpr));
    canvas.height = Math.max(1, Math.floor(viewSize.h * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    renderCityPlan(ctx, viewSize.w, viewSize.h, { ...city, plan, profile }, plan, map, {
      camX: cam.x,
      camY: cam.y,
      zoom: cam.zoom,
      selectedDistrictId,
      selectedBuildingId,
      geometry,
    });
    ctx.restore();
  }, [cam, city, geometry, map, plan, profile, selectedBuildingId, selectedDistrictId, viewSize]);

  const toWorld = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 500, y: 500 };
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - viewSize.w / 2) / cam.zoom + cam.x,
      y: (sy - viewSize.h / 2) / cam.zoom + cam.y,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toWorld(e.clientX, e.clientY);

    if (e.button === 1 || e.button === 2) {
      draggingRef.current = { kind: 'pan', mx: e.clientX, my: e.clientY, cx: cam.x, cy: cam.y };
      return;
    }

    if (canvasMode === 'add_district') {
      const meta = CITY_DISTRICT_META[newDistrictType];
      const newDist: CityDistrict = {
        id: `dist_${Date.now().toString(36)}`,
        name: meta.defaultName,
        type: newDistrictType,
        x: Math.round(Math.max(60, Math.min(940, pt.x))),
        y: Math.round(Math.max(60, Math.min(940, pt.y))),
        radius: 68,
        color: meta.color,
        populationShare: 10,
      };
      commitPlan({ ...plan, districts: [...plan.districts, newDist] });
      setSelectedDistrictId(newDist.id);
      setSelectedBuildingId(null);
      setCanvasMode('select');
      return;
    }

    if (canvasMode === 'add_building') {
      const preset =
        CITY_BUILDING_PRESETS.find((p) => p.category === newBuildingCat) ??
        CITY_BUILDING_PRESETS[0];
      const newBld: CityBuilding = {
        id: `bld_${Date.now().toString(36)}`,
        name: preset.label,
        category: newBuildingCat,
        symbol: preset.symbol,
        x: Math.round(Math.max(50, Math.min(950, pt.x))),
        y: Math.round(Math.max(50, Math.min(950, pt.y))),
        religionId: newBuildingCat === 'temple' ? city.religionId : undefined,
      };
      commitPlan({ ...plan, buildings: [...plan.buildings, newBld] });
      setSelectedBuildingId(newBld.id);
      setSelectedDistrictId(null);
      setCanvasMode('select');
      return;
    }

    if (canvasMode === 'add_road') {
      if (!roadStart) {
        setRoadStart({ x: Math.round(pt.x), y: Math.round(pt.y) });
      } else {
        commitPlan({
          ...plan,
          roads: [
            ...plan.roads,
            {
              id: `road_${Date.now().toString(36)}`,
              kind: 'main',
              points: [roadStart, { x: Math.round(pt.x), y: Math.round(pt.y) }],
            },
          ],
        });
        setRoadStart(null);
        setCanvasMode('select');
      }
      return;
    }

    // Select & Drag mode: check buildings first, then districts
    const hitBuilding = [...plan.buildings]
      .reverse()
      .find((b) => Math.hypot(b.x - pt.x, b.y - pt.y) <= 20);
    if (hitBuilding) {
      setSelectedBuildingId(hitBuilding.id);
      setSelectedDistrictId(null);
      draggingRef.current = { kind: 'building', id: hitBuilding.id };
      return;
    }

    const hitDistrict = [...plan.districts]
      .reverse()
      .find((d) => Math.hypot(d.x - pt.x, d.y - pt.y) <= d.radius);
    if (hitDistrict) {
      setSelectedDistrictId(hitDistrict.id);
      setSelectedBuildingId(null);
      draggingRef.current = { kind: 'district', id: hitDistrict.id };
      return;
    }

    setSelectedDistrictId(null);
    setSelectedBuildingId(null);
    draggingRef.current = { kind: 'pan', mx: e.clientX, my: e.clientY, cx: cam.x, cy: cam.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = draggingRef.current;
    if (!drag) return;
    if (drag.kind === 'pan') {
      const dx = (e.clientX - drag.mx) / cam.zoom;
      const dy = (e.clientY - drag.my) / cam.zoom;
      setCam((c) => ({ ...c, x: drag.cx - dx, y: drag.cy - dy }));
      return;
    }
    const pt = toWorld(e.clientX, e.clientY);
    if (drag.kind === 'building') {
      const nextBlds = plan.buildings.map((b) =>
        b.id === drag.id ? { ...b, x: Math.round(pt.x), y: Math.round(pt.y) } : b
      );
      setPlan({ ...plan, buildings: nextBlds });
    } else if (drag.kind === 'district') {
      const nextDists = plan.districts.map((d) =>
        d.id === drag.id ? { ...d, x: Math.round(pt.x), y: Math.round(pt.y) } : d
      );
      setPlan({ ...plan, districts: nextDists });
    }
  };

  const handlePointerUp = () => {
    const drag = draggingRef.current;
    draggingRef.current = null;
    if (drag && (drag.kind === 'building' || drag.kind === 'district')) {
      onUpdateCity(city.id, { plan });
    }
  };

  const handleRegenerate = (style?: CityLayoutStyle) => {
    const nextSeed = Math.floor(1000 + Math.random() * 90000);
    const generated = generateCityPlan(map, { ...city, profile }, {
      seed: nextSeed,
      layoutStyle: style ?? plan.layoutStyle,
    });
    const nextPlan: CityPlanData = {
      ...generated,
      theme: plan.theme ?? 'parchment',
      showLabels: plan.showLabels ?? true,
      showFarms: plan.showFarms ?? true,
      showTrees: plan.showTrees ?? true,
      density: plan.density ?? 1.0,
    };
    commitPlan(nextPlan);
    setSelectedDistrictId(null);
    setSelectedBuildingId(null);
    onNotify('สุ่มแผนผังเมืองใหม่ตามภูมิศาสตร์ของช่องเมืองแล้ว');
  };

  const handleExportPng = () => {
    const url = exportCityPlanToPng({ ...city, plan, profile }, plan, map);
    const a = document.createElement('a');
    a.href = url;
    a.download = `city_plan_${city.name.replace(/\s+/g, '_')}.png`;
    a.click();
    onNotify(`บันทึกภาพผังเมือง "${city.name}" เป็น PNG แล้ว`);
  };

  const selectedDistrict = plan.districts.find((d) => d.id === selectedDistrictId) ?? null;
  const selectedBuilding = plan.buildings.find((b) => b.id === selectedBuildingId) ?? null;
  const tierLabel = CITY_TIERS.find((t) => t.id === city.tier)?.label ?? city.tier;

  const normalizeMix = (slices: CityDemographicSlice[]): CityDemographicSlice[] => {
    const total = slices.reduce((s, x) => s + Math.max(0, x.percent), 0);
    if (total <= 0) return slices;
    return slices.map((s) => ({
      ...s,
      percent: Math.round((Math.max(0, s.percent) / total) * 100),
    }));
  };

  const religionMix = profile.religionMix ?? [];
  const cultureMix = profile.cultureMix ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-[#141c27] border border-amber-500/45 rounded-xl w-full max-w-6xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-[#111720]">
          <div>
            <h2 className="text-sm font-semibold text-amber-300">
              สตูดิโอสร้างแผนผังเมือง & ปรับแต่งเชิงลึก: {city.name}
            </h2>
            <p className="text-[11px] text-slate-400">
              {tierLabel} · ประชากร {city.population.toLocaleString()} คน · พิกัด ({city.q}, {city.r})
              {plan.waterSide !== 'none' ? ` · ติดทะเล (${plan.waterSide})` : ''}
              {plan.hasRiver ? ' · มีแม่น้ำไหลผ่าน' : ''}
              {plan.hasCliff ? ' · มีหน้าผาป้องกัน' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPng}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" /> ส่งออก PNG
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Split Body */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Left: Interactive 2D City Canvas */}
          <div className="flex-1 flex flex-col min-h-[300px] relative bg-[#0e1722]">
            {/* Canvas Toolbar */}
            <div className="px-3 py-2 border-b border-slate-800 bg-[#111720] flex flex-wrap items-center gap-1.5 text-xs">
              <button
                onClick={() => setCanvasMode('select')}
                className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer ${
                  canvasMode === 'select'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-medium'
                    : 'bg-[#17202b] border-slate-700 text-slate-300'
                }`}
              >
                <Move className="w-3.5 h-3.5" /> เลือก/ลากย้าย
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCanvasMode('add_district')}
                  className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer ${
                    canvasMode === 'add_district'
                      ? 'bg-sky-500/25 border-sky-400 text-sky-200 font-medium'
                      : 'bg-[#17202b] border-slate-700 text-slate-300'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" /> วางเขต:
                </button>
                <select
                  value={newDistrictType}
                  onChange={(e) => {
                    setNewDistrictType(e.target.value as CityDistrictType);
                    setCanvasMode('add_district');
                  }}
                  className="bg-[#0f1620] border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-200 outline-none"
                >
                  {Object.entries(CITY_DISTRICT_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCanvasMode('add_building')}
                  className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer ${
                    canvasMode === 'add_building'
                      ? 'bg-purple-500/25 border-purple-400 text-purple-200 font-medium'
                      : 'bg-[#17202b] border-slate-700 text-slate-300'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" /> วางอาคาร:
                </button>
                <select
                  value={newBuildingCat}
                  onChange={(e) => {
                    setNewBuildingCat(e.target.value as CityBuildingCategory);
                    setCanvasMode('add_building');
                  }}
                  className="bg-[#0f1620] border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-200 outline-none"
                >
                  {CITY_BUILDING_PRESETS.map((p) => (
                    <option key={p.category} value={p.category}>
                      {p.symbol} {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  setRoadStart(null);
                  setCanvasMode('add_road');
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer ${
                  canvasMode === 'add_road'
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 font-medium'
                    : 'bg-[#17202b] border-slate-700 text-slate-300'
                }`}
              >
                <Route className="w-3.5 h-3.5" />
                <span>{roadStart ? 'คลิกปลายถนน' : 'วาดถนน'}</span>
              </button>

              <div className="flex items-center bg-[#0f1620] border border-slate-700 rounded p-0.5 gap-0.5 ml-auto">
                {(
                  [
                    { id: 'parchment', label: '📜 โบราณ' },
                    { id: 'districts', label: '🎨 แบ่งสีเขต' },
                    { id: 'dark', label: '🌙 มืด' },
                  ] as { id: CityBlueprintTheme; label: string }[]
                ).map((th) => (
                  <button
                    key={th.id}
                    onClick={() => commitPlan({ ...plan, theme: th.id })}
                    className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                      (plan.theme ?? 'parchment') === th.id
                        ? 'bg-amber-500/25 text-amber-200 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {th.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() =>
                  commitPlan({ ...plan, showLabels: !(plan.showLabels !== false) })
                }
                className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer ${
                  plan.showLabels !== false
                    ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                    : 'bg-[#17202b] border-slate-700 text-slate-400'
                }`}
                title="แสดง/ซ่อนป้ายชื่อเขตและหมุดอาคาร (ปิดเพื่อดูแผนที่ลายเส้นโบราณล้วน)"
              >
                {plan.showLabels !== false ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
                <span>ป้ายชื่อ</span>
              </button>

              <button
                onClick={() => handleRegenerate()}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> สุ่มผังเมืองใหม่
              </button>
            </div>

            <div ref={containerRef} className="flex-1 relative overflow-hidden">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onWheel={(e) => {
                  e.preventDefault();
                  const f = e.deltaY < 0 ? 1.12 : 0.89;
                  setCam((c) => ({ ...c, zoom: Math.max(0.35, Math.min(2.4, c.zoom * f)) }));
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`w-full h-full block touch-none ${
                  canvasMode === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
                }`}
              />
              <div className="absolute bottom-2.5 right-2.5 bg-[#111720]/85 border border-slate-700/80 rounded px-2.5 py-1 text-[11px] text-slate-300 pointer-events-none">
                ลากเขตหรืออาคารเพื่อจัดวาง · ลากพื้นที่ว่างเพื่อเลื่อนดู · Scroll เพื่อซูม
              </div>
            </div>
          </div>

          {/* Right: Deep Customization Sidebar */}
          <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#111720] flex flex-col min-h-0">
            <div className="px-3 pt-2 border-b border-slate-800 flex gap-2 text-xs">
              {[
                { id: 'layout', label: 'ผังเมือง & อาคาร' },
                { id: 'profile', label: 'ข้อมูล & ป้องกัน' },
                { id: 'demographics', label: 'ศาสนา & วัฒนธรรม' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as typeof tab)}
                  className={`py-2 px-2 border-b-2 cursor-pointer ${
                    tab === t.id
                      ? 'border-amber-400 text-amber-300 font-semibold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3">
              {tab === 'layout' && (
                <>
                  {/* Selected District or Building Editor */}
                  {selectedDistrict && (
                    <div className="bg-[#151d28] border border-amber-500/50 rounded-lg p-2.5 space-y-2">
                      <div className="flex items-center justify-between font-semibold text-amber-300">
                        <span>แก้ไขเขตที่เลือก</span>
                        <button
                          onClick={() => {
                            commitPlan({
                              ...plan,
                              districts: plan.districts.filter((d) => d.id !== selectedDistrict.id),
                            });
                            setSelectedDistrictId(null);
                          }}
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="color"
                          value={selectedDistrict.color}
                          onChange={(e) =>
                            commitPlan({
                              ...plan,
                              districts: plan.districts.map((d) =>
                                d.id === selectedDistrict.id ? { ...d, color: e.target.value } : d
                              ),
                            })
                          }
                          className="w-7 h-7 bg-transparent border-0 cursor-pointer"
                        />
                        <input
                          value={selectedDistrict.name}
                          onChange={(e) =>
                            commitPlan({
                              ...plan,
                              districts: plan.districts.map((d) =>
                                d.id === selectedDistrict.id ? { ...d, name: e.target.value } : d
                              ),
                            })
                          }
                          className="flex-1 bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400">
                            ขนาดเขต ({selectedDistrict.radius})
                          </label>
                          <input
                            type="range"
                            min={35}
                            max={170}
                            value={selectedDistrict.radius}
                            onChange={(e) =>
                              commitPlan({
                                ...plan,
                                districts: plan.districts.map((d) =>
                                  d.id === selectedDistrict.id
                                    ? { ...d, radius: Number(e.target.value) }
                                    : d
                                ),
                              })
                            }
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">สัดส่วนประชากร (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={selectedDistrict.populationShare}
                            onChange={(e) =>
                              commitPlan({
                                ...plan,
                                districts: plan.districts.map((d) =>
                                  d.id === selectedDistrict.id
                                    ? { ...d, populationShare: Math.max(0, Number(e.target.value) || 0) }
                                    : d
                                ),
                              })
                            }
                            className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedBuilding && (
                    <div className="bg-[#151d28] border border-purple-500/50 rounded-lg p-2.5 space-y-2">
                      <div className="flex items-center justify-between font-semibold text-purple-300">
                        <span>แก้ไขอาคารที่เลือก</span>
                        <button
                          onClick={() => {
                            commitPlan({
                              ...plan,
                              buildings: plan.buildings.filter((b) => b.id !== selectedBuilding.id),
                            });
                            setSelectedBuildingId(null);
                          }}
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          value={selectedBuilding.symbol}
                          onChange={(e) =>
                            commitPlan({
                              ...plan,
                              buildings: plan.buildings.map((b) =>
                                b.id === selectedBuilding.id ? { ...b, symbol: e.target.value } : b
                              ),
                            })
                          }
                          className="w-10 text-center bg-[#0f1620] border border-slate-700 rounded px-1 py-1"
                        />
                        <input
                          value={selectedBuilding.name}
                          onChange={(e) =>
                            commitPlan({
                              ...plan,
                              buildings: plan.buildings.map((b) =>
                                b.id === selectedBuilding.id ? { ...b, name: e.target.value } : b
                              ),
                            })
                          }
                          className="flex-1 bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                        />
                      </div>
                      {selectedBuilding.category === 'temple' && (
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            วิหารของศาสนา
                          </label>
                          <select
                            value={selectedBuilding.religionId ?? ''}
                            onChange={(e) =>
                              commitPlan({
                                ...plan,
                                buildings: plan.buildings.map((b) =>
                                  b.id === selectedBuilding.id
                                    ? { ...b, religionId: e.target.value }
                                    : b
                                ),
                              })
                            }
                            className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                          >
                            <option value="">-- ไม่ระบุ --</option>
                            {map.religionList.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.symbol} {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* City Structure Settings */}
                  <div className="bg-[#151d28] border border-slate-800 rounded-lg p-2.5 space-y-2">
                    <div className="font-semibold text-slate-200">โครงสร้างกำแพงและภูมิประเทศ</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">สไตล์ผัง</label>
                        <select
                          value={plan.layoutStyle}
                          onChange={(e) => handleRegenerate(e.target.value as CityLayoutStyle)}
                          className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                        >
                          <option value="radial">วงกลมศูนย์กลาง</option>
                          <option value="grid">ตารางเป็นระเบียบ</option>
                          <option value="coastal_crescent">โค้งรับอ่าวทะเล</option>
                          <option value="river_twin">สองฝั่งแม่น้ำ</option>
                          <option value="hilltop_fort">ป้อมบนยอดผา</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">กำแพงเมือง</label>
                        <select
                          value={plan.wallStyle}
                          onChange={(e) => {
                            const ws = e.target.value as CityWallStyle;
                            commitPlan({ ...plan, wallStyle: ws, hasWalls: ws !== 'none' });
                          }}
                          className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                        >
                          <option value="none">ไม่มีกำแพง</option>
                          <option value="wooden">รั้วไม้/ป้อมไม้</option>
                          <option value="stone">กำแพงหินชั้นเดียว</option>
                          <option value="citadel_double">กำแพงหินสองชั้น</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">ฝั่งทะเล</label>
                        <select
                          value={plan.waterSide}
                          onChange={(e) =>
                            commitPlan({ ...plan, waterSide: e.target.value as CardinalSide })
                          }
                          className="w-full bg-[#0f1620] border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none"
                        >
                          <option value="none">ไม่มีทะเล</option>
                          <option value="north">เหนือ</option>
                          <option value="south">ใต้</option>
                          <option value="east">ตะวันออก</option>
                          <option value="west">ตะวันตก</option>
                        </select>
                      </div>
                      <div className="flex flex-col justify-end gap-1 pb-0.5">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={plan.hasRiver}
                            onChange={(e) => commitPlan({ ...plan, hasRiver: e.target.checked })}
                          />
                          <span>มีแม่น้ำผ่าเมือง</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={plan.hasCliff}
                            onChange={(e) => commitPlan({ ...plan, hasCliff: e.target.checked })}
                          />
                          <span>มีแนวหน้าผา</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                      <div>
                        <label className="block text-[10px] text-slate-400">
                          รัศมีกำแพงเมือง ({plan.wallRadius})
                        </label>
                        <input
                          type="range"
                          min={150}
                          max={350}
                          value={plan.wallRadius}
                          onChange={(e) =>
                            commitPlan({ ...plan, wallRadius: Number(e.target.value) })
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400">
                          ความหนาแน่นอาคาร ({(plan.density ?? 1).toFixed(1)}x)
                        </label>
                        <input
                          type="range"
                          min={0.6}
                          max={1.5}
                          step={0.1}
                          value={plan.density ?? 1}
                          onChange={(e) =>
                            commitPlan({ ...plan, density: Number(e.target.value) })
                          }
                          className="w-full"
                        />
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={plan.showFarms !== false}
                          onChange={(e) => commitPlan({ ...plan, showFarms: e.target.checked })}
                        />
                        <span>แปลงเกษตรชานเมือง</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={plan.showTrees !== false}
                          onChange={(e) => commitPlan({ ...plan, showTrees: e.target.checked })}
                        />
                        <span>ต้นไม้ & แนวป่า</span>
                      </label>
                    </div>
                  </div>

                  {/* Districts & Buildings List */}
                  <div className="bg-[#151d28] border border-slate-800 rounded-lg p-2.5 space-y-1.5">
                    <div className="font-semibold text-slate-200">
                      เขตย่านทั้งหมด ({plan.districts.length})
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {plan.districts.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setSelectedDistrictId(d.id);
                            setSelectedBuildingId(null);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded border text-left cursor-pointer ${
                            selectedDistrictId === d.id
                              ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                              : 'bg-[#0f1620] border-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: d.color }}
                            />
                            <span className="truncate">{d.name}</span>
                          </span>
                          <span className="text-[10px] text-slate-400">{d.populationShare}%</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#151d28] border border-slate-800 rounded-lg p-2.5 space-y-1.5">
                    <div className="font-semibold text-slate-200">
                      อาคารสำคัญ ({plan.buildings.length})
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {plan.buildings.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => {
                            setSelectedBuildingId(b.id);
                            setSelectedDistrictId(null);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded border text-left cursor-pointer ${
                            selectedBuildingId === b.id
                              ? 'bg-purple-500/20 border-purple-400 text-purple-100'
                              : 'bg-[#0f1620] border-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <span>{b.symbol}</span>
                            <span className="truncate">{b.name}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {tab === 'profile' && (
                <div className="bg-[#151d28] border border-slate-800 rounded-lg p-3 space-y-2.5">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Shield className="w-4 h-4" />
                    ข้อมูลการปกครองและการป้องกันเมือง
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">คำขวัญประจำเมือง</label>
                    <input
                      value={profile.motto ?? ''}
                      onChange={(e) => commitProfile({ ...profile, motto: e.target.value })}
                      placeholder="เช่น ประตูสู่ท้องทะเล..."
                      className="w-full bg-[#0f1620] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">เจ้าเมือง / ผู้ปกครอง</label>
                    <input
                      value={profile.rulerName ?? ''}
                      onChange={(e) => commitProfile({ ...profile, rulerName: e.target.value })}
                      className="w-full bg-[#0f1620] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">ปีที่ก่อตั้ง</label>
                      <input
                        type="number"
                        value={profile.foundedYear ?? 1}
                        onChange={(e) =>
                          commitProfile({ ...profile, foundedYear: Number(e.target.value) || 1 })
                        }
                        className="w-full bg-[#0f1620] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">กำลังทหารประจำการ</label>
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={profile.garrisonSize ?? 0}
                        onChange={(e) =>
                          commitProfile({
                            ...profile,
                            garrisonSize: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full bg-[#0f1620] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      ระดับความแข็งแกร่งในการป้องกัน ({profile.defenseRating ?? 5}/10)
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={profile.defenseRating ?? 5}
                      onChange={(e) =>
                        commitProfile({ ...profile, defenseRating: Number(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">สไตล์สถาปัตยกรรมเมือง</label>
                    <select
                      value={profile.architectureStyle ?? 'medieval'}
                      onChange={(e) =>
                        commitProfile({ ...profile, architectureStyle: e.target.value })
                      }
                      className="w-full bg-[#0f1620] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    >
                      {ARCHITECTURE_STYLES.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {tab === 'demographics' && (
                <>
                  {/* Multi-Religion Mix */}
                  <div className="bg-[#151d28] border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-300">สัดส่วนศาสนาในเมือง</span>
                      <button
                        onClick={() =>
                          commitProfile({ ...profile, religionMix: normalizeMix(religionMix) })
                        }
                        className="text-[11px] text-amber-300 hover:underline cursor-pointer"
                      >
                        ปรับรวมเป็น 100%
                      </button>
                    </div>
                    {/* Stacked Bar */}
                    <div className="h-2.5 w-full rounded-full overflow-hidden bg-slate-900 flex">
                      {religionMix.map((sl) => {
                        const rel = map.religionList.find((r) => r.id === sl.id);
                        return (
                          <div
                            key={sl.id}
                            style={{
                              width: `${Math.max(0, sl.percent)}%`,
                              backgroundColor: rel?.color ?? '#94a3b8',
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="space-y-1.5">
                      {map.religionList.map((rel) => {
                        const existing = religionMix.find((x) => x.id === rel.id);
                        const pct = existing?.percent ?? 0;
                        return (
                          <div key={rel.id} className="flex items-center gap-2">
                            <span className="flex items-center gap-1 flex-1 truncate text-slate-200">
                              <span>{rel.symbol}</span>
                              <span className="truncate">{rel.name}</span>
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={pct}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                const filtered = religionMix.filter((x) => x.id !== rel.id);
                                const next = val > 0 ? [...filtered, { id: rel.id, percent: val }] : filtered;
                                commitProfile({ ...profile, religionMix: next });
                              }}
                              className="w-16 bg-[#0f1620] border border-slate-700 rounded px-2 py-0.5 text-right text-slate-100 outline-none"
                            />
                            <span className="text-slate-400">%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Multi-Culture Mix */}
                  <div className="bg-[#151d28] border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-teal-300">สัดส่วนวัฒนธรรมในเมือง</span>
                      <button
                        onClick={() =>
                          commitProfile({ ...profile, cultureMix: normalizeMix(cultureMix) })
                        }
                        className="text-[11px] text-amber-300 hover:underline cursor-pointer"
                      >
                        ปรับรวมเป็น 100%
                      </button>
                    </div>
                    <div className="h-2.5 w-full rounded-full overflow-hidden bg-slate-900 flex">
                      {cultureMix.map((sl) => {
                        const cult = (map.cultureList ?? []).find((c) => c.id === sl.id);
                        return (
                          <div
                            key={sl.id}
                            style={{
                              width: `${Math.max(0, sl.percent)}%`,
                              backgroundColor: cult?.color ?? '#2dd4bf',
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="space-y-1.5">
                      {(map.cultureList ?? []).map((cult) => {
                        const existing = cultureMix.find((x) => x.id === cult.id);
                        const pct = existing?.percent ?? 0;
                        return (
                          <div key={cult.id} className="flex items-center gap-2">
                            <span className="flex items-center gap-1 flex-1 truncate text-slate-200">
                              <span>{cult.symbol}</span>
                              <span className="truncate">{cult.name}</span>
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={pct}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                const filtered = cultureMix.filter((x) => x.id !== cult.id);
                                const next = val > 0 ? [...filtered, { id: cult.id, percent: val }] : filtered;
                                commitProfile({ ...profile, cultureMix: next });
                              }}
                              className="w-16 bg-[#0f1620] border border-slate-700 rounded px-2 py-0.5 text-right text-slate-100 outline-none"
                            />
                            <span className="text-slate-400">%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRegenerate()}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/50 text-purple-200 font-medium cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    อัปเดตวิหาร/สถาปัตยกรรมบนผังเมืองตามสัดส่วนใหม่
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
