import Link from 'next/link';
import { requireAdmin } from '@/src/lib/auth';
import { getDb } from '@/src/lib/db';
import { logout } from '../actions';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <header className="bar">
        <strong>窺視珈琲 後台</strong>
        <nav>
          <Link href="/admin/menu">菜單</Link>
          <Link href="/admin/lines">台詞</Link>
          <Link href="/admin/names">新客姓名</Link>
          <a href="/" target="_blank" rel="noreferrer">回咖啡廳 ↗</a>
        </nav>
        <form action={logout}><button>登出</button></form>
      </header>
      {!getDb() && <p className="note warn wrap">還沒設定 DATABASE_URL，這裡的內容是唯讀的預設值。請在 .env.local（本機）或 Vercel 環境變數裡填入 Neon 連線字串。</p>}
      <main className="wrap">{children}</main>
    </>
  );
}
