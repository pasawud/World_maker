import { getTerrainMetaWithCustom } from '../data/terrains';
import { CustomTerrain, TerrainId } from '../types/map';
import { getNeighbors, hexDistance, hexIndex } from './hexMath';

/**
 * Convert normalized elevation (-1.0 .. +1.0) into realistic Earth altitude / depth in meters.
 * Piecewise hypsometric & bathymetric curve:
 * - -1.0..-0.25 -> -6,000 m .. -200 m (abyssal plain to continental slope)
 * - -0.25..0.0  -> -200 m .. 0 m (continental shelf / shallow sea)
 * -  0.0..0.32  -> 0 m .. +400 m (coastal & alluvial plains)
 * -  0.32..0.48 -> +400 m .. +1,400 m (foothills & hills)
 * -  0.48..0.58 -> +1,400 m .. +2,800 m (highland & plateau)
 * -  0.58..0.78 -> +2,800 m .. +5,200 m (mountain ranges)
 * -  0.78..1.00 -> +5,200 m .. +8,850 m (alpine peaks)
 */
export function elevationToMeters(e: number): number {
  const clamped = Math.max(-1.0, Math.min(1.0, Number.isFinite(e) ? e : 0));
  if (clamped <= -0.25) {
    const t = (clamped + 1.0) / 0.75; // 0..1
    return Math.round(-6000 + t * 5800);
  }
  if (clamped <= 0) {
    const t = (clamped + 0.25) / 0.25;
    return Math.round(-200 + t * 200);
  }
  if (clamped <= 0.32) {
    const t = clamped / 0.32;
    return Math.round(t * 400);
  }
  if (clamped <= 0.48) {
    const t = (clamped - 0.32) / 0.16;
    return Math.round(400 + t * 1000);
  }
  if (clamped <= 0.58) {
    const t = (clamped - 0.48) / 0.10;
    return Math.round(1400 + t * 1400);
  }
  if (clamped <= 0.78) {
    const t = (clamped - 0.58) / 0.20;
    return Math.round(2800 + t * 2400);
  }
  const t = (clamped - 0.78) / 0.22;
  return Math.round(5200 + t * 3650);
}

/** Format elevation as readable meters with thousands separator and sign. */
export function formatElevationMeters(e: number): string {
  const m = elevationToMeters(e);
  const absFormatted = Math.abs(m).toLocaleString('en-US');
  if (m > 0) return `+${absFormatted} ม.`;
  if (m < 0) return `-${absFormatted} ม.`;
  return '0 ม.';
}

/** Return realistic elevation band [minE, maxE] and default target for a terrain ID. */
export function getElevationBandForTerrain(
  terrainId: number,
  customTerrains?: CustomTerrain[],
  terrainOverrides?: Record<number, Partial<Omit<CustomTerrain, 'id'>>>
): { minE: number; maxE: number; targetE: number } {
  const meta = getTerrainMetaWithCustom(terrainId, customTerrains, terrainOverrides);
  return {
    minE: meta.minElevation,
    maxE: meta.maxElevation,
    targetE: meta.defaultElevation,
  };
}

/** Map continuous elevation value back to standard landform TerrainId (preserves LAKE). */
export function terrainFromElevation(
  e: number,
  currentTerrain?: number,
  customTerrains?: CustomTerrain[],
  terrainOverrides?: Record<number, Partial<Omit<CustomTerrain, 'id'>>>
): TerrainId | number {
  if (currentTerrain === TerrainId.LAKE && e < 0.04) {
    return TerrainId.LAKE;
  }
  if (currentTerrain !== undefined && currentTerrain >= 100) {
    const meta = getTerrainMetaWithCustom(currentTerrain, customTerrains, terrainOverrides);
    if (e >= meta.minElevation - 0.05 && e <= meta.maxElevation + 0.05) {
      return currentTerrain;
    }
  }
  if (e < -0.25) return TerrainId.DEEP_OCEAN;
  if (e < 0.0) return TerrainId.SHALLOW_WATER;
  if (e < 0.30) return TerrainId.PLAINS;
  if (e < 0.45) return TerrainId.HILLS;
  if (e < 0.56) return TerrainId.HIGHLAND;
  if (e < 0.78) return TerrainId.MOUNTAIN;
  return TerrainId.HIGH_PEAK;
}

/**
 * Compute smoothly blended elevation when painting a terrain on a hex cell,
 * plus gently blending immediate neighbor slopes (foothills/continental shelf) so abrupt cliffs don't form unless sculpted.
 */
