// Everything the café says and sells that the back office can edit.
// The 3D scene reads this shape; the database stores the same thing as rows.

export type MenuItem = {
  name: string;
  price: number | null;   // null shows as $??? on the paper menu, like the real one
  iced: boolean;          // iced drinks come in a tall glass, hot ones in a Taiwanese tea cup
};

export type CafeContent = {
  menu: MenuItem[];
  lines: Record<string, string[]>;
};

export type LineCategory = { key: string; label: string; vars?: string[] };
export type LineGroup = { group: string; items: LineCategory[] };

// {name} customer's name · {drink} their drink · {team} an NBA team · {opponent} the other player
export const LINE_GROUPS: LineGroup[] = [
  {
    group: '老闆',
    items: [
      { key: 'owner.greetRegular', label: '招呼熟客', vars: ['name', 'drink'] },
      { key: 'owner.greetNew', label: '招呼新客' },
      { key: 'owner.serveHot', label: '出熱飲（有拉花）', vars: ['drink'] },
      { key: 'owner.serveIced', label: '出冰飲', vars: ['drink'] },
      { key: 'owner.idle', label: '閒著沒事時' },
      { key: 'owner.beansDone', label: '從倉庫補完豆子' },
      { key: 'owner.byeRegular', label: '送走熟客', vars: ['name'] },
      { key: 'owner.byeNew', label: '送走新客' },
      { key: 'owner.gameReact', label: '看到 2K 進球' },
      { key: 'owner.invite', label: '客人被邀去打 2K', vars: ['name'] },
      { key: 'owner.closing', label: '準備打烊' },
      { key: 'owner.opening', label: '開店' },
    ],
  },
  {
    group: '客人',
    items: [
      { key: 'customer.arriveRegular', label: '熟客進門' },
      { key: 'customer.arriveNew', label: '新客進門' },
      { key: 'customer.orderRegular', label: '熟客點餐', vars: ['drink'] },
      { key: 'customer.orderNew', label: '新客點餐', vars: ['drink'] },
      { key: 'customer.takeaway', label: '沒位子改外帶' },
      { key: 'customer.chatTable', label: '室內座位閒聊' },
      { key: 'customer.chatPorch', label: '騎樓座位閒聊' },
      { key: 'customer.wantsTv', label: '看到電視空了' },
      { key: 'customer.inviteAccept', label: '答應去打 2K' },
      { key: 'customer.inviteFull', label: '電視前沒位子' },
      { key: 'customer.leaveRegular', label: '熟客離開' },
      { key: 'customer.leaveNew', label: '新客離開' },
    ],
  },
  {
    group: '打 2K',
    items: [
      { key: 'game.sitDown', label: '坐下準備開打' },
      { key: 'game.sitWaiting', label: '等下一場' },
      { key: 'game.challenge', label: '向對手喊話', vars: ['opponent'] },
      { key: 'game.vsCpu', label: '一個人打電腦' },
      { key: 'game.teamClash', label: '跟對手選到同隊', vars: ['team'] },
      { key: 'game.score3', label: '投進三分' },
      { key: 'game.score2', label: '投進兩分' },
      { key: 'game.conceded', label: '被對手進球' },
      { key: 'game.spectator', label: '旁觀的人加油' },
      { key: 'game.win', label: '贏球' },
      { key: 'game.lose', label: '輸球' },
      { key: 'game.rematch', label: '還要再一場' },
      { key: 'game.tired', label: '打累了去坐' },
    ],
  },
];

export const LINE_KEYS = LINE_GROUPS.flatMap(g => g.items.map(i => i.key));

export const DEFAULT_MENU: MenuItem[] = [
  { name: '林美如', price: null, iced: true },
  { name: '一起搖擺', price: null, iced: true },
  { name: '別害羞', price: null, iced: true },
  { name: '奧利多美式', price: null, iced: true },
  { name: '夏一布', price: null, iced: true },
  { name: '花生拿鐵', price: null, iced: false },
  { name: '冰維也納', price: null, iced: true },
  { name: '拿鐵', price: null, iced: false },
  { name: '奶昔', price: null, iced: true },
];

export const DEFAULT_LINES: Record<string, string[]> = {
  'owner.greetRegular': ['{name}來啦！一樣{drink}？', '{name}～今天也要打一場嗎？', '嘿 {name}，老樣子？'],
  'owner.greetNew': ['歡迎～第一次來嗎？', '要喝什麼？不知道的話我幫你配'],
  'owner.serveHot': ['今天拉的是戴花的女孩～'],
  'owner.serveIced': ['{drink}，請慢用'],
  'owner.idle': ['今天想喝什麼我幫你決定', '誰要挑戰我 2K？', '菜單價格？$??? 啦', '這杯拉個女孩給你'],
  'owner.beansDone': ['豆子補好了'],
  'owner.byeRegular': ['掰 {name}～'],
  'owner.byeNew': ['謝謝光臨！'],
  'owner.gameReact': ['好球！', '吵小聲一點啦哈哈'],
  'owner.invite': ['{name}上啦！'],
  'owner.closing': ['今天辛苦啦，準備打烊囉～'],
  'owner.opening': ['開店囉！'],

  'customer.arriveRegular': ['小鬍子！', '嗨老闆～', '我又來啦'],
  'customer.arriveNew': ['菜單怎麼都是 $???', '哇，這裡可以打 2K？'],
  'customer.orderRegular': ['老樣子，{drink}！', '對，{drink}，謝啦', '一樣一樣～'],
  'customer.orderNew': ['那我要{drink}', '{drink}是什麼？來一杯！'],
  'customer.takeaway': ['那我外帶好了'],
  'customer.chatTable': ['等等換我打 2K', '吧台公仔又變多了', '漫畫借我看', '這杯真的好喝', '（滑手機）'],
  'customer.chatPorch': ['騎樓吹風好舒服', '隔壁五金行好熱鬧', '這盆栽是新的嗎', '機車停好近'],
  'customer.wantsTv': ['電視空了！我去打一場'],
  'customer.inviteAccept': ['好啊！來一場'],
  'customer.inviteFull': ['電視前滿了啦，等下一輪'],
  'customer.leaveRegular': ['掰掰，明天見！', '走啦，下次再戰', '小鬍子掰～'],
  'customer.leaveNew': ['謝謝，下次再來！', '拉花好漂亮～'],

  'game.sitDown': ['來來來，開一場', '今天手感很好', '誰要來被我電'],
  'game.sitWaiting': ['下一場我來！'],
  'game.challenge': ['{opponent}，來！'],
  'game.vsCpu': ['先打電腦暖身'],
  'game.teamClash': ['撞隊了，我換{team}'],
  'game.score3': ['三分雨！', '刷！', '這球我的'],
  'game.score2': ['進啦！', '穩', '太簡單了'],
  'game.conceded': ['蛤？', '防守咧…', '手滑啦', '這不算'],
  'game.spectator': ['好球！', '哇～', '欸防守啦', '換我換我'],
  'game.win': ['贏啦！！', 'GG 輕鬆', '再來一場？'],
  'game.lose': ['再一場！', '網路延遲啦', '我讓你的'],
  'game.rematch': ['再一場！', '不服，再來', '這場算熱身'],
  'game.tired': ['打累了，坐一下'],
};

export const DEFAULT_CONTENT: CafeContent = { menu: DEFAULT_MENU, lines: DEFAULT_LINES };
