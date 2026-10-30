// Builds the whole set in plan coordinates, then shortens the back and squeezes it left-right.
import * as THREE from 'three';
import { ctx } from '../engine.js';
import { S } from '../state.js';
import { K } from '../util.js';
import { BACK_SHIFT } from '../layout.js';
import { createTvScreen } from '../tv.js';
import { buildSky, buildRoomLights } from './lights.js';
import { buildShell } from './shell.js';
import { buildInterior } from './interior.js';
import { buildArcade } from './arcade.js';
import { buildBack } from './back.js';

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
  // squeeze the whole set left-right; people and anything placed later convert plan x with K
  const world = new THREE.Group(); world.scale.x = K;
  scene.children.slice().forEach(o => { if (!skip(o)) world.add(o); });
  scene.add(world);
}
