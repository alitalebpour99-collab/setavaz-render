// The girih over a real photograph (Ali, 21 Nov 2026: the Kahkeshan design sheet is the style, «سبکش خوبه اما هر
// آهنگ ایدهٔ خودش»): thin glowing gold lines of Persian geometry with gold node-stars, laid over a real night-sky or
// place photograph; a glowing ring runs out from the centre on every measured kick and lights the node-stars it
// passes; now and then a shooting star on a melody hit; the drop is the visual peak (the lines blaze, the outer layer
// opens, the photograph brightens). Drawn in 2D at full size (crisp lines; the glow is a blurred copy), no 3D pass.
// Each song has its own idea (presets below), all in that one style:
// - girih-mehr: a warm desert just before sunrise; a 12-point sun rosette with rays that rises slowly over the song.
// - girih-si-o-se-pol: Isfahan's bridge at night; its 33 arches as a ring arcade round an 11-fold star, mirrored and
//   rippling in the river below.
// - girih-jangal: the Hyrcanian forest at dusk; a 10-fold rosette of leaves that grows line by line, fireflies.
// - girih-lenj: the Persian Gulf at night with a lenj; a 16-point star compass that sways like a boat.
// Seamless: every motion turns by whole symmetry steps or whole cycles per period (the loop's length; 8 bars otherwise).
import * as THREE from 'three';
import { bandReader } from './geo.mjs';

export const look = { bloom: { strength: 0, radius: 0, threshold: 1 }, exposure: 1.0 };
export const env = { base: '#000000', panels: [] };

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const pol = (r, a) => [r * Math.cos(a), r * Math.sin(a)];

// ── the geometry: polylines in units of the rosette's radius (centre 0,0); `o` = where it sits from centre (0..1.3),
// used for growth and for the kick ring; `layer` core | outer | rays ──
const star = (n, k, r, a0 = -Math.PI / 2) => { const pts = []; for (let i = 0; i <= n; i++) pts.push(pol(r, a0 + (TAU * k * i) / n)); return pts; };
const circle = (r, n = 96) => { const pts = []; for (let i = 0; i <= n; i++) pts.push(pol(r, (TAU * i) / n)); return pts; };

function sunRosette(open = 0) {
  // Mehr: a 12-point star {12/5}, twelve pointed petals round it, a ring, and 24 sun rays outside
  const L = [], N = [], w = TAU / 12;
  L.push({ pts: star(12, 5, 0.34), o: 0.3, layer: 'core' });
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + i * w;
    // each petal is rooted in two neighbouring points of the heart star, so the rosette is one closed drawing
    const m = a + w / 2;
    const p = [pol(0.34, a), pol(0.68, m - w * (0.3 + 0.04 * open)), pol(0.96 + 0.04 * open, m), pol(0.68, m + w * (0.3 + 0.04 * open)), pol(0.34, a + w)];
    L.push({ pts: p, o: 0.7, layer: 'core' });
    N.push({ p: pol(0.96 + 0.04 * open, m), o: 1.0, big: 1 }, { p: pol(0.68, m - w * (0.3 + 0.04 * open)), o: 0.68, big: 0.45 });
    N.push({ p: pol(0.34, a), o: 0.34, big: 0.55 });
    const ra = a;
    L.push({ pts: [pol(1.06, ra), pol(1.06 + 0.16 * (0.6 + 0.8 * open), ra)], o: 1.1, layer: 'rays' });
  }
  return { L, N };
}

