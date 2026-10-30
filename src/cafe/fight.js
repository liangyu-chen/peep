// The fighting game on the TV: an original 8-bit one-on-one brawler, best of three rounds.
// Characters come from the back office's roster; each gets its own colours from its name.
import { S } from './state.js';
import { rand, pick, DOT, PIX } from './util.js';
import { sayLine } from './content.js';
import { log } from './feed.js';

const ROUND = 25;   // simulated seconds per round
// gi, trim (belt, gloves, energy), hair; picked by the character's name
const PALETTES = [
  ['#f4efe3', '#c0282d', '#2a1a10'], ['#c0282d', '#ffd23f', '#111111'], ['#1c4fd6', '#f4efe3', '#d9b48a'], ['#2e8b57', '#ffd23f', '#3a2a1e'],
  ['#1f1c27', '#ff4f7b', '#e8e4dc'], ['#f08a24', '#1f1c27', '#8a5a3a'], ['#9b6bff', '#7ec8ff', '#111111'], ['#e8c34a', '#c0282d', '#5a3a22'],
];
const hashOf = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
const paletteOf = name => PALETTES[hashOf(name) % PALETTES.length];
const SKINS = ['#f1c9a5', '#e0ac80', '#c68a5e', '#8d5a3b'];

function side(person, fighter, x, dir) {
  return {
    person, name: person ? person.p.name : 'CPU', team: fighter, fighter, score: 0,
    hp: 100, x, dir, act: 'idle', actT: 0, cool: rand(0.5, 1), walk: 0,
    col: paletteOf(fighter), skin: SKINS[hashOf(fighter + '*') % SKINS.length],
  };
}

export function startFight(h, a) {
  const roster = S.content.pools.fighter;
  const hf = h.p.fighter || pick(roster);
  let af = a ? a.p.fighter || pick(roster) : pick(roster.filter(f => f !== hf).concat(roster.length < 2 ? [hf] : []));
  const m = { kind: 'fight', home: side(h, hf, 0.3, 1), away: side(a, af, 0.7, -1), round: 1, t: ROUND, intro: 1.8, ko: 0, koText: '', final: 0, shots: [], sparks: [], clock: 0 };
  if (a) sayLine(h, 'fight.challenge', { opponent: a.p.name, fighter: hf }); else sayLine(h, 'fight.vsCpu', { fighter: hf });
  log(a ? `格鬥：${h.p.name}（${hf}）對上 ${a.p.name}（${af}）` : `格鬥：${h.p.name} 用${hf}打電腦`);
  return m;
}

