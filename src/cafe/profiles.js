// Who comes in: the regulars (each with their usual drink and 2K team) and random first-timers.
import * as THREE from 'three';
import { rand, randi, pick } from './util.js';
import { menuNames } from './content.js';
import { S } from './state.js';
import { FACE, FIGHTER_NAMES } from '../content/catalog';

// any face option except 'none' (a first-timer always has brows and a nose)
const pickFace = key => pick(FACE[key].filter(o => o.value !== 'none')).value;

// all thirty NBA teams (East, then West), their abbreviation and jersey colours (main, trim)
export const TEAMS = {
  '塞爾提克': { ab: 'BOS', c1: '#007A33', c2: '#ffffff' }, '籃網': { ab: 'BKN', c1: '#111111', c2: '#ffffff' },
  '尼克': { ab: 'NYK', c1: '#006BB6', c2: '#F58426' }, '76人': { ab: 'PHI', c1: '#006BB6', c2: '#ED174C' },
  '暴龍': { ab: 'TOR', c1: '#CE1141', c2: '#111111' }, '公牛': { ab: 'CHI', c1: '#CE1141', c2: '#111111' },
  '騎士': { ab: 'CLE', c1: '#860038', c2: '#FDBB30' }, '活塞': { ab: 'DET', c1: '#C8102E', c2: '#1D42BA' },
  '溜馬': { ab: 'IND', c1: '#002D62', c2: '#FDBB30' }, '公鹿': { ab: 'MIL', c1: '#00471B', c2: '#EEE1C6' },
  '老鷹': { ab: 'ATL', c1: '#E03A3E', c2: '#C1D32F' }, '黃蜂': { ab: 'CHA', c1: '#1D1160', c2: '#00788C' },
  '熱火': { ab: 'MIA', c1: '#98002E', c2: '#F9A01B' }, '魔術': { ab: 'ORL', c1: '#0077C0', c2: '#C4CED4' },
  '巫師': { ab: 'WAS', c1: '#002B5C', c2: '#E31837' },
  '金塊': { ab: 'DEN', c1: '#0E2240', c2: '#FEC524' }, '灰狼': { ab: 'MIN', c1: '#0C2340', c2: '#78BE20' },
  '雷霆': { ab: 'OKC', c1: '#007AC1', c2: '#EF3B24' }, '拓荒者': { ab: 'POR', c1: '#E03A3E', c2: '#111111' },
  '爵士': { ab: 'UTA', c1: '#4B2A86', c2: '#ffffff' }, '勇士': { ab: 'GSW', c1: '#1D428A', c2: '#FFC72C' },
  '快艇': { ab: 'LAC', c1: '#C8102E', c2: '#1D428A' }, '湖人': { ab: 'LAL', c1: '#552583', c2: '#FDB927' },
  '太陽': { ab: 'PHX', c1: '#E56020', c2: '#1D1160' }, '國王': { ab: 'SAC', c1: '#5A2D81', c2: '#63727A' },
  '獨行俠': { ab: 'DAL', c1: '#00538C', c2: '#B8C4CA' }, '火箭': { ab: 'HOU', c1: '#CE1141', c2: '#111111' },
  '灰熊': { ab: 'MEM', c1: '#5D76A9', c2: '#12173F' }, '鵜鶘': { ab: 'NOP', c1: '#0C2340', c2: '#C8102E' },
  '馬刺': { ab: 'SAS', c1: '#111111', c2: '#C4CED4' },
};export const TEAM_NAMES = Object.keys(TEAMS);

const SKINS = [0xf1c9a5, 0xe0ac80, 0xc68a5e, 0x8d5a3b, 0xf6d7bd, 0xd9a27c];
const HAIRS = [0x1b1410, 0x3b2618, 0x6b4423, 0x111111, 0xb07a3b, 0x8a8a8a];
export const L = (skin, hair, hairStyle, shirt, pants, extra = {}) => Object.assign({ skin, hair, hairStyle, shirt, pants }, extra);


// the regulars come from the back office; each visit to the page starts their 2K record afresh,
// and an unset favourite team or fighting-game character is drawn at random for the visit
export const createRegulars = () => S.content.regulars.map(r => ({
  ...r, look: { ...r.look }, look2: r.look2 ? { ...r.look2 } : null,
  team: TEAMS[r.team] ? r.team : pick(TEAM_NAMES),
  fighter: FIGHTER_NAMES.includes(r.fighter) ? r.fighter : pick(FIGHTER_NAMES),
  regular: true, wins: randi(10, 60), losses: randi(10, 60),
}));

