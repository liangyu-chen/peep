// Back of house: the outdoor AC on its rack, cleaning gear, the squat toilet, storeroom shelves and fridge.
import * as THREE from 'three';
import { ctx, mat, box, cyl, plane, pixelArt } from '../engine.js';
import { S } from '../state.js';
import { rand, pick } from '../util.js';
import { ART, PAL } from '../art.js';
import { steel, crate } from './props.js';

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
  cyl(0.12, 0.1, 0.24, mat(0x3a7bd5), 2.55, 0.12, -8.35, ctx.scene, 14); cyl(0.05, 0.05, 0.05, mat(0xff7a12), 2.55, 0.27, -8.35, ctx.scene, 10);     // bucket + scoop
  box(0.42, 0.15, 0.32, porcelain, 0.1, 0.85, -9.1);
  box(0.36, 0.45, 0.03, mat(0xbfe6ff, { roughness: 0.05, metalness: 0.6 }), 0.1, 1.45, -9.26);
  // posters taped up in the toilet
  [[0.9, 1.7, -9.26, 0, 'eye', 0.36, 0.27, '#ff4f7b'], [2.55, 1.55, -9.26, 0, 'wave', 0.4, 0.3, '#f4efe3'], [1.4, 1.75, -7.44, Math.PI, 'toys', 0.38, 0.38, '#ffd23f'],
    [2.5, 1.6, -7.44, Math.PI, 'hoop', 0.3, 0.3, '#c0282d'], [-0.71, 1.7, -9.27, Math.PI / 2, 'hoop', 0.12, 0.12, '#7ec8ff']]
    .forEach(([x, y, z, ry, key, w, h, bg]) => plane(w, h, pixelArt(ART[key], PAL, bg), x, y, z, ry));
}

function storage() {
  // the far wall: a low steel shelf, as tall as the fridge, side by side with it, both facing the doorway
  const s = new THREE.Group(); s.position.set(2.88, 0, -6.12); s.rotation.y = -Math.PI / 2; ctx.scene.add(s);
  [0.1, 0.55, 1.0, 1.35].forEach(y => box(1.2, 0.04, 0.4, steel, 0, y, 0, s));
  [-0.58, 0.58].forEach(xx => box(0.04, 1.37, 0.4, steel, xx, 0.685, 0, s));
  [[0.1, 0.3, 0xb8915e], [0.55, 0.3, 0xa47c4c], [1.0, 0.26, 0xd2b48c]].forEach(([y, h, c]) => {   // boxes lined up neatly, labels out
    for (let k = 0; k < 3; k++) {
      box(0.36, h, 0.32, mat(c), -0.4 + k * 0.4, y + 0.02 + h / 2, 0, s);
      box(0.14, 0.07, 0.005, mat(0xf4efe3), -0.4 + k * 0.4, y + 0.02 + h * 0.6, 0.162, s);   // label
    }
  });
  const fridge = new THREE.Group(); fridge.position.set(2.78, 0, -7.0); fridge.rotation.y = -Math.PI / 2; ctx.scene.add(fridge);
  box(0.56, 1.35, 0.56, mat(new THREE.Color(0xa9d4ea).convertSRGBToLinear(), { roughness: 0.35, metalness: 0.1 }), 0, 0.675, 0, fridge);   // pale blue
  box(0.54, 0.012, 0.01, mat(0x9aa0a6), 0, 0.98, 0.285, fridge);                                    // freezer seam
  [[0.23, 1.15, 0.26], [0.23, 0.6, 0.44]].forEach(([x, y, h]) => box(0.022, h, 0.03, mat(0x9aa0a6, { metalness: 0.8 }), x, y, 0.3, fridge));   // handles
  [[-0.12, 1.12, 0xffd23f], [0.04, 1.22, 0xff4f7b], [-0.05, 0.72, 0x7ec8ff]].forEach(([x, y, c]) => box(0.07, 0.07, 0.005, mat(c), x, y, 0.283, fridge));   // magnets
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
  // boxes piled in the arcade storeroom
  for (let i = 0; i < 5; i++) box(rand(0.35, 0.6), rand(0.3, 0.5), 0.4, mat(pick([0xb8915e, 0x8d6e4a])), 1.4 + rand(0, 1.4), 0.2 + (i > 2 ? 0.4 : 0), rand(5.7, 7.6));
}

export function buildBack() {
  acCorner();
  toilet();
  storage();
}
