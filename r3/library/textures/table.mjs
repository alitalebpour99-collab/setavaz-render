// Textures of the table-top worlds (Yalda, Focus, Night Drive), drawn by code like data.mjs: a termeh cloth, the page of
// a book of poems, a ruled notebook page, walnut, a gauge's face and the cut face of a pomegranate. No picture file and
// no letters: the «verse» and the «handwriting» are ink strokes that read as writing from a step away, never as words.
import { clamp, fbm3, lerp, rng, smooth, tile2 } from '../util/noise.mjs';
import { make, once } from './data.mjs';

const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

/**
 * Termeh, the woven Yazd cloth laid on a Yalda table: deep crimson with rows of boteh (the paisley) in gold, ivory and
 * indigo, each row turned the other way, over a fine weave.
 */
export const termehTexture = () => once('termeh', () => {
  const RED = hex('#5e0f1c'), RED2 = hex('#7a1626'), GOLD = hex('#c99a3e'), IVORY = hex('#e9d9b4'), INDIGO = hex('#1f2252');
  return make(512, (u, v) => {
    const weave = 0.92 + 0.08 * (0.5 + 0.5 * Math.sin(u * 512 * Math.PI)) * (0.5 + 0.5 * Math.sin(v * 512 * Math.PI * 0.5 + 1));
    const rows = 4, cols = 4;
    const ry = v * rows, row = Math.floor(ry);
    const cx = u * cols + (row % 2) * 0.5, col = Math.floor(cx);
    let x = cx - col - 0.5, y = ry - row - 0.5;
    if (row % 2) x = -x; // each row faces the other way
    // the boteh: a drop whose tip curls, radius by angle
    const a = Math.atan2(y, x), d = Math.hypot(x, y);
    const tipDir = 0.75 + 1.6 * d; // the tip turns as it goes out
    const R = 0.2 * (1 + 1.25 * Math.pow(Math.max(0, Math.cos(a - tipDir)), 10));
    let c = mix3(RED, RED2, 0.5 + 0.5 * Math.sin((u + v) * 40));
    const k = d / R;
    if (k < 1.0) c = GOLD;
    if (k < 0.86) c = RED2;
    if (k < 0.74) c = INDIGO;
    if (k < 0.5) c = IVORY;
    if (k < 0.3) c = GOLD;
    if (k < 0.14) c = RED;
    // small diamonds between the boteh
    const dx = Math.abs(cx - col - 0.0), dy = Math.abs(ry - row - 1.0);
    if (dx + dy < 0.07) c = GOLD;
    // a thin gold line between the rows
    if (Math.abs(ry - row - 0.98) < 0.006) c = GOLD;
    return [c[0] * weave, c[1] * weave, c[2] * weave, 1];
  });
});

/** Ink strokes along a line from x0 to x1 at height y: a thick-thin wave broken into «words». Returns 0..1 ink. */
function strokes(u, v, y, x0, x1, seed, weight = 1) {
  if (u < x0 || u > x1) return 0;
  const r = Math.sin(seed * 12.9898) * 43758.5453;
  const ph = r - Math.floor(r);
  const word = Math.sin(u * 95 + ph * 40) + 0.6 * Math.sin(u * 37 + ph * 11);
  if (word < -0.55) return 0; // the gaps between words
  const wave = 0.0045 * Math.sin(u * 420 + ph * 9) + 0.003 * Math.sin(u * 160 + ph * 3);
  const thick = weight * (0.0018 + 0.0022 * Math.pow(0.5 + 0.5 * Math.sin(u * 300 + ph * 5), 2));
  const dot = (Math.sin(u * 211 + ph * 17) > 0.97 && Math.abs(v - (y + 0.011)) < 0.0028) ? 1 : 0;
  return Math.max(dot, smooth(1 - Math.abs(v - y - wave) / thick));
}

/**
 * A page of a divan, the book of poems read on Yalda night: warm ivory paper, a gold double frame, a red-and-gold head
 * band, and the verses in two columns (two halves of each line, side by side). `side` 0 left page, 1 right page.
 */
export const versePageTexture = (side = 0) => once(`verse${side}`, () => {
  const PAPER = hex('#efe2c4'), INK = hex('#2a1c14'), GOLD = hex('#b8892f'), RED = hex('#8b2a22');
  return make(512, (u, v) => {
    const age = 0.94 + 0.06 * fbm3(u * 6, v * 6, side, 3, 5);
    const edge = smooth(Math.min(u, 1 - u, v, 1 - v) / 0.08);
    let c = mix3(mix3(PAPER, [0.86, 0.74, 0.55], 1 - edge), PAPER, 0.4).map((x) => x * age);
    const inX = u > 0.1 && u < 0.9, inY = v > 0.08 && v < 0.92;
    const frame = (inX && inY) && (Math.abs(u - 0.1) < 0.004 || Math.abs(u - 0.9) < 0.004 || Math.abs(v - 0.08) < 0.004 || Math.abs(v - 0.92) < 0.004 ||
      Math.abs(u - 0.115) < 0.002 || Math.abs(u - 0.885) < 0.002 || Math.abs(v - 0.095) < 0.002 || Math.abs(v - 0.905) < 0.002);
    if (frame) c = GOLD;
    // the head band
    if (u > 0.13 && u < 0.87 && v > 0.11 && v < 0.17) {
      const band = Math.sin((u - 0.13) * 140) * Math.sin((v - 0.11) * 50);
      c = band > 0.2 ? GOLD : mix3(RED, GOLD, 0.25);
    }
    // the verses: 11 lines of two halves, the column rule between them
    if (Math.abs(u - 0.5) < 0.0018 && v > 0.2 && v < 0.88) c = mix3(c, GOLD, 0.8);
    for (let i = 0; i < 11; i++) {
      const y = 0.23 + i * 0.06;
      if (Math.abs(v - y) > 0.02) continue;
      const ink = Math.max(strokes(u, v, y, 0.14, 0.47, i * 7 + side * 31 + 1), strokes(u, v, y, 0.53, 0.86, i * 7 + side * 31 + 4));
      c = mix3(c, INK, ink * 0.92);
    }
    return [c[0], c[1], c[2], 1];
  });
});

