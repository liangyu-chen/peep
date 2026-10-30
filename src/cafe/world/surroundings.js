// What's around the shop, for a calm "pure land" feel: a pale stone lane, a lotus pond across it behind a white
// moon-gate wall, soft round trees and bamboo, two quiet whitewashed neighbours, misty hills all round the horizon,
// and motes of light drifting in the air. Built after the set is squeezed, so it is in plain world metres.
import * as THREE from 'three';
import { ctx, mat as rawMat, box, cyl, canvasTex } from '../engine.js';
import { S } from '../state.js';
import { rand, pick } from '../util.js';

let env;
// colours given as they should look on screen (the shop's own materials are tuned by eye in linear values)
const mat = (hex, o) => rawMat(new THREE.Color(hex).convertSRGBToLinear(), o);
const plaster = mat(0xf1ede4, { roughness: 0.95 });
const tileM = mat(0x5d6166, { roughness: 0.7 });
const stoneM = mat(0xc9c2b4, { roughness: 0.95 });
const woodDoor = mat(0x6e4a30, { roughness: 0.7 });
const trunkM = mat(0x5e4e42, { roughness: 1 });
const LEAVES = [0x6f9f5c, 0x7fae66, 0x5f8f55, 0x8fbb72].map(c => mat(c, { roughness: 0.9, flatShading: true }));
const BLOSSOM = [0xeeb3c4, 0xf3c9d5, 0xf4e6ea].map(c => mat(c, { roughness: 0.9, flatShading: true }));
const blob = new THREE.IcosahedronGeometry(1, 1);

// a soft round tree: a trunk and a few overlapping canopy blobs
function tree(x, z, s = 1, blossom = false) {
  const g = new THREE.Group(); g.position.set(x, 0, z); env.add(g);
  cyl(0.12 * s, 0.18 * s, 2.2 * s, trunkM, 0, 1.1 * s, 0, g, 7);
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(blob, blossom && Math.random() < 0.75 ? pick(BLOSSOM) : pick(LEAVES));
    const r = rand(0.9, 1.4) * s;
    m.scale.set(r, r * 0.85, r); m.position.set(rand(-0.8, 0.8) * s, (2.4 + rand(0, 1.0)) * s, rand(-0.8, 0.8) * s);
    m.castShadow = true; g.add(m);
  }
  return g;
}

// a cluster of bamboo: tall thin canes with little leaf tufts near the top
function bamboo(x, z, n = 9) {
  const caneM = mat(0x6f9450, { roughness: 0.6 }), leafM = mat(0x7fa866, { roughness: 0.9, flatShading: true });
  for (let i = 0; i < n; i++) {
    const h = rand(4, 6.5), cx = x + rand(-0.7, 0.7), cz = z + rand(-0.7, 0.7);
    const c = cyl(0.035, 0.045, h, caneM, cx, h / 2, cz, env, 6); c.rotation.z = rand(-0.06, 0.06); c.rotation.x = rand(-0.06, 0.06);
    for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(blob, leafM); t.scale.set(0.45, 0.2, 0.45); t.position.set(cx + rand(-0.3, 0.3), h - k * 0.7, cz + rand(-0.3, 0.3)); env.add(t); }
  }
}

// a whitewashed neighbour: plaster walls, a dark tiled eave over the front, a wooden door, a lattice window lit warm,
// and pots by the step. x0..x1 is its frontage, the front face at z
function house(x0, x1, z, depth, h, side) {
  const w = x1 - x0, cx = (x0 + x1) / 2;
  box(w, h, depth, plaster, cx, h / 2, z - depth / 2, env);
  const eave = box(w + 0.3, 0.12, 0.9, tileM, cx, h - 0.45, z + 0.3, env); eave.rotation.x = 0.28;   // tiled eave
  box(w + 0.1, 0.14, depth + 0.1, tileM, cx, h + 0.07, z - depth / 2, env);                         // roof cap
  const dx = cx + side * w * 0.22;
  box(1.0, 2.1, 0.08, woodDoor, dx, 1.05, z + 0.02, env);                                          // door
  box(0.06, 0.2, 0.05, mat(0xc9a14a, { metalness: 0.6, roughness: 0.3 }), dx + side * 0.38, 1.05, z + 0.08, env);
  const lat = canvasTex(64, 48, (g) => {
    g.fillStyle = '#ffe2b0'; g.fillRect(0, 0, 64, 48); g.strokeStyle = '#5a3c26'; g.lineWidth = 3;
    for (let x = 0; x <= 64; x += 10.6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 48); g.stroke(); }
    for (let y = 0; y <= 48; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
  });
  const winM = new THREE.MeshStandardMaterial({ map: lat, emissive: 0xffc27a, emissiveMap: lat, emissiveIntensity: 0.35, roughness: 0.8 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.95), winM); win.position.set(cx - side * w * 0.2, 1.55, z + 0.01); env.add(win);
  S.envWindows.push(winM);
  box(1.5, 0.08, 0.12, woodDoor, cx - side * w * 0.2, 1.03, z + 0.06, env);                     // sill
  // pots on the step
  [[-0.55, 0.5], [0.55, 0.7]].forEach(([o, s]) => {
    cyl(0.18 * s, 0.14 * s, 0.32 * s, mat(0xb06a45, { roughness: 0.8 }), dx + o, 0.16 * s, z + 0.35, env, 12);
    const p = new THREE.Mesh(blob, pick(LEAVES)); p.scale.setScalar(0.28 * s + 0.1); p.position.set(dx + o, 0.32 * s + 0.2, z + 0.35); env.add(p);
  });
}

