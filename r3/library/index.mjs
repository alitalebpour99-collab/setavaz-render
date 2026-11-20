// Every object of the Setavaz library that can stand alone, with how to show it on a turntable. The ids are the ones
// in manifest.json (the gate's test holds the two lists together).
import * as THREE from 'three';
import { makeAshBed, makeCoal, makeFireBowl, makeHearth } from './models/fire-bowl.mjs';
import { makeWeathervane } from './models/weathervane.mjs';
import { makeTurretRoof } from './models/turret-roof.mjs';
import { makeCrucible, makeCruciblePot } from './models/crucible.mjs';
import { makeMoltenRing, makeRingMould, metalColour } from './models/ring-mould.mjs';
import { makeFlame } from './effects/flame.mjs';
import { makeOpeningPomegranate, makePomegranate, makePomegranateHalf } from './models/pomegranate.mjs';
import { makeCandlestick, makeLitCandle } from './models/candle.mjs';
import { makeTeaGlass } from './models/tea-glass.mjs';
import { makeOpenBook } from './models/book.mjs';
import { makeDeskLamp, makeHourglass, makeNotebook, makePencil } from './models/study.mjs';
import { makeCluster, makeMirrorCharm, makeNazar, makeSteeringWheel } from './models/car.mjs';

export const OBJECTS = [
  { id: 'setavaz-fire-bowl', make: () => makeFireBowl() },
  { id: 'setavaz-charcoal', make: () => { const c = makeCoal(1, 0.074); c.userData.heat(0.9); return c; } },
  { id: 'setavaz-hearth', make: () => { const h = makeHearth(); const f = makeFlame({ w: 0.95, h: 1.5, seed: 0.1 }); f.position.y = 0.3; f.userData.set(1.3, 0.8, 1.15); h.group.add(f); h.group.userData.face = (cam) => f.userData.face(cam); return h.group; } },
  { id: 'setavaz-ash-bed', make: () => makeAshBed() },
  { id: 'setavaz-weathervane', make: () => { const v = makeWeathervane(); v.head.rotation.y = 0.4; return v.group; } },
  { id: 'setavaz-turret-roof', make: () => makeTurretRoof() },
  { id: 'setavaz-crucible-pot', make: () => makeCruciblePot() },
  { id: 'setavaz-crucible', make: () => { const c = makeCrucible(); c.setTilt(0.5); return c.group; } },
  { id: 'setavaz-ring-mould', make: () => { const m = makeRingMould(); const metal = makeMoltenRing(); metal.userData.set(0.7, metalColour(0.8)); m.add(metal); return m; } },
  { id: 'setavaz-pomegranate', make: () => makePomegranate() },
  { id: 'setavaz-pomegranate-half', make: () => makePomegranateHalf() },
  { id: 'setavaz-pomegranate-opening', make: () => { const p = makeOpeningPomegranate(); p.open(1); return p.group; } },
  { id: 'setavaz-candlestick', make: () => makeCandlestick() },
  { id: 'setavaz-candle', make: () => makeLitCandle() },
  { id: 'setavaz-tea-glass', make: () => makeTeaGlass() },
  { id: 'setavaz-divan-book', make: () => { const b = makeOpenBook(); b.userData.turn(0.35); return b; } },
  { id: 'setavaz-desk-lamp', make: () => makeDeskLamp() },
  { id: 'setavaz-notebook', make: () => { const n = makeNotebook(); n.userData.write(0.6); return n; } },
  { id: 'setavaz-pencil', make: () => { const p = makePencil(); p.rotation.z = Math.PI / 2; return p; } },
  { id: 'setavaz-hourglass', make: () => { const h = makeHourglass(); h.userData.sand(0.4); return h; } },
  { id: 'setavaz-car-cluster', make: () => { const c = makeCluster(); c.userData.gauges.forEach((g, i) => g.userData.needle(0.3 + 0.3 * i)); return c; } },
  { id: 'setavaz-steering-wheel', make: () => makeSteeringWheel() },
  { id: 'setavaz-nazar-bead', make: () => makeNazar() },
  { id: 'setavaz-mirror-charm', make: () => { const m = makeMirrorCharm(); m.userData.swing(0.1, 0.25); return m; } },
];
export { THREE };
