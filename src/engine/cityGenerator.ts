import { CITY_BUILDING_PRESETS, CITY_DISTRICT_META } from '../data/goods';
import {
  CardinalSide,
  City,
  CityBuilding,
  CityDeepProfile,
  CityDistrict,
  CityDistrictType,
  CityGate,
  CityLayoutStyle,
  CityPlanData,
  CityRoadSegment,
  CityWallStyle,
  HexMapData,
} from '../types/map';
import { getNeighborsWithEdge, hexDistance, hexIndex, isWaterBiome } from './hexMath';
import { mulberry32 } from './noise';

export interface CityGeographySignals {
  waterSide: CardinalSide;
  hasRiver: boolean;
  riverAngle: number;
  hasCliff: boolean;
  cliffSide: CardinalSide;
}

function edgeToCardinal(edge: number): CardinalSide {
  switch (edge) {
    case 0:
      return 'east';
    case 1:
    case 2:
      return 'south';
    case 3:
      return 'west';
    case 4:
    case 5:
    default:
      return 'north';
  }
}

export function cardinalToAngle(side: CardinalSide): number {
  switch (side) {
    case 'east':
      return 0;
    case 'south':
      return Math.PI / 2;
    case 'west':
      return Math.PI;
    case 'north':
      return -Math.PI / 2;
    default:
      return 0;
  }
}

/** Analyze ocean coastlines, river courses, and cliffs around a city hex. */
export function analyzeCityGeography(map: HexMapData, city: City): CityGeographySignals {
  const nbs = getNeighborsWithEdge(city.q, city.r, map.width, map.height);
  let waterSide: CardinalSide = 'none';
  let cliffSide: CardinalSide = 'none';
  const cityIdx = hexIndex(city.q, city.r, map.width);
  let hasCliff = map.features?.[cityIdx] === 'cliff';

  for (const nb of nbs) {
    if (!nb.inMap) continue;
    const nbIdx = hexIndex(nb.q, nb.r, map.width);
    if (waterSide === 'none' && isWaterBiome(map.biomes[nbIdx], map.customBiomes)) {
      waterSide = edgeToCardinal(nb.edge);
    }
    if (map.features?.[nbIdx] === 'cliff') {
      hasCliff = true;
      if (cliffSide === 'none') {
        cliffSide = edgeToCardinal(nb.edge);
      }
    }
  }

  if (hasCliff && cliffSide === 'none') {
    cliffSide = waterSide !== 'none' ? waterSide : 'north';
  }

  let hasRiver = false;
  let riverAngle = Math.PI * 0.25;
  for (const rv of map.rivers) {
    for (let i = 0; i < rv.points.length; i++) {
      const pt = rv.points[i];
      if (hexDistance({ q: city.q, r: city.r }, pt) <= 1) {
        hasRiver = true;
        const prev = rv.points[Math.max(0, i - 1)];
        const next = rv.points[Math.min(rv.points.length - 1, i + 1)];
        if (next.q !== prev.q || next.r !== prev.r) {
          riverAngle = Math.atan2(next.r - prev.r, next.q - prev.q);
        }
        break;
      }
    }
    if (hasRiver) break;
  }

  return { waterSide, hasRiver, riverAngle, hasCliff, cliffSide };
}

