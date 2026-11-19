// Pieces of a night set shared by the three worlds: a sky dome with a vertical gradient, far stars, a ground disc,
// and a soft contact shadow to seat an object on the ground.
import * as THREE from 'three';
import { rng } from '../util/noise.mjs';
import { glowTexture, grainTexture } from '../textures/data.mjs';

/** A dome painted from `bottom` through `horizon` to `top` (colours as hex strings). It is not lit and takes no fog. */
export function makeSkyDome({ top = '#06061a', horizon = '#1a1a44', bottom = '#07071a', radius = 60 } = {}) {
  const geo = new THREE.SphereGeometry(radius, 32, 24);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const cT = new THREE.Color(top), cH = new THREE.Color(horizon), cB = new THREE.Color(bottom), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / radius;
    if (y >= 0) c.copy(cH).lerp(cT, Math.pow(y, 0.55)); else c.copy(cH).lerp(cB, Math.pow(-y, 0.4));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10;
  return m;
}

/** Far stars on the upper dome, faint and of slightly different sizes (three layers of points). */
export function makeStars({ n = 260, radius = 50, seed = 2, minY = 0.12 } = {}) {
  const r = rng(seed);
  const group = new THREE.Group();
  for (const [size, share, bright] of [[0.16, 0.6, 0.7], [0.26, 0.3, 1.0], [0.4, 0.1, 1.5]]) {
    const k = Math.round(n * share);
    const pos = new Float32Array(k * 3);
    for (let i = 0; i < k; i++) {
      const y = minY + (1 - minY) * r();
      const a = r() * Math.PI * 2;
      const h = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(a) * h * radius; pos[i * 3 + 1] = y * radius; pos[i * 3 + 2] = Math.sin(a) * h * radius;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, map: glowTexture(), color: new THREE.Color(0.9 * bright, 0.92 * bright, 1.1 * bright), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true }));
    pts.frustumCulled = false;
    group.add(pts);
  }
  return group;
}

/** A wide ground disc with a fine grain (stone, concrete), which takes shadows. */
export function makeGround({ colour = '#24212b', radius = 9, roughness = 0.9, repeat = 14 } = {}) {
  const grain = grainTexture(11);
  const tex = grain.clone();
  tex.repeat.set(repeat, repeat);
  tex.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), new THREE.MeshStandardMaterial({ color: colour, roughness, metalness: 0, bumpMap: tex, bumpScale: 1.5, roughnessMap: tex }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

/** A soft dark patch under an object, so it sits on the ground even where no light casts its shadow. */
export function makeContactShadow(radius = 0.5, strength = 0.6) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x / (size - 1) - 0.5, y / (size - 1) - 0.5) * 2;
    data[(y * size + x) * 4 + 3] = Math.round(255 * strength * Math.pow(Math.max(0, 1 - d), 1.6));
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: 0x000000 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  m.renderOrder = 1;
  return m;
}
