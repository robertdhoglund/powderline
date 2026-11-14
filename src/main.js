import * as THREE from 'three';

// POWDERLINE v0.1. The numbers in TUNING are the first place to tweak game feel.
const TUNING = {
  courseLength: 900, baseSpeed: 21, minSpeed: 13, maxSpeed: 34,
  steerAcceleration: 37, sidewaysDrag: 3.3, gravity: 20, jumpImpulse: 8,
  snowSpray: 1, cameraSmoothing: 4.0, bowMaxDraw: 1.25,
};
const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const rand = (a, b) => a + Math.random() * (b - a);
const keys = new Set();
let running = false, paused = false, ended = false, elapsed = 0, last = 0;
let score = 0, combo = 0, comboTimer = 0, impactFlash = 0, shake = 0;
let drawing = false, drawTime = 0;
const mouse = new THREE.Vector2(0, 0);
let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;

// Deterministic positions mean every restart has the same course.
let seed = 177;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const scene = new THREE.Scene();
scene.background = new THREE.Color('#b4d5e6');
scene.fog = new THREE.FogExp2('#b4d5e6', 0.0062);
const camera = new THREE.PerspectiveCamera(67, innerWidth / innerHeight, .12, 520);
const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(1.7, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;
$('game').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xdaf6ff, 0x617487, 2.7));
const sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
sun.position.set(-70, 110, -130);
scene.add(sun);

function centerX(z) { return 4.4 * Math.sin(-z * .014) + 3.0 * Math.sin(-z * .041); }
function snowY(x, z) {
  const side = Math.abs(x - centerX(z));
  return z * .073 + .12 * Math.sin(z * .125 + x * .24)
    + .075 * Math.sin(x * .66 + z * .3)
    + Math.pow(Math.max(0, side - 14), 1.3) * .05;
}

// 3D mountain: actual geometry, not a scrolling flat background.
function makeGround() {
  const across = 104, along = 485, width = 166, depth = 1080;
  const vertices = [], colors = [], indices = [];
  const white = new THREE.Color('#e7f6f5'), blue = new THREE.Color('#a7d5e7');
  const c = new THREE.Color();
  for (let iz = 0; iz <= along; iz++) {
    const z = 65 - depth * iz / along;
    for (let ix = 0; ix <= across; ix++) {
      const x = (ix / across - .5) * width;
      const y = snowY(x, z);
      vertices.push(x, y, z);
      const beside = Math.abs(x - centerX(z));
      const variation = .12 * Math.sin(x * .58 + z * .14) + .05 * Math.sin(x * 1.7 - z * .5);
      c.copy(white).lerp(blue, clamp((beside - 10) / 78 + variation, .04, .54));
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let iz = 0; iz < along; iz++) for (let ix = 0; ix < across; ix++) {
    const a = iz * (across + 1) + ix, b = a + across + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1, side: THREE.DoubleSide})));
  // A few distant silhouettes make the horizon richer without textures.
  const hillMaterial = new THREE.MeshStandardMaterial({color: 0x8fb4c9, roughness: 1, flatShading: true});
  for (let i = 0; i < 22; i++) {
    const r = rnd(); const x = (r - .5) * 620;
    const z = -280 - rnd() * 520;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(35 + rnd() * 45, 60 + rnd() * 65, 4), hillMaterial);
    peak.position.set(x, snowY(x, z) + 9, z - 80);
    peak.rotation.y = rnd() * Math.PI;
    scene.add(peak);
  }
}
makeGround();

