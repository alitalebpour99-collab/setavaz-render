// «Kahkeshan» (the Milky Way): a night camp in the Persian desert, far from every town. A brass astrolabe hangs from a
// wooden pole planted in the sand, a daf rests on a kilim beside it, the dunes roll away, and over it all the Milky Way.
// The idea: the old instrument that read the stars, and the stars answering the music.
// - Intro (the group's «oh-oh, hey!»): the sky is dim and still; the stars blink on the shouts; the camera comes in low
//   over the sand to the astrolabe.
// - First drop: the astrolabe's rete starts to turn and its star pointers light on the kicks; the Milky Way swells with
//   the beat; a shooting star every four bars; the daf's rings shiver on the hits.
// - Breakdown (the woman's «aah»): the camera looks up; gold lines join the bright stars into a constellation, one star
//   at a time; the rete turns slowly.
// - Rise and second drop: the rete spins and the whole sky wheels round the pole like a night's time-lapse, with
//   shooting stars on the kicks.
// - Outro: the sky slows and stops; the pointers dim; the astrolabe hangs still under the stars.
// Everything is a function of the track's time.
import * as THREE from 'three';
import { makeAstrolabe, makeAstrolabeStand, ASTRO } from '../../library/models/astrolabe.mjs';
import { makeDaf } from '../../library/models/daf.mjs';
import { makeDunes, makeMilkyWay } from '../../library/sets/desert.mjs';
import { makeContactShadow, makeSkyDome } from '../../library/sets/night.mjs';
import { kilimTexture } from '../../library/textures/worlds.mjs';
import { rng } from '../../library/util/noise.mjs';
import { clamp, directShots, ease, fitPose, fovFor, lerp, seg, shake, smooth, soundOf, sphereOf, trackMarks } from '../kit.mjs';

export const look = { bloom: { strength: 0.55, radius: 0.65, threshold: 0.9 }, exposure: 1.1 };
export const env = { base: '#06081a', panels: [{ dir: [0, 1, 0], colour: '#5a6ab8', power: 1.3, size: 14 }, { dir: [-0.8, 0.2, -0.5], colour: '#8a95d8', power: 1.0, size: 9 }, { dir: [0.6, 0.1, 0.7], colour: '#ffb070', power: 0.9, size: 7 }] };

