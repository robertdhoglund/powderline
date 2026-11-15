// Things to hit and things to thread: hovering sentries, pacers that fly ahead of you, carve gates, the finish.
import * as THREE from 'three';
import { G } from './state.js';
import { scene } from './world.js';
import { part, place, merge, toon, loft, sph, cyl, cone, box } from './build.js';
import * as snow from './snow.js';
import { height, cx, dcx, slopeAt, sentries, pacers, gates, FINISH, widthAt } from './course.js';
import { P } from './player.js';
import { burst, ring, hitstop, shake } from './fx.js';
import { award, pop, breakFlow } from './hud.js';
import { LEVEL } from './levels.js';
import { sfx } from './audio.js';
import { clamp, rand } from './util.js';

const GOLD = new THREE.Color('#ffb648').multiplyScalar(3), GREEN = new THREE.Color('#49c486').multiplyScalar(1.3), HIDE = new THREE.Color('#57309a'), FLAME = new THREE.Color('#ff7a2a').multiplyScalar(2.6), VIOLET = new THREE.Color('#b99cff').multiplyScalar(2.2);
// ---- goblins ----------------------------------------------------------------------------
const SKIN = '#49c486', SKIN2 = '#7fe0a0', CLOTH = '#2c1b55', VEST = '#57309a', FUR = '#e2d6ff', METAL = '#6a66b8', BONE = '#f1e9da', RED = '#d62a5c', WOOD = '#4a2f3c', EYE = [3.4, 2.6, 0.4], HOTPINK = [2.2, 0.4, 1.1];
const WHITE = '#ffffff';
// One goblin, facing +Z: pear-shaped in a belted kilt and vest with a fur collar, a wide head under a horned helmet,
// long flat ears, slanted glowing eyes, tusks. pose: 'club' (arm raised with a club), 'sit' (hunched, holding on).
function goblin(pose) {
  const sit = pose === 'sit', p = [];
  const bodyC = [CLOTH, CLOTH, HOTPINK, VEST, VEST, FUR, FUR];
  p.push(part(loft([[0.2, 0.25, 0.22], [0.3, 0.33, 0.28], [0.42, 0.34, 0.29], [0.47, 0.33, 0.28], [0.66, 0.31, 0.26], [0.82, 0.23, 0.2], [0.86, 0.29, 0.25], [0.97, 0.17, 0.15]], (t) => bodyC[Math.min(6, Math.floor(t * 7))], 12), WHITE, [0, 0, 0], [0.12, 0, 0]));
  for (const s of [-1, 1]) {
    p.push(part(cyl(0.075, 0.095, 0.34, 7), SKIN, [s * 0.15, 0.17, sit ? 0.12 : 0], [sit ? -0.9 : 0, 0, 0]), part(sph(0.12, 8, 6), CLOTH, [s * 0.16, 0.05, sit ? 0.3 : 0.08], [0, 0, 0], [1, 0.62, 1.6]));   // legs, feet
    p.push(part(cone(0.1, 0.62, 6), SKIN, [s * 0.5, 1.2, -0.03], [0.12, 0, -s * 1.2], [1, 1, 0.34]));                                                            // long flat ears
    p.push(part(box(0.15, 0.06, 0.04), EYE, [s * 0.125, 1.18, 0.275], [0, 0, -s * 0.38]), part(cone(0.035, 0.15, 5), BONE, [s * 0.11, 1.0, 0.27], [0.25, 0, 0]));       // slanted eyes, tusks
    p.push(part(cone(0.065, 0.36, 6), BONE, [s * 0.25, 1.5, 0], [0, 0, -s * 0.6]), part(new THREE.SphereGeometry(0.13, 8, 5, 0, 6.283, 0, 1.6), METAL, [s * 0.34, 0.84, 0], [0, 0, -s * 0.5]));   // horns, pauldrons
  }
  p.push(part(sph(0.31), SKIN, [0, 1.13, 0.02], [0, 0, 0], [1.12, 0.92, 1]), part(sph(0.2, 9, 7), SKIN2, [0, 1.02, 0.17], [0, 0, 0], [1.12, 0.66, 1]));                // head, jaw
  p.push(part(cone(0.065, 0.26, 6), SKIN2, [0, 1.11, 0.37], [1.4, 0, 0]));                                                                                             // nose
  p.push(part(new THREE.SphereGeometry(0.335, 12, 6, 0, 6.283, 0, 1.4), METAL, [0, 1.19, 0]), part(cyl(0.345, 0.345, 0.055, 12), HOTPINK, [0, 1.25, 0]));                // helmet with a lit band
  // right arm with club, left arm with shield
  p.push(part(cyl(0.06, 0.085, 0.5, 7), SKIN, [sit ? 0.54 : 0.49, sit ? 0.79 : 1.03, 0.05], [0.2, 0, sit ? -1.94 : -0.65]));
  p.push(...place([part(cyl(0.12, 0.05, 0.82, 7), WOOD, [0, 0.35, 0]), part(cone(0.05, 0.17, 5), BONE, [0.11, 0.62, 0], [0, 0, -1.3]), part(cone(0.05, 0.17, 5), BONE, [-0.11, 0.5, 0], [0, 0, 1.3]), part(cone(0.05, 0.17, 5), BONE, [0, 0.56, 0.11], [1.3, 0, 0])],
    sit ? [0.72, 0.72, 0.1] : [0.68, 1.22, 0.05], [0.3, 0, sit ? -1.0 : -0.5]));
  p.push(part(cyl(0.06, 0.085, 0.42, 7), SKIN, [-0.46, 0.72, 0.14], [1.0, 0, 0.5]));
  p.push(part(cyl(0.37, 0.37, 0.06, 14), CLOTH, [-0.5, 0.66, 0.36], [1.5708, 0, 0]), part(cyl(0.3, 0.3, 0.03, 14), RED, [-0.5, 0.66, 0.395], [1.5708, 0, 0]), part(cyl(0.2, 0.2, 0.03, 14), CLOTH, [-0.5, 0.66, 0.41], [1.5708, 0, 0]), part(sph(0.09, 8, 6), HOTPINK, [-0.5, 0.66, 0.43]));
  return p;
}
// The lantern balloon: paper gores in two warm tones, glowing from the burner inside.
const lantern = (() => {
  const rings = [], n = 12; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 0.94 + 0.1, r = Math.sin(a) * 1.38; rings.push([-Math.cos(a) * 1.5, r, r]); }
  return loft(rings, (t, ang) => (Math.floor(ang / 6.2832 * 12) % 2 ? new THREE.Color(1.9, 0.62, 0.34) : new THREE.Color(1.75, 0.36, 0.52)), 12);
})();
const S = 1.55; // goblins are drawn big so they read at range
const towerGeo = merge(place(goblin('club'), [0, -0.95, 0], [0, 0, 0], S));
// Balloon goblin: a patched lantern balloon that glows from the burner, a basket, a goblin holding on.
const balloonGeo = merge([
  ...place(goblin('sit'), [0, -1.2, 0], [0, 0, 0], S * 0.9),
  part(cyl(0.72, 0.6, 0.62, 10), WOOD, [0, -0.95, 0]), part(cyl(0.76, 0.76, 0.08, 10), HOTPINK, [0, -0.64, 0]),
  ...[0, 1, 2, 3].map((i) => part(cyl(0.02, 0.02, 2.3, 4), BONE, [Math.cos(i * 1.571 + 0.78) * 0.62, 0.45, Math.sin(i * 1.571 + 0.78) * 0.62], [Math.sin(i * 1.571 + 0.78) * 0.12, 0, -Math.cos(i * 1.571 + 0.78) * 0.12])),
  part(lantern, WHITE, [0, 2.95, 0]), part(cone(0.86, 1.3, 12), [1.5, 0.3, 0.45], [0, 1.72, 0], [Math.PI, 0, 0]),
  part(cyl(1.41, 1.41, 0.16, 16), RED, [0, 3.0, 0]), part(cyl(1.1, 1.1, 0.14, 16), RED, [0, 3.95, 0]), part(sph(0.5, 8, 6), '#7a3b6e', [0.95, 3.2, 0.75], [0, 0, 0], [1, 1, 0.5]),
  part(sph(0.16, 6, 5), [4, 2.6, 0.8], [0, 1.25, 0]),
]);
// Raider: a goblin crouched on a plank sled with a war banner.
const raiderGeo = merge([
  ...place(goblin('club'), [0, -0.92, 0.1], [0, Math.PI, 0], S),
  part(box(0.95, 0.09, 2.3), WOOD, [0, -1.0, 0]), part(box(0.95, 0.09, 0.5), WOOD, [0, -0.88, -1.3], [0.55, 0, 0]),
  part(box(0.07, 0.16, 2.5), BONE, [0.42, -1.12, 0]), part(box(0.07, 0.16, 2.5), BONE, [-0.42, -1.12, 0]),
  part(cyl(0.035, 0.035, 2.6, 5), WOOD, [0.3, 0.3, 0.95]), part(box(0.03, 0.7, 1.0), [1.15, 0.16, 0.22], [0.3, 1.2, 1.48]),
]);
const gobMat = toon(0.9, 0.3);

