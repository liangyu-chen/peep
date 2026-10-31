'use client';

import { useEffect, useRef } from 'react';

// The loading screen: the two hands from the drawing start apart and creep toward each other while the 3D scene loads.
// Once it's ready the finger goes home through the ring, and the screen dives into the ring to reveal the café.
// The hands are two cut-outs of one drawing (public/loading, made by scripts/split-hands.py) that meet exactly as drawn,
// shown inverted: white lines on black.
const RING = { x: 0.38, y: 0.6 };    // the hole in the ring, as a fraction of the drawing: where the screen dives in
const MIN_SHOW = 3.0;                 // seconds, so even a fast load shows the hands slowly closing in
const NEAR = 0.9;                     // how far they get while still loading
const TAU = 1.3;                      // how slowly they creep in (seconds)
const PUSH = 0.9, HOLD = 0.45, DIVE = 0.9;

export default function LoadingHands({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    const el = root.current; if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ease = (k: number) => k * k * (3 - 2 * k);
    let raf = 0, from = 0, endAt = -1;   // endAt: when the finish began (seconds), -1 until then
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      let p: number, shake = 0, dive = 0;
      if (endAt < 0 && readyRef.current && t >= (reduce ? 0 : MIN_SHOW)) { endAt = t; from = reduce ? 1 : NEAR * (1 - Math.exp(-t / TAU)); }
      if (endAt < 0) p = NEAR * (1 - Math.exp(-t / TAU));
      else {
        const e = t - endAt;
        p = from + (1 - from) * ease(Math.min(1, e / PUSH));
        if (e > PUSH && e < PUSH + HOLD) shake = Math.sin((e - PUSH) * 60) * (1 - (e - PUSH) / HOLD);
        dive = Math.max(0, Math.min(1, (e - PUSH - HOLD) / DIVE));
        if (reduce) { p = 1; shake = 0; dive = Math.min(1, e / 0.5); }
        if (dive >= 1) { onDone(); return; }
      }
      const gap = 1 - p;
      el.style.setProperty('--left', `${-gap * 24 + shake * 0.4}%`);
      el.style.setProperty('--right', `${gap * 46}%`);
      el.style.setProperty('--zoom', reduce ? '1' : String(1 + dive * dive * 7));
      el.style.setProperty('--fade', String(1 - Math.max(0, (dive - 0.35) / 0.65)));
      el.dataset.state = endAt < 0 ? 'loading' : 'in';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div className="loading-hands" ref={root} data-state="loading" role="status" aria-label="窺視咖啡 萬全淨土淨化中">
      <div className="lh-stage" style={{ transformOrigin: `${RING.x * 100}% ${RING.y * 100}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lh-right" src="/loading/hand-right.png" alt="" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lh-left" src="/loading/hand-left.png" alt="" draggable={false} />
      </div>
      <p className="lh-caption">
        <b>窺視咖啡</b>
        <span className="lh-wait">萬全淨土淨化中<i className="lh-dots"><i>.</i><i>.</i><i>.</i></i></span>
        <span className="lh-go">淨化完成</span>
      </p>
    </div>
  );
}
