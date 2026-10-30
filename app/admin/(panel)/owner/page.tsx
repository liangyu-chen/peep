import { asc, like, eq } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { DEFAULT_OWNER, OWNER_LINES } from '@/src/content/catalog';
import { updateOwner } from '../../actions';
import LookPreview from '../LookPreview';
import LookFields from '../LookFields';
import LinesEditor from '../LinesEditor';
import SaveBar from '../SaveBar';

export default async function OwnerPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const [settingRows, lineRows] = db
    ? await Promise.all([
      db.select().from(schema.settings).where(eq(schema.settings.key, 'owner')),
      db.select().from(schema.dialogueLines).where(like(schema.dialogueLines.category, 'owner.%')).orderBy(asc(schema.dialogueLines.sort), asc(schema.dialogueLines.id)),
    ])
    : [[], []];
  const owner = settingRows[0]?.value ?? DEFAULT_OWNER;
  const ro = !db;
  const categories = OWNER_LINES.map(c => ({ ...c, rows: lineRows.filter(r => r.category === c.key).map(({ id, text, active }) => ({ id, text, active })) }));

  return (
    <>
      <h1>老闆</h1>
      <p className="hint">店裡唯一的員工。名字會出現在名牌上，客人的台詞裡也可以用 <code>{'{owner}'}</code> 叫老闆。資料、長相和台詞改完按最下面「儲存」一次存好。</p>
      {msg && <p className="note ok">{msg}</p>}

      <form action={updateOwner} key={Date.now()}>
        <div className="editor">
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
          </div>
        </div>

        <h2 id="lines">老闆的台詞</h2>
        <p className="hint">老闆跟客人互動時說的話；沒有台詞的情境就不說話。</p>
        <LinesEditor categories={categories} readOnly={ro} />
        <SaveBar label="儲存" readOnly={ro} />
      </form>
    </>
  );
}
