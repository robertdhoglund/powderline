// The mountain as data. Everything is placed in beats (1 beat = T.beat metres) so the
// run can be synced to music later. d = distance down the course in metres, u = metres
// left/right of the course centre line, world z = -d.
import { T } from './config.js';
import { clamp, smoothstep, rng } from './util.js';

const B = T.beat;
export const sections = [];
let cursor = 0;
function sec(name, beats, slope, width, turn, blend = 30) {
  const s = { name, b0: cursor, beats, slope, width, turn, blend, d0: cursor * B, d1: (cursor + beats) * B };
  sections.push(s); cursor += beats; return s;
}

// name, length in beats, steepness (1.0 = 45 degrees), half-width of the piste, how hard the course swings, blend metres
const START   = sec('start',        5, 0.25, 10, 0.2);
const FOREST  = sec('forest',      24, 0.42, 10, 1.0);
const PITCH1  = sec('pitch',        6, 1.00,  9, 0.5, 26);
const CAMP    = sec('goblin camp', 16, 0.40, 11, 0.6);
const CHUTE   = sec('chute',        6, 1.20,  7, 0.8);
const BENCH1  = sec('ice bench',   12, 0.28, 13, 0.12);
const ICEFALL = sec('icefall',      4, 1.30, 10, 0.2, 18);
const WHOOPS  = sec('rollers',     10, 0.45, 10, 0.3);
const CANYON  = sec('canyon',      26, 0.50,  8, 1.15);
const CLIFFS  = sec('cliff bands', 10, 0.55, 10, 0.4);
const PITCH2  = sec('pitch',        5, 1.10,  9, 0.5, 28);
const BENCH2  = sec('ice bench',   12, 0.30, 13, 0.12);
const PARK    = sec('jump park',   16, 0.42, 11, 0.25);
const GORGE   = sec('gorge',       20, 0.60,  8, 1.1);
const PLUNGE  = sec('plunge',       5, 1.35,  9, 0.3, 24);
const RUNOUT  = sec('runout',       8, 0.10, 14, 0.1, 40);

export const LENGTH = cursor * B;
export const FINISH = (RUNOUT.b0 + 2.5) * B;

// ---- features ---------------------------------------------------------------------------
// sentries are goblins: h < 4 stands on a watchtower, higher ones hang under a lantern balloon. pacers are sled raiders.
export const gates = [], sentries = [], pacers = [], kickers = [], drops = [], ravines = [], sheets = [], walls = [], islands = [], flags = [], torches = [];
const at = (s, b) => (s.b0 + b) * B;
const gate = (s, b, u) => gates.push({ d: at(s, b), u });
const tower = (s, b, side) => { sentries.push({ d: at(s, b), u: side * (s.width - 2.2), h: 3.3, tower: true }); torches.push({ d: at(s, b) + 2, u: side * (s.width - 0.6) }); };
const balloon = (s, b, u, h) => sentries.push({ d: at(s, b), u, h });
const pacer = (s, b) => pacers.push({ d: at(s, b) });
const kicker = (s, b, h = 1.5, len = 11) => { kickers.push({ d: at(s, b), h, len }); flags.push({ d: at(s, b), w: s.width }); };
const drop = (s, b, h) => { drops.push({ d: at(s, b), h }); flags.push({ d: at(s, b), w: s.width }); };
const ravine = (s, b, width = 9, depth = 3.5) => ravines.push({ d: at(s, b), width, depth });
const sheet = (s, b, beats, u, w) => sheets.push({ d: at(s, b + beats / 2), len: beats * B, u, w });
const wall = (s, b, u = 0, w = 14, h = 4.6) => walls.push({ d: at(s, b), u, w, h });
const island = (s, b, u) => islands.push({ d: at(s, b), u });
const slalom = (s, from, to, step, amp) => { let k = 1; for (let b = from; b <= to; b += step) { gate(s, b, k * amp); k = -k; } };

// Forest: gates swing around tree islands, lookouts on the edges.
slalom(FOREST, 3, 21, 2, 4.5); gate(FOREST, 23, 0);
[6, 10, 14, 18].forEach((b, i) => island(FOREST, b, i % 2 ? -1 : 1.5));
tower(FOREST, 8, 1); tower(FOREST, 12.5, -1); balloon(FOREST, 16, 0, 4.8); tower(FOREST, 20, 1);

gate(PITCH1, 1.5, -2.5); gate(PITCH1, 3, 2.5); gate(PITCH1, 4.5, -1.5);
balloon(PITCH1, 5, 0, 5.2);

