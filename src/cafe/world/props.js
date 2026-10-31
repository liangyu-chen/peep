// Reusable furniture and bits: cinder blocks and seats, crates, stools, chairs, figurines, framed art.
import * as THREE from 'three';
import { ctx, mat, box, cyl, canvasTex, plane, pixelArt } from '../engine.js';
import { rand, pick } from '../util.js';
import { S } from '../state.js';
import { ART, PAL } from '../art.js';

export const woodM = mat(0x5a3a24, { roughness: 0.6 });
export const darkWood = mat(0x3a2a1e, { roughness: 0.5 });
export const steel = mat(0x9aa0a6, { roughness: 0.3, metalness: 0.8 });
export const blackM = mat(0x161616, { roughness: 0.5 });

// a straight run of black ceiling track from (x0,z0) to (x1,z1), with spots hanging off it every `every` metres, angled down and out
export function trackRun(x0, z0, x1, z1, y = 2.75, every = 1.5) {
  const len = Math.hypot(x1 - x0, z1 - z0), along = new THREE.Vector2(x1 - x0, z1 - z0).normalize();
  const t = box(0.05, 0.04, len, blackM, (x0 + x1) / 2, y, (z0 + z1) / 2); t.rotation.y = Math.atan2(along.x, along.y);
  const n = Math.max(1, Math.round(len / every));
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n, sx = x0 + (x1 - x0) * k, sz = z0 + (z1 - z0) * k;
    cyl(0.008, 0.008, 0.08, blackM, sx, y - 0.05, sz, ctx.scene, 6);
    const s = cyl(0.05, 0.06, 0.16, blackM, sx, y - 0.13, sz, ctx.scene, 10); s.rotation.set(0.5 * along.x, 0, 0.5 * along.y);
  }
}

// a three-blade ceiling fan hanging from a downrod; its blades turn in index.js
export function ceilingFan(x, z, y = 2.62) {
  const fan = new THREE.Group(); fan.position.set(x, y, z); ctx.scene.add(fan);
  cyl(0.012, 0.012, 0.25, blackM, 0, 0.13, 0, fan, 6); cyl(0.07, 0.07, 0.07, mat(0x2a2a2a), 0, 0, 0, fan, 12);
  const blades = new THREE.Group(); fan.add(blades);
  for (let i = 0; i < 3; i++) { const b = box(0.5, 0.01, 0.09, mat(0x3a2a1e), 0.3, -0.02, 0, blades); const p = new THREE.Group(); p.rotation.y = i * Math.PI * 2 / 3; p.add(b); blades.add(p); }
  (S.fans || (S.fans = [])).push(blades);
}

export const CRATE_ORANGE = 0xec6e0d;   // what the orange crates average out to (bright plastic plus the dark holes)
export const GLOSS_ORANGE = 0xff4d00;   // the glossy fibreglass-orange shells along the arcade's grey wall

// ---------------------------------------------------------------- cinder blocks
const cinderTex = canvasTex(32, 16, (g) => { g.fillStyle = '#a9a7a2'; g.fillRect(0, 0, 32, 16); g.fillStyle = '#5f5d59'; g.fillRect(4, 4, 10, 8); g.fillRect(18, 4, 10, 8); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, 0, 32, 1); }, true);
const cinderSide = new THREE.MeshStandardMaterial({ map: cinderTex, roughness: 1 });
const cinderTopM = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xa9a7a2).convertSRGBToLinear(), roughness: 1 });
export const cinderM = [cinderSide, cinderSide, cinderTopM, cinderTopM, cinderSide, cinderSide];   // holes on the sides, flat top and bottom

