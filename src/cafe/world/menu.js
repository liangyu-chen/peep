// The menu on the bar: a lightly burnt paper sheet under a bulldog clip on a dark hardboard clipboard,
// laid out like the real one: sections, Chinese and English names, Hot and Ice columns.
import * as THREE from 'three';
import { ctx, mat, box, cyl, canvasTex } from '../engine.js';
import { S } from '../state.js';
import { MENU_SECTIONS, MENU_FOOTER } from '../../content/catalog';
import { logoPath, logoLines } from './logo.js';

const W = 640, H = 1000;            // the sheet, in canvas units (drawn at 1.2x for sharpness)
const ZH = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const EN = '"Noto Sans TC","Arial Narrow",Arial,sans-serif';

// the same burnt edge every time the sheet is redrawn
function seeded(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the paper's outline: a sheet with ragged, slightly burnt-in edges and a few bigger bites out of the sides
function outline(rnd) {
  const pts = [], m = 22, step = 13;
  const bites = Array.from({ length: 4 }, () => ({ side: Math.floor(rnd() * 4), at: 0.15 + rnd() * 0.7, depth: 18 + rnd() * 26, width: 0.06 + rnd() * 0.06 }));
  const edge = (side, t) => {
    let d = rnd() * 9 + (rnd() < 0.15 ? rnd() * 10 : 0);
    for (const b of bites) if (b.side === side) d += b.depth * Math.max(0, 1 - Math.abs(t - b.at) / b.width);
    return d;
  };
  for (let x = m; x < W - m; x += step) pts.push([x, m + edge(0, x / W)]);
  for (let y = m; y < H - m; y += step) pts.push([W - m - edge(1, y / H), y]);
  for (let x = W - m; x > m; x -= step) pts.push([x, H - m - edge(2, x / W)]);
  for (let y = H - m; y > m; y -= step) pts.push([m + edge(3, y / H), y]);
  return pts;
}
const trace = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };

function doodles(g) {
  g.save(); g.strokeStyle = 'rgba(40,40,40,.75)'; g.lineWidth = 2.4; g.lineCap = 'round';
  // the tag scrawled across the top
  g.beginPath(); g.moveTo(250, 62); g.bezierCurveTo(262, 30, 290, 36, 286, 64); g.bezierCurveTo(300, 30, 330, 34, 326, 66);
  g.bezierCurveTo(344, 34, 372, 40, 362, 70); g.bezierCurveTo(390, 46, 420, 52, 404, 78); g.moveTo(258, 80); g.quadraticCurveTo(330, 96, 410, 74); g.stroke();
  g.beginPath(); g.moveTo(268, 92); g.lineTo(256, 112); g.lineTo(276, 104); g.stroke();
  g.restore();
  // the shop's melting face, faint, behind the Coffee late prices (the same drawing as the window)
  g.save(); g.translate(292, 196); g.scale(0.74, 0.74); g.strokeStyle = 'rgba(35,35,35,.55)';
  logoLines(g, { lw: 4.5, band: false }); logoPath(g); g.lineWidth = 4.5; g.stroke();
  g.restore();
}

