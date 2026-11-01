// The black pegboard on the teal wall behind the work counter, crammed like the real one: blister-packed spinning
// tops, a retro record sleeve, polaroids and notes (all painted on the board), and hanging off it red spatulas,
// whisks, a ladle and a strainer, a hammer, tape rolls, paper fans, a yellow road sign, little shelves of bottles and
// a lucky cat, a row of darts and a cluster of steel camping mugs.
import * as THREE from 'three';
import { ctx, mat, box, cyl, canvasTex, plane } from '../engine.js';
import { rand, pick, DOT } from '../util.js';
import { steel, woodM } from './props.js';

// the board: on the wall at x 3.01, facing the room; z runs left to right as you look at it
const B = { x: 3.01, y: 1.85, z: 0.1, w: 4.0, h: 1.3 };
const PX = 256;                                     // canvas pixels a metre
const Z0 = B.z - B.w / 2, YT = B.y + B.h / 2;
const cx = z => (z - Z0) * PX, cy = y => (YT - y) * PX;
const OUT = B.x - 0.012;                             // the front of the board, where things hang from

const redM = mat(0xd8261e, { roughness: 0.45 });
const whiteM = mat(0xf2f0ea, { roughness: 0.4 });
const tealM = mat(0x4fa7a0, { roughness: 0.5 });
const yellowM = mat(0xf2c418, { roughness: 0.5 });
const greyM = mat(0x9a9a9e, { roughness: 0.55 });
const blackM = mat(0x111111, { roughness: 0.5 });
const shelfM = mat(0xe8e8e4, { roughness: 0.5 });
const brownGlass = mat(0x5a2a10, { roughness: 0.15, metalness: 0.1 });
const clearGlass = mat(0xcfe3e0, { roughness: 0.05, transparent: true, opacity: 0.55 });
const blueEnamel = mat(0x2b4fa8, { roughness: 0.35 });
const fanMs = [mat(0xf6d3d8, { roughness: 0.8 }), mat(0xe9d9b8, { roughness: 0.8 })];
const tapeMs = [0xf4f4f0, 0xf2c418, 0x3ddc97, 0x7ec8ff].map(c => mat(c, { roughness: 0.6 }));
const flightMs = [0xff4f7b, 0x3ddc97, 0xf2c418, 0x7ec8ff, 0xff7a12, 0xb05cff].map(c => mat(c, { roughness: 0.5 }));

