import * as THREE from 'three';
import { ctx, mat } from './engine.js';
import { S, sleep } from './state.js';
import { K, pick, rand } from './util.js';
import { Person, walk, walkNow } from './people.js';
import { L } from './profiles.js';
import { log, floatText } from './feed.js';
import { interruptOwner, resumeOwner } from './sim.js';
import { navPath, nearestNode, spread, nodeAt, nodeCount, wayTo } from './nav.js';
import { DOOR, HUBX, LANE, KERB, RISE } from './layout.js';
import { riderModel } from './world/surroundings.js';
import { sfx } from './sfx.js';
import { closeGame } from './games.js';
import { closeCard } from './hud.js';

const PARK_X = [-7.5, -5.0], PARK_Z = 10.8, ALLEY_X = -14, ALLEY_Z = 11.0, RIDE_X = 24;
const STOP_X = 11.6 / K, STOP_Z = 12;
const SHOP_X0 = -3.1, SHOP_X1 = 3.1, SHOP_Z0 = -4.4, SHOP_Z1 = 9.2;
const RESPOT = 4;
const MUMBLES = ['嗝……老闆，再來一杯……', '我明明只喝了一杯啊……嗝～', '這咖啡怎麼會走來走去……', '你誰啊？喔，是店長啦。', '我跟你說，我認識市長……嗝。', '是世界在轉，還是我坐在轉盤上？', '嗝～你們排隊嗎？'];
const FEAR = ['醉漢！離我遠一點……', '他身上都是酒味……', '他又要唱歌了，我先躲開……', '哎呀，小心他撞過來……'];
const NAGS = ['先生，這裡不能喝酒鬧事，請你離開。', '你已經影響到客人了，出去好不好？', '我再說一次，請你出去。', '好，我叫警察來。'];
const bottleM = mat(0x6d8f42, { roughness: 0.35 }), capM = mat(0xc8a24a, { roughness: 0.5 });
const panelM = mat(0xeef2f7, { roughness: 0.35 }), stripeM = mat(0x173b73, { roughness: 0.4 });
const glassM = mat(0x9dc8e8, { transparent: true, opacity: 0.45 }), lampM = mat(0xfff3d2, { emissive: new THREE.Color(0xfff0c8), emissiveIntensity: 0.6 });
const redM = new THREE.MeshBasicMaterial({ color: 0xff4f7b }), blueM = new THREE.MeshBasicMaterial({ color: 0x8de2ff });

const posOf = p => [p.g.position.x / K, p.g.position.z];
const metres = (ax, az, bx, bz) => Math.hypot((ax - bx) * K, az - bz);

function disposeParts(root) {
  const seen = new Set();
  root.traverse(o => { if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); } });
}

function makeBottle() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.18, 10), bottleM);
  body.position.y = 0.09;
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.09, 8), bottleM);
  neck.position.y = 0.22;
  g.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 8), capM);
  cap.position.y = 0.28;
  g.add(cap);
  g.position.set(0, -0.05, 0.02);
  g.rotation.set(0.45, 0, 0.18);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function makeBike() {
  const v = riderModel({ body: 0x223a63, shirt: 0x244a8a, helmet: 0x101820, face: 0xd9a77e });
  const box = (w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    v.g.add(mesh);
    return mesh;
  };
  box(0.38, 0.34, 0.12, panelM, 0, 0.74, 0.5);
  box(0.42, 0.32, 0.02, glassM, 0, 1.04, 0.55).rotation.x = -0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), lampM);
  head.position.set(0, 0.79, 0.61);
  v.g.add(head);
  [-1, 1].forEach(s => {
    box(0.05, 0.2, 0.5, panelM, s * 0.19, 0.56, -0.12);
    box(0.055, 0.055, 0.38, stripeM, s * 0.22, 0.56, -0.12);
    box(0.08, 0.04, 0.11, stripeM, s * 0.3, 1.02, 0.45);
  });
  box(0.42, 0.34, 0.3, panelM, 0, 0.84, -0.62);
  box(0.44, 0.07, 0.32, stripeM, 0, 0.71, -0.62);
  box(0.38, 0.06, 0.14, panelM, 0, 1.02, -0.62);
  const red = box(0.13, 0.08, 0.1, redM, 0.1, 1.07, -0.63);
  const blue = box(0.13, 0.08, 0.1, blueM, -0.1, 1.07, -0.63);
  v.g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { g: v.g, rider: v.rider, red, blue, blink: 0 };
}

