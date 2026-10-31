import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// the live three.js objects for the one café on the page
export const ctx = { scene: null, camera: null, renderer: null, controls: null };

// a tablet or phone (or a slow computer): drawn at 30 frames a second, at most 1.5 pixels per CSS pixel, with plainer
// shadows and fewer lights, to go easier on the battery
export const LOW_POWER = typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4);

export function createEngine(stage) {
  const dpr = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({ antialias: dpr < 1.5, powerPreference: LOW_POWER ? 'low-power' : 'default' });   // on a sharp screen the extra smoothing isn't worth it
  // at most about 2 million pixels drawn a frame on a tablet (a big one at 1.5x would be over 3 million)
  const w = stage.clientWidth || window.innerWidth, h = stage.clientHeight || window.innerHeight;
  renderer.setPixelRatio(Math.min(dpr, LOW_POWER ? Math.max(1, Math.min(1.5, Math.sqrt(2e6 / (w * h)))) : 2));
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = LOW_POWER ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141218);
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(9, 13, 11);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.5, -1.5);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.minDistance = 0.4;   // close enough to read the menu clipboard
  controls.maxDistance = 45;

  Object.assign(ctx, { scene, camera, renderer, controls });
  return ctx;
}

export function disposeEngine() {
  if (!ctx.renderer) return;
  ctx.controls.dispose();
  ctx.renderer.dispose();
  ctx.renderer.forceContextLoss();
  ctx.renderer.domElement.remove();
  Object.assign(ctx, { scene: null, camera: null, renderer: null, controls: null });
}

// ---------------------------------------------------------------- building helpers (plan coordinates, metres)
export function mat(color, o = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, o)); }
export function add(mesh, parent = ctx.scene, cast = true) { mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh; }
export function box(w, h, d, m, x, y, z, parent) { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m.isMaterial || Array.isArray(m) ? m : mat(m)); me.position.set(x, y, z); return add(me, parent); }
export function cyl(rt, rb, h, m, x, y, z, parent, seg = 18) { const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m.isMaterial ? m : mat(m)); me.position.set(x, y, z); return add(me, parent); }
// wall from (x1,z1) to (x2,z2), axis aligned
export function wall(x1, z1, x2, z2, h, m, y0 = 0, t = 0.16) {
  const w = Math.abs(x2 - x1) || t, d = Math.abs(z2 - z1) || t;
  return box(w, h, d, m, (x1 + x2) / 2, y0 + h / 2, (z1 + z2) / 2);
}
export function canvasTex(w, h, draw, pixel) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  if (pixel) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; } else t.anisotropy = 4;
  t.redraw = () => { g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; };
  return t;
}
// a picture flat on a wall: drawn as if a little nearer than it is, so it never flickers against the wall behind it
export const DECAL = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
export function plane(w, h, tex, x, y, z, ry = 0, basic) {
  const m = basic ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, ...DECAL }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, transparent: true, ...DECAL });
  const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, y, z); me.rotation.y = ry; ctx.scene.add(me); return me;
}
export function floorPlane(w, d, x, z, m, y = 0.005) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); f.rotation.x = -Math.PI / 2; f.position.set(x, y, z); f.receiveShadow = true; ctx.scene.add(f); return f;
}
// pixel art from string rows
export function pixelArt(rows, pal, bg) {
  return canvasTex(rows[0].length, rows.length, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, rows[0].length, rows.length); }
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  }, true);
}
