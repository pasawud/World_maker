export enum TerrainId {
  DEEP_OCEAN = 0,
  SHALLOW_WATER = 1,
  PLAINS = 2,
  HILLS = 3,
  HIGHLAND = 4,
  MOUNTAIN = 5,
  HIGH_PEAK = 6,
}

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

export interface CustomCategoryType {
  id: string;
  label: string;
  description?: string;
}

export type GovernmentType =
  | 'monarchy'
  | 'empire'
  | 'republic'
  | 'federation'
  | 'theocracy'
  | 'city_state'
  | 'tribal'
  | (string & {});

export type ReligionType =
  | 'monotheism'
  | 'polytheism'
  | 'animism'
  | 'philosophy'
  | 'arcane'
  | (string & {});

export interface ReligionDeity {
  id: string;
  name: string;
  domain: string;
  symbol?: string;
}

export interface ReligionDetails {
  deities: ReligionDeity[];
  tenets: string[];
  taboos: string[];
  clergyStructure: string;
  rituals: string[];
  holyCityIds: string[];
  sacredText?: string;
  headTitle?: string;
}

export interface Religion {
  id: string;
  name: string;
  color: string;
  symbol: string;
  type: ReligionType;
  description?: string;
  details?: ReligionDetails;
}

export type CultureType =
  | 'agrarian'
  | 'maritime'
  | 'nomadic'
  | 'highland'
  | 'mercantile'
  | 'scholarly'
  | 'martial'
  | (string & {});

export interface CultureDetails {
  architectureStyle: string;
  languageFamily: string;
  namingStyle: string;
  traditions: string[];
  values: string[];
  clothingStyle?: string;
}

export interface Culture {
  id: string;
  name: string;
  color: string;
  symbol: string;
  type: CultureType;
  description?: string;
  details?: CultureDetails;
}

export type LandmassType =
  | 'real_earth'
  | 'continent'
  | 'twin'
  | 'archipelago'
  | 'pangaea'
  | 'inland_sea'
  | 'coastal';

export type WindMode =
  | 'latitude'
  | 'monsoon'
  | 'west'
  | 'east'
  | 'north'
  | 'south'
  | 'northwest'
  | 'southwest'
  | 'northeast'
  | 'southeast';

export interface GeographyConfig {
  seed: number;
  landmassType: LandmassType;
  seaLevel: number;
  mountainScale: number;
  latNorth: number;
  latSouth: number;
  lonWest?: number;
  lonEast?: number;
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

export type CityDistrictType =
  | 'citadel'
  | 'noble'
  | 'market'
  | 'temple'
  | 'harbor'
  | 'craftsmen'
  | 'residential'
  | 'slums'
  | 'academy'
  | 'barracks'
  | 'farmstead';

export interface CityDistrict {
  id: string;
  name: string;
  type: CityDistrictType;
  x: number; // 0..1000 city canvas space
  y: number;
  radius: number;
  color: string;
  populationShare: number;
  notes?: string;
}

export type CityBuildingCategory =
  | 'palace'
  | 'temple'
  | 'market'
  | 'fortress'
  | 'port'
  | 'guild'
  | 'tavern'
  | 'academy'
  | 'monument'
  | 'gate'
  | 'custom';

export interface CityBuilding {
  id: string;
  name: string;
  category: CityBuildingCategory;
  symbol: string;
  x: number;
  y: number;
  districtId?: string;
  religionId?: string;
  description?: string;
}

export interface CityRoadSegment {
  id: string;
  kind: 'main' | 'alley' | 'bridge';
  points: { x: number; y: number }[];
}

export interface CityGate {
  id: string;
  name: string;
  angle: number; // radians
}

export type CityLayoutStyle =
  | 'radial'
  | 'grid'
  | 'coastal_crescent'
  | 'river_twin'
  | 'hilltop_fort';

export type CityWallStyle = 'none' | 'wooden' | 'stone' | 'citadel_double';
export type CardinalSide = 'none' | 'north' | 'south' | 'east' | 'west';
export type CityBlueprintTheme = 'parchment' | 'districts' | 'dark';

export interface CityDemographicSlice {
  id: string;
  percent: number;
}

export interface CityPlanData {
  seed: number;
  layoutStyle: CityLayoutStyle;
  hasWalls: boolean;
  wallStyle: CityWallStyle;
  wallRadius: number;
  waterSide: CardinalSide;
  hasRiver: boolean;
  riverAngle: number;
  hasCliff: boolean;
  cliffSide: CardinalSide;
  theme?: CityBlueprintTheme;
  showLabels?: boolean;
  showFarms?: boolean;
  showTrees?: boolean;
  density?: number;
  districts: CityDistrict[];
  buildings: CityBuilding[];
  roads: CityRoadSegment[];
  gates: CityGate[];
}

export interface CityDeepProfile {
  motto?: string;
  rulerName?: string;
  garrisonSize?: number;
  defenseRating?: number;
  foundedYear?: number;
  architectureStyle?: string;
  religionMix?: CityDemographicSlice[];
  cultureMix?: CityDemographicSlice[];
}

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
  plan?: CityPlanData;
  profile?: CityDeepProfile;
}

export interface GovernmentDetails {
  rulerTitle: string;
  rulerName?: string;
  succession: string;
  powerStructure: string;
  laws: string[];
  motto?: string;
  capitalCityId?: string;
}

export interface Kingdom {
  id: string;
  name: string;
  color: string;
  government: GovernmentType;
  description?: string;
  details?: GovernmentDetails;
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

export type RleStringRuns = [string, number][];

export type TimelineEventCategory =
  | 'founding'
  | 'war'
  | 'treaty'
  | 'religion'
  | 'culture'
  | 'trade'
  | 'disaster'
  | 'other';

export interface TimelineEvent {
  id: string;
  year: number;
  title: string;
  category: TimelineEventCategory;
  description: string;
  q?: number;
  r?: number;
  cityId?: string;
  kingdomId?: string;
  religionId?: string;
  cultureId?: string;
}

export interface TimelineEraSnapshot {
  id: string;
  name: string;
  year: number;
  summary: string;
  territoriesRle: RleStringRuns;
  religionsRle: RleStringRuns;
  culturesRle: RleStringRuns;
  cities: City[];
  tradeRoutes: TradeRoute[];
  kingdoms: Kingdom[];
  religionList: Religion[];
  cultureList: Culture[];
}

export interface WorldTimeline {
  calendarUnit: string;
  activeEraId: string;
  eras: TimelineEraSnapshot[];
  events: TimelineEvent[];
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
  terrains: number[]; // length = width * height (TerrainId)
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
  customGovernmentTypes?: CustomCategoryType[];
  customReligionTypes?: CustomCategoryType[];
  customCultureTypes?: CustomCategoryType[];
  timeline?: WorldTimeline;
  roads: RoadPath[];
  tradeRoutes: TradeRoute[];
  pois: PointOfInterest[];
  labels: MapLabel[];
}

export type ToolMode =
  | 'view'
  | 'terrain'
  | 'biome'
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
  | 'terrain'
  | 'biome'
  | 'political'
  | 'religion'
  | 'culture'
  | 'elevation'
  | 'temperature'
  | 'moisture';

export interface LayerVisibility {
  grid: boolean;
  graticule?: boolean;
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
