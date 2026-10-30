// What happens in the shop: the owner's loop, each customer's visit, the opening hours, the espresso steam.
import * as THREE from 'three';
import { ctx } from './engine.js';
import { S, sleep } from './state.js';
import { rand, randi, pick, K } from './util.js';
import { DOOR, TOILET, zoneSpot, route, LANE, MACHINE } from './layout.js';
import { Person, makeCup, walk } from './people.js';
import { newProfile, tvGames, GAME_LABEL } from './profiles.js';
import { doTops } from './tops.js';
import { sayLine, priceOf, drinkFor, pickVariant, orderName } from './content.js';
import { log, floatText } from './feed.js';
import { closeCard } from './hud.js';

export const DAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
// open 15:00; closes 22:00 Fri/Sat, 20:00 other days
export const closeHour = () => (S.dow === 5 || S.dow === 6) ? 22 : 20;

// ---------------------------------------------------------------- owner (the one and only staff)
export function createOwner() {
  const o = S.content.owner;
  const owner = new Person({ name: o.name, job: o.job, look: o.look }, 'owner');
  owner.setPos(1.9, 0.3); owner.heading = owner.targetHeading = -Math.PI / 2;
  owner.speed = 1.6;
  S.owner = owner;
  ownerLoop(owner);
}

async function ownerLoop(owner) {
  while (!S.stopped) {
    if (!S.orderQueue.length) {
      if (Math.random() < 0.08 && !S.closing) {
        owner.status = '去倉庫拿豆子';
        const back = [[LANE, -2.3], [0.6, -3.4], [-1.5, -3.95], [-1.5, -5.8], [-0.3, -5.8], [1.0, -5.8]];
        await walk(owner, back);
        owner.face(Math.PI); await sleep(1.5);
        owner.gesture('carry', 30);
        await walk(owner, back.slice().reverse().concat([[LANE, rand(-1.5, 2)]]));
        owner.act = null; owner.actT = 0;
        if (Math.random() < 0.5) sayLine(owner, 'owner.beansDone');
        continue;
      }
      owner.status = pick(['擦吧台', '整理茶杯', '試喝今天的豆子', '練雕花']);
      await walk(owner, [[LANE, rand(-1.6, 2.0)]]);
      owner.face(Math.random() < 0.5 ? -Math.PI / 2 : Math.PI / 2);
      owner.gesture(Math.random() < 0.5 ? 'wipe' : 'pour', 2);
      if (Math.random() < 0.12) sayLine(owner, 'owner.idle');
      for (let i = 0; i < 4 && !S.orderQueue.length; i++) await sleep(0.6);
      continue;
    }
    const c = S.orderQueue.shift();
    if (c.gone) continue;
    const drink = drinkFor(c.p.drink);   // a regular's usual may have come off the menu
    const variant = pickVariant(drink);
    c.drink = orderName(drink, variant);
    const vars = { name: c.p.name, drink: c.drink };
    owner.status = `幫${c.p.name}點餐`;
    await walk(owner, [[1.55, c.spot.z]]);
    owner.face(-Math.PI / 2);
    sayLine(owner, c.p.regular ? 'owner.greetRegular' : 'owner.greetNew', vars);
    await sleep(1.6);
    sayLine(c, c.p.regular ? 'customer.orderRegular' : 'customer.orderNew', vars);
    await sleep(1.4);
    owner.status = `做${c.drink}`;
    await walk(owner, [MACHINE]);
    owner.face(-Math.PI / 2); owner.gesture('brew', 2.2); S.brewing = true;
    await sleep(2.2);
    owner.gesture('pour', 1.6); await sleep(1.6);
    S.brewing = false;
    const cup = makeCup(drink, variant); owner.hold(cup);
    await walk(owner, [[1.55, c.spot.z]]);
    owner.face(-Math.PI / 2);
    if (c.gone) { owner.dropCup(); continue; }
    sayLine(owner, variant === 'ice' ? 'owner.serveIced' : 'owner.serveHot', vars);
    owner.putCup(0.85, 1.07, c.spot.z);   // clear of the clipboard and the toys
    await sleep(0.6);
    c.hold(cup); owner.cup = null;
    const price = priceOf(drink, variant);
    S.revenue += price; S.cupsSold++;
    floatText('coin', `+$${price}`, new THREE.Vector3(0.6, 1.5, c.spot.z));
    c.resolveServed();
    await sleep(0.4);
  }
}

