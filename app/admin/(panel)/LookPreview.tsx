'use client';

import { useEffect, useRef, useState } from 'react';
import { LOOK2, parseLook, prefixed, type Look } from '@/src/content/catalog';

type Preview = { update(look: Look, seed: string): void; setView(v: 'face' | 'full'): void; dispose(): void };

// live 3D preview of the person the surrounding form describes; redraws on every change to the form.
// On a phone, once it has scrolled up out of sight, it floats as a small window in the top right corner (under the
// header), so the changes and colours further down the form can still be seen as they're made; it can be tucked away.
// second: the regulars' editor, whose form also holds a second look (第二套捏臉, fields named LOOK2…): the 第一套 /
// 第二套 buttons switch both the preview and which set of fields the form shows (the form's data-look-set)
export default function LookPreview({ initial, seed, second }: { initial: Look; seed: string; second?: Look }) {
  const spot = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const preview = useRef<Preview | null>(null);
  const [view, setView] = useState<'face' | 'full'>('face');
  const [outfit, setOutfit] = useState<1 | 2>(1);
  const wearing = useRef<1 | 2>(1);
  const redrawNow = useRef<() => void>(() => {});
  const [floating, setFloating] = useState(false);
  const [tucked, setTucked] = useState(false);
  const [spotH, setSpotH] = useState(0);

  useEffect(() => {
    let cancelled = false, unbind = () => {}, queued = 0, lastKey = '';
    import('@/src/cafe/preview.js').then(({ mountPreview }) => {
      const el = host.current;
      if (cancelled || !el) return;
      const p: Preview = mountPreview(el);
      preview.current = p;
      const form = el.closest('form');
      if (!form) return;
      const draw = () => {
        const fd = new FormData(form);
        const who = String(fd.get('name') || seed);
        const get = (k: string) => { const v = fd.get(k); return v == null ? null : String(v); };
        const look = wearing.current === 2 && second ? parseLook(prefixed(get, LOOK2), second) : parseLook(get, initial);
        const key = JSON.stringify([look, who]);
        if (key === lastKey) return;
        lastKey = key;
        p.update(look, who);
      };
      // the picker fires input all through a drag: one rebuild per frame, not one per event
      const redraw = () => {
        if (queued) return;
        queued = requestAnimationFrame(() => { queued = 0; draw(); });
      };
      redrawNow.current = redraw;
      form.addEventListener('input', redraw); form.addEventListener('change', redraw);
      unbind = () => {
        redrawNow.current = () => {};
        if (queued) cancelAnimationFrame(queued);
        form.removeEventListener('input', redraw); form.removeEventListener('change', redraw);
      };
      redraw();
    });
    return () => { cancelled = true; unbind(); preview.current?.dispose(); preview.current = null; };
  }, [initial, second, seed]);

  useEffect(() => { preview.current?.setView(view); }, [view]);
  useEffect(() => {
    wearing.current = outfit; redrawNow.current();
    const form = host.current?.closest('form');
    if (form && second) form.dataset.lookSet = String(outfit);
  }, [outfit, second]);

  // phones only: float once the preview's own place has scrolled up past the header
  useEffect(() => {
    const el = spot.current;
    if (!el) return;
    const phone = window.matchMedia('(max-width: 760px)');
    const check = () => {
      if (!phone.matches) { setFloating(false); return; }
      const bar = document.querySelector('.admin .bar') as HTMLElement | null;
      const top = bar ? bar.getBoundingClientRect().bottom : 0;
      document.documentElement.style.setProperty('--float-top', `${Math.round(top + 8)}px`);
      const r = el.getBoundingClientRect();
      const out = r.bottom < top + 60;   // most of it gone under the header
      if (out && r.height > 0) setSpotH(r.height);
      setFloating(out);
    };
    check();
    window.addEventListener('scroll', check, { passive: true }); window.addEventListener('resize', check);
    phone.addEventListener('change', check);
    return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check); phone.removeEventListener('change', check); };
  }, []);

  return (
    <div ref={spot} style={floating ? { minHeight: spotH } : undefined}>
      <div className={'look-preview' + (floating ? ' floating' : '') + (floating && tucked ? ' tucked' : '')}>
        {floating && (
          <button type="button" className="tuck" onClick={() => setTucked(t => !t)} aria-label={tucked ? '展開預覽' : '收起預覽'}>
            {tucked ? '預覽' : '−'}
          </button>
        )}
        <div ref={host} className="stage" aria-label="3D 預覽，可拖曳旋轉" />
        <div className="views">
          <button type="button" className={view === 'face' ? 'on' : ''} onClick={() => setView('face')}>臉部</button>
          <button type="button" className={view === 'full' ? 'on' : ''} onClick={() => setView('full')}>全身</button>
          {second && <>
            <button type="button" className={outfit === 1 ? 'on' : ''} onClick={() => setOutfit(1)}>第一套</button>
            <button type="button" className={outfit === 2 ? 'on' : ''} onClick={() => setOutfit(2)}>第二套</button>
          </>}
          <span className="muted">拖曳旋轉 · 滾輪縮放</span>
        </div>
      </div>
    </div>
  );
}