// Instancing keeps hundreds of snow-covered trees inexpensive to render.
const treeColliders = [];
function makeTrees() {
  const count = 360;
  const bark = new THREE.InstancedMesh(new THREE.CylinderGeometry(.16, .23, 2.7, 5), new THREE.MeshStandardMaterial({color: '#425362', roughness: 1}), count);
  const fir = new THREE.InstancedMesh(new THREE.ConeGeometry(1.7, 5.7, 5), new THREE.MeshStandardMaterial({color: '#1d5f6e', roughness: 1, flatShading: true}), count);
  const cap = new THREE.InstancedMesh(new THREE.ConeGeometry(1.25, 4.0, 5), new THREE.MeshStandardMaterial({color: '#397d80', roughness: 1, flatShading: true}), count);
  const snowCap = new THREE.InstancedMesh(new THREE.ConeGeometry(.77, 1.1, 5), new THREE.MeshStandardMaterial({color: '#d9f4f2', roughness: 1, flatShading: true}), count);
  const helper = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const z = 53 - rnd() * 1035;
    const side = rnd() < .5 ? -1 : 1;
    const distance = 17 + Math.pow(rnd(), 1.6) * 66;
    const x = centerX(z) + side * distance;
    const y = snowY(x, z);
    const s = .68 + rnd() * 1.22;
    const rot = rnd() * Math.PI * 2;
    helper.rotation.set(0, rot, 0);
    helper.scale.setScalar(s);
    helper.position.set(x, y + 1.25 * s, z); helper.updateMatrix(); bark.setMatrixAt(i, helper.matrix);
    helper.position.y = y + 4.8 * s; helper.updateMatrix(); fir.setMatrixAt(i, helper.matrix);
    helper.position.y = y + 6.2 * s; helper.updateMatrix(); cap.setMatrixAt(i, helper.matrix);
    helper.position.y = y + 8.35 * s; helper.updateMatrix(); snowCap.setMatrixAt(i, helper.matrix);
    if (distance < 19.5) treeColliders.push({x, z, radius: 1.25 * s});
  }
  [bark, fir, cap, snowCap].forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; scene.add(mesh); });
}
makeTrees();

// Simple stylized rider. All geometry is local to the board.
const rider = new THREE.Group();
const boardGroup = new THREE.Group();
rider.add(boardGroup); scene.add(rider);
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: .62, flatShading: true, ...extra});
const coatMat = mat('#f18e56'), pantsMat = mat('#263b51'), darkMat = mat('#182a39'), cyanMat = mat('#9be8e7');
function riderPart(geo, material, x, y, z, parent = boardGroup) {
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m;
}
riderPart(new THREE.BoxGeometry(.48, .16, 3.25), mat('#ed5a46'), 0, .18, 0);
riderPart(new THREE.BoxGeometry(.44, .08, 2.85), cyanMat, 0, .27, -.07);
for (const zz of [-.52, .57]) {
  const boot = riderPart(new THREE.BoxGeometry(.72, .34, .57), darkMat, 0, .45, zz);
  boot.rotation.y = zz < 0 ? -.25 : .25;
}
const body = new THREE.Group(); body.position.set(0, .6, 0); boardGroup.add(body);
riderPart(new THREE.CylinderGeometry(.45, .52, 1.13, 7), coatMat, 0, 1.05, 0, body);
riderPart(new THREE.SphereGeometry(.37, 8, 6), darkMat, 0, 1.93, -.10, body);
riderPart(new THREE.BoxGeometry(.56, .15, .30), cyanMat, 0, 1.93, -.36, body);
for (const side of [-1, 1]) {
  const arm = riderPart(new THREE.CylinderGeometry(.13, .15, .85, 6), coatMat, side * .58, 1.16, -.27, body);
  arm.rotation.z = -side * .43;
}
const bow = new THREE.Group(); bow.position.set(.95, 1.1, -.55); body.add(bow);
const bowCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, -.67, -.12), new THREE.Vector3(.2, -.36, .0),
  new THREE.Vector3(.24, 0, .10), new THREE.Vector3(.2, .36, .0), new THREE.Vector3(0, .67, -.12),
]);
bow.add(new THREE.Mesh(new THREE.TubeGeometry(bowCurve, 18, .038, 5, false), mat('#334c5d')));
const bowstring = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -.67, -.12), new THREE.Vector3(-.06, 0, .06), new THREE.Vector3(0, .67, -.12)]);
bow.add(new THREE.Line(bowstring, new THREE.LineBasicMaterial({color: '#e8f3f2'})));

