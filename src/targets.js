// Things to hit and things to thread: hovering sentries, pacers that fly ahead of you, carve gates, the finish.
import * as THREE from 'three';
import { G } from './state.js';
import { scene } from './world.js';
import { height, cx, sentries, pacers, gates, FINISH, widthAt } from './course.js';
import { P } from './player.js';
import { burst, ring, hitstop, shake } from './fx.js';
import { award } from './hud.js';
import { sfx } from './audio.js';
import { clamp, smoothstep, damp } from './util.js';

const GOLD = new THREE.Color('#ffb648').multiplyScalar(3), SHELL = new THREE.Color('#2a1f66'), VIOLET = new THREE.Color('#b99cff').multiplyScalar(2.2);
const shellGeo = new THREE.ConeGeometry(0.95, 1.05, 4), coreGeo = new THREE.IcosahedronGeometry(0.42, 0), bladeGeo = new THREE.BoxGeometry(0.75, 0.05, 0.16);
const shellMat = new THREE.MeshLambertMaterial({ color: '#241a5c', flatShading: true });
const edgeGeo = new THREE.EdgesGeometry(shellGeo), edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#ff9d3c').multiplyScalar(1.6) });
const coreMat = new THREE.MeshBasicMaterial({ color: GOLD });

export const enemies = [];
function makeEnemy(kind, base) {
  const group = new THREE.Group();
  const top = new THREE.Mesh(shellGeo, shellMat), bot = new THREE.Mesh(shellGeo, shellMat); bot.rotation.x = Math.PI;
  top.add(new THREE.LineSegments(edgeGeo, edgeMat)); bot.add(new THREE.LineSegments(edgeGeo, edgeMat));
  const core = new THREE.Mesh(coreGeo, coreMat), spin = new THREE.Group();
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(bladeGeo, coreMat); b.position.set(Math.cos(i * 2.094) * 1.5, 0, Math.sin(i * 2.094) * 1.5); b.rotation.y = -i * 2.094; spin.add(b); }
  group.add(top, bot, core, spin); scene.add(group);
  const e = { kind, base, group, top, bot, core, spin, pos: group.position, vel: new THREE.Vector3(), alive: true, radius: 1.3, phase: enemies.length * 1.7, open: 0, t: 0, active: kind === 'sentry', chain: -1 };
  enemies.push(e); return e;
}
sentries.forEach((s) => makeEnemy('sentry', s));
pacers.forEach((s) => makeEnemy('pacer', s));

