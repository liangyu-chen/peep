// 月亮小熊: a little plush bear that flies alongside whoever has it (a 配件 picked in the back office). Dusty blue fur, a
// beige muzzle and tummy with a crescent moon and a yellow star on it, beige inner ears, a yellow felt crown, soft grey
// wings that flap, and it bobs along at the person's shoulder, trailing a little behind as they walk.
import * as THREE from 'three';
import { mat } from './engine.js';
import { picked } from './body.js';

const SIZE = 1.35;   // the keychain's ~13 cm, a little larger so it reads at café distance

let M = null;
const mats = () => M || (M = {
  fur: mat(picked(0x5f8593), { roughness: 0.95 }),
  beige: mat(picked(0x948b80), { roughness: 0.95 }),
  stitch: mat(picked(0x6f6d69), { roughness: 1 }),
  wing: mat(picked(0x8f8d89), { roughness: 0.95, side: THREE.DoubleSide }),
  moon: mat(picked(0x2f5a70), { roughness: 0.8 }),
  heart: mat(picked(0x5a8fa6), { roughness: 0.7 }),
  star: mat(picked(0xf2c935), { roughness: 0.6 }),
  crown: mat(picked(0xe8c62e), { roughness: 0.7, side: THREE.DoubleSide }),
  eye: mat(0x101820, { roughness: 0.3 }),
  iris: mat(picked(0x4d9db8), { roughness: 0.3 }),
  shine: mat(0xffffff, { roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.4 }),
  line: mat(0x2a2a30, { roughness: 0.8 }),
});

function ball(r, m, x, y, z, parent, sx = 1, sy = 1, sz = 1) {
  const me = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m);
  me.position.set(x, y, z); me.scale.set(sx, sy, sz); me.castShadow = true; parent.add(me); return me;
}

// one wing: a soft rounded lobe, puffy (extruded with a bevel), its root at the origin and reaching out along +x
let wingGeo = null;
function wingShape() {
  if (wingGeo) return wingGeo;
  const s = new THREE.Shape();
  // like the plush's: narrow at the spine, the top edge sweeping up and out to a rounded tip that shows over the
  // shoulder, the outer edge falling away and the bottom curving back in, the whole pair a big soft bow
  s.moveTo(0, 0.012);
  s.bezierCurveTo(0.03, 0.022, 0.07, 0.045, 0.1, 0.048);
  s.bezierCurveTo(0.118, 0.05, 0.12, 0.025, 0.112, 0.01);
  s.bezierCurveTo(0.1, -0.02, 0.06, -0.035, 0.035, -0.03);
  s.bezierCurveTo(0.018, -0.026, 0.006, -0.018, 0, -0.012);
  s.closePath();
  wingGeo = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 10 });
  wingGeo.translate(0, 0, -0.002);
  return wingGeo;
}

