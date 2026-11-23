import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { and, desc, eq, gt } from 'drizzle-orm';
import { getDb, schema } from '@/src/lib/db';
import { BOARD_LIMIT, DEFAULT_NICK, MSG_MAX, NICK_MAX, cleanText, tooLong, type BoardPost } from '@/src/content/board';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
const fail = (status: number, error: string, message: string, extra: object = {}) => json({ error, message, ...extra }, status);

const isMissingColumn = (e: unknown) => String((e as { cause?: { code?: string } })?.cause?.code ?? (e as { code?: string })?.code) === '42703';

// the newest notes, newest first
export async function GET() {
  const db = getDb();
  if (!db) return json({ error: 'offline' }, 503);
  const t = schema.boardPosts;
  const order = [desc(t.createdAt), desc(t.id)] as const;
  try {
    const rows = await db.select({ id: t.id, nickname: t.nickname, message: t.message, createdAt: t.createdAt, reply: t.reply, repliedAt: t.repliedAt })
      .from(t).orderBy(...order).limit(BOARD_LIMIT);
    const posts: BoardPost[] = rows.map(r => ({ id: r.id, nickname: r.nickname, message: r.message, createdAt: r.createdAt.toISOString(), reply: r.reply ?? '', repliedAt: r.repliedAt ? r.repliedAt.toISOString() : null }));
    return json({ posts });
  } catch (e) {
    if (!isMissingColumn(e)) return json({ error: 'offline' }, 503);
    // the reply columns aren't in the database yet: the notes still show, without replies
    try {
      const rows = await db.select({ id: t.id, nickname: t.nickname, message: t.message, createdAt: t.createdAt })
        .from(t).orderBy(...order).limit(BOARD_LIMIT);
      const posts: BoardPost[] = rows.map(r => ({ id: r.id, nickname: r.nickname, message: r.message, createdAt: r.createdAt.toISOString(), reply: '', repliedAt: null }));
      return json({ posts });
    } catch {
      return json({ error: 'offline' }, 503);
    }
  }
}

// a keyed hash of the visitor's address, so the table never holds the address itself
function ipHash(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip')?.trim() || 'local';
  return createHmac('sha256', process.env.SESSION_SECRET || 'peep-board').update(ip).digest('hex').slice(0, 24);
}

function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, 'origin', '來源不正確，請從咖啡廳頁面留言。');

  let body: { nickname?: unknown; message?: unknown; website?: unknown };
  try {
    const b = await req.json();
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error('bad');
    body = b;
  } catch {
    return fail(400, 'bad_request', '資料格式不正確，請重新整理再試一次。');
  }

  // the honeypot field: a bot fills it in, so it gets a pretend success and nothing is stored
  if (typeof body.website === 'string' ? body.website.trim() : body.website) {
    return json({ post: { id: 0, nickname: DEFAULT_NICK, message: cleanText(body.message, MSG_MAX), createdAt: new Date().toISOString(), reply: '', repliedAt: null } }, 201);
  }

  if (tooLong(body.message, MSG_MAX)) return fail(400, 'too_long', `留言最多 ${MSG_MAX} 個字。`);
  const message = cleanText(body.message, MSG_MAX);
  if (!message) return fail(400, 'empty', '留言不能空白。');
  const nickname = cleanText(body.nickname, NICK_MAX) || DEFAULT_NICK;

  const db = getDb();
  if (!db) return fail(503, 'offline', '留言板暫時打烊了，晚點再來。');

  try {
    const hash = ipHash(req);
    const t = schema.boardPosts;
    const now = Date.now();
    const hour = await db.select({ at: t.createdAt }).from(t)
      .where(and(eq(t.ipHash, hash), gt(t.createdAt, new Date(now - 3_600_000))))
      .orderBy(desc(t.createdAt));
    const last = hour[0]?.at.getTime();
    if (last !== undefined && now - last < 30_000) {
      const wait = Math.max(1, Math.ceil((last + 30_000 - now) / 1000));
      return fail(429, 'too_fast', `留太快了，請等 ${wait} 秒再留言。`, { retryAfter: wait });
    }
    if (hour.length >= 6) {
      const wait = Math.max(1, Math.ceil((hour[hour.length - 1].at.getTime() + 3_600_000 - now) / 1000));
      return fail(429, 'hourly', '這個小時留言太多了，請稍後再來。', { retryAfter: wait });
    }
    const [row] = await db.insert(t).values({ nickname, message, ipHash: hash })
      .returning({ id: t.id, nickname: t.nickname, message: t.message, createdAt: t.createdAt, reply: t.reply, repliedAt: t.repliedAt });
    const post: BoardPost = { id: row.id, nickname: row.nickname, message: row.message, createdAt: row.createdAt.toISOString(), reply: row.reply ?? '', repliedAt: row.repliedAt ? row.repliedAt.toISOString() : null };
    return json({ post }, 201);
  } catch {
    return fail(503, 'offline', '留言板暫時打烊了，晚點再來。');
  }
}
