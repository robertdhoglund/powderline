// The rider: carve physics, air and landings, a procedurally posed figure, bow in hand, scarf trail.
import * as THREE from 'three';
import { G } from './state.js';
import { T } from './config.js';
import { height, grad, cx, dcx, widthAt, trees } from './course.js';
import { scene } from './world.js';
import { createHero } from './hero.js';
import { clamp, damp, lerp, rand, wrapPi } from './util.js';
import * as snow from './snow.js';
import { Ribbon, shake, arrowMesh, burst } from './fx.js';
const SNOWC = new THREE.Color('#e9e4ff');
import { award, pop, breakFlow, flash } from './hud.js';
import { sfx } from './audio.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const P = {
  x: 0, y: 0, z: 0, d: 0, u: 0, h: 0, v: 0, vy: 0, groundY: 0, alt: 0,
  grounded: true, air: 0, jumpLock: 0, edge: 0, carveT: 0, brake: 0, onIce: false, bonkT: 0,
  crouch: 0.25, squash: 0, pitch: 0, skid: 0, skidSide: 1,
  pos: V(), vel: V(), fwd: V(0, 0, -1), bowPos: V(), chest: V(),
};
const solids = trees.filter((t) => t.solid);

// ---- model ------------------------------------------------------------------------------
// The figure itself (body, head, hair, board, bow, scarf) is built and posed in hero.js.
const hero = createHero({ arrow: arrowMesh() });
export const rider = hero.group; rider.scale.setScalar(1.62); scene.add(rider, hero.world);
export const bow = hero.bow;
const UP = V(0, 1, 0), _d = V(), hot = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

// Landing craters: rings of pushed-up snow that stay where you came down.
const craterGeo = new THREE.TorusGeometry(1, 0.1, 5, 22).rotateX(Math.PI / 2).scale(1, 0.5, 1);
const craterMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
const craters = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(craterGeo, craterMat); m.visible = false; m.receiveShadow = true; scene.add(m); return m; });
let craterN = 0;
const dumped = new Set();

export function resetPlayer() {
  Object.assign(P, { d: G.debugD ?? -24, h: 0, v: T.startSpeed, vy: 0, grounded: true, air: 0, jumpLock: 0, edge: 0, carveT: 0, brake: 0, onIce: false, bonkT: 0, crouch: 0.25, squash: 0, skid: 0 });
  P.z = -P.d; P.x = cx(P.d); P.y = P.groundY = height(P.x, P.z);
  P.pos.set(P.x, P.y, P.z);
  rider.position.set(P.x, P.y, P.z); hero.reset();
  for (const tr of trails) { tr.pts.forEach((p) => p.set(P.x, P.y, P.z)); tr.live = false; }
  P.spin = 0; P.flip = 0; P.flipDir = 0; P.grab = 0; P.grabT = 0; P.trick = { spin: 0 }; P.wasTuck = P.wasBrake = false; craters.forEach((m) => { m.visible = false; }); dumped.clear();
}

