// Inside a car at night, for «Night Drive»: the instrument cluster (two round gauges in chrome bezels with backlit faces
// and orange needles, under a curved hood), the steering wheel, and the rear-view mirror with the charm that hangs from
// it (a gold four-point star, the Setavaz star, and a blue glass nazar bead on a cord). The charm swings:
// `.userData.swing(angleX, angleZ)`.
import * as THREE from 'three';
import { lathe, shadows, starShape } from '../util/shape.mjs';
import { dialTexture } from '../textures/table.mjs';

const chrome = () => new THREE.MeshStandardMaterial({ color: '#d9dde4', metalness: 1, roughness: 0.16 });
const softBlack = () => new THREE.MeshStandardMaterial({ color: '#141418', roughness: 0.72, metalness: 0.05 });

/** One gauge: a chrome bezel ring, a backlit face, an orange needle on a centre cap. `.userData.needle(k)` 0..1. */
export function makeGauge(r = 0.05) {
  const g = new THREE.Group();
  const bezel = lathe([[r * 0.98, 0], [r * 1.1, 0], [r * 1.12, 0.006], [r * 1.06, 0.011], [r * 0.99, 0.009]], chrome(), 64);
  bezel.rotation.x = Math.PI / 2;
  const faceMat = new THREE.MeshStandardMaterial({ map: dialTexture(), emissiveMap: dialTexture(), emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.6 });
  const face = new THREE.Mesh(new THREE.CircleGeometry(r, 64), faceMat);
  face.position.z = -0.002;
  const needleMat = new THREE.MeshStandardMaterial({ color: '#ff5a1a', emissive: '#ff4a10', emissiveIntensity: 2.4, roughness: 0.4 });
  const needle = new THREE.Mesh(new THREE.BoxGeometry(r * 0.82, r * 0.035, 0.0015), needleMat);
  needle.geometry.translate(r * 0.33, 0, 0);
  const pivot = new THREE.Group();
  pivot.position.z = 0.002;
  pivot.add(needle);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.1, r * 0.11, 0.006, 24), softBlack());
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.004;
  // a thin glass over the face catches the passing lights
  const glass = new THREE.Mesh(new THREE.CircleGeometry(r * 1.0, 48), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, roughness: 0.02, clearcoat: 1, depthWrite: false }));
  glass.position.z = 0.007;
  g.add(bezel, face, pivot, cap, glass);
  // the needle sweeps the face's 240-degree scale: 0 at 210 degrees, 1 at -30 degrees
  g.userData.needle = (k) => { pivot.rotation.z = ((210 - 240 * THREE.MathUtils.clamp(k, 0, 1.05)) * Math.PI) / 180; };
  g.userData.light = (k) => { faceMat.emissiveIntensity = 0.5 + 0.8 * k; needleMat.emissiveIntensity = 1.6 + 1.6 * k; };
  g.userData.needle(0);
  return g;
}

/** The cluster: two gauges in a black binnacle under a curved hood, facing +z (toward the driver). */
export function makeCluster() {
  const g = new THREE.Group();
  const shell = softBlack();
  // the binnacle: a rounded box, and the hood: a curved strip over it
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.13, 0.06), shell);
  box.position.z = -0.03;
  const hoodShape = new THREE.Shape();
  hoodShape.absarc(0, 0, 0.07, 0, Math.PI, false);
  hoodShape.absarc(0, 0, 0.062, Math.PI, 0, true);
  const hood = new THREE.Mesh(new THREE.ExtrudeGeometry(hoodShape, { depth: 0.31, bevelEnabled: false, curveSegments: 24 }), shell);
  hood.rotation.y = Math.PI / 2;
  hood.position.set(-0.155, 0.0, 0.03);
  hood.scale.set(1, 1, 1);
  const left = makeGauge(0.052), right = makeGauge(0.052);
  left.position.set(-0.068, 0, 0.002);
  right.position.set(0.068, 0, 0.002);
  g.add(box, hood, left, right);
  g.userData.gauges = [left, right];
  return shadows(g, true, true);
}

