'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/src/lib/db';
import { checkPassword, createSession, destroySession, requireAdmin } from '@/src/lib/auth';
import { LINE_KEYS, DEFAULT_LINES, POOL_KEYS, TEAM_NAMES, parseLook, type Look } from '@/src/content/catalog';

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
export async function addMenuItem(f: FormData) {
  await requireAdmin();
  const name = str(f, 'name');
  if (!name) done('/admin/menu', '品名不能空白');
  try {
    await db().insert(schema.menuItems).values({ name, price: int(f, 'price'), iced: bool(f, 'iced'), sort: int(f, 'sort') ?? 0 });
  } catch (e) {
    if (isUniqueViolation(e)) done('/admin/menu', `「${name}」已經在菜單上`);
    throw e;
  }
  done('/admin/menu', `已新增「${name}」`);
}

export async function updateMenuItem(f: FormData) {
  await requireAdmin();
  const id = Number(f.get('id')), name = str(f, 'name');
  if (!name) done('/admin/menu', '品名不能空白');
  try {
    await db().update(schema.menuItems)
      .set({ name, price: int(f, 'price'), iced: bool(f, 'iced'), active: bool(f, 'active'), sort: int(f, 'sort') ?? 0, updatedAt: new Date() })
      .where(eq(schema.menuItems.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) done('/admin/menu', `「${name}」已經在菜單上`);
    throw e;
  }
  done('/admin/menu', `已儲存「${name}」`);
}

export async function deleteMenuItem(f: FormData) {
  await requireAdmin();
  await db().delete(schema.menuItems).where(eq(schema.menuItems.id, Number(f.get('id'))));
  done('/admin/menu', '已刪除');
}

// ---------------------------------------------------------------- dialogue
function checkCategory(category: string) {
  if (!LINE_KEYS.includes(category)) throw new Error(`unknown category ${category}`);
}
// a category with no rows runs on its built-in lines; write them out first so they can be edited
// (and so adding one line doesn't silently replace the rest). Returns how many rows the category has.
async function writeOutDefaults(category: string) {
  const d = db();
  const existing = await d.select({ id: schema.dialogueLines.id }).from(schema.dialogueLines).where(eq(schema.dialogueLines.category, category));
  if (existing.length) return existing.length;
  const defaults = DEFAULT_LINES[category] ?? [];
  if (defaults.length) await d.insert(schema.dialogueLines).values(defaults.map((t, i) => ({ category, text: t, sort: i })));
  return defaults.length;
}
function doneLines(category: string, msg: string) {
  revalidatePath('/admin/lines'); revalidatePath('/');
  redirect(`/admin/lines?msg=${encodeURIComponent(msg)}#${category}`);
}

export async function addLine(f: FormData) {
  await requireAdmin();
  const category = str(f, 'category'), text = str(f, 'text');
  checkCategory(category);
  if (!text) doneLines(category, '台詞不能空白');
  const count = await writeOutDefaults(category);
  await db().insert(schema.dialogueLines).values({ category, text, sort: count });
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

// copies a category's built-in lines into the database so they can be edited one by one
export async function importDefaults(f: FormData) {
  await requireAdmin();
  const category = str(f, 'category');
  checkCategory(category);
  await writeOutDefaults(category);
  doneLines(category, '已匯入預設台詞，可以逐句修改');
}

// ---------------------------------------------------------------- regulars
const lookFrom = (f: FormData, prev?: Look) => parseLook(k => { const v = f.get(k); return v == null ? null : String(v); }, prev);
function regularFields(f: FormData) {
  const team = str(f, 'team');
  return {
    name: str(f, 'name'), job: str(f, 'job'), drink: str(f, 'drink'), quirk: str(f, 'quirk'),
    team: TEAM_NAMES.includes(team) ? team : TEAM_NAMES[0],
    visits: int(f, 'visits') ?? 1, sort: int(f, 'sort') ?? 0,
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
