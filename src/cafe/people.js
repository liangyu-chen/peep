// Blocky people: body, animation poses, speech bubble and name tag, walking along plan-coordinate paths.
import * as THREE from 'three';
import { ctx, mat, box, cyl, canvasTex } from './engine.js';
import { S } from './state.js';
import { K, PIX } from './util.js';
import { isIced } from './content.js';

const darkM = mat(0x111111);
const teaCupM = mat(0xf2f0ea, { roughness: 0.3 });
const coffeeM = mat(0x5a3220, { roughness: 0.3 });
const glassM = mat(0xe8f4ff, { roughness: 0.05, transparent: true, opacity: 0.5 });

export function makeCup(drink) {
  const g = new THREE.Group();
  if (isIced(drink)) {
    cyl(0.055, 0.045, 0.22, glassM, 0, 0.11, 0, g, 12);
    cyl(0.05, 0.042, 0.12, coffeeM, 0, 0.065, 0, g, 12);
    cyl(0.05, 0.05, 0.06, mat(drink === '林美如' ? 0xe6a23c : 0xe8dcc8), 0, 0.15, 0, g, 12);
  } else { // Taiwanese tea cup for hot lattes
    cyl(0.06, 0.04, 0.06, teaCupM, 0, 0.03, 0, g, 14);
    cyl(0.056, 0.056, 0.006, mat(0xc89b6c), 0, 0.058, 0, g, 14);
  }
  g.traverse(o => { o.castShadow = false; });
  return g;
}

