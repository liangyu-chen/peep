import type { LineCategory } from '@/src/content/catalog';
import { addLine, updateLine, deleteLine } from '../actions';

const VAR_LABEL: Record<string, string> = { owner: '老闆名字', name: '客人名字', drink: '飲料', team: '球隊', fighter: '格鬥角色', opponent: '對手名字' };
type Row = { id: number; category: string; text: string; active: boolean };

// one dialogue situation: its lines (edit, switch off, delete) and a box to add one
export default function LineCategoryEditor({ cat, rows, ro }: { cat: LineCategory; rows: Row[]; ro: boolean }) {
  const silent = !rows.some(r => r.active);
  return (
    <article id={cat.key} className="cat">
      <header>
        <h3>{cat.label}</h3>
        <code className="key">{cat.key}</code>
        {silent && <span className="badge mute">不說話</span>}
      </header>
      {cat.vars?.length ? (
        <p className="vars">可用變數：{cat.vars.map(v => <code key={v}>{`{${v}}`}</code>)}<span>（{cat.vars.map(v => VAR_LABEL[v]).join('、')}）</span></p>
      ) : null}
      {rows.length === 0 && <p className="hint">還沒有台詞，這個情境不會說話。</p>}
      {rows.map(r => (
        <form key={r.id} action={updateLine} className={`line-row${r.active ? '' : ' off'}`}>
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="category" value={cat.key} />
          <input name="text" defaultValue={r.text} aria-label="台詞" required disabled={ro} />
          <label className="check"><input type="checkbox" name="active" defaultChecked={r.active} disabled={ro} /><span>啟用</span></label>
          <span className="actions">
            <button disabled={ro}>儲存</button>
            <button formAction={deleteLine} className="danger" disabled={ro}>刪除</button>
          </span>
        </form>
      ))}
      <form action={addLine} className="line-row add">
        <input type="hidden" name="category" value={cat.key} />
        <input name="text" placeholder="新增一句台詞…" aria-label="新台詞" required disabled={ro} />
        <span />
        <span className="actions"><button className="primary" disabled={ro}>新增</button></span>
      </form>
    </article>
  );
}
