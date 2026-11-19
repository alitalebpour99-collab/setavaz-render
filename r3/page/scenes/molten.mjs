// «Molten Midnight»: the loop is cast. A crucible pours molten metal into a ring mould; the metal runs both ways
// round the ring, a step on every beat, and the two fronts meet as the track's last phrase begins: the loop closes
// in a flash. Then a light runs round the ring once a bar, and on the track's calm ending the ring cools to a
// dark red circle: a night sun.
import * as THREE from 'three';
import { makeCrucible, CRUCIBLE } from '../../library/models/crucible.mjs';
import { makeMoltenRing, makeRingMould, metalColour, MOULD } from '../../library/models/ring-mould.mjs';
import { makeSparks } from '../../library/effects/sparks.mjs';
import { makeGround, makeSkyDome } from '../../library/sets/night.mjs';
import { glowTexture } from '../../library/textures/data.mjs';
import { clamp, ease, lerp, makeShots, orbit, seg, shake, smooth, soundOf } from '../kit.mjs';

export const look = { bloom: { strength: 0.36, radius: 0.5, threshold: 1.05 }, exposure: 1.0 };
export const env = { base: '#0a0a12', panels: [{ dir: [0.5, 1, -0.6], colour: '#7f96ff', power: 2.4, size: 9 }, { dir: [-0.4, 0.2, 1], colour: '#ff9a52', power: 0.8, size: 8 }] };

const PX = -0.52; // where the crucible's stand is
const MX = 0.14; // where the mould's middle is

