// Back of house: the outdoor AC on its rack, cleaning gear, the squat toilet, storeroom shelves and fridge.
import * as THREE from 'three';
import { ctx, mat, box, cyl, plane, pixelArt } from '../engine.js';
import { S } from '../state.js';
import { rand, pick, K } from '../util.js';
import { ART, PAL } from '../art.js';
import { steel, crate } from './props.js';
import { WH } from '../layout.js';

function acCorner() {
  const RACK_H = 1.5;                                              // the outdoor unit sits up on a steel rack
  const rackM = mat(0x4a4d52, { metalness: 0.6, roughness: 0.5 });
  [[-3.0, -8.9], [-3.0, -8.1], [-2.68, -8.9], [-2.68, -8.1]].forEach(([x, z]) => box(0.04, RACK_H, 0.04, rackM, x, RACK_H / 2, z));
  [-8.9, -8.1].forEach(z => box(0.36, 0.04, 0.04, rackM, -2.84, RACK_H, z));
  [-3.0, -2.68].forEach(x => box(0.04, 0.04, 0.84, rackM, x, RACK_H, -8.5));
  [0.3, 0.8].forEach(y => [-3.0, -2.68].forEach(x => box(0.03, 0.03, 0.84, rackM, x, y, -8.5)));   // cross rails
  box(0.38, 0.62, 0.85, mat(0xdadcd8, { roughness: 0.6 }), -2.85, RACK_H + 0.33, -8.5);
  const grille = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), mat(0x333333)); grille.position.set(-2.65, RACK_H + 0.35, -8.5); grille.rotation.y = Math.PI / 2; ctx.scene.add(grille);
  S.acFan = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.38, 0.06), mat(0x777777)); S.acFan.position.set(-2.64, RACK_H + 0.35, -8.5); ctx.scene.add(S.acFan);
  // crates stacked up beside it
  [0, 0.3, 0.6].forEach((y, i) => crate(-2.74, y, -7.75, ['green', 'orange', 'blue'][i]));
  [0, 0.3].forEach((y, i) => crate(-2.74, y, -7.28, ['blue', 'green'][i]));
  // cleaning things leaning on the corridor wall: mop and bucket, broom, a stick vacuum
  const lean = (x, z, tilt) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.z = tilt; ctx.scene.add(g); return g; };
  const mop = lean(-2.88, -6.85, 0.14);
  cyl(0.012, 0.012, 1.25, mat(0x2f6fb0), 0, 0.72, 0, mop, 6);
  for (let i = 0; i < 10; i++) { const st = cyl(0.008, 0.006, 0.2, mat(0xe8e4d8), 0, 0.1, 0, mop, 4); st.rotation.set(rand(-0.4, 0.4), 0, rand(-0.4, 0.4)); }
  cyl(0.15, 0.12, 0.26, mat(0xffd23f), -2.55, 0.13, -6.85, ctx.scene, 14);                                   // mop bucket
  const broom = lean(-2.9, -6.45, 0.12);
  cyl(0.012, 0.012, 1.15, mat(0xc0282d), 0, 0.72, 0, broom, 6);
  box(0.05, 0.14, 0.26, mat(0x3a3a3a), 0, 0.08, 0, broom);
  box(0.05, 0.05, 0.28, mat(0xc0282d), 0, 0.17, 0, broom);
  const vac = lean(-2.86, -6.1, 0.1);                                                                       // stick vacuum
  cyl(0.014, 0.014, 0.85, mat(0x9aa0a6, { metalness: 0.7 }), 0, 0.5, 0, vac, 6);
  box(0.08, 0.2, 0.09, mat(0x6b3fa0, { roughness: 0.4 }), 0, 0.98, 0, vac);
  cyl(0.03, 0.03, 0.12, mat(0x222222), 0.02, 1.12, 0, vac, 8);
  box(0.08, 0.04, 0.24, mat(0x222222), 0.02, 0.03, 0, vac);
  cyl(0.02, 0.02, 2.2, mat(0xeeeeee), -3.0, 1.6, -8.0, ctx.scene, 6);
}

