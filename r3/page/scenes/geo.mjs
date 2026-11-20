// The Persian-geometry worlds (Ali, 21 Nov 2026): a slowly turning kaleidoscope of girih, muqarnas and tile, drawn by a
// fragment shader, truly AUDIO-REACTIVE from the measured bands of the job (kick, bass, hat, melody, hue, kick and
// melody hits): kick -> rings and pulses of light, hats -> shimmer and sparkles, melody -> the hue drifts, bass -> the
// pattern breathes, the drop -> it blooms open. Seamless: every motion turns by exactly one symmetry step per period
// (the whole loop for a Short; `loopBars` bars for a long video), so the last frame flows into the first; an hour-long
// version is the same period repeated.
// Worlds (presets by scene name):
// - geo-kahkeshan: a desert night sky; a huge girih of stars turns; each kick lights a ring of stars; each melody hit
//   (the tahrir) sends a shooting star; on the drop the girih opens and the Milky Way blooms.
// - geo-bazaar: looking straight up into a bazaar's muqarnas dome; it unfolds like a kaleidoscope; hanging lanterns
//   sway with the groove and one ignites on each beat; on the drop light pours through the openings of the roof.
// No words here: the small title and the badge are the overlay's.
import * as THREE from 'three';

export const look = { bloom: { strength: 0.65, radius: 0.55, threshold: 0.82 }, exposure: 1.0 };
export const env = { base: '#000000', panels: [] };

const COMMON = /* glsl */ `
#define PI 3.14159265
#define TAU 6.28318531
uniform float uPh, uKick, uKickAge, uKickN, uHat, uMel, uHue, uBass, uBloom, uShoot, uShootSeed, uAspect, uBeatPh;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= .5; } return s; }
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
float segd(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
vec3 hueShift(vec3 c, float h) { const vec3 k = vec3(0.57735); float ca = cos(h); return c * ca + cross(k, c) * sin(h) + k * dot(k, c) * (1. - ca); }
// a log-polar cell of an N-fold pattern that zooms by z rings: x across the ring (0..1), y across the half wedge
// (0 on the mirror line .. 0.5 at the wedge's edge), in units where a cell is about square; ring = its index
vec3 cellOf(vec2 p, float N, float K, float z) {
  float r = length(p), a = atan(p.y, p.x);
  float lr = log(max(r, 1e-4)) * K - z;
  float ring = floor(lr), x = fract(lr);
  float w = TAU / N;
  float aa = mod(a + mod(ring, 2.) * .5 * w + .5 * w, w) - .5 * w;
  return vec3(x, abs(aa) / w * (w * K), ring);
}
`;

