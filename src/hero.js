// The hero. A character modelled and rigged in code: one continuous skinned body whose anatomy is drawn with
// spline-lofted cross-sections (so thighs, calves, waist and chest have real shape and knees and elbows bend
// smoothly), a sculpted head with a painted face, layered hair with a ponytail that swings, boots in bindings,
// a bow, and a scarf that streams behind and grows with flow.
// Depends only on three.js and the shared material, so tools/hero.html can show the character by itself.
import * as THREE from 'three';
import { toon, stylize, RAMP_SOFT } from './build.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const K = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.clone().lerp(b, clamp(t, 0, 1));
const AX = V(1, 0, 0), AY = V(0, 1, 0), AZ = V(0, 0, 1);

// ---- modelling kit ------------------------------------------------------------------------
// sweep(): a surface drawn by moving a cross-section along a line of keys [x, y, z, front, back, side, squareness].
// The keys are joined by a smooth spline, so a handful of them describe a whole limb. The cross-section is an
// ellipse that can be deeper in front than behind and squarer than round. Options:
//   U, W        the plane of the cross-section (front and side directions); default +X and +Z
//   path, up    instead of a fixed plane, let the section turn to follow the line (for curved shapes like hair)
//   seg, n      resolution round the section and along the line
//   from, to    use only part of the keys;  arc [a0, a1]  only part of the way round (an open shell)
//   caps        'round' | 'flat' | 'none' for each end
//   col(u, a, p)  colour of a vertex;  w(u, p, a)  bone weights: an index, or [[index, weight], ...]
//   warp(p, u, a) move a vertex after it is placed;  uv(p, u, a)  texture coordinate
const crom = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
function keyAt(keys, k) {
  const n = keys.length, kk = clamp(k, 0, n - 1), i = Math.min(n - 2, Math.floor(kk)), t = kk - i, out = new Array(7);
  const a = keys[Math.max(0, i - 1)], b = keys[i], c = keys[i + 1], d = keys[Math.min(n - 1, i + 2)];
  for (let j = 0; j < 7; j++) out[j] = crom(a[j], b[j], c[j], d[j], t);
  for (let j = 3; j < 6; j++) out[j] = Math.max(out[j], 4e-4);
  out[6] = Math.max(out[6], 1.2); return out;
}
const _col = new THREE.Color();
const toC = (c) => (c && c.isColor ? c : Array.isArray(c) ? _col.setRGB(c[0], c[1], c[2]) : _col.set(c));
export function sweep(keysIn, o = {}) {
  const keys = keysIn.map((k) => [k[0], k[1], k[2], k[3], k[4] ?? k[3], k[5] ?? k[3], k[6] ?? 2]);
  const seg = o.seg || 20, k0 = o.from ?? 0, k1 = o.to ?? keys.length - 1, n = o.n || Math.max(2, Math.round((k1 - k0) * 5) + 1);
  const arc = o.arc || null, cols = arc ? seg + 1 : seg, a0 = arc ? arc[0] : 0, a1 = arc ? arc[1] : Math.PI * 2;
  const [capA, capB] = arc ? ['none', 'none'] : (o.caps || ['round', 'round']);
  let rows = [];
  for (let i = 0; i < n; i++) { const u = i / (n - 1), kv = keyAt(keys, k0 + (k1 - k0) * u); rows.push({ u, c: V(kv[0], kv[1], kv[2]), rf: kv[3], rb: kv[4], rz: kv[5], sq: kv[6], s: 1 }); }
  const T0 = rows[1].c.clone().sub(rows[0].c).normalize(), T1 = rows[n - 1].c.clone().sub(rows[n - 2].c).normalize();
  let flip = false;
  if (o.path) {
    const U = (o.up || AY).clone();
    rows.forEach((r, i) => {
      const T = rows[Math.min(n - 1, i + 1)].c.clone().sub(rows[Math.max(0, i - 1)].c).normalize();
      U.addScaledVector(T, -U.dot(T)).normalize(); r.U = U.clone(); r.W = T.clone().cross(U);
      if (o.twist) { const g = o.twist(r.u), cg = Math.cos(g), sg = Math.sin(g), u2 = r.U.clone().multiplyScalar(cg).addScaledVector(r.W, sg); r.W.multiplyScalar(cg).addScaledVector(r.U, -sg); r.U = u2; }
    });
  } else {
    const U = o.U || AX, W = o.W || AZ; rows.forEach((r) => { r.U = U; r.W = W; });
    flip = U.clone().cross(W).dot(rows[n - 1].c.clone().sub(rows[0].c)) < 0;
  }
  // Rounded ends: a few shrinking sections that close the shape to a point.
  const cap = (row, T, kind) => {
    if (kind === 'none') return { extra: [], pole: null };
    const L = kind === 'flat' ? 0 : (o.capLen ?? 0.8) * Math.min((row.rf + row.rb) / 2, row.rz), extra = [];
    if (kind === 'round') for (let k = 3; k >= 1; k--) { const ph = k / 4 * Math.PI / 2; extra.push({ ...row, s: Math.sin(ph), c: row.c.clone().addScaledVector(T, L * Math.cos(ph)) }); }
    return { extra, pole: row.c.clone().addScaledVector(T, L) };
  };
  const A = cap(rows[0], T0.clone().negate(), capA), B = cap(rows[n - 1], T1, capB);
  rows = [...A.extra.reverse(), ...rows, ...B.extra];
  const pos = [], col = [], uv = [], si = [], sw = [], idx = [], p = V();
  const put = (u, a) => {
    pos.push(p.x, p.y, p.z); const c = toC(o.col ? o.col(u, a, p) : 0xffffff); col.push(c.r, c.g, c.b);
    const t = o.uv ? o.uv(p, u, a) : [0, 0]; uv.push(t[0], t[1]);
    let w = typeof o.w === 'function' ? o.w(u, p, a) : o.w || 0; if (typeof w === 'number') w = [[w, 1]];
    const tot = w.reduce((s, x) => s + x[1], 0) || 1;
    for (let k = 0; k < 4; k++) { si.push(w[k] ? w[k][0] : 0); sw.push(w[k] ? w[k][1] / tot : 0); }
  };
  for (const r of rows) for (let j = 0; j < cols; j++) {
    const a = a0 + (a1 - a0) * j / seg, ca = Math.cos(a), sa = Math.sin(a), rx = ca >= 0 ? r.rf : r.rb;
    const rad = r.s * Math.pow(Math.pow(Math.abs(ca) / rx, r.sq) + Math.pow(Math.abs(sa) / r.rz, r.sq), -1 / r.sq);
    p.copy(r.c).addScaledVector(r.U, rad * ca).addScaledVector(r.W, rad * sa);
    if (o.warp) o.warp(p, r.u, a);
    put(r.u, a);
  }
  const R = rows.length, tri = (a, b, c) => (flip ? idx.push(a, c, b) : idx.push(a, b, c));
  for (let r = 0; r < R - 1; r++) for (let j = 0; j < seg; j++) {
    const a = r * cols + j, b = r * cols + (arc ? j + 1 : (j + 1) % cols), c = a + cols, d = b + cols;
    tri(a, b, c); tri(b, d, c);
  }
  if (A.pole) { p.copy(A.pole); if (o.warp) o.warp(p, 0, 0); put(0, 0); const s = pos.length / 3 - 1; for (let j = 0; j < seg; j++) tri(s, (j + 1) % cols, j); }
  if (B.pole) { p.copy(B.pole); if (o.warp) o.warp(p, 1, 0); put(1, 0); const e = pos.length / 3 - 1, b0 = (R - 1) * cols; for (let j = 0; j < seg; j++) tri(e, b0 + j, b0 + (j + 1) % cols); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
// Any ready-made geometry, given one colour and one bone so it can be fused into a body.
export function prim(geo, color, matrix = null, bone = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(), n = g.attributes.position.count, c = toC(color), col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; si[i * 4] = bone; sw[i * 4] = 1; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (matrix) g.applyMatrix4(matrix);
  g.setIndex(Array.from({ length: n }, (_, i) => i)); return g;
}
export function fuse(list) {
  const names = ['position', 'normal', 'color', 'uv', 'skinIndex', 'skinWeight'], data = Object.fromEntries(names.map((k) => [k, []])), idx = []; let base = 0;
  for (const g of list) {
    for (const k of names) { const a = g.attributes[k].array; for (let i = 0; i < a.length; i++) data[k].push(a[i]); }
    const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base); base += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  for (const k of names) out.setAttribute(k, k === 'skinIndex' ? new THREE.Uint16BufferAttribute(data[k], 4) : new THREE.Float32BufferAttribute(data[k], k === 'uv' ? 2 : k === 'skinWeight' ? 4 : 3));
  out.setIndex(idx); return out;
}
const at = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), typeof s === 'number' ? V(s, s, s) : V(...s));
const blend = (i, j, t) => (t <= 0 ? i : t >= 1 ? j : [[i, 1 - t], [j, t]]);

