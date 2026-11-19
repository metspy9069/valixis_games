# Soul Ember — The Last Light

The active game is `src/rebuild/main.js`, imported by `index.html`. The old `src/main.js` engine and its related modules are inactive; only its vector icons and audio synthesizer are reused. The original playable HTML is recoverable from Git history. `src/rebuild/catalog.js` carries over the actual playable catalog: eight heroes, fourteen blessings, eleven merchant items, and five Forge upgrade tracks. The duplicate folder named `soul ember` has been removed.

## Local development

From the repository root, run `npm install` and `npm run dev:soul-ember`. Open http://localhost:8080. Solo play, all heroes, Forge, daily gold, achievements and device records work without a backend. Run `npm test` for simulation/persistence checks. `npm run build` creates `site/`, containing the arcade and compiled game at `/soul-ember/`. Serve that directory to preview production; serving raw source HTML without Vite will not resolve Three.js imports.

## Persistent challenges

The serverless endpoint is `/api/soul-ember`, with actions `start`, `board`, `submit` and `metric`. Configure server-only `DATABASE_URL` for a managed PostgreSQL database and a cryptographically random `CHALLENGE_SECRET` of at least 32 bytes. Apply `server/schema.sql` to that database once. Never put these secrets in variables prefixed `VITE_` or commit them. Vercel's root configuration builds the arcade and discovers the root API route. Deployment has not been performed.

For local API development, provide those environment variables to `npm --prefix soul-ember run backend`; Vite proxies `/api` to localhost:3001. With no database configuration the API explicitly returns 503 and solo play remains available. The old in-memory score endpoint returns 410. No fictional leaderboard entries are shown.

Daily boards reset at midnight UTC; weekly boards reset Monday midnight UTC. A shared challenge assigns a hero, deterministic seed, modifier and standard stats. Local Forge upgrades do not apply. Start returns a signed, expiring, single-submission run token. Submit accepts integer duration/kills/gold and a victory flag; the server calculates the score, checks elapsed time and plausible bounds, and stores the anonymous result. Top 50 records are returned. No account, name or persistent visitor ID is collected. A global start budget limits anonymous requests without recording network identifiers.

These are plausibility checks, not authoritative gameplay verification: a modified browser client can still cheat. Serious competitive/prize use needs server replay verification before launch. Database connectivity, migrations, concurrent submissions and deployment must be exercised with an actual managed database before public rankings are enabled. The local automated suite does not claim live database coverage.

## Ads and aggregate counters

Ads are off unless an integration installs `window.soulEmberAds = { consented: true, rewarded: async () => boolean, interstitial: async () => void }`. `consented` must represent whatever consent the configured provider requires. The adapter must report rewarded completion exactly once, after actual provider confirmation. An unavailable or failed ad must not block play. No provider SDK is bundled.

An optional rewarded ad after a standard run grants 50 local meta gold, once per result. Interstitials are eligible only after a victory or at least eight minutes survived. Ranked challenges never display ads. Aggregate counters are disabled by default: enable `VITE_ENABLE_METRICS=true` in the build and `ENABLE_METRICS=true` on the server to store daily totals for run starts, completions and challenge completions. No visitor/session IDs are sent. Counters are directional product measurements, not audited analytics.

## Progress and behavior

The existing `soul_ember_fullscreen_v1` storage key is migrated in place, preserving banked gold, purchased Forge ranks and achievements. New device records omit the previous fabricated sample scores. Storage failure is surfaced without preventing play. Meta gold settles at defeat, victory or an explicit quit; closing the tab mid-run can lose that run's unbanked gold. Challenge scores require a live connection to submit and are not silently presented as saved if submission fails.

Controls: WASD/arrows move, Space dodge, R/Q ultimate, E/B shop, P/Escape pause, 1–3 choose a blessing, F fullscreen. Touch players have a joystick, dodge and ultimate buttons. A hidden/backgrounded tab pauses. Reduced motion disables character bobbing and wing animation. Dev builds expose `window.__soulEmber` for inspection; production builds do not include this hook.

The rebuilt five-realm progression changes environment every two minutes, with Malakor arriving at eight minutes. Defeating Malakor unlocks standard-run Endless Nightmare, including recurring elite waves. Further rarity presentation and handcrafted character animation, additional boss patterns and device-specific optimization still need further design/playtesting; no claim of finished visual quality or measured device performance is made.

## Release checks

Run `npm test` and `npm run build`. Exercise standard and challenge runs, upgrades, shop affordability, defeat/victory/endless, pause/backgrounding, mobile touch, save migration, unavailable API and ad cancellation. Test the managed database and ad provider after credentials are configured. Measure real desktop and mobile frame times before claiming the 60 FPS desktop / 30 FPS mobile targets. Broader human playtesting is needed to validate the 8–12 minute pacing and all hero/build combinations.

The dependency audit reported development-tooling advisories in the Vite dependency graph even after updating Vite; production-only dependency audit reported no vulnerabilities. Do not expose the development server publicly. Recheck the tooling advisory status before deployment.


## Dungeon art and combat revision

The world now uses a shared nine-chamber layout in `dungeon.js`: continuous stone walls, open doorways, column collision and navigation fields. `dungeon-view.js` builds the masonry, pointed arches, worn flagstones, banners, stone coffins and torchlight. Foreground walls use a cutaway height. Shots stop at stone; enemies route through connected rooms. Movement speed is now 7.2 units/second and the base attack cooldown is 0.38 seconds. Characters have articulated limbs and weapon recoil, with impact sparks, projectile streaks, dash trails and restrained camera shake. Reduced motion disables the extra movement effects. Human playtesting and real-device performance checks remain necessary after this pacing change.