const player = {x: centerX(0), z: 0, speed: TUNING.baseSpeed, vx: 0, jump: 0, vy: 0, grounded: true, steer: 0, lastCollision: -100};
function updateRider(dt) {
  const turn = (keys.has('a') || keys.has('arrowleft') ? -1 : 0) + (keys.has('d') || keys.has('arrowright') ? 1 : 0);
  const gas = keys.has('w') || keys.has('arrowup');
  const brake = keys.has('s') || keys.has('arrowdown');
  player.steer = turn;
  let desiredSpeed = gas ? TUNING.maxSpeed : brake ? TUNING.minSpeed : TUNING.baseSpeed + 3;
  if (!player.grounded) desiredSpeed *= 1.03;
  player.speed += (desiredSpeed - player.speed) * Math.min(1, dt * (brake ? 2.0 : .8));
  player.vx += turn * TUNING.steerAcceleration * dt;
  player.vx *= Math.exp(-TUNING.sidewaysDrag * dt);
  player.x += player.vx * dt;
  player.z -= player.speed * dt;
  // Leave the player freedom to explore the slope without losing the course entirely.
  player.x = clamp(player.x, centerX(player.z) - 42, centerX(player.z) + 42);
  if (!player.grounded) {
    player.vy -= TUNING.gravity * dt;
    player.jump += player.vy * dt;
    if (player.jump <= 0) {
      const wasFall = player.vy < -5;
      player.jump = 0; player.vy = 0; player.grounded = true;
      if (wasFall) { emitSnow(65, 2.0); sound('land'); shake = Math.max(shake, .12); }
    }
  }
  rider.position.set(player.x, snowY(player.x, player.z) + .13 + player.jump, player.z);
  boardGroup.rotation.z = lerp(boardGroup.rotation.z, -turn * .13 - player.vx * .014, Math.min(1, dt * 6));
  boardGroup.rotation.y = lerp(boardGroup.rotation.y, -player.vx * .045, Math.min(1, dt * 5));
  body.rotation.x = lerp(body.rotation.x, -.12 - Math.abs(player.vx) * .008, Math.min(1, dt * 4));
  bow.rotation.x = drawing ? -.08 - Math.min(1, drawTime) * .07 : 0;
  if (player.grounded) {
    const spray = 1 + Math.abs(player.vx) * .4 + Math.abs(turn) * 1.7;
    emitSnow(Math.floor((14 + 20 * spray) * dt * 5 * TUNING.snowSpray), spray);
    carveTrail();
  }
  for (const t of treeColliders) {
    if (Math.abs(t.z - player.z) < 1.2 && Math.abs(t.x - player.x) < t.radius + .3 && elapsed - player.lastCollision > 1) {
      player.lastCollision = elapsed; player.speed *= .53; combo = 0; shake = .45; impactFlash = .19; sound('thud'); break;
    }
  }
}

// Deep tracks: a pair of persistent, narrow, blue-tinted ribbons carved into the terrain.
const ruts = [];
function makeRuts() {
  for (let side of [-1, 1]) {
    const maxSegments = 3700;
    const data = new Float32Array(maxSegments * 18);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color: 0x7cbdca, transparent: true, opacity: .49, depthWrite: false, side: THREE.DoubleSide}));
    mesh.frustumCulled = false; scene.add(mesh);
    ruts.push({side, data, geo, mesh, count: 0, prev: null});
  }
}
makeRuts();
function carveTrail() {
  for (const rut of ruts) {
    const lateral = rut.side * .32;
    const current = {x: player.x + lateral, z: player.z};
    if (!rut.prev) { rut.prev = current; continue; }
    if (rut.count >= 3700 || Math.abs(current.z - rut.prev.z) < .25) continue;
    const p = rut.prev; const q = current;
    const w = .15 + Math.abs(player.vx) * .009;
    const corners = [
      [p.x - w, p.z], [p.x + w, p.z], [q.x - w, q.z],
      [p.x + w, p.z], [q.x + w, q.z], [q.x - w, q.z],
    ];
    let index = rut.count * 18;
    for (const [x, z] of corners) {
      rut.data[index++] = x;
      rut.data[index++] = snowY(x, z) + .072;
      rut.data[index++] = z;
    }
    rut.count++;
    rut.geo.setDrawRange(0, rut.count * 6);
    rut.geo.attributes.position.needsUpdate = true;
    rut.prev = current;
  }
}

