import type { Metadata } from 'next';
import BattleClient from '@/src/battle/BattleClient';
import { getContent } from '@/src/lib/content';

export const metadata: Metadata = {
  title: '蜘蛛驚魂（規劃中）｜窺視咖啡',
  description: '回合制戰鬥小遊戲預覽。',
};

export const dynamic = 'force-dynamic';

// /battle is the spider; /battle?mode=rude or ?mode=kind (and &type=…) previews a customer fight, the owner standing in
// for the customer too
export default async function BattlePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { owner } = await getContent();
  const query = await searchParams;
  const mode = query.mode === 'rude' || query.mode === 'kind' ? query.mode : undefined;
  const type = typeof query.type === 'string' ? query.type : undefined;
  const self = { name: owner.name, look: owner.look };
  return <BattleClient owner={self} mode={mode} type={type} customer={mode ? { name: '客人', look: owner.look } : undefined} />;
}
