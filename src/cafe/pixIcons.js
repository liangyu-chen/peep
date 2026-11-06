// Little pixel-art icons for the games' corner controls ('#' a lit pixel, drawn in the button's text colour with hard
// edges), matching the café HUD's own speaker.
const SPK = ['....#.......', '...##...#...', '..###....#..', '####.#.#..#.', '####.#..#.#.', '####.#..#.#.', '####.#.#..#.', '..###....#..', '...##...#...', '....#.......'];
const SPK_OFF = ['....#.......', '...##.......', '..###.......', '####.#.#...#', '####.#..#.#.', '####.#...#..', '####.#..#.#.', '..###..#...#', '...##.......', '....#.......'];
const CROSS = ['##......##', '###....###', '.###..###.', '..######..', '...####...', '...####...', '..######..', '.###..###.', '###....###', '##......##'];

export const pix = (rows, cls = '') => `<svg class="${cls}" viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${
  rows.flatMap((r, y) => [...r].map((c, x) => (c === '#' ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ''))).join('')}</svg>`;

// the speaker and the leave button, as one pixel panel (styled by .pxCtl); `cls` names the panel, `sound`/`close` the buttons
export const cornerControls = (cls, sound, close, closeLabel = '離開') =>
  `<div class="pxCtl ${cls}"><button class="pxSound ${sound}" aria-label="音效">${pix(SPK, 'icoOn')}${pix(SPK_OFF, 'icoOff')}</button>` +
  `<button class="pxClose ${close}" aria-label="${closeLabel}">${pix(CROSS)}<span>${closeLabel}</span></button></div>`;
