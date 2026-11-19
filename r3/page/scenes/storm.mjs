// «Copper Storm»: a copper weathervane on a green turret roof. The Short opens inside the track's own silence: the
// rain hangs still in the air and the camera creeps through it. As the sound rises the drops begin to fall; on the
// drop, lightning strikes the vane, it whips round, and the storm breaks: every kick lights the clouds from inside.
import * as THREE from 'three';
import { makeWeathervane, VANE } from '../../library/models/weathervane.mjs';
import { makeTurretRoof } from '../../library/models/turret-roof.mjs';
import { makeBolt, strikeEnvelope } from '../../library/effects/lightning.mjs';
import { makeSparks } from '../../library/effects/sparks.mjs';
import { makeCloudDeck, makeRain } from '../../library/sets/storm-sky.mjs';
import { makeSkyDome } from '../../library/sets/night.mjs';
import { noise3, rng } from '../../library/util/noise.mjs';
import { clamp, ease, lerp, makeShots, orbit, seg, shake, soundOf } from '../kit.mjs';

export const look = { bloom: { strength: 0.42, radius: 0.6, threshold: 1.05 }, exposure: 1.0 };
export const env = { base: '#2a3348', panels: [{ dir: [0.2, 1, 0.3], colour: '#a9c0ff', power: 1.5, size: 16 }, { dir: [-0.6, -0.25, -0.8], colour: '#ff8a4a', power: 1.3, size: 10 }, { dir: [1, 0.1, 0.4], colour: '#52688f', power: 0.9, size: 10 }] };

