import React, { useRef, useState } from 'react';
import { Camera, Download, FolderOpen, Save, Trash2, Upload, X } from 'lucide-react';
import { exportMapToPng } from '../engine/renderer';
import {
  deleteMapFromLibrary,
  listSavedMaps,
  loadMapFromLibrary,
  parseMapFromJson,
  SavedMapSummary,
  saveMapToLibrary,
  serializeMapToJson,
} from '../engine/serialization';
import { ClimateOverlay, HexMapData, LayerVisibility } from '../types/map';

interface ExportImportModalProps {
  map: HexMapData;
  overlay: ClimateOverlay;
  layers: LayerVisibility;
  onImportMap: (m: HexMapData) => void;
  onClose: () => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  map,
  overlay,
  layers,
  onImportMap,
  onClose,
}) => {
  const [tab, setTab] = useState<'json' | 'png' | 'library'>('json');
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeScale, setIncludeScale] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [library, setLibrary] = useState<SavedMapSummary[]>(() => listSavedMaps());
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDownloadJson = () => {
    const json = serializeMapToJson(map);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${map.name.replace(/\s+/g, '_')}.hexworld.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice('ส่งออกไฟล์ JSON เรียบร้อยแล้ว');
  };

  const handleUploadJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const loaded = parseMapFromJson(text);
      onImportMap(loaded);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดไฟล์ได้');
    }
  };

  const handleDownloadPng = () => {
    const dataUrl = exportMapToPng(map, {
      overlay,
      layers,
      includeLegend,
      includeScale,
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${map.name.replace(/\s+/g, '_')}.png`;
    a.click();
    setNotice('บันทึกภาพแผนที่ PNG เรียบร้อยแล้ว');
  };

  const handleSaveToLibrary = () => {
    saveMapToLibrary(map);
    setLibrary(listSavedMaps());
    setNotice(`บันทึก "${map.name}" ลงในคลังแผนที่ในเครื่องแล้ว`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141c27] border border-slate-700 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            ส่งออก · โหลดไฟล์ · คลังแผนที่
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-2 border-b border-slate-800 flex gap-3 text-xs">
          {[
            { id: 'json', label: 'ไฟล์โปรเจกต์ (.json)' },
            { id: 'png', label: 'บันทึกภาพแผนที่ (.png)' },
            { id: 'library', label: `คลังในเครื่อง (${library.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id as typeof tab);
                setError(null);
                setNotice(null);
              }}
              className={`py-2 px-2 border-b-2 transition cursor-pointer ${
                tab === t.id
                  ? 'border-amber-400 text-amber-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 text-xs space-y-4">
          {error && (
            <div className="bg-rose-950/60 border border-rose-700 text-rose-200 px-3 py-2 rounded">
              {error}
            </div>
          )}
          {notice && (
            <div className="bg-emerald-950/60 border border-emerald-700 text-emerald-200 px-3 py-2 rounded">
              {notice}
            </div>
          )}

          {tab === 'json' && (
            <div className="space-y-3">
              <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="font-semibold text-slate-200">ส่งออกไฟล์แผนที่ฉบับสมบูรณ์</div>
                <p className="text-[11px] text-slate-400">
                  บันทึกข้อมูลภูมิประเทศ ความสูง อุณหภูมิ ความชื้น แม่น้ำ เมือง สินค้า เส้นทางการค้า ถนน และมาตราส่วนทั้งหมดเป็นไฟล์ `.hexworld.json`
                </p>
                <button
                  onClick={handleDownloadJson}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  ดาวน์โหลดไฟล์ JSON
                </button>
              </div>

              <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="font-semibold text-slate-200">โหลดแผนที่จากไฟล์ JSON</div>
                <p className="text-[11px] text-slate-400">
                  เลือกไฟล์ `.json` หรือ `.hexworld.json` ที่เคยส่งออกไว้เพื่อกลับมาแก้ไขต่อ
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleUploadJson}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#1e2938] hover:bg-[#273548] border border-slate-600 text-slate-100 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-sky-400" />
                  เลือกไฟล์จากเครื่อง...
                </button>
              </div>
            </div>
          )}

          {tab === 'png' && (
            <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-4 space-y-3">
              <div className="font-semibold text-slate-200">ส่งออกภาพแผนที่ความละเอียดสูง</div>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLegend}
                  onChange={(e) => setIncludeLegend(e.target.checked)}
                />
                <span>แสดงคำอธิบายสัญลักษณ์ภูมิประเทศ (Legend) ด้านขวา</span>
              </label>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeScale}
                  onChange={(e) => setIncludeScale(e.target.checked)}
                />
                <span>แสดงสเกลระยะทางจริง (กม.) และเข็มทิศ</span>
              </label>
              <button
                onClick={handleDownloadPng}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                สร้างและดาวน์โหลดภาพ PNG
              </button>
            </div>
          )}

          {tab === 'library' && (
            <div className="space-y-3">
              <button
                onClick={handleSaveToLibrary}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
              >
                <Save className="w-4 h-4" />
                บันทึกแผนที่ปัจจุบัน "{map.name}" ลงคลัง
              </button>

              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {library.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">ยังไม่มีแผนที่ที่บันทึกไว้ในคลัง</div>
                ) : (
                  library.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-[#0f1620] border border-slate-800 rounded px-3 py-2"
                    >
                      <div>
                        <div className="font-semibold text-slate-100">{item.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.width} × {item.height} ช่อง · {item.hexSizeKm} กม./ช่อง · {item.cityCount} เมือง
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const loaded = loadMapFromLibrary(item.id);
                            if (loaded) {
                              onImportMap(loaded);
                              onClose();
                            }
                          }}
                          className="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-500/50 text-amber-200 cursor-pointer"
                        >
                          เปิด
                        </button>
                        <button
                          onClick={() => {
                            deleteMapFromLibrary(item.id);
                            setLibrary(listSavedMaps());
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
