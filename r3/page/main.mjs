// The page the runner drives: window.r3.init(plan) builds a Short's world, window.r3.frame(t) draws one frame and
// gives it back as a JPEG with what the gate needs; window.r3.turntable(id) draws one library object from eight sides.
import * as THREE from 'three';
import { envFromPanels, makeStage, screenBox } from './kit.mjs';
import { loadFonts, makeOverlay } from './overlay.mjs';
import { OBJECTS } from '../library/index.mjs';

const SCENES = {
  ember: () => import('./scenes/ember.mjs'),
  storm: () => import('./scenes/storm.mjs'),
  molten: () => import('./scenes/molten.mjs'),
  yalda: () => import('./scenes/yalda.mjs'),
  'night-drive': () => import('./scenes/night-drive.mjs'),
  focus: () => import('./scenes/focus.mjs'),
  bazaar: () => import('./scenes/bazaar.mjs'),
  kahkeshan: () => import('./scenes/kahkeshan.mjs'),
};
let S = null;

window.r3 = {
  objects: () => OBJECTS.map((o) => o.id),

  async init({ plan, scale = 0.75, brand, quality = 0.93 }) {
    await loadFonts();
    const W = plan.w, H = plan.h;
    const rw = Math.round((W * scale) / 2) * 2, rh = Math.round((H * scale) / 2) * 2;
    plan.rw = rw; plan.rh = rh;
    const gl = document.createElement('canvas');
    gl.width = rw; gl.height = rh;
    const mod = await SCENES[plan.scene]();
    const stage = makeStage({ canvas: gl, w: rw, h: rh, bloom: mod.look.bloom, exposure: mod.look.exposure });
    const world = mod.build({ plan });
    world.scene.environment = envFromPanels(stage.renderer, mod.env);
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    document.body.appendChild(out);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const probe = document.createElement('canvas');
    probe.width = 27; probe.height = 48;
    S = { plan, W, H, gl, stage, world, out, ctx, probe, pctx: probe.getContext('2d', { willReadFrequently: true }), overlay: makeOverlay({ w: W, h: H, brand }), quality };
    const dbg = stage.renderer.getContext().getExtension('WEBGL_debug_renderer_info');
    return { rw, rh, float: stage.float, cuts: world.cuts, keyTimes: world.keyTimes, gpu: dbg ? stage.renderer.getContext().getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown' };
  },

  /** One frame at t. `draw: false` only poses the world and lays out the words (no 3D picture): for the quick checks. */
  frame(t, { box = false, image = true, draw = true } = {}) {
    const { plan, W, H, gl, stage, world, out, ctx, probe, pctx, overlay, quality } = S;
    const now = world.update(t);
    stage.renderer.toneMappingExposure = now.exposure;
    stage.bloomPass.strength = now.bloom;
    if (draw) stage.render(world.scene, world.camera);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (draw) ctx.drawImage(gl, 0, 0, W, H);
    const rows = overlay.draw(ctx, plan, t, world.anchors, Math.round(t * plan.fps));
    pctx.drawImage(out, 0, 0, 27, 48);
    const d = pctx.getImageData(0, 0, 27, 48).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return {
      jpeg: image && draw ? out.toDataURL('image/jpeg', quality) : null,
      luma: +(sum / (27 * 48 * 255)).toFixed(4), rows, shot: now.shot,
      box: box ? screenBox(world.heroes, world.camera) : null,
    };
  },

  /** One object from eight sides on a plain studio floor, as one sheet (4 x 2). */
  turntable(id, { tile = 512 } = {}) {
    const spec = OBJECTS.find((o) => o.id === id);
    if (!spec) throw new Error(`no object ${id}`);
    const gl = document.createElement('canvas');
    gl.width = gl.height = tile;
    const stage = makeStage({ canvas: gl, w: tile, h: tile, bloom: { strength: 0.6, radius: 0.6, threshold: 1.0 }, exposure: 1.0 });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#17171d');
    scene.environment = envFromPanels(stage.renderer, { base: '#3a3a44', panels: [{ dir: [0, 1, 0.2], colour: '#ffffff', power: 2.2, size: 12 }, { dir: [-1, 0.3, 0.6], colour: '#ffe9d0', power: 1.4, size: 9 }, { dir: [1, 0.2, -0.6], colour: '#9fb4ff', power: 1.2, size: 9 }] });
    scene.environmentIntensity = 0.9;
    const obj = spec.make();
    scene.add(obj);
    obj.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(obj);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const floor = new THREE.Mesh(new THREE.CircleGeometry(sphere.radius * 6, 48), new THREE.MeshStandardMaterial({ color: '#2b2b33', roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = box.min.y - 0.001;
    floor.receiveShadow = true;
    const key = new THREE.DirectionalLight('#fff1e0', 3.2);
    key.position.set(sphere.center.x - sphere.radius * 2.5, sphere.center.y + sphere.radius * 3.5, sphere.center.z + sphere.radius * 3);
    key.target.position.copy(sphere.center);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sr = sphere.radius * 1.6;
    Object.assign(key.shadow.camera, { near: 0.1, far: sphere.radius * 12, left: -sr, right: sr, top: sr, bottom: -sr });
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
    const rim = new THREE.DirectionalLight('#9fb4ff', 2.0);
    rim.position.set(sphere.center.x + sphere.radius * 3, sphere.center.y + sphere.radius * 2, sphere.center.z - sphere.radius * 3);
    rim.target.position.copy(sphere.center);
    scene.add(floor, key, key.target, rim, rim.target, new THREE.HemisphereLight('#8890a8', '#30303a', 1.1));
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 500);
    const dist = (sphere.radius / Math.sin((15 * Math.PI) / 180)) * 1.06;
    const sheet = document.createElement('canvas');
    sheet.width = tile * 4; sheet.height = tile * 2 + 56;
    const ctx = sheet.getContext('2d');
    ctx.fillStyle = '#0c0c12';
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    for (let i = 0; i < 8; i++) {
      const az = (i / 8) * Math.PI * 2 + 0.35, el = i < 4 ? 0.3 : 0.62;
      camera.position.set(sphere.center.x + dist * Math.cos(el) * Math.sin(az), sphere.center.y + dist * Math.sin(el), sphere.center.z + dist * Math.cos(el) * Math.cos(az));
      camera.lookAt(sphere.center);
      camera.updateMatrixWorld(true);
      obj.userData.face?.(camera);
      stage.render(scene, camera);
      ctx.drawImage(gl, (i % 4) * tile, Math.floor(i / 4) * tile);
    }
    ctx.fillStyle = '#F6ECD3';
    ctx.font = '600 30px "Inter Display", sans-serif';
    ctx.fillText(`${id}   (${(box.max.x - box.min.x).toFixed(2)} x ${(box.max.y - box.min.y).toFixed(2)} x ${(box.max.z - box.min.z).toFixed(2)} m)`, 20, tile * 2 + 38);
    const jpeg = sheet.toDataURL('image/jpeg', 0.92);
    stage.composer.dispose?.();
    stage.renderer.dispose();
    stage.renderer.forceContextLoss();
    return { jpeg };
  },
};
window.r3ready = true;
