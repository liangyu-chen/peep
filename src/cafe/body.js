// A person's 3D body: stylised but detailed, with a face built from the look's face options.
// Shared by the café and the back office's 捏臉 preview, so it depends only on three.js and the catalog.
import * as THREE from 'three';
import { mat, canvasTex } from './engine.js';
import { PIX } from './util.js';
import { faceOf, hairOf, hatOf } from '../content/catalog';

// ---------------------------------------------------------------- shared geometry and materials
// geometries are shared between everyone; materials stay per person since their colours differ
const GEO = new Map();
const geo = (key, make) => { let g = GEO.get(key); if (!g) { g = make(); GEO.set(key, g); } return g; };
const bx = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const sp = (r, ws = 12, hs = 10, ...part) => geo(`s${r},${ws},${hs},${part}`, () => new THREE.SphereGeometry(r, ws, hs, ...part));
const cy = (rt, rb, h, seg = 12, ...rest) => geo(`c${rt},${rb},${h},${seg},${rest}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, ...rest));
const disc = r => cy(r, r, 0.006, 18);
const lathe = (key, pts, seg = 24, ...arc) => geo(`l${key}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, ...arc));

const darkM = mat(0x161210, { roughness: 0.4 });
const whiteM = mat(0xfbfaf5, { roughness: 0.35 });
const shineM = new THREE.MeshBasicMaterial({ color: 0xffffff });
const tongueM = mat(0xd9646e, { roughness: 0.5 });
const blushM = mat(0xff8f9c, { roughness: 1, transparent: true, opacity: 0.45, depthWrite: false });
const frameM = mat(0x1b1b1b, { roughness: 0.4, metalness: 0.3 });
const lensM = mat(0xdff2ff, { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.12, depthWrite: false });
const sunLensM = mat(0x0d0d10, { roughness: 0.08, metalness: 0.6 });
const beltM = mat(0x2a2420, { roughness: 0.6 });
const buckleM = mat(0xc9b26a, { roughness: 0.3, metalness: 0.8 });
const soleM = mat(0x2b2724, { roughness: 0.9 });   // dark rubber, so it never reads as a white patch under the foot

// fine streaks multiplied over the hair colour, so hair reads as strands rather than plastic
let strandTex = null;
const strands = () => strandTex || (strandTex = (() => {
  const t = canvasTex(64, 32, g => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 32);
    for (let x = 0; x < 64; x++) { g.fillStyle = `rgba(0,0,0,${(0.05 + Math.random() * 0.22).toFixed(2)})`; g.fillRect(x, 0, 1, 32); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 1); return t;
})());

