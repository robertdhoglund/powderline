// Renderer, sky, light, bloom and lens pass, snow material, trees, rocks and far ridges.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, rng } from './util.js';
import { height, cx, widthAt, slopeAt, trees, D_MIN, D_MAX, FINISH } from './course.js';
import { LEVEL } from './levels.js';
import { part, merge, cyl } from './build.js';

export const TOUCH = matchMedia('(pointer: coarse)').matches;
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 6000);
export const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('game').appendChild(renderer.domElement);

let pixelRatio = Math.min(TOUCH ? 1.25 : 1.5, window.devicePixelRatio || 1);
const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: TOUCH ? 2 : 4 });
target.depthTexture = new THREE.DepthTexture(innerWidth, innerHeight);   // read back by the ink pass
export const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.26, 0.6, 1.0);
composer.addPass(bloom);
// Lens and ink. Ink draws a dark line wherever depth breaks: every silhouette and overlap in the scene gets a drawn edge.
// Then: speed blur toward the edges, a little colour fringing, vignette, grain.
export const lens = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uPx: { value: new THREE.Vector2(1 / innerWidth, 1 / innerHeight) }, uInk: { value: new THREE.Color(0.02, 0.012, 0.06) }, uSpeed: { value: 0 }, uTime: { value: 0 }, uTint: { value: new THREE.Color() } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse, tDepth; uniform vec2 uPx; uniform float uSpeed, uTime; uniform vec3 uTint, uInk; varying vec2 vUv;
    float lin(vec2 uv){ float z = texture2D(tDepth, uv).x; return 1800.0 / (6000.0 - z * 5999.7); }   // depth to metres (near 0.3, far 6000)
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - vec2(0.5, 0.46); float r2 = dot(c, c);
      vec2 dir = c * r2 * uSpeed * 0.06; vec3 col = vec3(0.0);
      for (int i = 0; i < 5; i++) col += texture2D(tDiffuse, vUv - dir * float(i)).rgb;
      col /= 5.0;
      vec2 ca = c * r2 * 0.005;
      col.r = mix(col.r, texture2D(tDiffuse, vUv - ca).r, 0.6); col.b = mix(col.b, texture2D(tDiffuse, vUv + ca).b, 0.6);
      vec2 o = uPx * 1.25; float d0 = lin(vUv);
      float lap = abs(lin(vUv - vec2(o.x, 0.0)) + lin(vUv + vec2(o.x, 0.0)) - 2.0 * d0) + abs(lin(vUv - vec2(0.0, o.y)) + lin(vUv + vec2(0.0, o.y)) - 2.0 * d0);
      float edge = smoothstep(0.02, 0.07, lap / d0) * (1.0 - smoothstep(160.0, 520.0, d0));
      col = mix(col, uInk, edge * 0.9);
      col *= mix(vec3(1.0), uTint, smoothstep(0.08, 0.62, r2));
      col *= 1.0 + (hash(vUv * 900.0 + uTime) - 0.5) * 0.045;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(lens);
lens.uniforms.tDepth.value = composer.renderTarget2.depthTexture;
composer.addPass(new OutputPass());
resize();
export function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight);
  lens.uniforms.uPx.value.set(1 / (innerWidth * pixelRatio), 1 / (innerHeight * pixelRatio)); lens.uniforms.tDepth.value = composer.renderTarget2.depthTexture;
}
window.addEventListener('resize', resize);

// Drop resolution automatically on slow machines so the ride stays smooth.
let slowFrames = 0, frames = 0;
export function watchPerformance(rdt) {
  frames++; if (rdt > 0.024) slowFrames++;
  if (frames >= 90) {
    if (slowFrames > 55 && pixelRatio > 0.6) { pixelRatio = Math.max(0.6, pixelRatio - 0.25); resize(); }
    frames = 0; slowFrames = 0;
  }
}

