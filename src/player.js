// The rider: carve physics, air and landings, a procedurally posed figure, bow in hand, scarf trail.
import * as THREE from 'three';
import { G } from './state.js';
import { T } from './config.js';
import { height, grad, cx, dcx, widthAt, trees } from './course.js';
import { scene } from './world.js';
import { toon, loft, stylize, RAMP_SOFT } from './build.js';
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
// The hero: a moonlit ranger. The adventurer's outline is unchanged (belted tunic, pointed ears, tall boots, bow and
// quiver) but it is drawn in the mountain's own colours: violet cloth, indigo leather, a white mane, and trim that
// glows magenta and cyan. Big clean shapes that read at a distance; the fine detail is light, not texture.
export const rider = new THREE.Group(); rider.rotation.order = 'YXZ'; rider.scale.setScalar(1.5); scene.add(rider);
const hot = (hex, k) => new THREE.Color(hex).multiplyScalar(k);   // a colour pushed past 1.0 glows
const C = {
  tunic: '#6d3fe6', tunicLight: '#a07cff', tunicDark: '#3a2296', mantle: '#4b2bb4', mantleDark: '#34208a',
  shirt: '#efe9ff', legging: '#1e1754', boot: '#35216f', cuff: '#e6deff', leather: '#241858', skin: '#ffd9c4', deck: '#171142',
  hair: new THREE.Color(1.16, 1.19, 1.34), bowWood: '#f3eeff',   // hair is a little brighter than white, so it stays white in warm light
  pink: hot('#ff3fa6', 2.3), cyan: hot('#4fe4ff', 2.1), white: hot('#ffffff', 1.5),
};
const glow = (c) => new THREE.MeshBasicMaterial({ color: c });
// The face is a drawing wrapped round the head: big violet eyes with glints, white lashes and brows, blush, a small mouth.
function faceTexture() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g = cv.getContext('2d'); g.scale(2, 2);
  g.fillStyle = C.skin; g.fillRect(0, 0, 512, 256);
  const cx0 = 384, cy = 132;
  for (const sd of [-1, 1]) {
    const x = cx0 + sd * 30;
    g.fillStyle = 'rgba(255,110,150,0.3)'; g.beginPath(); g.ellipse(x + sd * 9, cy + 25, 15, 7, 0, 0, 6.3); g.fill();
    g.fillStyle = '#fbfbff'; g.beginPath(); g.ellipse(x, cy, 12.5, 15.5, 0, 0, 6.3); g.fill();
    const ir = g.createLinearGradient(0, cy - 14, 0, cy + 14); ir.addColorStop(0, '#3b1c9a'); ir.addColorStop(0.55, '#8a4cf0'); ir.addColorStop(1, '#5fe6ff');
    g.fillStyle = ir; g.beginPath(); g.ellipse(x, cy + 2, 9.5, 13, 0, 0, 6.3); g.fill();
    g.fillStyle = '#160c3a'; g.beginPath(); g.ellipse(x, cy + 2, 4.5, 7.5, 0, 0, 6.3); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 3.5, cy - 5, 3.6, 0, 6.3); g.fill(); g.beginPath(); g.arc(x + 3.5, cy + 8, 1.8, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(50,30,90,0.22)'; g.beginPath(); g.ellipse(x, cy - 9, 12.5, 6, 0, 0, 6.3); g.fill();                                  // lid shadow
    g.strokeStyle = '#2a1a5c'; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.ellipse(x, cy, 13.5, 16.5, 0, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
    g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + sd * 12.5, cy - 7); g.lineTo(x + sd * 18, cy - 11.5); g.stroke();
    g.strokeStyle = '#f4f0ff'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(x - sd * 13, cy - 27); g.quadraticCurveTo(x + sd * 2, cy - 35, x + sd * 15, cy - 27); g.stroke();
  }
  g.strokeStyle = 'rgba(190,110,100,0.8)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx0 - 2, cy + 19); g.lineTo(cx0 + 2.5, cy + 23); g.stroke();
  g.strokeStyle = '#a04058'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(cx0 - 8, cy + 38); g.quadraticCurveTo(cx0, cy + 44, cx0 + 8, cy + 38); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const RIM = 1.7;