function toilet() {
  const porcelain = mat(0xf7f7f5, { roughness: 0.15 });
  const pan = cyl(0.24, 0.22, 0.03, porcelain, 1.7, 0.015, -8.62, ctx.scene, 20); pan.scale.z = 1.7;             // squat pan set flush in the floor, running front to back
  const hole = cyl(0.17, 0.12, 0.01, mat(0x8fa3ad, { roughness: 0.1 }), 1.7, 0.032, -8.66, ctx.scene, 20); hole.scale.z = 1.6;
  box(0.2, 0.05, 0.18, porcelain, 1.7, 0.05, -9.08);                                                           // hood at the back end
  box(0.42, 0.32, 0.18, porcelain, 1.7, 1.75, -9.18); cyl(0.02, 0.02, 1.5, steel, 1.7, 0.95, -9.24, ctx.scene, 6);  // high tank + pipe on the back wall
  cyl(0.12, 0.1, 0.24, mat(0x3a7bd5), 2.55, 0.12, -8.45, ctx.scene, 14); cyl(0.05, 0.05, 0.05, mat(0xff7a12), 2.55, 0.27, -8.45, ctx.scene, 10);     // bucket + scoop
  box(0.42, 0.15, 0.32, porcelain, 0.1, 0.85, -9.1);
  box(0.36, 0.45, 0.03, mat(0xbfe6ff, { roughness: 0.05, metalness: 0.6 }), 0.1, 1.45, -9.26);
  // posters taped up in the toilet
  [[0.9, 1.7, -9.26, 0, 'eye', 0.36, 0.27, '#ff4f7b'], [2.55, 1.55, -9.26, 0, 'wave', 0.4, 0.3, '#f4efe3'], [1.4, 1.75, -8.06, Math.PI, 'toys', 0.38, 0.38, '#ffd23f'],
    [2.5, 1.6, -8.06, Math.PI, 'hoop', 0.3, 0.3, '#c0282d'], [-0.71, 1.7, -9.27, Math.PI / 2, 'hoop', 0.12, 0.12, '#7ec8ff']]
    .forEach(([x, y, z, ry, key, w, h, bg]) => plane(w, h, pixelArt(ART[key], PAL, bg), x, y, z, ry));
}

