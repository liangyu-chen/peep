// The building: floors, walls, doors, the peep window, the arcade storeroom and the neighbour's shutter.
import * as THREE from 'three';
import { ctx, mat, box, wall, canvasTex, plane, floorPlane } from '../engine.js';
import { S } from '../state.js';
import { DOT } from '../util.js';
import { WH } from '../layout.js';
import { concreteWall, wallMat, makeFloorTex } from './textures.js';

export let greyM, blueM;

// the window: solid wall with only the drippy-face logo cut through it, the white logo lines drawn round and inside it
const logoBlob = g => {
  g.beginPath(); g.moveTo(160, 18);
  g.bezierCurveTo(250, 14, 300, 80, 290, 150);
  g.bezierCurveTo(282, 205, 230, 215, 210, 250);
  g.bezierCurveTo(200, 272, 212, 300, 190, 312);
  g.bezierCurveTo(168, 322, 152, 300, 160, 270);
  g.bezierCurveTo(166, 245, 130, 232, 92, 225);
  g.bezierCurveTo(30, 212, 18, 140, 34, 98);
  g.bezierCurveTo(52, 46, 100, 20, 160, 18); g.closePath();
};

function peepWindow() {
  const peepTex = canvasTex(320, 320, (g) => {
    g.strokeStyle = '#ffffff'; g.lineWidth = 7; logoBlob(g); g.stroke();
    g.lineWidth = 5;
    [[118, 120, 34, 26], [196, 104, 30, 30]].forEach(([x, y, rx, ry]) => { g.beginPath(); g.ellipse(x, y, rx, ry, -0.3, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(x + 6, y + 6, 6, 0, Math.PI * 2); g.stroke(); });
    g.beginPath(); g.ellipse(132, 60, 26, 12, 0.2, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(232, 168); g.bezierCurveTo(250, 200, 214, 230, 200, 200); g.stroke();
    g.beginPath(); g.arc(178, 290, 8, 0.2, Math.PI - 0.2); g.stroke();
  });
  // concrete and cut-out live in one image, so the hole can never drift from the logo lines
  const panelTex = canvasTex(560, 560, (g, w, h) => {
    concreteWall(g, w, h, '#9a9a97');
    g.save(); g.scale(w / 320, h / 320); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; logoBlob(g); g.fill(); g.restore();   // opaque fill so the cut is clean
  });
  const panelM = new THREE.MeshStandardMaterial({ map: panelTex, alphaTest: 0.5, roughness: 0.95 });
  const linesM = new THREE.MeshStandardMaterial({ map: peepTex, transparent: true, alphaTest: 0.05, roughness: 0.6 });
  // a skin on each face of the wall so the opening's edges never show; the inner skin is the same plane seen from behind,
  // so both cut-outs line up exactly (a rotated copy would mirror the shape and only the overlap would be see-through)
  [[3.919, THREE.BackSide, -0.002], [4.081, THREE.FrontSide, 0.002]].forEach(([z, side, dz]) => {
    const pm = panelM.clone(); pm.side = side; const lm = linesM.clone(); lm.side = side;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), pm); p.position.set(0.1, 1.55, z); p.receiveShadow = true; ctx.scene.add(p);
    const l = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), lm); l.position.set(0.1, 1.55, z + dz); ctx.scene.add(l);
  });
}

