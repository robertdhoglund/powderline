// Renderer, sky, light, bloom, terrain mesh, trees and far ridges.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, rng } from './util.js';
import { height, cx, widthAt, trees, D_MIN, D_MAX, FINISH } from './course.js';

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 6000);
export const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('game').appendChild(renderer.domElement);

let pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
export const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.65, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
export function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight);
}
resize();
window.addEventListener('resize', resize);

// Drop resolution automatically on slow machines so the ride stays smooth.
let slowFrames = 0, frames = 0;
export function watchPerformance(rdt) {
  frames++; if (rdt > 0.024) slowFrames++;
  if (frames >= 90) {
    if (slowFrames > 55 && pixelRatio > 0.7) { pixelRatio = Math.max(0.7, pixelRatio - 0.25); resize(); }
    frames = 0; slowFrames = 0;
  }
}

// ---- palette: the light changes as you descend (dusk, afterglow, night) --------------------
const C = (hex) => new THREE.Color(hex);
const PAL = [
  { p: 0.00, top: C('#1b1450'), mid: C('#7a3a8c'), hor: C('#ff9a72'), sun: C('#fff0cc'), halo: C('#ff7448'), sky: C('#9d8fe8'), gnd: C('#4b3d92'), light: C('#ffb88e'), stars: 0.2 },
  { p: 0.30, top: C('#1b1450'), mid: C('#7a3a8c'), hor: C('#ff9a72'), sun: C('#fff0cc'), halo: C('#ff7448'), sky: C('#9d8fe8'), gnd: C('#4b3d92'), light: C('#ffb88e'), stars: 0.2 },
  { p: 0.50, top: C('#120c40'), mid: C('#5a2890'), hor: C('#ff5c9f'), sun: C('#ffe2ec'), halo: C('#ff3a8a'), sky: C('#8478ea'), gnd: C('#3b2c86'), light: C('#ff98be'), stars: 0.55 },
  { p: 0.64, top: C('#120c40'), mid: C('#5a2890'), hor: C('#ff5c9f'), sun: C('#ffe2ec'), halo: C('#ff3a8a'), sky: C('#8478ea'), gnd: C('#3b2c86'), light: C('#ff98be'), stars: 0.55 },
  { p: 0.84, top: C('#030821'), mid: C('#0e3568'), hor: C('#36d9cb'), sun: C('#ecffff'), halo: C('#2fcfdc'), sky: C('#4f86e6'), gnd: C('#1a2760'), light: C('#aef2ff'), stars: 1.0 },
  { p: 1.50, top: C('#030821'), mid: C('#0e3568'), hor: C('#36d9cb'), sun: C('#ecffff'), halo: C('#2fcfdc'), sky: C('#4f86e6'), gnd: C('#1a2760'), light: C('#aef2ff'), stars: 1.0 },
];
export const pal = { top: C(0), mid: C(0), hor: C(0), sun: C(0), halo: C(0), sky: C(0), gnd: C(0), light: C(0), fog: C(0), stars: 0 };

export const sunDir = new THREE.Vector3(0.24, 0.12, -1).normalize();
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.55);
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.position.copy(sunDir).multiplyScalar(100);
scene.add(hemi, sun);
scene.fog = new THREE.FogExp2(0xffffff, 0.0027);

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uTop: { value: pal.top }, uMid: { value: pal.mid }, uHor: { value: pal.hor }, uSun: { value: pal.sun }, uHalo: { value: pal.halo },
    uSunDir: { value: sunDir }, uStars: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform vec3 uTop, uMid, uHor, uSun, uHalo, uSunDir; uniform float uStars, uTime; varying vec3 vDir;
    float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 c = mix(uHor, uMid, smoothstep(-0.02, 0.24, h));
      c = mix(c, uTop, smoothstep(0.16, 0.7, h));
      float ang = acos(clamp(dot(d, uSunDir), -1.0, 1.0));
      c += uHalo * (exp(-ang * 4.5) * 0.55 + exp(-ang * 14.0) * 0.6);
      // Thin haze bands slide across the lower half of the sun.
      float band = smoothstep(0.012, 0.0, abs(fract((h - uSunDir.y) * 26.0 + 0.5) - 0.5) - 0.13) * step(h, uSunDir.y - 0.01);
      float disc = smoothstep(0.118, 0.112, ang) * (1.0 - band * 0.85);
      c = mix(c, uSun * 1.9, disc);
      vec3 g = floor(d * 190.0); float n = hash(g);
      float star = step(0.9965, n) * smoothstep(0.12, 0.5, h) * (0.6 + 0.4 * sin(uTime * 2.0 + n * 90.0));
      c += vec3(1.6, 1.7, 2.0) * star * uStars;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 20), skyMat);
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

