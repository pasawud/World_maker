import {
  GeographyConfig,
  HexCoord,
  ManualWindKind,
  ManualWindPath,
  SeasonId,
} from '../types/map';
import { hexIndex } from './hexMath';
import { getColLongitude, getPrevailingWindVector, getRowLatitude } from './worldGenerator';

export interface WindField {
  dx: Float32Array;
  dy: Float32Array;
  speed: Float32Array; // 0 .. 1.6
  /** 0 = calm/doldrums, 1 = trade winds, 2 = westerlies, 3 = polar easterlies, 4 = monsoon, 5 = gale */
  belt: Uint8Array;
}

export interface WindStreamline {
  points: { q: number; r: number }[];
  belt: number;
  avgSpeed: number;
}

function kindToBelt(kind: ManualWindKind): number {
  switch (kind) {
    case 'calm':
      return 0;
    case 'trade':
      return 1;
    case 'westerlies':
      return 2;
    case 'monsoon':
      return 4;
    case 'gale':
      return 5;
  }
}

export function getWindBeltLabelTh(belt: number, speed: number): string {
  if (belt === 0 || speed < 0.2) return 'เขตลมสงบ (Doldrums/Calm)';
  if (belt === 1) return 'ลมค้าตะวันออก (Trade Winds)';
  if (belt === 2) return 'ลมฝ่ายตะวันตก (Westerlies)';
  if (belt === 3) return 'ลมขั้วโลก (Polar Easterlies)';
  if (belt === 4) return 'ลมมรสุม (Monsoon)';
  return 'ลมกรด / พายุแรง (Gale)';
}

export function getWindCompassLabel(dx: number, dy: number): string {
  if (Math.hypot(dx, dy) < 0.05) return 'สงบ';
  const angle = Math.atan2(dy, dx);
  const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  const idx = ((Math.round((angle / (Math.PI * 2)) * 8) % 8) + 8) % 8;
  return dirs[idx];
}

export function windSpeedKnots(speed: number): number {
  return Math.round(Math.max(0, speed) * 28);
}

/**
 * Compute realistic planetary wind belts (Trade Winds, Westerlies, Polar Easterlies, Doldrums,
 * Monsoons), seasonal ITCZ shifts, orographic mountain drag, and user-drawn custom winds.
 */
