// What happens in the shop: the owner's loop, each customer's visit, the opening hours, the espresso steam.
import * as THREE from 'three';
import { ctx } from './engine.js';
import { S, sleep } from './state.js';
import { rand, randi, pick, K } from './util.js';
import { DOOR, TOILET, zoneSpot, route, LANE, MACHINE, HUBX } from './layout.js';
import { Person, makeCup, makeTakeaway, setLevel, sip, walk } from './people.js';
import { newProfile, tvGames, GAME_LABEL } from './profiles.js';
import { doTops } from './tops.js';
import { sayLine, priceOf, drinkFor, pickVariant, orderName, menuNames } from './content.js';
import { log, floatText } from './feed.js';
import { closeCard } from './hud.js';
import { setStoreLight, setToiletLight } from './world/lights.js';
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

// behind the bar he walks down the middle of his lane, so his swinging arms never brush the bar or the work counter,
// and only steps across to a spot once he's level with it and has turned to face it (turning mid-step swings a hand into the bar)
async function ownerTo(owner, x, z, more = []) {
  const pts = [];
  if (Math.abs(owner.g.position.x / K - LANE) > 0.05) pts.push([LANE, owner.g.position.z]);
  if (z !== null) pts.push([LANE, z]);
  if (pts.length || more.length) await walk(owner, pts.concat(more));
  if (z !== null && Math.abs(x - LANE) > 0.01) {
    owner.face(x < LANE ? -Math.PI / 2 : Math.PI / 2); await sleep(0.35);
    await walk(owner, [[x, z]]);
  }
}

// out from behind the bar at its back end, round the 2K stools to the walkway (a path out to the walkway, like a seat's)
const BAR_OUT = [[LANE, -2.3], [0.6, -3.4], [-1.2, -3.95], [HUBX, -3.95]];
// the bin in the corner past the end of the 工作台 (world/interior.js), where he stands to tip one out, out to the walkway
const BIN = [[2.45, 2.36], [2.1, 2.8], [HUBX, 3.0]];
// one at a time: out to the ashtray, picked up, carried in to the bin and tipped out, then carried back and put down
async function emptyAshtrays(owner, trays) {
  owner.status = '去戶外區收菸灰缸';
  await ownerTo(owner, LANE, 2.9);
  let zone = FRONT_OUT;
  for (const a of trays) {
    owner.status = '去戶外區收菸灰缸';
    await walk(owner, route(zone, a.path)); zone = a.path;
    owner.face(a.face); await sleep(0.5);
    owner.gesture('serve', 0.6); await sleep(0.5);
    const home = a.g.parent;
    owner.hand.attach(a.g); a.g.position.set(0, -0.06, 0.02); a.g.rotation.set(0, 0, 0);   // in his hand
    owner.status = '拿菸灰缸去垃圾桶倒';
    owner.gesture('serve', 60);
    await walk(owner, route(zone, BIN)); zone = BIN;
    owner.face(Math.PI / 2); await sleep(0.5);
    a.g.rotation.z = -1.2; await sleep(0.9);   // tipped over the bin
    a.n = 0; a.show(); a.g.rotation.z = 0; await sleep(0.3);
    owner.status = '把菸灰缸放回去';
    await walk(owner, route(zone, a.path)); zone = a.path;
    owner.face(a.face); await sleep(0.4);
    home.attach(a.g); a.g.position.copy(a.home.pos); a.g.rotation.copy(a.home.rot);   // back where it was
    owner.act = null; owner.actT = 0; await sleep(0.4);
  }
  owner.status = '回吧台';
  const back = [[LANE, rand(-1.5, 1.5)]].concat(FRONT_OUT);
  await walk(owner, route(zone, back));
  owner.act = null; owner.actT = 0;
}

