// Little 8-bit games a visitor can play, each in a window over the café: 快打旋風 against the computer (the same
// match the TV shows), darts at a board like the one on the purple wall, and a spinning-top battle. Opened from the
// tiles under the shop's name; one at a time.
import { DOT, PIX, rand, pick } from './util.js';
import { drawFight, fighterSide } from './fight.js';
import { FIGHTER_NAMES } from '../content/catalog';

const W = 640, H = 360;
let open = null;   // the game showing now

export function closeGame() { if (open) open.close(); }

export function openGame(kind, root) {
  closeGame();
  const G = { fight: FIGHT, darts: DARTS, tops: TOPS }[kind]; if (!G) return;
  const sheet = document.createElement('div'); sheet.className = 'gameSheet';
  sheet.innerHTML = `<section class="win gameWin" role="dialog" aria-label="${G.title}">
    <div class="gameHead"><h2>${G.title}</h2><button class="gameClose" aria-label="關閉">✕</button></div>
    <canvas width="${W}" height="${H}"></canvas><p class="gameHelp">${G.help}</p><div class="gamePad"></div></section>`;
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
  const ctl = { keys, button, pointer: null, restart: null, clear: () => { pad.textContent = ''; } };
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
  listen(sheet, 'pointerdown', e => { if (e.target === sheet) close(); });
  listen(sheet.querySelector('.gameClose'), 'click', () => close());
  let game = G.start(ctl), raf = 0, last = performance.now();
  ctl.restart = () => { ctl.clear(); game = G.start(ctl); };
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    game.step(dt, now / 1000); game.draw(g, now / 1000);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  function close() { cancelAnimationFrame(raf); offs.forEach(f => f()); sheet.remove(); if (open === api) open = null; }
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
const best = (key, score) => {   // a high score kept in this browser
  try { const b = Math.max(score, Number(localStorage.getItem(key)) || 0); localStorage.setItem(key, String(b)); return b; } catch { return score; }
};

// ---------------------------------------------------------------- 快打旋風: you against the computer, best of three
const FIGHT = {
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
      if (Math.abs(o.x - f.x) > reach || o.act === 'ko') return;
      if (o === C && !busy(C) && Math.random() < 0.3) o.act = 'block';   // the computer sees some of them coming
      if (o.act === 'block') { o.hp = Math.max(0, o.hp - 1); spark(f, o, '#ffffff'); }
      else { o.hp = Math.max(0, o.hp - dmg); o.act = 'hit'; o.actT = 0.28; o.x = clamp(o.x + f.dir * 0.04); spark(f, o, f.col[1]); }
      if (o.hp <= 0) { o.act = 'ko'; o.actT = 99; f.act = 'idle'; f.score++; m.ko = 2.2; m.koText = 'K.O.'; }
    }
    function nextRound() {
      if (P.score >= 2 || C.score >= 2) { m.final = 99; return; }
      m.round++; m.t = 40; m.intro = 1.6;
      [[P, 0.3], [C, 0.7]].forEach(([f, x]) => Object.assign(f, { hp: 100, x, act: 'idle', actT: 0 }));
    }
    return {
      key(k) { if (k === 'j' || k === 'J') attack(P, 'punch'); if (k === 'k' || k === 'K') attack(P, 'kick'); },
      step(dt) {
        m.sparks.forEach(s => { s.t -= dt; }); m.sparks = m.sparks.filter(s => s.t > 0);
        if (m.final > 0) {
          if (!again) { again = true; ctl.clear(); ctl.button('再來一場', () => ctl.restart(), null, 'hot'); }
          return;
        }
        if (m.intro > 0) m.intro -= dt;
        else if (m.ko > 0) { m.ko -= dt; if (m.ko <= 0) nextRound(); }
        else {
          m.t -= dt;
          if (m.t <= 0) {   // time: whoever has more left takes the round
            const w = P.hp === C.hp ? null : P.hp > C.hp ? P : C;
            if (w) w.score++;
            m.ko = 2.2; m.koText = 'TIME';
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

// ---------------------------------------------------------------- darts: three rounds of three
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const BX = 320, BY = 180, BR = 140;
function dartScore(x, y) {
  const dx = x - BX, dy = y - BY, r = Math.hypot(dx, dy) / BR;
  if (r > 1) return { pts: 0, label: 'MISS' };
  if (r < 0.06) return { pts: 50, label: 'BULL 50' };
  if (r < 0.14) return { pts: 25, label: '25' };
  const a = (Math.atan2(dx, -dy) + Math.PI * 2 + Math.PI / 20) % (Math.PI * 2);   // from the top, clockwise
  const n = ORDER[Math.floor(a / (Math.PI / 10)) % 20];
  if (r > 0.56 && r < 0.64) return { pts: n * 3, label: `TRIPLE ${n * 3}` };
  if (r > 0.92) return { pts: n * 2, label: `DOUBLE ${n * 2}` };
  return { pts: n, label: String(n) };
}
function drawBoard(g) {
  g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(BX, BY, BR + 26, 0, Math.PI * 2); g.fill();
  const wedge = (i, r, c) => { const a = (i * 18 - 9 - 90) * Math.PI / 180; g.fillStyle = c; g.beginPath(); g.moveTo(BX, BY); g.arc(BX, BY, r, a, a + Math.PI / 10); g.closePath(); g.fill(); };
  for (let i = 0; i < 20; i++) {
    const single = i % 2 ? '#efe4c8' : '#1f1f1f', ring = i % 2 ? '#2e8b57' : '#c0282d';
    wedge(i, BR, ring); wedge(i, BR * 0.92, single); wedge(i, BR * 0.64, ring); wedge(i, BR * 0.56, single);
  }
  g.fillStyle = '#2e8b57'; g.beginPath(); g.arc(BX, BY, BR * 0.14, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c0282d'; g.beginPath(); g.arc(BX, BY, BR * 0.06, 0, Math.PI * 2); g.fill();
  ORDER.forEach((n, i) => { const a = (i * 18 - 90) * Math.PI / 180; text(g, String(n), BX + Math.cos(a) * (BR + 14), BY + Math.sin(a) * (BR + 14) + 5, 12, '#f4efe3'); });
}
const DARTS = {
  title: '射飛鏢',
  help: '移動滑鼠或手指瞄準，準星會晃，抓好時機點一下（或按空白鍵）射出。三輪、每輪三支',
  keys: [' '],
  start(ctl) {
    const low = lowRes();
    const s = { round: 1, thrown: [], total: 0, pop: null, clearT: 0, done: false, best: 0, aim: [BX, BY] };
    // the hand wobbles: the aim drifts round where you point
    const aim = t => {
      const [px, py] = ctl.pointer || [BX, BY];
      return [px + Math.sin(t * 2.3) * 24 + Math.sin(t * 5.3) * 8, py + Math.cos(t * 1.9) * 22 + Math.sin(t * 4.1) * 7];
    };
    const throwDart = () => {
      if (s.done || s.clearT > 0 || s.thrown.length >= 3) return;
      const [x, y] = s.aim = aim(performance.now() / 1000), hit = dartScore(x, y);   // where it is now, so a tap lands where it's tapped
      s.thrown.push({ x, y, t: 0 }); s.total += hit.pts; s.pop = { label: hit.label, t: 1 };
      if (s.thrown.length === 3) s.clearT = 1.3;
    };
    ctl.button('射出', throwDart, null, 'hot');
    return {
      key: throwDart,
      tap: throwDart,
      step(dt, t) {
        s.aim = aim(t);
        s.thrown.forEach(d => { d.t += dt; });
        if (s.pop) { s.pop.t -= dt; if (s.pop.t <= 0) s.pop = null; }
        if (s.clearT > 0) {
          s.clearT -= dt;
          if (s.clearT <= 0) {
            if (s.round >= 3) { s.done = true; s.best = best('peep.darts.best', s.total); ctl.clear(); ctl.button('再玩一次', () => ctl.restart(), null, 'hot'); }
            else { s.round++; s.thrown = []; }
          }
        }
      },
      draw(g) {
        const d = low.g;
        d.fillStyle = '#5d4f92'; d.fillRect(0, 0, W, H);                                             // the purple wall
        d.fillStyle = '#4e4280'; for (let y = 0; y < H; y += 24) d.fillRect(0, y, W, 4);
        drawBoard(d);
        s.thrown.forEach(dt => {   // a dart in the board: a red flight, a steel barrel
          const k = Math.min(1, dt.t / 0.12), x = dt.x, y = dt.y + (1 - k) * 60;
          const parts = [[x - 2, y - 6, 6, 8, '#e6e6e6'], [x + 2, y - 18, 8, 14, '#9a9a9a'], [x + 6, y - 30, 14, 14, '#ff4f7b']];
          d.fillStyle = '#000'; parts.forEach(([a, b, w, h]) => d.fillRect(a - 2, b - 2, w + 4, h + 4));   // outlined, so it reads on any ring
          parts.forEach(([a, b, w, h, c]) => { d.fillStyle = c; d.fillRect(a, b, w, h); });
        });
        if (!s.done) {   // the crosshair
          const [x, y] = s.aim;
          d.fillStyle = '#ffd23f'; d.fillRect(x - 14, y - 2, 10, 4); d.fillRect(x + 4, y - 2, 10, 4); d.fillRect(x - 2, y - 14, 4, 10); d.fillRect(x - 2, y + 4, 4, 10);
        }
        text(d, `ROUND ${s.round}/3`, 20, 36, 16, '#ffd23f', 'left');
        text(d, `SCORE ${s.total}`, 620, 36, 16, '#ffd23f', 'right');
        text(d, '●'.repeat(3 - s.thrown.length) + '○'.repeat(s.thrown.length), 20, 64, 16, '#f4efe3', 'left', DOT);
        if (s.pop) text(d, s.pop.label, 320, 40, 22, '#3ddc97');
        if (s.done) {
          d.fillStyle = 'rgba(0,0,0,.6)'; d.fillRect(140, 120, 360, 120);
          text(d, `總分 ${s.total}`, 320, 170, 34, '#ffd23f', 'center', DOT);
          text(d, `最高紀錄 ${s.best}`, 320, 214, 20, '#f4efe3', 'center', DOT);
        }
        blowUp(g, low);
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
    const s = { phase: 'power', power: 0, t: 0, result: '', sparks: [], over: 0 };
    const top = (name, col, x, side) => ({ name, col, x, y: CY, vx: 0, vy: 0, stamina: 1, spin: 0, cool: 0, side, fall: 0 });
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
      a.vx += dx / d * 190; a.vy += dy / d * 190; a.stamina -= 0.05; a.cool = 1.2;
    };
    const fire = () => {
      if (s.phase === 'power') { s.phase = 'battle'; launch(me, s.power); launch(cpu, rand(0.5, 0.92)); ctl.clear(); ctl.button('衝撞', () => ram(me, cpu), null, 'hot'); }
      else ram(me, cpu);
    };
    ctl.button('發射', fire, null, 'hot');
    const finish = text => {
      s.phase = 'over'; s.result = text;
      ctl.clear(); ctl.button('再來一次', () => ctl.restart(), null, 'hot');
    };
    return {
      key: fire,
      step(dt) {
        s.t += dt;
        s.sparks.forEach(p => { p.t -= dt; }); s.sparks = s.sparks.filter(p => p.t > 0);
        if (s.phase === 'power') { s.power = 0.5 - 0.5 * Math.cos(s.t * 2.8); return; }
        if (s.phase !== 'battle') return;
        [me, cpu].forEach(t => {
          if (t.fall) { t.fall += dt; t.vx *= 0.9; t.vy *= 0.9; return; }
          t.vx += (CX - t.x) * 2.4 * dt; t.vy += (CY - t.y) * 2.4 * dt;   // the bowl tips them toward the middle
          t.vx *= 1 - 0.5 * dt; t.vy *= 1 - 0.5 * dt;
          t.x += t.vx * dt; t.y += t.vy * dt;
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
            s.sparks.push({ x: (me.x + cpu.x) / 2, y: (me.y + cpu.y) / 2, t: 0.3 });
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
        d.fillStyle = '#1f1c27'; d.fillRect(0, 0, W, H);
        // the stadium: rings stepping down to the middle, an orange rim
        [[BOWL + 12, '#ff6a1a'], [BOWL, '#9cc4dc'], [BOWL * 0.75, '#86b3cf'], [BOWL * 0.5, '#6f9fbf'], [BOWL * 0.25, '#5b8db0']].forEach(([r, c]) => {
          d.fillStyle = c; d.beginPath(); d.arc(CX, CY, r, 0, Math.PI * 2); d.fill();
        });
        [me, cpu].forEach(t => {
          const tilt = Math.min(1, t.fall), r = TR * (1 - tilt * 0.15);
          d.save(); d.translate(t.x, t.y + tilt * 6); d.scale(1, 1 - tilt * 0.5);
          d.fillStyle = 'rgba(0,0,0,.3)'; d.beginPath(); d.arc(3, 5, r, 0, Math.PI * 2); d.fill();
          d.fillStyle = t.col[0]; d.beginPath(); d.arc(0, 0, r, 0, Math.PI * 2); d.fill();
          d.rotate(t.spin);
          d.fillStyle = t.col[1]; d.fillRect(-r, -3, r * 2, 6); d.fillRect(-3, -r * 0.6, 6, r * 1.2);
          d.fillStyle = '#ddd'; d.beginPath(); d.arc(0, 0, 5, 0, Math.PI * 2); d.fill();
          d.restore();
        });
        s.sparks.forEach(p => { const k = p.t * 30; d.fillStyle = '#ffd23f'; d.fillRect(p.x - k, p.y - 2, k * 2, 4); d.fillRect(p.x - 2, p.y - k, 4, k * 2); });
        const bar = (t, x, right) => {
          text(d, t.name, right ? x + 160 : x, 30, 14, '#f4efe3', right ? 'right' : 'left', DOT);
          d.fillStyle = '#000'; d.fillRect(x - 3, 38, 166, 18); d.fillStyle = '#c0282d'; d.fillRect(x, 41, 160, 12);
          const w = Math.round(160 * Math.max(0, t.stamina)); d.fillStyle = t.col[1]; d.fillRect(right ? x + 160 - w : x, 41, w, 12);
        };
        bar(me, 20, false); bar(cpu, 460, true);
        if (s.phase === 'power') {
          text(d, '抓時機發射！', 320, 88, 22, '#ffd23f', 'center', DOT);
          d.fillStyle = '#000'; d.fillRect(197, 318, 246, 26); d.fillStyle = '#3a2a1e'; d.fillRect(200, 321, 240, 20);
          d.fillStyle = s.power > 0.85 ? '#3ddc97' : '#ffd23f'; d.fillRect(200, 321, Math.round(240 * s.power), 20);
          text(d, 'POWER', 320, 312, 12, '#f4efe3');
        }
        if (s.phase === 'over') {
          d.fillStyle = 'rgba(0,0,0,.6)'; d.fillRect(100, 150, 440, 80);
          text(d, s.result, 320, 200, 24, s.result.includes('你贏') ? '#ffd23f' : '#ff4f7b', 'center', DOT);
        }
        blowUp(g, low);
      },
    };
  },
};
