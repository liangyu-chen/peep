// 便利貼留言板: the sticky-note board on the pegboard's right-hand patch (where the polaroids are painted). Visitors'
// notes (GET /api/board) are drawn as little coloured squares on a see-through layer over the board, newest on top;
// clicking the patch flies the camera in and opens a panel under it, where a note is written (a pencil writes it out
// letter by letter on a blank note) and, once the server has taken it (POST /api/board), flies to its place on the
// board. The API may well not be there (not built yet, or 503): the board is then just empty and the panel says so.
import * as THREE from 'three';
import { ctx, DECAL } from './engine.js';
import { S } from './state.js';
import { K, DOT } from './util.js';
import { sfx } from './sfx.js';
import { NICK_MAX, MSG_MAX, REPLY_MAX, DEFAULT_NICK, BOARD_LIMIT, cleanText } from '../content/board';

// ---------------------------------------------------------------- the patch on the board, in plan coordinates
const Z0 = 1.35, Z1 = 2.02, Y0 = 1.45, Y1 = 2.32;   // z runs to the right as you face the board
const PPM = 1000;                                    // canvas pixels a metre
const CW = Math.round((Z1 - Z0) * PPM), CH = Math.round((Y1 - Y0) * PPM);
const NOTE = 120;                                    // a note, in pixels (0.12 m)
const X_PLAN = 3.0;                                  // just in front of the board (x 3.01)
const COLORS = ['#ffe66d', '#ff9ec4', '#a8e6a1', '#9fd4ff', '#ffb870'];   // yellow, pink, green, blue, orange
const INK = '#1a2a6c';
// a note's colour comes from what's written on it (not its id, which isn't known until the server has taken it), so the note
// being written and the one that lands on the board are the same colour
const colorOf = (nickname, message) => { let h = 2166136261; for (const ch of nickname + '|' + message) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return COLORS[(h >>> 0) % 5]; };

// where a note goes: from its id alone, so it's in the same place after every reload
const hash = (n, s) => { let h = Math.imul((n | 0) + s * 0x9e3779b1, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function notePos(id) {   // its top left, in canvas pixels
  const x = Math.round(hash(id, 1) * (CW - NOTE)) + Math.floor(hash(id, 3) * 3) - 1;   // (and a pixel off, one way or the other)
  const y = Math.round(hash(id, 2) * (CH - NOTE)) + Math.floor(hash(id, 4) * 3) - 1;
  return { x: clamp(x, 0, CW - NOTE), y: clamp(y, 0, CH - NOTE) };
}
// the writing on a note: five letters across, four lines down, the rest cut off
const CPL = 5, LINES = 4, CELL = 17, LINE_H = 19, PAD_X = 17, PAD_Y = 22;
const noteChars = text => Array.from(text).slice(0, CPL * LINES);
const cellOf = i => [PAD_X + (i % CPL) * CELL, PAD_Y + Math.floor(i / CPL) * LINE_H];
const setInk = g => { g.font = `16px ${DOT}`; g.textBaseline = 'top'; g.textAlign = 'left'; g.fillStyle = INK; };

// the signature, small, in the note's bottom right corner (g is at the note's own top left)
function signNote(g, who) {
  g.font = `10px ${DOT}`; g.textAlign = 'right'; g.textBaseline = 'top'; g.fillStyle = INK;
  g.fillText('—' + who, NOTE - 8, NOTE - 16);
}

function drawNote(g, post) {
  const { x, y } = notePos(post.id);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2, y + 3, NOTE, NOTE);
  g.fillStyle = colorOf(post.nickname, post.message); g.fillRect(x, y, NOTE, NOTE);
  g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x, y, NOTE, 14);   // the sticky strip, a shade darker
  if (post.reply) { g.fillStyle = '#d62828'; g.fillRect(x + NOTE - 14, y + 3, 8, 8); }   // (answered by the owner: a little red square on the strip)
  g.save(); g.translate(x, y); setInk(g);
  noteChars(post.message).forEach((ch, i) => { const [cx, cy] = cellOf(i); g.fillText(ch, cx, cy); });
  signNote(g, post.nickname);   // (the poster's name, signed in the bottom corner like on the card that was written)
  g.restore();
}