// ---------------------------------------------------------------- logic
const clamp = x => Math.max(0.08, Math.min(0.92, x));
function cheerSpectators(key, chance) {
  S.seats.specSpots.forEach(s => { if (s.occ && Math.random() < chance) { s.occ.gesture('cheer', 1); if (Math.random() < 0.4) sayLine(s.occ, key); } });
}
function land(m, f, o, dmg) {
  if (o.act === 'ko') return;
  if (Math.random() < 0.22) { o.act = 'block'; o.actT = 0.3; return; }
  o.hp = Math.max(0, o.hp - dmg); o.act = 'hit'; o.actT = 0.3; o.x = clamp(o.x + f.dir * 0.035);
  m.sparks.push({ x: (f.x + o.x) / 2 + f.dir * 0.03, y: 0.52, t: 0.25, c: f.col[1] });
  if (f.person && Math.random() < 0.08) sayLine(f.person, 'fight.hit');
  if (o.person && Math.random() < 0.08) sayLine(o.person, 'fight.hurt');
  if (o.hp <= 0) knockOut(m, f, o);
}
function knockOut(m, w, l) {
  l.act = 'ko'; l.actT = 99; w.act = 'idle'; w.score++;
  m.ko = 2.4; m.koText = 'K.O.'; m.shots.length = 0;
  if (w.person) { if (Math.random() < 0.6) sayLine(w.person, 'fight.ko'); w.person.gesture('cheer', 1.6); }
  if (l.person) { if (Math.random() < 0.5) sayLine(l.person, 'fight.lose'); l.person.gesture('facepalm', 1.4); }
  cheerSpectators('fight.spectator', 0.5);
  if (Math.random() < 0.15) sayLine(S.owner, 'owner.gameReact');
}
function attack(m, f, o) {
  const dist = Math.abs(o.x - f.x), human = f.person ? 0.06 : 0, r = Math.random();
  if (r < 0.42) { f.act = 'punch'; f.actT = 0.25; if (dist < 0.19 && Math.random() < 0.6 + human) land(m, f, o, 6 + Math.random() * 4); }
  else if (r < 0.8) { f.act = 'kick'; f.actT = 0.35; if (dist < 0.23 && Math.random() < 0.5 + human) land(m, f, o, 9 + Math.random() * 5); }
  else {
    f.act = 'special'; f.actT = 0.5;
    m.shots.push({ x: f.x + f.dir * 0.07, dir: f.dir, from: f, to: o, t: 0 });
    if (f.person && Math.random() < 0.5) sayLine(f.person, 'fight.special', { fighter: f.fighter });
  }
  f.cool = rand(0.45, 1.05);
}
function endRound(m) {
  const { home, away } = m;
  for (const f of [home, away]) if (f.score >= 2) {
    m.final = 3.6;
    const l = f === home ? away : home;
    if (f.person) { f.person.p.wins++; f.person.gesture('cheer', 2.2); }
    if (l.person) l.person.p.losses++;
    return;
  }
  m.round++; m.t = ROUND; m.intro = 1.6;
  home.hp = away.hp = 100; home.x = 0.3; away.x = 0.7; home.act = away.act = 'idle'; home.actT = away.actT = 0;
}
export function stepFight(m, dt, end) {
  m.clock += dt;
  m.sparks = m.sparks.filter(s => (s.t -= dt) > 0);
  if (m.final > 0) { m.final -= dt; if (m.final <= 0) end(); return; }
  if (m.intro > 0) { m.intro -= dt; return; }
  if (m.ko > 0) { m.ko -= dt; if (m.ko <= 0) endRound(m); return; }
  m.t -= dt;
  if (m.t <= 0) {   // time up: more health left wins the round
    const w = m.home.hp >= m.away.hp ? m.home : m.away, l = w === m.home ? m.away : m.home;
    w.score++; m.ko = 2; m.koText = 'TIME'; l.act = 'hit'; l.actT = 0.4;
    return;
  }
  for (const [f, o] of [[m.home, m.away], [m.away, m.home]]) {
    if (f.actT > 0) { f.actT -= dt; if (f.actT <= 0 && f.act !== 'ko') f.act = 'idle'; }
    if (f.act !== 'idle' && f.act !== 'walk') continue;
    const dist = Math.abs(o.x - f.x);
    if (dist > 0.2) { f.act = 'walk'; f.x = clamp(f.x + f.dir * dt * 0.13); f.walk += dt * 9; }
    else { f.act = 'idle'; if (dist < 0.12) f.x = clamp(f.x - f.dir * dt * 0.08); }
    f.cool -= dt;
    if (f.cool <= 0) attack(m, f, o);
  }
  for (const s of m.shots) {
    s.x += s.dir * dt * 0.55; s.t += dt;
    if (Math.abs(s.x - s.to.x) < 0.05) { s.done = true; if (Math.random() < 0.75) land(m, s.from, s.to, 14 + Math.random() * 5); }
    if (s.x < 0 || s.x > 1) s.done = true;
  }
  m.shots = m.shots.filter(s => !s.done);
  if (Math.random() < dt * 0.15) cheerSpectators('fight.spectator', 0.3);
}
export const fightClock = m => (m.final > 0 ? 'FINAL' : `R${m.round} ${Math.max(0, Math.ceil(m.t))}`);

