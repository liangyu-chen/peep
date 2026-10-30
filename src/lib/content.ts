import { asc } from 'drizzle-orm';
import { getDb, schema } from './db';
import { DEFAULT_CONTENT, DEFAULT_LINES, DEFAULT_MENU, DEFAULT_NAMES, LINE_KEYS, type CafeContent, type Gender } from '../content/catalog';

// What the café shows, read from Neon.
// - no database, or it can't be reached: the built-in defaults
// - a category with no rows at all: its default lines (so new categories work before anyone edits them)
// - a category whose rows are all switched off: silence
// - no active menu items: the default menu (a café with nothing to sell would break the simulation)
// - no active customer names: the default names (every first-timer needs one)
export async function getContent(): Promise<CafeContent & { source: 'db' | 'defaults' }> {
  const db = getDb();
  if (!db) return { ...DEFAULT_CONTENT, source: 'defaults' };
  try {
    const [menuRows, lineRows, nameRows] = await Promise.all([
      db.select().from(schema.menuItems).orderBy(asc(schema.menuItems.sort), asc(schema.menuItems.id)),
      db.select().from(schema.dialogueLines).orderBy(asc(schema.dialogueLines.sort), asc(schema.dialogueLines.id)),
      // its own fallback, so a database that hasn't had `db:push` since names were added still serves menu and lines
      db.select().from(schema.customerNames).orderBy(asc(schema.customerNames.sort), asc(schema.customerNames.id))
        .catch(err => { console.error('getContent: customer_names unavailable, using default names', err); return []; }),
    ]);
    const menu = menuRows.filter(r => r.active).map(r => ({ name: r.name, price: r.price, iced: r.iced }));
    const lines: Record<string, string[]> = {};
    for (const key of LINE_KEYS) {
      const rows = lineRows.filter(r => r.category === key);
      lines[key] = rows.length ? rows.filter(r => r.active).map(r => r.text) : DEFAULT_LINES[key];
    }
    const names = nameRows.filter(r => r.active).map(r => ({ name: r.name, gender: r.gender as Gender }));
    return { menu: menu.length ? menu : DEFAULT_MENU, lines, names: names.length ? names : DEFAULT_NAMES, source: 'db' };
  } catch (err) {
    console.error('getContent: falling back to defaults', err);
    return { ...DEFAULT_CONTENT, source: 'defaults' };
  }
}
