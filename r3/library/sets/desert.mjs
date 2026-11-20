// The Kahkeshan world's night desert (Dasht-e Lut, Maranjab): rolling dunes with sharp crests, flat near the camp so
// things stand on it, and the Milky Way («kahkeshan») across the sky: a dense band of faint stars with a warm core and
// dark dust lanes, a soft glow along it, and the brighter stars around. Everything is closed-form and seeded.
import * as THREE from 'three';
import { fbm3, rng, smooth } from '../util/noise.mjs';
import { glowTexture } from '../textures/data.mjs';
import { sandBump, sandTexture } from '../textures/worlds.mjs';

/** The dunes' height at (x, z), in metres. Flat (0) within `flat` metres of the origin, rising beyond. */
export function duneHeight(x, z, { flat = 5, seed = 7 } = {}) {
  const d = Math.hypot(x, z);
  const k = smooth((d - flat) / 14);
  // long crests across the wind (from the north-west), their lee sides steeper; a slow swell under them
  const w = (x * 0.8 + z * 0.6) * 0.055 + 1.8 * fbm3(x * 0.012, 0, z * 0.012, 3, seed);
  const crest = Math.pow(1 - Math.abs(Math.sin(w * Math.PI)), 1.8);
  const swell = fbm3(x * 0.02, 5, z * 0.02, 3, seed + 3);
  return k * (4.2 * crest * (0.6 + 0.6 * swell) + 3.0 * swell);
}

export function makeDunes({ size = 180, seg = 220, flat = 5, seed = 7 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, duneHeight(p.getX(i), p.getZ(i), { flat, seed }));
  geo.computeVertexNormals();
  const map = sandTexture().clone(); map.repeat.set(size / 6, size / 6); map.needsUpdate = true;
  const bump = sandBump().clone(); bump.repeat.set(size / 6, size / 6); bump.needsUpdate = true;
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.8, roughness: 0.95, metalness: 0 }));
  m.receiveShadow = true;
  return m;
}

/**
 * The Milky Way: `n` faint stars in a band round the sky (a great circle tilted by `tilt` about x and turned `turn`
 * about y), densest and warmest towards its core, cut by dust lanes; a soft glow of large sprites along it.
 * `.userData.glow(k)` brightens it (k about 1 normal); `.userData.spin(a)` turns the whole sky about the pole.
 */
export function makeMilkyWay({ n = 9000, radius = 75, seed = 13, tilt = 1.05, turn = 0.5, core = 0.6 } = {}) {
  const r = rng(seed);
  const gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += r(); return (s - 2) / 0.58; };
  const sky = new THREE.Group();
  const band = new THREE.Group();
  band.rotation.set(tilt, turn, 0);
  sky.add(band);
  // stars: positions on the sphere in the band's own frame (the band is the x-z great circle), colours by place
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const warm = new THREE.Color(1.0, 0.82, 0.62), cool = new THREE.Color(0.75, 0.85, 1.1), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const lon = r() * Math.PI * 2;
    const toCore = Math.cos(lon - core); // 1 at the core
    const width = 0.09 + 0.07 * (0.5 + 0.5 * toCore);
    const lat = gauss() * width;
    const dust = fbm3(Math.cos(lon) * 3, lat * 14, Math.sin(lon) * 3, 3, seed + 5);
    const lane = Math.abs(lat) < 0.035 && dust > 0.5 ? 0.25 : 1;
    const b = (0.35 + 0.65 * r()) * Math.exp(-Math.pow(lat / (width * 1.6), 2)) * (0.55 + 0.45 * (0.5 + 0.5 * toCore)) * lane;
    pos[i * 3] = Math.cos(lat) * Math.cos(lon) * radius; pos[i * 3 + 1] = Math.sin(lat) * radius; pos[i * 3 + 2] = Math.cos(lat) * Math.sin(lon) * radius;
    c.copy(cool).lerp(warm, Math.max(0, toCore) * 0.8).multiplyScalar(b * 1.4);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const starMat = new THREE.PointsMaterial({ size: 0.32, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true });
  const stars = new THREE.Points(geo, starMat);
  stars.frustumCulled = false;
  band.add(stars);
  // the glow: large soft sprites along the band, warm near the core
  const glowMats = [];
  for (let i = 0; i < 140; i++) {
    const lon = (i / 140) * Math.PI * 2 + r() * 0.05;
    const toCore = Math.cos(lon - core);
    const lat = gauss() * 0.05;
    const m = new THREE.SpriteMaterial({ map: glowTexture(), color: cool.clone().lerp(warm, Math.max(0, toCore)).multiplyScalar(0.05 + 0.07 * (0.5 + 0.5 * toCore)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    glowMats.push({ m, base: m.color.clone() });
    const sp = new THREE.Sprite(m);
    sp.position.set(Math.cos(lat) * Math.cos(lon) * radius * 0.98, Math.sin(lat) * radius * 0.98, Math.cos(lat) * Math.sin(lon) * radius * 0.98);
    sp.scale.setScalar(radius * (0.16 + 0.1 * (0.5 + 0.5 * toCore)));
    band.add(sp);
  }
  // the brighter stars all over the sky
  const bright = [];
  const m2 = 420;
  const p2 = new Float32Array(m2 * 3), c2 = new Float32Array(m2 * 3);
  for (let i = 0; i < m2; i++) {
    const y = 0.02 + 0.98 * r(), a = r() * Math.PI * 2, h = Math.sqrt(1 - y * y);
    p2[i * 3] = Math.cos(a) * h * radius * 0.97; p2[i * 3 + 1] = y * radius * 0.97; p2[i * 3 + 2] = Math.sin(a) * h * radius * 0.97;
    const b = 0.5 + 1.3 * Math.pow(r(), 3), tint = r();
    c.setRGB(b * (0.9 + 0.15 * tint), b * 0.95, b * (1.15 - 0.2 * tint));
    c2[i * 3] = c.r; c2[i * 3 + 1] = c.g; c2[i * 3 + 2] = c.b;
    if (b > 1.25 && y > 0.25) bright.push(new THREE.Vector3(p2[i * 3], p2[i * 3 + 1], p2[i * 3 + 2]));
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.BufferAttribute(p2, 3));
  g2.setAttribute('color', new THREE.BufferAttribute(c2, 3));
  const brightMat = new THREE.PointsMaterial({ size: 0.7, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true });
  const brightPts = new THREE.Points(g2, brightMat);
  brightPts.frustumCulled = false;
  sky.add(brightPts);
  sky.userData = {
    bright, radius,
    glow(k) {
      const g = Math.max(0, k);
      starMat.opacity = Math.min(1, 0.75 * g); starMat.size = 0.3 + 0.08 * g;
      for (const { m, base } of glowMats) m.color.copy(base).multiplyScalar(g);
      brightMat.opacity = Math.min(1, 0.65 + 0.35 * g); brightMat.size = 0.62 + 0.18 * g;
    },
    spin(a) { sky.rotation.y = a; },
  };
  sky.userData.glow(1);
  return sky;
}
