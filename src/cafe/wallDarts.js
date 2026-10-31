// Darts played on the board on the purple wall itself, no window: once the camera has closed in on it the whole view drops
// to chunky 8-bit pixels, a crosshair wobbles where you point, and each throw sticks a dart in the real board, scored by
// what it hit. Three rounds of three; leaving puts the view and the board back as they were.
import * as THREE from 'three';
import { ctx, mat } from './engine.js';
import { S } from './state.js';
import { K, $ } from './util.js';
import { dartScore } from './dartboard.js';
import { sfx, sfxMuted, toggleSfx } from './sfx.js';

const BOARD = { x: (-2.995 + 0.0225) * K, y: 1.55, z: 3.06, r: 0.25 };   // the middle of its face, in the room as built
const FLIGHTS = [0xc0282d, 0x1c4fd6, 0xffd23f];
let active = null;

export function stopWallDarts() { active?.stop(); }

function dartMesh(color) {   // tip at the origin, pointing -x into the board
  const g = new THREE.Group();
  const steel = mat(0x9aa0a6, { metalness: 0.8, roughness: 0.3 });
  const part = (r0, r1, len, m, x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 8), m); c.rotation.z = -Math.PI / 2; c.position.x = x; g.add(c); };
  part(0.0008, 0.002, 0.03, steel, 0.015);                                   // point
  part(0.006, 0.006, 0.05, mat(0x5a5f66, { metalness: 0.7, roughness: 0.35 }), 0.055);   // barrel
  part(0.0025, 0.0025, 0.04, mat(0x1f1c27), 0.1);                            // shaft
  const fm = mat(color, { roughness: 0.6, side: THREE.DoubleSide });
  [0, Math.PI / 2].forEach(a => { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.04), fm); f.position.x = 0.13; f.rotation.x = a; g.add(f); });   // the flights, crossed
  g.scale.setScalar(1.5);   // a little larger than life, so they read in chunky pixels
  return g;
}

