// The outdoor area (戶外區, under the arcade): linked plastic chairs down both sides, the block-and-crate table down the middle, the Open stack,
// the skateboard, the scooter seats and the kerb camping chair.
import * as THREE from 'three';
import { ctx, mat, box, cyl, canvasTex, plane } from '../engine.js';
import { S } from '../state.js';
import { pick, DOT } from '../util.js';
import { STRIP } from '../layout.js';
import { blackM, cinderM, CRATE_ORANGE, GLOSS_ORANGE, cinderBlock, cinderSeat, blockStack, crate, linkedChairs, campChair, figurine } from './props.js';

const potM = () => mat(0xb5643c), leafM = () => mat(0x3f6b3a);
function pottedPlant(x, y, z) {
  cyl(0.07, 0.06, 0.1, potM(), x, y + 0.05, z, ctx.scene, 10);
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), leafM()); l.position.set(x, y + 0.16, z); ctx.scene.add(l);
}

// the middle table, from the street inwards: cinder blocks with a plant, three stacks of crates, cinder blocks with a plant
const STRIP_TOPS = ['orange', 'green', 'blue'];
function middleStrip() {
  const scene = ctx.scene;
  const stripStart = scene.children.length;
  STRIP.blocks.forEach(z => {
    const h = 0.215;                      // three single blocks lying crosswise, a touch taller than the crates
    for (let c = 0; c < 3; c++) cinderBlock(0.4, h, 0.2, -1.0, h * (c + 0.5), z);
    pottedPlant(-1.0, h * 3, z);
  });
  // three crate stacks end to end; a touch smaller so they don't overlap
  STRIP.crates.forEach((z, i) => { crate(-1.0, 0, z, 'blue', 0, 0.875); crate(-1.0, 0.3, z, STRIP_TOPS[i], 0, 0.875); });
  // the real crates and blocks read bigger than the plan pieces: scale the strip up in footprint, keep its height
  const stripGroup = new THREE.Group(); stripGroup.position.set(-1.0, 0, STRIP.from); scene.add(stripGroup);
  scene.children.slice(stripStart, -1).forEach(o => stripGroup.attach(o));
  stripGroup.scale.set(STRIP.scale, 1, STRIP.scale); stripGroup.position.z = STRIP.to;
}

function openStackAndSkate() {
  // corner by the front wall: stacked cinder blocks with the little "open" neon
  const openStack = new THREE.Group(); openStack.position.set(-2.88, 0, 4.55); openStack.rotation.y = Math.PI / 2; ctx.scene.add(openStack);   // holes face into the arcade
  [-0.1, 0.1].forEach(x => { const b = box(0.4, 0.2, 0.2, cinderM, x, 0.2, 0, openStack); b.rotation.z = Math.PI / 2; });   // two standing upright
  box(0.4, 0.2, 0.2, cinderM, 0, 0.5, 0, openStack);                                                                           // one lying across the top
  [[-0.1, 0.1], [-0.1, 0.3], [0.1, 0.1], [0.1, 0.3], [-0.1, 0.5], [0.1, 0.5]].forEach(([x, y]) => {                               // little toys tucked into the holes
    box(0.04, 0.07, 0.04, mat(pick([0xff4f7b, 0x7ec8ff, 0xffd23f, 0x3ddc97, 0xf4efe3, 0xc0282d])), x, y - 0.04, 0.12, openStack);
  });
  const openNeon = canvasTex(128, 48, (g, w, h) => {
    g.shadowBlur = 8; g.lineWidth = 3;
    g.shadowColor = '#3a8bff'; g.strokeStyle = '#9cc8ff'; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 6, h / 2 - 6, 0, 0, Math.PI * 2); g.stroke();
    g.shadowColor = '#ff2a1a'; g.strokeStyle = '#ff8a7a'; g.lineWidth = 3; g.font = `italic 30px ${DOT}`; g.textAlign = 'center'; g.strokeText('Open', w / 2, h / 2 + 10);
  }, false);
  S.fontTex.push(openNeon);
  openStack.add(plane(0.48, 0.2, openNeon, 0, 0.72, 0, 0, true));                                                         // red "Open" in a blue ring, on top
  // skateboard standing on its tail, leaning on the side wall next to the Open stack: graphic side out, trucks and wheels showing
  const skate = new THREE.Group(); skate.position.set(-2.86, 0, 4.22); skate.rotation.z = 0.16; ctx.scene.add(skate);
  const deckArt = canvasTex(32, 128, (g, w, h) => {
    for (let y = 0; y < h; y += 8) { g.fillStyle = (y / 8) % 2 ? '#f4efe3' : '#111'; g.fillRect(0, y, w, 8); }
    g.fillStyle = '#d8262a'; g.beginPath(); g.ellipse(16, 70, 10, 22, 0.3, 0, Math.PI * 2); g.fill();
    g.fillRect(6, 30, 20, 6); g.fillRect(9, 100, 14, 10);
  }, true);
  const gripM = mat(0x161616, { roughness: 1 }), plyM = mat(0xc9a06a, { roughness: 0.8 }), artM = new THREE.MeshStandardMaterial({ map: deckArt, roughness: 0.5 });
  const deckMats = [artM, gripM, plyM, plyM, plyM, plyM];          // +x graphic faces the room, -x grip tape faces the wall
  box(0.014, 0.56, 0.2, deckMats, 0, 0.42, 0, skate);
  [[0.1, -1], [0.74, 1]].forEach(([y, sgn]) => { const t = box(0.014, 0.13, 0.2, deckMats, 0.018, y, 0, skate); t.rotation.z = sgn * 0.32; });   // kicktails
  const truckM = mat(0xb9bec4, { metalness: 0.8, roughness: 0.3 }), wheelM = mat(0xefe6c8, { roughness: 0.5 });
  [0.22, 0.62].forEach(y => {
    box(0.03, 0.03, 0.16, truckM, 0.03, y, 0, skate);
    [-0.085, 0.085].forEach(z => { const wl = cyl(0.027, 0.027, 0.03, wheelM, 0.055, y, z, skate, 12); wl.rotation.x = Math.PI / 2; });
  });
}

