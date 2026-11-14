// The rider: carve physics, air and landings, a procedurally posed figure, bow in hand, scarf trail.
import * as THREE from 'three';
import { G } from './state.js';
import { T } from './config.js';
import { height, grad, cx, dcx, widthAt, trees } from './course.js';
import { scene, rim } from './world.js';
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
export const rider = new THREE.Group(); rider.rotation.order = 'YXZ'; rider.scale.setScalar(1.5); scene.add(rider);
const lam = (c, e = 0.3, k = 0.8) => rim(new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: e }), k, 2.2);
const glow = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
// The hero: a young ranger. Emerald tunic, cream sleeves, tall leather boots, copper hair, an ochre cape that flies behind.
const M = { tunic: lam('#1fa36c', 0.3), cream: lam('#f3e8d2', 0.3), sand: lam('#d9c7a4', 0.28), leather: lam('#74442a', 0.3), skin: lam('#f4c8a0', 0.4), hair: lam('#d8622a', 0.45),
  cape: lam('#e0a030', 0.4), dark: lam('#1b1640', 0.15), suit: lam('#2b2470', 0.2), hot: glow('#ffd070', 2.2), gold: glow('#ffc46b', 2.6), bowGlow: glow('#fff1dc', 0.95), eye: lam('#1b1640', 0) };
const add = (geo, m, parent = rider) => { const o = new THREE.Mesh(geo, m); parent.add(o); return o; };
const ball = (r, m, parent = rider, sx = 1, sy = 1, sz = 1) => { const o = add(new THREE.SphereGeometry(r, 16, 12), m, parent); o.scale.set(sx, sy, sz); return o; };
const box = (w, h, d, m, parent = rider) => add(new THREE.BoxGeometry(w, h, d), m, parent);
const limbGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
const limb = (r, m, r2 = r) => { const o = add(r2 === r ? limbGeo : new THREE.CylinderGeometry(r2 / r, 1, 1, 12), m); o.userData.r = r; return o; };
const UP = V(0, 1, 0), _d = V(), _p = V(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
function setLimb(o, a, b) {
  _d.subVectors(b, a); const len = _d.length() || 0.001;
  o.position.addVectors(a, b).multiplyScalar(0.5); o.scale.set(o.userData.r, len, o.userData.r);
  o.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
}
function ik(a, b, l1, l2, pole, out) {
  _d.subVectors(b, a); const dist = Math.min(_d.length(), l1 + l2 - 0.001); _d.normalize();
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d)).normalize();
  return out.copy(a).addScaledVector(_d, x).addScaledVector(_p, h);
}

