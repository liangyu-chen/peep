// 夜叉丸: a little Pomeranian who goes about at their feet (a 配件 picked in the back office). He has alopecia: only his
// head (with the ruff round his neck) and a patch over his back keep the full fluffy coat, cream going apricot; the
// rest of him is short sparse fur over skin that goes pinker toward his rump, his tail a thin curl over it. Small
// grey-tipped ears, black button eyes and nose, his pink tongue out, short little legs. He trots after them along the
// way they came, and when they stop he sits at a free spot beside them (never inside a wall, a table or a chair).
import * as THREE from 'three';
import { mat, ctx } from './engine.js';
import { picked } from './body.js';
import { S } from './state.js';
import { K } from './util.js';
import { KERB, RISE, BACK_DROP, inBackHall, TVX, TVZ } from './layout.js';

const SIZE = 0.85;   // the whole dog, as built below, scaled down to a toy Pomeranian's size

let M = null;
const mats = () => M || (M = {
  fluff: mat(picked(0xf0d9b8), { roughness: 1 }),        // the full coat, cream
  apricot: mat(picked(0xe9c79a), { roughness: 1 }),      // warmer over the back
  bare: mat(picked(0xe6cfc6), { roughness: 0.9 }),       // short fur over pink skin
  // the legs (and the shoulders and haunches they grow from) in the body's own colour where they join it, front and back,
  // so nothing looks stuck on
  legF: mat(picked(0xe9d5cc), { roughness: 0.9 }), legR: mat(picked(0xdab8b4), { roughness: 0.9 }),
  body: mat(0xffffff, { roughness: 0.9, vertexColors: true }),   // the body: that, going pinker to the rump
  ear: mat(picked(0x8c8580), { roughness: 0.95 }),
  dark: mat(0x141214, { roughness: 0.35 }),
  shine: mat(0xffffff, { roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.4 }),
  tongue: mat(picked(0xe0647e), { roughness: 0.5 }),
});
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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
// the body: one smooth egg, fuller at the chest, rounding off small at the rump (no separate rump ball), its short fur
// going from cream-pink at the chest to the barest pink at the back
let bodyGeo = null;
// where the legs' tops are, in the body's own frame (it sits HIP_Y + 0.034 up and 0.005 forward)
const LEG_AT = [[0.03, 0.068], [-0.03, 0.068], [0.032, -0.062], [-0.032, -0.062]];
const LEG_TOPS = LEG_AT.map(([x, z]) => [x, z - 0.005]);
function eggGeo() {
  if (bodyGeo) return bodyGeo;
  const g = new THREE.SphereGeometry(1, 24, 18), p = g.attributes.position, col = [];
  const front = new THREE.Color(picked(0xe9d5cc)), rear = new THREE.Color(picked(0xdab8b4)), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 1 + 0.1 * z;   // fuller forward, smaller behind
    let X = x * 0.056 * f, Y = y * 0.052 * f + 0.006 * z, Z = z * 0.098;
    // over each leg, the underside drawn down into a soft tapering cone that the leg comes out of
    if (y < 0) LEG_TOPS.forEach(([lx, lz]) => {
      const w = Math.exp(-((X - lx) ** 2 + (Z - lz) ** 2) / 0.022 ** 2) * Math.min(1, -y * 1.6);
      Y -= 0.03 * w; X += (lx - X) * 0.45 * w; Z += (lz - Z) * 0.45 * w;
    });
    p.setXYZ(i, X, Y, Z);
    c.copy(front).lerp(rear, smooth(0.25, -0.45, z)); col.push(c.r, c.g, c.b);   // (front colour over the front legs' tops, rear over the back's)
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals(); return (bodyGeo = g);
}
// a leg: slim, a touch thicker up top; its top is sheathed by the body drawn down over it (eggGeo), so it grows out of
// the body rather than being stuck on
const LEG = 0.06;   // short little legs
let legGeo = null;
const legShape = () => legGeo || (legGeo = new THREE.LatheGeometry([[0.0001, -LEG], [0.012, -LEG + 0.004], [0.0135, -LEG * 0.55], [0.016, -LEG * 0.15], [0.0165, 0.012], [0.0001, 0.03]].map(([r, y]) => new THREE.Vector2(r, y)), 12));