// little figures and gacha capsules tucked into the block holes, like under the Open sign
const TOY_COLS = [0xff4f7b, 0x7ec8ff, 0xffd23f, 0x3ddc97, 0xf4efe3, 0xc0282d, 0x9b6bff, 0xf08a24];
function holeToy(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rand(-0.5, 0.5); parent.add(g);
  if (Math.random() < 0.5) {                                                   // a tiny figure
    box(0.035, 0.04, 0.03, mat(pick(TOY_COLS)), 0, -0.035, 0, g);
    box(0.04, 0.035, 0.035, mat(pick(TOY_COLS)), 0, 0.0, 0, g);
  } else {                                                                     // a gacha capsule: coloured top, clear-ish bottom
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(pick(TOY_COLS), { roughness: 0.3 }));
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xeef3f5, { roughness: 0.1, transparent: true, opacity: 0.7 }));
    top.position.y = bot.position.y = -0.03; g.add(top, bot);
  }
  g.traverse(o => { o.castShadow = false; });
}
// a cinder block whose two holes (on its long faces) may each hold a toy
export function cinderBlock(w, h, d, x, y, z, parent) {
  const b = box(w, h, d, cinderM, x, y, z, parent);
  const alongX = w > d, half = (alongX ? d : w) / 2 + 0.022;
  [-1, 1].forEach(side => [-0.25, 0.25].forEach(t => {
    if (Math.random() > 0.4) return;
    alongX ? holeToy(b, t * w, 0, side * half) : holeToy(b, side * half, 0, t * d);
  }));
  return b;
}
const cushionM = mat(0x7d7f82, { roughness: 1 });
// cinder-block seat: four hollow blocks (two side by side, two across on top) and a round grey cushion
export function cinderSeat(x, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; ctx.scene.add(g);
  [-0.1, 0.1].forEach(d => { cinderBlock(0.4, 0.2, 0.2, 0, 0.1, d, g); cinderBlock(0.2, 0.2, 0.4, d, 0.3, 0, g); });
  cyl(0.19, 0.19, 0.05, cushionM, 0, 0.43, 0, g, 16);
}
// a table of cinder blocks: courses of two blocks, crossing every course
export function blockStack(x, z, courses = 3, h = 0.2) {
  for (let c = 0; c < courses; c++) [-0.1, 0.1].forEach(d => c % 2 ? cinderBlock(0.2, h, 0.4, x + d, h * (c + 0.5), z) : cinderBlock(0.4, h, 0.2, x, h * (c + 0.5), z + d));
  return h * courses;
}

