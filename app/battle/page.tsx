import type { Metadata } from 'next';
import BattleClient from '@/src/battle/BattleClient';
import { getContent } from '@/src/lib/content';

export const metadata: Metadata = {
  title: '蜘蛛驚魂（規劃中）｜窺視咖啡',
  description: '回合制戰鬥小遊戲預覽。',
};

export const dynamic = 'force-dynamic';

export default async function BattlePage() {
  const { owner } = await getContent();
  return <BattleClient owner={{ name: owner.name, look: owner.look }} />;
}
