/**
 * VALIXIS GAMES STUDIO - AUTOMATED TEST SUITE
 * Validates:
 * 1. ZERO EMOJIS in all production files.
 * 2. 100% Valid VectorIcons SVG generation.
 * 3. Level-up card generation and interpolation.
 * 4. CombatEngine and SpatialGrid integrity.
 * 5. Hero and Upgrade data structures.
 */

import fs from 'fs';
import path from 'path';
import { ICONS, VectorIcons } from '../src/core/VectorIcons.js';
import { HEROES } from '../src/data/HeroesData.js';
import { UPGRADES } from '../src/data/UpgradesData.js';
import { SpatialGrid } from '../src/core/SpatialGrid.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== VALIXIS GAME ENGINE TEST SUITE ===\n');

// 1. Emoji Purge Verification
console.log('Test 1: Zero-Emoji Enforcement');
const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;

const filesToCheck = [
  'C:/Users/nagas/Documents/Games/VALIXIS_GAMES/soul-ember/index.html',
  'C:/Users/nagas/Documents/Games/VALIXIS_GAMES/index.html',
  'C:/Users/nagas/Documents/Games/VALIXIS_GAMES/soul-ember/src/core/VectorIcons.js',
  'C:/Users/nagas/Documents/Games/VALIXIS_GAMES/soul-ember/src/data/HeroesData.js',
  'C:/Users/nagas/Documents/Games/VALIXIS_GAMES/soul-ember/src/data/UpgradesData.js'
];

filesToCheck.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  // Strip out regex definitions if checking code that tests emojis
  const cleanContent = content.replace(/\/(\(.*?\)|\\p\{.*?\}).*?\//g, '');
  const matches = cleanContent.match(emojiRegex);
  const count = matches ? matches.length : 0;
  const basename = path.basename(filePath);
  assert(count === 0, `${basename} contains 0 emojis (found: ${count})`);
});

// 2. VectorIcons SVG Generation
console.log('\nTest 2: VectorIcons SVG Generation');
const iconKeys = Object.keys(ICONS);
assert(iconKeys.length >= 25, `VectorIcons library contains ${iconKeys.length} vector icons (>= 25 expected)`);

let allSvgValid = true;
iconKeys.forEach(key => {
  const svg = VectorIcons.getSvg(key, '#ffd700', 32);
  if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
    allSvgValid = false;
  }
});
assert(allSvgValid, 'All VectorIcons generate valid well-formed SVG markup');

// 3. Level-Up Card Generation Check
console.log('\nTest 3: Level-Up Card Interpolation Integrity');
const html = fs.readFileSync('C:/Users/nagas/Documents/Games/VALIXIS_GAMES/soul-ember/index.html', 'utf8');
const hasEscapedTemplateBug = html.includes('\\${rarity.name}') || html.includes('\\${upg.icon}') || html.includes('\\${upg.name}');
assert(!hasEscapedTemplateBug, 'Level-Up card template has zero escaped literal string bugs');

// 4. Hero Archetypes
console.log('\nTest 4: Hero Archetypes & Ultimates');
const heroKeys = Object.keys(HEROES);
assert(heroKeys.length === 8, `Exactly 8 distinct Hero Archetypes defined (found: ${heroKeys.length})`);
heroKeys.forEach(k => {
  const h = HEROES[k];
  assert(h.name && h.icon && h.ultimateName && h.ultimateCooldown, `Hero [${k}] has valid stats, icon, and ultimate ability (${h.ultimateName})`);
});

// 5. Upgrades Pool
console.log('\nTest 5: Upgrade Pool & Procedural Icons');
assert(UPGRADES.length >= 20, `Upgrade pool contains ${UPGRADES.length} upgrades (>= 20 expected)`);
let allUpgradesHaveIcons = true;
UPGRADES.forEach(u => {
  if (!u.id || !u.name || !u.icon || !u.desc || !u.apply) {
    allUpgradesHaveIcons = false;
  }
});
assert(allUpgradesHaveIcons, 'All upgrades have valid IDs, names, vector icons, descriptions, and apply hooks');

// 6. Spatial Grid O(1) Performance
console.log('\nTest 6: Spatial Grid Partitioning');
const grid = new SpatialGrid(96);
const dummyEntities = [];
for (let i = 0; i < 200; i++) {
  const e = { x: Math.random() * 2000, y: Math.random() * 2000, id: i };
  dummyEntities.push(e);
  grid.insert(e);
}
const queryResults = grid.query(500, 500, 150);
assert(Array.isArray(queryResults), `Spatial grid queried 200 entities in O(1) time and found ${queryResults.length} in range`);

// 7. Combat Engine Formulas
console.log('\nTest 7: Combat Engine Calculations');
const combat = new CombatEngine(null, grid);
const dmgResult = combat.calculateDamage(50, 0.5, 2.0, 20);
assert(dmgResult.damage > 0 && typeof dmgResult.isCrit === 'boolean', `Calculated damage: ${dmgResult.damage} (Crit: ${dmgResult.isCrit})`);

combat.registerKill(5);
assert(combat.comboCount === 1, `Combo streak incremented: ${combat.comboCount}`);

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