// ---- palette: the light changes as you descend (dusk, afterglow, night) --------------------
const C = (hex) => new THREE.Color(hex);
const DUSK = { top: C('#1b1450'), mid: C('#7a3a8c'), hor: C('#ff9a72'), sun: C('#fff0cc'), halo: C('#ff7448'), sky: C('#9d8fe8'), gnd: C('#4b3d92'), light: C('#ffb88e'), shade: C('#6a62c8'), stars: 0.2, aurora: 0 };
const GLOW = { top: C('#120c40'), mid: C('#5a2890'), hor: C('#ff5c9f'), sun: C('#ffe2ec'), halo: C('#ff3a8a'), sky: C('#8478ea'), gnd: C('#3b2c86'), light: C('#ff98be'), shade: C('#5a4fc4'), stars: 0.55, aurora: 0.15 };
const NIGHT = { top: C('#030821'), mid: C('#0e3568'), hor: C('#36d9cb'), sun: C('#ecffff'), halo: C('#2fcfdc'), sky: C('#4f86e6'), gnd: C('#1a2760'), light: C('#aef2ff'), shade: C('#2a55b8'), stars: 1.0, aurora: 1 };
const DAWN = { top: C('#27407e'), mid: C('#c96a8a'), hor: C('#ffc46a'), sun: C('#fff6d8'), halo: C('#ff9a3a'), sky: C('#b9a8e8'), gnd: C('#5a4a8e'), light: C('#ffd0a0'), shade: C('#6a6ac8'), stars: 0.1, aurora: 0 };
const MORNING = { top: C('#3565c4'), mid: C('#eea2b6'), hor: C('#ffe2b4'), sun: C('#fff8e4'), halo: C('#ffae6a'), sky: C('#c6d2ff'), gnd: C('#7078c4'), light: C('#ffe0bc'), shade: C('#8088e0'), stars: 0, aurora: 0, gain: 0.86 };
const DAY = { top: C('#0f48c8'), mid: C('#3f8cf0'), hor: C('#a4ceff'), sun: C('#ffffff'), halo: C('#9cc8ff'), sky: C('#cfe0ff'), gnd: C('#6f8cd8'), light: C('#fff2dc'), shade: C('#5f80e8'), stars: 0, aurora: 0, gain: 0.72 };
const LANTERN = { top: C('#070b30'), mid: C('#1d2470'), hor: C('#5a48a8'), sun: C('#eef2ff'), halo: C('#6a78e0'), sky: C('#5a6ad8'), gnd: C('#1c1f5c'), light: C('#c4d0ff'), shade: C('#2c3aa0'), stars: 1.0, aurora: 0, gain: 0.82 };
const NAMED = { DUSK, GLOW, NIGHT, DAWN, MORNING, DAY, LANTERN };
const PAL = LEVEL.pal.map(([p, name]) => [p, NAMED[name]]);
const KEYS = ['top', 'mid', 'hor', 'sun', 'halo', 'sky', 'gnd', 'light', 'shade'];
export const pal = { gain: 1, top: C(0), mid: C(0), hor: C(0), sun: C(0), halo: C(0), sky: C(0), gnd: C(0), light: C(0), shade: C(0), fog: C(0), stars: 0, aurora: 0 };

export const sunDir = new THREE.Vector3(0.24, LEVEL.sunY, -1).normalize();
const sunView = new THREE.Vector3();
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.55);
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.position.copy(sunDir).multiplyScalar(100);
// Real shadows for the rider, goblins and props: a small shadow box that travels with the rider.
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
sun.castShadow = true; sun.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 260 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06;
scene.add(hemi, sun, sun.target);
export function sunFocus(p) { sun.target.position.copy(p); sun.position.copy(p).addScaledVector(sunDir, 110); sun.target.updateMatrixWorld(); }
scene.fog = new THREE.FogExp2(0xffffff, LEVEL.fog || 0.0027);

// Rim light: every lit surface picks up the low sun along its silhouette.
export function rim(material, strength = 0.6, power = 3) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uRimCol = { value: pal.light };
    sh.fragmentShader = 'uniform vec3 uRimCol;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      `float rimF = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), ${power.toFixed(1)}); outgoingLight += uRimCol * rimF * ${(strength * 0.35).toFixed(3)};\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `rim${strength}${power}`;
  return material;
}

