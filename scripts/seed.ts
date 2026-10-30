// Fills Neon with the built-in content: menu, dialogue, owner, regulars and first-timers' random values.
//   npm run db:seed    fills in only what's missing: an empty table, a dialogue category or random-value pool
//                      with no rows, a missing owner. Anything already there is left alone, so it's safe to re-run
//                      after new categories are added. (A category you emptied on purpose gets its defaults back.)
//   npm run db:reset   wipes every table and fills it again from the defaults
import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { DEFAULT_LINES, DEFAULT_MENU, DEFAULT_OWNER, DEFAULT_POOLS, DEFAULT_REGULARS, LINE_KEYS, POOL_KEYS, RENAMED_LINES } from '../src/content/catalog';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (put it in .env.local)');
  const db = drizzle(neon(url), { schema });
  const reset = process.argv.includes('--reset');

  if (reset) {
    for (const t of [schema.menuItems, schema.dialogueLines, schema.regulars, schema.randomValues, schema.settings]) await db.delete(t);
    console.log('cleared every table');
  }

  if ((await db.select({ id: schema.menuItems.id }).from(schema.menuItems).limit(1)).length === 0) {
    await db.insert(schema.menuItems).values(DEFAULT_MENU.map((m, i) => ({ ...m, sort: i })));
    console.log(`menu_items: ${DEFAULT_MENU.length} rows`);
  }

  const lineCats = new Set((await db.select({ c: schema.dialogueLines.category }).from(schema.dialogueLines)).map(r => r.c));
  const lineRows = LINE_KEYS.filter(k => !lineCats.has(k)).flatMap(category => (DEFAULT_LINES[category] ?? []).map((text, i) => ({ category, text, sort: i })));
  if (lineRows.length) { await db.insert(schema.dialogueLines).values(lineRows); console.log(`dialogue_lines: ${lineRows.length} rows for new categories`); }
  for (const [category, from, to] of RENAMED_LINES) {
    await db.update(schema.dialogueLines).set({ text: to }).where(and(eq(schema.dialogueLines.category, category), eq(schema.dialogueLines.text, from)));
  }

  if ((await db.select({ key: schema.settings.key }).from(schema.settings).where(eq(schema.settings.key, 'owner'))).length === 0) {
    await db.insert(schema.settings).values({ key: 'owner', value: DEFAULT_OWNER });
    console.log('settings: owner');
  }

  if ((await db.select({ id: schema.regulars.id }).from(schema.regulars).limit(1)).length === 0) {
    await db.insert(schema.regulars).values(DEFAULT_REGULARS.map((r, i) => ({ ...r, sort: i })));
    console.log(`regulars: ${DEFAULT_REGULARS.length} rows`);
  }

  const pools = new Set((await db.select({ p: schema.randomValues.pool }).from(schema.randomValues)).map(r => r.p));
  const valueRows = POOL_KEYS.filter(k => !pools.has(k)).flatMap(pool => DEFAULT_POOLS[pool].map((value, i) => ({ pool, value, sort: i })));
  if (valueRows.length) { await db.insert(schema.randomValues).values(valueRows); console.log(`random_values: ${valueRows.length} rows for new pools`); }

  console.log('done');
}

main().catch(err => { console.error(err); process.exit(1); });
