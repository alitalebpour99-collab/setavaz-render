// A spice seller's stall in a Persian bazaar: hammered copper bowls heaped into cones of ground spice (turmeric, sumac,
// saffron, dried rose, cardamom, cinnamon) on a low walnut table under a striped awning-cloth. The cones are rough
// heaps, not smooth cones: their surface is displaced by noise. `.userData.cones` gives each heap's top (for puffs of
// coloured dust) and its colour.
import * as THREE from 'three';
import { lathe, shadows } from '../util/shape.mjs';
import { grainTexture, copperRoughTexture } from '../textures/data.mjs';
import { kilimTexture } from '../textures/worlds.mjs';
import { fbm3, rng } from '../util/noise.mjs';

export const SPICES = [
  { id: 'turmeric', colour: '#d99a1a' },
  { id: 'sumac', colour: '#7c1f22' },
  { id: 'saffron', colour: '#c8410e' },
  { id: 'rose', colour: '#b85a78' },
  { id: 'cardamom', colour: '#6f7a34' },
  { id: 'cinnamon', colour: '#8a4a26' },
];

function copper() {
  return new THREE.MeshStandardMaterial({ color: '#b86b3c', metalness: 0.95, roughness: 0.32, roughnessMap: copperRoughTexture(), bumpMap: grainTexture(17), bumpScale: 0.25 });
}

/** One bowl (radius about 0.13 m) with its heap of spice, the bowl's foot at y = 0. */
export function makeSpiceBowl({ colour = '#d99a1a', seed = 1, heap = 0.15 } = {}) {
  const g = new THREE.Group();
  const bowl = lathe([[0, 0], [0.05, 0], [0.052, 0.006], [0.046, 0.01], [0.09, 0.03], [0.124, 0.058], [0.132, 0.07], [0.128, 0.072], [0.118, 0.062], [0.085, 0.036], [0, 0.018]], copper(), 72);
  g.add(shadows(bowl));
  // the heap: a cone whose surface is pushed in and out by noise, slumped at the bottom into the bowl
  const geo = new THREE.ConeGeometry(0.095, heap, 64, 16, true);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = (y + heap / 2) / heap; // 0 at the base, 1 at the top
    const n = fbm3(x * 40 + seed, y * 40, z * 40, 3, seed) - 0.5;
    const s = 1 + n * 0.22 * (1 - k * 0.6) + 0.12 * Math.pow(1 - k, 3); // rougher low, slumped base
    p.setXYZ(i, x * s, y + n * 0.006, z * s);
  }
  geo.computeVertexNormals();
  const spice = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.95, metalness: 0, bumpMap: grainTexture(23), bumpScale: 1.2 });
  const cone = new THREE.Mesh(geo, spice);
  cone.position.y = 0.056 + heap / 2;
  cone.castShadow = cone.receiveShadow = true;
  g.add(cone);
  g.userData = { top: new THREE.Vector3(0, 0.056 + heap, 0), colour: new THREE.Color(colour), spice };
  return g;
}

/** The stall: a low walnut table (1.5 x 0.75 m, 0.55 m high) with a kilim runner and six bowls of spice. */
export function makeSpiceStall({ seed = 5 } = {}) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#4b2e1c', roughness: 0.6, metalness: 0, bumpMap: grainTexture(29), bumpScale: 0.6 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.75), wood);
  top.position.y = 0.525;
  g.add(top);
  for (const [x, z] of [[-0.7, -0.32], [0.7, -0.32], [-0.7, 0.32], [0.7, 0.32]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), wood);
    leg.position.set(x, 0.25, z);
    g.add(leg);
  }
  const apron = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.07, 0.68), wood);
  apron.position.y = 0.47;
  g.add(apron);
  const kTex = kilimTexture().clone();
  kTex.repeat.set(1, 1); kTex.needsUpdate = true;
  const runner = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.006, 0.42), new THREE.MeshStandardMaterial({ map: kTex, roughness: 0.92 }));
  runner.position.set(0, 0.553, 0.02);
  g.add(runner);
  // the runner hangs over the front edge
  const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshStandardMaterial({ map: kTex, roughness: 0.92, side: THREE.DoubleSide }));
  flap.rotation.y = Math.PI / 2; flap.position.set(0.78, 0.47, 0.02);
  g.add(flap);
  const r = rng(seed);
  const cones = [];
  SPICES.forEach((s, i) => {
    const b = makeSpiceBowl({ colour: s.colour, seed: seed * 10 + i, heap: 0.13 + 0.05 * r() });
    const col = i % 3, row = Math.floor(i / 3);
    b.position.set(-0.48 + col * 0.48 + (row ? 0.12 : 0), 0.556, -0.14 + row * 0.3);
    b.rotation.y = r() * 6;
    g.add(b);
    cones.push({ id: s.id, bowl: b, colour: b.userData.colour });
  });
  shadows(g);
  g.userData = { cones, surface: 0.556 };
  return g;
}
