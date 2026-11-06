// Everything the café says and sells that the back office can edit. How people look (捏臉) is in ./look.ts,
// re-exported here.
import type { Look } from './look';
export * from './look';
// The 3D scene reads this shape; the database stores the same thing as rows.

// one line of the paper menu. hot / ice are what's printed in those columns: a price like '120', or '∞', '???'…;
// empty means that version isn't served. Iced drinks come in a tall glass, hot ones in a Taiwanese tea cup.
export type MenuItem = { name: string; en: string; section: string; hot: string; ice: string };
// 隱藏菜單: drinks that aren't on the menu customers see, but that some of them order anyway
export const HIDDEN_SECTION = '隱藏菜單';
// 蛋糕: the cakes, not on the menu either; nobody orders one on a whim (a first-timer's pick, a regular trying something
// new), only a regular whose usual it is
export const CAKE_SECTION = '蛋糕';
export const MENU_SECTIONS = ['Original', 'Coffee late', 'Something special', 'Not coffee', HIDDEN_SECTION, CAKE_SECTION];
export const OFF_MENU = [HIDDEN_SECTION, CAKE_SECTION];   // sections not printed on the paper menu
// the cakes that were kept in the hidden menu before there was a 蛋糕 section: read as cakes until the menu's next saved
const MOVED_TO_CAKES = ['伯爵茶肉鬆', '檸檬生乳酪', '提拉米蘇'];
export const menuSection = (name: string, section: string) => (section === HIDDEN_SECTION && MOVED_TO_CAKES.includes(name) ? CAKE_SECTION : section);

// the games a regular plays: NBA 2K and the fighting game on the TV, spinning tops in the arcade.
// An empty team or fighter means a random one each visit. The fighting game is 快打旋風, its fighters in SF_FIGHTERS.
export type Regular = {
  name: string; job: string; drink: string; visits: number; quirk: string; look: Look;
  plays2k: boolean; team: string; playsFight: boolean; fighter: string; playsTops: boolean;
  smokes: boolean;   // smokers like sitting outside, where smoking is allowed
};
export type Owner = { name: string; job: string; look: Look };

// the values first-time customers are made from: name = surname + title (the title decides their look), plus a job
export type RandomPools = { surname: string[]; titleF: string[]; titleM: string[]; job: string[] };
export type PoolKey = keyof RandomPools;

export type CafeContent = {
  menu: MenuItem[];
  lines: Record<string, string[]>;
  owner: Owner;
  regulars: Regular[];
  pools: RandomPools;
};

export type LineCategory = { key: string; label: string; vars?: string[] };
export type LineGroup = { group: string; slug: string; items: LineCategory[] };   // each group is its own page, /admin/lines/<slug>

