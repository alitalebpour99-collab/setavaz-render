// The storm over the roof: a deck of dark cloud puffs that light up from inside, and rain that can be held still.
import * as THREE from 'three';
import { rng } from '../util/noise.mjs';
import { glowTexture, puffTexture } from '../textures/data.mjs';

/** Cloud deck. userData.light(flashes): flashes = [{ p: Vector3, k }] lights the puffs near each flash; base is the dark colour. */
export function makeCloudDeck({ n = 150, seed = 5 } = {}) {
  const group = new THREE.Group();
  const r = rng(seed);
  const puffs = [];
  const texA = puffTexture(41), texB = puffTexture(57);
  for (let i = 0; i < n; i++) {
    const near = i < n * 0.2;
    const mat = new THREE.SpriteMaterial({ map: i % 2 ? texA : texB, transparent: true, depthWrite: false, fog: false, opacity: 0.78 + 0.2 * r(), rotation: r() * 6.28 });
    const s = new THREE.Sprite(mat);
    // all the way round the roof: a far wall of cloud down to below the horizon, and a nearer ceiling overhead
    const ang = r() * Math.PI * 2, rad = near ? 10 + r() * 5 : 17 + r() * 14;
    const y = near ? 8 + r() * 8 : -5 + r() * 26;
    s.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
    const size = (near ? 6 : 9) + r() * 8;
    s.scale.set(size * 1.3, size, 1);
    s.renderOrder = 1;
    const shade = 0.6 + 0.6 * r();
    puffs.push({ s, shade, low: Math.max(0, 1 - (y + 5) / 12) });
    group.add(s);
  }
  const base = new THREE.Color();
  const c = new THREE.Color();
  group.userData.light = (flashes, glow = 0) => {
    for (const p of puffs) {
      // dark slate with a warmer underside (the copper light from below), plus the flashes
      base.setRGB(0.045 * p.shade + 0.03 * p.low + glow * 0.05, 0.055 * p.shade + 0.018 * p.low + glow * 0.04, 0.085 * p.shade + 0.008 * p.low + glow * 0.035);
      c.copy(base);
      for (const f of flashes) {
        if (f.k <= 0.002) continue;
        const d = p.s.position.distanceTo(f.p);
        const k = f.k / (1 + (d * d) / (f.reach ?? 40));
        c.r += 0.4 * k; c.g += 0.47 * k; c.b += 0.64 * k;
      }
      p.s.material.color.copy(c);
    }
  };
  group.userData.light([]);
  return group;
}

/**
 * Rain in a box round the origin. userData.update(fall, speed, light): `fall` is how far (m) the rain has fallen so
 * far (it only grows), `speed` 0..1 is how fast it falls now (0 = held still: the drops hang as points), `light` its brightness.
 */
export function makeRain({ n = 1500, box = [9, 9, 8], seed = 9, slant = 0.22 } = {}) {
  const r = rng(seed);
  const drops = Array.from({ length: n }, () => ({ x: (r() - 0.5) * box[0], y: r() * box[1], z: (r() - 0.6) * box[2], v: 0.75 + 0.5 * r() }));
  const lineGeo = new THREE.BufferGeometry();
  const lp = new Float32Array(n * 6);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  const ptGeo = new THREE.BufferGeometry();
  const pp = new Float32Array(n * 3);
  ptGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const ptMat = new THREE.PointsMaterial({ size: 0.05, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
  const points = new THREE.Points(ptGeo, ptMat);
  const group = new THREE.Group();
  group.add(lines, points);
  lines.frustumCulled = points.frustumCulled = false;
  lines.renderOrder = points.renderOrder = 4;
  group.userData.update = (fall, speed, light = 1) => {
    for (let i = 0; i < n; i++) {
      const d = drops[i];
      const drop = fall * d.v;
      const y = ((((d.y - drop) % box[1]) + box[1]) % box[1]) - 1.5;
      const x = ((((d.x + drop * slant + box[0] / 2) % box[0]) + box[0]) % box[0]) - box[0] / 2;
      const len = 0.02 + 0.34 * speed * d.v;
      lp[i * 6] = x; lp[i * 6 + 1] = y; lp[i * 6 + 2] = d.z;
      lp[i * 6 + 3] = x + len * slant; lp[i * 6 + 4] = y - len; lp[i * 6 + 5] = d.z;
      pp[i * 3] = x; pp[i * 3 + 1] = y; pp[i * 3 + 2] = d.z;
    }
    lineGeo.attributes.position.needsUpdate = true;
    ptGeo.attributes.position.needsUpdate = true;
    const still = 1 - Math.min(1, speed * 3);
    lineMat.color.setRGB(0.5 * light, 0.6 * light, 0.85 * light);
    lineMat.opacity = 0.2 + 0.4 * Math.min(1, speed * 2);
    ptMat.color.setRGB(0.75 * light, 0.85 * light, 1.1 * light);
    ptMat.opacity = 0.15 + 0.75 * still;
    ptMat.size = 0.03 + 0.03 * still;
  };
  group.userData.update(0, 0, 1);
  return group;
}