function arcade(open = 0) {
  // Si-o-se-pol: 33 pointed arches round a ring (the bridge's arcade), an 11-fold star {11/4} inside, two deck rings
  // an arcade: neighbouring arches share their pillars; each arch is pointed (two curves meeting at an angle)
  const L = [], N = [], n = 33, w = TAU / n, d = w / 2;
  const r0 = 0.66, r1 = 0.8, r2 = 0.9 + 0.03 * open;
  L.push({ pts: circle(r0), o: r0, layer: 'core' }, { pts: circle(r2 + 0.04), o: 1.0, layer: 'outer' });
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * w;
    const arch = [];
    for (let s = 0; s <= 8; s++) { const u = s / 8; arch.push(pol(r1 + (r2 - r1) * Math.sqrt(u), a - d * Math.cos((Math.PI / 2) * u))); }
    for (let s = 7; s >= 0; s--) { const u = s / 8; arch.push(pol(r1 + (r2 - r1) * Math.sqrt(u), a + d * Math.cos((Math.PI / 2) * u))); }
    L.push({ pts: [pol(r0, a - d), ...arch], o: 0.8, layer: 'core' });
    N.push({ p: pol(r2, a), o: r2, big: i % 3 === 0 ? 1 : 0.5 });
  }
  L.push({ pts: star(11, 4, 0.5), o: 0.45, layer: 'core' }, { pts: circle(0.16 + 0.02 * open), o: 0.16, layer: 'outer' });
  for (let i = 0; i < 11; i++) N.push({ p: pol(0.5, -Math.PI / 2 + (i * TAU) / 11), o: 0.52, big: 0.8 });
  return { L, N };
}

function leaves(open = 0) {
  // Jangal: a 10-fold rosette of leaves (an inner and an outer crown), a {10/3} star at the heart
  const L = [], N = [], w = TAU / 10;
  const leaf = (a, rA, rB, wd, o, layer) => {
    const [ax, ay] = pol(rA, a), [bx, by] = pol(rB, a);
    const nx = -Math.sin(a), ny = Math.cos(a), pts = [];
    for (let s = 0; s <= 12; s++) { const u = s / 12, k = wd * Math.sin(Math.PI * u) * (1 - 0.35 * u); pts.push([ax + (bx - ax) * u + nx * k, ay + (by - ay) * u + ny * k]); }
    for (let s = 11; s >= 0; s--) { const u = s / 12, k = wd * Math.sin(Math.PI * u) * (1 - 0.35 * u); pts.push([ax + (bx - ax) * u - nx * k, ay + (by - ay) * u - ny * k]); }
    L.push({ pts, o, layer }, { pts: [[ax, ay], [ax + (bx - ax) * 0.92, ay + (by - ay) * 0.92]], o, layer, vein: true });
    N.push({ p: [bx, by], o: rB, big: layer === 'core' ? 0.7 : 1 });
  };
  L.push({ pts: star(10, 3, 0.36), o: 0.3, layer: 'core' }, { pts: circle(0.2), o: 0.2, layer: 'core' });
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * w;
    leaf(a, 0.2, 0.68, 0.065 + 0.02 * open, 0.5, 'core');
    leaf(a + w / 2, 0.46, 1.0 + 0.05 * open, 0.075 + 0.03 * open, 0.85, 'outer');
  }
  return { L, N };
}

function compass(open = 0) {
  // Lenj: a 16-point star compass (cardinal, intercardinal and minor points as kites), a card of 64 ticks, {8/3} heart
  const L = [], N = [];
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 16;
    const r = i % 4 === 0 ? 1.0 : i % 2 === 0 ? 0.76 : 0.56;
    const wa = (TAU / 16) * (i % 4 === 0 ? 0.42 : 0.36);
    L.push({ pts: [pol(0.17, a - wa), pol(r + 0.03 * open, a), pol(0.17, a + wa)], o: r * 0.8, layer: i % 2 ? 'outer' : 'core' });
    N.push({ p: pol(r + 0.03 * open, a), o: r, big: i % 4 === 0 ? 1 : 0.55 });
  }
  L.push({ pts: circle(1.08), o: 1.08, layer: 'core' }, { pts: circle(1.16), o: 1.16, layer: 'outer' });
  for (let i = 0; i < 64; i++) { const a = (i * TAU) / 64, len = i % 4 === 0 ? 0.07 : 0.035; L.push({ pts: [pol(1.08, a), pol(1.08 + len, a)], o: 1.1, layer: 'rays' }); }
  L.push({ pts: star(8, 3, 0.38), o: 0.3, layer: 'core' }, { pts: circle(0.17), o: 0.17, layer: 'core' });
  for (let i = 0; i < 8; i++) N.push({ p: pol(0.38, -Math.PI / 2 + (i * TAU) / 8), o: 0.38, big: 0.5 });
  return { L, N };
}