// placeholders: {owner} the owner's name · {name} the customer · {drink} their drink · {team} an NBA team
// {fighter} a 快打旋風 character · {opponent} the other player
// the owner's lines are edited on the owner's page; the rest on the dialogue page, in these groups
export const OWNER_LINES: LineCategory[] = [
  { key: 'owner.greetRegular', label: '招呼熟客', vars: ['name', 'drink'] },
  { key: 'owner.greetNew', label: '招呼新客' },
  { key: 'owner.serveHot', label: '出熱飲（有拉花）', vars: ['name', 'drink'] },
  { key: 'owner.serveIced', label: '出冰飲', vars: ['name', 'drink'] },
  { key: 'owner.idle', label: '閒著沒事時' },
  { key: 'owner.beansDone', label: '從倉庫補完豆子' },
  { key: 'owner.byeRegular', label: '送走熟客', vars: ['name'] },
  { key: 'owner.byeNew', label: '送走新客' },
  { key: 'owner.gameReact', label: '看到電視上打得精彩' },
  { key: 'owner.closing', label: '準備打烊（{name} 是還在店裡的一位客人，沒人時是「大家」）', vars: ['name'] },
  { key: 'owner.opening', label: '開店' },
];
export const LINE_GROUPS: LineGroup[] = [
  {
    group: '客人', slug: 'customer',
    items: [
      { key: 'customer.arriveRegular', label: '熟客進門', vars: ['owner'] },
      { key: 'customer.arriveNew', label: '新客進門', vars: ['owner'] },
      { key: 'customer.orderRegular', label: '熟客點餐', vars: ['drink'] },
      { key: 'customer.orderNew', label: '新客點餐', vars: ['drink'] },
      { key: 'customer.orderOther', label: '熟客換點別的', vars: ['drink'] },
      { key: 'customer.takeaway', label: '沒位子改外帶' },
      { key: 'customer.chatTable', label: '室內座位閒聊', vars: ['owner'] },
      { key: 'customer.chatPorch', label: '戶外區座位閒聊', vars: ['owner'] },
      { key: 'customer.smoke', label: '在戶外區點菸', vars: ['owner'] },
      { key: 'customer.wantsTv', label: '看到電視空了' },
      { key: 'customer.leaveRegular', label: '熟客離開', vars: ['owner'] },
      { key: 'customer.leaveNew', label: '新客離開', vars: ['owner'] },
    ],
  },
  {
    group: '2K', slug: '2k',
    items: [
      { key: 'game.sitDown', label: '坐下準備開打', vars: ['team'] },
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
  {
    group: '快打旋風', slug: 'fight',
    items: [
      { key: 'fight.sitDown', label: '坐下準備開打', vars: ['fighter'] },
      { key: 'fight.challenge', label: '向對手喊話', vars: ['opponent'] },
      { key: 'fight.vsCpu', label: '一個人打電腦', vars: ['fighter'] },
      { key: 'fight.hit', label: '打中對手' },
      { key: 'fight.special', label: '使出必殺技', vars: ['fighter'] },
      { key: 'fight.hurt', label: '被打中' },
      { key: 'fight.spectator', label: '旁觀的人加油' },
      { key: 'fight.ko', label: '把對手 K.O.' },
      { key: 'fight.lose', label: '被 K.O.' },
      { key: 'fight.rematch', label: '還要再一場' },
    ],
  },
];

// the dialogue page a category is edited on (the owner's are on the owner's page)
export const linesPageFor = (key: string) => {
  if (key.startsWith('owner.')) return '/admin/owner';
  const g = LINE_GROUPS.find(gr => gr.items.some(i => i.key === key));
  return `/admin/lines/${g ? g.slug : LINE_GROUPS[0].slug}`;
};

export const LINE_KEYS = [...OWNER_LINES.map(i => i.key), ...LINE_GROUPS.flatMap(g => g.items.map(i => i.key))];

const m = (section: string, name: string, en: string, hot: string, ice: string): MenuItem => ({ name, en, section, hot, ice });
// the shop's real menu (the burnt paper one on the clipboard)
export const DEFAULT_MENU: MenuItem[] = [
  m('Original', '濃縮', 'Espresso', '100', ''),
  m('Original', '馬的濃縮', 'Ma gao espresso', '120', ''),
  m('Original', '康保藍', 'Con Panna', '', '120'),
  m('Original', '短笛', 'Piccolo', '100', ''),
  m('Original', '美式', 'Mericano', '120', '120'),
  m('Coffee late', '拿鐵', 'Late', '120', '130'),
  m('Coffee late', '卡布', 'Cappuccino', '120', '130'),
  m('Coffee late', '平白', 'Flat white', '120', ''),
  m('Coffee late', '香草拿鐵', 'Vanilla latte', '130', '140'),
  m('Coffee late', '榛果拿鐵', 'Hazelnut latte', '130', '140'),
  m('Coffee late', '玫瑰拿鐵', 'Rose latte', '130', '140'),
  m('Coffee late', '摩卡拿鐵', 'Mocha latte', '130', '140'),
  m('Coffee late', '焦糖海鹽', 'Caramel sea salt', '130', '140'),
  m('Coffee late', '凍青瓜拿鐵', 'Ice cucumber latte', '', '140'),
  m('Coffee late', '炙燒黑糖', 'Simmered brown sugar', '150', '150'),
  m('Coffee late', '桂花蜜拿鐵', 'Osmanthus honey latte', '150', '150'),
  m('Something special', '林美如', 'Taiwanese beer with coffee', '', '160'),
  m('Something special', '一起搖擺', 'Ice shake coffee', '', '130'),
  m('Something special', '別害羞', '', '∞', '∞'),
  m('Not coffee', '朱古力', 'Chocolate', '130', '130'),
  m('Not coffee', '青瓜檸檬氣泡', 'Ice cucumber lemon bubble', '', '130'),
];
// the small print at the bottom of the menu
export const MENU_FOOTER = ['低消一人一杯飲品', '不包含糕點', '本店禁帶外食', '恕不提供廁所外借服務'];
// regulars' usual drinks from before the real menu, and what they order now
export const RENAMED_DRINKS: [string, string][] = [['奧利多美式', '美式'], ['夏一布', '卡布'], ['花生拿鐵', '榛果拿鐵'], ['冰維也納', '康保藍'], ['奶昔', '朱古力']];

// the starting dialogue, written into the database by `npm run db:seed`; the café itself only says what's in the database
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
  'owner.closing': ['今天辛苦啦，準備打烊囉～'],
  'owner.opening': ['開店囉！'],

  'customer.arriveRegular': ['{owner}！', '嗨老闆～', '我又來啦'],
  'customer.arriveNew': ['菜單怎麼都是 $???', '哇，這裡可以打 2K？'],
  'customer.orderRegular': ['老樣子，{drink}！', '對，{drink}，謝啦', '一樣一樣～'],
  'customer.orderNew': ['那我要{drink}', '{drink}是什麼？來一杯！'],
  'customer.orderOther': ['今天換{drink}好了', '不要老樣子，來杯{drink}', '我今天想喝{drink}'],
  'customer.takeaway': ['那我外帶好了'],
  'customer.chatTable': ['等等換我打 2K', '吧台公仔又變多了', '漫畫借我看', '這杯真的好喝', '（滑手機）'],
  'customer.chatPorch': ['外面吹風好舒服', '隔壁五金行好熱鬧', '這盆栽是新的嗎', '機車停好近'],
  'customer.smoke': ['來一根', '外面抽比較舒服', '{owner}，菸灰缸借一下'],
  'customer.wantsTv': ['電視空了！我去打一場'],
  'customer.leaveRegular': ['掰掰，明天見！', '走啦，下次再戰', '{owner}掰～'],
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

  'fight.sitDown': ['來打一場快打！', '今天用{fighter}', '手指熱好了'],
  'fight.challenge': ['{opponent}，來單挑！', '選好角色了嗎'],
  'fight.vsCpu': ['先打電腦練連段'],
  'fight.hit': ['中！', '連段來了', '吃我一拳'],
  'fight.special': ['必殺技！', '{fighter}的大絕！', '看招！'],
  'fight.hurt': ['痛痛痛', '防禦啦我', '蛤？'],
  'fight.spectator': ['好連段！', '哇，必殺！', '血快沒了'],
  'fight.ko': ['K.O.！', '完美勝利', '再練練吧'],
  'fight.lose': ['可惡…', '角色相剋啦', '再一場！'],
  'fight.rematch': ['再一場！', '換角色再來'],
};
// texts the first seed wrote before {owner} existed; `db:seed` rewrites these exact rows to the new wording
export const RENAMED_LINES: [string, string, string][] = [
  ['customer.arriveRegular', '小鬍子！', '{owner}！'],
  ['customer.leaveRegular', '小鬍子掰～', '{owner}掰～'],
  ['customer.chatPorch', '騎樓吹風好舒服', '外面吹風好舒服'],
  ['fight.sitDown', '來打一場格鬥！', '來打一場快打！'],
];


// ---------------------------------------------------------------- regulars
// all thirty NBA teams, East then West (the same as profiles.js TEAMS, which has their colours)
export const TEAM_NAMES = ['塞爾提克', '籃網', '尼克', '76人', '暴龍', '公牛', '騎士', '活塞', '溜馬', '公鹿', '老鷹', '黃蜂', '熱火', '魔術', '巫師',
  '金塊', '灰狼', '雷霆', '拓荒者', '爵士', '勇士', '快艇', '湖人', '太陽', '國王', '獨行俠', '火箭', '灰熊', '鵜鶘', '馬刺'];
const look = (skin: number, hair: number, hairStyle: string, shirt: number, pants: number, extra: Partial<Look> = {}): Look => ({ skin, hair, hairStyle, shirt, pants, ...extra });
export const DEFAULT_REGULARS: Regular[] = [
  { name: '阿凱', job: '軟體工程師', drink: '美式', team: '勇士', visits: 214, look: look(0xe0ac80, 0x111111, 'short', 0x1D428A, 0x2b2b2b, { glasses: true, number: '30' }), plays2k: true, playsFight: false, fighter: '', playsTops: false, smokes: false, quirk: '每天下班一定來打一場' },
  { name: '美美', job: '平面設計師', drink: '卡布', team: '湖人', visits: 167, look: look(0xf6d7bd, 0x3b2618, 'long', 0xf1d27a, 0x3a3f5c), plays2k: true, playsFight: true, fighter: '春麗', playsTops: false, smokes: false, quirk: '自稱店內 2K 女王' },
  { name: '大頭', job: '大學生', drink: '榛果拿鐵', team: '公牛', visits: 98, look: look(0xf1c9a5, 0x1b1410, 'short', 0xCE1141, 0x222222, { hat: 'cap', hatColor: 0x111111, number: '23' }), plays2k: true, playsFight: true, fighter: '隆', playsTops: true, smokes: false, quirk: '翹課來打電動' },
  { name: '阿嘉', job: '外送員', drink: '林美如', team: '塞爾提克', visits: 131, look: look(0xc68a5e, 0x111111, 'short', 0x2e8b57, 0x334455), plays2k: false, playsFight: false, fighter: '', playsTops: true, smokes: true, quirk: '送單空檔會在戶外區坐一下' },
  { name: '小胖', job: '研究生', drink: '朱古力', team: '熱火', visits: 76, look: look(0xf1c9a5, 0x3b2618, 'short', 0x98002E, 0x555555, { glasses: true }), plays2k: true, playsFight: true, fighter: '桑吉爾夫', playsTops: true, smokes: false, quirk: '論文寫不出來就來這' },
  { name: 'Jason', job: '隔壁五金行少東', drink: '別害羞', team: '獨行俠', visits: 120, look: look(0xe0ac80, 0x6b4423, 'short', 0xf2f2f2, 0x1f2a44, { longSleeve: true }), plays2k: true, playsFight: false, fighter: '', playsTops: true, smokes: true, quirk: '顧店空檔溜過來' },
  { name: '阿翔', job: '健身教練', drink: '康保藍', team: '金塊', visits: 88, look: look(0x8d5a3b, 0x111111, 'bald', 0x0E2240, 0x111111), plays2k: true, playsFight: true, fighter: '古烈', playsTops: false, smokes: false, quirk: '輸了會去戶外區做伏地挺身' },
  { name: '小雨', job: '插畫家', drink: '拿鐵', team: '公鹿', visits: 143, look: look(0xf6d7bd, 0x111111, 'bun', 0x7fae8b, 0xd9c7a4), plays2k: false, playsFight: false, fighter: '', playsTops: false, smokes: false, quirk: '最愛台式茶杯裡的拉花' },
  { name: '老陳', job: '退休老師', drink: '拿鐵', team: '塞爾提克', visits: 302, look: look(0xe0ac80, 0x8a8a8a, 'short', 0x8b6b4a, 0x4a4a4a, { glasses: true, longSleeve: true }), plays2k: true, playsFight: false, fighter: '', playsTops: false, smokes: false, quirk: '從萬華店就跟過來的元老' },
  { name: '阿德', job: '廚師', drink: '一起搖擺', team: '太陽', visits: 65, look: look(0xd9a27c, 0x1b1410, 'short', 0xE56020, 0x2b2b2b, { hat: 'cap', hatColor: 0x1D1160 }), plays2k: false, playsFight: true, fighter: '肯', playsTops: true, smokes: true, quirk: '休假日整天泡在這' },
  { name: '欣欣', job: '護理師', drink: '榛果拿鐵', team: '尼克', visits: 91, look: look(0xf6d7bd, 0x6b4423, 'long', 0x006BB6, 0x2b2b2b), plays2k: true, playsFight: false, fighter: '', playsTops: false, smokes: false, quirk: '大夜班下班來放鬆' },
  { name: '球哥', job: '前校隊後衛', drink: '林美如', team: '公牛', visits: 188, look: look(0xc68a5e, 0x111111, 'short', 0x111111, 0xCE1141, { number: '1' }), plays2k: true, playsFight: true, fighter: '達爾錫', playsTops: true, smokes: true, quirk: '嘴上說不玩，坐下就不走' },
];

// 快打旋風's fighters, as they're known in Taiwan; the TV draws each one in its own colours (gi, trim, hair) and skin
export const SF_FIGHTERS: { name: string; col: [string, string, string]; skin: string }[] = [
  { name: '隆', col: ['#f4efe3', '#c0282d', '#2a1a10'], skin: '#e0ac80' },
  { name: '肯', col: ['#c0282d', '#1f1c27', '#e8c34a'], skin: '#f1c9a5' },
  { name: '春麗', col: ['#1c4fd6', '#ffd23f', '#2a1a10'], skin: '#f1c9a5' },
  { name: '古烈', col: ['#4f6b3a', '#e8c34a', '#e8c34a'], skin: '#f1c9a5' },
  { name: '桑吉爾夫', col: ['#c0282d', '#ffd23f', '#5a3a22'], skin: '#f1c9a5' },
  { name: '達爾錫', col: ['#e8c34a', '#f08a24', '#1f1c27'], skin: '#8d5a3b' },
  { name: '本田', col: ['#1c4fd6', '#f4efe3', '#111111'], skin: '#e0ac80' },
  { name: '布蘭卡', col: ['#3ddc97', '#f08a24', '#f08a24'], skin: '#3ddc97' },
  { name: '拜森', col: ['#1c4fd6', '#c0282d', '#111111'], skin: '#8d5a3b' },
  { name: '巴洛克', col: ['#9b6bff', '#c9c9c9', '#2a1a10'], skin: '#f1c9a5' },
  { name: '沙加特', col: ['#f08a24', '#f4efe3', '#1f1c27'], skin: '#c68a5e' },
  { name: '維加', col: ['#c0282d', '#ffd23f', '#1f1c27'], skin: '#e0ac80' },
];
export const FIGHTER_NAMES = SF_FIGHTERS.map(f => f.name);

export const DEFAULT_OWNER: Owner = {
  name: '小鬍子', job: '老闆兼咖啡師，拉花和雕花是招牌',
  look: look(0xe0ac80, 0x1b1410, 'long', 0x1e1e22, 0x1f1f1f, { facialHair: 'both', hat: 'beanie', hatColor: 0xd08a1e, glasses: 'square', longSleeve: true }),
};

// ---------------------------------------------------------------- first-timers' random values
export const POOLS: { key: PoolKey; label: string; hint: string }[] = [
  { key: 'surname', label: '姓氏', hint: '名字 = 姓氏 + 稱呼，例如「陳」+「小姐」' },
  { key: 'titleF', label: '女性稱呼', hint: '用這些稱呼的客人是女生的打扮' },
  { key: 'titleM', label: '男性稱呼', hint: '用這些稱呼的客人是男生的打扮' },
  { key: 'job', label: '身分', hint: '新客資料卡上的「職業」' },
];
export const POOL_KEYS = POOLS.map(p => p.key);
export const DEFAULT_POOLS: RandomPools = {
  surname: ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊'],
  titleF: ['小姐'],
  titleM: ['先生'],
  job: ['路過的上班族', '觀光客', '附近的學生', '看 IG 找來的', '朋友推薦來的', '來買五金順便的'],
};

export const DEFAULT_CONTENT: CafeContent = { menu: DEFAULT_MENU, lines: DEFAULT_LINES, owner: DEFAULT_OWNER, regulars: DEFAULT_REGULARS, pools: DEFAULT_POOLS };
