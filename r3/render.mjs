// Round-3 Shorts: one lit 3D world per track, drawn with three.js in a headless Chrome and encoded with ffmpeg.
//   node render.mjs --job job.json [--out out] [--scale 0.75]     the full Short, SILENT, gated
//   node render.mjs --job job.json --stills [--out out]           the key frames only (look at these first)
//   node render.mjs --turntables [--out out]                      every library object from eight sides
//   node render.mjs --job job.json --part k [--out out]           part k of a long video (frames and their checks only);
//                                                                 join.mjs puts the parts together and gates the whole
// Runs on GitHub Actions only (.github/workflows/r3.yml, this public repo: free minutes). The job (plan.mjs readJob)
// holds the track's sound as numbers only; the track itself never comes here. The Setavaz app puts the sound under
// the picture on its own server and checks the loudness there. Nothing here posts, schedules or uploads.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { FPS, makeR3Plan, partRange, partsOf, readJob } from './plan.mjs';
import { reason, verdict } from './gate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = HERE; // r3/: page/, library/, fonts/, node_modules/
const has = (k) => process.argv.includes(`--${k}`);
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const outDir = path.resolve(arg('out', 'out'));
const scale = Number(arg('scale', 0.75));
fs.mkdirSync(outDir, { recursive: true });
const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// a small file server for the page: /r3/..., /node_modules/three/..., /fonts/...
const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const file = path.normalize(path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const chrome = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
if (!chrome) throw new Error('no Chrome found (set CHROME_PATH)');
const browser = await puppeteer.launch({
  executablePath: chrome, headless: true, protocolTimeout: 240000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars', '--mute-audio'],
});
const page = await browser.newPage();
const pageErrors = [];
page.on('console', (m) => { const t = m.text(); if (!/GPU stall|GL Driver Message|status of 404/.test(t)) console.log(`[page ${m.type()}] ${t.slice(0, 400)}`); });
page.on('pageerror', (e) => { pageErrors.push(String(e)); console.error(`[page error] ${e}`); });
await page.goto(`${base}/page/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.r3ready === true', { timeout: 60000 });
const jpegOf = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
const finish = async (code) => { await browser.close().catch(() => {}); server.close(); process.exit(code); };

if (has('turntables')) {
  const ids = await page.evaluate(() => window.r3.objects());
  for (const id of ids) {
    const t0 = Date.now();
    const r = await page.evaluate((x) => window.r3.turntable(x), id);
    fs.writeFileSync(path.join(outDir, `turntable-${id}.jpg`), jpegOf(r.jpeg));
    console.log(`turntable ${id}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  await finish(pageErrors.length ? 1 : 0);
}

const jobFile = arg('job', null);
if (!jobFile) throw new Error('--job <file> is needed (the job the Setavaz app sends, or jobs/<track>.json)');
const job = readJob(jobFile);
const { trackId, brand, never } = job;
const plan = makeR3Plan({ job });
const id = plan.id;
console.log(`${id}: ${plan.L} s from ${plan.a0} s, sound ${plan.sound.source}, ${plan.onsets.length} onsets, cues ${JSON.stringify(plan.cues)}`);
const info = await page.evaluate((cfg) => window.r3.init(cfg), { plan, scale, brand });
console.log(`page: ${info.rw}x${info.rh}, float ${info.float}, ${info.gpu}`);

if (has('stills')) {
  // the key frames at full size, and a quick walk through the whole Short for the in-frame and words checks
  const names = [];
  for (const t of info.keyTimes) {
    const t0 = Date.now();
    const r = await page.evaluate((x) => window.r3.frame(x, { box: true }), t);
    const name = path.join(outDir, `${id}-t${t.toFixed(2).padStart(5, '0')}.jpg`);
    fs.writeFileSync(name, jpegOf(r.jpeg));
    names.push(name);
    console.log(`still ${t.toFixed(2)} s: ${Date.now() - t0} ms, luma ${r.luma}, shot ${r.shot}, box ${JSON.stringify(r.box)}`);
  }
  // the walk does not draw the 3D picture (that is the slow part): it poses the world and lays out the words
  const frames = [];
  for (let f = 0; f < plan.frames; f += 3) {
    const r = await page.evaluate((x) => window.r3.frame(x, { box: true, draw: false }), f / FPS);
    frames.push({ f, luma: 0.2, rows: r.rows, box: r.box });
  }
  const last = await page.evaluate((x) => window.r3.frame(x, { box: true, draw: false }), (plan.frames - 1) / FPS);
  frames.push({ f: plan.frames - 1, luma: 0.2, rows: last.rows, box: last.box });
  const v = verdict({ plan, frames, never });
  for (const c of v.checks) if (c.id !== 'visible') console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.id}: ${c.detail}`);
  // one sheet of the key frames
  const list = path.join(outDir, `${id}-stills.txt`);
  fs.writeFileSync(list, names.map((n) => `file '${n.replace(/\\/g, '/')}'\nduration 1`).join('\n'));
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=432:-2,tile=${Math.min(6, names.length)}x${Math.ceil(names.length / 6)}:padding=6:color=0x0C0930`, '-frames:v', '1', '-q:v', '3', path.join(outDir, `${id}-stills-sheet.jpg`)]);
  fs.rmSync(list, { force: true });
  fs.writeFileSync(path.join(outDir, `${id}.stills.json`), JSON.stringify({ id, a0: plan.a0, length: plan.L, cues: plan.cues, cuts: info.cuts, checks: v.checks }, null, 2));
  await finish(pageErrors.length ? 1 : 0);
}