// ---------------------------------------------------------------- crates, stools, stumps, chairs
const crateTex = (c1, c2) => canvasTex(32, 24, (g) => {
  g.fillStyle = c1; g.fillRect(0, 0, 32, 24); g.fillStyle = c2;
  for (let x = 2; x < 32; x += 4) for (let y = 5; y < 22; y += 4) g.fillRect(x, y, 2, 2);
  g.fillRect(0, 0, 32, 3);
}, true);
const CRATES = {
  orange: new THREE.MeshStandardMaterial({ map: crateTex('#ff7a12', '#b44c00'), roughness: 0.6 }),
  blue: new THREE.MeshStandardMaterial({ map: crateTex('#1c4fd6', '#0e2c80'), roughness: 0.6 }),
  green: new THREE.MeshStandardMaterial({ map: crateTex('#8fd1b4', '#4f8f74'), roughness: 0.6 }),
};
// crates are all the size of the ones in the arcade strip (that strip builds them at size 1 and scales its whole group)
export function crate(x, y, z, color = 'orange', ry = 0, size = 1.35) { const c = box(0.42 * size, 0.3, 0.32 * size, CRATES[color], x, y + 0.15, z); c.rotation.y = ry; return c; }
export function crateTable(x, z, color) { crate(x, 0, z, 'blue'); crate(x, 0.3, z, color); }   // two crates stacked
export function stump(x, z, h = 0.42) { cyl(0.2, 0.22, h, mat(0x7a5232, { roughness: 1 }), x, h / 2, z, ctx.scene, 14); cyl(0.19, 0.19, 0.01, mat(0xc49a6c), x, h + 0.005, z, ctx.scene, 14); }
export function highStool(x, z) {
  cyl(0.16, 0.16, 0.05, mat(0x8a8f96, { metalness: 0.6, roughness: 0.3 }), x, 0.645, z, ctx.scene, 14);
  [[0.1, 0.1], [-0.1, 0.1], [0.1, -0.1], [-0.1, -0.1]].forEach(([a, b]) => { const l = cyl(0.012, 0.012, 0.64, steel, x + a, 0.32, z + b, ctx.scene, 5); l.rotation.set(b * 0.6, 0, -a * 0.6); });
}
export function shellChair(x, z, ry, color, parent = ctx.scene) {
  const ch = new THREE.Group(); ch.position.set(x, 0, z); ch.rotation.y = ry; parent.add(ch);
  const m = mat(color, { roughness: color === GLOSS_ORANGE ? 0.22 : 0.6, metalness: color === GLOSS_ORANGE ? 0.05 : 0 });
  box(0.44, 0.05, 0.42, m, 0, 0.44, 0.02, ch); box(0.44, 0.4, 0.05, m, 0, 0.66, -0.2, ch).rotation.x = -0.12;
  return ch;
}
// three plastic shells bolted to one steel beam, the classic waiting-room bench
export function linkedChairs(x, z0, ry, colors) {
  const g = new THREE.Group(); g.position.set(x, 0, z0); g.rotation.y = ry; ctx.scene.add(g);
  colors.forEach((c, i) => shellChair((i - 1) * 0.5, 0, 0, c, g));
  box(1.55, 0.05, 0.06, steel, 0, 0.38, 0, g);
  [-0.6, 0.6].forEach(dx => { box(0.04, 0.38, 0.04, steel, dx, 0.19, 0, g); box(0.04, 0.03, 0.45, steel, dx, 0.015, 0, g); });
}
// camping chair: sagging fabric on a folding frame, with armrests
export function campChair(x, z, ry, color) {
  const ch = new THREE.Group(); ch.position.set(x, 0, z); ch.rotation.y = ry; ctx.scene.add(ch);
  const f = mat(color, { roughness: 1 }), fr = mat(0x222222, { metalness: 0.5 });
  box(0.48, 0.03, 0.42, f, 0, 0.38, 0, ch); box(0.48, 0.42, 0.03, f, 0, 0.62, -0.22, ch).rotation.x = -0.2;
  [-0.25, 0.25].forEach(a => { box(0.03, 0.03, 0.4, fr, a, 0.58, 0, ch); const l1 = cyl(0.01, 0.01, 0.55, fr, a, 0.27, 0, ch, 5); l1.rotation.x = 0.7; const l2 = cyl(0.01, 0.01, 0.55, fr, a, 0.27, 0, ch, 5); l2.rotation.x = -0.7; });
  return ch;
}

// ---------------------------------------------------------------- figurines and framed art
const FIG = [0xff4f7b, 0xffd23f, 0x7ec8ff, 0x3ddc97, 0xffffff, 0xf08a24, 0x9b6bff, 0xc0282d];
export function figurine(x, y, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rand(-0.8, 0.8) - Math.PI / 2; ctx.scene.add(g);
  box(0.06 * s, 0.08 * s, 0.05 * s, mat(pick(FIG)), 0, 0.04 * s, 0, g);
  box(0.08 * s, 0.07 * s, 0.07 * s, mat(pick(FIG)), 0, 0.115 * s, 0, g);
  box(0.02 * s, 0.02 * s, 0.02 * s, mat(0x111111), 0.02 * s, 0.12 * s, 0.036 * s, g); box(0.02 * s, 0.02 * s, 0.02 * s, mat(0x111111), -0.02 * s, 0.12 * s, 0.036 * s, g);
}
// a framed pixel-art poster hanging on the purple wall (facing +x)
export function framed(key, x, y, z, w, h, bg, frame = 0x111111) {
  box(0.04, h + 0.08, w + 0.08, mat(frame), x, y, z);
  plane(w, h, pixelArt(ART[key], PAL, bg), x + 0.03, y, z, Math.PI / 2);
}
