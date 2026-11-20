// The plan of a round-3 video (a 9:16 Short, or since 20 Nov 2026 a 16:9 long video of the whole track): which seconds of the track, where its strongest moments are (measured from the sound),
// and the few words. The picture itself is page/scenes/<scene>.mjs; it reads only what this returns.
// Everything comes from the job the Setavaz app sends with the dispatch (lib/r3job.ts in the app's private repo): the
// track's name, tempo and length, its round-3 world, and the window's sound as numbers only (onsets and loudness per
// video frame), measured on the app's own server. The track itself never comes here: the picture is rendered silent
// and the app puts the sound under it.
import fs from 'node:fs';
import zlib from 'node:zlib';

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const JOB_VERSION = 1;
/** The two shapes of a Setavaz video: the 9:16 Short (a window of whole bars) and the 16:9 long video (the whole track). */
export const FORMATS = { short: { w: 1080, h: 1920 }, long: { w: 1920, h: 1080 }, loop: { w: 1080, h: 1920 } };
/** A loop (21 Nov 2026): a 9:16 Short of whole bars that starts ON the drop and whose last frame flows into its first. */
export const isLoop = (plan) => plan.format === 'loop';
/** A long video is drawn in parts of about this many frames, each part on its own runner (r3.yml, what = r3-long). */
export const PART_FRAMES = 600;

/** A job from a file: plain JSON, or the dispatch input as it arrives (gzip, then base64). */
export function readJob(file) {
  const raw = fs.readFileSync(file, 'utf8').trim();
  const json = raw.startsWith('{') ? raw : zlib.gunzipSync(Buffer.from(raw, 'base64')).toString('utf8');
  return checkJob(JSON.parse(json));
}

/** Bands, when given (the geometry worlds), are per-frame number lists of the same length. */
const b0 = (b) => b !== undefined && b !== null && (typeof b !== 'object' || !['kick', 'bass', 'hat', 'mel', 'hue'].every((k) => Array.isArray(b[k]) && b[k].length === b.kick.length) || !Array.isArray(b.kicks) || !Array.isArray(b.melOn));

/** The job's shape, so a broken dispatch fails in a second with a reason, not after the browser started. */
export function checkJob(job) {
  const bad = (why) => { throw new Error(`the job is not usable: ${why}`); };
  if (!job || job.v !== JOB_VERSION) bad(`version ${job?.v} (this renderer reads ${JOB_VERSION})`);
  if (!/^[a-z0-9-]{1,60}$/.test(String(job.trackId))) bad('track id');
  const t = job.track;
  if (!t || t.id !== job.trackId || typeof t.titleEn !== 'string' || !(t.bpm > 0) || !(t.durationMs > 0)) bad('track');
  const c = job.conf;
  if (!c || !/^[a-z0-9-]{1,40}$/.test(String(c.scene)) || !(c.startS >= 0)) bad('conf');
  if (c.format !== undefined && !FORMATS[c.format]) bad(`format ${c.format}`);
  if ((c.format ?? 'short') !== 'long' ? !(c.bars > 0) : !(c.lengthS > 0)) bad('conf length');
  if (b0(job.beats?.bands)) bad('bands');
  if (c.marks !== undefined && (!c.marks || typeof c.marks !== 'object' || Object.values(c.marks).some((v) => !Number.isFinite(v)))) bad('marks');
  if (typeof job.artist !== 'string' || !job.brand?.star?.d) bad('artist or brand');
  if (!Array.isArray(job.never)) bad('never');
  const b = job.beats;
  if (!b || !/^(measured|grid)$/.test(b.source) || !Array.isArray(b.onsets) || !Array.isArray(b.rms) || !Array.isArray(b.low)) bad('beats');
  return job;
}

const mean = (a, i, j) => { let s = 0, n = 0; for (let k = Math.max(0, i); k < Math.min(a.length, j); k++) { s += a[k]; n++; } return n ? s / n : 0; };
const smoothed = (a, r = 4) => a.map((_, i) => mean(a, i - r, i + r + 1));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
/** The onset nearest to t within ±tol (kicks first), or t itself. */
function snap(onsets, t, tol) {
  let best = null;
  for (const o of onsets) { const d = Math.abs(o.t - t); if (d <= tol && (!best || d - 0.03 * o.low < best.d)) best = { d: d - 0.03 * o.low, t: o.t }; }
  return best ? best.t : t;
}

