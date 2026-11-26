import React, { useState } from 'react';
import { Globe2, Mountain, Sparkles, Swords, X } from 'lucide-react';
import {
  DEFAULT_WORLD_SIMULATION_OPTIONS,
  WorldSimulationOptions,
} from '../engine/worldSimulator';
import { HexMapData } from '../types/map';

interface WorldSimulateModalProps {
  map: HexMapData;
  onSimulate: (options: WorldSimulationOptions) => void;
  onClose: () => void;
}

export const WorldSimulateModal: React.FC<WorldSimulateModalProps> = ({
  map,
  onSimulate,
  onClose,
}) => {
  const [opts, setOpts] = useState<WorldSimulationOptions>(() => ({
    ...DEFAULT_WORLD_SIMULATION_OPTIONS,
    applyTectonics: (map.customTectonicPlates?.length ?? 0) >= 2 || (map.geography.tectonicStrength ?? 0) > 0,
    tectonicStrength: map.geography.tectonicStrength && map.geography.tectonicStrength > 0
      ? map.geography.tectonicStrength
      : 0.55,
  }));

  const applyPreset = (kind: 'all' | 'nature' | 'civilization') => {
    if (kind === 'all') {
      setOpts((o) => ({
        ...o,
        recomputeClimateBiomes: true,
        generateRivers: true,
        placeFeatures: true,
        placeCities: true,
        generatePolitics: true,
        generateRoadsAndTrade: true,
        placeChokepointPois: true,
        generateRegionLabels: true,
      }));
    } else if (kind === 'nature') {
      setOpts((o) => ({
        ...o,
        applyTectonics: true,
        recomputeClimateBiomes: true,
        generateRivers: true,
        placeFeatures: true,
        placeCities: false,
        generatePolitics: false,
        generateRoadsAndTrade: false,
        placeChokepointPois: false,
        generateRegionLabels: false,
      }));
    } else {
      setOpts((o) => ({
        ...o,
        applyTectonics: false,
        recomputeClimateBiomes: false,
        generateRivers: false,
        placeFeatures: false,
        placeCities: true,
        generatePolitics: true,
        generateRoadsAndTrade: true,
        placeChokepointPois: true,
        generateRegionLabels: true,
      }));
    }
  };

  const toggleItems: { key: keyof WorldSimulationOptions; label: string; desc: string }[] = [
    {
      key: 'applyTectonics',
      label: 'ธรณีแปรสัณฐาน (Tectonic Relief)',
      desc: 'ยกแนวเทือกเขา/ร่องลึก/ภูเขาไฟตามแผ่นเปลือกโลกบนแผนที่นี้',
    },
    {
      key: 'recomputeClimateBiomes',
      label: 'ภูมิอากาศและไบโอมจริง',
      desc: 'คำนวณอุณหภูมิ ลม Rain Shadow และไบโอมใหม่โดยคงรูปแผ่นดินเดิม',
    },
    {
      key: 'generateRivers',
      label: 'โครงข่ายแม่น้ำธรรมชาติ',
      desc: 'คำนวณแม่น้ำไหลจากยอดเขาลงทะเลสาบและมหาสมุทรตามความสูงปัจจุบัน',
    },
    {
      key: 'placeFeatures',
      label: 'ลักษณะพิเศษตามหลักภูมิศาสตร์',
      desc: 'วางสามเหลี่ยมปากแม่น้ำ ปะการัง ฟยอร์ด ป่าชายเลน โอเอซิส หน้าผา และภูเขาไฟ',
    },
    {
      key: 'placeCities',
      label: 'วางเมืองและตั้งชื่อตามวัฒนธรรม',
      desc: 'เลือกทำเลริมแม่น้ำ/ปากน้ำ/อ่าวที่อุดมสมบูรณ์ พร้อมสินค้าผลิต-ต้องการ',
    },
    {
      key: 'generatePolitics',
      label: 'เขตอาณาจักร ศาสนา และวัฒนธรรม',
      desc: 'ขยายพรมแดนตามภูมิประเทศ (เทือกเขา/แม่น้ำ/ถนน) จากเมืองทั้งหมด',
    },
    {
      key: 'generateRoadsAndTrade',
      label: 'ถนน เส้นทางเดินเรือ และเส้นทางการค้า',
      desc: 'เชื่อมโยงเมืองด้วยเส้นทางหลีกเลี่ยงภูเขาสูงและเส้นทางทะเลอัตโนมัติ',
    },
    {
      key: 'placeChokepointPois',
      label: 'ป้อมปราการและด่านตามจุดยุทธศาสตร์',
      desc: 'ตรวจจับช่องเขา คอคอด และช่องแคบ แล้ววางป้อม/ท่าเรืออัตโนมัติ',
    },
    {
      key: 'generateRegionLabels',
      label: 'ป้ายชื่ออาณาจักร เทือกเขา และทะเล',
      desc: 'จัดวางป้ายชื่อโค้งบนแผนที่ให้เหมาะสมกับพื้นที่จริง',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141c27] border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <h2 className="text-sm font-semibold text-amber-300">
              จำลองแผนที่ปัจจุบันครบทุกมิติอัตโนมัติ (Full Map Simulation)
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-slate-300">
              จำลองระบบธรรมชาติและอารยธรรมแบบเชื่อมโยงเป็นเหตุเป็นผล โดยยึด{' '}
              <span className="text-amber-300 font-semibold">โครงสร้างแผนที่ปัจจุบัน ({map.width} × {map.height})</span>{' '}
              ของคุณเป็นฐาน (กด Undo ย้อนกลับได้)
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 cursor-pointer"
              >
                <Globe2 className="w-3.5 h-3.5" /> เลือกครบทุกมิติ
              </button>
              <button
                type="button"
                onClick={() => applyPreset('nature')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-200 cursor-pointer"
              >
                <Mountain className="w-3.5 h-3.5" /> เฉพาะธรรมชาติ & ธรณี
              </button>
              <button
                type="button"
                onClick={() => applyPreset('civilization')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-200 cursor-pointer"
              >
                <Swords className="w-3.5 h-3.5" /> เฉพาะอารยธรรม & การเมือง
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {toggleItems.map((item) => {
              const checked = Boolean(opts[item.key]);
              return (
                <label
                  key={item.key}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition ${
                    checked
                      ? 'bg-amber-500/10 border-amber-500/45 text-slate-100'
                      : 'bg-[#0f1620] border-slate-800 text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setOpts({ ...opts, [item.key]: e.target.checked })}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-semibold text-[11px]">{item.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{item.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Numeric Tunings */}
          <div className="bg-[#0f1620] border border-slate-800 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
            <div>
              <div className="flex justify-between mb-1">
                <span>แรงธรณีแปรสัณฐาน</span>
                <span className="text-amber-300">{opts.tectonicStrength.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.2}
                step={0.05}
                disabled={!opts.applyTectonics}
                value={opts.tectonicStrength}
                onChange={(e) => setOpts({ ...opts, tectonicStrength: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>ความหนาแน่นลักษณะพิเศษ</span>
                <span className="text-emerald-300">{opts.featureDensity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.4}
                max={2.0}
                step={0.1}
                disabled={!opts.placeFeatures}
                value={opts.featureDensity}
                onChange={(e) => setOpts({ ...opts, featureDensity: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>จำนวนเมืองเป้าหมาย</span>
                <span className="text-sky-300">{opts.cityCount} เมือง</span>
              </div>
              <input
                type="range"
                min={2}
                max={16}
                step={1}
                disabled={!opts.placeCities}
                value={opts.cityCount}
                onChange={(e) => setOpts({ ...opts, cityCount: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          {opts.placeCities && map.cities.length > 0 && (
            <label className="flex items-center gap-2 text-slate-300 px-1 cursor-pointer">
              <input
                type="checkbox"
                checked={opts.preserveExistingCities}
                onChange={(e) => setOpts({ ...opts, preserveExistingCities: e.target.checked })}
              />
              <span>คงเมืองเดิมที่มีอยู่ ({map.cities.length} เมือง) แล้วเติมเพิ่มจนครบจำนวนเป้าหมาย</span>
            </label>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-end gap-2 bg-[#111822]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-[#182332] hover:bg-[#223044] text-slate-300 text-xs cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => {
              onSimulate(opts);
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#d99b38] hover:bg-[#e5aa46] text-[#0e141c] font-semibold text-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            เริ่มจำลองจากแผนที่ปัจจุบัน
          </button>
        </div>
      </div>
    </div>
  );
};
