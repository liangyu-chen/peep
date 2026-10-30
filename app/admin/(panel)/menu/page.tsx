import { asc } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { DEFAULT_MENU } from '@/src/content/catalog';
import { addMenuItem, updateMenuItem, deleteMenuItem } from '../../actions';

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const rows = db
    ? await db.select().from(schema.menuItems).orderBy(asc(schema.menuItems.sort), asc(schema.menuItems.id))
    : DEFAULT_MENU.map((m, i) => ({ ...m, id: -1 - i, sort: i, active: true }));
  const ro = !db;

  return (
    <>
      <h1>菜單</h1>
      <p className="hint">價格留白會在店裡的紙菜單上顯示 <code>$???</code>。冰飲用高玻璃杯，熱飲用台式茶杯。沒有任何上架品項時，店裡會改用預設菜單。</p>
      {msg && <p className="note ok">{msg}</p>}

      <div className="table">
        <div className="th menu-row"><span>排序</span><span>品名</span><span>價格</span><span>冰飲</span><span>上架</span><span></span></div>
        {rows.map(r => (
          <form key={r.id} action={updateMenuItem} className={`menu-row${r.active ? '' : ' off'}`}>
            <input type="hidden" name="id" value={r.id} />
            <input name="sort" type="number" defaultValue={r.sort} aria-label="排序" disabled={ro} />
            <input name="name" defaultValue={r.name} aria-label="品名" required disabled={ro} />
            <input name="price" type="number" min={0} step={5} defaultValue={r.price ?? ''} placeholder="$???" aria-label="價格" disabled={ro} />
            <label className="check"><input type="checkbox" name="iced" defaultChecked={r.iced} disabled={ro} /><span>冰</span></label>
            <label className="check"><input type="checkbox" name="active" defaultChecked={r.active} disabled={ro} /><span>上架</span></label>
            <span className="actions">
              <button disabled={ro}>儲存</button>
              <button formAction={deleteMenuItem} className="danger" disabled={ro}>刪除</button>
            </span>
          </form>
        ))}
        {rows.length === 0 && <p className="hint">菜單是空的，店裡會用預設菜單。</p>}
      </div>

      <h2>新增品項</h2>
      <form action={addMenuItem} className="menu-row add">
        <input name="sort" type="number" defaultValue={rows.length} aria-label="排序" disabled={ro} />
        <input name="name" placeholder="品名" aria-label="品名" required disabled={ro} />
        <input name="price" type="number" min={0} step={5} placeholder="$???" aria-label="價格" disabled={ro} />
        <label className="check"><input type="checkbox" name="iced" defaultChecked disabled={ro} /><span>冰</span></label>
        <span />
        <span className="actions"><button className="primary" disabled={ro}>新增</button></span>
      </form>
    </>
  );
}
