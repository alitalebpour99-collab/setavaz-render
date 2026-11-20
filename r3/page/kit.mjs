// What every round-3 Short shares, and nothing of its picture: the renderer with bloom and film tone mapping, a way to
// make a small environment for the metals to reflect, sound readers (hits, loudness) and camera helpers.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, noise3, smooth } from '../library/util/noise.mjs';

export { clamp, lerp, smooth };
export const ease = {
  out: (x) => 1 - Math.pow(1 - clamp(x), 3),
  in: (x) => Math.pow(clamp(x), 3),
  inOut: (x) => { const c = clamp(x); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; },
};
/** 0..1 progress of t between a and b. */
export const seg = (t, a, b) => clamp((t - a) / (b - a || 1e-9));

export function makeStage({ canvas, w, h, bloom = { strength: 0.8, radius: 0.6, threshold: 0.9 }, exposure = 1 }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  const float = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  const target = new THREE.WebGLRenderTarget(w, h, { type: float ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1);
  composer.setSize(w, h);
  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), bloom.strength, bloom.radius, bloom.threshold);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  return {
    renderer, composer, bloomPass, float,
    render(scene, camera) { renderPass.scene = scene; renderPass.camera = camera; composer.render(); },
  };
}

/**
 * A small world for metal to reflect: a dim surround of one colour and a few bright panels (a cool sky patch, a warm
 * glow from below, ...). panels: [{ dir: [x,y,z], colour, power, size }].
 */
export function envFromPanels(renderer, { base = '#0a0a14', panels = [] }) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: base, side: THREE.BackSide })));
  for (const p of panels) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.size ?? 8, p.size ?? 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.colour).multiplyScalar(p.power ?? 1), side: THREE.DoubleSide }));
    const d = new THREE.Vector3(...p.dir).normalize().multiplyScalar(14);
    m.position.copy(d);
    m.lookAt(0, 0, 0);
    s.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(s, 0.035).texture;
  pmrem.dispose();
  return tex;
}

/** Readers of the measured sound: the plan carries onsets [{ t, s, low }] and loudness per video frame. */
export function soundOf(plan) {
  const { onsets, rms, low, fps } = plan;
  const sample = (arr, t) => {
    const x = clamp(t * fps, 0, arr.length - 1);
    const i = Math.floor(x), j = Math.min(arr.length - 1, i + 1);
    return lerp(arr[i] ?? 0, arr[j] ?? 0, x - i);
  };
  // loudness smoothed over about a third of a second, for slow things (glow, wind)
  const slow = rms.map((_, f) => { let s = 0, n = 0; for (let k = Math.max(0, f - 5); k <= Math.min(rms.length - 1, f + 5); k++) { s += rms[k]; n++; } return s / n; });
  const hit = (t, { attack = 0.03, decay = 0.16, pick = null } = {}) => {
    let v = 0;
    for (let i = onsets.length - 1; i >= 0; i--) {
      const o = onsets[i];
      const d = t - o.t;
      if (d < 0) continue;
      if (d > decay * 6 + attack) break;
      const w = pick ? pick(o) : 1;
      if (w <= 0) continue;
      v = Math.max(v, o.s * w * (d < attack ? d / attack : Math.exp(-(d - attack) / decay)));
    }
    return v;
  };
  const kicks = onsets.filter((o) => o.low >= 0.45 && o.s >= 0.45);
  return {
    onsets, kicks,
    loud: (t) => sample(rms, t),
    slow: (t) => sample(slow, t),
    low: (t) => sample(low, t),
    hit,
    kick: (t, opt = {}) => hit(t, { decay: 0.22, ...opt, pick: (o) => (o.low >= 0.45 ? 1 : 0) }),
    /** the last onset at or before t that passes `pick`, or null */
    last: (t, pick = () => true) => { for (let i = onsets.length - 1; i >= 0; i--) if (onsets[i].t <= t && pick(onsets[i])) return onsets[i]; return null; },
  };
}

