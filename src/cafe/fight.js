// 快打旋風 on the TV, as a tiny 8-bit one-on-one match, best of three rounds; each fighter is drawn in its own colours.
import { S } from './state.js';
import { rand, pick, DOT, PIX } from './util.js';
import { sayLine } from './content.js';
import { log } from './feed.js';
import { SF_FIGHTERS, FIGHTER_NAMES } from '../content/catalog';

const ROUND = 25;   // simulated seconds per round
// gi, trim (belt, gloves, energy), hair; picked by the character's name
const PALETTES = [
  ['#f4efe3', '#c0282d', '#2a1a10'], ['#c0282d', '#ffd23f', '#111111'], ['#1c4fd6', '#f4efe3', '#d9b48a'], ['#2e8b57', '#ffd23f', '#3a2a1e'],
  ['#1f1c27', '#ff4f7b', '#e8e4dc'], ['#f08a24', '#1f1c27', '#8a5a3a'], ['#9b6bff', '#7ec8ff', '#111111'], ['#e8c34a', '#c0282d', '#5a3a22'],
];
const hashOf = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
const paletteOf = name => PALETTES[hashOf(name) % PALETTES.length];
const SKINS = ['#f1c9a5', '#e0ac80', '#c68a5e', '#8d5a3b'];

const LOOKS = Object.fromEntries(SF_FIGHTERS.map(f => [f.name, { col: f.col, skin: f.skin }]));
function side(person, fighter, x, dir) {
  return {
    person, name: person ? person.p.name : 'CPU', team: fighter, fighter, score: 0,
    hp: 100, x, dir, act: 'idle', actT: 0, cool: rand(0.5, 1), walk: 0,
    ...(LOOKS[fighter] || { col: paletteOf(fighter), skin: SKINS[hashOf(fighter + '*') % SKINS.length] }),
  };
}

// a side for a match a visitor plays in the game window, named however the window likes
export const fighterSide = (name, fighter, x, dir) => ({ ...side(null, fighter, x, dir), name });

