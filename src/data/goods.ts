import {
  CityTier,
  Culture,
  CultureType,
  CustomPoiType,
  GovernmentType,
  Kingdom,
  LandmassType,
  Religion,
  ReligionType,
  TradeGood,
  TravelSpeedId,
} from '../types/map';

export const DEFAULT_GOODS: TradeGood[] = [
  { id: 'wheat', name: 'ข้าวสาลีและธัญพืช', category: 'เกษตรกรรม', basePrice: 12, icon: '🌾' },
  { id: 'fish', name: 'ปลาและอาหารทะเล', category: 'ประมง', basePrice: 15, icon: '🐟' },
  { id: 'timber', name: 'ไม้ซุง', category: 'ป่าไม้', basePrice: 18, icon: '🪵' },
  { id: 'iron', name: 'แร่เหล็ก', category: 'เหมืองแร่', basePrice: 30, icon: '⛏️' },
  { id: 'gold', name: 'ทองคำ', category: 'โลหะมีค่า', basePrice: 120, icon: '🪙' },
  { id: 'salt', name: 'เกลือ', category: 'เหมืองแร่', basePrice: 22, icon: '🧂' },
  { id: 'spices', name: 'เครื่องเทศ', category: 'ของหายาก', basePrice: 65, icon: '🌶️' },
  { id: 'silk', name: 'ผ้าไหม', category: 'หัตถกรรม', basePrice: 75, icon: '🧵' },
  { id: 'leather', name: 'หนังสัตว์และขนสัตว์', category: 'ปศุสัตว์', basePrice: 28, icon: '🧥' },
  { id: 'wine', name: 'ไวน์และสุรา', category: 'เกษตรกรรม', basePrice: 38, icon: '🍷' },
  { id: 'gems', name: 'อัญมณี', category: 'โลหะมีค่า', basePrice: 150, icon: '💎' },
  { id: 'herbs', name: 'สมุนไพรรักษาโรค', category: 'ป่าไม้', basePrice: 42, icon: '🌿' },
  { id: 'marble', name: 'หินอ่อน', category: 'เหมืองแร่', basePrice: 45, icon: '🏛️' },
  { id: 'arcane', name: 'คริสตัลเวทมนตร์', category: 'เวทมนตร์', basePrice: 190, icon: '🔮' },
  { id: 'weapons', name: 'อาวุธและชุดเกราะ', category: 'หัตถกรรม', basePrice: 85, icon: '⚔️' },
  { id: 'tea', name: 'ใบชาและเครื่องดื่ม', category: 'เกษตรกรรม', basePrice: 34, icon: '🍵' },
];

export const GOVERNMENT_TYPES: { id: GovernmentType; label: string }[] = [
  { id: 'monarchy', label: 'ราชาธิปไตย' },
  { id: 'empire', label: 'จักรวรรดิ' },
  { id: 'republic', label: 'สาธารณรัฐ' },
  { id: 'federation', label: 'สหพันธรัฐการค้า' },
  { id: 'theocracy', label: 'เทวาธิปไตย (ศาสนาจักร)' },
  { id: 'city_state', label: 'นครรัฐอิสระ' },
  { id: 'tribal', label: 'สหพันธ์ชนเผ่า' },
];

export const DEFAULT_KINGDOMS: Kingdom[] = [
  { id: 'north', name: 'อาณาจักรแดนเหนือ', color: '#60a5fa', government: 'monarchy' },
  { id: 'central', name: 'จักรวรรดิกลาง', color: '#f59e0b', government: 'empire' },
  { id: 'coastal', name: 'สหพันธรัฐชายฝั่ง', color: '#34d399', government: 'federation' },
  { id: 'desert', name: 'นครรัฐทะเลทราย', color: '#f97316', government: 'city_state' },
  { id: 'independent', name: 'นครอิสระ', color: '#a78bfa', government: 'republic' },
];

export const RELIGION_TYPES: { id: ReligionType; label: string }[] = [
  { id: 'monotheism', label: 'เอกเทวนิยม' },
  { id: 'polytheism', label: 'พหุเทวนิยม' },
  { id: 'animism', label: 'วิญญาณนิยม / ธรรมชาติ' },
  { id: 'philosophy', label: 'ปรัชญา / ธรรมวิถี' },
  { id: 'arcane', label: 'ลัทธิเวทมนตร์ / ดาราศาสตร์' },
];

