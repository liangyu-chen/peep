'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/src/lib/db';
import { checkPassword, createSession, destroySession, requireAdmin } from '@/src/lib/auth';
import { LINE_KEYS, LINE_GROUPS, POOL_KEYS, TEAM_NAMES, DEFAULT_OWNER, MENU_SECTIONS, parseLook, type Look } from '@/src/content/catalog';

// ---------------------------------------------------------------- login
export async function login(formData: FormData) {
  const ok = await checkPassword(String(formData.get('password') ?? ''));
  if (!ok) redirect('/admin/login?error=1');
  await createSession();
  redirect('/admin/menu');
}

export async function logout() {
  await destroySession();
  redirect('/admin/login');
}

// ---------------------------------------------------------------- helpers
function db() {
  const d = getDb();
  if (!d) throw new Error('DATABASE_URL is not set');
  return d;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const int = (f: FormData, k: string) => { const v = str(f, k); return v === '' ? null : Math.max(0, Math.round(Number(v))) || 0; };
const bool = (f: FormData, k: string) => f.get(k) === 'on';
const done = (path: string, msg: string) => { revalidatePath(path); revalidatePath('/'); redirect(`${path}?msg=${encodeURIComponent(msg)}`); };
const isUniqueViolation = (e: unknown) => String((e as { cause?: { code?: string } })?.cause?.code ?? (e as { code?: string })?.code) === '23505';

// ---------------------------------------------------------------- menu
// the whole menu from the editor in one go: rows in their new order; rows missing from it are deleted
type MenuPayload = { id: number | null; name: string; en: string; section: string; hot: string; ice: string; active: boolean }[];
export async function saveMenu(f: FormData) {
  await requireAdmin();
  let rows: MenuPayload;
  try { rows = JSON.parse(String(f.get('payload') ?? '[]')); } catch { done('/admin/menu', '資料格式錯誤，請重新整理再試一次'); }
  const clean = rows!.map((r, i) => ({
    id: typeof r.id === 'number' ? r.id : null,
    name: String(r.name ?? '').trim(), en: String(r.en ?? '').trim(),
    section: String(r.section ?? '').trim() || MENU_SECTIONS[0],
    hot: String(r.hot ?? '').trim().slice(0, 6), ice: String(r.ice ?? '').trim().slice(0, 6),
    active: !!r.active, sort: i,
  }));
  if (clean.some(r => !r.name)) done('/admin/menu', '有品項沒有中文名，沒有儲存');
  const names = clean.map(r => r.name);
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) done('/admin/menu', `「${dup}」重複了，沒有儲存`);
  const d = db();
  const existing = (await d.select({ id: schema.menuItems.id }).from(schema.menuItems)).map(r => r.id);
  const keep = new Set(clean.filter(r => r.id != null).map(r => r.id as number));
  const removed = existing.filter(id => !keep.has(id));
  const now = new Date();
  // names are unique, so rename everything kept to a placeholder first; then a swap or rename can't collide mid-save
  const queries = [
    ...(removed.length ? [d.delete(schema.menuItems).where(inArray(schema.menuItems.id, removed))] : []),
    ...clean.filter(r => r.id != null && existing.includes(r.id)).map(r => d.update(schema.menuItems).set({ name: `~saving~${r.id}` }).where(eq(schema.menuItems.id, r.id as number))),
    ...clean.filter(r => r.id != null && existing.includes(r.id)).map(({ id, ...r }) => d.update(schema.menuItems).set({ ...r, updatedAt: now }).where(eq(schema.menuItems.id, id as number))),
    ...clean.filter(r => r.id == null || !existing.includes(r.id)).map(({ id: _id, ...r }) => d.insert(schema.menuItems).values(r)),
  ];
  if (queries.length) await d.batch(queries as [typeof queries[number], ...typeof queries]);
  const added = clean.filter(r => r.id == null).length;
  done('/admin/menu', `菜單已儲存：${clean.length} 項${added ? `，新增 ${added}` : ''}${removed.length ? `，刪除 ${removed.length}` : ''}`);
}

