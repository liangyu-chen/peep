'use client';

import { useRef, useState } from 'react';
import { HAIR, HAIR_CM, lengthForCm } from '@/src/content/catalog';

const label = (v: string) => HAIR.length.find(o => o.value === v)?.label ?? v;

// the hair's length: 光頭 or 平頭, or hair whose length is set with − / +, from 短髮 (0 cm) on up a couple of cm at a
// time; it shows which band that is (短長髮, 中長髮, 長髮). Each change fires the form's input event, so the preview
// follows. Until − / + is used, a look keeps the fixed length it had (hairCm is left empty)
export default function HairLengthField({ length, cm }: { length: string; cm: number | undefined; }) {
  const fixedCm: Record<string, number> = { short: 0, bob: 8, medium: 29, long: 33 };
  const [mode, setMode] = useState<string>(length === 'bald' || length === 'buzz' ? length : 'hair');
  const [value, setValue] = useState<number>(cm ?? fixedCm[length] ?? 0);
  const [touched, setTouched] = useState(cm !== undefined);
  const box = useRef<HTMLFieldSetElement>(null);
  const changed = () => requestAnimationFrame(() => box.current?.dispatchEvent(new Event('input', { bubbles: true })));
  const step = (d: number) => { setMode('hair'); setTouched(true); setValue(v => Math.max(0, Math.min(HAIR_CM.max, v + d))); changed(); };
  const pick = (m: string) => { setMode(m); changed(); };
  const band = mode === 'hair' ? (touched ? lengthForCm(value) : (length === 'bald' || length === 'buzz' ? 'short' : length)) : mode;
  return (
    <fieldset className="pick hair-length" ref={box}>
      <legend>長度</legend>
      <input type="hidden" name="hairLength" value={band} />
      <input type="hidden" name="hairCm" value={mode === 'hair' && touched ? String(value) : ''} />
      <label><input type="radio" name="hairMode" checked={mode === 'bald'} onChange={() => pick('bald')} /><span>光頭</span></label>
      <label><input type="radio" name="hairMode" checked={mode === 'buzz'} onChange={() => pick('buzz')} /><span>平頭</span></label>
      <span className={'stepper' + (mode === 'hair' ? ' on' : '')}>
        <button type="button" onClick={() => step(-HAIR_CM.step)} disabled={mode === 'hair' && value <= 0} aria-label="短一點">−</button>
        <button type="button" className="value" onClick={() => pick('hair')}>
          {label(band === 'bald' || band === 'buzz' ? 'short' : band)}{mode === 'hair' && value > 0 ? ` · ${value} 公分` : ''}
        </button>
        <button type="button" onClick={() => step(HAIR_CM.step)} disabled={mode === 'hair' && value >= HAIR_CM.max} aria-label="長一點">＋</button>
      </span>
    </fieldset>
  );
}
