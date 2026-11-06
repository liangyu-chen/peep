// People in the café: animation poses, speech bubble and name tag, walking along plan-coordinate paths (the body is body.js).
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ctx, mat, cyl } from './engine.js';
import { buildBody, tickFace, LEG_EXTRA, restPose, poseBody } from './body.js';
import { S } from './state.js';
import { K } from './util.js';
import { KERB, RISE, BACK_DROP, inBackHall } from './layout.js';
import { makeBear, followBear } from './bear.js';
import { moverShadows, highQuality } from './quality.js';

const teaCupM = mat(0xf2f0ea, { roughness: 0.3 });
const coffeeM = mat(0x5a3220, { roughness: 0.3 });
const glassM = mat(0xe8f4ff, { roughness: 0.05, transparent: true, opacity: 0.5 });

// a lit cigarette, held between the fingers of the left hand: filter, paper that burns down, grey ash and the ember
const cigM = mat(0xf4f1ea, { roughness: 0.7 }), filterM = mat(0xd9a05a, { roughness: 0.8 }), ashM = mat(0x9a9894, { roughness: 1 });
const PAPER = 0.05;
// glow round the ember while someone draws on it
let glowTex = null;
const glowTexture = () => glowTex || (glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,190,90,1)'); grd.addColorStop(0.4, 'rgba(255,110,30,.5)'); grd.addColorStop(1, 'rgba(255,80,20,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
})());
// index and middle fingers held out straight from the palm (the hand frame's -y), the cigarette pinched at their tips
const FINGERTIP = new THREE.Vector3(0, -0.052, 0.014);
function makeFingers(skinM) {
  const g = new THREE.Group();
  [-0.008, 0.008].forEach((dx, i) => cyl(0.0085, 0.0078, 0.05 - i * 0.005, skinM, dx, -0.03 + i * 0.002, 0.012, g, 8));
  g.traverse(o => { o.castShadow = false; });
  return g;
}
function makeCigarette() {
  const g = new THREE.Group();
  g.position.copy(FINGERTIP);
  cyl(0.0047, 0.0047, 0.016, filterM, 0, -0.012, 0, g, 8);
  const paper = cyl(0.0045, 0.0045, PAPER, cigM, 0, -0.004 + PAPER / 2, 0, g, 8);
  const ash = cyl(0.0043, 0.0045, 0.006, ashM, 0, 0, 0, g, 8);
  const emberM = new THREE.MeshBasicMaterial({ color: 0xff4a12 });
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), emberM); g.add(ember);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  glow.scale.setScalar(0.04); ember.add(glow);
  g.rotation.set(Math.PI / 2, 0, 0.35);   // pointing out from the hand, a little to the side
  g.traverse(o => { o.castShadow = false; });
  g.userData = { paper, ash, ember, emberM, glow };
  burn(g, 1);
  return g;
}
// k: how much is left (1 = fresh); glow: 0 at rest, 1 while someone takes a drag
function burn(cig, k, glow = 0) {
  const { paper, ash, ember, emberM } = cig.userData, len = PAPER * k, top = -0.004 + len;
  paper.scale.y = k; paper.position.y = -0.004 + len / 2;
  ash.position.y = top + 0.003; ember.position.y = top + 0.006;
  ember.scale.setScalar(1 + glow * 0.6);
  emberM.color.setHex(glow > 0.5 ? 0xffb02a : 0xff4a12);
  cig.userData.glow.material.opacity = 0.25 + glow * 0.75;
}
// the lighter that comes out of the right hand to light up
const lighterM = mat(0xc0282d, { roughness: 0.4 });
const flameM = new THREE.MeshBasicMaterial({ color: 0xffb02a, transparent: true, opacity: 0.85 });
function makeLighter() {
  const g = new THREE.Group();
  cyl(0.012, 0.012, 0.045, lighterM, 0, 0, 0, g, 8).scale.z = 0.6;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.022, 6), flameM); flame.position.y = 0.035; g.add(flame);
  g.rotation.x = -0.6;
  g.traverse(o => { o.castShadow = false; });
  return g;
}