function buildBody(look) {
  const g = new THREE.Group();
  const skin = mat(look.skin, { roughness: 0.6 }), shirt = mat(look.shirt), pants = mat(look.pants), hairM = mat(look.hair, { roughness: 0.95 }), shoe = mat(look.shoe || 0x1d1d1d);
  const mk = (geo, m, x, y, z, par) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; (par || g).add(me); return me; };
  const legs = [-0.11, 0.11].map(x => {
    const hip = new THREE.Group(); hip.position.set(x, 0.55, 0); g.add(hip);
    mk(new THREE.BoxGeometry(0.17, 0.28, 0.2), pants, 0, -0.13, 0, hip);
    const knee = new THREE.Group(); knee.position.set(0, -0.27, 0); hip.add(knee);
    mk(new THREE.BoxGeometry(0.15, 0.24, 0.17), pants, 0, -0.11, 0, knee);
    mk(new THREE.BoxGeometry(0.17, 0.07, 0.27), shoe, 0, -0.245, 0.04, knee);
    return { hip, knee };
  });
  mk(new THREE.BoxGeometry(0.42, 0.16, 0.24), pants, 0, 0.6, 0);
  const torso = mk(new THREE.CylinderGeometry(0.21, 0.23, 0.58, 14), shirt, 0, 0.95, 0); torso.scale.z = 0.66;
  if (look.number) {
    const t = canvasTex(16, 16, (c) => { c.fillStyle = '#fff'; c.font = `8px ${PIX}`; c.textAlign = 'center'; c.fillText(look.number, 8, 12); }, true);
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
    num.position.set(0, 0.98, 0.155); g.add(num);
  }
  if (look.apron) mk(new THREE.BoxGeometry(0.4, 0.6, 0.02), mat(look.apron), 0, 0.78, 0.155);
  mk(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 8), skin, 0, 1.27, 0);
  const head = new THREE.Group(); head.position.set(0, 1.43, 0); g.add(head);
  mk(new THREE.SphereGeometry(0.17, 18, 14), skin, 0, 0, 0, head);
  mk(new THREE.SphereGeometry(0.022, 6, 6), darkM, -0.06, 0.02, 0.155, head);
  mk(new THREE.SphereGeometry(0.022, 6, 6), darkM, 0.06, 0.02, 0.155, head);
  if (look.mustache) mk(new THREE.BoxGeometry(0.15, 0.03, 0.03), hairM, 0, -0.055, 0.16, head);
  if (look.goatee) mk(new THREE.BoxGeometry(0.07, 0.06, 0.04), hairM, 0, -0.12, 0.14, head);
  const hs = look.hairStyle;
  if (hs !== 'bald') { const h = mk(new THREE.SphereGeometry(0.18, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 0.015, -0.015, head); h.scale.set(1.02, 1, 1.05); }
  if (hs === 'long') mk(new THREE.BoxGeometry(0.33, 0.36, 0.1), hairM, 0, -0.1, -0.12, head);
  if (hs === 'bun') mk(new THREE.SphereGeometry(0.08, 10, 8), hairM, 0, 0.18, -0.08, head);
  if (hs === 'cap') { const capM = mat(look.cap || 0xf08a24); mk(new THREE.SphereGeometry(0.185, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capM, 0, 0.02, 0, head); mk(new THREE.BoxGeometry(0.26, 0.025, 0.16), capM, 0, 0.04, 0.2, head); }
  if (hs === 'bucket') { const capM = mat(look.cap || 0x2f2f2f); mk(new THREE.CylinderGeometry(0.16, 0.19, 0.14, 16), capM, 0, 0.1, 0, head); mk(new THREE.CylinderGeometry(0.26, 0.26, 0.015, 18), capM, 0, 0.03, 0, head); }
  if (look.beanie) { const bm = mat(look.beanie, { roughness: 1 }); mk(new THREE.SphereGeometry(0.19, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), bm, 0, 0.03, 0, head); mk(new THREE.CylinderGeometry(0.19, 0.19, 0.07, 16), bm, 0, 0.04, 0, head); }
  if (look.glasses) mk(new THREE.BoxGeometry(0.24, 0.05, 0.02), darkM, 0, 0.025, 0.165, head);
  const arms = [-0.28, 0.28].map(x => {
    const sh = new THREE.Group(); sh.position.set(x, 1.19, 0); g.add(sh);
    mk(new THREE.CylinderGeometry(0.058, 0.052, 0.5, 8), look.longSleeve ? shirt : skin, 0, -0.25, 0, sh);
    if (!look.longSleeve) mk(new THREE.CylinderGeometry(0.068, 0.065, 0.16, 8), shirt, 0, -0.06, 0, sh);
    mk(new THREE.SphereGeometry(0.062, 8, 6), skin, 0, -0.52, 0, sh);
    return sh;
  });
  const hand = new THREE.Object3D(); hand.position.set(0, -0.56, 0.05); arms[1].add(hand);
  const pad = new THREE.Group();
  box(0.22, 0.05, 0.11, mat(0x1b1b1b), 0, 0, 0, pad); box(0.04, 0.02, 0.03, 0x3ddc97, 0.05, 0.03, 0, pad);
  pad.position.set(0, 0.92, 0.44); pad.visible = false; g.add(pad);
  return { g, legs, arms, head, hand, pad };
}

export class Person {
  constructor(profile, role) {
    this.p = profile; this.role = role;
    Object.assign(this, buildBody(profile.look));
    this.g.traverse(o => { if (o.isMesh) o.userData.person = this; });
    ctx.scene.add(this.g);
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
  say(text, dur = 2.8) { this.bubble.textContent = text; this.bubble.style.opacity = 1; this.bubbleT = dur; }
  hold(cup) { this.cup = cup; this.hand.add(cup); cup.position.set(0, -0.05, 0); cup.rotation.set(0, 0, 0); }
  putCup(x, y, z) { if (!this.cup) return; ctx.scene.attach(this.cup); this.cup.position.set(x * K, y, z); this.cup.rotation.set(0, 0, 0); }
  pickCup() { if (this.cup) this.hold(this.cup); }
  dropCup() { if (this.cup) { this.cup.parent.remove(this.cup); this.cup = null; } }
  gesture(a, t = 1.4) { this.act = a; this.actT = t; }
  remove() {
    this.gone = true; ctx.scene.remove(this.g); this.dropCup(); this.tag.remove(); this.bubble.remove();
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

    const [L, R] = this.legs, [aL, aR] = this.arms;
    const sitting = this.pose === 'sit' || this.pose === 'game';
    this.walkPhase += dt * (moving ? 9 : 2);
    const s = Math.sin(this.walkPhase);
    let y = 0, hipL = 0, hipR = 0, kL = 0, kR = 0, armLx = 0, armRx = 0, armLz = 0.06, armRz = -0.06, bob = 0;
    if (moving) { hipL = s * 0.55; hipR = -s * 0.55; kL = Math.max(0, -s) * 0.6; kR = Math.max(0, s) * 0.6; armLx = -s * 0.45; armRx = s * 0.45; bob = Math.abs(Math.cos(this.walkPhase)) * 0.04; }
    else if (sitting) { y = this.seat ? this.seat.sitY : -0.1; hipL = hipR = -Math.PI / 2; kL = kR = this.seat && this.seat.floor ? 0.25 : Math.PI / 2; }
    else { armLx = Math.sin(this.walkPhase * 0.7) * 0.04; armRx = -armLx; }
    if (this.cup && this.cup.parent === this.hand && !this.act) armRx = moving ? -0.6 : -0.9;
    this.pad.visible = this.pose === 'game';
    if (this.pose === 'game' && !moving) { armLx = armRx = -1.0 + Math.sin(this.walkPhase * 6) * 0.05; armLz = 0.42; armRz = -0.42; bob = Math.sin(this.walkPhase * 3) * 0.01; }
    if (this.act === 'sip') { armRx = -2.3; armRz = -0.5; }
    if (this.act === 'cheer') { armLx = armRx = -2.9 + Math.sin(this.walkPhase * 10) * 0.2; armLz = 0.2; armRz = -0.2; bob += Math.abs(Math.sin(this.walkPhase * 8)) * 0.05; }
    if (this.act === 'wave') { armRx = -2.6; armRz = -0.4 + Math.sin(this.walkPhase * 12) * 0.35; }
    if (this.act === 'wipe') { armRx = -1.25; armRz = Math.sin(this.walkPhase * 8) * 0.5; }
    if (this.act === 'brew') { armLx = armRx = -1.3; armLz = 0.3; armRz = -0.3; }
    if (this.act === 'pour') { armLx = -1.2; armRx = -1.5 + Math.sin(this.walkPhase * 5) * 0.15; armLz = 0.35; armRz = -0.35; }
    if (this.act === 'facepalm') { armRx = -2.6; armRz = -0.75; }
    if (this.act === 'carry') { armLx = armRx = -1.4; armLz = 0.25; armRz = -0.25; }
    L.hip.rotation.x = hipL; R.hip.rotation.x = hipR; L.knee.rotation.x = kL; R.knee.rotation.x = kR;
    aL.rotation.set(armLx, 0, armLz); aR.rotation.set(armRx, 0, armRz);
    this.g.position.y = y + bob;
    this.head.rotation.y = this.pose === 'game' ? 0 : Math.sin(this.walkPhase * 0.31) * 0.2;
  }
}

// walks a path given in plan coordinates; resolves on arrival
export function walk(person, pts) { return new Promise(r => { person.path = pts.map(p => [p[0] * K, p[1]]); if (!pts.length) r(); else person.onArrive = r; }); }
