// Composer + arranger + mixer: renders a concept to a stereo mix and a symbolic score (used by the quality checks).
import * as D from './dsp.mjs'
import * as I from './instruments.mjs'
import { degCents, hzOf, progression, makeMotif, phrase, MODES } from './theory.mjs'
import { GENRES, POCKET, vary, signature, fill, FILLS, VEL } from './rhythm.mjs'
const { SR } = D
export function render(c, { lyriaLoop = null } = {}) {
  const r = D.rng(c.seed * 104729 + 7), G = GENRES[c.genre]
  const BEAT = 60 / c.bpm, BAR = 4 * BEAT, grid = G.grid, STEP = BAR / grid
  const sections = []; let bar = 0; for (const [role, bars] of c.form) { sections.push({ role, from: bar, to: bar + bars }); bar += bars }
  const totalBars = bar, total = totalBars * BAR + 4
  const bus = Object.fromEntries(['drums', 'bass', 'pad', 'lead', 'counter', 'fx', 'tex'].map((k) => [k, new D.Bus(total)]))
  const S = { kick: D.kick(), kickSoft: D.kick({ punch: 0.55 }), clap: D.clap(), rim: D.rim(), hatC: D.hat(false), hatO: D.hat(true), shk: D.shaker(), congaH: D.conga(true), congaL: D.conga(false), daf: D.daf(), dafS: D.daf({ slap: true }), tom: D.tombak('tom'), bak: D.tombak('bak'), dohol: D.dohol(), stick: D.dohol(true), gclap: D.groupClap(r) }
  const GAIN = { kick: 0.95, clap: 0.38, rim: 0.25, hatC: 0.13, hatO: 0.12, shk: 0.2, congaH: 0.28, congaL: 0.32, daf: 0.4, dafS: 0.26, tom: 0.4, bak: 0.34, dohol: 0.4, stick: 0.3, gclap: 0.38 }
  const PAN = { shk: 0.35, hatO: 0.2, hatC: -0.15, rim: -0.15, congaH: 0.45, congaL: -0.4, bak: 0.3, tom: -0.25, gclap: 0.1, dafS: 0.1 }
  const stepT = (b, s, swing = G.swing) => b * BAR + (grid === 16 ? Math.floor(s / 2) * 2 * STEP + (s % 2 ? swing * 2 * STEP : 0) : s * STEP)
  const hum = (ms) => (r() - 0.5) * 2 * ms / 1000
  const kicks = [], score = { blocks: [], notes: 0 }
  const hit = (inst, t, v, pan) => { if (inst === 'kick') kicks.push(t); bus.drums.add(S[inst] || S.rim, t + (POCKET[inst] || 0) + (inst === 'kick' ? 0 : hum(3)), (GAIN[inst] || 0.3) * v * (inst === 'kick' ? 1 : 0.86 + r() * 0.28), pan ?? (PAN[inst] || 0) * (r() < 0.5 ? 1 : 0.8)) }
  // ---- drums: an 8-bar block plan per section, every block different from the previous one ----
  const BASE = { intro: ['intro'], build: ['A'], dropA: ['A', 'A'], break: ['brk'], switch: ['C'], dropB: ['C', 'B'], bridge: ['half'], final: ['B'], outro: ['intro'] }
  let prevSig = ''
  for (const sec of sections) {
    const keys = BASE[sec.role]
    for (let b0 = sec.from, k = 0; b0 < sec.to; b0 += 8, k++) {
      const key = keys[Math.min(k, keys.length - 1)]
      let pat = G[key], tries = 0
      if (k > 0 || ['final', 'build'].includes(sec.role)) pat = vary(pat, r, 0.35)
      while (signature(pat) === prevSig && tries++ < 6) pat = vary(G[key], r, 0.5)
      if (sec.role === 'build') pat = { ...pat, shk: G.A.shk } // the build adds the full shaker
      prevSig = signature(pat); score.blocks.push({ role: sec.role, from: b0, key, sig: prevSig })
      const bEnd = Math.min(sec.to, b0 + 8)
      for (let b = b0; b < bEnd; b++) {
        const muteLastBeat = b === sec.to - 1 && ['build', 'break', 'bridge', 'dropA'].includes(sec.role) // drop-out before the next section
        for (const [inst, p] of Object.entries(pat)) for (let s = 0; s < grid; s++) { const ch = p[s]; if (!ch || ch === '.') continue; if (muteLastBeat && s >= grid * 3 / 4) continue; if (sec.role === 'intro' && b < sec.from + 4 && inst !== 'kick' && inst !== 'daf' && inst !== 'tom') continue; hit(inst, stepT(b, s), VEL[ch]) }
        // fills: always at the end of 8, sometimes at the end of 4
        const last8 = (b - sec.from) % 8 === 7, last4 = (b - sec.from) % 4 === 3
        if (!muteLastBeat && sec.role !== 'outro' && sec.role !== 'intro' && (last8 || (last4 && r() < 0.5))) { const ft = FILLS[c.genre][Math.floor(r() * 3)]; for (const e of fill(ft, r, grid)) hit(e.inst, b * BAR + e.at * BEAT, e.v * (last8 ? 1 : 0.7), e.pan) }
      }
      if (sec.role === 'build' && b0 + 8 >= sec.to) for (const e of fill('snareBuild', r, grid)) hit(e.inst, (sec.to - 4 + e.bar) * BAR + e.at * BEAT, e.v, 0)
    }
  }
  // ---- harmony ----
  const prog = progression(c.mode, c.flavour, r), prog2 = progression(c.mode, c.flavour === 'dark' ? 'floating' : 'dark', r)
  const chordAt = (b, sec) => ((['switch', 'dropB', 'bridge'].includes(sec.role) ? prog2 : prog)[b % 4])
  const T = c.tonicHz
  for (const sec of sections) for (let b = sec.from; b < sec.to; b++) {
    const ch = chordAt(b, sec), role = sec.role
    // pad: open voicing one octave up
    const padG = { intro: 0.55, build: 0.5, break: 0.75, bridge: 0.6, outro: 0.55, dropA: 0.28, dropB: 0.28, final: 0.3, switch: 0.2 }[role]
    if (padG) bus.pad.addSt(I.pad(ch.cents.map((x) => hzOf(T, x + 1200)), BAR, { bright: role === 'break' ? 900 : 1500 }), I.pad(ch.cents.map((x) => hzOf(T, x + 1200)), BAR, { bright: role === 'break' ? 850 : 1400 }), b * BAR, padG)
    // bass
    if (['intro', 'break', 'outro'].includes(role) || (role === 'build' && b < sec.from + 4)) continue
    const bk = role === 'bridge' ? 'half' : role === 'switch' || (role === 'dropB' && b < sec.from + 8) ? 'C' : role === 'final' || role === 'dropB' ? 'B' : 'A'
    const root = hzOf(T / 2, ch.cents[0])
    const steps = G.bass[bk]
    steps.forEach((s, i) => { const len = bk === 'half' ? BAR * 0.9 : Math.min(STEP * (grid === 12 ? 2.2 : 2.6), 0.22); const f = i === steps.length - 1 && b % 4 === 3 && bk !== 'half' ? root * 2 : root; bus.bass.add(D.bassNote2(f, len, { glideFrom: i === 0 && b % 2 === 0 ? root * Math.pow(2, -5 / 12) : null, cutoff: bk === 'B' ? 1300 : 900 }), stepT(b, s), 0.55) })
    for (const s of G.bass.ghost) if (bk !== 'half' && r() < 0.6) bus.bass.add(D.bassNote2(root, 0.05, { cutoff: 600 }), stepT(b, s), 0.22)
  }
  // ---- lead melody: motif + development, different per section ----
  const motif = makeMotif(c.mode, c.hook, r)
  const PLAN = { intro: ['sparse'], build: ['repeat', 'sequence'], dropA: ['repeat', 'sequence', 'repeat', 'answer'], break: ['sparse', 'sparse', 'invert', 'answer'], switch: ['displace', 'invert', 'displace', 'answer'], dropB: ['octave', 'sequence', 'octave', 'answer'], bridge: ['sparse', 'repeat'], final: ['octave', 'repeat', 'sequence', 'answer'], outro: ['sparse'] }
  const leadInst = I[c.lead] || I.bowed, cntInst = I[c.counter] || I.santur
  const toTime = (b, s16) => { if (grid === 16) return stepT(b, s16 % 16) + Math.floor(s16 / 16) * BAR; const q = Math.floor(s16 / 4), rr = s16 % 4; return b * BAR + q * BEAT + Math.round(rr * 3 / 4) * BEAT / 3 }
  const playNote = (busx, inst, n, b0, oct, gain, pan) => {
    const t = toTime(b0, n.s), dur = n.l * BAR / 16, f = hzOf(T, degCents(c.mode, n.d) + 1200 * oct)
    if (n.orn === 'grace') { busx.add(inst(hzOf(T, degCents(c.mode, n.d + 1) + 1200 * oct), 0.05, { vel: 0.5 }), t - 0.045, gain, pan) }
    if (n.orn === 'tahrir' && dur > 0.35) { const up = hzOf(T, degCents(c.mode, n.d + 1) + 1200 * oct); for (let k = 0; k < 4; k++) busx.add(inst(k % 2 ? up : f, 0.055, { vel: 0.6 }), t + k * 0.055, gain, pan); busx.add(inst(f, dur - 0.22, { vel: n.v }), t + 0.22, gain, pan) }
    else busx.add(inst(f, dur * 0.92, { vel: n.v }), t, gain, pan)
    score.notes++
  }
  for (const sec of sections) {
    const plan = PLAN[sec.role]; if (!plan) continue
    const leadOn = !(sec.role === 'intro') || true
    for (let b0 = sec.from, k = 0; b0 < sec.to; b0 += 8, k++) {
      const bars = Math.min(8, sec.to - b0)
      let ph = phrase(motif, plan.slice(0, Math.ceil(bars / 2)), c.mode).filter((n) => n.s < bars * 16)
      if (sec.role === 'intro') ph = ph.filter((n) => n.s >= 64) // the motif first appears in bars 5-8
      if (sec.role === 'outro') ph = ph.filter((n) => n.s < 32)
      const oct = sec.role === 'break' ? 0 : 0
      if (leadOn) for (const n of ph) playNote(bus.lead, leadInst, n, b0, oct, sec.role === 'break' ? 0.8 : 1, -0.05)
      // counter: chord-tone arpeggio (16ths) in the second half of drops and in the final; call & response in the bridge
      if ((['dropA', 'dropB'].includes(sec.role) && k === 1) || sec.role === 'final') for (let b = b0; b < b0 + bars; b++) { const ch = chordAt(b, sec); const arp = [0, 1, 2, 1, 2, 0, 1, 2]; for (let s = 0; s < 8; s++) bus.counter.add(cntInst(hzOf(T, ch.cents[arp[s] % ch.cents.length] + 2400), STEP * 1.6, { vel: s % 2 ? 0.55 : 0.8 }), stepT(b, s * (grid / 8)), 0.5, s % 2 ? 0.35 : -0.35) }
      if (sec.role === 'bridge') { const resp = phrase(motif, ['answer'], c.mode).filter((n) => n.s >= 16); for (let b = b0; b < b0 + bars; b += 4) for (const n of resp) playNote(bus.counter, cntInst, { ...n, s: n.s + 16 }, b, 1, 0.7, 0.3) }
    }
  }
  // ---- optional Lyria texture (never the beat): an already bar-cut loop placed in the sections the concept names ----
  if (lyriaLoop && c.lyria) for (const sec of sections) if (c.lyria.sections.includes(sec.role)) { const len = lyriaLoop[0].length / SR; for (let t = sec.from * BAR; t < sec.to * BAR - 0.01; t += len) bus.tex.addSt(lyriaLoop[0], lyriaLoop[1], t, c.lyria.gain || 0.5) }
  // ---- FX: risers into drops, impacts on drops, downlifter into the break ----
  for (const sec of sections) {
    if (['dropA', 'switch', 'dropB', 'final'].includes(sec.role)) bus.fx.add(I.impact(), sec.from * BAR, 0.5, 0)
    if (sec.role === 'build') bus.fx.add(I.riser(8 * BAR), sec.from * BAR, 0.45, 0)
    if (['break', 'bridge'].includes(sec.role)) bus.fx.add(I.riser(4 * BAR), (sec.to - 4) * BAR, 0.35, 0)
    if (sec.role === 'break') bus.fx.add(I.downlifter(2 * BAR), sec.from * BAR, 0.35, 0)
  }
  // ---- automation: intro drums open from a low-pass, build pad sweeps open; half-beat silence before every drop ----
  const intro = sections.find((s) => s.role === 'intro'), build = sections.find((s) => s.role === 'build')
  tvLowpass(bus.drums, (t) => (t < intro.to * BAR ? 400 + 17000 * Math.pow(Math.min(1, t / (intro.to * BAR)), 2.5) : 18000))
  tvLowpass(bus.pad, (t) => (t >= build.from * BAR && t < build.to * BAR ? 500 + 4500 * ((t - build.from * BAR) / ((build.to - build.from) * BAR)) : 18000))
  const gaps = sections.filter((s) => ['dropA', 'switch', 'dropB', 'final'].includes(s.role)).map((s) => s.from * BAR)
  for (const k of ['pad', 'lead', 'counter', 'bass', 'tex']) bus[k].gainCurve((t) => (gaps.some((g) => t > g - BEAT / 2 && t < g) ? 0.03 : 1))
  // ---- sidechain from the kicks ----
  kicks.sort((a, b) => a - b)
  const duck = (depth, rel = 0.14) => { let ki = 0; return (t) => { while (ki + 1 < kicks.length && kicks[ki + 1] <= t) ki++; const dt = t - kicks[ki]; if (!(dt >= 0) || dt > 0.6) return 1; return 1 - depth * (dt < 0.004 ? dt / 0.004 : Math.exp(-(dt - 0.004) / rel)) } }
  bus.pad.gainCurve(duck(0.55)); bus.counter.gainCurve(duck(0.35)); bus.bass.gainCurve(duck(0.35, 0.08)); bus.lead.gainCurve(duck(0.15)); bus.tex.gainCurve(duck(0.4))
  // ---- sends: lead reverb + dotted-8th delay, drum room ----
  const out = new D.Bus(total)
  const mono = (b) => { const m = new Float32Array(b.n); for (let i = 0; i < b.n; i++) m[i] = (b.L[i] + b.R[i]) / 2; return m }
  { const lm = D.biquad(mono(bus.lead), 'hp', 400), d = Math.round(0.75 * BEAT * SR), dl = new Float32Array(lm.length); for (let i = d; i < lm.length; i++) dl[i] = lm[i - d] + 0.32 * dl[i - d]; const rl = D.reverb(lm, { size: 0.86, damp: 0.3 }), rr = D.reverb(D.biquad(lm, 'hp', 500), { size: 0.89, damp: 0.25 }); for (let i = 0; i < out.n; i++) { out.L[i] += (rl[i] ?? 0) * 0.3 + (dl[i] ?? 0) * 0.14; out.R[i] += (rr[i] ?? 0) * 0.3 + (dl[i - Math.round(0.011 * SR)] ?? 0) * 0.14 } }
  { const dm = D.biquad(mono(bus.drums), 'hp', 450), rl = D.reverb(dm, { size: 0.78, damp: 0.4 }), rr = D.reverb(D.biquad(dm, 'hp', 600), { size: 0.83, damp: 0.3 }); for (let i = 0; i < out.n; i++) { out.L[i] += (rl[i] ?? 0) * 0.18; out.R[i] += (rr[i] ?? 0) * 0.18 } }
  // widen pad/counter above 300 Hz (side only), lows stay mono
  for (const b of [bus.pad, bus.counter, bus.tex]) { const h = D.biquad(mono(b), 'hp', 300), d1 = Math.round(0.009 * SR), d2 = Math.round(0.015 * SR); for (let i = b.n - 1; i >= d2; i--) { const sd = (h[i - d1] - h[i - d2]) * 0.45; b.L[i] += sd; b.R[i] -= sd } }
  const MIX = { drums: 1, bass: 1, pad: 0.75, lead: 0.85, counter: 0.6, fx: 0.7, tex: 0.7 }
  for (const [k, g] of Object.entries(MIX)) bus[k].mixInto(out, g)
  let e = 0; for (let i = 0; i < out.n; i++) e += out.L[i] ** 2 + out.R[i] ** 2; const g = Math.pow(10, -18 / 20) / Math.sqrt(e / (2 * out.n)); for (let i = 0; i < out.n; i++) { out.L[i] *= g; out.R[i] *= g }
  return { L: out.L, R: out.R, seconds: totalBars * BAR, sections: sections.map((s) => ({ ...s, t0: +(s.from * BAR).toFixed(2), t1: +(s.to * BAR).toFixed(2) })), score, prog: prog.map((p) => p.deg), prog2: prog2.map((p) => p.deg), motif }
}
// time-varying 2-pole low-pass on a stereo bus
function tvLowpass(b, fcFn) { let l1 = 0, l2 = 0, r1 = 0, r2 = 0; for (let i = 0; i < b.n; i++) { const fc = fcFn(i / SR); if (fc >= 17999) { l1 = l2 = b.L[i]; r1 = r2 = b.R[i]; continue } const a = 1 - Math.exp(-2 * Math.PI * fc / SR); l1 += a * (b.L[i] - l1); l2 += a * (l1 - l2); r1 += a * (b.R[i] - r1); r2 += a * (r1 - r2); b.L[i] = l2; b.R[i] = r2 } }
