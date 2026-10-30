// Reading the editable content (menu + dialogue) at run time.
import { S } from './state.js';
import { pick, fill, randi } from './util.js';

export const menuNames = () => S.content.menu.map(m => m.name);
export const menuItem = name => S.content.menu.find(m => m.name === name);
export const isIced = name => menuItem(name)?.iced ?? /冰|林美如|奶昔/.test(name);
export const priceOf = name => menuItem(name)?.price ?? randi(12, 18) * 10;   // a blank price ($???) still tallies a believable amount

// a regular's usual drink may have been taken off the menu; then they pick something else
export const drinkFor = wanted => (menuItem(wanted) ? wanted : pick(menuNames()));

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
