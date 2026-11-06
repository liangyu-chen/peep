'use client';

import { useEffect, useRef, useState } from 'react';
import { notify } from '../../SaveBar';

// 常點: type anything, or pick from the menu. The ▾ button always opens the whole menu (a browser's own suggestion
// list only shows what matches what's already typed, and on a phone often won't open at all); typing filters it.
export default function DrinkField({ drinks, initial }: { drinks: string[]; initial: string }) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);   // filter only once they've typed; opened from the button, show all
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const q = value.trim();
  const list = typed && q ? drinks.filter(d => d.includes(q)) : drinks;
  // (a pick sets the value without the browser's own input event, so tell the save bar)
  const pick = (d: string) => { if (d !== value) notify(box.current, 'dirty'); setValue(d); setOpen(false); setTyped(false); };

  return (
    <div className="drink-pick" ref={box}>
      <div className="drink-row">
        <input
          name="drink" value={value} maxLength={30} placeholder="從菜單選，或直接輸入" autoComplete="off"
          onChange={e => { setValue(e.target.value); setTyped(true); setOpen(true); }}
          onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'ArrowDown') setOpen(true); }}
          aria-expanded={open} aria-controls="drink-options" role="combobox"
        />
        <button type="button" className="drink-open" aria-label="從菜單選" onClick={() => { setTyped(false); setOpen(o => !o); }}>▾</button>
      </div>
      {open && list.length > 0 && (
        <ul id="drink-options" className="drink-options" role="listbox">
          {list.map(d => (
            <li key={d}><button type="button" role="option" aria-selected={d === value} className={d === value ? 'on' : ''} onClick={() => pick(d)}>{d}</button></li>
          ))}
        </ul>
      )}
      {q && !drinks.includes(q) && <small className="muted">不在菜單上，老闆會照做</small>}
    </div>
  );
}
