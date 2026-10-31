// Inside the shop: manga ledge, TV cart, purple-wall seats, toy boxes, the bar and the work counter, and the decor.
import * as THREE from 'three';
import { ctx, mat, box, cyl, canvasTex, plane } from '../engine.js';
import { S } from '../state.js';
import { rand, randi, pick, DOT } from '../util.js';
import { TVX, TVZ, TVY, LW, LSEATS } from '../layout.js';
import { buildMenuClipboard } from './menu.js';
import { woodM, steel, blackM, cinderSeat, crate, crateTable, stump, highStool, figurine, framed, trackRun, ceilingFan } from './props.js';

function ledgeAndTv() {
  // ledge under the neon: manga on the shelf, three high stools facing the wall
  box(3.4, 0.05, 0.34, woodM, 1.0, 1.0, -5.3);
  [-0.5, 1.0, 2.5].forEach(x => box(0.04, 0.2, 0.25, blackM, x, 0.88, -5.36));
  for (let i = 0; i < 58; i++) box(0.045, rand(0.17, 0.2), 0.12, mat(pick([0xd8d0c0, 0xf2f2f2, 0xc94a3a, 0x3a5fa8, 0xe6c34a, 0x2a2a2a])), -0.6 + i * 0.058, 1.12, -5.42);
  [0.1, 1.0, 1.9].forEach(x => highStool(x, -4.95));
  // the TV stands on a rolling TV cart near the purple wall, with a PS5 on the shelf underneath
  const cartM = mat(0x1b1b1d, { metalness: 0.6, roughness: 0.35 });
  box(0.5, 0.04, 0.9, cartM, TVX - 0.08, 0.08, TVZ);                                                        // base
  [[-0.25, -0.4], [-0.25, 0.4], [0.15, -0.4], [0.15, 0.4]].forEach(([dx, dz]) => { const w = cyl(0.035, 0.035, 0.03, blackM, TVX - 0.08 + dx, 0.035, TVZ + dz, ctx.scene, 10); w.rotation.z = Math.PI / 2; });   // casters
  [-0.22, 0.22].forEach(dz => box(0.05, 1.6, 0.05, cartM, TVX - 0.1, 0.88, TVZ + dz));                     // twin poles
  box(0.36, 0.03, 0.62, cartM, TVX - 0.04, 0.42, TVZ);                                                     // console shelf
  box(0.3, 0.09, 0.39, mat(0xf4f4f2, { roughness: 0.3 }), TVX - 0.04, 0.48, TVZ);                          // PS5, lying flat
  box(0.31, 0.04, 0.12, mat(0x111111, { roughness: 0.3 }), TVX - 0.04, 0.48, TVZ);
  box(0.01, 0.01, 0.06, 0x7ec8ff, TVX + 0.11, 0.505, TVZ + 0.12).castShadow = false;
  S.tvFrame = box(0.07, 0.98, 1.72, mat(0x0c0c0c, { roughness: 0.3 }), TVX + 0.03, TVY, TVZ);
  [-0.95, 0.95].forEach(dz => { box(0.16, 0.26, 0.16, mat(0x1a1a1a), -2.92, 0.13, TVZ + dz); box(0.16, 0.2, 0.16, mat(0x1a1a1a), -2.92, 0.36, TVZ + dz); });
  [-3.6, -2.7].forEach(z => highStool(-0.45, z));   // the two 2K seats: round metal stools like at the manga ledge
}