// Board: forward is -Z. A real outline with sidecut, rounded nose and tail that kick up.
const board = new THREE.Group(); rider.add(board);
function deckGeometry(scale, thick) {
  const sh = new THREE.Shape(), pts = [], half = (y) => 0.158 - 0.028 * Math.cos(y / 0.56 * Math.PI / 2);
  for (let i = 0; i <= 10; i++) { const y = -0.56 + i * 0.112; pts.push([half(y), y]); }
  for (let i = 1; i < 10; i++) { const a = i / 10 * Math.PI; pts.push([Math.cos(a) * 0.158, 0.56 + Math.sin(a) * 0.25]); }
  for (let i = 10; i >= 0; i--) { const y = -0.56 + i * 0.112; pts.push([-half(y), y]); }
  for (let i = 1; i < 10; i++) { const a = Math.PI + i / 10 * Math.PI; pts.push([Math.cos(a) * 0.158, -0.56 + Math.sin(a) * 0.25]); }
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x * scale, y * (0.6 + scale * 0.4)) : sh.moveTo(x * scale, y * (0.6 + scale * 0.4))));
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = Math.max(0, Math.abs(p.getZ(i)) - 0.5); p.setY(i, p.getY(i) + k * k * 1.5); }
  g.computeVertexNormals(); return g;
}
add(deckGeometry(1, 0.03), M.dark, board).position.y = 0.02;
add(deckGeometry(0.42, 0.006), M.hot, board).position.y = 0.062;
const bootF = ball(0.1, M.leather, rider, 1.75, 1.05, 1.1), bootB = ball(0.1, M.leather, rider, 1.75, 1.05, 1.1);
for (const z of [-0.27, 0.27]) box(0.3, 0.05, 0.2, M.suit, board).position.set(0, 0.075, z);
const thighF = limb(0.095, M.sand, 0.08), shinF = limb(0.088, M.leather, 0.075), thighB = limb(0.095, M.sand, 0.08), shinB = limb(0.088, M.leather, 0.075);
const kneeF = ball(0.09, M.leather), kneeB = ball(0.09, M.leather);
const pelvis = ball(0.17, M.sand, rider, 1, 0.8, 1.15);
// Tunic: flared skirt below a belt, drawn as a profile and spun.
const tunicGeo = new THREE.LatheGeometry([[0.001, 0], [0.3, 0.0], [0.27, 0.12], [0.2, 0.34], [0.195, 0.42], [0.215, 0.7], [0.235, 0.86], [0.19, 0.96], [0.09, 1.03], [0.001, 1.04]].map(([x, y]) => new THREE.Vector2(x, y - 0.5)), 20);
const torso = add(tunicGeo, M.tunic); torso.userData.r = 1;
const belt = add(new THREE.TorusGeometry(0.2, 0.035, 8, 20).rotateX(Math.PI / 2), M.leather, torso); belt.position.y = -0.11; belt.scale.set(1, 1, 1);
add(new THREE.BoxGeometry(0.07, 0.08, 0.03), M.gold, torso).position.set(0.21, -0.11, 0);
const shoulders = ball(0.09, M.tunic), shoulderB = ball(0.09, M.tunic);
const upperF = limb(0.07, M.cream, 0.06), foreF = limb(0.064, M.leather, 0.05), upperB = limb(0.07, M.cream, 0.06), foreB = limb(0.064, M.leather, 0.05);
const elbowF = ball(0.064, M.cream), elbowB = ball(0.064, M.cream);
const handF = ball(0.06, M.skin), handB = ball(0.06, M.skin);
// Head: front is -Z. Big tousled copper hair, pointed ears.
const head = new THREE.Group(); rider.add(head); head.scale.setScalar(1.18);
ball(0.165, M.skin, head, 1, 1.05, 1);
add(new THREE.SphereGeometry(0.185, 16, 10, 0, 6.283, 0, 1.75).rotateX(0.55), M.hair, head).position.set(0, 0.02, 0.02);
[[0, 0.14, -0.15, -1.9, 0, 0.1, 0.16], [0.08, 0.13, -0.14, -1.8, 0, -0.5, 0.14], [-0.08, 0.13, -0.14, -1.8, 0, 0.5, 0.14], [0.13, 0.1, -0.08, -1.2, 0, -1.2, 0.12], [-0.13, 0.1, -0.08, -1.2, 0, 1.2, 0.12],
  [0, 0.17, 0.1, 0.9, 0, 0, 0.2], [0.09, 0.12, 0.15, 1.3, 0, -0.4, 0.2], [-0.09, 0.12, 0.15, 1.3, 0, 0.4, 0.2], [0, 0.02, 0.19, 1.9, 0, 0, 0.22], [0, 0.21, 0, 0.2, 0, 0.3, 0.14]]
  .forEach(([x, y, z, rx, ry, rz, len]) => { const t = add(new THREE.ConeGeometry(0.06, len, 6), M.hair, head); t.position.set(x, y, z); t.rotation.set(rx, ry, rz); });
for (const sd of [-1, 1]) {
  const ear = add(new THREE.ConeGeometry(0.035, 0.17, 6), M.skin, head); ear.position.set(sd * 0.185, 0.02, 0.03); ear.rotation.set(0.5, 0, -sd * 1.25);
  ball(0.022, M.eye, head).position.set(sd * 0.065, 0.01, -0.153);
}
const collar = add(new THREE.SphereGeometry(0.17, 12, 8).scale(1.1, 0.55, 1.25), M.cape);            // hood, worn down
const clasp = ball(0.04, M.gold);
const quiver = add(new THREE.CylinderGeometry(0.06, 0.045, 0.5, 10), M.leather);
for (let i = 0; i < 4; i++) { const f = box(0.02, 0.14, 0.05, M.hot, quiver); f.position.set(Math.cos(i * 1.6) * 0.025, 0.31, Math.sin(i * 1.6) * 0.025); f.rotation.y = i; }

