// Text that floats over the scene or scrolls in the HUD: the event log, coin pops, the 2K results list.
import { S } from './state.js';
import { $, K } from './util.js';

export function fmtTime(m) { const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60); return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }

export function log(text) {
  const list = $('logList'); if (!list) return;
  const li = document.createElement('li');
  li.innerHTML = `<time>${fmtTime(S.minutes)}</time>`; li.append(text);
  list.prepend(li);
  while (list.children.length > 6) list.lastChild.remove();
}

// pos is in plan coordinates
export function floatText(cls, text, pos, life = 1.4) {
  const el = document.createElement('div'); el.className = cls; el.textContent = text; S.labelsEl.append(el);
  S.floaters.push({ el, pos: pos.clone().setX(pos.x * K), life, max: life });
}

export function renderResults() {
  const ul = $('results'); if (!ul) return;
  ul.innerHTML = '';
  S.tv.results.forEach(r => { const li = document.createElement('li'); li.innerHTML = '<b></b> '; li.querySelector('b').textContent = `${r.w.name}（${r.w.team}）勝`; li.append(`${r.w.score}:${r.l.score} ${r.l.name}`); ul.append(li); });
}
