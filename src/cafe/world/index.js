// Builds the whole set in plan coordinates, then shortens the back and squeezes it left-right.
import * as THREE from 'three';
import { ctx } from '../engine.js';
import { S } from '../state.js';
import { K } from '../util.js';
import { BACK_SHIFT, BACK_DROP, BACK_HALL } from '../layout.js';
import { createTvScreen } from '../tv.js';
import { buildSky, buildRoomLights } from './lights.js';
import { buildShell } from './shell.js';
import { buildInterior } from './interior.js';
import { buildArcade } from './arcade.js';
import { buildBack } from './back.js';
import { buildSurroundings } from './surroundings.js';

const stepM = new THREE.MeshStandardMaterial({ color: 0x9a968e, roughness: 0.95 });   // the plinth's concrete
export function buildWorld() {
  const scene = ctx.scene;
  buildSky();
  buildShell();
  buildInterior();
  buildArcade();
  buildBack();
  buildRoomLights();
  createTvScreen();

  const skip = o => o === S.hemi || o === S.sun;
  // the room is shorter than first drawn: everything wholly behind z = -4.6 (neon wall, manga ledge, back of house) moves 1 m forward
  scene.children.slice().forEach(o => {
    if (skip(o)) return;
    const b = new THREE.Box3().setFromObject(o);
    const zMax = b.isEmpty() ? o.position.z : b.max.z;
    if (zMax < -4.6) o.position.z += BACK_SHIFT;
  });
  // the back corridor, past the sliding door, is a step down from the shop (the storeroom and toilet off it aren't):
  // its floor and everything standing wholly in it go down, but not what's on the face of its partition wall (the
  // light switches, the toilet door, which open onto the rooms' level)
  const H = BACK_HALL;
  scene.children.slice().forEach(o => {
    if (skip(o)) return;
    const b = new THREE.Box3().setFromObject(o);
    if (b.isEmpty() || b.min.x < H.x0 - 0.02 || b.max.x > H.x1 + 0.02 || b.min.z < H.z0 - 0.02 || b.max.z > H.z1 + 0.02 || b.min.x > -0.95) return;
    o.position.y -= BACK_DROP;
  });
  // the step's faces under the walls round the corridor
  // (their tops stop a little under the floors, as the plinth's do: a top flush with a floor flickers through it)
  const TOP = -0.008, BOT = -BACK_DROP - 0.004;
  const step = (x0, x1, z0, z1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, TOP - BOT, z1 - z0), stepM); m.position.set((x0 + x1) / 2, (TOP + BOT) / 2, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m); };
  // (each runs the wall's full 0.16 thickness, so its face is flush with the wall's face above it, and the doorways'
  // thresholds line up with the walls either side)
  const T = 0.08;
  // (the sliding door's threshold and the storeroom's and toilet's are the ends of the plinth under the shop,
  // surroundings.js: a second face there would fight it and flicker; these only fill in under the corridor's walls)
  step(H.x0 - T, H.x0 + T, H.z0, H.z1 - T);          // under the outer wall
  step(H.x0 - T, H.x1 - T, H.z0 - T, H.z0 + T);      // and the back wall
  // squeeze the whole set left-right; people and anything placed later convert plan x with K
  const world = new THREE.Group(); world.scale.x = K;
  scene.children.slice().forEach(o => { if (!skip(o)) world.add(o); });
  scene.add(world); S.world = world;
  buildSurroundings();   // in world metres, not squeezed, so the trees and the moon gate stay round
}