// Layered far ridges. They ride along with the camera, like a painted backdrop.
const ridges = [];
{
  const r = rng(91);
  for (let layer = 0; layer < 3; layer++) {
    const n = 140, radius = 1500 + layer * 500, pos = [], idx = [];
    const ph = [r() * 6, r() * 6, r() * 6];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const top = (60 + layer * 95) + (38 + layer * 34) * (Math.sin(a * 5 + ph[0]) * 0.5 + Math.sin(a * 13 + ph[1]) * 0.3 + Math.sin(a * 29 + ph[2]) * 0.2) + (r() - 0.5) * 26;
      pos.push(Math.sin(a) * radius, top, Math.cos(a) * radius, Math.sin(a) * radius, -900, Math.cos(a) * radius);
      if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide }));
    m.renderOrder = -5 - layer; m.frustumCulled = false; scene.add(m);
    ridges.push(m);
  }
}

const _c = new THREE.Color();
export function updateWorld(d, time) {
  const p = clamp(d / FINISH, 0, 1.2);
  let i = 0; while (i < PAL.length - 2 && p > PAL[i + 1].p) i++;
  const a = PAL[i], b = PAL[i + 1], t = clamp((p - a.p) / (b.p - a.p), 0, 1);
  for (const k of ['top', 'mid', 'hor', 'sun', 'halo', 'sky', 'gnd', 'light']) pal[k].copy(a[k]).lerp(b[k], t);
  pal.stars = a.stars + (b.stars - a.stars) * t;
  pal.fog.copy(pal.hor).lerp(pal.mid, 0.12);
  scene.fog.color.copy(pal.fog);
  hemi.color.copy(pal.sky); hemi.groundColor.copy(pal.gnd); sun.color.copy(pal.light);
  skyMat.uniforms.uStars.value = pal.stars; skyMat.uniforms.uTime.value = time;
  sky.position.copy(camera.position);
  ridges.forEach((m, l) => {
    m.position.set(camera.position.x, camera.position.y - 60, camera.position.z);
    m.material.color.copy(pal.hor).lerp(pal.mid, 0.3 + l * 0.27).lerp(_c.set(0x000000), 0.06 + l * 0.05);
  });
}

// ---- snow ---------------------------------------------------------------------------------
{
  const r = rng(7), cols = 54, rowStep = 3, rows = Math.ceil((D_MAX - D_MIN) / rowStep);
  const pos = new Float32Array((rows + 1) * (cols + 1) * 3), col = new Float32Array((rows + 1) * (cols + 1) * 3), idx = [];
  let k = 0;
  for (let j = 0; j <= rows; j++) {
    const d = D_MIN + j * rowStep;
    for (let i = 0; i <= cols; i++) {
      const tt = (i / cols) * 2 - 1, u = Math.sign(tt) * Math.pow(Math.abs(tt), 1.7) * 125;
      const dj = d + (r() - 0.5) * 1.6, x = cx(dj) + u + (r() - 0.5) * (0.5 + Math.abs(u) * 0.05), z = -dj;
      const a = Math.abs(u) - widthAt(dj), shade = 0.9 + r() * 0.1, bank = clamp(a / 30, 0, 1);
      pos[k] = x; pos[k + 1] = height(x, z); pos[k + 2] = z;
      col[k] = shade * (1 - bank * 0.2); col[k + 1] = shade * (1 - bank * 0.16); col[k + 2] = shade; k += 3;
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + cols + 1;
    if ((i + j) & 1) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b + 1, b, a, a + 1, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.frustumCulled = false; scene.add(mesh);
}

// ---- trees --------------------------------------------------------------------------------
{
  const tiers = [[2.3, 5.0, 4.2], [1.75, 4.3, 6.9], [1.15, 3.6, 9.2]];
  const dark = new THREE.Color('#15143f'), dust = new THREE.Color('#6f68b8');
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const parts = tiers.map(([rad, h, y]) => {
    const g = new THREE.ConeGeometry(rad, h, 6, 1), p = g.attributes.position, c = [];
    for (let i = 0; i < p.count; i++) { _c.copy(dark).lerp(dust, clamp((p.getY(i) + h / 2) / h, 0, 1) * 0.75); c.push(_c.r, _c.g, _c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); g.translate(0, y, 0);
    return new THREE.InstancedMesh(g, mat, trees.length);
  });
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 5); trunkGeo.translate(0, 1.5, 0);
  parts.push(new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: '#0f0e2c', flatShading: true }), trees.length));
  const o = new THREE.Object3D();
  trees.forEach((t, i) => {
    o.position.set(t.x, height(t.x, t.z) - 0.4, t.z); o.rotation.set((t.tint - 0.5) * 0.08, t.rot, 0); o.scale.setScalar(t.s); o.updateMatrix();
    _c.setScalar(0.75 + t.tint * 0.5);
    parts.forEach((m, pi) => { m.setMatrixAt(i, o.matrix); if (pi < 3) m.setColorAt(i, _c); });
  });
  parts.forEach((m) => { m.frustumCulled = false; scene.add(m); });
}
