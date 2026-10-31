// The floor plan: where things stand, where people sit and how they walk.
// Plan coordinates in metres: x -3.1 (purple wall) .. 3.1 (pegboard wall), z back of house (negative) .. street (8+).
// The built set is later squeezed by K in x, and everything behind z = -4.6 moves BACK_SHIFT forward.
import { K } from './util.js';

export const WH = 2.8;            // wall height
export const BACK_SHIFT = 1.0;
export const KERB = 8.08, RISE = 0.18;   // the shop front is raised RISE above the street, out to the kerb at z = KERB (the Vespa and the kerb camping chair stand below it)
export const HUBX = -1.6;          // the main walkway runs along this x

export const TVX = -2.6, TVZ = -3.15, TVY = 1.3;   // the TV on its rolling cart
export const LW = -2.78;                          // seats along the purple wall
export const LSEATS = [2.0, 0.9, -0.2, -1.3];     // from the door inwards
const LCUP = { '2.0': 1.62, '0.9': 1.28, '-0.2': 0.3, '-1.3': -0.92 };   // which table each purple-wall seat puts its cup on

// the middle table outside, street side first: blocks, crates, crates, crates, blocks (built small, then scaled up)
export const STRIP = { blocks: [6.42, 5.30], crates: [6.14, 5.86, 5.58], scale: 1.35, from: 5.86, to: 6.0 };
STRIP.at = z => (z - STRIP.from) * STRIP.scale + STRIP.to;   // plan z -> where it ends up

export const LANE = 1.9;                 // the owner's lane behind the bar
export const MACHINE = [1.62, 1.5];      // where he stands to work the espresso machine (back far enough that he is not inside the bar top)

export const TOILET = [[1.25, -7.7], [0.0, -7.7], [-2.0, -7.7], [-2.0, -5.0], [-2.0, -4.0], [HUBX, -3.6]];   // through the open (right) half of the sliding door
export const DOOR = [[-1.75, 11], [-1.75, 4.75], [-1.6, 4.5], [HUBX, 3.6]];
export const zoneSpot = s => [[s.x, s.z], [HUBX, s.z]];
export const route = (from, to) => from.slice(1).concat(to.slice().reverse());

// every place someone can sit, stand to watch or queue; each holds who is using it (occ)
export function createSeats() {
  const seats = [];
  const seat = (type, x, z, face, sitY, cup, path, extra = {}) => { const s = Object.assign({ type, x, z, face, sitY, cup, path, occ: null }, extra); seats.push(s); return s; };

  // manga ledge stools facing the neon wall
  [0.1, 1.0, 1.9].forEach(x => seat('table', x, -3.95, Math.PI, 0.12, [x, 1.03, -4.28], [[x, -3.95], [HUBX, -4.1]], { where: '霓虹燈下的漫畫吧檯' }));
  // purple wall cinder seats, backs to the wall
  LSEATS.forEach(z => {
    const cz = LCUP[String(z)], onStump = Math.abs(cz - 0.35) < 0.1;
    seat('table', LW, z, Math.PI / 2, -0.1, [LW, onStump ? 0.43 : 0.61, cz], [[LW, z], [HUBX, z]], { where: '紫色牆邊' });
  });
  // by the work counter: two at the back end, an L in the door-end corner
  seat('table', 2.75, -2.55, -Math.PI / 2, -0.1, [2.72, 0.61, -2.98], [[2.75, -2.55], [2.0, -2.55], [1.2, -3.2], [HUBX, -3.2]], { where: '工作台旁' });
  seat('table', 2.75, -3.65, -Math.PI / 2, -0.1, [2.78, 0.61, -3.22], [[2.75, -3.65], [2.0, -3.65], [1.2, -3.2], [HUBX, -3.2]], { where: '工作台旁' });
  seat('table', 2.75, 2.95, -Math.PI / 2, -0.1, [2.7, 0.61, 3.55], [[2.75, 2.95], [2.1, 3.0], [HUBX, 3.0]], { where: '轉角' });
  seat('table', 2.05, 3.7, Math.PI, -0.1, [2.62, 0.61, 3.72], [[2.05, 3.7], [1.7, 3.3], [HUBX, 3.3]], { where: '轉角' });
  // arcade: the two chair rows face the middle strip, cups on the nearest crate
  const PORCH = [[-1.6, 4.5], [HUBX, 3.6]];
  const pc = (x, z) => [x, 0.61, z];
  const W = [-1.75, 4.75];   // the arcade walkway runs between the left row and the strip
  const crateCup = (z, side) => { const cz = STRIP.crates.map(STRIP.at).reduce((a, b) => (Math.abs(z - b) < Math.abs(z - a) ? b : a)); return pc(-1.0 + side * 0.13, cz + (z - cz) * 0.2); };
  [5.5, 6.0, 6.5].forEach(z => seat('table', -2.72, z, Math.PI / 2, -0.1, crateCup(z, -1), [[-2.72, z], [-2.05, z], [-1.9, 4.75]].concat(PORCH), { porch: true }));
  [6.1, 6.6, 7.1].forEach(z => seat('table', 0.62, z, -Math.PI / 2, -0.1, crateCup(z, 1), [[0.62, z], [0.05, z], [0.05, 4.7]].concat(PORCH), { porch: true }));
  // the camping chair on the kerb, and the two seats by the scooter
  seat('table', -0.55, 8.55, 0, -0.17, [-0.55, 0.61 - RISE, 9.12], [[-0.55, 8.55], [-1.3, 8.3], W].concat(PORCH), { porch: true, where: '門口' });
  // the beanbag in the nook outside the storeroom door, its cup on the block shelf beside it
  seat('table', 2.45, 4.93, -Math.PI / 2, -0.24, [2.55, 0.625, 4.2], [[2.45, 4.93], [1.5, 4.75], [0.05, 4.7]].concat(PORCH), { porch: true, where: '倉庫門口的懶骨頭' });
  // (the pair and their block table sit 0.35 m left of where they were first drawn)
  seat('table', -0.85, 7.75, Math.PI, -0.1, [-0.47, 0.61, 7.7], [[-0.85, 7.75], [-0.6, 7.3], [-0.45, 4.7]].concat(PORCH), { porch: true, where: '機車旁' });
  seat('table', 0.03, 7.75, Math.PI, -0.1, [-0.35, 0.61, 7.8], [[0.03, 7.75], [0.03, 7.3], [-0.45, 7.3], [-0.45, 4.7]].concat(PORCH), { porch: true, where: '機車旁' });
  const tableSeats = seats.filter(s => s.type === 'table');

  // the two round stools in front of the TV, and two spots to stand and watch
  const gameSeats = [[-0.45, -3.6], [-0.45, -2.7]].map(([x, z]) => seat('game', x, z, Math.atan2(K * (TVX - x), TVZ - z), 0.12, null, [[x, z], [HUBX, z]]));
  const specSpots = [[0.35, -3.25], [-1.3, -4.2]].map(([x, z]) => ({ type: 'spec', x, z, face: Math.atan2(K * (TVX - x), TVZ - z), occ: null, path: [[x, z], [HUBX, z]] }));

  // where customers queue to order across the bar
  const counterSpots = [-1.0, -0.05, 0.85].map(z => ({ z, x: -0.6, occ: null }));

  return { seats, tableSeats, gameSeats, specSpots, counterSpots };
}
