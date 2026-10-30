import { redirect } from 'next/navigation';
import { isAdmin } from '@/src/lib/auth';
import { login } from '../actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdmin()) redirect('/admin/menu');
  const { error } = await searchParams;
  const configured = !!process.env.ADMIN_PASSWORD && (process.env.SESSION_SECRET?.length ?? 0) >= 16;
  return (
    <main className="login">
      <form action={login} className="panel">
        <h1>窺視珈琲<small>後台登入</small></h1>
        {!configured && <p className="note warn">還沒設定 ADMIN_PASSWORD 或 SESSION_SECRET（至少 16 個字元），請先在環境變數裡填好。</p>}
        {error && <p className="note warn">密碼不對，再試一次。</p>}
        <label>密碼<input type="password" name="password" autoComplete="current-password" required autoFocus /></label>
        <button className="primary" disabled={!configured}>登入</button>
        <a href="/" className="back">← 回咖啡廳</a>
      </form>
    </main>
  );
}
