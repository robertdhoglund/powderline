// POWDERLINE: boot, input, game modes and the frame loop. Each system lives in its own module.
import { G, resetState } from './state.js';
import { composer, camera, updateWorld, watchPerformance, TOUCH } from './world.js';
import { FINISH, gates, dcx } from './course.js';
import { P, updatePlayer, resetPlayer } from './player.js';
import { updateCamera, resetCamera, titleCamera } from './camera.js';
import { updateSnow, resetSnow } from './snow.js';
import { updateFx, resetFx } from './fx.js';
import { updateTargets, resetTargets, enemies } from './targets.js';
import { updateIce, resetIce } from './ice.js';
import { updateBow, resetBow, startDraw, release, cancelDraw, focusScale } from './bow.js';
import { updateHud, showHud, showOverlay, pop } from './hud.js';
import { initAudio, setRide, silence } from './audio.js';
import { clamp, damp } from './util.js';
import * as THREE from 'three';

const keys = new Set(), I = G.input;
const Q = new URLSearchParams(location.search);
G.auto = Q.has('auto'); if (Q.has('d')) G.debugD = +Q.get('d'); // ?d=600 starts further down, for testing

function reset() {
  resetState(); G.rtRun = 0; resetPlayer(); resetCamera(); resetSnow(); resetFx(); resetTargets(); resetIce(); resetBow();
}
function start() {
  initAudio();
  if (G.mode === 'paused') { G.mode = 'run'; showOverlay(null); showHud(true); return; }
  reset(); G.mode = 'run'; showOverlay(null); showHud(true);
  if (TOUCH) setReticle(innerWidth / 2, innerHeight * 0.42);
  setTimeout(() => { if (G.mode === 'run' && G.t < 3) pop('CARVE'); }, 500);
}
function pause() {
  if (G.mode === 'run') { G.mode = 'paused'; cancelDraw(); showOverlay('paused'); showHud(false); silence(); }
  else if (G.mode === 'paused') start();
}
function finish() {
  G.mode = 'finished'; G.stats.time = G.rtRun; cancelDraw(); silence();
  setTimeout(() => { if (G.mode === 'finished') { showHud(false); showOverlay('finished'); } }, 1400);
}

document.getElementById('start').addEventListener('click', (e) => { e.stopPropagation(); start(); });
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase(); keys.add(k);
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  if (k === ' ') { if (G.mode === 'run') I.jump = true; else if (G.mode !== 'paused') start(); }
  if (k === 'enter' && G.mode !== 'run') start();
  if (k === 'p' || k === 'escape') pause();
  if (k === 'r') { G.mode = 'title'; start(); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); if (G.mode === 'run' && !G.auto) pause(); });
