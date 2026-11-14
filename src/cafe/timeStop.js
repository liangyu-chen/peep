// 時間停止器: a red stopwatch with STOP on its little screen, in the bag from the start. Pressed, everything in the shop
// holds still where it is (people mid-step, the smoke, the fans, the traffic, the music; index.js runs the shop at a
// speed of 0) while the camera can still go round it all; pressed again, time goes on. The café drawn drained of
// colour meanwhile, with a ripple going out at the moment it stops and STOP shown in the corner (cafe.css).
import { S } from './state.js';
import { sfx } from './sfx.js';
import { holdMusic } from './music.js';

export function setTimeStop(on) {
  on = !!on;
  if (S.timeStop === on) return;
  S.timeStop = on;
  const root = document.querySelector('.cafe-root');
  if (root) {
    root.classList.toggle('timeStop', on);
    // replay the ripple each time it stops (and the colour coming back each time it goes on)
    root.classList.remove('timeStopIn', 'timeGoIn'); void root.offsetWidth; root.classList.add(on ? 'timeStopIn' : 'timeGoIn');
  }
  sfx(on ? 'timeStop' : 'timeGo');
  holdMusic(on);
}
// the café closing with time stopped: let go quietly, so it starts up running next time
export function clearTimeStop() {
  S.timeStop = false;
  document.querySelector('.cafe-root')?.classList.remove('timeStop', 'timeStopIn', 'timeGoIn');
  holdMusic(false, false);
}