// ---------------------------------------------------------------- drawing (640x360 coordinates)
const FLOOR = 300, U = 6;   // feet line, and one sprite pixel in screen units
function stage(g, t) {
  const sky = g.createLinearGradient(0, 0, 0, FLOOR);
  sky.addColorStop(0, '#2a1d4a'); sky.addColorStop(0.6, '#a8436a'); sky.addColorStop(1, '#f08a24');
  g.fillStyle = sky; g.fillRect(0, 0, 640, FLOOR);
  g.fillStyle = '#ffd23f'; g.fillRect(470, 70, 48, 48);                                          // setting sun
  g.fillStyle = '#3a2440';                                                                        // rooftops and a pagoda on the skyline
  for (let x = 0; x < 640; x += 40) g.fillRect(x, 190 + ((x * 7) % 50), 38, 200);
  g.fillRect(110, 120, 60, 80); g.fillRect(96, 116, 88, 8); g.fillRect(118, 92, 44, 28); g.fillRect(104, 88, 72, 6); g.fillRect(130, 70, 20, 22);
  for (let i = 0; i < 6; i++) { g.fillStyle = Math.sin(t * 3 + i) > 0 ? '#ff4f7b' : '#c0282d'; g.fillRect(40 + i * 104, 150 + (i % 2) * 14, 10, 14); }   // lanterns
  g.fillStyle = '#5a3a22'; g.fillRect(0, FLOOR, 640, 60);                                       // wooden floor
  g.fillStyle = '#4a2e1a'; for (let x = 0; x < 640; x += 64) g.fillRect(x, FLOOR, 4, 60);
  g.fillStyle = '#6b4a2e'; g.fillRect(0, FLOOR, 640, 4);
}
function fighter(g, f, t) {
  const cx = 40 + f.x * 560, d = f.dir, [gi, trim, hair] = f.col;
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(cx + (d > 0 ? x : -x - w) * U, FLOOR - (y + h) * U, w * U, h * U); };
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(cx - 5 * U, FLOOR - 4, 10 * U, 6);
  if (f.act === 'ko') {   // flat on the floor
    px(-7, 0, 14, 3, gi); px(7, 0, 4, 3, f.skin); px(9, 2, 3, 2, hair); px(-1, 0, 2, 3, trim); return;
  }
  const bob = f.act === 'idle' ? Math.round(Math.sin(t * 6) * 0.5) : 0;
  const lean = f.act === 'hit' ? -1 : 0;
  const step = f.act === 'walk' ? Math.round(Math.sin(f.walk) * 1.5) : 0;
  // legs
  if (f.act === 'kick') { px(-2, 0, 2, 7, gi); px(0, 5, 9, 2, gi); px(9, 5, 2, 2, f.skin); }
  else { px(-3 + step, 0, 2, 7, gi); px(1 - step, 0, 2, 7, gi); px(-3 + step, 0, 2, 1, '#1f1c27'); px(1 - step, 0, 2, 1, '#1f1c27'); }
  // body, belt, head
  px(-3 + lean, 7 + bob, 6, 7, gi); px(-3 + lean, 9 + bob, 6, 1, trim);
  px(-2 + lean, 14 + bob, 4, 4, f.skin); px(-2 + lean, 17 + bob, 4, 2, hair); px(1 + lean, 15 + bob, 1, 1, '#111');
  px(-3 + lean, 17 + bob, 6, 1, trim);                                                             // headband
  // arms
  const a = f.act;
  if (a === 'punch') { px(2 + lean, 12 + bob, 7, 2, gi); px(9 + lean, 12 + bob, 2, 2, trim); px(-4 + lean, 10 + bob, 2, 3, trim); }
  else if (a === 'special') { px(2, 11 + bob, 6, 2, gi); px(2, 13 + bob, 6, 2, gi); px(8, 11 + bob, 2, 4, trim); }
  else if (a === 'block') { px(1, 12 + bob, 2, 5, trim); px(-1, 14 + bob, 4, 2, gi); }
  else { px(2 + lean, 10 + bob, 2, 4, gi); px(3 + lean, 13 + bob, 2, 2, trim); px(-4 + lean, 10 + bob, 2, 4, gi); px(-4 + lean, 9 + bob, 2, 2, trim); }
}
function bar(g, x, w, hp, right, name, wins) {
  g.fillStyle = '#000'; g.fillRect(x - 3, 15, w + 6, 22);
  g.fillStyle = '#c0282d'; g.fillRect(x, 18, w, 16);
  const fillW = Math.round(w * hp / 100);
  g.fillStyle = hp > 30 ? '#ffd23f' : '#ff7a1f'; g.fillRect(right ? x + w - fillW : x, 18, fillW, 16);
  g.font = `20px ${DOT}`; g.fillStyle = '#fff'; g.textAlign = right ? 'right' : 'left'; g.fillText(name, right ? x + w : x, 60);
  for (let i = 0; i < 2; i++) { g.fillStyle = i < wins ? '#ffd23f' : '#3a2a1e'; g.fillRect(right ? x + w - 16 - i * 20 : x + i * 20, 68, 14, 10); }
}
export function drawFight(g, m, t) {
  stage(g, t);
  m.shots.forEach(s => {
    const x = 40 + s.x * 560, c = s.from.col[1], r = 10 + Math.sin(s.t * 30) * 2;
    g.fillStyle = '#fff'; g.fillRect(x - r / 2, 212 - r / 2, r, r); g.fillStyle = c; g.fillRect(x - r, 212 - r * 0.6, r * 2, r * 1.2);
  });
  fighter(g, m.home, t); fighter(g, m.away, t);
  m.sparks.forEach(s => { const x = 40 + s.x * 560, k = 1 + (0.25 - s.t) * 30; g.fillStyle = s.c; g.fillRect(x - 2, 210 - 4 * k, 4, 8 * k); g.fillRect(x - 4 * k, 208, 8 * k, 4); });
  bar(g, 30, 250, m.home.hp, false, m.home.fighter, m.home.score);
  bar(g, 360, 250, m.away.hp, true, m.away.fighter, m.away.score);
  g.fillStyle = '#000'; g.fillRect(292, 10, 56, 34); g.fillStyle = '#ffd23f'; g.font = `20px ${PIX}`; g.textAlign = 'center';
  g.fillText(m.final > 0 ? '--' : String(Math.max(0, Math.ceil(m.t))), 320, 38);
  g.font = `22px ${DOT}`; g.fillStyle = '#fff';
  g.textAlign = 'left'; g.fillText('1P ' + m.home.name, 12, 352); g.textAlign = 'right'; g.fillText(m.away.name + ' 2P', 628, 352);
  let text = '';
  if (m.final > 0) text = `${(m.home.score > m.away.score ? m.home : m.away).fighter} WINS`;
  else if (m.ko > 0) text = m.koText;
  else if (m.intro > 0) text = m.intro > 0.7 ? `ROUND ${m.round}` : 'FIGHT!';
  if (text) {
    g.textAlign = 'center'; g.font = m.final > 0 ? `40px ${DOT}` : `44px ${PIX}`;
    g.fillStyle = '#000'; g.fillText(text, 324, 174); g.fillStyle = m.ko > 0 ? '#ff4f7b' : '#ffd23f'; g.fillText(text, 320, 170);
  }
}
