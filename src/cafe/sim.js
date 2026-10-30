// What happens in the shop: the owner's loop, each customer's visit, the opening hours, the espresso steam.
import * as THREE from 'three';
import { ctx } from './engine.js';
import { S, sleep } from './state.js';
import { rand, randi, pick, K } from './util.js';
import { DOOR, TOILET, zoneSpot, route, LANE, MACHINE } from './layout.js';
import { Person, makeCup, walk } from './people.js';
import { OWNER, newProfile } from './profiles.js';
import { sayLine, isIced, priceOf, drinkFor } from './content.js';
import { log, floatText } from './feed.js';
import { closeCard } from './hud.js';

export const DAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
// open 15:00; closes 22:00 Fri/Sat, 20:00 other days
export const closeHour = () => (S.dow === 5 || S.dow === 6) ? 22 : 20;

// ---------------------------------------------------------------- owner (the one and only staff)
export function createOwner() {
  const owner = new Person(OWNER, 'owner');
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
    const drink = c.drink = drinkFor(c.p.drink);   // a regular's usual may have come off the menu
    const vars = { name: c.p.name, drink };
    owner.status = `幫${c.p.name}點餐`;
    await walk(owner, [[1.55, c.spot.z]]);
    owner.face(-Math.PI / 2);
    sayLine(owner, c.p.regular ? 'owner.greetRegular' : 'owner.greetNew', vars);
    await sleep(1.6);
    sayLine(c, c.p.regular ? 'customer.orderRegular' : 'customer.orderNew', vars);
    await sleep(1.4);
    owner.status = `做${drink}`;
    await walk(owner, [MACHINE]);
    owner.face(-Math.PI / 2); owner.gesture('brew', 2.2); S.brewing = true;
    await sleep(2.2);
    owner.gesture('pour', 1.6); await sleep(1.6);
    S.brewing = false;
    const cup = makeCup(drink); owner.hold(cup);
    await walk(owner, [[1.55, c.spot.z]]);
    owner.face(-Math.PI / 2);
    if (c.gone) { owner.dropCup(); continue; }
    sayLine(owner, isIced(drink) ? 'owner.serveIced' : 'owner.serveHot', vars);
    owner.putCup(0.85, 1.07, c.spot.z);   // clear of the clipboard and the toys
    await sleep(0.6);
    c.hold(cup); owner.cup = null;
    const price = priceOf(drink);
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

  const { gameSeats, specSpots } = S.seats;
  const wantsPlay = p.regular ? Math.random() < 0.6 : Math.random() < 0.25;
  let hops = 0;
  while (!S.closing && hops < 3) {
    hops++;
    let s = null;
    if ((wantsPlay || c.invited) && (s = freeSeat(gameSeats))) zone = await doGame(c, zone, s);
    else if (wantsPlay && S.tv.match && hops === 1 && (s = freeSeat(specSpots))) zone = await doSpectate(c, zone, s);
    else if ((s = freeTableSeat(Math.random() < 0.3))) zone = await doTable(c, zone, s);
    else { c.status = '外帶'; sayLine(c, 'customer.takeaway'); break; }
    if (!c.invited && !c.nextGoal) break;
    c.nextGoal = false;
  }
  await leave(c, zone);
}