export function computeWindField(
  width: number,
  height: number,
  elevation: ArrayLike<number>,
  config: GeographyConfig,
  manualWinds?: ManualWindPath[],
  activeSeason?: SeasonId | null
): WindField {
  const total = width * height;
  const dx = new Float32Array(total);
  const dy = new Float32Array(total);
  const speed = new Float32Array(total);
  const belt = new Uint8Array(total);

  const windMul = Math.max(0.2, Math.min(2.0, config.windStrength ?? 1.0));
  const coriolisFlip = config.coriolisDirection === 'reversed' ? -1 : 1;
  const seasonLatShift =
    activeSeason === 'summer' ? -8 : activeSeason === 'winter' ? 8 : 0;

  for (let r = 0; r < height; r++) {
    const lat = getRowLatitude(r, height, config);
    const effLat = lat + seasonLatShift;
    const absEffLat = Math.abs(effLat);

    for (let q = 0; q < width; q++) {
      const idx = hexIndex(q, r, width);
      const lon = getColLongitude(q, width, config);
      let vec = getPrevailingWindVector(effLat, lon, config.windMode);
      let bId = 2;
      let baseSpd = 0.72;

      if (config.windMode === 'monsoon') {
        const inAsiaMonsoon = lat >= 0 && lat <= 34 && lon >= 55 && lon <= 145;
        const inAfricaMonsoon = lat >= 0 && lat <= 18 && lon >= -18 && lon <= 20;
        const inAusMonsoon = lat >= -24 && lat < 0 && lon >= 110 && lon <= 155;
        if (inAsiaMonsoon || inAfricaMonsoon || inAusMonsoon) {
          bId = 4;
          baseSpd = 0.85;
          if (activeSeason === 'winter') {
            vec = { dx: -vec.dx * 0.9, dy: -vec.dy * 0.9 };
          }
        } else {
          if (absEffLat < 5 || (absEffLat >= 28 && absEffLat <= 33)) {
            bId = 0;
            baseSpd = 0.22;
          } else if (absEffLat < 28) {
            bId = 1;
            baseSpd = 0.68;
          } else if (absEffLat <= 60) {
            bId = 2;
            baseSpd = 0.84;
          } else {
            bId = 3;
            baseSpd = 0.56;
          }
        }
      } else if (config.windMode === 'latitude') {
        if (absEffLat < 5 || (absEffLat >= 28 && absEffLat <= 33)) {
          bId = 0; // Doldrums / Horse latitudes
          baseSpd = 0.22;
        } else if (absEffLat < 28) {
          bId = 1; // Trade winds
          baseSpd = 0.7;
        } else if (absEffLat <= 60) {
          bId = 2; // Westerlies (strongest around Roaring Forties ~45°)
          const fortiesBoost = 1 - Math.min(1, Math.abs(absEffLat - 45) / 22);
          baseSpd = 0.72 + fortiesBoost * 0.24;
        } else {
          bId = 3; // Polar easterlies
          baseSpd = 0.56;
        }
      } else {
        bId = 1;
        baseSpd = 0.74;
      }

      if (coriolisFlip === -1 && (config.windMode === 'latitude' || config.windMode === 'monsoon')) {
        vec = { dx: -vec.dx, dy: vec.dy };
      }

      const elev = elevation[idx] ?? 0;
      const terrainDrag =
        elev > 0.45 ? Math.max(0.42, 1 - (elev - 0.4) * 0.75) : elev > 0 ? 0.92 : 1.06;

      const len = Math.hypot(vec.dx, vec.dy) || 1;
      dx[idx] = vec.dx / len;
      dy[idx] = vec.dy / len;
      speed[idx] = Math.min(1.6, baseSpd * windMul * terrainDrag);
      belt[idx] = bId;
    }
  }

  // Apply custom user-edited wind paths / calm doldrums / gale corridors
  if (manualWinds && manualWinds.length > 0) {
    const brushR = 5;
    for (const mw of manualWinds) {
      if (mw.points.length < 2) continue;
      const mBelt = kindToBelt(mw.kind);
      const targetSpd =
        mw.kind === 'calm'
          ? 0.06
          : mw.kind === 'gale'
          ? Math.min(1.6, Math.max(0.9, mw.strength * 1.15))
          : Math.min(1.5, Math.max(0.4, mw.strength));

      for (let i = 0; i < mw.points.length - 1; i++) {
        const a = mw.points[i];
        const b = mw.points[i + 1];
        const segDx = b.q - a.q;
        const segDy = b.r - a.r;
        const segLen = Math.hypot(segDx, segDy) || 1;
        const ux = segDx / segLen;
        const uy = segDy / segLen;

        const minQ = Math.max(0, Math.floor(Math.min(a.q, b.q) - brushR));
        const maxQ = Math.min(width - 1, Math.ceil(Math.max(a.q, b.q) + brushR));
        const minR = Math.max(0, Math.floor(Math.min(a.r, b.r) - brushR));
        const maxR = Math.min(height - 1, Math.ceil(Math.max(a.r, b.r) + brushR));

        for (let r = minR; r <= maxR; r++) {
          for (let q = minQ; q <= maxQ; q++) {
            const dist = Math.hypot(q - (a.q + b.q) * 0.5, r - (a.r + b.r) * 0.5);
            if (dist > brushR) continue;
            const w = 1 - dist / brushR;
            const idx = hexIndex(q, r, width);
            if (mw.kind === 'calm') {
              speed[idx] = speed[idx] * (1 - w * 0.92) + targetSpd * (w * 0.92);
              if (w > 0.35) belt[idx] = 0;
            } else {
              const ndx = dx[idx] * (1 - w) + ux * w;
              const ndy = dy[idx] * (1 - w) + uy * w;
              const nlen = Math.hypot(ndx, ndy) || 1;
              dx[idx] = ndx / nlen;
              dy[idx] = ndy / nlen;
              speed[idx] = speed[idx] * (1 - w * 0.8) + targetSpd * (w * 0.8);
              if (w > 0.35) belt[idx] = mBelt;
            }
          }
        }
      }
    }
  }

  return { dx, dy, speed, belt };
}

