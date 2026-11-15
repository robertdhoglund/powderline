// Static set dressing, merged into one mesh: goblin watchtowers, torches, and pennants that mark jumps and drops.
import * as THREE from 'three';
import { chunked, chunkOf } from './world.js';
import { LEVEL } from './levels.js';
import { height, cx, dcx, widthAt, FINISH, sentries, torches, flags } from './course.js';
import { part, place, merge, toon, cyl, cone, box, sph } from './build.js';
import { rng } from './util.js';

const WOOD = '#4a2f24', WOOD2 = '#5e3b2a', RED = '#c22a3c', FIRE = [3.2, 1.5, 0.35], BONE = '#e8dcc8';
const r = rng(808), chunks = new Map();
const put = (d, parts) => { const c = chunkOf(d); if (!chunks.has(c)) chunks.set(c, []); chunks.get(c).push(...parts); };
const yaw = (d) => -Math.atan(dcx(d));

export function towerParts(h) {
  const p = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    p.push(part(cyl(0.11, 0.15, h + 0.6, 6), WOOD, [sx * 0.85, h / 2 - 0.2, sz * 0.85], [sz * 0.13, 0, -sx * 0.13]));
    p.push(part(cone(0.1, 0.5, 5), BONE, [sx * 0.78, h + 0.5, sz * 0.78]));
  }
  p.push(part(box(1.9, 0.14, 1.9), WOOD2, [0, h, 0]), part(box(2.0, 0.1, 0.12), WOOD, [0, h + 0.42, 0.9]), part(box(0.12, 0.1, 2.0), WOOD, [0.9, h + 0.42, 0]), part(box(0.12, 0.1, 2.0), WOOD, [-0.9, h + 0.42, 0]));
  p.push(part(cyl(0.05, 0.05, h * 1.2, 5), WOOD, [0, h * 0.5, 0.95], [0, 0, 0.75]), part(cyl(0.05, 0.05, h * 1.2, 5), WOOD, [0, h * 0.5, 0.95], [0, 0, -0.75]));
  p.push(part(cyl(0.04, 0.04, 2.4, 5), WOOD, [-0.85, h + 1.5, -0.85]), part(box(0.9, 0.55, 0.03), RED, [-0.38, h + 2.3, -0.85], [0, 0, -0.08]));
  return p;
}
for (const s of sentries) if (s.tower) { const x = cx(s.d) + s.u, z = -s.d; put(s.d, place(towerParts(s.h - 0.75), [x, height(x, z) - 0.3, z], [0, yaw(s.d) + (r() - 0.5) * 0.4, 0])); }
for (const t of torches) {
  const x = cx(t.d) + t.u, z = -t.d;
  put(t.d, place([part(cyl(0.06, 0.08, 2.6, 5), WOOD, [0, 1.2, 0], [0.08, 0, 0.06]), part(cone(0.2, 0.3, 6), WOOD2, [0.07, 2.5, 0.1], [Math.PI, 0, 0]),
    part(sph(0.2, 7, 5), FIRE, [0.07, 2.72, 0.1], [0, 0, 0], [1, 1.5, 1]), part(cone(0.13, 0.45, 5), [3.4, 2.4, 0.8], [0.07, 3.0, 0.1])], [x, height(x, z) - 0.2, z]));
}
// Pennants: two poles at every lip so jumps and drops read from far away.
for (const f of flags) for (const s of [-1, 1]) {
  const u = s * Math.min(f.w - 1.5, 6.5), x = cx(f.d) + u, z = -f.d + 1;
  put(f.d, place([part(cyl(0.05, 0.07, 4.2, 5), BONE, [0, 2, 0]), part(cone(0.42, 1.3, 3), [1.5, 0.25, 0.5], [-s * 0.6, 3.6, 0], [0, 0, s * Math.PI / 2], [1, 1, 0.12]), part(sph(0.1, 6, 5), [2.6, 1.8, 0.6], [0, 4.15, 0])],
    [x, height(x, z) - 0.2, z], [0, yaw(f.d), 0]));
}

