# Soul Ember: 30-Day Master Development & Feature Roadmap

## Overview & Vision
This document outlines the **30-Day Day-by-Day Master Plan** for *Soul Ember — The Last Light*. It is engineered to transform Soul Ember from an intense browser roguelite into a benchmark-grade, deeply replayable action-survivor masterpiece.

The roadmap addresses every core pillar:
1. **Fluid Combat & Responsive Controls**: Controller support, hit-stop, telegraph visualizers, dynamic collision recovery.
2. **Enemy Ecosystem & Elite Affixes**: Roster expansion from 18 to 24 monsters, dynamic champion affixes, intelligent flanking swarms.
3. **Hero Synergies & Weapon Evolution**: Dual-elemental reaction bursts, weapon morphing, fourth mastery tier.
4. **World Expansion & The Void Citadel**: Introducing Biome 4 (*The Void Citadel*), a multi-phase Arch-Guardian (*The Eclipse Sovereign*), and diverse room events.
5. **Addictive Roguelite Metagame**: Refined Armory progression, set relics, daily challenge seeds, and long-session stability.

```
                    30-DAY DEVELOPMENT SPRINT ARCHITECTURE
┌──────────────────────────┬──────────────────────────┬──────────────────────────┐
│  WEEK 1: DAYS 1 - 6      │  WEEK 2: DAYS 7 - 12     │  WEEK 3: DAYS 13 - 18    │
│  Combat Feel, Controls & │  Elite Affixes, New      │  Hero Synergies, Weapon  │
│  Lethality Hardening     │  Monsters & Special Rooms│  Morphing & Combos       │
├──────────────────────────┼──────────────────────────┼──────────────────────────┤
│  WEEK 4: DAYS 19 - 24    │  WEEK 5: DAYS 25 - 30    │  MILESTONE GATES         │
│  Biome 4: Void Citadel & │  VFX/SFX Overhaul, PWA,  │  Continuous Automated    │
│  The Eclipse Sovereign   │  60m Stability & Launch  │  CDP Testing & Builds    │
└──────────────────────────┴──────────────────────────┴──────────────────────────┘
```

---

## Week 1: Combat Depth, Responsive Controls & Engine Hardening (Days 1–6)

### Day 1: Native Gamepad API & Responsive Controller Support
- **Goal**: Enable full console-grade controller support (Xbox, PlayStation, Generic Bluetooth controllers) alongside keyboard and touch controls.
- **Features to Add**:
  - Implement `Input.pollGamepad()` inside `main.js`: Left stick for analog directional movement, Right stick for manual aiming direction.
  - Button mapping: `A` / Cross for Dodge, `X` / Square for Skill Q, `Y` / Triangle for Skill E, `B` / Circle for Signature Ultimate, `LB`/`L1` for Build/Armory, `Start` for Pause.
  - Add dynamic HUD prompts switching between Keyboard keys (`WASD / Q / E / Space`) and Gamepad icons based on the last active input device.
- **Bug Fixes & Hardening**:
  - Fix phantom stick drift by applying a `0.18` deadzone clamp on analog stick inputs.
  - Prevent duplicate trigger events when a key and controller button are pressed simultaneously.
- **Files Touched**: `soul-ember/src/rebuild/input.js`, `soul-ember/src/rebuild/main.js`, `soul-ember/src/rebuild/style.css`.
- **Verification**: Connect simulated virtual gamepad via CDP `Input.dispatchKeyEvent` and verify fluid 360-degree strafing and skill execution.

---

### Day 2: Combat Impact, Hit-Stop & Camera Shake Tuning
- **Goal**: Give weapon strikes, finishers, and heavy impacts visceral weight without causing visual disorientation.
- **Features to Add**:
  - Micro Hit-Stop (`timeScale` freeze): Introduce a brief 35ms micro-freeze on finisher hits, critical strikes, and guard breaks.
  - Directional Camera Impulse: Translate the camera by `0.15` units in the direction of heavy strikes for 80ms, decaying smoothly via spring physics.
  - Flash Overlay: Brief chromatic aberration flash on critical finisher impacts.
- **Bug Fixes & Hardening**:
  - Prevent camera shake trauma from accumulating to infinity during dense horde attacks (clamp `this.trauma` strictly between `0` and `1.2`).
  - Fix camera viewport jitter when the player is moving against diagonal wall corners.
- **Files Touched**: `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/scene.js`.
- **Verification**: Record 60 FPS frame telemetry ensuring frame pacing remains smooth during 20+ enemy simultaneous cleaves.

---

### Day 3: Advanced Telegraph Warning Visualizers
- **Goal**: Make dangerous elite and boss attacks instantly readable so deaths feel fair and avoidable.
- **Features to Add**:
  - Runic Ground Decals: Replace standard round warning circles with glowing runic glyph rings that fill inward as the windup progresses.
  - Directional Attack Cones: For cleaves and breath attacks (e.g., Gargoyle Dive, Shield Rush), project a 45-degree ground decal showing the exact hit sector.
  - Charging Vector Arrows: Display a high-contrast pulsing arrow along the charge path for Ember Hounds and Warden Charges.
- **Bug Fixes & Hardening**:
  - Fix decal z-fighting with floor tile geometry by elevating decal meshes to `y = 0.035` with polygon offset enabled.
  - Remove orphaned warning indicators if an enemy is slain during its windup phase.
- **Files Touched**: `soul-ember/src/rebuild/scene.js`, `soul-ember/src/rebuild/game.js`.
- **Verification**: Inspect warning decals on 18 enemy attack types ensuring decal scales match the underlying collision radius.

---

### Day 4: Dynamic Soft-Separation & Anti-Clumping Flocking
- **Goal**: Prevent enemies from stacking into a single composite sprite while keeping horde pressure relentless.
- **Features to Add**:
  - Boids/Flocking Soft-Separation: Add pairwise repelling force between nearby enemies (`dist < e.radius + o.radius`) in `game.js:129`.
  - Surround Encirclement Arc: Enemies assign themselves an offset angle based on `(enemy.id % 8) * (Math.PI / 4)` to encircle the player like a wolf pack rather than marching in a straight conga line.
- **Bug Fixes & Hardening**:
  - Fix enemies occasionally popping through wall boundaries when pushed by adjacent enemies during dense pack spawns.
  - Clamp flocking separation velocity so enemies cannot be launched out of chamber doors.
