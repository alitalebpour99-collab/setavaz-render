// «Bazaar Lights»: a covered Persian bazaar street at golden hour (a brick vault in bays, a round skylight in each,
// arched shop fronts with carpets and copper), a spice seller's stall of copper bowls heaped with turmeric, sumac,
// saffron, dried rose, cardamom and cinnamon, and a pierced brass lantern hanging in every bay. The idea: the bazaar
// lights up, and the music is what lights it.
// - Intro (the whistle hook): the low sun slants through the skylights onto the paving; the lanterns are dark.
// - First drop: the lanterns light one after another down the street, one a beat; the spice heaps puff coloured dust
//   on the kicks, glittering in the sun.
// - Breakdown: the sun goes down (the shafts turn rose, then fade); one lantern is left lit and turns slowly, and its
//   pierced stars are thrown onto the vault and the walls around it.
// - Rise: the other lanterns flicker back.
// - Second drop: night in the bazaar, every lantern blazing and swinging in a wave down the street, the dust on every kick.
// - Outro: the lanterns go out from the far end towards us; the two nearest stay.
// Everything is a function of the track's time (a Short and the long video show the same moment the same way).
import * as THREE from 'three';
import { makeBazaarArcade, SUN_DIR } from '../../library/sets/bazaar.mjs';
import { makeLantern } from '../../library/models/lantern.mjs';
import { makeSpiceStall } from '../../library/models/spice.mjs';
import { makeSparks } from '../../library/effects/sparks.mjs';
import { glowTexture } from '../../library/textures/data.mjs';
import { rng } from '../../library/util/noise.mjs';
import { clamp, directShots, ease, fitPose, fovFor, joinSpheres, lerp, seg, shake, smooth, soundOf, sphereOf, trackMarks } from '../kit.mjs';

export const look = { bloom: { strength: 0.5, radius: 0.6, threshold: 0.92 }, exposure: 1.0 };
export const env = { base: '#1a0f08', panels: [{ dir: [0, 1, -0.3], colour: '#ffc58a', power: 1.6, size: 9 }, { dir: [0, 0.3, -1], colour: '#ffb070', power: 1.3, size: 10 }, { dir: [0.8, 0.2, 0.4], colour: '#5a3a28', power: 0.8, size: 10 }] };

const BAYS = 6;