// Spray particles: variable lifetime, tiny fluffy dots, wind-blown strands of snow.
const PARTICLE_COUNT = 1150;
const particlePos = new Float32Array(PARTICLE_COUNT * 3);
const particleLife = new Float32Array(PARTICLE_COUNT);
const particleSize = new Float32Array(PARTICLE_COUNT);
const particleVisible = new Float32Array(PARTICLE_COUNT);
const particleV = new Float32Array(PARTICLE_COUNT * 3);
const particleMax = new Float32Array(PARTICLE_COUNT);
let nextParticle = 0;
for (let i = 0; i < PARTICLE_COUNT; i++) { particlePos[i * 3 + 1] = -9999; particleSize[i] = rand(.65, 1.65); }
const particlesGeo = new THREE.BufferGeometry();
particlesGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3).setUsage(THREE.DynamicDrawUsage));
particlesGeo.setAttribute('aLife', new THREE.BufferAttribute(particleVisible, 1).setUsage(THREE.DynamicDrawUsage));
particlesGeo.setAttribute('aSize', new THREE.BufferAttribute(particleSize, 1));
const particlesMaterial = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  vertexShader: `attribute float aLife; attribute float aSize; varying float vLife;
    void main(){vLife=aLife;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*100.0/max(1.0,-mv.z),1.0,17.0);}`,
  fragmentShader: `varying float vLife; void main(){float r=length(gl_PointCoord-vec2(.5));float a=(1.0-smoothstep(.10,.50,r))*vLife;gl_FragColor=vec4(.92,.99,1.0,a);}`,
});
const particleMesh = new THREE.Points(particlesGeo, particlesMaterial);
particleMesh.frustumCulled = false; scene.add(particleMesh);
function emitSnow(n, strength = 1) {
  for (let k = 0; k < Math.min(130, n); k++) {
    const i = nextParticle++ % PARTICLE_COUNT, p = i * 3;
    const side = Math.random() > .5 ? 1 : -1;
    particlePos[p] = player.x + side * rand(.22, .8);
    particlePos[p + 1] = snowY(player.x, player.z) + rand(.07, .27) + player.jump;
    particlePos[p + 2] = player.z + rand(.35, 1.5);
    particleV[p] = side * rand(1.1, 5.3) * strength - player.vx * .4;
    particleV[p + 1] = rand(1.6, 5.4) * Math.sqrt(strength);
    particleV[p + 2] = rand(3, 8) + player.speed * .17;
    particleLife[i] = particleMax[i] = rand(.38, .85);
    particleVisible[i] = rand(.45, .95);
  }
}
function updateSnow(dt) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    if (particleLife[i] <= 0) continue;
    const p = i * 3;
    particleLife[i] -= dt;
    if (particleLife[i] <= 0) { particlePos[p + 1] = -9999; particleVisible[i] = 0; continue; }
    particlePos[p] += particleV[p] * dt;
    particlePos[p + 1] += particleV[p + 1] * dt;
    particlePos[p + 2] += particleV[p + 2] * dt;
    particleV[p + 1] -= 10 * dt;
    particleV[p] *= Math.exp(-dt * 1.4);
    particleVisible[i] = Math.pow(particleLife[i] / particleMax[i], .8) * .83;
  }
  particlesGeo.attributes.position.needsUpdate = true;
  particlesGeo.attributes.aLife.needsUpdate = true;
}
// Fine white streamers enhance the stringy snow feeling without expensive fluid physics.
const streamers = [];
const trailHistory = [];
for (let i = 0; i < 4; i++) {
  const pos = new Float32Array(21 * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setDrawRange(0, 0);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({color: i % 2 ? 0xffffff : 0x9edce7, transparent: true, opacity: i < 2 ? .5 : .33, depthWrite: false}));
  l.frustumCulled = false; scene.add(l);
  streamers.push({g, pos});
}
function updateStreamers() {
  if (!player.grounded) return;
  trailHistory.unshift({x: player.x, y: snowY(player.x, player.z), z: player.z});
  if (trailHistory.length > 21) trailHistory.pop();
  for (let j = 0; j < 4; j++) {
    const streamer = streamers[j];
    const sign = j % 2 ? 1 : -1;
    for (let i = 0; i < trailHistory.length; i++) {
      const p = trailHistory[i], fade = i / 21;
      const k = 3 * i;
      streamer.pos[k] = p.x + sign * (.32 + fade * (j < 2 ? 1.2 : 2.0)) + Math.sin(i * .9 + elapsed * 3 + j) * fade * .14;
      streamer.pos[k + 1] = p.y + .18 + Math.sin(fade * Math.PI) * (j < 2 ? .30 : .50);
      streamer.pos[k + 2] = p.z + fade * (j < 2 ? 1.4 : 2.3);
    }
    streamer.g.setDrawRange(0, trailHistory.length);
    streamer.g.attributes.position.needsUpdate = true;
  }
}