// the empties left on the tables: out to them a few at a time (to the seat's way in, not onto the seat, in case someone's
// sat down there since), picked up, and back behind the bar to set them in the sink, where they're washed up a while later
// out from behind the bar at its front end, where the menu is, and round to the walkway: clear of the sliding door at
// the back (which the way out past the 2K stools opened) and of the front door
const FRONT_OUT = [[LANE, 2.9], [1.0, 2.95], [-0.2, 2.95], [HUBX, 2.55]];
const SINK_AT = [[0.32, -1.66], [0.5, -1.44], [0.66, -1.66], [0.42, -1.52], [0.6, -1.4], [0.3, -1.42]];   // in the sink at the bar's inner end (world/interior.js)
const cupAt = e => { const p = new THREE.Vector3(); e.g.getWorldPosition(p); return p; };
async function clearEmpties(owner) {
  // up to four, taken in the order they lie (each next one the nearest to the last), so the round's short
  const left = S.empties.filter(e => e.g.parent), take = [];
  let from = left.shift(); if (!from) { S.empties.length = 0; return; }
  take.push(from);
  while (take.length < 4 && left.length) {
    const f = cupAt(from); left.sort((a, b) => cupAt(a).distanceTo(f) - cupAt(b).distanceTo(f));
    take.push(from = left.shift());
  }
  S.empties = S.empties.filter(e => e.g.parent && !take.includes(e));
  owner.status = '去收空杯';
  let held = 0;
  const pick = e => {
    owner.hand.attach(e.g); e.g.position.set((held - 1.5) * 0.035, -0.06, 0.02); e.g.rotation.set(0, 0, 0); held++; e.got = true;
  };
  // the manga ledge's stools are right behind the bar's back end: those he reaches from there, without going round by
  // the walkway (whose end is by the sliding door, which would open)
  const ledge = take.filter(e => e.ledge && e.g.parent);
  if (ledge.length) {
    await ownerTo(owner, LANE, -2.3);
    for (const e of ledge) {
      await walk(owner, [[Math.max(0.6, e.x), -3.55]]);   // just behind the stool
      owner.face(Math.PI); await sleep(0.4); owner.gesture('serve', 0.6); await sleep(0.5); pick(e);
    }
    await walk(owner, [[LANE, -2.3]]);
  }
  if (take.some(e => !e.got && e.g.parent)) await ownerTo(owner, LANE, 2.9);
  let zone = FRONT_OUT;
  for (const e of take) {
    if (e.got || !e.g.parent) continue;
    const to = e.path.length > 1 ? e.path.slice(1) : e.path;
    await walk(owner, route(zone, to)); zone = to;
    const wp = cupAt(e);
    owner.face(Math.atan2(wp.x - owner.g.position.x, wp.z - owner.g.position.z)); await sleep(0.4);
    owner.gesture('serve', 0.6); await sleep(0.5);
    // this one, and any other on the list within reach of where he stands (the next table along, the same crates)
    pick(e);
    for (const o of take) if (!o.got && o.g.parent && cupAt(o).distanceTo(owner.g.position) < 1.1) { await sleep(0.35); pick(o); }
    owner.status = '收空杯';
  }
  owner.status = '把空杯拿去水槽';
  owner.gesture('serve', 60);
  if (take.some(e => !e.ledge)) await walk(owner, route(zone, FRONT_OUT));
  await walk(owner, [[LANE, owner.g.position.z], [2.0, -1.55]]);
  owner.face(-Math.PI / 2); await sleep(0.4);
  take.forEach((e, i) => {
    if (e.g.parent !== owner.hand) return;
    ctx.scene.attach(e.g); const [x, z] = SINK_AT[(S.sinkN = ((S.sinkN || 0) + 1)) % SINK_AT.length];
    e.g.position.set(x * K, 0.79, z); e.g.rotation.set(0, Math.random() * 3, 0);
    S.timers.push({ t: rand(40, 70), r: () => e.g.parent?.remove(e.g) });   // washed and put away
  });
  owner.gesture('wipe', 1.6); await sleep(1.6);   // a rinse
  owner.act = null; owner.actT = 0;
}

