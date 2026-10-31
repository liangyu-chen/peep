// Little 8-bit games a visitor can play, each in a window over the café once the camera has closed in on the thing
// played: the TV (pick 快打旋風 against the computer, the same match the TV shows, or a 2K three-point contest) and the
// spinning-top stadium. One at a time. (Darts are thrown at the wall board itself: wallDarts.js.)
import { DOT, PIX, rand, pick } from './util.js';
import { drawFight, fighterSide } from './fight.js';
import { FIGHTER_NAMES } from '../content/catalog';
import { hoopsPlayer, crowd } from './hoops.js';
import { sfx, sfxMuted, toggleSfx } from './sfx.js';
import { mirrorTV, tvPoint } from './tv.js';

const W = 640, H = 360;
let open = null;   // the game showing now

export function closeGame() { if (open) open.close(); }

// kind: 'tv' (the TV's game list), 'fight', 'nba' or 'tops'; onClose runs when the window goes
export function openGame(kind, root, onClose) {
  closeGame();
  let G = GAMES[kind]; if (!G) return;
  const sheet = document.createElement('div'); sheet.className = 'gameSheet';
  sheet.innerHTML = `<section class="win gameWin" role="dialog">
    <div class="gameHead"><h2></h2><button class="gameSound" aria-label="音效"></button><button class="gameClose" aria-label="關閉">✕</button></div>
    <canvas width="${W}" height="${H}"></canvas><p class="gameHelp"></p><div class="gamePad"></div></section>`;
  root.appendChild(sheet);
  const canvas = sheet.querySelector('canvas'), g = canvas.getContext('2d'), pad = sheet.querySelector('.gamePad');
  const offs = [], keys = new Set();
  const listen = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); offs.push(() => el.removeEventListener(ev, fn, opt)); };
  // an on-screen button; with onUp it is held (pressed while the finger or mouse is down)
  const button = (label, onDown, onUp, cls = '') => {
    const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls;
    listen(b, 'pointerdown', e => { e.preventDefault(); onDown(); });
    if (onUp) ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => listen(b, ev, onUp));
    pad.appendChild(b); return b;
  };
  const ctl = { keys, button, pointer: null, restart: null, play: null, close: () => close(), clear: () => { pad.textContent = ''; } };
  listen(window, 'keydown', e => {
    if (e.key === 'Escape') { close(); return; }
    if (!G.keys.includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    if (!keys.has(e.key)) { keys.add(e.key); game.key?.(e.key); }
  }, true);
  listen(window, 'keyup', e => { if (keys.delete(e.key)) e.preventDefault(); }, true);
  const toCanvas = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  listen(canvas, 'pointermove', e => { ctl.pointer = toCanvas(e); });
  listen(canvas, 'pointerdown', e => { e.preventDefault(); ctl.pointer = toCanvas(e); game.tap?.(ctl.pointer); });
  // round the window: closes it; but while the game is on the TV, a tap on the TV's picture is a tap in the game
  const onTV = () => sheet.classList.contains('onTV');
  listen(sheet, 'pointermove', e => { if (e.target === sheet && onTV()) ctl.pointer = tvPoint(e.clientX, e.clientY) || ctl.pointer; });
  listen(sheet, 'pointerdown', e => {
    if (e.target !== sheet) return;
    if (!onTV()) { close(); return; }
    const p = tvPoint(e.clientX, e.clientY); if (p) { e.preventDefault(); ctl.pointer = p; game.tap?.(p); }
  });
  listen(sheet.querySelector('.gameClose'), 'click', () => close());
  const soundBtn = sheet.querySelector('.gameSound'), showSound = () => { soundBtn.textContent = sfxMuted() ? '🔇' : '🔊'; };
  showSound(); listen(soundBtn, 'click', () => { toggleSfx(); showSound(); });
  let game = null, raf = 0, last = performance.now();
  // start a game in this window (the TV's list switches to the one picked)
  ctl.play = k => {
    if (game) sfx('select');
    G = GAMES[k]; ctl.clear(); keys.clear();
    sheet.querySelector('h2').textContent = G.title; sheet.querySelector('.gameHelp').textContent = G.help;
    sheet.querySelector('.gameWin').setAttribute('aria-label', G.title);
    // a TV game shows on the TV itself; on a wide screen, where the TV fills the view, the window shrinks to the
    // controls along the bottom (a narrow phone keeps its own picture too)
    mirrorTV(G.tv ? canvas : null);
    sheet.classList.toggle('onTV', !!G.tv && innerWidth / innerHeight >= 1.2);
    root.classList.toggle('playing', sheet.classList.contains('onTV'));   // the rest of the HUD steps aside
    game = G.start(ctl);
  };
  ctl.restart = () => ctl.play(Object.keys(GAMES).find(k => GAMES[k] === G));
  ctl.play(kind);
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    game.step(dt, now / 1000); game.draw(g, now / 1000);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  function close() { cancelAnimationFrame(raf); offs.forEach(f => f()); sheet.remove(); mirrorTV(null); root.classList.remove('playing'); if (open === api) { open = null; onClose?.(); } }
  const api = { close }; open = api;
}

