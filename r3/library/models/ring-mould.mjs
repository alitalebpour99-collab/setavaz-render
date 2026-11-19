// A round foundry flask packed with dark moulding sand, a ring-shaped channel pressed into it and a pouring basin
// where the metal enters (on the -x side); and the molten metal itself, which fills the channel both ways round
// from the basin until the two fronts meet opposite it.
import * as THREE from 'three';
import { fbm3 } from '../util/noise.mjs';
import { at, lathe, shadows } from '../util/shape.mjs';
import { grainTexture } from '../textures/data.mjs';
import { steelMaterial } from './crucible.mjs';

export const MOULD = { flange: 0.6, band: 0.57, sand: 0.535, top: 0.16, R: 0.34, w: 0.046, basin: 0.085 };

export function makeRingMould() {
  const group = new THREE.Group();
  const steel = steelMaterial();
  const { flange, band, sand, top, R, w } = MOULD;
  group.add(lathe([[sand, 0], [flange, 0], [flange, 0], [flange, 0.022], [flange, 0.022], [band, 0.03], [band, top - 0.03], [flange, top - 0.022], [flange, top - 0.022], [flange, top], [flange, top], [sand, top], [sand, top], [sand, 0]], steel, 96));
  for (const s of [-1, 1]) { // two lifting lugs
    group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 16), steel), 0, top * 0.5, s * (flange + 0.012), Math.PI / 2));
    group.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.03), steel), 0, top * 0.5, s * (band + 0.015)));
  }
  // the sand: flat, with the channel as a half-round groove at radius R
  const pts = [[0, top - 0.004]];
  pts.push([R - w - 0.012, top - 0.004]);
  for (let i = 0; i <= 12; i++) { const a = Math.PI * (i / 12); pts.push([R - w * Math.cos(a), top - 0.004 - w * 0.92 * Math.sin(a)]); }
  pts.push([R + w + 0.012, top - 0.004], [sand, top - 0.004]);
  pts.reverse(); // from the wall in to the middle: the top side shows
  const sandMat = new THREE.MeshStandardMaterial({ color: '#30281f', roughness: 1, metalness: 0, bumpMap: grainTexture(5), bumpScale: 2.5 });
  sandMat.bumpMap.repeat?.set(4, 4);
  const bed = lathe(pts, sandMat, 144);
  // the pouring basin: a shallow cup pressed in at (-R, 0); and a little unevenness everywhere
  const p = bed.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const d = Math.hypot(x + R, z);
    const cup = Math.exp(-(d * d) / (2 * (MOULD.basin * 0.62) ** 2));
    const y = Math.min(p.getY(i), top - 0.004 - 0.05 * cup) + (fbm3(x * 14, 3, z * 14, 2, 8) - 0.5) * 0.004;
    p.setY(i, y);
  }
  bed.geometry.computeVertexNormals();
  bed.receiveShadow = true;
  group.add(bed);
  shadows(group);
  return group;
}

/** An arc of metal lying in the channel: starts at angle π (the basin) and runs `dir` (+1 or -1) round the ring. */
function arcGeometry(dir, N = 120, M = 10) {
  const { R, w, top } = MOULD;
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const a = Math.PI + dir * (i / N) * Math.PI;
    for (let j = 0; j <= M; j++) {
      const b = Math.PI * (j / M); // across the channel, a shallow lens
      const rr = R - w * 0.9 * Math.cos(b);
      const y = top - 0.004 - w * 0.5 + w * 0.2 * Math.sin(b);
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + M + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.userData = { N, M };
  return g;
}

/**
 * The metal in the mould. userData.set(fill 0..1, colour THREE.Color in linear HDR): fill 1 = the ring is closed.
 * userData.front(fill, dir, target) gives where a front is.
 */
export function makeMoltenRing() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1, 0.2), side: THREE.DoubleSide });
  const arcs = [1, -1].map((dir) => new THREE.Mesh(arcGeometry(dir), mat));
  const pool = new THREE.Mesh(new THREE.CircleGeometry(MOULD.basin * 0.8, 32), mat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(-MOULD.R, MOULD.top - 0.03, 0);
  group.add(...arcs, pool);
  group.userData.set = (fill, colour) => {
    const f = Math.min(1, Math.max(0, fill));
    for (const a of arcs) { const { N, M } = a.geometry.userData; a.geometry.setDrawRange(0, Math.round(f * N) * M * 6); a.visible = f > 0.004; }
    pool.visible = fill > 0;
    if (colour) mat.color.copy(colour);
  };
  group.userData.front = (fill, dir, target) => {
    const a = Math.PI + dir * Math.min(1, Math.max(0, fill)) * Math.PI;
    return target.set(Math.cos(a) * MOULD.R, MOULD.top, Math.sin(a) * MOULD.R);
  };
  group.userData.set(0);
  return group;
}

/** The colour of the metal as it cools: heat 1 = just poured (white-yellow), 0 = a dull red about to go dark. */
export function metalColour(heat, target = new THREE.Color()) {
  const h = Math.min(1, Math.max(0, heat));
  const stops = [[0.1, 0.008, 0.003], [0.62, 0.06, 0.008], [1.5, 0.42, 0.03], [2.1, 1.0, 0.18], [2.6, 1.7, 0.6]];
  const x = h * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const k = x - i;
  return target.setRGB(stops[i][0] + (stops[i + 1][0] - stops[i][0]) * k, stops[i][1] + (stops[i + 1][1] - stops[i][1]) * k, stops[i][2] + (stops[i + 1][2] - stops[i][2]) * k);
}
