import { asc } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { DEFAULT_MENU, MENU_SECTIONS } from '@/src/content/catalog';
import { addMenuItem, updateMenuItem, deleteMenuItem } from '../../actions';

type Row = { id: number; name: string; en: string; section: string; hot: string; ice: string; sort: number; active: boolean };

function SectionSelect({ value, ro }: { value: string; ro: boolean }) {
  const options = MENU_SECTIONS.includes(value) ? MENU_SECTIONS : [...MENU_SECTIONS, value];
  return <select name="section" defaultValue={value} aria-label="分類" disabled={ro}>{options.map(s => <option key={s} value={s}>{s}</option>)}</select>;
}

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const rows: Row[] = db
    ? await db.select().from(schema.menuItems).orderBy(asc(schema.menuItems.sort), asc(schema.menuItems.id))
    : DEFAULT_MENU.map((m, i) => ({ ...m, id: -1 - i, sort: i, active: true }));
  const ro = !db;

  return (
    <>
      <h1>菜單</h1>
      <p className="hint">
        跟店裡的紙菜單一樣：分類、中文名、英文名，熱和冰各一欄。價格欄寫什麼就印什麼（例如 <code>120</code>、<code>∞</code>、<code>???</code>），
        留白代表沒有這個做法。兩欄都有的飲料，客人會點冰或熱；冰飲用高玻璃杯，熱飲用台式茶杯。沒有任何上架品項時，店裡會改用預設菜單。
      </p>
      {msg && <p className="note ok">{msg}</p>}

      <div className="table">
        <div className="th menu-row"><span>排序</span><span>分類</span><span>中文名</span><span>英文名</span><span>熱</span><span>冰</span><span>上架</span><span></span></div>
        {rows.map(r => (
          <form key={r.id} action={updateMenuItem} className={`menu-row${r.active ? '' : ' off'}`}>
            <input type="hidden" name="id" value={r.id} />
            <input name="sort" type="number" defaultValue={r.sort} aria-label="排序" disabled={ro} />
            <SectionSelect value={r.section} ro={ro} />
            <input name="name" defaultValue={r.name} aria-label="中文名" required disabled={ro} />
            <input name="en" defaultValue={r.en} aria-label="英文名" disabled={ro} />
            <input name="hot" defaultValue={r.hot} aria-label="熱的價格" placeholder="—" maxLength={6} disabled={ro} />
            <input name="ice" defaultValue={r.ice} aria-label="冰的價格" placeholder="—" maxLength={6} disabled={ro} />
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
        <SectionSelect value={MENU_SECTIONS[1]} ro={ro} />
        <input name="name" placeholder="中文名" aria-label="中文名" required disabled={ro} />
        <input name="en" placeholder="English" aria-label="英文名" disabled={ro} />
        <input name="hot" placeholder="熱" aria-label="熱的價格" maxLength={6} disabled={ro} />
        <input name="ice" placeholder="冰" aria-label="冰的價格" maxLength={6} disabled={ro} />
        <span />
        <span className="actions"><button className="primary" disabled={ro}>新增</button></span>
      </form>
    </>
  );
}