const KAHKESHAN = /* glsl */ `${COMMON}
void main() {
  vec2 p = (vUv - .5) * vec2(uAspect, 1.) * 2.2;
  p *= 1. - .07 * uBass;                                           // the bass breathes
  float r = length(p);
  vec2 lp = vec2(cos(TAU * uPh), sin(TAU * uPh));                  // a circle in noise space: drifts, and loops
  // the night and the Milky Way band (its dust drifts on the loop's circle, so it returns to itself)
  vec3 col = mix(vec3(.012, .014, .045), vec3(.004, .005, .018), smoothstep(.0, 1.6, r));
  vec2 q = rot(p, .55);
  float wob = fbm(q * 1.5 + lp * .35);
  float band = exp(-pow(q.y / (.32 + .16 * wob), 2.));
  float dust = smoothstep(.45, .75, fbm(q * 3.5 + lp * .5 + 3.)) * exp(-pow(q.y / .09, 2.));
  vec3 milk = mix(vec3(.22, .28, .62), vec3(1., .78, .55), smoothstep(.3, .8, fbm(q * 2. + lp * .3 + 9.)));
  col += milk * band * (1. - .7 * dust) * (.22 + .5 * uBloom + .25 * uKick) * (.55 + .75 * fbm(q * 6. + lp * .4));
  // far stars, twinkling on whole cycles of the loop, shimmering with the hats
  vec2 g = p * 70.; vec2 id = floor(g); float h = hash(id);
  float tw = .55 + .45 * sin(TAU * (3. * uPh + h * 7.));
  col += vec3(.85, .9, 1.) * step(.982, h) * smoothstep(.32, .0, length(fract(g) - .5)) * tw * (1. + 2.5 * uHat * step(.6, hash(id + 3.)));
  // the girih of stars: a 12-fold star lattice, turning one wedge and zooming two rings a period
  vec2 pr = rot(p, TAU / 12. * uPh);
  vec3 c = cellOf(pr, 12., 1.9, 2. * uPh);
  float open = mix(.5, .18, uBloom);                               // on the drop the stars' points open
  vec2 a0 = vec2(0., .5), a1 = vec2(open, 0.), a2 = vec2(1., .5);
  float d = min(segd(c.xy, a0, a1), segd(c.xy, a1, a2));
  d = min(d, abs(length(c.xy - vec2(.5, 0.)) - (.22 + .12 * uBloom)));
  float fade = smoothstep(.02, .18, r) * smoothstep(1.9, 1.1, r);
  vec3 gold = vec3(1., .78, .42);
  col += gold * exp(-d * 70.) * .16 * (.6 + uBloom) * fade;
  // the stars of the girih (its vertices), lit ring by ring by the kicks: a wave runs out from the centre on each kick
  float dv = min(min(length(c.xy - a0), length(c.xy - a1)), length(c.xy - a2));
  float R = .06 * exp(uKickAge * 2.6);
  float wave = exp(-pow((log(max(r, 1e-3)) - log(R)) * 5., 2.)) * exp(-uKickAge * 1.6);
  float sb = (.35 + .4 * uBloom + 2.8 * wave) * fade;
  col += vec3(.95, .93, 1.) * exp(-dv * dv * 900.) * sb + gold * exp(-dv * 30.) * .08 * sb;
  // a shooting star on each melody hit (the tahrir)
  if (uShoot < 1.2) {
    float s = uShootSeed * 2.399;
    vec2 st = vec2(cos(s), sin(s)) * (.5 + .4 * fract(uShootSeed * .618)) * vec2(uAspect, 1.) * 1.6;
    vec2 dir = normalize(vec2(-sin(s) - .4, cos(s) - .8));
    vec2 head = st + dir * uShoot * 1.4;
    float ds = segd(p, head, head - dir * (.35 + .4 * uShoot));
    float along = clamp(dot(p - head, -dir) / (.35 + .4 * uShoot), 0., 1.);
    col += vec3(1., .95, .85) * exp(-ds * 220.) * (1. - along) * sin(PI * clamp(uShoot / 1.2, 0., 1.)) * 1.6;
  }
  // the melody colours the sky, the kick lights the whole picture a little
  col = hueShift(col, (uHue - .5) * .7 + .12 * uMel);
  col *= 1. + .25 * uKick;
  col *= 1. - .35 * smoothstep(.9, 1.7, r);
  gl_FragColor = vec4(max(col, 0.), 1.);
}
`;