// Ice panels: thin, reflective-looking glassy surfaces which explode into actual 3D shards.
const icePatches = [], shards = [];
const iceMat = new THREE.MeshStandardMaterial({color: 0x75e4f0, roughness: .14, metalness: .16, transparent: true, opacity: .82, side: THREE.DoubleSide});
const shardMaterials = [mat('#65c8d8', {metalness:.16, roughness:.18, side: THREE.DoubleSide}), mat('#c5fcff', {metalness:.08, roughness:.22, side: THREE.DoubleSide}), mat('#468eac', {metalness:.23, roughness:.24, side: THREE.DoubleSide})];
function makeIce() {
  for (let i = 0; i < 16; i++) {
    const z = -59 - i * 53 - rnd() * 13;
    const x = centerX(z) + (rnd() - .5) * 13;
    const width = 8 + rnd() * 8, length = 7 + rnd() * 5;
    const group = new THREE.Group(); group.position.set(x, snowY(x, z) + .10, z);
    group.rotation.x = -Math.atan(.073);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(width, .105, length), iceMat);
    group.add(panel);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(panel.geometry), new THREE.LineBasicMaterial({color:0xbafffa, transparent:true, opacity:.75}));
    group.add(edge);
    const cracks = [];
    for (let k = 0; k < 12; k++) {
      const ax = (rnd() - .5) * width * .85, az = (rnd() - .5) * length * .85;
      cracks.push(ax,.072,az, ax + (rnd()-.5)*3,.072,az+(rnd()-.5)*3);
    }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cracks, 3));
    group.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({color:0xe4ffff, transparent:true,opacity:.60,depthWrite:false})));
    scene.add(group);
    icePatches.push({x, z, width, length, group, broken: false});
  }
}
makeIce();
function breakIce(patch, fromArrow = false) {
  if (patch.broken) return;
  patch.broken = true; scene.remove(patch.group);
  const count = 26;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2, b = (i + 1) / count * Math.PI * 2;
    const rx = patch.width * .47, rz = patch.length * .47;
    const offsetX = rand(-.4, .4), offsetZ = rand(-.4, .4);
    const vertices = [offsetX,0,offsetZ,
      Math.cos(a)*rx,0,Math.sin(a)*rz,
      Math.cos(b)*rx,0,Math.sin(b)*rz];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3)); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, shardMaterials[i % shardMaterials.length]);
    mesh.position.set(patch.x, snowY(patch.x, patch.z)+.14, patch.z);
    mesh.rotation.x = -Math.atan(.073);
    scene.add(mesh);
    const direction = (a + b) * .5;
    shards.push({mesh, velocity:new THREE.Vector3(Math.cos(direction)*rand(2,8),rand(4,10),Math.sin(direction)*rand(2,8)), spin:new THREE.Vector3(rand(-5,5),rand(-5,5),rand(-5,5)),life:1.65, max:1.65});
  }
  gain(fromArrow ? 140 : 100, 'ICE SHATTER');
  emitSnow(90, 3.2); shake = Math.max(shake, .25); impactFlash = .11; sound('ice');
}
function updateIce(dt) {
  for (const ice of icePatches) {
    if (!ice.broken && player.grounded && Math.abs(player.z - ice.z) < ice.length*.48 && Math.abs(player.x - ice.x) < ice.width*.49) breakIce(ice);
  }
  for (let i=shards.length-1;i>=0;i--) {
    const s=shards[i]; s.life -= dt;
    s.mesh.position.addScaledVector(s.velocity,dt);
    s.velocity.y -= 20*dt;
    s.mesh.rotation.x += s.spin.x*dt; s.mesh.rotation.y += s.spin.y*dt; s.mesh.rotation.z += s.spin.z*dt;
    if(s.life<=0){scene.remove(s.mesh);s.mesh.geometry.dispose();shards.splice(i,1);}
  }
}

// Floating enemies deliberately contrast with the snowy landscape.
const enemies=[];
function makeEnemies(){
  const red=mat('#f16f4c',{metalness:.12,roughness:.3});
  const core= new THREE.MeshBasicMaterial({color:'#ffe6a2'});
  for(let i=0;i<21;i++){
    const z=-44-i*40-rnd()*10;
    const x=centerX(z)+(rnd()-.5)*20;
    const group=new THREE.Group();
    const body=new THREE.Mesh(new THREE.OctahedronGeometry(.92,0),red);group.add(body);
    const eye=new THREE.Mesh(new THREE.OctahedronGeometry(.36,0),core);eye.position.z=.63;group.add(eye);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(1.35,.07,5,20),new THREE.MeshBasicMaterial({color:0xfdb67a}));halo.rotation.x=.3;group.add(halo);
    group.position.set(x,snowY(x,z)+3.3,z);scene.add(group);
    enemies.push({group,x,z,phase:rnd()*6.28,alive:true, radius:1.3});
  }
}
makeEnemies();
function updateEnemies(dt){
  for(const e of enemies){if(!e.alive)continue;
    const oscillation=Math.sin(elapsed*1.5+e.phase)*1.8;
    e.group.position.x=e.x+oscillation;
    e.group.position.y=snowY(e.group.position.x,e.z)+3.3+Math.sin(elapsed*2+e.phase)*.45;
    e.group.rotation.y+=dt*.75;
  }
}