// ---------------------------------------------------------------- the 3D layer
export function buildBoard() {
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const w = Z1 - Z0, h = Y1 - Y0;
  const group = new THREE.Group();
  group.position.set(X_PLAN, (Y0 + Y1) / 2, (Z0 + Z1) / 2); group.rotation.y = -Math.PI / 2;   // (as engine.js's plane(): wide along +z, facing -x)
  // lit like the rest of the board (a Basic material would glow at night)
  const layer = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, transparent: true, ...DECAL }));
  layer.renderOrder = 1; layer.receiveShadow = true; layer.castShadow = false;
  // the glow under the mouse: a slightly bigger see-through plane, a gold rim round the patch
  const gw = 73, gh = 93, gc = document.createElement('canvas'); gc.width = gw; gc.height = gh;
  const gg = gc.getContext('2d');
  gg.fillStyle = 'rgba(255,226,120,0.14)'; gg.fillRect(0, 0, gw, gh);
  gg.strokeStyle = 'rgba(255,226,120,0.4)'; gg.lineWidth = 3; gg.strokeRect(4.5, 4.5, gw - 9, gh - 9);
  gg.strokeStyle = 'rgba(255,240,170,1)'; gg.strokeRect(1.5, 1.5, gw - 3, gh - 3);
  const glowTex = new THREE.CanvasTexture(gc); glowTex.magFilter = THREE.NearestFilter; glowTex.minFilter = THREE.NearestFilter; glowTex.generateMipmaps = false;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.06, h + 0.06), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, ...DECAL }));
  glow.position.z = 0.004; glow.renderOrder = 2; glow.visible = false;
  // what's clicked: a thin plane over the whole patch, drawn with no colour or depth so it can't be seen (and the glow
  // is left out of the pointer's targets, so it can't widen it)
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  hit.position.z = 0.006;
  group.add(layer, glow, hit);
  S.world.add(group);   // (after mergeStatic(), or it would be merged into the set)
  S.board = { group, layer, glow, hit, tex, glowTex, cv, g, posts: [], online: null, hover: false, hv: 0, t: 0, fade: 1, active: true,
    seq: 0, ctl: null, postCtl: null, listeners: new Set(), dead: false };
  loadPosts();
}

// each frame (real time): the glow, and the whole layer fading with its wall when the camera is round behind it
export function updateBoard(dt) {
  const b = S.board; if (!b) return;
  b.t += dt;
  const f = S.wallItems?.find(w => w.side === 'R')?.fade ?? 1;
  const see = f < 0.999;
  b.fade = f; b.active = !see;
  b.hv += ((b.hover && !opened ? 1 : 0) - b.hv) * Math.min(1, dt * 14);
  b.layer.material.opacity = f;
  b.layer.material.depthWrite = !see;   // (see-through, it must not hide what's behind it)
  b.layer.visible = f > 0.01;
  const o = b.hv * (0.55 + Math.sin(b.t * 6) * 0.2) * f;
  b.glow.material.opacity = o; b.glow.visible = o > 0.004;
}
export function setBoardHover(on) { const b = S.board; if (b) b.hover = !!on; }

export function disposeBoard() {
  const b = S.board; if (!b) return;
  b.dead = true; b.ctl?.abort(); b.postCtl?.abort(); b.listeners.clear();
  b.group.parent?.remove(b.group);
  [b.layer, b.glow, b.hit].forEach(m => { m.geometry.dispose(); m.material.dispose(); });
  b.tex.dispose(); b.glowTex.dispose();
  S.board = null;
}

// ---------------------------------------------------------------- the notes: fetched, and drawn
const tidy = p => (p && Number.isFinite(Number(p.id)) && typeof p.message === 'string' && typeof p.nickname === 'string'
  ? { id: Number(p.id), nickname: cleanText(p.nickname, NICK_MAX) || DEFAULT_NICK, message: cleanText(p.message, MSG_MAX), createdAt: String(p.createdAt ?? ''),
    reply: typeof p.reply === 'string' ? cleanText(p.reply, REPLY_MAX) : '', repliedAt: typeof p.repliedAt === 'string' ? p.repliedAt : null } : null);
