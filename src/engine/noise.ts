/** Deterministic 32-bit PRNG (Mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Noise2D {
  sample(x: number, y: number): number; // -1 .. 1
  fbm(x: number, y: number, octaves?: number, lacunarity?: number, gain?: number): number; // ~ -1 .. 1
  ridged(x: number, y: number, octaves?: number): number; // 0 .. 1
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const GRADS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [Math.SQRT1_2, Math.SQRT1_2],
  [-Math.SQRT1_2, Math.SQRT1_2],
  [Math.SQRT1_2, -Math.SQRT1_2],
  [-Math.SQRT1_2, -Math.SQRT1_2],
];

/** Creates a fast deterministic 2D gradient noise sampler. */
export function createNoise2D(seed: number): Noise2D {
  const rng = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const grad = (ix: number, iy: number, dx: number, dy: number): number => {
    const h = perm[(perm[ix & 255] + (iy & 255)) & 255] & 7;
    const g = GRADS[h];
    return g[0] * dx + g[1] * dy;
  };

  const sample = (x: number, y: number): number => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const dx = x - x0;
    const dy = y - y0;
    const u = fade(dx);
    const v = fade(dy);

    const n00 = grad(x0, y0, dx, dy);
    const n10 = grad(x0 + 1, y0, dx - 1, dy);
    const n01 = grad(x0, y0 + 1, dx, dy - 1);
    const n11 = grad(x0 + 1, y0 + 1, dx - 1, dy - 1);

    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  };

  const fbm = (
    x: number,
    y: number,
    octaves = 5,
    lacunarity = 2.02,
    gain = 0.5
  ): number => {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += sample(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return norm > 0 ? sum / norm : 0;
  };

  const ridged = (x: number, y: number, octaves = 4): number => {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    let weight = 1;
    for (let o = 0; o < octaves; o++) {
      let signal = 1 - Math.abs(sample(x * freq, y * freq));
      signal = signal * signal * weight;
      weight = Math.max(0, Math.min(1, signal * 1.8));
      sum += signal * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return norm > 0 ? sum / norm : 0;
  };

  return { sample, fbm, ridged };
}