// ---------------------------------------------------------------- dialogue
// the editor sends { category: [{ id, text, active }, …] } for every category on its page, in order;
// these queries make the database match: rows left out are deleted, the rest updated or added
type LinesPayload = Record<string, { id: number | null; text: string; active: boolean }[]>;
function parseLines(f: FormData): LinesPayload | null {
  const raw = f.get('lines');
  if (raw == null) return null;
  try { return JSON.parse(String(raw)); } catch { return null; }
}
async function lineQueries(payload: LinesPayload) {
  const d = db(), now = new Date();
  const cats = Object.keys(payload).filter(k => LINE_KEYS.includes(k));
  if (!cats.length) return { queries: [], count: 0 };
  const existing = await d.select({ id: schema.dialogueLines.id, category: schema.dialogueLines.category }).from(schema.dialogueLines).where(inArray(schema.dialogueLines.category, cats));
  const queries = [];
  let count = 0;
  for (const category of cats) {
    const rows = (payload[category] || []).map((r, i) => ({ id: typeof r.id === 'number' ? r.id : null, text: String(r.text ?? '').trim().slice(0, 200), active: !!r.active, sort: i })).filter(r => r.text);
    const mine = new Set(existing.filter(e => e.category === category).map(e => e.id));
    const keep = new Set(rows.filter(r => r.id != null && mine.has(r.id)).map(r => r.id as number));
    const gone = [...mine].filter(id => !keep.has(id));
    if (gone.length) queries.push(d.delete(schema.dialogueLines).where(inArray(schema.dialogueLines.id, gone)));
    for (const { id, ...r } of rows) {
      queries.push(id != null && mine.has(id)
        ? d.update(schema.dialogueLines).set({ ...r, updatedAt: now }).where(eq(schema.dialogueLines.id, id))
        : d.insert(schema.dialogueLines).values({ category, ...r }));
    }
    count += rows.length;
  }
  return { queries, count };
}
// one dialogue page's lines, all at once
export async function saveLines(f: FormData) {
  await requireAdmin();
  const back = LINE_GROUPS.map(g => `/admin/lines/${g.slug}`).find(p => p === str(f, 'back')) ?? '/admin/lines';
  const payload = parseLines(f);
  if (!payload) done(back, '資料格式錯誤，請重新整理再試一次');
  const { queries, count } = await lineQueries(payload!);
  if (queries.length) await db().batch(queries as [typeof queries[number], ...typeof queries]);
  done(back, `台詞已儲存，共 ${count} 句`);
}

// ---------------------------------------------------------------- regulars
const lookFrom = (f: FormData, prev?: Look) => parseLook(k => { const v = f.get(k); return v == null ? null : String(v); }, prev);
function regularFields(f: FormData) {
  const team = str(f, 'team');
  return {
    name: str(f, 'name'), job: str(f, 'job'), drink: str(f, 'drink'), quirk: str(f, 'quirk'),
    visits: int(f, 'visits') ?? 1, sort: int(f, 'sort') ?? 0,
    plays2k: bool(f, 'plays2k'), team: TEAM_NAMES.includes(team) ? team : '',   // '' = random each visit
    playsFight: bool(f, 'playsFight'), fighter: str(f, 'fighter'),
    playsTops: bool(f, 'playsTops'), smokes: bool(f, 'smokes'),
  };
}

export async function addRegular(f: FormData) {
  await requireAdmin();
  const fields = regularFields(f);
  if (!fields.name) done('/admin/regulars/new', '名字不能空白');
  try {
    await db().insert(schema.regulars).values({ ...fields, look: lookFrom(f) });
  } catch (e) {
    if (isUniqueViolation(e)) done('/admin/regulars/new', `「${fields.name}」已經是熟客了`);
    throw e;
  }
  done('/admin/regulars', `已新增熟客「${fields.name}」`);
}

