// A daf, the large Persian frame drum of the Sufi circles: a wide wooden hoop (about 0.5 m across) with a goat skin
// stretched over one face, and the small iron rings hung all round the inside of the frame that rustle when it is struck.
// Its own frame: the skin faces +z, the hoop's centre at the origin. `.userData.strike(k, t)` makes the skin glow a
// little and the rings swing (k 0..1, t the time, so a still frame is the same on every machine).
import * as THREE from 'three';
import { shadows } from '../util/shape.mjs';
import { grainTexture } from '../textures/data.mjs';
import { dafSkinTexture } from '../textures/worlds.mjs';

export const DAF = { r: 0.245, depth: 0.065 };

export function makeDaf({ rings = 44 } = {}) {
  const g = new THREE.Group();
  const R = DAF.r, D = DAF.depth;
  const wood = new THREE.MeshStandardMaterial({ color: '#7a4a26', roughness: 0.55, metalness: 0, bumpMap: grainTexture(43), bumpScale: 0.5 });
  // the hoop: outside and inside of a short open cylinder, and its two rounded edges
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(R, R, D, 96, 1, true), wood);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.012, R - 0.012, D, 96, 1, true), wood.clone());
  inner.material.side = THREE.BackSide;
  for (const m of [outer, inner]) m.rotation.x = Math.PI / 2;
  const edgeBack = new THREE.Mesh(new THREE.TorusGeometry(R - 0.006, 0.0062, 8, 96), wood);
  edgeBack.position.z = -D / 2;
  const edgeFront = new THREE.Mesh(new THREE.TorusGeometry(R - 0.004, 0.0065, 8, 96), wood);
  edgeFront.position.z = D / 2;
  g.add(outer, inner, edgeBack, edgeFront);
  // the skin over the front face, a little domed
  const skinMat = new THREE.MeshStandardMaterial({ map: dafSkinTexture(), roughness: 0.75, metalness: 0, emissive: '#ffb070', emissiveIntensity: 0, side: THREE.DoubleSide });
  const skinGeo = new THREE.CircleGeometry(R - 0.002, 72, 0, Math.PI * 2);
  const sp = skinGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i); sp.setZ(i, 0.004 * (1 - (x * x + y * y) / (R * R))); }
  skinGeo.computeVertexNormals();
  const skin = new THREE.Mesh(skinGeo, skinMat);
  skin.position.z = D / 2 + 0.001;
  g.add(skin);
  // the rings, each on a small hook inside the frame, near the back
  const iron = new THREE.MeshStandardMaterial({ color: '#8d8a86', metalness: 0.9, roughness: 0.35 });
  const ringGeo = new THREE.TorusGeometry(0.011, 0.0018, 6, 18);
  const ringsG = [];
  for (let i = 0; i < rings; i++) {
    const a = (i / rings) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * (R - 0.018), Math.sin(a) * (R - 0.018), -D / 2 + 0.018 + (i % 2) * 0.012);
    pivot.rotation.z = a; // local x points out from the centre
    const ring = new THREE.Mesh(ringGeo, iron);
    ring.rotation.x = Math.PI / 2; // in the plane of the radius and the drum's depth, as it hangs on its hook
    ring.position.set(-0.011, 0, 0); // a ring's radius in from the frame
    const holder = new THREE.Group();
    holder.add(ring);
    pivot.add(holder);
    g.add(pivot);
    ringsG.push({ holder, phase: i * 1.7 });
  }
  shadows(g);
  g.userData = {
    strike(k, t = 0) {
      const c = Math.max(0, k);
      skinMat.emissiveIntensity = 0.12 * c;
      for (const r of ringsG) r.holder.rotation.z = (0.08 + 0.5 * c) * Math.sin(t * 23 + r.phase);
    },
  };
  g.userData.strike(0, 0);
  return g;
}
