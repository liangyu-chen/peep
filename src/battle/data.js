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
  items: [{ id: 'coffee', name: '咖啡', qty: 3, desc: '老闆回復 10 HP。' }],
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
  蠻橫: { 蠻橫: 2, 小氣: 0.5, 吵鬧: 1 },
  小氣: { 蠻橫: 1, 小氣: 2, 吵鬧: 0.5 },
  吵鬧: { 蠻橫: 0.5, 小氣: 1, 吵鬧: 2 },
  悲傷: { 悲傷: 2, 焦慮: 0.5, 疲累: 1 },
  焦慮: { 悲傷: 1, 焦慮: 2, 疲累: 0.5 },
  疲累: { 悲傷: 0.5, 焦慮: 1, 疲累: 2 },
};

export const RUDE_TYPES = ['蠻橫', '小氣', '吵鬧'];
export const KIND_TYPES = ['悲傷', '焦慮', '疲累'];

const BASE_ITEMS = {
  rude: [
    { id: 'coffee', name: '咖啡', qty: 3, desc: '老闆回復 20～30 HP。' },
    { id: 'sign', name: '店規立牌', qty: 1, desc: '擋下對方下一次攻擊。' },
    { id: 'tissue', name: '面紙', qty: 0, desc: '在這裡用不上。' },
  ],
  kind: [
    { id: 'coffee', name: '咖啡', qty: 3, desc: '老闆回復 20～30 HP。' },
    { id: 'sign', name: '店規立牌', qty: 0, desc: '在這裡用不上。' },
    { id: 'tissue', name: '面紙', qty: 2, desc: '對方下一招的傷害減半。' },
  ],
};

const OWNER_MOVES = {
  rude: [
    { id: 'broom', name: '掃把橫掃', type: '蠻橫', min: 26, max: 34, acc: 75, maxPp: 5, fx: 'broom', desc: '威力很大，偶爾還是會揮空。' },
    { id: 'calc', name: '亮出計算器', type: '小氣', min: 14, max: 20, acc: 95, maxPp: 12, fx: 'calc', desc: '算清楚他到底欠了多少錢。' },
    { id: 'chant', name: '播放大悲咒', type: '吵鬧', min: 14, max: 20, acc: 95, maxPp: 12, fx: 'chant', desc: '店裡的音量突然大了起來。' },
    { id: 'coffee', name: '灑熱咖啡', type: '一般', min: 10, max: 14, acc: 95, maxPp: 15, fx: 'coffee', desc: '把剛煮好的熱咖啡潑過去。' },
  ],
  kind: [
    { id: 'cake', name: '請吃蛋糕', type: '悲傷', min: 12, max: 18, acc: 95, maxPp: 10, fx: 'cake', heal: true, desc: '甜的一口，心情也跟著軟了。' },
    { id: 'listen', name: '點頭傾聽', type: '焦慮', min: 12, max: 18, acc: 95, maxPp: 10, fx: 'listen', heal: true, desc: '認真聽他把話說完。' },
    { id: 'rage', name: '陪罵兩句', type: '疲累', min: 12, max: 18, acc: 95, maxPp: 10, fx: 'rage', heal: true, desc: '老闆幫腔，一起抱怨幾句。' },
    { id: 'latte', name: '造型拉花', type: '一般', min: 10, max: 14, acc: 100, maxPp: 15, fx: 'latte', heal: true, desc: '一杯畫了造型的熱拿鐵。' },
  ],
};