// a tube along a curve narrowing from r0 at its start to r1 at its end (a tail to a point)
function taperedTube(curve, r0, r1, segs = 18, sides = 7) {
  const g = new THREE.TubeGeometry(curve, segs, 1, sides, false), p = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, r = r0 + (r1 - r0) * Math.pow(u, 0.8); curve.getPointAt(u, c);
    for (let j = 0; j <= sides; j++) { const k = i * (sides + 1) + j; v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c); p.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals(); return g;
}
const ball = (r, m, x, y, z, parent, sx = 1, sy = 1, sz = 1) => { const me = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m); me.position.set(x, y, z); me.scale.set(sx, sy, sz); me.castShadow = true; parent.add(me); return me; };
const fuzz = (r, seed, m, x, y, z, parent, sx = 1, sy = 1, sz = 1) => { const me = new THREE.Mesh(fuzzGeo(r, seed), m); me.position.set(x, y, z); me.scale.set(sx, sy, sz); me.castShadow = true; parent.add(me); return me; };

const HIP_Y = LEG + 0.011;   // the legs' tops, so the paws (a ball 0.011 high) stand on the floor
export function makeDog() {
  const m = mats();
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b); g.scale.setScalar(SIZE);   // b: the body, rocked back when he sits

  const body = new THREE.Mesh(eggGeo(), m.body); body.position.set(0, HIP_Y + 0.034, 0.005); body.castShadow = true; b.add(body);
  // the patch of full coat left over his back, and the big ruff round his neck and chest
  fuzz(0.05, 3, m.apricot, 0, HIP_Y + 0.072, -0.005, b, 1.05, 0.5, 1.2);
  fuzz(0.066, 5, m.fluff, 0, HIP_Y + 0.078, 0.072, b, 1.05, 1.05, 0.9);

  // the head: one big fluffy ball, a small muzzle, button eyes and nose, tongue out
  const head = new THREE.Group(); head.position.set(0, HIP_Y + 0.14, 0.108); b.add(head);
  fuzz(0.066, 7, m.fluff, 0, 0, 0, head);
  ball(0.024, m.fluff, 0, -0.017, 0.057, head, 1.15, 0.85, 0.9);
  ball(0.008, m.dark, 0, -0.008, 0.079, head, 1.2, 0.9, 0.8);                    // nose
  [-1, 1].forEach(s => {
    ball(0.009, m.dark, s * 0.024, 0.011, 0.057, head);                          // eyes
    ball(0.0026, m.shine, s * 0.024 + 0.003, 0.015, 0.065, head);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.031, 8), m.ear);  // small pointed ears, grey, set wide
    ear.position.set(s * 0.039, 0.055, 0.0); ear.rotation.z = -s * 0.35; ear.castShadow = true; head.add(ear);
  });
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), m.tongue);
  tongue.position.set(0, -0.037, 0.068); tongue.scale.set(0.9, 1.5, 0.35); tongue.rotation.x = 0.35; head.add(tongue);

  // four short legs, each hinged at the top, with a little paw
  const legs = LEG_AT.map(([x, z], i) => {
    const front = i < 2, hip = new THREE.Group(); hip.position.set(x, HIP_Y, z); b.add(hip);
    const legM = front ? m.legF : m.legR;
    const leg = new THREE.Mesh(legShape(), legM); leg.castShadow = true; hip.add(leg);
    ball(0.015, front ? m.fluff : legM, 0, -LEG, 0.005, hip, 1, 0.72, 1.25);
    hip.userData.front = front;
    return hip;
  });

  // the tail: a thin sparse curl up over the rump, growing out of it (its root sunk into the body), thick at the root and
  // tapering to a fine point
  const tail = new THREE.Group(); tail.position.set(0, HIP_Y + 0.05, -0.068); b.add(tail);
  const curve = new THREE.CatmullRomCurve3([[0, -0.006, 0.01], [0, 0.01, -0.02], [0, 0.036, -0.032], [0, 0.056, -0.016], [0, 0.06, 0.008], [0.006, 0.05, 0.022]].map(a => new THREE.Vector3(...a)));   // (short)
  const t = new THREE.Mesh(taperedTube(curve, 0.012, 0.0015), m.legR); t.castShadow = true; tail.add(t);

  return { g, b, head, legs, tail, t: Math.random() * 10, placed: false, sit: 0, line: '汪！', bubbleY: 0.32, trail: [], spot: null };
}

