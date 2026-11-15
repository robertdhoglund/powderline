// Score, flow multiplier, pop-up callouts, reticle and the title / pause / finish screens.
import { G } from './state.js';
import { FINISH } from './course.js';
import { clamp } from './util.js';
import { LEVEL } from './levels.js';

const $ = (id) => document.getElementById(id);
const el = { hud: $('hud'), score: $('score'), flow: $('flow'), flowFill: $('flowFill'), pop: $('pop'), prog: $('progFill'), speed: $('speed'),
  reticle: $('reticle'), focus: $('focusArc'), overlay: $('overlay'), flash: $('flash'), kicker: $('kicker'), title: $('title'), tag: $('tagline'),
  start: $('start'), frost: $('frost'), clock: $('clock'), shield: $('shield'), stats: $('stats'), help: $('help') };
let shown = -1, popT = 0, tally = '', lastSec = -1;

// Every scoring event raises the flow multiplier. Flow fades if you stop making things happen.
export function award(points, label) {
  const gained = points * G.flow;
  G.score += gained; G.flowT = 4.5;
  G.flow = Math.min(8, G.flow + 1); G.stats.bestFlow = Math.max(G.stats.bestFlow, G.flow);
  pop(`${label}  +${gained}`);
}
export function pop(text, hot = false) {
  el.pop.textContent = text; el.pop.classList.toggle('hot', hot);
  el.pop.classList.remove('show'); void el.pop.offsetWidth; el.pop.classList.add('show'); popT = 1.3;
}
export function breakFlow() { G.flow = 1; G.flowT = 0; }
export function flash(amount = 0.5) { el.flash.style.transition = 'none'; el.flash.style.opacity = amount; void el.flash.offsetWidth; el.flash.style.transition = 'opacity .35s'; el.flash.style.opacity = 0; }

export function updateHud(P, rdt) {
  if (G.flowT > 0) { G.flowT -= G.dt; if (G.flowT <= 0) G.flow = Math.max(1, G.flow - 1), G.flowT = G.flow > 1 ? 1.2 : 0; }
  if (G.score !== shown) { shown += Math.ceil((G.score - shown) * Math.min(1, rdt * 12)); el.score.textContent = shown.toLocaleString('en-US'); }
  el.flow.textContent = `×${G.flow}`; el.flow.classList.toggle('on', G.flow > 1);
  el.flowFill.style.transform = `scaleX(${clamp(G.flowT / 4.5, 0, 1)})`;
  el.prog.style.transform = `scaleX(${clamp(P.d / FINISH, 0, 1)})`;
  el.speed.textContent = Math.round(P.v * 3.6);
  const sec = Math.floor(G.rtRun || 0); if (sec !== lastSec) { lastSec = sec; const par = LEVEL.par; el.clock.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} / ${Math.floor(par / 60)}:${String(par % 60).padStart(2, '0')}`; el.clock.classList.toggle('late', sec > par); }
  if (popT > 0) { popT -= rdt; if (popT <= 0) el.pop.classList.remove('show'); }
  // snowball frost on the lens, shield count
  if (G.frost > 0) G.frost = Math.max(0, G.frost - rdt * 0.6); el.frost.style.opacity = G.frost;
  const tl = `GOBLINS <b>${G.stats.kills}</b>/${G.totals.targets} · GATES <b>${G.stats.gates}</b>/${G.totals.gates}`; if (tl !== tally) { tally = tl; $('tally').innerHTML = tl; }
  el.shield.textContent = G.shield > 0 ? `SHIELD ${'◆'.repeat(G.shield)}` : '';
  // reticle
  const a = G.aim, r = el.reticle;
  r.style.transform = `translate(${G.input.px}px, ${G.input.py}px)`;
  r.style.setProperty('--gap', `${6 + (1 - a.draw) * 20 * (a.drawing ? 1 : 0.5)}px`);
  r.classList.toggle('drawing', a.drawing); r.classList.toggle('full', a.drawing && a.draw >= 1); r.classList.toggle('lock', !!a.lock); r.classList.toggle('focus', !!a.focusOn);
  el.focus.style.strokeDashoffset = String(113 * (1 - a.focus));
  el.focus.style.opacity = a.focus < 0.999 || a.focusOn ? 1 : 0;
}

export function showHud(on) { el.hud.classList.toggle('hidden', !on); el.reticle.classList.toggle('hidden', !on); document.body.classList.toggle('playing', on); }
export function showOverlay(kind, res) {
  el.overlay.className = kind ? `show ${kind}` : '';
  $('restart').textContent = kind === 'finished' ? 'BASE CAMP' : 'RESTART';
  if (kind === 'title') { el.kicker.textContent = `${LEVEL.place} · ${LEVEL.time}`; el.title.innerHTML = 'POWDER<span>LINE</span>'; el.tag.textContent = 'Carve the powder. Draw the bow. Hunt the goblins.'; el.start.textContent = 'DROP IN'; el.stats.innerHTML = ''; }
  if (kind === 'paused') { el.kicker.textContent = 'PAUSED'; el.title.innerHTML = 'BREATHE<span>.</span>'; el.tag.textContent = 'The mountain will wait.'; el.start.textContent = 'RESUME'; el.stats.innerHTML = ''; }
  if (kind === 'finished') {
    const s = G.stats, t = G.totals, mm = Math.floor(s.time / 60), ss = (s.time % 60).toFixed(1).padStart(4, '0');
    el.kicker.textContent = `${LEVEL.name} · RUN COMPLETE`; el.title.innerHTML = `RANK <span>${res.rank}</span>`;
    el.tag.innerHTML = `${G.score.toLocaleString('en-US')} points  ·  +${res.coins.toLocaleString('en-US')} coins${res.opened ? `  ·  ${res.opened.name} unlocked` : ''}<br><small>${res.need}</small>`;
    el.stats.innerHTML = [['GOBLINS', `${s.kills}/${t.targets}`, res.gob], ['GATES', `${s.gates}/${t.gates}`, res.gate], [`TIME · PAR ${Math.floor(res.par / 60)}:${String(Math.round(res.par % 60)).padStart(2, '0')}`, `${mm}:${ss}`, res.speed], ['STYLE', s.style.toLocaleString('en-US'), res.styleK]]
      .map(([k, v, f]) => `<div class="big"><b>${v}</b><span>${k}</span><em><u style="width:${Math.round(f * 100)}%"></u></em></div>`).join('')
      + [['TRICKS', s.tricks], ['PERFECT', s.perfect], ['BEST FLOW', `×${s.bestFlow}`], ['BIG AIR', `${s.maxAir.toFixed(1)}s`], ['SNOWBALLED', s.hits]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
    el.start.textContent = 'RIDE AGAIN';
  }
}