// ---- palette ------------------------------------------------------------------------------
// A colour pushed past 1.0 glows. Hair is a touch brighter than white so it stays white in warm light.
const C = {
  skin: K('#ffd9c4'), skinDeep: K('#f0b29e'),
  hair: new THREE.Color(1.1, 1.12, 1.24), hairDeep: new THREE.Color(0.74, 0.72, 1.08),
  tunic: K('#8554f7'), tunicDeep: K('#371d9a'), tunicLight: K('#b99aff'), mantle: K('#5a36c8'), mantleDeep: K('#2a1876'),
  shirt: K('#eee8ff'), shirtDeep: K('#bdb0f0'), leg: K('#211862'), legDeep: K('#120d3c'),
  boot: K('#5b34c4'), bootDeep: K('#2b1876'), toe: K('#8a62f0'), cuff: K('#f1ecff'), dark: K('#1c1346'), darkLift: K('#33247a'), sole: K('#100b30'),
  pink: K('#ff3fa6', 2.3), cyan: K('#4fe4ff', 2.1), cyanSoft: K('#4fe4ff', 1.45), white: K('#ffffff', 1.5), deck: K('#161040'), bow: K('#f3eeff'),
};

const UNDER = mix(C.tunic, C.tunicDeep, 0.6);   // what is worn under the skirt matches it, so it never shows through as a patch

// ---- skeleton -----------------------------------------------------------------------------
// Front is +X, up is +Y, the rear foot is on +Z. s = -1 is the leading (left) side, +1 the trailing side.
const PEL = 0, CHE = 1, HEAD = 2, TH = [3, 6], SH = [4, 7], FT = [5, 8], UA = [9, 12], FA = [10, 13], HN = [11, 14], BONES = 15;
const L_TH = 0.47, L_SH = 0.47, L_UA = 0.3, L_FA = 0.29, HIP_W = 0.1, SHO_W = 0.2, SPINE = 0.48, STANCE = 0.27;