// Cel shading: light falls in a few flat steps instead of a smooth gradient, like painted animation.
export const RAMP = (() => { const t = new THREE.DataTexture(new Uint8Array([150, 150, 255, 255]), 4, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export const cel = (params, rimK = 0.6, power = 2.4) => rim(new THREE.MeshToonMaterial({ gradientMap: RAMP, ...params }), rimK, power);

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uTop: { value: pal.top }, uMid: { value: pal.mid }, uHor: { value: pal.hor }, uSun: { value: pal.sun }, uHalo: { value: pal.halo },
    uSunDir: { value: sunDir }, uStars: { value: 0 }, uAurora: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform vec3 uTop, uMid, uHor, uSun, uHalo, uSunDir; uniform float uStars, uAurora, uTime; varying vec3 vDir;
    float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
    void main(){
      vec3 d = normalize(vDir); float h = d.y, az = atan(d.x, -d.z);
      vec3 c = mix(uHor, uMid, smoothstep(-0.02, 0.24, h));
      c = mix(c, uTop, smoothstep(0.16, 0.7, h));
      float ang = acos(clamp(dot(d, uSunDir), -1.0, 1.0));
      float glow = exp(-ang * 4.5) * 0.55 + exp(-ang * 14.0) * 0.6;
      c += uHalo * glow;
      // Aurora: slow curtains high in the night sky.
      float cur = h - 0.34 - 0.07 * sin(az * 2.3 + uTime * 0.07) - 0.04 * sin(az * 5.1 - uTime * 0.11);
      float rays = 0.55 + 0.45 * noise(vec2(az * 26.0 + uTime * 0.25, 1.7));
      float aur = (exp(-cur * cur * 240.0) + 0.6 * smoothstep(0.0, 0.22, cur) * exp(-cur * 7.0)) * rays * step(0.0, cur + 0.08);
      c += mix(vec3(0.15, 1.25, 0.8), vec3(0.75, 0.3, 1.3), smoothstep(0.0, 0.3, cur)) * aur * uAurora * 0.85;
      vec3 g = floor(d * 190.0); float n = hash(g);
      float star = step(0.9965, n) * smoothstep(0.12, 0.5, h) * (0.6 + 0.4 * sin(uTime * 2.0 + n * 90.0));
      c += vec3(1.6, 1.7, 2.0) * star * uStars;
      // Long streaked clouds, lit from underneath by the low sun.
      float cl = fbm(vec2(az * 2.6 + uTime * 0.004, h * 17.0 - 1.3));
      float cover = smoothstep(0.5, 0.74, cl) * smoothstep(0.0, 0.05, h) * smoothstep(0.42, 0.14, h);
      vec3 cloud = mix(uMid * 0.75, uHor * 1.25 + uHalo * 0.5, clamp(glow * 2.2 + (0.2 - h) * 1.2, 0.0, 1.0));
      c = mix(c, cloud, cover * 0.85);
      float band = smoothstep(0.012, 0.0, abs(fract((h - uSunDir.y) * 26.0 + 0.5) - 0.5) - 0.13) * step(h, uSunDir.y - 0.01);
      float disc = smoothstep(0.118, 0.112, ang) * (1.0 - band * 0.85) * (1.0 - cover * 0.7);
      c = mix(c, uSun * 1.9, disc);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 20), skyMat);
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

// Layered far ridges. They ride along with the camera, like a painted backdrop.
const ridges = [];
{
  const r = rng(91);
  for (let layer = 0; layer < 4; layer++) {
    const n = 220, radius = 1300 + layer * 450, pos = [], col = [], idx = [];
    const ph = [r() * 6, r() * 6, r() * 6, r() * 6];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      // Sharp peaks: folded sines make ridgelines instead of rolling hills.
      const fold = (x) => 1 - Math.abs(Math.sin(x));
      const top = (30 + layer * 80) + (70 + layer * 55) * (fold(a * 3.5 + ph[0]) * 0.55 + fold(a * 9 + ph[1]) * 0.3 + fold(a * 23 + ph[2]) * 0.15) + Math.sin(a * 61 + ph[3]) * 7;
      const x = Math.sin(a) * radius, z = Math.cos(a) * radius;
      pos.push(x, top, z, x, top - 170, z, x, -900, z); col.push(1, 1, 1, 1.45, 1.4, 1.35, 1.7, 1.6, 1.5);
      if (i < n) { const k = i * 3; idx.push(k, k + 1, k + 3, k + 1, k + 4, k + 3, k + 1, k + 2, k + 4, k + 2, k + 5, k + 4); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, fog: false, side: THREE.DoubleSide }));
    m.renderOrder = -5 - layer; m.frustumCulled = false; scene.add(m);
    ridges.push(m);
  }
}

