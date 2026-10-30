import { asc } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { DEFAULT_NAMES, GENDERS } from '@/src/content/catalog';
import { addName, updateName, deleteName } from '../../actions';

function GenderSelect({ value, disabled }: { value: string; disabled: boolean }) {
  return (
    <select name="gender" defaultValue={value} aria-label="性別" disabled={disabled}>
      {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
    </select>
  );
}

export default async function NamesPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const rows = db
    ? await db.select().from(schema.customerNames).orderBy(asc(schema.customerNames.sort), asc(schema.customerNames.id))
    : DEFAULT_NAMES.map((n, i) => ({ ...n, id: -1 - i, sort: i, active: true }));
  const ro = !db;
  const activeCount = rows.filter(r => r.active).length;

  return (
    <>
      <h1>新客姓名</h1>
      <p className="hint">
        第一次來的客人會從這份名單隨機挑一個名字，店裡已經有人用的名字會先跳過。性別決定客人的髮型和穿著，「不限」會隨機。
        熟客（阿凱、美美⋯）的名字是固定的，不在這裡。沒有任何啟用的名字時，店裡會改用預設名單。
      </p>
      {msg && <p className="note ok">{msg}</p>}
      <p className="hint">目前啟用 {activeCount} 個名字。</p>

      <div className="table">
        <div className="th name-row"><span>排序</span><span>名字</span><span>性別</span><span>啟用</span><span></span></div>
        {rows.map(r => (
          <form key={r.id} action={updateName} className={`name-row${r.active ? '' : ' off'}`}>
            <input type="hidden" name="id" value={r.id} />
            <input name="sort" type="number" defaultValue={r.sort} aria-label="排序" disabled={ro} />
            <input name="name" defaultValue={r.name} aria-label="名字" required maxLength={20} disabled={ro} />
            <GenderSelect value={r.gender} disabled={ro} />
            <label className="check"><input type="checkbox" name="active" defaultChecked={r.active} disabled={ro} /><span>啟用</span></label>
            <span className="actions">
              <button disabled={ro}>儲存</button>
              <button formAction={deleteName} className="danger" disabled={ro}>刪除</button>
            </span>
          </form>
        ))}
      </div>

      <h2>新增名字</h2>
      <form action={addName} className="name-row add">
        <input name="sort" type="number" defaultValue={rows.length} aria-label="排序" disabled={ro} />
        <input name="name" placeholder="例如：周小姐、Kevin" aria-label="名字" required maxLength={20} disabled={ro} />
        <GenderSelect value="any" disabled={ro} />
        <span />
        <span className="actions"><button className="primary" disabled={ro}>新增</button></span>
      </form>
    </>
  );
}
