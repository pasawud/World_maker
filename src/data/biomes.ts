import { BiomeDetailStyle, BiomeId, CustomBiome } from '../types/map';

export interface BiomeMeta {
  id: number;
  key: string;
  nameTh: string;
  nameEn: string;
  color: string;
  isWater: boolean;
  defaultElevation: number;
  moveCost: number;
  detailStyle: BiomeDetailStyle;
  isCustom?: boolean;
}

export const BIOME_DETAIL_STYLES: { id: BiomeDetailStyle; label: string }[] = [
  { id: 'none', label: 'พื้นเรียบ' },
  { id: 'pine', label: 'ป่าสน' },
  { id: 'leafy', label: 'ป่าผลัดใบ' },
  { id: 'jungle', label: 'ป่าดงดิบ' },
  { id: 'hills', label: 'เนินเขา' },
  { id: 'mountain', label: 'ภูเขาหิน' },
  { id: 'snow_peak', label: 'ยอดเขาหิมะ' },
  { id: 'dunes', label: 'เนินทราย' },
  { id: 'swamp', label: 'หนองน้ำ' },
  { id: 'tundra', label: 'น้ำแข็ง / ทุนดรา' },
  { id: 'crystal', label: 'ผลึกคริสตัล (แฟนตาซี)' },
  { id: 'lava', label: 'ลาวา / ภูเขาไฟ (แฟนตาซี)' },
  { id: 'mushroom', label: 'ป่าเห็ดเรืองแสง (แฟนตาซี)' },
  { id: 'ruins_floor', label: 'ลานโบราณสถาน (แฟนตาซี)' },
];

export const BIOMES: BiomeMeta[] = [
  {
    id: BiomeId.DEEP_OCEAN,
    key: 'deep_ocean',
    nameTh: 'มหาสมุทรลึก',
    nameEn: 'Deep Ocean',
    color: '#193b5c',
    isWater: true,
    defaultElevation: -0.65,
    moveCost: 99,
    detailStyle: 'none',
  },
  {
    id: BiomeId.SHALLOW_WATER,
    key: 'shallow_water',
    nameTh: 'ทะเลน้ำตื้น',
    nameEn: 'Shallow Water',
    color: '#2a628f',
    isWater: true,
    defaultElevation: -0.18,
    moveCost: 99,
    detailStyle: 'none',
  },
  {
    id: BiomeId.SNOW_ICE,
    key: 'snow_ice',
    nameTh: 'หิมะและน้ำแข็ง',
    nameEn: 'Snow & Ice',
    color: '#e8eff5',
    isWater: false,
    defaultElevation: 0.18,
    moveCost: 2.3,
    detailStyle: 'tundra',
  },
  {
    id: BiomeId.TUNDRA,
    key: 'tundra',
    nameTh: 'ทุนดราอันเยือกแข็ง',
    nameEn: 'Tundra',
    color: '#8f9d95',
    isWater: false,
    defaultElevation: 0.16,
    moveCost: 1.5,
    detailStyle: 'tundra',
  },
  {
    id: BiomeId.TAIGA,
    key: 'taiga',
    nameTh: 'ป่าสนไทกา',
    nameEn: 'Taiga',
    color: '#2c4c3e',
    isWater: false,
    defaultElevation: 0.22,
    moveCost: 1.6,
    detailStyle: 'pine',
  },
  {
    id: BiomeId.DECIDUOUS_FOREST,
    key: 'deciduous_forest',
    nameTh: 'ป่าผลัดใบ',
    nameEn: 'Deciduous Forest',
    color: '#466f3e',
    isWater: false,
    defaultElevation: 0.18,
    moveCost: 1.4,
    detailStyle: 'leafy',
  },
  {
    id: BiomeId.RAINFOREST,
    key: 'rainforest',
    nameTh: 'ป่าดงดิบ',
    nameEn: 'Rainforest',
    color: '#285932',
    isWater: false,
    defaultElevation: 0.14,
    moveCost: 2.0,
    detailStyle: 'jungle',
  },
  {
    id: BiomeId.GRASSLAND,
    key: 'grassland',
    nameTh: 'ทุ่งหญ้า',
    nameEn: 'Grassland',
    color: '#82994a',
    isWater: false,
    defaultElevation: 0.12,
    moveCost: 1.0,
    detailStyle: 'none',
  },
  {
    id: BiomeId.WINDWARD_PLAINS,
    key: 'windward_plains',
    nameTh: 'ทุ่งรับลมชุ่มชื้น',
    nameEn: 'Windward Plains',
    color: '#6e944b',
    isWater: false,
    defaultElevation: 0.15,
    moveCost: 1.05,
    detailStyle: 'none',
  },
  {
    id: BiomeId.SAVANNA,
    key: 'savanna',
    nameTh: 'ทุ่งหญ้าสะวันนา',
    nameEn: 'Savanna',
    color: '#b29b4a',
    isWater: false,
    defaultElevation: 0.14,
    moveCost: 1.1,
    detailStyle: 'none',
  },
  {
    id: BiomeId.DESERT,
    key: 'desert',
    nameTh: 'ทะเลทราย',
    nameEn: 'Desert',
    color: '#d2b471',
    isWater: false,
    defaultElevation: 0.16,
    moveCost: 1.8,
    detailStyle: 'dunes',
  },
  {
    id: BiomeId.HILLS,
    key: 'hills',
    nameTh: 'เนินเขา',
    nameEn: 'Hills',
    color: '#8c8353',
    isWater: false,
    defaultElevation: 0.42,
    moveCost: 2.6,
    detailStyle: 'hills',
  },
  {
    id: BiomeId.HIGHLAND,
    key: 'highland',
    nameTh: 'ที่ราบสูง',
    nameEn: 'Highland',
    color: '#9e8f6c',
    isWater: false,
    defaultElevation: 0.48,
    moveCost: 2.5,
    detailStyle: 'hills',
  },
  {
    id: BiomeId.MOUNTAIN,
    key: 'mountain',
    nameTh: 'ภูเขา',
    nameEn: 'Mountain',
    color: '#766b5d',
    isWater: false,
    defaultElevation: 0.68,
    moveCost: 18.0,
    detailStyle: 'mountain',
  },
  {
    id: BiomeId.SNOW_PEAK,
    key: 'snow_peak',
    nameTh: 'ยอดเขาหิมะ',
    nameEn: 'Snow Peak',
    color: '#c8d1d8',
    isWater: false,
    defaultElevation: 0.88,
    moveCost: 48.0,
    detailStyle: 'snow_peak',
  },
  {
    id: BiomeId.SWAMP,
    key: 'swamp',
    nameTh: 'ที่ลุ่มหนองน้ำ',
    nameEn: 'Swamp',
    color: '#4c654d',
    isWater: false,
    defaultElevation: 0.04,
    moveCost: 3.5,
    detailStyle: 'swamp',
  },
];

