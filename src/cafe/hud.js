// The HUD overlay: clock and takings, the TV score panel, the person card, camera presets, clicking on people,
// and the name tags / bubbles that follow people around the screen.
import * as THREE from 'three';
import { ctx } from './engine.js';
import { S } from './state.js';
import { $, K } from './util.js';
import { fmtTime } from './feed.js';
import { matchClock } from './tv.js';
import { DAYS } from './sim.js';
import { canInviteTops, inviteTops } from './tops.js';
import { tvGames, GAME_LABEL } from './profiles.js';
import { openGame, closeGame } from './games.js';
import { playWallDarts, stopWallDarts } from './wallDarts.js';
import { sfx, sfxMuted, toggleSfx } from './sfx.js';
import { startMusic, stopMusic, toggleMusic, musicOn } from './music.js';
import { TVX, TVY, TVZ } from './layout.js';

export function updateHUD() {
  $('clock').textContent = fmtTime(S.minutes); $('day').textContent = DAYS[S.dow];
  const isOpen = S.open && !S.closing;
  $('openPill').textContent = isOpen ? '營業中' : '打烊中'; $('openPill').classList.toggle('closed', !isOpen);
  $('sRev').textContent = S.revenue; $('sCups').textContent = S.cupsSold; $('sPeople').textContent = S.customers.length;
  const m = S.tv.match, game = m ? m.kind : S.tv.game;
  $('tvTitle').textContent = game ? `TV · ${GAME_LABEL[game]}` : 'TV';
  $('tvLive').hidden = !m; $('tvIdle').hidden = !!m;
  if (m) {
    $('hName').textContent = m.home.name; $('aName').textContent = m.away.name;
    $('hTeam').textContent = m.home.team; $('aTeam').textContent = m.away.team;
    $('hPts').textContent = m.home.score; $('aPts').textContent = m.away.score;
    $('tvClock').textContent = matchClock(m);
  } else $('tvIdle').textContent = S.seats.gameSeats.some(s => s.occ) ? '玩家入座中，馬上開打…' : '電視前沒人，搖桿放著。';
}

// ---------------------------------------------------------------- the person card
export function openCard(p) { S.selected = p; $('card').hidden = false; fillCard(); sfx('boop'); }
export function closeCard() { S.selected = null; const card = $('card'); if (card) card.hidden = true; }
export function fillCard() {
  const s = S.selected; if (!s) return;
  const p = s.p;
  $('cName').textContent = p.name;
  const kind = $('cKind');
  kind.className = 'kind ' + (s.role === 'owner' ? 'boss' : p.regular ? 'reg' : 'new');
  kind.textContent = s.role === 'owner' ? '老闆 · 一人顧店' : p.regular ? '熟客' : '新客';
  const rows = s.role === 'owner'
    ? [['身分', p.job], ['今日出杯', S.cupsSold + ' 杯'], ['待做訂單', S.orderQueue.length + ' 張'], ['營業時間', '15:00 起']]
    : [['職業', p.job], ['來店次數', p.visits + ' 次'], ['常點', s.drink || p.drink],
      ...(p.plays2k ? [['2K 主隊', p.team]] : []), ...(p.playsFight ? [['快打旋風角色', p.fighter]] : []),
      ...(tvGames(p).length ? [['電動戰績', `${p.wins} 勝 ${p.losses} 敗`]] : []), ...(p.playsTops ? [['戰鬥陀螺', '會玩']] : []), ...(p.smokes ? [['抽菸', '會，喜歡坐戶外區']] : []),
      ['小檔案', p.quirk]];
  const dl = $('cInfo'); dl.innerHTML = '';
  rows.forEach(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); });
  $('cStatus').textContent = '現在：' + s.status;
  $('cInvite').hidden = !(s.role === 'customer' && canInviteTops(s));
}

