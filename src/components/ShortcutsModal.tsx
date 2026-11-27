import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUT_ROWS: { keys: string; desc: string }[] = [
  { keys: '1', desc: 'โหมดดูแผนที่ / ลากเลื่อนมุมมอง' },
  { keys: '2', desc: 'เครื่องมือระบายภูมิประเทศ / ปั้นความสูง / ลักษณะพิเศษ' },
  { keys: 'B', desc: 'เครื่องมือระบายไบโอม' },
  { keys: '3', desc: 'วาดแม่น้ำ' },
  { keys: 'C', desc: 'วาด/ลบกระแสน้ำมหาสมุทร' },
  { keys: 'T', desc: 'สตูดิโอแผ่นเปลือกโลก (ลากย้ายแผ่น / หมุนทิศชนกัน-แยกตัว)' },
  { keys: '4', desc: 'วางหรือเลือกเมืองเพื่อดูเศรษฐกิจ/ผังเมือง 2D' },
  { keys: '5 / 6', desc: 'ระบายพรมแดนอาณาจักร (5) / เขตศาสนา (6)' },
  { keys: '7 / 8', desc: 'วาดถนน-เดินเรือ (7) / เชื่อมเส้นทางการค้า (8)' },
  { keys: '9 / 0', desc: 'วัดระยะทางจริง กม. (9) / วางจุดสำคัญ POI & ป้ายชื่อ (0)' },
  { keys: 'Space + ลาก / คลิกกลาง', desc: 'เลื่อนแผนที่ชั่วคราวโดยไม่ต้องสลับเครื่องมือ' },
  { keys: 'G', desc: 'เปิด/ปิดตารางหกเหลี่ยม (Hex Grid)' },
  { keys: 'Ctrl + K', desc: 'ค้นหาด่วน (เมือง อาณาจักร POI Wiki) และบุ๊กมาร์ก' },
  { keys: 'Ctrl + Z / Ctrl + Y', desc: 'ย้อนกลับ (Undo) / ทำซ้ำ (Redo)' },
  { keys: 'Esc', desc: 'ยกเลิกการลากเส้นทางหรือกลับสู่โหมดดูแผนที่' },
  { keys: '?', desc: 'เปิดหน้าต่างคีย์ลัดและวิธีใช้งานนี้' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141c27] border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            คีย์ลัดและการควบคุม (Keyboard Shortcuts)
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-1.5 max-h-[75vh] overflow-y-auto text-xs">
          {SHORTCUT_ROWS.map((row) => (
            <div
              key={row.keys}
              className="flex items-center justify-between gap-3 py-1.5 px-2.5 rounded bg-[#0f1620] border border-slate-800/80"
            >
              <span className="text-slate-200">{row.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-[#1b2535] border border-slate-600 text-amber-300 font-mono text-[11px] shrink-0">
                {row.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
