// 捏臉: everything about how a person looks — the shape of the data (Look), every option the back office offers, how
// each part is read from a stored look (older looks included, so nothing saved ever breaks), and parseLook(), which
// reads the editor's form back into a look. The 3D body (src/cafe/body.js) and the editor (app/admin/(panel)/LookFields)
// both work from this. catalog.ts re-exports it all, so `@/src/content/catalog` still has everything.
//
// In the editor's order: 身形與臉 · 髮型 · 配戴 · 穿著 · 顏色 · parseLook.

// how a person looks; colours are 0xRRGGBB numbers. Anything left out is filled in by the xxxOf() readers below (the
// face from a stable pick by name). Anything the editor doesn't know is kept as it is.
export type Look = {
  skin: number; hair: number; hairStyle: string; shirt: number; pants: number;
  build?: string;                                                              // 身形
  height?: string;                                                             // 身高
  faceShape?: string; eyes?: string; eyeColor?: number; brows?: string; nose?: string; mouth?: string;
  facialHair?: string; beard?: string; blush?: boolean;
  hairLength?: string; hairCurl?: string; hairFront?: string; hairTie?: string;   // the hair part by part (older looks: hairStyle alone)
  hairCm?: number;   // set with the length's − / +: how far it hangs below the head, in cm (0 is 短髮); its band sets hairLength
  tieColor?: number;                                                           // the ponytail's hair tie
  hat?: string; hatColor?: number;                                             // (older looks: hairStyle 'cap'/'bucket' + cap, or beanie)
  glasses?: boolean | string; glassesShape?: string; frameColor?: number;      // (older looks: true, 'round' or 'square' black frames)
  lensColor?: number; lensOpacity?: number;                                    // 鏡片: its tint and how solid it is (0-1)
  earL?: string; earR?: string;
  tattoos?: Record<string, string>; tattooText?: string;                       // a style per part (older looks: tattoo + tattooCover)
  companion?: string;
  topStyle?: string; topPattern?: string; topFit?: string; longSleeve?: boolean; number?: string;   // T恤, 襯衫 or a winter top, its cut, its sleeves
  bottom?: string; pantsFit?: string;                                          // pants, shorts or a skirt (in the pants colour), and how wide
  shoeStyle?: string; shoe?: number; socks?: string; sock?: number;
  [k: string]: unknown;
};

export type Option = { value: string; label: string };
const isIn = (opts: Option[], v: unknown): v is string => typeof v === 'string' && opts.some(o => o.value === v);
const pickIn = (opts: Option[], v: unknown, fallback: string) => (isIn(opts, v) ? v : fallback);


// ================================================================ 身形與臉

// 身形: five builds, thin to heavy
export const BUILDS: Option[] = [{ value: 'thin', label: '瘦' }, { value: 'slim', label: '偏瘦' }, { value: 'regular', label: '標準' }, { value: 'stocky', label: '壯' }, { value: 'heavy', label: '胖' }];
export const buildOf = (look: Look) => pickIn(BUILDS, look.build, 'regular');
// how tall: the body (legs and all) longer or shorter, the head its own size
export const HEIGHTS: Option[] = [{ value: 'xshort', label: '很矮' }, { value: 'short', label: '矮' }, { value: 'regular', label: '標準' }, { value: 'tall', label: '高' }, { value: 'xtall', label: '很高' }];
export const heightOf = (look: Look) => pickIn(HEIGHTS, look.height, 'regular');

