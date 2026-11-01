// A person's 3D body: stylised but detailed, with a face built from the look's face options.
// Shared by the café and the back office's 捏臉 preview, so it depends only on three.js and the catalog.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, canvasTex } from './engine.js';
import { PIX } from './util.js';
import { faceOf, hairOf, hatOf, clothesOf } from '../content/catalog';

// how much longer the legs are than first drawn: the hips sit this much higher (people.js lowers sitting and squatting to match)
export const LEG_EXTRA = 0.08;

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
  // strands with some depth: clumps a shade darker in their gaps, a few catching the light, darker toward the roots
  const t = canvasTex(64, 32, g => {
    g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 64, 32);
    for (let x = 0; x < 64; x++) {
      const clump = 0.5 + 0.5 * Math.sin(x / 64 * Math.PI * 2 * 7 + Math.sin(x * 0.7) * 0.8);
      g.fillStyle = clump > 0.8 && Math.random() < 0.6 ? `rgba(255,255,255,${(0.5 + Math.random() * 0.5).toFixed(2)})` : `rgba(0,0,0,${(0.04 + (1 - clump) * 0.28 + Math.random() * 0.1).toFixed(2)})`;
      g.fillRect(x, 0, 1, 32);
    }
    const root = g.createLinearGradient(0, 0, 0, 32); root.addColorStop(0, 'rgba(0,0,0,.18)'); root.addColorStop(0.4, 'rgba(0,0,0,0)');
    g.fillStyle = root; g.fillRect(0, 0, 64, 32);
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
// flow(φ, t) (t 0 at the crown, 1 at the hairline) sets which way the strands run, as the texture's u: they follow lines
// where it stays the same, so hair can fall away from a parting at an angle instead of straight down from the crown.
// It's cut in layers: from a little below the crown, LAYER_DEPTH-deep tiers, each swelling gently to its lower edge and
// easing back in under the next (no sharp step, so no break line), the tiers' edges wandering a little round the head
// so they don't read as rings.
const LAYER_DEPTH = 0.0035;
const tier = s => { const f = s - Math.floor(s); return f < 0.72 ? 0.5 - 0.5 * Math.cos(Math.PI * f / 0.72) : 0.5 + 0.5 * Math.cos(Math.PI * (f - 0.72) / 0.28); };
// (fading out round the back, where longer hair hangs over it, so it never pokes through that and leaves a seam)
const layerAt = (phi, t) => LAYER_DEPTH * tier(t * 3.3 + 0.1 * Math.sin(3 * phi)) * Math.min(1, Math.max(0, (t - 0.15) / 0.15))
  * Math.min(1, Math.max(0, (2.1 - Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi)))) / 0.6));
