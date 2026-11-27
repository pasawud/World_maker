import React, { useEffect, useRef, useState } from 'react';
import { Crop, Crown, Eye, Image, Layers, MousePointerSquareDashed, Sparkles, Upload, X } from 'lucide-react';
import { convertHeightmapPixelsToMap } from '../engine/heightmap';
import { computeKingdomBounds, extractRegionalSubMap } from '../engine/submap';
import { saveMapToLibrary } from '../engine/serialization';
import { HexMapData, ReferenceOverlayConfig, SubMapBounds } from '../types/map';

interface HeightmapSubMapModalProps {
  map: HexMapData;
  initialTab?: 'heightmap' | 'submap';
  initialBounds?: SubMapBounds | null;
  referenceOverlay: ReferenceOverlayConfig | null;
  onChangeReferenceOverlay: (cfg: ReferenceOverlayConfig | null) => void;
  onReplaceMap: (nextMap: HexMapData) => void;
  onRegisterChildSubMap?: (sub: {
    id: string;
    name: string;
    bounds: SubMapBounds;
    scaleFactor: number;
  }) => void;
  onStartCanvasSelectZone?: () => void;
  onNotify: (msg: string) => void;
  onClose: () => void;
}

export const HeightmapSubMapModal: React.FC<HeightmapSubMapModalProps> = ({
  map,
  initialTab = 'heightmap',
  initialBounds = null,
  referenceOverlay,
  onChangeReferenceOverlay,
  onReplaceMap,
  onRegisterChildSubMap,
  onStartCanvasSelectZone,
  onNotify,
  onClose,
}) => {
  const [tab, setTab] = useState<'heightmap' | 'submap'>(initialTab);

  // Heightmap / Image Trace state
  const fileRef = useRef<HTMLInputElement>(null);
  const miniMapRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<{ q: number; r: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    referenceOverlay?.imageDataUrl ?? null
  );
  const [seaCutoff, setSeaCutoff] = useState(0.38);
  const [elevScale, setElevScale] = useState(1.0);
  const [invertHeight, setInvertHeight] = useState(false);
  const [targetW, setTargetW] = useState(map.width);
  const [targetH, setTargetH] = useState(map.height);

  // Regional Sub-Map state
  const [minQ, setMinQ] = useState(
    initialBounds?.minQ ?? Math.max(0, Math.floor(map.width * 0.25))
  );
  const [maxQ, setMaxQ] = useState(
    initialBounds?.maxQ ?? Math.min(map.width - 1, Math.floor(map.width * 0.75))
  );
  const [minR, setMinR] = useState(
    initialBounds?.minR ?? Math.max(0, Math.floor(map.height * 0.25))
  );
  const [maxR, setMaxR] = useState(
    initialBounds?.maxR ?? Math.min(map.height - 1, Math.floor(map.height * 0.75))
  );
  const [scaleFactor, setScaleFactor] = useState<2 | 3 | 4 | 6>(2);
  const [subMapName, setSubMapName] = useState(`${map.name} (ภูมิภาค)`);

  useEffect(() => {
    if (initialBounds) {
      setMinQ(initialBounds.minQ);
      setMaxQ(initialBounds.maxQ);
      setMinR(initialBounds.minR);
      setMaxR(initialBounds.maxR);
      setTab('submap');
    }
  }, [initialBounds]);

  useEffect(() => {
    if (tab !== 'submap') return;
    const canvas = miniMapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#0c1829';
    ctx.fillRect(0, 0, cw, ch);

    const kColors = new Map(map.kingdoms.map((k) => [k.id, k.color]));
    const cellW = cw / Math.max(1, map.width);
    const cellH = ch / Math.max(1, map.height);
    const stepQ = Math.max(1, Math.floor(map.width / cw));
    const stepR = Math.max(1, Math.floor(map.height / ch));
    const drawW = Math.max(1, Math.ceil(cellW * stepQ));
    const drawH = Math.max(1, Math.ceil(cellH * stepR));

    for (let r = 0; r < map.height; r += stepR) {
      for (let q = 0; q < map.width; q += stepQ) {
        const idx = r * map.width + q;
        const elev = map.elevation[idx] ?? 0;
        if (elev <= 0.01) {
          ctx.fillStyle = elev > -0.1 ? '#1e4e79' : '#12304f';
        } else if (elev > 0.68) {
          ctx.fillStyle = '#d1d5db';
        } else if (elev > 0.45) {
          ctx.fillStyle = '#6d6253';
        } else {
          ctx.fillStyle = '#3f6a46';
        }
        ctx.fillRect(q * cellW, r * cellH, drawW, drawH);

        const owner = map.territories?.[idx];
        const kc = owner ? kColors.get(owner) : undefined;
        if (kc) {
          ctx.fillStyle = `${kc}55`;
          ctx.fillRect(q * cellW, r * cellH, drawW, drawH);
        }
      }
    }

    // Draw cities
    ctx.fillStyle = '#fbbf24';
    for (const c of map.cities) {
      ctx.beginPath();
      ctx.arc((c.q + 0.5) * cellW, (c.r + 0.5) * cellH, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dim outside selected box
    const x1 = minQ * cellW;
    const y1 = minR * cellH;
    const x2 = (maxQ + 1) * cellW;
    const y2 = (maxR + 1) * cellH;
    ctx.fillStyle = 'rgba(5, 10, 18, 0.58)';
    ctx.fillRect(0, 0, cw, y1);
    ctx.fillRect(0, y2, cw, ch - y2);
    ctx.fillRect(0, y1, x1, y2 - y1);
    ctx.fillRect(x2, y1, cw - x2, y2 - y1);

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.setLineDash([]);
  }, [tab, map, minQ, maxQ, minR, maxR]);

  const handleSelectImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConvertHeightmap = () => {
    if (!previewUrl) return;
    const img = new window.Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.min(1024, img.naturalWidth || 256);
      c.height = Math.min(1024, img.naturalHeight || 256);
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const converted = convertHeightmapPixelsToMap(
        imgData.data,
        c.width,
        c.height,
        targetW,
        targetH,
        map.hexSizeKm,
        {
          name: `${map.name} (จาก Heightmap)`,
          seaLevelThreshold: seaCutoff,
          elevationScale: elevScale,
          invert: invertHeight,
          geography: map.geography,
        }
      );
      onReplaceMap(converted);
      onNotify('แปลงภาพ Heightmap เป็นแผนที่โลกพร้อมภูมิอากาศเรียบร้อยแล้ว');
      onClose();
    };
    img.src = previewUrl;
  };

  const handleSetTraceOverlay = () => {
    if (!previewUrl) return;
    onChangeReferenceOverlay({
      imageDataUrl: previewUrl,
      opacity: referenceOverlay?.opacity ?? 0.42,
      visible: true,
    });
    onNotify('เปิดภาพร่างซ้อนทับบนแผนที่แล้ว (ใช้วาดลอกลายด้วยพู่กันได้เลย)');
    onClose();
  };

  const handleCreateSubMap = () => {
    const bounds: SubMapBounds = {
      minQ: Math.min(minQ, maxQ - 4),
      maxQ: Math.max(maxQ, minQ + 4),
      minR: Math.min(minR, maxR - 4),
      maxR: Math.max(maxR, minR + 4),
    };
    const sub = extractRegionalSubMap(map, bounds, scaleFactor, subMapName);
    const linkedChild: HexMapData = {
      ...sub,
      parentMapLink: {
        parentMapId: map.id,
        parentMapName: map.name,
        bounds,
        scaleFactor,
      },
    };
    const subLink = { id: linkedChild.id, name: linkedChild.name, bounds, scaleFactor };
    const updatedParent: HexMapData = {
      ...map,
      childSubMaps: [...(map.childSubMaps ?? []).filter((c) => c.id !== subLink.id), subLink],
    };
    saveMapToLibrary(updatedParent);
    saveMapToLibrary(linkedChild);
    onRegisterChildSubMap?.(subLink);
    onReplaceMap(linkedChild);
    onNotify(`สร้างแผนที่ภูมิภาค "${linkedChild.name}" (${linkedChild.width}×${linkedChild.height}) แล้ว (เชื่อมโยงกลับแผนที่หลักแล้ว)`);
    onClose();
  };

  const spanW = Math.max(5, Math.abs(maxQ - minQ) + 1);
  const spanH = Math.max(5, Math.abs(maxR - minR) + 1);
  const estOutW = Math.min(280, spanW * scaleFactor);
  const estOutH = Math.min(220, spanH * scaleFactor);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141c27] border border-slate-700 rounded-xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            นำเข้า Heightmap / ภาพลอกลาย & เจาะแผนที่ภูมิภาค
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-2 border-b border-slate-800 flex gap-3 text-xs">
          <button
            onClick={() => setTab('heightmap')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 cursor-pointer ${
              tab === 'heightmap'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Image className="w-3.5 h-3.5" />
            นำเข้า Heightmap / ภาพลอกลาย
          </button>
          <button
            onClick={() => setTab('submap')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 cursor-pointer ${
              tab === 'submap'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crop className="w-3.5 h-3.5" />
            เจาะแผนที่ภูมิภาค (Sub-Map)
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-xs space-y-4">
          {tab === 'heightmap' ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleSelectImage}
                className="hidden"
              />
              <div className="bg-[#0f1620] border border-dashed border-slate-700 rounded-lg p-4 text-center space-y-2.5">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Heightmap preview"
                    className="max-h-44 mx-auto rounded border border-slate-700 object-contain"
                  />
                ) : (
                  <div className="text-slate-400 py-4">
                    อัปโหลดภาพ Heightmap ขาว-ดำ หรือภาพสเก็ตช์แผนที่ที่วาดไว้
                  </div>
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#1d2735] hover:bg-[#263447] border border-slate-600 text-slate-100 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-sky-400" />
                  {previewUrl ? 'เปลี่ยนรูปภาพ...' : 'เลือกไฟล์รูปภาพ (.png / .jpg)...'}
                </button>
              </div>

              <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      ความสว่างระดับน้ำทะเล ({Math.round(seaCutoff * 100)}%)
                    </label>
                    <input
                      type="range"
                      min={0.1}
                      max={0.85}
                      step={0.02}
                      value={seaCutoff}
                      onChange={(e) => setSeaCutoff(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      ความสูงเทือกเขา ({elevScale.toFixed(1)}x)
                    </label>
                    <input
                      type="range"
                      min={0.5}
                      max={1.6}
                      step={0.1}
                      value={elevScale}
                      onChange={(e) => setElevScale(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invertHeight}
                      onChange={(e) => setInvertHeight(e.target.checked)}
                    />
                    <span>กลับสีสว่าง/มืด (สำหรับภาพเส้นดำบนพื้นขาว)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">ขนาดผลลัพธ์:</span>
                    <input
                      type="number"
                      min={10}
                      max={1200}
                      value={targetW}
                      onChange={(e) => setTargetW(Number(e.target.value))}
                      className="w-16 bg-[#161f2c] border border-slate-700 rounded px-1.5 py-0.5"
                    />
                    <span>×</span>
                    <input
                      type="number"
                      min={10}
                      max={1200}
                      value={targetH}
                      onChange={(e) => setTargetH(Number(e.target.value))}
                      className="w-16 bg-[#161f2c] border border-slate-700 rounded px-1.5 py-0.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    disabled={!previewUrl}
                    onClick={handleConvertHeightmap}
                    className="flex items-center justify-center gap-1.5 py-2 rounded bg-[#d99b38] hover:bg-[#e5aa46] disabled:opacity-40 text-[#0e141c] font-semibold cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    แปลงเป็นแผนที่อัตโนมัติทันที
                  </button>
                  <button
                    disabled={!previewUrl}
                    onClick={handleSetTraceOverlay}
                    className="flex items-center justify-center gap-1.5 py-2 rounded bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-40 border border-sky-400/50 text-sky-200 font-medium cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    ซ้อนเป็นภาพร่างลอกลาย
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-slate-300">
                    ลากกรอบบนแผนที่จำลองด้านล่าง หรือเลือกจากอาณาจักร ({map.width} × {map.height})
                    <span className="block text-[11px] text-emerald-300/90 mt-0.5">
                      * ระบบจะบันทึกแผนที่โลกหลักลงใน "คลังในเครื่อง" ให้อัตโนมัติก่อนเปิด Sub-Map
                    </span>
                  </div>
                  {onStartCanvasSelectZone && (
                    <button
                      type="button"
                      onClick={() => {
                        onStartCanvasSelectZone();
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-200 text-[11px] font-medium cursor-pointer"
                    >
                      <MousePointerSquareDashed className="w-3.5 h-3.5" />
                      ลากกรอบบนแผนที่ใหญ่โดยตรง
                    </button>
                  )}
                </div>

                {/* Interactive Mini-Map Drag Crop */}
                <div className="flex flex-col items-center gap-1.5">
                  <canvas
                    ref={miniMapRef}
                    width={460}
                    height={Math.max(150, Math.min(240, Math.round((460 * map.height) / Math.max(1, map.width))))}
                    onMouseDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const q = Math.max(0, Math.min(map.width - 1, Math.floor(((e.clientX - rect.left) / rect.width) * map.width)));
                      const r = Math.max(0, Math.min(map.height - 1, Math.floor(((e.clientY - rect.top) / rect.height) * map.height)));
                      dragStartRef.current = { q, r };
                    }}
                    onMouseMove={(e) => {
                      if (!dragStartRef.current) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const q = Math.max(0, Math.min(map.width - 1, Math.floor(((e.clientX - rect.left) / rect.width) * map.width)));
                      const r = Math.max(0, Math.min(map.height - 1, Math.floor(((e.clientY - rect.top) / rect.height) * map.height)));
                      const sq = dragStartRef.current.q;
                      const sr = dragStartRef.current.r;
                      const q1 = Math.min(sq, q);
                      const q2 = Math.max(q1 + 5, Math.max(sq, q));
                      const r1 = Math.min(sr, r);
                      const r2 = Math.max(r1 + 5, Math.max(sr, r));
                      setMinQ(Math.min(map.width - 6, q1));
                      setMaxQ(Math.min(map.width - 1, q2));
                      setMinR(Math.min(map.height - 6, r1));
                      setMaxR(Math.min(map.height - 1, r2));
                    }}
                    onMouseUp={() => {
                      dragStartRef.current = null;
                    }}
                    onMouseLeave={() => {
                      dragStartRef.current = null;
                    }}
                    className="w-full max-w-[460px] rounded border border-slate-700 cursor-crosshair select-none"
                    title="คลิกลากเพื่อเลือกโซนสำหรับเจาะ Sub-Map"
                  />
                  {map.kingdoms.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Crown className="w-3 h-3 text-amber-400" /> เลือกตามอาณาจักร:
                      </span>
                      {map.kingdoms.map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => {
                            const b = computeKingdomBounds(map, k.id, 4);
                            if (!b) {
                              onNotify(`อาณาจักร "${k.name}" ยังไม่มีอาณาเขตหรือเมืองบนแผนที่`);
                              return;
                            }
                            setMinQ(b.minQ);
                            setMaxQ(b.maxQ);
                            setMinR(b.minR);
                            setMaxR(b.maxR);
                            setSubMapName(`${k.name} (ภูมิภาค)`);
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#161f2c] hover:bg-[#1e293b] border border-slate-700 text-[10px] text-slate-200 cursor-pointer"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: k.color }} />
                          {k.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      ขอบซ้าย q: {minQ} | ขอบขวา q: {maxQ}
                    </label>
                    <div className="flex gap-1.5 mt-1">
                      <input
                        type="range"
                        min={0}
                        max={map.width - 8}
                        value={minQ}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMinQ(v);
                          if (maxQ <= v + 5) setMaxQ(Math.min(map.width - 1, v + 6));
                        }}
                        className="w-1/2"
                      />
                      <input
                        type="range"
                        min={6}
                        max={map.width - 1}
                        value={maxQ}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMaxQ(v);
                          if (minQ >= v - 5) setMinQ(Math.max(0, v - 6));
                        }}
                        className="w-1/2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      ขอบบน r: {minR} | ขอบล่าง r: {maxR}
                    </label>
                    <div className="flex gap-1.5 mt-1">
                      <input
                        type="range"
                        min={0}
                        max={map.height - 8}
                        value={minR}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMinR(v);
                          if (maxR <= v + 5) setMaxR(Math.min(map.height - 1, v + 6));
                        }}
                        className="w-1/2"
                      />
                      <input
                        type="range"
                        min={6}
                        max={map.height - 1}
                        value={maxR}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMaxR(v);
                          if (minR >= v - 5) setMinR(Math.max(0, v - 6));
                        }}
                        className="w-1/2"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ชื่อแผนที่ภูมิภาค</label>
                    <input
                      value={subMapName}
                      onChange={(e) => setSubMapName(e.target.value)}
                      className="w-full bg-[#161f2c] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ระดับการซูมขยาย</label>
                    <div className="grid grid-cols-4 gap-1">
                      {([2, 3, 4, 6] as const).map((sf) => (
                        <button
                          key={sf}
                          onClick={() => setScaleFactor(sf)}
                          className={`py-1.5 rounded border text-[11px] cursor-pointer ${
                            scaleFactor === sf
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                              : 'bg-[#161f2c] border-slate-700 text-slate-400'
                          }`}
                        >
                          {sf}x ({Math.max(0.5, map.hexSizeKm / sf).toFixed(1)} กม.)
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-[#151e2b] rounded px-2.5 py-1.5">
                  ขนาดพื้นที่ที่เลือก: {spanW} × {spanH} ช่อง → แผนที่ใหม่ขนาดประมาณ{' '}
                  <span className="text-amber-300 font-semibold">
                    {estOutW} × {estOutH} ช่อง
                  </span>
                </div>

                <button
                  onClick={handleCreateSubMap}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                >
                  <Crop className="w-4 h-4" />
                  สร้างและเปิดแผนที่ภูมิภาค (Sub-Map)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
