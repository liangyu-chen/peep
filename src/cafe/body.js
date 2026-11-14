// A person's 3D body: stylised but detailed, with a face built from the look's face options.
// Shared by the café and the back office's 捏臉 preview, so it depends only on three.js and the catalog.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, canvasTex } from './engine.js';
import { PIX } from './util.js';
import { CLEAR_LENS, faceOf, frameColorOf, hairOf, hatOf, clothesOf, shoeOf, socksOf, tattooOf, earringsOf, earColorOf, headphonesOf, watchOf, buildOf, bodyOf, heightOf, lensOf, tieColorOf, coatInnerOf } from '../content/catalog';
// how much taller or shorter than standard each height is (身高)
const HEIGHT_K = { xshort: 0.88, short: 0.94, regular: 1, tall: 1.06, xtall: 1.12 };
// 身形: how much wider (w) and deeper (d) the body is than the standard
const BUILDS = { thin: { w: 0.8, d: 0.82 }, slim: { w: 0.9, d: 0.91 }, regular: { w: 1, d: 1 }, stocky: { w: 1.13, d: 1.1 }, heavy: { w: 1.28, d: 1.42 } };

// how much longer the legs are than first drawn: the hips sit this much higher (people.js lowers sitting and squatting to match)
export const LEG_EXTRA = 0.08;
// how the arms hang at rest, a little out from the body (z: radians out from the sides, the left arm's negated) with the
// elbows just bent
export const ARM_REST = { z: 0.11, el: -0.14 };
// standing at rest, as joint angles: legs straight, arms hanging a little out and swaying a touch, elbows just bent, the
// head turning now and then; `phase` runs on with time. The one place this is set: the café's people start every pose
// from it (walking, sitting, holding a cup change what they need), and the back office's preview stands in it as it is
export const restPose = phase => ({
  hipL: 0, hipR: 0, kL: 0, kR: 0,
  armLx: Math.sin(phase * 0.7) * 0.04, armRx: -Math.sin(phase * 0.7) * 0.04, armLy: 0, armRy: 0, armLz: -ARM_REST.z, armRz: ARM_REST.z,
  elL: ARM_REST.el, elR: ARM_REST.el, head: Math.sin(phase * 0.31) * 0.2,
});
// put a body (anything with buildBody's legs, arms and elbows) into a pose
export function poseBody(b, p) {
  const [L, R] = b.legs, [aL, aR] = b.arms;
  L.hip.rotation.x = p.hipL; R.hip.rotation.x = p.hipR; L.knee.rotation.x = p.kL; R.knee.rotation.x = p.kR;
  aL.rotation.set(p.armLx, p.armLy, p.armLz); aR.rotation.set(p.armRx, p.armRy, p.armRz);
  b.elbows[0].rotation.x = p.elL; b.elbows[1].rotation.x = p.elR;
}

// ---------------------------------------------------------------- shared geometry and materials
// geometries are shared between everyone; materials stay per person since their colours differ
// (DETAIL scales the round things' segment counts: the people walking about the café are built coarser than the
// back office's close-up preview and the portraits, which they're seen far too small to miss; see buildBody)
let DETAIL = 1;
const D = (n, min = 4) => Math.max(min, Math.round(n * DETAIL));
const GEO = new Map();
const geo = (key, make) => { key = `${DETAIL}|${key}`; let g = GEO.get(key); if (!g) { g = make(); GEO.set(key, g); } return g; };
const bx = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const sp = (r, ws = 12, hs = 10, ...part) => geo(`s${r},${ws},${hs},${part}`, () => new THREE.SphereGeometry(r, D(ws, 6), D(hs, 4), ...part));
const cy = (rt, rb, h, seg = 12, ...rest) => geo(`c${rt},${rb},${h},${seg},${rest}`, () => new THREE.CylinderGeometry(rt, rb, h, D(seg, 6), 1, ...rest));
const prism = (r, h, sides) => geo(`p${r},${h},${sides}`, () => new THREE.CylinderGeometry(r, r, h, sides, 1));
const disc = r => cy(r, r, 0.006, 18);
const lathe = (key, pts, seg = 24, ...arc) => geo(`l${key}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), D(seg, 8), ...arc));

const darkM = mat(0x161210, { roughness: 0.4 });
const whiteM = mat(0xfbfaf5, { roughness: 0.35 });
const shineM = new THREE.MeshBasicMaterial({ color: 0xffffff });
const tongueM = mat(0xd9646e, { roughness: 0.5 });
const lipM = mat(0xc25f68, { roughness: 0.45 });
const bracesM = mat(0xd8dce2, { roughness: 0.18, metalness: 0.95 });                // braces: wire and brackets
const BAND_COLORS = [0x4fa3ff, 0xff5fa2, 0x7be07b, 0xffc93c, 0xb57bff, 0x3fd6d0];    // the little rubber bands on coloured braces
const bandMs = BAND_COLORS.map(c => mat(c, { roughness: 0.4, emissive: c, emissiveIntensity: 0.35 }));   // a little glow so the tiny bands still read as coloured
const blushM = mat(0xff8f9c, { roughness: 1, transparent: true, opacity: 0.45, depthWrite: false });
// thin wire frames, gold or silver
const WIRE = { metal: mat(0xd2ae62, { roughness: 0.28, metalness: 0.85 }), metalSilver: mat(0xc9ccd1, { roughness: 0.25, metalness: 0.9 }) };
const goldM = mat(0xd9ad52, { roughness: 0.25, metalness: 0.9 });                   // and the gold lines across it
const silverM = mat(0xd4d7dc, { roughness: 0.22, metalness: 0.9 });                 // silver earrings
// 健誌嘴巴: a burst of light right where the mouth is, as if the camera caught a flash: a white-hot middle, a warm
// glow fading out round it and a few thin rays
let flareM = null;
const flashM = () => flareM || (flareM = new THREE.MeshBasicMaterial({
  map: canvasTex(128, 128, (g, w, h) => {
    const c = w / 2;
    const glow = g.createRadialGradient(c, c, 0, c, c, c);
    glow.addColorStop(0, 'rgba(255,255,255,1)'); glow.addColorStop(0.18, 'rgba(255,252,236,1)'); glow.addColorStop(0.4, 'rgba(255,236,170,0.55)'); glow.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = glow; g.fillRect(0, 0, w, h);
    g.translate(c, c);
    [[0, 1], [Math.PI / 2, 0.8], [Math.PI / 4, 0.55], [-Math.PI / 4, 0.55]].forEach(([a, len]) => {
      g.save(); g.rotate(a);
      const ray = g.createLinearGradient(-c * len, 0, c * len, 0);
      ray.addColorStop(0, 'rgba(255,245,210,0)'); ray.addColorStop(0.5, 'rgba(255,255,255,0.95)'); ray.addColorStop(1, 'rgba(255,245,210,0)');
      g.fillStyle = ray; g.fillRect(-c * len, -1.5, 2 * c * len, 3);
      g.restore();
    });
  }),
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
}));
const lensM = mat(0xdff2ff, { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.12, depthWrite: false });
const beltM = mat(0x2a2420, { roughness: 0.6 });
const hideM = new THREE.MeshBasicMaterial({ visible: false });   // a part of a shared surface another mesh draws
const buckleM = mat(0xc9b26a, { roughness: 0.3, metalness: 0.8 });
const soleM = mat(0x2b2724, { roughness: 0.9 });   // dark rubber, so it never reads as a white patch under the foot

// fine streaks multiplied over the hair colour, so hair reads as strands rather than plastic
let strandTex = null;
const strands = () => strandTex || (strandTex = (() => {
  // strands with some depth: clumps a shade darker in their gaps, a few catching the light, darker toward the roots
  const t = canvasTex(64, 32, g => {
    g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 64, 32);
    for (let x = 0; x < 64; x++) {
      const clump = 0.5 + 0.5 * Math.sin(x / 64 * Math.PI * 2 * 7 + Math.sin(x * 0.7) * 0.8);
      g.fillStyle = clump > 0.8 && Math.random() < 0.6 ? `rgba(255,255,255,${(0.5 + Math.random() * 0.5).toFixed(2)})` : `rgba(0,0,0,${(0.04 + (1 - clump) * 0.28 + Math.random() * 0.1).toFixed(2)})`;
      g.fillRect(x, 0, 1, 32);
    }
    const root = g.createLinearGradient(0, 0, 0, 32); root.addColorStop(0, 'rgba(0,0,0,.18)'); root.addColorStop(0.4, 'rgba(0,0,0,0)');
    g.fillStyle = root; g.fillRect(0, 0, 64, 32);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 1); return t;
})());

// tattoos, American traditional in black and grey: one big classic piece per part, bold dark outlines and flat fills in
// a few greys, multiplied over the skin, so they read as healed ink. The texture wraps once round
// the limb: its middle column at u = 0 / 1 faces front (a cylinder's or lathe's front is where its u wraps), so each
// piece is drawn centred on x = 0 and again at x = W; its height runs the length of the forearm, upper arm or calf (top
// toward the elbow / shoulder / knee), the bottom strip (wrist / ankle) left bare.
//   rose     玫瑰: a red rose, green leaves either side
//   swallow  燕子: a swallow in flight, blue back, red breast
//   dagger   匕首穿心: a red heart run through by a dagger, a banner across
//   skull    骷髏: a skull over a pair of red roses
//   anchor   船錨: an anchor wound with rope, a banner across
//   eagle    老鷹: an eagle, wings spread
//   flash    小圖混搭: a sheet of little flash (star, heart, swallow, anchor) with skin between
//   text     文字: the look's own words (tattooText) in bold lettering down the limb
// Two variants of each (mirrored, other banner words), so a pair of arms aren't alike.
// a top's printed pattern (上衣圖樣), drawn in the shader so it runs over the torso, sleeves and collar alike (none of
// them need UVs): each mesh's own position in metres (its scale taken in), round its upright axis measured as arc
// length, mirrored front to back so the only joins fall down the side seams, as a real shirt's do. The pattern's
// colours come from the shirt's own: on a light shirt, darker shades of it; on a darker one, a pale tint
//   stripe 橫條紋 · plaid 格紋 · dots 圓點 · camo 迷彩 · floral 花襯衫 (hibiscus-ish flowers and leaves)
const PATTERN_GLSL = `
varying vec3 vPat;
uniform vec3 uPatB; uniform vec3 uPatC;
float patH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float patN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(patH(i), patH(i + vec2(1, 0)), f.x), mix(patH(i + vec2(0, 1)), patH(i + vec2(1, 1)), f.x), f.y); }
`;
const PATTERN_BODY = {
  stripe: `float m = step(0.5, fract(q.y / 0.05)); col = mix(col, uPatB, m);`,
  plaid: `float A = step(0.56, fract(q.y / 0.085)), Bb = step(0.56, fract(q.x / 0.085));
    col = mix(col, uPatB, 0.5 * (A + Bb));
    float ln = max(step(0.94, fract(q.y / 0.085 + 0.22)), step(0.94, fract(q.x / 0.085 + 0.22)));
    col = mix(col, uPatC, ln * 0.8);`,
  dots: `vec2 g = q / 0.045; g.x += 0.5 * mod(floor(g.y), 2.0); float d = length(fract(g) - 0.5) * 0.045;
    col = mix(col, uPatB, 1.0 - smoothstep(0.0095, 0.011, d));`,
  camo: `vec2 c = q * vec2(1.0, 0.8); float n = patN(c * 11.0) * 0.65 + patN(c * 27.0 + 7.3) * 0.35, k = patN(c * 15.0 + 31.7);
    col = n < 0.43 ? uPatC : n > 0.6 ? uPatB : col; if (k > 0.74) col = col * 0.0 + vec3(0.11, 0.1, 0.09);`,
  floral: `vec2 g = q / 0.11, id = floor(g); vec2 f = (fract(g) - 0.5 - (vec2(patH(id), patH(id + 3.1)) - 0.5) * 0.35) * 0.11;
    float r = length(f), a = atan(f.y, f.x) + patH(id + 7.7) * 6.2832;
    vec2 g2 = g + 0.5, id2 = floor(g2); vec2 f2 = (fract(g2) - 0.5) * 0.11; float a2 = patH(id2) * 3.1416;
    f2 = mat2(cos(a2), -sin(a2), sin(a2), cos(a2)) * f2;
    if (length(f2 * vec2(1.0, 2.6)) < 0.02) col = vec3(0.16, 0.36, 0.2);
    if (r < 0.03 * (0.55 + 0.45 * abs(cos(2.5 * a)))) col = uPatB;
    if (r < 0.0065) col = vec3(0.96, 0.78, 0.25);`,
  // 牛仔布: a fine diagonal twill (faded out with distance, so it never shimmers), uneven slubbed threads running up and
  // down, and the cloth worn paler in soft patches
  denim: `float tw = fract((q.x + q.y) / 0.0042), aa = 1.0 - clamp(fwidth(q.x + q.y) / 0.0042 - 0.4, 0.0, 1.0);
    col *= 1.0 + 0.09 * aa * (smoothstep(0.15, 0.5, tw) * smoothstep(0.85, 0.5, tw) - 0.5);
    col *= 0.92 + 0.16 * patN(vec2(q.x * 220.0, q.y * 14.0));
    col = mix(col, col * 1.3 + vec3(0.025, 0.03, 0.04), 0.45 * smoothstep(0.45, 0.85, patN(q * 7.0 + 3.1)));`,
};
const PATTERNS = Object.keys(PATTERN_BODY).filter(k => k !== 'denim');

// a printed graphic on the chest (印花), as graphic tees have: one picture, the rest of the top plain. Drawn on a
// transparent canvas, in an ink that reads on the shirt (dark on a light one, cream on a dark one) plus a few fixed
// colours of its own:
//   p_coffee 咖啡杯 · p_cat 貓咪 · p_sunset 夕陽 · p_mountain 山景 · p_smile 笑臉 · p_wave 浪花 · p_logo 字樣
const PRINT_TEX = {};
function printTex(kind, light) {
  const key = `${kind}:${light}`;
  if (PRINT_TEX[key]) return PRINT_TEX[key];
  const ink = light ? '#2a2623' : '#f3eee4';
  const t = canvasTex(256, 256, (g, W, H) => {
    g.clearRect(0, 0, W, H); g.lineCap = 'round'; g.lineJoin = 'round';
    const cx = W / 2;
    const text = (s, y, size, color = ink, font = 'bold') => { g.fillStyle = color; g.font = `${font} ${size}px "Arial Black", Arial, sans-serif`; g.textAlign = 'center'; g.fillText(s, cx, y); };
    if (kind === 'p_coffee') {
      g.strokeStyle = ink; g.lineWidth = 9;
      for (const dx of [-26, 0, 26]) { g.beginPath(); g.moveTo(cx + dx, 92); g.bezierCurveTo(cx + dx - 14, 74, cx + dx + 14, 62, cx + dx, 40); g.stroke(); }   // steam
      g.fillStyle = '#c8703c'; g.beginPath(); g.moveTo(cx - 62, 104); g.lineTo(cx + 62, 104); g.lineTo(cx + 48, 190); g.quadraticCurveTo(cx, 202, cx - 48, 190); g.closePath(); g.fill();
      g.lineWidth = 8; g.stroke();
      g.beginPath(); g.ellipse(cx + 70, 140, 20, 26, 0, -Math.PI / 2, Math.PI / 2); g.stroke();   // handle
      g.fillStyle = '#f3eee4'; g.beginPath(); g.ellipse(cx, 104, 62, 10, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      text('PEEP', 240, 40);
    } else if (kind === 'p_cat') {
      g.fillStyle = ink; g.beginPath();
      g.moveTo(cx - 80, 200); g.quadraticCurveTo(cx - 92, 120, cx - 70, 92); g.lineTo(cx - 78, 30); g.lineTo(cx - 30, 70);
      g.quadraticCurveTo(cx, 62, cx + 30, 70); g.lineTo(cx + 78, 30); g.lineTo(cx + 70, 92); g.quadraticCurveTo(cx + 92, 120, cx + 80, 200);
      g.quadraticCurveTo(cx, 226, cx - 80, 200); g.fill();
      const bg = light ? '#f3eee4' : '#2a2623';
      g.fillStyle = '#e8b93c'; for (const dx of [-34, 34]) { g.beginPath(); g.ellipse(cx + dx, 132, 16, 20, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#1a1a1a'; for (const dx of [-34, 34]) { g.beginPath(); g.ellipse(cx + dx, 132, 5, 16, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#e88a9a'; g.beginPath(); g.moveTo(cx - 9, 160); g.lineTo(cx + 9, 160); g.lineTo(cx, 170); g.closePath(); g.fill();
      g.strokeStyle = bg; g.lineWidth = 3;
      for (const s of [-1, 1]) for (const dy of [-6, 6]) { g.beginPath(); g.moveTo(cx + s * 22, 172 + dy * 0.3); g.lineTo(cx + s * 78, 166 + dy); g.stroke(); }
    } else if (kind === 'p_sunset') {
      const grad = g.createLinearGradient(0, 40, 0, 200); grad.addColorStop(0, '#f6c445'); grad.addColorStop(0.55, '#f07a3a'); grad.addColorStop(1, '#d9406a');
      g.save(); g.beginPath(); g.arc(cx, 128, 92, 0, Math.PI * 2); g.clip();
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 6; i++) { const y = 140 + i * 15, h = 3 + i * 1.6; g.fillRect(0, y, W, h); }   // the retro stripes cut through its lower half
      g.restore();
      g.strokeStyle = ink; g.lineWidth = 6;
      for (let i = 0; i < 3; i++) { g.beginPath(); for (let x = 30; x <= 226; x += 4) { const y = 214 + i * 13 + Math.sin(x / 14 + i) * 4; x === 30 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
    } else if (kind === 'p_mountain') {
      g.strokeStyle = ink; g.lineWidth = 8; g.beginPath(); g.arc(cx, 128, 104, 0, Math.PI * 2); g.stroke();
      g.save(); g.beginPath(); g.arc(cx, 128, 98, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#f3e7b8'; g.beginPath(); g.arc(cx + 46, 76, 18, 0, Math.PI * 2); g.fill();   // moon
      g.fillStyle = '#4f7a6a'; g.beginPath(); g.moveTo(10, 210); g.lineTo(80, 110); g.lineTo(120, 160); g.lineTo(160, 96); g.lineTo(250, 210); g.closePath(); g.fill();
      g.fillStyle = '#f3eee4'; g.beginPath(); g.moveTo(160, 96); g.lineTo(144, 120); g.lineTo(156, 116); g.lineTo(166, 124); g.lineTo(176, 118); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(80, 110); g.lineTo(68, 128); g.lineTo(80, 124); g.lineTo(92, 128); g.closePath(); g.fill();
      g.fillStyle = '#2f5246'; g.fillRect(0, 200, W, 60);
      g.restore();
    } else if (kind === 'p_smile') {
      g.fillStyle = '#f5c826'; g.beginPath(); g.arc(cx, 128, 96, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2a2623'; g.lineWidth = 8; g.stroke();
      g.fillStyle = '#2a2623'; for (const dx of [-32, 32]) { g.beginPath(); g.ellipse(cx + dx, 104, 10, 18, 0, 0, Math.PI * 2); g.fill(); }
      g.lineWidth = 10; g.beginPath(); g.arc(cx, 128, 56, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    } else if (kind === 'p_wave') {
      const blue = '#2d5d8f', foam = '#f3eee4';
      for (let row = 0; row < 3; row++) {
        const y0 = 90 + row * 46;
        for (let k = -1; k < 4; k++) {
          const x0 = 20 + k * 72 + (row % 2) * 36;
          g.fillStyle = row === 2 ? blue : row === 1 ? '#3f78ad' : '#5b93c4';
          g.beginPath(); g.moveTo(x0, y0 + 40); g.bezierCurveTo(x0, y0 - 10, x0 + 70, y0 - 20, x0 + 72, y0 + 12); g.bezierCurveTo(x0 + 50, y0, x0 + 40, y0 + 20, x0 + 60, y0 + 40); g.closePath(); g.fill();
          g.strokeStyle = foam; g.lineWidth = 4; g.beginPath(); g.moveTo(x0 + 12, y0 + 30); g.bezierCurveTo(x0 + 14, y0 + 4, x0 + 54, y0 - 6, x0 + 66, y0 + 10); g.stroke();
        }
      }
      g.globalCompositeOperation = 'destination-in'; g.beginPath(); g.arc(cx, 128, 100, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over';
      g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.arc(cx, 128, 100, 0, Math.PI * 2); g.stroke();
    } else if (kind === 'p_logo') {
      g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.arc(cx, 128, 104, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.arc(cx, 128, 92, 0, Math.PI * 2); g.stroke();
      text('PEEP', 128, 54); text('COFFEE', 172, 34);
      g.fillStyle = '#c8703c'; for (const dx of [-60, 60]) { g.beginPath(); g.arc(cx + dx, 160, 6, 0, Math.PI * 2); g.fill(); }
      text('★  ★  ★', 205, 16, ink, '');
    }
  });
  return (PRINT_TEX[key] = t);
}
const PRINTS = ['p_coffee', 'p_cat', 'p_sunset', 'p_mountain', 'p_smile', 'p_wave', 'p_logo'];
function patterned(m, kind, base) {
  if (!PATTERN_BODY[kind]) return m;
  const c = new THREE.Color(base), hsl = c.getHSL({}), light = hsl.l > 0.62;
  const B = kind === 'floral' ? new THREE.Color().setHSL((hsl.h + 0.5) % 1, 0.65, light ? 0.45 : 0.82)
    : kind === 'camo' ? c.clone().lerp(new THREE.Color(0xc8b98a), 0.5)   // khaki-ish, not white
    : light ? c.clone().multiplyScalar(kind === 'camo' ? 0.78 : 0.5) : c.clone().lerp(new THREE.Color(0xffffff), 0.72);
  const C = kind === 'camo' ? c.clone().multiplyScalar(0.55) : light ? c.clone().multiplyScalar(0.35) : c.clone().multiplyScalar(0.45);
  m.onBeforeCompile = sh => {
    sh.uniforms.uPatB = { value: B }; sh.uniforms.uPatC = { value: C };
    sh.vertexShader = 'varying vec3 vPat;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n vPat = position * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));');
    sh.fragmentShader = PATTERN_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { vec2 q = vec2(atan(vPat.x, abs(vPat.z)) * length(vPat.xz), vPat.y); vec3 col = diffuseColor.rgb;
        ${PATTERN_BODY[kind]}
        diffuseColor.rgb = col; }`);
  };
  m.customProgramCacheKey = () => `pat:${kind}`;
  return m;
}
const TAT = {};
// black and grey: the classic fills (red, yellow, green, blue, brown) as shades of grey, 'pale' left as bare skin
const TC = { line: '#3f434c', red: '#80858f', yellow: '#c4c8cf', green: '#a2a7b0', blue: '#737985', brown: '#8d929b', pale: '#ffffff', dark: '#5a5f69' };
// low: for an upper arm, the piece drawn smaller and further down (toward the elbow), out from under the sleeve
function tattooTex(style, v, low = false, text = '') {
  const key = `${style}:${v}:${low}:${text}`;
  if (TAT[key]) return TAT[key];
  const t = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    if (low) { g.translate(0, H * 0.34); g.scale(0.8, 0.8); }   // (scaled about x = 0, so still centred on the front; the copies' seam falls round the back)
    const bot = H * 0.86, CY = bot * 0.5;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const ink = (fill, lw = 5) => { if (fill) { g.fillStyle = fill; g.fill(); } g.lineWidth = lw; g.strokeStyle = TC.line; g.stroke(); };
    const at = (draw, cx = 0) => [cx - W, cx, cx + W].forEach(dx => { g.save(); g.translate(dx, 0); if (v % 2 && style !== 'text') g.scale(-1, 1); draw(); g.restore(); });   // centred on the front, wrapped; variant 1 mirrored (not words)
    const heart = (x, y, rr) => { g.beginPath(); g.moveTo(x, y + rr); g.bezierCurveTo(x - rr * 1.6, y - rr * 0.2, x - rr * 0.65, y - rr * 1.35, x, y - rr * 0.45); g.bezierCurveTo(x + rr * 0.65, y - rr * 1.35, x + rr * 1.6, y - rr * 0.2, x, y + rr); g.closePath(); };
    const star = (x, y, rr) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? rr * 0.45 : rr; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); };
    const leaf = (x, y, a, len) => {
      g.save(); g.translate(x, y); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -len * 0.38, len, 0); g.quadraticCurveTo(len * 0.5, len * 0.38, 0, 0); ink(TC.green, 4);
      g.beginPath(); g.moveTo(len * 0.1, 0); g.lineTo(len * 0.8, 0); g.lineWidth = 2.5; g.stroke();
      g.restore();
    };
    const rose = (x, y, rr) => {
      leaf(x - rr * 0.6, y + rr * 0.3, Math.PI * 0.85, rr * 1.25); leaf(x + rr * 0.6, y + rr * 0.3, Math.PI * 0.15, rr * 1.25);
      g.beginPath(); g.ellipse(x, y, rr, rr * 0.86, 0, 0, Math.PI * 2); ink(TC.red, 5);
      g.beginPath(); g.ellipse(x, y + rr * 0.32, rr * 0.82, rr * 0.38, 0, 0.1, Math.PI - 0.1); g.lineWidth = 4; g.stroke();   // the outer cupped petals
      g.beginPath(); g.ellipse(x, y - rr * 0.12, rr * 0.55, rr * 0.36, 0, Math.PI, Math.PI * 2); g.stroke();
      g.beginPath(); for (let a = 0; a < Math.PI * 3; a += 0.2) { const q = rr * 0.42 - a * rr * 0.04; g.lineTo(x + Math.cos(a) * q, y - rr * 0.05 + Math.sin(a) * q * 0.7); } g.stroke();   // the swirl in its heart
      g.beginPath(); g.ellipse(x - rr * 0.45, y - rr * 0.35, rr * 0.16, rr * 0.08, -0.6, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();   // a highlight
    };
    const banner = (x, y, w, word) => {
      const h = 26;
      [-1, 1].forEach(s => { g.beginPath(); g.moveTo(x + s * w / 2, y - h / 2 + 8); g.lineTo(x + s * (w / 2 + 22), y - h / 2 + 8); g.lineTo(x + s * (w / 2 + 12), y + 4); g.lineTo(x + s * (w / 2 + 22), y + h / 2 + 8); g.lineTo(x + s * w / 2, y + h / 2 + 8); g.closePath(); ink(TC.yellow, 4); });   // forked tails, behind
      g.beginPath(); g.moveTo(x - w / 2, y - h / 2); g.quadraticCurveTo(x, y - h / 2 - 8, x + w / 2, y - h / 2); g.lineTo(x + w / 2, y + h / 2); g.quadraticCurveTo(x, y + h / 2 - 8, x - w / 2, y + h / 2); g.closePath(); ink(TC.pale, 4);
      g.fillStyle = TC.line; g.font = '900 19px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(word, x, y - 2);
    };
    const swallow = (x, y, k) => {
      g.save(); g.translate(x, y); g.scale(k, k);
      [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * 6, -6); g.quadraticCurveTo(s * 40, -40, s * 92, -30); g.quadraticCurveTo(s * 70, -14, s * 58, -2); g.quadraticCurveTo(s * 44, 6, s * 10, 10); g.closePath(); ink(TC.blue, 5);
        g.beginPath(); g.moveTo(s * 30, -22); g.quadraticCurveTo(s * 52, -26, s * 74, -24); g.lineWidth = 3; g.stroke(); });   // wings, a feather line on each
      g.beginPath(); g.moveTo(-10, 20); g.lineTo(-22, 64); g.lineTo(-4, 40); g.lineTo(4, 40); g.lineTo(22, 64); g.lineTo(10, 20); g.closePath(); ink(TC.blue, 5);   // forked tail
      g.beginPath(); g.ellipse(0, 6, 14, 26, 0, 0, Math.PI * 2); ink(TC.blue, 5);
      g.beginPath(); g.ellipse(0, 14, 10, 16, 0, 0, Math.PI * 2); ink(TC.red, 3.5);   // red breast
      g.beginPath(); g.arc(0, -22, 12, 0, Math.PI * 2); ink(TC.blue, 5);
      g.beginPath(); g.moveTo(-5, -32); g.lineTo(0, -44); g.lineTo(5, -32); ink(TC.yellow, 3);
      g.beginPath(); g.arc(-4, -24, 2.5, 0, Math.PI * 2); g.fillStyle = TC.line; g.fill();
      g.restore();
    };
    const anchor = (x, y, k) => {
      g.save(); g.translate(x, y); g.scale(k, k);
      g.beginPath(); g.arc(0, -62, 11, 0, Math.PI * 2); g.lineWidth = 12; g.strokeStyle = TC.line; g.stroke(); g.lineWidth = 6; g.strokeStyle = TC.dark; g.stroke();
      g.beginPath(); g.rect(-6, -52, 12, 104); ink(TC.dark, 4);
      g.beginPath(); g.rect(-36, -40, 72, 11); ink(TC.dark, 4);
      g.beginPath(); g.arc(0, 8, 46, Math.PI * 0.08, Math.PI * 0.92); g.lineWidth = 14; g.strokeStyle = TC.line; g.stroke(); g.lineWidth = 7; g.strokeStyle = TC.dark; g.stroke();
      [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * 48, 18); g.lineTo(s * 56, 0); g.lineTo(s * 34, 14); g.closePath(); ink(TC.dark, 4); });   // the flukes
      g.beginPath(); for (let a = 0; a <= 1; a += 0.02) { const yy = -40 + a * 84, xx = Math.sin(a * Math.PI * 3) * 20; a ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.lineWidth = 9; g.strokeStyle = TC.line; g.stroke(); g.lineWidth = 5; g.strokeStyle = TC.yellow; g.stroke();   // the rope wound round
      g.restore();
    };

    const words = { dagger: ['TRUE LOVE', 'MOM'], anchor: ['HOME', 'PEEP'] };
    if (style === 'swallow') {
      at(() => swallow(0, CY, 1));
      at(() => { star(0, CY - 78, 13); ink(TC.yellow, 4); }, W / 2);   // a star round the back
    } else if (style === 'dagger') {
      at(() => {
        g.beginPath(); g.moveTo(-8, CY - 30); g.lineTo(8, CY - 30); g.lineTo(0, CY + 86); g.closePath(); ink('#e9edf2', 5);   // the blade, out through the bottom
        g.beginPath(); g.moveTo(0, CY - 20); g.lineTo(0, CY + 70); g.lineWidth = 2.5; g.stroke();
        heart(0, CY + 4, 44); ink(TC.red, 6);
        g.beginPath(); g.ellipse(-18, CY - 14, 9, 5, -0.6, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
        g.beginPath(); g.rect(-30, CY - 52, 60, 12); ink(TC.yellow, 4);   // guard, grip and pommel above it
        g.beginPath(); g.rect(-7, CY - 82, 14, 30); ink(TC.brown, 4);
        g.beginPath(); g.arc(0, CY - 90, 9, 0, Math.PI * 2); ink(TC.yellow, 4);
      });
      at(() => banner(0, CY + 36, 96, words.dagger[v % 2]));
    } else if (style === 'skull') {
      at(() => {
        rose(-38, CY + 52, 26); rose(38, CY + 52, 26);
        g.beginPath(); g.moveTo(-46, CY - 10); g.bezierCurveTo(-50, CY - 76, 50, CY - 76, 46, CY - 10); g.quadraticCurveTo(44, CY + 14, 28, CY + 18); g.lineTo(26, CY + 40); g.lineTo(-26, CY + 40); g.lineTo(-28, CY + 18); g.quadraticCurveTo(-44, CY + 14, -46, CY - 10); g.closePath(); ink(TC.pale, 6);
        [-1, 1].forEach(s => { g.beginPath(); g.ellipse(s * 19, CY - 12, 14, 12, s * 0.2, 0, Math.PI * 2); g.fillStyle = TC.line; g.fill(); });   // sockets
        g.beginPath(); g.moveTo(0, CY + 2); g.lineTo(-7, CY + 14); g.lineTo(7, CY + 14); g.closePath(); g.fillStyle = TC.line; g.fill();   // nose
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 9, CY + 24); g.lineTo(i * 9, CY + 40); g.lineWidth = 3; g.stroke(); }   // teeth
        g.beginPath(); g.moveTo(-22, CY + 24); g.lineTo(22, CY + 24); g.stroke();
      });
    } else if (style === 'anchor') {
      at(() => anchor(0, CY - 6, 1.05));
      at(() => banner(0, CY + 10, 92, words.anchor[v % 2]));
    } else if (style === 'eagle') {
      at(() => {
        [-1, 1].forEach(s => {   // the wings, spread up and out, feathers layered
          for (let f = 0; f < 5; f++) {
            const bx = s * (18 + f * 18), by = CY - 20 - f * 9;
            g.beginPath(); g.moveTo(s * 14, CY - 6 + f * 2); g.quadraticCurveTo(bx, by - 30, bx + s * 14, by - 46 + f * 4); g.quadraticCurveTo(bx + s * 6, by + 6, s * 14, CY + 16);
            ink(f % 2 ? TC.brown : '#b88a5d', 4);
          }
        });
        g.beginPath(); g.moveTo(-12, CY + 44); g.lineTo(-20, CY + 78); g.lineTo(0, CY + 66); g.lineTo(20, CY + 78); g.lineTo(12, CY + 44); g.closePath(); ink(TC.pale, 4);   // tail
        g.beginPath(); g.ellipse(0, CY + 16, 20, 34, 0, 0, Math.PI * 2); ink(TC.brown, 5);
        g.beginPath(); g.ellipse(0, CY - 26, 15, 17, 0, 0, Math.PI * 2); ink(TC.pale, 5);   // white head
        g.beginPath(); g.moveTo(6, CY - 30); g.quadraticCurveTo(24, CY - 28, 18, CY - 14); g.lineTo(8, CY - 20); g.closePath(); ink(TC.yellow, 3.5);   // hooked beak
        g.beginPath(); g.arc(3, CY - 30, 2.8, 0, Math.PI * 2); g.fillStyle = TC.line; g.fill();
        [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * 8, CY + 46); g.lineTo(s * 12, CY + 58); g.lineWidth = 4; g.stroke(); });   // talons
      });
    } else if (style === 'flash') {
      const pieces = [[0, 60, 'star'], [W * 0.22, 140, 'heart'], [-W * 0.22, 140, 'swallow'], [W / 2, 70, 'anchor'], [W / 2 - W * 0.2, 165, 'star']];
      pieces.forEach(([x, y, kind]) => at(() => {
        if (kind === 'star') { star(0, y, 24); ink(TC.red, 5); star(0, y, 11); ink(TC.yellow, 3); }
        else if (kind === 'heart') { heart(0, y, 22); ink(TC.red, 5); }
        else if (kind === 'swallow') swallow(0, y, 0.42);
        else anchor(0, y, 0.48);
      }, x));
    } else if (style === 'text') {
      // bold lettering straight down the front of the limb, like a forearm script piece: Chinese stacked upright one
      // character under the next, anything else turned to run down the limb; sized to fill the length
      const word = (text || 'PEEP').slice(0, 12), cjk = /[\u3000-\u9fff\uff00-\uffef]/.test(word), n = [...word].length;
      at(() => {
        g.fillStyle = TC.line; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (cjk) {
          const sz = Math.min(44, (bot - 16) / n);
          g.font = `900 ${sz}px "Noto Serif TC", "PMingLiU", "MingLiU", serif`;
          [...word].forEach((ch, i) => g.fillText(ch, 0, 8 + sz * (i + 0.5)));
        } else {
          g.save(); g.translate(0, bot / 2); g.rotate(Math.PI / 2);
          const sz = Math.min(52, (bot - 16) / Math.max(1, n) * 1.6);
          g.font = `900 ${sz}px "Old English Text MT", "Times New Roman", serif`;
          g.fillText(word, 0, 0, bot - 16);
          g.restore();
        }
      });
    } else {   // rose
      at(() => rose(0, CY, 50));
      at(() => { leaf(-10, 34, -0.3, 38); leaf(10, 34, Math.PI + 0.3, 38); }, W / 2);   // leaves round the back
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return (TAT[key] = t);
}

// ---------------------------------------------------------------- the head and what's built on it
const R = 0.17;
// e: how square the head is (2 = round); s: stretch; jaw: how much it narrows toward the chin
const HEADS = {
  round: { e: 2.0, s: [1, 1, 1], jaw: 0.12 },
  oval: { e: 2.0, s: [0.93, 1.07, 0.97], jaw: 0.24 },
  square: { e: 3.2, s: [0.97, 0.95, 0.95], jaw: 0.03 },
  long: { e: 2.25, s: [0.9, 1.13, 0.95], jaw: 0.16 },
  heart: { e: 2.3, s: [1.02, 1.02, 0.95], jaw: 0.3 },   // 心形臉: wide at the temples, a narrower chin
};
// a unit direction -> the point on that head's surface
function deform(h, v) {
  const k = Math.pow(Math.abs(v.x) ** h.e + Math.abs(v.y) ** h.e + Math.abs(v.z) ** h.e, 1 / h.e);
  v.divideScalar(k);
  if (v.y < 0) { v.x *= 1 - h.jaw * -v.y; v.z *= 1 - h.jaw * 0.4 * -v.y; }
  return v.set(v.x * h.s[0] * R, v.y * h.s[1] * R, v.z * h.s[2] * R);
}
const headGeo = shape => geo(`head:${shape}`, () => {
  const h = HEADS[shape], g = new THREE.SphereGeometry(1, D(40), D(30)), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { deform(h, v.fromBufferAttribute(p, i)); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
});
// a layer over the head (hair, a beard, a hat): a cap of sphere around direction `n` covering angles [from, to],
// wrapped onto the head's surface and pushed out by `thick`. Built round n, so its edge is a clean curve.
// xMax trims it to one side (a side-swept fringe).
const UP = new THREE.Vector3(0, 1, 0);
const shellGeo = (shape, thick, n, from, to, xMax = 9) => geo(`shell:${shape},${thick},${n.toArray()},${from},${to},${xMax}`, () => {
  const h = HEADS[shape], g = new THREE.SphereGeometry(1, D(56), D(22), 0, Math.PI * 2, from, to - from);
  const p = g.attributes.position, q = new THREE.Quaternion().setFromUnitVectors(UP, n), v = new THREE.Vector3(), u = new THREE.Vector3();
  const keep = new Uint8Array(p.count);
  for (let i = 0; i < p.count; i++) {
    u.fromBufferAttribute(p, i).applyQuaternion(q).normalize();
    keep[i] = u.x <= xMax ? 1 : 0;
    deform(h, v.copy(u)).addScaledVector(u, thick);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  if (xMax < 9) {
    const src = g.index.array, idx = [];
    for (let t = 0; t < src.length; t += 3) if (keep[src[t]] && keep[src[t + 1]] && keep[src[t + 2]]) idx.push(src[t], src[t + 1], src[t + 2]);
    g.setIndex(idx);
  }
  g.computeVertexNormals(); return g;
});
// a head of hair as one piece: from the crown down to a hairline whose height (radians above the eyes' horizon) is
// edge(φ) all the way round, φ being the angle from straight ahead toward +x; thick(φ) lets the fringe stand out
// more than the back (at the edge; it fades out toward the crown). Built on its own grid, so the hairline is a smooth curve however it's shaped.
// bump(u) adds a lumpy surface (curls) on top; it needs a much finer grid to show.
// groove(φ) cuts a parting into it, as deep at the crown end as at the front.
// flow(φ, t) (t 0 at the crown, 1 at the hairline) sets which way the strands run, as the texture's u: they follow lines
// where it stays the same, so hair can fall away from a parting at an angle instead of straight down from the crown.
// It's cut in layers: from a little below the crown, LAYER_DEPTH-deep tiers, each swelling gently to its lower edge and
// easing back in under the next (no sharp step, so no break line), the tiers' edges wandering a little round the head
// so they don't read as rings.
const LAYER_DEPTH = 0.0035;
const tier = s => { const f = s - Math.floor(s); return f < 0.72 ? 0.5 - 0.5 * Math.cos(Math.PI * f / 0.72) : 0.5 + 0.5 * Math.cos(Math.PI * (f - 0.72) / 0.28); };
// (fading out round the back, where longer hair hangs over it, so it never pokes through that and leaves a seam)
const layerAt = (phi, t) => LAYER_DEPTH * tier(t * 3.3 + 0.1 * Math.sin(3 * phi)) * Math.min(1, Math.max(0, (t - 0.15) / 0.15))
  * Math.min(1, Math.max(0, (2.1 - Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi)))) / 0.6));
const capGeo = (shape, key, edge, thick, bump = null, groove = null, flow = null, under = 0) => geo(`cap7:${shape},${key}${under ? `:under${under}` : ''}`, () => {
  const h = HEADS[shape], NA = D(groove ? 320 : bump ? 180 : 160, 48), NT = D(bump ? 54 : 60, 18), pos = [], uv = [], idx = [], v = new THREE.Vector3(), u = new THREE.Vector3();
  // with a parting, curls lie flat along it (a band about twice the crease's width), so the line reads clean between them
  let gmax = 0; if (groove) for (let i = 0; i < 720; i++) gmax = Math.max(gmax, groove(i / 720 * Math.PI * 2));
  const calm = phi => (groove && gmax ? 1 - (groove(phi) / gmax) ** 0.12 : 1);
  for (let i = 0; i <= NA; i++) {
    const phi = (i / NA) * Math.PI * 2, polar = Math.PI / 2 - edge(phi), th0 = thick(0.5 * Math.PI), th1 = thick(phi), still = calm(phi);
    for (let j = 0; j <= NT; j++) {
      const p = (j / NT) * polar, th = th0 + (th1 - th0) * (j / NT) ** 1.5;   // any extra fullness grows toward the edge, so the crown stays one point
      u.set(Math.sin(p) * Math.sin(phi), Math.cos(p), Math.sin(p) * Math.cos(phi));
      const cut = groove ? groove(phi) * Math.min(1, (j / NT) * 4) * (bump ? 0.5 : 1) : 0;   // the parting fades out only right at the crown (shallower in curls)
      deform(h, v.copy(u)).addScaledVector(u, Math.max(0.0015, th - cut) + layerAt(phi, j / NT) + (bump ? bump(u) * still * Math.min(1, (NT - j) / 3) : 0));   // bumps settle down right at the hairline
      pos.push(v.x, v.y, v.z); uv.push(flow ? flow(phi, j / NT) : i / NA * 6, j / NT);
    }
  }
  for (let i = 0; i < NA; i++) for (let j = 0; j < NT; j++) {
    const a = i * (NT + 1) + j, b = a + NT + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  if (under) {
    // close the shell's open hairline back onto the head, so a thick, jutting
    // edge has a solid underside instead of an empty hollow seen from below
    const base = pos.length / 3;
    for (let i = 0; i <= NA; i++) {
      const phi = (i / NA) * Math.PI * 2, polar = Math.PI / 2 - edge(phi);
      u.set(Math.sin(polar) * Math.sin(phi), Math.cos(polar), Math.sin(polar) * Math.cos(phi));
      deform(h, v.copy(u)).addScaledVector(u, under);
      pos.push(v.x, v.y, v.z); uv.push(i / NA * 6, 1);
    }
    for (let i = 0; i < NA; i++) {
      const a = i * (NT + 1) + NT, b = a + NT + 1, c = base + i, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
});
// a hat as one piece: rings round its own crown direction n, each ring [a, thick, out, down]: a is the angle from the
// crown (the ring sits on the head there, pushed out by thick), and out / down then carry it horizontally away from the
// head and down, for a brim. Rings past the hat's edge (same a, smaller out) fold back underneath, so a brim or cuff has
// thickness, and a last ring tucks the edge back in to the hair. `rings(front)` gets 0..1 for how much that side of the
// hat faces forward, so a cap can grow its peak only at the front. The uv's u runs round the hat, v down it.
const hatGeo = (shape, key, n, rings) => geo(`hat:${shape},${key}`, () => {
  const h = HEADS[shape], NA = 96, q = new THREE.Quaternion().setFromUnitVectors(UP, n), v = new THREE.Vector3(), d = new THREE.Vector3(), e = new THREE.Vector3();
  const pos = [], uv = [], idx = [];
  let NR = 0;
  for (let i = 0; i <= NA; i++) {
    const psi = (i / NA) * Math.PI * 2;
    const ringsHere = rings(null), aEdge = ringsHere[ringsHere.length - 1][0];
    e.set(Math.sin(aEdge) * Math.sin(psi), Math.cos(aEdge), Math.sin(aEdge) * Math.cos(psi)).applyQuaternion(q);
    const front = Math.max(0, e.z / (Math.hypot(e.x, e.z) || 1)) ** 2;
    const rs = rings(front); NR = rs.length;
    rs.forEach(([a, th, out, down], j) => {
      d.set(Math.sin(a) * Math.sin(psi), Math.cos(a), Math.sin(a) * Math.cos(psi)).applyQuaternion(q);
      deform(h, v.copy(d)).addScaledVector(d, th);
      const hl = Math.hypot(d.x, d.z) || 1;
      v.x += (d.x / hl) * out; v.z += (d.z / hl) * out; v.y -= down;
      pos.push(v.x, v.y, v.z); uv.push(i / NA * 24, j / (rs.length - 1));
    });
  }
  for (let i = 0; i < NA; i++) for (let j = 0; j < NR - 1; j++) {
    const a = i * NR + j, b = a + NR;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
});
// a watch's case: a rounded rectangle `w` wide and `h` tall, `d` deep (facing +z), its edges rounded
const roundSlab = (w, h, d, r) => geo(`roundSlab:${w}:${h}:${d}:${r}`, () => {
  const sh = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2;
  sh.moveTo(x0 + r, y0); sh.lineTo(x0 + w - r, y0); sh.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  sh.lineTo(x0 + w, y0 + h - r); sh.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  sh.lineTo(x0 + r, y0 + h); sh.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  sh.lineTo(x0, y0 + r); sh.quadraticCurveTo(x0, y0, x0 + r, y0);
  const eg = new THREE.ExtrudeGeometry(sh, { depth: d - 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 6 });
  eg.translate(0, 0, -(d - 0.003) / 2); return eg;
});
// the watch faces, drawn once for each kind and colour: hands at ten past ten; 10:08 in segments; a smartwatch's time
// and its three activity rings
const WATCH_TEX = {};
const watchTex = (kind, dial) => WATCH_TEX[kind + dial] || (WATCH_TEX[kind + dial] = (() => {
  const c = new THREE.Color(dial), hex = '#' + c.getHexString(), pale = c.getHSL({}).l > 0.55, ink = pale ? '#1b1c20' : '#f2f2f2';
  if (kind === 'analog' || kind === 'mechanical') return canvasTex(128, 128, (g, W) => {
    g.fillStyle = hex; g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
    if (kind === 'mechanical') {
      // the open heart: a window low on the face onto the movement: gold wheels with teeth, a balance wheel, jewels
      g.save(); g.beginPath(); g.arc(64, 84, 24, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#3a3d44'; g.fillRect(30, 50, 70, 70);
      const gear = (x, y, r, teeth, col) => {
        g.fillStyle = col; g.beginPath();
        for (let k = 0; k < teeth * 2; k++) { const a = k / (teeth * 2) * Math.PI * 2, rr = k % 2 ? r : r * 0.86; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        g.fill(); g.fillStyle = '#3a3d44'; g.beginPath(); g.arc(x, y, r * 0.55, 0, Math.PI * 2); g.fill();
        g.strokeStyle = col; g.lineWidth = 2; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6); g.stroke(); }
        g.fillStyle = '#c0392b'; g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill();   // its jewel
      };
      gear(56, 86, 15, 18, '#d9b25a'); gear(78, 74, 9, 12, '#e8c878'); gear(76, 98, 7, 10, '#c9a24a');
      g.restore();
      g.strokeStyle = '#c9ccd1'; g.lineWidth = 3; g.beginPath(); g.arc(64, 84, 24, 0, Math.PI * 2); g.stroke();
    }
    g.strokeStyle = ink; g.lineCap = 'round';
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, r0 = k % 3 ? 50 : 44; g.lineWidth = k % 3 ? 3 : 6; g.beginPath(); g.moveTo(64 + Math.sin(a) * r0, 64 - Math.cos(a) * r0); g.lineTo(64 + Math.sin(a) * 57, 64 - Math.cos(a) * 57); g.stroke(); }
    const hand = (a, len, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(a) * len, 64 - Math.cos(a) * len); g.stroke(); };
    hand(-Math.PI / 3, 30, 7); hand(Math.PI / 3, 46, 5);
    g.fillStyle = ink; g.beginPath(); g.arc(64, 64, 5, 0, Math.PI * 2); g.fill();
  });
  if (kind === 'digital') return canvasTex(96, 64, (g, W, H) => {
    g.fillStyle = hex; g.fillRect(0, 0, W, H);
    g.fillStyle = pale ? 'rgba(20,24,20,0.85)' : 'rgba(235,240,235,0.9)'; g.font = 'bold 30px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('10:08', W / 2, H / 2 + 6);
    g.font = 'bold 12px "Courier New", monospace'; g.fillText('FR 13', W / 2, 13);
  });
  return canvasTex(80, 96, (g, W, H) => {
    g.fillStyle = '#050505'; g.fillRect(0, 0, W, H);
    [['#fa114f', 26], ['#92e82a', 19], ['#1eeaef', 12]].forEach(([col, r], i) => {
      g.lineWidth = 6; g.lineCap = 'round'; g.strokeStyle = col; g.globalAlpha = 0.28; g.beginPath(); g.arc(W / 2, 62, r, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1; g.beginPath(); g.arc(W / 2, 62, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * [0.75, 0.55, 0.85][i]); g.stroke();
    });
    g.fillStyle = c.getHSL({}).l < 0.15 ? '#f2f2f2' : hex; g.font = 'bold 20px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.fillText('10:08', W / 2, 24);
  });
})());
// knitted ribs for a beanie
let ribTex = null;
const ribs = () => ribTex || (ribTex = (() => {
  const t = canvasTex(32, 8, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 32, 8); for (let x = 0; x < 32; x += 4) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, 0, 1.5, 8); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})());
// a sneaker, shaped from a sphere: long, wider at the toe than the heel, flat underneath, the toe lifted a little.
// The sole is the same outline, a touch bigger, as a thin flat slab under it. Units are local to the shoe's centre.
const SHOE = { w: 0.062, h: 0.052, l: 0.128, fwd: 0.035, flat: -0.016 };
const shoeShape = (x, y, z) => {
  const t = z;                                                            // -1 at the heel, 1 at the toe
  const X = x * SHOE.w * (1 + 0.14 * Math.max(0, t) - 0.08 * Math.max(0, -t));
  let Z = t * SHOE.l + SHOE.fwd;
  if (Z < 0) Z *= 0.78;                                                   // the heel drawn in, just behind the ankle rather than well out behind it
  let Y = y * SHOE.h * (1 - 0.35 * Math.max(0, t) ** 2);                  // lower over the toes
  Y = Math.max(SHOE.flat, Y) + 0.012 * Math.max(0, t) ** 3;               // flat under the foot, the toe turned up
  return [X, Y, Z];
};
const shoeGeo = sole => geo(`shoe:${sole}`, () => {
  const g = new THREE.SphereGeometry(1, D(28), D(18)), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (!sole) { const [X, Y, Z] = shoeShape(x, y, z); p.setXYZ(i, X, Y, Z); }
    else { const [X, , Z] = shoeShape(x * 1.04, 0, z * 1.03); p.setXYZ(i, X, (y > 0 ? SHOE.flat + 0.004 : SHOE.flat - 0.012) + 0.012 * Math.max(0, z) ** 3, Z); }
  }
  g.computeVertexNormals(); return g;
});
// the height of the top of the shoe above its centre, a distance z forward (for laying the laces on it)
const shoeTop = z => SHOE.h * Math.sqrt(Math.max(0, 1 - ((z - SHOE.fwd) / SHOE.l) ** 2)) * (1 - 0.35 * Math.max(0, (z - SHOE.fwd) / SHOE.l) ** 2);
const laceM = mat(0xeeeeea, { roughness: 0.7 });
// a leg's cloth (or skin) lit as if it ran straight up and down: its normals made level, so a thigh narrowing to the knee and
// a trouser leg widening from it are lit alike and meet without a change of shade (the cached geometry's own copy)
const FLAT_LIT = new WeakMap();
const levelNormals = c => { const n = c.attributes.normal, v = new THREE.Vector3(); for (let i = 0; i < n.count; i++) { v.fromBufferAttribute(n, i); if (Math.abs(v.y) < 0.95) { v.y = 0; v.normalize(); n.setXYZ(i, v.x, v.y, v.z); } } return c; };
const flatLit = g => {
  if (FLAT_LIT.has(g)) return FLAT_LIT.get(g);
  const c = levelNormals(g.clone()); c.userData.flatLit = true;
  FLAT_LIT.set(g, c); return c;
};
// a canvas shoe's rubber: the upper's own outline a hair larger, from the ground up the sides to FOX (a band wrapping
// the foot, not a plate under it); its flat underside on the ground where a sneaker's sole is
const FOX = 0.006;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const foxGeo = () => geo('fox', () => {
  const g = new THREE.SphereGeometry(1, D(56), D(36)), p = g.attributes.position;   // (fine, so its top edge runs smooth)
  for (let i = 0; i < p.count; i++) {
    const z0 = p.getZ(i), curl = 0.012 * Math.max(0, z0) ** 3;   // (the upper's toe turns up; the sole stays flat out to the tip, wrapping up over it)
    let [X, Y, Z] = shoeShape(p.getX(i), p.getY(i), z0);
    X *= 1.018; Z = (Z - SHOE.fwd) * 1.015 + SHOE.fwd;
    const cap = 0.036 * smooth(0.4, 0.8, z0);   // over the toe it rises into the rounded rubber toe cap, one piece with the sole
    // (stood just proud of the upper all over, so the two never flicker where they meet)
    Y = p.getY(i) <= 0 ? SHOE.flat - 0.012 : Math.min(Y * 1.04 + 0.0015, FOX + curl + cap);
    p.setXYZ(i, X, Y, Z);
  }
  g.computeVertexNormals(); return g;
});// a high-top's upper: the sneaker's, its back and sides drawn up round the ankle in one smooth piece. Over the upper
// half, toward the heel, the surface is pulled out onto a ring of radius HI.r round the leg and up to HI.top; its very
// top folds in under the collar (hidden in the leg). The front, under the laces, slopes on up from the toe.
const HI = { r: 0.07, top: 0.104 };
// a low-top's: only round the heel and sides, up to just under the ankle; the front over the laces as the sneaker's
const LO = { r: 0.068, top: 0.066, z0: 0.12, z1: 0.05 };   // (its front drawn up a little too, as the tongue)
// a sneaker's padded collar: up the back and sides a little way round the ankle
const SNK = { r: 0.066, top: 0.076, z0: 0.13, z1: 0.045 };   // (the front drawn up too, as the tongue, so no ankle shows over the laces)
const hiTopGeo = (S = HI) => geo(`shoeRaised:${S.top}`, () => {
  const g = new THREE.SphereGeometry(1, D(32), D(22)), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let [X, Y, Z] = shoeShape(x, y, z);
    if (y > 0) {
      const w = smooth(S.z0 ?? 0.14, S.z1 ?? 0.05, Z) * smooth(0.15, 0.7, y);   // how much it's drawn up: the back half, the upper part
      const phi = uv.getX(i) * Math.PI * 2, a = Math.atan2(-Math.cos(phi), Math.sin(phi));   // its angle round the leg (from the sphere's own u, so even the pole's points have one)
      const rr = S.r * (y > 0.9 ? 1 - smooth(0.9, 1, y) * 0.4 : 1), hy = 0.012 + (S.top - 0.012) * smooth(0.15, 0.9, y);
      X += (Math.sin(a) * rr - X) * w; Z += (Math.cos(a) * rr - Z) * w; Y += (hy - Y) * w;
    }
    p.setXYZ(i, X, Y, Z);
  }
  g.computeVertexNormals(); return g;
});
// how far forward the high-top's front is at a height above the foot's centre (for laying the laces on it)
const HI_FRONT = new Map();
const hiFront = (h, S = HI) => {
  const k = `${S.top}:${Math.round(h * 1000)}`;
  if (!HI_FRONT.has(k)) {
    const p = hiTopGeo(S).attributes.position; let best = 0;
    // (on the sloping front above the foot: the upper surface down the middle, behind the toe, nearest that height)
    let near = 1;
    for (let i = 0; i < p.count; i++) {
      const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i);
      if (Math.abs(X) < 0.012 && Y > 0.01 && Z > 0.02 && Z < 0.13 && Math.abs(Y - h) < near) { near = Math.abs(Y - h); best = Z; }
    }
    HI_FRONT.set(k, best || S.r);
  }
  return HI_FRONT.get(k);
};
const SH_LIGHT = mat(0xe9e5da, { roughness: 0.8 });    // a canvas shoe's white rubber sole and toe cap
const bootSoleM = mat(0x1c1917, { roughness: 0.85 });
// one foot's shoe, in its style, hung from the knee (the foot's centre 0.287 below it)
function buildShoe(style, knee, mk, { shoe, skin, light, ankle = true }) {   // ankle: it shows (bare legs), not under a trouser hem
  const Y = -0.287;
  // the top of a boot's or high-top's shaft: a lip closing the gap down to the leg, so no ankle shows inside it
  const collarTop = (r, y, z) => { const m = shoe.clone(); m.color.multiplyScalar(0.55); m.side = THREE.DoubleSide; const ring = mk(geo(`collar:${r}`, () => new THREE.RingGeometry(0.03, r, D(20, 10))), m, 0, y, z, knee, false); ring.rotation.x = -Math.PI / 2; };
  const laces = (zs, lift = 0) => zs.forEach(z => mk(bx(0.05, 0.006, 0.01), laceM, 0, Y + shoeTop(z) + 0.002 + lift, z, knee, false));
  if (style === 'slides') {
    // 拖鞋: a bare foot on a thick flat sole, one wide strap over the instep
    // (the sole a good 3.5 cm thick, its underside on the ground where a sneaker's is, the foot standing on top of it)
    const SOLE = 2.2, soleTop = Y + 0.028 * SOLE - 0.028 - 0.012 * SOLE;
    const sole = mk(shoeGeo(true), shoe, 0, Y + 0.028 * SOLE - 0.028, 0, knee); sole.scale.set(1.03, SOLE, 1.01);
    const foot = mk(shoeGeo(false), skin, 0, soleTop + 0.0115, -0.004, knee); foot.scale.set(0.86, 0.72, 0.9);
    // (half a band round the foot's length, arching up over it from sole to sole, both faces drawn)
    const strapM = shoe.clone(); strapM.side = THREE.DoubleSide;
    const strap = mk(lathe('slideStrap', [[0.0645, -0.03], [0.068, 0], [0.0645, 0.03]], 20, -Math.PI / 2, Math.PI), strapM, 0, soleTop - 0.003, 0.05, knee, false);
    strap.rotation.x = -Math.PI / 2; strap.scale.set(1, 1, 0.88);   // (arched high enough to sit over the foot, socked or bare)
    return;
  }
  if (style === 'hightop' || style === 'lowtop') {
    // 帆布鞋: canvas in a band of white rubber wrapping the foot flush with it, a big rounded rubber toe cap, laced
    // criss-cross. 高筒: the upper itself rises up round the ankle in one piece (no tube stuck on top),
    // the laces running up its sloping front to a white-edged collar; 低筒: cut low under the ankle, laced over the foot
    const high = style === 'hightop', upper = hiTopGeo(high ? HI : LO);
    mk(upper, shoe, 0, Y, 0, knee);
    mk(foxGeo(), light, 0, Y, 0, knee, false);
    if (high) {
      mk(cy(HI.r + 0.002, HI.r + 0.002, 0.008, 18, true), light, 0, Y + HI.top - 0.004, 0, knee, false);   // the collar's white edge
      collarTop(HI.r + 0.002, Y + HI.top, 0);
      // up the front: each X laid on the surface there, tipped back with its slope
      [0.046, 0.061, 0.076, 0.091].forEach(h => {
        const z = hiFront(h), tilt = Math.atan2(hiFront(h + 0.008) - hiFront(h - 0.008), 0.016);
        [-1, 1].forEach(k => {
          const l = mk(bx(0.04, 0.005, 0.005), laceM, 0, Y + h, z + 0.005, knee, false); l.rotation.set(tilt, 0, k * 0.42);   // (stood a touch proud, over the curve between the sampled points)
        });
      });
    } else {
      mk(cy(LO.r + 0.002, LO.r + 0.002, 0.006, 18, true, Math.PI * 0.45, Math.PI * 1.1), light, 0, Y + LO.top - 0.003, 0, knee, false);   // the low collar's white edge, round the back (the front dips to the laces)
      // over the top of the foot: an X seen from above at each step
      [0.03, 0.044, 0.058].forEach(h => {   // up the tongue, tipped back with its slope
        const z = hiFront(h, LO), tilt = Math.atan2(hiFront(h + 0.008, LO) - hiFront(h - 0.008, LO), 0.016);
        [-1, 1].forEach(k => { const l = mk(bx(0.04, 0.005, 0.005), laceM, 0, Y + h, z + 0.004, knee, false); l.rotation.set(tilt, 0, k * 0.42); });
      });
    }
    return;
  }
  if (style === 'boots') {
    // 靴子: leather up the ankle, a thick dark sole with a heel, a pull tab at the back
    const up = mk(shoeGeo(false), shoe, 0, Y + 0.003, 0, knee); up.scale.set(1.06, 1.08, 1.04);
    const sole = mk(shoeGeo(true), bootSoleM, 0, Y - 0.003, 0, knee, false); sole.scale.set(1.06, 2.2, 1.05);
    mk(bx(0.07, 0.022, 0.05), bootSoleM, 0, Y - 0.026, -0.05, knee, false);   // the heel
    mk(cy(0.073, 0.075, 0.11, 18, true), shoe, 0, Y + 0.07, 0, knee);   // (round the leg's own centre, clear of it all round)
    collarTop(0.073, Y + 0.125, 0);
    mk(bx(0.016, 0.03, 0.006), shoe, 0, Y + 0.13, -0.075, knee, false);         // the pull tab
    return;
  }
  // 球鞋: one rounded piece on a sole that follows its outline, a padded collar a little way up the ankle, laces across the top
  // (the collar is the upper itself drawn up round the ankle, as a canvas shoe's; under trousers, whose hem's over it, plain)
  mk(ankle ? hiTopGeo(SNK) : shoeGeo(false), shoe, 0, Y, 0, knee);
  mk(shoeGeo(true), soleM, 0, Y, 0, knee, false);
  // laced criss-cross up the tongue: two laces crossing at each step, tipped back with the slope there
  if (ankle) [0.045, 0.062].forEach(h => {
    const z = hiFront(h, SNK), tilt = Math.atan2(hiFront(h + 0.008, SNK) - hiFront(h - 0.008, SNK), 0.016);
    [-1, 1].forEach(k => { const l = mk(bx(0.042, 0.005, 0.005), laceM, 0, Y + h, z + 0.004, knee, false); l.rotation.set(tilt, 0, k * 0.42); });
  });
  else [0.035, 0.058, 0.081].forEach(z => {   // (under trousers: crossing over the top of the foot)
    const y = Y + shoeTop(z) + 0.003;
    [-1, 1].forEach(k => { const l = mk(bx(0.042, 0.005, 0.005), laceM, 0, y, z, knee, false); l.rotation.y = k * 0.42; });
  });
}
// the torso: slices up the body, each an oval [y, half-width, half-depth]; it narrows a little to the waist, widens to
// the shoulders and then slopes up to the neck in one curve
// (the shoulders kept fairly narrow, so nobody looks built broader than they are)
const TORSO = [[0.71, 0.202, 0.15], [0.76, 0.2, 0.148], [0.84, 0.197, 0.146], [0.94, 0.198, 0.146], [1.02, 0.204, 0.146], [1.07, 0.216, 0.145],
  [1.11, 0.236, 0.142], [1.145, 0.252, 0.136], [1.175, 0.252, 0.126], [1.2, 0.234, 0.112], [1.222, 0.19, 0.096], [1.234, 0.15, 0.083], [1.242, 0.1, 0.071], [1.246, 0.074, 0.061],
  [1.256, 0.064, 0.057], [1.27, 0.059, 0.054], [1.285, 0.06, 0.055], [1.3, 0.068, 0.062], [1.312, 0.082, 0.074], [1.325, 0.1, 0.09], [1.34, 0.115, 0.1]];   // and on up into the head: flaring out into the shoulders below and into the underside of the head above, so the head grows out of the body rather than sitting on it
// how a top is cut: the body wider (`w`) and deeper (`d`) than regular below the shoulders, fading back to the same neck;
// `drop` lets the hem hang lower over the hips; the sleeves `s` times as wide, short ones `len` long
// `sh` lets a little cloth drape over the tops of the arms; the dropped shoulder itself is the sleeve, its seam lower;
// `flare` widens it below the waist out to the hem (a long, loose top hangs in a slight A, clear of the pants and legs)
const TOP_FITS = {
  // (every cut flares a little at the hem, so it always hangs over the top of the pants, never level with it)
  // (`waist`, `bust`: how much of a woman's shape shows through it: all of it in a fitted top, little of the waist in a loose one)
  slim: { w: 0.95, d: 0.96, drop: 0, s: 0.92, len: 0.14, sh: 0, flare: 0.018, waist: 1, bust: 1 },
  regular: { w: 1, d: 1, drop: 0, s: 1, len: 0.16, sh: 0, flare: 0.013, waist: 0.75, bust: 1 },
  oversize: { w: 1.08, d: 1.1, drop: 0.07, s: 1.35, len: 0.29, sh: 0.012, flare: 0.036, waist: 0.25, bust: 0.6, fill: 0.85 },   // the person stays the same build: only the cloth is roomier
};
// 身體 女: drawn in at the waist (by up to `in` side to side, `d` front to back, round `y`, easing out over `h` either way,
// back to the full hips at the bottom of the torso: the pants and skirt start there unchanged), and a bust: out in front
// round `y`, `amt` at most, falling off over `up` above and `down` below; fullest `x` either side of the middle, dipping
// to `mid` of that between them (a top bridging the gap), gone over `wx` beyond; `rows`, extra slices so the curves are
// smooth (ascending)
const FEM = {
  // (narrowest at `y`; above, easing back out over `up` to the ribs; below, widening steadily all the way down to the
  // hips at `lo` (the bottom of the torso, full width, where the pants' seat and the legs carry on), so no band of belly
  // is left standing out above them)
  // (all of these long, gentle curves, each over much of the body's height, never a sudden bulge or a pinched point)
  waist: { in: 0.25, d: 0.1, y: 0.93, up: 0.11, lo: 0.72 },
  bust: { y: 1.06, amt: 0.044, up: 0.1, down: 0.066, x: 0.085, wx: 0.09, mid: 0.82 },   // (soft and round, not pointed)
  // hips: wider side to side by up to `w`, widest at `y` (round the tops of the thighs), easing off over `h` up into the
  // waist and down into the legs; and the seat behind, out by up to `amt` round `y` (fuller below, rounding under into the
  // thighs), across the back as the bust is across the front
  hip: { w: 0.07, y: 0.68, h: 0.12 },
  // (fullest low, round the hip joints, and rounding on down under itself onto the backs of the thighs rather than
  // standing out as a shelf above them)
  butt: { y: 0.635, amt: 0.046, up: 0.13, down: 0.16, x: 0.065, wx: 0.08, mid: 0.6 },
  // (at the crotch, behind, how far out the seat stays between the thighs, as a share of a thigh's radius)
  under: 1,
  // the cleft: `depth` in at most, `w` wide either side of the middle, deepest at `y`, fading over `up` and `down`
  cleft: { depth: 0.004, w: 0.014, y: 0.645, up: 0.05, down: 0.03 },
  // and the thighs fuller, by `w` at the top, easing to nothing at the knee, so the hips run on down into the legs
  thigh: { w: 0.03, d: 0, base: 0.93 },   // (d: deeper front to back as well, by this much more, so from the side the hips run on down into them)
  // narrower through the chest and shoulders by k (from rom up, easing off again up the neck so it still meets the head),
  // the arms hung that much closer in with them
  shoulder: { k: 0.07, from: 0.95, to: 1.1 },
  rows: [0.735, 0.785, 0.81, 0.885, 0.97, 0.995, 1.045, 1.09],
};
// a rounded swell on the body, fullest `x` either side of the middle (dipping to `mid` between), falling off over `wx`
// beyond and `up`/`down` above and below `y`
const swell = (B, x, y) => {
  const dy = (y - B.y) / (y > B.y ? B.up : B.down), ax = Math.abs(x);
  const s = Math.min(1, ax / B.x), across = ax < B.x ? B.mid + (1 - B.mid) * s * s * (3 - 2 * s) : Math.exp(-(((ax - B.x) / B.wx) ** 2));
  return B.amt * Math.exp(-dy * dy) * across;
};
// how far the bust stands out at (x, y) on the front, for a cut (0 on a man's body)
// (on a fuller build, lower: the heavier, the lower)
// (and on the slimmer and middling builds a little fuller than first drawn, and those up to standard a little lower)
// (a man's roomy top: `fill` of the way out to a straight line down the front from his chest to the hem, where the cloth,
// flat down his front and flared at the hem, otherwise left his belly looking hollow; fading out round to the sides)
const DRAPE_TOP = 1.07;
const drapeAt = (x, y, F) => {
  const hemY = TORSO[0][0] - (F.drop || 0); if (!F.fill || y >= DRAPE_TOP || y <= hemY) return 0;
  const rzAt = yy => { if (yy <= TORSO[0][0]) return TORSO[0][2]; for (let i = 1; i < TORSO.length; i++) if (TORSO[i][0] >= yy) return TORSO[i - 1][2] + (TORSO[i][2] - TORSO[i - 1][2]) * (yy - TORSO[i - 1][0]) / (TORSO[i][0] - TORSO[i - 1][0]); return 0; };
  const cur = yy => rzAt(yy) * F.d + F.flare * Math.max(0, Math.min(1, (0.78 - yy) / (0.78 - hemY))) * 0.7;
  const line = cur(DRAPE_TOP) + (cur(hemY) - cur(DRAPE_TOP)) * (DRAPE_TOP - y) / (DRAPE_TOP - hemY);
  return Math.max(0, line - cur(y)) * F.fill * Math.exp(-((x / 0.15) ** 2));
};
const bustAt = (x, y, F, fem) => (fem ? swell(FEM.bust, x, y + (femK(fem) < 1 ? 0.02 + (1 - femK(fem)) * 0.05 : 0.01)) * (F.bust ?? 1) * (femK(fem) >= 0.8 ? 1.1 : 1) : drapeAt(x, y, F));
// how much narrower a woman is across at y: through her chest and shoulders (see FEM.shoulder), none at the waist or neck
// (everyone's shoulders a little narrower than first drawn, SHOULDER_ALL, a woman's narrower again by FEM.shoulder.k)
const SHOULDER_ALL = 0.08;
const shoulderAt = (y, fem) => { const S = FEM.shoulder, a = Math.min(1, Math.max(0, (y - S.from) / (S.to - S.from))), b = Math.min(1, Math.max(0, (y - 1.22) / 0.06)); return (SHOULDER_ALL + (fem ? S.k : 0)) * a * a * (3 - 2 * a) * (1 - b * b * (3 - 2 * b)); };
// how much wider a woman's hips make the body at y (a fraction), and how far her seat stands out behind at (x, y)
const hipAt = (y, fem) => (fem ? FEM.hip.w * Math.exp(-(((y - FEM.hip.y) / FEM.hip.h) ** 2)) : 0);
// (em: true, or how strongly a woman's figure shows, 0..1: less on a heavier build, see femOf)
const femK = fem => (fem === true ? 1 : +fem || 0);
// (a man's seat: the woman's soft swell in miniature: a smaller amount, but with long, gentle tails so it runs into the
// back and down into the crotch instead of standing out as a shelf)
const MALE_BUTT = { y: 0.69, amt: 0.028, up: 0.08, down: 0.1, x: 0.06, wx: 0.075, mid: 0.6 };
const MALE_CLEFT = { depth: 0.0018, w: 0.012, y: 0.662, up: 0.04, down: 0.03 };
const buttAt = (x, y, fem) => (fem ? swell(FEM.butt, x, y) * femK(fem) : swell(MALE_BUTT, x, y));
// a woman's bare body at y as a share of the plain one, side to side and front to back: her waist (all of it, as on bare
// skin) and her hips; carries her outline on below the torso's last slice, where the high-waisted pants still follow it
const femXZ = (y, fem) => {
  if (!fem) return [1, 1];
  const P = FEM.waist, sw = Math.max(0, Math.min(1, (y - P.lo) / (P.y - P.lo))), shape = y >= P.y ? Math.exp(-(((y - P.y) / P.up) ** 2)) : sw * sw * (3 - 2 * sw);
  return [(1 - P.in * shape) * (1 + hipAt(y, true)), 1 - P.d * shape * femK(fem)];
};
// the cleft between the buttocks: how far in it sinks at (x, y), behind (a narrow groove down the middle of the seat,
// deepest low, fading out up toward the small of the back and away under, between the thighs)
const cleftAt = (x, y, fem) => {
  const C = fem ? FEM.cleft : MALE_CLEFT, v = y < C.y ? Math.exp(-(((y - C.y) / C.down) ** 2)) : Math.exp(-(((y - C.y) / C.up) ** 2));
  return C.depth * v * Math.exp(-((x / C.w) ** 2)) * (fem ? femK(fem) : 1);
};
// how much fuller a woman's thigh is at hy, up from its hip joint (THIGH, its length, down to the knee)
const thighD = (hy, fem) => { if (!fem) return 1; const s = Math.min(1, Math.max(0, (hy + 0.2) / 0.2));   // (only the upper half, gone by mid-thigh)
  return 1 + FEM.thigh.d * s * s * (3 - 2 * s); };
// (slimmer than a man's all down the leg, ase at the knee and below, filling out toward the top into her hips)
const thighK = (hy, fem) => { if (!fem) return 1; const s = Math.min(1, Math.max(0, (hy + 0.32) / 0.32)), B = FEM.thigh.base; return B + (1 + FEM.thigh.w - B) * s * s * (3 - 2 * s); };
// the winter tops (帽T, 夾克, 西裝外套, 棒球外套): thicker cloth over whatever the cut is, so a little fuller through the
// body and the sleeves; a blazer hangs a little lower over the hips and its fronts curve away below its last button
// (`slit`: how far round each way it's open at the hem; `slitTop`: where the opening starts, one of the torso's rows)
const OUTER = {
  hoodie: { w: 1.03, d: 1.04, drop: 0.03, s: 1.08, flare: 0.004 },
  jacket: { w: 1.05, d: 1.06, drop: 0, s: 1.1, flare: 0.002 },
  varsity: { w: 1.05, d: 1.06, drop: 0, s: 1.12, flare: 0.002 },
  denim: { w: 1.05, d: 1.06, drop: 0, s: 1.1, flare: 0.002 },
  coat: { w: 1.04, d: 1.06, drop: 0.06, s: 1.06, flare: 0.012, slitTop: 0.69 },   // (closed down to the hem: slitTop only where its last button sits)
};
// 短版上衣: the top ends at CROP, up under the ribs; just below it the body tucks in from the cloth's width to its own over
// CROP_EASE, so the hem sits out over the bare midriff. (洋裝: its top ends at the waist, never dropped, the skirt below.)
const CROP = 0.9, CROP_EASE = 0.03;
// (under a crop top the high waist comes up over the hips, and there the body is tucked in to the pants' own waist and
// seat (see torsoRows): no wider, and no deeper than they are, so the high waist doesn't swell out over the hips into a
// second seat; it eases back out to the body by CROP_TUCK_TO, up under the pants' top edge)
const CROP_TUCK_X = 0.925, CROP_TUCK_Z = 0.925, CROP_TUCK_TO = 0.82;
const cutOf = (fit, style) => {
  const F = TOP_FITS[fit] || TOP_FITS.regular, O = OUTER[style];
  // (a bikini top: bare from just under the bust down, the body below it fitted into high-waisted pants as a crop top's is)
  // (and no cloth round the body at all: it's her bare outline all the way up, all of her waist drawn in above the crop
  // line as below it, so no ledge stands out round her where a crop top's hem would be)
  if (style === 'bra') return { ...F, w: Math.min(1, F.w), d: Math.min(1, F.d), sh: 0, waist: 1, bust: 1, drop: 0, flare: 0, crop: CROP };
  if (style === 'crop') return { ...F, fill: 0, drop: 0, flare: 0, crop: CROP };
  // (a dress: one piece, hanging straight down from the bust, none of her waist drawn in under it)
  if (style === 'dress') return { ...F, drop: 0, waist: 0 };
  return O ? { ...F, w: F.w * O.w, d: F.d * O.d, drop: F.drop + O.drop, s: F.s * O.s, flare: F.flare + O.flare, slit: O.slit || 0, slitTop: O.slitTop || 0, waist: F.waist * 0.5, bust: F.bust * 0.75 } : F;   // (thick cloth: less of her shape shows)
};
// how far round from the front a blazer's opening reaches on a slice (none above its last button, curving away to the hem)
const slitAngle = (F, y) => (F.slit ? F.slit * Math.max(0, Math.min(1, (F.slitTop - y) / (F.slitTop - (TORSO[0][0] - F.drop)))) ** 0.75 : 0);
// a U neck: the front of the top scooped out from the base of the neck down to UNECK.bot, so the neck and a little chest
// show. Across the front it is UNECK.w either side of the middle, straight down the sides from UNECK.full and rounding
// into the bottom of the U.
const UNECK = { full: 1.24, bot: 1.21, w: 0.078, flat: 0.03, neck: 1.246 };   // above `neck` it's all skin
const uHalf = y => { const s = Math.max(0, Math.min(1, (y - UNECK.bot) / (UNECK.full - UNECK.bot))); return Math.max(UNECK.flat, UNECK.w * Math.sqrt(1 - (1 - s) ** 2)); };
// the torso's slices for a cut, with extra rows over the chest and shoulders so the U's edge runs smoothly
// (fem: a woman's body, see FEM)
const torsoRows = (fit, style, fem = false) => {
  const F = cutOf(fit, style), hemY = TORSO[0][0] - F.drop;
  const flareAt = y => F.flare * Math.max(0, Math.min(1, (0.78 - y) / (0.78 - hemY)));
  // (a crop top: rows exactly at its hem and where the body below it has tucked in; a woman's, more down the waist and bust)
  const extra = [...(F.crop ? [F.crop - CROP_EASE, F.crop] : []), ...(fem ? FEM.rows : [])].sort((a, b) => a - b);
  const fine = [];
  TORSO.forEach((row, r) => {
    const next = TORSO[r + 1];
    fine.push(row);
    if (next && row[0] >= 1.1) for (let k = 1; k < 3; k++) fine.push(row.map((v, j) => v + (next[j] - v) * k / 3));
    if (next) for (const cy of extra) if (row[0] < cy && next[0] > cy) fine.push(row.map((v, j) => v + (next[j] - v) * (cy - row[0]) / (next[0] - row[0])));
  });
  // (a long drop in several rows, so its flare curves and a coat's opening runs smoothly)
  const steps = F.drop > 0.08 || F.slit ? 4 : 1, below = [];
  if (F.drop) for (let k = 0; k < steps; k++) below.push([hemY + F.drop * k / steps, TORSO[0][1], TORSO[0][2]]);
  return below.concat(fine).map(([y, rx, rz]) => {
    const k = Math.max(0, Math.min(1, (1.25 - y) / 0.15));   // full below the shoulders, none at the neck
    // (a crop top's bare midriff, below its hem, no roomier than the body: a loose one's tucked in to it, a fitted one's the same)
    const c = F.crop ? Math.max(0, Math.min(1, (y - F.crop + CROP_EASE) / CROP_EASE)) : 1, W = Math.min(1, F.w) + (F.w - Math.min(1, F.w)) * c, Dd = Math.min(1, F.d) + (F.d - Math.min(1, F.d)) * c;
    // (a woman's waist, as much as the cut shows: all of it on a crop top's bare midriff)
    const P = FEM.waist, sw = Math.max(0, Math.min(1, (y - P.lo) / (P.y - P.lo))), shape = y >= P.y ? Math.exp(-(((y - P.y) / P.up) ** 2)) : sw * sw * (3 - 2 * sw);
    const pinch = fem ? P.in * shape * ((F.waist ?? 1) + (1 - (F.waist ?? 1)) * (1 - c)) : 0;
    // (under a crop top, below the high waist's top the body keeps to the pants' own waist and seat, easing back out to
    // its full outline by CROP_TUCK_TO: only that part is under the high waist, and it keeps it from swelling over the
    // hips. A man's seat is much shallower than his lower back, so his depth is tucked in further.)
    const tq = Math.max(0, Math.min(1, (y - TORSO[0][0]) / (CROP_TUCK_TO - TORSO[0][0]))), ts = tq * tq * (3 - 2 * tq), tx = CROP_TUCK_X + (1 - CROP_TUCK_X) * ts, tz = (fem ? CROP_TUCK_Z : 0.7) + (1 - (fem ? CROP_TUCK_Z : 0.7)) * ts;
    return [y, (rx * (1 + (W - 1) * k) + F.sh * Math.exp(-(((y - 1.15) / 0.055) ** 2)) + flareAt(y)) * (1 - pinch) * (1 + hipAt(y, fem)) * (1 - shoulderAt(y, fem)) * tx, (rz * (1 + (Dd - 1) * k) + flareAt(y) * 0.7) * (1 - pinch * P.d / P.in * femK(fem)) * tz];
  });
};
// how far round from the front the U reaches on a slice (0 below it); the slice's points are laid out so one falls
// exactly on each side of the U, and the skin inside it is the second material
const uAngle = (y, rx) => y < UNECK.bot - 1e-4 ? 0 : rx < 1e-4 ? Math.PI / 2 : Math.asin(Math.min(1, uHalf(y) / rx));
const torsoGeo = (fit = 'regular', style = 'tee', fem = false) => geo(`torso39:${fit}:${style}:${fem}`, () => {
  const N = 48, M = 12, pos = [], idx = [], skinIdx = [];
  const rows = torsoRows(fit, style, fem), F = cutOf(fit, style);
  rows.forEach(([y, rx, rz]) => {
    // below the U the points spread back out to evenly round, gradually over a few slices so no line shows where
    // the layout changes
    // (a blazer's opening below its last button: the points laid out just as above it, so its shading carries on smooth,
    // only those inside the opening pushed out to its edges; the two quads either side of the middle left out)
    const u = uAngle(y, rx), s = Math.max(0, Math.min(1, (UNECK.bot - y) / 0.09)), e = s * s * (3 - 2 * s);
    const a = u || uAngle(UNECK.bot, rx) + (Math.PI * M / N - uAngle(UNECK.bot, rx)) * e, sa = slitAngle(F, y);
    for (let i = 0; i <= N; i++) {
      let t = i <= M ? -a + 2 * a * i / M : a + (2 * Math.PI - 2 * a) * (i - M) / (N - M);
      if (sa > 0 && Math.abs(t) < sa && i !== M / 2) t = Math.sign(t) * sa;
      pos.push(Math.sin(t) * rx, y, Math.cos(t) * rz + (Math.cos(t) > 0 ? bustAt(Math.sin(t) * rx, y, F, fem) : -buttAt(Math.sin(t) * rx, y, fem)));
    }
  });
  for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < N; i++) {
    const a = r * (N + 1) + i, b = a + N + 1;
    if ((i === M / 2 - 1 || i === M / 2) && slitAngle(F, rows[r][0]) > 0) continue;   // (open)
    const skin = style === 'bra' || (i < M && uAngle(rows[r][0], rows[r][1]) > 0) || rows[r][0] >= UNECK.neck - 1e-4 || (F.crop && rows[r][0] < F.crop - 1e-4);
    (skin ? skinIdx : idx).push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx.concat(skinIdx)); g.addGroup(0, idx.length, 0); g.addGroup(idx.length, skinIdx.length, 1);
  g.computeVertexNormals();
  const nr = g.attributes.normal;   // the seam where each slice starts and ends again: one normal, so no crease
  for (let r = 0; r < rows.length; r++) {
    const a = r * (N + 1), b = a + N;
    const v = new THREE.Vector3(nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b)).normalize();
    nr.setXYZ(a, v.x, v.y, v.z); nr.setXYZ(b, v.x, v.y, v.z);
  }
  return g;
});
// the neckline's rib: down round the U in front and across the back of the neck
const neckRibGeo = (fit = 'regular', style = 'tee', r = 0.0075) => geo(`neckrib12:${fit}:${style}:${r}`, () => {
  const pts = [], rows = torsoRows(fit, style).filter(([y]) => y >= UNECK.bot - 1e-4 && y <= UNECK.neck + 1e-4);
  const side = sgn => rows.map(([y, rx, rz]) => { const t = uAngle(y, rx); return new THREE.Vector3(sgn * Math.sin(t) * rx * 1.012, y, Math.cos(t) * rz * 1.012); });
  const right = side(1), left = side(-1).reverse();
  pts.push(...left.slice(0, -1), new THREE.Vector3(0, UNECK.bot, rows[0][2] * 1.012), ...right);
  const [ty, rx, rz] = rows[rows.length - 1], t0 = uAngle(ty, rx);
  for (let k = 1; k < 10; k++) { const t = t0 + (2 * Math.PI - 2 * t0) * k / 10; pts.push(new THREE.Vector3(Math.sin(t) * rx * 1.012, ty, Math.cos(t) * rz * 1.012)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), D(80), r, D(6, 3), true);
});
// the top of the pants as one piece, waist to crotch, so nothing joins the hips to the legs: an oval round the waist
// that, going down, pinches in front and back between the legs until at the crotch it is exactly the two thighs (two
// circles a shade wider than them, centred on the hip joints), and the thighs carry on down from there. Each slice is
// sampled round its middle: the oval and the two circles, blended by height. (w: how full the pants' legs are; k: a
// roomier seat for baggy pants)
const PANTS_TOP = { crotch: 0.585, waist: 0.725, hipX: 0.094, rx: 0.192, rz: 0.114 };   // the waist tucked inside the shirt's hem
// (high-waisted, under a crop top: `up` = { key, top, at(y) → [rx, rz] }: from halfway up the seat it fills out to the
// body's own slices and carries on up them, just outside the skin, to `top`)
// (fem: round a woman's hips and seat, see FEM; the seat rounding under into the backs of the thighs at the crotch)
// (sideX0: how far out the legs' sides are at the crotch, for a man's wide trousers: the seat's sides then run in one
// smooth line from there up to the waist, no bulge over the hips and no step in where the legs begin; the seat's side
// scale by height is left on the geometry as userData.sideScale(y), for the jeans' stitching to follow)
// (lobe: [centre, radius] of the two circles at the crotch, when the legs are set further apart or fuller than usual (a
// man's wide trousers), so the seat comes down exactly onto them, inside and out, with no ledge where it meets them)
// (slant: a man's briefs: the seat drawn in from his hips to his thighs as steadily as a woman's, so the strip between his
// legs narrows in one smooth V instead of pinching in to a little box at the crotch)
const pantsTopGeo = (w, k = 1, up = null, fem = false, sideX0 = null, evenSides = false, lobe = null, slant = false) => geo(`ptop61:${w}:${k}:${up ? up.key : ''}:${fem}:${sideX0}:${evenSides}:${lobe}:${slant}`, () => {
  // (round a woman's fuller thighs at the crotch)
  const { crotch, waist } = PANTS_TOP, c = lobe ? lobe[0] : PANTS_TOP.hipX, N = 160, R = lobe ? lobe[1] : 0.0875 * w * thighK(crotch - (0.55 + LEG_EXTRA), fem), pos = [], idx = [];
  const ROWS = up ? 18 : 12, top = up ? up.top : waist, seatRows = up ? 12 : ROWS;
  const rowY = r => (r > seatRows ? waist + (top - waist) * (r - seatRows) / (ROWS - seatRows) : crotch + (waist - crotch) * Math.min(1, r / seatRows));
  const lobes = (sx, sz, t = 1) => {   // how far out along (sx, sz) the two circles reach, or almost nothing between them
    // (a woman's: filled in behind between the thighs, so her seat rounds on down into them, no notch cut up into it)
    // (and a man's wide trousers, his legs set apart: filled in behind between them too, now his seat rounds out there)
    let best = (fem || lobe || slant) && sz < 0 ? R * FEM.under * (q => q * q * (3 - 2 * q))(Math.min(1, -sz * 1.4)) * (q => (fem ? 0.5 + 0.5 * q : q))((q => q * q * (3 - 2 * q))(Math.min(1, t / 0.45))) : 0.004;   // (fading out at the very bottom, rounding under into the gap between them; a man's all the way, as his legs part below)
    [-c, c].forEach(cx => { const b = sx * cx, disc = b * b - cx * cx + R * R; if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc)); });
    // (a man's briefs: filled in across the front between his thighs too, but not level with their fronts (a flat board
    // across him, like a skirt's front): dipping in between them in a soft valley, half as far out in the middle, as a
    // woman's fuller thighs run into one another there, so each thigh still reads as round)
    if (slant && sz > 0) {
      const f = x => { const u = Math.min(1, Math.abs(x) / c); return R * (0.5 + 0.5 * u * u * (3 - 2 * u)); };
      let d = R / sz; for (let i = 0; i < 8; i++) d = f(d * sx) / sz;
      if (Math.abs(sx) * d <= c) best = Math.max(best, d);
    }
    return best;
  };
  // how far out a row reaches at angle (sx, sz) round its middle, before the sides are evened out
  const rowAt = r => {
    // (high-waisted: the rows over the seat as before, the rest on up the body)
    const t = Math.min(1, r / seatRows), e = fem || slant ? 0.5 * (1 - (1 - t) ** 1.6) + 0.5 * t * t * (3 - 2 * t) : t * t * (3 - 2 * t);   // (a woman's slanting in steadily from her hips to meet her thighs at an angle, not curving round to stand straight above them)
    const y = rowY(r);
    // (the oval: the usual waist, or filling out to the body's slice from halfway up the seat)
    let { rx, rz } = PANTS_TOP;
    rx *= 1 + hipAt(y, fem);
    if (fem) rz = TORSO[0][2] * 0.95;   // (a woman's as deep as the body above, so her seat runs on down from the small of her back, no dip between)
    if (up) { const [bx, bz] = up.at(y), f = Math.min(1, Math.max(0, (t - 0.05) / 0.7)), ff = (q => (fem ? 0.5 + 0.5 * q : q))(f * f * (3 - 2 * f)); rx += (bx - rx) * ff;   // (a woman's: halfway to the body's own outline even low on the seat, so it dips in less between them)
    rz += (bz - rz) * ff; }
    // roomy through the seat, the waist itself the usual size, inside the shirt (a roomy seat stays roomy right up to
    // under the shirt's hem, so its side drops straight to the legs, no waist pinched in)
    const kk = 1 + (k - 1) * (1 - t ** 4);
    return { t, e, y, d: (sx, sz) => { const oval = 1 / Math.sqrt((sx / (rx * kk)) ** 2 + (sz / (rz * kk)) ** 2); return lobes(sx, sz, t) + (oval - lobes(sx, sz, t)) * e; } };
  };
  // (a man's wide trousers: each row's sides moved out or in to one smooth line from the legs' sides at the crotch to
  // the seat's own side at the waist; front and back left as they are)
  const sideK = [];
  for (let r = 0; r <= ROWS; r++) sideK.push(1);
  // (wide trousers, a woman's too: no row's side tucked in under the line from the rows below it to the rows above, so
  // the side never dips in between the waistband and the hips or legs: it is the outline's hull, straight or bulging
  // out, from the crotch (a man's brought out to his legs' sides) right up to the top of the waistband)
  // the outline's hull up the rows: [y, how far out] points in, each row's share of the hull's reach out
  const hullK = (pts, d0) => {
    const hull = [];
    for (const p of pts) {
      while (hull.length >= 2) { const [a, b] = hull.slice(-2); if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0) hull.pop(); else break; }
      hull.push(p);
    }
    const at = y => { for (let j = 1; j < hull.length; j++) if (hull[j][0] >= y - 1e-9) { const [y0, x0] = hull[j - 1], [y1, x1] = hull[j]; return x0 + (x1 - x0) * (y - y0) / (y1 - y0 || 1); } return hull[hull.length - 1][1]; };
    return d0.map((d, r) => at(rowY(r)) / d);
  };
  if (sideX0 || evenSides) {
    const d0 = [], pts = [];
    for (let r = 0; r <= ROWS; r++) { d0.push(rowAt(r).d(1, 0)); pts.push([rowY(r), r === 0 && sideX0 ? sideX0 : d0[r]]); }
    hullK(pts, d0).forEach((k, r) => { sideK[r] = k; });
  }
  // (a man's evened-out trousers and shorts likewise in front and behind: from the waistband his belly runs straight on
  // down into the fronts of his legs, and his back into his seat, with no dip in either between; frontK, backK, as sideK)
  const frontK = sideK.map(() => 1), backK = sideK.map(() => 1);
  if (evenSides && !fem) {
    for (const [K, sgn] of [[frontK, 1], [backK, -1]]) {
      const d0 = [];
      for (let r = 0; r <= ROWS; r++) { const { d } = rowAt(r); let m = 0; for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a); if (sz * sgn > 0) m = Math.max(m, sz * sgn * d(sx, sz) * (1 + (sideK[r] - 1) * sx * sx)); } d0.push(m); }
      hullK(d0.map((d, r) => [rowY(r), d]), d0).forEach((k, r) => { K[r] = k; });
    }
  }
  const rowScale = K => y => { for (let r = 1; r <= ROWS; r++) { const y1 = rowY(r); if (y1 >= y) { const y0 = rowY(r - 1); return K[r - 1] + (K[r] - K[r - 1]) * Math.min(1, Math.max(0, (y - y0) / (y1 - y0 || 1))); } } return K[ROWS]; };
  for (let r = 0; r <= ROWS; r++) {
    const { e, y, d: dAt } = rowAt(r);
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a);
      const d = dAt(sx, sz) * (1 + (sideK[r] - 1) * sx * sx) * (1 + ((sz > 0 ? frontK : backK)[r] - 1) * sz * sz);
      const seatOut = sz < 0 ? buttAt(sx * d, y, fem) : 0;   // (on down past the crotch: the thighs carry it on behind)
      const dz = 1 + (thighD(crotch - (0.55 + LEG_EXTRA), fem) - 1) * (1 - e);   // (round a woman's deeper thighs at the crotch)
      pos.push(sx * d, y, sz * d * dz - seatOut + (sz < 0 ? cleftAt(sx * d, y, fem) : 0));   // (and the cleft down the middle behind)
    }
  }
  for (let r = 0; r < ROWS; r++) for (let i = 0; i < N; i++) { const a = r * (N + 1) + i, b = a + N + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.userData.sideScale = rowScale(sideK); g.userData.frontScale = rowScale(frontK); g.userData.backScale = rowScale(backK);
  // (a woman's: the underside of her seat lit as though it faced no further down than level, more so the lower it is,
  // easing in smoothly from partway up, so it shades evenly into her thighs (lit level too) with no dark band or line)
  // (a man's likewise, so his seat shades on into his legs with no band at the crotch)
  {
    const nr = g.attributes.normal, v = new THREE.Vector3();
    for (let r = 0; r <= ROWS; r++) {
      const t = Math.min(1, r / (up ? 12 : ROWS)), q = Math.min(1, Math.max(0, (0.85 - t) / 0.6)), w = q * q * (3 - 2 * q);
      for (let i = 0; i <= N; i++) { const j = r * (N + 1) + i; v.fromBufferAttribute(nr, j); if (v.y < 0) { v.y *= 1 - w; v.normalize(); nr.setXYZ(j, v.x, v.y, v.z); } }
    }
  }
  return g;
});
// a woman's thigh, lit level (flatLit) down most of its length, but toward its top easing over to its own true normals,
// so where it runs up into her seat (lit true) the two are lit alike and no line shows between them; `oy`: the mesh's
// height in the hip's frame
const thighTopNormals = (gm, oy = 0) => {
  const t = gm.clone(); t.computeVertexNormals();
  const n = gm.attributes.normal, tn = t.attributes.normal, p = gm.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    const s = Math.min(1, Math.max(0, (p.getY(i) + oy + 0.16) / 0.12)), w = s * s * (3 - 2 * s);
    a.fromBufferAttribute(n, i); b.fromBufferAttribute(tn, i); a.lerp(b, w).normalize(); n.setXYZ(i, a.x, a.y, a.z);
  }
  t.dispose();
};
// a skirt as it lies sitting (thighs level, straight out in front from the hips), in the skirt's own frame (its pivot
// at the waist, 0.72 + LEG_EXTRA up; sx, sz the build's widening of it, which its group is scaled by): from the same
// waistband as the hanging skirt, down over the hips and on along the thighs to just past the knees, always clear of
// them: across, wider than both thighs side by side; up and down, its top resting just over the thighs (as thick as
// they are, the build's fuller thighs too) and its back down under them, ending short of the shins, so neither the
// thighs nor the knees ever come through it. Over the knees its front falls a little, as cloth would.
// F: how wide its cut (narrow, A-line, full); tuck: taken in under a fitted top; fx, fz: the thighs' widening across
// and their deepening up and down for the build (as the legs are in buildBodyAt)
// a long dress's skirt hanging (from its pivot at the waist): out over the hips, then straight down to below the knee,
// a touch wider at the hem; and how far below the knees it reaches when she sits (DRESS_DROP)
const DRESS_HANG = [[0.185, -0.05], [0.188, -0.08], [0.196, -0.11], [0.204, -0.16], [0.208, -0.24], [0.21, -0.33], [0.212, -0.43], [0.216, -0.51], [0.218, -0.55], [0.214, -0.555]];   // (close over the hips, as a straight dress is)
const DRESS_DROP = 0.24;   // (from the tops of the knees: over them and on a little way down the shins)
// (drop: a long dress's, as much further again, carried on over the knees and hanging down in front of the shins)
const lapSkirtGeo = (F, tuck, fx, fz, drop = 0) => geo(`lapskirt3:${F}:${tuck}:${fx}:${fz}:${drop}`, () => {
  const PIV = 0.72 + LEG_EXTRA, HIP = 0.55 + LEG_EXTRA, KNEE = 0.32, X = 0.094 * fx;
  const NA = D(32, 12), NT = D(18, 8), N = 2.6, pos = [], idx = [];
  const sup = c => Math.sign(c) * Math.abs(c) ** (2 / N);
  const waist = 0.185 * tuck, hipR = (0.185 + 0.058 * F) * tuck;   // (the hanging skirt's radius at the waist, and down at the hips)
  const half = (X + 0.09 * fx) + (0.035 + 0.05 * (F - 0.35)) * fx;  // across: out past both thighs, by the cut
  const thick = s => { const k = Math.min(1, s / KNEE); return (0.09 - 0.016 * k) * (fz + (fx - fz) * k); };   // a thigh's half-depth
  // a point on the lap, s along the thighs from the hips (a, c: across and up the cross-section, -1..1)
  const SK = KNEE + 0.085;   // (where a long dress turns down, just past the fronts of the knees)
  const lapAt = (s, a, c) => {
    if (drop && s > SK) { const k = lapAt(SK, a, c), d = s - SK, turn = Math.min(1, d / 0.05); return [k[0], k[1] - d * turn - 0.012 * (1 - turn) * d / 0.05, k[2] + 0.02 * Math.sqrt(turn) * Math.max(0, c)]; }
    const up = c >= 0, v = (up ? thick(s) + 0.014 : thick(s) + 0.006) * sup(c);
    const droop = up && s > 0.33 ? 5 * (s - 0.33) ** 2 * c : 0;
    return [half * sup(a), HIP + v - droop, s];
  };
  const bez = (p0, p1, p2, t) => p0.map((_, i) => (1 - t) ** 2 * p0[i] + 2 * t * (1 - t) * p1[i] + t * t * p2[i]);
  for (let j = 0; j <= NT; j++) {
    const t = j / NT;
    for (let i = 0; i <= NA; i++) {
      const phi = (i / NA) * Math.PI * 2, a = Math.sin(phi), c = Math.cos(phi);   // c: +1 the front, -1 the back
      const top = [waist * a * fx, PIV - 0.05, waist * 0.78 * c * fz];
      // the front ends past the knees, the back short of the shins (straight down from the knees, or out along the floor)
      const L = 0.22 + 0.2 * ((c + 1) / 2) ** 1.5 + (drop ? (SK - 0.42 + drop) * Math.max(0, c) ** 0.6 : 0);
      // where it turns from hanging to lying along the thighs: at the front, as far forward as the waistband; behind, as
      // far back as the hanging skirt at the hips
      const s1 = Math.max(0, top[2]), hip = lapAt(s1, a, c);
      if (c < 0) hip[2] = hipR * 0.78 * c * fz * 1.05;
      const sm = Math.min(L, s1 + 0.06), T = 0.45;   // the first part of its length the turn, the rest along the lap
      const p = t <= T ? bez(top, hip, lapAt(sm, a, c), t / T) : lapAt(sm + (L - sm) * (t - T) / (1 - T), a, c);
      pos.push(p[0], p[1] - PIV, p[2]);
    }
  }
  for (let j = 0; j < NT; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + NA + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  // (the build's widening, which its group is scaled by, taken back out here: it's already built for that build)
  g.scale(1 / fx, 1, 1 / fz);
  g.computeVertexNormals(); return g;
});
// curls in a hair surface, like the ringlets lower down: wavy locks running out from the crown, each waving from side
// to side and bulging where it curls; they smooth out right at the crown so they don't bunch up where they all meet
const curlLumps = amp => u => {
  const phi = Math.atan2(u.x, u.z), p = Math.acos(Math.max(-1, Math.min(1, u.y)));
  const lock = 0.5 + 0.5 * Math.sin(22 * phi + 1.6 * Math.sin(9 * p + 3 * phi));
  const curl = 0.6 + 0.4 * Math.sin(14 * p + 5 * phi);
  return amp * (0.25 + 0.75 * lock * curl) * Math.min(1, p / 0.45);
};
// a lathe whose surface is pushed out into ringlets: separate locks hanging down it, each waving from side to side and
// bulging where it curls, deeper toward the ends
// (strength(y) from 0 to 1). The profile is resampled finely first so the twists come out smooth. `phase` sets the locks
// off differently (for a second layer under the first); `jag` lets the locks end at different lengths, up or down by
// that much, so the ends aren't cut in a straight line. `inner` carries on the profile back up the inside, against the
// head, closing the hair into one solid mass; it's left smooth
const ringletLathe = (key, pts, seg, phiStart, phiLen, amp, strength, phase = 0, jag = 0, inner = []) => geo(`ringlet5:${key}`, () => {
  const dense = [];
  for (let k = 1; k < pts.length; k++) {
    const [r0, y0] = pts[k - 1], [r1, y1] = pts[k], n = Math.max(1, Math.ceil(Math.abs(y1 - y0) / 0.006));
    for (let i = 0; i < n; i++) dense.push([r0 + (r1 - r0) * i / n, y0 + (y1 - y0) * i / n]);
  }
  dense.push(pts[pts.length - 1]);
  const outer = dense.length; dense.push(...inner);
  const g = new THREE.LatheGeometry(dense.map(([r, y]) => new THREE.Vector2(r, y)), D(seg, 12), phiStart, phiLen), p = g.attributes.position;
  const yEnd = dense[outer - 1][1];
  for (let i = 0; i < p.count; i++) {
    if (i % dense.length >= outer) continue;   // the inside stays smooth against the head
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z), phi = Math.atan2(x, z);
    const lock = 0.5 + 0.5 * Math.sin(14 * phi + phase + 1.7 * Math.sin(38 * y + 3 * phi));   // the locks, waving as they fall
    const curl = 0.6 + 0.4 * Math.sin(44 * y + 5 * phi + phase);                               // each one bulging where it turns
    const k = (r + amp * strength(y) * lock * curl) / (r || 1);
    // near the ends, each lock stops at its own length: some shorter, some longer
    const near = Math.max(0, 1 - (y - yEnd) / 0.05) ** 2;
    const dy = jag * near * (0.6 * Math.sin(7 * phi + phase) + 0.4 * Math.sin(17 * phi + 2.1 + phase * 1.7));
    p.setX(i, x * k); p.setY(i, y + dy); p.setZ(i, z * k);
  }
  closeEdges(g, phiStart, phiLen, inner);
  g.computeVertexNormals(); return g;
});
// toward the two front edges of hair hanging round the back and sides (beside the cheeks), its thickness thins away to
// nothing, down onto the inside surface against the head, so the edge closes neatly instead of showing the hair as a
// sheet folded back on itself with a gap beside the face. `inner` is that inside, [r, y] from the ends up to the crown
function closeEdges(g, phiStart, phiLen, inner) {
  if (!inner.length) return;
  const ins = inner.slice().sort((a, b) => a[1] - b[1]);
  const rIn = y => {
    if (y <= ins[0][1]) return ins[0][0];
    for (let k = 1; k < ins.length; k++) if (y <= ins[k][1]) { const [r0, y0] = ins[k - 1], [r1, y1] = ins[k]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0 || 1); }
    return ins[ins.length - 1][0];
  };
  const p = g.attributes.position, end = phiStart + phiLen, BAND = 0.5;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
    let phi = Math.atan2(x, z); if (phi < phiStart - 0.01) phi += Math.PI * 2;
    const d = Math.min(phi - phiStart, end - phi);
    if (d >= BAND || r < 1e-6) continue;
    const f = Math.max(0, d / BAND), ease = f * f * (3 - 2 * f), r0 = Math.min(r, rIn(y)), k = (r0 + (r - r0) * ease) / r;
    p.setX(i, x * k); p.setZ(i, z * k);
  }
}
// chunky curls, each its own lock: a tube, thick at the root and thin at the tip, falling from `root` by `len`, swinging
// out (`out`) by `flare` as it goes and winding `turns` times round itself as it falls, so the tip flicks out and up like
// a permed curl. All the locks of a style are merged into one piece (one draw for the whole head of curls)
const curlLocks = (key, locks) => geo(`locks3:${key}`, () => {
  const parts = locks.map(({ root, out, side, len, flare, turns, r0, lean = 0 }) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const s = i / 16, a = turns * Math.PI * 2 * s, rc = 0.01 * Math.min(1, s * 3);
      pts.push(root.clone().add(new THREE.Vector3(0, -len * s * (1 - 0.25 * s), 0))
        .addScaledVector(out, flare * s * s + rc * (1 - Math.cos(a)))
        .addScaledVector(side, lean * s + rc * Math.sin(a)));
    }
    const curve = new THREE.CatmullRomCurve3(pts), T = D(28, 8), RS = D(7, 4);
    const tube = new THREE.TubeGeometry(curve, T, r0, RS, false), p = tube.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= T; i++) {   // taper: thick at the root, a fine tip
      const s = i / T, k = s < 0.15 ? 0.75 + s / 0.15 * 0.25 : 1 - 0.7 * ((s - 0.15) / 0.85) ** 1.4;
      curve.getPointAt(s, c);
      for (let j = 0; j <= RS; j++) { const n = i * (RS + 1) + j; v.fromBufferAttribute(p, n).sub(c).multiplyScalar(k).add(c); p.setXYZ(n, v.x, v.y, v.z); }
    }
    const uv = tube.attributes.uv;   // strands running along the lock, not round it
    for (let n = 0; n < uv.count; n++) { const a = uv.getX(n), b = uv.getY(n); uv.setXY(n, b * 0.6, a); }
    tube.computeVertexNormals(); return tube;
  });
  const merged = BufferGeometryUtils.mergeBufferGeometries(parts); parts.forEach(t => t.dispose()); return merged;
});
// a fixed pseudo-random sequence for a style, so everyone with the same hair gets the same locks (and they're shared)
const seeded = key => { let h = 2166136261; for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };
// "tipped back by `tilt`": the crown direction leaning toward the back of the head
const crown = tilt => new THREE.Vector3(0, Math.cos(tilt), -Math.sin(tilt));
// the angle from a tipped crown that puts a shell's front edge at `elev` radians above the eyes' horizon
const coverFor = (tilt, elev) => Math.PI / 2 + tilt - elev;
// the first point straight back along -z from (x, y) in front of the face: z of the face surface there
const probe = new THREE.Raycaster(), probeO = new THREE.Vector3(), probeD = new THREE.Vector3(0, 0, -1);
const surfaceFor = shape => { const m = new THREE.Mesh(headGeo(shape), new THREE.MeshBasicMaterial()); m.updateMatrixWorld(); return (x, y) => { probe.set(probeO.set(x, y, 1), probeD); const h = probe.intersectObject(m)[0]; return h ? h.point.z : 0; }; };
const SURF = {};
// golden-angle directions over the whole sphere, used to scatter curls and spikes evenly
const fib = n => Array.from({ length: n }, (_, i) => { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996; return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); });
const FIB = fib(160);

// a colour as picked in the back office (an sRGB hex, as its swatch shows it) in the linear form the renderer works in:
// used as it is, the hex would come out lighter and greyer than picked
// (and brightened by PICK_GAIN, for the café's light, which brings a white surface out at only about 70%)
const PICK_GAIN = 2.0;
export const picked = hex => new THREE.Color(hex).convertSRGBToLinear().multiplyScalar(PICK_GAIN);
// detail: 1 for a close look (the back office's preview, the portraits), less for the café, whose people are small on
// screen and many: fewer segments in everything round, so far fewer triangles to draw and to cast shadows from
export function buildBody(look, seed = '', { detail = 1 } = {}) {
  const was = DETAIL; DETAIL = detail;
  try { return buildBodyAt(look, seed); } finally { DETAIL = was; }
}
function buildBodyAt(look, seed) {
  // a woman's body (0 a man's): how strongly her waist and seat show front to back, less on a fuller build (whose belly
  // and seat round on into each other, as a heavier figure's do)
  const femS = bodyOf(look) === 'female' ? Math.max(0.4, Math.min(1, 1 - (BUILDS[buildOf(look)].d - 1) * 1.2)) : 0;
  const f = faceOf(look, seed);
  const SH = shoeOf(look), tat = tattooOf(look);
  const C = { skin: picked(look.skin), hair: picked(look.hair), shirt: picked(look.shirt), pants: picked(look.pants), shoe: picked(SH.color) };
  const shape = HEADS[f.faceShape] ? f.faceShape : 'round', H = HEADS[shape];
  const g = new THREE.Group();
  const shade = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const skin = mat(C.skin, { roughness: 0.62 }), skinShade = mat(shade(C.skin, 0.86), { roughness: 0.62 });
  const pattern = (p => p === 'none' && clothesOf(look).style === 'denim' ? 'denim' : p)(clothesOf(look).pattern);   // (a denim jacket plain: denim)
  const shirt = patterned(mat(C.shirt, { roughness: 0.85 }), pattern, C.shirt), shirtDark = mat(shade(C.shirt, 0.72), { roughness: 0.85 });
  const shirtIn = mat(shade(C.shirt, 0.42), { roughness: 0.9, side: THREE.BackSide });   // the shadowed inside of a sleeve
  const shirtUnder = mat(shade(C.shirt, 0.35), { roughness: 1, side: THREE.DoubleSide });   // the inside of the shirt, seen under its hem
  const inkedSkin = (style, v, low) => (style ? mat(C.skin, { roughness: 0.6, map: tattooTex(style, v, low, typeof look.tattooText === 'string' ? look.tattooText : '') }) : skin);   // skin tattooed in a style, or bare
  const jeans = clothesOf(look).bottom === 'jeans';   // (牛仔褲: pants, in denim, with a jeans' stitching and pockets)
  const pants = jeans ? patterned(mat(C.pants, { roughness: 0.95 }), 'denim', C.pants) : mat(C.pants, { roughness: 0.9 }), pantsDark = mat(shade(C.pants, 0.78), { roughness: 0.9 });
  // hair with a little sheen; curls more (the wet, styled look), straight hair a soft gloss along its layers
  const hairM = mat(C.hair, { roughness: hairOf(look).curl === 'curly' ? 0.45 : 0.68, metalness: 0.05, map: strands(), side: THREE.DoubleSide });
  const shoe = mat(C.shoe, { roughness: 0.55 });
  const mk = (geom, m, x, y, z, par = g, shadow = true) => { const me = new THREE.Mesh(geom, m); me.position.set(x, y, z); me.castShadow = shadow; me.receiveShadow = shadow; par.add(me); return me; };

  // ---------------------------------------------------------------- legs and hips
  // the legs are LEG_EXTRA longer than first drawn (thigh and shin), the hips raised by that much and the torso
  // shortened to match, so shoulders, arms and head stay where every pose was tuned
  // (fit: 合身 slim, 窄 regular, 一般 loose, 寬 wide)
  // (三角內褲: just the seat, cut off at the tops of the legs, bare below; a dress (洋裝) is worn over whichever it is)
  const { bottom, fit } = clothesOf(look), loose = fit === 'loose', skirted = bottom === 'skirt', shorts = bottom === 'shorts', briefs = bottom === 'briefs', bareLegs = skirted || shorts || briefs;
  const dress = clothesOf(look).style === 'dress';
  const legM = bareLegs ? skin : pants;                   // bare legs under a skirt or shorts
  // wide legs: baggy all the way, flaring out to the hem (bare legs are just legs: the fit is the shorts' width)
  // (men's and women's wide legs are tuned separately: a man's hip-to-leg line has to fall straight from the seat)
  // (shorts are long trousers cut short: everything that shapes the trousers (pantsLike) shapes them too)
  const pantsLike = !skirted && !briefs, maleWide = fit === 'wide' && pantsLike && !femS, wideW = femS ? 1.52 : 1.15;
  // (LK: everyone's legs a little slimmer than first drawn, bare or in trousers, and the trousers with them)
  const LK = 0.95, WP = (fit === 'wide' ? wideW : { slim: 0.85, regular: 1, loose: femS ? 1.12 : 1.08 }[fit] || 1) * LK;   // (the trousers' legs' width)
  const W = bareLegs ? LK : WP, flare = fit === 'wide' && !shorts ? 0.086 * W + 0.002 : loose && !bareLegs ? 0.082 * W : 0.062 * W;   // (wide: straight down, barely wider at the hem than the knee)
  // shorts: the long trousers' own seat and legs, cut off a little above the knee in a turned-up hem, the knee and shin
  // bare below (a man's a shade roomier than his trousers where those would be as slim as the bare thigh inside them)
  const longPants = !bareLegs, femPants = femS > 0;   // (a woman's trousers: roomy at the top, drawn in to the knee)
  // (shorts: each fit clearly its own width from the waist on down, the seat and all, a wide pair much roomier than the
  // trousers, a slim one close)
  const SHW = femPants ? { slim: 1.08, regular: 1.3, loose: 1.46, wide: 1.66 } : { slim: 1.04, regular: 1.17, loose: 1.26, wide: 1.62 };
  const SW = { slim: 1.08, regular: 1.24, loose: 1.36, wide: 1.48 }[fit] || 1.24, TW = briefs ? (femPants ? 1.06 : 1.02) : (shorts ? SHW[fit] || SHW.regular : femPants ? SW : W / LK) * (femPants ? 1 : LK);   // (a woman's thighs as full as ever up top, round her hips, so her legs still meet at the crotch: only drawn in slimmer toward the knee)
  const bare = [];   // what shows skin when the pants come down (thighs, knees, hips)
  const bunch = [];  // the pants bunched round the shins, only seen then
  const cover = [];  // shorts' legs, gone when they come down
  const SK = socksOf(look), sockM = SK.style !== 'none' ? mat(picked(SK.color), { roughness: 0.95 }) : null, sockRib = sockM && mat(shade(picked(SK.color), 0.8), { roughness: 0.95 });
  const THIGH = 0.32, HIP_Y = 0.55 + LEG_EXTRA;
  // 牛仔褲's stitching: a darker seam with a line of golden-orange thread beside it (gone with the pants when they come down)
  const threadM = mat(0xa8906e, { roughness: 0.9 }), seamM = mat(shade(C.pants, 0.6), { roughness: 0.9 }), rivetM = mat(0xb8803e, { roughness: 0.3, metalness: 0.8 });
  const jtube = (key, pts, r, m, par) => { const me = mk(geo(`jeans24:${key}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), pts.length * 2, r, 4, false)), m, 0, 0, 0, par, false); cover.push(me); return me; };
  // (a man's wide legs meet at the crotch, so the seat runs on down into their inner sides, and hang a little apart from
  // there (LEG_SPLAY), two legs with a gap between them rather than merging into one)
  const wideLegX = 0.094, LEG_SPLAY = femS ? 0 : 0.034;
  const legX = fit === 'wide' && pantsLike ? wideLegX : 0.094;
  // (a man's legs, however slim his trousers, fill out toward the top until they just meet at the crotch, as real thighs
  // do, so the seat comes down onto them with no notch cut up between them; the legs themselves hang straight)
  const CROTCH_R = pantsLike && !femS ? legX * 0.985 : 0;
  const legs = [-legX, legX].map(x => {   // close enough that the tops of the thighs meet, so the crotch is just where the legs join
    const hip = new THREE.Group(); hip.position.set(x, HIP_Y, 0); g.add(hip);
    if (fit === 'wide' && pantsLike) hip.rotation.z = Math.sign(x) * LEG_SPLAY;
    // thigh and shin are open tubes meeting exactly at the knee at the same width, so a straight leg has no seam; a
    // slightly smaller ball fills the joint only when the knee bends
    // (wide-legged trousers hang straight down from the seat: no tapering in to the knee and out again to the hem, so
    // their outer line is one straight drop)
    // (a man's 一般 trousers straight-legged too, like wide ones, only less roomy)
    const straight = (fit === 'wide' || loose) && !bareLegs, kneeW = straight ? 0.086 : 0.074;
    const RK = kneeW * W, TK = 0.074 * TW, RKP = (fit === 'wide' || loose ? 0.086 : 0.074) * WP;   // (RKP: the trousers' knee, shorts or not)   // (the thigh's width at the knee: the shorts' there)
    // the thigh: rounded over its top, which sits up inside the hips, fullest just below them, tapering to the knee, so
    // the hips flow on down into the leg instead of a tube coming out from under them (profile from the knee up, faces out)
    // (a man's wide trousers keep the thigh full right up to the crotch, where the seat's sides are brought out to meet it
    // (see sideX0); above that it eases in, tucked inside the seat, so the two never fight at the surface)
    const thighAt = (w, st = false) => [[(st ? 0.086 : 0.074) * w, -THIGH], [(st ? 0.086 : 0.078) * w, -0.24], [(st ? 0.087 : 0.086) * w, -0.12], [0.09 * w, -0.06], [0.09 * w, -0.04], [0.088 * w, -0.005], [0.074 * w, 0.022], [0.044 * w, 0.042], [0.001, 0.05]].map(([r, y]) => [r * (maleWide ? 1 - 0.12 * smooth(-0.06, 0.02, y) : 1), y]).flatMap(([r, y], i, all) => {
      // (where a man's leg is slimmer than that, it draws in from the crotch's fullness to its own width in one long,
      // even curve most of the way down the thigh, in slices close enough to follow it: not all at once just under the
      // crotch, which left a slim leg hanging from a bulge with a corner in it)
      const full = (rr, yy) => (yy < 0 && CROTCH_R > rr ? rr + (CROTCH_R - rr) * smooth(-0.25, -0.04, yy) : rr), next = all[i + 1];
      if (!next || y >= -0.04 || CROTCH_R <= r) return [[full(r, y), y]];
      const n = Math.max(1, Math.round((next[1] - y) / 0.02)), out = [];
      for (let k = 0; k < n; k++) { const yy = y + (next[1] - y) * k / n; out.push([full(r + (next[0] - r) * k / n, yy), yy]); }
      return out;
    });
    // (a woman's finer round, so where it meets her seat runs smooth)
    const thigh = mk(flatLit(lathe(`thigh7:${W}:${straight}:${CROTCH_R}:${40}`, thighAt(W, straight), 40)), legM, 0, 0, 0, hip);
    if (!bareLegs) bare.push(thigh);
    let shortsLeg = null, longLeg = null, longR = null;
    // the trousers' leg over the thigh: a man's the thigh itself (above, in the pants); a woman's roomy at the top, one
    // surface with the seat, carried on down from the crotch and drawn in to the knee (so her trousers have a rounded
    // crotch, not the tight thigh's flat notch)
    const legProf = () => {
      if (!femPants) return thighAt(TW, fit === 'wide' || loose);
      const RL = 0.09 * TW, KN = RKP + 0.0012, lowY = [-THIGH, -0.3, -0.28, -0.26, -0.24, -0.22, -0.2, -0.18, -0.16, -0.14, -0.12, -0.1, -0.08, -0.06, -0.04];
      const low = lowY.map(y => { const u = Math.min(1, Math.max(0, (y + THIGH) / (THIGH - 0.04))), sm = u * u * (3 - 2 * u); return [KN + (RL - KN) * sm, y]; });
      return [...low, ...thighAt(TW).filter(([, y]) => y > -0.04)];
    };
    const profAt = prof => y => { for (let k = 1; k < prof.length; k++) if (prof[k][1] >= y) { const [r0, y0] = prof[k - 1], [r1, y1] = prof[k]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0.001; };
    if (shorts) {
      // the shorts' leg: the trousers' own, cut off a little above the knee, open there over the bare thigh (never closer
      // to it than a little way out), its hem turned up and its shadowed inside showing
      // (cut that high, though, they no longer draw in toward the knee as the trousers do: below the crotch they hang
      // straight on down from the seat (a man's near enough straight-legged however wide, a woman's flaring out a little to
      // the hem), a slim pair following the trousers in)
      const S0 = -0.262, full = legProf(), skinR = profAt(thighAt(LK)), rAt = profAt(full), R0 = rAt(-0.04), spread = (femPants ? { wide: 0.03, loose: 0.016, regular: 0.006 } : { wide: 0.004, loose: 0.002, regular: 0 })[fit] ?? -1;
      const ys = [S0, -0.24, -0.2, -0.16, -0.12, -0.08, ...full.map(([, y]) => y).filter(y => y >= -0.04)].sort((p, q) => p - q);
      const hang = y => (y < -0.04 ? Math.max(rAt(y), R0 + spread * Math.min(1, (-0.04 - y) / 0.22)) : rAt(y));
      const prof = ys.map(y => [y < 0.03 ? Math.max(hang(y), skinR(y) + 0.004) : hang(y), y]), rh = prof[0][0];
      const pantsIn = pants.clone(); pantsIn.side = THREE.DoubleSide; pantsIn.shadowSide = THREE.BackSide;   // (its back faces in the shadow map: no speckled self-shadowing on it)
      shortsLeg = mk(flatLit(lathe(`shorts15:${TW}:${fit}:${femPants}:${maleWide}`, prof, 40)), pantsIn, 0, 0, 0, hip); cover.push(shortsLeg);   // (both faces: its inside shows at the hem, in its own colour)
      cover.push(mk(cy(rh + 0.003, rh + 0.004, 0.018, 18, true), pantsDark, 0, S0 + 0.009, 0, hip, false));   // the turned-up hem
    } else if (longPants && femPants) {
      const prof = legProf();
      longR = profAt(prof);
      longLeg = mk(flatLit(lathe(`longLeg12:${TW}:${RKP}:40`, prof, 40)), pants, 0, 0, 0, hip);
      cover.push(longLeg);
    }
    const knee = new THREE.Group(); knee.position.set(0, -THIGH, 0); hip.add(knee);
    if (femS) { knee.scale.x = knee.scale.z = FEM.thigh.base; }   // (a woman's knee and calf as slim as her thigh is there)
    const kn = mk(sp(RK * 0.96, 16, 12), legM, 0, 0, 0, knee); if (!bareLegs) bare.push(kn);
    const b = mk(cy(0.088 * W, 0.082 * W, 0.09, 14), skirted ? mat(0xf2efe9, { roughness: 0.9 }) : pants, 0, -0.03, 0, knee, false); b.visible = false; bunch.push(b);
    // shin, down into the shoe (a bare one perhaps tattooed; the leg at -x is the person's right)
    // (bare, a real calf: knee-wide at the top, rounding over the calf and in to the ankle, no kink where it meets the knee)
    if (bareLegs) mk(lathe(`calf:${RK}`, [[0.052, -0.125], [0.0595 * LK, -0.06], [0.065 * LK, 0], [0.071 * LK, 0.07], [RK, 0.125]], 16), inkedSkin(tat[x < 0 ? 'rl' : 'll'], x < 0 ? 0 : 1), 0, -0.125, 0, knee);
    else mk(flatLit(cy(RK, flare, 0.25, 16, true)), legM, 0, -0.125, 0, knee);
    if (jeans) {
      // the outer seam down the leg (the thigh's and the shin's), and a deep cuff turned up to show the cloth's paler inside
      const sgn = Math.sign(x), prof = thighAt(W, straight);
      const rT = longR || (y => { for (let k = 1; k < prof.length; k++) if (prof[k][1] >= y) { const [r0, y0] = prof[k - 1], [r1, y1] = prof[k]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0.001; });
      const side = (r, y, da) => new THREE.Vector3(sgn * Math.cos(da) * r, y, Math.sin(da) * r);   // (round from the outside of the leg toward its front)
      for (const [da, m, rr, k] of [[0, seamM, 0.0017, 'o'], [0.085, threadM, 0.0011, 't']]) {
        const up = [], dn = [];
        for (let y = -THIGH; y <= -0.03; y += 0.02) up.push(side(rT(y) + 0.0012, y, da));
        jtube(`thighSeam${k}:${W}:${straight}:${sgn}`, up, rr, m, hip);
        for (let y = 0; y >= -0.196; y -= 0.028) dn.push(side(RK + (flare - RK) * (-y / 0.25) + 0.0012, y, da));
        jtube(`shinSeam${k}:${W}:${straight}:${sgn}:${fit}`, dn, rr, m, knee);
      }
      const cuffM = patterned(mat(new THREE.Color(C.pants).lerp(new THREE.Color(0xdfe6ee), 0.28), { roughness: 0.95 }), 'denim', C.pants);
      mk(cy(flare + 0.008, flare + 0.007, 0.05, 16, true), cuffM, 0, -0.222, 0, knee, false);
      const ring = (r, y, rr, m) => { const t = mk(geo(`jring:${r.toFixed(3)}:${rr}`, () => new THREE.TorusGeometry(r, rr, 4, 20)), m, 0, y, 0, knee, false); t.rotation.x = Math.PI / 2; return t; };
      ring(flare + 0.0085, -0.197, 0.0028, cuffM); ring(flare + 0.009, -0.204, 0.001, threadM);
    } else if (!bareLegs) mk(cy(flare + 0.006, flare + 0.006, 0.025, 14), pantsDark, 0, -0.225, 0, knee, false);   // turned-up hem
    // socks: only where they'd show, on a bare shin (a short one round the ankle, a long one up to under the knee, a
    // ribbed band at the top), and over the foot in slides
    // (in boots or high-tops only what rises above the shoe is drawn, so a short one is hidden in it altogether)
    const sockFrom = { boots: 0.07, hightop: 0.05, sneaker: 0.025, lowtop: 0.01 }[SH.style] || 0, sockTop = SK.style === 'long' ? 0.2 : 0.06;
    if (sockM && bareLegs && sockTop > sockFrom + 0.02) {
      const top = sockTop, h0 = sockFrom, rAt = h => 0.052 + (RK - 0.052) * (h / 0.25) + 0.004;   // h: up from the shin's foot
      mk(cy(rAt(top), rAt(h0), top - h0, 16, true), sockM, 0, -0.25 + (top + h0) / 2, 0, knee, false);
      mk(cy(rAt(top) + 0.002, rAt(top - 0.02) + 0.002, 0.02, 16, true), sockRib, 0, -0.25 + top - 0.01, 0, knee, false);
    }
    // (all of the trousers' leg below the knee marked as cloth, before the shoe goes on: a build makes it as much slimmer or
    // fuller all the way down to the hem, where the shoe and a bare calf ease back to as built; see the build below)
    if (!bareLegs) knee.traverse(o => { if (o.isMesh) o.userData.cloth = true; });
    buildShoe(SH.style, knee, mk, { shoe, skin: sockM || skin, light: SH_LIGHT, ankle: bareLegs });
    // a woman's thigh fuller toward the top, as her hips are, easing back to its own width at the knee (so the knee and
    // shin meet it as before): the thigh and all that's on it (the shorts' leg and hem, the jeans' seams), round the leg
    // (a man's too, but only the seat carried on down the backs of his thighs: his thighs keep their own width)
    if (femS || !skirted) hip.children.forEach(m => {
      if (!m.isMesh) return;
      const gm = m.geometry.clone(), p = gm.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const ly = p.getY(i) + m.position.y, lx = p.getX(i) + m.position.x, lz = p.getZ(i) + m.position.z, f = femS ? thighK(ly, true) : 1;
        // (and the seat's fullness carried on round under it, over the back of the thigh, as on the seat itself)
        // (as full as the seat is at the crotch, there, and going evenly down to nothing at the knee: one straight line from the
        // bottom of the seat to the back of the knee, no bulge of its own)
        const back = Math.max(0, -lz / (Math.hypot(lx, lz) || 1)), cy = PANTS_TOP.crotch - HIP_Y, lin = Math.min(1, Math.max(0, (ly + THIGH) / (THIGH + cy)));
        // (a man's: the seat's own curve simply carried on down, below the crotch, so its slope there runs on unbroken and it
        // fades away well above his knee)
        const out = femS ? buttAt(x + lx * f, PANTS_TOP.crotch, femS) * back * back * (3 - 2 * back) * lin : buttAt(x + lx, Math.min(PANTS_TOP.crotch, HIP_Y + ly), false) * back * back * (3 - 2 * back);
        p.setX(i, lx * f - m.position.x); p.setZ(i, lz * f * (femS ? thighD(ly, true) : 1) - out - m.position.z);
      }
      gm.computeVertexNormals(); if (m.geometry.userData.flatLit) { levelNormals(gm); gm.userData.flatLit = true; }
      m.geometry = gm;
    });
    return { hip, knee, thigh, shortsLeg, longLeg };
  });
  // hips: one piece from the waist splitting into the two legs, no join between them (separate hips and thighs leave a
  // line round the tops of the legs, like briefs)
  // under a crop top, whatever's worn below is high-waisted: the pants' own top carried on up over the bare skin to RISE
  // above the hips, close round the body (a woman's waist too), so less of the midriff shows
  // (a bikini top bares the midriff just as a crop top does: worn the same way, high-waisted)
  const RISE = 0.11, highWaist = (clothesOf(look).style === 'crop' || clothesOf(look).style === 'bra') && !briefs, femB = femS;
  const riseRows = highWaist && torsoRows(clothesOf(look).top, 'crop', femS);
  const riseAt = y => { for (let i = 1; i < riseRows.length; i++) if (riseRows[i][0] >= y) { const [ya, xa, za] = riseRows[i - 1], [yb, xb, zb] = riseRows[i], t = (y - ya) / (yb - ya || 1); return [xa + (xb - xa) * t, za + (zb - za) * t].map(r => r * 1.012 + 0.003); }
    // (below the torso's last slice: on down a woman's waist and hips, not straight)
    const [y0, x0, z0] = riseRows[0], a = femXZ(y, femB), b = femXZ(y0, femB);
    return [x0 * a[0] / b[0], z0 * a[1] / b[1]].map(r => r * 1.012 + 0.003); };
  const riseTop = 0.71 + RISE, up = highWaist ? { key: `${clothesOf(look).top}:${femS}`, top: riseTop, at: riseAt } : null;
  // (a man's wide trousers: the seat's two circles at the crotch on his legs, set wider apart, at their width there)
  // (and a man's trousers and shorts of every fit on their legs likewise, so no ledge shows across the front at the crotch)
  const seatLobe = pantsLike && !femS ? [legX, +(Math.max(0.09 * TW * (maleWide ? 1 - 0.12 * smooth(-0.06, 0.02, PANTS_TOP.crotch - HIP_Y) : 1), CROTCH_R) + 0.0015).toFixed(4)] : null;
  // (a man's trousers and shorts, whatever their fit: the seat in one line from the waist on down to the legs, at the
  // sides and in front and behind)
  const seat = mk(pantsTopGeo(TW, briefs ? 1 : fit === 'wide' ? 1.12 : loose ? 1.06 : 1, skirted ? null : up, femB, maleWide || (shorts && !femS) ? legX + Math.max(0.09 * TW, CROTCH_R) : null, (fit === 'wide' || loose) && pantsLike || pantsLike && !femS, seatLobe, briefs && !femS), pants, 0, 0, 0);   // (baggy pants and shorts are roomy through the seat too)
  if (up && !skirted) {   // (its top edge, rolled)
    const [tx, tz] = riseAt(riseTop), edge = mk(new THREE.TorusGeometry(tx, 0.0035, D(6, 3), D(40, 12)), pantsDark, 0, riseTop, 0, g, false);
    edge.rotation.x = Math.PI / 2; edge.scale.y = tz / tx; cover.push(edge);
  }
  bare.push(seat);
  // 三角內褲: cut high over the hips, a narrow strip left between the legs at the front and back: whatever of the seat
  // lies below the line rising from the crotch, front and back, to just under the waist at the sides is drawn up onto it
  if (briefs) {
    // (and under it the hips themselves, bare, where it no longer covers how the legs join the body)
    const hipSkin = mk(seat.geometry, skin, 0, 0, 0); hipSkin.scale.set(0.992, 1, 0.992);
    const bg = seat.geometry.clone(), bp = bg.attributes.position, { crotch } = PANTS_TOP, top = 0.69;
    // (column by column up the seat (its slices are rows of N + 1 points), everything below the line put exactly where the
    // column crosses it, so its edge runs clean along the surface)
    const NC = 161, NR = bp.count / NC, src = Float32Array.from(bp.array);
    const P = (r, c, k) => src[(r * NC + c) * 3 + k];
    for (let c = 0; c < NC; c++) {
      const side = Math.abs(Math.sin(Math.atan2(P(0, c, 0), P(0, c, 2)) || 0)), sideT = Math.abs(Math.sin((c / (NC - 1)) * Math.PI * 2));
      const cut = crotch + (top - crotch) * Math.min(1, Math.max(0, (sideT - 0.12) / 0.75)) ** 0.8;
      let r1 = 0; while (r1 < NR - 1 && P(r1, c, 1) < cut) r1++;
      if (r1 === 0) continue;
      const r0 = r1 - 1, t = Math.min(1, Math.max(0, (cut - P(r0, c, 1)) / (P(r1, c, 1) - P(r0, c, 1) || 1)));
      const at = [0, 1, 2].map(k => P(r0, c, k) + (P(r1, c, k) - P(r0, c, k)) * t);
      for (let r = 0; r < r1; r++) bp.setXYZ(r * NC + c, at[0], at[1], at[2]);
    }
    bg.computeVertexNormals(); seat.geometry = bg;
  }
  if (jeans) {
    // the seat's surface at angle a round the waist (0 the front, +pi/2 the person's left) and height y: as pantsTopGeo
    const kk = fit === 'wide' ? 1.12 : loose ? 1.06 : 1, { crotch, waist, rx, rz } = PANTS_TOP, hipX = seatLobe ? seatLobe[0] : PANTS_TOP.hipX, R = seatLobe ? seatLobe[1] : 0.0875 * TW * thighK(crotch - HIP_Y, femB);
    const sideScale = seat.geometry.userData.sideScale || (() => 1), frontScale = seat.geometry.userData.frontScale || (() => 1), backScale = seat.geometry.userData.backScale || (() => 1);
    const st = fit === 'wide' || loose, TP = [[(st ? 0.086 : 0.074) * W, -THIGH], [(st ? 0.086 : 0.078) * W, -0.24], [(st ? 0.087 : 0.086) * W, -0.12], [0.09 * W, -0.04], [0.088 * W, -0.005], [0.074 * W, 0.022], [0.044 * W, 0.042], [0.001, 0.05]];   // (the thigh's profile, as in the legs)
    const thighR = y => { if (y >= 0.05) return 0; for (let k = 1; k < TP.length; k++) if (TP[k][1] >= y) { const [r0, y0] = TP[k - 1], [r1, y1] = TP[k]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0; };
    const seatAt = (a, y, off) => {
      const t = (y - crotch) / (waist - crotch), tc = Math.min(1, t), e = femB ? (q => 0.5 * (1 - (1 - q) ** 1.6) + 0.5 * q * q * (3 - 2 * q))(tc) : tc * tc * (3 - 2 * tc), sx = Math.sin(a), sz = Math.cos(a), k2 = 1 + (kk - 1) * (1 - tc ** 4);
      let lb = (femB || seatLobe) && sz < 0 ? R * FEM.under * (q => q * q * (3 - 2 * q))(Math.min(1, -sz * 1.4)) * (q => (femB ? 0.5 + 0.5 * q : q))((q => q * q * (3 - 2 * q))(Math.max(0, Math.min(1, t / 0.45)))) : 0.004; [-hipX, hipX].forEach(cx => { const b = sx * cx, disc = b * b - cx * cx + R * R; if (disc >= 0) lb = Math.max(lb, b + Math.sqrt(disc)); });
      // (high-waisted: filled out to the body as pantsTopGeo does)
      // (and a woman's hips and seat, as there too)
      let ox = rx * (1 + hipAt(y, femB)), oz = femB ? TORSO[0][2] * 0.95 : rz;
      if (highWaist) { const [bx, bz] = riseAt(y), f = Math.min(1, Math.max(0, (Math.min(1, t) - 0.05) / 0.7)), ff = (q => (femB ? 0.5 + 0.5 * q : q))(f * f * (3 - 2 * f)); ox += (bx - ox) * ff; oz += (bz - oz) * ff; }
      const oval = 1 / Math.sqrt((sx / (ox * k2)) ** 2 + (sz / (oz * k2)) ** 2);
      // (or the thigh's, where it bulges out past the seat: low on the seat the backs of the thighs are the surface)
      const rt = thighR(y - HIP_Y) * thighK(y - HIP_Y, femB); let th = 0; [-hipX, hipX].forEach(cx => { const b = sx * cx, disc = b * b - cx * cx + rt * rt; if (disc >= 0) th = Math.max(th, b + Math.sqrt(disc)); });
      const d = Math.max((lb + (oval - lb) * e) * (1 + (sideScale(y) - 1) * sx * sx) * (1 + ((sz > 0 ? frontScale : backScale)(y) - 1) * sz * sz), th) + off;
      const seatOut = sz < 0 ? buttAt(sx * d, y, femB) : 0;
      const dz = 1 + (thighD(crotch - HIP_Y, femB) - 1) * (1 - e);
      return new THREE.Vector3(sx * d, y, sz * d * dz - seatOut + (sz < 0 ? cleftAt(sx * d, y, femB) : 0));
    };
    // a line over the seat through (a, y) points, finely resampled so it keeps to the surface
    const seatLine = (key, pts, off, r, m, closed = false) => {
      const all = closed ? [...pts, pts[0]] : pts, fine = [];
      for (let i = 0; i < all.length - 1; i++) { const [a0, y0] = all[i], [a1, y1] = all[i + 1], n = Math.max(1, Math.ceil(Math.hypot((a1 - a0) * 0.16, y1 - y0) / 0.006)); for (let k = 0; k < n; k++) fine.push(seatAt(a0 + (a1 - a0) * k / n, y0 + (y1 - y0) * k / n, off)); }
      const [a, y] = all[all.length - 1]; fine.push(seatAt(a, y, off));
      // (keyed by everything that shapes the seat: a woman's figure and high-waisted pants too, or one person's seams would
      // be reused on another's differently shaped seat, half of them inside it)
      return jtube(`${key}:${TW}:${kk}:${femB}:${highWaist ? up.key : ''}`, fine, r, m, seat);
    };
    const both = (key, pts, off = 0.0014) => { seatLine(key + 'o', pts, off, 0.0016, seamM); };
    const topY = highWaist ? 0.805 : 0.722;
    // (the side seams from right under the waistband: on high-waisted pants, up with it)
    const sideTop = highWaist ? 0.792 : 0.72;
    for (const s of [-1, 1]) {
      const A = a => s * a, B = a => Math.PI + s * a;   // (round from the front, or from the back, on this side)
      // down each hip from the waistband, on to the leg's own seam
      both(`side${s}`, [[A(Math.PI / 2), sideTop], [A(Math.PI / 2), 0.6]]);
      seatLine(`sideT${s}`, [[A(Math.PI / 2 - 0.06), sideTop], [A(Math.PI / 2 - 0.06), 0.6]], 0.0016, 0.0011, threadM);
      // the front pockets' curved mouths, a rivet at the bottom of each
      // (below the top's hem: a tee's rolled hem covers the waistband, and a pocket mouth starting above it
      // reads as a cut-off line; high-waisted pants carry the mouth up with the waistband, clear of its overhang)
      const py = highWaist ? 0.065 : 0;
      const pk = [[A(0.5), (highWaist ? 0.722 : 0.7) + py], [A(0.58), (highWaist ? 0.69 : 0.686) + py], [A(0.78), 0.665 + py], [A(1.08), 0.652 + py], [A(1.3), 0.65 + py]];
      both(`pocket${s}`, pk);
      seatLine(`pocketT${s}`, pk.map(([a, y]) => [a + s * 0.045, y - 0.006]), 0.0016, 0.0011, threadM);
      const rv = seatAt(A(1.3), 0.652 + py, 0.002); cover.push(mk(sp(0.0042, 8, 6), rivetM, rv.x, rv.y, rv.z, seat, false));
      // a patch pocket either side, out over each cheek, a point at the bottom
      // (on high-waisted pants, up with the waistband, over the fullest of the seat)
      const c = 0.72, hw = 0.38, P = [[B(c - hw), 0.668 + py], [B(c + hw), 0.672 + py], [B(c + hw * 0.9), 0.598 + py], [B(c), 0.578 + py], [B(c - hw * 0.9), 0.594 + py]];
      both(`back${s}`, P, 0.0022);
      seatLine(`backT${s}`, P.map(([a, y]) => [Math.PI + s * (c + (s * (a - Math.PI) - c) * 0.84), 0.627 + py + (y - 0.627 - py) * 0.82]), 0.0024, 0.0011, threadM, true);
    }
    both('backSeam', [[Math.PI, 0.72], [Math.PI, 0.63]]);
    // the fly: its J stitched down the front
    seatLine('fly', [[0.2, topY], [0.2, 0.672], [0.13, 0.655], [0.0, 0.65]], 0.0016, 0.0011, threadM);
    // the crotch seam: straight up the middle, its head at the button
    both('frontSeam', [[0.0, topY], [0.0, 0.645]]);
    if (highWaist) {
      const N = 64, pos = [], idx = [];
      for (let i = 0; i <= N; i++) for (const y of [0.792, 0.818]) {
        const p = seatAt((i / N) * Math.PI * 2, y, 0.0016);
        pos.push(p.x, p.y, p.z);
      }
      for (let i = 0; i < N; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, c, b, d); }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setIndex(idx); bg.computeVertexNormals();
      mk(bg, mat(0x2a2420, { roughness: 0.6, side: THREE.DoubleSide }), 0, 0, 0, seat, false);
      const buttonAt = seatAt(0.1, 0.805, 0.005);
      const button = mk(cy(0.01, 0.01, 0.0045, 16), silverM, buttonAt.x, buttonAt.y, buttonAt.z, seat, false);
      button.rotation.x = Math.PI / 2;
      for (const a of [-0.43, 0.43, -Math.PI / 2, Math.PI / 2, Math.PI]) {
        const p = seatAt(a, 0.797, 0.0022);
        mk(bx(0.008, 0.034, 0.003), pantsDark, p.x, p.y, p.z, seat, false).rotation.y = a;
      }
    }
  }
  // a skirt: knee length, A-line, hanging from the waist; a pivot at the waist so it can drape over the lap when sitting.
  // Its waistband sits tucked up inside the shirt (narrower than the shirt all round, front and back too) and it only
  // flares out below the shirt's hem, so none of it shows through the shirt
  // 洋裝: the same, but long and straight: in the top's own cloth, its colour and pattern, out over the hips and from there
  // straight down to below the knee, a touch wider at the hem; sitting, carried on over the knees and down the shins.
  // Whatever's worn beneath it (trousers, or bare legs) shows below its hem
  let skirt = null;
  if (skirted || dress) {
    skirt = new THREE.Group(); skirt.position.set(0, 0.72 + LEG_EXTRA, 0); g.add(skirt);
    const sm = dress ? patterned(mat(C.shirt, { roughness: 0.85, side: THREE.DoubleSide }), pattern, C.shirt) : mat(C.pants, { roughness: 0.85, side: THREE.DoubleSide });
    // (its width: a straight narrow skirt, the usual A-line, or full and flared; the waist the same in all)
    const F = dress ? 1 : { slim: 0.35, regular: 1, loose: 1.3, wide: 1.7 }[fit] || 1, flareTo = ([r, y]) => [0.185 + (r - 0.185) * F, y];
    // (under a fitted top, its waistband taken in to stay inside the narrower shirt)
    const tuck = clothesOf(look).top === 'slim' ? 0.92 : 1;
    // (high-waisted, under a crop top: its waistband up at RISE above the hips, round the body's own slices, the skirt
    // coming down over the hips from there into its usual line)
    // (over a woman's hips, as much fuller as they are)
    const Y0 = 0.72 + LEG_EXTRA, prof = (dress ? DRESS_HANG : [[0.185, -0.05], [0.19, -0.08], [0.215, -0.11], [0.24, -0.16], [0.266, -0.24], [0.288, -0.32], [0.284, -0.33]]).map(flareTo).map(([r, y]) => [r * (1 + hipAt(Y0 + y, femB)), y]);
    const [hx, hz] = highWaist ? riseAt(riseTop) : [0, 0], zK = Math.max(femB ? 0.88 : 0.78, highWaist ? hz / hx * 1.03 : 0);   // (a woman's deeper, clear of her seat behind)
    const hwProf = highWaist ? [[hx / tuck, riseTop - Y0], [riseAt(0.745)[0] / tuck, 0.745 - Y0], [Math.max(riseAt(0.715)[0] / tuck, prof[2][0] - 0.01), 0.715 - Y0], ...prof.slice(2)] : prof;
    // (a long dress, as deep as the body at the waist, rounding out lower down until it's nearly as deep as it is wide,
    // with room for the legs to step inside it)
    const hangGeo = lathe(`skirt5:${F}:${femB}:${dress}:${highWaist ? hwProf.map(p => p[0].toFixed(3)).join(',') : ''}`, hwProf, 28);
    const hang = mk(dress ? geo(`dressDeep:${femB}`, () => { const gm = hangGeo.clone(), q = gm.attributes.position; for (let i = 0; i < q.count; i++) { const t = Math.min(1, Math.max(0, (-0.1 - q.getY(i)) / 0.22)), e = t * t * (3 - 2 * t); q.setZ(i, q.getZ(i) * (1 + (0.97 / zK - 1) * e)); } gm.computeVertexNormals(); return gm; }) : hangGeo, sm, 0, 0, 0, skirt);
    hang.scale.set(tuck, 1, zK * tuck);
    // sitting, it's swapped for the same skirt drawn on the lap (see lapSkirtGeo), made for this build's thighs
    const B0 = BUILDS[buildOf(look)], lo = v => 1 + (v - 1) * 0.7;
    const lap = mk(lapSkirtGeo(F, tuck, lo(B0.w), lo(B0.d), dress ? DRESS_DROP : 0), sm, 0, 0, 0, skirt);
    lap.visible = false;
    skirt.userData = { hang, lap, long: dress, hangZ: hang.scale.z };   // (hangZ: its depth at rest, see people.js)
  }
  // the belt at the waist, just under the shirt's hem, its buckle on its front
  // (the waist is the same size whatever the cut, roomy through the seat or not, so the belt is too: snug on it)
  const BELT = clothesOf(look).top === 'slim' ? 0.95 : 1;   // (under a fitted top, a notch tighter, so it stays inside it)
  const belt = mk(cy(0.196, 0.196, 0.026, 22), beltM, 0, 0.708, 0, g, false); belt.scale.set(BELT, 1, 0.59 * BELT);
  const buckle = mk(bx(0.045, 0.024, 0.012), buckleM, 0, 0.707, 0.196 * 0.59 * BELT + 0.004, g, false);
  if (clothesOf(look).style === 'dress') belt.visible = buckle.visible = false;   // (a dress has no belt)
  if (highWaist || briefs) belt.visible = buckle.visible = false;   // (and none with just briefs)   // (high-waisted: the belt, at the old waist, would only be hidden in it)

  // ---------------------------------------------------------------- torso: waist, chest and sloping shoulders
  // waist, chest and shoulders close to the same width, so it isn't an inverted triangle; it starts higher, over the longer legs
  // slimmer side to side and deeper front to back than first drawn, so the arms hang closer in, and the shoulders
  // slope down from the neck in one long curve rather than squaring off
  // the shirt comes straight down to its hem over the top of the hips. Its slices are ovals, wider side to side than
  // front to back, and side to side it widens out at the top into the shoulders, so the slope from the neck runs
  // straight on into the arms with no join
  // cut slim, regular or oversized (wider and deeper, hanging lower over the hips)
  // (西裝外套(襯衫) is the same blazer, a shirt and tie worn beneath it instead of a tee)
  const fem = femS;   // (a woman's body: see FEM)
  const suitShirt = clothesOf(look).style === 'suit', topStyle = suitShirt ? 'coat' : clothesOf(look).style, bra = topStyle === 'bra';
  const topFit = bra ? 'regular' : clothesOf(look).top, TF = cutOf(topFit, topStyle);
  const winter = !!OUTER[topStyle], banded = topStyle === 'hoodie' || topStyle === 'jacket' || topStyle === 'varsity' || topStyle === 'denim';
  // the shirt and the bare skin of the neck share one surface; the skin one doesn't take the head's shadow, so the neck
  // and chest are the same colour as the face
  const torso = mk(torsoGeo(topFit, topStyle, fem), [shirt, hideM], 0, 0, 0);
  const torsoSkin = mk(torsoGeo(topFit, topStyle, fem), [hideM, skin], 0, 0, 0); torsoSkin.receiveShadow = false;
  // (a blazer's lining, seen where its fronts curve away)
  if (TF.slit) mk(torsoGeo(topFit, topStyle, fem), [mat(shade(C.shirt, 0.4), { roughness: 1, side: THREE.BackSide }), hideM], 0, 0, 0, g, false);
  // the hem: a rolled edge with some thickness to it, and underneath, the shirt's shadowed inside closing the gap down to
  // the hips, so it reads as cloth with body in it, not a shell
  // (a crop top's up at its own hem, the size of its slice there)
  const cropRow = TF.crop && torsoRows(topFit, topStyle, fem).find(([y]) => Math.abs(y - TF.crop) < 1e-6);
  // (otherwise round its bottom slice: a woman's narrowing there too)
  const hemRow = cropRow || torsoRows(topFit, topStyle, fem)[0];
  const hemY = cropRow ? cropRow[0] - 0.004 : 0.71 - TF.drop, hemR = hemRow[1], hemZ = hemRow[2] / hemRow[1];
  // (a blazer's hem only round the back and sides, open across the front)
  const hemGap = TF.slit || 0;
  const hem = bra ? null : mk(geo(`hemroll:${hemR.toFixed(3)}:${hemGap.toFixed(3)}`, () => new THREE.TorusGeometry(hemR, 0.008, D(6, 3), D(40, 12), Math.PI * 2 - 2 * hemGap).rotateZ(Math.PI / 2 + hemGap)), shirtDark, 0, hemY + 0.004, 0, g, false);
  if (hem) { hem.rotation.x = Math.PI / 2; hem.scale.y = hemZ; }
  // (what goes round the hem, drawn as an oval: fitted out over the top's own shape there, its seat too, below)
  const hemWear = hem ? [{ m: hem, rx: hemR, rz: hemR * hemZ }] : [];
  if (hem && clothesOf(look).style === 'dress') hem.visible = false;   // (a dress: top and skirt one piece, no hem between them)
  if (!bra && !TF.slit && !TF.crop) {   // (a blazer's hangs open over the legs: its lining shows instead; a crop top's over bare skin)
    const under = mk(geo(`hemunder:${hemR.toFixed(3)}`, () => new THREE.RingGeometry(0.16, hemR, 40)), shirtUnder, 0, hemY + 0.006, 0, g, false);
    under.rotation.x = Math.PI / 2; under.scale.y = hemZ;
  }
  if (bra) {
    const rows = torsoRows(topFit, topStyle, fem);
    const slice = y => { for (let i = 1; i < rows.length; i++) if (rows[i][0] >= y) { const [y0, x0, z0] = rows[i - 1], [y1, x1, z1] = rows[i], t = (y - y0) / (y1 - y0 || 1); return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]; } return rows[rows.length - 1].slice(1); };
    const frontZ = (x, y) => { const [rx, rz] = slice(y); return rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) + bustAt(x, y, TF, fem); };
    const backZ = (x, y) => { const [rx, rz] = slice(y); return -rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)); };
    const front = (x, y, off = 0.003) => new THREE.Vector3(x, y, frontZ(x, y) + off);
    const back = (x, y, off = 0.003) => new THREE.Vector3(x, y, backZ(x, y) - off);
    const cloth = patterned(mat(C.shirt, { roughness: 0.85 }), pattern, C.shirt); cloth.side = THREE.DoubleSide;
    const trim = mat(shade(C.shirt, 0.72), { roughness: 0.9, side: THREE.DoubleSide });
    const patch = (key, outline) => mk(geo(`brapatch2:${key}:${topFit}:${fem}`, () => {
      const tris = THREE.ShapeUtils.triangulateShape(outline.map(([x, y]) => new THREE.Vector2(x, y)), []);
      const pos = [], idx = [], seen = new Map();
      const vert = ([x, y]) => { const k = `${x.toFixed(4)},${y.toFixed(4)}`; if (!seen.has(k)) { seen.set(k, pos.length / 3); const p = front(x, y, 0.004); pos.push(p.x, p.y, p.z); } return seen.get(k); };
      tris.forEach(([i, j, k]) => {
        const A = outline[i], B = outline[j], Q = outline[k], len = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
        const n = Math.max(1, Math.ceil(Math.max(len(A, B), len(B, Q), len(Q, A)) / 0.012));
        const P = (a, b) => { const c = n - a - b; return [(A[0] * c + B[0] * a + Q[0] * b) / n, (A[1] * c + B[1] * a + Q[1] * b) / n]; };
        for (let a = 0; a < n; a++) for (let b = 0; b < n - a; b++) {
          idx.push(vert(P(a, b)), vert(P(a + 1, b)), vert(P(a, b + 1)));
          if (a + b < n - 1) idx.push(vert(P(a + 1, b)), vert(P(a + 1, b + 1)), vert(P(a, b + 1)));
        }
      });
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setIndex(idx); pg.computeVertexNormals(); return pg;
    }), cloth, 0, 0, 0, g, false);
    const edge = (key, pts) => mk(geo(`braedge2:${key}:${topFit}:${fem}`, () => {
      const fine = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.008));
        for (let k = 0; k < n; k++) fine.push(front(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, 0.005));
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fine, true, 'centripetal'), fine.length * 2, 0.0017, 5, true);
    }), trim, 0, 0, 0, g, false);
    // a triangle bikini top: a soft triangle over each breast, its point up under the strap, side by side in the middle;
    // a string from each point up round the back of the neck (a halter), and one from each outer corner round the back
    const cup = [[0.014, 0.996], [0.128, 0.998], [0.068, 1.138]];
    for (const s of [-1, 1]) {
      const outline = s > 0 ? cup.map(([x, y]) => [s * x, y]) : cup.map(([x, y]) => [s * x, y]).reverse();
      patch(`tri${s}`, outline); edge(`tri${s}`, outline);
    }
    // (and a string across the chest between them, from one cup's inner corner to the other's)
    mk(geo(`brabridge:${topFit}:${fem}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([-0.02, -0.01, 0, 0.01, 0.02].map(x => front(x, 0.997, 0.005)), false, 'centripetal'), 16, 0.0022, 5, false)), trim, 0, 0, 0, g, false);
    // (the halter: from the point of each cup up over the collarbone and round the side of the neck to meet behind it)
    const neckBack = new THREE.Vector3(0, 1.262, -0.058);
    for (const s of [-1, 1]) {
      const pts = [front(s * 0.068, 1.138, 0.005), front(s * 0.064, 1.18, 0.005), front(s * 0.06, 1.215, 0.005), new THREE.Vector3(s * 0.064, 1.252, 0.03), new THREE.Vector3(s * 0.062, 1.262, -0.022), new THREE.Vector3(s * 0.03, 1.264, -0.052), neckBack];
      mk(geo(`brahalter:${s}:${topFit}:${fem}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 64, 0.0022, 5, false)), trim, 0, 0, 0, g, false);
    }
    // (the band: from each cup's outer corner round the back, just under the bust, tied in the middle of the back)
    // (starting exactly on the corner: where round the slice its side-to-side reach is the corner's, whatever the build)
    const bandY = 0.997, [brx, brz] = slice(bandY), a0 = Math.asin(Math.min(1, 0.124 / brx)), band = [];
    for (let k = 0; k <= 64; k++) {
      const t = a0 + (Math.PI * 2 - 2 * a0) * k / 64, x = Math.sin(t) * brx, z = Math.cos(t) * brz + (Math.cos(t) > 0 ? bustAt(x, bandY, TF, fem) : 0), out = new THREE.Vector3(x, 0, z).normalize();
      band.push(new THREE.Vector3(x, bandY, z).addScaledVector(out, 0.004));
    }
    mk(geo(`braband3:${topFit}:${fem}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(band, false, 'centripetal'), 128, 0.0026, 5, false)), trim, 0, 0, 0, g, false);
    // (the ties: a little bow behind the neck and in the middle of the back)
    for (const [p, k] of [[neckBack, 'n'], [new THREE.Vector3(0, bandY, -brz - 0.006), 'b']]) for (const s of [-1, 1]) {
      const loop = mk(geo('brabow', () => new THREE.TorusGeometry(0.009, 0.0022, 5, 12)), trim, p.x + s * 0.008, p.y, p.z - 0.002, g, false); loop.scale.set(1, 0.6, 1);
    }
  }
  if (topStyle === 'tee' || topStyle === 'crop' || topStyle === 'dress') mk(neckRibGeo(topFit, topStyle), shirtDark, 0, 0, 0, g, false);   // a U neck, edged with a rolled rib (a shirt's collar sits there instead)
  // the turned-down collar: a shirt's, and (bigger, its points broader) a jacket's
  // (a blazer's collar is one piece with its lapels: built with them, below)
  // (西裝外套(襯衫): the shirt's own collar, worn under the blazer's, in the colour of what's worn beneath: a little
  // smaller so it sits inside the blazer's collar, and buttoned up close round the neck (`ring`: how much tighter than
  // the neckline it closes); its points closing over the tie's knot)
  const COLLAR = { shirt: { gap: 0.04, point: 1, size: 1, ring: 0.92 }, jacket: { gap: 0.1, point: 1.15, size: 1.3 }, denim: { gap: 0.13, point: 1.15, size: 1.25 }, suitShirt: { gap: 0.05, point: 0.95, size: 0.82, ring: 0.88 } }[suitShirt ? 'suitShirt' : topStyle];
  if (COLLAR) {
    const isShirt = topStyle === 'shirt';
    // (the collar's cloth: the top's own, or under a blazer the shirt's, plain)
    const colC = suitShirt ? picked(coatInnerOf(look).color) : C.shirt, colPat = suitShirt ? 'none' : pattern;
    const colDark = suitShirt ? mat(shade(colC, 0.72), { roughness: 0.85 }) : shirtDark;
    // 襯衫: a button-up shirt: a collar folding down either side of the neck to two points on the chest, a placket down
    // the middle and its buttons, all laid on the shirt's own front (its surface found from the cut's slices)
    const rows = torsoRows(topFit, topStyle, fem);
    const slice = y => { for (let i = 1; i < rows.length; i++) if (rows[i][0] >= y) { const [y0, x0, z0] = rows[i - 1], [y1, x1, z1] = rows[i], t = (y - y0) / (y1 - y0 || 1); return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]; } return rows[rows.length - 1].slice(1); };
    const surfZ = (x, y, back = 1) => { const [rx, rz] = slice(y); return rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) + (back > 0 ? bustAt(x, y, TF, fem) : 0); };   // (and a woman's bust, on the front)
    const on = (x, y, off) => new THREE.Vector3(x, y, surfZ(x, y) + off);
    const colM = patterned(shirt.clone(), colPat, colC); colM.side = THREE.DoubleSide;
    // the collar: one piece all the way round the neck, as a shirt's is: a stand rising from the neckline, folding over
    // and down outward onto the shoulders and back, and at the front coming down either side of the top button into two
    // points on the chest (a little gap between them). Each cross-section: up from the neckline, over, and down
    const N = 48, cross = [];
    // the height of the shirt's surface over a point (x, z): the highest slice that still takes it in
    // (the shirt's own rows only: those above the neckline are the neck flaring up into the head)
    const shirtTop = rows.findIndex(r => r[0] >= UNECK.neck - 1e-4);
    const surfY = (x, z) => { for (let i = shirtTop; i > 0; i--) { const [y, rx, rz] = rows[i]; if ((x / rx) ** 2 + (z / rz) ** 2 <= 1) { if (i === shirtTop) return y; const [y1, rx1, rz1] = rows[i + 1], e = (x / rx) ** 2 + (z / rz) ** 2, e1 = (x / rx1) ** 2 + (z / rz1) ** 2; return y + (y1 - y) * Math.min(1, (1 - e) / Math.max(1e-4, e1 - e)); } } return -1; };
    // the top's U neckline is wide for a shirt: its two fronts fill it, leaving only a narrow V open down to the top
    // button (the collar closed up close round the neck, its points nearly meeting: see COLLAR)
    // how far the neckline dips below the neck at x across the front: most under the throat, none by the sides
    const neckDip = x => 0.028 * Math.max(0, 1 - (x / 0.078) ** 2);
    if (isShirt) for (const sgn of [-1, 1]) {
      const R = 14, C = 6, fp = [], fi = [];
      for (let r = 0; r <= R; r++) {
        const y = UNECK.bot - 0.012 + (UNECK.neck - UNECK.bot + 0.012) * r / R;   // (up to the collar)
        const v = 0.002 + 0.006 * Math.max(0, (y - UNECK.bot + 0.008) / (UNECK.neck - UNECK.bot + 0.008)) ** 0.9, u = uHalf(Math.min(y, UNECK.neck)) + 0.008;
        // (each point no higher than the neckline's curve over it: above that is the throat)
        for (let c = 0; c <= C; c++) { const x = sgn * (v + (Math.max(u, v + 0.01) - v) * c / C), yy = Math.min(y, UNECK.neck - neckDip(x)); fp.push(x, yy, surfZ(x, yy) + 0.0025); }
      }
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const a = r * (C + 1) + c, b = a + C + 1; fi.push(a, a + 1, b, a + 1, b + 1, b); }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setIndex(fi); fg.computeVertexNormals();
      mk(fg, colM, 0, 0, 0, g, false);
    }
    const gap = COLLAR.gap;   // (the two ends parted over the open top button: the neckline's V, the throat showing)
    for (let i = 0; i <= N; i++) {
      const phi = gap + (Math.PI * 2 - 2 * gap) * i / N, sx = Math.sin(phi), sz = Math.cos(phi);
      // how near the front end this is: the points grow there, falling off evenly (a straight outer edge back from
      // each tip, so the points are sharp triangles, as a spread collar's are, not rounded)
      const fromFront = (phi <= Math.PI ? phi : Math.PI * 2 - phi) - gap;
      const front = COLLAR.point * Math.max(0, 1 - fromFront / 0.95);
      const back = Math.min(1, Math.max(0, 0.35 - sz) / 1.1) ** 0.8;   // and how much it's round the back
      // on the neckline: level round the back and sides, and in front curving down in a U under the throat (the way a
      // shirt's neck is cut), sat on the chest's own surface there
      const ring = COLLAR.ring || 1, [rx, rz] = slice(UNECK.neck), bx0 = sx * rx * 1.015 * ring;
      const yb = sz > 0 ? UNECK.neck - neckDip(bx0) : UNECK.neck;
      const bz0 = (sz > 0 ? Math.max(surfZ(bx0, yb), sz * rz) * 1.015 : sz * rz * 1.015) * ring;
      const Z = COLLAR.size, at = (k, dy, ox = 0) => new THREE.Vector3(bx0 * (1 + (k - 1) * Z) + Math.sign(sx) * ox * Z, yb + dy * Z, bz0 * (1 + (k - 1) * Z));
      // a stand up from the neckline all the way round (taller round the back of the neck, as a shirt's is, but seen in
      // front too, wrapping the throat), a rounded fold over its top, and the fall turned down outside it, hiding the
      // stand; in front the fall runs on down the chest into the two points, a narrow V between them.
      // Where the fall lies: over the shoulders and back, just clear of the shirt beneath; in front, along the chest's
      // own surface (lifting it there would stand the points out like flaps)
      // (eased in, not a sudden switch, so there's no crease where one gives way to the other; and in front only
      // drawn toward the chest, sitting a little off it, not pressed flat)
      const f1 = Math.min(1, front * 1.4), wF = f1 * f1 * (3 - 2 * f1) * 0.8;
      const lay = v => {
        const lifted = Math.max(v.y, surfY(v.x, v.z) + 0.01);
        v.y += (lifted - v.y) * (1 - wF);
        v.z += (surfZ(v.x, v.y) + 0.024 - v.z) * wF;
        // and wherever it ends up, never inside the shirt: out from its slice by at least the cloth's thickness
        if (v.y < UNECK.neck) {
          const [ex, ez] = slice(v.y), e = Math.sqrt((v.x / ex) ** 2 + (v.z / ez) ** 2), need = 1 + 0.009 / Math.min(ex, ez);
          if (e < need) { const s = need / Math.max(e, 1e-3); v.x *= s; v.z *= s; }
        }
        return v;
      };
      // the stand: standing up round the sides and back of the neck (lowest in front, where the neck shows); over its
      // top a rounded roll, and the fall hanging down from it, smooth and a little clear of the shirt rather than
      // pressed flat over the shoulders, ending not far below the neckline; in front it runs on down to the points
      const s = (0.007 + 0.016 * (1 - front) + 0.012 * back) * (COLLAR.stand || 1);
      // (and the fall always working outward from the roll, each point further out than the one before: drawn in
      // toward the chest, one could end up inside the fold, turning the collar inside out there in a dark slit)
      const outward = pts => { for (let j = 4; j < pts.length; j++) { const r0 = Math.hypot(pts[j - 1].x, pts[j - 1].z), r = Math.hypot(pts[j].x, pts[j].z); if (r < r0 + 0.003) { const k = (r0 + 0.003) / Math.max(r, 1e-4); pts[j].x *= k; pts[j].z *= k; } } return pts; };
      // (a shirt's stand never inside the neck or the shoulders beneath it: each point out from the slice at its height
      // by at least the cloth's thickness, so no skin shows through between the collar and the shirt)
      const clear = pts => { if (isShirt) for (let j = 1; j < 4; j++) { const v = pts[j], [ex, ez] = slice(v.y), e = Math.sqrt((v.x / ex) ** 2 + (v.z / ez) ** 2), need = 1 + 0.006 / Math.min(ex, ez); if (e < need) { const k = need / Math.max(e, 1e-3); v.x *= k; v.z *= k; } } return pts; };
      cross.push(clear(outward([
        // (a blazer's roll low and flat too, so it lies down round the neck into the lapels rather than standing up)
        // (a shirt's foot always out over the neckline, so no skin shows between it and the shirt, however close `ring`
        // draws the rest of it in round the neck; under a blazer it's out of sight, and set out like that it would poke
        // through the blazer's collar)
        isShirt ? new THREE.Vector3(bx0 / ring * 1.07, yb - 0.004, bz0 / ring * 1.07) : at(1, -0.008), at(1.0, s), at(1.018, s + 0.009 * (COLLAR.stand || 1)), at(1.05, s + 0.012 * (COLLAR.stand || 1)),
        // (in front, the drop from the roll down to the point an even curve)
        // (small points: not much longer or wider than the fall round the sides)
        lay(at(1.08 + 0.01 * front, s + 0.003 - 0.006 * front, 0.002 * front)),
        lay(at(1.105 + 0.03 * front, s - 0.013 - 0.006 * front, 0.007 * front)),
        lay(at(1.13 + 0.05 * front, s - 0.027 - 0.006 * front, 0.016 * front)),
      ])));
    }
    const pos = [], idx = [], M = cross[0].length;
    cross.forEach(c => c.forEach(v => pos.push(v.x, v.y, v.z)));
    for (let i = 0; i < N; i++) for (let j = 0; j < M - 1; j++) { const a0 = i * M + j, b0 = a0 + M; idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setIndex(idx); cg.computeVertexNormals();
    // its outside in the shirt's cloth, its inside (seen at the open neck, and under the fold) a shade darker, the way the
    // inside of a collar sits in shadow
    // (the strip is wound so its outside is the back face)
    // (a blazer's in the same cloth as its lapels, a shade deeper than the body, so the two read as one piece)
    const colTone = topStyle === 'coat' && !suitShirt ? 0.92 : 1;
    const colOut = patterned(mat(shade(colC, colTone), { roughness: 0.85 }), colPat, shade(colC, colTone)); colOut.side = THREE.BackSide;
    mk(cg, colOut, 0, 0, 0, g, false);
    mk(cg, mat(shade(colC, 0.8), { roughness: 0.9, side: THREE.FrontSide }), 0, 0, 0, g, false);
    // its edges drawn in a thin darker seam (round the fall, and down each front to its point), so the turned-down collar
    // reads against the shirt beneath it
    const seam = (key, ptsList, r = 0.0022) => mk(geo(key, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ptsList), ptsList.length * 3, r, 5, false)), colDark, 0, 0, 0, g, false);
    const tag = `${topFit}:${TF.drop}:${topStyle}${suitShirt ? ':suit' : ''}:${fem}`;
    // (one unbroken line: up one front from the roll to its point, round the whole outer edge, and back up the other
    // front, so the points' corners join and it's the same weight all the way; centripetal, so it doesn't loop at them)
    const edgePath = [...cross[0].slice(3), ...cross.slice(1, N).map(c => c[M - 1]), ...cross[N].slice(3).reverse()];
    mk(geo(`colEdge2:${tag}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePath, false, 'centripetal'), edgePath.length * 4, 0.0018, 5, false)), colDark, 0, 0, 0, g, false);
    // and each front end of the collar closed, as it's sewn: otherwise one looks into the fold, through to the neck
    const capM = patterned(mat(shade(colC, colTone), { roughness: 0.85 }), colPat, shade(colC, colTone)); capM.side = THREE.DoubleSide;
    for (const e of [cross[0], cross[N]]) {
      const cp = [], ci = []; e.forEach(v => cp.push(v.x, v.y, v.z));
      for (let j = 1; j < 4; j++) ci.push(0, j, j + 1);   // (just the hollow under the roll: the point below it hangs free)
      const capG = new THREE.BufferGeometry(); capG.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); capG.setIndex(ci); capG.computeVertexNormals();
      mk(capG, capM, 0, 0, 0, g, false);
    }
    if (isShirt) {
    const hemTop = 0.71 - TF.drop + 0.02, buttonM = mat(0xf4f1ea, { roughness: 0.4 });
    // the placket: the shirt's own cloth (a touch deeper, being doubled), in short lengths following the curve of the
    // front, a line of stitching down each edge, as a real one is, rather than a dark band
    const placketM = patterned(mat(shade(C.shirt, 0.93), { roughness: 0.85 }), pattern, shade(C.shirt, 0.93));
    for (let y = 1.2; y > hemTop; y -= 0.04) {
      const a = on(0, y, 0.003), b = on(0, Math.max(hemTop, y - 0.04), 0.003), mid = a.clone().add(b).multiplyScalar(0.5);
      const strip = mk(bx(0.026, a.distanceTo(b) + 0.002, 0.003), placketM, mid.x, mid.y, mid.z, g, false);
      strip.rotation.x = Math.atan2(a.z - b.z, a.y - b.y);
    }
    for (const sgn of [-1, 1]) {
      const st = []; for (let y = 1.2; y > hemTop - 1e-4; y -= 0.03) st.push(on(sgn * 0.0115, Math.max(hemTop, y), 0.0049));
      seam(`placketSt${sgn}:${tag}`, st, 0.001);
    }
    // round the back: the yoke's seam across the shoulder blades (dipping a little to the middle), and under it a short
    // box pleat down the centre
    const yokeAt = (t, y) => { const [ex, ez] = slice(y); return new THREE.Vector3(Math.sin(t) * ex * 1.006, y, Math.cos(t) * ez * 1.006); };
    const yoke = []; for (let s = 0; s <= 24; s++) { const t = Math.PI * (0.62 + 0.76 * s / 24); yoke.push(yokeAt(t, 1.17 + 0.008 * Math.cos(t))); }
    seam(`yoke:${tag}`, yoke, 0.0013);
    for (const dx of [-0.014, 0.014]) {
      const pl = []; for (let y = 1.162; y > 1.07; y -= 0.015) { const [ex, ez] = slice(y); pl.push(new THREE.Vector3(dx, y, -ez * Math.sqrt(Math.max(0, 1 - (dx / ex) ** 2)) * 1.006)); }
      seam(`pleat${dx}:${tag}`, pl, 0.0011);
    }
    for (let y = 1.16; y > hemTop + 0.03; y -= 0.085) { const p = on(0, y, 0.006); mk(sp(0.0065, 8, 6), buttonM, p.x, p.y, p.z, g, false).scale.z = 0.4; }
    }
  }
  const lightTop = new THREE.Color(look.shirt).getHSL({}).l > 0.6;
  // a varsity jacket's sleeves (and its letter, its stripes) in a second colour: cream on a dark body, navy on a light one
  const trimC = picked(lightTop ? 0x1f2a44 : 0xece3cf), trimM = mat(trimC, { roughness: 0.5 });
  const sleeveCloth = topStyle === 'varsity' ? trimM : shirt;
  // knitted rib for the hem bands and cuffs of the 帽T and jackets
  const ribM = topStyle === 'denim'   // (a denim jacket's band and cuffs: its own cloth, a shade deeper, being doubled)
    ? (() => { const m = patterned(mat(shade(C.shirt, 0.9), { roughness: 0.9 }), pattern, shade(C.shirt, 0.9)); m.side = THREE.DoubleSide; return m; })()
    : (() => { const t = ribs().clone(); t.repeat.set(26, 1); t.needsUpdate = true; return mat(shade(C.shirt, 0.82), { roughness: 0.95, map: t, side: THREE.DoubleSide }); })();
  const jThread = mat(0xa8906e, { roughness: 0.9 }), jButton = mat(0xa88552, { roughness: 0.3, metalness: 0.75 });   // (a denim jacket's thread, its metal buttons)
  // ---------------------------------------------------------------- the winter tops: 帽T, 夾克, 西裝外套, 棒球外套
  // (all laid on the top's own surface, as the shirt's collar and placket are: each point found from the cut's slices)
  if (winter) {
    const rows = torsoRows(topFit, topStyle, fem), tag = `${topFit}:${topStyle}:${fem}`;
    const slice = y => { for (let i = 1; i < rows.length; i++) if (rows[i][0] >= y) { const [y0, x0, z0] = rows[i - 1], [y1, x1, z1] = rows[i], t = (y - y0) / (y1 - y0 || 1); return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]; } return rows[rows.length - 1].slice(1); };
    const surfZ = (x, y, back = 1) => { const [rx, rz] = slice(y); return rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) + (back > 0 ? bustAt(x, y, TF, fem) : 0); };   // (and a woman's bust, on the front)
    // (`off` how far out from the surface: a number, or a function of (x, y) for something with body to it)
    const on = (x, y, off, back = 1) => new THREE.Vector3(x, y, back * (surfZ(x, y, back) + (typeof off === 'function' ? off(x, y) : off)));
    const neckDip = x => 0.028 * Math.max(0, 1 - (x / 0.078) ** 2);
    const cloth = (k = 1) => { const m = patterned(mat(shade(C.shirt, k), { roughness: 0.85 }), pattern, shade(C.shirt, k)); m.side = THREE.DoubleSide; return m; };
    const darkLine = mat(shade(C.shirt, 0.55), { roughness: 0.9 });
    // a flat piece of cloth over the front (or back) of the top: an outline in (x, y), filled and cut fine enough to
    // follow the curve of the body, `off` out from it
    const patch = (key, outline, off, m, back = 1) => mk(geo(`wpatch:${key}:${tag}`, () => {   // (a varying `off` must be the same function for the same key)
      const tris = THREE.ShapeUtils.triangulateShape(outline.map(([x, y]) => new THREE.Vector2(x, y)), []);
      const pos = [], idx = [], seen = new Map();
      const vert = ([x, y]) => { const k = `${x.toFixed(4)},${y.toFixed(4)}`; if (!seen.has(k)) { seen.set(k, pos.length / 3); const p = on(x, y, off, back); pos.push(p.x, p.y, p.z); } return seen.get(k); };
      tris.forEach(([i, j, k]) => {
        const A = outline[i], B = outline[j], Q = outline[k], len = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
        const n = Math.max(1, Math.ceil(Math.max(len(A, B), len(B, Q), len(Q, A)) / 0.012));
        const P = (a, b) => { const c = n - a - b; return [(A[0] * c + B[0] * a + Q[0] * b) / n, (A[1] * c + B[1] * a + Q[1] * b) / n]; };
        for (let a = 0; a < n; a++) for (let b = 0; b < n - a; b++) {
          idx.push(vert(P(a, b)), vert(P(a + 1, b)), vert(P(a, b + 1)));
          if (a + b < n - 1) idx.push(vert(P(a + 1, b)), vert(P(a + 1, b + 1)), vert(P(a, b + 1)));
        }
      });
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setIndex(idx); pg.computeVertexNormals(); return pg;
    }), m, 0, 0, 0, g, false);
    // a line along the surface (a seam, an edge, a zip): resampled finely so it keeps to the curve
    const line = (key, pts, off, r, m, closed = false, back = 1) => mk(geo(`wline:${key}:${tag}`, () => {
      const fine = [], all = closed ? [...pts, pts[0]] : pts;
      for (let i = 0; i < all.length - 1; i++) { const [x0, y0] = all[i], [x1, y1] = all[i + 1], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.01)); for (let k = 0; k < n; k++) fine.push(on(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, off, back)); }
      if (!closed) { const [x, y] = all[all.length - 1]; fine.push(on(x, y, off, back)); }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fine, closed, 'centripetal'), fine.length * 2, r, 5, closed);
    }), m, 0, 0, 0, g, false);
    const mirror = pts => pts.map(([x, y]) => [-x, y]).reverse();
    // the U neck closed up with the top's own cloth (or, under a coat, what's worn beneath): from `open(y)` out to the U's
    // edge either side, no higher than the neckline's curve
    const fillU = (key, m, open = () => 0, upto = () => Infinity) => {   // (upto(y): no further out than this)
      for (const sgn of [-1, 1]) mk(geo(`wfillU:${key}:${sgn}:${tag}`, () => {
        const R = 14, Cn = 6, fp = [], fi = [];
        for (let r = 0; r <= R; r++) {
          const y = UNECK.bot - 0.012 + (UNECK.neck - UNECK.bot + 0.012) * r / R, v = open(y), u = Math.min(upto(y), uHalf(Math.min(y, UNECK.neck)) + 0.008);
          for (let c = 0; c <= Cn; c++) { const x = sgn * (v + (Math.max(u, v + 0.01) - v) * c / Cn), yy = Math.min(y, UNECK.neck - neckDip(x)); fp.push(x, yy, surfZ(x, yy) + 0.0025); }
        }
        for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) { const a = r * (Cn + 1) + c, b = a + Cn + 1; fi.push(a, a + 1, b, a + 1, b + 1, b); }
        const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setIndex(fi); fg.computeVertexNormals(); return fg;
      }), m, 0, 0, 0, g, false);
    };
    // a cord from a to b (a drawstring)
    const rod = (a, b, r, m) => { const d = b.clone().sub(a), c = mk(cy(r, r, 1, 6), m, 0, 0, 0, g, false); c.position.copy(a).add(b).multiplyScalar(0.5); c.scale.y = d.length(); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return c; };
    const bandH = topStyle === 'denim' ? 0.045 : 0.055;
    if (banded) {
      // a ribbed band round the hem, snug, straight up and down (wide enough to take in the hem's flare under it)
      const [hx, hz] = slice(hemY), [tx, tz] = slice(hemY + bandH), bR = Math.max(hx, tx) + 0.006, bZ = (Math.max(hz, tz) + 0.006) / bR;
      const band = mk(cy(bR, bR, bandH, 32, true), ribM, 0, hemY + bandH / 2 - 0.004, 0, g, false); band.scale.z = bZ; hemWear.push({ m: band, rx: bR, rz: bR * bZ, gap: 0.006 });
      const roll = mk(geo(`wbandroll:${bR.toFixed(3)}`, () => new THREE.TorusGeometry(bR, 0.006, D(6, 3), D(40, 12))), ribM, 0, hemY - 0.004, 0, g, false);
      roll.rotation.x = Math.PI / 2; roll.scale.y = bZ; hemWear.push({ m: roll, rx: bR, rz: bR * bZ, gap: 0.006 });
      if (topStyle === 'varsity') for (const dy of [0.018, 0.032]) {   // its two stripes
        const st = mk(geo(`wstripe:${bR.toFixed(3)}`, () => new THREE.TorusGeometry(bR + 0.001, 0.0035, D(5, 3), D(40, 12))), trimM, 0, hemY + dy, 0, g, false);
        st.rotation.x = Math.PI / 2; st.scale.set(1, bZ, 0.5); hemWear.push({ m: st, rx: bR + 0.001, rz: (bR + 0.001) * bZ, gap: 0.011 });
      }
    }
    const bandTop = hemY + (banded ? bandH : 0.01);
    if (topStyle === 'hoodie') {
      // 帽T: a U neck, and the hood down round it as a real one sits: not lying flat but a soft, full bulk of cloth
      // behind the neck (not so tall it reads as a turtleneck), lower round the sides, and coming down to a thin edge in
      // front where its two sides cross under the throat. Each slice round the neck is a hump: up from the
      // neckline beside the neck, over a rounded top, and down its outside onto the shoulders and back. A seam runs up
      // its middle; drawstrings from the front, the kangaroo pocket across the middle
      // (its neck a U, as a tee's, the neck and a little chest showing; the hood's edge runs round it)
      const hoodM = cloth(0.96);
      const N = 72, Q = 14;
      // the neckline it sits on: from the bottom of the U in front, up its right side, round the back of the neck and
      // down its left side, evenly spaced along its length
      const nRows = rows.filter(([y]) => y >= UNECK.bot - 1e-4 && y <= UNECK.neck + 1e-4);
      const uSide = sgn => nRows.map(([y, ex, ez]) => { const t = uAngle(y, ex); return new THREE.Vector3(sgn * Math.sin(t) * ex, y, Math.cos(t) * ez); });
      const [ty, tx, tz] = nRows[nRows.length - 1], t0 = uAngle(ty, tx), ring = [new THREE.Vector3(0, UNECK.bot, nRows[0][2]), ...uSide(1)];
      for (let k = 1; k < 24; k++) { const t = t0 + (2 * Math.PI - 2 * t0) * k / 24; ring.push(new THREE.Vector3(Math.sin(t) * tx, ty, Math.cos(t) * tz)); }
      ring.push(...uSide(-1).reverse(), ring[0].clone());
      const neckline = new THREE.CatmullRomCurve3(ring, false, 'centripetal').getSpacedPoints(N);
      // (nothing of it inside the neck as it flares up into the head, nor inside the head and its hair: kept just outside
      // both, so the peak behind the head shows)
      const HEAD_Y = 1.44, HEAD_R = 0.195;
      const clear = p => {
        if (p.y > UNECK.neck) { const [nx, nz] = slice(p.y), e = Math.hypot(p.x / nx, p.z / nz), need = 1 + 0.008 / Math.min(nx, nz); if (e < need) { const k = need / Math.max(e, 1e-3); p.x *= k; p.z *= k; } }
        const dy = p.y - HEAD_Y;
        if (Math.abs(dy) < HEAD_R) { const hr = Math.sqrt(HEAD_R * HEAD_R - dy * dy), d = Math.hypot(p.x, p.z); if (d < hr) { const k = hr / Math.max(d, 1e-3); p.x *= k; p.z *= k; } }
        return p;
      };
      const profile = [];   // per slice, its points from inside to out
      neckline.forEach(base => {
        base = base.clone().multiply(new THREE.Vector3(1.01, 1, 1.01));
        const yb = base.y, sz = base.z / Math.hypot(base.x, base.z);
        const b = ((1 - sz) / 2) ** 1.3;                             // 0 at the bottom of the U, 1 straight behind
        // how tall the hump and how far out it reaches: full behind, lower beside the neck, and in front no hump at all,
        // just the hood's edge lying round the U like a tee's rib
        // how tall the roll round the neck (low: lying, not a stand), how far out it reaches, and how far the hood's
        // body hangs on down the back below it to its tip (most straight behind, so its lower edge is a rounded U)
        const w = (1 - sz) / 2, H = 0.006 + 0.05 * w ** 2.4, Dp = 0.015 + 0.064 * w ** 1.5, drop = 0.008 + 0.14 * w ** 3;
        const [ex, ez] = slice(yb), n = new THREE.Vector3(base.x / (ex * ex), 0, base.z / (ez * ez)).normalize();
        const P = (u, v) => clear(base.clone().addScaledVector(n, u).add(new THREE.Vector3(0, v, 0)));
        // how far out along n the top's surface is at a height (the back slopes out as it goes down)
        const surfU = y => { const [sx2, sz2] = slice(y); for (let u = 0; u < 0.25; u += 0.002) { const q = base.clone().addScaledVector(n, u); if ((q.x / sx2) ** 2 + (q.z / sz2) ** 2 >= 1) return u; } return 0.25; };
        // its outside: lying on the top all the way down (a cloth's thickness off it, thinning to its edge), never in it
        const lie = (v, off, atLeast) => P(Math.max(atLeast, surfU(yb + v) + off), v);
        profile.push([
          P(-0.002, -0.006), P(0.002, H * 0.45), P(0.008 + Dp * 0.06, H * 0.85), P(Dp * 0.32, H), P(Dp * 0.65, H * 0.9),
          lie(H * 0.45, 0.021, Dp * 0.95), lie(-drop * 0.3, 0.021, Dp), lie(-drop * 0.65, 0.018, 0), lie(-drop * 0.9, 0.012, 0), lie(-drop, 0.006, 0),
        ]);
      });
      const hood = geo(`whood13:${tag}`, () => {
        const pos = [], idx = [], M = profile[0].length;
        profile.forEach(pr => {
          // (smoothed through its points, so the hump is round)
          new THREE.CatmullRomCurve3(pr, false, 'centripetal').getPoints(Q).forEach(v => { clear(v); pos.push(v.x, v.y, v.z); });
        });
        for (let i = 0; i < N; i++) for (let q = 0; q < Q; q++) { const a = i * (Q + 1) + q, d = a + Q + 1; idx.push(a, d, a + 1, d, d + 1, a + 1); }
        const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); q.setIndex(idx); q.computeVertexNormals(); return q;
      });
      mk(hood, hoodM, 0, 0, 0, g).receiveShadow = false;
      // the seam up the middle of its back, and its edge (the face opening) a shade deeper
      const back = profile[N / 2];
      mk(geo(`whoodSeam13:${tag}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(back.map(v => v.clone().multiply(new THREE.Vector3(1, 1, 1.012)).add(new THREE.Vector3(0, 0, -0.002))), false, 'centripetal'), 40, 0.0014, 5, false)), shirtDark, 0, 0, 0, g, false);
      mk(geo(`whoodEdge13:${tag}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(profile.slice(0, N).map(pr => new THREE.CatmullRomCurve3(pr, false, 'centripetal').getPoint(0.22)), true), N * 2, 0.0048, 6, true)), shirtDark, 0, 0, 0, g, false);
      // and its lower edge, where it lies on the back, picked out in a deeper line so it reads as a layer
      mk(geo(`whoodHem13:${tag}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(profile.slice(0, N).map(pr => pr[pr.length - 1].clone()), true), N * 2, 0.0042, 5, true)), shirtDark, 0, 0, 0, g, false);
      const cordM = mat(lightTop ? shade(C.shirt, 0.5) : picked(0xf1ede4), { roughness: 0.7 });
      for (const s of [-1, 1]) {
        const a = on(s * 0.038, UNECK.bot + 0.008, 0.014), b = on(s * 0.04, UNECK.bot - 0.13, 0.009);   // (from the hood's edge either side of the U)
        rod(a, b, 0.0028, cordM); mk(cy(0.0036, 0.0036, 0.016, 6), cordM, b.x, b.y - 0.006, b.z, g, false);   // and its aglet
      }
      const pb = bandTop + 0.025, pt = pb + 0.15, pocket = [[-0.135, pb], [0.135, pb], [0.1, pt], [-0.1, pt]];
      patch('pocket', pocket, 0.004, cloth(0.98));
      line('pocketEdge', pocket, 0.0045, 0.0018, shirtDark, true);
      for (const s of [-1, 1]) line(`pocketMouth${s}`, [[s * 0.135, pb + 0.005], [s * 0.1, pt - 0.005]], 0.006, 0.0032, darkLine);   // its openings, shadowed
    }
    if (topStyle === 'jacket') {
      // 夾克: zipped up to a turned-down collar (a shirt's, bigger: see COLLAR); slanting welt pockets either side, a
      // yoke seam across the chest
      fillU('jacket', cloth());
      const zipM = mat(0x2b2b2e, { roughness: 0.35, metalness: 0.6 });
      line('zip', [[0, UNECK.neck - 0.028], [0, bandTop - 0.01]], 0.004, 0.0028, zipM);
      const tab = on(0, UNECK.neck - 0.045, 0.008); mk(bx(0.009, 0.022, 0.004), zipM, tab.x, tab.y, tab.z, g, false);
      for (const s of [-1, 1]) {
        const y0 = bandTop + 0.03;
        line(`welt${s}`, [[s * 0.11, y0], [s * 0.15, y0 + 0.1]], 0.004, 0.0042, darkLine);
        line(`yoke${s}`, [[s * 0.012, 1.1], [s * 0.16, 1.1]], 0.003, 0.0016, shirtDark);
      }
    }
    if (topStyle === 'denim') {
      // 牛仔外套: buttoned up to a turned-down collar (see COLLAR), all its seams sewn in golden-orange thread: the placket
      // down the front, a pointed yoke across the chest, two flap pockets on it (a button on each flap), seams down from
      // them to the band; across the back a pointed yoke and two seams down. Metal buttons; the band buttoned too
      fillU('denim', cloth());
      const T = (key, pts, off = 0.0045, back = 1, closed = false) => line(key, pts, off, 0.001, jThread, closed, back);
      const button = (x, y, back = 1) => { const p = on(x, y, 0.006, back); const b = mk(cy(0.0085, 0.0085, 0.004, 12), jButton, p.x, p.y, p.z, g, false); b.rotation.x = Math.PI / 2; };
      line('dplacket', [[0.018, UNECK.bot - 0.004], [0.018, bandTop - 0.01]], 0.003, 0.0016, darkLine);
      T('dplacketT', [[0.011, UNECK.bot - 0.004], [0.011, bandTop + 0.004]]);
      T('dplacketT2', [[0.026, UNECK.bot - 0.004], [0.026, bandTop + 0.004]]);
      for (let y = UNECK.bot - 0.03; y > bandTop + 0.03; y -= 0.072) button(0, y);
      button(0, hemY + bandH / 2 - 0.004);
      for (const s of [-1, 1]) {
        // the chest yoke: from the placket out to the armhole, coming down to a point over each pocket
        const yk = [[s * 0.03, 1.11], [s * 0.09, 1.085], [s * 0.15, 1.115], [s * 0.19, 1.13]];
        line(`dyoke${s}`, yk, 0.003, 0.0016, darkLine); T(`dyokeT${s}`, yk.map(([x, y]) => [x, y - 0.008]));
        // the flap pocket: a pointed flap, the pocket under it
        const fl = [[s * 0.045, 1.07], [s * 0.135, 1.07], [s * 0.135, 1.045], [s * 0.09, 1.03], [s * 0.045, 1.045]];
        patch(`dflap${s}`, s < 0 ? fl.slice().reverse() : fl, 0.005, cloth(0.95));
        line(`dflapE${s}`, fl, 0.0055, 0.0018, darkLine, true);
        T(`dflapT${s}`, fl.map(([x, y]) => [s * 0.09 + (x - s * 0.09) * 0.86, 1.052 + (y - 1.052) * 0.72]), 0.0062, 1, true);
        button(s * 0.09, 1.04);
        line(`dpocket${s}`, [[s * 0.05, 1.045], [s * 0.05, 0.975], [s * 0.13, 0.975], [s * 0.13, 1.045]], 0.0035, 0.0014, darkLine);
        // the seams down from the pocket to the band
        line(`ddown${s}`, [[s * 0.1, 0.975], [s * 0.1, bandTop]], 0.003, 0.0016, darkLine);
        T(`ddownT${s}`, [[s * 0.108, 0.975], [s * 0.108, bandTop]]);
        // round the back: the yoke, pointed in the middle, and two seams down from it
        const by = [[s * 0.0, 1.06], [s * 0.1, 1.09], [s * 0.2, 1.12]];
        line(`dbyoke${s}`, by, 0.003, 0.0016, darkLine, false, -1); T(`dbyokeT${s}`, by.map(([x, y]) => [x, y - 0.008]), 0.0045, -1);
        line(`dbdown${s}`, [[s * 0.075, 1.075], [s * 0.075, bandTop]], 0.003, 0.0016, darkLine, false, -1);
        T(`dbdownT${s}`, [[s * 0.083, 1.077], [s * 0.083, bandTop]], 0.0045, -1);
      }
      // the band's top and bottom stitched round
      for (const [y, k] of [[bandTop - 0.008, 'a'], [hemY + 0.004, 'b']]) {
        const [bx0, bz0] = slice(y), R0 = Math.max(bx0, bz0);
        const t = mk(geo(`dbandT:${tag}:${k}`, () => new THREE.TorusGeometry(1, 0.001 / R0, 4, 48)), jThread, 0, y, 0, g, false);
        t.rotation.x = Math.PI / 2; const [hx, hz] = slice(hemY), [tx, tz] = slice(hemY + bandH), bR = Math.max(hx, tx) + 0.007, bZ = (Math.max(hz, tz) + 0.007) / bR;
        t.scale.set(bR, bR * bZ, bR);
      }
    }
    if (topStyle === 'varsity') {
      // 棒球外套: snapped up the front to a ribbed collar, the sleeves in the other colour, a big letter on the chest
      fillU('varsity', cloth());
      mk(neckRibGeo(topFit, topStyle, 0.012), ribM, 0, 0, 0, g, false);
      line('placket', [[0, UNECK.bot - 0.004], [0, bandTop]], 0.003, 0.0016, shirtDark);
      const snapM = mat(trimC, { roughness: 0.3, metalness: 0.3 });
      for (let y = UNECK.bot - 0.03; y > bandTop + 0.02; y -= 0.075) { const p = on(0, y, 0.004); mk(sp(0.008, 10, 6), snapM, p.x, p.y, p.z, g, false).scale.z = 0.35; }
      // the letter: a felt patch on the left of the chest, their initial in the trim colour edged in the body's
      const ch = (String(seed || 'P').match(/[A-Za-z]/) || ['P'])[0].toUpperCase();
      const hexOf = c => '#' + new THREE.Color(c).getHexString();
      const trimHex = hexOf(lightTop ? 0x1f2a44 : 0xece3cf), bodyHex = hexOf(look.shirt);
      const tex = canvasTex(64, 64, c => {
        c.font = 'bold 54px Georgia,serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
        c.lineWidth = 12; c.strokeStyle = trimHex; c.strokeText(ch, 32, 36);
        c.lineWidth = 6; c.strokeStyle = bodyHex; c.strokeText(ch, 32, 36);
        c.fillStyle = trimHex; c.fillText(ch, 32, 36);
      });
      const S = 10, cx = 0.095, cy0 = 1.06, size = 0.09, pp = [], uv = [], ix = [];
      for (let r = 0; r <= S; r++) for (let c = 0; c <= S; c++) { const x = cx + (c / S - 0.5) * size, y = cy0 + (r / S - 0.5) * size, p = on(x, y, 0.004); pp.push(p.x, p.y, p.z); uv.push(c / S, r / S); }
      for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) { const a = r * (S + 1) + c, b = a + S + 1; ix.push(a, a + 1, b, a + 1, b + 1, b); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); lg.setIndex(ix); lg.computeVertexNormals();
      mk(lg, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0, 0, g, false);
      for (const s of [-1, 1]) line(`vpocket${s}`, [[s * 0.115, bandTop + 0.03], [s * 0.135, bandTop + 0.12]], 0.004, 0.0045, trimM);   // welt pockets, trimmed in leather
    }
    if (topStyle === 'coat') {
      // 西裝外套: a blazer: notched lapels down to a V, what's worn beneath showing in it (a knit, dark under a light
      // blazer and pale under a dark one), two buttons, the fronts curving away below them; flap pockets over the hips, a
      // breast pocket, a vent up the back. (Its collar round the back of the neck: see COLLAR)
      // (its colour as picked: see coatInnerOf; a shirt's cotton a little smoother than the knit)
      const inner0 = coatInnerOf(look), innerC = picked(inner0.color);
      const innerM = mat(innerC, { roughness: suitShirt ? 0.8 : 0.95, side: THREE.DoubleSide });
      // (what's worn beneath only in the middle; out to the sides of the neck the blazer's own cloth, under its collar,
      // so none of the pale knit peeks out beside the neck)
      // (the two meeting exactly along the lapels' inner edge, so neither shows past it)
      const vB = 0.94, top = TF.slitTop, lapelIn = y => 0.066 * Math.max(0, (y - vB) / (1.236 - vB));
      fillU('coatMid2', innerM, () => 0, lapelIn);
      fillU('coatSide2', cloth(0.92), lapelIn);
      patch('v', [[-0.075, UNECK.bot + 0.006], [0, vB - 0.005], [0.075, UNECK.bot + 0.006]], 0.003, innerM);
      const lapelR = [[0, vB], [0.066, 1.236], [0.104, 1.224], [0.116, 1.155], [0.098, 1.14], [0.152, 1.12], [0.018, vB - 0.006]];
      const lapM = cloth(0.92);
      for (const s of [-1, 1]) {
        const pts = s > 0 ? lapelR : mirror(lapelR);
        patch(`lapel${s}`, pts, 0.006, lapM);
        // (its edge all round but the top, where the collar carries straight on from it)
        const o = s > 0 ? lapelR : lapelR.map(([x, y]) => [-x, y]);
        line(`lapelEdge${s}`, [...o.slice(2), o[0], o[1]], 0.0065, 0.0016, shirtDark);
      }
      // the collar: the same cloth carrying on from the top of each lapel round the back of the neck, one piece with
      // them: a little roll up from the neckline, and the fall lying down over the shoulders and back. Each end is
      // exactly the lapel's top edge, so there's no join to see
      const [crx, crz] = slice(UNECK.neck);
      const surfAt = (x, z) => { for (let y = UNECK.neck; y > 1.0; y -= 0.002) { const [ex, ez] = slice(y); if ((x / ex) ** 2 + (z / ez) ** 2 <= 1) return y; } return 1.0; };
      const section = phi => {
        const sx = Math.sin(phi), sz = Math.cos(phi), base = new THREE.Vector3(sx * crx * 1.02, UNECK.neck - 0.002, sz * crz * 1.02);
        const n = new THREE.Vector3(base.x / (crx * crx), 0, base.z / (crz * crz)).normalize();
        // (lying flat where it leaves the lapels, rising gradually round to the back of the neck into a stand, its fall
        // turned down from the top of it and not reaching so far down)
        const back = ((1 - sz) / 2) ** 1.5;
        const roll = base.clone().addScaledVector(n, 0.004 + 0.003 * back).add(new THREE.Vector3(0, 0.012 + 0.024 * back, 0));
        const out = base.clone().addScaledVector(n, 0.04 - 0.012 * back); out.y = surfAt(out.x, out.z) + 0.006 + 0.01 * back;
        const mid = roll.clone().lerp(out, 0.4); mid.addScaledVector(n, 0.004 * back); mid.y = Math.max(mid.y, surfAt(mid.x, mid.z) + 0.008) + 0.004 + 0.006 * back;
        return [base, roll, mid, out];
      };
      const endOf = sgn => { const a = on(sgn * 0.066, 1.236, 0.006), b = on(sgn * 0.104, 1.224, 0.006); return [a, a.clone().lerp(b, 0.15).add(new THREE.Vector3(0, 0.003, 0.002)), a.clone().lerp(b, 0.55).add(new THREE.Vector3(0, 0.001, 0.001)), b]; };
      const PH = 1.3, K = 30, B = 5, secs = [];
      for (let k = 0; k <= B; k++) { const t = k / B, e = endOf(1), r = section(PH); secs.push(e.map((v, j) => v.clone().lerp(r[j], t * t * (3 - 2 * t)))); }
      for (let k = 1; k < K; k++) secs.push(section(PH + (Math.PI * 2 - 2 * PH) * k / K));
      for (let k = B; k >= 0; k--) { const t = k / B, e = endOf(-1), r = section(Math.PI * 2 - PH); secs.push(e.map((v, j) => v.clone().lerp(r[j], t * t * (3 - 2 * t)))); }
      const Qc = 6, rowsC = secs.map(sc => new THREE.CatmullRomCurve3(sc, false, 'centripetal').getPoints(Qc));
      mk(geo(`wblazerCollar2:${tag}`, () => {
        const pos = [], idx = [];
        rowsC.forEach(r => r.forEach(v => pos.push(v.x, v.y, v.z)));
        for (let i = 0; i < rowsC.length - 1; i++) for (let q = 0; q < Qc; q++) { const a = i * (Qc + 1) + q, d = a + Qc + 1; idx.push(a, d, a + 1, d, d + 1, a + 1); }
        const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); q.setIndex(idx); q.computeVertexNormals(); return q;
      }), lapM, 0, 0, 0, g, false);
      // its outer edge in the same seam as the lapels', running on from theirs
      mk(geo(`wblazerCollarEdge2:${tag}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rowsC.map(r => r[Qc].clone().multiply(new THREE.Vector3(1.004, 1, 1.004)).add(new THREE.Vector3(0, 0.0006, 0))), false, 'centripetal'), rowsC.length * 3, 0.0016, 5, false)), shirtDark, 0, 0, 0, g, false);
      line('front', [[0, vB], [0, hemY + 0.004]], 0.003, 0.0016, shirtDark);   // (the fronts meeting all the way down to the hem)
      if (suitShirt) {
        // 西裝外套(襯衫) (its collar: see COLLAR): a tie (black unless picked otherwise) knotted at the throat between the
        // collar's points and running down the V to the button, (its tip hidden under the
        // buttoned fronts); or, without a tie, the shirt's buttons down the middle
        const shirtEdge = mat(innerC.clone().multiplyScalar(0.8), { roughness: 0.85 });
        if (inner0.tie) {
          const tieC = picked(inner0.tieColor), tieM = mat(tieC, { roughness: 0.55, side: THREE.DoubleSide });
          // (right up to the top of the collar, so none of the throat shows between the collar's points)
          const knot = [[-0.015, 1.226], [0.015, 1.226], [0.009, 1.185], [-0.009, 1.185]];
          // (the knot tucked under the collar's points, which close over its sides, only its middle showing between them;
          // the blade coming out from under it down onto the shirt)
          patch('tieKnot', knot, 0.012, tieM);
          const bladeOff = (x, y) => 0.0052 + 0.0068 * Math.max(0, Math.min(1, (y - 1.1) / 0.085)) ** 1.5;
          patch('tieBlade', [[-0.009, 1.185], [0.009, 1.185], [0.016, 1.04], [0.006, vB + 0.025], [-0.006, vB + 0.025], [-0.016, 1.04]], bladeOff, tieM);
        } else {
          line('shirtPlacket', [[0, 1.2], [0, vB + 0.01]], 0.0035, 0.0012, shirtEdge);
          for (const y of [1.17, 1.08, 0.99]) { const p = on(0, y, 0.004); mk(sp(0.005, 8, 5), shirtEdge, p.x, p.y, p.z, g, false).scale.z = 0.4; }
        }
      }
      const btnM = mat(shade(C.shirt, 0.35), { roughness: 0.4 });
      // (three buttons, the last just over the opening)
      for (const y of [vB - 0.07, (vB - 0.07 + top + 0.01) / 2, top + 0.01]) { const p = on(0.012, y, 0.005); mk(sp(0.0085, 10, 6), btnM, p.x, p.y, p.z, g, false).scale.z = 0.4; }
      for (const s of [-1, 1]) {
        const y = 0.815, flap = [[s * 0.095, y], [s * 0.195, y], [s * 0.195, y - 0.034], [s * 0.095, y - 0.034]];
        patch(`flap${s}`, flap, 0.005, cloth(0.95));
        line(`flapEdge${s}`, flap, 0.0055, 0.0015, shirtDark, true);
      }
      line('chestWelt', [[0.11, 1.0], [0.17, 1.012]], 0.003, 0.003, shirtDark);   // a breast pocket on the left
      line('vent', [[0, hemY + 0.005], [0, hemY + 0.1]], 0.003, 0.0018, darkLine, false, -1);
    }
  }
  // a printed graphic (印花): big in the middle of a tee's chest; on a shirt a small emblem on the left breast, clear of
  // the placket. Laid on the cloth's own curve (each point on the cut's slice at its height), not a flat card
  // (on a hoodie big too; the jackets and coat, opening down the front, take the small one)
  const bigPrint = PRINTS.includes(pattern) && (topStyle === 'tee' || topStyle === 'crop' || topStyle === 'dress' || topStyle === 'hoodie');
  if (PRINTS.includes(pattern) && topStyle !== 'varsity') {   // (a varsity jacket wears its letter there)
    const rows = torsoRows(topFit, topStyle, fem), sliceAt = y => { for (let i = 1; i < rows.length; i++) if (rows[i][0] >= y) { const [y0, x0, z0] = rows[i - 1], [y1, x1, z1] = rows[i], t = (y - y0) / (y1 - y0 || 1); return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]; } return rows[rows.length - 1].slice(1); };
    const size = bigPrint ? 0.21 : 0.06, cx = bigPrint ? 0 : topStyle === 'coat' ? 0.15 : 0.065, cy = bigPrint ? (topStyle === 'hoodie' ? 1.06 : 1.02 - TF.drop * 0.15) : topStyle === 'coat' ? 0.96 : 1.1;
    const S = 12, pp = [], uv = [], ix = [];
    for (let r = 0; r <= S; r++) for (let c = 0; c <= S; c++) {
      const x = cx + (c / S - 0.5) * size, y = cy + (r / S - 0.5) * size, [ex, ez] = sliceAt(y);
      pp.push(x, y, ez * Math.sqrt(Math.max(0, 1 - (x / ex) ** 2)) + bustAt(x, y, TF, fem) + 0.003); uv.push(c / S, r / S);
    }
    for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) { const a = r * (S + 1) + c, b = a + S + 1; ix.push(a, a + 1, b, a + 1, b + 1, b); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); pg.setIndex(ix); pg.computeVertexNormals();
    const light = new THREE.Color(look.shirt).getHSL({}).l > 0.6;
    mk(pg, new THREE.MeshStandardMaterial({ map: printTex(pattern, light), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0, 0, g, false);
  }
  if (look.number) {
    // printed in white, or in near-black on a light shirt; and sat on the cloth however roomy the cut (an oversize top
    // stands further out, and the number buried in it showed through as a couple of odd pale patches)
    const light = new THREE.Color(look.shirt).getHSL({}).l > 0.6;
    const t = canvasTex(32, 32, (c) => { c.fillStyle = light ? '#222' : '#fff'; c.font = `16px ${PIX}`; c.textAlign = 'center'; c.fillText(look.number, 16, 24); }, true);
    const numM = new THREE.MeshBasicMaterial({ map: t, transparent: true });
    // (laid on the cloth itself, curving round it, out over a woman's bust in front: a flat card at a fixed depth was
    // sunk inside her bust and hidden by it)
    const ny = 0.98 - TF.drop * 0.3, nRows = torsoRows(topFit, topStyle, fem);
    const nSlice = y => { for (let i = 1; i < nRows.length; i++) if (nRows[i][0] >= y) { const [y0, x0, z0] = nRows[i - 1], [y1, x1, z1] = nRows[i], t = (y - y0) / (y1 - y0 || 1); return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]; } return nRows[nRows.length - 1].slice(1); };
    const numPatch = (sgn, size) => {
      const S = 10, pp = [], uv = [], ix = [];
      for (let r = 0; r <= S; r++) for (let c = 0; c <= S; c++) {
        const u = c / S, v = r / S, x = (u - 0.5) * size * sgn, y = ny + (v - 0.5) * size, [rx, rz] = nSlice(y), k = Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
        const z = sgn > 0 ? rz * k + bustAt(x, y, TF, fem) + 0.004 : -rz * k - buttAt(x, y, fem) - 0.004;
        pp.push(x, y, z); uv.push(u, v);
      }
      for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) { const a = r * (S + 1) + c, b2 = a + S + 1; ix.push(a, a + 1, b2, a + 1, b2 + 1, b2); }
      const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); ng.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); ng.setIndex(ix); ng.computeVertexNormals();
      return mk(ng, numM, 0, 0, 0, g, false);
    };
    const front = numPatch(1, 0.19), back = numPatch(-1, 0.19 * 1.3);
    if (bigPrint) front.visible = false;   // (a tee with a picture on its chest keeps the number on its back only)
  }
  if (look.apron) mk(bx(0.38, 0.6, 0.02), mat(picked(look.apron)), 0, 0.8, 0.15);

  // ---------------------------------------------------------------- head
  const head = new THREE.Group(); head.position.set(0, 1.44, 0); g.add(head);   // just off the shoulders, joined to them by a short flared neck
  mk(headGeo(shape), skin, 0, 0, 0, head).receiveShadow = false;   // like the neck: no shadows on the skin, so head and neck are one colour
  const surf = SURF[shape] || (SURF[shape] = surfaceFor(shape));
  const at = (x, y, z) => deform(H, new THREE.Vector3(x, y, z).normalize());   // surface point in a direction
  // ears, sitting on the side of whatever head shape it is
  const ears = earringsOf(look), earM = mat(earColorOf(look), { roughness: 0.25, metalness: 0.9 });
  [-1, 1].forEach(s => {
    const p = at(s, -0.04, 0.02);
    mk(sp(0.042, 12, 10), skin, p.x + s * 0.004, p.y, p.z, head).scale.set(0.42, 1, 0.72);
    mk(sp(0.022, 8, 6), skinShade, p.x + s * 0.016, p.y, p.z + 0.004, head, false).scale.set(0.3, 0.75, 0.55);
    // an earring through the lobe (the ear at -x is the person's right): a small hoop hanging edge-on to the cheek, a
    // stud, or a drop on a short chain
    const kind = s < 0 ? ears.right : ears.left;
    if (kind !== 'none') {
      const lx = p.x + s * 0.014, ly = p.y - 0.036, lz = p.z + 0.006, metal = earM;
      if (kind === 'hoop') {
        const ring = mk(geo('earHoop', () => new THREE.TorusGeometry(0.011, 0.0022, 6, 20)), metal, lx, ly - 0.009, lz, head, false); ring.rotation.y = Math.PI / 2;
      } else if (kind === 'stud') mk(sp(0.0045, 8, 6), metal, lx, ly + 0.002, lz + 0.002, head, false);
      else {
        mk(cy(0.0009, 0.0009, 0.014, 4), metal, lx, ly - 0.007, lz, head, false);
        mk(sp(0.005, 8, 6), metal, lx, ly - 0.017, lz, head, false).scale.set(0.8, 1.3, 0.8);
      }
    }
  });
  // 耳機: big over-ear headphones, matte all over in the chosen colour: an oval cup on each ear, a thick plush cushion
  // round it against the head, a round boss in the middle of its outside; one wide flat band rising out of the top of
  // each cup and arching over the head, a deeper-toned slider section low on each side where it adjusts. Or slipped
  // down round the neck: the band behind it, the cups hanging either side of the throat, cushions turned in to the neck
  const phones = headphonesOf(look);
  if (phones.wear !== 'none') {
    const base = picked(phones.color);
    const shellM = mat(base, { roughness: 0.62 });
    const padM = mat(base.clone().multiplyScalar(0.8), { roughness: 0.9 });
    const sliderM = mat(base.clone().multiplyScalar(0.72), { roughness: 0.5, side: THREE.DoubleSide });   // (the same colour, a shade deeper)
    const bandM = mat(base, { roughness: 0.62, side: THREE.DoubleSide });
    const CW = 0.07, CH = 0.088;   // the cup's oval: front to back, and tall
    // an oval, extruded `d` deep along x and rounded over its edges
    const oval = (key, w, h, d, bev) => geo(`hp3:${key}`, () => {
      const sh = new THREE.Shape(); sh.absellipse(0, 0, w / 2, h / 2, 0, Math.PI * 2, false, 0);
      const eg = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 28 });
      eg.translate(0, 0, -d / 2); eg.rotateY(Math.PI / 2); return eg;
    });
    // a cup, the cushion's face against the head at the group's origin, the shell out along +s x
    const cup = (par, s) => {
      const c = new THREE.Group(); par.add(c);
      const pad = mk(geo('hp3:cushion', () => new THREE.TorusGeometry(1, 0.32, 10, 32)), padM, s * 0.012, 0, 0, c, false);   // the plush ring
      pad.rotation.y = Math.PI / 2; pad.scale.set(CW / 2 * 0.8, CH / 2 * 0.8, 0.04);
      mk(oval('inner', CW * 0.62, CH * 0.62, 0.004, 0.002), mat(0x1a1a1c, { roughness: 1 }), s * 0.006, 0, 0, c, false);   // the dark fabric inside it
      mk(oval('shell', CW, CH, 0.016, 0.009), shellM, s * 0.033, 0, 0, c, false);
      const boss = mk(cy(0.019, 0.02, 0.006, 24), padM, s * 0.0455, 0, 0, c, false); boss.rotation.z = Math.PI / 2;   // the round boss on its outside
      return c;
    };
    // the band: wide and flat, along a curve through pts (its width across z), the sliders a short darker stretch near
    // each end
    const band = (key, pts, par, side = new THREE.Vector3(0, 0, 1)) => {   // (side: which way its width lies; null round the neck)
      const curve = new THREE.CatmullRomCurve3(pts), N = 48, P = curve.getSpacedPoints(N), W = 0.034, T = 0.009;
      const strip = (from, to, grow, m, k) => mk(geo(`hp7:band:${key}:${k}`, () => {
        const pos = [], idx = [], rows = to - from;
        for (let i = from; i <= to; i++) {
          const p = P[i], tan = curve.getTangentAt(i / N), out = side ? side.clone().cross(tan).normalize().multiplyScalar(-1) : new THREE.Vector3(p.x, 0, p.z).normalize();   // (no side: round the neck, its faces out from it)
          const wdir = side || out.clone().cross(tan).normalize();
          const w = W / 2 + grow, t = T / 2 + grow;
          // four corners round its section: inner and outer face, each side
          [[-w, -t], [w, -t], [w, t], [-w, t]].forEach(([z, o]) => { const v = p.clone().addScaledVector(out, o).addScaledVector(wdir, z); pos.push(v.x, v.y, v.z); });
        }
        for (let r = 0; r < rows; r++) for (let k2 = 0; k2 < 4; k2++) {
          const a = r * 4 + k2, b = r * 4 + (k2 + 1) % 4, c2 = a + 4, d2 = b + 4;
          idx.push(a, c2, b, b, c2, d2);
        }
        const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setIndex(idx); bg.computeVertexNormals(); return bg;
      }), m, 0, 0, 0, par, false);
      strip(0, N, 0, bandM, 'main');
      strip(5, 11, 0.0012, sliderM, 'sl0'); strip(N - 11, N - 5, 0.0012, sliderM, 'sl1');
    };
    // the pair as worn, built round the line through the two cups: on the head that line is through the ears; round the
    // neck it's the same pair, unchanged, just lowered to the base of the neck and tipped back, the band behind the neck
    // and the cups either side of the throat
    const ear = at(1, -0.04, 0.02), top = at(0, 1, -0.05), ey = ear.y + 0.004;
    // (over a beanie or a cap, the band goes on over it: higher and a little wider; a bucket hat, fedora or beret goes on
    // over the band instead)
    const overHat = { beanie: 0.05, cap: 0.02 }[hatOf(look).hat] || 0;
    // (round the neck it springs in tighter than over the head: the cups close in either side of the throat)
    const ex = phones.wear === 'head' ? Math.abs(ear.x) + 0.016 + overHat * 0.25 : 0.078;
    const set = new THREE.Group();
    [-1, 1].forEach(s => cup(set, s).position.set(s * ex, 0, 0));
    // out of the top of each cup, up and over the head, close over the hair
    const fx = ex + 0.008 + overHat * 0.35, by = CH / 2 - 0.006, rise = top.y + 0.026 - ey - by + (phones.wear === 'head' ? overHat : 0.02), pts = [];   // (round the neck, a little longer to reach round behind it)
    for (let k = 0; k <= 24; k++) { const t = -Math.PI / 2 + Math.PI * k / 24; pts.push(new THREE.Vector3(Math.sin(t) * fx, by + Math.cos(t) * rise, 0)); }
    band(`set:${shape}:${ex.toFixed(3)}:${fx.toFixed(3)}:${rise.toFixed(3)}`, pts, set);
    if (phones.wear === 'head') { head.add(set); set.position.set(0, ey, ear.z); }
    else {
      g.add(set); set.position.set(0, 1.232, 0.055); set.rotation.x = -1.38;
      // and nowhere into the body: the cups' rims checked against the top's own slices, the pair eased forward a
      // little at a time until none of it is inside
      const rows = torsoRows(topFit, topStyle, fem), inside = v => {
        for (let i = 1; i < rows.length; i++) if (rows[i][0] >= v.y) { const [, rx, rz] = rows[i - 1]; return (v.x / rx) ** 2 + (v.z / rz) ** 2 < 1; }
        return false;
      };
      const rim = [];
      [-1, 1].forEach(s => { for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; for (const dx of [0.004, 0.024, 0.045]) rim.push(new THREE.Vector3(s * (ex + dx), Math.sin(a) * CH / 2, Math.cos(a) * CW / 2)); } });   // (cushion to shell, all round)
      for (let n = 0; n < 40; n++) {
        set.updateMatrix();
        if (!rim.some(v => inside(v.clone().applyMatrix4(set.matrix)))) break;
        set.position.z += 0.002;
      }
    }
  }
  const face = new THREE.Group(); head.add(face);
  const fm = (geom, m, x, y, z, par = face) => mk(geom, m, x, y, z, par, false);

  buildHair(hairOf(look), shape, head, hairM, mk, at, look);

  // eyes: each in its own group so it can blink
  const EX = 0.062 * H.s[0], EY = 0.025;
  const iris = mat(picked(f.eyeColor), { roughness: 0.3 });
  const eyes = [-1, 1].map(s => {
    const e = new THREE.Group(); e.position.set(s * EX, EY, surf(s * EX, EY) - 0.004); face.add(e);
    const sclera = r => { fm(disc(r), whiteM, 0, 0, 0.002, e).rotation.x = Math.PI / 2; };
    // the upper lash line: a thin dark curve along the top of the eye's white (not a straight bar, which read as a brow)
    const lid = r => { const l = fm(geo(`lid:${r}`, () => new THREE.TorusGeometry(r * 0.97, 0.0032, 6, 24, Math.PI * 0.76)), darkM, 0, 0, 0.007, e); l.rotation.z = Math.PI * 0.12; };
    // an almond eye (杏眼 and its kin): the white an oval, wider than tall, the iris showing most of it, a curved lash
    // line along its top; tipped up at the outer corner (鳳眼) or down (下垂眼) by `tip`
    const almond = (rx, ry, tip) => {
      const a = new THREE.Group(); a.rotation.z = s * tip; e.add(a);
      const wh = fm(disc(rx), whiteM, 0, 0, 0.002, a); wh.rotation.x = Math.PI / 2; wh.scale.set(1, 1, ry / rx);
      fm(sp(ry * 0.78, 12, 10), iris, 0, -0.001, 0.004, a); fm(sp(ry * 0.42, 8, 6), darkM, 0, -0.001, 0.0105, a);
      fm(sp(0.0042, 6, 4), shineM, s * 0.005, 0.005, 0.016, a);
      const l = fm(geo(`alid:${rx}:${ry}`, () => new THREE.TorusGeometry(rx * 0.97, 0.0034, 6, 24, Math.PI * 0.8)), darkM, 0, 0, 0.007, a); l.rotation.z = Math.PI * 0.1; l.scale.set(1, ry / rx, 1);
      // (a lifted eye's lash line flicks out past its outer corner)
      if (tip > 0) { const fl = fm(bx(0.016, 0.0045, 0.006), darkM, s * (rx + 0.004), ry * 0.3, 0.007, a); fl.rotation.z = s * 0.5; }
    };
    switch (f.eyes) {
      case 'almond': almond(0.036, 0.024, 0); break;                     // 杏眼
      case 'phoenix': almond(0.04, 0.017, 0.3); break;                   // 鳳眼: long, narrow, the outer corners lifting
      case 'droopy': almond(0.034, 0.026, -0.3); break;                  // 下垂眼: the outer corners falling, soft
      case 'wink':                                                       // 眨眼: one shut in a happy curve, the other open
        if (s > 0) { const c = fm(geo('winkArc', () => new THREE.TorusGeometry(0.022, 0.0042, 6, 16, Math.PI * 0.8)), darkM, 0, -0.008, 0.007, e); c.rotation.z = Math.PI * 0.1; }
        else { sclera(0.031); fm(sp(0.019, 12, 10), iris, 0, 0, 0.004, e); fm(sp(0.01, 8, 6), darkM, 0, 0, 0.012, e); fm(sp(0.005, 6, 4), shineM, s * 0.007, 0.008, 0.019, e); lid(0.031); }
        break;
      case 'sparkle': {                                                  // 閃亮眼: big and shining, a little star in each
        sclera(0.042); fm(sp(0.027, 14, 10), iris, 0, -0.002, 0.004, e); fm(sp(0.014, 10, 8), darkM, 0, -0.002, 0.016, e);
        fm(sp(0.008, 6, 4), shineM, s * 0.01, 0.011, 0.026, e); fm(sp(0.004, 6, 4), shineM, -s * 0.009, -0.011, 0.025, e);
        [0, Math.PI / 2].forEach(r => { fm(bx(0.014, 0.0028, 0.002), shineM, -s * 0.004, 0.004, 0.03, e).rotation.z = r + Math.PI / 4; });
        lid(0.042); break;
      }
      case 'deadpan': {                                                  // 死魚眼: a wide white, a tiny dot of a pupil, the lid level across the top half
        sclera(0.032); fm(sp(0.0065, 8, 6), darkM, 0, -0.006, 0.006, e);
        fm(bx(0.07, 0.033, 0.026), skin, 0, 0.0165, 0.011, e); fm(bx(0.066, 0.0055, 0.012), darkM, 0, 0.0005, 0.024, e); break;
      }
      case 'dot': fm(sp(0.021, 10, 8), darkM, 0, 0, 0.004, e); fm(sp(0.005, 6, 4), shineM, s * 0.006, 0.007, 0.022, e); break;
      case 'big':
        sclera(0.042); fm(sp(0.027, 14, 10), iris, 0, -0.002, 0.004, e); fm(sp(0.014, 10, 8), darkM, 0, -0.002, 0.016, e);
        fm(sp(0.007, 6, 4), shineM, s * 0.009, 0.01, 0.025, e); fm(sp(0.004, 6, 4), shineM, -s * 0.008, -0.01, 0.024, e); lid(0.042); break;
      case 'sleepy':
        sclera(0.031); fm(sp(0.019, 10, 8), iris, 0, -0.004, 0.004, e); fm(sp(0.01, 8, 6), darkM, 0, -0.004, 0.012, e);
        fm(bx(0.072, 0.034, 0.03), skin, 0, 0.017, 0.012, e); fm(bx(0.068, 0.007, 0.012), darkM, 0, 0.0, 0.026, e); break;
      case 'smile': [-1, 1].forEach(k => { fm(bx(0.032, 0.009, 0.01), darkM, k * 0.012, 0.004, 0.006, e).rotation.z = -k * 0.55; }); break;
      case 'narrow': fm(bx(0.05, 0.01, 0.01), darkM, 0, 0, 0.006, e).rotation.z = -s * 0.08; break;
      default:   // round
        sclera(0.031); fm(sp(0.019, 12, 10), iris, 0, 0, 0.004, e); fm(sp(0.01, 8, 6), darkM, 0, 0, 0.012, e);
        fm(sp(0.005, 6, 4), shineM, s * 0.007, 0.008, 0.019, e); lid(0.031);
    }
    return e;
  });
  // brows
  if (f.brows !== 'none') {
    // each kind: its width and thickness, how it slopes, and its shape (a bar, an arch, a short rounded tuft; joined
    // across the nose; one side raised)
    const B = {
      thin: { w: 0.06, h: 0.011, tilt: -0.06 }, thick: { w: 0.068, h: 0.02, tilt: 0.04 }, angry: { w: 0.068, h: 0.02, tilt: 0.32 },
      bushy: { w: 0.076, h: 0.027, tilt: 0.02 },                           // 濃眉: the fullest, a little unruly
      worried: { w: 0.06, h: 0.011, tilt: -0.3 },
      arched: { w: 0.066, h: 0.012, tilt: 0, arch: true },               // 挑眉: a clean arch
      straight: { w: 0.074, h: 0.016, tilt: 0 },                          // 一字眉: long and level
      unibrow: { w: 0.07, h: 0.017, tilt: 0.02, join: true },             // 連心眉: meeting over the nose
      short: { w: 0.03, h: 0.017, tilt: 0, tuft: true },                  // 短眉: short round tufts
      raised: { w: 0.062, h: 0.012, tilt: -0.05, raise: true },           // 單挑眉: one up, quizzical
    }[f.brows] || { w: 0.06, h: 0.011, tilt: 0 };
    const { w, h, tilt } = B;
    // under a hat they sit just below its front edge (which is at height elev straight in front), or they'd show through it
    const hs = HATS[hatOf(look).hat];
    const BY = hs ? Math.min(0.074, at(0, Math.sin(hs.elev), Math.cos(hs.elev)).y - h / 2 - Math.abs(Math.sin(tilt)) * w / 2 - 0.004 - (B.raise ? 0.012 : 0)) : 0.074;
    // (each brow a group round its own middle, so the checks below work alike for every shape)
    const browShape = (grp, s) => {
      if (B.arch) { const a = fm(geo('browArch', () => new THREE.TorusGeometry(0.05, h / 2, 6, 16, 2 * Math.asin(w / 2 / 0.05))), hairM, 0, -0.05 + h / 2 - 0.004, 0, grp); a.rotation.z = Math.PI / 2 - Math.asin(w / 2 / 0.05); a.scale.z = 0.5; }
      else if (B.tuft) { const t = fm(sp(w / 2, 10, 8), hairM, 0, 0, 0, grp); t.scale.set(1, h / w, 0.4); }
      else fm(bx(w, h, 0.014), hairM, 0, 0, 0, grp);
    };
    const brows = [-1, 1].map(s => {
      const b = new THREE.Group(), y = BY + (B.raise && s > 0 ? 0.012 : 0); b.position.set(s * EX, y, surf(s * EX, y) + 0.004); b.rotation.z = s * tilt * (B.raise && s > 0 ? -2.5 : 1); face.add(b);
      browShape(b, s); return b;
    });
    if (B.join) { const mid = fm(bx(2 * EX - w + 0.012, h * 0.75, 0.012), hairM, 0, BY - 0.002, surf(0, BY) + 0.003); brows.push(mid); }
    // a fringe over the forehead hides them: where any of a brow (its middle or either end) is behind hair, seen from in
    // front, it isn't drawn, rather than showing through the curls
    // (the hair and any hat: all that's put on the head after the face; a hat's edge counts as much as a fringe does,
    // so the brows go down under a beret rather than showing on it)
    const hairMeshes = []; head.children.slice(head.children.indexOf(face) + 1).forEach(c => c.traverse(o => { if (o.isMesh) hairMeshes.push(o); }));
    if (hairMeshes.length) {
      head.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(), p = new THREE.Vector3(), back = new THREE.Vector3(0, 0, -1);
      // (a fringe ending at the brows: they drop just below its edge, as far as a little under 2 cm; any further, hidden)
      const coveredAt = (b, drop) => [-w / 2, 0, w / 2].some(dx => [h / 2, 0].some(dy => {
        p.set(dx, dy - drop, 0.007).applyMatrix4(b.matrixWorld); ray.set(new THREE.Vector3(p.x, p.y, p.z + 0.3), back); ray.far = 0.3;
        return ray.intersectObjects(hairMeshes, false).length > 0;
      }));
      brows.forEach(b => {
        const drop = [0, 0.006, 0.012, 0.018].find(dd => !coveredAt(b, dd));
        if (drop === undefined) b.visible = false;
        else if (drop) { b.position.y -= drop; b.position.z = surf(b.position.x, b.position.y) + 0.004; }
      });
    }
  }
  // nose: soft rounded shapes, a shade darker than the face
  const NY = -0.024, nz = surf(0, NY);
  ({
    small: () => fm(sp(0.018, 10, 8), skinShade, 0, NY, nz + 0.002).scale.set(1, 1.3, 1),
    normal: () => { fm(sp(0.022, 12, 10), skinShade, 0, NY - 0.004, nz + 0.004).scale.set(0.9, 1.5, 1.15); fm(bx(0.016, 0.04, 0.02), skinShade, 0, NY + 0.022, nz - 0.004); },
    big: () => { fm(sp(0.03, 12, 10), skinShade, 0, NY - 0.006, nz + 0.008).scale.set(1, 1.35, 1.25); [-1, 1].forEach(s => fm(sp(0.012, 8, 6), skinShade, s * 0.022, NY - 0.02, nz + 0.002)); },
    button: () => fm(sp(0.026, 12, 10), skinShade, 0, NY - 0.008, nz + 0.002),
  }[f.nose] || (() => {}))();
  // beard first: the mouth sits on top of it
  // how dense the facial hair is: light is see-through and a little smaller, thick is fuller
  const BD = { light: { k: 0.8, a: 0.5, stub: 0.2 }, normal: { k: 1, a: 1, stub: 0.35 }, thick: { k: 1.3, a: 1, stub: 0.6 } }[f.beard] || { k: 1, a: 1, stub: 0.35 };
  const beardM = BD.a < 1 ? mat(C.hair, { roughness: 0.9, transparent: true, opacity: BD.a, depthWrite: false }) : hairM;
  const beardThick = f.facialHair === 'full' ? 0.014 * BD.k : f.facialHair === 'stubble' ? 0.002 : 0;
  if (beardThick) {
    const m = f.facialHair === 'full' ? beardM : mat(C.hair, { roughness: 1, transparent: true, opacity: BD.stub, depthWrite: false });
    const n = new THREE.Vector3(0, -0.9, 0.44).normalize();   // from just under the nose, round the jaw
    mk(shellGeo(shape, beardThick, n, 0, f.facialHair === 'full' ? 0.9 : 0.85), m, 0, 0, 0, head, false);
  }
  // mouth: a group so it can move while talking
  const MY = -0.082;
  const mouth = new THREE.Group(); mouth.position.set(0, MY, surf(0, MY) + (beardThick > 0.01 ? beardThick + 0.002 : -0.001)); face.add(mouth);
  ({
    smile: () => { fm(bx(0.038, 0.01, 0.006), darkM, 0, 0, 0, mouth); [-1, 1].forEach(k => { fm(bx(0.016, 0.01, 0.006), darkM, k * 0.025, 0.005, -0.002, mouth).rotation.z = k * 0.55; }); },
    grin: () => { fm(bx(0.064, 0.028, 0.006), darkM, 0, 0, 0, mouth); fm(bx(0.056, 0.012, 0.012), whiteM, 0, 0.005, 0.002, mouth); },
    smirk: () => { fm(bx(0.042, 0.01, 0.006), darkM, 0.006, 0, 0, mouth).rotation.z = 0.2; fm(bx(0.014, 0.01, 0.006), darkM, 0.03, 0.008, -0.002, mouth).rotation.z = 0.7; },
    flat: () => fm(bx(0.046, 0.01, 0.006), darkM, 0, 0, 0, mouth),
    open: () => { fm(bx(0.044, 0.032, 0.012), darkM, 0, -0.004, 0, mouth); fm(bx(0.03, 0.01, 0.006), tongueM, 0, -0.013, 0.005, mouth); },
    jianzhi: () => { const m = new THREE.Mesh(geo('flare', () => new THREE.PlaneGeometry(0.13, 0.13)), flashM()); m.position.z = 0.04; m.renderOrder = 2; mouth.add(m); },   // the mouth hidden behind a flash of light (held out in front of the nose, so it's never cut off by it)
    bigGrin: () => toothy('none'),
    braces: () => toothy('steel'),
    bracesColor: () => toothy('color'),
    frown: () => { fm(bx(0.034, 0.01, 0.006), darkM, 0, 0, 0, mouth); [-1, 1].forEach(k => { fm(bx(0.016, 0.01, 0.006), darkM, k * 0.023, -0.005, -0.002, mouth).rotation.z = -k * 0.55; }); },
    surprised: () => {   // a small round "o": dark inside, a soft rim of lip round it, the tip of the tongue at the bottom
      const o = fm(cy(0.012, 0.012, 0.006, 20), darkM, 0, -0.004, 0, mouth); o.rotation.x = Math.PI / 2; o.scale.set(1, 1, 1.35);
      fm(geo('ohRim', () => new THREE.TorusGeometry(0.0125, 0.0028, 8, 24)), lipM, 0, -0.004, 0.002, mouth).scale.set(1, 1.35, 0.7);
      fm(sp(0.007, 10, 6), tongueM, 0, -0.0115, 0.0005, mouth).scale.set(1.3, 0.6, 0.5);
    },
    pout: () => { [0.006, -0.006].forEach(y => fm(sp(0.012, 12, 8), lipM, 0, y, 0.002, mouth).scale.set(1.5, 0.6, 0.8)); fm(bx(0.022, 0.003, 0.004), darkM, 0, 0, 0.009, mouth); },
    bunny: () => {   // a small smile with two big front teeth peeking out under it
      fm(bx(0.03, 0.008, 0.006), darkM, 0, 0, 0, mouth); [-1, 1].forEach(k => { fm(bx(0.012, 0.008, 0.006), darkM, k * 0.019, 0.004, -0.002, mouth).rotation.z = k * 0.55; });
      [-1, 1].forEach(s => fm(bx(0.0085, 0.013, 0.005), whiteM, s * 0.0047, -0.0085, 0.002, mouth));
    },
    gaptooth: () => {   // a grin with one front tooth missing, just right of the middle
      fm(bx(0.064, 0.028, 0.006), darkM, 0, 0, 0, mouth);
      fm(bx(0.031, 0.012, 0.012), whiteM, -0.0125, 0.005, 0.002, mouth); fm(bx(0.016, 0.012, 0.012), whiteM, 0.02, 0.005, 0.002, mouth);
    },
  }[f.mouth] || (() => fm(bx(0.038, 0.01, 0.006), darkM, 0, 0, 0, mouth)))();
  // a big toothy smile in one smooth shape (a gently lifting top edge, a deeper curve underneath, meeting in the
  // corners), filled mostly by a wide row of top teeth, the bottom ones peeking out behind them; with braces, a thin steel wire
  // across the top teeth and a small bracket on each front tooth (coloured braces: a coloured band on each). Every layer is a
  // fine mesh laid onto the face's own curve (up/down as well as sideways) a hair apart, so the skin never covers the
  // teeth and the wire always sits on the teeth, never on the skin around the mouth.
  function toothy(braces) {
    const W = 0.032, N = 20, M = 6;
    const top = x => 0.009 + 0.004 * (x / W) ** 2;                   // lifts toward the corners
    const bot = x => 0.013 - 0.026 * (1 - (x / W) ** 2);              // the lower edge, deepest in the middle
    const lift = Math.max(0, mouth.position.z - surf(0, MY));         // sitting on a full beard: stay on top of it
    const onFace = (x, y, off) => surf(x, MY + y) + lift - mouth.position.z + off;   // the face's depth at (x, y), in the mouth's space
    const xs = (w, n = N) => Array.from({ length: n + 1 }, (_, i) => -w + (2 * w * i) / n);
    // a grid between two curves over [-w, w], each point laid onto the face `off` in front of it
    const band = (w, upper, lower, off) => {
      const pts = [], idx = [];
      xs(w).forEach(x => { for (let j = 0; j <= M; j++) { const y = upper(x) + (lower(x) - upper(x)) * j / M; pts.push(x, y, onFace(x, y, off)); } });
      for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
        const a = i * (M + 1) + j, b = a + M + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const add = (g, m) => fm(g, m, 0, 0, 0, mouth);                                   // (wound to face out)
    add(band(W, top, bot, 0.0008), darkM);                                                                   // the open mouth
    add(band(0.015, x => Math.min(bot(x) + 0.0055, top(x) - 0.001), x => bot(x) + 0.0008, 0.0012), whiteM); // bottom teeth, behind the top row
    add(band(0.028, x => top(x) - 0.0006, x => Math.max(top(x) - 0.0145, bot(x) + 0.0008), 0.0016), whiteM); // top teeth: most of the mouth
    if (braces === 'none') return;
    const wy = x => top(x) - 0.0075;                                                                         // across the middle of the top teeth
    fm(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(xs(0.025).map(x => new THREE.Vector3(x, wy(x), onFace(x, wy(x), 0.0021)))), 32, 0.0005, 6, false), bracesM, 0, 0, 0, mouth);   // the archwire
    xs(0.0192, 4).forEach((x, i) => {
      const b = fm(bx(0.0042, 0.0042, 0.0008), braces === 'color' ? bandMs[i % bandMs.length] : bracesM, x, wy(x), onFace(x, wy(x), 0.0024), mouth);
      b.rotation.z = Math.atan(0.008 * x / W ** 2);                                                          // following the curve
    });
  }
  if (f.blush) [-1, 1].forEach(s => { const x = s * 0.1 * H.s[0]; fm(disc(0.026), blushM, x, -0.038, surf(x, -0.038) - 0.002).rotation.set(Math.PI / 2, 0, -s * 0.6); });
  // moustache and goatee
  if (['mustache', 'both', 'full'].includes(f.facialHair)) {
    const z = surf(0, -0.056) + beardThick;
    fm(bx(0.1, 0.022 * BD.k, 0.03), beardM, 0, -0.056, z + 0.004);
    [-1, 1].forEach(s => fm(bx(0.02 * BD.k, 0.035 * BD.k, 0.024), beardM, s * 0.052, -0.07, surf(s * 0.052, -0.07) + beardThick + 0.002));
  }
  if (f.facialHair === 'goatee' || f.facialHair === 'both') fm(bx(0.05 * BD.k, 0.055 * BD.k, 0.04), beardM, 0, -0.128, surf(0, -0.128) - 0.004);
  // glasses
  if (f.glasses !== 'none') {
    const AR = 0.0345, AT = 0.0085;   // 阿亮眼鏡: the round frames, a touch narrower, in thick acetate
    const gy = EY + 0.002, gz = Math.max(surf(EX, EY), surf(0, NY) - 0.01) + 0.03;
    const earX = at(1, 0.02, 0).x - 0.004;
    // the frame: first its kind (black, browline, gold/silver wire, rimless), then its shape (round, square, cat-eye,
    // aviator, octagon); the lens tint is its own choice, so any frame can wear the sunglasses lens
    const style = f.glasses, shape = f.glassesShape;
    const metal = style === 'metal' || style === 'rimless';
    const frameMat = mat(frameColorOf(look, style), metal ? { roughness: 0.28, metalness: 0.85 }
      : style === 'aliang' ? { roughness: 0.22, metalness: 0 } : { roughness: 0.4, metalness: 0.3 });
    const wire = metal || style === 'browline' ? frameMat : undefined;
    const browline = style === 'browline', rimless = style === 'rimless', rimM = frameMat;
    const lensLook = lensOf(look), tinted = look.glasses === 'sun' || look.lensColor !== undefined || look.lensOpacity !== undefined;
    const clearLens = lensLook.color === CLEAR_LENS.color && lensLook.opacity <= CLEAR_LENS.opacity;
    const frameLens = tinted && !clearLens ? mat(picked(lensLook.color), { roughness: 0.08, metalness: 0.6, transparent: lensLook.opacity < 1, opacity: lensLook.opacity, depthWrite: lensLook.opacity >= 1 }) : lensM;
    const R = shape === 'aviator' ? 0.037 : 0.038, T = wire ? 0.0022 : 0.006;
    const outerAdd = { round: 0.038, oval: 0.043, square: 0.039, rectangle: 0.043, wayfarer: 0.042, catEye: 0.042, aviator: 0.04, hexagon: 0.039, octagon: 0.04, diamond: 0.039 }[shape] ?? 0.038;
    [-1, 1].forEach(s => {
      const cx = s * EX;
      // 眉框: a thicker black upper rim joined to a thin silver lower rim, not a bar laid across the lens
      const browArc = (radius, tube, m, start, len, seg, radial, sx = 1, sy = 1, tilt = 0) => {
        const key = `${radius},${tube},${start},${len},${seg},${radial}`;
        const part = new THREE.Mesh(geo(`browArc:${key}`, () => new THREE.TorusGeometry(radius, tube, radial, seg, len)), m);
        part.position.set(cx, gy, gz); part.scale.set(sx, sy, 1); part.rotation.z = start + tilt; face.add(part);
      };
      const browRim = (radius, sx = 1, sy = 1, tilt = 0, seg = 14, radial = 6) => {
        browArc(radius, 0.0042, frameMat, 0, Math.PI, seg, radial, sx, sy, tilt);
        browArc(radius, 0.0019, WIRE.metalSilver, Math.PI, Math.PI, seg, radial, sx, sy, tilt);
      };
      if (style === 'aliang') {
        // the round frames, in thick glossy black, the rims cut in a few flat facets rather than perfectly round, with a
        // little wing sticking out at each outer top corner where the arm hinges on
        const ring = new THREE.Mesh(geo(`aliangRim:${AR},${AT}`, () => new THREE.TorusGeometry(AR, AT, 8, 16)), frameMat); ring.position.set(cx, gy, gz); ring.scale.z = 0.8; face.add(ring);
        fm(disc(AR - AT * 0.6), frameLens, cx, gy, gz).rotation.x = Math.PI / 2;
        fm(bx(0.018, 0.011, 0.012), frameMat, s * (EX + AR + AT + 0.004), gy + 0.012, gz);
      } else {
        if (shape === 'square' || shape === 'rectangle') {
          const w = shape === 'rectangle' ? 0.086 : 0.078, h = shape === 'rectangle' ? 0.046 : 0.054, t = browline ? 0.0024 : wire ? 0.0035 : 0.008;
          if (browline) {
            fm(bx(w, 0.0068, 0.0068), frameMat, cx, gy + h / 2, gz);
            fm(bx(w, t, t), WIRE.metalSilver, cx, gy - h / 2, gz);
            fm(bx(t, h, t), WIRE.metalSilver, cx - w / 2, gy, gz); fm(bx(t, h, t), WIRE.metalSilver, cx + w / 2, gy, gz);
          } else if (!rimless) {
            fm(bx(w, t, t), rimM, cx, gy + h / 2, gz); fm(bx(w, t, t), rimM, cx, gy - h / 2, gz);
            fm(bx(t, h, t), rimM, cx - w / 2, gy, gz); fm(bx(t, h, t), rimM, cx + w / 2, gy, gz);
          }
          fm(bx(w, h, 0.003), frameLens, cx, gy, gz);
        } else if (shape === 'oval') {
          // 橢圓: a wide, softly rounded lens
          if (browline) browRim(R, 1.15, 0.88);
          else if (!rimless) {
            const ring = new THREE.Mesh(geo(`ovalRim:${R},${T}`, () => new THREE.TorusGeometry(R, T, 6, 24)), rimM); ring.position.set(cx, gy, gz); ring.scale.set(1.15, 0.88, 1); face.add(ring);
          }
          const l = fm(disc(R - T * 0.4), frameLens, cx, gy, gz); l.rotation.x = Math.PI / 2; l.scale.set(1.15, 1, 0.88);
        } else if (shape === 'wayfarer') {
          // 威靈頓: a trapezoid, wider across the brow than the bottom
          const wTop = 0.082, wBot = 0.062, h = 0.05, t = browline ? 0.0024 : wire ? 0.0035 : 0.008;
          const side = (m, thick) => [-1, 1].forEach(k => {
            const bar = fm(bx(thick, Math.hypot((wTop - wBot) / 2, h), thick), m, cx + k * (wTop + wBot) / 4, gy, gz);
            bar.rotation.z = -k * Math.atan2((wTop - wBot) / 2, h);
          });
          if (browline) {
            fm(bx(wTop, 0.0068, 0.0068), frameMat, cx, gy + h / 2, gz);
            fm(bx(wBot, t, t), WIRE.metalSilver, cx, gy - h / 2, gz); side(WIRE.metalSilver, t);
          } else if (!rimless) {
            fm(bx(wTop, t, t), rimM, cx, gy + h / 2, gz); fm(bx(wBot, t, t), rimM, cx, gy - h / 2, gz); side(rimM, t);
          }
          const lens = new THREE.Mesh(geo(`wayfarerLens:${wTop},${wBot},${h}`, () => {
            const p = new THREE.Shape(); p.moveTo(-wTop / 2, h / 2); p.lineTo(wTop / 2, h / 2); p.lineTo(wBot / 2, -h / 2); p.lineTo(-wBot / 2, -h / 2); p.closePath();
            return new THREE.ExtrudeGeometry(p, { depth: 0.003, bevelEnabled: false });
          }), frameLens); lens.position.set(cx, gy, gz - 0.0015); face.add(lens);
        } else if (shape === 'catEye') {
          // 貓眼: an oval lifted at the outer corner, with a small flick at each tip
          if (browline) browRim(R, 1, 0.72, s * 0.16);
          else if (!rimless) {
            const ring = new THREE.Mesh(geo(`catRim:${R},${T}`, () => new THREE.TorusGeometry(R, T, 6, 24)), rimM); ring.position.set(cx, gy, gz); ring.scale.set(1, 0.72, 1); ring.rotation.z = s * 0.16; face.add(ring);
          }
          const l = fm(disc(R - T * 0.4), frameLens, cx, gy, gz); l.rotation.set(Math.PI / 2, 0, s * 0.16); l.scale.z = 0.72;
          if (!rimless && !browline) fm(bx(0.018, 0.0045, 0.007), rimM, s * (EX + R * 0.88), gy + 0.018, gz).rotation.z = s * 0.35;
        } else if (shape === 'aviator') {
          // 飛行員: a tall teardrop lens
          if (browline) browRim(R, 1, 1.18);
          else if (!rimless) {
            const ring = new THREE.Mesh(geo(`aviatorRim:${R},${T}`, () => new THREE.TorusGeometry(R, T, 6, 24)), rimM); ring.position.set(cx, gy, gz); ring.scale.set(1, 1.18, 1); face.add(ring);
          }
          const l = fm(disc(R - T * 0.5), frameLens, cx, gy, gz); l.rotation.x = Math.PI / 2; l.scale.z = 1.18;
        } else if (shape === 'hexagon' || shape === 'diamond' || shape === 'octagon') {
          // 六角 / 菱形 / 八角: a faceted rim, the lens cut to match
          const sides = shape === 'hexagon' ? 6 : shape === 'diamond' ? 4 : 8;
          if (browline && shape === 'octagon') {
            browArc(R, 0.0042, frameMat, -Math.PI / 8, 5 * Math.PI / 4, 5, 4);
            browArc(R, 0.0019, WIRE.metalSilver, 9 * Math.PI / 8, 3 * Math.PI / 4, 3, 4);
          } else if (browline) browRim(R, 1, 1, 0, sides / 2, 4);
          else if (!rimless) {
            const ring = new THREE.Mesh(geo(`${shape}Rim:${R},${T}`, () => new THREE.TorusGeometry(R, T, 4, sides)), rimM); ring.position.set(cx, gy, gz); ring.rotation.z = shape === 'octagon' ? Math.PI / 8 : 0; face.add(ring);
          }
          const l = fm(prism(R - T * 0.5, 0.003, sides), frameLens, cx, gy, gz); l.rotation.set(Math.PI / 2, 0, shape === 'octagon' ? Math.PI / 8 : 0, 'ZYX');
        } else {
          if (browline) browRim(R);
          else if (!rimless) {
            const ring = new THREE.Mesh(geo(`rim:${R},${T}`, () => new THREE.TorusGeometry(R, T, wire ? 6 : 8, wire ? 28 : 20)), rimM); ring.position.set(cx, gy, gz); face.add(ring);
          }
          fm(disc(R - T * 0.4), frameLens, cx, gy, gz).rotation.x = Math.PI / 2;
        }
        if (rimless) {
          const half = shape === 'rectangle' ? 0.04 : shape === 'wayfarer' ? 0.036 : shape === 'oval' ? 0.039 : shape === 'square' ? 0.036 : shape === 'aviator' ? 0.032 : 0.034;
          fm(sp(0.0035, 6, 4), wire || WIRE.metalSilver, s * (EX + half), gy, gz);
          fm(sp(0.0035, 6, 4), wire || WIRE.metalSilver, s * (EX - half), gy, gz);
        }
        if (wire) fm(sp(0.004, 6, 4), wire, s * (EX - 0.03), gy - 0.012, gz - 0.006);   // nose pads
      }
      const outer = EX + (style === 'aliang' ? AR + AT + 0.012 : outerAdd);
      // the arms: out to the side of the head and back to the ear (阿亮眼鏡's as thick as its rims, in their colour, from the wings)
      const [armM, aw, ay] = style === 'aliang' ? [frameMat, AT * 1.6, gy + 0.012] : wire ? [wire, 0.0035, gy + 0.004] : [frameMat, 0.007, gy + 0.004];
      fm(bx(earX - outer + 0.006, aw, aw), armM, s * (outer + earX) / 2, ay, gz);
      fm(bx(aw * 0.85, aw * 0.85, gz), armM, s * earX, ay, gz / 2);
    });
    if (style === 'aliang') {
      fm(bx(EX * 2 - AR * 2 + AT, 0.014, 0.012), frameMat, 0, gy + 0.016, gz);                     // a thick bridge, set high
      // the gold lines, like cracks mended in gold: a short one across the lower left of one rim, a long one from that
      // rim's top over the bridge onto the other's, and one down the far side of the other rim
      const zF = gz + AT * 0.8, rim = (cx, deg, k) => { const a = deg * Math.PI / 180, r = AR + AT * k; return new THREE.Vector3(cx + Math.cos(a) * r, gy + Math.sin(a) * r * 0.94, zF); };
      const line = pts => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0011, 4, false), goldM); face.add(m); };
      line([rim(-EX, 205, 1), rim(-EX, 200, 0), rim(-EX, 196, -1)]);
      line([rim(-EX, 40, -1), rim(-EX, 32, 0), new THREE.Vector3(-0.012, gy + 0.019, zF), new THREE.Vector3(0.012, gy + 0.021, zF), rim(EX, 148, 0), rim(EX, 128, 0.6), rim(EX, 112, 1)]);
      line([rim(EX, 32, 1), rim(EX, 18, 0.1), rim(EX, -10, 0), rim(EX, -32, -0.6), rim(EX, -40, -1)]);
    } else {
      if (wire) {   // a thin arched bridge
        const br = new THREE.Mesh(geo(`wireBridge:${EX.toFixed(4)}`, () => new THREE.TorusGeometry(EX - 0.038, 0.0019, 5, 12, Math.PI)), wire); br.position.set(0, gy + 0.004, gz); face.add(br);
      } else fm(bx(0.03, 0.007, 0.007), frameMat, 0, gy + 0.012, gz);                                 // bridge
      if (shape === 'aviator' && !rimless && !browline) fm(bx(EX * 2 - 0.074, 0.003, 0.004), wire || frameMat, 0, gy + 0.019, gz);
    }
  }

  // ---------------------------------------------------------------- arms: shoulder -> elbow -> hand
  const elbows = [], shoulderCaps = [];
  // (where the arms hang doesn't change with the clothes; a woman's closer in, with her narrower shoulders)
  const arms = [-0.235, 0.235].map(x => x * (1 - shoulderAt(1.16, femS))).map(x => {
    const s = Math.sign(x);
    const sh = new THREE.Group(); sh.position.set(x, 1.16, 0); g.add(sh);   // tucked under the slope of the shoulders
    // sleeves are cloth over the arm, not the arm in another colour: open at the end with their shadowed inside
    // showing, a rolled hem or cuff; a loose cut stands well clear of the arm
    // (無袖: no sleeve at all, the arm bare right up to the shoulder, where the top's own cloth ends round it)
    const long = clothesOf(look).sleeve === 'long', sleeveless = clothesOf(look).sleeve === 'none', S = long ? TF.s : 1, loose = topFit === 'oversize';
    // the arm's skin, the upper arm and forearm each tattooed in its own style or bare (under a long sleeve only the hand
    // would show, so nothing); the arm at -x is the person's right
    const side = s < 0 ? 'r' : 'l';
    const sleeveM = long ? sleeveCloth : inkedSkin(tat[side + 'u'], s < 0 ? 0 : 1, true), foreM = long ? sleeveCloth : inkedSkin(tat[side + 'f'], s < 0 ? 1 : 0);
    const lining = (rt, rb, h, y, par) => mk(cy(rt - 0.002, rb - 0.002, h, 14, true), shirtIn, 0, y, 0, par, false);   // the inside of a sleeve, seen at its opening
    const roll = (r, y, par) => { const e = mk(geo(`roll:${r.toFixed(3)}`, () => new THREE.TorusGeometry(r, 0.006, D(6, 3), D(24, 10))), shirtDark, 0, y, 0, par, false); e.rotation.x = Math.PI / 2; };   // a rolled edge round an opening
    // the upper arm: rounded over its top, fullest just below the shoulder, tapering to the elbow (open there, where
    // the forearm carries on)
    // (its profile runs from the bottom up, so its faces point outward)
    mk(lathe(`uarm3:${S.toFixed(2)}`, [[0.052, -0.27], [0.054, -0.2], [0.056, -0.1], [0.057, -0.035], [0.052, -0.004], [0.034, 0.014], [0.001, 0.02]].map(([r, y]) => [r * S, y]), 24), sleeveM, 0, 0, 0, sh);
    if (!long && !sleeveless) {
      // a short sleeve, one piece with the shoulder: rounded over the top where it joins, fullest there, easing a little
      // toward its open end, the arm showing inside it; a loose cut hangs away from the arm a touch, as cloth does
      // (a little clear of the arm all the way down, and with the arm's own number of sides, its edges lined up with the
      // arm's: in the café, drawn with fewer sides, the arm's corners otherwise poked out through the sleeve)
      const w = TF.s, L = TF.len, rt = 0.067 * w, rb = 0.065 * w;
      const sl = new THREE.Group(); sl.rotation.z = loose ? s * 0.09 : s * 0.03; sh.add(sl);
      mk(lathe(`sleeve:${w.toFixed(2)}:${L}`, [[rb, -L + 0.01], [rb * 1.01, -L * 0.55], [rt, -0.05], [rt * 0.97, -0.02], [rt * 0.82, 0.008], [rt * 0.5, 0.026], [0.001, 0.034]], 24), shirt, 0, 0, 0, sl);
      lining(rb + 0.001, rb, 0.06, -L + 0.04, sl);
      roll(rb, -L + 0.014, sl);                                                                         // the hem, rolled
    }
    // the shoulder itself, part of the body, not the arm: a rounded swell from the slope of the shoulders down over the
    // top of the arm, so the body runs on into the arm in one curve instead of a tube stuck to its side
    // (sunk into the body, its top below the shoulders' slope, so only its outer side shows, filling in between the body and
    // the top of the arm)
    // (a loose cut's is fuller, its cloth reaching out over where the sleeve begins)
    // (set in from the arm's own position, which a woman's shoulders bring closer in: a fixed x left it standing out
    // past the sleeve on a narrow build)
    // (sleeveless: no cap of its own: the bare shoulder is just the body and the top of the arm meeting, so no extra
    // lump sits on it)
    if (!sleeveless) {
      const setIn = loose ? 0.003 : 0.013, capX = x - s * setIn;
      const cap = loose ? mk(sp(1, 24, 16), sleeveCloth, capX, 1.14, 0) : mk(sp(1, 24, 16), sleeveCloth, capX, 1.138, 0);
      if (loose) cap.scale.set(0.082, 0.05, 0.074); else cap.scale.set(0.066 * Math.min(TF.s, 1.12), 0.046, 0.062);
      shoulderCaps.push({ cap, arm: sh, setIn });
    }
    const elbow = new THREE.Group(); elbow.position.set(0, -0.27, 0); sh.add(elbow); elbows.push(elbow);
    mk(sp(0.05 * S, 14, 10), long ? sleeveCloth : skin, 0, 0, 0, elbow);                                 // fills the elbow only when it bends
    const wrist = long ? (loose ? 0.05 : 0.046) * S : 0.044;
    mk(cy(0.052 * S, wrist, 0.24, 14, true), foreM, 0, -0.12, 0, elbow);                            // forearm, the same width where they meet
    if (long) {   // the cuff: a band at the wrist, the sleeve's inside showing round the hand; a loose sleeve bunches above it
      // (the 帽T's and jackets' a longer knitted rib, a varsity's striped)
      const cuffH = banded ? 0.05 : 0.03;
      mk(cy(wrist + 0.003, wrist + 0.003, cuffH, 14, true), banded ? ribM : shirtDark, 0, -0.24 + cuffH / 2, 0, elbow, false);
      lining(wrist + 0.003, wrist + 0.003, 0.04, -0.22, elbow); roll(wrist + 0.003, -0.238, elbow);
      if (topStyle === 'varsity') for (const dy of [-0.212, -0.222]) { const st = mk(geo(`cuffStripe:${wrist.toFixed(3)}`, () => new THREE.TorusGeometry(wrist + 0.004, 0.0025, D(5, 3), D(20, 10))), trimM, 0, dy, 0, elbow, false); st.rotation.x = Math.PI / 2; }
    }
    mk(sp(0.052, 12, 10), skin, 0, -0.285, 0.004, elbow).scale.set(0.82, 1.12, 0.68);              // hand
    mk(bx(0.024, 0.048, 0.028), skin, -s * 0.04, -0.27, 0.022, elbow, false).rotation.z = s * 0.45;   // thumb
    // 手錶: on the chosen wrist (the arm at -x is the person's right), the strap round it (over the cuff of a long
    // sleeve), its face on the back of the wrist, outward
    const W8 = watchOf(look);
    if (W8.wrist === (s < 0 ? 'right' : 'left')) {
      // (just up from the wrist)
      const wy = -0.212, r = (long ? wrist + 0.003 : wrist + (0.052 * S - wrist) * 0.12) + 0.003;   // (the forearm's width there)
      // the strap: a broad band with some thickness to it, its edges rounded
      const SH = 0.024, ST = 0.004, strap = [[r, -SH / 2], [r + ST * 0.7, -SH / 2], [r + ST, -SH / 2 + ST * 0.4], [r + ST, SH / 2 - ST * 0.4], [r + ST * 0.7, SH / 2], [r, SH / 2]];
      mk(geo(`watchStrap:${r.toFixed(4)}`, () => new THREE.LatheGeometry(strap.map(([x, y]) => new THREE.Vector2(x, y)), 24)), mat(picked(W8.color), { roughness: 0.6, side: THREE.DoubleSide }), 0, wy, 0, elbow, false);
      const R0 = r + ST;   // (the case sits on the strap)
      // its face, square to the back of the wrist, turned the way a watch is worn: 12 toward the back of the arm (away
      // from the thumb), 3 toward the hand
      const turn = m => { m.rotation.y = s * Math.PI / 2; m.rotateZ(-s * Math.PI / 2); return m; };
      const facePlane = (w, h, tex, dx) => turn(mk(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.1 }), s * (R0 + dx), wy, 0, elbow, false));
      if (W8.face === 'analog' || W8.face === 'mechanical') {
        // 指針: a round steel case, the face in its colour, a ring of hour marks and two hands (dark on a pale face); 機械錶
        // the same, its face cut open to show the gold movement turning underneath
        mk(cy(0.019, 0.019, 0.008, 24), silverM, s * (R0 + 0.003), wy, 0, elbow, false).rotation.z = Math.PI / 2;   // the case
        const disc = mk(new THREE.CircleGeometry(0.0158, 32), new THREE.MeshStandardMaterial({ map: watchTex(W8.face, W8.dial), roughness: 0.2, metalness: 0.2 }), s * (R0 + 0.0072), wy, 0, elbow, false);
        turn(disc);
      } else if (W8.face === 'digital') {
        // 電子錶: a squared black resin case, a grey-green (or the chosen colour) display showing the time in segments
        turn(mk(roundSlab(0.034, 0.03, 0.009, 0.006), mat(0x1c1c1f, { roughness: 0.55 }), s * (R0 + 0.0045), wy, 0, elbow, false));
        facePlane(0.024, 0.016, watchTex('digital', W8.dial), 0.0094);
      } else {
        // 智慧手錶: a tall rounded-square case in dark aluminium, all screen in front: black, the time and the three rings
        turn(mk(roundSlab(0.03, 0.036, 0.01, 0.009), mat(0x2b2d31, { roughness: 0.3, metalness: 0.7 }), s * (R0 + 0.005), wy, 0, elbow, false));
        facePlane(0.026, 0.032, watchTex('smart', W8.dial), 0.0104);
        mk(cy(0.0028, 0.0028, 0.004, 12), mat(0x9a9da3, { roughness: 0.3, metalness: 0.8 }), s * (R0 + 0.005), wy - 0.017, -0.007, elbow, false);   // the crown, on its side toward the hand, up by the 12
      }
    }
    return sh;
  });
  const hand = new THREE.Object3D(); hand.position.set(0, -0.3, 0.05); elbows[1].add(hand);
  const handL = new THREE.Object3D(); handL.position.set(0.01, -0.3, 0.04); elbows[0].add(handL);   // holds a cigarette
  // ---------------------------------------------------------------- build (身形): the body wider and deeper (a fuller
  // middle for the heavier builds), the arms and legs set out to match and a little thicker; head and height as they are
  const BLD = BUILDS[buildOf(look)];
  // (a woman's always: her upper back is brought in, see flat below)
  if (BLD.w !== 1 || BLD.d !== 1 || femB) {
    const limb = Math.sqrt(BLD.w);
    // (the body's own surfaces widened vertex by vertex, fully up to the shoulders, easing back to as-built up the neck,
    // so the neck still meets the head where it did and nothing pushes out through the jaw)
    // (fully on over the very tops of the shoulders, where the sleeves' rounded tops sit: eased off any lower, they stood
    // out as two lumps on a broad build)
    const k = y => { const q = Math.min(1, Math.max(0, (y - 1.21) / 0.12)); return 1 - q * q * (3 - 2 * q); };
    // (what's worn below the waist, the seat of the pants, the belt, the hips the legs hang from, only 70% as much, so the
    // shirt's hem always hangs out over the top of the pants)
    // (a woman's hips and thighs fill out nearly as much as the rest of her, so a fuller build is one soft line from the
    // belly and seat on down the legs)
    // (and a fuller build has fuller legs: the thighs and calves as much fuller as the seat, all but the same as the body)
    const LOW = femB ? 0.95 : 0.85, lower = new Set([seat, belt, buckle]);
    g.children.forEach(c => {
      if (c === head) return;
      if (arms.includes(c)) {
        // the arm set out with the body and fuller, but the upper arm and sleeve only from a little below the shoulder on
        // down (at the very top as built, so the sleeve's rounded top sits in under the slope of the shoulder as on a
        // standard build, rather than standing out as a lump); the forearm and hand, below the elbow, fuller throughout
        c.position.x *= BLD.w; c.position.z *= BLD.d; c.updateMatrixWorld(true);
        const inv = c.matrixWorld.clone().invert(), elbow = c.children.find(o => elbows.includes(o)), v = new THREE.Vector3();
        c.traverse(m => {
          if (!m.isMesh) return;
          for (let p = m.parent; p && p !== c; p = p.parent) if (p === elbow) return;
          const toArm = inv.clone().multiply(m.matrixWorld), back = toArm.clone().invert(), gm = m.geometry.clone(), pos = gm.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(toArm);
            const f = limb;   // (the whole arm, to its top, so the sleeve's top is as full as the shoulder it covers)
            v.x *= f; v.z *= f;
            v.applyMatrix4(back); pos.setXYZ(i, v.x, v.y, v.z);
          }
          m.geometry = gm;
        });
        if (elbow) { elbow.scale.x *= limb; elbow.scale.z *= limb; }
        return;
      }
      const leg = legs.find(l => l.hip === c);
      if (leg) {
        // the leg: set out with the seat, its thigh exactly as much fuller as the seat it grows out of (deeper at the top,
        // easing to the knee), the knee down to the shoe as much wider; scaled piece by piece, never the hip itself, so a
        // bent knee doesn't stretch the shin
        const fx = 1 + (BLD.w - 1) * LOW, fz = 1 + (BLD.d - 1) * LOW;
        c.position.x *= fx; c.position.z *= fz;
        c.children.forEach(o => {
          if (o === leg.knee || !o.isMesh) return;
          const gm = o.geometry.clone(), pos = gm.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i) + o.position.y, up = Math.min(1, Math.max(0, (y + THIGH) / THIGH));
            pos.setX(i, pos.getX(i) * fx);
            // (a fuller build's legs fuller behind only a little, as its back and seat are: see widen)
            const fzz = fz > 1 && pos.getZ(i) < 0 ? 1 + (fz - 1) * 0.45 : fz;
            pos.setZ(i, pos.getZ(i) * (fx + (fzz - fx) * up));
          }
          gm.computeVertexNormals(); if (o.geometry.userData.flatLit) { levelNormals(gm); gm.userData.flatLit = true; }
          o.geometry = gm;
        });
        // (the knee down: as wide as the thigh at the knee, the calf too, easing back to as built only just above the ankle,
        // so the shoes stay their size)
        leg.knee.updateMatrixWorld(true);
        leg.knee.traverse(m => {
          if (!m.isMesh) return;
          const toKnee = new THREE.Matrix4().copy(leg.knee.matrixWorld).invert().multiply(m.matrixWorld), back = toKnee.clone().invert();
          const gm = m.geometry.clone(), pos = gm.attributes.position, v = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(toKnee);
            // (the trousers' leg as much slimmer or fuller right down to its hem, so a slim build's trousers don't flare out to it)
            const q = m.userData.cloth ? 1 : Math.min(1, Math.max(0, (v.y + 0.25) / 0.13)), f = 1 + (fx - 1) * q * q * (3 - 2 * q);
            v.x *= f; v.z *= f; v.applyMatrix4(back); pos.setXYZ(i, v.x, v.y, v.z);
          }
          gm.computeVertexNormals(); if (m.geometry.userData.flatLit) { levelNormals(gm); gm.userData.flatLit = true; } m.geometry = gm;
        });
        return;
      }
      if (!c.isMesh) { const f = c === skirt ? LOW : 1; c.position.x *= 1 + (BLD.w - 1) * f; c.position.z *= 1 + (BLD.d - 1) * f; c.scale.x *= 1 + (BLD.w - 1) * f; c.scale.z *= 1 + (BLD.d - 1) * f; return; }
      const capFit = shoulderCaps.find(o => o.cap === c);
      if (capFit) {   // (the shoulder swell keeps the arm's own set-in and size, so a narrow or broad build doesn't carry it out past the sleeve)
        c.position.x = capFit.arm.position.x - Math.sign(capFit.arm.position.x) * capFit.setIn;
        return;
      }
      // (high-waisted pants: their top, up over the skin, as full as the body it's round)
      const lo = lower.has(c) ? LOW : 1;
      const widen = v => {
        // (the body and the seat: the build's fullness easing off from the waist on down to the crotch, as much as the
        // legs' there, so a heavy belly and seat round on down into the legs rather than ending in a point above them)
        const ramp = LOW + (1 - LOW) * (q => q * q * (3 - 2 * q))(Math.min(1, Math.max(0, (v.y - PANTS_TOP.crotch) / (0.88 - PANTS_TOP.crotch))));
        // (and over the slope of the shoulders a little fuller still across, so on a broad build it carries on out over the
        // sleeves' rounded tops instead of leaving them standing up as two lumps)
        const kv = k(v.y) * (c === belt || c === buckle ? lo : ramp), sh = c === belt || c === buckle ? 0 : -0.5 * Math.exp(-(((v.y - 1.16) / 0.045) ** 2));   // (and the very corners of the shoulders a little less, tucked in under the sleeves' tops as on a standard build)
        // (front to back only partly over the shoulders: a broad build's shoulders aren't much deeper, and fully deepened they
        // rounded out in front of the sleeves' tops, reading from the front as two lumps on them)
        const shz = (q => q * q * (3 - 2 * q))(Math.min(1, Math.max(0, (v.y - 1.06) / 0.1)));
        // (a slimmer build slimmer front to back all the way up, over the shoulders too: kept as built there, the upper back
        // stood out behind the slimmer body below as a lump. A fuller build fuller mostly in front, the belly: its back only
        // a little, so it rounds out gently rather than standing out behind as a hump)
        // (and a woman's upper back, which her waist doesn't draw in, brought in to run straight on up from it: left as it
        // was it stood out round the shoulder blades and she looked hunched; a slimmer one's more so)
        const dd = BLD.d - 1, zk = dd > 0 && v.z < 0 ? 0.45 : 1, zs = dd > 0 ? 1 - shz : 1;
        const flat = femB && v.z < 0 && c !== belt && c !== buckle && !lower.has(c) ? (0.055 + (dd < 0 ? 0.03 * Math.min(1, -dd / 0.18) : 0)) * Math.exp(-(((v.y - 1.08) / 0.1) ** 2)) : 0;
        // (nor her bust slimmed away with the rest of her front: it keeps most of its fullness)
        const keep = femB && dd < 0 && v.z > 0 && c !== belt && c !== buckle && !lower.has(c) ? 0.5 * Math.exp(-(((v.y - 1.05) / 0.08) ** 2)) * Math.exp(-(((Math.abs(v.x) - 0.085) / 0.09) ** 2)) : 0;
        v.x *= 1 + (BLD.w - 1) * (kv + sh); v.z *= (1 + dd * kv * zs * zk * (1 - keep)) * (1 - flat);
      };
      c.updateMatrix(); const inv = c.matrix.clone().invert(), gm = c.geometry.clone(), pos = gm.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(c.matrix);   // where it is on the body
        widen(v); v.applyMatrix4(inv); pos.setXYZ(i, v.x, v.y, v.z);
      }
      c.geometry = gm;   // (its normals kept: near enough for a gentle widening)
      if (c === seat) c.children.forEach(o => {   // (the jeans' stitching and pockets: laid on the seat, so widened with it)
        if (!o.isMesh) return;
        o.updateMatrix();
        const to = c.matrix.clone().multiply(o.matrix), back = to.clone().invert(), og = o.geometry.clone(), op = og.attributes.position, ov = new THREE.Vector3();
        for (let i = 0; i < op.count; i++) { ov.fromBufferAttribute(op, i).applyMatrix4(to); widen(ov); ov.applyMatrix4(back); op.setXYZ(i, ov.x, ov.y, ov.z); }
        og.computeVertexNormals(); if (o.geometry.userData.flatLit) { levelNormals(og); og.userData.flatLit = true; } o.geometry = og;
      });
    });
    [hand, handL].forEach(h => { h.scale.set(1 / limb, 1, 1 / limb); });   // (what's held stays its own size)
  }
  // ---------------------------------------------------------------- tucked in: whatever is worn below (the pants' seat and
  // all that's on it, the belt, the legs) kept inside the top wherever the top covers it, so however the cut, the
  // build and the shapes of either meet, none of it ever shows through the top, at its hem or anywhere above
  {
    g.updateMatrixWorld(true);
    // the top's own surface (only its cloth, not the skin it shares a surface with), slice by slice up the body: each slice
    // how far out it is round the body, by angle, read between its points
    const slices = new Map(), tgm = torso.geometry, tp = tgm.attributes.position, tv = new THREE.Vector3();
    const gr = tgm.groups.find(q => q.materialIndex === 0), ti = tgm.index.array, seen = new Set();
    for (let i = gr.start; i < gr.start + gr.count; i++) {
      const k = ti[i]; if (seen.has(k)) continue; seen.add(k);
      tv.fromBufferAttribute(tp, k).applyMatrix4(torso.matrixWorld); if (tv.y > 1.0) continue;
      const c = Math.round(tv.y * 500); if (!slices.has(c)) slices.set(c, []);
      slices.get(c).push([Math.atan2(tv.x, tv.z), Math.hypot(tv.x, tv.z)]);
    }
    const ys = [...slices.keys()].sort((a, b) => a - b).map(c => { const pts = slices.get(c).sort((a, b) => a[0] - b[0]); return [c / 500, pts]; }).filter(([, pts]) => pts.length >= 8);
    const around = (pts, a) => {   // a slice's reach at angle a, between its two nearest points (round the back, wrapping)
      let j = pts.findIndex(([pa]) => pa >= a); const [a1, r1] = j < 0 ? [pts[0][0] + 2 * Math.PI, pts[0][1]] : pts[j];
      const [a0, r0] = j <= 0 ? [pts[pts.length - 1][0] - (j === 0 ? 2 * Math.PI : 0), pts[pts.length - 1][1]] : pts[j - 1];
      return r0 + (r1 - r0) * (a - a0) / (a1 - a0 || 1);
    };
    // how far out what's below may come at (x, y, z) (null: as far as it likes): inside the top where it covers, and for a
    // little way below its hem no further out than the hem, easing away, so it comes out from under the hem, not through it
    const reach = (x, y, z, ease = true) => {
      if (ys.length < 2 || y > ys[ys.length - 1][0]) return null;
      const a = Math.atan2(x, z);
      if (y < ys[0][0] + 0.002) { const d = ys[0][0] + 0.002 - y; return ease && d < 0.03 ? around(ys[0][1], a) + d * 1.2 : null; }
      const j = ys.findIndex(([sy]) => sy >= y); if (j <= 0) return null;
      const [y0, p0] = ys[j - 1], [y1, p1] = ys[j];
      return around(p0, a) + (around(p1, a) - around(p0, a)) * (y - y0) / (y1 - y0 || 1);
    };
    // (and under a skirt or a dress's, inside that too: its waistband sits in close round the seat)
    const skirtYs = [];
    const readSkirt = () => { skirtYs.length = 0; if (skirt) {
      const sl = new Map(), sv = new THREE.Vector3();
      skirt.traverse(o => { if (!o.isMesh || !o.visible) return; const sp2 = o.geometry.attributes.position; for (let i = 0; i < sp2.count; i++) { sv.fromBufferAttribute(sp2, i).applyMatrix4(o.matrixWorld); const c = Math.round(sv.y * 500); if (!sl.has(c)) sl.set(c, []); sl.get(c).push([Math.atan2(sv.x, sv.z), Math.hypot(sv.x, sv.z)]); } });
      [...sl.keys()].sort((a, b) => a - b).forEach(c => { const pts = sl.get(c).sort((a, b) => a[0] - b[0]); if (pts.length >= 8) skirtYs.push([c / 500, pts]); });
    } };
    const reachSkirt = (x, y, z) => {
      if (skirtYs.length < 2 || y < skirtYs[0][0] || y > skirtYs[skirtYs.length - 1][0]) return null;
      const a = Math.atan2(x, z), j = skirtYs.findIndex(([sy]) => sy >= y); if (j <= 0) return null;
      const [y0, p0] = skirtYs[j - 1], [y1, p1] = skirtYs[j];
      return around(p0, a) + (around(p1, a) - around(p0, a)) * (y - y0) / (y1 - y0 || 1);
    };
    // the hem's roll, a ribbed band and its stripes: each drawn round an oval, brought out wherever the top itself stands
    // further out than that (round a seat behind), so it always lies on the top, never sunk inside it
    for (const { m, rx, rz, gap = 0 } of hemWear) {
      m.updateMatrixWorld(true);
      const p = m.geometry.attributes.position, inv2 = new THREE.Matrix4().copy(m.matrixWorld).invert(), w = new THREE.Vector3();
      // (as far out as the top reaches anywhere over its height: a band is straight up and down, the top it's over isn't)
      const bb = new THREE.Box3().setFromObject(m), lo = Math.max(bb.min.y, ys[0][0]), hi = Math.min(bb.max.y, ys[ys.length - 1][0]);
      const topOver = (x, z, a) => { let best = around(ys[0][1], a); for (let k = 0; k <= 6; k++) { const r = reach(x, Math.max(lo, Math.min(hi, lo + (hi - lo) * k / 6)) + 0.0001, z); if (r !== null && (k === 0 || r > best)) best = k === 0 ? r : Math.max(best, r); } return best; };
      // (where its middle line runs round now, direction by direction, half way between its inside and outside there: a
      // build has made it slimmer or fuller since it was drawn, and not by the same amount all round)
      const NA = 36, binA = a => ((Math.floor((a + Math.PI) / (2 * Math.PI) * NA) % NA) + NA) % NA, lo2 = new Array(NA).fill(Infinity), hi2 = new Array(NA).fill(0);
      for (let i = 0; i < p.count; i++) { w.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); const r = Math.hypot(w.x, w.z), b2 = binA(Math.atan2(w.x, w.z)); lo2[b2] = Math.min(lo2[b2], r); hi2[b2] = Math.max(hi2[b2], r); }
      const mid = a => { const b2 = binA(a); return isFinite(lo2[b2]) ? (lo2[b2] + hi2[b2]) / 2 : 1 / Math.sqrt((Math.sin(a) / rx) ** 2 + (Math.cos(a) / rz) ** 2); };
      let gm = null;
      for (let i = 0; i < p.count; i++) {
        w.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
        const a = Math.atan2(w.x, w.z), oval = mid(a);
        // (and on either side of it, half way to its neighbours: between its points it's a straight edge, the top round)
        const top = Math.max(...[-0.1, -0.05, 0, 0.05, 0.1].map(da => topOver(Math.sin(a + da), Math.cos(a + da), a + da)));
        const k = (top + gap) / oval; if (k <= 1) continue;
        if (!gm) gm = m.geometry.clone();
        w.x *= k; w.z *= k; w.applyMatrix4(inv2); gm.attributes.position.setXYZ(i, w.x, w.y, w.z);
      }
      if (gm) m.geometry = gm;
    }
    // (a skirt's waistband too, under the top, but nothing of it below there: its flare is meant to stand out below the hem)
    // 三角內褲 under a crop top, a little higher-waisted: its colour carried on up the bare waist a few centimetres, a band
    // lying on the body's own surface (under any other top its waist is hidden anyway)
    if (briefs && clothesOf(look).style === 'crop') {
      const rowsAll = new Map(), q = tgm.attributes.position;
      for (let i = 0; i < q.count; i++) { tv.fromBufferAttribute(q, i).applyMatrix4(torso.matrixWorld); if (tv.y > 0.9) continue; const c = Math.round(tv.y * 500); if (!rowsAll.has(c)) rowsAll.set(c, []); rowsAll.get(c).push([Math.atan2(tv.x, tv.z), Math.hypot(tv.x, tv.z)]); }
      const R = [...rowsAll.keys()].sort((a2, b2) => a2 - b2).map(c => [c / 500, rowsAll.get(c).sort((p2, q2) => p2[0] - q2[0])]).filter(([, p2]) => p2.length >= 8);
      const surf = (y, a) => { let j = R.findIndex(([ry]) => ry >= y); if (j <= 0) j = j < 0 ? R.length - 1 : 1; const [y0b, p0] = R[j - 1], [y1b, p1] = R[j]; return around(p0, a) + (around(p1, a) - around(p0, a)) * Math.min(1, Math.max(0, (y - y0b) / (y1b - y0b || 1))); };
      const NA = 72, YS = [0.718, 0.728, 0.738, 0.748], pos = [], ix = [];
      for (const y of YS) for (let i = 0; i <= NA; i++) { const a = (i / NA) * Math.PI * 2 - Math.PI, r = surf(y, a) * 1.004 + 0.0006; pos.push(Math.sin(a) * r, y, Math.cos(a) * r); }
      for (let r = 0; r < YS.length - 1; r++) for (let i = 0; i < NA; i++) { const a = r * (NA + 1) + i, b2 = a + NA + 1; ix.push(a, a + 1, b2, b2, a + 1, b2 + 1); }
      const bandG = new THREE.BufferGeometry(); bandG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bandG.setIndex(ix); bandG.computeVertexNormals();
      const band = mk(bandG, pants, 0, 0, 0, g, false); band.matrixAutoUpdate = true; cover.push(band);
    }
    // a dress is one piece: its skirt's top brought in or out to the top's own hem all round (her waist, her seat), so the
    // skirt runs straight on from it and out over the hips below, no rim standing out where the two meet
    if (dress && skirt) {
      const hg = skirt.userData.hang; hg.updateMatrixWorld(true);
      const hp = hg.geometry.attributes.position, hinv = new THREE.Matrix4().copy(hg.matrixWorld).invert(), hv = new THREE.Vector3(), hm = hg.geometry.clone(), y0 = ys[0][0];
      for (let i = 0; i < hp.count; i++) {
        hv.fromBufferAttribute(hp, i).applyMatrix4(hg.matrixWorld);
        const a = Math.atan2(hv.x, hv.z), r = Math.hypot(hv.x, hv.z), rh = around(ys[0][1], a) - 0.0015;
        const t = Math.min(1, Math.max(0, (y0 - hv.y) / 0.09)), e = t * t * (3 - 2 * t);
        // (below it, straight down at the hem's own size and shape, all but imperceptibly wider by the bottom)
        const want = hv.y >= y0 ? Math.min(r, rh - 0.002) : rh * (1 + 0.03 * Math.min(1, (y0 - hv.y) / 0.5)) + 0.002 * e;
        hv.x *= want / r; hv.z *= want / r; hv.applyMatrix4(hinv); hm.attributes.position.setXYZ(i, hv.x, hv.y, hv.z);
      }
      hm.computeVertexNormals(); levelNormals(hm);
      // (both lit level where they meet, the top's last few centimetres too, which otherwise faced down at its edge:
      // no line between them)
      const tg2 = torso.geometry.clone(), tn2 = tg2.attributes.normal, tq = tg2.attributes.position, nv = new THREE.Vector3();
      for (let i = 0; i < tq.count; i++) { tv.fromBufferAttribute(tq, i).applyMatrix4(torso.matrixWorld); const t = Math.min(1, Math.max(0, (tv.y - y0) / 0.06)); if (t >= 1) continue; nv.fromBufferAttribute(tn2, i); const lv = nv.clone().setY(0).normalize(); nv.lerp(lv, 1 - t).normalize(); tn2.setXYZ(i, nv.x, nv.y, nv.z); }
      torso.geometry = tg2; torsoSkin.geometry = tg2;
      // (and how it's pushed out in front and behind by the legs as they step: nothing at the waist, more toward the hem;
      // people.js sets how much as they walk)
      const hp2 = hm.attributes.position, step = new Float32Array(hp2.count * 3);
      for (let i = 0; i < hp2.count; i++) { hv.fromBufferAttribute(hp2, i).applyMatrix4(hg.matrixWorld); const t = Math.min(1, Math.max(0, (y0 - 0.04 - hv.y) / 0.22)), e = t * t * (3 - 2 * t); step[i * 3 + 2] = hp2.getZ(i) * 0.2 * e; }
      hg.userData.step = { base: Float32Array.from(hp2.array), dz: step, k: 0 };
      hg.geometry = hm;
    }
    // (the skirt first, then what's under it kept inside it as it then is)
    const roots = [dress ? null : skirt, 'read', seat, belt, buckle, ...legs.map(l => l.hip), ...cover].filter(Boolean), done = new Set(), wv = new THREE.Vector3(), inv = new THREE.Matrix4();
    roots.forEach(root => root === 'read' ? (g.updateMatrixWorld(true), readSkirt()) : root.traverse(m => {
      if (!m.isMesh || done.has(m)) return; done.add(m);
      const waistOnly = root === skirt;
      const p = m.geometry.attributes.position; inv.copy(m.matrixWorld).invert();
      let gm = null;
      for (let i = 0; i < p.count; i++) {
        wv.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
        // (the top where it covers; a skirt's waist too, and just under the hem its flare is held in to the hem's own
        // reach until it can ease out below it, so the lowest row of the flare can't cut across the shirt)
        const r1 = reach(wv.x, wv.y, wv.z, false), r2 = waistOnly ? null : reachSkirt(wv.x, wv.y, wv.z);
        const rs = r1 !== null ? (r2 !== null ? Math.max(r1, r2) : r1) : r2 !== null ? r2 : reach(wv.x, wv.y, wv.z); if (rs === null) continue;
        // (only where it comes through by a little: a skirt flaring out under a long coat is the cut, left as it is;
        // a skirt's own waistband, though, is tucked all the way in under the top, however far it had flared)
        const r = Math.hypot(wv.x, wv.z), lim = rs - 0.004; if (r <= lim || (!waistOnly && r > lim + 0.03)) continue;
        if (!gm) gm = m.geometry.clone();   // (cached geometry is shared: changed only in this person's own copy)
        const f = Math.max(0, lim) / r; wv.x *= f; wv.z *= f; wv.applyMatrix4(inv);
        gm.attributes.position.setXYZ(i, wv.x, wv.y, wv.z);
      }
      if (gm) m.geometry = gm;   // (its normals kept: moved a few millimetres in, under the top, where nobody sees it lit)
    }));
  }
  // a cup's own anchor, outside the arms: the arms are widened non-uniformly by the build, which would otherwise squash
  // whatever they hold as soon as the elbow turns (set back to the body's own scale in height, below)
  const cupHand = new THREE.Object3D(); g.add(cupHand);
  // the controller: a PS5 DualSense, white with a black middle, the white touchpad up top ringed by its blue light,
  // two black sticks, the face buttons and the d-pad, and the long white grips curving down
  const pad = new THREE.Group();
  const padW = mat(0xf2f2ee, { roughness: 0.5 }), padB = mat(0x151517, { roughness: 0.45 });
  mk(bx(0.15, 0.03, 0.07), padW, 0, 0, 0, pad);
  [-1, 1].forEach(s => { const grip = mk(sp(0.032, 12, 10), padW, s * 0.07, -0.012, -0.03, pad, false); grip.scale.set(0.9, 0.85, 1.5); });   // grips
  mk(bx(0.07, 0.008, 0.04), padB, 0, 0.016, -0.012, pad, false);                                                // the black middle
  mk(bx(0.06, 0.006, 0.028), padW, 0, 0.018, 0.02, pad, false);                                                 // the touchpad
  mk(bx(0.064, 0.004, 0.003), mat(0x3a8cff, { emissive: 0x3a8cff, emissiveIntensity: 1.2 }), 0, 0.017, 0.036, pad, false);   // its light bar
  [-1, 1].forEach(s => mk(cy(0.011, 0.011, 0.012, 10), padB, s * 0.022, 0.024, -0.016, pad, false));           // sticks
  [[0.05, 0.008], [0.05, -0.008], [0.042, 0], [0.058, 0]].forEach(([x, z]) => mk(sp(0.004, 6, 4), mat(0xb8b8bc), x, 0.017, z, pad, false));   // face buttons
  mk(bx(0.018, 0.004, 0.006), padB, -0.05, 0.017, 0, pad, false); mk(bx(0.006, 0.004, 0.018), padB, -0.05, 0.017, 0, pad, false);          // d-pad
  pad.position.set(0, 0.95, 0.43); pad.visible = false; g.add(pad);
  // ---------------------------------------------------------------- height (身高): the whole of them taller or shorter,
  // all but the head, which stays its own size (a tall person has longer legs and body, not a bigger head). Whatever
  // places them by height (the hips on a seat, a squat, their shadow) takes heightK into account (people.js)
  const heightK = HEIGHT_K[heightOf(look)] || 1;
  if (heightK !== 1) {
    g.scale.setScalar(heightK); head.scale.setScalar(1 / heightK);
    cupHand.scale.setScalar(1 / heightK);
    // (the neck, flaring up into the underside of the head, taken back to the head's own width as it rises, or, scaled
    // with the body, it stood out round the jaw of a taller person and fell short inside a shorter one's)
    const tg = torso.geometry.clone(), tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      // (and set where it meets the head as high as it is on the head itself, which stays its own size: scaled with the
      // body, the flare under the jaw came out lower than the jaw)
      const y = tp.getY(i), t0 = Math.min(1, Math.max(0, (y - 1.25) / 0.07)), t = t0 * t0 * (3 - 2 * t0), f = 1 + (1 / heightK - 1) * t;
      tp.setXYZ(i, tp.getX(i) * f, y + t * ((y - 1.44) / heightK + 1.44 - y), tp.getZ(i) * f);
    }
    torso.geometry = tg;   // (its normals kept: near enough, and its seam's normals stay matched)
    torsoSkin.geometry = tg;   // (the same surface's skin, the neck itself, drawn from it)
  }
  return { g, legs, arms, elbows, head, hand, handL, cupHand, pad, eyes, mouth, skirt, heightK, skinM: skin, strip: { bare, bunch, cover, pants, skin } };
}

// hats, each a shell round its own tipped crown down to a front edge `elev` above the eyes; own is the hat's own thickness
// (elev: how high the hat's front edge comes on the forehead, in radians up from the eyes' level: clear of the brows,
// which are tucked down under it)
const HATS = { cap: { tilt: 0.25, elev: 0.52, own: 0.012 }, bucket: { tilt: 0.1, elev: 0.52, own: 0.014 }, beanie: { tilt: 0.42, elev: 0.5, own: 0.016 },
  fedora: { tilt: 0.12, elev: 0.5, own: 0.012 }, beret: { tilt: 0.25, elev: 0.6, own: 0.008 } };   // (the beanie pulled down a little lower, its crown slouching back)
// the top of the head for each way the front can go: the hairline (radians above the eyes' horizon) all the way round,
// and how full it stands, both by φ, the angle from straight ahead; lift is how far it stands off the head at most
const line = phi => -0.16 + 0.66 * Math.cos(phi);                          // just above the brows, past the temples, down the nape
const lobe = (phi, at0, p) => Math.max(0, Math.cos(phi - at0)) ** p;      // a bump centred on angle at0
const ang = phi => Math.atan2(Math.sin(phi), Math.cos(phi));               // -π..π, 0 straight ahead
// a parting at angle at0: cut deep down the middle, the hair either side standing up a little, so it shows clearly
const parting = (at0, depth) => phi => depth * Math.exp(-((ang(phi - at0) / 0.09) ** 2));   // only a soft crease along it
// the strands either side of a parting: running away from it at an angle, down toward the temples, the hair on one
// side (`steepA`, the side toward +φ) and the other (`steepB`) can fall at different angles. Round the back of the head
// they turn back into plain strands straight down from the crown
const partFlow = (at0, steepA, steepB) => (phi, t) => {
  const d = ang(phi - at0), radial = (ang(phi) + Math.PI) / (2 * Math.PI) * 6;
  const away = t * 3 - Math.sqrt(d * d + 0.01) * (d > 0 ? steepA : steepB), w = Math.exp(-((d / 1.1) ** 2));
  return radial * (1 - w) + away * w;
};
const FRONTS = {
  // no fringe: combed back off the forehead, the hairline well up so the forehead shows
  none: { edge: phi => line(phi) + 0.26 * lobe(phi, 0, 2), thick: () => 0.012, lift: 0.012 },
  // a fringe: down to the brows and cut almost straight across, standing out full over the forehead
  bangs: { edge: phi => line(phi) + (0.45 - line(phi)) * lobe(phi, 0, 4), thick: phi => 0.012 + 0.014 * lobe(phi, 0, 1.5), lift: 0.026 },   // just above the brows
  // parted in the middle: the hairline lifts at the centre of the forehead and the hair falls away to both sides,
  // fuller over the temples, with a shallow parting line running back from the front
  center: {
    edge: phi => line(phi) + 0.3 * Math.exp(-((ang(phi) / 0.34) ** 2)) - 0.02 * (lobe(phi, 0.6, 6) + lobe(phi, -0.6, 6)),   // high in the middle, the forehead showing, the hair falling away either side
    thick: phi => 0.016 + 0.008 * (lobe(phi, 0.6, 3) + lobe(phi, -0.6, 3)), lift: 0.026,
    part: 0, groove: parting(0, 0.006), flow: partFlow(0, 2.6, 2.6),
  },
  // parted on one side: a clear parting over one eye, the hair swept over from it, low and full over the other brow,
  // short and close on the parting's side, with a notch in the hairline where the parting meets it
  side: {
    edge: phi => line(phi) - 0.18 * lobe(phi, -0.5, 3) + 0.06 * lobe(phi, 0.75, 3) + 0.14 * Math.exp(-(((ang(phi) - 0.45) / 0.09) ** 2)),
    thick: phi => 0.014 + 0.02 * lobe(phi, -0.4, 2), lift: 0.034,
    part: 0.45, groove: parting(0.45, 0.008), flow: partFlow(0.45, 3.6, 1.4),   // short and steep on the parting's side, a long low sweep across the forehead
  },
};
const CURL_TOP = 0.018;     // how far curls stand out of the top of the head
// the hair hanging round the back and sides for each length, as a profile below the widest part of the head (w, y0)
const LENGTHS = {
  // a man's short-long cut: half over the ears, a little fuller at the nape, the ends turned in
  bob: (w, y0) => [[w + 0.006, y0 - 0.025], [w + 0.01, y0 - 0.05], [w + 0.008, y0 - 0.068], [w + 0.001, y0 - 0.076], [w - 0.006, y0 - 0.078]],
  medium: (w, y0) => [[w + 0.004, y0 - 0.07], [w + 0.01, y0 - 0.15], [w + 0.016, y0 - 0.22], [w + 0.018, y0 - 0.26], [w + 0.006, y0 - 0.285], [w - 0.008, y0 - 0.29]],   // to the shoulders, ends turned under
  long: (w, y0) => [[w + 0.004, y0 - 0.08], [w + 0.012, y0 - 0.19], [w + 0.026, y0 - 0.29], [w + 0.008, y0 - 0.33]],
};
const CURLY_LENGTHS = {   // curls take up a little more room, a little fuller toward the ends
  // the Japanese wet-perm look: short, loose waves lying fairly close round the ears and nape
  bob: (w, y0) => [[w + 0.008, y0 - 0.025], [w + 0.014, y0 - 0.05], [w + 0.016, y0 - 0.07], [w + 0.008, y0 - 0.084], [w - 0.002, y0 - 0.088]],
  medium: (w, y0) => [[w + 0.006, y0 - 0.06], [w + 0.012, y0 - 0.13], [w + 0.018, y0 - 0.2], [w + 0.0204, y0 - 0.25], [w + 0.012, y0 - 0.28], [w + 0.0024, y0 - 0.29]],
  long: (w, y0) => [[w + 0.0072, y0 - 0.06], [w + 0.012, y0 - 0.13], [w + 0.018, y0 - 0.2], [w + 0.0228, y0 - 0.27], [w + 0.0252, y0 - 0.33], [w + 0.0168, y0 - 0.37], [w + 0.0036, y0 - 0.38]],
};

// the same, for a length set in cm with − / + (L metres below the widest part of the head): down at a gentle slope,
// fuller toward the ends the longer it is, the ends turned under
const tailFor = (L, curly) => (w, y0) => {
  const full = Math.min(0.026, 0.008 + 0.05 * L) + (curly ? 0.004 : 0), pts = [];
  for (const f of [0.22, 0.45, 0.68, 0.86]) pts.push([w + 0.004 + full * Math.sin(f * Math.PI / 2) ** 0.8, y0 - L * f]);
  pts.push([w + full * 0.4, y0 - L * 0.97], [w - 0.008, y0 - L]);
  return pts;
};

// the hair first, built from its parts (length, straight / curly, the front, tied up or not), then the hat
// (if any) put on over it, made bigger by however far the hair stands off the head so nothing pokes through it
function buildHair(hairParts, shape, head, hairM, mk, at, look) {
  const { length, curl, front, tie, cm } = hairParts;
  const hairStart = head.children.length;   // (everything added to the head from here till the hat is the hair)
  const HL = cm !== undefined ? Math.max(0.03, cm / 100) : null;   // (a length set in cm: how far it hangs, in metres)
  const TILT = 0.66;                                    // the old tipped crown, still used to spread spikes

  // the hat this person wears, worked out first so the hair can keep out from under it
  const { hat: hatStyle, color: hatColor } = hatOf(look);
  const H = HATS[hatStyle];
  const hatN = H ? crown(H.tilt) : null, hatA = H ? coverFor(H.tilt, H.elev) : 0;
  const underHat = (u, margin) => !!H && Math.acos(Math.max(-1, Math.min(1, u.dot(hatN)))) < hatA + margin;
  const hatBack = H ? Math.PI / 2 - hatA - H.tilt : 9;  // the height (radians) of the hat's edge straight behind
  const backAt = e => at(0, Math.sin(e), -Math.cos(e)); // the point at height e straight behind
  // spread small pieces evenly over the part of the head the hair covers, skipping any a hat would sit on
  const scatter = (limit, margin, place, axis = crown(TILT)) => FIB.forEach(u => {
    const a = Math.acos(u.dot(axis));
    if (a < limit && !underHat(u, margin)) place(u, at(u.x, u.y, u.z));
  });
  // a curtain round the back and sides, open at the face; its top follows the head's own outline right up to the
  // crown, lying just over the cap, so the back of the head is one surface. tail(w, y0) gives the profile below;
  // `curls` turns it into ringlets, starting a little below the crown and deepening toward the ends
  const curtain = (key, tail, curls = 0) => {
    const prof = [];
    for (let k = 0; k <= 6; k++) {
      const t = 0.12 + k * (1.55 - 0.12) / 6, ps = at(Math.sin(t), Math.cos(t), 0), pb = at(0, Math.cos(t), -Math.sin(t));
      // (as wide as the head is anywhere round the back and sides at that height, the corners of a squarer head
      // included, not only straight to the side or behind, or the top's hair pokes through it there)
      let r = Math.max(ps.x, -pb.z);
      for (let s = 0; s <= 16; s++) { const ph = 0.85 + (Math.PI * 2 - 1.7) * s / 16, q = at(Math.sin(t) * Math.sin(ph), Math.cos(t), Math.sin(t) * Math.cos(ph)); r = Math.max(r, Math.hypot(q.x, q.z)); }
      prof.push([r + 0.0185 + 0.005 * (k / 6), (ps.y + pb.y) / 2]);   // just clear of the top's fullest, so the two meet without a seam
    }
    const [w, y0] = prof[prof.length - 1];
    prof.push(...tail(w, y0));
    // the way back up the inside: from the ends in under the hair to the nape, then up against the head (just inside its
    // surface), so the hair is one solid mass with no hollow under it or gap beside the head
    const headR = y => Math.max(0.055, w - 0.0235 - 0.9 * (y0 - y));
    const yEnd = prof[prof.length - 1][1];
    const inside = [[headR(yEnd), yEnd + 0.002]];
    for (let k = prof.length - 2; k >= 7; k--) inside.push([headR(prof[k][1]), prof[k][1]]);
    for (let k = 6; k >= 0; k--) inside.push([prof[k][0] - 0.0185 - 0.005 * (k / 6) - 0.003, prof[k][1]]);
    if (!curls) {   // straight: cut in soft layers down the back, each tier swelling a little toward its lower edge
      const layered = prof.slice(0, 7);
      for (let k = 7; k < prof.length; k++) {
        const [r0, ya] = prof[k - 1], [r1, yb] = prof[k], n = Math.max(1, Math.ceil(Math.abs(yb - ya) / 0.004));
        for (let i = 1; i <= n; i++) {
          const y = ya + (yb - ya) * i / n, end = k === prof.length - 1 && i === n;
          layered.push([r0 + (r1 - r0) * i / n + (end ? 0 : LAYER_DEPTH * tier((y0 - y) / 0.05)), y]);
        }
      }
      mk(geo(`curtain6:${shape}:${key}`, () => {
        const lg = new THREE.LatheGeometry(layered.concat(inside).map(([r, y]) => new THREE.Vector2(r, y)), D(48, 12), 0.85, Math.PI * 2 - 1.7);
        closeEdges(lg, 0.85, Math.PI * 2 - 1.7, inside); lg.computeVertexNormals(); return lg;
      }), hairM, 0, 0, 0, head);
    }
    else {   // curls: the locks ending at their own lengths, not cut straight across
      const top = prof[3][1], bottom = prof[prof.length - 1][1], strength = y => Math.max(0, Math.min(1, (top - y) / (top - bottom) * 1.6));
      mk(ringletLathe(`${shape}:${key}`, prof, 120, 0.85, Math.PI * 2 - 1.7, curls, strength, 0, 0.02, inside), hairM, 0, 0, 0, head);
    }
  };

  let lift = 0;
  // a bowl-cut cap of hair (蘑菇頭, 阿志頭): one thick even layer down to a cut edge (its own hairline edge(φ)), full
  // and blunt there, swelling a little toward the edge like a mushroom's cap
  const bowl = (key, edge, th) => mk(capGeo(shape, `${key}:${th}`, edge, () => th * 0.7, u => th * 0.55 * Math.max(0, 1 - u.y) ** 1.2), hairM, 0, 0, 0, head);
  if (length === 'mushroom') {
    // 蘑菇頭: a round helmet of hair, the fringe cut straight across just above the brows, the sides and back falling
    // straight to the bottom of the ears all round
    bowl('mushroom1', phi => { const a = Math.abs(ang(phi)), s = Math.min(1, Math.max(0, (a - 0.62) / 0.5)), e = s * s * (3 - 2 * s); return 0.5 + (-0.3 - 0.5) * e; }, 0.048);
    lift = 0.056;
  } else if (length === 'azhi') {
    // 阿志頭: a thick bowl on top, cut in one sharp level line round the head (a blunt straight fringe across the
    // forehead), and under it the sides and back clipped short and faded, as a 平頭's are
    buzzLayer(0.32);   // (clipped closer under it than a 平頭, so the step from the top shows)
    // (more a longer 平頭 on top than a helmet: a thinner layer, little flare, its line cut higher round the sides)
    // (and thick in front, the fringe jutting out over the forehead, blunt-cut, like a visor)
    // (its thickness at the cut edge, which stays full right to the edge: deep across the front, close at the sides)
    const jut = phi => 0.022 + 0.056 * Math.max(0, Math.cos(phi)) ** 2;   // (blunt all round: a clear step down to the clipped sides)
    mk(capGeo(shape, 'azhi7', phi => { const a = Math.abs(ang(phi)), s = Math.min(1, Math.max(0, (a - 0.55) / 0.7)), e = s * s * (3 - 2 * s); return 0.62 + (0.46 - 0.62) * e; }, jut, u => 0.004 * Math.max(0, 1 - u.y), null, null, 0.0015), hairM, 0, 0, 0, head);
    lift = 0.03;
  } else if (length === 'spiky') {
    buzzLayer(0.4, -0.78);
    const rnd = seeded(`${shape}:spiky:${hatStyle || ''}`), up = new THREE.Vector3(0, 1, 0);
    const earL = new THREE.Vector3(0.97, -0.23, 0.12).normalize(), earR = new THREE.Vector3(-0.97, -0.23, 0.12).normalize();
    scatter(1.54, 0.4, (u, p) => {
      if (u.dot(earL) > 0.95 || u.dot(earR) > 0.95) return;
      const h = 0.07 + rnd() * 0.035, r = 0.024 + rnd() * 0.012;
      const s = mk(cy(0, r, h, 6), hairM, p.x + u.x * h * 0.42, p.y + u.y * h * 0.42, p.z + u.z * h * 0.42, head);
      s.quaternion.setFromUnitVectors(up, u);
      s.scale.set(0.85 + rnd() * 0.3, 1, 0.85 + rnd() * 0.3);
    }, crown(0.7));
    lift = 0.02;
  } else if (length === 'pompadour') {
    buzzLayer(0.3);
    const edge = phi => { const a = Math.abs(ang(phi)), s = Math.min(1, Math.max(0, (a - 0.35) / 0.8)), e = s * s * (3 - 2 * s); return 0.64 + (0.3 - 0.64) * e; };
    const jut = phi => 0.016 + 0.05 * Math.max(0, Math.cos(phi)) ** 2 + 0.012 * Math.sin(phi) ** 2;
    const bump = u => 0.07 * Math.exp(-(((u.y - 0.6) / 0.24) ** 2 + ((u.z - 0.55) / 0.27) ** 2 + (u.x / 0.42) ** 2))
      + 0.02 * Math.exp(-(((u.y - 0.2) / 0.3) ** 2 + ((u.z + 0.38) / 0.35) ** 2 + (u.x / 0.52) ** 2));
    mk(capGeo(shape, 'pompadour', edge, jut, bump, null, null, 0.0015), hairM, 0, 0, 0, head);
    lift = 0.035;
  } else if (length === 'buzz') {
    buzzLayer();
    lift = 0.01;
  }
  function buzzLayer(minHair = 0.55, nape = -0.6) {
    // 平頭: a short crew cut, faded. The top an even short layer (about a centimetre), following the head's own round;
    // the sides and back faded down close, so they read lighter, the skin showing through, darkest on top. Its hairline:
    // straight across the forehead, a squared corner at each temple, short sideburns in front of the ears, arching up
    // over each ear, and down the back to a faded nape
    // (down round the ears, which sit over it, and on down the back to the nape)
    const HL = [[0, 0.72], [0.5, 0.71], [0.72, 0.64], [0.86, 0.46], [1.0, 0.12], [1.15, -0.12], [1.5, -0.16], [1.9, -0.2], [2.3, -0.36], [2.7, -0.55], [Math.PI, nape]];
    const hairlineAt = phi => {
      const a = Math.abs(ang(phi));
      for (let k = 1; k < HL.length; k++) if (a <= HL[k][0]) { const [a0, e0] = HL[k - 1], [a1, e1] = HL[k], t = (a - a0) / (a1 - a0), s = t * t * (3 - 2 * t); return e0 + (e1 - e0) * s; }
      return HL[HL.length - 1][1];
    };
    // (its thickness all in the bump, thinning away over the last rows at the hairline: an even short top, faded
    // down to a mere shadow round the sides and back)
    const top = u => Math.min(1, Math.max(0, (u.y + 0.1) / 0.6)), even = u => { const s = top(u); return 0.0012 + 0.0024 * s * s * (3 - 2 * s); };   // (the top cropped short)
    const geo0 = capGeo(shape, 'buzz6', hairlineAt, () => 0.001, even), g2 = geo0.clone(), pp = g2.attributes.position, col = [];
    // the fade, in its colour: the hair's on top, toward the skin's down the sides and back
    const hc = new THREE.Color(picked(look.hair)), sc = new THREE.Color(picked(look.skin)), cc = new THREE.Color(), uu = new THREE.Vector3();
    // (a long gradual fade, from just above the ears and nape up to the top: no line where it changes)
    for (let i = 0; i < pp.count; i++) { uu.fromBufferAttribute(pp, i).normalize(); const f = Math.min(1, Math.max(0, (uu.y + 0.35) / 0.95)); cc.copy(sc).lerp(hc, minHair + (1 - minHair) * f * f * (3 - 2 * f)); col.push(cc.r, cc.g, cc.b); }
    g2.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const buzzM = hairM.clone();
    buzzM.color = new THREE.Color(0xffffff); buzzM.vertexColors = true;
    buzzM.map = hairM.map.clone(); buzzM.map.repeat.set(70, 1); buzzM.map.needsUpdate = true;
    mk(g2, buzzM, 0, 0, 0, head);
  }
  if (!['bald', 'buzz', 'mushroom', 'azhi', 'spiky', 'pompadour'].includes(length)) {
    // the top of the head: shaped by the front, with curls in its surface if it's curly
    const F = FRONTS[front] || FRONTS.none, curly = curl === 'curly';
    const amp = length === 'short' ? 0.02 : length === 'bob' ? 0.016 : CURL_TOP;   // the wet perm lies fairly close
    mk(capGeo(shape, `${front}${curly ? `:waves${amp}` : ':flow'}`, F.edge, F.thick, curly ? curlLumps(amp) : null, F.groove, F.flow), hairM, 0, 0, 0, head);
    lift = F.lift + LAYER_DEPTH + (curly ? amp : 0);
    // what hangs below: left loose to its length, or pulled back and tied
    const long = length === 'medium' || length === 'long';   // long enough to tie back
    const hangs = long || length === 'bob';
    if (tie === 'halfup' && long) {
      // 半丸子頭: a small bun on the crown, the rest of the hair left down
      const e = H ? Math.min(0.8, hatBack - 0.28) : 0.8, p = backAt(e), out = new THREE.Vector3(0, Math.sin(e), -Math.cos(e));
      mk(sp(curly ? 0.065 : 0.058, 14, 12), hairM, p.x + out.x * 0.04, p.y + out.y * 0.04, p.z + out.z * 0.04, head);
    }
    if (tie === 'bun' && long) {
      // up on the crown, or, under a hat, a low bun below its edge at the back
      const e = H ? Math.min(0.86, hatBack - 0.3) : 0.86, p = backAt(e), out = new THREE.Vector3(0, Math.sin(e), -Math.cos(e));
      mk(sp(curly ? 0.085 : 0.075, 14, 12), hairM, p.x + out.x * 0.05, p.y + out.y * 0.05, p.z + out.z * 0.05, head);
    } else if (tie === 'ponytail' && long) {
      const p = backAt(H ? Math.min(0.15, hatBack - 0.22) : 0.15), L = HL !== null ? Math.min(1.7, Math.max(0.6, HL / 0.33)) : length === 'long' ? 1 : 0.7, R = curly ? 1.25 : 1;
      mk(cy(0.038, 0.038, 0.03, 12), mat(picked(tieColorOf(look)), { roughness: 0.6 }), p.x, p.y, p.z - 0.012, head).rotation.x = Math.PI / 2;   // the hair tie, in its colour
      const tail = mk(lathe(`tail:${L}:${R}`, [[0.001, 0.02], [0.04 * R, 0], [0.05 * R, -0.08 * L], [0.035 * R, -0.2 * L], [0.012 * R, -0.28 * L], [0, -0.29 * L]], 14), hairM, p.x, p.y - 0.01, p.z - 0.04, head);
      tail.rotation.x = 0.35;
    } else if (tie === 'twintails' && long) {
      // 雙馬尾: one each side, tied high behind the ears, hanging down and splaying a little out from the head, each in a
      // hair tie (under a hat, tied lower, below its edge)
      const e = H ? Math.min(0.22, hatBack - 0.25) : 0.22, az = 0.95, L = HL !== null ? Math.min(1.5, Math.max(0.55, HL / 0.37)) : length === 'long' ? 0.9 : 0.65, R = curly ? 1.2 : 0.9;
      const tieM = mat(picked(tieColorOf(look)), { roughness: 0.6 });
      [-1, 1].forEach(s => {
        const p = at(s * Math.sin(az) * Math.cos(e), Math.sin(e), -Math.cos(az) * Math.cos(e));
        const grp = new THREE.Group(); grp.position.set(p.x + s * 0.012, p.y, p.z - 0.008); grp.rotation.set(0.25, 0, s * 0.32); head.add(grp);
        mk(cy(0.03, 0.03, 0.024, 12), tieM, 0, 0, 0, grp);
        mk(lathe(`twin:${L}:${R}`, [[0.001, 0.02], [0.034 * R, 0], [0.042 * R, -0.07 * L], [0.03 * R, -0.18 * L], [0.01 * R, -0.25 * L], [0, -0.26 * L]], 14), hairM, 0, -0.008, 0, grp);
      });
    } else if (tie === 'lowtwintails' && long) {
      // 低雙馬尾: one each side at the nape, hanging straight down
      const e = H ? Math.min(-0.05, hatBack - 0.24) : -0.14, az = 0.72, L = HL !== null ? Math.min(1.5, Math.max(0.55, HL / 0.37)) : length === 'long' ? 0.9 : 0.65, R = curly ? 1.2 : 0.9;
      const tieM = mat(picked(tieColorOf(look)), { roughness: 0.6 });
      [-1, 1].forEach(s => {
        const p = at(s * Math.sin(az) * Math.cos(e), Math.sin(e), -Math.cos(az) * Math.cos(e));
        const grp = new THREE.Group(); grp.position.set(p.x + s * 0.008, p.y, p.z - 0.006); grp.rotation.set(0.08, 0, s * 0.14); head.add(grp);
        mk(cy(0.03, 0.03, 0.024, 12), tieM, 0, 0, 0, grp);
        mk(lathe(`twin:${L}:${R}`, [[0.001, 0.02], [0.034 * R, 0], [0.042 * R, -0.07 * L], [0.03 * R, -0.18 * L], [0.01 * R, -0.25 * L], [0, -0.26 * L]], 14), hairM, 0, -0.008, 0, grp);
      });
    } else if (tie === 'lowpony' && long) {
      // 低馬尾: gathered at the nape, hanging straight down under the hair tie
      const p = backAt(H ? Math.min(-0.05, hatBack - 0.24) : -0.12), L = HL !== null ? Math.min(1.7, Math.max(0.6, HL / 0.33)) : length === 'long' ? 1 : 0.7, R = curly ? 1.25 : 1;
      mk(cy(0.038, 0.038, 0.03, 12), mat(picked(tieColorOf(look)), { roughness: 0.6 }), p.x, p.y, p.z - 0.012, head).rotation.x = Math.PI / 2;
      const tail = mk(lathe(`tail:${L}:${R}`, [[0.001, 0.02], [0.04 * R, 0], [0.05 * R, -0.08 * L], [0.035 * R, -0.2 * L], [0.012 * R, -0.28 * L], [0, -0.29 * L]], 14), hairM, p.x, p.y - 0.02, p.z - 0.03, head);
      tail.rotation.x = 0.12;
    } else if (hangs) {
      curtain(HL !== null ? `cm${cm}${curly ? ':curly' : ''}` : `${length}${curly ? ':curly' : ''}`, HL !== null ? tailFor(HL, curly) : (curly ? CURLY_LENGTHS : LENGTHS)[length], curly ? (length === 'bob' ? 0.016 : 0.018) : 0);
      if (curly) {
        // loose curls over it all, the way a perm falls: two rows of chunky locks round the sides and back, every one a
        // different length, swinging out and flicking up at the tips; and, unless it's combed back, a few falling over the
        // forehead (parted in the middle: away to either side; a fringe: straight down; parted on one side: swept across)
        const rnd = seeded(`${shape}:${length}:${front}:${hatStyle || ''}`), locks = [];
        const L = HL !== null ? Math.min(0.42, Math.max(0.08, HL * 0.85)) : { bob: 0.1, medium: 0.2, long: 0.28 }[length];
        const dir = (phi, e) => new THREE.Vector3(Math.sin(phi) * Math.cos(e), Math.sin(e), Math.cos(phi) * Math.cos(e));
        const add = (phi, e, len, flare, turns, r0, lean = 0, push = 0.014) => {
          const u = dir(phi, e); if (underHat(u, 0.08)) return;
          const out = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)), side = new THREE.Vector3(Math.cos(phi), 0, -Math.sin(phi));
          locks.push({ root: at(u.x, u.y, u.z).addScaledVector(out, push), out, side, len, flare, turns, r0, lean });
        };
        [[0.22, 0.32], [-0.08, 0.27]].forEach(([e, step], row) => {
          for (let phi = 1.05 + row * step / 2; phi < Math.PI * 2 - 1.05; phi += step * (0.85 + rnd() * 0.3)) {
            add(phi + (rnd() - 0.5) * 0.08, e + (rnd() - 0.5) * 0.08, L * (0.6 + rnd() * 0.55) + (row ? 0 : 0.035), 0.008 + rnd() * 0.014, 0.55 + rnd() * 0.7, 0.014 + rnd() * 0.004);
          }
        });
        if (front !== 'none') {
          // (all kept clear of the eyebrows: parted in the middle they fall out over the temples, framing the forehead; a
          // fringe or a side sweep stops short above the brows)
          const fr = front === 'center' ? [-0.78, -0.58, 0.58, 0.78] : front === 'side' ? [-0.55, -0.35, -0.15, 0.05, 0.25] : [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5];
          fr.forEach(phi => {
            const center = front === 'center', lean = center ? Math.sign(phi) * 0.05 : front === 'side' ? -0.045 : (rnd() - 0.5) * 0.02;
            add(phi, (center ? 0.5 : 0.66) + (rnd() - 0.5) * 0.06, center ? 0.05 + rnd() * 0.03 : 0.035 + rnd() * 0.015, 0.006 + rnd() * 0.008, 0.4 + rnd() * 0.4, 0.013 + rnd() * 0.003, lean, 0.02);
          });
        }
        if (locks.length) mk(curlLocks(`${shape}:${length}:${front}:${hatStyle || ''}`, locks), hairM, 0, 0, 0, head);
      }
    }
  }

  if (!H) return;
  // under any hat, the covered hair is pressed down flat against the head (it can't be seen there), so the hat sits
  // down close instead of being pushed up and floating on it; below the band the hair comes back out to its full
  // fullness, leaving only the hair below the brim showing
  if (length !== 'bald') {
    const flat = 0.008, toHead = new THREE.Matrix4(), back = new THREE.Matrix4(), P = new THREE.Vector3(), u = new THREE.Vector3(), hv = new THREE.Vector3();
    head.updateMatrixWorld(true);
    const headInv = head.matrixWorld.clone().invert();
    head.children.slice(hairStart).forEach(root => root.traverse(m => {
      if (!m.isMesh) return;
      toHead.multiplyMatrices(headInv, m.matrixWorld); back.copy(toHead).invert();
      const g2 = m.geometry.clone(), p = g2.attributes.position;
      for (let i = 0; i < p.count; i++) {
        P.fromBufferAttribute(p, i).applyMatrix4(toHead);
        const len = P.length(); if (len < 1e-6) continue;
        u.copy(P).multiplyScalar(1 / len);
        const ang = Math.acos(Math.max(-1, Math.min(1, u.dot(hatN))));
        const s = Math.min(1, Math.max(0, (ang - (hatA + 0.06)) / 0.2)), ease = s * s * (3 - 2 * s);   // 0 under it, 1 well below its band
        if (ease >= 1) continue;
        const skin = deform(HEADS[shape], hv.copy(u)).length(), allowed = skin + flat + (len - skin - flat) * ease;
        if (len > allowed) { P.multiplyScalar(allowed / len).applyMatrix4(back); p.setXYZ(i, P.x, P.y, P.z); }
      }
      g2.computeVertexNormals(); m.geometry = g2;
    }));
    lift = flat;
  }
  // the hat, made bigger by however far this hairstyle stands off the head, so it sits on the hair, not through it.
  // Each is one piece: crown, brim or cuff and the edge tucked back in to the hair, with no seams between parts
  const T = lift + H.own, A = hatA, tuck = [A + 0.03, lift + 0.002, 0, 0];
  // (headphones worn under a bucket hat, fedora or beret: the hat a little roomier, sat over their band)
  const phonesUnder = headphonesOf(look).wear === 'head' && ['bucket', 'fedora', 'beret'].includes(hatStyle);
  const steps = (n, f) => Array.from({ length: n }, (_, k) => f(k / (n - 1)));
  if (hatStyle === 'cap') {
    // a six-panel cap: rounded crown, and a peak at the front only, curving down a little, with an underside
    const capM = mat(picked(hatColor), { roughness: 0.8, side: THREE.DoubleSide });
    mk(hatGeo(shape, `cap:${T.toFixed(3)}`, hatN, fr => [
      ...steps(10, t => [t * (A - 0.02), T, 0, 0]),
      [A, T, 0, 0],
      [A, T, 0.04 * (fr || 0), 0.006 * (fr || 0)], [A, T, 0.09 * (fr || 0), 0.016 * (fr || 0)], [A, T, 0.125 * (fr || 0), 0.028 * (fr || 0)],
      [A, T - 0.008, 0.125 * (fr || 0), 0.032 * (fr || 0)], [A, T - 0.008, 0.08 * (fr || 0), 0.02 * (fr || 0)], [A, T - 0.008, 0.01 * (fr || 0), 0.006 * (fr || 0)],
      tuck,
    ]), capM, 0, 0, 0, head);
    const top = at(0, 1, -0.25), up = new THREE.Vector3(0, 1, -0.25).normalize();
    mk(sp(0.014, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capM, top.x + up.x * T, top.y + up.y * T - 0.002, top.z + up.z * T, head);   // the button, sitting on the crown
  } else if (hatStyle === 'bucket') {
    // a bucket hat: soft crown, the brim turning out and down all the way round, with an underside and a rolled edge
    const capM = mat(picked(hatColor), { roughness: 0.9, side: THREE.DoubleSide });
    const TB = T + (phonesUnder ? 0.026 : 0);
    mk(hatGeo(shape, `bucket:${TB.toFixed(3)}`, hatN, () => [
      ...steps(10, t => [t * A, TB, 0, 0]),
      [A, TB, 0.012, 0.004], [A, TB, 0.032, 0.014], [A, TB, 0.052, 0.028], [A, TB - 0.002, 0.06, 0.036],
      [A, TB - 0.008, 0.056, 0.038], [A, TB - 0.008, 0.03, 0.02], [A, TB - 0.008, 0.006, 0.006],
      tuck,
    ]), capM, 0, 0, 0, head);
  } else if (hatStyle === 'fedora' || hatStyle === 'beret') {
    // these two are built on their own rather than shaped over the head: set on the ring where the hat's edge meets the
    // hair (found by sampling it all round), square to the hat's crown direction
    const q = new THREE.Quaternion().setFromUnitVectors(UP, hatN), d = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Vector3(), ring = [];
    for (let i = 0; i < 24; i++) {
      const psi = i / 24 * Math.PI * 2;
      d.set(Math.sin(A) * Math.sin(psi), Math.cos(A), Math.sin(A) * Math.cos(psi)).applyQuaternion(q);
      ring.push(deform(HEADS[shape], v.copy(d)).addScaledVector(d, T).clone());
    }
    ring.forEach(p => c.add(p)); c.multiplyScalar(1 / ring.length);
    const rb = ring.reduce((s, p) => s + p.distanceTo(c), 0) / ring.length + 0.004 + (phonesUnder ? 0.014 : 0);   // the hat's opening, round the head
    const hat = new THREE.Group(); hat.position.copy(c); hat.quaternion.copy(q); head.add(hat);
    const hm = mat(picked(hatColor), { roughness: hatStyle === 'beret' ? 0.95 : 0.75, side: THREE.DoubleSide });
    if (hatStyle === 'fedora') {
      // 紳士帽: a felt fedora, as worn now: a tall crown narrowing a little upward, a long crease down the middle of the top
      // and the front pinched in either side (a teardrop seen from above), a dark band round its base, and a wide flat
      // brim, its edge bound in a lighter tape
      const H0 = 0.17, crown = new THREE.LatheGeometry([[rb, -0.004], [rb * 0.99, 0.05], [rb * 0.95, 0.11], [rb * 0.9, H0 - 0.012], [rb * 0.75, H0], [rb * 0.4, H0 + 0.004], [0.001, H0]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
      const cp = crown.attributes.position;
      for (let i = 0; i < cp.count; i++) {
        let x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
        const up = Math.min(1, Math.max(0, (y - 0.05) / (H0 - 0.05)));
        x *= 1 - 0.2 * up * Math.max(0, z / rb) ** 1.5;                                        // the front pinched in
        if (y > H0 - 0.03) y -= 0.03 * Math.exp(-((x / (rb * 0.28)) ** 2)) * Math.min(1, (y - (H0 - 0.03)) / 0.02) * (0.6 + 0.4 * Math.max(0, z / rb));   // the crease, deepest at the front
        cp.setXYZ(i, x, y, z);
      }
      crown.computeVertexNormals();
      mk(crown, hm, 0, 0, 0, hat);
      mk(new THREE.CylinderGeometry(rb * 0.99 + 0.002, rb + 0.002, 0.026, 40, 1, true), mat(picked(0x16120f), { roughness: 0.5, side: THREE.DoubleSide }), 0, 0.015, 0, hat, false);   // the band
      const W = 0.1;
      mk(new THREE.LatheGeometry([[rb - 0.004, 0.0], [rb + W * 0.5, -0.003], [rb + W, -0.001], [rb + W, -0.007], [rb + W * 0.5, -0.008], [rb - 0.004, -0.006]].map(([r, y]) => new THREE.Vector2(r, y)), 48), hm, 0, 0, 0, hat);   // the brim
      const tape = mk(new THREE.TorusGeometry(rb + W, 0.0045, 6, 64), mat(picked(hatColor).clone().lerp(new THREE.Color(1, 1, 1), 0.25), { roughness: 0.6 }), 0, -0.004, 0, hat, false); tape.rotation.x = Math.PI / 2;   // the bound edge
    } else {
      // 貝雷帽: a soft round beret, full and puffy, wider than the head and slouched forward and over to one side, its band
      // snug round the head, a stalk in the middle of the top
      // (shaped as one piece from the band up: bellying out past the head, then rounding over to a full soft top a little
      // above the crown of the head, which it covers; slouched forward and to one side)
      const crownTop = deform(HEADS[shape], v.copy(hatN)).addScaledVector(hatN, T).sub(c).dot(hatN), h = crownTop + 0.002 + (phonesUnder ? 0.026 : 0);   // (sat down close over the crown, soft and flattened, just clear of the hair, or of the headphones' band)
      // (a flat soft disc more than a dome: snug at the band, flaring out wide, a rounded rim, the top nearly flat)
      // (its edge a full round roll, not a thin lip: swelling out over a good depth and rounding back in smoothly)
      // (the roll near enough a half circle in section, from just over the band up to the top, then the top rounding in)
      // (and coming right down to the head at its foot: no straight band under it ringing the forehead)
      // (its lower half sloping out from the head to the fullest point, rather than rounding in flat underneath, which
      // left a ledge that read as a second layer; its upper half rounding over to the top as before)
      const roll = [];
      for (let s = 0; s <= 6; s++) { const t = s / 6; roll.push([rb * (1.0 + 0.21 * Math.sin(t * Math.PI / 2) ** 0.9), h * 0.5 * t]); }
      for (let s = 1; s <= 6; s++) { const th = Math.PI / 2 * s / 6; roll.push([rb * (1.0 + 0.21 * Math.cos(th)), h * (0.5 + 0.42 * Math.sin(th))]); }
      const profile = [[rb * 0.985, -0.012], ...roll, [rb * 0.86, h * 0.95], [rb * 0.62, h * 0.982], [rb * 0.34, h * 0.997], [0.001, h]];
      const body = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 56);
      // the band stays snug round the head all the way round (nothing lifts off it to show the hair under it); only the
      // soft body above it slouches over to one side, the more the higher it is: tighter on the side it slouches away
      // from, fuller on the other, where it hangs down over the edge
      // (the body above the band tipped over as one piece, so its round roll keeps its section all the way round and
      // doesn't shear into a sharp edge on the side it drops to; it eases from the band into that over the roll's foot)
      const bp = body.attributes.position, SL = 0.34, w0 = [];
      for (let i = 0; i < bp.count; i++) {
        let x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
        // (fuller by how far out it is toward -x, not its direction, which near the middle of the top would jump about)
        const s = Math.min(1, Math.max(0, (y - h * 0.02) / (h * 0.28))), w = s * s * (3 - 2 * s);
        const k = 1 + 0.12 * w * Math.max(0, -x / rb) - 0.06 * w * Math.max(0, x / rb);   // (fuller toward -x, the side it drops to)
        x *= k; z *= k;
        // (tipped by shearing it down toward -x, not turning it: turning pulled the dropping side in, into the hair)
        // (only the one side drops: the other isn't tipped up into the air, it stays down round the head; and the change
        // from the one to the other is a smooth curve across the middle, not a crease, which showed as a ridge on top)
        const dropX = (x - Math.sqrt(x * x + 0.03 * 0.03)) / 2;   // (a smoothed min(0, x))
        bp.setXYZ(i, x + 0.004 * w, y + dropX * Math.tan(SL) * w, z + 0.006 * w);
        w0.push(w);
      }
      // and never down in the hair: if any of it would be, the whole body over the band is lifted clear by as much as
      // the worst of it needs (one smooth lift, not each point pushed out on its own, which left it lumpy)
      const P = new THREE.Vector3(), dir = new THREE.Vector3();
      for (let pass = 0; pass < 3; pass++) {
        let worst = 0;
        for (let i = 0; i < bp.count; i++) {
          if (w0[i] < 0.3) continue;   // (the band, round the head, is where it should be)
          P.set(bp.getX(i), bp.getY(i), bp.getZ(i)).applyQuaternion(q).add(c);
          dir.copy(P).normalize();
          worst = Math.max(worst, deform(HEADS[shape], v.copy(dir)).length() + T + 0.006 - P.length());
        }
        if (worst <= 0) break;
        for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) + (worst + 0.001) * w0[i]);
      }
      body.computeVertexNormals();
      mk(body, hm, 0, 0, 0, hat);
      // (no stalk on top: it only read as a bump)
    }  } else {
    // a beanie: knitted, long, with no pompom: the crown standing up off the head and slouching back a little, in a
    // broad round dome (not a point), the cuff rolled up thick at the bottom
    const bm = new THREE.MeshStandardMaterial({ color: picked(hatColor), map: ribs(), roughness: 1, side: THREE.DoubleSide });
    mk(hatGeo(shape, `beanie4:${T.toFixed(3)}`, hatN, () => [
      [0, T + 0.042, 0, 0], ...steps(11, t => [0.05 + t * (A - 0.32), T + 0.042 * Math.max(0, 1 - t * t) ** 0.7 + 0.003 * (1 - t), 0, 0]),
      [A - 0.22, T + 0.002, 0, 0], [A - 0.18, T + 0.007, 0, 0], [A - 0.1, T + 0.009, 0, 0], [A - 0.03, T + 0.008, 0, 0], [A, T + 0.003, 0, 0.002],   // the cuff, hugging the head
      tuck,
    ]), bm, 0, 0, 0, head);
  }
}

// blinking now and then, and the mouth moving while a speech bubble is up; st keeps the timers
export function tickFace(body, st, dt, talking) {
  st.blinkT = (st.blinkT ?? 2) - dt;
  if (st.blinkT <= 0) { st.blinkT = 2 + Math.random() * 3.5; st.blinkDur = 0.13; }
  const closed = st.blinkDur > 0; if (closed) st.blinkDur -= dt;
  body.eyes.forEach(e => { e.scale.y = closed ? 0.12 : 1; });
  st.talkPhase = (st.talkPhase ?? 0) + dt * 16;
  body.mouth.scale.y = talking ? 1 + Math.abs(Math.sin(st.talkPhase)) * 1.6 : 1;
}