function setBike(b, x, z, face) {
  b.g.position.set(x * K, z > KERB ? -RISE : 0, z);
  b.g.rotation.y = face;
}

function startDrive(d, targets) {
  return new Promise(resolve => {
    d.drive = {
      points: targets.map(([x, z]) => [x * K, z]),
      resolve,
      bikes: d.bikes.map((_, i) => ({ i: 0, speed: 0, wait: i * 0.25 })),
    };
  });
}

function updateDrive(d, dt) {
  const drive = d.drive;
  if (!drive) return;
  let done = true;
  d.bikes.forEach((b, i) => {
    const q = drive.bikes[i], p = b.g.position, target = drive.points[i];
    if (!target) return;
    if (q.wait > 0) { q.wait -= dt; done = false; return; }
    q.speed += (5.2 - q.speed) * Math.min(1, dt * 1.5);
    const dx = target[0] - p.x, dz = target[1] - p.z, dist = Math.hypot(dx, dz), step = q.speed * dt;
    if (dist <= step || dist < 0.01) { p.x = target[0]; p.z = target[1]; }
    else { p.x += dx / dist * step; p.z += dz / dist * step; }
    p.y = p.z > KERB ? -RISE : 0;
    if (p.x !== target[0] || p.z !== target[1]) done = false;
  });
  if (done) { const resolve = drive.resolve; d.drive = null; resolve(); }
}

function makeDrunk() {
  const p = new Person({
    name: '醉漢', regular: false,
    look: L(0xdba982, 0x241910, 'short', 0x6b5844, 0x33323a, { body: 'male', height: 'short', bottom: 'pants', topStyle: 'tee', topPattern: 'none' }),
  }, 'drunk');
  p.tag.className = 'tag drunk';
  p.tag.querySelector('i').textContent = '醉漢';
  p.speed = 1.05;
  p.status = '醉醺醺';
  const bottle = makeBottle();
  p.hand.add(bottle);
  p.bottle = bottle;
  return p;
}

function makeOfficer(name) {
  const p = new Person({
    name, regular: false,
    look: L(0xd9a77e, 0x15120f, 'short', 0x244a8a, 0x202632, { body: 'male', height: 'regular', bottom: 'pants', topStyle: 'jacket', topPattern: 'none' }),
  }, 'police');
  p.tag.className = 'tag police';
  p.tag.querySelector('i').textContent = '警察';
  p.speed = 1.7;
  return p;
}

const zoneOf = z => (z > -4.4 && z < 4.4 ? 'in' : z >= 4.4 && z < 9.2 ? 'porch' : null);
const inShop = (x, z) => x >= SHOP_X0 && x <= SHOP_X1 && z >= SHOP_Z0 && z < SHOP_Z1;
const onSeat = n => S.seats.seats.some(t => (t.type === 'table' || t.type === 'game') && metres(t.x, t.z, n.x, n.z) < 0.35);
function standNear(x, z, dx, dz) {
  const candidates = [];
  for (let i = 0; i < nodeCount(); i++) {
    const n = nodeAt(i);
    if (S.seats.seats.some(t => t.sitY !== undefined && metres(t.x, t.z, n.x, n.z) < 0.35)) continue;
    const m = metres(n.x, n.z, dx, dz);
    if (m < 1.0 || m > 2.4) continue;
    candidates.push({ i, score: Math.abs(m - 1.25) + metres(x, z, n.x, n.z) * 0.15 });
  }
  candidates.sort((a, b) => a.score - b.score);
  for (const { i } of candidates) {
    const n = nodeAt(i), pts = navPath(x, z, n.x, n.z);
    if (!pts.some(([px, pz]) => metres(px, pz, dx, dz) < 0.85)) return { n, pts };
  }
  const fallback = candidates[0]?.i ?? nearestNode(dx, dz);
  const n = nodeAt(fallback);
  return { n, pts: navPath(x, z, n.x, n.z) };
}

