import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { FIGHTER_NAMES, TEAM_NAMES, type Look } from '@/src/content/catalog';
import { addRegular, updateRegular, deleteRegular } from '../../../actions';
import LookPreview from '../../LookPreview';
import LookFields from '../../LookFields';

const NEW_LOOK: Look = { skin: 0xe0ac80, hair: 0x1b1410, hairStyle: 'short', shirt: 0x7fae8b, pants: 0x2b2b2b, faceShape: 'round', eyes: 'round', brows: 'thin', nose: 'small', mouth: 'smile', facialHair: 'none', glasses: 'none' };

export default async function RegularEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const [{ id }, { msg }] = await Promise.all([params, searchParams]);
  const db = getDb();
  if (!db) notFound();
  const isNew = id === 'new';
  const row = isNew ? null : (await db.select().from(schema.regulars).where(eq(schema.regulars.id, Number(id))))[0];
  if (!isNew && !row) notFound();
  const menu = await db.select({ name: schema.menuItems.name, active: schema.menuItems.active }).from(schema.menuItems).orderBy(asc(schema.menuItems.sort));
  const drinks = menu.filter(m => m.active).map(m => m.name);
  const drinkOptions = row?.drink && !drinks.includes(row.drink) ? [...drinks, row.drink] : drinks;
  const look = row?.look ?? NEW_LOOK;

  return (
    <>
      <p className="crumbs"><Link href="/admin/regulars">← 熟客</Link></p>
      <h1>{isNew ? '新增熟客' : row!.name}</h1>
      {msg && <p className="note ok">{msg}</p>}

      <form action={isNew ? addRegular : updateRegular} className="editor">
        {row && <input type="hidden" name="id" value={row.id} />}
        <div className="editor-preview"><LookPreview initial={look} seed={row?.name ?? ''} /></div>

        <div className="editor-fields">
          <section className="panel-block">
            <h2>基本資料</h2>
            <div className="grid">
              <label>名字<input name="name" defaultValue={row?.name} required maxLength={20} /></label>
              <label>職業<input name="job" defaultValue={row?.job} maxLength={30} /></label>
              <label>常點
                <select name="drink" defaultValue={row?.drink ?? drinks[0]}>
                  {drinkOptions.map(d => <option key={d} value={d}>{drinks.includes(d) ? d : `${d}（已不在菜單上）`}</option>)}
                </select>
              </label>
              <label>來店次數<input name="visits" type="number" min={1} defaultValue={row?.visits ?? 1} /></label>
              <label>排序<input name="sort" type="number" defaultValue={row?.sort ?? 0} /></label>
              <label className="wide">小檔案<input name="quirk" defaultValue={row?.quirk} maxLength={60} placeholder="例如：每天下班一定來打一場" /></label>
              <label className="check"><input type="checkbox" name="smokes" defaultChecked={row?.smokes ?? false} /><span>會抽菸（喜歡坐戶外區）</span></label>
              {row && <label className="check"><input type="checkbox" name="active" defaultChecked={row.active} /><span>啟用（會來店裡）</span></label>}
            </div>
          </section>

          <section className="panel-block">
            <h2>遊戲</h2>
            <p className="hint">會打電動的熟客才會去電視前；不是每次來都會打。沒指定球隊或角色的話，每次來隨機挑。</p>
            <div className="game-row">
              <label className="check"><input type="checkbox" name="plays2k" defaultChecked={row?.plays2k ?? false} /><span>會打 NBA 2K</span></label>
              <label>常用球隊
                <select name="team" defaultValue={row?.team ?? ''}>
                  <option value="">隨機</option>
                  {TEAM_NAMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
            <div className="game-row">
              <label className="check"><input type="checkbox" name="playsFight" defaultChecked={row?.playsFight ?? false} /><span>會打快打旋風</span></label>
              <label>常用角色
                <select name="fighter" defaultValue={row?.fighter ?? ''}>
                  <option value="">隨機</option>
                  {FIGHTER_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <div className="game-row">
              <label className="check"><input type="checkbox" name="playsTops" defaultChecked={row?.playsTops ?? false} /><span>會玩戰鬥陀螺</span></label>
              <span className="hint">店裡同時有兩位會玩的熟客坐著時，偶爾會去後面搬戰鬥盤到戶外區開打。</span>
            </div>
          </section>

          <LookFields look={look} seed={row?.name ?? ''} />

          <div className="actions sticky">
            {row && <button formAction={deleteRegular} className="danger" formNoValidate>刪除這位熟客</button>}
            <button className="primary">{isNew ? '新增' : '儲存'}</button>
          </div>
        </div>
      </form>
    </>
  );
}