export const enemies = [];
function makeEnemy(kind, base) {
  const type = kind === 'pacer' ? 'raider' : base.tower ? 'tower' : 'balloon';
  const group = new THREE.Mesh(type === 'raider' ? raiderGeo : type === 'tower' ? towerGeo : balloonGeo, gobMat);
  group.castShadow = true; group.frustumCulled = false; scene.add(group);
  enemies.push({ kind, type, base, group, pos: group.position, pos2: type === 'balloon' ? new THREE.Vector3() : null, vel: new THREE.Vector3(), alive: true, radius: 1.3, phase: enemies.length * 1.7, t: 0, cool: 0, active: kind === 'sentry', chain: -1 });
}
sentries.forEach((s) => makeEnemy('sentry', s));
pacers.forEach((s) => makeEnemy('pacer', s));

// Gates are arches of light across the line.
// Gates: every mountain has its own, in strong colour, with a bright line across the snow between the posts.
const poleMat = new THREE.MeshBasicMaterial({ color: VIOLET }), poleHit = new THREE.MeshBasicMaterial({ color: GOLD }), gateToon = toon(0.5, 0.35);
const VERM = [1.25, 0.2, 0.14], WOODC = '#3a2218';
const stripe = (c) => part(box(5.6, 0.05, 0.7), c, [0, 0.07, 0]);
const pennants = (y, cols) => [part(box(5.8, 0.05, 0.05), '#e8dcc8', [0, y, 0]), ...[-2.2, -1.32, -0.44, 0.44, 1.32, 2.2].map((x, i) => part(cone(0.3, 0.62, 3), cols[i % cols.length], [x, y - 0.36 - (1 - Math.abs(x) / 2.9) * 0.18, 0], [Math.PI, 0, 0], [1, 1, 0.1]))];
const GATES = {
  // Norway: carved posts with gold dragon curls and a line of pennants.
  arch: () => merge([...[-1, 1].flatMap((s) => [part(cyl(0.15, 0.2, 4.2, 8), WOODC, [s * 2.9, 2.1, 0]), part(new THREE.TorusGeometry(0.34, 0.09, 6, 12, 4.4), [1.7, 1.05, 0.2], [s * 2.72, 4.3, 0], [0, s > 0 ? 0 : Math.PI, 1.2]),
    part(sph(0.13, 6, 5), [0.6, 2.4, 2.8], [s * 2.9, 3.3, 0.17]), part(box(0.5, 0.36, 0.5), '#4a4866', [s * 2.9, 0.18, 0])]), ...pennants(3.9, [[1.6, 0.22, 0.28], [1.7, 1.15, 0.2], [0.2, 1.25, 1.35]]), stripe([1.7, 0.3, 0.75])]),
  // Japan: torii.
  torii: () => merge([part(cyl(0.17, 0.2, 4.4, 8), VERM, [-2.9, 2.2, 0]), part(cyl(0.17, 0.2, 4.4, 8), VERM, [2.9, 2.2, 0]), part(box(7.9, 0.34, 0.55), VERM, [0, 4.55, 0]), part(box(8.3, 0.2, 0.7), '#1d1626', [0, 4.82, 0]),
    part(box(8.3, 0.16, 0.74), '#e6e2ff', [0, 4.98, 0]), part(box(6.6, 0.24, 0.32), VERM, [0, 3.7, 0]), part(box(0.3, 0.6, 0.3), VERM, [0, 4.15, 0]), part(box(0.6, 0.4, 0.6), '#4a4866', [-2.9, 0.2, 0]), part(box(0.6, 0.4, 0.6), '#4a4866', [2.9, 0.2, 0]),
    part(sph(0.26, 8, 6), [3.0, 1.5, 0.5], [0, 3.2, 0], [0, 0, 0], [1, 1.25, 1]), stripe([1.7, 0.9, 0.3])]),
  // France: race gates, red then blue.
  race: (i) => { const c = i % 2 ? [0.2, 0.5, 1.8] : [1.6, 0.16, 0.2]; return merge([...[-1, 1].flatMap((s) => [part(cyl(0.05, 0.05, 3.0, 5), c, [s * 2.9, 1.5, 0]), part(cyl(0.05, 0.05, 3.0, 5), c, [s * 3.9, 1.5, 0]), part(box(1.0, 0.95, 0.05), c, [s * 3.4, 2.4, 0])]), stripe(c)]); },
  // Alaska: small totems holding a bar of ice-blue lanterns.
  totem: () => merge([...[-1, 1].flatMap((s) => [['#b83232', 0.6], ['#1f6f7a', 1.8], ['#e0a030', 3.0]].flatMap(([c, y]) => [part(box(0.7, 1.15, 0.7), c, [s * 2.9, y, 0]), part(sph(0.09, 6, 5), [0.7, 2.6, 3.0], [s * 2.9 - 0.17, y + 0.15, 0.37]), part(sph(0.09, 6, 5), [0.7, 2.6, 3.0], [s * 2.9 + 0.17, y + 0.15, 0.37])])),
    part(box(6.9, 0.2, 0.28), '#b83232', [0, 3.75, 0]), ...[-1.6, 0, 1.6].flatMap((x) => [part(box(0.03, 0.5, 0.03), '#1d1626', [x, 3.4, 0]), part(sph(0.24, 8, 6), [0.5, 2.3, 2.8], [x, 3.0, 0], [0, 0, 0], [1, 1.2, 1])]), stripe([0.4, 1.6, 2.0])]),
};
const GATE_COLORS = { arch: [[1.8, 0.3, 0.8], [1.8, 1.2, 0.2], [0.2, 1.4, 1.5]], torii: [[1.8, 0.3, 0.2], [1.9, 1.2, 0.3]], race: [[1.7, 0.2, 0.25], [0.25, 0.6, 1.9], [2, 2, 2]], totem: [[0.4, 1.8, 2.2], [1.8, 0.3, 0.3], [1.8, 1.2, 0.2]] };
const gateKind = GATES[LEVEL.gate] ? LEVEL.gate : 'arch', gateCols = GATE_COLORS[gateKind].map((c) => new THREE.Color(...c));
const gateGeos = gateKind === 'race' ? [GATES.race(0), GATES.race(1)] : [GATES[gateKind]()];
const gateObjs = gates.map((g, i) => {
  const x = cx(g.d) + g.u, z = -g.d, m = new THREE.Group();
  const o = new THREE.Mesh(gateGeos[i % gateGeos.length], gateToon); o.userData.mat = gateToon; o.castShadow = true; m.add(o);
  m.position.set(x, height(x, z) - 0.1, z); m.rotation.y = -Math.atan(dcx(g.d)); scene.add(m);
  return { ...g, poles: [m], state: 0, t: 0 };
});
// Finish: a row of tall lights across the runout.
{
  const w = widthAt(FINISH), geo = new THREE.CylinderGeometry(0.1, 0.1, 16, 5).translate(0, 8, 0);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x = cx(FINISH) + s * (w - 1 + i * 2.5), z = -FINISH - i * 3, m = new THREE.Mesh(geo, poleHit);
    m.position.set(x, height(x, z), z); m.scale.y = 1 - i * 0.25; scene.add(m);
  }
}
G.totals = { targets: enemies.length, gates: gates.length, ice: 0 };

