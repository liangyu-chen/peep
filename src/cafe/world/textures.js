import * as THREE from 'three';
import { canvasTex } from '../engine.js';
import { rand, pick } from '../util.js';

export function speckle(g, w, h, base, n) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${pick(['30,30,30', '255,255,255', '90,80,70'])},${rand(0.03, 0.14)})`; g.fillRect(rand(0, w), rand(0, h), rand(1, 3), rand(1, 3)); }
  for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(0,0,0,.06)'; g.beginPath(); g.arc(rand(0, w), rand(0, h), rand(20, 70), 0, 7); g.fill(); }
}

// plain poured-concrete wall, like a concrete stair: fine aggregate grain only, no seams or blotches
export function concreteWall(g, w, h, base) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const k = (w * h) / 65536;
  for (let i = 0; i < 9000 * k; i++) { g.fillStyle = `rgba(${pick(['20,20,20', '255,255,255', '60,60,58'])},${rand(0.04, 0.16)})`; g.fillRect(rand(0, w), rand(0, h), 1, 1); }
  for (let i = 0; i < 260 * k; i++) { g.fillStyle = `rgba(${pick(['40,40,40', '235,235,230'])},${rand(0.08, 0.18)})`; g.fillRect(rand(0, w), rand(0, h), 2, 2); }
}

export const wallTex = c => { const t = canvasTex(256, 256, (g, w, h) => concreteWall(g, w, h, c)); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
export const wallMat = (c, rep = [3, 1]) => { const t = wallTex(c); t.repeat.set(...rep); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, transparent: true }); };

// one big polished-concrete floor with real cracks (like in the videos)
export const makeFloorTex = () => canvasTex(400, 1000, (g, w, h) => {
  speckle(g, w, h, '#a3a3a1', 9000);
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(55,55,55,${rand(0.05, 0.12)})`; g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(30, 90), rand(60, 160), rand(0, 3), 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(40,36,32,.75)'; g.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) {
    let x = rand(0, w), y = rand(0, h); g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 14; k++) { x += rand(-18, 18); y += rand(10, 34); g.lineTo(x, y); }
    g.stroke();
  }
});
