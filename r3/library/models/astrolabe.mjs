// A Persian brass astrolabe, the instrument of the old astronomers of Isfahan and Maragheh: the mater (a thick disc
// with a raised rim engraved with degree marks), the plate inside it engraved with the circles of altitude, the rete
// above it (an openwork star map: an outer ring, the off-centre ring of the zodiac, a cross bar and curved pointers whose
// tips are the stars), the rule across the front, and the throne (kursi) on top with its shackle and ring.
// Its own frame: the disc's centre at the origin, its face towards +z, the ring at the top (`.userData.top`).
// `.userData.turn(a)` turns the rete (radians), `.userData.rule(a)` the rule, `.userData.stars(k)` lights the pointer tips.
// Also a wooden pole with a brass hook to hang it from, planted in the ground (makeAstrolabeStand).
import * as THREE from 'three';
import { shadows } from '../util/shape.mjs';
import { grainTexture } from '../textures/data.mjs';
import { astrolabePlateTexture } from '../textures/worlds.mjs';
import { rng } from '../util/noise.mjs';

export const ASTRO = { r: 0.15, thick: 0.012, ringTop: 0.262 };

export function astroBrass(colour = '#c99a48') {
  return new THREE.MeshStandardMaterial({ color: colour, metalness: 0.95, roughness: 0.27, roughnessMap: grainTexture(37), bumpMap: grainTexture(37), bumpScale: 0.04 });
}

