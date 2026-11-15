# Changes and handoffs

## v0.6 | 2026-11-15 | Claude

Country scenery, opt-in slow motion, an inked look for the hero and goblins, and a soundtrack.

**Changed**

- **Slow motion is a choice.** A quick draw-and-release now happens in real time. Slow motion (and the zoom) starts only if you keep holding about a third of a second past full draw, hold right mouse or Shift, or draw in the middle of a real jump. The same hold works with a thumb, so touch plays the same way. `Q` cancels a draw (right click no longer does).
- **Country scenery.**
  - Norway: stone trolls with glowing eyes, red cabins, rune stones, twin horn peaks.
  - Japan: torii to ride through instead of light arches, stone lanterns, cherry trees, bamboo, pagodas, a volcano on the horizon.
  - France: chalets with tricolour flags, fences, red and blue race gates, gondola lines strung across the piste, granite needles on the horizon.
  - Alaska: totem poles, log cabins, blue ice seracs, a bush plane on skis, fluted spines on the horizon.
- **Ink outlines** on the hero and the goblins, for a drawn look.
- **Hero.** A face (eyes, brows, nose, mouth), side locks, gold hem, collar, quiver strap, belt pouch, and a fuller cape with five columns of cloth.
- **Soundtrack.** A small generative loop at 120 BPM on the course's beat grid: pad and bass always, drums and arpeggio as your flow rises, muffled in slow motion. Each country has its own key. `M` or the note button mutes it.
- **Live counters** for goblins and gates under the score.
- **Speed targets tightened** so rank A still takes a tucked, clean run now that shots no longer cost slow-motion time.
- Tree islands in the middle of the piste are gone: the camera could pass through them.
- Props are drawn only near the rider, like trees and rocks.

**Tested**

- `npm run check` and `npm test` pass.
- Scenery frames from all four countries and new hero close-ups were reviewed.
- **Not tested: the soundtrack.** I cannot hear it. Volume, mix and whether it is pleasant are unverified; it can be muted.
- **Not tested by a person: the new slow-motion timing.** The 0.3 s hold is a guess (`focusHold` in `src/config.js`).

**Known issues**

- The autopilot (never tucks) gets rank B on Trollheim with 72 of 75 goblins and every gate.
- Scenery is decoration only; nothing collides with it.
- Landing craters and clods are simple shapes.

---

## v0.5 | 2026-11-14 | Claude

Snowballs, a lobby with upgrades, four mountains, and scoring rebuilt around goblins, gates and speed.

**Changed**

- **Goblins throw snowballs.** Lookouts and balloon goblins throw as you come into range; raiders keep throwing. Each ball is aimed where you will be if you hold your line, so carving dodges it. A hit costs speed and your flow multiplier and frosts the screen for a moment. It never ends the run.
- **Base camp.** A lobby between the title and the run: pick a mountain, spend coins, ride. Coins come from score plus a rank bonus.
- **Upgrades.** Quick Draw, Deep Focus, True Aim, Board Wax, Snow Shield (three levels each) and Triple Shot (two extra arrows that seek nearby goblins).
- **Four mountains.** Trollheim (Norway, dusk to dawn), Kitsune Ridge (Japan, morning), Couloir Noir (France, bluebird day), Aurora Spines (Alaska, midnight). Each has its own layout, light, sun height and snowball rate. Finish one with rank C to open the next.
- **Levels are data.** `src/levels.js` lists each mountain as sections; `src/course.js` fills each section from a recipe (slalom, camp, ice, cliffs, park and so on).
- **Scoring.** The rank is 40% goblins hit, 25% gates made, 35% speed. The clock is real time, so slow motion costs time. A needs most goblins, nearly every gate and a fast run; S needs close to everything.
- **Tuck is faster.** `W` now cuts drag harder and adds a push.
- **Saves.** Coins, upgrades, best ranks and the chosen level are kept in the browser.
- Menus no longer redraw the 3D scene behind them.

**Tested**

- `npm run check` and `npm test` pass. The autopilot (hits 72 of 75 goblins and every gate, but never tucks and aims in slow motion) gets rank B on Trollheim.
- Lobby, buying an upgrade, the finish screen and coin payout were exercised in a headless browser.
- A frame from each of the four levels was reviewed.
- **Not tested: switching mountains inside the published page on a real phone.** Switching reloads the page and starts the run; if the page cannot reload itself there, you stay on the current mountain.

