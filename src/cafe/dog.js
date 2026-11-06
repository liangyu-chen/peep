// 夜叉丸: a little Pomeranian who trots along at their feet (a 配件 picked in the back office). He has alopecia: only his
// head (with the ruff round his neck) and a patch over his back keep the full fluffy coat, cream going apricot; the
// rest of him is short sparse fur over pinkish skin, his tail a thin curl over his rump. Small grey-tipped ears, black
// button eyes and nose, his pink tongue out. He trots when they walk, sits when they stop, and never stops wagging.
import * as THREE from 'three';
import { mat } from './engine.js';
import { picked } from './body.js';
import { K } from './util.js';
import { KERB, RISE, BACK_DROP, inBackHall } from './layout.js';

let M = null;
const mats = () => M || (M = {
  fluff: mat(picked(0xf0d9b8), { roughness: 1 }),        // the full coat, cream
  apricot: mat(picked(0xe9c79a), { roughness: 1 }),      // warmer over the back
  bare: mat(picked(0xe6cfc6), { roughness: 0.9 }),       // short fur over pink skin
  pink: mat(picked(0xd6b3b0), { roughness: 0.85 }),      // where it's barest, the rump
  ear: mat(picked(0x8c8580), { roughness: 0.95 }),
  dark: mat(0x141214, { roughness: 0.35 }),
  shine: mat(0xffffff, { roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.4 }),
  tongue: mat(picked(0xe0647e), { roughness: 0.5 }),
});

// a fluffy ball: a sphere with every point pushed in or out a little at random, so its outline is tufted fur
const FUZZ = new Map();
function fuzzGeo(r, seed) {
  const k = `${r}:${seed}`;
  if (FUZZ.has(k)) return FUZZ.get(k);
  const g = new THREE.SphereGeometry(r, 18, 14), p = g.attributes.position;
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const v = new THREE.Vector3(), seen = new Map();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;   // (the seam's twin points pushed alike, so it stays closed)
    if (!seen.has(key)) seen.set(key, 1 + (rnd() - 0.4) * 0.22);
    v.multiplyScalar(seen.get(key)); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); FUZZ.set(k, g); return g;
}
const ball = (r, m, x, y, z, parent, sx = 1, sy = 1, sz = 1) => { const me = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m); me.position.set(x, y, z); me.scale.set(sx, sy, sz); me.castShadow = true; parent.add(me); return me; };
const fuzz = (r, seed, m, x, y, z, parent, sx = 1, sy = 1, sz = 1) => { const me = new THREE.Mesh(fuzzGeo(r, seed), m); me.position.set(x, y, z); me.scale.set(sx, sy, sz); me.castShadow = true; parent.add(me); return me; };

export function makeDog() {
  const m = mats();
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b);   // b: the body, tipped back when he sits

  // the body, short-haired, the rump barest
  ball(0.06, m.bare, 0, 0.165, 0.01, b, 1.05, 1.05, 1.75);
  ball(0.05, m.pink, 0, 0.165, -0.075, b, 1.05, 1.0, 0.9);
  // the patch of full coat left over his back, and the big ruff round his neck and chest
  fuzz(0.055, 3, m.apricot, 0, 0.205, 0.0, b, 1.05, 0.55, 1.2);
  fuzz(0.072, 5, m.fluff, 0, 0.215, 0.085, b, 1.05, 1.05, 0.9);

  // the head: one big fluffy ball, a small muzzle, button eyes and nose, tongue out
  const head = new THREE.Group(); head.position.set(0, 0.285, 0.125); b.add(head);
  fuzz(0.072, 7, m.fluff, 0, 0, 0, head);
  ball(0.026, m.fluff, 0, -0.018, 0.062, head, 1.15, 0.85, 0.9);
  ball(0.0085, m.dark, 0, -0.008, 0.086, head, 1.2, 0.9, 0.8);                  // nose
  [-1, 1].forEach(s => {
    ball(0.0095, m.dark, s * 0.026, 0.012, 0.062, head);                         // eyes
    ball(0.0028, m.shine, s * 0.026 + 0.003, 0.016, 0.071, head);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.034, 8), m.ear);  // small pointed ears, grey, set wide
    ear.position.set(s * 0.042, 0.06, 0.0); ear.rotation.z = -s * 0.35; ear.castShadow = true; head.add(ear);
  });
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), m.tongue);
  tongue.position.set(0, -0.04, 0.074); tongue.scale.set(0.9, 1.5, 0.35); tongue.rotation.x = 0.35; head.add(tongue);

  // four thin short-haired legs, each hinged at the top, with a little paw
  const legs = [[0.032, 0.075], [-0.032, 0.075], [0.034, -0.075], [-0.034, -0.075]].map(([x, z], i) => {
    const hip = new THREE.Group(); hip.position.set(x, 0.14, z); b.add(hip);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.013, 0.105, 8), m.bare); leg.position.y = -0.0525; leg.castShadow = true; hip.add(leg);   // (short: a Pomeranian's)
    ball(0.016, i < 2 ? m.fluff : m.bare, 0, -0.105, 0.006, hip, 1, 0.7, 1.25);
    hip.userData.front = i < 2;
    return hip;
  });

  // the tail: a thin sparse curl up over the rump
  const tail = new THREE.Group(); tail.position.set(0, 0.2, -0.1); b.add(tail);
  const curve = new THREE.CatmullRomCurve3([[0, 0, 0], [0, 0.04, -0.02], [0, 0.075, -0.0], [0, 0.085, 0.035], [0.01, 0.07, 0.055]].map(a => new THREE.Vector3(...a)));
  const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.009, 6, false), m.bare); t.castShadow = true; tail.add(t);

  return { g, b, head, legs, tail, t: Math.random() * 10, placed: false, sit: 0, line: '汪！', bubbleY: 0.42 };
}