/** Generate a full interactive 2D city plan aligned with the city's actual map geography, religion & tier. */
export function generateCityPlan(
  map: HexMapData,
  city: City,
  options?: { seed?: number; layoutStyle?: CityLayoutStyle }
): CityPlanData {
  const seed =
    options?.seed ??
    Math.abs(((city.q * 73856093) ^ (city.r * 19349663) ^ city.name.length * 997) >>> 0) + 17;
  const rng = mulberry32(seed);
  const geo = analyzeCityGeography(map, city);

  const layoutStyle: CityLayoutStyle =
    options?.layoutStyle ??
    (geo.waterSide !== 'none'
      ? 'coastal_crescent'
      : geo.hasRiver
      ? 'river_twin'
      : geo.hasCliff
      ? 'hilltop_fort'
      : city.tier === 'capital'
      ? 'radial'
      : 'grid');

  const wallStyle: CityWallStyle =
    city.tier === 'village'
      ? 'none'
      : city.tier === 'town'
      ? 'wooden'
      : city.tier === 'capital'
      ? 'citadel_double'
      : 'stone';

  const hasWalls = wallStyle !== 'none';
  const wallRadius =
    city.tier === 'capital'
      ? 320
      : city.tier === 'city'
      ? 280
      : city.tier === 'port'
      ? 255
      : city.tier === 'town'
      ? 220
      : 165;

  const cx = 500;
  const cy = 500;
  const districts: CityDistrict[] = [];
  const buildings: CityBuilding[] = [];
  const roads: CityRoadSegment[] = [];
  const gates: CityGate[] = [];

  const rel = map.religionList.find((r) => r.id === city.religionId);
  const addDistrict = (
    type: CityDistrictType,
    x: number,
    y: number,
    radius: number,
    populationShare: number,
    customName?: string
  ): CityDistrict => {
    const meta = CITY_DISTRICT_META[type];
    const d: CityDistrict = {
      id: `dist_${districts.length + 1}_${Math.floor(rng() * 1000)}`,
      name: customName ?? meta.defaultName,
      type,
      x: Math.round(Math.max(85, Math.min(915, x))),
      y: Math.round(Math.max(85, Math.min(915, y))),
      radius: Math.round(radius),
      color: meta.color,
      populationShare,
    };
    districts.push(d);
    return d;
  };

  const addBuilding = (
    category: CityBuilding['category'],
    name: string,
    x: number,
    y: number,
    districtId?: string,
    symbolOverride?: string,
    religionId?: string
  ) => {
    const preset = CITY_BUILDING_PRESETS.find((p) => p.category === category);
    buildings.push({
      id: `bld_${buildings.length + 1}_${Math.floor(rng() * 1000)}`,
      name,
      category,
      symbol: symbolOverride || preset?.symbol || '🏛️',
      x: Math.round(Math.max(70, Math.min(930, x))),
      y: Math.round(Math.max(70, Math.min(930, y))),
      districtId,
      religionId,
    });
  };

  // Shift inland center away from sea when coastal
  const waterAngle = cardinalToAngle(geo.waterSide);
  const shiftX = geo.waterSide !== 'none' ? -Math.cos(waterAngle) * 55 : 0;
  const shiftY = geo.waterSide !== 'none' ? -Math.sin(waterAngle) * 55 : 0;
  const coreX = cx + shiftX;
  const coreY = cy + shiftY;

  // 1. Core citadel / town hall
  if (city.tier === 'village') {
    const resD = addDistrict('residential', coreX, coreY, 88, 55, 'ใจกลางหมู่บ้าน');
    addBuilding('tavern', `ลานประชุมและโรงเตี๊ยม${city.name}`, coreX - 15, coreY + 12, resD.id);
  } else {
    const citX = geo.hasCliff ? coreX + Math.cos(cardinalToAngle(geo.cliffSide)) * 45 : coreX;
    const citY = geo.hasCliff ? coreY + Math.sin(cardinalToAngle(geo.cliffSide)) * 45 : coreY;
    const citD = addDistrict(
      'citadel',
      citX,
      citY,
      city.tier === 'capital' ? 92 : 74,
      10,
      city.tier === 'capital' ? 'เขตพระราชวังหลวง' : 'ป้อมปราการเจ้าเมือง'
    );
    addBuilding(
      city.tier === 'capital' ? 'palace' : 'fortress',
      city.tier === 'capital' ? `พระราชวังแห่ง${city.name}` : `ป้อมปราการ${city.name}`,
      citX,
      citY,
      citD.id
    );
  }

  // 2. Harbor if coastal
  if (geo.waterSide !== 'none') {
    const hx = cx + Math.cos(waterAngle) * (wallRadius * 0.72);
    const hy = cy + Math.sin(waterAngle) * (wallRadius * 0.72);
    const harbD = addDistrict('harbor', hx, hy, 86, 20);
    addBuilding('port', `ท่าเรือใหญ่${city.name}`, hx, hy, harbD.id);
  }

  // 3. Temple district linked to primary religion (+ secondary shrine if mixed)
  const templeAngle = geo.waterSide !== 'none' ? waterAngle + Math.PI * 0.65 : -Math.PI * 0.35;
  const templeDist = city.tier === 'village' ? 75 : 135;
  const tx = coreX + Math.cos(templeAngle) * templeDist;
  const ty = coreY + Math.sin(templeAngle) * templeDist;
  const tempD = addDistrict(
    'temple',
    tx,
    ty,
    city.tier === 'capital' ? 76 : 60,
    8,
    rel ? `เขตวิหาร${rel.name}` : 'เขตมหาวิหาร'
  );
  addBuilding(
    'temple',
    rel
      ? `${city.tier === 'capital' ? 'มหาวิหาร' : 'วิหาร'}${rel.name}`
      : 'วิหารประจำเมือง',
    tx,
    ty,
    tempD.id,
    rel?.symbol || '⛪',
    rel?.id
  );

  // Secondary shrine if city profile has notable secondary religion
  const secondaryRelSlice = city.profile?.religionMix?.find(
    (s) => s.id !== city.religionId && s.percent >= 15
  );
  if (secondaryRelSlice) {
    const secRel = map.religionList.find((r) => r.id === secondaryRelSlice.id);
    if (secRel) {
      addBuilding(
        'temple',
        `ศาลบูชา${secRel.name}`,
        tx + 44,
        ty + 34,
        tempD.id,
        secRel.symbol,
        secRel.id
      );
    }
  }

  // 4. Market & Craftsmen
  const marketAngle = templeAngle + Math.PI * 0.65;
  const mktDist = city.tier === 'village' ? 95 : 145;
  const mx = coreX + Math.cos(marketAngle) * mktDist;
  const my = coreY + Math.sin(marketAngle) * mktDist;
  const mktD = addDistrict('market', mx, my, city.tier === 'capital' ? 84 : 68, 22);
  addBuilding('market', `ตลาดกลาง${city.name}`, mx, my, mktD.id);

  if (city.tier !== 'village') {
    const craftAngle = marketAngle + Math.PI * 0.55;
    const crx = coreX + Math.cos(craftAngle) * 165;
    const cry = coreY + Math.sin(craftAngle) * 165;
    const crD = addDistrict('craftsmen', crx, cry, 70, 18);
    addBuilding('guild', 'สมาคมช่างฝีมือและโรงหลอม', crx, cry, crD.id);
  }

  // 5. Higher tier districts (noble, academy, barracks, residential)
  if (city.tier === 'city' || city.tier === 'capital' || city.tier === 'port') {
    const resAngle = templeAngle - Math.PI * 0.45;
    addDistrict(
      'residential',
      coreX + Math.cos(resAngle) * 165,
      coreY + Math.sin(resAngle) * 165,
      86,
      26
    );
  }

  if (city.tier === 'city' || city.tier === 'capital') {
    const nobD = addDistrict('noble', coreX - 95, coreY - 95, 68, 8);
    addBuilding('monument', 'จัตุรัสอนุสาวรีย์', coreX - 95, coreY - 95, nobD.id);

    const barD = addDistrict('barracks', coreX + 125, coreY - 120, 62, 6);
    addBuilding('fortress', 'กองบัญชาการทหารรักษาการณ์', coreX + 125, coreY - 120, barD.id);
  }

  if (city.tier === 'capital') {
    const acaD = addDistrict('academy', coreX - 155, coreY + 115, 68, 5);
    addBuilding('academy', `หอสมุดและราชบัณฑิตยสถาน`, coreX - 155, coreY + 115, acaD.id);
  }

  // 6. Outer farmstead outside walls
  const farmAngle = geo.waterSide !== 'none' ? waterAngle + Math.PI : Math.PI * 0.78;
  const farmRadius = hasWalls ? wallRadius + 95 : 230;
  addDistrict(
    'farmstead',
    cx + Math.cos(farmAngle) * farmRadius,
    cy + Math.sin(farmAngle) * farmRadius,
    82,
    10
  );

  // 7. Gates and main roads
  const candidateAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const gateNames = ['ประตูบูรพา', 'ประตูทักษิณ', 'ประตูปัจฉิม', 'ประตูอุดร'];
  const maxGates = city.tier === 'capital' ? 4 : city.tier === 'town' ? 2 : 3;

  for (let i = 0; i < candidateAngles.length && gates.length < maxGates; i++) {
    const ang = candidateAngles[i];
    if (geo.waterSide !== 'none') {
      const diff = Math.abs(Math.atan2(Math.sin(ang - waterAngle), Math.cos(ang - waterAngle)));
      if (diff < 0.75) continue;
    }
    gates.push({
      id: `gate_${gates.length + 1}`,
      name: gateNames[i],
      angle: ang,
    });
  }

  if (hasWalls) {
    for (const gate of gates) {
      const gx = cx + Math.cos(gate.angle) * wallRadius;
      const gy = cy + Math.sin(gate.angle) * wallRadius;
      const ox = cx + Math.cos(gate.angle) * (wallRadius + 135);
      const oy = cy + Math.sin(gate.angle) * (wallRadius + 135);
      roads.push({
        id: `road_gate_${gate.id}`,
        kind: 'main',
        points: [
          { x: Math.round(ox), y: Math.round(oy) },
          { x: Math.round(gx), y: Math.round(gy) },
          { x: Math.round(coreX), y: Math.round(coreY) },
        ],
      });
    }
  } else {
    roads.push({
      id: 'road_village_main',
      kind: 'main',
      points: [
        { x: 180, y: 510 },
        { x: Math.round(coreX), y: Math.round(coreY) },
        { x: 820, y: 490 },
      ],
    });
  }

  // Connect districts to core with secondary alleys
  for (let i = 0; i < districts.length; i++) {
    const d = districts[i];
    if (d.type === 'farmstead' || d.type === 'citadel') continue;
    roads.push({
      id: `road_dist_${i + 1}`,
      kind: 'alley',
      points: [
        { x: Math.round(coreX), y: Math.round(coreY) },
        { x: d.x, y: d.y },
      ],
    });
  }

  // Add bridge across river if river runs through city
  if (geo.hasRiver) {
    const perp = geo.riverAngle + Math.PI / 2;
    roads.push({
      id: 'road_river_bridge',
      kind: 'bridge',
      points: [
        { x: Math.round(cx - Math.cos(perp) * 90), y: Math.round(cy - Math.sin(perp) * 90) },
        { x: Math.round(cx + Math.cos(perp) * 90), y: Math.round(cy + Math.sin(perp) * 90) },
      ],
    });
  }

  return {
    seed,
    layoutStyle,
    hasWalls,
    wallStyle,
    wallRadius,
    waterSide: geo.waterSide,
    hasRiver: geo.hasRiver,
    riverAngle: geo.riverAngle,
    hasCliff: geo.hasCliff,
    cliffSide: geo.cliffSide,
    theme: 'parchment',
    showLabels: true,
    showFarms: true,
    showTrees: true,
    density: 1.0,
    districts,
    buildings,
    roads,
    gates,
  };
}

/** Build sensible default deep profile for a city from its culture, religion, and tier. */
export function createDefaultCityProfile(map: HexMapData, city: City): CityDeepProfile {
  const culture = (map.cultureList ?? []).find((c) => c.id === city.cultureId);
  const garrisonRatio =
    city.tier === 'capital' ? 0.08 : city.tier === 'city' ? 0.06 : city.tier === 'port' ? 0.05 : 0.04;
  const defenseRating =
    city.tier === 'capital' ? 9 : city.tier === 'city' ? 7 : city.tier === 'port' ? 6 : city.tier === 'town' ? 4 : 2;

  return {
    motto: '',
    rulerName: '',
    garrisonSize: Math.max(40, Math.round(city.population * garrisonRatio)),
    defenseRating,
    foundedYear: 1,
    architectureStyle: culture?.details?.architectureStyle || 'medieval',
    religionMix: city.religionId ? [{ id: city.religionId, percent: 100 }] : [],
    cultureMix: city.cultureId ? [{ id: city.cultureId, percent: 100 }] : [],
  };
}
