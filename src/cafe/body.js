// A person's 3D body: stylised but detailed, with a face built from the look's face options.
// Shared by the café and the back office's 捏臉 preview, so it depends only on three.js and the catalog.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, canvasTex } from './engine.js';
import { PIX } from './util.js';
import { faceOf, hairOf, hatOf, clothesOf, shoeOf, socksOf, tattooOf, earringsOf, buildOf, heightOf, tieColorOf } from '../content/catalog';
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
const disc = r => cy(r, r, 0.006, 18);
const lathe = (key, pts, seg = 24, ...arc) => geo(`l${key}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), D(seg, 8), ...arc));

const darkM = mat(0x161210, { roughness: 0.4 });
const whiteM = mat(0xfbfaf5, { roughness: 0.35 });
const shineM = new THREE.MeshBasicMaterial({ color: 0xffffff });
const tongueM = mat(0xd9646e, { roughness: 0.5 });
const blushM = mat(0xff8f9c, { roughness: 1, transparent: true, opacity: 0.45, depthWrite: false });
const frameM = mat(0x1b1b1b, { roughness: 0.4, metalness: 0.3 });
const glossM = mat(0x070708, { roughness: 0.22, metalness: 0 });                  // 阿亮眼鏡: thick, shiny black acetate
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
const sunLensM = mat(0x0d0d10, { roughness: 0.08, metalness: 0.6 });
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
};
const PATTERNS = Object.keys(PATTERN_BODY);

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
const capGeo = (shape, key, edge, thick, bump = null, groove = null, flow = null) => geo(`cap7:${shape},${key}`, () => {
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
  slim: { w: 0.95, d: 0.96, drop: 0, s: 0.92, len: 0.14, sh: 0, flare: 0.018 },
  regular: { w: 1, d: 1, drop: 0, s: 1, len: 0.16, sh: 0, flare: 0.013 },
  oversize: { w: 1.08, d: 1.1, drop: 0.07, s: 1.35, len: 0.29, sh: 0.012, flare: 0.036 },   // the person stays the same build: only the cloth is roomier
};
// a U neck: the front of the top scooped out from the base of the neck down to UNECK.bot, so the neck and a little chest
// show. Across the front it is UNECK.w either side of the middle, straight down the sides from UNECK.full and rounding
// into the bottom of the U.
const UNECK = { full: 1.24, bot: 1.21, w: 0.078, flat: 0.03, neck: 1.246 };   // above `neck` it's all skin
const uHalf = y => { const s = Math.max(0, Math.min(1, (y - UNECK.bot) / (UNECK.full - UNECK.bot))); return Math.max(UNECK.flat, UNECK.w * Math.sqrt(1 - (1 - s) ** 2)); };
// the torso's slices for a cut, with extra rows over the chest and shoulders so the U's edge runs smoothly
const torsoRows = fit => {
  const F = TOP_FITS[fit] || TOP_FITS.regular, hemY = TORSO[0][0] - F.drop;
  const flareAt = y => F.flare * Math.max(0, Math.min(1, (0.78 - y) / (0.78 - hemY)));
  const fine = [];
  TORSO.forEach((row, r) => {
    const next = TORSO[r + 1];
    fine.push(row);
    if (next && row[0] >= 1.1) for (let k = 1; k < 3; k++) fine.push(row.map((v, j) => v + (next[j] - v) * k / 3));
  });
  return (F.drop ? [[TORSO[0][0] - F.drop, TORSO[0][1], TORSO[0][2]]] : []).concat(fine).map(([y, rx, rz]) => {
    const k = Math.max(0, Math.min(1, (1.25 - y) / 0.15));   // full below the shoulders, none at the neck
    return [y, rx * (1 + (F.w - 1) * k) + F.sh * Math.exp(-(((y - 1.15) / 0.055) ** 2)) + flareAt(y), rz * (1 + (F.d - 1) * k) + flareAt(y) * 0.7];
  });
};
// how far round from the front the U reaches on a slice (0 below it); the slice's points are laid out so one falls
// exactly on each side of the U, and the skin inside it is the second material
const uAngle = (y, rx) => y < UNECK.bot - 1e-4 ? 0 : rx < 1e-4 ? Math.PI / 2 : Math.asin(Math.min(1, uHalf(y) / rx));
const torsoGeo = (fit = 'regular') => geo(`torso25:${fit}`, () => {
  const N = 48, M = 12, pos = [], idx = [], skinIdx = [];
  const rows = torsoRows(fit);
  rows.forEach(([y, rx, rz]) => {
    // below the U the points spread back out to evenly round, gradually over a few slices so no line shows where
    // the layout changes
    const u = uAngle(y, rx), s = Math.max(0, Math.min(1, (UNECK.bot - y) / 0.09)), e = s * s * (3 - 2 * s);
    const a = u || uAngle(UNECK.bot, rx) + (Math.PI * M / N - uAngle(UNECK.bot, rx)) * e;
    for (let i = 0; i <= N; i++) {
      const t = i <= M ? -a + 2 * a * i / M : a + (2 * Math.PI - 2 * a) * (i - M) / (N - M);
      pos.push(Math.sin(t) * rx, y, Math.cos(t) * rz);
    }
  });
  for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < N; i++) {
    const a = r * (N + 1) + i, b = a + N + 1;
    ((i < M && uAngle(rows[r][0], rows[r][1]) > 0) || rows[r][0] >= UNECK.neck - 1e-4 ? skinIdx : idx).push(a, a + 1, b, b, a + 1, b + 1);
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
const neckRibGeo = (fit = 'regular') => geo(`neckrib11:${fit}`, () => {
  const pts = [], rows = torsoRows(fit).filter(([y]) => y >= UNECK.bot - 1e-4 && y <= UNECK.neck + 1e-4);
  const side = sgn => rows.map(([y, rx, rz]) => { const t = uAngle(y, rx); return new THREE.Vector3(sgn * Math.sin(t) * rx * 1.012, y, Math.cos(t) * rz * 1.012); });
  const right = side(1), left = side(-1).reverse();
  pts.push(...left.slice(0, -1), new THREE.Vector3(0, UNECK.bot, rows[0][2] * 1.012), ...right);
  const [ty, rx, rz] = rows[rows.length - 1], t0 = uAngle(ty, rx);
  for (let k = 1; k < 10; k++) { const t = t0 + (2 * Math.PI - 2 * t0) * k / 10; pts.push(new THREE.Vector3(Math.sin(t) * rx * 1.012, ty, Math.cos(t) * rz * 1.012)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), D(80), 0.0075, D(6, 3), true);
});
// the top of the pants as one piece, waist to crotch, so nothing joins the hips to the legs: an oval round the waist
// that, going down, pinches in front and back between the legs until at the crotch it is exactly the two thighs (two
// circles a shade wider than them, centred on the hip joints), and the thighs carry on down from there. Each slice is
// sampled round its middle: the oval and the two circles, blended by height. (w: how full the pants' legs are; k: a
// roomier seat for baggy pants)
const PANTS_TOP = { crotch: 0.585, waist: 0.725, hipX: 0.094, rx: 0.192, rz: 0.114 };   // the waist tucked inside the shirt's hem
const pantsTopGeo = (w, k = 1) => geo(`ptop3:${w}:${k}`, () => {
  const { crotch, waist, hipX: c, rx, rz } = PANTS_TOP, N = 48, ROWS = 12, R = 0.0915 * w, pos = [], idx = [];
  const lobes = (sx, sz) => {   // how far out along (sx, sz) the two circles reach, or almost nothing between them
    let best = 0.004;
    [-c, c].forEach(cx => { const b = sx * cx, disc = b * b - cx * cx + R * R; if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc)); });
    return best;
  };
  for (let r = 0; r <= ROWS; r++) {
    const t = r / ROWS, y = crotch + (waist - crotch) * t, e = t * t * (3 - 2 * t);
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a);
      // roomy through the seat, the waist itself the usual size, inside the shirt (a roomy seat stays roomy right up to
      // under the shirt's hem, so its side drops straight to the legs, no waist pinched in)
      const kk = 1 + (k - 1) * (1 - t ** 4);
      const oval = 1 / Math.sqrt((sx / (rx * kk)) ** 2 + (sz / (rz * kk)) ** 2), d = lobes(sx, sz) + (oval - lobes(sx, sz)) * e;
      pos.push(sx * d, y, sz * d);
    }
  }
  for (let r = 0; r < ROWS; r++) for (let i = 0; i < N; i++) { const a = r * (N + 1) + i, b = a + N + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
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
  const f = faceOf(look, seed);
  const SH = shoeOf(look), tat = tattooOf(look);
  const C = { skin: picked(look.skin), hair: picked(look.hair), shirt: picked(look.shirt), pants: picked(look.pants), shoe: picked(SH.color) };
  const shape = HEADS[f.faceShape] ? f.faceShape : 'round', H = HEADS[shape];
  const g = new THREE.Group();
  const shade = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const skin = mat(C.skin, { roughness: 0.62 }), skinShade = mat(shade(C.skin, 0.86), { roughness: 0.62 });
  const pattern = clothesOf(look).pattern;
  const shirt = patterned(mat(C.shirt, { roughness: 0.85 }), pattern, C.shirt), shirtDark = mat(shade(C.shirt, 0.72), { roughness: 0.85 });
  const shirtIn = mat(shade(C.shirt, 0.42), { roughness: 0.9, side: THREE.BackSide });   // the shadowed inside of a sleeve
  const shirtUnder = mat(shade(C.shirt, 0.35), { roughness: 1, side: THREE.DoubleSide });   // the inside of the shirt, seen under its hem
  const inkedSkin = (style, v, low) => (style ? mat(C.skin, { roughness: 0.6, map: tattooTex(style, v, low, typeof look.tattooText === 'string' ? look.tattooText : '') }) : skin);   // skin tattooed in a style, or bare
  const pants = mat(C.pants, { roughness: 0.9 }), pantsDark = mat(shade(C.pants, 0.78), { roughness: 0.9 });
  // hair with a little sheen; curls more (the wet, styled look), straight hair a soft gloss along its layers
  const hairM = mat(C.hair, { roughness: hairOf(look).curl === 'curly' ? 0.45 : 0.68, metalness: 0.05, map: strands(), side: THREE.DoubleSide });
  const shoe = mat(C.shoe, { roughness: 0.55 });
  const mk = (geom, m, x, y, z, par = g, shadow = true) => { const me = new THREE.Mesh(geom, m); me.position.set(x, y, z); me.castShadow = shadow; me.receiveShadow = shadow; par.add(me); return me; };

  // ---------------------------------------------------------------- legs and hips
  // the legs are LEG_EXTRA longer than first drawn (thigh and shin), the hips raised by that much and the torso
  // shortened to match, so shoulders, arms and head stay where every pose was tuned
  const { bottom, fit } = clothesOf(look), skirted = bottom === 'skirt', shorts = bottom === 'shorts', bareLegs = skirted || shorts;
  const legM = bareLegs ? skin : pants;                   // bare legs under a skirt or shorts
  // wide legs: baggy all the way, flaring out to the hem (bare legs are just legs: the fit is the shorts' width)
  const W = bareLegs ? 1 : { slim: 0.85, regular: 1, wide: 1.45 }[fit] || 1, flare = fit === 'wide' && !shorts ? 0.086 * W + 0.002 : 0.062 * W;   // (wide: straight down, barely wider at the hem than the knee)
  // shorts are the pants' own thighs (one surface with the seat, so no seam round the hips), roomy, in the pants colour,
  // ending at the knee in a turned-up hem, the knee and shin bare below
  // (the seat as roomy as the legs below it, so from behind the shorts are one width all the way down, no waist pinched in)
  const SW = { slim: 1.08, regular: 1.24, wide: 1.4 }[fit] || 1.24, TW = shorts ? SW : W;
  const bare = [];   // what shows skin when the pants come down (thighs, knees, hips)
  const bunch = [];  // the pants bunched round the shins, only seen then
  const cover = [];  // shorts' legs, gone when they come down
  const SK = socksOf(look), sockM = SK.style !== 'none' ? mat(picked(SK.color), { roughness: 0.95 }) : null, sockRib = sockM && mat(shade(picked(SK.color), 0.8), { roughness: 0.95 });
  const THIGH = 0.32, HIP_Y = 0.55 + LEG_EXTRA;
  const legs = [-0.094, 0.094].map(x => {   // close enough that the tops of the thighs meet, so the crotch is just where the legs join
    const hip = new THREE.Group(); hip.position.set(x, HIP_Y, 0); g.add(hip);
    // thigh and shin are open tubes meeting exactly at the knee at the same width, so a straight leg has no seam; a
    // slightly smaller ball fills the joint only when the knee bends
    // (wide-legged trousers hang straight down from the seat: no tapering in to the knee and out again to the hem, so
    // their outer line is one straight drop)
    const straight = fit === 'wide' && !bareLegs, kneeW = straight ? 0.086 : 0.074;
    const RK = kneeW * W, TK = 0.074 * TW;   // (the thigh's width at the knee: the shorts' there)
    // the thigh: rounded over its top, which sits up inside the hips, fullest just below them, tapering to the knee, so
    // the hips flow on down into the leg instead of a tube coming out from under them (profile from the knee up, faces out)
    const thighAt = (w, st = false) => [[(st ? 0.086 : 0.074) * w, -THIGH], [(st ? 0.086 : 0.078) * w, -0.24], [(st ? 0.087 : 0.086) * w, -0.12], [0.09 * w, -0.04], [0.088 * w, -0.005], [0.074 * w, 0.022], [0.044 * w, 0.042], [0.001, 0.05]];
    const thigh = mk(flatLit(lathe(`thigh3:${W}:${straight}`, thighAt(W, straight), 20)), legM, 0, 0, 0, hip);
    if (!bareLegs) bare.push(thigh);
    let shortsLeg = null;
    if (shorts) {
      // the shorts' leg: the pants' own thigh, roomier (so one surface with the seat, no seam round the hips), stopping a
      // little above the knee, open there over the bare thigh, its hem turned up and its shadowed inside showing
      // (one with the seat at the top; from below the crotch a straight, roomy tube, hanging very slightly wider to the hem,
      // like the cloth it is, rather than following the thigh's own curve in to the knee)
      const FL = 0, R = 0.09 * TW;
      // (below the seat, no longer following the thigh in towards the knee: straight down at the seat's own width, hanging
      // a touch wider to the hem)
      const shape = ([r, y]) => (y < -0.04 ? [R + 0.01 * Math.min(1, -(y + 0.04) / 0.22), y] : [r, y]);
      const base = thighAt(TW), rAt = y => { for (let k = 1; k < base.length; k++) if (base[k][1] >= y) { const [r0, y0] = base[k - 1], [r1, y1] = base[k]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0.001; };
      const S0 = -0.262, prof = [-THIGH, -0.262, -0.25, -0.235, -0.22, -0.2, -0.15, -0.11, -0.08, -0.06, -0.04, -0.02, -0.005, 0.022, 0.042, 0.05].map(y => shape([rAt(y), y])), i = prof.findIndex(([, y]) => y > S0), [r0, y0] = prof[i - 1], [r1, y1] = prof[i];
      const cut = [r0 + (r1 - r0) * (S0 - y0) / (y1 - y0), S0], rh = cut[0];
      const pantsIn = pants.clone(); pantsIn.side = THREE.DoubleSide; pantsIn.shadowSide = THREE.BackSide;   // (its back faces in the shadow map: no speckled self-shadowing on it)
      shortsLeg = mk(lathe(`shorts9:${TW}:${FL}`, [cut, ...prof.slice(i)], 20), pantsIn, 0, 0, 0, hip); cover.push(shortsLeg);   // (both faces: its inside shows at the hem, in its own colour)
      cover.push(mk(cy(rh + 0.003, rh + 0.004, 0.018, 18, true), pantsDark, 0, S0 + 0.009, 0, hip, false));   // the turned-up hem
    }
    const knee = new THREE.Group(); knee.position.set(0, -THIGH, 0); hip.add(knee);
    const kn = mk(sp(RK * 0.96, 16, 12), legM, 0, 0, 0, knee); if (!bareLegs) bare.push(kn);
    const b = mk(cy(0.088 * W, 0.082 * W, 0.09, 14), skirted ? mat(0xf2efe9, { roughness: 0.9 }) : pants, 0, -0.03, 0, knee, false); b.visible = false; bunch.push(b);
    // shin, down into the shoe (a bare one perhaps tattooed; the leg at -x is the person's right)
    // (bare, a real calf: knee-wide at the top, rounding over the calf and in to the ankle, no kink where it meets the knee)
    if (bareLegs) mk(lathe(`calf:${RK}`, [[0.052, -0.125], [0.0595, -0.06], [0.065, 0], [0.071, 0.07], [RK, 0.125]], 16), inkedSkin(tat[x < 0 ? 'rl' : 'll'], x < 0 ? 0 : 1), 0, -0.125, 0, knee);
    else mk(flatLit(cy(RK, flare, 0.25, 16, true)), legM, 0, -0.125, 0, knee);
    if (!bareLegs) mk(cy(flare + 0.006, flare + 0.006, 0.025, 14), pantsDark, 0, -0.225, 0, knee, false);   // turned-up hem
    // socks: only where they'd show, on a bare shin (a short one round the ankle, a long one up to under the knee, a
    // ribbed band at the top), and over the foot in slides
    // (in boots or high-tops only what rises above the shoe is drawn, so a short one is hidden in it altogether)
    const sockFrom = { boots: 0.07, hightop: 0.05, sneaker: 0.025, lowtop: 0.01 }[SH.style] || 0, sockTop = SK.style === 'long' ? 0.2 : 0.06;
    if (sockM && bareLegs && sockTop > sockFrom + 0.02) {
      const top = sockTop, h0 = sockFrom, rAt = h => 0.052 + (RK - 0.052) * (h / 0.25) + 0.004;   // h: up from the shin's foot
      mk(cy(rAt(top), rAt(h0), top - h0, 16, true), sockM, 0, -0.25 + (top + h0) / 2, 0, knee, false);
      mk(cy(rAt(top) + 0.002, rAt(top - 0.02) + 0.002, 0.02, 16, true), sockRib, 0, -0.25 + top - 0.01, 0, knee, false);
    }
    buildShoe(SH.style, knee, mk, { shoe, skin: sockM || skin, light: SH_LIGHT, ankle: bareLegs });
    return { hip, knee, thigh, shortsLeg };
  });
  // hips: one piece from the waist splitting into the two legs, no join between them (separate hips and thighs leave a
  // line round the tops of the legs, like briefs)
  const seat = mk(pantsTopGeo(TW, fit === 'wide' && !shorts ? 1.12 : 1), pants, 0, 0, 0);   // (baggy pants and shorts are roomy through the seat too)
  bare.push(seat);
  // a skirt: knee length, A-line, hanging from the waist; a pivot at the waist so it can drape over the lap when sitting.
  // Its waistband sits tucked up inside the shirt (narrower than the shirt all round, front and back too) and it only
  // flares out below the shirt's hem, so none of it shows through the shirt
  let skirt = null;
  if (skirted) {
    skirt = new THREE.Group(); skirt.position.set(0, 0.72 + LEG_EXTRA, 0); g.add(skirt);
    const sm = mat(C.pants, { roughness: 0.85, side: THREE.DoubleSide });
    // (its width: a straight narrow skirt, the usual A-line, or full and flared; the waist the same in all)
    const F = { slim: 0.35, regular: 1, wide: 1.7 }[fit] || 1, flareTo = ([r, y]) => [0.185 + (r - 0.185) * F, y];
    // (under a fitted top, its waistband taken in to stay inside the narrower shirt)
    const tuck = clothesOf(look).top === 'slim' ? 0.92 : 1;
    mk(lathe(`skirt3:${F}`, [[0.185, -0.05], [0.19, -0.08], [0.215, -0.11], [0.24, -0.16], [0.266, -0.24], [0.288, -0.32], [0.284, -0.33]].map(flareTo), 28), sm, 0, 0, 0, skirt).scale.set(tuck, 1, 0.78 * tuck);
  }
  // the belt at the waist, just under the shirt's hem, its buckle on its front
  // (the waist is the same size whatever the cut, roomy through the seat or not, so the belt is too: snug on it)
  const BELT = clothesOf(look).top === 'slim' ? 0.95 : 1;   // (under a fitted top, a notch tighter, so it stays inside it)
  const belt = mk(cy(0.196, 0.196, 0.026, 22), beltM, 0, 0.708, 0, g, false); belt.scale.set(BELT, 1, 0.59 * BELT);
  const buckle = mk(bx(0.045, 0.024, 0.012), buckleM, 0, 0.707, 0.196 * 0.59 * BELT + 0.004, g, false);

  // ---------------------------------------------------------------- torso: waist, chest and sloping shoulders
  // waist, chest and shoulders close to the same width, so it isn't an inverted triangle; it starts higher, over the longer legs
  // slimmer side to side and deeper front to back than first drawn, so the arms hang closer in, and the shoulders
  // slope down from the neck in one long curve rather than squaring off
  // the shirt comes straight down to its hem over the top of the hips. Its slices are ovals, wider side to side than
  // front to back, and side to side it widens out at the top into the shoulders, so the slope from the neck runs
  // straight on into the arms with no join
  // cut slim, regular or oversized (wider and deeper, hanging lower over the hips)
  const topFit = clothesOf(look).top, TF = TOP_FITS[topFit] || TOP_FITS.regular;
  // the shirt and the bare skin of the neck share one surface; the skin one doesn't take the head's shadow, so the neck
  // and chest are the same colour as the face
  const torso = mk(torsoGeo(topFit), [shirt, hideM], 0, 0, 0);
  mk(torsoGeo(topFit), [hideM, skin], 0, 0, 0).receiveShadow = false;
  // the hem: a rolled edge with some thickness to it, and underneath, the shirt's shadowed inside closing the gap down to
  // the hips, so it reads as cloth with body in it, not a shell
  const hemY = 0.71 - TF.drop, hemR = 0.202 * TF.w + TF.flare, hemZ = (0.15 * TF.d + TF.flare * 0.7) / hemR;
  const hem = mk(geo(`hemroll:${hemR.toFixed(3)}`, () => new THREE.TorusGeometry(hemR, 0.008, D(6, 3), D(40, 12))), shirtDark, 0, hemY + 0.004, 0, g, false);
  hem.rotation.x = Math.PI / 2; hem.scale.y = hemZ;
  const under = mk(geo(`hemunder:${hemR.toFixed(3)}`, () => new THREE.RingGeometry(0.16, hemR, 40)), shirtUnder, 0, hemY + 0.006, 0, g, false);
  under.rotation.x = Math.PI / 2; under.scale.y = hemZ;
  if (clothesOf(look).style !== 'shirt') mk(neckRibGeo(topFit), shirtDark, 0, 0, 0, g, false);   // a U neck, edged with a rolled rib (a shirt's collar sits there instead)
  if (clothesOf(look).style === 'shirt') {
    // 襯衫: a button-up shirt: a collar folding down either side of the neck to two points on the chest, a placket down
    // the middle and its buttons, all laid on the shirt's own front (its surface found from the cut's slices)
    const rows = torsoRows(topFit);
    const slice = y => { for (let i = 1; i < rows.length; i++) if (rows[i][0] >= y) { const [y0, x0, z0] = rows[i - 1], [y1, x1, z1] = rows[i], t = (y - y0) / (y1 - y0 || 1); return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]; } return rows[rows.length - 1].slice(1); };
    const surfZ = (x, y) => { const [rx, rz] = slice(y); return rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)); };
    const on = (x, y, off) => new THREE.Vector3(x, y, surfZ(x, y) + off);
    const colM = patterned(shirt.clone(), pattern, C.shirt); colM.side = THREE.DoubleSide;
    // the collar: one piece all the way round the neck, as a shirt's is: a stand rising from the neckline, folding over
    // and down outward onto the shoulders and back, and at the front coming down either side of the top button into two
    // points on the chest (a little gap between them). Each cross-section: up from the neckline, over, and down
    const N = 48, cross = [];
    // the height of the shirt's surface over a point (x, z): the highest slice that still takes it in
    // (the shirt's own rows only: those above the neckline are the neck flaring up into the head)
    const shirtTop = rows.findIndex(r => r[0] >= UNECK.neck - 1e-4);
    const surfY = (x, z) => { for (let i = shirtTop; i > 0; i--) { const [y, rx, rz] = rows[i]; if ((x / rx) ** 2 + (z / rz) ** 2 <= 1) { if (i === shirtTop) return y; const [y1, rx1, rz1] = rows[i + 1], e = (x / rx) ** 2 + (z / rz) ** 2, e1 = (x / rx1) ** 2 + (z / rz1) ** 2; return y + (y1 - y) * Math.min(1, (1 - e) / Math.max(1e-4, e1 - e)); } } return -1; };
    // the top's U neckline is wide for a shirt: its two fronts fill it, leaving only a V open down to the top button
    // how far the neckline dips below the neck at x across the front: most under the throat, none by the sides
    const neckDip = x => 0.028 * Math.max(0, 1 - (x / 0.078) ** 2);
    for (const sgn of [-1, 1]) {
      const R = 14, C = 6, fp = [], fi = [];
      for (let r = 0; r <= R; r++) {
        const y = UNECK.bot - 0.012 + (UNECK.neck - UNECK.bot + 0.012) * r / R;   // (up to the collar)
        const v = 0.004 + 0.044 * Math.max(0, (y - UNECK.bot + 0.008) / (UNECK.neck - UNECK.bot + 0.008)) ** 0.9, u = uHalf(Math.min(y, UNECK.neck)) + 0.008;
        // (each point no higher than the neckline's curve over it: above that is the throat)
        for (let c = 0; c <= C; c++) { const x = sgn * (v + (Math.max(u, v + 0.01) - v) * c / C), yy = Math.min(y, UNECK.neck - neckDip(x)); fp.push(x, yy, surfZ(x, yy) + 0.0025); }
      }
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const a = r * (C + 1) + c, b = a + C + 1; fi.push(a, a + 1, b, a + 1, b + 1, b); }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setIndex(fi); fg.computeVertexNormals();
      mk(fg, colM, 0, 0, 0, g, false);
    }
    const gap = 0.2;   // (the two ends parted over the open top button: the neckline's V, the throat showing)
    for (let i = 0; i <= N; i++) {
      const phi = gap + (Math.PI * 2 - 2 * gap) * i / N, sx = Math.sin(phi), sz = Math.cos(phi);
      // how near the front end this is: the points grow there, falling off evenly (a straight outer edge back from
      // each tip, so the points are sharp triangles, as a spread collar's are, not rounded)
      const fromFront = (phi <= Math.PI ? phi : Math.PI * 2 - phi) - gap;
      const front = Math.max(0, 1 - fromFront / 0.95);
      const back = Math.min(1, Math.max(0, 0.35 - sz) / 1.1) ** 0.8;   // and how much it's round the back
      // on the neckline: level round the back and sides, and in front curving down in a U under the throat (the way a
      // shirt's neck is cut), sat on the chest's own surface there
      const [rx, rz] = slice(UNECK.neck), bx0 = sx * rx * 1.015;
      const yb = sz > 0 ? UNECK.neck - neckDip(bx0) : UNECK.neck;
      const bz0 = sz > 0 ? Math.max(surfZ(bx0, yb), sz * rz) * 1.015 : sz * rz * 1.015;
      const at = (k, dy, ox = 0) => new THREE.Vector3(bx0 * k + Math.sign(sx) * ox, yb + dy, bz0 * k);
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
      const s = 0.007 + 0.016 * (1 - front) + 0.012 * back;
      // (and the fall always working outward from the roll, each point further out than the one before: drawn in
      // toward the chest, one could end up inside the fold, turning the collar inside out there in a dark slit)
      const outward = pts => { for (let j = 4; j < pts.length; j++) { const r0 = Math.hypot(pts[j - 1].x, pts[j - 1].z), r = Math.hypot(pts[j].x, pts[j].z); if (r < r0 + 0.003) { const k = (r0 + 0.003) / Math.max(r, 1e-4); pts[j].x *= k; pts[j].z *= k; } } return pts; };
      cross.push(outward([
        at(1, -0.008), at(1.0, s), at(1.018, s + 0.009), at(1.05, s + 0.012),
        // (in front, the drop from the roll down to the point an even curve)
        // (small points: not much longer or wider than the fall round the sides)
        lay(at(1.08 + 0.01 * front, s + 0.003 - 0.006 * front, 0.002 * front)),
        lay(at(1.105 + 0.03 * front, s - 0.013 - 0.006 * front, 0.007 * front)),
        lay(at(1.13 + 0.05 * front, s - 0.027 - 0.006 * front, 0.016 * front)),
      ]));
    }
    const pos = [], idx = [], M = cross[0].length;
    cross.forEach(c => c.forEach(v => pos.push(v.x, v.y, v.z)));
    for (let i = 0; i < N; i++) for (let j = 0; j < M - 1; j++) { const a0 = i * M + j, b0 = a0 + M; idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setIndex(idx); cg.computeVertexNormals();
    // its outside in the shirt's cloth, its inside (seen at the open neck, and under the fold) a shade darker, the way the
    // inside of a collar sits in shadow
    // (the strip is wound so its outside is the back face)
    const colOut = patterned(shirt.clone(), pattern, C.shirt); colOut.side = THREE.BackSide;
    mk(cg, colOut, 0, 0, 0, g, false);
    mk(cg, mat(shade(C.shirt, 0.8), { roughness: 0.9, side: THREE.FrontSide }), 0, 0, 0, g, false);
    // its edges drawn in a thin darker seam (round the fall, and down each front to its point), so the turned-down collar
    // reads against the shirt beneath it
    const seam = (key, ptsList, r = 0.0022) => mk(geo(key, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ptsList), ptsList.length * 3, r, 5, false)), shirtDark, 0, 0, 0, g, false);
    const tag = `${topFit}:${TF.drop}`;
    // (one unbroken line: up one front from the roll to its point, round the whole outer edge, and back up the other
    // front, so the points' corners join and it's the same weight all the way; centripetal, so it doesn't loop at them)
    const edgePath = [...cross[0].slice(3), ...cross.slice(1, N).map(c => c[M - 1]), ...cross[N].slice(3).reverse()];
    mk(geo(`colEdge2:${tag}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePath, false, 'centripetal'), edgePath.length * 4, 0.0018, 5, false)), shirtDark, 0, 0, 0, g, false);
    // and each front end of the collar closed, as it's sewn: otherwise one looks into the fold, through to the neck
    const capM = patterned(shirt.clone(), pattern, C.shirt); capM.side = THREE.DoubleSide;
    for (const e of [cross[0], cross[N]]) {
      const cp = [], ci = []; e.forEach(v => cp.push(v.x, v.y, v.z));
      for (let j = 1; j < 4; j++) ci.push(0, j, j + 1);   // (just the hollow under the roll: the point below it hangs free)
      const capG = new THREE.BufferGeometry(); capG.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); capG.setIndex(ci); capG.computeVertexNormals();
      mk(capG, capM, 0, 0, 0, g, false);
    }
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
  // a printed graphic (印花): big in the middle of a tee's chest; on a shirt a small emblem on the left breast, clear of
  // the placket. Laid on the cloth's own curve (each point on the cut's slice at its height), not a flat card
  const bigPrint = PRINTS.includes(pattern) && clothesOf(look).style !== 'shirt';
  if (PRINTS.includes(pattern)) {
    const rows = torsoRows(topFit), sliceAt = y => { for (let i = 1; i < rows.length; i++) if (rows[i][0] >= y) { const [y0, x0, z0] = rows[i - 1], [y1, x1, z1] = rows[i], t = (y - y0) / (y1 - y0 || 1); return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]; } return rows[rows.length - 1].slice(1); };
    const size = bigPrint ? 0.21 : 0.06, cx = bigPrint ? 0 : 0.065, cy = bigPrint ? 1.02 - TF.drop * 0.15 : 1.1;
    const S = 12, pp = [], uv = [], ix = [];
    for (let r = 0; r <= S; r++) for (let c = 0; c <= S; c++) {
      const x = cx + (c / S - 0.5) * size, y = cy + (r / S - 0.5) * size, [ex, ez] = sliceAt(y);
      pp.push(x, y, ez * Math.sqrt(Math.max(0, 1 - (x / ex) ** 2)) + 0.003); uv.push(c / S, r / S);
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
    const nz = 0.147 * TF.d + 0.004, ny = 0.98 - TF.drop * 0.3;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.19), numM); front.position.set(0, ny, nz); g.add(front);
    const back = front.clone(); back.position.z = -nz; back.rotation.y = Math.PI; back.scale.setScalar(1.3); g.add(back);
    if (bigPrint) front.visible = false;   // (a tee with a picture on its chest keeps the number on its back only)
  }
  if (look.apron) mk(bx(0.38, 0.6, 0.02), mat(picked(look.apron)), 0, 0.8, 0.15);

  // ---------------------------------------------------------------- head
  const head = new THREE.Group(); head.position.set(0, 1.44, 0); g.add(head);   // just off the shoulders, joined to them by a short flared neck
  mk(headGeo(shape), skin, 0, 0, 0, head).receiveShadow = false;   // like the neck: no shadows on the skin, so head and neck are one colour
  const surf = SURF[shape] || (SURF[shape] = surfaceFor(shape));
  const at = (x, y, z) => deform(H, new THREE.Vector3(x, y, z).normalize());   // surface point in a direction
  // ears, sitting on the side of whatever head shape it is
  const ears = earringsOf(look);
  [-1, 1].forEach(s => {
    const p = at(s, -0.04, 0.02);
    mk(sp(0.042, 12, 10), skin, p.x + s * 0.004, p.y, p.z, head).scale.set(0.42, 1, 0.72);
    mk(sp(0.022, 8, 6), skinShade, p.x + s * 0.016, p.y, p.z + 0.004, head, false).scale.set(0.3, 0.75, 0.55);
    // an earring through the lobe (the ear at -x is the person's right): a small hoop hanging edge-on to the cheek, a
    // stud, or a drop on a short chain
    const kind = s < 0 ? ears.right : ears.left;
    if (kind !== 'none') {
      const lx = p.x + s * 0.014, ly = p.y - 0.036, lz = p.z + 0.006, metal = kind === 'hoopSilver' ? silverM : goldM;
      if (kind === 'hoop' || kind === 'hoopSilver') {
        const ring = mk(geo('earHoop', () => new THREE.TorusGeometry(0.011, 0.0022, 6, 20)), metal, lx, ly - 0.009, lz, head, false); ring.rotation.y = Math.PI / 2;
      } else if (kind === 'stud') mk(sp(0.0045, 8, 6), silverM, lx, ly + 0.002, lz + 0.002, head, false);
      else {
        mk(cy(0.0009, 0.0009, 0.014, 4), goldM, lx, ly - 0.007, lz, head, false);
        mk(sp(0.005, 8, 6), metal, lx, ly - 0.017, lz, head, false).scale.set(0.8, 1.3, 0.8);
      }
    }
  });
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
      case 'tired': {                                                    // 黑眼圈: round, with shadowed rings under
        sclera(0.031); fm(sp(0.019, 12, 10), iris, 0, 0, 0.004, e); fm(sp(0.01, 8, 6), darkM, 0, 0, 0.012, e);
        fm(sp(0.005, 6, 4), shineM, s * 0.007, 0.008, 0.019, e); lid(0.031);
        const ring = fm(geo('underRing', () => new THREE.TorusGeometry(0.033, 0.006, 6, 18, Math.PI * 0.7)), mat(shade(C.skin, 0.72), { roughness: 0.7 }), 0, 0.002, 0.001, e);
        ring.rotation.z = Math.PI + Math.PI * 0.15; ring.scale.set(1, 0.75, 0.4); break;
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
  }[f.mouth] || (() => fm(bx(0.038, 0.01, 0.006), darkM, 0, 0, 0, mouth)))();
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
    // the frame: black, thin gold or silver wire (金屬框), or sunglasses; round or square, its own choice; 阿亮眼鏡 its own
    const wire = WIRE[f.glasses], rimM = wire || frameM, sun = f.glasses === 'sun', square = f.glassesShape === 'square';
    [-1, 1].forEach(s => {
      const cx = s * EX;
      if (f.glasses === 'aliang') {
        // the round frames, in thick glossy black, the rims cut in a few flat facets rather than perfectly round, with a
        // little wing sticking out at each outer top corner where the arm hinges on
        const ring = new THREE.Mesh(geo(`aliangRim:${AR},${AT}`, () => new THREE.TorusGeometry(AR, AT, 8, 16)), glossM); ring.position.set(cx, gy, gz); ring.scale.z = 0.8; face.add(ring);
        fm(disc(AR - AT * 0.6), lensM, cx, gy, gz).rotation.x = Math.PI / 2;
        fm(bx(0.018, 0.011, 0.012), glossM, s * (EX + AR + AT + 0.004), gy + 0.012, gz);
      } else if (square) {
        const w = 0.078, h = sun ? 0.05 : 0.054, t = wire ? 0.0035 : 0.008;
        fm(bx(w, t, t), rimM, cx, gy + h / 2, gz); fm(bx(w, t, t), rimM, cx, gy - h / 2, gz);
        fm(bx(t, h, t), rimM, cx - w / 2, gy, gz); fm(bx(t, h, t), rimM, cx + w / 2, gy, gz);
        fm(bx(w, h, 0.003), sun ? sunLensM : lensM, cx, gy, gz);
      } else {
        const R = wire ? 0.038 : 0.037, T = wire ? 0.0022 : 0.006;
        const ring = new THREE.Mesh(geo(`rim:${R},${T}`, () => new THREE.TorusGeometry(R, T, wire ? 6 : 8, wire ? 28 : 20)), rimM); ring.position.set(cx, gy, gz); face.add(ring);
        fm(disc(R - T * 0.4), sun ? sunLensM : lensM, cx, gy, gz).rotation.x = Math.PI / 2;
      }
      if (wire) fm(sp(0.004, 6, 4), wire, s * (EX - 0.03), gy - 0.012, gz - 0.006);   // nose pads
      const outer = EX + (f.glasses === 'aliang' ? AR + AT + 0.012 : square ? 0.039 : wire ? 0.038 : 0.037);
      // the arms: out to the side of the head and back to the ear (阿亮眼鏡's as thick as its rims, in their black, from the wings)
      const [armM, aw, ay] = f.glasses === 'aliang' ? [glossM, AT * 1.6, gy + 0.012] : wire ? [wire, 0.0035, gy + 0.004] : [frameM, 0.007, gy + 0.004];
      fm(bx(earX - outer + 0.006, aw, aw), armM, s * (outer + earX) / 2, ay, gz);
      fm(bx(aw * 0.85, aw * 0.85, gz), armM, s * earX, ay, gz / 2);
    });
    if (f.glasses === 'aliang') {
      fm(bx(EX * 2 - AR * 2 + AT, 0.014, 0.012), glossM, 0, gy + 0.016, gz);                       // a thick bridge, set high
      // the gold lines, like cracks mended in gold: a short one across the lower left of one rim, a long one from that
      // rim's top over the bridge onto the other's, and one down the far side of the other rim
      const zF = gz + AT * 0.8, rim = (cx, deg, k) => { const a = deg * Math.PI / 180, r = AR + AT * k; return new THREE.Vector3(cx + Math.cos(a) * r, gy + Math.sin(a) * r * 0.94, zF); };
      const line = pts => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0011, 4, false), goldM); face.add(m); };
      line([rim(-EX, 205, 1), rim(-EX, 200, 0), rim(-EX, 196, -1)]);
      line([rim(-EX, 40, -1), rim(-EX, 32, 0), new THREE.Vector3(-0.012, gy + 0.019, zF), new THREE.Vector3(0.012, gy + 0.021, zF), rim(EX, 148, 0), rim(EX, 128, 0.6), rim(EX, 112, 1)]);
      line([rim(EX, 32, 1), rim(EX, 18, 0.1), rim(EX, -10, 0), rim(EX, -32, -0.6), rim(EX, -40, -1)]);
    } else if (wire) {   // a thin arched bridge
      const br = new THREE.Mesh(geo(`wireBridge:${EX.toFixed(4)}`, () => new THREE.TorusGeometry(EX - 0.038, 0.0019, 5, 12, Math.PI)), wire); br.position.set(0, gy + 0.004, gz); face.add(br);
    } else fm(bx(0.03, 0.007, 0.007), frameM, 0, gy + 0.012, gz);                                   // bridge
  }

  // ---------------------------------------------------------------- arms: shoulder -> elbow -> hand
  const elbows = [];
  const arms = [-0.235, 0.235].map(x => {   // (where the arms hang doesn't change with the clothes)
    const s = Math.sign(x);
    const sh = new THREE.Group(); sh.position.set(x, 1.16, 0); g.add(sh);   // tucked under the slope of the shoulders
    // sleeves are cloth over the arm, not the arm in another colour: open at the end with their shadowed inside
    // showing, a rolled hem or cuff; a loose cut stands well clear of the arm
    const long = look.longSleeve, S = long ? TF.s : 1, loose = topFit === 'oversize';
    // the arm's skin, the upper arm and forearm each tattooed in its own style or bare (under a long sleeve only the hand
    // would show, so nothing); the arm at -x is the person's right
    const side = s < 0 ? 'r' : 'l';
    const sleeveM = long ? shirt : inkedSkin(tat[side + 'u'], s < 0 ? 0 : 1, true), foreM = long ? shirt : inkedSkin(tat[side + 'f'], s < 0 ? 1 : 0);
    const lining = (rt, rb, h, y, par) => mk(cy(rt - 0.002, rb - 0.002, h, 14, true), shirtIn, 0, y, 0, par, false);   // the inside of a sleeve, seen at its opening
    const roll = (r, y, par) => { const e = mk(geo(`roll:${r.toFixed(3)}`, () => new THREE.TorusGeometry(r, 0.006, D(6, 3), D(24, 10))), shirtDark, 0, y, 0, par, false); e.rotation.x = Math.PI / 2; };   // a rolled edge round an opening
    // the upper arm: rounded over its top, fullest just below the shoulder, tapering to the elbow (open there, where
    // the forearm carries on)
    // (its profile runs from the bottom up, so its faces point outward)
    mk(lathe(`uarm3:${S.toFixed(2)}`, [[0.052, -0.27], [0.054, -0.2], [0.056, -0.1], [0.057, -0.035], [0.052, -0.004], [0.034, 0.014], [0.001, 0.02]].map(([r, y]) => [r * S, y]), 24), sleeveM, 0, 0, 0, sh);
    if (!long) {
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
    const cap = loose ? mk(sp(1, 24, 16), shirt, s * 0.232, 1.14, 0) : mk(sp(1, 24, 16), shirt, s * 0.222, 1.138, 0);
    if (loose) cap.scale.set(0.082, 0.05, 0.074); else cap.scale.set(0.066 * Math.min(TF.s, 1.12), 0.046, 0.062);
    const elbow = new THREE.Group(); elbow.position.set(0, -0.27, 0); sh.add(elbow); elbows.push(elbow);
    mk(sp(0.05 * S, 14, 10), long ? shirt : skin, 0, 0, 0, elbow);                                 // fills the elbow only when it bends
    const wrist = long ? (loose ? 0.05 : 0.046) * S : 0.044;
    mk(cy(0.052 * S, wrist, 0.24, 14, true), foreM, 0, -0.12, 0, elbow);                            // forearm, the same width where they meet
    if (long) {   // the cuff: a band at the wrist, the sleeve's inside showing round the hand; a loose sleeve bunches above it
      mk(cy(wrist + 0.003, wrist + 0.003, 0.03, 14, true), shirtDark, 0, -0.225, 0, elbow, false);
      lining(wrist + 0.003, wrist + 0.003, 0.04, -0.22, elbow); roll(wrist + 0.003, -0.238, elbow);
    }
    mk(sp(0.052, 12, 10), skin, 0, -0.285, 0.004, elbow).scale.set(0.82, 1.12, 0.68);              // hand
    mk(bx(0.024, 0.048, 0.028), skin, -s * 0.04, -0.27, 0.022, elbow, false).rotation.z = s * 0.45;   // thumb
    return sh;
  });
  const hand = new THREE.Object3D(); hand.position.set(0, -0.3, 0.05); elbows[1].add(hand);
  const handL = new THREE.Object3D(); handL.position.set(0.01, -0.3, 0.04); elbows[0].add(handL);   // holds a cigarette
  // ---------------------------------------------------------------- build (身形): the body wider and deeper (a fuller
  // middle for the heavier builds), the arms and legs set out to match and a little thicker; head and height as they are
  const BLD = BUILDS[buildOf(look)];
  if (BLD.w !== 1 || BLD.d !== 1) {
    const limb = Math.sqrt(BLD.w);
    // (the body's own surfaces widened vertex by vertex, fully up to the shoulders, easing back to as-built up the neck,
    // so the neck still meets the head where it did and nothing pushes out through the jaw)
    const k = y => 1 - Math.min(1, Math.max(0, (y - 1.17) / 0.16));
    // (what's worn below the waist, the seat of the pants, the belt, the hips the legs hang from, only 70% as much, so the
    // shirt's hem always hangs out over the top of the pants)
    const LOW = 0.7, lower = new Set([seat, belt, buckle]);
    g.children.forEach(c => {
      if (c === head) return;
      if (arms.includes(c)) { c.position.x *= BLD.w; c.position.z *= BLD.d; c.scale.x *= limb; c.scale.z *= limb; return; }
      const leg = legs.find(l => l.hip === c);
      if (leg) {
        // the leg: set out with the seat, its thigh exactly as much fuller as the seat it grows out of (deeper at the top,
        // easing to the knee), the knee down to the shoe as much wider; scaled piece by piece, never the hip itself, so a
        // bent knee doesn't stretch the shin
        const fx = 1 + (BLD.w - 1) * LOW, fz = 1 + (BLD.d - 1) * LOW;
        c.position.x *= fx; c.position.z *= fz;
        [leg.thigh, leg.shortsLeg].forEach(m => {
          if (!m) return;
          const gm = m.geometry.clone(), pos = gm.attributes.position;
          for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), up = Math.min(1, Math.max(0, (y + THIGH) / THIGH)); pos.setX(i, pos.getX(i) * fx); pos.setZ(i, pos.getZ(i) * (fx + (fz - fx) * up)); }
          gm.computeVertexNormals(); if (m.geometry.userData.flatLit) { levelNormals(gm); gm.userData.flatLit = true; } m.geometry = gm;
        });
        const hemK = (fx + (fz - fx) * ((THIGH - 0.262) / THIGH)) / fx;   // (the shorts' hems: as deep as the leg is there)
        c.children.forEach(o => { if (o !== leg.thigh && o !== leg.knee && o !== leg.shortsLeg) { o.scale.x *= fx; o.scale.z *= fx * hemK; } });
        // (the knee down: as wide as the thigh at the knee, easing back to as built at the ankle, so the trousers don't
        // flare out into bell-bottoms and the shoes stay their size)
        leg.knee.updateMatrixWorld(true);
        leg.knee.traverse(m => {
          if (!m.isMesh) return;
          const toKnee = new THREE.Matrix4().copy(leg.knee.matrixWorld).invert().multiply(m.matrixWorld), back = toKnee.clone().invert();
          const gm = m.geometry.clone(), pos = gm.attributes.position, v = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(toKnee);
            const f = 1 + (fx - 1) * Math.min(1, Math.max(0, (v.y + 0.25) / 0.25));
            v.x *= f; v.z *= f; v.applyMatrix4(back); pos.setXYZ(i, v.x, v.y, v.z);
          }
          gm.computeVertexNormals(); if (m.geometry.userData.flatLit) { levelNormals(gm); gm.userData.flatLit = true; } m.geometry = gm;
        });
        return;
      }
      if (!c.isMesh) { const f = c === skirt ? LOW : 1; c.position.x *= 1 + (BLD.w - 1) * f; c.position.z *= 1 + (BLD.d - 1) * f; c.scale.x *= 1 + (BLD.w - 1) * f; c.scale.z *= 1 + (BLD.d - 1) * f; return; }
      const lo = lower.has(c) ? LOW : 1;
      c.updateMatrix(); const inv = c.matrix.clone().invert(), gm = c.geometry.clone(), pos = gm.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(c.matrix);   // where it is on the body
        const kv = k(v.y) * lo; v.x *= 1 + (BLD.w - 1) * kv; v.z *= 1 + (BLD.d - 1) * kv;
        v.applyMatrix4(inv); pos.setXYZ(i, v.x, v.y, v.z);
      }
      c.geometry = gm;   // (its normals kept: near enough for a gentle widening)
    });
    [hand, handL].forEach(h => { h.scale.set(1 / limb, 1, 1 / limb); });   // (what's held stays its own size)
  }  // the controller: a PS5 DualSense, white with a black middle, the white touchpad up top ringed by its blue light,
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
  if (heightK !== 1) { g.scale.setScalar(heightK); head.scale.setScalar(1 / heightK); }
  return { g, legs, arms, elbows, head, hand, handL, pad, eyes, mouth, skirt, heightK, skinM: skin, strip: { bare, bunch, cover, pants, skin } };
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

