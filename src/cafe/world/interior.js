// Inside the shop: manga ledge, TV cart, purple-wall seats, toy boxes, the bar and the work counter, and the decor.
import * as THREE from 'three';
import { ctx, mat, box, cyl, canvasTex, plane, DECAL } from '../engine.js';
import { S } from '../state.js';
import { rand, randi, pick, DOT, K } from '../util.js';
import { TVX, TVZ, TVY, LW, LSEATS } from '../layout.js';
import { buildMenuClipboard } from './menu.js';
import { drawBoard } from '../dartboard.js';
import { buildPegboard } from './pegboard.js';
import { woodM, steel, blackM, cinderSeat, crate, crateTable, stump, highStool, figurine, framed, trackRun, trackLine, ceilingFan, cinderBlock, stoolStack } from './props.js';

// the PS5 standing upright on the cart's shelf, its front to the room, in true size (39 cm tall, 10.4 wide, 26 deep): a
// glossy black core between two matte white panels that stand a little proud of it all round and sweep out at the
// front, the blue light strips up the front where they meet, on its round black stand. (Built lying down, then stood up.)
function ps5(x, y, z) {
  const base = new THREE.Group(); base.position.set(x, y, z); base.scale.x = 1 / K; ctx.scene.add(base);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.012, 24), mat(0x1a1a1c, { roughness: 0.5 })); stand.position.set(-0.02, 0.006, 0); stand.castShadow = true; base.add(stand);
  const g = new THREE.Group(); g.position.y = 0.012 + 0.195; g.rotation.x = -Math.PI / 2; base.add(g);
  const white = mat(0xf2f2ee, { roughness: 0.55 }), core = mat(0x101012, { roughness: 0.18, metalness: 0.2 }), dark = mat(0x050506, { roughness: 0.6 });
  // the white panels: flat plates whose front edges flare up (top) and down (bottom) like wings
  [[-0.034, -1], [0.034, 1]].forEach(([py, s]) => {
    box(0.24, 0.018, 0.39, white, -0.005, py, 0, g);
    const lip = box(0.03, 0.018, 0.37, white, 0.122, py + s * 0.006, 0, g); lip.rotation.z = s * 0.35;
  });
  box(0.21, 0.052, 0.34, core, -0.01, 0, 0, g);                                                              // the black core
  for (let i = 0; i < 5; i++) box(0.004, 0.003, 0.3, dark, 0.096, -0.012 + i * 0.006, 0, g);               // the vent slats up its front
  [-0.024, 0.024].forEach(ly => { const led = box(0.004, 0.003, 0.3, mat(0x2a7fff, { emissive: 0x2a7fff, emissiveIntensity: 1.6 }), 0.096, ly, 0, g); led.castShadow = false; });   // the light strips
  box(0.004, 0.008, 0.012, dark, 0.097, 0, -0.12, g); box(0.004, 0.008, 0.012, dark, 0.097, 0, -0.1, g);   // USB ports, low down
  box(0.004, 0.006, 0.02, mat(0x2a2a2c), 0.097, 0, 0.14, g);                                               // power button, up top
}

