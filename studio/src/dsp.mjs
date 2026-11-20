// Small DSP kit for the Setavaz hybrid pipeline (pure JS, no dependencies): seeded noise, RBJ biquads, envelopes,
// synthesised drums (the "Setavaz kit"), a sub bass voice, a Karplus-Strong santur-like pluck for the sonic logo,
// a light Freeverb-style reverb, stereo bus helpers, WAV I/O through ffmpeg. All sounds are made here, so they are ours.
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'
export const SR = 44100
export function rng(seed = 1) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const R = rng(7)
export const noise = (n, r = R) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = r() * 2 - 1; return a }
export function biquad(x, type, f, q = 0.707, gainDb = 0) {
  const w = 2 * Math.PI * f / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = Math.pow(10, gainDb / 40)
  let b0, b1, b2, a0, a1, a2
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al }
  else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al }
  else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A }
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v }
  return y
}
const env = (n, att, dec) => { const e = new Float32Array(n); const a = Math.max(1, Math.round(att * SR)); for (let i = 0; i < n; i++) e[i] = i < a ? i / a : Math.exp(-(i - a) / (dec * SR)); return e }
const mul = (x, e, g = 1) => { for (let i = 0; i < x.length; i++) x[i] *= e[i] * g; return x }
const mix = (...xs) => { const n = Math.max(...xs.map((x) => x.length)); const y = new Float32Array(n); for (const x of xs) for (let i = 0; i < x.length; i++) y[i] += x[i]; return y }
const sat = (x, d = 1.5) => { const k = Math.tanh(d); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * d) / k; return x }
function sweepSine(n, f0, f1, tau, ph = 0) { const y = new Float32Array(n); let p = ph; for (let i = 0; i < n; i++) { const f = f1 + (f0 - f1) * Math.exp(-i / (tau * SR)); p += 2 * Math.PI * f / SR; y[i] = Math.sin(p) } return y }

