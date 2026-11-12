import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { FIGHTER_NAMES, SEAT_PREFS, TEAM_NAMES, LOOK2, type Look } from '@/src/content/catalog';
import { addRegular, updateRegular, deleteRegular } from '../../../actions';
import LookPreview from '../../LookPreview';
import LookFields from '../../LookFields';
import SaveBar from '../../SaveBar';
import ConfirmButton from '../../ConfirmButton';
import DrinkField from './DrinkField';

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
  const look = row?.look ?? NEW_LOOK;
  const look2 = row?.look2 ?? look;   // (none yet: starts as a copy of the first)

  return (
    <>
      <p className="crumbs"><Link href="/admin/regulars">← 熟客</Link></p>
      <h1>{isNew ? '新增熟客' : row!.name}</h1>
      {msg && <p className="note ok">{msg}</p>}

      <form action={isNew ? addRegular : updateRegular} className="editor">
        {row && <input type="hidden" name="id" value={row.id} />}
        <div className="editor-preview"><LookPreview initial={look} second={look2} seed={row?.name ?? ''} /></div>

        <div className="editor-fields">
          <section className="panel-block">
            <h2>基本資料</h2>
            <div className="grid">
              <label>名字<input name="name" defaultValue={row?.name} required maxLength={20} /></label>
              <label>職業<input name="job" defaultValue={row?.job} maxLength={30} /></label>
              {/* pick from the menu, or type anything: the owner makes regulars their usual even when it isn't on the menu */}
              <label>常點
                <DrinkField drinks={drinks} initial={row?.drink ?? drinks[0] ?? ''} />
              </label>
              <label>來店次數<input name="visits" type="number" min={1} defaultValue={row?.visits ?? 1} /></label>
              <label>排序<input name="sort" type="number" defaultValue={row?.sort ?? 0} /></label>
              <label>座位偏好
                <select name="seatPref" defaultValue={row?.seatPref ?? ''}>
                  {SEAT_PREFS.map(o => <option key={o.value || 'any'} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="wide">小檔案<input name="quirk" defaultValue={row?.quirk} maxLength={60} placeholder="例如：每天下班一定來打一場" /></label>
              <label className="check"><input type="checkbox" name="smokes" defaultChecked={row?.smokes ?? false} /><span>會抽菸</span></label>
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

          <div className="look-set look-set-1"><LookFields look={look} seed={row?.name ?? ''} /></div>
          {/* 第二套捏臉: shown in place of the first when the preview's 第二套 is picked */}
          <div className="look-set look-set-2">
            <p className="note ok look-set-note">正在編輯<b>第二套捏臉</b>：熟客每次來店隨機用其中一套。按預覽下方的「第一套」切回去。</p>
            <LookFields look={look2} seed={row?.name ?? ''} prefix={LOOK2} />
          </div>

          <SaveBar label={isNew ? '新增熟客' : '儲存'}>
            {row && <ConfirmButton formAction={deleteRegular} className="danger" formNoValidate
              title="刪除熟客" message={`刪除「${row.name}」？這位熟客會從店裡消失，無法復原。`}
              confirmLabel="刪除這位熟客">刪除這位熟客</ConfirmButton>}
          </SaveBar>
        </div>
      </form>
    </>
  );
}
