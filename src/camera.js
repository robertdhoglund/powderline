// Chase camera. It rides behind and above along the slope, so steep pitches fall away under you.
import * as THREE from 'three';
import { G } from './state.js';
import { T } from './config.js';
import { camera } from './world.js';
import { height, slopeAt, dcx, cx, widthAt } from './course.js';
import { P } from './player.js';
import { clamp, damp, rand } from './util.js';

const fwd = new THREE.Vector3(), right = new THREE.Vector3(), look = new THREE.Vector3(), ideal = new THREE.Vector3();
let camH = 0, camS = 0.3, lagX = 0, roll = 0, fov = T.fovBase, punch = 0, snap = true;
export function resetCamera() { snap = true; camH = 0; camS = slopeAt(P.d); lagX = 0; roll = 0; punch = 0; }

export function updateCamera(rdt) {
  const aim = G.aim.zoom || 0, sp = clamp((P.v - 12) / 34, 0, 1);
  // Follow the course direction more than the board, so hard carves swing the rider across the frame.
  const k = snap ? 1 : 1 - Math.exp(-3.2 * rdt);
  camH += ((Math.atan(dcx(P.d + 18)) * 0.65 + P.h * 0.35) - camH) * k;
  camS += ((slopeAt(P.d + 6) * 0.8 + slopeAt(P.d + 26) * 0.2) - camS) * (snap ? 1 : 1 - Math.exp(-2.6 * rdt));
  fwd.set(Math.sin(camH), -camS, -Math.cos(camH)).normalize();
  right.set(Math.cos(camH), 0, Math.sin(camH));
  lagX = damp(lagX, -P.edge * 1.5 * (1 - aim), 3, rdt);
  const dist = (T.camDist + sp * 1.1) * (1 - aim * 0.38), up = T.camHeight + camS * 1.6 - aim * 0.5;
  ideal.copy(P.pos).addScaledVector(fwd, -dist).addScaledVector(right, lagX + aim * 1.5); ideal.y += up + P.alt * 0.12;
  const follow = snap ? 1 : 1 - Math.exp(-(9 + aim * 6) * rdt);
  camera.position.lerp(ideal, follow);
  // Stay over the piste so bank trees never fill the lens.
  const cd = -camera.position.z, lim = widthAt(cd) + 1.5, c0 = cx(cd);
  camera.position.x = clamp(camera.position.x, c0 - lim, c0 + lim);
  const floor = height(camera.position.x, camera.position.z) + 1.3; if (camera.position.y < floor) camera.position.y = floor;

  G.punch = damp(G.punch, 0, 7, rdt); punch = damp(punch, G.punch, 18, rdt);
  look.copy(P.pos).addScaledVector(fwd, 13 + sp * 6 + aim * 18).addScaledVector(right, aim * 1.2); look.y += 1.5 - punch * 1.8 - P.alt * 0.25;
  camera.lookAt(look);
  roll = damp(roll, -P.edge * 0.09 * (1 - aim * 0.6), 5, rdt); camera.rotateZ(roll);
  if (G.shake > 0) {
    const s = G.shake * G.shake * 0.05;
    camera.rotateX(rand(-s, s)); camera.rotateY(rand(-s, s)); camera.rotateZ(rand(-s, s) * 0.6);
    G.shake = Math.max(0, G.shake - rdt * 1.9);
  }
  fov = damp(fov, T.fovBase + sp * T.fovSpeed - aim * T.fovAim, snap ? 1e4 : 4.5, rdt);
  // On a tall screen, widen the lens so the piste still fits side to side.
  camera.fov = camera.aspect < 1.3 ? Math.min(104, 2 * Math.atan(Math.tan(fov * Math.PI / 360) * 1.3 / camera.aspect) * 180 / Math.PI) : fov;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  snap = false;
}

// Slow drift around the rider behind the title screen.
export function titleCamera(t) {
  const a = 0.45 + Math.sin(t * 0.15) * 0.3;
  camera.position.set(P.x + Math.sin(a) * 9, P.y + 3.4, P.z + Math.cos(a) * 9);
  camera.lookAt(P.x, P.y + 1.0, P.z - 6); camera.fov = 58; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
