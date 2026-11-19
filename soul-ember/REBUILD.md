# Soul Ember 3D rebuild

`src/rebuild/main.js` is the active entry point. It connects the version 4 progression, interface, simulation, renderer and anonymous challenge adapter. Version 4 uses `soul_ember_v4` and performs a one-way copy from the existing `soul_ember_illustrated_v3` save when needed; the legacy save remains untouched.

## Game structure

`roster.js` is the shared source of truth for eight heroes, their weapons, signatures and build branches, plus eighteen regional monsters and three guardians. `game.js` runs deterministic fixed-step combat. Automatic targeting requires line of sight, projectiles collide with walls, enemies use the shared navigation field, and attacks expose a windup before damage. The three guardians use separate radial, lane-and-pool, and root-summoning patterns with three health phases.

Every hero has three ranks in each of three branches, two manually triggered active skills and a signature. Offers exclude capped choices. Rank three changes the attack pattern or dodge effect. The build panel shows skills, relics, branch ranks and damage contributions. The first choice is guaranteed by 50 seconds even if room geometry delays early drops. The camp Armory adds capped account and hero mastery upgrades, while seeded merchants after the first two guardians sell one run-only relic. Ranked challenges ignore permanent Armory bonuses.

`model-catalog.js` defines a bespoke physical silhouette, headgear, equipment and material palette for every hero, monster and guardian. `scene.js` restores the older articulated hierarchy approach and expands it with nested limbs, armor, weapons, wings, capes, boss phase parts, evolution parts and creature-specific rigs. The same live 3D actors appear in combat and in the menu showcase; there is no sprite or portrait atlas in the active game. Idle, movement, attack, dodge, hit and death poses are driven by the simulation, while geometry is batched for rendering. `dungeon-view.js` provides worn masonry, carved floors, coffins, banners, cutaway entrances, torchlight and region-specific ash debris, water and roots. The simulation and renderer share `dungeon.js`, so visible walls, doors and pillars match collision.

The opening screen exposes only Play, Heroes and Settings. Records and challenges appear after the first completed expedition. A first-run guide introduces movement, automatic attacks, dodge warnings and soul pickups. Locked heroes explain the required number of completed expeditions.

Controls: WASD or arrows move, Q and E cast aimed skills, R uses the signature, Space dodges, B or Tab opens the build panel, Escape or P pauses, and 1–3 choose a blessing. Mouse position aims skills; mobile skill buttons support tap targeting and drag aiming. Backgrounding the page pauses play.

## Local development and production

From the repository root:

```text
npm install
npm run dev:soul-ember
npm test
npm run build
```

Development runs at <http://127.0.0.1:8080>. The root build creates `site/` and places the compiled game under `site/soul-ember/`. Serve `site/` for a production preview; raw source HTML does not resolve the Vite module graph.

## Challenges, privacy and ads

The optional endpoint is `/api/soul-ember`. Configure server-only `DATABASE_URL` and a random `CHALLENGE_SECRET` of at least 32 bytes, then apply `server/schema.sql`. Without those values the endpoint returns 503 and solo play remains fully available. Version 3 challenge IDs and boards are separate from the former game.

Daily and weekly challenges assign the same hero, seed and modifier to every anonymous player. A signed, expiring, single-use token accompanies a run. The server validates timing and plausible bounds, calculates the score and stores the top records. These are plausibility checks rather than authoritative replay verification; prize competition requires server-side replay validation. No account, name or persistent visitor identifier is collected.

Ads remain disabled unless a provider installs `window.soulEmberAds` and confirms consent. Rewarded gold is available only after a run; interstitials are eligible only after victory or eight minutes. A failed ad never blocks play. Aggregate metrics are off by default and, when enabled on both client and server, contain event totals without visitor IDs.

## Verification and release limits

The automated suite covers all heroes, active skills, branch caps and effects, signatures, every monster behavior, guardian phases, merchants, Armory progression, v3 migration, physical drops, targeting walls, collision, deterministic seeds and first-choice timing. Browser checks cover finite actor transforms, desktop and mobile layouts, touch controls, upgrade application, console errors and an 80-enemy stress scene.

Before a public release, complete human playtests for every hero, check each guardian on real touch devices, validate sound balance, test the configured database and ad provider, and gather frame-time traces from the minimum supported desktop and mobile hardware.
