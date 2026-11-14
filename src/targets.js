// Things to hit and things to thread: hovering sentries, pacers that fly ahead of you, carve gates, the finish.
import * as THREE from 'three';
import { G } from './state.js';
import { scene } from './world.js';
import { part, place, merge, toon, sph, cyl, cone, box } from './build.js';
import * as snow from './snow.js';
import { height, cx, dcx, slopeAt, sentries, pacers, gates, FINISH, widthAt } from './course.js';
import { P } from './player.js';
import { burst, ring, hitstop, shake } from './fx.js';
import { award, pop, breakFlow } from './hud.js';
import { LEVEL } from './levels.js';
import { sfx } from './audio.js';
import { clamp, rand } from './util.js';

const GOLD = new THREE.Color('#ffb648').multiplyScalar(3), GREEN = new THREE.Color('#7fd058').multiplyScalar(1.2), HIDE = new THREE.Color('#5e3b2a'), FLAME = new THREE.Color('#ff7a2a').multiplyScalar(2.6), VIOLET = new THREE.Color('#b99cff').multiplyScalar(2.2);
// ---- goblins ----------------------------------------------------------------------------
const SKIN = '#6fae4c', SKIN2 = '#8cc65e', LEATHER = '#4d3024', METAL = '#7d7aa8', BONE = '#efe6d2', RED = '#c22a3c', WOOD = '#5e3b2a', EYE = [3.2, 2.5, 0.4];
// One goblin, facing +Z. pose: 'club' (arm raised with a club), 'sit' (hunched, holding on).
function goblin(pose) {
  const sit = pose === 'sit', p = [];
  p.push(part(sph(0.34), LEATHER, [0, 0.62, 0], [0.15, 0, 0], [1, 1.08, 0.86]), part(cone(0.36, 0.42, 8), '#3b2a52', [0, 0.36, 0]));          // body, kilt
  for (const s of [-1, 1]) {
    p.push(part(cyl(0.085, 0.1, 0.36, 7), SKIN, [s * 0.15, 0.17, sit ? 0.12 : 0], [sit ? -0.9 : 0, 0, 0]), part(sph(0.12, 8, 6), LEATHER, [s * 0.16, 0.05, sit ? 0.3 : 0.07], [0, 0, 0], [1, 0.7, 1.5])); // legs, feet
    p.push(part(cone(0.085, 0.5, 6), SKIN, [s * 0.44, 1.2, -0.02], [0.1, 0, -s * 1.15]));                                                    // long ears
    p.push(part(sph(0.06, 7, 5), EYE, [s * 0.115, 1.19, 0.265]), part(cone(0.035, 0.14, 5), BONE, [s * 0.1, 1.0, 0.27], [0.25, 0, 0]));        // eyes, tusks
    p.push(part(cone(0.07, 0.34, 6), BONE, [s * 0.24, 1.47, 0], [0, 0, -s * 0.55]), part(sph(0.15, 8, 6), '#6a5140', [s * 0.36, 0.86, 0]));    // horns, fur shoulders
  }
  p.push(part(sph(0.31), SKIN, [0, 1.13, 0.02], [0, 0, 0], [1.08, 0.95, 1]), part(sph(0.2, 9, 7), SKIN2, [0, 1.03, 0.16], [0, 0, 0], [1.1, 0.7, 1]));  // head, jaw
  p.push(part(cone(0.07, 0.24, 6), SKIN2, [0, 1.12, 0.36], [1.4, 0, 0]));                                                                        // nose
  p.push(part(new THREE.SphereGeometry(0.33, 12, 6, 0, 6.283, 0, 1.45), METAL, [0, 1.19, 0]), part(cyl(0.34, 0.34, 0.06, 12), '#55527e', [0, 1.24, 0])); // helmet
  // right arm with club, left arm with shield
  p.push(part(cyl(0.07, 0.085, 0.5, 7), SKIN, [sit ? 0.54 : 0.49, sit ? 0.79 : 1.03, 0.05], [0.2, 0, sit ? -1.94 : -0.65]));
  p.push(...place([part(cyl(0.11, 0.055, 0.8, 7), WOOD, [0, 0.35, 0]), part(cone(0.05, 0.16, 5), BONE, [0.1, 0.62, 0], [0, 0, -1.3]), part(cone(0.05, 0.16, 5), BONE, [-0.1, 0.5, 0], [0, 0, 1.3]), part(cone(0.05, 0.16, 5), BONE, [0, 0.56, 0.1], [1.3, 0, 0])],
    sit ? [0.72, 0.72, 0.1] : [0.68, 1.22, 0.05], [0.3, 0, sit ? -1.0 : -0.5]));
  p.push(part(cyl(0.07, 0.085, 0.42, 7), SKIN, [-0.46, 0.72, 0.14], [1.0, 0, 0.5]));
  p.push(part(cyl(0.36, 0.36, 0.07, 12), WOOD, [-0.5, 0.66, 0.36], [1.5708, 0, 0]), part(sph(0.11, 8, 6), METAL, [-0.5, 0.66, 0.42]), part(cyl(0.37, 0.37, 0.03, 12), RED, [-0.5, 0.66, 0.39], [1.5708, 0, 0], [1, 1, 0.55]));
  return p;
}
const S = 1.55; // goblins are drawn big so they read at range
const towerGeo = merge(place(goblin('club'), [0, -0.95, 0], [0, 0, 0], S));
// Balloon goblin: a patched lantern balloon that glows from the burner, a basket, a goblin holding on.
const balloonGeo = merge([
  ...place(goblin('sit'), [0, -1.2, 0], [0, 0, 0], S * 0.9),
  part(cyl(0.72, 0.6, 0.62, 10), WOOD, [0, -0.95, 0]), part(cyl(0.76, 0.76, 0.08, 10), LEATHER, [0, -0.64, 0]),
  ...[0, 1, 2, 3].map((i) => part(cyl(0.02, 0.02, 2.3, 4), BONE, [Math.cos(i * 1.571 + 0.78) * 0.62, 0.45, Math.sin(i * 1.571 + 0.78) * 0.62], [Math.sin(i * 1.571 + 0.78) * 0.12, 0, -Math.cos(i * 1.571 + 0.78) * 0.12])),
  part(sph(1.35, 16, 12), [1.75, 0.72, 0.3], [0, 2.9, 0], [0, 0, 0], [1, 1.12, 1]), part(cone(0.9, 1.3, 12), [1.5, 0.55, 0.22], [0, 1.75, 0], [Math.PI, 0, 0]),
  part(cyl(1.37, 1.37, 0.16, 16), RED, [0, 3.0, 0]), part(cyl(1.02, 1.02, 0.14, 16), RED, [0, 3.95, 0]), part(sph(0.5, 8, 6), '#7a3b6e', [0.95, 3.2, 0.75], [0, 0, 0], [1, 1, 0.5]),
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
const archGeo = new THREE.TorusGeometry(2.9, 0.07, 6, 40, Math.PI), footGeo = new THREE.OctahedronGeometry(0.28, 0);
const poleMat = new THREE.MeshBasicMaterial({ color: VIOLET }), poleHit = new THREE.MeshBasicMaterial({ color: GOLD });
const gateObjs = gates.map((g) => {
  const x = cx(g.d) + g.u, z = -g.d, m = new THREE.Group();
  m.add(new THREE.Mesh(archGeo, poleMat));
  for (const s of [-1, 1]) { const f = new THREE.Mesh(footGeo, poleMat); f.position.set(s * 2.9, 0.25, 0); m.add(f); }
  m.position.set(x, height(x, z) - 0.15, z); m.rotation.y = -Math.atan(dcx(g.d)); scene.add(m);
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
  hitstop(perfect ? 0.11 : 0.07); shake(perfect ? 0.4 : 0.26);
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
        g.poles.forEach((p) => { p.children.forEach((c) => { c.material = poleHit; }); burst(_prev.copy(p.position).setY(p.position.y + 2.6), 14, GOLD, { speed: 7, size: 0.14, up: 3, life: 0.7 }); });
      } else g.state = 2;
    }
    if (g.state === 1) { g.t += dt; const k = clamp(g.t / 0.5, 0, 1); g.poles.forEach((p) => p.scale.setScalar(Math.max(0.01, 1 + Math.sin(k * 3.14) * 0.45 - k * k))); }
  }
}

export function resetTargets() {
  balls.forEach((b) => { b.live = false; b.m.visible = false; });
  for (const e of enemies) { e.alive = true; e.active = e.kind === 'sentry'; e.group.visible = e.active; e.t = 0; e.cool = rand(0, 1); e.chain = -1; e.vel.set(0, 0, 0); }
  for (const g of gateObjs) { g.state = g.d < P.d ? 2 : 0; g.poles.forEach((p) => { p.scale.set(1, 1, 1); p.children.forEach((c) => { c.material = poleMat; }); }); }
}