export const DEFAULT_RELIGIONS: Religion[] = [
  {
    id: 'solaris',
    name: 'ศาสนาแห่งสุริยเทพ',
    color: '#facc15',
    symbol: '☀️',
    type: 'monotheism',
    description: 'บูชาแสงสว่างและระเบียบแห่งสวรรค์',
  },
  {
    id: 'sylvan',
    name: 'ลัทธิจิตวิญญาณพงไพร',
    color: '#4ade80',
    symbol: '🌿',
    type: 'animism',
    description: 'เคารพวิญญาณแห่งผืนป่าและสายน้ำ',
  },
  {
    id: 'tideborn',
    name: 'ศาสนาทวยเทพแห่งสมุทร',
    color: '#38bdf8',
    symbol: '🔱',
    type: 'polytheism',
    description: 'ศรัทธาของชาวเรือและนครชายฝั่ง',
  },
  {
    id: 'iron_creed',
    name: 'ปรัชญาแห่งขุนเขาและเหล็กกล้า',
    color: '#f87171',
    symbol: '⚒️',
    type: 'philosophy',
    description: 'เน้นวินัย การสร้างสรรค์ และบรรพบุรุษ',
  },
  {
    id: 'astral',
    name: 'ภาคีดาราและอาร์เคน',
    color: '#c084fc',
    symbol: '✨',
    type: 'arcane',
    description: 'แสวงหาสัจธรรมผ่านดวงดาวและมานา',
  },
];

export const CULTURE_TYPES: { id: CultureType; label: string }[] = [
  { id: 'agrarian', label: 'เกษตรกรรม / ลุ่มน้ำ' },
  { id: 'maritime', label: 'ชาวทะเล / นักเดินเรือ' },
  { id: 'nomadic', label: 'เร่ร่อน / ทุ่งกว้าง' },
  { id: 'highland', label: 'ชาวขุนเขา / ที่ราบสูง' },
  { id: 'mercantile', label: 'พ่อค้า / นครการค้า' },
  { id: 'scholarly', label: 'ปราชญ์ / อารยธรรมโบราณ' },
  { id: 'martial', label: 'นักรบ / ชายแดน' },
];

export const DEFAULT_CULTURES: Culture[] = [
  {
    id: 'nordic',
    name: 'ชาวอุดรผู้แกร่งกล้า',
    color: '#38bdf8',
    symbol: '🛡️',
    type: 'martial',
    description: 'วัฒนธรรมนักรบแห่งแดนหนาวและป้อมปราการ',
  },
  {
    id: 'valerian',
    name: 'อารยธรรมลุ่มน้ำหลวง',
    color: '#fbbf24',
    symbol: '🏛️',
    type: 'agrarian',
    description: 'ผู้รุ่งเรืองด้านเกษตรกรรม สถาปัตยกรรม และการปกครอง',
  },
  {
    id: 'thalassian',
    name: 'ชาวนาวีแห่งท้องทะเล',
    color: '#2dd4bf',
    symbol: '⚓',
    type: 'maritime',
    description: 'นักเดินเรือ พ่อค้าทางทะเล และชาวหมู่เกาะ',
  },
  {
    id: 'sunstrider',
    name: 'ชนเผ่าทะเลทรายสุริยัน',
    color: '#fb923c',
    symbol: '🐪',
    type: 'nomadic',
    description: 'กองคาราวานข้ามทะเลทรายและทุ่งสะวันนา',
  },
  {
    id: 'highborn',
    name: 'ชาวศิลาแห่งขุนเขา',
    color: '#e879f9',
    symbol: '⛰️',
    type: 'highland',
    description: 'ช่างตีเหล็กและผู้พิทักษ์ป้อมผาสูง',
  },
];

export const CITY_TIERS: { id: CityTier; label: string; defaultPop: number }[] = [
  { id: 'village', label: 'หมู่บ้าน', defaultPop: 1200 },
  { id: 'town', label: 'เมืองเล็ก', defaultPop: 6500 },
  { id: 'city', label: 'เมืองใหญ่', defaultPop: 24000 },
  { id: 'capital', label: 'เมืองหลวง', defaultPop: 85000 },
  { id: 'port', label: 'เมืองท่า', defaultPop: 19000 },
];

