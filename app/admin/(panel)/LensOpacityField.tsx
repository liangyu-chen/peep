'use client';

import { useRef, useState } from 'react';

const STEP = 10;

// 鏡片: 10% (clear tint) to 100% (solid); each change fires the form's input event, so the preview follows
export default function LensOpacityField({ value }: { value: number }) {
  const [percent, setPercent] = useState(() => Math.max(10, Math.min(100, Math.round(value * 100))));
  const box = useRef<HTMLFieldSetElement>(null);
  const set = (v: number) => {
    setPercent(v);
    requestAnimationFrame(() => box.current?.dispatchEvent(new Event('input', { bubbles: true })));
  };
  return (
    <fieldset className="pick" ref={box}>
      <legend>鏡片透明度（10% 透 → 100% 不透明）</legend>
      <input type="hidden" name="lensOpacity" value={(percent / 100).toFixed(2)} />
      <span className="stepper on">
        <button type="button" onClick={() => set(Math.max(10, percent - STEP))} disabled={percent <= 10} aria-label="更透明">−</button>
        <button type="button" className="value" onClick={() => set(100)} aria-label="設為不透明">{percent}%</button>
        <button type="button" onClick={() => set(Math.min(100, percent + STEP))} disabled={percent >= 100} aria-label="更不透明">＋</button>
      </span>
    </fieldset>
  );
}