function street() {
  // two seats with a cinder-block table between them, tucked up toward the camping chair
  const SX = -0.35;   // the set sits a little to the left as you look in from the street
  cinderSeat(-0.5 + SX, 7.75); cinderSeat(0.38 + SX, 7.75); blockStack(-0.06 + SX, 7.75);
  // short umbrella stand in the corner at the street opening, behind the brick seat
  cyl(0.12, 0.11, 0.34, mat(0x9aa0a6, { metalness: 0.6, roughness: 0.4 }), 0.82, 0.17, 7.9, ctx.scene, 14);
  [[0.0, 0.0, 0x2a2a2a], [0.04, 0.03, 0x1c4fd6], [-0.04, 0.02, 0xc0282d]].forEach(([dx, dz, c]) => { const u = cyl(0.025, 0.04, 0.7, mat(c), 0.82 + dx, 0.45, 7.9 + dz, ctx.scene, 8); u.rotation.z = dx * 2; });
  // cinder stacks with little plants on the street end
  [[-2.8, 7.55], [-2.35, 7.7]].forEach(([x, z]) => { cinderBlock(0.4, 0.2, 0.2, x, 0.1, z); cinderBlock(0.4, 0.2, 0.2, x, 0.3, z); pottedPlant(x, 0.4, z); });
  const scooter = new THREE.Group(); scooter.position.set(0.55, 0, 8.75); scooter.rotation.y = 0.1; ctx.scene.add(scooter);   // the cream vespa out front
  const creamM = mat(0xd8cdb4, { roughness: 0.35, metalness: 0.2 });
  box(0.4, 0.35, 1.2, creamM, 0, 0.45, 0, scooter);
  box(0.36, 0.12, 0.6, blackM, 0, 0.68, -0.1, scooter);
  box(0.4, 0.7, 0.18, creamM, 0, 0.75, 0.55, scooter);
  box(0.6, 0.04, 0.04, blackM, 0, 1.12, 0.6, scooter);
  [-0.5, 0.55].forEach(z => { const w = cyl(0.2, 0.2, 0.1, blackM, 0, 0.2, z, scooter, 14); w.rotation.z = Math.PI / 2; });
  box(4.0, 0.3, 0.12, mat(0x2a4f8a), -1.05, 2.62, 8.2);                                  // blue lintel over the opening
  [[-3.0, 1.8], [0.95, 1.6]].forEach(([x, y]) => box(0.18, 0.22, 0.08, mat(0xd9d9d0), x, y, 8.22));   // electricity meters
  campChair(-0.55, 8.55, 0, 0xc4a27e);                                                    // one milk-tea camping chair facing the street
  crate(-0.55, 0, 9.15, 'blue'); crate(-0.55, 0.3, 9.15, 'orange');                       // two stacked crates as its table
}

