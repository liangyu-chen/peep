'use client';

import { useRef, useState } from 'react';
import { HAIR, HAIR_CM, FIXED_CUTS, lengthForCm } from '@/src/content/catalog';

const label = (v: string) => HAIR.length.find(o => o.value === v)?.label ?? v;

// the hair's length: a cut that is what it is (光頭, 平頭, 蘑菇頭, 阿志頭), or hair whose length is set with − / +, from
// 短髮 (0 cm) on up a couple of cm at a time; it shows which band that is (短長髮, 中長髮, 長髮). Each change fires the
// form's input event, so the preview follows. Until − / + is used, a look keeps the fixed length it had (hairCm empty)
export default function HairLengthField({ length, cm }: { length: string; cm: number | undefined; }) {
  const fixedCm: Record<string, number> = { short: 0, bob: 8, medium: 29, long: 33 };
  const fixed = FIXED_CUTS.includes(length);
  const [mode, setMode] = useState<string>(fixed ? length : 'hair');
  const [value, setValue] = useState<number>(cm ?? fixedCm[length] ?? 0);
  const [touched, setTouched] = useState(cm !== undefined);
  const box = useRef<HTMLFieldSetElement>(null);
  const changed = () => requestAnimationFrame(() => box.current?.dispatchEvent(new Event('input', { bubbles: true })));
  const step = (d: number) => { setMode('hair'); setTouched(true); setValue(v => Math.max(0, Math.min(HAIR_CM.max, v + d))); changed(); };
  const pick = (m: string) => { setMode(m); changed(); };
  const band = mode === 'hair' ? (touched ? lengthForCm(value) : (fixed ? 'short' : length)) : mode;
  return (
    <fieldset className="pick hair-length" ref={box}>
      <legend>長度</legend>
      <input type="hidden" name="hairLength" value={band} />
      <input type="hidden" name="hairCm" value={mode === 'hair' && touched ? String(value) : ''} />
      {FIXED_CUTS.map(c => (
        <label key={c}><input type="radio" name="hairMode" checked={mode === c} onChange={() => pick(c)} /><span>{label(c)}</span></label>
      ))}
      <span className={'stepper' + (mode === 'hair' ? ' on' : '')}>
        <button type="button" onClick={() => step(-HAIR_CM.step)} disabled={mode === 'hair' && value <= 0} aria-label="短一點">−</button>
        <button type="button" className="value" onClick={() => pick('hair')}>
          {label(FIXED_CUTS.includes(band) ? 'short' : band)}{mode === 'hair' && value > 0 ? ` · ${value} 公分` : ''}
        </button>
        <button type="button" onClick={() => step(HAIR_CM.step)} disabled={mode === 'hair' && value >= HAIR_CM.max} aria-label="長一點">＋</button>
      </span>
    </fieldset>
  );
}
