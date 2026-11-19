// A foundry crucible in a tilting stand: the graphite pot with a pouring lip, glowing hot at the rim and inside, held
// by a steel band on two trunnions between two uprights, with a lever to tilt it. The pot pours towards +x.
import * as THREE from 'three';
import { at, lathe, shadows } from '../util/shape.mjs';
import { crucibleHeatTexture, grainTexture } from '../textures/data.mjs';

export const CRUCIBLE = { pivotY: 0.56, band: 0.22, lip: [0.212, 0.372], rim: 0.376, half: 0.26 };

export function steelMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#6b7078', metalness: 0.9, roughness: 0.42, roughnessMap: grainTexture(3) });
}

/** The pot alone, its foot at y = 0, lip towards +x. userData.heat(k) sets the glow of its wall; `melt` is the metal's surface. */
export function makeCruciblePot() {
  const mat = new THREE.MeshStandardMaterial({ color: '#2c2724', roughness: 0.86, metalness: 0.05, bumpMap: grainTexture(5), bumpScale: 1.5, emissive: new THREE.Color('#ffffff'), emissiveMap: crucibleHeatTexture(), emissiveIntensity: 1.1 });
  const pot = lathe([
    [0, 0], [0.108, 0], [0.122, 0.018], [0.148, 0.16], [0.164, 0.3], [0.172, 0.36], // outside
    [0.176, 0.376], [0.164, 0.38], // rim
    [0.15, 0.36], [0.136, 0.17], [0.112, 0.055], [0, 0.045], // inside
  ], mat, 96);
  // pinch a pouring lip into the rim on the +x side
  const p = pot.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0.3) continue;
    const ang = Math.atan2(z, x);
    const k = Math.exp(-(ang * ang) / (2 * 0.2 * 0.2)) * Math.min(1, (y - 0.3) / 0.07);
    const r = Math.hypot(x, z) + 0.04 * k;
    p.setXYZ(i, Math.cos(ang) * r, y - 0.008 * k, Math.sin(ang) * r);
  }
  pot.geometry.computeVertexNormals();
  const group = new THREE.Group();
  group.add(pot);
  const melt = new THREE.Mesh(new THREE.CircleGeometry(0.15, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.3, 1.05, 0.2) }));
  melt.rotation.x = -Math.PI / 2;
  melt.position.y = 0.335;
  group.add(melt);
  group.userData.heat = (k) => { mat.emissiveIntensity = 1.1 * k; melt.material.color.setRGB(2.3 * k, 1.05 * k * k, 0.2 * k * k * k); };
  group.userData.melt = melt;
  return shadows(group, true, false);
}

/**
 * Pot and stand. Returns { group, tilt (the part that tips: rotate it with setTilt), setTilt(angle in radians, 0 upright),
 * lipWorld(target Vector3), pot }.
 */
export function makeCrucible() {
  const group = new THREE.Group();
  const steel = steelMaterial();
  // the stand: two uprights with bearing caps, each on its own foot
  // a tie bar behind joins the two feet (no plate under the pot: the mould's rim stands there)
  group.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, CRUCIBLE.half * 2 + 0.05), steel), -0.1, 0.045, 0));
  for (const s of [-1, 1]) {
    group.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.07, CRUCIBLE.pivotY + 0.02, 0.045), steel), 0, (CRUCIBLE.pivotY + 0.02) / 2, s * CRUCIBLE.half));
    group.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.06), steel), 0, 0.015, s * CRUCIBLE.half)); // a foot under each upright
    group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.06, 24), steel), 0, CRUCIBLE.pivotY, s * CRUCIBLE.half, Math.PI / 2));
  }
  // the tipping part: the pot, its band, the trunnion pins and the lever
  const tilt = new THREE.Group();
  tilt.position.y = CRUCIBLE.pivotY;
  const pot = makeCruciblePot();
  pot.position.y = -CRUCIBLE.band;
  tilt.add(pot);
  tilt.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.168, 0.016, 12, 64), steel), 0, 0, 0, Math.PI / 2));
  tilt.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, CRUCIBLE.half * 2 + 0.05, 16), steel), 0, 0, 0, Math.PI / 2));
  // the lever, on the -z side, leaning back
  const lever = new THREE.Group();
  lever.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.36, 12), steel), 0, 0.18, 0));
  lever.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), new THREE.MeshStandardMaterial({ color: '#191513', roughness: 0.6 })), 0, 0.37, 0));
  lever.position.set(0, 0, -CRUCIBLE.half - 0.045);
  lever.rotation.z = 0.5;
  tilt.add(lever);
  group.add(tilt);
  shadows(group);
  const setTilt = (a) => { tilt.rotation.z = -a; };
  const lipWorld = (target) => { group.updateMatrixWorld(true); return target.set(CRUCIBLE.lip[0], CRUCIBLE.lip[1] - CRUCIBLE.band, 0).applyMatrix4(tilt.matrixWorld); };
  return { group, tilt, setTilt, lipWorld, pot };
}
