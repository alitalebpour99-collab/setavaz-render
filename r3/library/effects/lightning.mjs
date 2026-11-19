// A lightning bolt as fat lines: one jagged main channel from a point in the cloud to where it lands, and a few
// thinner branches. The shape is fixed by its seed; `set(k)` lights it (0 = gone).
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { rng } from '../util/noise.mjs';

/** Midpoint displacement between a and b: `levels` halvings, sideways jitter `rough` times the span. */
export function boltPath(a, b, { levels = 6, rough = 0.16, seed = 1 } = {}) {
  const r = rng(seed * 977 + 5);
  let pts = [a.clone(), b.clone()];
  let amp = a.distanceTo(b) * rough;
  for (let l = 0; l < levels; l++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const m = pts[i].clone().add(pts[i + 1]).multiplyScalar(0.5);
      m.x += (r() - 0.5) * 2 * amp;
      m.z += (r() - 0.5) * 2 * amp * 0.6;
      m.y += (r() - 0.5) * amp * 0.5;
      next.push(m, pts[i + 1]);
    }
    pts = next;
    amp *= 0.52;
  }
  return pts;
}

function fat(points, width, resolution) {
  const g = new LineGeometry();
  g.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
  const m = new LineMaterial({ color: 0xffffff, linewidth: width, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, worldUnits: false });
  m.resolution.set(resolution[0], resolution[1]);
  const line = new Line2(g, m);
  line.frustumCulled = false;
  line.renderOrder = 7;
  return line;
}

/** from, to: THREE.Vector3. width in pixels of the render. */
export function makeBolt({ from, to, seed = 1, width = 7, branches = 3, resolution = [1080, 1920], tint = [0.72, 0.82, 1] }) {
  const group = new THREE.Group();
  const main = boltPath(from, to, { seed });
  const lines = [{ line: fat(main, width, resolution), k: 1 }];
  const r = rng(seed * 31 + 7);
  for (let b = 0; b < branches; b++) {
    const i = Math.floor((0.15 + 0.6 * r()) * (main.length - 1));
    const start = main[i];
    const len = from.distanceTo(to) * (0.14 + 0.2 * r());
    const dir = new THREE.Vector3((r() - 0.5) * 1.6, -0.7 - 0.5 * r(), (r() - 0.5) * 0.8).normalize();
    const end = start.clone().addScaledVector(dir, len);
    lines.push({ line: fat(boltPath(start, end, { levels: 4, rough: 0.2, seed: seed * 13 + b }), Math.max(1.5, width * 0.4), resolution), k: 0.55 });
  }
  for (const l of lines) group.add(l.line);
  group.userData.set = (k) => {
    group.visible = k > 0.004;
    for (const l of lines) {
      const v = k * l.k;
      l.line.material.color.setRGB(tint[0] * 6 * v, tint[1] * 6 * v, tint[2] * 6 * v);
      l.line.material.opacity = Math.min(1, v * 1.5);
    }
  };
  group.userData.set(0);
  group.userData.path = main;
  return group;
}

/** How bright a strike is `d` seconds after it lands: a first flash, a dip, a second flash, then a quick fall. */
export function strikeEnvelope(d) {
  if (d < 0) return 0;
  if (d < 0.07) return 1;
  if (d < 0.12) return 0.25;
  if (d < 0.2) return 0.85;
  return 0.85 * Math.exp(-(d - 0.2) / 0.14);
}