export const FACE: Record<'faceShape' | 'eyes' | 'brows' | 'nose' | 'mouth' | 'facialHair' | 'beard' | 'glasses' | 'glassesShape', Option[]> = {
  faceShape: [{ value: 'round', label: '圓臉' }, { value: 'oval', label: '鵝蛋臉' }, { value: 'heart', label: '心形臉' }, { value: 'square', label: '方臉' }, { value: 'long', label: '長臉' }],
  eyes: [{ value: 'round', label: '圓眼' }, { value: 'big', label: '大眼' }, { value: 'dot', label: '豆豆眼' }, { value: 'sparkle', label: '閃亮眼' },
    { value: 'almond', label: '杏眼' }, { value: 'phoenix', label: '鳳眼' }, { value: 'droopy', label: '下垂眼' },
    { value: 'sleepy', label: '睏睏眼' }, { value: 'narrow', label: '瞇瞇眼' }, { value: 'deadpan', label: '死魚眼' }, { value: 'smile', label: '笑眼' }, { value: 'wink', label: '眨眼' }],
  brows: [{ value: 'thin', label: '細眉' }, { value: 'thick', label: '粗眉' }, { value: 'bushy', label: '濃眉' },
    { value: 'straight', label: '一字眉' }, { value: 'short', label: '短眉' }, { value: 'unibrow', label: '連心眉' },
    { value: 'arched', label: '挑眉' }, { value: 'raised', label: '單挑眉' }, { value: 'angry', label: '劍眉' }, { value: 'worried', label: '八字眉' }, { value: 'none', label: '無' }],
  nose: [{ value: 'small', label: '小鼻子' }, { value: 'button', label: '圓鼻頭' }, { value: 'normal', label: '一般' }, { value: 'big', label: '大鼻子' }, { value: 'none', label: '無' }],
  mouth: [{ value: 'smile', label: '微笑' }, { value: 'grin', label: '露齒笑' }, { value: 'smirk', label: '壞笑' }, { value: 'flat', label: '面無表情' }, { value: 'open', label: '張嘴' }, { value: 'jianzhi', label: '健誌嘴巴' }],
  facialHair: [{ value: 'none', label: '無' }, { value: 'stubble', label: '鬍渣' }, { value: 'mustache', label: '八字鬍' }, { value: 'goatee', label: '山羊鬍' }, { value: 'both', label: '八字鬍＋山羊鬍' }, { value: 'full', label: '落腮鬍' }],
  beard: [{ value: 'light', label: '淡' }, { value: 'normal', label: '一般' }, { value: 'thick', label: '濃' }],   // how dense the facial hair is
  // (配戴, but read with the face: the frame, and its shape on its own; 阿亮眼鏡 always its own round)
  glasses: [{ value: 'none', label: '無' }, { value: 'frame', label: '黑框' }, { value: 'browline', label: '眉框' },
    { value: 'metal', label: '金屬框' }, { value: 'rimless', label: '無框' }, { value: 'aliang', label: '阿亮眼鏡' }],
  glassesShape: [{ value: 'round', label: '圓框' }, { value: 'oval', label: '橢圓框' },
    { value: 'square', label: '方框' }, { value: 'rectangle', label: '長方框' }, { value: 'wayfarer', label: '威靈頓框' },
    { value: 'catEye', label: '貓眼框' }, { value: 'aviator', label: '飛行員框' },
    { value: 'hexagon', label: '六角框' }, { value: 'octagon', label: '八角框' }, { value: 'diamond', label: '菱形框' }],
};
export type Face = { faceShape: string; eyes: string; brows: string; nose: string; mouth: string; facialHair: string; beard: string; glasses: string; glassesShape: string; blush: boolean; eyeColor: number };

// a stable pick per person, so someone whose face was never edited still looks the same every visit
function seeded<T>(seed: string, salt: number, list: T[]) {
  let h = 2166136261 ^ salt;
  for (const ch of seed) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return list[(h >>> 0) % list.length];
}
const validFace = (key: keyof typeof FACE, v: unknown): v is string => isIn(FACE[key], v);