function land(impact) {
  const k = clamp(impact / 16, 0, 1);
  P.squash = Math.max(P.squash, 0.35 + k * 0.65); G.punch += 0.25 + k * 0.9; shake(0.12 + k * 0.4);
  snow.puff(P.pos, 30 + (k * 60 | 0), 0.8 + k * 0.6, P.fwd.x * P.v * 0.35, 0, P.fwd.z * P.v * 0.35);
  sfx('land', k);
  if (k > 0.12) {
    const m = craters[craterN++ % craters.length], gr = grad(P.x, P.z), sc = 0.6 + k * 0.8;
    m.position.set(P.x, P.y + 0.02, P.z); m.quaternion.setFromUnitVectors(UP, _d.set(-gr.x, 1, -gr.z).normalize()); m.scale.set(sc, 1, sc * 1.25); m.visible = true;
    burst(P.pos, 10 + (k * 26 | 0), SNOWC, { speed: 5 + k * 6, size: 0.09, life: 1.1, up: 3 + k * 3, gravity: 18, dir: _d.set(P.fwd.x * P.v * 0.5, 0, P.fwd.z * P.v * 0.5) });
  }
  // Score the tricks. A flip or spin has to come round close to square, or the landing is sketchy and scores nothing.
  if (Math.abs(P.spin) < 1.3) P.spin = 0;   // steering in the air to line up a landing is not a trick, and never sketchy
  const spins = Math.round(Math.abs(P.spin) / Math.PI), flips = Math.round(Math.abs(P.flip) / 6.2832), grab = Math.round(P.grabT * 10) / 10;
  const offSpin = Math.abs(Math.abs(P.spin) - spins * Math.PI), offFlip = Math.abs(Math.abs(P.flip) - flips * 6.2832), back = P.flip > 0;
  P.spin = 0; P.flip = 0; P.flipDir = 0; P.grabT = 0; P.grab = 0;
  if (G.mode === 'run' && (spins || flips || grab >= 0.3 || offFlip > 1)) {
    if (offFlip > 1.1 || offSpin > 1.0) { P.v *= 0.72; breakFlow(); shake(0.5); pop('SKETCHY'); G.stats.sketchy++; }
    else {
      const kinds = (spins ? 1 : 0) + (flips ? 1 : 0) + (grab >= 0.3 ? 1 : 0), mult = [1, 1, 1.6, 2.4][kinds];
      const pts = Math.round((spins * 150 + flips * 500 + (grab >= 0.3 ? grab * 400 : 0)) * mult / 10) * 10;
      const name = [flips ? `${flips > 1 ? flips + 'x ' : ''}${back ? 'BACKFLIP' : 'FRONT FLIP'}` : '', spins ? `${spins * 180}` : '', grab >= 0.3 ? 'GRAB' : ''].filter(Boolean).join(' ');
      G.stats.style += pts; G.stats.tricks++; award(pts, name);
    }
  }
  if (G.mode === 'run') {
    G.stats.maxAir = Math.max(G.stats.maxAir, P.air);
    if (P.air > 0.7) award(Math.round(P.air * 10) * 10, `AIR ${P.air.toFixed(1)}s`);
  }
}

