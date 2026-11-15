// The rider: carve physics, air and landings, a procedurally posed figure, bow in hand, scarf trail.
import * as THREE from 'three';
import { G } from './state.js';
import { T } from './config.js';
import { height, grad, cx, dcx, widthAt, trees } from './course.js';
import { scene, TEX } from './world.js';
import { toon, loft } from './build.js';
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
const glow = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
// The face is a drawing wrapped round the head: big green eyes with glints, lashes, brows, blush, a small mouth.
function faceTexture() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g = cv.getContext('2d'); g.scale(2, 2);
  g.fillStyle = '#f3c9a4'; g.fillRect(0, 0, 512, 256);
  const cx0 = 384, cy = 132;
  for (const sd of [-1, 1]) {
    const x = cx0 + sd * 30;
    g.fillStyle = 'rgba(240,110,110,0.28)'; g.beginPath(); g.ellipse(x + sd * 9, cy + 25, 15, 7, 0, 0, 6.3); g.fill();
    g.fillStyle = '#fbfbff'; g.beginPath(); g.ellipse(x, cy, 12.5, 15.5, 0, 0, 6.3); g.fill();
    const ir = g.createLinearGradient(0, cy - 14, 0, cy + 14); ir.addColorStop(0, '#0d4a52'); ir.addColorStop(1, '#49d6b0');
    g.fillStyle = ir; g.beginPath(); g.ellipse(x, cy + 2, 9.5, 13, 0, 0, 6.3); g.fill();
    g.fillStyle = '#0c1a22'; g.beginPath(); g.ellipse(x, cy + 2, 4.5, 7.5, 0, 0, 6.3); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 3.5, cy - 5, 3.6, 0, 6.3); g.fill(); g.beginPath(); g.arc(x + 3.5, cy + 8, 1.8, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(60,30,40,0.22)'; g.beginPath(); g.ellipse(x, cy - 9, 12.5, 6, 0, 0, 6.3); g.fill();                                  // lid shadow
    g.strokeStyle = '#3a1c14'; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.ellipse(x, cy, 13.5, 16.5, 0, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
    g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + sd * 12.5, cy - 7); g.lineTo(x + sd * 18, cy - 11.5); g.stroke();
    g.strokeStyle = '#9a4418'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(x - sd * 13, cy - 27); g.quadraticCurveTo(x + sd * 2, cy - 35, x + sd * 15, cy - 27); g.stroke();
  }
  g.strokeStyle = 'rgba(170,100,70,0.8)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx0 - 2, cy + 19); g.lineTo(cx0 + 2.5, cy + 23); g.stroke();
  g.strokeStyle = '#8a3a2a'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(cx0 - 8, cy + 38); g.quadraticCurveTo(cx0, cy + 44, cx0 + 8, cy + 38); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// The hero: a young ranger in the classic adventurer mould. Green tunic with gold trim, cream sleeves, leather bracers,
