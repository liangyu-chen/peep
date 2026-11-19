import * as THREE from 'three';
import { ctx, mat } from './engine.js';
import { S, sleep } from './state.js';
import { K, pick, rand } from './util.js';
import { Person, walk, walkNow } from './people.js';
import { L } from './profiles.js';
import { log, floatText } from './feed.js';
import { interruptOwner, resumeOwner } from './sim.js';
import { navPath, nearestNode, spread, nodeAt, nodeCount, wayTo } from './nav.js';
import { DOOR, HUBX, LANE, KERB, RISE, route } from './layout.js';
import { sfx } from './sfx.js';
import { dressOfficer, OFFICER_LOOKS } from './police.js';
import { policeBike } from './policeBike.js';
import { moverShadows } from './quality.js';
import { closeGame } from './games.js';
import { closeCard } from './hud.js';

// the police bikes: one behind the other (front, rear) along the lane's shop-side edge, parked past the shop toward the
// crossroads, clear of the kerb seats and the scooters parked along the frontage (world x, plan z)
const BIKE_Z = 10.25, BIKE_W = [6.9, 4.3], BIKE_IN = -15, BIKE_GAP = 2.6, RIDE_W = 34, MOUNT_Z = 10.95;
const plan = w => w / K;
// the way out: through the door, down past the camping chair onto the lane, along it to the crossroads
const STREET_Z = 11.2, STOP_X = plan(14.4);
const OWNER_ON = 8.05, OWNER_SPOT = [-1.05, 8.2];   // where the owner steps off the line: beside the kerb camping chair
const GAP = 0.8, CONVOY_V = 1.1;                    // the walk out: this far apart, this fast
const SHOP_X0 = -3.1, SHOP_X1 = 3.1, SHOP_Z0 = -4.4, SHOP_Z1 = 9.2;
// while he's about, the customers all keep to the back of the shop round the TV and watch from there, and he (with the
// owner after him) keeps to the front part of the room, from the purple wall's back seat out to the door
const inBack = (x, z) => z < -1.95 && z > -4.45 && x > SHOP_X0 && x < SHOP_X1;
const FRONT_Z0 = -1.6;
const inFront = z => z > FRONT_Z0 - 0.3 && z < 4.4;
// where they stand to watch: along the gap in front of the TV players, up the walkway, round the manga ledge (all of
// them clear of the stools, and of the tree stump at the bar's top end (0.55, -2.4), a seat for watching the TV game)
const BACK_SPOTS = [[-1.6, -2.3], [-1.0, -2.3], [-0.4, -2.25], [-1.6, -2.85], [-1.6, -3.4], [-1.6, -3.95], [-1.0, -3.3],
  [0.35, -3.25], [1.0, -3.3], [1.7, -2.95], [-1.2, -4.2], [-0.2, -4.2], [2.05, -3.4]];
// what he says, and the owner's answer to it
const BANTER = [
  ['欸…老闆，再來一杯啦…', '你喝太多了，今天不賣你了。'],
  ['我真的只喝了一杯而已啦…', '一杯會喝成這樣？騙誰啊。'],
  ['這一帶最好喝的就在這…', '謝謝捧場，但你今天先回家。'],
  ['你看我？我沒醉，我醒著。', '醒著的人不會跟椅子講話。'],
  ['我跟你說，我認識老闆…', '我就是老闆，我不認識你。'],
  ['是世界在晃，還是我站在地上？', '是你在晃，小心不要跌倒。'],
  ['來啦，最後一杯嘛', '沒有最後一杯，請你離開。'],
  ['你們店…音樂…放大聲一點…', '不要吵到其他客人好嗎。'],
];
const SIT_BANTER = [
  ['這位子…讓我坐一下…', '那是客人的位子，請你起來。'],
  ['欸這椅子好舒服…', '先生，這裡不是讓你睡覺的。'],
  ['服務生…點餐…', '請你離開。'],
];
const FEAR = ['醉漢！不要過來！', '他手上那個瓶子…', '他看起來不太妙，我先走…', '天啊，小心他靠過來…'];
const GAWK = ['他是不是喝很多啊…', '好可怕，離遠一點', '老闆好勇敢', '要不要報警啊？', '他剛剛是不是要坐我位子…', '欸你看他走路', '我先拍一下…', '他要去哪…'];
const GAWK_POLICE = ['警察來了！', '終於…', '被帶走了', '好險有警察', '老闆好帥'];
const RELIEF = ['嚇死我了…', '終於走了', '老闆辛苦了！', '好險好險', '可以繼續喝咖啡了'];
const bottleM = mat(0x6d8f42, { roughness: 0.35 }), capM = mat(0xc8a24a, { roughness: 0.5 });

