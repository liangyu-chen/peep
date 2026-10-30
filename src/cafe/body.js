// A person's 3D body: stylised but detailed, with a face built from the look's face options.
// Shared by the café and the back office's 捏臉 preview, so it depends only on three.js and the catalog.
import * as THREE from 'three';
import { mat, canvasTex } from './engine.js';
import { PIX } from './util.js';
import { faceOf } from '../content/catalog';

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
const soleM = mat(0xece7dc, { roughness: 0.8 });

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
  const legs = [-0.105, 0.105].map(x => {
    const hip = new THREE.Group(); hip.position.set(x, 0.55, 0); g.add(hip);
    mk(cy(0.085, 0.074, 0.28, 14), pants, 0, -0.13, 0, hip);                                   // thigh
    const knee = new THREE.Group(); knee.position.set(0, -0.27, 0); hip.add(knee);
    mk(sp(0.074, 12, 8), pants, 0, 0, 0, knee);                                                // knee, so a bent leg stays joined
    mk(cy(0.07, 0.062, 0.2, 14), pants, 0, -0.1, 0, knee);                                     // shin
    mk(cy(0.068, 0.068, 0.025, 14), pantsDark, 0, -0.195, 0, knee, false);                     // turned-up hem
    mk(bx(0.125, 0.06, 0.17), shoe, 0, -0.24, 0.015, knee);                                     // shoe, with a rounded toe
    mk(sp(0.064, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), shoe, 0, -0.27, 0.1, knee).scale.set(0.98, 0.95, 1.05);
    mk(bx(0.135, 0.02, 0.25), soleM, 0, -0.27, 0.045, knee, false);
    return { hip, knee };
  });
  const seat = mk(cy(0.212, 0.2, 0.16, 20), pants, 0, 0.6, 0); seat.scale.z = 0.62;            // hips
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

  buildHair(look.hairStyle, shape, head, hairM, mk, at, look);

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
  const beardThick = f.facialHair === 'full' ? 0.014 : f.facialHair === 'stubble' ? 0.002 : 0;
  if (beardThick) {
    const m = f.facialHair === 'full' ? hairM : mat(look.hair, { roughness: 1, transparent: true, opacity: 0.35, depthWrite: false });
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
    fm(bx(0.1, 0.022, 0.03), hairM, 0, -0.056, z + 0.004);
    [-1, 1].forEach(s => fm(bx(0.02, 0.035, 0.024), hairM, s * 0.052, -0.07, surf(s * 0.052, -0.07) + beardThick + 0.002));
  }
  if (f.facialHair === 'goatee' || f.facialHair === 'both') fm(bx(0.05, 0.055, 0.04), hairM, 0, -0.128, surf(0, -0.128) - 0.004);
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
  const pad = new THREE.Group();
  mk(bx(0.2, 0.045, 0.1), mat(0x1b1b1b, { roughness: 0.4 }), 0, 0, 0, pad);
  [-1, 1].forEach(s => mk(sp(0.035, 10, 8), mat(0x1b1b1b, { roughness: 0.4 }), s * 0.085, -0.015, -0.022, pad, false));   // grips
  mk(bx(0.04, 0.012, 0.03), mat(0x3ddc97), 0.05, 0.026, 0, pad, false);
  [-1, 1].forEach(s => mk(cy(0.012, 0.012, 0.012, 8), mat(0x333333), s * 0.03, 0.026, 0.012, pad, false));         // sticks
  pad.position.set(0, 0.95, 0.43); pad.visible = false; g.add(pad);
  return { g, legs, arms, elbows, head, hand, pad, eyes, mouth };
}

