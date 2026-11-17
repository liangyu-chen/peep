export const PLAYER = {
  name: '老闆',
  level: 5,
  types: ['一般'],
  maxHp: 26,
  atk: 16,
  def: 10,
  spd: 12,
  // Strongest to weakest against the spider (damage per hit, level 5):
  // 拖鞋拍打 ~9 (but hits only 30% of the time) > 噴射殺蟲劑 ~7 (毒, super effective on 蟲)
  // > 灑熱咖啡 ~5 > 拉花表演 ~4. 一般 moves get the owner's 1.5x same-type bonus,
  // which the powers below already account for.
  moves: [
    {
      id: 'slipper',
      name: '拖鞋拍打',
      type: '一般',
      power: 16,
      acc: 30,
      maxPp: 5,
      fx: 'slipper',
      desc: '店裡最古老的驅蟲兵器。威力最大，但很容易揮空。',
    },
    {
      id: 'spray',
      name: '噴射殺蟲劑',
      type: '毒',
      power: 7,
      acc: 90,
      maxPp: 10,
      fx: 'spray',
      desc: '對準蜘蛛猛按噴頭，毒霧對蟲系效果拔群。',
    },
    {
      id: 'coffee',
      name: '灑熱咖啡',
      type: '熱',
      power: 14,
      acc: 95,
      maxPp: 15,
      fx: 'coffee',
      desc: '把剛煮好的熱咖啡潑過去。',
    },
    {
      id: 'latte',
      name: '拉花表演',
      type: '一般',
      power: 3,
      acc: 100,
      maxPp: 12,
      fx: 'latte',
      desc: '一杯完美的愛心拉花，穩穩命中。',
    },
  ],
  items: [{ id: 'coffee', name: '咖啡', qty: 3, desc: '回復 10 HP。' }],
};

export const SPIDER = {
  name: '蜘蛛',
  level: 5,
  types: ['蟲'],
  maxHp: 22,
  atk: 16,
  def: 9,
  spd: 9,
  moves: [
    { id: 'bite', name: '咬', type: '蟲', power: 6, acc: 95, fx: 'bite' },
    { id: 'web', name: '吐絲', type: '蟲', power: 4, acc: 100, fx: 'web', effect: 'slow' },
    { id: 'poison', name: '毒牙', type: '毒', power: 5, acc: 90, fx: 'poison' },
    { id: 'pounce', name: '撲擊', type: '一般', power: 7, acc: 85, fx: 'pounce' },
  ],
};

export const TYPE_CHART = {
  毒: { 蟲: 2 },
};

export const RESULT = {
  win: {
    title: '勝利！',
    lines: ['野生的蜘蛛昏倒了！', '老闆獲得了 蛛絲 ×1、經驗值 35！'],
    tag: 'WIN',
  },
  lose: {
    title: '眼前一黑……',
    lines: ['老闆倒在地板上。', '咖啡機還在嗡嗡作響，蜘蛛慢慢爬走了。'],
    tag: 'LOSE',
  },
  flee: {
    title: '逃走了！',
    lines: ['老闆退回吧台後面。', '蜘蛛似乎也鬆了一口氣。'],
    tag: 'RUN',
  },
};

export function typeEffect(moveType, defenderTypes) {
  const chart = TYPE_CHART[moveType] || {};
  return defenderTypes.reduce((mult, type) => mult * (chart[type] || 1), 1);
}

export function cloneBattleData() {
  return JSON.parse(JSON.stringify({ player: PLAYER, enemy: SPIDER }));
}