- **Files Touched**: `soul-ember/src/rebuild/game.js`.
- **Verification**: Spawn 30 enemies in central cathedral; verify they form a dynamic surrounding circle without clipping inside one another.

---

### Day 5: Enhanced Boss Phase Transformations & Audio Stings `[COMPLETED - NOV 27, 2026]`
- **Goal**: Turn the 3 Guardian encounters (Abbot of Ash, Drowned Warden, Thornbound Regent) into memorable multi-phase spectacles.
- **Features Implemented**:
  - Phase 2 & 3 Arena Alterations:
    - **Abbot of Ash**: Braziers flare azure blue fire (`0x2288ff`) in Phase 2 and necrotic violet (`0xaa22ff`) in Phase 3; 4 inner sanctuary dais tiles activate periodic flame vents.
    - **Drowned Warden**: Cathedral floor floods with shallow water ripples (`opacity: 0.63`); rotating whirlpool foam rings and physical ambient currents drag player inward.
    - **Thornbound Regent**: 24 perimeter briar roots sprout from floor (`scaleY: 1.6`), narrowing effective combat circle (constricting player to `r <= 9.8m`) and inflicting thorn contact damage.
  - Guardian Entrance Stinger: Procedural cathedral organ and low brass chord progression in Web Audio API synthesis on boss awakening and ascending fanfare on phase shift.
- **Bug Fixes & Hardening**:
  - Immediately purges all persistent ground hazard zones, enemy projectiles, and warning decals upon boss phase shift to prevent unfair damage.
  - Fixed boss health bar rendering glitch: smooth CSS interpolation, phase notch indicators at 65% and 30%, dynamic phase badge (`PHASE 1/2/3`), and phase-shift flare pulse.
- **Verification**: 115/115 unit tests passing (`npm test`), full automated headless Chrome CDP playtest verified live with screenshots (`day5-abbot-phase2-azure-vents.png`, `day5-abbot-phase3-violet-flame.png`, `day5-warden-phase2-flooded-whirlpools.png`, `day5-regent-phase3-briar-barrier.png`).
- **Files Touched**: `soul-ember/src/rebuild/dungeon-view.js`, `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/main.js`, `soul-ember/src/rebuild/style.css`, `soul-ember/index.html`, `soul-ember/src/core/AudioSynth.js`, `soul-ember/test/rebuild.test.js`.
- **Commit**: `8b1d0f9` (pushed to `origin/main`).

---

### Day 6: Week 1 Integration, Performance Profiling & Mobile Polish `[COMPLETED - NOV 28, 2026]`
- **Goal**: Consolidate Week 1 features, audit memory usage, and verify mobile frame rate stability (Milestone Gate 1).
- **Features Implemented**:
  - **Dynamic Resolution Scaler (DRS)** (`scene.js`):
    - Smoothly steps down pixel ratio by `-0.15` if frame time exceeds `18.5ms` (<54 FPS) for 3 consecutive frames, clamping at `1.0` (or `0.85` on mobile/low-power devices).
    - Smoothly steps resolution back up by `+0.10` toward `maxDpr` if frame time stays below `14.5ms` (>68 FPS) for 60 consecutive frames.
    - Zero quality jumps or hitching; automatic fallback disables shadow maps if prolonged sluggishness is detected.
  - **Virtual Touch Joystick Polish & Mobile Recenter-on-Touch** (`input.js` & `style.css`):
    - Dynamic recenter-on-touch: Touching anywhere in the left movement zone (`clientX < window.innerWidth * 0.48 && clientY > window.innerHeight * 0.25`) immediately snaps `#stick` origin under the thumb with `.active` glowing styling.
    - Deadzone & throw curves: Strict `0.15` deadzone filtering (<7.2px throw outputs zero) with smooth quadratic acceleration curve up to `48px` max throw radius (`Input.processStickVector`).
    - Multi-touch lifecycle isolation: Right-side action button taps (`dash`, `skill`, `ultimate`) operate on distinct pointer lifecycles without interrupting or resetting active joystick locomotion.
