// 小強 (an item in the RPG menu): a cockroach let go somewhere on the shop floor, scuttling about in stops and starts.
// Someone who comes near it may spot it (7 in 10 do, another look every 5 s while near) and shouts for the owner, who drops whatever he's doing (what's in
// his hands goes straight back where it came from) and runs over to swat it with his slipper. Everyone near it runs off
// screaming and stands back to watch, the TV game stops for it, and nobody new comes in until it's over. Unspotted for a
// long while, it slips off into a crack in the wall.
import * as THREE from 'three';
import { ctx, mat } from './engine.js';
import { S, sleep } from './state.js';
import { K, rand, pick } from './util.js';
import { walk, walkNow } from './people.js';
import { log, floatText } from './feed.js';
import { interruptOwner, resumeOwner } from './sim.js';
import { navPath, nearestNode, spread, nodeAt, nodeCount, wayTo, allEdges } from './nav.js';
import { closeGame } from './games.js';
import { sfx } from './sfx.js';
import { LANE } from './layout.js';

// where it goes: anywhere on the floor people walk on (the walking graph, nav.js), inside or out on the porch, keeping
// to whichever it was let go on; never behind the bar, nor up on a seat
const offLimits = n => (n.x > 1.3 && n.z > -2.4 && n.z < 3.0) || onSeat(n);
const allowed = (n, zone) => zoneOf(n.z) === zone && !offLimits(n);
// inside the shop, or out on the porch (out to the kerb chair): someone notices it, runs from it, only on its side of the door
const zoneOf = z => (z > -4.4 && z < 4.4 ? 'in' : z >= 4.4 && z < 9.2 ? 'porch' : null);
const SPOT_R = 1.4;        // how close someone comes before they may see it (metres, as built: far enough that whoever's sat round the porch crate table can)
const SCARE_R = 2.3;       // who's near enough to run from it
const LIFE = 150;          // simulated seconds before an unseen one slips away
const RESPOT = 5;          // seconds before someone still near it, who missed it, gets another look

const SIZE = 1.6;          // (drawn this much larger than the model below)
const shellM = mat(0x3e1a08, { roughness: 0.25, metalness: 0.1 }), darkM = mat(0x2a1408, { roughness: 0.5 });
const legM = mat(0x3a1c0a, { roughness: 0.6 }), splatM = new THREE.MeshBasicMaterial({ color: 0x2a1a0c, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const slipperM = mat(0x2f6fd6, { roughness: 0.7 }), strapM = mat(0xf4f1ea, { roughness: 0.6 });

// a bit larger than life, so it can be seen at all from across the room: a glossy oval shell over a darker head, six
// jointed legs and two long feelers, built facing +z
function makeRoach() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), shellM); body.scale.set(0.95, 0.42, 1.65); body.position.y = 0.018; g.add(body);
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.004, 0.085), darkM); seam.position.set(0, 0.031, -0.004); g.add(seam);   // where the wings meet
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), darkM); head.scale.set(1.1, 0.7, 0.9); head.position.set(0, 0.014, 0.054); g.add(head);
  const legs = [];
  [-1, 1].forEach(side => [0.028, 0.004, -0.024].forEach((z, i) => {
    const hip = new THREE.Group(); hip.position.set(side * 0.022, 0.014, z); g.add(hip);
    const len = 0.03 + i * 0.008;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.0025, 0.0025), legM); leg.position.x = side * len / 2; hip.add(leg);
    hip.rotation.set(0, side * (0.5 - i * 0.5), side * 0.45);
    legs.push({ hip, side, i, base: hip.rotation.y });
  }));
  const feelers = [-1, 1].map(side => {
    const f = new THREE.Group(); f.position.set(side * 0.006, 0.018, 0.066); g.add(f);
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.0015, 0.07), legM); a.position.z = 0.035; f.add(a);
    f.rotation.set(-0.35, side * 0.4, 0);
    return f;
  });
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { g, legs, feelers, body };
}
function makeSlipper() {
  const g = new THREE.Group();
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.016, 0.24), slipperM); g.add(sole);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.03, 0.05), strapM); strap.position.set(0, 0.02, 0.03); g.add(strap);
  g.position.set(0, -0.09, 0.02); g.rotation.set(Math.PI / 2, 0, 0);   // gripped at the heel, the sole out past the hand
  return g;
}

