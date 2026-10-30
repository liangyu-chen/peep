// People in the café: animation poses, speech bubble and name tag, walking along plan-coordinate paths (the body is body.js).
import * as THREE from 'three';
import { ctx, mat, cyl } from './engine.js';
import { buildBody, tickFace } from './body.js';
import { S } from './state.js';
import { K } from './util.js';
import { isIced } from './content.js';

const teaCupM = mat(0xf2f0ea, { roughness: 0.3 });
const coffeeM = mat(0x5a3220, { roughness: 0.3 });
const glassM = mat(0xe8f4ff, { roughness: 0.05, transparent: true, opacity: 0.5 });

// a lit cigarette, held between the fingers of the left hand: filter, paper that burns down, grey ash and the ember
const cigM = mat(0xf4f1ea, { roughness: 0.7 }), filterM = mat(0xd9a05a, { roughness: 0.8 }), ashM = mat(0x9a9894, { roughness: 1 });
const PAPER = 0.05;
function makeCigarette() {
  const g = new THREE.Group();
  cyl(0.0047, 0.0047, 0.016, filterM, 0, -0.012, 0, g, 8);
  const paper = cyl(0.0045, 0.0045, PAPER, cigM, 0, -0.004 + PAPER / 2, 0, g, 8);
  const ash = cyl(0.0043, 0.0045, 0.006, ashM, 0, 0, 0, g, 8);
  const emberM = new THREE.MeshBasicMaterial({ color: 0xff4a12 });
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), emberM); g.add(ember);
  g.rotation.set(Math.PI / 2, 0, 0.3);
  g.traverse(o => { o.castShadow = false; });
  g.userData = { paper, ash, ember, emberM };
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