// ---------------------------------------------------------------- shared drawing
// the darts and tops screens are drawn at half size and blown up, so they come out in chunky pixels
const lowRes = () => { const c = document.createElement('canvas'); c.width = W / 2; c.height = H / 2; const g = c.getContext('2d'); g.setTransform(0.5, 0, 0, 0.5, 0, 0); return { c, g }; };
const blowUp = (g, low) => { g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, H); g.drawImage(low.c, 0, 0, W, H); };
function text(g, s, x, y, size, color, align = 'center', font = PIX) {
  g.font = `${size}px ${font}`; g.textAlign = align;
  g.fillStyle = '#000'; g.fillText(s, x + 3, y + 3); g.fillStyle = color; g.fillText(s, x, y);
}
const shade = (hex, k) => {   // a colour made lighter (k > 0) or darker (k < 0)
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)));
  return `rgb(${c.join(',')})`;
};
const best = (key, score) => {   // a high score kept in this browser
  try { const b = Math.max(score, Number(localStorage.getItem(key)) || 0); localStorage.setItem(key, String(b)); return b; } catch { return score; }
};

// ---------------------------------------------------------------- 快打旋風: you against the computer, best of three
const FIGHT = {
  tv: true,
  title: '玩電動：快打旋風',
  help: '← → 或 A、D 移動；J 出拳、K 踢腿、按住 L 防禦。手機用下面的按鈕。先贏兩回合的獲勝',
  keys: ['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D', 'j', 'k', 'l', 'J', 'K', 'L'],
  start(ctl) {
    const mine = pick(FIGHTER_NAMES), theirs = pick(FIGHTER_NAMES.filter(f => f !== mine).concat(FIGHTER_NAMES.length < 2 ? [mine] : []));
    const P = fighterSide('你', mine, 0.3, 1), C = fighterSide('CPU', theirs, 0.7, -1);
    const m = { home: P, away: C, round: 1, t: 40, intro: 1.8, ko: 0, koText: '', final: 0, shots: [], sparks: [] };
    const input = { left: false, right: false, block: false };
    let cpuT = 1.2, again = false;
    const hold = k => [() => { input[k] = true; }, () => { input[k] = false; }];
    ctl.button('◀', ...hold('left')); ctl.button('▶', ...hold('right'));
    ctl.button('拳', () => attack(P, 'punch'), null, 'hot'); ctl.button('腳', () => attack(P, 'kick'), null, 'hot'); ctl.button('防', ...hold('block'));
    const clamp = x => Math.max(0.08, Math.min(0.92, x));
    const live = () => m.intro <= 0 && m.ko <= 0 && m.final <= 0;
    const busy = f => ['punch', 'kick', 'hit', 'ko'].includes(f.act);
    const spark = (f, o, c) => m.sparks.push({ x: (f.x + o.x) / 2 + f.dir * 0.03, y: 0.52, t: 0.25, c });
    function attack(f, kind) {
      if (!live() || busy(f)) return;
      const o = f === P ? C : P;
      f.act = kind; f.actT = kind === 'punch' ? 0.22 : 0.34;
      const reach = kind === 'punch' ? 0.14 : 0.18, dmg = kind === 'punch' ? 7 : 11;
      if (Math.abs(o.x - f.x) > reach || o.act === 'ko') { sfx('whiff'); return; }
      if (o === C && !busy(C) && Math.random() < 0.3) o.act = 'block';   // the computer sees some of them coming
      if (o.act === 'block') { o.hp = Math.max(0, o.hp - 1); spark(f, o, '#ffffff'); sfx('block'); }
      else { sfx(kind); o.hp = Math.max(0, o.hp - dmg); o.act = 'hit'; o.actT = 0.28; o.x = clamp(o.x + f.dir * 0.04); spark(f, o, f.col[1]); }
      if (o.hp <= 0) { o.act = 'ko'; o.actT = 99; f.act = 'idle'; f.score++; m.ko = 2.2; m.koText = 'K.O.'; sfx('ko'); }
    }
    function nextRound() {
      if (P.score >= 2 || C.score >= 2) { m.final = 99; return; }
      m.round++; m.t = 40; m.intro = 1.6; sfx('start');
      [[P, 0.3], [C, 0.7]].forEach(([f, x]) => Object.assign(f, { hp: 100, x, act: 'idle', actT: 0 }));
    }
    return {
      key(k) { if (k === 'j' || k === 'J') attack(P, 'punch'); if (k === 'k' || k === 'K') attack(P, 'kick'); },
      step(dt) {
        m.sparks.forEach(s => { s.t -= dt; }); m.sparks = m.sparks.filter(s => s.t > 0);
        if (m.final > 0) {
          if (!again) { again = true; sfx(P.score > C.score ? 'win' : 'lose'); ctl.clear(); ctl.button('再來一場', () => ctl.restart(), null, 'hot'); }
          return;
        }
        if (m.intro > 0) m.intro -= dt;
        else if (m.ko > 0) { m.ko -= dt; if (m.ko <= 0) nextRound(); }
        else {
          m.t -= dt;
          if (m.t <= 0) {   // time: whoever has more left takes the round
            const w = P.hp === C.hp ? null : P.hp > C.hp ? P : C;
            if (w) w.score++;
            m.ko = 2.2; m.koText = 'TIME'; sfx('buzzer');
          }
        }
        [P, C].forEach(f => { if (f.act !== 'ko' && f.act !== 'block' && f.actT > 0) { f.actT -= dt; if (f.actT <= 0) f.act = 'idle'; } });
        if (live()) {
          const k = ctl.keys;
          const left = input.left || k.has('ArrowLeft') || k.has('a') || k.has('A');
          const right = input.right || k.has('ArrowRight') || k.has('d') || k.has('D');
          const block = input.block || k.has('l') || k.has('L');
          if (!busy(P)) {
            if (block) P.act = 'block';
            else if (left !== right) { P.x = clamp(P.x + (right ? 1 : -1) * 0.32 * dt); P.act = 'walk'; P.walk += dt * 12; }
            else if (P.act === 'walk' || P.act === 'block') P.act = 'idle';
          }
          // the computer closes in, guards now and then, and strikes when it's in reach
          const dist = Math.abs(P.x - C.x);
          cpuT -= dt;
          if (!busy(C)) {
            if (C.act === 'block' && Math.random() < dt * 2.5) C.act = 'idle';
            if (C.act !== 'block') {
              if (dist > 0.15) { C.x = clamp(C.x + Math.sign(P.x - C.x) * 0.26 * dt); C.act = 'walk'; C.walk += dt * 12; }
              else if (C.act === 'walk') C.act = 'idle';
              if (dist < 0.17 && Math.random() < dt * 0.9) C.act = 'block';
            }
            if (cpuT <= 0 && dist < 0.19) { cpuT = rand(0.55, 1.1); C.act = 'idle'; attack(C, Math.random() < 0.6 ? 'punch' : 'kick'); }
          }
          const gap = 0.07 - Math.abs(P.x - C.x);   // never walk through each other
          if (gap > 0) { const s = Math.sign(P.x - C.x) || -1; P.x = clamp(P.x + s * gap / 2); C.x = clamp(C.x - s * gap / 2); }
        }
        P.dir = Math.sign(C.x - P.x) || 1; C.dir = -P.dir;
      },
      draw(g, t) {
        drawFight(g, m, t);
        if (m.final > 0) text(g, P.score > C.score ? '你贏了！' : '電腦贏了', 320, 232, 34, P.score > C.score ? '#ffd23f' : '#ff4f7b', 'center', DOT);
      },
    };
  },
};