// trot (legs swinging, a little bounce) or sit; the tail wags all the while. Sitting, he rocks back about where his front
// paws stand (so they stay planted, his front legs kept upright), down onto his haunches, his back legs folded forward
// flat along the floor, his head tipped down again to look ahead
const PAW = new THREE.Vector3(0, 0.011, 0.073), X = new THREE.Vector3(1, 0, 0), _p = new THREE.Vector3();
const SIT = 0.4;   // (how far back he rocks to sit: down onto his haunches on such short legs)
export function animateDog(dog, dt, moving) {
  dog.t += dt;
  dog.sit += ((moving ? 0 : 1) - dog.sit) * Math.min(1, dt * 5);
  const s = dog.sit, stride = Math.sin(dog.t * 17) * 0.55 * (1 - s), tip = -SIT * s;
  dog.legs.forEach((h, i) => {
    const sw = (i === 0 || i === 3 ? 1 : -1) * stride;
    // (angles against the floor: the front legs stay upright, the back ones swing round to lie flat forward)
    h.rotation.x = sw - tip + (h.userData.front ? 0 : -Math.PI / 2 * s);
  });
  dog.b.rotation.x = tip;
  dog.b.position.copy(PAW).sub(_p.copy(PAW).applyAxisAngle(X, tip));
  dog.b.position.y += Math.abs(Math.sin(dog.t * 17)) * 0.007 * (1 - s);
  dog.head.rotation.x = -tip * 0.85;
  dog.tail.rotation.z = Math.sin(dog.t * (moving ? 18 : 11)) * 0.45;
}

