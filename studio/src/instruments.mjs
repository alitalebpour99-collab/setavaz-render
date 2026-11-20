// Melodic instruments and FX, all synthesised (own work). Pitch is given in Hz, so quarter tones (koron) are exact.
import { SR, noise, biquad, rng } from './dsp.mjs'
const R = rng(99)
const envAD = (n, a, d, sus = 0, rel = 0.05, len = null) => { const e = new Float32Array(n), A = Math.max(1, a * SR), L = len ? len * SR : n; for (let i = 0; i < n; i++) { let v = i < A ? i / A : sus + (1 - sus) * Math.exp(-(i - A) / (d * SR)); if (i > L) v *= Math.exp(-(i - L) / (rel * SR)); e[i] = v } return e }
const vib = (t, rate, depthCents, delay) => (t < delay ? 0 : Math.min(1, (t - delay) / 0.25)) * depthCents * Math.sin(2 * Math.PI * rate * t)
// additive band-limited oscillator with per-sample frequency (Hz) and harmonic weights
function additive(n, fHz, weights, ph0 = 0) { const y = new Float32Array(n); const ph = weights.map(() => ph0); for (let i = 0; i < n; i++) { const f = typeof fHz === 'function' ? fHz(i / SR) : fHz; let s = 0; for (let h = 0; h < weights.length; h++) { const fh = f * (h + 1); if (fh > SR / 2.2) break; ph[h] += 2 * Math.PI * fh / SR; s += weights[h] * Math.sin(ph[h]) } y[i] = s } return y }
// bowed spike fiddle (kamancheh-like): saw-ish additive, bow attack, delayed vibrato, two body formants, bow noise
export function bowed(f, dur, { vel = 1, glideFrom = null } = {}) {
  const n = Math.round((dur + 0.25) * SR)
  const fq = (t) => (glideFrom && t < 0.07 ? glideFrom * Math.pow(f / glideFrom, t / 0.07) : f) * Math.pow(2, vib(t, 5.6, 14, 0.16) / 1200)
  let y = additive(n, fq, [1, 0.62, 0.45, 0.33, 0.25, 0.18, 0.13, 0.09, 0.06, 0.04, 0.03])
  const bn = biquad(noise(n, R), 'bp', f * 3, 0.8); for (let i = 0; i < n; i++) y[i] += bn[i] * 0.06
  y = biquad(biquad(biquad(y, 'peak', 950, 1.2, 5), 'peak', 2600, 1.5, 4), 'lp', 6500)
  const e = envAD(n, 0.07, 0.6, 0.78, 0.18, dur); for (let i = 0; i < n; i++) y[i] *= e[i] * 0.22 * vel
  return y
}
// ney (reed flute): soft fundamental, weak upper harmonics, breathy noise band, vibrato
export function ney(f, dur, { vel = 1 } = {}) {
  const n = Math.round((dur + 0.3) * SR), fq = (t) => f * Math.pow(2, vib(t, 5, 10, 0.2) / 1200)
  const y = additive(n, fq, [1, 0.18, 0.12, 0.05])
  const br = biquad(biquad(noise(n, R), 'bp', f * 2, 1.2), 'hp', 500); for (let i = 0; i < n; i++) y[i] += br[i] * (0.35 + 0.25 * Math.exp(-i / (0.08 * SR)))
  const e = envAD(n, 0.09, 0.8, 0.85, 0.22, dur); for (let i = 0; i < n; i++) y[i] *= e[i] * 0.3 * vel
  return y
}
// Karplus-Strong plucks: santur (two detuned strings, long ring), tar (bright, shorter, pick noise)
function ks(f, len, damp, bright, det = [1, 1.004]) { const n = Math.round(len * SR), out = new Float32Array(n); for (const d of det) { const L = Math.max(2, Math.round(SR / (f * d))); const buf = new Float32Array(L); for (let i = 0; i < L; i++) buf[i] = (R() * 2 - 1); let idx = 0, prev = 0; for (let i = 0; i < n; i++) { const v = buf[idx]; buf[idx] = damp * (bright * v + (1 - bright) * prev); prev = v; idx = (idx + 1) % L; out[i] += v / det.length } } return out }
export function santur(f, dur, { vel = 1 } = {}) { const y = biquad(ks(f, Math.max(1.2, dur + 0.8), 0.9985, 0.5), 'hp', 180); for (let i = 0; i < y.length; i++) y[i] *= vel * 0.5; return y }
export function tar(f, dur, { vel = 1 } = {}) { const y = biquad(biquad(ks(f, Math.max(0.6, dur + 0.3), 0.996, 0.62, [1, 1.002]), 'hp', 150), 'peak', 3200, 1, 4); const pk = biquad(noise(600, R), 'hp', 3000); for (let i = 0; i < pk.length; i++) y[i] += pk[i] * 0.2 * Math.exp(-i / 90); for (let i = 0; i < y.length; i++) y[i] *= vel * 0.55; return y }
// Persian Gulf reed (ney-anban-like): odd-harmonic buzzy reed with a fifth drone underneath
export function reed(f, dur, { vel = 1 } = {}) {
  const n = Math.round((dur + 0.12) * SR), fq = (t) => f * Math.pow(2, vib(t, 6.5, 8, 0.1) / 1200)
  let y = additive(n, fq, [1, 0.1, 0.55, 0.08, 0.38, 0.06, 0.26, 0.05, 0.17, 0.04, 0.11])
  y = biquad(biquad(y, 'peak', 1500, 1.3, 6), 'lp', 7000)
  const e = envAD(n, 0.015, 0.3, 0.8, 0.06, dur); for (let i = 0; i < n; i++) y[i] *= e[i] * 0.18 * vel
  return y
}
// warm pad of open voicings (no third if the third is a koron note): detuned saws, slow filter
export function pad(freqs, dur, { bright = 1200 } = {}) { const n = Math.round((dur + 0.4) * SR), y = new Float32Array(n); for (const f of freqs) for (const d of [-0.08, 0.08]) { const fr = f * Math.pow(2, d / 12); let p = R(); for (let i = 0; i < n; i++) { p += fr / SR; y[i] += ((p % 1) * 2 - 1) * 0.06 } } const z = biquad(biquad(y, 'lp', bright, 0.7), 'hp', 110); const e = envAD(n, 0.35, 10, 1, 0.35, dur); for (let i = 0; i < n; i++) z[i] *= e[i]; return z }
// FX: riser (noise + rising band), impact (low boom + noise), downlifter, reverse swell
export function riser(sec) { const n = Math.round(sec * SR), y = noise(n, R), o = new Float32Array(n); let lp = 0; for (let i = 0; i < n; i++) { const t = i / n, fc = 300 + 7000 * t * t, a = 1 - Math.exp(-2 * Math.PI * fc / SR); lp += a * (y[i] - lp); o[i] = lp * Math.pow(t, 1.6) * 0.6 } return o }
export function impact() { const n = Math.round(2.2 * SR), y = new Float32Array(n); let p = 0; for (let i = 0; i < n; i++) { const t = i / SR; p += 2 * Math.PI * (38 + 60 * Math.exp(-t / 0.06)) / SR; y[i] = Math.sin(p) * Math.exp(-t / 0.7) * 0.9 } const nz = biquad(noise(n, R), 'lp', 2500); for (let i = 0; i < n; i++) y[i] += nz[i] * Math.exp(-i / (0.25 * SR)) * 0.35; return y }
export function downlifter(sec) { const r = riser(sec); return r.reverse() }