// ---------------------------------------------------------------- customers
const present = name => S.customers.some(c => c.p.name === name);
export const freeSeat = list => { const f = list.filter(s => !s.occ); return f.length ? pick(f) : null; };
function freeTableSeat(preferPorch) {
  const f = S.seats.tableSeats.filter(s => !s.occ); if (!f.length) return null;
  const pref = f.filter(s => !!s.porch === preferPorch);
  return pick(pref.length ? pref : f);
}

export function trySpawn(force) {
  if ((!S.open || S.closing) && !force) return false;
  if (S.closing && force) { log('打烊了，明天請早。'); return false; }
  if (S.customers.length >= 14) { if (force) log('店裡坐滿了，晚點再來。'); return false; }
  const spot = S.seats.counterSpots.find(s => !s.occ);
  if (!spot) { if (force) log('吧台前排滿了，等一下。'); return false; }
  const pool = S.regulars.filter(r => !present(r.name));
  const prof = pool.length && Math.random() < 0.75 ? pick(pool) : newProfile();
  const c = new Person(prof, 'customer');
  S.customers.push(c);
  spot.occ = c; c.spot = spot;
  c.setPos(-1.75, 11); c.heading = Math.PI;
  customerLife(c);
  return true;
}

async function leave(c, zone) {
  const p = c.p;
  c.status = '準備離開';
  await walk(c, route(zone, DOOR));
  sayLine(c, p.regular ? 'customer.leaveRegular' : 'customer.leaveNew');
  if (p.regular) c.gesture('wave', 1.5);
  if (Math.random() < 0.6) sleep(0.7).then(() => sayLine(S.owner, p.regular ? 'owner.byeRegular' : 'owner.byeNew', { name: p.name }));
  await walk(c, [[-1.75, 11.5]]);
  await sleep(0.3);
  log(`${p.name} 離開了`);
  S.customers.splice(S.customers.indexOf(c), 1);
  if (c === S.selected) closeCard();
  c.remove();
}

async function customerLife(c) {
  const p = c.p;
  if (p.regular) p.visits++;
  c.status = '走進店裡';
  log(p.regular ? `熟客 ${p.name} 來了（第 ${p.visits} 次）` : `新客人 ${p.name} 推門進來`);
  floatText('bang', '!', new THREE.Vector3(c.g.position.x / K, 2.1, c.g.position.z), 1);
  await walk(c, route(DOOR, zoneSpot(c.spot)));
  c.face(Math.PI / 2);
  c.status = '在吧台點餐';
  if (p.regular) { sayLine(c, 'customer.arriveRegular', { name: p.name }, 2); c.gesture('wave', 1.2); }
  else sayLine(c, 'customer.arriveNew', { name: p.name }, 2.4);
  const served = new Promise(r => { c.resolveServed = r; });
  S.orderQueue.push(c);
  await served;
  c.status = '拿到咖啡';
  let zone = zoneSpot(c.spot);
  const spot = c.spot; c.spot = null;
  await sleep(0.5);
  spot.occ = null;
  zone = await stayAWhile(c, zone, 0);
  await leave(c, zone);
}

// ---------------------------------------------------------------- the TV: who may sit down, and at which game
// not everyone plays: only people with a TV game, and not on every visit
const wantsToPlay = c => tvGames(c.p).length > 0 && Math.random() < (c.p.regular ? 0.45 : 0.2);
// the TV runs one game at a time: whoever sits down first picks it, and only someone who plays that game joins them
export const canJoinTv = c => {
  const games = tvGames(c.p);
  return games.length > 0 && !!freeSeat(S.seats.gameSeats) && (!S.tv.game || games.includes(S.tv.game));
};

// someone is on the TV alone against the computer: anyone who plays that game is welcome to take the other controller
const vsCpu = () => !!S.tv.match && !S.tv.match.away.person;

// a few things to do before leaving: the TV, watching, a table, or spinning tops if two regulars get it going
async function stayAWhile(c, zone, hops) {
  const { gameSeats, specSpots } = S.seats;
  const wantsPlay = wantsToPlay(c);
  while (!S.closing && hops < 3) {
    hops++;
    let s = null;
    if (c.tops) { zone = await doTops(c, zone); c.nextGoal = true; }
    else if ((wantsPlay || c.invited || (vsCpu() && Math.random() < 0.7)) && canJoinTv(c) && (s = freeSeat(gameSeats))) zone = await doGame(c, zone, s);
    else if (wantsPlay && S.tv.match && hops === 1 && (s = freeSeat(specSpots))) zone = await doSpectate(c, zone, s);
    else if ((s = freeTableSeat(Math.random() < (c.p.smokes ? 0.85 : 0.3)))) zone = await doTable(c, zone, s);   // smokers head outside
    else { c.status = '外帶'; sayLine(c, 'customer.takeaway'); break; }
    if (!c.invited && !c.nextGoal && !c.tops) break;
    c.nextGoal = false;
  }
  return zone;
}

