// Spinning tops: now and then two regulars who play fetch the stadium from the back, set it on the street-side crates
// in the middle of the outdoor area (the arcade), count down "3, 2, 1, Go Shoot!" and battle until one top falls over.
import * as THREE from 'three';
import { ctx, mat } from './engine.js';
import { S, sleep } from './state.js';
import { rand, K } from './util.js';
import { HUBX, STRIP, BACK_SHIFT, route } from './layout.js';
import { walk } from './people.js';
import { log } from './feed.js';

const TABLE = { x: -1.0, z: STRIP.at(STRIP.crates[0]), y: 0.6 };   // on the street-side crates
const PORCH = [[-1.6, 4.5], [HUBX, 3.6]];
// where the two players stand, either side of the crates (paths run spot -> hub, like every seat's)
const SPOTS = [
  { path: [[-1.62, TABLE.z], [-1.75, 4.75]].concat(PORCH), face: Math.PI / 2 },
  { path: [[-0.4, TABLE.z], [-0.45, 4.7]].concat(PORCH), face: -Math.PI / 2 },
];
// the stadium lives in the back: put away on top of the crates stacked by the AC in the back corridor, where it can
// be seen from above (and clicked)
// (in the room as it stands, after the back of the set was moved BACK_SHIFT forward)
const SHELF = { x: -2.68, z: -7.75 + BACK_SHIFT, y: 0.9 };   // a touch in from the crates' middle, clear of the wall
const FETCH = [[-2.15, SHELF.z], [-1.95, -5.6], [-1.85, -5.5], [-1.85, -3.95], [HUBX, -3.6]];
const TOP_COLS = [[0xc0282d, 0xffd23f], [0x1c4fd6, 0x7ec8ff]];

// the stadium, after the photo of a competition one (44 x 45.5 x 12.5 cm): a clear plastic tub, square with its corners
// cut off, a round bowl moulded into it with faint rings on its floor, a green rail round the bowl's rim with a notch in
// it at the back, a small pocket in each cut corner, and a clear lid over the top
export function createStadium() {
  const g = new THREE.Group();
  const W = 0.44, D = 0.455, H = 0.125, CUT = 0.075;
  const clear = (opacity, tint = 0xe4ecf4) => new THREE.MeshStandardMaterial({ color: tint, roughness: 0.08, metalness: 0.15, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  // the tub: the cut-cornered outline pushed up into walls
  const outline = (w, d, c) => { const sh = new THREE.Shape(), x = w / 2, z = d / 2;
    sh.moveTo(-x + c, -z); sh.lineTo(x - c, -z); sh.lineTo(x, -z + c); sh.lineTo(x, z - c); sh.lineTo(x - c, z); sh.lineTo(-x + c, z); sh.lineTo(-x, z - c); sh.lineTo(-x, -z + c); sh.closePath(); return sh; };
  const tub = new THREE.Mesh(new THREE.ExtrudeGeometry(outline(W, D, CUT), { depth: H - 0.012, bevelEnabled: false }), clear(0.32));
  tub.rotation.x = -Math.PI / 2; g.add(tub);
  const base = new THREE.Mesh(new THREE.ExtrudeGeometry(outline(W + 0.01, D + 0.01, CUT), { depth: 0.008, bevelEnabled: false }), clear(0.5, 0xc9d3de));   // the foot it stands on
  base.rotation.x = -Math.PI / 2; g.add(base);
  // the bowl inside, frosted, dipping to a flat middle, with faint rings on its floor
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.014], [0.06, 0.016], [0.11, 0.028], [0.15, 0.05], [0.172, 0.075], [0.182, 0.098], [0.186, 0.108]].map(([r, y]) => new THREE.Vector2(r, y)), 56), clear(0.42, 0xdfe7f1));
  g.add(bowl);
  [0.05, 0.1].forEach(r => { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0015, 4, 48), clear(0.5, 0xb8c6d6)); ring.rotation.x = Math.PI / 2; ring.position.y = r < 0.07 ? 0.017 : 0.027; g.add(ring); });
  // the green rail round the rim, open at the back where it dips into a notch
  const green = mat(0x5bd84a, { roughness: 0.45 });
  const rail = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.0075, 6, 64, Math.PI * 2 - 0.42), green);
  rail.rotation.set(Math.PI / 2, 0, -Math.PI / 2 + 0.21); rail.position.y = 0.106; g.add(rail);   // the gap faces -z, the back
  const notch = new THREE.Group(); notch.position.set(0, 0.106, -0.19); g.add(notch);
  [-1, 1].forEach(sd => { const side = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.015), green); side.position.set(sd * 0.038, -0.015, 0); notch.add(side); });
  const dip = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.012, 0.015), green); dip.position.y = -0.03; notch.add(dip);
  // a pocket in each cut corner: a little clear tray set into it
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    const pk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.05), clear(0.45, 0xcfd9e4));
    pk.position.set(sx * (W / 2 - 0.06), 0.05, sz * (D / 2 - 0.06)); pk.rotation.y = Math.PI / 4; g.add(pk);
  });
  // the clear lid over the top, a shade lighter, with a round window over the bowl
  const lidShape = outline(W - 0.004, D - 0.004, CUT); lidShape.holes.push(new THREE.Path().absarc(0, 0, 0.17, 0, Math.PI * 2, true));
  const lid = new THREE.Mesh(new THREE.ExtrudeGeometry(lidShape, { depth: 0.006, bevelEnabled: false, curveSegments: 40 }), clear(0.25));
  lid.rotation.x = -Math.PI / 2; lid.position.y = H - 0.012; g.add(lid);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 40, 8, 0, Math.PI * 2, 0, 0.32), clear(0.14));   // the window, a shallow dome
  dome.position.y = H - 0.012 - 0.17 * Math.cos(0.32) + 0.004; g.add(dome);
  g.traverse(m => { if (m.isMesh) { m.castShadow = m.material === green; m.receiveShadow = true; } });
  S.stadium = g; stow();
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
const stow = () => { ctx.scene.add(S.stadium); S.stadium.position.set(SHELF.x * K, SHELF.y, SHELF.z); S.stadium.rotation.set(0, 0, 0); S.stadium.visible = true; };

// one player's part in a session; returns the zone they end up in
export async function doTops(c, zone) {
  const ses = c.tops, i = ses.players.indexOf(c), spot = SPOTS[i];
  c.dropCup();
  if (i === 0) {
    c.status = '去後面搬戰鬥盤';
    await walk(c, route(zone, FETCH));
    c.face(-Math.PI / 2); await sleep(1);   // turned to the crates
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
    const floorY = 0.02 + Math.max(0, u.r - 0.09) * 0.5;   // riding up the bowl's slope toward the rim
    t.position.set(TABLE.x * K + Math.cos(u.ang) * u.r, TABLE.y + floorY + u.tilt * 0.012, TABLE.z + Math.sin(u.ang) * u.r);
    t.rotation.set(u.tilt, 0, u.tilt * 0.5);
    u.spinner.rotation.y = u.spin;
  });
}
