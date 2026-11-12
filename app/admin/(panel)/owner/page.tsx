import { asc, like, eq } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { DEFAULT_OWNER, OWNER_LINES, LOOK2 } from '@/src/content/catalog';
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
  const look2 = owner.look2 ?? owner.look;   // (none yet: starts as a copy of the first)
  const ro = !db;
  const categories = OWNER_LINES.map(c => ({ ...c, rows: lineRows.filter(r => r.category === c.key).map(({ id, text, active }) => ({ id, text, active })) }));

  return (
    <>
      <h1>老闆</h1>
      <p className="hint">客人的台詞裡也可以用 <code>{'{owner}'}</code> 叫老闆。資料、長相和台詞改完後按最下面「儲存」。</p>
      {msg && <p className="note ok">{msg}</p>}

      <form action={updateOwner} key={Date.now()}>
        <div className="editor">
          <div className="editor-preview"><LookPreview initial={owner.look} second={look2} seed={owner.name} /></div>
          <div className="editor-fields">
            <section className="panel-block">
              <h2>基本資料</h2>
              <div className="grid">
                <label>名字<input name="name" defaultValue={owner.name} required maxLength={20} disabled={ro} /></label>
                <label className="wide">身分介紹<input name="job" defaultValue={owner.job} maxLength={40} disabled={ro} /></label>
              </div>
            </section>
            <div className="look-set look-set-1"><LookFields look={owner.look} seed={owner.name} /></div>
            {/* 第二套捏臉: shown in place of the first when the preview's 第二套 is picked */}
            <div className="look-set look-set-2">
              <p className="note ok look-set-note">正在編輯<b>第二套捏臉</b>：每次開店老闆隨機穿其中一套。按預覽下方的「第一套」切回去。</p>
              <LookFields look={look2} seed={owner.name} prefix={LOOK2} />
            </div>
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
