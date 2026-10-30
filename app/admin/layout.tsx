import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = { title: '窺視珈琲 後台', robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="admin">{children}</div>;
}
