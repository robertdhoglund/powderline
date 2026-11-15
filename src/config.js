// POWDERLINE tuning. These numbers are the first place to tweak game feel.
export const T = {
  beat: 14,              // metres per beat. The course is authored in beats so music can sync later.

  // Riding
  gravity: 17,           // pull along the slope
  airGravity: 26,        // pull while airborne
  dragQuad: 0.0068,      // air + snow drag, sets top speed per slope angle
  tuckDrag: 0.4,         // drag multiplier while tucking (W)
  tuckPush: 2.6,         // extra pull while tucking
  brakeDecel: 17,        // S
  startSpeed: 15, minSpeed: 9, maxSpeed: 50,
  turnRate: 1.95,        // radians per second at full edge
  edgeIn: 7, edgeOut: 9, // how fast the board rolls onto / off its edge
  fallLine: 2.0,         // how strongly the board swings back downhill by itself
  assist: 1.4,           // how firmly a hands-off board follows the piste (0 = no help)
  maxHeading: 1.2,       // max angle away from the course direction
  carveScrub: 0.13,      // speed lost while holding an edge
  pumpBoost: 3.4,        // speed gained by releasing a held carve
  jump: 8.5,
  airSteer: 0.4,

  // Bow
  drawTime: 0.55,        // seconds of real time to full draw
  arrowSpeedMin: 58, arrowSpeedMax: 128, arrowGravity: 14,
  focusHold: 0.45,       // seconds held past full draw before slow motion starts
  focusGround: 0.5,      // time scale while aiming on snow
  focusAir: 0.28,        // time scale while aiming in the air
  focusDrain: 0.42,      // focus used per real second of aiming
  focusRegen: 0.3,
  assistAngle: 0.03,     // radians of aim magnetism around a target

  // Camera
  fovBase: 62, fovSpeed: 24, fovAim: 15,
  camDist: 5.9, camHeight: 2.2,
};