// Goblin camp: kickers with balloons over the landings, raiders, the first ice wall.
tower(CAMP, 1.2, -1); tower(CAMP, 1.6, 1);
kicker(CAMP, 3); balloon(CAMP, 4.5, -1, 5.6); balloon(CAMP, 5.0, 3.5, 4.6);
pacer(CAMP, 5.4);
kicker(CAMP, 8, 1.7); balloon(CAMP, 9.5, -3.5, 5.6); balloon(CAMP, 9.9, 2, 4.4);
tower(CAMP, 10.6, 1); pacer(CAMP, 11);
kicker(CAMP, 12.5, 1.5); balloon(CAMP, 13.8, 0, 6);
wall(CAMP, 15);

slalom(CHUTE, 1, 5, 1.4, 2.2);

// Ice bench: sheets to ride, walls to shoot, then the launch over the icefall.
sheet(BENCH1, 1.6, 2.2, -2, 10);
wall(BENCH1, 4.8);
balloon(BENCH1, 6.0, 5, 3.9); balloon(BENCH1, 6.2, 7, 5.2); balloon(BENCH1, 6.4, 5.5, 6.6);
sheet(BENCH1, 6.6, 2.4, -3, 10);
pacer(BENCH1, 7);
wall(BENCH1, 10);
kicker(BENCH1, 11.35, 1.9, 13);
balloon(ICEFALL, 0.9, 0, 9); balloon(ICEFALL, 1.9, -4, 8); balloon(ICEFALL, 2.9, 4, 7);

// Rollers: a rhythm of small airs.
for (let i = 0; i < 5; i++) { kickers.push({ d: at(WHOOPS, 1.5 + i * 1.7), h: 0.95, len: 8 }); if (i % 2) balloon(WHOOPS, 2.4 + i * 1.7, (i - 2) * 1.5, 4.6); }
tower(WHOOPS, 9, -1);

// Canyon: tight turns between rock walls. Gates sit on the apexes, lookouts on the outside.
slalom(CANYON, 2, 24, 2, 3.2);
[4, 9, 14, 19, 23.5].forEach((b, i) => tower(CANYON, b, i % 2 ? 1 : -1));
balloon(CANYON, 7, 0, 5); balloon(CANYON, 12, -2, 5.4); balloon(CANYON, 17, 2, 5); pacer(CANYON, 10.5); pacer(CANYON, 20);
kicker(CANYON, 15.5, 1.4, 10);

// Cliff bands: three drops with targets hanging in the fall line.
drop(CLIFFS, 2, 5); balloon(CLIFFS, 2.9, 0, 6.5);
drop(CLIFFS, 5, 6.5); balloon(CLIFFS, 5.9, -3, 7); balloon(CLIFFS, 6.1, 3, 6);
drop(CLIFFS, 8, 8); balloon(CLIFFS, 9, 0, 8);
tower(CLIFFS, 3.6, 1); tower(CLIFFS, 6.8, -1);

gate(PITCH2, 1, 2.5); gate(PITCH2, 2.5, -2.5); gate(PITCH2, 4, 2);
balloon(PITCH2, 3.4, 0, 5.4);

pacer(BENCH2, 0.6);
sheet(BENCH2, 1.4, 2.8, 1, 11);
wall(BENCH2, 5.2); wall(BENCH2, 6.8);
sheet(BENCH2, 7.4, 2.4, -1, 11);
balloon(BENCH2, 8.6, -6, 3.9); balloon(BENCH2, 9, 6, 3.9); tower(BENCH2, 10.5, 1); tower(BENCH2, 10.9, -1);

// Jump park: four kickers, each bigger than the last, balloons strung over every landing.
[[2, 2.0, 10], [5.5, 2.6, 11], [9, 3.2, 12], [12.8, 3.8, 13]].forEach(([b, h, len], i) => {
  kicker(PARK, b, h, len); if (i % 2) ravine(PARK, b + 0.35, 9 + i * 2);
  for (let k = 0; k < 2 + (i > 1 ? 1 : 0); k++) balloon(PARK, b + 1.0 + k * 0.42, (k - 1) * 2.6 * (i % 2 ? -1 : 1), 5.5 + i * 0.9 - k * 0.5);
});
pacer(PARK, 7); wall(PARK, 15.3, 0, 16, 5.2);

// Gorge: the last hard carving, then the plunge.
slalom(GORGE, 2, 18, 2, 3.2);
[3, 7.5, 12, 16.5].forEach((b, i) => tower(GORGE, b, i % 2 ? -1 : 1));
balloon(GORGE, 5, 0, 5); balloon(GORGE, 10, 2, 5.5); balloon(GORGE, 14.5, -2, 5); pacer(GORGE, 8.5); pacer(GORGE, 15);
kicker(GORGE, 11, 1.5, 10);
balloon(PLUNGE, 1.6, -3, 6); balloon(PLUNGE, 2.6, 3, 6); balloon(PLUNGE, 3.6, 0, 6.5);