function ledgeAndTv() {
  // ledge under the neon: from where the wall starts beside the sliding door right across to the side wall,
  // manga along it, two high metal stools facing the wall
  const L0 = -1.46, L1 = 3.02;
  box(L1 - L0, 0.05, 0.34, woodM, (L0 + L1) / 2, 1.0, -5.3);
  [L0 + 0.25, (L0 + L1) / 2, L1 - 0.25].forEach(x => box(0.04, 0.2, 0.25, blackM, x, 0.88, -5.36));
  const nBooks = Math.floor((L1 - L0 - 0.1) / 0.058);
  for (let i = 0; i < nBooks; i++) box(0.045, rand(0.17, 0.2), 0.12, mat(pick([0xd8d0c0, 0xf2f2f2, 0xc94a3a, 0x3a5fa8, 0xe6c34a, 0x2a2a2a])), L0 + 0.06 + i * 0.058, 1.12, -5.42);
  [0.4, 1.6].forEach(x => highStool(x, -4.95));
  // the TV stands on a rolling TV cart near the purple wall, with a PS5 on the shelf underneath
  const cartM = mat(0x1b1b1d, { metalness: 0.6, roughness: 0.35 });
  box(0.5, 0.04, 0.9, cartM, TVX - 0.08, 0.08, TVZ);                                                        // base
  [[-0.25, -0.4], [-0.25, 0.4], [0.15, -0.4], [0.15, 0.4]].forEach(([dx, dz]) => { const w = cyl(0.035, 0.035, 0.03, blackM, TVX - 0.08 + dx, 0.035, TVZ + dz, ctx.scene, 10); w.rotation.z = Math.PI / 2; });   // casters
  [-0.22, 0.22].forEach(dz => box(0.05, 1.6, 0.05, cartM, TVX - 0.1, 0.88, TVZ + dz));                     // twin poles
  box(0.36, 0.03, 0.62, cartM, TVX - 0.04, 0.36, TVZ);                                                     // console shelf (low enough for the PS5 to stand up on it under the TV)
  ps5(TVX - 0.04, 0.375, TVZ);
  S.tvFrame = box(0.07, 0.98, 1.72, mat(0x0c0c0c, { roughness: 0.3 }), TVX + 0.03, TVY, TVZ);
  stoolStack(-2.62, TVZ + 1.2, 3);   // to the TV's left as you face it, clear of its edge: spare round metal stools, stacked
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
  const dartTex = canvasTex(256, 256, (g, w) => drawBoard(g, w / 2, w / 2, w / 2));   // a real board, so darts thrown at it score by what they hit
  dartTex.center.set(0.5, 0.5); dartTex.rotation = Math.PI;   // the cap's uv puts the drawing upside down and mirrored: turned round, 20 is at the top
  const board = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.045, 32), [mat(0x1a1a1a), new THREE.MeshStandardMaterial({ map: dartTex, roughness: 0.8 }), mat(0x1a1a1a)]);
  board.rotation.z = -Math.PI / 2; board.position.set(-2.995, 1.55, 3.06); board.castShadow = true; ctx.scene.add(board);   // round dartboard
  S.dartboard = board;                                                                                            // click it to play darts
  S.boardDarts = [];   // darts left stuck in it, put away while someone plays
  [[0.06, 0.03, 0xc0282d], [-0.09, -0.05, 0x1c4fd6], [0.02, -0.12, 0xffd23f]].forEach(([dy, dz, c]) => {
    const d = cyl(0.006, 0.004, 0.13, mat(0x9aa0a6, { metalness: 0.8 }), -2.91, 1.55 + dy, 3.06 + dz, ctx.scene, 6); d.rotation.z = Math.PI / 2 + 0.15;
    const f1 = box(0.04, 0.035, 0.005, mat(c), -2.84, 1.56 + dy, 3.06 + dz), f2 = box(0.04, 0.005, 0.035, mat(c), -2.84, 1.56 + dy, 3.06 + dz);
    f1.castShadow = f2.castShadow = false; S.boardDarts.push(d, f1, f2);
  });
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
    const s = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.07, 0.13), rand(0.06, 0.12)), new THREE.MeshBasicMaterial({ color: new THREE.Color(pick(posterCols)), toneMapped: true, ...DECAL }));
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
  // 工作台 along the right wall, as it is in the shop: a dark wood cabinet, a row of drawers over cupboard doors, and on
  // its wood top a crowd of bottles (MONIN syrups, liqueurs), the knock box on a towel, tea cups; pegboard of stuff above
  const grain = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#4a3324'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${pick(['20,12,6', '110,80,52', '60,40,26'])},${rand(0.15, 0.45)})`; g.fillRect(rand(0, w), 0, rand(0.5, 2.5), h); }
    for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(160,130,100,0.18)'; g.fillRect(rand(0, w), rand(0, h), rand(4, 14), 1); }   // the scuffs
  });
  const cabM = mat(0xffffff, { roughness: 0.75, map: grain }), seamM = mat(0x1a120c, { roughness: 0.9 });
  box(0.45, 0.92, 4.2, cabM, 2.85, 0.46, 0.1);
  box(0.5, 0.04, 4.2, cabM, 2.85, 0.94, 0.1);                         // the wood top, a little proud of the front
  // the fronts: bays of a drawer over a door, the seams between them dark
  const FX = 2.623, Z0 = -2.0, Z1 = 2.2, BAYS = 5, bw = (Z1 - Z0) / BAYS;
  for (let i = 0; i <= BAYS; i++) box(0.006, 0.86, 0.012, seamM, FX, 0.47, Z0 + i * bw);
  box(0.006, 0.012, Z1 - Z0, seamM, FX, 0.7, (Z0 + Z1) / 2);
  box(0.006, 0.012, Z1 - Z0, seamM, FX, 0.05, (Z0 + Z1) / 2);
  for (let i = 0; i < BAYS; i++) box(0.012, 0.01, 0.14, seamM, FX - 0.003, 0.83, Z0 + (i + 0.5) * bw);   // a finger pull under each top edge
  for (let i = 0; i < 6; i++) cyl(0.055, 0.04, 0.06, mat(0xf2f0ea, { roughness: 0.3 }), 2.78 + (i % 2) * 0.13, 0.99, 0.2 + Math.floor(i / 2) * 0.14, ctx.scene, 12);
  workBottles(2.92, 0.96, 1.66);
  macbook(2.75, 0.96, 0.95);   // the owner's laptop, along from the bottles   // (the back row's backs at the wall face, 3.01)
  buildPegboard();   // the crammed pegboard above (pegboard.js)
  // back end: two cinder seats against the wall with two stacked crates between them
  cinderSeat(2.75, -2.55); cinderSeat(2.75, -3.65);
  crate(2.72, 0, -3.1, 'green'); crate(2.72, 0.3, -3.1, 'orange');
  cornerNook();
}