function purpleWall() {
  // from the door inwards: seat, crate table, seat, stump, seat, crate table, seat (the corner behind the door holds the toy boxes)
  LSEATS.forEach(z => cinderSeat(LW, z));
  crateTable(LW + 0.04, 1.45, 'orange'); stump(LW, 0.35); crateTable(LW + 0.04, -0.75, 'orange');
  // toy boxes behind the inward-opening front door: smallish and a bit messy, but stacked sensibly (bigger ones lower), under a metre high
  const TOYS = [0x2a2f6b, 0x8a1d1d, 0x1d1d1d, 0xe6c34a, 0xff4f7b, 0x7ec8ff, 0xf4efe3, 0x3ddc97];
  [2.5, 2.86, 3.2, 3.55].forEach(zc => {
    const n = randi(3, 5);
    const sizes = Array.from({ length: n }, () => ({ w: rand(0.18, 0.32), d: rand(0.16, 0.28), h: rand(0.1, 0.24) }))
      .sort((p, q) => q.w * q.d - p.w * p.d);                                   // largest footprint at the bottom
    let y = 0;
    const maxH = rand(0.7, 0.95);
    sizes.forEach((b, i) => {
      if (y + b.h > maxH) return;
      const w = i ? Math.min(b.w, sizes[i - 1].w) : b.w, d = i ? Math.min(b.d, sizes[i - 1].d) : b.d;
      const bx = box(d, b.h, w, mat(pick(TOYS), { roughness: 0.6 }), -3.02 + d / 2 + rand(0, 0.04), y + b.h / 2, zc + rand(-0.04, 0.04));
      bx.rotation.y = rand(-0.18, 0.18);
      const lab = box(0.005, b.h * 0.35, w * 0.55, mat(0xf4efe3), d / 2 + 0.003, b.h * 0.05, 0, bx); lab.castShadow = false;   // label window
      y += b.h;
    });
  });
  const dartTex = canvasTex(128, 128, (g, w) => {
    const c = w / 2; const rings = [[62, '#111'], [56, '#e8e0c8'], [50, '#111'], [44, '#c0282d'], [40, '#e8e0c8'], [26, '#111'], [22, '#2e8b57'], [8, '#c0282d'], [4, '#2e8b57']];
    rings.forEach(([r, col]) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill(); });
    g.strokeStyle = 'rgba(200,200,200,.6)'; g.lineWidth = 1;
    for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * 56, c + Math.sin(a) * 56); g.stroke(); }
  });
  const board = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.045, 32), [mat(0x1a1a1a), new THREE.MeshStandardMaterial({ map: dartTex, roughness: 0.8 }), mat(0x1a1a1a)]);
  board.rotation.z = -Math.PI / 2; board.position.set(-2.995, 1.55, 3.06); board.castShadow = true; ctx.scene.add(board);   // round dartboard
  [[0.06, 0.03, 0xc0282d], [-0.09, -0.05, 0x1c4fd6], [0.02, -0.12, 0xffd23f]].forEach(([dy, dz, c]) => {   // darts stuck in it
    const d = cyl(0.006, 0.004, 0.13, mat(0x9aa0a6, { metalness: 0.8 }), -2.91, 1.55 + dy, 3.06 + dz, ctx.scene, 6); d.rotation.z = Math.PI / 2 + 0.15;
    box(0.04, 0.035, 0.005, mat(c), -2.84, 1.56 + dy, 3.06 + dz).castShadow = false; box(0.04, 0.005, 0.035, mat(c), -2.84, 1.56 + dy, 3.06 + dz).castShadow = false;
  });
  box(0.16, rand(0.2, 0.32), 0.24, mat(pick([0x2a2f6b, 0x8a1d1d, 0x1d1d1d, 0xe6c34a])), -2.9, 0.15, -2.25);   // a toy box on the floor along the wall
}


// a slab from x0..x1, z0..z1, y0..y1 with a rectangular hole cut through it (four boxes round the hole)
function holed(x0, x1, z0, z1, y0, y1, h, m) {
  const y = (y0 + y1) / 2, t = y1 - y0;
  box(x1 - x0, t, h.z0 - z0, m, (x0 + x1) / 2, y, (z0 + h.z0) / 2);
  box(x1 - x0, t, z1 - h.z1, m, (x0 + x1) / 2, y, (h.z1 + z1) / 2);
  box(h.x0 - x0, t, h.z1 - h.z0, m, (x0 + h.x0) / 2, y, (h.z0 + h.z1) / 2);
  box(x1 - h.x1, t, h.z1 - h.z0, m, (h.x1 + x1) / 2, y, (h.z0 + h.z1) / 2);
}

