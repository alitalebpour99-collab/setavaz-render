// Persian modes (dastgah / avaz) in cents above the tonic, chords that avoid koron notes, and a motif composer with
// development (repetition, sequence, inversion, rhythmic displacement, ornaments) and phrase cadences.
// Interval sizes: Vaziri's quarter-tone approximation (koron ~ half-flat) with Farhat's neutral seconds (~135-165 c).
export const MODES = {
  // name: cents of degrees 1..7, shahed (focal degree, 0-based), ist (stopping degree), mood words
  shur:     { cents: [0, 140, 300, 500, 700, 800, 1000], shahed: 3, ist: 0, mood: 'melancholic, noble, intimate' },
  homayoun: { cents: [0, 140, 400, 500, 700, 800, 1000], shahed: 3, ist: 0, mood: 'majestic, solemn, longing' },
  esfahan:  { cents: [0, 200, 300, 500, 700, 850, 1100], shahed: 4, ist: 0, mood: 'romantic, yearning, sweet-sad' },
  chahargah:{ cents: [0, 140, 400, 500, 700, 840, 1100], shahed: 4, ist: 0, mood: 'heroic, intense, ceremonial' },
  bayatTork:{ cents: [0, 200, 350, 500, 700, 900, 1000], shahed: 2, ist: 0, mood: 'bright, hopeful, playful' },
}
export const isKoron = (c) => Math.abs(c / 100 - Math.round(c / 100)) > 0.2
export const hzOf = (tonicHz, cents) => tonicHz * Math.pow(2, cents / 1200)
export function degCents(mode, d) { const m = MODES[mode].cents, o = Math.floor(d / 7), i = ((d % 7) + 7) % 7; return m[i] + 1200 * o }
// chord on a degree: triad if no koron note, else root+fifth (+octave); null if even the fifth is koron
export function chordOn(mode, d) { const r = degCents(mode, d), t = degCents(mode, d + 2), f = degCents(mode, d + 4); if (isKoron(r) || isKoron(f) || Math.abs(f - r - 700) > 60) return null; return isKoron(t) || Math.abs(t - r - 300) > 120 && Math.abs(t - r - 400) > 120 ? [r, f, r + 1200] : [r, t, f] }
const PROGS = { // degree loops (4 chords); filtered per mode so every chord exists
  dark: [[0, 5, 6, 0], [0, 6, 5, 4], [0, 3, 5, 6], [0, 0, 5, 6]],
  bright: [[0, 3, 4, 0], [0, 5, 3, 4], [3, 4, 0, 0], [0, 4, 5, 3]],
  floating: [[0, 3, 0, 5], [0, 6, 3, 0], [5, 6, 0, 0]],
}
export function progression(mode, flavour, rnd) { const list = (PROGS[flavour] || PROGS.dark).filter((p) => p.every((d) => chordOn(mode, d))); const p = list.length ? list[Math.floor(rnd() * list.length)] : [0, 0, 0, 0]; return p.map((d) => ({ deg: d, cents: chordOn(mode, d) || [0, 700, 1200] })) }
// ---- motif composer ----
// a note: { s: start in grid steps, l: length in steps, d: scale degree (0 = tonic, may be negative/above 7), v: velocity, orn }
const RHYTHMS = { // 2-bar (32 sixteenths) rhythm cells with an accent profile, typical of each hook idea
  callResponse: [[0, 2], [3, 1], [4, 4], [10, 2], [12, 4], [16, 2], [19, 1], [20, 2], [24, 6]],
  ostinato: [[0, 2], [2, 2], [4, 2], [6, 1], [7, 1], [8, 2], [12, 2], [14, 2], [16, 2], [18, 2], [20, 2], [22, 1], [23, 1], [24, 2], [28, 4]],
  risingSequence: [[0, 3], [3, 3], [6, 2], [8, 4], [16, 3], [19, 3], [22, 2], [24, 6]],
  longLine: [[0, 6], [6, 2], [8, 8], [16, 4], [20, 4], [24, 8]],
  reng: [[0, 2], [3, 1], [4, 2], [6, 2], [8, 3], [11, 1], [12, 4], [16, 2], [19, 1], [20, 2], [22, 2], [24, 6]], // used on a 12-step (triplet) bar grid x2
}
export function makeMotif(mode, idea, rnd) {
  const M = MODES[mode], cells = RHYTHMS[idea] || RHYTHMS.callResponse
  let d = M.shahed, notes = []
  for (let k = 0; k < cells.length; k++) {
    const [s, l] = cells[k]; const last = k === cells.length - 1
    if (k > 0) { const r = rnd(); const step = r < 0.45 ? (rnd() < 0.5 ? 1 : -1) : r < 0.75 ? (rnd() < 0.5 ? 2 : -2) : r < 0.9 ? 0 : (rnd() < 0.5 ? 3 : -3); d = Math.max(-2, Math.min(9, d + step)) }
    if (idea === 'risingSequence' && k > 0 && k % 2 === 0) d = notes[k - 2].d + 1
    if (last || (idea === 'callResponse' && s === 12)) d = k < cells.length / 2 ? M.shahed : M.ist // half cadence on shahed, full cadence on the stopping note
    if (k === cells.length - 2 && !last) d = M.ist + (rnd() < 0.6 ? 1 : -1) // approach the final from a step away (Shur-like 2->1)
    notes.push({ s, l, d, v: s % 8 === 0 ? 1 : 0.8, orn: l >= 4 && rnd() < 0.5 ? 'tahrir' : l <= 1 ? null : rnd() < 0.25 ? 'grace' : null })
  }
  return notes
}
// development operators: each returns a new 2-bar phrase
export const DEV = {
  repeat: (m, _k, _mode) => m.map((n) => ({ ...n })),
  sequence: (m, k = 1) => m.map((n, i) => ({ ...n, d: i === m.length - 1 ? n.d : n.d + k })),
  invert: (m) => { const a = m[0].d; return m.map((n, i) => ({ ...n, d: i === m.length - 1 ? n.d : a - (n.d - a) })) },
  displace: (m, by = 2) => m.map((n) => ({ ...n, s: Math.min(31 - Math.min(n.l, 2), n.s + by) })),
  sparse: (m) => m.filter((n, i) => i % 2 === 0 || n.l >= 4).map((n) => ({ ...n, l: Math.max(n.l, 3) })),
  answer: (m, _k, mode) => { const M = MODES[mode]; const h = m.filter((n) => n.s < 16); return [...h.map((n) => ({ ...n })), ...h.map((n, i) => ({ ...n, s: n.s + 16, d: i === h.length - 1 ? M.ist : n.d - 1 }))] }, // call + answer that resolves
  octave: (m) => m.map((n) => ({ ...n, d: n.d + 7 })),
}
// an 8-bar phrase (4 x 2 bars) from a motif with a development plan, e.g. ['repeat','sequence','repeat','answer']
export function phrase(motif, plan, mode) { const out = []; plan.forEach((op, k) => { const f = DEV[op] || DEV.repeat; f(motif, op === 'sequence' ? (k % 2 ? -1 : 1) : undefined, mode).forEach((n) => out.push({ ...n, s: n.s + k * 32 })) }); return out }