// ---------------------------------------------------------------- the head and what's built on it
const R = 0.17;
// e: how square the head is (2 = round); s: stretch; jaw: how much it narrows toward the chin
const HEADS = {
  round: { e: 2.0, s: [1, 1, 1], jaw: 0.12 },
  oval: { e: 2.0, s: [0.93, 1.07, 0.97], jaw: 0.24 },
  square: { e: 3.2, s: [0.97, 0.95, 0.95], jaw: 0.03 },
  long: { e: 2.25, s: [0.9, 1.13, 0.95], jaw: 0.16 },
};
// a unit direction -> the point on that head's surface
function deform(h, v) {
  const k = Math.pow(Math.abs(v.x) ** h.e + Math.abs(v.y) ** h.e + Math.abs(v.z) ** h.e, 1 / h.e);
  v.divideScalar(k);
  if (v.y < 0) { v.x *= 1 - h.jaw * -v.y; v.z *= 1 - h.jaw * 0.4 * -v.y; }
  return v.set(v.x * h.s[0] * R, v.y * h.s[1] * R, v.z * h.s[2] * R);
}
const headGeo = shape => geo(`head:${shape}`, () => {
  const h = HEADS[shape], g = new THREE.SphereGeometry(1, 40, 30), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { deform(h, v.fromBufferAttribute(p, i)); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
});
// a layer over the head (hair, a beard, a hat): a cap of sphere around direction `n` covering angles [from, to],
// wrapped onto the head's surface and pushed out by `thick`. Built round n, so its edge is a clean curve.
// xMax trims it to one side (a side-swept fringe).
const UP = new THREE.Vector3(0, 1, 0);
const shellGeo = (shape, thick, n, from, to, xMax = 9) => geo(`shell:${shape},${thick},${n.toArray()},${from},${to},${xMax}`, () => {
  const h = HEADS[shape], g = new THREE.SphereGeometry(1, 56, 22, 0, Math.PI * 2, from, to - from);
  const p = g.attributes.position, q = new THREE.Quaternion().setFromUnitVectors(UP, n), v = new THREE.Vector3(), u = new THREE.Vector3();
  const keep = new Uint8Array(p.count);
  for (let i = 0; i < p.count; i++) {
    u.fromBufferAttribute(p, i).applyQuaternion(q).normalize();
    keep[i] = u.x <= xMax ? 1 : 0;
    deform(h, v.copy(u)).addScaledVector(u, thick);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  if (xMax < 9) {
    const src = g.index.array, idx = [];
    for (let t = 0; t < src.length; t += 3) if (keep[src[t]] && keep[src[t + 1]] && keep[src[t + 2]]) idx.push(src[t], src[t + 1], src[t + 2]);
    g.setIndex(idx);
  }
  g.computeVertexNormals(); return g;
});
// a head of hair as one piece: from the crown down to a hairline whose height (radians above the eyes' horizon) is
// edge(φ) all the way round, φ being the angle from straight ahead toward +x; thick(φ) lets the fringe stand out
// more than the back (at the edge; it fades out toward the crown). Built on its own grid, so the hairline is a smooth curve however it's shaped.
// bump(u) adds a lumpy surface (curls) on top; it needs a much finer grid to show.
// groove(φ) cuts a parting into it, as deep at the crown end as at the front.
const capGeo = (shape, key, edge, thick, bump = null, groove = null) => geo(`cap:${shape},${key}`, () => {
  const h = HEADS[shape], NA = bump ? 180 : 160, NT = bump ? 54 : 24, pos = [], uv = [], idx = [], v = new THREE.Vector3(), u = new THREE.Vector3();
  for (let i = 0; i <= NA; i++) {
    const phi = (i / NA) * Math.PI * 2, polar = Math.PI / 2 - edge(phi), th0 = thick(0.5 * Math.PI), th1 = thick(phi);
    for (let j = 0; j <= NT; j++) {
      const p = (j / NT) * polar, th = th0 + (th1 - th0) * (j / NT) ** 1.5;   // any extra fullness grows toward the edge, so the crown stays one point
      u.set(Math.sin(p) * Math.sin(phi), Math.cos(p), Math.sin(p) * Math.cos(phi));
      const cut = groove ? groove(phi) * Math.min(1, (j / NT) * 4) : 0;   // the parting fades out only right at the crown
      deform(h, v.copy(u)).addScaledVector(u, Math.max(0.0015, th - cut) + (bump ? bump(u) * Math.min(1, (NT - j) / 3) : 0));   // bumps settle down right at the hairline
      pos.push(v.x, v.y, v.z); uv.push(i / NA * 6, j / NT);
    }
  }
  for (let i = 0; i < NA; i++) for (let j = 0; j < NT; j++) {
    const a = i * (NT + 1) + j, b = a + NT + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
});
// the scalp showing along a parting: a thin strip along angle phi0, from partway up the head down to the hairline,
// widest at the front, lying in the bottom of the parting's groove
const partGeo = (shape, phi0, p0, p1) => geo(`part:${shape},${phi0},${p0.toFixed(3)},${p1.toFixed(3)}`, () => {
  const h = HEADS[shape], N = 24, pos = [], idx = [], v = new THREE.Vector3(), u = new THREE.Vector3();
  for (let j = 0; j <= N; j++) {
    const t = j / N, p = p0 + (p1 - p0) * t, w = (0.004 + 0.012 * t) / Math.max(0.3, Math.sin(p));
    for (const s of [-1, 1]) {
      const phi = phi0 + s * w;
      u.set(Math.sin(p) * Math.sin(phi), Math.cos(p), Math.sin(p) * Math.cos(phi));
      deform(h, v.copy(u)).addScaledVector(u, 0.0022); pos.push(v.x, v.y, v.z);
    }
  }
  for (let j = 0; j < N; j++) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
});
// a hat as one piece: rings round its own crown direction n, each ring [a, thick, out, down]: a is the angle from the
// crown (the ring sits on the head there, pushed out by thick), and out / down then carry it horizontally away from the
// head and down, for a brim. Rings past the hat's edge (same a, smaller out) fold back underneath, so a brim or cuff has
// thickness, and a last ring tucks the edge back in to the hair. `rings(front)` gets 0..1 for how much that side of the
// hat faces forward, so a cap can grow its peak only at the front. The uv's u runs round the hat, v down it.
const hatGeo = (shape, key, n, rings) => geo(`hat:${shape},${key}`, () => {
  const h = HEADS[shape], NA = 96, q = new THREE.Quaternion().setFromUnitVectors(UP, n), v = new THREE.Vector3(), d = new THREE.Vector3(), e = new THREE.Vector3();
  const pos = [], uv = [], idx = [];
  let NR = 0;
  for (let i = 0; i <= NA; i++) {
    const psi = (i / NA) * Math.PI * 2;
    const ringsHere = rings(null), aEdge = ringsHere[ringsHere.length - 1][0];
    e.set(Math.sin(aEdge) * Math.sin(psi), Math.cos(aEdge), Math.sin(aEdge) * Math.cos(psi)).applyQuaternion(q);
    const front = Math.max(0, e.z / (Math.hypot(e.x, e.z) || 1)) ** 2;
    const rs = rings(front); NR = rs.length;
    rs.forEach(([a, th, out, down], j) => {
      d.set(Math.sin(a) * Math.sin(psi), Math.cos(a), Math.sin(a) * Math.cos(psi)).applyQuaternion(q);
      deform(h, v.copy(d)).addScaledVector(d, th);
      const hl = Math.hypot(d.x, d.z) || 1;
      v.x += (d.x / hl) * out; v.z += (d.z / hl) * out; v.y -= down;
      pos.push(v.x, v.y, v.z); uv.push(i / NA * 24, j / (rs.length - 1));
    });
  }
  for (let i = 0; i < NA; i++) for (let j = 0; j < NR - 1; j++) {
    const a = i * NR + j, b = a + NR;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
});
// knitted ribs for a beanie
let ribTex = null;
const ribs = () => ribTex || (ribTex = (() => {
  const t = canvasTex(32, 8, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 32, 8); for (let x = 0; x < 32; x += 4) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, 0, 1.5, 8); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})());
// curls in a hair surface, like the ringlets lower down: wavy locks running out from the crown, each waving from side
// to side and bulging where it curls; they smooth out right at the crown so they don't bunch up where they all meet
const curlLumps = amp => u => {
  const phi = Math.atan2(u.x, u.z), p = Math.acos(Math.max(-1, Math.min(1, u.y)));
  const lock = 0.5 + 0.5 * Math.sin(22 * phi + 1.6 * Math.sin(9 * p + 3 * phi));
  const curl = 0.6 + 0.4 * Math.sin(14 * p + 5 * phi);
  return amp * (0.25 + 0.75 * lock * curl) * Math.min(1, p / 0.45);
};
// a lathe whose surface is pushed out into ringlets: separate locks hanging down it, each waving from side to side and
// bulging where it curls, deeper toward the ends
// (strength(y) from 0 to 1). The profile is resampled finely first so the twists come out smooth
const ringletLathe = (key, pts, seg, phiStart, phiLen, amp, strength) => geo(`ringlet2:${key}`, () => {
  const dense = [];
  for (let k = 1; k < pts.length; k++) {
    const [r0, y0] = pts[k - 1], [r1, y1] = pts[k], n = Math.max(1, Math.ceil(Math.abs(y1 - y0) / 0.006));
    for (let i = 0; i < n; i++) dense.push([r0 + (r1 - r0) * i / n, y0 + (y1 - y0) * i / n]);
  }
  dense.push(pts[pts.length - 1]);
  const g = new THREE.LatheGeometry(dense.map(([r, y]) => new THREE.Vector2(r, y)), seg, phiStart, phiLen), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z), phi = Math.atan2(x, z);
    const lock = 0.5 + 0.5 * Math.sin(14 * phi + 1.7 * Math.sin(38 * y + 3 * phi));      // the locks, waving as they fall
    const curl = 0.6 + 0.4 * Math.sin(44 * y + 5 * phi);                                   // each one bulging where it turns
    const k = (r + amp * strength(y) * lock * curl) / (r || 1);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  g.computeVertexNormals(); return g;
});
// "tipped back by `tilt`": the crown direction leaning toward the back of the head
const crown = tilt => new THREE.Vector3(0, Math.cos(tilt), -Math.sin(tilt));
// the angle from a tipped crown that puts a shell's front edge at `elev` radians above the eyes' horizon
const coverFor = (tilt, elev) => Math.PI / 2 + tilt - elev;
// the first point straight back along -z from (x, y) in front of the face: z of the face surface there
const probe = new THREE.Raycaster(), probeO = new THREE.Vector3(), probeD = new THREE.Vector3(0, 0, -1);
const surfaceFor = shape => { const m = new THREE.Mesh(headGeo(shape), new THREE.MeshBasicMaterial()); m.updateMatrixWorld(); return (x, y) => { probe.set(probeO.set(x, y, 1), probeD); const h = probe.intersectObject(m)[0]; return h ? h.point.z : 0; }; };
const SURF = {};
// golden-angle directions over the whole sphere, used to scatter curls and spikes evenly
const fib = n => Array.from({ length: n }, (_, i) => { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996; return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); });
const FIB = fib(160);

export function buildBody(look, seed = '') {
  const f = faceOf(look, seed);
  const shape = HEADS[f.faceShape] ? f.faceShape : 'round', H = HEADS[shape];
  const g = new THREE.Group();
  const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
  const skin = mat(look.skin, { roughness: 0.62 }), skinShade = mat(shade(look.skin, 0.86), { roughness: 0.62 });
  const shirt = mat(look.shirt, { roughness: 0.85 }), shirtDark = mat(shade(look.shirt, 0.72), { roughness: 0.85 });
  const pants = mat(look.pants, { roughness: 0.9 }), pantsDark = mat(shade(look.pants, 0.78), { roughness: 0.9 });
  const hairM = mat(look.hair, { roughness: 0.85, map: strands(), side: THREE.DoubleSide });
  const shoe = mat(look.shoe || 0x1d1d1d, { roughness: 0.55 });
  const mk = (geom, m, x, y, z, par = g, shadow = true) => { const me = new THREE.Mesh(geom, m); me.position.set(x, y, z); me.castShadow = shadow; me.receiveShadow = shadow; par.add(me); return me; };

  // ---------------------------------------------------------------- legs and hips
  const bare = [];   // what shows skin when the pants come down (thighs, knees, hips)
  const bunch = [];  // the pants bunched round the shins, only seen then
  const legs = [-0.105, 0.105].map(x => {
    const hip = new THREE.Group(); hip.position.set(x, 0.55, 0); g.add(hip);
    bare.push(mk(cy(0.085, 0.074, 0.28, 14), pants, 0, -0.13, 0, hip));                        // thigh
    const knee = new THREE.Group(); knee.position.set(0, -0.27, 0); hip.add(knee);
    bare.push(mk(sp(0.074, 12, 8), pants, 0, 0, 0, knee));                                     // knee, so a bent leg stays joined
    const b = mk(cy(0.088, 0.082, 0.09, 14), pants, 0, -0.03, 0, knee, false); b.visible = false; bunch.push(b);
    mk(cy(0.07, 0.062, 0.2, 14), pants, 0, -0.1, 0, knee);                                     // shin
    mk(cy(0.068, 0.068, 0.025, 14), pantsDark, 0, -0.195, 0, knee, false);                     // turned-up hem
    mk(bx(0.125, 0.06, 0.17), shoe, 0, -0.24, 0.015, knee);                                     // shoe, with a rounded toe
    mk(sp(0.064, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), shoe, 0, -0.27, 0.1, knee).scale.set(0.98, 0.95, 1.05);
    // the sole follows the shoe's outline exactly (a block under the heel, a disc under the rounded toe), so nothing pokes out
    mk(bx(0.123, 0.016, 0.17), soleM, 0, -0.279, 0.015, knee, false);
    mk(cy(0.062, 0.062, 0.016, 16), soleM, 0, -0.279, 0.1, knee, false).scale.z = 1.05;
    return { hip, knee };
  });
  const seat = mk(cy(0.212, 0.2, 0.16, 20), pants, 0, 0.6, 0); seat.scale.z = 0.62;            // hips
  bare.push(seat);
  const belt = mk(cy(0.214, 0.214, 0.035, 22), beltM, 0, 0.675, 0, g, false); belt.scale.z = 0.63;
  mk(bx(0.045, 0.03, 0.012), buckleM, 0, 0.675, 0.136, g, false);

  // ---------------------------------------------------------------- torso: waist, chest and sloping shoulders
  const torso = mk(lathe('torso', [[0.2, 0.64], [0.205, 0.72], [0.214, 0.85], [0.226, 0.98], [0.23, 1.08], [0.222, 1.15], [0.196, 1.21], [0.14, 1.25], [0.075, 1.268], [0, 1.27]], 28), shirt, 0, 0, 0);
  torso.scale.z = 0.64;
  mk(cy(0.204, 0.204, 0.03, 24), shirtDark, 0, 0.655, 0, g, false).scale.z = 0.645;            // shirt hem
  [-1, 1].forEach(s => mk(sp(0.06, 12, 10), shirt, s * 0.245, 1.185, 0).scale.set(0.95, 0.72, 0.85));   // shoulder caps over the arm joint
  const collar = mk(cy(0.085, 0.1, 0.04, 18), shirtDark, 0, 1.262, 0, g, false); collar.scale.z = 0.82;
  if (look.number) {
    const t = canvasTex(32, 32, (c) => { c.fillStyle = '#fff'; c.font = `16px ${PIX}`; c.textAlign = 'center'; c.fillText(look.number, 16, 24); }, true);
    const numM = new THREE.MeshBasicMaterial({ map: t, transparent: true });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.19), numM); front.position.set(0, 0.98, 0.147); g.add(front);
    const back = front.clone(); back.position.z = -0.147; back.rotation.y = Math.PI; back.scale.setScalar(1.3); g.add(back);
  }
  if (look.apron) mk(bx(0.38, 0.6, 0.02), mat(look.apron), 0, 0.8, 0.15);
  mk(cy(0.052, 0.062, 0.12, 12), skin, 0, 1.3, -0.005);                                       // neck

  // ---------------------------------------------------------------- head
  const head = new THREE.Group(); head.position.set(0, 1.43, 0); g.add(head);
  mk(headGeo(shape), skin, 0, 0, 0, head);
  const surf = SURF[shape] || (SURF[shape] = surfaceFor(shape));
  const at = (x, y, z) => deform(H, new THREE.Vector3(x, y, z).normalize());   // surface point in a direction
  // ears, sitting on the side of whatever head shape it is
  [-1, 1].forEach(s => {
    const p = at(s, -0.04, 0.02);
    mk(sp(0.042, 12, 10), skin, p.x + s * 0.004, p.y, p.z, head).scale.set(0.42, 1, 0.72);
    mk(sp(0.022, 8, 6), skinShade, p.x + s * 0.016, p.y, p.z + 0.004, head, false).scale.set(0.3, 0.75, 0.55);
  });
  const face = new THREE.Group(); head.add(face);
  const fm = (geom, m, x, y, z, par = face) => mk(geom, m, x, y, z, par, false);

  buildHair(hairOf(look), shape, head, hairM, mk, at, look);

  // eyes: each in its own group so it can blink
  const EX = 0.062 * H.s[0], EY = 0.025;
  const iris = mat(f.eyeColor, { roughness: 0.3 });
  const eyes = [-1, 1].map(s => {
    const e = new THREE.Group(); e.position.set(s * EX, EY, surf(s * EX, EY) - 0.004); face.add(e);
    const sclera = r => { fm(disc(r), whiteM, 0, 0, 0.002, e).rotation.x = Math.PI / 2; };
    const lid = w => fm(bx(w, 0.008, 0.01), darkM, 0, w * 0.4, 0.008, e);                     // upper lash line
    switch (f.eyes) {
      case 'dot': fm(sp(0.021, 10, 8), darkM, 0, 0, 0.004, e); fm(sp(0.005, 6, 4), shineM, s * 0.006, 0.007, 0.022, e); break;
      case 'big':
        sclera(0.042); fm(sp(0.027, 14, 10), iris, 0, -0.002, 0.004, e); fm(sp(0.014, 10, 8), darkM, 0, -0.002, 0.016, e);
        fm(sp(0.007, 6, 4), shineM, s * 0.009, 0.01, 0.025, e); fm(sp(0.004, 6, 4), shineM, -s * 0.008, -0.01, 0.024, e); lid(0.084); break;
      case 'sleepy':
        sclera(0.031); fm(sp(0.019, 10, 8), iris, 0, -0.004, 0.004, e); fm(sp(0.01, 8, 6), darkM, 0, -0.004, 0.012, e);
        fm(bx(0.072, 0.034, 0.03), skin, 0, 0.017, 0.012, e); fm(bx(0.068, 0.007, 0.012), darkM, 0, 0.0, 0.026, e); break;
      case 'smile': [-1, 1].forEach(k => { fm(bx(0.032, 0.009, 0.01), darkM, k * 0.012, 0.004, 0.006, e).rotation.z = -k * 0.55; }); break;
      case 'narrow': fm(bx(0.05, 0.01, 0.01), darkM, 0, 0, 0.006, e).rotation.z = -s * 0.08; break;
      default:   // round
        sclera(0.031); fm(sp(0.019, 12, 10), iris, 0, 0, 0.004, e); fm(sp(0.01, 8, 6), darkM, 0, 0, 0.012, e);
        fm(sp(0.005, 6, 4), shineM, s * 0.007, 0.008, 0.019, e); lid(0.064);
    }
    return e;
  });
  // brows
  if (f.brows !== 'none') {
    const [w, h] = f.brows === 'thick' || f.brows === 'angry' ? [0.068, 0.02] : [0.06, 0.011];
    const tilt = { angry: 0.32, worried: -0.3, thick: 0.04, thin: -0.06 }[f.brows] || 0;
    [-1, 1].forEach(s => { fm(bx(w, h, 0.014), hairM, s * EX, 0.074, surf(s * EX, 0.074) + 0.004).rotation.z = s * tilt; });
  }
  // nose: soft rounded shapes, a shade darker than the face
  const NY = -0.024, nz = surf(0, NY);
  ({
    small: () => fm(sp(0.018, 10, 8), skinShade, 0, NY, nz + 0.002).scale.set(1, 1.3, 1),
    normal: () => { fm(sp(0.022, 12, 10), skinShade, 0, NY - 0.004, nz + 0.004).scale.set(0.9, 1.5, 1.15); fm(bx(0.016, 0.04, 0.02), skinShade, 0, NY + 0.022, nz - 0.004); },
    big: () => { fm(sp(0.03, 12, 10), skinShade, 0, NY - 0.006, nz + 0.008).scale.set(1, 1.35, 1.25); [-1, 1].forEach(s => fm(sp(0.012, 8, 6), skinShade, s * 0.022, NY - 0.02, nz + 0.002)); },
    button: () => fm(sp(0.026, 12, 10), skinShade, 0, NY - 0.008, nz + 0.002),
  }[f.nose] || (() => {}))();
  // beard first: the mouth sits on top of it
  // how dense the facial hair is: light is see-through and a little smaller, thick is fuller
  const BD = { light: { k: 0.8, a: 0.5, stub: 0.2 }, normal: { k: 1, a: 1, stub: 0.35 }, thick: { k: 1.3, a: 1, stub: 0.6 } }[f.beard] || { k: 1, a: 1, stub: 0.35 };
  const beardM = BD.a < 1 ? mat(look.hair, { roughness: 0.9, transparent: true, opacity: BD.a, depthWrite: false }) : hairM;
  const beardThick = f.facialHair === 'full' ? 0.014 * BD.k : f.facialHair === 'stubble' ? 0.002 : 0;
  if (beardThick) {
    const m = f.facialHair === 'full' ? beardM : mat(look.hair, { roughness: 1, transparent: true, opacity: BD.stub, depthWrite: false });
    const n = new THREE.Vector3(0, -0.9, 0.44).normalize();   // from just under the nose, round the jaw
    mk(shellGeo(shape, beardThick, n, 0, f.facialHair === 'full' ? 0.9 : 0.85), m, 0, 0, 0, head, false);
  }
  // mouth: a group so it can move while talking
  const MY = -0.082;
  const mouth = new THREE.Group(); mouth.position.set(0, MY, surf(0, MY) + (beardThick > 0.01 ? beardThick + 0.002 : -0.001)); face.add(mouth);
  ({
    smile: () => { fm(bx(0.038, 0.01, 0.006), darkM, 0, 0, 0, mouth); [-1, 1].forEach(k => { fm(bx(0.016, 0.01, 0.006), darkM, k * 0.025, 0.005, -0.002, mouth).rotation.z = k * 0.55; }); },
    grin: () => { fm(bx(0.064, 0.028, 0.006), darkM, 0, 0, 0, mouth); fm(bx(0.056, 0.012, 0.012), whiteM, 0, 0.005, 0.002, mouth); },
    smirk: () => { fm(bx(0.042, 0.01, 0.006), darkM, 0.006, 0, 0, mouth).rotation.z = 0.2; fm(bx(0.014, 0.01, 0.006), darkM, 0.03, 0.008, -0.002, mouth).rotation.z = 0.7; },
    flat: () => fm(bx(0.046, 0.01, 0.006), darkM, 0, 0, 0, mouth),
    open: () => { fm(bx(0.044, 0.032, 0.012), darkM, 0, -0.004, 0, mouth); fm(bx(0.03, 0.01, 0.006), tongueM, 0, -0.013, 0.005, mouth); },
  }[f.mouth] || (() => fm(bx(0.038, 0.01, 0.006), darkM, 0, 0, 0, mouth)))();
  if (f.blush) [-1, 1].forEach(s => { const x = s * 0.1 * H.s[0]; fm(disc(0.026), blushM, x, -0.038, surf(x, -0.038) - 0.002).rotation.set(Math.PI / 2, 0, -s * 0.6); });
  // moustache and goatee
  if (['mustache', 'both', 'full'].includes(f.facialHair)) {
    const z = surf(0, -0.056) + beardThick;
    fm(bx(0.1, 0.022 * BD.k, 0.03), beardM, 0, -0.056, z + 0.004);
    [-1, 1].forEach(s => fm(bx(0.02 * BD.k, 0.035 * BD.k, 0.024), beardM, s * 0.052, -0.07, surf(s * 0.052, -0.07) + beardThick + 0.002));
  }
  if (f.facialHair === 'goatee' || f.facialHair === 'both') fm(bx(0.05 * BD.k, 0.055 * BD.k, 0.04), beardM, 0, -0.128, surf(0, -0.128) - 0.004);
  // glasses
  if (f.glasses !== 'none') {
    const gy = EY + 0.002, gz = Math.max(surf(EX, EY), surf(0, NY) - 0.01) + 0.03;
    const earX = at(1, 0.02, 0).x - 0.004;
    [-1, 1].forEach(s => {
      const cx = s * EX;
      if (f.glasses === 'round') {
        const ring = new THREE.Mesh(geo('torus', () => new THREE.TorusGeometry(0.037, 0.006, 8, 20)), frameM); ring.position.set(cx, gy, gz); face.add(ring);
        fm(disc(0.034), lensM, cx, gy, gz).rotation.x = Math.PI / 2;
      } else {
        const w = 0.078, h = f.glasses === 'sun' ? 0.05 : 0.054, t = 0.008;
        fm(bx(w, t, t), frameM, cx, gy + h / 2, gz); fm(bx(w, t, t), frameM, cx, gy - h / 2, gz);
        fm(bx(t, h, t), frameM, cx - w / 2, gy, gz); fm(bx(t, h, t), frameM, cx + w / 2, gy, gz);
        fm(bx(w, h, 0.003), f.glasses === 'sun' ? sunLensM : lensM, cx, gy, gz);
      }
      const outer = EX + (f.glasses === 'round' ? 0.037 : 0.039);
      fm(bx(earX - outer + 0.006, 0.007, 0.007), frameM, s * (outer + earX) / 2, gy + 0.004, gz);   // hinge out to the side of the head
      fm(bx(0.006, 0.006, gz), frameM, s * earX, gy + 0.004, gz / 2);                              // temple arm back to the ear
    });
    fm(bx(0.03, 0.007, 0.007), frameM, 0, gy + 0.012, gz);                                          // bridge
  }

  // ---------------------------------------------------------------- arms: shoulder -> elbow -> hand
  const elbows = [];
  const arms = [-0.28, 0.28].map(x => {
    const s = Math.sign(x);
    const sh = new THREE.Group(); sh.position.set(x, 1.19, 0); g.add(sh);
    const sleeveM = look.longSleeve ? shirt : skin;
    mk(cy(0.058, 0.052, 0.27, 12), sleeveM, 0, -0.135, 0, sh);                                     // upper arm
    if (!look.longSleeve) { mk(cy(0.07, 0.065, 0.16, 12), shirt, 0, -0.07, 0, sh); mk(cy(0.067, 0.067, 0.02, 12), shirtDark, 0, -0.15, 0, sh, false); }
    const elbow = new THREE.Group(); elbow.position.set(0, -0.27, 0); sh.add(elbow); elbows.push(elbow);
    mk(sp(0.053, 10, 8), sleeveM, 0, 0, 0, elbow);
    mk(cy(0.051, 0.044, 0.24, 12), sleeveM, 0, -0.12, 0, elbow);                                   // forearm
    if (look.longSleeve) mk(cy(0.05, 0.05, 0.03, 12), shirtDark, 0, -0.225, 0, elbow, false);      // cuff
    mk(sp(0.052, 12, 10), skin, 0, -0.285, 0.004, elbow).scale.set(0.82, 1.12, 0.68);              // hand
    mk(bx(0.024, 0.048, 0.028), skin, -s * 0.04, -0.27, 0.022, elbow, false).rotation.z = s * 0.45;   // thumb
    return sh;
  });
  const hand = new THREE.Object3D(); hand.position.set(0, -0.3, 0.05); elbows[1].add(hand);
  const handL = new THREE.Object3D(); handL.position.set(0.01, -0.3, 0.04); elbows[0].add(handL);   // holds a cigarette
  const pad = new THREE.Group();
  mk(bx(0.2, 0.045, 0.1), mat(0x1b1b1b, { roughness: 0.4 }), 0, 0, 0, pad);
  [-1, 1].forEach(s => mk(sp(0.035, 10, 8), mat(0x1b1b1b, { roughness: 0.4 }), s * 0.085, -0.015, -0.022, pad, false));   // grips
  mk(bx(0.04, 0.012, 0.03), mat(0x3ddc97), 0.05, 0.026, 0, pad, false);
  [-1, 1].forEach(s => mk(cy(0.012, 0.012, 0.012, 8), mat(0x333333), s * 0.03, 0.026, 0.012, pad, false));         // sticks
  pad.position.set(0, 0.95, 0.43); pad.visible = false; g.add(pad);
  return { g, legs, arms, elbows, head, hand, handL, pad, eyes, mouth, skinM: skin, strip: { bare, bunch, pants, skin } };
}