/**
 * Where the picture's events land, from the sound of the window. Every cue has a fallback on the bar grid (used when
 * the sound does not show the shape the scene expects) and says which it is.
 */
export function cuesFor(scene, { rms, onsets, bar, L }) {
  const sm = smoothed(rms);
  const at = (f) => f / FPS;
  const out = { measured: {} };
  const set = (k, v, ok) => { out[k] = +v.toFixed(3); out.measured[k] = ok; };
  if (scene === 'ember') {
    // loud, then a breakdown, then the drop
    const open = median(sm.slice(0, FPS)) || 1;
    let fall = -1;
    for (let f = Math.round(0.5 * FPS); f < sm.length - FPS; f++) if (sm[f] < 0.8 * open && mean(sm, f, f + 15) < 0.8 * open) { fall = f; break; }
    let drop = -1;
    if (fall > 0) for (let f = fall + FPS; f < rms.length - 15; f++) if (rms[f] >= 0.82 * open && mean(rms, f, f + 15) >= 0.8 * open) { drop = f; break; }
    const okF = fall > 0 && at(fall) < L * 0.4, okD = drop > 0 && at(drop) > at(fall) + 2 && at(drop) < L - 8;
    set('fallT', okF ? at(fall) : 2 * bar, okF);
    set('dropT', okF && okD ? snap(onsets, at(drop), 0.2) : 6 * bar, okF && okD);
  } else if (scene === 'storm') {
    // near silence, a rise, the drop
    let drop = -1;
    for (let f = FPS; f < rms.length - 12; f++) if (rms[f] > 0.55 && mean(rms, f, f + 12) > 0.5) { drop = f; break; }
    const okD = drop > 0 && at(drop) > 2 && at(drop) < L - 10 && mean(sm, 0, Math.round(1.5 * FPS)) < 0.2;
    const dropT = okD ? snap(onsets, at(drop), 0.15) : 3 * bar;
    let rise = -1;
    const end = Math.round(dropT * FPS);
    for (let f = end - 1; f > 0; f--) if (sm[f] < 0.045) { rise = f; break; }
    const okR = okD && rise > 0 && at(rise) < dropT - 0.4;
    set('riseT', okR ? at(rise) : Math.max(0.5, dropT - bar), okR);
    set('dropT', dropT, okD);
  } else if (scene === 'molten') {
    // an even track: the ring closes where its last phrase begins (eight bars before the end of the sixteen), and
    // the calm ending starts where the loudness leaves its level for good
    const level = median(sm.slice(0, Math.round(sm.length * 0.7))) || 1;
    let calm = -1;
    for (let f = sm.length - 1; f > 0; f--) if (sm[f] >= 0.9 * level) { calm = f; break; }
    const okC = calm > 0 && at(calm) > L * 0.6 && at(calm) < L - 0.8;
    const grid = Math.round(L / bar / 2) * bar;
    const closeT = snap(onsets.filter((o) => o.low >= 0.4), grid, 0.12);
    set('closeT', closeT, closeT !== grid);
    set('calmT', okC ? at(calm) : L - 2.4, okC);
  }
  return out;
}

/**
 * The cues of a world that knows its track: the sections' starts in the TRACK's time (conf.marks, measured once from
 * the master and kept with the world), moved into the window (seconds from its start) and snapped to the nearest low
 * hit when inside it. `dropT` is the first drop inside the window (the gate's climax and the cover frame).
 */
export function cuesFromMarks(marks, { a0, L, onsets }) {
  const out = { measured: {}, marks: {} };
  const lows = onsets.filter((o) => o.low >= 0.3);
  for (const [k, T] of Object.entries(marks)) {
    const t = T - a0;
    const s = t > 0.2 && t < L - 0.2 ? snap(lows, t, 0.12) : t;
    out.marks[k] = +s.toFixed(3);
    out.measured[k] = s !== t;
  }
  const drops = Object.entries(out.marks).filter(([k, t]) => /^drop/.test(k) && t >= 1.5 && t < L - 3).sort((a, b) => a[1] - b[1]);
  if (drops.length) out.dropT = drops[0][1];
  return out;
}