const posOf = p => [p.g.position.x / K, p.g.position.z];
const metres = (ax, az, bx, bz) => Math.hypot((ax - bx) * K, az - bz);
const zoneOf = z => (z > -4.4 && z < 4.4 ? 'in' : z >= 4.4 && z < 9.2 ? 'porch' : null);
const inShop = (x, z) => x >= SHOP_X0 && x <= SHOP_X1 && z >= SHOP_Z0 && z < SHOP_Z1;
const barSpot = n => n.x > 1.2 && n.z > -2.6 && n.z < 3.1;
const onSeat = n => S.seats.seats.some(t => (t.type === 'table' || t.type === 'game') && metres(t.x, t.z, n.x, n.z) < 0.35);
const offLimits = n => barSpot(n) || onSeat(n);
function nearestWalkable(x, z) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < nodeCount(); i++) {
    const n = nodeAt(i); if (offLimits(n)) continue;
    const d = metres(n.x, n.z, x, z);
    if (d < bd) { bd = d; best = i; }
  }
  return best >= 0 ? nodeAt(best) : nodeAt(nearestNode(x, z));
}
function safePath(from, to, blocked) {
  const [sx, sz] = from, [tx, tz] = to;
  const pts = navPath(sx, sz, tx, tz, blocked);
  if (!pts.length) return [[sx, sz], [tx, tz]];
  if (metres(pts[0][0], pts[0][1], sx, sz) > 0.05) pts.unshift([sx, sz]);
  return pts;
}
function safePathPrefer(from, to, preferredBlocked) {
  const [tx, tz] = to;
  if (!preferredBlocked) return safePath(from, to);
  const pts = safePath(from, to, preferredBlocked);
  const end = pts[pts.length - 1];
  if (end && metres(end[0], end[1], tx, tz) <= 0.6) return pts;
  return safePath(from, to);
}

function makeBottle() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.18, 10), bottleM); body.position.y = 0.09; g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.09, 8), bottleM); neck.position.y = 0.22; g.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 8), capM); cap.position.y = 0.28; g.add(cap);
  g.position.set(0, -0.05, 0.02); g.rotation.set(0.45, 0, 0.18);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// (x in world metres here: the bikes are out on the lane, built in plain world metres like the rest of it)
function setBike(b, wx, z, face) { b.g.position.set(wx, z > KERB ? -RISE : 0, z); b.g.rotation.y = face; }
// each bike rides on its own, straight to where it's sent, easing off to a stop if `stop`
function driveTo(b, wx, z, stop = false) { return new Promise(r => { b.drive = { x: wx, z, r, stop, speed: b.drive?.speed ?? 0 }; }); }
function updateDrive(d, dt) {
  d.bikes.forEach(b => {
    const q = b.drive; if (!q) return;
    const p = b.g.position, dx = q.x - p.x, dz = q.z - p.z, dist = Math.hypot(dx, dz);
    const top = q.stop ? Math.min(5.2, Math.sqrt(2 * 3.5 * dist) + 0.3) : 5.2;
    q.speed += (top - q.speed) * Math.min(1, dt * (q.speed > top ? 6 : 1.5));
    const step = q.speed * dt;
    if (dist <= step || dist < 0.01) { b.spin(dist); p.x = q.x; p.z = q.z; b.drive = null; q.r(); }
    else { b.spin(step); p.x += dx / dist * step; p.z += dz / dist * step; }
    p.y = p.z > KERB ? -RISE : 0;
  });
}

function makeDrunk() {
  const p = new Person({ name: '醉漢', regular: false, look: L(0xdba982, 0x241910, 'short', 0x6b5844, 0x33323a, { body: 'male', height: 'short', bottom: 'pants', topStyle: 'tee', topPattern: 'none' }) }, 'drunk');
  p.tag.className = 'tag drunk'; p.tag.querySelector('i').textContent = '醉漢'; p.speed = 1.05; p.status = '醉醺醺';
  const bottle = makeBottle(); p.hand.add(bottle); p.bottle = bottle; return p;
}
// an ordinary body in the uniform's shirt and trousers, with the cap, vest and duty belt put on over it (police.js)
function makeOfficer(name, i) {
  const p = new Person({ name, regular: false, look: OFFICER_LOOKS[i % OFFICER_LOOKS.length] }, 'police');
  dressOfficer(p).forEach(o => o.traverse(m => { if (m.isMesh) m.userData.person = p; }));
  moverShadows(p.g);
  p.tag.className = 'tag police'; p.tag.querySelector('i').textContent = '警察'; p.speed = 1.7; return p;
}

