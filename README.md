# POWDERLINE (prototype 0.1)

A small, playable browser experiment: carve through powder, fire arrows at moving targets, and shatter thin ice. The goal is **feel first, features second**.

**Tech:** vanilla JavaScript + [Three.js](https://threejs.org/). No React, no game engine editor, no backend, no build step, no paid services. Three.js is loaded from a pinned public CDN on page load. You need an internet connection to retrieve it.

## Play it on your computer

1. Unzip the project folder.
2. Open Terminal (Mac) or PowerShell (Windows) in the `powderline-game` folder.
3. Start a tiny local web server:

   **Mac / Linux (with Python installed):**
   ```bash
   python3 -m http.server 8000
   ```
   **Windows (with Python installed):**
   ```powershell
   py -m http.server 8000
   ```
   **Alternative, if you have Node.js instead:**
   ```bash
   npx serve .
   ```
4. Visit `http://localhost:8000` in a desktop browser (or use the local address printed by `npx serve`).
5. Click **Start run**. Your browser needs internet for Three.js to load. First audio starts only after you click Start.

**Important:** don't double-click `index.html` and use `file://`: browser module security rules can prevent the game from loading. Use a local server.

### Controls

| Action | Control |
|---|---|
| Carve left/right | `A` / `D` or arrow keys |
| Accelerate / brake | `W` / `S` |
| Jump | `Space` |
| Aim bow | Mouse movement |
| Draw / shoot | Hold / release left mouse button |
| Pause / resume | `P` / start button |
| Restart the course | `R` |

A short draw makes a weak shot; a long draw increases arrow speed. Hold too long and the aim wobbles. Snow spray intensifies when carving. Ice breaks if you ride across it (while grounded) or hit it with an arrow.

## What is already implemented?

- [x] Curving downhill snowy terrain and low-poly evergreen forest
- [x] Third-person snowboarder with inertia, carving, braking, acceleration and jumping
- [x] Persistent two-track board grooves, powder spray, windblown snow streamers
- [x] Mouse-controlled charging bow, moving enemies, arrows with flight/drop and hits
- [x] Glowing blue ice patches that fracture into flying mesh fragments
- [x] Scoring, combos, restart, pause and simple synthesized sound
- [ ] Extensive playtesting and tuning of board feel
- [ ] Robust collision / proper ragdoll / board tricks
- [ ] Mobile controls, multiple levels, saved high scores, multiplayer

## File map

```text
powderline-game/
├── index.html          Intro screen, HUD and Three.js import map
├── src/
│   ├── main.js         Entire playable prototype, split by labelled sections
│   └── style.css       Menus, crosshair and HUD
├── GAME_DESIGN.md      Vision, priorities and mechanics specification
├── AI_HANDOFF.md       Shared instructions for Claude and ChatGPT
├── CHANGELOG.md        Change history; both AIs should update this
├── TEST_CHECKLIST.md   What to verify in a real browser
└── README.md           This file
```

## Iterating with ChatGPT + Claude

**The files, not chat memory, are the source of truth.** Put this folder in a GitHub repository if possible, so that both AIs can work from exactly the same version. Upload the current project zip/files in either chat or use a local coding agent that can access the folder.

1. Before editing, ask the AI to read `README.md`, `GAME_DESIGN.md`, `AI_HANDOFF.md` and `CHANGELOG.md`.
2. Have **one AI implement one narrowly scoped change**. Don't edit the same file in two AI sessions at once.
3. Run the game, describe what *feels* wrong or right. A short gameplay recording helps more than speculative features.
4. Have that AI update `CHANGELOG.md` with changes, known issues and the exact next step.
5. Commit the working version to Git or make a new zip before handing it to the other AI.
6. Next AI first examines the *latest actual files*, not an older chat or the original zip.

Suggested first experiments: compare slow vs snappy turns, tune the balance of powder spray and visible track grooves, then refine impact sound / ice shards. Resist adding more systems before the basic loop is compelling.

### Quick tuning

Open `src/main.js` and look for `const TUNING` at the top. Adjustable values include `baseSpeed`, `maxSpeed`, `steerAcceleration`, `sidewaysDrag`, `jumpImpulse`, `snowSpray` and `cameraSmoothing`.

### Publishing for someone else to play

The entire folder can be published on **GitHub Pages** or any static website host. This project has no server-side state. Do not upload credentials. If you later remove the CDN dependency and bundle Three.js locally, the host can be fully self-contained.

## Validation status

The JavaScript passed Node's syntax check. This environment could not retrieve the Three.js CDN package, so I **could not complete a real browser gameplay test** here. The first follow-up task is to start it in a browser, check the console, and fix any runtime errors. Treat this as an implemented first prototype, not a verified polished release.

## References

- [Three.js official installation guide](https://threejs.org/manual/pages/installation.html)
- [Three.js site](https://threejs.org/)