// iced drinks in a tall glass, hot ones in a Taiwanese tea cup
// the left arm while smoking: shoulder x/y/z, elbow, and the wrist (cx/cz: how the cigarette is angled in the fingers).
// Fitted so the filter meets the lips on a drag, the lighter's flame meets the tip, and the hold sits by the shoulder.
export const SMOKE_POSE = {
  hold: { x: -0.236, y: 0.354, z: 0.059, el: -2.357, cx: 1.755, cz: -0.324 },            // hand up by the shoulder, cigarette pointing up and out
  drag: { x: -1.377, y: 0.795, z: 0.276, el: -1.802, cx: -0.738, cz: 0.517, pitch: -0.05 },  // filter to the lips
  tap: { x: -0.181, y: 0.17, z: 0.302, el: -1.188, cx: 3.356, cz: 0.445 },                 // out over the table, tip down
  light: { x: -1.377, y: 0.795, z: 0.276, el: -1.802, cx: -0.738, cz: 0.517, rx: -0.523, rz: -1.68, rel: -1.251, pitch: 0.06 },   // and the right hand brings the lighter
};

// an iced drink's colour in the glass, by what it is
const strawM = mat(0xd4d7db, { roughness: 0.18, metalness: 0.9 });
const iceM = mat(0xeef6fa, { roughness: 0.1, transparent: true, opacity: 0.7 });
function icedColour(drink = '') {
  const d = String(drink);
  if (/林美如|芬達/.test(d)) return 0xe6902c;
  if (/可樂/.test(d)) return 0x3a1e12;
  if (/雪碧|七喜|通寧|氣泡|維大力/.test(d)) return 0xdfe8d8;
  if (/芭樂/.test(d)) return 0xe8a0a0;
  if (/蘋果/.test(d)) return 0xd8b060;
  if (/青瓜/.test(d)) return 0xb8d890;
  if (/芝麻/.test(d)) return 0x8a7a6a;
  if (/朱古力|摩卡/.test(d)) return 0x5a3422;
  if (/美式|康保藍|濃縮/.test(d)) return 0x3a2214;
  return 0x9a6a44;   // the milky coffees, a latte's colour all through
}
export function makeCup(drink, variant) {
  const g = new THREE.Group();
  if (variant === 'ice') {
    cyl(0.055, 0.045, 0.22, glassM, 0, 0.11, 0, g, 12);
    // the drink in it: one colour all the way up, no milk foam on an iced drink, and a few ice cubes in the top; in a
    // group standing on the glass's bottom so it can go down as it's drunk
    const fill = new THREE.Group(); fill.position.y = 0.005; g.add(fill);
    cyl(0.05, 0.042, 0.175, mat(icedColour(drink), { roughness: 0.25 }), 0, 0.0875, 0, fill, 12);
    [[0.018, 0.16, 0.012, 0.4], [-0.02, 0.155, -0.008, 1.1], [0.004, 0.165, -0.022, 2.2]].forEach(([x, y, z, r]) => {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.022), iceM); cube.position.set(x, y, z); cube.rotation.set(r, r * 0.7, 0); fill.add(cube);
    });
    g.userData.fill = fill;
    // a steel straw, leaning across the glass toward whoever's drinking (the glass's -z, see gripCup) and standing well
    // up out of it; its top end is what goes to the lips, the glass kept upright
    const straw = cyl(0.0035, 0.0035, 0.26, strawM, 0, 0.15, 0.008, g, 8); straw.rotation.x = -0.2;
    g.userData.straw = new THREE.Vector3(0, 0.15 + 0.13 * Math.cos(0.2), 0.008 - 0.13 * Math.sin(0.2));   // its top, in the glass
  } else { // Taiwanese tea cup for hot lattes
    cyl(0.06, 0.04, 0.06, teaCupM, 0, 0.03, 0, g, 14);
    g.userData.top = cyl(0.056, 0.056, 0.006, mat(0xc89b6c), 0, 0.058, 0, g, 14);   // the latte's surface, sinking as it's drunk
  }
  g.userData.level = 1;
  g.traverse(o => { o.castShadow = false; });
  g.userData.h = variant === 'ice' ? 0.22 : 0.06;   // height, for gripping it and lifting the rim to the lips
  return g;
}