// only the seats in the front part of the room: the purple wall's, the corner by the door (never out on the porch, nor
// in the back where everyone's gone to watch)
function freeDrunkSeat(d) {
  const list = S.seats.tableSeats.filter(s => !s.occ && s.sitY !== undefined && s.path && !s.porch && s.z >= FRONT_Z0 && s.z < 4.4);
  if (!list.length) return null;
  if (d?.seat && list.length > 1) { const other = list.filter(s => s !== d.seat); if (other.length) return pick(other); }
  return pick(list);
}
function releaseSeat(p) { if (p?.seat?.occ === p) p.seat.occ = null; p.seat = null; }

// what they were doing waits. `stay`: already at the back, they stay just as they are (sat on their stool, say), only
// watching; anyone else gets up (their seat is let go while they're away, so he may well sit in it; they get it back
// if it's free again)
function freeze(c, d, stay = false) {
  if (!c || c.gone || c.frozen || S.toiletUser === c) return false;
  // (a seat at the back is kept for them: he never goes back there, and a TV game they're in holds paused meanwhile)
  const seat = stay ? null : c.seat;
  if (!stay) { if (c.seat?.occ === c && !inBack(c.seat.x, c.seat.z)) c.seat.occ = null; c.seat = null; }
  const [fx, fz] = posOf(c);
  c.frozen = { by: 'drunk', x: fx, z: fz, heading: c.targetHeading, pose: c.pose, status: c.status, path: c.path, onArrive: c.onArrive, resume: null, away: false, stay, seat };
  c.path = []; c.onArrive = null;
  if (!stay && c.pose !== 'stand') c.pose = 'stand';
  c.status = '看醉漢';
  return true;
}
function goBack(c) {
  const f = c.frozen; if (!f || f.by !== 'drunk') return;
  f.home = true;
  const done = () => {
    if (f.seat && (!f.seat.occ || f.seat.occ === c)) { f.seat.occ = c; c.seat = f.seat; }
    c.frozen = null; c.targetHeading = f.heading; c.pose = f.pose; c.status = f.status;
    if (f.resume) walkNow(c, f.resume.pts, f.resume.r);
    else if (f.path.length) { c.path = f.path; c.onArrive = f.onArrive; }
    else f.onArrive?.();
  };
  if (f.stay) { done(); return; }
  const [cx, cz] = posOf(c); c.speed = 1.4;
  walkNow(c, navPath(cx, cz, f.x, f.z), done);
}

// off to the back of the shop to watch from there: anyone already there stays where they are; anyone else to the
// nearest free spot to stand at round the TV (if every one is taken, they stay where they are, out of his way)
function sendBack(c, d) {
  const [cx, cz] = posOf(c);
  // (stood at the back already: they stay as they are. Sat at the back (at the TV, the manga ledge, the counter's back
  // end): they get up and step over to the nearest spot to stand and see him from, like everyone else)
  if (inBack(cx, cz) && c.pose === 'stand' && (!c.seat || c.seat.type === 'spec')) { freeze(c, d, true); c.frozen.away = true; return; }
  const busy = S.customers.filter(o => o !== c && !o.gone).map(o => o.frozen?.spot || (inBack(...posOf(o)) ? posOf(o) : null)).filter(Boolean);
  let spot = null, bd = Infinity;
  for (const s of BACK_SPOTS) {
    if (busy.some(([x, z]) => metres(x, z, s[0], s[1]) < 0.45)) continue;
    const m = metres(cx, cz, s[0], s[1]); if (m < bd) { bd = m; spot = s; }
  }
  if (!spot) { freeze(c, d, true); c.frozen.away = true; return; }
  freeze(c, d); c.frozen.spot = spot; c.speed = 2.0;
  walkNow(c, safePath([cx, cz], spot), () => { c.speed = 1.4; c.frozen && (c.frozen.away = true); });
}

