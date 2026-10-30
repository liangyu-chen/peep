// A person's 3D body: blocky but detailed, with a face built from the look's face options.
// Shared by the café and the back office's 捏臉 preview, so it depends only on three.js and the catalog.
import * as THREE from 'three';
import { mat, canvasTex } from './engine.js';
import { PIX } from './util.js';
import { faceOf } from '../content/catalog';

// geometries are shared between everyone; materials stay per person since their colours differ
const GEO = new Map();
const geo = (key, make) => { let g = GEO.get(key); if (!g) { g = make(); GEO.set(key, g); } return g; };
const bx = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const sp = (r, ws = 12, hs = 10, ...part) => geo(`s${r},${ws},${hs},${part}`, () => new THREE.SphereGeometry(r, ws, hs, ...part));
const cy = (rt, rb, h, seg = 12) => geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const disc = r => cy(r, r, 0.006, 18);

const darkM = mat(0x161210, { roughness: 0.4 });
const whiteM = mat(0xfbfaf5, { roughness: 0.35 });
const shineM = new THREE.MeshBasicMaterial({ color: 0xffffff });
const tongueM = mat(0xd9646e, { roughness: 0.5 });
const blushM = mat(0xff8f9c, { roughness: 1, transparent: true, opacity: 0.5, depthWrite: false });
const frameM = mat(0x1b1b1b, { roughness: 0.4, metalness: 0.3 });
const lensM = mat(0xdff2ff, { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.12, depthWrite: false });
const sunLensM = mat(0x0d0d10, { roughness: 0.08, metalness: 0.6 });
const beltM = mat(0x2a2420, { roughness: 0.6 });
const buckleM = mat(0xc9b26a, { roughness: 0.3, metalness: 0.8 });
const soleM = mat(0xece7dc, { roughness: 0.8 });

const SHAPES = { round: [1, 1, 1], oval: [0.94, 1.07, 0.98], square: [1.05, 0.96, 1], long: [0.92, 1.12, 0.96] };
const R = 0.17;   // head radius before the face shape stretches it

