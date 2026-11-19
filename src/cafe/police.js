// 警察: what makes an officer an officer, laid over an ordinary 捏臉 body (body.js). Only the police wear these, so
// they're drawn here rather than offered in the back office's editor: a badge on a navy cap, a fluorescent vest with reflective
// bands and 警察 / POLICE printed on it, a radio on the shoulder, and a duty belt with a radio, a baton and a holster.
// The vest is built over the body's own torso, so it fits whatever build and height they are.
import * as THREE from 'three';

// the officers' looks, for drunk.js and the preview: a light-blue uniform shirt, navy trousers, black boots
export const OFFICER_LOOKS = [
  { skin: 0xd9a77e, hair: 0x15120f, hairStyle: 'short', shirt: 0x9dc1e3, pants: 0x1c2338,
    body: 'male', height: 'regular', build: 'regular', faceShape: 'round', hairFront: 'none', brows: 'thick',
    topStyle: 'shirt', topPattern: 'none', bottom: 'pants', shoeStyle: 'boots', shoe: 0x141414, hat: 'cap', hatColor: 0x1d2a4a },
  { skin: 0xc99670, hair: 0x1e1712, hairStyle: 'short', shirt: 0x9dc1e3, pants: 0x1c2338,
    body: 'male', height: 'tall', build: 'stocky', faceShape: 'round', hairFront: 'none', brows: 'straight',
    topStyle: 'shirt', topPattern: 'none', bottom: 'pants', shoeStyle: 'boots', shoe: 0x141414, hat: 'cap', hatColor: 0x1d2a4a },
];

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
const NAVY = 0x1d2a4a, GOLD = 0xd8a93a;

// a canvas of text, for printing on the vest
function printed(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
const FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
let BACK_TEX = null, CHEST_TEX = null;
const backTex = () => BACK_TEX || (BACK_TEX = printed(512, 256, (x, w, h) => {
  x.fillStyle = '#1b2440'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `900 150px ${FONT}`; x.fillText('警 察', w / 2, h * 0.4);
  x.font = '800 62px Arial, sans-serif'; x.fillText('POLICE', w / 2, h * 0.84);
}));
const chestTex = () => CHEST_TEX || (CHEST_TEX = printed(256, 128, (x, w, h) => {
  x.fillStyle = '#1b2440'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `900 92px ${FONT}`; x.fillText('警察', w / 2, h * 0.54);
}));

// the torso's surface, read off its own geometry: its radius at height y and angle a (0 straight ahead, +x at π/2)
function torsoSurface(geom) {
  const p = geom.attributes.position, rows = new Map();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = Math.round(y * 2000);
    if (!rows.has(k)) rows.set(k, { y, pts: [] });
    rows.get(k).pts.push([Math.atan2(p.getX(i), p.getZ(i)), Math.hypot(p.getX(i), p.getZ(i))]);
  }
  const R = [...rows.values()].filter(r => r.pts.length >= 8).sort((a, b) => a.y - b.y);
  R.forEach(r => r.pts.sort((a, b) => a[0] - b[0]));
  const round = (pts, a) => {
    a = Math.atan2(Math.sin(a), Math.cos(a));
    let j = pts.findIndex(q => q[0] >= a);
    if (j < 0) j = 0;
    const [a1, r1] = pts[j], [a0, r0] = pts[(j - 1 + pts.length) % pts.length];
    let span = a1 - a0, d = a - a0; if (span <= 0) span += Math.PI * 2; if (d < 0) d += Math.PI * 2;
    return r0 + (r1 - r0) * Math.min(1, d / (span || 1));
  };
  return (y, a) => {
    let j = R.findIndex(r => r.y >= y); if (j <= 0) j = j < 0 ? R.length - 1 : 1;
    const A = R[j - 1], B = R[j], t = Math.min(1, Math.max(0, (y - A.y) / (B.y - A.y || 1)));
    return round(A.pts, a) + (round(B.pts, a) - round(A.pts, a)) * t;
  };
}

