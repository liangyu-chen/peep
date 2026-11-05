// 畫質: 高效能 (the default) redraws the sun's shadows every frame, so people, doors, fans, cups and the traffic cast
// their own as they move; 一般 draws them once, for what stands still, and gives people a soft round shadow under them
// (much lighter work, on a tablet especially). Each visit starts at 高效能.
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

export function setQuality(q) {
  S.quality = q === 'high' ? 'high' : 'normal';
  const high = highQuality();
  movers().forEach(moverShadows);
  (S.people || []).forEach(p => { if (p.blob) p.blob.visible = !high; });
  if (ctx.renderer) { ctx.renderer.shadowMap.autoUpdate = high; ctx.renderer.shadowMap.needsUpdate = true; }
}