export const POI_TYPES: CustomPoiType[] = [
  { id: 'ruins', label: 'ซากปรักหักพัง', symbol: '🏚️', color: '#cbd5e1' },
  { id: 'fortress', label: 'ป้อมปราการ', symbol: '🏰', color: '#f87171' },
  { id: 'mine', label: 'เหมืองแร่', symbol: '⛏️', color: '#fbbf24' },
  { id: 'old_port', label: 'ท่าเรือเก่า', symbol: '⚓', color: '#38bdf8' },
  { id: 'monolith', label: 'เสาหินโบราณ', symbol: '🪨', color: '#a78bfa' },
  { id: 'dungeon', label: 'ดันเจี้ยน', symbol: '💀', color: '#e879f9' },
  { id: 'tower', label: 'หอคอยเวทมนตร์', symbol: '🗼', color: '#60a5fa' },
];

export function getAllPoiTypes(customPoiTypes?: CustomPoiType[]): CustomPoiType[] {
  if (!customPoiTypes || customPoiTypes.length === 0) return POI_TYPES;
  return [...POI_TYPES, ...customPoiTypes.map((p) => ({ ...p, isCustom: true }))];
}

export interface ScalePreset {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  hexSizeKm: number;
}

export const SCALE_PRESETS: ScalePreset[] = [
  {
    id: 'island',
    name: 'เกาะ / แคว้นเล็ก',
    description: '80 × 56 ช่อง · ช่องละ 5 กม.',
    width: 80,
    height: 56,
    hexSizeKm: 5,
  },
  {
    id: 'kingdom',
    name: 'อาณาจักรมาตรฐาน',
    description: '120 × 80 ช่อง · ช่องละ 20 กม.',
    width: 120,
    height: 80,
    hexSizeKm: 20,
  },
  {
    id: 'continent',
    name: 'ทวีปขนาดใหญ่',
    description: '180 × 120 ช่อง · ช่องละ 30 กม.',
    width: 180,
    height: 120,
    hexSizeKm: 30,
  },
  {
    id: 'world',
    name: 'โลกทั้งใบ (Bazaar Scale)',
    description: '240 × 156 ช่อง · ช่องละ 50 กม.',
    width: 240,
    height: 156,
    hexSizeKm: 50,
  },
];

export const LANDMASS_PRESETS: { id: LandmassType; label: string; desc: string }[] = [
  { id: 'continent', label: 'ทวีปเดี่ยว', desc: 'แผ่นดินใหญ่ตรงกลาง ล้อมรอบด้วยมหาสมุทร' },
  { id: 'twin', label: 'สองทวีป', desc: 'ทวีปตะวันตก-ตะวันออก คั่นด้วยช่องแคบ' },
  { id: 'archipelago', label: 'หมู่เกาะ', desc: 'เกาะใหญ่น้อยกระจายตัว เหมาะกับการเดินเรือ' },
  { id: 'pangaea', label: 'มหาทวีป (Pangaea)', desc: 'แผ่นดินกว้างใหญ่ต่อเนื่อง มียอดเขาแกนกลาง' },
  { id: 'inland_sea', label: 'ทะเลในทวีป', desc: 'แผ่นดินโอบล้อมทะเลปิดตรงกลาง' },
  { id: 'coastal', label: 'ชายฝั่งตะวันตก', desc: 'แผ่นดินใหญ่ฝั่งตะวันออก ทะเลกว้างฝั่งตะวันตก' },
];

export const TRAVEL_SPEEDS: { id: TravelSpeedId; label: string; kmPerDay: number; icon: string }[] = [
  { id: 'foot', label: 'เดินเท้า / กองทัพ', kmPerDay: 30, icon: '🥾' },
  { id: 'caravan', label: 'กองเกวียนสินค้า', kmPerDay: 25, icon: '🐪' },
  { id: 'horse', label: 'ม้าเร็ว / ผู้ส่งสาร', kmPerDay: 65, icon: '🐎' },
  { id: 'ship', label: 'เรือใบเดินสมุทร', kmPerDay: 140, icon: '⛵' },
];
