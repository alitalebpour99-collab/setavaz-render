// Round 3: the plans from the test jobs (jobs/<track>.json: the panel's job with the catalogue's beat grid) pass the gate's rules, each made-up fault fails only its own check, the
// library's manifest matches its files, and every scene keeps its objects whole inside the frame from start to end.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { FPS, PART_FRAMES, checkJob, makeR3Plan, partRange, partsOf, readJob } from './plan.mjs';
import { LIMITS, LIMITS_LONG, SAFE, SAFE_LONG, limitsOf, verdict } from './gate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TRACKS = fs.readdirSync(path.join(HERE, 'jobs')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
const jobOf = (trackId) => readJob(path.join(HERE, 'jobs', `${trackId}.json`));
const never = jobOf('last-ember').never;
const planOf = (trackId, { job = jobOf(trackId), ...extra } = {}) => makeR3Plan({ job, ...extra });
/** What the page would report for a plan: the words by their times, a box well inside, a picture that is lit. */
function fakeFrames(plan, change = () => {}) {
  if (plan.format === 'long') return fakeLong(plan, change);
  const frames = [];
  for (let f = 0; f < plan.frames; f++) {
    const t = f / FPS;
    const rows = [];
    for (const x of plan.texts) {
      const to = x.to ?? plan.L + 1;
      if (t < x.from || t > to) continue;
      const o = Math.min(1, (t - x.from) / 0.5, x.role === 'end' ? 1 : (to - t) / 0.5);
      if (x.role === 'signature') rows.push({ role: 'signature', text: x.lines[0], size: x.size, opacity: o, x0: 300, x1: 660, y0: 1340, y1: 1410 });
      if (x.role === 'end') {
        x.lines.forEach((line, i) => rows.push({ role: 'end-title', text: line, size: x.size, opacity: o, x0: 300, x1: 660, y0: 500 + i * 80, y1: 570 + i * 80 }));
        rows.push({ role: 'end-soon', text: x.soon, size: x.soonSize, opacity: o, x0: 340, x1: 620, y0: 700, y1: 730 });
      }
      if (x.role === 'badge') rows.push({ role: 'badge', text: x.name, size: x.size, opacity: o, x0: 66, x1: 300, y0: 1430, y1: 1465 });
    }
    frames.push({ f, luma: 0.2, rows, box: f % 3 === 0 ? { x0: 0.2, y0: 0.3, x1: 0.8, y1: 0.7, behind: false } : null });
  }
  change(frames);
  return frames;
}
/** The same for a long video, laid out in its 16:9 frame. */
function fakeLong(plan, change) {
  const frames = [];
  for (let f = 0; f < plan.frames; f++) {
    const t = f / FPS;
    const rows = [];
    for (const x of plan.texts) {
      const to = x.to ?? plan.L + 1;
      if (t < x.from || t > to) continue;
      const o = Math.min(1, (t - x.from) / 0.5, x.role === 'end' ? 1 : (to - t) / 0.5);
      if (x.role === 'signature') rows.push({ role: 'signature', text: x.lines[0], size: x.size, opacity: o, x0: 840, x1: 1080, y0: 912, y1: 965 });
      if (x.role === 'end') {
        x.lines.forEach((line, i) => rows.push({ role: 'end-title', text: line, size: x.size, opacity: o, x0: 800, x1: 1120, y0: 420 + i * 90, y1: 500 + i * 90 }));
        rows.push({ role: 'end-soon', text: x.soon, size: x.soonSize, opacity: o, x0: 860, x1: 1060, y0: 540, y1: 570 });
      }
      if (x.role === 'badge') rows.push({ role: 'badge', text: x.name, size: x.size, opacity: o, x0: 102, x1: 330, y0: 975, y1: 1008 });
    }
    frames.push({ f, luma: 0.2, rows, box: f % 3 === 0 ? { x0: 0.2, y0: 0.3, x1: 0.8, y1: 0.7, behind: false } : null });
  }
  change(frames);
  return frames;
}
const failed = (v) => v.checks.filter((c) => !c.ok).map((c) => c.id);