// the corner past the end of the 工作台, as it is: a foam box bin with a board on it, a dark wooden stool, then the two
// cinder seats with their grey cushions in an L round two orange crates, a bulb lamp on top; on the teal wall above, a
// red LED clock, a deer poster, a shadow box of a camera and film, a street photo, an anime poster, and a patch where the
// plaster has come away
function cornerNook() {
  cinderSeat(2.75, 2.95); cinderSeat(2.05, 3.7);
  crate(2.75, 0, 3.66, 'orange'); crate(2.75, 0.3, 3.66, 'orange', 0.06);
  // the bin: a dull green-grey box, a white board over it with its orange lettering, a bag poking out
  box(0.3, 0.52, 0.24, mat(0x7d9088, { roughness: 0.9 }), 2.88, 0.26, 2.33);
  const lidTex = canvasTex(96, 96, (g, w, h) => {
    g.fillStyle = '#e8e4da'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8c0b0'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.save(); g.translate(w / 2, h / 2); g.rotate(-1.2); g.fillStyle = '#e8781e'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.fillText('PUMP IT UP!', 0, 5); g.restore();
  });
  box(0.34, 0.02, 0.27, mat(0xffffff, { map: lidTex, roughness: 0.8 }), 2.88, 0.53, 2.33);
  box(0.04, 0.12, 0.2, mat(0xe8ecee, { roughness: 0.4, transparent: true, opacity: 0.7 }), 2.72, 0.48, 2.33);
  // the stool: a round dark seat, four splayed legs, crossed rungs
  const st = new THREE.Group(); st.position.set(2.82, 0, 2.6); st.scale.x = 1 / K; ctx.scene.add(st);
  const dk = mat(0x241a14, { roughness: 0.45 });
  cyl(0.12, 0.12, 0.035, dk, 0, 0.64, 0, st, 18);
  // four straight legs under the seat, like the steel stools', braced by two bars crossing corner to corner
  const L = 0.08;
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => cyl(0.016, 0.016, 0.64, dk, a * L, 0.32, b * L, st, 8));
  [Math.PI / 4, -Math.PI / 4].forEach((r, i) => { const x = box(2 * L * Math.SQRT2, 0.02, 0.02, dk, 0, 0.27 + i * 0.021, 0, st); x.rotation.y = r; });
  // the little black desk fan on the floor by it
  const fan = new THREE.Group(); fan.position.set(2.55, 0, 2.5); fan.scale.x = 1 / K; fan.rotation.y = -0.9; ctx.scene.add(fan);
  const fanM = mat(0x161616, { roughness: 0.5 });
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 20), fanM); cage.position.y = 0.13; fan.add(cage);
  const hub = cyl(0.03, 0.03, 0.04, fanM, 0, 0.13, 0, fan, 10); hub.rotation.x = Math.PI / 2;
  for (let i = 0; i < 6; i++) { const sp = box(0.004, 0.2, 0.004, fanM, 0, 0.13, 0.01, fan); sp.rotation.z = i * Math.PI / 6; }
  box(0.05, 0.03, 0.12, fanM, 0, 0.015, 0, fan); box(0.02, 0.03, 0.02, fanM, 0, 0.04, 0, fan);
  // the lamp on the crates, back in the corner (clear of where a cup goes): a black plate, a thin stem, a globe bulb
  const lx = 2.93, lz = 3.8, ly = 0.6;
  box(0.13, 0.012, 0.13, fanM, lx, ly + 0.006, lz);
  cyl(0.005, 0.005, 0.42, fanM, lx, ly + 0.22, lz, ctx.scene, 6);
  cyl(0.014, 0.014, 0.03, fanM, lx, ly + 0.445, lz, ctx.scene, 8);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), mat(0xffd9a0, { emissive: 0xff9a3a, emissiveIntensity: 0.9, transparent: true, opacity: 0.75, roughness: 0.1 }));
  bulb.position.set(lx, ly + 0.5, lz); bulb.scale.x = 1 / K; ctx.scene.add(bulb);
  const fil = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.003, 4, 10), mat(0xffb040, { emissive: 0xff8a20, emissiveIntensity: 3 }));
  fil.position.copy(bulb.position); fil.rotation.y = Math.PI / 2; ctx.scene.add(fil);

  // the wall: everything just off it, facing the room
  const WX = 3.0, onWall = (w, h, tex, y, z, basic) => plane(w, h, tex, WX - 0.015, y, z, -Math.PI / 2, basic);
  const frame = (w, h, y, z, tex, col = 0x141414) => { box(0.025, h + 0.04, w + 0.04, mat(col, { roughness: 0.5 }), WX, y, z); onWall(w, h, tex, y, z); };
  // the plaster patch, worn away to the grey render under it
  onWall(0.62, 0.16, canvasTex(124, 32, g => {
    g.fillStyle = '#9a968c'; g.beginPath(); g.moveTo(4, 8); [[40, 2], [90, 6], [120, 3], [118, 26], [80, 30], [30, 27], [2, 22]].forEach(([x, y]) => g.lineTo(x, y)); g.closePath(); g.fill();
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${pick(['70,66,60', '190,184,170', '120,100,80'])},0.5)`; g.fillRect(rand(6, 116), rand(5, 26), 2, 2); }
  }), 1.02, 3.3);
  // the deer
  frame(0.36, 0.5, 1.62, 2.55, canvasTex(72, 100, g => {
    g.fillStyle = '#2a2418'; g.fillRect(0, 0, 72, 100); g.fillStyle = '#6a5a38'; g.fillRect(0, 70, 72, 30);
    g.fillStyle = '#b07a48'; g.beginPath(); g.ellipse(38, 70, 16, 24, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(34, 36, 9, 13, -0.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a6a48'; g.lineWidth = 2; g.beginPath(); g.moveTo(30, 24); g.lineTo(24, 10); g.lineTo(20, 14); g.moveTo(38, 24); g.lineTo(44, 10); g.lineTo(48, 14); g.stroke();
    g.fillStyle = '#1a1410'; g.fillRect(30, 34, 2, 2); g.fillRect(37, 34, 2, 2);
    g.fillStyle = '#e8e0c8'; g.font = '6px sans-serif'; g.fillText('SIKA DEER', 22, 60);
  }));
  // the shadow box: a camera and rolls of film on white
  frame(0.28, 0.32, 1.82, 3.0, canvasTex(56, 64, g => {
    g.fillStyle = '#ecebe6'; g.fillRect(0, 0, 56, 64);
    g.fillStyle = '#3a3a3c'; g.fillRect(14, 10, 28, 18); g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(28, 19, 6, 0, Math.PI * 2); g.fill();
    [[6, 12], [44, 12], [6, 36], [44, 36]].forEach(([x, y], i) => { g.fillStyle = i % 2 ? '#3a8a4a' : '#e8c21a'; g.fillRect(x, y, 6, 12); });
    g.fillStyle = '#4a4a4c'; g.fillRect(16, 32, 24, 10); g.fillStyle = '#2a2a2c'; g.fillRect(16, 48, 24, 10);
  }), 0x1a1a1a);
  // the street photo: a crossing, a double-decker
  frame(0.3, 0.4, 1.18, 2.85, canvasTex(60, 80, g => {
    g.fillStyle = '#5a5a54'; g.fillRect(0, 0, 60, 80); g.fillStyle = '#8a8e88'; g.fillRect(0, 0, 60, 30);
    g.fillStyle = '#3a3a36'; g.fillRect(4, 4, 12, 40); g.fillRect(44, 0, 14, 44);
    g.fillStyle = '#a83a2a'; g.fillRect(18, 26, 26, 18); g.fillStyle = '#e8e0c0'; g.fillRect(20, 30, 22, 3); g.fillRect(20, 37, 22, 3);
    g.fillStyle = '#d8d4c8'; for (let i = 0; i < 6; i++) g.fillRect(4 + i * 9, 58, 5, 16);
    g.fillStyle = '#2a2a28'; for (let i = 0; i < 14; i++) g.fillRect(rand(2, 56), rand(46, 70), 2, 6);
  }));
  // the anime poster: a title band, a figure against stars
  frame(0.2, 0.3, 1.32, 3.32, canvasTex(40, 60, g => {
    g.fillStyle = '#141826'; g.fillRect(0, 0, 40, 60); g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 40, 7);
    g.fillStyle = '#c8d8f0'; for (let i = 0; i < 30; i++) g.fillRect(rand(0, 40), rand(8, 60), 1, 1);
    g.fillStyle = '#d8a040'; g.beginPath(); g.moveTo(20, 14); g.lineTo(30, 52); g.lineTo(10, 52); g.closePath(); g.fill();
    g.fillStyle = '#c83a3a'; g.fillRect(4, 52, 32, 6);
  }));
  // the LED clock: red digits on black, showing the café's own time (redrawn as the minutes go by)
  box(0.03, 0.17, 0.5, mat(0x0c0c0c, { roughness: 0.4 }), WX, 2.08, 3.25);
  const clockTex = canvasTex(200, 64, () => {});
  let shown = -1;
  const draw = () => {
    const m = Math.floor(S.minutes ?? 0);
    if (m === shown) return; shown = m;
    const c = clockTex.image, g = c.getContext('2d');
    g.fillStyle = '#100404'; g.fillRect(0, 0, c.width, c.height);
    g.shadowColor = '#ff2a1a'; g.shadowBlur = 8; g.fillStyle = '#ff3a26'; g.textAlign = 'center';
    g.font = 'bold 40px monospace'; g.fillText(`${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, c.width / 2, 40);
    g.shadowBlur = 0; g.font = '11px monospace'; g.fillText('2026  11  5', c.width / 2, 58);
    clockTex.needsUpdate = true;
  };
  onWall(0.46, 0.15, clockTex, 2.08, 3.25, true);
  S.ledClock = draw; draw();
}