/** A notebook page: cream paper, blue ruled lines, a red margin. */
export const ruledPageTexture = () => once('ruled', () => {
  const PAPER = hex('#f1ead8'), LINE = hex('#8aa3c8'), RED = hex('#c0605a');
  return make(512, (u, v) => {
    const age = 0.95 + 0.05 * fbm3(u * 5, v * 5, 3, 3, 9);
    let c = PAPER.map((x) => x * age);
    const ly = (v - 0.12) / 0.055;
    if (v > 0.1 && Math.abs(ly - Math.round(ly)) < 0.035) c = mix3(c, LINE, 0.65);
    if (Math.abs(u - 0.14) < 0.0018) c = mix3(c, RED, 0.7);
    return [c[0], c[1], c[2], 1];
  });
});
/** The ruled lines' place on that page, for the handwriting (v of line i, from the top). */
export const RULED = { first: 0.12 + 0.055, step: 0.055, left: 0.17, right: 0.92 };

/** Walnut: warm brown with long wavy grain and a few darker rays. u runs along the grain. */
export const walnutTexture = (seed = 51) => once(`walnut${seed}`, () => make(512, (u, v) => {
  const warp = tile2(u, v, 3, 3, seed) * 4;
  const grain = 0.5 + 0.5 * Math.sin((v * 46 + warp) * Math.PI);
  const fine = tile2(u * 0.25, v, 40, 2, seed + 2);
  const k = clamp(0.35 + 0.35 * grain * grain + 0.3 * fine);
  const c = mix3(hex('#2c1a10'), hex('#6e4426'), k);
  return [c[0], c[1], c[2], 1];
}));
export const walnutBump = (seed = 51) => once(`walnutB${seed}`, () => make(256, (u, v) => {
  const warp = tile2(u, v, 3, 3, seed) * 4;
  const g = 0.5 + 0.5 * Math.sin((v * 46 + warp) * Math.PI);
  return [g, g, g, 1];
}, { srgb: false }));

/**
 * The face of a car gauge, drawn round on a square (a CircleGeometry's uv): black, a ring of fine and long ticks over
 * 240 degrees, a soft amber glow behind them (the backlight). No numbers.
 */
export const dialTexture = () => once('dial', () => make(512, (u, v) => {
  const x = u - 0.5, y = v - 0.5, r = Math.hypot(x, y) * 2;
  let a = Math.atan2(y, x); // 0 to the right, counter-clockwise
  // the scale runs from 210 degrees down through 90 to -30
  const deg = (a * 180) / Math.PI;
  const from = 210, span = 240;
  const along = ((from - deg + 360) % 360) / span; // 0 at the start, 1 at the end
  let c = [0.02, 0.02, 0.025];
  const glow = Math.exp(-Math.pow((r - 0.78) / 0.12, 2)) * 0.25;
  c = c.map((q, i) => q + glow * [1, 0.55, 0.18][i]);
  if (along >= 0 && along <= 1) {
    const ticks = 40;
    const ph = along * ticks;
    const major = Math.round(ph) % 5 === 0;
    const near = Math.abs(ph - Math.round(ph)) * (span / ticks) * (Math.PI / 180) * r * 256;
    const inner = major ? 0.66 : 0.74;
    if (r > inner && r < 0.86 && near < (major ? 2.2 : 1.2)) c = [0.98, 0.84, 0.62];
    if (r > 0.88 && r < 0.9) c = [0.6, 0.42, 0.2];
  }
  if (r > 0.97) c = [0.01, 0.01, 0.01];
  return [c[0], c[1], c[2], 1];
}, { repeat: false }));

/**
 * The cut face of a pomegranate (a CircleGeometry's uv): the red rind at the rim, cream pith, and the pale membranes
 * that part the seed chambers (six round the middle).
 */
export const pithTexture = () => once('pith', () => make(256, (u, v) => {
  const x = u - 0.5, y = v - 0.5, r = Math.hypot(x, y) * 2, a = Math.atan2(y, x);
  const n = fbm3(x * 9, y * 9, 1, 3, 13);
  let c = mix3(hex('#e9d3ad'), hex('#f4e4c4'), n);
  const membrane = Math.abs(Math.sin(a * 3 + 0.4 * Math.sin(r * 6))) < 0.08 + 0.05 * (1 - r) || Math.abs(r - 0.42 - 0.05 * Math.sin(a * 5)) < 0.03;
  if (membrane) c = mix3(c, hex('#f7ecd2'), 0.8);
  if (r > 0.86) c = mix3(hex('#d98b74'), hex('#8e1a24'), smooth((r - 0.86) / 0.12));
  if (r > 0.98) c = hex('#6a0f18');
  return [c[0], c[1], c[2], 1];
}, { repeat: false }));

/** Dark wall plaster for the rooms behind the tables: a warm grey-indigo with soft blotches. */
export const plasterTexture = (seed = 61, base = '#1c1a2c') => once(`plaster${seed}${base}`, () => make(256, (u, v) => {
  const n = tile2(u, v, 4, 4, seed) * 0.7 + tile2(u, v, 30, 2, seed + 1) * 0.3;
  const c = hex(base).map((q) => q * (0.85 + 0.3 * n));
  return [c[0], c[1], c[2], 1];
}));

export { rng };