function turnBackComer(c, d) {
  if (!freeze(c, d)) return;
  c.status = '嚇到離開'; c.fromLane = false; c.frozen.away = false;
  if (c.spot) { c.spot.occ = null; c.spot = null; }
  c.say('裡面好像有事…我先不進去了。', 2.6);
  const [x, z] = posOf(c), side = x >= 0 ? 16 : -16;
  walkNow(c, [[x, z], [side, 10.55]], () => {
    const i = S.customers.indexOf(c); if (i >= 0) S.customers.splice(i, 1);
    if (c === S.selected || S.selected?.owner === c) closeCard(); c.remove();
  });
}

// as he turns up: whoever's on their way in from the lane thinks better of it; everyone in the shop (out on the porch
// too) goes to the back of the room to watch, nearest first, so they take the nearest spots
function scareEveryone(d) {
  closeGame();
  const list = S.customers.filter(c => !c.gone && !c.frozen && S.toiletUser !== c);
  list.filter(c => c.fromLane || !inShop(...posOf(c))).forEach(c => turnBackComer(c, d));
  const back = ([x, z]) => metres(x, z, HUBX, -3);
  list.filter(c => !c.frozen).sort((a, b) => back(posOf(a)) - back(posOf(b))).forEach(c => {
    sendBack(c, d);
    if (Math.random() < 0.5) { const [cx, cz] = posOf(c); c.say(pick(FEAR), 2.4); floatText('bang', '!', new THREE.Vector3(cx, 2.1, cz), 1); }
  });
}

// they don't come any nearer, nor run about: they stand (or sit) at the back and watch him, turning to follow him with
// their eyes, and now and then one of them says something about it. Anyone who turns up in the shop meanwhile (out of
// the toilet, say) goes back there too
function keepClear(d, dt) {
  const drunk = d?.drunk; if (!drunk) return;
  const [dx, dz] = posOf(drunk);
  const watching = [];
  for (const c of S.customers) {
    if (c.gone || S.toiletUser === c) continue;
    const [cx, cz] = posOf(c);
    if (!c.frozen) { if (!d.escort && inShop(cx, cz)) { closeGame(); sendBack(c, d); } continue; }
    const f = c.frozen; if (f.by !== 'drunk' || !f.away || f.home || c.path.length) continue;
    if (c.pose === 'stand') c.face(Math.atan2((dx - cx) * K, dz - cz));
    watching.push(c);
  }
  if ((d.gossip = (d.gossip ?? 2) - dt) <= 0 && watching.length) {
    d.gossip = rand(2.8, 4.8);
    pick(watching).say(pick(d.phase === 'police' ? GAWK_POLICE : GAWK), 2.2);
  }
}

// he says something, and a moment later the owner (who's never far off him) answers it
function talk(d, [line, reply], delay = 1.4) {
  const drunk = d.drunk; if (!drunk) return;
  drunk.say(line, 2.8); d.mumble = rand(5.5, 8);
  sleep(delay).then(() => {
    if (S.drunk !== d || d.drunk !== drunk || !reply) return;
    const o = S.owner, [ox, oz] = posOf(o), [dx, dz] = posOf(drunk);
    if (!o.path.length) o.face(Math.atan2((dx - ox) * K, dz - oz));
    o.say(reply, 2.8);
  });
}
// the next of his lines, each once before any comes round again
function nextLine(d, list = BANTER) {
  const key = list === BANTER ? 'lines' : 'sitLines';
  if (!d[key]?.length) d[key] = list.slice().sort(() => Math.random() - 0.5);
  return d[key].pop();
}
// everyone who stood back goes back to what they were doing, a few at a time, some glad it's over
function releaseCrowd() {
  S.customers.forEach(c => {
    const f = c.frozen; if (f?.by !== 'drunk' || f.home) return;
    f.home = true;
    sleep(rand(0.3, 1.8)).then(() => { if (c.gone || c.frozen !== f) return; if (Math.random() < 0.5) c.say(pick(RELIEF), 2); goBack(c); });
  });
}

