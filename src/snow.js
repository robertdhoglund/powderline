// Powder: soft spray particles, the trench behind the board, and drifting flakes that streak with speed.
import * as THREE from 'three';
import { scene, camera, renderer, pal } from './world.js';
import { height } from './course.js';
import { rand, clamp } from './util.js';
import { LEVEL } from './levels.js';

// ---- spray particles ----------------------------------------------------------------------
const N = 6000;
const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
const aSize = new Float32Array(N), aAlpha = new Float32Array(N), aTint = new Float32Array(N);
const life = new Float32Array(N), maxLife = new Float32Array(N), size0 = new Float32Array(N), grow = new Float32Array(N);
const drag = new Float32Array(N), grav = new Float32Array(N), alpha0 = new Float32Array(N);
for (let i = 0; i < N; i++) pos[i * 3 + 1] = -9999;
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('aTint', new THREE.BufferAttribute(aTint, 1));
const mat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uScale: { value: 600 }, uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() } },
  vertexShader: `attribute float aSize, aAlpha, aTint; uniform float uScale; varying float vA, vT;
    void main(){ vA = aAlpha; vT = aTint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = min(300.0, aSize * uScale / max(0.5, -mv.z)); vA *= smoothstep(2.5, 10.0, -mv.z); }`,
  fragmentShader: `uniform vec3 uLit, uShade; varying float vA, vT;
    void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; float a = smoothstep(1.0, 0.0, r); a *= a;
      // Lit from above and ahead: the top of each puff catches the low sun.
      float top = clamp(0.5 - q.y * 1.3, 0.0, 1.0);
      gl_FragColor = vec4(mix(uShade, uLit, clamp(vT * 0.6 + top * 0.6, 0.0, 1.0)), a * vA); }`,
});
const points = new THREE.Points(geo, mat);
points.frustumCulled = false; points.renderOrder = 5; scene.add(points);
let next = 0;

export function emit(x, y, z, vx, vy, vz, size, lifeS, growK = 2, alpha = 0.5, dragK = 2.2, gravK = 5, tint = rand()) {
  const i = next++ % N, p = i * 3;
  pos[p] = x; pos[p + 1] = y; pos[p + 2] = z; vel[p] = vx; vel[p + 1] = vy; vel[p + 2] = vz;
  life[i] = maxLife[i] = lifeS; size0[i] = size; grow[i] = growK; alpha0[i] = alpha; drag[i] = dragK; grav[i] = gravK; aTint[i] = tint;
  geo.attributes.aTint.needsUpdate = true;
}

// A soft radial burst: landings, impacts, ice breaks.
export function puff(p, n, power = 1, vx = 0, vy = 0, vz = 0) {
  for (let k = 0; k < n; k++) {
    const a = rand(6.283), s = rand(1, 7) * power;
    emit(p.x + rand(-0.4, 0.4), p.y + rand(0, 0.4), p.z + rand(-0.4, 0.4), Math.cos(a) * s + vx, rand(0.8, 4.2) * power + vy, Math.sin(a) * s + vz,
      rand(0.5, 1.3) * power, rand(0.6, 1.4), 2.6, rand(0.25, 0.5), 2.6, 3.5);
  }
}

// The carve: a coherent sheet of snow thrown off the outside edge, plus a low wake.
let acc = 0;
export function spray(P, dt, brake) {
  const sp = P.v / 30, e = Math.abs(P.edge), side = P.edge > 0 ? -1 : 1;
  const dx = Math.sin(P.h), dz = -Math.cos(P.h), rx = Math.cos(P.h), rz = Math.sin(P.h);
  acc += dt * (0.35 + sp) * (50 + e * 1350 + brake * 1500) * (LEVEL.spray || 1);
  let n = Math.min(90, acc | 0); acc -= n;
  while (n-- > 0) {
    const along = rand(-0.9, 0.5), sheet = Math.random() < e * 1.4 || brake > 0.5;
    const x = P.x + dx * along + rx * side * 0.12, z = P.z + dz * along + rz * side * 0.12, y = P.y + rand(0, 0.12);
    if (sheet) {
      const out = (1.6 + e * 6.5 * rand(0.55, 1.15)) * (0.5 + sp * 0.6), up = (1.4 + e * 5.6 * rand(0.5, 1.1) + brake * 2) * (0.6 + sp * 0.5), carry = P.v * rand(0.3, 0.62) * (1 - brake * 0.5);
      const s = brake > 0.5 ? (Math.random() < 0.5 ? -1 : 1) * rand(0.2, 1) : side;
      emit(x, y, z, rx * s * out + dx * carry, up, rz * s * out + dz * carry, rand(0.2, 0.5), rand(0.45, 0.95), 2.2, rand(0.3, 0.58), 2.3, 7.0);
    } else {
      emit(x + rx * rand(-0.3, 0.3), y, z + rz * rand(-0.3, 0.3), rx * rand(-1.2, 1.2) + dx * P.v * 0.12, rand(0.2, 0.9), rz * rand(-1.2, 1.2) + dz * P.v * 0.12, rand(0.3, 0.6), rand(0.4, 0.8), 2.2, rand(0.12, 0.22), 2.2, 1.5);
    }
  }
}

