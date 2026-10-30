'use client';

import { useEffect, useRef, useState } from 'react';
import { parseLook, type Look } from '@/src/content/catalog';

type Preview = { update(look: Look, seed: string): void; setView(v: 'face' | 'full'): void; dispose(): void };

// live 3D preview of the person the surrounding form describes; redraws on every change to the form
export default function LookPreview({ initial, seed }: { initial: Look; seed: string }) {
  const host = useRef<HTMLDivElement>(null);
  const preview = useRef<Preview | null>(null);
  const [view, setView] = useState<'face' | 'full'>('face');

  useEffect(() => {
    let cancelled = false, unbind = () => {};
    import('@/src/cafe/preview.js').then(({ mountPreview }) => {
      const el = host.current;
      if (cancelled || !el) return;
      const p: Preview = mountPreview(el);
      preview.current = p;
      const form = el.closest('form');
      if (!form) return;
      const redraw = () => {
        const fd = new FormData(form);
        p.update(parseLook(k => { const v = fd.get(k); return v == null ? null : String(v); }, initial), String(fd.get('name') || seed));
      };
      form.addEventListener('input', redraw); form.addEventListener('change', redraw);
      unbind = () => { form.removeEventListener('input', redraw); form.removeEventListener('change', redraw); };
      redraw();
    });
    return () => { cancelled = true; unbind(); preview.current?.dispose(); preview.current = null; };
  }, [initial, seed]);

  useEffect(() => { preview.current?.setView(view); }, [view]);

  return (
    <div className="look-preview">
      <div ref={host} className="stage" aria-label="3D 預覽，可拖曳旋轉" />
      <div className="views">
        <button type="button" className={view === 'face' ? 'on' : ''} onClick={() => setView('face')}>臉部</button>
        <button type="button" className={view === 'full' ? 'on' : ''} onClick={() => setView('full')}>全身</button>
        <span className="muted">拖曳旋轉 · 滾輪縮放</span>
      </div>
    </div>
  );
}
