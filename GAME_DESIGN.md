# POWDERLINE: game design (the shared creative brief)

## One-sentence pitch

An arcade downhill snowboarding game in a stylized winter forest, combining **deep, responsive powder carving**, **mouse-aimed bow and arrow**, and **delightfully shattering ice**.

## Core creative objective

Make the player want to do *one more run* because the physical sensations are enjoyable. We are prototyping tactile feedback, not simulating an entire mountain. More mechanics are not automatically better.

### Reference points

- The simple, readable, third-person snowboarding of Final Fantasy VII's original minigame. Easy to learn, some inertia, immediate fun.
- Color, motion and geometric visual storytelling reminiscent of Sayonara Wild Hearts, with a clean low-poly language somewhat richer than SUPERHOT.
- Snow should feel like **newly fallen powder** rather than hard-packed white concrete. It drifts, strings out in strands, leaves a soft furrow, and gets thrown outward when carving.
- Ice should break in crunchy, sharp, cascading geometric fragments. Crisp contrast against the softer snow.

*References are for feel only. Make original visuals, audio, models and levels.*

## Core gameplay loop

1. You auto-descend a curving winter slope.
2. A/D carve; W gives a faster run, S brakes. Slope movement is smooth but not slippery to the point of frustration.
3. While riding, use the mouse to aim at enemy drones moving across the track. Hold left mouse to draw. The bow gets stronger but starts wobbling if overdrawn. Release to fire. Hitting while turning/jumping should be rewarding.
4. Break glassy ice surfaces by riding across them or by shooting them. Jump over gaps or onto ice. Reward direct hits and chains.
5. Reach the bottom, see the score, restart instantly. One full run should be about 30 to 60 seconds initially.

## Feel: definition of success

**Snow:** At moderate speed, two narrow imprinted tracks remain behind the snowboard. Turning sends a *fan* of soft snow outward, with small high-velocity puffs and fine ribbons/filaments that linger briefly. Board should drift across a surface with inertia. On landing, a larger snow burst and a muted soft impact. The powder should be visibly disturbed, not behave like sparks.

**Bow:** Simple intuitive mouse aim. Draw over approximately one second. Early release: weaker/slower shot. Full draw: strong shot. Overdraw: oscillating aim. Release produces a convincing twang and an arrow clearly travelling through 3D space. A clean hit pops, shudders or fragments the enemy.

**Ice:** Thin blue surfaces should read differently from snow. Crack lines, glassy depth, big rigid shards, smaller particles, sharp impact sound and tiny camera shake. A shatter moment should be fun to watch even with no enemy/score interaction.

**Camera and readability:** Slightly high third-person chase camera, uncluttered UI, visible slope ahead, clear aim reticle. Camera follows the board smoothly instead of orbiting constantly.

## Art direction

Original low-poly, clean, elegant but not overly abstract. Blue-grey mist, dark petrol-green trees, pale blue snow, turquoise/cyan ice, warm orange enemy silhouettes and skier jacket. Crisp shapes with soft atmospheric distance. Prioritize silhouettes, trails and lighting over high-resolution textures.

## First playable scope

One long procedural mountain; trees, moving enemy targets, 16 ice patches, bow, score and sound. No menus beyond start/pause/end, no multiplayer, inventory, loot, quests, realistic ski bindings or character animation system.

## Future ideas, explicitly not first-version tasks

- Split level into short rhythm sections: forest carving, archery gauntlet, fragile-ice downhill.
- Floating ice rafts over chasms, dynamic breakable jumps and arrow-triggered avalanches.
- Tricks, arrow ricochets, clever enemy movement, score challenges, alternate routes.
- Stronger audio: spatial wind, snow 'shhh', varied ice break, bow tension.
- More realistic snow: vertex deformation / depth map, procedural plumes and curved ribbon meshes.
- Mobile controller support, gamepad, custom levels, playable web link.

## Main design risk

Steering and aiming simultaneously may be too demanding. Keep the start easy. The first playtest should deliberately test this conflict. Do not add extra enemies to hide bad controls.

## Decisions locked for v0.1

- Browser game, vanilla JS, Three.js (not Roblox).
- Desktop-first, one-button mouse archery and A/D snowboarding.
- No purchased assets, no backend, no paid API calls.
- Entire source code is readable/editable in a small folder, portable between Claude and ChatGPT.

## Open decisions

- Should snow be even deeper, allowing slow drift and more pronounced powder banks?
- Should shooting while carving offer automatic slight aim correction?
- Does ice function best as a hazard, a shortcut, or simply an enjoyable destructive object?
- What is the right balance between relaxed flow and reflex challenge?
