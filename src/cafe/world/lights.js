import * as THREE from 'three';
import { ctx, cyl } from '../engine.js';
import { S } from '../state.js';

// sky and the sun, created first so the world builders can skip them when shifting and squeezing the set
export function buildSky() {
  const scene = ctx.scene;
  S.hemi = new THREE.HemisphereLight(0xffe9cf, 0x4a423a, 0.45); scene.add(S.hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 0.7);
  sun.position.set(9, 16, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  S.sun = sun;
  S.bulbs = [];
}

function bareBulb(x, z, y = 2.15, power = 0.7, dist = 6) {
  const scene = ctx.scene;
  cyl(0.006, 0.006, 2.8 - y, 0x111111, x, (2.8 + y) / 2 + 0.05, z, scene, 4).castShadow = false;
  cyl(0.03, 0.03, 0.07, 0x3a2a1a, x, y + 0.08, z, scene, 8);
  const bm = new THREE.MeshStandardMaterial({ color: 0xffe0a8, emissive: 0xffb44a, emissiveIntensity: 2 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bm); b.position.set(x, y, z); scene.add(b);
  const pl = new THREE.PointLight(0xffb15c, power, dist, 2); pl.position.set(x, y - 0.1, z); scene.add(pl);
  S.bulbs.push({ pl, bm, base: power });
}

// red neon wash, bar track spots, bare bulbs in the arcade and back of house
export function buildRoomLights() {
  const scene = ctx.scene;
  // a wide spot pointing into the shop, so the red never leaks through the wall into the storeroom behind it
  const neonLight = new THREE.SpotLight(0xff3020, 1.6, 6, Math.PI * 0.45, 0.6, 2); neonLight.position.set(1.0, 1.9, -4.9);
  neonLight.target.position.set(1.0, 1.2, -2.0); scene.add(neonLight, neonLight.target);
  bareBulb(-2.3, 3.2, 2.2, 0.6);
  [[-1.0, -1.2, 0.7], [-1.0, 1.8, 0.6], [0.8, -0.4, 0.8], [0.8, 1.8, 0.6], [2.2, 0.5, 0.4], [-1.6, -3.4, 0.35]].forEach(([x, z, p]) => {
    const l = new THREE.PointLight(0xffe2b8, p, 5.5, 2); l.position.set(x, 2.5, z); scene.add(l); S.bulbs.push({ pl: l, bm: null, base: p });
  });
  bareBulb(-1.0, 6.2, 2.4, 0.7, 7);
  bareBulb(1.2, -8.7, 2.3, 0.35, 4); bareBulb(1.2, -6.8, 2.3, 0.3, 4); bareBulb(-1.9, -8, 2.3, 0.25, 4);
}

// ---------------------------------------------------------------- day/night
// soft and pale: a milky blue afternoon, a peach-gold evening, lavender dusk, a deep indigo night (never black)
const SKY = [[14, 0xdce9f0], [16, 0xf3e7d2], [18, 0xf6c9a2], [19.5, 0x8d7fae], [21, 0x343a66], [24, 0x1f2547]];
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
function skyAt(h) {
  for (let i = 0; i < SKY.length - 1; i++) if (h >= SKY[i][0] && h < SKY[i + 1][0]) return tmpC.set(SKY[i][1]).lerp(tmpC2.set(SKY[i + 1][1]), (h - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]));
  return tmpC.set(h < SKY[0][0] ? SKY[0][1] : SKY[SKY.length - 1][1]);
}
export function updateLighting() {
  const h = S.minutes / 60;
  const sky = skyAt(h);
  const daylight = Math.max(0, Math.min(1, (19.5 - h) / 3));
  S.sun.intensity = 0.15 + daylight * 0.6;
  S.sun.color.copy(sky).lerp(tmpC2.set(0xffffff), 0.5);
  S.hemi.intensity = 0.3 + daylight * 0.25;
  S.bulbs.forEach(b => { b.pl.intensity = b.base * (1 + (1 - daylight) * 0.8); if (b.bm) b.bm.emissiveIntensity = 1.5 + (1 - daylight) * 1.5; });
  ctx.scene.background.copy(sky);
  if (ctx.scene.fog) ctx.scene.fog.color.copy(sky).lerp(tmpC2.set(0xeee9e0), daylight * 0.35);
  if (S.hillsM) S.hillsM.color.setScalar(0.45 + daylight * 0.55);
  (S.envWindows || []).forEach(m => { m.emissiveIntensity = 0.25 + (1 - daylight) * 1.3; });
  if (S.motes) S.motes.m.opacity = 0.35 + (1 - daylight) * 0.55;
}
