import Cafe from './Cafe';
import { getContent } from '@/src/lib/content';

// read the menu, dialogue and customers on every request, so back-office edits show up on the next reload
export const dynamic = 'force-dynamic';

export default async function Home() {
  const { source: _source, ...content } = await getContent();
  return <Cafe content={content} />;
}
