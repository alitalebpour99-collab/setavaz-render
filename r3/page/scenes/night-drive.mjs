// «Night Drive»: not a road seen from above, but the inside of a car at night. The gauges glow amber, a charm hangs
// from the mirror (a gold Setavaz star and a blue nazar bead), and the street lamps' orange light runs over the
// dashboard as they pass. The car's speed is the music's:
// - in the drops it passes one lamp on every beat, so the light sweeps the cabin in time, and the charm swings;
// - in the breakdown the car slows and stops at a red light: the lamps stand still, the cabin goes red and quiet, the
//   charm settles; on the second drop the light turns green and the car pulls away;
// - at the end it slows down and the lamps thin out.
// The speed, the distance and the charm's swing are worked out from the track's sections once, so any frame can be
// drawn on its own.
import * as THREE from 'three';
import { makeCluster, makeDashboard, makeMirrorCharm, makeSteeringWheel } from '../../library/models/car.mjs';
import { glowTexture } from '../../library/textures/data.mjs';
import { makeSkyDome } from '../../library/sets/night.mjs';
import { rng } from '../../library/util/noise.mjs';
import { clamp, directShots, ease, fitPose, fovFor, joinSpheres, lerp, seg, shake, smooth, soundOf, sphereOf, trackMarks } from '../kit.mjs';

export const look = { bloom: { strength: 0.55, radius: 0.65, threshold: 0.85 }, exposure: 1.4 };
export const env = { base: '#0a0a12', panels: [{ dir: [0, 0.6, -1], colour: '#ff9a40', power: 0.8, size: 14 }, { dir: [0.4, 1, 0.3], colour: '#5a6aa8', power: 0.9, size: 10 }] };

const S = 10; // the car is drawn ten times its size (metres to decimetres)
const SPACING = 24; // metres between street lamps

