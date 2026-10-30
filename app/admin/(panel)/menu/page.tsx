import { asc } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { DEFAULT_MENU, MENU_SECTIONS } from '@/src/content/catalog';
import MenuEditor, { type MenuRow } from './MenuEditor';

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const rows: MenuRow[] = db
    ? (await db.select().from(schema.menuItems).orderBy(asc(schema.menuItems.sort), asc(schema.menuItems.id)))
      .map(({ id, name, en, section, hot, ice, active }) => ({ id, name, en, section, hot, ice, active }))
    : DEFAULT_MENU.map(m => ({ ...m, id: null, active: true }));

  return (
    <>
      <h1>菜單</h1>
      <p className="hint">
        直接在表格裡改，改完按下方「儲存菜單」一次存好。價格欄寫什麼就印什麼（例如 <code>120</code>、<code>∞</code>、<code>???</code>），留白代表沒有這個做法；
        兩欄都有的飲料，客人會點冰或熱。用 ▲▼ 調整順序，就是紙菜單上的順序。
      </p>
      {msg && <p className="note ok">{msg}</p>}
      {/* a fresh key each render, so the editor starts from what was just saved */}
      <MenuEditor key={Date.now()} initial={rows} sections={MENU_SECTIONS} readOnly={!db} />
    </>
  );
}