const CUSTOMER_MOVES = {
  rude: [
    { id: 'slam', name: '拍桌', type: '一般', min: 8, max: 12, acc: 100, fx: 'slam' },
    { id: 'shout', name: '大聲嚷嚷', type: '一般', min: 4, max: 7, acc: 100, fx: 'shout', effect: 'blur' },
    { id: 'boss', name: '「叫你們老闆出來！」', type: '一般', min: 3, max: 6, acc: 100, fx: 'boss', effect: 'reflect' },
    { id: 'review', name: '威脅給一星負評', type: '一般', min: 15, max: 22, acc: 70, fx: 'review' },
  ],
  kind: [
    { id: 'sigh', name: '嘆氣', type: '一般', min: 4, max: 7, acc: 100, fx: 'sigh' },
    { id: 'grumble', name: '抱怨連連', type: '一般', min: 8, max: 12, acc: 100, fx: 'grumble' },
    { id: 'cry', name: '哭出來', type: '一般', min: 14, max: 20, acc: 75, fx: 'cry' },
    { id: 'remember', name: '又想起那件事', type: '一般', min: 3, max: 5, acc: 100, fx: 'remember', effect: 'hurtSelf', selfMin: 5, selfMax: 10 },
  ],
};

export const RESULT = {
  spider: {
    win: { title: '勝利！', lines: ['野生的蜘蛛昏倒了！', '老闆獲得了 蛛絲 ×1、經驗值 35！'], tag: 'WIN' },
    lose: { title: '眼前一黑……', lines: ['老闆倒在地板上。', '咖啡機還在嗡嗡作響，蜘蛛慢慢爬走了。'], tag: 'LOSE' },
    flee: { title: '逃走了！', lines: ['老闆退回吧台後面。', '蜘蛛似乎也鬆了一口氣。'], tag: 'RUN' },
  },
  rude: {
    win: { title: '請他出去了！', lines: ['○○終於安靜下來，被請出了店裡。', '老闆鬆了一口氣。'], tag: 'WIN' },
    lose: { title: '眼前一黑……', lines: ['老闆被吵到頭昏眼花。', '奧客還坐在位子上，見好就收。'], tag: 'LOSE' },
    flee: { title: '先躲開再說……', lines: ['老闆退回吧台後面。', '奧客還在那裡，問題還沒解決。'], tag: 'RUN' },
  },
  kind: {
    win: { title: '心情放晴了！', lines: ['○○的表情終於放鬆了。', '老闆陪他聊了好一會兒。'], tag: 'WIN' },
    lose: { title: '力不從心……', lines: ['老闆也跟著累了起來。', '客人還是低著頭，改天再試試。'], tag: 'LOSE' },
    flee: { title: '先走開一下……', lines: ['老闆退回吧台後面。', '客人還在座位上，等一下再來關心。'], tag: 'RUN' },
  },
};

export function typeEffect(moveType, defenderTypes) {
  const chart = TYPE_CHART[moveType] || {};
  return defenderTypes.reduce((mult, type) => mult * (chart[type] || 1), 1);
}

export function cloneBattleData({ mode, type, customer } = {}) {
  if (mode !== 'rude' && mode !== 'kind') {
    return JSON.parse(JSON.stringify({ mode: 'spider', player: PLAYER, enemy: SPIDER }));
  }
  const enemyType = type || (mode === 'rude' ? RUDE_TYPES[0] : KIND_TYPES[0]);
  const data = {
    mode,
    player: {
      name: '老闆',
      level: 5,
      types: ['一般'],
      maxHp: 100,
      atk: 16,
      def: 10,
      spd: 12,
      moves: OWNER_MOVES[mode],
      items: BASE_ITEMS[mode],
    },
    enemy: {
      name: customer?.name || (mode === 'rude' ? '奧客' : '客人'),
      level: 5,
      types: [enemyType],
      maxHp: 100,
      startHp: mode === 'rude' ? 100 : 10,
      atk: 16,
      def: 10,
      spd: 9,
      moves: CUSTOMER_MOVES[mode],
    },
  };
  return JSON.parse(JSON.stringify(data));
}

export function resultFor(mode, kind, name) {
  const group = RESULT[mode] || RESULT.spider;
  const result = group[kind] || group.flee;
  return {
    ...result,
    lines: result.lines.map((line) => line.replaceAll('○○', name || '客人')),
  };
}