/** A hand-held wobble: three smooth noises, the same for the same t. */
export function shake(t, amount, speed = 9, seed = 0) {
  return [(noise3(t * speed, 1.3, 0, seed) - 0.5) * 2 * amount, (noise3(t * speed, 7.7, 2, seed + 1) - 0.5) * 2 * amount, (noise3(t * speed, 3.1, 5, seed + 2) - 0.5) * 2 * amount];
}

/**
 * Shots: [{ from, to, pose(t, u) -> { pos: [x,y,z], look: [x,y,z], fov, roll?, up? } }]; a new shot is a hard cut.
 * Returns apply(camera, t, wobble = [dx,dy,dz]) and shotAt(t).
 */
export function makeShots(shots) {
  const shotAt = (t) => shots.find((s) => t >= s.from && t < s.to) ?? shots[shots.length - 1];
  const look = new THREE.Vector3();
  return {
    shots, shotAt,
    apply(camera, t, wobble = [0, 0, 0]) {
      const s = shotAt(t);
      const p = s.pose(t, seg(t, s.from, s.to));
      camera.fov = p.fov ?? 35;
      camera.up.set(...(p.up ?? [0, 1, 0]));
      camera.position.set(p.pos[0] + wobble[0], p.pos[1] + wobble[1], p.pos[2] + wobble[2]);
      look.set(p.look[0] + wobble[0] * 0.3, p.look[1] + wobble[1] * 0.3, p.look[2]);
      camera.lookAt(look);
      if (p.roll) camera.rotateZ(p.roll);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      return s;
    },
  };
}

/** An orbit pose: the camera `dist` from `look` at azimuth `az` and elevation `el` (radians). */
export const orbit = (look, dist, az, el, fov = 35) => ({
  pos: [look[0] + dist * Math.cos(el) * Math.sin(az), look[1] + dist * Math.sin(el), look[2] + dist * Math.cos(el) * Math.cos(az)],
  look, fov,
});

/**
 * The box of some objects on the screen, as fractions of the frame: { x0, y0, x1, y1 } (0,0 top left). It is measured
 * from the meshes' own points (about 1500 a mesh), not from their boxes, so a round thing is not counted as its corners.
 */
export function screenBox(objects, camera) {
  const v = new THREE.Vector3();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
  camera.updateMatrixWorld(true);
  for (const o of objects) {
    o.updateWorldMatrix(true, true);
    o.traverse((m) => {
      const p = m.isMesh && m.visible ? m.geometry?.attributes?.position : null;
      if (!p) return;
      const step = Math.max(1, Math.floor(p.count / 1500));
      for (let k = 0; k < p.count; k += step) {
        v.fromBufferAttribute(p, k).applyMatrix4(m.matrixWorld).project(camera);
        if (v.z > 1 || v.z < -1) { behind = true; continue; }
        const sx = (v.x + 1) / 2, sy = (1 - v.y) / 2;
        if (sx < x0) x0 = sx; if (sx > x1) x1 = sx;
        if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
      }
    });
  }
  return { x0: +x0.toFixed(4), y0: +y0.toFixed(4), x1: +x1.toFixed(4), y1: +y1.toFixed(4), behind };
}

/**
 * The shots of a world that knows its track's sections (in the TRACK's time): each section is cut every `every[type]`
 * bars from its own start (so a cut lands on a downbeat, and the same moment is framed the same way in a Short and in
 * the long video), and each piece takes the next pose of its type from `bank` (bank[type] or bank.default: functions
 * (u, T) -> { pos, look, fov, heroes }, u 0..1 through the piece, T the track's time). Pieces shorter than `minS`
 * seconds join their neighbour. Returns { shots, shotAt, apply(camera, t, wobble) -> pose } in the window's time.
 */
