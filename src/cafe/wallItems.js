// What hangs on the outer walls (the posters and the mural on the purple wall, the pegboard and everything on it, the
// signs and frames on the others) fades out with its wall when the camera swings round behind it, rather than being
// left floating in the air. Gathered once the set is built: each wall's things moved into a group of their own (where
// they are in the world unchanged), with materials of their own, so fading them touches nothing else in the café; the
// group is then merged within itself like the rest of the set (optimize.js), and faded by its materials.
import * as THREE from 'three';
import { S } from './state.js';
import { K } from './util.js';

const WX = 3.1 * K, BZ = -9.35;    // the outer walls' lines, in the world (left and right at ∓WX, the back at BZ)
const REACH = 0.42;                // how far out from a wall something can stand and still be on it
const ABOVE = 0.8;                 // and how high its lowest point: on the wall, not furniture standing against it

export function gatherWallItems() {
  if (!S.world) return;
  S.world.updateMatrixWorld(true);
  // (whatever the code itself holds on to through S is left where it is: a switch, a fan, the neon...)
  const held = new Set();
  const walk = (v, d) => { if (!v || typeof v !== 'object' || d > 3 || held.has(v)) return; if (v.isObject3D) { if (v !== S.world && v !== S.scene) v.traverse(o => held.add(o)); return; } if (Array.isArray(v) || v.constructor === Object) Object.values(v).forEach(x => walk(x, d + 1)); };
  Object.entries(S).forEach(([k, v]) => { if (k !== 'world' && k !== 'fadeWalls') walk(v, 0); });
  (S.fadeWalls || []).forEach(w => held.add(w.me));
  const sides = { L: [], R: [], B: [] }, box = new THREE.Box3();
  S.world.traverse(o => {
    if (!o.isMesh || held.has(o) || !o.visible) return;
    box.setFromObject(o);
    if (box.isEmpty() || box.min.y < ABOVE) return;
    if (box.max.x < -WX + REACH && box.min.x > -WX - 0.1) sides.L.push(o);
    else if (box.min.x > WX - REACH && box.max.x < WX + 0.1) sides.R.push(o);
    else if (box.max.z < BZ + REACH && box.min.z > BZ - 0.1) sides.B.push(o);
  });
  S.wallItems = [];
  Object.entries(sides).forEach(([side, list]) => {
    if (!list.length) return;
    const group = new THREE.Group(); S.world.add(group);
    const mats = [], copies = new Map();
    const own = m => { if (!copies.has(m)) { const c = m.clone(); copies.set(m, c); mats.push(c); } return copies.get(m); };
    list.forEach(o => { group.attach(o); o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material); });
    S.wallItems.push({ side, group, mats, base: new Map(mats.map(m => [m, { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite }])), fade: 1 });
  });
}

// each frame: a wall's things fade with it (behind is whether the camera's round behind that wall)
export function fadeWallItems(behindOf, dt) {
  (S.wallItems || []).forEach(w => {
    const to = behindOf(w.side) ? 0.08 : 1;
    if (Math.abs(w.fade - to) < 0.002) return;
    w.fade += (to - w.fade) * Math.min(1, dt * 8);
    if (Math.abs(w.fade - to) < 0.004) w.fade = to;
    const see = w.fade < 0.999;
    w.mats.forEach(m => {
      const b = w.base.get(m) || { transparent: false, opacity: 1, depthWrite: true };
      const tr = see || b.transparent;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = b.opacity * w.fade; m.depthWrite = see ? false : b.depthWrite;
    });
    // (no shadows from them while see-through, as with the walls; their own back when solid again)
    w.group.traverse(o => { if (!o.isMesh) return; if (o.userData.castWas === undefined) o.userData.castWas = o.castShadow; const c = !see && o.userData.castWas; if (o.castShadow !== c) { o.castShadow = c; S.shadowDirty = true; } });
  });
}
