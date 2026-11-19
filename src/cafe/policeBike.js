// 警用機車: the white-and-blue police motorcycle the two officers ride in on (drunk.js). A proper big bike rather than a
// scooter: spoked wheels with brake discs, a fork, engine and exhaust, a tank, a front fairing with its headlight and
// windscreen, saddle bags and a top box printed 警察 / POLICE, and a red-and-blue light bar on a mast at the back that
// flashes. Its rider is a real officer (body.js + police.js) sat astride it, hands on the bars.
// Built in plain world metres, nose toward +z; wheels turn with how far it's gone (spin), and it leans on its side
// stand when parked (park).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildBody, poseBody, restPose } from './body.js';
import { mergeParts, bodyKeep } from './people.js';
import { dressOfficer, OFFICER_LOOKS } from './police.js';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const glow = (color, k = 1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4 });
const FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
let MATS = null;
const mats = () => MATS || (MATS = {
  white: M(0xf4f6f8, { roughness: 0.28, metalness: 0.15 }),
  blue: M(0x1b4fa8, { roughness: 0.35, metalness: 0.1 }),
  navy: M(0x15213d, { roughness: 0.45 }),
  black: M(0x141416, { roughness: 0.55 }),
  tyre: M(0x0e0e10, { roughness: 0.9 }),
  engine: M(0x3a3d42, { roughness: 0.45, metalness: 0.6 }),
  chrome: M(0xd9dde2, { roughness: 0.18, metalness: 0.95 }),
  disc: M(0xa9adb3, { roughness: 0.3, metalness: 0.85 }),
  seat: M(0x1c1c1e, { roughness: 0.8 }),
  reflect: M(0xf2d21c, { roughness: 0.4, emissive: 0x5a4a00, emissiveIntensity: 0.5 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xbfe0f5, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }),
  lamp: glow(0xfff4d8, 1.2),
  tail: glow(0xd01818, 0.7),
  amber: glow(0xffa21a, 0.5),
  redOn: new THREE.MeshBasicMaterial({ color: 0xff2d4a }), redOff: M(0x5a1018, { roughness: 0.3 }),
  blueOn: new THREE.MeshBasicMaterial({ color: 0x3fb4ff }), blueOff: M(0x0f2a5a, { roughness: 0.3 }),
  haloR: new THREE.SpriteMaterial({ map: haloTex(), color: 0xff3050, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  haloB: new THREE.SpriteMaterial({ map: haloTex(), color: 0x40a8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  decal: new THREE.MeshStandardMaterial({ map: decalTex(), transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }),
});

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
function haloTex() {
  return canvasTex(64, 64, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  });
}
// 警察 over POLICE in navy, for the saddle bags and the fairing
function decalTex() {
  return canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#15213d'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `900 70px ${FONT}`; x.fillText('警察', w / 2, h * 0.38);
    x.font = '800 34px Arial, sans-serif'; x.fillText('POLICE', w / 2, h * 0.82);
  });
}

// a wheel: tyre, rim, spokes and a brake disc, in a group that turns about x
function wheel(m, r) {
  const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(r - 0.045, 0.055, 10, 28), m.tyre); tyre.rotation.y = Math.PI / 2; spin.add(tyre);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.1, 0.014, 6, 28), m.chrome); rim.rotation.y = Math.PI / 2; spin.add(rim);
  for (let k = 0; k < 5; k++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, (r - 0.1) * 2, 0.03), m.engine); s.rotation.x = k * Math.PI / 5; spin.add(s);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12), m.chrome); hub.rotation.z = Math.PI / 2; spin.add(hub);
  [-1, 1].forEach(s => { const d = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.008, 22), m.disc); d.rotation.z = Math.PI / 2; d.position.x = s * 0.05; spin.add(d); });
  return { g, spin, r };
}

