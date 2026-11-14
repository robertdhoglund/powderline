// Static set dressing, merged into one mesh: goblin watchtowers, torches, and pennants that mark jumps and drops.
import * as THREE from 'three';
import { scene } from './world.js';
import { height, cx, dcx, sentries, torches, flags, kickers } from './course.js';
import { part, place, merge, toon, cyl, cone, box, sph } from './build.js';
import { rng } from './util.js';

const WOOD = '#4a2f24', WOOD2 = '#5e3b2a', RED = '#c22a3c', FIRE = [3.2, 1.5, 0.35], BONE = '#e8dcc8';
const r = rng(808), all = [];
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
for (const s of sentries) if (s.tower) { const x = cx(s.d) + s.u, z = -s.d; all.push(...place(towerParts(s.h - 0.75), [x, height(x, z) - 0.3, z], [0, yaw(s.d) + (r() - 0.5) * 0.4, 0])); }
for (const t of torches) {
  const x = cx(t.d) + t.u, z = -t.d;
  all.push(...place([part(cyl(0.06, 0.08, 2.6, 5), WOOD, [0, 1.2, 0], [0.08, 0, 0.06]), part(cone(0.2, 0.3, 6), WOOD2, [0.07, 2.5, 0.1], [Math.PI, 0, 0]),
    part(sph(0.2, 7, 5), FIRE, [0.07, 2.72, 0.1], [0, 0, 0], [1, 1.5, 1]), part(cone(0.13, 0.45, 5), [3.4, 2.4, 0.8], [0.07, 3.0, 0.1])], [x, height(x, z) - 0.2, z]));
}
// Pennants: two poles at every lip so jumps and drops read from far away.
for (const f of flags) for (const s of [-1, 1]) {
  const u = s * Math.min(f.w - 1.5, 6.5), x = cx(f.d) + u, z = -f.d + 1;
  all.push(...place([part(cyl(0.05, 0.07, 4.2, 5), BONE, [0, 2, 0]), part(cone(0.42, 1.3, 3), [1.5, 0.25, 0.5], [-s * 0.6, 3.6, 0], [0, 0, s * Math.PI / 2], [1, 1, 0.12]), part(sph(0.1, 6, 5), [2.6, 1.8, 0.6], [0, 4.15, 0])],
    [x, height(x, z) - 0.2, z], [0, yaw(f.d), 0]));
}
const mesh = new THREE.Mesh(merge(all), toon(0.5, 0.2));
mesh.frustumCulled = false; mesh.castShadow = true; scene.add(mesh);