// the full face for a look: what's stored, or a stable default from the person's name
export function faceOf(look: Look, seed = ''): Face {
  const oldHair = look.mustache && look.goatee ? 'both' : look.mustache ? 'mustache' : look.goatee ? 'goatee' : 'none';
  const frames: unknown = look.glasses;   // (true or a frame's name, from any era)
  const pickOr = (key: keyof typeof FACE, salt: number, natural: string[]) => { const v = look[key]; return validFace(key, v) ? v : seeded(seed, salt, natural); };
  return {
    faceShape: pickOr('faceShape', 1, ['round', 'oval', 'round', 'square', 'long']),
    eyes: pickOr('eyes', 2, ['round', 'round', 'big', 'dot', 'sleepy', 'smile', 'almond', 'phoenix', 'droopy']),
    brows: pickOr('brows', 3, ['thin', 'thick', 'thin', 'worried', 'angry', 'arched', 'straight', 'short']),
    nose: pickOr('nose', 4, ['small', 'normal', 'small', 'button']),
    mouth: pickOr('mouth', 5, ['smile', 'smile', 'grin', 'smirk', 'flat']),
    facialHair: validFace('facialHair', look.facialHair) ? look.facialHair : oldHair,
    beard: validFace('beard', look.beard) ? look.beard : 'normal',
    // (older looks stored the shape in the frame: 'round' / 'square' black frames, true for square; sunglasses were square)
    // (the first take on the new frames used catEye / aviator / octagon as a frame; they are shapes now)
    glasses: frames === 'metalSilver' ? 'metal'
      : validFace('glasses', frames) ? frames : frames === 'round' || frames === 'square' || frames === true || frames === 'sun' ||
      frames === 'catEye' || frames === 'aviator' || frames === 'octagon' ? 'frame' : 'none',
    glassesShape: frames === 'catEye' || frames === 'aviator' || frames === 'octagon' ? frames
      : validFace('glassesShape', look.glassesShape) ? look.glassesShape : frames === 'round' || frames === 'metal' || frames === 'metalSilver' ? 'round' : 'square',
    blush: !!look.blush,
    eyeColor: typeof look.eyeColor === 'number' ? look.eyeColor : 0x2a1a10,
  };
}


// ================================================================ 髮型

