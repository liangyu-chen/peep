// Fills Neon with the built-in menu and dialogue.
//   npm run db:seed    only fills tables that are empty
//   npm run db:reset   wipes both tables and fills them again
import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../src/db/schema';
import { DEFAULT_LINES, DEFAULT_MENU, LINE_KEYS } from '../src/content/catalog';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (put it in .env.local)');
  const db = drizzle(neon(url), { schema });
  const reset = process.argv.includes('--reset');

  if (reset) {
    await db.delete(schema.menuItems);
    await db.delete(schema.dialogueLines);
    console.log('cleared menu_items and dialogue_lines');
  }

  if ((await db.select({ id: schema.menuItems.id }).from(schema.menuItems).limit(1)).length === 0) {
    await db.insert(schema.menuItems).values(DEFAULT_MENU.map((m, i) => ({ ...m, sort: i })));
    console.log(`menu_items: ${DEFAULT_MENU.length} rows`);
  } else console.log('menu_items already has rows, left alone');

  if ((await db.select({ id: schema.dialogueLines.id }).from(schema.dialogueLines).limit(1)).length === 0) {
    const rows = LINE_KEYS.flatMap(category => (DEFAULT_LINES[category] ?? []).map((text, i) => ({ category, text, sort: i })));
    await db.insert(schema.dialogueLines).values(rows);
    console.log(`dialogue_lines: ${rows.length} rows`);
  } else console.log('dialogue_lines already has rows, left alone');
}

main().catch(err => { console.error(err); process.exit(1); });
