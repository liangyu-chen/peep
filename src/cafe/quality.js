// 畫質: 一般 (the default) draws the sun's shadows once, for what stands still, and gives people a soft round shadow
// under them; 高效能 redraws the shadows every frame, so people, doors, fans, cups and the traffic cast their own as they
// move (it costs a good deal more, on a tablet especially). The choice is remembered on this device.
import { ctx } from './engine.js';
import { S } from './state.js';

const KEY = 'peep.quality';
export function savedQuality() {
  try { return localStorage.getItem(KEY) === 'high' ? 'high' : 'normal'; } catch { return 'normal'; }
}
export const highQuality = () => S.quality === 'high';

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
  try { localStorage.setItem(KEY, S.quality); } catch { /* private mode */ }
  const high = highQuality();
  movers().forEach(moverShadows);
  (S.people || []).forEach(p => { if (p.blob) p.blob.visible = !high; });
  if (ctx.renderer) { ctx.renderer.shadowMap.autoUpdate = high; ctx.renderer.shadowMap.needsUpdate = true; }
}