// the owner's laptop on the 工作台: a thin silver laptop, open, its screen turned to the room (to him, behind the bar),
// the keyboard dark in its well, a faint glow on the screen. In true size (unsqueezed): 30 x 21 cm, 1.1 cm thin
function macbook(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = -Math.PI / 2 + 0.12; ctx.scene.add(g);
  g.scale.z = 1 / K;   // (turned side-on, its depth is what lies along the squeezed x)
  const alu = mat(0xc9cbcf, { roughness: 0.32, metalness: 0.7 }), dark = mat(0x1b1c1f, { roughness: 0.6 });
  box(0.30, 0.008, 0.21, alu, 0, 0.004, 0, g);                                   // the base
  box(0.27, 0.001, 0.10, dark, 0, 0.0085, -0.025, g);                          // the keys
  box(0.11, 0.001, 0.065, mat(0xb9bbbf, { roughness: 0.25, metalness: 0.6 }), 0, 0.0085, 0.065, g);   // the trackpad
  const lid = new THREE.Group(); lid.position.set(0, 0.008, -0.105); lid.rotation.x = -0.32; g.add(lid);   // hinged at the back, opened a little past upright
  box(0.30, 0.2, 0.005, alu, 0, 0.1, -0.003, lid);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.275, 0.175), mat(0x203040, { emissive: 0x3a5a7a, emissiveIntensity: 0.6, roughness: 0.2 }));
  screen.position.set(0, 0.1, 0.0013); lid.add(screen);
  box(0.29, 0.188, 0.001, dark, 0, 0.1, 0.0002, lid);                           // the black bezel round it
}

