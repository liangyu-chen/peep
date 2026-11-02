// Fewer draw calls: once the set is built, everything in it that never moves, changes or gets clicked is merged into one
// mesh per material, so the GPU draws a few hundred things a frame instead of a few thousand (and the shadow pass the
// same). Plain colours share one material that reads each thing's colour off its vertices, so more of them merge. Whatever the code holds
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

// a plain colour, no pictures on it
const plain = m => m.isMeshStandardMaterial && !m.map && !m.emissiveMap && !m.normalMap && !m.alphaMap && !m.roughnessMap && !m.metalnessMap && !m.vertexColors;

// merge the static meshes under root into it; returns how many draw calls that saves. A plain-coloured material that
// nothing else holds (or, for a building, one of its own: `own`, its list of materials) is swapped for a shared one
// that takes its colour from the mesh's vertices instead, so things alike in all but colour merge into one draw.
function mergeUnder(root, { objs, mats }, own = null) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), local = new THREE.Matrix4();
  const kept = o => { for (let p = o; p && p !== root; p = p.parent) if (objs.has(p)) return true; return false; };
  const tinted = new Map(), groups = new Map();
  const multi = new Map();   // meshes with a material per face group (the cinder blocks), by their set of materials
  root.traverse(o => {
    if (!o.isMesh || !o.visible || kept(o) || o.geometry.morphAttributes.position) return;
    if (Array.isArray(o.material)) {
      const g = o.geometry;
      if (!g.index || !g.groups.length || o.material.some(m => m.transparent || m.opacity < 1)) return;
      local.multiplyMatrices(inv, o.matrixWorld);
      if (local.determinant() < 0) return;
      const key = [o.material.map(m => m.uuid).join(','), o.castShadow, o.receiveShadow, Object.keys(g.attributes).sort().join(',')].join('/');
      if (!multi.has(key)) multi.set(key, { ms: o.material, list: [] });
      multi.get(key).list.push([o, local.clone()]);
      return;
    }
    let m = o.material, tint = null;
    if (m.transparent || m.opacity < 1) return;                         // see-through things are sorted one by one
    local.multiplyMatrices(inv, o.matrixWorld);
    if (local.determinant() < 0) return;                                // mirrored: its faces would turn inside out
    // (merging things that already share a material is always safe: a change to it still reaches all of them)
    if ((own ? own.includes(m) : !mats.has(m)) && plain(m)) {
      const k = [m.emissive.getHex(), m.emissiveIntensity, m.roughness, m.metalness, m.side, m.flatShading, m.alphaTest, m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits].join('|');
      if (!tinted.has(k)) { const t = m.clone(); t.color.set(0xffffff); t.vertexColors = true; tinted.set(k, t); }
      tint = m.color; m = tinted.get(k);
    }
    const g = o.geometry, key = [m.uuid, o.castShadow, o.receiveShadow, g.index ? 1 : 0, Object.keys(g.attributes).sort().join(',')].join('/');
    if (!groups.has(key)) groups.set(key, { m, list: [] });
    groups.get(key).list.push([o, local.clone(), tint]);
  });
  let saved = 0;
  groups.forEach(({ m, list }) => {
    if (list.length < 2) return;   // on its own: left as it was, with its own material
    const geos = list.map(([o, mx, tint]) => {
      const g = o.geometry.clone().applyMatrix4(mx); g.clearGroups();
      if (tint) {
        const n = g.attributes.position.count, c = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { c[i * 3] = tint.r; c[i * 3 + 1] = tint.g; c[i * 3 + 2] = tint.b; }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      }
      return g;
    });
    const merged = BufferGeometryUtils.mergeBufferGeometries(geos);
    geos.forEach(g => g.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = list[0][0].castShadow; mesh.receiveShadow = list[0][0].receiveShadow;
    root.add(mesh);
    list.forEach(([o]) => o.parent.remove(o));
    if (own && m.vertexColors && !own.includes(m)) own.push(m);   // so the building still fades as a whole
    saved += list.length - 1;
  });
  // the multi-material ones: all their faces in one geometry, sorted so each distinct material is one draw
  multi.forEach(({ ms, list }) => {
    if (list.length < 2) return;
    const geos = list.map(([o, mx]) => o.geometry.clone().applyMatrix4(mx));
    const groupsOf = geos.map(g => g.groups.map(gr => ({ ...gr })));
    geos.forEach(g => g.clearGroups());
    const merged = BufferGeometryUtils.mergeBufferGeometries(geos);
    geos.forEach(g => g.dispose());
    if (!merged) return;
    const src = merged.index.array, uniq = [...new Set(ms)], out = [], newGroups = [];
    let base = 0;
    const bases = geos.map(g => { const b = base; base += g.index.count; return b; });
    uniq.forEach((um, ui) => {
      const start = out.length;
      groupsOf.forEach((grs, j) => grs.forEach(gr => {
        if (ms[gr.materialIndex] !== um) return;
        for (let i = 0; i < gr.count; i++) out.push(src[bases[j] + gr.start + i]);
      }));
      newGroups.push({ start, count: out.length - start, materialIndex: ui });
    });
    merged.setIndex(out);
    newGroups.forEach(gr => merged.addGroup(gr.start, gr.count, gr.materialIndex));
    const mesh = new THREE.Mesh(merged, uniq);
    mesh.castShadow = list[0][0].castShadow; mesh.receiveShadow = list[0][0].receiveShadow;
    root.add(mesh);
    list.forEach(([o]) => o.parent.remove(o));
    saved += list.length * ms.length - uniq.length;
  });
  return saved;
}

export function mergeStatic() {
  const h = held(new Set([S.world, ...(S.envBlocks || []).map(b => b.group)]));
  let saved = S.world ? mergeUnder(S.world, h) : 0;
  // each neighbouring building on its own (they fade when in the way, a whole building at a time, by their own materials)
  (S.envBlocks || []).forEach(b => { saved += mergeUnder(b.group, h, b.mats); });
  return saved;
}