export function playWallDarts(root, onClose) {
  stopWallDarts();
  const { renderer, controls, camera } = ctx, canvas = renderer.domElement;
  const size = () => [canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight];
  // 8-bit: the scene drawn about 320 pixels across and blown up with hard edges
  const ratio = renderer.getPixelRatio();
  const pixelate = on => {
    const [w, h] = size();
    renderer.setPixelRatio(on ? Math.max(0.2, Math.min(1, 320 / w)) : ratio); renderer.setSize(w, h);
    canvas.style.imageRendering = on ? 'pixelated' : '';
  };
  pixelate(true);
  controls.enabled = false;
  root.classList.add('playing');
  const labels = $('labels'); if (labels) labels.style.visibility = 'hidden';
  S.boardDarts?.forEach(m => { m.visible = false; });

  const hud = document.createElement('div'); hud.className = 'dartsHud';
  hud.innerHTML = `<div class="dTop"><span class="dRound"></span><span class="dLeft"></span><span class="dScore"></span></div>
    <div class="dPop"></div><div class="dAim"></div>
    <div class="dEnd" hidden><b></b><span></span><button class="dAgain">再玩一次</button></div>
    <p class="dHelp">移動滑鼠或手指瞄準，準星會晃，抓好時機點一下（或空白鍵）射出 · 三輪、每輪三支</p>
    <div class="dBtns"><button class="dSound" aria-label="音效"></button><button class="dClose" aria-label="離開">✕ 離開</button></div>`;
  root.appendChild(hud);
  const q = s => hud.querySelector(s), aimEl = q('.dAim'), pop = q('.dPop');

  const toScreen = (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).project(camera), r = canvas.getBoundingClientRect();
    return [(v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height];
  };
  const mid = toScreen(BOARD.x, BOARD.y, BOARD.z), edge = toScreen(BOARD.x, BOARD.y + BOARD.r, BOARD.z);
  const R = Math.hypot(edge[0] - mid[0], edge[1] - mid[1]);   // the board's radius on screen
  let pointer = mid.slice();
  const s = { round: 1, darts: [], total: 0, clearT: 0, popT: 0, done: false };
  const aim = t => [pointer[0] + (Math.sin(t * 2.3) * 0.17 + Math.sin(t * 5.3) * 0.055) * R, pointer[1] + (Math.cos(t * 1.9) * 0.16 + Math.sin(t * 4.1) * 0.05) * R];

  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -BOARD.x), hitP = new THREE.Vector3();
  function throwDart() {
    if (s.done || s.clearT > 0 || s.darts.length >= 3) return;
    const [ax, ay] = aim(performance.now() / 1000), r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(ax / r.width * 2 - 1, -ay / r.height * 2 + 1), camera);
    if (!ray.ray.intersectPlane(plane, hitP)) return;
    const hit = dartScore(-(hitP.z - BOARD.z) / BOARD.r, -(hitP.y - BOARD.y) / BOARD.r);   // as you look at it: right is -z, down is -y
    const d = dartMesh(FLIGHTS[s.darts.length]);
    d.userData = { at: hitP.clone().setX(BOARD.x - (hit.pts ? 0.012 : 0.03)), from: camera.position.clone(), t: 0, sound: hit.pts >= 50 ? 'bull' : hit.pts ? 'thunk' : 'wall' };
    sfx('throw');
    d.rotation.set(0, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25 + 0.08);
    ctx.scene.add(d); s.darts.push(d);
    s.total += hit.pts; pop.textContent = hit.label; pop.classList.toggle('miss', !hit.pts); s.popT = 1.1;
    if (s.darts.length === 3) s.clearT = 1.5;
  }
  const clearDarts = () => { s.darts.forEach(d => ctx.scene.remove(d)); s.darts = []; };
  function again() { clearDarts(); Object.assign(s, { round: 1, total: 0, clearT: 0, done: false }); q('.dEnd').hidden = true; }

  const offs = [];
  const listen = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); offs.push(() => el.removeEventListener(ev, fn, opt)); };
  const at = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  listen(hud, 'pointermove', e => { pointer = at(e); });
  listen(hud, 'pointerdown', e => { if (e.target.closest('button')) return; e.preventDefault(); pointer = at(e); throwDart(); });
  listen(q('.dClose'), 'click', () => stop());
  listen(q('.dAgain'), 'click', again);
  const showSound = () => { q('.dSound').textContent = sfxMuted() ? '🔇' : '🔊'; };
  showSound(); listen(q('.dSound'), 'click', () => { toggleSfx(); showSound(); });
  listen(window, 'keydown', e => {
    if (e.key === 'Escape') stop();
    else if (e.key === ' ') { e.preventDefault(); if (!e.repeat) throwDart(); }
  }, true);

  let raf = 0, last = performance.now();
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now;
    const [ax, ay] = aim(t); aimEl.style.transform = `translate(${ax}px, ${ay}px)`; aimEl.hidden = s.done;
    s.darts.forEach(d => {   // flying in from the hand, then stuck
      const u = d.userData; if (u.t >= 1) return;
      u.t = Math.min(1, u.t + dt / 0.14);
      if (u.t >= 1) { sfx(u.sound === 'bull' ? 'thunk' : u.sound); if (u.sound === 'bull') sfx('bull'); }   // it lands
      d.position.lerpVectors(u.from.clone().add(new THREE.Vector3(0, -0.15, 0)), u.at, u.t);
    });
    if (s.popT > 0) { s.popT -= dt; pop.style.opacity = s.popT > 0 ? 1 : 0; }
    if (s.clearT > 0) {
      s.clearT -= dt;
      if (s.clearT <= 0) {
        if (s.round >= 3) {
          s.done = true;
          let best = s.total; try { best = Math.max(best, Number(localStorage.getItem('peep.darts.best')) || 0); localStorage.setItem('peep.darts.best', String(best)); } catch { /* private mode */ }
          sfx('win');
          q('.dEnd b').textContent = `總分 ${s.total}`; q('.dEnd span').textContent = `最高紀錄 ${best}`; q('.dEnd').hidden = false;
        } else { s.round++; clearDarts(); }
      }
    }
    q('.dRound').textContent = `ROUND ${s.round}/3`;
    q('.dLeft').textContent = '➶'.repeat(3 - s.darts.length) || '—';
    q('.dScore').textContent = `SCORE ${s.total}`;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  function stop() {
    if (active !== api) return;
    active = null;
    cancelAnimationFrame(raf); offs.forEach(f => f()); hud.remove(); clearDarts();
    pixelate(false); controls.enabled = true; root.classList.remove('playing');
    if (labels) labels.style.visibility = '';
    S.boardDarts?.forEach(m => { m.visible = true; });
    onClose?.();
  }
  const api = { stop }; active = api;
}