// Aim using a screen-space camera ray. Raycast enemies for cursor-accurate shots.
const raycaster=new THREE.Raycaster();
const arrows=[];
function aimPoint(){
  const drift = Math.max(0, drawTime-.78) * .028;
  const ndc=new THREE.Vector2(mouse.x+Math.sin(elapsed*13.8)*drift,mouse.y+Math.cos(elapsed*10.7)*drift);
  raycaster.setFromCamera(ndc,camera);
  const live=enemies.filter(e=>e.alive).map(e=>e.group);
  const hits=raycaster.intersectObjects(live,true);
  if(hits.length && hits[0].distance<175) return hits[0].point;
  const z=player.z-57;
  const t=(z-raycaster.ray.origin.z)/Math.min(-.08,raycaster.ray.direction.z);
  return raycaster.ray.at(Math.max(10,t),new THREE.Vector3());
}
const shaftMat=mat('#263c49'), tipMat=mat('#edfaf1',{metalness:.3,roughness:.25});
function fireArrow(){
  if(!running||paused||ended)return;
  const charge=clamp(drawTime/TUNING.bowMaxDraw,.08,1);
  const origin=new THREE.Vector3(player.x+.8, snowY(player.x,player.z)+player.jump+2.15, player.z-1.0);
  const target=aimPoint();
  const dir=target.sub(origin).normalize();
  const mesh=new THREE.Group();
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,1.4,5),shaftMat);shaft.rotation.x=Math.PI/2;mesh.add(shaft);
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.11,.34,5),tipMat);tip.rotation.x=-Math.PI/2;tip.position.z=-.84;mesh.add(tip);
  for(const side of [-1,1]){
    const feather=new THREE.Mesh(new THREE.BoxGeometry(.20,.025,.38),mat('#f6aa6d'));feather.position.set(side*.07,0,.55);mesh.add(feather);
  }
  mesh.position.copy(origin);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),dir);
  scene.add(mesh);
  const velocity=dir.multiplyScalar(40+50*charge);
  arrows.push({mesh,velocity,age:0,prev:origin.clone()});
  sound('bow');
}
function segmentDistanceSq(a,b,p){
  const ab=b.clone().sub(a), ap=p.clone().sub(a);
  const d=clamp(ap.dot(ab)/Math.max(.0001,ab.lengthSq()),0,1);
  return ap.sub(ab.multiplyScalar(d)).lengthSq();
}
function updateArrows(dt){
  for(let i=arrows.length-1;i>=0;i--){
    const a=arrows[i];a.age+=dt;a.prev.copy(a.mesh.position);
    a.velocity.y-=3.6*dt;
    a.mesh.position.addScaledVector(a.velocity,dt);
    a.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),a.velocity.clone().normalize());
    let hit=false;
    for(const e of enemies){
      if(!e.alive||Math.abs(e.z-a.mesh.position.z)>5)continue;
      if(segmentDistanceSq(a.prev,a.mesh.position,e.group.position)<e.radius*e.radius){
        e.alive=false;scene.remove(e.group);hit=true;
        gain(250,'CLEAN SHOT');sound('hit');shake=Math.max(shake,.12);
        burst(e.group.position,27,'orange');break;
      }
    }
    if(!hit)for(const ice of icePatches){
      if(ice.broken||Math.abs(ice.z-a.mesh.position.z)>ice.length*.65)continue;
      const p=a.mesh.position;
      if(Math.abs(p.x-ice.x)<ice.width*.5 && Math.abs(p.z-ice.z)<ice.length*.5 && p.y<snowY(p.x,p.z)+.65){breakIce(ice,true);hit=true;break;}
    }
    if(a.age>2.5||hit||a.mesh.position.y<snowY(a.mesh.position.x,a.mesh.position.z)-1){
      scene.remove(a.mesh);a.mesh.traverse(o=>{if(o.geometry)o.geometry.dispose()});arrows.splice(i,1);
    }
  }
}
const bursts=[];
function burst(position,n,type){
  const color=type==='orange'?0xffb276:0xb4effa;
  for(let i=0;i<n;i++){
    const m=new THREE.Mesh(new THREE.TetrahedronGeometry(rand(.075,.22),0),new THREE.MeshBasicMaterial({color}));
    m.position.copy(position);scene.add(m);
    bursts.push({mesh:m,velocity:new THREE.Vector3(rand(-9,9),rand(-3,9),rand(-9,9)),life:rand(.22,.65)});
  }
}
function updateBursts(dt){
  for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];b.life-=dt;b.mesh.position.addScaledVector(b.velocity,dt);b.velocity.y-=13*dt;
    if(b.life<=0){scene.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose();bursts.splice(i,1);}}
}
function gain(points,label){
  combo=comboTimer>0?combo+1:1;comboTimer=3.3;
  score+=Math.round(points*(1+Math.min(4,combo-1)*.25));
  $('combo').textContent=combo>1?`${label}  ×${combo}`:`${label}  +${points}`;
}