const cullers = [], VIEW = 640, CHUNK = 160;
export const chunkOf = (d) => Math.floor((d - D_MIN) / CHUNK);
export function chunked(mesh, c) { mesh.frustumCulled = false; scene.add(mesh); const d0 = D_MIN + c * CHUNK; cullers.push((d) => { mesh.visible = d0 + CHUNK > d - 110 && d0 < d + VIEW; }); }

// ---- long tree shadows, painted once into a map of the course ----------------------------
const SH_W = 256, SH_H = 4096, U_SPAN = 128, D_SPAN = D_MAX - D_MIN;
const shadowTex = (() => {
  const cv = document.createElement('canvas'); cv.width = SH_W; cv.height = SH_H;
  const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, SH_W, SH_H);
  g.globalCompositeOperation = 'lighten';
  const sx = -sunDir.x / Math.hypot(sunDir.x, sunDir.z), sz = -sunDir.z / Math.hypot(sunDir.x, sunDir.z);
  const map = (x, z) => { const d = -z; return [((x - cx(d)) / U_SPAN + 0.5) * SH_W, (d - D_MIN) / D_SPAN * SH_H]; };
  for (const t of trees) {
    const L = 34 * t.s, steps = 7, left = [], right = [];
    for (let i = 0; i <= steps; i++) {
      const k = i / steps, s = k * L, w = (i === 0 ? 0.5 : 2.3 * (1 - k * 0.9)) * t.s, px = t.x + sx * s, pz = t.z + sz * s;
      left.push(map(px - sz * w, pz + sx * w)); right.push(map(px + sz * w, pz - sx * w));
    }
    const grad = g.createLinearGradient(...left[0], ...map(t.x + sx * L, t.z + sz * L));
    grad.addColorStop(0, 'rgba(255,255,255,0.95)'); grad.addColorStop(1, 'rgba(255,255,255,0.25)');
    g.fillStyle = grad; g.beginPath(); g.moveTo(...left[0]);
    for (const p of left) g.lineTo(...p); for (const p of right.reverse()) g.lineTo(...p);
    g.closePath(); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.flipY = false; tex.generateMipmaps = false; tex.minFilter = tex.magFilter = THREE.LinearFilter;
  return tex;
})();

