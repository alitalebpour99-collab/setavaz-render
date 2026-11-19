// Round 3: the plans from the test jobs (jobs/<track>.json: the panel's job with the catalogue's beat grid) pass the gate's rules, each made-up fault fails only its own check, the
// library's manifest matches its files, and every scene keeps its objects whole inside the frame from start to end.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { FPS, checkJob, makeR3Plan, readJob } from './plan.mjs';
import { LIMITS, SAFE, verdict } from './gate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TRACKS = fs.readdirSync(path.join(HERE, 'jobs')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
const jobOf = (trackId) => readJob(path.join(HERE, 'jobs', `${trackId}.json`));
const never = jobOf('last-ember').never;
const planOf = (trackId, { job = jobOf(trackId), ...extra } = {}) => makeR3Plan({ job, ...extra });
/** What the page would report for a plan: the words by their times, a box well inside, a picture that is lit. */
function fakeFrames(plan, change = () => {}) {
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
  assert.deepEqual(TRACKS, ['copper-storm', 'last-ember', 'molten-midnight']);
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
    assert.ok(ax > SAFE.left + 150 && ax < SAFE.right - 150 && ay > SAFE.top + 150 && ay < SAFE.bottom - 150, `${trackId}: the end card's place ${ax},${ay}`);
  }
});