// centre and radius are fractions of the frame: [x, y] of (W, H); r of min(W, H). `water` = the reflection's line.
export const PRESETS = {
  'girih-mehr': { photo: 'mehr', geom: sunRosette, fold: 12, w: { c: [0.5, 0.42], r: 0.34 }, v: { c: [0.5, 0.33], r: 0.36 }, rise: 0.08, sun: true, shoot: true },
  'girih-si-o-se-pol': { photo: 'si-o-se-pol', geom: arcade, fold: 11, w: { c: [0.5, 0.31], r: 0.25, water: 0.66 }, v: { c: [0.5, 0.27], r: 0.4, water: 0.6 }, shoot: true },
  'girih-jangal': { photo: 'jangal', geom: leaves, fold: 10, w: { c: [0.5, 0.45], r: 0.38 }, v: { c: [0.5, 0.4], r: 0.42 }, grow: true, flies: 56, shoot: true },
  'girih-lenj': { photo: 'lenj', geom: compass, fold: 16, w: { c: [0.5, 0.29], r: 0.25 }, v: { c: [0.5, 0.33], r: 0.35 }, sway: 0.06, shoot: true },
};

const loadImage = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(`no photograph ${src}`)); im.src = src; });

/** A small round star sprite (white core, gold halo), drawn once and stamped. */
function starSprite(size = 96) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), h = size / 2;
  const rg = g.createRadialGradient(h, h, 0, h, h, h);
  rg.addColorStop(0, 'rgba(255,255,250,1)');
  rg.addColorStop(0.08, 'rgba(255,246,220,0.95)');
  rg.addColorStop(0.22, 'rgba(255,214,140,0.45)');
  rg.addColorStop(0.5, 'rgba(255,190,100,0.12)');
  rg.addColorStop(1, 'rgba(255,180,90,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, size, size);
  // a fine four-point flare
  g.globalCompositeOperation = 'lighter';
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const lg = g.createLinearGradient(h - dx * h, h - dy * h, h + dx * h, h + dy * h);
    lg.addColorStop(0, 'rgba(255,230,180,0)'); lg.addColorStop(0.5, 'rgba(255,240,210,0.7)'); lg.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = lg;
    if (dx) g.fillRect(0, h - 1, size, 2); else g.fillRect(h - 1, 0, 2, size);
  }
  return c;
}

