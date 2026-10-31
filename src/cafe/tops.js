// Spinning tops: now and then two regulars who play fetch the stadium from the back, set it on the street-side crates
// in the middle of the outdoor area (the arcade), count down "3, 2, 1, Go Shoot!" and battle until one top falls over.
import * as THREE from 'three';
import { ctx, mat } from './engine.js';
import { S, sleep } from './state.js';
import { rand, K } from './util.js';
import { HUBX, STRIP, route } from './layout.js';
import { walk } from './people.js';
import { log } from './feed.js';

const TABLE = { x: -1.0, z: STRIP.at(STRIP.crates[0]), y: 0.6 };   // on the street-side crates
const PORCH = [[-1.6, 4.5], [HUBX, 3.6]];
// where the two players stand, either side of the crates (paths run spot -> hub, like every seat's)
const SPOTS = [
  { path: [[-1.62, TABLE.z], [-1.75, 4.75]].concat(PORCH), face: Math.PI / 2 },
  { path: [[-0.4, TABLE.z], [-0.45, 4.7]].concat(PORCH), face: -Math.PI / 2 },
];
// the stadium lives on the shelves in the back
const FETCH = [[1.0, -5.5], [-0.3, -5.5], [-2.0, -5.5], [-2.0, -3.95], [HUBX, -3.6]];
const TOP_COLS = [[0xc0282d, 0xffd23f], [0x1c4fd6, 0x7ec8ff]];

export function createStadium() {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry([[0, 0.012], [0.12, 0.018], [0.17, 0.032], [0.2, 0.056], [0.212, 0.07], [0.2, 0.072]].map(([r, y]) => new THREE.Vector2(r, y)), 36),
    mat(0xb9d4e6, { roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.014, 36), mat(0x1f1c27, { roughness: 0.6 })); base.position.y = 0.007;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.207, 0.009, 6, 40), mat(0xff4d00, { roughness: 0.4 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.07;
  [bowl, base, rim].forEach(m => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
  g.visible = false; ctx.scene.add(g);
  S.stadium = g;
  S.tops = TOP_COLS.map(([c1, c2]) => {
    const t = new THREE.Group(), spinner = new THREE.Group(); t.add(spinner);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.004, 0.03, 14), mat(0x9aa0a6, { metalness: 0.8, roughness: 0.3 })); tip.position.y = 0.015;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.014, 8), mat(c1, { metalness: 0.4, roughness: 0.3 })); ring.position.y = 0.034;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.016, 10), mat(c2, { roughness: 0.4 })); cap.position.y = 0.048;
    spinner.add(tip, ring, cap);
    t.userData = { spinner, ang: 0, r: 0.08, spin: 0, speed: 1, tilt: 0 };
    t.visible = false; ctx.scene.add(t);
    return t;
  });
}

// a regular sitting at a table, free to get up, who plays spinning tops
const available = c => c.p.regular && c.p.playsTops && c.pose === 'sit' && c.seat && c.seat.type === 'table' && !c.invited && !c.tops && !c.busy && !c.gone;
function tryStart() {
  const ready = S.customers.filter(available).sort(() => Math.random() - 0.5);
  if (ready.length < 2) return;
  const players = ready.slice(0, 2);
  const ses = { players, placed: false, arrived: 0, state: 'gather', loser: -1 };
  ses.done = new Promise(r => { ses.finish = r; });
  players.forEach(c => { c.tops = ses; });
  S.topsSession = ses;
  log(`${players[0].p.name} 和 ${players[1].p.name} 要打戰鬥陀螺`);
}

const carry = c => { c.g.add(S.stadium); S.stadium.position.set(0, 0.98, 0.34); S.stadium.rotation.set(0, 0, 0); S.stadium.visible = true; };
const place = () => { ctx.scene.add(S.stadium); S.stadium.position.set(TABLE.x * K, TABLE.y, TABLE.z); S.stadium.rotation.set(0, 0, 0); };
const stow = () => { ctx.scene.add(S.stadium); S.stadium.visible = false; };

