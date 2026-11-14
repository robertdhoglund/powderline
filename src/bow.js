// The bow. Hold to draw: the camera pulls in, time slows (more in the air), the reticle closes.
// Release: the arrow flies a real arc, but it is solved so it lands where the reticle pointed.
import * as THREE from 'three';
import { G } from './state.js';
import { T } from './config.js';
import { scene, camera } from './world.js';
import { height } from './course.js';
import { P } from './player.js';
import { enemies, killEnemy } from './targets.js';
import { arrowHit, rayHit } from './ice.js';
import { Ribbon, arrowMesh, shake, burst } from './fx.js';
import * as snow from './snow.js';
import { sfx, setDraw } from './audio.js';
import { clamp, damp, lerp } from './util.js';

const A = G.aim, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const target = new THREE.Vector3(), targetVel = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), FWD = new THREE.Vector3(0, 0, -1);
const TRAIL = 14, GOLD = new THREE.Color('#ffd58a').multiplyScalar(2.2);
const arrows = Array.from({ length: 8 }, () => {
  const mesh = arrowMesh(); mesh.scale.setScalar(2.4); mesh.visible = false; scene.add(mesh);
  const trail = new Ribbon(TRAIL, 0.15, GOLD, true); trail.mesh.visible = false;
  return { mesh, trail, pts: Array.from({ length: TRAIL }, () => new THREE.Vector3()), pos: new THREE.Vector3(), vel: new THREE.Vector3(), state: 0, t: 0 };
});
let wasFull = false;

export const focusScale = () => (A.drawing && A.focus > 0 ? (P.grounded ? T.focusGround : T.focusAir) : 1);
export function startDraw() { if (G.mode !== 'run' || A.drawing) return; A.drawing = true; A.draw = 0; wasFull = false; }
export function cancelDraw(silent) { if (A.drawing) { A.drawing = false; A.draw = 0; if (!silent) sfx('cancel'); } }

// Where does an arrow have to leave to arrive at `to`, allowing for its drop and the target's motion?
function solve(from, to, vel, speed, out) {
  let t = from.distanceTo(to) / speed;
  for (let i = 0; i < 3; i++) { out.copy(to).addScaledVector(vel, t); out.y += 0.5 * T.arrowGravity * t * t; t = from.distanceTo(out) / speed; }
  return out.sub(from).normalize();
}
const speedNow = () => lerp(T.arrowSpeedMin, T.arrowSpeedMax, Math.pow(A.drawing ? A.draw : 1, 0.8));

function findTarget() {
  // With focus spent, the hands start to shake.
  const sway = A.drawing && A.focus <= 0 ? 0.035 : 0;
  ndc.set(G.input.mx + Math.sin(G.rt * 7.3) * sway, G.input.my + Math.cos(G.rt * 5.9) * sway);
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  let best = null, bestK = 1, bestT = 0;
  for (const e of enemies) {
    if (!e.alive || !e.group.visible) continue;
    _v.subVectors(e.pos, o); const t = _v.dot(d); if (t < 6 || t > 190) continue;
    const off = Math.sqrt(Math.max(0, _v.lengthSq() - t * t)), k = (off / t) / (T.assistAngle + e.radius / t);
    if (k < bestK) { bestK = k; best = e; bestT = t; }
  }
  A.lock = best;
  if (best) { // magnetism: pull the shot most of the way to the core
    target.copy(o).addScaledVector(d, bestT).lerp(best.pos, 0.7); targetVel.copy(best.vel); return;
  }
  targetVel.set(0, 0, 0);
  let tHit = Math.min(170, rayHit(o, d));
  for (let t = 4; t < tHit; t += 3) {
    _v.copy(o).addScaledVector(d, t);
    if (_v.y < height(_v.x, _v.z)) { let lo = t - 3, hi = t; for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; _v.copy(o).addScaledVector(d, m); if (_v.y < height(_v.x, _v.z)) hi = m; else lo = m; } tHit = hi; break; }
  }
  target.copy(o).addScaledVector(d, tHit);
}

