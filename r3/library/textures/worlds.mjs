// Textures of the Bazaar Lights and Kahkeshan worlds, drawn by code like data.mjs (no picture file, no canvas, so they
// build in Node for the checks): the bazaar's fired brick and its worn stone floor, the pierced pattern of a brass
// lantern, desert sand by night, the goat skin of a daf, and the engraved plate of an astrolabe (circles and lines
// only: no letters, no numbers).
import { clamp, lerp, smooth, tile2 } from '../util/noise.mjs';
import { make, once } from './data.mjs';

const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

/**
 * Fired brick as in a Persian bazaar's vaults: warm ochre bricks of slightly different shades, laid in running bond,
 * with pale lime mortar. Four bricks across, eight courses up a tile.
 */
export const brickTexture = (seed = 71) => once(`brick${seed}`, () => {
  const A = hex('#b07a4a'), B = hex('#9a6338'), C = hex('#c89462'), MORTAR = hex('#d9c7a4');
  return make(512, (u, v) => {
    const rows = 8, cols = 4;
    const ry = v * rows, row = Math.floor(ry);
    const rx = u * cols + (row % 2) * 0.5, col = Math.floor(rx);
    const fx = rx - col, fy = ry - row;
    const m = 0.045;
    const edge = Math.min(fx, 1 - fx) * 4, edgeY = Math.min(fy, 1 - fy);
    const shade = tile2(((col % cols) + 0.5) / cols, (row + 0.5) / rows, 3, 1, seed);
    const grain = tile2(u, v, 40, 3, seed + 3);
    let c = shade < 0.4 ? mix3(B, A, shade / 0.4) : mix3(A, C, (shade - 0.4) / 0.6);
    c = mix3(c, [c[0] * 0.8, c[1] * 0.75, c[2] * 0.7], grain * 0.6);
    const inMortar = edgeY < m * 2.2 || edge < m * 2;
    if (inMortar) c = mix3(MORTAR, c, 0.18 * grain);
    return [c[0], c[1], c[2], 1];
  });
});
/** The brick's relief for bumpMap: the mortar joints sit lower than the bricks. */
export const brickBump = (seed = 71) => once(`brickBump${seed}`, () => make(512, (u, v) => {
  const rows = 8, cols = 4;
  const ry = v * rows, row = Math.floor(ry);
  const rx = u * cols + (row % 2) * 0.5, col = Math.floor(rx);
  const fx = rx - col, fy = ry - row;
  const d = Math.min(Math.min(fx, 1 - fx) * 4, Math.min(fy, 1 - fy));
  const h = smooth(d / 0.12) * (0.8 + 0.2 * tile2(u, v, 30, 2, seed + 1));
  return [h, h, h, 1];
}, { srgb: false }));

/** Worn stone paving: large pale slabs with soft dark joints and polish where feet pass. */
export const pavingTexture = (seed = 83) => once(`paving${seed}`, () => {
  const S1 = hex('#8f8577'), S2 = hex('#a89c88'), JOINT = hex('#4a4239');
  return make(512, (u, v) => {
    const ry = v * 3, row = Math.floor(ry);
    const rx = u * 2 + (row % 2) * 0.37, col = Math.floor(rx);
    const fx = rx - col, fy = ry - row;
    const shade = tile2(((col % 2) + 0.5) / 2, (row + 0.5) / 3, 2, 1, seed);
    const n = tile2(u, v, 18, 4, seed + 2);
    let c = mix3(S1, S2, shade * 0.7 + n * 0.3);
    const j = Math.min(Math.min(fx, 1 - fx) * 2, Math.min(fy, 1 - fy) * 3);
    if (j < 0.025) c = mix3(JOINT, c, j / 0.025);
    return [c[0], c[1], c[2], 1];
  });
});

/**
 * The pierced pattern of a brass lantern (fanus), as an alpha map (white = metal, black = a hole): rows of eight-point
 * stars, small round holes between them, and a solid band at the top and the bottom. u goes round, v up the body.
 */
export const lanternPierceTexture = () => once('lanternPierce', () => make(512, (u, v) => {
  if (v < 0.16 || v > 0.86) return [1, 1, 1, 1];
  const cols = 8, rows = 3;
  const y = (v - 0.16) / 0.7;
  const cx = u * cols, cy = y * rows;
  const fx = cx - Math.floor(cx) - 0.5, fy = cy - Math.floor(cy) - 0.5;
  const a = Math.atan2(fy, fx), d = Math.hypot(fx, fy * 1.15);
  const R = 0.17 + 0.13 * Math.pow(Math.abs(Math.cos(4 * a)), 4);
  if (d < R) return [0, 0, 0, 1];
  // small round holes on the cell corners, a ring of tiny dots round each star
  const gx = Math.abs(fx) - 0.5, gy = Math.abs(fy) - 0.5;
  if (Math.hypot(gx, gy * 1.15) < 0.07) return [0, 0, 0, 1];
  const ring = Math.abs(d - 0.38);
  if (ring < 0.025 && Math.sin(a * 16) > 0.6) return [0, 0, 0, 1];
  return [1, 1, 1, 1];
}, { srgb: false }));

