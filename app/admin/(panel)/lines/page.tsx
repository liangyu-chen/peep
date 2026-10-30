import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { LINE_GROUPS } from '@/src/content/catalog';
import LineCategoryEditor from '../LineCategoryEditor';

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
        每個情境會隨機挑一句啟用中的台詞；沒有台詞、或台詞都取消「啟用」的情境就不會說話。
        老闆的台詞在 <Link href="/admin/owner">老闆</Link> 頁；打戰鬥陀螺固定喊「3、2、1、Go Shoot!」，不用設定。
      </p>
      {msg && <p className="note ok">{msg}</p>}
      <nav className="toc">
        {LINE_GROUPS.map(g => <a key={g.group} href={`#g-${g.group}`}>{g.group}台詞</a>)}
      </nav>

      {LINE_GROUPS.map(g => (
        <section key={g.group} id={`g-${g.group}`}>
          <h2>{g.group}台詞</h2>
          {g.items.map(cat => <LineCategoryEditor key={cat.key} cat={cat} rows={rows.filter(r => r.category === cat.key)} ro={ro} />)}
        </section>
      ))}
    </>
  );
}