// a steel sink basin dropped into a hole h cut down from a counter top at `top`: bottom, four walls, a rim and a drain
function basin(h, top) {
  const sinkM = mat(0x9aa1a7, { metalness: 0.8, roughness: 0.25 }), wallM = mat(0x7d848a, { metalness: 0.75, roughness: 0.3 });
  const sx = (h.x0 + h.x1) / 2, sz = (h.z0 + h.z1) / 2, sw = h.x1 - h.x0, sd = h.z1 - h.z0, dep = top - h.floor;
  box(sw, 0.01, sd, sinkM, sx, h.floor + 0.005, sz);
  box(0.01, dep, sd, wallM, h.x0 + 0.005, h.floor + dep / 2, sz); box(0.01, dep, sd, wallM, h.x1 - 0.005, h.floor + dep / 2, sz);
  box(sw, dep, 0.01, wallM, sx, h.floor + dep / 2, h.z0 + 0.005); box(sw, dep, 0.01, wallM, sx, h.floor + dep / 2, h.z1 - 0.005);
  holed(h.x0 - 0.04, h.x1 + 0.04, h.z0 - 0.04, h.z1 + 0.04, top, top + 0.012, h, sinkM);
  cyl(0.03, 0.03, 0.004, mat(0x3a3f44, { metalness: 0.6, roughness: 0.3 }), sx, h.floor + 0.012, sz, ctx.scene, 16);
}

function bar() {
  // 吧台: island bar, white top, wood front with taped posters; the espresso machine sits on it
  // the body and the white top are built round a hole at the inner end, where the sink basin drops in
  const barM = mat(0x7a2620, { roughness: 0.55 }), topM = mat(0xf2f0ec, { roughness: 0.3 });
  const SINK = { x0: 0.19, x1: 0.81, z0: -1.81, z1: -1.29, floor: 0.78 };
  box(1.45, SINK.floor, 4.6, barM, 0.475, SINK.floor / 2, 0.3);
  holed(-0.25, 1.2, -2.0, 2.6, SINK.floor, 1.0, SINK, barM);
  holed(-0.325, 1.275, -2.075, 2.675, 1.0, 1.06, SINK, topM);
  const posterCols = ['#ff4f7b', '#ffd23f', '#7ec8ff', '#3ddc97', '#f08a24'];
  [-1.4, -0.3, 0.8, 1.9].forEach((z, i) => {
    const t = canvasTex(12, 16, (g) => { g.fillStyle = '#f4efe3'; g.fillRect(0, 0, 12, 16); g.fillStyle = posterCols[i]; g.fillRect(1, 1, 10, 9); g.fillStyle = '#1f1c27'; g.fillRect(3, 3, 6, 5); g.fillRect(1, 12, 10, 1); g.fillRect(1, 14, 7, 1); }, true);
    plane(0.32, 0.44, t, -0.26, 0.55, z, -Math.PI / 2);
  });
  const machine = new THREE.Group(); machine.position.set(0.5, 1.06, 1.5); machine.rotation.y = Math.PI / 2; ctx.scene.add(machine);
  box(0.78, 0.46, 0.52, mat(0x26252c, { roughness: 0.25, metalness: 0.7 }), 0, 0.23, 0, machine);
  box(0.8, 0.08, 0.54, mat(0x111111, { roughness: 0.3 }), 0, 0.5, 0, machine);
  [-0.2, 0.2].forEach(x => { cyl(0.05, 0.045, 0.09, steel, x, 0.15, 0.3, machine); cyl(0.012, 0.012, 0.2, blackM, x, 0.15, 0.4, machine, 6).rotation.x = Math.PI / 2; });
  for (let i = 0; i < 9; i++) {          // stickers on the side customers see
    const s = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.07, 0.13), rand(0.06, 0.12)), new THREE.MeshBasicMaterial({ color: new THREE.Color(pick(posterCols)), toneMapped: true }));
    s.position.set(rand(-0.33, 0.33), rand(0.06, 0.42), -0.262); s.rotation.y = Math.PI; s.rotation.z = rand(-0.4, 0.4); machine.add(s);
  }
  for (let i = 0; i < 6; i++) cyl(0.04, 0.035, 0.12, mat(0xe8f4ff, { roughness: 0.05, transparent: true, opacity: 0.5 }), -0.3 + (i % 3) * 0.1, 0.6, -0.1 + Math.floor(i / 3) * 0.1, machine, 10);
  cyl(0.08, 0.05, 0.07, mat(0xc0282d), 0.2, 0.575, 0.05, machine, 14); cyl(0.08, 0.05, 0.07, mat(0xf0c419), 0.32, 0.575, 0.05, machine, 14); // Taiwanese flower bowls
  buildMenuClipboard();
  grinder(0.62, 0.95);
  underBar();
  basin(SINK, 1.06);
  const chromeM = mat(0xc9c9c9, { metalness: 0.9, roughness: 0.2 });
  cyl(0.014, 0.014, 0.32, chromeM, 0.04, 1.22, -1.68, ctx.scene, 8);                                     // gooseneck tap
  const spout = cyl(0.011, 0.011, 0.22, chromeM, 0.15, 1.38, -1.68, ctx.scene, 8); spout.rotation.z = Math.PI / 2;   // its spout points over the sink at the owner
  box(0.03, 0.06, 0.03, chromeM, 0.04, 1.08, -1.68);
  cyl(0.009, 0.009, 0.36, chromeM, 0.04, 1.24, -1.36, ctx.scene, 8);                                     // filtered-water tap, thin and tall
  const fSpout = cyl(0.008, 0.008, 0.14, chromeM, 0.11, 1.42, -1.36, ctx.scene, 8); fSpout.rotation.z = Math.PI / 2;
  cyl(0.018, 0.018, 0.02, mat(0x3a7bd5), 0.04, 1.33, -1.36, ctx.scene, 10);
  // the toys crowd the espresso machine: a row along its customer-facing side, more around both ends
  for (let i = 0; i < 12; i++) figurine(0.02 + (i % 2) * 0.1, 1.06, 1.08 + i * 0.07, rand(1.1, 1.9));
  for (let i = 0; i < 8; i++) figurine(0.3 + rand(0, 0.7), 1.06, rand(1.93, 2.05), rand(1.0, 1.6));
  for (let i = 0; i < 5; i++) figurine(0.45 + rand(0, 0.4), 1.06, rand(0.6, 0.72), rand(1.0, 1.5));   // past the grinder
  // lucky cat with a flexed arm, the bar's mascot
  const cat = new THREE.Group(); cat.position.set(0.3, 1.06, 2.55); cat.rotation.y = -Math.PI / 2; ctx.scene.add(cat);
  const goldM = mat(0xd9a520, { roughness: 0.25, metalness: 0.8 });
  box(0.16, 0.16, 0.12, goldM, 0, 0.08, 0, cat); box(0.18, 0.14, 0.13, goldM, 0, 0.23, 0, cat); box(0.12, 0.03, 0.02, mat(0x111111), 0, 0.25, 0.07, cat);
  box(0.05, 0.18, 0.05, goldM, 0.1, 0.32, 0, cat).rotation.z = -0.3;
  stump(0.55, -2.4, 0.45);   // a tree stump at the top end of the bar
}