export function makeBear() {
  const m = mats();
  const g = new THREE.Group(), b = new THREE.Group(); b.scale.setScalar(SIZE); g.add(b);

  // head, wide and round, a little squashed
  ball(0.05, m.fur, 0, 0.045, 0, b, 1.1, 0.95, 0.95);
  [-1, 1].forEach(s => {
    ball(0.017, m.fur, s * 0.038, 0.083, -0.004, b, 1, 1, 0.65);                 // ears
    ball(0.01, m.beige, s * 0.038, 0.083, 0.005, b, 1, 1, 0.4);                  // and their insides
    // the big eyes, set wide over the muzzle: dark, a ring of blue, a white catchlight
    const ex = s * 0.021, ey = 0.054, ez = 0.043;
    ball(0.0095, m.eye, ex, ey, ez, b, 0.85, 1.05, 0.45);
    ball(0.006, m.iris, ex, ey - 0.002, ez + 0.003, b, 0.85, 1, 0.3);
    ball(0.0032, m.eye, ex, ey - 0.002, ez + 0.0045, b, 1, 1, 0.3);
    ball(0.0022, m.shine, ex + s * 0.003, ey + 0.004, ez + 0.005, b, 1, 1, 0.4);
  });
  ball(0.022, m.beige, 0, 0.028, 0.04, b, 1.2, 0.85, 0.6);                        // the muzzle
  // a heart of a nose: two little lobes and a point
  [-1, 1].forEach(s => ball(0.0045, m.heart, s * 0.0038, 0.037, 0.0535, b, 1, 1, 0.6));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0062, 0.008, 8), m.heart); tip.position.set(0, 0.0315, 0.0535); tip.rotation.x = Math.PI; tip.scale.z = 0.6; b.add(tip);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.0085, 0.0012, 4, 12, Math.PI * 0.8), m.line);   // the little smile
  smile.position.set(0, 0.027, 0.053); smile.rotation.z = Math.PI + Math.PI * 0.1; b.add(smile);

  // the crown: a yellow felt band with points, perched a bit askew
  const crown = new THREE.Group(); crown.position.set(0.004, 0.094, -0.002); crown.rotation.z = -0.12; b.add(crown);
  crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.021, 0.016, 16, 1, true), m.crown));
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, pt = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.012, 4), m.crown);
    pt.position.set(Math.sin(a) * 0.022, 0.014, Math.cos(a) * 0.022); crown.add(pt);
  }

  // the body, the tummy patch with its crescent moon and star
  ball(0.04, m.fur, 0, -0.03, 0, b, 1, 1.15, 0.9);
  ball(0.029, m.beige, 0, -0.028, 0.026, b, 0.9, 1.1, 0.4);
  // the moon embroidered flat on it: a crescent cut from two circles, lying just on the patch
  const cres = new THREE.Shape(); cres.absarc(0, 0, 0.015, Math.PI * 0.3, Math.PI * 1.7, false);
  cres.absarc(0.007, 0.001, 0.0115, Math.PI * 1.55, Math.PI * 0.45, true);
  const moon = new THREE.Mesh(new THREE.ShapeGeometry(cres, 16), m.moon);
  moon.position.set(-0.002, -0.028, 0.0379); moon.rotation.z = -0.35; b.add(moon);
  const star = new THREE.Mesh(new THREE.CircleGeometry(0.0032, 5), m.star); star.position.set(0.008, -0.016, 0.0377); b.add(star);

  // stubby arms held out, little legs dangling
  [-1, 1].forEach(s => {
    const arm = ball(0.015, m.fur, s * 0.046, -0.018, 0.006, b, 1, 1.6, 1); arm.rotation.z = s * 0.9;
    ball(0.017, m.fur, s * 0.018, -0.072, 0.006, b, 1, 1.35, 1);
  });

  // the wings, on its back, hinged at the spine
  const wings = [-1, 1].map(s => {
    const hinge = new THREE.Group(); hinge.position.set(s * 0.006, -0.022, -0.03); b.add(hinge);
    const w = new THREE.Mesh(wingShape(), m.wing); w.scale.x = s; w.castShadow = true; hinge.add(w);
    // the quilting stitched across it, on both faces, and a blue heart near each tip
    [[[0.01, 0.004], [0.05, 0.018], [0.1, 0.032]], [[0.012, -0.008], [0.055, 0.0], [0.105, 0.012]], [[0.02, -0.019], [0.06, -0.018], [0.095, -0.006]]].forEach(pts => {
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(s * x, y, 0)));
      const geo = new THREE.TubeGeometry(curve, 12, 0.0009, 4, false);
      [-0.0062, 0.0062].forEach(z => { const t = new THREE.Mesh(geo, m.stitch); t.position.z = z; hinge.add(t); });
    });
    [-0.0058, 0.0058].forEach(z => { const h = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 10), m.heart); h.position.set(s * 0.1, 0.03, z); h.rotation.y = z < 0 ? Math.PI : 0; hinge.add(h); });
    hinge.userData.side = s;
    return hinge;
  });
  return { g, wings, t: Math.random() * 10, placed: false };
}

// flap and bob; call every frame
export function flapBear(bear, dt) {
  bear.t += dt;
  const f = Math.sin(bear.t * 13);
  bear.wings.forEach(w => { w.rotation.y = -w.userData.side * (0.25 + f * 0.3); });
  return Math.sin(bear.t * 2.1) * 0.035;   // the bob
}

const _head = new THREE.Vector3(), _to = new THREE.Vector3();
// keeps it at the person's shoulder (their left, a touch behind and above the head), easing after them as they move
export function followBear(bear, person, dt) {
  const bob = flapBear(bear, dt);
  person.head.getWorldPosition(_head);
  const h = person.heading, side = 0.3, back = -0.12;
  _to.set(_head.x + Math.cos(h) * side + Math.sin(h) * back, _head.y + 0.06 + bob, _head.z - Math.sin(h) * side + Math.cos(h) * back);
  const g = bear.g;
  if (!bear.placed) { g.position.copy(_to); g.rotation.y = h; bear.placed = true; }
  else g.position.lerp(_to, 1 - Math.exp(-dt * 3.5));
  let d = h - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
  g.rotation.y += d * Math.min(1, dt * 3);
  g.rotation.z = Math.sin(bear.t * 1.3) * 0.08;   // a gentle sway
  g.rotation.x = Math.sin(bear.t * 2.1 + 1) * 0.06;
}
