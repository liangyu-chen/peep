// The lane outside, after the street-view photo of the shop front: a narrow asphalt alley with 停 消防通道 painted before the crossroads,
// old two- to four-storey row houses either side of the shop (tiled or washed-concrete fronts, blue roller shutters, balconies with
// railings, iron window cages, AC boxes, wires sagging along the walls), parked scooters and bikes,
// and now and then a car or a scooter coming down the one-way lane, stopping for anyone in the way.
// Built after the set is squeezed, so it is in plain world metres. Buildings that come between the camera and what it
// looks at fade away, the way the shop's own outer walls do.
import * as THREE from 'three';
import { ctx, mat as rawMat, canvasTex } from '../engine.js';
import { S } from '../state.js';
import { rand, randi, pick, K as SQ } from '../util.js';
import { KERB, RISE } from '../layout.js';

let env;
// colours as they should look on screen
const col = hex => new THREE.Color(hex).convertSRGBToLinear();
const mat = (hex, o) => rawMat(col(hex), o);

const FRONT = 8.1;                 // our row's frontage (the shop's arcade edge)
const BACK = -8.35;                // and its back, in line with the shop's back wall
const LANE_W = 4.8;                // the lane is narrow: a car and a scooter can just pass
// the row's frontage is raised: a concrete step out to the kerb, the lane RISE below it
const LANE0 = 9.6;                 // the lane's near edge, a strip of street in front of the kerb
const OPP = LANE0 + LANE_W;        // the lane's far edge
const LANE_Z = LANE0 + LANE_W / 2;
const ONE_WAY = 1;                 // the lane is one-way: everything drives toward +x
const CROSS0 = 13.6, CROSS1 = 19.6; // a cross street meets the lane there (right of the shop, seen from the lane)