// Sluff: on steep pitches a carve sets loose snow running down the slope beside you.
export function sluff(P, dt, side) {
  let n = Math.random() < dt * 60 ? 2 : 0;
  while (n-- > 0) {
    const rx = Math.cos(P.h), rz = Math.sin(P.h), dx = Math.sin(P.h), dz = -Math.cos(P.h), o = rand(0.5, 2.6) * side;
    emit(P.x + rx * o + dx * rand(-1, 1), P.y + 0.1, P.z + rz * o + dz * rand(-1, 1), dx * P.v * rand(0.75, 0.95) + rx * side, rand(0.2, 1.2), dz * P.v * rand(0.75, 0.95) + rz * side, rand(0.35, 0.8), rand(0.8, 1.5), 1.6, rand(0.2, 0.36), 0.5, 2.5);
  }
}

// ---- trench: a real groove. Raised berms either side, walls that catch or lose the sun, a packed floor.
const SEG = 900, QUADS = 6, VPS = QUADS * 6;
const tPos = new Float32Array(SEG * VPS * 3), tCol = new Float32Array(SEG * VPS * 3), tNor = new Float32Array(SEG * VPS * 3);
const tGeo = new THREE.BufferGeometry();
tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage));
tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3).setUsage(THREE.DynamicDrawUsage));
tGeo.setAttribute('normal', new THREE.BufferAttribute(tNor, 3).setUsage(THREE.DynamicDrawUsage));
const trench = new THREE.Mesh(tGeo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
trench.frustumCulled = false; trench.receiveShadow = true; scene.add(trench);
let tHead = 0, prev = null;
const SHADE = [1.0, 1.12, 0.6, 0.6, 1.12, 1.0, 1.0];     // outer, berm, floor edge, floor edge, berm, outer
function quad(k, a, b, c, d, ca, cb) { // a,b on the previous cross-section, c,d on this one
  const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = b[0] - a[0], vy = b[1] - a[1], vz = b[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
  const v = [a, b, c, b, d, c], cc = [ca, cb, ca, cb, cb, ca];
  for (let i = 0; i < 6; i++) { const o = k + i * 3; tPos.set(v[i], o); tNor[o] = nx / l; tNor[o + 1] = ny / l; tNor[o + 2] = nz / l; tCol[o] = cc[i] * 0.95; tCol[o + 1] = cc[i] * 0.96; tCol[o + 2] = cc[i]; }
}
export function carveTrench(P, grounded, brake) {
  if (!grounded) { prev = null; return; }
  const rx = Math.cos(P.h), rz = Math.sin(P.h), e = P.edge, w = 0.13 + brake * 0.45, out = e > 0 ? -1 : 1, big = Math.abs(e) * 0.14 + brake * 0.1;
  // Carving piles the berm higher on the outside of the turn.
  const offs = [-(w + 0.3), -(w + 0.1), -w, w, w + 0.1, w + 0.3], lift = [0.0, 0.13 + (out < 0 ? big : 0), -0.02, -0.02, 0.13 + (out > 0 ? big : 0), 0.0];
  const cur = offs.map((o, i) => { const x = P.x + rx * o, z = P.z + rz * o; return [x, height(x, z) + lift[i] + 0.025, z]; }); cur.x = P.x; cur.z = P.z;
  if (!prev) { prev = cur; return; }
  if ((cur.x - prev.x) ** 2 + (cur.z - prev.z) ** 2 < 0.3) return;
  const k = (tHead++ % SEG) * VPS * 3;
  for (let i = 0; i < QUADS - 1; i++) quad(k + i * 18, prev[i], prev[i + 1], cur[i], cur[i + 1], SHADE[i], SHADE[i + 1]);
  tGeo.attributes.position.needsUpdate = true; tGeo.attributes.color.needsUpdate = true; tGeo.attributes.normal.needsUpdate = true;
  prev = cur;
}

// ---- flakes: drifting snow that streaks into speed lines ---------------------------------
const F = Math.round(380 * (LEVEL.flakes || 1)), BOX = new THREE.Vector3(46, 26, 70);
const fBase = new Float32Array(F * 3), fPos = new Float32Array(F * 6);
for (let i = 0; i < F * 3; i += 3) { fBase[i] = rand(BOX.x); fBase[i + 1] = rand(BOX.y); fBase[i + 2] = rand(BOX.z); }
const fGeo = new THREE.BufferGeometry();
fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3).setUsage(THREE.DynamicDrawUsage));
const flakes = new THREE.LineSegments(fGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
flakes.frustumCulled = false; scene.add(flakes);
const lastCam = new THREE.Vector3(), camVel = new THREE.Vector3();
const mod = (v, m) => ((v % m) + m) % m;

export function updateSnow(dt, rdt) {
  for (let i = 0; i < N; i++) {
    if (life[i] <= 0) continue;
    const p = i * 3; life[i] -= dt;
    if (life[i] <= 0) { pos[p + 1] = -9999; aAlpha[i] = 0; continue; }
    const k = Math.exp(-drag[i] * dt);
    vel[p] *= k; vel[p + 2] *= k; vel[p + 1] = vel[p + 1] * k - grav[i] * dt;
    pos[p] += vel[p] * dt; pos[p + 1] += vel[p + 1] * dt; pos[p + 2] += vel[p + 2] * dt;
    const t = 1 - life[i] / maxLife[i];
    aSize[i] = size0[i] * (1 + grow[i] * t);
    aAlpha[i] = alpha0[i] * Math.min(1, t * 12) * (1 - t) * (1 - t * 0.4);
  }
  geo.attributes.position.needsUpdate = true; geo.attributes.aSize.needsUpdate = true; geo.attributes.aAlpha.needsUpdate = true;
  mat.uniforms.uScale.value = renderer.domElement.height * 0.5 / Math.tan(camera.fov * Math.PI / 360);
  mat.uniforms.uLit.value.copy(pal.light).lerp(_w, 0.6).multiplyScalar(1.5);
  mat.uniforms.uShade.value.copy(pal.sky).lerp(_w, 0.45);

  // flakes
  const c = camera.position;
  camVel.subVectors(c, lastCam).divideScalar(Math.max(rdt, 0.001)); lastCam.copy(c);
  if (camVel.lengthSq() > 200 * 200) camVel.set(0, 0, 0);
  const st = 0.013;
  for (let i = 0; i < F; i++) {
    const b = i * 3, k = i * 6;
    fBase[b] += Math.sin(i) * 0.6 * dt; fBase[b + 1] -= (0.8 + (i % 5) * 0.25) * dt;
    const x = c.x + mod(fBase[b] - c.x, BOX.x) - BOX.x / 2, y = c.y + mod(fBase[b + 1] - c.y, BOX.y) - BOX.y / 2, z = c.z + mod(fBase[b + 2] - c.z, BOX.z) - BOX.z * 0.72;
    fPos[k] = x; fPos[k + 1] = y; fPos[k + 2] = z;
    fPos[k + 3] = x + camVel.x * st; fPos[k + 4] = y + camVel.y * st + 0.03; fPos[k + 5] = z + camVel.z * st;
  }
  fGeo.attributes.position.needsUpdate = true;
  flakes.material.opacity = clamp(0.22 + camVel.length() * 0.006, 0.22, 0.5);
}
const _w = new THREE.Color(1, 1, 1);

export function resetSnow() {
  life.fill(0); aAlpha.fill(0); for (let i = 0; i < N; i++) pos[i * 3 + 1] = -9999;
  tPos.fill(0); tHead = 0; prev = null; tGeo.attributes.position.needsUpdate = true; acc = 0;
}
