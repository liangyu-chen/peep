// Everything the café says and sells that the back office can edit.
// The 3D scene reads this shape; the database stores the same thing as rows.

// one line of the paper menu. hot / ice are what's printed in those columns: a price like '120', or '∞', '???'…;
// empty means that version isn't served. Iced drinks come in a tall glass, hot ones in a Taiwanese tea cup.
export type MenuItem = { name: string; en: string; section: string; hot: string; ice: string };
export const MENU_SECTIONS = ['Original', 'Coffee late', 'Something special', 'Not coffee'];

// how a person looks; colours are 0xRRGGBB numbers. Face fields left out are filled in by faceOf().
// Anything the editor doesn't know (long sleeves…) is kept as it is.
export type Look = {
  skin: number; hair: number; hairStyle: string; shirt: number; pants: number;
  number?: string; longSleeve?: boolean;
  hat?: string; hatColor?: number;             // a hat worn over whatever the hair is (older looks: hairStyle 'cap'/'bucket' + cap, or beanie)
  hairLength?: string; hairCurl?: string; hairFront?: string; hairTie?: string;   // the hair, chosen part by part (older looks: hairStyle alone)
  bottom?: string; pantsFit?: string;          // pants or a skirt (in the pants colour), and how wide the pants are
  topFit?: string;                             // how the top is cut: slim, regular or oversize
  glasses?: boolean | string;                  // older looks stored true for square frames
  faceShape?: string; eyes?: string; eyeColor?: number; brows?: string; nose?: string; mouth?: string;
  facialHair?: string; blush?: boolean;
  [k: string]: unknown;
};
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
export const TEAM_NAMES = ['湖人', '勇士', '塞爾提克', '公牛', '熱火', '獨行俠', '金塊', '公鹿', '太陽', '尼克'];
type Option = { value: string; label: string };
// hair is chosen part by part: how long, straight or curly, what it does at the forehead, and whether it's tied up
export const HAIR: Record<'length' | 'curl' | 'front' | 'tie', Option[]> = {
  length: [{ value: 'bald', label: '光頭' }, { value: 'buzz', label: '平頭' }, { value: 'short', label: '短髮' }, { value: 'bob', label: '短長髮' }, { value: 'medium', label: '中長髮' }, { value: 'long', label: '長髮' }],
  curl: [{ value: 'straight', label: '直髮' }, { value: 'curly', label: '捲髮' }, { value: 'spiky', label: '刺蝟頭' }],
  front: [{ value: 'none', label: '無瀏海' }, { value: 'bangs', label: '瀏海' }, { value: 'center', label: '中分' }, { value: 'side', label: '旁分' }],
  tie: [{ value: 'none', label: '不綁' }, { value: 'ponytail', label: '馬尾' }, { value: 'bun', label: '包頭' }],
};
export type Hair = { length: string; curl: string; front: string; tie: string };
// what each of the older single hairstyles was, part by part
const HAIR_FROM_STYLE: Record<string, Hair> = {
  bald: { length: 'bald', curl: 'straight', front: 'none', tie: 'none' },
  buzz: { length: 'buzz', curl: 'straight', front: 'none', tie: 'none' },
  short: { length: 'short', curl: 'straight', front: 'none', tie: 'none' },
  side: { length: 'short', curl: 'straight', front: 'side', tie: 'none' },
  spiky: { length: 'short', curl: 'spiky', front: 'none', tie: 'none' },
  curly: { length: 'short', curl: 'curly', front: 'none', tie: 'none' },
  medium: { length: 'medium', curl: 'straight', front: 'center', tie: 'none' },
  long: { length: 'long', curl: 'straight', front: 'bangs', tie: 'none' },
  longCurly: { length: 'long', curl: 'curly', front: 'bangs', tie: 'none' },
  bun: { length: 'medium', curl: 'straight', front: 'bangs', tie: 'bun' },
  ponytail: { length: 'long', curl: 'straight', front: 'bangs', tie: 'ponytail' },
  cap: { length: 'short', curl: 'straight', front: 'none', tie: 'none' },
  bucket: { length: 'short', curl: 'straight', front: 'none', tie: 'none' },
};
const hairValid = (key: keyof typeof HAIR, v: unknown) => typeof v === 'string' && HAIR[key].some(o => o.value === v);
// a look's hair, part by part: what's stored, or what its older single hairstyle meant
export function hairOf(look: Look): Hair {
  const old = HAIR_FROM_STYLE[look.hairStyle] ?? HAIR_FROM_STYLE.short;
  return {
    length: hairValid('length', look.hairLength) ? (look.hairLength as string) : old.length,
    curl: hairValid('curl', look.hairCurl) ? (look.hairCurl as string) : old.curl,
    front: hairValid('front', look.hairFront) ? (look.hairFront as string) : old.front,
    tie: hairValid('tie', look.hairTie) ? (look.hairTie as string) : old.tie,
  };
}
// a short description, like 長髮・捲髮・瀏海・馬尾
export function hairLabel(h: Hair): string {
  const l = (key: keyof typeof HAIR, v: string) => HAIR[key].find(o => o.value === v)?.label ?? v;
  if (h.length === 'bald' || h.length === 'buzz') return l('length', h.length);
  return [l('length', h.length), h.curl !== 'straight' && l('curl', h.curl), h.front !== 'none' && l('front', h.front), h.tie !== 'none' && l('tie', h.tie)].filter(Boolean).join('・');
}
// what's worn below the waist: pants or a skirt, and for pants how wide they are
export const CLOTHES: Record<'bottom' | 'fit' | 'top' | 'sleeve', Option[]> = {
  bottom: [{ value: 'pants', label: '褲子' }, { value: 'skirt', label: '裙子' }],
  fit: [{ value: 'slim', label: '窄管' }, { value: 'regular', label: '一般' }, { value: 'wide', label: '寬褲' }],
  top: [{ value: 'slim', label: '合身' }, { value: 'regular', label: '一般' }, { value: 'oversize', label: '寬鬆' }],   // how the top is cut
  sleeve: [{ value: 'short', label: '短袖' }, { value: 'long', label: '長袖' }],
};
const clothesValid = (key: keyof typeof CLOTHES, v: unknown) => typeof v === 'string' && CLOTHES[key].some(o => o.value === v);
export function clothesOf(look: Look): { bottom: string; fit: string; top: string; sleeve: string } {
  return {
    bottom: clothesValid('bottom', look.bottom) ? (look.bottom as string) : 'pants', fit: clothesValid('fit', look.pantsFit) ? (look.pantsFit as string) : 'regular',
    top: clothesValid('top', look.topFit) ? (look.topFit as string) : 'regular', sleeve: look.longSleeve ? 'long' : 'short',
  };
}
// a hat is its own choice, put on over the hair
export const HAT_STYLES: Option[] = [
  { value: 'none', label: '不戴' }, { value: 'cap', label: '棒球帽' }, { value: 'bucket', label: '漁夫帽' }, { value: 'beanie', label: '毛帽' },
];
const HAT_COLOR: Record<string, number> = { cap: 0xf08a24, bucket: 0x2f2f2f, beanie: 0xd08a1e };
// the hat of a look, reading the older ways hats were stored: as a hairstyle (with its colour in `cap`, short hair
// under it) or as a beanie colour
export function hatOf(look: Look): { hat: string; color: number } {
  const hat = HAT_STYLES.some(h => h.value === look.hat) ? (look.hat as string)
    : look.hairStyle === 'cap' || look.hairStyle === 'bucket' ? look.hairStyle
    : typeof look.beanie === 'number' ? 'beanie' : 'none';
  const color = typeof look.hatColor === 'number' ? look.hatColor
    : look.hat == null && (look.hairStyle === 'cap' || look.hairStyle === 'bucket') && typeof look.cap === 'number' ? look.cap
    : look.hat == null && typeof look.beanie === 'number' ? look.beanie : HAT_COLOR[hat] ?? 0xd08a1e;
  return { hat, color };
}

