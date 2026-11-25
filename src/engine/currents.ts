import { GeographyConfig, TerrainId, WindMode } from '../types/map';
import { getNeighbors, hexIndex } from './hexMath';

export type CurrentKind = 'none' | 'warm' | 'cold' | 'neutral';

export interface OceanCurrentField {
  dx: Float32Array;
  dy: Float32Array;
  thermal: Float32Array; // -1 (cold) .. +1 (warm)
  speed: Float32Array; // 0 .. 1
}

export interface CurrentStreamline {
  points: { q: number; r: number }[];
  kind: 'warm' | 'cold' | 'neutral';
  thermal: number;
}

export function getCurrentKind(thermal: number, speed: number): CurrentKind {
  if (speed < 0.08) return 'none';
  if (thermal >= 0.22) return 'warm';
  if (thermal <= -0.22) return 'cold';
  return 'neutral';
}

export function getCurrentCompassLabel(dx: number, dy: number): string {
  const angle = Math.atan2(dy, dx);
  const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  const idx = ((Math.round((angle / (Math.PI * 2)) * 8) % 8) + 8) % 8;
  return dirs[idx];
}

function getRowLat(r: number, height: number, config: GeographyConfig): number {
  const t = height <= 1 ? 0.5 : r / (height - 1);
  return config.latNorth + (config.latSouth - config.latNorth) * t;
}

function getColLon(q: number, width: number, config: GeographyConfig): number {
  const lonW = config.lonWest ?? -180;
  const lonE = config.lonEast ?? 180;
  const t = width <= 1 ? 0.5 : q / (width - 1);
  return lonW + (lonE - lonW) * t;
}

function getUniformWindDir(mode: WindMode): { dx: number; dy: number } | null {
  switch (mode) {
    case 'west':
      return { dx: 1, dy: 0 };
    case 'east':
      return { dx: -1, dy: 0 };
    case 'north':
      return { dx: 0, dy: 1 };
    case 'south':
      return { dx: 0, dy: -1 };
    case 'northwest':
      return { dx: 0.7071, dy: 0.7071 };
    case 'southwest':
      return { dx: 0.7071, dy: -0.7071 };
    case 'northeast':
      return { dx: -0.7071, dy: 0.7071 };
    case 'southeast':
      return { dx: -0.7071, dy: -0.7071 };
    default:
      return null;
  }
}

function isOceanCell(
  elevation: ArrayLike<number>,
  idx: number,
  terrains?: ArrayLike<number>
): boolean {
  if (terrains && terrains[idx] === TerrainId.LAKE) return false;
  if (terrains && (terrains[idx] === TerrainId.DEEP_OCEAN || terrains[idx] === TerrainId.SHALLOW_WATER)) {
    return true;
  }
  return elevation[idx] <= 0;
}

/**
 * Compute physical surface ocean currents (warm western-boundary currents,
 * cold eastern-boundary currents, equatorial/mid-latitude/polar gyres, and monsoon drift).
 */
