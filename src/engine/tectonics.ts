import { CustomTectonicPlate, HexMapData, TerrainId } from '../types/map';
import { syncShallowWater } from './cliffs';
import { terrainFromElevation } from './elevation';
import { getNeighbors, hexIndex } from './hexMath';
import { createNoise2D, mulberry32 } from './noise';

export interface TectonicPlate {
  id: number;
  customId?: string;
  name: string;
  centerQ: number;
  centerR: number;
  vx: number;
  vy: number;
  color: string;
  isOceanic?: boolean;
}

export interface TectonicField {
  plates: TectonicPlate[];
  plateIds: Uint8Array;
  /** 0 = interior, 1 = convergent (collision), 2 = divergent (rift), 3 = transform (fault) */
  boundaryKind: Uint8Array;
  /** Diffused boundary stress/uplift (-1 rift/trench .. +1 mountain uplift) */
  stress: Float32Array;
}

const PLATE_COLORS = [
  '#f59e0b',
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fb7185',
  '#facc15',
  '#60a5fa',
  '#f472b6',
  '#2dd4bf',
  '#c084fc',
  '#fb923c',
  '#a3e635',
  '#e879f9',
  '#22d3ee',
  '#f87171',
  '#818cf8',
];

const PLATE_NAMES = [
  'แผ่นทวีปเหนือ',
  'แผ่นอัลไพน์',
  'แผ่นมหาสมุทรตะวันตก',
  'แผ่นสุริยัน',
  'แผ่นวาลิเรียน',
  'แผ่นก้นสมุทรลึก',
  'แผ่นเทือกผา',
  'แผ่นบูรพา',
  'แผ่นขั้วโลกใต้',
  'แผ่นภูเขาไฟ',
  'แผ่นมรกต',
  'แผ่นจันทรา',
  'แผ่นนภากาศ',
  'แผ่นศิลา',
  'แผ่นปะการัง',
  'แผ่นสายฟ้า',
];