// ---------------------------------------------------------------- going about with them
const floorAt = (x, z) => (z > KERB ? -RISE : inBackHall(x / K, z) ? -BACK_DROP : 0);
// what he mustn't end up inside: everything standing in the room, but not people, their companions or the floor
let SOLID = null;
function solids() {
  if (SOLID) return SOLID;
  const skip = new Set();
  (S.people || []).forEach(p => { p.g.traverse(o => skip.add(o)); p.bear?.g.traverse(o => skip.add(o)); });
  SOLID = [];
  ctx.scene.traverse(o => { if (o.isMesh && o.visible && !skip.has(o) && !o.userData.blob) SOLID.push(o); });
  return SOLID;
}
const ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
// whether a straight line from (x0, z0) to (x1, z1), at the height of his body, runs into anything
function blocked(x0, z0, x1, z1, y) {
  _o.set(x0, y + 0.12, z0); _d.set(x1 - x0, 0, z1 - z0);
  const len = _d.length(); if (len < 1e-4) return false;
  ray.set(_o, _d.normalize()); ray.far = len + 0.1;   // (room for himself past the spot)
  const people = new Set();
  (S.people || []).forEach(p => p.g.traverse(o => people.add(o)));
  // (anything right where they are is what they're sitting on, not in his way)
  return ray.intersectObjects(solids(), false).some(h => !people.has(h.object) && h.distance > 0.12);
}
// whether anything stands in the spot itself (a low block, a chair's seat or legs, a step), from just over his head down
const _down = new THREE.Vector3(0, -1, 0);
function occupied(x, z, y) {
  for (const [ox, oz] of [[0, 0], [0.05, 0], [-0.05, 0], [0, 0.07], [0, -0.07]]) {
    // (looked down on from well above him: anything there up to half a metre high, an overhang included, like the
    // beanbag's rolled arms, is in his way; a table top higher up isn't, he can sit under a table)
    ray.set(_o.set(x + ox, y + 0.6, z + oz), _down); ray.far = 0.58;
    if (ray.intersectObjects(solids(), false).some(h => h.point.y - y < 0.5)) return true;
  }
  return false;
}
// a spot to sit by them: their left, then right, behind, in front, then a little further out; the first with nothing
// between them and it and nothing standing in it. If all
// are blocked, back where they last walked from
const SPOTS = [[0.3, -0.08], [-0.3, -0.08], [0, -0.32], [0.24, 0.24], [-0.24, 0.24], [0.42, -0.25], [-0.42, -0.25], [0, -0.5]];
function pickSpot(dog, person) {
  const h = person.heading, p = person.g.position, y = floorAt(p.x, p.z);
  const ok = (x, z) => z > BACK_Z + 0.05 && (z < DOOR_Z || leaving(person)) && Math.abs(floorAt(x, z) - y) < 0.01 && !blocked(p.x, p.z, x, z, y) && !occupied(x, z, y);
  for (const [side, fwd] of SPOTS) {
    const x = p.x + Math.cos(h) * side + Math.sin(h) * fwd, z = p.z - Math.sin(h) * side + Math.cos(h) * fwd;
    if (ok(x, z)) return new THREE.Vector3(x, floorAt(x, z), z);
  }
  // none of those: rings further out round them, the nearest free spot (wedged in by a beanbag's arms, say)
  for (const r of [0.35, 0.5, 0.7, 0.9]) for (let i = 0; i < 12; i++) {
    const a = h + i / 12 * Math.PI * 2, x = p.x + Math.cos(a) * r, z = p.z - Math.sin(a) * r;
    if (ok(x, z)) return new THREE.Vector3(x, floorAt(x, z), z);
  }
  const back = dog.trail[Math.max(0, dog.trail.length - 4)] || p;
  return new THREE.Vector3(back.x, floorAt(back.x, back.z), back.z);
}