// hair is chosen part by part: how long, straight or curly, what it does at the forehead, and whether it's tied up
export const HAIR: Record<'length' | 'curl' | 'front' | 'tie', Option[]> = {
  length: [{ value: 'bald', label: '光頭' }, { value: 'buzz', label: '平頭' }, { value: 'mushroom', label: '蘑菇頭' }, { value: 'azhi', label: '阿志頭' },
    { value: 'spiky', label: '刺蝟頭' }, { value: 'pompadour', label: '飛機頭' },
    { value: 'short', label: '短髮' }, { value: 'bob', label: '短長髮' }, { value: 'medium', label: '中長髮' }, { value: 'long', label: '長髮' }],
  curl: [{ value: 'straight', label: '直髮' }, { value: 'curly', label: '捲髮' }],
  front: [{ value: 'none', label: '無瀏海' }, { value: 'bangs', label: '瀏海' }, { value: 'center', label: '中分' }, { value: 'side', label: '旁分' }],
  tie: [{ value: 'none', label: '不綁' }, { value: 'ponytail', label: '馬尾' }, { value: 'lowpony', label: '低馬尾' },
    { value: 'twintails', label: '雙馬尾' }, { value: 'lowtwintails', label: '低雙馬尾' }, { value: 'bun', label: '包頭' }, { value: 'halfup', label: '半丸子頭' }],
};
export type Hair = { length: string; curl: string; front: string; tie: string; cm?: number };
// the hair's length in cm, set with − / + from 短髮 (0) up; which band of length that is (and so what it can do: tied
// back from 中長髮 on), and how many cm each of the old fixed lengths was
export const HAIR_CM = { step: 2, max: 60 };
// the cuts that are what they are, with no length to set (光頭, 平頭, 蘑菇頭, 阿志頭, 刺蝟頭, 飛機頭)
export const FIXED_CUTS = ['bald', 'buzz', 'mushroom', 'azhi', 'spiky', 'pompadour'];
export const lengthForCm = (cm: number) => (cm <= 0 ? 'short' : cm <= 10 ? 'bob' : cm <= 30 ? 'medium' : 'long');
export const CM_OF_LENGTH: Record<string, number> = { short: 0, bob: 8, medium: 29, long: 33 };
// what each of the older single hairstyles was, part by part
const HAIR_FROM_STYLE: Record<string, Hair> = {
  bald: { length: 'bald', curl: 'straight', front: 'none', tie: 'none' },
  buzz: { length: 'buzz', curl: 'straight', front: 'none', tie: 'none' },
  short: { length: 'short', curl: 'straight', front: 'none', tie: 'none' },
  side: { length: 'short', curl: 'straight', front: 'side', tie: 'none' },
  spiky: { length: 'spiky', curl: 'straight', front: 'none', tie: 'none' },
  curly: { length: 'short', curl: 'curly', front: 'none', tie: 'none' },
  medium: { length: 'medium', curl: 'straight', front: 'center', tie: 'none' },
  long: { length: 'long', curl: 'straight', front: 'bangs', tie: 'none' },
  longCurly: { length: 'long', curl: 'curly', front: 'bangs', tie: 'none' },
  bun: { length: 'medium', curl: 'straight', front: 'bangs', tie: 'bun' },
  ponytail: { length: 'long', curl: 'straight', front: 'bangs', tie: 'ponytail' },
  cap: { length: 'short', curl: 'straight', front: 'none', tie: 'none' },
  bucket: { length: 'short', curl: 'straight', front: 'none', tie: 'none' },
};
// a look's hair, part by part: what's stored, or what its older single hairstyle meant
export function hairOf(look: Look): Hair {
  const old = HAIR_FROM_STYLE[look.hairStyle] ?? HAIR_FROM_STYLE.short;
  const oldSpiky = look.hairCurl === 'spiky';
  const length = oldSpiky ? 'spiky' : pickIn(HAIR.length, look.hairLength, old.length);
  // a length set in cm (not for 光頭 / 平頭): that, and the band it falls in
  const cm = typeof look.hairCm === 'number' && !FIXED_CUTS.includes(length) ? Math.max(0, Math.min(HAIR_CM.max, Math.round(look.hairCm))) : undefined;
  return {
    length: cm !== undefined ? lengthForCm(cm) : length, curl: pickIn(HAIR.curl, oldSpiky ? 'straight' : look.hairCurl, old.curl),
    front: pickIn(HAIR.front, look.hairFront, old.front), tie: pickIn(HAIR.tie, look.hairTie, old.tie),
    ...(cm !== undefined ? { cm } : {}),
  };
}
// the colour of the band a ponytail's (or each of twin tails') tied with (neon pink unless chosen)
export const tieColorOf = (look: Look) => (typeof look.tieColor === 'number' ? look.tieColor : 0xff4f7b);
// a short description, like 長髮・捲髮・瀏海・馬尾
export function hairLabel(h: Hair): string {
  const l = (key: keyof typeof HAIR, v: string) => HAIR[key].find(o => o.value === v)?.label ?? v;
  if (FIXED_CUTS.includes(h.length)) return l('length', h.length);
  return [l('length', h.length), h.curl !== 'straight' && l('curl', h.curl), h.front !== 'none' && l('front', h.front), h.tie !== 'none' && l('tie', h.tie)].filter(Boolean).join('・');
}


// ================================================================ 配戴

// a hat is its own choice, put on over the hair
export const HAT_STYLES: Option[] = [
  { value: 'none', label: '不戴' }, { value: 'cap', label: '棒球帽' }, { value: 'bucket', label: '漁夫帽' }, { value: 'beanie', label: '毛帽' },
  { value: 'fedora', label: '紳士帽' }, { value: 'beret', label: '貝雷帽' },
];
const HAT_COLOR: Record<string, number> = { cap: 0xf08a24, bucket: 0x2f2f2f, beanie: 0xd08a1e, fedora: 0x3a332c, beret: 0x8b1e2d };
// the hat of a look, reading the older ways hats were stored: as a hairstyle (with its colour in `cap`, short hair
// under it) or as a beanie colour
export function hatOf(look: Look): { hat: string; color: number } {
  const hat = isIn(HAT_STYLES, look.hat) ? look.hat
    : look.hairStyle === 'cap' || look.hairStyle === 'bucket' ? look.hairStyle
    : typeof look.beanie === 'number' ? 'beanie' : 'none';
  const color = typeof look.hatColor === 'number' ? look.hatColor
    : look.hat == null && (look.hairStyle === 'cap' || look.hairStyle === 'bucket') && typeof look.cap === 'number' ? look.cap
    : look.hat == null && typeof look.beanie === 'number' ? look.beanie : HAT_COLOR[hat] ?? 0xd08a1e;
  return { hat, color };
}

