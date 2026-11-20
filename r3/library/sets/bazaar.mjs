// A covered Persian bazaar street (raste) at golden hour: a barrel vault of fired brick in bays, each bay with a round
// skylight at its crown (the sun comes through it in a slanting shaft), brick arches on pilasters between the bays,
// arched shop fronts on both sides with carpets and copper inside, worn stone paving, and at the far end the bright
// arch of the street's mouth. The street runs along -z from z = 0; its floor is y = 0, its middle x = 0.
// `.userData.hit(origin, dir)` is where a ray from inside meets the floor, a wall or the vault (for light spots).
import * as THREE from 'three';
import { shadows } from '../util/shape.mjs';
import { glowTexture, make } from '../textures/data.mjs';
import { brickBump, brickTexture, kilimTexture, pavingTexture } from '../textures/worlds.mjs';
import { termehTexture } from '../textures/table.mjs';
import { rng } from '../util/noise.mjs';

/**
 * The vault of one bay: the upper half of a cylinder along its own y (rotated into place by the caller), with a round
 * hole at its crown for the skylight (the faces within `hole` metres of the crown are left out; the rim hides the edge).
 */
function vaultGeometry(R, len, hole) {
  const src = new THREE.CylinderGeometry(R, R, len, 120, 36, true, Math.PI / 2, Math.PI).toNonIndexed();
  const p = src.attributes.position, n = src.attributes.normal, uv = src.attributes.uv;
  const keep = { p: [], n: [], uv: [] };
  for (let f = 0; f < p.count; f += 3) {
    let cx = 0, cy = 0;
    for (let k = 0; k < 3; k++) { cx += p.getX(f + k) / 3; cy += p.getY(f + k) / 3; }
    if (Math.hypot(cx, cy) < hole) continue; // the crown is at x = 0 (theta = pi), the bay's middle at y = 0
    for (let k = 0; k < 3; k++) {
      keep.p.push(p.getX(f + k), p.getY(f + k), p.getZ(f + k));
      keep.n.push(n.getX(f + k), n.getY(f + k), n.getZ(f + k));
      keep.uv.push(uv.getX(f + k), uv.getY(f + k));
    }
  }
  src.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(keep.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(keep.n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(keep.uv, 2));
  return g;
}

/** A soft vertical fade (opaque at the top, gone at the bottom) for the light shafts. */
const shaftTexture = () => make(16, (u, v) => [1, 1, 1, Math.pow(v, 1.6) * (0.35 + 0.65 * Math.sin(Math.PI * u))], { repeat: false });

/** The slant of the sun through the skylights: per metre down, it goes 0.15 m along +x and 0.35 m along -z. */
export const SUN_DIR = [0.15, -1, -0.35];
const SUN_TILT = [Math.atan(0.35), Math.atan(0.15)];

export function makeBazaarArcade({ bays = 6, bayLen = 4, width = 4.2, spring = 3.2, seed = 3 } = {}) {
  const g = new THREE.Group();
  const R = width / 2, length = bays * bayLen;
  const r = rng(seed);
  const brickMap = (rx, ry) => { const t = brickTexture().clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t; };
  const bumpMap = (rx, ry) => { const t = brickBump().clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t; };
  const vaultMat = new THREE.MeshStandardMaterial({ map: brickMap(9, 4), bumpMap: bumpMap(9, 4), bumpScale: 1.2, roughness: 0.92, side: THREE.DoubleSide });
  const wallMat = new THREE.MeshStandardMaterial({ map: brickMap(5, 4), bumpMap: bumpMap(5, 4), bumpScale: 1.2, roughness: 0.92 });
  const archMat = new THREE.MeshStandardMaterial({ map: brickMap(10, 0.5), bumpMap: bumpMap(10, 0.5), bumpScale: 1.0, roughness: 0.9, color: '#e6cfae' });
  const pave = pavingTexture().clone();
  pave.repeat.set(2, length / 2.5); pave.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, length + 2), new THREE.MeshStandardMaterial({ map: pave, roughness: 0.55, metalness: 0.02, bumpMap: pave, bumpScale: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -length / 2 + 1;
  floor.receiveShadow = true;
  g.add(floor);

  const shaftTex = shaftTexture();
  const skyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.9), fog: false });
  const shaftMats = [];
  const list = [];
  for (let b = 0; b < bays; b++) {
    const z0 = -b * bayLen, zc = z0 - bayLen / 2;
    // the vault of the bay (upper half of a cylinder along z) with the skylight's hole at its crown; the low sun comes in
    // through it (a bright disc of sky just above the hole, a brick ring round it)
    const vault = new THREE.Mesh(vaultGeometry(R, bayLen, 0.44), vaultMat);
    vault.rotation.x = Math.PI / 2;
    vault.position.set(0, spring, zc);
    vault.receiveShadow = true;
    g.add(vault);
    const sky = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), skyMat);
    sky.rotation.x = Math.PI / 2;
    sky.position.set(0, spring + R + 0.25, zc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.085, 10, 48), archMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, spring + R - 0.02, zc);
    g.add(sky, rim);
    // the shaft: a slanting cone of light from the skylight to the floor (additive, it fades towards the floor)
    const sm = new THREE.MeshBasicMaterial({ map: shaftTex, color: new THREE.Color(1.0, 0.72, 0.4), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    shaftMats.push(sm);
    const H = spring + R - 0.05;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.85, H, 28, 1, true), sm);
    shaft.position.set(0, H / 2, 0);
    const shaftPivot = new THREE.Group();
    shaftPivot.position.set(0, H, zc);
    shaft.position.set(0, -H / 2, 0);
    shaftPivot.add(shaft);
    shaftPivot.rotation.set(SUN_TILT[0], 0, SUN_TILT[1]); // the low sun slants the shafts (as the scene's sun light)
    shaft.renderOrder = 4;
    g.add(shaftPivot);
    // the arch between this bay and the next, on two pilasters
    if (b > 0) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.13, 10, 40, Math.PI), archMat);
      arch.position.set(0, spring, z0);
      g.add(arch);
      for (const s of [-1, 1]) {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.3, spring, 0.36), archMat);
        pil.position.set(s * (R - 0.12), spring / 2, z0);
        g.add(pil);
      }
    }
    // the two walls of the bay, each with an arched shop front, and the shop behind it
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(bayLen, 0); sh.lineTo(bayLen, spring); sh.lineTo(0, spring); sh.lineTo(0, 0);
      const hw = 1.05, cx = bayLen / 2, top = 2.55;
      const hole = new THREE.Path();
      hole.moveTo(cx - hw, 0.12); hole.lineTo(cx + hw, 0.12); hole.lineTo(cx + hw, top - hw);
      hole.absarc(cx, top - hw, hw, 0, Math.PI, false);
      hole.lineTo(cx - hw, 0.12);
      sh.holes.push(hole);
      const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: false, curveSegments: 20 }), wallMat);
      // shape x runs along -z, y up, its depth goes outwards
      wall.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      wall.position.set(s * R + (s < 0 ? -0.25 : 0.25) * 0, 0, s < 0 ? z0 : z0 - bayLen);
      if (s > 0) wall.position.x = R + 0.25;
      else wall.position.x = -R - 0.25;
      wall.castShadow = wall.receiveShadow = true;
      g.add(wall);
      // the shop: a recess with a carpet on its back wall (warm, softly lit from inside) and copper pots on a shelf
      const depth = 1.6;
      const back = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.5), new THREE.MeshStandardMaterial({ map: r() > 0.5 ? kilimTexture() : termehTexture(), roughness: 0.9, emissive: '#3a1a08', emissiveIntensity: 0.6 }));
      back.position.set(s * (R + 0.25 + depth), 1.3, zc);
      back.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      const sideMat = new THREE.MeshStandardMaterial({ color: '#3b2416', roughness: 0.95, emissive: '#1a0c04', emissiveIntensity: 0.6, side: THREE.DoubleSide });
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(depth + 0.3, 2.3), sideMat);
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(s * (R + 0.25 + depth / 2), 2.6, zc);
      const flo = new THREE.Mesh(new THREE.PlaneGeometry(depth + 0.3, 2.3), sideMat);
      flo.rotation.x = -Math.PI / 2;
      flo.position.set(s * (R + 0.25 + depth / 2), 0.12, zc);
      for (const e of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.PlaneGeometry(depth + 0.3, 2.6), sideMat);
        side.position.set(s * (R + 0.25 + depth / 2), 1.3, zc + e * 1.12);
        g.add(side);
      }
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 2.0), sideMat);
      shelf.position.set(s * (R + 0.25 + depth - 0.2), 1.1, zc);
      g.add(back, ceil, flo, shelf);
      const pot = new THREE.MeshStandardMaterial({ color: '#b86b3c', metalness: 0.9, roughness: 0.35 });
      for (let k = 0; k < 4; k++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.11 + 0.04 * r(), 20, 14), pot);
        p.scale.y = 0.8;
        p.position.set(s * (R + 0.25 + depth - 0.2), 1.2, zc - 0.75 + k * 0.5);
        g.add(p);
      }
    }
    list.push({ z: zc, z0, skylight: sky, crownY: spring + R });
  }
  // the street's mouth at the far end: a bright arch onto the evening (its light is what the eye walks towards)
  const zEnd = -length;
  const endWall = new THREE.Shape();
  endWall.moveTo(-R - 0.3, 0); endWall.lineTo(R + 0.3, 0); endWall.lineTo(R + 0.3, spring + R + 0.4); endWall.lineTo(-R - 0.3, spring + R + 0.4); endWall.lineTo(-R - 0.3, 0);
  const door = new THREE.Path();
  door.moveTo(-1.2, 0); door.lineTo(1.2, 0); door.lineTo(1.2, 2.6); door.absarc(0, 2.6, 1.2, 0, Math.PI, false); door.lineTo(-1.2, 0);
  endWall.holes.push(door);
  const end = new THREE.Mesh(new THREE.ExtrudeGeometry(endWall, { depth: 0.3, bevelEnabled: false, curveSegments: 24 }), wallMat);
  end.position.set(0, 0, zEnd - 0.3);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.15, 0.6), fog: false }));
  outside.position.set(0, 2.5, zEnd - 1.2);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(1.2, 0.75, 0.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.scale.set(7, 7, 1);
  glow.position.set(0, 2.0, zEnd - 0.2);
  g.add(end, outside, glow);
  shadows(g, true, true);
  // the light-giving things never block the sun
  floor.castShadow = false;
  g.traverse((m) => { if (m.isMesh && (m.material === skyMat || shaftMats.includes(m.material))) m.castShadow = m.receiveShadow = false; });
  outside.castShadow = false;

  const outsideMat = outside.material;
  const hitV = new THREE.Vector3();
  g.userData = {
    bays: list, width, spring, radius: R, length, bayLen,
    /** k 0..1: how much of the low sun comes in (shafts, skylights, the far arch); tint: a THREE.Color of the light */
    sun(k, tint = new THREE.Color(1, 0.72, 0.4)) {
      for (const m of shaftMats) { m.opacity = 0.42 * k; m.color.copy(tint); }
      skyMat.color.copy(tint).multiplyScalar(0.6 + 2.0 * k);
      outsideMat.color.copy(tint).multiplyScalar(0.5 + 1.6 * k);
      glow.material.opacity = 0.3 + 0.7 * k;
    },
    /** The nearest point where the ray (origin o, unit direction d, in this set's frame) meets the floor, a wall or the vault. */
    hit(o, d) {
      let best = Infinity;
      if (d.y < -1e-6) best = Math.min(best, -o.y / d.y);
      for (const s of [-1, 1]) {
        if (Math.abs(d.x) < 1e-6) continue;
        const t = (s * R - o.x) / d.x;
        if (t > 0 && o.y + d.y * t <= spring) best = Math.min(best, t);
      }
      // the vault: x² + (y - spring)² = R², above the spring line
      const oy = o.y - spring;
      const A = d.x * d.x + d.y * d.y, B = 2 * (o.x * d.x + oy * d.y), C = o.x * o.x + oy * oy - R * R;
      const disc = B * B - 4 * A * C;
      if (A > 1e-9 && disc >= 0) {
        const t = (-B + Math.sqrt(disc)) / (2 * A);
        if (t > 0 && o.y + d.y * t >= spring) best = Math.min(best, t);
      }
      return Number.isFinite(best) ? hitV.copy(d).multiplyScalar(best).add(o).clone() : null;
    },
  };
  g.userData.sun(1);
  return g;
}
