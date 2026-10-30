'use client';

import { useRef } from 'react';

const toHex = (n: number) => '#' + n.toString(16).padStart(6, '0');

// a colour picker with a row of preset swatches; picking a swatch fires the same input event as the picker,
// so the 3D preview follows along
export default function ColorField({ name, label, value, presets }: { name: string; label: string; value: number; presets: { value: number; label: string }[] }) {
  const input = useRef<HTMLInputElement>(null);
  const choose = (v: number) => {
    const el = input.current; if (!el) return;
    el.value = toHex(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  return (
    <div className="color-field">
      <label>{label}<input ref={input} name={name} type="color" defaultValue={toHex(value)} /></label>
      <div className="swatches" role="group" aria-label={`${label}預設色`}>
        {presets.map(p => (
          <button key={p.value} type="button" title={p.label} aria-label={p.label} style={{ background: toHex(p.value) }} onClick={() => choose(p.value)} />
        ))}
      </div>
    </div>
  );
}