// the TV game stops only while one of its players has run off from it (PAUSE on the screen), not for one across the room
export function tvPaused() {
  const p = !!S.seats?.gameSeats.some(s => s.occ?.frozen), tv = S.tv;
  if (p && tv.match && tv.flash?.text !== 'PAUSE') tv.flash = { text: 'PAUSE', t: 1e9 };
  if (!p && tv.flash?.text === 'PAUSE') tv.flash = null;
  return p;
}

// ---------------------------------------------------------------- letting one go
export function releaseRoach() {
  if (S.roach) return '店裡已經有一隻蟑螂在亂跑了……';
  if (S.closing) return '店要打烊了，現在放也沒人看得到。';
  // somewhere along any stretch of floor, each as likely as its length
  const edges = allEdges().filter(([i, j]) => { const a = nodeAt(i), b = nodeAt(j); return zoneOf(a.z) && allowed(a, zoneOf(a.z)) && allowed(b, zoneOf(a.z)); });
  let k = rand(0, edges.reduce((t, e) => t + e[2], 0)), pickE = edges[0];
  for (const e of edges) { if ((k -= e[2]) < 0) { pickE = e; break; } }
  const a = nodeAt(pickE[0]), b = nodeAt(pickE[1]), f = Math.random();
  const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f;
  const r = makeRoach();
  r.zone = zoneOf(z); r.route = [];
  r.g.position.set(x * K, 0.003, z); r.g.rotation.y = rand(0, Math.PI * 2); r.g.scale.setScalar(SIZE);
  ctx.scene.add(r.g);
  S.roach = Object.assign(r, { x, z, heading: r.g.rotation.y, goal: null, pause: 0.6, speed: 0, life: LIFE, rolled: new Map(), taken: new Map(), rethink: 0, alarm: false, dead: false, t: 0, check: 0 });
  log(r.zone === 'in' ? '有人偷偷在店裡放了一隻蟑螂……' : '有人偷偷在戶外區放了一隻蟑螂……');
  return S.roach;
}

// ---------------------------------------------------------------- how it goes about
const posOf = p => [p.g.position.x / K, p.g.position.z];
const metres = (ax, az, bx, bz) => Math.hypot((ax - bx) * K, az - bz);
// somewhere `lo` to `hi` along the floor from where it is (on its own side of the door), the way there; `score` picks
// among them (a random one if not given)
function wander(r, lo, hi, score) {
  const { d, prev } = spread(nearestNode(r.x, r.z));
  let best = null, bs = -Infinity;
  for (let i = 0; i < nodeCount(); i++) {
    if (d[i] < lo || d[i] > hi || !allowed(nodeAt(i), r.zone)) continue;
    const way = wayTo(prev, i);
    if (way.some(([x, z]) => zoneOf(z) !== r.zone || (x > 1.3 && z > -2.4 && z < 3.0))) continue;   // (not by way of behind the bar, or the other side of the door)
    const s = score ? score(nodeAt(i)) : Math.random();
    if (s > bs) { bs = s; best = way; }
  }
  return best || [];
}
function scuttle(r, dt) {
  // close to the owner, it runs from him (as far from him as it can get, close by); otherwise off along the floor to
  // somewhere, a stop, and off again
  const o = S.owner, [ox, oz] = posOf(o), d = metres(r.x, r.z, ox, oz);
  if (r.alarm && d < 1.1 && !r.dead && (r.rethink -= dt) <= 0) {
    r.rethink = 0.6;
    r.route = wander(r, 0.3, 1.6, n => metres(n.x, n.z, ox, oz) + Math.random() * 0.3);
    r.goal = null; r.pause = 0; r.speed = 0.75;
  }
  if (r.pause > 0) { r.pause -= dt; r.speed = 0; return; }
  if (!r.goal) {
    if (!r.route.length) { r.route = wander(r, 0.6, 2.5); r.speed = rand(0.25, 0.5); }
    r.goal = r.route.shift();
    if (!r.goal) { r.pause = 1; return; }
    r.goal = [r.goal[0] + rand(-0.08, 0.08), r.goal[1] + rand(-0.08, 0.08)];   // (not quite down the middle)
  }
  if (!r.speed) r.speed = rand(0.25, 0.5);
  const dx = (r.goal[0] - r.x) * K, dz = r.goal[1] - r.z, len = Math.hypot(dx, dz), step = r.speed * dt;
  if (len <= step) {
    r.x = r.goal[0]; r.z = r.goal[1]; r.goal = null;
    if (!r.route.length) r.pause = r.alarm ? rand(0.1, 0.4) : rand(0.4, 2.2);   // stops at the end of each run
    return;
  }
  r.x += dx / len * step / K; r.z += dz / len * step;
  const want = Math.atan2(dx, dz); let turn = want - r.heading; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  r.heading += turn * Math.min(1, dt * 14);
}
function pose(r, dt) {
  r.g.position.set(r.x * K, 0.003, r.z); r.g.rotation.y = r.heading;
  const go = r.speed > 0 && !r.dead;
  r.legs.forEach(l => { l.hip.rotation.y = l.base + (go ? Math.sin(r.t * 38 + l.i * 2 + (l.side > 0 ? Math.PI : 0)) * 0.45 : 0); });
  r.feelers.forEach((f, i) => { f.rotation.y = (i ? 1 : -1) * 0.4 + Math.sin(r.t * (go ? 9 : 3) + i) * 0.18; });
}