// the coffee grinder on the bar, right beside the espresso machine: base, motor body, chute, and a hopper of beans
function grinder(x, z) {
  const g = new THREE.Group(); g.position.set(x, 1.06, z); ctx.scene.add(g);
  const bodyM = mat(0x2b2a2e, { roughness: 0.3, metalness: 0.6 });
  box(0.2, 0.04, 0.22, bodyM, 0, 0.02, 0, g);                                                    // base with the cup fork
  box(0.16, 0.3, 0.17, bodyM, 0, 0.19, -0.03, g);                                                // motor body
  box(0.05, 0.05, 0.07, steel, 0.07, 0.14, 0.05, g);                                             // chute toward the owner
  box(0.03, 0.03, 0.06, blackM, 0.06, 0.06, 0.06, g);                                            // portafilter fork
  cyl(0.06, 0.05, 0.03, steel, 0, 0.355, -0.03, g, 14);                                          // burr collar
  cyl(0.085, 0.045, 0.17, mat(0xd8e4ea, { roughness: 0.05, transparent: true, opacity: 0.45 }), 0, 0.455, -0.03, g, 16);   // hopper
  cyl(0.06, 0.045, 0.08, mat(0x3b2214, { roughness: 0.9 }), 0, 0.415, -0.03, g, 14);            // beans in it
  cyl(0.088, 0.088, 0.015, blackM, 0, 0.545, -0.03, g, 16);                                      // lid
}