function pickSpots(dx, dz, ox, oz) {
  const gather = minOwner => {
    const list = [];
    for (let i = 0; i < nodeCount(); i++) {
      const n = nodeAt(i);
      if (onSeat(n)) continue;
      const m = metres(n.x, n.z, dx, dz);
      if (m < 1.3 || m > 2.8 || metres(n.x, n.z, ox, oz) < minOwner) continue;
      list.push({ n, score: Math.abs(m - 1.6) + metres(ox, oz, n.x, n.z) * 0.1 });
    }
    return list.sort((a, b) => a.score - b.score);
  };
  let pool = gather(1.5);
  if (pool.length < 2) pool = gather(1.1);
  if (pool.length < 2) pool = gather(0.8);
  if (pool.length < 2) pool = gather(0);
  if (pool.length < 2) {
    for (let i = 0; i < nodeCount() && pool.length < 2; i++) {
      const n = nodeAt(i);
      if (!onSeat(n)) pool.push({ n, score: metres(n.x, n.z, dx, dz) });
    }
  }
  const chosen = [];
  for (const { n } of pool) {
      if (chosen.every(s => metres(n.x, n.z, s.x, s.z) > 1.6)) chosen.push(n);
      if (chosen.length === 2) break;
    }
    const base = chosen[0] ?? nodeAt(nearestNode(dx, dz));
    while (chosen.length < 2) chosen.push({ x: base.x + (chosen.length ? -1.1 : 1.1), z: base.z });
    return chosen;
  }

  function pushApart(person, other, minDist) {
    const ax = person.g.position.x, az = person.g.position.z;
    const bx = other.g.position.x, bz = other.g.position.z;
    const dx = ax - bx, dz = az - bz, m = Math.hypot(dx, dz);
    if (m >= minDist) return;
    const push = minDist - m + 0.03;
    const nx = m ? dx / m : 1, nz = m ? dz / m : 0;
    person.g.position.x += nx * push;
    person.g.position.z += nz * push;
  }

  function redirect(person, pts) {
    walkNow(person, pts, person.onArrive || (() => {}));
  }

  function offsetPath(fromX, fromZ, to, side) {
    const pts = navPath(fromX, fromZ, to.x, to.z);
    return pts.map(([x, z], i) => (i === pts.length - 1 ? [x, z] : [x, z + side]));
  }

  function yieldFromCrowd(d) {
    if (d.t - d.crowd < 0.4) return;
    const [dx, dz] = posOf(d.drunk);
    const crowd = S.customers.filter(c => {
      if (c.gone || !c.frozen || c.frozen.by !== 'drunk') return false;
      const [cx, cz] = posOf(c);
      return metres(dx, dz, cx, cz) < 1.5;
    });
    if (!crowd.length) return;
    d.crowd = d.t;
    let best = null;
    for (let i = 0; i < nodeCount(); i++) {
      const n = nodeAt(i);
      if (crowd.some(c => metres(n.x, n.z, ...posOf(c)) < 1.8)) continue;
      const score = metres(dx, dz, n.x, n.z);
      if (score < 0.8 || score > 3.0 || (best && score >= best.score)) continue;
      const pts = navPath(dx, dz, n.x, n.z);
      if (pts.some(([x, z]) => crowd.some(c => metres(x, z, ...posOf(c)) < 1.4))) continue;
      best = { pts, score };
    }
    if (best) {
      redirect(d.drunk, best.pts);
      return;
    }
    let fallback = null, score = Infinity;
    for (let i = 0; i < nodeCount(); i++) {
      const n = nodeAt(i);
      if (crowd.some(c => metres(n.x, n.z, ...posOf(c)) < 1.8)) continue;
      const s = metres(dx, dz, n.x, n.z);
      if (s < score) { score = s; fallback = n; }
    }
    if (fallback) redirect(d.drunk, navPath(dx, dz, fallback.x, fallback.z));
  }

  function separatePolice(d) {
    if (d.phase !== 'police' || d.police?.length !== 2 || d.t - d.sepCool < 0.6) return;
    const [p1, p2] = d.police;
    const [aX, aZ] = posOf(p1), [bX, bZ] = posOf(p2);
    if (metres(aX, aZ, bX, bZ) >= 1.4) return;
    d.sepCool = d.t;
    const side = bZ >= aZ ? 1 : -1;
    if (p1.path.length) p1.path = p1.path.map(([x, z]) => [x, z - side * 0.3]);
    if (p2.path.length) {
      p2.path = p2.path.map(([x, z]) => [x, z + side * 0.6]);
      return;
    }
    const n = nodeAt(nearestNode(bX, bZ + side * 1.2));
    if (metres(bX, bZ, n.x, n.z) < 0.35) return;
    redirect(p2, offsetPath(bX, bZ, n, side * 0.2));
  }


