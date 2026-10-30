// The HUD overlay: clock and takings, the TV score panel, the person card, camera presets, clicking on people,
// and the name tags / bubbles that follow people around the screen.
import * as THREE from 'three';
import { ctx } from './engine.js';
import { S } from './state.js';
import { $, K } from './util.js';
import { sayLine } from './content.js';
import { fmtTime } from './feed.js';
import { matchClock } from './tv.js';
import { DAYS, canJoinTv, trySpawn } from './sim.js';
import { tvGames, GAME_LABEL } from './profiles.js';

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
export function openCard(p) { S.selected = p; $('card').hidden = false; fillCard(); }
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
  $('cInvite').hidden = !(s.role === 'customer' && tvGames(p).length && s.seat && s.seat.type === 'table' && !s.invited && !s.tops && !S.closing);
}

// ---------------------------------------------------------------- camera presets
const CAMS = {
  overview: { pos: [9, 13, 11], target: [0, 0.5, -1.5] },
  counter: { pos: [-1.9, 2.3, 2.9], target: [1.2, 1.1, -0.9] },
  menu: { pos: [0.22, 1.5, 2.3], target: [0.6, 1.06, 2.3] },   // leaning over the bar from the customer side, reading the clipboard
  tv: { pos: [1.0, 1.7, -1.8], target: [-2.5, 0.9, -3.5] },
  porch: { pos: [-1.0, 3.3, 4.3], target: [-1.0, 0.3, 7.6] },   // from above the door, looking out over both chair rows to the kerb
  back: { pos: [5, 7, -1.5], target: [0.2, 0.5, -6.6] }
};
let camTween = null;
function setCam(name) {
  const c = CAMS[name], { camera, controls } = ctx;
  camTween = { fp: camera.position.clone(), ft: controls.target.clone(), tp: new THREE.Vector3(c.pos[0] * K, c.pos[1], c.pos[2]), tt: new THREE.Vector3(c.target[0] * K, c.target[1], c.target[2]), t: 0 };
  document.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === name));
}
export function updateCamera(dt) {
  if (!camTween) return;
  camTween.t = Math.min(1, camTween.t + dt / 1.2);
  const e = 1 - Math.pow(1 - camTween.t, 3);
  ctx.camera.position.lerpVectors(camTween.fp, camTween.tp, e);
  ctx.controls.target.lerpVectors(camTween.ft, camTween.tt, e);
  if (camTween.t >= 1) camTween = null;
}

// ---------------------------------------------------------------- wiring the buttons and the canvas; returns an unbind function
export function bindHUD(root, stage) {
  const off = [];
  const on = (el, ev, fn) => { if (!el) return; el.addEventListener(ev, fn); off.push(() => el.removeEventListener(ev, fn)); };
  camTween = null;

  on($('closeCard'), 'click', closeCard);
  on($('cInvite'), 'click', () => {
    const sel = S.selected; if (!sel) return;
    if (!canJoinTv(sel)) { sayLine(sel, 'customer.inviteFull'); return; }
    sel.invited = true; sayLine(sel, 'customer.inviteAccept'); sayLine(S.owner, 'owner.invite', { name: sel.p.name });
    fillCard();
  });
  root.querySelectorAll('[data-cam]').forEach(b => on(b, 'click', () => setCam(b.dataset.cam)));
  root.querySelectorAll('[data-speed]').forEach(b => on(b, 'click', () => {
    S.speed = +b.dataset.speed; root.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b));
  }));
  on($('tagToggle'), 'click', e => { S.showTags = !S.showTags; e.currentTarget.classList.toggle('on', S.showTags); });
  on($('spawnBtn'), 'click', () => trySpawn(true));
  on($('tvCard'), 'click', () => setCam('tv'));
  const stopTween = () => { camTween = null; root.querySelectorAll('[data-cam]').forEach(b => b.classList.remove('on')); };
  ctx.controls.addEventListener('start', stopTween); off.push(() => ctx.controls.removeEventListener('start', stopTween));

  const canvas = ctx.renderer.domElement;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hit = e => {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    const targets = []; S.people.forEach(p => p.g.traverse(o => { if (o.isMesh) targets.push(o); })); targets.push(S.tvScreen, S.tvFrame);
    const h = ray.intersectObjects(targets, false)[0];
    if (!h) return null;
    if (h.object === S.tvScreen || h.object === S.tvFrame) return 'tv';
    return h.object.userData.person || null;
  };
  let downAt = null, hoverT = 0;
  on(canvas, 'pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  on(canvas, 'pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const h = hit(e);
    if (h === 'tv') setCam('tv'); else if (h) openCard(h); else closeCard();
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