export class Person {
  constructor(profile, role) {
    this.p = profile; this.role = role;
    Object.assign(this, buildBody(profile.look, profile.name));
    this.faceAnim = { blinkT: Math.random() * 4 };
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
  // smoke for `dur` simulated seconds: light it, then hold / take a drag / blow it out / tap the ash, until it's burnt down.
  // The smoke itself (from the tip, and blown out after a drag) is drawn by updateSmoke in sim.js.
  lightUp(dur) {
    if (this.cig) return;
    this.cig = makeCigarette(); this.handL.add(this.cig);
    this.lighter = makeLighter(); this.hand.add(this.lighter);
    this.smk = { phase: 'light', t: 1.8, dur, life: dur };
  }
  putOut() {
    if (this.lighter) { this.lighter.parent.remove(this.lighter); this.lighter = null; }
    if (!this.cig) return;
    this.cig.parent.remove(this.cig); this.cig = null; this.smk = null; this.exhaleT = 0;
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
    this.gone = true; ctx.scene.remove(this.g); this.dropCup(); this.putOut(); this.tag.remove(); this.bubble.remove();
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

    const [L, R] = this.legs, [aL, aR] = this.arms;
    const sitting = this.pose === 'sit' || this.pose === 'game';
    this.walkPhase += dt * (moving ? 9 : 2);
    const s = Math.sin(this.walkPhase);
    let y = 0, hipL = 0, hipR = 0, kL = 0, kR = 0, armLx = 0, armRx = 0, armLz = 0.06, armRz = -0.06, bob = 0, elL = -0.12, elR = -0.12;
    if (moving) { hipL = s * 0.55; hipR = -s * 0.55; kL = Math.max(0, -s) * 0.6; kR = Math.max(0, s) * 0.6; armLx = -s * 0.45; armRx = s * 0.45; elL = -0.3 + Math.min(0, s) * 0.2; elR = -0.3 - Math.max(0, s) * 0.2; bob = Math.abs(Math.cos(this.walkPhase)) * 0.04; }
    else if (sitting) { y = this.seat ? this.seat.sitY : -0.1; hipL = hipR = -Math.PI / 2; kL = kR = this.seat && this.seat.floor ? 0.25 : Math.PI / 2; armLx = armRx = -0.25; elL = elR = -0.7; }   // hands resting on the lap
    else { armLx = Math.sin(this.walkPhase * 0.7) * 0.04; armRx = -armLx; }
    if (this.cup && this.cup.parent === this.hand && !this.act) { armRx = moving ? -0.25 : -0.35; elR = -1.0; }   // forearm up, cup in front
    this.pad.visible = this.pose === 'game';
    if (this.pose === 'game' && !moving) { armLx = armRx = -0.55 + Math.sin(this.walkPhase * 6) * 0.04; elL = elR = -1.0; armLz = 0.3; armRz = -0.3; bob = Math.sin(this.walkPhase * 3) * 0.01; }
    if (this.act === 'sip') { armRx = -0.5; elR = -2.4; armRz = -0.3; }
    if (this.act === 'cheer') { armLx = armRx = -2.9 + Math.sin(this.walkPhase * 10) * 0.2; elL = elR = -0.2; armLz = 0.2; armRz = -0.2; bob += Math.abs(Math.sin(this.walkPhase * 8)) * 0.05; }
    if (this.act === 'wave') { armRx = -2.4; elR = -0.5; armRz = -0.4 + Math.sin(this.walkPhase * 12) * 0.35; }
    if (this.act === 'wipe') { armRx = -0.8; elR = -0.7; armRz = Math.sin(this.walkPhase * 8) * 0.5; }
    if (this.act === 'brew') { armLx = armRx = -0.8; elL = elR = -0.8; armLz = 0.3; armRz = -0.3; }
    if (this.act === 'pour') { armLx = -0.7; armRx = -0.9 + Math.sin(this.walkPhase * 5) * 0.15; elL = -0.8; elR = -0.9; armLz = 0.35; armRz = -0.35; }
    if (this.act === 'facepalm') { armRx = -0.9; elR = -2.0; armRz = -0.45; }
    let pitch = 0;
    const ph = !moving && !this.act && this.smk ? this.smk.phase : null;
    if (ph === 'hold' || ph === 'exhale') { armLx = sitting ? -0.35 : -0.2; elL = -1.5; armLz = 0.2; }   // cigarette held up by the shoulder
    if (ph === 'exhale') pitch = -0.2;                                                                    // chin up, blowing it out
    if (ph === 'drag') { armLx = -0.45; elL = -2.45; armLz = 0.35; pitch = -0.06; }                        // to the lips
    if (ph === 'tap') { armLx = -0.55; elL = -1.05 + Math.sin(this.walkPhase * 28) * 0.18; armLz = 0.28; }   // flicking the ash off
    if (ph === 'light') { armLx = -0.45; elL = -2.45; armLz = 0.35; armRx = -0.45; elR = -2.35; armRz = -0.5; pitch = 0.08; }   // lighter cupped to it
    if (this.act === 'aim') { armRx = -0.7; elR = -1.4; armRz = -0.15; armLx = -0.5; elL = -1.2; }   // launcher pulled back, ready
    if (this.act === 'shoot') { armRx = -1.35; elR = -0.1; armRz = -0.05; }                          // and ripped forward
    if (this.act === 'carry') { armLx = armRx = -0.9; elL = elR = -0.7; armLz = 0.25; armRz = -0.25; }
    L.hip.rotation.x = hipL; R.hip.rotation.x = hipR; L.knee.rotation.x = kL; R.knee.rotation.x = kR;
    aL.rotation.set(armLx, 0, armLz); aR.rotation.set(armRx, 0, armRz);
    this.elbows[0].rotation.x = elL; this.elbows[1].rotation.x = elR;
    this.g.position.y = y + bob;
    this.head.rotation.y = this.pose === 'game' || ph ? 0 : Math.sin(this.walkPhase * 0.31) * 0.2;
    this.head.rotation.x = pitch;
  }
}

// walks a path given in plan coordinates; resolves on arrival
export function walk(person, pts) { return new Promise(r => { person.path = pts.map(p => [p[0] * K, p[1]]); if (!pts.length) r(); else person.onArrive = r; }); }
