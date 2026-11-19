// Shared small helpers for the models: a lathe from (radius, height) points, placing, shadows.
import * as THREE from 'three';

/**
 * A solid of revolution from [radius, height] points. Go round the section anticlockwise (outwards along the bottom, up the
 * outside, inwards along the top): that side is the one that shows. Give a point twice for a hard edge.
 */
export function lathe(points, material, segments = 72) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y)), segments);
  return new THREE.Mesh(g, material);
}
export function at(o, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
}
export function shadows(o, cast = true, receive = true) {
  o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = receive; } });
  return o;
}
/** The logo's four-point star as a flat outline (its arms on the axes, concave sides), radius 1. */
export function starShape(pinch = 0.2) {
  const s = new THREE.Shape();
  const tips = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  s.moveTo(0, 1);
  for (let i = 0; i < 4; i++) {
    const [nx, ny] = tips[(i + 1) % 4];
    const [cx, cy] = tips[i];
    // the waist between two arms sits close to the centre
    s.quadraticCurveTo((cx + nx) * pinch * 0.5, (cy + ny) * pinch * 0.5, nx, ny);
  }
  return s;
}