export function killEnemy(e, perfect, dir) {
  if (!e.alive) return;
  e.alive = false; e.group.visible = false;
  burst(e.pos, perfect ? 30 : 18, GOLD, { speed: perfect ? 17 : 12, size: 0.22, life: 0.8, up: 2, dir });
  burst(e.pos, 14, GREEN, { speed: 10, size: 0.4, life: 1.2, up: 5, dir }); burst(e.pos, 10, HIDE, { speed: 9, size: 0.5, life: 1.4, up: 5, dir });
  if (e.pos2) { burst(e.pos2, 26, FLAME, { speed: 14, size: 0.5, life: 0.9, up: 1 }); ring(e.pos2, FLAME, 9, 0.4); }
  else snow.puff(e.pos, 30, 1.3);
  ring(e.pos, GOLD, perfect ? 12 : 7, perfect ? 0.5 : 0.38);
  shake(perfect ? 0.22 : 0.14);
  sfx('hit', G.flow); if (perfect) sfx('perfect');
  G.stats.kills++; if (perfect) G.stats.perfect++;
  G.aim.focus = Math.min(1, G.aim.focus + 0.4);
  award(perfect ? 500 : 250, e.chain === 0 ? 'CHAIN' : perfect ? 'PERFECT' : e.type === 'balloon' ? 'POP' : 'HIT');
  // Neighbours go off like a string of firecrackers.
  for (const o of enemies) if (o.alive && o.active && o.chain < 0 && o.pos.distanceToSquared(e.pos) < 81) o.chain = 0.13;
}