// how full a glass or tea cup is, 0..1: the iced drink's layers shorten, the latte's surface sinks down the tapered cup
export function setLevel(cup, level) {
  const u = cup.userData, l = Math.max(0, Math.min(1, level)); u.level = l;
  if (u.fill) { u.fill.scale.y = Math.max(0.02, l); u.fill.visible = l > 0.01; }
  if (u.top) { u.top.position.y = 0.006 + 0.052 * l; const r = (0.04 + 0.016 * l) / 0.056; u.top.scale.set(r, 1, r); u.top.visible = l > 0.01; }
}
// a sip: a little less in it (a long stay drinks it down to the dregs; it's finished off on the way out)
export const sip = cup => { if (cup && cup.userData.level !== undefined) setLevel(cup, cup.userData.level - (0.1 + Math.random() * 0.08)); };

// a takeaway cup: a kraft paper cup, tapered, with a white rolled rim and a black sip lid (for anyone leaving with
// their drink still in hand)
const kraftM = mat(0xb98a5a, { roughness: 0.85 }), lidM = mat(0x1a1a1c, { roughness: 0.35 }), rimM = mat(0xf2f0ea, { roughness: 0.5 });
export function makeTakeaway() {
  const g = new THREE.Group();
  cyl(0.046, 0.035, 0.13, kraftM, 0, 0.065, 0, g, 16);
  cyl(0.048, 0.048, 0.006, rimM, 0, 0.131, 0, g, 16);
  cyl(0.05, 0.049, 0.012, lidM, 0, 0.14, 0, g, 16);                 // the lid's skirt
  cyl(0.04, 0.046, 0.012, lidM, 0, 0.152, 0, g, 16);                // its raised top
  cyl(0.008, 0.008, 0.006, lidM, 0.026, 0.16, 0, g, 8);             // the sip hole's lip
  g.traverse(o => { o.castShadow = false; });
  g.userData.h = 0.16; g.userData.togo = true;
  return g;
}

// the right arm with a drink: carrying it in front, and lifting it for a sip (fitted in the scene so the rim meets the lips;
// the tall glass is tipped more, the low tea cup lifted higher)
export const DRINK_POSE = {
  carry: { x: -0.35, z: -0.06, el: -1.05 },
  walk: { x: -0.25, z: -0.06, el: -1.05 },
  high: { x: -0.75, z: -0.06, el: -1.1 },   // the owner, behind the bar: held up at chest height, clear over the bar top
  sip: { x: -1.101, y: -0.759, z: -0.609, el: -1.604, tilt: 0.548 },
  sipHot: { x: -1.398, y: -0.675, z: -1.055, el: -1.86, tilt: 0.3 },
  sipStraw: { x: -1.181, y: -1.144, z: -0.369, el: -1.901, tilt: 0 },   // an iced drink: the glass upright, the straw's top at the lips (fitted in the scene, within 2 cm for anyone)
};
const sipPose = cup => DRINK_POSE[cup && cup.userData.straw ? 'sipStraw' : cup && cup.userData.h < 0.1 ? 'sipHot' : 'sip'];
// the cup stays upright in the hand (tipped toward the mouth for a sip), held in front of the palm, gripped round its middle
const _qh = new THREE.Quaternion(), _qg = new THREE.Quaternion(), _qt = new THREE.Quaternion(), _p = new THREE.Vector3(), _f = new THREE.Vector3();
const X_AXIS = new THREE.Vector3(1, 0, 0);
function gripCup(person, tilt) {
  const cup = person.cup, h = cup.userData.h || 0.1;
  person.g.updateMatrixWorld(true);
  person.hand.getWorldQuaternion(_qh); person.g.getWorldQuaternion(_qg);
  _qt.setFromAxisAngle(X_AXIS, -tilt);                                   // tip the top toward the face
  cup.quaternion.copy(_qh).invert().multiply(_qg).multiply(_qt);
  person.hand.getWorldPosition(_p);
  _f.set(0, 0, 1).applyQuaternion(_qg);
  _p.addScaledVector(_f, 0.035);
  _p.y -= h * 0.45 * Math.cos(tilt);
  person.hand.worldToLocal(_p);
  cup.position.copy(_p);
}