// (glasses: FACE.glasses and FACE.glassesShape, read by faceOf)
// the frame's colour; older looks keep the material colour their frame kind always had
export const FRAME_COLOR: Record<string, number> = {
  frame: 0x1b1b1b, browline: 0x1b1b1b, metal: 0xd2ae62, metalSilver: 0xc9ccd1, rimless: 0xc9ccd1, aliang: 0x070708,
};
export const frameColorOf = (look: Look, style = typeof look.glasses === 'string' ? look.glasses : 'frame') =>
  typeof look.frameColor === 'number' ? look.frameColor
    : look.glasses === 'metalSilver' ? FRAME_COLOR.metalSilver : FRAME_COLOR[style] ?? FRAME_COLOR.frame;
// 鏡片: clear unless its tint or opacity was chosen; older sunglasses start black and fully solid
export const CLEAR_LENS = { color: 0xdff2ff, opacity: 0.1 };
export const SUN_LENS = { color: 0x0d0d10, opacity: 1 };
export const lensOf = (look: Look): { color: number; opacity: number } => {
  const plain = look.glasses === 'sun' ? SUN_LENS : CLEAR_LENS;
  return {
    color: typeof look.lensColor === 'number' ? look.lensColor : plain.color,
    opacity: typeof look.lensOpacity === 'number' ? Math.max(0, Math.min(1, look.lensOpacity)) : plain.opacity,
  };
};
export const sunglassesOf = lensOf;

// earrings, chosen for each ear
export const EARRINGS: Option[] = [
  { value: 'none', label: '無' }, { value: 'hoop', label: '金色圈' }, { value: 'hoopSilver', label: '銀色圈' }, { value: 'stud', label: '耳釘' }, { value: 'drop', label: '垂墜' },
];
export const earringsOf = (look: Look): { left: string; right: string } => ({ left: pickIn(EARRINGS, look.earL, 'none'), right: pickIn(EARRINGS, look.earR, 'none') });

// tattoos: American traditional, in black and grey; each part of the arms and legs inked with a piece of its own, or
// bare (the legs show under shorts or a skirt). 文字 spells the look's tattooText.
export const TATTOO_STYLES: Option[] = [
  { value: 'none', label: '無' }, { value: 'rose', label: '玫瑰' }, { value: 'swallow', label: '燕子' }, { value: 'dagger', label: '匕首穿心' },
  { value: 'skull', label: '骷髏' }, { value: 'anchor', label: '船錨' }, { value: 'eagle', label: '老鷹' }, { value: 'flash', label: '小圖混搭' }, { value: 'text', label: '文字' },
];
export const TATTOO_PARTS: Option[] = [
  { value: 'ru', label: '右大臂' }, { value: 'lu', label: '左大臂' }, { value: 'rf', label: '右小臂' }, { value: 'lf', label: '左小臂' },
  { value: 'rl', label: '右小腿' }, { value: 'll', label: '左小腿' },
];
// styles from before, read as the nearest piece now
const TAT_OLD: Record<string, string> = { wave: 'rose', blackgrey: 'rose', floral: 'rose', tribal: 'eagle', geo: 'skull', script: 'text' };
const tatStyle = (v: unknown): v is string => v !== 'none' && isIn(TATTOO_STYLES, v);
const tatNow = (v: unknown) => (typeof v === 'string' && TAT_OLD[v]) || v;
// the style on each inked part (parts left out are bare); older looks stored a side (left / right / both) and how far
// up the arm (forearm / sleeve), all in the one style
export function tattooOf(look: Look): Record<string, string> {
  const out: Record<string, string> = {};
  if (look.tattoos && typeof look.tattoos === 'object') {
    for (const [k, v] of Object.entries(look.tattoos as Record<string, unknown>)) { const s = tatNow(v); if (isIn(TATTOO_PARTS, k) && tatStyle(s)) out[k] = s; }
    return out;
  }
  const side = look.tattoo, sleeve = look.tattooCover === 'sleeve';
  (['r', 'l'] as const).forEach(s => {
    if (side === 'both' || side === (s === 'r' ? 'right' : 'left')) { out[s + 'f'] = 'rose'; if (sleeve) out[s + 'u'] = 'rose'; }
  });
  return out;
}