async function ownerLoop(owner) {
  while (!S.stopped) {
    // more than five empties out on the tables: they're cleared first, before the next order
    if ((S.empties || []).length > 5) { await clearEmpties(owner); continue; }
    if (!S.orderQueue.length) {
      if (Math.random() < 0.08 && !S.closing) {
        owner.status = '去倉庫拿豆子';
        // in at the storeroom door, the light flicked on at the switch outside it (and back off, if it was off, coming out)
        const back = [[LANE, -2.3], [0.6, -3.4], [-1.2, -3.95], [-1.85, -4.1], [-1.85, -5.8], [-0.3, -5.8]], shelf = [1.0, -5.8];
        await ownerTo(owner, LANE, null, back);
        const wasOn = S.storeLight?.on; if (!wasOn) { setStoreLight(true); await sleep(0.3); }
        await walk(owner, [shelf]);
        owner.face(Math.PI); await sleep(1.5);
        owner.gesture('carry', 30);
        await walk(owner, [back[back.length - 1]]);
        if (!wasOn) setStoreLight(false);
        await walk(owner, back.slice(0, -1).reverse().concat([[LANE, rand(-1.5, 2)]]));
        owner.act = null; owner.actT = 0;
        if (Math.random() < 0.5) sayLine(owner, 'owner.beansDone');
        continue;
      }
      // or out to the arcade to empty the ashtrays, once there are a few butts in them
      const dirty = (S.ashtrays || []).filter(a => a.n >= 2);
      if (dirty.length && dirty.reduce((t, a) => t + a.n, 0) >= 4 && Math.random() < 0.06 && !S.closing) { await emptyAshtrays(owner, dirty); continue; }
      // or out to clear the empties off the tables, the more of them the sooner
      const empties = (S.empties || []).length;
      if (empties && Math.random() < (empties >= 2 ? 0.7 : 0.08)) { await clearEmpties(owner); continue; }   // (a lone one can wait for company)
      owner.status = pick(['擦吧台', '整理茶杯', '試喝今天的豆子', '練雕花']);
      // he steps up to whichever side he works at, just far enough off it that his hands stop at its edge
      const toBar = Math.random() < 0.5;
      await ownerTo(owner, toBar ? 2.05 : 1.95, rand(-1.6, 2.0));
      owner.face(toBar ? -Math.PI / 2 : Math.PI / 2);
      await sleep(0.5);   // turned all the way round before his hands go out, or they sweep through the other counter
      owner.gesture(Math.random() < 0.5 ? 'wipe' : 'pour', 2);
      if (Math.random() < 0.12 && !S.closing && S.customers.length) sayLine(owner, 'owner.idle');   // (no chatter to an empty shop, or while closing up)
      for (let i = 0; i < 4 && !S.orderQueue.length; i++) await sleep(0.6);
      continue;
    }
    const c = S.orderQueue.shift();
    if (c.gone) continue;
    // a regular's usual (on the menu or not), though now and then they try something else, hidden menu and all
    const usual = drinkFor(c.p.drink), others = menuNames().filter(n => n !== usual);
    const tryOther = c.p.regular && others.length && Math.random() < 0.3;
    const drink = tryOther ? pick(others) : usual;
    const variant = pickVariant(drink);
    c.drink = orderName(drink, variant);
    const vars = { name: c.p.name, drink: c.drink }, greet = tryOther ? { name: c.p.name, drink: usual } : vars;
    owner.status = `幫${c.p.name}點餐`;
    await ownerTo(owner, 1.62, c.spot.z);
    owner.face(-Math.PI / 2);
    sayLine(owner, c.p.regular ? 'owner.greetRegular' : 'owner.greetNew', greet);   // (the owner offers a regular their usual)
    await sleep(1.6);
    sayLine(c, c.p.regular ? (tryOther ? 'customer.orderOther' : 'customer.orderRegular') : 'customer.orderNew', vars);
    await sleep(1.4);
    owner.status = `做${c.drink}`;
    await ownerTo(owner, MACHINE[0], MACHINE[1]);
    owner.face(-Math.PI / 2); owner.gesture('brew', 2.2); S.brewing = true;
    await sleep(2.2);
    owner.gesture('pour', 1.6); await sleep(1.6);
    S.brewing = false;
    // he takes the cup as he steps back into his lane, and serves from there, reaching it up and over onto the bar,
    // so it is never carried low into the bar's side
    await walk(owner, [[LANE, MACHINE[1]]]);
    // ordered as the shop's closing, or with nowhere left to sit: they'll be off with it, so it goes in a takeaway cup
    const togo = S.closing || !S.seats.tableSeats.some(t => !t.occ);
    const cup = togo ? makeTakeaway() : makeCup(drink, variant); owner.hold(cup);
    await ownerTo(owner, LANE, c.spot.z);
    owner.face(-Math.PI / 2); await sleep(0.3);
    if (c.gone) { owner.dropCup(); continue; }
    sayLine(owner, variant === 'ice' ? 'owner.serveIced' : 'owner.serveHot', vars);
    owner.gesture('serve', 0.9);
    owner.putCup(0.85, 1.07, c.spot.z);   // clear of the clipboard and the toys
    await sleep(0.6);
    c.hold(cup); owner.cup = null;
    const price = priceOf(drink, variant);
    S.revenue += price; S.cupsSold++;
    floatText('coin', `+$${price}`, new THREE.Vector3(0.6, 1.5, c.spot.z));    c.resolveServed();
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
  // they come along the lane from one end or the other, and turn in at the door
  const from = Math.random() < 0.5 ? -1 : 1;
  c.setPos(from * WALK_X, WALK_Z + rand(-0.15, 0.15)); c.heading = -from * Math.PI / 2; c.fromLane = true;
  customerLife(c);
  return true;
}

// where people walk along the lane, out past the parked scooters and the tree stump at the end of the bench, and how
// far along it they go out of sight
const WALK_Z = 10.55, WALK_X = 16;
const OUT = [[-1.75, WALK_Z]].concat(DOOR.slice(1));   // out of the door to the lane
async function leave(c, zone) {
  const p = c.p;
  c.status = '準備離開';
  // still holding a glass or a tea cup (watching the TV, say): the last of it, then it's left behind, not taken out
  if (c.cup && !c.cup.userData.togo) { c.gesture('sip', 1.4); await sleep(1.4); setLevel(c.cup, 0); c.dropCup(); }
  await walk(c, route(zone, OUT));
  c.outside = true;
  sayLine(c, p.regular ? 'customer.leaveRegular' : 'customer.leaveNew');
  if (p.regular) c.gesture('wave', 1.5);
  if (Math.random() < 0.6) sleep(0.7).then(() => sayLine(S.owner, p.regular ? 'owner.byeRegular' : 'owner.byeNew', { name: p.name }));
  await walk(c, [[(Math.random() < 0.5 ? -1 : 1) * WALK_X, WALK_Z + rand(-0.15, 0.15)]]);   // and off along it, one way or the other
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
  if (c.fromLane) await walk(c, [[-1.75, WALK_Z]]);   // along the lane to the door
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
  while (!S.closing && (hops < 3 || c.tops || c.smokeNow)) {   // a tops game they've been pulled into, or a smoke they've been sent out for, always happens
    hops++;
    let s = null;
    if (c.smokeNow && !freePorchSeat()) { c.smokeNow = false; c.say('外面沒位子了，算了'); }   // taken while they got up: they just carry on
    if (c.tops) { zone = await doTops(c, zone); c.nextGoal = true; }
    else if (c.smokeNow && (s = freePorchSeat())) zone = await doTable(c, zone, s);
    else if ((wantsPlay || c.invited || (vsCpu() && Math.random() < 0.7)) && canJoinTv(c) && (s = freeSeat(gameSeats))) zone = await doGame(c, zone, s);
    else if (wantsPlay && S.tv.match && hops === 1 && (s = freeSeat(specSpots))) zone = await doSpectate(c, zone, s);
    else if ((s = freeTableSeat(Math.random() < (c.p.smokes ? 0.85 : 0.3)))) zone = await doTable(c, zone, s);   // smokers head outside
    else { c.status = '外帶'; sayLine(c, 'customer.takeaway'); break; }
    if (!c.invited && !c.nextGoal && !c.tops) break;
    c.nextGoal = false;
  }
  return zone;
}

// 來根小菸, from their card: someone who smokes, sitting at a table, lights up; sitting inside, they first go and find a
// seat outside (smoking's for outside only). Not while they're at a game, already smoking, or up and about.
const freePorchSeat = () => S.seats.tableSeats.filter(s => s.porch && !s.occ).length ? pick(S.seats.tableSeats.filter(s => s.porch && !s.occ)) : null;
function lightOne(c) { if (!c.cig) { c.lightUp(rand(30, 50)); sayLine(c, 'customer.smoke', { name: c.p.name }); } }
export function smokeState(c) {
  if (c.pose === 'game' || c.tops || (c.seat && c.seat.type === 'game')) return 'gaming';
  if (c.cig) return 'smoking';
  if (c.smokeNow) return 'going';
  if (c.busy || c.gone || S.closing) return 'busy';
  if (c.seat && c.seat.type === 'spec') return 'ready';   // only watching the game: free to step out for one
  if (c.pose !== 'sit' || !c.seat || c.seat.type !== 'table') return 'busy';
  return 'ready';
}
export function sendOutToSmoke(c) {
  if (smokeState(c) !== 'ready') return false;
  if (c.seat.porch) { lightOne(c); return true; }
  if (!freePorchSeat()) { c.say('外面沒位子了，等等再抽'); return false; }
  c.smokeNow = true; c.say('好，出去抽一根');
  return true;
}

async function doTable(c, zone, s) {
  s.occ = c; c.seat = s;
  c.status = s.porch ? '去戶外區坐' : '找位子坐';
  if (zone !== s.path) await walk(c, route(zone, s.path));
  c.face(s.face); c.pose = 'sit';
  c.putCup(...s.cup);
  c.status = s.porch ? '在戶外區喝咖啡看街景' : '坐著喝咖啡';
  if (c.smokeNow && s.porch) { c.smokeNow = false; lightOne(c); }   // out here for a smoke
  const stay = rand(45, 100);
  let t = 0;
  while (t < stay && !S.closing && !c.tops && !c.smokeNow) {
    await sleep(2); t += 2;
    if (c.tops || c.smokeNow) break;
    if (Math.random() < 0.25) { c.pickCup(); c.gesture('sip', 1.4); await sleep(0.8); sip(c.cup); await sleep(0.6); t += 1.4; c.putCup(...s.cup); }
    if (Math.random() < 0.08) sayLine(c, s.porch ? 'customer.chatPorch' : 'customer.chatTable', { name: c.p.name });
    // smoking is allowed outside only
    if (s.porch && c.p.smokes && !c.cig && Math.random() < 0.1) { c.lightUp(rand(30, 50)); if (Math.random() < 0.5) sayLine(c, 'customer.smoke', { name: c.p.name }); }
    if (Math.random() < 0.025 && !S.toiletBusy && !c.tops) {
      S.toiletBusy = true; c.busy = true; c.status = '去廁所'; c.pose = 'stand';
      c.putOut();
      // up to the door, the light switched on by it, then in to the squat pan, facing the hood
      const toDoor = route(s.path, TOILET).slice(0, -2);
      await walk(c, toDoor.concat([[-1.2, -7.05]]));
      c.face(Math.PI / 2); await sleep(0.4);
      const lit = S.toiletLight?.on; if (!lit) { c.gesture('serve', 0.4); setToiletLight(true); await sleep(0.4); }
      await walk(c, [[-1.2, -7.7], TOILET[1], TOILET[0]]); await walk(c, [[1.7, -7.55]]);
      c.face(Math.PI); await sleep(0.6);
      c.gesture('pull', 0.8); await sleep(0.8); c.pantsDown(true); c.pose = 'squat'; c.status = '蹲廁所';
      await sleep(rand(6, 10));
      c.pose = 'stand'; c.gesture('pull', 0.8); await sleep(0.8); c.pantsDown(false); c.status = '去廁所';
      // out of the door, the light switched off behind them if they found it off, and back to the seat
      await walk(c, [TOILET[0], TOILET[1], [-1.2, -7.7], [-1.2, -7.05]]);
      if (!lit) { c.face(Math.PI / 2); await sleep(0.3); setToiletLight(false); await sleep(0.2); }
      await walk(c, [[TOILET[2][0], -7.05]].concat(route(TOILET.slice(2), s.path))); S.toiletBusy = false; c.busy = false;
      c.face(s.face); c.pose = 'sit'; c.status = '坐著喝咖啡'; t += 8;
    }
    if (Math.random() < (vsCpu() ? 0.12 : c.p.regular && !S.tv.match ? 0.05 : 0) && canJoinTv(c)) { sayLine(c, 'customer.wantsTv'); c.invited = true; break; }
    if (c.invited && canJoinTv(c)) break;
  }
  c.putOut(); c.pose = 'stand'; s.occ = null; c.seat = null;   // stubbed out in the ashtray before getting up
  if (c.invited || c.tops || c.smokeNow) c.nextGoal = true;
  // off somewhere else in the shop: the drink goes with them. Leaving: they've finished it, and the empty is left on the
  // table for the owner to clear
  if (c.nextGoal || (c.cup && c.cup.userData.togo)) c.pickCup();
  else if (c.cup) { setLevel(c.cup, 0); (S.empties || (S.empties = [])).push({ g: c.cup, path: s.path, ledge: s.where === '霓虹燈下的漫畫吧檯', x: s.x }); c.cup = null; }
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
  while (t < stay && !S.closing && !c.smokeNow) {
    await sleep(1); t += 1;
    if (c.smokeNow) break;
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
    if (S.topsSession && S.topsSession.state === 'gather') S.topsSession.cancelled = true;   // a tops game not yet under way is off
    S.closing = true; log(`${closeHour()} 點，${S.owner.p.name}準備打烊`); sayLine(S.owner, 'owner.closing', { name: S.customers.length ? pick(S.customers).p.name : '大家' }, 3.5);
  }
  // the next day starts once the last of them is out of the door (they may still be walking off along the lane)
  if (S.closing && S.customers.every(c => c.outside) && S.orderQueue.length === 0) {
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
