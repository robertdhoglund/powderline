# POWDERLINE (v0.6)

A browser game: carve down a steep mountain from dusk to dawn, hit jumps and cliff drops, shoot goblins with a bow in slow motion, shatter ice. One run takes about a minute and a half. The goal is **feel first, features second**.

**Tech:** vanilla JavaScript modules + [Three.js](https://threejs.org/) (bundled in `vendor/`, so it works offline). No framework, no build step, no backend.

## Play

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a desktop browser. Do not open `index.html` by double-click; browsers block modules on `file://`.

| Action | Control |
|---|---|
| Carve | `A` / `D` or arrow keys |
| Tuck (faster) / brake | `W` / `S` |
| Jump | `Space` |
| Draw the bow | hold left mouse |
| Shoot | release |
| Slow motion | keep holding past full draw, or hold right mouse or `Shift` |
| Cancel a shot | `Q` |
| Music on or off | `M` |
| Pause / restart | `P` / `R` |

On a phone: left thumb drags to steer (up tucks, down brakes); right thumb holds and drags to aim, releases to shoot, and taps to jump.

Things to know:

- **Carving is the fast line.** Hold an edge, let it go, and the board pumps forward. Gates and tree islands lay out the line.
- **Let go to aim.** With no steering input the board follows the piste by itself.
- **The arrow lands where the reticle points.** It flies a real arc, but the launch is solved for you, with some magnetism near targets. Hitting the glowing core is a PERFECT.
- **Focus** (the ring around the reticle) is the slow motion. Quick shots happen in real time. Hold past full draw to focus; it drains while you do and refills on kills. When it is empty, your aim sways.
- **Goblins throw snowballs** at where you are heading. Carve to dodge.
- **Rank** is goblins hit, gates made and speed. Slow motion costs time.
- **Base camp** is where you pick a mountain and buy upgrades with coins.
- **Spin** by holding a direction in the air.
- **Ice walls** want an arrow. Riding through one costs speed and your flow multiplier, never the run.
- **Flow** multiplies every score and fades if nothing happens. A tree bonk resets it.

## Files

```text
index.html          page shell, HUD markup, import map
src/main.js         boot, input, game modes, frame loop
src/config.js       TUNING: the numbers to tweak for feel
src/levels.js       the four mountains, each a list of sections
src/course.js       turns a level into terrain and features, one recipe per kind of section
src/lobby.js        base camp, upgrades shop, end-of-run scoring
src/upgrades.js     what the shop sells
src/store.js        saved coins, upgrades and best ranks
src/world.js        renderer, bloom, sky, light palette, terrain mesh, trees
src/player.js       carve physics, air and landings, the posed rider, scarf
src/camera.js       chase camera
src/snow.js         powder spray, the trench, speed-line flakes
src/bow.js          draw, focus, aim solve, arrows
src/targets.js      goblins (tower lookouts, balloon goblins, sled raiders) and gates
src/props.js        watchtowers, torches, pennants
src/build.js        small kit for building merged low-poly models
src/ice.js          pre-fractured ice sheets and walls
src/fx.js           debris, shockwaves, ribbons, hit-stop, shake
src/hud.js          score, flow, reticle, screens
src/audio.js        small synthesized sound set (no music yet)
tests/smoke.cjs     autopilot rides the whole run in fast-forward
tools/build-artifact.mjs  packs the game into one HTML file
vendor/three/       Three.js r187 and its bloom passes (MIT)
```

## Tuning and testing

- `src/config.js` holds the feel numbers: speed, turn rate, piste assist, pump, bow draw time, slow-motion strength, camera.
- `src/course.js` holds the level. Change a section's steepness or length, or add a `sentry(...)`, `wall(...)`, `kicker(...)` line.
- `?auto` in the URL turns on the autopilot. `?d=600` starts 600 m down the course. `?level=alps` picks a mountain (`norway`, `japan`, `alps`, `alaska`).
- `npm run check` syntax-checks every module. `npm test` runs the smoke test (needs Playwright: `npm i -D playwright && npx playwright install chromium`).

## Publishing

The folder is a static site. GitHub Pages or any static host works as is. `npm run artifact` also packs the whole game into one file, `dist/powderline.html`.

## Working with more than one AI

The files are the source of truth, not chat memory. Read `GAME_DESIGN.md`, `AI_HANDOFF.md` and `CHANGELOG.md` first, change one thing at a time, and log it in `CHANGELOG.md`.
