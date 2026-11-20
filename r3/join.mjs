// The long video's last step: its parts (render.mjs --part k, one runner each) put together without encoding them
// again, the gate run over every frame of the whole, the contact sheets, a cover frame and the report.
//   node join.mjs --job job.b64 --in parts --out out
// Needs ffmpeg only (no browser). The picture stays SILENT: the sound is added afterwards, off this repo.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { makeR3Plan, partsOf, readJob } from './plan.mjs';
import { reason, verdict } from './gate.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const inDir = path.resolve(arg('in', 'parts'));
const outDir = path.resolve(arg('out', 'out'));
fs.mkdirSync(outDir, { recursive: true });
const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg: ${(r.stderr || '').slice(-300)}`);
};

const job = readJob(arg('job', 'job.b64'));
const plan = makeR3Plan({ job });
const { id } = plan;
const n = partsOf(plan);
const pad = (k) => String(k).padStart(2, '0');
const files = [];
for (const f of fs.readdirSync(inDir, { recursive: true })) files.push(path.join(inDir, String(f)));
const find = (suffix) => files.find((f) => f.endsWith(suffix));

// every part must be there, in order, with its frames
const parts = [];
for (let k = 0; k < n; k++) {
  const mp4 = find(`${id}.part-${pad(k)}.mp4`);
  const meta = find(`${id}.part-${pad(k)}.frames.json`);
  if (!mp4 || !meta) throw new Error(`part ${k} of ${n} is missing`);
  parts.push({ mp4, meta: JSON.parse(fs.readFileSync(meta, 'utf8')) });
}
const frames = parts.flatMap((p) => p.meta.frames).sort((a, b) => a.f - b.f);
if (frames.length !== plan.frames || frames.some((x, i) => x.f !== i)) throw new Error(`the parts hold ${frames.length} frames, the video has ${plan.frames}`);

const mp4 = path.join(outDir, `${id}.mp4`);
const list = path.join(outDir, `${id}.parts.txt`);
fs.writeFileSync(list, parts.map((p) => `file '${p.mp4.replace(/\\/g, '/')}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', mp4]);
fs.rmSync(list, { force: true });

// for the owner's look (never uploaded anywhere): contact sheets and a cover frame on the first drop
const every = Math.max(2, Math.round(plan.L / 14));
ff(['-i', mp4, '-vf', `fps=1/${every},scale=384:-2,tile=7x2:padding=6:color=0x0C0930`, '-frames:v', '1', '-q:v', '3', path.join(outDir, `${id}-sheet.jpg`)]);
ff(['-i', mp4, '-vf', `fps=1/${Math.max(1, Math.round(plan.L / 60))},scale=240:-2,tile=10x6:padding=4:color=0x0C0930`, '-frames:v', '1', '-q:v', '3', path.join(outDir, `${id}-sheet2.jpg`)]);
const coverAt = (plan.cues.dropT ?? plan.L / 3) + 0.6;
ff(['-ss', coverAt.toFixed(2), '-i', mp4, '-frames:v', '1', '-q:v', '2', path.join(outDir, `${id}-cover.jpg`)]);

const bytes = fs.statSync(mp4).size;
const v = verdict({ plan, frames, file: { bytes }, never: job.never });
const mode = process.env.SETAVAZ_GATE ?? 'on';
const p0 = parts[0].meta;
const report = {
  id, trackId: job.trackId, lang: 'en', style: 'r3', format: plan.format, scene: plan.scene, a0: plan.a0, length: plan.L, bpm: plan.track.bpm, cues: plan.cues, cuts: p0.cuts,
  render: { size: `${p0.size} shown at ${plan.w}x${plan.h}`, gpu: p0.gpu, parts: n, seconds: parts.map((p) => p.meta.seconds) },
  sound: { source: plan.sound.source, onsets: plan.onsets.length, audio: 'none' }, bytes,
  texts: plan.texts.map((x) => ({ role: x.role, text: x.lines?.join(' ') ?? x.name, from: x.from, to: x.to ?? plan.L, size: x.size })),
  gate: v.ok ? 'pass' : mode === 'warn' ? 'warn' : 'refused', checks: v.checks,
  reason: v.ok ? undefined : `این ویدیو پیش از رسیدن به تو رد شد: ${reason(v)}`,
};
fs.writeFileSync(path.join(outDir, `${id}.report.json`), JSON.stringify(report, null, 2));
for (const c of v.checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.id}: ${c.detail}`);
console.log(`${id}: ${plan.L} s in ${n} parts, silent, ${(bytes / 1048576).toFixed(1)} MB, gate ${report.gate}`);
process.exit(v.ok || mode === 'warn' ? 0 : 2);