export function directShots({ plan, sections, bank, every = {}, minS = 1.8 }) {
  const { a0, L, bar } = plan;
  const pieces = [];
  const count = {};
  for (const s of sections) {
    const step = (every[s.type] ?? 8) * bar;
    for (let c = s.from, k = 0; c < s.to - 1e-6; c += step, k++) {
      const T0 = c, T1 = Math.min(c + step, s.to);
      const from = Math.max(T0, a0), to = Math.min(T1, a0 + L);
      if (to - from <= 1e-6) continue;
      const list = bank[s.type] ?? bank.default;
      const i = (count[s.type] = (count[s.type] ?? -1) + 1);
      // the pose's index from the piece's place in its section, so it does not depend on the window
      const pose = list[(k + (s.seed ?? 0)) % list.length];
      pieces.push({ from: from - a0, to: to - a0, T0, T1, pose, type: s.type, i });
    }
  }
  // a piece too short to read joins the one before it (the first joins the one after)
  for (let j = 0; j < pieces.length; j++) {
    const p = pieces[j];
    if (p.to - p.from >= minS || pieces.length === 1) continue;
    if (j > 0) { pieces[j - 1].to = p.to; pieces[j - 1].T1 = Math.max(pieces[j - 1].T1, p.T1); } else { pieces[1].from = p.from; pieces[1].T0 = Math.min(pieces[1].T0, p.T0); }
    pieces.splice(j, 1);
    j -= 1;
  }
  pieces[0].from = 0;
  pieces[pieces.length - 1].to = L + 1;
  const shots = pieces.map((p) => ({ from: p.from, to: p.to, type: p.type, pose: (t) => p.pose(seg(a0 + t, p.T0, p.T1), a0 + t) }));
  const shotAt = (t) => shots.find((s) => t >= s.from && t < s.to) ?? shots[shots.length - 1];
  const look = new THREE.Vector3();
  return {
    shots, shotAt,
    apply(camera, t, wobble = [0, 0, 0]) {
      const p = shotAt(t).pose(t);
      camera.fov = p.fov ?? 34;
      camera.up.set(0, 1, 0);
      camera.position.set(p.pos[0] + wobble[0], p.pos[1] + wobble[1], p.pos[2] + wobble[2]);
      look.set(p.look[0] + wobble[0] * 0.3, p.look[1] + wobble[1] * 0.3, p.look[2]);
      camera.lookAt(look);
      if (p.roll) camera.rotateZ(p.roll);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      return p;
    },
  };
}

/** The marks of a plan back in the track's time (cuesFromMarks keeps them in the window's time). */
export const trackMarks = (plan) => Object.fromEntries(Object.entries(plan.cues.marks ?? {}).map(([k, t]) => [k, plan.a0 + t]));
/** A camera's vertical field of view for the plan's shape: wider for the tall Short, narrower for the wide video. */
export const fovFor = (plan, portrait = 34, landscape = 24) => (plan.format === 'long' ? landscape : portrait);

/** The bounding sphere of some objects in world space (as they are now), grown by `pad` (a share of its radius). */
export function sphereOf(objects, pad = 0.05) {
  const box = new THREE.Box3();
  for (const o of objects) { o.updateWorldMatrix(true, true); box.expandByObject(o, true); }
  const sp = box.getBoundingSphere(new THREE.Sphere());
  sp.radius *= 1 + pad;
  return sp;
}
/** The union of spheres (for a thing that moves between two states). */
export function joinSpheres(...list) {
  const box = new THREE.Box3();
  for (const s of list) box.union(new THREE.Box3().setFromCenterAndSize(s.center, new THREE.Vector3(2 * s.radius, 2 * s.radius, 2 * s.radius)));
  return box.getBoundingSphere(new THREE.Sphere());
}
/**
 * A pose that frames a sphere: the camera on an orbit (azimuth `az`, elevation `el`) at the distance where the sphere
 * fills `1 / k` of the narrower side of the frame (k > 1 leaves room). `shift` moves the point looked at, in units of
 * the sphere's radius.
 */
export function fitPose(sphere, { az = 0, el = 0.2, fov = 34, aspect = 9 / 16, k = 1.3, shift = [0, 0, 0] }) {
  const v = (fov * Math.PI) / 180;
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect);
  const half = Math.min(v, h) / 2;
  const dist = (sphere.radius * k) / Math.sin(half);
  const c = sphere.center, R = sphere.radius;
  return orbit([c.x + shift[0] * R, c.y + shift[1] * R, c.z + shift[2] * R], dist, az, el, fov);
}