/** A three-spoke steering wheel with a leather rim, facing +z. */
export function makeSteeringWheel(r = 0.19) {
  const g = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: '#1a1716', roughness: 0.55, metalness: 0 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 18, 96), leather);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.03, 40), leather);
  hub.rotation.x = Math.PI / 2;
  const badge = new THREE.Mesh(new THREE.ShapeGeometry(starShape(0.24), 4), new THREE.MeshStandardMaterial({ color: '#d4a54e', metalness: 1, roughness: 0.25 }));
  badge.scale.setScalar(0.016);
  badge.position.z = 0.016;
  g.add(rim, hub, badge);
  for (const a of [Math.PI / 2 + Math.PI, Math.PI * 0.1 + Math.PI, Math.PI * 0.9 + Math.PI]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(r - 0.05, 0.024, 0.012), leather);
    spoke.geometry.translate((r - 0.05) / 2 + 0.045, 0, 0);
    spoke.rotation.z = a;
    g.add(spoke);
  }
  return shadows(g);
}

/** The nazar bead: cobalt glass with the white, pale blue and dark blue eye on its front (+z). */
export function makeNazar(r = 0.011) {
  const g = new THREE.Group();
  const glassy = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0 });
  const bead = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), glassy('#1336a8'));
  g.add(bead);
  const caps = [[0.62, '#f2f2ee', 1.004], [0.42, '#7fc4ee', 1.008], [0.22, '#0b1438', 1.012]];
  for (const [k, c, s] of caps) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r * s, 32, 8, 0, Math.PI * 2, 0, Math.asin(k)), glassy(c));
    cap.rotation.x = Math.PI / 2;
    g.add(cap);
  }
  return g;
}

/**
 * The rear-view mirror on its stem (fixed to the roof at the origin), with the charm on a cord below it. `swing(x, z)`
 * turns the cord about the mirror's foot (radians). `.userData.charm` is the swinging part.
 */
export function makeMirrorCharm() {
  const g = new THREE.Group();
  const black = softBlack();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.06, 16), black);
  stem.position.y = -0.03;
  // the mirror: a rounded slab, its glass toward the driver (+z)
  const shape = new THREE.Shape();
  const W = 0.12, H = 0.045, R = 0.02;
  shape.moveTo(-W + R, -H); shape.lineTo(W - R, -H); shape.quadraticCurveTo(W, -H, W, -H + R); shape.lineTo(W, H - R); shape.quadraticCurveTo(W, H, W - R, H);
  shape.lineTo(-W + R, H); shape.quadraticCurveTo(-W, H, -W, H - R); shape.lineTo(-W, -H + R); shape.quadraticCurveTo(-W, -H, -W + R, -H);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 3, curveSegments: 10 }), black);
  body.position.set(0, -0.08, -0.009);
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(shape, 10), new THREE.MeshStandardMaterial({ color: '#8e9bb0', metalness: 1, roughness: 0.04 }));
  glass.scale.setScalar(0.94);
  glass.position.set(0, -0.08, 0.0145);
  g.add(stem, body, glass);
  // the charm: cord, a gold star, the bead
  const charm = new THREE.Group();
  charm.position.set(0.0, -0.06, 0.0);
  const cordLen = 0.13;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, cordLen, 6), new THREE.MeshStandardMaterial({ color: '#9b1d2a', roughness: 0.7 }));
  cord.position.y = -cordLen / 2;
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b25a', metalness: 1, roughness: 0.2, emissive: '#3a2604', emissiveIntensity: 0.3 });
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(0.22), { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 6 }), gold);
  star.geometry.center();
  star.scale.setScalar(0.024);
  star.position.y = -cordLen - 0.026;
  const bead = makeNazar(0.011);
  bead.position.y = -cordLen + 0.018;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0035, 0.0009, 8, 20), gold);
  ring.position.y = -cordLen - 0.0015;
  charm.add(cord, bead, ring, star);
  g.add(charm);
  g.userData.charm = charm;
  g.userData.star = star;
  g.userData.swing = (x, z) => { charm.rotation.set(x, 0, z); star.rotation.y = z * 2.4; };
  return shadows(g);
}

/** The dashboard top: a wide, gently curved slab of soft black, from the windscreen's foot toward the driver. */
export function makeDashboard(w = 1.5) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(0.42, 0); shape.quadraticCurveTo(0.5, 0.0, 0.52, -0.06); shape.lineTo(0.52, -0.16); shape.lineTo(0, -0.16);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 16 });
  geo.translate(0, 0, -w / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#16161b', roughness: 0.82 }));
  m.rotation.y = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}