export function updateRoach(dt) {
  const r = S.roach; if (!r) return;
  r.t += dt;
  if (!r.dead) { scuttle(r, dt); pose(r, dt); }
  if (r.dead || r.leaving) return;
  if (r.alarm) { if ((r.check -= dt) <= 0) { r.check = 0.25; keepClear(r, dt); } return; }
  if ((r.life -= dt) <= 0) { slipAway(r); return; }
  // anyone near enough may see it: 7 in 10 do, and whoever's still near and hasn't yet gets another look every
  // RESPOT seconds
  if ((r.check -= dt) > 0) return;
  r.check = 0.3;
  const fresh = who => { const last = r.rolled.get(who); if (last !== undefined && r.t - last < RESPOT) return false; r.rolled.set(who, r.t); return true; };
  for (const c of S.customers) {
    if (!canSpot(c, r)) continue;
    const [cx, cz] = posOf(c);
    if (metres(r.x, r.z, cx, cz) > SPOT_R || !fresh(c)) continue;
    if (Math.random() < 0.7) { raiseAlarm(r, c); return; }
  }
  // the owner too, out from behind the bar (clearing the tables, say), the same as anyone
  const o = S.owner;
  if (zoneOf(o.g.position.z) === r.zone && metres(r.x, r.z, ...posOf(o)) < SPOT_R && fresh(o)) {
    if (Math.random() < 0.7) raiseAlarm(r, o);
  }
}
// anyone near it, whatever they're doing (eating, playing, on their way somewhere, on their way out), on its side of
// the door; only whoever's shut in the toilet can't see it
const canSpot = (c, r) => !c.gone && !c.frozen && S.toiletUser !== c && zoneOf(c.g.position.z) === r.zone;
// while it's being chased: anyone who comes by (just coming in, say) stands back from it too, and anyone already
// watching whom it, or the owner after it, comes too close to runs off again
function keepClear(r, dt) {
  const [ox, oz] = posOf(S.owner);
  for (const c of S.customers) {
    const [cx, cz] = posOf(c), m = metres(r.x, r.z, cx, cz);
    if (!c.frozen) {
      if (canSpot(c, r) && m < SCARE_R) { freeze(c); c.say(pick(m < 1.4 ? SCREAMS : HEARD), 2.2); standBack(c, r); }
      continue;
    }
    const f = c.frozen;
    if (!f.away || c.gone || c.path.length || (f.cool = (f.cool || 0) - 0.25) > 0) continue;
    if (m < 1.3 || metres(ox, oz, cx, cz) < 0.8) {
      f.cool = 1.5;
      c.say(pick(SCREAMS), 1.8); c.gesture('cheer', 0.6);
      standBack(c, r);
    }
  }
}

// unseen all this while: off, and into a crack somewhere
async function slipAway(r) {
  r.leaving = true;
  r.route = wander(r, 0.5, 1.5); r.goal = null; r.pause = 0; r.speed = 0.6; r.life = Infinity;
  await sleep(2.5);
  if (S.roach !== r) return;
  log('蟑螂鑽進牆縫，不見了……');
  disposeRoach();
}

