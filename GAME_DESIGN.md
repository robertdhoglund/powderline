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

One mountain of about a minute; trees, moving targets, ice sheets and walls, bow, score and sound. No menus beyond start/pause/end, no multiplayer, inventory, loot, quests, realistic ski bindings or character animation system.

## Future ideas, explicitly not first-version tasks

- Split level into short rhythm sections: forest carving, archery gauntlet, fragile-ice downhill.
- Floating ice rafts over chasms, dynamic breakable jumps and arrow-triggered avalanches.
- Tricks, arrow ricochets, clever enemy movement, score challenges, alternate routes.
- Stronger audio: spatial wind, snow 'shhh', varied ice break, bow tension.
- More realistic snow: vertex deformation / depth map, procedural plumes and curved ribbon meshes.
- Mobile controller support, gamepad, custom levels, playable web link.

## Main design risk

Steering and aiming simultaneously may be too demanding. Keep the start easy. The first playtest should deliberately test this conflict. Do not add extra enemies to hide bad controls.

## Decisions locked

- Browser game, vanilla JS, Three.js (not Roblox).
- Desktop-first, one-button mouse archery and A/D snowboarding.
- No purchased assets, no backend, no paid API calls.
- Source is small readable modules, portable between Claude and ChatGPT.

## Decisions made in v0.2

- **Palette.** Dusk to night with glowing accents replaces the daylight pastel. Coral jacket, magenta scarf, amber targets, cyan ice. The contrast is what makes the rest read.
- **Steepness.** The mountain alternates mellow benches with pitches of 45 degrees and more. The camera sits along the slope so the drop is visible.
- **Bow reference: Horizon Zero Dawn.** Time slows while drawing, more in the air, on a limited focus meter. The arrow flies an arc but lands where the reticle points. Core hits are rewarded.
- **Aim help: yes.** Magnetism near targets, and the board follows the piste when you let go of steering. This is the answer to the main design risk below.
- **Ice is both.** Sheets are a speed boost to ride across; walls are an obstacle to shoot. Neither can end the run.
- **Fail-soft.** Trees, walls and misses cost speed and flow, never the run.
- **Beat grid.** The course is authored in beats of 14 m so a later music track can sync to it.

## Decisions made in v0.4

- **Targets are goblins** (Kasper's call): tower lookouts, lantern-balloon goblins, sled raiders.
- **The hero is an original ranger-archer.** Inspired by classic adventure heroes, but not a copy of any one of them.
- **The course turns.** Each section has its own turn strength, steepness and width.

## Decisions made in v0.5 and v0.6

- **Rank is goblins, gates and speed.** A is meant to be hard.
- **Slow motion is opt-in.** Quick shots are real time; you hold to focus. Slowing every shot broke the flow.
- **Progression.** Coins, upgrades and four mountains with their own scenery, light and layout.
- **Fail-soft still holds.** Snowballs cost speed and flow, never the run.

## Art direction since v0.11

Graphic and luminous, in the spirit of Sayonara Wild Hearts but with our own shapes and palette:

- **Shape first.** Faceted trees and rocks, clean lofted volumes for characters. No surface textures.
- **Three tones of light.** Shadow, mid and lit, with soft edges. A rim of sun colour on every silhouette.
- **Detail is light.** Trim, eyes, lanterns and trails glow; bloom carries them. Nothing is detailed with texture.
- **Colour comes from the mountain.** Each level's palette drives sky, snow, rim light and fog. Accents are magenta and cyan.
- **The hero** is a moonlit ranger of our own design: the classic adventurer's outline (tunic, pointed ears, bow, quiver) in violet, with a white mane and glowing trim. Not green, not red. Since v0.12 he is a modelled, skinned character (`src/hero.js`), not an assembly of primitives; anything that stands next to him should be built to that standard.
- **Motion draws lines.** Scarves, hair and board trails are ribbons; the trails change colour with flow.

The physically based look of v0.10 and the flat ink look of v0.9 were both dropped.

## Deferred on purpose

Longer and additional levels, music and richer sound, tricks, touch and gamepad controls.

## Open decisions

- How twitchy should carving be? (`turnRate`, `edgeIn`, `assist` in `src/config.js`)
- How strong should slow motion be, and how fast should focus drain?
- Should the powder be thicker, with deeper trenches and bigger plumes?
- What is the right balance between relaxed flow and reflex challenge?