const cloth = toon(0, 0, null, { rim: RIM, soft: true });                 // vertex-coloured: every lofted shape
const solid = (c, opts = {}) => toon(0, 0, c, { rim: RIM, soft: true, ...opts });
const M = { cloth, hairV: toon(0, 0, null, { rim: 1.1, soft: true }), skin: solid(C.skin), hair: solid(C.hair, { rim: 1.1 }), dark: solid(C.leather), legging: solid(C.legging), boot: solid(C.boot), deck: solid(C.deck), tunic: solid(C.tunic), mantle: solid(C.mantleDark),
  bowWood: solid(C.bowWood), face: stylize(new THREE.MeshToonMaterial({ map: faceTexture(), gradientMap: RAMP_SOFT }), RIM, 'diffuseColor.rgb'),
  pink: glow(C.pink), cyan: glow(C.cyan), white: glow(C.white) };
const add = (geo, m, parent = rider) => { const o = new THREE.Mesh(geo, m); parent.add(o); return o; };
const ball = (r, m, parent = rider, sx = 1, sy = 1, sz = 1) => { const o = add(new THREE.SphereGeometry(r, 20, 14), m, parent); o.scale.set(sx, sy, sz); return o; };
const box = (w, h, d, m, parent = rider) => add(new THREE.BoxGeometry(w, h, d), m, parent);
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
// A shaped volume: rings [y, radiusX, radiusZ] stacked along Y, and one colour for each band between two rings
// (a function of the angle round the body where a band needs more than one). Limbs are modelled one unit long
// and stretched between two joints.
const shape = (rings, bands, seg = 20) => loft(rings, (t, ang) => { const c = bands[Math.min(bands.length - 1, Math.floor(t * (rings.length - 1)))]; return typeof c === 'function' ? c(ang) : c; }, seg);
const part1 = (rings, bands, parent = rider) => { const o = add(shape(rings, bands), M.cloth, parent); o.userData.r = 1; return o; };

// Board: forward is -Z. A real outline with sidecut, rounded nose and tail that kick up. Dark deck, a violet inlay,
// a line of light down the middle and a lit edge all the way round.
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
add(deckGeometry(1.12, 0.01), M.cyan, board).position.y = 0.012;
add(deckGeometry(1, 0.03), M.deck, board).position.y = 0.02;
add(deckGeometry(0.62, 0.006), M.tunic, board).position.y = 0.058;
add(deckGeometry(0.2, 0.006), M.pink, board).position.y = 0.064;
for (const z of [-0.27, 0.27]) box(0.36, 0.035, 0.26, M.dark, board).position.set(0, 0.068, z);
// Boots: rounded, dark sole, a lit binding strap.
const boot = () => { const g = new THREE.Group(); rider.add(g); ball(0.105, M.boot, g, 1.9, 1.12, 1.2); box(0.44, 0.045, 0.26, M.dark, g).position.y = -0.095; box(0.2, 0.04, 0.29, M.cyan, g).position.set(0.03, 0.078, 0); return g; };
const bootF = boot(), bootB = boot();
// Legs: indigo leggings into tall boots with a pale cuff and a ring of light under it.
const THIGH = [[-0.5, 0.1, 0.104], [-0.2, 0.098, 0.1], [0.2, 0.082, 0.084], [0.5, 0.07, 0.072]];
const SHIN = [[-0.5, 0.07, 0.072], [-0.24, 0.066, 0.068], [-0.235, 0.096, 0.098], [-0.12, 0.098, 0.1], [-0.115, 0.087, 0.089], [-0.075, 0.087, 0.089], [0.15, 0.078, 0.08], [0.5, 0.074, 0.076]];
const SHIN_C = [C.legging, C.cuff, C.cuff, C.boot, C.cyan, C.boot, C.boot];
const thighF = part1(THIGH, [C.legging]), shinF = part1(SHIN, SHIN_C), thighB = part1(THIGH, [C.legging]), shinB = part1(SHIN, SHIN_C);
const kneeF = ball(0.071, M.legging), kneeB = ball(0.071, M.legging);
const pelvis = ball(0.13, M.legging, rider, 1, 0.78, 1.15);
// Tunic: a flared skirt with a lit hem, a belted waist, chest and shoulders, a lighter panel down the front.
const front = (base, light) => (ang) => (Math.cos(ang) > 0.82 ? light : base);
const torso = part1([[-0.5, 0.25, 0.27], [-0.478, 0.246, 0.266], [-0.32, 0.17, 0.195], [-0.215, 0.118, 0.142], [-0.21, 0.13, 0.154], [-0.155, 0.13, 0.154], [-0.15, 0.112, 0.138], [0.0, 0.118, 0.16], [0.15, 0.128, 0.186], [0.27, 0.128, 0.2], [0.35, 0.108, 0.178], [0.41, 0.07, 0.085], [0.5, 0.054, 0.058]],
  [C.pink, front(C.tunic, C.tunicLight), front(C.tunic, C.tunicLight), C.leather, C.leather, C.tunic, front(C.tunic, C.tunicLight), front(C.tunic, C.tunicLight), front(C.tunic, C.tunicLight), C.tunicDark, C.tunicDark, C.skin]);
