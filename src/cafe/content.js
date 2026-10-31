// Reading the editable content (menu + dialogue) at run time.
import { S } from './state.js';
import { pick, fill, randi } from './util.js';

export const menuNames = () => S.content.menu.map(m => m.name);
export const menuItem = name => S.content.menu.find(m => m.name === name);
// 'hot' or 'ice': whichever the menu serves it as; when it's both, iced a bit more often
export function pickVariant(name) {
  const m = menuItem(name);
  if (!m) return /^熱/.test(name) ? 'hot' : 'ice';   // something off the menu: hot if it says so, iced otherwise
  if (m.hot && m.ice) return Math.random() < 0.6 ? 'ice' : 'hot';
  return m.ice ? 'ice' : 'hot';
}
// what the customer says they're having: 冰拿鐵 / 熱拿鐵 when it comes both ways, just the name otherwise
export function orderName(name, variant) {
  const m = menuItem(name);
  return m && m.hot && m.ice ? (variant === 'ice' ? '冰' : '熱') + name : name;
}
// the price in that column; a column that isn't a number (∞, ???) still tallies a believable amount
export const priceOf = (name, variant) => parseInt(menuItem(name)?.[variant], 10) || randi(12, 18) * 10;

// a regular orders their usual even if it isn't on the menu (the owner makes it for them); with none set, something from the menu
export const drinkFor = wanted => (String(wanted || '').trim() ? String(wanted).trim() : pick(menuNames()));

export function line(key, vars) {
  const options = S.content.lines[key];
  return options && options.length ? fill(pick(options), { owner: S.content.owner?.name ?? '老闆', ...vars }) : null;
}
// says a random line from a category; a category with no lines just stays quiet. {owner} is always available.
export function sayLine(person, key, vars, dur) {
  const text = line(key, vars);
  if (text) person.say(text, dur);
  return text;
}