// everything flat, painted onto the board itself
function boardTexture() {
  return canvasTex(B.w * PX, B.h * PX, (g, w, h) => {
    g.fillStyle = '#1c1c1e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#060607';
    for (let x = 4; x < w; x += 7) for (let y = 4; y < h; y += 7) g.fillRect(x, y, 3, 3);   // the holes
    const card = (z, y, cw, ch, bg, draw) => {    // a card/sticker/photo centred at (z, y), size in metres
      const x0 = cx(z) - cw * PX / 2, y0 = cy(y) - ch * PX / 2;
      g.save(); g.translate(x0, y0); g.rotate(rand(-0.06, 0.06));
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(2, 3, cw * PX, ch * PX);
      g.fillStyle = bg; g.fillRect(0, 0, cw * PX, ch * PX);
      if (draw) draw(cw * PX, ch * PX);
      g.restore();
    };
    const blister = (z, y, c1, c2) => card(z, y, 0.13, 0.17, c1, (cw, ch) => {   // a spinning top in its blister pack
      g.fillStyle = c2; g.fillRect(4, 4, cw - 8, 12);
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(cw / 2, ch * 0.6, cw * 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = pick(['#c0282d', '#2b4fa8', '#f2c418']); g.beginPath(); g.arc(cw / 2, ch * 0.6, cw * 0.18, 0, Math.PI * 2); g.fill();
    });
    const photo = (z, y, s = 1) => card(z, y, 0.07 * s, 0.085 * s, '#f6f4ee', (cw, ch) => {   // a polaroid
      const sky = `hsl(${rand(0, 360)},${rand(30, 60)}%,${rand(45, 70)}%)`;
      g.fillStyle = sky; g.fillRect(3, 3, cw - 6, ch * 0.72);
      g.fillStyle = `hsl(${rand(0, 40)},40%,${rand(40, 65)}%)`; g.beginPath(); g.arc(cw * rand(0.35, 0.65), ch * 0.45, cw * 0.15, 0, Math.PI * 2); g.fill();
    });
    const note = (z, y, cw, ch, bg = '#fffbe8') => card(z, y, cw, ch, bg, (W, H) => {   // a scribbled note
      g.strokeStyle = '#334'; g.lineWidth = 1.2;
      for (let l = 10; l < H - 4; l += 8) { g.beginPath(); g.moveTo(6, l); for (let x = 6; x < W - 6; x += 5) g.lineTo(x, l + rand(-1.5, 1.5)); g.stroke(); }
    });
    // underneath it all, the clutter: toy packaging, stickers, cards and photos everywhere, packed in tight
    const PACK = ['#f4f4f0', '#ffe2ec', '#2a1f4a', '#c0282d', '#2b4fa8', '#f2c418', '#3ddc97', '#ff7a12', '#7d3cff', '#e8e2d0', '#111111', '#7ec8ff'];
    for (let i = 0; i < 70; i++) {
      const z = rand(Z0 + 0.06, Z0 + B.w - 0.06), y = rand(YT - B.h + 0.08, YT - 0.06);
      if (Math.random() < 0.4) photo(z, y, rand(0.7, 1));
      else card(z, y, rand(0.05, 0.12), rand(0.05, 0.14), pick(PACK), (W, H) => {
        g.fillStyle = pick(PACK); g.fillRect(W * 0.15, H * 0.15, W * 0.7, H * rand(0.15, 0.5));
        if (Math.random() < 0.5) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(W / 2, H * 0.65, Math.min(W, H) * 0.22, 0, Math.PI * 2); g.fill(); }
      });
    }
    // left: spinning tops in their packs, notes, a sticky label
    [[-1.68, 2.3, '#f4f4f0', '#7d3cff'], [-1.52, 2.36, '#2a1f4a', '#c0282d'], [-1.36, 2.08, '#f4f4f0', '#2b4fa8'],
      [-1.0, 2.1, '#ffe2ec', '#ff4f7b'], [-0.86, 1.95, '#e8f0ff', '#2b4fa8']].forEach(a => blister(...a));
    note(-1.82, 1.62, 0.13, 0.1); note(-1.68, 1.5, 0.12, 0.09, '#ffffff'); note(-1.78, 1.38, 0.1, 0.08);
    card(-1.55, 1.72, 0.08, 0.05, '#3ddc97', (W, H) => { g.fillStyle = '#fff'; g.font = `bold ${H * 0.55}px sans-serif`; g.fillText('X 4', 6, H * 0.7); });
    photo(-1.35, 1.48); photo(-1.2, 1.56, 0.9);
    // the middle: an old record sleeve, a boxed building kit, a sticker or two
    card(-0.52, 2.2, 0.3, 0.3, '#8fd0ee', (W, H) => {
      g.fillStyle = '#ff4f9a'; g.fillRect(W * 0.12, H * 0.08, W * 0.76, H * 0.2);
      g.fillStyle = '#fff'; g.font = `${H * 0.13}px ${DOT}`; g.textAlign = 'center'; g.fillText('懷舊金曲', W / 2, H * 0.24);
      g.fillStyle = '#2a1a14'; g.beginPath(); g.arc(W / 2, H * 0.56, W * 0.14, 0, Math.PI * 2); g.fill();     // hair
      g.fillStyle = '#f2c9a5'; g.beginPath(); g.arc(W / 2, H * 0.58, W * 0.1, 0, Math.PI * 2); g.fill();      // face
      g.fillStyle = '#f6f6f2'; g.fillRect(W * 0.33, H * 0.7, W * 0.34, H * 0.3);                               // blouse
    });
    card(0.12, 2.35, 0.26, 0.12, '#141414', (W, H) => { g.fillStyle = '#fff'; g.font = `${H * 0.22}px sans-serif`; g.fillText('BRICKS  Architecture', 6, H * 0.3); g.fillStyle = '#c8c8c8'; g.fillRect(W * 0.45, H * 0.4, W * 0.06, H * 0.55); g.fillRect(W * 0.62, H * 0.55, W * 0.1, H * 0.4); });
    card(0.42, 2.38, 0.2, 0.08, '#2a2a2a', (W, H) => { g.fillStyle = '#e8e8e8'; g.font = `${H * 0.35}px sans-serif`; g.fillText('PORTAFILTER', 6, H * 0.65); });
    card(0.55, 2.02, 0.07, 0.05, '#ff3b30', (W, H) => { g.fillStyle = '#fff'; g.font = `bold ${H * 0.5}px sans-serif`; g.fillText('Sale', 4, H * 0.7); });
    card(0.25, 1.35, 0.3, 0.06, '#ff8a1e', (W, H) => { g.fillStyle = '#fff'; g.font = `${H * 0.55}px ${DOT}`; g.fillText('保鮮膜 營業用', 8, H * 0.72); });
    photo(0.35, 1.98); photo(-0.1, 2.06, 0.8);
    // the right: a big patch of polaroids and photo-booth strips, a comic or two, a red good-luck sticker
    for (let i = 0; i < 40; i++) photo(rand(1.35, 2.02), rand(1.45, 2.32), rand(0.8, 1.1));
    card(1.98, 2.36, 0.14, 0.2, '#e8e2d0', (W, H) => { g.fillStyle = '#c0282d'; g.fillRect(0, 0, W, H * 0.22); g.fillStyle = '#2b4fa8'; g.fillRect(W * 0.1, H * 0.3, W * 0.8, H * 0.6); });
    card(1.72, 2.12, 0.07, 0.07, '#e0262a', (W, H) => { g.fillStyle = '#ffd23f'; g.font = `${H * 0.6}px ${DOT}`; g.textAlign = 'center'; g.fillText('福', W / 2, H * 0.75); });
  });
}

