// The study desk of «Focus»: an articulated desk lamp in dark green enamel and brass, an open notebook whose
// «handwriting» grows line by line (`.userData.write(k)`, 0 empty .. 1 the page full), a wooden pencil, and an
// hourglass of brass-capped glass whose sand runs (`.userData.sand(k)`, 0 all on top .. 1 all below).
import * as THREE from 'three';
import { at, lathe, shadows } from '../util/shape.mjs';
import { grainTexture } from '../textures/data.mjs';
import { RULED, ruledPageTexture, walnutTexture } from '../textures/table.mjs';
import { brassMaterial } from './candle.mjs';

// ---------- the lamp ----------

export const LAMP = { base: 0.075, arm1: 0.2, arm2: 0.19 };

/**
 * The lamp, its base at the origin, facing +x. `lamp.userData.pose(a1, a2, tilt)` bends it; `lamp.userData.head` is
 * the shade (a SpotLight can be put in it), `lamp.userData.bulb(k)` sets the bulb's glow.
 */
export function makeDeskLamp() {
  const g = new THREE.Group();
  const enamel = new THREE.MeshPhysicalMaterial({ color: '#1f3b2e', roughness: 0.32, metalness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const brass = brassMaterial();
  const base = lathe([[0, 0], [LAMP.base, 0], [LAMP.base, 0.008], [LAMP.base * 0.92, 0.016], [LAMP.base * 0.35, 0.024], [0.012, 0.03], [0.012, 0.034], [0, 0.034]], enamel, 64);
  g.add(base);
  const jointMat = brass;
  const joint = () => new THREE.Mesh(new THREE.SphereGeometry(0.0095, 20, 14), jointMat);
  const rod = (len) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, len, 14), brass); m.geometry.translate(0, len / 2, 0); return m; };
  const j0 = new THREE.Group(); j0.position.y = 0.034; g.add(j0); j0.add(joint());
  const a1 = rod(LAMP.arm1); j0.add(a1);
  const j1 = new THREE.Group(); j1.position.y = LAMP.arm1; a1.add(j1); j1.add(joint());
  const a2 = rod(LAMP.arm2); j1.add(a2);
  const j2 = new THREE.Group(); j2.position.y = LAMP.arm2; a2.add(j2); j2.add(joint());
  // the shade: a cone open below, enamel outside, warm white inside
  const head = new THREE.Group();
  j2.add(head);
  const shadeOut = lathe([[0.058, -0.07], [0.056, -0.066], [0.04, -0.035], [0.022, -0.012], [0.016, 0.0], [0.0, 0.004]], enamel, 56);
  const inside = new THREE.MeshStandardMaterial({ color: '#f3ead4', roughness: 0.6, side: THREE.BackSide, emissive: '#ffdca0', emissiveIntensity: 0.25 });
  const shadeIn = lathe([[0.0575, -0.0695], [0.0555, -0.066], [0.0395, -0.0352], [0.0215, -0.0122], [0.0155, -0.0005], [0, 0.0035]], inside, 56);
  head.add(shadeOut, shadeIn);
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffe2a8', emissiveIntensity: 3 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 14), bulbMat);
  bulb.position.y = -0.03;
  head.add(bulb);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.0578, 0.0016, 8, 64), brass);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.0698;
  head.add(lip);
  g.userData.head = head;
  g.userData.bulb = (k) => { bulbMat.emissiveIntensity = 2 + 3 * k; inside.emissiveIntensity = 0.15 + 0.3 * k; };
  // b1: the first arm's lean toward +x; b2: the elbow (the second arm folds forward and down); tilt: the head's turn
  // back, so that its opening looks down at the desk a little ahead of it
  g.userData.pose = (b1 = 0.35, b2 = 1.95, tilt = -2.65) => {
    j0.rotation.z = -b1;
    j1.rotation.z = -b2;
    j2.rotation.z = -tilt;
  };
  g.userData.pose();
  return shadows(g);
}

// ---------- the notebook and pencil ----------

export const NOTE = { w: 0.15, d: 0.21 };