// ---- snow ---------------------------------------------------------------------------------
{
  const r = rng(7), cols = 54, rowStep = 3, rows = Math.ceil((D_MAX - D_MIN) / rowStep), count = (rows + 1) * (cols + 1);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), aU = new Float32Array(count), idx = [];
  let k = 0, v = 0;
  for (let j = 0; j <= rows; j++) {
    const d = D_MIN + j * rowStep;
    for (let i = 0; i <= cols; i++) {
      const tt = (i / cols) * 2 - 1, u = Math.sign(tt) * Math.pow(Math.abs(tt), 1.7) * 125;
      const dj = d + (r() - 0.5) * 1.6, x = cx(dj) + u + (r() - 0.5) * (0.5 + Math.abs(u) * 0.05), z = -dj;
      const a = Math.abs(u) - widthAt(dj), shade = 0.93 + r() * 0.07, bank = clamp(a / 30, 0, 1);
      pos[k] = x; pos[k + 1] = height(x, z); pos[k + 2] = z; aU[v++] = x - cx(dj);
      col[k] = shade * (1 - bank * 0.16); col[k + 1] = shade * (1 - bank * 0.13); col[k + 2] = shade; k += 3;
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + cols + 1;
    if ((i + j) & 1) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b + 1, b, a, a + 1, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
  geo.setIndex(idx); geo.computeVertexNormals();
  // Snow as a material: wind ripples that catch the low light, blue tree shadows, sparkle, a sheen toward the sun.
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uShadow: { value: shadowTex }, uRimCol: { value: pal.light }, uShadeCol: { value: pal.shade }, uSunView: { value: sunView } });
    sh.vertexShader = 'attribute float aU; varying vec3 vWp; varying float vU;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vU = aU;');
    sh.fragmentShader = `uniform sampler2D uShadow; uniform vec3 uRimCol, uShadeCol, uSunView; varying vec3 vWp; varying float vU;
      float sh1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n` + sh.fragmentShader
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 rp = vWp.xz; float near = smoothstep(150.0, 12.0, length(vViewPosition));
        float r1 = sin(rp.x * 1.9 + rp.y * 0.55 + sin(rp.y * 0.33) * 2.2), r2 = sin(rp.x * 0.6 - rp.y * 2.6 + sin(rp.x * 0.45) * 1.7), r3 = sin(rp.x * 6.3 + rp.y * 4.1);
        normal = normalize(normal + mat3(viewMatrix) * vec3(r1 * 0.035 + r3 * 0.012, 0.0, r2 * 0.035 - r3 * 0.01) * near);`)
      .replace('#include <opaque_fragment>', `
        float shd = texture2D(uShadow, vec2(vU / ${U_SPAN.toFixed(1)} + 0.5, (-vWp.z - (${D_MIN.toFixed(1)})) / ${D_SPAN.toFixed(1)})).r * step(abs(vU), ${(U_SPAN / 2).toFixed(1)});
        outgoingLight = mix(outgoingLight, outgoingLight * uShadeCol * 1.15, shd * 0.8);
        vec3 vv = normalize(vViewPosition); float lit = 1.0 - shd;
        outgoingLight += uRimCol * pow(1.0 - saturate(dot(vv, normal)), 4.0) * 0.4 * lit;
        outgoingLight += uRimCol * pow(saturate(dot(normal, normalize(vv + uSunView))), 26.0) * 0.5 * lit;
        vec2 gp = rp * 13.0, cell = floor(gp); float hs = sh1(cell);
        vec2 off = fract(gp) - 0.5 - (vec2(sh1(cell + 5.3), sh1(cell + 9.1)) - 0.5) * 0.6;
        vec3 gn = normalize(normal + (vec3(sh1(cell + 3.1), sh1(cell + 7.7), sh1(cell + 1.3)) - 0.5) * 1.4);
        float glint = step(0.86, hs) * smoothstep(0.16, 0.02, length(off)) * pow(saturate(dot(gn, normalize(vv + uSunView))), 40.0);
        outgoingLight += uRimCol * glint * 7.0 * lit * near;
        #include <opaque_fragment>`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.receiveShadow = true; scene.add(mesh);
  // Only the stretch of mountain near the rider is drawn.
  cullers.push((d) => { const r0 = clamp(Math.floor((d - 110 - D_MIN) / rowStep), 0, rows), r1 = clamp(Math.ceil((d + VIEW - D_MIN) / rowStep), 0, rows); geo.setDrawRange(r0 * cols * 6, (r1 - r0) * cols * 6); });
}