// under the bar on the owner's side: an under-counter ice maker and a little fridge, doors facing him
function underBar() {
  const X = 1.205;                                          // the bar front on his side
  const steelFront = mat(0xb9bec2, { metalness: 0.75, roughness: 0.3 });
  const darkM = mat(0x1d1f22, { roughness: 0.4 });
  // ice maker: steel front, a flap door with a handle, a vent grille at the bottom
  box(0.02, 0.82, 0.55, steelFront, X, 0.43, 0.25);
  box(0.022, 0.28, 0.47, mat(0xa9aeb2, { metalness: 0.8, roughness: 0.25 }), X + 0.004, 0.62, 0.25);
  box(0.03, 0.025, 0.3, darkM, X + 0.02, 0.78, 0.25);
  for (let i = 0; i < 5; i++) box(0.024, 0.012, 0.45, darkM, X + 0.004, 0.08 + i * 0.03, 0.25);
  box(0.024, 0.04, 0.12, mat(0x2a6fd6, { roughness: 0.4 }), X + 0.004, 0.4, 0.4);   // a little blue badge
  // the fridge next to it: white door, glass window, long bar handle
  box(0.02, 0.82, 0.6, mat(0xeeeeec, { roughness: 0.35 }), X, 0.43, -0.45);
  box(0.022, 0.34, 0.42, mat(0x9fb8c4, { roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.75 }), X + 0.004, 0.54, -0.47);
  [[0.72, 0x7ec8ff], [0.58, 0xf4efe3], [0.44, 0xffd23f]].forEach(([y, c]) => box(0.018, 0.08, 0.06, mat(c), X - 0.004, y - 0.06, -0.4 - Math.random() * 0.12));   // milk and bottles behind the glass
  box(0.035, 0.6, 0.025, steel, X + 0.025, 0.45, -0.2);
  for (let i = 0; i < 3; i++) box(0.024, 0.01, 0.5, darkM, X + 0.004, 0.07 + i * 0.025, -0.45);
}

function workCounter() {
  // 工作台 along the right wall, narrower: sink, tea cups; pegboard of stuff above
  // its little sink is sunk into the top too
  const WS = { x0: 2.68, x1: 3.04, z0: 1.0, z1: 1.4, floor: 0.76 }, ctrM = mat(0x3a3a3c, { roughness: 0.5 });
  box(0.45, WS.floor, 4.2, ctrM, 2.85, WS.floor / 2, 0.1);
  holed(2.625, 3.075, -2.0, 2.2, WS.floor, 0.92, WS, ctrM);
  holed(2.6, 3.1, -2.025, 2.175, 0.92, 0.96, WS, steel);
  basin(WS, 0.96);
  cyl(0.012, 0.012, 0.3, steel, 3.0, 1.1, 1.2, ctx.scene, 6);
  for (let i = 0; i < 6; i++) cyl(0.055, 0.04, 0.06, mat(0xf2f0ea, { roughness: 0.3 }), 2.78 + (i % 2) * 0.13, 0.99, 0.2 + Math.floor(i / 2) * 0.14, ctx.scene, 12);
  const pegTex = canvasTex(80, 26, (g) => { g.fillStyle = '#3a3f44'; g.fillRect(0, 0, 80, 26); g.fillStyle = '#1b1e21'; for (let x = 1; x < 80; x += 3) for (let y = 1; y < 26; y += 3) g.fillRect(x, y, 1, 1); }, true);
  plane(4.0, 1.3, pegTex, 3.01, 1.85, 0.1, -Math.PI / 2);
  for (let i = 0; i < 16; i++) {      // caps, fans, records, cassettes, controllers hanging on the pegboard
    const z = -1.7 + i * 0.24, y = rand(1.35, 2.35);
    if (i % 4 === 0) cyl(0.12, 0.12, 0.02, mat(0x111111), 2.98, y, z, ctx.scene, 16).rotation.z = Math.PI / 2;
    else box(0.04, rand(0.1, 0.22), rand(0.1, 0.2), mat(pick([0xc0282d, 0xffd23f, 0x7ec8ff, 0xf4efe3, 0xff7a12, 0x3ddc97])), 2.98, y, z);
  }
  // back end: two cinder seats against the wall with two stacked crates between them
  cinderSeat(2.75, -2.55); cinderSeat(2.75, -3.65);
  crate(2.72, 0, -3.1, 'green'); crate(2.72, 0.3, -3.1, 'orange');
  // door end: corner seats in an L, crates stacked in the corner
  cinderSeat(2.75, 2.95); cinderSeat(2.05, 3.7);
  crate(2.75, 0, 3.66, 'blue'); crate(2.75, 0.3, 3.66, 'orange');
}