// ---------------------------------------------------------------- faces (捏臉)
export const FACE: Record<'faceShape' | 'eyes' | 'brows' | 'nose' | 'mouth' | 'facialHair' | 'beard' | 'glasses', Option[]> = {
  faceShape: [{ value: 'round', label: '圓臉' }, { value: 'oval', label: '鵝蛋臉' }, { value: 'square', label: '方臉' }, { value: 'long', label: '長臉' }],
  eyes: [{ value: 'round', label: '圓眼' }, { value: 'big', label: '大眼' }, { value: 'dot', label: '豆豆眼' }, { value: 'sleepy', label: '睏睏眼' }, { value: 'smile', label: '笑眼' }, { value: 'narrow', label: '瞇瞇眼' }],
  brows: [{ value: 'thin', label: '細眉' }, { value: 'thick', label: '粗眉' }, { value: 'angry', label: '劍眉' }, { value: 'worried', label: '八字眉' }, { value: 'none', label: '無' }],
  nose: [{ value: 'small', label: '小鼻子' }, { value: 'normal', label: '一般' }, { value: 'big', label: '大鼻子' }, { value: 'button', label: '圓鼻頭' }, { value: 'none', label: '無' }],
  mouth: [{ value: 'smile', label: '微笑' }, { value: 'grin', label: '露齒笑' }, { value: 'smirk', label: '壞笑' }, { value: 'flat', label: '面無表情' }, { value: 'open', label: '張嘴' }],
  facialHair: [{ value: 'none', label: '無' }, { value: 'stubble', label: '鬍渣' }, { value: 'mustache', label: '八字鬍' }, { value: 'goatee', label: '山羊鬍' }, { value: 'both', label: '八字鬍＋山羊鬍' }, { value: 'full', label: '落腮鬍' }],
  beard: [{ value: 'light', label: '淡' }, { value: 'normal', label: '一般' }, { value: 'thick', label: '濃' }],   // how dense the facial hair is
  glasses: [{ value: 'none', label: '無' }, { value: 'round', label: '圓框' }, { value: 'square', label: '方框' }, { value: 'sun', label: '墨鏡' }],
};
export type Face = { faceShape: string; eyes: string; brows: string; nose: string; mouth: string; facialHair: string; beard: string; glasses: string; blush: boolean; eyeColor: number };

