// Shared effects: glowing debris, shockwave rings, camera-facing ribbons, hit-stop and shake.
import * as THREE from 'three';
import { G } from './state.js';
import { scene, camera } from './world.js';
import { rand } from './util.js';

export const shake = (amount) => { G.shake = Math.min(1, Math.max(G.shake, amount)); };
export const hitstop = (seconds) => { G.hitstop = Math.max(G.hitstop, seconds); };

// ---- debris: one instanced mesh of tumbling shards ---------------------------------------
const MAX = 700;
const debris = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
debris.frustumCulled = false; debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(debris);
const dp = new Float32Array(MAX * 3), dv = new Float32Array(MAX * 3), dl = new Float32Array(MAX), dm = new Float32Array(MAX), ds = new Float32Array(MAX), dg = new Float32Array(MAX);
const dr = [], dw = [];
for (let i = 0; i < MAX; i++) { dr.push(new THREE.Euler()); dw.push(new THREE.Vector3()); debris.setColorAt(i, new THREE.Color(0)); }
let dn = 0;
const _o = new THREE.Object3D(), _col = new THREE.Color();
// Spawn n shards at pos. color may be brighter than 1 so the bloom picks it up.
export function burst(pos, n, color, { speed = 9, size = 0.2, life = 0.8, up = 3, gravity = 16, dir = null, spread = 1 } = {}) {
  for (let k = 0; k < n; k++) {
    const i = dn++ % MAX, p = i * 3;
    dp[p] = pos.x; dp[p + 1] = pos.y; dp[p + 2] = pos.z;
    const a = rand(6.283), b = Math.acos(rand(-1, 1)), s = speed * rand(0.25, 1);
    dv[p] = Math.sin(b) * Math.cos(a) * s * spread; dv[p + 1] = Math.cos(b) * s * spread + up; dv[p + 2] = Math.sin(b) * Math.sin(a) * s * spread;
    if (dir) { dv[p] += dir.x; dv[p + 1] += dir.y; dv[p + 2] += dir.z; }
    dl[i] = dm[i] = life * rand(0.5, 1); ds[i] = size * rand(0.4, 1); dg[i] = gravity;
    dr[i].set(rand(6), rand(6), rand(6)); dw[i].set(rand(-9, 9), rand(-9, 9), rand(-9, 9));
    debris.setColorAt(i, _col.copy(color).multiplyScalar(rand(0.7, 1.15)));
  }
  debris.instanceColor.needsUpdate = true;
}

// ---- shockwave rings ---------------------------------------------------------------------
const rings = [];
for (let i = 0; i < 8; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.visible = false; m.frustumCulled = false; scene.add(m);
  rings.push({ m, t: 1, life: 1, size: 1 });
}
let rn = 0;
export function ring(pos, color, size = 6, life = 0.4) {
  const r = rings[rn++ % rings.length];
  r.m.position.copy(pos); r.m.material.color.copy(color); r.t = 0; r.life = life; r.size = size; r.m.visible = true;
}

// ---- ribbon: a camera-facing strip through a list of points (scarf, arrow trails) --------
export class Ribbon {
  constructor(n, width, color, additive = false) {
    this.n = n; this.width = width;
    this.pos = new Float32Array(n * 6); this.col = new Float32Array(n * 6);
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.color = new THREE.Color(color);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: additive, depthWrite: !additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }));
    this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  // pts[0] is the head. fade: brightness falls toward the tail. gain scales the whole ribbon.
  update(pts, fade = 0, gain = 1) {
    const n = this.n, a = _a, b = _b, s = _s;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      a.subVectors(q, o); b.subVectors(camera.position, p); s.crossVectors(a, b);
      const len = s.length(); if (len > 1e-6) s.multiplyScalar(1 / len); else s.set(1, 0, 0);
      const t = i / (n - 1), w = this.width * (1 - t * 0.85) * 0.5, k = i * 6, c = gain * (1 - fade * t);
      this.pos[k] = p.x + s.x * w; this.pos[k + 1] = p.y + s.y * w; this.pos[k + 2] = p.z + s.z * w;
      this.pos[k + 3] = p.x - s.x * w; this.pos[k + 4] = p.y - s.y * w; this.pos[k + 5] = p.z - s.z * w;
      for (let j = 0; j < 6; j += 3) { this.col[k + j] = this.color.r * c; this.col[k + j + 1] = this.color.g * c; this.col[k + j + 2] = this.color.b * c; }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _s = new THREE.Vector3();

export function updateFx(dt) {
  for (let i = 0; i < MAX; i++) {
    if (dl[i] <= 0) continue;
    const p = i * 3; dl[i] -= dt;
    if (dl[i] <= 0) { _o.position.set(0, -9999, 0); _o.scale.setScalar(0); _o.updateMatrix(); debris.setMatrixAt(i, _o.matrix); continue; }
    dv[p + 1] -= dg[i] * dt;
    dp[p] += dv[p] * dt; dp[p + 1] += dv[p + 1] * dt; dp[p + 2] += dv[p + 2] * dt;
    const r = dr[i], w = dw[i]; r.x += w.x * dt; r.y += w.y * dt; r.z += w.z * dt;
    _o.position.set(dp[p], dp[p + 1], dp[p + 2]); _o.rotation.copy(r);
    _o.scale.setScalar(ds[i] * Math.min(1, dl[i] / dm[i] * 2.5)); _o.updateMatrix(); debris.setMatrixAt(i, _o.matrix);
  }
  debris.instanceMatrix.needsUpdate = true;
  for (const r of rings) {
    if (!r.m.visible) continue;
    r.t += dt / r.life;
    if (r.t >= 1) { r.m.visible = false; continue; }
    const e = 1 - Math.pow(1 - r.t, 3);
    r.m.scale.setScalar(0.3 + e * r.size); r.m.material.opacity = (1 - r.t) * 0.9; r.m.quaternion.copy(camera.quaternion);
  }
}
export function resetFx() {
  dl.fill(0);
  for (let i = 0; i < MAX; i++) { _o.position.set(0, -9999, 0); _o.scale.setScalar(0); _o.updateMatrix(); debris.setMatrixAt(i, _o.matrix); }
  debris.instanceMatrix.needsUpdate = true;
  rings.forEach((r) => { r.m.visible = false; });
}
resetFx();

// ---- arrow model: tail at the origin, head toward -Z -------------------------------------
const shaftGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.9, 5).rotateX(Math.PI / 2).translate(0, 0, -0.45);
const headGeo = new THREE.ConeGeometry(0.035, 0.14, 5).rotateX(-Math.PI / 2).translate(0, 0, -0.95);
const vaneGeo = new THREE.BoxGeometry(0.008, 0.07, 0.16).translate(0, 0.035, -0.1);
const shaftMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2e0').multiplyScalar(1.1) });
const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46b').multiplyScalar(3) });
const vaneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3d7f').multiplyScalar(2) });
export function arrowMesh() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(shaftGeo, shaftMat), new THREE.Mesh(headGeo, headMat));
  for (let i = 0; i < 3; i++) { const v = new THREE.Mesh(vaneGeo, vaneMat); v.rotation.z = i * 2.094; g.add(v); }
  return g;
}