// ---- the Setavaz kit ----
// Signature kick: deep 48 Hz body with a fast pitch drop, a short click, light drive, and a tiny daf-jingle shimmer
// on top (three metallic ticks 0/11/23 ms) - the characteristic Setavaz drum sound.
export function kick({ jingle = true, len = 0.55, punch = 1 } = {}) {
  const n = Math.round(len * SR)
  const body = mul(sweepSine(n, 175, 47, 0.032), env(n, 0.0015, 0.30))
  const click = mul(biquad(noise(n), 'hp', 2500), env(n, 0.0002, 0.003), 0.85 * punch)
  const knock = mul(sweepSine(n, 270, 185, 0.012), env(n, 0.0005, 0.028), 0.38 * punch) // mid 'knock' so the kick cuts through phones
  let k = sat(mix(body, click, knock), 1.8)
  if (jingle) { let j = new Float32Array(n); for (const [d, g] of [[0, 1], [0.011, 0.7], [0.023, 0.45]]) { const o = Math.round(d * SR); const b = mul(biquad(noise(Math.round(0.05 * SR)), 'bp', 7600, 5), env(Math.round(0.05 * SR), 0.0005, 0.012), g); for (let i = 0; i < b.length && o + i < n; i++) j[o + i] += b[i] } k = mix(k, mul(j, new Float32Array(n).fill(1), 0.22)) }
  return k
}
export function clap({ len = 0.35, tone = 1400 } = {}) {
  const n = Math.round(len * SR); const x = new Float32Array(n)
  for (const d of [0, 0.009, 0.019]) { const o = Math.round(d * SR); const b = mul(noise(Math.round(0.02 * SR)), env(Math.round(0.02 * SR), 0.0004, 0.004)); for (let i = 0; i < b.length; i++) x[o + i] += b[i] }
  const tail = mul(noise(n), env(n, 0.019, 0.07), 0.6)
  return mul(biquad(biquad(mix(x, tail), 'bp', tone, 1.1), 'hp', 500), new Float32Array(n).fill(1), 1.4)
}
export function rim() { const n = Math.round(0.08 * SR); return mul(mix(mul(sweepSine(n, 1800, 1700, 1), env(n, 0.0002, 0.012)), mul(sweepSine(n, 470, 450, 1), env(n, 0.0002, 0.02), 0.6), mul(biquad(noise(n), 'hp', 3000), env(n, 0.0001, 0.003), 0.5)), new Float32Array(n).fill(1), 0.8) }
export function hat(open = false) { const len = open ? 0.25 : 0.06, n = Math.round(len * SR); return mul(biquad(biquad(noise(n), 'hp', 7500), 'peak', 10500, 1, 4), env(n, 0.0004, open ? 0.09 : 0.014), 0.5) }
export function shaker() { const n = Math.round(0.09 * SR); return mul(biquad(noise(n), 'bp', 5800, 0.9), env(n, 0.006, 0.022), 0.75) }
export function conga(high = true) { const n = Math.round(0.35 * SR); const f = high ? 330 : 205; return mix(mul(sweepSine(n, f * 1.12, f, 0.012), env(n, 0.0008, high ? 0.12 : 0.17), 0.9), mul(biquad(noise(n), 'bp', high ? 2400 : 1500, 1.5), env(n, 0.0002, 0.006), 0.5)) }
// Persian frame drum (daf): low thump + ringing jingles
export function daf({ slap = false } = {}) { const n = Math.round(0.45 * SR); const low = mul(sweepSine(n, 120, 78, 0.02), env(n, 0.001, slap ? 0.05 : 0.2), slap ? 0.4 : 0.9); const jing = mul(biquad(biquad(noise(n), 'bp', 6800, 2.5), 'peak', 9200, 3, 6), env(n, 0.002, 0.11), slap ? 0.5 : 0.35); return mix(low, jing) }
// tombak: "tom" (deep centre stroke) and "bak" (sharp edge stroke)
export function tombak(stroke = 'tom') { const n = Math.round(0.4 * SR); if (stroke === 'tom') return mix(mul(sweepSine(n, 150, 104, 0.03), env(n, 0.001, 0.16)), mul(biquad(noise(n), 'bp', 800, 2), env(n, 0.0005, 0.01), 0.3)); return mix(mul(sweepSine(n, 960, 900, 1), env(n, 0.0003, 0.03), 0.6), mul(biquad(noise(n), 'bp', 3200, 1.4), env(n, 0.0002, 0.012), 0.8)) }
// Bandari dohol: big low drum + stick
export function dohol(stick = false) { const n = Math.round(0.6 * SR); if (stick) return mul(biquad(noise(n), 'bp', 2600, 2), env(n, 0.0002, 0.02), 0.8); return mix(mul(sweepSine(n, 105, 62, 0.04), env(n, 0.001, 0.32)), mul(biquad(noise(n), 'bp', 400, 1.2), env(n, 0.001, 0.03), 0.4)) }
export function groupClap(r = R) { const n = Math.round(0.4 * SR); let y = new Float32Array(n); for (let k = 0; k < 4; k++) { const c = clap({ tone: 1100 + r() * 900 }); const o = Math.round(r() * 0.008 * SR); for (let i = 0; i < c.length && o + i < n; i++) y[o + i] += c[i] * 0.45 } return y }
// sub bass voice: sine + soft 2nd harmonic, saturated
export function bassNote(freq, dur, { drive = 1.3, harm = 0.35, rel = 0.03 } = {}) {
  const n = Math.round((dur + rel) * SR); const y = new Float32Array(n); let p = 0
  for (let i = 0; i < n; i++) { p += 2 * Math.PI * freq / SR; const t = i / SR; const a = Math.min(1, t / 0.004) * (t > dur ? Math.exp(-(t - dur) / rel * 3) : 1) * (0.85 + 0.15 * Math.exp(-t / 0.08)); y[i] = (Math.sin(p) + harm * Math.sin(2 * p + 0.3)) * a }
  return sat(y, drive)
}
// Karplus-Strong pluck, two detuned strings -> santur-like bell (the Setavaz sonic logo)
export function pluck(freq, len = 2.2, r = R) {
  const n = Math.round(len * SR); const out = new Float32Array(n)
  for (const det of [1, 1.0035]) { const L = Math.round(SR / (freq * det)); const buf = noise(L, r); let idx = 0, prev = 0; for (let i = 0; i < n; i++) { const v = buf[idx]; const nv = 0.996 * 0.5 * (v + prev); prev = v; buf[idx] = nv; idx = (idx + 1) % L; out[i] += v * 0.5 } }
  return mul(biquad(out, 'hp', 200), env(n, 0.001, 0.9))
}
export function reverb(x, { size = 0.84, damp = 0.3, wet = 1 } = {}) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d, b: new Float32Array(d), i: 0, f: 0 })); const aps = [556, 441].map((d) => ({ d, b: new Float32Array(d), i: 0 }))
  const y = new Float32Array(x.length + SR * 2)
  for (let n = 0; n < y.length; n++) { const inp = n < x.length ? x[n] * 0.2 : 0; let s = 0; for (const c of combs) { const o = c.b[c.i]; c.f = o * (1 - damp) + c.f * damp; c.b[c.i] = inp + c.f * size; c.i = (c.i + 1) % c.d; s += o } for (const a of aps) { const o = a.b[a.i]; const v = -s + o; a.b[a.i] = s + o * 0.5; a.i = (a.i + 1) % a.d; s = v } y[n] = s * wet }
  return y
}
// ---- stereo bus ----
export class Bus { constructor(sec) { this.n = Math.round(sec * SR); this.L = new Float32Array(this.n); this.R = new Float32Array(this.n) }
  add(x, at, g = 1, pan = 0) { const o = Math.round(at * SR); const gl = g * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr = g * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2; for (let i = 0; i < x.length && o + i < this.n; i++) { if (o + i < 0) continue; this.L[o + i] += x[i] * gl; this.R[o + i] += x[i] * gr } }
  addSt(L, Rr, at, g = 1) { const o = Math.round(at * SR); for (let i = 0; i < L.length && o + i < this.n; i++) { if (o + i < 0) continue; this.L[o + i] += L[i] * g; this.R[o + i] += Rr[i] * g } }
  gainCurve(fn) { for (let i = 0; i < this.n; i++) { const g = fn(i / SR); this.L[i] *= g; this.R[i] *= g } }
  mixInto(o, g = 1) { for (let i = 0; i < this.n; i++) { o.L[i] += this.L[i] * g; o.R[i] += this.R[i] * g } }
}
export function readAudio(file, t0 = 0, dur = null) { const a = ['-v', 'error', '-ss', String(t0)]; if (dur) a.push('-t', String(dur)); a.push('-i', file, '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'); const b = execFileSync('ffmpeg', a, { maxBuffer: 1 << 28 }); const f = new Float32Array(b.buffer, b.byteOffset, b.length / 4); const n = f.length / 2, L = new Float32Array(n), Rr = new Float32Array(n); for (let i = 0; i < n; i++) { L[i] = f[2 * i]; Rr[i] = f[2 * i + 1] } return [L, Rr] }
export function writeWav(file, L, Rr) { const n = L.length; const buf = Buffer.alloc(44 + n * 8); buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 8, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 8, 28); buf.writeUInt16LE(8, 32); buf.writeUInt16LE(32, 34); buf.write('data', 36); buf.writeUInt32LE(n * 8, 40); for (let i = 0; i < n; i++) { buf.writeFloatLE(L[i], 44 + i * 8); buf.writeFloatLE(Rr[i], 48 + i * 8) } fs.writeFileSync(file, buf) }
export function stretchPitch(L, Rr, tempo, semis, tmp) { writeWav(tmp + '-in.wav', L, Rr); const af = `rubberband=tempo=${tempo.toFixed(5)}:pitch=${Math.pow(2, semis / 12).toFixed(5)}:transients=crisp:pitchq=quality`; execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp + '-in.wav', '-af', af, '-c:a', 'pcm_f32le', tmp + '-out.wav']); const r = readAudio(tmp + '-out.wav'); fs.unlinkSync(tmp + '-in.wav'); fs.unlinkSync(tmp + '-out.wav'); return r }

// rolling afro-house bass: saw-ish tone through a decaying low-pass (pluck), a glide into the note, and a clean sub underneath
export function bassNote2(freq, dur, { glideFrom = null, cutoff = 900, drive = 1.4 } = {}) {
  const n = Math.round((dur + 0.03) * SR), y = new Float32Array(n); let p = 0, ps = 0, lp = 0
  for (let i = 0; i < n; i++) { const t = i / SR; const f = glideFrom ? freq + (glideFrom - freq) * Math.exp(-t / 0.035) : freq; p += f / SR; ps += 2 * Math.PI * f / SR
    let saw = 0; for (let h = 1; h <= 6; h++) saw += Math.sin(2 * Math.PI * h * p) / h
    const fc = 180 + cutoff * Math.exp(-t / 0.07), a = 1 - Math.exp(-2 * Math.PI * fc / SR); lp += a * (saw - lp)
    const amp = Math.min(1, t / 0.003) * (t > dur ? Math.exp(-(t - dur) / 0.01) : 1)
    y[i] = (0.55 * lp + 0.75 * Math.sin(ps)) * amp }
  return sat(y, drive)
}