function storage() {
  // the far wall: a low steel shelf at the back, the fridge at the front, both facing the doorway; wall cabinets above them
  const s = new THREE.Group(); s.position.set(2.88, 0, -6.68); s.rotation.y = -Math.PI / 2; ctx.scene.add(s);
  [0.1, 0.55, 1.0, 1.35].forEach(y => box(1.2, 0.04, 0.4, steel, 0, y, 0, s));
  [-0.58, 0.58].forEach(xx => box(0.04, 1.37, 0.4, steel, xx, 0.685, 0, s));
  [[0.1, 0.3, 0xb8915e], [0.55, 0.3, 0xa47c4c], [1.0, 0.26, 0xd2b48c]].forEach(([y, h, c]) => {   // boxes lined up neatly, labels out
    for (let k = 0; k < 3; k++) {
      box(0.36, h, 0.32, mat(c), -0.4 + k * 0.4, y + 0.02 + h / 2, 0, s);
      box(0.14, 0.07, 0.005, mat(0xf4efe3), -0.4 + k * 0.4, y + 0.02 + h * 0.6, 0.162, s);   // label
    }
  });
  const fridge = new THREE.Group(); fridge.position.set(2.78, 0, -5.84); fridge.rotation.y = -Math.PI / 2; ctx.scene.add(fridge);
  box(0.56, 1.35, 0.56, mat(new THREE.Color(0xa9d4ea).convertSRGBToLinear(), { roughness: 0.35, metalness: 0.1 }), 0, 0.675, 0, fridge);   // pale blue
  box(0.54, 0.012, 0.01, mat(0x9aa0a6), 0, 0.98, 0.285, fridge);                                    // freezer seam
  [[0.23, 1.15, 0.26], [0.23, 0.6, 0.44]].forEach(([x, y, h]) => box(0.022, h, 0.03, mat(0x9aa0a6, { metalness: 0.8 }), x, y, 0.3, fridge));   // handles
  [[-0.12, 1.12, 0xffd23f], [0.04, 1.22, 0xff4f7b], [-0.05, 0.72, 0x7ec8ff]].forEach(([x, y, c]) => box(0.07, 0.07, 0.005, mat(c), x, y, 0.283, fridge));   // magnets
  // open wooden cubbies on the wall above them: a back board, top, bottom, ends and dividers, no doors
  const plyM = mat(0x9a6b42, { roughness: 0.75 }), plyEdge = mat(0x7a5232, { roughness: 0.8 });
  const C = { x: 2.93, y0: 1.75, y1: 2.35, z0: -7.27, z1: -5.63, d: 0.34 };
  const cz = (C.z0 + C.z1) / 2, len = C.z1 - C.z0, fx = C.x - C.d / 2;
  box(0.02, C.y1 - C.y0, len, plyEdge, C.x + C.d / 2 - 0.01, (C.y0 + C.y1) / 2, cz);                 // back board on the wall
  [C.y0, (C.y0 + C.y1) / 2, C.y1].forEach(y => box(C.d, 0.025, len, plyM, C.x, y, cz));             // bottom, middle shelf, top
  [0, 1, 2, 3].forEach(i => box(C.d, C.y1 - C.y0, 0.025, plyM, C.x, (C.y0 + C.y1) / 2, C.z0 + i * len / 3));   // ends and two dividers
  // what's in them: jars of beans, stacked paper cups, a few boxes, a coil of cable
  const lo = C.y0 + 0.013, hi = (C.y0 + C.y1) / 2 + 0.013;
  [-7.2, -7.08, -6.96].forEach(z => { cyl(0.05, 0.05, 0.16, mat(0xe8f4ff, { roughness: 0.05, transparent: true, opacity: 0.55 }), fx + 0.12, lo + 0.08, z, ctx.scene, 12); cyl(0.045, 0.045, 0.1, mat(0x3b2214), fx + 0.12, lo + 0.05, z, ctx.scene, 10); });
  [-6.62, -6.5].forEach(z => cyl(0.045, 0.035, 0.24, mat(0xf2f0ea, { roughness: 0.4 }), fx + 0.13, lo + 0.12, z, ctx.scene, 12));   // stacks of paper cups
  box(0.24, 0.18, 0.3, mat(0xb8915e), fx + 0.15, lo + 0.09, -6.05); box(0.2, 0.12, 0.22, mat(0xd2b48c), fx + 0.15, lo + 0.06, -5.78);
  box(0.22, 0.2, 0.36, mat(0xa47c4c), fx + 0.15, hi + 0.1, -7.0);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 16), mat(0x1d1d1d)); coil.position.set(fx + 0.15, hi + 0.02, -6.45); coil.rotation.x = Math.PI / 2; ctx.scene.add(coil);
  [[-5.95, 0xc0282d], [-5.82, 0xffd23f]].forEach(([z, c]) => box(0.18, 0.24, 0.08, mat(c), fx + 0.14, hi + 0.12, z));   // a couple of binders
  // the other back corner, against the toilet wall: crates and odds and ends, clear of the doorway
  crate(-0.25, 0, -7.1, 'blue'); crate(-0.25, 0.3, -7.1, 'green'); crate(-0.25, 0.6, -7.1, 'orange', 0.1);
  crate(0.4, 0, -7.1, 'orange'); crate(0.4, 0.3, -7.1, 'blue', -0.08);
  box(0.4, 0.28, 0.3, mat(0xb8915e), 0.42, 0.74, -7.12).rotation.y = 0.15;                          // a cardboard box on top
  for (let i = 0; i < 3; i++) cyl(0.11, 0.11, 0.34, mat(0xcfe8f5, { roughness: 0.1, transparent: true, opacity: 0.6 }), 0.98 + i * 0.24, 0.17, -7.15, ctx.scene, 14);   // water jugs
  const sack = cyl(0.16, 0.2, 0.42, mat(0x9b7b4f, { roughness: 1 }), 1.72, 0.21, -6.98, ctx.scene, 10); sack.scale.z = 0.7;        // a sack of beans slumped against them
  box(0.3, 0.18, 0.22, mat(0xf4efe3, { roughness: 0.9 }), 1.2, 0.43, -7.15);                         // a pack of paper towels on the jugs
  const stool = new THREE.Group(); stool.position.set(2.2, 0, -7.25); stool.rotation.x = -0.12; ctx.scene.add(stool);   // a folding stool leaned on the wall
  box(0.32, 0.03, 0.3, mat(0xc0282d), 0, 0.5, 0, stool);
  [-0.13, 0.13].forEach(x => box(0.025, 0.5, 0.025, steel, x, 0.25, 0.1, stool));
  arcadeStairs();
}