// ---- the body -----------------------------------------------------------------------------
function buildBody() {
  const parts = [];
  for (const i of [0, 1]) {
    const s = i ? 1 : -1, z = s * HIP_W;
    // leg: full thigh, kneecap forward, calf behind
    parts.push(sweep([[0, 1.175, z, 0.08, 0.086, 0.088], [0.005, 1.1, z, 0.092, 0.1, 0.098], [0.005, 0.95, z, 0.084, 0.088, 0.088], [0, 0.8, z, 0.07, 0.072, 0.074], [0.004, 0.69, z, 0.066, 0.058, 0.062],
      [0, 0.6, z, 0.054, 0.064, 0.06], [-0.004, 0.5, z, 0.05, 0.07, 0.061], [0, 0.36, z, 0.046, 0.05, 0.048], [0, 0.26, z, 0.042, 0.042, 0.042]],
    { seg: 16, n: 34, caps: ['round', 'none'], col: (u, a, p) => (p.y > 0.97 ? UNDER : mix(C.leg, C.legDeep, ss(0.95, 0.5, p.y))), w: (u, p) => blend(TH[i], SH[i], ss(0.75, 0.61, p.y)) }));
    // boot: a chunky shaft with a rolled lip, a pale cuff and a ring of light under it
    parts.push(sweep([[0, 0.592, z, 0.056, 0.062, 0.06, 2.2], [0, 0.578, z, 0.078, 0.086, 0.083, 2.3], [0, 0.55, z, 0.084, 0.093, 0.088, 2.3], [0, 0.45, z, 0.08, 0.092, 0.086, 2.3], [0.005, 0.32, z, 0.082, 0.086, 0.086, 2.4], [0.01, 0.22, z, 0.09, 0.086, 0.088, 2.4], [0.01, 0.15, z, 0.09, 0.086, 0.088, 2.4]],
      { seg: 18, n: 34, caps: ['none', 'none'], col: (u, a, p) => (p.y > 0.538 ? C.cuff : p.y > 0.516 ? C.cyanSoft : mix(C.boot, C.bootDeep, ss(0.5, 0.2, p.y))), w: (u, p) => blend(SH[i], FT[i], ss(0.31, 0.19, p.y)) }));
    // foot: heel, instep, toe box; then the sole and a lit welt between sole and upper
    const foot = { U: AY, W: AZ, w: FT[i] };
    parts.push(sweep([[-0.105, 0.15, z, 0.05, 0.06, 0.05, 2.4], [-0.07, 0.16, z, 0.1, 0.075, 0.08, 2.6], [0, 0.165, z, 0.12, 0.08, 0.09, 2.6], [0.08, 0.15, z, 0.085, 0.065, 0.092, 2.8], [0.16, 0.135, z, 0.06, 0.05, 0.088, 2.8], [0.212, 0.125, z, 0.035, 0.04, 0.062, 2.4]],
      { ...foot, seg: 18, n: 22, col: (u, a, p) => mix(C.bootDeep, C.toe, ss(0.06, 0.2, p.x)) }));
    parts.push(sweep([[-0.128, 0.078, z, 0.012, 0.012, 0.055, 3], [-0.08, 0.078, z, 0.012, 0.012, 0.09, 3.5], [0.05, 0.078, z, 0.012, 0.012, 0.1, 3.5], [0.17, 0.078, z, 0.012, 0.012, 0.096, 3.5], [0.232, 0.078, z, 0.012, 0.012, 0.062, 3]], { ...foot, seg: 14, n: 16, col: () => C.sole }));
    parts.push(sweep([[-0.12, 0.097, z, 0.008, 0.008, 0.054, 3], [-0.08, 0.097, z, 0.008, 0.008, 0.086, 3.5], [0.05, 0.097, z, 0.008, 0.008, 0.096, 3.5], [0.17, 0.097, z, 0.008, 0.008, 0.092, 3.5], [0.224, 0.097, z, 0.008, 0.008, 0.06, 3]], { ...foot, seg: 14, n: 16, col: () => C.cyan }));
    // arm: sleeve from a rounded shoulder to the wrist
    const az = s * SHO_W;
    parts.push(sweep([[0, 1.705, az, 0.04, 0.04, 0.04], [0, 1.655, az, 0.06, 0.058, 0.06], [0, 1.55, az, 0.054, 0.054, 0.054], [0, 1.42, az, 0.044, 0.046, 0.045], [0, 1.36, az, 0.042, 0.046, 0.043], [0.004, 1.28, az, 0.046, 0.042, 0.044], [0.002, 1.16, az, 0.038, 0.036, 0.037], [0, 1.07, az, 0.033, 0.031, 0.034]],
      { seg: 14, n: 30, caps: ['round', 'none'], col: (u, a, p) => mix(C.shirt, C.shirtDeep, ss(1.6, 1.2, p.y)), w: (u, p) => blend(UA[i], FA[i], ss(1.42, 1.3, p.y)) }));
    // bracer: a hard dark cuff ringed with light at both ends
    parts.push(sweep([[0, 1.315, az, 0.045, 0.042, 0.044, 2.3], [0.002, 1.3, az, 0.056, 0.051, 0.054, 2.3], [0.002, 1.2, az, 0.051, 0.047, 0.05, 2.3], [0, 1.1, az, 0.046, 0.043, 0.046, 2.3], [0, 1.085, az, 0.036, 0.034, 0.037, 2.3]],
      { seg: 14, n: 26, caps: ['none', 'none'], col: (u, a, p) => (p.y > 1.285 ? C.pink : p.y < 1.112 ? C.cyan : mix(C.darkLift, C.dark, ss(1.28, 1.12, p.y))), w: FA[i] }));
    // glove: a closed fist, with a thumb across the front
    parts.push(sweep([[0, 1.09, az, 0.03, 0.03, 0.034], [0.004, 1.05, az, 0.04, 0.036, 0.05, 2.8], [0.008, 1.0, az, 0.044, 0.036, 0.052, 3], [0.008, 0.966, az, 0.036, 0.03, 0.044, 2.6]], { seg: 12, n: 14, col: (u, a, p) => mix(C.darkLift, C.dark, ss(1.06, 0.98, p.y)), w: HN[i] }));
    parts.push(sweep([[0.03, 1.058, az - s * 0.03, 0.017], [0.056, 1.03, az - s * 0.02, 0.018], [0.058, 0.992, az - s * 0.004, 0.015]], { path: true, up: AX, seg: 8, n: 8, col: () => C.darkLift, w: HN[i] }));
  }
  // hips: what the legs grow out of, under the skirt
  parts.push(sweep([[0, 1.04, 0, 0.05, 0.05, 0.08], [0, 1.11, 0, 0.078, 0.08, 0.15], [0, 1.2, 0, 0.088, 0.09, 0.14], [0, 1.27, 0, 0.086, 0.086, 0.122]], { seg: 18, n: 14, col: () => UNDER, w: PEL }));
  // torso: narrow waist, chest, shoulders, neck. One surface from hip to jaw, so it twists and bends without a seam.
  parts.push(sweep([[0, 1.24, 0, 0.095, 0.1, 0.14, 2.2], [0, 1.31, 0, 0.086, 0.086, 0.124, 2.2], [0.004, 1.41, 0, 0.096, 0.092, 0.144, 2.3], [0.006, 1.53, 0, 0.102, 0.102, 0.172, 2.5], [0.003, 1.61, 0, 0.098, 0.108, 0.19, 2.5],
    [0, 1.665, 0, 0.07, 0.085, 0.13, 2.2], [0, 1.7, 0, 0.046, 0.052, 0.056, 2], [0.004, 1.76, 0, 0.04, 0.043, 0.043, 2], [0.008, 1.83, 0, 0.04, 0.043, 0.043, 2]],
  { from: 0.4, seg: 24, n: 44, caps: ['none', 'none'], col: (u, a, p) => (p.y > 1.7 ? C.skin : mix(C.tunicDeep, C.tunic, ss(1.25, 1.62, p.y)).lerp(C.tunicLight, 0.55 * ss(0.8, 0.98, Math.cos(a)))), w: (u, p) => (p.y > 1.69 ? blend(CHE, HEAD, ss(1.7, 1.82, p.y)) : blend(PEL, CHE, ss(1.27, 1.45, p.y))) }));
  // skirt of the tunic: a short flare that rides on the thighs, cut high at the sides and falling to a point front
  // and back, hem edged in light
  parts.push(sweep([[0, 1.335, 0, 0.088, 0.09, 0.122, 2.2], [0, 1.27, 0, 0.104, 0.108, 0.15, 2.2], [0, 1.16, 0, 0.142, 0.158, 0.202, 2.2], [0, 1.07, 0, 0.166, 0.182, 0.24, 2.2], [0, 1.035, 0, 0.172, 0.19, 0.25, 2.2]],
    { seg: 32, n: 26, caps: ['none', 'none'], warp: (p, u, a) => { const d = u * u * 0.13 * Math.pow(Math.abs(Math.cos(a)), 2.4); p.y -= d; p.x *= 1 + d * 0.5; },
      col: (u) => (u > 0.955 ? C.pink : mix(C.tunic, C.tunicDeep, ss(0, 0.9, u) * 0.85)),
      w: (u, p, a) => { const t = ss(0.05, 0.8, u) * 0.86 * (0.4 + 0.6 * ss(-0.95, -0.25, Math.cos(a))), sd = Math.sin(a), bk = t * clamp(0.5 + sd * 0.95, 0, 1), f = t * clamp(0.5 - sd * 0.95, 0, 1); return [[PEL, 1 - bk - f], [TH[0], f], [TH[1], bk]]; } }));
  // belt and its stone
  parts.push(sweep([[0, 1.345, 0, 0.097, 0.099, 0.134, 2.2], [0, 1.315, 0, 0.1, 0.102, 0.138, 2.2], [0, 1.285, 0, 0.104, 0.108, 0.148, 2.2]], { seg: 24, n: 6, caps: ['none', 'none'], col: () => C.dark, w: PEL }));
  parts.push(prim(new THREE.OctahedronGeometry(0.036, 0), C.cyan, at(0.108, 1.315, 0, 0, 0, 0, [0.6, 1.25, 1]), PEL));
  // mantle: a short cowl over the shoulders, falling to a point down the back and a smaller one on the chest
  parts.push(sweep([[0, 1.765, 0, 0.058, 0.062, 0.064], [0, 1.72, 0, 0.076, 0.086, 0.092], [0, 1.67, 0, 0.11, 0.13, 0.184, 2.2], [0, 1.61, 0, 0.126, 0.148, 0.25, 2.3], [0, 1.55, 0, 0.132, 0.156, 0.274, 2.3]],
    { seg: 28, n: 22, caps: ['none', 'none'],
      warp: (p, u, a) => { const back = Math.max(0, -Math.cos(a)) ** 3, fr = Math.max(0, Math.cos(a)) ** 5, d = u * u * (0.2 * back + 0.08 * fr); p.y -= d; p.x *= 1 - d * 1.5; p.z *= 1 - d * 1.2; },
      col: (u) => (u > 0.94 ? C.pink : mix(C.mantle, C.mantleDeep, u * 0.9)),
      w: (u, p, a) => { const k = u * u * 0.4 * Math.abs(Math.sin(a)) ** 3; return [[CHE, 1 - k], [Math.sin(a) < 0 ? UA[0] : UA[1], k]]; } }));
  parts.push(prim(new THREE.OctahedronGeometry(0.03, 0), C.cyan, at(0.134, 1.5, 0, 0, 0, 0, [0.55, 1.3, 1]), CHE));
  parts.push(sweep([[0.03, 1.69, -0.125, 0.006, 0.006, 0.02], [0.118, 1.56, -0.04, 0.006, 0.006, 0.02], [0.112, 1.42, 0.07, 0.006, 0.006, 0.02], [0.02, 1.36, 0.15, 0.006, 0.006, 0.02], [-0.1, 1.42, 0.1, 0.006, 0.006, 0.02], [-0.13, 1.56, 0.0, 0.006, 0.006, 0.02], [-0.06, 1.69, -0.12, 0.006, 0.006, 0.02]],
    { path: true, up: V(1, 0.4, 0.4), seg: 6, n: 30, caps: ['flat', 'flat'], col: () => C.dark, w: (u, p) => blend(PEL, CHE, ss(1.27, 1.45, p.y)) }));
  // a standing collar that frames the jaw
  parts.push(sweep([[0, 1.725, 0, 0.058, 0.064, 0.066], [0, 1.76, 0, 0.062, 0.07, 0.072], [0.002, 1.8, 0, 0.07, 0.08, 0.084]], { seg: 20, n: 8, caps: ['none', 'none'], col: (u) => (u > 0.88 ? C.pink : C.mantleDeep), w: CHE,
    warp: (p, u, a) => { p.y -= u * 0.045 * Math.max(0, Math.cos(a)) ** 2; } }));
  // quiver slung across the back, banded in light, four arrows showing
  const qm = at(-0.155, 1.5, 0.03, 0.42, 0, 0.1);
  const quiver = sweep([[0, -0.26, 0, 0.04], [0, -0.2, 0, 0.046], [0, 0.2, 0, 0.056], [0, 0.26, 0, 0.058]], { U: AX, W: AZ, seg: 12, n: 12, caps: ['round', 'none'], col: (u, a, p) => (p.y > 0.2 || Math.abs(p.y + 0.12) < 0.02 ? C.pink : mix(C.bootDeep, C.boot, ss(-0.2, 0.2, p.y))), w: CHE });
  quiver.applyMatrix4(qm); parts.push(quiver);
  for (let k = 0; k < 4; k++) {
    const ax = Math.cos(k * 1.7) * 0.022, azz = Math.sin(k * 1.7) * 0.022, h = 0.36 + (k % 2) * 0.05;
    parts.push(prim(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 5), C.shirt, qm.clone().multiply(at(ax, h - 0.08, azz)), CHE));
    for (let v = 0; v < 2; v++) parts.push(prim(new THREE.BoxGeometry(0.004, 0.11, 0.045), k % 2 ? C.pink : C.cyan, qm.clone().multiply(at(ax, h, azz, 0, k * 0.9 + v * 1.5708, 0)), CHE));
  }
  return fuse(parts);
}