export function build({ plan }) {
  const s = soundOf(plan);
  const { L, bar, cues, fps } = plan;
  const riseT = cues.riseT, dropT = cues.dropT;
  const scene = new THREE.Scene();
  scene.add(makeSkyDome({ top: '#0a0e1a', horizon: '#2b2120', bottom: '#0d0b0c' }));
  const clouds = makeCloudDeck({ n: 210, seed: 5 });
  scene.add(clouds);
  const roof = makeTurretRoof();
  const vane = makeWeathervane();
  scene.add(roof, vane.group);
  const rain = makeRain({ n: 1700, box: [11, 10, 10] });
  scene.add(rain);

  const hemi = new THREE.HemisphereLight('#4a5a80', '#2c1c12', 1.0);
  const warm = new THREE.DirectionalLight('#ff9a5c', 0.9); // the copper glow from below and behind
  warm.position.set(-3, -1.5, -4);
  const cool = new THREE.DirectionalLight('#b4c6ff', 1.7);
  cool.position.set(2.5, 5, 4);
  cool.castShadow = true;
  cool.shadow.mapSize.set(1024, 1024);
  Object.assign(cool.shadow.camera, { near: 1, far: 16, left: -3, right: 3, top: 3, bottom: -3 });
  cool.shadow.bias = -0.0005; cool.shadow.normalBias = 0.02; cool.shadow.radius = 3;
  const flash = new THREE.DirectionalLight('#d4e2ff', 0);
  flash.position.set(1.5, 8, 2);
  scene.add(hemi, warm, cool, flash);

  // the camera's shots; every one keeps the whole vane in the frame
  const camera = new THREE.PerspectiveCamera(30, plan.w / plan.h, 0.1, 200);
  const cut = (k) => dropT + k * bar;
  const shots = makeShots([
    { from: 0, to: dropT, pose: (t, u) => orbit([0, 0.92, 0], lerp(6.3, 5.7, ease.inOut(u)), lerp(0.7, 0.42, u), -0.1, 30) },
    { from: cut(0), to: cut(2), pose: (t, u) => orbit([0, 2.05, 0], 7.8 - 0.4 * u, -0.5 - 0.1 * u, -0.2, 38) },
    { from: cut(2), to: cut(4), pose: (t, u) => orbit([0, 1.1, 0], 6.4 - 0.3 * u, 1.3 - 0.35 * u, 0.04, 30) },
    { from: cut(4), to: cut(6), pose: (t, u) => orbit([0, 1.25, 0], 6.6, -0.25 + 0.4 * u, -0.33, 30) },
    { from: cut(6), to: cut(8), pose: (t, u) => orbit([0, 0.85, 0], 6.9 - 0.3 * u, -0.9 + 0.25 * u, 0.5, 30) },
    { from: cut(8), to: L + 1, pose: (t) => { const u = ease.inOut(seg(t, cut(8), L)); return orbit([0, lerp(2.0, 2.25, u), 0], lerp(7.4, 8.8, u), lerp(0.45, 0.2, u), -0.17, 38); } },
  ]);

  // strikes: the first on the vane at the drop, one more on the vane when the last shot opens, and a far bolt on
  // every second bar line in between; each far bolt stands where its shot's camera can see it
  const tip = vane.tip.clone();
  const res = [plan.rw ?? plan.w, plan.rh ?? plan.h];
  const strikes = [];
  const addStrike = (t, kind, seed) => {
    const sh = shots.shotAt(t + 0.01);
    const pose = sh.pose(t + 0.01, seg(t + 0.01, sh.from, sh.to));
    const cam = new THREE.Vector3(...pose.pos), lookAt = new THREE.Vector3(...pose.look);
    const fwd = lookAt.clone().sub(cam).setY(0).normalize();
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x).negate();
    let from, to, width, power;
    if (kind === 'vane') {
      from = tip.clone().addScaledVector(right, 1.2).add(new THREE.Vector3(0, 9.5, 0)).addScaledVector(fwd, 1.5);
      to = tip.clone(); width = 8; power = 1;
    } else {
      const side = seed % 2 ? 1 : -1;
      const base = lookAt.clone().addScaledVector(fwd, 13).addScaledVector(right, side * (1.5 + (seed % 3) * 0.45));
      from = base.clone().setY(13); to = base.clone().setY(-3).addScaledVector(right, side * 0.5); width = 4; power = 0.5;
    }
    const bolt = makeBolt({ from, to, seed, width, branches: kind === 'vane' ? 4 : 2, resolution: res });
    scene.add(bolt);
    strikes.push({ t, kind, bolt, power, mid: from.clone().lerp(to, 0.35) });
  };
  addStrike(cut(0), 'vane', 11);
  addStrike(cut(2), 'far', 3);
  addStrike(cut(4), 'far', 6);
  addStrike(cut(6), 'far', 8);
  addStrike(cut(8), 'vane', 17);
  // sheet lightning inside the clouds on every kick after the drop (and two silent, far-off flickers in the quiet)
  const r = rng(31);
  const sheets = s.kicks.filter((o) => o.t > dropT + 0.2).map((o) => ({ t: o.t, k: 0.35 + 0.45 * o.s, p: (() => { const a = r() * 6.28, d = 14 + r() * 10; return new THREE.Vector3(Math.cos(a) * d, 6 + r() * 9, Math.sin(a) * d); })() }));
  sheets.push({ t: riseT * 0.42, k: 0.16, p: new THREE.Vector3(-16, 7, -16) }, { t: riseT * 0.86, k: 0.22, p: new THREE.Vector3(-22, 9, -6) });

  const sparks = makeSparks(strikes.filter((x) => x.kind === 'vane').map((x, i) => ({ t: x.t, n: 170, origin: [tip.x, tip.y - 0.1, tip.z], speed: 4.5, spread: 1.6, up: 0, life: 1.0, jitter: 0.03, seed: 50 + i, tint: [1, 0.72, 0.4] })), { size: 0.05, gravity: 6 });
  scene.add(sparks);

  // how fast the rain falls (0 in the silence) and how far it has fallen; the vane's angle. All per frame, summed once.
  const frames = Math.round(L * fps) + 2;
  const speedAt = (t) => (t < riseT ? 0 : t < dropT ? 0.16 * Math.pow(seg(t, riseT, dropT), 2) : 0.75 + 0.35 * s.slow(t));
  const fall = new Float32Array(frames);
  for (let f = 1; f < frames; f++) fall[f] = fall[f - 1] + (11 * speedAt(f / fps)) / fps;
  const angleAt = (t) => {
    let a = 0.5 + 0.06 * Math.sin(t * 0.9); // at rest, a small creak
    if (t > riseT) a += 0.5 * ease.in(seg(t, riseT, dropT)) * Math.sin((t - riseT) * 2.2);
    if (t >= dropT) {
      a += Math.PI * 2 * ease.out(seg(t, dropT, dropT + 0.7)); // the strike whips it once round
      a += 0.9 * (noise3(t * 0.7, 3, 1, 9) - 0.5) * 2; // the wind's own turning
      for (const o of s.kicks) { const d = t - o.t; if (d > 0 && d < 2 && o.t > dropT) a += 0.55 * o.s * Math.exp(-d / 0.45) * Math.sin(d * 10); }
    }
    return a;
  };

  const flashes = [];
  function update(t) {
    // lightning now
    let direct = 0, far = 0;
    flashes.length = 0;
    for (const x of strikes) {
      const k = strikeEnvelope(t - x.t) * x.power;
      x.bolt.userData.set(strikeEnvelope(t - x.t));
      if (k > 0.002) flashes.push({ p: x.mid, k: k * 2.2, reach: 90 });
      if (x.kind === 'vane') direct = Math.max(direct, k); else far = Math.max(far, k);
    }
    let sheet = 0;
    for (const x of sheets) {
      const d = t - x.t;
      if (d < 0 || d > 0.6) continue;
      const k = x.k * (d < 0.04 ? d / 0.04 : Math.exp(-(d - 0.04) / 0.13));
      flashes.push({ p: x.p, k: k * 1.6, reach: 60 });
      sheet = Math.max(sheet, k);
    }
    const lightning = Math.max(direct, far * 0.8, sheet * 0.45);
    const storm = t < dropT ? 0.25 * seg(t, riseT, dropT) : 1;
    clouds.userData.light(flashes, 0.3 * storm);
    flash.intensity = 9 * direct + 4.5 * far + 1.6 * sheet;
    hemi.intensity = 0.85 + 0.5 * storm + 2.5 * lightning;
    scene.environmentIntensity = 0.75 + 3.5 * lightning;
    // the vane: its head turns; the star glows after a strike
    vane.head.rotation.y = angleAt(t);
    let glow = 0;
    for (const x of strikes) if (x.kind === 'vane' && t >= x.t) glow = Math.max(glow, Math.exp(-(t - x.t) / 1.3));
    vane.hot.emissiveIntensity = 2.6 * glow;
    const f = clamp(t * fps, 0, frames - 2), fi = Math.floor(f);
    rain.userData.update(lerp(fall[fi], fall[fi + 1], f - fi), speedAt(t), 0.5 + 0.25 * storm + 3 * lightning);
    sparks.userData.update(t);
    const since = t - dropT;
    const wob = since >= 0 ? shake(t, 0.07 * Math.exp(-since / 0.45) + 0.012 + 0.02 * s.kick(t), 10) : shake(t, 0.003, 4);
    const shot = shots.apply(camera, t, wob);
    return { exposure: look.exposure * (1 + 0.15 * direct), bloom: look.bloom.strength, shot: shots.shots.indexOf(shot) };
  }

  return {
    scene, camera, update, heroes: [vane.group], cuts: shots.shots.map((x) => x.from),
    anchors: { end: () => [480, 520] },
    keyTimes: [0.1, riseT, dropT - 0.2, dropT + 0.03, dropT + 0.5, cut(2) + 0.03, cut(2) + 1.2, cut(4) + 0.9, cut(6) + 1, cut(8) + 0.03, L - 1.2],
  };
}
void VANE;
