import { desc } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { REPLY_MAX } from '@/src/content/board';
import { clearBoardReply, deleteBoardPost, saveBoardReply } from '../../actions';
import ConfirmButton from '../ConfirmButton';

const fmt = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'short', timeStyle: 'short', hour12: false });

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  let rows: (typeof schema.boardPosts.$inferSelect)[] = [];
  let stale = false;
  if (db) {
    try {
      rows = await db.select().from(schema.boardPosts).orderBy(desc(schema.boardPosts.createdAt), desc(schema.boardPosts.id)).limit(200);
    } catch {
      stale = true;
    }
  }

  return (
    <>
      <h1>留言板</h1>
      {msg && <p className="note ok">{msg}</p>}
      {!db ? <p className="note warn">沒有資料庫。</p> : stale ? <p className="note warn">資料庫欄位未更新，請執行 npm run db:push</p> : !rows.length ? <p className="muted">還沒有留言。</p> : (
        <div className="board-list">
          {rows.map(r => (
            <form key={r.id} action={saveBoardReply} className="board-item">
              <input type="hidden" name="id" value={r.id} />
              <div className="what">
                <b>{r.nickname}</b>
                <span>{r.message}</span>
                <span className="when">{fmt.format(r.createdAt)} · {r.ipHash.slice(0, 8) || '-'}</span>
              </div>
              <textarea name="reply" rows={2} maxLength={REPLY_MAX} defaultValue={r.reply} aria-label="老闆回覆" />
              <div className="board-actions">
                <button type="submit" className="primary">{r.reply ? '更新回覆' : '回覆'}</button>
                {r.reply && (
                  <ConfirmButton formAction={clearBoardReply} title="清除回覆" confirmLabel="清除" message={`清除對「${r.nickname}」的回覆？`}>清除回覆</ConfirmButton>
                )}
                <ConfirmButton formAction={deleteBoardPost} className="danger" title="刪除留言" message={`刪除「${r.nickname}」的這則留言？無法復原。`}>刪除</ConfirmButton>
                {r.repliedAt && <span className="when">{fmt.format(r.repliedAt)}</span>}
              </div>
            </form>
          ))}
        </div>
      )}
    </>
  );
}