function ownerStandSpot(d) {
  const drunk = d?.drunk; if (!drunk) return null;
  const [dx, dz] = posOf(drunk), [ox, oz] = posOf(S.owner);
  const from = nearestNode(ox, oz), { d: dist } = spread(from);
  const tryFind = (minD, maxD, sameZone) => {
    let best = null, bs = Infinity;
    for (let i = 0; i < nodeCount(); i++) {
      const n = nodeAt(i), m = metres(n.x, n.z, dx, dz), dm = metres(n.x, n.z, ox, oz);
      if (dist[i] === Infinity || m < minD || m > maxD) continue;
      if (offLimits(n) || !inFront(n.z)) continue;   // (he keeps to the front of the room, and so does the owner after him)
      if (sameZone && zoneOf(n.z) !== (zoneOf(dz) ?? zoneOf(oz) ?? 'in')) continue;
      if (S.customers.some(c => !c.gone && metres(...posOf(c), n.x, n.z) < 0.5)) continue;
      const s = Math.abs(m - 1.55) * 2 + dm * 0.1;
      if (s < bs) { bs = s; best = n; }
    }
    return best;
  };
  return tryFind(1.2, 1.9, true) || tryFind(1.0, 2.3, false) || tryFind(0.8, 3.2, false) || tryFind(0.7, 5.0, false) || nearestWalkable(dx + (ox < dx ? -1.4 : 1.4), dz);
}

function updateOwnerTail(d, dt) {
  const o = S.owner, drunk = d?.drunk;
  if (!o || !drunk || d.phase === 'police' || d.phase === 'leaving' || d.ownerPolicing) return;
  const [ox, oz] = posOf(o), [dx, dz] = posOf(drunk), m = metres(ox, oz, dx, dz);
  o.hunting = drunk; o.status = '盯著醉漢'; o.speed = 1.5;
  if (m < 2.8 && !o.path.length) o.face(Math.atan2((dx - ox) * K, dz - oz));
  const goal = d._ownerGoal;
  if (o.path.length && goal && metres(dx, dz, goal.x, goal.z) < 2.4) return;
  const needMove = m < 1.15 || m > 2.1 || (drunk.path.length && m > 1.65);
  if (!needMove) { if (!o.path.length || (goal && metres(ox, oz, goal.x, goal.z) < 0.3)) { o.path = []; d._ownerGoal = null; } return; }
  const spot = ownerStandSpot(d);
  const tx = spot ? spot.x : dx + (ox < dx ? -1.4 : 1.4), tz = spot ? spot.z : dz;
  if (metres(ox, oz, tx, tz) < 0.2) return;
  d._ownerGoal = { x: tx, z: tz };
  walk(o, safePath([ox, oz], [tx, tz]));
}

export function updateDrunk(dt) {
  const d = S.drunk; if (!d) return;
  d.t += dt; updateDrive(d, dt);
  d.bikes.forEach(b => { b.flash(dt); b.tick(dt); });
  if (!d.drunk) return;
  if (d.convoy) updateConvoy(d.convoy, dt);
  keepClear(d, dt);
  updateOwnerTail(d, dt);
  // he keeps on mumbling while he's about the shop, and the owner keeps answering him
  if (!d.escort && !d.arrest && (d.mumble = (d.mumble ?? 5) - dt) <= 0) talk(d, nextLine(d, d.seat ? SIT_BANTER : BANTER));
}