const capGeo = (shape, key, edge, thick, bump = null, groove = null, flow = null) => geo(`cap7:${shape},${key}`, () => {
  const h = HEADS[shape], NA = groove ? 320 : bump ? 180 : 160, NT = bump ? 54 : 60, pos = [], uv = [], idx = [], v = new THREE.Vector3(), u = new THREE.Vector3();
  // with a parting, curls lie flat along it (a band about twice the crease's width), so the line reads clean between them
  let gmax = 0; if (groove) for (let i = 0; i < 720; i++) gmax = Math.max(gmax, groove(i / 720 * Math.PI * 2));
  const calm = phi => (groove && gmax ? 1 - (groove(phi) / gmax) ** 0.12 : 1);
  for (let i = 0; i <= NA; i++) {
    const phi = (i / NA) * Math.PI * 2, polar = Math.PI / 2 - edge(phi), th0 = thick(0.5 * Math.PI), th1 = thick(phi), still = calm(phi);
    for (let j = 0; j <= NT; j++) {
      const p = (j / NT) * polar, th = th0 + (th1 - th0) * (j / NT) ** 1.5;   // any extra fullness grows toward the edge, so the crown stays one point
      u.set(Math.sin(p) * Math.sin(phi), Math.cos(p), Math.sin(p) * Math.cos(phi));
      const cut = groove ? groove(phi) * Math.min(1, (j / NT) * 4) * (bump ? 0.5 : 1) : 0;   // the parting fades out only right at the crown (shallower in curls)
      deform(h, v.copy(u)).addScaledVector(u, Math.max(0.0015, th - cut) + layerAt(phi, j / NT) + (bump ? bump(u) * still * Math.min(1, (NT - j) / 3) : 0));   // bumps settle down right at the hairline
      pos.push(v.x, v.y, v.z); uv.push(flow ? flow(phi, j / NT) : i / NA * 6, j / NT);
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
// a sneaker, shaped from a sphere: long, wider at the toe than the heel, flat underneath, the toe lifted a little.
// The sole is the same outline, a touch bigger, as a thin flat slab under it. Units are local to the shoe's centre.
const SHOE = { w: 0.062, h: 0.052, l: 0.128, fwd: 0.035, flat: -0.016 };
const shoeShape = (x, y, z) => {
  const t = z;                                                            // -1 at the heel, 1 at the toe
  const X = x * SHOE.w * (1 + 0.14 * Math.max(0, t) - 0.08 * Math.max(0, -t));
  const Z = t * SHOE.l + SHOE.fwd;
  let Y = y * SHOE.h * (1 - 0.35 * Math.max(0, t) ** 2);                  // lower over the toes
  Y = Math.max(SHOE.flat, Y) + 0.012 * Math.max(0, t) ** 3;               // flat under the foot, the toe turned up
  return [X, Y, Z];
};
const shoeGeo = sole => geo(`shoe:${sole}`, () => {
  const g = new THREE.SphereGeometry(1, 28, 18), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (!sole) { const [X, Y, Z] = shoeShape(x, y, z); p.setXYZ(i, X, Y, Z); }
    else { const [X, , Z] = shoeShape(x * 1.04, 0, z * 1.03); p.setXYZ(i, X, (y > 0 ? SHOE.flat + 0.004 : SHOE.flat - 0.012) + 0.012 * Math.max(0, z) ** 3, Z); }
  }
  g.computeVertexNormals(); return g;
});
// the height of the top of the shoe above its centre, a distance z forward (for laying the laces on it)
const shoeTop = z => SHOE.h * Math.sqrt(Math.max(0, 1 - ((z - SHOE.fwd) / SHOE.l) ** 2)) * (1 - 0.35 * Math.max(0, (z - SHOE.fwd) / SHOE.l) ** 2);
const laceM = mat(0xeeeeea, { roughness: 0.7 });
// the torso: slices up the body, each an oval [y, half-width, half-depth]; it narrows a little to the waist, widens to
// the shoulders and then slopes up to the neck in one curve
// (the shoulders kept fairly narrow, so nobody looks built broader than they are)
const TORSO = [[0.71, 0.202, 0.15], [0.76, 0.2, 0.148], [0.84, 0.197, 0.146], [0.94, 0.198, 0.146], [1.02, 0.204, 0.146], [1.07, 0.216, 0.145],
  [1.11, 0.236, 0.142], [1.145, 0.252, 0.136], [1.175, 0.252, 0.126], [1.2, 0.234, 0.112], [1.225, 0.192, 0.095], [1.245, 0.138, 0.077], [1.26, 0.083, 0.06], [1.27, 0, 0]];
// how a top is cut: the body wider (`w`) and deeper (`d`) than regular below the shoulders, fading back to the same neck;
// `drop` lets the hem hang lower over the hips; the sleeves `s` times as wide, short ones `len` long
// `sh` lets a little cloth drape over the tops of the arms; the dropped shoulder itself is the sleeve, its seam lower
const TOP_FITS = {
  slim: { w: 0.95, d: 0.96, drop: 0, s: 0.92, len: 0.14, sh: 0 },
  regular: { w: 1, d: 1, drop: 0, s: 1, len: 0.16, sh: 0 },
  oversize: { w: 1.08, d: 1.1, drop: 0.07, s: 1.35, len: 0.29, sh: 0.012, seam: -0.1 },   // the person stays the same build: only the cloth is roomier
};
const torsoGeo = (fit = 'regular') => geo(`torso11:${fit}`, () => {
  const F = TOP_FITS[fit] || TOP_FITS.regular, N = 40, pos = [], idx = [];
  const rows = (F.drop ? [[TORSO[0][0] - F.drop, TORSO[0][1], TORSO[0][2]]] : []).concat(TORSO).map(([y, rx, rz]) => {
    const k = Math.max(0, Math.min(1, (1.25 - y) / 0.15));   // full below the shoulders, none at the neck
    return [y, rx * (1 + (F.w - 1) * k) + F.sh * Math.exp(-(((y - 1.15) / 0.055) ** 2)), rz * (1 + (F.d - 1) * k)];
  });
  rows.forEach(([y, rx, rz]) => { for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2; pos.push(Math.sin(a) * rx, y, Math.cos(a) * rz); } });
  for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < N; i++) { const a = r * (N + 1) + i, b = a + N + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
});
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
// (strength(y) from 0 to 1). The profile is resampled finely first so the twists come out smooth. `phase` sets the locks
// off differently (for a second layer under the first); `jag` lets the locks end at different lengths, up or down by
// that much, so the ends aren't cut in a straight line. `inner` carries on the profile back up the inside, against the
// head, closing the hair into one solid mass; it's left smooth
const ringletLathe = (key, pts, seg, phiStart, phiLen, amp, strength, phase = 0, jag = 0, inner = []) => geo(`ringlet5:${key}`, () => {
  const dense = [];
  for (let k = 1; k < pts.length; k++) {
    const [r0, y0] = pts[k - 1], [r1, y1] = pts[k], n = Math.max(1, Math.ceil(Math.abs(y1 - y0) / 0.006));
    for (let i = 0; i < n; i++) dense.push([r0 + (r1 - r0) * i / n, y0 + (y1 - y0) * i / n]);
  }
  dense.push(pts[pts.length - 1]);
  const outer = dense.length; dense.push(...inner);
  const g = new THREE.LatheGeometry(dense.map(([r, y]) => new THREE.Vector2(r, y)), seg, phiStart, phiLen), p = g.attributes.position;
  const yEnd = dense[outer - 1][1];
  for (let i = 0; i < p.count; i++) {
    if (i % dense.length >= outer) continue;   // the inside stays smooth against the head
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z), phi = Math.atan2(x, z);
    const lock = 0.5 + 0.5 * Math.sin(14 * phi + phase + 1.7 * Math.sin(38 * y + 3 * phi));   // the locks, waving as they fall
    const curl = 0.6 + 0.4 * Math.sin(44 * y + 5 * phi + phase);                               // each one bulging where it turns
    const k = (r + amp * strength(y) * lock * curl) / (r || 1);
    // near the ends, each lock stops at its own length: some shorter, some longer
    const near = Math.max(0, 1 - (y - yEnd) / 0.05) ** 2;
    const dy = jag * near * (0.6 * Math.sin(7 * phi + phase) + 0.4 * Math.sin(17 * phi + 2.1 + phase * 1.7));
    p.setX(i, x * k); p.setY(i, y + dy); p.setZ(i, z * k);
  }
  closeEdges(g, phiStart, phiLen, inner);
  g.computeVertexNormals(); return g;
});
// toward the two front edges of hair hanging round the back and sides (beside the cheeks), its thickness thins away to
// nothing, down onto the inside surface against the head, so the edge closes neatly instead of showing the hair as a
// sheet folded back on itself with a gap beside the face. `inner` is that inside, [r, y] from the ends up to the crown
function closeEdges(g, phiStart, phiLen, inner) {
  if (!inner.length) return;
  const ins = inner.slice().sort((a, b) => a[1] - b[1]);
  const rIn = y => {
    if (y <= ins[0][1]) return ins[0][0];
    for (let k = 1; k < ins.length; k++) if (y <= ins[k][1]) { const [r0, y0] = ins[k - 1], [r1, y1] = ins[k]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0 || 1); }
    return ins[ins.length - 1][0];
  };
  const p = g.attributes.position, end = phiStart + phiLen, BAND = 0.5;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
    let phi = Math.atan2(x, z); if (phi < phiStart - 0.01) phi += Math.PI * 2;
    const d = Math.min(phi - phiStart, end - phi);
    if (d >= BAND || r < 1e-6) continue;
    const f = Math.max(0, d / BAND), ease = f * f * (3 - 2 * f), r0 = Math.min(r, rIn(y)), k = (r0 + (r - r0) * ease) / r;
    p.setX(i, x * k); p.setZ(i, z * k);
  }
}
// chunky curls, each its own lock: a tube, thick at the root and thin at the tip, falling from `root` by `len`, swinging
// out (`out`) by `flare` as it goes and winding `turns` times round itself as it falls, so the tip flicks out and up like
// a permed curl. All the locks of a style are merged into one piece (one draw for the whole head of curls)
const curlLocks = (key, locks) => geo(`locks3:${key}`, () => {
  const parts = locks.map(({ root, out, side, len, flare, turns, r0, lean = 0 }) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const s = i / 16, a = turns * Math.PI * 2 * s, rc = 0.01 * Math.min(1, s * 3);
      pts.push(root.clone().add(new THREE.Vector3(0, -len * s * (1 - 0.25 * s), 0))
        .addScaledVector(out, flare * s * s + rc * (1 - Math.cos(a)))
        .addScaledVector(side, lean * s + rc * Math.sin(a)));
    }
    const curve = new THREE.CatmullRomCurve3(pts), T = 28, RS = 7;
    const tube = new THREE.TubeGeometry(curve, T, r0, RS, false), p = tube.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= T; i++) {   // taper: thick at the root, a fine tip
      const s = i / T, k = s < 0.15 ? 0.75 + s / 0.15 * 0.25 : 1 - 0.7 * ((s - 0.15) / 0.85) ** 1.4;
      curve.getPointAt(s, c);
      for (let j = 0; j <= RS; j++) { const n = i * (RS + 1) + j; v.fromBufferAttribute(p, n).sub(c).multiplyScalar(k).add(c); p.setXYZ(n, v.x, v.y, v.z); }
    }
    const uv = tube.attributes.uv;   // strands running along the lock, not round it
    for (let n = 0; n < uv.count; n++) { const a = uv.getX(n), b = uv.getY(n); uv.setXY(n, b * 0.6, a); }
    tube.computeVertexNormals(); return tube;
  });
  const merged = BufferGeometryUtils.mergeBufferGeometries(parts); parts.forEach(t => t.dispose()); return merged;
});
// a fixed pseudo-random sequence for a style, so everyone with the same hair gets the same locks (and they're shared)
const seeded = key => { let h = 2166136261; for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };
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
  const shirtIn = mat(shade(look.shirt, 0.42), { roughness: 0.9, side: THREE.BackSide });   // the shadowed inside of a sleeve
  const creaseM = mat(shade(look.shirt, 0.4), { roughness: 1 });                            // folds in the cloth: in shadow, never catching the light
  const pants = mat(look.pants, { roughness: 0.9 }), pantsDark = mat(shade(look.pants, 0.78), { roughness: 0.9 });
  // hair with a little sheen; curls more (the wet, styled look), straight hair a soft gloss along its layers
  const hairM = mat(look.hair, { roughness: hairOf(look).curl === 'curly' ? 0.45 : 0.68, metalness: 0.05, map: strands(), side: THREE.DoubleSide });
  const shoe = mat(look.shoe || 0x1d1d1d, { roughness: 0.55 });
  const mk = (geom, m, x, y, z, par = g, shadow = true) => { const me = new THREE.Mesh(geom, m); me.position.set(x, y, z); me.castShadow = shadow; me.receiveShadow = shadow; par.add(me); return me; };

  // ---------------------------------------------------------------- legs and hips
  // the legs are LEG_EXTRA longer than first drawn (thigh and shin), the hips raised by that much and the torso
  // shortened to match, so shoulders, arms and head stay where every pose was tuned
  const { bottom, fit } = clothesOf(look), skirted = bottom === 'skirt';
  const legM = skirted ? skin : pants;                    // bare legs under a skirt
  const W = { slim: 0.85, regular: 1, wide: 1.45 }[fit] || 1, flare = fit === 'wide' ? 0.125 : 0.062 * W;   // wide legs: baggy all the way, flaring out to the hem
  const bare = [];   // what shows skin when the pants come down (thighs, knees, hips)
  const bunch = [];  // the pants bunched round the shins, only seen then
  const THIGH = 0.32, HIP_Y = 0.55 + LEG_EXTRA;
  const legs = [-0.105, 0.105].map(x => {
    const hip = new THREE.Group(); hip.position.set(x, HIP_Y, 0); g.add(hip);
    // thigh and shin are open tubes meeting exactly at the knee at the same width, so a straight leg has no seam; a
    // slightly smaller ball fills the joint only when the knee bends
    const RK = 0.074 * W;
    const thigh = mk(cy(0.085 * W, RK, THIGH, 16, true), legM, 0, -THIGH / 2, 0, hip); if (!skirted) bare.push(thigh);
    const knee = new THREE.Group(); knee.position.set(0, -THIGH, 0); hip.add(knee);
    const kn = mk(sp(RK * 0.96, 16, 12), legM, 0, 0, 0, knee); if (!skirted) bare.push(kn);
    const b = mk(cy(0.088 * W, 0.082 * W, 0.09, 14), skirted ? mat(0xf2efe9, { roughness: 0.9 }) : pants, 0, -0.03, 0, knee, false); b.visible = false; bunch.push(b);
    mk(cy(RK, skirted ? 0.052 : flare, 0.25, 16, true), legM, 0, -0.125, 0, knee);   // shin, down into the shoe
    if (!skirted) mk(cy(flare + 0.006, flare + 0.006, 0.025, 14), pantsDark, 0, -0.225, 0, knee, false);   // turned-up hem
    // the shoe: one rounded piece on a sole that follows its outline, with laces across the top
    mk(shoeGeo(false), shoe, 0, -0.287, 0, knee);
    mk(shoeGeo(true), soleM, 0, -0.287, 0, knee, false);
    [0.03, 0.055, 0.08].forEach(z => mk(bx(0.05, 0.006, 0.01), laceM, 0, -0.287 + shoeTop(z) + 0.002, z, knee, false));
    return { hip, knee };
  });
  // hips: rounded, tapering from the waist down into the tops of the legs, so pants run on from waist to thigh
  const seat = mk(lathe('hips2', [[0, 0.588], [0.16, 0.588], [0.182, 0.606], [0.195, 0.645], [0.2, 0.69], [0.2, 0.725]], 24), pants, 0, 0, 0); seat.scale.z = 0.72;   // flat underneath at the crotch, the legs filling out the sides
  if (fit === 'wide') { seat.scale.x = 1.12; seat.scale.z = 0.8; }   // baggy pants are roomy through the seat too
  bare.push(seat);
  // a skirt: knee length, A-line, hanging from the waist; a pivot at the waist so it can drape over the lap when sitting
  let skirt = null;
  if (skirted) {
    skirt = new THREE.Group(); skirt.position.set(0, 0.72 + LEG_EXTRA, 0); g.add(skirt);
    const sm = mat(look.pants, { roughness: 0.85, side: THREE.DoubleSide });
    mk(lathe('skirt2', [[0.21, 0.02], [0.22, -0.04], [0.24, -0.13], [0.266, -0.23], [0.288, -0.32], [0.284, -0.33]], 28), sm, 0, 0, 0, skirt).scale.z = 0.78;
  }
  const belt = mk(cy(0.204, 0.204, 0.026, 22), beltM, 0, 0.698, 0, g, false); belt.scale.z = 0.73;   // a sliver of it showing under the shirt
  mk(bx(0.045, 0.024, 0.012), buckleM, 0, 0.697, 0.15, g, false);

  // ---------------------------------------------------------------- torso: waist, chest and sloping shoulders
  // waist, chest and shoulders close to the same width, so it isn't an inverted triangle; it starts higher, over the longer legs
  // slimmer side to side and deeper front to back than first drawn, so the arms hang closer in, and the shoulders
  // slope down from the neck in one long curve rather than squaring off
  // the shirt comes straight down to its hem over the top of the hips. Its slices are ovals, wider side to side than
  // front to back, and side to side it widens out at the top into the shoulders, so the slope from the neck runs
  // straight on into the arms with no join
  // cut slim, regular or oversized (wider and deeper, hanging lower over the hips)
  const topFit = clothesOf(look).top, TF = TOP_FITS[topFit] || TOP_FITS.regular;
  const torso = mk(torsoGeo(topFit), shirt, 0, 0, 0);
  const hem = mk(cy(0.204 * TF.w, 0.203 * TF.w, 0.022, 28, true), shirtDark, 0, 0.716 - TF.drop, 0, g, false);   // the hem: an open band, no flat edge on top to flicker
  hem.scale.z = 0.745 * TF.d / TF.w;
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
  const arms = [-0.235, 0.235].map(x => {   // (where the arms hang doesn't change with the clothes)
    const s = Math.sign(x);
    const sh = new THREE.Group(); sh.position.set(x, 1.16, 0); g.add(sh);   // tucked under the slope of the shoulders
    // sleeves are cloth over the arm, not the arm in another colour: tubes open at the end with their shadowed inside
    // showing, a hem or cuff band, a few folds; a loose cut stands well clear of the arm, its shoulder seam dropped
    // down onto the upper arm
    const long = look.longSleeve, sleeveM = long ? shirt : skin, S = long ? TF.s : 1, loose = topFit === 'oversize';
    // a crease: part of the way round the sleeve, not a ring, a shade darker, each turned its own way
    let nFold = 0;
    const fold = (r, y, par, tilt = 0) => {
      const f = mk(geo(`crease:${r.toFixed(3)}`, () => new THREE.TorusGeometry(r, 0.0032, 4, 18, Math.PI * 1.15)), creaseM, 0, y, 0, par, false);
      f.rotation.set(Math.PI / 2 + tilt, 0, 0); f.rotateZ(1.3 + (nFold++) * 2.1 + (s > 0 ? 0.4 : 0));
    };
    const lining = (rt, rb, h, y, par) => mk(cy(rt - 0.002, rb - 0.002, h, 14, true), shirtIn, 0, y, 0, par, false);   // the inside of a sleeve, seen at its opening
    mk(cy(0.058 * S, 0.052 * S, 0.27, 14, true), sleeveM, 0, -0.135, 0, sh);                       // upper arm, open where it meets the forearm
    if (!long) {   // a short sleeve, as wide and as long as the cut makes it, the arm showing in its opening
      const w = TF.s, L = TF.len, rt = 0.065 * w, rb = 0.062 * w;
      mk(cy(rt, rb, L, 16, true), shirt, 0, 0.01 - L / 2, 0, sh); lining(rt, rb, 0.05, 0.01 - L + 0.025, sh);
      mk(cy(rb + 0.002, rb + 0.002, 0.018, 16, true), shirtDark, 0, 0.01 - L + 0.009, 0, sh, false);   // the hem
      if (loose) { fold(rt - 0.001, TF.seam, sh); fold(rb, 0.01 - L * 0.62, sh, 0.18 * s); }            // the dropped shoulder seam, a fold
    } else {
      if (loose) fold(0.058 * S + 0.001, TF.seam, sh);                                                 // the dropped shoulder seam
      fold(0.053 * S, -0.22, sh, 0.12 * s);                                                           // creased where the arm bends
    }
    // the top of the shoulder: a low dome just the width of the sleeve, turning with the arm, so there's no ball sitting on it
    const top = (long ? 0.058 : 0.065) * TF.s;
    mk(sp(top, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), shirt, 0, long ? 0 : 0.01, 0, sh).scale.y = 0.3;   // the arm's rounded top, kept inside the shoulder
    const elbow = new THREE.Group(); elbow.position.set(0, -0.27, 0); sh.add(elbow); elbows.push(elbow);
    mk(sp(0.05 * S, 14, 10), sleeveM, 0, 0, 0, elbow);                                             // fills the elbow only when it bends
    const wrist = long ? (loose ? 0.05 : 0.046) * S : 0.044;
    mk(cy(0.052 * S, wrist, 0.24, 14, true), sleeveM, 0, -0.12, 0, elbow);                          // forearm, the same width where they meet
    if (long) {   // the cuff: a band at the wrist, the sleeve's inside showing round the hand; a loose sleeve bunches above it
      mk(cy(wrist + 0.003, wrist + 0.003, 0.03, 14, true), shirtDark, 0, -0.225, 0, elbow, false);
      lining(wrist + 0.003, wrist + 0.003, 0.04, -0.22, elbow);
      fold(0.05 * S, -0.06, elbow, -0.1 * s);
      if (loose) { fold(wrist + 0.004, -0.17, elbow, 0.15 * s); fold(wrist + 0.005, -0.195, elbow, -0.12 * s); }
    }
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
  return { g, legs, arms, elbows, head, hand, handL, pad, eyes, mouth, skirt, skinM: skin, strip: { bare, bunch, pants, skin } };
}

// hats, each a shell round its own tipped crown down to a front edge `elev` above the eyes; own is the hat's own thickness
const HATS = { cap: { tilt: 0.25, elev: 0.4, own: 0.012 }, bucket: { tilt: 0.1, elev: 0.5, own: 0.014 }, beanie: { tilt: 0.35, elev: 0.45, own: 0.016 } };
// the top of the head for each way the front can go: the hairline (radians above the eyes' horizon) all the way round,
// and how full it stands, both by φ, the angle from straight ahead; lift is how far it stands off the head at most
const line = phi => -0.16 + 0.66 * Math.cos(phi);                          // just above the brows, past the temples, down the nape
const lobe = (phi, at0, p) => Math.max(0, Math.cos(phi - at0)) ** p;      // a bump centred on angle at0
const ang = phi => Math.atan2(Math.sin(phi), Math.cos(phi));               // -π..π, 0 straight ahead
// a parting at angle at0: cut deep down the middle, the hair either side standing up a little, so it shows clearly
const parting = (at0, depth) => phi => depth * Math.exp(-((ang(phi - at0) / 0.09) ** 2));   // only a soft crease along it
// the strands either side of a parting: running away from it at an angle, down toward the temples, the hair on one
// side (`steepA`, the side toward +φ) and the other (`steepB`) can fall at different angles. Round the back of the head
// they turn back into plain strands straight down from the crown
const partFlow = (at0, steepA, steepB) => (phi, t) => {
  const d = ang(phi - at0), radial = (ang(phi) + Math.PI) / (2 * Math.PI) * 6;
  const away = t * 3 - Math.sqrt(d * d + 0.01) * (d > 0 ? steepA : steepB), w = Math.exp(-((d / 1.1) ** 2));
  return radial * (1 - w) + away * w;
};
const FRONTS = {
  // no fringe: combed back off the forehead, the hairline well up so the forehead shows
  none: { edge: phi => line(phi) + 0.26 * lobe(phi, 0, 2), thick: () => 0.012, lift: 0.012 },
  // a fringe: down to the brows and cut almost straight across, standing out full over the forehead
  bangs: { edge: phi => line(phi) + (0.45 - line(phi)) * lobe(phi, 0, 4), thick: phi => 0.012 + 0.014 * lobe(phi, 0, 1.5), lift: 0.026 },   // just above the brows
  // parted in the middle: the hairline lifts at the centre of the forehead and the hair falls away to both sides,
  // fuller over the temples, with a shallow parting line running back from the front
  center: {
    edge: phi => line(phi) + 0.3 * Math.exp(-((ang(phi) / 0.34) ** 2)) - 0.02 * (lobe(phi, 0.6, 6) + lobe(phi, -0.6, 6)),   // high in the middle, the forehead showing, the hair falling away either side
    thick: phi => 0.016 + 0.008 * (lobe(phi, 0.6, 3) + lobe(phi, -0.6, 3)), lift: 0.026,
    part: 0, groove: parting(0, 0.006), flow: partFlow(0, 2.6, 2.6),
  },
  // parted on one side: a clear parting over one eye, the hair swept over from it, low and full over the other brow,
  // short and close on the parting's side, with a notch in the hairline where the parting meets it
  side: {
    edge: phi => line(phi) - 0.18 * lobe(phi, -0.5, 3) + 0.06 * lobe(phi, 0.75, 3) + 0.14 * Math.exp(-(((ang(phi) - 0.45) / 0.09) ** 2)),
    thick: phi => 0.014 + 0.02 * lobe(phi, -0.4, 2), lift: 0.034,
    part: 0.45, groove: parting(0.45, 0.008), flow: partFlow(0.45, 3.6, 1.4),   // short and steep on the parting's side, a long low sweep across the forehead
  },
};
const CURL_TOP = 0.018;     // how far curls stand out of the top of the head
// the hair hanging round the back and sides for each length, as a profile below the widest part of the head (w, y0)
const LENGTHS = {
  // a man's short-long cut: half over the ears, a little fuller at the nape, the ends turned in
  bob: (w, y0) => [[w + 0.006, y0 - 0.025], [w + 0.01, y0 - 0.05], [w + 0.008, y0 - 0.068], [w + 0.001, y0 - 0.076], [w - 0.006, y0 - 0.078]],
  medium: (w, y0) => [[w + 0.004, y0 - 0.07], [w + 0.01, y0 - 0.15], [w + 0.016, y0 - 0.22], [w + 0.018, y0 - 0.26], [w + 0.006, y0 - 0.285], [w - 0.008, y0 - 0.29]],   // to the shoulders, ends turned under
  long: (w, y0) => [[w + 0.004, y0 - 0.08], [w + 0.012, y0 - 0.19], [w + 0.026, y0 - 0.29], [w + 0.008, y0 - 0.33]],
};
const CURLY_LENGTHS = {   // curls take up a little more room, a little fuller toward the ends
  // the Japanese wet-perm look: short, loose waves lying fairly close round the ears and nape
  bob: (w, y0) => [[w + 0.008, y0 - 0.025], [w + 0.014, y0 - 0.05], [w + 0.016, y0 - 0.07], [w + 0.008, y0 - 0.084], [w - 0.002, y0 - 0.088]],
  medium: (w, y0) => [[w + 0.006, y0 - 0.06], [w + 0.012, y0 - 0.13], [w + 0.018, y0 - 0.2], [w + 0.0204, y0 - 0.25], [w + 0.012, y0 - 0.28], [w + 0.0024, y0 - 0.29]],
  long: (w, y0) => [[w + 0.0072, y0 - 0.06], [w + 0.012, y0 - 0.13], [w + 0.018, y0 - 0.2], [w + 0.0228, y0 - 0.27], [w + 0.0252, y0 - 0.33], [w + 0.0168, y0 - 0.37], [w + 0.0036, y0 - 0.38]],
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
      prof.push([Math.max(ps.x, -pb.z) + 0.0185 + 0.005 * (k / 6), (ps.y + pb.y) / 2]);   // just clear of the top's fullest, so the two meet without a seam
    }
    const [w, y0] = prof[prof.length - 1];
    prof.push(...tail(w, y0));
    // the way back up the inside: from the ends in under the hair to the nape, then up against the head (just inside its
    // surface), so the hair is one solid mass with no hollow under it or gap beside the head
    const headR = y => Math.max(0.055, w - 0.0235 - 0.9 * (y0 - y));
    const yEnd = prof[prof.length - 1][1];
    const inside = [[headR(yEnd), yEnd + 0.002]];
    for (let k = prof.length - 2; k >= 7; k--) inside.push([headR(prof[k][1]), prof[k][1]]);
    for (let k = 6; k >= 0; k--) inside.push([prof[k][0] - 0.0185 - 0.005 * (k / 6) - 0.003, prof[k][1]]);
    if (!curls) {   // straight: cut in soft layers down the back, each tier swelling a little toward its lower edge
      const layered = prof.slice(0, 7);
      for (let k = 7; k < prof.length; k++) {
        const [r0, ya] = prof[k - 1], [r1, yb] = prof[k], n = Math.max(1, Math.ceil(Math.abs(yb - ya) / 0.004));
        for (let i = 1; i <= n; i++) {
          const y = ya + (yb - ya) * i / n, end = k === prof.length - 1 && i === n;
          layered.push([r0 + (r1 - r0) * i / n + (end ? 0 : LAYER_DEPTH * tier((y0 - y) / 0.05)), y]);
        }
      }
      mk(geo(`curtain6:${shape}:${key}`, () => {
        const lg = new THREE.LatheGeometry(layered.concat(inside).map(([r, y]) => new THREE.Vector2(r, y)), 48, 0.85, Math.PI * 2 - 1.7);
        closeEdges(lg, 0.85, Math.PI * 2 - 1.7, inside); lg.computeVertexNormals(); return lg;
      }), hairM, 0, 0, 0, head);
    }
    else {   // curls: the locks ending at their own lengths, not cut straight across
      const top = prof[3][1], bottom = prof[prof.length - 1][1], strength = y => Math.max(0, Math.min(1, (top - y) / (top - bottom) * 1.6));
      mk(ringletLathe(`${shape}:${key}`, prof, 120, 0.85, Math.PI * 2 - 1.7, curls, strength, 0, 0.02, inside), hairM, 0, 0, 0, head);
    }
  };

  let lift = 0;
  if (length === 'buzz') {
    mk(shellGeo(shape, 0.004, crown(0.5), 0, coverFor(0.5, 0.55)), hairM, 0, 0, 0, head); lift = 0.004;
  } else if (length !== 'bald') {
    // the top of the head: shaped by the front, with curls in its surface if it's curly
    const F = FRONTS[front] || FRONTS.none, curly = curl === 'curly';
    const amp = length === 'short' ? 0.02 : length === 'bob' ? 0.016 : CURL_TOP;   // the wet perm lies fairly close
    mk(capGeo(shape, `${front}${curly ? `:waves${amp}` : ':flow'}`, F.edge, F.thick, curly ? curlLumps(amp) : null, F.groove, F.flow), hairM, 0, 0, 0, head);
    lift = F.lift + LAYER_DEPTH + (curly ? amp : 0);
    if (curl === 'spiky') {
      scatter(1.0, 0.4, (u, p) => {                     // spikes stick out a long way, so keep them well clear of a hat's edge and brim
        const s = mk(cy(0, 0.04, 0.11, 6), hairM, p.x + u.x * 0.05, p.y + u.y * 0.05, p.z + u.z * 0.05, head);
        s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), u);
      });
    }
    // what hangs below: left loose to its length, or pulled back and tied
    const long = length === 'medium' || length === 'long';   // long enough to tie back
    const hangs = long || length === 'bob';
    if (tie === 'bun' && long) {
      // up on the crown, or, under a hat, a low bun below its edge at the back
      const e = H ? Math.min(0.86, hatBack - 0.3) : 0.86, p = backAt(e), out = new THREE.Vector3(0, Math.sin(e), -Math.cos(e));
      mk(sp(curly ? 0.085 : 0.075, 14, 12), hairM, p.x + out.x * 0.05, p.y + out.y * 0.05, p.z + out.z * 0.05, head);
    } else if (tie === 'ponytail' && long) {
      const p = backAt(H ? Math.min(0.15, hatBack - 0.22) : 0.15), L = length === 'long' ? 1 : 0.7, R = curly ? 1.25 : 1;
      mk(cy(0.038, 0.038, 0.03, 12), mat(0xff4f7b), p.x, p.y, p.z - 0.012, head).rotation.x = Math.PI / 2;
      const tail = mk(lathe(`tail:${L}:${R}`, [[0.001, 0.02], [0.04 * R, 0], [0.05 * R, -0.08 * L], [0.035 * R, -0.2 * L], [0.012 * R, -0.28 * L], [0, -0.29 * L]], 14), hairM, p.x, p.y - 0.01, p.z - 0.04, head);
      tail.rotation.x = 0.35;
    } else if (hangs) {
      curtain(`${length}${curly ? ':curly' : ''}`, (curly ? CURLY_LENGTHS : LENGTHS)[length], curly ? (length === 'bob' ? 0.016 : 0.018) : 0);
      if (curly) {
        // loose curls over it all, the way a perm falls: two rows of chunky locks round the sides and back, every one a
        // different length, swinging out and flicking up at the tips; and, unless it's combed back, a few falling over the
        // forehead (parted in the middle: away to either side; a fringe: straight down; parted on one side: swept across)
        const rnd = seeded(`${shape}:${length}:${front}:${hatStyle || ''}`), locks = [];
        const L = { bob: 0.1, medium: 0.2, long: 0.28 }[length];
        const dir = (phi, e) => new THREE.Vector3(Math.sin(phi) * Math.cos(e), Math.sin(e), Math.cos(phi) * Math.cos(e));
        const add = (phi, e, len, flare, turns, r0, lean = 0, push = 0.014) => {
          const u = dir(phi, e); if (underHat(u, 0.08)) return;
          const out = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)), side = new THREE.Vector3(Math.cos(phi), 0, -Math.sin(phi));
          locks.push({ root: at(u.x, u.y, u.z).addScaledVector(out, push), out, side, len, flare, turns, r0, lean });
        };
        [[0.22, 0.32], [-0.08, 0.27]].forEach(([e, step], row) => {
          for (let phi = 1.05 + row * step / 2; phi < Math.PI * 2 - 1.05; phi += step * (0.85 + rnd() * 0.3)) {
            add(phi + (rnd() - 0.5) * 0.08, e + (rnd() - 0.5) * 0.08, L * (0.6 + rnd() * 0.55) + (row ? 0 : 0.035), 0.008 + rnd() * 0.014, 0.55 + rnd() * 0.7, 0.014 + rnd() * 0.004);
          }
        });
        if (front !== 'none') {
          // (all kept clear of the eyebrows: parted in the middle they fall out over the temples, framing the forehead; a
          // fringe or a side sweep stops short above the brows)
          const fr = front === 'center' ? [-0.78, -0.58, 0.58, 0.78] : front === 'side' ? [-0.55, -0.35, -0.15, 0.05, 0.25] : [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5];
          fr.forEach(phi => {
            const center = front === 'center', lean = center ? Math.sign(phi) * 0.05 : front === 'side' ? -0.045 : (rnd() - 0.5) * 0.02;
            add(phi, (center ? 0.5 : 0.66) + (rnd() - 0.5) * 0.06, center ? 0.05 + rnd() * 0.03 : 0.035 + rnd() * 0.015, 0.006 + rnd() * 0.008, 0.4 + rnd() * 0.4, 0.013 + rnd() * 0.003, lean, 0.02);
          });
        }
        if (locks.length) mk(curlLocks(`${shape}:${length}:${front}:${hatStyle || ''}`, locks), hairM, 0, 0, 0, head);
      }
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