// ---- the head -----------------------------------------------------------------------------
// Modelled about its own centre, facing +X. Wide at the eyes, tapering to a small chin; the back of the skull is fuller.
const HEADK = [[0.03, -0.142, 0, 0.028, 0.03, 0.03, 2], [0.022, -0.115, 0, 0.056, 0.05, 0.054, 2.1], [0.012, -0.07, 0, 0.082, 0.078, 0.084, 2.2], [0.004, -0.02, 0, 0.096, 0.098, 0.102, 2.2],
  [0, 0.04, 0, 0.1, 0.108, 0.108, 2.2], [-0.004, 0.1, 0, 0.09, 0.104, 0.1, 2.2], [-0.006, 0.14, 0, 0.062, 0.078, 0.072, 2]];
const nose = (p, u, a) => { const d = a > Math.PI ? a - Math.PI * 2 : a; p.x += 0.016 * Math.exp(-((d / 0.2) ** 2)) * Math.exp(-(((p.y + 0.042) / 0.026) ** 2)); };
const FACE_ARC = 1.42, FACE_Y0 = -0.128, FACE_Y1 = 0.102;
// The face is drawn, not modelled: large violet-to-cyan eyes, white brows and lashes, a small mouth, on a clear ground.
function faceTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
  const yOf = (y) => (1 - (y - FACE_Y0) / (FACE_Y1 - FACE_Y0)) * 512, xOf = (deg) => 256 + deg / (FACE_ARC * 180 / Math.PI) * 256;
  const ey = yOf(0.0);
  for (const sd of [-1, 1]) {
    const x = xOf(sd * 25);
    g.fillStyle = 'rgba(255,120,150,0.3)'; g.beginPath(); g.ellipse(xOf(sd * 37), yOf(-0.04), 34, 15, 0, 0, 6.3); g.fill();                    // blush
    g.fillStyle = '#fbfbff'; g.beginPath(); g.ellipse(x, ey, 33, 44, 0, 0, 6.3); g.fill();
    const ir = g.createLinearGradient(0, ey - 40, 0, ey + 40); ir.addColorStop(0, '#2c1688'); ir.addColorStop(0.5, '#8a4cf0'); ir.addColorStop(1, '#63e9ff');
    g.fillStyle = ir; g.beginPath(); g.ellipse(x - sd * 2, ey + 5, 25, 36, 0, 0, 6.3); g.fill();
    g.fillStyle = '#130a36'; g.beginPath(); g.ellipse(x - sd * 2, ey + 5, 11, 20, 0, 0, 6.3); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 11, ey - 14, 9.5, 0, 6.3); g.fill(); g.beginPath(); g.arc(x + 8, ey + 22, 4.5, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(40,24,90,0.25)'; g.beginPath(); g.ellipse(x, ey - 26, 33, 16, 0, 0, 6.3); g.fill();                                       // lid shadow
    g.strokeStyle = '#22144e'; g.lineCap = 'round'; g.lineWidth = 11; g.beginPath(); g.ellipse(x, ey, 35, 46, 0, Math.PI * 1.07, Math.PI * 1.93); g.stroke();   // upper lash line
    g.lineWidth = 6; g.beginPath(); g.moveTo(x + sd * 33, ey - 16); g.lineTo(x + sd * 46, ey - 28); g.stroke();
    g.strokeStyle = '#f6f2ff'; g.lineWidth = 10; g.beginPath(); g.moveTo(x - sd * 30, yOf(0.062)); g.quadraticCurveTo(x + sd * 6, yOf(0.082), x + sd * 38, yOf(0.064)); g.stroke();   // brow
  }
  g.strokeStyle = '#a04058'; g.lineCap = 'round'; g.lineWidth = 6; g.beginPath(); g.moveTo(240, yOf(-0.088)); g.quadraticCurveTo(256, yOf(-0.098), 274, yOf(-0.086)); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// A lock of hair: a flat blade along a curve, widest a third of the way down, ending in a point.