// ---------------------------------------------------------------- spinning tops: launch, then bash it out
const CX = 320, CY = 192, BOWL = 140, TR = 20;
const TOPS = {
  title: '戰鬥陀螺',
  help: '力道條跑到最滿時按「發射」（或空白鍵），力道越大轉越久；開打後按「衝撞」撞過去。先停下或被撞出場的輸',
  keys: [' '],
  start(ctl) {
    const low = lowRes();
    const s = { phase: 'power', power: 0, t: 0, result: '', sparks: [], over: 0, shake: 0, go: 0 };
    const top = (name, col, x, side) => ({ name, col, x, y: CY, vx: 0, vy: 0, stamina: 1, spin: 0, cool: 0, side, fall: 0, trail: [] });
    // a shower of sparks where they clash, more for a harder hit
    const burst = (x, y, n) => { for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), v = rand(60, 220); s.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rand(0.2, 0.45) }); } };
    const me = top('你', ['#c0282d', '#ffd23f'], CX - BOWL * 0.75, 1), cpu = top('CPU', ['#1c4fd6', '#7ec8ff'], CX + BOWL * 0.75, -1);
    const launch = (t, p) => {
      // sent off round the bowl (one up, one down, so they swing in toward each other), a little inward
      t.stamina = 0.45 + 0.55 * p;
      const sp = 80 + 90 * p;
      t.vx = t.side * sp * 0.35; t.vy = -t.side * sp;
    };
    const ram = (a, b) => {
      if (s.phase !== 'battle' || a.cool > 0 || a.stamina < 0.12 || a.fall) return;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      a.vx += dx / d * 190; a.vy += dy / d * 190; a.stamina -= 0.05; a.cool = 1.2; a.dash = 0.3; sfx('dash');
    };
    const fire = () => {
      if (s.phase === 'power') { s.phase = 'battle'; s.go = 1; sfx('launch'); launch(me, s.power); launch(cpu, rand(0.5, 0.92)); ctl.clear(); ctl.button('衝撞', () => ram(me, cpu), null, 'hot'); }
      else ram(me, cpu);
    };
    ctl.button('發射', fire, null, 'hot');
    const finish = text => {
      s.phase = 'over'; s.result = text;
      if (text.includes('出場')) sfx('ringout'); setTimeout(() => sfx(text.includes('你贏') ? 'win' : 'lose'), 350);
      ctl.clear(); ctl.button('再來一次', () => ctl.restart(), null, 'hot');
    };
    return {
      key: fire,
      step(dt) {
        s.t += dt;
        s.sparks.forEach(p => { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; }); s.sparks = s.sparks.filter(p => p.t > 0);
        s.shake = Math.max(0, s.shake - dt); s.go = Math.max(0, s.go - dt);
        if (s.phase === 'power') { s.power = 0.5 - 0.5 * Math.cos(s.t * 2.8); return; }
        if (s.phase !== 'battle') return;
        [me, cpu].forEach(t => {
          if (t.fall) { t.fall += dt; t.vx *= 0.9; t.vy *= 0.9; return; }
          t.vx += (CX - t.x) * 2.4 * dt; t.vy += (CY - t.y) * 2.4 * dt;   // the bowl tips them toward the middle
          t.vx *= 1 - 0.5 * dt; t.vy *= 1 - 0.5 * dt;
          t.x += t.vx * dt; t.y += t.vy * dt;
          t.trail.unshift([t.x, t.y]); t.trail.length = Math.min(t.trail.length, 10); t.dash = Math.max(0, (t.dash || 0) - dt);
          t.spin += dt * (8 + 34 * t.stamina);
          t.stamina -= dt * 0.055; t.cool = Math.max(0, t.cool - dt);
          if (t.stamina <= 0) { t.stamina = 0; t.fall = 0.001; }
        });
        // they clash: bounce apart, each knocking spin off the other
        const dx = cpu.x - me.x, dy = cpu.y - me.y, d = Math.hypot(dx, dy);
        if (d < TR * 2 && d > 0 && !me.fall && !cpu.fall) {
          const nx = dx / d, ny = dy / d, rel = (me.vx - cpu.vx) * nx + (me.vy - cpu.vy) * ny;
          if (rel > 0) {
            me.vx -= rel * nx * 1.1; me.vy -= rel * ny * 1.1; cpu.vx += rel * nx * 1.1; cpu.vy += rel * ny * 1.1;
            const hit = 0.03 + Math.min(0.12, rel / 2000);
            me.stamina -= hit * (0.6 + cpu.stamina * 0.8); cpu.stamina -= hit * (0.6 + me.stamina * 0.8);
            sfx('clash'); burst((me.x + cpu.x) / 2, (me.y + cpu.y) / 2, 6 + Math.round(Math.min(14, rel / 25)));
            if (rel > 140) s.shake = 0.25;
          }
          const push = (TR * 2 - d) / 2; me.x -= nx * push; me.y -= ny * push; cpu.x += nx * push; cpu.y += ny * push;
        }
        if (cpu.cool <= 0 && Math.random() < dt * 0.7) ram(cpu, me);
        // at the rim: hit it hard enough and it flies out, otherwise it bounces back in off the wall
        const out = t => {
          const rx = t.x - CX, ry = t.y - CY, r = Math.hypot(rx, ry);
          if (r <= BOWL - TR || t.fall) return false;
          const nx = rx / r, ny = ry / r, vr = t.vx * nx + t.vy * ny;
          if (vr > 260) return true;
          if (vr > 0) { t.vx -= vr * nx * 1.6; t.vy -= vr * ny * 1.6; t.stamina -= 0.02; }
          t.x = CX + nx * (BOWL - TR); t.y = CY + ny * (BOWL - TR);
          return false;
        };
        if (out(me)) finish('被撞出場，電腦贏了');
        else if (out(cpu)) finish('把對手撞出場，你贏了！');
        else if (me.fall > 0.9) finish('你的陀螺先停了，電腦贏了');
        else if (cpu.fall > 0.9) finish('對手先停了，你贏了！');
      },
      draw(g) {
        const d = low.g;
        // seen from the side and above: the round bowl flattened into an ellipse
        const sx = x => 320 + (x - CX) * 1.3, sy = y => 214 + (y - CY) * 0.6, RX = BOWL * 1.3, RY = BOWL * 0.6;
        const oval = (cx, cy, rx, ry, c) => { d.fillStyle = c; d.beginPath(); d.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2); d.fill(); };
        d.save();
        if (s.shake > 0) d.translate(rand(-6, 6) * s.shake * 4, rand(-4, 4) * s.shake * 4);
        // the café behind it: the purple wall, a warm light on the table the stadium sits on
        d.fillStyle = '#3b2f63'; d.fillRect(-20, -20, W + 40, 200);
        d.fillStyle = '#463a73'; for (let y = 0; y < 180; y += 24) d.fillRect(-20, y, W + 40, 4);
        d.fillStyle = '#7a5232'; d.fillRect(-20, 170, W + 40, 220);
        d.fillStyle = '#6a4528'; for (let x = -20; x < W + 20; x += 56) d.fillRect(x, 170, 4, 220);
        d.fillStyle = '#8a6040'; d.fillRect(-20, 170, W + 40, 6);
        oval(320, 300, 300, 70, 'rgba(255,214,140,.16)');
        // the tub: its shadow, the outside wall, then the orange rim
        oval(328, 262, RX + 24, RY + 22, 'rgba(0,0,0,.35)');
        d.fillStyle = '#4f7d9c'; d.fillRect(320 - RX - 10, 214, (RX + 10) * 2, 26); oval(320, 240, RX + 10, RY + 10, '#4f7d9c');
        d.fillStyle = '#3f6a88'; for (let i = -6; i <= 6; i++) d.fillRect(320 + i * RX / 7 - 2, 220, 4, 16 + 8 * Math.cos(i / 7 * Math.PI / 2));   // ribs down the side
        oval(320, 214, RX + 12, RY + 10, '#ff6a1a'); oval(320, 212, RX + 8, RY + 6, '#ff8c3a');
        // the bowl inside, darker toward the back where the wall's shadow falls, stepping down to the middle
        [[1, '#7fb2d2'], [0.82, '#8cc0de'], [0.62, '#9acbe6'], [0.42, '#a8d5ee'], [0.2, '#b8def3']].forEach(([k, c], i) => oval(320, 214 + (1 - k) * 6, RX * k, RY * k, c));
        oval(320, 214 - RY + 10, RX * 0.7, 10, 'rgba(30,50,80,.25)');                                        // the back wall's shadow
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; d.fillStyle = 'rgba(255,255,255,.18)'; d.fillRect(320 + Math.cos(a) * RX * 0.9 - 2, 214 + Math.sin(a) * RY * 0.9 - 2, 4, 4); }   // studs round the slope
        // trails, then each top (the nearer one drawn last)
        [me, cpu].forEach(t => t.trail.forEach(([x, y], i) => { if (i % 2) return; d.globalAlpha = (1 - i / 10) * 0.35 * (t.fall ? 0 : 1); oval(sx(x), sy(y), 6, 3, t.col[1]); }));
        d.globalAlpha = 1;
        [me, cpu].slice().sort((a, b) => a.y - b.y).forEach(t => {
          const tilt = Math.min(1, t.fall), wob = (1 - t.stamina) * 3 * Math.sin(s.t * 9 + t.side);
          const x = sx(t.x) + wob + tilt * 10 * t.side, y = sy(t.y), lift = 20 * (1 - tilt * 0.7), r = TR * 1.55;
          oval(x + 2, y + 3, r * 0.9, r * 0.38, 'rgba(0,0,0,.35)');                                        // shadow on the bowl
          d.save(); d.translate(x, y - lift); d.rotate(tilt * 0.9 * t.side);
          d.fillStyle = '#c9ccd0'; d.beginPath(); d.moveTo(-5, 4); d.lineTo(5, 4); d.lineTo(0, lift); d.closePath(); d.fill();   // the tip
          oval(0, 4, r * 0.85, r * 0.34, shade(t.col[0], -0.35));                                          // the body underneath
          oval(0, 0, r, r * 0.4, t.col[0]);                                                                 // the attack ring
          // three blades round the ring, turning with the spin
          for (let k = 0; k < 3; k++) {
            const a = t.spin + k * Math.PI * 2 / 3, ax = Math.cos(a), ay = Math.sin(a);
            d.fillStyle = shade(t.col[1], ay > 0 ? 0.15 : -0.2); d.beginPath();
            d.moveTo(ax * r * 0.5, ay * r * 0.2 - 2); d.lineTo(ax * r * 1.18 - ay * 6, ay * r * 0.47 - 2 + ax * 2); d.lineTo(ax * r * 1.05 + ay * 8, ay * r * 0.42 + 2 - ax * 3); d.closePath(); d.fill();
          }
          oval(0, -4, r * 0.55, r * 0.22, shade(t.col[1], -0.1)); oval(0, -6, r * 0.42, r * 0.17, t.col[1]);   // the face disc
          oval(0, -7, 5, 2.5, '#f4efe3');                                                                       // the bolt
          if (!t.fall && t.stamina > 0.3) { d.strokeStyle = 'rgba(255,255,255,.35)'; d.lineWidth = 2; d.beginPath(); d.ellipse(0, 0, r + 4, r * 0.4 + 2, 0, s.t * 12 % 6, s.t * 12 % 6 + 1.6); d.stroke(); }   // the blur of a fast spin
          if (t.dash > 0) { d.fillStyle = `rgba(255,255,255,${t.dash})`; d.beginPath(); d.ellipse(0, 0, r + 8, r * 0.4 + 5, 0, 0, Math.PI * 2); d.fill(); }
          d.restore();
        });
        s.sparks.forEach(p => { d.fillStyle = p.t > 0.25 ? '#fff6c8' : '#ffd23f'; d.fillRect(sx(p.x) - 3, sy(p.y) - 14 - 3, 6, 6); });
        d.restore();
        blowUp(g, low);
        // the bars and words go on after, at full resolution, so they stay sharp
        const bar = (t, x, right) => {
          text(g, t.name, right ? x + 160 : x, 30, 18, '#f4efe3', right ? 'right' : 'left', DOT);
          g.fillStyle = '#000'; g.fillRect(x - 3, 38, 166, 18); g.fillStyle = '#c0282d'; g.fillRect(x, 41, 160, 12);
          const w = Math.round(160 * Math.max(0, t.stamina)); g.fillStyle = t.col[1]; g.fillRect(right ? x + 160 - w : x, 41, w, 12);
        };
        bar(me, 20, false); bar(cpu, 460, true);
        if (s.phase === 'power') {
          text(g, '抓時機發射！', 320, 96, 28, '#ffd23f', 'center', DOT);
          g.fillStyle = '#000'; g.fillRect(197, 318, 246, 26); g.fillStyle = '#3a2a1e'; g.fillRect(200, 321, 240, 20);
          g.fillStyle = s.power > 0.85 ? '#3ddc97' : '#ffd23f'; g.fillRect(200, 321, Math.round(240 * s.power), 20);
          text(g, 'POWER', 320, 310, 12, '#f4efe3');
        }
        if (s.go > 0) text(g, 'GO SHOOT!', 320 + (1 - s.go) * 20, 120, 32, '#ff4f7b');
        if (s.phase === 'over') {
          g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(90, 150, 460, 80);
          text(g, s.result, 320, 202, 28, s.result.includes('你贏') ? '#ffd23f' : '#ff4f7b', 'center', DOT);
        }
      },
    };
  },
};