**Known issues**

- The smoke test only covers Trollheim. The other three were run once each under autopilot (Japan and France to the finish, Alaska for its first two minutes) with no errors.
- Upgrade prices, coin payouts and rank lines are first guesses.
- The countries differ in light and layout, not yet in scenery (no torii gates, chalets and so on).
- No music yet.

---

## v0.4 | 2026-11-14 | Claude

Kasper's round: goblins, a new hero, fresher snow, a longer and turnier mountain with more jumps.

**Changed**

- **Goblins replace the floating sentries.** Three kinds: lookouts on wooden watchtowers, goblins hanging under glowing lantern balloons (shoot the goblin or pop the balloon), and raiders on sleds that ride ahead of you. Same hit rules as before: any hit counts, a centre hit is PERFECT, close neighbours chain.
- **New hero.** A young ranger: emerald tunic and belt, cream sleeves, tall leather boots, copper hair, pointed ears, a quiver, and an ochre cape that flies behind. Adventurer-archer in spirit; deliberately not a copy of any existing character.
- **Fresh snow.** The trench is a real groove with raised berms (higher on the outside of a carve) and a shadowed floor. Carving throws clods as well as spray. Steep carves set loose snow running beside you. Landings leave a crater ring. Trees dump their snow when you pass close.
- **Real shadows.** The rider, goblins and props cast long shadows from the low sun.
- **Longer course, more turning.** About 2.5 km and 85 to 90 seconds, up from 1.3 km. Each section sets how hard the course swings; the canyon and gorge are tight S-turns. New: rollers, three cliff drops, a four-kicker jump park with ravines, and a dawn at the end.
- **Air spins.** Hold a direction in the air to spin; clean half-turns score.
- **Set dressing.** Watchtowers, torches, and pennants at every lip so jumps read from far away.
- **Performance.** Trees, rocks and terrain are drawn only near the rider.

**Tested**

- `npm run check` and `npm test` pass (autopilot finishes the new course: 64 of 70 goblins, 40 of 41 gates).
- The single-file build runs on an emulated phone with touch input and no console errors.
- Close-up renders of the hero and each goblin type were reviewed.
- **Still not tested by me: full frame rate on real hardware.** The scene is heavier than v0.3 (shadows, more geometry).

**Known issues**

- The cape is stiff at speed, and the hero's arms are simple.
- Tower goblins only hop and turn; they have no attack.
- Raiders are harmless.
- Rank thresholds are guesses (autopilot scores about 192,000; S is 190,000).
- No music yet.

**Best next action**

Play it. Report frame rate on the phone, whether the canyon turns are too tight, and whether the jumps are big enough.

---

## v0.3 | 2026-11-14 | Claude

An art pass ("too simple and boxy") plus touch controls, so the game can be played on a phone.

**Changed**

- **Snow is a material now.** Smooth dunes instead of facets, wind ripples that catch the low sun, sparkle, a sheen toward the sun, and long blue tree shadows painted once into a map of the course.
- **Trees.** Layered firs with jagged skirts and snow on the boughs, in three shapes, with a sun rim on their edges.
- **Rocks.** Dark outcrops with snow tops along the banks, thickest on the steep pitches.
- **Sky.** Streaked clouds lit from below, sharper far ridges in four layers, and an aurora in the night section.
- **Rider.** Smooth limbs and joints, a parka with a flared hem, a pointed hood, a curved visor, a board with a real outline and kicked nose and tail, and a second scarf tail.
- **Ice.** A glassy shader: see-through face-on, bright at glancing angles, with a sun glint per facet.
- **Targets and gates.** Sentries are a glowing seed between crystal shells inside turning rings. Gates are arches of light.
- **Lens.** Speed blur toward the frame edges, light colour fringing, vignette, grain.
- **Touch.** Left thumb drags to steer (up tucks, down brakes). Right thumb holds and drags to aim, releases to shoot, taps to jump. Pause button, small-screen HUD, wider lens on tall screens.
- **Sharing.** `npm run artifact` packs everything into one HTML file in `dist/`.

**Tested**

- `npm run check` and `npm test` pass.
- The single-file build was run on an emulated phone with real touch events: steer, aim, shoot and tap-to-jump all register, with no console errors.
- Screenshots reviewed from the headless browser.
- **Still not tested: a human at full frame rate, or a real phone GPU.** The game lowers its own resolution if frames are slow, but that is unverified on real hardware.