// ---- terrain shape ----------------------------------------------------------------------
function profile(d, key) {
  let v = sections[0][key];
  for (let i = 1; i < sections.length; i++) {
    const s = sections[i], h = s.blend / 2;
    v += (s[key] - sections[i - 1][key]) * smoothstep(s.d0 - h, s.d0 + h, d);
  }
  return v;
}
export const D_MIN = -160, D_MAX = LENGTH + 360;
const STEP = 0.5, N = Math.ceil((D_MAX - D_MIN) / STEP) + 2;
const Htab = new Float32Array(N), Wtab = new Float32Array(N), Stab = new Float32Array(N), Xtab = new Float32Array(N), DXtab = new Float32Array(N);
function bump(d) {
  let y = 0;
  for (const k of kickers) {
    const t = (d - (k.d - k.len)) / k.len;
    if (t <= 0 || d > k.d + 3) continue;
    y += t <= 1 ? k.h * t * t : k.h * (1 - smoothstep(0, 3, d - k.d));
  }
  for (const c of drops) y -= c.h * smoothstep(c.d, c.d + 2.5, d);                       // cliff: the ground steps down
  for (const r of ravines) { const t = (d - r.d) / r.width; if (t > 0 && t < 1) y -= r.depth * Math.sin(t * Math.PI) ** 0.6; }
  return y;
}
{
  let h = 0, x = 0;
  for (let i = 0; i < N; i++) {
    const d = D_MIN + i * STEP;
    Stab[i] = profile(d, 'slope'); Wtab[i] = profile(d, 'width');
    // The course swings in S-curves; each section sets how hard.
    DXtab[i] = profile(d, 'turn') * (0.46 * Math.sin(d * 0.0165 + 0.4) + 0.22 * Math.sin(d * 0.0372 + 2.1));
    Xtab[i] = x; x += DXtab[i] * STEP;
    Htab[i] = h; h -= Stab[i] * STEP;
  }
  const zero = Htab[Math.round(-D_MIN / STEP)];
  for (let i = 0; i < N; i++) Htab[i] += bump(D_MIN + i * STEP) - zero;
}
function sample(tab, d) {
  const f = clamp((d - D_MIN) / STEP, 0, N - 2), i = f | 0, t = f - i;
  return tab[i] + (tab[i + 1] - tab[i]) * t;
}
export const slopeAt = (d) => sample(Stab, d);
export const widthAt = (d) => sample(Wtab, d);
export const cx = (d) => sample(Xtab, d);
export const dcx = (d) => sample(DXtab, d);

// Height of the snow at any world position. The piste floor is flat side to side; banks rise beyond it.
export function height(x, z) {
  const d = -z, a = Math.abs(x - cx(d)) - sample(Wtab, d);
  let y = sample(Htab, d);
  if (a > 0) {
    y += 18 * (1 - Math.exp(-a * a / 500));
    y += Math.min(1, a / 9) * (1.3 * Math.sin(x * 0.13 + z * 0.07) + 0.7 * Math.sin(x * 0.31 - z * 0.19));
  }
  return y;
}
const _g = { x: 0, z: 0 };
export function grad(x, z) {
  const e = 0.4;
  _g.x = (height(x + e, z) - height(x - e, z)) / (2 * e);
  _g.z = (height(x, z + e) - height(x, z - e)) / (2 * e);
  return _g;
}
export const sectionAt = (d) => sections.find((s) => d < s.d1) || sections[sections.length - 1];

// ---- trees ------------------------------------------------------------------------------
export const trees = [];
{
  const r = rng(4177);
  for (let i = 0; i < 2300; i++) {
    const d = D_MIN + 20 + r() * (D_MAX - D_MIN - 40);
    const a = 2.5 + Math.pow(r(), 1.7) * 78, side = r() < 0.5 ? -1 : 1;
    const x = cx(d) + side * (widthAt(d) + a), s = 0.75 + r() * 0.9 + a * 0.008;
    trees.push({ x, z: -d, s, rot: r() * 6.28, tint: r(), solid: a < 12 });
  }
  for (const isl of islands) {
    for (let k = 0; k < 3; k++) {
      const x = cx(isl.d) + isl.u + (r() - 0.5) * 3.2, z = -isl.d + (r() - 0.5) * 9;
      trees.push({ x, z, s: 0.7 + r() * 0.5, rot: r() * 6.28, tint: r(), solid: true });
    }
  }
}
