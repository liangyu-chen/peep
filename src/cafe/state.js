// Shared, mutable state of the running café. One café runs per page; startCafe() resets it.
export const S = {};

export function resetState(content) {
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, {
    content,            // { menu, lines } from the back office (or the built-in defaults)
    stopped: false,

    // clock and shop
    speed: 1, minutes: 16 * 60, dow: 5, open: true, closing: false,
    revenue: 0, cupsSold: 0, spawnCooldown: 5, brewing: false,
    timers: [],

    // people
    people: [], customers: [], orderQueue: [], floaters: [],
    owner: null, selected: null, showTags: true, toiletBusy: false,
    labelsEl: null,

    // the game on the TV
    tv: { match: null, startDelay: 1.5, results: [], attract: 0, flash: null },

    // filled in by the world builders and createSeats()
    seats: null,
    fontTex: [],        // canvas textures with text, redrawn once the web fonts arrive
  });
}

// waits in simulated seconds (the time-speed buttons speed it up); never resolves once the café is stopped
export function sleep(s) { return new Promise(r => S.timers.push({ t: s, r })); }