export function startFight(h, a) {
  const roster = FIGHTER_NAMES;
  const hf = h.p.fighter || pick(roster);
  let af = a ? a.p.fighter || pick(roster) : pick(roster.filter(f => f !== hf).concat(roster.length < 2 ? [hf] : []));
  const m = { kind: 'fight', home: side(h, hf, 0.3, 1), away: side(a, af, 0.7, -1), round: 1, t: ROUND, intro: 1.8, ko: 0, koText: '', final: 0, shots: [], sparks: [], clock: 0 };
  if (a) sayLine(h, 'fight.challenge', { opponent: a.p.name, fighter: hf }); else sayLine(h, 'fight.vsCpu', { fighter: hf });
  log(a ? `快打旋風：${h.p.name}（${hf}）對上 ${a.p.name}（${af}）` : `快打旋風：${h.p.name} 用${hf}打電腦`);
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
const shade = (hex, k) => {   // a colour made lighter (k > 0) or darker (k < 0)
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)));
  return `rgb(${c.join(',')})`;
};
// a temple courtyard at sunset: layered sky, far hills, the city with lit windows, a pagoda and a torii, a crowd behind the
// rope cheering, paper lanterns swaying on a string, and a polished wooden floor
function stage(g, t, cheer) {
  const sky = g.createLinearGradient(0, 0, 0, FLOOR);
  sky.addColorStop(0, '#1d1640'); sky.addColorStop(0.45, '#6a2f6e'); sky.addColorStop(0.8, '#e0604a'); sky.addColorStop(1, '#f6a03c');
  g.fillStyle = sky; g.fillRect(0, 0, 640, FLOOR);
  g.fillStyle = '#f4efe3'; for (let i = 0; i < 24; i++) if (Math.sin(t * 2 + i * 7) > -0.3) g.fillRect((i * 137) % 640, (i * 53) % 90, 3, 3);   // stars, twinkling
  g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(480, 150, 40, 0, Math.PI * 2); g.fill();                    // the setting sun, banded
  g.fillStyle = '#f6a03c'; [158, 168, 176].forEach((y, i) => g.fillRect(436, y, 88, 3 + i));
  g.fillStyle = '#8a3d6a'; g.beginPath(); g.moveTo(0, 200);                                                  // far hills
  for (let x = 0; x <= 640; x += 32) g.lineTo(x, 175 + Math.sin(x / 70) * 18 + Math.sin(x / 23) * 6);
  g.lineTo(640, 260); g.lineTo(0, 260); g.fill();
  for (let x = 0; x < 640; x += 40) {                                                                         // the city, with windows lit
    const h = 60 + ((x * 7) % 50); g.fillStyle = '#3a2440'; g.fillRect(x, FLOOR - h - 40, 38, h + 40);
    g.fillStyle = '#ffcf6a'; for (let k = 0; k < 4; k++) if ((x * 13 + k * 7) % 5 < 2) g.fillRect(x + 6 + (k % 2) * 16, FLOOR - h - 30 + Math.floor(k / 2) * 18, 6, 8);
  }
  g.fillStyle = '#2a1a32';                                                                                    // the pagoda
  [[120, 150, 64, 70], [112, 144, 80, 8], [124, 110, 56, 36], [108, 104, 88, 8], [132, 78, 40, 28], [118, 72, 68, 7], [148, 46, 8, 26]].forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
  g.fillStyle = '#c0282d'; g.fillRect(560, 150, 10, 110); g.fillRect(610, 150, 10, 110); g.fillRect(548, 150, 84, 10); g.fillRect(542, 140, 96, 8); g.fillRect(556, 170, 68, 6);   // a torii
  // the crowd behind the rope, jumping when there's something to cheer
  for (let i = 0; i < 40; i++) {
    const x = i * 16 + (i % 3) * 3, j = cheer && Math.sin(t * 12 + i * 1.7) > 0.3 ? 5 : Math.round(Math.sin(t * 2 + i) * 1);
    g.fillStyle = ['#2b2340', '#3a2a52', '#1f1a30'][i % 3]; g.fillRect(x, 262 - j, 14, 38);
    g.fillStyle = ['#c68a5e', '#e0ac80', '#8d5a3b', '#f1c9a5'][i % 4]; g.fillRect(x + 3, 252 - j, 9, 10);
    if (cheer && i % 4 === 0) g.fillRect(x - 2, 240 - j, 3, 14);
  }
  g.fillStyle = '#c9a36a'; g.fillRect(0, 276, 640, 3);                                                         // the rope
  // lanterns swaying on their string
  g.strokeStyle = '#1a1020'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 30); g.quadraticCurveTo(320, 70, 640, 30); g.stroke();
  for (let i = 0; i < 7; i++) {
    const x = 40 + i * 93, y = 30 + Math.sin(x / 640 * Math.PI) * 20, sw = Math.sin(t * 2 + i) * 3;
    g.fillStyle = '#1a1020'; g.fillRect(x + sw - 1, y, 2, 8);
    g.fillStyle = Math.sin(t * 3 + i) > 0 ? '#ff4f7b' : '#e8343f'; g.fillRect(x + sw - 9, y + 8, 18, 22);
    g.fillStyle = '#ffd23f'; g.fillRect(x + sw - 9, y + 8, 18, 3); g.fillRect(x + sw - 9, y + 27, 18, 3);
  }
  // the floor: planks running away, a sheen, the fighters' line
  g.fillStyle = '#6b4226'; g.fillRect(0, FLOOR, 640, 60);
  g.fillStyle = '#5a361e'; for (let x = -320; x < 960; x += 48) { g.beginPath(); g.moveTo(x, FLOOR); g.lineTo(x + 3, FLOOR); g.lineTo(320 + (x + 3 - 320) * 1.6, 360); g.lineTo(320 + (x - 320) * 1.6, 360); g.fill(); }
  g.fillStyle = 'rgba(255,200,140,.12)'; g.fillRect(0, FLOOR + 10, 640, 8);
  g.fillStyle = '#8a5a34'; g.fillRect(0, FLOOR, 640, 4);
}

