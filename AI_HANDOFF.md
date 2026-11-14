# AI handoff: instructions for any coding AI

You are continuing development of **POWDERLINE**, an original browser-based arcade snowboarding + archery + ice-shattering game made by a father and his son, with ChatGPT and Claude alternating as assistants.

## Before doing anything

1. Read `README.md`, `GAME_DESIGN.md`, this `AI_HANDOFF.md`, `CHANGELOG.md` and the *current* `src/main.js`.
2. Use the files that were actually shared most recently. Never assume a change in a prior chat is already present in this working copy.
3. State what works, what is known to be untested, and the smallest change you propose.
4. Make changes in the project files, not just a prose description, when file-editing tools are available.
5. Validate JavaScript syntax (`node --check src/main.js`) and if possible verify the live game in a browser, including console errors.
6. Update `CHANGELOG.md` with exactly what you changed, how you tested it, known issues and a recommended next action.
7. Explain how to transfer the updated files to the other AI session.

## Priorities, in order

1. **Can the game run at all?** Fix runtime errors first.
2. **Does snowboarding feel good?** Tune turning, speed, inertia, visual snow response.
3. **Does the snow feel like powder?** Tracks, soft puffs, stringy thin ribbons, impact and landing.
4. **Does shooting feel satisfying and fair?** Cursor/arrow alignment, draw dynamics, hit feedback.
5. **Does ice feel spectacular when it breaks?** Coherent geometry, crack stages, sound, debris.
6. Only then add levels, characters, menu systems or persistent progression.

Avoid expanding the codebase for minor tasks. Prefer improving existing modules over large refactors. The current code is intentionally vanilla JavaScript and directly imports Three.js from a version-pinned CDN. Do not introduce frameworks, external AI calls or paid assets without an explicit request. If a refactor makes future iteration *substantially* easier, explain why and keep it reversible.

## Critical collaboration workflow

**One editor at a time.** Do not let two sessions concurrently rewrite `src/main.js`. Upload the updated entire folder or use a GitHub repository and commits. Git is strongly encouraged as the record of truth; the handoff docs preserve design reasoning. A GitHub repo is not connected automatically to either chat.

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

- `TUNING` near the top of `src/main.js` centralizes board feel settings.
- Three.js is fetched from a pinned CDN; requires internet and local server.
- Most objects use geometry generated in code, no external models/textures.
- Collision and snow effects are arcade approximations, not a full rigid-body physics engine.
- `R` reloads the game for a clean restart; no save state.
- Static `index.html` can be deployed on GitHub Pages. No secrets required.

## Starting state (2026-11-14)

Prototype source has been written and `node --check` passes. The authoring environment cannot retrieve CDN packages and did not complete an interactive real-browser gameplay test. Verify this first. Do not claim it has been fully playtested until it actually has.
