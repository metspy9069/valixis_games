import test from 'node:test';
import assert from 'node:assert';
import {
  HIT_ZONES,
  hitZoneFor,
  sampleCircularSpread,
  intersectColliderRay,
  rayWorldAll,
  resolveZombieRayHits,
  resolveBallisticPath,
} from '../js/ballistics.js';
import { WEAPONS } from '../js/data.js';

test('HIT_ZONES defines exact locational damage multipliers and stagger weights', () => {
  assert.strictEqual(hitZoneFor('head').multiplier, 3.0);
  assert.strictEqual(hitZoneFor('upperTorso').multiplier, 1.25);
  assert.strictEqual(hitZoneFor('lowerTorso').multiplier, 1.0);
  assert.strictEqual(hitZoneFor('limb').multiplier, 0.75);
  assert(hitZoneFor('limb').stagger > hitZoneFor('lowerTorso').stagger, 'Limb shot must apply higher stagger');
});

test('sampleCircularSpread yields strictly circular distribution without square corner clumping', () => {
  const radius = 0.5;
  // Multi-pellet shotgun spread (12 pellets)
  const pellets = [];
  for (let p = 0; p < 12; p++) {
    const s = sampleCircularSpread(radius, p, 12, () => 0.5);
    const dist = Math.hypot(s.dx, s.dy);
    assert(dist <= radius + 1e-9, `Pellet ${p} exceeded circular radius: ${dist} > ${radius}`);
    pellets.push(s);
  }
  // Ensure pellets occupy all 4 quadrants (no single-corner clustering)
  const q1 = pellets.some((p) => p.dx > 0 && p.dy > 0);
  const q2 = pellets.some((p) => p.dx < 0 && p.dy > 0);
  const q3 = pellets.some((p) => p.dx < 0 && p.dy < 0);
  const q4 = pellets.some((p) => p.dx > 0 && p.dy < 0);
  assert(q1 && q2 && q3 && q4, 'Shotgun pellets failed to distribute across all four quadrants');

  // Single-round Gaussian distribution stays inside circular bounds
  for (let i = 0; i < 200; i++) {
    const s = sampleCircularSpread(radius, 0, 1);
    assert(Math.hypot(s.dx, s.dy) <= radius + 1e-9, 'Gaussian bullet exceeded cone radius');
  }
});

test('resolveZombieRayHits eliminates phantom duplicate hits on overlapping meshes and prioritizes vitals', () => {
  const zA = { alive: true, id: 'A' };
  const zB = { alive: true, id: 'B' };
  const zDead = { alive: false, id: 'Dead' };

  const rawHits = [
    // Point-blank self-origin hit (<0.05m) should be ignored
    { object: { userData: { zombie: zA, part: 'limb' } }, distance: 0.02, point: { x: 0, y: 1, z: 0 } },
    // Dead zombie corpse hit should be ignored
    { object: { userData: { zombie: zDead, part: 'head' } }, distance: 2.0, point: { x: 0, y: 1, z: -2 } },
    // Zombie A: forearm slightly overlaps chest/head at nearly same distance (4.00 vs 4.06)
    { object: { userData: { zombie: zA, part: 'limb' } }, distance: 4.00, point: { x: 0, y: 1.5, z: -4 } },
    { object: { userData: { zombie: zA, part: 'head' } }, distance: 4.06, point: { x: 0, y: 1.7, z: -4.06 } },
    // Duplicate torso box inside same zombie A at 4.18 should not produce second hit
    { object: { userData: { zombie: zA, part: 'lowerTorso' } }, distance: 4.18, point: { x: 0, y: 1.2, z: -4.18 } },
    // Zombie B standing right behind A
    { object: { userData: { zombie: zB, part: 'upperTorso' } }, distance: 5.5, point: { x: 0, y: 1.4, z: -5.5 } },
  ];

  const resolved = resolveZombieRayHits(rawHits);
  assert.strictEqual(resolved.length, 2, `Expected 2 unique live zombies, got ${resolved.length}`);
  assert.strictEqual(resolved[0].zombie, zA);
  assert.strictEqual(resolved[0].part, 'head', 'Overlapping forearm should promote to head within overlapWindow');
  assert.strictEqual(resolved[1].zombie, zB);
  assert.strictEqual(resolved[1].part, 'upperTorso');
});

test('intersectColliderRay and resolveBallisticPath handle thin wood penetration and collateral multi-kills', () => {
  const woodCrate = { minX: -1, maxX: 1, minZ: -5.5, maxZ: -4.5, height: 1.2, material: 'wood', penetrable: true, penCost: 0.35 };
  const concreteWall = { minX: -2, maxX: 2, minZ: -12, maxZ: -10, height: 4.0, material: 'concrete', penetrable: false };

  const origin = { x: 0, y: 0.9, z: 0 };
  const dir = { x: 0, y: 0, z: -1 };
  const worldHits = rayWorldAll(origin, dir, [woodCrate, concreteWall], 100);
  assert.strictEqual(worldHits.length, 2);
  assert.strictEqual(worldHits[0].material, 'wood');
  assert.deepStrictEqual(worldHits[0].normal, { x: 0, y: 0, z: 1 });
  assert.strictEqual(worldHits[1].material, 'concrete');

  const z1 = { alive: true, id: 1 };
  const z2 = { alive: true, id: 2 };
  const z3BehindWall = { alive: true, id: 3 };
  const zombieHits = resolveZombieRayHits([
    { object: { userData: { zombie: z1, part: 'upperTorso' } }, distance: 6.2, point: { x: 0, y: 0.9, z: -6.2 } },
    { object: { userData: { zombie: z2, part: 'head' } }, distance: 8.1, point: { x: 0, y: 0.9, z: -8.1 } },
    { object: { userData: { zombie: z3BehindWall, part: 'head' } }, distance: 15.0, point: { x: 0, y: 0.9, z: -15 } },
  ]);

  // Rifle high-velocity shot (penPower: 2.15, maxTargets: 4) punches through crate -> z1 -> z2 -> stops at concrete wall
  const rifle = WEAPONS.find((w) => w.id === 'rifle');
  const events = resolveBallisticPath(zombieHits, worldHits, { penPower: rifle.penPower, maxTargets: rifle.maxTargets });
  assert.strictEqual(events.length, 4, `Expected crate + z1 + z2 + concrete wall, got ${events.length}`);
  assert.strictEqual(events[0].kind, 'world');
  assert.strictEqual(events[0].penetrated, true);
  assert.strictEqual(events[1].zombie, z1);
  assert.strictEqual(events[1].penetrated, true);
  assert.strictEqual(events[2].zombie, z2);
  assert(events[2].damageScale < 1.0, 'Collateral second target should receive attenuated penetration damage');
  assert.strictEqual(events[3].kind, 'world');
  assert.strictEqual(events[3].material, 'concrete');
  assert.strictEqual(events[3].penetrated, false);

  // Solid concrete wall blocks z3 completely
  assert(!events.some((e) => e.zombie === z3BehindWall), 'Solid concrete wall must block rounds from reaching target behind it');
});