// ---------------------------------------------------------------- the walk out, in single file
// a way laid out once (plan coordinates), and how far along it each point is (metres)
function makeTrack(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + metres(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
function trackAt(t, s) {
  const { pts, cum } = t;
  if (s <= 0) return pts[0];
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] < s) continue;
    const seg = cum[i] - cum[i - 1]; if (seg < 1e-6) return pts[i];
    const k = (s - cum[i - 1]) / seg, a = pts[i - 1], b = pts[i];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  }
  return pts[pts.length - 1];
}
// the stretch of it from s0 to s1, as a path to walk
function trackSlice(t, s0, s1) {
  const out = [trackAt(t, s0)];
  t.cum.forEach((c, i) => { if (c > s0 && c < s1) out.push(t.pts[i]); });
  out.push(trackAt(t, s1));
  return out;
}
// from where he stands: out through the door (or along the porch to it), down past the camping chair onto the lane, and
// along the lane's near side to the crossroads. `ownerS`: where along it the owner steps off, by the camping chair
function escortTrack([x, z]) {
  // (stood in the walkway, as he is for the arrest: straight on up it to the door, never back a step to the walking
  // graph's nearest point first, which would bunch the line up)
  const pts = z < 4.4 && Math.abs(x - HUBX) < 0.05 && z < DOOR[3][1]
    ? [[x, z], DOOR[3], DOOR[2], DOOR[1]]
    : z < 4.4
    ? [...safePathPrefer([x, z], DOOR[3], (i, n) => onSeat(n)), DOOR[2], DOOR[1]]
    : safePath([x, z], DOOR[1], (i, n) => n.z < 4.35);
  const atDoor = pts.length - 1;
  pts.push([DOOR[1][0], OWNER_ON], [DOOR[1][0], 9.4], [-1.2, STREET_Z], [STOP_X, STREET_Z]);
  const t = makeTrack(pts);
  t.ownerS = t.cum[atDoor + 1];
  return t;
}
// everyone in line walks the same way, each keeping GAP behind whoever's in front (who's still on it); each stops at
// their own end, or steps off there (exit) and lets the rest go on by
function convoy(d, track, members) {
  return new Promise(r => { d.convoy = { track, members, r }; });
}
function updateConvoy(c, dt) {
  let ahead = null, busy = false;
  for (const m of c.members) {
    if (m.off) continue;
    let want = m.end; if (ahead !== null) want = Math.min(want, ahead - GAP);
    if (want > m.s) {
      m.s = Math.min(want, m.s + CONVOY_V * dt);
      // (facing the way the line goes: they keep up with their place on it every step, so walking alone wouldn't turn them)
      const [ax, az] = trackAt(c.track, m.s - 0.15), [bx, bz] = trackAt(c.track, m.s + 0.15);
      if (Math.hypot((bx - ax) * K, bz - az) > 0.05) m.p.face(Math.atan2((bx - ax) * K, bz - az));
    }
    ahead = m.s;
    const [x, z] = trackAt(c.track, m.s);
    m.p.path = [[x * K, z]]; m.p.onArrive = null; m.p.speed = CONVOY_V * 1.8;
    if (m.s >= m.end - 1e-3) { if (m.exit) { m.off = true; m.exit(); } }
    else busy = true;
  }
  if (!busy) { const st = S.drunk; if (st?.convoy === c) st.convoy = null; c.r(); }
}