add(new THREE.OctahedronGeometry(0.05, 0), M.cyan, torso).position.set(0.14, -0.182, 0);                                   // belt stone
{ const strap = add(new THREE.TorusGeometry(0.2, 0.017, 6, 28), M.dark, torso); strap.position.set(0, 0.08, 0); strap.rotation.set(0.5, 1.5708, 0); strap.scale.set(1, 1.3, 0.72); }   // quiver strap across the chest
// Mantle: a short hooded cape over the shoulders, edged in light. The hood lies folded on the back.
add(shape([[0.2, 0.215, 0.315], [0.214, 0.213, 0.312], [0.33, 0.16, 0.245], [0.43, 0.09, 0.105], [0.475, 0.078, 0.086]], [C.pink, C.mantle, C.mantle, C.mantleDark]), M.cloth, torso);
{ const hood = ball(0.13, M.mantle, torso, 1.0, 0.62, 1.25); hood.position.set(-0.13, 0.385, 0); }
const shoulders = ball(0.072, solid(C.shirt)), shoulderB = ball(0.072, shoulders.material);
// Sleeves: full pale shirt sleeves into a dark bracer ringed with light at both ends.
const UPPER = [[-0.5, 0.068, 0.068], [-0.25, 0.076, 0.076], [0.3, 0.06, 0.06], [0.5, 0.05, 0.05]];
const FORE = [[-0.5, 0.05, 0.05], [-0.2, 0.05, 0.05], [-0.195, 0.06, 0.06], [-0.14, 0.06, 0.06], [-0.135, 0.056, 0.056], [0.32, 0.048, 0.048], [0.325, 0.054, 0.054], [0.37, 0.054, 0.054], [0.375, 0.042, 0.042], [0.5, 0.04, 0.04]];
const FORE_C = [C.shirt, C.pink, C.pink, C.leather, C.leather, C.cyan, C.cyan, C.leather, C.leather];
const upperF = part1(UPPER, [C.shirt]), foreF = part1(FORE, FORE_C), upperB = part1(UPPER, [C.shirt]), foreB = part1(FORE, FORE_C);
const elbowF = ball(0.052, shoulders.material), elbowB = ball(0.052, shoulders.material);
const handF = ball(0.05, M.dark, rider, 1, 1.25, 0.9), handB = ball(0.05, M.dark, rider, 1, 1.25, 0.9);          // gloves
// Head: front is -Z. Drawn face, pointed ears, a circlet, and a white mane built from big curved, tapering locks
// swept back by the wind.
const head = new THREE.Group(); rider.add(head); head.scale.setScalar(0.95);
add(new THREE.SphereGeometry(0.19, 32, 24), M.face, head).scale.set(0.98, 1.05, 0.98);
add(new THREE.SphereGeometry(0.207, 24, 14, 0, 6.2832, 0, 1.5).rotateX(0.66), M.hair, head).position.set(0, 0.018, 0.03);
// A lock grows along +Y from its root and tapers to a point. bend curves it sideways, curl wraps it round the skull.
const lockGeo = (len, w, flat, bend, curl) => loft([0, 0.16, 0.36, 0.58, 0.8, 1].map((t) => [len * t, Math.max(0.004, w * Math.pow(1 - t, 0.62)), Math.max(0.004, w * flat * Math.pow(1 - t, 0.62)), bend * t * t, curl * t * t]), () => C.hair, 8);
const lock = (x, y, z, rx, ry, rz, len, w, flat = 1, bend = 0, curl = 0) => { const o = add(lockGeo(len, w, flat, bend, curl), M.hairV, head); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
// fringe: flat locks falling across the forehead, parted to one side
[[-0.125, 0.5, 0.05], [-0.07, 0.24, 0.03], [-0.012, 0.02, -0.02], [0.05, -0.22, -0.05], [0.108, -0.46, -0.04]].forEach(([x, rz, bend], i) => lock(x, 0.125 - Math.abs(x) * 0.2, -0.172 + Math.abs(x) * 0.28, Math.PI - 0.28, 0, rz, 0.2 + (i % 2) * 0.035, 0.058, 0.4, bend));
// the mane: broad flat blades in three rows (crown, back, nape), each row fanned left to right and curled round the
// skull so the tips flick out at the neck; then two thin wind-blown spikes off the crown.
const fan = (rows) => rows.forEach(([x, y, z, rx, rz, len, w, bend, curl]) => { for (const sd of x ? [-1, 1] : [1]) lock(sd * x, y, z, rx, 0, -sd * rz, len, w, 0.42, -sd * bend, curl); });
fan([[0, 0.185, -0.02, 1.45, 0, 0.36, 0.105, 0, 0.2], [0.085, 0.165, -0.01, 1.5, 0.36, 0.34, 0.098, 0.03, 0.2], [0.155, 0.11, 0.0, 1.55, 0.8, 0.31, 0.09, 0.03, 0.18],
  [0, 0.08, 0.165, 2.2, 0, 0.38, 0.105, 0, 0.13], [0.092, 0.07, 0.145, 2.2, 0.3, 0.36, 0.098, 0.04, 0.13], [0.165, 0.03, 0.085, 2.3, 0.55, 0.33, 0.088, 0.05, 0.11],
  [0.05, -0.04, 0.175, 2.7, 0.12, 0.31, 0.088, 0.03, 0.02], [0.132, -0.05, 0.125, 2.75, 0.4, 0.28, 0.078, 0.05, 0.02]]);
lock(0.03, 0.2, 0.02, 0.6, 0, -0.25, 0.27, 0.05, 0.6, 0.05); lock(-0.07, 0.19, 0.04, 0.82, 0, 0.45, 0.22, 0.045, 0.6, -0.04);
for (const sd of [-1, 1]) {
  const ear = add(loft([0, 0.4, 0.75, 1].map((t) => [0.22 * t, 0.04 * (1 - t) + 0.004, 0.022 * (1 - t) + 0.003, 0, 0]), () => C.skin, 8), M.cloth, head); ear.position.set(sd * 0.178, -0.01, 0.02); ear.rotation.set(0.45, 0, -sd * 1.15);
  lock(sd * 0.172, 0.02, -0.07, Math.PI + 0.12, 0, -sd * 0.08, 0.27, 0.044, 0.55, sd * 0.02);      // side lock in front of the ear
}
{ const band = add(new THREE.TorusGeometry(0.196, 0.011, 6, 28).rotateX(Math.PI / 2), M.cyan, head); band.position.set(0, 0.075, 0); band.rotation.x = -0.2; }
// The quiver, banded in light; the arrows in it glow.
const quiver = add(new THREE.CylinderGeometry(0.058, 0.044, 0.54, 12), M.dark);
add(new THREE.TorusGeometry(0.058, 0.012, 6, 14).rotateX(Math.PI / 2), M.pink, quiver).position.y = 0.25;
for (let i = 0; i < 4; i++) { const f = box(0.018, 0.15, 0.05, M.cyan, quiver); f.position.set(Math.cos(i * 1.6) * 0.025, 0.34, Math.sin(i * 1.6) * 0.025); f.rotation.y = i; }

// Bow: -Z points at the target. Pale limbs tipped with light; they flex and the string pulls back with the draw.
export const bow = new THREE.Group(); rider.add(bow);
const limbCurve = new THREE.CatmullRomCurve3([V(0, 0.05, -0.02), V(0, 0.32, -0.05), V(0, 0.58, 0.06), V(0, 0.72, 0.17)]);
const limbTube = new THREE.TubeGeometry(limbCurve, 14, 0.026, 6);
{ const p = limbTube.attributes.position, c = V(), q = V(); for (let i = 0; i < p.count; i++) { q.fromBufferAttribute(p, i); const t = Math.min(1, Math.max(0, (q.y - 0.05) / 0.67)); limbCurve.getPoint(t, c); q.lerp(c, t * 0.62); p.setXYZ(i, q.x, q.y, q.z); } limbTube.computeVertexNormals(); }   // taper toward the tip
const bowUp = new THREE.Group(), bowDown = new THREE.Group(); bow.add(bowUp, bowDown);
bowUp.add(new THREE.Mesh(limbTube, M.bowWood)); { const t = new THREE.Mesh(limbTube, M.bowWood); t.scale.y = -1; bowDown.add(t); }
bow.scale.setScalar(1.35);
for (const g of [bowUp, bowDown]) { const tip = add(new THREE.OctahedronGeometry(0.045, 0), M.cyan, g); tip.position.set(0, g === bowUp ? 0.73 : -0.73, 0.175); tip.scale.set(0.8, 1.5, 0.8); }
add(new THREE.CylinderGeometry(0.033, 0.033, 0.2, 8), M.dark, bow);
const stringGeo = new THREE.BufferGeometry(); stringGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
bow.add(new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(1.4, 2.4, 2.8) })));
const nocked = arrowMesh(); bow.add(nocked);

