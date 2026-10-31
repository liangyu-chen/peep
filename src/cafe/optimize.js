// Fewer draw calls: once the set is built, everything in it that never moves, changes or gets clicked is merged into one
// mesh per material, so the GPU draws a few hundred things a frame instead of a few thousand (and the shadow pass the
// same). Plain colours that are exactly alike share one material first, so more of them merge. Whatever the code holds
// on to through S (doors, fans, the TV, the neon, the dartboard, the switch, fading walls, the neighbours' windows...)
// is left exactly as it was, and so is everything inside it.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { S } from './state.js';

// the objects and materials reachable from S, a few levels down (but not the groups being merged into)
function held(roots) {
  const objs = new Set(), mats = new Set(), seen = new Set();
  const walk = (v, depth) => {
    if (!v || typeof v !== 'object' || seen.has(v) || roots.has(v) || depth > 3) return;
    seen.add(v);
    if (v.isObject3D) {   // and its materials, which the code may change (a wall fading): never shared out to others
      objs.add(v); v.traverse(c => { if (c.material) [].concat(c.material).forEach(m => mats.add(m)); }); return;
    }
    if (v.isMaterial) { mats.add(v); return; }
    if (v.isTexture || ArrayBuffer.isView(v)) return;
    (Array.isArray(v) ? v : Object.values(v)).forEach(x => walk(x, depth + 1));
  };
  Object.values(S).forEach(v => walk(v, 0));
  return { objs, mats };
}

// merge the static meshes under root into it; returns how many draw calls that saves
function mergeUnder(root, { objs, mats }, share) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), local = new THREE.Matrix4();
  const kept = o => { for (let p = o; p && p !== root; p = p.parent) if (objs.has(p)) return true; return false; };
  const alike = new Map(), groups = new Map();
  root.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material) || !o.visible || kept(o) || o.geometry.morphAttributes.position) return;
    let m = o.material;
    if (m.transparent || m.opacity < 1) return;                         // see-through things are sorted one by one
    local.multiplyMatrices(inv, o.matrixWorld);
    if (local.determinant() < 0) return;                                // mirrored: its faces would turn inside out
    // (merging things that already share a material is always safe: a change to it still reaches all of them. Swapping
    // in a look-alike material is only done for ones nothing else holds)
    if (share && !mats.has(m) && m.isMeshStandardMaterial && !m.map && !m.emissiveMap && !m.normalMap && !m.alphaMap && !m.roughnessMap && !m.metalnessMap) {
      const k = [m.color.getHex(), m.emissive.getHex(), m.emissiveIntensity, m.roughness, m.metalness, m.side, m.flatShading, m.alphaTest, m.polygonOffset].join('|');
      if (!alike.has(k)) alike.set(k, m);
      m = alike.get(k);
    }
    const g = o.geometry, key = [m.uuid, o.castShadow, o.receiveShadow, g.index ? 1 : 0, Object.keys(g.attributes).sort().join(',')].join('/');
    if (!groups.has(key)) groups.set(key, { m, list: [] });
    groups.get(key).list.push([o, local.clone()]);
  });
  let saved = 0;
  groups.forEach(({ m, list }) => {
    if (list.length < 2) return;
    const geos = list.map(([o, mx]) => { const g = o.geometry.clone().applyMatrix4(mx); g.clearGroups(); return g; });
    const merged = BufferGeometryUtils.mergeBufferGeometries(geos);
    geos.forEach(g => g.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = list[0][0].castShadow; mesh.receiveShadow = list[0][0].receiveShadow;
    root.add(mesh);
    list.forEach(([o]) => o.parent.remove(o));
    saved += list.length - 1;
  });
  return saved;
}

export function mergeStatic() {
  const h = held(new Set([S.world, ...(S.envBlocks || []).map(b => b.group)]));
  let saved = S.world ? mergeUnder(S.world, h, true) : 0;
  // each neighbouring building on its own (they fade when in the way, a whole building at a time, by their own materials)
  (S.envBlocks || []).forEach(b => { saved += mergeUnder(b.group, h, false); });
  return saved;
}