// hats, each a shell round its own tipped crown down to a front edge `elev` above the eyes; own is the hat's own thickness
const HATS = { cap: { tilt: 0.25, elev: 0.4, own: 0.012 }, bucket: { tilt: 0.1, elev: 0.5, own: 0.014 }, beanie: { tilt: 0.35, elev: 0.45, own: 0.016 } };
// the top of the head for each way the front can go: the hairline (radians above the eyes' horizon) all the way round,
// and how full it stands, both by φ, the angle from straight ahead; lift is how far it stands off the head at most
const line = phi => -0.16 + 0.66 * Math.cos(phi);                          // just above the brows, past the temples, down the nape
const lobe = (phi, at0, p) => Math.max(0, Math.cos(phi - at0)) ** p;      // a bump centred on angle at0
const ang = phi => Math.atan2(Math.sin(phi), Math.cos(phi));               // -π..π, 0 straight ahead
const FRONTS = {
  // no fringe: combed back off the forehead, the hairline well up so the forehead shows
  none: { edge: phi => line(phi) + 0.26 * lobe(phi, 0, 2), thick: () => 0.012, lift: 0.012 },
  // a fringe: down to the brows and cut almost straight across, standing out full over the forehead
  bangs: { edge: phi => line(phi) + (0.4 - line(phi)) * lobe(phi, 0, 4), thick: phi => 0.012 + 0.014 * lobe(phi, 0, 1.5), lift: 0.026 },
  // parted in the middle: the hairline lifts at the centre of the forehead and the hair falls away to both sides,
  // fuller over the temples, with a shallow parting line running back from the front
  center: {
    edge: phi => line(phi) + 0.12 * lobe(phi, 0, 8) - 0.05 * (lobe(phi, 0.55, 6) + lobe(phi, -0.55, 6)),
    thick: phi => 0.014 + 0.008 * (lobe(phi, 0.6, 3) + lobe(phi, -0.6, 3)), lift: 0.022,
    part: 0, groove: phi => 0.012 * Math.exp(-((ang(phi) / 0.05) ** 2)),
  },
  // parted on one side: a clear parting over one eye, the hair swept over from it, low and full over the other brow,
  // short and close on the parting's side, with a notch in the hairline where the parting meets it
  side: {
    edge: phi => line(phi) - 0.18 * lobe(phi, -0.5, 3) + 0.06 * lobe(phi, 0.75, 3) + 0.1 * Math.exp(-(((ang(phi) - 0.45) / 0.06) ** 2)),
    thick: phi => 0.012 + 0.02 * lobe(phi, -0.4, 2), lift: 0.03,
    part: 0.45, groove: phi => 0.03 * Math.exp(-(((ang(phi) - 0.45) / 0.045) ** 2)),
  },
};
const CURL_TOP = 0.018;     // how far curls stand out of the top of the head
// the hair hanging round the back and sides for each length, as a profile below the widest part of the head (w, y0)
const LENGTHS = {
  medium: (w, y0) => [[w + 0.004, y0 - 0.07], [w + 0.01, y0 - 0.15], [w + 0.016, y0 - 0.22], [w + 0.018, y0 - 0.26], [w + 0.006, y0 - 0.285], [w - 0.008, y0 - 0.29]],   // to the shoulders, ends turned under
  long: (w, y0) => [[w + 0.004, y0 - 0.08], [w + 0.012, y0 - 0.19], [w + 0.026, y0 - 0.29], [w + 0.008, y0 - 0.33]],
};
const CURLY_LENGTHS = {   // curls take up more room: fuller, and fullest toward the ends
  medium: (w, y0) => [[w + 0.01, y0 - 0.06], [w + 0.02, y0 - 0.13], [w + 0.03, y0 - 0.2], [w + 0.034, y0 - 0.25], [w + 0.02, y0 - 0.28], [w + 0.004, y0 - 0.29]],
  long: (w, y0) => [[w + 0.012, y0 - 0.06], [w + 0.02, y0 - 0.13], [w + 0.03, y0 - 0.2], [w + 0.038, y0 - 0.27], [w + 0.042, y0 - 0.33], [w + 0.028, y0 - 0.37], [w + 0.006, y0 - 0.38]],
};

