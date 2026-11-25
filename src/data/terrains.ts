import { TerrainId } from '../types/map';

export interface TerrainMeta {
  id: TerrainId;
  key: string;
  nameTh: string;
  nameEn: string;
  color: string;
  isWater: boolean;
  defaultElevation: number;
  moveCost: number;
}

export const TERRAINS: TerrainMeta[] = [
  {
    id: TerrainId.DEEP_OCEAN,
    key: 'deep_ocean',
    nameTh: 'มหาสมุทรลึก',
    nameEn: 'Deep Ocean',
    color: '#193b5c',
    isWater: true,
    defaultElevation: -0.65,
    moveCost: 99,
  },
  {
    id: TerrainId.SHALLOW_WATER,
    key: 'shallow_water',
    nameTh: 'ทะเลน้ำตื้น',
    nameEn: 'Shallow Water',
    color: '#2a628f',
    isWater: true,
    defaultElevation: -0.18,
    moveCost: 99,
  },
  {
    id: TerrainId.LAKE,
    key: 'lake',
    nameTh: 'ทะเลสาบ',
    nameEn: 'Freshwater Lake',
    color: '#3b8ec2',
    isWater: true,
    defaultElevation: -0.06,
    moveCost: 99,
  },
  {
    id: TerrainId.PLAINS,
    key: 'plains',
    nameTh: 'ที่ราบ',
    nameEn: 'Plains',
    color: '#7da664',
    isWater: false,
    defaultElevation: 0.14,
    moveCost: 1.0,
  },
  {
    id: TerrainId.HILLS,
    key: 'hills',
    nameTh: 'เนินเขา',
    nameEn: 'Hills',
    color: '#a89a65',
    isWater: false,
    defaultElevation: 0.42,
    moveCost: 2.2,
  },
  {
    id: TerrainId.HIGHLAND,
    key: 'highland',
    nameTh: 'ที่ราบสูง',
    nameEn: 'Highland',
    color: '#b3976e',
    isWater: false,
    defaultElevation: 0.50,
    moveCost: 2.4,
  },
  {
    id: TerrainId.MOUNTAIN,
    key: 'mountain',
    nameTh: 'ภูเขา',
    nameEn: 'Mountain',
    color: '#786d60',
    isWater: false,
    defaultElevation: 0.68,
    moveCost: 18.0,
  },
  {
    id: TerrainId.HIGH_PEAK,
    key: 'high_peak',
    nameTh: 'ยอดเขาสูง',
    nameEn: 'High Peak',
    color: '#c4cdd6',
    isWater: false,
    defaultElevation: 0.88,
    moveCost: 48.0,
  },
];

export const TERRAIN_BY_ID: Record<number, TerrainMeta> = Object.fromEntries(
  TERRAINS.map((t) => [t.id, t])
);

export function getTerrainMeta(id: number): TerrainMeta {
  return TERRAIN_BY_ID[id] ?? TERRAINS[0];
}

export function isWaterTerrain(id: number): boolean {
  return (
    id === TerrainId.DEEP_OCEAN ||
    id === TerrainId.SHALLOW_WATER ||
    id === TerrainId.LAKE
  );
}