// a stable pick per person, so someone whose face was never edited still looks the same every visit
function seeded<T>(seed: string, salt: number, list: T[]) {
  let h = 2166136261 ^ salt;
  for (const ch of seed) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return list[(h >>> 0) % list.length];
}
const valid = (key: keyof typeof FACE, v: unknown) => typeof v === 'string' && FACE[key].some(o => o.value === v);

// the full face for a look: what's stored, or a stable default from the person's name
export function faceOf(look: Look, seed = ''): Face {
  const oldHair = look.mustache && look.goatee ? 'both' : look.mustache ? 'mustache' : look.goatee ? 'goatee' : 'none';
  const pickOr = (key: keyof typeof FACE, salt: number, natural: string[]) => (valid(key, look[key]) ? (look[key] as string) : seeded(seed, salt, natural));
  return {
    faceShape: pickOr('faceShape', 1, ['round', 'oval', 'round', 'square', 'long']),
    eyes: pickOr('eyes', 2, ['round', 'round', 'big', 'dot', 'sleepy', 'smile']),
    brows: pickOr('brows', 3, ['thin', 'thick', 'thin', 'worried', 'angry']),
    nose: pickOr('nose', 4, ['small', 'normal', 'small', 'button']),
    mouth: pickOr('mouth', 5, ['smile', 'smile', 'grin', 'smirk', 'flat']),
    facialHair: valid('facialHair', look.facialHair) ? (look.facialHair as string) : oldHair,
    beard: valid('beard', look.beard) ? (look.beard as string) : 'normal',
    glasses: valid('glasses', look.glasses) ? (look.glasses as string) : look.glasses === true ? 'square' : 'none',
    blush: !!look.blush,
    eyeColor: typeof look.eyeColor === 'number' ? look.eyeColor : 0x2a1a10,
  };
}