export const BIOME_BY_ID: Record<number, BiomeMeta> = Object.fromEntries(
  BIOMES.map((b) => [b.id, b])
);

export function getBiomeMeta(id: number): BiomeMeta {
  return BIOME_BY_ID[id] ?? BIOMES[0];
}

export function getBiomeMetaWithCustom(id: number, customBiomes?: CustomBiome[]): BiomeMeta {
  if (BIOME_BY_ID[id]) return BIOME_BY_ID[id];
  if (customBiomes && customBiomes.length > 0) {
    const found = customBiomes.find((cb) => cb.id === id);
    if (found) {
      return {
        id: found.id,
        key: `custom_${found.id}`,
        nameTh: found.nameTh,
        nameEn: found.nameEn || found.nameTh,
        color: found.color,
        isWater: found.isWater,
        defaultElevation: found.defaultElevation,
        moveCost: found.moveCost,
        detailStyle: found.detailStyle,
        isCustom: true,
      };
    }
  }
  return BIOMES[0];
}

export function getAllBiomes(customBiomes?: CustomBiome[]): BiomeMeta[] {
  if (!customBiomes || customBiomes.length === 0) return BIOMES;
  const customMetas: BiomeMeta[] = customBiomes.map((cb) => ({
    id: cb.id,
    key: `custom_${cb.id}`,
    nameTh: cb.nameTh,
    nameEn: cb.nameEn || cb.nameTh,
    color: cb.color,
    isWater: cb.isWater,
    defaultElevation: cb.defaultElevation,
    moveCost: cb.moveCost,
    detailStyle: cb.detailStyle,
    isCustom: true,
  }));
  return [...BIOMES, ...customMetas];
}

export const LEGACY_TERRAIN_BIOME_IDS = new Set<number>([
  BiomeId.DEEP_OCEAN,
  BiomeId.SHALLOW_WATER,
  BiomeId.HILLS,
  BiomeId.HIGHLAND,
  BiomeId.MOUNTAIN,
  BiomeId.SNOW_PEAK,
]);

export const LAND_BIOMES: BiomeMeta[] = BIOMES.filter(
  (b) => !LEGACY_TERRAIN_BIOME_IDS.has(b.id)
);

export function getPaintableBiomes(customBiomes?: CustomBiome[]): BiomeMeta[] {
  if (!customBiomes || customBiomes.length === 0) return LAND_BIOMES;
  const customMetas: BiomeMeta[] = customBiomes.map((cb) => ({
    id: cb.id,
    key: `custom_${cb.id}`,
    nameTh: cb.nameTh,
    nameEn: cb.nameEn || cb.nameTh,
    color: cb.color,
    isWater: cb.isWater,
    defaultElevation: cb.defaultElevation,
    moveCost: cb.moveCost,
    detailStyle: cb.detailStyle,
    isCustom: true,
  }));
  return [...LAND_BIOMES, ...customMetas];
}
