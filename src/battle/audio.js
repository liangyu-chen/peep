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
    // the fling and the slosh of the stream, the splash as it lands, then a hiss of steam
    window.setTimeout(() => {
      noise(0.3, 0.03, 800, 'lowpass');
      tone([300, 420], 0.22, 'sawtooth', 0.016);
    }, 240);
    window.setTimeout(() => {
      noise(0.35, 0.05, 650, 'lowpass');
      noise(0.7, 0.02, 5200, 'highpass');
    }, 700);
  },
  latte: () => {
    // the milk pouring in, the cup sliding over, the heart lifting out
    noise(0.5, 0.012, 2600, 'bandpass');
    window.setTimeout(() => noise(0.25, 0.02, 900, 'lowpass'), 560);
    window.setTimeout(() => tone([1047, 1319, 1568], 0.36, 'triangle', 0.024), 900);
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
  broom: () => {
    // a creak as it's raised, the whoosh of the swing, then the smack and the bristles scattering dust
    tone([300, 360], 0.12, 'triangle', 0.014);
    window.setTimeout(() => noise(0.26, 0.055, 900, 'bandpass'), 300);
    window.setTimeout(() => {
      noise(0.16, 0.08, 1700, 'bandpass');
      tone([190, 110, 70], 0.24, 'square', 0.044);
      noise(0.45, 0.022, 500, 'lowpass');
    }, 590);
  },
  broomWhiff: () => {
    tone([300, 360], 0.12, 'triangle', 0.014);
    window.setTimeout(() => noise(0.34, 0.05, 700, 'bandpass'), 300);
    window.setTimeout(() => noise(0.55, 0.03, 420, 'lowpass'), 620);
  },
  dust: () => {
    noise(0.3, 0.03, 600, 'lowpass');
    window.setTimeout(() => tone([330, 260], 0.1, 'square', 0.02), 120);
    window.setTimeout(() => tone([300, 240], 0.1, 'square', 0.018), 300);
  },
  calc: () => {
    // keys tapped in, then the = key
    [0, 110, 220, 330, 440, 550].forEach((t, i) =>
      window.setTimeout(() => tone([1046 + (i % 3) * 120], 0.05, 'square', 0.02), t)
    );
    window.setTimeout(() => tone([1568, 1318], 0.12, 'square', 0.024), 680);
  },
  // one line of the bill landing: the till's bell
  ring: () => {
    noise(0.08, 0.04, 1300, 'bandpass');
    tone([1760, 2349], 0.16, 'triangle', 0.03);
  },
  chant: () => {
    // a temple bell, then a slow chanted phrase over a drone
    tone([392, 392], 0.9, 'triangle', 0.03);
    tone([98], 1.4, 'sawtooth', 0.01);
    [523, 523, 587, 523, 440, 523].forEach((f, i) =>
      window.setTimeout(() => tone([f, f], 0.2, 'square', 0.02), 220 + i * 170)
    );
    window.setTimeout(() => tone([784, 1046], 0.4, 'triangle', 0.026), 940);
  },
  cake: () => {
    // a little chime as it floats over, three bites, then something sweet
    tone([784, 988], 0.2, 'triangle', 0.02);
    [770, 910, 1050].forEach((t) => window.setTimeout(() => noise(0.06, 0.03, 1800, 'bandpass'), t));
    window.setTimeout(() => tone([659, 784, 1047, 1319], 0.5, 'triangle', 0.024), 880);
  },
  listen: () => {
    // soft blips for each worry drifting over, two nods, then the cloud clearing
    [100, 300, 500].forEach((t) => window.setTimeout(() => tone([330, 300], 0.1, 'triangle', 0.016), t));
    [420, 660].forEach((t) => window.setTimeout(() => tone([523, 440], 0.12, 'square', 0.016), t));
    window.setTimeout(() => tone([440, 554, 659, 880], 0.5, 'triangle', 0.022), 940);
  },
  rage: () => {
    // two voices trading complaints, then the steam going out with a whoosh
    [0, 300, 570, 750].forEach((t, i) => window.setTimeout(() => tone(i % 2 ? [300, 360] : [420, 520], 0.16, 'square', 0.022), t));
    window.setTimeout(() => {
      noise(0.5, 0.025, 3000, 'highpass');
      tone([523, 659, 784], 0.4, 'triangle', 0.022);
    }, 960);
  },
  slam: () => {
    noise(0.12, 0.07, 700, 'lowpass');
    tone([130, 70], 0.2, 'square', 0.045);
  },
  shout: () => {
    noise(0.28, 0.04, 2400, 'bandpass');
    tone([520, 700, 540], 0.34, 'sawtooth', 0.024);
  },
  boss: () => tone([330, 440, 660, 880], 0.42, 'square', 0.03),
  review: () => tone([880, 660, 440, 220], 0.42, 'square', 0.026),
  sigh: () => {
    // a long breath out, falling
    noise(0.9, 0.02, 700, 'lowpass');
    tone([392, 349, 294, 247], 0.9, 'triangle', 0.018);
  },
  grumble: () => {
    // a muttered blip for each complaint popping up, then them landing
    for (let i = 0; i < 6; i++) window.setTimeout(() => tone([240 + (i % 3) * 30, 210], 0.07, 'sawtooth', 0.016), 60 + i * 98);
    window.setTimeout(() => tone([300, 260, 220], 0.3, 'square', 0.02), 900);
  },
  cry: () => {
    // a wobbling wail, then the splash of the big tear
    tone([660, 620, 660, 590, 620, 520], 0.8, 'triangle', 0.022);
    window.setTimeout(() => noise(0.3, 0.035, 1400, 'bandpass'), 880);
  },
  remember: () => {
    // a hazy, sinking phrase and a little rain
    tone([440, 415, 370, 330, 277], 0.9, 'sawtooth', 0.016);
    window.setTimeout(() => noise(0.8, 0.012, 4200, 'highpass'), 520);
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
  // the coffee item: three gulps
  drink: () => {
    [180, 420, 640].forEach((t) => window.setTimeout(() => tone([220, 150], 0.12, 'triangle', 0.03), t));
  },
  // the tissue item: the toss, the box landing, the sheet flicked out, then soft dabs
  tissue: () => {
    noise(0.25, 0.02, 1800, 'bandpass');
    window.setTimeout(() => noise(0.08, 0.04, 500, 'lowpass'), 620);
    window.setTimeout(() => noise(0.18, 0.03, 4200, 'highpass'), 760);
    [1140, 1290, 1440].forEach((t) => window.setTimeout(() => noise(0.06, 0.015, 2600, 'bandpass'), t));
    window.setTimeout(() => tone([523, 659, 784], 0.4, 'triangle', 0.018), 1200);
  },
  heal: () => tone([520, 660, 780, 1040], 0.5, 'triangle', 0.028),
  // raising the guard: the whoosh of the shield coming down, its clang as it lands, and the barrier humming up
  guard: () => {
    noise(0.2, 0.02, 1400, 'bandpass');
    window.setTimeout(() => {
      noise(0.12, 0.05, 3200, 'bandpass');
      tone([880, 1320], 0.18, 'square', 0.022);
    }, 300);
    window.setTimeout(() => tone([392, 523, 659, 784], 0.4, 'triangle', 0.02), 420);
  },
  // a blow glancing off the guard: a high clang
  guardHit: () => {
    noise(0.1, 0.05, 4000, 'highpass');
    tone([1568, 1175], 0.22, 'square', 0.024);
  },
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
  C3: 130.81, D3: 146.83, E2: 82.41, F2: 87.31, G2: 98, A2: 110,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, Gs4: 415.3, A4: 440, B4: 493.88,
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
const KIND_MUSIC = {
  step: 60 / 116 / 2,
  bass: [N.C3, N.A2, N.F2, N.G2],
  lead: [
    [N.E4, 0, N.G5, 0, N.A5, 0, N.G5, N.E5,
      N.D5, 0, N.C5, 0, N.D5, N.E5, 0, 0,
      N.F4, 0, N.A4, 0, N.C5, 0, N.A4, N.G4,
      N.E5, 0, N.D5, 0, N.C5, 0, 0, 0],
    [N.G5, 0, N.E5, 0, N.C5, 0, N.D5, N.E5,
      N.F5, 0, N.E5, 0, N.D5, 0, N.C5, 0,
      N.A4, 0, N.C5, 0, N.E5, 0, N.G5, N.A5,
      N.G5, 0, N.E5, 0, N.C5, 0, 0, 0],
  ],
};
const MUSIC = {
  rude: { step: STEP, bass: BASS, lead: LEAD },
  kind: KIND_MUSIC,
};

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

function scheduleStep(ac, out, step, loop, t, song) {
  const i = step % 32;
  const root = song.bass[Math.floor(i / 8)];
  voice(ac, out, 'triangle', i % 2 ? root * 2 : root, i % 2 ? root * 2 : root, t, song.step * 0.9, 0.1);
  const note = song.lead[loop % 2][i];
  if (note) voice(ac, out, 'square', note, note, t, song.step * 0.85, 0.05);
  if (i % 2 === 0) voice(ac, out, 'sine', 150, 50, t, 0.1, 0.1);
  else hat(ac, out, t);
}

export function startMusic(mode = 'rude') {
  if (music || sfxMuted()) return;
  const ac = audio();
  if (!ac) return;
  const song = MUSIC[mode] || MUSIC.rude;
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
      scheduleStep(ac, master, step, Math.floor(step / 32), next, song);
      next += song.step;
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

// ---- Entry sting: an original 8-bit flourish timed to the café's entry wipe (cafe.css .battleEntry) -------------
// Two stabs on the two white flashes, a fast climbing run while the black bars sweep in, and a low hit with a held
// chord as they meet, which the battle loop then picks up from. `quick` squeezes it to the short wipe.
const ENCOUNTER = {
  rude: {
    stab: [N.A5, N.E5],
    run: [N.A4, N.E5, N.B4, N.F5, N.C5, N.G5, N.D5, N.A5, N.E5, 987.77, N.F5, 1046.5],
    bass: [N.A2, 220],
    chord: [N.A4, N.E5, N.A5],
  },
  kind: {
    stab: [1046.5, N.G5],
    run: [N.C5, N.G5, N.D5, N.A5, N.E5, 987.77, N.F5, 1046.5, N.G5, 1174.66, N.A5, 1318.51],
    bass: [N.C3, 261.63],
    chord: [N.C5, N.G5, 1046.5],
  },
};

function burst(ac, out, t, dur, vol, freq, type) {
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  src.buffer = getNoise(ac);
  filter.type = type;
  filter.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(t, Math.random() * 0.4);
  src.stop(t + dur + 0.02);
}

export function playEncounter(mode = 'rude', quick = false) {
  if (sfxMuted()) return;
  const ac = audio();
  if (!ac) return;
  try {
    const song = ENCOUNTER[mode] || ENCOUNTER.rude;
    const k = quick ? 0.47 : 1;   // the short wipe is 520 ms against 1100
    const out = ac.createGain();
    out.gain.value = 0.5;
    out.connect(ac.destination);
    const t0 = ac.currentTime + 0.02;
    // the two flashes peak at 18% and 54% of their .5 s
    [0.09, 0.27].forEach((at) => {
      const t = t0 + at * k;
      song.stab.forEach((f) => voice(ac, out, 'square', f, f, t, 0.12 * k, 0.05));
      burst(ac, out, t, 0.08 * k, 0.12, 3200, 'highpass');
    });
    // the bars sweeping in from .38 s: a climbing run over a rising bass and a whoosh
    const runStart = t0 + 0.38 * k;
    const step = 0.04 * k;
    song.run.forEach((f, i) => voice(ac, out, 'square', f, f, runStart + i * step, step * 0.9, 0.045));
    const runLen = song.run.length * step;
    voice(ac, out, 'triangle', song.bass[0], song.bass[1], runStart, runLen, 0.12);
    burst(ac, out, runStart, runLen, 0.05, 1400, 'bandpass');
    // the bars meet: a low boom and a held chord
    const hit = runStart + runLen;
    voice(ac, out, 'sine', 140, 40, hit, 0.25, 0.22);
    burst(ac, out, hit, 0.18, 0.1, 600, 'lowpass');
    song.chord.forEach((f) => voice(ac, out, 'square', f, f, hit, 0.45 * k + 0.1, 0.035));
    voice(ac, out, 'triangle', song.bass[0], song.bass[0], hit, 0.5 * k + 0.1, 0.14);
    window.setTimeout(() => {
      try {
        out.disconnect();
      } catch {}
    }, (hit - ac.currentTime + 1.2) * 1000);
  } catch {}
}
