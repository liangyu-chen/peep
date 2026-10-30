import { asc } from 'drizzle-orm';
import { getDb, schema } from './db';
import { DEFAULT_CONTENT, DEFAULT_LINES, DEFAULT_MENU, LINE_KEYS, type CafeContent } from '../content/catalog';

// What the café shows, read from Neon.
// - no database, or it can't be reached: the built-in defaults
// - a category with no rows at all: its default lines (so new categories work before anyone edits them)
// - a category whose rows are all switched off: silence
// - no active menu items: the default menu (a café with nothing to sell would break the simulation)
export async function getContent(): Promise<CafeContent & { source: 'db' | 'defaults' }> {
  const db = getDb();
  if (!db) return { ...DEFAULT_CONTENT, source: 'defaults' };
  try {
    const [menuRows, lineRows] = await Promise.all([
      db.select().from(schema.menuItems).orderBy(asc(schema.menuItems.sort), asc(schema.menuItems.id)),
      db.select().from(schema.dialogueLines).orderBy(asc(schema.dialogueLines.sort), asc(schema.dialogueLines.id)),
    ]);
    const menu = menuRows.filter(r => r.active).map(r => ({ name: r.name, price: r.price, iced: r.iced }));
    const lines: Record<string, string[]> = {};
    for (const key of LINE_KEYS) {
      const rows = lineRows.filter(r => r.category === key);
      lines[key] = rows.length ? rows.filter(r => r.active).map(r => r.text) : DEFAULT_LINES[key];
    }
    return { menu: menu.length ? menu : DEFAULT_MENU, lines, source: 'db' };
  } catch (err) {
    console.error('getContent: falling back to defaults', err);
    return { ...DEFAULT_CONTENT, source: 'defaults' };
  }
}