// smoking is allowed outside: an ashtray (a couple of butts in it) on some of the tables
function ashtray(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.random() * 3; ctx.scene.add(g);
  cyl(0.05, 0.045, 0.018, mat(0x8f969c, { metalness: 0.7, roughness: 0.35 }), 0, 0.009, 0, g, 16);
  cyl(0.04, 0.04, 0.004, mat(0x3a3a3c, { roughness: 1 }), 0, 0.017, 0, g, 16);
  [[0.012, 0.6], [-0.015, -0.4]].forEach(([dx, r]) => { const b = cyl(0.0045, 0.0045, 0.03, mat(0xd9a05a), dx, 0.022, dx, g, 6); b.rotation.set(Math.PI / 2, r, 0); });
}

// ---------------------------------------------------------------- the pictures on the grey wall behind the seats
// hung on wires from a black rail up by the ceiling: a small dark frame, a big black-and-white lotus print,
// a square white canvas with a kid in a space helmet, a small framed character, and a dark square with an astronaut
const WALL_X = -3.0;   // just off the wall's face
function art(w, h, draw) { return canvasTex(Math.round(w * 400), Math.round(h * 400), draw); }
function helmetKid(g, cx, cy, r, face, bg) {
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, cx * 2, cy * 2); }
  g.fillStyle = '#f4f4f2'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();                       // helmet
  g.lineWidth = r * 0.12; g.strokeStyle = '#1f1c27'; g.beginPath(); g.arc(cx, cy, r * 0.97, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#1f1c27'; g.beginPath(); g.arc(cx, cy + r * 0.08, r * 0.72, 0, Math.PI * 2); g.fill();     // visor ring
  g.fillStyle = face; g.beginPath(); g.ellipse(cx + r * 0.08, cy + r * 0.18, r * 0.5, r * 0.55, 0, 0, Math.PI * 2); g.fill();   // face
  g.fillStyle = '#2a3b4a'; g.beginPath(); g.ellipse(cx - r * 0.05, cy - r * 0.2, r * 0.55, r * 0.3, -0.2, 0, Math.PI * 2); g.fill();   // hair
  g.fillStyle = '#111'; g.fillRect(cx + r * 0.2, cy + r * 0.1, r * 0.12, r * 0.05);                         // eye
  g.fillStyle = '#9ad7ff'; g.beginPath(); g.ellipse(cx - r * 0.35, cy - r * 0.45, r * 0.12, r * 0.06, -0.6, 0, Math.PI * 2); g.fill();   // glint
}
function gallery() {
  const black = mat(0x111111, { roughness: 0.5 });
  const hang = (z, y, w, h, tex, frame) => {
    if (frame) box(0.025, h + 0.05, w + 0.05, frame === true ? black : frame, WALL_X - 0.005, y, z);
    plane(w, h, tex, WALL_X + 0.01, y, z, Math.PI / 2);
    // two wires up to the rail
    [-1, 1].forEach(s => { const top = y + h / 2 + 0.025, len = 2.62 - top; const wire = cyl(0.0015, 0.0015, len, mat(0x2a2a2a), WALL_X + 0.005, top + len / 2, z + s * w * 0.3, ctx.scene, 4); wire.castShadow = false; });
  };
  box(0.03, 0.03, 3.7, black, -3.03, 2.62, 6.0);                                                     // the picture rail
  // left (toward the street): a small dark frame of little tiles
  hang(7.0, 1.98, 0.24, 0.2, art(0.24, 0.2, (g, w, h) => {
    g.fillStyle = '#2b2b2b'; g.fillRect(0, 0, w, h);
    const cols = ['#c9c3b0', '#7a8f6a', '#3d5a3d', '#a8a08a', '#556b4f'];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.fillStyle = cols[(r * 3 + c) % cols.length]; g.fillRect(8 + c * (w - 16) / 4 + 2, 8 + r * (h - 16) / 4 + 2, (w - 16) / 4 - 4, (h - 16) / 4 - 4); }
  }), true);
  // the big black-and-white print: lotus flowers in swirling clouds, a line of text along the bottom
  hang(6.32, 1.98, 0.62, 0.42, art(0.62, 0.42, (g, w, h) => {
    g.fillStyle = '#efe9da'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#1b1b1b'; g.fillStyle = '#1b1b1b'; g.lineWidth = 3;
    for (let i = 0; i < 7; i++) { const x = 40 + i * 36, y = 40 + (i % 3) * 30; g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 1.6); g.stroke(); g.beginPath(); g.arc(x + 8, y + 2, 6, 0, Math.PI * 1.5); g.stroke(); }   // clouds
    const lotus = (cx, cy, s) => {
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(cx + k * 12 * s, cy - Math.abs(k) * -4 * s, 9 * s, 26 * s, k * 0.35, 0, Math.PI * 2); g.fill(); g.fillStyle = '#efe9da'; g.beginPath(); g.ellipse(cx + k * 12 * s, cy + 2 * s - Math.abs(k) * -4 * s, 5 * s, 19 * s, k * 0.35, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1b1b1b'; }
    };
    lotus(70, 92, 1.3); lotus(185, 70, 1.0);
    g.beginPath(); g.ellipse(160, 118, 30, 12, 0, 0, Math.PI * 2); g.fill();                         // a fish in the swirl
    for (let i = 0; i < 22; i++) g.fillRect(16 + i * 10.5, h - 22, 7, 5);                              // the line of text, as marks
    g.fillRect(16, h - 12, 90, 2);
  }), true);
  // the square white canvas, no frame: a kid in a space helmet
  hang(5.72, 1.9, 0.4, 0.4, art(0.4, 0.4, (g, w, h) => { g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h); helmetKid(g, w / 2, h / 2, w * 0.36, '#4fb0b0'); }), mat(0xe8e6e0));
  box(0.012, 0.1, 0.07, mat(0xc9a64a, { metalness: 0.7, roughness: 0.35 }), WALL_X, 1.55, 5.72);         // the brass light switch below it
  // a small framed character, and lower down a dark square with an astronaut
  hang(5.26, 2.0, 0.17, 0.24, art(0.17, 0.24, (g, w, h) => {
    g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8c34a'; g.beginPath(); g.arc(w / 2, h * 0.35, w * 0.16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7a5bc0'; g.fillRect(w * 0.34, h * 0.45, w * 0.32, h * 0.3);
    g.fillStyle = '#c0282d'; g.fillRect(w * 0.3, h * 0.75, w * 0.4, h * 0.06);
  }), true);
  hang(5.04, 1.66, 0.22, 0.22, art(0.22, 0.22, (g, w, h) => helmetKid(g, w / 2, h / 2, w * 0.36, '#5fbf6a', '#141414')), true);
}

