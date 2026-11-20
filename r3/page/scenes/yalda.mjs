// «Yalda»: a Yalda-night table under the open sky, on a crimson termeh cloth: a candle in brass, a book of poems lying
// open, a glass of tea, two pomegranates. The idea: the longest night, kept warm until the sun comes back.
// - Intro and build: the candle burns, the camera comes in over the table; on the build the pomegranate trembles.
// - First drop: the pomegranate breaks open and its seeds leap out, glowing, and hang in the air above the table.
// - Breakdown: the seeds float like a red constellation; a page of the book turns; the flame is calm.
// - Rise: the seeds gather into a ring round the candle.
// - Second drop: the ring turns round the flame like a small sun, pulsing with every kick.
// - Outro: the ring climbs and opens, the sky behind goes from night to dawn: the sun is back.
// Everything is a function of the track's time (so a Short and the long video show the same moment the same way).
import * as THREE from 'three';
import { makeOpeningPomegranate, makePomegranate, arilGeometry, arilMaterial, POM } from '../../library/models/pomegranate.mjs';
import { makeLitCandle, CANDLE } from '../../library/models/candle.mjs';
import { makeOpenBook } from '../../library/models/book.mjs';
import { makeTeaGlass } from '../../library/models/tea-glass.mjs';
import { makeSparks } from '../../library/effects/sparks.mjs';
import { makeSkyDome, makeStars } from '../../library/sets/night.mjs';
import { glowTexture } from '../../library/textures/data.mjs';
import { termehTexture } from '../../library/textures/table.mjs';
import { fbm3, rng } from '../../library/util/noise.mjs';
import { clamp, directShots, ease, fovFor, lerp, orbit, seg, shake, smooth, soundOf, trackMarks } from '../kit.mjs';

export const look = { bloom: { strength: 0.42, radius: 0.6, threshold: 0.95 }, exposure: 1.05 };
export const env = { base: '#120b14', panels: [{ dir: [0.2, 1, 0.3], colour: '#ffb070', power: 1.4, size: 8 }, { dir: [-0.6, 0.4, -0.8], colour: '#3a3f8a', power: 1.2, size: 12 }] };

const S = 10; // the table is drawn ten times its size (metres to decimetres), so its lights read like the other worlds'
const CANDLE_AT = [0, 0, -0.05], POM_AT = [0.13, 0, 0.07], POM2_AT = [0.24, 0, -0.13], BOOK_AT = [-0.2, 0, 0.06], GLASS_AT = [-0.05, 0, 0.19];

