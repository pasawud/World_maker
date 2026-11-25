export enum BiomeId {
  DEEP_OCEAN = 0,
  SHALLOW_WATER = 1,
  SNOW_ICE = 2,
  TUNDRA = 3,
  TAIGA = 4,
  DECIDUOUS_FOREST = 5,
  RAINFOREST = 6,
  GRASSLAND = 7,
  WINDWARD_PLAINS = 8,
  SAVANNA = 9,
  DESERT = 10,
  HILLS = 11,
  MOUNTAIN = 12,
  SNOW_PEAK = 13,
  SWAMP = 14,
  HIGHLAND = 15,
}

export type BiomeDetailStyle =
  | 'none'
  | 'pine'
  | 'leafy'
  | 'jungle'
  | 'mountain'
  | 'snow_peak'
  | 'hills'
  | 'dunes'
  | 'swamp'
  | 'tundra'
  | 'crystal'
  | 'lava'
  | 'mushroom'
  | 'ruins_floor';

export interface CustomBiome {
  id: number; // >= 100
  nameTh: string;
  nameEn?: string;
  color: string;
  isWater: boolean;
  defaultElevation: number;
  moveCost: number;
  detailStyle: BiomeDetailStyle;
}

export interface CustomPoiType {
  id: string;
  label: string;
  symbol: string;
  color: string;
  isCustom?: boolean;
}

export interface SpecialFeatureMeta {
  id: string;
  nameTh: string;
  color: string;
  placement: 'land' | 'water' | 'coast' | 'any';
  moveCostDelta: number;
  goodsBonus: string[];
}

export type GovernmentType =
  | 'monarchy'
  | 'empire'
  | 'republic'
  | 'federation'
  | 'theocracy'
  | 'city_state'
  | 'tribal';

export type ReligionType =
  | 'monotheism'
  | 'polytheism'
  | 'animism'
  | 'philosophy'
  | 'arcane';

export interface Religion {
  id: string;
  name: string;
  color: string;
  symbol: string;
  type: ReligionType;
  description?: string;
}

export type CultureType =
  | 'agrarian'
  | 'maritime'
  | 'nomadic'
  | 'highland'
  | 'mercantile'
  | 'scholarly'
  | 'martial';

export interface Culture {
  id: string;
  name: string;
  color: string;
  symbol: string;
  type: CultureType;
  description?: string;
}

export type LandmassType =
  | 'continent'
  | 'twin'
  | 'archipelago'
  | 'pangaea'
  | 'inland_sea'
  | 'coastal';

export type WindMode = 'latitude' | 'west' | 'east';

export interface GeographyConfig {
  seed: number;
  landmassType: LandmassType;
  seaLevel: number;
  mountainScale: number;
  latNorth: number;
  latSouth: number;
  windMode: WindMode;
  moistureScale: number;
  riverThreshold: number;
}

export interface HexCoord {
  q: number;
  r: number;
}

export interface RiverPoint {
  q: number;
  r: number;
  flux: number;
}

export interface RiverPath {
  id: string;
  name?: string;
  source: 'auto' | 'manual';
  points: RiverPoint[];
}

export type CityTier = 'village' | 'town' | 'city' | 'capital' | 'port';

export interface City {
  id: string;
  name: string;
  q: number;
  r: number;
  tier: CityTier;
  population: number;
  kingdomId: string;
  religionId: string;
  cultureId: string;
  producedGoods: string[];
  demandedGoods: string[];
  notes: string;
}

export interface Kingdom {
  id: string;
  name: string;
  color: string;
  government: GovernmentType;
  description?: string;
}

export interface TradeGood {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  icon: string;
}

export type RoadType = 'dirt' | 'stone' | 'sea';

export interface RoadPath {
  id: string;
  type: RoadType;
  hexes: HexCoord[];
}

export type TradeMode = 'land' | 'sea' | 'mixed';

export interface TradeRoute {
  id: string;
  fromCityId: string;
  toCityId: string;
  goodIds: string[];
  mode: TradeMode;
  hexes: HexCoord[];
  distanceKm: number;
  travelDays: number;
}

export type PoiType = string;

export interface PointOfInterest {
  id: string;
  type: PoiType;
  name: string;
  q: number;
  r: number;
  notes: string;
}

export type LabelSize = 'sm' | 'md' | 'lg';
export type LabelStyle = 'region' | 'water' | 'mountain';

export interface MapLabel {
  id: string;
  text: string;
  q: number;
  r: number;
  size: LabelSize;
  style: LabelStyle;
}

export interface HexMapData {
  version: 1;
  id: string;
  name: string;
  updatedAt: string;
  width: number;
  height: number;
  hexSizeKm: number;
  geography: GeographyConfig;
  biomes: number[]; // length = width * height
  elevation: number[]; // -1 .. 1
  temperature: number[]; // deg C
  moisture: number[]; // 0 .. 1
  features: string[]; // length = width * height ('' = none)
  territories: string[]; // length = width * height ('' = unclaimed or kingdomId)
  religions: string[]; // length = width * height ('' = none or religionId)
  cultures: string[]; // length = width * height ('' = none or cultureId)
  rivers: RiverPath[];
  cities: City[];
  kingdoms: Kingdom[];
  religionList: Religion[];
  cultureList: Culture[];
  goods: TradeGood[];
  customBiomes: CustomBiome[];
  customPoiTypes: CustomPoiType[];
  roads: RoadPath[];
  tradeRoutes: TradeRoute[];
  pois: PointOfInterest[];
  labels: MapLabel[];
}

export type ToolMode =
  | 'view'
  | 'terrain'
  | 'river'
  | 'city'
  | 'territory'
  | 'religion'
  | 'culture'
  | 'road'
  | 'trade'
  | 'measure'
  | 'poi'
  | 'climate';

export type ClimateOverlay =
  | 'none'
  | 'political'
  | 'religion'
  | 'culture'
  | 'elevation'
  | 'temperature'
  | 'moisture';

export interface LayerVisibility {
  grid: boolean;
  cityNames: boolean;
  labels: boolean;
  territories: boolean;
  borders: boolean;
  religions: boolean;
  cultures: boolean;
  features: boolean;
  routes: boolean;
  rivers: boolean;
  pois: boolean;
}

export type TravelSpeedId = 'foot' | 'caravan' | 'horse' | 'ship';
