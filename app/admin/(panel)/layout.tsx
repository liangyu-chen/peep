import Link from 'next/link';
import { requireAdmin } from '@/src/lib/auth';
import { getDb } from '@/src/lib/db';
import { logout } from '../actions';
import { LINE_GROUPS } from '@/src/content/catalog';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <header className="bar">
        <strong>窺視珈琲 後台</strong>
        <nav>
          <Link href="/admin/menu">菜單</Link>
          <Link href="/admin/owner">老闆</Link>
          <Link href="/admin/regulars">熟客</Link>
          <Link href="/admin/random">新客隨機值</Link>
          {LINE_GROUPS.map(g => <Link key={g.slug} href={`/admin/lines/${g.slug}`}>{g.group}台詞</Link>)}
        </nav>
        {/* outside the nav, so on a phone it isn't scrolled off the end of the tab row */}
        <a className="home" href="/" target="_blank" rel="noreferrer">回咖啡廳 ↗</a>
        <form action={logout}><button>登出</button></form>
      </header>
      {!getDb() && <p className="note warn wrap">還沒設定 DATABASE_URL，這裡的內容是唯讀的預設值。請在 .env.local（本機）或 Vercel 環境變數裡填入 Neon 連線字串。</p>}
      <main className="wrap">{children}</main>
    </>
  );
}