export function buildBody(look, seed = '') {
  const f = faceOf(look, seed);
  const g = new THREE.Group();
  const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
  const skin = mat(look.skin, { roughness: 0.6 }), skinShade = mat(shade(look.skin, 0.84), { roughness: 0.6 });
  const shirt = mat(look.shirt, { roughness: 0.85 }), shirtDark = mat(shade(look.shirt, 0.72), { roughness: 0.85 });
  const pants = mat(look.pants, { roughness: 0.9 }), hairM = mat(look.hair, { roughness: 0.95, side: THREE.DoubleSide }), shoe = mat(look.shoe || 0x1d1d1d, { roughness: 0.6 });
  const mk = (geom, m, x, y, z, par = g, shadow = true) => { const me = new THREE.Mesh(geom, m); me.position.set(x, y, z); me.castShadow = shadow; me.receiveShadow = shadow; par.add(me); return me; };

  // ---------------------------------------------------------------- legs, hips, torso
  const legs = [-0.11, 0.11].map(x => {
    const hip = new THREE.Group(); hip.position.set(x, 0.55, 0); g.add(hip);
    mk(bx(0.17, 0.28, 0.2), pants, 0, -0.13, 0, hip);
    const knee = new THREE.Group(); knee.position.set(0, -0.27, 0); hip.add(knee);
    mk(bx(0.15, 0.22, 0.17), pants, 0, -0.1, 0, knee);
    mk(bx(0.16, 0.03, 0.18), mat(shade(look.pants, 0.8)), 0, -0.2, 0, knee, false);   // rolled hem
    mk(bx(0.17, 0.05, 0.27), shoe, 0, -0.235, 0.04, knee);
    mk(bx(0.175, 0.02, 0.28), soleM, 0, -0.27, 0.04, knee, false);
    return { hip, knee };
  });
  mk(bx(0.42, 0.16, 0.24), pants, 0, 0.6, 0);
  const belt = mk(cy(0.218, 0.218, 0.035, 18), beltM, 0, 0.675, 0, g, false); belt.scale.z = 0.62;
  mk(bx(0.045, 0.03, 0.01), buckleM, 0, 0.675, 0.138, g, false);
  const torso = mk(cy(0.21, 0.23, 0.58, 18), shirt, 0, 0.95, 0); torso.scale.z = 0.66;
  [-1, 1].forEach(s => mk(sp(0.07, 12, 10), shirt, s * 0.22, 1.19, 0).scale.set(1, 0.8, 0.9));   // rounded shoulders
  const collar = mk(cy(0.09, 0.11, 0.045, 16), shirtDark, 0, 1.245, 0, g, false); collar.scale.z = 0.8;
  if (look.number) {
    const t = canvasTex(32, 32, (c) => { c.fillStyle = '#fff'; c.font = `16px ${PIX}`; c.textAlign = 'center'; c.fillText(look.number, 16, 24); }, true);
    const numM = new THREE.MeshBasicMaterial({ map: t, transparent: true });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), numM); front.position.set(0, 0.98, 0.152); g.add(front);
    const back = front.clone(); back.position.z = -0.152; back.rotation.y = Math.PI; back.scale.setScalar(1.3); g.add(back);
  }
  if (look.apron) mk(bx(0.4, 0.6, 0.02), mat(look.apron), 0, 0.78, 0.155);
  mk(cy(0.055, 0.065, 0.1, 10), skin, 0, 1.29, 0);                                             // neck

  // ---------------------------------------------------------------- head: skull (stretched by face shape), hair, face
  const head = new THREE.Group(); head.position.set(0, 1.43, 0); g.add(head);
  const [sx, sy, sz] = SHAPES[f.faceShape] || SHAPES.round;
  const skull = new THREE.Group(); skull.scale.set(sx, sy, sz); head.add(skull);
  mk(sp(R, 22, 18), skin, 0, 0, 0, skull);
  if (f.faceShape === 'square') mk(bx(0.25, 0.1, 0.22), skin, 0, -0.085, 0, skull);           // jawline
  [-1, 1].forEach(s => mk(sp(0.04, 10, 8), skin, s * 0.168, -0.005, 0, skull).scale.set(0.45, 1, 0.75));   // ears
  // z of the face surface at (x, y), so features sit on whatever shape the head is
  const surf = (x, y) => sz * Math.sqrt(Math.max(0, R * R - (x / sx) ** 2 - (y / sy) ** 2));
  const face = new THREE.Group(); head.add(face);
  const fm = (geom, m, x, y, z, par = face) => mk(geom, m, x, y, z, par, false);

  buildHair(look.hairStyle, skull, hairM, (geom, m, x, y, z, par = skull) => mk(geom, m, x, y, z, par), look);

  // eyes: each in its own group so it can blink
  const EX = 0.062, EY = 0.025;
  const iris = mat(f.eyeColor, { roughness: 0.3 });
  const eyes = [-1, 1].map(s => {
    const e = new THREE.Group(); e.position.set(s * EX, EY, surf(EX, EY) - 0.004); face.add(e);
    const sclera = r => { const d = fm(disc(r), whiteM, 0, 0, 0.002, e); d.rotation.x = Math.PI / 2; };
    switch (f.eyes) {
      case 'dot': fm(sp(0.022, 8, 6), darkM, 0, 0, 0.004, e); break;
      case 'big':
        sclera(0.042); fm(sp(0.027, 12, 10), iris, 0, -0.002, 0.004, e); fm(sp(0.014, 8, 6), darkM, 0, -0.002, 0.016, e);
        fm(sp(0.007, 6, 4), shineM, s * 0.009, 0.01, 0.025, e); fm(sp(0.004, 6, 4), shineM, -s * 0.008, -0.01, 0.024, e); break;
      case 'sleepy':
        sclera(0.031); fm(sp(0.019, 10, 8), iris, 0, -0.004, 0.004, e); fm(sp(0.01, 8, 6), darkM, 0, -0.004, 0.012, e);
        fm(bx(0.072, 0.034, 0.03), skin, 0, 0.017, 0.012, e); fm(bx(0.068, 0.007, 0.012), darkM, 0, 0.0, 0.026, e); break;
      case 'smile': [-1, 1].forEach(k => { const l = fm(bx(0.032, 0.009, 0.01), darkM, k * 0.012, 0.004, 0.006, e); l.rotation.z = -k * 0.55; }); break;
      case 'narrow': fm(bx(0.05, 0.01, 0.01), darkM, 0, 0, 0.006, e).rotation.z = -s * 0.08; break;
      default:   // round
        sclera(0.031); fm(sp(0.019, 10, 8), iris, 0, 0, 0.004, e); fm(sp(0.01, 8, 6), darkM, 0, 0, 0.012, e);
        fm(sp(0.005, 6, 4), shineM, s * 0.007, 0.008, 0.019, e);
    }
    return e;
  });
  // brows
  if (f.brows !== 'none') {
    const [w, h] = f.brows === 'thick' || f.brows === 'angry' ? [0.068, 0.02] : [0.06, 0.011];
    const tilt = { angry: 0.32, worried: -0.3, thick: 0.04, thin: -0.06 }[f.brows] || 0;
    [-1, 1].forEach(s => { const b = fm(bx(w, h, 0.014), hairM, s * EX, 0.074, surf(EX, 0.074) + 0.004); b.rotation.z = s * tilt; });
  }
  // nose
  const NY = -0.022, nz = surf(0, NY);
  ({
    small: () => fm(bx(0.028, 0.04, 0.034), skinShade, 0, NY, nz + 0.006),
    normal: () => fm(bx(0.034, 0.055, 0.044), skinShade, 0, NY - 0.004, nz + 0.01),
    big: () => fm(bx(0.05, 0.066, 0.06), skinShade, 0, NY - 0.006, nz + 0.016),
    button: () => fm(sp(0.026, 10, 8), skinShade, 0, NY - 0.008, nz + 0.002),
  }[f.nose] || (() => {}))();
  // mouth: a group so it can move while talking
  const mouth = new THREE.Group(); mouth.position.set(0, -0.082, surf(0, -0.082) - 0.001); face.add(mouth);
  ({
    smile: () => { fm(bx(0.038, 0.01, 0.01), darkM, 0, 0, 0, mouth); [-1, 1].forEach(k => { fm(bx(0.016, 0.01, 0.01), darkM, k * 0.025, 0.005, -0.002, mouth).rotation.z = k * 0.55; }); },
    grin: () => { fm(bx(0.064, 0.028, 0.01), darkM, 0, 0, 0, mouth); fm(bx(0.056, 0.012, 0.012), whiteM, 0, 0.005, 0.002, mouth); },
    smirk: () => { fm(bx(0.042, 0.01, 0.01), darkM, 0.006, 0, 0, mouth).rotation.z = 0.2; fm(bx(0.014, 0.01, 0.01), darkM, 0.03, 0.008, -0.002, mouth).rotation.z = 0.7; },
    flat: () => fm(bx(0.046, 0.01, 0.01), darkM, 0, 0, 0, mouth),
    open: () => { fm(bx(0.044, 0.032, 0.012), darkM, 0, -0.004, 0, mouth); fm(bx(0.03, 0.01, 0.006), tongueM, 0, -0.013, 0.005, mouth); },
  }[f.mouth] || (() => fm(bx(0.038, 0.01, 0.01), darkM, 0, 0, 0, mouth)))();
  if (f.blush) [-1, 1].forEach(s => { const d = fm(disc(0.026), blushM, s * 0.102, -0.038, surf(0.102, -0.038) - 0.002); d.rotation.set(Math.PI / 2, 0, -s * 0.6); });
  // facial hair
  const mustache = () => { fm(bx(0.1, 0.022, 0.03), hairM, 0, -0.056, surf(0, -0.056) + 0.004); [-1, 1].forEach(s => { fm(bx(0.02, 0.035, 0.024), hairM, s * 0.052, -0.07, surf(0.052, -0.07) + 0.002); }); };
  const goatee = () => fm(bx(0.05, 0.055, 0.04), hairM, 0, -0.128, surf(0, -0.128) - 0.004);
  if (f.facialHair === 'mustache' || f.facialHair === 'both' || f.facialHair === 'full') mustache();
  if (f.facialHair === 'goatee' || f.facialHair === 'both') goatee();
  if (f.facialHair === 'full' || f.facialHair === 'stubble') {
    const m = f.facialHair === 'full' ? hairM : mat(look.hair, { roughness: 1, transparent: true, opacity: 0.38, depthWrite: false });
    const beard = mk(sp(R + (f.facialHair === 'full' ? 0.012 : 0.003), 20, 10, 0, Math.PI, Math.PI * (f.facialHair === 'full' ? 0.64 : 0.6), Math.PI * 0.36), m, 0, 0, 0, skull, false);
    beard.material.side = THREE.DoubleSide;
  }
  // glasses
  if (f.glasses !== 'none') {
    const gy = EY + 0.002, gz = surf(EX, EY) + 0.03;
    [-1, 1].forEach(s => {
      const cx = s * EX;
      if (f.glasses === 'round') {
        const ring = new THREE.Mesh(geo('torus', () => new THREE.TorusGeometry(0.037, 0.006, 6, 18)), frameM); ring.position.set(cx, gy, gz); face.add(ring);
        fm(disc(0.034), lensM, cx, gy, gz).rotation.x = Math.PI / 2;
      } else {
        const w = 0.078, h = f.glasses === 'sun' ? 0.05 : 0.054, t = 0.008;
        fm(bx(w, t, t), frameM, cx, gy + h / 2, gz); fm(bx(w, t, t), frameM, cx, gy - h / 2, gz);
        fm(bx(t, h, t), frameM, cx - w / 2, gy, gz); fm(bx(t, h, t), frameM, cx + w / 2, gy, gz);
        fm(bx(w, h, 0.003), f.glasses === 'sun' ? sunLensM : lensM, cx, gy, gz);
      }
      const outer = f.glasses === 'round' ? 0.099 : 0.101, ear = 0.152 * sx;
      fm(bx(ear - outer + 0.006, 0.007, 0.007), frameM, s * (outer + ear) / 2, gy + 0.004, gz);   // hinge out to the side of the head
      fm(bx(0.006, 0.006, 0.2), frameM, s * ear, gy + 0.004, gz - 0.1);                          // temple arm back to the ear
    });
    fm(bx(0.03, 0.007, 0.007), frameM, 0, gy + 0.012, gz);                                       // bridge
  }

  // ---------------------------------------------------------------- arms
  const arms = [-0.28, 0.28].map(x => {
    const sh = new THREE.Group(); sh.position.set(x, 1.19, 0); g.add(sh);
    mk(cy(0.058, 0.05, 0.5, 10), look.longSleeve ? shirt : skin, 0, -0.25, 0, sh);
    if (!look.longSleeve) mk(cy(0.07, 0.066, 0.17, 10), shirt, 0, -0.065, 0, sh);
    else mk(cy(0.056, 0.056, 0.03, 10), shirtDark, 0, -0.485, 0, sh, false);                   // cuff
    mk(sp(0.06, 10, 8), skin, 0, -0.53, 0, sh).scale.set(0.9, 1.1, 0.8);
    mk(bx(0.026, 0.05, 0.03), skin, x > 0 ? -0.045 : 0.045, -0.515, 0.02, sh, false).rotation.z = x > 0 ? 0.4 : -0.4;   // thumb
    return sh;
  });
  const hand = new THREE.Object3D(); hand.position.set(0, -0.56, 0.05); arms[1].add(hand);
  const pad = new THREE.Group();
  mk(bx(0.22, 0.05, 0.11), mat(0x1b1b1b), 0, 0, 0, pad); mk(bx(0.04, 0.02, 0.03), mat(0x3ddc97), 0.05, 0.03, 0, pad, false);
  [-1, 1].forEach(s => mk(sp(0.035, 8, 6), mat(0x1b1b1b), s * 0.09, -0.02, -0.02, pad, false));   // grips
  pad.position.set(0, 0.92, 0.44); pad.visible = false; g.add(pad);
  return { g, legs, arms, head, hand, pad, eyes, mouth };
}

