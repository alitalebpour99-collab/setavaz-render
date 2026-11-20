// An open divan, a book of poems, as it lies on a Yalda table: dark red leather boards with a gold-tooled border, two
// curved page blocks, and one loose page that can turn (`.userData.turn(k)`, 0 lying right, 1 lying left). About 30 cm
// across when open. The pages carry ink strokes in two columns, never letters (textures/table.mjs).
import * as THREE from 'three';
import { shadows } from '../util/shape.mjs';
import { versePageTexture } from '../textures/table.mjs';

export const BOOK = { w: 0.15, d: 0.22, block: 0.012 };

/** A page as a curved sheet: flat far from the spine, rising into the gutter. x from the spine (0) to w. */
function pageGeometry(w, d, lift, segs = 24) {
  const geo = new THREE.PlaneGeometry(w, d, segs, 2);
  geo.rotateX(-Math.PI / 2);
  geo.translate(w / 2, 0, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const k = x / w;
    p.setY(i, lift * Math.pow(1 - k, 2.4) + 0.002 * Math.sin(k * Math.PI));
  }
  geo.computeVertexNormals();
  return geo;
}

export function makeOpenBook() {
  const g = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: '#4a1016', roughness: 0.62, metalness: 0 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a04c', metalness: 1, roughness: 0.3 });
  const edge = new THREE.MeshStandardMaterial({ color: '#d9c7a0', roughness: 0.85 });
  const { w, d, block } = BOOK;
  for (const side of [-1, 1]) {
    // the board, a little wider than the pages
    const board = new THREE.Mesh(new THREE.BoxGeometry(w + 0.008, 0.003, d + 0.01), leather);
    board.position.set(side * (w / 2 + 0.002), 0.0015, 0);
    g.add(board);
    // gold tooling: a thin frame on the board's edge, seen past the pages
    for (const [sx, sz, px, pz] of [[w, 0.0012, 0, d / 2 + 0.003], [w, 0.0012, 0, -d / 2 - 0.003], [0.0012, d + 0.006, w / 2 + 0.004, 0]]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.0006, sz), gold);
      line.position.set(side * (w / 2 + 0.002 + px), 0.0032, pz);
      g.add(line);
    }
    // the page block: its edge (cream) and its top page (the verses)
    const lift = 0.012;
    const blockMesh = new THREE.Mesh(new THREE.BoxGeometry(w - 0.004, block, d), edge);
    blockMesh.position.set(side * (w / 2), 0.003 + block / 2, 0);
    g.add(blockMesh);
    const top = new THREE.Mesh(pageGeometry(w - 0.004, d, lift), new THREE.MeshStandardMaterial({ map: versePageTexture(side > 0 ? 1 : 0), roughness: 0.9, side: THREE.DoubleSide }));
    top.position.set(0, 0.003 + block + 0.0002, 0);
    if (side < 0) top.scale.x = -1;
    g.add(top);
  }
  // the loose page: turns about the spine
  const leaf = new THREE.Group();
  const front = new THREE.Mesh(pageGeometry(BOOK.w - 0.006, BOOK.d - 0.004, 0.012), new THREE.MeshStandardMaterial({ map: versePageTexture(1), roughness: 0.9, side: THREE.DoubleSide }));
  leaf.add(front);
  leaf.position.y = 0.003 + block + 0.0008;
  g.add(leaf);
  g.userData.turn = (k) => {
    const a = THREE.MathUtils.clamp(k, 0, 1);
    leaf.rotation.z = a * Math.PI;
    // a turning page bends: lift it a little in the middle of the turn
    leaf.position.y = 0.003 + block + 0.0008 + 0.004 * Math.sin(a * Math.PI);
    leaf.scale.y = 1 + 1.2 * Math.sin(a * Math.PI);
  };
  g.userData.turn(0);
  return shadows(g);
}