/** Trace clean atmospheric wind streamlines across the map for visual rendering. */
export function traceWindStreamlines(
  width: number,
  height: number,
  field: WindField
): WindStreamline[] {
  const streams: WindStreamline[] = [];
  const stepQ = Math.max(6, Math.round(width / 12));
  const stepR = Math.max(5, Math.round(height / 9));

  for (let sr = Math.floor(stepR * 0.5); sr < height - 1; sr += stepR) {
    for (let sq = Math.floor(stepQ * 0.5); sq < width - 1; sq += stepQ) {
      let cq = sq;
      let cr = sr;
      const startIdx = hexIndex(Math.round(cq), Math.round(cr), width);
      if (field.speed[startIdx] < 0.14) continue;

      const pts: { q: number; r: number }[] = [{ q: cq, r: cr }];
      let beltSum = field.belt[startIdx];
      let spdSum = field.speed[startIdx];

      for (let step = 0; step < 7; step++) {
        const iq = Math.max(0, Math.min(width - 1, Math.round(cq)));
        const ir = Math.max(0, Math.min(height - 1, Math.round(cr)));
        const idx = hexIndex(iq, ir, width);
        const s = field.speed[idx];
        if (s < 0.12) break;
        cq += field.dx[idx] * 1.45;
        cr += field.dy[idx] * 1.45;
        if (cq < 0.5 || cq >= width - 0.5 || cr < 0.5 || cr >= height - 0.5) break;
        pts.push({ q: Number(cq.toFixed(2)), r: Number(cr.toFixed(2)) });
        spdSum += s;
        beltSum = field.belt[idx];
      }

      if (pts.length >= 3) {
        streams.push({
          points: pts,
          belt: beltSum,
          avgSpeed: spdSum / pts.length,
        });
      }
    }
  }

  return streams;
}

/** Estimate how strongly tailwinds vs headwinds affect a sailing route. */
export function estimateSailingSpeedFactor(
  hexes: HexCoord[],
  width: number,
  height: number,
  windField: WindField
): { avgFactor: number; tailwindPct: number; headwindPct: number } {
  if (hexes.length < 2) {
    return { avgFactor: 1, tailwindPct: 0, headwindPct: 0 };
  }
  let factorSum = 0;
  let tailwinds = 0;
  let headwinds = 0;
  const steps = hexes.length - 1;

  for (let i = 0; i < steps; i++) {
    const a = hexes[i];
    const b = hexes[i + 1];
    const sx = b.q - a.q;
    const sy = b.r - a.r;
    const sLen = Math.hypot(sx, sy) || 1;
    const idx = hexIndex(Math.max(0, Math.min(width - 1, a.q)), Math.max(0, Math.min(height - 1, a.r)), width);
    const dot = (sx / sLen) * windField.dx[idx] + (sy / sLen) * windField.dy[idx];
    const spd = Math.min(1.3, windField.speed[idx]);
    const factor = Math.max(0.6, Math.min(1.45, 1 + dot * spd * 0.32));
    factorSum += factor;
    if (dot > 0.25 && spd >= 0.2) tailwinds++;
    else if (dot < -0.25 && spd >= 0.2) headwinds++;
  }

  return {
    avgFactor: Number((factorSum / steps).toFixed(2)),
    tailwindPct: Math.round((tailwinds / steps) * 100),
    headwindPct: Math.round((headwinds / steps) * 100),
  };
}