// the bottles crowded on the 工作台 against the wall, in true size (a group unsqueezed): a row of MONIN syrup bottles in
// front, caramel, hazelnut, cucumber green, vanilla, their white labels and red-capped necks; behind them the liqueurs
// (a stout dark Baileys, a red-label one, a tall clear one); a red box of 枇杷膏, a pepper mill, a squeeze bottle; then
// along from them the steel knock box with its black bar, on a brown towel
function workBottles(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.x = 1 / K; ctx.scene.add(g);
  const glass = mat(0xe8f0f0, { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
  const label = mat(0xf4f1ea, { roughness: 0.8 }), cap = mat(0xb8b8bc, { roughness: 0.3, metalness: 0.7 }), red = mat(0xc4281e, { roughness: 0.5 });
  const put = (mesh, px, py, pz) => { mesh.position.set(px, py, pz); mesh.castShadow = true; g.add(mesh); return mesh; };
  const C = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
  // a syrup bottle: tall and slim, shoulders, a long neck, liquid most of the way up
  const syrup = (px, pz, liquid) => {
    put(new THREE.Mesh(C(0.032, 0.032, 0.2), mat(liquid, { roughness: 0.2, transparent: true, opacity: 0.85 })), px, 0.1, pz);
    put(new THREE.Mesh(C(0.034, 0.034, 0.22), glass), px, 0.11, pz).renderOrder = 12;
    put(new THREE.Mesh(C(0.0345, 0.0345, 0.09), label), px, 0.1, pz);
    put(new THREE.Mesh(C(0.014, 0.034, 0.05), glass), px, 0.245, pz).renderOrder = 12;
    put(new THREE.Mesh(C(0.013, 0.013, 0.06), glass), px, 0.3, pz).renderOrder = 12;
    put(new THREE.Mesh(C(0.016, 0.016, 0.03), red), px, 0.34, pz);
    put(new THREE.Mesh(C(0.017, 0.017, 0.008), cap), px, 0.358, pz);
  };
  [[0xb8621c, -0.2], [0xd29a4a, -0.12], [0x7fc84a, -0.04], [0xe8d8a8, 0.04], [0xc8902e, 0.12]].forEach(([c, dz], i) => syrup(-0.056 + (i % 2) * 0.008, dz, c));
  // behind: the liqueurs
  put(new THREE.Mesh(C(0.04, 0.04, 0.2), mat(0x1e1410, { roughness: 0.3 })), 0.022, 0.1, -0.06);           // Baileys
  put(new THREE.Mesh(C(0.0405, 0.0405, 0.07), mat(0x2a2a2a, { roughness: 0.5 })), 0.022, 0.1, -0.06);
  put(new THREE.Mesh(C(0.016, 0.03, 0.08), mat(0x1e1410, { roughness: 0.3 })), 0.022, 0.24, -0.06);
  put(new THREE.Mesh(C(0.036, 0.036, 0.26), glass), 0.026, 0.13, -0.17).renderOrder = 12;                    // tall clear one
  put(new THREE.Mesh(C(0.037, 0.037, 0.08), mat(0xc8b070, { roughness: 0.6 })), 0.026, 0.12, -0.17);
  put(new THREE.Mesh(C(0.012, 0.012, 0.09), glass), 0.026, 0.3, -0.17).renderOrder = 12;
  put(new THREE.Mesh(C(0.014, 0.014, 0.025), red), 0.026, 0.35, -0.17);
  put(new THREE.Mesh(C(0.038, 0.038, 0.22), mat(0xe8e4dc, { roughness: 0.2, transparent: true, opacity: 0.6 })), 0.023, 0.11, 0.05).renderOrder = 12;   // the red-label one
  put(new THREE.Mesh(C(0.039, 0.039, 0.07), red), 0.023, 0.13, 0.05);
  put(new THREE.Mesh(C(0.013, 0.013, 0.1), mat(0xe8e4dc, { roughness: 0.2 })), 0.023, 0.27, 0.05);
  // the red box, a pepper mill, a squeeze bottle
  put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.09), red), -0.06, 0.06, -0.3);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.061, 0.03, 0.06), mat(0xf2d24a, { roughness: 0.6 })), -0.06, 0.08, -0.3);
  put(new THREE.Mesh(C(0.018, 0.02, 0.11), mat(0x2a2a2a, { roughness: 0.4 })), -0.02, 0.055, -0.38);
  put(new THREE.Mesh(C(0.025, 0.025, 0.12), mat(0xf2f2ee, { roughness: 0.4 })), 0.02, 0.06, -0.36);
  put(new THREE.Mesh(C(0.006, 0.014, 0.03), mat(0xf2f2ee, { roughness: 0.4 })), 0.02, 0.135, -0.36);
  // the knock box on its towel
  put(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.26), mat(0x5a3a28, { roughness: 1 })), -0.02, 0.006, 0.32);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.15), steel), -0.02, 0.077, 0.32);
  const bar = put(new THREE.Mesh(C(0.01, 0.01, 0.15, 8), blackM), -0.02, 0.15, 0.32); bar.rotation.x = Math.PI / 2;
  put(new THREE.Mesh(C(0.03, 0.03, 0.07), steel), 0.0, 0.047, 0.47);   // a steel cup by it
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
  // the neon, lit, and as it looks switched off (the 4th switch outside, by the linked chairs): bare glass tubes
  const neonDraw = lit => (g, w, h) => {
    if (lit) { g.shadowColor = '#ff3a2a'; g.shadowBlur = 22; }
    g.strokeStyle = lit ? '#ffb59a' : '#6e5650'; g.lineWidth = 9;
    g.beginPath(); g.arc(w / 2, h / 2, 104, 0, Math.PI * 2); g.stroke();
    g.fillStyle = lit ? '#ffd0b8' : '#6e5650'; g.textAlign = 'center'; g.font = `70px ${DOT}`;
    g.fillText('窺視', w / 2, h / 2 - 12); g.fillText('珈琲', w / 2, h / 2 + 66);
  };
  const neonTex = canvasTex(256, 256, neonDraw(true)), neonOff = canvasTex(256, 256, neonDraw(false));
  S.fontTex.push(neonTex, neonOff);
  S.neon = { sign: plane(0.95, 0.95, neonTex, 1.0, 1.95, -5.38, 0, true), on: neonTex, off: neonOff, lit: true };
  [-0.3, 1.25, 2.4].forEach(x => figurine(x, 1.215, -5.42, 1.1));   // a few figurines standing on top of the manga, none in front of it
  // indoor AC above the sliding door
  box(1.3, 0.3, 0.24, mat(0xf2f2f0, { roughness: 0.4 }), -2.24, 2.64, -5.3);   // over the sliding door, clear of its top
  box(1.2, 0.02, 0.02, mat(0x9aa0a6), -2.24, 2.52, -5.17);                                                  // vent slot
  // conduit + track lights
  const conduitM = mat(0x2a2a2a, { roughness: 0.5 });
  const c1 = cyl(0.02, 0.02, 8.4, conduitM, -3.0, 2.62, -0.3, ctx.scene, 6); c1.rotation.x = Math.PI / 2;
  // the track lights, as they hang in the shop: three long runs down the room on wires (one over the bar, one each side
  // of it), joined across at both ends; the bar's spots turned onto the bar top, the side runs' onto the walls' pictures
  // and the seats
  const BX = 0.475, BY = 1.06, TY = 2.6, XL = -1.55, XM = BX, XR = 2.05, ZB = -2.85, ZF = 2.3;   // (ending short of the fans at both ends)
  trackLine(XM, ZB, XM, ZF, TY, [[0.3, [BX - 0.25, BY, -1.5]], [0.45, [BX + 0.25, BY, -0.4]], [0.62, [BX - 0.2, BY, 0.9]], [0.78, [BX + 0.2, BY, 2.1]]]);
  trackLine(XL, ZB, XL, ZF, TY, [[0.12, [-3.02, 1.6, -3.4]], [0.36, [-3.02, 1.9, -1.4]], [0.55, [-3.02, 1.9, 0.0]], [0.78, [-3.02, 1.9, 1.9]]]);
  trackLine(XR, ZB, XR, ZF, TY, [[0.2, [3.0, 1.2, -2.9]], [0.45, [3.0, 1.6, -0.6]], [0.68, [3.0, 1.6, 1.2]], [0.88, [3.0, 1.5, 3.0]]]);
  trackLine(XL, ZB, XR, ZB, TY, [[0.3, [-0.8, 1.6, -5.4]], [0.7, [1.0, 1.9, -5.4]]]);
  trackLine(XL, ZF, XR, ZF, TY, []);
  framed('hoop', -3.02, 1.9, -1.4, 0.55, 0.75, '#c0282d');
  framed('toys', -3.02, 2.0, -0.4, 0.5, 0.7, '#ffd23f', 0x7a1c1c);
  framed('eye', -3.02, 1.75, 0.25, 0.3, 0.25, '#ff4f7b', 0x7a1c1c);
  framed('wave', -3.02, 1.9, 1.9, 0.95, 0.72, '#f4efe3', 0x1a1410);   // kept clear of the dartboard
  // a cluster of small black frames, like the gallery seen from the sliding door
  [[-4.15, 1.95], [-3.7, 1.6], [-3.25, 2.05], [-2.8, 1.65], [-2.35, 2.0], [0.65, 2.1], [0.95, 1.7], [1.2, 2.15], [3.68, 2.2]].forEach(([z, y], i) => {
    framed(['eye', 'hoop', 'toys'][i % 3], -3.02, y, z, 0.24, 0.3, pick(['#f4efe3', '#ffd23f', '#7ec8ff', '#ff4f7b']));
  });
  // ceiling fans: one over the front end of the bar, toward the door, and one over the games corner
  ceilingFan(-0.54, 3.4);   // (near the front door, in line with the back one)
  ceilingFan(-0.54, -3.1);
}

