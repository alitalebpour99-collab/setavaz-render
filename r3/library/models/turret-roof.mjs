// The top of a turret roof clad in copper gone green: twelve flat faces rising in a bell curve to the point where
// the weathervane stands. Its apex is at y = 0; it goes down from there.
import * as THREE from 'three';
import { verdigrisTexture, grainTexture } from '../textures/data.mjs';

export function makeTurretRoof() {
  // from the middle of the underside out to the eave, then up the bell curve to the apex
  const profile = [[0, -2.72], [1.98, -2.72], [2.02, -2.66], [1.9, -2.6], [1.3, -2.15], [0.86, -1.7], [0.5, -1.2], [0.28, -0.72], [0.17, -0.3], [0.13, -0.05], [0.1, 0]];
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 12);
  const tex = verdigrisTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, color: '#ffffff', metalness: 0.25, roughness: 0.78, bumpMap: grainTexture(3), bumpScale: 0.6, flatShading: true });
  const roof = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.add(roof);
  // a rolled seam along each of the twelve ridges
  const seamMat = new THREE.MeshStandardMaterial({ color: '#3f7f72', metalness: 0.3, roughness: 0.7 });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const pts = profile.slice(3).map(([r, y]) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 40, 0.018, 8), seamMat);
    group.add(tube);
  }
  // the cap the mast stands in
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.06, 24), new THREE.MeshStandardMaterial({ color: '#b56e3e', metalness: 1, roughness: 0.4 }));
  cap.position.y = 0.0;
  group.add(cap);
  group.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return group;
}
