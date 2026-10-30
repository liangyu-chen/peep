import { asc } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { DEFAULT_POOLS, POOLS } from '@/src/content/catalog';
import { addValue, updateValue, deleteValue } from '../../actions';

export default async function RandomPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const rows = db
    ? await db.select().from(schema.randomValues).orderBy(asc(schema.randomValues.sort), asc(schema.randomValues.id))
    : POOLS.flatMap(p => DEFAULT_POOLS[p.key].map((value, i) => ({ id: -1 - i, pool: p.key, value, sort: i, active: true })));
  const ro = !db;
  const active = (key: string) => rows.filter(r => r.pool === key && r.active).map(r => r.value);
  const [sur, f, m] = [active('surname'), active('titleF'), active('titleM')];
  const sample = sur.length && (f.length || m.length) ? [...sur.slice(0, 3).map(s => s + (f[0] ?? m[0])), ...sur.slice(0, 2).map(s => s + (m[0] ?? f[0]))] : [];

  return (
    <>
      <h1>新客隨機值</h1>
      <p className="hint">
        第一次來的客人是隨機組出來的：名字 =「姓氏」+「稱呼」，外加一個「身分」。這裡維護每一欄可以抽到的值。
        某一欄沒有任何啟用的值時，會改用預設值。
      </p>
      {sample.length > 0 && <p className="hint">目前可能出現的名字，例如：{sample.join('、')}⋯</p>}
      {msg && <p className="note ok">{msg}</p>}
      <nav className="toc">{POOLS.map(p => <a key={p.key} href={`#${p.key}`}>{p.label}</a>)}</nav>

      {POOLS.map(p => {
        const own = rows.filter(r => r.pool === p.key);
        return (
          <article key={p.key} id={p.key} className="cat">
            <header>
              <h3>{p.label}</h3>
              <span className="muted">{own.filter(r => r.active).length} 個啟用</span>
              {!own.some(r => r.active) && <span className="badge">使用預設值</span>}
            </header>
            <p className="vars">{p.hint}</p>
            <div className="chips">
              {own.map(r => (
                <form key={r.id} action={updateValue} className={`chip${r.active ? '' : ' off'}`}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="pool" value={p.key} />
                  <input name="value" defaultValue={r.value} aria-label={p.label} required maxLength={20} disabled={ro} />
                  <label className="check" title="啟用"><input type="checkbox" name="active" defaultChecked={r.active} disabled={ro} /></label>
                  <button disabled={ro} title="儲存">存</button>
                  <button formAction={deleteValue} className="danger" disabled={ro} title="刪除">✕</button>
                </form>
              ))}
            </div>
            <form action={addValue} className="line-row add">
              <input type="hidden" name="pool" value={p.key} />
              <input name="value" placeholder={`新增${p.label}…`} aria-label={`新增${p.label}`} required maxLength={20} disabled={ro} />
              <span />
              <span className="actions"><button className="primary" disabled={ro}>新增</button></span>
            </form>
          </article>
        );
      })}
    </>
  );
}