// a pixelated square that hides whatever's bare on the toilet; random skin-ish blocks, re-shuffled now and then
function makeMosaic() {
  const N = 6, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.encoding = THREE.sRGBEncoding;
  tex.shuffle = () => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const l = 45 + Math.random() * 35, h = 18 + Math.random() * 14;
      g.fillStyle = `hsl(${h},${25 + Math.random() * 30}%,${l}%)`; g.fillRect(x, y, 1, 1);
    }
    tex.needsUpdate = true;
  };
  tex.shuffle();
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  sp.scale.set(0.34, 0.34, 1); sp.renderOrder = 5;
  return sp;
}
const MOSAIC_AT = new THREE.Vector3(0, 0.5 + LEG_EXTRA, 0.02), _cam = new THREE.Vector3();
// the soft round shadow under each person
const blobGeo = new THREE.CircleGeometry(0.3, 20);
let blobMat = null;
const blobM = () => blobMat || (blobMat = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.5)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.3)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
})());

// fewer draws for each person: the pieces that hang off the same part of the body (the head, a forearm, the torso...)
// and share a material are merged into one mesh in that part, so they still move with it. Whatever the code changes
// on its own (the eyes blink, the mouth talks, the controller and the skirt show and hide, the bare legs and the pants
// swap materials) is left as it was, and so is anything see-through, mirrored or holding children of its own. Merged
// geometry is this person's own, and is let go with them
// (plain colours share one material for everyone, reading each piece's colour off its vertices, so pieces alike in all
// but colour merge too)
const TINTED = new Map();
const plainMat = m => m.isMeshStandardMaterial && !m.map && !m.emissiveMap && !m.normalMap && !m.alphaMap && !m.vertexColors && !m.transparent;
function tintedFor(m) {
  const k = [m.emissive.getHex(), m.emissiveIntensity, m.roughness, m.metalness, m.side, m.flatShading, m.polygonOffset, m.polygonOffsetFactor].join('|');
  if (!TINTED.has(k)) { const t = m.clone(); t.color.set(0xffffff); t.vertexColors = true; TINTED.set(k, t); }
  return TINTED.get(k);
}
export function mergeParts(root, keep = new Set()) {
  root.updateMatrixWorld(true);
  const parents = new Set();
  root.traverse(o => { if (o.isMesh && !keep.has(o)) parents.add(o.parent); });
  parents.forEach(par => {
    const groups = new Map();
    par.children.forEach(o => {
      if (!o.isMesh || keep.has(o) || o.children.length || Array.isArray(o.material) || o.material.transparent || o.geometry.morphAttributes.position) return;
      o.updateMatrix(); if (o.matrix.determinant() <= 0) return;
      const mm = plainMat(o.material) ? tintedFor(o.material) : o.material;
      const g = o.geometry, key = [mm.uuid, o.castShadow, o.receiveShadow, o.visible, o.renderOrder, g.index ? 1 : 0, Object.keys(g.attributes).filter(a => a !== 'color').sort().join(',')].join('/');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    });
    groups.forEach(list => {
      if (list.length < 2) return;
      const tinted = plainMat(list[0].material);
      const geos = list.map(o => {
        const g = o.geometry.clone().applyMatrix4(o.matrix); g.clearGroups();
        if (tinted) {   // its colour, onto its vertices
          const n = g.attributes.position.count, c = new Float32Array(n * 3), col = o.material.color;
          for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
          g.setAttribute('color', new THREE.BufferAttribute(c, 3));
        } else if (g.attributes.color) g.deleteAttribute('color');
        return g;
      });
      const merged = BufferGeometryUtils.mergeBufferGeometries(geos);
      geos.forEach(g => g.dispose());
      if (!merged) return;
      const m = new THREE.Mesh(merged, tinted ? tintedFor(list[0].material) : list[0].material);
      m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow; m.renderOrder = list[0].renderOrder; m.userData.merged = true;
      Object.assign(m.userData, { castWas: list[0].userData.castWas });
      par.add(m); list.forEach(o => par.remove(o));
    });
  });
}
function bodyKeep(b) {
  // (each one itself: what's inside one that's a group still merges, as it moves, scales and hides with the group)
  const keep = new Set(), add = o => o && keep.add(o);
  [b.mouth, b.pad, b.skirt].forEach(add); (b.eyes || []).forEach(add);
  [...(b.strip?.bare || []), ...(b.strip?.bunch || [])].forEach(add);
  return keep;
}