// a little companion that goes about with them (路易斯 the bear flies at their shoulder, 夜叉丸 the Pomeranian trots at their feet)
export const COMPANIONS: Option[] = [{ value: 'none', label: '無' }, { value: 'bear', label: '路易斯' }, { value: 'dog', label: '夜叉丸' }, { value: 'corgi', label: '蘿蔔糕' }];
export const companionOf = (look: Look) => pickIn(COMPANIONS, look.companion, 'none');


// ================================================================ 穿著

// the top's cut and sleeves; below the waist, pants, shorts or a skirt, and how wide (pants' and shorts' legs, a
// skirt's flare)
export const CLOTHES: Record<'style' | 'pattern' | 'bottom' | 'fit' | 'top' | 'sleeve', Option[]> = {
  // what the top is; the winter ones (帽T and the jackets) always have long sleeves
  style: [
    { value: 'tee', label: 'T恤' }, { value: 'shirt', label: '襯衫' },
    { value: 'hoodie', label: '帽T' }, { value: 'jacket', label: '夾克外套' }, { value: 'coat', label: '西裝外套' }, { value: 'varsity', label: '棒球外套' },
    { value: 'denim', label: '牛仔外套' },
  ],
  // printed on the top, in shades of its own colour
  pattern: [
    { value: 'none', label: '素色' }, { value: 'stripe', label: '橫條紋' }, { value: 'plaid', label: '格紋' },
    { value: 'dots', label: '圓點' }, { value: 'camo', label: '迷彩' }, { value: 'floral', label: '花襯衫' },
    // one printed picture on the chest, the rest plain (a small emblem on a shirt)
    { value: 'p_coffee', label: '印花・咖啡杯' }, { value: 'p_cat', label: '印花・貓咪' }, { value: 'p_sunset', label: '印花・夕陽' },
    { value: 'p_mountain', label: '印花・山景' }, { value: 'p_smile', label: '印花・笑臉' }, { value: 'p_wave', label: '印花・浪花' },
    { value: 'p_logo', label: '印花・字樣' },
  ],
  bottom: [{ value: 'pants', label: '長褲' }, { value: 'jeans', label: '牛仔褲' }, { value: 'shorts', label: '短褲' }, { value: 'skirt', label: '裙子' }],
  fit: [{ value: 'slim', label: '窄' }, { value: 'regular', label: '一般' }, { value: 'wide', label: '寬' }],
  top: [{ value: 'slim', label: '合身' }, { value: 'regular', label: '一般' }, { value: 'oversize', label: '寬鬆' }],
  sleeve: [{ value: 'short', label: '短袖' }, { value: 'long', label: '長袖' }],
};
export const WINTER_TOPS = ['hoodie', 'jacket', 'coat', 'varsity', 'denim'];
export function clothesOf(look: Look): { style: string; pattern: string; bottom: string; fit: string; top: string; sleeve: string } {
  const style = pickIn(CLOTHES.style, look.topStyle, 'tee');
  return {
    style, pattern: pickIn(CLOTHES.pattern, look.topPattern, 'none'),
    bottom: pickIn(CLOTHES.bottom, look.bottom, 'pants'), fit: pickIn(CLOTHES.fit, look.pantsFit, 'regular'),
    top: pickIn(CLOTHES.top, look.topFit, 'regular'), sleeve: look.longSleeve || WINTER_TOPS.includes(style) ? 'long' : 'short',
  };
}