// a patch lying on the torso from height y0 to y1 and angle a0 to a1, `off` out from it; quads where skip(y, a) are
// left out (the vest's neck and armholes). uv runs u along the angle, v up.
function patch(surf, { y0, y1, a0, a1, ny = 24, na = 72, off = 0.008, skip = null }) {
  const pos = [], uv = [], ix = [];
  for (let r = 0; r <= ny; r++) for (let i = 0; i <= na; i++) {
    const y = y0 + (y1 - y0) * r / ny, a = a0 + (a1 - a0) * i / na, rr = surf(y, a) + off;
    pos.push(Math.sin(a) * rr, y, Math.cos(a) * rr); uv.push(i / na, r / ny);
  }
  for (let r = 0; r < ny; r++) for (let i = 0; i < na; i++) {
    const y = y0 + (y1 - y0) * (r + 0.5) / ny, a = a0 + (a1 - a0) * (i + 0.5) / na;
    if (skip && skip(y, a)) continue;
    const q = r * (na + 1) + i, w = q + na + 1;
    ix.push(q, q + 1, w, w, q + 1, w + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix); g.computeVertexNormals(); return g;
}

const VEST = { bot: 0.79, top: 1.235 };
// the V of the neck in front, and the armholes, both opening wider toward the shoulders
const vHalf = y => 0.52 * Math.min(1, Math.max(0, (y - 1.03) / 0.2));
const armHalf = y => 0.56 * Math.min(1, Math.max(0, (y - 1.07) / 0.16)) ** 0.7;
const vestSkip = (y, a) => {
  const d = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));   // 0 in front, π behind
  return d < vHalf(y) || Math.abs(d - Math.PI / 2) < armHalf(y);
};

function vest(torso) {
  const surf = torsoSurface(torso.geometry), parts = [];
  const add = (geom, m, shadow = true) => { const me = new THREE.Mesh(geom, m); me.castShadow = shadow; me.receiveShadow = true; torso.add(me); parts.push(me); return me; };
  const lime = M(0xc4f01c, { roughness: 0.6, emissive: 0x4a6000, emissiveIntensity: 0.45, side: THREE.DoubleSide });
  add(patch(surf, { y0: VEST.bot, y1: VEST.top, a0: -Math.PI, a1: Math.PI, ny: 36, na: 96, off: 0.009, skip: vestSkip }), lime);
  // its edge: a navy binding round the hem
  add(patch(surf, { y0: VEST.bot - 0.004, y1: VEST.bot + 0.014, a0: -Math.PI, a1: Math.PI, ny: 1, na: 96, off: 0.0105 }), M(NAVY, { side: THREE.DoubleSide }), false);
  // two reflective silver bands all the way round
  const silver = M(0xdfe4e6, { roughness: 0.3, metalness: 0.4, emissive: 0x777f84, emissiveIntensity: 0.35 });
  [[0.855, 0.885], [0.95, 0.98]].forEach(([y0, y1]) => add(patch(surf, { y0, y1, a0: -Math.PI, a1: Math.PI, ny: 1, na: 96, off: 0.0105 }), silver, false));
  // 警察 / POLICE across the back, and 警察 on the right chest
  const ink = map => new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 });
  add(patch(surf, { y0: 1.025, y1: 1.165, a0: Math.PI - 0.7, a1: Math.PI + 0.7, ny: 6, na: 28, off: 0.0115 }), ink(backTex()), false);
  add(patch(surf, { y0: 1.04, y1: 1.085, a0: -0.68, a1: -0.24, ny: 3, na: 12, off: 0.0115 }), ink(chestTex()), false);
  // a badge on the left chest, and the radio on the left shoulder strap
  const at = (y, a, out) => { const r = surf(y, a) + out; return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r); };
  const badge = add(new THREE.CylinderGeometry(0.019, 0.019, 0.006, 6).rotateX(Math.PI / 2), M(GOLD, { metalness: 0.8, roughness: 0.3 }), false);
  badge.position.copy(at(1.07, 0.45, 0.013)); badge.rotation.y = 0.45;
  const mic = add(new THREE.BoxGeometry(0.034, 0.05, 0.02), M(0x161616, { roughness: 0.5 }));
  mic.position.copy(at(1.17, 0.78, 0.02)); mic.rotation.y = 0.78;
  return { parts, surf };
}

