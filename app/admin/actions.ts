'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/src/lib/db';
import { checkPassword, createSession, destroySession, requireAdmin } from '@/src/lib/auth';
import { LINE_KEYS, POOL_KEYS, TEAM_NAMES, DEFAULT_OWNER, MENU_SECTIONS, linesPageFor, parseLook, type Look } from '@/src/content/catalog';

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
function checkCategory(category: string) {
  if (!LINE_KEYS.includes(category)) throw new Error(`unknown category ${category}`);
}
// back to the page the category is edited on
function doneLines(category: string, msg: string) {
  const page = linesPageFor(category);
  revalidatePath(page); revalidatePath('/');
  redirect(`${page}?msg=${encodeURIComponent(msg)}#${category}`);
}

export async function addLine(f: FormData) {
  await requireAdmin();
  const category = str(f, 'category'), text = str(f, 'text');
  checkCategory(category);
  if (!text) doneLines(category, '台詞不能空白');
  const d = db();
  const count = (await d.select({ id: schema.dialogueLines.id }).from(schema.dialogueLines).where(eq(schema.dialogueLines.category, category))).length;
  await d.insert(schema.dialogueLines).values({ category, text, sort: count });
  doneLines(category, '已新增台詞');
}

export async function updateLine(f: FormData) {
  await requireAdmin();
  const id = Number(f.get('id')), category = str(f, 'category'), text = str(f, 'text');
  checkCategory(category);
  if (!text) doneLines(category, '台詞不能空白');
  await db().update(schema.dialogueLines).set({ text, active: bool(f, 'active'), updatedAt: new Date() }).where(eq(schema.dialogueLines.id, id));
  doneLines(category, '已儲存');
}

export async function deleteLine(f: FormData) {
  await requireAdmin();
  const category = str(f, 'category');
  checkCategory(category);
  await db().delete(schema.dialogueLines).where(eq(schema.dialogueLines.id, Number(f.get('id'))));
  doneLines(category, '已刪除');
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
function checkPool(pool: string) {
  if (!(POOL_KEYS as string[]).includes(pool)) throw new Error(`unknown pool ${pool}`);
}
function donePool(pool: string, msg: string) {
  revalidatePath('/admin/random'); revalidatePath('/');
  redirect(`/admin/random?msg=${encodeURIComponent(msg)}#${pool}`);
}

export async function addValue(f: FormData) {
  await requireAdmin();
  const pool = str(f, 'pool'), value = str(f, 'value');
  checkPool(pool);
  if (!value) donePool(pool, '內容不能空白');
  const d = db();
  const count = (await d.select({ id: schema.randomValues.id }).from(schema.randomValues).where(eq(schema.randomValues.pool, pool))).length;
  try {
    await d.insert(schema.randomValues).values({ pool, value, sort: count });
  } catch (e) {
    if (isUniqueViolation(e)) donePool(pool, `「${value}」已經在清單裡`);
    throw e;
  }
  donePool(pool, `已新增「${value}」`);
}

export async function updateValue(f: FormData) {
  await requireAdmin();
  const id = Number(f.get('id')), pool = str(f, 'pool'), value = str(f, 'value');
  checkPool(pool);
  if (!value) donePool(pool, '內容不能空白');
  try {
    await db().update(schema.randomValues).set({ value, active: bool(f, 'active'), updatedAt: new Date() }).where(eq(schema.randomValues.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) donePool(pool, `「${value}」已經在清單裡`);
    throw e;
  }
  donePool(pool, `已儲存「${value}」`);
}

export async function deleteValue(f: FormData) {
  await requireAdmin();
  const pool = str(f, 'pool');
  checkPool(pool);
  await db().delete(schema.randomValues).where(eq(schema.randomValues.id, Number(f.get('id'))));
  donePool(pool, '已刪除');
}

// ---------------------------------------------------------------- the owner
export async function updateOwner(f: FormData) {
  await requireAdmin();
  const name = str(f, 'name');
  if (!name) done('/admin/owner', '名字不能空白');
  const d = db();
  const [prev] = await d.select().from(schema.settings).where(eq(schema.settings.key, 'owner'));
  const value = { name, job: str(f, 'job'), look: lookFrom(f, (prev?.value ?? DEFAULT_OWNER).look) };
  await d.insert(schema.settings).values({ key: 'owner', value }).onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
  done('/admin/owner', `已儲存老闆「${name}」`);
}
