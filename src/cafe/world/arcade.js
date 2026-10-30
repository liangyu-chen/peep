// The arcade (騎樓): linked plastic chairs down both sides, the block-and-crate strip, the Open stack,
// the skateboard, the scooter seats, the kerb camping chair and the street lightbox.
import * as THREE from 'three';
import { ctx, mat, box, cyl, canvasTex, plane, pixelArt } from '../engine.js';
import { S } from '../state.js';
import { pick, DOT } from '../util.js';
import { STRIP } from '../layout.js';
import { ART, PAL } from '../art.js';
import { blackM, cinderM, CRATE_ORANGE, GLOSS_ORANGE, cinderBlock, cinderSeat, blockStack, crate, linkedChairs, campChair } from './props.js';

const potM = () => mat(0xb5643c), leafM = () => mat(0x3f6b3a);
function pottedPlant(x, y, z) {
  cyl(0.07, 0.06, 0.1, potM(), x, y + 0.05, z, ctx.scene, 10);
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), leafM()); l.position.set(x, y + 0.16, z); ctx.scene.add(l);
}

// the middle strip, from the street inwards: cinder blocks, crates, cinder blocks, crates, blocks
function middleStrip() {
  const scene = ctx.scene;
  const stripStart = scene.children.length;
  STRIP.blocks.forEach(z => {
    const h = 0.215;                      // three single blocks lying crosswise, a touch taller than the crates
    for (let c = 0; c < 3; c++) cinderBlock(0.4, h, 0.2, -1.0, h * (c + 0.5), z);
    pottedPlant(-1.0, h * 3, z);
  });
  STRIP.crates.forEach((z, i) => { crate(-1.0, 0, z, i ? 'blue' : 'orange', 0, 1); crate(-1.0, 0.3, z, 'blue', 0, 1); });
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
  cinderSeat(-0.5, 7.75); cinderSeat(0.38, 7.75); blockStack(-0.06, 7.75);
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
  // the street lightbox
  box(4.0, 0.3, 0.12, mat(0x2a4f8a), -1.05, 2.62, 8.2);                                  // blue lintel over the opening
  const yellowSign = canvasTex(24, 72, (g) => { g.fillStyle = '#f2e27a'; g.fillRect(0, 0, 24, 72); g.fillStyle = '#c9b84a'; g.fillRect(0, 0, 24, 3); g.fillRect(0, 69, 24, 3); }, true);
  box(0.3, 0.85, 0.12, new THREE.MeshStandardMaterial({ map: yellowSign, emissive: 0x6a6020, roughness: 0.5 }), -1.8, 2.2, 8.45);
  [[-3.0, 1.8], [0.95, 1.6]].forEach(([x, y]) => box(0.18, 0.22, 0.08, mat(0xd9d9d0), x, y, 8.22));   // electricity meters
  campChair(-0.55, 8.55, 0, 0x2f4a3a);                                                    // one camping chair facing the street
  crate(-0.55, 0, 9.15, 'blue'); crate(-0.55, 0.3, 9.15, 'orange');                       // two stacked crates as its table
}

export function buildArcade() {
  linkedChairs(-2.72, 6.0, Math.PI / 2, [GLOSS_ORANGE, GLOSS_ORANGE, GLOSS_ORANGE]);   // row along the grey wall
  linkedChairs(0.62, 6.6, -Math.PI / 2, [0xff8fb0, 0xffc21a, CRATE_ORANGE]);           // along the storage wall: orange, yellow, pink from the street in
  middleStrip();
  openStackAndSkate();
  street();
  // framed art on the arcade's grey wall
  const PAL2 = ['#f4efe3', '#ffd23f', '#7ec8ff'];
  [[4.7, 1.9, 0.5, 0.36], [5.6, 1.75, 0.34, 0.42], [6.2, 1.95, 0.26, 0.3], [6.8, 1.6, 0.22, 0.26]].forEach(([z, y, w, h], i) => {
    box(0.04, h + 0.06, w + 0.06, mat(0x111111), -3.04, y, z);
    plane(w, h, pixelArt(ART[['wave', 'eye', 'hoop', 'toys'][i]], PAL, PAL2[i % 3]), -3.015, y, z, Math.PI / 2);
  });
}