async function doTable(c, zone, s) {
  s.occ = c; c.seat = s;
  c.status = s.porch ? '去戶外區坐' : '找位子坐';
  if (zone !== s.path) await walk(c, route(zone, s.path));
  c.face(s.face); c.pose = 'sit';
  c.putCup(...s.cup);
  c.status = s.porch ? '在戶外區喝咖啡看街景' : '坐著喝咖啡';
  const stay = rand(45, 100);
  let t = 0;
  while (t < stay && !S.closing && !c.tops) {
    await sleep(2); t += 2;
    if (c.tops) break;
    if (Math.random() < 0.25) { c.pickCup(); c.gesture('sip', 1.4); await sleep(1.4); t += 1.4; c.putCup(...s.cup); }
    if (Math.random() < 0.08) sayLine(c, s.porch ? 'customer.chatPorch' : 'customer.chatTable', { name: c.p.name });
    // smoking is allowed outside only
    if (s.porch && c.p.smokes && !c.cig && Math.random() < 0.1) { c.lightUp(rand(30, 50)); if (Math.random() < 0.5) sayLine(c, 'customer.smoke', { name: c.p.name }); }
    if (Math.random() < 0.025 && !S.toiletBusy && !c.tops) {
      S.toiletBusy = true; c.busy = true; c.status = '去廁所'; c.pose = 'stand';
      c.putOut();
      await walk(c, route(s.path, TOILET)); await walk(c, [[1.7, -7.55]]);   // to the squat pan, facing the hood
      c.face(Math.PI); await sleep(0.6);
      c.gesture('pull', 0.8); await sleep(0.8); c.pantsDown(true); c.pose = 'squat'; c.status = '蹲廁所';
      await sleep(rand(6, 10));
      c.pose = 'stand'; c.gesture('pull', 0.8); await sleep(0.8); c.pantsDown(false); c.status = '去廁所';
      await walk(c, [TOILET[0]]); await walk(c, route(TOILET, s.path)); S.toiletBusy = false; c.busy = false;
      c.face(s.face); c.pose = 'sit'; c.status = '坐著喝咖啡'; t += 8;
    }
    if (Math.random() < (vsCpu() ? 0.12 : c.p.regular && !S.tv.match ? 0.05 : 0) && canJoinTv(c)) { sayLine(c, 'customer.wantsTv'); c.invited = true; break; }
    if (c.invited && canJoinTv(c)) break;
  }
  c.pickCup(); c.putOut(); c.pose = 'stand'; s.occ = null; c.seat = null;   // stubbed out in the ashtray before getting up
  if (c.invited || c.tops) c.nextGoal = true;
  return s.path;
}

async function doGame(c, zone, s) {
  s.occ = c; c.seat = s; c.invited = false;
  const games = tvGames(c.p);
  if (!S.tv.game) S.tv.game = pick(games);   // first to sit down picks the game
  const game = S.tv.game;
  c.status = '走去電視前';
  if (zone !== s.path) await walk(c, route(zone, s.path));
  c.face(s.face); c.pose = 'game';
  c.dropCup();   // no drinks by the TV: finish it before picking up the controller
  c.matchesLeft = S.closing ? 1 : randi(1, 3);
  c.status = `在打${GAME_LABEL[game]}`;
  if (game === 'fight') sayLine(c, 'fight.sitDown', { fighter: c.p.fighter });
  else sayLine(c, S.tv.match ? 'game.sitWaiting' : 'game.sitDown', { team: c.p.team });
  const done = new Promise(r => { c.resolveDone = r; });
  c.ready = true;
  await done;
  c.ready = false;
  c.pickCup(); c.pose = 'stand'; s.occ = null; c.seat = null;
  if (!S.seats.gameSeats.some(g => g.occ)) S.tv.game = null;   // the TV is free for any game again
  if (!S.closing && Math.random() < 0.35 && freeTableSeat(false)) { c.nextGoal = true; if (game === 'nba') sayLine(c, 'game.tired'); }
  return s.path;
}

