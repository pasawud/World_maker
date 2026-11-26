import React, { useState } from 'react';
import {
  MapPin,
  Mountain,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { BIOME_DETAIL_STYLES } from '../data/biomes';
import { FEATURE_VISUAL_STYLES, SPECIAL_FEATURES } from '../data/features';
import { TERRAIN_RELIEF_STYLES, TERRAINS } from '../data/terrains';
import { formatElevationMeters } from '../engine/elevation';
import {
  BiomeDetailStyle,
  CustomBiome,
  CustomPoiType,
  CustomTerrain,
  FeatureVisualStyle,
  SpecialFeatureMeta,
  TerrainReliefStyle,
  TradeGood,
} from '../types/map';

export type CustomStudioTab = 'terrains' | 'biomes' | 'features' | 'pois';

interface CustomAssetsModalProps {
  customTerrains: CustomTerrain[];
  customBiomes: CustomBiome[];
  customFeatures: SpecialFeatureMeta[];
  terrainOverrides: Record<number, Partial<Omit<CustomTerrain, 'id'>>>;
  featureOverrides: Record<string, Partial<Omit<SpecialFeatureMeta, 'id'>>>;
  customPoiTypes: CustomPoiType[];
  goods: TradeGood[];
  initialTab?: CustomStudioTab;
  onAddTerrain: (t: Omit<CustomTerrain, 'id'>) => void;
  onUpdateTerrain: (id: number, patch: Partial<Omit<CustomTerrain, 'id'>>) => void;
  onDeleteTerrain: (id: number) => void;
  onSetTerrainOverride: (id: number, patch: Partial<Omit<CustomTerrain, 'id'>>) => void;
  onResetTerrainOverride: (id: number) => void;
  onAddBiome: (b: Omit<CustomBiome, 'id'>) => void;
  onUpdateBiome: (id: number, patch: Partial<Omit<CustomBiome, 'id'>>) => void;
  onDeleteBiome: (id: number) => void;
  onAddFeature: (f: Omit<SpecialFeatureMeta, 'id'>) => void;
  onUpdateFeature: (id: string, patch: Partial<Omit<SpecialFeatureMeta, 'id'>>) => void;
  onDeleteFeature: (id: string) => void;
  onSetFeatureOverride: (id: string, patch: Partial<Omit<SpecialFeatureMeta, 'id'>>) => void;
  onResetFeatureOverride: (id: string) => void;
  onAddPoiType: (p: Omit<CustomPoiType, 'id'>) => void;
  onDeletePoiType: (id: string) => void;
  onClose: () => void;
}

export const CustomAssetsModal: React.FC<CustomAssetsModalProps> = ({
  customTerrains,
  customBiomes,
  customFeatures,
  terrainOverrides,
  featureOverrides,
  customPoiTypes,
  goods,
  initialTab = 'terrains',
  onAddTerrain,
  onUpdateTerrain,
  onDeleteTerrain,
  onSetTerrainOverride,
  onResetTerrainOverride,
  onAddBiome,
  onUpdateBiome,
  onDeleteBiome,
  onAddFeature,
  onUpdateFeature,
  onDeleteFeature,
  onSetFeatureOverride,
  onResetFeatureOverride,
  onAddPoiType,
  onDeletePoiType,
  onClose,
}) => {
  const [tab, setTab] = useState<CustomStudioTab>(initialTab);

  // Terrain form state
  const [tEditingId, setTEditingId] = useState<number | null>(null);
  const [tName, setTName] = useState('');
  const [tColor, setTColor] = useState('#8d6e63');
  const [tIsWater, setTIsWater] = useState(false);
  const [tElev, setTElev] = useState(0.55);
  const [tMinElev, setTMinElev] = useState(0.42);
  const [tMaxElev, setTMaxElev] = useState(0.72);
  const [tMoveCost, setTMoveCost] = useState(3.2);
  const [tRelief, setTRelief] = useState<TerrainReliefStyle>('plateau');
  const [tDesc, setTDesc] = useState('');

  // Biome form state
  const [bEditingId, setBEditingId] = useState<number | null>(null);
  const [bName, setBName] = useState('');
  const [bColor, setBColor] = useState('#7c3aed');
  const [bIsWater, setBIsWater] = useState(false);
  const [bElev, setBElev] = useState(0.2);
  const [bMoveCost, setBMoveCost] = useState(1.6);
  const [bStyle, setBStyle] = useState<BiomeDetailStyle>('crystal');
  const [bGoods, setBGoods] = useState<string[]>([]);
  const [bDesc, setBDesc] = useState('');

  // Feature form state
  const [fEditingId, setFEditingId] = useState<string | null>(null);
  const [fName, setFName] = useState('');
  const [fColor, setFColor] = useState('#fb923c');
  const [fPlacement, setFPlacement] = useState<'land' | 'water' | 'coast' | 'any'>('land');
  const [fStyle, setFStyle] = useState<FeatureVisualStyle>('volcano');
  const [fSymbol, setFSymbol] = useState('🌋');
  const [fMoveDelta, setFMoveDelta] = useState(0.5);
  const [fGoods, setFGoods] = useState<string[]>(['gems']);
  const [fDesc, setFDesc] = useState('');

  // POI form state
  const [pLabel, setPLabel] = useState('');
  const [pSymbol, setPSymbol] = useState('⛩️');
  const [pColor, setPColor] = useState('#f472b6');

  const resetTerrainForm = () => {
    setTEditingId(null);
    setTName('');
    setTDesc('');
  };

  const handleSaveTerrain = () => {
    if (!tName.trim()) return;
    const minE = Math.min(tMinElev, tElev);
    const maxE = Math.max(tMaxElev, tElev);
    const payload: Omit<CustomTerrain, 'id'> = {
      nameTh: tName.trim(),
      color: tColor,
      isWater: tIsWater,
      defaultElevation: tIsWater ? -0.18 : tElev,
      minElevation: tIsWater ? -0.9 : Number(minE.toFixed(2)),
      maxElevation: tIsWater ? 0.02 : Number(maxE.toFixed(2)),
      moveCost: tIsWater ? 99 : Math.max(0.5, tMoveCost),
      reliefStyle: tRelief,
      description: tDesc.trim() || undefined,
    };
    if (tEditingId !== null) {
      onUpdateTerrain(tEditingId, payload);
    } else {
      onAddTerrain(payload);
    }
    resetTerrainForm();
  };

  const resetBiomeForm = () => {
    setBEditingId(null);
    setBName('');
    setBGoods([]);
    setBDesc('');
  };

  const handleSaveBiome = () => {
    if (!bName.trim()) return;
    const payload: Omit<CustomBiome, 'id'> = {
      nameTh: bName.trim(),
      color: bColor,
      isWater: bIsWater,
      defaultElevation: bIsWater ? -0.25 : bElev,
      moveCost: bIsWater ? 99 : Math.max(0.5, bMoveCost),
      detailStyle: bStyle,
      goodsBonus: bGoods,
      description: bDesc.trim() || undefined,
    };
    if (bEditingId !== null) {
      onUpdateBiome(bEditingId, payload);
    } else {
      onAddBiome(payload);
    }
    resetBiomeForm();
  };

  const resetFeatureForm = () => {
    setFEditingId(null);
    setFName('');
    setFGoods([]);
    setFDesc('');
  };

  const handleSaveFeature = () => {
    if (!fName.trim()) return;
    const payload: Omit<SpecialFeatureMeta, 'id'> = {
      nameTh: fName.trim(),
      color: fColor,
      placement: fPlacement,
      visualStyle: fStyle,
      symbol: fSymbol.trim() || '✨',
      moveCostDelta: fMoveDelta,
      goodsBonus: fGoods,
      description: fDesc.trim() || undefined,
      isCustom: true,
    };
    if (fEditingId !== null) {
      onUpdateFeature(fEditingId, payload);
    } else {
      onAddFeature(payload);
    }
    resetFeatureForm();
  };

  const handleCreatePoi = () => {
    if (!pLabel.trim()) return;
    onAddPoiType({
      label: pLabel.trim(),
      symbol: pSymbol.trim() || '📍',
      color: pColor,
    });
    setPLabel('');
  };

  const toggleGoodChip = (list: string[], setList: (next: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((g) => g !== id) : [...list, id]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141c27] border border-slate-700 rounded-xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            สตูดิโอปรับแต่งองค์ประกอบโลก (Custom Studio)
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-2 border-b border-slate-800 flex flex-wrap gap-2 text-xs">
          {[
            { id: 'terrains' as const, label: `ภูมิประเทศ (${TERRAINS.length + customTerrains.length})`, icon: <Mountain className="w-3.5 h-3.5" /> },
            { id: 'biomes' as const, label: `ไบโอมกำหนดเอง (${customBiomes.length})`, icon: <Palette className="w-3.5 h-3.5" /> },
            { id: 'features' as const, label: `ลักษณะพิเศษ (${SPECIAL_FEATURES.length + customFeatures.length})`, icon: <Sparkles className="w-3.5 h-3.5" /> },
            { id: 'pois' as const, label: `จุดสำคัญ (${customPoiTypes.length})`, icon: <MapPin className="w-3.5 h-3.5" /> },
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

        <div className="flex-1 overflow-y-auto p-4 text-xs space-y-4">
          {/* 1. TERRAINS TAB */}
          {tab === 'terrains' && (
            <>
              <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    {tEditingId !== null ? 'แก้ไขภูมิประเทศกำหนดเอง' : 'สร้างภูมิประเทศใหม่ (Custom Terrain)'}
                  </span>
                  {tEditingId !== null && (
                    <button onClick={resetTerrainForm} className="text-[11px] text-slate-400 hover:text-white cursor-pointer">
                      ยกเลิกการแก้ไข
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ชื่อภูมิประเทศ</label>
                    <input
                      value={tName}
                      onChange={(e) => setTName(e.target.value)}
                      placeholder="เช่น ที่ราบสูงโต๊ะ, หุบเหวลึก, แอ่งภูเขาไฟ..."
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ทรงนูน / รูปแบบวาดบนแผนที่</label>
                    <select
                      value={tRelief}
                      onChange={(e) => setTRelief(e.target.value as TerrainReliefStyle)}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2 py-1.5 text-slate-100 outline-none"
                    >
                      {TERRAIN_RELIEF_STYLES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.labelTh}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-[11px] text-slate-400 mb-1">คำอธิบาย</label>
                      <input
                        value={tDesc}
                        onChange={(e) => setTDesc(e.target.value)}
                        placeholder="ข้อมูลภูมิศาสตร์..."
                        className="w-full bg-[#161f2c] border border-slate-700 rounded px-2 py-1.5 text-slate-100 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">สี</label>
                      <input
                        type="color"
                        value={tColor}
                        onChange={(e) => setTColor(e.target.value)}
                        className="w-10 h-8 bg-transparent border border-slate-700 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-center">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tIsWater}
                      onChange={(e) => setTIsWater(e.target.checked)}
                    />
                    <span>เป็นพื้นน้ำ / ทะเล</span>
                  </label>
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      ความสูงมาตรฐาน: <span className="text-amber-300">{formatElevationMeters(tIsWater ? -0.18 : tElev)}</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={0.98}
                      step={0.02}
                      disabled={tIsWater}
                      value={tElev}
                      onChange={(e) => setTElev(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      ช่วงไล่ระดับ ({formatElevationMeters(tMinElev)} .. {formatElevationMeters(tMaxElev)})
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step={0.05}
                        min={-1}
                        max={1}
                        disabled={tIsWater}
                        value={tMinElev}
                        onChange={(e) => setTMinElev(Number(e.target.value))}
                        className="w-1/2 bg-[#161f2c] border border-slate-700 rounded px-1.5 py-0.5 text-[11px]"
                      />
                      <input
                        type="number"
                        step={0.05}
                        min={-1}
                        max={1}
                        disabled={tIsWater}
                        value={tMaxElev}
                        onChange={(e) => setTMaxElev(Number(e.target.value))}
                        className="w-1/2 bg-[#161f2c] border border-slate-700 rounded px-1.5 py-0.5 text-[11px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      ต้นทุนเดินทาง ({tMoveCost.toFixed(1)}x)
                    </label>
                    <input
                      type="range"
                      min={0.6}
                      max={50}
                      step={0.2}
                      disabled={tIsWater}
                      value={tMoveCost}
                      onChange={(e) => setTMoveCost(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveTerrain}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {tEditingId !== null ? 'บันทึกการแก้ไข' : 'สร้างภูมิประเทศและเลือกใช้ทันที'}
                </button>
              </div>

              {customTerrains.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    ภูมิประเทศกำหนดเองของคุณ
                  </div>
                  {customTerrains.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between bg-[#0f1620] border border-slate-800 rounded px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-4 h-4 rounded border border-white/25" style={{ backgroundColor: t.color }} />
                        <div>
                          <div className="font-semibold text-slate-100">{t.nameTh}</div>
                          <div className="text-[11px] text-slate-400">
                            {t.isWater ? 'พื้นน้ำ' : `${formatElevationMeters(t.defaultElevation)} · อุปสรรค ${t.moveCost}x`} ·{' '}
                            {TERRAIN_RELIEF_STYLES.find((s) => s.id === t.reliefStyle)?.labelTh ?? t.reliefStyle}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setTEditingId(t.id);
                            setTName(t.nameTh);
                            setTColor(t.color);
                            setTIsWater(t.isWater);
                            setTElev(t.defaultElevation);
                            setTMinElev(t.minElevation ?? t.defaultElevation - 0.15);
                            setTMaxElev(t.maxElevation ?? t.defaultElevation + 0.15);
                            setTMoveCost(t.moveCost);
                            setTRelief(t.reliefStyle);
                            setTDesc(t.description ?? '');
                          }}
                          className="p-1 text-slate-400 hover:text-amber-300 cursor-pointer"
                          title="แก้ไข"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTerrain(t.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                          title="ลบ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Built-in terrains live customization */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  ปรับแต่งภูมิประเทศพื้นฐาน (Built-in Terrains)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {TERRAINS.map((base) => {
                    const ov = terrainOverrides[base.id] ?? {};
                    const curName = ov.nameTh ?? base.nameTh;
                    const curColor = ov.color ?? base.color;
                    const curMove = ov.moveCost ?? base.moveCost;
                    const curElev = ov.defaultElevation ?? base.defaultElevation;
                    const isModified = Boolean(terrainOverrides[base.id]);
                    return (
                      <div
                        key={base.id}
                        className="bg-[#0f1620] border border-slate-800 rounded-lg p-2.5 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={curColor}
                            onChange={(e) => onSetTerrainOverride(base.id, { color: e.target.value })}
                            className="w-6 h-6 bg-transparent border border-slate-700 rounded cursor-pointer shrink-0"
                          />
                          <input
                            value={curName}
                            onChange={(e) => onSetTerrainOverride(base.id, { nameTh: e.target.value })}
                            className="flex-1 bg-[#161f2c] border border-slate-700/80 rounded px-2 py-0.5 text-slate-100 font-medium outline-none"
                          />
                          {isModified && (
                            <button
                              onClick={() => onResetTerrainOverride(base.id)}
                              className="p-1 text-amber-400 hover:text-white cursor-pointer"
                              title="คืนค่าเริ่มต้น"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {!base.isWater && (
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                            <label className="flex items-center justify-between gap-1">
                              <span>ความสูง: {formatElevationMeters(curElev)}</span>
                              <input
                                type="range"
                                min={0.02}
                                max={0.95}
                                step={0.02}
                                value={curElev}
                                onChange={(e) =>
                                  onSetTerrainOverride(base.id, { defaultElevation: Number(e.target.value) })
                                }
                                className="w-20"
                              />
                            </label>
                            <label className="flex items-center justify-between gap-1">
                              <span>อุปสรรค: {curMove.toFixed(1)}x</span>
                              <input
                                type="range"
                                min={0.5}
                                max={55}
                                step={0.5}
                                value={curMove}
                                onChange={(e) =>
                                  onSetTerrainOverride(base.id, { moveCost: Number(e.target.value) })
                                }
                                className="w-20"
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* 2. BIOMES TAB */}
          {tab === 'biomes' && (
            <>
              <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    {bEditingId !== null ? 'แก้ไขไบโอมกำหนดเอง' : 'เพิ่มไบโอมใหม่'}
                  </span>
                  {bEditingId !== null && (
                    <button onClick={resetBiomeForm} className="text-[11px] text-slate-400 hover:text-white cursor-pointer">
                      ยกเลิกการแก้ไข
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ชื่อไบโอม</label>
                    <input
                      value={bName}
                      onChange={(e) => setBName(e.target.value)}
                      placeholder="เช่น ป่าคริสตัล, แดนลาวา, ป่าเห็ด..."
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] text-slate-400 mb-1">ลวดลายพื้นผิว</label>
                      <select
                        value={bStyle}
                        onChange={(e) => setBStyle(e.target.value as BiomeDetailStyle)}
                        className="w-full bg-[#161f2c] border border-slate-700 rounded px-2 py-1.5 text-slate-100 outline-none"
                      >
                        {BIOME_DETAIL_STYLES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">สี</label>
                      <input
                        type="color"
                        value={bColor}
                        onChange={(e) => setBColor(e.target.value)}
                        className="w-10 h-8 bg-transparent border border-slate-700 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 items-center">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bIsWater}
                      onChange={(e) => setBIsWater(e.target.checked)}
                    />
                    <span>เป็นพื้นน้ำ / ทะเล</span>
                  </label>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">
                      ความสูง ({formatElevationMeters(bIsWater ? -0.25 : bElev)})
                    </label>
                    <input
                      type="range"
                      min={0.05}
                      max={0.9}
                      step={0.05}
                      disabled={bIsWater}
                      value={bElev}
                      onChange={(e) => setBElev(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">
                      ความยากเดินทาง ({bMoveCost.toFixed(1)}x)
                    </label>
                    <input
                      type="range"
                      min={0.8}
                      max={10}
                      step={0.2}
                      disabled={bIsWater}
                      value={bMoveCost}
                      onChange={(e) => setBMoveCost(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">ทรัพยากรแนะนำสำหรับเมืองในไบโอมนี้</label>
                  <div className="flex flex-wrap gap-1">
                    {goods.slice(0, 12).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGoodChip(bGoods, setBGoods, g.id)}
                        className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer ${
                          bGoods.includes(g.id)
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-[#161f2c] border-slate-700 text-slate-400'
                        }`}
                      >
                        {g.icon} {g.name}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  value={bDesc}
                  onChange={(e) => setBDesc(e.target.value)}
                  placeholder="บันทึก/คำอธิบายไบโอม (ไม่บังคับ)..."
                  className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                />

                <button
                  onClick={handleSaveBiome}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {bEditingId !== null ? 'บันทึกการแก้ไขไบโอม' : 'เพิ่มไบโอมและเลือกใช้ทันที'}
                </button>
              </div>

              <div className="space-y-1.5">
                {customBiomes.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    ยังไม่มีไบโอมกำหนดเอง — เพิ่มได้ด้านบน (เช่น ป่าเห็ดเรืองแสง ทุ่งคริสตัล แดนภูเขาไฟ)
                  </div>
                ) : (
                  customBiomes.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between bg-[#0f1620] border border-slate-800 rounded px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-4 h-4 rounded border border-white/25" style={{ backgroundColor: b.color }} />
                        <div>
                          <div className="font-semibold text-slate-100">{b.nameTh}</div>
                          <div className="text-[11px] text-slate-400">
                            {b.isWater ? 'พื้นน้ำ' : `พื้นดิน · อุปสรรค ${b.moveCost}x`} · ลาย:{' '}
                            {BIOME_DETAIL_STYLES.find((s) => s.id === b.detailStyle)?.label ?? b.detailStyle}
                            {b.goodsBonus?.length ? ` · ทรัพยากร ${b.goodsBonus.length} ชนิด` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setBEditingId(b.id);
                            setBName(b.nameTh);
                            setBColor(b.color);
                            setBIsWater(b.isWater);
                            setBElev(b.defaultElevation);
                            setBMoveCost(b.moveCost);
                            setBStyle(b.detailStyle);
                            setBGoods(b.goodsBonus ?? []);
                            setBDesc(b.description ?? '');
                          }}
                          className="p-1 text-slate-400 hover:text-amber-300 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteBiome(b.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                          title="ลบไบโอม"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* 3. FEATURES TAB */}
          {tab === 'features' && (
            <>
              <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    {fEditingId !== null ? 'แก้ไขลักษณะพิเศษกำหนดเอง' : 'สร้างลักษณะพิเศษใหม่ (Custom Feature)'}
                  </span>
                  {fEditingId !== null && (
                    <button onClick={resetFeatureForm} className="text-[11px] text-slate-400 hover:text-white cursor-pointer">
                      ยกเลิกการแก้ไข
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    value={fSymbol}
                    onChange={(e) => setFSymbol(e.target.value)}
                    className="bg-[#161f2c] border border-slate-700 rounded px-2 py-1.5 text-center text-sm"
                    title="สัญลักษณ์ / Emoji"
                  />
                  <input
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    placeholder="ชื่อ เช่น ประตูมิติ, เสาหินมนตรา, กระแสน้ำวน..."
                    className="sm:col-span-2 bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                  />
                  <input
                    type="color"
                    value={fColor}
                    onChange={(e) => setFColor(e.target.value)}
                    className="w-full h-8 bg-transparent border border-slate-700 rounded cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ตำแหน่งที่วางได้</label>
                    <select
                      value={fPlacement}
                      onChange={(e) =>
                        setFPlacement(e.target.value as 'land' | 'water' | 'coast' | 'any')
                      }
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2 py-1.5 text-slate-100 outline-none"
                    >
                      <option value="land">เฉพาะพื้นดิน (Land)</option>
                      <option value="coast">เฉพาะชายฝั่ง (Coast)</option>
                      <option value="water">เฉพาะผืนน้ำ (Water)</option>
                      <option value="any">วางได้ทุกที่ (Any)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">รูปแบบการวาดบนแผนที่</label>
                    <select
                      value={fStyle}
                      onChange={(e) => setFStyle(e.target.value as FeatureVisualStyle)}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2 py-1.5 text-slate-100 outline-none"
                    >
                      {FEATURE_VISUAL_STYLES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.labelTh}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      ปรับความเร็วเดินทาง ({fMoveDelta >= 0 ? `+${fMoveDelta.toFixed(1)}` : fMoveDelta.toFixed(1)})
                    </label>
                    <input
                      type="range"
                      min={-1}
                      max={8}
                      step={0.1}
                      value={fMoveDelta}
                      onChange={(e) => setFMoveDelta(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">โบนัสทรัพยากรเมือง</label>
                  <div className="flex flex-wrap gap-1">
                    {goods.slice(0, 12).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGoodChip(fGoods, setFGoods, g.id)}
                        className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer ${
                          fGoods.includes(g.id)
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-[#161f2c] border-slate-700 text-slate-400'
                        }`}
                      >
                        {g.icon} {g.name}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                  placeholder="บันทึกความสำคัญทางประวัติศาสตร์ / เวทมนตร์..."
                  className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                />

                <button
                  onClick={handleSaveFeature}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {fEditingId !== null ? 'บันทึกการแก้ไขลักษณะพิเศษ' : 'เพิ่มลักษณะพิเศษและเลือกใช้ทันที'}
                </button>
              </div>

              {customFeatures.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    ลักษณะพิเศษกำหนดเอง
                  </div>
                  {customFeatures.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between bg-[#0f1620] border border-slate-800 rounded px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-6 h-6 rounded flex items-center justify-center border"
                          style={{ borderColor: f.color, backgroundColor: `${f.color}22` }}
                        >
                          {f.symbol ?? '✨'}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-100">{f.nameTh}</div>
                          <div className="text-[11px] text-slate-400">
                            ตำแหน่ง: {f.placement} · เดินทาง {f.moveCostDelta >= 0 ? `+${f.moveCostDelta}` : f.moveCostDelta}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setFEditingId(f.id);
                            setFName(f.nameTh);
                            setFColor(f.color);
                            setFPlacement(f.placement);
                            setFStyle(f.visualStyle ?? 'custom');
                            setFSymbol(f.symbol ?? '✨');
                            setFMoveDelta(f.moveCostDelta);
                            setFGoods(f.goodsBonus ?? []);
                            setFDesc(f.description ?? '');
                          }}
                          className="p-1 text-slate-400 hover:text-amber-300 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteFeature(f.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Built-in features override */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  ปรับแต่งลักษณะพิเศษพื้นฐาน ({SPECIAL_FEATURES.length} รายการ)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {SPECIAL_FEATURES.map((base) => {
                    const ov = featureOverrides[base.id] ?? {};
                    const curName = ov.nameTh ?? base.nameTh;
                    const curColor = ov.color ?? base.color;
                    const curMove = ov.moveCostDelta ?? base.moveCostDelta;
                    const curPlace = ov.placement ?? base.placement;
                    const isMod = Boolean(featureOverrides[base.id]);
                    return (
                      <div
                        key={base.id}
                        className="bg-[#0f1620] border border-slate-800 rounded-lg p-2.5 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={curColor}
                            onChange={(e) => onSetFeatureOverride(base.id, { color: e.target.value })}
                            className="w-6 h-6 bg-transparent border border-slate-700 rounded cursor-pointer shrink-0"
                          />
                          <input
                            value={curName}
                            onChange={(e) => onSetFeatureOverride(base.id, { nameTh: e.target.value })}
                            className="flex-1 bg-[#161f2c] border border-slate-700/80 rounded px-2 py-0.5 text-slate-100 font-medium outline-none"
                          />
                          {isMod && (
                            <button
                              onClick={() => onResetFeatureOverride(base.id)}
                              className="p-1 text-amber-400 hover:text-white cursor-pointer"
                              title="คืนค่าเริ่มต้น"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                          <select
                            value={curPlace}
                            onChange={(e) =>
                              onSetFeatureOverride(base.id, {
                                placement: e.target.value as 'land' | 'water' | 'coast' | 'any',
                              })
                            }
                            className="bg-[#161f2c] border border-slate-700 rounded px-1.5 py-0.5 text-slate-200"
                          >
                            <option value="land">พื้นดิน</option>
                            <option value="coast">ชายฝั่ง</option>
                            <option value="water">ผืนน้ำ</option>
                            <option value="any">ทุกที่</option>
                          </select>
                          <label className="flex items-center gap-1">
                            <span>อุปสรรค: {curMove >= 0 ? `+${curMove.toFixed(1)}` : curMove.toFixed(1)}</span>
                            <input
                              type="range"
                              min={-0.8}
                              max={8}
                              step={0.1}
                              value={curMove}
                              onChange={(e) =>
                                onSetFeatureOverride(base.id, { moveCostDelta: Number(e.target.value) })
                              }
                              className="w-20"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* 4. POI TAB */}
          {tab === 'pois' && (
            <>
              <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-3">
                <div className="font-semibold text-slate-200">เพิ่มประเภทสถานที่น่าสนใจใหม่</div>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={pSymbol}
                    onChange={(e) => setPSymbol(e.target.value)}
                    className="w-12 text-center bg-[#161f2c] border border-slate-700 rounded px-1 py-1.5 text-base"
                    title="สัญลักษณ์ / Emoji"
                  />
                  <input
                    value={pLabel}
                    onChange={(e) => setPLabel(e.target.value)}
                    placeholder="ชื่อประเภท เช่น ศาลเจ้าโบราณ, ประตูมิติ, รังมังกร..."
                    className="flex-1 min-w-[180px] bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                  />
                  <input
                    type="color"
                    value={pColor}
                    onChange={(e) => setPColor(e.target.value)}
                    className="w-10 h-8 bg-transparent border border-slate-700 rounded cursor-pointer"
                  />
                  <button
                    onClick={handleCreatePoi}
                    className="flex items-center gap-1 px-4 py-1.5 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    เพิ่มสถานที่
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {customPoiTypes.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    ยังไม่มีสถานที่น่าสนใจกำหนดเอง
                  </div>
                ) : (
                  customPoiTypes.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between bg-[#0f1620] border border-slate-800 rounded px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center border"
                          style={{ borderColor: p.color }}
                        >
                          {p.symbol}
                        </span>
                        <span className="font-semibold text-slate-100">{p.label}</span>
                      </div>
                      <button
                        onClick={() => onDeletePoiType(p.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                        title="ลบประเภทสถานที่"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
