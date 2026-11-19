// «Last Ember»: a fire bowl at night. The coals pulse with the hits; in the track's breakdown they go out one by one
// until one ember is left breathing; on the drop it catches: a flame leaps, a fountain of sparks goes up, and the
// sparks drift into the stars.
import * as THREE from 'three';
import { makeHearth, BOWL } from '../../library/models/fire-bowl.mjs';
import { makeFlame } from '../../library/effects/flame.mjs';
import { makeSparks } from '../../library/effects/sparks.mjs';
import { makeContactShadow, makeGround, makeSkyDome, makeStars } from '../../library/sets/night.mjs';
import { rng } from '../../library/util/noise.mjs';
import { clamp, ease, lerp, makeShots, orbit, seg, shake, smooth, soundOf } from '../kit.mjs';

export const look = { bloom: { strength: 0.38, radius: 0.55, threshold: 1.05 }, exposure: 1.0 };
export const env = { base: '#0b0b1c', panels: [{ dir: [-0.5, 1, -0.7], colour: '#8ea2ff', power: 2.2, size: 10 }, { dir: [0.6, 0.5, 0.8], colour: '#3a3f7a', power: 1, size: 12 }] };

export function build({ plan }) {
  const s = soundOf(plan);
  const { L, bar, cues } = plan;
  const fallT = cues.fallT, dropT = cues.dropT;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#0d0d2a', 5, 16);
  scene.add(makeSkyDome({ top: '#05051a', horizon: '#15153c', bottom: '#0b0b22' }), makeStars({ n: 260, seed: 4 }));
  scene.add(makeGround({ colour: '#1f1c26', radius: 12 }), makeContactShadow(0.62, 0.7));
  const hearth = makeHearth();
  scene.add(hearth.group);

  // light: the fire itself, a cool moon from behind, a little sky
  const fire = new THREE.PointLight('#ff7b2c', 3, 9, 1.8);
  fire.position.set(0, 0.55, 0);
  const moon = new THREE.DirectionalLight('#8fa2ff', 1.0);
  moon.position.set(-3.2, 4.5, -4);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { near: 1, far: 14, left: -2, right: 2, top: 2, bottom: -2 });
  moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.02; moon.shadow.radius = 4;
  scene.add(fire, moon, new THREE.HemisphereLight('#2a2d66', '#0b0912', 0.9));
  scene.environmentIntensity = 0.7;

  // the flame: three sheets of different sizes
  const flames = [makeFlame({ w: 0.95, h: 1.6, seed: 0.1 }), makeFlame({ w: 0.6, h: 1.1, seed: 0.5 }), makeFlame({ w: 0.55, h: 1.0, seed: 0.9 })];
  flames[0].position.set(0, 0.3, 0); flames[1].position.set(-0.17, 0.28, 0.06); flames[2].position.set(0.18, 0.28, -0.05);
  scene.add(...flames);

  // sparks: a few on every hit, a fountain on the drop, slow embers that climb at the end
  const r = rng(77);
  const bursts = [];
  for (const o of s.onsets) {
    const quiet = o.t >= fallT && o.t < dropT;
    const a = r() * 6.28, rad = r() * 0.28;
    bursts.push({ t: o.t, n: quiet ? 1 : Math.round(3 + 11 * o.s), origin: [Math.cos(a) * rad, 0.33, Math.sin(a) * rad], speed: quiet ? 0.5 : 1.3 + 1.2 * o.s, spread: 0.3, up: 0.55, life: quiet ? 1.2 : 1.7, seed: bursts.length + 1 });
  }
  bursts.push({ t: dropT, n: 420, origin: [0, 0.34, 0], speed: 4.2, spread: 0.42, up: 0.9, life: 2.8, jitter: 0.12, seed: 999 });
  for (let t = dropT + 0.6; t < L; t += plan.beat) bursts.push({ t, n: 5, origin: [(r() - 0.5) * 0.2, 0.4, (r() - 0.5) * 0.2], speed: 1.1, spread: 0.2, up: 0.5, life: 4.2, seed: 2000 + Math.round(t * 10) });
  const sparks = makeSparks(bursts, { size: 0.05 });
  scene.add(sparks);

  // the order in which the coals go out in the breakdown: the outer ring first, the hero never
  const order = hearth.coals.filter((c) => c !== hearth.hero).sort((a, b) => b.userData.rad - a.userData.rad || a.id - b.id);
  const outAt = new Map(order.map((c, i) => [c, fallT + (dropT - fallT) * (0.05 + 0.7 * (i / Math.max(1, order.length - 1)))]));

  const camera = new THREE.PerspectiveCamera(32, plan.w / plan.h, 0.1, 200);
  const c1 = [0, 0.5, 0];
  const shots = makeShots([
    { from: 0, to: dropT, pose: (t) => {
      const a = seg(t, 0, fallT), b = ease.inOut(seg(t, fallT, dropT));
      return orbit([0, lerp(0.52, 0.4, b), 0], lerp(4.95, 4.75, a) - 0.45 * b, lerp(-0.55, -0.25, a) + 0.4 * b, lerp(0.3, 0.34, a) + 0.2 * b, 32);
    } },
    { from: dropT, to: dropT + 2 * bar, pose: (t, u) => orbit([0, 1.12, 0], 6.1 - 0.3 * u, 0.5 + 0.2 * u, 0.07, 34) },
    { from: dropT + 2 * bar, to: dropT + 4 * bar, pose: (t, u) => orbit([0, 0.7, 0], 4.6 - 0.2 * u, -0.95 + 0.3 * u, 0.4, 32) },
    { from: dropT + 4 * bar, to: L + 1, pose: (t) => { const u = ease.inOut(seg(t, dropT + 4 * bar, L)); return orbit([0, lerp(1.0, 1.55, u), 0], lerp(5.6, 6.6, u), lerp(0.25, 0.0, u), 0.08, 34); } },
  ]);
  void c1;

  function update(t) {
    const hit = s.hit(t), loud = s.slow(t);
    const after = t - dropT;
    const lit = after >= 0;
    const breakdown = t >= fallT && !lit;
    const b = seg(t, fallT, dropT);
    // coals
    for (const c of hearth.coals) {
      let heat;
      if (c === hearth.hero) heat = lit ? 1.25 + 0.5 * hit : breakdown ? lerp(0.95, 0.42, b) + 0.22 * s.loud(t) + 0.08 * Math.sin(t * 3.1) : 1.0 + 0.5 * hit;
      else if (lit) heat = clamp(0.25 + after * 4, 0, 1) * (0.85 + 0.45 * hit) + 0.8 * Math.exp(-after / 0.25);
      else if (breakdown) heat = lerp(0.6, 0.015, smooth((t - outAt.get(c)) / 0.55)) * (1 + 0.2 * s.loud(t));
      else heat = 0.55 + 0.5 * hit;
      c.userData.heat(heat);
    }
    // flame
    let power;
    if (lit) power = Math.min(1.3, ease.out(after / 0.16) * 1.3) * (after < 0.5 ? 1 : lerp(1, 0.62 + 0.3 * loud, seg(after, 0.5, 1.4))) + 0.22 * hit;
    else if (breakdown) power = lerp(0.24, 0, seg(t, fallT, fallT + 0.7));
    else power = 0.24 + 0.16 * hit;
    flames[0].userData.set(t, power, 1.15);
    flames[1].userData.set(t * 1.13 + 3, power * 0.8, 0.9);
    flames[2].userData.set(t * 0.91 + 7, power * 0.72, 0.9);
    sparks.userData.update(t);
    // the fire's light follows its heat
    fire.intensity = lit ? 2.6 + 3 * Math.exp(-after / 0.3) + 1.6 * hit + 0.8 * loud : breakdown ? lerp(1.1, 0.3, b) + 0.3 * s.loud(t) : 1.3 + 1.0 * hit;
    fire.position.y = 0.5 + 0.25 * clamp(power);
    const wob = lit ? shake(t, 0.05 * Math.exp(-after / 0.5) + 0.006, 11) : shake(t, 0.004, 5);
    const shot = shots.apply(camera, t, wob);
    for (const f of flames) f.userData.face(camera);
    return { exposure: look.exposure * (lit ? 1 + 0.2 * Math.exp(-after / 0.2) : breakdown ? 1 + 0.25 * b : 1), bloom: look.bloom.strength * (1 + 0.6 * (lit ? Math.exp(-after / 0.4) : 0)), shot: shots.shots.indexOf(shot) };
  }

  return {
    scene, camera, update, heroes: [hearth.group], cuts: shots.shots.map((x) => x.from),
    anchors: { end: () => [480, 560] },
    keyTimes: [0.1, fallT - 0.3, lerp(fallT, dropT, 0.5), dropT - 0.15, dropT + 0.1, dropT + 0.5, dropT + 2 * bar + 0.8, dropT + 4 * bar + 1, L - 1.2],
  };
}
void BOWL;
