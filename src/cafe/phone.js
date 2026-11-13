// 老闆的手機: the owner's phone, left lying beside his laptop on the 工作台, its screen lighting up now and then with a
// message and a little gold sparkle bobbing over it, so it reads as something to pick up. Clicked, it jumps up, spins
// and is gone into the bag (the RPG menu's 道具, where the ？？？ slot turns into it). Used from there it comes up on
// screen as an 8-bit phone: two pages of apps (FB, IG and LINE on the first) and a dock; IG itself in dark mode. IG, 相機
// and 照片 open (the rest just sit there for now): the regulars' direct messages, where a quick reply sent in the
// owner's name calls that regular in to the shop; a camera to snap the café through; and the album of what it took,
// any of which can be sent in a chat.
import * as THREE from 'three';
import { ctx, mat, box } from './engine.js';
import { S, sleep } from './state.js';
import { pick, rand, fill, K } from './util.js';
import { log } from './feed.js';
import { sfx } from './sfx.js';
import { trySpawn } from './sim.js';
import { DEFAULT_LINES } from '../content/catalog';
import { portraitOf } from './portrait.js';

// ---------------------------------------------------------------- the phone on the 工作台
// a little pixel picture as a texture: rows of palette letters, '.' see-through
const PAL = { k: '#14121a', w: '#ffffff', G: '#9a98a6', g: '#55535f', r: '#ff3b3b', y: '#ffd23f', n: '#3ddc97', c: '#7ec8ff',
  b: '#7a4a24', o: '#ff9a3c', p: '#c06cff', B: '#3b78d8', P: '#3a2d6e', V: '#6b3f7c' };
function pixTex(rows) {
  const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } }));
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}
// the lock screen, lying face up: the wallpaper's purple, the time, and a message's white banner
const SCREEN = ['PPPPPPPPPP', 'PPPPPPPPPP', 'PwwPwPwwPP', 'PPwPwPPwPP', 'PwwPwPwwPP', 'PPPPPPPPPP', 'PwwwwwwwwP', 'PwkkkkkkwP',
  'PwwwwwwwwP', 'PPPPPPPPPP', 'VVVVVVVVVV', 'VVVVVVVVVV', 'VVVVVVVVVV', 'VVVVVVVVVV', 'VVVVVVVVVV', 'VVVVVVVVVV',
  'VVVVVVVVVV', 'VVVVVVVVVV', 'VVwwwwwwVV', 'VVVVVVVVVV'];
// the sparkle over it: a gold four-pointed star
const SPARK = ['.......y.......', '.......y.......', '......yyy......', '......yyy......', '.....yywyy.....', '...yyywwwyyy...',
  'yyyyywwwwwyyyyy', '...yyywwwyyy...', '.....yywyy.....', '......yyy......', '......yyy......', '.......y.......',
  '.......y.......', '...............', '...............'];

// on the bare wood on the far side of the laptop from the tea cups (interior.js macbook, at z 0.34)
// (in the laptop's own group, the set squeezed along x like the rest of the shop; the phone itself unsqueezed, in true
// size, the way the bottles on the 工作台 are)
export function buildPhoneProp() {
  const set = S.laptop?.parent ?? ctx.scene;
  const outer = new THREE.Group(); outer.position.set(2.72, 0.962, -0.48); outer.scale.x = 1 / K; set.add(outer);
  const g = new THREE.Group(); g.rotation.y = 0.35; outer.add(g);
  box(0.075, 0.008, 0.155, mat(0x1b1c1f, { roughness: 0.35, metalness: 0.4 }), 0, 0.004, 0, g);
  const screenM = new THREE.MeshBasicMaterial({ map: pixTex(SCREEN), toneMapped: false, color: 0x444444 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.142), screenM);
  screen.rotation.x = -Math.PI / 2; screen.position.y = 0.0085; g.add(screen);
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: pixTex(SPARK), transparent: true, depthTest: false, toneMapped: false }));
  spark.scale.set(0.13, 0.13, 1); spark.position.y = 0.2; spark.renderOrder = 20; g.add(spark);
  S.phoneProp = { outer, g, screen, spark, t: 0, lift: -1, done: null };
}
// everything clickable on it (hud.js)
export function phoneTargets() {
  const out = []; S.phoneProp?.g.traverse(o => { if (o.isMesh || o.isSprite) out.push(o); });
  return out;
}

// picked up: it jumps, spins and swells, then shrinks away into the bag; done() once it's gone
export function pickUpPhone(done) {
  const p = S.phoneProp; if (!p || p.lift >= 0) return;
  p.lift = 0; p.done = done; p.y0 = p.g.position.y;
  sfx('pop');
}
const LIFT = 0.9;   // seconds, from the counter to gone
export function updatePhoneProp(dt) {
  const p = S.phoneProp; if (!p) return;
  p.t += dt;
  if (p.lift < 0) {
    // waiting to be noticed: the sparkle bobs and twinkles; the screen lights up with a message every few seconds
    p.spark.position.y = 0.19 + Math.sin(p.t * 3) * 0.025;
    const tw = 0.85 + Math.sin(p.t * 7) * 0.15;
    p.spark.scale.set(0.13 * tw, 0.13 * tw, 1);
    p.screen.material.color.setHex(p.t % 4.5 < 1.8 ? 0xffffff : 0x444444);
    return;
  }
  p.lift += dt;
  const k = Math.min(1, p.lift / LIFT);
  p.screen.material.color.setHex(0xffffff);
  p.g.position.y = p.y0 + Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) * 0.32;
  p.g.rotation.y += dt * 14;
  p.g.rotation.x = -k * 1.2;   // turning its face up to the camera as it rises
  const s = k < 0.55 ? 1 + k * 1.6 : Math.max(0.001, 1.88 * (1 - (k - 0.55) / 0.45));
  p.g.scale.setScalar(s);
  p.spark.material.opacity = 1 - k;
  p.spark.scale.setScalar(0.13 + k * 0.4);
  if (k >= 1) { const done = p.done; disposePhoneProp(); done?.(); }
}
export function disposePhoneProp() {
  const p = S.phoneProp; if (!p) return;
  p.outer.parent?.remove(p.outer);   // (three r128: no removeFromParent yet)
  p.outer.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
  S.phoneProp = null;
}

