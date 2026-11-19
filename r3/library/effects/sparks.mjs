// Sparks as glowing points with a closed-form path (so any frame can be drawn on its own): each spark is born at a
// known time, flies up or out, slows in the air, cools from white-yellow to red and dies.
import * as THREE from 'three';
import { rng } from '../util/noise.mjs';
import { glowTexture } from '../textures/data.mjs';

/**
 * bursts: [{ t, n, origin: [x,y,z], speed, spread (0 = straight up, 1 = every way), up (lift m/s²), life, seed, tint }]
 * Returns Points with userData.update(t).
 */
export function makeSparks(bursts, { size = 0.035, gravity = 0, max = 4000 } = {}) {
  const list = [];
  for (const b of bursts) {
    const r = rng((b.seed ?? 1) * 2654435761 + Math.round(b.t * 1000));
    for (let i = 0; i < b.n && list.length < max; i++) {
      const a = r() * Math.PI * 2;
      const tilt = Math.acos(1 - r() * (b.spread ?? 0.4)); // angle from straight up
      const sp = (b.speed ?? 1.5) * (0.35 + 0.65 * r());
      list.push({
        t0: b.t + r() * (b.jitter ?? 0.05), life: (b.life ?? 1.4) * (0.5 + 0.7 * r()), o: b.origin,
        v: [Math.sin(tilt) * Math.cos(a) * sp, Math.cos(tilt) * sp, Math.sin(tilt) * Math.sin(a) * sp],
        up: (b.up ?? 0.5) * (0.6 + 0.8 * r()), sway: r() * 6.28, swayAmp: 0.04 + 0.1 * r(), k: 1.2 + r() * 1.2, tint: b.tint ?? [1, 0.55, 0.16], hot: 0.7 + 0.6 * r(),
      });
    }
  }
  list.sort((a, b) => a.t0 - b.t0);
  const n = Math.max(1, list.length);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const mat = new THREE.PointsMaterial({ size, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  points.userData.count = list.length;
  points.userData.update = (t) => {
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const age = t - s.t0;
      const j = i * 3;
      if (age < 0 || age > s.life) { col[j] = col[j + 1] = col[j + 2] = 0; pos[j + 1] = -99; continue; }
      const d = (1 - Math.exp(-s.k * age)) / s.k; // distance factor under air drag
      const sway = Math.sin(s.sway + age * 3.1) * s.swayAmp * age;
      pos[j] = s.o[0] + s.v[0] * d + sway;
      pos[j + 1] = s.o[1] + s.v[1] * d + 0.5 * (s.up - gravity) * age * age;
      pos[j + 2] = s.o[2] + s.v[2] * d + Math.cos(s.sway + age * 2.3) * s.swayAmp * age;
      const u = age / s.life;
      const fade = Math.pow(1 - u, 1.4) * Math.min(1, age / 0.03);
      const heat = s.hot * (1 - u);
      col[j] = s.tint[0] * fade * (1.6 + 2.2 * heat);
      col[j + 1] = s.tint[1] * fade * (0.7 + 2.2 * heat * heat);
      col[j + 2] = s.tint[2] * fade * (0.2 + 1.8 * heat * heat * heat);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  return points;
}