const BAZAAR = /* glsl */ `${COMMON}
// two tile colours by tier (an even step a period keeps the loop seamless), the plaster between
vec3 tile(float ring) { return mod(ring, 2.) < 1. ? vec3(.04, .42, .46) : vec3(.05, .13, .44); }
void main() {
  vec2 p = (vUv - .5) * vec2(uAspect, 1.) * 2.0;
  p *= 1. - .06 * uBass;
  float r = length(p), a = atan(p.y, p.x);
  // the dome: 16-fold muqarnas, every niche a pointed arch, unfolding one wedge and two tiers a period
  vec2 pr = rot(p, TAU / 16. * uPh);
  vec3 c = cellOf(pr, 16., 2.5, 2. * uPh);
  float x = c.x, y = c.y / (TAU / 16. * 2.5);                      // y back to 0..0.5 of the wedge
  float archW = .5 * (1. - pow(x, 1.7));                           // the niche narrows to a point towards the top
  float inNiche = smoothstep(archW + .015, archW - .015, y);
  float edge = exp(-abs(y - archW) * 90.) + exp(-x * 40.) * .6 + exp(-(1. - x) * 60.) * .4;
  vec3 base = tile(c.z);
  vec3 plaster = vec3(.78, .6, .38);
  vec3 col = mix(plaster * (.55 + .45 * x), base * (.35 + .9 * (1. - x)), inNiche);
  // the gold edges shimmer with the hats
  vec2 sp = floor(vec2(mod(c.z, 2.) * 7., (atan(pr.y, pr.x) + PI) * 40.));
  float spark = step(.8, hash(sp)) * (.5 + .5 * sin(TAU * (4. * uPh + hash(sp + 2.))));
  col += vec3(1., .78, .4) * edge * (.55 + .3 * uBloom) * (1. + 1.8 * uHat * spark);
  // the light: warm from the centre; the dome darkens towards the rim
  col *= (1.25 - .55 * smoothstep(.1, 1.3, r)) * (.75 + .35 * uBloom);
  // the roof's openings: the oculus and a ring of eight windows; on the drop light pours through them, in rays
  float ocu = smoothstep(.1, .07, r);
  vec2 wp = rot(p, TAU / 8. * uPh);
  float wa = mod(atan(wp.y, wp.x) + PI / 8., TAU / 8.) - PI / 8.;
  float win = smoothstep(.06, .035, length(vec2(length(wp) - .36, wa * .36)));
  vec3 sky = vec3(1.25, 1.05, .8);
  col = mix(col, sky * (.8 + 1.4 * uBloom), max(ocu, win * (.35 + .65 * uBloom)));
  float rays = pow(max(0., sin(atan(wp.y, wp.x) * 8. + .3)), 6.) * exp(-r * 1.8) * smoothstep(.06, .2, r);
  col += sky * rays * (.08 + .55 * uBloom) * (1. + .5 * uKick);
  // the lanterns hanging under the dome: eight, swaying with the groove; the one of this beat ignites on the kick
  vec2 lp = rot(p, TAU / 8. * uPh + .2);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float an = TAU / 8. * fi;
    vec2 pos = vec2(cos(an), sin(an)) * .62 + vec2(sin(TAU * uBeatPh + fi), cos(TAU * uBeatPh * .5 + fi * 1.7)) * .018;
    float d = length(lp - pos);
    float lit = .35 + .25 * uBloom + (abs(mod(uKickN, 8.) - fi) < .5 ? 2.2 * uKick : 0.);
    col = mix(col, vec3(.16, .1, .05), smoothstep(.06, .05, d) * smoothstep(.035, .045, d));   // the brass body
    col += vec3(1.3, .78, .35) * (exp(-d * d * 2600.) * 1.6 + exp(-d * 14.) * .18) * lit;
  }
  col = hueShift(col, (uHue - .5) * .5 + .1 * uMel);
  col *= 1. + .22 * uKick;
  col *= 1. - .3 * smoothstep(1.0, 1.6, r);
  gl_FragColor = vec4(max(col, 0.), 1.);
}
`;

export const WORLDS = { 'geo-kahkeshan': KAHKESHAN, 'geo-bazaar': BAZAAR };

/** The cyclic reader of the job's bands: frame values, and the time since the last hit (a loop wraps round). */
export function bandReader(plan) {
  const b = plan.bands;
  const L = plan.L, frames = plan.frames, loop = plan.format === 'loop';
  const at = (arr, t) => {
    if (!arr || !arr.length) return 0;
    let f = Math.round(t * 30);
    const n = Math.min(arr.length, frames); // a loop wraps at its own length
    f = loop ? ((f % n) + n) % n : Math.min(arr.length - 1, Math.max(0, f));
    return arr[f] ?? 0;
  };
  const since = (hits, t) => {
    if (!hits || !hits.length) return { age: 99, n: 0, s: 0 };
    let last = null, n = 0;
    for (const h of hits) { if (h.t <= t + 1e-6) { last = h; n++; } else break; }
    if (!last) { if (!loop) return { age: 99, n: 0, s: 0 }; last = hits[hits.length - 1]; return { age: t + L - last.t, n: hits.length, s: last.s, seed: hits.length }; }
    return { age: t - last.t, n, s: last.s, seed: n };
  };
  return { at, since };
}