// how finely the café's people are built (body.js): enough for the size they're seen at
const CAFE_DETAIL = 0.55;

export class Person {
  constructor(profile, role) {
    this.p = profile; this.role = role;
    Object.assign(this, buildBody(profile.look, profile.name, { detail: CAFE_DETAIL }));
    mergeParts(this.g, bodyKeep(this));
    this.faceAnim = { blinkT: Math.random() * 4 };
    this.g.traverse(o => { if (o.isMesh) o.userData.person = this; });
    // a soft round shadow on the floor under them, in place of a cast one when the sun's shadows are drawn just once
    // (畫質 一般, quality.js)
    this.blob = new THREE.Mesh(blobGeo, blobM()); this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 1; this.blob.userData.blob = true; this.g.add(this.blob);
    this.blob.visible = !highQuality(); moverShadows(this.g);
    ctx.scene.add(this.g);
    if (profile.look?.companion === 'bear') {   // 月亮小熊, flying along with them (click it and it's their card)
      this.bear = makeBear(); mergeParts(this.bear.g); this.bear.g.traverse(o => { if (o.isMesh) o.userData.bearOf = this; }); ctx.scene.add(this.bear.g); moverShadows(this.bear.g);
      this.bear.bubble = document.createElement('div'); this.bear.bubble.className = 'bubble'; this.bear.bubble.style.opacity = 0; this.bear.bubbleT = 0;
      S.labelsEl.append(this.bear.bubble);
    }
    this.path = []; this.onArrive = null; this.speed = 1.4; this.heading = 0; this.targetHeading = 0;
    this.pose = 'stand'; this.walkPhase = Math.random() * 10; this.act = null; this.actT = 0;
    this.cup = null; this.status = '剛進門'; this.seat = null; this.gone = false;
    this.tag = document.createElement('div');
    this.tag.className = 'tag ' + (role === 'owner' ? 'boss' : profile.regular ? 'reg' : 'new');
    this.tag.innerHTML = `<span></span><i>${role === 'owner' ? '老闆' : profile.regular ? '熟客' : '新客'}</i>`;
    this.tag.firstChild.textContent = profile.name;
    this.bubble = document.createElement('div'); this.bubble.className = 'bubble'; this.bubble.style.opacity = 0;
    S.labelsEl.append(this.tag, this.bubble);
    this.bubbleT = 0;
    S.people.push(this);
  }
  setPos(x, z) { this.g.position.set(x * K, 0, z); }
  face(a) { this.targetHeading = a; }
  bearSay(text, dur = 2.4) { const b = this.bear; if (!b) return; b.bubble.textContent = text; b.bubble.style.opacity = 1; b.bubbleT = dur; }
  say(text, dur = 2.8) { this.bubble.textContent = text; this.bubble.style.opacity = 1; this.bubbleT = dur; }
  hold(cup) { this.cup = cup; moverShadows(cup); this.hand.add(cup); cup.position.set(0, -0.05, 0); cup.rotation.set(0, 0, 0); }
  putCup(x, y, z) { if (!this.cup) return; ctx.scene.attach(this.cup); this.cup.position.set(x * K, y, z); this.cup.rotation.set(0, 0, 0); }
  pickCup() { if (this.cup) this.hold(this.cup); }
  dropCup() { if (this.cup) { this.cup.parent.remove(this.cup); this.cup = null; } }
  gesture(a, t = 1.4) { this.act = a; this.actT = t; }
  // pants down (thighs and hips show skin, the pants bunch round the shins) with a mosaic over the bits; or back up
  pantsDown(down) {
    const { bare, bunch, pants, skin } = this.strip;
    bare.forEach(m => { m.material = down ? skin : pants; });
    bunch.forEach(m => { m.visible = down; });
    if (this.skirt) this.skirt.visible = !down;   // a skirt is lifted out of the way
    if (down && !this.mosaic) { this.mosaic = makeMosaic(); this.g.add(this.mosaic); this.mosaicT = 0; }
    if (!down && this.mosaic) { this.g.remove(this.mosaic); this.mosaic.material.map.dispose(); this.mosaic.material.dispose(); this.mosaic = null; }
  }
  // smoke for `dur` simulated seconds: light it, then hold / take a drag / blow it out / tap the ash, until it's burnt down.
  // The smoke itself (from the tip, and blown out after a drag) is drawn by updateSmoke in sim.js.
  lightUp(dur) {
    if (this.cig) return;
    this.cig = makeCigarette(); this.handL.add(this.cig);
    this.fingers = makeFingers(this.skinM); this.handL.add(this.fingers);
    this.lighter = makeLighter(); this.hand.add(this.lighter);
    this.smk = { phase: 'light', t: 1.8, dur, life: dur };
  }
  putOut() {
    if (this.lighter) { this.lighter.parent.remove(this.lighter); this.lighter = null; }
    if (!this.cig) return;
    // stubbed out in the nearest ashtray, if there's one at hand
    const x = this.g.position.x / K, z = this.g.position.z;
    const tray = (S.ashtrays || []).map(a => [a, Math.hypot(a.x - x, a.z - z)]).filter(([, d]) => d < 1.6).sort((p, q) => p[1] - q[1])[0];
    if (tray) { tray[0].n = Math.min(tray[0].butts.length, tray[0].n + 1); tray[0].show(); }
    this.cig.parent.remove(this.cig); this.cig = null; this.fingers.parent.remove(this.fingers); this.fingers = null; this.smk = null; this.exhaleT = 0;
  }
  smoking(dt) {
    const k = this.smk;
    k.life -= dt; k.t -= dt;
    if (k.life <= 0) { this.putOut(); return; }
    if (k.t <= 0) {
      if (k.phase === 'light') { this.hand.remove(this.lighter); this.lighter = null; k.phase = 'drag'; k.t = 1.2; }
      else if (k.phase === 'hold') { if (Math.random() < 0.3) { k.phase = 'tap'; k.t = 0.9; } else { k.phase = 'drag'; k.t = 1.2; } }
      else if (k.phase === 'drag') { k.phase = 'exhale'; k.t = 1.6; this.exhaleT = 1.4; }
      else { if (k.phase === 'tap') this.ashT = 0.25; k.phase = 'hold'; k.t = 2.5 + Math.random() * 3.5; }
    }
    if (this.exhaleT > 0) this.exhaleT -= dt;
    if (this.ashT > 0) this.ashT -= dt;
    burn(this.cig, Math.max(0.12, k.life / k.dur), k.phase === 'drag' || k.phase === 'light' ? Math.min(1, (1.2 - k.t) * 2) : 0);
  }
  remove() {
    this.gone = true; ctx.scene.remove(this.g);
    [this.g, this.bear?.g].forEach(r => r?.traverse(o => { if (o.userData.merged) o.geometry.dispose(); })); if (this.bear) { ctx.scene.remove(this.bear.g); this.bear.bubble.remove(); } this.dropCup(); this.putOut(); this.tag.remove(); this.bubble.remove();
    S.people.splice(S.people.indexOf(this), 1);
  }
  update(dt) {
    const pos = this.g.position;
    let moving = false;
    if (this.path.length) {
      const [tx, tz] = this.path[0];
      const dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz), step = this.speed * dt;
      if (d < 1e-4 || d <= step) { pos.x = tx; pos.z = tz; this.path.shift(); }
      else { pos.x += dx / d * step; pos.z += dz / d * step; this.targetHeading = Math.atan2(dx, dz); }
      moving = true;
      if (!this.path.length && this.onArrive) { const f = this.onArrive; this.onArrive = null; f(); }
    }
    let diff = this.targetHeading - this.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.heading += diff * Math.min(1, dt * 8);
    this.g.rotation.y = this.heading;
    if (this.actT > 0) { this.actT -= dt; if (this.actT <= 0) this.act = null; }
    if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0) this.bubble.style.opacity = 0; }
    tickFace(this, this.faceAnim, dt, this.bubbleT > 0);
    if (this.smk) this.smoking(dt);

    const sitting = this.pose === 'sit' || this.pose === 'game', squat = this.pose === 'squat' && !moving;
    this.walkPhase += dt * (moving ? 9 : 2);
    const s = Math.sin(this.walkPhase);
    // every pose starts from standing at rest (body.js, shared with the back office's preview) and changes what it needs
    // (positive armLz brings the left arm in, negative takes it out; the right arm the other way)
    const rest = restPose(this.walkPhase);
    let { hipL, hipR, kL, kR, armLx, armLy, armRx, armRy, armLz, armRz, elL, elR } = rest, y = 0, bob = 0;
    if (moving) { hipL = s * 0.55; hipR = -s * 0.55; kL = Math.max(0, -s) * 0.6; kR = Math.max(0, s) * 0.6; armLx = -s * 0.45; armRx = s * 0.45; elL = -0.3 + Math.min(0, s) * 0.2; elR = -0.3 - Math.max(0, s) * 0.2; bob = Math.abs(Math.cos(this.walkPhase)) * 0.04; }
    else if (squat) { y = -0.425;   // the longer legs fold up higher, so the body goes down further to keep the hips over the pan
      hipL = hipR = -1.9; kL = kR = 1.95; armLx = armRx = -0.55; elL = elR = -0.95; armLz = 0.12; armRz = -0.12; }   // squatting over the pan, forearms on the knees
    else if (sitting) { y = (this.seat ? this.seat.sitY : -0.1) - LEG_EXTRA + 0.02;   // hips on the seat, though they sit higher on the longer legs
      hipL = hipR = -Math.PI / 2; kL = kR = this.seat && this.seat.floor ? 0.25 : Math.PI / 2; armLx = armRx = -0.25; elL = elR = -0.7; }   // hands resting on the lap
    if (sitting && this.seat && this.seat.lounge && !moving) { armLz = -0.45; armRz = 0.45; armLx = armRx = -0.3; elL = elR = -0.6; }   // arms out along a beanbag's rolled arms
    if (this.cup && this.cup.parent === this.hand && !this.act) { const P = DRINK_POSE[this.role === 'owner' ? 'high' : moving ? 'walk' : 'carry']; armRx = P.x; armRz = P.z; elR = P.el; }   // cup carried in front
    this.pad.visible = this.pose === 'game';
    if (this.pose === 'game' && !moving) { armLx = armRx = -0.55 + Math.sin(this.walkPhase * 6) * 0.04; elL = elR = -1.0; armLz = 0.3; armRz = -0.3; bob = Math.sin(this.walkPhase * 3) * 0.01; }
    if (this.act === 'sip') { const P = sipPose(this.cup); armRx = P.x; armRy = P.y || 0; armRz = P.z; elR = P.el; }
    if (this.act === 'cheer') { armLx = armRx = -2.9 + Math.sin(this.walkPhase * 10) * 0.2; elL = elR = -0.2; armLz = 0.2; armRz = -0.2; bob += Math.abs(Math.sin(this.walkPhase * 8)) * 0.05; }
    if (this.act === 'wave') { armRx = -2.4; elR = -0.5; armRz = -0.4 + Math.sin(this.walkPhase * 12) * 0.35; }
    // the owner's counter work: arms raised to bar height and reaching out, so the hands work on top of the counter, not inside it
    if (this.act === 'wipe') { armRx = -1.3; elR = -0.35; armRz = Math.sin(this.walkPhase * 8) * 0.45; }
    if (this.act === 'brew') { armLx = armRx = -1.25; elL = elR = -0.35; armLz = 0.22; armRz = -0.22; }
    if (this.act === 'pour') { armLx = -1.1; armRx = -1.2 + Math.sin(this.walkPhase * 5) * 0.12; elL = -0.5; elR = -0.55; armLz = 0.3; armRz = -0.3; }
    if (this.act === 'serve') { armRx = -1.3; elR = -0.3; armRz = -0.1; }   // reaching a cup over onto the bar
    if (this.act === 'facepalm') { armRx = -0.9; elR = -2.0; armRz = -0.45; }
    let pitch = 0;
    const ph = !moving && !this.act && this.smk ? this.smk.phase : null;
    let turn = 0;
    if (ph) {
      const P = SMOKE_POSE[ph === 'exhale' ? 'hold' : ph];
      armLx = P.x; armLy = P.y || 0; armLz = P.z; elL = P.el;
      this.cig.rotation.set(P.cx ?? Math.PI / 2, P.cy ?? 0, P.cz ?? 0.35);   // the wrist
      if (ph === 'tap') elL += Math.sin(this.walkPhase * 28) * 0.16;   // flicking the ash off
      if (ph === 'light') { armRx = P.rx; armRz = P.rz; elR = P.rel; }  // lighter cupped to it
      pitch = P.pitch || 0;
      if (ph === 'exhale') { pitch = -0.22; turn = 0.35; }               // chin up, turned aside, blowing it out
    }
    if (this.act === 'aim') { armRx = -0.7; elR = -1.4; armRz = -0.15; armLx = -0.5; elL = -1.2; }   // launcher pulled back, ready
    if (this.act === 'shoot') { armRx = -1.35; elR = -0.1; armRz = -0.05; }                          // and ripped forward
    if (this.act === 'pull') { armLx = armRx = -0.12; elL = elR = -0.25; armLz = 0.32; armRz = -0.32; bob = -Math.abs(Math.sin(this.actT * 4)) * 0.03; }   // hands at the waistband, tugging
    if (this.act === 'carry') { armLx = armRx = -0.9; elL = elR = -0.7; armLz = 0.25; armRz = -0.25; }
    poseBody(this, { hipL, hipR, kL, kR, armLx, armLy, armLz, armRx, armRy, armRz, elL, elR });
    if (this.cup && this.cup.parent === this.hand) gripCup(this, this.act === 'sip' ? sipPose(this.cup).tilt * Math.min(1, (1.4 - this.actT) * 3) : 0);
    const ground = this.g.position.z > KERB ? -RISE : inBackHall(this.g.position.x / K, this.g.position.z) ? -BACK_DROP : 0;   // down off the kerb, down into the back corridor
    this.groundY = (this.groundY || 0) + (ground - (this.groundY || 0)) * Math.min(1, dt * 14);
    this.g.position.y = this.groundY + y + bob;
    this.blob.position.y = 0.012 - y - bob;   // kept on the floor, whatever the pose
    if (this.skirt) {   // sitting, a skirt rides up and lies forward over the lap (set a little lower, so where it widens
      // is still below the shirt's hem and none of it shows through the back of the shirt)
      const lap = sitting || squat;
      this.skirt.scale.set(1, lap ? 0.5 : 1, lap ? 1.4 : 1); this.skirt.position.z = lap ? 0.07 : 0;
      this.skirt.position.y = 0.72 + LEG_EXTRA - (lap ? 0.05 : 0);
    }
    this.head.rotation.y = this.pose === 'game' ? 0 : ph ? turn : rest.head;
    this.head.rotation.x = pitch;
    if (this.mosaic) {   // kept between the hips and the camera, so it covers from any side
      this.mosaicT -= dt; if (this.mosaicT <= 0) { this.mosaicT = 0.35; this.mosaic.material.map.shuffle(); }
      this.g.worldToLocal(_cam.copy(ctx.camera.position));
      const at = this.mosaic.position.copy(MOSAIC_AT); if (squat) at.y = 0.625;
      _cam.sub(at); _cam.y = 0; if (_cam.lengthSq() > 1e-6) at.addScaledVector(_cam.normalize(), 0.2);
    }
    if (this.exhaleT > 0 && !this.bubbleT) this.mouth.scale.set(0.55, 2.4, 1); else this.mouth.scale.x = 1;   // an O while blowing smoke
    if (this.bear) {
      this.g.updateMatrixWorld(); followBear(this.bear, this, dt);
      if (this.bear.bubbleT > 0) { this.bear.bubbleT -= dt; if (this.bear.bubbleT <= 0) this.bear.bubble.style.opacity = 0; }
    }
  }
}

// walks a path given in plan coordinates; resolves on arrival
export function walk(person, pts) { return new Promise(r => { person.path = pts.map(p => [p[0] * K, p[1]]); if (!pts.length) r(); else person.onArrive = r; }); }
