import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// The back office has one password (ADMIN_PASSWORD). Logging in sets an httpOnly cookie
// "<expiry>.<hmac>" signed with SESSION_SECRET; nothing is stored server-side.
const COOKIE = 'peep_admin';
const MAX_AGE = 60 * 60 * 24 * 7;   // a week

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');

async function hmac(data: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET must be set (16+ characters)');
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

// constant-time compare of two strings (via their hashes, so length differences don't leak either)
async function safeEqual(a: string, b: string) {
  const [ha, hb] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(s))));
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function checkPassword(input: string) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  return safeEqual(input, pw);
}

export async function createSession() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const jar = await cookies();
  jar.set(COOKIE, `${exp}.${await hmac(exp)}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: MAX_AGE });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [exp, sig] = value.split('.');
  if (!exp || !sig || Number(exp) * 1000 < Date.now()) return false;
  try { return await safeEqual(sig, await hmac(exp)); } catch { return false; }
}

// for pages and server actions: sends anyone not logged in to the login page
export async function requireAdmin() {
  if (!(await isAdmin())) redirect('/admin/login');
}
