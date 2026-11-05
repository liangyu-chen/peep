// Entry point: startCafe(root, content, onReady) builds the café inside root, a step at a time so the loading screen
// keeps moving, calls onReady once it's drawing, and returns a function that tears it down.
// root must contain the HUD markup (see app/Cafe.tsx); content is { menu, lines } from the back office.
import { ctx, createEngine, disposeEngine, LOW_POWER } from './engine.js';
import { S, resetState } from './state.js';
import { K, PIX } from './util.js';
import { createSeats } from './layout.js';
import { createRegulars } from './profiles.js';
import { buildWorld } from './world/index.js';
import { updateLighting } from './world/lights.js';
import { updateTV, drawTV } from './tv.js';
import { createOwner, createSteam, createSmoke, seedOpeningScene, tickShop, updateSteam, updateSmoke } from './sim.js';
import { bindHUD, updateHUD, fillCard, updateCamera, updateLabels } from './hud.js';
import { renderResults } from './feed.js';
import { createStadium, updateTops } from './tops.js';
import { SMOKE_POSE, DRINK_POSE } from './people.js';
import { updateSurroundings } from './world/surroundings.js';
import { mergeStatic } from './optimize.js';
import { disposePortraits } from './portrait.js';
// (one café at a time: a new one waits until the one before is built and, if it was let go meanwhile, torn down)
let queue = Promise.resolve();
export function startCafe(root, content, onReady) {
  let stop = null, cancelled = false;
  queue = queue.then(() => cancelled ? null : build(root, content)).then(s => {
    if (!s) return;
    stop = s; if (cancelled) s(); else onReady?.();
  }).catch(err => console.error(err));
  return () => { cancelled = true; stop?.(); };
}
// a moment for the page to draw between the heavy steps of building
const breathe = () => new Promise(r => setTimeout(r, 0));
// the things in the set that move cast no shadow, as the shadow map is drawn once: the doors, the fans, the stadium,
// the ashtrays the owner carries off
function stillShadows() {
  const off = o => o && o.traverse(m => { m.castShadow = false; });
  [S.frontDoor, S.slideDoor, S.toiletDoor, S.acFan, S.stadium].forEach(off);
  (S.fans || []).forEach(off);
  (S.ashtrays || []).forEach(a => off(a.g));
}

