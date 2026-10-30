import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';

export type DB = ReturnType<typeof drizzle<typeof schema>>;

let cached: DB | null | undefined;

// null when DATABASE_URL is not set, so the café still runs on its built-in content
export function getDb(): DB | null {
  if (cached !== undefined) return cached;
  const url = process.env.DATABASE_URL;
  cached = url ? drizzle(neon(url), { schema }) : null;
  return cached;
}

export { schema };
