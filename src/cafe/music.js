// The café's background music: a soft, cute four-bar loop (Cmaj7, Am7, Fmaj7, G) played on the spot with the Web Audio
// API, so there's nothing to download: a round triangle bass, a sine-wave arpeggio, a gentle tune on top and a quiet
// shaker. It waits for the first click (browsers won't play sound before one), rests while the page is hidden, and can
// be switched off, remembered in this browser.
import { audio } from './sfx.js';

const BPM = 88, STEP = 60 / BPM / 2;   // eighth notes
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = n => 440 * 2 ** ((NOTE[n[0]] + (n[1] === '#' ? 1 : 0) + 12 * (Number(n.at(-1)) + 1) - 69) / 12);
const BARS = [
  { bass: ['C3', 'G2'], chord: ['C4', 'E4', 'G4', 'B4'], tune: ['E5', null, 'G5', null, 'A5', 'G5', 'E5', null] },
  { bass: ['A2', 'E2'], chord: ['A3', 'C4', 'E4', 'G4'], tune: ['C5', null, 'E5', null, 'D5', 'C5', 'A4', null] },
  { bass: ['F2', 'C3'], chord: ['F3', 'A3', 'C4', 'E4'], tune: ['A4', null, 'C5', null, 'F5', 'E5', 'C5', null] },
  { bass: ['G2', 'D3'], chord: ['G3', 'B3', 'D4', 'F4'], tune: ['B4', null, 'D5', null, 'G5', null, 'F5', 'D5'] },
];
// every other time round, the tune answers itself an octave lower and sparser, so the loop doesn't wear thin
const ANSWER = [['G4', null, null, 'E4', null, 'G4', null, null], ['A4', null, null, 'E4', null, 'C5', null, null],
  ['F4', null, null, 'A4', null, 'C5', null, null], ['G4', null, 'B4', null, 'D5', null, null, null]];

let on = true, master = null, timer = 0, next = 0, step = 0;
try { on = localStorage.getItem('peep.music') !== 'off'; } catch { /* private mode */ }
export const musicOn = () => on;

function note(a, f, t, dur, type, vol) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function shaker(a, t, vol) {
  const len = Math.floor(a.sampleRate * 0.05), b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = b; f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = vol;
  s.connect(f).connect(g).connect(master); s.start(t);
}
// lay down the notes a little ahead of time, one eighth at a time
function schedule() {
  const a = audio(); if (!a) return;
  while (next < a.currentTime + 0.25) {
    const bar = Math.floor(step / 8) % 4, e = step % 8, loop = Math.floor(step / 32), B = BARS[bar];
    if (e === 0 || e === 4) note(a, hz(B.bass[e / 4]), next, STEP * 3.6, 'triangle', 0.22);
    const c = B.chord[[0, 1, 2, 3, 2, 1, 2, 3][e]]; note(a, hz(c), next, STEP * 1.8, 'sine', 0.06);
    const m = (loop % 2 ? ANSWER[bar] : B.tune)[e]; if (m) note(a, hz(m), next, STEP * (loop % 2 ? 2.4 : 1.6), 'triangle', 0.1);
    if (e % 2) shaker(a, next, 0.05);
    next += STEP; step++;
  }
}

export function startMusic() {
  if (!on || timer) return;
  const a = audio(); if (!a) return;
  if (!master) { master = a.createGain(); master.gain.value = 0.32; master.connect(a.destination); }
  next = a.currentTime + 0.1;
  timer = setInterval(schedule, 60); schedule();
}
export function stopMusic() { clearInterval(timer); timer = 0; }
export function toggleMusic() {
  on = !on;
  try { localStorage.setItem('peep.music', on ? 'on' : 'off'); } catch { /* private mode */ }
  if (on) startMusic(); else stopMusic();
  return on;
}
// hidden tab: let it rest (and the battery with it); back in view, pick up again
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); else if (on && master) startMusic(); });