function turnBackOne(c) {
  if (c.gone || S.toiletUser === c) return;
  freeze(c, S.drunk);
  c.frozen.away = false;
  c.fromLane = false;
  if (c.spot) { c.spot.occ = null; c.spot = null; }
  c.status = '轉身離開';
  c.say('店裡好像出事了……我先不進去了。', 2.6);
  const [x, z] = posOf(c);
  const side = x >= 0 ? 16 : -16;
  walkNow(c, [[x, z], [side, 10.55]], () => {
    const i = S.customers.indexOf(c);
    if (i >= 0) S.customers.splice(i, 1);
    if (c === S.selected || S.selected?.owner === c) closeCard();
    c.remove();
  });
}

function turnBackComers() {
  S.customers.slice().forEach(c => {
    if (c.gone || c.frozen || S.toiletUser === c || !c.fromLane) return;
    turnBackOne(c);
  });
}

function scareAll(d) {
  S.customers.slice().forEach(c => {
    if (c.gone || c.frozen || S.toiletUser === c || !inShop(...posOf(c))) return;
    scare(d, c);
  });
}

function pickSeat(d) {
  return [...S.seats.tableSeats, ...S.seats.specSpots]
    .filter(s => !s.occ && s.path && s.sitY !== undefined && !d.used.has(s))
    .sort(() => rand(-1, 1))[0];
}

function freeze(c, d) {
  if (c.frozen) return;
  if (c.seat?.occ === c) c.seat.occ = null;
  c.seat = null;
  c.frozen = { by: 'drunk', x: c.g.position.x / K, z: c.g.position.z, heading: c.targetHeading, pose: c.pose, status: c.status, path: c.path, onArrive: c.onArrive, resume: null, away: false, cool: 0 };
  c.path = [];
  c.onArrive = null;
  if (c.pose !== 'stand') c.pose = 'stand';
  c.status = '躲醉漢';
}