export function updatePlayer(dt) {
  const I = G.input, run = G.mode === 'run';
  const turn = run ? I.turn : 0, tuck = run && I.tuck;
  P.brake = damp(P.brake, (run ? I.brake : G.mode === 'finished') ? 1 : 0, 8, dt);
  const g = grad(P.x, P.z);
  let dx = Math.sin(P.h), dz = -Math.cos(P.h);
  const sAlong = -(g.x * dx + g.z * dz);

  if (P.grounded) {
    P.edge = damp(P.edge, turn, turn !== 0 ? T.edgeIn : T.edgeOut, dt);
    P.h += P.edge * T.turnRate * clamp(24 / P.v, 0.62, 1.25) * (tuck ? 0.7 : 1) * (P.onIce ? 0.55 : 1) * dt;
    const gm = Math.hypot(g.x, g.z);
    if (gm > 0.01) P.h += T.fallLine * Math.min(gm, 1.2) * Math.sin(wrapPi(Math.atan2(-g.x, g.z) - P.h)) * (turn !== 0 ? 0.35 : 1) * dt;
    // Hands off the keys, the board eases back along the piste, so you can let go and aim.
    if (turn === 0) {
      const w = widthAt(P.d), off = Math.abs(P.u) - w * 0.75;
      const want = Math.atan(dcx(P.d)) - (off > 0 ? Math.sign(P.u) * Math.min(0.5, off * 0.06) : 0);
      P.h += (want - P.h) * Math.min(1, T.assist * dt);
    }
    let a = T.gravity * sAlong / Math.sqrt(1 + sAlong * sAlong);
    a -= T.dragQuad * (tuck ? T.tuckDrag : 1) * P.v * P.v + T.carveScrub * Math.abs(P.edge) * P.v + T.brakeDecel * P.brake;
    if (P.onIce) a += 6;
    if (tuck) a += T.tuckPush;
    const over = Math.abs(P.u) - widthAt(P.d) - 9; if (over > 0) a -= over * 1.6;
    P.v = clamp(P.v + a * dt, G.mode === 'finished' ? 0 : T.minSpeed, T.maxSpeed);
    // Pump: hold an edge, then let it go, and the board squirts forward.
    if (Math.abs(P.edge) > 0.55) P.carveT = Math.min(0.8, P.carveT + dt);
    else if (Math.abs(P.edge) < 0.25 && P.carveT > 0) {
      if (P.carveT > 0.3 && run) { P.v += T.pumpBoost * P.carveT / 0.8; snow.puff(P.pos, 14, 0.7, dx * P.v * 0.4, 0, dz * P.v * 0.4); sfx('pump'); }
      P.carveT = 0;
    }
    if (I.jump && run) { P.vy += T.jump; P.y += 0.15; P.jumpLock = 0.12; P.squash = 0.5; sfx('jump'); snow.puff(P.pos, 16, 0.7); }
  } else {
    P.h += turn * T.airSteer * dt; P.edge = damp(P.edge, turn * 0.5, 5, dt);
    // Tricks. In the air: hold left or right to spin; tap up for a front flip, down for a backflip (hold for more);
    // hold grab to reach for the board. Flips finish their turn by themselves once started.
    if (P.air > 0.2 && !G.aim.drawing && run) {
      P.spin += turn * 7.5 * dt; P.trick.spin = Math.abs(P.spin);
      if (I.tuck && !P.wasTuck) P.flipDir = -1; else if (I.brake && !P.wasBrake) P.flipDir = 1;
      if (P.flipDir) {
        const before = P.flip; P.flip += P.flipDir * 11 * dt;
        const turns = Math.floor(Math.abs(P.flip) / 6.2832), was = Math.floor(Math.abs(before) / 6.2832);
        if (turns > was && !(P.flipDir < 0 ? I.tuck : I.brake)) { P.flip = Math.sign(P.flip) * turns * 6.2832; P.flipDir = 0; }
      }
      if (I.grab) { P.grabT += dt; P.grab = damp(P.grab, 1, 14, dt); } else P.grab = damp(P.grab, 0, 10, dt);
    }
    P.wasTuck = I.tuck; P.wasBrake = I.brake;
  }
  I.jump = false;
  const ht = Math.atan(dcx(P.d)); P.h = clamp(P.h, ht - T.maxHeading, ht + T.maxHeading);
  dx = Math.sin(P.h); dz = -Math.cos(P.h);
  P.x += dx * P.v * dt; P.z += dz * P.v * dt;

  const ground = height(P.x, P.z), vyG = (ground - P.groundY) / Math.max(dt, 1e-4); P.groundY = ground;
  P.vy -= T.airGravity * dt; P.y += P.vy * dt;
  const vyBefore = P.vy;
  if (P.y <= ground) { P.y = ground; P.vy = vyG; }
  P.alt = P.y - ground; P.jumpLock -= dt;
  P.grounded = P.alt < 0.12 && P.jumpLock <= 0;
  if (P.grounded) { if (P.air > 0.25) land((vyG - vyBefore) / Math.sqrt(1 + sAlong * sAlong)); P.air = 0; } else P.air += dt;

  P.d = -P.z; P.u = P.x - cx(P.d);
  P.pos.set(P.x, P.y, P.z); P.fwd.set(dx, 0, dz); P.vel.set(dx * P.v, P.grounded ? vyG : P.vy, dz * P.v);

  // Trees: a bonk costs speed and flow, never the run.
  P.bonkT -= dt;
  if (P.bonkT <= 0 && P.alt < 5) for (const t of solids) {
    const ex = t.x - P.x, ez = t.z - P.z;
    if (Math.abs(ez) < 2 && ex * ex + ez * ez < (0.55 * t.s + 0.35) ** 2) {
      P.bonkT = 0.8; P.v *= 0.45; P.h += (ex > 0 ? -1 : 1) * 0.5; P.x -= Math.sign(ex) * 0.6;
      shake(0.6); flash(0.25); snow.puff(P.pos, 70, 1.5); sfx('bonk');
      if (run) { breakFlow(); pop('BONK'); G.stats.bonks++; }
      break;
    }
  }

  // Fresh snow sits on the trees too: pass close and it comes down.
  for (const t of solids) {
    const ez = t.z - P.z; if (ez > 3 || ez < -3) continue;
    const ex = t.x - P.x; if (ex * ex + ez * ez > 30 || dumped.has(t)) continue;
    dumped.add(t);
    for (let i = 0; i < 26; i++) snow.emit(t.x + rand(-1.6, 1.6) * t.s, height(t.x, t.z) + rand(4, 10) * t.s, t.z + rand(-1.6, 1.6) * t.s, rand(-1, 1), rand(-1, 1), rand(-1, 1) - P.v * 0.1, rand(0.5, 1.1), rand(0.9, 1.7), 2.2, rand(0.3, 0.55), 1.2, 7);
  }
  if (P.grounded) {
    if (!P.onIce) {
      snow.spray(P, dt, P.brake);
      const e = Math.abs(P.edge), side = P.edge > 0 ? -1 : 1;
      if (Math.random() < dt * (e * 26 + P.brake * 30) * (P.v / 25)) burst(P.pos, 2 + (Math.random() * 3 | 0), SNOWC, { speed: 2.5, size: 0.075, life: 1.0, up: 2.5 + e * 2, gravity: 16, dir: _d.set(Math.cos(P.h) * side * (3 + e * 5) + dx * P.v * 0.55, 0, Math.sin(P.h) * side * (3 + e * 5) + dz * P.v * 0.55) });
      if (sAlong > 0.6 && e > 0.3) snow.sluff(P, dt, side);
    }
    snow.carveTrench(P, !P.onIce, P.brake);
  } else snow.carveTrench(P, false, 0);
  P.onIce = false;
  pose(dt, tuck, sAlong);
}

