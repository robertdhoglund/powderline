// Base camp: pick a mountain, spend coins on upgrades, ride. Also settles the score at the end of a run.
import { G } from './state.js';
import { LEVELS, LEVEL } from './levels.js';
import { UPGRADES, applyUpgrades } from './upgrades.js';
import { save, persist, upLevel } from './store.js';
import { FINISH } from './course.js';
import { sfx } from './audio.js';
import { clamp } from './util.js';

const $ = (id) => document.getElementById(id);
const ORDER = ['D', 'C', 'B', 'A', 'S'];
export const unlocked = (i) => i === 0 || (save.best[LEVELS[i - 1].id] && save.best[LEVELS[i - 1].id].rank !== 'D');

// Score is goblins, gates and speed. A rank takes most of the goblins, nearly every gate, and a fast time.
export function settle() {
  const s = G.stats, t = G.totals, fast = FINISH / 33, slow = FINISH / 20;
  const speed = clamp((slow - s.time) / (slow - fast), 0, 1), gob = s.kills / t.targets, gate = s.gates / t.gates;
  const rating = 0.4 * gob + 0.25 * gate + 0.35 * speed;
  const rank = rating >= 0.9 ? 'S' : rating >= 0.78 ? 'A' : rating >= 0.6 ? 'B' : rating >= 0.42 ? 'C' : 'D';
  const speedBonus = Math.round(speed * 500) * 100; G.score += speedBonus;
  const coins = Math.round(G.score / 250) + { S: 800, A: 450, B: 200, C: 80, D: 0 }[rank];
  const old = save.best[LEVEL.id], next = LEVELS[LEVELS.indexOf(LEVEL) + 1], wasLocked = next && !unlocked(LEVELS.indexOf(next));
  if (!old || ORDER.indexOf(rank) > ORDER.indexOf(old.rank) || (rank === old.rank && G.score > old.score)) save.best[LEVEL.id] = { rank, score: G.score };
  save.coins += coins; persist();
  return { rank, speed, gob, gate, speedBonus, coins, opened: wasLocked && unlocked(LEVELS.indexOf(next)) ? next : null };
}

let onRide = null;
function render() {
  $('coins').textContent = save.coins.toLocaleString('en-US');
  $('levels').innerHTML = LEVELS.map((l, i) => {
    const open = unlocked(i), best = save.best[l.id];
    return `<button class="lv${save.level === l.id ? ' on' : ''}${open ? '' : ' locked'}" data-level="${l.id}" ${open ? '' : 'disabled'}>
      <small>${l.place} · ${l.time}</small><b>${l.name}</b>
      <span>${open ? (best ? `BEST ${best.rank} · ${best.score.toLocaleString('en-US')}` : 'NOT RIDDEN YET') : `FINISH ${LEVELS[i - 1].name} WITH RANK C`}</span></button>`;
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
