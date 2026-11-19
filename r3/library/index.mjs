// Every object of the Setavaz library that can stand alone, with how to show it on a turntable. The ids are the ones
// in manifest.json (the gate's test holds the two lists together).
import * as THREE from 'three';
import { makeAshBed, makeCoal, makeFireBowl, makeHearth } from './models/fire-bowl.mjs';
import { makeWeathervane } from './models/weathervane.mjs';
import { makeTurretRoof } from './models/turret-roof.mjs';
import { makeCrucible, makeCruciblePot } from './models/crucible.mjs';
import { makeMoltenRing, makeRingMould, metalColour } from './models/ring-mould.mjs';
import { makeFlame } from './effects/flame.mjs';

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
];
export { THREE };