// ---- pose -------------------------------------------------------------------------------
const S = { aimDir: G.aim.dir, vel: P.vel };
function pose(dt, tuck, sAlong) {
  const aim = G.aim, e = P.edge;
  if (Math.abs(e) > 0.3) P.skidSide = Math.sign(e);
  P.skid = damp(P.skid, P.brake * 1.15 * P.skidSide, 9, dt);
  P.pitch = damp(P.pitch, P.grounded ? Math.atan(-sAlong) : Math.atan2(P.vy, Math.max(P.v, 1)) * 0.6 + 0.12, P.grounded ? 14 : 5, dt);
  P.squash = damp(P.squash, 0, 6, dt);
  P.crouch = damp(P.crouch, clamp((tuck ? 0.75 : 0.28) + (P.grounded ? Math.abs(e) * 0.3 : 0.35) + P.squash * 0.6 - aim.blend * 0.1 + (P.grab || 0) * 0.5 + (P.flipDir ? 0.35 : 0), 0, 1), 10, dt);
  rider.position.set(P.x, P.y + 0.015, P.z);   // the board rides a little way into the powder
  rider.rotation.set(P.pitch + (P.flip || 0), -(P.h + P.skid + P.spin), -e * 0.5 - P.skid * 0.25);

  Object.assign(S, { t: G.t, crouch: P.crouch, edge: e, grounded: P.grounded, aimBlend: aim.blend, draw: aim.draw, drawing: aim.drawing, grab: P.grab || 0, title: G.mode === 'title' || G.mode === 'lobby', heading: P.h, flow: G.flow || 1 });
  hero.update(S, dt);
  P.bowPos.copy(hero.bowPos); P.chest.copy(hero.chest);

  // Light trails: two lines of light laid down by the tail of the board. They brighten with speed and change colour with flow.
  const flow = G.flow || 1, gain = clamp((P.v - 10) / 22, 0.25, 1) * (G.mode === 'run' || G.mode === 'finished' ? 1 : 0.6);
  TRAIL_COL.lerpColors(TRAIL_A, TRAIL_B, clamp((flow - 1) / 3, 0, 1)); if (flow > 4) TRAIL_COL.lerp(TRAIL_C, clamp((flow - 4) / 3, 0, 1));
  for (const tr of trails) {
    _d2.copy(hero.boardTail[tr.side < 0 ? 0 : 1]);
    if (!tr.live) { tr.pts.forEach((q) => q.copy(_d2)); tr.live = true; }
    if (tr.pts[1].distanceToSquared(_d2) > 0.36) { const lastP = tr.pts.pop(); tr.pts.splice(1, 0, lastP); lastP.copy(tr.pts[0]); }
    tr.pts[0].copy(_d2);
    tr.ribbon.color.copy(TRAIL_COL); tr.ribbon.tip.copy(TRAIL_COL).lerp(TRAIL_TIP, 0.6); tr.ribbon.update(tr.pts, 0.3, 0.45 + gain * 0.4);
    tr.core.color.copy(TRAIL_COL).lerp(WHITE, 0.35); tr.core.tip.copy(TRAIL_COL); tr.core.update(tr.pts, 0.5, 1.2 + gain * 1.6);
  }
}
const TN = 30, TRAIL_A = hot('#3fd8ff', 1.7), TRAIL_B = hot('#ff3fa6', 1.9), TRAIL_C = hot('#ffd34a', 2.2), TRAIL_TIP = hot('#8a4cff', 1.2), TRAIL_COL = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1), _d2 = V();
const trails = [-1, 1].map((side) => ({ side, live: false, pts: Array.from({ length: TN }, () => V()), ribbon: new Ribbon(TN, 0.2, TRAIL_A, false, TRAIL_TIP, 1), core: new Ribbon(TN, 0.06, TRAIL_A, false, TRAIL_A, 1) }));
for (const tr of trails) for (const [rb, k] of [[tr.ribbon, -6], [tr.core, -9]]) Object.assign(rb.mesh.material, { polygonOffset: true, polygonOffsetFactor: k, polygonOffsetUnits: k });   // drawn over the trench they lie in
