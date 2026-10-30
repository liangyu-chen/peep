import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, like } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { LINE_GROUPS } from '@/src/content/catalog';
import { saveLines } from '../../../actions';
import LinesEditor from '../../LinesEditor';
import SaveBar from '../../SaveBar';

const HINTS: Record<string, React.ReactNode> = {
  customer: <>熟客和新客進門、點餐、閒聊、抽菸、離開時說的話。老闆的台詞在 <Link href="/admin/owner">老闆</Link> 頁。</>,
  '2k': <>在電視前打 NBA 2K 時說的話。</>,
  fight: <>在電視前打快打旋風時說的話。打戰鬥陀螺固定喊「3、2、1、Go Shoot!」，不用設定。</>,
};

export default async function LineGroupPage({ params, searchParams }: { params: Promise<{ group: string }>; searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const [{ group }, { msg }] = await Promise.all([params, searchParams]);
  const g = LINE_GROUPS.find(x => x.slug === group);
  if (!g) notFound();
  const db = getDb();
  const prefix = g.items[0].key.split('.')[0];
  const rows = db ? await db.select().from(schema.dialogueLines).where(like(schema.dialogueLines.category, `${prefix}.%`)).orderBy(asc(schema.dialogueLines.sort), asc(schema.dialogueLines.id)) : [];
  const categories = g.items.map(c => ({ ...c, rows: rows.filter(r => r.category === c.key).map(({ id, text, active }) => ({ id, text, active })) }));

  return (
    <>
      <h1>{g.group}台詞</h1>
      <p className="hint">{HINTS[g.slug]} 每個情境會隨機挑一句啟用中的台詞；沒有台詞、或都取消「啟用」的情境就不會說話。改完按最下面「儲存台詞」一次存好。</p>
      {msg && <p className="note ok">{msg}</p>}
      <form action={saveLines}>
        <input type="hidden" name="back" value={`/admin/lines/${g.slug}`} />
        {/* a fresh key each render, so the editor starts from what was just saved */}
        <LinesEditor key={Date.now()} categories={categories} readOnly={!db} />
        <SaveBar label="儲存台詞" readOnly={!db} />
      </form>
    </>
  );
}