function hideSpot(c, d) {
  const taken = d.taken;
  taken.delete(c);
  const [ox, oz] = posOf(S.owner);
  const [cx, cz] = posOf(c), [dx, dz] = posOf(d.drunk), zone = zoneOf(cz);
  const from = nearestNode(cx, cz), { d: dist, prev } = spread(from);
  let best = -1, bs = Infinity;
  for (let i = 0; i < nodeCount(); i++) {
    const n = nodeAt(i), m = metres(n.x, n.z, dx, dz);
    if (dist[i] === Infinity || m < 1.8 || m > 3.0 || zoneOf(n.z) !== zone) continue;
    if (zone === 'in' && n.x > 1.0) continue;
    if (n.z < -4.3) continue;
    if (onSeat(n)) continue;
    if ([...taken.values()].some(([x, z]) => metres(x, z, n.x, n.z) < 0.5)) continue;
    if (S.customers.some(o => o !== c && !o.frozen && metres(...posOf(o), n.x, n.z) < 0.5)) continue;
    const score = dist[i] + (m < 2 ? 0.5 : 0) + (metres(n.x, n.z, ox, oz) < 1 ? 1.5 : 0);
    if (score < bs) { bs = score; best = i; }
  }
    c.frozen.away = true;
    if (best < 0) { c.face(Math.atan2((dx - cx) * K, dz - cz)); return false; }
    const n = nodeAt(best);
    taken.set(c, [n.x, n.z]);
    c.speed = 2;
    walkNow(c, [[cx, cz], ...wayTo(prev, best)], () => { c.speed = 1.4; c.face(Math.atan2((dx - n.x) * K, dz - n.z)); });
    return true;
  }

  function safeNode(c, dx, dz, minDist) {
    let best = null, score = Infinity;
    for (let i = 0; i < nodeCount(); i++) {
      const n = nodeAt(i);
      if (onSeat(n) || metres(n.x, n.z, dx, dz) < minDist) continue;
      const crowd = S.customers.some(o => o !== c && !o.gone && metres(...posOf(o), n.x, n.z) < 0.7) ? 2 : 0;
      const s = metres(...posOf(c), n.x, n.z) + crowd;
      if (s < score) { score = s; best = n; }
    }
    return best;
  }


function goBack(c) {
  const f = c.frozen;
  if (!f || f.by !== 'drunk') return;
  const [cx, cz] = posOf(c);
  c.speed = 1.4;
  walkNow(c, navPath(cx, cz, f.x, f.z), () => {
    c.frozen = null;
    c.targetHeading = f.heading;
    c.pose = f.pose;
    c.status = f.status;
    if (f.resume) walkNow(c, f.resume.pts, f.resume.r);
    else if (f.path.length) { c.path = f.path; c.onArrive = f.onArrive; }
    else f.onArrive?.();
  });
}

function scare(d, c) {
  const [x, z] = posOf(c);
  freeze(c, d);
  c.say(pick(FEAR), 2.4);
  c.gesture('cheer', 0.7);
  floatText('bang', '！', new THREE.Vector3(x, 2.1, z), 1.1);
  hideSpot(c, d);
  closeGame();
}

  function keepClear(d, dt) {
    const [ox, oz] = posOf(S.owner);
    const [dx, dz] = posOf(d.drunk);
    for (const c of S.customers) {
      if (c.gone || S.toiletUser === c) continue;
      const [cx, cz] = posOf(c), m = metres(cx, cz, dx, dz);
      if (!c.frozen) {
        if (!inShop(cx, cz) || d.t - (d.rolled.get(c) ?? -99) < RESPOT) continue;
        d.rolled.set(c, d.t);
        if (c.fromLane || zoneOf(cz) === null) turnBackOne(c);
        else scare(d, c);
        continue;
      }
      const f = c.frozen;
      if (f.by !== 'drunk' || !f.away || c.gone) continue;
      if (m < 0.9) {
        f.cool = 0;
        c.path = [];
        c.onArrive = null;
        c.say(pick(FEAR), 1.8);
        c.gesture('cheer', 0.6);
        if (!hideSpot(c, d)) {
          const n = safeNode(c, dx, dz, 1.7);
          if (n) {
            c.setPos(n.x, n.z);
            c.face(Math.atan2((dx - n.x) * K, dz - n.z));
          }
        }
        continue;
      }
      if (c.path.length || (f.cool = (f.cool || 0) - dt) > 0) continue;
      if (m < 1.5 || metres(ox, oz, cx, cz) < 0.8) {
        f.cool = 1.5;
        if (c.fromLane || zoneOf(cz) === null) turnBackOne(c);
        else { c.say(pick(FEAR), 1.8); c.gesture('cheer', 0.6); hideSpot(c, d); }
      }
    }
  }


