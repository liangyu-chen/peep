// One-off: adds the regulars' look2 column (第二套捏臉), gives everyone a copy of their first look, and drops the
// short-lived outfit2 (a second outfit only) from the stored looks. Safe to re-run.
//   npx tsx scripts/add-look2.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (put it in .env.local)');
  const sql = neon(url);
  await sql`ALTER TABLE regulars ADD COLUMN IF NOT EXISTS look2 jsonb`;
  const cleaned = await sql`UPDATE regulars SET look = look - 'outfit2' WHERE look ? 'outfit2' RETURNING name`;
  const copied = await sql`UPDATE regulars SET look2 = look WHERE look2 IS NULL RETURNING name`;
  console.log(`outfit2 removed from ${cleaned.length}; look2 copied from look for ${copied.length}: ${copied.map(r => r.name).join('、')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