// ---------------------------------------------------------------- the neon sign, worked by the fourth switch outside
// off, it's dark glass and the red wash on the wall goes; back on, it stutters a few times before it holds, as neon does
let neonTimers = [];
function lightNeon(lit) {
  const n = S.neon; if (!n) return;
  n.sign.material.map = lit ? n.on : n.off; n.sign.material.needsUpdate = true;
  if (S.neonLight) S.neonLight.intensity = lit ? 1.6 : 0;
}
function toggleNeon() {
  const n = S.neon, sw = S.neonSwitch; if (!n || !sw) return;
  neonTimers.forEach(clearTimeout); neonTimers = [];
  n.lit = !n.lit;
  sw.lever.position.y = 1.98 + (n.lit ? 0.01 : -0.01);
  sfx('flick');
  if (!n.lit) { lightNeon(false); return; }
  let t = 0;
  [[true, 70], [false, 120], [true, 50], [false, 260], [true, 90], [false, 80], [true, 0]].forEach(([on, ms]) => {
    neonTimers.push(setTimeout(() => { if (n.lit) { lightNeon(on); if (on && ms === 0) sfx('buzz'); } }, t)); t += ms;
  });
}

// ---------------------------------------------------------------- camera presets
const CAMS = {
  overview: { pos: [9, 13, 11], target: [0, 0.5, -1.5] },
  counter: { pos: [-1.9, 2.3, 2.9], target: [1.2, 1.1, -0.9] },
  menu: { pos: [0.22, 1.5, 2.3], target: [0.6, 1.06, 2.3] },   // leaning over the bar from the customer side, reading the clipboard
  tv: { pos: [1.0, 1.7, -1.8], target: [-2.5, 0.9, -3.5] },
  porch: { pos: [-0.9, 1.95, 10.6], target: [-1.0, 0.7, 5.6] },   // from the street, under the lintel, looking in over both chair rows to the door
  back: { pos: [5, 7, -1.5], target: [0.2, 0.5, -6.6] }
};
let camTween = null;
function setCam(name) {
  const c = CAMS[name], { camera, controls } = ctx;
  camTween = { fp: camera.position.clone(), ft: controls.target.clone(), tp: new THREE.Vector3(c.pos[0] * K, c.pos[1], c.pos[2]), tt: new THREE.Vector3(c.target[0] * K, c.target[1], c.target[2]), t: 0 };
  document.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === name));
  sfx('swoosh');
}
export function updateCamera(dt) {
  if (!camTween) return;
  camTween.t = Math.min(1, camTween.t + dt / (camTween.dur || 1.2));
  const e = 1 - Math.pow(1 - camTween.t, 3);
  ctx.camera.position.lerpVectors(camTween.fp, camTween.tp, e);
  ctx.controls.target.lerpVectors(camTween.ft, camTween.tt, e);
  if (camTween.t >= 1) { const done = camTween.done; camTween = null; done?.(); }
}

