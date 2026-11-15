// The mountain as data. Everything is placed in beats (1 beat = T.beat metres) so the
// run can be synced to music later. d = distance down the course in metres, u = metres
// left/right of the course centre line, world z = -d.
import { T } from './config.js';
import { LEVEL } from './levels.js';
import { clamp, smoothstep, rng } from './util.js';

const B = T.beat, r0 = rng(LEVEL.seed);
export const sections = [];
let cursor = 0;
for (const [name, beats, slope, width, turn, blend = 30] of LEVEL.sections) {
  sections.push({ name, b0: cursor, beats, slope, width, turn, blend, d0: cursor * B, d1: (cursor + beats) * B }); cursor += beats;
}
export const LENGTH = cursor * B;
export const FINISH = (sections[sections.length - 1].b0 + 2.5) * B;

// ---- features ---------------------------------------------------------------------------
// sentries are goblins: tower ones stand on a watchtower, the others hang under a lantern balloon. pacers are sled raiders.
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
const slalom = (s, from, to, step, amp) => { let k = r0() < 0.5 ? 1 : -1; for (let b = from; b <= to; b += step) { gate(s, b, k * amp); k = -k; } };

// What each kind of section contains. n = length in beats.
const recipes = {
  start() {}, runout() {},
  slalom(s, n) { // gates swing around tree islands, lookouts on the edges
    const amp = Math.min(4.5, s.width - 4.8);
    slalom(s, 3, n - 3, 2, amp); gate(s, n - 1, 0);
    let side = 1; for (let b = 4; b < n - 2; b += 4.5) { tower(s, b + r0(), side); side = -side; }
    for (let b = 7; b < n - 3; b += 5.5) balloon(s, b, (r0() - 0.5) * 5, 4.8 + r0());
    if (n >= 18) { pacer(s, n * 0.4); if (n >= 24) pacer(s, n * 0.75); }
    if (n >= 20 && s.width < 10) kicker(s, n * 0.58, 1.45, 10);
  },
  pitch(s, n) { slalom(s, 1.5, n - 1.5, 1.5, 2.5); balloon(s, n - 1, 0, 5.2); },
  chute(s, n) { slalom(s, 1, n - 1, 1.4, 2.2); },
  camp(s, n) { // kickers with balloons over the landings, raiders, an ice wall at the gate
    tower(s, 1.2, -1); tower(s, 1.6, 1);
    for (let b = 3, i = 0; b < n - 3.5; b += 4.6, i++) {
      kicker(s, b, 1.5 + (i % 2) * 0.2); balloon(s, b + 1.5, (r0() - 0.5) * 4, 5.6); balloon(s, b + 2, (r0() - 0.5) * 7, 4.5);
      pacer(s, b + 2.4); if (i % 2) tower(s, b + 2.8, i % 4 === 1 ? 1 : -1);
    }
    wall(s, n - 1);
  },
  ice(s, n, next) { // sheets to ride, walls to shoot, then a launch if a drop follows
    sheet(s, 1.6, 2.2, -2, 10); wall(s, 4.8);
    balloon(s, 6.0, 5, 3.9); balloon(s, 6.2, 7, 5.2); balloon(s, 6.4, 5.5, 6.6);
    sheet(s, 6.6, 2.4, -3, 10); pacer(s, 7); wall(s, n - 2.2);
    if (n >= 14) { balloon(s, n - 4, -6, 3.9); balloon(s, n - 3.6, 6, 3.9); }
    if (next && next.name === 'fall') kicker(s, n - 0.65, 1.9, 13);
  },
  fall(s, n) { for (let i = 0; i < 3; i++) balloon(s, 0.9 + i * (n - 1.2) / 3, [0, -4, 4][i], 9 - i); },
  rollers(s, n) { // a rhythm of small airs
    for (let b = 1.5, i = 0; b < n - 1.5; b += 1.7, i++) { kickers.push({ d: at(s, b), h: 0.95, len: 8 }); if (i % 2) balloon(s, b + 0.9, (r0() - 0.5) * 6, 4.6); }
    tower(s, n - 1, -1); if (n >= 12) tower(s, n * 0.5, 1);
  },
  cliffs(s, n) { // drops with targets hanging in the fall line
    let side = 1;
    for (let b = 2, i = 0; b < n - 1.5; b += 3, i++) { drop(s, b, 5 + i * 1.5); balloon(s, b + 0.9, (r0() - 0.5) * 6, 6.5 + i * 0.5); if (i % 2) balloon(s, b + 1.1, (r0() - 0.5) * 6, 6); tower(s, b + 1.7, side); side = -side; }
  },
  park(s, n) { // kickers, each bigger than the last, balloons strung over every landing
    for (let i = 0, b = 2; b < n - 2.5; i++, b += 3.6) {
      kicker(s, b, 2.0 + i * 0.6, 10 + i); if (i % 2) ravine(s, b + 0.35, 9 + i * 2);
      for (let k = 0; k < 2 + (i > 1 ? 1 : 0); k++) balloon(s, b + 1.0 + k * 0.42, (k - 1) * 2.6 * (i % 2 ? -1 : 1), 5.5 + i * 0.9 - k * 0.5);
    }
    pacer(s, n * 0.45); wall(s, n - 0.7, 0, 16, 5.2);
  },
};
sections.forEach((s, i) => recipes[s.name](s, s.beats, sections[i + 1]));

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
  const count = Math.round((D_MAX - D_MIN) * 0.72 * (LEVEL.treeDensity || 1));
  for (let i = 0; i < count; i++) {
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