export function makeAstrolabe({ seed = 11 } = {}) {
  const g = new THREE.Group();
  const brass = astroBrass();
  const dark = astroBrass('#a77a33');
  const R = ASTRO.r;
  // the mater and its raised rim
  const mater = new THREE.Mesh(new THREE.CylinderGeometry(R, R, ASTRO.thick, 120), brass);
  mater.rotation.x = Math.PI / 2;
  const limb = new THREE.Mesh(new THREE.TorusGeometry(R - 0.006, 0.0075, 14, 140), brass);
  limb.position.z = ASTRO.thick / 2 + 0.002;
  g.add(mater, limb);
  // degree marks on the rim: a long one every 30°, mid every 10°, short every 5°
  const tick = new THREE.BoxGeometry(0.0016, 0.01, 0.0018); // 1 cm, stretched per mark (the raw geometry stays small for the frame checks)
  const ticks = new THREE.InstancedMesh(tick, dark, 72);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, len = i % 6 === 0 ? 0.014 : i % 2 === 0 ? 0.009 : 0.006;
    const rr = R - 0.016 - len / 2;
    p.set(Math.cos(a) * rr, Math.sin(a) * rr, ASTRO.thick / 2 + 0.0012);
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a - Math.PI / 2);
    s.set(1, len / 0.01, 1);
    ticks.setMatrixAt(i, m4.compose(p, q, s));
  }
  g.add(ticks);
  // the plate, engraved
  const plateMat = new THREE.MeshStandardMaterial({ map: astrolabePlateTexture(), metalness: 0.9, roughness: 0.32, bumpMap: grainTexture(37), bumpScale: 0.03 });
  const plate = new THREE.Mesh(new THREE.CircleGeometry(R - 0.017, 96), plateMat);
  plate.position.z = ASTRO.thick / 2 + 0.0008;
  g.add(plate);
  // the rete: an openwork group turning round the centre, just above the plate
  const rete = new THREE.Group();
  rete.position.z = ASTRO.thick / 2 + 0.0045;
  const bar = (len, w = 0.0035) => new THREE.Mesh(new THREE.BoxGeometry(len, w, 0.0022), brass);
  const outer = new THREE.Mesh(new THREE.TorusGeometry(R - 0.024, 0.0028, 8, 120), brass);
  const zodiac = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.0042, 8, 100), brass);
  zodiac.position.y = 0.034;
  const zodiacIn = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.0018, 6, 100), brass);
  zodiacIn.position.y = 0.034;
  const cross = bar((R - 0.024) * 2);
  const cross2 = bar((R - 0.024) * 2); cross2.rotation.z = Math.PI / 2;
  rete.add(outer, zodiac, zodiacIn, cross, cross2);
  // tracery: small arcs between the rings
  const r = rng(seed);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0018, 6, 30, Math.PI * 1.2), brass);
    arc.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0);
    arc.rotation.z = a + Math.PI * 0.9;
    rete.add(arc);
  }
  // the star pointers: curved flame-like blades from the tracery out to a point; the tip is the star
  const pointers = [];
  const starMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 0.8) });
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0); bladeShape.quadraticCurveTo(0.006, 0.012, 0.0015, 0.03); bladeShape.lineTo(0, 0.034); bladeShape.lineTo(-0.0015, 0.03); bladeShape.quadraticCurveTo(-0.006, 0.012, 0, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.002, bevelEnabled: false, curveSegments: 8 });
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2, rr = 0.05 + 0.065 * r();
    const blade = new THREE.Mesh(bladeGeo, brass);
    const base = new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, -0.001);
    blade.position.copy(base);
    blade.rotation.z = a - Math.PI / 2 + (r() - 0.5) * 1.2;
    rete.add(blade);
    const tipLocal = new THREE.Vector3(0, 0.034, 0.001).applyAxisAngle(new THREE.Vector3(0, 0, 1), blade.rotation.z).add(base);
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 10, 8), starMat);
    star.position.copy(tipLocal);
    rete.add(star);
    pointers.push(star);
  }
  g.add(rete);
  // the rule: a long blade across the front with a pin at the centre
  const ruleG = new THREE.Group();
  ruleG.position.z = ASTRO.thick / 2 + 0.008;
  const ruleBar = new THREE.Mesh(new THREE.BoxGeometry(0.012, (R - 0.02) * 2, 0.0026), brass);
  const ends = [1, -1].map((e) => { const t = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.02, 4), brass); t.position.y = e * (R - 0.02 + 0.006); t.rotation.z = e > 0 ? 0 : Math.PI; t.scale.z = 0.3; return t; });
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 20), dark);
  pin.rotation.x = Math.PI / 2;
  pin.position.z = 0.002;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 16, 12), brass);
  knob.position.z = 0.008; knob.scale.z = 0.6;
  ruleG.add(ruleBar, ...ends, pin, knob);
  g.add(ruleG);
  // the throne on top: an ogee crest with a pierced trefoil, the shackle and the ring
  const crest = new THREE.Shape();
  crest.moveTo(-0.06, R - 0.012);
  crest.bezierCurveTo(-0.055, R + 0.03, -0.02, R + 0.03, -0.018, R + 0.06);
  crest.quadraticCurveTo(0, R + 0.085, 0.018, R + 0.06);
  crest.bezierCurveTo(0.02, R + 0.03, 0.055, R + 0.03, 0.06, R - 0.012);
  crest.lineTo(-0.06, R - 0.012);
  const tre = new THREE.Path();
  tre.absarc(0, R + 0.03, 0.011, 0, Math.PI * 2, false);
  crest.holes.push(tre);
  for (const sx of [-1, 1]) { const h = new THREE.Path(); h.absarc(sx * 0.03, R + 0.012, 0.007, 0, Math.PI * 2, false); crest.holes.push(h); }
  const kursi = new THREE.Mesh(new THREE.ExtrudeGeometry(crest, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 16 }), brass);
  kursi.position.z = -0.006;
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0025, 8, 20), brass);
  shackle.position.set(0, R + 0.09, 0);
  shackle.rotation.y = Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.003, 10, 36), brass);
  ring.position.set(0, ASTRO.ringTop - 0.02, 0);
  g.add(kursi, shackle, ring);
  shadows(g);
  g.userData = {
    rete, pointers, top: new THREE.Vector3(0, ASTRO.ringTop, 0),
    turn: (a) => { rete.rotation.z = a; },
    rule: (a) => { ruleG.rotation.z = a; },
    stars: (k) => { const c = Math.max(0, k); starMat.color.setRGB(0.5 + 1.6 * c, 0.42 + 1.3 * c, 0.25 + 0.8 * c); for (const st of pointers) st.scale.setScalar(1 + 0.6 * c); },
  };
  g.userData.turn(0.4); g.userData.rule(-0.6); g.userData.stars(0.3);
  return g;
}

/** A wooden pole (1.15 m) planted in the ground with an arm and a brass hook; `.userData.hook` is where a ring hangs. */
export function makeAstrolabeStand() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.75, bumpMap: grainTexture(41), bumpScale: 0.8 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 1.15, 16), wood);
  pole.position.y = 0.575;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.3, 14), wood);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.13, 1.1, 0);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), astroBrass());
  cap.position.y = 1.16;
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.003, 8, 20, Math.PI * 1.4), astroBrass());
  hook.position.set(0.26, 1.075, 0);
  hook.rotation.set(0, Math.PI / 2, Math.PI * 0.8);
  g.add(pole, arm, cap, hook);
  shadows(g);
  g.userData = { hook: new THREE.Vector3(0.26, 1.06, 0) };
  return g;
}