// Procedural audio; no asset downloads. WebAudio starts only after a user click.
let audio=null, windGain=null;
function startAudio(){
  try{
    audio=new (window.AudioContext||window.webkitAudioContext)();
    const buffer=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate);
    const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.35;
    const noise=audio.createBufferSource();noise.buffer=buffer;noise.loop=true;
    const low=audio.createBiquadFilter();low.type='lowpass';low.frequency.value=350;
    windGain=audio.createGain();windGain.gain.value=.018;
    noise.connect(low);low.connect(windGain);windGain.connect(audio.destination);noise.start();
  }catch(e){ console.warn('Audio unavailable:',e); }
}
function sound(kind){
  if(!audio)return;
  const now=audio.currentTime;
  const o=audio.createOscillator(), g=audio.createGain();
  o.type=kind==='ice'?'triangle':kind==='hit'?'sine':'sawtooth';
  const pitch={bow:390,hit:870,ice:540,land:120,thud:76}[kind]||250;
  o.frequency.setValueAtTime(pitch,now);
  o.frequency.exponentialRampToValueAtTime(Math.max(35,pitch*(kind==='hit'?1.6:.31)),now+.16);
  g.gain.setValueAtTime(.0001,now);
  g.gain.exponentialRampToValueAtTime(kind==='ice'?.095:.04,now+.008);
  g.gain.exponentialRampToValueAtTime(.0001,now+(kind==='ice'?.42:.18));
  o.connect(g);g.connect(audio.destination);o.start(now);o.stop(now+.46);
  if(kind==='ice'){
    const len=Math.floor(audio.sampleRate*.32);
    const buffer=audio.createBuffer(1,len,audio.sampleRate);const data=buffer.getChannelData(0);
    for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.3);
    const n=audio.createBufferSource();n.buffer=buffer;
    const filt=audio.createBiquadFilter();filt.type='highpass';filt.frequency.value=1100;
    const vol=audio.createGain();vol.gain.value=.11;n.connect(filt);filt.connect(vol);vol.connect(audio.destination);n.start();
  }
}

