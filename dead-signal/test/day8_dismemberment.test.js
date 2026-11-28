import test from 'node:test';
import assert from 'node:assert';
import {
  LIMB_TYPES,
  LIMB_THRESHOLDS,
  initZombieDismemberment,
  severZombieLimb,
  convertToCrawler,
  settleRagdollDeath,
  GoreDebrisPool,
  ArterialSprayPool,
} from '../js/dismemberment.js';

// Mock Three.js Vector3 & Group for headless Node test environment
class MockVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  clone() { return new MockVector3(this.x, this.y, this.z); }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  normalize() {
    const l = Math.hypot(this.x, this.y, this.z) || 1;
    this.x /= l; this.y /= l; this.z /= l;
    return this;
  }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
}

function makeMockZombie(hp = 100, damage = 24, type = 'walker') {
  const z = {
    hp,
    maxHp: hp,
    damage,
    baseDamage: damage,
    def: { scale: 1.0, damage },
    type,
    isBoss: false,
    alive: true,
    deadTimer: 0,
    deathPitch: -1.35,
    deathRoll: 0.2,
    radius: 0.4,
    speed: 2.2,
    reach: 1.4,
    flinch: 0,
    group: {
      position: new MockVector3(0, 0, 5),
      rotation: { x: 0, y: 0, z: 0 },
    },
    rig: {
      head: { visible: true },
      jaw: { visible: true },
      neck: { visible: true },
      facialDetail: [{ visible: true }, { visible: true }],
      armL: { shoulder: { visible: true }, elbow: { visible: true }, hand: { visible: true } },
      armR: { shoulder: { visible: true }, elbow: { visible: true }, hand: { visible: true } },
      legL: { hip: { visible: true }, knee: { visible: true }, foot: { visible: true } },
      legR: { hip: { visible: true }, knee: { visible: true }, foot: { visible: true } },
    },
    die(ctx, part = 'body') {
      this.alive = false;
      this.state = 'dead';
    },
  };
  initZombieDismemberment(z);
  return z;
}

test('LIMB_TYPES and LIMB_THRESHOLDS define correct dismemberment attributes', () => {
  assert.strictEqual(LIMB_TYPES.HEAD, 'head');
  assert.strictEqual(LIMB_TYPES.ARM_L, 'armL');
  assert.strictEqual(LIMB_TYPES.ARM_R, 'armR');
  assert.strictEqual(LIMB_TYPES.LEG_L, 'legL');
  assert.strictEqual(LIMB_TYPES.LEG_R, 'legR');
  assert.strictEqual(LIMB_THRESHOLDS.armL, 35);
  assert.strictEqual(LIMB_THRESHOLDS.legL, 45);
});

test('Headshot decapitation severs head, kills zombie, and spawns high arterial spray', () => {
  const z = makeMockZombie(80, 24);
  let spawnedDebris = null;
  let sprayedPos = null;

  const mockCtx = {
    debrisPool: {
      spawn: (type, pos, dir, spd) => { spawnedDebris = { type, pos, spd }; },
    },
    arterialPool: {
      spawnSpray: (pos, count) => { sprayedPos = pos; },
    },
  };

  const res = severZombieLimb(z, 'head', null, null, mockCtx);
  assert(res.severed, 'Head must be severed');
  assert(res.fatal, 'Decapitation must be fatal');
  assert.strictEqual(z.dismembered.head, true);
  assert.strictEqual(z.rig.head.visible, false);
  assert.strictEqual(z.rig.jaw.visible, false);
  assert.strictEqual(z.alive, false, 'Zombie must be dead after decapitation');
  assert.strictEqual(spawnedDebris.type, 'head');

  // Verify bug fix: Headshot blood must NEVER spawn from ground/feet coordinates (y = 0)
  assert(sprayedPos !== null, 'Arterial spray must have spawned');
  assert(sprayedPos.y >= 1.4, `Arterial spray height (${sprayedPos.y}m) must be at neck level, not feet!`);
});

test('Arm dismemberment disables limb attacks and scales damage down proportionally', () => {
  const z = makeMockZombie(100, 30);
  assert.strictEqual(z.damage, 30);

  // Sever left arm
  const resL = severZombieLimb(z, 'armL');
  assert.strictEqual(z.dismembered.armL, true);
  assert.strictEqual(z.rig.armL.shoulder.visible, false);
  assert.strictEqual(z.damage, 15, '1 severed arm must reduce damage output by 50%');

  // Sever right arm (both gone)
  const resR = severZombieLimb(z, 'armR');
  assert.strictEqual(z.dismembered.armR, true);
  assert.strictEqual(z.rig.armR.shoulder.visible, false);
  assert.strictEqual(z.damage, 5, 'Both severed arms must reduce damage by ~85% (resorts to weak bite)');
});

test('Leg dismemberment converts standing zombie into Crawler archetype', () => {
  const z = makeMockZombie(100, 20, 'walker');
  assert.strictEqual(z.isCrawler, false);
  assert.strictEqual(z.speed, 2.2);

  const res = severZombieLimb(z, 'legL');
  assert(res.severed, 'Leg must be severed');
  assert(res.crawler, 'Must convert to crawler');
  assert.strictEqual(z.dismembered.legL, true);
  assert.strictEqual(z.isCrawler, true);
  assert.strictEqual(z.speed, 0.8, 'Crawler speed must be 0.8 m/s');
  assert.strictEqual(z.reach, 0.95, 'Crawler reach must target player ankles');
  assert.strictEqual(z.radius, 0.38, 'Crawler collision profile must be narrower');
  assert.strictEqual(z.rig.legL.knee.visible, false, 'Lower leg must be detached');
});

test('Boss and brute archetypes cannot be turned into crawlers', () => {
  const brute = makeMockZombie(350, 45, 'brute');
  const resBrute = severZombieLimb(brute, 'legR');
  assert.strictEqual(brute.isCrawler, false, 'Brutes cannot be turned into crawlers');

  const boss = makeMockZombie(900, 60, 'walker');
  boss.isBoss = true;
  const resBoss = severZombieLimb(boss, 'legL');
  assert.strictEqual(boss.isCrawler, false, 'Bosses cannot be turned into crawlers');
});

test('settleRagdollDeath prevents curb penetration and freezes physics after landing', () => {
  const z = makeMockZombie(0, 0);
  z.alive = false;
  z.group.position.set(2.0, 0, 4.0);

  // Street curb obstacle at x: 2.3, z: 4.0 with half-width 0.2
  const colliders = [{ x: 2.3, z: 4.0, hx: 0.2, hz: 0.5 }];

  // Simulate falling phase (dt = 0.2s)
  settleRagdollDeath(z, 0.2, colliders);
  assert(z.deadTimer > 0);
  assert(z.group.position.x < 2.05, 'Curb collider must push ragdoll outward to prevent curb penetration');

  // Advance past landing threshold (dt = 0.5s -> deadTimer = 0.7s > 0.55s)
  settleRagdollDeath(z, 0.5, colliders);
  assert.strictEqual(z.ragdollSettled, true, 'Ragdoll must be settled');

  const settledX = z.group.position.x;
  const settledZ = z.group.position.z;

  // Further updates must NOT jitter settled coordinates
  settleRagdollDeath(z, 0.1, colliders);
  assert.strictEqual(z.group.position.x, settledX, 'Settled ragdoll position must remain rock solid (no jitter)');
  assert.strictEqual(z.group.position.z, settledZ, 'Settled ragdoll position must remain rock solid (no jitter)');
});