// ---- country scenery ---------------------------------------------------------------------
const SNOW = '#e6e2ff', STONE = '#5a5880', GLOW = [3.0, 1.9, 0.7], DARK = '#221c3a';
// A cabin: walls, pitched roof under snow, lit windows, chimney. Front faces +Z.
function cabin({ wall, trim, roof = '#2a2238', w = 5, d = 4, h = 2.8, base = null, balcony = false, extra = [] }) {
  const p = [];
  if (base) p.push(part(box(w + 0.2, 1.3, d + 0.2), base, [0, 0.65, 0]));
  const y0 = base ? 1.3 : 0;
  p.push(part(box(w, h, d), wall, [0, y0 + h / 2, 0]));
  for (const s of [-1, 1]) {
    p.push(part(box(w * 0.66, 0.22, d + 1.2), roof, [s * w * 0.27, y0 + h + 0.72, 0], [0, 0, -s * 0.62]), part(box(w * 0.66, 0.24, d + 1.3), SNOW, [s * w * 0.27, y0 + h + 0.95, 0], [0, 0, -s * 0.62]));
    p.push(part(box(0.9, 0.9, 0.08), GLOW, [s * w * 0.27, y0 + h * 0.55, d / 2 + 0.02]), part(box(1.1, 0.12, 0.12), trim, [s * w * 0.27, y0 + h * 0.55 - 0.52, d / 2 + 0.05]), part(box(1.1, 0.12, 0.12), trim, [s * w * 0.27, y0 + h * 0.55 + 0.52, d / 2 + 0.05]));
  }
  p.push(part(cone(w * 0.56, 1.5, 3), wall, [0, y0 + h + 0.7, d / 2 - 0.02], [0, 0, 0], [1, 1, 0.02]), part(cone(w * 0.56, 1.5, 3), wall, [0, y0 + h + 0.7, -d / 2 + 0.02], [0, 0, 0], [1, 1, 0.02]));
  p.push(part(box(0.9, 1.7, 0.1), trim, [0, y0 + 0.85, d / 2 + 0.03]), part(box(0.6, 1.4, 0.6), STONE, [w * 0.3, y0 + h + 1.5, -0.6]), part(box(0.7, 0.2, 0.7), SNOW, [w * 0.3, y0 + h + 2.3, -0.6]));
  if (balcony) p.push(part(box(w + 0.4, 0.12, 1.0), wall, [0, y0 + 0.05, d / 2 + 0.5]), part(box(w + 0.4, 0.5, 0.08), trim, [0, y0 + 0.5, d / 2 + 0.95]));
  return p.concat(extra);
}
const KITS = {
  norway: [
    [70, 7, 16, 1.5, () => { // troll of piled stone, eyes aglow
      const c = '#4a4674', e = [0.6, 2.8, 3.2];
      return [part(sph(1.7, 9, 7), c, [0, 1.5, 0], [0, 0, 0], [1.15, 1, 0.95]), part(sph(1.15, 8, 6), c, [0, 3.5, 0.1]), part(sph(0.85, 8, 6), '#56528a', [0, 5.0, 0.25], [0, 0, 0], [1.1, 1, 1]),
        part(cone(0.3, 0.9, 5), '#56528a', [0, 4.85, 1.0], [1.5, 0, 0]), part(sph(0.13, 6, 5), e, [-0.32, 5.2, 0.95]), part(sph(0.13, 6, 5), e, [0.32, 5.2, 0.95]),
        part(sph(0.8, 7, 6), c, [-1.75, 3.2, 0.2], [0, 0, 0], [0.8, 1.5, 0.8]), part(sph(0.8, 7, 6), c, [1.75, 3.2, 0.2], [0, 0, 0], [0.8, 1.5, 0.8]), part(sph(0.9, 7, 5), SNOW, [0, 5.75, 0.15], [0, 0, 0], [1.1, 0.4, 1.05]),
        part(sph(1.0, 7, 5), SNOW, [-1.3, 4.3, 0], [0, 0, 0], [1, 0.3, 1]), part(sph(1.0, 7, 5), SNOW, [1.3, 4.3, 0], [0, 0, 0], [1, 0.3, 1])];
    }],
    [150, 8, 20, 1.2, () => cabin({ wall: '#b3262e', trim: '#f4efe6' })],
    [110, 5, 10, 1.3, () => [part(box(1.2, 3.4, 0.5), STONE, [0, 1.6, 0], [0.05, 0, 0.06]), part(sph(0.7, 6, 4), SNOW, [0, 3.35, 0], [0, 0, 0], [1, 0.4, 0.6]),
      part(box(0.08, 1.6, 0.06), [0.5, 2.6, 3.0], [0, 1.9, 0.27]), part(box(0.5, 0.08, 0.06), [0.5, 2.6, 3.0], [0.2, 2.3, 0.27], [0, 0, 0.6]), part(box(0.5, 0.08, 0.06), [0.5, 2.6, 3.0], [-0.2, 1.6, 0.27], [0, 0, 0.6])]],
  ],
  japan: [
    [55, 3.5, 7, 1.25, () => [part(box(0.9, 0.3, 0.9), STONE, [0, 0.15, 0]), part(cyl(0.16, 0.2, 1.3, 6), STONE, [0, 0.9, 0]), part(box(0.8, 0.14, 0.8), STONE, [0, 1.6, 0]),   // stone lantern
      part(box(0.52, 0.5, 0.52), GLOW, [0, 1.92, 0]), part(cone(0.75, 0.5, 4), STONE, [0, 2.4, 0], [0, 0.785, 0]), part(cone(0.78, 0.2, 4), SNOW, [0, 2.6, 0], [0, 0.785, 0]), part(sph(0.12, 6, 5), STONE, [0, 2.72, 0])]],
    [85, 6, 15, 1.3, (q) => { // cherry tree in blossom
      const p = [part(cyl(0.16, 0.3, 3.2, 6), '#2a1c2c', [0, 1.5, 0], [0.12, 0, 0.1]), part(cyl(0.1, 0.15, 2.0, 5), '#2a1c2c', [0.7, 3.2, 0.1], [0, 0, -0.9]), part(cyl(0.1, 0.15, 1.8, 5), '#2a1c2c', [-0.6, 3.3, 0], [0, 0, 0.8])];
      for (let i = 0; i < 7; i++) p.push(part(sph(1.0 + q() * 0.6, 7, 5), i % 3 ? '#ff9cc2' : '#ffc4d8', [(q() - 0.5) * 3.4, 3.6 + q() * 1.6, (q() - 0.5) * 2.6], [0, 0, 0], [1, 0.75, 1]));
      return p;
    }],
    [210, 12, 22, 1.5, () => { // pagoda
      const p = [part(box(3.4, 0.6, 3.4), STONE, [0, 0.3, 0])];
      for (let i = 0; i < 3; i++) { const k = 1 - i * 0.22, y = 0.6 + i * 2.5;
        p.push(part(box(2.6 * k, 1.7, 2.6 * k), '#b02a26', [0, y + 0.85, 0]), part(box(0.7 * k, 0.9, 0.06), GLOW, [0, y + 0.8, 1.31 * k]),
          part(cone(3.3 * k, 0.9, 4), '#241c30', [0, y + 2.1, 0], [0, 0.785, 0]), part(cone(3.35 * k, 0.4, 4), SNOW, [0, y + 2.42, 0], [0, 0.785, 0])); }
      p.push(part(cyl(0.05, 0.08, 2.2, 5), [2.2, 1.6, 0.5], [0, 9.2, 0]));
      return p;
    }],
    [60, 4, 11, 1.2, (q) => { const p = []; for (let i = 0; i < 6; i++) { const x = (q() - 0.5) * 1.8, z = (q() - 0.5) * 1.8, h = 5 + q() * 3; p.push(part(cyl(0.07, 0.09, h, 5), '#5e9a4a', [x, h / 2, z], [(q() - 0.5) * 0.14, 0, (q() - 0.5) * 0.14]), part(sph(0.6, 6, 4), '#7fbf5e', [x, h, z], [0, 0, 0], [1, 0.5, 1]), part(sph(0.45, 6, 4), SNOW, [x, h + 0.25, z], [0, 0, 0], [1, 0.4, 1])); } return p; }],
  ],
  alps: [
    [120, 8, 20, 1.35, () => cabin({ wall: '#6b4428', trim: '#c23a30', base: '#77748e', balcony: true, w: 5.6,
      extra: [part(cyl(0.05, 0.05, 5, 5), '#e8dcc8', [3.6, 2.5, 2.4]), part(box(0.5, 0.9, 0.04), '#2a56c8', [3.86, 4.5, 2.4]), part(box(0.5, 0.9, 0.04), '#f2f2f2', [4.36, 4.5, 2.4]), part(box(0.5, 0.9, 0.04), '#d82c34', [4.86, 4.5, 2.4])] })],
    [90, 4, 9, 1.2, () => [part(cyl(0.07, 0.07, 1.3, 5), '#6b4428', [-1.4, 0.6, 0]), part(cyl(0.07, 0.07, 1.3, 5), '#6b4428', [1.4, 0.6, 0]), part(box(3.2, 0.12, 0.1), '#6b4428', [0, 1.0, 0]), part(box(3.2, 0.12, 0.1), '#6b4428', [0, 0.55, 0]), part(box(3.2, 0.1, 0.16), SNOW, [0, 1.1, 0])]],
  ],
  alaska: [
    [80, 5, 11, 1.3, () => { // totem pole
      const cols = ['#b83232', '#1f6f7a', '#e0a030', '#2c2440'], p = [part(cyl(0.5, 0.56, 6.4, 8), '#3a2a22', [0, 3.2, 0])];
      for (let i = 0; i < 4; i++) { const y = 0.9 + i * 1.5;
        p.push(part(box(1.15, 1.25, 1.1), cols[i], [0, y, 0.05]), part(sph(0.13, 6, 5), [0.7, 2.6, 3.0], [-0.26, y + 0.2, 0.62]), part(sph(0.13, 6, 5), [0.7, 2.6, 3.0], [0.26, y + 0.2, 0.62]), part(cone(0.2, 0.5, 4), '#e8dcc8', [0, y - 0.15, 0.75], [1.5708, 0, 0])); }
      p.push(part(box(3.4, 0.5, 0.2), '#b83232', [0, 5.6, 0.1], [0, 0, 0]), part(box(3.4, 0.14, 0.3), SNOW, [0, 5.92, 0.1]), part(sph(0.6, 6, 4), SNOW, [0, 6.85, 0], [0, 0, 0], [1, 0.4, 1]));
      return p;
    }],
    [140, 8, 20, 1.25, () => cabin({ wall: '#5a3a26', trim: '#e8dcc8', w: 4.6, d: 3.6, h: 2.4, extra: [part(cone(0.07, 0.8, 4), '#e8dcc8', [-0.35, 3.2, 1.9], [0, 0, 0.7]), part(cone(0.07, 0.8, 4), '#e8dcc8', [0.35, 3.2, 1.9], [0, 0, -0.7])] })],
    [45, 5, 24, 1, (q) => { const p = []; for (let i = 0; i < 4; i++) { const s = 1.4 + q() * 2.6; p.push(part(new THREE.OctahedronGeometry(1, 0), i % 2 ? [0.5, 1.15, 1.35] : [0.28, 0.72, 1.1], [(q() - 0.5) * 5, s * 0.6, (q() - 0.5) * 5], [q(), q() * 3, q()], [s * 0.8, s * 1.5, s * 0.7])); } return p; }],   // blue ice seracs
    [420, 12, 20, 1.2, () => [part(cyl(0.6, 0.35, 5.5, 8), '#c8322c', [0, 1.6, 0], [1.5708, 0, 0]), part(box(9, 0.14, 1.4), '#c8322c', [0, 2.35, 0.9]), part(box(2.6, 0.1, 0.9), '#c8322c', [0, 1.9, -2.5]), part(box(0.1, 1.2, 0.9), '#c8322c', [0, 2.4, -2.5]),
      part(box(0.12, 1.9, 0.2), '#221c3a', [0, 1.6, 2.85], [0, 0, 0.5]), part(box(0.25, 0.12, 2.6), '#e8dcc8', [-1.1, 0.25, 0.6]), part(box(0.25, 0.12, 2.6), '#e8dcc8', [1.1, 0.25, 0.6]), part(box(9, 0.14, 1.4), SNOW, [0, 2.5, 0.9])]],   // bush plane on skis
  ],
};
for (const [every, minA, maxA, scale, make] of KITS[LEVEL.id] || []) {
  for (let d = 40 + r() * every; d < FINISH + 60; d += every * (0.65 + r() * 0.7)) {
    const side = r() < 0.5 ? -1 : 1, a = minA + r() * (maxA - minA), x = cx(d) + side * (widthAt(d) + a), z = -d;
    put(d, place(make(r), [x, height(x, z) - 0.35, z], [0, yaw(d) - side * (1.2 + r() * 0.5), 0], scale));
  }
}
// France: gondola lines strung across the piste.
if (LEVEL.id === 'alps') for (let d = 260; d < FINISH; d += 330) {
  const w = widthAt(d) + 9, H = 17, steel = '#8a8aa6', p = [];
  for (const s of [-1, 1]) p.push(part(box(0.5, H, 0.5), steel, [s * w, H / 2, 0], [0, 0, -s * 0.05]), part(box(2.2, 0.3, 0.5), steel, [s * w, H, 0]));
  p.push(part(cyl(0.05, 0.05, w * 2, 5), DARK, [0, H + 0.2, 0], [0, 0, 1.5708]), part(box(0.1, 1.6, 0.1), DARK, [w * 0.25, H - 0.6, 0]), part(box(2.4, 2.1, 2.0), '#d82c34', [w * 0.25, H - 2.4, 0]),
    part(box(2.45, 0.8, 1.5), GLOW, [w * 0.25, H - 2.1, 0]), part(box(2.5, 0.2, 2.1), SNOW, [w * 0.25, H - 1.3, 0]));
  put(d, place(p, [cx(d), height(cx(d), -d), -d], [0, yaw(d), 0]));
}
const propMat = toon(0.5, 0.2);
for (const [c, parts] of chunks) { const m = new THREE.Mesh(merge(parts), propMat); m.castShadow = true; chunked(m, c); }
