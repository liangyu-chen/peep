// The building: floors, walls, doors, the peep window, the arcade storeroom and the neighbour's shutter.
import * as THREE from 'three';
import { ctx, mat, box, wall, canvasTex, plane, floorPlane, pixelArt } from '../engine.js';
import { S } from '../state.js';
import { DOT, K } from '../util.js';
import { WH } from '../layout.js';
import { concreteWall, wallMat, makeFloorTex } from './textures.js';
import { ART, PAL } from '../art.js';
import { logoPath, logoLines, fit } from './logo.js';

export let greyM, blueM;

// the window: solid wall with only the melting-face logo cut through it (glass in the cut, a grey rim round its edge)
// and the logo's white lines drawn on the glass
function peepWindow() {
  const SIZE = 560, LOGO = SIZE * 0.95;   // the opening is square; the tall logo fills most of its height
  const SX = 1 / K;                        // the whole set is squeezed sideways by K; stretch the drawing so the logo keeps its shape
  const linesTex = canvasTex(SIZE, SIZE, (g, w, h) => {
    g.save(); fit(g, w, LOGO, h, SX); g.strokeStyle = '#ffffff'; logoLines(g, { lw: 8, inset: 5 }); g.restore();
  });
  // concrete and cut-out live in one image, so the hole can never drift from the logo lines
  const panelTex = canvasTex(SIZE, SIZE, (g, w, h) => {
    concreteWall(g, w, h, '#9a9a97');
    g.save(); fit(g, w, LOGO, h, SX);
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; logoPath(g); g.fill();   // opaque fill so the cut is clean
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = 5; g.strokeStyle = '#c2bfbb'; logoPath(g); g.stroke();                       // the rounded rim of the cut
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(70,68,66,.8)'; logoPath(g); g.stroke();
    g.restore();
  });
  const panelM = new THREE.MeshStandardMaterial({ map: panelTex, alphaTest: 0.5, roughness: 0.95 });
  const linesM = new THREE.MeshStandardMaterial({ map: linesTex, transparent: true, alphaTest: 0.05, roughness: 0.5 });
  // a skin on each face of the wall so the opening's edges never show; the inner skin is the same plane seen from behind,
  // so both cut-outs line up exactly (a rotated copy would mirror the shape and only the overlap would be see-through)
  [[3.919, THREE.BackSide, -0.002], [4.081, THREE.FrontSide, 0.002]].forEach(([z, side, dz]) => {
    const pm = panelM.clone(); pm.side = side; const lm = linesM.clone(); lm.side = side;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), pm); p.position.set(0.1, 1.55, z); p.receiveShadow = true; ctx.scene.add(p);
    const l = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), lm); l.position.set(0.1, 1.55, z + dz); ctx.scene.add(l);
  });
  // the glass in the cut: faintly tinted and shiny, so it reads as a pane and not an empty hole
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshStandardMaterial({
    color: 0xb9c4ca, metalness: 0.6, roughness: 0.08, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
  }));
  glass.position.set(0.1, 1.55, 4.0); ctx.scene.add(glass);
}