// the long white wall across the lane, a round moon gate in the middle, grey tiles along the top
function moonGateWall(z, halfLen) {
  const H = 2.6, T = 0.3, R = 1.25, GW = 3.4;
  // the gate panel: a rectangle with a round hole, extruded
  const sh = new THREE.Shape(); sh.moveTo(-GW / 2, 0); sh.lineTo(GW / 2, 0); sh.lineTo(GW / 2, H); sh.lineTo(-GW / 2, H); sh.lineTo(-GW / 2, 0);
  const hole = new THREE.Path(); hole.absarc(0, R + 0.08, R, 0, Math.PI * 2, true); sh.holes.push(hole);
  const gate = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false, curveSegments: 40 }), plaster);
  gate.position.set(0, 0, z - T / 2); gate.castShadow = gate.receiveShadow = true; env.add(gate);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 8, 48), stoneM); rim.position.set(0, R + 0.08, z + T / 2); env.add(rim);
  [-1, 1].forEach(s => {
    const len = halfLen - GW / 2;
    box(len, H, T, plaster, s * (GW / 2 + len / 2), H / 2, z, env);
    box(len + 0.05, 0.16, T + 0.3, tileM, s * (GW / 2 + len / 2), H + 0.08, z, env);
  });
  box(GW + 0.05, 0.16, T + 0.3, tileM, 0, H + 0.08, z, env);
}

// a still lotus pond with a stone rim, pads and a few pink flowers
function lotusPond(x0, x1, z0, z1) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(0x7fb3a8, { roughness: 0.08, metalness: 0.35 }));
  water.rotation.x = -Math.PI / 2; water.position.set(cx, 0.06, cz); water.receiveShadow = true; env.add(water);
  [[w + 0.5, 0.25, z0], [w + 0.5, 0.25, z1]].forEach(([ww, dd, zz]) => box(ww, 0.22, dd, stoneM, cx, 0.11, zz, env));
  [x0, x1].forEach(xx => box(0.25, 0.22, d, stoneM, xx, 0.11, cz, env));
  // stepping stones straight across, from the lane to the moon gate
  for (let zz = z0 - 0.1; zz < z1 + 2.3; zz += 0.66) { const st = cyl(0.3, 0.32, 0.12, stoneM, rand(-0.06, 0.06), 0.07, zz, env, 9); st.scale.z = 0.75; }
  const padM = mat(0x6f9a5a, { roughness: 0.7 }), petalM = mat(0xf4b6c2, { roughness: 0.6 }), heartM = mat(0xf0d36a, { roughness: 0.6 });
  for (let i = 0; i < 46; i++) {
    let px = rand(x0 + 0.5, x1 - 0.5); if (Math.abs(px) < 0.9) px += Math.sign(px || 1) * 1.2;   // keep the stepping stones clear
    const pz = rand(z0 + 0.4, z1 - 0.4), r = rand(0.18, 0.38);
    const pad = cyl(r, r, 0.015, padM, px, 0.07, pz, env, 14); pad.castShadow = false;
    if (i % 3 === 0) {   // a lotus: two rings of petals round a yellow heart, held up on its stem
      const f = new THREE.Group(); f.position.set(px + 0.05, 0.24, pz); env.add(f);
      cyl(0.01, 0.01, 0.18, padM, 0, -0.09, 0, f, 5);
      [[6, 0.3, 0.06], [5, 0.7, 0.035]].forEach(([n, tilt, r0]) => {
        for (let k = 0; k < n; k++) {
          const p = new THREE.Mesh(blob, petalM); p.scale.set(0.035, 0.08, 0.02);
          const a = (k / n) * Math.PI * 2 + tilt;
          p.position.set(Math.cos(a) * r0, 0.04, Math.sin(a) * r0); p.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt); f.add(p);
        }
      });
      const h = new THREE.Mesh(blob, heartM); h.scale.setScalar(0.03); h.position.y = 0.04; f.add(h);
    }
  }
}

// stone lantern beside the gate
function lantern(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); env.add(g);
  box(0.5, 0.15, 0.5, stoneM, 0, 0.075, 0, g); cyl(0.09, 0.11, 0.7, stoneM, 0, 0.5, 0, g, 8);
  box(0.42, 0.08, 0.42, stoneM, 0, 0.88, 0, g);
  box(0.32, 0.3, 0.32, new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffd28a, emissiveIntensity: 0.6 }), 0, 1.07, 0, g);
  cyl(0.02, 0.42, 0.24, stoneM, 0, 1.34, 0, g, 4).rotation.y = Math.PI / 4;
}