// the hair first, built from its parts (length, straight / curly / spiky, the front, tied up or not), then the hat
// (if any) put on over it, made bigger by however far the hair stands off the head so nothing pokes through it
function buildHair(hairParts, shape, head, hairM, mk, at, look) {
  const { length, curl, front, tie } = hairParts;
  const TILT = 0.66;                                    // the old tipped crown, still used to spread spikes

  // the hat this person wears, worked out first so the hair can keep out from under it
  const { hat: hatStyle, color: hatColor } = hatOf(look);
  const H = HATS[hatStyle];
  const hatN = H ? crown(H.tilt) : null, hatA = H ? coverFor(H.tilt, H.elev) : 0;
  const underHat = (u, margin) => !!H && Math.acos(Math.max(-1, Math.min(1, u.dot(hatN)))) < hatA + margin;
  const hatBack = H ? Math.PI / 2 - hatA - H.tilt : 9;  // the height (radians) of the hat's edge straight behind
  const backAt = e => at(0, Math.sin(e), -Math.cos(e)); // the point at height e straight behind
  // spread small pieces evenly over the part of the head the hair covers, skipping any a hat would sit on
  const scatter = (limit, margin, place) => FIB.forEach(u => {
    const a = Math.acos(u.dot(crown(TILT)));
    if (a < limit && !underHat(u, margin)) place(u, at(u.x, u.y, u.z));
  });
  // a curtain round the back and sides, open at the face; its top follows the head's own outline right up to the
  // crown, lying just over the cap, so the back of the head is one surface. tail(w, y0) gives the profile below;
  // `curls` turns it into ringlets, starting a little below the crown and deepening toward the ends
  const curtain = (key, tail, curls = 0) => {
    const prof = [];
    for (let k = 0; k <= 6; k++) {
      const t = 0.12 + k * (1.55 - 0.12) / 6, ps = at(Math.sin(t), Math.cos(t), 0), pb = at(0, Math.cos(t), -Math.sin(t));
      prof.push([Math.max(ps.x, -pb.z) + 0.0135 + 0.005 * (k / 6), (ps.y + pb.y) / 2]);
    }
    const [w, y0] = prof[prof.length - 1];
    prof.push(...tail(w, y0));
    if (!curls) mk(lathe(`curtain:${shape}:${key}`, prof, 32, 0.85, Math.PI * 2 - 1.7), hairM, 0, 0, 0, head);
    else {
      const top = prof[3][1], bottom = prof[prof.length - 1][1];
      mk(ringletLathe(`${shape}:${key}`, prof, 120, 0.85, Math.PI * 2 - 1.7, curls, y => Math.max(0, Math.min(1, (top - y) / (top - bottom) * 1.6))), hairM, 0, 0, 0, head);
    }
  };

  let lift = 0;
  if (length === 'buzz') {
    mk(shellGeo(shape, 0.004, crown(0.5), 0, coverFor(0.5, 0.55)), hairM, 0, 0, 0, head); lift = 0.004;
  } else if (length !== 'bald') {
    // the top of the head: shaped by the front, with curls in its surface if it's curly
    const F = FRONTS[front] || FRONTS.none, curly = curl === 'curly';
    const amp = length === 'short' ? 0.02 : CURL_TOP;
    mk(capGeo(shape, `${front}${curly ? `:waves${amp}` : ''}`, F.edge, F.thick, curly ? curlLumps(amp) : null, F.groove), hairM, 0, 0, 0, head);
    if (F.part != null && !curly) {                     // the scalp showing along the parting
      const reach = Math.PI / 2 - F.edge(F.part);
      mk(partGeo(shape, F.part, reach * 0.3, reach - 0.01), mat(look.skin, { roughness: 0.7 }), 0, 0, 0, head, false);
    }
    lift = F.lift + (curly ? 0.02 : 0);
    if (curl === 'spiky') {
      scatter(1.0, 0.4, (u, p) => {                     // spikes stick out a long way, so keep them well clear of a hat's edge and brim
        const s = mk(cy(0, 0.04, 0.11, 6), hairM, p.x + u.x * 0.05, p.y + u.y * 0.05, p.z + u.z * 0.05, head);
        s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), u);
      });
    }
    // what hangs below: left loose to its length, or pulled back and tied
    const long = length === 'medium' || length === 'long';
    if (tie === 'bun' && long) {
      // up on the crown, or, under a hat, a low bun below its edge at the back
      const e = H ? Math.min(0.86, hatBack - 0.3) : 0.86, p = backAt(e), out = new THREE.Vector3(0, Math.sin(e), -Math.cos(e));
      mk(sp(curly ? 0.085 : 0.075, 14, 12), hairM, p.x + out.x * 0.05, p.y + out.y * 0.05, p.z + out.z * 0.05, head);
    } else if (tie === 'ponytail' && long) {
      const p = backAt(H ? Math.min(0.15, hatBack - 0.22) : 0.15), L = length === 'long' ? 1 : 0.7, R = curly ? 1.25 : 1;
      mk(cy(0.038, 0.038, 0.03, 12), mat(0xff4f7b), p.x, p.y, p.z - 0.012, head).rotation.x = Math.PI / 2;
      const tail = mk(lathe(`tail:${L}:${R}`, [[0.001, 0.02], [0.04 * R, 0], [0.05 * R, -0.08 * L], [0.035 * R, -0.2 * L], [0.012 * R, -0.28 * L], [0, -0.29 * L]], 14), hairM, p.x, p.y - 0.01, p.z - 0.04, head);
      tail.rotation.x = 0.35;
    } else if (long) {
      curtain(`${length}${curly ? ':curly' : ''}`, (curly ? CURLY_LENGTHS : LENGTHS)[length], curly ? 0.022 : 0);
    }
  }

  if (!H) return;
  // the hat, made bigger by however far this hairstyle stands off the head, so it sits on the hair, not through it.
  // Each is one piece: crown, brim or cuff and the edge tucked back in to the hair, with no seams between parts
  const T = lift + H.own, A = hatA, tuck = [A + 0.03, lift + 0.002, 0, 0];
  const steps = (n, f) => Array.from({ length: n }, (_, k) => f(k / (n - 1)));
  if (hatStyle === 'cap') {
    // a six-panel cap: rounded crown, and a peak at the front only, curving down a little, with an underside
    const capM = mat(hatColor, { roughness: 0.8, side: THREE.DoubleSide });
    mk(hatGeo(shape, `cap:${T.toFixed(3)}`, hatN, fr => [
      ...steps(10, t => [t * (A - 0.02), T, 0, 0]),
      [A, T, 0, 0],
      [A, T, 0.04 * (fr || 0), 0.006 * (fr || 0)], [A, T, 0.09 * (fr || 0), 0.016 * (fr || 0)], [A, T, 0.125 * (fr || 0), 0.028 * (fr || 0)],
      [A, T - 0.008, 0.125 * (fr || 0), 0.032 * (fr || 0)], [A, T - 0.008, 0.08 * (fr || 0), 0.02 * (fr || 0)], [A, T - 0.008, 0.01 * (fr || 0), 0.006 * (fr || 0)],
      tuck,
    ]), capM, 0, 0, 0, head);
    const top = at(0, 1, -0.25), up = new THREE.Vector3(0, 1, -0.25).normalize();
    mk(sp(0.014, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capM, top.x + up.x * T, top.y + up.y * T - 0.002, top.z + up.z * T, head);   // the button, sitting on the crown
  } else if (hatStyle === 'bucket') {
    // a bucket hat: soft crown, the brim turning out and down all the way round, with an underside and a rolled edge
    const capM = mat(hatColor, { roughness: 0.9, side: THREE.DoubleSide });
    mk(hatGeo(shape, `bucket:${T.toFixed(3)}`, hatN, () => [
      ...steps(10, t => [t * A, T, 0, 0]),
      [A, T, 0.012, 0.004], [A, T, 0.032, 0.014], [A, T, 0.052, 0.028], [A, T - 0.002, 0.06, 0.036],
      [A, T - 0.008, 0.056, 0.038], [A, T - 0.008, 0.03, 0.02], [A, T - 0.008, 0.006, 0.006],
      tuck,
    ]), capM, 0, 0, 0, head);
  } else {
    // a beanie: knitted, the crown rising to a soft point, the cuff rolled up thick at the bottom
    const bm = new THREE.MeshStandardMaterial({ color: new THREE.Color(hatColor), map: ribs(), roughness: 1, side: THREE.DoubleSide });
    mk(hatGeo(shape, `beanie2:${T.toFixed(3)}`, hatN, () => [
      [0, T + 0.01, 0, 0], ...steps(9, t => [0.08 + t * (A - 0.34), T + 0.004 * (1 - t), 0, 0]),
      [A - 0.22, T + 0.002, 0, 0], [A - 0.18, T + 0.007, 0, 0], [A - 0.1, T + 0.009, 0, 0], [A - 0.03, T + 0.008, 0, 0], [A, T + 0.003, 0, 0.002],   // the cuff, hugging the head
      tuck,
    ]), bm, 0, 0, 0, head);
    const top = at(0, 1, -0.35), up = new THREE.Vector3(0, 1, -0.35).normalize();
    mk(sp(0.03, 10, 8), bm, top.x + up.x * (T + 0.03), top.y + up.y * (T + 0.03), top.z + up.z * (T + 0.03), head);   // the pompom, sunk into the crown
  }
}

// blinking now and then, and the mouth moving while a speech bubble is up; st keeps the timers
export function tickFace(body, st, dt, talking) {
  st.blinkT = (st.blinkT ?? 2) - dt;
  if (st.blinkT <= 0) { st.blinkT = 2 + Math.random() * 3.5; st.blinkDur = 0.13; }
  const closed = st.blinkDur > 0; if (closed) st.blinkDur -= dt;
  body.eyes.forEach(e => { e.scale.y = closed ? 0.12 : 1; });
  st.talkPhase = (st.talkPhase ?? 0) + dt * 16;
  body.mouth.scale.y = talking ? 1 + Math.abs(Math.sin(st.talkPhase)) * 1.6 : 1;
}