async function police(d) {
  if (S.drunk !== d || !d.drunk) return;
  d.phase = 'police';
  log('兩位警察騎車從外面過來，停在店外。'); sfx('siren');
  // in along the lane one behind the other, at its shop-side edge, and parked past the shop the same way
  d.bikes = [policeBike(0), policeBike(1)];
  d.bikes.forEach((b, i) => { setBike(b, BIKE_IN - i * BIKE_GAP, BIKE_Z, Math.PI / 2); ctx.scene.add(b.g); });
  await Promise.all(d.bikes.map((b, i) => driveTo(b, BIKE_W[i], BIKE_Z, true)));
  if (S.drunk !== d || !d.drunk) return;
  d.ownerPolicing = true; d.arrest = true;
  d.bikes.forEach(b => { b.rider.visible = false; b.park(true); });
  d.police = [makeOfficer('警察A', 0), makeOfficer('警察B', 1)];
  d.police.forEach((p, i) => { p.setPos(plan(BIKE_W[i]), MOUNT_Z); p.face(-Math.PI / 2); });

  // the arrest, laid out for the narrow front aisle (purple-wall seats on one side, the bar on the other, about 1.3 m
  // across): he's brought out to stand in the middle of the aisle, the officers come to stand one on either side of
  // him along it (the one from the door end straight in, the other round him on the bar side), and the owner waits at
  // the bar's front, on the far side from the door, so he can fall in at the back of the line when they walk him out
  if (d.drunk.seat) { releaseSeat(d.drunk); d.drunk.pose = 'stand'; d.drunk.act = null; d.seat = null; }
  d.drunk.path = []; d.drunk.onArrive = null;
  const drunk = d.drunk;
  const [dx0, dz0] = posOf(drunk), DZ = Math.min(2.2, Math.max(-0.1, dz0)), D = [HUBX, DZ];
  // (the owner over to the bar's front first, out of the way he'll take: across to it, then along it)
  const o = S.owner, OWN = [-0.55, DZ - 1.45];
  { const [ox, oz] = posOf(o); o.speed = 1.5; await walk(o, [[ox, oz], [-0.6, Math.min(3.3, Math.max(-1.5, oz))], OWN]); }
  if (S.drunk !== d || !drunk) return;
  if (metres(dx0, dz0, D[0], D[1]) > 0.05) { drunk.speed = 1.2; await walk(drunk, safePath([dx0, dz0], D)); }
  drunk.speed = 0; drunk.path = []; drunk.onArrive = null;
  if (S.drunk !== d || !drunk) return;
  o.face(Math.atan2((D[0] - OWN[0]) * K, D[1] - OWN[1])); o.say('警察來了，就是他。', 3);

  const [p1, p2] = d.police;
  const sayAtDrunk = (p, text) => { p.face(Math.atan2((D[0] - p.g.position.x / K) * K, D[1] - p.g.position.z)); p.say(text, 3); };
  // (quietly up the lane; each says his piece only once he's through the door, then goes on to his place)
  const enter = async (p, line, rest) => {
    p.speed = 1.6;
    await walk(p, [posOf(p), DOOR[0], DOOR[1], DOOR[2]]);
    if (S.drunk !== d) return;
    sayAtDrunk(p, line);
    await walk(p, [DOOR[2], DOOR[3], ...rest]);
  };
  const a1 = enter(p1, '那邊那位先生，別動！', [[HUBX, DZ + 0.95]]);
  await sleep(0.35); if (S.drunk !== d) return;
  const a2 = enter(p2, '先生，請配合一下。', [[-0.65, Math.min(3.3, DZ + 1.35)], [-0.65, DZ + 0.5], [-0.65, DZ - 0.5], [-1.05, DZ - 0.85], [HUBX, DZ - 0.95]]);
  await Promise.all([a1, a2]);
  if (S.drunk !== d) return;

  const [ax, az] = posOf(p1), [bx, bz] = posOf(p2), [dx2, dz2] = posOf(drunk);
  p1.face(Math.atan2((dx2 - ax) * K, dz2 - az)); p2.face(Math.atan2((dx2 - bx) * K, dz2 - bz)); drunk.face(Math.atan2((ax - dx2) * K, az - dz2));
  talk(d, ['我…我認識你們局長…', '你連我都不認識了，還認識局長？'], 1.2);
  await sleep(2.6); if (S.drunk !== d) return;
  p1.say('走，跟我們走。', 2.4); await sleep(1.0);
  if (S.drunk !== d) return;

  // out in single file: an officer in front, him, the other officer, and the owner seeing them out at the back
  d.escort = true;
  const track = escortTrack(posOf(drunk));
  // (everyone's already strung out along the aisle in the right order: each just steps on up it to their place in the
  // line, once whoever was there has moved on; the owner comes over from the bar's front to where he stood)
  const goTo = (p, s) => { const [x, z] = posOf(p), from = Math.min(s, Math.max(0, z - DZ)); return walk(p, [[x, z], ...trackSlice(track, from, s)]); };
  drunk.speed = 1.0; o.speed = 1.5; p1.speed = 1.5; p2.speed = 1.5;
  const lineUp = [walk(drunk, trackSlice(track, 0, 2 * GAP)), goTo(p1, 3 * GAP)];
  await sleep(0.9); if (S.drunk !== d) return;
  const b2 = goTo(p2, GAP); lineUp.push(b2);
  await b2; if (S.drunk !== d) return;
  lineUp.push(goTo(o, 0));
  await Promise.all(lineUp);
  if (S.drunk !== d) return;
  p1.say('走這邊。', 2.0);
  sleep(3.2).then(() => { if (S.drunk === d && d.drunk === drunk) talk(d, ['我的酒…還沒喝完…', '酒我幫你收著，清醒了再來。']); });
  await convoy(d, track, [
    { p: p1, s: 3 * GAP, end: track.len },
    { p: drunk, s: 2 * GAP, end: track.len - GAP },
    { p: p2, s: GAP, end: track.len - 2 * GAP },
    // the owner as far as the camping chair, where he stops and watches them go on
    { p: o, s: 0, end: Math.min(track.ownerS, track.len - 3 * GAP), exit: () => {
      walk(o, [posOf(o), OWNER_SPOT]).then(() => { if (S.drunk !== d) return; o.face(Math.PI / 2); o.say('警察先生，辛苦了！', 2.6); });
    } },
  ]);
  if (S.drunk !== d) return;

  // at the crossroads he's gone, and the officers straight back to their bikes and off
  log('警察把醉漢帶到路口，醉漢被帶走了。');
  const gone = drunk; d.drunk = null; d.escort = false; gone.remove();
  releaseCrowd();
  void (async () => {
    await sleep(0.6); if (S.drunk !== d) return;
    o.say('好了，沒事了，大家繼續～', 2.6);
    const [ex, ez] = posOf(o); o.speed = 1.6;
    await walk(o, safePath([ex, ez], [LANE, 0.3]));
    if (S.drunk !== d || d.ownerResumed) return;
    d.ownerResumed = true; resumeOwner();
  })();
  // (the one at the back is nearer the bikes: he takes the front one and is off first)
  const ride = async (p, b, i) => {
    p.speed = 1.7;
    await walk(p, [posOf(p), [plan(BIKE_W[i]), MOUNT_Z]]);
    if (S.drunk !== d) return;
    p.remove(); b.rider.visible = true; b.park(false);
    await driveTo(b, RIDE_W - i * BIKE_GAP, BIKE_Z);
  };
  p2.say('好，收工。', 1.6);
  await Promise.all([ride(p2, d.bikes[0], 0), ride(p1, d.bikes[1], 1)]);
  if (S.drunk !== d) return;
  disposeDrunk();
}

