// An estekan, the small waisted Persian tea glass, full of dark amber tea, on a white porcelain saucer with a gold rim.
// The tea's surface is its own mesh so a scene can ripple it (rings from each beat): `.userData.ripple(fn)` with
// fn(r, a) -> height in metres.
import * as THREE from 'three';
import { lathe, shadows } from '../util/shape.mjs';

export const GLASS = { saucer: 0.012, h: 0.078, tea: 0.064 };

/** The glass's outline (radius, height above its own foot): a thick round foot, a narrow waist, a wide lip. */
const OUT = [[0, 0], [0.019, 0], [0.0205, 0.002], [0.02, 0.006], [0.0165, 0.012], [0.0158, 0.024], [0.0172, 0.036], [0.0212, 0.052], [0.0242, 0.068], [0.0252, 0.077], [0.0254, 0.078]];
const IN = [[0.0244, 0.078], [0.0236, 0.068], [0.0204, 0.052], [0.0164, 0.036], [0.015, 0.024], [0.0152, 0.014], [0, 0.0105]];
const innerAt = (y) => {
  for (let i = 1; i < IN.length; i++) {
    const [r0, y0] = IN[i - 1], [r1, y1] = IN[i];
    if (y <= y0 && y >= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1);
  }
  return 0.015;
};

export function makeSaucer() {
  const china = new THREE.MeshPhysicalMaterial({ color: '#f4f1ea', roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  const s = lathe([[0, 0], [0.03, 0], [0.032, 0.002], [0.026, 0.004], [0.05, 0.009], [0.058, 0.0122], [0.0585, 0.0128], [0.057, 0.0128], [0.049, 0.0102], [0.03, 0.0072], [0, 0.0068]], china, 72);
  const gold = new THREE.Mesh(new THREE.TorusGeometry(0.0578, 0.0007, 8, 96), new THREE.MeshStandardMaterial({ color: '#d8ae5a', metalness: 1, roughness: 0.25 }));
  gold.rotation.x = Math.PI / 2;
  gold.position.y = 0.0127;
  const g = new THREE.Group();
  g.add(s, gold);
  return shadows(g);
}

/** The glass with its tea, standing on y = 0 (no saucer). */
export function makeEstekan({ fill = GLASS.tea } = {}) {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0.02, side: THREE.DoubleSide, depthWrite: false });
  const shell = lathe([...OUT, ...IN], glass, 64);
  shell.renderOrder = 3;
  g.add(shell);
  // the tea: a solid of the inside's shape up to `fill`, then its surface (rippled by the scene)
  const tea = new THREE.MeshPhysicalMaterial({ color: '#6b2406', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.93, clearcoat: 1, emissive: '#3a0f02', emissiveIntensity: 0.35 });
  const body = [];
  for (const [r, y] of [...IN].reverse()) if (y < fill) body.push([Math.max(0, r - 0.0006), y]);
  body.push([innerAt(fill) - 0.0006, fill]);
  const teaBody = lathe(body, tea, 48);
  teaBody.renderOrder = 2;
  g.add(teaBody);
  const rTop = innerAt(fill) - 0.0006;
  const surfGeo = new THREE.CircleGeometry(rTop, 48, 0, Math.PI * 2);
  // more rings for a smooth ripple: a polar grid instead of the circle's fan
  const rings = 14, segs = 64;
  const pos = [], idx = [];
  pos.push(0, 0, 0);
  for (let i = 1; i <= rings; i++) for (let j = 0; j < segs; j++) { const r = (i / rings) * rTop, a = (j / segs) * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = 1 + (i - 1) * segs + j, b = 1 + (i - 1) * segs + ((j + 1) % segs), c = 1 + i * segs + j, d = 1 + i * segs + ((j + 1) % segs);
    idx.push(a, b, c, b, d, c);
  }
  surfGeo.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const surf = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#4a1804', roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, emissive: '#2a0b02', emissiveIntensity: 0.4 }));
  surf.position.y = fill;
  surf.renderOrder = 2;
  g.add(surf);
  const base = Float32Array.from(pos);
  g.userData.ripple = (fn) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      p.setY(i, fn(Math.hypot(x, z) / rTop, Math.atan2(z, x)));
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  };
  g.userData.surfaceY = fill;
  return shadows(g, true, false);
}

/** Glass on its saucer. */
export function makeTeaGlass(opts = {}) {
  const g = new THREE.Group();
  const saucer = makeSaucer();
  const glass = makeEstekan(opts);
  glass.position.y = GLASS.saucer - 0.005;
  g.add(saucer, glass);
  g.userData.ripple = glass.userData.ripple;
  g.userData.surface = () => glass.position.y + glass.userData.surfaceY;
  return g;
}