// ---------------------------------------------------------------- 老闆，有蟑螂！
const SCREAMS = ['呀啊啊啊——！', '蟑螂！！', '好噁！！', '牠會不會飛啊！', '不要過來！！', '媽呀！！', '在我腳邊！！'];
const HEARD = ['什麼？蟑螂？', '暫停一下！', '在哪在哪？', '我要看！'];
const CHEERS = ['老闆威武！', '打得好！', '好險……', '老闆太神了', '啪的一聲好爽'];
export function raiseAlarm(r, spotter) {
  r.alarm = true; r.goal = null; r.pause = 0.2;
  const byOwner = spotter === S.owner;
  spotter.say(byOwner ? pick(['嗚哇！蟑螂！', '有蟑螂！看我的！', '哪來的蟑螂！']) : '老闆，有蟑螂！', 3);
  floatText('bang', '!', new THREE.Vector3(spotter.g.position.x / K, 2.1, spotter.g.position.z), 1.2);
  log(byOwner ? `${spotter.p.name}自己發現了蟑螂！` : `${spotter.p.name}發現了蟑螂！`);
  sfx('buzzer');
  closeGame();   // (a game the visitor is playing stops too: the camera's on the roach)
  // who runs: anyone near it (on its side of the door); those further off, a game on the TV across the room
  // included, carry on as they were
  const crowd = S.customers.filter(c => c === spotter || (canSpot(c, r) && metres(r.x, r.z, ...posOf(c)) < SCARE_R));
  crowd.forEach(c => {
    freeze(c);
    sleep(c === spotter ? 0.9 : rand(0.15, 0.7)).then(() => {
      if (!c.frozen || c.gone || !S.roach) return;
      if (c !== spotter) c.say(pick(SCREAMS), 2.4);
      c.gesture('cheer', 0.8);   // (arms up, flailing)
      standBack(c, r);
    });
  });
  hunt(r, spotter);
}

// stopped where they are: what they were doing waits (their waits hold still, a walk they set off on waits until
// they're back, people.js) until they're back where they were
function freeze(c) {
  c.frozen = { x: c.g.position.x / K, z: c.g.position.z, heading: c.targetHeading, pose: c.pose, status: c.status, path: c.path, onArrive: c.onArrive, resume: null };
  c.path = []; c.onArrive = null;
  if (c.pose !== 'stand') c.pose = 'stand';
  c.status = '躲蟑螂';
}
// the seats themselves (and the stools at the TV) are on the walking graph, as the ends of their ways in: no place to
// stand and watch from
const onSeat = n => S.seats.seats.some(t => (t.type === 'table' || t.type === 'game') && metres(t.x, t.z, n.x, n.z) < 0.35);
// off to somewhere 1.6 to 2.8 m from it, on its side of the door (out from behind the bar), not on top of anyone else
// nor right by the owner, the nearest such along the way; there they turn to watch
function standBack(c, r) {
  const taken = r.taken; taken.delete(c);
  const [ox, oz] = posOf(S.owner);
  const [cx, cz] = posOf(c), from = nearestNode(cx, cz), { d, prev } = spread(from);
  let best = -1, bs = Infinity;
  for (let i = 0; i < nodeCount(); i++) {
    const n = nodeAt(i), m = metres(n.x, n.z, r.x, r.z);
    if (m < 1.6 || m > 2.8 || zoneOf(n.z) !== r.zone || n.z < -4.3 || (r.zone === 'in' && n.x > 1.0) || d[i] === Infinity) continue;
    if (onSeat(n)) continue;   // (never up on a seat, a stool or in among a table: only the floor people walk on)
    if ([...taken.values()].some(([x, z]) => metres(x, z, n.x, n.z) < 0.5)) continue;
    if (S.customers.some(o => o !== c && !o.frozen && metres(...posOf(o), n.x, n.z) < 0.5)) continue;   // (nor where someone else sits or stands)
    const s = d[i] + (m < 2 ? 0.5 : 0) + (metres(n.x, n.z, ox, oz) < 1.0 ? 1.5 : 0);
    if (s < bs) { bs = s; best = i; }
  }
  c.frozen.away = true;
  if (best < 0) { c.face(Math.atan2((r.x - cx) * K, r.z - cz)); return; }   // nowhere to go: they just shrink back where they are
  const n = nodeAt(best); taken.set(c, [n.x, n.z]);
  c.speed = 2.0;
  walkNow(c, [[cx, cz], ...wayTo(prev, best)], () => { c.speed = 1.4; if (S.roach) c.face(Math.atan2((S.roach.x - n.x) * K, S.roach.z - n.z)); });
}
// back where they were, and carrying on with whatever it was
function goBack(c) {
  const f = c.frozen; if (!f) return;
  const [cx, cz] = posOf(c);
  c.speed = 1.4;
  walkNow(c, navPath(cx, cz, f.x, f.z), () => {
    c.frozen = null;
    c.targetHeading = f.heading; c.pose = f.pose; c.status = f.status;
    if (f.resume) walkNow(c, f.resume.pts, f.resume.r);
    else if (f.path.length) { c.path = f.path; c.onArrive = f.onArrive; }
    else f.onArrive?.();
  });
}

