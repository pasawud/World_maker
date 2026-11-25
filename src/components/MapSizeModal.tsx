import React, { useMemo, useState } from 'react';
import { Ruler, X } from 'lucide-react';
import { SCALE_PRESETS } from '../data/goods';
import { computeRealDimensions, SQRT3 } from '../engine/hexMath';
import { HexMapData } from '../types/map';

interface MapSizeModalProps {
  map: HexMapData;
  onApply: (width: number, height: number, hexSizeKm: number, mode: 'preserve' | 'regenerate') => void;
  onClose: () => void;
}

export const MapSizeModal: React.FC<MapSizeModalProps> = ({ map, onApply, onClose }) => {
  const [inputMode, setInputMode] = useState<'hex' | 'km'>('hex');
  const [width, setWidth] = useState(map.width);
  const [height, setHeight] = useState(map.height);
  const [hexSizeKm, setHexSizeKm] = useState(map.hexSizeKm);
  const [targetKmW, setTargetKmW] = useState(Math.round(map.width * map.hexSizeKm));
  const [targetKmH, setTargetKmH] = useState(
    Math.round(map.height * map.hexSizeKm * (SQRT3 / 2))
  );
  const [resizeMode, setResizeMode] = useState<'preserve' | 'regenerate'>('preserve');

  const computedHexW =
    inputMode === 'hex'
      ? Math.max(20, Math.min(300, Math.round(width)))
      : Math.max(20, Math.min(300, Math.round(targetKmW / Math.max(0.5, hexSizeKm))));

  const computedHexH =
    inputMode === 'hex'
      ? Math.max(20, Math.min(240, Math.round(height)))
      : Math.max(
          20,
          Math.min(240, Math.round(targetKmH / (Math.max(0.5, hexSizeKm) * (SQRT3 / 2))))
        );

  const previewDims = useMemo(
    () => computeRealDimensions(computedHexW, computedHexH, Math.max(0.5, hexSizeKm)),
    [computedHexW, computedHexH, hexSizeKm]
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141c27] border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <Ruler className="w-4 h-4" />
            ปรับขนาดแผนที่และระยะทางจริง
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {/* Scale Presets */}
          <div>
            <div className="text-[11px] text-slate-400 mb-1.5">สเกลมาตรฐาน</div>
            <div className="grid grid-cols-2 gap-2">
              {SCALE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setInputMode('hex');
                    setWidth(p.width);
                    setHeight(p.height);
                    setHexSizeKm(p.hexSizeKm);
                    setTargetKmW(Math.round(p.width * p.hexSizeKm));
                    setTargetKmH(Math.round(p.height * p.hexSizeKm * (SQRT3 / 2)));
                  }}
                  className="text-left p-2 rounded bg-[#0f1620] hover:bg-[#192332] border border-slate-800 hover:border-amber-500/50 transition cursor-pointer"
                >
                  <div className="font-semibold text-slate-200">{p.name}</div>
                  <div className="text-[11px] text-slate-400">{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Input mode tabs */}
          <div className="grid grid-cols-2 gap-1 bg-[#0f1620] p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setInputMode('hex')}
              className={`py-1.5 rounded text-xs font-medium cursor-pointer ${
                inputMode === 'hex' ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400'
              }`}
            >
              กำหนดจากจำนวนช่องหกเหลี่ยม
            </button>
            <button
              onClick={() => setInputMode('km')}
              className={`py-1.5 rounded text-xs font-medium cursor-pointer ${
                inputMode === 'km' ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400'
              }`}
            >
              กำหนดจากขนาดจริง (กม. × กม.)
            </button>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              ระยะทางต่อ 1 ช่อง (กม.)
            </label>
            <input
              type="number"
              min={0.5}
              max={500}
              step={1}
              value={hexSizeKm}
              onChange={(e) => setHexSizeKm(Math.max(0.5, Number(e.target.value) || 1))}
              className="w-full bg-[#0f1620] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
            />
          </div>

          {inputMode === 'hex' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  ความกว้าง (20 – 300 ช่อง)
                </label>
                <input
                  type="number"
                  min={20}
                  max={300}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value) || 20)}
                  className="w-full bg-[#0f1620] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  ความสูง (20 – 240 ช่อง)
                </label>
                <input
                  type="number"
                  min={20}
                  max={240}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value) || 20)}
                  className="w-full bg-[#0f1620] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  ความกว้างโลกจริง (กม.)
                </label>
                <input
                  type="number"
                  min={50}
                  max={50000}
                  step={50}
                  value={targetKmW}
                  onChange={(e) => setTargetKmW(Number(e.target.value) || 50)}
                  className="w-full bg-[#0f1620] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  ความสูงโลกจริง (กม.)
                </label>
                <input
                  type="number"
                  min={50}
                  max={50000}
                  step={50}
                  value={targetKmH}
                  onChange={(e) => setTargetKmH(Number(e.target.value) || 50)}
                  className="w-full bg-[#0f1620] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                />
              </div>
            </div>
          )}

          {/* Live Readout */}
          <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">ขนาดกริดที่จะได้:</span>
              <span className="text-amber-300 font-semibold">
                {computedHexW} × {computedHexH} ช่อง ({previewDims.totalHexes.toLocaleString()} ช่อง)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">มิติระยะจริง:</span>
              <span className="text-sky-300 font-semibold">
                {Math.round(previewDims.widthKm).toLocaleString()} ×{' '}
                {Math.round(previewDims.heightKm).toLocaleString()} กม.
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">พื้นที่ต่อช่อง / พื้นที่รวม:</span>
              <span className="text-slate-200">
                {Math.round(previewDims.hexAreaKm2).toLocaleString()} ตร.กม. /{' '}
                {Math.round(previewDims.totalAreaKm2).toLocaleString()} ตร.กม.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="radio"
                checked={resizeMode === 'preserve'}
                onChange={() => setResizeMode('preserve')}
              />
              <span>เก็บภูมิประเทศและเมืองเดิมไว้ (ปรับสเกลระยะทาง)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="radio"
                checked={resizeMode === 'regenerate'}
                onChange={() => setResizeMode('regenerate')}
              />
              <span>สร้างโลกใหม่ตามขนาดใหม่</span>
            </label>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => {
              onApply(computedHexW, computedHexH, hexSizeKm, resizeMode);
              onClose();
            }}
            className="px-4 py-1.5 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold text-xs cursor-pointer"
          >
            ยืนยันขนาดแผนที่
          </button>
        </div>
      </div>
    </div>
  );
};
