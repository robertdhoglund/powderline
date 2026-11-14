# AI handoff: instructions for any coding AI

You are continuing development of **POWDERLINE**, an original browser-based arcade snowboarding + archery + ice-shattering game made by a father and his son, with ChatGPT and Claude alternating as assistants.

## Before doing anything

1. Read `README.md`, `GAME_DESIGN.md`, this `AI_HANDOFF.md`, `CHANGELOG.md` and the *current* `src/main.js`.
2. Use the files that were actually shared most recently. Never assume a change in a prior chat is already present in this working copy.
3. State what works, what is known to be untested, and the smallest change you propose.
4. Make changes in the project files, not just a prose description, when file-editing tools are available.
5. Run `npm run check` and `npm test`, and if possible verify the live game in a browser, including console errors.
6. Update `CHANGELOG.md` with exactly what you changed, how you tested it, known issues and a recommended next action.
7. Explain how to transfer the updated files to the other AI session.

## Priorities, in order

1. **Can the game run at all?** Fix runtime errors first.
2. **Does snowboarding feel good?** Tune turning, speed, inertia, visual snow response.
3. **Does the snow feel like powder?** Tracks, soft puffs, stringy thin ribbons, impact and landing.
4. **Does shooting feel satisfying and fair?** Cursor/arrow alignment, draw dynamics, hit feedback.
5. **Does ice feel spectacular when it breaks?** Coherent geometry, crack stages, sound, debris.
6. Only then add levels, characters, menu systems or persistent progression.

Avoid expanding the codebase for minor tasks. Prefer improving existing modules over large refactors. The code is intentionally vanilla JavaScript modules with Three.js bundled in `vendor/`. Do not introduce frameworks, external AI calls or paid assets without an explicit request. If a refactor makes future iteration *substantially* easier, explain why and keep it reversible.

## Critical collaboration workflow

**One editor at a time.** Do not let two sessions concurrently rewrite the same file. Upload the updated entire folder or use a GitHub repository and commits. Git is strongly encouraged as the record of truth; the handoff docs preserve design reasoning. A GitHub repo is not connected automatically to either chat.

When asking the other AI for help, include a new instruction such as:

> Read this project's README.md, GAME_DESIGN.md, AI_HANDOFF.md, CHANGELOG.md and current source. Continue from the **current files**, not from memory. First run the game and fix any errors. Then make one focused improvement to [specified mechanic]. Keep it playable, run checks, update CHANGELOG.md and return the changed files.

## What to collect after a playtest

- Controls feel too floaty / too twitchy / about right?
- Is carving visibly throwing powder outward?
- Do the streamers feel like snow instead of smoke or laser lines?
- Are targets aimable while steering? Which shots feel unfair?
- Does ice fragmentation feel like thin cracking ice or like exploding glass?
- Any visible errors in the browser developer console? Any lag or frame drops?

## Technical notes

- `src/config.js` holds the feel numbers. `src/course.js` holds the level as data, in beats.
- Each system is one module in `src/` (see the file map in `README.md`). Modules share state through `G` in `src/state.js` and the rider through `P` in `src/player.js`.
- Every module has an `update...` and a `reset...` function. Restart calls every reset; nothing reloads the page.
- `step(rdt)` in `src/main.js` is one tick of game logic with no rendering. `window.__pl.sim(seconds)` fast-forwards it; the smoke test uses this.
- Three.js r187 is bundled in `vendor/three/`. No internet needed.
- Colours brighter than 1.0 are deliberate: only those bloom.
- Debug URL flags: `?auto` (autopilot), `?d=600` (start 600 m down).
- `npm run check` and `npm test` before every commit.

## State (2026-11-14, v0.2)

Verified in headless Chromium: loads with no console errors, the autopilot completes the run, restart works. **Not yet played by a human at full frame rate.** Do not claim the feel is tuned until someone has played it.
