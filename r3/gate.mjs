// The gate of a round-3 Short. The owner's round-3 rules as checks: almost no words and English only, «Coming soon»
// until the catalogue says a track is out, every object whole inside the frame, the picture visible and moving with
// the measured sound, its strongest moment on the music's, −14 LUFS, under 30 MB.
import { beatSync } from './sync.mjs';

export const SAFE = { left: 60, right: 900, top: 220, bottom: 1500 };
export const LIMITS = { minS: 20, maxS: 30, bytes: 30 * 1024 * 1024, words: 6, textShare: 0.4, textSize: 96, margin: 0.012, sync: 0.2, climax: 1.25 };
/** The long video (16:9, the whole track): words on far fewer of its frames, a title-safe frame inside YouTube's player. */
export const SAFE_LONG = { left: 96, right: 1824, top: 70, bottom: 1020 };
export const LIMITS_LONG = { ...LIMITS, minS: 60, maxS: 600, bytes: 600 * 1024 * 1024, textShare: 0.15, textSize: 100 };
/** The loop (Ali 21 Nov 2026: 8 to 15 s, ON the drop, seamless): the small title and badge stay on every frame. */
export const LIMITS_LOOP = { ...LIMITS, minS: 7.9, maxS: 16, textShare: 1, textSize: 40, seam: 0.03 };
export const limitsOf = (plan) => (plan.format === 'long' ? { safe: SAFE_LONG, limits: LIMITS_LONG } : plan.format === 'loop' ? { safe: SAFE, limits: LIMITS_LOOP } : { safe: SAFE, limits: LIMITS });
const OUT_WORDS = /\b(out now|available now|listen now|stream now|streaming now)\b/i;

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/**
 * plan: makeR3Plan's. frames: [{ f, luma, rows, box }] (box on some frames). file: { bytes, lufs, tp } or null before
 * the file exists. never: words that are never written. Returns { ok, checks: [{ id, ok, detail }] }.
 */
