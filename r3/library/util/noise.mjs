// Deterministic noise for every procedural model and texture of the Setavaz library (no Math.random anywhere:
// the same seed draws the same object on every machine).
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (x) => { const c = clamp(x); return c * c * (3 - 2 * c); };
/** 0 before a, 1 after b, smooth in between. */
export const ramp = (t, a, b) => smooth((t - a) / (b - a || 1e-9));

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z, s) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683) + Math.imul(s + 1, 1274126177)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Value noise in 3D, 0..1. */
export function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u), x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u), x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

/** Fractal noise, 0..1. */
export function fbm3(x, y, z, octaves = 4, seed = 0) {
  let a = 0.5, s = 0, n = 0;
  for (let i = 0; i < octaves; i++) {
    s += a * noise3(x, y, z, seed + i * 17);
    n += a;
    x *= 2.03; y *= 2.03; z *= 2.03;
    a *= 0.5;
  }
  return s / n;
}

/** Noise that tiles on a 2D texture of period `p` (sampled on a torus in 3D-ish space, cheap version: wrap blend). */
export function tile2(u, v, freq, octaves = 4, seed = 0) {
  // blend four shifted samples so the texture wraps in u and v
  const f = (a, b) => fbm3(a * freq, b * freq, seed * 0.37, octaves, seed);
  const wu = smooth(u), wv = smooth(v);
  return lerp(lerp(f(u, v), f(u - 1, v), wu), lerp(f(u, v - 1), f(u - 1, v - 1), wu), wv);
}