// the hair first, built from its parts (length, straight / curly / spiky, the front, tied up or not), then the hat
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
  const scatter = (limit, margin, place) => FIB.forEach(u => {
    const a = Math.acos(u.dot(crown(TILT)));
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
  if (length === 'buzz') {
    // 平頭: a short crew cut, faded. The top an even short layer (about a centimetre), following the head's own round;
    // the sides and back faded down close, so they read lighter, the skin showing through, darkest on top. Its hairline:
    // straight across the forehead, a squared corner at each temple, short sideburns in front of the ears, arching up
    // over each ear, and down the back to a faded nape
    // (down round the ears, which sit over it, and on down the back to the nape)
    const HL = [[0, 0.6], [0.5, 0.6], [0.72, 0.56], [0.86, 0.42], [1.0, 0.12], [1.15, -0.12], [1.5, -0.16], [1.9, -0.2], [2.3, -0.36], [2.7, -0.55], [Math.PI, -0.6]];
    const hairlineAt = phi => {
      const a = Math.abs(ang(phi));
      for (let k = 1; k < HL.length; k++) if (a <= HL[k][0]) { const [a0, e0] = HL[k - 1], [a1, e1] = HL[k], t = (a - a0) / (a1 - a0), s = t * t * (3 - 2 * t); return e0 + (e1 - e0) * s; }
      return HL[HL.length - 1][1];
    };
    // (its thickness all in the bump, thinning away over the last rows at the hairline: an even short top, faded
    // down to a mere shadow round the sides and back)
    const top = u => Math.min(1, Math.max(0, (u.y + 0.1) / 0.6)), even = u => { const s = top(u); return 0.0018 + 0.0075 * s * s * (3 - 2 * s); };
    const geo0 = capGeo(shape, 'buzz4', hairlineAt, () => 0.001, even), g2 = geo0.clone(), pp = g2.attributes.position, col = [];
    // the fade, in its colour: the hair's on top, toward the skin's down the sides and back
    const hc = new THREE.Color(picked(look.hair)), sc = new THREE.Color(picked(look.skin)), cc = new THREE.Color(), uu = new THREE.Vector3();
    // (a long gradual fade, from just above the ears and nape up to the top: no line where it changes)
    for (let i = 0; i < pp.count; i++) { uu.fromBufferAttribute(pp, i).normalize(); const f = Math.min(1, Math.max(0, (uu.y + 0.35) / 0.95)); cc.copy(sc).lerp(hc, 0.55 + 0.45 * f * f * (3 - 2 * f)); col.push(cc.r, cc.g, cc.b); }
    g2.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const buzzM = hairM.clone();
    buzzM.color = new THREE.Color(0xffffff); buzzM.vertexColors = true;
    buzzM.map = hairM.map.clone(); buzzM.map.repeat.set(70, 1); buzzM.map.needsUpdate = true;
    mk(g2, buzzM, 0, 0, 0, head);
    lift = 0.01;
  } else if (length !== 'bald') {
    // the top of the head: shaped by the front, with curls in its surface if it's curly
    const F = FRONTS[front] || FRONTS.none, curly = curl === 'curly';
    const amp = length === 'short' ? 0.02 : length === 'bob' ? 0.016 : CURL_TOP;   // the wet perm lies fairly close
    mk(capGeo(shape, `${front}${curly ? `:waves${amp}` : ':flow'}`, F.edge, F.thick, curly ? curlLumps(amp) : null, F.groove, F.flow), hairM, 0, 0, 0, head);
    lift = F.lift + LAYER_DEPTH + (curly ? amp : 0);
    if (curl === 'spiky') {
      scatter(1.0, 0.4, (u, p) => {                     // spikes stick out a long way, so keep them well clear of a hat's edge and brim
        const s = mk(cy(0, 0.04, 0.11, 6), hairM, p.x + u.x * 0.05, p.y + u.y * 0.05, p.z + u.z * 0.05, head);
        s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), u);
      });
    }
    // what hangs below: left loose to its length, or pulled back and tied
    const long = length === 'medium' || length === 'long';   // long enough to tie back
    const hangs = long || length === 'bob';
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
  // under a beret, the hair it covers is pressed down flat against the head (it can't be seen there), so the soft beret
  // sits down close on the head, its shape its own, with nothing of the hair showing through it as lumps; below its
  // band the hair comes back out to its full fullness, as hair does from under a beret
  if (hatStyle === 'beret') {
    const flat = 0.006, toHead = new THREE.Matrix4(), back = new THREE.Matrix4(), P = new THREE.Vector3(), u = new THREE.Vector3(), hv = new THREE.Vector3();
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
    mk(hatGeo(shape, `bucket:${T.toFixed(3)}`, hatN, () => [
      ...steps(10, t => [t * A, T, 0, 0]),
      [A, T, 0.012, 0.004], [A, T, 0.032, 0.014], [A, T, 0.052, 0.028], [A, T - 0.002, 0.06, 0.036],
      [A, T - 0.008, 0.056, 0.038], [A, T - 0.008, 0.03, 0.02], [A, T - 0.008, 0.006, 0.006],
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
    const rb = ring.reduce((s, p) => s + p.distanceTo(c), 0) / ring.length + 0.004;   // the hat's opening, round the head
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
      const crownTop = deform(HEADS[shape], v.copy(hatN)).addScaledVector(hatN, T).sub(c).dot(hatN), h = crownTop + 0.002;   // (sat down close over the crown, soft and flattened, just clear of the hair)
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