// ---- snowballs --------------------------------------------------------------------------
const ballGeo = new THREE.IcosahedronGeometry(0.34, 1), ballMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.3, 1.55) });
const balls = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(ballGeo, ballMat); m.visible = false; m.castShadow = true; scene.add(m); return { m, pos: m.position, vel: new THREE.Vector3(), live: false, t: 0 }; });
const CYAN = new THREE.Color('#7af3ff').multiplyScalar(2), _t = new THREE.Vector3();
function throwAt(e) {
  const b = balls.find((x) => !x.live); if (!b) return;
  b.pos.copy(e.pos); b.pos.y += 0.9;
  const t = clamp(b.pos.distanceTo(P.pos) / 36, 0.75, 1.5);
  // Aimed where you will be if you hold your line. Carve and it misses.
  _t.set(P.x + P.vel.x * t + rand(-1.4, 1.4), 0, P.z + P.vel.z * t + rand(-1.4, 1.4)); _t.y = height(_t.x, _t.z) + 1.1;
  b.vel.subVectors(_t, b.pos).divideScalar(t); b.vel.y += 0.5 * 16 * t;
  b.live = true; b.t = 0; b.m.visible = true; sfx('throw');
}
function updateBalls(dt) {
  for (const b of balls) {
    if (!b.live) continue;
    b.t += dt; b.vel.y -= 16 * dt; b.pos.addScaledVector(b.vel, dt); b.m.rotation.x += dt * 9;
    if (Math.random() < dt * 40) snow.emit(b.pos.x, b.pos.y, b.pos.z, 0, 0.3, 0, 0.3, 0.45, 1.5, 0.35, 1, 1);
    let dead = b.t > 3.5;
    if (b.pos.distanceToSquared(P.chest) < 1.5) {
      dead = true; snow.puff(b.pos, 26, 1.2, P.vel.x * 0.5, 0, P.vel.z * 0.5);
      if (G.mode !== 'run') { /* no effect after the finish */ }
      else if (G.shield > 0) { G.shield--; ring(P.chest, CYAN, 5, 0.35); sfx('block'); pop(`BLOCKED  ·  ${G.shield} LEFT`); }
      else { P.v *= 0.78; breakFlow(); shake(0.5); G.frost = 1; G.stats.hits++; sfx('splat'); pop('SPLAT'); }
    } else if (b.pos.y < height(b.pos.x, b.pos.z)) { dead = true; snow.puff(b.pos, 12, 0.8); }
    if (dead) { b.live = false; b.m.visible = false; }
  }
}

