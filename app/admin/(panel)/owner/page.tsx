import { asc, eq } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { DEFAULT_OWNER, OWNER_LINES } from '@/src/content/catalog';
import { updateOwner } from '../../actions';
import LookPreview from '../LookPreview';
import LookFields from '../LookFields';
import LineCategoryEditor from '../LineCategoryEditor';

export default async function OwnerPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const [settingRows, lineRows] = db
    ? await Promise.all([
      db.select().from(schema.settings).where(eq(schema.settings.key, 'owner')),
      db.select().from(schema.dialogueLines).orderBy(asc(schema.dialogueLines.sort), asc(schema.dialogueLines.id)),
    ])
    : [[], []];
  const owner = settingRows[0]?.value ?? DEFAULT_OWNER;
  const ro = !db;

  return (
    <>
      <h1>老闆</h1>
      <p className="hint">店裡唯一的員工。名字會出現在名牌上，客人的台詞裡也可以用 <code>{'{owner}'}</code> 叫老闆。</p>
      {msg && <p className="note ok">{msg}</p>}

      <form action={updateOwner} className="editor">
        <div className="editor-preview"><LookPreview initial={owner.look} seed={owner.name} /></div>
        <div className="editor-fields">
          <section className="panel-block">
            <h2>基本資料</h2>
            <div className="grid">
              <label>名字<input name="name" defaultValue={owner.name} required maxLength={20} disabled={ro} /></label>
              <label className="wide">身分介紹<input name="job" defaultValue={owner.job} maxLength={40} disabled={ro} /></label>
            </div>
          </section>
          <LookFields look={owner.look} seed={owner.name} />
          <div className="actions sticky"><button className="primary" disabled={ro}>儲存老闆</button></div>
        </div>
      </form>

      <h2 id="lines">老闆的台詞</h2>
      <p className="hint">老闆跟客人互動時說的話；沒有台詞的情境就不說話。</p>
      {OWNER_LINES.map(cat => <LineCategoryEditor key={cat.key} cat={cat} rows={lineRows.filter(r => r.category === cat.key)} ro={ro} />)}
    </>
  );
}