const hangAt = (m, z, y) => { m.position.set(OUT - 0.02, y, z); ctx.scene.add(m); m.castShadow = true; m.receiveShadow = true; return m; };

// a long-handled tool hanging head-down from a peg: handle up, the working end at the bottom
function spatula(z, y) {
  box(0.012, 0.2, 0.014, redM, OUT - 0.012, y + 0.08, z);
  box(0.008, 0.08, 0.05, redM, OUT - 0.012, y - 0.06, z);
}
function whisk(z, y) {
  cyl(0.008, 0.01, 0.11, steel, OUT - 0.02, y + 0.07, z, ctx.scene, 8);
  const loop = new THREE.Mesh(geoWhisk, steel); loop.scale.set(1, 1.4, 1); hangAt(loop, z, y - 0.05);
}
const geoWhisk = new THREE.SphereGeometry(0.035, 8, 8);
function ladle(z, y) {
  cyl(0.006, 0.006, 0.22, steel, OUT - 0.02, y + 0.06, z, ctx.scene, 6);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), steel);
  hangAt(bowl, z, y - 0.04);
}
function strainer(z, y) {
  box(0.008, 0.12, 0.014, tealM, OUT - 0.012, y + 0.1, z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 18), tealM); ring.rotation.y = Math.PI / 2; hangAt(ring, z, y);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 6, 0, Math.PI), mat(0x8aa8a6, { roughness: 0.6, transparent: true, opacity: 0.7 }));
  mesh.rotation.y = -Math.PI / 2; hangAt(mesh, z, y);
}
function hammer(z, y) {
  box(0.016, 0.26, 0.02, woodM, OUT - 0.014, y, z);
  box(0.024, 0.03, 0.1, mat(0x3a3a3c, { roughness: 0.4, metalness: 0.6 }), OUT - 0.016, y + 0.13, z + 0.015);
}
function tape(z, y, m) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 16), m); t.rotation.y = Math.PI / 2; hangAt(t, z, y);
}
function fan(z, y, m, tilt) {   // a round paper fan
  const f = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.006, 20), m); f.rotation.z = Math.PI / 2; f.rotation.x = tilt;
  hangAt(f, z, y);
  const h = box(0.01, 0.12, 0.012, woodM, OUT - 0.014, y - 0.15, z); h.rotation.x = tilt;
}
function roadSign(z, y) {   // a yellow diamond with a black border and a little black figure
  const s = box(0.012, 0.2, 0.2, blackM, OUT - 0.01, y, z); s.rotation.x = Math.PI / 4;
  const f = box(0.014, 0.18, 0.18, yellowM, OUT - 0.012, y, z); f.rotation.x = Math.PI / 4;
  box(0.016, 0.06, 0.02, blackM, OUT - 0.014, y, z); box(0.016, 0.02, 0.02, blackM, OUT - 0.014, y + 0.045, z);
}
function controller(z, y) {   // an old three-pronged game pad
  box(0.03, 0.05, 0.16, greyM, OUT - 0.02, y, z);
  [-0.06, 0, 0.06].forEach(dz => box(0.03, 0.07, 0.035, greyM, OUT - 0.02, y - 0.05, z + dz));
  [[-0.04, 0x3ddc97], [0.035, 0x2b4fa8], [0.055, 0xd8261e]].forEach(([dz, c]) => box(0.034, 0.014, 0.014, c, OUT - 0.02, y + 0.005, z + dz));
}
function shelf(z, y, w) { box(0.08, 0.012, w, shelfM, OUT - 0.04, y, z); }
function bottle(z, y, m, h = 0.11) {
  cyl(0.02, 0.02, h * 0.7, m, OUT - 0.04, y + h * 0.35, z, ctx.scene, 10);
  cyl(0.008, 0.016, h * 0.3, m, OUT - 0.04, y + h * 0.85, z, ctx.scene, 8);
}
function luckyCat(z, y) {
  box(0.05, 0.07, 0.06, whiteM, OUT - 0.04, y + 0.035, z);
  box(0.055, 0.055, 0.065, whiteM, OUT - 0.04, y + 0.1, z);
  box(0.02, 0.05, 0.016, whiteM, OUT - 0.05, y + 0.12, z + 0.035);                 // the waving paw
  box(0.056, 0.012, 0.066, redM, OUT - 0.04, y + 0.072, z);                          // collar
  box(0.01, 0.016, 0.016, mat(0xf2c418), OUT - 0.068, y + 0.06, z);                   // bell
}
function mug(z, y, m) {   // a camping mug hung by its handle
  cyl(0.04, 0.036, 0.08, m, OUT - 0.05, y, z, ctx.scene, 14);
  const hd = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 10, Math.PI), m); hd.rotation.y = Math.PI / 2; hd.rotation.z = -Math.PI / 2;
  hangAt(hd, z + 0.04, y);
}
function darts(z, y) {   // a little rack of darts, flights up
  box(0.04, 0.012, 0.3, blackM, OUT - 0.02, y, z);
  for (let i = 0; i < 6; i++) {
    const dz = z - 0.12 + i * 0.048;
    cyl(0.004, 0.004, 0.08, steel, OUT - 0.03, y + 0.04, dz, ctx.scene, 6);
    box(0.002, 0.03, 0.022, flightMs[i], OUT - 0.03, y + 0.09, dz);
  }
}