function dutyBelt(torso, surf) {
  const parts = [], add = (geom, m) => { const me = new THREE.Mesh(geom, m); me.castShadow = true; me.receiveShadow = true; torso.add(me); parts.push(me); return me; };
  const black = M(0x141414, { roughness: 0.45 }), y = 0.745;
  add(patch(surf, { y0: y - 0.022, y1: y + 0.022, a0: -Math.PI, a1: Math.PI, ny: 1, na: 72, off: 0.014 }), M(0x111111, { roughness: 0.5, side: THREE.DoubleSide }));
  const at = (a, out) => { const r = surf(y, a) + out; return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r); };
  const buckle = add(new THREE.BoxGeometry(0.05, 0.036, 0.008), M(0xbfc4c8, { metalness: 0.8, roughness: 0.3 }));
  buckle.position.copy(at(0, 0.018));
  // the radio on the left hip (+x), a stubby aerial up out of it
  const radio = add(new THREE.BoxGeometry(0.04, 0.075, 0.028), black);
  radio.position.copy(at(1.05, 0.03)).setY(y - 0.012); radio.rotation.y = 1.05;
  const aerial = add(new THREE.CylinderGeometry(0.004, 0.005, 0.05, 6), black);
  aerial.position.copy(radio.position).setY(y + 0.045);
  // the holster on the right hip (-x), the baton hanging behind it
  const holster = add(new THREE.BoxGeometry(0.035, 0.09, 0.05), black);
  holster.position.copy(at(-1.25, 0.03)).setY(y - 0.03); holster.rotation.y = -1.25;
  const baton = add(new THREE.CylinderGeometry(0.011, 0.011, 0.36, 8), black);
  baton.position.copy(at(-2.1, 0.022)).setY(y - 0.1); baton.rotation.set(0.12, 0, 0.1);
  return parts;
}

// the cap is the 捏臉 棒球帽 in navy (OFFICER_LOOKS); on its front, printed on the cloth itself, a gold badge over 警察.
// The print is laid onto the cap's own surface: rays out from the middle of the head find the cap's outside at each
// point of a small grid, so it follows the crown's curve however the cap is shaped.
let CAP_TEX = null;
const capTex = () => CAP_TEX || (CAP_TEX = printed(256, 224, (x, w) => {
  // the badge: a gold hexagon, a navy ring and a blue middle
  const hex = (r, fill) => { x.beginPath(); for (let k = 0; k < 6; k++) { const t = Math.PI / 6 + k * Math.PI / 3; x.lineTo(w / 2 + Math.cos(t) * r, 64 + Math.sin(t) * r); } x.closePath(); x.fillStyle = fill; x.fill(); };
  hex(54, '#e6b64a'); hex(40, '#1b2440');
  x.beginPath(); x.arc(w / 2, 64, 26, 0, Math.PI * 2); x.fillStyle = '#e6b64a'; x.fill();
  x.beginPath(); x.arc(w / 2, 64, 16, 0, Math.PI * 2); x.fillStyle = '#3a63b8'; x.fill();
  x.fillStyle = '#e6b64a'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `900 80px ${FONT}`; x.fillText('警察', w / 2, 172);
}));
const PRINT = { w: 0.76, el0: 0.6, el1: 1.05, nu: 14, nv: 12, off: 0.0012 };   // its spread round the head and up the crown (radians)
function capPrint(head) {
  head.updateMatrixWorld(true);
  const targets = []; head.traverse(o => { if (o.isMesh && o.visible) targets.push(o); });
  const ray = new THREE.Raycaster(), origin = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld);
  const toLocal = new THREE.Matrix4().copy(head.matrixWorld).invert(), q = new THREE.Quaternion().setFromRotationMatrix(head.matrixWorld);
  const pos = [], uv = [], ix = [], d = new THREE.Vector3();
  for (let j = 0; j <= PRINT.nv; j++) for (let i = 0; i <= PRINT.nu; i++) {
    const u = i / PRINT.nu, v = j / PRINT.nv, az = (u - 0.5) * PRINT.w, el = PRINT.el0 + (PRINT.el1 - PRINT.el0) * v;
    d.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    const dw = d.clone().applyQuaternion(q).normalize();
    ray.set(origin, dw);
    // (the outermost surface along it: the cap, over the hair and the head)
    const hits = ray.intersectObjects(targets, false), far = hits.length ? hits[hits.length - 1].distance : 0.2;
    const p = origin.clone().addScaledVector(dw, far + PRINT.off).applyMatrix4(toLocal);
    pos.push(p.x, p.y, p.z); uv.push(u, v);
  }
  for (let j = 0; j < PRINT.nv; j++) for (let i = 0; i < PRINT.nu; i++) {
    const a = j * (PRINT.nu + 1) + i, c = a + PRINT.nu + 1;
    ix.push(a, a + 1, c, c, a + 1, c + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: capTex(), transparent: true, roughness: 0.55, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2 }));
  head.add(m); return m;
}

// put the uniform's pieces on a built body (buildBody's result, or a Person, which carries the same parts)
export function dressOfficer(b) {
  const hat = capPrint(b.head);
  const { parts, surf } = vest(b.torso);
  return [hat, ...parts, ...dutyBelt(b.torso, surf)];
}