export function release() {
  if (!A.drawing) return;
  A.drawing = false;
  if (A.draw < 0.18 || G.mode !== 'run') { A.draw = 0; return; }
  const a = arrows.find((x) => x.state === 0) || arrows[0], speed = speedNow();
  findTarget();
  a.pos.copy(P.bowPos); solve(a.pos, target, targetVel, speed, a.vel).multiplyScalar(speed);
  a.state = 1; a.t = 0; a.full = A.draw >= 1; a.mesh.visible = true; a.trail.mesh.visible = true; a.pts.forEach((p) => p.copy(a.pos));
  G.punch += 0.12; shake(0.1 + A.draw * 0.1); sfx('release'); A.draw = 0;
}

function segDist(p0, p1, c) {
  _v.subVectors(p1, p0); const l = _v.lengthSq() || 1, t = clamp(_w.subVectors(c, p0).dot(_v) / l, 0, 1);
  return _w.copy(p0).addScaledVector(_v, t).distanceTo(c);
}
const prev = new THREE.Vector3(), dirN = new THREE.Vector3();
export function updateBow(rdt, dt) {
  if (A.drawing) {
    A.draw = Math.min(1, A.draw + rdt / T.drawTime);
    if (A.draw >= 1 && !wasFull) { wasFull = true; sfx('full'); }
    A.focus = Math.max(0, A.focus - (P.grounded ? T.focusDrain : T.focusDrain * 0.7) * rdt);
  } else A.focus = Math.min(1, A.focus + T.focusRegen * rdt);
  A.blend = damp(A.blend, A.drawing ? 1 : 0, A.drawing ? 16 : 7, rdt);
  setDraw(A.draw, A.drawing);
  if (G.mode === 'run') { findTarget(); solve(P.bowPos, target, targetVel, speedNow(), A.dir); }

  for (const a of arrows) {
    if (a.state === 0) continue;
    a.t += dt;
    if (a.state === 1) {
      prev.copy(a.pos); a.vel.y -= T.arrowGravity * dt; a.pos.addScaledVector(a.vel, dt); dirN.copy(a.vel).normalize();
      a.mesh.quaternion.setFromUnitVectors(FWD, dirN); a.mesh.position.copy(a.pos).addScaledVector(dirN, -0.95 * 2.4);
      for (let i = TRAIL - 1; i > 0; i--) a.pts[i].copy(a.pts[i - 1]); a.pts[0].copy(a.pos);
      a.trail.update(a.pts, 1, 1);
      let hit = null, hd = 9;
      for (const e of enemies) { if (!e.alive || !e.group.visible) continue; const d = segDist(prev, a.pos, e.pos); if (d < e.radius + 0.2 && d < hd) { hd = d; hit = e; } }
      if (hit) { killEnemy(hit, hd < 0.62, _v.copy(dirN).multiplyScalar(7)); a.state = 3; a.t = 0; a.mesh.visible = false; }
      else if (arrowHit(prev, a.pos, dirN)) { a.state = 3; a.t = 0; a.mesh.visible = false; }
      else if (a.pos.y < height(a.pos.x, a.pos.z)) { a.state = 2; a.t = 0; snow.puff(a.pos, 10, 0.6); sfx('thunk'); }
      else if (a.t > 4) { a.state = 3; a.t = 0; a.mesh.visible = false; }
    } else {
      // stuck in the snow, or gone: let the trail burn out
      a.trail.update(a.pts, 1, Math.max(0, 1 - a.t * 5));
      if (a.t > (a.state === 2 ? 2.5 : 0.25)) { a.state = 0; a.mesh.visible = false; a.trail.mesh.visible = false; }
    }
  }
}
export function resetBow() { arrows.forEach((a) => { a.state = 0; a.mesh.visible = false; a.trail.mesh.visible = false; }); wasFull = false; }
