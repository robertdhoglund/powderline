// The mountains. Each level is a list of sections: [kind, beats, steepness, half-width, turn strength, blend metres].
// The kind decides what gets placed there (see the recipes in course.js). 1 beat = 14 m.
import { save } from './store.js';

export const LEVELS = [
  { id: 'norway', name: 'TROLLHEIM', place: 'NORWAY', time: 'DUSK TO DAWN', seed: 11, throws: 1, sunY: 0.12, landmark: 'horns', gate: 'arch',
    pal: [[0, 'DUSK'], [0.2, 'DUSK'], [0.34, 'GLOW'], [0.46, 'GLOW'], [0.6, 'NIGHT'], [0.8, 'NIGHT'], [0.93, 'DAWN'], [1.5, 'DAWN']],
    sections: [['start', 5, 0.25, 10, 0.2], ['slalom', 24, 0.42, 10, 1.0], ['pitch', 6, 1.0, 9, 0.5, 26], ['camp', 16, 0.40, 11, 0.6], ['chute', 6, 1.2, 7, 0.8], ['ice', 12, 0.28, 13, 0.12],
      ['fall', 4, 1.3, 10, 0.2, 18], ['rollers', 10, 0.45, 10, 0.3], ['slalom', 26, 0.5, 8, 1.15], ['cliffs', 10, 0.55, 10, 0.4], ['pitch', 5, 1.1, 9, 0.5, 28], ['ice', 12, 0.30, 13, 0.12],
      ['park', 16, 0.42, 11, 0.25], ['slalom', 20, 0.6, 8, 1.1], ['fall', 5, 1.35, 9, 0.3, 24], ['runout', 8, 0.1, 14, 0.1, 40]] },
  { id: 'japan', name: 'KITSUNE RIDGE', place: 'JAPAN', time: 'MORNING', seed: 23, throws: 0.8, sunY: 0.2, tree: ['#16263f', '#31597a'], landmark: 'volcano', gate: 'torii', kinds: [0, 2, 2], treeDensity: 0.7,
    pal: [[0, 'DAWN'], [0.15, 'MORNING'], [0.7, 'MORNING'], [1.0, 'DAY'], [1.5, 'DAY']],
    sections: [['start', 5, 0.25, 11, 0.2], ['rollers', 12, 0.4, 11, 0.4], ['slalom', 22, 0.38, 11, 0.9], ['park', 16, 0.4, 12, 0.2], ['camp', 14, 0.42, 11, 0.5], ['pitch', 5, 0.9, 9, 0.5, 26],
      ['slalom', 20, 0.45, 9, 1.2], ['rollers', 10, 0.45, 10, 0.3], ['cliffs', 8, 0.5, 10, 0.4], ['park', 16, 0.42, 12, 0.2], ['fall', 4, 1.1, 10, 0.3, 22], ['runout', 8, 0.1, 14, 0.1, 40]] },
  { id: 'alps', name: 'COULOIR NOIR', place: 'FRANCE', time: 'BLUEBIRD DAY', seed: 37, throws: 1.2, sunY: 0.42, tree: ['#10283a', '#2c5870'], rocks: 900, landmark: 'needles', gate: 'race', treeDensity: 0.8,
    pal: [[0, 'DAY'], [0.7, 'DAY'], [0.95, 'DAWN'], [1.5, 'DAWN']],
    sections: [['start', 4, 0.3, 10, 0.2], ['pitch', 8, 1.1, 9, 0.4, 26], ['chute', 8, 1.25, 7, 0.9], ['cliffs', 12, 0.7, 10, 0.4], ['camp', 14, 0.5, 11, 0.6], ['fall', 5, 1.4, 9, 0.3, 20],
      ['slalom', 24, 0.65, 8, 1.2], ['ice', 12, 0.3, 13, 0.12], ['fall', 4, 1.35, 10, 0.2, 18], ['cliffs', 10, 0.7, 10, 0.4], ['chute', 8, 1.3, 7, 0.9], ['park', 16, 0.5, 11, 0.25],
      ['fall', 6, 1.4, 9, 0.3, 24], ['runout', 8, 0.1, 14, 0.1, 40]] },
  { id: 'alaska', name: 'AURORA SPINES', place: 'ALASKA', time: 'MIDNIGHT', seed: 51, throws: 1.5, sunY: 0.14, landmark: 'spines', gate: 'arch', kinds: [1, 1, 0],
    pal: [[0, 'NIGHT'], [0.85, 'NIGHT'], [0.98, 'DAWN'], [1.5, 'DAWN']],
    sections: [['start', 5, 0.3, 10, 0.2], ['slalom', 20, 0.5, 9, 1.1], ['ice', 14, 0.3, 13, 0.12], ['fall', 5, 1.35, 10, 0.2, 18], ['camp', 18, 0.45, 11, 0.6], ['chute', 8, 1.25, 7, 0.9],
      ['ice', 12, 0.3, 13, 0.12], ['fall', 4, 1.3, 10, 0.2, 18], ['rollers', 12, 0.5, 10, 0.3], ['slalom', 26, 0.6, 8, 1.25], ['cliffs', 12, 0.65, 10, 0.4], ['park', 18, 0.45, 11, 0.25],
      ['slalom', 18, 0.65, 8, 1.2], ['fall', 6, 1.4, 9, 0.3, 24], ['runout', 8, 0.1, 14, 0.1, 40]] },
];
const want = new URLSearchParams(location.search).get('level') || save.level;
export const LEVEL = LEVELS.find((l) => l.id === want) || LEVELS[0];
save.level = LEVEL.id;
