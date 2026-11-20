#!/usr/bin/env node
// Setavaz studio v1: node bin/make.mjs --out out [--seed 7 | --concept concepts/x.json] [--tries 3] [--lyria file:bpm:firstBeat:bars]
// Makes a concept, composes, arranges, mixes, masters and runs the quality gate; a rejected song is rebuilt as a new
// variant (seed + 1000) up to --tries times. Writes <out>/<slug>.mp3, <slug>.json (concept, plan, QC) and a phone copy.
import fs from 'node:fs'; import path from 'node:path'
import { makeConcept } from '../src/ideas.mjs'
import { render } from '../src/song.mjs'
import { master, qc } from '../src/finish.mjs'
import { readAudio, SR } from '../src/dsp.mjs'
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d }
const out = arg('out', 'out'); fs.mkdirSync(out, { recursive: true })
const over = arg('concept') ? JSON.parse(fs.readFileSync(arg('concept'), 'utf8')) : {}
let seed = +(arg('seed', over.seed ?? 1)); const tries = +arg('tries', 3)
// optional Lyria texture: a solo instrument / atmosphere loop, cut to whole bars at the song tempo (never the beat)
function lyriaLoop(c) { if (!c.lyria?.file || !fs.existsSync(c.lyria.file)) return null; const srcBar = 240 / c.lyria.bpm; let [L, R] = readAudio(c.lyria.file, c.lyria.firstBeat || 0, c.lyria.bars * srcBar); const n = Math.round(c.lyria.bars * 240 / c.bpm * SR), ra = L.length / n, oL = new Float32Array(n), oR = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * ra, k = Math.floor(x), f = x - k; oL[i] = (L[k] ?? 0) * (1 - f) + (L[k + 1] ?? 0) * f; oR[i] = (R[k] ?? 0) * (1 - f) + (R[k + 1] ?? 0) * f } let e = 0; for (let i = 0; i < n; i++) e += oL[i] ** 2; const g = 0.1 / Math.sqrt(e / n + 1e-12); const fd = Math.round(0.008 * SR); for (let i = 0; i < n; i++) { const w = Math.min(1, i / fd, (n - 1 - i) / fd); oL[i] *= g * w; oR[i] *= g * w } return [oL, oR] }
for (let t = 0; t < tries; t++) {
  const c = makeConcept(seed, over), title = c.title || `Setavaz ${c.mode} ${c.genre} ${seed}`
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const t0 = Date.now(); const song = render(c, { lyriaLoop: lyriaLoop(c) })
  const mp3 = master(song, path.join(out, slug), title); const q = qc(song, mp3, c)
  const rep = { concept: c, sections: song.sections, progression: song.prog, progression2: song.prog2, motif: song.motif, drumBlocks: song.score.blocks.map((b) => `${b.role}@${b.from}:${b.key}`), notes: song.score.notes, qc: q, renderSeconds: (Date.now() - t0) / 1000 }
  fs.writeFileSync(path.join(out, slug + '.json'), JSON.stringify(rep, null, 1))
  console.log(`${title}: ${q.pass ? 'PASS' : 'REJECT'} ${JSON.stringify({ lufs: q.lufs, contrast: q.contrastDb, dropVsBreak: q.dropVsBreak, key: q.keyShare, blocks: q.distinctDrumBlocks, run: q.maxSameBlocksInARow, sec: q.seconds })} ${q.fails.join('; ')}`)
  if (q.pass) break
  fs.renameSync(mp3, mp3.replace(/\.mp3$/, '.rejected.mp3')); seed += 1000
}
