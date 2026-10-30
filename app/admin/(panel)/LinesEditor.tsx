'use client';

import { useEffect, useRef, useState } from 'react';
import { notify } from './SaveBar';

export type LineRow = { id: number | null; text: string; active: boolean };
export type LineCat = { key: string; label: string; vars?: string[]; rows: LineRow[] };
type Row = LineRow & { k: string };

const VAR_LABEL: Record<string, string> = { owner: '老闆名字', name: '客人名字', drink: '飲料', team: '球隊', fighter: '快打旋風角色', opponent: '對手名字' };
let nextKey = 0;
const keyed = (r: LineRow): Row => ({ ...r, k: `l${nextKey++}` });

// a text box that grows with what's typed, so a long line is always shown in full;
// it re-fits when its width changes too (rotating the phone, or a page laid out while hidden)
function GrowText(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => { const el = ref.current; if (el && el.offsetWidth > 40) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 4}px`; } };
  useEffect(fit, [props.value]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let w = el.offsetWidth;
    const ro = new ResizeObserver(() => { if (el.offsetWidth !== w) { w = el.offsetWidth; fit(); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <textarea ref={ref} rows={1} {...props} />;
}

// every dialogue situation on a page, edited together and saved by the page's save bar (as the `lines` field)
export default function LinesEditor({ categories, readOnly }: { categories: LineCat[]; readOnly: boolean }) {
  const [cats, setCats] = useState(() => categories.map(c => ({ ...c, rows: c.rows.map(keyed) })));
  const root = useRef<HTMLDivElement>(null);

  const update = (key: string, fn: (rows: Row[]) => Row[]) => {
    setCats(cs => cs.map(c => (c.key === key ? { ...c, rows: fn(c.rows) } : c)));
    notify(root.current, 'dirty');
  };
  const blank = cats.some(c => c.rows.some(r => !r.text.trim()));
  useEffect(() => { notify(root.current, 'problem', blank ? '有空白的台詞，填好或刪掉再儲存' : ''); }, [blank]);

  const payload = Object.fromEntries(cats.map(c => [c.key, c.rows.map(({ k, ...r }) => r)]));
  return (
    <div ref={root} className="lines-editor">
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />
      {cats.map(c => (
        <article key={c.key} id={c.key} className="cat">
          <header>
            <h3>{c.label}</h3>
            {!c.rows.some(r => r.active && r.text.trim()) && <span className="badge mute">不說話</span>}
          </header>
          {c.vars?.length ? (
            <p className="vars">可用變數：{c.vars.map(v => <code key={v}>{`{${v}}`}</code>)}<span>（{c.vars.map(v => VAR_LABEL[v]).join('、')}）</span></p>
          ) : null}
          {c.rows.length === 0 && <p className="hint">還沒有台詞，這個情境不會說話。</p>}
          {c.rows.map(r => (
            <div key={r.k} className={`line-row${r.active ? '' : ' off'}${r.id == null ? ' new' : ''}`}>
              <GrowText value={r.text} placeholder="輸入台詞…" aria-label="台詞" disabled={readOnly} className={r.text.trim() ? '' : 'invalid'}
                onChange={e => { const v = e.target.value; update(c.key, rows => rows.map(x => (x.k === r.k ? { ...x, text: v } : x))); }} />
              <span className="row-tools">
                <label className="check"><input type="checkbox" checked={r.active} disabled={readOnly}
                  onChange={e => { const v = e.target.checked; update(c.key, rows => rows.map(x => (x.k === r.k ? { ...x, active: v } : x))); }} /><span>啟用</span></label>
                <button type="button" className="danger" disabled={readOnly} onClick={() => update(c.key, rows => rows.filter(x => x.k !== r.k))}>刪除</button>
              </span>
            </div>
          ))}
          <button type="button" className="add-row" disabled={readOnly}
            onClick={() => update(c.key, rows => [...rows, keyed({ id: null, text: '', active: true })])}>＋ 新增一句</button>
        </article>
      ))}
    </div>
  );
}
