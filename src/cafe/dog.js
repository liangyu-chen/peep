// 夜叉丸: a little Pomeranian who goes about at their feet (a 配件 picked in the back office). He has alopecia: only his
// head (with the ruff round his neck) and a patch over his back keep the full fluffy coat, cream going apricot; the
// rest of him is short sparse fur over skin that goes pinker toward his rump, his tail a thin curl over it. Small
// grey-tipped ears, black button eyes and nose, his pink tongue out, short little legs. While they walk he trots after
// them along the way they came; the rest of the time he potters about the shop on his own.
import * as THREE from 'three';
import { mat, ctx } from './engine.js';
import { picked } from './body.js';
import { S } from './state.js';
import { K } from './util.js';
import { KERB, RISE, BACK_DROP, inBackHall } from './layout.js';

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
function fuzzGeo(r, seed, amp = 0.22) {
  const k = `${r}:${seed}:${amp}`;
  if (FUZZ.has(k)) return FUZZ.get(k);
  const g = new THREE.SphereGeometry(r, 18, 14), p = g.attributes.position;
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const v = new THREE.Vector3(), seen = new Map();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;   // (the seam's twin points pushed alike, so it stays closed)
    if (!seen.has(key)) seen.set(key, 1 + (rnd() - 0.4) * amp);
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

  return { g, b, head, legs, tail, t: Math.random() * 10, placed: false, sit: 0, name: '夜叉丸', line: '汪！', bubbleY: 0.32, trail: [], spot: null };
}

// 柯基: a Pembroke corgi. A long low loaf of a body on very short legs, red-tan over the back and sides with white
// underneath (chest, belly, the fluffy seat of his "pants"), white paws; a fox face, tan with a white blaze up the middle
// and a white muzzle, big upright ears pink inside, his tongue out and his head tipped to one side; a little stub of a
// tail. Goes about just as 夜叉丸 does (the same trot, sit and following).
let CM = null;
const corgiMats = () => CM || (CM = {
  body: mat(0xffffff, { roughness: 0.95, vertexColors: true }),
  tan: mat(picked(0xc99a62), { roughness: 0.95 }),        // a light golden fawn
  tail: mat(0xffffff, { roughness: 0.95, vertexColors: true }),   // fawn going paler to its tip
  white: mat(picked(0xf6f0e6), { roughness: 0.95 }),
  earIn: mat(picked(0xe9a9a6), { roughness: 0.9 }),
  dark: mat(0x141214, { roughness: 0.35 }),
  shine: mat(0xffffff, { roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.4 }),
  tongue: mat(picked(0xe0647e), { roughness: 0.5 }),
});
const C_LEG = 0.05, C_HIP = C_LEG + 0.011;
const C_LEG_AT = [[0.036, 0.088], [-0.036, 0.088], [0.038, -0.086], [-0.038, -0.086]];
let corgiBodyGeo = null;
function corgiBody() {
  if (corgiBodyGeo) return corgiBodyGeo;
  const g = new THREE.SphereGeometry(1, 28, 20), p = g.attributes.position, col = [];
  const tan = new THREE.Color(picked(0xc99a62)), white = new THREE.Color(picked(0xf6f0e6)), c = new THREE.Color();
  const saddle = new THREE.Color(picked(0xa97c4a));   // a shade darker down the back, where the coat's tips are
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // a loaf: long, flat-ish on top, the ends rounded off (fuller at the chest, a round seat behind)
    const f = 1 + 0.06 * z;
    let X = x * 0.068 * f, Y = y * 0.062 * f, Z = z * 0.136;    if (y < 0) C_LEG_AT.forEach(([lx, lz]) => {   // (drawn down over each leg's top, so the legs grow out of him)
      const w = Math.exp(-((X - lx) ** 2 + (Z - lz) ** 2) / 0.026 ** 2) * Math.min(1, -y * 1.6);
      Y -= 0.022 * w; X += (lx - X) * 0.4 * w; Z += (lz - Z) * 0.4 * w;
    });
    p.setXYZ(i, X, Y, Z);
    // white underneath and up the chest, tan over the back and sides
    // (the chest the coat's colour too, but for a narrow white bib down its middle)
    // (the white underneath isn't a level line: it rises toward the chest and up round the haunches, lower along the
    // belly between, its edge softly wavering)
    const edge = -0.32 + 0.24 * smooth(0.25, 0.85, z) + 0.18 * smooth(-0.35, -0.85, z) + 0.09 * Math.sin(z * 8 + 1.3) + 0.04 * Math.sin(z * 21 + x * 3);
    const under = smooth(edge + 0.16, edge - 0.18, y), chest =smooth(0.6, 0.9, z) * smooth(0.25, -0.2, y) * smooth(0.45, 0.15, Math.abs(x));
    // (and the white "pants" round the back of his seat, coloured on, not a ball stuck on)
    const pants = smooth(-0.55, -0.9, z) * smooth(0.35, -0.1, y);
    c.copy(tan).lerp(saddle, smooth(0.35 + 0.12 * Math.sin(z * 6 + 0.4), 0.9, y) * 0.8).lerp(white, Math.min(1, under + chest + pants)); col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals(); return (corgiBodyGeo = g);
}
// his head: fawn, with the white blaze painted on it (narrow between the eyes, widening down to the muzzle), so it lies
// perfectly flat rather than being a piece stuck on
let corgiHeadGeo = null;
function corgiHead() {
  if (corgiHeadGeo) return corgiHeadGeo;
  const g = new THREE.SphereGeometry(0.052, 24, 18), p = g.attributes.position, col = [];
  const tan = new THREE.Color(picked(0xc99a62)), white = new THREE.Color(picked(0xf6f0e6)), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / 0.052, y = p.getY(i) / 0.052, z = p.getZ(i) / 0.052;
    const half = 0.07 + 0.16 * smooth(0.75, -0.3, y);   // the stripe's half-width: narrow up top, wider low on the face
    const w = smooth(half + 0.05, half, Math.abs(x)) * smooth(0.35, 0.6, z) * smooth(0.95, 0.8, y);
    c.copy(tan).lerp(white, w); col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return (corgiHeadGeo = g);
}
// an ear: broad at the base (which sits down inside the head), narrowing to a rounded tip
let earG = null;
const earGeo = () => earG || (earG = new THREE.LatheGeometry([[0.0001, -0.02], [0.03, -0.012], [0.032, 0.008], [0.026, 0.032], [0.017, 0.052], [0.009, 0.063], [0.0001, 0.067]].map(([r, y]) => new THREE.Vector2(r, y)), 16));
let corgiLegGeo = null;
const corgiLeg = () => corgiLegGeo || (corgiLegGeo = new THREE.LatheGeometry([[0.0001, -C_LEG], [0.014, -C_LEG + 0.004], [0.016, -C_LEG * 0.5], [0.019, -C_LEG * 0.1], [0.02, 0.012], [0.0001, 0.03]].map(([r, y]) => new THREE.Vector2(r, y)), 12));