export function buildShell() {
  // floor plan (x: -3.1..3.1 wide, z: -11 back .. 8 street)
  const floorTex = makeFloorTex();
  floorPlane(6.2, 12.85, 0, -1.925, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.45 }));
  // toilet floor: plain concrete painted orange, no tiles or seams
  const orangeFloor = canvasTex(256, 256, (g, w, h) => concreteWall(g, w, h, '#d8692a'));
  floorPlane(3.9, 1.3, 1.15, -8.7, new THREE.MeshStandardMaterial({ map: orangeFloor, roughness: 0.55 }), 0.012);
  floorPlane(6.2, 4.0, 0, 6, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 }), 0.01);   // the arcade is the same grey concrete
  // the lane outside, its buildings and its traffic are built in surroundings.js

  greyM = wallMat('#9a9a97');
  const purpleM = wallMat('#5d4f92', [4, 1]);
  const tealM = wallMat('#2f4846', [3, 1]);
  blueM = wallMat('#9fb6c4', [2, 1]);
  // outer walls fade out when the camera swings behind them, so the room is always visible
  S.fadeWalls = [];
  const outerWall = (side, x1, z1, x2, z2, m) => { const me = wall(x1, z1, x2, z2, WH, m.clone()); S.fadeWalls.push({ me, side }); return me; };
  outerWall('L', -3.1, -9.35, -3.1, -5.5, greyM);    // back corridor: all of back of house is plain grey
  outerWall('L', -3.1, -4.5, -3.1, 4, purpleM);      // purple poster wall, the whole room
  outerWall('L', -3.1, 4, -3.1, 8, greyM);
  outerWall('R', 3.1, -9.35, 3.1, -5.5, greyM);
  outerWall('R', 3.1, -4.5, 3.1, 4, tealM);          // pegboard wall behind the work counter
  outerWall('R', 3.1, 4, 3.1, 8, greyM);
  outerWall('B', -3.1, -9.35, 3.1, -9.35, greyM);
  // neon wall between seating and storage, with a sliding door to the back
  wall(-3.1, -5.5, -2.1, -5.5, WH, greyM);
  wall(-0.9, -5.5, 3.1, -5.5, WH, greyM);
  box(1.25, 0.4, 0.16, greyM, -1.5, 2.6, -5.5);          // a shallow lintel: the door runs up to 2.4 m
  box(2.6, 0.04, 0.1, mat(0x222222, { metalness: 0.6 }), -2.0, 2.42, -5.63);   // the track, tight under it
  // two sliding panels on two tracks, one behind the other, each with three frosted panes stacked up it in raised frames:
  // the left one stays put, the right one slides left behind it to open the way into the back
  const frost = new THREE.MeshStandardMaterial({ color: 0xb3c0c6, roughness: 0.4, metalness: 0.1, emissive: 0x0e1214 });
  const frameM = mat(0x2c2e31, { roughness: 0.5 }), panelM = mat(0x3d3f42, { roughness: 0.5 });
  const panel = (x, z) => {
    const p = box(0.64, 2.39, 0.04, panelM, x, 1.205, z);   // floor to the track, no gap above
    [0.68, 0, -0.68].forEach(y => [-1, 1].forEach(f => {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), frost); pane.position.set(0, y, f * 0.022); if (f < 0) pane.rotation.y = Math.PI; p.add(pane);
      [[0.5, 0.04, 0, y + 0.3], [0.5, 0.04, 0, y - 0.3], [0.04, 0.64, -0.23, y], [0.04, 0.64, 0.23, y]].forEach(([w, h, bx, by]) => box(w, h, 0.012, frameM, bx, by, f * 0.026, p));
    }));
    return p;
  };
  panel(-1.78, -5.6);                                        // the fixed one, on the inner track
  S.slideDoor = panel(-1.22, -5.66);                         // the one that slides, on the outer track
  box(0.025, 0.3, 0.05, mat(0xcccccc, { metalness: 0.8 }), 0.27, 0, 0, S.slideDoor);   // its pull, by the right edge
  S.slide = { open: 0 };
  // back of house partitions
  wall(-0.8, -9.35, -0.8, -9.2, WH, greyM);
  wall(-0.8, -8.2, -0.8, -6.9, WH, greyM);
  wall(-0.8, -6.1, -0.8, -5.5, WH, greyM);                // the storeroom doorway sits toward the front, clear of the crates in its back corner
  box(0.16, WH - 2.05, 1.0, greyM, -0.8, 2.05 + (WH - 2.05) / 2, -8.7);   // wall over the toilet door, no gap above it
  box(0.16, WH - 2.1, 0.8, greyM, -0.8, 2.1 + (WH - 2.1) / 2, -6.5);       // and over the storage doorway
  wall(-0.8, -7.35, 3.1, -7.35, WH, greyM);                // the small storeroom's back wall
  box(3.9, WH, 0.7, greyM, 1.15, WH / 2, -7.7);             // a solid run of wall between it and the toilet, which is only a little deeper than its door
  // toilet door: pushed open into the toilet, hinged on the right as you face it from the corridor (the front end),
  // handle on the left; it swings back flat against the toilet's front wall (the storeroom has no door)
  S.toiletDoor = new THREE.Group(); S.toiletDoor.position.set(-0.86, 0, -8.19); ctx.scene.add(S.toiletDoor);
  const leaf = box(0.05, 2.05, 1.02, mat(0xd9d2c6, { roughness: 0.6 }), 0, 1.025, -0.51, S.toiletDoor);
  const knob = mat(0xb9bcbd, { metalness: 0.8, roughness: 0.3 });
  [-1, 1].forEach(sd => { box(0.04, 0.03, 0.12, knob, sd * 0.045, 0.98, -0.88, S.toiletDoor); box(0.02, 0.1, 0.05, knob, sd * 0.03, 0.98, -0.93, S.toiletDoor); });   // lever handles, both sides
  // posters taped on its corridor side (they swing with it, clear of the handle), and a hand-written note
  const doorSide = (tex, w, h, y, z, tilt = 0) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    p.position.set(-0.027, y, z); p.rotation.set(0, -Math.PI / 2, tilt); leaf.add(p);
  };
  doorSide(pixelArt(ART.toys, PAL, '#ffd23f'), 0.36, 0.36, 0.42, -0.2, 0.04);
  doorSide(pixelArt(ART.eye, PAL, '#ff4f7b'), 0.3, 0.23, 0.05, 0.22, -0.06);
  doorSide(pixelArt(ART.wave, PAL, '#f4efe3'), 0.34, 0.26, -0.35, -0.12, 0.03);
  const note = canvasTex(96, 64, (g, w, h) => { g.fillStyle = '#f6f1e4'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2a2a'; g.font = `18px ${DOT}`; g.textAlign = 'center'; g.fillText('請隨手', w / 2, 26); g.fillText('關門 ♥', w / 2, 50); });
  S.fontTex.push(note);
  doorSide(note, 0.2, 0.135, 0.32, 0.25, 0.08);
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
  // its front wall sits a quarter metre back from where it was first drawn, leaving room for the beanbag nook outside its door
  wall(1.0, 5.65, 3.1, 5.65, WH, greyM);
  wall(1.0, 5.65, 1.0, 8, WH, greyM);
  // hidden door: same grey as the wall, only a thin seam gives it away (on the side facing the front wall)
  [1.55, 2.45].forEach(x => box(0.012, 2.0, 0.012, mat(0x5e5c5a), x, 1.0, 5.565));
  box(0.9, 0.012, 0.012, mat(0x5e5c5a), 2.0, 2.0, 5.565);
  wall(1.0, 8, 3.1, 8, WH, greyM);
  box(6.4, 0.35, 0.3, greyM, 0, 2.95, 8.0);
  box(0.35, WH, 0.35, greyM, -2.95, WH / 2, 7.9);

}