// he doesn't go into the back (past the sliding door: the corridor, the toilet, the storeroom). While they're back there he
// waits by the TV, sat at the first free one of a few spots round it, facing it, until they come out again
const BACK_Z = -4.45;   // the sliding door's line, in the room as it stands
const WAIT = [[-2.15, -2.45], [-2.2, -3.85], [-1.95, -2.35], [-2.35, -2.3], [-1.9, -3.9]];   // plan coordinates
function waitSpot() {
  for (const [x, z] of WAIT) if (!occupied(x * K, z, 0)) return new THREE.Vector3(x * K, 0, z);
  return new THREE.Vector3(WAIT[0][0] * K, 0, WAIT[0][1]);
}
// nor, until they're leaving, out past the raised front by the door (no further than DOOR_Z): while they're out at the
// arcade seats, by the scooters or on the street, he waits on the step by the door, sat at the first free spot there
const DOOR_Z = 5.2;
const DOOR_WAIT = [[-1.15, 4.95], [-2.25, 4.95], [-0.5, 5.0], [-1.75, 4.7]];   // plan coordinates
function doorSpot() {
  for (const [x, z] of DOOR_WAIT) if (!occupied(x * K, z, 0)) return new THREE.Vector3(x * K, 0, z);
  return new THREE.Vector3(DOOR_WAIT[0][0] * K, 0, DOOR_WAIT[0][1]);
}
const leaving = person => person.status === '準備離開';
// someone coming up onto the shop's front from the street, or stepping down off it to go: he barks at them
function watchDoor(dog, person) {
  const seen = dog.seen || (dog.seen = new Map());
  (S.people || []).forEach(o => {
    if (o === person || o === S.owner) return;
    const inside = o.g.position.z < KERB, was = seen.get(o);
    if (was !== undefined && was !== inside) person.bearSay('汪汪！', 1.6);
    seen.set(o, inside);
  });
}
const _to = new THREE.Vector3();
// trotting: a little way behind them along the very way they walked (so wherever they could go, so can he); stopped:
// sat at a free spot beside them, picked once each time they settle
export function followDog(dog, person, dt) {
  const p = person.g.position, walking = person.path && person.path.length > 0;
  const last = dog.trail[dog.trail.length - 1];
  if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.05) { dog.trail.push(new THREE.Vector3(p.x, 0, p.z)); if (dog.trail.length > 40) dog.trail.shift(); }
  // (where along the trail is he heading: if that's past the sliding door too, he stops short and waits)
  watchDoor(dog, person);
  const inBack = p.z < BACK_Z, outFront = p.z > DOOR_Z && !leaving(person);
  if (inBack || outFront) {
    const kind = inBack ? 'tv' : 'door';
    if (!dog.waiting || dog.waitKind !== kind) { dog.waiting = inBack ? waitSpot() : doorSpot(); dog.waitKind = kind; dog.spot = null; }
    _to.copy(dog.waiting);
  } else if (walking) {
    dog.waiting = null;
    dog.spot = null;
    let need = 0.42, at = dog.trail[0] || p;   // 0.42 m back along the trail
    for (let i = dog.trail.length - 1, prev = p; i >= 0; i--) {
      const q = dog.trail[i], d = Math.hypot(q.x - prev.x, q.z - prev.z);
      if (d >= need) { at = new THREE.Vector3().lerpVectors(prev, q, need / d); break; }
      need -= d; prev = q; at = q;
    }
    if (at.z < BACK_Z || (at.z > DOOR_Z && !leaving(person))) _to.copy(dog.g.position);   // (just back from the back or the front: he waits where he is until they've come clear)
    else _to.set(at.x, floorAt(at.x, at.z), at.z);
  } else {
    dog.waiting = null;
    if (!dog.spot || Math.hypot(dog.spotFor.x - p.x, dog.spotFor.z - p.z) > 0.1) { dog.spot = pickSpot(dog, person); dog.spotFor = p.clone(); }
    _to.copy(dog.spot);
  }
  const g = dog.g, was = g.position.clone();
  if (!dog.placed) { g.position.copy(_to); g.rotation.y = person.heading; dog.placed = true; }
  else {
    // trots there: easing in when close, but never faster than a little dog runs (so coming away from the TV or the door
    // to catch them up, he runs over rather than jumping)
    const dx = _to.x - g.position.x, dz = _to.z - g.position.z, dist = Math.hypot(dx, dz);
    const step = Math.min(dist, Math.min(1.8, dist * 4) * dt);
    if (dist > 1e-4) { g.position.x += dx / dist * step; g.position.z += dz / dist * step; }
  }
  g.position.y = floorAt(g.position.x, g.position.z);
  const v = g.position.clone().sub(was); v.y = 0;
  const moving = v.length() > dt * 0.12;
  // facing the way he trots, or the way they face when he's sat
  const want = moving ? Math.atan2(v.x, v.z) : dog.waiting ? (dog.waitKind === 'tv' ? Math.atan2(TVX * K - g.position.x, TVZ - g.position.z) : Math.atan2(p.x - g.position.x, p.z - g.position.z)) : person.heading;   // (waiting: watching the TV, or out the door for them)
  let d = want - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
  g.rotation.y += d * Math.min(1, dt * 6);
  animateDog(dog, dt, moving);
}