// belt and tall boots, tan breeches, copper hair, pointed ears. Physically based: cloth has a weave, leather a grain, gold is metal.
const C = { tunic: '#2e9460', tunicDark: '#1e6a46', cream: '#f1e6cf', tan: '#8a7658', leather: '#74432a', leatherDark: '#4e2c1c', skin: '#f3c9a4', hair: '#d2602a', gold: '#f0b84a', dark: '#1a1730', red: '#c8362e' };
const cloth = toon(0, 0, null, { normalMap: TEX.weave, normalScale: new THREE.Vector2(0.22, 0.22), roughness: 0.86 });
const hide = toon(0, 0, null, { normalMap: TEX.leather, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.58 });
const solid = (c, opts = {}) => toon(0, 0, c, opts);
const M = { cloth, hide, skin: solid(C.skin, { roughness: 0.6 }), hair: solid(C.hair, { roughness: 0.5, normalMap: TEX.wood, normalScale: new THREE.Vector2(0.5, 0.5) }),
  goldM: solid(C.gold, { metalness: 0.9, roughness: 0.28 }), leather: solid(C.leather, { normalMap: TEX.leather, roughness: 0.58 }), dark: solid(C.dark, { roughness: 0.5 }), wood: solid('#4a2c1c', { normalMap: TEX.wood, roughness: 0.6 }),
  tunic: solid(C.tunic, { normalMap: TEX.weave, normalScale: new THREE.Vector2(0.22, 0.22), roughness: 0.86 }), red: solid(C.red, { roughness: 0.6 }), cream: solid(C.cream, { roughness: 0.5 }),
  face: new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.62 }),
  hot: glow('#ffd070', 2.0), gold: glow('#ffc46b', 2.4), bowGlow: solid('#c08a4e', { normalMap: TEX.wood, roughness: 0.45 }) };
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
add(deckGeometry(1, 0.03), M.wood, board).position.y = 0.02;          // a wooden board, bound in leather, edged in gold
add(deckGeometry(0.5, 0.006), M.goldM, board).position.y = 0.058;
add(deckGeometry(0.36, 0.006), M.tunic, board).position.y = 0.064;
// Boots: tall leather, darker sole, a gold buckle on the binding strap.
const boot = () => { const g = new THREE.Group(); rider.add(g); ball(0.108, M.leather, g, 1.85, 1.15, 1.2); box(0.42, 0.05, 0.25, M.dark, g).position.y = -0.095; box(0.22, 0.045, 0.28, M.leather, g).position.set(0.02, 0.07, 0); box(0.05, 0.05, 0.05, M.goldM, g).position.set(0.1, 0.085, 0.14); return g; };
const bootF = boot(), bootB = boot();
for (const z of [-0.27, 0.27]) box(0.36, 0.035, 0.26, M.leather, board).position.set(0, 0.068, z);
// Limbs are shaped along their length. Each is modelled one unit long and stretched between two joints.
const part1 = (rings, colorAt, m) => { const o = add(loft(rings, colorAt, 16), m); o.userData.r = 1; return o; };
const THIGH = [[-0.5, 0.108, 0.11], [-0.2, 0.106, 0.106], [0.2, 0.092, 0.092], [0.5, 0.082, 0.082]];
// tall boot: folded cuff at the top, then calf, ankle
const SHIN = [[-0.5, 0.082, 0.082], [-0.34, 0.086, 0.086], [-0.33, 0.104, 0.104], [-0.2, 0.106, 0.104], [-0.19, 0.092, 0.09], [0.1, 0.086, 0.084], [0.5, 0.082, 0.08]];
const shinAt = (t) => (t < 0.2 ? C.tan : t < 0.5 ? C.leatherDark : C.leather);
const thighF = part1(THIGH, () => C.tan, M.cloth), shinF = part1(SHIN, shinAt, M.hide), thighB = part1(THIGH, () => C.tan, M.cloth), shinB = part1(SHIN, shinAt, M.hide);
const kneeF = ball(0.084, solid(C.tan, { roughness: 0.86 })), kneeB = ball(0.084, kneeF.material);
const pelvis = ball(0.14, kneeF.material, rider, 1, 0.78, 1.15);
// Tunic: skirt flaring below the belt, waist, chest, shoulders, collar. Gold hem and a gold-edged collar.
const torso = part1([[-0.5, 0.235, 0.265], [-0.47, 0.232, 0.262], [-0.3, 0.17, 0.2], [-0.2, 0.128, 0.156], [-0.14, 0.126, 0.154], [0.02, 0.132, 0.17], [0.16, 0.136, 0.19], [0.27, 0.132, 0.2], [0.35, 0.112, 0.178], [0.41, 0.08, 0.1], [0.44, 0.078, 0.096], [0.5, 0.06, 0.064]],
  (t) => (t < 0.05 ? C.gold : t > 0.82 && t < 0.93 ? C.gold : t >= 0.93 ? C.cream : t > 0.24 && t < 0.33 ? C.tunicDark : C.tunic), M.cloth);