// ---------------------------------------------------------------- textures
const TEX = {};
function tiles(key, base, grout, n = 8) {
  return TEX[key] || (TEX[key] = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = grout; g.fillRect(0, 0, w, h);
    const s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = new THREE.Color(base).offsetHSL(0, 0, rand(-0.04, 0.03));
      g.fillStyle = `#${c.getHexString()}`; g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
    }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(40,36,30,0.10)'; g.fillRect(rand(0, w), 0, rand(4, 14), h); }   // rain streaks
  }));
}
function washed(key, base) {
  return TEX[key] || (TEX[key] = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,38,34' : '255,255,250'},${rand(0.03, 0.09)})`; g.fillRect(rand(0, w), rand(0, h), rand(2, 10), rand(2, 10)); }
    for (let i = 0; i < 10; i++) { const x = rand(0, w); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(30,30,28,0.25)'); gr.addColorStop(1, 'rgba(30,30,28,0)'); g.fillStyle = gr; g.fillRect(x, 0, rand(3, 9), h * rand(0.3, 0.9)); }
  }));
}
const shutterTex = () => TEX.shutter || (TEX.shutter = canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#4f7fa8'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 4) { g.fillStyle = '#3d6a91'; g.fillRect(0, y, w, 1); g.fillStyle = '#6b98be'; g.fillRect(0, y + 2, w, 1); }
  g.fillStyle = 'rgba(30,30,30,0.18)'; g.fillRect(0, h - 18, w, 18);
}));
const asphaltTex = () => TEX.asphalt || (TEX.asphalt = (() => {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4a4a4c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { const v = randi(50, 95); g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(rand(0, w), rand(0, h), 1.5, 1.5); }
    for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(30,30,32,${rand(0.15, 0.3)})`; g.fillRect(rand(0, w), rand(0, h), rand(30, 90), rand(20, 60)); }   // patches
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})());

// the lane is mostly hardware shops; each name is used once (dealt from a shuffled deck, no sign once it runs out)
const SIGNS = [['永興五金行', '水電材料'], ['大同五金行', '工具 螺絲'], ['協益五金行', ''], ['金順五金行', '油漆 塗料'], ['振昌五金行', '鎖匙 門鎖'],
  ['合發五金行', ''], ['新泰五金行', '水電器材'], ['東昇五金行', '五金百貨'], ['萬全五金行', ''], ['大同鐵工', '鐵窗鐵門']];
let signDeck = [];
function signTex(lines, bg) {
  const fg = bg === '#f2efe6' ? '#b8232b' : '#ffffff';
  const t = canvasTex(256, 96, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10);
    // each line as big as it's meant to be, or smaller if it would run past the border
    const fit = (text, size, weight, y) => {
      g.font = `${weight}${size}px "Noto Sans TC", sans-serif`;
      const s = Math.min(size, Math.floor(size * (w - 28) / g.measureText(text).width));
      g.font = `${weight}${s}px "Noto Sans TC", sans-serif`; g.fillText(text, w / 2, y);
    };
    g.fillStyle = fg; g.textAlign = 'center'; fit(lines[0], 40, 'bold ', lines[1] ? 46 : 62);
    if (lines[1]) fit(lines[1], 26, '', 80);
  });
  S.fontTex.push(t); return t;
}

// ---------------------------------------------------------------- building parts (in a building's local space:
// x across its frontage, the front face at z = 0, the body going back to -z)
function bx(g, w, h, d, m, x, y, z, cast = true) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = cast; me.receiveShadow = true; g.add(me); return me;
}
function pl(g, w, h, m, x, y, z) { const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, y, z); me.receiveShadow = true; g.add(me); return me; }

// a building's own materials, so it can fade on its own
function kit() {
  const list = [];
  const own = m => { list.push(m); return m; };
  return { list, own, m: (hex, o) => own(mat(hex, o)) };
}

function windowUnit(g, K, x, y, w, h, opts = {}) {
  bx(g, w + 0.08, h + 0.08, 0.06, K.alu, x, y, 0.02);                       // aluminium frame
  const glass = K.own(new THREE.MeshStandardMaterial({ color: col(0x37434c), emissive: col(0xffcf8a), emissiveIntensity: 0, roughness: 0.15, metalness: 0.4 }));
  if (Math.random() < 0.55) S.envWindows.push(glass);                       // the ones someone's home behind, lit at night
  pl(g, w, h, glass, x, y, 0.055);
  bx(g, 0.03, h, 0.03, K.alu, x, y, 0.07, false);                           // the sliding sash's middle
  if (opts.cage) {                                                           // 鐵窗: an iron cage standing out from the wall
    const D = 0.32, cm = K.iron, n = Math.max(3, Math.round(w / 0.12));
    bx(g, w + 0.2, 0.03, D, cm, x, y + h / 2 + 0.08, D / 2, false); bx(g, w + 0.2, 0.03, D, cm, x, y - h / 2 - 0.08, D / 2, false);
    for (let i = 0; i <= n; i++) bx(g, 0.018, h + 0.16, 0.018, cm, x - w / 2 - 0.08 + i * ((w + 0.16) / n), y, D, false);
    bx(g, w + 0.2, 0.02, 0.02, cm, x, y, D, false);
    if (Math.random() < 0.6) bx(g, rand(0.15, 0.4), rand(0.15, 0.3), 0.2, K.m(pick([0xb43a2e, 0x3f6db3, 0xd8c08a, 0x5b8c4a])), x + rand(-w / 3, w / 3), y - h / 2 + 0.05, D / 2, false);   // something kept in the cage
  }
  if (opts.ac) {
    bx(g, 0.62, 0.42, 0.5, K.acM, x + w / 2 + 0.45, y + 0.1, 0.25);
    bx(g, 0.56, 0.3, 0.01, K.vent, x + w / 2 + 0.45, y + 0.1, 0.505, false);
  }
}

function railing(g, K, w, y, z) {
  const n = Math.round(w / 0.11);
  for (let i = 0; i <= n; i++) bx(g, 0.02, 0.95, 0.02, K.rail, -w / 2 + i * (w / n), y + 0.5, z, false);
  bx(g, w, 0.04, 0.05, K.rail, 0, y + 1.0, z, false); bx(g, w, 0.03, 0.03, K.rail, 0, y + 0.1, z, false);
}

function fixtures(K) {
  return Object.assign(K, {
    alu: K.m(0xb9bcbd, { metalness: 0.6, roughness: 0.4 }), iron: K.m(pick([0x3b3f42, 0x5a5f61, 0x6d4b3a]), { metalness: 0.5, roughness: 0.6 }),
    rail: K.m(pick([0xc8cacb, 0x8a8f91, 0x4c5255]), { metalness: 0.6, roughness: 0.4 }), acM: K.m(0xe6e3dc, { roughness: 0.6 }), vent: K.m(0x8c8c88),
    slab: K.m(0x8f8b84, { roughness: 0.95 }), dark: K.m(0x2b2a28, { roughness: 0.9 }),
  });
}

// one row house: ground floor shop (shutter or open front), `floors` upper floors, a flat roof (maybe a tin shed on it).
// `corner` (+1 / -1) is the side that faces a cross street: that side gets windows too, and the corner shop's ground floor
// is open with its goods out and its sign on both faces
// `nextDoor` is the house right beside the shop, after the photos: a blue roller shutter pulled down, a steel door
// with a grille in it to its left, and its blue sign
function rowHouse(x0, x1, frontZ, facing, floors, depth, corner = 0, shop = null, nextDoor = false) {
  const w = x1 - x0, K = fixtures(kit());
  const g = new THREE.Group(); g.position.set((x0 + x1) / 2, -RISE, frontZ); g.rotation.y = facing > 0 ? 0 : Math.PI; env.add(g);   // on the street; only our shop is raised
  const faceTex = Math.random() < 0.6
    ? tiles(`t${randi(0, 3)}`, pick([0xd8c9a8, 0xc9b9a0, 0xe0d6c4, 0xbfa58c]), '#8d8478')
    : washed(`w${randi(0, 3)}`, pick(['#a9a59c', '#b8b2a6', '#9c978e', '#c2bcb0']));
  const face = K.own(new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.95 }));
  const GF = 3.1, FH = 2.9, H = GF + floors * FH;
  bx(g, w, H, depth, face, 0, H / 2, -depth / 2);
  // ground floor: a roller shutter (mostly down), or an open front with a door and a caged window; maybe a sign
  bx(g, w, 0.35, 0.25, K.slab, 0, GF - 0.05, 0.12);                          // the floor slab edge over the front
  if (nextDoor) {
    const st = K.own(new THREE.MeshStandardMaterial({ map: shutterTex(), roughness: 0.6, metalness: 0.3 })), sh = GF - 0.35;
    const sw = w * 0.66, sx = w / 2 - 0.2 - sw / 2;
    pl(g, sw, sh, st, sx, GF - 0.25 - sh / 2, 0.03);
    bx(g, sw + 0.1, 0.28, 0.3, K.m(0x3d6a91, { metalness: 0.4, roughness: 0.5 }), sx, GF - 0.38, 0.12);   // the shutter's box
    bx(g, 0.1, GF - 0.3, 0.12, K.m(0x2a4a8a, { roughness: 0.6 }), w / 2 - 0.12, (GF - 0.3) / 2, 0.06);   // the blue post at its edge
    const dx = -w / 2 + 0.75, steel = K.m(0xa9aaa6, { metalness: 0.5, roughness: 0.45 });
    bx(g, 0.95, 2.15, 0.06, steel, dx, 1.075, 0.04);                                                      // the steel door
    for (let i = 0; i < 9; i++) bx(g, 0.012, 0.6, 0.012, K.iron, dx - 0.3 + i * 0.075, 1.6, 0.08, false);  // the grille in its top half
    bx(g, 0.66, 0.02, 0.012, K.iron, dx, 1.3, 0.08, false); bx(g, 0.66, 0.02, 0.012, K.iron, dx, 1.9, 0.08, false);
    bx(g, 0.02, 0.22, 0.04, steel, dx + 0.36, 1.0, 0.1);                                                   // its handle
    bx(g, 1.2, 0.18, 0.3, K.slab, dx, 0.09, 0.2);                                                          // the step up to it
  } else if (shop) {
    pl(g, w - 0.5, GF - 0.4, K.dark, 0, (GF - 0.4) / 2, 0.02);
    for (let i = 0; i < 9; i++) { const h = rand(0.25, 0.7); bx(g, rand(0.3, 0.6), h, rand(0.3, 0.5), K.m(pick([0xd94a2b, 0x3f6db3, 0xe8c547, 0x5b8c4a, 0xd8d4c8, 0x6b5a48])), rand(-w / 2 + 0.5, w / 2 - 0.5), h / 2, rand(-0.6, 0.4)); }   // goods stacked out front
  } else if (Math.random() < 0.55) {
    const st = K.own(new THREE.MeshStandardMaterial({ map: shutterTex(), roughness: 0.6, metalness: 0.3 }));
    const down = Math.random() < 0.7 ? 1 : rand(0.35, 0.6), sh = GF - 0.35;
    pl(g, w - 0.5, sh * down, st, 0, GF - 0.25 - sh * down / 2, 0.03);
    bx(g, w - 0.4, 0.28, 0.3, K.m(0x3d6a91, { metalness: 0.4, roughness: 0.5 }), 0, GF - 0.38, 0.12);   // the shutter's box
    if (down < 1) pl(g, w - 0.5, sh * (1 - down), K.dark, 0, sh * (1 - down) / 2, 0.02);
  } else {
    pl(g, w - 0.5, GF - 0.4, K.dark, 0, (GF - 0.4) / 2, 0.02);
    bx(g, 0.9, 2.1, 0.05, K.m(pick([0x8d8f88, 0x6b5a48, 0xb8b2a4])), -w / 4, 1.05, 0.06);                 // door
    windowUnit(g, K, w / 4, 1.5, Math.min(1.4, w / 3), 1.0, { cage: true });
  }
  const name = nextDoor ? ['政泰', '刨床加工 各式零件承製'] : shop || (Math.random() < 0.45 && signDeck.pop());
  if (name) {
    const sm = K.own(new THREE.MeshStandardMaterial({ map: signTex(name, nextDoor ? '#1f4f9a' : pick(['#1f4f9a', '#b8232b', '#f2efe6', '#1c6a43'])), roughness: 0.7 }));
    const sw = Math.min(1.6, w * 0.45);
    bx(g, sw, sw * 0.375, 0.06, sm, shop ? 0 : nextDoor ? w / 2 - sw / 2 - 0.2 : rand(-w / 4, w / 4), GF + 0.38, 0.3);
    if (shop) bx(g, 0.06, sw * 0.375, sw, sm, corner * (w / 2 + 0.3), GF + 0.38, -sw / 2 - 0.3);   // round the corner too
  }
  if (corner) {   // the side on the cross street, built in its own frame: front out toward the street, x running back along it
    const sg = new THREE.Group(); sg.position.set(corner * w / 2, 0, 0); sg.rotation.y = corner * Math.PI / 2; g.add(sg);
    bx(sg, depth, 0.12, 0.1, K.slab, corner * depth / 2, GF, 0.03, false);
    if (shop) pl(sg, 2.4, GF - 0.4, K.dark, corner * 1.6, (GF - 0.4) / 2, 0.02);
    else windowUnit(sg, K, corner * 2.2, 1.5, 1.2, 1.0, { cage: true });
    for (let f = 0; f < floors; f++) [2.2, 6.0, 10.5].forEach(d => windowUnit(sg, K, corner * d, GF + f * FH + 1.45, 1.3, 1.2, { cage: Math.random() < 0.6, ac: Math.random() < 0.3 }));
  }
  // upper floors
  for (let f = 0; f < floors; f++) {
    const y0 = GF + f * FH;
    if (f === 0 && Math.random() < 0.55) {
      bx(g, w, 0.18, 1.0, K.slab, 0, y0 + 0.09, 0.5);                       // balcony
      railing(g, K, w - 0.05, y0 + 0.18, 0.98);
      windowUnit(g, K, 0, y0 + 1.45, Math.min(2.2, w * 0.55), 1.5, { ac: Math.random() < 0.5 });
      if (Math.random() < 0.6) for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), K.m(pick([0x5f8f55, 0x6f9f5c]), { flatShading: true })); p.position.set(rand(-w / 2 + 0.4, w / 2 - 0.4), y0 + 0.4, 0.75); g.add(p); }   // pot plants
    } else {
      const n = w > 4.2 ? 2 : 1, ww = Math.min(1.5, (w - 0.8) / n - 0.3);
      for (let k = 0; k < n; k++) windowUnit(g, K, (k - (n - 1) / 2) * (w / n), y0 + 1.45, ww, 1.25, { cage: Math.random() < 0.7, ac: Math.random() < 0.4 });
    }
    bx(g, w + 0.02, 0.12, 0.1, K.slab, 0, y0, 0.03, false);                  // floor line
    if (Math.random() < 0.25) bx(g, 0.35, 0.55, 0.01, K.m(0xc4302b), rand(-w / 3, w / 3), y0 + 2.3, 0.04, false);   // a red couplet
  }
  // roof: parapet, a water tower, sometimes a tin shed built on top
  bx(g, w, 0.9, 0.15, face, 0, H + 0.45, -0.08);
  if (floors < 2 && Math.random() < 0.6) {          // a tin shed on top only of the two-storey ones, so nothing tops three storeys
    const tin = K.m(pick([0x4f7fa8, 0x8e8a80, 0x9b5a3c]), { metalness: 0.4, roughness: 0.6 });
    bx(g, w - 0.3, 2.2, depth * 0.6, tin, 0, H + 1.1, -depth * 0.45);
    bx(g, w - 0.1, 0.08, depth * 0.62, tin, 0, H + 2.25, -depth * 0.45).rotation.x = 0.06;
  }
  if (Math.random() < 0.6) {
    const tz = -depth + 1.2, tx = rand(-w / 4, w / 4);
    bx(g, 0.9, 0.7, 0.9, K.iron, tx, H + 0.35, tz);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.0, 12), K.m(pick([0xe9e6dd, 0x3e7db8]))); t.position.set(tx, H + 1.2, tz); t.castShadow = true; g.add(t);
  }
  S.envBlocks.push({ group: g, mats: K.list, box: new THREE.Box3().setFromObject(g), fade: 1 });
}

// the shop's own upper floors: a washed-concrete front with the balcony hanging out over the arcade, like the photo
function shopUpstairs() {
  const K = fixtures(kit()), g = new THREE.Group(); g.position.set(0, 0, FRONT - 0.15); env.add(g);
  const w = 4.5;
  const face = K.own(new THREE.MeshStandardMaterial({ map: washed('shop', '#a8a49b'), roughness: 0.95 }));
  bx(g, w, 6.0, 0.3, face, 0, 6.1, -0.15);
  bx(g, w, 0.2, 1.4, K.slab, 0, 3.15, 0.55);                                // the balcony slab, overhanging the arcade
  railing(g, K, w - 0.05, 3.25, 1.2);
  windowUnit(g, K, 0.3, 4.6, 2.2, 1.6, {});
  bx(g, 0.7, 0.45, 0.5, K.acM, -1.55, 5.35, 0.3);                           // the window AC
  windowUnit(g, K, 0, 7.4, 2.4, 1.3, { cage: true });
  bx(g, w, 0.9, 0.15, face, 0, 9.55, -0.1);                                 // parapet
  S.envBlocks.push({ group: g, mats: K.list, box: new THREE.Box3().setFromObject(g), fade: 1 });
}

// wires sagging along a row of fronts
function wires(z, y, x0, x1) {
  const m = mat(0x1f1f1f, { roughness: 0.8 });
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let x = x0; x <= x1; x += 2) pts.push(new THREE.Vector3(x, y + k * 0.08 - 0.25 * Math.sin(((x - x0) % 8) / 8 * Math.PI), z + k * 0.05));
    env.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 4, 0.012, 4), m));
  }
}

// a parked (or ridden) scooter, and a bicycle
const SCOOTER_COLS = [0xf2f2ef, 0x2b2f36, 0xb8bcc0, 0x9c2b2b, 0x3c5f8f, 0xd9cfb5];
function scooterModel(c) {
  const g = new THREE.Group(), bodyM = mat(c, { roughness: 0.4, metalness: 0.2 }), blk = mat(0x1d1d1f, { roughness: 0.6 });
  [0.55, -0.55].forEach(z => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.09, 14), blk); w.rotation.z = Math.PI / 2; w.position.set(0, 0.2, z); w.castShadow = true; g.add(w); });
  bx(g, 0.34, 0.35, 0.9, bodyM, 0, 0.42, -0.15); bx(g, 0.3, 0.12, 0.6, blk, 0, 0.66, -0.2);
  bx(g, 0.34, 0.7, 0.16, bodyM, 0, 0.62, 0.48).rotation.x = -0.25; bx(g, 0.6, 0.04, 0.04, blk, 0, 1.0, 0.42);
  bx(g, 0.16, 0.1, 0.06, mat(0xfff4d6, { emissive: col(0xfff0c8), emissiveIntensity: 0.4 }), 0, 0.88, 0.58, false);
  return g;
}
function bike(c) {
  const g = new THREE.Group(), fm = mat(c, { metalness: 0.4, roughness: 0.4 }), blk = mat(0x1d1d1f);
  [0.45, -0.45].forEach(z => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 18), blk); w.rotation.y = Math.PI / 2; w.position.set(0, 0.32, z); g.add(w); });
  bx(g, 0.03, 0.03, 0.8, fm, 0, 0.6, 0, false); bx(g, 0.03, 0.5, 0.03, fm, 0, 0.5, -0.15, false); bx(g, 0.03, 0.5, 0.03, fm, 0, 0.55, 0.38, false);
  bx(g, 0.12, 0.04, 0.2, blk, 0, 0.78, -0.18, false); bx(g, 0.45, 0.03, 0.03, blk, 0, 0.85, 0.4, false);
  if (Math.random() < 0.6) bx(g, 0.3, 0.2, 0.25, mat(0x9aa0a6, { metalness: 0.5 }), 0, 0.72, 0.6, false);   // front basket
  return g;
}

// ---------------------------------------------------------------- traffic
function carModel() {
  const g = new THREE.Group(), c = pick([0xf1f1ee, 0xbfc3c6, 0x2a2d31, 0x8a1f24, 0x2c4a73, 0xe8c23a]);
  const paint = mat(c, { roughness: 0.3, metalness: 0.5 }), glass = mat(0x23292e, { roughness: 0.1, metalness: 0.6 }), blk = mat(0x161616);
  bx(g, 1.62, 0.62, 3.9, paint, 0, 0.55, 0);
  bx(g, 1.5, 0.55, 2.0, paint, 0, 1.12, -0.25);
  bx(g, 1.52, 0.42, 1.7, glass, 0, 1.13, -0.25, false);
  [[0.72, 1.3], [-0.72, 1.3], [0.72, -1.3], [-0.72, -1.3]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.22, 14), blk); w.rotation.z = Math.PI / 2; w.position.set(x, 0.31, z); w.castShadow = true; g.add(w); });
  const head = mat(0xfff6dc, { emissive: col(0xfff1c8), emissiveIntensity: 0.8 }), tail = mat(0xb01818, { emissive: col(0xff2a1a), emissiveIntensity: 0.6 });
  [-0.55, 0.55].forEach(x => { bx(g, 0.3, 0.12, 0.04, head, x, 0.68, 1.96, false); bx(g, 0.28, 0.12, 0.04, tail, x, 0.7, -1.96, false); });
  bx(g, 0.4, 0.12, 0.02, mat(0xf2f2f2), 0, 0.45, 1.96, false);                // plate
  return { g, len: 4.0, vmax: 4.2 };
}
function riderModel() {
  const g = scooterModel(pick(SCOOTER_COLS));
  const shirt = mat(pick([0x3a5f8f, 0xd9d4c8, 0x8f3a3a, 0x3d6b4f, 0x2b2b2b]), { roughness: 0.8 });
  bx(g, 0.4, 0.55, 0.26, shirt, 0, 1.05, -0.2);                             // rider
  bx(g, 0.34, 0.45, 0.4, mat(0x2f3540), 0, 0.72, 0.0).rotation.x = -0.3;     // legs
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat(pick([0xf2f2ef, 0xd23a2e, 0x1f6fd1, 0xf0c419]), { roughness: 0.3 }));
  helmet.position.set(0, 1.5, -0.18); helmet.castShadow = true; g.add(helmet);
  bx(g, 0.3, 0.1, 0.06, mat(0xd9b38c), 0, 1.4, -0.08, false);               // face under the visor
  [-1, 1].forEach(s => { bx(g, 0.08, 0.08, 0.45, shirt, s * 0.22, 1.12, 0.12, false).rotation.x = -0.4; });   // arms out to the bars
  return { g, len: 1.6, vmax: 5.5 };
}
const traffic = [];
let nextT = 5;
// the lane is narrow: one vehicle at a time, car or scooter, down the middle
function spawn(kind) {
  const v = kind === 'car' ? carModel() : riderModel();
  const dir = ONE_WAY;
  const z = kind === 'car' ? LANE_Z + 0.2 : LANE_Z + rand(-0.3, 0.3);
  v.g.position.set(-dir * 42, -RISE, z); v.g.rotation.y = dir * Math.PI / 2; env.add(v.g);
  traffic.push({ ...v, dir, speed: v.vmax, z });
}
function updateTraffic(sdt) {
  if (!traffic.length && (nextT -= sdt) <= 0) { nextT = rand(8, 25); spawn(Math.random() < 0.3 ? 'car' : 'scooter'); }
  for (let i = traffic.length - 1; i >= 0; i--) {
    const t = traffic[i], p = t.g.position;
    // slow down and wait for anyone standing in front of it
    let blocked = S.people.some(q => { const d = (q.g.position.x - p.x) * t.dir; return d > 0 && d < t.len / 2 + 2.2 && Math.abs(q.g.position.z - p.z) < 1.3; });
    t.speed += ((blocked ? 0 : t.vmax) - t.speed) * Math.min(1, sdt * (blocked ? 4 : 1.2));
    p.x += t.dir * t.speed * sdt;
    if (Math.abs(p.x) > 44) { env.remove(t.g); t.g.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); traffic.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- fading whatever is in the way
const ray = new THREE.Ray(), hit = new THREE.Vector3(), aim = new THREE.Vector3(), PORCH = new THREE.Vector3(-0.4, 1.0, 6.5);
function updateFade(dt) {
  const cam = ctx.camera.position, targets = [ctx.controls.target, PORCH];
  S.envBlocks.forEach(b => {
    let inWay = false;
    for (const t of targets) {
      ray.origin.copy(cam); aim.copy(t).sub(cam); const dist = aim.length(); ray.direction.copy(aim.normalize());
      if (!b.box.containsPoint(t) && ray.intersectBox(b.box, hit) && hit.distanceTo(cam) < dist - 0.5) { inWay = true; break; }
    }
    const goal = inWay ? 0 : 1;
    if (Math.abs(b.fade - goal) < 0.005) return;
    b.fade += (goal - b.fade) * Math.min(1, dt * 6);
    if (Math.abs(b.fade - goal) < 0.005) b.fade = goal;
    const see = b.fade < 0.99;
    b.mats.forEach(m => { if (m.transparent !== see) { m.transparent = see; m.needsUpdate = true; } m.opacity = b.fade; m.depthWrite = !see; });
    b.group.visible = b.fade > 0.03;   // gone altogether once it has faded, so no ghostly bars or cages stay over the view
    b.group.traverse(o => { if (o.isMesh) o.castShadow = !see; });
  });
}

export function updateSurroundings(dt) {
  if (!env) return;
  updateTraffic(dt * S.speed);
  updateFade(dt);
}

export function buildSurroundings() {
  env = new THREE.Group(); ctx.scene.add(env);
  traffic.length = 0; nextT = 2;
  signDeck = SIGNS.slice().sort(() => Math.random() - 0.5);
  S.envWindows = []; S.envBlocks = [];
  S.traffic = traffic; S.spawnVehicle = spawn;   // handy from the console
  ctx.scene.fog = new THREE.Fog(0xd9dcdc, 45, 140);
  // ground: concrete, with the roads asphalt on top of it, so the lane and the cross street read as roads
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat(0x6f6b65, { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true;
  // everything at street level sits RISE down, below the raised frontage
  const low = new THREE.Group(); low.position.y = -RISE; env.add(low); low.add(ground);
  // the lane: asphalt right up to the fronts of the houses, no pavement, as in the photos
  const ROAD0 = FRONT - 0.4, ROAD1 = OPP + 0.3;
  const at = asphaltTex().clone(); at.needsUpdate = true; at.repeat.set(24, 2.6);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(96, ROAD1 - ROAD0), new THREE.MeshStandardMaterial({ map: at, roughness: 0.95 }));
  lane.rotation.x = -Math.PI / 2; lane.position.set(0, -0.015, (ROAD0 + ROAD1) / 2); lane.receiveShadow = true; low.add(lane);
  // a white edge line on the far side, and before the crossroads 停 and 消防通道, stacked to be read by drivers coming
  // down the one-way lane
  const paint = new THREE.MeshStandardMaterial({ color: col(0xe8e6e0), roughness: 0.8 });
  [[-48, CROSS0], [CROSS1, 48]].forEach(([a, b]) => { const e = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 0.12), paint); e.rotation.x = -Math.PI / 2; e.position.set((a + b) / 2, -0.01, OPP - 0.35); low.add(e); });
  // the cross street, running back past the end of the shop's row, and a stop line across the lane before it
  const ct = asphaltTex().clone(); ct.needsUpdate = true; ct.repeat.set(2, 24);
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(CROSS1 - CROSS0, 96), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.95 }));
  cross.rotation.x = -Math.PI / 2; cross.position.set((CROSS0 + CROSS1) / 2, -0.02, LANE_Z); cross.receiveShadow = true; low.add(cross);
  const stop = new THREE.Mesh(new THREE.PlaneGeometry(0.3, LANE_W - 0.3), paint); stop.rotation.x = -Math.PI / 2; stop.position.set(CROSS0 - 0.5, -0.008, LANE_Z); low.add(stop);
  const roadWord = (ch, x, across, along) => {
    const t = canvasTex(256, 256, (g, w) => { g.fillStyle = '#ece9e2'; g.font = 'bold 220px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.fillText(ch, w / 2, 210); });
    S.fontTex.push(t);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(across, along), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, depthWrite: false }));
    m.rotation.set(-Math.PI / 2, 0, -ONE_WAY * Math.PI / 2); m.position.set(x, -0.005, LANE_Z); low.add(m);   // its top points the way they drive
  };
  // drawn long and spread out along the road, as road lettering is, so it reads from a driver's seat, all the same size,
  // read top to bottom as you drive up to the junction: 停 nearest it
  ['停', '消', '防', '通', '道'].forEach((ch, i) => roadWord(ch, CROSS0 - 2.0 - i * 4.2, 2.1, 2.8));
  // our row either side of the shop: each as deep as the shop, two or three storeys
  // to the right, two houses then the corner shop at the cross street; past it, two or three more and the row ends
  const front = () => FRONT - rand(0, 0.3);
  const cw = rand(4.3, 5), hw = (CROSS0 - 2.3 - cw) / 2;
  [0, 1].forEach(i => { const f = front(); rowHouse(2.3 + i * hw, 2.3 + (i + 1) * hw, f, 1, randi(1, 2), f - BACK); });
  const corner = signDeck.splice(signDeck.findIndex(n => n[0].endsWith('五金行')), 1)[0];
  rowHouse(CROSS0 - cw, CROSS0, FRONT, 1, 2, FRONT - BACK, 1, corner);
  let end = CROSS1;
  for (let i = randi(2, 3); i > 0; i--) { const w = rand(3.6, 5.2), f = front(); rowHouse(end, end + w, f, 1, randi(1, 2), f - BACK, end === CROSS1 ? -1 : 0); end += w; }
  let x = -2.3;
  while (x > -40) { const w = x === -2.3 ? 4.6 : rand(3.6, 5.2), f = x === -2.3 ? FRONT : FRONT - rand(0, 0.3); rowHouse(x - w, x, f, 1, randi(1, 2), f - BACK, 0, null, x === -2.3); x -= w; }
  shopUpstairs();
  // only our shop stands raised: a concrete plinth under it, its front edge flush with the pillar and the storeroom wall
  const stepM = new THREE.MeshStandardMaterial({ map: washed('step', '#9a968e'), roughness: 0.95 });
  const half = 3.18 * SQ, plinth = new THREE.Mesh(new THREE.BoxGeometry(2 * half, RISE, KERB - BACK + 0.1), stepM);
  plinth.position.set(0, -RISE / 2 - 0.006, (KERB + BACK - 0.1) / 2); plinth.receiveShadow = true; env.add(plinth);
  // nothing across the lane or behind: just the lane and the row either side, so nothing hides the shop
  wires(FRONT + 0.25, 3.45, -40, CROSS0); wires(FRONT + 0.25, 3.45, CROSS1, end);
  // parked scooters and bikes, pot plants and crates along both sides, clear of the shop front
  const park = (px, pz, ry, thing) => { thing.position.set(px, -RISE, pz); thing.rotation.y = ry; thing.traverse(o => { if (o.isMesh) o.castShadow = true; }); env.add(thing); };
  const vehicle = () => (Math.random() < 0.7 ? scooterModel(pick(SCOOTER_COLS)) : bike(pick([0xd94a7a, 0x9aa0a6, 0x2f6fb0])));
  [-7.6, -8.3, -9.6, -13.5, 4.9, 7.8, 11.6, 21.2].forEach(px => park(px, FRONT + 0.75, rand(-0.15, 0.15) + (Math.random() < 0.5 ? 0 : Math.PI), vehicle()));
  for (let i = 0; i < 14; i++) {
    const pz = FRONT + 0.25, px = rand(-30, 30);
    if (Math.abs(px) < 2.8 || (px > CROSS0 - 0.4 && px < CROSS1 + 0.4) || px > end || (px > -7.0 && px < -1.8)) continue;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 10), mat(pick([0xb06a45, 0x3d6a91, 0xe6e3dc]))); pot.position.set(px, 0.13 - RISE, pz); env.add(pot);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(pick([0x5f8f55, 0x6f9f5c, 0x7fae66]), { flatShading: true })); leaf.position.set(px, 0.42 - RISE, pz); env.add(leaf);
  }
  // as in the photos: bicycles left standing against next door's shutter (far enough apart that their wheels don't
  // run into each other, and just off the shutter), a long old wooden bench with splayed legs in front of the shop's
  // left side, running out from the shop front toward the street, and a tree stump in line with it past its end
  [[-3.05, 0.5, 0x6f8f5a], [-4.3, 0.62, 0xb8bcc0], [-5.45, 0.5, 0x2b2f36]].forEach(([bxp, bz, c]) => {
    const b = bike(c); b.position.set(bxp, -RISE, FRONT + bz); b.rotation.set(-0.06, Math.PI / 2 + rand(-0.06, 0.06), 0);
    b.traverse(o => { if (o.isMesh) o.castShadow = true; }); env.add(b);
  });
  const wood = mat(0x9a7a56, { roughness: 0.85 }), woodDark = mat(0x7a5c3e, { roughness: 0.9 });
  const bench = new THREE.Group(); bench.position.set(-1.76, -RISE, 8.9); bench.rotation.y = Math.PI / 2; env.add(bench);
  const piece = (w, h, d, m, x, y, z, rz = 0, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.set(rx, 0, rz); b.castShadow = b.receiveShadow = true; bench.add(b); return b; };
  piece(1.5, 0.05, 0.24, wood, 0, 0.47, 0);                                                // the seat plank
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => piece(0.05, 0.48, 0.05, woodDark, sx * 0.6, 0.23, sz * 0.07, sx * 0.12, -sz * 0.18)));   // legs, splayed out
  [-1, 1].forEach(sx => piece(0.04, 0.04, 0.2, woodDark, sx * 0.62, 0.16, 0));            // a rung between each pair
  piece(1.18, 0.04, 0.03, woodDark, 0, 0.36, 0.02);                                         // and a stretcher along under the seat
  const stump = new THREE.Group(); stump.position.set(-1.76, -RISE, 10.0); env.add(stump);   // in line with the bench, just past its street end
  const bark = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.5, 14), mat(0x5e4532, { roughness: 1 })); bark.position.y = 0.25; bark.castShadow = true; stump.add(bark);
  const rings = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.01, 14), mat(0xb08a62, { roughness: 0.9 })); rings.position.y = 0.505; stump.add(rings);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.11, 12), mat(0xb5643c, { roughness: 0.8 })); pot.position.set(-0.02, 0.565, 0.02); pot.castShadow = true; stump.add(pot);
  [[0, 0.68, 0, 0.1], [0.06, 0.66, 0.04, 0.07], [-0.06, 0.65, -0.03, 0.07], [0.02, 0.74, -0.04, 0.06]].forEach(([x, y, z, r]) => {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(pick([0x4f8a45, 0x5f9a50, 0x6aa85a]), { flatShading: true })); leaf.position.set(x - 0.02, y, z + 0.02); leaf.castShadow = true; stump.add(leaf);
  });
  [[-7.2, FRONT + 0.3], [8.6, FRONT + 0.3]].forEach(([px, pz]) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.4), mat(0x2f8a4a, { roughness: 0.6 })); c.position.set(px, 0.15 - RISE, pz); c.castShadow = true; env.add(c); });   // green crates
}
