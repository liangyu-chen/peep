import { asc } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { DEFAULT_LINES, LINE_GROUPS } from '@/src/content/catalog';
import { addLine, updateLine, deleteLine, importDefaults } from '../../actions';

const VAR_LABEL: Record<string, string> = { name: '客人名字', drink: '飲料', team: '球隊', opponent: '對手名字' };

export default async function LinesPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const rows = db ? await db.select().from(schema.dialogueLines).orderBy(asc(schema.dialogueLines.sort), asc(schema.dialogueLines.id)) : [];
  const ro = !db;

  return (
    <>
      <h1>台詞</h1>
      <p className="hint">
        每個情境會隨機挑一句啟用中的台詞。還沒編輯過的情境用的是預設台詞；想讓某個情境安靜，請把它的台詞都取消「啟用」，
        全部刪掉的話會變回預設台詞。
      </p>
      {msg && <p className="note ok">{msg}</p>}
      <nav className="toc">
        {LINE_GROUPS.map(g => <a key={g.group} href={`#g-${g.group}`}>{g.group}</a>)}
      </nav>

      {LINE_GROUPS.map(g => (
        <section key={g.group} id={`g-${g.group}`}>
          <h2>{g.group}</h2>
          {g.items.map(cat => {
            const own = rows.filter(r => r.category === cat.key);
            const usingDefaults = own.length === 0;
            const silent = !usingDefaults && own.every(r => !r.active);
            return (
              <article key={cat.key} id={cat.key} className="cat">
                <header>
                  <h3>{cat.label}</h3>
                  <code className="key">{cat.key}</code>
                  {usingDefaults && <span className="badge">預設</span>}
                  {silent && <span className="badge mute">靜音</span>}
                </header>
                {cat.vars?.length ? (
                  <p className="vars">可用變數：{cat.vars.map(v => <code key={v}>{`{${v}}`}</code>)}<span>（{cat.vars.map(v => VAR_LABEL[v]).join('、')}）</span></p>
                ) : null}

                {usingDefaults ? (
                  <>
                    <ul className="defaults">{(DEFAULT_LINES[cat.key] ?? []).map((t, i) => <li key={i}>{t}</li>)}</ul>
                    <form action={importDefaults}>
                      <input type="hidden" name="category" value={cat.key} />
                      <button disabled={ro}>匯入預設台詞來編輯</button>
                    </form>
                  </>
                ) : own.map(r => (
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
          })}
        </section>
      ))}
    </>
  );
}
