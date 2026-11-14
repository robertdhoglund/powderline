// The rider: carve physics, air and landings, a procedurally posed figure, bow in hand, scarf trail.
import * as THREE from 'three';
import { G } from './state.js';
import { T } from './config.js';
import { height, grad, cx, dcx, widthAt, trees } from './course.js';
import { scene, rim } from './world.js';
import { clamp, damp, lerp, rand, wrapPi } from './util.js';
import * as snow from './snow.js';
import { Ribbon, shake, arrowMesh } from './fx.js';
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
export const rider = new THREE.Group(); rider.rotation.order = 'YXZ'; rider.scale.setScalar(1.42); scene.add(rider);
const lam = (c, e = 0, k = 0.8) => rim(new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: e }), k, 2.2);
const glow = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
const M = { suit: lam('#3a3096', 0.28), jacket: lam('#ff6a48', 0.5), dark: lam('#131033', 0.1), hot: glow('#ff3d7f', 2.4), visor: glow('#7af3ff', 1.9), gold: glow('#ffc46b', 2.6), bowGlow: glow('#fff1dc', 1.25) };
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
const bootF = ball(0.1, M.dark, rider, 1.7, 1.05, 1.05), bootB = ball(0.1, M.dark, rider, 1.7, 1.05, 1.05);
for (const z of [-0.27, 0.27]) box(0.3, 0.05, 0.2, M.suit, board).position.set(0, 0.075, z);
const thighF = limb(0.092, M.suit, 0.078), shinF = limb(0.078, M.suit, 0.068), thighB = limb(0.092, M.suit, 0.078), shinB = limb(0.078, M.suit, 0.068);
const kneeF = ball(0.082, M.suit), kneeB = ball(0.082, M.suit);
const pelvis = ball(0.17, M.suit, rider, 1, 0.8, 1.2);
// Parka: flared hem, wide shoulders, drawn in as a profile and spun.
const parka = new THREE.LatheGeometry([[0.001, 0], [0.25, 0.0], [0.235, 0.1], [0.19, 0.38], [0.2, 0.62], [0.235, 0.86], [0.2, 0.97], [0.09, 1.04], [0.001, 1.05]].map(([x, y]) => new THREE.Vector2(x, y - 0.5)), 18);
const torso = add(parka, M.jacket); torso.userData.r = 1;
const shoulders = ball(0.085, M.jacket, rider, 1, 1, 1), shoulderB = ball(0.085, M.jacket);
const upperF = limb(0.066, M.jacket, 0.058), foreF = limb(0.058, M.jacket, 0.046), upperB = limb(0.066, M.jacket, 0.058), foreB = limb(0.058, M.jacket, 0.046);
const elbowF = ball(0.06, M.jacket), elbowB = ball(0.06, M.jacket);
const handF = ball(0.058, M.dark), handB = ball(0.058, M.dark);
const head = new THREE.Group(); rider.add(head);
ball(0.155, M.suit, head, 1, 1.06, 1.05);
add(new THREE.TorusGeometry(0.135, 0.042, 8, 16, Math.PI * 0.95).rotateX(-Math.PI / 2).rotateY(-0.1), M.visor, head).position.y = 0.025;
add(new THREE.ConeGeometry(0.1, 0.2, 10).rotateX(0.5), M.suit, head).position.set(0, 0.17, 0.05);
const collar = add(new THREE.TorusGeometry(0.115, 0.055, 8, 14).rotateX(Math.PI / 2), M.hot);
const quiver = add(new THREE.CylinderGeometry(0.055, 0.04, 0.46, 10), M.dark);
for (let i = 0; i < 3; i++) { const f = box(0.02, 0.13, 0.05, M.hot, quiver); f.position.set((i - 1) * 0.03, 0.28, 0); f.rotation.y = i; }

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

const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: '#0d0838', transparent: true, opacity: 0.4, depthWrite: false }));
shadow.renderOrder = 2; scene.add(shadow);

const SC = 16, scarfPts = Array.from({ length: SC }, () => V()), scarfDraw = Array.from({ length: SC }, () => V());
const scarf = new Ribbon(SC, 0.19, new THREE.Color('#ff3d7f').multiplyScalar(2.3)), scarf2 = new Ribbon(SC, 0.13, new THREE.Color('#ff7aa8').multiplyScalar(1.9));

export function resetPlayer() {
  Object.assign(P, { d: G.debugD ?? -24, h: 0, v: T.startSpeed, vy: 0, grounded: true, air: 0, jumpLock: 0, edge: 0, carveT: 0, brake: 0, onIce: false, bonkT: 0, crouch: 0.25, squash: 0, skid: 0 });
  P.z = -P.d; P.x = cx(P.d); P.y = P.groundY = height(P.x, P.z);
  P.pos.set(P.x, P.y, P.z);
  scarfPts.forEach((p, i) => p.set(P.x, P.y + 1.6, P.z + i * 0.2));
}

