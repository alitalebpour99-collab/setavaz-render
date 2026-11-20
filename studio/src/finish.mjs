// Master (gentle: limiter + loudnorm to -14 LUFS, no multiband so the drop/break contrast survives) and the
// quality gate. A song that fails is rejected and the caller makes another variant.
import { execFileSync, spawnSync } from 'node:child_process'; import fs from 'node:fs'
import { writeWav, SR } from './dsp.mjs'
import { MODES } from './theory.mjs'
const ff = (a) => execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...a])
const lufs = (f) => { const o = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' }).stderr; const t = o.slice(o.lastIndexOf('{')); return JSON.parse(t.slice(0, t.indexOf('}') + 1)) }
export function master(song, base, title) {
  const raw = base + '-mix.wav', pre = base + '-pre.wav'
  writeWav(raw, song.L, song.R)
  const end = song.seconds + 2.5
  ff(['-i', raw, '-af', `highpass=f=25:p=2,equalizer=f=3300:t=q:w=1.2:g=-1,afade=t=out:st=${(end - 3).toFixed(2)}:d=3,atrim=0:${end.toFixed(2)},alimiter=limit=0.94:attack=5:release=60:level=false`, '-c:a', 'pcm_f32le', pre])
  const m = lufs(pre)
  const ln = `loudnorm=I=-14:TP=-1.2:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`
  ff(['-i', pre, '-af', ln, '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '320k', '-metadata', `title=${title}`, '-metadata', 'artist=Setavaz', base + '.mp3'])
  fs.unlinkSync(raw); fs.unlinkSync(pre)
  return base + '.mp3'
}
const decMono = (f) => { const b = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', '22050', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 }); return new Float32Array(b.buffer, b.byteOffset, b.length / 4) }
const rms = (x, a, b) => { let s = 0, n = 0; for (let i = Math.max(0, a); i < Math.min(x.length, b); i++) { s += x[i] * x[i]; n++ } return 10 * Math.log10(s / Math.max(1, n) + 1e-12) }
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] } } for (let len = 2; len <= n; len <<= 1) { const an = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const wr = Math.cos(an * k), wi = Math.sin(an * k), u = i + k, v = u + len / 2; const xr = re[v] * wr - im[v] * wi, xi = re[v] * wi + im[v] * wr; re[v] = re[u] - xr; im[v] = im[u] - xi; re[u] += xr; im[u] += xi } } }
export function chromaShare(x, tonicHz, mode) {
  const N = 8192, sr = 22050, ch = new Array(12).fill(0)
  for (let s = 0; s + N < x.length; s += N) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = x[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); fft(re, im); for (let k = 1; k < N / 2; k++) { const f = k * sr / N; if (f < 90 || f > 1800) continue; const pc = ((Math.round(12 * Math.log2(f / 261.63)) % 12) + 12) % 12; ch[pc] += Math.hypot(re[k], im[k]) } }
  const t = 12 * Math.log2(tonicHz / 261.63), allowed = new Set()
  const pc = (v) => ((v % 12) + 12) % 12
  for (const c of MODES[mode].cents) { const v = t + c / 100; if (Math.abs(v - Math.round(v)) < 0.2) allowed.add(pc(Math.round(v))); else { allowed.add(pc(Math.floor(v))); allowed.add(pc(Math.ceil(v))) } }
  const tot = ch.reduce((a, b) => a + b, 0); let inK = 0; for (const p of allowed) inK += ch[p]; return { share: inK / tot, allowed: [...allowed] }
}
export function qc(song, mp3, c) {
  const x = decMono(mp3), sr = 22050, res = {}, fails = []
  // 1) rhythm variation (from the score): no 8-bar drum block repeated more than twice in a row, at least 6 different blocks
  let run = 1, maxRun = 1; for (let i = 1; i < song.score.blocks.length; i++) { run = song.score.blocks[i].sig === song.score.blocks[i - 1].sig ? run + 1 : 1; maxRun = Math.max(maxRun, run) }
  res.distinctDrumBlocks = new Set(song.score.blocks.map((b) => b.sig)).size; res.maxSameBlocksInARow = maxRun
  if (maxRun > 2) fails.push('the same drum pattern for more than 16 bars'); if (res.distinctDrumBlocks < 6) fails.push('fewer than 6 different drum blocks')
  // 2) section energy: drops clearly louder than the break; intro below drop A
  const lv = {}; for (const s of song.sections) lv[s.role] = +rms(x, Math.round(s.t0 * sr), Math.round(s.t1 * sr)).toFixed(1); res.sectionDb = lv
  res.dropVsBreak = +(Math.max(lv.dropA, lv.dropB) - lv.break).toFixed(1); if (res.dropVsBreak < 6) fails.push('break not clearly quieter than the drops')
  if (lv.intro > lv.dropA - 1.5) fails.push('intro as loud as the drop')
  // 3) contrast over the whole song (4-s windows): loudest vs quietest parts
  const w = 4 * sr, L = []; for (let i = 5 * sr; i + w < x.length - 5 * sr; i += sr) L.push(rms(x, i, i + w)); L.sort((a, b) => a - b); res.contrastDb = +(L[Math.floor(L.length * 0.95)] - L[Math.floor(L.length * 0.03)]).toFixed(1); if (res.contrastDb < 8) fails.push('flat: contrast under 8 dB')
  // 4) key consistency: share of pitched energy in the dastgah's pitch classes (koron notes count to both neighbours)
  const k = chromaShare(x, c.tonicHz, c.mode); res.keyShare = +k.share.toFixed(2); if (k.share < 0.6) fails.push('key not consistent with the mode')
  // 5) loudness and length
  const m = lufs(mp3); res.lufs = +m.input_i; res.truePeak = +m.input_tp; if (Math.abs(res.lufs + 14) > 0.7) fails.push('loudness off -14 LUFS')
  res.seconds = +(x.length / sr).toFixed(1); if (res.seconds < 140 || res.seconds > 200) fails.push('length outside 2:20-3:20')
  res.pass = fails.length === 0; res.fails = fails
  return res
}