export function verdict({ plan, frames, file = null, never = [] }) {
  const { safe: SAFE, limits: LIMITS } = limitsOf(plan);
  const checks = [];
  const add = (id, ok, detail = '') => checks.push({ id, ok: Boolean(ok), detail });
  const fps = plan.fps;
  const rowsAll = frames.flatMap((x) => x.rows.map((r) => ({ ...r, f: x.f })));
  const seen = rowsAll.filter((r) => r.opacity > 0.05);

  add('length', plan.L >= LIMITS.minS && plan.L <= LIMITS.maxS, `${plan.L} s`);

  const texts = [...new Set(seen.map((r) => r.text))];
  const notEnglish = texts.filter((x) => !/^[\x20-\x7E]+$/.test(x));
  add('english', plan.lang === 'en' && notEnglish.length === 0, notEnglish.join(' | '));

  let most = 0;
  for (const x of frames) most = Math.max(most, x.rows.filter((r) => r.opacity > 0.05).reduce((n, r) => n + r.text.trim().split(/\s+/).length, 0));
  const share = frames.filter((x) => x.rows.some((r) => r.opacity > 0.05)).length / Math.max(1, frames.length);
  const big = Math.max(0, ...seen.map((r) => r.size));
  add('few-words', most <= LIMITS.words && share <= LIMITS.textShare && big <= LIMITS.textSize, `${most} words at once, words on ${(share * 100).toFixed(0)}% of the frames, largest ${big} px`);

  const title = plan.track.titleEn;
  const loop = plan.format === 'loop';
  if (loop) {
    // the small title and the badge on the first and the last frame alike, nothing else; the picture's seam
    const tagOf = (x) => x.rows.filter((r) => r.role === 'tag-title' && r.opacity >= 0.9).map((r) => r.text).join(' ');
    const first = frames[0], lastF = frames[frames.length - 1];
    add('signature', tagOf(first) === title && tagOf(lastF) === title, `title «${tagOf(first)}» … «${tagOf(lastF)}»`);
    add('badge', [first, lastF].every((x) => x.rows.some((r) => r.role === 'badge' && r.opacity >= 0.9)), 'the badge on the first and last frame');
    const seam = Math.abs(first.luma - lastF.luma);
    add('seam', frames.length < plan.frames - 1 || seam <= LIMITS.seam, `first and last frame differ by ${seam.toFixed(3)} in brightness`);
  }
  const sig = loop ? true : seen.some((r) => r.role === 'signature' && r.text === title && r.opacity >= 0.9 && r.f / fps < 6);
  const last = frames[frames.length - 1];
  const endTitle = last.rows.filter((r) => r.role === 'end-title' && r.opacity >= 0.9).map((r) => r.text).join(' ');
  if (!loop) add('signature', sig && endTitle === title, `signature ${sig ? 'shown' : 'missing'}, end card «${endTitle}»`);

  const soon = last.rows.find((r) => r.role === 'end-soon');
  const saysOut = texts.some((x) => OUT_WORDS.test(x));
  if (!loop) add('soon', plan.out ? Boolean(soon) : soon?.text === 'Coming soon' && !saysOut, `«${soon?.text ?? ''}»${plan.out ? ' (the catalogue says it is out)' : ''}`);

  const bad = texts.filter((x) => never.some((w) => w && x.toLowerCase().includes(String(w).toLowerCase())));
  add('copy', bad.length === 0, bad.join(' | '));

  const outside = seen.filter((r) => r.x0 < SAFE.left || r.x1 > SAFE.right || r.y0 < SAFE.top || r.y1 > SAFE.bottom);
  add('safe', outside.length === 0, outside.slice(0, 2).map((r) => `«${r.text}» ${Math.round(r.x0)}-${Math.round(r.x1)} x ${Math.round(r.y0)}-${Math.round(r.y1)} at ${(r.f / fps).toFixed(1)} s`).join('; '));

  const boxes = frames.filter((x) => x.box);
  const m = LIMITS.margin;
  const cut = boxes.filter((x) => x.box.behind || x.box.x0 < m || x.box.y0 < m || x.box.x1 > 1 - m || x.box.y1 > 1 - m);
  add('in-frame', boxes.length > 0 && cut.length === 0, cut.length ? `${cut.length} of ${boxes.length} looks, first at ${(cut[0].f / fps).toFixed(2)} s: x ${cut[0].box.x0}-${cut[0].box.x1}, y ${cut[0].box.y0}-${cut[0].box.y1}` : `${boxes.length} looks`);

  const luma = frames.map((x) => x.luma);
  const sorted = [...luma].sort((a, b) => a - b);
  const p05 = sorted[Math.floor(sorted.length * 0.05)] ?? 0;
  add('visible', p05 >= 0.02 && mean(luma) >= 0.05 && mean(luma) <= 0.6, `darkest 5% ${p05.toFixed(3)}, mean ${mean(luma).toFixed(3)}`);

  if (plan.sound.source === 'measured' && frames.length >= plan.frames - 1) {
    const sync = beatSync(luma, plan.onsets, Math.min(luma.length, plan.frames));
    add('beat-sync', sync.r >= LIMITS.sync, `r ${sync.r.toFixed(2)} at ${sync.lag} frames`);
    const cue = plan.cues.dropT ?? plan.cues.closeT;
    // a loop starts ON the drop: its climax is the bloom on its first frames, against the calmest part of the loop
    if (loop) {
      const open = Math.max(...luma.slice(0, 8)), calm = Math.min(...luma.map((_, i) => mean(luma.slice(i, i + 15))).slice(0, Math.max(1, luma.length - 15)));
      add('climax', open >= 1.1 * calm, `the drop opens at ${open.toFixed(3)}, the calmest second ${calm.toFixed(3)}`);
    } else {
    const f = Math.round(cue * fps);
    const before = mean(luma.slice(Math.max(0, f - 18), Math.max(1, f - 3)));
    const after = Math.max(...luma.slice(f, f + 8));
    add('climax', after >= LIMITS.climax * before, `at ${cue} s the picture goes from ${before.toFixed(3)} to ${after.toFixed(3)}`);
    }
  }

  if (file) {
    add('size', file.bytes < LIMITS.bytes, `${(file.bytes / 1048576).toFixed(1)} MB`);
    // the picture comes silent from this repo: the loudness is checked by the app once the sound is under it
    if (file.lufs !== undefined) add('loudness', Number.isFinite(file.lufs) && Math.abs(file.lufs + 14) <= 1 && file.tp <= -1, `${file.lufs} LUFS, ${file.tp} dBTP`);
  }
  return { ok: checks.every((c) => c.ok), checks };
}

export const reason = (v) => v.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`).join(' / ');