export function computeOceanCurrents(
  width: number,
  height: number,
  elevation: ArrayLike<number>,
  config: GeographyConfig,
  terrains?: ArrayLike<number>
): OceanCurrentField {
  const total = width * height;
  const dx = new Float32Array(total);
  const dy = new Float32Array(total);
  const thermal = new Float32Array(total);
  const speed = new Float32Array(total);

  if (config.oceanCurrents === false) {
    return { dx, dy, thermal, speed };
  }

  const isOcean = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (isOceanCell(elevation, i, terrains)) {
      isOcean[i] = 1;
    }
  }

  const uniformWind = getUniformWindDir(config.windMode);
  const maxScan = Math.min(7, Math.max(3, Math.floor(width * 0.12)));

  for (let r = 0; r < height; r++) {
    const lat = getRowLat(r, height, config);
    const absLat = Math.abs(lat);
    const hemi = lat >= 0 ? 1 : -1;

    for (let q = 0; q < width; q++) {
      const idx = hexIndex(q, r, width);
      if (!isOcean[idx]) continue;

      const lon = getColLon(q, width, config);

      // Measure distance to land strictly west (-q) and east (+q)
      let distWestLand = maxScan + 1;
      for (let d = 1; d <= maxScan; d++) {
        const wq = q - d;
        if (wq < 0) break;
        if (!isOcean[hexIndex(wq, r, width)]) {
          distWestLand = d;
          break;
        }
      }

      let distEastLand = maxScan + 1;
      for (let d = 1; d <= maxScan; d++) {
        const eq = q + d;
        if (eq >= width) break;
        if (!isOcean[hexIndex(eq, r, width)]) {
          distEastLand = d;
          break;
        }
      }

      let vx = 0;
      let vy = 0;
      let th = 0;
      let sp = 0.72;

      if (uniformWind) {
        vx = uniformWind.dx;
        vy = uniformWind.dy;
        th = absLat < 22 ? 0.55 : absLat > 55 ? -0.55 : 0.15 - (absLat - 22) * 0.018;
        sp = 0.78;
        // Boundary deflection along western/eastern coasts
        if (distWestLand <= 3 && vx < 0) {
          vy = -0.78 * hemi;
          vx = 0.25;
          th = Math.max(th, 0.45);
        } else if (distEastLand <= 3 && vx > 0) {
          vy = 0.78 * hemi;
          vx = -0.25;
          th = Math.min(th, -0.45);
        }
      } else if (
        config.windMode === 'monsoon' &&
        lat >= -10 &&
        lat <= 26 &&
        lon >= 50 &&
        lon <= 145
      ) {
        // Indian Ocean / South China Sea SW Monsoon Drift (warm)
        vx = 0.76;
        vy = -0.65;
        th = 0.85;
        sp = 0.92;
      } else if (absLat < 16) {
        // Equatorial Current (flows E -> W, warm)
        vx = -0.96;
        vy = -0.14 * hemi;
        th = 0.72;
        sp = 0.86;
      } else if (absLat <= 58) {
        // Subtropical / Subpolar Gyres:
        // Western ocean boundary (east of continent, distWestLand small) -> Warm poleward current
        // Eastern ocean boundary (west of continent, distEastLand small) -> Cold equatorward current
        const nearWestCoast = distWestLand <= maxScan && distWestLand <= distEastLand;
        const nearEastCoast = distEastLand <= maxScan && distEastLand < distWestLand;

        if (nearWestCoast) {
          const blend = 1 - (distWestLand - 1) / maxScan;
          vx = 0.36;
          vy = -0.93 * hemi;
          th = 0.55 + 0.42 * blend;
          sp = 0.94;
        } else if (nearEastCoast) {
          const blend = 1 - (distEastLand - 1) / maxScan;
          vx = -0.36;
          vy = 0.93 * hemi;
          th = -(0.55 + 0.42 * blend);
          sp = 0.9;
        } else if (absLat < 34) {
          // Trade-wind return branch of subtropical gyre (E -> W)
          vx = -0.88;
          vy = -0.22 * hemi;
          th = 0.36;
          sp = 0.74;
        } else {
          // Mid-latitude West Wind Drift (W -> E)
          vx = 0.92;
          vy = -0.16 * hemi;
          th = 0.08 - (absLat - 34) * 0.015;
          sp = 0.8;
        }
      } else {
        // Cold Polar Current / Antarctic Circumpolar Current
        if (lat < -55) {
          vx = 0.96;
          vy = 0.12;
        } else {
          vx = -0.86;
          vy = 0.28 * hemi;
        }
        th = -0.84;
        sp = 0.85;
      }

      const len = Math.hypot(vx, vy) || 1;
      dx[idx] = vx / len;
      dy[idx] = vy / len;
      thermal[idx] = Math.max(-1, Math.min(1, th));
      speed[idx] = sp;
    }
  }

  // Smooth ocean vectors & thermal anomalies over 2 neighbor passes
  const tmpDx = new Float32Array(total);
  const tmpDy = new Float32Array(total);
  const tmpTh = new Float32Array(total);
  for (let pass = 0; pass < 2; pass++) {
    tmpDx.set(dx);
    tmpDy.set(dy);
    tmpTh.set(thermal);
    for (let r = 0; r < height; r++) {
      for (let q = 0; q < width; q++) {
        const idx = hexIndex(q, r, width);
        if (!isOcean[idx]) continue;

        let sumX = tmpDx[idx] * 2;
        let sumY = tmpDy[idx] * 2;
        let sumT = tmpTh[idx] * 2;
        let w = 2;

        for (const nb of getNeighbors(q, r, width, height)) {
          const nbIdx = hexIndex(nb.q, nb.r, width);
          if (!isOcean[nbIdx]) continue;
          sumX += tmpDx[nbIdx];
          sumY += tmpDy[nbIdx];
          sumT += tmpTh[nbIdx];
          w += 1;
        }

        const vx = sumX / w;
        const vy = sumY / w;
        const mag = Math.hypot(vx, vy);
        if (mag > 0.05) {
          dx[idx] = vx / mag;
          dy[idx] = vy / mag;
        }
        thermal[idx] = Math.max(-1, Math.min(1, sumT / w));
      }
    }
  }

  return { dx, dy, thermal, speed };
}