export function applySmoothTerrainElevation(
  elevation: number[],
  terrains: number[],
  width: number,
  height: number,
  q: number,
  r: number,
  newTerrainId: number,
  customTerrains?: CustomTerrain[],
  terrainOverrides?: Record<number, Partial<Omit<CustomTerrain, 'id'>>>
): { centerElev: number; neighborUpdates: Array<{ idx: number; elev: number }> } {
  const band = getElevationBandForTerrain(newTerrainId, customTerrains, terrainOverrides);
  const neighbors = getNeighbors(q, r, width, height);

  let nbAvg = band.targetE;
  if (neighbors.length > 0) {
    let sum = 0;
    for (const nb of neighbors) {
      sum += elevation[hexIndex(nb.q, nb.r, width)] ?? band.targetE;
    }
    nbAvg = sum / neighbors.length;
  }

  // Keep subtle natural continuity with surroundings, clamped safely inside the terrain's realistic band
  const blended = band.targetE * 0.72 + nbAvg * 0.28;
  const centerElev = Number(
    Math.max(band.minE, Math.min(band.maxE, blended)).toFixed(3)
  );

  // Subtle slope adjustment for adjacent hexes within their own bands
  const neighborUpdates: Array<{ idx: number; elev: number }> = [];
  for (const nb of neighbors) {
    const nIdx = hexIndex(nb.q, nb.r, width);
    const nTerrain = terrains[nIdx];
    const nBand = getElevationBandForTerrain(nTerrain, customTerrains, terrainOverrides);
    const curE = elevation[nIdx] ?? nBand.targetE;
    const nudged = curE * 0.8 + centerElev * 0.2;
    const clamped = Number(Math.max(nBand.minE, Math.min(nBand.maxE, nudged)).toFixed(3));
    if (Math.abs(clamped - curE) > 0.002) {
      neighborUpdates.push({ idx: nIdx, elev: clamped });
    }
  }

  return { centerElev, neighborUpdates };
}

export type SculptMode = 'raise' | 'lower' | 'smooth' | 'flatten';

/**
 * Interactive elevation sculpting brush with Gaussian radial falloff.
 * Returns per-cell elevation & automatically transitioned TerrainId when crossing landform thresholds.
 */
export function sculptElevationBrush(
  elevation: number[],
  terrains: number[],
  width: number,
  height: number,
  centerQ: number,
  centerR: number,
  brushRadius: number,
  mode: SculptMode,
  intensity = 0.08,
  customTerrains?: CustomTerrain[],
  terrainOverrides?: Record<number, Partial<Omit<CustomTerrain, 'id'>>>
): {
  nextElevation: number[];
  nextTerrains: number[];
  changedIndices: number[];
} {
  const nextElevation = [...elevation];
  const nextTerrains = [...terrains];
  const changedIndices: number[] = [];

  const radius = Math.max(0, Math.min(8, brushRadius));
  const cIdx = hexIndex(centerQ, centerR, width);
  const centerElev = elevation[cIdx] ?? 0;

  // Snapshot original elevations for smooth kernel
  const rMin = Math.max(0, centerR - radius - 1);
  const rMax = Math.min(height - 1, centerR + radius + 1);
  const qMin = Math.max(0, centerQ - radius - 1);
  const qMax = Math.min(width - 1, centerQ + radius + 1);

  for (let r = rMin; r <= rMax; r++) {
    for (let q = qMin; q <= qMax; q++) {
      const dist = hexDistance({ q: centerQ, r: centerR }, { q, r });
      if (dist > radius) continue;

      const idx = hexIndex(q, r, width);
      const sigma = Math.max(0.75, radius * 0.55);
      const falloff = radius === 0 ? 1 : Math.exp(-(dist * dist) / (2 * sigma * sigma));
      const oldE = elevation[idx] ?? 0;
      let newE = oldE;

      if (mode === 'raise') {
        newE = oldE + intensity * falloff;
      } else if (mode === 'lower') {
        newE = oldE - intensity * falloff;
      } else if (mode === 'flatten') {
        const weight = Math.min(0.85, intensity * 3.5 * falloff);
        newE = oldE * (1 - weight) + centerElev * weight;
      } else if (mode === 'smooth') {
        const nbs = getNeighbors(q, r, width, height);
        let sum = oldE;
        for (const nb of nbs) {
          sum += elevation[hexIndex(nb.q, nb.r, width)] ?? oldE;
        }
        const avg = sum / (nbs.length + 1);
        const weight = Math.min(0.85, intensity * 4.5 * falloff);
        newE = oldE * (1 - weight) + avg * weight;
      }

      newE = Number(Math.max(-1.0, Math.min(1.0, newE)).toFixed(3));
      const oldT = terrains[idx];
      const newT = terrainFromElevation(newE, oldT, customTerrains, terrainOverrides);

      if (Math.abs(newE - oldE) >= 0.001 || newT !== oldT) {
        nextElevation[idx] = newE;
        nextTerrains[idx] = newT;
        changedIndices.push(idx);
      }
    }
  }

  return { nextElevation, nextTerrains, changedIndices };
}