/** A notebook open flat: two ruled pages on a dark board; the right page fills with handwriting as `write(k)` grows. */
export function makeNotebook() {
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(NOTE.w * 2 + 0.012, 0.004, NOTE.d + 0.01), new THREE.MeshStandardMaterial({ color: '#23324a', roughness: 0.7 }));
  board.position.y = 0.002;
  g.add(board);
  const paper = new THREE.MeshStandardMaterial({ map: ruledPageTexture(), roughness: 0.92 });
  for (const side of [-1, 1]) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(NOTE.w - 0.004, 0.006, NOTE.d - 0.004), new THREE.MeshStandardMaterial({ color: '#e6dcc4', roughness: 0.9 }));
    block.position.set(side * (NOTE.w / 2), 0.007, 0);
    const page = new THREE.Mesh(new THREE.PlaneGeometry(NOTE.w - 0.004, NOTE.d - 0.004), paper);
    page.rotation.x = -Math.PI / 2;
    page.position.set(side * (NOTE.w / 2), 0.0102, 0);
    g.add(block, page);
  }
  // a spiral of wire rings down the middle
  const wire = new THREE.MeshStandardMaterial({ color: '#b9bcc4', metalness: 1, roughness: 0.3 });
  for (let i = 0; i < 16; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0007, 6, 18), wire);
    ring.position.set(0, 0.008, -NOTE.d / 2 + 0.012 + i * ((NOTE.d - 0.024) / 15));
    g.add(ring);
  }
  // the handwriting: dark blue ink drawn by a shader on the right page, line by line up to uK
  const ink = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uK: { value: 0 }, uLines: { value: 14 }, uFirst: { value: RULED.first }, uStep: { value: RULED.step }, uLeft: { value: RULED.left }, uRight: { value: RULED.right }, uLight: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uK, uLines, uFirst, uStep, uLeft, uRight, uLight;
      float h(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
      void main() {
        float v = 1.0 - vUv.y, u = vUv.x;
        float li = floor((v - uFirst + uStep * 0.75) / uStep);
        if (li < 0.0 || li >= uLines) discard;
        float y = uFirst + li * uStep - uStep * 0.28;
        float done = clamp(uK * uLines - li, 0.0, 1.0);
        float lineEnd = uLeft + (uRight - uLeft) * (0.7 + 0.3 * h(li + 3.0));
        float x1 = uLeft + (lineEnd - uLeft) * done;
        if (u < uLeft || u > x1) discard;
        float ph = h(li) * 40.0;
        float word = sin(u * 70.0 + ph) + 0.6 * sin(u * 23.0 + ph * 0.3);
        if (word < -0.6) discard;
        float wave = 0.007 * sin(u * 260.0 + ph) + 0.004 * sin(u * 97.0 + ph * 2.0) + 0.006 * max(0.0, sin(u * 33.0 + ph)) * step(0.7, h(floor(u * 30.0) + li));
        float d = abs(v - y - wave);
        float w = 0.0022 + 0.0012 * sin(u * 180.0 + ph);
        float a = 1.0 - smoothstep(w * 0.3, w, d);
        if (a < 0.02) discard;
        gl_FragColor = vec4(vec3(0.07, 0.1, 0.28) * uLight, a * 0.92);
      }`,
  });
  const inkPlane = new THREE.Mesh(new THREE.PlaneGeometry(NOTE.w - 0.004, NOTE.d - 0.004), ink);
  inkPlane.rotation.x = -Math.PI / 2;
  inkPlane.position.set(NOTE.w / 2, 0.0104, 0);
  inkPlane.renderOrder = 4;
  g.add(inkPlane);
  /** Where the pen is when the page is written up to k: a point on the right page (in the notebook's space). */
  const penAt = (k) => {
    const lines = 14;
    const li = Math.min(lines - 1, Math.floor(k * lines));
    const done = Math.min(1, k * lines - li);
    const hh = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
    const lineEnd = RULED.left + (RULED.right - RULED.left) * (0.7 + 0.3 * hh(li + 3));
    const u = RULED.left + (lineEnd - RULED.left) * done;
    const v = RULED.first + li * RULED.step - RULED.step * 0.28;
    return new THREE.Vector3(u * (NOTE.w - 0.004), 0.0104, (v - 0.5) * (NOTE.d - 0.004));
  };
  g.userData.write = (k) => { ink.uniforms.uK.value = k; };
  g.userData.light = (k) => { ink.uniforms.uLight.value = k; };
  g.userData.penAt = penAt;
  return shadows(g, false, true);
}

/** A wooden pencil, hexagonal, yellow-ochre lacquer, a sharpened tip. Its point at the origin, the pencil along +y. */
export function makePencil() {
  const g = new THREE.Group();
  const L = 0.15;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0036, L, 6), new THREE.MeshPhysicalMaterial({ color: '#c8902a', roughness: 0.35, clearcoat: 0.6 }));
  body.position.y = 0.02 + L / 2;
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0009, 0.018, 6), new THREE.MeshStandardMaterial({ color: '#d9b98a', roughness: 0.8 }));
  cone.position.y = 0.011;
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.0009, 0.0025, 8), new THREE.MeshStandardMaterial({ color: '#2b2b30', roughness: 0.5, metalness: 0.3 }));
  lead.rotation.x = Math.PI;
  lead.position.y = 0.0012;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.009, 16), new THREE.MeshStandardMaterial({ color: '#b8b2a0', metalness: 1, roughness: 0.3 }));
  ferrule.position.y = 0.02 + L + 0.0045;
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.007, 16), new THREE.MeshStandardMaterial({ color: '#d8848a', roughness: 0.8 }));
  eraser.position.y = 0.02 + L + 0.012;
  g.add(body, cone, lead, ferrule, eraser);
  return shadows(g);
}

// ---------- the hourglass ----------

export const SAND = { h: 0.15, bulb: 0.032 };

/** An hourglass: two glass bulbs between walnut discs held by three turned brass posts; `sand(k)` moves the sand. */
export function makeHourglass() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: walnutTexture(57), roughness: 0.55 });
  const brass = brassMaterial();
  const H = SAND.h, R = SAND.bulb;
  for (const y of [0, H - 0.01]) {
    const disc = lathe([[0, 0], [0.042, 0], [0.044, 0.003], [0.044, 0.007], [0.042, 0.01], [0, 0.01]], wood, 48);
    disc.position.y = y;
    g.add(disc);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const post = lathe([[0.0035, 0], [0.0045, 0.006], [0.003, 0.02], [0.0042, H / 2 - 0.01], [0.003, H - 0.03], [0.0045, H - 0.026], [0.0035, H - 0.02]], brass, 16);
    post.position.set(Math.cos(a) * 0.036, 0.01, Math.sin(a) * 0.036);
    g.add(post);
  }
  // the glass: two round bulbs meeting at a narrow neck
  const half = H / 2 - 0.01;
  const pts = [];
  for (let i = 0; i <= 16; i++) { const k = i / 16; pts.push([0.0025 + R * Math.sin(k * Math.PI) * (0.6 + 0.4 * Math.sin(k * Math.PI)), 0.01 + k * half]); }
  const upper = pts.map(([r, y]) => [r, H - y]).reverse();
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.03, transparent: true, opacity: 0.2, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const glass = lathe([...pts, ...upper.slice(1)], glassMat, 48);
  glass.renderOrder = 3;
  g.add(glass);
  // the sand: a heap below (a cone that grows) and a level above (a cone that sinks), and the thin falling thread
  const sandMat = new THREE.MeshStandardMaterial({ color: '#d8b47a', roughness: 0.95 });
  const below = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 40, 1), sandMat);
  const above = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.0025, 1, 40, 1), sandMat);
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 1, 6), sandMat);
  g.add(below, above, thread);
  const neck = H / 2;
  g.userData.sand = (k) => {
    const a = THREE.MathUtils.clamp(k, 0, 1);
    // below: a heap of height up to 0.045 on the bottom of the lower bulb
    const hb = 0.004 + 0.042 * Math.cbrt(a), rb = Math.min(R * 0.95, 0.012 + 0.03 * Math.cbrt(a));
    below.scale.set(rb, hb, rb); below.position.y = 0.012 + hb / 2;
    below.visible = a > 0.001;
    // above: the sand left, a funnel down to the neck
    const ha = 0.044 * Math.cbrt(1 - a);
    above.scale.set(Math.max(0.002, R * 0.92 * Math.cbrt(1 - a)), Math.max(0.0001, ha), Math.max(0.002, R * 0.92 * Math.cbrt(1 - a)));
    above.position.y = neck + 0.002 + ha / 2;
    above.visible = a < 0.999;
    thread.visible = a > 0.0005 && a < 0.999;
    const top = neck, bottom = 0.012 + hb;
    thread.scale.y = Math.max(0.001, top - bottom); thread.position.y = (top + bottom) / 2;
  };
  g.userData.sand(0);
  return shadows(g);
}

export function makeDesk({ w = 1.4, d = 0.8 } = {}) {
  const tex = walnutTexture(51);
  tex.repeat.set(1.5, 1.5);
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.48, metalness: 0, bumpMap: grainTexture(13), bumpScale: 0.2 }));
  top.position.y = -0.015;
  top.receiveShadow = true;
  return top;
}
export { at };
