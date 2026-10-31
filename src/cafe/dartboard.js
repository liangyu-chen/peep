// The dartboard on the purple wall: how it's drawn (a standard board, 20 at the top) and what a dart scores where it lands.
// Radii are fractions of the whole board, the outer black ring with the numbers included.
import { DOT } from './util.js';

const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const R = { bull: 0.045, outerBull: 0.1, tripleIn: 0.42, tripleOut: 0.47, doubleIn: 0.71, doubleOut: 0.76 };

// x right, y down, both as fractions of the board's radius from its middle
export function dartScore(x, y) {
  const r = Math.hypot(x, y);
  if (r > R.doubleOut) return { pts: 0, label: 'MISS' };
  if (r < R.bull) return { pts: 50, label: 'BULL 50' };
  if (r < R.outerBull) return { pts: 25, label: '25' };
  const a = (Math.atan2(x, -y) + Math.PI * 2 + Math.PI / 20) % (Math.PI * 2);   // from the top, clockwise
  const n = ORDER[Math.floor(a / (Math.PI / 10)) % 20];
  if (r > R.tripleIn && r < R.tripleOut) return { pts: n * 3, label: `TRIPLE ${n * 3}` };
  if (r > R.doubleIn) return { pts: n * 2, label: `DOUBLE ${n * 2}` };
  return { pts: n, label: String(n) };
}

export function drawBoard(g, cx, cy, size) {
  g.fillStyle = '#161616'; g.beginPath(); g.arc(cx, cy, size, 0, Math.PI * 2); g.fill();
  const wedge = (i, r, c) => { const a = (i * 18 - 9 - 90) * Math.PI / 180; g.fillStyle = c; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r * size, a, a + Math.PI / 10); g.closePath(); g.fill(); };
  for (let i = 0; i < 20; i++) {
    const single = i % 2 ? '#efe4c8' : '#1f1f1f', ring = i % 2 ? '#2e8b57' : '#c0282d';
    wedge(i, R.doubleOut, ring); wedge(i, R.doubleIn, single); wedge(i, R.tripleOut, ring); wedge(i, R.tripleIn, single);
  }
  g.fillStyle = '#2e8b57'; g.beginPath(); g.arc(cx, cy, R.outerBull * size, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c0282d'; g.beginPath(); g.arc(cx, cy, R.bull * size, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(210,210,210,.55)'; g.lineWidth = Math.max(1, size / 120);   // the wire
  [R.doubleOut, R.doubleIn, R.tripleOut, R.tripleIn, R.outerBull].forEach(r => { g.beginPath(); g.arc(cx, cy, r * size, 0, Math.PI * 2); g.stroke(); });
  g.font = `${Math.round(size * 0.13)}px ${DOT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f4efe3';
  ORDER.forEach((n, i) => { const a = (i * 18 - 90) * Math.PI / 180; g.fillText(String(n), cx + Math.cos(a) * size * 0.88, cy + Math.sin(a) * size * 0.88); });
  g.textBaseline = 'alphabetic';
}
