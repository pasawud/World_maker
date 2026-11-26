import { Culture, CultureLanguageProfile } from '../types/map';
import { mulberry32 } from './noise';

export type NameCategory = 'city' | 'river' | 'sea' | 'person';

export interface LanguagePreset {
  id: string;
  labelTh: string;
  profile: CultureLanguageProfile;
}

export const LANGUAGE_PRESETS: LanguagePreset[] = [
  {
    id: 'imperial',
    labelTh: 'จักรวรรดิ / ลาติน-แฟนตาซี (Valerius, Aurelia)',
    profile: {
      presetId: 'imperial',
      onsets: ['วาล', 'ออ', 'คาร์', 'ซีล', 'อา', 'เร', 'มาร์', 'ไท', 'ลู', 'โด'],
      nuclei: ['เล', 'ริ', 'ทา', 'โน', 'เว', 'รา', 'ซิ', 'ดี'],
      codas: ['อส', 'อน', 'อา', 'อิน', 'าร์', 'ัม', 'ิส'],
      citySuffixes: ['การ์ด', 'ฮาเวน', 'โปลิส', 'เบิร์ก', 'เรีย', 'ธานี'],
      riverSuffixes: ['นที', 'ธาร', 'รีฟ', 'อาร์', 'เวียร์'],
      seaSuffixes: ['ทะเลหลวง', 'อ่าวทอง', 'มหาสมุทร'],
      personSuffixes: ['อุส', 'อาน', 'เอล', 'ิอุส', 'ีน'],
    },
  },
  {
    id: 'nordic',
    labelTh: 'นอร์ดิก / แดนเหนือ (Skalheim, Frostgard)',
    profile: {
      presetId: 'nordic',
      onsets: ['สกัล', 'ฟรอส', 'ธอร์', 'ดรัก', 'เฮล', 'อูร์', 'ยอร์', 'บรัน', 'เอล'],
      nuclei: ['ฮา', 'วิก', 'ฟยอร์ด', 'ไอน์', 'ดัล', 'มัล', 'ซุน'],
      codas: ['การ์ด', 'ไฮม์', 'ฟยอร์ด', 'สตัด', 'ริก'],
      citySuffixes: ['ไฮม์', 'การ์ด', 'วิก', 'บอร์ก', 'สตัด'],
      riverSuffixes: ['ฟลอด', 'ธารน้ำแข็ง', 'เอล์ฟ'],
      seaSuffixes: ['สมุทรหนาว', 'ฟยอร์ดเหนือ', 'อ่าวเหมันต์'],
      personSuffixes: ['สัน', 'ดอตติร์', 'อุลฟ์', 'บียอร์น'],
    },
  },
  {
    id: 'siamese',
    labelTh: 'สุวรรณภูมิ / เอเชียอาคเนย์ (อยุธยา, ศรีวิชัย)',
    profile: {
      presetId: 'siamese',
      onsets: ['ศรี', 'สุ', 'อ', 'นคร', 'จันท', 'รัตน', 'พิ', 'เวียง', 'ทวาร', 'ราช'],
      nuclei: ['วิ', 'สุร', 'วดี', 'มณี', 'อิน', 'ทอง', 'เทพ', 'กาญจน์'],
      codas: ['ชัย', 'บุรี', 'ธานี', 'คีรี', 'วดี', 'สินธุ์', 'พร'],
      citySuffixes: ['บุรี', 'ธานี', 'นคร', 'เวียง', 'ปุระ'],
      riverSuffixes: ['นที', 'ชล', 'สินธุ์', 'แม่น้ำ'],
      seaSuffixes: ['สมุทร', 'สาคร', 'อ่าวแก้ว'],
      personSuffixes: ['เดชา', 'บดินทร์', 'ราช', 'ภักดี', 'เทวี'],
    },
  },
  {
    id: 'desert',
    labelTh: 'ทะเลทราย / ตะวันออกกลาง (Al-Qasr, Zafira)',
    profile: {
      presetId: 'desert',
      onsets: ['อัล', 'ซา', 'คาล', 'มู', 'ฟา', 'ไค', 'นา', 'ดาร์', 'ฮา'],
      nuclei: ['ฟี', 'กา', 'ริ', 'มี', 'ซุ', 'บา', 'ชา'],
      codas: ['อาร์', 'ซาร์', 'ีฟ', 'อัด', 'ุล', 'ัน'],
      citySuffixes: ['กัซร์', 'บาด', 'โอเอซิส', 'เมดินา', 'ซูร์'],
      riverSuffixes: ['วาดิ', 'ธารทราย', 'นที'],
      seaSuffixes: ['ทะเลแดง', 'อ่าวสุริยัน', 'ทะเลสาบเกลือ'],
      personSuffixes: ['อิบนุ', 'อัลดีน', 'มูซา', 'ราฟา'],
    },
  },
  {
    id: 'elven',
    labelTh: 'เอลฟ์ / พฤกษาโบราณ (Lothlorien, Silvaril)',
    profile: {
      presetId: 'elven',
      onsets: ['ลอธ', 'ซิล', 'เอ', 'กาล', 'เฟ', 'มิธ', 'อาร', 'ธิ', 'อีล'],
      nuclei: ['ลา', 'เว', 'ริ', 'นา', 'ลี', 'โอ', 'ซิ'],
      codas: ['เอล', 'เลียน', 'ธาร์', 'ริล', 'อัน', 'ออส'],
      citySuffixes: ['ลอเรียน', 'ดิล', 'วาเรน', 'กลาด', 'นิธ'],
      riverSuffixes: ['นิน', 'แอล', 'ซีร์', 'ธารพฤกษา'],
      seaSuffixes: ['อ่าวดารา', 'สมุทรจันทรา', 'ทะเลหมอก'],
      personSuffixes: ['ฟิน', 'เดล', 'เวน', 'ริออน'],
    },
  },
  {
    id: 'maritime',
    labelTh: 'โจรสลัด / หมู่เกาะเดินเรือ (Port Corsair, Coral Bay)',
    profile: {
      presetId: 'maritime',
      onsets: ['คอร์', 'ซัล', 'เพิร์ล', 'บลู', 'วา', 'กัล', 'โท', 'โม'],
      nuclei: ['เว', 'รา', 'นี', 'คา', 'บี', 'โร'],
      codas: ['เบย์', 'ริฟ', 'พอร์ต', 'โคฟ', 'มาร์'],
      citySuffixes: ['ฮาร์เบอร์', 'พอร์ต', 'โคฟ', 'เบย์', 'แองเคอร์'],
      riverSuffixes: ['ครีก', 'แชนแนล', 'ปากน้ำ'],
      seaSuffixes: ['ทะเลใต้', 'น่านน้ำมรกต', 'อ่าวปะการัง'],
      personSuffixes: ['ดริฟต์', 'เวฟ', 'ฟลินต์', 'สคอลล์'],
    },
  },
];