// the owner: everything down, the slipper off, over to it, and swat; it may get away from the first swing or two
async function hunt(r, spotter) {
  const o = S.owner, own = spotter === o;
  o.hunting = r;   // (from this moment his work can't carry on, nor walk him off: sim.js)
  if (own) interruptOwner();   // (stopped in his tracks at once: it's right there)
  await sleep(own ? 0.6 : 0.5);
  interruptOwner();
  o.status = '衝去打蟑螂'; o.speed = 2.7;
  if (!own) o.say(pick(['蟑螂？！在哪！', '交給我！', '大家不要動！']), 2.2);
  log(`${o.p.name}放下手邊的工作，${own ? '脫下拖鞋' : '衝過去打蟑螂'}`);
  o.slipper = makeSlipper(); o.hand.add(o.slipper);
  const [ox, oz] = posOf(o);
  await walk(o, navPath(ox, oz, r.x, r.z));
  for (let swing = 1; ; swing++) {
    // close in on it (it keeps running)
    for (let tries = 0; tries < 12 && S.roach === r; tries++) {
      const [px, pz] = posOf(o), d = metres(px, pz, r.x, r.z);
      if (d < 0.42) break;
      const k = (d - 0.32) / d;
      await walk(o, [[px + (r.x - px) * k, pz + (r.z - pz) * k]]);
    }
    if (S.roach !== r) return;
    const [px, pz] = posOf(o);
    o.face(Math.atan2((r.x - px) * K, r.z - pz));
    await sleep(0.25);
    o.gesture('swat', 0.6);
    await sleep(0.32);
    floatText('bang', '啪！', new THREE.Vector3(r.x, 0.6, r.z), 0.9); sfx('punch');
    if (swing < 3 && Math.random() < (swing === 1 ? 0.55 : 0.35)) {
      // missed: it darts off
      r.route = wander(r, 0.5, 1.2); r.goal = null; r.pause = 0; r.speed = 1.0; r.rethink = 0.8;
      await sleep(0.3);
      o.say(pick(['可惡，別跑！', '嘖，跑真快', '站住！']), 1.6);
      continue;
    }
    break;
  }
  // got it
  r.dead = true; r.speed = 0;
  r.g.scale.set(1.35 * SIZE, 0.22 * SIZE, 1.25 * SIZE); pose(r, 0);
  const splat = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), splatM); splat.rotation.x = -Math.PI / 2; splat.position.set(r.x * K, 0.004, r.z); splat.scale.set(1, 1.3, 1);
  ctx.scene.add(splat); r.splat = splat;
  log(`${o.p.name}一拖鞋打死了蟑螂`);
  await sleep(0.4);
  o.say(pick(['搞定！', '解決了！', '哼，看你往哪跑']), 2);
  S.customers.forEach(c => { if (c.frozen && Math.random() < 0.6) sleep(rand(0.2, 0.9)).then(() => { if (!c.gone) { c.say(pick(CHEERS), 2); c.gesture('cheer', 1.2); } }); });
  await sleep(1.6);
  // wiped up with a tissue
  o.gesture('crouch', 1.4); await sleep(1.4);
  ctx.scene.remove(r.g); ctx.scene.remove(splat); r.splat = null;
  o.say('沒事了沒事了，大家繼續～', 2.4);
  if (o.slipper) { o.slipper.parent?.remove(o.slipper); o.slipper = null; }
  S.roach = null; disposeParts(r);
  // everyone back to what they were doing, a few at a time
  S.customers.forEach(c => { if (c.frozen) sleep(rand(0.3, 1.8)).then(() => goBack(c)); });
  // and he back behind the bar, and to work
  o.status = '回吧台'; o.speed = 1.6;
  const [bx, bz] = posOf(o);
  await walk(o, navPath(bx, bz, LANE, rand(-1.0, 1.5)));
  if (o.hunting === r) resumeOwner();   // (unless he's already off after the next one)
}

function disposeParts(r) {
  r.g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  r.splat?.geometry.dispose();
}
export function disposeRoach() {
  const r = S.roach; if (!r) return;
  ctx.scene?.remove(r.g); if (r.splat) ctx.scene?.remove(r.splat);
  disposeParts(r);
  S.roach = null;
}