const belt = add(new THREE.TorusGeometry(0.15, 0.03, 8, 24).rotateX(Math.PI / 2), M.leather, torso); belt.position.y = -0.17; belt.scale.set(0.9, 1, 1.12);
add(new THREE.BoxGeometry(0.05, 0.075, 0.085), M.goldM, torso).position.set(0.145, -0.17, 0);
box(0.08, 0.11, 0.1, M.leather, torso).position.set(0.07, -0.25, 0.17);
{ const strap = add(new THREE.TorusGeometry(0.2, 0.02, 6, 24), M.leather, torso); strap.position.set(0, 0.12, 0); strap.rotation.set(0.5, 1.5708, 0); strap.scale.set(1, 1.3, 1); }
const shoulders = ball(0.074, M.tunic), shoulderB = ball(0.074, M.tunic);
// Sleeves: short green cap sleeve, cream shirt, leather bracer with gold rings.
const UPPER = [[-0.5, 0.074, 0.074], [-0.22, 0.072, 0.072], [-0.21, 0.062, 0.062], [0.5, 0.054, 0.054]];
const FORE = [[-0.5, 0.054, 0.054], [-0.12, 0.052, 0.052], [-0.11, 0.06, 0.06], [-0.06, 0.06, 0.06], [-0.05, 0.057, 0.057], [0.34, 0.052, 0.052], [0.35, 0.058, 0.058], [0.4, 0.058, 0.058], [0.41, 0.046, 0.046], [0.5, 0.044, 0.044]];
const upperAt = (t) => (t < 0.3 ? C.tunic : C.cream), foreAt = (t) => (t < 0.16 ? C.cream : t < 0.3 || (t > 0.7 && t < 0.86) ? C.gold : t < 0.86 ? C.leather : C.skin);
const upperF = part1(UPPER, upperAt, M.cloth), foreF = part1(FORE, foreAt, M.hide), upperB = part1(UPPER, upperAt, M.cloth), foreB = part1(FORE, foreAt, M.hide);
const elbowF = ball(0.056, M.cream), elbowB = ball(0.056, M.cream);
const handF = ball(0.05, M.skin, rider, 1, 1.25, 0.9), handB = ball(0.05, M.skin, rider, 1, 1.25, 0.9);
// Head: front is -Z. Drawn face, pointed ears, and hair built from curved, tapering locks.
const head = new THREE.Group(); rider.add(head); head.scale.setScalar(0.86);
add(new THREE.SphereGeometry(0.19, 32, 24), M.face, head).scale.set(0.98, 1.05, 0.98);
add(new THREE.SphereGeometry(0.205, 24, 14, 0, 6.2832, 0, 1.5).rotateX(0.66), M.hair, head).position.set(0, 0.018, 0.03);
// A lock: grows along +Y from its root, tapering to a point and curving sideways (bend) as it goes.
const lockGeo = (len, w, flat, bend) => loft([0, 0.18, 0.4, 0.62, 0.82, 1].map((t) => [len * t, Math.max(0.004, w * Math.pow(1 - t, 0.75)), Math.max(0.004, w * flat * Math.pow(1 - t, 0.75)), bend * t * t, 0]), () => C.hair, 8);
const lock = (x, y, z, rx, ry, rz, len, w, flat = 1, bend = 0) => { const o = add(lockGeo(len, w, flat, bend), M.hair, head); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
// fringe: flat locks falling across the forehead, parted to one side
[[-0.125, 0.5, 0.05], [-0.07, 0.24, 0.03], [-0.012, 0.02, -0.02], [0.05, -0.22, -0.05], [0.108, -0.46, -0.04]].forEach(([x, rz, bend], i) => lock(x, 0.125 - Math.abs(x) * 0.2, -0.172 + Math.abs(x) * 0.28, Math.PI - 0.28, 0, rz, 0.2 + (i % 2) * 0.035, 0.058, 0.4, bend));
// crown and back: long swept locks, layered
[[0, 0.17, 0.1, 0.95, 0, 0, 0.4, 0.095, 0.7, 0], [0.1, 0.14, 0.12, 1.1, 0, -0.5, 0.36, 0.085, 0.7, -0.04], [-0.1, 0.14, 0.12, 1.1, 0, 0.5, 0.36, 0.085, 0.7, 0.04], [0.06, 0.04, 0.18, 1.55, 0, -0.3, 0.34, 0.085, 0.7, -0.03], [-0.06, 0.04, 0.18, 1.55, 0, 0.3, 0.34, 0.085, 0.7, 0.03],
  [0, -0.05, 0.18, 2.05, 0, 0, 0.3, 0.08, 0.7, 0], [0.13, -0.03, 0.14, 2.0, 0, -0.5, 0.26, 0.07, 0.7, 0], [-0.13, -0.03, 0.14, 2.0, 0, 0.5, 0.26, 0.07, 0.7, 0],
  [0.155, 0.14, 0.02, 0.5, 0, -1.05, 0.24, 0.07, 0.7, -0.03], [-0.155, 0.14, 0.02, 0.5, 0, 1.05, 0.24, 0.07, 0.7, 0.03], [0.02, 0.235, -0.03, -0.4, 0, -0.25, 0.2, 0.03, 1, 0.05]]
  .forEach((q) => lock(...q));
for (const sd of [-1, 1]) {
  const ear = add(loft([0, 0.4, 0.75, 1].map((t) => [0.2 * t, 0.04 * (1 - t) + 0.004, 0.022 * (1 - t) + 0.003, 0, 0]), () => C.skin, 8), M.skin, head); ear.position.set(sd * 0.178, -0.01, 0.02); ear.rotation.set(0.45, 0, -sd * 1.15);
  lock(sd * 0.172, 0.02, -0.07, Math.PI + 0.12, 0, -sd * 0.08, 0.24, 0.042, 0.55, sd * 0.02);      // side lock in front of the ear
}
// Hood, worn down; a gold clasp; the quiver.
const collar = add(new THREE.SphereGeometry(0.15, 16, 10).scale(1.0, 0.55, 1.35), M.tunic);
const clasp = ball(0.026, M.goldM);
const quiver = add(new THREE.CylinderGeometry(0.058, 0.044, 0.54, 12), M.leather);
add(new THREE.TorusGeometry(0.058, 0.012, 6, 14).rotateX(Math.PI / 2), M.goldM, quiver).position.y = 0.25;
for (let i = 0; i < 4; i++) { const f = box(0.018, 0.15, 0.05, M.red, quiver); f.position.set(Math.cos(i * 1.6) * 0.025, 0.34, Math.sin(i * 1.6) * 0.025); f.rotation.y = i; }

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
// Scarf: two flat coral tails streaming from the neck.
const SC = 10, scarfPts = Array.from({ length: SC }, () => V()), scarfDraw = Array.from({ length: SC }, () => V());
const scarf = new Ribbon(SC, 0.17, new THREE.Color('#c8362e').multiplyScalar(1.1)), scarf2 = new Ribbon(SC, 0.12, new THREE.Color('#8e2622').multiplyScalar(1.1));

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
  scarfPts.forEach((p, i) => p.set(P.x, P.y + 1.6, P.z + i * 0.12));
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
const hip = V(), chest = V(), footF = V(0, 0.1, -0.27), footB = V(0, 0.1, 0.27), knee = V(), a = V(), b = V(), elbow = V();
const handPosF = V(), handPosB = V(), aimL = V(), bowP = V(), nockP = V(), restDir = V(0.25, -0.35, -1).normalize(), upHint = V();
function pose(dt, tuck, sAlong) {
  const aim = G.aim, e = P.edge;
  if (Math.abs(e) > 0.3) P.skidSide = Math.sign(e);
  P.skid = damp(P.skid, P.brake * 1.15 * P.skidSide, 9, dt);
  P.pitch = damp(P.pitch, P.grounded ? Math.atan(-sAlong) : Math.atan2(P.vy, Math.max(P.v, 1)) * 0.6 + 0.12, P.grounded ? 14 : 5, dt);
  P.squash = damp(P.squash, 0, 6, dt);
  P.crouch = damp(P.crouch, clamp((tuck ? 0.75 : 0.28) + (P.grounded ? Math.abs(e) * 0.3 : 0.35) + P.squash * 0.6 - aim.blend * 0.1 + (P.grab || 0) * 0.5 + (P.flipDir ? 0.35 : 0), 0, 1), 10, dt);
  rider.position.set(P.x, P.y + 0.015, P.z);   // the board rides a little way into the powder
  rider.rotation.set(P.pitch + (P.flip || 0), -(P.h + P.skid + P.spin), -e * 0.5 - P.skid * 0.25);

  const c = P.crouch, bob = Math.sin(G.t * 9) * 0.01 * (P.grounded ? 1 : 0);
  hip.set(0.04 + c * 0.1, 0.9 - c * 0.42 + bob, 0);
  chest.set(hip.x + 0.06 + c * 0.2, hip.y + 0.5 - c * 0.1, -0.04);
  bootF.position.copy(footF); bootB.position.copy(footB);
  setLimb(thighF, a.set(hip.x, hip.y, -0.1), ik(a, b.set(0, 0.2, -0.27), 0.46, 0.46, _p2.set(1, 0.2, -0.5), knee)); setLimb(shinF, knee, b); kneeF.position.copy(knee);
  setLimb(thighB, a.set(hip.x, hip.y, 0.1), ik(a, b.set(0, 0.2, 0.27), 0.46, 0.46, _p2.set(1, 0.2, 0.5), knee)); setLimb(shinB, knee, b); kneeB.position.copy(knee);
  pelvis.position.copy(hip);
  setLimb(torso, a.set(hip.x - 0.02, hip.y - 0.3, 0), b.set(chest.x + 0.01, chest.y + 0.2, chest.z));
  shoulders.position.set(chest.x, chest.y + 0.06, chest.z - 0.215); shoulderB.position.set(chest.x, chest.y + 0.06, chest.z + 0.215);
  collar.position.set(chest.x - 0.12, chest.y + 0.13, chest.z); clasp.position.set(chest.x + 0.085, chest.y + 0.19, chest.z - 0.02);
  head.position.set(chest.x + 0.03, chest.y + 0.36, chest.z - 0.02); head.rotation.set(0.05, 0.35 - e * 0.2 + aim.blend * 0.2, 0);
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
  handPosB.set(hip.x + 0.28 - e * 0.18, hip.y + 0.22 + Math.abs(e) * 0.18 + (P.grounded ? 0 : 0.2), 0.52).lerp(_p2.set(0.2, 0.12, 0.34), P.grab || 0).lerp(nockP, aim.blend);
  a.set(chest.x, chest.y + 0.06, chest.z - 0.215); setLimb(upperF, a, ik(a, handPosF, 0.31, 0.31, _p2.set(0.2, -1, 0), elbow)); setLimb(foreF, elbow, handPosF); elbowF.position.copy(elbow);
  a.set(chest.x, chest.y + 0.06, chest.z + 0.215); setLimb(upperB, a, ik(a, handPosB, 0.31, 0.31, _p2.set(-0.2, -0.6, 1), elbow)); setLimb(foreB, elbow, handPosB); elbowB.position.copy(elbow);
  handF.position.copy(handPosF); handB.position.copy(handPosB);

  rider.updateMatrixWorld(true);
  P.bowPos.copy(bowP).applyMatrix4(rider.matrixWorld);
  P.chest.copy(chest).applyMatrix4(rider.matrixWorld);

  // Scarf: a chain dragged from the neck; flutter is layered on top so the tails snap like cloth.
  scarfPts[0].set(chest.x - 0.1, chest.y + 0.24, chest.z + 0.03).applyMatrix4(rider.matrixWorld);
  const seg = 0.12, sp3 = Math.hypot(P.vel.x, P.vel.z);
  for (let i = 1; i < SC; i++) {
    const p = scarfPts[i], q = scarfPts[i - 1];
    p.x -= P.vel.x * 0.5 * dt; p.z -= P.vel.z * 0.5 * dt; p.y -= (5 - Math.min(4.4, sp3 * 0.2) + P.vel.y * 0.2) * dt;
    _d.subVectors(p, q); const len = _d.length() || 1; p.copy(q).addScaledVector(_d, seg / len);
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < SC; i++) {
      const k = (i / SC) * (0.06 + sp3 * 0.004), ph = G.t * (pass ? 13 : 16) - i * (pass ? 1.1 : 0.85);
      const o = scarfDraw[i]; if (pass) o.lerpVectors(scarfPts[0], scarfPts[i], 0.66); else o.copy(scarfPts[i]);
      o.x += Math.cos(P.h) * Math.sin(ph) * k + (pass ? Math.cos(P.h) * 0.12 * i / SC : 0); o.z += Math.sin(P.h) * Math.sin(ph) * k; o.y += Math.cos(ph * 0.8) * k + (pass ? 0.1 * i / SC : 0);
    }
    (pass ? scarf2 : scarf).update(scarfDraw, 0);
  }
}
const _zero = V(), _z = V(0, 0, 1), _p2 = V();