function lock(pts, w, th, up, tipTone = 0.5) {
  const n = pts.length, keys = pts.map((p, i) => { const t = i / (n - 1), f = Math.max(0.04, (0.72 + 0.3 * Math.sin(Math.PI * t)) * (1 - Math.pow(t, 2.4))); return [p[0], p[1], p[2], th * f, th * f, w * f, 2]; });
  return sweep(keys, { path: true, up: V(...up), seg: 8, n: 4 * n, capLen: 1.4, col: (u) => mix(C.hair, C.hairDeep, ss(0.35, 1, u) * tipTone) });
}
function buildHead() {
  const parts = [], hairK = HEADK.map((k) => [k[0] - 0.004, k[1], k[2], k[3] + 0.014, k[4] + 0.03, k[5] + 0.022, k[6]]);
  parts.push(sweep(HEADK, { seg: 28, n: 32, warp: nose, col: (u, a, p) => mix(C.skinDeep, C.skin, ss(-0.15, -0.04, p.y)) }));
  // pointed ears, swept back
  for (const s of [-1, 1]) parts.push(sweep([[-0.012, -0.012, s * 0.09, 0.012, 0.012, 0.028], [-0.04, 0.01, s * 0.132, 0.011, 0.011, 0.031], [-0.09, 0.046, s * 0.17, 0.008, 0.008, 0.022], [-0.138, 0.082, s * 0.195, 0.003, 0.003, 0.005]],
    { path: true, up: V(0.3, 0.2, s), seg: 8, n: 14, capLen: 1.5, col: (u) => mix(C.skin, C.skinDeep, u * 0.25) }));
  // scalp: a full cap over the crown, and a curtain round the back and sides with a ragged lower edge
  parts.push(sweep(hairK, { from: 4.15, seg: 28, n: 12, caps: ['none', 'round'], col: () => C.hair }));
  parts.push(sweep(hairK, { from: 1.5, to: 4.2, arc: [1.25, Math.PI * 2 - 1.25], seg: 26, n: 16, col: (u) => mix(C.hairDeep, C.hair, ss(0, 0.6, u)),
    warp: (p, u, a) => { const k = (1 - u) ** 2; p.y -= k * 0.035 * Math.abs(Math.sin(a * 4.5)); const o = 1 + k * 0.1; p.x *= o; p.z *= o; } }));
  // fringe: five blades across the forehead, parted off-centre, the longest falling between the eyes
  [[[0.03, 0.152, -0.065], [0.074, 0.13, -0.088], [0.094, 0.068, -0.102], [0.082, -0.005, -0.108]], [[0.045, 0.158, -0.022], [0.1, 0.128, -0.036], [0.121, 0.066, -0.05], [0.112, 0.008, -0.064]],
    [[0.05, 0.16, 0.012], [0.108, 0.126, 0.014], [0.127, 0.054, 0.008], [0.118, -0.03, 0.0]], [[0.045, 0.158, 0.042], [0.098, 0.13, 0.054], [0.116, 0.074, 0.068], [0.104, 0.022, 0.08]],
    [[0.028, 0.152, 0.07], [0.07, 0.128, 0.092], [0.088, 0.064, 0.106], [0.074, -0.012, 0.11]]]
    .forEach((pts, i) => parts.push(lock(pts, 0.036 - Math.abs(i - 2) * 0.002, 0.012, [1, 0.4, (i - 2) * 0.35], 0.35)));
  // side locks, long in front of each ear
  for (const s of [-1, 1]) parts.push(lock([[0.022, 0.11, s * 0.094], [0.05, 0.03, s * 0.116], [0.056, -0.08, s * 0.114], [0.04, -0.2, s * 0.098]], 0.03, 0.012, [0.2, 0, s], 0.6));
  // the mane: two layers of broad locks from the crown down the back of the head, tips flicking out at the neck
  for (let k = -2; k <= 2; k++) {
    const f = k * 0.5, dx = -Math.cos(f), dz = Math.sin(f);
    parts.push(lock([[dx * 0.02, 0.162, dz * 0.02], [dx * 0.105, 0.11, dz * 0.1], [dx * 0.135, -0.01, dz * 0.125], [dx * 0.13, -0.11, dz * 0.12], [dx * 0.19, -0.185, dz * 0.17]], 0.058, 0.02, [dx, 0.3, dz], 0.75));
  }
  for (let k = -1.5; k <= 1.5; k++) {
    const f = k * 0.56, dx = -Math.cos(f), dz = Math.sin(f);
    parts.push(lock([[dx * 0.01, 0.168, dz * 0.01], [dx * 0.1, 0.132, dz * 0.095], [dx * 0.15, 0.05, dz * 0.14], [dx * 0.215, -0.01, dz * 0.2]], 0.05, 0.02, [dx, 0.6, dz], 0.5));
  }
  // one wind-blown strand off the crown
  parts.push(lock([[0, 0.165, 0.01], [-0.03, 0.215, 0.02], [-0.09, 0.235, 0.03], [-0.15, 0.215, 0.036]], 0.02, 0.012, [0, 1, 0], 0.3));
  // the tie the ponytail grows from
  parts.push(prim(new THREE.TorusGeometry(0.03, 0.011, 6, 14), C.pink, at(-0.118, 0.085, 0, 0, Math.PI / 2, 0.5)));
  return fuse(parts);
}
const TAIL_ROOT = V(-0.122, 0.082, 0), HEAD_SCALE = 1.1;

