// Small procedural textures as THREE.DataTexture: drawn by code from noise, no picture file, no canvas (so the same
// file builds in Node for the checks and in the browser for the render).
import * as THREE from 'three';
import { clamp, lerp, smooth, tile2 } from '../util/noise.mjs';

export function make(size, fn, { srgb = true, repeat = true } = {}) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a = 1] = fn(x / size, y / size);
      const i = (y * size + x) * 4;
      data[i] = Math.round(clamp(r) * 255);
      data[i + 1] = Math.round(clamp(g) * 255);
      data[i + 2] = Math.round(clamp(b) * 255);
      data[i + 3] = Math.round(clamp(a) * 255);
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
const cache = new Map();
export const once = (key, f) => { if (!cache.has(key)) cache.set(key, f()); return cache.get(key); };
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/** A soft round glow (alpha falls off like a light seen out of focus): sparks, droplets, bokeh lights. */
export const glowTexture = () => once('glow', () => make(64, (u, v) => {
  const d = Math.hypot(u - 0.5, v - 0.5) * 2;
  const a = Math.pow(clamp(1 - d), 2.2);
  return [1, 1, 1, a];
}, { repeat: false }));

/** Fine grey grain for bump and roughness (cast iron, sand, stone, concrete). */
export const grainTexture = (seed = 3) => once(`grain${seed}`, () => make(256, (u, v) => {
  const n = tile2(u, v, 24, 3, seed) * 0.6 + tile2(u, v, 70, 2, seed + 5) * 0.4;
  return [n, n, n, 1];
}, { srgb: false }));

/** The heat of a burning coal: dark crust with glowing veins and hot patches (used as an emissive map). */
export const emberTexture = (seed = 7) => once(`ember${seed}`, () => make(256, (u, v) => {
  const base = tile2(u, v, 5, 4, seed);
  const ridged = 1 - Math.abs(2 * tile2(u, v, 9, 4, seed + 11) - 1);
  const veins = Math.pow(smooth((ridged - 0.72) / 0.28), 1.5);
  const patch = smooth((base - 0.42) / 0.3);
  const heat = clamp(0.1 + 0.75 * patch + 0.6 * veins);
  const c = heat < 0.5 ? mix3([0.22, 0.01, 0.0], [1.0, 0.24, 0.02], heat / 0.5) : mix3([1.0, 0.24, 0.02], [1.0, 0.78, 0.36], (heat - 0.5) / 0.5);
  return [c[0], c[1], c[2], 1];
}));

/** Weathered copper going green: verdigris with brown-copper streaks running down (u around, v along the roof). */
export const verdigrisTexture = (seed = 21) => once(`verdigris${seed}`, () => make(256, (u, v) => {
  const streak = tile2(u, v * 0.18, 26, 3, seed);
  const blot = tile2(u, v, 6, 4, seed + 3);
  const k = smooth((streak * 0.6 + blot * 0.6 - 0.5) / 0.3);
  const green = mix3([0.22, 0.47, 0.42], [0.36, 0.63, 0.55], blot);
  const c = mix3(green, [0.42, 0.24, 0.13], k * 0.75);
  return [c[0], c[1], c[2], 1];
}));

/** Copper that has lived outdoors: warm metal with slightly darker, rougher blotches (roughness in the green channel). */
export const copperRoughTexture = (seed = 31) => once(`copperRough${seed}`, () => make(256, (u, v) => {
  const n = tile2(u, v, 7, 4, seed);
  const r = 0.22 + 0.4 * smooth((n - 0.35) / 0.4);
  return [1, r, 0, 1]; // three.js reads roughness from G
}, { srgb: false }));

/** A cloud puff: a soft blob whose edge is eaten by noise. */
export const puffTexture = (seed = 41) => once(`puff${seed}`, () => make(128, (u, v) => {
  const d = Math.hypot(u - 0.5, v - 0.5) * 2;
  const n = tile2(u, v, 4, 4, seed);
  const a = smooth((1 - d - 0.55 * (n - 0.35)) / 0.6);
  const shade = 0.75 + 0.25 * tile2(u, v, 7, 3, seed + 9);
  return [shade, shade, shade, a * a];
}, { repeat: false }));

/** How hot a crucible's wall is along its profile (v: outside bottom 0, rim 0.5, inside bottom 1). */
export const crucibleHeatTexture = () => once('crucibleHeat', () => make(64, (u, v) => {
  const outside = smooth((v - 0.33) / 0.15) * 0.42; // only the top of the outer wall shows its heat
  const inside = v > 0.5 ? 1 : 0;
  const heat = clamp(Math.max(outside * (v <= 0.5 ? 1 : 0), inside * (0.75 + 0.25 * smooth((v - 0.5) / 0.2))));
  const c = heat < 0.5 ? mix3([0, 0, 0], [0.9, 0.12, 0.01], heat / 0.5) : mix3([0.9, 0.12, 0.01], [1.0, 0.62, 0.16], (heat - 0.5) / 0.5);
  return [c[0], c[1], c[2], 1];
}, { repeat: false }));
