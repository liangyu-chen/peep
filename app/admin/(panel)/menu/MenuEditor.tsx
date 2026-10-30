'use client';

import { useEffect, useRef, useState } from 'react';
import { saveMenu } from '../../actions';
import SaveBar, { notify } from '../SaveBar';

export type MenuRow = { id: number | null; name: string; en: string; section: string; hot: string; ice: string; active: boolean };
type Row = MenuRow & { key: string };

let nextKey = 0;
const withKey = (r: MenuRow): Row => ({ ...r, key: `k${nextKey++}` });

// the whole menu as one table: edit anything, add, remove or reorder rows, then save it all at once
export default function MenuEditor({ initial, sections, readOnly }: { initial: MenuRow[]; sections: string[]; readOnly: boolean }) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(withKey));
  const root = useRef<HTMLDivElement>(null);
  const change = (next: Row[]) => { setRows(next); notify(root.current, 'dirty'); };
  const set = (key: string, field: keyof MenuRow, value: string | boolean) => change(rows.map(r => (r.key === key ? { ...r, [field]: value } : r)));
  // swap with the neighbouring row of the same section
  const move = (i: number, d: number) => {
    let j = i + d;
    while (j >= 0 && j < rows.length && rows[j].section !== rows[i].section) j += d;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice(); [next[i], next[j]] = [next[j], next[i]]; change(next);
  };
  const remove = (key: string) => change(rows.filter(r => r.key !== key));
  const add = (section: string) => {
    // a new row goes at the end of its section
    const at = rows.map(r => r.section).lastIndexOf(section);
    const row = withKey({ id: null, name: '', en: '', section, hot: '', ice: '', active: true });
    const next = rows.slice(); next.splice(at < 0 ? rows.length : at + 1, 0, row); change(next);
  };

  const names = rows.map(r => r.name.trim());
  const dupes = new Set(names.filter((n, i) => n && names.indexOf(n) !== i));
  const blank = rows.some(r => !r.name.trim());
  const sectionList = [...sections, ...new Set(rows.map(r => r.section).filter(s => !sections.includes(s)))];
  const problem = blank ? '有品項還沒填中文名' : dupes.size ? `品名重複：${[...dupes].join('、')}` : '';
  useEffect(() => { notify(root.current, 'problem', problem); }, [problem]);

  return (
    <form action={saveMenu} className="menu-editor">
      <div ref={root} />
      <input type="hidden" name="payload" value={JSON.stringify(rows.map(({ key, ...r }) => r))} />
      {sectionList.map(section => {
        const inSection = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.section === section);
        return (
          <section key={section} className="menu-section">
            <header><h2>{section}</h2><span className="muted">{inSection.length} 項</span></header>
            <div className="th menu-row"><span></span><span>中文名</span><span>英文名</span><span>熱</span><span>冰</span><span>分類</span><span>上架</span><span></span></div>
            {inSection.map(({ r, i }, n) => (
              <div key={r.key} className={`menu-row${r.active ? '' : ' off'}${r.id == null ? ' new' : ''}`}>
                <span className="order">
                  <button type="button" onClick={() => move(i, -1)} disabled={readOnly || n === 0} aria-label="往上移">▲</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={readOnly || n === inSection.length - 1} aria-label="往下移">▼</button>
                </span>
                <input value={r.name} onChange={e => set(r.key, 'name', e.target.value)} aria-label="中文名" placeholder="中文名" disabled={readOnly}
                  className={!r.name.trim() || dupes.has(r.name.trim()) ? 'invalid' : ''} />
                <input value={r.en} onChange={e => set(r.key, 'en', e.target.value)} aria-label="英文名" placeholder="English" disabled={readOnly} />
                <label className="cell"><span className="cell-label">熱</span><input value={r.hot} onChange={e => set(r.key, 'hot', e.target.value)} aria-label="熱的價格" placeholder="—" maxLength={6} disabled={readOnly} /></label>
                <label className="cell"><span className="cell-label">冰</span><input value={r.ice} onChange={e => set(r.key, 'ice', e.target.value)} aria-label="冰的價格" placeholder="—" maxLength={6} disabled={readOnly} /></label>
                <select value={r.section} onChange={e => set(r.key, 'section', e.target.value)} aria-label="分類" disabled={readOnly}>
                  {sectionList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <label className="check"><input type="checkbox" checked={r.active} onChange={e => set(r.key, 'active', e.target.checked)} disabled={readOnly} /><span>上架</span></label>
                <button type="button" className="danger" onClick={() => remove(r.key)} disabled={readOnly} aria-label={`刪除 ${r.name || '這一列'}`}>刪除</button>
              </div>
            ))}
            <button type="button" className="add-row" onClick={() => add(section)} disabled={readOnly}>＋ 在 {section} 新增一項</button>
          </section>
        );
      })}

      <SaveBar label="儲存菜單" readOnly={readOnly} />
    </form>
  );
}
