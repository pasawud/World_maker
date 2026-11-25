import React, { useState } from 'react';
import { MapPin, Palette, Plus, Trash2, X } from 'lucide-react';
import { BIOME_DETAIL_STYLES } from '../data/biomes';
import { BiomeDetailStyle, CustomBiome, CustomPoiType } from '../types/map';

interface CustomAssetsModalProps {
  customBiomes: CustomBiome[];
  customPoiTypes: CustomPoiType[];
  initialTab?: 'biomes' | 'pois';
  onAddBiome: (b: Omit<CustomBiome, 'id'>) => void;
  onDeleteBiome: (id: number) => void;
  onAddPoiType: (p: Omit<CustomPoiType, 'id'>) => void;
  onDeletePoiType: (id: string) => void;
  onClose: () => void;
}

export const CustomAssetsModal: React.FC<CustomAssetsModalProps> = ({
  customBiomes,
  customPoiTypes,
  initialTab = 'biomes',
  onAddBiome,
  onDeleteBiome,
  onAddPoiType,
  onDeletePoiType,
  onClose,
}) => {
  const [tab, setTab] = useState<'biomes' | 'pois'>(initialTab);

  // Biome form
  const [bName, setBName] = useState('');
  const [bColor, setBColor] = useState('#7c3aed');
  const [bIsWater, setBIsWater] = useState(false);
  const [bElev, setBElev] = useState(0.2);
  const [bMoveCost, setBMoveCost] = useState(1.6);
  const [bStyle, setBStyle] = useState<BiomeDetailStyle>('crystal');

  // POI form
  const [pLabel, setPLabel] = useState('');
  const [pSymbol, setPSymbol] = useState('⛩️');
  const [pColor, setPColor] = useState('#f472b6');

  const handleCreateBiome = () => {
    if (!bName.trim()) return;
    onAddBiome({
      nameTh: bName.trim(),
      color: bColor,
      isWater: bIsWater,
      defaultElevation: bIsWater ? -0.25 : bElev,
      moveCost: bIsWater ? 99 : Math.max(0.5, bMoveCost),
      detailStyle: bStyle,
    });
    setBName('');
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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141c27] border border-slate-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            สร้างไบโอม & สถานที่น่าสนใจกำหนดเอง (Custom)
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-2 border-b border-slate-800 flex gap-3 text-xs">
          <button
            onClick={() => setTab('biomes')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition cursor-pointer ${
              tab === 'biomes'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            ไบโอมกำหนดเอง ({customBiomes.length})
          </button>
          <button
            onClick={() => setTab('pois')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition cursor-pointer ${
              tab === 'pois'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            สถานที่น่าสนใจกำหนดเอง ({customPoiTypes.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-xs space-y-4">
          {tab === 'biomes' ? (
            <>
              <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-3">
                <div className="font-semibold text-slate-200">เพิ่มไบโอมใหม่</div>
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
                      ความสูง ({bElev.toFixed(2)})
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
                      ความยากในการเดินทาง ({bMoveCost.toFixed(1)}x)
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

                <button
                  onClick={handleCreateBiome}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  เพิ่มไบโอมและเลือกใช้ทันที
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
                        <span
                          className="w-4 h-4 rounded border border-white/25"
                          style={{ backgroundColor: b.color }}
                        />
                        <div>
                          <div className="font-semibold text-slate-100">{b.nameTh}</div>
                          <div className="text-[11px] text-slate-400">
                            {b.isWater ? 'พื้นน้ำ' : `พื้นดิน · อุปสรรค ${b.moveCost}x`} · ลาย:{' '}
                            {BIOME_DETAIL_STYLES.find((s) => s.id === b.detailStyle)?.label ?? b.detailStyle}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteBiome(b.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                        title="ลบไบโอม"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
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
