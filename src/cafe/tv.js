// The TV: an NBA 2K match or the fighting game (fight.js), each a tiny simulation drawn at 320x180 for the 8-bit look.
import * as THREE from 'three';
import { ctx } from './engine.js';
import { S } from './state.js';
import { rand, randi, pick, lerp, DOT, PIX } from './util.js';
import { TVX, TVY, TVZ } from './layout.js';
import { TEAMS, TEAM_NAMES } from './profiles.js';
import { sayLine } from './content.js';
import { log, renderResults } from './feed.js';
import { startFight, stepFight, drawFight, fightClock } from './fight.js';

export const QLEN = 30;   // simulated seconds per quarter
const TVW = 320, TVH = 180;
let tvCtx, tvTex, crowd;

// the screen itself; built with the rest of the set so it gets squeezed with it
export function createTvScreen() {
  const canvas = document.createElement('canvas'); canvas.width = TVW; canvas.height = TVH;
  tvCtx = canvas.getContext('2d'); tvCtx.imageSmoothingEnabled = false;
  tvTex = new THREE.CanvasTexture(canvas); tvTex.encoding = THREE.sRGBEncoding; tvTex.magFilter = THREE.NearestFilter; tvTex.minFilter = THREE.NearestFilter; tvTex.generateMipmaps = false;
  S.tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.91), new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false }));
  S.tvScreen.position.set(TVX + 0.075, TVY, TVZ); S.tvScreen.rotation.y = Math.PI / 2; ctx.scene.add(S.tvScreen);
  const tvGlow = new THREE.PointLight(0x7fb0ff, 0.45, 4, 2); tvGlow.position.set(-2.3, 1.5, TVZ); ctx.scene.add(tvGlow);
  crowd = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), c: pick(['#ff4f7b', '#ffd23f', '#7ec8ff', '#3ddc97', '#f4efe3', '#9b6bff']) }));
}

