// Tiny model-building kit: describe a figure as coloured primitives, merge them into one mesh (one draw call).
import * as THREE from 'three';


const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
// part(geometry, colour, position, rotation, scale). A colour brighter than 1 glows.
export const part = (g, c, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => ({ g, c, p, r, s: typeof s === 'number' ? [s, s, s] : s });
export const sph = (r, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h);
export const cyl = (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n);
export const cone = (r, h, n = 7) => new THREE.ConeGeometry(r, h, n);
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// Place a whole list of parts as a group inside another list.
export function place(parts, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  const M = new THREE.Matrix4().compose(_p.set(...p), _q.setFromEuler(_e.set(...r)), _s.setScalar(s));
  return parts.map((x) => ({ ...x, pre: x.pre ? M.clone().multiply(x.pre) : M.clone() }));
}
// merge(parts, flat): flat gives every face its own normal (faceted, low-poly shading). A geometry that already
// carries a 'color' attribute keeps it, multiplied by the part's colour, so shapes can have gradients.
export function merge(parts, flat = false) {
  const pos = [], nor = [], col = [], uv = [];
  for (const x of parts) {
    const g = x.g.index ? x.g.toNonIndexed() : x.g.clone();
    _m.compose(_p.set(...x.p), _q.setFromEuler(_e.set(...x.r)), _s.set(...x.s)); if (x.pre) _m.premultiply(x.pre);
    g.applyMatrix4(_m);
    _c.set(x.c instanceof THREE.Color ? x.c : new THREE.Color(Array.isArray(x.c) ? 0 : x.c)); if (Array.isArray(x.c)) _c.setRGB(...x.c);
    const P = g.attributes.position, Nn = g.attributes.normal, U = g.attributes.uv, K = g.attributes.color;
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(Nn.getX(i), Nn.getY(i), Nn.getZ(i));
      if (K) col.push(_c.r * K.getX(i), _c.g * K.getY(i), _c.b * K.getZ(i)); else col.push(_c.r, _c.g, _c.b);
      if (U) uv.push(U.getX(i), U.getY(i)); else uv.push(0, 0);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (flat) out.computeVertexNormals();
  return out;
}
// ---- the look ------------------------------------------------------------------------------
// One stylised material for everything that is built: three soft-edged tones of light instead of a smooth falloff,
// a rim of sun colour along the silhouette on the lit side and a cool fill on the dark side, and glow for any colour
// above 1.0 (lantern glass, eyes, flames, trim). world.js keeps LOOK in step with the palette every frame.
export const LOOK = { uRim: { value: new THREE.Color(1, 0.75, 0.8) }, uFill: { value: new THREE.Color(0.35, 0.4, 1) }, uSunView: { value: new THREE.Vector3(0, 0.3, -1) } };
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rampTexture(shadow, mid) {
  const n = 128, d = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const x = i / (n - 1), v = shadow + (mid - shadow) * ss(0.485, 0.525, x) + (1 - mid) * ss(0.78, 0.83, x); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.round(v * 255); d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, n, 1); t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
}
export const RAMP = rampTexture(0.34, 0.8), RAMP_SOFT = rampTexture(0.5, 0.86);
// Adds the rim, the fill and the glow to a material. rim scales the edge light; src is where its base colour comes from.
export function stylize(m, rim = 1, src = m.vertexColors ? 'vColor.rgb' : 'diffuseColor.rgb') {
  const before = m.onBeforeCompile, key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  m.onBeforeCompile = (sh, r) => {
    if (before) before(sh, r);
    Object.assign(sh.uniforms, LOOK);
    sh.fragmentShader = 'uniform vec3 uRim, uFill, uSunView;\n' + sh.fragmentShader
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += max(${src} - 1.0, 0.0) * 1.7;`)
      .replace('#include <opaque_fragment>', `{ float fr = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 2.4), toSun = saturate(dot(normal, uSunView) * 0.6 + 0.5);
          outgoingLight += (uRim * toSun * toSun + uFill * (1.0 - toSun) * 0.4) * fr * ${rim.toFixed(2)}; }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `look|${key}|${rim.toFixed(2)}|${src}`;
  return m;
}
// The shared material for built models, coloured by vertices (or by one colour). opts: rim, soft (gentler shadow tone), flatShading, side...
export function toon(_rim = 0, _lift = 0, color = null, { rim = 1, soft = false, flatShading, ...opts } = {}) {   // flat shading comes from the geometry (see merge)
  return stylize(new THREE.MeshToonMaterial({ gradientMap: soft ? RAMP_SOFT : RAMP, ...(color ? { color } : { vertexColors: true }), ...opts }), rim);
}

// Ink outline: a slightly swollen, back-facing copy drawn in one dark colour. Gives figures a drawn edge.
export const ink = new THREE.ShaderMaterial({
  side: THREE.BackSide, uniforms: { uT: { value: 0.01 }, uCol: { value: new THREE.Color('#231a58') } },
  vertexShader: `uniform float uT; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
    mv.xyz += normalize(normalMatrix * normal) * uT * (1.0 - mv.z * 0.035) * clamp(1.7 + mv.z / 90.0, 0.0, 1.0); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol, 1.0); }`,
});
export function outline(root) {
  const list = []; root.traverse((o) => { if (o.isMesh && (o.material.isMeshToonMaterial || o.material.isMeshStandardMaterial)) list.push(o); });
  for (const o of list) { const m = new THREE.Mesh(o.geometry, ink); m.frustumCulled = false; o.add(m); }
}

// Loft: a body volume from stacked elliptical rings [y, radiusX, radiusZ, offsetX, offsetZ], capped at both ends.
// colorAt(t, angle) paints it: t runs 0..1 up the rings, angle 0 is +X. Used for limbs, torso, anything organic.
export function loft(rings, colorAt, seg = 16) {
  // Each band between two rings gets its own vertices and one flat colour, so colour blocks have crisp edges.
  // Normals are computed from the shape itself, so the surface still shades smoothly across those edges.
  const pos = [], col = [], nor = [], uv = [], idx = [], c = new THREE.Color(), n = rings.length, row = seg + 1, v = new THREE.Vector3();
  const ringVerts = (i, tMid) => {
    const [y, rx, rz, ox = 0, oz = 0] = rings[i], lo = rings[Math.max(0, i - 1)], hi = rings[Math.min(n - 1, i + 1)], dy = (hi[0] - lo[0]) || 1, slope = ((hi[1] + hi[2]) - (lo[1] + lo[2])) / 2 / dy;
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * 6.2832; pos.push(ox + Math.cos(a) * rx, y, oz + Math.sin(a) * rz);
      v.set(Math.cos(a) * rz, -slope * Math.max(rx, rz), Math.sin(a) * rx).normalize(); nor.push(v.x, v.y, v.z);
      c.set(colorAt(tMid, (j + 0.5) / seg * 6.2832)); col.push(c.r, c.g, c.b); uv.push(j / seg * 2, y * 2.4);
    }
  };
  for (let i = 0; i < n - 1; i++) {
    const tMid = (i + 0.5) / (n - 1), base = pos.length / 3; ringVerts(i, tMid); ringVerts(i + 1, tMid);
    for (let j = 0; j < seg; j++) { const a = base + j, b = a + row; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  for (const [i, flip] of [[0, true], [n - 1, false]]) {
    const [y, rx, rz, ox = 0, oz = 0] = rings[i], centre = pos.length / 3; c.set(colorAt(i ? 1 : 0, 0));
    pos.push(ox, y, oz); nor.push(0, flip ? -1 : 1, 0); col.push(c.r, c.g, c.b); uv.push(0.5, 0.5);
    for (let j = 0; j <= seg; j++) { const a = j / seg * 6.2832; pos.push(ox + Math.cos(a) * rx, y, oz + Math.sin(a) * rz); nor.push(0, flip ? -1 : 1, 0); col.push(c.r, c.g, c.b); uv.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5); }
    for (let j = 0; j < seg; j++) { const a = centre + 1 + j; if (flip) idx.push(centre, a, a + 1); else idx.push(centre, a + 1, a); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
