// The HUD overlay: clock and takings, the TV score panel, the person card, camera presets, clicking on people,
// and the name tags / bubbles that follow people around the screen.
import * as THREE from 'three';
import { ctx } from './engine.js';
import { S } from './state.js';
import { $, K, pick } from './util.js';
import { fmtTime, log } from './feed.js';
import { matchClock } from './tv.js';
import { DAYS, smokeState, sendOutToSmoke } from './sim.js';
import { sayLine } from './content.js';
import { canInviteTops, inviteTops } from './tops.js';
import { portraitOf, petPortraitOf } from './portrait.js';
import { makeDog, makeCorgi } from './dog.js';
import { makeBear } from './bear.js';
import { setStoreLight, setToiletLight } from './world/lights.js';
import { setQuality, DEFAULT_QUALITY } from './quality.js';
import { tvGames, GAME_LABEL } from './profiles.js';
import { openGame, closeGame } from './games.js';
import { playWallDarts, stopWallDarts } from './wallDarts.js';
import { sfx, sfxMuted, toggleSfx, audio } from './sfx.js';
import { startMusic, stopMusic, toggleMusic, musicOn } from './music.js';
import { TVX, TVY, TVZ } from './layout.js';
import { bindMenu } from './rpgMenu.js';

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
export function openCard(p) { setAcOpen(false, true); S.selected = p; $('card').hidden = false; fillCard(); sfx('boop'); }
export function closeCard() { S.selected = null; stopFollow(); const card = $('card'); if (card) card.hidden = true; }
// a companion's card (配件: 路易斯, 夜叉丸, 蘿蔔糕): what it is, whose it is, a line about it, what it says, what it's up to
const PET_INFO = {
  bear: { kind: '聚酯纖維', note: '總是飛在主人的肩膀旁', make: makeBear },
  dog: { kind: '博美狗', note: '有脫毛症，只剩頭跟背上一小塊還是蓬蓬的毛', make: makeDog },
  corgi: { kind: '柯基', note: '短腿長身，金黃色的毛，長長的尾巴', make: makeCorgi },
};
export function openPetCard(owner) { S.selected = { pet: owner.bear, owner }; $('card').hidden = false; fillCard(); sfx('boop'); }
function fillPetCard(s) {
  const pet = s.pet, info = PET_INFO[pet.kind] || PET_INFO.dog;
  $('cName').textContent = pet.name;
  const av = $('cAvatar'), pic = petPortraitOf(pet.kind, info.make); if (av.getAttribute('src') !== pic) av.setAttribute('src', pic);
  const kind = $('cKind'); kind.className = 'kind pet'; kind.textContent = '配件 · ' + info.kind;
  const dl = $('cInfo'); dl.innerHTML = '';
  [['種類', info.kind], ['主人', s.owner.p.name], ['特徵', info.note], ['口頭禪', pet.line]].forEach(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); });
  $('cStatus').textContent = '現在：' + (pet.kind === 'bear' ? '在主人肩膀旁飛來飛去' : pet.wander ? '在店裡到處閒晃' : '跟在主人身邊');
  $('cInvite').hidden = true; $('cSmoke').hidden = true;
}
export function fillCard() {
  const s = S.selected; if (!s) return;
  if (s.pet) return fillPetCard(s);
  const p = s.p;
  $('cName').textContent = p.name;
  const av = $('cAvatar'), pic = portraitOf(s); if (av.getAttribute('src') !== pic) av.setAttribute('src', pic);
  const kind = $('cKind');
  kind.className = 'kind ' + (s.role === 'owner' ? 'boss' : p.regular ? 'reg' : 'new');
  kind.textContent = s.role === 'owner' ? '老闆 · 一人顧店' : p.regular ? '熟客' : '新客';
  const rows = s.role === 'owner'
    ? [['身分', p.job], ['今日出杯', S.cupsSold + ' 杯'], ['待做訂單', S.orderQueue.length + ' 張'], ['營業時間', '15:00 起']]
    : [['職業', p.job], ['來店次數', p.visits + ' 次'], ['常點', s.drink || p.drink],
      ...(p.plays2k ? [['2K 主隊', p.team]] : []), ...(p.playsFight ? [['快打旋風角色', p.fighter]] : []),
      ...(tvGames(p).length ? [['電動戰績', `${p.wins} 勝 ${p.losses} 敗`]] : []), ...(p.playsTops ? [['戰鬥陀螺', '會玩']] : []),
      ...(p.smokes ? [['抽菸', '會']] : []),
      ...(p.seatPref === 'porch' ? [['座位偏好', '戶外區']] : p.seatPref === 'inside' ? [['座位偏好', '室內']] : []),
      ['小檔案', p.quirk]];
  const dl = $('cInfo'); dl.innerHTML = '';
  // 小檔案, the longest, gets a whole row of its own under the rest, so the card stays short
  rows.forEach(([k, v]) => {
    const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v;
    if (k === '小檔案') { dt.className = 'wide'; dd.className = 'wide'; }
    dl.append(dt, dd);
  });
  $('cStatus').textContent = '現在：' + s.status;
  $('cInvite').hidden = !(s.role === 'customer' && canInviteTops(s));
  // 來根小菸: for anyone who smokes; greyed out, saying why, when they can't go just now
  const smoke = $('cSmoke'), st = s.role === 'customer' && p.smokes ? smokeState(s) : null;
  smoke.hidden = !st;
  if (st) {
    smoke.disabled = st !== 'ready';
    smoke.textContent = { ready: '來根小菸', gaming: '來根小菸（正在遊戲中）', smoking: '來根小菸（正在抽了）', going: '來根小菸（正要出去抽）', busy: '來根小菸（現在走不開）' }[st];
  }
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

// ---------------------------------------------------------------- the AC remote: what the owner says over it
// by what the remote is set to: on (turning it on in that mode), off (turning it off from that mode) and to (switching
// to that mode while it's running; switching while it's off just changes the setting, nobody says anything)
const AC_LINES = {
  cool: {
    on: ['涼～開冷氣了', '天氣熱，開一下冷氣', '呼～舒服多了'],
    off: ['冷氣關囉，開門透氣一下', '省個電，開門通風就好', '關冷氣，空氣流通一下'],
    to: ['換冷氣，涼一下', '還是開冷氣好了', '太熱了，切冷氣'],
  },
  heat: {
    on: ['好冷～開個暖氣', '天氣冷，開一下暖氣', '開暖氣，暖和一點'],
    off: ['暖氣關囉，開門透透氣', '夠暖了，關暖氣吧', '關暖氣，空氣流通一下'],
    to: ['換暖氣，暖一下', '有點冷，切暖氣', '還是開暖氣好了'],
  },
  dry: {
    on: ['有點潮，開個除濕', '濕濕黏黏的，除濕一下', '開除濕，咖啡豆怕潮'],
    off: ['除濕關囉，開門透透氣', '乾爽多了，關掉吧', '關除濕，空氣流通一下'],
    to: ['換除濕，有點悶', '濕氣好重，切除濕', '咖啡豆怕潮，除濕一下'],
  },
  fan: {
    on: ['開個送風就好', '吹吹風，不用開冷', '送風就夠了'],
    off: ['送風關囉，開門透透氣', '關掉送風吧', '關送風，開門通風就好'],
    to: ['換送風，吹吹風就好', '不用那麼冷，送風就好', '切送風，省點電'],
  },
};
// 風量: 自動, then 弱 / 中 / 強 (one, two, three bars lit on the screen); 左右 / 上下 風向: swinging (自動), then held
// at one of five louvre positions, left to right / level to straight down (the louvre icon's wedge in use lit)
const WINDS = ['auto', '弱', '中', '強'];
const SWING_STEPS = ['auto', 0, 1, 2, 3, 4];
const MODE_NAMES = { cool: '冷氣', heat: '暖氣', dry: '除濕', fan: '送風' };
const MODES = ['cool', 'heat', 'dry', 'fan'];
// have the remote fly in square-on (click its head) or lean back out to the edge; silent when the card needs the room
function setAcOpen(open, silent) {
  const r = $('acRemote'); if (!r) return;
  r.classList.toggle('open', open);
  $('acHead')?.setAttribute('aria-expanded', String(open));
  if (!silent) sfx(open ? 'pop' : 'popDown');
}

// ---------------------------------------------------------------- camera presets
// (phone: its own framing for a tall, narrow screen, where the wide one would show a slice of the wrong thing)
const CAMS = {
  overview: { pos: [9, 13, 11], target: [0, 0.5, -1.5] },
  counter: { pos: [-1.9, 2.3, 2.9], target: [1.2, 1.1, -0.9] },
  menu: { pos: [0.22, 1.5, 2.3], target: [0.6, 1.06, 2.3] },   // leaning over the bar from the customer side, reading the clipboard
  // over the players' heads, the TV on the purple wall and the doorway to the back beside it
  tv: { pos: [0.5, 2.9, -1.7], target: [-2.3, 0.7, -3.9], phone: { pos: [0.4, 3.0, -1.4], target: [-2.4, 1.25, -3.0] } },
  // from just outside the door, high under the balcony, looking down over the crate table to the chairs along the wall
  porch: { pos: [1.6, 2.6, 4.7], target: [-1.4, 0.3, 6.2], phone: { pos: [1.3, 3.0, 4.3], target: [-0.8, 0.3, 6.3] } },
  // from over the back corridor: the stadium on its crates, the toilet door, the storeroom through its doorway
  back: { pos: [-2.8, 4.4, -4.1], target: [-0.4, 0.2, -6.6], phone: { pos: [-2.6, 4.8, -4.1], target: [-1.0, 0.25, -7.3] } }
};
let camTween = null;
let menu = null;   // the RPG menu's handles, while the HUD is bound
function setCam(name) {
  stopFollow();
  const rec = $('camRec'); if (rec) rec.hidden = true;
  const { camera, controls } = ctx, c = (camera.aspect < 0.8 && CAMS[name].phone) || CAMS[name];
  camTween = { fp: camera.position.clone(), ft: controls.target.clone(), tp: new THREE.Vector3(c.pos[0] * K, c.pos[1], c.pos[2]), tt: new THREE.Vector3(c.target[0] * K, c.target[1], c.target[2]), t: 0 };
  document.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === name));
  sfx('swoosh');
}
// ---------------------------------------------------------------- following someone: the camera flies over to them and
// keeps them in the middle as they walk about, still free to orbit and zoom round them. It lets go when their card
// closes, they leave, another view is picked, or a game starts
let follow = null;   // { obj, name, outside }
const followPt = new THREE.Vector3(), followUp = new THREE.Vector3(0, 0.75, 0);
const followPoint = obj => obj.getWorldPosition(followPt).add(follow?.up || followUp);   // about waist high, so the head sits above the middle
// where the camera sits, from them: inside, from high over the front corner the way the overview looks in (the
// cutaway has no roof, and a low camera would be behind a wall); out under the arcade or on the street, low from the
// street, as the porch view looks (from up high the balcony above hides them)
const FOLLOW_IN = new THREE.Vector3(0.45, 0.75, 0.5).normalize().multiplyScalar(4.6);
const FOLLOW_OUT = new THREE.Vector3(0, 0.33, 1).normalize().multiplyScalar(3.6);
// something small on the floor, the cockroach: one distance, in or out, from well further off than for a person; in,
// the same way the overview looks in, out from the street side, still low enough to look in under the balcony (much
// more than 0.6 up and the balcony hides the porch)
const FLOOR_DIST = 8.5;
const FOLLOW_FLOOR_IN = FOLLOW_IN.clone().setLength(FLOOR_DIST);
const FOLLOW_FLOOR_OUT = new THREE.Vector3(0, 0.45, 1).setLength(FLOOR_DIST);
const isOutside = obj => obj.getWorldPosition(followPt).z > 4.6;   // past the front door (DOOR in layout.js)
// a fly to them, from wherever the camera is now (further off on a tall, narrow phone screen)
function followTween(dur) {
  const { camera, controls } = ctx;
  const off = (follow.floor ? (follow.outside ? FOLLOW_FLOOR_OUT : FOLLOW_FLOOR_IN) : (follow.outside ? FOLLOW_OUT : FOLLOW_IN)).clone().multiplyScalar(Math.sqrt(Math.max(1, 0.9 / camera.aspect)));
  camTween = { fp: camera.position.clone(), ft: controls.target.clone(), tp: new THREE.Vector3(), tt: new THREE.Vector3(), t: 0, dur, follow: off };
}
// (floor: something small on the floor, the cockroach: from FLOOR_DIST, so whoever's round it, and what happens next,
// is in the picture too, looking at the floor round it. It's only a fly-over to show where it is: the first drag,
// zoom or Esc lets the camera go)
function startFollow(obj, name, floor) {
  if (!obj) return;
  follow = { obj, name, outside: isOutside(obj), floor: !!floor, up: floor ? new THREE.Vector3(0, 0.3, 0) : null, loose: !!floor };
  followTween(0.8);
  document.querySelectorAll('[data-cam]').forEach(b => b.classList.remove('on'));
  const rec = $('camRec'); if (rec) rec.hidden = true;   // (the monitor's channel is only for the monitor's own views)
  sfx('swoosh');
}
function stopFollow() {
  if (!follow) return;
  follow = null;
  if (camTween?.follow) camTween = null;
}
// a person's card, and the camera on them
export function focusPerson(p) { openCard(p); startFollow(p.g, p.p.name); }
export function updateCamera(dt) {
  if (follow && !follow.obj.parent) { stopFollow(); }   // gone (out of the door and off along the lane)
  // through the front door, in or out: the camera swings round to the other angle
  if (follow && isOutside(follow.obj) !== follow.outside) { follow.outside = !follow.outside; followTween(1.2); }
  if (camTween) {
    camTween.t = Math.min(1, camTween.t + dt / (camTween.dur || 1.2));
    const e = 1 - Math.pow(1 - camTween.t, 3);
    if (camTween.follow) { camTween.tt.copy(followPoint(follow.obj)); camTween.tp.copy(camTween.tt).add(camTween.follow); }   // they may be walking
    ctx.camera.position.lerpVectors(camTween.fp, camTween.tp, e);
    ctx.controls.target.lerpVectors(camTween.ft, camTween.tt, e);
    if (camTween.t >= 1) { const done = camTween.done; camTween = null; done?.(); }
    return;
  }
  if (!follow) return;
  // keep up with them: the target eases onto them and the camera moves by the same amount, so the angle and zoom
  // someone has orbited to are kept
  const d = followPoint(follow.obj).sub(ctx.controls.target).multiplyScalar(1 - Math.exp(-dt * 6));
  ctx.controls.target.add(d); ctx.camera.position.add(d);
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
  closeCard(); closeGame(); stopWallDarts(); menu?.closeMenu(); sfx('swoosh');
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
  on($('cSmoke'), 'click', () => { const sel = S.selected; if (sel) { sendOutToSmoke(sel); fillCard(); } });
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
  // 畫質: 高效能 (shadows redrawn every frame, everything casting its own; the default) or 一般 (drawn once)
  // one switch in the menu's 系統, flipping between the two
  const qBtn = $('qualityToggle'), showQ = () => {
    const high = (S.quality || DEFAULT_QUALITY) === 'high';
    $('qualityVal').textContent = high ? '高' : '低';
    qBtn.title = high ? '高：每秒 60 張、完整解析度，影子每張重算' : '低：每秒 30 張、解析度較低，影子只算一次（省電）';
  };
  showQ(); on(qBtn, 'click', () => { setQuality((S.quality || DEFAULT_QUALITY) === 'high' ? 'normal' : 'high'); showQ(); });
  // the AC remote: leans out of the right edge at an angle with just the corner of its head showing; click it to
  // have it fly in square-on, click the head again to let it lean back out. Off, the doors stand open for air and
  // the outdoor unit's fan slows to a stop (index.js); mode, temp and fan are the remote's own settings, drawn on
  // its screen like a digital watch
  const remote = $('acRemote');
  // the little red lamp in the head blinks once per key press, the way a real remote's IR lamp does
  const led = remote.querySelector('.acLed');
  let ledTimer;
  const blink = () => { led.classList.add('flash'); clearTimeout(ledTimer); ledTimer = setTimeout(() => led.classList.remove('flash'), 160); };
  const showAc = () => {
    remote.classList.toggle('on', S.ac.on);
    remote.dataset.mode = S.ac.mode;
    const t = String(S.ac.temp), digits = $('acSeg').children;
    digits[0].dataset.val = t.length > 1 ? t[0] : '';
    digits[1].dataset.val = t[t.length - 1];
    $('acModeName').textContent = MODE_NAMES[S.ac.mode];
    const lv = WINDS.indexOf(S.ac.fan);
    remote.classList.toggle('fanAuto', S.ac.fan === 'auto');
    $('acFanVal').textContent = S.ac.fan === 'auto' ? '自動' : '';
    [...$('acFanBars').children].forEach((b, i) => b.classList.toggle('on', i < lv));
    // swinging, the cell just says so (左右自動 / 上下自動); held, it shows the louvre icon with that wedge lit
    [['swingH', 'acSwingH', 'acPosH', '左右'], ['swingV', 'acSwingV', 'acPosV', '上下']].forEach(([k, txt, pos, name]) => {
      if (!SWING_STEPS.includes(S.ac[k])) S.ac[k] = 'auto';
      const auto = S.ac[k] === 'auto';
      $(txt).textContent = auto ? name + '自動' : '';
      $(pos).style.display = auto ? 'none' : '';
      [...$(pos).querySelectorAll('.ray')].forEach((t, i) => t.classList.toggle('on', i === S.ac[k]));
    });
  };
  remote.classList.remove('open'); $('acHead')?.setAttribute('aria-expanded', 'false');
  showAc();
  // the look: 8-bit (.px) to start with, or moulded plastic once someone swaps to it; only a swap is saved, so this
  // device keeps what it last picked (a new key: the first version saved its starting look as if it had been picked)
  const SKIN_KEY = 'acRemoteSkin';
  const skinBtn = $('acSkin');
  const setSkin = (px, save) => {
    remote.classList.toggle('px', px);
    skinBtn.setAttribute('aria-pressed', String(px));
    if (save) try { localStorage.setItem(SKIN_KEY, px ? 'px' : 'real'); } catch {}
  };
  let savedSkin = null;
  try { savedSkin = localStorage.getItem(SKIN_KEY); localStorage.removeItem('acSkin'); } catch {}
  setSkin(savedSkin !== 'real');
  // 換一隻遙控: the one in hand slides off to the right and the other one slides back in its place
  let swapTimer;
  on(skinBtn, 'click', () => {
    if (remote.classList.contains('swapping')) return;
    sfx('beep');
    remote.classList.add('swapping');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => { setSkin(!remote.classList.contains('px'), true); remote.classList.remove('swapping'); }, 280);
  });
  on(remote, 'click', e => {
    if (remote.classList.contains('open')) { if (e.target.closest('#acHead')) setAcOpen(false); }
    else setAcOpen(true);
  });
  on($('acPower'), 'click', () => {
    S.ac.on = !S.ac.on;
    showAc(); sfx('beep'); blink();
    log(MODE_NAMES[S.ac.mode] + (S.ac.on ? '開啟' : '關閉'));
    S.owner?.say(pick(AC_LINES[S.ac.mode][S.ac.on ? 'on' : 'off']));
  });
  on($('acDown'), 'click', () => { S.ac.temp = Math.max(16, S.ac.temp - 1); showAc(); sfx('beep'); blink(); });
  on($('acUp'), 'click', () => { S.ac.temp = Math.min(30, S.ac.temp + 1); showAc(); sfx('beep'); blink(); });
  on($('acWind'), 'click', () => { S.ac.fan = WINDS[(WINDS.indexOf(S.ac.fan) + 1) % WINDS.length]; showAc(); sfx('beep'); blink(); });
  const flipSwing = k => { S.ac[k] = SWING_STEPS[(SWING_STEPS.indexOf(S.ac[k]) + 1) % SWING_STEPS.length]; showAc(); sfx('beep'); blink(); };
  on($('acSwingHBtn'), 'click', () => flipSwing('swingH'));
  on($('acSwingVBtn'), 'click', () => flipSwing('swingV'));
  on($('acMode'), 'click', () => {
    S.ac.mode = MODES[(MODES.indexOf(S.ac.mode) + 1) % MODES.length]; showAc(); sfx('beep'); blink();
    if (S.ac.on) { log('切換為' + MODE_NAMES[S.ac.mode]); S.owner?.say(pick(AC_LINES[S.ac.mode].to)); }
  });
  // a soft pop for the HUD's buttons (camera moves swoosh instead; the games make their own sounds), and the sound
  // switches in the menu's 系統
  on(root, 'click', e => {
    const b = e.target.closest('button, a.tile');
    if (!b || b.closest('.gamePad, .dartsHud, #acRemote') || b.matches('[data-cam], #sfxToggle, .gameSound')) return;
    sfx(b.classList.contains('on') || b.id === 'closeCard' || b.classList.contains('gameClose') ? 'popDown' : 'pop');
  });
  const sfxBtn = $('sfxToggle'), showSfx = () => sfxBtn?.classList.toggle('on', !sfxMuted());
  showSfx(); on(sfxBtn, 'click', () => { toggleSfx(); showSfx(); sfx('pop'); });
  // the background music: starts with the first touch anywhere (browsers won't play before one), and its own switch
  const musicBtn = $('musicToggle'), showMusic = () => musicBtn?.classList.toggle('on', musicOn());
  showMusic(); on(musicBtn, 'click', () => { toggleMusic(); showMusic(); });
  // the RPG menu (rpgMenu.js)
  menu = bindMenu(root, on, off, { setCam, focusPerson, followThing: startFollow, setAcOpen });
  off.push(() => { menu = null; });
  // every touch, click or key wakes the sound: a finger's pointerdown doesn't count as a gesture on phones (only its
  // pointerup / touchend do), and after a hidden tab or a call the sound has to be woken again
  const wake = () => { if (!sfxMuted()) audio(); startMusic(); };
  ['pointerdown', 'pointerup', 'touchend'].forEach(t => on(root, t, wake));
  on(window, 'keydown', wake);
  off.push(stopMusic);
  on($('tvCard'), 'click', () => setCam('tv'));
  // a drag stops a camera move (while following someone it orbits round them instead, and the follow carries on)
  // (a loose follow, the cockroach's, lets go altogether)
  const stopTween = () => { camTween = null; if (follow?.loose) stopFollow(); root.querySelectorAll('[data-cam]').forEach(b => b.classList.remove('on')); menu?.hideRec(); };
  ctx.controls.addEventListener('start', stopTween); off.push(() => ctx.controls.removeEventListener('start', stopTween));
  on(window, 'keydown', e => { if (e.key === 'Escape' && follow?.loose) stopFollow(); });

  const canvas = ctx.renderer.domElement;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hit = e => {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    const stadium = [], menu = [], fans = [];
    (S.fanUnits || []).forEach(f => f.traverse(o => { if (o.isMesh) fans.push(o); }));
    if (S.stadium?.visible) S.stadium.traverse(o => { if (o.isMesh) stadium.push(o); });
    S.menuClip?.traverse(o => { if (o.isMesh) menu.push(o); });
    const laptop = []; S.laptop?.traverse(o => { if (o.isMesh) laptop.push(o); });
    const targets = []; S.people.forEach(p => { p.g.traverse(o => { if (o.isMesh) targets.push(o); }); p.bear?.g.traverse(o => { if (o.isMesh) targets.push(o); }); }); targets.push(S.tvScreen, S.tvFrame, S.dartboard, S.neonSwitch?.hit, S.storeLight?.hit, S.toiletLight?.hit, ...stadium, ...menu, ...fans, ...laptop);
    const h = ray.intersectObjects(targets.filter(Boolean), false)[0];
    if (!h) return null;
    if (h.object === S.neonSwitch?.hit) return 'neon';
    if (h.object === S.storeLight?.hit) return 'storeLight';
    if (h.object === S.toiletLight?.hit) return 'toiletLight';
    if (h.object.userData.fanBlades) return { fan: h.object.userData.fanBlades };
    if (menu.includes(h.object)) return 'menu';
    if (laptop.includes(h.object)) return 'laptop';
    if (h.object === S.tvScreen || h.object === S.tvFrame) return 'tv';
    if (h.object === S.dartboard) return 'darts';
    if (stadium.includes(h.object)) return 'tops';
    if (h.object.userData.bearOf) return { bearOf: h.object.userData.bearOf };
    return h.object.userData.person || null;
  };
  let downAt = null, hoverT = 0;
  on(canvas, 'pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  on(canvas, 'pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const h = hit(e);
    if (h === 'menu') setCam('menu');   // the clipboard on the bar: lean over and read it
    else if (h === 'laptop') { sfx('pop'); window.location.href = '/admin'; }   // the owner's laptop: into the back office
    else if (h === 'neon') toggleNeon();
    else if (h === 'storeLight') { setStoreLight(!S.storeLight.on); sfx('flick'); }
    else if (h === 'toiletLight') {
      const on = !S.toiletLight.on; setToiletLight(on); sfx('flick');
      // switched off on someone squatting in there: they shout through the door
      const u = S.toiletUser; if (!on && u) sayLine(u, 'customer.toiletDark', { name: u.p.name }, 2.6);
    }
    else if (h && h.fan) { h.fan.userData.fan.on = !h.fan.userData.fan.on; sfx('flick'); }   // a ceiling fan: on, or coasting off
    else if (h && h.bearOf) { h.bearOf.bearSay(h.bearOf.bear.line); openPetCard(h.bearOf); startFollow(h.bearOf.bear.g, h.bearOf.bear.name); }   // a companion says its piece (路易斯 愛老公, 夜叉丸 汪！), its card opens and the camera follows it
    else if (typeof h === 'string') playAt(h, root); else if (h) focusPerson(h); else closeCard();
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
    const [vis, x, y] = toScreen(p.g.position.x, p.g.position.y + 1.82 + ((p.heightK || 1) - 1) * 1.44, p.g.position.z);   // (over the head, however tall they are)
    p.tag.style.display = vis && S.showTags ? '' : 'none';
    p.tag.style.left = x + 'px'; p.tag.style.top = y + 'px';
    p.bubble.style.display = vis ? '' : 'none';
    p.bubble.style.left = x + 'px'; p.bubble.style.top = (y - (S.showTags ? 24 : 4)) + 'px';
    if (p.bear) {
      const bp = p.bear.g.position, [bv, bx, by] = toScreen(bp.x, bp.y + (p.bear.bubbleY ?? 0.24), bp.z);   // (just above its head)
      p.bear.bubble.style.display = bv ? '' : 'none'; p.bear.bubble.style.left = bx + 'px'; p.bear.bubble.style.top = by + 'px';
    }
  });
  for (let i = S.floaters.length - 1; i >= 0; i--) {
    const f = S.floaters[i]; f.life -= dt;
    if (f.life <= 0) { f.el.remove(); S.floaters.splice(i, 1); continue; }
    const k = 1 - f.life / f.max;
    const [vis, x, y] = toScreen(f.pos.x, f.pos.y + k * 0.5, f.pos.z);
    f.el.style.display = vis ? '' : 'none'; f.el.style.left = x + 'px'; f.el.style.top = y + 'px'; f.el.style.opacity = Math.min(1, f.life * 2);
  }
}