export function build({ plan }) {
  const s = soundOf(plan);
  const { L, a0, beat, bar } = plan;
  const M = trackMarks(plan);
  const D1 = M.drop1 ?? 18, BR = M.break ?? 81.5, D2 = M.drop2 ?? 105.75, OUT = M.outro ?? 154, END = M.end ?? 160;
  const wide = plan.format === 'long';

  // ---- the drive, from the sections: speed in metres a second, distance, and the charm's pendulum ----
  const vFast = SPACING / beat; // a lamp each beat
  const vCalm = SPACING / bar; // a lamp each bar
  const speedAt = (T) => {
    if (T < D1) return vCalm * (0.6 + 0.4 * seg(T, 0, D1 - 2));
    if (T < BR - 1.5) return vFast;
    if (T < BR + 3) return lerp(vFast, 0, ease.inOut(seg(T, BR - 1.5, BR + 3)));
    if (T < D2) return 0;
    if (T < OUT) return lerp(0, vFast, ease.out(seg(T, D2, D2 + 1.6)));
    return lerp(vFast, vCalm * 0.3, ease.inOut(seg(T, OUT, END + 1)));
  };
  const DT = 0.01, total = Math.max(END + 10, a0 + L + 2);
  const dist = new Float64Array(Math.ceil(total / DT) + 2);
  for (let i = 1; i < dist.length; i++) dist[i] = dist[i - 1] + speedAt(i * DT) * DT;
  const distAt = (T) => { const x = clamp(T / DT, 0, dist.length - 1); const i = Math.floor(x); return lerp(dist[i], dist[Math.min(dist.length - 1, i + 1)], x - i); };
  // the charm: a damped pendulum pushed by the car's speeding up and slowing down, the road's soft bends and the kicks
  const swing = (() => {
    const n = Math.ceil((L + 0.1) / DT);
    const ax = new Float32Array(n), az = new Float32Array(n);
    let x = 0, vx = 0, z = 0, vz = 0;
    const w0 = 2 * Math.PI * 1.1, damp = 1.1;
    const kicks = s.kicks.map((o) => o.t);
    let kI = 0;
    for (let i = 0; i < n; i++) {
      const t = i * DT, T = a0 + t;
      const acc = (speedAt(T + DT) - speedAt(T)) / DT;
      const bend = speedAt(T) > 1 ? 0.6 * Math.sin(T * 0.37) + 0.3 * Math.sin(T * 0.91 + 1) : 0;
      let push = 0;
      while (kI < kicks.length && kicks[kI] <= t) { push += 1; kI++; }
      vx += (-w0 * w0 * x - damp * vx - 0.05 * acc) * DT;
      vz += (-w0 * w0 * z - damp * vz + 0.6 * bend * (speedAt(T) / vFast)) * DT + push * 0.22 * (i % 2 ? 1 : -1) * (T >= D1 && T < BR || T >= D2 && T < OUT ? 1 : 0.3);
      x += vx * DT; z += vz * DT;
      ax[i] = clamp(x, -0.5, 0.5); az[i] = clamp(z, -0.5, 0.5);
    }
    return (t) => { const i = clamp(Math.round(t / DT), 0, n - 1); return [ax[i], az[i]]; };
  })();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05050b');
  scene.fog = new THREE.Fog('#0b0a14', 60, 900);

  // ---- outside: the road, the lamps, the far city ----
  // the night sky over the road: deep blue at the top, a warm city haze at the horizon
  scene.add(makeSkyDome({ top: '#03030c', horizon: '#2a1f3a', bottom: '#050508', radius: 2600 }));
  const road = new THREE.Mesh(new THREE.PlaneGeometry(400, 4000), new THREE.MeshStandardMaterial({ color: '#07070a', roughness: 0.92, metalness: 0.0 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -2, -2000);
  road.receiveShadow = false;
  scene.add(road);
  const lampGlowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(2.4, 1.2, 0.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const LAMPS = 14;
  const lamps = [];
  for (let side of [-1, 1]) for (let i = 0; i < LAMPS; i++) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 90, 8), new THREE.MeshStandardMaterial({ color: '#2a2a30', roughness: 0.6, metalness: 0.5 }));
    pole.position.y = 43;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 1.2), pole.material);
    arm.position.set(-side * 10, 88, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 3), new THREE.MeshStandardMaterial({ color: '#ffb060', emissive: '#ffa040', emissiveIntensity: 4 }));
    head.position.set(-side * 20, 87, 0);
    const glow = new THREE.Sprite(lampGlowMat);
    glow.scale.setScalar(34);
    glow.position.copy(head.position);
    g.add(pole, arm, head, glow);
    g.position.set(side * 75, -20, 0);
    g.userData.side = side;
    g.userData.i = i;
    scene.add(g);
    lamps.push(g);
  }
  // the city far off: out-of-focus lights in warm and cool colours, sliding slowly by
  const r = rng(122);
  const cityN = 260;
  const cityPos = new Float32Array(cityN * 3), cityCol = new Float32Array(cityN * 3), cityBase = [];
  for (let i = 0; i < cityN; i++) {
    const side = r() < 0.5 ? -1 : 1;
    cityBase.push({ x: side * (140 + 900 * r()), y: -10 + 160 * Math.pow(r(), 2), z: -r() * 3000, k: 0.4 + 0.6 * r() });
    const warm = r() < 0.7;
    const c = warm ? [1.4, 0.75, 0.35] : [0.5, 0.7, 1.3];
    cityCol.set(c.map((q) => q * (0.4 + 0.6 * r())), i * 3);
  }
  const cityGeo = new THREE.BufferGeometry();
  cityGeo.setAttribute('position', new THREE.BufferAttribute(cityPos, 3));
  cityGeo.setAttribute('color', new THREE.BufferAttribute(cityCol, 3));
  const city = new THREE.Points(cityGeo, new THREE.PointsMaterial({ size: 26, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }));
  city.frustumCulled = false;
  scene.add(city);
  // the traffic light ahead, over the road: red while the car waits, then green
  const signal = new THREE.Group();
  const signalBox = new THREE.Mesh(new THREE.BoxGeometry(5, 14, 4), new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.5 }));
  const redMat = new THREE.MeshStandardMaterial({ color: '#300', emissive: '#ff2a1a', emissiveIntensity: 0 });
  const greenMat = new THREE.MeshStandardMaterial({ color: '#030', emissive: '#22ff88', emissiveIntensity: 0 });
  const red = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), redMat); red.position.set(0, 4, 2.05);
  const green = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), greenMat); green.position.set(0, -4, 2.05);
  const redGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(3, 0.3, 0.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  redGlow.scale.setScalar(30); redGlow.position.copy(red.position);
  const greenGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(0.3, 3, 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  greenGlow.scale.setScalar(30); greenGlow.position.copy(green.position);
  signal.add(signalBox, red, green, redGlow, greenGlow);
  scene.add(signal);

  // ---- inside: the car at its real size, scaled ----
  const car = new THREE.Group();
  car.scale.setScalar(S);
  scene.add(car);
  const dash = makeDashboard(1.6);
  dash.position.set(0, 1.0, -0.58); // its face stops just behind the cluster, which stands proud of it
  const cluster = makeCluster();
  cluster.position.set(-0.37, 0.93, 0.0);
  cluster.rotation.x = -0.12;
  const wheel = makeSteeringWheel();
  wheel.position.set(-0.37, 0.82, 0.24);
  wheel.rotation.x = -0.38;
  const mirror = makeMirrorCharm();
  mirror.position.set(0.02, 1.58, -0.36);
  mirror.rotation.y = -0.32;
  // the frame of the windscreen: two pillars and the roof's edge, the windscreen's faint glass
  // slim rounded pillars and a soft headliner, dark, so they frame the glass without looking like planks
  const trim = new THREE.MeshStandardMaterial({ color: '#0b0b0e', roughness: 0.7 });
  const pillarL = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.72, 6, 16), trim);
  pillarL.position.set(-0.8, 1.3, -0.66); pillarL.rotation.x = -0.75; pillarL.rotation.z = 0.12;
  const pillarR = pillarL.clone(); pillarR.position.x = 0.8; pillarR.rotation.z = -0.12;
  const roof = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 1.5, 6, 16), trim);
  roof.rotation.z = Math.PI / 2;
  roof.position.set(0, 1.6, -0.4);
  // a fine chrome line along the dashboard's edge
  const edge = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.004, 0.004), new THREE.MeshStandardMaterial({ color: '#cfd3da', metalness: 1, roughness: 0.2 }));
  edge.position.set(0, 0.995, -0.058);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.66), new THREE.MeshPhysicalMaterial({ color: '#9fb0cc', transparent: true, opacity: 0.05, roughness: 0.05, metalness: 0, clearcoat: 1, depthWrite: false }));
  screen.position.set(0, 1.3, -0.69); screen.rotation.x = -0.75;
  car.add(dash, cluster, wheel, mirror, pillarL, pillarR, roof, screen, edge);
  const [speedo, tacho] = cluster.userData.gauges;

  // ---- light ----
  const lampLight = [new THREE.PointLight('#ffb878', 0, 260, 1.4), new THREE.PointLight('#ffb878', 0, 260, 1.4)];
  for (const l of lampLight) scene.add(l);
  const signalLight = new THREE.PointLight('#ff2a1a', 0, 400, 1.2);
  scene.add(signalLight);
  const dashGlow = new THREE.PointLight('#ffb070', 1.2, 14, 1.6);
  dashGlow.position.set(-3.7, 9.4, 1.6);
  const moon = new THREE.DirectionalLight('#8090e0', 1.1);
  moon.position.set(20, 60, -30);
  // the cabin's own soft light (the city's glow through the glass), so the shapes read in the dark
  const cabin = new THREE.PointLight('#8f9cd8', 1.6, 30, 1.5);
  cabin.position.set(0, 15, 6);
  scene.add(dashGlow, moon, cabin, new THREE.HemisphereLight('#3a4070', '#120e14', 1.0));
  scene.environmentIntensity = 0.6;

  // ---- the camera ----
  const sections = [
    { type: 'intro', from: 0, to: D1 },
    { type: 'drop', from: D1, to: BR },
    { type: 'break', from: BR, to: D2 },
    { type: 'drop2', from: D2, to: OUT },
    { type: 'outro', from: OUT, to: Math.max(END, a0 + L) + 30 },
  ];
  const fov = fovFor(plan, 40, 30);
  // the camera frames its object whatever the shape of the video: a sphere round it, a side, a height, a distance
  car.updateMatrixWorld(true);
  const sCluster = sphereOf([cluster], 0.05);
  mirror.userData.swing(0.5, 0.5);
  const sMirror = joinSpheres(sphereOf([mirror], 0.05), (mirror.userData.swing(-0.5, -0.5), sphereOf([mirror], 0.05)));
  mirror.userData.swing(0, 0);
  const sBoth = joinSpheres(sCluster, sMirror);
  const aspect = plan.w / plan.h;
  const F = (sp, az, el, k, heroes, shift) => ({ ...fitPose(sp, { az, el, k, fov, aspect, shift }), heroes });
  // the shots: the gauges through the wheel, the charm close, the charm from below against the lit windscreen, the wheel
  // and gauges from the left
  const gauges = (u, az0, az1) => F(sCluster, lerp(az0, az1, u), lerp(0.1, 0.06, u), lerp(1.3, 1.2, u), [cluster]);
  const charm = (u, az0, az1) => F(sMirror, lerp(az0, az1, u), lerp(0.02, -0.03, u), lerp(1.35, 1.22, u), [mirror]);
  const below = (u) => F(sMirror, lerp(0.25, 0.1, u), lerp(-0.42, -0.36, u), lerp(2.3, 2.1, u), [mirror]);
  const side = (u) => F(sCluster, lerp(-0.55, -0.42, u), lerp(0.2, 0.16, u), lerp(1.55, 1.45, u), [cluster]);
  const bank = {
    intro: [(u) => gauges(u, 0.1, -0.02), (u) => below(u)],
    drop: [(u) => gauges(u, 0.25, 0.12), (u) => charm(u, 0.7, 0.5), (u) => side(u), (u) => below(u)],
    break: [(u) => charm(u, 0.35, 0.25), (u) => below(u)],
    drop2: [(u) => charm(u, 0.7, 0.5), (u) => gauges(u, -0.25, -0.12), (u) => below(u), (u) => side(u)],
    outro: [(u) => gauges(u, 0.0, 0.1)],
  };
  void sBoth;
  const shots = directShots({ plan, sections, bank, every: { intro: 8, drop: wide ? 8 : 4, break: 8, drop2: wide ? 8 : 4, outro: 16 } });
  const camera = new THREE.PerspectiveCamera(fov, plan.w / plan.h, 0.05, 6000);
  const heroes = [cluster];

  function update(t) {
    const T = a0 + t;
    const hit = s.hit(t), kick = s.kick(t), loud = s.slow(t);
    const v = speedAt(T), D = distAt(T);
    const inDrop = (T >= D1 && T < BR) || (T >= D2 && T < OUT);
    // the lamps: in two rows, every SPACING metres, sliding past as the car goes
    let near = [null, null];
    for (const g of lamps) {
      // metres behind the driver (negative: ahead); lamp 1 is overhead once in each SPACING
      const off = (D % SPACING) - g.userData.i * SPACING + SPACING * 0.5;
      g.position.z = off * S;
      const k = g.userData.side < 0 ? 0 : 1;
      const dz = Math.abs(off - 1.0);
      if (!near[k] || dz < near[k].dz) near[k] = { dz, g, off };
    }
    for (let k = 0; k < 2; k++) {
      const n = near[k];
      const l = lampLight[k];
      l.position.set(n.g.userData.side * 55, 67, n.g.position.z);
      // brightest as the lamp goes over the windscreen, a little brighter on the kick
      const over = Math.exp(-Math.pow((n.off - 0.5) / 7, 2));
      l.intensity = (v > 0.5 ? 1 : 0.6) * (1400 * over + 60) * (1 + (inDrop ? 0.3 * kick : 0));
    }
    // the far city slides by slowly
    for (let i = 0; i < cityN; i++) {
      const b = cityBase[i];
      const z = ((((b.z + D * S * b.k * 0.35) % 3000) + 3000) % 3000) - 3000;
      cityPos[i * 3] = b.x; cityPos[i * 3 + 1] = b.y; cityPos[i * 3 + 2] = z - 300;
    }
    cityGeo.attributes.position.needsUpdate = true;
    // the signal: red as the car comes to a stop, green on the second drop
    const waiting = T >= BR && T < D2;
    const sigZ = -(Math.max(0, distAt(BR + 3) - D) + 30) * S;
    signal.visible = T >= BR - 4 && T < D2 + 2.5;
    signal.position.set(-40, 140, sigZ);
    const redK = waiting ? smooth(seg(T, BR - 1, BR + 0.5)) * (1 - smooth(seg(T, D2 - 0.12, D2))) : 0;
    const greenK = T >= D2 - 0.1 ? 1 - smooth(seg(T, D2 + 1.6, D2 + 2.5)) : 0;
    redMat.emissiveIntensity = 6 * redK; greenMat.emissiveIntensity = 6 * greenK;
    redGlow.material.opacity = redK; greenGlow.material.opacity = greenK;
    signalLight.position.set(-40, 140, sigZ + 30);
    signalLight.color.set(greenK > redK ? '#22ff88' : '#ff2a1a');
    signalLight.intensity = 1500 * Math.max(redK, greenK) * (1 + 0.15 * s.loud(t));
    // the gauges: speed, and the rev needle that jumps with the kicks
    speedo.userData.needle(0.06 + 0.78 * (v / vFast) + 0.01 * Math.sin(T * 3));
    tacho.userData.needle((v > 0.2 ? 0.3 + 0.25 * (v / vFast) : 0.12) + 0.32 * kick * (inDrop ? 1 : 0.4) + 0.05 * loud);
    for (const g of [speedo, tacho]) g.userData.light(0.6 + 0.4 * loud + (inDrop ? 0.5 * kick : 0));
    dashGlow.intensity = 1.6 + 1.0 * loud + (inDrop ? 2.0 * kick : 0.4 * hit);
    // the charm
    const [sx, sz] = swing(t);
    mirror.userData.swing(sx, sz);
    // the camera
    const punch = [D1, D2].reduce((a, d) => a + (T >= d && T < d + 1 ? Math.exp(-(T - d) / 0.3) : 0), 0);
    const road = v > 0.5 ? 0.01 + 0.006 * (v / vFast) : 0.004;
    const wob = shake(T, road + 0.05 * punch + (inDrop ? 0.012 * kick : 0), 9);
    const pose = shots.apply(camera, t, wob);
    heroes.length = 0;
    heroes.push(...pose.heroes);
    const pre = (T >= D1 - 1.2 && T < D1) || (T >= D2 - 1.2 && T < D2) ? 0.85 : 1;
    return {
      exposure: look.exposure * pre * (1 + 0.5 * punch) * (waiting ? 1.05 : 1),
      bloom: look.bloom.strength * (1 + 0.8 * punch + (inDrop ? 0.3 * kick : 0)),
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
