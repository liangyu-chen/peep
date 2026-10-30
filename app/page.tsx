import Cafe from './Cafe';
import { getContent } from '@/src/lib/content';

// read the menu and dialogue on every request, so back-office edits show up on the next reload
export const dynamic = 'force-dynamic';

export default async function Home() {
  const { menu, lines } = await getContent();
  return <Cafe content={{ menu, lines }} />;
}
