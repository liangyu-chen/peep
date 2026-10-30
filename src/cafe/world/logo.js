// The shop's melting-face logo, traced from the window: a head with a long drip running down its right side
// into a little bulb with its own small face. Drawn in its own 320 x 570 space; fit() places it in any canvas.
export const LOGO_W = 320, LOGO_H = 570;

// the outline of the window cut-out, clockwise from the top of the head
const OUTLINE = [
  [85, 68], [159, 62], [219, 72], [262, 106], [285, 160], [286, 220], [275, 268], [267, 318], [262, 370],
  [270, 420], [298, 470], [300, 520], [278, 556], [245, 566], [222, 540], [218, 495], [232, 440], [238, 390],
  [226, 345], [195, 330], [150, 328], [100, 318], [52, 292], [28, 245], [22, 190], [32, 130], [52, 92],
];

// a smooth closed curve through the outline (quadratic curves between midpoints)
export function logoPath(g) {
  const n = OUTLINE.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  g.beginPath();
  const m0 = mid(OUTLINE[n - 1], OUTLINE[0]);
  g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = OUTLINE[i], m = mid(p, OUTLINE[(i + 1) % n]);
    g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  g.closePath();
}

// scales the logo to `h` canvas pixels tall, centred horizontally in a canvas `w` wide (and vertically in `fullH`);
// sx stretches it sideways, to undo a squeeze applied to whatever it's drawn on
export function fit(g, w, h, fullH = h, sx = 1) {
  const k = h / LOGO_H;
  g.translate((w - LOGO_W * k * sx) / 2, (fullH - LOGO_H * k) / 2);
  g.scale(k * sx, k);
}

// the drawing: a band just inside the edge, the eyes, ear, tuft, the tongue running down the drip, and the bulb's face.
// lw is the line width in logo units; inset is the gap between the edge and the band
export function logoLines(g, { lw = 6, inset = 4, band = true } = {}) {
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = lw;
  if (band) {
    // a stroke of the outline twice as wide as gap + line, clipped to the inside, with the gap cut back out
    g.save(); logoPath(g); g.clip();
    const fill = g.strokeStyle;
    g.lineWidth = 2 * (inset + lw); logoPath(g); g.stroke();
    g.globalCompositeOperation = 'destination-out'; g.strokeStyle = '#000';
    g.lineWidth = 2 * inset; logoPath(g); g.stroke();
    g.restore(); g.strokeStyle = fill; g.lineWidth = lw;
  }
  const path = draw => { g.beginPath(); draw(); g.stroke(); };
  // eyes: the left one lower and bigger, the right one higher, each with a curled pupil
  path(() => g.ellipse(134, 172, 33, 41, -0.25, 0, Math.PI * 2));
  path(() => { g.moveTo(138, 170); g.quadraticCurveTo(117, 185, 128, 204); });
  path(() => { g.moveTo(151, 190); g.quadraticCurveTo(139, 191, 146, 203); });
  path(() => g.ellipse(189, 126, 27, 33, 0.25, 0.9, Math.PI * 2 + 0.3));
  path(() => { g.moveTo(171, 120); g.quadraticCurveTo(197, 104, 185, 148); });
  path(() => { g.moveTo(180, 136); g.quadraticCurveTo(188, 139, 183, 152); });
  // the little ear on the left and the tuft on top
  path(() => { g.moveTo(66, 142); g.bezierCurveTo(54, 118, 84, 98, 98, 114); g.bezierCurveTo(104, 124, 86, 128, 82, 138); g.bezierCurveTo(78, 150, 70, 150, 66, 142); });
  path(() => { g.moveTo(128, 82); g.bezierCurveTo(140, 62, 168, 60, 170, 74); g.bezierCurveTo(160, 88, 140, 86, 128, 82); });
  // the cheek line on the left
  path(() => { g.moveTo(131, 246); g.quadraticCurveTo(142, 268, 136, 290); });
  // the tongue: from under the right eye, curling down the drip
  path(() => { g.moveTo(246, 178); g.bezierCurveTo(214, 204, 190, 226, 196, 256); g.bezierCurveTo(201, 290, 222, 320, 230, 380); g.bezierCurveTo(235, 430, 232, 470, 236, 502); });
  path(() => { g.moveTo(258, 196); g.bezierCurveTo(240, 230, 221, 262, 232, 300); g.bezierCurveTo(243, 338, 252, 372, 254, 412); });
  path(() => { g.moveTo(212, 296); g.quadraticCurveTo(202, 300, 196, 312); });   // a little branch off it
  // the bulb's face: two eyes, a brow and a flick
  g.fillStyle = g.strokeStyle;
  [[252, 520], [267, 520]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, lw * 0.6, 0, Math.PI * 2); g.fill(); });
  path(() => { g.moveTo(256, 506); g.quadraticCurveTo(263, 499, 270, 509); });
  path(() => { g.moveTo(278, 530); g.quadraticCurveTo(282, 540, 272, 550); });
  g.restore();
}