// behind the neighbours' glass door on the street: the stairs up to the flat above, a steep straight flight the width of
// the room rising from just inside that door back toward the arcade's storeroom wall. The door in that wall opens
// onto the space under the top of the flight, all the storeroom there is, a few boxes squeezed in
function arcadeStairs() {
  const X0 = 1.08, X1 = 3.02, Z0 = 5.8, Z1 = 7.92, N = 13, rise = WH / N, run = (Z1 - Z0) / N;
  const treadM = mat(0x8d8a84, { roughness: 0.85 }), riserM = mat(0x9c9993, { roughness: 0.9 }), noseM = mat(0x5e5c58, { roughness: 0.6 });
  for (let k = 0; k < N; k++) {
    const y = (k + 1) * rise, z = Z1 - (k + 0.5) * run;
    box(X1 - X0, 0.04, run + 0.02, treadM, (X0 + X1) / 2, y - 0.02, z);                            // the tread
    box(X1 - X0, rise, 0.03, riserM, (X0 + X1) / 2, y - rise / 2, Z1 - k * run - 0.015);           // the riser
    box(X1 - X0, 0.012, 0.025, noseM, (X0 + X1) / 2, y + 0.002, Z1 - k * run - 0.012);              // a darker nosing strip
  }
  // the slab under the flight, sloping down from the top to the floor at the street door
  const len = Math.hypot(Z1 - Z0, WH), ang = Math.atan2(WH, Z1 - Z0);
  const slab = box(X1 - X0, 0.08, len, mat(0x7a7772, { roughness: 0.95 }), (X0 + X1) / 2, WH / 2 - 0.06, (Z0 + Z1) / 2);
  slab.rotation.x = ang;
  // a handrail up the open side, 0.9 m over the line of the steps, from the second step to just under the floor above
  const railAt = t => [Z1 - t * (Z1 - Z0), t * WH + 0.9], [za, ya] = railAt(0.08), [zb, yb] = railAt((WH - 0.12 - 0.9) / WH);
  const rail = cyl(0.018, 0.018, Math.hypot(zb - za, yb - ya), mat(0x3a3a3c, { metalness: 0.5, roughness: 0.4 }), X0 + 0.06, (ya + yb) / 2, (za + zb) / 2, ctx.scene, 8);
  rail.rotation.x = ang - Math.PI / 2;
  [[za, ya], [zb, yb]].forEach(([z, y]) => box(0.05, 0.02, 0.02, mat(0x3a3a3c, { metalness: 0.5, roughness: 0.4 }), X0 + 0.03, y, z));   // its brackets on the wall
  // under the top of the stairs: what little storage there is, the boxes pushed back under the slope of the flight so
  // the floor just inside the door stays clear to reach in
  [[1.4, 0.2, 6.88, 0.5, 0.4], [1.92, 0.2, 6.92, 0.5, 0.4], [2.5, 0.17, 6.95, 0.6, 0.34], [1.65, 0.6, 6.76, 0.55, 0.4], [2.4, 0.5, 6.74, 0.45, 0.3]].forEach(([x, y, z, w, h]) =>
    box(w, h, 0.34, mat(pick([0xb8915e, 0x8d6e4a, 0xa47c50])), x, y, z));
  crate(2.75, 0, 7.3, 'blue');
  // and by the door, the big glass jar of plum wine steeping: round shouldered and ribbed, a red lid, the plums settled
  // in amber liquor
  const jar = new THREE.Group(); jar.position.set(1.32, 0, 6.42); jar.scale.x = 1 / K; ctx.scene.add(jar);
  const glass = new THREE.MeshStandardMaterial({ color: 0xd4e6e8, emissive: 0x3a4a4e, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, flatShading: true });   // (a faint glow of its own, or it vanishes in the dark under the stairs)
  const body = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.004], [0.1, 0.004], [0.115, 0.02], [0.12, 0.06], [0.12, 0.25], [0.112, 0.29], [0.09, 0.315], [0.072, 0.325], [0.072, 0.34]].map(([r, y]) => new THREE.Vector2(r, y)), 24), glass);
  body.renderOrder = 12; jar.add(body);   // (drawn after the walls that fade see-through, or they'd paint over it)
  const wine = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.008], [0.098, 0.008], [0.11, 0.022], [0.113, 0.06], [0.113, 0.22], [0, 0.22]].map(([r, y]) => new THREE.Vector2(r, y)), 24),
    new THREE.MeshStandardMaterial({ color: 0xa8560e, emissive: 0x5a2a06, roughness: 0.12, transparent: true, opacity: 0.85, depthWrite: false }));
  wine.renderOrder = 11; jar.add(wine);
  const plumM = mat(0xb5a648, { roughness: 0.55 });
  [[0.04, 0.035, 0.03], [-0.05, 0.034, 0.02], [0.0, 0.034, -0.06], [0.07, 0.036, -0.04], [-0.03, 0.035, 0.07], [-0.07, 0.034, -0.04],
    [0.02, 0.08, 0.0], [-0.03, 0.082, -0.02], [0.05, 0.085, 0.05], [-0.05, 0.088, 0.05], [0.01, 0.13, 0.04]].forEach(([x, y, z]) => {
    const plum = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), plumM); plum.position.set(x, y, z); plum.scale.y = 0.92; jar.add(plum);
  });
  const ribM = new THREE.MeshBasicMaterial({ color: 0xe8f2f2, transparent: true, opacity: 0.45, depthWrite: false });
  for (let i = 0; i < 16; i++) {   // the ribs down its sides, catching the light
    const a = (i / 16) * Math.PI * 2, rib = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.2, 0.004), ribM);
    rib.position.set(Math.sin(a) * 0.121, 0.155, Math.cos(a) * 0.121); rib.renderOrder = 13; jar.add(rib);
  }
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.04, 24), mat(0xd8281e, { roughness: 0.4 })); lid.position.y = 0.355; lid.castShadow = true; jar.add(lid);
  const rimL = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.004, 6, 24), mat(0xb81e16, { roughness: 0.4 })); rimL.rotation.x = Math.PI / 2; rimL.position.y = 0.337; jar.add(rimL);
}

export function buildBack() {
  acCorner();
  toilet();
  storage();
}
