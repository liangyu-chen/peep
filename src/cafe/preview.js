// A small stand-alone 3D stage for the back office's 捏臉 editor: one person, lit like the café, that you can turn around.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildBody, tickFace } from './body.js';

const VIEWS = {
  face: { pos: [0.28, 1.5, 1.35], target: [0, 1.42, 0] },
  full: { pos: [1.1, 1.35, 3.3], target: [0, 0.85, 0] },
};

export function mountPreview(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15131c);
  scene.add(new THREE.HemisphereLight(0xffe9cf, 0x2a2420, 0.7));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.0); key.position.set(1.5, 3, 2.5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 2.2, bottom: -0.2 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fb0ff, 0.45); rim.position.set(-2, 2, -2); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), new THREE.MeshStandardMaterial({ color: 0x2c2838, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 0.45; controls.maxDistance = 6;
  let tween = null;
  const setView = (name, instant) => {
    const v = VIEWS[name] || VIEWS.face;
    const tp = new THREE.Vector3(...v.pos), tt = new THREE.Vector3(...v.target);
    if (instant) { camera.position.copy(tp); controls.target.copy(tt); tween = null; }
    else tween = { fp: camera.position.clone(), ft: controls.target.clone(), tp, tt, t: 0 };
  };
  setView('face', true);
  controls.addEventListener('start', () => { tween = null; });

  let body = null;
  const anim = {};
  const disposeMaterials = root => root.traverse(o => {
    (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
  });
  function update(look, seed) {
    if (body) { scene.remove(body.g); disposeMaterials(body.g); }
    body = buildBody(look, seed);
    scene.add(body.g);
  }

  const resize = () => {
    const w = host.clientWidth || 320, h = host.clientHeight || 320;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  let raf = 0, last = performance.now(), t = 0;
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (body) {
      tickFace(body, anim, dt, t % 7 > 5.2);                     // says something every few seconds, so the mouth shows
      body.head.rotation.y = Math.sin(t * 0.5) * 0.12;
      body.arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 1.4 + i * Math.PI) * 0.04; a.rotation.z = i ? -0.06 : 0.06; });
      body.elbows.forEach(e => { e.rotation.x = -0.14; });
    }
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 0.6);
      const e = 1 - Math.pow(1 - tween.t, 3);
      camera.position.lerpVectors(tween.fp, tween.tp, e); controls.target.lerpVectors(tween.ft, tween.tt, e);
      if (tween.t >= 1) tween = null;
    }
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    update,
    setView,
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      if (body) disposeMaterials(body.g);
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