// one player's part in a session; returns the zone they end up in
export async function doTops(c, zone) {
  const ses = c.tops, i = ses.players.indexOf(c), spot = SPOTS[i];
  c.dropCup();
  if (i === 0) {
    c.status = '去後面搬戰鬥盤';
    await walk(c, route(zone, FETCH));
    c.face(Math.PI); await sleep(1);
    carry(c); c.gesture('carry', 600);
    c.status = '把戰鬥盤搬到戶外區';
    await walk(c, route(FETCH, spot.path));
    c.face(spot.face); place(); c.act = null; c.actT = 0; ses.placed = true;
  } else {
    c.status = '等戰鬥盤搬來';
    await walk(c, route(zone, spot.path));
    c.face(spot.face);
    while (!ses.placed) await sleep(0.4);
  }
  c.face(spot.face);
  c.status = '打戰鬥陀螺';
  ses.arrived++;
  if (i === 1) { await ses.done; c.tops = null; return spot.path; }

  while (ses.arrived < 2) await sleep(0.3);
  await battle(ses);
  c.status = '把戰鬥盤收回去';
  carry(c); c.gesture('carry', 600);
  await walk(c, route(spot.path, FETCH));
  stow(); c.act = null; c.actT = 0;
  c.tops = null; S.topsSession = null; S.topsCooldown = rand(70, 140);
  return FETCH;
}

async function battle(ses) {
  const [a, b] = ses.players;
  for (const n of ['3', '2', '1']) {
    a.say(n, 0.8); b.say(n, 0.8); a.gesture('aim', 1); b.gesture('aim', 1);
    await sleep(0.9);
  }
  a.say('Go Shoot!', 1.6); b.say('Go Shoot!', 1.6); a.gesture('shoot', 0.7); b.gesture('shoot', 0.7);
  S.tops.forEach((t, i) => Object.assign(t.userData, { ang: i * Math.PI, r: 0.1, spin: 0, speed: 1, tilt: 0 }));
  S.tops.forEach(t => { t.visible = true; });
  ses.state = 'spin';
  await sleep(rand(7, 12));
  ses.loser = Math.random() < 0.5 ? 0 : 1; ses.state = 'fall';
  await sleep(1.8);
  const w = ses.players[1 - ses.loser], l = ses.players[ses.loser];
  w.gesture('cheer', 2.2); l.gesture('facepalm', 1.6);
  log(`戰鬥陀螺：${w.p.name} 贏了 ${l.p.name}`);
  await sleep(2.4);
  ses.state = 'over';
  S.tops.forEach(t => { t.visible = false; });
  ses.finish();
}

export function updateTops(dt) {
  const ses = S.topsSession;
  if (!ses) {
    S.topsCooldown -= dt;
    if (S.topsCooldown <= 0) { S.topsCooldown = rand(30, 70); if (!S.closing) tryStart(); }
    return;
  }
  if (ses.state !== 'spin' && ses.state !== 'fall') return;
  S.tops.forEach((t, i) => {
    const u = t.userData, falling = ses.state === 'fall' && ses.loser === i;
    if (falling) { u.speed = Math.max(0, u.speed - dt * 0.8); u.tilt = Math.min(1.3, u.tilt + dt * 1.1); u.r = Math.min(0.15, u.r + dt * 0.05); }
    else u.r = 0.06 + Math.abs(Math.sin(u.ang * 0.9 + i)) * 0.07;   // circling and clashing toward the middle
    u.ang += dt * 2.6 * u.speed; u.spin += dt * 45 * u.speed;
    t.position.set(TABLE.x * K + Math.cos(u.ang) * u.r, TABLE.y + 0.018 + u.tilt * 0.012, TABLE.z + Math.sin(u.ang) * u.r);
    t.rotation.set(u.tilt, 0, u.tilt * 0.5);
    u.spinner.rotation.y = u.spin;
  });
}
