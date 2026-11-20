// «Focus»: a study desk late at night, under a green desk lamp. A notebook whose page fills with handwriting as the
// track goes, a pencil that writes on its own, a glass of tea whose surface rings with every kick, and an hourglass.
// - Intro: the lamp is on, the tea steams, the page is empty.
// - The beat comes in: the pencil starts writing; the tea trembles with the kick.
// - Main part: the writing runs, the sand runs, the lamp's light breathes with the music.
// - Breakdown: the pencil lifts and rests, the camera looks at the steam and the night window.
// - Second main part: the hourglass is turned over (a new session) and the writing goes on to the end of the page.
// - Outro: the page is full, the lamp dims; the window's night stays.
// Everything is a function of the track's time.
import * as THREE from 'three';
import { makeDesk, makeDeskLamp, makeHourglass, makeNotebook, makePencil } from '../../library/models/study.mjs';
import { makeTeaGlass } from '../../library/models/tea-glass.mjs';
import { makeSteam } from '../../library/effects/steam.mjs';
import { makeStars } from '../../library/sets/night.mjs';
import { glowTexture } from '../../library/textures/data.mjs';
import { plasterTexture } from '../../library/textures/table.mjs';
import { clamp, directShots, ease, fitPose, fovFor, joinSpheres, lerp, seg, shake, smooth, soundOf, sphereOf, trackMarks } from '../kit.mjs';

export const look = { bloom: { strength: 0.34, radius: 0.55, threshold: 0.95 }, exposure: 1.05 };
export const env = { base: '#0c0d14', panels: [{ dir: [-0.3, 1, 0.2], colour: '#ffd9a0', power: 1.6, size: 8 }, { dir: [0.2, 0.3, -1], colour: '#3c4a90', power: 1.1, size: 12 }] };

const S = 10;
const NOTE_AT = [0.03, 0, 0.07], GLASS_AT = [0.3, 0, 0.13], SAND_AT = [-0.29, 0, -0.02], LAMP_AT = [-0.33, 0, -0.24];