// Mouse: the reticle follows the pointer; hold to draw, release to shoot.
// Touch: left thumb drags to steer (up = tuck, down = brake); right thumb holds and drags to aim, releases to shoot, taps to jump.
const touch = { steer: null, aim: null, turn: 0, tuck: false, brake: false };
const setReticle = (x, y) => { I.px = clamp(x, 0, innerWidth); I.py = clamp(y, 0, innerHeight); I.mx = (I.px / innerWidth) * 2 - 1; I.my = 1 - (I.py / innerHeight) * 2; };
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch') return setReticle(e.clientX, e.clientY);
  const s = touch.steer, a = touch.aim;
  if (s && e.pointerId === s.id) {
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    touch.turn = Math.abs(dx) < 8 ? 0 : clamp((dx - Math.sign(dx) * 8) / 38, -1, 1); touch.tuck = dy < -55; touch.brake = dy > 55;
  }
  if (a && e.pointerId === a.id) {
    const dx = e.clientX - a.x0, dy = e.clientY - a.y0;
    if (Math.hypot(dx, dy) > 12) a.moved = true;
    setReticle(a.rx + dx * 1.6, a.ry + dy * 1.6);
  }
});
addEventListener('pointerdown', (e) => {
  if (G.mode !== 'run') return;
  if (e.pointerType !== 'touch') { if (e.button === 0) startDraw(); else if (e.button === 2) cancelDraw(); return; }
  if (e.clientX < innerWidth / 2) { if (!touch.steer) touch.steer = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; }
  else if (!touch.aim) { touch.aim = { id: e.pointerId, x0: e.clientX, y0: e.clientY, rx: I.px, ry: I.py, t0: e.timeStamp, moved: false }; startDraw(); }
});
const lift = (e) => {
  if (e.pointerType !== 'touch') { if (e.button === 0) release(); return; }
  if (touch.steer && e.pointerId === touch.steer.id) { touch.steer = null; touch.turn = 0; touch.tuck = touch.brake = false; }
  if (touch.aim && e.pointerId === touch.aim.id) {
    if (!touch.aim.moved && e.timeStamp - touch.aim.t0 < 230) { cancelDraw(true); if (G.mode === 'run') I.jump = true; } else release();
    touch.aim = null;
  }
};
addEventListener('pointerup', lift); addEventListener('pointercancel', lift);
document.getElementById('pauseBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); pause(); });
document.getElementById('restart').addEventListener('click', (e) => { e.stopPropagation(); G.mode = 'title'; start(); });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('error', (e) => { document.getElementById('error').textContent = `Game error: ${e.message}`; });
setReticle(innerWidth / 2, innerHeight * 0.42);

function readInput() {
  const has = (...k) => k.some((x) => keys.has(x));
  I.turn = (has('d', 'arrowright') ? 1 : 0) - (has('a', 'arrowleft') ? 1 : 0);
  I.tuck = has('w', 'arrowup') || touch.tuck; I.brake = has('s', 'arrowdown') || touch.brake;
  if (!I.turn) I.turn = touch.turn;
  if (G.auto && G.mode === 'run') autopilot();
}

// Autopilot: used by the smoke test (?auto=1). Rides the gates and shoots what it sees.
const _s = new THREE.Vector3(); let autoT = 0;
function autopilot() {
  const g = gates.find((x) => x.d > P.d + 4 && x.d < P.d + 70), wantU = g ? g.u : 0;
  const wantH = Math.atan(dcx(P.d)) + clamp((wantU - P.u) * 0.07, -0.6, 0.6);
  I.turn = clamp((wantH - P.h) * 4, -1, 1); if (Math.abs(I.turn) < 0.15) I.turn = 0; else I.turn = Math.sign(I.turn);
  autoT += G.rdt;
  const e = enemies.find((x) => x.alive && x.group.visible && -x.pos.z - P.d > 25 && -x.pos.z - P.d < 110);
  if (e) {
    _s.copy(e.pos).project(camera); I.mx = _s.x; I.my = _s.y; I.px = (_s.x + 1) / 2 * innerWidth; I.py = (1 - _s.y) / 2 * innerHeight;
    if (!G.aim.drawing && autoT > 0.5) startDraw(); else if (G.aim.drawing && G.aim.draw >= 1) { release(); autoT = 0; }
  }
}

let last = performance.now();
// One tick of game logic. Rendering is separate so tests can fast-forward without drawing.
function step(rdt) {
  G.rdt = rdt; G.rt += rdt;
  readInput();
  if (G.mode === 'paused') return;
  const live = G.mode === 'run' || G.mode === 'finished';
  if (G.hitstop > 0) { G.hitstop -= rdt; G.timeScale = 0.04; }
  else G.timeScale = damp(G.timeScale, live ? focusScale() : 1, 14, rdt);
  const dt = G.dt = rdt * G.timeScale; G.t += dt;
  if (G.mode === 'run') G.rtRun += rdt;
  if (live) {
    updatePlayer(dt); updateTargets(dt); updateIce(dt); updateBow(rdt, dt);
    updateCamera(rdt); updateHud(P, rdt);
    setRide(P.v, Math.abs(P.edge) + P.brake, P.grounded, 0.5 + G.timeScale * 0.5);
    if (G.mode === 'run' && P.d >= FINISH) finish();
  } else titleCamera(G.rt);
  updateSnow(dt, rdt); updateFx(dt);
  updateWorld(P.d, G.rt, live ? clamp((P.v - 20) / 26, 0, 1) * (1 - G.aim.blend * 0.7) : 0);
}
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
  step(rdt); watchPerformance(rdt);
  composer.render();
}

document.body.classList.toggle('touch', TOUCH);
reset(); G.rtRun = 0;
updatePlayer(0.016); showOverlay('title');
requestAnimationFrame(frame);
window.__pl = { G, P, start, reset, sim: (seconds) => { for (let i = 0; i < seconds * 60 && G.mode === 'run'; i++) step(1 / 60); } };