function buildHair(style, shape, head, hairM, mk, at, look) {
  const hair = (thick, tilt, elev, xMax) => mk(shellGeo(shape, thick, crown(tilt), 0, coverFor(tilt, elev), xMax), hairM, 0, 0, 0, head);
  const TILT = 0.66, FRONT = 0.5;                       // the hairline: front edge just above the brows, back edge down the nape
  const base = () => hair(0.012, TILT, FRONT);
  const bangs = (xMax = 9) => mk(shellGeo(shape, 0.02, crown(-0.75), 0, 0.38, xMax), hairM, 0, 0, 0, head);
  const hat = (thick, tilt, elev, m) => mk(shellGeo(shape, thick, crown(tilt), 0, coverFor(tilt, elev)), m, 0, 0, 0, head);
  // spread small pieces evenly over the part of the head the hair covers
  const scatter = (limit, place) => FIB.forEach(u => { const a = Math.acos(u.dot(crown(TILT))); if (a < limit) place(u, at(u.x, u.y, u.z)); });
  switch (style) {
    case 'bald': break;
    case 'buzz': hair(0.004, 0.5, 0.55); break;
    case 'long': {
      base(); bangs();
      // a curtain of hair round the back and sides, open at the face, flaring out a little at the ends
      const w = Math.max(at(1, 0, 0).x, -at(0, 0, -1).z) + 0.012;
      mk(lathe(`curtain${w.toFixed(3)}`, [[w, 0.05], [w + 0.006, -0.06], [w + 0.016, -0.17], [w + 0.03, -0.27], [w + 0.012, -0.31]], 28, 0.85, Math.PI * 2 - 1.7), hairM, 0, 0, 0, head);
      break;
    }
    case 'bun': base(); bangs(); { const p = at(0, 0.75, -0.65); mk(sp(0.075, 14, 12), hairM, p.x, p.y + 0.03, p.z - 0.04, head); } break;
    case 'ponytail': {
      base(); bangs();
      const p = at(0, 0.15, -1);
      mk(cy(0.038, 0.038, 0.03, 12), mat(0xff4f7b), p.x, p.y, p.z - 0.012, head).rotation.x = Math.PI / 2;
      const tail = mk(lathe('tail', [[0.001, 0.02], [0.04, 0], [0.05, -0.08], [0.035, -0.2], [0.012, -0.28], [0, -0.29]], 14), hairM, p.x, p.y - 0.01, p.z - 0.04, head);
      tail.rotation.x = 0.35; break;
    }
    case 'side': base(); bangs(0.25); break;            // a side-swept fringe over one brow
    case 'spiky':
      base();
      scatter(1.0, (u, p) => {
        const s = mk(cy(0, 0.04, 0.11, 6), hairM, p.x + u.x * 0.05, p.y + u.y * 0.05, p.z + u.z * 0.05, head);
        s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), u);
      });
      break;
    case 'curly':
      base();
      scatter(coverFor(TILT, FRONT) - 0.12, (u, p) => mk(sp(0.03, 8, 6), hairM, p.x + u.x * 0.018, p.y + u.y * 0.018, p.z + u.z * 0.018, head, false));
      break;
    case 'cap': {
      base();
      const capM = mat(look.cap || 0xf08a24, { roughness: 0.8 });
      hat(0.024, 0.25, 0.4, capM);
      const top = at(0, 1, -0.25); mk(sp(0.016, 8, 6), capM, top.x, top.y + 0.022, top.z, head);
      const front = at(0, Math.sin(0.4), Math.cos(0.4));
      const brim = mk(cy(0.15, 0.15, 0.012, 28, false, -Math.PI / 2, Math.PI), capM, 0, front.y + 0.006, front.z - 0.035, head);
      brim.scale.z = 0.92; brim.rotation.x = 0.16; break;
    }
    case 'bucket': {
      base();
      const capM = mat(look.cap || 0x2f2f2f, { roughness: 0.9, side: THREE.DoubleSide });
      const E = 0.5;                                    // brim sits on the forehead, well above the eyes
      hat(0.026, 0.1, E, capM);
      const edge = at(0, Math.tan(E), 1), w = Math.max(at(1, Math.tan(E), 0).x, edge.z) + 0.022;
      mk(lathe(`brim${w.toFixed(3)}`, [[w, 0.004], [w + 0.032, -0.008], [w + 0.056, -0.022], [w + 0.057, -0.03], [w, -0.006]], 32), capM, 0, edge.y, 0, head);
      break;
    }
    default: base();   // short
  }
  if (look.beanie) {
    const bm = mat(look.beanie, { roughness: 1 });
    hat(0.028, 0.35, 0.45, bm);
    mk(shellGeo(shape, 0.042, crown(0.35), coverFor(0.35, 0.45) - 0.2, coverFor(0.35, 0.45)), bm, 0, 0, 0, head);   // rolled cuff
    const top = at(0, 1, -0.35); mk(sp(0.03, 8, 6), bm, top.x, top.y + 0.03, top.z, head);
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
