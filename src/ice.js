// Ice sheets to ride across and ice walls to shoot. Each panel is pre-fractured into irregular
// cells; on impact, cracks race outward from the hit point and the cells let go in a wave.
import * as THREE from 'three';
import { G } from './state.js';
import { scene, sunDir, pal } from './world.js';
import { height, cx, dcx, sheets, walls } from './course.js';
import { P } from './player.js';
import { burst, ring, shake, hitstop } from './fx.js';
import * as snow from './snow.js';
import { award, pop, breakFlow, flash } from './hud.js';
import { sfx } from './audio.js';
import { rng, rand } from './util.js';

const CYAN = new THREE.Color('#7af3ff').multiplyScalar(2.2);
// Glassy ice: see-through face-on, bright and milky at glancing angles, with a hard sun glint per facet.
const iceMat = new THREE.ShaderMaterial({
  transparent: true, side: THREE.DoubleSide, fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSun: { value: sunDir }, uLight: { value: new THREE.Color() }, uDeep: { value: new THREE.Color('#0a63b0') }, uEdge: { value: new THREE.Color('#62e9ff') } }]),
  vertexShader: `varying vec3 vWp; varying vec3 vLp;
    #include <fog_pars_vertex>
    void main(){ vLp = position; vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader: `uniform vec3 uSun, uLight, uDeep, uEdge; varying vec3 vWp; varying vec3 vLp;
    #include <fog_pars_fragment>
    void main(){
      vec3 n = normalize(cross(dFdx(vWp), dFdy(vWp))), v = normalize(cameraPosition - vWp);
      float f = pow(1.0 - abs(dot(n, v)), 2.2);
      float frost = 0.5 + 0.5 * sin(vLp.x * 3.1 + sin(vLp.z * 2.3) * 2.0) * sin(vLp.z * 2.7 + vLp.x);
      vec3 col = mix(uDeep, uEdge * 1.15, clamp(f * 0.8 + frost * 0.14, 0.0, 0.85));
      float spec = min(1.0, pow(max(dot(reflect(-v, n), uSun), 0.0), 90.0) + pow(max(dot(reflect(-v, -n), uSun), 0.0), 90.0));
      col += uLight * spec * 1.1 + uLight * 0.06;
      gl_FragColor = vec4(col, mix(0.55, 0.95, clamp(f + spec, 0.0, 1.0)));
      #include <fog_fragment>
    }`,
});
const r = rng(555);
export const panels = [];

function clip(poly, mx, my, nx, ny) { // keep the side where (p - m) . n <= 0
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = (a[0] - mx) * nx + (a[1] - my) * ny, db = (b[0] - mx) * nx + (b[1] - my) * ny;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
function prism(poly, ox, oy, th, skipInner, a0, a1, b0, b1) {
  const v = [], n = poly.length, edge = (p) => Math.abs(p[0] - a0) < 1e-3 || Math.abs(p[0] - a1) < 1e-3 || Math.abs(p[1] - b0) < 1e-3 || Math.abs(p[1] - b1) < 1e-3;
  for (let i = 1; i < n - 1; i++) for (const y of [th / 2, -th / 2]) for (const p of [poly[0], poly[i], poly[i + 1]]) v.push(p[0] - ox, y, p[1] - oy);
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    if (skipInner && !(edge(p) && edge(q))) continue;
    v.push(p[0] - ox, th / 2, p[1] - oy, q[0] - ox, th / 2, q[1] - oy, p[0] - ox, -th / 2, p[1] - oy, q[0] - ox, th / 2, q[1] - oy, q[0] - ox, -th / 2, q[1] - oy, p[0] - ox, -th / 2, p[1] - oy);
  }
  return v;
}

function makePanel(kind, O, A, B, w, b0, b1, cellSize, th) {
  const N = new THREE.Vector3().crossVectors(B, A), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(A, N, B));
  const a0 = -w / 2, a1 = w / 2, nx = Math.max(2, Math.round(w / cellSize)), ny = Math.max(2, Math.round((b1 - b0) / cellSize));
  const seeds = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) seeds.push([a0 + (i + 0.5 + (r() - 0.5) * 0.85) * w / nx, b0 + (j + 0.5 + (r() - 0.5) * 0.85) * (b1 - b0) / ny]);
  const cells = [], whole = [], lines = [];
  for (const s of seeds) {
    let poly = [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];
    for (const o of seeds) { if (o === s) continue; const dx = o[0] - s[0], dy = o[1] - s[1]; if (dx * dx + dy * dy > cellSize * cellSize * 9) continue; poly = clip(poly, (s[0] + o[0]) / 2, (s[1] + o[1]) / 2, dx, dy); if (poly.length < 3) break; }
    if (poly.length < 3) continue;
    let ca = 0, cb = 0; poly.forEach((p) => { ca += p[0]; cb += p[1]; }); ca /= poly.length; cb /= poly.length;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(prism(poly, ca, cb, th, false), 3)); geo.computeVertexNormals();
    cells.push({ ca, cb, geo });
    whole.push(...prism(poly, 0, 0, th, true, a0, a1, b0, b1));
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q2 = poly[(i + 1) % poly.length]; lines.push(p[0], th / 2 + 0.01, p[1], q2[0], th / 2 + 0.01, q2[1]); }
  }
  const group = new THREE.Group(); group.position.copy(O); group.quaternion.copy(q); scene.add(group);
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(whole, 3)); wg.computeVertexNormals();
  const intact = new THREE.Mesh(wg, iceMat); intact.frustumCulled = false; group.add(intact);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  lg.setAttribute('aDist', new THREE.BufferAttribute(new Float32Array(lines.length / 3), 1));
  const lmat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uFront: { value: -1 }, uFade: { value: 1 } },
    vertexShader: `attribute float aDist; varying float vD; void main(){ vD = aDist; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uFront, uFade; varying float vD; void main(){ float lit = step(vD, uFront); float edge = lit * smoothstep(6.0, 0.0, uFront - vD);
      gl_FragColor = vec4(mix(vec3(0.5, 1.6, 1.9), vec3(4.0, 5.0, 5.0), edge) * mix(0.6, 1.0, lit), mix(0.55, 1.0, lit) * uFade); }` });
  const veins = new THREE.LineSegments(lg, lmat); veins.frustumCulled = false; group.add(veins);
  const p = { kind, O, A, B, N, q, w, b0, b1, cells, group, intact, veins, lg, lmat, state: 0, t: 0, pieces: [], side: 1, speed: 60, inside: false };
  panels.push(p); return p;
}

for (const s of sheets) {
  const x = cx(s.d) + s.u, sl = (height(cx(s.d - 4), -(s.d - 4)) - height(cx(s.d + 4), -(s.d + 4))) / 8, nrm = new THREE.Vector3(0, 1, -sl).normalize();
  const B = new THREE.Vector3(-dcx(s.d), sl, 1).normalize(), A = new THREE.Vector3().crossVectors(nrm, B).normalize();
  makePanel('sheet', new THREE.Vector3(x, height(cx(s.d), -s.d), -s.d).addScaledVector(nrm, 0.2), A, B, s.w, -s.len / 2, s.len / 2, Math.max(2.2, Math.sqrt(s.w * s.len / 75)), 0.16);
}
for (const s of walls) {
  const x = cx(s.d) + s.u, A = new THREE.Vector3(1, 0, dcx(s.d)).normalize();
  makePanel('wall', new THREE.Vector3(x, height(x, -s.d), -s.d), A, new THREE.Vector3(0, 1, 0), s.w, -0.6, s.h, 1.55, 0.22);
}
G.totals.ice = panels.length;

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const local = (p, pt) => { _v.subVectors(pt, p.O); return [_v.dot(p.A), _v.dot(p.B), _v.dot(p.N)]; };

export function breakPanel(p, at, impulse, byArrow) {
  if (p.state !== 0) return;
  const [ia, ib] = local(p, at);
  p.state = 1; p.t = 0; p.intact.visible = false; p.speed = byArrow ? 75 : 48;
  const pos = p.lg.attributes.position, ad = p.lg.attributes.aDist;
  for (let i = 0; i < pos.count; i++) ad.setX(i, Math.hypot(pos.getX(i) - ia, pos.getZ(i) - ib));
  ad.needsUpdate = true;
  for (const c of p.cells) {
    const mesh = new THREE.Mesh(c.geo, iceMat), dist = Math.hypot(c.ca - ia, c.cb - ib);
    mesh.position.copy(p.O).addScaledVector(p.A, c.ca).addScaledVector(p.B, c.cb); mesh.quaternion.copy(p.q); scene.add(mesh);
    const out = _w.copy(p.A).multiplyScalar(c.ca - ia).addScaledVector(p.B, c.cb - ib).normalize();
    const fall = 1 / (1 + dist * 0.18), vel = out.clone().multiplyScalar(rand(1.5, 5.5)).addScaledVector(p.N, (p.kind === 'sheet' ? rand(2, 6.5) : rand(-2, 2))).addScaledVector(impulse, fall * rand(0.6, 1.1));
    p.pieces.push({ mesh, delay: dist / p.speed + (byArrow ? 0.05 : 0.22) + rand(0, 0.04), vel, spin: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), rate: rand(1.5, 7), life: rand(1.3, 2.1), out: false });
  }
  burst(at, 60, CYAN, { speed: 15, size: 0.17, life: 1.0, up: 4, dir: _w.copy(impulse).multiplyScalar(0.4) });
  ring(at, CYAN, 9, 0.4); snow.puff(at, 24, 1.1);
  shake(byArrow ? 0.3 : 0.38); sfx('crack'); sfx('ice'); G.stats.ice++;
}

let prevSide = new Map();
export function updateIce(dt) {
  iceMat.uniforms.uLight.value.copy(pal.light);
  for (const p of panels) {
    if (Math.abs(-p.O.z - P.d) > 260 && p.state !== 1) continue;
    const [a, b, n] = local(p, P.pos);
    if (p.kind === 'sheet') {
      const on = Math.abs(a) < p.w / 2 && b > p.b0 && b < p.b1 && P.alt < 0.6;
      if (on && p.state === 0 && G.mode === 'run') { breakPanel(p, P.pos, _v.copy(P.vel).multiplyScalar(0.12).clone(), false); award(150, 'THIN ICE'); }
      if (on) { P.onIce = true; if (Math.random() < dt * 40) burst(P.pos, 2, CYAN, { speed: 5, size: 0.1, life: 0.5, up: 3 }); }
    } else if (p.state === 0) {
      const was = prevSide.get(p); prevSide.set(p, n);
      if (was !== undefined && was * n < 0 && Math.abs(a) < p.w / 2 && b < p.b1 && G.mode === 'run') {
        G.stats.ice--; breakPanel(p, P.chest, P.vel.clone().multiplyScalar(0.55), false);
        P.v *= 0.6; breakFlow(); shake(0.75); flash(0.4); pop('CRASH');
      }
    }
    if (p.state !== 1) continue;
    p.t += dt; p.lmat.uniforms.uFront.value = p.t * p.speed; p.lmat.uniforms.uFade.value = Math.max(0, 1 - Math.max(0, p.t - 0.35) * 2.2);
    let alive = 0;
    for (const s of p.pieces) {
      if (!s.mesh) continue; alive++;
      if (p.t < s.delay) continue;
      if (!s.out) { s.out = true; if (Math.random() < 0.6) burst(s.mesh.position, 3, CYAN, { speed: 7, size: 0.13, life: 0.7, up: 3 }); }
      s.vel.y -= 21 * dt; s.mesh.position.addScaledVector(s.vel, dt); s.mesh.rotateOnAxis(s.spin, s.rate * dt);
      s.life -= dt; s.mesh.scale.setScalar(Math.min(1, s.life / 0.4));
      if (s.life <= 0) { scene.remove(s.mesh); s.mesh = null; }
    }
    if (!alive) { p.state = 2; p.veins.visible = false; }
  }
}

// Arrow tip moved from p0 to p1: did it go through a panel?
export function arrowHit(p0, p1, dir) {
  for (const p of panels) {
    if (p.state !== 0) continue;
    const s0 = _v.subVectors(p0, p.O).dot(p.N), s1 = _v.subVectors(p1, p.O).dot(p.N);
    if (s0 * s1 > 0) continue;
    const hit = new THREE.Vector3().lerpVectors(p0, p1, s0 / (s0 - s1 || 1)), [a, b] = local(p, hit);
    if (Math.abs(a) > p.w / 2 || b < p.b0 || b > p.b1) continue;
    breakPanel(p, hit, dir.clone().multiplyScalar(p.kind === 'wall' ? 15 : 5), true);
    award(p.kind === 'wall' ? 300 : 200, p.kind === 'wall' ? 'WALL DOWN' : 'ICE BREAK');
    return true;
  }
  return false;
}
// Distance along an aim ray to the nearest intact panel.
export function rayHit(origin, dir) {
  let best = Infinity;
  for (const p of panels) {
    if (p.state !== 0) continue;
    const dn = dir.dot(p.N); if (Math.abs(dn) < 1e-4) continue;
    const t = _v.subVectors(p.O, origin).dot(p.N) / dn; if (t < 0 || t > best) continue;
    const [a, b] = local(p, _w.copy(origin).addScaledVector(dir, t));
    if (Math.abs(a) < p.w / 2 && b > p.b0 && b < p.b1) best = t;
  }
  return best;
}

export function resetIce() {
  prevSide = new Map();
  for (const p of panels) {
    p.pieces.forEach((s) => { if (s.mesh) scene.remove(s.mesh); }); p.pieces.length = 0;
    p.state = 0; p.intact.visible = true; p.veins.visible = true; p.lmat.uniforms.uFront.value = -1; p.lmat.uniforms.uFade.value = 1;
  }
}