export async function updateRegular(f: FormData) {
  await requireAdmin();
  const id = Number(f.get('id')), fields = regularFields(f);
  if (!fields.name) done(`/admin/regulars/${id}`, '名字不能空白');
  const d = db();
  const [prev] = await d.select({ look: schema.regulars.look }).from(schema.regulars).where(eq(schema.regulars.id, id));
  try {
    await d.update(schema.regulars)
      .set({ ...fields, look: lookFrom(f, prev?.look), active: bool(f, 'active'), updatedAt: new Date() })
      .where(eq(schema.regulars.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) done(`/admin/regulars/${id}`, `「${fields.name}」已經是熟客了`);
    throw e;
  }
  revalidatePath('/admin/regulars');
  done(`/admin/regulars/${id}`, `已儲存「${fields.name}」`);
}

export async function deleteRegular(f: FormData) {
  await requireAdmin();
  await db().delete(schema.regulars).where(eq(schema.regulars.id, Number(f.get('id'))));
  done('/admin/regulars', '已刪除');
}

// ---------------------------------------------------------------- first-timers' random values
// every pool at once: { pool: [{ id, value, active }, …] }; values left out are deleted
export async function saveRandomValues(f: FormData) {
  await requireAdmin();
  let payload: Record<string, { id: number | null; value: string; active: boolean }[]>;
  try { payload = JSON.parse(String(f.get('values') ?? '{}')); } catch { done('/admin/random', '資料格式錯誤，請重新整理再試一次'); }
  const d = db(), now = new Date();
  const pools = Object.keys(payload!).filter(k => (POOL_KEYS as string[]).includes(k));
  const existing = pools.length ? await d.select({ id: schema.randomValues.id, pool: schema.randomValues.pool }).from(schema.randomValues).where(inArray(schema.randomValues.pool, pools)) : [];
  const renames = [], writes = [], deletes = [];
  let count = 0;
  for (const pool of pools) {
    const rows = payload![pool].map((r, i) => ({ id: typeof r.id === 'number' ? r.id : null, value: String(r.value ?? '').trim().slice(0, 20), active: !!r.active, sort: i })).filter(r => r.value);
    const vals = rows.map(r => r.value), dup = vals.find((v, i) => vals.indexOf(v) !== i);
    if (dup) done('/admin/random', `「${dup}」重複了，沒有儲存`);
    const mine = new Set(existing.filter(e => e.pool === pool).map(e => e.id));
    const keep = new Set(rows.filter(r => r.id != null && mine.has(r.id)).map(r => r.id as number));
    const gone = [...mine].filter(id => !keep.has(id));
    if (gone.length) deletes.push(d.delete(schema.randomValues).where(inArray(schema.randomValues.id, gone)));
    for (const { id, ...r } of rows) {
      if (id != null && mine.has(id)) {
        // (pool, value) is unique: park kept values on a placeholder first, so swaps and renames can't collide mid-save
        renames.push(d.update(schema.randomValues).set({ value: `~saving~${id}` }).where(eq(schema.randomValues.id, id)));
        writes.push(d.update(schema.randomValues).set({ ...r, updatedAt: now }).where(eq(schema.randomValues.id, id)));
      } else writes.push(d.insert(schema.randomValues).values({ pool, ...r }));
    }
    count += rows.length;
  }
  const queries = [...deletes, ...renames, ...writes];
  if (queries.length) await d.batch(queries as [typeof queries[number], ...typeof queries]);
  done('/admin/random', `新客隨機值已儲存，共 ${count} 個`);
}

// ---------------------------------------------------------------- the owner
export async function updateOwner(f: FormData) {
  await requireAdmin();
  const name = str(f, 'name');
  if (!name) done('/admin/owner', '名字不能空白');
  const d = db();
  const [prev] = await d.select().from(schema.settings).where(eq(schema.settings.key, 'owner'));
  const value = { name, job: str(f, 'job'), look: lookFrom(f, (prev?.value ?? DEFAULT_OWNER).look) };
  // the owner's dialogue on the same page is saved with it, in one batch
  const lines = parseLines(f);
  const { queries } = lines ? await lineQueries(Object.fromEntries(Object.entries(lines).filter(([k]) => k.startsWith('owner.')))) : { queries: [] };
  await d.batch([
    d.insert(schema.settings).values({ key: 'owner', value }).onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } }),
    ...queries,
  ]);
  done('/admin/owner', `已儲存老闆「${name}」和老闆的台詞`);
}