// one fighter, an outlined 8-bit sprite: stance, walk, punch, kick, block, special, hit (flashing) and down
function fighter(g, f, t) {
  const cx = 40 + f.x * 560, d = f.dir, [gi, trim, hair] = f.col;
  const flash = f.act === 'hit' && Math.floor(t * 30) % 2 === 0;
  const giD = flash ? '#ffffff' : shade(gi, -0.28), giL = flash ? '#ffffff' : gi, skin = flash ? '#ffffff' : f.skin, skinD = flash ? '#ffffff' : shade(f.skin, -0.2);
  const tr = flash ? '#ffffff' : trim;
  const rects = [];
  const px = (x, y, w, h, c) => rects.push([cx + (d > 0 ? x : -x - w) * U, FLOOR - (y + h) * U, w * U, h * U, c]);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, FLOOR + 2, 7 * U, 1.4 * U, 0, 0, Math.PI * 2); g.fill();
  if (f.act === 'ko') {   // flat on his back
    px(-8, 0, 12, 2.5, giL); px(-8, 2, 12, 0.6, giD); px(-2, 0, 1, 2.5, tr); px(4, 0, 4, 3, skin); px(7, 1, 2, 2.5, hair); px(-11, 0, 3, 1.5, skin);
  } else {
    const a = f.act, bob = a === 'idle' ? Math.round(Math.sin(t * 6) * 0.5) : 0, lean = a === 'hit' ? -1.5 : a === 'kick' ? -1 : a === 'punch' ? 0.5 : 0;
    const step = a === 'walk' ? Math.sin(f.walk) * 1.5 : 0, B = bob;
    // legs: back one in shadow; a kick throws the front one out level
    px(-5 + step, 0, 3, 1, skin); px(-4.5 + step, 1, 2.5, 7, giD);                              // back foot and leg
    if (a === 'kick') { px(0, 8, 9, 2.5, giL); px(9, 8, 3, 2.5, skin); px(0.5, 7.5, 1.5, 3, giL); }
    else { px(1 - step, 0, 3, 1, skin); px(1 - step, 1, 2.5, 7, giL); }
    // hips, the belt with its knot and tails, the jacket with the chest showing
    px(-4 + lean, 7 + B, 7, 2, giL); px(-3.5 + lean, 9 + B, 6.5, 1, tr); px(-4.5 + lean, 7.5 + B, 1, 2, tr);
    px(-3.5 + lean, 10 + B, 6.5, 5, giL); px(-3.5 + lean, 10 + B, 1.5, 5, giD); px(0.5 + lean, 12 + B, 2, 3, skinD);
    // head: face, eye, brow, hair with a spike, the headband and its tails streaming behind
    const H = 15 + B, hx = lean + (a === 'hit' ? -0.5 : 0);
    px(-1 + hx, H, 4, 4, skin); px(2 + hx, H + 1.8, 0.7, 0.8, '#111'); px(1.5 + hx, H + 2.8, 1.5, 0.4, '#111');
    px(-1.5 + hx, H + 3.5, 4.5, 1.5, hair); px(-2 + hx, H + 2.5, 1, 2, hair); px(1 + hx, H + 5, 1.5, 0.8, hair);
    px(-1.5 + hx, H + 3, 4.5, 0.8, tr);
    const wave = Math.sin(t * 10) * 0.5;
    px(-3.5 + hx, H + 2.6 + wave, 2, 0.6, tr); px(-5 + hx, H + 2.3 - wave, 1.5, 0.6, tr);
    // arms
    if (a === 'punch') { px(-2.5 + lean, 12 + B, 2, 2, giD); px(1 + lean, 12.5 + B, 8, 2, giL); px(9 + lean, 12 + B, 2.5, 3, tr); }
    else if (a === 'special') { px(1, 11.5 + B, 7, 2, giL); px(1, 13.5 + B, 7, 2, giD); px(8, 11.5 + B, 2, 4, skin); }
    else if (a === 'block') { px(1.5, 11 + B, 2, 6, giL); px(3, 15 + B, 2.5, 2.5, tr); px(2.5, 12 + B, 2.5, 2.5, tr); }
    else if (a === 'hit') { px(-4 + lean, 11 + B, 2, 3.5, giD); px(1 + lean, 10.5 + B, 2, 3.5, giL); px(1 + lean, 9.5 + B, 2, 1.5, tr); }
    else {   // guard: fists up
      px(-2 + lean, 11.5 + B, 3, 2, giD); px(1 + lean, 13 + B, 2, 2.5, tr);
      px(2 + lean, 11 + B, 3, 2, giL); px(4.5 + lean, 12.5 + B, 2.5, 2.5, tr);
    }
  }
  g.fillStyle = '#0d0a12'; rects.forEach(([x, y, w, h]) => g.fillRect(x - 2, y - 2, w + 4, h + 4));   // the outline
  rects.forEach(([x, y, w, h, c]) => { g.fillStyle = c; g.fillRect(x, y, w, h); });
  if (f.act === 'punch' && f.actT > 0.1) { g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 3; i++) g.fillRect(cx + d * (2 + i * 2) * U - (d < 0 ? 4 * U : 0), FLOOR - (12.8 + i * 0.6) * U, 4 * U, 3); }   // speed lines
}
// a health bar: bevelled, the damage just taken showing red before it drains, the name and round wins under it
function bar(g, f, x, w, right) {
  f.lag = f.lag == null || f.lag < f.hp ? f.hp : Math.max(f.hp, f.lag - 0.6);
  g.fillStyle = '#0d0a12'; g.fillRect(x - 4, 12, w + 8, 26);
  g.fillStyle = '#4a1418'; g.fillRect(x, 16, w, 18);
  const fill = v => Math.round(w * v / 100), at = v => (right ? x + w - fill(v) : x);
  g.fillStyle = '#ff4f4f'; g.fillRect(at(f.lag), 16, fill(f.lag), 18);
  g.fillStyle = f.hp > 30 ? '#ffd23f' : '#ff7a1f'; g.fillRect(at(f.hp), 16, fill(f.hp), 18);
  g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(at(f.hp), 16, fill(f.hp), 4);
  g.font = `20px ${DOT}`; g.fillStyle = '#000'; g.textAlign = right ? 'right' : 'left';
  g.fillText(f.fighter, (right ? x + w : x) + 2, 62); g.fillStyle = '#fff'; g.fillText(f.fighter, right ? x + w : x, 60);
  for (let i = 0; i < 2; i++) {   // a V for each round won
    const bx = right ? x + w - 18 - i * 22 : x + i * 22;
    g.fillStyle = '#0d0a12'; g.fillRect(bx - 2, 66, 18, 14); g.fillStyle = i < f.score ? '#ffd23f' : '#3a2a1e'; g.fillRect(bx, 68, 14, 10);
    if (i < f.score) { g.fillStyle = '#c0282d'; g.fillRect(bx + 3, 70, 2, 4); g.fillRect(bx + 9, 70, 2, 4); g.fillRect(bx + 5, 74, 4, 2); }
  }
}
// a starburst where a blow lands
function spark(g, x, y, k, c) {
  g.fillStyle = c; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = (i % 2 ? 10 : 18) * k; g.fillRect(x + Math.cos(a) * r - 3, y + Math.sin(a) * r - 3, 6, 6); }
  g.fillStyle = '#fff'; g.fillRect(x - 6 * k, y - 6 * k, 12 * k, 12 * k);
}
export function drawFight(g, m, t) {
  stage(g, t, m.ko > 0 || m.final > 0);
  m.shots.forEach(s => {   // a fireball: a glowing core, flames trailing behind
    const x = 40 + s.x * 560, c = s.from.col[1], r = 12 + Math.sin(s.t * 30) * 2;
    for (let i = 1; i <= 4; i++) { g.globalAlpha = 0.5 - i * 0.1; g.fillStyle = c; g.fillRect(x - s.dir * i * 14 - r * 0.6, 216 - r * 0.6 + Math.sin(s.t * 40 + i) * 3, r * 1.2, r * 1.2); }
    g.globalAlpha = 1;
    g.fillStyle = '#0d0a12'; g.fillRect(x - r - 3, 216 - r * 0.7 - 3, r * 2 + 6, r * 1.4 + 6);
    g.fillStyle = c; g.fillRect(x - r, 216 - r * 0.7, r * 2, r * 1.4); g.fillStyle = '#fff'; g.fillRect(x - r / 2, 216 - r * 0.35, r, r * 0.7);
  });
  [m.home, m.away].sort((a, b) => (a.act === 'ko') - (b.act === 'ko')).reverse().forEach(f => fighter(g, f, t));
  m.sparks.forEach(s => spark(g, 40 + s.x * 560, 212, 1 + (0.25 - s.t) * 3, s.c));
  bar(g, m.home, 26, 254, false); bar(g, m.away, 360, 254, true);
  // the clock between the bars
  g.fillStyle = '#0d0a12'; g.fillRect(288, 6, 64, 42); g.fillStyle = '#1f1c27'; g.fillRect(292, 10, 56, 34);
  g.fillStyle = m.t < 10 && m.final <= 0 ? '#ff4f7b' : '#ffd23f'; g.font = `22px ${PIX}`; g.textAlign = 'center';
  g.fillText(m.final > 0 ? '--' : String(Math.max(0, Math.ceil(m.t))).padStart(2, '0'), 320, 38);
  g.font = `20px ${DOT}`; g.fillStyle = '#fff';
  g.textAlign = 'left'; g.fillText('1P ' + m.home.name, 12, 352); g.textAlign = 'right'; g.fillText(m.away.name + ' 2P', 628, 352);
  let text = '';
  if (m.final > 0) text = `${(m.home.score > m.away.score ? m.home : m.away).fighter} WINS`;
  else if (m.ko > 0) text = m.koText;
  else if (m.intro > 0) text = m.intro > 0.7 ? `ROUND ${m.round}` : 'FIGHT!';
  if (text) {
    const big = m.ko > 0 && m.koText === 'K.O.';
    g.textAlign = 'center'; g.font = m.final > 0 ? `40px ${DOT}` : `${big ? 64 : 44}px ${PIX}`;
    const y = big ? 190 : 170, k = big ? 1 + Math.max(0, m.ko - 1.8) : 1;
    g.save(); g.translate(320, y); g.scale(k, k);
    g.fillStyle = '#0d0a12'; for (const [ox, oy] of [[-4, 0], [4, 0], [0, -4], [0, 4], [5, 5]]) g.fillText(text, ox, oy);
    g.fillStyle = m.ko > 0 ? '#ff4f7b' : '#ffd23f'; g.fillText(text, 0, 0);
    g.restore();
  }
}