// a rounded slab: a box with its edges softened (a sphere squashed into it), for the tank, fairing and bags
// a side profile (forward z, up y) pushed out to `w` across, centred, its edges rounded by `bev`
function sideShape(pts, w, bev) {
  const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w - bev * 2, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 4, curveSegments: 8 });
  g.translate(0, 0, -(w - bev * 2) / 2); g.computeVertexNormals(); return g;
}
const FAIR = [[0.42, 0.72], [0.6, 0.72], [0.73, 0.79], [0.79, 0.87], [0.77, 0.93], [0.64, 1.0], [0.48, 1.05], [0.4, 0.98]];
const BAND = [[0.4, 0.8], [0.62, 0.79], [0.68, 0.83], [0.4, 0.86]];
const CHIN = [[0.55, 0.7], [0.68, 0.72], [0.77, 0.8], [0.75, 0.82], [0.6, 0.78]];
const rbox = (w, h, d, r, m) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);
function blob(w, h, d, m) { const me = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), m); me.scale.set(w, h, d); return me; }

// the rider sat on the saddle, hips at the seat, feet on the pegs, arms out to the bars
const RIDE_POSE = { hipL: -1.35, hipR: -1.35, kL: 1.55, kR: 1.55, armLx: -1.05, armRx: -1.05, armLy: 0, armRy: 0, armLz: -0.22, armRz: 0.22, elL: -0.45, elR: -0.45 };

