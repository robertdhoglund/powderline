// Base camp: pick a mountain, spend coins on upgrades, ride. Also settles the score at the end of a run.
import { G } from './state.js';
import { LEVELS, LEVEL } from './levels.js';
import { UPGRADES, applyUpgrades } from './upgrades.js';
import { save, persist, upLevel } from './store.js';
import { FINISH } from './course.js';
import { sfx } from './audio.js';
import { clamp } from './util.js';

const $ = (id) => document.getElementById(id);
const ORDER = ['E', 'D', 'C', 'B', 'A', 'S'];
export const unlocked = (i) => i === 0 || (save.best[LEVELS[i - 1].id] && save.best[LEVELS[i - 1].id].rank !== 'E');
export const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// Ranks are plain rules. Each needs a share of the goblins, the same share of the gates, and a time.
// A is 90% of both, on time (the level's par). S is nearly everything, faster than par.
export const RANKS = [['S', 0.97, 0.93], ['A', 0.9, 1.0], ['B', 0.75, 1.12], ['C', 0.55, 1.28], ['D', 0.35, 1.5]];
export function settle() {
  const s = G.stats, t = G.totals, par = LEVEL.par || FINISH / 28;
  const gob = s.kills / t.targets, gate = s.gates / t.gates, time = s.time;
  const got = RANKS.find(([, share, k]) => gob >= share && gate >= share && time <= par * k);
  const rank = got ? got[0] : 'E';
  // What the next rank up still needs.
  const up = RANKS[(got ? RANKS.indexOf(got) : RANKS.length) - 1], need = [];
  if (up) {
    if (gob < up[1]) need.push(`${Math.ceil(up[1] * t.targets) - s.kills} more goblins`);
    if (gate < up[1]) need.push(`${Math.ceil(up[1] * t.gates) - s.gates} more gates`);
    if (time > par * up[2]) need.push(`${Math.ceil(time - par * up[2])} s faster`);
  }
  const speed = clamp(1 - (time - par) / (par * 0.5), 0, 1);
  const speedBonus = Math.round(clamp(1.5 - time / par, 0, 1) * 600) * 100; G.score += speedBonus;
  const coins = Math.round(G.score / 250) + { S: 900, A: 500, B: 250, C: 120, D: 50, E: 0 }[rank];
  const old = save.best[LEVEL.id], next = LEVELS[LEVELS.indexOf(LEVEL) + 1], wasLocked = next && !unlocked(LEVELS.indexOf(next));
  if (!old || ORDER.indexOf(rank) > ORDER.indexOf(old.rank) || (rank === old.rank && G.score > old.score)) save.best[LEVEL.id] = { rank, score: G.score };
  save.coins += coins; persist();
  return { rank, speed, gob, gate, speedBonus, coins, par, need: up ? `FOR ${up[0]}: ${need.join(' · ')}` : 'A PERFECT RUN', opened: wasLocked && unlocked(LEVELS.indexOf(next)) ? next : null };
}

let onRide = null;
function render() {
  $('coins').textContent = save.coins.toLocaleString('en-US');
  $('levels').innerHTML = LEVELS.map((l, i) => {
    const open = unlocked(i), best = save.best[l.id];
    return `<button class="lv${save.level === l.id ? ' on' : ''}${open ? '' : ' locked'}" data-level="${l.id}" ${open ? '' : 'disabled'}>
      <small>${l.place} · ${l.time}</small><b>${l.name}</b><em>${l.blurb}</em>
      <span>${open ? (best ? `BEST ${best.rank} · ${best.score.toLocaleString('en-US')} · PAR ${clock(l.par)}` : 'NOT RIDDEN YET') : `FINISH ${LEVELS[i - 1].name} WITH RANK D`}</span></button>`;
  }).join('');
  $('shop').innerHTML = UPGRADES.map((u) => {
    const lv = upLevel(u.id), cost = u.cost[lv], full = lv >= u.max;
    return `<button class="up${full ? ' full' : ''}" data-up="${u.id}" ${full || save.coins < cost ? 'disabled' : ''}>
      <b>${u.name}</b><small>${u.desc}</small><i>${'●'.repeat(lv)}${'○'.repeat(u.max - lv)}</i><span>${full ? 'MAX' : `${cost.toLocaleString('en-US')} COINS`}</span></button>`;
  }).join('');
  $('ride').textContent = `RIDE ${(LEVELS.find((l) => l.id === save.level) || LEVEL).name}`;
}
$('lobby').addEventListener('click', (e) => {
  const lv = e.target.closest('[data-level]'), up = e.target.closest('[data-up]');
  if (lv && !lv.disabled) { save.level = lv.dataset.level; persist(); render(); }
  if (up && !up.disabled) {
    const u = UPGRADES.find((x) => x.id === up.dataset.up), lvl = upLevel(u.id);
    if (lvl < u.max && save.coins >= u.cost[lvl]) { save.coins -= u.cost[lvl]; save.up[u.id] = lvl + 1; persist(); applyUpgrades(); sfx('buy'); render(); }
  }
  if (e.target.id === 'ride' && onRide) onRide();
});
export function openLobby(ride) { onRide = ride; if (!unlocked(LEVELS.findIndex((l) => l.id === save.level))) save.level = LEVEL.id; render(); $('lobby').classList.add('show'); }
export function closeLobby() { $('lobby').classList.remove('show'); }