async function doSpectate(c, zone, s) {
  s.occ = c; c.seat = s;
  c.status = '站在旁邊看別人打電動';
  await walk(c, route(zone, s.path));
  c.face(s.face);
  const stay = rand(25, 50);
  let t = 0;
  while (t < stay && !S.closing) {
    await sleep(1); t += 1;
    if (canJoinTv(c) && Math.random() < 0.4) { c.invited = true; break; }
  }
  s.occ = null; c.seat = null;
  c.nextGoal = true;
  return s.path;
}

// ---------------------------------------------------------------- opening scene: Friday 4pm, a few regulars already in
function seedCustomer(prof, s) {
  if (!prof || !s) return;
  const c = new Person(prof, 'customer'); S.customers.push(c);
  c.setPos(s.x, s.z); c.heading = s.face;
  const d = drinkFor(prof.drink); c.hold(makeCup(d, pickVariant(d)));
  (async () => {
    let zone = s.type === 'game' ? await doGame(c, s.path, s) : await doTable(c, s.path, s);
    zone = await stayAWhile(c, zone, 1);
    await leave(c, zone);
  })();
}
export function seedOpeningScene() {
  const pool = S.regulars.slice().sort(() => Math.random() - 0.5);
  const take = test => { const i = pool.findIndex(test); return i < 0 ? null : pool.splice(i, 1)[0]; };
  const { gameSeats, tableSeats } = S.seats;
  // sometimes someone's already on the TV, sometimes it's sitting idle
  const first = Math.random() < 0.55 ? take(r => tvGames(r).length) : null;
  if (first) {
    const game = pick(tvGames(first));
    S.tv.game = game;
    seedCustomer(first, gameSeats[0]);
    if (Math.random() < 0.6) seedCustomer(take(r => tvGames(r).includes(game)), gameSeats[1]);
    S.tv.startDelay = 0.2;
  }
  const free = tableSeats.slice().sort(() => Math.random() - 0.5);
  seedCustomer(take(() => true), free.find(s => !s.porch));
  seedCustomer(take(() => true), free.find(s => !s.porch && !s.occ));
  seedCustomer(take(() => true), free.find(s => s.porch && !s.occ));
  log('週五下午四點，窺視珈琲照常營業');
}

// ---------------------------------------------------------------- the clock: closing up, opening the next day, new arrivals
export function tickShop(sdt) {
  S.minutes += sdt;
  if (S.open && !S.closing && S.minutes >= closeHour() * 60) {
    S.closing = true; log(`${closeHour()} 點，${S.owner.p.name}準備打烊`); sayLine(S.owner, 'owner.closing', { name: S.customers.length ? pick(S.customers).p.name : '大家' }, 3.5);
  }
  if (S.closing && S.customers.length === 0 && S.orderQueue.length === 0) {
    S.closing = false; S.dow = (S.dow + 1) % 7; S.minutes = 15 * 60; S.revenue = 0; S.cupsSold = 0;
    log(`${DAYS[S.dow]}下午三點，開門！`); sayLine(S.owner, 'owner.opening', {}, 3);
    S.spawnCooldown = 3;
  }
  if (S.open && !S.closing) {
    S.spawnCooldown -= sdt;
    if (S.spawnCooldown <= 0) {
      trySpawn(false);
      const h = S.minutes / 60;
      S.spawnCooldown = rand(8, 18) / ((h >= 17.5 && h < 20.5) ? 1.6 : 1);
    }
  }
}