// Bow: -Z points at the target. Limbs flex and the string pulls back with the draw.
export const bow = new THREE.Group(); rider.add(bow);
const limbCurve = new THREE.CatmullRomCurve3([V(0, 0.05, -0.02), V(0, 0.32, -0.05), V(0, 0.58, 0.06), V(0, 0.72, 0.17)]);
const limbTube = new THREE.TubeGeometry(limbCurve, 10, 0.03, 5);
const bowUp = new THREE.Group(), bowDown = new THREE.Group(); bow.add(bowUp, bowDown);
bowUp.add(new THREE.Mesh(limbTube, M.bowGlow)); { const t = new THREE.Mesh(limbTube, M.bowGlow); t.scale.y = -1; bowDown.add(t); }
bow.scale.setScalar(1.35);
for (const g of [bowUp, bowDown]) { const tip = box(0.035, 0.07, 0.035, M.gold, g); tip.position.set(0, g === bowUp ? 0.72 : -0.72, 0.17); }
add(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), M.dark, bow);
const stringGeo = new THREE.BufferGeometry(); stringGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
bow.add(new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(2, 2, 2) })));
const nocked = arrowMesh(); bow.add(nocked);


rider.traverse((o) => { o.castShadow = true; });
// Cape: one simulated spine, spread into a sheet across the wind.
const SC = 9, scarfPts = Array.from({ length: SC }, () => V());
const capePos = new Float32Array(SC * 9), capeGeo = new THREE.BufferGeometry();
capeGeo.setAttribute('position', new THREE.BufferAttribute(capePos, 3).setUsage(THREE.DynamicDrawUsage));
{ const idx = []; for (let i = 0; i < SC - 1; i++) for (let j = 0; j < 2; j++) { const k = i * 3 + j; idx.push(k, k + 3, k + 1, k + 1, k + 3, k + 4); } capeGeo.setIndex(idx); }
const cape = new THREE.Mesh(capeGeo, rim(new THREE.MeshLambertMaterial({ color: '#e0a030', emissive: '#e0a030', emissiveIntensity: 0.4, side: THREE.DoubleSide }), 0.5, 2.2));
cape.frustumCulled = false; cape.castShadow = true; scene.add(cape);
const hem = new Ribbon(3, 0.07, new THREE.Color('#ffd070').multiplyScalar(2.2)), hemPts = [V(), V(), V()];

// Landing craters: rings of pushed-up snow that stay where you came down.
const craterGeo = new THREE.TorusGeometry(1, 0.2, 5, 22).rotateX(Math.PI / 2).scale(1, 0.55, 1);
const craterMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
const craters = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(craterGeo, craterMat); m.visible = false; m.receiveShadow = true; scene.add(m); return m; });
let craterN = 0;
const dumped = new Set();

export function resetPlayer() {
  Object.assign(P, { d: G.debugD ?? -24, h: 0, v: T.startSpeed, vy: 0, grounded: true, air: 0, jumpLock: 0, edge: 0, carveT: 0, brake: 0, onIce: false, bonkT: 0, crouch: 0.25, squash: 0, skid: 0 });
  P.z = -P.d; P.x = cx(P.d); P.y = P.groundY = height(P.x, P.z);
  P.pos.set(P.x, P.y, P.z);
  scarfPts.forEach((p, i) => p.set(P.x, P.y + 1.6, P.z + i * 0.14));
  P.spin = 0; craters.forEach((m) => { m.visible = false; }); dumped.clear();
}

