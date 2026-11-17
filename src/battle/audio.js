import { audio, sfxMuted } from '../cafe/sfx.js';

let noiseBuf = null;

function tone(freqs, dur, type = 'square', vol = 0.03) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  gain.connect(ac.destination);
  freqs.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const noteStart = start + (i * dur) / freqs.length;
    const noteEnd = start + ((i + 1) * dur) / freqs.length;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, noteStart);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.82), noteEnd);
    osc.connect(gain);
    osc.start(noteStart);
    osc.stop(noteEnd + 0.02);
  });
  window.setTimeout(() => {
    try {
      gain.disconnect();
    } catch {}
  }, (dur + 0.5) * 1000);
}

function noise(dur = 0.2, vol = 0.04, freq = 1200, type = 'bandpass') {
  const ac = audio();
  if (!ac) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  src.buffer = noiseBuf;
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(vol, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + dur);
}

const bank = {
  select: () => tone([740, 990], 0.08, 'square', 0.024),
  back: () => tone([520, 360], 0.08, 'square', 0.022),
  coffee: () => {
    noise(0.3, 0.028, 800, 'lowpass');
    tone([300, 420], 0.24, 'sawtooth', 0.018);
    window.setTimeout(() => noise(0.4, 0.045, 700, 'lowpass'), 600);
  },
  latte: () => {
    tone([523, 659, 784, 1047], 0.5, 'triangle', 0.026);
    window.setTimeout(() => tone([1319, 1568], 0.25, 'square', 0.014), 620);
  },
  slipper: () => {
    // a whoosh on the wind-up, then the slap when it lands
    noise(0.22, 0.03, 900, 'bandpass');
    window.setTimeout(() => {
      noise(0.16, 0.08, 1600, 'bandpass');
      tone([150, 90, 60], 0.22, 'square', 0.04);
    }, 480);
  },
  spray: () => {
    tone([1200], 0.05, 'square', 0.02);
    noise(0.75, 0.035, 4200, 'highpass');
    window.setTimeout(() => tone([260, 210, 170], 0.4, 'sawtooth', 0.016), 520);
  },
  bite: () => {
    noise(0.14, 0.05, 900, 'lowpass');
    tone([200, 90], 0.18, 'square', 0.034);
  },
  web: () => {
    noise(0.35, 0.028, 3200, 'bandpass');
    tone([500, 700, 420], 0.3, 'triangle', 0.016);
  },
  poison: () => tone([240, 190, 150], 0.35, 'sawtooth', 0.02),
  pounce: () => {
    noise(0.16, 0.045, 600, 'lowpass');
    tone([240, 160], 0.18, 'square', 0.03);
  },
  hit: () => {
    noise(0.1, 0.048, 1100, 'bandpass');
    tone([160, 100], 0.12, 'square', 0.034);
  },
  crit: () => {
    noise(0.16, 0.06, 1500, 'bandpass');
    tone([320, 180, 90], 0.2, 'square', 0.042);
  },
  miss: () => {
    noise(0.18, 0.028, 2200, 'highpass');
    tone([420, 300], 0.12, 'triangle', 0.018);
  },
  heal: () => tone([520, 660, 780, 1040], 0.5, 'triangle', 0.028),
  guard: () => tone([320, 380, 520], 0.22, 'triangle', 0.026),
  roach: () => {
    noise(0.06, 0.026, 5000, 'highpass');
    window.setTimeout(() => noise(0.06, 0.026, 4200, 'highpass'), 90);
  },
  flee: () => {
    noise(0.4, 0.026, 1600, 'highpass');
    tone([800, 600, 400], 0.32, 'triangle', 0.023);
  },
  faint: () => tone([360, 280, 200, 120], 0.6, 'sawtooth', 0.028),
  win: () => jingle(WIN_SONG),
  lose: () => jingle(LOSE_SONG),
};

export function play(name) {
  const fn = bank[name];
  if (!fn) return;
  try {
    fn();
  } catch {}
}

// ---- Battle music: a short original chiptune loop in A minor, made on the spot -------------
// Four bars of eighth notes at 160 bpm: a square-wave lead, a triangle bass bouncing between
// octaves, a soft kick on the beat and a noise hat on the off-beats. Scheduled a little ahead
// on the audio clock so it keeps time even when the page is busy drawing.
const N = {
  E2: 82.41, F2: 87.31, G2: 98, A2: 110,
  E4: 329.63, Gs4: 415.3, A4: 440, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880,
};
const STEP = 60 / 160 / 2;
const BASS = [N.A2, N.F2, N.G2, N.E2];
// two four-bar phrases; 0 is a rest
const LEAD = [
  [N.E5, 0, N.A4, 0, N.C5, N.E5, N.D5, N.C5,
    N.F5, 0, N.E5, 0, N.D5, N.C5, N.A4, 0,
    N.G5, 0, N.D5, 0, N.B4, N.D5, N.G5, N.F5,
    N.E5, 0, 0, N.B4, N.E5, 0, N.Gs4, 0],
  [N.A5, 0, N.E5, 0, N.C5, N.E5, N.A5, N.G5,
    N.F5, 0, N.C5, 0, N.F5, N.E5, N.D5, N.C5,
    N.D5, 0, N.G5, 0, N.F5, N.E5, N.D5, N.B4,
    N.E5, 0, N.D5, N.C5, N.B4, 0, N.Gs4, N.B4],
];