test('the three plans: a window inside the track, cues where the sound turns, few English words', () => {
  const ember = planOf('last-ember');
  assert.equal(ember.scene, 'ember');
  assert.ok(ember.cues.fallT > 2.5 && ember.cues.fallT < 4.2, `fallT ${ember.cues.fallT}`);
  assert.ok(ember.cues.dropT > 9 && ember.cues.dropT < 10.2, `dropT ${ember.cues.dropT}`);
  const storm = planOf('copper-storm');
  assert.ok(storm.cues.dropT > 4.5 && storm.cues.dropT < 5.4, `dropT ${storm.cues.dropT}`);
  assert.ok(storm.cues.riseT > 2.5 && storm.cues.riseT < storm.cues.dropT, `riseT ${storm.cues.riseT}`);
  const molten = planOf('molten-midnight');
  assert.ok(Math.abs(molten.cues.closeT - 12.8) < 0.15, `closeT ${molten.cues.closeT}`);
  assert.ok(molten.cues.calmT > 21 && molten.cues.calmT < 25, `calmT ${molten.cues.calmT}`);
  for (const p of [ember, storm, molten]) {
    assert.ok(p.L >= LIMITS.minS && p.L <= LIMITS.maxS);
    assert.equal(p.lang, 'en');
    const words = p.texts.flatMap((x) => [...(x.lines ?? []), x.soon, x.name]).filter(Boolean).join(' ');
    assert.match(words, /^[\x20-\x7E]+$/, 'English only');
    assert.equal(p.texts.find((x) => x.role === 'end').soon, 'Coming soon');
    const v = verdict({ plan: p, frames: fakeFrames(p), file: { bytes: 9e6, lufs: -14.2, tp: -1.4 }, never });
    assert.deepEqual(failed(v), [], JSON.stringify(v.checks.filter((c) => !c.ok)));
  }
});

test('the test jobs are the three worlds, and a job carries no sound, file name or checksum', () => {
  assert.deepEqual(TRACKS, ['copper-storm', 'focus-long', 'focus-s1', 'last-ember', 'molten-midnight', 'night-drive-long', 'night-drive-s1', 'yalda-long', 'yalda-s1']);
  for (const t of TRACKS) {
    const raw = fs.readFileSync(path.join(HERE, 'jobs', `${t}.json`), 'utf8');
    assert.doesNotMatch(raw, /.(m4a|wav|mp3|flac|aac)|sha256|https?:/i, `${t}: numbers only`);
    assert.equal(jobOf(t).beats.source, 'grid');
  }
  // the dispatch's form (gzip, then base64) reads the same as the plain file
  const tmp = path.join(HERE, '..', 'job-test.b64');
  fs.writeFileSync(tmp, zlib.gzipSync(JSON.stringify(jobOf('last-ember'))).toString('base64'));
  try { assert.deepEqual(readJob(tmp), jobOf('last-ember')); } finally { fs.rmSync(tmp, { force: true }); }
  assert.throws(() => checkJob({ ...jobOf('last-ember'), v: 2 }), /version/);
  assert.throws(() => checkJob({ ...jobOf('last-ember'), beats: { source: 'measured', onsets: [] } }), /beats/);
});

test('a track says «Out now» only when the catalogue gives a release date that has come', () => {
  const soon = { ...jobOf('last-ember'), outOn: '2099-01-01' };
  assert.equal(planOf('last-ember', { job: soon }).texts.find((x) => x.role === 'end').soon, 'Coming soon');
  const out = { ...jobOf('last-ember'), outOn: '2026-11-01' };
  const p = planOf('last-ember', { job: out, today: '2026-11-16' });
  assert.equal(p.texts.find((x) => x.role === 'end').soon, 'Out now');
  assert.deepEqual(failed(verdict({ plan: p, frames: fakeFrames(p), never })), []);
});

test('each fault fails its own check', () => {
  const plan = planOf('last-ember');
  const run = (change, file) => failed(verdict({ plan, frames: fakeFrames(plan, change), file, never }));
  assert.deepEqual(run((fr) => fr.forEach((x) => x.rows.forEach((r) => { if (r.role === 'signature') r.text = 'آخرین اخگر'; }))), ['english', 'signature']);
  assert.deepEqual(run((fr) => fr.forEach((x) => x.rows.forEach((r) => { if (r.role === 'end-soon') r.text = 'Out now'; }))), ['soon']);
  assert.deepEqual(run((fr) => fr.forEach((x) => { x.rows.push({ role: 'signature', text: 'NEW TRACK', size: 60, opacity: 1, x0: 300, x1: 600, y0: 300, y1: 360 }); })), ['few-words']);
  assert.deepEqual(run((fr) => fr.forEach((x) => x.rows.forEach((r) => { r.size = 128; }))), ['few-words']);
  assert.deepEqual(run((fr) => fr.forEach((x) => x.rows.forEach((r) => { if (r.role === 'badge') r.x1 = SAFE.right + 30; }))), ['safe']);
  assert.deepEqual(run((fr) => { fr[300].box = { x0: -0.01, y0: 0.3, x1: 0.8, y1: 0.7, behind: false }; }), ['in-frame']);
  assert.deepEqual(run((fr) => fr.forEach((x) => { x.luma = 0.004; })), ['visible']);
  assert.deepEqual(run(() => {}, { bytes: 31 * 1024 * 1024, lufs: -14, tp: -1.2 }), ['size']);
  assert.deepEqual(run(() => {}, { bytes: 9e6, lufs: -11.5, tp: -1.2 }), ['loudness']);
  // the silent picture from this repo: only its size here, the loudness is the app's check once the sound is under it
  assert.deepEqual(run(() => {}, { bytes: 9e6 }), []);
  assert.deepEqual(failed(verdict({ plan: { ...plan, L: 34 }, frames: fakeFrames(plan), never })), ['length']);
});

