// A tall ivory candle in a turned brass candlestick, the light of a Yalda table. The wax glows a little near the flame
// (its emissive rises with the flame's power) and has a soft melted lip; the flame is effects/flame.mjs.
import * as THREE from 'three';
import { lathe, shadows } from '../util/shape.mjs';
import { grainTexture } from '../textures/data.mjs';
import { makeFlame } from '../effects/flame.mjs';

export const CANDLE = { holder: 0.062, wax: 0.17, r: 0.017 };

export function brassMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#c79a4a', metalness: 0.95, roughness: 0.28, roughnessMap: grainTexture(9), bumpMap: grainTexture(9), bumpScale: 0.08 });
}

/** The candlestick alone: a wide foot, a turned stem with two rings, a drip tray and a cup. Its foot at y = 0. */
export function makeCandlestick() {
  const brass = brassMaterial();
  const m = lathe([
    [0, 0], [0.04, 0], [0.043, 0.003], [0.041, 0.007], [0.03, 0.011], [0.018, 0.016], [0.011, 0.022], // the foot
    [0.0085, 0.028], [0.0125, 0.031], [0.0085, 0.034], [0.007, 0.04], [0.0075, 0.046], [0.012, 0.049], [0.008, 0.052], // the stem
    [0.01, 0.054], [0.034, 0.056], [0.036, 0.059], [0.03, 0.06], [0.02, 0.0595], // the drip tray
    [0.019, 0.061], [0.0195, 0.07], [0.0175, 0.0705], [0.017, 0.062], [0, 0.062], // the cup
  ], brass, 72);
  return shadows(m);
}

/** The candle: wax `height` metres on the candlestick, a black wick, a melted lip. `.userData.glow(k)` warms the wax. */
export function makeCandle({ height = CANDLE.wax } = {}) {
  const g = new THREE.Group();
  g.add(makeCandlestick());
  const wax = new THREE.MeshPhysicalMaterial({ color: '#efe4cc', roughness: 0.55, metalness: 0, sheen: 0.4, sheenColor: new THREE.Color('#fff3dd'), emissive: '#ff9a4a', emissiveIntensity: 0.0 });
  const r = CANDLE.r, y0 = CANDLE.holder;
  const body = lathe([[0, 0], [r, 0], [r * 1.002, height * 0.5], [r * 0.995, height - 0.006], [r * 0.97, height - 0.002], [r * 0.82, height - 0.0005], [r * 0.6, height - 0.0035], [0.002, height - 0.005], [0, height - 0.005]], wax, 48);
  body.position.y = y0;
  g.add(body);
  // two drips down the side
  for (const [a, len] of [[0.6, 0.026], [2.9, 0.016]]) {
    const d = new THREE.Mesh(new THREE.CapsuleGeometry(0.0022, len, 4, 10), wax);
    d.position.set(Math.cos(a) * r * 1.01, y0 + height - 0.004 - len / 2, Math.sin(a) * r * 1.01);
    g.add(d);
  }
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0009, 0.009, 8), new THREE.MeshStandardMaterial({ color: '#1a120c', roughness: 0.9 }));
  wick.position.y = y0 + height - 0.0005;
  wick.rotation.z = 0.15;
  g.add(wick);
  g.userData.tip = new THREE.Vector3(0, y0 + height + 0.004, 0);
  g.userData.glow = (k) => { wax.emissiveIntensity = 0.05 + 0.22 * k; };
  g.userData.glow(0.5);
  return shadows(g);
}

/** The candle with its flame and a soft halo; `.userData.set(time, power)` each frame, `.userData.face(camera)`. */
export function makeLitCandle(opts = {}) {
  const c = makeCandle(opts);
  const tip = c.userData.tip;
  const flames = [makeFlame({ w: 0.022, h: 0.05, seed: 0.3 }), makeFlame({ w: 0.014, h: 0.036, seed: 0.8 })];
  for (const f of flames) { f.position.copy(tip); f.position.y -= 0.004; c.add(f); }
  c.userData.set = (time, power) => {
    flames[0].userData.set(time, power, 2.2);
    flames[1].userData.set(time * 1.17 + 2, power * 0.85, 2.6);
    c.userData.glow(power);
  };
  c.userData.face = (camera) => { for (const f of flames) f.userData.face(camera); };
  c.userData.set(1, 0.9);
  return c;
}