function updateCamera(dt){
  const ideal=new THREE.Vector3(player.x+player.vx*.05, snowY(player.x,player.z)+player.jump+6.2,player.z+12.8);
  const t=1-Math.exp(-TUNING.cameraSmoothing*dt);
  camera.position.lerp(ideal,t);
  camera.position.x+=rand(-shake,shake);camera.position.y+=rand(-shake,shake);
  const lookAt=new THREE.Vector3(player.x+player.vx*.3,snowY(player.x,player.z-25)+1.9+player.jump*.3,player.z-25);
  camera.lookAt(lookAt);
  shake=Math.max(0,shake-dt*1.5);
}
function updateUI(){
  $('score').textContent=score.toLocaleString();
  $('speed').innerHTML=`${Math.round(player.speed*4.0)} <small>km/h</small>`;
  $('distance').innerHTML=`${Math.round(-player.z)} <small>m</small>`;
  $('chargeFill').style.width=`${clamp(drawTime/TUNING.bowMaxDraw,0,1)*100}%`;
  $('chargeText').textContent=drawTime>.9?'WOBBLE':drawing?'DRAWING':'READY';
  $('chargeFill').style.background=drawTime>.9?'#ffb586':'#b7f5f2';
  if(comboTimer<=0)$('combo').textContent='';
  $('flash').style.opacity=String(Math.max(0,impactFlash)*.45);
  const jitter=Math.max(0,drawTime-.78)*14;
  $('reticle').style.left=`${mouseX+Math.sin(elapsed*13.8)*jitter}px`;
  $('reticle').style.top=`${mouseY+Math.cos(elapsed*10.7)*jitter}px`;
}
function finish(){
  ended=true;running=false;drawing=false;
  $('overlay').classList.remove('hidden');
  document.querySelector('.kicker').textContent='THE RUN IS COMPLETE';
  document.querySelector('h1').innerHTML='NICE <span>RIDE.</span>';
  document.querySelector('.tagline').textContent=`${score.toLocaleString()} points · ${Math.round(-player.z)} m travelled · ${Math.round(elapsed)} seconds. Can you do better?`;
  $('start').innerHTML='RIDE AGAIN <span>→</span>';
  $('start').onclick=()=>location.reload();
}
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.035,Math.max(.001,(now-last)/1000||.016));last=now;
  if(running&&!paused&&!ended){
    elapsed+=dt;
    if(drawing)drawTime=Math.min(1.65,drawTime+dt);
    comboTimer=Math.max(0,comboTimer-dt);
    impactFlash=Math.max(0,impactFlash-dt*3.5);
    updateRider(dt);
    updateEnemies(dt);
    updateArrows(dt);
    updateIce(dt);
    updateSnow(dt);
    updateStreamers();
    updateBursts(dt);
    updateCamera(dt);
    updateUI();
    if(-player.z>=TUNING.courseLength)finish();
  }else if(!running&&!ended){
    // Still render a live scene behind the opening screen.
    camera.position.set(centerX(0),snowY(centerX(0),0)+7,16);
    camera.lookAt(centerX(-25),snowY(centerX(-25),-25)+2,-25);
  }
  if(windGain&&audio)windGain.gain.setTargetAtTime(running?.012+player.speed*.00045:.009,audio.currentTime,.1);
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);

function startGame(){
  if(ended)return;
  if(!audio)startAudio();else if(audio.state==='suspended')audio.resume();
  running=true;paused=false;$('overlay').classList.add('hidden');$('hud').classList.remove('hidden');$('reticle').classList.remove('hidden');
}
$('start').addEventListener('click',startGame);
function setPause(){
  if(ended||!running)return;
  paused=!paused;
  $('overlay').classList.toggle('hidden',!paused);
  if(paused){
    document.querySelector('.kicker').textContent='TAKE A BREATHER';
    document.querySelector('h1').innerHTML='PAUSED<span>.</span>';
    document.querySelector('.tagline').textContent='Fresh snow will still be here when you return.';
    $('start').innerHTML='RESUME <span>→</span>';
  }
}
window.addEventListener('keydown',(e)=>{
  const k=e.key.toLowerCase();keys.add(k);
  if(['arrowleft','arrowright','arrowdown','arrowup',' '].includes(k))e.preventDefault();
  if(k===' '&&!e.repeat&&running&&!paused&&player.grounded){player.vy=TUNING.jumpImpulse;player.grounded=false;sound('bow');}
  if(k==='p'&&!e.repeat)setPause();
  if(k==='r'&&!e.repeat)location.reload();
});
window.addEventListener('keyup',(e)=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();if(running&&!paused&&!ended)setPause();});
window.addEventListener('pointermove',(e)=>{
  mouseX=e.clientX;mouseY=e.clientY;
  mouse.set(2*e.clientX/innerWidth-1,1-2*e.clientY/innerHeight);
  if(!running)$('reticle').style.display='none';
});
renderer.domElement.addEventListener('pointerdown',(e)=>{
  if(e.button!==0||!running||paused||ended)return;
  drawing=true;drawTime=0;
});
window.addEventListener('pointerup',(e)=>{
  if(e.button!==0||!drawing)return;
  fireArrow();drawing=false;drawTime=0;
});
window.addEventListener('contextmenu',(e)=>e.preventDefault());
window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
});
window.addEventListener('error',(e)=>{
  const error=$('error'); if(error)error.textContent=`Game error: ${e.message}. See the browser console.`;
});