test('the library manifest names every object, and every row has what the Ahura library asks for', async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'library', 'manifest.json'), 'utf8'));
  const { OBJECTS } = await import('./library/index.mjs');
  const ids = new Set(manifest.entries.map((e) => e.id));
  assert.equal(ids.size, manifest.entries.length, 'ids are unique');
  for (const o of OBJECTS) assert.ok(ids.has(o.id), `${o.id} has a manifest row`);
  for (const e of manifest.entries) {
    assert.ok(e.names?.en && e.names?.fa, `${e.id}: names in English and Persian`);
    assert.ok(e.depicts && e.tags?.length >= 2 && e.made?.detail, `${e.id}: depicts, tags, how made`);
    assert.equal(e.licence?.name, 'own procedural work');
    assert.equal(e.origin, 'setavaz');
    const mod = await import(pathToFileURL(path.join(HERE, 'library', e.file)).href);
    assert.equal(typeof mod[e.symbol], 'function', `${e.id}: ${e.file} exports ${e.symbol}`);
  }
  for (const o of OBJECTS) assert.ok(o.make().isObject3D, `${o.id} builds`);
});

test('every scene builds without a browser and keeps its objects whole inside the frame, on every shot', async () => {
  const { screenBox } = await import('./page/kit.mjs');
  for (const trackId of TRACKS) {
    const plan = planOf(trackId);
    const mod = await import(`./page/scenes/${plan.scene}.mjs`);
    const world = mod.build({ plan });
    assert.ok(world.cuts.length >= 4, `${trackId}: at least four shots`);
    for (let f = 0; f < plan.frames; f += 4) {
      world.update(f / FPS);
      const b = screenBox(world.heroes, world.camera);
      const m = LIMITS.margin;
      assert.ok(!b.behind && b.x0 >= m && b.y0 >= m && b.x1 <= 1 - m && b.y1 <= 1 - m, `${trackId} at ${(f / FPS).toFixed(2)} s: ${JSON.stringify(b)}`);
    }
    const [ax, ay] = world.anchors.end();
    const safe = limitsOf(plan).safe;
    assert.ok(ax > safe.left + 150 && ax < safe.right - 150 && ay > safe.top + 150 && ay < safe.bottom - 150, `${trackId}: the end card's place ${ax},${ay}`);
  }
});

test('the round-1119 worlds: Shorts and long videos from the marks of the track, cues in the window, words where they belong', () => {
  for (const id of ['yalda-s1', 'night-drive-s1', 'focus-s1']) {
    const p = planOf(id);
    assert.equal(p.format, 'short');
    assert.equal(p.w, 1080);
    assert.ok(p.L >= LIMITS.minS && p.L <= LIMITS.maxS, `${id}: ${p.L} s`);
    assert.ok(p.cues.dropT > 4 && p.cues.dropT < 7, `${id}: the drop at ${p.cues.dropT} s`);
    assert.deepEqual(failed(verdict({ plan: p, frames: fakeFrames(p), file: { bytes: 9e6 }, never })), []);
  }
  for (const id of ['yalda-long', 'night-drive-long', 'focus-long']) {
    const p = planOf(id);
    assert.equal(p.format, 'long');
    assert.deepEqual([p.w, p.h], [1920, 1080]);
    assert.ok(p.L >= LIMITS_LONG.minS && p.L <= LIMITS_LONG.maxS);
    assert.equal(p.a0, 0);
    const badge = p.texts.find((x) => x.role === 'badge');
    assert.ok(badge.from > p.cues.dropT && badge.to < p.L - 10, `${id}: the badge once, after the first drop`);
    assert.equal(p.texts.find((x) => x.role === 'end').soon, 'Coming soon');
    assert.deepEqual(failed(verdict({ plan: p, frames: fakeFrames(p), file: { bytes: 120e6 }, never })), []);
    // the badge near the middle of the frame is refused
    const mid = failed(verdict({ plan: p, frames: fakeFrames(p, (fr) => fr.forEach((x) => x.rows.forEach((r) => { if (r.role === 'badge') { r.y0 = 1030; r.y1 = 1070; } }))), never }));
    assert.deepEqual(mid, ['safe']);
  }
  assert.throws(() => checkJob({ ...jobOf('yalda-long'), conf: { ...jobOf('yalda-long').conf, format: 'square' } }), /format/);
  assert.throws(() => checkJob({ ...jobOf('yalda-long'), conf: { ...jobOf('yalda-long').conf, lengthS: undefined } }), /length/);
  assert.equal(SAFE_LONG.right > SAFE.right, true);
});

