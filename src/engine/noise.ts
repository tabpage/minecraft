/**
 * Deterministic seeded PRNG and 2D/3D Perlin + FBM procedural noise
 * Zero external dependencies, identical output across all browsers for a given world seed.
 */

export function hashSeed(seedStr: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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

export function hashCoords(seed: number, x: number, y: number, z = 0): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const GRAD3: ReadonlyArray<[number, number, number]> = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

export class SeededNoise {
  public readonly seedInt: number;
  private readonly perm: Uint8Array;

  constructor(seed: string | number) {
    this.seedInt = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed || 'TERRAVEX');
    const rand = mulberry32(this.seedInt);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  public noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const p = this.perm;
    const aa = p[p[X] + Y] % 12;
    const ab = p[p[X] + Y + 1] % 12;
    const ba = p[p[X + 1] + Y] % 12;
    const bb = p[p[X + 1] + Y + 1] % 12;

    const gAA = GRAD3[aa][0] * xf + GRAD3[aa][1] * yf;
    const gBA = GRAD3[ba][0] * (xf - 1) + GRAD3[ba][1] * yf;
    const gAB = GRAD3[ab][0] * xf + GRAD3[ab][1] * (yf - 1);
    const gBB = GRAD3[bb][0] * (xf - 1) + GRAD3[bb][1] * (yf - 1);

    const x1 = lerp(gAA, gBA, u);
    const x2 = lerp(gAB, gBB, u);
    return lerp(x1, x2, v);
  }

  public noise3D(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    const p = this.perm;
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    const dot = (idx: number, dx: number, dy: number, dz: number) => {
      const g = GRAD3[p[idx] % 12];
      return g[0] * dx + g[1] * dy + g[2] * dz;
    };

    const x1 = lerp(dot(AA, xf, yf, zf), dot(BA, xf - 1, yf, zf), u);
    const x2 = lerp(dot(AB, xf, yf - 1, zf), dot(BB, xf - 1, yf - 1, zf), u);
    const y1 = lerp(x1, x2, v);

    const x3 = lerp(dot(AA + 1, xf, yf, zf - 1), dot(BA + 1, xf - 1, yf, zf - 1), u);
    const x4 = lerp(dot(AB + 1, xf, yf - 1, zf - 1), dot(BB + 1, xf - 1, yf - 1, zf - 1), u);
    const y2 = lerp(x3, x4, v);

    return lerp(y1, y2, w);
  }

  public fbm2D(x: number, y: number, octaves = 4, lacunarity = 2.0, gain = 0.5): number {
    let amp = 1.0;
    let freq = 1.0;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise2D(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  public ridged2D(x: number, y: number, octaves = 4): number {
    let amp = 1.0;
    let freq = 1.0;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1.0 - Math.abs(this.noise2D(x * freq, y * freq));
      sum += amp * n * n;
      norm += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return sum / norm;
  }
}
