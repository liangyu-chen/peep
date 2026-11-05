import * as THREE from 'three';
import { ctx, cyl, box, mat, LOW_POWER } from '../engine.js';
import { S } from '../state.js';

// sky and the sun, created first so the world builders can skip them when shifting and squeezing the set
export function buildSky() {
  const scene = ctx.scene;
  S.hemi = new THREE.HemisphereLight(0xffe9cf, 0x4a423a, 0.45); scene.add(S.hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 0.7);
  sun.position.set(9, 16, 10); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(LOW_POWER ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  S.sun = sun;
  S.bulbs = [];
}

// (minor: one of the back-of-house bulbs, under a ceiling and hardly seen: lit without a lamp, as every light costs
// something on every pixel of every frame)
function bareBulb(x, z, y = 2.15, power = 0.7, dist = 6, minor = false) {
  const scene = ctx.scene;
  cyl(0.006, 0.006, 2.8 - y, 0x111111, x, (2.8 + y) / 2 + 0.05, z, scene, 4).castShadow = false;
  cyl(0.03, 0.03, 0.07, 0x3a2a1a, x, y + 0.08, z, scene, 8);
  const bm = new THREE.MeshStandardMaterial({ color: 0xffe0a8, emissive: 0xffb44a, emissiveIntensity: 2 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bm); b.position.set(x, y, z); scene.add(b);
  const pl = new THREE.PointLight(0xffb15c, power, dist, 2); pl.position.set(x, y - 0.1, z);
  if (minor) pl.visible = false; else scene.add(pl);
  S.bulbs.push({ pl, bm, base: power });
}

// the back storeroom's bulb: dark unless it's switched on, by the switch outside its door (clicked, or by the owner on
// his way in for beans). Its lamp stays in the scene at nothing when off, so switching it doesn't change the light count.
function storeroomLight(x, z, y) {
  const scene = ctx.scene;
  cyl(0.006, 0.006, 2.8 - y, 0x111111, x, (2.8 + y) / 2 + 0.05, z, scene, 4).castShadow = false;
  cyl(0.03, 0.03, 0.07, 0x3a2a1a, x, y + 0.08, z, scene, 8);
  const bm = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, emissive: 0xffb44a, emissiveIntensity: 0 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bm); b.position.set(x, y, z); scene.add(b);
  const pl = new THREE.PointLight(0xffb15c, 0, 4, 2); pl.position.set(x, y - 0.1, z);
  if (!LOW_POWER) scene.add(pl);
  // the switch: a little white plate on the corridor side of the wall, just by the doorway, its toggle up when on
  box(0.012, 0.11, 0.075, mat(0xf2f0ea, { roughness: 0.5 }), -0.89, 1.3, -5.72);
  const lever = box(0.014, 0.03, 0.016, mat(0xdedad0, { roughness: 0.4 }), -0.9, 1.29, -5.72);
  const hit = box(0.06, 0.2, 0.16, mat(0x000000), -0.9, 1.3, -5.72); hit.visible = false;   // a bigger, unseen box takes the click
  S.storeLight = { pl, bm, lever, hit, on: false };
}
export function setStoreLight(on) {
  const L = S.storeLight; if (!L) return;
  L.on = on;
  L.pl.intensity = on ? 0.55 : 0;
  L.bm.emissiveIntensity = on ? 2.4 : 0; L.bm.color.set(on ? 0xffe0a8 : 0xd8d2c4);
  L.lever.position.y = 1.3 + (on ? 0.012 : -0.012);
}

// red neon wash, bar track spots, bare bulbs in the arcade and back of house
export function buildRoomLights() {
  const scene = ctx.scene;
  // a wide spot pointing into the shop, so the red never leaks through the wall into the storeroom behind it
  const neonLight = new THREE.SpotLight(0xff3020, 1.6, 6, Math.PI * 0.45, 0.6, 2); neonLight.position.set(1.0, 1.9, -4.9);
  neonLight.target.position.set(1.0, 1.2, -2.0); scene.add(neonLight, neonLight.target);
  S.neonLight = neonLight;   // goes out with the sign (hud.js, the switch outside)
  [[-1.0, -1.2, 0.7], [-1.0, 1.8, 0.6], [0.8, -0.4, 0.8], [0.8, 1.8, 0.6], [2.2, 0.5, 0.4], [-1.6, -3.4, 0.35]].forEach(([x, z, p]) => {
    const l = new THREE.PointLight(0xffe2b8, p, 5.5, 2); l.position.set(x, 2.5, z); scene.add(l); S.bulbs.push({ pl: l, bm: null, base: p });
  });
  // the arcade is lit from its track (in arcade.js), not a bare bulb
  const arcadeLight = new THREE.PointLight(0xffe2b8, 0.7, 7, 2); arcadeLight.position.set(-1.0, 2.5, 5.6); scene.add(arcadeLight); S.bulbs.push({ pl: arcadeLight, bm: null, base: 0.7 });
  bareBulb(1.2, -8.7, 2.3, 0.35, 4, true); bareBulb(-1.9, -8, 2.3, 0.25, 4, true);
  storeroomLight(1.2, -6.8, 2.3);
}

// ---------------------------------------------------------------- day/night
const SKY = [[14, 0xbfe3ff], [16, 0xf2e4c4], [18, 0xf2a46e], [19.5, 0x4a4275], [21, 0x182040], [24, 0x0e1328]];
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
  if (ctx.scene.fog) ctx.scene.fog.color.copy(sky).lerp(tmpC2.set(0xd9dcdc), daylight * 0.5);   // city haze
  (S.envWindows || []).forEach(m => { m.emissiveIntensity = (1 - daylight) * 1.1; });           // the neighbours' windows light up after dark
}
