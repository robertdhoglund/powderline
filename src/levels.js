// The mountains. Each level is a list of sections: [kind, beats, steepness, half-width, turn strength, blend metres].
// The kind decides what gets placed there (see the recipes in course.js). 1 beat = 14 m.
import { save } from './store.js';

// Per-level feel: spray (how much snow flies), drag (below 1 is faster), flakes (snowfall), fog (haze), par (seconds for an on-time run).
export const LEVELS = [
  { id: 'norway', name: 'TROLLHEIM', place: 'NORWAY', time: 'SUNSET', blurb: 'Forest slalom and a frozen fjord', seed: 11, throws: 1, sunY: 0.12, landmark: 'horns', gate: 'arch', par: 89,
    pal: [[0, 'DUSK'], [0.3, 'DUSK'], [0.5, 'GLOW'], [0.8, 'GLOW'], [1.0, 'NIGHT'], [1.5, 'NIGHT']],
    sections: [['start', 5, 0.25, 10, 0.2], ['slalom', 24, 0.42, 10, 1.0], ['pitch', 6, 1.0, 9, 0.5, 26], ['camp', 16, 0.40, 11, 0.6], ['chute', 6, 1.2, 7, 0.8], ['fjord', 16, 0.2, 15, 0.1],
      ['fall', 4, 1.3, 10, 0.2, 18], ['rollers', 10, 0.45, 10, 0.3], ['slalom', 26, 0.5, 8, 1.15], ['cliffs', 10, 0.55, 10, 0.4], ['pitch', 5, 1.1, 9, 0.5, 28],
      ['park', 16, 0.42, 11, 0.25], ['slalom', 20, 0.6, 8, 1.1], ['fall', 5, 1.35, 9, 0.3, 24], ['runout', 8, 0.1, 14, 0.1, 40]] },
  { id: 'japan', name: 'KITSUNE RIDGE', place: 'JAPAN', time: 'LANTERN NIGHT', blurb: 'Deep powder, torii tunnels, heavy snowfall', seed: 23, throws: 0.8, sunY: 0.3, tree: ['#101a3a', '#28406e'], landmark: 'volcano', gate: 'torii', kinds: [0, 2, 2], treeDensity: 0.7,
    spray: 1.7, drag: 1.06, flakes: 2.4, fog: 0.0034, par: 78,
    pal: [[0, 'LANTERN'], [1.5, 'LANTERN']],
    sections: [['start', 5, 0.25, 11, 0.2], ['torii', 10, 0.36, 6, 0.35], ['rollers', 12, 0.4, 12, 0.4], ['slalom', 22, 0.4, 12, 1.3], ['torii', 8, 0.5, 6, 0.3], ['park', 16, 0.4, 12, 0.2],
      ['camp', 14, 0.42, 11, 0.5], ['pitch', 5, 0.9, 9, 0.5, 26], ['torii', 12, 0.55, 6, 0.5], ['rollers', 10, 0.45, 12, 0.3], ['park', 14, 0.42, 12, 0.2], ['fall', 4, 1.1, 10, 0.3, 22], ['runout', 8, 0.1, 14, 0.1, 40]] },
  { id: 'alps', name: 'COULOIR NOIR', place: 'FRANCE', time: 'BLUEBIRD DAY', blurb: 'Hardpack, race gates, rock-walled couloirs. The fast one', seed: 37, throws: 1.2, sunY: 0.42, tree: ['#10283a', '#2c5870'], rocks: 900, landmark: 'needles', gate: 'race', treeDensity: 0.6,
    spray: 0.6, drag: 0.86, flakes: 0.3, fog: 0.0019, par: 61,
    pal: [[0, 'DAY'], [0.7, 'DAY'], [0.95, 'DAWN'], [1.5, 'DAWN']],
    sections: [['start', 4, 0.3, 10, 0.2], ['pitch', 8, 1.1, 9, 0.4, 26], ['couloir', 10, 1.25, 5.5, 0.6], ['cliffs', 12, 0.7, 10, 0.4], ['camp', 14, 0.5, 11, 0.6], ['fall', 5, 1.4, 9, 0.3, 20],
      ['slalom', 24, 0.65, 9, 1.2], ['couloir', 8, 1.3, 5.5, 0.7], ['ice', 12, 0.3, 13, 0.12], ['fall', 4, 1.35, 10, 0.2, 18], ['cliffs', 10, 0.7, 10, 0.4], ['couloir', 8, 1.3, 5.5, 0.6], ['park', 16, 0.5, 11, 0.25],
      ['fall', 6, 1.4, 9, 0.3, 24], ['runout', 8, 0.1, 14, 0.1, 40]] },
  { id: 'alaska', name: 'AURORA SPINES', place: 'ALASKA', time: 'POLAR DAWN', blurb: 'Above the treeline: huge open faces and cliff after cliff', seed: 51, throws: 1.5, sunY: 0.14, landmark: 'spines', gate: 'totem', kinds: [1, 1, 0], treeDensity: 0.22, rocks: 1100,
    spray: 1.2, flakes: 1.4, fog: 0.0022, par: 71,
    pal: [[0, 'NIGHT'], [0.45, 'NIGHT'], [0.7, 'DAWN'], [0.95, 'MORNING'], [1.5, 'MORNING']],
    sections: [['start', 5, 0.3, 14, 0.2], ['spine', 12, 1.2, 15, 0.3], ['ice', 12, 0.3, 14, 0.12], ['fall', 5, 1.35, 12, 0.2, 18], ['camp', 16, 0.45, 14, 0.5], ['spine', 10, 1.3, 15, 0.3],
      ['ice', 12, 0.3, 14, 0.12], ['fall', 4, 1.3, 12, 0.2, 18], ['rollers', 12, 0.5, 13, 0.3], ['slalom', 20, 0.6, 12, 0.9], ['spine', 12, 1.35, 15, 0.3], ['park', 18, 0.45, 13, 0.25],
      ['cliffs', 12, 0.65, 12, 0.4], ['fall', 6, 1.45, 10, 0.3, 24], ['runout', 8, 0.1, 14, 0.1, 40]] },
];
const want = new URLSearchParams(location.search).get('level') || save.level;
export const LEVEL = LEVELS.find((l) => l.id === want) || LEVELS[0];
save.level = LEVEL.id;
