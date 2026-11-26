import { CustomTerrain, TerrainId, TerrainReliefStyle } from '../types/map';

export interface TerrainMeta {
  id: TerrainId | number;
  key: string;
  nameTh: string;
  nameEn: string;
  color: string;
  isWater: boolean;
  defaultElevation: number;
  minElevation: number;
  maxElevation: number;
  moveCost: number;
  reliefStyle: TerrainReliefStyle;
  description?: string;
  isCustom?: boolean;
  isOverridden?: boolean;
}

export const TERRAIN_RELIEF_STYLES: { id: TerrainReliefStyle; labelTh: string }[] = [
  { id: 'flat', labelTh: 'ที่ราบ / พื้นเรียบ' },
  { id: 'hills', labelTh: 'เนินเขาโค้งมน' },
  { id: 'highland', labelTh: 'ที่ราบสูงขั้นบันได' },
  { id: 'mountain', labelTh: 'สันเขา / ภูเขา' },
  { id: 'peak', labelTh: 'ยอดเขาหิมะแหลม' },
  { id: 'water', labelTh: 'ผืนน้ำ / คลื่นทะเล' },
  { id: 'lake', labelTh: 'ทะเลสาบน้ำจืด' },
  { id: 'plateau', labelTh: 'ที่ราบสูงโต๊ะ (Mesa)' },
  { id: 'canyon', labelTh: 'หุบผาลึก / แคนยอน' },
  { id: 'crater', labelTh: 'หลุมอุกกาบาต / แอ่งภูเขาไฟ' },
  { id: 'volcano', labelTh: 'กรวยภูเขาไฟ' },
  { id: 'ice_shelf', labelTh: 'หิ้งน้ำแข็ง / ธารน้ำแข็ง' },
];

export const TERRAINS: TerrainMeta[] = [
  {
    id: TerrainId.DEEP_OCEAN,
    key: 'deep_ocean',
    nameTh: 'มหาสมุทรลึก',
    nameEn: 'Deep Ocean',
    color: '#193b5c',
    isWater: true,
    defaultElevation: -0.65,
    minElevation: -1.0,
    maxElevation: -0.25,
    moveCost: 99,
    reliefStyle: 'water',
  },
  {
    id: TerrainId.SHALLOW_WATER,
    key: 'shallow_water',
    nameTh: 'ทะเลน้ำตื้น',
    nameEn: 'Shallow Water',
    color: '#2a628f',
    isWater: true,
    defaultElevation: -0.16,
    minElevation: -0.25,
    maxElevation: 0.0,
    moveCost: 99,
    reliefStyle: 'water',
  },
  {
    id: TerrainId.LAKE,
    key: 'lake',
    nameTh: 'ทะเลสาบ',
    nameEn: 'Freshwater Lake',
    color: '#3b8ec2',
    isWater: true,
    defaultElevation: -0.05,
    minElevation: -0.18,
    maxElevation: 0.02,
    moveCost: 99,
    reliefStyle: 'lake',
  },
  {
    id: TerrainId.PLAINS,
    key: 'plains',
    nameTh: 'ที่ราบ',
    nameEn: 'Plains',
    color: '#7da664',
    isWater: false,
    defaultElevation: 0.14,
    minElevation: 0.0,
    maxElevation: 0.32,
    moveCost: 1.0,
    reliefStyle: 'flat',
  },
  {
    id: TerrainId.HILLS,
    key: 'hills',
    nameTh: 'เนินเขา',
    nameEn: 'Hills',
    color: '#a89a65',
    isWater: false,
    defaultElevation: 0.38,
    minElevation: 0.30,
    maxElevation: 0.48,
    moveCost: 2.2,
    reliefStyle: 'hills',
  },
  {
    id: TerrainId.HIGHLAND,
    key: 'highland',
    nameTh: 'ที่ราบสูง',
    nameEn: 'Highland',
    color: '#b3976e',
    isWater: false,
    defaultElevation: 0.50,
    minElevation: 0.44,
    maxElevation: 0.58,
    moveCost: 2.4,
    reliefStyle: 'highland',
  },
  {
    id: TerrainId.MOUNTAIN,
    key: 'mountain',
    nameTh: 'ภูเขา',
    nameEn: 'Mountain',
    color: '#786d60',
    isWater: false,
    defaultElevation: 0.68,
    minElevation: 0.56,
    maxElevation: 0.80,
    moveCost: 18.0,
    reliefStyle: 'mountain',
  },
  {
    id: TerrainId.HIGH_PEAK,
    key: 'high_peak',
    nameTh: 'ยอดเขาสูง',
    nameEn: 'High Peak',
    color: '#c4cdd6',
    isWater: false,
    defaultElevation: 0.88,
    minElevation: 0.78,
    maxElevation: 1.0,
    moveCost: 48.0,
    reliefStyle: 'peak',
  },
];