// ---------------------------------------------------------------- cigarette smoke
// soft, lumpy puffs: a stream curling up off every lit tip, a thick cloud blown out after each drag that hangs about
// and spreads, and ash flicked off. Each puff turns slowly and sways as it rises.
const smoke = [];
let puffTex = null;
const puffTexture = () => puffTex || (puffTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const g = c.getContext('2d');
  for (let i = 0; i < 9; i++) {   // a few overlapping soft blobs, so it reads as a cloud, not a disc
    const x = 48 + rand(-16, 16), y = 48 + rand(-16, 16), r = rand(18, 30);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,.55)'); grd.addColorStop(0.6, 'rgba(255,255,255,.22)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 96, 96);
  }
  return new THREE.CanvasTexture(c);
})());
export function createSmoke() {
  smoke.length = 0;
  for (let i = 0; i < 320; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: 0xd8dde2, transparent: true, opacity: 0, depthWrite: false }));
    sp.visible = false; ctx.scene.add(sp);
    smoke.push({ sp, life: 0, max: 1, v: new THREE.Vector3(), s0: 0.04, s1: 0.2, op: 0.5, fall: false, phase: 0, spin: 0 });
  }
}
function emit(pos, v, life, s0, s1, op, color, fall = false) {
  const p = smoke.find(q => q.life <= 0); if (!p) return;
  Object.assign(p, { life, max: life, s0, s1, op, fall, phase: rand(0, 6.3), spin: rand(-0.6, 0.6) });
  p.v.copy(v); p.sp.position.copy(pos); p.sp.material.color.setHex(color); p.sp.material.rotation = rand(0, 6.3); p.sp.visible = true;
}
const at = new THREE.Vector3(), fwd = new THREE.Vector3();
export function updateSmoke(dt) {
  for (const p of S.people) {
    if (!p.cig) continue;
    const ember = p.cig.userData.ember;
    // the stream off the tip: thicker while it's being drawn on
    const drawing = p.smk && p.smk.phase === 'drag';
    if (Math.random() < dt * (drawing ? 4 : 14)) {
      ember.getWorldPosition(at);
      emit(at, new THREE.Vector3(rand(-0.02, 0.02), rand(0.16, 0.24), rand(-0.02, 0.02)), rand(3, 4.2), 0.035, rand(0.28, 0.4), 0.6, 0xc9cfd6);
    }
    // blown out after a drag: a cloud from the mouth, the way the head is facing, up and out
    if (p.exhaleT > 0 && Math.random() < dt * 48) {
      p.mouth.getWorldPosition(at);
      fwd.set(0, 0, 1).transformDirection(p.head.matrixWorld);
      at.addScaledVector(fwd, 0.035);
      const v = fwd.clone().multiplyScalar(rand(0.35, 0.6) * (p.exhaleT / 1.4 + 0.3)).add(new THREE.Vector3(rand(-0.06, 0.06), rand(0.08, 0.18), rand(-0.06, 0.06)));
      emit(at, v, rand(2.6, 3.6), 0.07, rand(0.5, 0.75), 0.75, 0xeef0f2);
    }
    // ash flicked off, dropping
    if (p.ashT > 0 && Math.random() < dt * 30) {
      ember.getWorldPosition(at);
      emit(at, new THREE.Vector3(rand(-0.04, 0.04), -0.1, rand(-0.04, 0.04)), 0.5, 0.012, 0.012, 0.9, 0x6a6a68, true);
    }
  }
  for (const p of smoke) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.sp.visible = false; continue; }
    const k = 1 - p.life / p.max;                       // 0 at birth -> 1 when gone
    if (p.fall) p.v.y -= dt * 1.5;
    else {
      p.v.multiplyScalar(1 - dt * 1.1); p.v.y += dt * 0.1; p.v.z += dt * 0.025;   // slows, keeps rising, drifts toward the street
      p.phase += dt * 2.2;
      p.v.x += Math.sin(p.phase) * dt * 0.06; p.v.z += Math.cos(p.phase * 0.8) * dt * 0.05;   // curling
      p.sp.material.rotation += p.spin * dt;
    }
    p.sp.position.addScaledVector(p.v, dt);
    p.sp.scale.setScalar(p.s0 + (p.s1 - p.s0) * Math.sqrt(k));
    p.sp.material.opacity = p.op * Math.min(1, k * 8) * Math.pow(1 - k, 1.3);   // fades in fast, out slowly
  }
}

// ---------------------------------------------------------------- steam over the machine (cubes, for the 8-bit feel)
const steam = [];
export function createSteam() {
  steam.length = 0;
  const steamGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  for (let i = 0; i < 14; i++) { const s = new THREE.Mesh(steamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })); s.visible = false; ctx.scene.add(s); steam.push({ m: s, life: 0 }); }
}
export function updateSteam(dt) {
  steam.forEach(s => {
    if (s.life > 0) {
      s.life -= dt; s.m.position.y += dt * 0.45;
      s.m.material.opacity = Math.max(0, s.life / 1.5) * 0.5;
      if (s.life <= 0) s.m.visible = false;
    } else if (S.brewing && Math.random() < dt * 6) {
      s.life = 1.5; s.m.visible = true; s.m.position.set(rand(0.58, 0.78) * K, 1.6, 1.5 + rand(-0.25, 0.25));
    }
  });
}