**Known issues**

- The trench behind the board is still a flat ribbon, and carve spray is modest at low speed.
- The arms and bow are still simple.
- Touch aim is relative (drag moves the reticle); sensitivity is a guess (`1.6` in `src/main.js`).
- No music yet.

**Best next action**

Play it on a phone and a laptop. Report frame rate, whether steering and aim sensitivity feel right on touch, and which part of the picture still looks cheapest.

---

## v0.2 | 2026-11-14 | Claude

A rebuild of look and feel. The v0.1 mechanics list is the same (carve, bow, ice); almost every line of code is new.

**Changed**

- **Structure.** `src/main.js` is split into 13 small modules, still with no build step. Three.js is bundled in `vendor/` instead of loaded from a CDN. Restart is instant (no page reload). The course is data, authored in beats of 14 m.
- **Mountain.** About 1.3 km with real steep pitches: sections alternate between 14 and 53 degrees, with a launch over an icefall. A banked piste replaces the open field.
- **Ride.** Edge-based carving, speed from gravity and drag, a pump when you release a held carve, tuck, brake, kickers, real air and landings. Hands off the keys, the board follows the piste.
- **Camera.** Sits along the slope so steep pitches fall away below you; field of view widens with speed; rolls into carves; dips on landings; pulls in over the shoulder when you draw.
- **Look.** Dusk, afterglow, then night as you descend. Gradient sky with a large sun, layered ridges, dark tree silhouettes, bloom on everything that glows.
- **Powder.** Soft lit spray thrown off the outside edge, one trench with raised rims, landing bursts, speed-line flakes.
- **Bow.** Slow motion while drawing (stronger in the air) on a focus meter, converging reticle, aim magnetism, arrows that fly an arc solved to land on the reticle, glowing trails, hit-stop, PERFECT on core hits, chain reactions between close targets, right click to cancel.
- **Targets.** Sentries that open as you approach, and pacers that fly ahead of you for a few seconds.
- **Ice.** Sheets and walls are pre-fractured into irregular cells. On impact, cracks race out from the hit point and the cells let go in a wave.
- **Score.** Flow multiplier up to x8, rank at the finish.

**Tested**

- `npm run check` passes.
- `npm test` passes: headless Chromium, autopilot rides the whole course in fast-forward, no console errors, run finishes, restart resets.
- Screenshots of every section were reviewed from the headless browser (software rendering, about 7 frames per second).
- **Not tested: a human playing it at full frame rate.** Steering feel, aim difficulty, and performance on a real GPU are unverified. Treat every number in `src/config.js` as a first guess.

**Known issues**

- Sound is a small synthesized set. There is no music, and nothing is synced to the beat grid yet.
- The rider is a simple posed figure; the bow is mostly hidden behind the body when aiming straight ahead.
- Ice shards are flat-coloured; no refraction.
- Desktop only: no touch or gamepad.
- The autopilot scores about 84,000, just under the S rank line (85,000). Rank thresholds are guesses.

**Best next action**

Play five runs and note: is steering too twitchy or too slow, is aiming while carving fair, does the spray read as powder, where does the frame rate drop. Then tune `src/config.js` before adding anything.

---

## v0.1 | 2026-11-14 | ChatGPT

**Implemented:** Original procedurally generated low-poly snow mountain, pine forest, snowboarder, carving controls and jump, following camera, persistent double snow tracks, particle spray and powder streamers, simple mouse-aimed bow with draw/wobble and arrow travel, floating moving targets, translucent ice patches with flying fracture shards, combo scoring, lightweight procedural audio, intro/pause/end UI.

**Checks:** `node --check src/main.js` passed. Full browser gameplay is **not yet verified** because the creation environment could not retrieve Three.js from its CDN. Therefore this is a *source-code prototype* to playtest, not a confirmed bug-free release.

**Known limits:** Ice fractures are approximate radial triangular shards rather than physically based crack propagation; snow deformation is represented by grooves / particles rather than changing terrain mesh; character animation is simplified; browser desktop only.

**Recommended next action:** Run locally, open browser console, fix any runtime failures and tune snow/steering. Do not start adding levels yet.

---

## Template for the next update

Date / AI:

Changed:

Tested (include browser and result):

Known issues:

Best next action:
