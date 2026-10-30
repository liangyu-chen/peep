'use client';

import { useEffect, useRef, useState } from 'react';
import { notify } from '../SaveBar';

export type ValueRow = { id: number | null; value: string; active: boolean };
export type Pool = { key: string; label: string; hint: string; rows: ValueRow[] };
type Row = ValueRow & { k: string };

let nextKey = 0;
const keyed = (r: ValueRow): Row => ({ ...r, k: `v${nextKey++}` });

// every random-value pool on one page, saved together by the page's save bar (as the `values` field)
export default function PoolsEditor({ pools, readOnly }: { pools: Pool[]; readOnly: boolean }) {
  const [list, setList] = useState(() => pools.map(p => ({ ...p, rows: p.rows.map(keyed) })));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const root = useRef<HTMLDivElement>(null);

  const update = (key: string, fn: (rows: Row[]) => Row[]) => { setList(ps => ps.map(p => (p.key === key ? { ...p, rows: fn(p.rows) } : p))); notify(root.current, 'dirty'); };
  const add = (key: string) => {
    const v = (drafts[key] ?? '').trim(); if (!v) return;
    update(key, rows => [...rows, keyed({ id: null, value: v, active: true })]);
    setDrafts(d => ({ ...d, [key]: '' }));
  };

  // a value may appear once per pool, and none may be blank
  const problem = list.map(p => {
    const vals = p.rows.map(r => r.value.trim());
    if (vals.some(v => !v)) return `「${p.label}」有空白的值`;
    const dup = vals.find((v, i) => vals.indexOf(v) !== i);
    return dup ? `「${p.label}」裡「${dup}」重複了` : '';
  }).find(Boolean) || '';
  useEffect(() => { notify(root.current, 'problem', problem); }, [problem]);

  const payload = Object.fromEntries(list.map(p => [p.key, p.rows.map(({ k, ...r }) => r)]));
  return (
    <div ref={root}>
      <input type="hidden" name="values" value={JSON.stringify(payload)} />
      {list.map(p => (
        <article key={p.key} id={p.key} className="cat">
          <header>
            <h3>{p.label}</h3>
            <span className="muted">{p.rows.filter(r => r.active).length} 個啟用</span>
            {!p.rows.some(r => r.active) && <span className="badge">使用預設值</span>}
          </header>
          <p className="vars">{p.hint}</p>
          <div className="chips">
            {p.rows.map(r => (
              <span key={r.k} className={`chip${r.active ? '' : ' off'}${r.id == null ? ' new' : ''}`}>
                <input value={r.value} aria-label={p.label} maxLength={20} disabled={readOnly} size={Math.max(2, r.value.length + 1)}
                  onChange={e => { const v = e.target.value; update(p.key, rows => rows.map(x => (x.k === r.k ? { ...x, value: v } : x))); }} />
                <label className="check" title="啟用"><input type="checkbox" checked={r.active} disabled={readOnly} aria-label={`啟用 ${r.value}`}
                  onChange={e => { const v = e.target.checked; update(p.key, rows => rows.map(x => (x.k === r.k ? { ...x, active: v } : x))); }} /></label>
                <button type="button" className="danger" disabled={readOnly} aria-label={`刪除 ${r.value}`} onClick={() => update(p.key, rows => rows.filter(x => x.k !== r.k))}>✕</button>
              </span>
            ))}
          </div>
          <div className="add-value">
            <input value={drafts[p.key] ?? ''} placeholder={`新增${p.label}…`} aria-label={`新增${p.label}`} maxLength={20} disabled={readOnly}
              onChange={e => setDrafts(d => ({ ...d, [p.key]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(p.key); } }} />
            <button type="button" disabled={readOnly || !(drafts[p.key] ?? '').trim()} onClick={() => add(p.key)}>加入</button>
          </div>
        </article>
      ))}
    </div>
  );
}
