// Who comes in: the regulars (each with their usual drink and 2K team) and random first-timers.
import * as THREE from 'three';
import { rand, randi, pick } from './util.js';
import { menuNames } from './content.js';
import { S } from './state.js';
import { FACE, FIGHTER_NAMES } from '../content/catalog';

// any face option except 'none' (a first-timer always has brows and a nose)
const pickFace = key => pick(FACE[key].filter(o => o.value !== 'none')).value;

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


// the regulars come from the back office; each visit to the page starts their 2K record afresh,
// and an unset favourite team or fighting-game character is drawn at random for the visit
export const createRegulars = () => S.content.regulars.map(r => ({
  ...r, look: { ...r.look },
  team: TEAMS[r.team] ? r.team : pick(TEAM_NAMES),
  fighter: FIGHTER_NAMES.includes(r.fighter) ? r.fighter : pick(FIGHTER_NAMES),
  regular: true, wins: randi(10, 60), losses: randi(10, 60),
}));

// the TV games someone plays: 'nba' (NBA 2K) and 'fight' (快打旋風)
export const tvGames = p => [p.plays2k && 'nba', p.playsFight && 'fight'].filter(Boolean);
export const GAME_LABEL = { nba: 'NBA 2K', fight: '快打旋風' };

// a first-timer is surname + title (a female or male title decides the look) and a job, all from the back office's pools;
// a name already in the shop is avoided when another is possible
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
    drink: pick(menuNames()), team: pick(TEAM_NAMES), fighter: pick(FIGHTER_NAMES), wins: 0, losses: 0, quirk: '第一次來',
    plays2k: Math.random() < 0.35, playsFight: Math.random() < 0.2, playsTops: false, smokes: Math.random() < 0.2,
    look: L(pick(SKINS), pick(HAIRS), female ? pick(['long', 'medium', 'longCurly', 'bun', 'ponytail', 'short', 'curly']) : pick(['short', 'short', 'buzz', 'side', 'spiky', 'curly', 'bald']),
      new THREE.Color().setHSL(Math.random(), rand(0.3, 0.6), rand(0.35, 0.6)).getHex(), pick([0x2b2b2b, 0x334455, 0x5a4a3a, 0x1f2a44]),
      {
        hat: Math.random() < 0.3 ? pick(['cap', 'cap', 'bucket', 'beanie']) : 'none', hatColor: new THREE.Color().setHSL(Math.random(), 0.5, 0.45).getHex(), longSleeve: Math.random() < 0.4,
        faceShape: pickFace('faceShape'), eyes: pickFace('eyes'), brows: pickFace('brows'), nose: pickFace('nose'), mouth: pickFace('mouth'),
        glasses: Math.random() < 0.15 ? pick(['round', 'square']) : 'none',
        facialHair: !female && Math.random() < 0.25 ? pick(['stubble', 'mustache', 'goatee', 'full']) : 'none',
        blush: female && Math.random() < 0.3,
      })
  };
}
