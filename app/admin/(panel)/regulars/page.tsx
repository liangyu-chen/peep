import { asc } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { DEFAULT_MENU, DEFAULT_REGULARS, HAIR_STYLES, SKIN_TONES, TEAM_NAMES, type Look } from '@/src/content/catalog';
import { addRegular, updateRegular, deleteRegular } from '../../actions';

const toHex = (n: number) => '#' + n.toString(16).padStart(6, '0');
type Row = { id: number; name: string; job: string; drink: string; team: string; visits: number; quirk: string; look: Look; sort: number; active: boolean };

// every field of one regular; used for the existing ones and for the "add" form
function Fields({ r, drinks, ro }: { r?: Row; drinks: string[]; ro: boolean }) {
  const look = r?.look;
  const drinkOptions = r?.drink && !drinks.includes(r.drink) ? [...drinks, r.drink] : drinks;
  return (
    <>
      <div className="grid">
        <label>名字<input name="name" defaultValue={r?.name} required maxLength={20} disabled={ro} /></label>
        <label>職業<input name="job" defaultValue={r?.job} maxLength={30} disabled={ro} /></label>
        <label>常點
          <select name="drink" defaultValue={r?.drink ?? drinks[0]} disabled={ro}>
            {drinkOptions.map(d => <option key={d} value={d}>{drinks.includes(d) ? d : `${d}（已不在菜單上）`}</option>)}
          </select>
        </label>
        <label>2K 主隊
          <select name="team" defaultValue={r?.team ?? TEAM_NAMES[0]} disabled={ro}>
            {TEAM_NAMES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>來店次數<input name="visits" type="number" min={1} defaultValue={r?.visits ?? 1} disabled={ro} /></label>
        <label>排序<input name="sort" type="number" defaultValue={r?.sort ?? 0} disabled={ro} /></label>
        <label className="wide">小檔案<input name="quirk" defaultValue={r?.quirk} maxLength={60} placeholder="例如：每天下班一定來打一場" disabled={ro} /></label>
      </div>
      <div className="grid look">
        <label>膚色
          <select name="skin" defaultValue={String(look?.skin ?? SKIN_TONES[2].value)} disabled={ro}>
            {SKIN_TONES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            {look && !SKIN_TONES.some(s => s.value === look.skin) && <option value={look.skin}>自訂</option>}
          </select>
        </label>
        <label>髮型
          <select name="hairStyle" defaultValue={look?.hairStyle ?? 'short'} disabled={ro}>
            {HAIR_STYLES.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </label>
        <label>髮色<input name="hair" type="color" defaultValue={toHex(look?.hair ?? 0x111111)} disabled={ro} /></label>
        <label>上衣<input name="shirt" type="color" defaultValue={toHex(look?.shirt ?? 0x7fae8b)} disabled={ro} /></label>
        <label>褲子<input name="pants" type="color" defaultValue={toHex(look?.pants ?? 0x2b2b2b)} disabled={ro} /></label>
        <label>背號<input name="number" defaultValue={look?.number ?? ''} maxLength={2} placeholder="無" disabled={ro} /></label>
        <label className="check"><input type="checkbox" name="glasses" defaultChecked={!!look?.glasses} disabled={ro} /><span>戴眼鏡</span></label>
      </div>
    </>
  );
}

export default async function RegularsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const rows: Row[] = db
    ? await db.select().from(schema.regulars).orderBy(asc(schema.regulars.sort), asc(schema.regulars.id))
    : DEFAULT_REGULARS.map((r, i) => ({ ...r, id: -1 - i, sort: i, active: true }));
  const menu = db ? await db.select({ name: schema.menuItems.name, active: schema.menuItems.active }).from(schema.menuItems).orderBy(asc(schema.menuItems.sort)) : DEFAULT_MENU.map(m => ({ ...m, active: true }));
  const drinks = menu.filter(m => m.active).map(m => m.name);
  const ro = !db;

  return (
    <>
      <h1>熟客</h1>
      <p className="hint">
        店裡大約四分之三的客人是熟客，熟客會點自己的常點、用自己的主隊打 2K。常點被下架的話，那天會改點別的。
        取消「啟用」的熟客不會再來店裡；第一次來的新客是隨機產生的，到「新客隨機值」維護。
      </p>
      {msg && <p className="note ok">{msg}</p>}

      {rows.map(r => (
        <form key={r.id} action={updateRegular} className={`regular${r.active ? '' : ' off'}`}>
          <input type="hidden" name="id" value={r.id} />
          <header>
            <span className="swatch" style={{ background: toHex(r.look.shirt) }} aria-hidden />
            <h3>{r.name}</h3>
            <span className="muted">{r.job}</span>
            <label className="check push"><input type="checkbox" name="active" defaultChecked={r.active} disabled={ro} /><span>啟用</span></label>
          </header>
          <Fields r={r} drinks={drinks} ro={ro} />
          <span className="actions">
            <button disabled={ro}>儲存</button>
            <button formAction={deleteRegular} className="danger" disabled={ro}>刪除</button>
          </span>
        </form>
      ))}

      <h2>新增熟客</h2>
      <form action={addRegular} className="regular add">
        <Fields drinks={drinks} ro={ro} />
        <span className="actions"><button className="primary" disabled={ro}>新增</button></span>
      </form>
    </>
  );
}