// figurines and a katana by the Open sign, as next to the seats
function openCorner() {
  [[-2.97, 4.42, 1.4], [-2.8, 4.45, 1.2], [-2.96, 4.7, 1.3], [-2.82, 4.68, 1.5]].forEach(([x, z, s]) => figurine(x, 0.6, z, s));
  const katana = new THREE.Group(); katana.position.set(-2.98, 0, 4.9); katana.rotation.z = 0.1; ctx.scene.add(katana);
  cyl(0.013, 0.012, 0.72, mat(0x141414, { roughness: 0.35 }), 0, 0.36, 0, katana, 8);                // the scabbard
  cyl(0.026, 0.026, 0.008, mat(0x8a7a4a, { metalness: 0.7 }), 0, 0.725, 0, katana, 12);             // the guard
  const hilt = canvasTex(8, 32, (g) => { g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, 8, 32); g.fillStyle = '#111'; for (let y = 0; y < 32; y += 6) { g.beginPath(); g.moveTo(4, y); g.lineTo(8, y + 3); g.lineTo(4, y + 6); g.lineTo(0, y + 3); g.fill(); } }, true);
  cyl(0.014, 0.014, 0.24, new THREE.MeshStandardMaterial({ map: hilt, roughness: 0.6 }), 0, 0.85, 0, katana, 8);   // white-and-black wrapped hilt
}

export function buildArcade() {
  linkedChairs(-2.72, 6.0, Math.PI / 2, [GLOSS_ORANGE, GLOSS_ORANGE, GLOSS_ORANGE]);   // row along the grey wall
  linkedChairs(0.62, 6.6, -Math.PI / 2, [0xff8fb0, 0xffc21a, CRATE_ORANGE]);           // along the storage wall: orange, yellow, pink from the street in
  middleStrip();
  ashtray(-1.0, 0.6, STRIP.at(STRIP.crates[2]));           // on the inner crates, between the cups (the tops stadium goes nearer the street)
  ashtray(-0.31, 0.6, 7.66);                                // the block table between the two seats by the scooter, clear of their cups
  ashtray(-0.45, 0.6, 9.12);                                // the camping chair's crates on the kerb
  openStackAndSkate();
  openCorner();
  street();
  gallery();
  // a stack of blocks with a plant just past the street end of the seats, toys in its holes
  cinderBlock(0.2, 0.2, 0.4, -2.88, 0.1, 6.98); cinderBlock(0.2, 0.2, 0.4, -2.88, 0.3, 6.98);
  pottedPlant(-2.88, 0.4, 6.98);
}