export function updateDrunk(dt) {
  const d = S.drunk;
  if (!d) return;
  d.t += dt;
  updateDrive(d, dt);
  d.bikes.forEach(b => {
    b.blink += dt;
    const on = Math.sin(b.blink * 10) > 0;
    b.red.visible = on;
    b.blue.visible = !on;
  });
  if (!d.drunk) return;
  for (const c of S.customers) {
    if (!c.gone && c.frozen?.by === 'drunk') {
      if (d.phase === 'police' || d.phase === 'leaving') pushApart(c, d.drunk, 1.1);
      else pushApart(d.drunk, c, 1.1);
    }
  }
  if (S.owner && !S.owner.gone && (d.phase !== 'police' || !S.owner.path.length)) pushApart(S.owner, d.drunk, 1.0);
  if (d.phase === 'police') separatePolice(d);
  if (d.phase === 'police' || d.phase === 'leaving') return;

    d.check += dt;

  if (d.check < 0.35) return;
  const step = d.check;
  d.check = 0;
    keepClear(d, step);
    yieldFromCrowd(d);
    const o = S.owner;

  if (o?.hunting !== d.drunk || o.gone) return;
  const [dx, dz] = posOf(d.drunk), [ox, oz] = posOf(o);
  const m = metres(ox, oz, dx, dz);
  const face = () => o.face(Math.atan2((dx - o.g.position.x / K) * K, dz - o.g.position.z));
  face();
    if (m < 0.8) {
      d.avoid = d.t;
      const vx = m ? (ox - dx) / m : 1;
      const vz = m ? (oz - dz) / m : 0;
      const n = nodeAt(nearestNode(dx + vx * 1.5, dz + vz * 1.5));
      redirect(o, navPath(ox, oz, n.x, n.z));
      return;
    }
    if (m < 1.15 && d.t - d.avoid > 1.2) {
      d.avoid = d.t;
      const { pts } = standNear(ox, oz, dx, dz);
      if (pts.length) redirect(o, pts);
      return;
    }


  if (o.path.length) return;
  if (m >= 1.1 && m <= 2.2) return;
  d.nag += step;
  if (d.nag < 1.6) return;
  d.nag = 0;
  if (d.t - d.avoid < 1.2) return;
  d.avoid = d.t;
  const { n, pts } = standNear(ox, oz, dx, dz);
  if (metres(ox, oz, n.x, n.z) < 0.35) return;
  walk(o, pts).then(face);
}