async function build(root, content) {
  resetState(content);
  const stage = root.querySelector('#stage');
  S.labelsEl = root.querySelector('#labels');
  S.regulars = createRegulars();
  S.seats = createSeats();

  createEngine(stage);
  buildWorld(); await breathe();
  mergeStatic(); await breathe();   // the set's still parts drawn in far fewer calls
  createStadium();
  createSteam();
  createSmoke();
  createOwner();
  seedOpeningScene(); await breathe();
  const unbind = bindHUD(root, stage);
  renderResults();

  let last = performance.now(), tvFrameN = 0, raf = 0;
  const near = (x, z, r) => S.people.some(p => Math.hypot(p.g.position.x - x * K, p.g.position.z - z) < r);
  // everything that moves, for dt real seconds (sdt simulated seconds)
  function simulate(dt, sdt) {
    tickShop(sdt);
    for (let i = S.timers.length - 1; i >= 0; i--) { const tm = S.timers[i]; tm.t -= sdt; if (tm.t <= 0) { S.timers.splice(i, 1); tm.r(); } }
    S.people.slice().forEach(p => p.update(sdt));
    updateTV(sdt);
    updateSteam(sdt);
    updateSmoke(sdt);
    updateTops(sdt);
    updateSurroundings(dt);
    if (S.ledClock) S.ledClock();   // the corner's LED clock (redraws only when the minute changes)
    S.acFan.rotation.x += dt * 12;
    S.fans.forEach(f => { f.rotation.y += dt * 4; });
    // doors open when someone comes close
    S.slide.open += ((near(-1.84, -4.5, 1.3) ? 1 : 0) - S.slide.open) * Math.min(1, dt * 5);
    S.slideDoor.position.x = -1.86 - S.slide.open * 0.76;   // slides left in front of the fixed panel
    S.toiletDoor.rotation.y += ((near(-0.8, -7.7, 1.1) ? -Math.PI / 2 : 0) - S.toiletDoor.rotation.y) * Math.min(1, dt * 5);   // swings in, flat to the toilet's front wall
    // (held shut while someone plays darts: it swings in right across the board)
    const doorOpen = near(-1.7, 4.0, 1.3) && !S.darting;
    S.frontDoor.rotation.y += ((doorOpen ? 1.45 : 0) - S.frontDoor.rotation.y) * Math.min(1, dt * 5);
    // fade the outer walls the camera is behind
    const cp = ctx.camera.position;
    // while a visitor plays on the TV, nobody stands or walks between them and the screen (those sitting playing it stay,
    // below the view)
    const w = S.watch;
    S.people.forEach(p => {
      const q = p.g.position, seated = p.pose === 'sit' && p.seat && p.seat.type === 'game';
      p.g.visible = !(w && !seated && q.x > w.x + 0.2 && q.x < cp.x + 0.6 && Math.abs(q.z - w.z) < 1.5);
    });
    S.fadeWalls.forEach(w => {
      const behind = (w.side === 'L' && cp.x < -3.1 * K) || (w.side === 'R' && cp.x > 3.1 * K) || (w.side === 'B' && cp.z < -8.35);
      w.me.material.opacity += ((behind ? 0.12 : 1) - w.me.material.opacity) * Math.min(1, dt * 8);
      w.me.material.depthWrite = w.me.material.opacity > 0.9;
      if (w.me.castShadow !== !behind) { w.me.castShadow = !behind; S.shadowDirty = true; }
    });
  }
  // a tablet or phone draws every other frame (30 a second), a computer at most 60 (a 120 or 144 Hz screen would
  // otherwise draw twice as many for nothing). (The shadows are redrawn every frame: skipping some made the lit walls
  // and posters flicker between frames.)
  // A computer also drops to 30 while nobody's touching it (20 seconds without the mouse, keys or a touch, or the
  // window in the background): the café just plays on, and that halves the work without making anything blurrier.
  const target = LOW_POWER ? 1000 / 30 : 1000 / 60;
  let lastInput = performance.now();
  const poke = () => { lastInput = performance.now(); };
  const INPUTS = ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart'];
  INPUTS.forEach(e => window.addEventListener(e, poke, { passive: true }));
  const idle = now => now - lastInput > 20000 || !document.hasFocus();
  // and on a tablet the resolution follows how it's keeping up: frames coming slow for a second and a half, it draws
  // fewer pixels (down to 0.7 of a CSS pixel); quick again for a good while, it comes back up a step. (A computer always
  // draws at full sharpness.)
  const res = { max: ctx.renderer.getPixelRatio(), sum: 0, n: 0, good: 0 };
  res.min = Math.min(res.max, 0.7);
  function adapt(gap) {
    if (!LOW_POWER || S.darting || gap > 250) return;   // (the darts draw in chunky pixels of their own; a long gap is the tab coming back)
    res.sum += gap; res.n++;
    if (res.sum < 1500) return;
    const avg = res.sum / res.n; res.sum = res.n = 0;
    let pr = ctx.renderer.getPixelRatio();
    if (avg > target * 1.45 && pr > res.min) { pr = Math.max(res.min, pr - 0.15); res.good = 0; }
    else if (avg < target * 1.12) { if (++res.good >= 6 && pr < res.max) { pr = Math.min(res.max, pr + 0.1); res.good = 0; } }
    else res.good = 0;
    if (pr !== ctx.renderer.getPixelRatio()) ctx.renderer.setPixelRatio(pr);
  }
  function frame(now) {
    if (S.stopped) return;
    if (now - last < (idle(now) ? 1000 / 30 : target) - 4) { raf = requestAnimationFrame(frame); return; }
    adapt(now - last);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    simulate(dt, dt * S.speed);
    if ((tvFrameN = (tvFrameN + 1) % 2) === 0) drawTV();

    updateCamera(dt);
    ctx.controls.update();
    if (S.shadowDirty) { S.shadowDirty = false; ctx.renderer.shadowMap.needsUpdate = true; }
    ctx.renderer.render(ctx.scene, ctx.camera);
    updateLabels(dt, stage.clientWidth || window.innerWidth, stage.clientHeight || window.innerHeight);
    raf = requestAnimationFrame(frame);
  }

  const hudTimer = setInterval(() => { updateHUD(); updateLighting(); if (S.selected) fillCard(); }, 100);
  drawTV(); updateHUD(); updateLighting();
  if (document.fonts) Promise.all([document.fonts.load(`20px ${PIX}`), document.fonts.load('20px "DotGothic16"', '窺視珈琲五金')])
    .then(() => { if (!S.stopped) S.fontTex.forEach(t => t.redraw()); }).catch(() => {});
  // the first frame has every shader to compile and every mesh and texture to hand to the GPU: done in two goes
  ctx.renderer.compile(ctx.scene, ctx.camera); await breathe();
  // the sun's shadows are drawn once, for the set as it stands (its position never changes), and again only when
  // something that casts them changes (a wall fading as the camera goes behind it); what moves casts none of its own:
  // people get a soft round shadow under them instead (people.js). Redrawing the shadow map every frame was the
  // largest single cost on a tablet
  stillShadows();
  ctx.renderer.shadowMap.autoUpdate = false; ctx.renderer.shadowMap.needsUpdate = true;
  ctx.renderer.render(ctx.scene, ctx.camera); await breathe();
  raf = requestAnimationFrame(frame);
  // development only: step the simulation from the console without rendering, e.g. await __cafe.step(60)
  if (process.env.NODE_ENV !== 'production') window.__cafe = {
    S, ctx, SMOKE_POSE, DRINK_POSE, step: async (secs, dt = 0.05) => {
      for (let t = 0; t < secs && !S.stopped; t += dt) { simulate(dt, dt); for (let k = 0; k < 12; k++) await null; }
      drawTV(); updateHUD();
    },
    // move the camera along (a tween to a preset or a close-up) and draw, for when the page isn't getting frames
    view: (secs = 1.5, dt = 0.05) => {
      for (let t = 0; t < secs; t += dt) updateCamera(dt);
      ctx.controls.update(); ctx.renderer.render(ctx.scene, ctx.camera);
    },
  };

  return function stopCafe() {
    S.stopped = true;
    disposePortraits();
    INPUTS.forEach(e => window.removeEventListener(e, poke));
    cancelAnimationFrame(raf);
    clearInterval(hudTimer);
    unbind();
    S.people.slice().forEach(p => p.remove());
    S.floaters.forEach(f => f.el.remove());
    ctx.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    disposeEngine();
  };
}
