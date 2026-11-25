import {
  CityBuildingCategory,
  CityDistrictType,
  CityTier,
  Culture,
  CultureType,
  CustomCategoryType,
  CustomPoiType,
  GovernmentType,
  Kingdom,
  LandmassType,
  Religion,
  ReligionType,
  TimelineEventCategory,
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

export function getAllGovernmentTypes(
  customTypes?: CustomCategoryType[]
): { id: string; label: string; isCustom?: boolean }[] {
  const base = GOVERNMENT_TYPES.map((g) => ({ id: String(g.id), label: g.label }));
  if (!customTypes || customTypes.length === 0) return base;
  return [...base, ...customTypes.map((c) => ({ ...c, isCustom: true }))];
}

export const SUCCESSION_PRESETS: string[] = [
  'สืบสันตติวงศ์ทางสายเลือด',
  'เลือกตั้งโดยสภาขุนนาง / วุฒิสภา',
  'ประชามติ / สภาพลเมือง',
  'แต่งตั้งโดยองค์ประมุขศาสนา',
  'ประลองคัดเลือกผู้แข็งแกร่ง',
  'หมุนเวียนตามตระกูลพ่อค้า',
];

export const DEFAULT_KINGDOMS: Kingdom[] = [
  {
    id: 'north',
    name: 'อาณาจักรแดนเหนือ',
    color: '#60a5fa',
    government: 'monarchy',
    details: {
      rulerTitle: 'กษัตริย์แห่งแดนเหนือ',
      succession: 'สืบสันตติวงศ์ทางสายเลือด',
      powerStructure: 'ระบบศักดินาและขุนนางชายแดน',
      laws: ['พิทักษ์ป้อมผาเหนือ', 'เกณฑ์ทหารประจำฤดูหนาว'],
      motto: 'มั่นคงดุจศิลาเหนือพายุ',
    },
  },
  {
    id: 'central',
    name: 'จักรวรรดิกลาง',
    color: '#f59e0b',
    government: 'empire',
    details: {
      rulerTitle: 'จักรพรรดิ',
      succession: 'สืบสันตติวงศ์ทางสายเลือด',
      powerStructure: 'ราชสำนักรวมศูนย์และข้าหลวงมณฑล',
      laws: ['ถนนหลวงเสรีสำหรับกองคาราวาน', 'เก็บภาษีผลผลิตส่วนกลาง'],
      motto: 'ใต้แสงสุริยันคือแผ่นดินเดียว',
    },
  },
  {
    id: 'coastal',
    name: 'สหพันธรัฐชายฝั่ง',
    color: '#34d399',
    government: 'federation',
    details: {
      rulerTitle: 'มหาสมุทรนายก',
      succession: 'หมุนเวียนตามตระกูลพ่อค้า',
      powerStructure: 'สภากิลด์เดินเรือและนครท่า',
      laws: ['คุ้มครองสิทธิเดินเรือเสรี', 'ศาลพาณิชย์ทางทะเล'],
      motto: 'คลื่นลมนำพามั่งคั่ง',
    },
  },
  {
    id: 'desert',
    name: 'นครรัฐทะเลทราย',
    color: '#f97316',
    government: 'city_state',
    details: {
      rulerTitle: 'เจ้าผู้ครองนคร',
      succession: 'เลือกตั้งโดยสภาขุนนาง / วุฒิสภา',
      powerStructure: 'สภาโอเอซิสและนายกองคาราวาน',
      laws: ['แบ่งปันน้ำโอเอซิสอย่างเป็นธรรม', 'ภาษีเครื่องเทศและอัญมณี'],
      motto: 'ทองคำและหยาดน้ำคือชีวิต',
    },
  },
  {
    id: 'independent',
    name: 'นครอิสระ',
    color: '#a78bfa',
    government: 'republic',
    details: {
      rulerTitle: 'กงสุลใหญ่',
      succession: 'ประชามติ / สภาพลเมือง',
      powerStructure: 'สภาพลเมืองและสมาคมช่างฝีมือ',
      laws: ['เสรีภาพการค้าและความเชื่อ', 'ห้ามผูกขาดสินค้าจำเป็น'],
      motto: 'อิสระและรุ่งเรืองด้วยปัญญา',
    },
  },
];

export const RELIGION_TYPES: { id: ReligionType; label: string }[] = [
  { id: 'monotheism', label: 'เอกเทวนิยม' },
  { id: 'polytheism', label: 'พหุเทวนิยม' },
  { id: 'animism', label: 'วิญญาณนิยม / ธรรมชาติ' },
  { id: 'philosophy', label: 'ปรัชญา / ธรรมวิถี' },
  { id: 'arcane', label: 'ลัทธิเวทมนตร์ / ดาราศาสตร์' },
];

export function getAllReligionTypes(
  customTypes?: CustomCategoryType[]
): { id: string; label: string; isCustom?: boolean }[] {
  const base = RELIGION_TYPES.map((r) => ({ id: String(r.id), label: r.label }));
  if (!customTypes || customTypes.length === 0) return base;
  return [...base, ...customTypes.map((c) => ({ ...c, isCustom: true }))];
}

export const CLERGY_STRUCTURES: string[] = [
  'สภาสังฆราชและพระสังฆาธิการ',
  'นักบวชอิสระ / ดรูอิดท้องถิ่น',
  'ภาคีอัศวินและผู้คุมวิหาร',
  'นักปราชญ์และจารึกธรรม',
  'ผู้พยากรณ์และจอมเวทประจำหอคอย',
];

export const DEFAULT_RELIGIONS: Religion[] = [
  {
    id: 'solaris',
    name: 'ศาสนาแห่งสุริยเทพ',
    color: '#facc15',
    symbol: '☀️',
    type: 'monotheism',
    description: 'บูชาแสงสว่างและระเบียบแห่งสวรรค์',
    details: {
      deities: [{ id: 'd_solaris', name: 'องค์สุริยบดี ออเรล', domain: 'แสงสว่าง กฎหมาย และความยุติธรรม', symbol: '☀️' }],
      tenets: ['ยึดมั่นในความสัตย์จริง', 'เกื้อกูลผู้ตกยากในนามแสงตะวัน'],
      taboos: ['ห้ามใช้ศาสตร์มืด', 'ห้ามทำลายพันธสัญญาที่สาบานต่อหน้าแสงอาทิตย์'],
      clergyStructure: 'สภาสังฆราชและพระสังฆาธิการ',
      rituals: ['พิธีจุดคบเพลิงรุ่งอรุณ', 'เทศกาลกลางฤดูร้อน'],
      holyCityIds: [],
      sacredText: 'คัมภีร์สุริยวาท',
      headTitle: 'มหาสังฆราชแห่งแสง',
    },
  },
  {
    id: 'sylvan',
    name: 'ลัทธิจิตวิญญาณพงไพร',
    color: '#4ade80',
    symbol: '🌿',
    type: 'animism',
    description: 'เคารพวิญญาณแห่งผืนป่าและสายน้ำ',
    details: {
      deities: [{ id: 'd_sylvan', name: 'มารดาพฤกษา ซิลวาเรีย', domain: 'พงไพร ชีวิต และการเก็บเกี่ยว', symbol: '🌿' }],
      tenets: ['ใช้ทรัพยากรป่าเท่าที่จำเป็น', 'รักษาสมดุลระหว่างมนุษย์กับธรรมชาติ'],
      taboos: ['ห้ามเผาป่าศักดิ์สิทธิ์', 'ห้ามล่าสัตว์ในฤดูผสมพันธุ์'],
      clergyStructure: 'นักบวชอิสระ / ดรูอิดท้องถิ่น',
      rituals: ['พิธีปลูกต้นไม้แรกเกิด', 'การบูชาต้นน้ำประจำปี'],
      holyCityIds: [],
      sacredText: 'บทเพลงแห่งใบไม้',
      headTitle: 'พฤฒาจารย์ดรูอิด',
    },
  },
  {
    id: 'tideborn',
    name: 'ศาสนาทวยเทพแห่งสมุทร',
    color: '#38bdf8',
    symbol: '🔱',
    type: 'polytheism',
    description: 'ศรัทธาของชาวเรือและนครชายฝั่ง',
    details: {
      deities: [
        { id: 'd_tide1', name: 'จ้าวสมุทร ทาลาส', domain: 'คลื่นลมและท้องทะเลลึก', symbol: '🔱' },
        { id: 'd_tide2', name: 'เทพีแห่งลมค้า', domain: 'การเดินเรือและการค้าทางทะเล', symbol: '⛵' },
      ],
      tenets: ['จงเอื้อเฟื้อต่อผู้รอดชีวิตจากเรือแตก', 'เคารพกฎแห่งกระแสน้ำ'],
      taboos: ['ห้ามออกเรือโดยไม่ถวายเครื่องบูชาก่อนพายุ'],
      clergyStructure: 'ภาคีอัศวินและผู้คุมวิหาร',
      rituals: ['พิธีปล่อยเรือโคมลงสมุทร', 'การพรมน้ำเค็มก่อนออกเดินทางไกล'],
      holyCityIds: [],
      sacredText: 'ตำนานเจ็ดคาบสมุทร',
      headTitle: 'มหาปุโรหิตแห่งเกลียวคลื่น',
    },
  },
  {
    id: 'iron_creed',
    name: 'ปรัชญาแห่งขุนเขาและเหล็กกล้า',
    color: '#f87171',
    symbol: '⚒️',
    type: 'philosophy',
    description: 'เน้นวินัย การสร้างสรรค์ และบรรพบุรุษ',
    details: {
      deities: [{ id: 'd_iron', name: 'วิญญาณบรรพชนแห่งเตาหลอม', domain: 'ฝีมือช่าง เกียรติยศ และความอดทน', symbol: '⚒️' }],
      tenets: ['ผลงานที่ประณีตคือคำสวดภาวนา', 'รำลึกถึงบรรพบุรุษผู้บุกเบิก'],
      taboos: ['ห้ามหลอมอาวุธด้อยคุณภาพเพื่อหลอกขาย'],
      clergyStructure: 'นักปราชญ์และจารึกธรรม',
      rituals: ['พิธีตีดาบปฐมฤกษ์', 'งานรำลึกศิลาจารึก'],
      holyCityIds: [],
      sacredText: 'ศิลาจารึกเจ็ดค้อน',
      headTitle: 'บรมครูแห่งเตาหลอม',
    },
  },
  {
    id: 'astral',
    name: 'ภาคีดาราและอาร์เคน',
    color: '#c084fc',
    symbol: '✨',
    type: 'arcane',
    description: 'แสวงหาสัจธรรมผ่านดวงดาวและมานา',
    details: {
      deities: [{ id: 'd_astral', name: 'ดาราจักรนิรันดร์', domain: 'ดวงดาว มานา และความรู้ลี้ลับ', symbol: '✨' }],
      tenets: ['ความรู้ต้องถูกบันทึกและส่งต่อ', 'ควบคุมพลังอาร์เคนด้วยเหตุผล'],
      taboos: ['ห้ามเปิดประตูมิติต้องห้ามในเขตเมือง'],
      clergyStructure: 'ผู้พยากรณ์และจอมเวทประจำหอคอย',
      rituals: ['พิธีสังเกตจันทรุปราคา', 'การปลุกเสกผลึกนำทาง'],
      holyCityIds: [],
      sacredText: 'คัมภีร์แผนที่ดารา',
      headTitle: 'อัครมหาจอมปราชญ์',
    },
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

export function getAllCultureTypes(
  customTypes?: CustomCategoryType[]
): { id: string; label: string; isCustom?: boolean }[] {
  const base = CULTURE_TYPES.map((c) => ({ id: String(c.id), label: c.label }));
  if (!customTypes || customTypes.length === 0) return base;
  return [...base, ...customTypes.map((c) => ({ ...c, isCustom: true }))];
}

export const ARCHITECTURE_STYLES: { id: string; label: string; roofColor: string; wallColor: string }[] = [
  { id: 'medieval', label: 'ยุคกลาง (ปราสาทหิน-หลังคาดินเผา)', roofColor: '#9f4a38', wallColor: '#94a3b8' },
  { id: 'classical', label: 'คลาสสิก (เสาหินอ่อน-โดมทอง)', roofColor: '#c48f45', wallColor: '#e2e8f0' },
  { id: 'eastern', label: 'ตะวันออก (หลังคาซ้อนชั้น-ไม้แดง)', roofColor: '#b93829', wallColor: '#cbd5e1' },
  { id: 'desert', label: 'ทะเลทราย (โดมดินดิบ-ลานโอเอซิส)', roofColor: '#d4a359', wallColor: '#e7d3b0' },
  { id: 'nordic', label: 'นอร์ดิก (ไม้ซุงหน้าจั่วสูง-หินแกรนิต)', roofColor: '#4b6584', wallColor: '#9aa5b1' },
  { id: 'maritime', label: 'นครท่าเรือ (บ้านสีขาว-หลังคาฟ้า)', roofColor: '#3b82f6', wallColor: '#f1f5f9' },
  { id: 'arcane', label: 'อาร์เคน (หอคอยคริสตัล-หลังคาม่วง)', roofColor: '#8b5cf6', wallColor: '#c4b5fd' },
];

export const DEFAULT_CULTURES: Culture[] = [
  {
    id: 'nordic',
    name: 'ชาวอุดรผู้แกร่งกล้า',
    color: '#38bdf8',
    symbol: '🛡️',
    type: 'martial',
    description: 'วัฒนธรรมนักรบแห่งแดนหนาวและป้อมปราการ',
    details: {
      architectureStyle: 'nordic',
      languageFamily: 'ตระกูลภาษาอุดรโบราณ',
      namingStyle: 'ลงท้ายด้วย -การ์ด / -ฮาเวน / -ฟยอร์ด',
      traditions: ['งานเลี้ยงคบเพลิงกลางเหมันต์', 'การทดสอบความกล้าบนยอดผา'],
      values: ['ความซื่อสัตย์', 'ความทรหด', 'เกียรติของตระกูล'],
      clothingStyle: 'เสื้อคลุมขนสัตว์และเกราะหนังหนา',
    },
  },
  {
    id: 'valerian',
    name: 'อารยธรรมลุ่มน้ำหลวง',
    color: '#fbbf24',
    symbol: '🏛️',
    type: 'agrarian',
    description: 'ผู้รุ่งเรืองด้านเกษตรกรรม สถาปัตยกรรม และการปกครอง',
    details: {
      architectureStyle: 'classical',
      languageFamily: 'ตระกูลภาษาวาเลเรียน',
      namingStyle: 'วิจิตร เน้นคำว่า -ธานี / -อาเรีย / -คราวน์',
      traditions: ['เทศกาลแรกนาขวัญ', 'ขบวนพาเหรดแห่งชัยชนะ'],
      values: ['ระเบียบวินัย', 'ศิลปะ', 'ความอุดมสมบูรณ์'],
      clothingStyle: 'ผ้าทอลินินประดับดิ้นทอง',
    },
  },
  {
    id: 'thalassian',
    name: 'ชาวนาวีแห่งท้องทะเล',
    color: '#2dd4bf',
    symbol: '⚓',
    type: 'maritime',
    description: 'นักเดินเรือ พ่อค้าทางทะเล และชาวหมู่เกาะ',
    details: {
      architectureStyle: 'maritime',
      languageFamily: 'ตระกูลภาษาคาบสมุทร',
      namingStyle: 'มักมีคำว่า -ฮาร์เบอร์ / -ท่า / -อ่าว',
      traditions: ['แข่งเรือใบข้ามช่องแคบ', 'ตลาดนัดกลางคืนริมท่า'],
      values: ['เสรีภาพ', 'ไหวพริบการค้า', 'มิตรภาพลูกเรือ'],
      clothingStyle: 'เสื้อผ้าโปร่งบางสีน้ำเงิน-ขาว',
    },
  },
  {
    id: 'sunstrider',
    name: 'ชนเผ่าทะเลทรายสุริยัน',
    color: '#fb923c',
    symbol: '🐪',
    type: 'nomadic',
    description: 'กองคาราวานข้ามทะเลทรายและทุ่งสะวันนา',
    details: {
      architectureStyle: 'desert',
      languageFamily: 'ตระกูลภาษาสุริยัน',
      namingStyle: 'เน้นคำว่า โอเอซิส / ซาร์ / คาร์-',
      traditions: ['ดนตรีรอบกองไฟใต้ดาว', 'ประเพณีต้อนรับแขกด้วยน้ำชาและเกลือ'],
      values: ['การพึ่งพาอาศัย', 'ความจำแม่นยำในการนำทาง'],
      clothingStyle: 'ผ้าโพกศีรษะและเสื้อคลุมกันทราย',
    },
  },
  {
    id: 'highborn',
    name: 'ชาวศิลาแห่งขุนเขา',
    color: '#e879f9',
    symbol: '⛰️',
    type: 'highland',
    description: 'ช่างตีเหล็กและผู้พิทักษ์ป้อมผาสูง',
    details: {
      architectureStyle: 'medieval',
      languageFamily: 'ตระกูลภาษาศิลา',
      namingStyle: 'แข็งแกร่ง เช่น ป้อม- / ไอออน- / ศิลา-',
      traditions: ['การประชันงานช่างประจำปี', 'เทศกาลโคมไฟในเหมือง'],
      values: ['ความประณีต', 'ความมั่นคง', 'คำสัญญาเป็นนิรันดร์'],
      clothingStyle: 'เครื่องแต่งกายสีเข้มประดับโลหะและอัญมณี',
    },
  },
];

export const TIMELINE_EVENT_CATEGORIES: {
  id: TimelineEventCategory;
  label: string;
  symbol: string;
  color: string;
}[] = [
  { id: 'founding', label: 'การสถาปนา / ก่อตั้ง', symbol: '🏰', color: '#fbbf24' },
  { id: 'war', label: 'สงคราม / การรบ', symbol: '⚔️', color: '#f87171' },
  { id: 'treaty', label: 'สนธิสัญญา / พันธมิตร', symbol: '📜', color: '#34d399' },
  { id: 'religion', label: 'ศาสนา / ศาสนจักร', symbol: '☀️', color: '#c084fc' },
  { id: 'culture', label: 'วัฒนธรรม / อารยธรรม', symbol: '🏛️', color: '#2dd4bf' },
  { id: 'trade', label: 'การค้า / เส้นทางใหม่', symbol: '🪙', color: '#60a5fa' },
  { id: 'disaster', label: 'ภัยพิบัติ / วิกฤต', symbol: '🌋', color: '#fb923c' },
  { id: 'other', label: 'เหตุการณ์ทั่วไป', symbol: '📌', color: '#94a3b8' },
];

export const CITY_DISTRICT_META: Record<
  CityDistrictType,
  { label: string; color: string; defaultName: string }
> = {
  citadel: { label: 'ป้อมปราการ / วัง', color: '#f59e0b', defaultName: 'เขตป้อมปราการหลวง' },
  noble: { label: 'เขตขุนนาง', color: '#a855f7', defaultName: 'ย่านขุนนาง' },
  market: { label: 'ตลาดกลาง / การค้า', color: '#eab308', defaultName: 'ย่านตลาดกลาง' },
  temple: { label: 'เขตมหาวิหาร', color: '#facc15', defaultName: 'เขตวิหารศักดิ์สิทธิ์' },
  harbor: { label: 'ท่าเรือ / คลังสินค้า', color: '#38bdf8', defaultName: 'ย่านท่าเรือ' },
  craftsmen: { label: 'ย่านช่างฝีมือ', color: '#f97316', defaultName: 'ย่านช่างตีเหล็กและหัตถกรรม' },
  residential: { label: 'ชุมชนที่อยู่อาศัย', color: '#64748b', defaultName: 'เขตที่อยู่อาศัย' },
  slums: { label: 'ชุมชนนอกกำแพง', color: '#78716c', defaultName: 'ชุมชนชานเมือง' },
  academy: { label: 'สำนักปราชญ์ / หอเวท', color: '#6366f1', defaultName: 'เขตสำนักปราชญ์' },
  barracks: { label: 'ค่ายทหาร', color: '#ef4444', defaultName: 'เขตค่ายทหาร' },
  farmstead: { label: 'เขตเกษตรชานเมือง', color: '#22c55e', defaultName: 'ทุ่งเกษตรกรรม' },
};

export const CITY_BUILDING_PRESETS: {
  category: CityBuildingCategory;
  label: string;
  symbol: string;
}[] = [
  { category: 'palace', label: 'พระราชวัง / จวนเจ้าเมือง', symbol: '👑' },
  { category: 'temple', label: 'วิหาร / ศาสนสถาน', symbol: '⛪' },
  { category: 'market', label: 'ตลาดกลาง / หอการค้า', symbol: '⚖️' },
  { category: 'fortress', label: 'ป้อมปราการ / หอคอยยาม', symbol: '🏰' },
  { category: 'port', label: 'ท่าเทียบเรือ / ประภาคาร', symbol: '⚓' },
  { category: 'guild', label: 'กิลด์ช่างฝีมือ / โรงหลอม', symbol: '⚒️' },
  { category: 'academy', label: 'หอสมุด / สำนักปราชญ์', symbol: '📚' },
  { category: 'tavern', label: 'โรงเตี๊ยม / คาราวานเซไร', symbol: '🍺' },
  { category: 'monument', label: 'อนุสาวรีย์ / ลานจัตุรัส', symbol: '🗿' },
  { category: 'custom', label: 'สถานที่กำหนดเอง', symbol: '📍' },
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