const TOYC = [0xd8261e, 0x2b4fa8, 0xf2c418, 0x3ddc97, 0xf6f6f2, 0xff7a12, 0x7d3cff].map(c => mat(c, { roughness: 0.5 }));
function toy(z, y) {   // a little figure standing on a shelf
  box(0.03, 0.04, 0.025, pick(TOYC), OUT - 0.04, y + 0.02, z);
  box(0.035, 0.032, 0.032, pick(TOYC), OUT - 0.04, y + 0.056, z);
}
const ballGeo = new THREE.SphereGeometry(0.04, 12, 10);
function ball(z, y, c1, c2) {   // a round plush or toy head on a peg, two-tone
  hangAt(new THREE.Mesh(ballGeo, mat(c1, { roughness: 0.7 })), z, y).scale.set(0.8, 1, 1);
  const band = hangAt(new THREE.Mesh(new THREE.TorusGeometry(0.039, 0.008, 6, 16), mat(c2, { roughness: 0.6 })), z, y); band.rotation.x = Math.PI / 2; band.scale.set(1, 0.8, 1);
}

export function buildPegboard() {
  const tex = boardTexture(); tex.anisotropy = 8;
  plane(B.w, B.h, tex, B.x, B.y, B.z, -Math.PI / 2);
  // left: fans, tape, a hammer, darts
  fan(-1.72, 2.3, fanMs[0], 0.2); fan(-1.45, 2.36, fanMs[1], -0.15); fan(-1.2, 2.4, fanMs[0], 0.05);
  [[-1.62, 1.88], [-1.48, 1.84], [-1.4, 1.72], [-1.62, 1.75]].forEach(([z, y], i) => tape(z, y, tapeMs[i]));
  hammer(-1.05, 1.65);
  darts(-1.5, 1.3);
  // the kitchen tools in the middle: red spatulas, then the steel and the teal strainer
  [-0.72, -0.6, -0.48, -0.36, -0.24].forEach((z, i) => spatula(z, 1.62 + (i % 2) * 0.06));
  whisk(-0.12, 1.52); strainer(0.0, 1.62); ladle(0.12, 1.58); whisk(0.24, 1.55);
  controller(0.0, 2.02);
  // little shelves: bottles and a lucky cat
  shelf(0.75, 1.72, 0.32); shelf(0.72, 1.52, 0.38);
  [[0.62, brownGlass], [0.68, brownGlass], [0.74, clearGlass], [0.8, brownGlass]].forEach(([z, m]) => bottle(z, 1.726, m));
  [[0.58, clearGlass, 0.08], [0.64, brownGlass, 0.08]].forEach(([z, m, h]) => bottle(z, 1.526, m, h));
  luckyCat(0.82, 1.526);
  roadSign(1.12, 2.22);
  // the mugs on the right, steel and one blue
  [[1.55, 1.42, steel], [1.68, 1.52, steel], [1.82, 1.44, blueEnamel], [1.95, 1.56, steel], [1.6, 1.66, steel], [1.78, 1.74, steel],
    [1.92, 1.88, blueEnamel], [1.48, 1.86, steel], [2.02, 2.04, steel], [1.7, 1.98, steel]].forEach(([z, y, m]) => mug(z, y, m));
  // another shelf of little toys, and a couple of plush and toy heads on pegs
  shelf(1.08, 1.86, 0.3);
  [0.98, 1.06, 1.14, 1.2].forEach(z => toy(z, 1.866));
  ball(-1.2, 1.94, 0xd8261e, 0x2b4fa8); ball(0.45, 1.72, 0xf2c418, 0x111111); ball(-0.95, 1.5, 0xf6f6f2, 0xd8261e);
}