/** Compute warped-Voronoi tectonic plates, drift vectors, fault boundaries, and diffused stress. */
export function computeTectonicField(
  width: number,
  height: number,
  seed: number,
  plateCount = 8,
  customPlates?: CustomTectonicPlate[]
): TectonicField {
  const safeCount = Math.max(4, Math.min(16, Math.round(plateCount)));
  const total = width * height;
  const rng = mulberry32(seed + 4409);
  const warpNoise = createNoise2D(seed + 8819);

  const plates: TectonicPlate[] = [];
  if (customPlates && customPlates.length >= 2) {
    for (let i = 0; i < customPlates.length; i++) {
      const cp = customPlates[i];
      plates.push({
        id: i,
        customId: cp.id,
        name: cp.name || PLATE_NAMES[i % PLATE_NAMES.length],
        centerQ: Math.max(0, Math.min(width - 1, Number(cp.centerQ) || 0)),
        centerR: Math.max(0, Math.min(height - 1, Number(cp.centerR) || 0)),
        vx: Number.isFinite(cp.vx) ? cp.vx : 0,
        vy: Number.isFinite(cp.vy) ? cp.vy : 0,
        color: cp.color || PLATE_COLORS[i % PLATE_COLORS.length],
        isOceanic: Boolean(cp.isOceanic),
      });
    }
  } else {
    for (let i = 0; i < safeCount; i++) {
      const angle = rng() * Math.PI * 2;
      const speed = 0.55 + rng() * 0.45;
      plates.push({
        id: i,
        name: PLATE_NAMES[i % PLATE_NAMES.length],
        centerQ: width * (0.1 + rng() * 0.8),
        centerR: height * (0.1 + rng() * 0.8),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: PLATE_COLORS[i % PLATE_COLORS.length],
      });
    }
  }

  const plateIds = new Uint8Array(total);
  const warpScale = Math.max(width, height) * 0.1;

  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const wq = q + warpNoise.fbm(q * 0.055, r * 0.055, 3) * warpScale;
      const wr = r + warpNoise.fbm(q * 0.055 + 31.4, r * 0.055 + 17.2, 3) * warpScale;

      let bestId = 0;
      let bestD2 = Infinity;
      for (let i = 0; i < plates.length; i++) {
        const dq = wq - plates[i].centerQ;
        const dr = wr - plates[i].centerR;
        const d2 = dq * dq + dr * dr;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestId = i;
        }
      }
      plateIds[hexIndex(q, r, width)] = bestId;
    }
  }

  const boundaryKind = new Uint8Array(total);
  const rawStress = new Float32Array(total);

  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const idx = hexIndex(q, r, width);
      const pA = plates[plateIds[idx]];
      for (const nb of getNeighbors(q, r, width, height)) {
        const nbIdx = hexIndex(nb.q, nb.r, width);
        const nbId = plateIds[nbIdx];
        if (nbId === pA.id) continue;

        const pB = plates[nbId];
        const nx = nb.q - q;
        const ny = nb.r - r;
        const nLen = Math.hypot(nx, ny) || 1;
        const ux = nx / nLen;
        const uy = ny / nLen;

        // Convergence rate along unit normal pointing A -> B: (vA - vB) dot u
        const conv = (pA.vx - pB.vx) * ux + (pA.vy - pB.vy) * uy;
        if (conv > 0.25) {
          boundaryKind[idx] = 1; // Convergent collision
          rawStress[idx] = Math.max(rawStress[idx], Math.min(1, conv));
        } else if (conv < -0.25) {
          boundaryKind[idx] = 2; // Divergent rift
          rawStress[idx] = Math.min(rawStress[idx], Math.max(-1, conv));
        } else if (boundaryKind[idx] === 0) {
          boundaryKind[idx] = 3; // Transform fault
        }
      }
    }
  }

  // Spread stress smoothly across 3 neighbor passes to form wide mountain/trench belts
  const stress = new Float32Array(rawStress);
  const tmp = new Float32Array(total);
  for (let pass = 0; pass < 3; pass++) {
    tmp.set(stress);
    for (let r = 0; r < height; r++) {
      for (let q = 0; q < width; q++) {
        const idx = hexIndex(q, r, width);
        let acc = tmp[idx] * 2.2;
        let w = 2.2;
        for (const nb of getNeighbors(q, r, width, height)) {
          acc += tmp[hexIndex(nb.q, nb.r, width)] * 0.85;
          w += 0.85;
        }
        const avg = acc / w;
        if (rawStress[idx] > 0.2) stress[idx] = Math.max(avg, rawStress[idx] * 0.85);
        else if (rawStress[idx] < -0.2) stress[idx] = Math.min(avg, rawStress[idx] * 0.85);
        else stress[idx] = avg;
      }
    }
  }

  return { plates, plateIds, boundaryKind, stress };
}

/** Modify elevation along tectonic boundaries (convergent ranges/trenches & divergent rifts). */
export function applyTectonicsToElevation(
  elevation: number[],
  width: number,
  height: number,
  field: TectonicField,
  strength = 0.65
): number[] {
  const s = Math.max(0, Math.min(1.5, strength));
  if (s <= 0) return elevation;

  const out = [...elevation];
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const e = out[i];
    const st = field.stress[i];
    const plate = field.plates[field.plateIds[i]];
    const isOceanic = plate?.isOceanic;

    if (st > 0.08) {
      if (isOceanic === true || e <= -0.1) {
        // Oceanic subduction trench beside volcanic arc
        out[i] = Math.max(-1, e - st * 0.32 * s);
      } else if (isOceanic === false) {
        // Continental-continental / coastal orogeny -> strong mountain uplift
        out[i] = Math.min(1, e + st * 0.48 * s);
      } else {
        out[i] = Math.min(1, e + st * 0.42 * s);
      }
    } else if (st < -0.08) {
      if (isOceanic === true || e <= 0) {
        // Mid-ocean volcanic ridge
        out[i] = Math.min(0.18, e + Math.abs(st) * 0.25 * s);
      } else {
        // Continental rift valley
        out[i] = Math.max(-0.35, e + st * 0.34 * s);
      }
    }
  }
  return out;
}

