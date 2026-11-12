// The RPG menu: a 選單 button under the name panel opens the commands (道具 / 客人 / 系統 / 關閉), each command a
// window beside them, and some items a small choice window of their own. 返回 or Esc steps back a window; on a
// keyboard the arrows move the ▶ cursor. The camera, speed, sound and quality buttons inside are wired by hud.js
// (by their data-cam / data-speed / data-quality and ids), so this only opens and closes windows and runs the items.
import { S } from './state.js';
import { $ } from './util.js';
import { log } from './feed.js';

const CAM_KEYS = ['overview', 'counter', 'menu', 'tv', 'porch', 'back'];
const CAM_NAMES = { overview: '全景', counter: '吧台', menu: '菜單', tv: '電視', porch: '戶外區', back: '後場' };

// returns { closeMenu, hideRec }
export function bindMenu(root, on, off, { setCam, focusPerson }) {
  const btn = $('menuBtn'), cmd = $('cmdWin'), panel = $('menuPanel'), choice = $('choiceWin');
  const stack = [];   // the windows open now, the top one last

  const focusIn = win => win.querySelector('.view.cur .opt.sel, .view.cur .slot.sel, .view.cur .opt, .view.cur .slot, .opt.sel, .opt')?.focus({ preventScroll: true });
  const show = (win, view) => {
    if (view) win.querySelectorAll('.view').forEach(v => v.classList.toggle('cur', v.dataset.view === view));
    win.hidden = false;
    if (!stack.includes(win)) stack.push(win);
    focusIn(win);
  };
  const popAbove = win => { while (stack.length && stack[stack.length - 1] !== win) stack.pop().hidden = true; };
  const back = () => {
    const w = stack.pop(); if (!w) return;
    w.hidden = true;
    if (w === cmd) { btn.hidden = false; btn.setAttribute('aria-expanded', 'false'); btn.focus({ preventScroll: true }); return; }
    const top = stack[stack.length - 1]; if (top) focusIn(top);
  };
  const closeMenu = () => { while (stack.length) back(); };

  on(btn, 'click', () => { btn.hidden = true; btn.setAttribute('aria-expanded', 'true'); show(cmd); });
  on(cmd, 'click', e => {
    const b = e.target.closest('[data-cmd]'); if (!b) return;
    cmd.querySelectorAll('.opt').forEach(o => o.classList.toggle('sel', o === b));
    const c = b.dataset.cmd;
    if (c === 'close') { closeMenu(); return; }
    popAbove(cmd);
    if (c === 'guests') fillGuests();
    show(panel, c);
  });
  // 返回 closes the window it's in, and any opened from it
  on(root, 'click', e => { const b = e.target.closest('[data-back]'); if (b) { popAbove(b.closest('.win')); back(); } });

  // ---- 道具: the first tap on an item picks it and tells what it is, a second tap (or 使用) uses it
  const slots = [...panel.querySelectorAll('.slot')];
  let picked = 'cam';
  // the button under the description: 死神之眼 is worn (裝備 / 卸下), the rest are used
  const useLabel = name => (name === 'tag' ? (S.showTags !== false ? '卸下' : '裝備') : '使用');
  const pick = name => {
    picked = name;
    const s = slots.find(x => x.dataset.item === name);
    slots.forEach(x => x.classList.toggle('sel', x === s));
    $('itemDesc').textContent = s.dataset.desc;
    $('itemUse').hidden = name === 'none';
    $('itemUse').textContent = useLabel(name);
  };
  // what happened, in the description box, the way an RPG reports it
  const report = text => { $('itemDesc').textContent = text; };
  const use = name => {
    if (name === 'cam') show(choice, 'cams');
    else if (name === 'speed') show(choice, 'speed');
    else if (name === 'menu') { closeMenu(); setCam('menu'); }   // lean over the bar and read the clipboard
    else if (name === 'tag') {
      // 死神之眼: worn, everyone's name shows over their head (the name tags)
      S.showTags = S.showTags === false; showTag();
      report(S.showTags ? '裝備了死神之眼！每個人頭上的名字都看得見了。' : '卸下了死神之眼。名字從眼前消失了。');
      log(S.showTags ? '裝備了 死神之眼' : '卸下了 死神之眼');
      $('itemUse').textContent = useLabel('tag');
    }
  };
  const showTag = () => $('tagSlot').classList.toggle('lit', S.showTags !== false);
  showTag(); pick('cam');
  slots.forEach(s => on(s, 'click', () => { if (s.classList.contains('sel')) use(s.dataset.item); else pick(s.dataset.item); }));
  on($('itemUse'), 'click', () => use(picked));

  // ---- the monitor: a burst of static, then the channel's name in the corner until the view is dragged
  const rec = $('camRec');
  const showRec = name => { rec.querySelector('b').textContent = `CAM-0${CAM_KEYS.indexOf(name) + 1}`; rec.querySelector('span').textContent = CAM_NAMES[name]; rec.hidden = false; };
  const hideRec = () => { rec.hidden = true; };
  const noise = document.createElement('canvas');
  noise.className = 'camStatic'; noise.width = 64; noise.height = 112; noise.setAttribute('aria-hidden', 'true');
  root.appendChild(noise); off.push(() => noise.remove());
  const g = noise.getContext('2d');
  let raf = 0;
  const flicker = () => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    cancelAnimationFrame(raf);
    const t0 = performance.now(); noise.classList.add('on');
    const frame = t => {
      const img = g.createImageData(noise.width, noise.height), d = img.data;
      for (let p = 0; p < d.length; p += 4) { const v = Math.random() * 255; d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 235; }
      g.putImageData(img, 0, 0);
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, ((t - t0) / 5) % noise.height, noise.width, 8);   // the roll bar
      if (t - t0 < 380) raf = requestAnimationFrame(frame); else noise.classList.remove('on');
    };
    raf = requestAnimationFrame(frame);
  };
  off.push(() => cancelAnimationFrame(raf));
  // (hud.js moves the camera on the same click)
  on(choice, 'click', e => {
    const cam = e.target.closest('[data-cam]');
    if (cam) { closeMenu(); flicker(); showRec(cam.dataset.cam); return; }
    const sp = e.target.closest('[data-speed]');
    if (sp) {
      $('speedBadge').textContent = `${sp.dataset.speed}x`; back();
      report(sp.dataset.speed === '1' ? '把沙漏放平了。時間恢復正常流動。' : `翻轉了沙漏！店裡的時間變成 ${sp.dataset.speed} 倍速。`);
    }
  });

  // ---- 客人: who's in the shop now; picking one opens their card and the camera follows them
  const fillGuests = () => {
    const list = $('guestList'); list.textContent = '';
    const here = S.customers.filter(c => !c.outside);
    if (!here.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = '店裡現在沒有客人。'; list.appendChild(p); return; }
    here.forEach(c => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'opt guest';
      const nm = document.createElement('span'); nm.className = `nm ${c.p.regular ? 'reg' : 'new'}`; nm.textContent = c.p.name;
      const kind = document.createElement('span'); kind.className = 'kind'; kind.textContent = c.p.regular ? '熟客' : '新客';
      const st = document.createElement('span'); st.className = 'st'; st.textContent = c.status || '';
      b.append(nm, kind, st);
      b.onclick = () => { closeMenu(); focusPerson(c); };   // their card, and the camera over to them and following
      list.appendChild(b);
    });
  };

  // ---- keys: Esc steps back, the arrows move the cursor (three items to a row in 道具)
  on(window, 'keydown', e => {
    if (!stack.length || root.classList.contains('playing')) return;
    if (e.key === 'Escape') { e.preventDefault(); back(); return; }
    if (!e.key.startsWith('Arrow')) return;
    const top = stack[stack.length - 1];
    const list = [...top.querySelectorAll('.opt, .slot')].filter(el => el.offsetParent && !el.hidden);
    const i = list.indexOf(document.activeElement);
    const cols = document.activeElement?.classList.contains('slot') ? 3 : 1;
    const d = e.key === 'ArrowUp' ? -cols : e.key === 'ArrowDown' ? cols : e.key === 'ArrowLeft' ? -1 : 1;
    const n = list[Math.max(0, Math.min(list.length - 1, i < 0 ? 0 : i + d))];
    if (n) { e.preventDefault(); n.focus(); if (n.classList.contains('slot')) pick(n.dataset.item); }
  });

  return { closeMenu, hideRec };
}