async function police(d) {
  if (S.drunk !== d) return;
  d.phase = 'police';
  log('兩名警察騎機車從巷口過來，停在店外的街道上。');
  sfx('siren');
  d.bikes = [makeBike(), makeBike()];
  d.bikes.forEach((b, i) => {
    setBike(b, ALLEY_X - i * 1.2, ALLEY_Z + i * 0.55, Math.PI / 2);
    ctx.scene.add(b.g);
  });
  await startDrive(d, [[PARK_X[0], PARK_Z], [PARK_X[1], PARK_Z]]);
  if (S.drunk !== d) return;
  d.bikes.forEach(b => { b.rider.visible = false; });
  d.police = [makeOfficer('警察甲'), makeOfficer('警察乙')];
  d.police.forEach((p, i) => {
    p.setPos(PARK_X[i] + (i ? 0.35 : -0.35), PARK_Z + 0.4);
    p.face(Math.PI / 2);
  });
  if (d.seat) { d.seat.occ = null; d.seat = null; }
  d.drunk.act = null;
  d.drunk.pose = 'stand';
  d.drunk.seat = null;
  await sleep(0.4);
  if (S.drunk !== d) return;
    const p1 = d.police[0], p2 = d.police[1];
    const [wakeX, wakeZ] = posOf(S.owner);
    await walk(S.owner, navPath(wakeX, wakeZ, LANE, 1.0));
    if (S.drunk !== d) return;
    const [wdx, wdz] = posOf(d.drunk);
    S.owner.face(Math.atan2((wdx - S.owner.g.position.x / K) * K, wdz - S.owner.g.position.z));
    S.owner.say('啊，警察來了。就是他。', 3);
    p1.say('裡面的醉漢，出來！', 3);
    p2.say('先生，請配合一下。', 2.8);

    const entry = [[-1.75, 10.55], ...DOOR.slice(1), [HUBX, 2.6]];
    const entryFor = i => {
      const side = i ? 0.45 : -0.45;
      return [[PARK_X[i], 10.55 + side], ...entry.map(([x, z], j) => (j === 0 || j === entry.length - 1 ? [x, z] : [x, z + side]))];
    };
    await Promise.all([
      walk(p1, entryFor(0)),
      (async () => { await sleep(1.2); if (S.drunk === d) await walk(p2, entryFor(1)); })(),
    ]);

  if (S.drunk !== d) return;
  const [dx, dz] = posOf(d.drunk), [ox, oz] = posOf(S.owner);
  const [s1, s2] = pickSpots(dx, dz, ox, oz);
  const [px, pz] = posOf(p1), [qx, qz] = posOf(p2);
    await Promise.all([
      walk(p1, offsetPath(px, pz, s1, -0.4)),
      (async () => { await sleep(0.9); if (S.drunk === d) await walk(p2, offsetPath(qx, qz, s2, 0.4)); })(),
    ]);

  if (S.drunk !== d) return;
  const [ax, az] = posOf(p1), [bx, bz] = posOf(p2);
  p1.face(Math.atan2((dx - ax) * K, dz - az));
  p2.face(Math.atan2((dx - bx) * K, dz - bz));
  if (S.drunk !== d) return;
  d.drunk.say('我……我認識你們長官……嗝～', 3.2);
  p1.say('少來，跟我們走。', 2.6);
  await sleep(0.8);
  if (S.drunk !== d) return;
  const centre = [...DOOR.slice(1).reverse(), [-1.75, 11], [4, 11.2], [10, 11.7], [STOP_X, STOP_Z]];
  const exit = i => {
      const side = i ? 0.4 : -0.4;
      return [...DOOR.slice(1).reverse().map(([x, z]) => [x, z + side]), [-1.75, 11 + side], [4, 11.2 + side], [10, 11.7], [STOP_X + (i ? 1.1 : -1.1), STOP_Z + (i ? 0.1 : -0.1)]];

  };
  d.drunk.speed = 1.5;
  p1.speed = 1.5;
  p2.speed = 1.5;
  await Promise.all([
    walk(d.drunk, [...navPath(dx, dz, s1.x, s1.z), ...centre]),
      (async () => { await sleep(0.9); if (S.drunk === d) await walk(p1, [...offsetPath(ax, az, s1, -0.4), ...exit(0)]); })(),
      walk(p2, [...offsetPath(bx, bz, s2, 0.4), ...exit(1)]),

  ]);
  if (S.drunk !== d) return;
  d.drunk.say('我的咖啡……還沒喝完啊……', 2.8);
  p2.say('好了，帶走。', 2.6);
  await sleep(1.2);
  if (S.drunk !== d) return;
  log('警察把醉漢帶出巷口，醉漢被帶走了。');
  const gone = d.drunk;
  d.drunk = null;
  gone.remove();
  const [ex, ez] = posOf(S.owner);
  await walk(S.owner, navPath(ex, ez, LANE, 0.3));
  if (S.drunk !== d) return;
  d.ownerResumed = true;
  resumeOwner();
  const back = i => {
      const side = i ? 0.4 : -0.4;
      return [[10, 11.7], [4, 11.2 + side], [-1.75, 10.55 + side]];

  };
  await Promise.all([
    walk(p1, [...back(0), [PARK_X[0], PARK_Z + 0.4]]),
    walk(p2, [...back(1), [PARK_X[1] + 0.5, PARK_Z + 0.4]]),
  ]);
  if (S.drunk !== d) return;
  d.police.forEach(p => p.remove());
  d.police = [];
  d.bikes.forEach(b => { b.rider.visible = true; });
  await startDrive(d, [[RIDE_X, PARK_Z], [RIDE_X, PARK_Z]]);
  if (S.drunk !== d) return;
  disposeDrunk();
}