// ---- trees: layered, snow-laden firs --------------------------------------------------------
// Graphic firs: clean stacked cones in one flat colour, each tier wearing a crisp white cap. The ink pass draws their edges.
function firGeometry(tiers, girth, height0) {
  const body = LEVEL.tree ? LEVEL.tree[0] : '#1c1a58', body2 = LEVEL.tree ? LEVEL.tree[1] : '#2a2a7a', parts = [part(cyl(0.2, 0.3, 2.6, 7), '#110e2a', [0, 1.2, 0])];
  let y = 1.8;
  for (let t = 0; t < tiers; t++) {
    const k = t / Math.max(1, tiers - 1), rad = lerp(2.7, 1.1, k) * girth, h = lerp(4.2, 3.0, k) * height0;
    parts.push(part(new THREE.ConeGeometry(rad, h, 11, 1, false), t % 2 ? body2 : body, [0, y + h / 2, 0]));
    parts.push(part(new THREE.ConeGeometry(rad * 0.66, h * 0.6, 11, 1, true), '#f6f3ff', [0, y + h * 0.71, 0], [0, 0, 0], [1.06, 1, 1.06]));
    y += h * 0.5;
  }
  return merge(parts);
}
{
  const mat = cel({ vertexColors: true }, 0.3, 2.5);
  // Trees dissolve when they come between the camera and the rider, so the view is never blocked.
  const baseCompile = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh) => { baseCompile(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
    if (fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) > smoothstep(5.0, 12.0, length(vViewPosition))) discard;`); };
  mat.customProgramCacheKey = () => 'treeFade';
  const kinds = [firGeometry(3, 1.0, 1.0), firGeometry(4, 0.72, 1.15), firGeometry(2, 1.25, 1.05)];
  const groups = new Map(), KINDS = LEVEL.kinds || [0, 1, 2];
  trees.forEach((t, i) => { const key = chunkOf(-t.z) * 3 + KINDS[i % KINDS.length]; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(t); });
  const o = new THREE.Object3D(), c = new THREE.Color();
  for (const [key, list] of groups) {
    const m = new THREE.InstancedMesh(kinds[key % 3], mat, list.length);
    list.forEach((t, i) => {
      o.position.set(t.x, height(t.x, t.z) - 0.5, t.z); o.rotation.set((t.tint - 0.5) * 0.1, t.rot, (t.rot % 1 - 0.5) * 0.08);
      o.scale.set(t.s, t.s * (0.85 + t.tint * 0.4), t.s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.setScalar(0.8 + t.tint * 0.45));
    });
    chunked(m, Math.floor(key / 3));
  }
}

// ---- rocks: dark outcrops with snow on top, thickest on the steep pitches --------------------
{
  const r = rng(303), geo = new THREE.IcosahedronGeometry(1, 2), p = geo.attributes.position, col = [];
  const hsh = (x, y, z) => { const s = Math.sin(x * 12.9 + y * 78.2 + z * 37.7) * 43758.5; return s - Math.floor(s); };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.62 + hsh(x, y, z) * 0.6;
    p.setXYZ(i, x * k * 1.25, y * k * 0.8, z * k);
  }
  const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3(), stone = new THREE.Color('#1b1748'), snow = new THREE.Color('#d8d2ff');
  for (let i = 0; i < p.count; i += 3) {
    A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); Cc.fromBufferAttribute(p, i + 2);
    const ny = B.sub(A).cross(Cc.sub(A)).normalize().y, c = ny > 0.5 ? snow : stone;
    for (let j = 0; j < 3; j++) col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const N = LEVEL.rocks || 560, mat = rim(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.45, 2.5), o = new THREE.Object3D(), lists = new Map();
  for (let i = 0; i < N; i++) {
    let d = 0; for (let tries = 0; tries < 6; tries++) { d = D_MIN + 30 + r() * (D_MAX - D_MIN - 60); if (r() < slopeAt(d) * 0.9) break; }
    const steep = slopeAt(d), a = 3.5 + Math.pow(r(), 1.4) * 40, x = cx(d) + (r() < 0.5 ? -1 : 1) * (widthAt(d) + a), z = -d, s = (1.2 + r() * 2.6) * (1 + steep) * (0.7 + a * 0.02);
    o.position.set(x, height(x, z) - s * 0.15, z); o.rotation.set(r() * 0.5, r() * 6.283, r() * 0.5); o.scale.set(s, s * (0.7 + r() * 0.9), s); o.updateMatrix();
    const c = chunkOf(d); if (!lists.has(c)) lists.set(c, []); lists.get(c).push(o.matrix.clone());
  }
  for (const [c, list] of lists) { const m = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((mx, i) => m.setMatrixAt(i, mx)); chunked(m, c); }
}

// One far landmark per country, painted into the backdrop.
const landmark = new THREE.Group(), lmBody = new THREE.MeshBasicMaterial({ fog: false }), lmSnow = new THREE.MeshBasicMaterial({ fog: false });
{
  const peak = (x, z, rad, h, sides = 7, cap = 0.34) => {
    const b = new THREE.Mesh(new THREE.ConeGeometry(rad, h, sides), lmBody); b.position.set(x, h / 2 - 260, z); b.rotation.y = x;
    const c = new THREE.Mesh(new THREE.ConeGeometry(rad * cap * 1.04, h * cap, sides), lmSnow); c.position.set(x, h - h * cap / 2 - 258, z); c.rotation.y = x; landmark.add(b, c);
  };
  if (LEVEL.landmark === 'volcano') peak(-520, -2100, 760, 760, 18, 0.3);
  if (LEVEL.landmark === 'needles') [[-700, 240, 900], [-520, 170, 1150], [-380, 210, 820], [520, 200, 1000], [690, 260, 780], [300, 150, 700]].forEach(([x, r, h]) => peak(x, -2000 - Math.abs(x) * 0.3, r, h, 5, 0.22));
  if (LEVEL.landmark === 'spines') for (let i = 0; i < 9; i++) peak(-900 + i * 225 + (i % 2) * 60, -2100, 190, 620 + (i * 137) % 300, 6, 0.36);
  if (LEVEL.landmark === 'horns') { peak(-420, -2000, 330, 780, 6, 0.3); peak(-150, -2050, 300, 900, 6, 0.3); peak(480, -2100, 420, 640, 6, 0.3); }
  landmark.traverse((o) => { o.frustumCulled = false; o.renderOrder = -4.5; }); scene.add(landmark);
}
const _c = new THREE.Color(), BLACK = new THREE.Color(0);
export function updateWorld(d, time, speed = 0) {
  for (const f of cullers) f(d);
  const p = clamp(d / FINISH, 0, 1.2);
  let i = 0; while (i < PAL.length - 2 && p > PAL[i + 1][0]) i++;
  const a = PAL[i][1], b = PAL[i + 1][1], t = clamp((p - PAL[i][0]) / (PAL[i + 1][0] - PAL[i][0]), 0, 1);
  for (const k of KEYS) pal[k].copy(a[k]).lerp(b[k], t);
  pal.stars = lerp(a.stars, b.stars, t); pal.aurora = lerp(a.aurora, b.aurora, t); pal.gain = lerp(a.gain || 1, b.gain || 1, t);
  hemi.intensity = 1.55 * pal.gain; sun.intensity = 2.3 * pal.gain;
  pal.fog.copy(pal.hor).lerp(pal.mid, 0.12);
  scene.fog.color.copy(pal.fog);
  hemi.color.copy(pal.sky); hemi.groundColor.copy(pal.gnd); sun.color.copy(pal.light);
  skyMat.uniforms.uStars.value = pal.stars; skyMat.uniforms.uAurora.value = pal.aurora; skyMat.uniforms.uTime.value = time;
  sunView.copy(sunDir).transformDirection(camera.matrixWorldInverse);
  sky.position.copy(camera.position);
  ridges.forEach((m, l) => {
    m.position.set(camera.position.x, camera.position.y - 70, camera.position.z);
    m.material.color.copy(pal.hor).lerp(pal.mid, 0.25 + l * 0.2).lerp(BLACK, 0.05 + l * 0.05);
  });
  landmark.position.set(camera.position.x, camera.position.y, camera.position.z);
  lmBody.color.copy(pal.hor).lerp(pal.mid, 0.5).lerp(BLACK, 0.12); lmSnow.color.copy(lmBody.color).lerp(_c.setScalar(1), 0.28);
  lens.uniforms.uSpeed.value = speed; lens.uniforms.uTime.value = time % 10;
  lens.uniforms.uTint.value.copy(pal.top).lerp(_c.setScalar(1), 0.35);
}