/** Split a title over lines of at most `max` letters (for the end card inside the ring). */
const linesOf = (title, max) => (title.length <= max ? [title] : title.split(' '));

/**
 * The plan from a job (see checkJob). «Out now» only once the catalogue's release date (job.outOn) has come by
 * `today`; until then «Coming soon».
 */
export function makeR3Plan({ job, today = new Date().toISOString().slice(0, 10) }) {
  const { trackId, track, conf: c, beats: sound } = job;
  const format = c.format ?? 'short';
  const { w, h } = FORMATS[format];
  const beat = 60 / track.bpm, bar = 4 * beat;
  const L = +(format === 'long' ? c.lengthS : c.bars * bar).toFixed(3);
  const a0 = c.startS;
  if (a0 + L > track.durationMs / 1000 + 0.05) throw new Error(`the window of «${trackId}» runs past the track's end`);
  const frames = Math.round(L * FPS);
  if (sound.rms.length < frames - 1) throw new Error(`the job's sound covers ${sound.rms.length} frames, the Short has ${frames}`);
  const out = Boolean(job.outOn && job.outOn <= today);
  const title = track.titleEn;
  const endLines = linesOf(title, c.endMax ?? 99);
  const cues = c.marks ? cuesFromMarks(c.marks, { a0, L, onsets: sound.onsets }) : cuesFor(c.scene, { rms: sound.rms, onsets: sound.onsets, bar, L });
  const soon = out ? 'Out now' : 'Coming soon';
  let texts;
  if (format === 'long') {
    // the long video: the name once at the start (lower third), the badge once when the first drop has settled (bottom
    // left, never in the middle), the end card over the last seconds
    const endFrom = +(L - (c.endS ?? 7)).toFixed(3);
    const badgeAt = +Math.min(endFrom - 12, Math.max(12, (cues.dropT ?? 20) + 10)).toFixed(3);
    texts = [
      { role: 'signature', lines: [title], from: 1.2, to: 6.4, size: 52, y: 952 },
      { role: 'badge', name: job.artist, from: badgeAt, to: +(badgeAt + 6.5).toFixed(3), size: 30, y: 1000 },
      { role: 'end', lines: endLines, soon, from: endFrom, size: c.endSize ?? 92, soonSize: 28 },
    ];
  } else if (format === 'loop') {
    // a loop: no end card and no fades (its last frame flows into its first); only the small title and the badge, still
    texts = [{ role: 'tag', lines: [title], name: job.artist, from: 0, to: L + 1, size: 34, y: 1418 }];
  } else {
    const endFrom = +(L - (c.endS ?? 2.7)).toFixed(3);
    texts = [
      { role: 'signature', lines: [title], from: 0.9, to: Math.min(3.7, endFrom - 1), size: 60, y: 1392 },
      { role: 'end', lines: endLines, soon, from: endFrom, size: c.endSize ?? 84, soonSize: 28 },
      { role: 'badge', name: job.artist, from: +(endFrom + 0.3).toFixed(3), to: +(L - 0.15).toFixed(3), size: 30, y: 1456 },
    ];
  }
  return {
    id: `r3-${trackId}`, style: 'r3', format, scene: c.scene, lang: 'en', w, h, fps: FPS, frames,
    track: { id: track.id, titleEn: title, bpm: track.bpm }, out,
    a0, L, bars: c.bars ?? null, bar: +bar.toFixed(4), beat: +beat.toFixed(4),
    sound: { source: sound.source }, onsets: sound.onsets, rms: sound.rms, low: sound.low, bands: sound.bands ?? null, cues, texts,
    loopBars: c.loopBars ?? 8,
  };
}

/** How many parts a plan is drawn in: a Short in one, a long video in parts of about PART_FRAMES frames. */
export const partsOf = (plan) => (plan.format === 'long' ? Math.max(1, Math.ceil(plan.frames / PART_FRAMES)) : 1);
/** The frames [from, to) of part k of n. */
export function partRange(plan, k, n = partsOf(plan)) {
  const size = Math.ceil(plan.frames / n);
  return { from: Math.min(plan.frames, k * size), to: Math.min(plan.frames, (k + 1) * size) };
}
