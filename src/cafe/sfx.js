// 8-bit sound effects for the games, made on the spot with the Web Audio API: square and triangle waves and bursts of
// noise, like an old console's sound chip. Nothing to download. The sound can be switched off, remembered in this browser.
let ac = null, noiseBuf = null, muted = false;
try { muted = localStorage.getItem('peep.sfx') === 'off'; } catch { /* private mode */ }

export const sfxMuted = () => muted;
export function toggleSfx() {
  muted = !muted;
  try { localStorage.setItem('peep.sfx', muted ? 'off' : 'on'); } catch { /* private mode */ }
  return muted;
}

export function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ac = new AC();
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

// one note: a wave from f0 sliding to f1 over dur seconds, starting `at` seconds from now
function tone(f0, f1, dur, { type = 'square', vol = 0.12, at = 0 } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
// a burst of noise through a filter (low for thuds, high for swishes)
function noise(dur, { vol = 0.15, freq = 1200, q = 0.8, type = 'bandpass', at = 0 } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + at, src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(a.destination); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
const tune = (notes, step, opts) => notes.forEach((f, i) => f && tone(f, f, step * 0.9, { ...opts, at: i * step }));

const SOUNDS = {
  select: () => tune([660, 990], 0.06),
  start: () => tune([523, 659, 784, 1047], 0.07, { vol: 0.1 }),
  punch: () => { noise(0.08, { freq: 900, vol: 0.2 }); tone(220, 70, 0.1, { vol: 0.14 }); },
  kick: () => { noise(0.14, { freq: 500, vol: 0.22 }); tone(160, 50, 0.16, { vol: 0.16 }); },
  block: () => tone(1100, 900, 0.05, { type: 'triangle', vol: 0.12 }),
  whiff: () => noise(0.07, { freq: 2500, vol: 0.06, type: 'highpass' }),
  ko: () => { tone(700, 60, 0.7, { vol: 0.14 }); noise(0.5, { freq: 300, vol: 0.18, type: 'lowpass' }); },
  win: () => tune([523, 659, 784, 1047, 0, 784, 1047], 0.09, { vol: 0.1 }),
  lose: () => tune([392, 330, 262, 196], 0.14, { type: 'triangle', vol: 0.14 }),
  throw: () => noise(0.12, { freq: 3000, vol: 0.08, type: 'highpass' }),
  thunk: () => { tone(140, 80, 0.07, { vol: 0.18 }); noise(0.04, { freq: 700, vol: 0.12 }); },
  bull: () => tune([1319, 1760], 0.07, { vol: 0.09 }),
  wall: () => tone(90, 60, 0.08, { type: 'triangle', vol: 0.18 }),
  shoot: () => tone(300, 700, 0.14, { type: 'triangle', vol: 0.12 }),
  swish: () => { noise(0.28, { freq: 4000, vol: 0.12, q: 0.5 }); tone(1568, 1568, 0.08, { vol: 0.06, at: 0.05 }); },
  money: () => { noise(0.28, { freq: 4000, vol: 0.12, q: 0.5 }); tune([1047, 1319, 1568, 2093], 0.06, { vol: 0.08 }); },
  rim: () => { tone(520, 480, 0.09, { vol: 0.12 }); tone(260, 240, 0.12, { vol: 0.1, at: 0.05 }); },
  buzzer: () => tone(180, 170, 0.7, { type: 'sawtooth', vol: 0.09 }),
  tick: () => tone(1200, 1200, 0.03, { vol: 0.06 }),
  launch: () => { tone(180, 1400, 0.4, { vol: 0.1 }); noise(0.3, { freq: 2000, vol: 0.08 }); },
  clash: () => { noise(0.06, { freq: 3500, vol: 0.18 }); tone(1800, 700, 0.08, { vol: 0.08 }); },
  dash: () => tone(400, 900, 0.1, { vol: 0.08 }),
  ringout: () => tone(900, 120, 0.5, { vol: 0.12 }),
  // the café itself, softer and rounder: bubbly pops for buttons, a swoosh as the camera moves, a boop for a customer's
  // card, the click of the neon's switch and its hum
  pop: () => tone(520, 1180, 0.08, { type: 'sine', vol: 0.09 }),
  popDown: () => tone(900, 380, 0.09, { type: 'sine', vol: 0.08 }),
  boop: () => { tone(440, 700, 0.09, { type: 'sine', vol: 0.08 }); tone(990, 1100, 0.08, { type: 'sine', vol: 0.05, at: 0.08 }); },
  swoosh: () => { noise(0.3, { freq: 700, vol: 0.05, type: 'lowpass' }); tone(260, 620, 0.25, { type: 'sine', vol: 0.03 }); },
  flick: () => { noise(0.03, { freq: 3000, vol: 0.12, type: 'highpass' }); tone(1500, 900, 0.04, { type: 'triangle', vol: 0.07 }); },
  buzz: () => tone(118, 120, 0.5, { type: 'sawtooth', vol: 0.025 }),
};

export function sfx(name) {
  if (muted) return;
  try { SOUNDS[name]?.(); } catch { /* audio not available */ }
}
