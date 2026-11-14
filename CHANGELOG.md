# Changes and handoffs

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
