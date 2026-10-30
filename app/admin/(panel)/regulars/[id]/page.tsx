import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { FACE, HAIR_STYLES, SKIN_TONES, TEAM_NAMES, faceOf, type Look } from '@/src/content/catalog';
import { addRegular, updateRegular, deleteRegular } from '../../../actions';
import LookPreview from './LookPreview';

const toHex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const NEW_LOOK: Look = { skin: 0xe0ac80, hair: 0x1b1410, hairStyle: 'short', shirt: 0x7fae8b, pants: 0x2b2b2b, faceShape: 'round', eyes: 'round', brows: 'thin', nose: 'small', mouth: 'smile', facialHair: 'none', glasses: 'none' };

function Pick({ name, label, value, options }: { name: string; label: string; value: string; options: { value: string; label: string }[] }) {
  return (
    <fieldset className="pick">
      <legend>{label}</legend>
      {options.map(o => (
        <label key={o.value}><input type="radio" name={name} value={o.value} defaultChecked={o.value === value} /><span>{o.label}</span></label>
      ))}
    </fieldset>
  );
}

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
  const f = faceOf(look, row?.name ?? '');

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
              <label>2K 主隊
                <select name="team" defaultValue={row?.team ?? TEAM_NAMES[0]}>
                  {TEAM_NAMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>來店次數<input name="visits" type="number" min={1} defaultValue={row?.visits ?? 1} /></label>
              <label>排序<input name="sort" type="number" defaultValue={row?.sort ?? 0} /></label>
              <label className="wide">小檔案<input name="quirk" defaultValue={row?.quirk} maxLength={60} placeholder="例如：每天下班一定來打一場" /></label>
              {row && <label className="check"><input type="checkbox" name="active" defaultChecked={row.active} /><span>啟用（會來店裡）</span></label>}
            </div>
          </section>

          <section className="panel-block">
            <h2>捏臉</h2>
            <div className="colors">
              <label>膚色<input name="skin" type="color" list="skin-tones" defaultValue={toHex(look.skin)} /></label>
              <label>瞳色<input name="eyeColor" type="color" defaultValue={toHex(f.eyeColor)} /></label>
              <label className="check"><input type="checkbox" name="blush" defaultChecked={f.blush} /><span>腮紅</span></label>
            </div>
            <datalist id="skin-tones">{SKIN_TONES.map(s => <option key={s.value} value={toHex(s.value)} label={s.label} />)}</datalist>
            <Pick name="faceShape" label="臉型" value={f.faceShape} options={FACE.faceShape} />
            <Pick name="eyes" label="眼睛" value={f.eyes} options={FACE.eyes} />
            <Pick name="brows" label="眉毛" value={f.brows} options={FACE.brows} />
            <Pick name="nose" label="鼻子" value={f.nose} options={FACE.nose} />
            <Pick name="mouth" label="嘴巴" value={f.mouth} options={FACE.mouth} />
            <Pick name="facialHair" label="鬍子" value={f.facialHair} options={FACE.facialHair} />
            <Pick name="glasses" label="眼鏡" value={f.glasses} options={FACE.glasses} />
          </section>

          <section className="panel-block">
            <h2>髮型與穿著</h2>
            <Pick name="hairStyle" label="髮型" value={look.hairStyle} options={HAIR_STYLES} />
            <div className="colors">
              <label>髮色<input name="hair" type="color" defaultValue={toHex(look.hair)} /></label>
              <label>上衣<input name="shirt" type="color" defaultValue={toHex(look.shirt)} /></label>
              <label>褲子<input name="pants" type="color" defaultValue={toHex(look.pants)} /></label>
              <label>背號<input name="number" defaultValue={look.number ?? ''} maxLength={2} placeholder="無" /></label>
            </div>
          </section>

          <div className="actions sticky">
            {row && <button formAction={deleteRegular} className="danger" formNoValidate>刪除這位熟客</button>}
            <button className="primary">{isNew ? '新增' : '儲存'}</button>
          </div>
        </div>
      </form>
    </>
  );
}
