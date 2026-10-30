// Everything the café says and sells that the back office can edit.
// The 3D scene reads this shape; the database stores the same thing as rows.

export type MenuItem = {
  name: string;
  price: number | null;   // null shows as $??? on the paper menu, like the real one
  iced: boolean;          // iced drinks come in a tall glass, hot ones in a Taiwanese tea cup
};

// how a person looks; colours are 0xRRGGBB numbers. Face fields left out are filled in by faceOf().
// Anything the editor doesn't know (cap colour, long sleeves…) is kept as it is.
export type Look = {
  skin: number; hair: number; hairStyle: string; shirt: number; pants: number;
  number?: string; cap?: number; longSleeve?: boolean;
  glasses?: boolean | string;                  // older looks stored true for square frames
  faceShape?: string; eyes?: string; eyeColor?: number; brows?: string; nose?: string; mouth?: string;
  facialHair?: string; blush?: boolean;
  [k: string]: unknown;
};
export type Regular = { name: string; job: string; drink: string; team: string; visits: number; quirk: string; look: Look };

// the values first-time customers are made from: name = surname + title (the title decides their look), plus a job
export type RandomPools = { surname: string[]; titleF: string[]; titleM: string[]; job: string[] };
export type PoolKey = keyof RandomPools;

export type CafeContent = {
  menu: MenuItem[];
  lines: Record<string, string[]>;
  regulars: Regular[];
  pools: RandomPools;
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

// ---------------------------------------------------------------- regulars
export const TEAM_NAMES = ['湖人', '勇士', '塞爾提克', '公牛', '熱火', '獨行俠', '金塊', '公鹿', '太陽', '尼克'];
type Option = { value: string; label: string };
export const HAIR_STYLES: Option[] = [
  { value: 'short', label: '短髮' }, { value: 'buzz', label: '平頭' }, { value: 'side', label: '旁分' },
  { value: 'spiky', label: '刺蝟頭' }, { value: 'curly', label: '捲髮' }, { value: 'long', label: '長髮' },
  { value: 'ponytail', label: '馬尾' }, { value: 'bun', label: '包頭' },
  { value: 'cap', label: '棒球帽' }, { value: 'bucket', label: '漁夫帽' }, { value: 'bald', label: '光頭' },
];

// ---------------------------------------------------------------- faces (捏臉)
export const FACE: Record<'faceShape' | 'eyes' | 'brows' | 'nose' | 'mouth' | 'facialHair' | 'glasses', Option[]> = {
  faceShape: [{ value: 'round', label: '圓臉' }, { value: 'oval', label: '鵝蛋臉' }, { value: 'square', label: '方臉' }, { value: 'long', label: '長臉' }],
  eyes: [{ value: 'round', label: '圓眼' }, { value: 'big', label: '大眼' }, { value: 'dot', label: '豆豆眼' }, { value: 'sleepy', label: '睏睏眼' }, { value: 'smile', label: '笑眼' }, { value: 'narrow', label: '瞇瞇眼' }],
  brows: [{ value: 'thin', label: '細眉' }, { value: 'thick', label: '粗眉' }, { value: 'angry', label: '劍眉' }, { value: 'worried', label: '八字眉' }, { value: 'none', label: '無' }],
  nose: [{ value: 'small', label: '小鼻子' }, { value: 'normal', label: '一般' }, { value: 'big', label: '大鼻子' }, { value: 'button', label: '圓鼻頭' }, { value: 'none', label: '無' }],
  mouth: [{ value: 'smile', label: '微笑' }, { value: 'grin', label: '露齒笑' }, { value: 'smirk', label: '壞笑' }, { value: 'flat', label: '面無表情' }, { value: 'open', label: '張嘴' }],
  facialHair: [{ value: 'none', label: '無' }, { value: 'stubble', label: '鬍渣' }, { value: 'mustache', label: '八字鬍' }, { value: 'goatee', label: '山羊鬍' }, { value: 'both', label: '八字鬍＋山羊鬍' }, { value: 'full', label: '落腮鬍' }],
  glasses: [{ value: 'none', label: '無' }, { value: 'round', label: '圓框' }, { value: 'square', label: '方框' }, { value: 'sun', label: '墨鏡' }],
};
export type Face = { faceShape: string; eyes: string; brows: string; nose: string; mouth: string; facialHair: string; glasses: string; blush: boolean; eyeColor: number };

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
  const hairStyle = get('hairStyle') ?? '';
  const number = (get('number') ?? '').trim().slice(0, 2);
  const look: Look = {
    ...base,
    skin: hex('skin', base.skin), hair: hex('hair', base.hair), shirt: hex('shirt', base.shirt), pants: hex('pants', base.pants),
    hairStyle: HAIR_STYLES.some(h => h.value === hairStyle) ? hairStyle : base.hairStyle,
    faceShape: opt('faceShape', face.faceShape), eyes: opt('eyes', face.eyes), brows: opt('brows', face.brows),
    nose: opt('nose', face.nose), mouth: opt('mouth', face.mouth), facialHair: opt('facialHair', face.facialHair),
    glasses: opt('glasses', face.glasses), eyeColor: hex('eyeColor', face.eyeColor), blush: get('blush') === 'on',
  };
  delete look.mustache; delete look.goatee;   // superseded by facialHair
  if (number) look.number = number; else delete look.number;
  return look;
}
export const SKIN_TONES = [
  { value: 0xf6d7bd, label: '白皙' }, { value: 0xf1c9a5, label: '偏白' }, { value: 0xe0ac80, label: '自然' },
  { value: 0xd9a27c, label: '小麥' }, { value: 0xc68a5e, label: '黝黑' }, { value: 0x8d5a3b, label: '深色' },
];
const look = (skin: number, hair: number, hairStyle: string, shirt: number, pants: number, extra: Partial<Look> = {}): Look => ({ skin, hair, hairStyle, shirt, pants, ...extra });
export const DEFAULT_REGULARS: Regular[] = [
  { name: '阿凱', job: '軟體工程師', drink: '奧利多美式', team: '勇士', visits: 214, look: look(0xe0ac80, 0x111111, 'short', 0x1D428A, 0x2b2b2b, { glasses: true, number: '30' }), quirk: '每天下班一定來打一場' },
  { name: '美美', job: '平面設計師', drink: '夏一布', team: '湖人', visits: 167, look: look(0xf6d7bd, 0x3b2618, 'long', 0xf1d27a, 0x3a3f5c), quirk: '自稱店內 2K 女王' },
  { name: '大頭', job: '大學生', drink: '花生拿鐵', team: '公牛', visits: 98, look: look(0xf1c9a5, 0x1b1410, 'cap', 0xCE1141, 0x222222, { cap: 0x111111, number: '23' }), quirk: '翹課來打電動' },
  { name: '阿嘉', job: '外送員', drink: '林美如', team: '塞爾提克', visits: 131, look: look(0xc68a5e, 0x111111, 'short', 0x2e8b57, 0x334455), quirk: '送單空檔會在騎樓坐一下' },
  { name: '小胖', job: '研究生', drink: '奶昔', team: '熱火', visits: 76, look: look(0xf1c9a5, 0x3b2618, 'short', 0x98002E, 0x555555, { glasses: true }), quirk: '論文寫不出來就來這' },
  { name: 'Jason', job: '隔壁五金行少東', drink: '別害羞', team: '獨行俠', visits: 120, look: look(0xe0ac80, 0x6b4423, 'short', 0xf2f2f2, 0x1f2a44, { longSleeve: true }), quirk: '顧店空檔溜過來' },
  { name: '阿翔', job: '健身教練', drink: '冰維也納', team: '金塊', visits: 88, look: look(0x8d5a3b, 0x111111, 'bald', 0x0E2240, 0x111111), quirk: '輸了會去騎樓做伏地挺身' },
  { name: '小雨', job: '插畫家', drink: '拿鐵', team: '公鹿', visits: 143, look: look(0xf6d7bd, 0x111111, 'bun', 0x7fae8b, 0xd9c7a4), quirk: '最愛台式茶杯裡的拉花' },
  { name: '老陳', job: '退休老師', drink: '拿鐵', team: '塞爾提克', visits: 302, look: look(0xe0ac80, 0x8a8a8a, 'short', 0x8b6b4a, 0x4a4a4a, { glasses: true, longSleeve: true }), quirk: '從萬華店就跟過來的元老' },
  { name: '阿德', job: '廚師', drink: '一起搖擺', team: '太陽', visits: 65, look: look(0xd9a27c, 0x1b1410, 'cap', 0xE56020, 0x2b2b2b, { cap: 0x1D1160 }), quirk: '休假日整天泡在這' },
  { name: '欣欣', job: '護理師', drink: '花生拿鐵', team: '尼克', visits: 91, look: look(0xf6d7bd, 0x6b4423, 'long', 0x006BB6, 0x2b2b2b), quirk: '大夜班下班來放鬆' },
  { name: '球哥', job: '前校隊後衛', drink: '林美如', team: '公牛', visits: 188, look: look(0xc68a5e, 0x111111, 'short', 0x111111, 0xCE1141, { number: '1' }), quirk: '嘴上說不玩，坐下就不走' },
];

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

export const DEFAULT_CONTENT: CafeContent = { menu: DEFAULT_MENU, lines: DEFAULT_LINES, regulars: DEFAULT_REGULARS, pools: DEFAULT_POOLS };
