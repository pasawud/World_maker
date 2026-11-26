import { HexMapData, SeasonId, TerrainId, WorldCalendar, WorldMoon } from '../types/map';
import { getHexTerrain, hexIndex } from './hexMath';
import { getRowLatitude } from './worldGenerator';

export const SEASON_LABELS_TH: Record<SeasonId, string> = {
  spring: 'ใบไม้ผลิ',
  summer: 'ฤดูร้อน',
  autumn: 'ใบไม้ร่วง',
  winter: 'ฤดูหนาว',
};

export function createDefaultCalendar(): WorldCalendar {
  return {
    name: 'ปฏิทินสุริยันจันทรา',
    year: 1024,
    monthIdx: 0,
    day: 1,
    months: [
      { id: 'm1', name: 'เดือนแห่งรุ่งอรุณ', days: 30, season: 'spring' },
      { id: 'm2', name: 'เดือนบุปผาผลิ', days: 30, season: 'spring' },
      { id: 'm3', name: 'เดือนสายฝนแรก', days: 30, season: 'spring' },
      { id: 'm4', name: 'เดือนสุริยันจ้า', days: 31, season: 'summer' },
      { id: 'm5', name: 'เดือนเปลวเพลิง', days: 31, season: 'summer' },
      { id: 'm6', name: 'เดือนเก็บเกี่ยว', days: 30, season: 'summer' },
      { id: 'm7', name: 'เดือนใบไม้ทอง', days: 30, season: 'autumn' },
      { id: 'm8', name: 'เดือนสายลมหนาว', days: 30, season: 'autumn' },
      { id: 'm9', name: 'เดือนน้ำค้างแข็ง', days: 30, season: 'autumn' },
      { id: 'm10', name: 'เดือนหิมะแรก', days: 30, season: 'winter' },
      { id: 'm11', name: 'เดือนรัตติกาลยาว', days: 31, season: 'winter' },
      { id: 'm12', name: 'เดือนเหมันตนิรันดร์', days: 31, season: 'winter' },
    ],
    moons: [
      { id: 'moon_1', name: 'จันทราเงิน (Selene)', cycleDays: 28, color: '#e2e8f0' },
      { id: 'moon_2', name: 'จันทราโลหิต (Pyra)', cycleDays: 45, color: '#fca5a5' },
    ],
  };
}

export function getCurrentSeason(cal?: WorldCalendar): SeasonId {
  if (!cal || cal.months.length === 0) return 'spring';
  const m = cal.months[((cal.monthIdx % cal.months.length) + cal.months.length) % cal.months.length];
  return m.season;
}

export function getTotalElapsedDays(cal: WorldCalendar): number {
  const yearDays = cal.months.reduce((s, m) => s + Math.max(1, m.days), 0) || 365;
  let dayOfYear = cal.day - 1;
  for (let i = 0; i < cal.monthIdx && i < cal.months.length; i++) {
    dayOfYear += Math.max(1, cal.months[i].days);
  }
  return cal.year * yearDays + dayOfYear;
}

export function getMoonPhase(
  cal: WorldCalendar,
  moon: WorldMoon
): { ratio: number; labelTh: string; icon: string } {
  const cycle = Math.max(4, moon.cycleDays);
  const elapsed = getTotalElapsedDays(cal);
  const ratio = ((elapsed % cycle) + cycle) % cycle / cycle;

  if (ratio < 0.08 || ratio >= 0.92) return { ratio, labelTh: 'จันทร์ดับ (New)', icon: '🌑' };
  if (ratio < 0.22) return { ratio, labelTh: 'เสี้ยวข้างขึ้น', icon: '🌒' };
  if (ratio < 0.34) return { ratio, labelTh: 'ครึ่งดวงขึ้น', icon: '🌓' };
  if (ratio < 0.45) return { ratio, labelTh: 'ค่อนดวงขึ้น', icon: '🌔' };
  if (ratio < 0.56) return { ratio, labelTh: 'จันทร์เพ็ญ (Full)', icon: '🌕' };
  if (ratio < 0.7) return { ratio, labelTh: 'ค่อนดวงแรม', icon: '🌖' };
  if (ratio < 0.82) return { ratio, labelTh: 'ครึ่งดวงแรม', icon: '🌗' };
  return { ratio, labelTh: 'เสี้ยวข้างแรม', icon: '🌘' };
}

export function advanceCalendarDays(cal: WorldCalendar, deltaDays: number): WorldCalendar {
  if (cal.months.length === 0) return cal;
  let year = cal.year;
  let monthIdx = ((cal.monthIdx % cal.months.length) + cal.months.length) % cal.months.length;
  let day = cal.day + Math.round(deltaDays);

  while (day > Math.max(1, cal.months[monthIdx].days)) {
    day -= Math.max(1, cal.months[monthIdx].days);
    monthIdx++;
    if (monthIdx >= cal.months.length) {
      monthIdx = 0;
      year++;
    }
  }
  while (day < 1) {
    monthIdx--;
    if (monthIdx < 0) {
      monthIdx = cal.months.length - 1;
      year--;
    }
    day += Math.max(1, cal.months[monthIdx].days);
  }

  return { ...cal, year, monthIdx, day };
}

export interface SeasonalField {
  temperature: Float32Array;
  snowMask: Uint8Array; // 1 = snow cover on land
}

/**
 * Compute per-hex seasonal temperature & snowline cover based on solar axial tilt (±21° latitude).
 * Northern Hemisphere winter shifts cold polar air southward; summer warms northern latitudes.
 */
export function computeSeasonalField(
  map: Pick<HexMapData, 'width' | 'height' | 'elevation' | 'temperature' | 'geography' | 'biomes' | 'terrains' | 'customTerrains' | 'terrainOverrides'>,
  season: SeasonId
): SeasonalField {
  const total = map.width * map.height;
  const temperature = new Float32Array(total);
  const snowMask = new Uint8Array(total);

  // Solar subsolar declination: +21 in Northern Summer, -21 in Northern Winter, 0 at Equinox
  const decl = season === 'summer' ? 21 : season === 'winter' ? -21 : season === 'spring' ? 3 : -3;

  for (let r = 0; r < map.height; r++) {
    const lat = getRowLatitude(r, map.height, map.geography);
    // Seasonal delta: strongest in mid-to-high latitudes, opposite sign across hemispheres
    const latFactor = Math.sin((lat * Math.PI) / 180);
    const seasonalShift = (decl / 21) * latFactor * 16.5;

    for (let q = 0; q < map.width; q++) {
      const idx = hexIndex(q, r, map.width);
      const baseTemp = map.temperature[idx] ?? 15;
      const e = map.elevation[idx] ?? 0;
      const damp = e <= 0 ? 0.45 : 1.0; // Ocean thermal inertia halves seasonal swing
      const tSeason = Number((baseTemp + seasonalShift * damp).toFixed(1));
      temperature[idx] = tSeason;

      const tId = getHexTerrain(map, idx);
      const isWater =
        e <= 0 ||
        tId === TerrainId.DEEP_OCEAN ||
        tId === TerrainId.SHALLOW_WATER ||
        tId === TerrainId.LAKE;
      if (!isWater && tSeason <= 0.5) {
        snowMask[idx] = 1;
      }
    }
  }

  return { temperature, snowMask };
}