/**
 * Compute coastal land thermal anomaly (-1..+1) from nearby ocean currents within 3 hexes.
 * Inland hexes and lake-only shores remain 0.
 */
export function computeCoastalCurrentInfluence(
  width: number,
  height: number,
  elevation: ArrayLike<number>,
  currents: OceanCurrentField,
  terrains?: ArrayLike<number>
): Float32Array {
  const total = width * height;
  const influence = new Float32Array(total);
  const radius = 3;

  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const idx = hexIndex(q, r, width);
      if (isOceanCell(elevation, idx, terrains)) continue;
      if (terrains && terrains[idx] === TerrainId.LAKE) continue;

      let weightedSum = 0;
      let weightTotal = 0;

      const rMin = Math.max(0, r - radius);
      const rMax = Math.min(height - 1, r + radius);
      const qMin = Math.max(0, q - radius);
      const qMax = Math.min(width - 1, q + radius);

      for (let nr = rMin; nr <= rMax; nr++) {
        for (let nq = qMin; nq <= qMax; nq++) {
          const nIdx = hexIndex(nq, nr, width);
          if (!isOceanCell(elevation, nIdx, terrains)) continue;
          const dist = Math.hypot(nq - q, nr - r);
          if (dist > radius || dist <= 0) continue;
          const weight = 1 / (dist * dist);
          weightedSum += currents.thermal[nIdx] * weight;
          weightTotal += weight;
        }
      }

      if (weightTotal > 0) {
        influence[idx] = Math.max(-1, Math.min(1, weightedSum / weightTotal));
      }
    }
  }

  return influence;
}

/**
 * Trace clean curved streamlines across ocean hexes for cartographic current rendering.
 */
export function traceOceanCurrentStreams(
  width: number,
  height: number,
  elevation: ArrayLike<number>,
  currents: OceanCurrentField,
  terrains?: ArrayLike<number>
): CurrentStreamline[] {
  const step = Math.max(4, Math.round(Math.min(width, height) / 14));
  const cellPitch = Math.max(2, Math.floor(step * 0.65));
  const occW = Math.ceil(width / cellPitch) + 1;
  const occH = Math.ceil(height / cellPitch) + 1;
  const occupied = new Uint8Array(occW * occH);

  const isOccupied = (q: number, r: number): boolean => {
    const ox = Math.floor(q / cellPitch);
    const oy = Math.floor(r / cellPitch);
    if (ox < 0 || ox >= occW || oy < 0 || oy >= occH) return true;
    return occupied[oy * occW + ox] === 1;
  };

  const markOccupied = (q: number, r: number): void => {
    const ox = Math.floor(q / cellPitch);
    const oy = Math.floor(r / cellPitch);
    if (ox >= 0 && ox < occW && oy >= 0 && oy < occH) {
      occupied[oy * occW + ox] = 1;
    }
  };

  const streams: CurrentStreamline[] = [];

  for (let sr = Math.floor(step / 2); sr < height; sr += step) {
    for (let sq = Math.floor(step / 2); sq < width; sq += step) {
      const startIdx = hexIndex(sq, sr, width);
      if (!isOceanCell(elevation, startIdx, terrains)) continue;
      if (currents.speed[startIdx] < 0.2) continue;
      if (isOccupied(sq, sr)) continue;

      const points: { q: number; r: number }[] = [];
      let curQ = sq;
      let curR = sr;
      let thermalSum = 0;

      for (let k = 0; k < 10; k++) {
        const rq = Math.round(curQ);
        const rr = Math.round(curR);
        if (rq < 0 || rq >= width || rr < 0 || rr >= height) break;
        const cIdx = hexIndex(rq, rr, width);
        if (!isOceanCell(elevation, cIdx, terrains)) break;
        if (k > 0 && isOccupied(rq, rr)) break;

        if (
          points.length === 0 ||
          points[points.length - 1].q !== rq ||
          points[points.length - 1].r !== rr
        ) {
          points.push({ q: rq, r: rr });
          markOccupied(rq, rr);
          thermalSum += currents.thermal[cIdx];
        }

        const vx = currents.dx[cIdx];
        const vy = currents.dy[cIdx];
        if (Math.hypot(vx, vy) < 0.1) break;
        curQ += vx * 1.45;
        curR += vy * 1.45;
      }

      if (points.length >= 3) {
        const avgThermal = thermalSum / points.length;
        const kind =
          avgThermal >= 0.22 ? 'warm' : avgThermal <= -0.22 ? 'cold' : 'neutral';
        streams.push({ points, kind, thermal: avgThermal });
      }
    }
  }

  return streams;
}
