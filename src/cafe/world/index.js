// Builds the whole set in plan coordinates, then shortens the back and squeezes it left-right.
import * as THREE from 'three';
import { ctx } from '../engine.js';
import { S } from '../state.js';
import { K } from '../util.js';
import { BACK_SHIFT, BACK_ROOMS, BACK_STEP } from '../layout.js';
import { createTvScreen } from '../tv.js';
import { buildSky, buildRoomLights } from './lights.js';
import { buildShell } from './shell.js';
import { buildInterior } from './interior.js';
import { buildArcade } from './arcade.js';
import { buildBack } from './back.js';
import { buildSurroundings } from './surroundings.js';

const stepM = new THREE.MeshStandardMaterial({ color: 0x8e8d89, roughness: 0.9 });
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
  // the storeroom's and the toilet's floors are raised a step above the corridor (the rest of back of house isn't):
  // everything standing wholly inside either goes up with it, onto a concrete platform with its riser at the doorway
  BACK_ROOMS.forEach(r => {
    scene.children.slice().forEach(o => {
      if (skip(o)) return;
      const b = new THREE.Box3().setFromObject(o);
      if (b.isEmpty() || b.min.x < r.x0 - 0.1 || b.max.x > r.x1 + 0.02 || b.min.z < r.z0 - 0.02 || b.max.z > r.z1 + 0.02) return;
      o.position.y += BACK_STEP;
    });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(r.x1 - r.x0, BACK_STEP, r.z1 - r.z0), stepM);
    slab.position.set((r.x0 + r.x1) / 2, BACK_STEP / 2 - 0.001, (r.z0 + r.z1) / 2); slab.receiveShadow = true; scene.add(slab);
  });
  // squeeze the whole set left-right; people and anything placed later convert plan x with K
  const world = new THREE.Group(); world.scale.x = K;
  scene.children.slice().forEach(o => { if (!skip(o)) world.add(o); });
  scene.add(world); S.world = world;
  buildSurroundings();   // in world metres, not squeezed, so the trees and the moon gate stay round
}