const _prev = new THREE.Vector3();
export function updateTargets(dt) {
  updateBalls(dt);
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.chain > 0) { e.chain -= dt; if (e.chain <= 0) { e.chain = 0; killEnemy(e, false, null); continue; } }
    _prev.copy(e.pos);
    const near = e.base.d - P.d;
    if (e.type === 'tower') {
      const b = e.base, x = cx(b.d) + b.u, z = -b.d, hop = Math.abs(Math.sin(G.t * 5 + e.phase)) * (near < 140 ? 0.35 : 0.08);
      e.pos.set(x, height(x, z) + b.h + hop, z);
      e.group.visible = near > -30 && near < 420;
      e.group.rotation.set(0, Math.atan2(P.x - x, P.z - z), Math.sin(G.t * 5 + e.phase) * 0.12);
    } else if (e.type === 'balloon') {
      const b = e.base, x = cx(b.d) + b.u + Math.sin(G.t * 1.1 + e.phase) * 1.3, z = -b.d;
      e.pos.set(x, height(x, z) + b.h + Math.sin(G.t * 1.7 + e.phase) * 0.45, z); e.pos2.set(x, e.pos.y + 2.9, z);
      e.group.visible = near > -30 && near < 420;
      e.group.rotation.set(Math.sin(G.t * 1.3 + e.phase) * 0.07, Math.atan2(P.x - x, P.z - z), Math.cos(G.t * 1.1 + e.phase) * 0.09);
    } else {
      if (!e.active) { e.group.visible = false; if (P.d >= e.base.d && G.mode === 'run') { e.active = true; e.t = 0; e.group.visible = true; } else continue; }
      e.t += dt;
      const leave = Math.max(0, e.t - 8), d = P.d + 40 + 34 * Math.exp(-e.t * 0.9) + leave * leave * 34;
      const sway = Math.sin(e.t * 1.25 + e.phase), x = cx(d) + sway * Math.min(6, widthAt(d) - 2.5), z = -d;
      e.pos.set(x, height(x, z) + 1.2, z);
      e.group.rotation.set(-Math.atan(slopeAt(d)) * 0.8, -Math.atan(dcx(d)) - Math.cos(e.t * 1.25 + e.phase) * 0.45, -Math.cos(e.t * 1.25 + e.phase) * 0.3);
      if (Math.random() < dt * 30) snow.emit(x, e.pos.y - 1.1, z + 1, (Math.random() - 0.5) * 4, 1 + Math.random() * 2.5, 6, 0.5, 0.7, 2.5, 0.4, 2.2, 5);
      if (leave > 1.4) { e.alive = false; e.group.visible = false; continue; }
    }
    if (dt > 1e-4) e.vel.subVectors(e.pos, _prev).divideScalar(dt); if (e.vel.lengthSq() > 90 * 90) e.vel.set(0, 0, 0);
    // Snowballs: lookouts and balloon goblins throw as you come into range, raiders keep throwing.
    e.cool -= dt;
    const ahead = -e.pos.z - P.d;
    if (G.mode === 'run' && e.cool <= 0 && ahead > 24 && ahead < 78 && (e.type !== 'raider' || e.t > 1.6)) {
      e.cool = (e.type === 'raider' ? 2.6 : 2.2) / LEVEL.throws + rand(0, 0.8);
      if (Math.random() < 0.55 * LEVEL.throws) throwAt(e);
    }
  }
  for (const g of gateObjs) {
    if (g.state === 0 && P.d >= g.d) {
      if (Math.abs(P.u - g.u) < 2.9 && P.alt < 5 && G.mode === 'run') {
        g.state = 1; g.t = 0; G.stats.gates++; sfx('gate', G.flow); award(60, 'GATE');
        // Through the gate: a kick of speed, a ring of light and a burst of confetti in the gate's colours.
        P.v = Math.min(P.v + 1.6, 52); _prev.copy(g.poles[0].position).setY(g.poles[0].position.y + 1.6);
        ring(_prev, gateCols[0], 7, 0.4);
        gateCols.forEach((c) => burst(_prev, 9, c, { speed: 8, size: 0.13, up: 5, life: 0.9, gravity: 12, dir: _t.set(P.vel.x * 0.6, 0, P.vel.z * 0.6) }));
      } else g.state = 2;
    }
    if (g.state === 1) { g.t += dt; const k = clamp(g.t / 0.5, 0, 1); g.poles.forEach((p) => p.scale.setScalar(p.children[0].userData.mat ? 1 + Math.sin(k * 3.14) * 0.18 : Math.max(0.01, 1 + Math.sin(k * 3.14) * 0.45 - k * k))); }
  }
}

export function resetTargets() {
  balls.forEach((b) => { b.live = false; b.m.visible = false; });
  for (const e of enemies) { e.alive = true; e.active = e.kind === 'sentry'; e.group.visible = e.active; e.t = 0; e.cool = rand(0, 1); e.chain = -1; e.vel.set(0, 0, 0); }
  for (const g of gateObjs) { g.state = g.d < P.d ? 2 : 0; g.poles.forEach((p) => { p.scale.set(1, 1, 1); p.children.forEach((c) => { c.material = c.userData.mat || poleMat; }); }); }
}