// ---- board, bindings, bow -----------------------------------------------------------------
function deck(scale, thick) {
  const sh = new THREE.Shape(), pts = [], half = (y) => 0.158 - 0.028 * Math.cos(y / 0.56 * Math.PI / 2);
  for (let i = 0; i <= 10; i++) { const y = -0.56 + i * 0.112; pts.push([half(y), y]); }
  for (let i = 1; i < 10; i++) { const a = i / 10 * Math.PI; pts.push([Math.cos(a) * 0.158, 0.56 + Math.sin(a) * 0.25]); }
  for (let i = 10; i >= 0; i--) { const y = -0.56 + i * 0.112; pts.push([-half(y), y]); }
  for (let i = 1; i < 10; i++) { const a = Math.PI + i / 10 * Math.PI; pts.push([Math.cos(a) * 0.158, -0.56 + Math.sin(a) * 0.25]); }
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x * scale, y * (0.6 + scale * 0.4)) : sh.moveTo(x * scale, y * (0.6 + scale * 0.4))));
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = Math.max(0, Math.abs(p.getZ(i)) - 0.5); p.setY(i, p.getY(i) + k * k * 1.5); }
  g.computeVertexNormals(); return g;
}
const FOOT_YAW = [0.26, -0.1];
function buildBoard() {
  const parts = [prim(deck(1.12, 0.01), C.cyan, at(0, 0.012, 0)), prim(deck(1, 0.03), C.deck, at(0, 0.02, 0)), prim(deck(0.62, 0.006), C.tunicDeep, at(0, 0.058, 0)), prim(deck(0.2, 0.006), C.pink, at(0, 0.064, 0))];
  for (const i of [0, 1]) {
    const s = i ? 1 : -1, m = at(0, 0, s * STANCE, 0, FOOT_YAW[i], 0), add = (g) => { g.applyMatrix4(m); parts.push(g); };
    add(sweep([[-0.13, 0.072, 0, 0.012, 0.012, 0.07, 4], [-0.06, 0.072, 0, 0.012, 0.012, 0.106, 4], [0.14, 0.072, 0, 0.012, 0.012, 0.106, 4], [0.19, 0.072, 0, 0.012, 0.012, 0.08, 4]], { U: AY, W: AZ, seg: 12, n: 8, col: () => C.dark }));     // base plate
    add(sweep([[-0.118, 0.085, 0, 0.012, 0.012, 0.08, 3], [-0.128, 0.2, 0, 0.011, 0.011, 0.076, 3], [-0.14, 0.31, 0, 0.01, 0.01, 0.06, 3], [-0.146, 0.36, 0, 0.008, 0.008, 0.036, 3]], { seg: 12, n: 12, col: (u) => mix(C.dark, C.darkLift, u) }));                          // highback
    const strap = (x, top, w, c) => add(sweep([[x, 0.085, -0.102, 0.007, 0.007, w], [x, top * 0.74, -0.09, 0.007, 0.007, w], [x + 0.006, top, 0, 0.007, 0.007, w * 1.25], [x, top * 0.74, 0.09, 0.007, 0.007, w], [x, 0.085, 0.102, 0.007, 0.007, w]],
      { path: true, up: V(0, 0, -1), seg: 8, n: 18, caps: ['flat', 'flat'], col: c }));
    strap(0.02, 0.302, 0.026, (u) => (Math.abs(u - 0.5) < 0.14 ? C.cyan : C.dark)); strap(0.135, 0.208, 0.02, () => C.cyan);
  }
  return fuse(parts);
}
// One limb of the bow: wide and thin, recurved, tapering to the tip. dir = +1 up, -1 down.
function bowLimb(dir) {
  return sweep([[0, 0.04 * dir, 0, 0.011, 0.011, 0.02], [0, 0.2 * dir, -0.034, 0.01, 0.01, 0.026], [0, 0.4 * dir, -0.012, 0.009, 0.009, 0.022], [0, 0.56 * dir, 0.07, 0.008, 0.008, 0.016], [0, 0.66 * dir, 0.16, 0.006, 0.006, 0.01], [0, 0.69 * dir, 0.2, 0.004, 0.004, 0.005]],
    { path: true, up: AZ, seg: 8, n: 26, col: (u) => (u > 0.9 ? C.cyan : u < 0.12 ? C.dark : mix(C.bow, C.shirtDeep, u * 0.5)) });
}
const BOW_TIP = [0.69, 0.2];   // where the string meets a limb, before the limb flexes

// ---- cloth and hair that move -------------------------------------------------------------
// A chain dragged through the air from one fixed end. Each link is carried back by the wind and down by its
// weight, then pulled back to length; ripples run down it so it snaps like cloth.
class Chain {
  constructor(n, seg) { this.n = n; this.seg = seg; this.pts = Array.from({ length: n }, () => V()); this.draw = Array.from({ length: n }, () => V()); }
  reset(p, dir) { this.pts.forEach((q, i) => q.copy(p).addScaledVector(dir, i * this.seg)); }
  step(anchor, vel, dt, lift, t, amp, rate, phase, heading) {
    const sp = Math.hypot(vel.x, vel.z), pts = this.pts;
    pts[0].copy(anchor);
    for (let i = 1; i < this.n; i++) {
      const p = pts[i], q = pts[i - 1];
      p.x -= vel.x * 0.5 * dt; p.z -= vel.z * 0.5 * dt; p.y -= (5 - Math.min(4.4, sp * 0.2) * lift + vel.y * 0.2) * dt;
      _a.subVectors(p, q); const len = _a.length() || 1; p.copy(q).addScaledVector(_a, this.seg / len);
    }
    const ch = Math.cos(heading), sh = Math.sin(heading);
    for (let i = 0; i < this.n; i++) {
      const d = i * this.seg, k = Math.min(d, 1.2) * (amp + sp * amp * 0.05), ph = t * rate - d * phase, o = this.draw[i].copy(pts[i]);
      o.x += ch * Math.sin(ph) * k; o.z += sh * Math.sin(ph) * k; o.y += Math.cos(ph * 0.83) * k * 0.8;
    }
  }
}
const _a = V(), _b = V(), _c = V(), _t = V(), _u = V(), _w = V();
// A ribbon of cloth through a chain: turned to show its face to the camera, lit like cloth, coloured along its length.
class Strip {
  constructor(chain, width, colAt, mat) {
    const n = chain.n; this.chain = chain; this.width = width; this.roll = 0.35;
    this.pos = new Float32Array(n * 6); const col = new Float32Array(n * 6), idx = [];
    for (let i = 0; i < n; i++) { const c = toC(colAt(i / (n - 1))); for (let j = 0; j < 2; j++) col.set([c.r, c.g, c.b], i * 6 + j * 3); if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.castShadow = true;
  }
  update(time) {
    const pts = this.chain.draw, n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i]; _t.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize(); _w.crossVectors(_t, AY);
      if (_w.lengthSq() < 1e-4) _w.set(1, 0, 0); _w.normalize(); _b.crossVectors(_t, _w);
      const t = i / (n - 1), roll = this.roll + 0.5 * Math.sin(time * 2.1 - i * this.chain.seg * 4.5) * t, w = this.width(t) * 0.5, k = i * 6;
      _w.multiplyScalar(Math.cos(roll) * w).addScaledVector(_b, Math.sin(roll) * w);
      this.pos[k] = p.x + _w.x; this.pos[k + 1] = p.y + _w.y; this.pos[k + 2] = p.z + _w.z; this.pos[k + 3] = p.x - _w.x; this.pos[k + 4] = p.y - _w.y; this.pos[k + 5] = p.z - _w.z;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.computeVertexNormals();
  }
}
// A round, tapering tail through a chain (the ponytail).
class Tube {
  constructor(chain, sides, radius, colAt, mat) {
    const n = chain.n; this.chain = chain; this.sides = sides; this.radius = radius;
    this.pos = new Float32Array(n * sides * 3); const col = new Float32Array(n * sides * 3), idx = [];
    for (let i = 0; i < n; i++) { const c = toC(colAt(i / (n - 1))); for (let j = 0; j < sides; j++) { col.set([c.r, c.g, c.b], (i * sides + j) * 3); if (i < n - 1) { const a = i * sides + j, b = i * sides + (j + 1) % sides; idx.push(a, b, a + sides, b, b + sides, a + sides); } } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.castShadow = true;
  }
  update() {
    const pts = this.chain.draw, n = pts.length, S = this.sides; _u.set(0, 1, 0);
    for (let i = 0; i < n; i++) {
      _t.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize(); _u.addScaledVector(_t, -_u.dot(_t)); if (_u.lengthSq() < 1e-6) _u.set(1, 0, 0); _u.normalize(); _w.crossVectors(_t, _u);
      const [ru, rw] = this.radius(i / (n - 1));
      for (let j = 0; j < S; j++) { const a = j / S * Math.PI * 2, cu = Math.cos(a) * ru, cw = Math.sin(a) * rw, k = (i * S + j) * 3; this.pos[k] = pts[i].x + _u.x * cu + _w.x * cw; this.pos[k + 1] = pts[i].y + _u.y * cu + _w.y * cw; this.pos[k + 2] = pts[i].z + _u.z * cu + _w.z * cw; }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.computeVertexNormals();
  }
}

// ---- the hero -----------------------------------------------------------------------------
function ik(a, b, l1, l2, pole, out) {
  _a.subVectors(b, a); const dist = Math.min(_a.length(), l1 + l2 - 0.001); _a.normalize();
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _b.copy(pole).addScaledVector(_a, -pole.dot(_a)).normalize();
  return out.copy(a).addScaledVector(_a, x).addScaledVector(_b, h);
}
const _m = new THREE.Matrix4(), _x = V(), _y = V(), _z = V();
// Point a bone from a to b, with its front turned toward hint. A bone stretches if b is out of reach.
function aim(bone, a, b, hint, rest) {
  _y.subVectors(b, a); const len = _y.length() || 1e-4; _y.multiplyScalar(1 / len);
  _x.copy(hint).addScaledVector(_y, -hint.dot(_y)); if (_x.lengthSq() < 1e-8) _x.set(0, 0, 1).addScaledVector(_y, -_y.z); _x.normalize(); _z.crossVectors(_x, _y);
  bone.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z)); bone.position.copy(a); bone.scale.set(1, len / rest, 1);
}