export function getPresetLanguageProfile(presetId?: string): CultureLanguageProfile {
  const found = LANGUAGE_PRESETS.find((p) => p.id === presetId);
  return found ? { ...found.profile } : { ...LANGUAGE_PRESETS[0].profile };
}

export function getEffectiveLanguageProfile(culture?: Culture | null): CultureLanguageProfile {
  if (!culture) return getPresetLanguageProfile('imperial');
  if (culture.details?.languageProfile && culture.details.languageProfile.onsets.length > 0) {
    return culture.details.languageProfile;
  }
  const styleGuess =
    culture.type === 'maritime'
      ? 'maritime'
      : culture.type === 'nomadic'
      ? 'desert'
      : culture.type === 'highland'
      ? 'nordic'
      : culture.type === 'scholarly'
      ? 'elven'
      : culture.type === 'agrarian'
      ? 'siamese'
      : 'imperial';
  return getPresetLanguageProfile(culture.details?.languageProfile?.presetId ?? styleGuess);
}

function pick<T>(arr: T[], rng: () => number, fallback: T): T {
  if (!arr || arr.length === 0) return fallback;
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/** Generate a single culturally coherent name using onset/nucleus/coda/suffix rules. */
export function generateCultureName(
  culture: Culture | null | undefined,
  category: NameCategory,
  seed = Date.now()
): string {
  const profile = getEffectiveLanguageProfile(culture);
  const rng = mulberry32((seed >>> 0) + category.charCodeAt(0) * 131);

  const onset = pick(profile.onsets, rng, 'อาร');
  const useNucleus = rng() > 0.3;
  const nucleus = useNucleus ? pick(profile.nuclei, rng, 'ลา') : '';

  if (category === 'city') {
    const suffix = pick(profile.citySuffixes, rng, 'บุรี');
    return `${onset}${nucleus}${suffix}`;
  }
  if (category === 'river') {
    const coda = rng() > 0.45 ? pick(profile.codas, rng, '') : '';
    const suffix = pick(profile.riverSuffixes, rng, 'นที');
    return rng() > 0.5 ? `${suffix}${onset}${nucleus}` : `${onset}${nucleus}${coda}${suffix}`;
  }
  if (category === 'sea') {
    const coda = pick(profile.codas, rng, '');
    const suffix = pick(profile.seaSuffixes, rng, 'สมุทร');
    return `${suffix}${onset}${nucleus}${coda}`;
  }
  // person
  const personSuffix = pick(profile.personSuffixes, rng, 'อุส');
  const first = `${onset}${nucleus}${personSuffix}`;
  if (rng() > 0.55) {
    const second = `${pick(profile.onsets, rng, 'คาร์')}${pick(profile.codas, rng, 'อน')}`;
    return `${first} ${second}`;
  }
  return first;
}

/** Generate multiple distinct culturally coherent names for preview/selection. */
export function generateCultureNameBatch(
  culture: Culture | null | undefined,
  category: NameCategory,
  count = 6,
  seed = 1024
): string[] {
  const out = new Set<string>();
  let attempt = 0;
  while (out.size < count && attempt < count * 5) {
    out.add(generateCultureName(culture, category, seed + attempt * 97));
    attempt++;
  }
  return Array.from(out);
}
