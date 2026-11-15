// Tiny model-building kit: describe a figure as coloured primitives, merge them into one mesh (one draw call).
import * as THREE from 'three';
import { rim } from './world.js';

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
export function toon(rimK = 0.7, lift = 0.22) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  rim(m, rimK, 2.2);
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh) => { base(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `outgoingLight += max(vColor.rgb - 1.0, 0.0) * 1.6 + min(vColor.rgb, 1.0) * ${lift.toFixed(2)};\n#include <opaque_fragment>`); };
  m.customProgramCacheKey = () => `toon${rimK}${lift}`;
  return m;
}

// Ink outline: a slightly swollen, back-facing copy drawn in one dark colour. Gives figures a drawn edge.
export const ink = new THREE.ShaderMaterial({
  side: THREE.BackSide, uniforms: { uT: { value: 0.02 }, uCol: { value: new THREE.Color('#120a36') } },
  vertexShader: `uniform float uT; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
    mv.xyz += normalize(normalMatrix * normal) * uT * (1.0 - mv.z * 0.035) * clamp(1.7 + mv.z / 90.0, 0.0, 1.0); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol, 1.0); }`,
});
export function outline(root) {
  const list = []; root.traverse((o) => { if (o.isMesh && o.material.isMeshLambertMaterial) list.push(o); });
  for (const o of list) { const m = new THREE.Mesh(o.geometry, ink); m.frustumCulled = false; o.add(m); }
}