async function run(d) {
  scareEveryone(d); // whole shop panics on appearance
  const o = S.owner; interruptOwner(); o.hunting = d.drunk; o.status = '盯著醉漢'; o.speed = 1.8;
  const drunk = d.drunk;
  // enter through door like existing path
  let zone = DOOR.slice(1);
  await walk(drunk, zone);
  if (S.drunk !== d || !drunk) return;
  talk(d, nextLine(d)); log('醉漢搖搖晃晃走進店裡。');
  // sit at random seats like normal customers, 3s each then move
  for (let i = 0; i < 5 && S.drunk === d && drunk; i++) {
    const seat = freeDrunkSeat(d);
    if (seat) {
      await walk(drunk, route(zone, seat.path));
      if (S.drunk !== d || !drunk) return;
      if (seat.occ && seat.occ !== drunk) { zone = seat.path; await sleep(0.4, drunk); continue; }
      seat.occ = drunk; d.seat = seat; drunk.seat = seat; drunk.pose = 'sit'; drunk.face(seat.face || 0);
      drunk.status = '醉醺醺坐著'; drunk.gesture('drunkSit', 3.0); talk(d, nextLine(d, SIT_BANTER));
      await sleep(3, drunk);
      if (S.drunk !== d || !drunk) return;
      releaseSeat(drunk); d.seat = null; drunk.pose = 'stand'; drunk.act = null; drunk.status = '醉醺醺';
      zone = seat.path;
    } else {
      const n = nodeAt(nearestNode(HUBX, 1.0));
      await walk(drunk, navPath(drunk.g.position.x / K, drunk.g.position.z, n.x, n.z));
      if (S.drunk !== d || !drunk) return;
      drunk.gesture('drunk', 2.0); talk(d, nextLine(d)); await sleep(2, drunk);
      zone = [[n.x, n.z], [HUBX, n.z]];
    }
    if (S.drunk !== d || !drunk) return;
  }
  talk(d, ['我不走！我還要喝！', '好，我叫警察來。']);
  await sleep(2.2);
  if (S.drunk !== d || !drunk) return;
  await police(d);
}

export function releaseDrunk() {
  if (S.stopped) return '還沒營業。';
  if (S.drunk) return '店裡已經有醉漢了…';
  if (S.roach) return '蟑螂事件處理中…';
  if (S.closing) return '快打烊了，改天再來。';
  const drunk = makeDrunk();
  drunk.setPos(DOOR[0][0], DOOR[0][1]); drunk.face(Math.PI);
  const d = { drunk, phase: 'wander', t: 0, mumble: 6, seat: null, police: [], bikes: [], convoy: null, escort: false, arrest: false, ownerPolicing: false, ownerResumed: false };
  S.drunk = d;
  log('一個醉漢出現在店外…');
  void run(d).catch(err => { console.error(err); if (S.drunk === d) disposeDrunk(); });
  return d;
}

export function disposeDrunk() {
  const d = S.drunk; if (!d) return;
  S.drunk = null;
  if (d.convoy) { d.convoy.r(); d.convoy = null; }
  d.bikes.forEach(b => { if (b.drive) { const q = b.drive; b.drive = null; q.r(); } });
  S.customers.slice().forEach(c => { if (c.frozen?.by === 'drunk' && !c.frozen.home) goBack(c); });
  if (d.drunk && !d.drunk.gone) { releaseSeat(d.drunk); d.drunk.remove(); }
  d.police.forEach(p => { if (!p.gone) p.remove(); });
  d.bikes.forEach(b => { ctx.scene.remove(b.g); b.dispose(); });
  if (!d.ownerResumed && !S.stopped && S.owner?.hunting) resumeOwner();
}