export function makeCorgi() {
  const m = corgiMats();
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b); g.scale.setScalar(1.25);
  const body = new THREE.Mesh(corgiBody(), m.body); body.position.set(0, C_HIP + 0.03, 0); body.castShadow = true; b.add(body);
  // the fluffy white seat at the back and the ruff of his chest (fawn, a white bib down it): soft, only lightly tufted,
  // and sunk well into the body, each over the body's own matching colour; the seat kept in close to his rump
  const soft = (r, seed, mm, x, y, z, sx, sy, sz) => { const me = new THREE.Mesh(fuzzGeo(r, seed, 0.08), mm); me.position.set(x, y, z); me.scale.set(sx, sy, sz); me.castShadow = true; b.add(me); return me; };
  soft(0.05, 11, m.white, 0, C_HIP + 0.02, -0.098, 1.2, 0.85, 0.58);
  soft(0.052, 13, m.tan, 0, C_HIP + 0.042, 0.104, 1.08, 1.05, 0.62);
  soft(0.026, 14, m.white, 0, C_HIP + 0.03, 0.132, 0.85, 1.4, 0.55);

  // the head: tan, a long white muzzle, a white blaze up the middle, white cheeks; tipped to one side
  const head = new THREE.Group(); head.position.set(0, C_HIP + 0.105, 0.142); b.add(head);
  const skull = new THREE.Group(); skull.rotation.z = 0.28; head.add(skull);
  { const hm = new THREE.Mesh(corgiHead(), m.body); hm.scale.set(1.05, 0.95, 1); hm.castShadow = true; skull.add(hm); }   // (the blaze painted on)
  ball(0.03, m.white, 0, -0.02, 0.045, skull, 0.95, 0.7, 1.15);                   // muzzle
  [-1, 1].forEach(s => ball(0.026, m.white, s * 0.022, -0.022, 0.025, skull, 1, 0.85, 1));   // cheeks
  ball(0.009, m.dark, 0, -0.012, 0.079, skull, 1.25, 0.95, 0.8);                   // nose
  [-1, 1].forEach(s => {
    ball(0.0085, m.dark, s * 0.024, 0.01, 0.042, skull, 1, 1, 0.6);                // eyes, set into the face
    ball(0.0025, m.shine, s * 0.024 + 0.003, 0.014, 0.0465, skull);
    // big upright ears, set wide and leaning out, tan outside and pink in: a rounded triangle (not a sharp cone), their
    // broad bases sunk into the head so they grow out of it
    const ear = new THREE.Group(); ear.position.set(s * 0.03, 0.03, -0.004); ear.rotation.set(-0.15, 0, -s * 0.38); skull.add(ear);
    const outer = new THREE.Mesh(earGeo(), m.tan); outer.scale.set(1, 1, 0.42); outer.castShadow = true; ear.add(outer);
    const inner = new THREE.Mesh(earGeo(), m.earIn); inner.position.set(0, 0.008, 0.007); inner.scale.set(0.68, 0.78, 0.3); ear.add(inner);
  });
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), m.tongue);
  tongue.position.set(0.004, -0.04, 0.062); tongue.scale.set(0.95, 1.6, 0.35); tongue.rotation.x = 0.35; skull.add(tongue);

  // four very short legs, white paws
  const legs = C_LEG_AT.map(([x, z], i) => {
    const front = i < 2, hip = new THREE.Group(); hip.position.set(x, C_HIP, z); b.add(hip);
    const leg = new THREE.Mesh(corgiLeg(), front ? m.white : m.tan); leg.castShadow = true; hip.add(leg);
    ball(0.017, m.white, 0, -C_LEG, 0.005, hip, 1, 0.7, 1.25);
    hip.userData.front = front;
    return hip;
  });
  // his tail: long and bushy, carried up off his seat and curling forward over his back, thick at the root (sunk into
  // him) and tapering, its fur tufted along it, paler toward the tip
  const tail = new THREE.Group(); tail.position.set(0, C_HIP + 0.05, -0.118); b.add(tail);
  const curve = new THREE.CatmullRomCurve3([[0, -0.01, 0.012], [0, 0.02, -0.022], [0, 0.065, -0.036], [0, 0.105, -0.022], [0, 0.124, 0.008], [0, 0.118, 0.04]].map(a => new THREE.Vector3(...a)));
  // (one bushy piece: the tube's surface tufted, each point pushed out or in a little at random, and fullest in its
  // middle, rounding off at the tip; not a string of fluff balls)
  const SEG = 26, SIDES = 11;
  const tg = taperedTube(curve, 0.018, 0.008, SEG, SIDES), tp = tg.attributes.position, tc = [];
  const fawn = new THREE.Color(picked(0xc99a62)), pale = new THREE.Color(picked(0xf0e4cf)), cc = new THREE.Color(), ctr = new THREE.Vector3(), tv = new THREE.Vector3();
  let sd = 4242; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG; curve.getPointAt(u, ctr);
    const bulge = (1 + 0.15 * Math.sin(Math.PI * Math.min(1, u * 1.15))) * (u > 0.92 ? 1 - (u - 0.92) * 8 : 1);
    const ring = []; for (let j = 0; j < SIDES; j++) ring.push(1 + (rnd() - 0.45) * 0.08);   // (just a hint of fur, smooth)
    for (let j = 0; j <= SIDES; j++) {
      const k = i * (SIDES + 1) + j, f = bulge * ring[j % SIDES];   // (the ring's seam pushed alike, so it stays closed)
      tv.fromBufferAttribute(tp, k).sub(ctr).multiplyScalar(f).add(ctr); tp.setXYZ(k, tv.x, tv.y, tv.z);
      cc.copy(fawn).lerp(pale, smooth(0.6, 1, u)); tc.push(cc.r, cc.g, cc.b);
    }
  }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3)); tg.computeVertexNormals();
  const tm = new THREE.Mesh(tg, m.tail); tm.castShadow = true; tail.add(tm);

  return { g, b, head, legs, tail, paw: new THREE.Vector3(0, 0.011, 0.093), t: Math.random() * 10, placed: false, sit: 0, name: '柯基', line: '汪！', bubbleY: 0.4, trail: [], spot: null };
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
  const paw = dog.paw || PAW;   // (where his front paws stand: further forward on a long dog)
  dog.b.position.copy(paw).sub(_p.copy(paw).applyAxisAngle(X, tip));
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
// where he goes: only in the shop itself and out on its raised front, never into the back (past the sliding door: the
// corridor, the toilet, the storeroom), nor further out than the step by the door until they're leaving
const BACK_Z = -4.45;   // the sliding door's line, in the room as it stands
const DOOR_Z = 5.2;
const leaving = person => person.status === '準備離開';
const allowed = (z, person) => z > BACK_Z + 0.05 && (z < DOOR_Z || leaving(person));
// while they aren't walking he wanders about the shop on his own: off to a spot somewhere in the room (on the floor, not
// behind the bar, nothing standing there and nothing in the way on the way there), a sniff about, a sit, then on again
const ROOM = { x0: -2.55, x1: 2.6, z0: -4.1, z1: 4.3 }, BAR = { x0: -0.45, x1: 2.35, z0: -2.3, z1: 2.85 };   // plan coordinates
function wanderTo(dog) {
  const from = dog.g.position;
  for (let i = 0; i < 14; i++) {
    const px = ROOM.x0 + Math.random() * (ROOM.x1 - ROOM.x0), pz = ROOM.z0 + Math.random() * (ROOM.z1 - ROOM.z0);
    if (px > BAR.x0 && px < BAR.x1 && pz > BAR.z0 && pz < BAR.z1) continue;
    const x = px * K, z = pz;
    if (Math.hypot(x - from.x, z - from.z) < 0.6 || occupied(x, z, 0) || blocked(from.x, from.z, x, z, 0)) continue;
    return new THREE.Vector3(x, 0, z);
  }
  return null;
}
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
// walking: he trots a little way behind them along the very way they walked (so wherever they could go, so can he), as
// far as he's allowed; otherwise he's off about the shop on his own
export function followDog(dog, person, dt) {
  const p = person.g.position, walking = person.path && person.path.length > 0;
  const last = dog.trail[dog.trail.length - 1];
  if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.05) { dog.trail.push(new THREE.Vector3(p.x, 0, p.z)); if (dog.trail.length > 40) dog.trail.shift(); }
  watchDoor(dog, person);
  const g = dog.g;
  let at = null;
  if (walking) {
    let need = 0.42; at = dog.trail[0] || p;   // 0.42 m back along the trail
    for (let i = dog.trail.length - 1, prev = p; i >= 0; i--) {
      const q = dog.trail[i], d = Math.hypot(q.x - prev.x, q.z - prev.z);
      if (d >= need) { at = new THREE.Vector3().lerpVectors(prev, q, need / d); break; }
      need -= d; prev = q; at = q;
    }
    if (!allowed(at.z, person)) at = null;   // (somewhere he doesn't go: he carries on about the shop instead)
  }
  let speed = 1.8;
  if (at) { _to.set(at.x, floorAt(at.x, at.z), at.z); dog.wander = null; }
  else {
    // wandering: walk to the spot, rest there a while, pick another
    // (just stopped following: a moment's rest where he is, unless that's somewhere cramped, by a chair say: then straight off)
    const w = dog.wander || (dog.wander = { to: null, rest: occupied(g.position.x, g.position.z, g.position.y) ? 0 : 1 + Math.random() * 3 });
    if (!w.to || !allowed(w.to.z, person)) { w.rest -= dt; if (w.rest <= 0) { w.to = wanderTo(dog); w.rest = 3 + Math.random() * 6; if (!w.to) w.rest = 1; } }
    else if (Math.hypot(w.to.x - g.position.x, w.to.z - g.position.z) < 0.03) w.to = null;   // there: a rest, then off again
    _to.copy(w.to || g.position); speed = 0.65;   // (a pottering walk, not a run)
  }
  const was = g.position.clone();
  if (!dog.placed) { g.position.copy(_to); g.rotation.y = person.heading; dog.placed = true; }
  else {
    // trots there: easing in when close, never faster than he goes (so going off to catch them up he runs over rather
    // than jumping)
    const dx = _to.x - g.position.x, dz = _to.z - g.position.z, dist = Math.hypot(dx, dz);
    const step = Math.min(dist, Math.min(speed, dist * 4) * dt);
    if (dist > 1e-4) { g.position.x += dx / dist * step; g.position.z += dz / dist * step; }
  }
  g.position.y = floorAt(g.position.x, g.position.z);
  const v = g.position.clone().sub(was); v.y = 0;
  const moving = v.length() > dt * 0.12;
  if (moving) { const want = Math.atan2(v.x, v.z); let d = want - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * Math.min(1, dt * 6); }
  animateDog(dog, dt, moving);
}