async function run(d) {
  await walk(d.drunk, DOOR.slice(1));
  if (S.drunk !== d) return;
  scareAll(d);
  d.drunk.say(pick(MUMBLES), 3.2);
  log('醉漢搖搖晃晃地進了店裡。');
  const o = S.owner;
  o.hunting = d.drunk;
  interruptOwner();
  o.status = '過去處理醉漢';
  o.speed = 2.4;
  await sleep(0.35);
  if (S.drunk !== d) return;
  interruptOwner();
  const [dx, dz] = posOf(d.drunk), [ox, oz] = posOf(o);
  const { pts } = standNear(ox, oz, dx, dz);
  await walk(o, pts);
  if (S.drunk !== d) return;
  o.face(Math.atan2((dx - o.g.position.x / K) * K, dz - o.g.position.z));
  o.status = '勸醉漢離開';
  o.speed = 1.5;
  d.avoid = d.t;
  o.say(pick(NAGS), 3.2);
  log(`${o.p.name}放下手邊的工作，過去請醉漢離開……`);
  for (let i = 0; i < 3; i++) {
    const seat = pickSeat(d);
    if (seat) {
      const [x, z] = posOf(d.drunk);
      await walk(d.drunk, navPath(x, z, seat.x, seat.z));
      if (S.drunk !== d) return;
      d.used.add(seat);
      d.seat = seat;
      seat.occ = d.drunk;
      d.drunk.pose = 'sit';
      d.drunk.seat = seat;
      d.drunk.face(seat.face || 0);
      d.drunk.gesture('drunkSit', 5.2);
      d.drunk.say(pick(MUMBLES), 4.6);
      await sleep(5, d.drunk);
      if (S.drunk !== d) return;
      d.drunk.act = null;
      d.drunk.pose = 'stand';
      d.drunk.seat = null;
      seat.occ = null;
      d.seat = null;
    } else {
      const [x, z] = posOf(d.drunk);
      await walk(d.drunk, navPath(x, z, rand(-1.2, 0.8), rand(-2, 2.5)));
      if (S.drunk !== d) return;
      d.drunk.gesture('drunk', 4.5);
      d.drunk.say(pick(MUMBLES), 4);
      await sleep(5, d.drunk);
    }
    if (S.drunk !== d) return;
    o.say(pick(NAGS), 2.8);
    await sleep(0.8, o);
    if (S.drunk !== d) return;
  }
  await police(d);
}

export function releaseDrunk() {
  if (S.stopped) return '店還沒開。';
  if (S.drunk) return '店裡已經有醉漢在鬧了……';
  if (S.roach) return '先等蟑螂處理完再說……';
  if (S.closing) return '店要打烊了，改天再來。';
  const drunk = makeDrunk();
  drunk.setPos(DOOR[0][0], DOOR[0][1]);
  drunk.face(Math.PI);
  const d = { drunk, bottle: drunk.bottle, huntTarget: drunk, phase: 'enter', t: 0, check: 0, nag: 0, avoid: -99, crowd: -99, sepCool: -99, drive: null, rolled: new Map(), taken: new Map(), used: new Set(), seat: null, police: [], bikes: [], ownerResumed: false };
  S.drunk = d;
  turnBackComers();
  log('一個醉漢出現在店門外……');
  void run(d).catch(err => { console.error(err); if (S.drunk === d) disposeDrunk(); });
  return d;
}

export function disposeDrunk() {
  const d = S.drunk;
  if (!d) return;
  S.drunk = null;
  if (d.drive) { d.drive.resolve(); d.drive = null; }
  S.customers.slice().forEach(c => { if (c.frozen?.by === 'drunk') goBack(c); });
  if (d.drunk && !d.drunk.gone) d.drunk.remove();
  d.police.forEach(p => { if (!p.gone) p.remove(); });
  d.bikes.forEach(b => {
    ctx.scene.remove(b.g);
    disposeParts(b.g);
  });
  if (d.bottle) disposeParts(d.bottle);
  if (!d.ownerResumed && !S.stopped && S.owner?.hunting === d.huntTarget) resumeOwner();
}