// ---------------------------------------------------------------- what's said in it (the back office's 手機私訊 lines)
// the app can't be left empty, so a category with nothing active falls back on its built-in lines
const linesOf = key => (S.content.lines?.[key]?.length ? S.content.lines[key] : DEFAULT_LINES[key] || []);
const say = (key, vars) => { const o = linesOf(key); return o.length ? fill(pick(o), { owner: S.content.owner?.name ?? '老闆', ...vars }) : ''; };
const varsOf = r => ({ name: r.name, drink: r.drink || '咖啡', team: r.team || '勇士' });

// ---------------------------------------------------------------- the phone on screen
// app icons: 10 x 10 pixel pictures on each app's own coloured tile (PAL's letters, '.' the tile showing through)
const ICON = {
  cam: ['..........', '...kkkk...', '.kkyyyykk.', 'kGGGGGGGGk', 'kGGkkkkGrk', 'kGkcwckGGk', 'kGkcckkGGk', 'kGGkkkGGGk', 'kGGGGGGGGk', '.kkkkkkkk.'],
  pho: ['....yy....', '...yyyy...', '.oo.yy.cc.', 'oooo..cccc', '.oo....cc.', '.pp....nn.', 'pppp..nnnn', '.pp.rr.nn.', '...rrrr...', '....rr....'],
  clk: ['..kkkkkk..', '.kwwwwwwk.', 'kwwwkwwwwk', 'kwwwkwwwwk', 'kwwwkwwwwk', 'kwwwkkkwwk', 'kwwwwwwwwk', 'kwwwwwwwwk', '.kwwwwwwk.', '..kkkkkk..'],
  wea: ['.y..y.....', '..yyyy....', 'yyyyyyy...', '.yyyyy....', '..yyywwww.', '.y.ywwwwww', '..wwwwwwww', '.wwwwwwwww', '.wwwwwwwww', '..........'],
  mus: ['......www.', '....wwwww.', '....www.w.', '....w...w.', '....w...w.', '....w...w.', '..www.www.', '.wwww.www.', '.www......', '..........'],
  set: ['....kk....', '.k.kGGk.k.', '..kGGGGk..', '.kGGkkGGk.', 'kGGk..kGGk', 'kGGk..kGGk', '.kGGkkGGk.', '..kGGGGk..', '.k.kGGk.k.', '....kk....'],
  tel: ['.ww.......', 'wwww......', 'www.......', 'www.......', '.www......', '..www..ww.', '...wwwwwww', '....wwwww.', '......ww..', '..........'],
  web: ['...wwww...', '..w....w..', '.w...rr.w.', 'w...rrr..w', 'w..www...w', 'w...w....w', '.w.w....w.', '..w....w..', '...wwww...', '..........'],
  hrt: ['..........', '.rr...rr..', 'rrrr.rrrr.', 'rrrrrrrrr.', 'rrrrrrrrr.', '.rrrrrrr..', '..rrrrr...', '...rrr....', '....r.....', '..........'],
  cup: ['..w..w....', '...w..w...', '..........', '.kkkkkkk..', '.kwwwwwkkk', '.kwwwwwk.k', '.kwwwwwkkk', '.kwwwwwk..', '..kkkkk...', 'kkkkkkkkk.'],
  pad: ['..........', '..........', '.kkkkkkkk.', 'kGGGGGGGGk', 'kGkGGGGrGk', 'kkkkGGyGrk', 'kGkGGGGyGk', 'kGGGkkGGGk', '.kkk..kkk.', '..........'],
  bag: ['...kkkk...', '..k....k..', '.kkkkkkkk.', '.koooooook', '.kooookook', '.koowwook.', '.koooooook', '.koooooook', '.kkkkkkkk.', '..........'],
  bok: ['.kkkkkkk..', '.kBBBBBBk.', '.kBwwwwBk.', '.kBBBBBBk.', '.kBwwwBBk.', '.kBBBBBBk.', '.kBBBBBBk.', '.kBBBBBBk.', '.kwwwwwwk.', '.kkkkkkk..'],
  // the apps from the owner's own phone
  fb: ['..........', '.....www..', '....wwww..', '....ww....', '..wwwwww..', '..wwwwww..', '....ww....', '....ww....', '....ww....', '....ww....'],
  ig: ['..........', '.wwwwwwww.', '.w......w.', '.w....w.w.', '.w.www..w.', '.w.w.w..w.', '.w.www..w.', '.w......w.', '.wwwwwwww.', '..........'],
  msgr: ['..........', '..wwwwww..', '.wwwwwwww.', 'wwwwwwwBww', 'wwBwwwBBww', 'wwwBBBwwww', 'wwwwwwwwww', '.wwwwwwww.', '..wwwwww..', '.ww.......'],
  mail: ['..........', '..........', 'wwwwwwwwww', 'wBwwwwwwBw', 'wwBwwwwBww', 'wwwBwwBwww', 'wwwwBBwwww', 'wwwwwwwwww', 'wwwwwwwwww', '..........'],
  gmail: ['..........', '..........', 'BBr....ynn', 'BB.r..y.nn', 'BB..ry..nn', 'BB......nn', 'BB......nn', 'BB......nn', '..........', '..........'],
  sms: ['..........', '..wwwwww..', '.wwwwwwww.', 'wwwwwwwwww', 'wwwwwwwwww', 'wwwwwwwwww', '.wwwwwwww.', '..wwwwww..', '.ww.......', 'w.........'],
};
const svg = rows => `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${
  rows.flatMap((r, y) => [...r].map((c, x) => (PAL[c] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL[c]}"/>` : ''))).join('')}</svg>`;
// the app's own line icons, as 12 x 12 pixel pictures in whatever colour they sit in ('#' drawn, '.' not)
const UI = {
  home: ['.....##.....', '....####....', '...##..##...', '..##....##..', '.##......##.', '##........##', '.#........#.', '.#..####..#.', '.#..#..#..#.', '.#..#..#..#.', '.####..####.', '............'],
  reels: ['..########..', '.#........#.', '#..........#', '#....#.....#', '#....##....#', '#....###...#', '#....###...#', '#....##....#', '#....#.....#', '#..........#', '.#........#.', '..########..'],
  direct: ['.........###', '...######.##', '###......##.', '.#.....##.#.', '..#...#..#..', '...#.#...#..', '....#...#...', '....#...#...', '.....#.#....', '.....#.#....', '......#.....', '......#.....'],
  search: ['...####.....', '..#....#....', '.#......#...', '.#......#...', '.#......#...', '.#......#...', '..#....#....', '...####.#...', '.........#..', '..........#.', '...........#', '............'],
  pen: ['........##..', '#####..#..#.', '#.....#..#..', '#....#..#...', '#...#..#....', '#..#..#.....', '#..###......', '#..........#', '#..........#', '#..........#', '############', '............'],
  back: ['............', '......##....', '.....##.....', '....##......', '...##.......', '..##........', '...##.......', '....##......', '.....##.....', '......##....', '............', '............'],
  sticker: ['.........#..', '...####.###.', '..#....#.#..', '.#........#.', '#..#..#....#', '#..........#', '#..#...#...#', '#...###....#', '.#........#.', '..#......#..', '...######...', '............'],
  call: ['.##.........', '#..#........', '#..#........', '#.#.........', '#..#........', '.#..#.......', '..#..#..##..', '...#..##..#.', '....#.....#.', '.....#...#..', '......###...', '............'],
  video: ['............', '............', '#######.....', '#.....#...#.', '#.....#..##.', '#.....#.#.#.', '#.....##..#.', '#.....#.#.#.', '#.....#..##.', '#######...#.', '............', '............'],
  cam: ['............', '............', '....####....', '.##########.', '.#........#.', '.#...##...#.', '.#..#..#..#.', '.#..#..#..#.', '.#...##...#.', '.##########.', '............', '............'],
  mic: ['....####....', '...#....#...', '...#....#...', '...#....#...', '...#....#...', '.#.#....#.#.', '.#..####..#.', '..#......#..', '...######...', '.....##.....', '...######...', '............'],
  image: ['............', '############', '#..........#', '#.##.......#', '#.##.......#', '#......#...#', '#.....###..#', '#..#.#####.#', '#.###......#', '############', '............', '............'],
  face: ['.########...', '#........#..', '#.#....#..#.', '#.........#.', '#.#....#..##', '#..####...#.', '#.........#.', '#.........#.', '#........#..', '.########...', '............', '............'],
  plus: ['...######...', '..#......#..', '.#........#.', '#....##....#', '#....##....#', '#..######..#', '#..######..#', '#....##....#', '#....##....#', '.#........#.', '..#......#..', '...######...'],
};
const usvg = name => `<svg class="ui" data-n="${name}" viewBox="0 0 ${UI[name][0].length} ${UI[name].length}" shape-rendering="crispEdges" aria-hidden="true">${
  UI[name].flatMap((r, y) => [...r].map((c, x) => (c === '#' ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ''))).join('')}</svg>`;
// [name, icon (an ICON picture, or a class drawn in CSS), its tile's colour, the app it opens, a badge (a number, or
// 'dm': the unread chats)]
// the other apps' red counts: one of these, at random, each visit (IG's is its real unread chats)
const BADGES = [87, 69, 65, 4, 1];
const PAGE1 = [
  ['行事曆', '.cal'], ['相簿', 'pho', '#fff', 'album'], ['相機', 'cam', '#55535f', 'cam'], ['時鐘', 'clk', '#111'],
  ['天氣', 'wea', '#3b8de0'], ['地圖', '.map'], ['備忘錄', '.notes'], ['計算機', '.calc'],
  ['健康', 'hrt', '#fff'], ['球賽', '.live'], ['遊戲', 'pad', '#7a5cff'], ['豆子庫存', 'cup', '#7a4a24'],
  ['Facebook', 'fb', '#1877f2', null, true], ['Instagram', 'ig', '', 'ig', 'dm'], ['LINE', '.line', '#06c755', null, true], ['Messenger', 'msgr', '', null, true],
];
const PAGE2 = [
  ['書籍', 'bok', '#ff9a3c'], ['外送', 'bag', '#2bb673'], ['錢包', '.wal'], ['購物', '.fold.shop', null, null, true],
  ['工作', '.fold.work', null, null, true], ['郵件', 'mail', '#1e88e5', null, true], ['Gmail', 'gmail', '#fff', null, true], ['設定', 'set', '#9a98a6'],
];
const DOCK = [['電話', 'tel', '#2bd14f'], ['瀏覽器', 'web', '#3897f0'], ['簡訊', 'sms', '#34c759', null, true], ['音樂', 'mus', '#ff4f7b']];
const DAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

// a small element, its text set as text (names and lines come from the back office)
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (cls, text, label) => { const b = el('button', cls, text); b.type = 'button'; if (label) b.setAttribute('aria-label', label); return b; };
const hex = n => '#' + (Number(n) >>> 0).toString(16).padStart(6, '0').slice(-6);
const clock = m => `${Math.floor(m / 60) % 24}:${String(Math.floor(m) % 60).padStart(2, '0')}`;
const ampm = m => { const h = Math.floor(m / 60) % 24; return `${h < 12 ? '上午' : '下午'}${h % 12 || 12}:${String(Math.floor(m) % 60).padStart(2, '0')}`; };
// how long ago, the way the app says it
const ago = mins => (mins < 1 ? '剛剛' : mins < 60 ? `${Math.round(mins)}分鐘` : mins < 1440 ? `${Math.round(mins / 60)}小時` : `${Math.round(mins / 1440)}天`);
// an account name: their own name if it's in letters, otherwise peep_ and a number of their own
const handleOf = name => (/^[\x20-\x7e]+$/.test(name) ? name.toLowerCase().replace(/[^a-z0-9.]+/g, '_') : `peep_${[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9000, 7) + 1000}`);
const MAX_PHOTOS = 24;

// returns { open, close }
export function bindPhone(root, on, off) {
  const wrap = el('div'); wrap.id = 'phone'; wrap.hidden = true;
  wrap.innerHTML = `<div class="phDim"></div><div class="phBody" role="dialog" aria-label="老闆的手機"><div class="phScr">
    <div class="phPill"></div><div class="phBar"><span class="phTime">16:00</span><span>87%<i class="phBat"></i></span></div>
    <div class="phView phHomeV" data-v="home"></div><div class="phView phList" data-v="dm"></div><div class="phView phChat" data-v="chat"></div>
    <div class="phView phCam" data-v="cam"></div><div class="phView phAlbum" data-v="album"></div><div class="phView phPhoto" data-v="photo"></div>
    <button type="button" class="phHome" aria-label="回主畫面"></button></div></div>`;
  root.appendChild(wrap); off.push(() => wrap.remove());
  const body = wrap.querySelector('.phBody');
  const views = Object.fromEntries([...wrap.querySelectorAll('.phView')].map(v => [v.dataset.v, v]));
  let view = 'home', chatWith = null, camFor = null, pickFor = null, viewing = null;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
  off.push(() => timers.forEach(clearTimeout));
  const nope = b => { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); sfx('tick'); };   // not working yet

  // ---- the regulars' threads, made the first time the phone is opened this visit
  let threads = null, myNote = '';
  const photos = S.phonePhotos || (S.phonePhotos = []);   // newest first
  const coming = new Set();   // names called in and on their way
  const inShop = r => S.customers.some(c => c.p.name === r.name && !c.outside);
  const makeThreads = () => {
    threads = S.regulars.map(r => {
      const keys = ['phone.dm', 'phone.dm', r.plays2k && 'phone.dm2k', r.smokes && 'phone.dmSmoke'].filter(Boolean);
      return { r, handle: handleOf(r.name), msgs: [{ in: true, text: say(pick(keys), varsOf(r)) }], at: S.minutes - rand(3, 2600),
        unread: false, online: Math.random() < 0.4, story: Math.random() < 0.35, note: Math.random() < 0.5 ? say('phone.note', varsOf(r)) : '' };
    });
    threads.sort((a, b) => b.at - a.at).slice(0, Math.min(2, threads.length)).forEach(t => { t.unread = true; });
    myNote = say('phone.note', {});
  };
  const unreadCount = () => (threads ? threads.filter(t => t.unread).length : 2);
  // avatars: the picture on their card (portrait.js), drawn one at a time while the phone is open so it doesn't stall;
  // until it's there, their initial on their shirt's colour (dark ink on a light shirt)
  const pics = new Map(), wanted = [];
  let drawing = 0;
  const drawNext = () => {
    drawing = 0;
    const r = wanted.shift(); if (!r || wrap.hidden) return;
    if (!pics.has(r.name)) {
      try { pics.set(r.name, portraitOf(r.isOwner ? S.owner : (r.card || (r.card = { p: r, look: r.look })))); } catch { pics.set(r.name, null); }
      const url = pics.get(r.name);
      if (url) wrap.querySelectorAll('.phAv[data-who]').forEach(a => { if (a.dataset.who === r.name) showPic(a, url); });
    }
    if (wanted.length) drawing = setTimeout(drawNext, 30);
  };
  off.push(() => clearTimeout(drawing));
  const showPic = (a, url) => { a.style.backgroundImage = `url(${url})`; a.classList.add('pic'); };
  const avatar = (r, cls = '') => {
    const c = Number(r.look?.shirt ?? 0x555555), a = el('span', 'phAv ' + cls, [...r.name][0]);
    a.style.backgroundColor = hex(c); a.dataset.who = r.name;
    if (((c >> 16 & 255) * 0.3 + (c >> 8 & 255) * 0.59 + (c & 255) * 0.11) > 170) a.classList.add('lt');
    const url = pics.get(r.name);
    if (url) showPic(a, url);
    else if (!pics.has(r.name) && (!r.isOwner || S.owner) && !wanted.includes(r)) { wanted.push(r); if (!drawing) drawing = setTimeout(drawNext, 30); }
    return a;
  };
  const OWNER_AV = { name: S.content?.owner?.name ?? '老闆', look: S.content?.owner?.look, isOwner: true };

  // ---- the home screen: two pages to swipe between, and the dock
  const home = views.home;
  const iconBox = item => {
    const [name, ic, bg, app, badge] = item;
    const a = btn('phApp'); if (app) a.dataset.app = app;
    const i = el('span', 'phIc' + (ic.startsWith('.') ? ' ' + ic.slice(1).replace('.', ' ') : ''));
    if (bg) i.style.background = bg;
    if (ic === '.cal') i.innerHTML = '<i class="phCalDay"></i><b class="phCalDate">5</b>';
    else if (ic === '.calc') i.textContent = '+−×=';
    else if (ic === '.live') i.textContent = 'LIVE';
    else if (ic === '.line') i.innerHTML = '<span>LINE</span>';
    else if (ic.startsWith('.fold')) i.innerHTML = '<i></i>'.repeat(9);
    else if (!ic.startsWith('.')) { i.innerHTML = svg(ICON[ic]); i.firstChild.dataset.i = ic; }
    a.append(i, el('span', 'phName', name));
    if (badge) { const b = el('span', 'phBadge', badge === 'dm' ? '' : String(pick(BADGES))); if (badge === 'dm') b.dataset.dm = '1'; a.appendChild(b); }
    return a;
  };
  const pages = el('div', 'phPages');
  [PAGE1, PAGE2].forEach(list => { const p = el('div', 'phPage'); list.forEach(it => p.appendChild(iconBox(it))); pages.appendChild(p); });
  const dots = el('div', 'phDots'); [0, 1].forEach(i => { const d = btn('', null, `第 ${i + 1} 頁`); d.onclick = () => setPage(i); dots.appendChild(d); });
  const dock = el('div', 'phDock'); DOCK.forEach(a => dock.appendChild(iconBox(a)));
  home.append(pages, dots, dock);
  let page = 0;
  const setPage = i => { page = i; pages.style.transform = `translateX(${-50 * i}%)`; [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i)); };
  setPage(0);
  // a swipe turns the page (and isn't taken as a tap on whatever it started on)
  let swipeX = null, swiped = false;
  on(pages, 'pointerdown', e => { swipeX = e.clientX; swiped = false; });
  on(pages, 'pointerup', e => {
    if (swipeX == null) return;
    const dx = e.clientX - swipeX; swipeX = null;
    if (Math.abs(dx) > 30) { swiped = true; setPage(Math.max(0, Math.min(1, page + (dx < 0 ? 1 : -1)))); }
  });
  const drawHome = () => {
    home.querySelector('.phCalDay').textContent = DAYS[(S.dow ?? 5) % 7];
    const n = unreadCount();
    home.querySelectorAll('[data-dm]').forEach(b => { b.textContent = n; b.hidden = !n; });
  };
  on(home, 'click', e => {
    const a = e.target.closest('.phApp'); if (!a) return;
    if (swiped) { swiped = false; return; }
    const app = a.dataset.app;
    if (app === 'ig') { sfx('pop'); show('dm'); }
    else if (app === 'cam') { camFor = null; sfx('pop'); show('cam'); }
    else if (app === 'album') { pickFor = null; sfx('pop'); show('album'); }
    else nope(a);   // the rest aren't working yet: a little shake, nothing more
  });

  // ---- IG: the list
  const list = views.dm;
  list.innerHTML = `<div class="igHd"><b class="igMe">peep20190401</b><span class="igCaret">${usvg('back')}</span><i class="igRed"></i><button type="button" class="igPen" data-dead aria-label="新訊息">${usvg('pen')}</button></div>
    <label class="igSearch"><span aria-hidden="true">⌕</span><input type="search" placeholder="搜尋" autocomplete="off" enterkeyhint="search"></label>
    <div class="igNotes"></div><div class="igTabs"><b>訊息</b><span>陌生訊息</span></div><div class="igRows"></div>
    <nav class="igNav"><button type="button" data-go="home" aria-label="主畫面">${usvg('home')}</button><button type="button" data-dead aria-label="連續短片">${usvg('reels')}</button><button type="button" class="on" aria-label="訊息">${usvg('direct')}</button><button type="button" data-dead aria-label="搜尋">${usvg('search')}</button><button type="button" class="igMeAv" data-dead aria-label="個人檔案"></button></nav>`;
  const search = list.querySelector('input'), notes = list.querySelector('.igNotes'), rows = list.querySelector('.igRows');
  list.querySelectorAll('[data-dead]').forEach(b => { b.onclick = () => nope(b); });
  const note = (who, text, name, onClick, ring) => {
    const n = el('div', 'igNote');
    n.appendChild(el('span', 'igBub' + (text ? '' : ' none'), text || ''));
    const w = el('span', 'igRing' + (ring ? ' story' : '')); w.appendChild(avatar(who));
    n.append(w, el('span', 'igNm', name));
    if (onClick) n.onclick = onClick;
    return n;
  };
  const drawList = () => {
    notes.textContent = '';
    notes.appendChild(note(OWNER_AV, myNote || '尋求靈感……', '你的便利貼'));
    threads.filter(t => t.note).sort((a, b) => b.at - a.at).slice(0, 8).forEach(t => notes.appendChild(note(t.r, t.note, t.r.name, () => openChat(t), t.story)));
    const me = list.querySelector('.igMeAv'); me.textContent = ''; me.appendChild(avatar(OWNER_AV, 's'));
    const q = search.value.trim().toLowerCase();
    const shown = threads.filter(t => !q || t.r.name.toLowerCase().includes(q) || t.handle.includes(q))
      .sort((a, b) => (b.unread - a.unread) || (b.at - a.at));
    rows.textContent = '';
    if (!shown.length) { rows.appendChild(el('p', 'igEmpty', `找不到「${search.value.trim()}」……老闆的通訊錄裡沒有這個人。`)); return; }
    shown.forEach(t => {
      const row = btn('igRow' + (t.unread ? ' u' : ''));
      const av = el('span', 'igAvW' + (t.story ? ' story' : '') + (inShop(t.r) ? ' here' : '')); av.appendChild(avatar(t.r));
      const last = t.msgs[t.msgs.length - 1];
      const lastText = last.img ? (last.in ? '傳送了一張相片' : '你：傳送了一張相片') : (last.in ? '' : '你：') + (last.text || '');
      const sub = inShop(t.r) ? '目前在店裡' : coming.has(t.r.name) ? '正在前往店裡……'
        : t.online && !t.unread && last.in ? `${ago(S.minutes - t.at)}前在線上` : `${lastText} · ${ago(S.minutes - t.at)}`;
      const tx = el('span', 'igTx'); tx.append(el('span', 'igN', t.r.name), el('span', 'igM', sub));
      row.append(av, tx);
      if (t.unread) row.appendChild(el('span', 'igDot'));
      row.onclick = () => openChat(t);
      rows.appendChild(row);
    });
  };
  on(search, 'input', () => drawList());
  on(search, 'keydown', e => e.stopPropagation());   // (typing a name shouldn't steer the camera or the menu)

  // ---- IG: a chat
  const chat = views.chat;
  chat.innerHTML = `<div class="igCh"><button type="button" class="igCirc" data-go="dm" aria-label="返回">${usvg('back')}</button><span class="igChAv"></span>
    <span class="igW"><b></b><i></i></span><button type="button" class="igCirc sm" data-dead aria-label="效果">${usvg('sticker')}</button><button type="button" class="igCirc sm" data-dead aria-label="語音通話">${usvg('call')}</button><button type="button" class="igCirc sm" data-dead aria-label="視訊通話">${usvg('video')}</button></div>
    <div class="igMsgs"></div>
    <div class="igChips"><button type="button" class="go" data-act="call">▶ 叫他來店裡</button><button type="button" data-act="last">傳剛拍的照片</button></div>
    <div class="igInp"><button type="button" class="igCamB" data-act="shoot" aria-label="拍照傳送">${usvg('cam')}</button><span class="igPh">發送訊息……</span>
      <button type="button" data-dead aria-label="語音">${usvg('mic')}</button><button type="button" data-act="pick" aria-label="傳照片">${usvg('image')}</button><button type="button" data-dead aria-label="貼圖">${usvg('face')}</button><button type="button" data-dead aria-label="更多">${usvg('plus')}</button></div>`;
  const msgsEl = chat.querySelector('.igMsgs'), callBtn = chat.querySelector('[data-act="call"]'), lastBtn = chat.querySelector('[data-act="last"]');
  chat.querySelectorAll('[data-dead]').forEach(b => { b.onclick = () => nope(b); });
  const drawChat = () => {
    const t = chatWith; if (!t) return;
    const head = chat.querySelector('.igChAv'); head.textContent = ''; head.appendChild(avatar(t.r));
    chat.querySelector('.igW b').textContent = t.r.name + ' ›';
    chat.querySelector('.igW i').textContent = inShop(t.r) ? '目前在店裡' : coming.has(t.r.name) ? '正在前往店裡' : t.handle;
    msgsEl.textContent = '';
    msgsEl.appendChild(el('span', 'igTs', `今天 ${ampm(t.at - 2)}`));
    const lastOut = t.msgs.map(m => !m.in && !m.sys && !m.typing).lastIndexOf(true);
    t.msgs.forEach((m, i) => {
      if (m.sys) { msgsEl.appendChild(el('span', 'igSys', m.text)); return; }
      const next = t.msgs[i + 1], tail = !next || !(next.in && !next.sys);   // their avatar beside the last of a run
      const body = m.typing ? el('span', 'igB in igTyping', '•••') : m.img ? el('span', 'igImg') : el('span', 'igB ' + (m.in ? 'in' : 'out'), m.text);
      if (m.img) { const im = el('img'); im.src = m.img; im.alt = '相片'; body.appendChild(im); }
      if (m.in || m.typing) {
        const w = el('div', 'igIn'); w.append(tail ? avatar(t.r, 's') : el('span', 'igAvGap'), body); msgsEl.appendChild(w);
      } else {
        body.classList.add('out'); msgsEl.appendChild(body);
        if (i === lastOut && m.seen) msgsEl.appendChild(el('span', 'igSeen', '剛剛看過'));
      }
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;
    const busy = t.msgs.some(m => m.typing);
    callBtn.disabled = busy || coming.has(t.r.name);
    callBtn.textContent = coming.has(t.r.name) ? '已經在路上了' : '▶ 叫他來店裡';
    lastBtn.disabled = busy || !photos.length;
  };
  const openChat = t => { chatWith = t; t.unread = false; sfx('pop'); show('chat'); };
  // something sent in the owner's name: seen a moment later, then they're typing, then they write back
  const send = (t, msg, answer) => {
    t.msgs.push(msg); t.at = S.minutes; sfx('swoosh');
    const typing = { typing: true };
    later(() => { msg.seen = true; t.msgs.push(typing); refresh(); }, 700);
    later(() => { t.msgs.splice(t.msgs.indexOf(typing), 1); answer(); sfx('boop'); refresh(); }, 1900);
    refresh();
  };
  on(callBtn, 'click', () => {
    const t = chatWith; if (!t || callBtn.disabled) return;
    const r = t.r, here = inShop(r), closed = !S.open || S.closing;
    send(t, { in: false, text: say('phone.call', varsOf(r)) }, () => {
      t.msgs.push({ in: true, text: say(here ? 'phone.here' : closed ? 'phone.closed' : 'phone.reply', varsOf(r)) });
      if (!here && !closed) { t.msgs.push({ sys: true, text: `▶ ${r.name} 正在前往店裡……` }); summon(r); }
    });
  });
  const sendPhoto = (t, url) => send(t, { in: false, img: url }, () => t.msgs.push({ in: true, text: say('phone.photoReply', varsOf(t.r)) }));
  on(lastBtn, 'click', () => { if (chatWith && photos.length && !lastBtn.disabled) sendPhoto(chatWith, photos[0].url); });
  on(chat.querySelector('[data-act="shoot"]'), 'click', () => { camFor = chatWith; sfx('pop'); show('cam'); });
  on(chat.querySelector('[data-act="pick"]'), 'click', () => { pickFor = chatWith; sfx('pop'); show('album'); });

  // ---- calling a regular in: they turn up along the lane a little later (in the shop's own time), and when they're in,
  // the owner wonders who asked them
  async function summon(r) {
    coming.add(r.name);
    log(`有人用老闆的手機傳了訊息……${r.name} 說要過來`);
    await sleep(rand(10, 20));
    for (let tries = 0; tries < 8 && !S.stopped; tries++) {
      if (inShop(r)) break;
      if (trySpawn(true, r)) {
        await sleep(9);
        const line = say('phone.ownerHuh', varsOf(r));
        if (line && S.owner && !S.owner.hunting) S.owner.say(line, 3.2);
        break;
      }
      await sleep(12);   // full up, or a cockroach about: try again in a bit
    }
    coming.delete(r.name);
    refresh();
  }

  // ---- the camera: its middle is see-through, the café itself behind it (drag to frame the shot); the shutter takes
  // what's there from the café's own picture and keeps it in the album, or sends it to the chat it was opened from
  const cam = views.cam;
  cam.innerHTML = `<div class="camTop"><span>⚡</span><span class="camFor"></span><span>◐</span></div><div class="camVf"><i class="camFlash"></i></div>
    <div class="camBot"><div class="camModes"><span>縮時</span><span>影片</span><b>照片</b><span>人像</span></div>
      <div class="camRow"><button type="button" class="camThumb" aria-label="相簿"></button><button type="button" class="camShut" aria-label="拍照"><i></i></button><button type="button" class="camFlip" data-dead aria-label="切換鏡頭">⟲</button></div></div>`;
  const vf = cam.querySelector('.camVf'), flash = cam.querySelector('.camFlash'), thumb = cam.querySelector('.camThumb');
  cam.querySelector('.camFlip').onclick = e => nope(e.currentTarget);
  const drawCam = () => {
    cam.querySelector('.camFor').textContent = camFor ? `拍好傳給 ${camFor.r.name}` : '';
    thumb.style.backgroundImage = photos.length ? `url(${photos[0].url})` : '';
  };
  const shoot = () => {
    const { renderer, scene, camera } = ctx; if (!renderer) return null;
    const cv = renderer.domElement, cr = cv.getBoundingClientRect(), vr = vf.getBoundingClientRect();
    renderer.render(scene, camera);   // (drawn just now, so the picture is still there to copy)
    const kx = cv.width / cr.width, ky = cv.height / cr.height;
    const sx = (vr.left - cr.left) * kx, sy = (vr.top - cr.top) * ky, sw = vr.width * kx, sh = vr.height * ky;
    const w = Math.min(540, Math.round(sw)), h = Math.round(w * sh / sw);
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    out.getContext('2d').drawImage(cv, sx, sy, sw, sh, 0, 0, w, h);
    try { return out.toDataURL('image/jpeg', 0.82); } catch { return null; }
  };
  on(cam.querySelector('.camShut'), 'click', () => {
    const url = shoot(); if (!url) return;
    sfx('shutter');
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    photos.unshift({ url, at: S.minutes }); if (photos.length > MAX_PHOTOS) photos.length = MAX_PHOTOS;
    log('用老闆的手機偷拍了一張照片');
    if (camFor) { const t = camFor; camFor = null; later(() => { chatWith = t; show('chat'); sendPhoto(t, url); }, 350); }
    else drawCam();
  });
  on(thumb, 'click', () => { if (photos.length) { pickFor = null; show('album'); } });

  // ---- the album: every shot, newest first; opened from a chat, the one tapped is sent there
  const album = views.album;
  album.innerHTML = `<div class="alHd"><button type="button" class="alBk" aria-label="返回">‹</button><b>照片</b><span class="alN"></span></div><div class="alGrid"></div>`;
  const grid = album.querySelector('.alGrid');
  on(album.querySelector('.alBk'), 'click', () => back());
  const drawAlbum = () => {
    album.querySelector('.alHd b').textContent = pickFor ? `傳給 ${pickFor.r.name}` : '照片';
    album.querySelector('.alN').textContent = photos.length ? `${photos.length} 張` : '';
    grid.textContent = '';
    if (!photos.length) { grid.appendChild(el('p', 'alEmpty', '還沒有照片。打開相機，偷拍一張吧。')); return; }
    photos.forEach(p => {
      const b = btn('alTile', null, '相片'); b.style.backgroundImage = `url(${p.url})`;
      b.onclick = () => {
        if (pickFor) { const t = pickFor; pickFor = null; chatWith = t; show('chat'); sendPhoto(t, p.url); }
        else { viewing = p; show('photo'); }
      };
      grid.appendChild(b);
    });
  };
  const photo = views.photo;
  photo.innerHTML = `<div class="alHd"><button type="button" class="alBk" aria-label="返回">‹</button><b></b></div><div class="phBig"><img alt="相片"></div>`;
  on(photo.querySelector('.alBk'), 'click', () => back());
  const drawPhoto = () => { if (!viewing) return; photo.querySelector('img').src = viewing.url; photo.querySelector('b').textContent = `今天 ${ampm(viewing.at)}`; };

  // ---- moving between screens
  const show = v => {
    view = v;
    Object.entries(views).forEach(([k, e]) => { e.hidden = k !== v; });
    wrap.classList.toggle('cam', v === 'cam'); root.classList.toggle('phoneCam', v === 'cam');
    wrap.dataset.v = v;
    refresh();
  };
  const back = () => {
    sfx('popDown');
    if (view === 'chat') show('dm');
    else if (view === 'photo') show('album');
    else if (view === 'album' && pickFor) { const t = pickFor; pickFor = null; chatWith = t; show('chat'); }
    else if (view === 'cam' && camFor) { const t = camFor; camFor = null; chatWith = t; show('chat'); }
    else if (view === 'home') close();
    else show('home');
  };
  const refresh = () => {
    if (wrap.hidden) return;
    wrap.querySelector('.phTime').textContent = clock(S.minutes ?? 960);
    ({ home: drawHome, dm: drawList, chat: drawChat, cam: drawCam, album: drawAlbum, photo: drawPhoto })[view]?.();
  };
  on(wrap, 'click', e => { const b = e.target.closest('[data-go]'); if (b) { sfx('popDown'); show(b.dataset.go); } });
  // the bar at the bottom: home, or from home, put the phone away
  on(wrap.querySelector('.phHome'), 'click', () => { if (view === 'home') close(); else { sfx('popDown'); camFor = pickFor = null; show('home'); } });
  on(wrap.querySelector('.phDim'), 'click', () => close());
  on(window, 'keydown', e => {
    if (wrap.hidden || e.key !== 'Escape') return;
    e.preventDefault(); e.stopImmediatePropagation();
    back();
  });
  // drawn to fit the screen: smaller on a phone
  const fit = () => { body.style.setProperty('--phS', String(Math.min(1, (window.innerHeight - 28) / 640, (window.innerWidth - 20) / 320))); };
  on(window, 'resize', fit);
  // the list keeps up with the shop (who's in, who's on their way) while it's open
  const tick = setInterval(() => {
    if (wrap.hidden) return;
    if (view === 'home' || view === 'dm') refresh(); else wrap.querySelector('.phTime').textContent = clock(S.minutes ?? 960);
  }, 1000);
  off.push(() => clearInterval(tick));

  function open() {
    if (!threads) makeThreads();
    fit(); wrap.hidden = false; root.classList.add('phoneOpen');
    wrap.classList.remove('in'); void wrap.offsetWidth; wrap.classList.add('in');
    sfx('pop'); setPage(0); show('home');
  }
  function close() {
    if (wrap.hidden) return;
    wrap.hidden = true; root.classList.remove('phoneOpen', 'phoneCam'); search.blur();
    camFor = pickFor = null;
    sfx('popDown');
  }
  off.push(() => root.classList.remove('phoneOpen', 'phoneCam'));
  return { open, close };
}
