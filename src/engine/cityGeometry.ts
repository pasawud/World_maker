import {
  City,
  CityDistrict,
  CityDistrictType,
  CityPlanData,
} from '../types/map';
import { cardinalToAngle } from './cityGenerator';
import { mulberry32 } from './noise';

export interface Point2D {
  x: number;
  y: number;
}

export interface CityWardGeometry {
  polygon: Point2D[];
  districtId?: string;
  districtType: CityDistrictType;
  districtColor: string;
  isCitadelOrPark: boolean;
  buildings: Point2D[][];
  trees: { x: number; y: number; r: number }[];
}

export interface CityFarmField {
  polygon: Point2D[];
  hatchAngle: number;
}

export interface CityGeometry {
  center: Point2D;
  wallPolygon: Point2D[];
  wallChains: Point2D[][];
  towers: Point2D[];
  waterPolygon: Point2D[] | null;
  waterContours: Point2D[][];
  piers: { x1: number; y1: number; x2: number; y2: number }[];
  riverPath: Point2D[] | null;
  cliffArc: { x: number; y: number; nx: number; ny: number }[];
  plazaPolygon: Point2D[];
  plazaHall: Point2D[];
  plazaFountain: Point2D;
  wards: CityWardGeometry[];
  suburbBuildings: Point2D[][];
  outerRoads: Point2D[][];
  farmFields: CityFarmField[];
  treeClusters: { x: number; y: number; r: number }[];
}

export function pointInPolygon(pt: Point2D, poly: Point2D[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(poly: Point2D[]): Point2D {
  if (poly.length === 0) return { x: 500, y: 500 };
  let sx = 0;
  let sy = 0;
  for (const p of poly) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / poly.length, y: sy / poly.length };
}

export function insetPolygon(poly: Point2D[], amount: number): Point2D[] {
  if (poly.length < 3) return poly;
  const c = polygonCentroid(poly);
  return poly.map((p) => {
    const dx = c.x - p.x;
    const dy = c.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return p;
    const step = Math.min(amount, dist * 0.42);
    return {
      x: p.x + (dx / dist) * step,
      y: p.y + (dy / dist) * step,
    };
  });
}

function distPointToSegment(pt: Point2D, a: Point2D, b: Point2D): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 < 1e-9) return Math.hypot(pt.x - a.x, pt.y - a.y);
  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * vx + (pt.y - a.y) * vy) / len2));
  return Math.hypot(pt.x - (a.x + t * vx), pt.y - (a.y + t * vy));
}

