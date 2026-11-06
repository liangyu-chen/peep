// 畫質, the same on every device: 高效能 (the default) draws up to 60 frames a second at the screen's full sharpness and
// redraws the sun's shadows every frame, so people, doors, fans, cups and the traffic cast their own as they move;
// 一般 draws 30 a second, fewer pixels (at most about 2 million a frame, and fewer still if it can't keep up), and the
// shadows once, for what stands still, people getting a soft round shadow under them: much lighter work, on a tablet
// especially. Each visit starts at 高效能.
import { ctx } from './engine.js';
import { S } from './state.js';

export const DEFAULT_QUALITY = 'high';
export const highQuality = () => (S.quality || DEFAULT_QUALITY) === 'high';

// a moving thing's meshes: shadows off in 一般, back to what they were made with in 高效能
export function moverShadows(root) {
  if (!root) return;
  const high = highQuality();
  root.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.castWas === undefined) o.userData.castWas = o.castShadow;
    o.castShadow = high && o.userData.castWas && !o.userData.blob;
  });
}

function movers() {
  return [S.frontDoor, S.slideDoor, S.toiletDoor, S.acFan, S.stadium, ...(S.fans || []), ...(S.ashtrays || []).map(a => a.g),
    ...(S.traffic || []).map(v => v.g), ...(S.people || []).flatMap(p => [p.g, p.bear?.g, p.cup])];
}

// the sharpness to draw at: the screen's own (up to 2x), or in 一般 no more than about 2 million pixels a frame
export function qualityPR() {
  const dpr = window.devicePixelRatio || 1, el = ctx.renderer?.domElement;
  if (highQuality()) return Math.min(dpr, 2);
  const w = el?.clientWidth || window.innerWidth, h = el?.clientHeight || window.innerHeight;
  return Math.min(dpr, Math.max(1, Math.min(1.5, Math.sqrt(2e6 / (w * h)))));
}
export const frameMs = () => (highQuality() ? 1000 / 60 : 1000 / 30);

export function setQuality(q) {
  S.quality = q === 'high' ? 'high' : 'normal';
  const high = highQuality();
  if (ctx.renderer) ctx.renderer.setPixelRatio(qualityPR());
  movers().forEach(moverShadows);
  (S.people || []).forEach(p => { if (p.blob) p.blob.visible = !high; });
  if (ctx.renderer) { ctx.renderer.shadowMap.autoUpdate = high; ctx.renderer.shadowMap.needsUpdate = true; }
}