// ---------------------------------------------------------------- the TV's game list
const TV_GAMES = [['fight', '快打旋風', '一對一，三戰兩勝', '#ff4f7b'], ['nba', 'NBA 2K', '三分球大賽', '#ffd23f'], ['exit', '退出', '放下搖桿，回到咖啡廳', '#7ec8ff']];
const PICKER = {
  tv: true,
  title: '電視：選擇遊戲',
  help: '點遊戲，或用 ↑ ↓ 選、Enter 開始',
  keys: ['ArrowUp', 'ArrowDown', 'Enter', ' '],
  start(ctl) {
    let sel = 0, t = 0;
    const choose = k => (k === 'exit' ? ctl.close() : ctl.play(k));   // the last one puts the controller down
    TV_GAMES.forEach(([k, name]) => ctl.button(name, () => choose(k), null, 'hot'));
    const box = i => [120, 96 + i * 86, 400, 72];
    return {
      key(k) { const n = TV_GAMES.length; if (k === 'ArrowUp') sel = (sel + n - 1) % n; else if (k === 'ArrowDown') sel = (sel + 1) % n; else choose(TV_GAMES[sel][0]); },
      tap([x, y]) { TV_GAMES.forEach((gm, i) => { const [bx, by, bw, bh] = box(i); if (x > bx && x < bx + bw && y > by && y < by + bh) choose(gm[0]); }); },
      step(dt) {
        t += dt;
        const p = ctl.pointer; if (p) TV_GAMES.forEach((gm, i) => { const [bx, by, bw, bh] = box(i); if (p[0] > bx && p[0] < bx + bw && p[1] > by && p[1] < by + bh) sel = i; });
      },
      draw(g) {
        g.fillStyle = '#1f1c27'; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? '#2c2838' : '#1f1c27'; g.fillRect(0, i * 9 + (t * 20) % 18 - 18, W, 9); }
        text(g, 'SELECT GAME', 320, 70, 26, '#ff4f7b');
        TV_GAMES.forEach(([, name, sub, c], i) => {
          const [x, y, w, h] = box(i), on = i === sel;
          g.fillStyle = '#000'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
          g.fillStyle = on ? c : '#3d3850'; g.fillRect(x, y, w, h);
          g.font = `30px ${DOT}`; g.textAlign = 'left'; g.fillStyle = on ? '#1f1c27' : '#f4efe3'; g.fillText(name, x + 24, y + 36);
          g.font = `16px ${DOT}`; g.fillStyle = on ? '#1f1c27' : '#a9a3b8'; g.fillText(sub, x + 24, y + 60);
          if (on && Math.floor(t * 2) % 2 === 0) text(g, '▶', x - 30, y + 46, 24, '#ffd23f', 'center', DOT);
        });
      },
    };
  },
};

