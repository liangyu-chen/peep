// A walking graph of the shop, for getting someone from wherever they happen to be to somewhere else (the owner after a
// cockroach, the customers running from it: roach.js). It's made of the ways people already walk (layout.js, the seats'
// own ways in, the owner's rounds), joined where they meet, plus the main walkway and the owner's lane behind the bar
// run end to end. Plan coordinates, as everywhere.
import { S } from './state.js';
import { K } from './util.js';
import { DOOR, TOILET, LANE, HUBX, BAR_TO_BACK, GAME_GAP, zoneSpot } from './layout.js';

let G = null;   // { nodes: [{ x, z, links: [{ to, d }] }] }

const near = (a, b) => Math.abs(a - b) < 0.02;
function build() {
  const nodes = [], byKey = new Map();
  const node = ([x, z]) => {
    const k = `${Math.round(x * 50)},${Math.round(z * 50)}`;
    if (!byKey.has(k)) { byKey.set(k, nodes.length); nodes.push({ x, z, links: [] }); }
    return byKey.get(k);
  };
  const link = (i, j) => {
    if (i === j || nodes[i].links.some(l => l.to === j)) return;
    const a = nodes[i], b = nodes[j], d = Math.hypot((a.x - b.x) * K, a.z - b.z);
    a.links.push({ to: j, d }); b.links.push({ to: i, d });
  };
  const chain = pts => { for (let i = 1; i < pts.length; i++) link(node(pts[i - 1]), node(pts[i])); if (pts.length === 1) node(pts[0]); };
  const { seats, specSpots, counterSpots } = S.seats;
  [
    DOOR.slice(1), TOILET, GAME_GAP, BAR_TO_BACK,
    [[LANE, -2.3], ...BAR_TO_BACK], [[HUBX, -3.95], [-1.85, -4.1], [-1.85, -5.8], [-0.3, -5.8], [1.0, -5.8]],   // round to the storeroom
    [[LANE, 2.9], [1.0, 2.95], [-0.2, 2.95], [HUBX, 2.55]],                                                  // out at the bar's front end
    [[2.45, 2.36], [2.1, 2.8], [HUBX, 3.0]],                                                                 // the bin in the corner
    [[LANE, -1.55], [2.0, -1.55]], [[LANE, -2.3], [0.6, -3.55]], [[LANE, -2.3], [1.6, -3.55]],               // the sink, behind the ledge stools
    ...seats.map(s => s.path), ...specSpots.map(s => s.path), ...counterSpots.map(zoneSpot),
    ...(S.ashtrays || []).map(a => a.path),
  ].forEach(chain);
  // the walkway and the lane, end to end, through every point on them
  for (let z = -3.95; z <= 3.61; z += 0.4) node([HUBX, z]);
  for (let z = -2.3; z <= 2.91; z += 0.4) node([LANE, z]);
  const run = (x, z0, z1) => nodes.map((n, i) => [n, i]).filter(([n]) => near(n.x, x) && n.z >= z0 - 0.01 && n.z <= z1 + 0.01)
    .sort((a, b) => a[0].z - b[0].z).forEach(([, i], k, arr) => { if (k) link(arr[k - 1][1], i); });
  run(HUBX, -3.95, 3.6); run(LANE, -2.3, 2.9);
  return { nodes, seats: S.seats };
}
const graph = () => (G && G.seats === S.seats ? G : (G = build()));   // (a new café, a new graph)
export const resetNav = () => { G = null; };

const dist = (n, x, z) => Math.hypot((n.x - x) * K, n.z - z);
export function nearestNode(x, z) {
  const { nodes } = graph();
  let best = 0, bd = Infinity;
  nodes.forEach((n, i) => { const d = dist(n, x, z); if (d < bd) { bd = d; best = i; } });
  return best;
}
// from one node, how far to every other along the graph, and which way each was reached
export function spread(from) {
  const { nodes } = graph(), d = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = nodes.map(() => false);
  d[from] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0) break;
    done[u] = true;
    nodes[u].links.forEach(({ to, d: w }) => { if (d[u] + w < d[to]) { d[to] = d[u] + w; prev[to] = u; } });
  }
  return { d, prev };
}
const backTo = (prev, i) => { const out = []; for (; i >= 0; i = prev[i]) out.unshift(i); return out; };
export const nodeAt = i => graph().nodes[i];
export const nodeCount = () => graph().nodes.length;
// every stretch of floor between two points, once: [i, j, length]
export const allEdges = () => graph().nodes.flatMap((n, i) => n.links.filter(l => l.to > i).map(l => [i, l.to, l.d]));

// the way from (x, z) to (tx, tz): onto the graph at its nearest point, along it, and off it to the spot itself
export function navPath(x, z, tx, tz) {
  const a = nearestNode(x, z), b = nearestNode(tx, tz);
  const { prev } = spread(a);
  return pathAlong(backTo(prev, b), tx, tz);
}
// the way along the given nodes (from spread's prev) to node i, ending at (tx, tz) if given
export const wayTo = (prev, i, tx, tz) => pathAlong(backTo(prev, i), tx, tz);
function pathAlong(list, tx, tz) {
  const pts = list.map(i => { const n = nodeAt(i); return [n.x, n.z]; });
  if (tx !== undefined) pts.push([tx, tz]);
  return pts;
}