// ── the full Short, or one part of a long video ──
const started = Date.now();
const partArg = arg('part', null);
const part = partArg === null ? null : Number(partArg);
const n = partsOf(plan);
if (part !== null && !(Number.isInteger(part) && part >= 0 && part < n)) throw new Error(`part ${partArg} (this video has ${n})`);
const range = part === null ? { from: 0, to: plan.frames } : partRange(plan, part, n);
const mp4 = path.join(outDir, part === null ? `${id}.mp4` : `${id}.part-${String(part).padStart(2, '0')}.mp4`);
const colour = ['-vf', 'scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv,format=yuv420p,noise=c0s=5:c0f=t+u', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
const rate = plan.format === 'long' ? ['-maxrate', '9M', '-bufsize', '18M'] : ['-maxrate', '7M', '-bufsize', '14M'];
const enc = spawn('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-an',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', ...rate, ...colour, '-r', String(FPS), '-g', String(2 * FPS),
  '-frames:v', String(range.to - range.from), '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
const frames = [];
if (part !== null) console.log(`part ${part + 1} of ${n}: frames ${range.from} to ${range.to - 1}`);
for (let f = range.from; f < range.to; f++) {
  const r = await page.evaluate((x, b) => window.r3.frame(x, { box: b }), f / FPS, f % 3 === 0 || f === plan.frames - 1);
  frames.push({ f, luma: r.luma, rows: r.rows, box: r.box });
  if (!enc.stdin.write(jpegOf(r.jpeg))) await new Promise((res) => enc.stdin.once('drain', res));
  if (f % 60 === 0) console.log(`frame ${f}/${plan.frames} ${((Date.now() - started) / 1000).toFixed(0)} s`);
  if (pageErrors.length) throw new Error(`the page failed: ${pageErrors[0]}`);
}
enc.stdin.end();
await done;

const renderS = (Date.now() - started) / 1000;
if (part !== null) {
  // a part: its frames' checks for join.mjs, which gates the whole video
  fs.writeFileSync(mp4.replace(/.mp4$/, '.frames.json'), JSON.stringify({ id, part, parts: n, ...range, seconds: +renderS.toFixed(1), size: `${info.rw}x${info.rh}`, gpu: info.gpu, cuts: info.cuts, frames }));
  console.log(`${id} part ${part}: ${range.to - range.from} frames in ${renderS.toFixed(0)} s`);
  await finish(0);
}

// for the owner's look (never uploaded anywhere): a contact sheet, a frame-by-frame sheet, a cover frame
ff(['-i', mp4, '-vf', 'fps=1/2,scale=216:-2,tile=7x2:padding=6:color=0x0C0930', '-frames:v', '1', '-q:v', '3', path.join(outDir, `${id}-sheet.jpg`)]);
ff(['-i', mp4, '-vf', 'fps=2,scale=180:-2,tile=10x6:padding=4:color=0x0C0930', '-frames:v', '1', '-q:v', '3', path.join(outDir, `${id}-sheet2.jpg`)]);
const coverAt = (plan.cues.dropT ?? plan.cues.closeT) + 0.4;
ff(['-ss', coverAt.toFixed(2), '-i', mp4, '-frames:v', '1', '-q:v', '2', path.join(outDir, `${id}-cover.jpg`)]);

const v = verdict({ plan, frames, file: { bytes: fs.statSync(mp4).size }, never });
const mode = process.env.SETAVAZ_GATE ?? 'on';
const report = {
  id, trackId, lang: 'en', style: 'r3', scene: plan.scene, a0: plan.a0, length: plan.L, bars: plan.bars, bpm: plan.track.bpm, cues: plan.cues, cuts: info.cuts,
  render: { size: `${info.rw}x${info.rh} shown at 1080x1920`, gpu: info.gpu, seconds: +renderS.toFixed(1) },
  // silent: the app adds the track, then measures the loudness and the size of the finished file
  sound: { source: plan.sound.source, onsets: plan.onsets.length, audio: 'none' }, bytes: fs.statSync(mp4).size,
  texts: plan.texts.map((x) => ({ role: x.role, text: x.lines?.join(' ') ?? x.name, from: x.from, to: x.to ?? plan.L, size: x.size })),
  gate: v.ok ? 'pass' : mode === 'warn' ? 'warn' : 'refused', checks: v.checks,
  reason: v.ok ? undefined : `این ویدیو پیش از رسیدن به تو رد شد: ${reason(v)}`,
};
fs.writeFileSync(path.join(outDir, `${id}.report.json`), JSON.stringify(report, null, 2));
for (const c of v.checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.id}: ${c.detail}`);
console.log(`${id}: ${plan.L} s, silent, ${(report.bytes / 1048576).toFixed(1)} MB, gate ${report.gate}, ${renderS.toFixed(0)} s`);
await finish(v.ok || mode === 'warn' ? 0 : 2);