// shoes: a style, in the shoe colour
export const SHOE_STYLES: Option[] = [
  { value: 'sneaker', label: '球鞋' }, { value: 'hightop', label: '高筒帆布鞋' }, { value: 'lowtop', label: '低筒帆布鞋' }, { value: 'boots', label: '靴子' }, { value: 'slides', label: '拖鞋' },
];
export const shoeOf = (look: Look): { style: string; color: number } => ({ style: pickIn(SHOE_STYLES, look.shoeStyle, 'sneaker'), color: typeof look.shoe === 'number' ? look.shoe : 0x1d1d1d });

// socks (seen on bare legs, under shorts or a skirt, and in slides)
export const SOCKS: Option[] = [{ value: 'none', label: '無' }, { value: 'short', label: '短襪' }, { value: 'long', label: '長襪' }];
export const socksOf = (look: Look): { style: string; color: number } => ({ style: pickIn(SOCKS, look.socks, 'none'), color: typeof look.sock === 'number' ? look.sock : 0xf2efe9 });


// ================================================================ 顏色

export const SKIN_TONES = [
  { value: 0xfbe3cf, label: '粉白' }, { value: 0xf6d7bd, label: '白皙' }, { value: 0xf1c9a5, label: '偏白' }, { value: 0xe0ac80, label: '自然' },
  { value: 0xd9a27c, label: '小麥' }, { value: 0xc68a5e, label: '黝黑' }, { value: 0x8d5a3b, label: '深色' }, { value: 0x6b4430, label: '深棕' },
];
// swatches next to each colour field in the editor
export const COLOR_PRESETS: Record<'skin' | 'hair' | 'eyes' | 'clothes' | 'lens' | 'frame', { value: number; label: string }[]> = {
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
  frame: [
    { value: 0x1b1b1b, label: '黑' }, { value: 0x070708, label: '亮黑' }, { value: 0x5a3a22, label: '棕' },
    { value: 0x8a5a2b, label: '玳瑁' }, { value: 0x8a1e2d, label: '酒紅' }, { value: 0x1d3d6b, label: '藍' },
    { value: 0x2e8b57, label: '綠' }, { value: 0xd2ae62, label: '金' }, { value: 0xc9ccd1, label: '銀' },
    { value: 0xf2f2f2, label: '白' }, { value: 0xe87aa8, label: '粉' }, { value: 0xdff2ff, label: '透明' },
  ],
  lens: [
    { value: CLEAR_LENS.color, label: '透明' }, { value: 0x0d0d10, label: '黑' }, { value: 0x3a3a40, label: '灰' }, { value: 0x5a3620, label: '棕' }, { value: 0x1f4a38, label: '綠' },
    { value: 0x1d3d6b, label: '藍' }, { value: 0x3d2a5a, label: '紫' }, { value: 0x6b2a3a, label: '玫瑰' }, { value: 0xb8c0c8, label: '銀鏡' },
  ],
};


// ================================================================ parseLook