// neon over exposed brick, AC, conduit and track lights, framed art, the ceiling fan
function decor() {
  const brickTex = canvasTex(220, 140, (g, w, h) => {
    g.beginPath(); g.moveTo(20, 30);
    [[60, 8], [120, 18], [180, 4], [214, 40], [206, 96], [214, 132], [150, 124], [90, 136], [30, 126], [6, 90], [14, 56]].forEach(([x, y]) => g.lineTo(x, y));
    g.closePath(); g.save(); g.clip();
    g.fillStyle = '#4a3a34'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 10; r++) for (let c = -1; c < 10; c++) { g.fillStyle = `hsl(${randi(8, 18)},${randi(25, 40)}%,${randi(30, 44)}%)`; g.fillRect(c * 26 + (r % 2) * 13 + 2, r * 14 + 2, 23, 11); }
    g.restore();
  });
  plane(2.4, 1.5, brickTex, 1.0, 1.85, -5.41);
  const neonTex = canvasTex(256, 256, (g, w, h) => {
    g.shadowColor = '#ff3a2a'; g.shadowBlur = 22; g.strokeStyle = '#ffb59a'; g.lineWidth = 9;
    g.beginPath(); g.arc(w / 2, h / 2, 104, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffd0b8'; g.textAlign = 'center'; g.font = `70px ${DOT}`;
    g.fillText('窺視', w / 2, h / 2 - 12); g.fillText('珈琲', w / 2, h / 2 + 66);
  });
  S.fontTex.push(neonTex);
  plane(0.95, 0.95, neonTex, 1.0, 1.95, -5.38, 0, true);
  [-0.3, 1.25, 2.4].forEach(x => figurine(x, 1.215, -5.42, 1.1));   // a few figurines standing on top of the manga, none in front of it
  // indoor AC above the sliding door
  box(1.15, 0.3, 0.24, mat(0xf2f2f0, { roughness: 0.4 }), -1.5, 2.45, -5.3);
  box(1.05, 0.02, 0.02, mat(0x9aa0a6), -1.5, 2.33, -5.17);                                                  // vent slot
  // conduit + track lights
  const conduitM = mat(0x2a2a2a, { roughness: 0.5 });
  const c1 = cyl(0.02, 0.02, 8.4, conduitM, -3.0, 2.62, -0.3, ctx.scene, 6); c1.rotation.x = Math.PI / 2;
  // the track lights run round a rectangle over the room: the two long runs and the two short ones closing it off
  trackRun(-1.0, -4.2, -1.0, 3.6); trackRun(1.7, -4.2, 1.7, 3.6);
  trackRun(-1.0, -4.2, 1.7, -4.2, 2.75, 1.0); trackRun(-1.0, 3.6, 1.7, 3.6, 2.75, 1.0);
  framed('hoop', -3.04, 1.9, -1.4, 0.55, 0.75, '#c0282d');
  framed('toys', -3.04, 2.0, -0.4, 0.5, 0.7, '#ffd23f', 0x7a1c1c);
  framed('eye', -3.04, 1.75, 0.25, 0.3, 0.25, '#ff4f7b', 0x7a1c1c);
  framed('wave', -3.04, 1.9, 1.9, 0.95, 0.72, '#f4efe3', 0x1a1410);   // kept clear of the dartboard
  // a cluster of small black frames, like the gallery seen from the sliding door
  [[-4.4, 1.95], [-3.95, 1.6], [-3.5, 2.05], [-3.05, 1.65], [-2.6, 2.0], [0.65, 2.1], [0.95, 1.7], [1.2, 2.15], [3.68, 2.2]].forEach(([z, y], i) => {
    framed(['eye', 'hoop', 'toys'][i % 3], -3.04, y, z, 0.24, 0.3, pick(['#f4efe3', '#ffd23f', '#7ec8ff', '#ff4f7b']));
  });
  // ceiling fans: one over the front end of the bar, toward the door, and one over the games corner
  ceilingFan(0.6, 2.55);
  ceilingFan(-1.5, -3.1);
}

export function buildInterior() {
  ledgeAndTv();
  purpleWall();
  bar();
  workCounter();
  decor();
}
