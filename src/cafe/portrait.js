// A head-and-shoulders picture of someone for their card, like the back office's 捏臉 preview: their body built once in
// a small stage of its own, lit the same way, drawn a single time and kept as an image (so nothing extra is drawn
// every frame).
import * as THREE from 'three';
import { buildBody } from './body.js';

const SIZE = 192;
let stage = null;
const pictures = new WeakMap();

function makeStage() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffe9cf, 0x2a2420, 0.8));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.0); key.position.set(1.5, 3, 2.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fb0ff, 0.45); rim.position.set(-2, 2, -2); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  camera.position.set(0.3, 1.52, 1.55); camera.lookAt(0, 1.36, 0);
  return { renderer, scene, camera };
}

// a data URL of the person's picture (made the first time it's asked for)
export function portraitOf(person) {
  if (pictures.has(person)) return pictures.get(person);
  stage = stage || makeStage();
  const body = buildBody(person.p.look, person.p.name);
  stage.scene.add(body.g);
  stage.renderer.render(stage.scene, stage.camera);
  const url = stage.renderer.domElement.toDataURL('image/png');
  stage.scene.remove(body.g);   // (its materials aren't disposed: some are shared with everyone in the café)
  pictures.set(person, url);
  return url;
}

// a picture of a companion for its card (路易斯, 夜叉丸, 蘿蔔糕): its model built afresh in the same little stage, the
// camera framed on it whatever its size, a little from the front and side; one picture per kind, kept
const petPictures = new Map();
export function petPortraitOf(kind, make) {
  if (petPictures.has(kind)) return petPictures.get(kind);
  stage = stage || makeStage();
  const pet = make();
  pet.g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pet.g), c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
  cam.position.set(c.x + r * 0.9, c.y + r * 0.5, c.z + r * 2.1); cam.lookAt(c);
  stage.scene.add(pet.g);
  stage.renderer.render(stage.scene, cam);
  const url = stage.renderer.domElement.toDataURL('image/png');
  stage.scene.remove(pet.g);
  petPictures.set(kind, url);
  return url;
}

export function disposePortraits() {
  if (!stage) return;
  stage.renderer.dispose(); stage.renderer.forceContextLoss();
  stage = null;
}
