// Things to buy in the lobby with coins. Each has a few levels; cost rises per level.
import { T } from './config.js';
import { upLevel } from './store.js';

export const UPGRADES = [
  { id: 'draw', name: 'QUICK DRAW', desc: 'The bow draws faster', max: 3, cost: [400, 900, 1800] },
  { id: 'focus', name: 'DEEP FOCUS', desc: 'Slow motion lasts longer', max: 3, cost: [400, 900, 1800] },
  { id: 'magnet', name: 'TRUE AIM', desc: 'Arrows pull harder toward goblins', max: 3, cost: [400, 900, 1800] },
  { id: 'wax', name: 'BOARD WAX', desc: 'Higher top speed', max: 3, cost: [400, 900, 1800] },
  { id: 'shield', name: 'SNOW SHIELD', desc: 'Blocks one more snowball each run', max: 3, cost: [500, 1100, 2200] },
  { id: 'triple', name: 'TRIPLE SHOT', desc: 'Two extra arrows seek nearby goblins', max: 1, cost: [3000] },
];
// Applied once at load. Buying an upgrade reloads the numbers.
const BASE = { ...T };
export function applyUpgrades() {
  T.drawTime = BASE.drawTime * Math.pow(0.84, upLevel('draw'));
  T.focusDrain = BASE.focusDrain * Math.pow(0.8, upLevel('focus'));
  T.assistAngle = BASE.assistAngle * (1 + 0.35 * upLevel('magnet'));
  T.dragQuad = BASE.dragQuad * Math.pow(0.92, upLevel('wax'));
}
applyUpgrades();