test('a long video is drawn in parts that cover every frame once, in order', () => {
  for (const id of ['yalda-long', 'night-drive-long', 'focus-long']) {
    const p = planOf(id);
    const n = partsOf(p);
    assert.ok(n >= 2 && n <= 20, `${id}: ${n} parts`);
    let next = 0;
    for (let k = 0; k < n; k++) {
      const r = partRange(p, k, n);
      assert.equal(r.from, next);
      assert.ok(r.to - r.from <= PART_FRAMES + 1);
      next = r.to;
    }
    assert.equal(next, p.frames);
  }
  assert.equal(partsOf(planOf('last-ember')), 1);
});

// The Persian-geometry loops (Ali 21 Nov 2026): 8 to 16 s, ON the drop, seamless, the small title and badge on every
// frame and nothing else; the world reads its bands round the loop, so its last frame flows into its first.
function loopJob(scene = 'geo-kahkeshan') {
  const j = structuredClone(jobOf('last-ember'));
  j.conf = { ...j.conf, scene, format: 'loop', bars: 8, marks: { drop1: j.conf.startS } };
  const n = j.beats.rms.length;
  const wave = (k) => Array.from({ length: n }, (_, f) => +(0.5 + 0.5 * Math.sin((f / n) * Math.PI * 2 * k)).toFixed(2));
  j.beats.bands = { fps: 30, frames: n, cyclic: true, kick: wave(32), bass: wave(8), hat: wave(64), mel: wave(4), hue: wave(1), kicks: j.beats.onsets.filter((o) => o.low >= 0.45).map((o) => ({ t: o.t, s: o.s })), melOn: [{ t: 3, s: 0.8 }] };
  return j;
}
test('a geometry loop: its plan, its words on every frame, its seam and its gate', async () => {
  for (const scene of ['geo-kahkeshan', 'geo-bazaar']) {
    const plan = makeR3Plan({ job: loopJob(scene) });
    assert.equal(plan.format, 'loop');
    assert.deepEqual([plan.w, plan.h], [1080, 1920]);
    assert.deepEqual(plan.texts.map((x) => x.role), ['tag']);
    const tagRows = () => [{ role: 'tag-title', text: plan.track.titleEn, size: 34, opacity: 1, x0: 66, x1: 300, y0: 1390, y1: 1426 }, { role: 'badge', text: 'Setavaz', size: 28, opacity: 1, x0: 66, x1: 280, y0: 1442, y1: 1472 }];
    const frames = Array.from({ length: plan.frames }, (_, f) => ({ f, luma: 0.2 + (f < 8 || f === plan.frames - 1 ? 0.05 : 0), rows: tagRows(), box: f % 3 === 0 ? { x0: 0.49, y0: 0.49, x1: 0.51, y1: 0.51, behind: false } : null }));
    const v = verdict({ plan, frames, file: { bytes: 9e6 }, never });
    assert.deepEqual(failed(v), [], JSON.stringify(v.checks.filter((c) => !c.ok)));
    // a frame with no title, or a seam that jumps, is refused
    const cut = frames.map((x, i) => (i === frames.length - 1 ? { ...x, rows: [] } : x));
    assert.ok(failed(verdict({ plan, frames: cut, never })).includes('signature'));
    const jump = frames.map((x, i) => (i === frames.length - 1 ? { ...x, luma: 0.5 } : x));
    assert.ok(failed(verdict({ plan, frames: jump, never })).includes('seam'));
    // the world: builds without a browser, turns one symmetry step a loop, reads the bands round the loop
    const mod = await import('./page/scenes/geo.mjs');
    const world = mod.build({ plan });
    const u = () => Object.fromEntries(Object.entries(world.scene.children[0].material.uniforms).map(([k, x]) => [k, x.value]));
    world.update(0); const a = u();
    world.update(plan.L - 1e-6); const b = u();
    for (const k of ['uKick', 'uBass', 'uHat', 'uMel', 'uHue']) assert.ok(Math.abs(a[k] - b[k]) < 0.25, `${k} ${a[k]} ${b[k]}`);
    assert.ok(Math.abs(a.uBloom - b.uBloom) < 0.01 && a.uBloom > 0.95, 'open on the drop at both ends');
    assert.ok(a.uPh < 0.01 && b.uPh > 0.99);
    const { screenBox } = await import('./page/kit.mjs');
    const box = screenBox(world.heroes, world.camera);
    assert.ok(box.x0 > 0.4 && box.x1 < 0.6 && !box.behind, JSON.stringify(box));
  }
  // the bands, when given, must be whole
  assert.throws(() => checkJob({ ...loopJob(), beats: { ...loopJob().beats, bands: { kick: [1] } } }), /bands/);
});