function neighbour(x0, x1, sign, color, h) {
  const w = x1 - x0, cx = (x0 + x1) / 2;
  box(w, h, 4.2, mat(0x5b5752, { roughness: 1 }), cx, h / 2, 6);
  const shutter = canvasTex(64, 64, (g) => { g.fillStyle = '#3f7ea6'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#2f6588'; for (let y = 0; y < 64; y += 4) g.fillRect(0, y, 64, 2); }, true);
  plane(w - 0.6, 2.0, shutter, cx, 1.0, 8.11);
  const st = canvasTex(160, 48, (g) => { g.fillStyle = color; g.fillRect(0, 0, 160, 48); g.fillStyle = '#fff'; g.font = `32px ${DOT}`; g.textAlign = 'center'; g.fillText(sign, 80, 36); }, true);
  plane(Math.min(w - 0.4, 3), 0.8, st, cx, h - 0.6, 8.12);
  return st;
}

export function buildShell() {
  // floor plan (x: -3.1..3.1 wide, z: -11 back .. 8 street)
  const floorTex = makeFloorTex();
  floorPlane(6.2, 12.85, 0, -1.925, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.45 }));
  // toilet floor: plain concrete painted orange, no tiles or seams
  const orangeFloor = canvasTex(256, 256, (g, w, h) => concreteWall(g, w, h, '#d8692a'));
  floorPlane(3.9, 1.35, 1.15, -8.675, new THREE.MeshStandardMaterial({ map: orangeFloor, roughness: 0.55 }), 0.012);
  floorPlane(6.2, 4.0, 0, 6, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 }), 0.01);   // the arcade is the same grey concrete
  floorPlane(40, 2, 0, 9, mat(0x7a7570, { roughness: 1 }), -0.01);
  floorPlane(40, 12, 0, 16, mat(0x2b2b30, { roughness: 1 }), -0.02);
  floorPlane(80, 48.35, 0, 15.825, mat(0x18161c, { roughness: 1 }), -0.04);   // ground stops at the back wall
  for (let i = -6; i <= 6; i++) floorPlane(1.2, 0.15, i * 3, 15, new THREE.MeshBasicMaterial({ color: 0xd9d2a0 }), -0.01);

  greyM = wallMat('#9a9a97');
  const purpleM = wallMat('#5d4f92', [4, 1]);
  const tealM = wallMat('#2f4846', [3, 1]);
  blueM = wallMat('#9fb6c4', [2, 1]);
  // outer walls fade out when the camera swings behind them, so the room is always visible
  S.fadeWalls = [];
  const outerWall = (side, x1, z1, x2, z2, m) => { const me = wall(x1, z1, x2, z2, WH, m.clone()); S.fadeWalls.push({ me, side }); return me; };
  outerWall('L', -3.1, -9.35, -3.1, -5.5, blueM);    // back corridor
  outerWall('L', -3.1, -4.5, -3.1, 4, purpleM);      // purple poster wall, the whole room
  outerWall('L', -3.1, 4, -3.1, 8, greyM);
  outerWall('R', 3.1, -9.35, 3.1, -5.5, greyM);
  outerWall('R', 3.1, -4.5, 3.1, 4, tealM);          // pegboard wall behind the work counter
  outerWall('R', 3.1, 4, 3.1, 8, greyM);
  outerWall('B', -3.1, -9.35, 3.1, -9.35, greyM);
  // neon wall between seating and storage, with a sliding door to the back
  wall(-3.1, -5.5, -2.1, -5.5, WH, greyM);
  wall(-0.9, -5.5, 3.1, -5.5, WH, greyM);
  box(1.25, 0.6, 0.16, greyM, -1.5, 2.5, -5.5);
  box(2.6, 0.04, 0.06, mat(0x222222, { metalness: 0.6 }), -2.0, 2.2, -5.62);
  S.slideDoor = box(1.25, 2.1, 0.05, mat(0x4d5a52, { roughness: 0.5 }), -1.5, 1.07, -5.62);
  box(0.04, 0.3, 0.06, mat(0xcccccc, { metalness: 0.8 }), 0.55, 0, 0.04, S.slideDoor).position.set(-0.52, 0, 0.04);
  S.slide = { open: 0 };
  // back of house partitions
  wall(-0.8, -9.35, -0.8, -9.2, WH, blueM);
  wall(-0.8, -8.2, -0.8, -7.2, WH, blueM);
  wall(-0.8, -6.4, -0.8, -5.5, WH, blueM);
  box(0.16, WH - 2.05, 1.0, blueM, -0.8, 2.05 + (WH - 2.05) / 2, -8.7);   // wall over the toilet door, no gap above it
  box(0.16, WH - 2.1, 0.8, blueM, -0.8, 2.1 + (WH - 2.1) / 2, -6.8);       // and over the storage doorway
  wall(-0.8, -8.0, 3.1, -8.0, WH, greyM);                  // toilet | storage
  S.toiletDoor = box(0.05, 2.05, 1.02, mat(0xd9d2c6, { roughness: 0.6 }), -0.86, 1.025, -8.7);   // sliding toilet door (the storeroom has no door)
  // shop front: cement grey like the rest of the arcade, a plain door, and the melting-face peep window
  wall(-3.1, 4, -2.3, 4, WH, greyM);
  box(1.2, 0.6, 0.16, greyM, -1.7, 2.5, 4);
  wall(-1.1, 4, -0.7, 4, WH, greyM);
  box(1.6, 0.75, 0.16, greyM, 0.1, 0.375, 4); box(1.6, 0.45, 0.16, greyM, 0.1, 2.575, 4);
  wall(0.9, 4, 3.1, 4, WH, greyM);
  const frameTrim = mat(0x7d7b79, { roughness: 0.9 });
  const trimRect = (x0, x1, y0, y1, z) => {      // raised panel moulding on the arcade side
    box(x1 - x0, 0.04, 0.03, frameTrim, (x0 + x1) / 2, y0, z); box(x1 - x0, 0.04, 0.03, frameTrim, (x0 + x1) / 2, y1, z);
    box(0.04, y1 - y0, 0.03, frameTrim, x0, (y0 + y1) / 2, z); box(0.04, y1 - y0, 0.03, frameTrim, x1, (y0 + y1) / 2, z);
  };
  trimRect(-2.38, -1.02, 0, 2.28, 4.09);
  const frontDoor = new THREE.Group(); frontDoor.position.set(-2.3, 0, 4.0); ctx.scene.add(frontDoor);
  box(1.18, 2.18, 0.05, new THREE.MeshStandardMaterial({ color: 0x969693, roughness: 0.85 }), 0.59, 1.09, 0, frontDoor);
  box(0.04, 0.04, 0.14, mat(0x777777, { metalness: 0.8 }), 1.05, 1.0, 0, frontDoor);
  S.frontDoor = frontDoor;
  peepWindow();
  // storage room in the arcade (bottom right of sketch)
  wall(1.0, 5.4, 3.1, 5.4, WH, greyM);
  wall(1.0, 5.4, 1.0, 8, WH, greyM);
  // hidden door: same grey as the wall, only a thin seam gives it away (on the side facing the front wall)
  [1.55, 2.45].forEach(x => box(0.012, 2.0, 0.012, mat(0x5e5c5a), x, 1.0, 5.315));
  box(0.9, 0.012, 0.012, mat(0x5e5c5a), 2.0, 2.0, 5.315);
  wall(1.0, 8, 3.1, 8, WH, greyM);
  box(6.4, 0.35, 0.3, greyM, 0, 2.95, 8.0);
  box(0.35, WH, 0.35, greyM, -2.95, WH / 2, 7.9);

  S.fontTex.push(neighbour(-9, -3.3, '永興五金', '#b0292f', 3.4));
}
