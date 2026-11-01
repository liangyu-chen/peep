import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from './db';
import {
  DEFAULT_CONTENT, DEFAULT_MENU, DEFAULT_OWNER, DEFAULT_POOLS, DEFAULT_REGULARS, LINE_KEYS, POOL_KEYS,
  type CafeContent, type RandomPools,
} from '../content/catalog';

// What the café shows, read from Neon.
// - no database, or it can't be reached: the built-in defaults
// - dialogue: only what's in the database; a category with no active lines stays silent
// - no active menu items: the default menu (a café with nothing to sell would break the simulation)
// - no regulars at all: the default regulars; all switched off: only first-timers come in
// - a random-value pool with nothing active: its defaults (every first-timer needs a name and a job)
// - no owner saved yet: the default owner
export async function getContent(): Promise<CafeContent & { source: 'db' | 'defaults' }> {
  const db = getDb();
  if (!db) return { ...DEFAULT_CONTENT, source: 'defaults' };
  try {
    // tables added after the first deploy fall back on their own, so a database that hasn't had `db:push` yet still serves the rest
    const optional = <T,>(q: Promise<T[]>, what: string) => q.catch(err => { console.error(`getContent: ${what} unavailable, using defaults`, err); return null; });
    const [menuRows, lineRows, regularRows, valueRows, ownerRows] = await Promise.all([
      db.select().from(schema.menuItems).orderBy(asc(schema.menuItems.sort), asc(schema.menuItems.id)),
      db.select().from(schema.dialogueLines).orderBy(asc(schema.dialogueLines.sort), asc(schema.dialogueLines.id)),
      optional(db.select().from(schema.regulars).orderBy(asc(schema.regulars.sort), asc(schema.regulars.id)), 'regulars'),
      optional(db.select().from(schema.randomValues).orderBy(asc(schema.randomValues.sort), asc(schema.randomValues.id)), 'random_values'),
      optional(db.select().from(schema.settings).where(eq(schema.settings.key, 'owner')), 'settings'),
    ]);
    const menu = menuRows.filter(r => r.active && (r.hot || r.ice)).map(({ name, en, section, hot, ice }) => ({ name, en, section, hot, ice }));
    const lines: Record<string, string[]> = {};
    for (const key of LINE_KEYS) {
      lines[key] = lineRows.filter(r => r.category === key && r.active).map(r => r.text);
    }
    const regulars = regularRows?.length
      ? regularRows.filter(r => r.active).map(({ name, job, drink, team, visits, quirk, look, plays2k, playsFight, fighter, playsTops, smokes }) =>
        ({ name, job, drink, team, visits, quirk, look, plays2k, playsFight, fighter, playsTops, smokes }))
      : DEFAULT_REGULARS;
    const pools = {} as RandomPools;
    for (const key of POOL_KEYS) {
      const values = (valueRows ?? []).filter(r => r.pool === key && r.active).map(r => r.value);
      pools[key] = values.length ? values : DEFAULT_POOLS[key];
    }
    const owner = ownerRows?.[0]?.value ?? DEFAULT_OWNER;
    return { menu: menu.length ? menu : DEFAULT_MENU, lines, owner, regulars, pools, source: 'db' };
  } catch (err) {
    console.error('getContent: falling back to defaults', err);
    return { ...DEFAULT_CONTENT, source: 'defaults' };
  }
}