export function policeBike(i = 0) {
  const m = mats(), g = new THREE.Group(), body = new THREE.Group(); g.add(body);   // body: everything but the stand, leans when parked
  const add = (mesh, x = 0, y = 0, z = 0, parent = body) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  const box = (w, h, d, mat, x, y, z) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z);
  const cyl = (r0, r1, h, mat, x, y, z, seg = 12) => add(new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat), x, y, z);

  // wheels: front under the fairing, rear under the bags
  const R = 0.31, FZ = 0.74, RZ = -0.68;
  const front = wheel(m, R), rear = wheel(m, R);
  add(front.g, 0, R, FZ); add(rear.g, 0, R, RZ);
  // the fork, raked back up to the bars, and a mudguard over the front tyre
  [-1, 1].forEach(s => { const f = cyl(0.022, 0.026, 0.62, m.chrome, s * 0.085, R + 0.28, FZ - 0.1); f.rotation.x = -0.42; });
  // (an arc of torus in the wheel's plane, from up behind the top round to just below the front)
  const guard = add(new THREE.Group(), 0, R, FZ); guard.rotation.x = 0.9;
  const arc = new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, 0.05, 6, 18, 1.9), m.white); arc.rotation.y = Math.PI / 2; arc.scale.z = 0.5; guard.add(arc);
  // swingarm to the rear wheel, the engine low in the middle and the exhaust out along the right
  [-1, 1].forEach(s => { const a = box(0.03, 0.05, 0.62, m.black, s * 0.09, R + 0.06, RZ + 0.3); a.rotation.x = -0.12; });
  box(0.3, 0.3, 0.42, m.engine, 0, 0.42, 0.06);
  [-1, 1].forEach(s => cyl(0.1, 0.1, 0.06, m.chrome, s * 0.17, 0.42, 0.12, 16).rotation.z = Math.PI / 2);
  const pipe = cyl(0.028, 0.028, 0.6, m.chrome, -0.16, 0.3, -0.2); pipe.rotation.x = Math.PI / 2 - 0.1;
  const can = cyl(0.055, 0.045, 0.36, m.chrome, -0.2, 0.36, -0.6, 14); can.rotation.x = Math.PI / 2 - 0.12;
  // the frame's white side covers, a blue band along them, the tank and the saddle
  [-1, 1].forEach(s => {
    box(0.03, 0.2, 0.5, m.white, s * 0.17, 0.66, -0.12);
    box(0.034, 0.05, 0.5, m.blue, s * 0.17, 0.6, -0.12);
  });
  const tank = add(blob(0.36, 0.22, 0.5, m.white), 0, 0.82, 0.25); tank.rotation.x = 0.1;
  box(0.37, 0.035, 0.36, m.blue, 0, 0.8, 0.24).rotation.x = 0.1;
  const saddle = add(blob(0.3, 0.1, 0.62, m.seat), 0, 0.8, -0.22); saddle.rotation.x = -0.06;
  // the front fairing: a side profile pushed out to its width with rounded edges, a sharp beak over twin headlights
  const fair = add(new THREE.Mesh(sideShape(FAIR, 0.36, 0.09), m.white));
  fair.rotation.y = -Math.PI / 2;
  // a blue band sweeping down its flanks, and a dark chin under the lights
  const band = add(new THREE.Mesh(sideShape(BAND, 0.375, 0), m.blue)); band.rotation.y = -Math.PI / 2;
  const chin = add(new THREE.Mesh(sideShape(CHIN, 0.26, 0.03), m.black)); chin.rotation.y = -Math.PI / 2;
  // twin headlights under a dark visor across its face, angled down with the face; amber indicators at its corners
  const visor = add(rbox(0.27, 0.09, 0.05, 0.02, m.black), 0, 0.875, 0.855); visor.rotation.x = 0.35;
  [-1, 1].forEach(s => {
    const l = add(rbox(0.1, 0.055, 0.03, 0.014, m.lamp), s * 0.065, 0.877, 0.872); l.rotation.x = 0.35;
    const ind = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.03), m.amber), s * 0.2, 0.84, 0.8); ind.rotation.y = s * 0.5;
  });
  // the windscreen: tall and tinted, curving round
  const screen = add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 20, 1, true, -0.62, 1.24), m.glass), 0, 1.15, 0.43);
  screen.rotation.x = -0.55; screen.scale.set(0.72, 1, 0.5);
  // the dash behind it, and a red-and-blue pair up either side of the screen's foot (they flash with the bar)
  box(0.24, 0.06, 0.1, m.black, 0, 1.06, 0.5).rotation.x = -0.6;
  const fR = box(0.07, 0.045, 0.04, m.redOff, 0.15, 1.03, 0.64), fB = box(0.07, 0.045, 0.04, m.blueOff, -0.15, 1.03, 0.64);
  fR.rotation.x = fB.rotation.x = 0.35;
  // mirrors on stalks off the fairing's shoulders, handlebars and grips behind
  [-1, 1].forEach(s => {
    const stalk = cyl(0.008, 0.008, 0.1, m.black, s * 0.25, 1.06, 0.55); stalk.rotation.z = -s * 0.9;
    const mir = add(rbox(0.11, 0.06, 0.035, 0.014, m.black), s * 0.3, 1.1, 0.55); mir.rotation.y = -s * 0.15;
    cyl(0.02, 0.02, 0.11, m.black, s * 0.33, 1.02, 0.36).rotation.z = Math.PI / 2;
  });
  box(0.56, 0.026, 0.026, m.black, 0, 1.02, 0.36);
  // the back: a rack, two saddle bags and a top box, all white with a reflective yellow band and 警察 printed on
  box(0.3, 0.03, 0.42, m.black, 0, 0.88, -0.62);
  [-1, 1].forEach(s => {
    add(rbox(0.18, 0.34, 0.5, 0.06, m.white), s * 0.25, 0.62, -0.6);
    box(0.02, 0.05, 0.46, m.reflect, s * 0.34, 0.54, -0.6);
    const dec = add(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), m.decal), s * 0.341, 0.68, -0.6);
    dec.rotation.y = s * Math.PI / 2;
    // and on the fairing's flank
    const fd = add(new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), m.decal), s * 0.196, 0.96, 0.58);
    fd.rotation.y = s * Math.PI / 2;
  });
  add(rbox(0.44, 0.3, 0.4, 0.07, m.white), 0, 1.04, -0.72);
  box(0.42, 0.04, 0.02, m.reflect, 0, 0.98, -0.92);
  [-1, 1].forEach(s => box(0.06, 0.05, 0.02, m.tail, s * 0.14, 0.86, -0.92));
  // the light bar: on a short mast off the top box, red on the left, blue on the right, each with a glow round it
  cyl(0.014, 0.014, 0.26, m.black, 0, 1.3, -0.78, 8);
  box(0.46, 0.03, 0.08, m.black, 0, 1.43, -0.78);
  const red = box(0.2, 0.07, 0.08, m.redOff, 0.115, 1.48, -0.78), blue = box(0.2, 0.07, 0.08, m.blueOff, -0.115, 1.48, -0.78);
  const hR = add(new THREE.Sprite(m.haloR), 0.115, 1.48, -0.78), hB = add(new THREE.Sprite(m.haloB), -0.115, 1.48, -0.78);
  hR.scale.setScalar(0.6); hB.scale.setScalar(0.6);
  // foot pegs, and the side stand on the left (only down when parked)
  [-1, 1].forEach(s => box(0.08, 0.02, 0.03, m.black, s * 0.2, 0.33, -0.08));
  const stand = cyl(0.012, 0.012, 0.36, m.black, 0.16, 0.17, -0.05, 6); stand.rotation.z = 0.5; stand.visible = false;

  body.traverse(o => { if (o.isMesh) { o.castShadow = o.material !== m.glass && o.material !== m.decal; o.receiveShadow = true; } });
  // fewer draws: the pieces that sit still on it merged into a few meshes (each wheel's still turns as one), leaving out
  // only what changes on its own (the flashing lights swap materials, the stand shows and hides). Every geometry here is
  // its own: the pieces merged away are let go now, the rest with it (dispose)
  const built = new Set(); body.traverse(o => { if (o.isMesh) built.add(o.geometry); });   // (meshes only: every sprite shares three's one geometry)
  mergeParts(body, new Set([red, blue, fR, fB, stand]));
  const own = new Set(); body.traverse(o => { if (o.isMesh) own.add(o.geometry); });
  built.forEach(geo => { if (!own.has(geo)) geo.dispose(); });

  // the rider: an officer in the uniform, sat astride
  const rb = buildBody(OFFICER_LOOKS[i % OFFICER_LOOKS.length], `警察騎士${i}`, { detail: 0.55 });
  dressOfficer(rb);
  poseBody(rb, { ...restPose(0), ...RIDE_POSE });
  rb.g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  mergeParts(rb.g, bodyKeep(rb));   // (merged like the café's people; what's merged, and the uniform, is its own)
  rb.g.traverse(o => { if (o.isMesh && (o.userData.merged || o.userData.own)) own.add(o.geometry); });
  rb.g.position.set(0, 0.06, -0.24); body.add(rb.g);

  let flashT = 0, parked = false, lean = 0;
  return {
    g, rider: rb.g, front, rear, stand,
    // the bar and the front pair, alternating red and blue in quick double flashes
    flash(dt) {
      flashT += dt;
      const ph = (flashT * 2.2) % 1, dbl = k => (ph > k && ph < k + 0.1) || (ph > k + 0.16 && ph < k + 0.26);
      const r = dbl(0), b = dbl(0.5);
      red.material = fR.material = r ? m.redOn : m.redOff; blue.material = fB.material = b ? m.blueOn : m.blueOff;
      hR.visible = r; hB.visible = b;
    },
    // roll the wheels on by how far it's moved
    spin(dist) { front.spin.rotation.x += dist / R; rear.spin.rotation.x += dist / R; },
    park(on) { parked = on; },
    dispose() { own.forEach(geo => geo.dispose()); },
    // ease onto the stand (a few degrees over to the left) or back upright
    tick(dt) {
      lean += ((parked ? -0.09 : 0) - lean) * Math.min(1, dt * 4);
      body.rotation.z = lean; stand.visible = lean < -0.03;
    },
  };
}