function land(impact) {
  const k = clamp(impact / 16, 0, 1);
  P.squash = Math.max(P.squash, 0.35 + k * 0.65); G.punch += 0.25 + k * 0.9; shake(0.12 + k * 0.4);
  snow.puff(P.pos, 50 + (k * 130 | 0), 0.9 + k * 0.9, P.fwd.x * P.v * 0.35, 0, P.fwd.z * P.v * 0.35);
  sfx('land', k);
  if (k > 0.12) {
    const m = craters[craterN++ % craters.length], gr = grad(P.x, P.z), sc = 0.9 + k * 1.3;
    m.position.set(P.x, P.y + 0.02, P.z); m.quaternion.setFromUnitVectors(UP, _d.set(-gr.x, 1, -gr.z).normalize()); m.scale.set(sc, 1, sc * 1.25); m.visible = true;
    burst(P.pos, 10 + (k * 26 | 0), SNOWC, { speed: 5 + k * 6, size: 0.09, life: 1.1, up: 3 + k * 3, gravity: 18, dir: _d.set(P.fwd.x * P.v * 0.5, 0, P.fwd.z * P.v * 0.5) });
  }
  const spins = Math.round(Math.abs(P.spin) / Math.PI); P.spin = 0;
  if (G.mode === 'run' && spins > 0) award(150 * spins, `SPIN ${spins * 180}`);
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
    if (P.air > 0.25 && !G.aim.drawing) P.spin += turn * 7.5 * dt;   // hold a direction in the air to spin
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
const hip = V(), chest = V(), footF = V(0, 0.1, -0.27), footB = V(0, 0.1, 0.27), knee = V(), a = V(), b = V(), elbow = V();
const handPosF = V(), handPosB = V(), aimL = V(), bowP = V(), nockP = V(), restDir = V(0.25, -0.35, -1).normalize(), upHint = V();
function pose(dt, tuck, sAlong) {
  const aim = G.aim, e = P.edge;
  if (Math.abs(e) > 0.3) P.skidSide = Math.sign(e);
  P.skid = damp(P.skid, P.brake * 1.15 * P.skidSide, 9, dt);
  P.pitch = damp(P.pitch, P.grounded ? Math.atan(-sAlong) : Math.atan2(P.vy, Math.max(P.v, 1)) * 0.6 + 0.12, P.grounded ? 14 : 5, dt);
  P.squash = damp(P.squash, 0, 6, dt);
  P.crouch = damp(P.crouch, clamp((tuck ? 0.75 : 0.28) + (P.grounded ? Math.abs(e) * 0.3 : 0.35) + P.squash * 0.6 - aim.blend * 0.1, 0, 1), 10, dt);
  rider.position.set(P.x, P.y + 0.015, P.z);   // the board rides a little way into the powder
  rider.rotation.set(P.pitch, -(P.h + P.skid + P.spin), -e * 0.5 - P.skid * 0.25);

  const c = P.crouch, bob = Math.sin(G.t * 9) * 0.01 * (P.grounded ? 1 : 0);
  hip.set(0.04 + c * 0.1, 0.9 - c * 0.42 + bob, 0);
  chest.set(hip.x + 0.06 + c * 0.2, hip.y + 0.5 - c * 0.1, -0.04);
  bootF.position.copy(footF); bootB.position.copy(footB);
  setLimb(thighF, a.set(hip.x, hip.y, -0.1), ik(a, b.set(0, 0.2, -0.27), 0.46, 0.46, _p2.set(1, 0.2, -0.5), knee)); setLimb(shinF, knee, b); kneeF.position.copy(knee);
  setLimb(thighB, a.set(hip.x, hip.y, 0.1), ik(a, b.set(0, 0.2, 0.27), 0.46, 0.46, _p2.set(1, 0.2, 0.5), knee)); setLimb(shinB, knee, b); kneeB.position.copy(knee);
  pelvis.position.copy(hip);
  setLimb(torso, a.set(hip.x - 0.02, hip.y - 0.2, 0), b.set(chest.x, chest.y + 0.17, chest.z)); torso.scale.z = 1.2;
  shoulders.position.set(chest.x, chest.y + 0.05, chest.z - 0.25); shoulderB.position.set(chest.x, chest.y + 0.05, chest.z + 0.25);
  collar.position.set(chest.x - 0.14, chest.y + 0.13, chest.z); clasp.position.set(chest.x + 0.13, chest.y + 0.13, chest.z - 0.06);
  head.position.set(chest.x + 0.03, chest.y + 0.36, chest.z - 0.03); head.rotation.set(0.05, 0.35 - e * 0.2 + aim.blend * 0.2, 0);
  quiver.position.set(chest.x - 0.25, chest.y - 0.12, 0.13); quiver.rotation.set(0.45, 0, 0.3);

  // Bow arm: at rest the bow hangs forward and low; on the draw it swings up along the aim line.
  aimL.copy(aim.dir).applyQuaternion(_q.copy(rider.quaternion).invert());
  aimL.lerp(restDir, 1 - aim.blend).normalize();
  bowP.set(chest.x + 0.02, chest.y + 0.04, chest.z - 0.2).addScaledVector(aimL, lerp(0.42, 0.6, aim.blend));
  if (aim.blend < 1) bowP.y -= (1 - aim.blend) * 0.3;
  bow.position.copy(bowP);
  upHint.set(0.3 * aim.blend, 1, 0);
  _m.lookAt(_zero, aimL, upHint); bow.quaternion.setFromRotationMatrix(_m);
  const flex = aim.draw * 0.3, pull = 0.17 + aim.draw * 0.5;
  bowUp.rotation.x = flex; bowDown.rotation.x = -flex;
  const ty = 0.72 * Math.cos(flex) - 0.17 * Math.sin(flex), tz = 0.72 * Math.sin(flex) + 0.17 * Math.cos(flex), sp = stringGeo.attributes.position;
  sp.setXYZ(0, 0, ty, tz); sp.setXYZ(1, 0, 0, aim.drawing ? pull : tz); sp.setXYZ(2, 0, -ty, tz); sp.needsUpdate = true;
  nocked.visible = aim.drawing; nocked.position.set(0, 0, pull);
  nockP.set(0, 0, pull * 1.35).applyQuaternion(bow.quaternion).add(bowP);
  handPosF.copy(bowP);
  handPosB.set(hip.x + 0.25, hip.y + 0.2, 0.5).lerp(nockP, aim.blend);
  a.set(chest.x, chest.y + 0.05, chest.z - 0.24); setLimb(upperF, a, ik(a, handPosF, 0.31, 0.31, _p2.set(0.2, -1, 0), elbow)); setLimb(foreF, elbow, handPosF); elbowF.position.copy(elbow);
  a.set(chest.x, chest.y + 0.05, chest.z + 0.24); setLimb(upperB, a, ik(a, handPosB, 0.31, 0.31, _p2.set(-0.2, -0.6, 1), elbow)); setLimb(foreB, elbow, handPosB); elbowB.position.copy(elbow);
  handF.position.copy(handPosF); handB.position.copy(handPosB);

  rider.updateMatrixWorld(true);
  P.bowPos.copy(bowP).applyMatrix4(rider.matrixWorld);
  P.chest.copy(chest).applyMatrix4(rider.matrixWorld);

  // Cape: the spine trails from the back of the neck; the cloth spreads across the wind and ripples.
  scarfPts[0].set(chest.x - 0.16, chest.y + 0.14, chest.z).applyMatrix4(rider.matrixWorld);
  const seg = 0.14, sp3 = Math.hypot(P.vel.x, P.vel.z);
  for (let i = 1; i < SC; i++) {
    const p = scarfPts[i], q = scarfPts[i - 1];
    p.x -= P.vel.x * 0.5 * dt; p.z -= P.vel.z * 0.5 * dt; p.y -= (6.5 - Math.min(3.6, sp3 * 0.14) + P.vel.y * 0.25) * dt;
    _d.subVectors(p, q); const len = _d.length() || 1; p.copy(q).addScaledVector(_d, seg / len);
  }
  _p2.set(0, 0, 1).applyQuaternion(rider.quaternion);                       // shoulder line
  for (let i = 0; i < SC; i++) {
    const p = scarfPts[i], q = scarfPts[Math.min(SC - 1, i + 1)], o = scarfPts[Math.max(0, i - 1)], k = i / (SC - 1);
    _d.subVectors(q, o).normalize(); const flat = Math.hypot(_d.x, _d.z);
    a.crossVectors(_d, UP).multiplyScalar(flat).addScaledVector(_p2, 1 - flat).normalize();
    const w = 0.17 + k * 0.3, ph = G.t * (9 + sp3 * 0.25) - i * 1.1, rip = k * (0.07 + sp3 * 0.006);
    for (let j = 0; j < 3; j++) {
      const n = i * 9 + j * 3, sd = j - 1;
      capePos[n] = p.x + a.x * w * sd; capePos[n + 1] = p.y + a.y * w * sd + Math.sin(ph + sd * 1.3) * rip + (sd === 0 ? 0.07 : -0.04 * k); capePos[n + 2] = p.z + a.z * w * sd;
    }
  }
  capeGeo.attributes.position.needsUpdate = true; capeGeo.computeVertexNormals();
  for (let j = 0; j < 3; j++) hemPts[j].fromArray(capePos, (SC - 1) * 9 + j * 3);
  hem.update(hemPts, 0, 1);
}
const _zero = V(), _z = V(0, 0, 1), _p2 = V();
