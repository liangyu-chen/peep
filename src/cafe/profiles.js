// Who comes in: the regulars (each with their usual drink and 2K team) and random first-timers.
import * as THREE from 'three';
import { rand, randi, pick } from './util.js';
import { menuNames } from './content.js';
import { S } from './state.js';

export const TEAMS = {
  '湖人': { ab: 'LAL', c1: '#552583', c2: '#FDB927' }, '勇士': { ab: 'GSW', c1: '#1D428A', c2: '#FFC72C' },
  '塞爾提克': { ab: 'BOS', c1: '#007A33', c2: '#ffffff' }, '公牛': { ab: 'CHI', c1: '#CE1141', c2: '#111111' },
  '熱火': { ab: 'MIA', c1: '#98002E', c2: '#F9A01B' }, '獨行俠': { ab: 'DAL', c1: '#00538C', c2: '#B8C4CA' },
  '金塊': { ab: 'DEN', c1: '#0E2240', c2: '#FEC524' }, '公鹿': { ab: 'MIL', c1: '#00471B', c2: '#EEE1C6' },
  '太陽': { ab: 'PHX', c1: '#E56020', c2: '#1D1160' }, '尼克': { ab: 'NYK', c1: '#006BB6', c2: '#F58426' }
};
export const TEAM_NAMES = Object.keys(TEAMS);

const SKINS = [0xf1c9a5, 0xe0ac80, 0xc68a5e, 0x8d5a3b, 0xf6d7bd, 0xd9a27c];
const HAIRS = [0x1b1410, 0x3b2618, 0x6b4423, 0x111111, 0xb07a3b, 0x8a8a8a];
export const L = (skin, hair, hairStyle, shirt, pants, extra = {}) => Object.assign({ skin, hair, hairStyle, shirt, pants }, extra);

export const OWNER = { name: '小鬍子', job: '老闆兼咖啡師，拉花和雕花是招牌', look: L(0xe0ac80, 0x1b1410, 'long', 0x1e1e22, 0x1f1f1f, { mustache: true, goatee: true, beanie: 0xd08a1e, glasses: true, longSleeve: true }) };

export const createRegulars = () => [
  { name: '阿凱', job: '軟體工程師', drink: '奧利多美式', team: '勇士', visits: 214, look: L(0xe0ac80, 0x111111, 'short', 0x1D428A, 0x2b2b2b, { glasses: true, number: '30' }), quirk: '每天下班一定來打一場' },
  { name: '美美', job: '平面設計師', drink: '夏一布', team: '湖人', visits: 167, look: L(0xf6d7bd, 0x3b2618, 'long', 0xf1d27a, 0x3a3f5c), quirk: '自稱店內 2K 女王' },
  { name: '大頭', job: '大學生', drink: '花生拿鐵', team: '公牛', visits: 98, look: L(0xf1c9a5, 0x1b1410, 'cap', 0xCE1141, 0x222222, { cap: 0x111111, number: '23' }), quirk: '翹課來打電動' },
  { name: '阿嘉', job: '外送員', drink: '林美如', team: '塞爾提克', visits: 131, look: L(0xc68a5e, 0x111111, 'short', 0x2e8b57, 0x334455), quirk: '送單空檔會在騎樓坐一下' },
  { name: '小胖', job: '研究生', drink: '奶昔', team: '熱火', visits: 76, look: L(0xf1c9a5, 0x3b2618, 'short', 0x98002E, 0x555555, { glasses: true }), quirk: '論文寫不出來就來這' },
  { name: 'Jason', job: '隔壁五金行少東', drink: '別害羞', team: '獨行俠', visits: 120, look: L(0xe0ac80, 0x6b4423, 'short', 0xf2f2f2, 0x1f2a44, { longSleeve: true }), quirk: '顧店空檔溜過來' },
  { name: '阿翔', job: '健身教練', drink: '冰維也納', team: '金塊', visits: 88, look: L(0x8d5a3b, 0x111111, 'bald', 0x0E2240, 0x111111), quirk: '輸了會去騎樓做伏地挺身' },
  { name: '小雨', job: '插畫家', drink: '拿鐵', team: '公鹿', visits: 143, look: L(0xf6d7bd, 0x111111, 'bun', 0x7fae8b, 0xd9c7a4), quirk: '最愛台式茶杯裡的拉花' },
  { name: '老陳', job: '退休老師', drink: '拿鐵', team: '塞爾提克', visits: 302, look: L(0xe0ac80, 0x8a8a8a, 'short', 0x8b6b4a, 0x4a4a4a, { glasses: true, longSleeve: true }), quirk: '從萬華店就跟過來的元老' },
  { name: '阿德', job: '廚師', drink: '一起搖擺', team: '太陽', visits: 65, look: L(0xd9a27c, 0x1b1410, 'cap', 0xE56020, 0x2b2b2b, { cap: 0x1D1160 }), quirk: '休假日整天泡在這' },
  { name: '欣欣', job: '護理師', drink: '花生拿鐵', team: '尼克', visits: 91, look: L(0xf6d7bd, 0x6b4423, 'long', 0x006BB6, 0x2b2b2b), quirk: '大夜班下班來放鬆' },
  { name: '球哥', job: '前校隊後衛', drink: '林美如', team: '公牛', visits: 188, look: L(0xc68a5e, 0x111111, 'short', 0x111111, 0xCE1141, { number: '1' }), quirk: '嘴上說不玩，坐下就不走' }
].map(r => Object.assign(r, { regular: true, wins: randi(10, 60), losses: randi(10, 60) }));

const NEW_JOBS = ['路過的上班族', '觀光客', '附近的學生', '看 IG 找來的', '朋友推薦來的', '來買五金順便的'];
// a first-timer's name comes from the back office's name list, preferring one nobody in the shop is using
export function newProfile() {
  const all = S.content.names;
  const free = all.filter(n => !S.customers.some(c => c.p.name === n.name));
  const { name, gender } = pick(free.length ? free : all);
  const female = gender === 'any' ? Math.random() < 0.5 : gender === 'f';
  return {
    name, regular: false, visits: 1, job: pick(NEW_JOBS),
    drink: pick(menuNames()), team: pick(TEAM_NAMES), wins: 0, losses: 0, quirk: '第一次來',
    look: L(pick(SKINS), pick(HAIRS), female ? pick(['long', 'bun', 'short']) : pick(['short', 'short', 'cap', 'bald']),
      new THREE.Color().setHSL(Math.random(), rand(0.3, 0.6), rand(0.35, 0.6)).getHex(), pick([0x2b2b2b, 0x334455, 0x5a4a3a, 0x1f2a44]),
      { cap: new THREE.Color().setHSL(Math.random(), 0.5, 0.45).getHex(), longSleeve: Math.random() < 0.4 })
  };
}