// a group tipped back around the head's centre, so whatever is in it covers the back of the head but leaves the face clear
function tipped(skull, angle) { const t = new THREE.Group(); t.rotation.x = -angle; skull.add(t); return t; }

function buildHair(style, skull, hairM, mk, look) {
  const back = tipped(skull, 0.66);   // the hairline: front edge just above the brows, back edge down the nape
  const cap = (r = 0.18, cover = 0.55) => { const h = mk(sp(r, 20, 12, 0, Math.PI * 2, 0, Math.PI * cover), hairM, 0, 0.015, -0.015, back); h.scale.set(1.02, 1, 1.05); return h; };
  const sideburns = () => [-1, 1].forEach(s => mk(bx(0.022, 0.06, 0.045), hairM, s * 0.163, -0.035, 0.03));
  switch (style) {
    case 'bald': break;
    case 'buzz': { const h = mk(sp(0.174, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM, 0, 0.012, -0.008, tipped(skull, 0.5)); h.scale.set(1.01, 1, 1.03); break; }
    case 'long':
      cap();
      // a curved curtain of hair round the back and sides, open at the face
      mk(geo('curtain', () => new THREE.CylinderGeometry(0.178, 0.205, 0.36, 20, 1, true, Math.PI - 1.9, 3.8)), hairM, 0, -0.12, -0.01).scale.z = 1.02;
      [-1, 1].forEach(s => mk(bx(0.04, 0.24, 0.07), hairM, s * 0.165, -0.09, 0.05)); break;
    case 'bun': cap(); mk(sp(0.08, 12, 10), hairM, 0, 0.18, -0.08); break;
    case 'ponytail': {
      cap(); mk(cy(0.04, 0.04, 0.03, 10), mat(0xff4f7b), 0, 0.04, -0.175).rotation.x = Math.PI / 2;
      const tail = mk(cy(0.045, 0.02, 0.3, 10), hairM, 0, -0.08, -0.23); tail.rotation.x = 0.3; break;
    }
    case 'side': {
      cap(); sideburns();
      const fringe = mk(bx(0.22, 0.05, 0.07), hairM, -0.03, 0.115, 0.125); fringe.rotation.set(-0.45, 0, 0.22); break;
    }
    case 'spiky':
      cap(0.18, 0.5);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, r = i % 2 ? 0.1 : 0.05;
        const s = mk(cy(0, 0.045, 0.12, 6), hairM, Math.cos(a) * r, 0.17, Math.sin(a) * r - 0.01, back);
        s.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      }
      break;
    case 'curly':
      cap(0.182, 0.5);
      for (let i = 0; i < 18; i++) {
        const a = i * 2.39996, t = 0.15 + (i / 18) * 0.42;   // golden-angle spiral over the top of the head
        mk(sp(0.048, 8, 6), hairM, Math.sin(Math.PI * t) * Math.cos(a) * 0.17, Math.cos(Math.PI * t) * 0.17 + 0.02, Math.sin(Math.PI * t) * Math.sin(a) * 0.17 - 0.01, back);
      }
      break;
    case 'cap': {
      cap(); sideburns();
      const capM = mat(look.cap || 0xf08a24, { roughness: 0.8 }), hat = tipped(skull, 0.25);
      mk(sp(0.185, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capM, 0, 0.02, 0, hat); mk(bx(0.26, 0.025, 0.16), capM, 0, 0.04, 0.2, hat);
      mk(sp(0.015, 6, 4), capM, 0, 0.205, 0, hat); break;
    }
    case 'bucket': {
      cap(); const capM = mat(look.cap || 0x2f2f2f, { roughness: 0.9 }), hat = tipped(skull, 0.2);
      mk(cy(0.16, 0.19, 0.14, 18), capM, 0, 0.125, 0, hat); mk(cy(0.26, 0.26, 0.015, 20), capM, 0, 0.06, 0, hat); break;
    }
    default: cap(); sideburns();   // short
  }

  if (look.beanie) {
    const bm = mat(look.beanie, { roughness: 1 }), hat = tipped(skull, 0.35);
    mk(sp(0.19, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), bm, 0, 0.03, 0, hat); mk(cy(0.19, 0.19, 0.07, 16), bm, 0, 0.04, 0, hat);
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