export async function build({ plan }) {
  const P = PRESETS[plan.scene] ?? PRESETS['girih-mehr'];
  const vertical = plan.h > plan.w;
  const F = vertical ? P.v : P.w;
  const photo = await loadImage(`/page/photos/${P.photo}-${vertical ? 'v' : 'w'}.jpg`);
  const bands = bandReader(plan);
  const b = plan.bands ?? {};
  const bar = plan.bar, L = plan.L, loop = plan.format === 'loop';
  const period = loop ? L : (plan.loopBars ?? 8) * bar;
  const marks = plan.cues.marks ?? {};
  const drops = Object.entries(marks).filter(([k]) => /^drop/.test(k)).map(([, t]) => t).sort((x, y) => x - y);
  // the shooting stars: strong melody hits, at least 3.5 s apart (occasional, never a shower)
  const shots = [];
  for (const h of b.melOn ?? []) if (h.s >= 0.5 && (!shots.length || h.t - shots[shots.length - 1].t >= 3.5)) shots.push(h);
  if (loop && shots.length > 1 && shots[0].t + L - shots[shots.length - 1].t < 3.5) shots.pop();
  // the energy of the music: a follower of the measured loudness (quick attack, slow release), read round a loop
  const rms = plan.rms ?? [];
  const frames = plan.frames;
  const top = [...rms].sort((x, y) => x - y)[Math.floor(rms.length * 0.95)] || 1;
  const envl = new Float32Array(frames);
  {
    let e = 0;
    const passes = loop ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) for (let f = 0; f < frames; f++) {
      const x = clamp((rms[f] ?? 0) / top);
      e = x > e ? e + (x - e) * 0.35 : e + (x - e) * 0.025;
      envl[f] = e;
    }
  }
  const energyAt = (t) => { const f = Math.round(t * 30); return envl[loop ? ((f % frames) + frames) % frames : clamp(f, 0, frames - 1)] ?? 0; };
  // the bloom of the girih: the drops open it (eased over a bar), the breakdown and the outro close it; a loop starts ON
  // the drop, open at its start and its end (one cosine)
  const inDrop = (tt) => drops.some((d) => tt >= d - 0.02) && !(marks.break !== undefined && tt >= marks.break && tt < (marks.drop2 ?? Infinity) && !(marks.drop1b !== undefined && tt >= marks.drop1b && tt < (marks.break2 ?? Infinity)))
    && !(marks.break2 !== undefined && tt >= marks.break2 && tt < (marks.drop2 ?? Infinity)) && !(marks.outro !== undefined && tt >= marks.outro);
  const bloomAt = (t) => {
    if (loop) return 0.6 + 0.4 * Math.cos((TAU * t) / L);
    let s = 0, n = 0;
    for (let d = -bar; d <= 0; d += bar / 8) { s += inDrop(t + d) ? 1 : 0.12; n++; }
    return 0.35 * (s / n) + 0.65 * (s / n) * clamp(0.4 + energyAt(t));
  };
  const flashAt = (t) => { let v = 0; for (const d of drops) { const a = t - d; if (a >= 0 && a < 3) v = Math.max(v, Math.exp(-a / 0.45)); } return loop ? 0 : v; };
  // growth (Jangal): the lines draw themselves over the intro; for a Short or a loop the rosette is already grown
  const intro = drops[0] ?? 8;
  const growAt = (t) => (P.grow && plan.format === 'long' ? ease(t / Math.max(4, intro)) : 1);
  // the fireflies (Jangal) and the sky's small stars: fixed seeds, motion in whole cycles of the period
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const flies = Array.from({ length: P.flies ?? 0 }, (_, i) => ({ x: 0.08 + 0.84 * rnd(i), y: 0.45 + 0.5 * rnd(i + 50), ax: 0.02 + 0.03 * rnd(i + 9), ay: 0.015 + 0.02 * rnd(i + 19), k: 1 + (i % 3), ph: rnd(i + 99), fl: 2 + (i % 4) }));
  const twinkles = Array.from({ length: 70 }, (_, i) => ({ x: rnd(i + 200), y: rnd(i + 300) * (P.photo === 'jangal' ? 0.45 : 0.6), ph: rnd(i + 400), k: 2 + (i % 5) }));

  // the drawing surfaces: the glow is drawn at half size and laid on blurred; the reflection at half size
  const sprite = starSprite(96);
  const glow = document.createElement('canvas');
  glow.width = Math.round(plan.w / 2); glow.height = Math.round(plan.h / 2);
  const gctx = glow.getContext('2d');
  const refl = document.createElement('canvas');
  refl.width = Math.round(plan.w / 2); refl.height = Math.round(plan.h / 2);
  const rctx = refl.getContext('2d');
  // blurred copies are made at half size (four times cheaper than blurring the full frame)
  const half = () => { const c = document.createElement('canvas'); c.width = glow.width; c.height = glow.height; return [c, c.getContext('2d')]; };
  const [blurA, bctxA] = half(), [blurB, bctxB] = half(), [refl2, r2ctx] = half();

  // the frame check's hero: a tiny mark at the centre of a (blank) 3D scene, as the geometry worlds do
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1;
  const hero = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.02), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hero.position.set((F.c[0] - 0.5) * 2, (0.5 - F.c[1]) * 2, 0.5);
  scene.add(hero);

  let S = null; // the state of this frame, set by update, drawn by draw2d
  function update(t) {
    const kick = bands.at(b.kick, t), hat = bands.at(b.hat, t), mel = bands.at(b.mel, t), bass = bands.at(b.bass, t);
    const kh = bands.since(b.kicks, t);
    const bloom = bloomAt(t), flash = flashAt(t), energy = energyAt(t);
    S = { t, kick, hat, mel, bass, kh, bloom, flash, energy, grow: growAt(t) };
    return { exposure: 1, bloom: 0, shot: 0 };
  }

  const ph = (t) => (((t / period) % 1) + 1) % 1;
  function place(W, H, t) {
    const m = Math.min(W, H);
    let cy = F.c[1];
    if (P.rise && plan.format === 'long') cy += P.rise * (1 - clamp(t / L)); // the sun rises over the song
    return { cx: F.c[0] * W, cy: cy * H, R: F.r * m };
  }
  function strokeGeom(g, geom, { cx, cy, R, rot, sc, sy = 1, alpha, width, colour, grow = 1, vein = 1 }) {
    g.strokeStyle = colour;
    g.lineWidth = width;
    g.lineJoin = 'round'; g.lineCap = 'round';
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const l of geom.L) {
      const la = l.layer === 'core' ? 1 : l.layer === 'outer' ? 0.25 + 0.75 * S.bloom : 0.3 + 0.7 * S.bloom;
      const vis = clamp((grow * 1.3 - l.o * 0.7) / 0.3); // fully drawn at grow 1, even past the rim
      if (vis <= 0 || la * alpha <= 0.01) continue;
      g.globalAlpha = clamp(la * alpha * (l.vein ? 0.55 * vein : 1));
      g.beginPath();
      const n = l.pts.length, upto = vis >= 1 ? n : Math.max(2, Math.ceil(n * vis));
      for (let i = 0; i < upto; i++) {
        const [x, y] = l.pts[i];
        const X = cx + (x * c - y * s) * R * sc, Y = cy + (x * s + y * c) * R * sc * sy;
        if (i === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function draw2d(ctx, t, W, H) {
    const st = S ?? (update(t), S);
    const p = ph(t);
    // 1. the photograph: covering the frame, drifting slowly (round a circle on a loop), dimmer before the first drop
    const cover = Math.max(W / photo.width, H / photo.height);
    let z, ox, oy;
    if (plan.format === 'long') { const u = t / L; z = 1.05 + 0.07 * u; ox = 0.012 * Math.sin(TAU * u); oy = -0.01 * u; }
    else { z = 1.07 + 0.012 * Math.cos(TAU * p); ox = 0.008 * Math.sin(TAU * p); oy = 0.006 * Math.cos(TAU * p); }
    z *= 1 + 0.006 * st.bass;
    const pw = photo.width * cover * z, phh = photo.height * cover * z;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(photo, (W - pw) / 2 + ox * W, (H - phh) / 2 + oy * H, pw, phh);
    const dim = 0.5 * (1 - (0.35 + 0.65 * st.bloom));
    if (dim > 0.005) { ctx.fillStyle = `rgba(2,3,12,${dim.toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    const { cx, cy, R } = place(W, H, t);
    // the sun's glow behind the rosette (Mehr): it warms with the bloom and the kick
    if (P.sun) {
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
      const a = 0.05 + 0.14 * st.bloom + 0.06 * st.kick;
      sg.addColorStop(0, `rgba(255,190,110,${a.toFixed(3)})`); sg.addColorStop(0.45, `rgba(255,140,70,${(a * 0.35).toFixed(3)})`); sg.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    }
    // 2. the girih: turning one TRUE symmetry step a period (Si-o-se-pol's star is 11-fold; the compass only sways, its
    // long cardinal points make it 4-fold), breathing with the bass, opening on drops, breathing with the bass, opening on drops
    const geom = P.geom(st.bloom);
    let rot = (TAU / P.fold) * p;
    if (P.sway) rot = P.sway * Math.sin(TAU * Math.round(period / (2 * bar)) * p);
    const sc = (0.94 + 0.07 * st.bloom + 0.03 * st.flash) * (1 + 0.018 * st.bass);
    const lineA = clamp(0.45 + 0.35 * st.bloom + 0.15 * st.mel + 0.25 * st.flash);
    const k = W / 1920 * (H > W ? 1.25 : 1);
    // the glow layer: thick, half size, then laid on blurred (twice: a tight and a wide halo)
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, glow.width, glow.height);
    gctx.globalCompositeOperation = 'lighter';
    strokeGeom(gctx, geom, { cx: cx / 2, cy: cy / 2, R: R / 2, rot, sc, alpha: 0.32 * lineA * (0.7 + 0.5 * st.bloom), width: 2.0 * k, colour: 'rgb(255,176,80)', grow: st.grow });
    // the kick's ring: runs out from the heart to past the rim in 0.7 s
    const age = st.kh.age;
    const ringA = age < 0.75 ? Math.pow(1 - age / 0.75, 1.6) * clamp(age / 0.06) * clamp(0.35 + 0.6 * st.kh.s) : 0;
    const ringR = R * sc * (0.34 + 0.9 * ease(age / 0.75)); // born a third of the way out: no white blob at the heart
    if (ringA > 0.01) {
      gctx.globalAlpha = ringA;
      gctx.strokeStyle = 'rgb(255,214,150)';
      gctx.lineWidth = 4 * k;
      gctx.beginPath(); gctx.arc(cx / 2, cy / 2, ringR / 2, 0, TAU); gctx.stroke();
      gctx.globalAlpha = 1;
    }
    for (const [c2, x2, r] of [[blurA, bctxA, 7], [blurB, bctxB, 2]]) { x2.clearRect(0, 0, c2.width, c2.height); x2.filter = `blur(${(r * k).toFixed(1)}px)`; x2.drawImage(glow, 0, 0); x2.filter = 'none'; }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.75;
    ctx.drawImage(blurA, 0, 0, W, H);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(blurB, 0, 0, W, H);
    ctx.globalAlpha = 1;
    // the crisp lines
    ctx.globalCompositeOperation = 'source-over';
    strokeGeom(ctx, geom, { cx, cy, R, rot, sc, alpha: lineA, width: 1.7 * k, colour: 'rgb(246,206,128)', grow: st.grow });
    ctx.globalCompositeOperation = 'lighter';
    strokeGeom(ctx, geom, { cx, cy, R, rot, sc, alpha: 0.18 * lineA * (0.5 + st.bloom), width: 0.7 * k, colour: 'rgb(255,240,205)', grow: st.grow, vein: 0 });
    if (ringA > 0.01) {
      ctx.globalAlpha = ringA * 0.9;
      ctx.strokeStyle = 'rgb(255,236,196)';
      ctx.lineWidth = 1.6 * k;
      ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 3. the node-stars: lit by the bloom, by the ring as it passes, twinkling with the hats
    const c = Math.cos(rot), s = Math.sin(rot);
    const nodes = [];
    for (let i = 0; i < geom.N.length; i++) {
      const n = geom.N[i];
      if (clamp((st.grow * 1.3 - n.o * 0.7) / 0.3) < 0.6) continue;
      const [x, y] = n.p;
      const X = cx + (x * c - y * s) * R * sc, Y = cy + (x * s + y * c) * R * sc;
      const pass = ringA > 0 ? Math.exp(-Math.pow((Math.hypot(X - cx, Y - cy) - ringR) / (0.09 * R), 2)) * ringA : 0;
      const tw = 0.75 + 0.25 * Math.sin(TAU * (3 * p + rnd(i)));
      const b2 = (0.55 + 0.45 * st.bloom) * n.big * tw + 1.6 * pass + 0.5 * st.hat * (i % 3 === 0 ? 1 : 0) + 0.6 * st.flash * n.big;
      nodes.push([X, Y, b2]);
    }
    for (const [X, Y, b2] of nodes) {
      const size = (34 + 34 * clamp(b2 - 0.6)) * k * (H > W ? 1.1 : 1);
      ctx.globalAlpha = clamp(b2);
      ctx.drawImage(sprite, X - size / 2, Y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    // 4. the reflection (Si-o-se-pol): the girih mirrored under the river's line, squashed and rippling
    if (F.water) {
      const wy = F.water * H;
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.clearRect(0, 0, refl.width, refl.height);
      rctx.globalCompositeOperation = 'lighter';
      const ry = (wy + (wy - cy) * 0.55) / 2; // the mirror of the centre under the river's line, squashed
      strokeGeom(rctx, geom, { cx: cx / 2, cy: ry, R: R / 2, rot: -rot, sc, sy: -0.55, alpha: lineA, width: 1.6 * k, colour: 'rgb(255,190,110)', grow: st.grow });
      for (const [X, Y, b2] of nodes) { const yy = ry - (Y / 2 - cy / 2) * 0.55; rctx.globalAlpha = clamp(b2 * 0.7); rctx.drawImage(sprite, X / 2 - 8 * k, yy - 8 * k, 16 * k, 16 * k); }
      rctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      r2ctx.clearRect(0, 0, refl2.width, refl2.height); r2ctx.filter = `blur(${(0.8 * k).toFixed(1)}px)`; r2ctx.drawImage(refl, 0, 0); r2ctx.filter = 'none';
      ctx.globalAlpha = 0.42;
      const sh = 6;
      for (let y = Math.floor(wy / 2); y < refl.height; y += sh) {
        const off = 3 * k * Math.sin(y * 0.18 + TAU * 4 * p) * (0.5 + (y - wy / 2) / refl.height);
        ctx.drawImage(refl2, 0, y, refl.width, sh, off, y * 2, W, sh * 2);
      }
      ctx.globalAlpha = 1;
    }
    // 5. the sky's small stars twinkle with the hats (above the horizon only)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < twinkles.length; i++) {
      const q = twinkles[i];
      const a = clamp(0.12 + 0.55 * st.hat * (0.5 + 0.5 * Math.sin(TAU * (q.k * p + q.ph))));
      if (a < 0.05) continue;
      const size = 9 * k;
      ctx.globalAlpha = a;
      ctx.drawImage(sprite, q.x * W - size / 2, q.y * H - size / 2, size, size);
    }
    // 6. the fireflies (Jangal): drifting in whole cycles, flickering, brighter on the beat
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i];
      const x = (f.x + f.ax * Math.sin(TAU * (f.k * p + f.ph))) * W;
      const y = (f.y + f.ay * Math.sin(TAU * (f.k * 2 * p + f.ph * 1.7))) * H;
      const fl = 0.5 + 0.5 * Math.sin(TAU * (f.fl * p + f.ph));
      const a = clamp(0.3 + 0.7 * fl * (0.5 + 0.5 * st.energy) + 0.5 * st.kick * (i % 2));
      const size = (26 + 22 * fl) * k;
      ctx.globalAlpha = a;
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    // 7. a shooting star now and then (strong melody hits, read round a loop), in the sky
    if (P.shoot && shots.length) {
      let sh = null;
      for (const h of shots) for (const off of loop ? [0, -L] : [0]) { const a = t - (h.t + off); if (a >= 0 && a < 1.1) sh = { a, seed: shots.indexOf(h) }; }
      if (sh) {
        const u = sh.a / 1.1;
        const side = sh.seed % 2 ? 1 : -1;
        const x0 = W * (0.5 + side * (0.18 + 0.2 * rnd(sh.seed + 7))), y0 = H * (0.05 + 0.12 * rnd(sh.seed + 3));
        const dx = -side * W * 0.22, dy = H * (H > W ? 0.08 : 0.14);
        const hx = x0 + dx * ease(u), hy = y0 + dy * ease(u);
        const tl = 0.35 + 0.4 * u;
        const tx = hx - dx * tl * 0.5, ty = hy - dy * tl * 0.5;
        const a = Math.sin(Math.PI * u);
        const lg = ctx.createLinearGradient(hx, hy, tx, ty);
        lg.addColorStop(0, `rgba(255,246,225,${(0.95 * a).toFixed(3)})`); lg.addColorStop(1, 'rgba(255,220,160,0)');
        ctx.strokeStyle = lg; ctx.lineWidth = 2.2 * k; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.globalAlpha = a;
        ctx.drawImage(sprite, hx - 14 * k, hy - 14 * k, 28 * k, 28 * k);
        ctx.globalAlpha = 1;
      }
    }
    // 8. the beat in the light: a faint warm wash on each kick, a stronger one as a drop lands
    const wash = 0.05 * st.kick + 0.05 * ringA + 0.22 * st.flash;
    if (wash > 0.004) { ctx.fillStyle = `rgba(255,200,140,${clamp(wash).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    ctx.globalCompositeOperation = 'source-over';
    // a soft vignette keeps the eye on the girih and the words readable
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,8,0.45)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  const keyTimes = [0, 0.1, L * 0.25, L * 0.5, L * 0.75, L - 1 / 30, ...drops.filter((d) => d > 0 && d < L).map((d) => d + 0.3)].map((x) => +Math.max(0, Math.min(L - 0.05, x)).toFixed(2));
  return {
    scene, camera, update, draw2d, heroes: [hero], cuts: [0, L * 0.25, L * 0.5, L * 0.75],
    anchors: { end: () => (plan.format === 'long' ? [960, 470] : [480, 560]) },
    keyTimes: [...new Set(keyTimes)].sort((x, y) => x - y),
  };
}
