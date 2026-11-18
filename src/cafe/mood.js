import { S } from './state.js';
import { log } from './feed.js';
import { RUDE_TYPES, KIND_TYPES } from '../battle/data.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const CLOUD_SVG = '<svg viewBox="0 0 10 11" width="10" height="11" aria-hidden="true" shape-rendering="crispEdges"><title>🌧</title><path fill="#14121a" d="M3 0h4v1h1v1h1v3h-1v1H2V6H1V3h1V2h1z"/><path fill="#8de2ff" d="M3 1h4v1h1v3H2V3h1z"/><path fill="#14121a" d="M2 7h1v3H2zM5 7h1v3H5zM8 7h1v3H8z"/><path fill="#8de2ff" d="M2 8h1v2H2zM5 8h1v2H5zM8 8h1v2H8z"/></svg>';
const moodText = (mode) => (mode === 'rude' ? '感到不開心' : '有心事');
const rudePicked = new WeakSet();

export function createMoodPlan() {
  if (Math.random() >= 0.5) return null;
  return { mode: 'kind', type: pick(KIND_TYPES), icon: '☁' };
}

function ensureIcon(p) {
  if (p.moodEl) return p.moodEl;
  const el = document.createElement('b');
  el.className = 'moodIcon';
  el.hidden = true;
  p.tag.append(el);
  p.moodEl = el;
  return el;
}

function showMood(p) {
  const el = ensureIcon(p);
  p.mood = { ...p.moodPlan };
  if (p.mood.mode === 'kind') el.innerHTML = CLOUD_SVG;
  else el.textContent = p.mood.icon;
  el.className = `moodIcon ${p.mood.mode}`;
  el.hidden = false;
  log(`${p.p.name}${moodText(p.mood.mode)}`);
}

export function updateMood(p) {
  if (!p || p.role !== 'customer' || p.gone || !p.seat || p.pose !== 'sit' || p.mood || !p.moodPlan) return;
  showMood(p);
}

export function makeRude(p) {
  if (!p || p.p?.regular || rudePicked.has(p)) return;
  rudePicked.add(p);
  removeMood(p);
  p.moodPlan = { mode: 'rude', type: pick(RUDE_TYPES), icon: '❗' };
  showMood(p);
}

export function updateMoods() {
  for (const p of S.people.slice()) updateMood(p);
}

export function removeMood(p, announce = false) {
  if (!p?.mood) return;
  const { mode } = p.mood;
  p.mood = null;
  p.moodPlan = null;
  if (p.moodEl) {
    p.moodEl.textContent = '';
    p.moodEl.hidden = true;
  }
  if (announce) log(`${p.p.name}不再${moodText(mode)}`);
}

export function resolveBattle(p, kind) {
  if (!p || p.gone || !p.mood || kind !== 'win') return;
  removeMood(p, true);
}