// ---------------------------------------------------------------- NBA 2K three-point contest: five racks of five
const HOOP = [520, 128];
const NBA = {
  tv: true,
  title: '玩電動：NBA 2K 三分球大賽',
  help: '投籃條在跑，跑到綠色區按「投籃」（或空白鍵）就是空心。五個點、每點五顆，最後一顆彩球算 2 分，限時 60 秒',
  keys: [' '],
  start(ctl) {
    const low = lowRes();
    const s = { rack: 0, ball: 0, score: 0, time: 60, meter: 0, mt: 0, shot: null, pop: null, done: false, best: 0 };
    // five spots round the arc, from the near corner to the top of the key; nearer the camera, the shooter is bigger
    const spots = [205, 185, 165, 145, 125].map(a => [560 + 430 * Math.cos(a * Math.PI / 180), 258 - 80 * Math.sin(a * Math.PI / 180)]);
    const zone = () => [0.72 - s.rack * 0.015, 0.84 - s.rack * 0.025];          // the green window narrows rack by rack
    const shoot = () => {
      if (s.done || s.shot) return;
      const [a, b] = zone(), m = s.meter, money = s.ball === 4;
      const good = m >= a && m <= b, close = !good && m > a - 0.1 && m < b + 0.08;
      s.shot = { t: 0, made: good || (close && Math.random() < 0.35), money, miss: m < a ? -1 : 1 }; sfx('shoot');
    };
    ctl.button('投籃', shoot, null, 'hot');
    return {
      key: shoot,
      tap: shoot,
      step(dt) {
        if (s.pop) { s.pop.t -= dt; if (s.pop.t <= 0) s.pop = null; }
        if (s.done) return;
        if (s.time > 0.5 && s.time <= 5.5 && Math.ceil(s.time - dt) < Math.ceil(s.time)) sfx('tick');   // the last five seconds
        s.time -= dt;
        s.mt += dt; s.meter = 0.5 - 0.5 * Math.cos(s.mt * 3.4);
        if (s.shot) {
          s.shot.t += dt / 0.85;
          if (s.shot.t >= 1) {
            if (s.shot.made) { sfx(s.shot.money ? 'money' : 'swish'); s.score += s.shot.money ? 2 : 1; s.pop = { label: s.shot.money ? 'MONEY BALL! +2' : 'SWISH! +1', t: 0.9 }; }
            else { sfx('rim'); s.pop = { label: s.shot.miss < 0 ? '太短了' : '太大力', t: 0.8 }; }
            s.shot = null; s.ball++; s.mt = 0;
            if (s.ball >= 5) { s.ball = 0; s.rack++; }
          }
        }
        if (s.rack >= 5 || s.time <= 0) {
          s.done = true; s.time = Math.max(0, s.time); s.best = best('peep.nba.best', s.score); sfx('buzzer');
          ctl.clear(); ctl.button('再投一次', () => ctl.restart(), null, 'hot');
        }
      },
      draw(g, t) {
        const d = low.g, sh = s.shot, k = sh ? sh.t : 0, made = sh && sh.made && k > 0.78;
        // the arena: stands full of fans (up on their feet after a make), ad boards, the floor running away from us
        d.fillStyle = '#120d12'; d.fillRect(0, 0, W, H);
        crowd(d, 0, W, 50, 4, 8, t, made || (s.pop && s.pop.label.includes('+')) ? 1 : 0);
        d.fillStyle = '#0c0a10'; d.fillRect(0, 150, W, 22);
        d.font = `14px ${PIX}`; d.textAlign = 'left';
        for (let x = -((t * 40) % 260); x < W; x += 260) { d.fillStyle = '#ff4f7b'; d.fillText('PEEP COFFEE', x + 10, 167); d.fillStyle = '#ffd23f'; d.fillText('3PT', x + 190, 167); }
        d.fillStyle = '#c99256'; d.fillRect(0, 172, W, H - 172);
        d.fillStyle = '#bd864c'; for (let x = -400; x < W + 400; x += 44) { d.beginPath(); d.moveTo(x, 172); d.lineTo(x + 3, 172); d.lineTo(320 + (x + 3 - 320) * 2.4, H); d.lineTo(320 + (x - 320) * 2.4, H); d.fill(); }   // planks
        d.fillStyle = 'rgba(255,230,180,.12)'; d.beginPath(); d.ellipse(330, 270, 300, 60, 0, 0, Math.PI * 2); d.fill();   // the floor's shine
        d.strokeStyle = '#fff'; d.lineWidth = 4;
        d.beginPath(); d.ellipse(560, 258, 430, 80, 0, Math.PI * 0.55, Math.PI * 1.5); d.stroke();             // the three-point line
        d.fillStyle = '#552583'; d.beginPath(); d.moveTo(470, 222); d.lineTo(640, 222); d.lineTo(640, 300); d.lineTo(430, 300); d.closePath(); d.fill();   // the paint
        d.stroke();
        // the hoop: padded base, arm, glass backboard, rim, and a net that flicks when one drops through
        d.fillStyle = '#1d428a'; d.fillRect(590, 196, 50, 70); d.fillStyle = '#163469'; d.fillRect(590, 196, 50, 8);
        d.fillStyle = '#555'; d.fillRect(600, 70, 12, 128); d.fillRect(562, 82, 44, 8);
        d.fillStyle = 'rgba(200,230,255,.55)'; d.fillRect(546, 44, 20, 110); d.fillStyle = '#f4efe3'; d.fillRect(546, 44, 20, 4); d.fillRect(546, 150, 20, 4); d.fillRect(546, 44, 4, 110);
        d.fillStyle = '#c0282d'; d.fillRect(552, 96, 8, 30);
        const flick = made && k < 0.95 ? Math.sin((k - 0.78) * 60) * 4 : 0;
        d.fillStyle = '#f4efe3'; for (let i = 0; i < 6; i++) { const nx = HOOP[0] - 24 + i * 9; d.fillRect(nx + flick * (i % 2 ? 1 : -1), HOOP[1] + 4, 3, 30 - Math.abs(i - 2.5) * 3); }
        d.fillRect(HOOP[0] - 18, HOOP[1] + 30, 36, 3);
        d.fillStyle = '#ff6a1a'; d.fillRect(HOOP[0] - 28, HOOP[1] - 2, 54, 7); d.fillStyle = '#c94f10'; d.fillRect(HOOP[0] - 28, HOOP[1] + 3, 54, 2);
        // the shooter at this rack's spot, the ball rack beside him
        const [px, py] = spots[Math.min(4, s.rack)], u = 3.4 + (py - 190) / 100 * 1.6, up = sh && k < 0.28;
        const rackX = px - 16 * u, left = 4 - s.ball;   // what's still on the rack, the money ball last
        d.fillStyle = '#2a2a2a'; d.fillRect(rackX - 6 * u, py - 5 * u, 12 * u, 2 * u); d.fillRect(rackX - 6 * u, py - 3 * u, u, 3 * u); d.fillRect(rackX + 5 * u, py - 3 * u, u, 3 * u);
        for (let i = 0; i < left; i++) {
          const bxr = rackX - 4.5 * u + i * 2.4 * u;
          d.fillStyle = '#000'; d.fillRect(bxr - 0.2 * u, py - 7.6 * u, 2.4 * u, 2.4 * u);
          d.fillStyle = i === left - 1 ? '#f4efe3' : '#ff7a1f'; d.fillRect(bxr, py - 7.4 * u, 2 * u, 2 * u);
        }
        hoopsPlayer(d, px, py, u, { c1: '#552583', c2: '#FDB927', skin: '#8d5a3b', num: 3 }, up ? 'shoot' : 'stand', t, 1);
        // the ball: at his chest, up over his head, then on its arc; in, it drops through the net and bounces away
        const money = s.ball === 4;
        let bx = px + 3.6 * u, by = py - 9 * u, floor = py;
        if (up) { bx = px; by = py - (19 + k * 8) * u; }
        else if (sh) {
          const q = (k - 0.28) / 0.72, fx = px, fy = py - 21 * u;
          const tx = sh.made ? HOOP[0] - 2 : HOOP[0] - 26 + (sh.miss > 0 ? 50 : 0), ty = HOOP[1] - 10;
          if (q < 0.7) { const r = q / 0.7; bx = fx + (tx - fx) * r; by = fy + (ty - fy) * r - Math.sin(r * Math.PI) * 150; }
          else if (sh.made) { const r = (q - 0.7) / 0.3; bx = tx; by = ty + r * 120; }                  // down through the net
          else { const r = (q - 0.7) / 0.3; bx = tx + sh.miss * r * 90; by = ty - Math.sin(r * Math.PI) * 40 + r * 60; }   // off the rim
          floor = 258 + (bx - 320) * 0.02;
        }
        if (!s.done) {
          const shadowX = bx, sz = 11;
          d.fillStyle = 'rgba(0,0,0,.25)'; d.fillRect(shadowX - 10, Math.max(floor, by + 14) - 2, 20, 5);
          d.fillStyle = '#000'; d.fillRect(bx - sz - 2, by - sz - 2, (sz + 2) * 2, (sz + 2) * 2);
          if (money) { d.fillStyle = '#c0282d'; d.fillRect(bx - sz, by - sz, sz * 2, sz * 2); d.fillStyle = '#f4efe3'; d.fillRect(bx - sz, by - 3, sz * 2, 6); d.fillStyle = '#1c4fd6'; d.fillRect(bx - 3, by - sz, 6, sz * 2); }   // the red, white and blue money ball
          else { d.fillStyle = '#ff7a1f'; d.fillRect(bx - sz, by - sz, sz * 2, sz * 2); d.fillStyle = '#ffa04a'; d.fillRect(bx - sz + 2, by - sz + 2, 6, 6); d.fillStyle = '#4a1d05'; d.fillRect(bx - 1, by - sz, 2, sz * 2); d.fillRect(bx - sz, by - 1, sz * 2, 2); }
        }
        // the shot meter, standing beside him the way the game shows it
        const [a, b] = zone(), mx = px + 8 * u, mh = 26 * u, my = py - 24 * u;
        if (!s.done && !sh) {
          d.fillStyle = '#000'; d.fillRect(mx - 3, my - 3, 18, mh + 6); d.fillStyle = '#3a2a1e'; d.fillRect(mx, my, 12, mh);
          d.fillStyle = '#3ddc97'; d.fillRect(mx, my + mh * (1 - b), 12, mh * (b - a));
          d.fillStyle = s.meter >= a && s.meter <= b ? '#ffffff' : '#ffd23f'; d.fillRect(mx - 5, my + mh * (1 - s.meter) - 3, 22, 6);
        }
        // the broadcast bar along the top: score, game clock, rack, balls left in it
        d.fillStyle = '#000'; d.fillRect(0, 0, W, 40); d.fillStyle = '#552583'; d.fillRect(0, 36, W, 4);
        text(d, `SCORE ${s.score}`, 16, 28, 16, '#ffd23f', 'left');
        d.fillStyle = '#1f0a0a'; d.fillRect(286, 4, 68, 32);
        text(d, `${Math.ceil(Math.max(0, s.time))}`.padStart(2, '0'), 320, 30, 20, s.time < 10 ? '#ff4f7b' : '#ff7a1f');
        text(d, `RACK ${Math.min(5, s.rack + 1)}/5`, 470, 28, 14, '#f4efe3', 'left');
        for (let i = 0; i < 5; i++) { d.fillStyle = i < s.ball ? '#3d3850' : i === 4 ? '#f4efe3' : '#ff7a1f'; d.fillRect(400 + i * 13, 14, 10, 10); }
        if (s.pop) text(d, s.pop.label, 320, 96, 26, s.pop.label.includes('+') ? '#3ddc97' : '#ff4f7b', 'center', DOT);
        if (s.done) {
          d.fillStyle = 'rgba(0,0,0,.65)'; d.fillRect(140, 120, 360, 120);
          text(d, `總分 ${s.score}`, 320, 170, 34, '#ffd23f', 'center', DOT);
          text(d, `最高紀錄 ${s.best}`, 320, 214, 20, '#f4efe3', 'center', DOT);
        }
        blowUp(g, low);
      },
    };
  },
};

const GAMES = { tv: PICKER, fight: FIGHT, nba: NBA, tops: TOPS };