export function build({ plan }) {
  const src = WORLDS[plan.scene] ?? KAHKESHAN;
  const bands = bandReader(plan);
  const b = plan.bands ?? {};
  const bar = plan.bar, beat = plan.beat;
  const period = plan.format === 'loop' ? plan.L : (plan.loopBars ?? 8) * bar;
  const marks = plan.cues.marks ?? {};
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1;
  const uniforms = Object.fromEntries(['uPh', 'uKick', 'uKickAge', 'uKickN', 'uHat', 'uMel', 'uHue', 'uBass', 'uBloom', 'uShoot', 'uShootSeed', 'uAspect', 'uBeatPh'].map((k) => [k, { value: 0 }]));
  uniforms.uAspect.value = plan.w / plan.h;
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: src, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  // the frame check's hero: a tiny mark at the centre (the pattern itself fills the frame)
  const hero = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.02), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hero.position.z = 0.5;
  scene.add(hero);
  // the bloom: a loop starts ON the drop (open at its start, closing a little and opening again by its end); a long
  // video opens on each drop and closes in the breakdown, slowly
  const dropsAt = Object.entries(marks).filter(([k]) => /^drop/.test(k)).map(([, t]) => t);
  const bloomAt = (t) => {
    if (plan.format === 'loop') return 0.55 + 0.45 * Math.cos((2 * Math.PI * t) / plan.L);
    const inDrop = (tt) => dropsAt.some((d) => tt >= d) && !(marks.break !== undefined && tt >= marks.break && tt < (marks.drop2 ?? Infinity)) && !(marks.outro !== undefined && tt >= marks.outro);
    const k = (tt) => (inDrop(tt) ? 1 : 0.15);
    let s = 0, n = 0;
    for (let d = -2 * bar; d <= 0; d += bar / 4) { s += k(t + d); n++; } // eased over two bars
    return s / n;
  };
  // every measured hit (the gate's own envelope: quick rise, 0.16 s fall), read round the loop
  const hitAt = (t) => {
    let v = 0;
    for (const o of plan.onsets) for (const sh of plan.format === 'loop' ? [0, -plan.L] : [0]) {
      const d = t - (o.t + sh);
      if (d < 0 || d > 1.2) continue;
      v = Math.max(v, o.s * (d < 0.03 ? d / 0.03 : Math.exp(-(d - 0.03) / 0.16)));
    }
    return v;
  };
  function update(t) {
    const kick = bands.at(b.kick, t), hat = bands.at(b.hat, t), mel = bands.at(b.mel, t), hue = bands.at(b.hue, t), bass = bands.at(b.bass, t);
    const kh = bands.since(b.kicks, t), mh = bands.since(b.melOn, t);
    const u = uniforms;
    u.uPh.value = (t / period) % 1;
    u.uKick.value = kick; u.uHat.value = hat; u.uMel.value = mel; u.uHue.value = hue; u.uBass.value = bass;
    u.uKickAge.value = Math.min(kh.age, 3); u.uKickN.value = kh.n;
    u.uShoot.value = mh.age; u.uShootSeed.value = (mh.seed ?? 0) % 97;
    u.uBloom.value = bloomAt(t);
    u.uBeatPh.value = (t / beat) % 1;
    // the whole picture breathes with the kick, so it keeps the beat
    const hit = hitAt(t);
    return { exposure: look.exposure * (1 + 0.24 * kick + 0.22 * hit), bloom: look.bloom.strength * (1 + 0.6 * kick + 0.3 * u.uBloom.value), shot: 0 };
  }
  const L = plan.L;
  const keyTimes = [0, 0.1, L * 0.25, L * 0.5, L * 0.75, L - 1 / 30].map((x) => +Math.max(0, Math.min(L - 0.05, x)).toFixed(2));
  return {
    scene, camera, update, heroes: [hero], cuts: [0, L * 0.25, L * 0.5, L * 0.75],
    anchors: { end: () => (plan.format === 'long' ? [960, 470] : [480, 560]) },
    keyTimes: [...new Set(keyTimes)].sort((x, y) => x - y),
  };
}