// ---- gates ------------------------------------------------------------------------------
const poleGeo = new THREE.CylinderGeometry(0.09, 0.09, 3.4, 5).translate(0, 1.7, 0), capGeo = new THREE.OctahedronGeometry(0.2, 0).translate(0, 3.6, 0);
const poleMat = new THREE.MeshBasicMaterial({ color: VIOLET }), poleHit = new THREE.MeshBasicMaterial({ color: GOLD });
const gateObjs = gates.map((g) => {
  const poles = [-1, 1].map((s) => {
    const x = cx(g.d) + g.u + s * 2.9, z = -g.d, m = new THREE.Group();
    m.add(new THREE.Mesh(poleGeo, poleMat), new THREE.Mesh(capGeo, poleMat)); m.position.set(x, height(x, z) - 0.1, z); scene.add(m); return m;
  });
  return { ...g, poles, state: 0, t: 0 };
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
  burst(e.pos, perfect ? 46 : 28, GOLD, { speed: perfect ? 18 : 13, size: 0.26, life: 0.9, up: 2, dir });
  burst(e.pos, 12, SHELL, { speed: 9, size: 0.6, life: 1.3, up: 4, dir });
  ring(e.pos, GOLD, perfect ? 13 : 8, perfect ? 0.5 : 0.38);
  hitstop(perfect ? 0.11 : 0.07); shake(perfect ? 0.4 : 0.26);
  sfx('hit', G.flow); if (perfect) sfx('perfect');
  G.stats.kills++; if (perfect) G.stats.perfect++;
  G.aim.focus = Math.min(1, G.aim.focus + 0.4);
  award(perfect ? 500 : 250, e.chain === 0 ? 'CHAIN' : perfect ? 'PERFECT' : 'HIT');
  // Neighbours go off like a string of firecrackers.
  for (const o of enemies) if (o.alive && o.chain < 0 && o.pos.distanceToSquared(e.pos) < 81) o.chain = 0.13;
}

const _prev = new THREE.Vector3();
export function updateTargets(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.chain > 0) { e.chain -= dt; if (e.chain <= 0) { e.chain = 0; killEnemy(e, false, null); continue; } }
    _prev.copy(e.pos);
    if (e.kind === 'sentry') {
      const b = e.base, x = cx(b.d) + b.u + Math.sin(G.t * 1.3 + e.phase) * 1.2, z = -b.d;
      e.pos.set(x, height(x, z) + b.h + Math.sin(G.t * 2 + e.phase) * 0.4, z);
      e.group.visible = b.d - P.d > -30 && b.d - P.d < 420;
      e.open = damp(e.open, smoothstep(150, 90, b.d - P.d), 6, dt);
    } else {
      if (!e.active) { e.group.visible = false; if (P.d >= e.base.d && G.mode === 'run') { e.active = true; e.t = 0; e.group.visible = true; } else continue; }
      e.t += dt;
      const leave = Math.max(0, e.t - 7.5), d = P.d + 44 + 34 * Math.exp(-e.t * 0.9) + leave * leave * 30;
      const x = cx(d) + Math.sin(e.t * 1.25 + e.phase) * 6.5, z = -d;
      e.pos.set(x, height(x, z) + 4.2 + Math.sin(e.t * 2.3) * 1.3 + leave * leave * 16, z);
      e.open = damp(e.open, 1, 4, dt);
      if (leave > 1.6) { e.alive = false; e.group.visible = false; continue; }
    }
    if (dt > 1e-4) e.vel.subVectors(e.pos, _prev).divideScalar(dt); if (e.vel.lengthSq() > 90 * 90) e.vel.set(0, 0, 0);
    const gap = 0.12 + e.open * 0.5;
    e.top.position.y = 0.52 + gap; e.bot.position.y = -0.52 - gap;
    e.group.rotation.y += dt * 0.9; e.spin.rotation.y -= dt * (2 + e.open * 4);
    e.core.scale.setScalar((0.55 + e.open * 0.45) * (1 + Math.sin(G.t * 9 + e.phase) * 0.08));
  }
  for (const g of gateObjs) {
    if (g.state === 0 && P.d >= g.d) {
      if (Math.abs(P.u - g.u) < 2.9 && P.alt < 5 && G.mode === 'run') {
        g.state = 1; g.t = 0; G.stats.gates++; sfx('gate', G.flow); award(60, 'GATE');
        g.poles.forEach((p) => { p.children.forEach((c) => { c.material = poleHit; }); burst(p.position, 8, GOLD, { speed: 6, size: 0.14, up: 6, life: 0.7 }); });
      } else g.state = 2;
    }
    if (g.state === 1) { g.t += dt; const k = clamp(g.t / 0.5, 0, 1); g.poles.forEach((p) => p.scale.set(1 + (1 - k) * 0.6, Math.max(0.02, 1 + Math.sin(k * 3.14) * 0.5 - k * k), 1 + (1 - k) * 0.6)); }
  }
}

export function resetTargets() {
  for (const e of enemies) { e.alive = true; e.active = e.kind === 'sentry'; e.group.visible = e.active; e.open = 0; e.t = 0; e.chain = -1; e.vel.set(0, 0, 0); }
  for (const g of gateObjs) { g.state = g.d < P.d ? 2 : 0; g.poles.forEach((p) => { p.scale.set(1, 1, 1); p.children.forEach((c) => { c.material = poleMat; }); }); }
}