function drawSheet(g) {
  g.setTransform(1.2, 0, 0, 1.2, 0, 0);
  const rnd = seeded(20240918), pts = outline(rnd);
  // paper
  trace(g, pts); g.fillStyle = '#f5f1e8'; g.fill();
  g.save(); trace(g, pts); g.clip();
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,100,70,${(rnd() * 0.05).toFixed(3)})`; g.fillRect(rnd() * W, rnd() * H, 2, 2); }   // paper grain
  // a few scorch marks, mostly near the edges
  for (let i = 0; i < 7; i++) {
    const nearX = rnd() < 0.5, x = nearX ? (rnd() < 0.5 ? 40 : W - 40) + (rnd() - 0.5) * 60 : 60 + rnd() * (W - 120);
    const y = nearX ? 60 + rnd() * (H - 120) : (rnd() < 0.5 ? 50 : H - 50) + (rnd() - 0.5) * 50, r = 26 + rnd() * 34;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(150,92,40,.38)'); grd.addColorStop(0.6, 'rgba(170,115,60,.18)'); grd.addColorStop(1, 'rgba(170,115,60,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // browned rim just inside the burnt edge
  g.shadowColor = 'rgba(120,70,25,.6)'; g.shadowBlur = 14;
  trace(g, pts); g.lineWidth = 16; g.strokeStyle = 'rgba(150,95,45,.32)'; g.stroke();
  g.shadowBlur = 0; g.lineWidth = 5; g.strokeStyle = 'rgba(95,52,20,.55)'; g.stroke();
  g.restore();
  trace(g, pts); g.lineWidth = 2; g.strokeStyle = 'rgba(35,18,8,.9)'; g.stroke();   // the charred edge itself

  doodles(g);

  // the menu, section by section
  const menu = S.content.menu;
  const sections = [...MENU_SECTIONS, ...new Set(menu.map(m => m.section).filter(s => !MENU_SECTIONS.includes(s)))]
    .map(name => ({ name, items: menu.filter(m => m.section === name) })).filter(s => s.items.length);
  const TOP = 150, BOTTOM = H - 140;                         // leave room for the small print
  const rowH = Math.min(38, (BOTTOM - TOP) / Math.max(1, menu.length + sections.length * 1.7));
  const fs = Math.min(23, rowH * 0.7), HOT = 470, ICE = 552, X = 58;
  let y = TOP;
  g.fillStyle = '#161616'; g.textBaseline = 'alphabetic';
  for (const sec of sections) {
    g.font = `700 ${fs + 4}px ${EN}`; g.textAlign = 'left';
    g.save(); g.translate(X, y); g.scale(0.9, 1); g.fillText(sec.name, 0, 0); g.restore();
    g.textAlign = 'center'; g.font = `700 ${fs}px ${EN}`; g.fillText('Hot.', HOT, y); g.fillText('Ice.', ICE, y);
    y += rowH * 1.15;
    for (const m of sec.items) {
      g.textAlign = 'left'; g.font = `500 ${fs * 0.8}px ${ZH}`; g.fillStyle = '#262626';
      g.fillText(m.name, X, y);
      const zhW = g.measureText(m.name).width;
      g.font = `700 ${fs}px ${EN}`; g.fillStyle = '#141414';
      g.save(); g.translate(X + Math.max(zhW + 12, 64), y); g.scale(0.88, 1); g.fillText(m.en, 0, 0); g.restore();
      g.textAlign = 'center'; g.font = `700 ${fs * 0.95}px ${EN}`;
      if (m.hot) g.fillText(m.hot, HOT, y);
      if (m.ice) g.fillText(m.ice, ICE, y);
      y += rowH;
    }
    y += rowH * 0.55;
  }
  // small print at the bottom
  g.font = `500 14px ${ZH}`; g.fillStyle = '#333'; g.textAlign = 'center';
  MENU_FOOTER.forEach((t, i) => g.fillText(t, W / 2 + 30, H - 118 + i * 19));
}

export function buildMenuClipboard() {
  const tex = canvasTex(Math.round(W * 1.2), Math.round(H * 1.2), drawSheet);
  tex.anisotropy = 8;
  S.fontTex.push(tex);
  const clip = new THREE.Group(); clip.position.set(0.6, 1.065, 2.3); clip.rotation.y = -Math.PI / 2 + 0.12; ctx.scene.add(clip);   // lying flat at the outer end, beside the machine
  // dark hardboard with a worn, slightly mottled face
  const boardTex = canvasTex(128, 192, (g, w, h) => {
    g.fillStyle = '#4a3428'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '20,12,8' : '120,90,70'},${(Math.random() * 0.18).toFixed(2)})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
  });
  const boardM = [mat(0x6b4e3c, { roughness: 0.9 }), mat(0x6b4e3c, { roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.85 }), mat(0x3a2a20), mat(0x6b4e3c), mat(0x6b4e3c)];
  box(0.235, 0.006, 0.355, boardM, 0, 0.003, 0, clip);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.3125), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, transparent: true, alphaTest: 0.5 }));
  sheet.rotation.x = -Math.PI / 2; sheet.position.set(0, 0.0065, 0.014); sheet.receiveShadow = true; clip.add(sheet);
  // the bulldog clip across the top: a plate, the rounded jaw, two rivets and the wire lever
  const metal = mat(0xa39886, { metalness: 0.75, roughness: 0.42 });
  box(0.088, 0.003, 0.04, metal, 0, 0.0075, -0.148, clip);
  const jaw = cyl(0.016, 0.016, 0.09, metal, 0, 0.008, -0.15, clip, 16); jaw.rotation.z = Math.PI / 2; jaw.scale.set(1, 1, 0.75);
  [-0.028, 0.028].forEach(x => cyl(0.004, 0.004, 0.004, mat(0x6f6658, { metalness: 0.8, roughness: 0.4 }), x, 0.02, -0.158, clip, 8));
  const lever = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0028, 6, 20, Math.PI), metal);
  lever.position.set(0, 0.022, -0.168); lever.rotation.set(-Math.PI / 2 + 0.5, 0, 0); clip.add(lever);
}