// trot (legs swinging, a little bounce) or sit; the tail wags all the while. Sitting, he rocks back about where his front
// paws stand (so they stay planted, his front legs kept upright), down onto his haunches, his back legs folded forward
// flat along the floor, his head tipped down again to look ahead
const PAW = new THREE.Vector3(0, 0.035, 0.081), PAW_AT = new THREE.Vector3(0, 0.01, 0.081), _p = new THREE.Vector3();
const SIT = 0.6;
export function animateDog(dog, dt, moving) {
  dog.t += dt;
  dog.sit += ((moving ? 0 : 1) - dog.sit) * Math.min(1, dt * 5);
  const s = dog.sit, stride = Math.sin(dog.t * 16) * 0.6 * (1 - s), tip = -SIT * s;
  dog.legs.forEach((h, i) => {
    const sw = (i === 0 || i === 3 ? 1 : -1) * stride;
    // (angles against the floor: the front legs stay upright, the back ones swing round to lie flat forward)
    h.rotation.x = sw - tip + (h.userData.front ? 0 : -Math.PI / 2 * s);
  });
  dog.b.rotation.x = tip;
  _p.copy(PAW).applyAxisAngle(new THREE.Vector3(1, 0, 0), tip);
  dog.b.position.copy(PAW_AT).sub(_p);
  dog.b.position.y += Math.abs(Math.sin(dog.t * 16)) * 0.008 * (1 - s);
  dog.head.rotation.x = -tip * 0.85;
  dog.tail.rotation.z = Math.sin(dog.t * (moving ? 18 : 11)) * 0.45;
}
const _to = new THREE.Vector3();
// keeps at the person's feet, their left and a touch behind, trotting after them as they go
export function followDog(dog, person, dt) {
  const h = person.heading, side = 0.32, back = -0.12, p = person.g.position;
  _to.set(p.x + Math.cos(h) * side + Math.sin(h) * back, 0, p.z - Math.sin(h) * side + Math.cos(h) * back);
  _to.y = _to.z > KERB ? -RISE : inBackHall(_to.x / K, _to.z) ? -BACK_DROP : 0;   // on the floor where he is
  const g = dog.g, was = g.position.clone();
  if (!dog.placed) { g.position.copy(_to); g.rotation.y = h; dog.placed = true; }
  else g.position.lerp(_to, 1 - Math.exp(-dt * 4));
  const v = g.position.clone().sub(was); v.y = 0;
  const moving = v.length() > dt * 0.15;
  // facing the way he trots, or the way they face when he's sat
  const want = moving ? Math.atan2(v.x, v.z) : h;
  let d = want - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
  g.rotation.y += d * Math.min(1, dt * 6);
  animateDog(dog, dt, moving);
}