export function build({ plan }) {
  const s = soundOf(plan);
  const { L, bar, beat, cues } = plan;
  const closeT = cues.closeT, calmT = cues.calmT;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#0a0810', 6, 16);
  scene.add(makeSkyDome({ top: '#05060f', horizon: '#0f0c16', bottom: '#0a0810' }), makeGround({ colour: '#2c2b30', radius: 12, roughness: 0.86 }));
  const crucible = makeCrucible();
  crucible.group.position.x = PX;
  const mould = makeRingMould();
  mould.position.x = MX;
  const metal = makeMoltenRing();
  mould.add(metal);
  scene.add(crucible.group, mould);

  // the stream from the lip to the basin (made again each frame: it follows the lip)
  const streamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.5, 0.45) });
  const stream = new THREE.Mesh(new THREE.BufferGeometry(), streamMat);
  scene.add(stream);
  const basin = new THREE.Vector3(MX - MOULD.R, MOULD.top - 0.03, 0);
  const lip = new THREE.Vector3();
  function drawStream(t, k) {
    stream.visible = k > 0.02;
    if (!stream.visible) return;
    crucible.lipWorld(lip);
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      pts.push(new THREE.Vector3(lerp(lip.x, basin.x, u) + 0.004 * Math.sin(t * 23 + u * 9) * u, lip.y + (basin.y - lip.y) * u * u, 0.003 * Math.sin(t * 17 + u * 7) * u));
    }
    stream.geometry.dispose();
    stream.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.013 * (0.35 + 0.65 * k), 8);
  }

  // light: the metal lights its own world; a cold midnight light from above and behind draws the steel's edges
  const potLight = new THREE.PointLight('#ff8a3a', 1.4, 6, 1.8);
  const ringLight = new THREE.PointLight('#ff9a48', 0, 6, 1.8);
  ringLight.position.set(MX, 0.55, 0);
  const moon = new THREE.DirectionalLight('#8fa6ff', 2.4);
  moon.position.set(-2.5, 5, -3.5);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { near: 1, far: 14, left: -2, right: 2, top: 2, bottom: -2 });
  moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.02; moon.shadow.radius = 4;
  scene.add(potLight, ringLight, moon, new THREE.HemisphereLight('#20264c', '#0c0808', 0.8));
  scene.environmentIntensity = 0.8;

  // the light that runs round the closed ring, once a bar
  const runner = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(3, 2.1, 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  runner.scale.setScalar(0.2);
  runner.renderOrder = 6;
  const runnerLight = new THREE.PointLight('#ffb060', 0, 2.2, 1.6);
  mould.add(runner, runnerLight);

  // sparks where the stream lands on every hit of the pour, and a burst where the fronts meet
  const meet = [MX + MOULD.R, MOULD.top + 0.01, 0];
  const bursts = s.onsets.filter((o) => o.t > 0.5 && o.t < closeT - 0.4).map((o, i) => ({ t: o.t, n: Math.round(3 + 9 * o.s), origin: [basin.x, basin.y + 0.03, 0], speed: 1.6 + o.s, spread: 0.9, up: 0, life: 0.7, seed: i + 1, tint: [1, 0.62, 0.22] }));
  bursts.push({ t: closeT, n: 260, origin: meet, speed: 3.4, spread: 1.0, up: 0, life: 1.3, jitter: 0.04, seed: 500, tint: [1, 0.7, 0.3] });
  const sparks = makeSparks(bursts, { size: 0.03, gravity: 5.5 });
  scene.add(sparks);

  // the pour: the pot is already tipping on frame 0; the fronts advance one step a beat and meet exactly at closeT
  const fillFrom = Math.min(0.75, closeT - 8 * beat);
  const steps = Math.max(1, Math.round((closeT - fillFrom) / beat));
  const fillAt = (t) => {
    if (t <= fillFrom) return 0;
    if (t >= closeT) return 1;
    const x = (t - (closeT - steps * beat)) / beat;
    const k = Math.floor(x);
    return clamp((k + ease.out((x - k) / 0.55)) / steps);
  };
  const tiltAt = (t) => (t < closeT - 0.55 ? lerp(0.5, 1.26, ease.out(seg(t, 0, 0.6))) : lerp(1.26, 0.1, ease.inOut(seg(t, closeT - 0.55, closeT + 1.4))));
  const pourAt = (t) => smooth(seg(t, 0.32, 0.6)) * (1 - smooth(seg(t, closeT - 0.5, closeT - 0.12)));

  const camera = new THREE.PerspectiveCamera(30, plan.w / plan.h, 0.1, 200);
  const H = Math.PI / 2;
  const top = (t, h0, h1, roll0, roll1, a, b, cx = -0.02) => { const u = ease.inOut(seg(t, a, b)); return { pos: [cx, lerp(h0, h1, u), 0.0001], look: [cx, 0, 0], up: [-1, 0, 0], roll: lerp(roll0, roll1, u), fov: 30 }; };
  const mid = Math.min(closeT - 2 * bar, Math.max(2 * bar, closeT - 4 * bar));
  const shots = makeShots([
    { from: 0, to: mid, pose: (t, u) => orbit([-0.1, 0.24, 0], lerp(5.3, 5.0, u), H - 0.3 + 0.22 * u, 0.6, 30) },
    { from: mid, to: closeT, pose: (t, u) => orbit([-0.08, 0.26, 0], lerp(5.5, 5.2, u), H + 0.12 + 0.16 * u, 0.3, 30) },
    { from: closeT, to: closeT + 2 * bar, pose: (t) => top(t, 5.0, 5.25, -0.05, 0.03, closeT, closeT + 2 * bar) },
    { from: closeT + 2 * bar, to: closeT + 5 * bar, pose: (t, u) => orbit([-0.05, 0.2, 0], lerp(5.6, 5.3, u), H - 0.14 + 0.28 * u, lerp(0.2, 0.26, u), 30) },
    { from: closeT + 5 * bar, to: L + 1, pose: (t) => top(t, 5.25, 5.7, 0.04, -0.04, closeT + 5 * bar, L) },
  ]);

  const colour = new THREE.Color();
  const v = new THREE.Vector3();
  function update(t) {
    const hit = s.hit(t);
    const since = t - closeT;
    const closed = since >= 0;
    const calm = smooth(seg(t, calmT, L - 0.2));
    crucible.setTilt(tiltAt(t));
    const pour = pourAt(t);
    drawStream(t, pour);
    const fill = fillAt(t);
    // how hot the metal in the ring is: fresh while it is poured, a flash when the loop closes, then it cools on the calm ending
    const flashK = closed ? Math.exp(-since / 0.28) : 0;
    const heat = closed ? lerp(0.74, 0.16, calm) + 0.26 * flashK + 0.07 * hit * (1 - calm) : 0.78 + 0.1 * hit;
    metalColour(heat, colour);
    if (flashK > 0.01) colour.multiplyScalar(1 + 0.8 * flashK);
    metal.userData.set(fill, colour);
    crucible.pot.userData.heat(closed ? lerp(1, 0.55, smooth(seg(since, 0, 6))) * (1 - 0.35 * calm) : 1 + 0.12 * hit);
    // lights
    crucible.lipWorld(v);
    potLight.position.set(PX + 0.02, CRUCIBLE.pivotY + 0.22, 0);
    potLight.intensity = (closed ? lerp(1.4, 0.7, smooth(seg(since, 0, 6))) * (1 - 0.4 * calm) : 1.4 + 0.6 * hit) + 0.7 * pour;
    ringLight.intensity = fill * (0.5 + 1.5 * heat * heat) + 2.2 * flashK;
    ringLight.color.setRGB(1, 0.42 + 0.3 * heat, 0.12 + 0.3 * heat * heat);
    // the runner
    const run = closed ? smooth(seg(since, 0.25, 0.8)) * (1 - calm) : 0;
    runner.visible = run > 0.01;
    const a = Math.PI + (since / bar) * Math.PI * 2;
    runner.position.set(Math.cos(a) * MOULD.R, MOULD.top + 0.012, Math.sin(a) * MOULD.R);
    runner.material.opacity = run * (0.75 + 0.25 * hit);
    runner.scale.setScalar(0.16 + 0.07 * hit);
    runnerLight.position.copy(runner.position).setY(MOULD.top + 0.12);
    runnerLight.intensity = 0.9 * run;
    sparks.userData.update(t);
    const wob = closed ? shake(t, 0.03 * Math.exp(-since / 0.4) + 0.002, 10) : shake(t, 0.004 + 0.004 * hit, 6);
    const shot = shots.apply(camera, t, wob);
    return { exposure: look.exposure * (1 + 0.15 * flashK), bloom: look.bloom.strength * (1 + 0.7 * flashK), shot: shots.shots.indexOf(shot) };
  }

  const centre = new THREE.Vector3();
  return {
    scene, camera, update, heroes: [crucible.group, mould], cuts: shots.shots.map((x) => x.from),
    anchors: { end: () => { centre.set(MX, MOULD.top, 0).project(camera); return [(centre.x + 1) / 2 * plan.w, (1 - centre.y) / 2 * plan.h]; } },
    keyTimes: [0.05, 1.2, mid - 0.2, mid + 0.6, closeT - 0.6, closeT + 0.05, closeT + 1.2, closeT + 2 * bar + 1, closeT + 5 * bar + 0.5, L - 0.8],
  };
}
