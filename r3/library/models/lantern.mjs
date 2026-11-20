// A Persian pierced brass lantern (fanus) as it hangs in a bazaar: an onion finial below, a bulb of brass pierced with
// rows of eight-point stars, a domed cap with a crown of small spikes, a ring and a chain. Lit from inside: through the
// holes one sees the glowing inner wall, and a soft glow round the light. `.userData.light(k)` 0 (out) .. 1 (lit)
// .. 1.6 (blazing). The holes' directions are given (`.userData.holes`, in the lantern's own frame) so a scene can throw
// the star pattern onto its walls. The lantern's top (where the chain is fixed) is at y = 0; it hangs downwards.
import * as THREE from 'three';
import { lathe, shadows } from '../util/shape.mjs';
import { glowTexture, grainTexture } from '../textures/data.mjs';
import { lanternPierceTexture } from '../textures/worlds.mjs';

export const LANTERN = { body: [0.07, 0.31], top: 0.43, chainLink: 0.024 };

export function lanternBrass() {
  return new THREE.MeshStandardMaterial({ color: '#c99a48', metalness: 0.95, roughness: 0.3, roughnessMap: grainTexture(13), bumpMap: grainTexture(13), bumpScale: 0.05 });
}

/** A chain of `n` oval links hanging down from y = 0 (alternate links turned a quarter). */
export function makeChain(n = 12, material = lanternBrass()) {
  const g = new THREE.Group();
  const geo = new THREE.TorusGeometry(0.009, 0.0022, 6, 14);
  geo.scale(1, 1.55, 1);
  for (let i = 0; i < n; i++) {
    const l = new THREE.Mesh(geo, material);
    l.position.y = -(i + 0.5) * LANTERN.chainLink * 0.78;
    l.rotation.y = (i % 2) * Math.PI / 2;
    g.add(l);
  }
  return shadows(g, true, false);
}

/** The lantern alone (its own frame: y = 0 at the bottom of the finial, the hook ring at y = LANTERN.top). */
function makeBody() {
  const brass = lanternBrass();
  const g = new THREE.Group();
  // the bulb, evenly sampled so the texture's v runs with the height
  const [y0, y1] = LANTERN.body;
  const pts = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const k = i / N, y = y0 + (y1 - y0) * k;
    const r = 0.062 + 0.072 * Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.08)), 0.8) - 0.012 * k;
    pts.push(new THREE.Vector2(Math.max(0.03, r), y));
  }
  const pierce = lanternPierceTexture();
  const shellGeo = new THREE.LatheGeometry(pts, 96);
  const shellMat = brass.clone();
  shellMat.alphaMap = pierce; shellMat.alphaTest = 0.5; shellMat.side = THREE.DoubleSide;
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.castShadow = true;
  g.add(shell);
  // the inner wall that glows: a little smaller, seen from inside, pierced the same way
  const innerPts = pts.map((p) => new THREE.Vector2(p.x * 0.965, p.y));
  const glowWall = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb25c'), side: THREE.BackSide, alphaMap: pierce, alphaTest: 0.5, toneMapped: true });
  const inner = new THREE.Mesh(new THREE.LatheGeometry(innerPts, 96), glowWall);
  g.add(inner);
  // below: a base ring and an onion finial
  const foot = lathe([[0, 0], [0.006, 0.0], [0.012, 0.012], [0.02, 0.026], [0.018, 0.04], [0.026, 0.05], [0.05, 0.058], [0.064, y0], [0.06, y0 + 0.004], [0, y0 + 0.004]], brass, 64);
  // above: the domed cap, a neck, a crown ring
  const capR = pts[N].x;
  const cap = lathe([[0, y1 - 0.002], [capR + 0.006, y1 - 0.002], [capR + 0.008, y1 + 0.006], [capR - 0.004, y1 + 0.03], [0.045, y1 + 0.062], [0.026, y1 + 0.082], [0.022, y1 + 0.09], [0.03, y1 + 0.096], [0.028, y1 + 0.102], [0.012, y1 + 0.106], [0, y1 + 0.108]], brass, 72);
  g.add(foot, cap);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.026, 8), brass);
    spike.position.set(Math.cos(a) * (capR + 0.004), y1 + 0.016, Math.sin(a) * (capR + 0.004));
    spike.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(spike);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 8, 24), brass);
  ring.position.y = LANTERN.top - 0.012;
  g.add(ring);
  // the light inside: a small bright core and a soft glow round it (a sprite: it always faces the camera)
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2, 1.1) }));
  core.position.y = (y0 + y1) / 2;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(1.6, 0.95, 0.45), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = (y0 + y1) / 2;
  halo.scale.setScalar(0.55);
  g.add(core, halo);
  shadows(foot); shadows(cap);
  // where the stars' holes look out (unit directions in the lantern's frame, from its centre), for a scene's light spots
  const holes = [];
  const centre = new THREE.Vector3(0, (y0 + y1) / 2, 0);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 8; col++) {
    const v = 0.16 + 0.7 * ((row + 0.5) / 3), k = v, y = y0 + (y1 - y0) * k;
    const r = 0.062 + 0.072 * Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.08)), 0.8) - 0.012 * k;
    const a = ((col + 0.5) / 8) * Math.PI * 2;
    // LatheGeometry: x = r sin(a), z = r cos(a)
    holes.push(new THREE.Vector3(r * Math.sin(a), y, r * Math.cos(a)).sub(centre).normalize());
  }
  const warm = new THREE.Color('#ffb25c');
  g.userData = {
    centre, holes,
    light(k) {
      const c = Math.max(0, k);
      glowWall.color.copy(warm).multiplyScalar(0.06 + 2.2 * c);
      core.visible = c > 0.02;
      core.material.color.setRGB(3 * c, 2 * c, 1.1 * c);
      halo.material.opacity = Math.min(1, 0.9 * c);
      halo.scale.setScalar(0.35 + 0.35 * c);
      shellMat.emissive = shellMat.emissive || new THREE.Color();
      shellMat.emissive.setRGB(0.25 * c, 0.12 * c, 0.03 * c);
    },
  };
  g.userData.light(1);
  return g;
}

/**
 * The lantern hanging from its chain: y = 0 is where it is fixed (the vault), the lantern hangs below it. A long drop
 * is a thin brass rod (`rod` metres) ending in `chain` links, as bazaar lanterns hang.
 */
export function makeLantern({ chain = 10, rod = 0 } = {}) {
  const g = new THREE.Group();
  const brass = lanternBrass();
  if (rod > 0) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, rod, 8), brass);
    r.position.y = -rod / 2;
    r.castShadow = true;
    g.add(r);
  }
  const ch = makeChain(chain, brass);
  ch.position.y = -rod;
  const body = makeBody();
  const drop = rod + chain * LANTERN.chainLink * 0.78;
  body.position.y = -drop - LANTERN.top;
  g.add(ch, body);
  g.userData = {
    body, drop: drop + LANTERN.top,
    centre: body.userData.centre.clone().add(body.position),
    holes: body.userData.holes,
    light: (k) => body.userData.light(k),
  };
  return g;
}

/** The lantern standing on its finial (a turntable or a shop shelf). */
export function makeLanternStanding() {
  return makeBody();
}