// a look from the editor's form fields (get returns a field's value, null when the form has no such field); anything
// missing or not one of its options keeps what prev had
export function parseLook(get: (k: string) => string | null, prev?: Look): Look {
  const base: Look = prev ?? { skin: 0xe0ac80, hair: 0x111111, hairStyle: 'short', shirt: 0x7fae8b, pants: 0x2b2b2b };
  const hex = (k: string, fallback: number) => { const v = get(k) ?? ''; return /^#[0-9a-f]{6}$/i.test(v) ? parseInt(v.slice(1), 16) : fallback; };
  const one = (k: string, opts: Option[], now: string) => pickIn(opts, get(k), now);   // a picked option, or what it was
  const face = faceOf(base, String(get('name') ?? '')), hair = hairOf(base), hat = hatOf(base), clothes = clothesOf(base);
  const shoe = shoeOf(base), socks = socksOf(base), ears = earringsOf(base), inked = tattooOf(base), sunGlass = sunglassesOf(base);
  const lensIn = get('lensOpacity'), lensVal = lensIn != null && lensIn !== '' ? Number(lensIn) : NaN;
  const number = (get('number') ?? '').trim().slice(0, 2);
  const tatText = (get('tattooText') ?? (typeof base.tattooText === 'string' ? base.tattooText : '')).trim().slice(0, 12);
  const look: Look = {
    ...base,
    // 身形與臉
    skin: hex('skin', base.skin), eyeColor: hex('eyeColor', face.eyeColor), blush: get('blush') === 'on',
    build: one('build', BUILDS, buildOf(base)), height: one('height', HEIGHTS, heightOf(base)),
    faceShape: one('faceShape', FACE.faceShape, face.faceShape), eyes: one('eyes', FACE.eyes, face.eyes), brows: one('brows', FACE.brows, face.brows),
    nose: one('nose', FACE.nose, face.nose), mouth: one('mouth', FACE.mouth, face.mouth),
    facialHair: one('facialHair', FACE.facialHair, face.facialHair), beard: one('beard', FACE.beard, face.beard),
    // 髮型
    hair: hex('hair', base.hair), tieColor: hex('tieColor', tieColorOf(base)),
    hairLength: one('hairLength', HAIR.length, hair.length), hairCurl: one('hairCurl', HAIR.curl, hair.curl),
    hairFront: one('hairFront', HAIR.front, hair.front), hairTie: one('hairTie', HAIR.tie, hair.tie),
    // 配戴
    hat: one('hat', HAT_STYLES, hat.hat), hatColor: hex('hatColor', hat.color),
    glasses: one('glasses', FACE.glasses, face.glasses), glassesShape: one('glassesShape', FACE.glassesShape, face.glassesShape),
    frameColor: hex('frameColor', frameColorOf(base, face.glasses)),
    lensColor: hex('lensColor', sunGlass.color),
    lensOpacity: Number.isFinite(lensVal) ? Math.max(0, Math.min(1, lensVal)) : sunGlass.opacity,
    earL: one('earL', EARRINGS, ears.left), earR: one('earR', EARRINGS, ears.right),
    tattoos: Object.fromEntries(TATTOO_PARTS.map(p => [p.value, get('tat_' + p.value) ?? inked[p.value]] as const).filter((e): e is [string, string] => tatStyle(e[1]))),
    companion: one('companion', COMPANIONS, companionOf(base)),
    // 穿著
    shirt: hex('shirt', base.shirt), topStyle: one('topStyle', CLOTHES.style, clothes.style), topPattern: one('topPattern', CLOTHES.pattern, clothes.pattern), topFit: one('topFit', CLOTHES.top, clothes.top), longSleeve: one('sleeve', CLOTHES.sleeve, clothes.sleeve) === 'long',
    pants: hex('pants', base.pants), bottom: one('bottom', CLOTHES.bottom, clothes.bottom), pantsFit: one('pantsFit', CLOTHES.fit, clothes.fit),
    shoeStyle: one('shoeStyle', SHOE_STYLES, shoe.style), shoe: hex('shoe', shoe.color),
    socks: one('socks', SOCKS, socks.style), sock: hex('sock', socks.color),
  };
  // the hair's length in cm, when it's been set with − / + (empty: left as the fixed length it was)
  const cmIn = get('hairCm'), cmVal = cmIn != null && cmIn !== '' ? Number(cmIn) : NaN;
  if (FIXED_CUTS.includes(look.hairLength ?? '')) delete look.hairCm;
  else if (Number.isFinite(cmVal)) { look.hairCm = Math.max(0, Math.min(HAIR_CM.max, Math.round(cmVal))); look.hairLength = lengthForCm(look.hairCm); }
  if (tatText) look.tattooText = tatText; else delete look.tattooText;
  if (number) look.number = number; else delete look.number;
  // what older looks stored in other ways, now superseded
  delete look.tattoo; delete look.tattooCover;   // by tattoos
  delete look.mustache; delete look.goatee;      // by facialHair
  delete look.beanie; delete look.cap;           // by hat / hatColor
  return look;
}
