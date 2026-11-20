// A pomegranate, the fruit of Yalda night: whole (a slightly ribbed, glossy deep-red skin with its six-pointed crown)
// or as two halves cut across the middle, each face cream pith full of glossy ruby seeds (arils). About 9 cm across.
// The two halves sit together as a whole fruit until they part; the seeds are instanced so many can fly.
import * as THREE from 'three';
import { fbm3, rng } from '../util/noise.mjs';
import { lathe, shadows } from '../util/shape.mjs';
import { grainTexture } from '../textures/data.mjs';
import { pithTexture } from '../textures/table.mjs';

export const POM = { r: 0.046, h: 0.092, cut: 0.047 };

export function skinMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: '#8c1420', roughness: 0.4, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.35, sheenColor: new THREE.Color('#ff9c86'), sheenRoughness: 0.6, bumpMap: grainTexture(21), bumpScale: 0.5 });
}
export function arilMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: '#a50d2a', roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, emissive: '#4a0410', emissiveIntensity: 0.6 });
}

// the outline of the fruit, bottom to crown (radius, height), and the height where the crown starts
const PROFILE = [[0, 0], [0.008, 0.0012], [0.02, 0.005], [0.032, 0.012], [0.041, 0.023], [0.0458, 0.036], [0.0465, 0.047], [0.0452, 0.058], [0.041, 0.069], [0.033, 0.079], [0.023, 0.086], [0.0135, 0.0905], [0.0105, 0.0915]];
const radiusAt = (y) => {
  for (let i = 1; i < PROFILE.length; i++) if (y <= PROFILE[i][1]) { const [r0, y0] = PROFILE[i - 1], [r1, y1] = PROFILE[i]; return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1); }
  return PROFILE[PROFILE.length - 1][0];
};

/** Five soft ribs and a little unevenness, so the fruit is not a perfect solid of revolution. */
function rib(geo, seed) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.022 * Math.cos(5 * a + 0.4) * Math.sin(Math.min(1, y / POM.h) * Math.PI) + 0.018 * (fbm3(x * 40, y * 40, z * 40, 3, seed) - 0.5);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
}

/** The crown (calyx): a short flared tube that ends in six pointed sepals, dark inside. Its base at y = 0. */
export function makeCrown(material) {
  const g = new THREE.Group();
  const tube = lathe([[0.0104, 0], [0.0098, 0.006], [0.0102, 0.011], [0.0125, 0.0148], [0.0118, 0.0152], [0.0088, 0.0118], [0.008, 0.004]], material, 36);
  tube.material = material.clone();
  tube.material.side = THREE.DoubleSide;
  g.add(tube);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.0034, 0.0085, 10), material);
    s.position.set(Math.cos(a) * 0.0118, 0.0172, Math.sin(a) * 0.0118);
    s.rotation.set(0, 0, 0);
    s.lookAt(Math.cos(a) * 0.05, 0.05, Math.sin(a) * 0.05);
    s.rotateX(Math.PI / 2);
    g.add(s);
  }
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.0085, 20), new THREE.MeshStandardMaterial({ color: '#3a1510', roughness: 0.9 }));
  inside.rotation.x = -Math.PI / 2;
  inside.position.y = 0.006;
  g.add(inside);
  return g;
}

/** The whole fruit, standing on y = 0. */
export function makePomegranate({ seed = 1 } = {}) {
  const g = new THREE.Group();
  const skin = skinMaterial();
  const body = lathe(PROFILE, skin, 64);
  rib(body.geometry, seed);
  g.add(body);
  const crown = makeCrown(skin);
  crown.position.y = PROFILE[PROFILE.length - 1][1] - 0.001;
  crown.rotation.z = 0.12;
  g.add(crown);
  return shadows(g);
}

/** The seeds (arils) packed on a cut face of radius `r`: hexagonal rows, a little jitter, none on the membranes. */
export function arilSpots(r = 0.038, seed = 3) {
  const rand = rng(seed);
  const out = [];
  const d = 0.0078;
  for (let y = -r; y <= r; y += d * 0.87) {
    const row = Math.round((y + r) / (d * 0.87));
    for (let x = -r + (row % 2) * d * 0.5; x <= r; x += d) {
      const px = x + (rand() - 0.5) * 0.0016, pz = y + (rand() - 0.5) * 0.0016;
      const rr = Math.hypot(px, pz), a = Math.atan2(pz, px);
      if (rr > r - 0.002) continue;
      if (Math.abs(Math.sin(a * 3 + 0.4 * Math.sin((rr / r) * 6))) < 0.12 && rr > 0.008) continue; // a membrane
      out.push({ x: px, z: pz, s: 0.85 + 0.3 * rand(), turn: rand() * 6.28, tilt: (rand() - 0.5) * 0.5 });
    }
  }
  return out;
}

