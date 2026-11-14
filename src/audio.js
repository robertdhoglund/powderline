// Small procedural sound set. No audio files. Music comes in a later version.
import { clamp } from './util.js';

let ctx = null, master, noiseBuf, wind, windF, carve, carveF, drawOsc, drawGain;
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = (type, freq, q) => {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start();
      return [g, f];
    };
    [wind, windF] = loop('bandpass', 500, 0.6);
    [carve, carveF] = loop('highpass', 2400, 0.4);
    drawOsc = ctx.createOscillator(); drawOsc.type = 'triangle'; drawGain = ctx.createGain(); drawGain.gain.value = 0;
    drawOsc.connect(drawGain); drawGain.connect(master); drawOsc.start();
  } catch (e) { console.warn('Audio unavailable', e); ctx = null; }
}
export function setRide(speed, edge, grounded, slow) {
  if (!ctx) return;
  const t = ctx.currentTime, s = clamp(speed / 45, 0, 1);
  wind.gain.setTargetAtTime(0.03 + s * s * 0.2, t, 0.1); windF.frequency.setTargetAtTime((300 + s * 900) * slow, t, 0.1);
  carve.gain.setTargetAtTime(grounded ? 0.02 + s * 0.05 + edge * edge * s * 0.3 : 0, t, 0.05);
  carveF.frequency.setTargetAtTime((3200 - edge * 1500) * slow, t, 0.05);
}
export function setDraw(draw, drawing) {
  if (!ctx) return;
  const t = ctx.currentTime;
  drawGain.gain.setTargetAtTime(drawing ? 0.025 + draw * 0.03 : 0, t, 0.02);
  drawOsc.frequency.setTargetAtTime(70 + draw * 150, t, 0.03);
}
export function silence() { if (ctx) { const t = ctx.currentTime; wind.gain.setTargetAtTime(0.02, t, 0.2); carve.gain.setTargetAtTime(0, t, 0.1); drawGain.gain.setTargetAtTime(0, t, 0.02); } }

function tone(freq, to, dur, vol, type = 'sine', delay = 0) {
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, type, freq, q = 0.7, delay = 0, sweep = 0) {
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loopStart = Math.random(); s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
}
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const note = (i) => 440 * Math.pow(2, (SCALE[clamp(i, 0, SCALE.length - 1)] - 9) / 12);

export function sfx(kind, n = 0) {
  if (!ctx) return;
  switch (kind) {
    case 'release': tone(190, 70, 0.22, 0.22, 'triangle'); noise(0.28, 0.2, 'bandpass', 2600, 1.2, 0, 700); break;
    case 'full': tone(1400, 1400, 0.05, 0.05); break;
    case 'cancel': tone(160, 90, 0.1, 0.05, 'triangle'); break;
    case 'hit': tone(300, 60, 0.22, 0.3, 'triangle'); noise(0.3, 0.3, 'lowpass', 2400, 0.7, 0, 300); tone(note(4 + n), note(4 + n), 0.5, 0.12); tone(note(6 + n), note(6 + n), 0.6, 0.08, 'sine', 0.06); break;
    case 'perfect': tone(note(7), note(7), 0.7, 0.14); tone(note(9), note(9), 0.8, 0.12, 'sine', 0.07); tone(note(10), note(10), 0.9, 0.1, 'sine', 0.14); break;
    case 'thunk': tone(140, 60, 0.12, 0.14, 'triangle'); noise(0.1, 0.1, 'lowpass', 900); break;
    case 'gate': tone(note(n), note(n), 0.45, 0.13); tone(note(n) * 2, note(n) * 2, 0.3, 0.05); break;
    case 'pump': noise(0.35, 0.16, 'bandpass', 900, 0.8, 0, 2600); break;
    case 'jump': noise(0.18, 0.12, 'bandpass', 700, 0.8, 0, 1800); break;
    case 'land': tone(95, 40, 0.25, 0.4 * (0.4 + n)); noise(0.45, 0.22 * (0.4 + n), 'lowpass', 1300, 0.5, 0, 250); break;
    case 'bonk': tone(120, 45, 0.3, 0.45, 'triangle'); noise(0.25, 0.3, 'lowpass', 700); break;
    case 'crack': for (let i = 0; i < 6; i++) noise(0.03, 0.25, 'highpass', 3000 + Math.random() * 3000, 0.7, i * 0.022 + Math.random() * 0.01); break;
    case 'ice':
      noise(0.5, 0.4, 'highpass', 2200, 0.5); noise(0.3, 0.3, 'bandpass', 900, 0.8, 0.02, 300);
      for (let i = 0; i < 9; i++) tone(1800 + Math.random() * 4200, 1200 + Math.random() * 2500, 0.12 + Math.random() * 0.3, 0.035, 'sine', 0.03 + Math.random() * 0.4);
      break;
  }
}
