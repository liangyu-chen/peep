// 8-bit basketball pieces shared by the TV's 2K match (tv.js) and the three-point contest a visitor plays (games.js):
// a little player in team colours and a crowd in the stands.
import { DOT } from './util.js';

const SHOE = '#f4efe3', SOLE = '#1f1c27', HAIR = '#1b1410';

// a player standing at (x, y) (the feet), u screen pixels to a sprite pixel, in kit {c1, c2, skin, hair, num};
// pose: 'stand', 'run', 'dribble', 'guard' (arms out) or 'shoot' (arms up); face 1 looks right, -1 left
export function hoopsPlayer(g, x, y, u, kit, pose = 'stand', t = 0, face = 1) {
  const px = (ax, ay, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x + (face > 0 ? ax : -ax - w) * u), Math.round(y - (ay + h) * u), Math.ceil(w * u), Math.ceil(h * u)); };
  const skin = kit.skin || '#c68a5e', step = pose === 'run' || pose === 'dribble' ? Math.round(Math.sin(t * 14) * 1) : 0;
  const jump = pose === 'shoot' ? 1.5 : 0;
  g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(Math.round(x - 3.5 * u), Math.round(y - u * 0.6), Math.ceil(7 * u), Math.ceil(u * 1.2));   // shadow
  const Y = jump;
  // legs: sneakers, then skin up to the shorts; a running stride lifts one foot
  [[-2.5, Math.max(0, step)], [0.5, Math.max(0, -step)]].forEach(([lx, lift]) => {
    px(lx, Y + lift, 2, 0.6, SOLE); px(lx, Y + lift + 0.6, 2, 0.9, SHOE); px(lx + 0.3, Y + lift + 1.5, 1.4, 2.7, skin);
  });
  px(-3, Y + 4, 6, 3, kit.c1); px(-3, Y + 4, 0.8, 3, kit.c2); px(2.2, Y + 4, 0.8, 3, kit.c2);   // shorts with side stripes
  px(-3, Y + 7, 6, 5, kit.c1);                                                                   // jersey
  px(-3, Y + 11.2, 1, 0.8, kit.c2); px(2, Y + 11.2, 1, 0.8, kit.c2); px(-1, Y + 11.4, 2, 0.6, kit.c2);   // trim round the arms and neck
  if (u >= 2.5 && kit.num != null) {   // the number, big enough to read
    g.font = `${Math.round(4 * u)}px ${DOT}`; g.textAlign = 'center'; g.fillStyle = kit.c2; g.fillText(String(kit.num), x, y - (Y + 7.6) * u);
  } else px(-1, Y + 8.5, 2, 2, kit.c2);
  // arms
  if (pose === 'shoot') { px(-2.2, Y + 11.5, 1.2, 5.5, skin); px(1, Y + 11.5, 1.2, 5.5, skin); }
  else if (pose === 'guard') { px(-5, Y + 9.5, 2.2, 1.2, skin); px(2.8, Y + 9.5, 2.2, 1.2, skin); px(-5.6, Y + 9.5, 1, 2.6, skin); px(4.6, Y + 9.5, 1, 2.6, skin); }
  else {
    const sw = pose === 'run' ? Math.round(Math.sin(t * 14) * 0.8) : 0;
    px(-4, Y + 7.6 + sw, 1.1, 3.8, skin); px(2.9, Y + 7.6 - sw, 1.1, pose === 'dribble' ? 2.8 : 3.8, skin);
    if (pose === 'dribble') px(3.4, Y + 6.8, 1.2, 1.2, skin);   // the hand out over the ball
  }
  // head: face, an eye on the side it looks, hair on top
  px(-1.8, Y + 12, 3.6, 3.8, skin); px(-2, Y + 15.2, 4, 1.4, kit.hair || HAIR); px(-2, Y + 13.6, 0.7, 1.8, kit.hair || HAIR);
  px(0.9, Y + 13.8, 0.6, 0.7, '#111');
}

// rows of fans in the stands between x0 and x1 from y0 down: a dark tier, heads and shirts; they bob when excited (0..1)
export function crowd(g, x0, x1, y0, rows, s, t, excite = 0) {
  // (no green shirts: green is the shot meter's)
  const SHIRTS = ['#ff4f7b', '#ffd23f', '#7ec8ff', '#f4efe3', '#c9c4d6', '#9b6bff', '#f08a24'], SKINS = ['#f1c9a5', '#e0ac80', '#c68a5e', '#8d5a3b'];
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * s * 3.2;
    g.fillStyle = r % 2 ? '#1a1420' : '#221a2a'; g.fillRect(x0, y + s * 1.2, x1 - x0, s * 3.2);   // the tier
    for (let i = 0, x = x0 + ((r * 7) % 3) * s; x < x1 - s * 2; i++, x += s * 3) {
      const h = (i * 31 + r * 17) % 97, jump = excite > 0 && Math.sin(t * 10 + h) > 0.2 ? Math.round(s * excite) : 0;
      g.fillStyle = SHIRTS[h % SHIRTS.length]; g.fillRect(x, y + s * 1.6 - jump, s * 2, s * 1.6);
      g.fillStyle = SKINS[h % SKINS.length]; g.fillRect(x + s * 0.4, y + s * 0.4 - jump, s * 1.2, s * 1.2);
      if (excite > 0.5 && h % 3 === 0) { g.fillStyle = SKINS[h % SKINS.length]; g.fillRect(x - s * 0.2, y - s * 0.6 - jump, s * 0.5, s * 1.4); g.fillRect(x + s * 1.7, y - s * 0.6 - jump, s * 0.5, s * 1.4); }   // arms up
    }
  }
}