export function build({ plan }) {
  const s = soundOf(plan);
  const { L, a0 } = plan;
  const M = trackMarks(plan);
  const D1 = M.drop1 ?? 32, BR = M.break ?? 78, RI = M.rise ?? 112, D2 = M.drop2 ?? 128, OUT = M.outro ?? 156, END = M.end ?? 163;
  const BUILD = M.build ?? D1 - 16;
  const T = (t) => a0 + t;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#100a1c', 18, 60);
  const skyNight = { top: new THREE.Color('#04041a'), horizon: new THREE.Color('#1c1236'), bottom: new THREE.Color('#0a0714') };
  const skyDawn = { top: new THREE.Color('#1d2a66'), horizon: new THREE.Color('#ff9b5c'), bottom: new THREE.Color('#2a1420') };
  const sky = makeSkyDome({ top: '#04041a', horizon: '#1c1236', bottom: '#0a0714', radius: 80 });
  const skyCol = sky.geometry.attributes.color, skyY = sky.geometry.attributes.position;
  const stars = makeStars({ n: 420, radius: 70, seed: 19, minY: 0.05 });
  scene.add(sky, stars);
  // the sun of the dawn: a warm disc low behind the table, under the horizon until the outro
  const sun = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.9, 0.45), fog: false }));
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(1.4, 0.7, 0.35), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sunGlow.scale.setScalar(26);
  const sunGroup = new THREE.Group();
  sunGroup.add(sunGlow, sun);
  sunGroup.position.set(-6, -8, -62);
  scene.add(sunGroup);

  // the table: the cloth, and everything on it at its real size, scaled
  const table = new THREE.Group();
  table.scale.setScalar(S);
  scene.add(table);
  const cloth = termehTexture().clone();
  cloth.repeat.set(5, 5);
  cloth.needsUpdate = true;
  const clothMesh = new THREE.Mesh(new THREE.CircleGeometry(1.6, 72), new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.78, metalness: 0.05 }));
  clothMesh.rotation.x = -Math.PI / 2;
  clothMesh.receiveShadow = true;
  table.add(clothMesh);
  const candle = makeLitCandle();
  candle.position.set(...CANDLE_AT);
  const pom = makeOpeningPomegranate({ seed: 3 });
  pom.group.position.set(...POM_AT);
  pom.group.rotation.y = -0.5;
  const pom2 = makePomegranate({ seed: 8 });
  pom2.position.set(...POM2_AT);
  pom2.rotation.set(0.25, 1.2, 0.1);
  pom2.scale.setScalar(0.92);
  const book = makeOpenBook();
  book.position.set(...BOOK_AT);
  book.rotation.y = 0.42;
  const glass = makeTeaGlass();
  glass.position.set(...GLASS_AT);
  table.add(candle, pom.group, pom2, book, glass);

  // lights: the candle (warm, it breathes with the music), a cool sky from behind, a faint warm fill
  const flameLight = new THREE.PointLight('#ff9a48', 6, 30, 1.6);
  const tip = candle.userData.tip.clone().add(new THREE.Vector3(...CANDLE_AT)).multiplyScalar(S);
  flameLight.position.copy(tip).add(new THREE.Vector3(0, 0.25, 0));
  // the flame's shadows: a wide cone from the flame straight down (one shadow pass, not a point light's six)
  const flameShadow = new THREE.SpotLight('#ff9a48', 2.5, 30, 1.3, 0.8, 1.6);
  flameShadow.position.copy(flameLight.position);
  flameShadow.target.position.set(tip.x, 0, tip.z + 0.01);
  flameShadow.castShadow = true;
  flameShadow.shadow.mapSize.set(1024, 1024);
  flameShadow.shadow.bias = -0.001; flameShadow.shadow.radius = 5;
  flameShadow.shadow.camera.near = 0.2; flameShadow.shadow.camera.far = 12;
  scene.add(flameShadow, flameShadow.target);
  const moon = new THREE.DirectionalLight('#7f8cff', 0.7);
  moon.position.set(-8, 14, -12);
  const fill = new THREE.HemisphereLight('#3b2c5c', '#2a0d10', 0.55);
  const dawn = new THREE.DirectionalLight('#ffb27a', 0);
  dawn.position.set(-6, 3, -20);
  scene.add(flameLight, moon, fill, dawn);
  scene.environmentIntensity = 0.55;

  // the seeds that fly: real 3D seeds (instanced) and a soft glow at each (points), on closed-form paths
  const N = 150;
  const r = rng(1119);
  const seedsMesh = new THREE.InstancedMesh(arilGeometry(), arilMaterial(), N);
  seedsMesh.material.emissiveIntensity = 1.2;
  seedsMesh.frustumCulled = false;
  table.add(seedsMesh);
  const glowGeo = new THREE.BufferGeometry();
  const glowPos = new Float32Array(N * 3), glowCol = new Float32Array(N * 3);
  glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  glowGeo.setAttribute('color', new THREE.BufferAttribute(glowCol, 3));
  const glows = new THREE.Points(glowGeo, new THREE.PointsMaterial({ size: 0.022, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  glows.frustumCulled = false;
  table.add(glows);
  const centre = new THREE.Vector3(CANDLE_AT[0], 0, CANDLE_AT[2]);
  const fruitTop = new THREE.Vector3(POM_AT[0], POM.cut + 0.004, POM_AT[2]);
  const seeds = Array.from({ length: N }, (_, i) => {
    const a = r() * Math.PI * 2, rad = 0.1 + 0.32 * Math.sqrt(r()), y = 0.1 + 0.34 * r();
    return {
      from: fruitTop.clone().add(new THREE.Vector3((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.04)),
      hover: new THREE.Vector3(centre.x + Math.cos(a) * rad, y, centre.z + Math.sin(a) * rad * 0.8),
      delay: r() * 0.35, ring: (i / N) * Math.PI * 2, lane: (r() - 0.5) * 0.03, seed: r() * 100, spin: new THREE.Euler(r() * 6, r() * 6, r() * 6), size: 0.8 + 0.5 * r(),
    };
  });
  const tmp = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), mat4 = new THREE.Matrix4(), e = new THREE.Euler();
  const ringAt = (sd, TT, radius, height, speed) => tmp.set(centre.x + Math.cos(sd.ring + speed) * radius, height + sd.lane + 0.012 * Math.sin(sd.ring * 3 + TT * 2), centre.z + Math.sin(sd.ring + speed) * radius);
  function seedPos(sd, TT, t) {
    if (TT < D1 - 0.05) return null;
    const out = new THREE.Vector3();
    const drift = (k) => out.set(Math.sin(TT * 0.6 + sd.seed) * 0.012 * k, Math.sin(TT * 0.8 + sd.seed * 2) * 0.01 * k, Math.cos(TT * 0.5 + sd.seed) * 0.012 * k);
    const age = TT - D1 - sd.delay;
    if (age < 0) return null;
    const ringSpeed = (TT - RI) * 0.35 + Math.max(0, TT - D2) * 0.9;
    if (TT < RI) {
      // out of the fruit with a leap, then hanging in the air and drifting
      const k = ease.out(age / 1.5);
      const p = sd.from.clone().lerp(sd.hover, k);
      p.y += Math.sin(Math.min(1, age / 1.5) * Math.PI) * 0.08;
      return p.add(drift(seg(age, 0.5, 2.5)));
    }
    const ringR = TT < D2 ? 0.17 : 0.17 * (1 + 0.14 * s.kick(t));
    const ringH = 0.21 + (TT >= OUT ? 0.5 * ease.inOut(seg(TT, OUT, END)) : 0);
    const radius = ringR + (TT >= OUT ? 0.55 * ease.inOut(seg(TT, OUT, END)) : 0);
    const target = ringAt(sd, TT, radius, ringH, ringSpeed).clone();
    const k = ease.inOut(seg(TT, RI + sd.delay * 2, D2 - 0.5));
    return sd.hover.clone().add(drift(1)).lerp(target, k);
  }

  // sparks: a red-gold spray on each drop, embers that climb in the second drop
  const bursts = [];
  const rs = rng(7);
  const spray = (TT, n, speed) => bursts.push({ t: TT - a0, n, origin: [POM_AT[0] * S, POM.cut * S, POM_AT[2] * S], speed, spread: 0.7, up: 0.6, life: 2.2, jitter: 0.1, seed: Math.round(TT * 10), tint: [1, 0.25, 0.18] });
  spray(D1, 260, 3.2);
  if (M.drop1b) spray(M.drop1b, 120, 2.4);
  for (const o of s.kicks) {
    const TT = a0 + o.t;
    if (TT >= D2 && TT < OUT) bursts.push({ t: o.t, n: 5, origin: [(rs() - 0.5) * 2, tip.y + 0.6, CANDLE_AT[2] * S + (rs() - 0.5) * 2], speed: 1.2, spread: 0.5, up: 0.7, life: 2.6, seed: 300 + Math.round(TT * 10), tint: [1, 0.6, 0.25] });
  }
  const sparks = makeSparks(bursts.filter((b) => b.t > -4 && b.t < L + 1), { size: 0.11 });
  scene.add(sparks);

  // the sections and the camera
  const sections = [
    { type: 'intro', from: 0, to: BUILD },
    { type: 'build', from: BUILD, to: D1 },
    { type: 'drop', from: D1, to: BR },
    { type: 'break', from: BR, to: RI },
    { type: 'rise', from: RI, to: D2 },
    { type: 'drop2', from: D2, to: OUT },
    { type: 'outro', from: OUT, to: Math.max(END, a0 + L) + 30 },
  ];
  const wide = plan.format === 'long';
  const fov = fovFor(plan, 34, 26);
  const C = [CANDLE_AT[0] * S, 0, CANDLE_AT[2] * S];
  const P = [POM_AT[0] * S, 0.45, POM_AT[2] * S];
  const B = [BOOK_AT[0] * S, 0.15, BOOK_AT[2] * S];
  const all = [candle, pom.group, book, glass];
  const near = [candle, pom.group];
  const bank = {
    intro: [
      (u) => ({ ...orbit([C[0], 1.3, C[2]], lerp(wide ? 9.2 : 8.4, wide ? 8.4 : 7.6, u), lerp(0.35, 0.12, u), 0.16, fov), heroes: [candle] }),
      (u) => ({ ...orbit([0.4, 1.0, 0.4], lerp(wide ? 9.5 : 12.5, wide ? 8.6 : 11.5, u), lerp(-0.25, 0.05, u), 0.42, fov), heroes: wide ? all : near }),
    ],
    build: [
      (u) => ({ ...orbit([P[0] - 0.2, 0.55, P[2]], lerp(5.2, 4.2, ease.in(u)), lerp(0.75, 0.55, u), 0.32, fov), heroes: [pom.group] }),
      (u) => ({ ...orbit([0.5, 1.0, 0.3], lerp(wide ? 10.5 : 12, wide ? 9.6 : 11, u), lerp(0.6, 0.35, u), 0.36, fov), heroes: near }),
    ],
    drop: [
      (u) => ({ ...orbit([0.4, 1.7, 0.2], lerp(wide ? 11 : 13, wide ? 12 : 14, u), lerp(0.5, 0.3, u), lerp(0.18, 0.26, u), fov), heroes: near }),
      (u) => ({ ...orbit([C[0], 2.0, C[2]], lerp(wide ? 10 : 12, wide ? 9.4 : 11.4, u), lerp(-0.5, -0.25, u), lerp(0.05, 0.12, u), fov), heroes: [candle] }),
      (u) => ({ ...orbit([P[0] - 0.4, 0.5, P[2]], lerp(6.2, 5.6, u), lerp(0.2, 0.45, u), 0.5, fov), heroes: [pom.group] }),
      (u) => ({ ...orbit([0.2, 1.8, 0.0], lerp(wide ? 12 : 14, wide ? 11 : 13, u), lerp(-1.1, -0.8, u), 0.34, fov), heroes: near }),
    ],
    break: [
      (u) => ({ ...orbit([B[0], 0.5, B[2]], lerp(8.8, 8.2, u), 0.42 + 0.2 * u, lerp(0.95, 0.85, u), fov), heroes: [book] }),
      (u) => ({ ...orbit([0, 2.6, 0], lerp(wide ? 14 : 16, wide ? 13 : 15, u), lerp(0.1, 0.4, u), 0.12, fov), heroes: [candle] }),
      (u) => ({ ...orbit([GLASS_AT[0] * S, 0.5, GLASS_AT[2] * S], lerp(4.6, 4.0, u), lerp(-0.3, 0.0, u), 0.42, fov), heroes: [glass] }),
    ],
    rise: [
      (u) => ({ ...orbit([C[0], 2.0, C[2]], lerp(wide ? 12 : 14, wide ? 9.5 : 11, ease.inOut(u)), lerp(0.9, 0.5, u), lerp(0.25, 0.15, u), fov), heroes: [candle] }),
    ],
    drop2: [
      (u, TT) => ({ ...orbit([C[0], 2.1, C[2]], wide ? 9.8 : 11.5, 0.2 + 0.25 * u + 0.05 * Math.sin(TT), 0.14, fov), heroes: [candle] }),
      (u) => ({ ...orbit([C[0], 1.5, C[2]], lerp(wide ? 9.4 : 9.6, wide ? 10 : 10.2, u), lerp(-0.9, -0.6, u), lerp(0.0, 0.08, u), fov + 4), heroes: [candle] }),
      (u) => ({ ...orbit([0.3, 1.5, 0.2], lerp(wide ? 13 : 15, wide ? 12 : 14, u), lerp(1.2, 0.95, u), 0.42, fov), heroes: near }),
    ],
    outro: [
      (u) => ({ ...orbit([C[0], lerp(2.2, 4.2, ease.inOut(u)), C[2]], lerp(wide ? 11 : 13, wide ? 15 : 18, ease.inOut(u)), lerp(0.25, 0.1, u), lerp(0.16, 0.02, u), fov), heroes: [candle] }),
    ],
  };
  const shots = directShots({ plan, sections, bank, every: { intro: 8, build: 4, drop: wide ? 8 : 4, break: wide ? 8 : 6, rise: 8, drop2: wide ? 8 : 4, outro: 16 } });
  const camera = new THREE.PerspectiveCamera(fov, plan.w / plan.h, 0.05, 400);
  const heroes = [candle];

  function update(t) {
    const TT = T(t);
    const hit = s.hit(t), kick = s.kick(t), loud = s.slow(t);
    const inDrop = (TT >= D1 && TT < BR) || (TT >= D2 && TT < OUT);
    // the candle
    const calm = TT >= BR && TT < RI;
    const power = (calm ? 0.78 : 0.9) + (inDrop ? 0.22 * kick : 0.08 * hit) + 0.04 * Math.sin(TT * 5.3);
    candle.userData.set(TT, power);
    // the fruit: trembles on the build, opens on the drop
    const build = seg(TT, BUILD, D1);
    const tremble = TT < D1 ? (0.01 + 0.05 * build * build) * hit : 0;
    pom.low.rotation.set(tremble * Math.sin(TT * 40), 0, tremble * Math.cos(TT * 37));
    pom.open(seg(TT, D1 - 0.12, D1 + 0.65));
    // the book's page turns in the breakdown
    book.userData.turn(ease.inOut(seg(TT, BR + (RI - BR) * 0.35, BR + (RI - BR) * 0.35 + 3.2)));
    // the tea's surface trembles with the kicks
    glass.userData.ripple((rr) => 0.0006 * kick * Math.sin(rr * 18 - TT * 30) * (1 - rr));
    // the seeds
    let shown = 0;
    for (let i = 0; i < N; i++) {
      const sd = seeds[i];
      const p = seedPos(sd, TT, t);
      const j = i * 3;
      if (!p) { mat4.makeScale(0, 0, 0); seedsMesh.setMatrixAt(i, mat4); glowCol[j] = glowCol[j + 1] = glowCol[j + 2] = 0; glowPos[j + 1] = -9; continue; }
      shown++;
      const fadeOut = 1 - smooth(seg(TT, END - 4, END + 1));
      e.set(sd.spin.x + TT * 0.7, sd.spin.y + TT * 0.9, sd.spin.z);
      q.setFromEuler(e);
      sc.setScalar(sd.size * (1 + 0.25 * kick) * fadeOut);
      seedsMesh.setMatrixAt(i, mat4.compose(p, q, sc));
      const g = (0.35 + 0.5 * loud + 0.9 * kick) * fadeOut * (TT >= OUT ? 1 + 1.5 * seg(TT, OUT, END) : 1);
      glowPos[j] = p.x; glowPos[j + 1] = p.y; glowPos[j + 2] = p.z;
      glowCol[j] = 1.0 * g; glowCol[j + 1] = 0.18 * g; glowCol[j + 2] = 0.12 * g;
    }
    seedsMesh.instanceMatrix.needsUpdate = true;
    glowGeo.attributes.position.needsUpdate = true;
    glowGeo.attributes.color.needsUpdate = true;
    seedsMesh.visible = glows.visible = shown > 0;
    sparks.userData.update(t);
    // the dawn
    const d = ease.inOut(seg(TT, OUT, END + 2));
    const cT = skyNight.top.clone().lerp(skyDawn.top, d), cH = skyNight.horizon.clone().lerp(skyDawn.horizon, d), cB = skyNight.bottom.clone().lerp(skyDawn.bottom, d);
    const c = new THREE.Color();
    for (let i = 0; i < skyY.count; i++) {
      const y = skyY.getY(i) / 80;
      if (y >= 0) c.copy(cH).lerp(cT, Math.pow(y, 0.55)); else c.copy(cH).lerp(cB, Math.pow(-y, 0.4));
      skyCol.setXYZ(i, c.r, c.g, c.b);
    }
    skyCol.needsUpdate = true;
    sunGroup.position.y = lerp(-8, 3.5, d);
    sunGroup.visible = d > 0.002; // no glow at the horizon before the dawn
    sunGlow.material.opacity = Math.min(1, d * 1.5);
    stars.children.forEach((p) => { p.material.opacity = 1 - 0.85 * d; });
    dawn.intensity = 1.6 * d;
    scene.fog.color.set('#100a1c').lerp(new THREE.Color('#4a2a3a'), d);
    // the lights breathe with the music
    flameLight.intensity = (calm ? 4.2 : 5.2) + (inDrop ? 5.5 * kick : 2.0 * hit) + 0.6 * Math.sin(TT * 7.1);
    flameShadow.intensity = flameLight.intensity * 0.45;
    // the camera
    const after1 = TT - D1, after2 = TT - D2;
    const punch = (after1 >= 0 && after1 < 1 ? Math.exp(-after1 / 0.3) : 0) + (after2 >= 0 && after2 < 1 ? Math.exp(-after2 / 0.3) : 0);
    const wob = shake(TT, 0.012 + 0.06 * punch + (inDrop ? 0.012 * kick : 0), 7);
    const pose = shots.apply(camera, t, wob);
    heroes.length = 0;
    heroes.push(...pose.heroes);
    candle.userData.face(camera);
    const pre = (TT >= D1 - 1.6 && TT < D1) || (TT >= D2 - 1.6 && TT < D2) ? 0.82 : 1;
    return {
      exposure: look.exposure * pre * (1 + 0.45 * punch) * (1 + 0.1 * d),
      bloom: look.bloom.strength * (1 + 0.9 * punch + 0.25 * kick * (inDrop ? 1 : 0)),
      shot: shots.shots.indexOf(shots.shotAt(t)),
    };
  }

  const keyTimes = [0.2, ...shots.shots.slice(1).map((x) => x.from + 0.6), L - 1.0].filter((x) => x < L).slice(0, 14);
  const dT = plan.cues.dropT;
  if (dT !== undefined) keyTimes.push(dT - 0.2, dT + 0.4);
  return {
    scene, camera, update, heroes, cuts: shots.shots.map((x) => x.from),
    anchors: { end: () => (wide ? [960, 470] : [480, 560]) },
    keyTimes: [...new Set(keyTimes.map((x) => +clamp(x, 0, L - 0.05).toFixed(2)))].sort((x, y) => x - y),
  };
}
void fbm3; void CANDLE;