// ---------------------------------------------------------------- logic
const makeSide = (person, team) => ({ person, name: person ? person.p.name : 'CPU', team, score: 0 });
function startMatch() {
  const tv = S.tv;
  const ready = S.seats.gameSeats.map(s => s.occ).filter(o => o && o.ready);
  if (!ready.length) return;
  const h = ready[0], a = ready[1] || null;
  if (S.tv.game === 'fight') { tv.match = startFight(h, a); return; }
  const ht = h.p.team;
  let at = a ? a.p.team : pick(TEAM_NAMES.filter(t => t !== ht));
  if (a && at === ht) { at = pick(TEAM_NAMES.filter(t => t !== ht)); sayLine(a, 'game.teamClash', { team: at }); }
  const dots = [];
  for (let side = 0; side < 2; side++) for (let i = 0; i < 5; i++) dots.push({ side, i, x: side ? 0.6 : 0.4, y: 0.2 + i * 0.15, num: randi(0, 35) });
  tv.match = { kind: 'nba', home: makeSide(h, ht), away: makeSide(a, at), q: 1, t: QLEN, poss: 0, holder: 0, flight: null, next: 1, passes: randi(1, 3), dots, final: 0, jit: 0 };
  if (a) sayLine(h, 'game.challenge', { opponent: a.p.name, name: h.p.name }); else sayLine(h, 'game.vsCpu', { name: h.p.name });
  log(a ? `${h.p.name}（${ht}）對上 ${a.p.name}（${at}）` : `${h.p.name} 用${ht}打電腦`);
}
const hoopFor = side => side === 0 ? { x: 0.955, y: 0.5 } : { x: 0.045, y: 0.5 };
const OFF = [[0.7, 0.5], [0.78, 0.14], [0.78, 0.86], [0.9, 0.28], [0.9, 0.72]];
function react(side, pts) {
  const m = S.tv.match; const sc = side ? m.away : m.home, other = side ? m.home : m.away;
  if (sc.person && Math.random() < (pts === 3 ? 0.7 : 0.3)) { sayLine(sc.person, pts === 3 ? 'game.score3' : 'game.score2'); if (pts === 3) sc.person.gesture('cheer', 1.2); }
  else if (other.person && Math.random() < 0.25) { sayLine(other.person, 'game.conceded'); other.person.gesture('facepalm', 1.2); }
  S.seats.specSpots.forEach(s => { if (s.occ && Math.random() < 0.3) { s.occ.gesture('cheer', 1); if (Math.random() < 0.4) sayLine(s.occ, 'game.spectator'); } });
  if (Math.random() < 0.08) sayLine(S.owner, 'owner.gameReact');
}
function stepMatch(dt) {
  const tv = S.tv, m = tv.match;
  if (m.final > 0) { m.final -= dt; if (m.final <= 0) endMatch(); return; }
  m.t -= dt;
  if (m.t <= 0) {
    if (m.q >= 4 && m.home.score !== m.away.score) {
      m.final = 4; m.t = 0;
      const win = m.home.score > m.away.score ? m.home : m.away, lose = win === m.home ? m.away : m.home;
      if (win.person) { sayLine(win.person, 'game.win'); win.person.gesture('cheer', 2.2); win.person.p.wins++; }
      if (lose.person) { sayLine(lose.person, 'game.lose'); lose.person.gesture('facepalm', 2); lose.person.p.losses++; }
      return;
    }
    m.q++; m.t = m.q > 4 ? QLEN / 2 : QLEN;
    tv.flash = { text: m.q > 4 ? 'OVERTIME' : `Q${m.q}`, t: 1.2 };
  }
  m.jit -= dt;
  const off = m.poss;
  if (m.jit <= 0) { m.jit = 0.8; m.dots.forEach(d => d.j = [rand(-0.04, 0.04), rand(-0.06, 0.06)]); }
  m.dots.forEach(d => {
    const j = d.j || [0, 0];
    let [ox, oy] = OFF[d.i];
    if (off === 1) ox = 1 - ox;
    let tx, ty;
    if (d.side === off) { tx = ox + j[0]; ty = oy + j[1]; }
    else { const h = hoopFor(off); tx = lerp(ox, h.x, 0.3) + j[0] * 0.5; ty = lerp(oy, h.y, 0.3) + j[1] * 0.5; }
    d.x += (tx - d.x) * Math.min(1, dt * 2.6); d.y += (ty - d.y) * Math.min(1, dt * 2.6);
  });
  const team = m.dots.filter(d => d.side === off);
  if (m.flight) {
    const f = m.flight; f.t += dt / f.dur;
    if (f.t >= 1) {
      m.flight = null;
      if (f.kind === 'pass') { m.holder = f.to; m.next = rand(0.25, 0.55); }
      else {
        if (f.made) { (off ? m.away : m.home).score += f.pts; react(off, f.pts); if (f.pts === 3) tv.flash = { text: '3PT!', t: 0.9 }; }
        m.poss = 1 - off; m.holder = 0; m.passes = randi(1, 3); m.next = rand(0.7, 1.0);
      }
    }
    return;
  }
  m.next -= dt;
  if (m.next > 0) return;
  const holder = team[m.holder];
  if (m.passes > 0) {
    let to = randi(0, 4); if (to === m.holder) to = (to + 1) % 5;
    m.passes--;
    m.flight = { kind: 'pass', from: holder, to, t: 0, dur: 0.3 };
  } else {
    const h = hoopFor(off);
    const dist = Math.hypot((holder.x - h.x) * 1.8, holder.y - h.y);
    const pts = dist > 0.33 ? 3 : 2;
    const pct = ((off ? m.away : m.home).person ? 0.52 : 0.47) - (pts === 3 ? 0.14 : 0);
    m.flight = { kind: 'shot', from: holder, to: h, t: 0, dur: 0.55, pts, made: Math.random() < pct };
  }
}
function endMatch() {
  const tv = S.tv, m = tv.match; tv.match = null; tv.startDelay = 2;
  const win = m.home.score > m.away.score ? m.home : m.away, lose = win === m.home ? m.away : m.home;
  tv.results.unshift({ w: win, l: lose, kind: m.kind });
  tv.results.length = Math.min(tv.results.length, 4);
  log(`${m.kind === 'fight' ? '格鬥' : '2K'} 結果：${win.name}（${win.team}）${win.score} : ${lose.score} ${lose.name}`);
  [m.home.person, m.away.person].forEach(p => {
    if (!p || !p.resolveDone) return;
    p.matchesLeft--;
    if (p.matchesLeft <= 0 || S.closing) { const r = p.resolveDone; p.resolveDone = null; r(); }
    else if (Math.random() < 0.6) sayLine(p, m.kind === 'fight' ? 'fight.rematch' : 'game.rematch');
  });
  renderResults();
}
export function updateTV(dt) {
  const tv = S.tv;
  // someone playing the computer drops that game as soon as a second player sits down: straight into a two-player match
  if (tv.match && !tv.match.away.person && S.seats.gameSeats.some(g => g.occ && g.occ.ready && g.occ !== tv.match.home.person)) {
    log(`${tv.match.home.name} 不打電腦了，改成雙人對戰`);
    tv.match = null; tv.startDelay = 0.6; tv.flash = null;
  }
  if (tv.match) { if (tv.match.kind === 'fight') stepFight(tv.match, dt, endMatch); else stepMatch(dt); }
  else { tv.startDelay -= dt; if (tv.startDelay <= 0 && S.seats.gameSeats.some(s => s.occ && s.occ.ready)) startMatch(); }
  if (tv.flash) { tv.flash.t -= dt; if (tv.flash.t <= 0) tv.flash = null; }
  tv.attract += dt;
}
export const matchClock = m => {
  if (m.kind === 'fight') return fightClock(m);
  const secs = Math.max(0, m.t / QLEN * 300);
  return m.final > 0 ? 'FINAL' : `${m.q > 4 ? 'OT' : 'Q' + m.q} ${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
};

// ---------------------------------------------------------------- drawing (640x360 coordinates, scaled down)
function P(x, y) { const top = 92, bot = 334; const half = lerp(225, 305, y); return [320 + (x - 0.5) * 2 * half, top + (bot - top) * y]; }
function poly(g, pts, close) { g.beginPath(); pts.forEach(([x, y], i) => { const [px, py] = P(x, y); i ? g.lineTo(px, py) : g.moveTo(px, py); }); if (close) g.closePath(); }
function arcPts(cx, cy, rx, ry, a0, a1, n = 16) { const r = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); r.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return r; }
export function drawTV() {
  const tv = S.tv, g = tvCtx, W = 640, H = 360;
  g.setTransform(TVW / W, 0, 0, TVH / H, 0, 0);
  const m = tv.match;
  if (!m) {
    g.fillStyle = '#1f1c27'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? '#2c2838' : '#1f1c27'; g.fillRect(0, i * 9 + (tv.attract * 20) % 18 - 18, W, 9); }
    const title = S.tv.game === 'fight' ? 'FIGHT!' : S.tv.game === 'nba' ? 'NBA 2K' : 'GAME';
    g.fillStyle = '#ff4f7b'; g.textAlign = 'center'; g.font = `44px ${PIX}`; g.fillText(title, W / 2, 150);
    g.fillStyle = '#ffd23f';
    if (Math.floor(tv.attract * 1.6) % 2 === 0) { g.font = `20px ${PIX}`; g.fillText('PRESS START', W / 2, 220); }
    g.fillStyle = '#f4efe3'; g.font = `24px ${DOT}`;
    g.fillText(S.seats.gameSeats.some(s => s.occ) ? '玩家入座中…' : '搖桿放著，等人來開一場', W / 2, 300);
    tvTex.needsUpdate = true; return;
  }
  if (m.kind === 'fight') { drawFight(g, m, tv.attract); tvTex.needsUpdate = true; return; }
  g.fillStyle = '#120d12'; g.fillRect(0, 0, W, H);
  crowd.forEach(c => { g.fillStyle = c.c; g.fillRect(Math.floor(c.x * 80) * 8, 44 + Math.floor(c.y * 5) * 9 + (Math.sin(tv.attract * 6 + c.x * 30) > 0.6 && m.final > 0 ? -4 : 0), 6, 6); });
  const tc = TEAMS[m.home.team], ta = TEAMS[m.away.team];
  poly(g, [[-0.04, -0.06], [1.04, -0.06], [1.04, 1.06], [-0.04, 1.06]], true); g.fillStyle = '#c99256'; g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 4;
  poly(g, [[0, 0], [1, 0], [1, 1], [0, 1]], true); g.stroke();
  poly(g, [[0.5, 0], [0.5, 1]]); g.stroke();
  poly(g, arcPts(0.5, 0.5, 0.06, 0.12, 0, Math.PI * 2), true); g.fillStyle = tc.c1; g.fill(); g.stroke();
  [0, 1].forEach(side => {
    const hx = side ? 0.955 : 0.045, dir = side ? -1 : 1, base = side ? 1 : 0;
    poly(g, [[base, 0.36], [base + dir * 0.19, 0.36], [base + dir * 0.19, 0.64], [base, 0.64]], true);
    g.fillStyle = side ? ta.c1 : tc.c1; g.fill(); g.stroke();
    poly(g, [[base, 0.06], [base + dir * 0.1, 0.06]].concat(arcPts(hx, 0.5, 0.25, 0.44, -Math.PI / 2, Math.PI / 2).map(([x, y]) => [hx + dir * (x - hx), y]).filter(([x]) => side ? x < 0.9 : x > 0.1)).concat([[base + dir * 0.1, 0.94], [base, 0.94]])); g.stroke();
    const [rx, ry] = P(hx, 0.5); g.fillStyle = '#ff6a1a'; g.fillRect(rx - 10, ry - 4, 20, 8);
  });
  m.dots.slice().sort((a, b) => a.y - b.y).forEach(d => {
    const [px, py] = P(d.x, d.y); const r = Math.round(lerp(9, 13, d.y) / 2) * 2;
    const t = d.side ? ta : tc;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(px - r, py + r - 2, r * 2, 4);
    g.fillStyle = t.c2; g.fillRect(px - r - 2, py - r - 2, r * 2 + 4, r * 2 + 4);
    g.fillStyle = t.c1; g.fillRect(px - r, py - r, r * 2, r * 2);
  });
  let bx, by, bh = 0;
  const team = m.dots.filter(d => d.side === m.poss);
  if (m.flight) {
    const f = m.flight; const a = f.from, b = f.kind === 'pass' ? team[f.to] : f.to;
    const t = Math.min(1, f.t);
    bx = lerp(a.x, b.x, t); by = lerp(a.y, b.y, t); bh = Math.sin(t * Math.PI) * (f.kind === 'shot' ? 46 : 10);
  } else { const h = team[m.holder] || team[0]; bx = h.x + 0.012; by = h.y + 0.01; bh = Math.abs(Math.sin(tv.attract * 12)) * 8; }
  const [bpx, bpy] = P(bx, by);
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(bpx - 6, bpy + 4, 12, 4);
  g.fillStyle = '#ff7a1f'; g.fillRect(bpx - 6, bpy - bh - 6, 12, 12);
  g.fillStyle = '#4a1d05'; g.fillRect(bpx - 1, bpy - bh - 6, 2, 12);
  // scoreboard
  g.fillStyle = '#000'; g.fillRect(116, 4, 408, 42);
  g.fillStyle = tc.c1; g.fillRect(120, 8, 150, 34); g.fillStyle = ta.c1; g.fillRect(370, 8, 150, 34);
  g.font = `18px ${PIX}`; g.fillStyle = '#fff';
  g.textAlign = 'left'; g.fillText(tc.ab, 128, 34); g.textAlign = 'right'; g.fillText(String(m.home.score), 264, 34);
  g.textAlign = 'left'; g.fillText(String(m.away.score), 376, 34); g.textAlign = 'right'; g.fillText(ta.ab, 512, 34);
  g.textAlign = 'center'; g.font = `12px ${PIX}`; g.fillStyle = '#ffd23f';
  g.fillText(matchClock(m), 320, 32);
  g.font = `22px ${DOT}`; g.fillStyle = '#fff';
  g.textAlign = 'left'; g.fillText('1P ' + m.home.name, 12, 352); g.textAlign = 'right'; g.fillText(m.away.name + ' 2P', 628, 352);
  if (tv.flash || m.final > 0) {
    const text = m.final > 0 ? `${(m.home.score > m.away.score ? m.home : m.away).name} WIN!` : tv.flash.text;
    g.textAlign = 'center'; g.font = m.final > 0 ? `40px ${DOT}` : `40px ${PIX}`;
    g.fillStyle = '#000'; g.fillText(text, 324, 214); g.fillStyle = '#ffd23f'; g.fillText(text, 320, 210);
  }
  tvTex.needsUpdate = true;
}