/** Generate editable custom plate definitions seeded from the map's current tectonic field. */
export function createCustomPlatesFromCurrent(map: HexMapData): CustomTectonicPlate[] {
  const field = computeTectonicField(
    map.width,
    map.height,
    map.geography.seed,
    map.geography.tectonicPlates ?? 8,
    map.customTectonicPlates
  );
  return field.plates.map((p, i) => {
    const cq = Math.max(0, Math.min(map.width - 1, Math.round(p.centerQ)));
    const cr = Math.max(0, Math.min(map.height - 1, Math.round(p.centerR)));
    const e = map.elevation[hexIndex(cq, cr, map.width)] ?? 0;
    return {
      id: p.customId ?? `plate_${i + 1}`,
      name: p.name,
      color: p.color,
      centerQ: cq,
      centerR: cr,
      vx: Number(p.vx.toFixed(2)),
      vy: Number(p.vy.toFixed(2)),
      isOceanic: p.isOceanic ?? e <= 0,
    };
  });
}

/**
 * Apply the current map's tectonic plates & fault lines to its existing elevation, terrains, and fault features
 * while preserving lakes and custom terrains.
 */
export function applyTectonicsToCurrentMap(
  map: HexMapData,
  strength = 0.65
): HexMapData {
  const effStrength = Math.max(0.1, Math.min(1.5, strength));
  const field = computeTectonicField(
    map.width,
    map.height,
    map.geography.seed,
    map.geography.tectonicPlates ?? 8,
    map.customTectonicPlates
  );
  const nextElevation = applyTectonicsToElevation(
    map.elevation,
    map.width,
    map.height,
    field,
    effStrength
  );

  const total = map.width * map.height;
  const nextTerrains = new Array<number>(total);
  for (let i = 0; i < total; i++) {
    const curT = map.terrains?.[i];
    if (curT === TerrainId.LAKE || (curT !== undefined && curT >= 100)) {
      nextTerrains[i] = curT;
      nextElevation[i] = map.elevation[i] ?? 0;
    } else {
      nextTerrains[i] = terrainFromElevation(nextElevation[i], map.moisture[i] ?? 0.5);
    }
  }

  const rawFeatures = applyTectonicFeatures(
    map.features ?? new Array<string>(total).fill(''),
    map.width,
    map.height,
    nextElevation,
    field,
    map.geography.seed
  );
  for (let i = 0; i < total; i++) {
    if (nextTerrains[i] === TerrainId.LAKE) rawFeatures[i] = '';
  }

  const synced = syncShallowWater({
    width: map.width,
    height: map.height,
    terrains: nextTerrains,
    biomes: map.biomes,
    elevation: nextElevation,
    features: rawFeatures,
    customBiomes: map.customBiomes,
  });

  return {
    ...map,
    updatedAt: new Date().toISOString(),
    geography: {
      ...map.geography,
      tectonicStrength: effStrength,
    },
    elevation: synced.elevation,
    terrains: synced.terrains,
    biomes: synced.biomes,
    features: synced.features,
  };
}

/** Place active tectonic volcanoes, hot springs, and canyons along fault lines. */
export function applyTectonicFeatures(
  features: string[],
  width: number,
  height: number,
  elevation: ArrayLike<number>,
  field: TectonicField,
  seed: number
): string[] {
  const out = [...features];
  const rng = mulberry32(seed + 7919);

  for (let r = 1; r < height - 1; r++) {
    for (let q = 1; q < width - 1; q++) {
      const idx = hexIndex(q, r, width);
      if (out[idx]) continue;
      const bKind = field.boundaryKind[idx];
      if (bKind === 0) continue;

      const roll = rng();
      const e = elevation[idx] ?? 0;
      if (bKind === 1) {
        if (e <= 0 && roll < 0.09) out[idx] = 'volcanic_island';
        else if (e > 0.25 && roll < 0.14) out[idx] = 'volcanic_soil';
        else if (e > 0.2 && roll < 0.2) out[idx] = 'hot_springs';
      } else if (bKind === 2) {
        if (e > 0.08 && roll < 0.16) out[idx] = 'canyon';
        else if (e <= 0 && roll < 0.07) out[idx] = 'volcanic_island';
      }
    }
  }
  return out;
}