// the TV games someone plays: 'nba' (NBA 2K) and 'fight' (快打旋風)
export const tvGames = p => [p.plays2k && 'nba', p.playsFight && 'fight'].filter(Boolean);
export const GAME_LABEL = { nba: 'NBA 2K', fight: '快打旋風' };

// a first-timer is surname + title (a female or male title decides the look) and a job, all from the back office's pools;
// a name already in the shop is avoided when another is possible
// a first-timer's hair, part by part
function randomHair(female) {
  const hairLength = female ? pick(['long', 'long', 'medium', 'medium', 'bob', 'bob', 'short']) : pick(['short', 'short', 'short', 'buzz', 'bald', 'bob', 'medium', 'mushroom', 'azhi', 'spiky', 'pompadour']);
  const hairCurl = Math.random() < 0.25 ? 'curly' : 'straight';
  const hairFront = pick(female ? ['bangs', 'bangs', 'center', 'side', 'none'] : ['none', 'none', 'side', 'center', 'bangs']);
  const hairTie = female && (hairLength === 'medium' || hairLength === 'long') && Math.random() < 0.35 ? pick(['ponytail', 'lowpony', 'twintails', 'lowtwintails', 'bun', 'halfup']) : 'none';
  return { hairLength, hairCurl, hairFront, hairTie };
}

export function newProfile() {
  const { surname, titleF, titleM, job } = S.content.pools;
  const taken = n => S.customers.some(c => c.p.name === n);
  let female, name;
  for (let tries = 0; tries < 8; tries++) {
    female = Math.random() < titleF.length / (titleF.length + titleM.length);
    name = pick(surname) + pick(female ? titleF : titleM);
    if (!taken(name)) break;
  }
  return {
    name, regular: false, visits: 1, job: pick(job),
    drink: pick(menuNames()),   // (cakes included)
    team: pick(TEAM_NAMES), fighter: pick(FIGHTER_NAMES), wins: 0, losses: 0, quirk: '第一次來',
    plays2k: Math.random() < 0.35, playsFight: Math.random() < 0.2, playsTops: false, smokes: Math.random() < 0.2,
    look: L(pick(SKINS), pick(HAIRS), 'short',
      new THREE.Color().setHSL(Math.random(), rand(0.3, 0.6), rand(0.35, 0.6)).getHex(), pick([0x2b2b2b, 0x334455, 0x5a4a3a, 0x1f2a44]),
      {
        ...randomHair(female),
        bottom: female && Math.random() < 0.35 ? 'skirt' : 'pants', pantsFit: pick(['slim', 'regular', 'regular', 'wide']), topFit: pick(['slim', 'regular', 'regular', 'oversize']),
        height: pick(['xshort', 'short', 'short', 'regular', 'regular', 'regular', 'tall', 'tall', 'xtall']),
        topStyle: (r => r < 0.22 ? 'shirt' : r < 0.42 ? pick(['hoodie', 'hoodie', 'jacket', 'coat', 'suit', 'varsity']) : 'tee')(Math.random()), topPattern: Math.random() < 0.45 ? pick(['stripe', 'plaid', 'dots', 'camo', 'floral', 'p_coffee', 'p_cat', 'p_sunset', 'p_mountain', 'p_smile', 'p_wave', 'p_logo']) : 'none',
        hat: Math.random() < 0.3 ? pick(['cap', 'cap', 'bucket', 'beanie']) : 'none', hatColor: new THREE.Color().setHSL(Math.random(), 0.5, 0.45).getHex(), longSleeve: Math.random() < 0.4,
        faceShape: pickFace('faceShape'), eyes: pickFace('eyes'), brows: pickFace('brows'), nose: pickFace('nose'), mouth: pickFace('mouth'),
        glasses: Math.random() < 0.18 ? pick(['frame', 'browline', 'metal', 'rimless']) : 'none',
        glassesShape: pick(['round', 'oval', 'square', 'rectangle', 'wayfarer', 'catEye', 'aviator', 'hexagon', 'octagon', 'diamond']),
        facialHair: !female && Math.random() < 0.25 ? pick(['stubble', 'mustache', 'goatee', 'full']) : 'none',
        beard: pick(['light', 'normal', 'normal', 'thick']),
        blush: female && Math.random() < 0.3,
      })
  };
}