export function build({ plan }) {
  const s = soundOf(plan);
  const { L, a0 } = plan;
  const M = trackMarks(plan);
  const D1 = M.drop1 ?? 15.87, BR = M.break ?? 93.22, RI = M.rise ?? 115.04, D2 = M.drop2 ?? 119.01, OUT = M.outro ?? 132.89, END = M.end ?? 148.76;
  const bar = plan.bar;
  const wide = plan.format === 'long';

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#0a0c22', 30, 120);
  const dome = makeSkyDome({ top: '#050824', horizon: '#1d2552', bottom: '#07070f', radius: 95 });
  scene.add(dome);
  const sky = makeMilkyWay({ radius: 78, tilt: 1.1, turn: 0.35 });
  sky.position.y = -4;
  scene.add(sky);
  const dunes = makeDunes({ flat: 5 });
  scene.add(dunes);

  // the camp: the pole and the astrolabe hanging from it, the kilim, the daf leaning on a bundle
  const stand = makeAstrolabeStand();
  scene.add(stand);
  const astro = makeAstrolabe({ seed: 11 });
  const hook = stand.userData.hook;
  const hang = new THREE.Group(); // the astrolabe swings a little from the hook
  hang.position.copy(hook);
  astro.position.set(0, -ASTRO.ringTop + 0.004, 0);
  hang.add(astro);
  hang.rotation.y = 0.25;
  scene.add(hang);
  const kTex = kilimTexture().clone(); kTex.needsUpdate = true;
  const kilim = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.85), new THREE.MeshStandardMaterial({ map: kTex, roughness: 0.95 }));
  kilim.rotation.x = -Math.PI / 2; kilim.rotation.z = 0.25;
  kilim.position.set(-0.55, 0.006, 0.45);
  kilim.receiveShadow = true;
  scene.add(kilim);
  const bundle = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.42, 6, 16), new THREE.MeshStandardMaterial({ color: '#5b2a22', roughness: 0.9 }));
  bundle.rotation.z = Math.PI / 2; bundle.rotation.y = 0.35;
  bundle.position.set(-0.75, 0.12, 0.2);
  bundle.castShadow = bundle.receiveShadow = true;
  scene.add(bundle);
  const daf = makeDaf();
  daf.rotation.set(-1.05, 0.35, 0);
  daf.position.set(-0.62, 0.27, 0.42);
  scene.add(daf);
  const shadowA = makeContactShadow(0.3, 0.5); shadowA.position.set(0, 0.003, 0);
  scene.add(shadowA);

  // light: a cool starlight from high behind (it rims the brass), the sky's fill, and a warm glow from a fire out of
  // sight (it breathes with the beat)
  const star = new THREE.DirectionalLight('#9aa8ff', 1.6);
  star.position.set(-4, 9, -6);
  star.castShadow = true;
  star.shadow.mapSize.set(1024, 1024);
  Object.assign(star.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 30 });
  star.shadow.bias = -0.001;
  const fill = new THREE.HemisphereLight('#3a4a8a', '#2a1d14', 0.85);
  const fire = new THREE.PointLight('#ff9a50', 3.0, 14, 1.4);
  fire.position.set(1.6, 0.5, 1.8);
  const front = new THREE.DirectionalLight('#c9c0ff', 0.55);
  front.position.set(2, 3, 6);
  scene.add(star, fill, fire, front);
  scene.environmentIntensity = 0.75;

  // the constellation: bright stars in the part of the sky the camera looks at, joined one by one in the breakdown
  const cand = sky.userData.bright.filter((p) => p.z < -10 && p.y > 20).sort((a, b) => a.x - b.x).slice(0, 9);
  const linePos = new Float32Array(Math.max(1, cand.length - 1) * 6);
  for (let i = 0; i < cand.length - 1; i++) { linePos.set([cand[i].x, cand[i].y, cand[i].z, cand[i + 1].x, cand[i + 1].y, cand[i + 1].z], i * 6); }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(1.4, 1.05, 0.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  sky.add(lines);

  // shooting stars: a short bright streak crossing the sky (closed-form, so any frame is drawn alone)
  const r = rng(1120);
  const meteors = [];
  const addMeteor = (t) => {
    const a = -0.6 + r() * 1.6, h = 0.35 + 0.4 * r();
    const start = new THREE.Vector3(Math.sin(a) * 60, 30 + 25 * h, -Math.cos(a) * 60);
    const dir = new THREE.Vector3(-0.8 + 1.6 * r(), -0.5 - 0.3 * r(), 0.2 * (r() - 0.5)).normalize();
    meteors.push({ t, start, dir, speed: 55 + 25 * r(), life: 0.7 + 0.3 * r() });
  };
  for (const o of s.onsets) {
    const T = a0 + o.t;
    const k = Math.round((T - D1) / bar);
    const onBar = Math.abs(T - (D1 + k * bar)) < 0.06;
    if (T >= D1 && T < BR && onBar && k % 4 === 0) addMeteor(o.t);
  }
  for (const o of s.kicks) { const T = a0 + o.t; if (T >= D2 && T < OUT && r() < 0.5) addMeteor(o.t); }
  const POOL = 12;
  const pool = Array.from({ length: POOL }, () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(6), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    l.frustumCulled = false; l.visible = false;
    scene.add(l);
    return l;
  });

  // the camera
  const sections = [
    { type: 'intro', from: 0, to: D1 },
    { type: 'drop', from: D1, to: BR },
    { type: 'break', from: BR, to: RI },
    { type: 'rise', from: RI, to: D2 },
    { type: 'drop2', from: D2, to: OUT },
    { type: 'outro', from: OUT, to: Math.max(END, a0 + L) + 30 },
  ];
  const fov = fovFor(plan, 36, 28);
  const aspect = plan.w / plan.h;
  scene.updateMatrixWorld(true);
  const sAstro = sphereOf([astro], 0.06);
  const sDaf = sphereOf([daf], 0.06);
  const sCamp = sphereOf([astro, daf, stand], 0.03);
  const F = (sp, az, el, k, heroes, shift) => ({ ...fitPose(sp, { az, el, k, fov, aspect, shift }), heroes });
  // looking up past the astrolabe at the sky: the instrument low in the frame
  const skyward = (u, az, k = 1.6) => F(sAstro, az, lerp(-0.22, -0.3, u), k, [astro], [0, wide ? 0.4 : 1.6, 0]);
  const bank = {
    intro: [
      (u) => F(sCamp, lerp(0.25, 0.1, u), lerp(0.12, 0.2, u), lerp(1.5, 1.25, ease.inOut(u)), [astro, daf]),
      (u) => F(sAstro, lerp(-0.35, -0.15, u), lerp(0.08, 0.12, u), lerp(1.5, 1.35, u), [astro]),
    ],
    drop: [
      (u) => F(sAstro, lerp(0.2, 0.0, u), lerp(0.12, 0.06, u), lerp(1.3, 1.22, u), [astro]),
      (u) => skyward(u, lerp(0.3, 0.5, u)),
      (u) => F(sDaf, lerp(0.6, 0.4, u), lerp(0.7, 0.6, u), lerp(1.35, 1.25, u), [daf]),
      (u) => F(sCamp, lerp(-0.6, -0.4, u), lerp(0.15, 0.1, u), lerp(1.25, 1.18, u), [astro, daf]),
      (u) => F(sAstro, lerp(-0.5, -0.7, u), lerp(0.05, 0.15, u), lerp(1.28, 1.2, u), [astro]),
      (u) => skyward(u, lerp(-0.4, -0.2, u)),
    ],
    break: [
      (u) => skyward(u, lerp(0.05, 0.25, u), wide ? 1.9 : 2.0),
      (u) => F(sAstro, lerp(0.4, 0.2, u), lerp(0.1, 0.16, u), lerp(1.4, 1.3, u), [astro]),
    ],
    rise: [
      (u) => F(sAstro, lerp(0.1, -0.1, u), lerp(0.18, 0.08, u), lerp(1.6, 1.25, ease.in(u)), [astro]),
    ],
    drop2: [
      (u) => skyward(u, lerp(0.2, 0.45, u), 1.7),
      (u) => F(sAstro, lerp(-0.2, 0.05, u), lerp(0.1, 0.05, u), lerp(1.26, 1.2, u), [astro]),
      (u) => F(sCamp, lerp(0.5, 0.3, u), lerp(0.18, 0.12, u), lerp(1.22, 1.15, u), [astro, daf]),
      (u) => F(sDaf, lerp(-0.1, 0.15, u), lerp(0.75, 0.68, u), lerp(1.3, 1.22, u), [daf]),
    ],
    outro: [
      (u) => F(sCamp, lerp(0.15, 0.3, u), lerp(0.12, 0.22, u), lerp(1.2, 1.7, ease.inOut(u)), [astro, daf]),
    ],
  };
  const shots = directShots({ plan, sections, bank, every: { intro: wide ? 4 : 2, drop: wide ? 8 : 2, break: wide ? 8 : 4, rise: 2, drop2: wide ? 8 : 2, outro: 16 } });
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.05, 400);
  const heroes = [astro];

  // the rete's angle: still in the intro, one turn in 16 bars in the drop, slow in the breakdown, fast in the second drop
  const reteAt = (T) => {
    const w1 = (Math.PI * 2) / (16 * bar);
    let a = 0.4;
    a += w1 * clamp(T - D1, 0, BR - D1);
    a += 0.3 * w1 * clamp(T - BR, 0, RI - BR);
    a += 1.5 * w1 * clamp(T - RI, 0, D2 - RI);
    a += 3 * w1 * clamp(T - D2, 0, OUT - D2);
    const outroT = clamp(T - OUT, 0, END - OUT);
    a += 3 * w1 * (outroT - (outroT * outroT) / (2 * (END - OUT))); // slowing to a stop
    return a;
  };
  // the sky's turn: only in the rise, the second drop and the outro (a time-lapse of the night), slowing at the end
  const spinAt = (T) => {
    const w = 0.035;
    let a = 0;
    a += 0.5 * w * clamp(T - RI, 0, D2 - RI);
    a += w * clamp(T - D2, 0, OUT - D2);
    const o = clamp(T - OUT, 0, END - OUT);
    a += w * (o - (o * o) / (2 * (END - OUT)));
    return a;
  };

  function update(t) {
    const T = a0 + t;
    const hit = s.hit(t), kick = s.kick(t);
    const inDrop = (T >= D1 && T < BR) || (T >= D2 && T < OUT);
    // the sky
    const glow = (T < D1 ? 0.7 + 0.5 * hit : inDrop ? 1.05 + 0.55 * kick + 0.2 * hit : T < D2 ? 1.15 + 0.25 * hit : 0.95 - 0.2 * seg(T, OUT, END) + 0.2 * hit) * (T >= D2 && T < OUT ? 1.2 : 1);
    sky.userData.glow(glow);
    sky.userData.spin(spinAt(T));
    // the constellation is drawn one line at a time over the breakdown, then stays (fading at the end)
    const n = cand.length - 1;
    const drawn = n > 0 ? Math.floor(n * clamp(seg(T, BR + bar, RI - bar))) : 0;
    const lk = (T < BR + bar ? 0 : 1) * (1 - smooth(seg(T, OUT, END)));
    lines.geometry.setDrawRange(0, Math.max(0, (T >= D2 ? n : drawn)) * 2);
    lineMat.opacity = lk * (0.55 + 0.35 * hit);
    // the astrolabe: the rete turns, the pointers light with the kicks, it swings a little on its hook
    astro.userData.turn(reteAt(T));
    astro.userData.rule(-0.6 + 0.1 * Math.sin(T * 0.2));
    astro.userData.stars(T < D1 ? 0.25 + 0.6 * hit : (inDrop ? 0.9 + 1.0 * kick : 0.7 + 0.3 * hit) * (1 - 0.6 * smooth(seg(T, OUT + 2 * bar, END))));
    hang.rotation.z = 0.03 * Math.sin(T * 1.3) + (inDrop ? 0.015 * kick : 0);
    hang.rotation.y = 0.25 + 0.04 * Math.sin(T * 0.7);
    daf.userData.strike(inDrop ? hit : 0.3 * hit, T);
    // the lights breathe with the beat (the fire flares on the kicks)
    fire.intensity = 2.6 + (inDrop ? 3.4 * kick : 1.4 * hit) + 0.3 * Math.sin(T * 9.1) * Math.sin(T * 3.7);
    star.intensity = 1.5 * (1 + 0.25 * hit);
    // shooting stars
    let used = 0;
    for (const m of meteors) {
      const age = t - m.t;
      if (age < 0 || age > m.life || used >= POOL) continue;
      const l = pool[used++];
      const head = m.start.clone().addScaledVector(m.dir, m.speed * age);
      const tail = head.clone().addScaledVector(m.dir, -Math.min(9, m.speed * age * 0.5) - 2);
      const p = l.geometry.attributes.position.array, c = l.geometry.attributes.color.array;
      p.set([head.x, head.y, head.z, tail.x, tail.y, tail.z]);
      const f = Math.sin(Math.PI * (age / m.life)) * 1.8;
      c.set([1.4 * f, 1.3 * f, 1.1 * f, 0, 0, 0]);
      l.geometry.attributes.position.needsUpdate = true;
      l.geometry.attributes.color.needsUpdate = true;
      l.visible = true;
    }
    for (let i = used; i < POOL; i++) pool[i].visible = false;
    // the camera
    const punch = [D1, D2].reduce((a, d) => a + (T >= d && T < d + 1 ? Math.exp(-(T - d) / 0.3) : 0), 0);
    const wob = shake(T, 0.004 + 0.03 * punch + (inDrop ? 0.004 * kick : 0), 5);
    const pose = shots.apply(camera, t, wob);
    heroes.length = 0;
    heroes.push(...pose.heroes);
    const pre = (T >= D1 - 1.6 && T < D1) || (T >= D2 - 1.6 && T < D2) ? 0.8 : 1;
    return {
      exposure: look.exposure * pre * (1 + 0.45 * punch) * (1 + (inDrop ? 0.26 : 0.18) * hit),
      bloom: look.bloom.strength * (1 + 0.7 * punch + (inDrop ? 0.35 * kick : 0.12 * hit)),
      shot: shots.shots.indexOf(shots.shotAt(t)),
    };
  }

  const keyTimes = [0.2, ...shots.shots.slice(1).map((x) => x.from + 0.6), L - 1.0];
  if (plan.cues.dropT !== undefined) keyTimes.push(plan.cues.dropT - 0.2, plan.cues.dropT + 0.4);
  return {
    scene, camera, update, heroes, cuts: shots.shots.map((x) => x.from),
    anchors: { end: () => (wide ? [960, 470] : [480, 560]) },
    keyTimes: [...new Set(keyTimes.filter((x) => x < L).slice(0, 16).map((x) => +clamp(x, 0, L - 0.05).toFixed(2)))].sort((x, y) => x - y),
  };
}