function distToPolyline(pt: Point2D, line: Point2D[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const d = distPointToSegment(pt, line[i], line[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

function normalizeAngle(a: number): number {
  let res = a;
  while (res <= -Math.PI) res += Math.PI * 2;
  while (res > Math.PI) res -= Math.PI * 2;
  return res;
}

function angleDiff(a: number, b: number): number {
  return Math.abs(normalizeAngle(a - b));
}

/**
 * Build full procedural Watabou-style medieval city geometry (polygonal walls, towers,
 * coastal bay + 5 shoreline contours + piers, packed street-aligned ward buildings,
 * central plaza, suburban ribbon houses, hatched farm fields, and tree clusters).
 */
export function buildCityGeometry(plan: CityPlanData, city: City): CityGeometry {
  const rng = mulberry32(plan.seed * 31 + 101);
  const density = Math.max(0.6, Math.min(1.5, plan.density ?? 1.0));
  const wallR = Math.max(140, Math.min(365, plan.wallRadius || 260));

  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  const wallRadiusAt = (ang: number): number =>
    wallR *
    (0.91 +
      0.095 * Math.sin(2 * ang + p1) +
      0.055 * Math.cos(3 * ang + p2) +
      0.028 * Math.sin(5 * ang + p1 * 0.7));

  const bayBaseAngle =
    plan.waterSide === 'none'
      ? 0
      : plan.layoutStyle === 'coastal_crescent' &&
        (plan.waterSide === 'east' || plan.waterSide === 'south')
      ? cardinalToAngle(plan.waterSide) + 0.35
      : cardinalToAngle(plan.waterSide);

  const center: Point2D = {
    x: 500 - (plan.waterSide !== 'none' ? Math.cos(bayBaseAngle) * 32 : 0),
    y: 500 - (plan.waterSide !== 'none' ? Math.sin(bayBaseAngle) * 32 : 0),
  };

  // A. Coastal Bay Water Polygon + 5 Concentric Contours + Wooden Piers
  let waterPolygon: Point2D[] | null = null;
  const waterContours: Point2D[][] = [];
  const piers: { x1: number; y1: number; x2: number; y2: number }[] = [];

  if (plan.waterSide !== 'none') {
    const ux = Math.cos(bayBaseAngle);
    const uy = Math.sin(bayBaseAngle);
    const px = -uy;
    const py = ux;

    const shorePts: Point2D[] = [];
    const shoreSteps = 11;
    const halfSpan = wallR * 1.65;
    for (let i = 0; i <= shoreSteps; i++) {
      const t = i / shoreSteps;
      const lat = (t * 2 - 1) * halfSpan;
      // Indented bay cove near center of span
      const coveDepth = Math.exp(-Math.pow(lat / (wallR * 0.62), 2)) * (wallR * 0.62);
      const jitter = (rng() - 0.5) * 18;
      const distFromCenter = wallR * 0.94 - coveDepth + jitter;
      shorePts.push({
        x: 500 + ux * distFromCenter + px * lat,
        y: 500 + uy * distFromCenter + py * lat,
      });
    }

    // Close polygon far out in the bay direction
    const far1 = {
      x: 500 + ux * 1300 + px * 1100,
      y: 500 + uy * 1300 + py * 1100,
    };
    const far2 = {
      x: 500 + ux * 1300 - px * 1100,
      y: 500 + uy * 1300 - py * 1100,
    };
    waterPolygon = [...shorePts, far1, far2];

    const contourOffsets = [11, 24, 39, 57, 78];
    for (const off of contourOffsets) {
      waterContours.push(
        shorePts.map((pt) => ({
          x: pt.x + ux * off,
          y: pt.y + uy * off,
        }))
      );
    }

    // Place 4-5 wooden piers jutting out from the inner bay shoreline
    const pierIndices = [3, 4, 5, 6, 7];
    for (const idx of pierIndices) {
      if (idx >= shorePts.length - 1) continue;
      const a = shorePts[idx];
      const b = shorePts[idx + 1];
      const mx = (a.x + b.x) * 0.5;
      const my = (a.y + b.y) * 0.5;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      // Normal pointing into the bay (same general direction as ux, uy)
      let nx = -dy / len;
      let ny = dx / len;
      if (nx * ux + ny * uy < 0) {
        nx = -nx;
        ny = -ny;
      }
      const pierLen = 24 + rng() * 14;
      piers.push({
        x1: mx - nx * 2,
        y1: my - ny * 2,
        x2: mx + nx * pierLen,
        y2: my + ny * pierLen,
      });
    }
  }

  // River Path (if hasRiver)
  let riverPath: Point2D[] | null = null;
  if (plan.hasRiver) {
    const rAng = plan.riverAngle ?? Math.PI * 0.25;
    const rx = Math.cos(rAng);
    const ry = Math.sin(rAng);
    const rpx = -ry;
    const rpy = rx;
    riverPath = [];
    for (let i = -8; i <= 8; i++) {
      const s = i * 95;
      const bend = Math.sin(i * 0.65 + p1) * 32;
      riverPath.push({
        x: 500 + rx * s + rpx * bend,
        y: 500 + ry * s + rpy * bend,
      });
    }
  }

  // B. Organic Polygonal Curtain Wall + Towers
  const wallVertCount =
    city.tier === 'capital' ? 16 : city.tier === 'town' ? 12 : 14;
  const wallPolygon: Point2D[] = [];
  for (let i = 0; i < wallVertCount; i++) {
    const ang = (i / wallVertCount) * Math.PI * 2;
    const rad = wallRadiusAt(ang) + (rng() - 0.5) * 8;
    wallPolygon.push({
      x: 500 + Math.cos(ang) * rad,
      y: 500 + Math.sin(ang) * rad,
    });
  }

  const isInWater = (pt: Point2D): boolean =>
    waterPolygon !== null && pointInPolygon(pt, waterPolygon);

  const wallChains: Point2D[][] = [];
  const towers: Point2D[] = [];
  const gateAngles = plan.gates.map((g) => g.angle);

  if (plan.hasWalls && plan.wallStyle !== 'none') {
    const segs: Point2D[][] = [];
    let curChain: Point2D[] = [];

    for (let i = 0; i < wallVertCount; i++) {
      const pt = wallPolygon[i];
      if (!isInWater(pt)) {
        curChain.push(pt);
      } else {
        if (curChain.length >= 2) {
          segs.push(curChain);
        }
        curChain = [];
      }
    }
    if (curChain.length >= 2) {
      // Merge wrap-around chain if index 0 and last are both landward
      if (
        segs.length > 0 &&
        !isInWater(wallPolygon[0]) &&
        !isInWater(wallPolygon[wallVertCount - 1])
      ) {
        segs[0] = [...curChain, ...segs[0]];
      } else {
        segs.push(curChain);
      }
    } else if (curChain.length === 1 && segs.length > 0 && !isInWater(wallPolygon[0])) {
      segs[0] = [curChain[0], ...segs[0]];
    }

    // If fully landlocked, close the loop
    if (segs.length === 1 && !waterPolygon) {
      segs[0].push(segs[0][0]);
    }

    // Split wall segments slightly at gate intersections and collect bastion towers
    for (const seg of segs) {
      let currentPart: Point2D[] = [seg[0]];
      for (let i = 0; i < seg.length - 1; i++) {
        const a = seg[i];
        const b = seg[i + 1];
        const midAng = Math.atan2((a.y + b.y) * 0.5 - 500, (a.x + b.x) * 0.5 - 500);
        const edgeAngSpan = Math.hypot(b.x - a.x, b.y - a.y) / wallR;

        const matchingGate = gateAngles.find((ga) => angleDiff(ga, midAng) < edgeAngSpan * 0.55);
        if (matchingGate !== undefined) {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const gapHalf = Math.min(9.5, len * 0.25);
          const mx = (a.x + b.x) * 0.5;
          const my = (a.y + b.y) * 0.5;
          const g1 = { x: mx - (dx / len) * gapHalf, y: my - (dy / len) * gapHalf };
          const g2 = { x: mx + (dx / len) * gapHalf, y: my + (dy / len) * gapHalf };
          currentPart.push(g1);
          wallChains.push(currentPart);
          towers.push(g1, g2);
          currentPart = [g2, b];
        } else {
          currentPart.push(b);
        }
      }
      if (currentPart.length >= 2) {
        wallChains.push(currentPart);
      }
    }

    // Add vertex bastion towers
    for (let i = 0; i < wallVertCount; i++) {
      const pt = wallPolygon[i];
      if (!isInWater(pt)) {
        towers.push(pt);
      }
    }
  }

  // Cliff escarpment points
  const cliffArc: { x: number; y: number; nx: number; ny: number }[] = [];
  if (plan.hasCliff) {
    const cAng = cardinalToAngle(plan.cliffSide === 'none' ? 'north' : plan.cliffSide);
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const a = cAng - 0.72 + (i / steps) * 1.44;
      const r = wallR + 22;
      cliffArc.push({
        x: 500 + Math.cos(a) * r,
        y: 500 + Math.sin(a) * r,
        nx: Math.cos(a),
        ny: Math.sin(a),
      });
    }
  }

  // C. Central Market Plaza + Hall + Fountain
  const plazaPts: Point2D[] = [];
  const plazaR = city.tier === 'village' ? 28 : city.tier === 'town' ? 36 : 44;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.25;
    const rr = plazaR * (0.85 + rng() * 0.26);
    plazaPts.push({
      x: center.x + Math.cos(a) * rr,
      y: center.y + Math.sin(a) * rr,
    });
  }

  const hallAngle = rng() * 0.8 - 0.4;
  const hx = center.x + 10;
  const hy = center.y + 8;
  const hw = 14;
  const hh = 21;
  const ch = Math.cos(hallAngle);
  const sh = Math.sin(hallAngle);
  const plazaHall: Point2D[] = [
    { x: hx + (-hw * ch - -hh * sh), y: hy + (-hw * sh + -hh * ch) },
    { x: hx + (hw * ch - -hh * sh), y: hy + (hw * sh + -hh * ch) },
    { x: hx + (hw * ch - hh * sh), y: hy + (hw * sh + hh * ch) },
    { x: hx + (-hw * ch - hh * sh), y: hy + (-hw * sh + hh * ch) },
  ];
  const plazaFountain: Point2D = { x: center.x - 12, y: center.y - 10 };

  // D. Radial-Ring Polygonal Wards
  const numRings =
    city.tier === 'village'
      ? 2
      : city.tier === 'town'
      ? 3
      : city.tier === 'capital'
      ? 5
      : 4;

  const nonFarmDistricts = plan.districts.filter((d) => d.type !== 'farmstead');
  const findNearestDistrict = (pt: Point2D): CityDistrict | null => {
    let best: CityDistrict | null = null;
    let bestD = Infinity;
    for (const d of nonFarmDistricts) {
      const dist = Math.hypot(d.x - pt.x, d.y - pt.y);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  };

  const citadelDist = plan.districts.find((d) => d.type === 'citadel');
  const wards: CityWardGeometry[] = [];
  const treeClusters: { x: number; y: number; r: number }[] = [];

  const innerRBase = plazaR + 8;
  const outerRBase = wallR - 12;

  for (let ring = 0; ring < numRings; ring++) {
    const t0 = ring / numRings;
    const t1 = (ring + 1) / numRings;
    const sectorCount = Math.max(6, Math.round((7 + ring * 4.5) * density));
    const phaseShift = (ring % 2) * (Math.PI / sectorCount);

    for (let s = 0; s < sectorCount; s++) {
      let a0 = (s / sectorCount) * Math.PI * 2 + phaseShift - Math.PI;
      let a1 = ((s + 1) / sectorCount) * Math.PI * 2 + phaseShift - Math.PI;

      // Snap near gate rays so arterial streets run cleanly to gates
      for (const ga of gateAngles) {
        const snapTol = (Math.PI * 2) / (sectorCount * 2.6);
        if (angleDiff(a0, ga) < snapTol) a0 = ga;
        if (angleDiff(a1, ga) < snapTol) a1 = ga;
      }
      if (a1 - a0 < 0.08) continue;

      const rAt = (ang: number, t: number): Point2D => {
        const outerAt = wallRadiusAt(ang) * 0.94;
        const rad = innerRBase + (outerAt - innerRBase) * t;
        const x = center.x + (500 - center.x) * t + Math.cos(ang) * rad;
        const y = center.y + (500 - center.y) * t + Math.sin(ang) * rad;
        return { x, y };
      };

      const rawPoly = [rAt(a0, t0), rAt(a1, t0), rAt(a1, t1), rAt(a0, t1)];
      const centroid = polygonCentroid(rawPoly);

      if (isInWater(centroid)) continue;
      if (riverPath && distToPolyline(centroid, riverPath) < 22) continue;
      if (plan.hasWalls && Math.hypot(centroid.x - 500, centroid.y - 500) > outerRBase + 16) continue;

      const isOnGateRoad0 = gateAngles.some((ga) => angleDiff(a0, ga) < 0.06);
      const isOnGateRoad1 = gateAngles.some((ga) => angleDiff(a1, ga) < 0.06);
      const insetAmt = isOnGateRoad0 || isOnGateRoad1 ? 5.6 : 3.9;
      const wardPoly = insetPolygon(rawPoly, insetAmt);

      const nearestDist = findNearestDistrict(centroid);
      const distType: CityDistrictType = nearestDist?.type ?? 'residential';
      const distColor = nearestDist?.color ?? '#64748b';

      const nearCitadel =
        citadelDist &&
        ring === numRings - 1 &&
        Math.hypot(centroid.x - citadelDist.x, centroid.y - citadelDist.y) < 95;
      const isCastlePark =
        (Boolean(nearCitadel) || (ring === numRings - 1 && s === Math.floor(sectorCount * 0.72))) &&
        city.tier !== 'village';

      const wardBuildings: Point2D[][] = [];
      const wardTrees: { x: number; y: number; r: number }[] = [];

      if (isCastlePark) {
        // Open citadel/castle yard with a few scattered trees (like upper yard in screenshot)
        if (plan.showTrees !== false) {
          for (let t = 0; t < 5; t++) {
            const tx = centroid.x + (rng() - 0.5) * 34;
            const ty = centroid.y + (rng() - 0.5) * 34;
            if (pointInPolygon({ x: tx, y: ty }, wardPoly)) {
              wardTrees.push({ x: tx, y: ty, r: 4.5 + rng() * 4 });
            }
          }
        }
      } else {
        // E. Edge-Aligned Medieval Building Packing
        const wc = polygonCentroid(wardPoly);
        for (let ei = 0; ei < wardPoly.length; ei++) {
          const ea = wardPoly[ei];
          const eb = wardPoly[(ei + 1) % wardPoly.length];
          const edx = eb.x - ea.x;
          const edy = eb.y - ea.y;
          const edgeLen = Math.hypot(edx, edy);
          if (edgeLen < 12) continue;

          const tx = edx / edgeLen;
          const ty = edy / edgeLen;
          // Inward normal pointing toward ward centroid
          let nx = -ty;
          let ny = tx;
          const midX = (ea.x + eb.x) * 0.5;
          const midY = (ea.y + eb.y) * 0.5;
          if (nx * (wc.x - midX) + ny * (wc.y - midY) < 0) {
            nx = -nx;
            ny = -ny;
          }
          const maxDepthToCenter = Math.hypot(wc.x - midX, wc.y - midY) * 0.62;

          let pos = 0.8;
          while (pos + 9 < edgeLen - 0.8) {
            const baseLotW =
              distType === 'noble' || distType === 'temple'
                ? 13 + rng() * 11
                : distType === 'market'
                ? 11 + rng() * 9
                : 9 + rng() * 10;
            const lotW = Math.min(baseLotW, edgeLen - 0.8 - pos);
            if (lotW < 7.5) break;

            const depth = Math.min(9.5 + rng() * 11.5, maxDepthToCenter);
            if (depth >= 7) {
              const pad = 0.55;
              const p1 = { x: ea.x + tx * (pos + pad), y: ea.y + ty * (pos + pad) };
              const p2 = { x: ea.x + tx * (pos + lotW - pad), y: ea.y + ty * (pos + lotW - pad) };
              const p3 = { x: p2.x + nx * depth, y: p2.y + ny * depth };
              const p4 = { x: p1.x + nx * depth, y: p1.y + ny * depth };
              const bCenter = {
                x: (p1.x + p2.x + p3.x + p4.x) * 0.25,
                y: (p1.y + p2.y + p3.y + p4.y) * 0.25,
              };
              if (!isInWater(bCenter) && pointInPolygon(bCenter, wardPoly)) {
                wardBuildings.push([p1, p2, p3, p4]);
              }
            }
            pos += lotW;
          }
        }

        // Occasional courtyard tree inside spacious wards
        if (plan.showTrees !== false && rng() < 0.45) {
          const tx = wc.x + (rng() - 0.5) * 10;
          const ty = wc.y + (rng() - 0.5) * 10;
          if (pointInPolygon({ x: tx, y: ty }, wardPoly)) {
            wardTrees.push({ x: tx, y: ty, r: 4 + rng() * 3.5 });
          }
        }
      }

      wards.push({
        polygon: wardPoly,
        districtId: nearestDist?.id,
        districtType: distType,
        districtColor: distColor,
        isCitadelOrPark: isCastlePark,
        buildings: wardBuildings,
        trees: wardTrees,
      });
    }
  }

  // F. Outer Roads & Suburban Ribbon Houses outside each gate
  const outerRoads: Point2D[][] = [];
  const suburbBuildings: Point2D[][] = [];
  const roadAngles =
    gateAngles.length > 0 ? gateAngles : [0.2, Math.PI * 0.72, -Math.PI * 0.58];

  for (const ang of roadAngles) {
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const px = -uy;
    const py = ux;

    const startR = plan.hasWalls ? wallRadiusAt(ang) - 8 : 65;
    const bendSign = rng() < 0.5 ? 1 : -1;
    const rPts: Point2D[] = [];
    for (let step = 0; step <= 6; step++) {
      const d = startR + step * 72;
      const curve = Math.pow(step / 6, 1.5) * 26 * bendSign;
      rPts.push({
        x: 500 + ux * d + px * curve,
        y: 500 + uy * d + py * curve,
      });
    }
    if (!isInWater(rPts[1])) {
      outerRoads.push(rPts);

      // Suburban houses along both sides of road outside gate
      const subStart = wallRadiusAt(ang) + 12;
      for (const side of [-1, 1]) {
        let d = subStart;
        const limit = subStart + 88;
        while (d < limit) {
          const hw = 10 + rng() * 10;
          const hd = 9 + rng() * 8;
          const t = Math.max(0, (d - startR) / (6 * 72));
          const curve = Math.pow(t, 1.5) * 26 * bendSign;
          const cx0 = 500 + ux * d + px * (curve + side * (7.5 + hd * 0.5));
          const cy0 = 500 + uy * d + py * (curve + side * (7.5 + hd * 0.5));
          if (!isInWater({ x: cx0, y: cy0 }) && rng() < 0.8) {
            const hhw = hw * 0.5;
            const hhd = hd * 0.5;
            suburbBuildings.push([
              { x: cx0 - ux * hhw - px * hhd, y: cy0 - uy * hhw - py * hhd },
              { x: cx0 + ux * hhw - px * hhd, y: cy0 + uy * hhw - py * hhd },
              { x: cx0 + ux * hhw + px * hhd, y: cy0 + uy * hhw + py * hhd },
              { x: cx0 - ux * hhw + px * hhd, y: cy0 - uy * hhw + py * hhd },
            ]);
          }
          d += hw + 3 + rng() * 6;
        }
      }
    }
  }

  // G. Parallel-Hatched Farmland Fields outside walls
  const farmFields: CityFarmField[] = [];
  if (plan.showFarms !== false) {
    const clusterCount = 5;
    for (let c = 0; c < clusterCount; c++) {
      const baseAng = (c / clusterCount) * Math.PI * 2 + 0.35 + (rng() - 0.5) * 0.25;
      if (plan.waterSide !== 'none' && angleDiff(baseAng, bayBaseAngle) < 0.85) continue;

      const clusterDist = wallR + 68 + rng() * 55;
      const clX = 500 + Math.cos(baseAng) * clusterDist;
      const clY = 500 + Math.sin(baseAng) * clusterDist;
      const baseHatch = baseAng + (rng() - 0.5) * 0.7;

      const plots = 4 + Math.floor(rng() * 4);
      for (let p = 0; p < plots; p++) {
        const fx = clX + (rng() - 0.5) * 95;
        const fy = clY + (rng() - 0.5) * 95;
        if (Math.hypot(fx - 500, fy - 500) < wallR + 28) continue;
        if (isInWater({ x: fx, y: fy })) continue;
        if (outerRoads.some((rd) => distToPolyline({ x: fx, y: fy }, rd) < 28)) continue;
        if (riverPath && distToPolyline({ x: fx, y: fy }, riverPath) < 26) continue;

        const fw = 36 + rng() * 36;
        const fh = 24 + rng() * 26;
        const ang = baseHatch + (p % 2 === 0 ? 0 : Math.PI * 0.5) + (rng() - 0.5) * 0.14;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const pts: Point2D[] = [
          { x: fx + (-fw * 0.5 * ca - -fh * 0.5 * sa), y: fy + (-fw * 0.5 * sa + -fh * 0.5 * ca) },
          { x: fx + (fw * 0.5 * ca - -fh * 0.5 * sa), y: fy + (fw * 0.5 * sa + -fh * 0.5 * ca) },
          { x: fx + (fw * 0.5 * ca - fh * 0.5 * sa), y: fy + (fw * 0.5 * sa + fh * 0.5 * ca) },
          { x: fx + (-fw * 0.5 * ca - fh * 0.5 * sa), y: fy + (-fw * 0.5 * sa + fh * 0.5 * ca) },
        ];
        farmFields.push({ polygon: pts, hatchAngle: ang });
      }
    }
  }

  // H. Scalloped Woodland Tree Clusters around perimeter & fields
  if (plan.showTrees !== false) {
    const copseCount = 24;
    for (let i = 0; i < copseCount; i++) {
      const ang = (i / copseCount) * Math.PI * 2 + (rng() - 0.5) * 0.25;
      if (plan.waterSide !== 'none' && angleDiff(ang, bayBaseAngle) < 0.72) continue;
      const dist = wallR + 22 + rng() * 145;
      const cx0 = 500 + Math.cos(ang) * dist;
      const cy0 = 500 + Math.sin(ang) * dist;
      if (isInWater({ x: cx0, y: cy0 })) continue;
      if (outerRoads.some((rd) => distToPolyline({ x: cx0, y: cy0 }, rd) < 18)) continue;

      const treesInCopse = 3 + Math.floor(rng() * 5);
      for (let t = 0; t < treesInCopse; t++) {
        treeClusters.push({
          x: cx0 + (rng() - 0.5) * 26,
          y: cy0 + (rng() - 0.5) * 26,
          r: 4.5 + rng() * 5.2,
        });
      }
    }
  }

  return {
    center,
    wallPolygon,
    wallChains,
    towers,
    waterPolygon,
    waterContours,
    piers,
    riverPath,
    cliffArc,
    plazaPolygon: plazaPts,
    plazaHall,
    plazaFountain,
    wards,
    suburbBuildings,
    outerRoads,
    farmFields,
    treeClusters,
  };
}