// misty hills on a ring all round the horizon: three layers fading toward the sky, transparent above
function hills() {
  const tex = canvasTex(2048, 256, (g, w, h) => {
    const layer = (base, amp, col, seed) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        const t = (x / w) * Math.PI * 2;
        const y = base - amp * (0.55 * Math.sin(t * 3 + seed) + 0.3 * Math.sin(t * 7 + seed * 2) + 0.15 * Math.sin(t * 17 + seed * 3));
        g.lineTo(x, y);
      }
      g.lineTo(w, h); g.closePath(); g.fill();
    };
    layer(120, 70, 'rgba(196,204,214,0.75)', 0.4);
    layer(165, 55, 'rgba(170,184,190,0.85)', 2.1);
    layer(205, 35, 'rgba(150,170,166,0.95)', 4.3);
    const mist = g.createLinearGradient(0, 150, 0, h); mist.addColorStop(0, 'rgba(240,236,228,0)'); mist.addColorStop(1, 'rgba(240,236,228,0.9)');
    g.fillStyle = mist; g.fillRect(0, 150, w, h - 150);
  });
  tex.wrapS = THREE.RepeatWrapping;
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false });
  S.hillsM = m;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(120, 120, 34, 64, 1, true), m);
  ring.position.y = 13; ring.renderOrder = -1; env.add(ring);
}

// little motes of light drifting slowly up and round, brighter after dark
function motes() {
  const N = 260, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = rand(-26, 26); pos[i * 3 + 1] = rand(0.3, 9); pos[i * 3 + 2] = rand(-22, 34); seed[i] = rand(0, 100); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = canvasTex(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,250,225,1)'); r.addColorStop(0.4, 'rgba(255,236,180,0.5)'); r.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); });
  const m = new THREE.PointsMaterial({ map: dot, size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, color: 0xfff1c4 });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; env.add(pts);
  S.motes = { pts, pos, seed, m, t: 0 };
}

export function updateSurroundings(dt) {
  const k = S.motes; if (!k) return;
  k.t += dt;
  for (let i = 0; i < k.seed.length; i++) {
    const s = k.seed[i];
    k.pos[i * 3] += Math.sin(k.t * 0.3 + s) * dt * 0.12;
    k.pos[i * 3 + 1] += dt * (0.08 + (s % 1) * 0.08);
    k.pos[i * 3 + 2] += Math.cos(k.t * 0.25 + s) * dt * 0.12;
    if (k.pos[i * 3 + 1] > 9.5) k.pos[i * 3 + 1] = 0.3;
  }
  k.pts.geometry.attributes.position.needsUpdate = true;
}

export function buildSurroundings() {
  env = new THREE.Group(); ctx.scene.add(env);
  ctx.scene.fog = new THREE.Fog(0xe8e4dc, 60, 140);
  S.envWindows = [];
  // pale ground all round, and the hills on the horizon
  const ground = new THREE.Mesh(new THREE.CircleGeometry(125, 48), mat(0xc9c0ae, { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; env.add(ground);
  hills();
  // the two neighbours either side of the arcade, fronts in line with the shop's
  house(-7.6, -2.3, 8.1, 4.6, 3.3, 1);
  house(2.3, 7.2, 8.1, 4.6, 3.0, -1);
  // garden walls running on along the street, trees over them
  [-1, 1].forEach(s => {
    box(14, 1.6, 0.25, plaster, s * 14.6, 0.8, 7.9, env); box(14.1, 0.12, 0.5, tileM, s * 14.6, 1.66, 7.9, env);
    for (let i = 0; i < 5; i++) tree(s * (9.5 + i * 2.8), rand(4.5, 6.2), rand(0.8, 1.1), i % 2 === 1);
  });
  // bamboo along the far side of the shop and behind it (the near side stays open, so the cameras see in)
  [[-3.7, -6], [-3.9, -1.5], [-3.5, 2.2], [-1.5, -10.6], [1.6, -10.8]].forEach(([x, z]) => bamboo(x, z));
  for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(blob, pick(LEAVES)); p.scale.set(rand(0.4, 0.7), rand(0.3, 0.45), rand(0.4, 0.7)); p.position.set(rand(2.7, 4.2), 0.2, -8 + i * 2); env.add(p); }   // low shrubs on the near side
  // further out at the sides and back: a loose grove of round trees, some in blossom
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1, x = side > 0 ? rand(11, 22) : -rand(6.5, 20), z = rand(-24, 2);
    tree(x, z, rand(0.9, 1.4), Math.random() < 0.35);
  }
  for (let i = 0; i < 10; i++) tree(rand(-12, 12), rand(-26, -14), rand(1, 1.5), Math.random() < 0.3);
  // across the lane: a lotus pond, then the white wall with its moon gate, trees behind
  lotusPond(-11, 11, 16.5, 22.5);
  moonGateWall(25, 22);
  lantern(-2.3, 23.8); lantern(2.3, 23.8);
  for (let i = 0; i < 14; i++) tree(rand(-20, 20), rand(27.5, 34), rand(1.1, 1.6), Math.random() < 0.4);
  motes();
}