export function build({ plan }) {
  const s = soundOf(plan);
  const { L, a0 } = plan;
  const M = trackMarks(plan);
  const D1 = M.drop1 ?? 7.87, D1B = M.drop1b ?? 23.6, BR = M.break ?? 62.95, RI = M.rise ?? 78.69, D2 = M.drop2 ?? 82.62, OUT = M.outro ?? 135.74, END = M.end ?? 151.5;
  const beat = plan.beat, bar = plan.bar;
  const wide = plan.format === 'long';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d0806');
  scene.fog = new THREE.Fog('#2a160b', 10, 34);
  const arcade = makeBazaarArcade({ bays: BAYS });
  scene.add(arcade);
  const A = arcade.userData;

  // the lanterns: one in the middle of each bay, hung from the crown on a rod
  const lanterns = A.bays.map((b, i) => {
    const l = makeLantern({ chain: 8, rod: 1.55 + 0.1 * (i % 2) });
    l.position.set(0, b.crownY - 0.05, b.z);
    l.rotation.y = i * 0.7;
    scene.add(l);
    return l;
  });
  const bodies = lanterns.map((l) => l.userData.body);
  // the stall, against the right-hand wall of the second bay
  const stall = makeSpiceStall({ seed: 5 });
  stall.rotation.y = Math.PI / 2;
  stall.position.set(1.32, 0, A.bays[1].z + 0.2);
  scene.add(stall);
  scene.updateMatrixWorld(true);
  const cones = stall.userData.cones.map((c) => ({ ...c, top: c.bowl.userData.top.clone().applyMatrix4(c.bowl.matrixWorld) }));

  // light: the low sun through the skylights (it casts the shadows), a warm fill, the lanterns' own light
  const sun = new THREE.DirectionalLight('#ffc27a', 3.2);
  // the sun's direction is the set's (its shafts lean the same way): it comes from up, a little left and behind
  sun.target.position.set(0, 0, -7);
  sun.position.set(-SUN_DIR[0] * 12, 12, -7 - SUN_DIR[2] * 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 16, bottom: -16, near: 1, far: 36 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const fill = new THREE.HemisphereLight('#8a5a34', '#2a1608', 0.9);
  scene.add(fill);
  const lampLights = lanterns.slice(0, 4).map((l) => {
    const p = new THREE.PointLight('#ffad5a', 0, 9, 1.6);
    p.position.copy(l.userData.centre).add(l.position);
    scene.add(p);
    return p;
  });
  scene.environmentIntensity = 0.5;

  // the star spots thrown by the turning lantern (bay 1) onto the vault and the walls
  const holes = lanterns[1].userData.holes;
  const spotGeo = new THREE.BufferGeometry();
  const spotPos = new Float32Array(holes.length * 3), spotCol = new Float32Array(holes.length * 3);
  spotGeo.setAttribute('position', new THREE.BufferAttribute(spotPos, 3));
  spotGeo.setAttribute('color', new THREE.BufferAttribute(spotCol, 3));
  const spots = new THREE.Points(spotGeo, new THREE.PointsMaterial({ size: 0.34, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  spots.frustumCulled = false;
  scene.add(spots);
  const lampCentre = lanterns[1].userData.centre.clone().add(lanterns[1].position);

  // dust motes in the sun shafts
  const NM = 500, r = rng(1121);
  const motes = Array.from({ length: NM }, () => ({ b: Math.floor(r() * 3), x: (r() - 0.5) * 1.2, y: 0.4 + r() * 4.2, z: (r() - 0.5) * 1.4, ph: r() * 10, sp: 0.05 + 0.1 * r() }));
  const moteGeo = new THREE.BufferGeometry();
  const moteP = new Float32Array(NM * 3), moteC = new Float32Array(NM * 3);
  moteGeo.setAttribute('position', new THREE.BufferAttribute(moteP, 3));
  moteGeo.setAttribute('color', new THREE.BufferAttribute(moteC, 3));
  const moteMat = new THREE.PointsMaterial({ size: 0.025, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const moteMesh = new THREE.Points(moteGeo, moteMat);
  moteMesh.frustumCulled = false;
  scene.add(moteMesh);

  // the coloured dust of the spices: a puff on the kicks of the drops, from one heap after another
  const bursts = [];
  let k = 0;
  for (const o of s.kicks) {
    const T = a0 + o.t;
    const inD1 = T >= D1 && T < BR, inD2 = T >= D2 && T < OUT;
    if (!inD1 && !inD2) continue;
    if (inD1 && (k++ % 2)) continue;
    const c = cones[(bursts.length) % cones.length];
    bursts.push({ t: o.t, n: inD2 ? 16 : 11, origin: [c.top.x, c.top.y + 0.01, c.top.z], speed: 0.55, spread: 0.85, up: 0.12, life: 1.8, jitter: 0.06, seed: 40 + bursts.length, tint: [c.colour.r * 0.8 + 0.2, c.colour.g * 0.8 + 0.12, c.colour.b * 0.8 + 0.05] });
  }
  const dust = makeSparks(bursts.filter((b) => b.t > -3 && b.t < L + 1), { size: 0.035, gravity: 0.35 });
  scene.add(dust);

  // the camera: shots cut on the downbeats of each section (directShots), framing real things
  const sections = [
    { type: 'intro', from: 0, to: D1 },
    { type: 'light', from: D1, to: D1B },
    { type: 'drop', from: D1B, to: BR },
    { type: 'break', from: BR, to: RI },
    { type: 'rise', from: RI, to: D2 },
    { type: 'drop2', from: D2, to: OUT },
    { type: 'outro', from: OUT, to: Math.max(END, a0 + L) + 30 },
  ];
  const fov = fovFor(plan, 34, 28);
  const aspect = plan.w / plan.h;
  // a lantern's sphere from its brass only (its glow sprite is wider than the lantern and is not what must stay in frame)
  const sL = lanterns.map((l) => new THREE.Sphere(l.userData.centre.clone().add(l.position), 0.27));
  const sStall = sphereOf([stall], 0.02);
  const sBowls = sphereOf(stall.userData.cones.slice(0, 3).map((c) => c.bowl), 0.06);
  const sBowls2 = sphereOf(stall.userData.cones.slice(3).map((c) => c.bowl), 0.06);
  const F = (sp, az, el, kk, heroes, shift) => ({ ...fitPose(sp, { az, el, k: kk, fov, aspect, shift }), heroes });
  // a look down the street from the near end, the first lit lantern framed (the others recede into the fog)
  const street = (u, i, h = 1.5, dx = 0.0) => {
    const c = sL[i].center;
    const pos = [dx + lerp(0.25, -0.15, u), h, c.z + lerp(4.6, 4.0, u) + (wide ? 0.9 : 0)];
    return { pos, look: [c.x * 0.5, lerp(c.y - (wide ? 0 : 0.2), c.y + 0.1, u), c.z - 2.5], fov, heroes: [bodies[i]] };
  };
  const up = (u, i) => ({ ...F(sL[i], lerp(-0.6, -0.3, u), lerp(-0.42, -0.3, u), lerp(1.35, 1.25, u), [bodies[i]]) });
  const bank = {
    intro: [
      (u) => street(u, 1, 1.4, 0.2),
      (u) => F(sBowls, lerp(-0.75, -0.6, u), lerp(0.58, 0.5, u), lerp(1.18, 1.1, u), stall.userData.cones.slice(0, 3).map((c) => c.bowl)),
    ],
    light: [
      (u) => street(u, 1, 1.25, -0.3),
      (u) => up(u, 1),
      (u) => F(sStall, lerp(-0.42, -0.3, u), lerp(0.5, 0.42, u), 1.1, [stall]),
      (u) => street(u, 2, 1.7, 0.4),
    ],
    drop: [
      (u) => F(sBowls2, lerp(-0.7, -0.55, u), lerp(0.55, 0.48, u), lerp(1.18, 1.1, u), stall.userData.cones.slice(3).map((c) => c.bowl)),
      (u) => up(u, 2),
      (u) => street(u, 1, 1.6, 0.35),
      (u) => F(sL[0], lerp(0.5, 0.25, u), lerp(-0.25, -0.15, u), lerp(1.4, 1.3, u), [bodies[0]]),
      (u) => F(sStall, lerp(-0.25, -0.4, u), lerp(0.62, 0.5, u), 1.1, [stall]),
      (u) => street(u, 2, 1.3, -0.4),
    ],
    break: [
      (u, T) => ({ ...F(sL[1], -0.4 + 0.25 * u, -0.38, wide ? 2.6 : 2.2, [bodies[1]]), }),
      (u) => F(sL[1], lerp(0.9, 1.2, u), lerp(-0.55, -0.45, u), wide ? 2.2 : 1.6, [bodies[1]]),
      (u) => street(u, 1, 1.1, 0.0),
    ],
    rise: [
      (u) => street(u, 1, lerp(1.2, 1.8, ease.inOut(u)), 0.1),
    ],
    drop2: [
      (u) => street(u, 1, 1.5, 0.3),
      (u) => up(u, 1),
      (u) => F(sBowls, lerp(-0.6, -0.75, u), lerp(0.56, 0.5, u), lerp(1.18, 1.1, u), stall.userData.cones.slice(0, 3).map((c) => c.bowl)),
      (u) => street(u, 2, 1.25, -0.35),
      (u) => up(u, 2),
      (u) => F(sStall, lerp(-0.4, -0.28, u), lerp(0.48, 0.55, u), 1.1, [stall]),
    ],
    outro: [
      (u) => street(u, 1, lerp(1.4, 1.75, u), 0.0),
    ],
  };
  const shots = directShots({ plan, sections, bank, every: { intro: 4, light: wide ? 4 : 2, drop: wide ? 8 : 4, break: wide ? 8 : 4, rise: 4, drop2: wide ? 8 : 2, outro: 16 } });
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.05, 200);
  const heroes = [bodies[1]];

  const sunTint = new THREE.Color(), gold = new THREE.Color('#ffc27a'), rose = new THREE.Color('#ff7a6a');
  const swing = (i, T) => (T >= D2 && T < OUT ? 0.07 : T >= D1 && T < BR ? 0.025 : 0.012) * Math.sin((T / (2 * bar)) * Math.PI * 2 - i * 0.7);
  const lampLevel = (i, T, kick, hit) => {
    if (T < D1 - 0.05) return 0.04 + 0.02 * hit;
    const on = D1 + i * beat;
    if (T < BR) return T < on ? 0.04 : Math.min(1, (T - on) / 0.12) * (0.95 + 0.4 * kick);
    if (T < RI) {
      if (i === 1) return 1.0 + 0.25 * hit;
      return lerp(0.95, 0.06, smooth(seg(T, BR, BR + 2 * bar)));
    }
    if (T < D2) {
      // flickering back: on with a probability that grows towards the drop
      const g = seg(T, RI, D2);
      const flick = Math.sin(T * 37 + i * 11) * 0.5 + 0.5 > 1 - g ? 1 : 0.15;
      return i === 1 ? 1.05 + 0.3 * hit : 0.1 + 0.85 * flick * g;
    }
    if (T < OUT) return 1.25 + 0.5 * kick;
    // the outro: out from the far end
    const off = OUT + ((BAYS - 1 - i) / BAYS) * (END - OUT) * 0.9;
    return i <= 1 ? lerp(1.15, 0.9, seg(T, OUT, END)) + 0.2 * hit : (T < off ? 1.1 + 0.2 * hit : lerp(1.1, 0.0, seg(T, off, off + 0.6)));
  };
  const tmpD = new THREE.Vector3(), q = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);

  function update(t) {
    const T = a0 + t;
    const hit = s.hit(t), kick = s.kick(t), loud = s.slow(t);
    const inDrop = (T >= D1 && T < BR) || (T >= D2 && T < OUT);
    // the sun: gold until the breakdown, rose as it sets, gone at night
    const set = smooth(seg(T, BR, BR + 4 * bar));
    const sunK = T < BR ? 1 : (1 - set) * 0.9;
    sunTint.copy(gold).lerp(rose, set);
    A.sun(sunK * (1 + 0.15 * hit), sunTint);
    sun.color.copy(sunTint);
    sun.intensity = 3.4 * sunK * (1 + 0.25 * hit);
    const night = smooth(seg(T, BR + 2 * bar, RI));
    fill.color.set('#8a5a34').lerp(new THREE.Color('#3a3046'), night);
    fill.intensity = lerp(0.9, 0.55, night) * (1 + 0.3 * hit);
    // the lanterns
    for (let i = 0; i < BAYS; i++) {
      const lv = lampLevel(i, T, kick, hit);
      lanterns[i].userData.light(lv);
      lanterns[i].rotation.z = swing(i, T);
      lanterns[i].rotation.x = 0.5 * swing(i + 3, T);
      lanterns[i].rotation.y = i * 0.7 + (i === 1 && T >= BR && T < D2 ? (T - BR) * 0.22 : 0);
      if (i < lampLights.length) lampLights[i].intensity = 7 * lv;
    }
    // the stars thrown by lantern 1, on in the breakdown and the rise (they turn with it)
    const spotK = smooth(seg(T, BR + bar, BR + 3 * bar)) * (1 - smooth(seg(T, D2 + bar, D2 + 3 * bar)));
    spots.visible = spotK > 0.002;
    if (spots.visible) {
      q.setFromAxisAngle(yAxis, lanterns[1].rotation.y);
      for (let h = 0; h < holes.length; h++) {
        tmpD.copy(holes[h]).applyQuaternion(q);
        const p = A.hit(lampCentre, tmpD) ?? lampCentre;
        spotPos[h * 3] = p.x; spotPos[h * 3 + 1] = p.y; spotPos[h * 3 + 2] = p.z;
        const dd = p.distanceTo(lampCentre);
        const b = spotK * (0.9 + 0.35 * hit) * Math.min(1.4, 2.4 / (0.6 + dd));
        spotCol[h * 3] = 1.0 * b; spotCol[h * 3 + 1] = 0.62 * b; spotCol[h * 3 + 2] = 0.28 * b;
      }
      spotGeo.attributes.position.needsUpdate = true;
      spotGeo.attributes.color.needsUpdate = true;
    }
    // the motes in the shafts (only while the sun is in)
    for (let m = 0; m < NM; m++) {
      const d = motes[m], b = A.bays[d.b];
      const yy = ((d.y + T * d.sp * 0.4) % 4.6) + 0.3;
      moteP[m * 3] = d.x + 0.12 * Math.sin(T * 0.3 + d.ph) + (4.6 - yy) * 0.12;
      moteP[m * 3 + 1] = yy;
      moteP[m * 3 + 2] = b.z + d.z + (4.6 - yy) * 0.33;
      const g = sunK * (0.35 + 0.5 * Math.sin(T * 0.7 + d.ph) ** 2) * (1 + 0.6 * hit);
      moteC[m * 3] = 1.0 * g; moteC[m * 3 + 1] = 0.75 * g; moteC[m * 3 + 2] = 0.45 * g;
    }
    moteGeo.attributes.position.needsUpdate = true;
    moteGeo.attributes.color.needsUpdate = true;
    moteMesh.visible = sunK > 0.01;
    dust.userData.update(t);
    // the camera
    const punch = [D1, D2].reduce((a, d) => a + (T >= d && T < d + 1 ? Math.exp(-(T - d) / 0.3) : 0), 0);
    const wob = shake(T, 0.006 + 0.05 * punch + (inDrop ? 0.01 * kick : 0), 6);
    const pose = shots.apply(camera, t, wob);
    heroes.length = 0;
    heroes.push(...pose.heroes);
    const pre = (T >= D1 - 1.6 && T < D1) || (T >= D2 - 1.6 && T < D2) ? 0.8 : 1;
    void loud;
    return {
      // the picture breathes on every hit (the beat's light), harder in the drops
      exposure: look.exposure * pre * (1 + 0.45 * punch) * (1 + (inDrop ? 0.24 : 0.16) * hit),
      bloom: look.bloom.strength * (1 + 0.8 * punch + (inDrop ? 0.35 * kick : 0.1 * hit)),
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
void joinSpheres;
