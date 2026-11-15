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
    case 'throw': noise(0.22, 0.07, 'bandpass', 500, 1, 0, 1500); break;
    case 'splat': noise(0.3, 0.4, 'lowpass', 1100, 0.6, 0, 200); tone(160, 60, 0.18, 0.25, 'triangle'); break;
    case 'block': tone(880, 1320, 0.2, 0.12); noise(0.15, 0.15, 'highpass', 3000); break;
    case 'buy': tone(660, 660, 0.12, 0.1); tone(990, 990, 0.3, 0.1, 'sine', 0.09); break;
    case 'bonk': tone(120, 45, 0.3, 0.45, 'triangle'); noise(0.25, 0.3, 'lowpass', 700); break;
    case 'crack': for (let i = 0; i < 6; i++) noise(0.03, 0.25, 'highpass', 3000 + Math.random() * 3000, 0.7, i * 0.022 + Math.random() * 0.01); break;
    case 'ice':
      noise(0.5, 0.4, 'highpass', 2200, 0.5); noise(0.3, 0.3, 'bandpass', 900, 0.8, 0.02, 300);
      for (let i = 0; i < 9; i++) tone(1800 + Math.random() * 4200, 1200 + Math.random() * 2500, 0.12 + Math.random() * 0.3, 0.035, 'sine', 0.03 + Math.random() * 0.4);
      break;
  }
}

// ---- soundtrack: a small generative loop on the course's beat (120 BPM). M or the note button mutes it. ----
const BEAT = 0.5, PROG = [[0, 4, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]];   // semitones from the key, one chord per bar
let musicOn = true, nextBeat = 0, beatN = 0, mGain = null, mFilter = null, energy = 0, key = 45;
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
function voice(type, freq, t, dur, vol, attack = 0.01) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(mFilter); o.start(t); o.stop(t + dur + 0.05);
}
function drum(t, kind) {
  if (kind === 'kick') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(mGain); o.start(t); o.stop(t + 0.22); return; }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
  const g = ctx.createGain(); g.gain.setValueAtTime(kind === 'hat' ? 0.06 : 0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'hat' ? 0.04 : 0.13));
  s.connect(f); f.connect(g); g.connect(mGain); s.start(t, Math.random()); s.stop(t + 0.2);
}
export function setKey(semitone) { key = semitone; }
export function toggleMusic() { musicOn = !musicOn; if (mGain) mGain.gain.setTargetAtTime(musicOn ? 0.5 : 0, ctx.currentTime, 0.1); return musicOn; }
// Called every frame. playing: in a run. flow 1..8 adds layers. slow: time scale, which muffles the mix.
export function music(playing, flow, slow) {
  if (!ctx) return;
  if (!mGain) { mGain = ctx.createGain(); mGain.gain.value = musicOn ? 0.5 : 0; mFilter = ctx.createBiquadFilter(); mFilter.type = 'lowpass'; mFilter.connect(mGain); mGain.connect(master); nextBeat = ctx.currentTime + 0.1; }
  energy += ((playing ? 0.35 + (flow - 1) / 7 * 0.65 : 0.12) - energy) * 0.02;
  mFilter.frequency.setTargetAtTime((500 + energy * 5200) * (0.25 + slow * 0.75), ctx.currentTime, 0.08);
  if (nextBeat < ctx.currentTime - 1) nextBeat = ctx.currentTime + 0.05;
  while (nextBeat < ctx.currentTime + 0.2) {
    const t = nextBeat, half = beatN % 8, chord = PROG[Math.floor(beatN / 8) % PROG.length];   // beatN counts half-beats
    if (half === 0) { for (const n of chord) voice('sawtooth', hz(key + 12 + n), t, BEAT * 4.2, 0.035, 0.4); voice('triangle', hz(key - 12 + chord[0]), t, BEAT * 3.6, 0.2, 0.02); }
    if (half === 4 && energy > 0.3) voice('triangle', hz(key - 12 + chord[0]), t, BEAT * 1.6, 0.16, 0.02);
    if (playing) {
      if (half % 2 === 0 && energy > 0.3) drum(t, 'kick');
      if (half % 4 === 2 && energy > 0.55) drum(t, 'snare');
      if (energy > 0.7) drum(t, 'hat');
      if (energy > 0.25) { const arp = [0, 1, 2, 1, 2, 0, 1, 2][half], oct = half > 3 && energy > 0.6 ? 24 : 12; voice('square', hz(key + 12 + oct + chord[arp]), t, BEAT * 0.45, 0.028 + energy * 0.03); }
    }
    beatN++; nextBeat += BEAT / 2;
  }
}
