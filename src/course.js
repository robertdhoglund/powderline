// The mountain as data. Everything is placed in beats (1 beat = T.beat metres) so the
// run can be synced to music later. d = distance down the course in metres, u = metres
// left/right of the course centre line, world z = -d.
import { T } from './config.js';
import { clamp, smoothstep, rng } from './util.js';

const B = T.beat;
export const sections = [];
let cursor = 0;
function sec(name, beats, slope, width, blend = 30) {
  const s = { name, b0: cursor, beats, slope, width, blend, d0: cursor * B, d1: (cursor + beats) * B };
  sections.push(s); cursor += beats; return s;
}

// name, length in beats, steepness (rise over run: 1.0 = 45 degrees), half-width of the piste, blend metres
const START    = sec('start',     5, 0.25, 10);
const FOREST   = sec('forest',   18, 0.42, 10);
const PITCH1   = sec('pitch',     5, 1.00,  9, 26);
const GAUNT1   = sec('gauntlet', 12, 0.40, 11);
const CHUTE    = sec('chute',     5, 1.20,  7, 30);
const BENCH1   = sec('ice bench',10, 0.28, 13);
const ICEFALL  = sec('icefall',   4, 1.30, 10, 18);
const BENCH2   = sec('ice bench',10, 0.30, 13);
const PITCH3   = sec('pitch',     5, 1.05,  9, 28);
const FINALE   = sec('finale',   12, 0.42, 11);
const PLUNGE   = sec('plunge',    4, 1.35,  9, 24);
const RUNOUT   = sec('runout',    8, 0.10, 14, 40);

export const LENGTH = cursor * B;
export const FINISH = (RUNOUT.b0 + 2.5) * B;

// ---- features ---------------------------------------------------------------------------
export const gates = [], sentries = [], pacers = [], kickers = [], sheets = [], walls = [], islands = [];
const at = (s, b) => (s.b0 + b) * B;
const gate = (s, b, u) => gates.push({ d: at(s, b), u });
const sentry = (s, b, u, h) => sentries.push({ d: at(s, b), u, h });
const pacer = (s, b) => pacers.push({ d: at(s, b) });
const kicker = (s, b, h = 1.5, len = 11) => kickers.push({ d: at(s, b), h, len });
const sheet = (s, b, beats, u, w) => sheets.push({ d: at(s, b + beats / 2), len: beats * B, u, w });
const wall = (s, b, u = 0, w = 14, h = 4.6) => walls.push({ d: at(s, b), u, w, h });
const island = (s, b, u) => islands.push({ d: at(s, b), u });

// Act 1: forest. Gates swing left and right around tree islands, so carving is the fast line.
[[3, -3.5], [5, 4], [7, -5], [9, 5], [11, -5], [13, 5], [15, -4], [17, 1]].forEach(([b, u]) => gate(FOREST, b, u));
island(FOREST, 6, 1.5); island(FOREST, 10, -1); island(FOREST, 14, 1);
sentry(FOREST, 8, 2.5, 3.2); sentry(FOREST, 12, -3, 3.6); sentry(FOREST, 16, 0, 4.6);

gate(PITCH1, 1.5, -2.5); gate(PITCH1, 3, 2.5);
sentry(PITCH1, 4.2, 0, 5);

// Act 2: gauntlet. Kickers with targets hanging over the landings, then the first ice wall.
kicker(GAUNT1, 3); sentry(GAUNT1, 4.5, -1, 5.6); sentry(GAUNT1, 5.1, 4, 4.4);
pacer(GAUNT1, 5.6);
kicker(GAUNT1, 8); sentry(GAUNT1, 9.5, -3.5, 5.4); sentry(GAUNT1, 9.9, 2, 4.2);
wall(GAUNT1, 11.2);

gate(CHUTE, 1, -2.2); gate(CHUTE, 2.5, 2.2); gate(CHUTE, 4, -1.5);

// Act 3: ice. Wide benches with ice sheets, walls to shoot, and a launch over the icefall.
sheet(BENCH1, 1.6, 2, -2, 10);
wall(BENCH1, 4.8);
sentry(BENCH1, 6.0, 5, 3.0); sentry(BENCH1, 6.15, 7, 4.4); sentry(BENCH1, 6.3, 5.5, 5.6);
sheet(BENCH1, 6.4, 2, -3, 10);
kicker(BENCH1, 9.35, 1.9, 13);
sentry(ICEFALL, 0.9, 0, 9); sentry(ICEFALL, 1.9, -4, 8); sentry(ICEFALL, 2.9, 4, 7);

pacer(BENCH2, 0.6);
sheet(BENCH2, 1.4, 2.6, 1, 11);
wall(BENCH2, 5.0); wall(BENCH2, 6.6);
sheet(BENCH2, 7.2, 2, -1, 11);
sentry(BENCH2, 8.2, -6, 3.2); sentry(BENCH2, 8.7, 6, 3.2);

gate(PITCH3, 1, 2.5); gate(PITCH3, 2.5, -2.5); gate(PITCH3, 4, 2);
sentry(PITCH3, 3.4, 0, 5.2);

kicker(FINALE, 2.5); sentry(FINALE, 3.9, 0, 5.6);
sentry(FINALE, 5.0, -5, 3.0); sentry(FINALE, 5.15, -3.4, 4.2); sentry(FINALE, 5.3, -5.4, 5.4);
wall(FINALE, 6.6);
kicker(FINALE, 8); pacer(FINALE, 8.3);
gate(FINALE, 9.6, -3); gate(FINALE, 10.5, 3);
wall(FINALE, 11.5, 0, 16, 5.4);
sentry(PLUNGE, 1.6, -3, 6); sentry(PLUNGE, 2.6, 3, 6);

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
const Htab = new Float32Array(N), Wtab = new Float32Array(N), Stab = new Float32Array(N);
function bump(d) {
  let y = 0;
  for (const k of kickers) {
    const t = (d - (k.d - k.len)) / k.len;
    if (t <= 0 || d > k.d + 3) continue;
    y += t <= 1 ? k.h * t * t : k.h * (1 - smoothstep(0, 3, d - k.d));
  }
  return y;
}
{
  let h = 0;
  for (let i = 0; i < N; i++) {
    const d = D_MIN + i * STEP;
    Stab[i] = profile(d, 'slope'); Wtab[i] = profile(d, 'width');
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
// The course swings in long S-curves.
export const cx = (d) => 26 * Math.sin(d * 0.0052 + 0.4) + 9 * Math.sin(d * 0.0145 + 2.1);
export const dcx = (d) => 26 * 0.0052 * Math.cos(d * 0.0052 + 0.4) + 9 * 0.0145 * Math.cos(d * 0.0145 + 2.1);

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
  for (let i = 0; i < 1100; i++) {
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
