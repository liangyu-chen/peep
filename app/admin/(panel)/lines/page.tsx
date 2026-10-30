import { redirect } from 'next/navigation';
import { LINE_GROUPS } from '@/src/content/catalog';

// the dialogue is split into one page per group; the old address goes to the first
export default function LinesIndex() {
  redirect(`/admin/lines/${LINE_GROUPS[0].slug}`);
}