export function createHero({ arrow = null, rim = 1.7 } = {}) {
  const group = new THREE.Group(), world = new THREE.Group();   // world holds the cloth, which lives in world space
  group.rotation.order = 'YXZ';
  const mat = toon(0, 0, null, { rim, soft: true, side: THREE.DoubleSide });
  const bones = Array.from({ length: BONES }, () => { const b = new THREE.Bone(); group.add(b); return b; });
  const headG = new THREE.Group(), boardG = new THREE.Group(), bow = new THREE.Group(); group.add(headG, boardG, bow);
  const J = { hip: V(), chest: V(), neck: V(), xHip: V(), xChest: V(), hipJ: [V(), V()], knee: [V(), V()], ankle: [V(), V()], pole: [V(), V()], foot: [V(), V()], yaw: [0, 0],
    sho: [V(), V()], elbow: [V(), V()], wrist: [V(), V()], hand: [V(), V()], armHint: [V(), V()] };
  function layout() {
    aim(bones[PEL], J.hip, J.chest, J.xHip, SPINE); aim(bones[CHE], J.chest, J.neck, J.xChest, 0.1);
    bones[HEAD].position.copy(headG.position); bones[HEAD].quaternion.copy(headG.quaternion);
    for (const i of [0, 1]) {
      aim(bones[TH[i]], J.hipJ[i], J.knee[i], J.pole[i], L_TH); aim(bones[SH[i]], J.knee[i], J.ankle[i], J.pole[i], L_SH);
      bones[FT[i]].position.copy(J.foot[i]); bones[FT[i]].rotation.set(0, J.yaw[i], 0);
      aim(bones[UA[i]], J.sho[i], J.elbow[i], J.armHint[i], L_UA); aim(bones[FA[i]], J.elbow[i], J.wrist[i], J.armHint[i], L_FA); aim(bones[HN[i]], J.wrist[i], J.hand[i], J.armHint[i], 0.1);
    }
  }
  // The pose the body was modelled in: standing straight, arms at the sides.
  J.hip.set(0, 1.16, 0); J.chest.set(0, 1.64, 0); J.neck.set(0, 1.74, 0); J.xHip.copy(AX); J.xChest.copy(AX); headG.position.set(0, 1.9, 0);
  for (const i of [0, 1]) {
    const s = i ? 1 : -1;
    J.hipJ[i].set(0, 1.15, s * HIP_W); J.knee[i].set(0, 0.68, s * HIP_W); J.ankle[i].set(0, 0.21, s * HIP_W); J.foot[i].copy(J.ankle[i]); J.pole[i].copy(AX);
    J.sho[i].set(0, 1.66, s * SHO_W); J.elbow[i].set(0, 1.36, s * SHO_W); J.wrist[i].set(0, 1.07, s * SHO_W); J.hand[i].set(0, 0.97, s * SHO_W); J.armHint[i].copy(AX);
  }
  layout(); group.updateMatrixWorld(true);
  const body = new THREE.SkinnedMesh(buildBody(), mat); body.frustumCulled = false; body.castShadow = true; group.add(body); body.bind(new THREE.Skeleton(bones));
  const headM = new THREE.Mesh(buildHead(), mat); headM.castShadow = true; headG.add(headM); headG.scale.setScalar(HEAD_SCALE);
  const face = new THREE.Mesh(sweep(HEADK.map((k) => [k[0], k[1], k[2], k[3] + 0.0018, k[4], k[5] + 0.0018, k[6]]), { from: 0.5, to: 5.4, arc: [-FACE_ARC, FACE_ARC], seg: 24, n: 26, warp: nose,
    uv: (p, u, a) => [(a + FACE_ARC) / (2 * FACE_ARC), (p.y - FACE_Y0) / (FACE_Y1 - FACE_Y0)] }),
  stylize(new THREE.MeshToonMaterial({ map: faceTexture(), gradientMap: RAMP_SOFT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), rim, 'diffuseColor.rgb'));
  headG.add(face);
  const board = new THREE.Mesh(buildBoard(), mat); board.castShadow = true; boardG.add(board);
  // Bow: -Z points at the target. The limbs flex and the string pulls back with the draw.
  const bowUp = new THREE.Group(), bowDown = new THREE.Group(); bow.add(bowUp, bowDown);
  bowUp.add(new THREE.Mesh(bowLimb(1), mat)); bowDown.add(new THREE.Mesh(bowLimb(-1), mat));
  bow.add(new THREE.Mesh(sweep([[0, -0.07, 0, 0.017, 0.017, 0.024], [0, 0, 0.004, 0.02, 0.02, 0.026], [0, 0.07, 0, 0.017, 0.017, 0.024]], { seg: 10, n: 8, col: () => C.dark }), mat));
  const stringGeo = new THREE.BufferGeometry(); stringGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  bow.add(new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(1.4, 2.4, 2.8) })));
  if (arrow) bow.add(arrow);
  bow.scale.setScalar(1.02); bow.traverse((o) => { o.castShadow = true; });
  // Scarf: two tails from the back of the neck, magenta running out to cyan. Ponytail: a white tail from the tie.
  const SC = 26, scarfA = new Chain(SC, 0.085), scarfB = new Chain(SC - 8, 0.075), tail = new Chain(12, 0.046);
  const scarfCol = (t) => (t > 0.965 ? C.cyan : mix(K('#ff2f8e'), K('#7a3cff'), ss(0.1, 0.85, t)).multiplyScalar(1 + t * 0.25));
  const strips = [new Strip(scarfA, (t) => 0.27 * (0.55 + 0.45 * Math.sin(Math.min(1, t * 6) * 1.5708)) * (1 - 0.35 * t * t), scarfCol, mat),
    new Strip(scarfB, (t) => 0.2 * (0.55 + 0.45 * Math.sin(Math.min(1, t * 6) * 1.5708)) * (1 - 0.5 * t * t), (t) => mix(K('#6a34e8'), K('#ff4fa8'), ss(0.2, 1, t)), mat)];
  // the tail is a broad flat lock, like the rest of the hair
  const pony = new Tube(tail, 10, (t) => { const r = 0.014 + 0.07 * Math.sin(Math.min(1, t * 3.4) * 1.5708) * Math.pow(1 - t, 0.85); return [r * 0.34, r]; }, (t) => mix(C.hair, C.hairDeep, ss(0.3, 1, t) * 0.7), mat);
  world.add(strips[0].mesh, strips[1].mesh, pony.mesh);

  const hero = { group, world, bow, bowPos: V(), chest: V(), boardTail: [V(), V()], reset, update };
  const hip = V(), chest = V(), spine = V(), xc = V(), zc = V(), aimL = V(), bowP = V(), nockP = V(), hb = V(), restDir = V(0.25, -0.35, -1).normalize(), upHint = V(), q = new THREE.Quaternion(), p2 = V(), fore = V(), ZERO = V();
  const POLE_ARM = [V(0.2, -1, 0), V(-0.55, -1, 0.25)];
  let scarfLen = 1;
  function reset() {
    group.updateMatrixWorld(true); const p = V().setFromMatrixPosition(group.matrixWorld); p.y += 2.4;
    scarfA.reset(p, AZ); scarfB.reset(p, AZ); tail.reset(p, AZ); scarfLen = 1;
  }
  // S: { t, crouch, edge, grounded, aimBlend, aimDir (world), draw, drawing, grab, title, vel (world), heading, cam (world), flow }
  function update(S, dt) {
    const c = S.crouch, e = S.edge, ab = S.aimBlend, air = S.grounded ? 0 : 1;
    const bob = Math.sin(S.t * 9) * 0.008 * (1 - air), breathe = Math.sin(S.t * 2.1) * 0.006;
    // hips drop and the chest comes forward over the toes as the knees bend; the shoulders open toward the nose of the board
    hip.set(0.02 + c * 0.1, 1.09 - c * 0.5 + bob, 0);
    spine.set(0.1 + c * 0.44 - e * 0.05, 1, -0.07 + ab * 0.03).normalize(); chest.copy(hip).addScaledVector(spine, SPINE);
    const tw = 0.55 + ab * 0.3 - e * 0.14 + air * 0.1;
    J.hip.copy(hip); J.chest.copy(chest); J.neck.copy(chest).addScaledVector(spine, 0.1); J.neck.x -= 0.012 + c * 0.01;
    J.xHip.set(Math.cos(tw * 0.25), 0, -Math.sin(tw * 0.25)); J.xChest.set(Math.cos(tw), 0, -Math.sin(tw));
    _y.subVectors(J.neck, chest).normalize(); xc.copy(J.xChest).addScaledVector(_y, -J.xChest.dot(_y)).normalize(); zc.crossVectors(xc, _y);
    headG.position.copy(chest).addScaledVector(_y, 0.275 + breathe).addScaledVector(xc, 0.012);
    headG.rotation.set(0, Math.PI / 2 + (S.title ? -0.5 : 0.3 - e * 0.2 + ab * 0.22), S.title ? 0 : -0.06 - c * 0.12);
    for (const i of [0, 1]) {
      const s = i ? 1 : -1;
      J.hipJ[i].set(hip.x, hip.y - 0.01, s * HIP_W); J.ankle[i].set(0, 0.21, s * STANCE); J.foot[i].copy(J.ankle[i]); J.yaw[i] = FOOT_YAW[i];
      J.pole[i].set(1, 0.25, s * 0.42 - e * 0.25); ik(J.hipJ[i], J.ankle[i], L_TH, L_SH, J.pole[i], J.knee[i]);
      J.sho[i].copy(chest).addScaledVector(zc, s * SHO_W).addScaledVector(_y, 0.02 + breathe);
    }
    // bow arm: at rest the bow rides low and forward; on the draw it swings up along the aim line
    aimL.copy(S.aimDir).applyQuaternion(q.copy(group.quaternion).invert()).lerp(restDir, 1 - ab).normalize();
    bowP.copy(J.sho[0]).addScaledVector(aimL, lerp(0.44, 0.6, ab)); bowP.x += 0.04; bowP.y -= (1 - ab) * 0.26;
    bow.position.copy(bowP); upHint.set(0.3 * ab, 1, 0.25 * (1 - ab));
    _m.lookAt(ZERO, aimL, upHint); bow.quaternion.setFromRotationMatrix(_m);
    const flex = S.draw * 0.3, pull = 0.2 + S.draw * 0.46;
    bowUp.rotation.x = flex; bowDown.rotation.x = -flex;
    const ty = BOW_TIP[0] * Math.cos(flex) - BOW_TIP[1] * Math.sin(flex), tz = BOW_TIP[0] * Math.sin(flex) + BOW_TIP[1] * Math.cos(flex), sp = stringGeo.attributes.position;
    sp.setXYZ(0, 0, ty, tz); sp.setXYZ(1, 0, 0, S.drawing ? pull : tz); sp.setXYZ(2, 0, -ty, tz); sp.needsUpdate = true;
    if (arrow) { arrow.visible = S.drawing; arrow.position.set(0, 0, pull); }
    nockP.set(0, 0, pull * 1.25).applyQuaternion(bow.quaternion).add(bowP);
    // trailing arm: out behind for balance, down to the board for a grab, to the string on the draw
    hb.set(hip.x + 0.1 - e * 0.22, hip.y + 0.14 + Math.abs(e) * 0.2 + air * 0.34, 0.6).lerp(p2.set(0.2, 0.14, 0.36), S.grab || 0).lerp(nockP, ab);
    const tgt = [bowP, hb];
    for (const i of [0, 1]) {
      ik(J.sho[i], tgt[i], L_UA, L_FA + 0.07, POLE_ARM[i], J.elbow[i]); fore.subVectors(tgt[i], J.elbow[i]).normalize();
      J.wrist[i].copy(J.elbow[i]).addScaledVector(fore, L_FA); J.hand[i].copy(J.wrist[i]).addScaledVector(fore, 0.1); J.armHint[i].copy(POLE_ARM[i]).negate();
    }
    layout();
    group.updateMatrixWorld(true);
    hero.bowPos.copy(bowP).applyMatrix4(group.matrixWorld); hero.chest.copy(chest).applyMatrix4(group.matrixWorld);
    for (const i of [0, 1]) hero.boardTail[i].set((i ? 1 : -1) * 0.13, 0.07, 0.66).applyMatrix4(group.matrixWorld);
    // cloth: the scarf pays out as flow climbs
    scarfLen = lerp(scarfLen, clamp(0.55 + ((S.flow || 1) - 1) * 0.16, 0.55, 1.7), Math.min(1, dt * 2));
    scarfA.seg = 0.085 * scarfLen; scarfB.seg = 0.075 * scarfLen;
    scarfA.step(_c.copy(chest).addScaledVector(xc, -0.085).addScaledVector(_y, 0.1).addScaledVector(zc, 0.03).applyMatrix4(group.matrixWorld), S.vel, dt, 1, S.t, 0.07, 13, 6.5, S.heading);
    scarfB.step(_c.copy(chest).addScaledVector(xc, -0.085).addScaledVector(_y, 0.08).addScaledVector(zc, -0.04).applyMatrix4(group.matrixWorld), S.vel, dt, 1.05, S.t, 0.08, 11, 8, S.heading);
    tail.step(_c.copy(TAIL_ROOT).applyMatrix4(headG.matrixWorld), S.vel, dt, 0.82, S.t, 0.1, 10, 9, S.heading);
    strips[0].update(S.t); strips[1].update(S.t + 1.7); pony.update();
  }
  return hero;
}