// under the peep window, inside, after the photo: an old wooden stool with a cloth over it, a cup with a bug-eyed toy on
// top and manga and figurines on its rungs; a heap of toys on the floor; and a tall stack of blocks with a cloth on it, a
// yellow drinks cooler and toys on top and little pixel-block toys on its front. All kept against the wall, clear of the
// walkway in front of them
function windowNook() {
  const Z = 3.72, F = -1;   // F: the room side (the wall is behind, at +z)
  const printTex = (bg, dots) => canvasTex(64, 64, g => { g.fillStyle = bg; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 40; i++) { g.fillStyle = pick(dots); g.fillRect(rand(0, 60), rand(0, 60), rand(3, 7), rand(3, 7)); } });
  // the stool: four splayed legs, two rungs of shelves, a printed cloth hanging over the seat
  const stool = new THREE.Group(); stool.position.set(0.95, 0, Z); ctx.scene.add(stool);
  const dark = mat(0x4a2f1f, { roughness: 0.7 });
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => { const l = box(0.04, 0.62, 0.04, dark, sx * 0.17, 0.31, sz * 0.15, stool); l.rotation.set(-sz * 0.06, 0, sx * 0.06); }));
  box(0.4, 0.04, 0.34, dark, 0, 0.63, 0, stool);
  [0.12, 0.36].forEach(y => box(0.34, 0.02, 0.28, dark, 0, y, 0, stool));                                 // the shelves between the legs
  const cloth = new THREE.MeshStandardMaterial({ map: printTex('#cfe0ea', ['#2f5fb3', '#c0282d', '#ffd23f', '#f4efe3']), roughness: 0.9 });
  box(0.44, 0.01, 0.38, cloth, 0, 0.655, 0, stool);
  [-1, 1].forEach(sx => box(0.01, 0.12, 0.38, cloth, sx * 0.22, 0.6, 0, stool));                          // hanging down the sides
  for (let i = 0; i < 6; i++) box(0.05, 0.16, 0.12, mat(pick([0xd8d0c0, 0xc94a3a, 0x3a5fa8, 0xe6c34a, 0xf2f2f2])), -0.13 + i * 0.052, 0.21, 0.02, stool);   // manga
  for (let i = 0; i < 5; i++) box(0.05, 0.14, 0.12, mat(pick([0xd8d0c0, 0xc94a3a, 0x3a5fa8, 0xe6c34a, 0xf2f2f2])), -0.1 + i * 0.052, 0.44, 0.02, stool);
  cyl(0.045, 0.035, 0.14, mat(0xe8e0f0, { roughness: 0.4 }), 0, 0.73, 0, stool, 12);                    // the tall cup on top
  cyl(0.05, 0.05, 0.05, mat(0x9a6a30), 0, 0.82, 0, stool, 10);                                          // the bug-eyed toy in it
  [-1, 1].forEach(sx => cyl(0.012, 0.012, 0.04, mat(0x9a6a30), sx * 0.02, 0.86, 0, stool, 6));
  [-1, 1].forEach(sx => cyl(0.014, 0.014, 0.012, mat(0xffffff), sx * 0.02, 0.885, 0.004, stool, 8));
  [[-0.12, 0.6], [0, 0.85], [0.12, 0.7]].forEach(([x, s]) => figurine(0.95 + x, 0.02, Z + F * 0.06, s));       // on the bottom, in front of the manga
  // the heap of toys on the floor next to it: figures, robots, a few boxed toy cars, leaning on the wall
  for (let i = 0; i < 14; i++) figurine(0.3 + rand(0, 0.4), 0, Z + rand(-0.12, 0.08), rand(0.8, 1.6));
  [[0.3, 0.35, 0x2f5fb3], [0.45, 0.42, 0xc0282d], [0.6, 0.3, 0xffd23f]].forEach(([x, h, c]) => box(0.12, h, 0.05, mat(c, { roughness: 0.5 }), x, h / 2, 3.88));
  // the block stack: four courses of cinder blocks, a dark flowered cloth on top, the cooler and toys on that
  for (let k = 0; k < 4; k++) [-1, 0, 1].forEach(s => cinderBlock(0.4, 0.2, 0.19, -0.5 + s * 0.4 + (k % 2) * 0.04, 0.1 + k * 0.2, Z, ctx.scene));   // three blocks wide
  const flowers = new THREE.MeshStandardMaterial({ map: printTex('#3a2a3a', ['#7a3a4a', '#4a6a3a', '#c08a3a', '#2a4a6a']), roughness: 0.9 });
  box(1.32, 0.012, 0.3, flowers, -0.48, 0.806, Z);
  box(1.32, 0.14, 0.01, flowers, -0.48, 0.74, Z + F * 0.15);                                           // hanging down the front
  const cooler = new THREE.Group(); cooler.position.set(-0.2, 0.812, Z); ctx.scene.add(cooler);
  cyl(0.15, 0.15, 0.3, mat(0xf2c81a, { roughness: 0.5 }), 0, 0.15, 0, cooler, 20);                      // yellow body
  cyl(0.155, 0.155, 0.05, mat(0xc0282d, { roughness: 0.5 }), 0, 0.325, 0, cooler, 20);                  // red lid
  cyl(0.152, 0.152, 0.012, mat(0xc0282d, { roughness: 0.5 }), 0, 0.02, 0, cooler, 20);                  // red base ring
  [-1, 1].forEach(sx => box(0.02, 0.05, 0.14, mat(0xf4f2ec), sx * 0.16, 0.26, 0, cooler));              // handles
  box(0.04, 0.04, 0.05, mat(0xf4f2ec), 0, 0.06, 0.16, cooler);                                           // the spigot
  [[-0.95, 0.81, 1.3], [-0.8, 0.81, 1.0], [-0.62, 0.81, 1.1], [-0.22, 1.16, 1.2], [-0.14, 1.16, 0.9]].forEach(([x, y, s]) => figurine(x, y, Z + F * 0.04, s));
  // little pixel-block toys stuck on the front of the lower blocks: a figure in overalls and a spotted mushroom
  const pixel = rows => canvasTex(rows[0].length, rows.length, g => rows.forEach((r, y) => [...r].forEach((ch, x) => {
    const c = { r: '#d1342b', w: '#f4f2ec', b: '#2f5fb3', s: '#e8b48a', k: '#222', y: '#ffd23f' }[ch]; if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  })), true);
  const guy = pixel(['..bbbb..', '.bbbbbb.', '..ssss..', '..skks..', '..ssss..', '.rbbbbr.', 'rrbyybrr', '..bbbb..', '..b..b..', '.kk..kk.']);
  const shroom = pixel(['..rrrr..', '.rwrrwr.', 'rwwrrwwr', 'rrrrrrrr', '.wwwwww.', '..wkkw..', '..wwww..', '..wwww..']);
  [[-0.75, guy, 0.16, 0.2], [-0.45, shroom, 0.16, 0.16]].forEach(([x, t, w, h]) => {
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.5, roughness: 0.6 });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); pl.position.set(x, 0.22, Z + F * 0.105); pl.rotation.y = Math.PI; ctx.scene.add(pl);   // facing into the room
  });
}

export function buildInterior() {
  ledgeAndTv();
  windowNook();
  purpleWall();
  bar();
  workCounter();
  decor();
}