async function doTable(c, zone, s) {
  s.occ = c; c.seat = s;
  c.status = s.porch ? '去騎樓坐啤酒箱' : '找位子坐';
  if (zone !== s.path) await walk(c, route(zone, s.path));
  c.face(s.face); c.pose = 'sit';
  c.putCup(...s.cup);
  c.status = s.porch ? '在騎樓喝咖啡看街景' : '坐著喝咖啡';
  const stay = rand(45, 100);
  let t = 0;
  while (t < stay && !S.closing) {
    await sleep(2); t += 2;
    if (Math.random() < 0.25) { c.pickCup(); c.gesture('sip', 1.4); await sleep(1.4); t += 1.4; c.putCup(...s.cup); }
    if (Math.random() < 0.08) sayLine(c, s.porch ? 'customer.chatPorch' : 'customer.chatTable', { name: c.p.name });
    if (Math.random() < 0.025 && !S.toiletBusy) {
      S.toiletBusy = true; c.status = '去廁所'; c.pose = 'stand';
      await walk(c, route(s.path, TOILET)); await sleep(4);
      await walk(c, route(TOILET, s.path)); S.toiletBusy = false;
      c.face(s.face); c.pose = 'sit'; c.status = '坐著喝咖啡'; t += 8;
    }
    if (c.p.regular && Math.random() < 0.06 && !S.tv.match && freeSeat(S.seats.gameSeats)) { sayLine(c, 'customer.wantsTv'); c.invited = true; break; }
    if (c.invited && freeSeat(S.seats.gameSeats)) break;
  }
  c.pickCup(); c.pose = 'stand'; s.occ = null; c.seat = null;
  if (c.invited) c.nextGoal = true;
  return s.path;
}

async function doGame(c, zone, s) {
  s.occ = c; c.seat = s; c.invited = false;
  c.status = '走去電視前';
  if (zone !== s.path) await walk(c, route(zone, s.path));
  c.face(s.face); c.pose = 'game';
  c.dropCup();   // no drinks by the TV: finish it before picking up the controller
  c.matchesLeft = S.closing ? 1 : randi(1, 3);
  c.status = '在打 NBA 2K';
  sayLine(c, S.tv.match ? 'game.sitWaiting' : 'game.sitDown');
  const done = new Promise(r => { c.resolveDone = r; });
  c.ready = true;
  await done;
  c.ready = false;
  c.pickCup(); c.pose = 'stand'; s.occ = null; c.seat = null;
  if (!S.closing && Math.random() < 0.35 && freeTableSeat(false)) { c.nextGoal = true; sayLine(c, 'game.tired'); }
  return s.path;
}

async function doSpectate(c, zone, s) {
  s.occ = c; c.seat = s;
  c.status = '站在旁邊看別人打 2K';
  await walk(c, route(zone, s.path));
  c.face(s.face);
  const stay = rand(25, 50);
  let t = 0;
  while (t < stay && !S.closing) {
    await sleep(1); t += 1;
    if (freeSeat(S.seats.gameSeats) && Math.random() < 0.4) { c.invited = true; break; }
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
  c.hold(makeCup(drinkFor(prof.drink)));
  (async () => {
    let zone = s.type === 'game' ? await doGame(c, s.path, s) : await doTable(c, s.path, s);
    if (c.nextGoal && !S.closing) { const t = freeTableSeat(false); if (t) { c.nextGoal = false; zone = await doTable(c, zone, t); } }
    await leave(c, zone);
  })();
}
export function seedOpeningScene() {
  // the usual crowd if they're still on the list, otherwise whichever regulars are
  const used = new Set();
  const reg = n => { const r = S.regulars.find(x => x.name === n && !used.has(x)) || S.regulars.find(x => !used.has(x)); if (r) used.add(r); return r; };
  const { gameSeats, tableSeats } = S.seats;
  seedCustomer(reg('阿凱'), gameSeats[0]);
  seedCustomer(reg('美美'), gameSeats[1]);
  seedCustomer(reg('老陳'), tableSeats[4]);
  seedCustomer(reg('小雨'), tableSeats[1]);
  seedCustomer(reg('阿嘉'), tableSeats.find(s => s.porch));
  S.tv.startDelay = 0.2;
  log('週五下午四點，窺視珈琲照常營業');
}

// ---------------------------------------------------------------- the clock: closing up, opening the next day, new arrivals
export function tickShop(sdt) {
  S.minutes += sdt;
  if (S.open && !S.closing && S.minutes >= closeHour() * 60) {
    S.closing = true; log(`${closeHour()} 點，小鬍子準備打烊`); sayLine(S.owner, 'owner.closing', {}, 3.5);
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
