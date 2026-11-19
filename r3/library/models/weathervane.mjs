// A copper weathervane: mast, two globes, the four cardinal arms, and a turning head (arrow with a broad tail, the
// label's four-point star standing on it, a spike on top). About 2.1 m tall; the head turns about the mast.
import * as THREE from 'three';
import { at, shadows, starShape } from '../util/shape.mjs';
import { copperRoughTexture } from '../textures/data.mjs';

export function copperMaterial(extra = {}) {
  return new THREE.MeshStandardMaterial({ color: '#d98a52', metalness: 0.82, roughness: 0.36, roughnessMap: copperRoughTexture(), envMapIntensity: 1.6, ...extra });
}
const cyl = (r, len, m, seg = 20) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
const ball = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), m);
const plate = (shape, depth, m) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.45, bevelSize: depth * 0.45, bevelSegments: 2, curveSegments: 16 });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, m);
};

export const VANE = { height: 2.12, headY: 1.42, tipY: 2.12, arm: 0.46 };

/** Returns { group, head (turns about y), hot (the star's and spike's own material, for the glow after a strike), tip }. */
export function makeWeathervane() {
  const group = new THREE.Group();
  const copper = copperMaterial();
  const hot = copperMaterial({ emissive: new THREE.Color('#ff6a1e'), emissiveIntensity: 0 });

  // the mast and its seat
  group.add(at(cyl(0.028, 1.5, copper), 0, 0.75, 0));
  const seat = new THREE.Mesh(new THREE.LatheGeometry([[0.13, 0], [0.12, 0.03], [0.07, 0.07], [0.04, 0.16], [0.028, 0.26]].map(([r, y]) => new THREE.Vector2(r, y)), 40), copper);
  group.add(seat);
  group.add(at(ball(0.095, copper), 0, 0.47, 0));
  group.add(at(ball(0.06, copper), 0, 1.12, 0));
  // the cardinal arms, each ending in a small ball
  for (let k = 0; k < 2; k++) {
    const arm = at(cyl(0.017, VANE.arm * 2, copper, 14), 0, 0.8, 0, 0, 0, Math.PI / 2);
    const pair = new THREE.Group();
    pair.add(arm, at(ball(0.04, copper), VANE.arm, 0.8, 0), at(ball(0.04, copper), -VANE.arm, 0.8, 0));
    pair.rotation.y = k * Math.PI / 2 + 0.35;
    group.add(pair);
  }
  group.add(at(cyl(0.034, 0.05, copper), 0, 0.8, 0));

  // the head: it alone turns
  const head = new THREE.Group();
  head.position.y = VANE.headY;
  head.add(at(cyl(0.03, 0.09, copper), 0, 0, 0)); // the pivot collar
  head.add(at(cyl(0.021, 0.9, copper, 16), 0, 0, 0, 0, 0, Math.PI / 2)); // the arrow's shaft, along x
  // arrowhead (points to +x)
  const tipS = new THREE.Shape();
  tipS.moveTo(0.27, 0); tipS.lineTo(0, 0.105); tipS.lineTo(0.055, 0); tipS.lineTo(0, -0.105); tipS.closePath();
  head.add(at(plate(tipS, 0.02, copper), 0.42, 0, 0));
  // the tail: a broad swallow-tail fletch (it is what the wind pushes)
  const tailS = new THREE.Shape();
  tailS.moveTo(0, 0.012); tailS.lineTo(-0.17, 0.17); tailS.lineTo(-0.36, 0.17); tailS.lineTo(-0.26, 0.012);
  tailS.lineTo(-0.26, -0.012); tailS.lineTo(-0.36, -0.17); tailS.lineTo(-0.17, -0.17); tailS.lineTo(0, -0.012); tailS.closePath();
  head.add(at(plate(tailS, 0.018, copper), -0.36, 0, 0));
  // the star on its post, and the spike
  head.add(at(cyl(0.016, 0.14, copper, 12), 0, 0.1, 0));
  const star = plate(starShape(0.2), 0.022, hot);
  star.scale.set(0.2, 0.2, 1);
  head.add(at(star, 0, 0.36, 0));
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.16, 12), hot);
  head.add(at(spike, 0, 0.62, 0));
  group.add(head);
  return { group: shadows(group), head, hot, tip: new THREE.Vector3(0, VANE.headY + 0.7, 0) };
}
