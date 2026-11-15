// Tiny model-building kit: describe a figure as coloured primitives, merge them into one mesh (one draw call).
import * as THREE from 'three';
import { rim, RAMP } from './world.js';

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
export function merge(parts) {
  const pos = [], nor = [], col = [];
  for (const x of parts) {
    const g = x.g.index ? x.g.toNonIndexed() : x.g.clone();
    _m.compose(_p.set(...x.p), _q.setFromEuler(_e.set(...x.r)), _s.set(...x.s)); if (x.pre) _m.premultiply(x.pre);
    g.applyMatrix4(_m);
    _c.set(x.c instanceof THREE.Color ? x.c : new THREE.Color(Array.isArray(x.c) ? 0 : x.c)); if (Array.isArray(x.c)) _c.setRGB(...x.c);
    const P = g.attributes.position, Nn = g.attributes.normal;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(Nn.getX(i), Nn.getY(i), Nn.getZ(i)); col.push(_c.r, _c.g, _c.b); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
// Lit, rim-lit, vertex-coloured material. Any vertex colour above 1.0 is treated as its own light.
export function toon(rimK = 0.7, lift = 0.22, color = null) {
  const m = new THREE.MeshToonMaterial(color ? { color, gradientMap: RAMP } : { vertexColors: true, gradientMap: RAMP });
  rim(m, rimK, 2.2);
  const base = m.onBeforeCompile, src = color ? 'diffuseColor.rgb' : 'vColor.rgb';
  m.onBeforeCompile = (sh) => { base(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `outgoingLight += max(${src} - 1.0, 0.0) * 1.6 + min(${src}, 1.0) * ${lift.toFixed(2)};\n#include <opaque_fragment>`); };
  m.customProgramCacheKey = () => `toon${rimK}${lift}${color ? 'c' : 'v'}`;
  return m;
}

// Ink outline: a slightly swollen, back-facing copy drawn in one dark colour. Gives figures a drawn edge.
export const ink = new THREE.ShaderMaterial({
  side: THREE.BackSide, uniforms: { uT: { value: 0.01 }, uCol: { value: new THREE.Color('#231a58') } },
  vertexShader: `uniform float uT; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
    mv.xyz += normalize(normalMatrix * normal) * uT * (1.0 - mv.z * 0.035) * clamp(1.7 + mv.z / 90.0, 0.0, 1.0); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol, 1.0); }`,
});
export function outline(root) {
  const list = []; root.traverse((o) => { if (o.isMesh && (o.material.isMeshLambertMaterial || o.material.isMeshToonMaterial)) list.push(o); });
  for (const o of list) { const m = new THREE.Mesh(o.geometry, ink); m.frustumCulled = false; o.add(m); }
}

// Loft: a body volume from stacked elliptical rings [y, radiusX, radiusZ, offsetX, offsetZ], capped at both ends.
// colorAt(t, angle) paints it: t runs 0..1 up the rings, angle 0 is +X. Used for limbs, torso, anything organic.
export function loft(rings, colorAt, seg = 16) {
  // Each band between two rings gets its own vertices and one flat colour, so colour blocks have crisp edges.
  // Normals are computed from the shape itself, so the surface still shades smoothly across those edges.
  const pos = [], col = [], nor = [], idx = [], c = new THREE.Color(), n = rings.length, row = seg + 1, v = new THREE.Vector3();
  const ringVerts = (i, tMid) => {
    const [y, rx, rz, ox = 0, oz = 0] = rings[i], lo = rings[Math.max(0, i - 1)], hi = rings[Math.min(n - 1, i + 1)], dy = (hi[0] - lo[0]) || 1, slope = ((hi[1] + hi[2]) - (lo[1] + lo[2])) / 2 / dy;
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * 6.2832; pos.push(ox + Math.cos(a) * rx, y, oz + Math.sin(a) * rz);
      v.set(Math.cos(a) * rz, -slope * Math.max(rx, rz), Math.sin(a) * rx).normalize(); nor.push(v.x, v.y, v.z);
      c.set(colorAt(tMid, (j + 0.5) / seg * 6.2832)); col.push(c.r, c.g, c.b);
    }
  };
  for (let i = 0; i < n - 1; i++) {
    const tMid = (i + 0.5) / (n - 1), base = pos.length / 3; ringVerts(i, tMid); ringVerts(i + 1, tMid);
    for (let j = 0; j < seg; j++) { const a = base + j, b = a + row; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  for (const [i, flip] of [[0, true], [n - 1, false]]) {
    const [y, rx, rz, ox = 0, oz = 0] = rings[i], centre = pos.length / 3; c.set(colorAt(i ? 1 : 0, 0));
    pos.push(ox, y, oz); nor.push(0, flip ? -1 : 1, 0); col.push(c.r, c.g, c.b);
    for (let j = 0; j <= seg; j++) { const a = j / seg * 6.2832; pos.push(ox + Math.cos(a) * rx, y, oz + Math.sin(a) * rz); nor.push(0, flip ? -1 : 1, 0); col.push(c.r, c.g, c.b); }
    for (let j = 0; j < seg; j++) { const a = centre + 1 + j; if (flip) idx.push(centre, a, a + 1); else idx.push(centre, a + 1, a); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}