/** One seed's shape: a rounded, slightly faceted drop about 8 mm long. */
export function arilGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const top = Math.max(0, y);
    p.setXYZ(i, x * 0.0032 * (1 - 0.18 * top), y * 0.0043, z * 0.0029 * (1 - 0.18 * top));
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Half a fruit, cut across: `top` false is the lower half (standing on its base, the face up at y = POM.cut), `top`
 * true the upper half with the crown (its face down at y = 0, the crown up). Seeds sit in the face as an InstancedMesh.
 */
export function makePomegranateHalf({ top = false, seed = 1 } = {}) {
  const g = new THREE.Group();
  const skin = skinMaterial();
  const cut = POM.cut;
  // the half's own outline, then inwards along the face's rim: the skin's inside is the rind (pinkish)
  const pts = top ? PROFILE.filter(([, y]) => y > cut).map(([r, y]) => [r, y - cut]) : PROFILE.filter(([, y]) => y < cut);
  const rc = radiusAt(cut);
  const shell = lathe(top ? [[rc, 0], ...pts] : [...pts, [rc, cut]], skin, 64);
  rib(shell.geometry, seed);
  shell.material = skin.clone();
  shell.material.side = THREE.DoubleSide;
  g.add(shell);
  const faceY = top ? 0 : cut;
  const face = new THREE.Mesh(new THREE.CircleGeometry(rc * 0.995, 64), new THREE.MeshStandardMaterial({ map: pithTexture(), roughness: 0.75, metalness: 0 }));
  face.rotation.x = top ? Math.PI / 2 : -Math.PI / 2;
  face.position.y = faceY + (top ? -0.0004 : 0.0004);
  g.add(face);
  const spots = arilSpots(rc * 0.82, seed + (top ? 7 : 0));
  const seeds = new THREE.InstancedMesh(arilGeometry(), arilMaterial(), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  spots.forEach((sp, i) => {
    e.set(top ? Math.PI + sp.tilt : sp.tilt, sp.turn, sp.tilt * 0.5);
    q.setFromEuler(e);
    v.set(sp.x, faceY + (top ? -0.0012 : 0.0012), sp.z);
    s.setScalar(sp.s);
    seeds.setMatrixAt(i, m.compose(v, q, s));
  });
  seeds.instanceMatrix.needsUpdate = true;
  g.add(seeds);
  if (top) {
    const crown = makeCrown(skin);
    crown.position.y = PROFILE[PROFILE.length - 1][1] - cut - 0.001;
    crown.rotation.z = 0.12;
    g.add(crown);
  }
  g.userData.seeds = seeds;
  return shadows(g);
}

/** The whole fruit as two halves that can part: `pom.open(k)` 0 closed .. 1 the top half lifted, turned and set down. */
export function makeOpeningPomegranate({ seed = 1 } = {}) {
  const g = new THREE.Group();
  const low = makePomegranateHalf({ top: false, seed });
  const high = makePomegranateHalf({ top: true, seed });
  const hinge = new THREE.Group();
  hinge.add(high);
  g.add(low, hinge);
  // where the top half comes to rest: turned over onto the table beside the lower half, its seeds up, its dome on the
  // cloth (the height is measured so it touches the table and does not sink into it)
  const END = { x: -0.098, z: 0.014, rz: 2.62 };
  hinge.rotation.set(0, 0, END.rz);
  hinge.position.set(0, 0, 0);
  hinge.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(high);
  END.y = -box.min.y;
  const open = (k) => {
    const a = THREE.MathUtils.clamp(k, 0, 1);
    const e = a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2;
    hinge.rotation.set(0, 0, END.rz * e);
    hinge.position.set(END.x * e, POM.cut + (END.y - POM.cut) * e + Math.sin(a * Math.PI) * 0.03, END.z * e);
  };
  open(0);
  g.userData.open = open;
  return { group: g, low, high, open };
}
