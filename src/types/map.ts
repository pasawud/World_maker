export enum TerrainId {
  DEEP_OCEAN = 0,
  SHALLOW_WATER = 1,
  PLAINS = 2,
  HILLS = 3,
  HIGHLAND = 4,
  MOUNTAIN = 5,
  HIGH_PEAK = 6,
  LAKE = 7,
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
  LAKE = 16,
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

export type TerrainReliefStyle =
  | 'flat'
  | 'hills'
  | 'highland'
  | 'mountain'
  | 'peak'
  | 'water'
  | 'lake'
  | 'crater'
  | 'canyon'
  | 'volcano'
  | 'plateau'
  | 'ice_shelf';

export interface CustomTerrain {
  id: number; // >= 100
  key?: string;
  nameTh: string;
  nameEn?: string;
  color: string;
  isWater: boolean;
  defaultElevation: number;
  minElevation?: number;
  maxElevation?: number;
  moveCost: number;
  reliefStyle: TerrainReliefStyle;
  description?: string;
}

export interface CustomBiome {
  id: number; // >= 100
  nameTh: string;
  nameEn?: string;
  color: string;
  isWater: boolean;
  defaultElevation: number;
  moveCost: number;
  detailStyle: BiomeDetailStyle;
  goodsBonus?: string[];
  description?: string;
}

export interface CustomPoiType {
  id: string;
  label: string;
  symbol: string;
  color: string;
  isCustom?: boolean;
}

export type FeatureVisualStyle =
  | 'default'
  | 'volcano'
  | 'oasis'
  | 'ruins'
  | 'crystal'
  | 'reef'
  | 'whirlpool'
  | 'geothermal'
  | 'mesa'
  | 'waterfall'
  | 'custom';

export interface SpecialFeatureMeta {
  id: string;
  nameTh: string;
  nameEn?: string;
  color: string;
  placement: 'land' | 'water' | 'coast' | 'any';
  moveCostDelta: number;
  goodsBonus: string[];
  symbol?: string;
  visualStyle?: FeatureVisualStyle;
  description?: string;
  isCustom?: boolean;
}

export interface ManualCurrentPath {
  id: string;
  name?: string;
  kind: 'warm' | 'cold' | 'neutral';
  strength: number; // 0.3 .. 2.0
  points: HexCoord[];
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

export interface CultureLanguageProfile {
  presetId?: string;
  onsets: string[];
  nuclei: string[];
  codas: string[];
  citySuffixes: string[];
  riverSuffixes: string[];
  seaSuffixes: string[];
  personSuffixes: string[];
}

export interface CultureDetails {
  architectureStyle: string;
  languageFamily: string;
  namingStyle: string;
  traditions: string[];
  values: string[];
  clothingStyle?: string;
  languageProfile?: CultureLanguageProfile;
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
  windStrength?: number; // 0.2 .. 2.0, default 1.0
  moistureScale: number;
  riverThreshold: number;
  oceanCurrents?: boolean;
  currentStrength?: number; // 0.2 .. 2.0, default 1.0
  coriolisDirection?: 'normal' | 'reversed';
  tectonicPlates?: number; // 4..16, default 8
  tectonicStrength?: number; // 0..1.5, default 0 for legacy parity, >0 enables plate boundary mountains/rifts
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

export type MapTheme = 'standard' | 'parchment' | 'atlas' | 'dark';

export type LabelSize = 'sm' | 'md' | 'lg';
export type LabelStyle = 'region' | 'water' | 'mountain';

export interface MapLabel {
  id: string;
  text: string;
  q: number;
  r: number;
  size: LabelSize;
  style: LabelStyle;
  rotationDeg?: number;
  curveAmount?: number; // -1..1 arc curvature
  letterSpacing?: number;
}

export type DiplomaticRelationType =
  | 'ally'
  | 'trade'
  | 'neutral'
  | 'rival'
  | 'war'
  | 'vassal';

export interface DiplomaticRelation {
  id: string;
  kingdomA: string;
  kingdomB: string;
  status: DiplomaticRelationType;
  notes?: string;
}

export interface MilitaryCampaign {
  id: string;
  name: string;
  kingdomId: string;
  targetKingdomId?: string;
  status: 'planned' | 'active' | 'victory' | 'defeat';
  year?: number;
  points: HexCoord[];
  battles?: { q: number; r: number; name: string }[];
}

export type WikiCategory =
  | 'character'
  | 'faction'
  | 'species'
  | 'legend'
  | 'history'
  | 'artifact'
  | 'location';

export interface WikiEntry {
  id: string;
  title: string;
  category: WikiCategory;
  summary: string;
  content: string;
  tags: string[];
  linkedCoord?: HexCoord;
  linkedKingdomId?: string;
  updatedAt: string;
}

export interface CameraBookmark {
  id: string;
  name: string;
  q: number;
  r: number;
  zoom: number;
}

export interface ReferenceOverlayConfig {
  imageDataUrl: string;
  opacity: number;
  visible: boolean;
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

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export interface CalendarMonth {
  id: string;
  name: string;
  days: number;
  season: SeasonId;
}

export interface WorldMoon {
  id: string;
  name: string;
  cycleDays: number;
  color: string;
}

export interface CustomTectonicPlate {
  id: string;
  name: string;
  color: string;
  centerQ: number;
  centerR: number;
  vx: number;
  vy: number;
  isOceanic?: boolean;
}

export type ManualWindKind = 'trade' | 'westerlies' | 'monsoon' | 'gale' | 'calm';

export interface ManualWindPath {
  id: string;
  name?: string;
  kind: ManualWindKind;
  strength: number; // 0.4 .. 1.8
  points: HexCoord[];
}

export interface SubMapLink {
  id: string;
  name: string;
  bounds: SubMapBounds;
  scaleFactor: number;
}

export interface ParentMapLink {
  parentMapId: string;
  parentMapName: string;
  bounds: SubMapBounds;
  scaleFactor: number;
}

export interface WorldCalendar {
  name: string;
  year: number;
  monthIdx: number; // 0-based
  day: number; // 1-based
  months: CalendarMonth[];
  moons: WorldMoon[];
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
  customTerrains?: CustomTerrain[];
  customFeatures?: SpecialFeatureMeta[];
  terrainOverrides?: Record<number, Partial<Omit<CustomTerrain, 'id'>>>;
  featureOverrides?: Record<string, Partial<Omit<SpecialFeatureMeta, 'id'>>>;
  manualCurrents?: ManualCurrentPath[];
  manualWinds?: ManualWindPath[];
  customTectonicPlates?: CustomTectonicPlate[];
  parentMapLink?: ParentMapLink;
  childSubMaps?: SubMapLink[];
  customPoiTypes: CustomPoiType[];
  customGovernmentTypes?: CustomCategoryType[];
  customReligionTypes?: CustomCategoryType[];
  customCultureTypes?: CustomCategoryType[];
  timeline?: WorldTimeline;
  calendar?: WorldCalendar;
  mapTheme?: MapTheme;
  diplomacy?: DiplomaticRelation[];
  campaigns?: MilitaryCampaign[];
  wikiEntries?: WikiEntry[];
  bookmarks?: CameraBookmark[];
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
  | 'current'
  | 'wind'
  | 'city'
  | 'territory'
  | 'religion'
  | 'culture'
  | 'campaign'
  | 'submap'
  | 'road'
  | 'trade'
  | 'measure'
  | 'poi'
  | 'climate'
  | 'tectonic';

export type ClimateOverlay =
  | 'none'
  | 'terrain'
  | 'biome'
  | 'political'
  | 'religion'
  | 'culture'
  | 'elevation'
  | 'temperature'
  | 'moisture'
  | 'currents'
  | 'winds'
  | 'tectonics';

export interface LayerVisibility {
  grid: boolean;
  graticule?: boolean;
  currents?: boolean;
  winds?: boolean;
  submaps?: boolean;
  hillshade?: boolean;
  contours?: boolean;
  campaigns?: boolean;
  tectonics?: boolean;
  chokepoints?: boolean;
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

export interface SubMapBounds {
  minQ: number;
  maxQ: number;
  minR: number;
  maxR: number;
}

export type TravelSpeedId = 'foot' | 'caravan' | 'horse' | 'ship';