/** Desert sand at night: fine grain with soft ripples, in the moon's grey-blue; the warm sand shows under a warm light. */
export const sandTexture = (seed = 91) => once(`sand${seed}`, () => {
  const A = hex('#b49a78'), B = hex('#c9ae86'), D = hex('#8c7558');
  return make(512, (u, v) => {
    const ripple = 0.5 + 0.5 * Math.sin((v * 46 + 3 * tile2(u, v, 3, 2, seed)) * Math.PI * 2);
    const n = tile2(u, v, 60, 2, seed + 4);
    let c = mix3(A, B, ripple * 0.5 + n * 0.5);
    c = mix3(c, D, 0.25 * (1 - ripple) * tile2(u, v, 5, 3, seed + 9));
    return [c[0], c[1], c[2], 1];
  });
});
/** The ripples as relief for the sand's bumpMap. */
export const sandBump = (seed = 91) => once(`sandBump${seed}`, () => make(256, (u, v) => {
  const ripple = 0.5 + 0.5 * Math.sin((v * 46 + 3 * tile2(u, v, 3, 2, seed)) * Math.PI * 2);
  const h = 0.7 * ripple + 0.3 * tile2(u, v, 60, 2, seed + 4);
  return [h, h, h, 1];
}, { srgb: false }));

/** The goat skin of a daf: warm cream, a little translucent-looking, mottled, darker towards the frame. Radial: u, v over the disc. */
export const dafSkinTexture = (seed = 101) => once(`dafSkin${seed}`, () => {
  const IN = hex('#e8d5ac'), OUT = hex('#b48a55'), MOTTLE = hex('#c9a874');
  return make(256, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const n = tile2(u, v, 7, 4, seed);
    let c = mix3(IN, MOTTLE, smooth((n - 0.45) / 0.3) * 0.6);
    c = mix3(c, OUT, smooth((d - 0.7) / 0.3));
    return [c[0], c[1], c[2], 1];
  }, { repeat: false });
});

/**
 * The engraved plate of an astrolabe (the tympan), as a colour map on brass: the circles of equal altitude crowding
 * towards the zenith, the lines of azimuth, the horizon and three rings for the tropics and the equator. Lines only.
 */
export const astrolabePlateTexture = () => once('astrolabePlate', () => {
  const BRASS = hex('#c79a4a'), LINE = hex('#5a3a12');
  return make(512, (u, v) => {
    const x = (u - 0.5) * 2, y = (v - 0.5) * 2, r = Math.hypot(x, y);
    if (r > 1) return [BRASS[0], BRASS[1], BRASS[2], 1];
    let ink = 0;
    const line = (dist, w = 0.006) => { ink = Math.max(ink, smooth(1 - Math.abs(dist) / w)); };
    for (const R of [0.36, 0.6, 0.98]) line(r - R, 0.007); // the tropics and the equator
    // almucantars: circles moved up towards the zenith, smaller as they climb
    for (let k = 0; k < 9; k++) {
      const c = 0.12 + 0.055 * k, R = 0.62 - 0.062 * k;
      line(Math.hypot(x, y - c) - R, 0.004);
    }
    // azimuth lines: arcs through the zenith, drawn as straight rays here (they read the same from a step away)
    const zen = Math.atan2(y - 0.62, x);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; const dd = Math.abs(Math.sin(zen - a)) * Math.hypot(x, y - 0.62); if (Math.cos(zen - a) > 0 && Math.hypot(x, y - 0.62) < 0.9) line(dd, 0.003); }
    line(y, 0.004); // the horizon line
    const age = tile2(u, v, 9, 3, 7);
    const base = mix3(BRASS, [BRASS[0] * 0.75, BRASS[1] * 0.7, BRASS[2] * 0.6], smooth((age - 0.5) / 0.3) * 0.5);
    const c = mix3(base, LINE, ink * 0.85);
    return [c[0], c[1], c[2], 1];
  }, { repeat: false });
});

/** A kilim, the flat-woven rug: rows of stepped diamonds in madder red, indigo and ivory with a striped end. */
export const kilimTexture = () => once('kilim', () => {
  const RED = hex('#8e2a1e'), IND = hex('#23305e'), IV = hex('#e6d6b0'), OCH = hex('#c08a3a');
  return make(512, (u, v) => {
    const weave = 0.9 + 0.1 * (0.5 + 0.5 * Math.sin(v * 512 * Math.PI));
    if (v < 0.06 || v > 0.94) { const s = Math.floor(v * 80) % 3; const c = s === 0 ? IND : s === 1 ? IV : RED; return [c[0] * weave, c[1] * weave, c[2] * weave, 1]; }
    const cy = (v - 0.06) / 0.88 * 4, row = Math.floor(cy);
    const fx = (u * 3) - Math.floor(u * 3) - 0.5, fy = cy - row - 0.5;
    const d = Math.abs(fx) + Math.abs(fy);
    const step = Math.floor(d * 10) / 10; // the stepped edge of a woven diamond
    let c = RED;
    if (step < 0.45) c = row % 2 ? IND : OCH;
    if (step < 0.3) c = IV;
    if (step < 0.15) c = RED;
    if (Math.abs(u * 3 - Math.round(u * 3)) < 0.01) c = IV;
    return [c[0] * weave, c[1] * weave, c[2] * weave, 1];
  });
});

export { clamp };
