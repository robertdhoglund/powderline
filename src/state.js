import * as THREE from 'three';

// Shared blackboard. Every module reads and writes this instead of importing each other in circles.
export const G = {
  mode: 'title',          // title | run | paused | finished
  t: 0,                   // game time (affected by slow motion)
  rt: 0,                  // real time
  dt: 0, rdt: 0,
  timeScale: 1, hitstop: 0,
  shake: 0, punch: 0,     // camera trauma and landing dip
  score: 0, flow: 1, flowT: 0,
  stats: null,
  auto: false,            // autopilot, used by the smoke test and ?auto=1
  input: { turn: 0, tuck: false, brake: false, jump: false, mx: 0, my: 0.12, px: 0, py: 0 },
  aim: { blend: 0, draw: 0, drawing: false, focus: 1, dir: new THREE.Vector3(0, 0, -1), lock: null },
};

export function resetState() {
  G.t = 0; G.timeScale = 1; G.hitstop = 0; G.shake = 0; G.punch = 0;
  G.score = 0; G.flow = 1; G.flowT = 0;
  G.stats = { kills: 0, perfect: 0, ice: 0, gates: 0, maxAir: 0, bonks: 0, time: 0, bestFlow: 1 };
  G.aim.blend = 0; G.aim.draw = 0; G.aim.drawing = false; G.aim.focus = 1; G.aim.lock = null;
}
resetState();
