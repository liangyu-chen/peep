import { asc } from 'drizzle-orm';
import { getDb, schema } from './db';
import {
  DEFAULT_CONTENT, DEFAULT_LINES, DEFAULT_MENU, DEFAULT_POOLS, DEFAULT_REGULARS, LINE_KEYS, POOL_KEYS,
  type CafeContent, type RandomPools,
} from '../content/catalog';

// What the café shows, read from Neon.
// - no database, or it can't be reached: the built-in defaults
// - a dialogue category with no rows at all: its default lines (so new categories work before anyone edits them)
// - a dialogue category whose rows are all switched off: silence
// - no active menu items: the default menu (a café with nothing to sell would break the simulation)
// - no regulars at all: the default regulars; all switched off: only first-timers come in
// - a random-value pool with nothing active: its defaults (every first-timer needs a name and a job)
export async function getContent(): Promise<CafeContent & { source: 'db' | 'defaults' }> {
  const db = getDb();
  if (!db) return { ...DEFAULT_CONTENT, source: 'defaults' };
  try {
    // tables added after the first deploy fall back on their own, so a database that hasn't had `db:push` yet still serves the rest
    const optional = <T,>(q: Promise<T[]>, what: string) => q.catch(err => { console.error(`getContent: ${what} unavailable, using defaults`, err); return null; });
    const [menuRows, lineRows, regularRows, valueRows] = await Promise.all([
      db.select().from(schema.menuItems).orderBy(asc(schema.menuItems.sort), asc(schema.menuItems.id)),
      db.select().from(schema.dialogueLines).orderBy(asc(schema.dialogueLines.sort), asc(schema.dialogueLines.id)),
      optional(db.select().from(schema.regulars).orderBy(asc(schema.regulars.sort), asc(schema.regulars.id)), 'regulars'),
      optional(db.select().from(schema.randomValues).orderBy(asc(schema.randomValues.sort), asc(schema.randomValues.id)), 'random_values'),
    ]);
    const menu = menuRows.filter(r => r.active).map(r => ({ name: r.name, price: r.price, iced: r.iced }));
    const lines: Record<string, string[]> = {};
    for (const key of LINE_KEYS) {
      const rows = lineRows.filter(r => r.category === key);
      lines[key] = rows.length ? rows.filter(r => r.active).map(r => r.text) : DEFAULT_LINES[key];
    }
    const regulars = regularRows?.length
      ? regularRows.filter(r => r.active).map(({ name, job, drink, team, visits, quirk, look }) => ({ name, job, drink, team, visits, quirk, look }))
      : DEFAULT_REGULARS;
    const pools = {} as RandomPools;
    for (const key of POOL_KEYS) {
      const values = (valueRows ?? []).filter(r => r.pool === key && r.active).map(r => r.value);
      pools[key] = values.length ? values : DEFAULT_POOLS[key];
    }
    return { menu: menu.length ? menu : DEFAULT_MENU, lines, regulars, pools, source: 'db' };
  } catch (err) {
    console.error('getContent: falling back to defaults', err);
    return { ...DEFAULT_CONTENT, source: 'defaults' };
  }
}