// ---------------------------------------------------------------- the things you can play: the camera closes in until it fills
// the view, then the game opens; closing it goes back
const PLAY = {
  // (a little from above: the orbit controls won't let the camera sit level)
  // the TV framed high, with room under it for the game's controls, seen from a little above, over the heads of anyone
  // sitting playing in front of it
  tv: { at: [TVX + 0.075, TVY - 0.22, TVZ], dir: [1, 0.35, 0], w: 1.62, h: 1.4 },
  darts: { at: [-2.97, 1.55, 3.06], dir: [1, 0.1, 0], w: 0.62, h: 0.7 },
  // the stadium, wherever it is: put away on the crates in the back corridor, seen from along it, or out on the porch crates, seen from the street
  tops: { at: null, dir: [0.35, 0.85, 0.45], w: 0.5, h: 0.42 },
};
function playAt(kind, root) {
  const s = PLAY[kind], { camera, controls } = ctx;
  const half = Math.tan(camera.fov * Math.PI / 360);
  // (the TV can be backed off from a fair way, across the room, so an upright tablet still gets all of it in; a phone can't)
  const dist = Math.min(kind === 'tv' ? 3.6 : 2.4, 1.22 * Math.max(s.h / 2 / half, s.w / 2 / (half * camera.aspect)));
  let tt, dir = s.dir;
  if (s.at) tt = new THREE.Vector3(s.at[0] * K, s.at[1], s.at[2]);
  else { tt = S.stadium.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.04, 0)); if (tt.z > -4.6) dir = [0, 0.85, 0.6]; }
  const tp = tt.clone().addScaledVector(new THREE.Vector3(...dir).normalize(), dist);
  const from = { p: camera.position.clone(), t: controls.target.clone() };
  closeCard(); closeGame(); stopWallDarts(); sfx('swoosh');
  document.querySelectorAll('[data-cam]').forEach(b => b.classList.remove('on'));
  S.watch = kind === 'tv' || kind === 'darts' ? { x: tt.x, z: tt.z } : null;   // anyone between the camera and the TV or the board steps out of the picture
  controls.enabled = false;   // the camera holds still (no orbiting or zooming) until the game is closed
  // leaving: back where the camera was, except from the TV: square on to it, a step further back, so the match really on
  // can be watched
  const back = () => {
    S.watch = null; controls.enabled = true;
    let p = from.p, t = from.t;
    if (kind === 'tv') { t = new THREE.Vector3((TVX + 0.075) * K, TVY, TVZ); p = t.clone().addScaledVector(new THREE.Vector3(1, 0.3, 0).normalize(), dist * 1.15); }   // over the players' heads
    camTween = { fp: camera.position.clone(), ft: controls.target.clone(), tp: p, tt: t, t: 0, dur: 0.7 };
  };
  // a quick flight in, then the game: darts on the board on the wall itself, the others in a window
  camTween = { fp: from.p.clone(), ft: from.t.clone(), tp, tt, t: 0, dur: 0.6, done: () => (kind === 'darts' ? playWallDarts(root, back) : openGame(kind, root, back)) };
}