rider.traverse((o) => { o.castShadow = true; });
// Two scarf tails streaming from the neck, magenta running out to cyan, and a tail of white hair. All three are
// chains dragged behind the rider, so they whip across on every carve.
const SC = 12, HC = 9;
const chain = (n) => ({ pts: Array.from({ length: n }, () => V()), draw: Array.from({ length: n }, () => V()) });
const scarfA = chain(SC), scarfB = chain(SC), tail = chain(HC);
const scarf = new Ribbon(SC, 0.26, new THREE.Color('#ff2f8e'), false, new THREE.Color('#7a3cff'), 0.5), scarf2 = new Ribbon(SC, 0.18, new THREE.Color('#5a2fd8'), false, new THREE.Color('#ff4fa8'), 0.55);
const hairTail = new Ribbon(HC, 0.21, new THREE.Color(1.02, 1.03, 1.12), false, new THREE.Color(0.86, 0.9, 1.1), 0.9);

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
  for (const ch of [scarfA, scarfB, tail]) ch.pts.forEach((p, i) => p.set(P.x, P.y + 1.9, P.z + i * 0.1));
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
  hip.set(0.04 + c * 0.1, 0.98 - c * 0.46 + bob, 0);
  chest.set(hip.x + 0.06 + c * 0.2, hip.y + 0.5 - c * 0.1, -0.04);
  bootF.position.copy(footF); bootB.position.copy(footB);
  setLimb(thighF, a.set(hip.x, hip.y, -0.1), ik(a, b.set(0, 0.2, -0.27), 0.5, 0.5, _p2.set(1, 0.2, -0.5), knee)); setLimb(shinF, knee, b); kneeF.position.copy(knee);
  setLimb(thighB, a.set(hip.x, hip.y, 0.1), ik(a, b.set(0, 0.2, 0.27), 0.5, 0.5, _p2.set(1, 0.2, 0.5), knee)); setLimb(shinB, knee, b); kneeB.position.copy(knee);
  pelvis.position.copy(hip);
  setLimb(torso, a.set(hip.x - 0.02, hip.y - 0.3, 0), b.set(chest.x + 0.01, chest.y + 0.2, chest.z));
  shoulders.position.set(chest.x, chest.y + 0.06, chest.z - 0.215); shoulderB.position.set(chest.x, chest.y + 0.06, chest.z + 0.215);
  head.position.set(chest.x + 0.03, chest.y + 0.375, chest.z - 0.02); head.rotation.set(0.05, G.mode === 'title' || G.mode === 'lobby' ? -0.45 : 0.35 - e * 0.2 + aim.blend * 0.2, 0);
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

  // Scarves and hair: chains dragged from the neck and the back of the head; flutter is layered on top so they snap like cloth.
  drag(scarfA, _d2.set(chest.x - 0.1, chest.y + 0.25, chest.z + 0.04).applyMatrix4(rider.matrixWorld), 0.15, 1, dt); flutter(scarfA, scarf, 0.07, 16, 0.85, 0);
  drag(scarfB, _d2.set(chest.x - 0.1, chest.y + 0.22, chest.z - 0.05).applyMatrix4(rider.matrixWorld), 0.1, 1.04, dt); flutter(scarfB, scarf2, 0.06, 13, 1.1, 0.12);
  drag(tail, _d2.set(head.position.x - 0.05, head.position.y - 0.03, head.position.z + 0.17).applyMatrix4(rider.matrixWorld), 0.075, 1.1, dt); flutter(tail, hairTail, 0.035, 19, 1.2, 0.05);

  // Light trails: two lines of light laid down by the tail of the board. They brighten with speed and change colour with flow.
  const flow = G.flow || 1, gain = clamp((P.v - 10) / 22, 0.25, 1) * (G.mode === 'run' || G.mode === 'finished' ? 1 : 0.6);
  TRAIL_COL.lerpColors(TRAIL_A, TRAIL_B, clamp((flow - 1) / 3, 0, 1)); if (flow > 4) TRAIL_COL.lerp(TRAIL_C, clamp((flow - 4) / 3, 0, 1));
  for (const tr of trails) {
    _d2.set(tr.side * 0.13, 0.07, 0.66).applyMatrix4(rider.matrixWorld);
    if (!tr.live) { tr.pts.forEach((q) => q.copy(_d2)); tr.live = true; }
    if (tr.pts[1].distanceToSquared(_d2) > 0.36) { const lastP = tr.pts.pop(); tr.pts.splice(1, 0, lastP); lastP.copy(tr.pts[0]); }
    tr.pts[0].copy(_d2);
    tr.ribbon.color.copy(TRAIL_COL); tr.ribbon.tip.copy(TRAIL_COL).lerp(TRAIL_TIP, 0.6); tr.ribbon.update(tr.pts, 0.3, 0.45 + gain * 0.4);
    tr.core.color.copy(TRAIL_COL).lerp(WHITE, 0.35); tr.core.tip.copy(TRAIL_COL); tr.core.update(tr.pts, 0.5, 1.2 + gain * 1.6);
  }
}
// One step of a dragged chain: every link is carried back by the wind and down by its weight, then pulled to length.
function drag(ch, anchor, seg, lift, dt) {
  const pts = ch.pts, sp = Math.hypot(P.vel.x, P.vel.z);
  pts[0].copy(anchor);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = pts[i - 1];
    p.x -= P.vel.x * 0.5 * dt; p.z -= P.vel.z * 0.5 * dt; p.y -= (5 - Math.min(4.4, sp * 0.2) * lift + P.vel.y * 0.2) * dt;
    _d.subVectors(p, q); const len = _d.length() || 1; p.copy(q).addScaledVector(_d, seg / len);
  }
}
function flutter(ch, ribbon, amp, rate, phase, rise) {
  const n = ch.pts.length, sp = Math.hypot(P.vel.x, P.vel.z), ch0 = Math.cos(P.h), sh0 = Math.sin(P.h);
  for (let i = 0; i < n; i++) {
    const k = (i / n) * (amp + sp * 0.004), ph = G.t * rate - i * phase, o = ch.draw[i].copy(ch.pts[i]);
    o.x += ch0 * Math.sin(ph) * k; o.z += sh0 * Math.sin(ph) * k; o.y += Math.cos(ph * 0.8) * k + rise * i / n;
  }
  ribbon.update(ch.draw, 0);
}
const TN = 30, TRAIL_A = hot('#3fd8ff', 1.7), TRAIL_B = hot('#ff3fa6', 1.9), TRAIL_C = hot('#ffd34a', 2.2), TRAIL_TIP = hot('#8a4cff', 1.2), TRAIL_COL = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1), _d2 = V();
const trails = [-1, 1].map((side) => ({ side, live: false, pts: Array.from({ length: TN }, () => V()), ribbon: new Ribbon(TN, 0.2, TRAIL_A, false, TRAIL_TIP, 1), core: new Ribbon(TN, 0.06, TRAIL_A, false, TRAIL_A, 1) }));
for (const tr of trails) for (const [rb, k] of [[tr.ribbon, -6], [tr.core, -9]]) Object.assign(rb.mesh.material, { polygonOffset: true, polygonOffsetFactor: k, polygonOffsetUnits: k });   // drawn over the trench they lie in
const _zero = V(), _z = V(0, 0, 1), _p2 = V();