let music = null;

function getNoise(ac) {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function voice(ac, out, type, f0, f1, t, dur, vol) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function hat(ac, out, t) {
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  src.buffer = getNoise(ac);
  filter.type = 'highpass';
  filter.frequency.value = 6000;
  gain.gain.setValueAtTime(0.05, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + 0.06);
}

function scheduleStep(ac, out, step, loop, t) {
  const i = step % 32;
  const root = BASS[Math.floor(i / 8)];
  voice(ac, out, 'triangle', i % 2 ? root * 2 : root, i % 2 ? root * 2 : root, t, STEP * 0.9, 0.1);
  const note = LEAD[loop % 2][i];
  if (note) voice(ac, out, 'square', note, note, t, STEP * 0.85, 0.05);
  if (i % 2 === 0) voice(ac, out, 'sine', 150, 50, t, 0.1, 0.1);
  else hat(ac, out, t);
}

export function startMusic() {
  if (music || sfxMuted()) return;
  const ac = audio();
  if (!ac) return;
  const master = ac.createGain();
  master.gain.value = 0.5;
  master.connect(ac.destination);
  let step = 0;
  let next = ac.currentTime + 0.1;
  const tick = () => {
    audio();
    // after a stall (hidden tab) pick up from now instead of piling notes into the past
    if (next < ac.currentTime) next = ac.currentTime + 0.05;
    while (next < ac.currentTime + 0.25) {
      scheduleStep(ac, master, step, Math.floor(step / 32), next);
      next += STEP;
      step++;
    }
  };
  tick();
  music = { ac, master, timer: window.setInterval(tick, 60) };
}

export function stopMusic(fade = 0.4) {
  if (!music) return;
  const { ac, master, timer } = music;
  music = null;
  window.clearInterval(timer);
  try {
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(master.gain.value, ac.currentTime);
    master.gain.linearRampToValueAtTime(0, ac.currentTime + fade);
  } catch {}
  window.setTimeout(() => {
    try {
      master.disconnect();
    } catch {}
  }, (fade + 0.5) * 1000);
}

// ---- Result jingles: short original tunes for winning and losing, under 4 s so they end
// before the battle screen closes. Each row is [lead, bass, beats]; 0 is a rest.
const WIN_SONG = {
  beat: 0.13,
  lead: 'square',
  notes: [
    [N.C5, 130.81, 1], [N.E5, 0, 1], [N.G5, 0, 1], [1046.5, 0, 3],
    [N.G5, 196, 1], [1046.5, 0, 1], [N.A5, 174.61, 2], [N.G5, 0, 2],
    [N.F5, 174.61, 1], [N.E5, 0, 1], [N.D5, 196, 1], [N.E5, 0, 1],
    [1046.5, 130.81, 6],
  ],
};
const LOSE_SONG = {
  beat: 0.18,
  lead: 'triangle',
  notes: [
    [N.E5, N.A2, 2], [N.D5, 0, 1], [N.C5, 0, 1],
    [N.B4, N.E2, 2], [N.A4, 0, 1], [N.Gs4, 0, 1],
    [N.A4, N.F2, 2], [N.E4, 0, 2],
    [N.A4 / 2 * 1.5, N.E2, 2], [N.A4 / 2, N.A2 / 2, 6],
  ],
};

function jingle(song) {
  const ac = audio();
  if (!ac || sfxMuted()) return;
  const out = ac.createGain();
  out.gain.value = 0.5;
  out.connect(ac.destination);
  let t = ac.currentTime + 0.05;
  for (const [lead, bass, beats] of song.notes) {
    const dur = song.beat * beats;
    if (lead) voice(ac, out, song.lead, lead, lead, t, dur * 0.92, song.lead === 'square' ? 0.06 : 0.12);
    if (bass) voice(ac, out, 'triangle', bass, bass, t, Math.min(dur, song.beat * 4) * 0.95, 0.12);
    t += dur;
  }
  window.setTimeout(() => {
    try {
      out.disconnect();
    } catch {}
  }, (t - ac.currentTime + 0.5) * 1000);
}