export const TERRAIN_BY_ID: Record<number, TerrainMeta> = Object.fromEntries(
  TERRAINS.map((t) => [t.id, t])
);

export function getTerrainMeta(id: number): TerrainMeta {
  return TERRAIN_BY_ID[id] ?? TERRAINS[0];
}

function customToTerrainMeta(ct: CustomTerrain): TerrainMeta {
  const defaultEl = ct.defaultElevation;
  return {
    id: ct.id,
    key: ct.key || `custom_${ct.id}`,
    nameTh: ct.nameTh,
    nameEn: ct.nameEn || ct.nameTh,
    color: ct.color,
    isWater: ct.isWater,
    defaultElevation: defaultEl,
    minElevation: ct.minElevation ?? (ct.isWater ? -1.0 : Math.max(-0.2, defaultEl - 0.16)),
    maxElevation: ct.maxElevation ?? (ct.isWater ? 0.05 : Math.min(1.0, defaultEl + 0.16)),
    moveCost: ct.moveCost,
    reliefStyle: ct.reliefStyle || (ct.isWater ? 'water' : 'flat'),
    description: ct.description,
    isCustom: true,
  };
}

export function getTerrainMetaWithCustom(
  id: number,
  customTerrains?: CustomTerrain[],
  terrainOverrides?: Record<number, Partial<Omit<CustomTerrain, 'id'>>>
): TerrainMeta {
  const base = TERRAIN_BY_ID[id];
  if (base) {
    const ov = terrainOverrides?.[id];
    if (!ov) return base;
    return {
      ...base,
      ...ov,
      nameEn: ov.nameEn ?? base.nameEn,
      minElevation: ov.minElevation ?? base.minElevation,
      maxElevation: ov.maxElevation ?? base.maxElevation,
      reliefStyle: ov.reliefStyle ?? base.reliefStyle,
      isOverridden: true,
    };
  }
  const found = customTerrains?.find((t) => t.id === id);
  if (found) return customToTerrainMeta(found);
  return TERRAINS[0];
}

export function getAllTerrains(
  customTerrains?: CustomTerrain[],
  terrainOverrides?: Record<number, Partial<Omit<CustomTerrain, 'id'>>>
): TerrainMeta[] {
  const builtIns = TERRAINS.map((t) =>
    getTerrainMetaWithCustom(t.id, customTerrains, terrainOverrides)
  );
  const customs = (customTerrains ?? []).map(customToTerrainMeta);
  return [...builtIns, ...customs];
}

export function isWaterTerrain(id: number): boolean {
  return (
    id === TerrainId.DEEP_OCEAN ||
    id === TerrainId.SHALLOW_WATER ||
    id === TerrainId.LAKE
  );
}

export function isWaterTerrainWithCustom(
  id: number,
  customTerrains?: CustomTerrain[],
  terrainOverrides?: Record<number, Partial<Omit<CustomTerrain, 'id'>>>
): boolean {
  return getTerrainMetaWithCustom(id, customTerrains, terrainOverrides).isWater;
}