- **Milestone Gate 1 Verification**:
  - **128/128 tests passing (100% pass rate)** in `npm test` across Dead Signal, Road Riot, and Soul Ember.
  - Headless Chrome CDP mobile emulation test (`390x844` iPhone viewport, touch emulation active) verifying:
    - Joystick recentering to touch coordinates (`left: 115px, top: 620px`).
    - Upward thumb throw producing `-24.8px` nub displacement and `-0.78` forward velocity vector.
    - Simultaneous right-thumb dodge tapping without disrupting joystick active state.
    - DRS live step-down from `1.10` to `0.95` and recovery to `1.05`.
    - Zero memory leaks (stable `31MB` heap during continuous 3D gameplay).
    - Screenshot captured: [day6-mobile-joystick-gate1.png](file:///C:/Users/nagas/.gemini/antigravity/brain/c814158f-61ed-4557-8d27-fa15ecf9161b/day6-mobile-joystick-gate1.png).
- **Files Touched**: `soul-ember/src/rebuild/scene.js`, `soul-ember/src/rebuild/input.js`, `soul-ember/src/rebuild/style.css`, `soul-ember/src/rebuild/main.js`, `soul-ember/test/rebuild.test.js`.
- **Milestone Gate 1 Status**: **PASSED** (Week 1 Core Polish complete).

---

## Week 2: Expanded Enemy Ecosystem, Elite Affixes & Dynamic Rooms (Days 7–12)

### Day 7: Elite Champion Affix Engine
- **Status**: **COMPLETED** (Commit `19bd2a7`, pushed to `main`)
- **Goal**: Introduce unpredictable elite champion variants with unique tactical behaviors.
- **Features Implemented**:
  - **Affix Registry (`CHAMPION_AFFIXES` & `AFFIX_KEYS` in `content.js`)**:
    1. **Molten** (`0xff4411`): Scorching flame hazard trail behind path while moving (`trailTimer`, burning contact zones).
    2. **Vortex** (`0xa855f7`): Pulses gravity well pulling player within 8.5m every 3.5s; strictly respects player dash invulnerability (`player.dash > 0`).
    3. **Frostbound** (`0x38bdf8`): Pulses telegraphed frost nova every 4.0s (0.8s warning at 3.2s) dealing damage and applying `p.chill = 2.5` (slowing player speed and stamina recovery); evadable via dash.
    4. **Shielded** (`0xfacc15`): Rotating kinetic barrier arc at `barrierAngle` deflecting frontal strikes within $\pm 60^\circ$ by 88% while taking full unmitigated flank/rear damage.
    5. **Avenger** (`0xef4444`): Enrages when non-elite minions perish within 8.5m, gaining up to 3 stacks of `affixStacks` with stacking movement speed (+25%/stack), contact/attack damage (+25%/stack), and attack cooldown recovery (+35%/stack).
  - **3D Visual Identifiers in `scene.js`**:
    - Hovering runic corona meshes (`geo.decalRing` + `geo.decalInnerGlyph`) positioned above each champion's head rendered in affix color with floating bob.
    - Kinetic barrier arc mesh (`geo.decalConeArc`) positioned at `barrierAngle` for `shielded` champions.
    - Dynamic corona scale expansion (`1 + affixStacks * 0.3`) for `avenger` champions.
- **Bug Fixes & Hardening**:
  - Fixed vortex dash velocity interaction to guarantee player dash invulnerability cancels gravity inward pull without arresting forward locomotion.
  - Hardened avenger enrage radius to non-elite minion deaths only (prevents elite chain-enrages).
  - Ensured shielded barrier deflection calculates relative attack vector angles modulo $\pi$ to prevent edge-case angular wrap misses.
- **Verification Results**:
  - 6 dedicated unit tests added to `soul-ember/test/rebuild.test.js`; 138/138 tests passing across all 3 arcade engines with zero regressions.
  - Headless Chrome CDP playtest in `scratch/test_day7_playtest.mjs` verified:
    - All 5 champion affixes active simultaneously in arena formation.
    - Avenger minion kill trigger with stacking rage up to cap 3.
    - Three.js scene graph containing all 5 runic coronas and visible shield arc.
    - Shielded kinetic barrier 88% frontal deflection (0.86 frontal vs 7.2 rear damage).
    - Performance: DRS level 1.0, 24MB heap memory, 0 JS uncaught exceptions.
    - Screenshot captured: [day7-champion-affixes.png](file:///C:/Users/nagas/.gemini/antigravity/brain/c814158f-61ed-4557-8d27-fa15ecf9161b/day7-champion-affixes.png).
- **Files Touched**: `soul-ember/src/rebuild/content.js`, `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/scene.js`, `soul-ember/test/rebuild.test.js`, `soul-ember/dist/`.

---

### Day 8: Biome 1 Monster Expansion (Obsidian Golem & Pyre Priest)
- **Status**: **COMPLETED** (Commit `a6e87e5`, pushed to `main`)
- **Goal**: Expand Ashen Cathedral monster variety from 6 to 8 types.
- **New Monsters Implemented**:
  - **Obsidian Golem** (`golem`): Heavy armored tank (380 HP, 1.55 speed, 0.65 collision radius). Features directional armor deflecting 92% of frontal auto-attacks within $\pm 75^\circ$; flanked rear strikes and heavy skills/finishers penetrate full unmitigated damage. Executes `golem-slam` (earthquake ground pound) emitting radial seismic bolts, 4.2m ground collapse zone, and 0.28 camera trauma.
  - **Pyre Priest** (`priest`): Sacred backline support (110 HP, 2.3 speed). Channels `priest-heal` restoring +45 HP to the most wounded nearby ally within 8m accompanied by golden visual beams. Lobs `priest-wisp` homing dual-flame projectiles that leave scorching ground hazards.
- **3D Procedural Models & Audio Cues**:
  - Procedural low-poly 3D models in `model-catalog.js` & `scene.js`:
    - Golem: 1.48 scale dark obsidian stone mesh with horn headgear, stone fist gauntlets, and molten magma gems on chest.
    - Priest: 1.06 scale crimson/gold robes with sacred mitre headgear, swinging pyre censer, and floating golden halo.
  - Procedural Web Audio API cues in `AudioSynth.js`:
    - Golem slam: Deep sub-bass seismic ground rumble (45Hz sawtooth slide with 150Hz rumbling noise).
    - Priest chant/wisp: Ethereal sacred chime (523Hz triangle slide with 784Hz sine harmonic overtone).
- **Verification Results**:
  - Unit tests updated to verify 20 non-boss monsters, 3 bosses, 8 heroes, and 20 distinct attack profiles; 157/157 tests passing across the workspace.
  - Headless Chrome CDP playtest in `scratch/test_day8_playtest.mjs` verified:
    - 92% frontal weapon deflection on Obsidian Golem (5.76 frontal vs 72 rear damage dealt).
    - Golem earthquake slam producing ground collapse zone, 8 radial bolts, and camera trauma.
    - Pyre Priest healing channel restoring +32.3 HP to wounded ally with `priestHeal` event.
    - Pyre Priest flame wisps emitting 2 flame bolts and burning ground hazard.
    - Live Three.js scene graph containing active golem and priest meshes.
    - Performance: 60 FPS (DRS level 1.0), 22MB heap memory, 0 runtime exceptions.
    - Screenshot captured: [day8-biome1-monsters.png](file:///C:/Users/nagas/.gemini/antigravity/brain/c814158f-61ed-4557-8d27-fa15ecf9161b/day8-biome1-monsters.png).
- **Files Touched**: `soul-ember/src/rebuild/roster.js`, `soul-ember/src/rebuild/model-catalog.js`, `soul-ember/src/rebuild/combat-content.js`, `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/scene.js`, `soul-ember/src/core/AudioSynth.js`, `soul-ember/index.html`, `soul-ember/test/rebuild.test.js`, `soul-ember/dist/`.

---

### Day 9: Biome 2 Monster Expansion (Abyssal Siren & Barnacle Hulk) — COMPLETED ✓
- **Goal**: Deepen tactical variety in the Drowned Catacombs with evasive ranged phantoms and absorbing heavy tanks.
- **Implemented Monsters**:
  - **Abyssal Siren** (`siren`):
    - Roster profile: 135 HP, 2.6 speed, `ranged` behavior, 6 XP.
    - Procedural 3D model: Turquoise aquatic robes (`0x336b69` / `0x1d3d3c`), drowned coral head, ornate hand lantern, flowing cape, floating hovering elevation (y = 0.25m with sine wave bobbing).
    - Teleport Escape: When the player approaches within 3.4m, the Siren teleports 5–8m away to an open non-solid tile with a cyan water burst (`0x22eedd`), engaging a 3.5s cooldown (`e.teleportCooldown = 3.5`) and emitting `sirenTeleport`.
    - `siren-scream`: 7.5m 60° sonic cone dealing 18 base damage, applying movement disorient (`p.disorient = 1.2`, 40% slow + drag) and chill (`p.chill = 2.0`). Hardened with a 4.0s immunity grace (`p.screamImmune = 4.0`) strictly preventing consecutive stun-locking.
    - `siren-bolt`: Twin high-speed aqua tide bolts.
  - **Barnacle Hulk** (`hulk`):
    - Roster profile: 420 HP, 1.7 speed, `chase` behavior, 8 XP, 0.65m heavy collision radius.
    - Procedural 3D model: Deep encrusted barnacle armor (`0x2d3a3d` / `0x182426`), heavy brute physique, rust greatsword, scale dynamically tied to absorbed hits (`Math.min(1.8, 1.0 + (growth || 0) * 0.1)`).
    - Projectile & Auto-Attack Absorption: Light attacks deal 45% reduced damage (`amount *= 0.55`) and stack growth counters (`e.growth = Math.min(8, e.growth + 1)`).
    - Finisher Rupture & Stagger: Heavy strikes (`finisher`, `signature`, `skill`, `defense`) break through shell armor for 1.5x empowered damage, shattering growth back to 0 and staggering/freezing the Hulk for 1.2s (`e.freeze = 1.2`).
    - `hulk-slam`: 4.2m tidal slam dealing `28 * (1 + growth * 0.1)` damage, creating a 3.8m whirlpool zone and camera screen trauma.
- **Visual & Audio FX**:
  - Procedural Web Audio API sound synthesis:
    - `hulk-slam`: 70Hz sawtooth sub-impact with 180Hz water splash noise.
    - `siren-scream`: Dual-tone vocal sine sweep (880Hz sliding to 1320Hz overtone).
    - `siren-bolt`: 680Hz triangle wave with 1400Hz aqua froth noise.
    - `sirenTeleport`: 960Hz sine slide with 1600Hz splash noise.
- **Verification Results**:
  - Unit tests updated to verify 22 non-boss monsters, 3 bosses, 22 attack profiles, and 8 regional monsters in Drowned Catacombs; 171/171 workspace tests passing (100%).
  - Headless Chrome CDP playtest in `scratch/test_day9_playtest.mjs` verified:
    - Hulk absorption: 11 damage taken from 20 light attack, growth stacked to 8.
    - Hulk finisher rupture: 60 damage from 40 base finisher (1.5x), growth shattered to 0, freeze duration 1.2s.
    - Hulk slam: 0.488 screen trauma and active whirlpool hazard zone.
    - Siren teleport escape: triggered at 2.0m proximity, escaped to 8.06m distance, engaging 3.5s cooldown and emitting `sirenTeleport`.
    - Siren scream: applied `disorient: 1.2`, `chill: 2.0`, `screamImmune: 4.0`, blocking consecutive stun lock.
    - Live Three.js WebGL scene with active Siren and Hulk meshes, whirlpool zone, and tide bolt.
    - Performance: 60 FPS (DRS level 1.0), zero console exceptions.
    - Screenshot captured: [day9-biome2-monsters.png](file:///C:/Users/nagas/.gemini/antigravity/brain/c814158f-61ed-4557-8d27-fa15ecf9161b/day9-biome2-monsters.png).
- **Files Touched**: `soul-ember/src/rebuild/roster.js`, `soul-ember/src/rebuild/model-catalog.js`, `soul-ember/src/rebuild/combat-content.js`, `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/scene.js`, `soul-ember/src/core/AudioSynth.js`, `soul-ember/test/rebuild.test.js`, `soul-ember/dist/`.

---

### Day 10: Biome 3 Monster Expansion (Bramble Shifter & Spore Weaver) — ✓ COMPLETED
- **Goal**: Introduce ambush and zoning mechanics to the Thornbound Ossuary (Biome 2, `region === 2`).
- **New Monsters**:
  - **Bramble Shifter (`shifter`)**:
    - 150 HP, 3.8 speed, `ambush` behavior, 6 XP yield, Biome 2.
    - Procedural 3D model in `model-catalog.js`: Briar hound predator (`kind: 'hound', primary: 0x3f4f2c, secondary: 0x1f2b16, scale: 1.12`).
    - Subterranean dormancy: Spawns camouflaged underground (`burrowed: true`, $y = -0.42\text{m}$, scale $0.5$ dormant briar clump). Smart auto-targeting ignores burrowed enemies.
    - Proximity unburrow: Explodes out of the ground with thorn eruption (`0x84cc16`) when the player approaches within $\le 3.2\text{m}$, dealing 18 base damage if player is within $2.4\text{m}$, emitting `shifterUnburrow`, and initiating `shifter-lunge` (5.5m charge).
    - Hardening: 15.0s auto-unburrow timeout so waves never stall even if the player avoids approaching.
    - Additional attack: `shifter-burst` (3.6m radial root bolts).
  - **Spore Weaver (`weaver`)**:
    - 95 HP, 2.4 speed, `ranged` behavior, 6 XP yield, Biome 2.
    - Procedural 3D model in `model-catalog.js`: Floating toxic arachnid (`kind: 'spider', primary: 0x4d5e2e, secondary: 0x222d16, scale: 1.06`, elevation $y = 0.35\text{m}$ with sine bobbing).
    - Sticky web tripwires: `weaver-web` places sticky tripwire zones (`kind: 'tripwire'`) with a clean 12.0s lifespan (`life: 12.0`). Stepping on it slows player movement by $50\%$ (`p.vx *= 0.5, p.vz *= 0.5`), applies toxic chill (`p.chill = 1.8`), deals 12 damage, and emits `tripwireTrigger`.
    - Hardening: Cap active tripwires strictly to $\le 6$ to prevent corridor congestion.
    - Spore cluster: `weaver-spore` shoots projectile exploding into a 2.6m toxic miasma cloud.
- **Visual & Audio FX**:
  - Procedural Web Audio API sound synthesis:
    - `shifterUnburrow`: 55Hz sub rumble + wood snap.
    - `shifter` lunge: 90Hz sawtooth whip.
    - `weaver-web`: 480Hz silk hiss with 2200Hz white noise.
    - `weaver-spore`: 260Hz bubble pop with 850Hz burst noise.
- **Verification Results**:
  - Unit tests updated to verify 24 non-boss monsters, 3 bosses, 24 attack profiles, shifter dormancy/unburrow/timeout, weaver tripwires/cap, and Thornbound Ossuary regional pool; 184/184 workspace tests passing (100%).
  - Headless Chrome CDP playtest in `scratch/test_day10_playtest.mjs` verified:
    - Bramble Shifter dormancy: started underground in burrowed state.
    - Proximity unburrow: unburrowed at 2.0m distance, dealt 21 eruption damage, and emitted `shifterUnburrow`.
    - Spore Weaver tripwire: placed 12s tripwire zone, stepping onto it slowed player `vx` from 8.0 to 3.375 (50% slow), applied `chill: 1.8`, and emitted `tripwireTrigger`.
    - Spore Weaver spore cluster: fired explosive projectile with `explode: 2.6` and `damage: 16`.
    - Live Three.js WebGL scene with active Shifter hound and Weaver spider meshes, tripwire hazard zone, and miasma burst.
    - Performance: 60 FPS (DRS tier 0), zero console exceptions.
    - Screenshot captured: [day10-biome3-monsters.png](file:///C:/Users/nagas/.gemini/antigravity/brain/c814158f-61ed-4557-8d27-fa15ecf9161b/day10-biome3-monsters.png).
- **Files Touched**: `soul-ember/src/rebuild/roster.js`, `soul-ember/src/rebuild/model-catalog.js`, `soul-ember/src/rebuild/combat-content.js`, `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/scene.js`, `soul-ember/src/core/AudioSynth.js`, `soul-ember/test/rebuild.test.js`, `soul-ember/dist/`, `site/`.

---

### Day 11: Dynamic Room Events (Cursed Altars, Treasure Vaults & Campfire Shrines) — COMPLETED
- **Goal**: Transform the 3x3 sanctuary grid into an exploratory roguelite labyrinth with dynamic room events.
- **Implemented Features**:
  - **Cursed Altar Chambers**:
    - Placed deterministically in outer chambers (`[0, 1, 2, 3, 5, 6, 7, 8]`), leaving Room 4 as the Ember Cathedral sanctuary.
    - Blood pacts: "Blood of Fury" (Sacrifice 30% Max HP to gain +35% Critical Chance and +15% Damage Multiplier) and "Flesh for Cinders" (Sacrifice 30 HP to gain +60 Run Gold).
    - **Hardening Guard**: Sacrifice strictly cannot reduce player HP below 1 (`p.hp = Math.max(1, ...)`, `p.maxHp = Math.max(10, ...)`), preventing suicide via altar trade.
    - Used altar marks `active: false, used: true` and rejects repeated interaction.
  - **Treasure Vaults**:
    - Gated by a timed survival trial: approaching locked vault ($\le 3.8\text{m}$) activates trial (`state = 'active'`), sets 25.0s countdown, spawns trial swarm (2 elite champions + 4 minions), and emits `trialStart`.
    - Surviving 25.0s decrements timer to 0, transitions `state = 'cleared'`, emits `trialComplete`, and drops Golden Relic Chest (`kind: 'chest'`) + 70 gold + epic crest.
  - **Campfire Shrines**:
    - Peaceful sanctuary: **Zero enemy spawns** inside campfire room (`spawn()` rerolls if coordinates fall within campfire room bounds).
    - Blessings: "Mend Wounds" (+35 HP, capped at `maxHp`) or "Temper Weapon" (+10% damage multiplier). Emits `campfireRest` and sets `used: true`.
  - **Minimap Icon Updates & Interactive Modals**:
    - 3x3 stone minimap displays glyphs: `.altar` (`💀`), `.vault` (`🗝️`), `.campfire` (`🔥`), `.trial-active` (pulse animation), and `.cleared` (faded).
    - `openRoomEvent(roomIndex)` in `main.js` opens interactive modal dialogs for Altar and Campfire.
  - **Doorway Rapid Dash Sweep Interpolation**:
    - Step-interpolated sweep (`step = 0..1` in 0.25 increments) between `lastX, lastZ` and `p.x, p.z` ensures fast dashes across corridors and doorways are never skipped in `visitedRooms` or `currentRoom`.
  - **Procedural 3D Geometry Props**:
    - Cursed Altar: Obsidian pedestal with glowing crimson ring and hovering blood ruby.
    - Treasure Vault: Stone dais with runic trial ring and ornate chest with gold band.
    - Campfire Shrine: Circular stone pit with flickering warm ember flame.
  - **Procedural Web Audio API Synthesis**:
    - `altarPact`: 110Hz->55Hz sawtooth sweep with sub rumble.
    - `trialStart`: 180Hz / 216Hz dissonance horn.
    - `trialComplete`: 523Hz / 659Hz / 784Hz / 1046Hz triumphant major chord.
    - `campfireRest`: 440Hz warm sine + gentle ember noise.
- **Verification Results**:
  - Unit tests updated to verify room event initialization, blood pacts with $\ge 1$ HP clamp, 25s survival trial with elite swarm & chest drop, campfire sanctuary with zero spawns & healing/temper, and rapid doorway dash sweep; 70/70 `soul-ember` tests passing, 193/193 workspace tests passing (100%).
  - Headless Chrome CDP playtest in `scratch/test_day11_playtest.mjs` verified:
    - Outer room assignment for Altar (Room 7), Vault (Room 1), and Campfire (Room 3), with Room 4 preserved as center sanctuary.
    - Altar blood pact: sacrificed 30 Max HP, granted +35% crit and +15% damage multiplier, preserved HP $\ge 1$, emitted `altarPact`.
    - Campfire rest: mended 35 HP, emitted `campfireRest`.
    - Vault trial: activated 25.0s countdown on approach, spawned 2 elite champions + 4 minions, completed countdown, transitioned to `cleared`, emitted `trialComplete`, dropped Golden Relic Chest and gold.
    - Minimap DOM rendering: validated `.altar`, `.vault`, `.campfire`, `.trial-active`, and `.cleared` classes.
    - Performance: 60 FPS, DRS tier 0, zero console exceptions.
    - Screenshot captured: [day11-room-events.png](file:///C:/Users/nagas/.gemini/antigravity/brain/c814158f-61ed-4557-8d27-fa15ecf9161b/day11-room-events.png).
- **Files Touched**: `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/main.js`, `soul-ember/src/rebuild/scene.js`, `soul-ember/src/rebuild/style.css`, `soul-ember/src/core/AudioSynth.js`, `soul-ember/test/rebuild.test.js`, `soul-ember/dist/`, `site/`.

---

### Day 12: Week 2 Integration, Elite Bounties & Balance Tuning
- **Goal**: Integrate elite bounties, verify pacing, and complete Milestone Gate 2.
- **Features to Add**:
  - Elite Hunting Bounties: Defeating designated marked champion elites awards bonus Armory gold and temporary run buffs.
  - Rebalance soul drop rates and gold yields for new monster types.
  - **Milestone Gate 2 Verification**: Full workspace test pass (67+ tests), 15-minute survival audit, verify zero console exceptions.
- **Files Touched**: `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/content.js`.

---

## Week 3: Deep Hero Synergy, Weapon Morphing & Elemental Combos (Days 13–18)

### Day 13: Elemental Reaction Engine (Combo Reactions)
- **Goal**: Introduce reactive elemental gameplay where combining different damage types produces devastating chain reactions.
- **Elemental Reactions**:
  - **Combustion (Ignite + Poison/Miasma)**: Causes an immediate 3.5m concussive blast dealing 120 fire damage and scattering shrapnel.
  - **Superconductor (Tempest + Frost)**: Shatters frozen enemies into razor ice shards that chain lightning to 4 nearby foes.
  - **Sanctified Aegis (Ward + Burn)**: Repels approaching swarms with a solar shockwave that blinds enemies for 1.5s.
- **Bug Fixes & Hardening**:
  - Prevent recursive elemental explosion loops when multiple poisoned enemies detonate simultaneously.
  - Optimize particle emitter pools for reaction bursts.
- **Files Touched**: `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/scene.js`.
- **Verification**: Trigger each of the 3 reactions with Cinder Witch and Frost Oracle; verify damage numbers and visual bursts.

---

### Day 14: Ascended Weapon Morphing System
- **Goal**: Reward players who master a hero's kit with a dramatic mid-run weapon evolution.
- **Features to Add**:
  - Evolution Trigger: When both active skills (Q & E) reach Rank 3 and the player acquires an Ascension Core from a Guardian, the hero's primary weapon morphs:
    - **Cinder Witch**: *Ember Staff* → **Sol Invictus** (Twin orbiting solar orbs that fire continuous piercing plasma rays).
    - **Grave Knight**: *Graveblade* → **Executioner's Cleaver** (Leaves seismic fault lines that erupt after 0.5s).
    - **Thorn Ranger**: *Longbow* → **Heartwood Ballista** (Fires triple piercing arrows that splinter on impact).
    - **Frost Oracle**: *Frost Scepter* → **Glacial Monolith** (Summons cascading ice spikes that freeze on contact).
- **Bug Fixes & Hardening**:
  - Preserve all existing weapon branch bonuses when morphing to the ascended form.
  - Ensure weapon 3D mesh updates seamlessly in `scene.js` without resetting player animation state.
- **Files Touched**: `soul-ember/src/rebuild/roster.js`, `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/scene.js`.
- **Verification**: Trigger weapon evolution in test sandbox; verify attack patterns and projectile geometries update accurately.

---

### Day 15: Weapon Morphs for Remaining 4 Heroes
- **Goal**: Complete the Ascended Weapon Morph roster for all 8 heroes.
- **New Ascended Forms**:
  - **Bone Harvester**: *Scythe* → **Reaper's Judgement** (Slain souls manifest as autonomous homing wraiths).
  - **Storm Duelist**: *Twin Rapiers* → **Thunderbolt Fangs** (Every 3rd attack teleports behind the target in a lightning strike).
  - **Plague Alchemist**: *Plague Flask* → **Pandemic Alembic** (Flasks leave persistent boiling acid pools that dissolve enemy armor).
  - **Bellkeeper**: *Vesper Bell* → **Doomsday Chime** (Resonant waves create secondary harmonic shockwaves across the chamber).
- **Files Touched**: `soul-ember/src/rebuild/roster.js`, `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/scene.js`.
- **Verification**: Test all 8 heroes in combat; verify unique weapon morph VFX and audio sounds.

---

### Day 16: Hero Mastery Tier 4 & Archetype Awakening
- **Goal**: Expand permanent meta-progression with Hero Mastery Rank 4 (*Ascended Awakening*).
- **Features to Add**:
  - Mastery Rank 4 Perks:
    - Cinder: Starts with permanent Ignition Mote aura.
    - Grave: Fatal blows grant 3s invulnerability and +50% damage once per run.
    - Thorn: Critical arrow hits spawn 2 seeking thornlings.
    - Frost: Enemies killed while frozen drop 2x souls.
    - Bone: Max Ward shield capacity increased by +50.
    - Storm: Dodges leave a lightning arc that shocks chasing enemies.
    - Plague: Acid pools heal the player for 5% of damage dealt.
    - Bell: Resonant waves deflect enemy ranged projectiles back at attackers.
- **Bug Fixes & Hardening**:
  - Update `MASTERY_COSTS` array in `content.js` to support Rank 4 (1,500 gold).
  - Ensure mastery bonuses correctly disable during Ranked Daily runs.
- **Files Touched**: `soul-ember/src/rebuild/content.js`, `soul-ember/src/rebuild/progress.js`, `soul-ember/src/rebuild/game.js`.
- **Verification**: Unlock Rank 4 in progression tests; verify passive effects trigger during solo expeditions.

---

### Day 17: Summoned Spirit Companion & Tag-Team Summon
- **Goal**: Add a summonable ally mechanic to relieve intense late-game horde pressure.
- **Features to Add**:
  - Summon Stone Shrines: Players can channel 50 gold at an altar to summon a Spectral Companion (an AI-controlled ghost warrior).
  - The companion kites near the player, attacks approaching swarms, and intercepts dangerous projectiles.
  - Custom procedural spirit model with translucent cyan ghost shader.
- **Bug Fixes & Hardening**:
  - Ensure companion AI follows the player through doorways into adjacent rooms.
  - Cap maximum companion summons to 1 to avoid cluttering performance.
- **Files Touched**: `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/scene.js`.
- **Verification**: Summon companion in chamber; verify companion pathfinding and combat engagement.

---

### Day 18: Week 3 Integration, Relic Set Bonuses & Balancing
- **Goal**: Complete synergy systems and audit balance across all 8 heroes.
- **Features to Add**:
  - Relic Set Bonuses: Equipping 2 related relics grants a synergy title and bonus (e.g., *Blood Vessel* + *Grave Thread* = *Immortal Flesh* [+20% max HP, +1 revive]).
  - **Milestone Gate 3 Verification**: Automated benchmark run of all 8 ascended heroes, ensure combo counter accurately tracks flow multipliers.
- **Files Touched**: `soul-ember/src/rebuild/content.js`, `soul-ember/src/rebuild/game.js`.

---

## Week 4: Biome 4 (The Void Citadel) & The Arch-Guardian (Days 19–24)

### Day 19: Biome 4 Architecture & Celestial Void Shaders
- **Goal**: Build the final celestial realm: **The Void Citadel**.
- **Features to Add**:
  - Visual Theme: Floating obsidian sanctuary platforms suspended above an animated cosmic nebula.
  - Shaders: Procedural starfield background shader with swirling galactic dust and glowing void runes.
  - Tile Geometries: Floating celestial columns, broken bridge corridors, and glowing gravity wells.
  - Biome Entry Condition: Reaching Cycle 2 or defeating the 3 initial guardians in an unbroken run.
- **Bug Fixes & Hardening**:
  - Prevent player or enemy knockback from falling off bridge corridors into the void.
  - Optimize nebula shader for 60 FPS performance on integrated mobile GPUs.
- **Files Touched**: `soul-ember/src/rebuild/roster.js`, `soul-ember/src/rebuild/scene.js`, `soul-ember/src/rebuild/game.js`.
- **Verification**: Load Biome 4 in Three.js renderer; verify aesthetic lighting and collision boundaries.

---

### Day 20: Biome 4 Monster Roster (Void Horrors & Chrono Wardens)
- **Goal**: Populate the Void Citadel with high-tier cosmic horrors.
- **New Monsters**:
  - **Void Stalker**: Phasing assassin that blinks through walls and strikes from shadow.
  - **Null Siphon**: Gravitational orb that pulls projectiles inward and detonates upon absorbing 5 shots.
  - **Chrono Warden**: Cosmic sentinel that casts localized time-dilation bubbles, slowing player actions while speeding up minions.
  - **Astral Devourer**: Massive serpentine void beast that charges across corridors in a sweeping arc.
- **Files Touched**: `soul-ember/src/rebuild/roster.js`, `soul-ember/src/rebuild/combat-content.js`, `soul-ember/src/rebuild/scene.js`.
- **Verification**: Verify all 4 void monsters spawn with appropriate speed and damage scaling in Biome 4.

---

### Day 21: The Arch-Guardian: Malakor, The Eclipse Sovereign (Phases 1 & 2)
- **Goal**: Implement the first two phases of the game's ultimate boss.
- **Boss Mechanics**:
  - **Phase 1: Solar Majesty**: Malakor floats atop a golden solar dais, summoning orbiting solar flares, piercing beam sweeps, and summoning Solar Sentinels.
  - **Phase 2: Lunar Eclipse**: The dais darkens into deep violet; Malakor descends into melee combat, wielding twin eclipse scythes that slash in wide crescent waves and leaves void rifts.
- **Bug Fixes & Hardening**:
  - Ensure solar beam sweeps leave visible ground warning paths 1.2s prior to firing.
  - Fix boss collision box adjusting dynamically during flight vs ground phases.
- **Files Touched**: `soul-ember/src/rebuild/combat-content.js`, `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/scene.js`.
- **Verification**: Fight Phase 1 and 2 in automated test harness; verify telegraph accuracy and hitboxes.

---

### Day 22: The Arch-Guardian: Malakor (Phases 3 & 4 - True Eclipse)
- **Goal**: Implement the climactic phases of the final boss encounter.
- **Boss Mechanics**:
  - **Phase 3: Cosmic Singularity**: Malakor shatters the dais, pulling broken arena tiles into orbit. Creates a gravitational black hole in the center that pulls all entities while bullet-hell void stars cascade outward.
  - **Phase 4: Sovereign's Desperation**: A frenetic 20-second survival phase where Malakor unleashes continuous beam rotations; the player must weave through safe gaps to land the final strikes.
- **Victory Sequence**: Defeating Malakor triggers a cosmic supernova explosion, unlocking the **Crown of the Ascended** and entering Endless Torment.
- **Files Touched**: `soul-ember/src/rebuild/combat-content.js`, `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/scene.js`.
- **Verification**: Complete the full 4-phase battle; verify victory cinematic and reward triggers.

---

### Day 23: Endless Torment & Custom Challenge Modifiers
- **Goal**: Provide hardcore roguelite players with infinite, escalating late-game replayability.
- **Features to Add**:
  - Custom Challenge Modifiers:
    - *Glass Ember*: Player has 1 HP, but deals 300% damage.
    - *Colosseum of Bone*: Infinite enemy spawns in a single open arena without doors.
    - *Turbo Descent*: Game runs at 1.4x global speed.
    - *Darkness Descends*: View distance limited to a 6-meter torchlight circle.
  - Weekly Seeded Challenge Leaderboard: Integrated challenge mode with fixed seeds and weekly rewards.
- **Files Touched**: `soul-ember/src/rebuild/content.js`, `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/main.js`.
- **Verification**: Launch each challenge modifier; verify custom rules apply cleanly without polluting base save data.

---

### Day 24: Week 4 Integration, Balance Audit & Milestone Gate 4
- **Goal**: Balance Void Citadel difficulty and ensure seamless progression from Biomes 1 through 4.
- **Tasks**:
  - Balance gold and soul yield scaling across all 4 biomes.
  - Audit boss telegraph timings for accessibility.
  - **Milestone Gate 4 Verification**: Automated full playthrough test from Biome 1 Ashen Cathedral through Biome 4 Eclipse Sovereign.
- **Files Touched**: `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/content.js`.

---

## Week 5: Visual Spectacle, Audio Symphony & Launch Polish (Days 25–30)

### Day 25: Atmospheric Weather & Environmental Particle Overhaul
- **Goal**: Elevate atmospheric immersion across all four sanctuaries.
- **Features to Add**:
  - Biome 1: Falling glowing ash motes, drifting embers, and heat haze shimmer.
  - Biome 2: Atmospheric mist, falling water droplets, and luminous aquatic spore dust.
  - Biome 3: Drifting dry leaves, floating bone dust, and creeping fungal spores.
  - Biome 4: Cosmic star shimmer, nebula auroras, and void energy motes.
- **Bug Fixes & Hardening**:
  - Use GPU instanced particle geometry with single draw-call efficiency to maintain 60 FPS on mobile.
- **Files Touched**: `soul-ember/src/rebuild/scene.js`.
- **Verification**: Measure GPU draw calls and frame rate with all particle systems active.

---

### Day 26: Web Audio Procedural Sound Overhaul
- **Goal**: Upgrade procedural audio synthesis to AAA audio standard.
- **Features to Add**:
  - Biome Ambience: Sub-bass dungeon drone, dripping water reverbs, howling wind filters.
  - Weapon Foley: Metallic ring on blade swings, crisp glass shatter on plague flasks, thunder claps on lightning hits, wooden snap on bow releases.
  - Audio Mix Settings: Independent Master, Music, SFX, and Ambience volume sliders in Settings modal.
- **Bug Fixes & Hardening**:
  - Fix Web Audio context auto-resume warning on iOS Safari when touching the screen.
  - Prevent audio buffer clipping when 15+ sounds play simultaneously during massive cleaves.
- **Files Touched**: `soul-ember/src/rebuild/audio.js`, `soul-ember/src/rebuild/main.js`.
- **Verification**: Audio spectrum check ensuring zero distortion and crisp dynamic range.

---

### Day 27: Accessibility, Colorblind Modes & Typography Options
- **Goal**: Make Soul Ember fully accessible to all gamers worldwide.
- **Features to Add**:
  - Colorblind Filters (Protanopia, Deuteranopia, Tritanopia) that adjust enemy telegraph colors and health bar hues.
  - High-Contrast Text Mode for floating damage numbers and UI labels.
  - Reduced Motion Toggle: Disables screen shake, camera tilts, and flashing lights for motion-sensitive players.
  - Customizable Button Rebinding in Settings.
- **Files Touched**: `soul-ember/src/rebuild/main.js`, `soul-ember/src/rebuild/style.css`, `soul-ember/src/rebuild/progress.js`.
- **Verification**: Toggle each accessibility setting; verify visual adjustments update dynamically in real time.

---

### Day 28: PWA Offline Support & Asset Pre-Caching
- **Goal**: Enable instant loading and offline playability anywhere.
- **Features to Add**:
  - Service Worker cache-first strategy for all core production bundles, icons, and audio synthesis assets.
  - Web App Manifest: Configure full-screen standalone PWA mode with custom splash screens and app icons.
  - LocalStorage & IndexedDB fallbacks for expedition save reliability across browser updates.
- **Bug Fixes & Hardening**:
  - Add version hash cache busting to guarantee seamless updates when new patches land on GitHub Pages.
- **Files Touched**: `soul-ember/index.html`, `scripts/build-site.mjs`, `soul-ember/public/manifest.json`.
- **Verification**: Test in Chrome DevTools offline mode; verify the game boots and plays flawlessly without network connection.

---

### Day 29: Memory Leak Stress Testing & 60-Minute Survival Audit
- **Goal**: Ensure rock-solid stability during extended endless ascension runs.
- **Tasks**:
  - Run an automated 60-minute continuous headless Chrome stress test simulating 10 consecutive ascensions and 5,000+ enemy kills.
  - Track JavaScript heap allocations, Three.js geometry buffers, texture counts, and event listener counts.
  - Fix any geometry disposal leaks, audio node disconnections, or loot array accumulation.
- **Files Touched**: `soul-ember/src/rebuild/game.js`, `soul-ember/src/rebuild/scene.js`.
- **Verification**: Verify JS heap memory remains under 85 MB throughout the entire 60-minute session.

---

### Day 30: Final Release Candidate Build, Automated Regression Pass & Deployment
- **Goal**: Execute the final release candidate build and deploy Soul Ember 3.0 to production.
- **Release Tasks**:
  - Run complete workspace test suite (all unit tests, integration tests, Dead Signal and Road Riot regression checks).
  - Execute production minification build (`npm run build`).
  - Verify dual routing across both `games.valixis.tech/soul-ember/` and `games.valixis.tech/soul_ember/`.
  - Commit and tag release: `v3.0.0 — The Eclipse Sovereign Expansion`.
  - Deploy to GitHub Pages and confirm live availability worldwide.
- **Verification**: Verify 100% test pass rate, live page loads with 200 OK, zero console errors, 60 FPS verified across all modes.

---

## Summary of 30-Day Content Growth

| Metric | Day 1 Baseline | Day 30 Milestone | Total Expansion |
| :--- | :--- | :--- | :--- |
| **Sanctuary Biomes** | 3 (Cathedral, Catacombs, Ossuary) | **4 (+ The Void Citadel)** | **+33% World Size** |
| **Monsters & Minions** | 18 Types | **28 Types (+10 New Archetypes)** | **+55% Enemy Roster** |
| **Guardians & Bosses** | 3 Guardians | **4 Guardians (+ The Eclipse Sovereign)** | **+33% Boss Encounters** |
| **Elite Affixes** | None (Basic Scaling) | **5 Champion Affixes (Vortex, Molten, etc.)** | **New Elite System** |
| **Weapons & Morphs** | 8 Base Weapons | **16 Weapons (+8 Ascended Forms)** | **2x Weapon Depth** |
| **Elemental Combos** | Isolated Statuses | **3 Complex Elemental Reactions** | **Emergent Combat** |
| **Controller Support** | Keyboard & Touch Only | **Full Gamepad API & Rebinding** | **Console Parity** |
| **Special Chambers** | Combat Only | **Altars, Vaults, Campfires, Trials** | **Exploration Depth** |
| **Challenge Modes** | Solo & Daily | **Glass Ember, Turbo, Colosseum, Endless** | **Infinite Replayability** |