// ---------------------------------------------------------------- wiring the buttons and the canvas; returns an unbind function
export function bindHUD(root, stage) {
  const off = [];
  const on = (el, ev, fn) => { if (!el) return; el.addEventListener(ev, fn); off.push(() => el.removeEventListener(ev, fn)); };
  camTween = null;

  on($('closeCard'), 'click', closeCard);
  on($('cInvite'), 'click', () => {
    const sel = S.selected; if (!sel) return;
    // invited to spin tops (the TV's nearly always full): with whoever else is sitting down
    const r = inviteTops(sel);
    if (r === 'busy') { sel.say('陀螺有人在打了，等下一場'); return; }
    if (r === 'alone') { sel.say('沒人陪我打啦'); return; }
    S.owner.say(`${sel.p.name}，去打一場陀螺啦！`); sel.say('好啊！Go Shoot！');
    fillCard();
  });
  root.querySelectorAll('[data-cam]').forEach(b => on(b, 'click', () => setCam(b.dataset.cam)));
  off.push(closeGame, stopWallDarts, () => { neonTimers.forEach(clearTimeout); neonTimers = []; });
  root.querySelectorAll('[data-speed]').forEach(b => on(b, 'click', () => {
    S.speed = +b.dataset.speed; root.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b));
  }));
  on($('tagToggle'), 'click', e => { S.showTags = !S.showTags; e.currentTarget.classList.toggle('on', S.showTags); });
  // a soft pop for the HUD's buttons (camera moves swoosh instead; the games make their own sounds), and the sound switch
  on(root, 'click', e => {
    const b = e.target.closest('button, a.tile');
    if (!b || b.closest('.gamePad, .dartsHud') || b.matches('[data-cam], #sfxToggle, .gameSound')) return;
    sfx(b.classList.contains('on') || b.id === 'closeCard' || b.classList.contains('gameClose') ? 'popDown' : 'pop');
  });
  const sfxBtn = $('sfxToggle'), showSfx = () => sfxBtn?.classList.toggle('on', !sfxMuted());
  showSfx(); on(sfxBtn, 'click', () => { toggleSfx(); showSfx(); sfx('pop'); });
  // the background music: starts with the first touch anywhere (browsers won't play before one), and its own switch
  const musicBtn = $('musicToggle'), showMusic = () => musicBtn?.classList.toggle('on', musicOn());
  showMusic(); on(musicBtn, 'click', () => { toggleMusic(); showMusic(); });
  on(root, 'pointerdown', () => startMusic());
  off.push(stopMusic);
  on($('tvCard'), 'click', () => setCam('tv'));
  const stopTween = () => { camTween = null; root.querySelectorAll('[data-cam]').forEach(b => b.classList.remove('on')); };
  ctx.controls.addEventListener('start', stopTween); off.push(() => ctx.controls.removeEventListener('start', stopTween));

  const canvas = ctx.renderer.domElement;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hit = e => {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    const stadium = [], menu = [];
    if (S.stadium?.visible) S.stadium.traverse(o => { if (o.isMesh) stadium.push(o); });
    S.menuClip?.traverse(o => { if (o.isMesh) menu.push(o); });
    const targets = []; S.people.forEach(p => p.g.traverse(o => { if (o.isMesh) targets.push(o); })); targets.push(S.tvScreen, S.tvFrame, S.dartboard, S.neonSwitch?.hit, ...stadium, ...menu);
    const h = ray.intersectObjects(targets.filter(Boolean), false)[0];
    if (!h) return null;
    if (h.object === S.neonSwitch?.hit) return 'neon';
    if (menu.includes(h.object)) return 'menu';
    if (h.object === S.tvScreen || h.object === S.tvFrame) return 'tv';
    if (h.object === S.dartboard) return 'darts';
    if (stadium.includes(h.object)) return 'tops';
    return h.object.userData.person || null;
  };
  let downAt = null, hoverT = 0;
  on(canvas, 'pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  on(canvas, 'pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const h = hit(e);
    if (h === 'menu') setCam('menu');   // the clipboard on the bar: lean over and read it
    else if (h === 'neon') toggleNeon();
    else if (typeof h === 'string') playAt(h, root); else if (h) openCard(h); else closeCard();
  });
  on(canvas, 'pointermove', e => {
    if (e.pointerType !== 'mouse' || performance.now() - hoverT < 80) return;
    hoverT = performance.now();
    canvas.style.cursor = hit(e) ? 'pointer' : '';
  });
  const resize = () => {
    const w = stage.clientWidth || window.innerWidth, h = stage.clientHeight || window.innerHeight;
    ctx.camera.aspect = w / h; ctx.camera.updateProjectionMatrix();
    ctx.renderer.setSize(w, h);
  };
  on(window, 'resize', resize);
  resize();
  const hintT = setTimeout(() => { const h = $('hint'); if (h) h.style.opacity = 0; }, 9000);
  off.push(() => clearTimeout(hintT));
  return () => off.forEach(f => f());
}

// ---------------------------------------------------------------- tags, bubbles and floating text follow the 3D positions
const v3 = new THREE.Vector3();
export function updateLabels(dt, W, H) {
  const toScreen = (x, y, z) => { v3.set(x, y, z).project(ctx.camera); return [v3.z < 1 && Math.abs(v3.x) < 1.2 && Math.abs(v3.y) < 1.2, (v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; };
  S.people.forEach(p => {
    const [vis, x, y] = toScreen(p.g.position.x, p.g.position.y + 1.82, p.g.position.z);
    p.tag.style.display = vis && S.showTags ? '' : 'none';
    p.tag.style.left = x + 'px'; p.tag.style.top = y + 'px';
    p.bubble.style.display = vis ? '' : 'none';
    p.bubble.style.left = x + 'px'; p.bubble.style.top = (y - (S.showTags ? 24 : 4)) + 'px';
  });
  for (let i = S.floaters.length - 1; i >= 0; i--) {
    const f = S.floaters[i]; f.life -= dt;
    if (f.life <= 0) { f.el.remove(); S.floaters.splice(i, 1); continue; }
    const k = 1 - f.life / f.max;
    const [vis, x, y] = toScreen(f.pos.x, f.pos.y + k * 0.5, f.pos.z);
    f.el.style.display = vis ? '' : 'none'; f.el.style.left = x + 'px'; f.el.style.top = y + 'px'; f.el.style.opacity = Math.min(1, f.life * 2);
  }
}