// a look from the editor's form fields (get returns a field's value); fields it doesn't cover are kept from prev
export function parseLook(get: (k: string) => string | null, prev?: Look): Look {
  const base: Look = prev ?? { skin: 0xe0ac80, hair: 0x111111, hairStyle: 'short', shirt: 0x7fae8b, pants: 0x2b2b2b };
  const hex = (k: string, fallback: number) => { const v = get(k) ?? ''; return /^#[0-9a-f]{6}$/i.test(v) ? parseInt(v.slice(1), 16) : fallback; };
  const opt = (k: keyof typeof FACE, fallback: string) => { const v = get(k); return valid(k, v) ? (v as string) : fallback; };
  const face = faceOf(base, String(get('name') ?? ''));
  const hairNow = hairOf(base), hairPart = (key: keyof typeof HAIR, field: string, now: string) => { const v = get(field); return hairValid(key, v) ? (v as string) : now; };
  const hatNow = hatOf(base), hat = get('hat') ?? hatNow.hat;
  const clothesNow = clothesOf(base), clothesPart = (key: keyof typeof CLOTHES, field: string, now: string) => { const v = get(field); return clothesValid(key, v) ? (v as string) : now; };
  const number = (get('number') ?? '').trim().slice(0, 2);
  const look: Look = {
    ...base,
    skin: hex('skin', base.skin), hair: hex('hair', base.hair), shirt: hex('shirt', base.shirt), pants: hex('pants', base.pants),
    hairLength: hairPart('length', 'hairLength', hairNow.length), hairCurl: hairPart('curl', 'hairCurl', hairNow.curl),
    hairFront: hairPart('front', 'hairFront', hairNow.front), hairTie: hairPart('tie', 'hairTie', hairNow.tie),
    bottom: clothesPart('bottom', 'bottom', clothesNow.bottom), pantsFit: clothesPart('fit', 'pantsFit', clothesNow.fit),
    topFit: clothesPart('top', 'topFit', clothesNow.top), longSleeve: clothesPart('sleeve', 'sleeve', clothesNow.sleeve) === 'long',
    hat: HAT_STYLES.some(h => h.value === hat) ? hat : 'none', hatColor: hex('hatColor', hatNow.color),
    faceShape: opt('faceShape', face.faceShape), eyes: opt('eyes', face.eyes), brows: opt('brows', face.brows),
    nose: opt('nose', face.nose), mouth: opt('mouth', face.mouth), facialHair: opt('facialHair', face.facialHair), beard: opt('beard', face.beard),
    glasses: opt('glasses', face.glasses), eyeColor: hex('eyeColor', face.eyeColor), blush: get('blush') === 'on',
  };
  delete look.mustache; delete look.goatee;   // superseded by facialHair
  delete look.beanie; delete look.cap;          // superseded by hat / hatColor
  if (number) look.number = number; else delete look.number;
  return look;
}
export const SKIN_TONES = [
  { value: 0xfbe3cf, label: '粉白' }, { value: 0xf6d7bd, label: '白皙' }, { value: 0xf1c9a5, label: '偏白' }, { value: 0xe0ac80, label: '自然' },
  { value: 0xd9a27c, label: '小麥' }, { value: 0xc68a5e, label: '黝黑' }, { value: 0x8d5a3b, label: '深色' }, { value: 0x6b4430, label: '深棕' },
];
// swatches next to each colour field in the editor
export const COLOR_PRESETS: Record<'skin' | 'hair' | 'eyes' | 'clothes', { value: number; label: string }[]> = {
  skin: SKIN_TONES,
  hair: [
    { value: 0x111111, label: '黑' }, { value: 0x2b1d14, label: '深棕' }, { value: 0x5a3a22, label: '棕' }, { value: 0x8a5a2b, label: '栗色' },
    { value: 0xc9a25a, label: '金' }, { value: 0x8a8a8a, label: '灰' }, { value: 0xe8e4dc, label: '白' }, { value: 0xa8323a, label: '紅' },
    { value: 0x2f5fb3, label: '藍' }, { value: 0xe87aa8, label: '粉紅' },
  ],
  eyes: [
    { value: 0x2a1a10, label: '深棕' }, { value: 0x5a3a20, label: '棕' }, { value: 0x7a6030, label: '琥珀' },
    { value: 0x3a6ea8, label: '藍' }, { value: 0x3f7a4a, label: '綠' }, { value: 0x6a6f78, label: '灰' },
  ],
  clothes: [
    { value: 0xf2f2f2, label: '白' }, { value: 0x1e1e22, label: '黑' }, { value: 0x7a7d82, label: '灰' }, { value: 0x334455, label: '深藍灰' },
    { value: 0x1d428a, label: '寶藍' }, { value: 0x7ec8ff, label: '天藍' }, { value: 0xce1141, label: '紅' }, { value: 0xe56020, label: '橘' },
    { value: 0xf1d27a, label: '鵝黃' }, { value: 0x2e8b57, label: '綠' }, { value: 0x7fae8b, label: '薄荷' }, { value: 0x8b6b4a, label: '咖啡' },
    { value: 0xd9c7a4, label: '卡其' }, { value: 0x9b6bff, label: '紫' }, { value: 0xff8fb0, label: '粉紅' },
  ],
};
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
