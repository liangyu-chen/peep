// Shared, mutable state of the running café. One café runs per page; startCafe() resets it.
export const S = {};

export function resetState(content) {
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, {
    content,            // { menu, lines, regulars, pools } from the back office (or the built-in defaults)
    stopped: false,

    // clock and shop
    speed: 1, minutes: 16 * 60, dow: 5, open: true, closing: false,
    revenue: 0, cupsSold: 0, spawnCooldown: 5, brewing: false,
    timers: [],

    // people
    people: [], customers: [], orderQueue: [], floaters: [],
    owner: null, selected: null, showTags: true, toiletBusy: false, toiletUser: null,
    labelsEl: null,

    // the game on the TV
    tv: { match: null, game: null, startDelay: 1.5, results: [], attract: 0, flash: null },   // game: 'nba' | 'fight' while someone sits at it

    // spinning tops in the arcade
    topsSession: null, topsCooldown: 25,

    // the air conditioner, worked by the white remote that waits at the right edge of the screen: off to start
    // with, so the sliding door and the front door stand open for air and the outdoor unit's fan is still
    // (index.js); mode, temp and fan are the remote's own settings, shown on its screen
    ac: { on: false, spin: 0, temp: 26, fan: 'auto', mode: 'cool', swingH: 'auto', swingV: 'auto' },
    // whether the remote is equipped (the 冷氣遙控 item, rpgMenu.js): not to start with, so it's off screen until then
    acGear: false,

    // filled in by the world builders and createSeats()
    seats: null,
    fontTex: [],        // canvas textures with text, redrawn once the web fonts arrive
  });
}

// waits in simulated seconds (the time-speed buttons speed it up); never resolves once the café is stopped. `who`: the
// person whose doing it is: their waits hold still while they're frozen (run off from a cockroach, roach.js), and the
// owner's are thrown away when he drops everything to go after one
export function sleep(s, who) { return new Promise(r => S.timers.push({ t: s, r, who })); }