const notify = b => b.listeners.forEach(fn => fn());

// (re)draw every note on the layer: oldest first, so the newest is on top; at most BOARD_LIMIT
export async function redrawBoard() {
  const b = S.board; if (!b) return;
  const my = ++b.seq;
  const list = b.posts.slice().sort((a, c) => a.id - c.id).slice(-BOARD_LIMIT);
  if (list.length) {
    try { await document.fonts?.load(`16px ${DOT}`, list.map(p => noteChars(p.message).join('')).join('')); } catch {}   // (not there: Noto Sans TC, the stack's next)
    if (S.board !== b || b.seq !== my) return;
  }
  b.g.clearRect(0, 0, CW, CH);
  list.forEach(p => drawNote(b.g, p));
  b.tex.needsUpdate = true;
}

export async function loadPosts() {
  const b = S.board; if (!b) return;
  b.ctl?.abort();
  const ctl = b.ctl = new AbortController();
  try {
    const r = await fetch('/api/board', { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('offline');
    const j = await r.json();
    if (S.board !== b) return;
    b.posts = (Array.isArray(j?.posts) ? j.posts : []).map(tidy).filter(p => p && p.message).sort((a, c) => c.id - a.id).slice(0, BOARD_LIMIT);
    b.online = true;
  } catch (e) {
    if (ctl.signal.aborted || S.board !== b) return;
    b.online = false;   // (the board just stays as it was)
  }
  redrawBoard(); notify(b);
}

// a note written here and taken by the server: into the list (the board's own picture waits for the note to land)
function addPost(post) {
  const b = S.board; if (!b) return;
  b.posts = [post, ...b.posts.filter(p => p.id !== post.id)].sort((a, c) => c.id - a.id).slice(0, BOARD_LIMIT);
  notify(b);
}

// { ok: true, post } or { ok: false, message }: never throws
async function sendNote(nickname, message) {
  const b = S.board;
  if (!b) return { ok: false, message: '暫時無法留言', aborted: true };
  const ctl = b.postCtl = new AbortController();
  try {
    const body = { message, website: '' };   // (website: the bots' hidden field, always empty from here)
    if (nickname) body.nickname = nickname;
    const r = await fetch('/api/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    let j = null; try { j = await r.json(); } catch {}
    const post = r.status === 201 ? tidy(j?.post) : null;
    if (post) return { ok: true, post };
    return { ok: false, message: typeof j?.message === 'string' && j.message ? j.message : '暫時無法留言' };
  } catch (e) {
    return { ok: false, message: '暫時無法留言', aborted: ctl.signal.aborted };
  }
}

// ---------------------------------------------------------------- where it is on screen (the panel's dimming, the note's flight)
let rootEl = null, opened = false;
const _v = new THREE.Vector3();
// a spot on the patch (plan z, y) in pixels from the top left of the café's root; null when it's behind the camera
function toRoot(z, y) {
  const cam = ctx.camera, cv = ctx.renderer?.domElement; if (!cam || !cv || !rootEl) return null;
  _v.set(X_PLAN * K, y, z).project(cam);
  if (_v.z > 1) return null;
  const cr = cv.getBoundingClientRect(), rr = rootEl.getBoundingClientRect();
  return [cr.left - rr.left + (_v.x + 1) / 2 * cr.width, cr.top - rr.top + (1 - _v.y) / 2 * cr.height];
}
let dimEl = null;
// each frame while the panel is open: the dark round the patch follows it as the camera flies in
export function layoutBoard() {
  if (!opened || !dimEl) return;
  ctx.camera.updateMatrixWorld();
  const pts = [toRoot(Z0, Y1), toRoot(Z1, Y1), toRoot(Z0, Y0), toRoot(Z1, Y0)];
  if (pts.some(p => !p)) { dimEl.hidden = true; return; }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = 8;
  const l = Math.min(...xs) - pad, t = Math.min(...ys) - pad;
  dimEl.hidden = false;
  dimEl.style.left = l + 'px'; dimEl.style.top = t + 'px';
  dimEl.style.width = Math.max(...xs) + pad - l + 'px'; dimEl.style.height = Math.max(...ys) + pad - t + 'px';
}

// ---------------------------------------------------------------- picking a note on the board
let zoomApi = null;   // (set by bindBoard: { show(post, from), hide(instant) })
// the topmost note under a spot of the patch (uv, v up); the newest is drawn last, so it's looked at first
function noteAtUv(uv) {
  const b = S.board; if (!b || !uv) return null;
  const px = uv.x * CW, py = (1 - uv.y) * CH;
  const list = b.posts.slice().sort((a, c) => a.id - c.id).slice(-BOARD_LIMIT);
  for (let i = list.length - 1; i >= 0; i--) {
    const { x, y } = notePos(list[i].id);
    if (px >= x && px < x + NOTE && py >= y && py < y + NOTE) return list[i];
  }
  return null;
}
export const hasNoteAt = uv => !!noteAtUv(uv);
export function pickNote(uv) { const p = noteAtUv(uv); if (p) zoomApi?.show(p); return !!p; }
export const closeZoom = () => zoomApi ? zoomApi.hide() : false;   // true when a zoomed note was there (and is now going)

// ---------------------------------------------------------------- the panel
const el =(tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const NICK_KEY = 'cafeBoardNick';
const ownerName = () => S.content?.owner?.name ?? '老闆';

// returns { open, close, isOpen }; hooks.requestClose() is what Esc and the ✕ ask for (hud.js flies the camera back too)
export function bindBoard(root, on, off, hooks = {}) {
  rootEl = root;
  const wrap = el('div'); wrap.id = 'board'; wrap.hidden = true;
  wrap.innerHTML = `<div class="bdDim" hidden></div><div class="bdPanel" role="dialog" aria-label="留言板">
    <button type="button" class="bdX" aria-label="關閉">✕</button><div class="bdStat" role="status"></div><div class="bdList"></div>
    <div class="bdForm"><input class="bdNick" type="text" autocomplete="off" enterkeyhint="next" placeholder="暱稱">
      <input class="bdText" type="text" autocomplete="off" enterkeyhint="send" placeholder="寫點什麼…">
      <span class="bdLeft"></span><button type="button" class="bdSend primary">貼上</button>
      <input class="bdWeb" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"></div></div>`;
  root.appendChild(wrap);
  dimEl = wrap.querySelector('.bdDim');
  const panel = wrap.querySelector('.bdPanel'), stat = wrap.querySelector('.bdStat'), list = wrap.querySelector('.bdList'),
    nick = wrap.querySelector('.bdNick'), text = wrap.querySelector('.bdText'), left = wrap.querySelector('.bdLeft'), send = wrap.querySelector('.bdSend');
  // (maxlength counts UTF-16 units, so an emoji would use two; the limit is held in whole characters instead, as the server counts them)
  const hold = (inp, max) => inp.addEventListener('input', () => { const a = Array.from(inp.value); if (a.length > max) inp.value = a.slice(0, max).join(''); });
  hold(nick, NICK_MAX); hold(text, MSG_MAX);
  try { nick.value = cleanText(localStorage.getItem(NICK_KEY), NICK_MAX); } catch {}
  let busy = false, flashMsg = '', run = null, dead = false;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  off.push(() => { dead = true; zoom?.box.remove(); zoom?.back.remove(); zoom?.reply?.remove(); zoom = null; if (run) run.dead = true; zoomApi = null; timers.forEach(clearTimeout); timers.clear(); wrap.remove(); dimEl = null; opened = false; rootEl = null; root.classList.remove('boardOpen'); });

  const offline = () => S.board?.online === false;
  const refreshForm = () => {
    stat.textContent = flashMsg || (offline() ? '暫時無法留言' : '');
    stat.hidden = !stat.textContent;
    send.disabled = busy || offline();
    const n = MSG_MAX - Array.from(text.value).length;
    left.textContent = String(n); left.classList.toggle('low', n <= 5);
  };
  const flash = msg => { flashMsg = msg; refreshForm(); };
  const drawList = () => {
    list.textContent = '';
    (S.board?.posts || []).forEach(p => {
      const row = el('p', 'bdItem'); row.append(el('b', null, p.nickname), '：' + p.message);
      const t1 = stamp(p.createdAt); if (t1) row.append(el('span', 'bdTime', t1));
      list.appendChild(row);
      if (p.reply) {
        const rep = el('p', 'bdReply'); rep.append(el('b', null, ownerName()), '：' + p.reply);
        const t2 = stamp(p.repliedAt); if (t2) rep.append(el('span', 'bdTime', t2));
        list.appendChild(rep);
      }
    });
  };
  const onChange = () => { if (dead) return; drawList(); refreshForm(); };
  S.board?.listeners.add(onChange);

  on(wrap.querySelector('.bdX'), 'click', () => hooks.requestClose?.());
  on(text, 'input', e => {
    if (!e.isComposing) { const a = Array.from(text.value); if (a.length > MSG_MAX) text.value = a.slice(0, MSG_MAX).join(''); }
    if (flashMsg) flashMsg = '';
    refreshForm();
  });
  // Esc closes and Enter sends, unless the input method is still choosing characters; typing never steers the camera
  const onKey = e => {
    if (wrap.hidden || e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!hideZoom()) hooks.requestClose?.(); }
    else if (e.key === 'Enter' && e.target === text) { e.preventDefault(); submit(); }
    else if (e.key === 'Enter' && e.target === nick) { e.preventDefault(); text.focus(); }
  };
  [nick, text].forEach(i => on(i, 'keydown', e => { e.stopPropagation(); onKey(e); }));
  on(window, 'keydown', onKey);
  on(send, 'click', () => submit());

  // not under the on-screen keyboard: lifted by however much of the bottom the visible part of the page has lost
  const fitKb = () => {
    const vv = window.visualViewport; let inset = 0;
    if (vv) inset = Math.max(0, Math.round(root.getBoundingClientRect().bottom - (vv.offsetTop + vv.height)));
    wrap.style.setProperty('--bdInset', inset + 'px');
  };
  on(window, 'resize', fitKb);
  if (window.visualViewport) {
    const vv = window.visualViewport;
    vv.addEventListener('resize', fitKb); vv.addEventListener('scroll', fitKb);
    off.push(() => { vv.removeEventListener('resize', fitKb); vv.removeEventListener('scroll', fitKb); });
  }

  // ---- one note blown up: it flies from its place on the board to the middle, and back; the board's own note stays put
  const ZN = 144, ZCOLS = 8, ZCELL = 14, ZLH = 17, ZPAD = 10, ZTOP = 20, ZMAX = 40;
  let zoom = null, zoomTok = 0;   // zoom: { box, back, reply, from, closing, t0, timer }
  const stamp = s => {
    const d = new Date(s); if (!s || Number.isNaN(d.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const drawZoom = (cv, post) => {
    const g = cv.getContext('2d');
    g.fillStyle = colorOf(post.nickname, post.message); g.fillRect(0, 0, ZN, ZN);
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(0, 0, ZN, 14);
    g.fillStyle = INK; g.textBaseline = 'top'; g.textAlign = 'left'; g.font = `14px ${DOT}`;
    Array.from(post.message).slice(0, ZMAX).forEach((ch, i) => g.fillText(ch, ZPAD + (i % ZCOLS) * ZCELL, ZTOP + Math.floor(i / ZCOLS) * ZLH));
    g.textAlign = 'right';
    g.font = `11px ${DOT}`; g.fillText('—' + post.nickname, ZN - 8, ZN - 28, ZN - 16);
    const when = stamp(post.createdAt);
    if (when) { g.font = `9px ${DOT}`; g.globalAlpha = 0.7; g.fillText(when, ZN - 8, ZN - 14); g.globalAlpha = 1; }
  };
  // the owner's reply: a smaller off-white note beside the blown-up one (12px red ink, ten letters across, six lines down)
  const RN = 144, RCOLS = 10, RLINES = 6, RCELL = 12, RPAD = 12, RLH = 15, RTOP = 22;
  const drawReply = (cv, post) => {
    const g = cv.getContext('2d');
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, RN, RN);
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(0, 0, RN, 14);
    g.fillStyle = '#9c1c1c'; g.textBaseline = 'top'; g.textAlign = 'left'; g.font = `12px ${DOT}`;
    Array.from(post.reply).slice(0, Math.min(REPLY_MAX, RCOLS * RLINES)).forEach((ch, i) => g.fillText(ch, RPAD + (i % RCOLS) * RCELL, RTOP + Math.floor(i / RCOLS) * RLH));
    g.textAlign = 'right'; g.font = `11px ${DOT}`;
    const when = stamp(post.repliedAt);
    g.fillText('—' + ownerName(), RN - 8, when ? RN - 28 : RN - 22, RN - 16);
    if (when) { g.font = `9px ${DOT}`; g.globalAlpha = 0.7; g.fillText(when, RN - 8, RN - 14); g.globalAlpha = 1; }
  };
  // where the note's own spot on the board is, as a transform that takes the blown-up one there (null when it's out of view)
  const homeOf = (post, box, side) => {
    const { x, y } = notePos(post.id), toZ = px => Z0 + px / PPM, toY = py => Y1 - py / PPM;
    const a = toRoot(toZ(x), toY(y)), c = toRoot(toZ(x + NOTE), toY(y + NOTE));
    if (!a || !c) return null;
    const bx = parseFloat(box.style.left) + side / 2, by = parseFloat(box.style.top) + side / 2;
    return `translate(${(a[0] + c[0]) / 2 - bx}px,${(a[1] + c[1]) / 2 - by}px) scale(${Math.max(0.04, (c[0] - a[0]) / side)})`;
  };
  const showZoom = async post => {
    if (dead || wrap.hidden || zoom) return;
    const tok = ++zoomTok;
    try { await document.fonts?.load(`14px ${DOT}`, post.message + post.nickname + post.reply + ownerName() + '—0123456789/:'); } catch {}
    if (dead || wrap.hidden || zoom || tok !== zoomTok || !S.board) return;
    const rr = root.getBoundingClientRect();
    const panelH = Math.min(0.42 * window.innerHeight, 340);
    const GAP = 6, fit = rr.height - panelH - 48;
    let side = Math.max(120, Math.min(360, rr.width * 0.78, fit));
    let sideBySide = false;
    if (post.reply) {
      if (rr.width >= rr.height && side * 1.62 + GAP <= rr.width * 0.9) sideBySide = true;   // (wide: left and right, the main note as it was)
      else side = Math.max(120, Math.min(side, (fit - GAP) / 1.62));                         // (tall: one above the other)
    }
    side = Math.round(side);
    const rs = post.reply ? Math.round(side * 0.62) : 0;
    const back = el('div', 'bdZoomBack'), box = el('div', 'bdZoom'), cv = el('canvas');
    cv.width = cv.height = ZN; drawZoom(cv, post);
    box.appendChild(cv);
    box.style.width = box.style.height = side + 'px';
    const totalW = sideBySide ? side + GAP + rs : side, totalH = post.reply && !sideBySide ? side + GAP + rs : side;
    const left = Math.round((rr.width - totalW) / 2);
    const top = Math.round(Math.max(10, (rr.height - panelH - 24 - totalH) / 2 + 8));
    box.style.left = left + 'px'; box.style.top = top + 'px';
    let reply = null;
    if (post.reply) {
      reply = el('div', 'bdZoom bdZoomReply'); const rc = el('canvas'); rc.width = rc.height = RN; drawReply(rc, post);
      reply.appendChild(rc);
      reply.style.width = reply.style.height = rs + 'px';
      reply.style.left = (sideBySide ? left + side + GAP : Math.round((rr.width - rs) / 2)) + 'px';
      reply.style.top = (sideBySide ? top + side - rs : top + side + GAP) + 'px';
      reply.style.transform = 'rotate(2.5deg)'; reply.style.opacity = '0';   // (it doesn't fly: it fades in once the main note has landed)
    }
    const shut = () => { if (performance.now() - zoom?.t0 > 250) hideZoom(); };
    back.addEventListener('click', shut); box.addEventListener('click', shut); reply?.addEventListener('click', shut);
    wrap.append(back, box); if (reply) wrap.append(reply);
    zoom = { box, back, reply, post, side, closing: false, t0: performance.now(), timer: 0 };
    ctx.camera.updateMatrixWorld();
    const home = homeOf(post, box, side);
    back.style.opacity = '0';
    if (home) { box.style.transform = home; } else box.style.opacity = '0';
    void box.offsetWidth;
    const tr = 'transform .35s cubic-bezier(.2,.8,.3,1), opacity .35s';
    box.style.transition = tr; back.style.transition = 'opacity .35s';
    box.style.transform = 'none'; box.style.opacity = '1'; back.style.opacity = '1';
    if (reply) { reply.style.transition = 'opacity .3s ease .25s'; reply.style.opacity = '1'; }
    sfx('pop');
  };
  // true when there was a zoomed note (going now, or already going); instant: gone at once, no flight
  const hideZoom = instant => {
    const z = zoom; if (!z) { zoomTok++; return false; }
    if (instant) { clearTimeout(z.timer); timers.delete(z.timer); z.box.remove(); z.back.remove(); z.reply?.remove(); zoom = null; return true; }
    if (z.closing) return true;
    z.closing = true;
    if (z.reply) { z.reply.style.transition = 'opacity .15s'; z.reply.style.opacity = '0'; }
    ctx.camera.updateMatrixWorld();
    const home = homeOf(z.post, z.box, z.side);
    if (home) z.box.style.transform = home; else z.box.style.opacity = '0';
    z.back.style.opacity = '0';
    z.timer = later(() => { z.box.remove(); z.back.remove(); z.reply?.remove(); if (zoom === z) zoom = null; }, 370);
    return true;
  };
  zoomApi = { show: showZoom, hide: hideZoom };

  // ---- writing a note: a blank one in the middle of the panel, a pencil going over it a letter at a time
  const makeCard = color => {
    const sc = window.innerHeight < 600 ? 1 : 2, px = NOTE * sc;
    const card = el('div', 'bdNote'); card.style.width = card.style.height = px + 'px'; card.style.background = color;
    const cv = el('canvas'); cv.width = cv.height = NOTE; cv.style.width = cv.style.height = px + 'px';
    const pen = el('i', 'bdPen'); pen.style.width = 6 * sc + 'px'; pen.style.height = 30 * sc + 'px'; pen.style.transform = 'translate(-40px,-40px)';
    card.append(cv, pen); card.dataset.sc = String(sc);
    const pr = panel.getBoundingClientRect(), rr = root.getBoundingClientRect();
    // (sitting just above the panel, in the open, where the writing can be watched; not in the list)
    card.style.left = pr.left - rr.left + pr.width / 2 - px / 2 + 'px'; card.style.top = Math.max(8, pr.top - rr.top - px - 14) + 'px';
    wrap.appendChild(card);
    return card;
  };
  const movePen = (card, x, y) => {   // the tip at (x, y) in the note's own pixels
    const sc = +card.dataset.sc, pen = card.querySelector('.bdPen');
    pen.style.transform = `translate(${(x - 3) * sc}px,${y * sc - 30 * sc}px) rotate(35deg)`;
  };
  const write = (card, message, who, r) => new Promise(done => {
    const g = card.querySelector('canvas').getContext('2d');
    setInk(g);
    const chars = noteChars(message); let i = 0, signed = false;
    const step = () => {
      if (r.dead) { done(false); return; }
      if (i < chars.length) {
        const ch = chars[i], [x, y] = cellOf(i);
        g.fillText(ch, x, y + Math.round(Math.random() * 2 - 1));   // (a pixel up or down, like a hand)
        movePen(card, x + 8, y + 16);
        i++;
        if (ch.trim()) { sfx('tick'); later(step, 170); } else later(step, 50);   // (slow, a hand's pace)
      } else if (!signed) {
        signed = true;
        signNote(g, who);
        movePen(card, NOTE - 10, NOTE - 6);
        sfx('tick'); later(step, 700);
      } else done(true);
    };
    step();
  });
  // taken: it flies to its place on the board, and the board's picture is drawn there as it lands
  const fly = (card, id) => new Promise(done => {
    const { x, y } = notePos(id), toZ = px => Z0 + px / PPM, toY = py => Y1 - py / PPM;
    const a = toRoot(toZ(x), toY(y)), c = toRoot(toZ(x + NOTE), toY(y + NOTE));
    card.querySelector('.bdPen').hidden = true;
    if (!a || !c) { redrawBoard(); card.remove(); done(); return; }
    const cr = card.getBoundingClientRect(), rr = root.getBoundingClientRect();
    const dx = (a[0] + c[0]) / 2 - (cr.left - rr.left + cr.width / 2), dy = (a[1] + c[1]) / 2 - (cr.top - rr.top + cr.height / 2);
    const s = Math.max(0.04, (c[0] - a[0]) / cr.width);
    void card.offsetWidth;
    card.style.transition = 'transform .55s cubic-bezier(.25,.1,.3,1)';
    card.style.transform = `translate(${dx}px,${dy}px) scale(${s})`;
    later(async () => { await redrawBoard(); sfx('pop'); later(() => card.remove(), 120); done(); }, 580);
  });
  // refused: crossed out, crumpled, gone
  const crumple = card => new Promise(done => {
    const g = card.querySelector('canvas').getContext('2d');
    g.strokeStyle = '#c0282d'; g.lineWidth = 3; g.beginPath(); g.moveTo(8, 18); g.lineTo(NOTE - 8, NOTE - 8); g.moveTo(NOTE - 8, 18); g.lineTo(8, NOTE - 8); g.stroke();
    card.querySelector('.bdPen').hidden = true;
    sfx('popDown');
    later(() => { card.classList.add('bin'); later(() => { card.remove(); done(); }, 760); }, 350);
  });

  async function submit() {
    if (busy || dead || wrap.hidden || offline()) return;
    const message = cleanText(text.value, MSG_MAX);
    if (!message) { flash('還沒寫內容'); text.focus(); return; }
    const who = cleanText(nick.value, NICK_MAX);
    try { localStorage.setItem(NICK_KEY, who); } catch {}
    busy = true; flashMsg = ''; refreshForm();
    const r = run = { dead: false };
    const sent = sendNote(who, message);   // (the POST and the writing start together; the result is looked at when it's written)
    try { await document.fonts?.load(`16px ${DOT}`, message + who); } catch {}
    if (dead) return;
    const card = makeCard(colorOf(who || DEFAULT_NICK, message));
    const [res] = await Promise.all([sent, write(card, message, who || DEFAULT_NICK, r)]);
    if (dead) return;
    if (res.ok) addPost(res.post);
    if (r.dead) {   // (the panel was shut meanwhile: no flight, the note just turns up on the board)
      card.remove();
      if (res.ok) redrawBoard();
    } else if (res.ok) {
      await fly(card, res.post.id);
      if (dead) return;
      text.value = '';
    } else {
      flashMsg = res.message; refreshForm();
      await crumple(card);
      if (dead) return;
    }
    if (res.ok && r.dead) text.value = '';
    busy = false; if (run === r) run = null; refreshForm();
  }

  function open() {
    if (!wrap.hidden) return;
    wrap.hidden = false; opened = true; root.classList.add('boardOpen');
    if (S.board) S.board.hover = false;
    flashMsg = ''; fitKb(); drawList(); refreshForm(); loadPosts();
    list.scrollTop = 0;
    if (window.matchMedia('(pointer: fine)').matches) text.focus({ preventScroll: true });
  }
  function close() {
    if (wrap.hidden) return;
    if (run) run.dead = true;   // (a note half written is dropped; one already sent still lands on the board)
    zoomTok++; hideZoom(true);
    wrap.hidden = true; opened = false; root.classList.remove('boardOpen');
    nick.blur(); text.blur();
    wrap.querySelectorAll('.bdNote').forEach(n => n.remove());
    if (!run) busy = false;
    refreshForm();
  }
  return { open, close, isOpen: () => !wrap.hidden };
}