export function build({ plan }) {
  const s = soundOf(plan);
  const { L, a0 } = plan;
  const M = trackMarks(plan);
  const BEAT = M.beat ?? 18, D1 = M.drop1 ?? 46, BR = M.break ?? 80, D2 = M.drop2 ?? 123.75, OUT = M.outro ?? 164, END = M.end ?? 172;
  const wide = plan.format === 'long';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#07070d');
  scene.fog = new THREE.Fog('#0a0a12', 30, 90);
  const desk = new THREE.Group();
  desk.scale.setScalar(S);
  scene.add(desk);
  desk.add(makeDesk({ w: 1.6, d: 0.9 }));
  // the wall behind and its window onto the night
  const wallTex = plasterTexture(61, '#1d1c2b');
  wallTex.repeat.set(3, 2);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }));
  wall.position.set(0, 0.55, -0.45);
  const skyMat = new THREE.MeshBasicMaterial({ color: '#141a44', fog: false });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.5), skyMat);
  win.position.set(0.36, 0.52, -0.448);
  const frameMat = new THREE.MeshStandardMaterial({ color: '#2a2219', roughness: 0.7 });
  const bars = [[0.66, 0.025, 0.36, 0.27], [0.66, 0.025, 0.36, 0.77], [0.025, 0.52, 0.04, 0.52], [0.025, 0.52, 0.68, 0.52], [0.66, 0.014, 0.36, 0.52], [0.014, 0.5, 0.36, 0.52]];
  for (const [w, h, x, y] of bars) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), frameMat); b.position.set(x, y, -0.44); desk.add(b); }
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(1.3, 1.25, 1.1), transparent: true, depthWrite: false, fog: false }));
  moon.scale.setScalar(0.08);
  moon.position.set(0.5, 0.66, -0.446);
  desk.add(wall, win, moon);
  // a few stars in the window's upper half (a flattened dome of points, inside the frame)
  const stars = makeStars({ n: 50, radius: 0.24, seed: 31, minY: 0.05 });
  stars.children.forEach((p) => { p.material.size = 0.005; });
  stars.scale.set(1, 0.95, 0.02);
  stars.position.set(0.36, 0.53, -0.447);
  desk.add(stars);

  const note = makeNotebook();
  note.position.set(...NOTE_AT);
  note.rotation.y = -0.08;
  const pencil = makePencil();
  const glass = makeTeaGlass();
  glass.position.set(...GLASS_AT);
  const steam = [makeSteam({ w: 0.07, h: 0.18, seed: 0.2 }), makeSteam({ w: 0.05, h: 0.14, seed: 0.7 })];
  steam[0].position.set(GLASS_AT[0], glass.userData.surface() + 0.004, GLASS_AT[2]);
  steam[1].position.set(GLASS_AT[0] + 0.006, glass.userData.surface() + 0.004, GLASS_AT[2] - 0.004);
  const sand = makeHourglass();
  sand.position.set(...SAND_AT);
  const lamp = makeDeskLamp();
  lamp.position.set(...LAMP_AT);
  lamp.rotation.y = -0.55;
  lamp.userData.pose(0.32, 1.75, -2.45);
  desk.add(note, pencil, glass, ...steam, sand, lamp);

  // light: the lamp's warm cone on the page, the cold window, a dim room
  const spot = new THREE.SpotLight('#ffd7a0', 14, 40, 0.62, 0.55, 1.4);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0006; spot.shadow.radius = 4;
  scene.add(spot, spot.target);
  const windowLight = new THREE.DirectionalLight('#6878c8', 0.9);
  windowLight.position.set(4, 6, -8);
  const room = new THREE.HemisphereLight('#383a5c', '#22180f', 0.85);
  const bulbGlow = new THREE.PointLight('#ffcf8a', 2.2, 16, 1.6);
  scene.add(windowLight, room, bulbGlow);
  scene.environmentIntensity = 0.5;
  desk.updateMatrixWorld(true);
  const head = lamp.userData.head;
  const headPos = new THREE.Vector3(), aimPos = new THREE.Vector3();
  head.getWorldPosition(headPos);
  spot.position.copy(headPos).add(new THREE.Vector3(0, -0.3, 0));
  aimPos.set(NOTE_AT[0] * S + 0.6, 0, NOTE_AT[2] * S);
  spot.target.position.copy(aimPos);
  bulbGlow.position.copy(headPos).add(new THREE.Vector3(0, -0.4, 0));

  // the story's numbers
  const writeAt = (T) => {
    if (T < BEAT) return 0;
    if (T < D1) return 0.16 * seg(T, BEAT + 2, D1);
    if (T < BR) return lerp(0.16, 0.55, seg(T, D1, BR - 2));
    if (T < D2) return 0.55;
    return lerp(0.55, 1, seg(T, D2 + 1, OUT - 1));
  };
  const writing = (T) => (T >= BEAT + 2 && T < BR - 2) || (T >= D2 + 1 && T < OUT - 1);
  const sandAt = (T) => (T < D2 ? seg(T, BEAT, D2) : 0.42 * seg(T, D2 + 0.7, END + 6));

  // the camera
  const sections = [
    { type: 'intro', from: 0, to: BEAT },
    { type: 'beat', from: BEAT, to: D1 },
    { type: 'drop', from: D1, to: BR },
    { type: 'break', from: BR, to: D2 },
    { type: 'drop2', from: D2, to: OUT },
    { type: 'outro', from: OUT, to: Math.max(END, a0 + L) + 30 },
  ];
  const fov = fovFor(plan, 34, 26);
  const aspect = plan.w / plan.h;
  // the spheres to frame (the pencil moves over the page, the hourglass turns over: their widest states)
  const sNote = sphereOf([note], 0.08);
  const sGlass = sphereOf([glass], 0.08);
  sand.rotation.z = Math.PI / 2; desk.updateMatrixWorld(true);
  const sSand = joinSpheres(sphereOf([sand], 0.05), (sand.rotation.z = 0, desk.updateMatrixWorld(true), sphereOf([sand], 0.05)));
  const sLamp = sphereOf([lamp], 0.05);
  const sDesk = sphereOf([note, glass, sand], 0.04);
  const sAll = sphereOf([note, glass, sand, lamp], 0.03);
  const F = (sp, az, el, k, heroes, shift) => ({ ...fitPose(sp, { az, el, k: 1 + (k - 1) * 0.45, fov, aspect, shift }), heroes });
  const bank = {
    intro: [
      (u) => F(sAll, lerp(-0.35, -0.2, u), lerp(0.42, 0.36, u), lerp(1.2, 1.12, u), [note, glass, sand, lamp]),
      (u) => F(sGlass, lerp(0.5, 0.3, u), lerp(0.25, 0.2, u), lerp(1.3, 1.2, u), [glass]),
    ],
    beat: [
      (u) => F(sNote, lerp(0.15, 0.0, u), lerp(0.9, 0.8, u), lerp(1.25, 1.15, u), [note]),
      (u) => F(sDesk, lerp(0.45, 0.3, u), lerp(0.4, 0.34, u), lerp(1.18, 1.1, u), [note, glass, sand]),
    ],
    drop: [
      (u) => F(sNote, lerp(-0.2, 0.05, u), lerp(0.75, 0.68, u), lerp(1.2, 1.1, u), [note]),
      (u) => F(sGlass, lerp(-0.3, -0.1, u), lerp(0.55, 0.45, u), lerp(1.25, 1.15, u), [glass]),
      (u) => F(sSand, lerp(0.3, 0.1, u), lerp(0.18, 0.12, u), lerp(1.3, 1.2, u), [sand]),
      (u) => F(sDesk, lerp(-0.5, -0.3, u), lerp(0.46, 0.4, u), lerp(1.15, 1.08, u), [note, glass, sand]),
    ],
    break: [
      (u) => F(sGlass, lerp(0.8, 0.6, u), lerp(0.12, 0.1, u), lerp(1.35, 1.25, u), [glass], [0, 0.3, 0]),
      (u) => F(sLamp, lerp(0.6, 0.4, u), lerp(0.2, 0.15, u), lerp(1.3, 1.2, u), [lamp]),
      (u) => F(sAll, lerp(0.1, -0.1, u), lerp(0.3, 0.26, u), lerp(1.2, 1.14, u), [note, glass, sand, lamp]),
    ],
    drop2: [
      (u) => F(sSand, lerp(-0.2, 0.0, u), lerp(0.16, 0.12, u), lerp(1.3, 1.22, u), [sand]),
      (u) => F(sNote, lerp(0.2, 0.0, u), lerp(0.82, 0.74, u), lerp(1.2, 1.12, u), [note]),
      (u) => F(sDesk, lerp(0.5, 0.3, u), lerp(0.42, 0.36, u), lerp(1.15, 1.08, u), [note, glass, sand]),
      (u) => F(sGlass, lerp(-0.4, -0.2, u), lerp(0.5, 0.42, u), lerp(1.25, 1.15, u), [glass]),
    ],
    outro: [
      (u) => F(sAll, lerp(-0.1, 0.1, u), lerp(0.36, 0.5, u), lerp(1.12, 1.3, ease.inOut(u)), [note, glass, sand, lamp]),
    ],
  };
  const shots = directShots({ plan, sections, bank, every: { intro: 8, beat: 8, drop: wide ? 8 : 2, break: wide ? 8 : 4, drop2: wide ? 8 : 2, outro: 16 } });
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.05, 400);
  const heroes = [note];
  const pencilTilt = new THREE.Euler();

  function update(t) {
    const T = a0 + t;
    const hit = s.hit(t), kick = s.kick(t), loud = s.slow(t);
    const inDrop = (T >= D1 && T < BR) || (T >= D2 && T < OUT);
    // the page and the pencil
    const k = writeAt(T);
    note.userData.write(k);
    const pen = note.userData.penAt(Math.max(0.001, k));
    const lifted = writing(T) ? 0.002 + 0.0015 * Math.abs(Math.sin(T * 9)) : 0.03;
    const restK = smooth(seg(T, BR - 2, BR - 0.5)) * (1 - smooth(seg(T, D2 + 0.2, D2 + 1)));
    const p = new THREE.Vector3(NOTE_AT[0], 0, NOTE_AT[2]).add(pen.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.08));
    const rest = new THREE.Vector3(NOTE_AT[0] + 0.17, 0.016, NOTE_AT[2] + 0.13);
    pencil.position.set(lerp(p.x, rest.x, restK), lerp(p.y + lifted, rest.y, restK), lerp(p.z, rest.z, restK));
    pencilTilt.set(lerp(0.5 + 0.04 * Math.sin(T * 7), 1.48, restK), lerp(0.3, 1.2, restK), lerp(-0.25, 0.0, restK), 'YXZ');
    pencil.rotation.copy(pencilTilt);
    // the tea: rings from each kick, the steam
    const live = s.kicks.filter((o) => t - o.t >= 0 && t - o.t <= 1.6);
    const ring = (rr) => {
      let h = 0;
      for (const o of live) {
        const d = t - o.t;
        const front = rr - d * 0.9;
        h += 0.0009 * o.s * Math.exp(-d / 0.5) * Math.sin(front * 26) * Math.exp(-Math.pow(front * 3, 2));
      }
      return h * (1 - rr * 0.6);
    };
    glass.userData.ripple(ring);
    steam[0].userData.set(T, 0.9 + 0.2 * loud);
    steam[1].userData.set(T * 1.1 + 4, 0.7 + 0.2 * loud);
    for (const st of steam) st.userData.face(camera);
    // the hourglass: the sand runs; at the second drop it is turned over
    const flip = seg(T, D2 - 0.1, D2 + 0.6);
    if (flip > 0 && flip < 1) { sand.rotation.z = Math.PI * ease.inOut(flip); sand.position.y = 0.075 * Math.sin(Math.PI * flip); sand.userData.sand(1); }
    else { sand.rotation.z = 0; sand.position.y = 0; sand.userData.sand(sandAt(T)); }
    // the lamp: it breathes with the music, a little brighter on the kicks in the main parts; it dims at the end
    const off = smooth(seg(T, OUT + 2, END + 1));
    const breath = T >= BR && T < D2 ? 0.86 : 1;
    // the lamp is the beat's light: it swells on every kick (strongly in the main parts), so the picture breathes in time
    const power = breath * (1 - 0.82 * off) * (1 + (inDrop ? 0.6 * hit + 0.3 * kick : 0.45 * hit) + 0.06 * loud);
    spot.intensity = 14 * power;
    bulbGlow.intensity = 2.4 * power;
    lamp.userData.bulb(power);
    note.userData.light(0.8 + 0.25 * power);
    skyMat.color.set('#141a44').multiplyScalar(1 + 0.15 * loud);
    // the camera
    const punch = [D1, D2].reduce((a, d) => a + (T >= d && T < d + 1 ? Math.exp(-(T - d) / 0.3) : 0), 0);
    const wob = shake(T, 0.008 + 0.04 * punch + (inDrop ? 0.006 * kick : 0), 6);
    const pose = shots.apply(camera, t, wob);
    heroes.length = 0;
    heroes.push(...pose.heroes);
    const pre = (T >= D1 - 1.2 && T < D1) || (T >= D2 - 1.2 && T < D2) ? 0.84 : 1;
    return {
      exposure: look.exposure * pre * (1 + 0.42 * punch) * (1 - 0.25 * off) * (1 + 0.12 * hit),
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
