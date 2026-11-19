// A cast-iron fire bowl on a foot, with two ring handles, a bed of ash and a pile of charcoal: the hearth of
// «Last Ember». One metre across. Everything is made here from lathed profiles and noise-shaped lumps.
import * as THREE from 'three';
import { fbm3, rng } from '../util/noise.mjs';
import { at, lathe, shadows } from '../util/shape.mjs';
import { emberTexture, grainTexture } from '../textures/data.mjs';

export const BOWL = { radius: 0.505, rim: 0.36, ash: 0.215 };

export function ironMaterial() {
  const grain = grainTexture(3);
  return new THREE.MeshStandardMaterial({ color: '#4a423c', metalness: 0.72, roughness: 0.5, roughnessMap: grain, bumpMap: grain, bumpScale: 0.35 });
}

/** The bowl alone (iron), its foot at y = 0. */
export function makeFireBowl() {
  const g = new THREE.Group();
  const iron = ironMaterial();
  iron.roughnessMap.repeat?.set(3, 3);
  const body = lathe([
    [0, 0], [0.2, 0], [0.225, 0.012], [0.225, 0.028], [0.2, 0.04], // the foot ring
    [0.09, 0.055], [0.062, 0.085], [0.07, 0.115], // the waist
    [0.2, 0.14], [0.34, 0.19], [0.44, 0.26], [0.492, 0.325], // the bowl, outside
    [0.505, 0.345], [0.5, 0.36], [0.484, 0.356], // the rolled rim
    [0.43, 0.29], [0.33, 0.222], [0.19, 0.178], [0, 0.166], // the bowl, inside
  ], iron, 96);
  g.add(body);
  // two ring handles hanging from lugs under the rim
  for (const side of [-1, 1]) {
    const lug = at(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 20), iron), side * 0.5, 0.315, 0, 0, 0, Math.PI / 2);
    const ring = at(new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.011, 14, 40), iron), side * 0.538, 0.262, 0, 0, 0, side * 0.32);
    g.add(lug, ring);
  }
  return shadows(g);
}

/** The height of the ash bed at radius r (a low dome that meets the bowl's wall). */
export const ashHeight = (r) => BOWL.ash + 0.075 * Math.pow(Math.min(1, r / 0.42), 2.2) - 0.012 * Math.cos((Math.min(1, r / 0.42)) * Math.PI);

export function makeAshBed() {
  const pts = [];
  for (let i = 14; i >= 0; i--) { const r = (i / 14) * 0.425; pts.push([r, ashHeight(r)]); } // from the wall in to the middle: the top side shows
  const m = lathe(pts, new THREE.MeshStandardMaterial({ color: '#4f4a47', roughness: 1, metalness: 0, bumpMap: grainTexture(5), bumpScale: 2 }), 64);
  const p = m.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, p.getY(i) + (fbm3(x * 9, 0, z * 9, 3, 4) - 0.5) * 0.022);
  }
  m.geometry.computeVertexNormals();
  m.receiveShadow = true;
  return m;
}

/**
 * One lump of charcoal: a broken, slightly flat chunk. Its glow is its own material's emissive map (the heat
 * veins); `mesh.userData.heat(k)` sets how hot it is, 0 (black) to 1 (burning) and above for a flare. `size` is
 * about half its width in metres.
 */
export function makeCoal(seed = 1, size = 0.05) {
  const geo = new THREE.IcosahedronGeometry(1, 4);
  const p = geo.attributes.position;
  const r = rng(seed * 7919 + 13);
  const sx = 0.85 + r() * 0.4, sy = 0.55 + r() * 0.25, sz = 0.8 + r() * 0.35;
  const off = r() * 50;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const lump = fbm3(x * 1.3 + off, y * 1.3, z * 1.3, 3, seed) - 0.5;
    // broken faces: push the surface towards a few planes, as charcoal splits along the grain
    const facet = Math.abs(fbm3(x * 2.6 + off, y * 2.6 + 9, z * 2.6, 2, seed + 3) - 0.5);
    const k = 1 + lump * 0.55 - facet * 0.35;
    p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: '#17120f', roughness: 0.92, metalness: 0, emissive: new THREE.Color('#ff7a2a'), emissiveMap: emberTexture(7 + (seed % 3)), emissiveIntensity: 1.5, bumpMap: grainTexture(5), bumpScale: 1.5 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(size);
  mesh.rotation.set(r() * 6.28, r() * 6.28, r() * 6.28);
  mesh.castShadow = true;
  mesh.userData.heat = (k) => { mat.emissiveIntensity = 2.0 * k; };
  mesh.userData.heat(0.6);
  return mesh;
}

/** The pile: one hero ember on top in the middle and two rings of lumps round it. Returns { group, hero, coals }. */
export function makeCoalPile() {
  const group = new THREE.Group();
  const coals = [];
  const put = (seed, size, rad, ang, lift = 0) => {
    const c = makeCoal(seed, size);
    c.position.set(Math.cos(ang) * rad, ashHeight(rad) + size * 0.42 + lift, Math.sin(ang) * rad);
    c.userData.rad = rad;
    group.add(c);
    coals.push(c);
    return c;
  };
  // a heap: lumps touch and overlap, higher in the middle, the hero on top
  const hero = put(1, 0.074, 0, 0, 0.075);
  for (let i = 0; i < 5; i++) put(10 + i, 0.058 + (i % 3) * 0.005, 0.085, (i / 5) * Math.PI * 2 + 0.3, 0.035);
  for (let i = 0; i < 9; i++) put(30 + i, 0.056 + (i % 4) * 0.004, 0.185, (i / 9) * Math.PI * 2 + 0.1, 0.012);
  for (let i = 0; i < 13; i++) put(60 + i, 0.05 + (i % 3) * 0.005, 0.285, (i / 13) * Math.PI * 2 + 0.22);
  for (let i = 0; i < 12; i++) put(90 + i, 0.036 + (i % 3) * 0.004, 0.365, (i / 12) * Math.PI * 2 + 0.05);
  return { group, hero, coals };
}

/** Bowl, ash and coals together, as it stands in the Short. */
export function makeHearth() {
  const group = new THREE.Group();
  const bowl = makeFireBowl();
  const ash = makeAshBed();
  const pile = makeCoalPile();
  group.add(bowl, ash, pile.group);
  return { ...pile, group, bowl, ash };
}