function land(impact) {
  const k = clamp(impact / 16, 0, 1);
  P.squash = Math.max(P.squash, 0.35 + k * 0.65); G.punch += 0.25 + k * 0.9; shake(0.12 + k * 0.4);
  snow.puff(P.pos, 50 + (k * 130 | 0), 0.9 + k * 0.9, P.fwd.x * P.v * 0.35, 0, P.fwd.z * P.v * 0.35);
  sfx('land', k);
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

  if (P.grounded) {
    if (!P.onIce) snow.spray(P, dt, P.brake);
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
  rider.position.set(P.x, P.y + 0.02, P.z);
  rider.rotation.set(P.pitch, -(P.h + P.skid), -e * 0.5 - P.skid * 0.25);

  const c = P.crouch, bob = Math.sin(G.t * 9) * 0.01 * (P.grounded ? 1 : 0);
  hip.set(0.04 + c * 0.1, 0.9 - c * 0.42 + bob, 0);
  chest.set(hip.x + 0.06 + c * 0.2, hip.y + 0.5 - c * 0.1, -0.04);
  bootF.position.copy(footF); bootB.position.copy(footB);
  setLimb(thighF, a.set(hip.x, hip.y, -0.1), ik(a, b.set(0, 0.2, -0.27), 0.46, 0.46, _p2.set(1, 0.2, -0.5), knee)); setLimb(shinF, knee, b); kneeF.position.copy(knee);
  setLimb(thighB, a.set(hip.x, hip.y, 0.1), ik(a, b.set(0, 0.2, 0.27), 0.46, 0.46, _p2.set(1, 0.2, 0.5), knee)); setLimb(shinB, knee, b); kneeB.position.copy(knee);
  pelvis.position.copy(hip);
  setLimb(torso, a.set(hip.x - 0.02, hip.y - 0.12, 0), b.set(chest.x, chest.y + 0.16, chest.z)); torso.scale.z = 1.22;
  shoulders.position.set(chest.x, chest.y + 0.05, chest.z - 0.25); shoulderB.position.set(chest.x, chest.y + 0.05, chest.z + 0.25);
  collar.position.set(chest.x + 0.01, chest.y + 0.17, chest.z - 0.02);
  head.position.set(chest.x + 0.03, chest.y + 0.31, chest.z - 0.03); head.rotation.set(0, 0.35 - e * 0.2, 0);
  quiver.position.set(chest.x - 0.24, chest.y - 0.1, 0.12); quiver.rotation.set(0.45, 0, 0.3);

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

  // Blob shadow on the snow.
  const gy = P.y - P.alt, gr = grad(P.x, P.z);
  shadow.position.set(P.x, gy + 0.06, P.z);
  shadow.quaternion.setFromUnitVectors(_z, _d.set(-gr.x, 1, -gr.z).normalize());
  const k = clamp(1 - P.alt / 14, 0.25, 1); shadow.scale.set(0.75 * k, 1.25 * k, 1); shadow.rotateZ(-P.h);
  shadow.material.opacity = 0.42 * k;

  // Scarf: a chain dragged behind the neck, whipping with speed.
  scarfPts[0].set(chest.x - 0.05, chest.y + 0.2, chest.z + 0.05).applyMatrix4(rider.matrixWorld);
  const seg = 0.2, wind = 0.045;
  for (let i = 1; i < SC; i++) {
    const p = scarfPts[i], q = scarfPts[i - 1];
    p.x -= P.vel.x * wind * dt * 10; p.z -= P.vel.z * wind * dt * 10;
    p.y += (Math.sin(G.t * 11 - i * 0.7) * 1.2 + 2.2) * dt; p.x += Math.cos(G.t * 7 - i * 0.9) * 1.4 * dt;
    _d.subVectors(p, q); const len = _d.length() || 1; p.copy(q).addScaledVector(_d, seg / len);
  }
  // Flutter is layered on top of the chain so the tail snaps like cloth.
  for (let i = 0; i < SC; i++) {
    const k = (i / SC) * (0.1 + P.v * 0.004), ph = G.t * 16 - i * 0.85;
    scarfDraw[i].copy(scarfPts[i]); scarfDraw[i].x += Math.cos(P.h) * Math.sin(ph) * k; scarfDraw[i].z += Math.sin(P.h) * Math.sin(ph) * k; scarfDraw[i].y += Math.cos(ph * 0.8) * k;
  }
  scarf.update(scarfDraw, 0.25);
  for (let i = 0; i < SC; i++) { const k = i / SC, ph = G.t * 13 - i * 1.1; scarfDraw[i].lerpVectors(scarfPts[0], scarfPts[i], 0.62); scarfDraw[i].y += k * (0.35 + Math.sin(ph) * 0.12); scarfDraw[i].x += Math.cos(P.h) * k * (0.3 + Math.cos(ph) * 0.12); scarfDraw[i].z += Math.sin(P.h) * k * 0.3; }
  scarf2.update(scarfDraw, 0.3);
}
const _zero = V(), _z = V(0, 0, 1), _p2 = V();
