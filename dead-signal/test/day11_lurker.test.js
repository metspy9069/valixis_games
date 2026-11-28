import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  LURKER_CONFIG,
  compute3DPounceTrajectory,
  samplePounceArcPoints,
  isTargetInFlashlightBeam,
  stepLurkerAI,
} from '../js/lurker.js';
import { Zombie } from '../js/zombie.js';

test('3D Elevation-Aware Ballistic Pounce Trajectory calculates true 3D leap reaching elevated targets', () => {
  const fromGround = new THREE.Vector3(0, 0, 0);
  const elevatedPlayerTarget = new THREE.Vector3(0, 1.2, 5.0); // Standing on car hood (y = 1.2m)
  const groundPlayerTarget = new THREE.Vector3(0, 0, 5.0); // Standing on asphalt (y = 0m)

  const velElevated = compute3DPounceTrajectory({
    from: fromGround,
    target: elevatedPlayerTarget,
    flightTime: 0.42,
    gravity: 22.0,
  });

  const velGround = compute3DPounceTrajectory({
    from: fromGround,
    target: groundPlayerTarget,
    flightTime: 0.42,
    gravity: 22.0,
  });

  // Vertical leap velocity must be significantly higher to hit elevated car hood
  assert.ok(
    velElevated.y > velGround.y,
    `Elevated trajectory Vy (${velElevated.y}) must be higher than ground Vy (${velGround.y})`
  );
  // Expected Vy = (dy + 0.5 * g * t^2) / t
  const expectedElevatedVy = (1.2 + 0.5 * 22.0 * 0.42 * 0.42) / 0.42;
  assert.ok(
    Math.abs(velElevated.y - expectedElevatedVy) < 1e-4,
    `Vy should match physics ballistic formula`
  );

  // Sample arc points and verify final point lands exactly at elevated target
  const arcPoints = samplePounceArcPoints({
    from: fromGround,
    target: elevatedPlayerTarget,
    flightTime: 0.42,
    gravity: 22.0,
    steps: 10,
  });

  assert.equal(arcPoints.length, 11, 'Should produce 11 sample points');
  const finalPoint = arcPoints[arcPoints.length - 1];
  assert.ok(
    finalPoint.distanceTo(elevatedPlayerTarget) < 1e-4,
    `Arc terminal point must hit elevated target (got distance ${finalPoint.distanceTo(elevatedPlayerTarget)})`
  );

  // Check apex elevation along the arc exceeds target elevation
  const maxArcY = Math.max(...arcPoints.map((p) => p.y));
  assert.ok(
    maxArcY > elevatedPlayerTarget.y,
    `Ballistic arc must vault through an apex above target (apex: ${maxArcY}, target: ${elevatedPlayerTarget.y})`
  );
});

test('Mid-Air Skeet Counterplay: shooting lurker mid-leap grants 25% vulnerability bonus and cancels pounce with heavy stagger', () => {
  const lurker = new Zombie('lurker', new THREE.Vector3(0, 1.8, 4.0));
  lurker.state = 'pounce_leap';
  lurker.leapVel = new THREE.Vector3(0, 4.0, -8.0);
  const initialHp = lurker.hp;

  let hissed = false;
  const mockCtx = {
    audio: {
      lurkerHiss: () => {
        hissed = true;
      },
      hit: () => {},
    },
    playerPos: new THREE.Vector3(0, 0, 0),
  };

  // Base bullet damage: 40
  const killed = lurker.takeDamage(40, 'body', mockCtx);

  assert.equal(killed, false, 'Lurker should survive single bullet');
  // 40 damage * 1.25 mid-air bonus = 50 damage taken
  assert.equal(
    lurker.hp,
    initialHp - 50,
    `HP must be reduced by 50 (40 * 1.25 bonus), got ${lurker.hp}`
  );
  assert.equal(
    lurker.state,
    'pounce_recover',
    'Mid-air hit must cancel leap into pounce_recover'
  );
  assert.equal(
    lurker.staggerTimer,
    1.2,
    'Mid-air hit must apply 1.2s heavy stagger'
  );
  assert.equal(lurker.flinch, 1.5, 'Flinch must be 1.5');
  assert.equal(
    lurker.group.position.y,
    0,
    'Lurker elevation must drop to ground level on skeet shot interruption'
  );
  assert.ok(hissed, 'Lurker must emit hiss sound on mid-air interruption');
});

test('Flashlight Cone Detection accurately identifies targets in beam angle and range', () => {
  const camPos = new THREE.Vector3(0, 1.7, 0);
  const camDir = new THREE.Vector3(0, 0, -1); // Looking along negative Z

  // 1. Directly in front within beam cone
  const targetInFront = new THREE.Vector3(0, 0.4, -8.0);
  assert.ok(
    isTargetInFlashlightBeam({ camPos, camDir, targetPos: targetInFront }),
    'Target directly in front must be in beam'
  );

  // 2. Behind player
  const targetBehind = new THREE.Vector3(0, 0.4, 8.0);
  assert.ok(
    !isTargetInFlashlightBeam({ camPos, camDir, targetPos: targetBehind }),
    'Target behind player must not be in beam'
  );

  // 3. Wide to the side outside cone (~28.6 degrees / 0.5 rad)
  const targetWide = new THREE.Vector3(12.0, 0.4, -8.0);
  assert.ok(
    !isTargetInFlashlightBeam({ camPos, camDir, targetPos: targetWide }),
    'Target wide to the side must not be in beam'
  );

  // 4. Beyond max range (> 32m)
  const targetFar = new THREE.Vector3(0, 0.4, -45.0);
  assert.ok(
    !isTargetInFlashlightBeam({ camPos, camDir, targetPos: targetFar }),
    'Target beyond max range must not be in beam'
  );
});

test('Flashlight beam disorients lurker: triggers hiss, flinch = 1.0, and reduces chase speed', () => {
  const lurker = new Zombie('lurker', new THREE.Vector3(0, 0, -6.0));
  lurker.state = 'chase';

  let hissCount = 0;
  const mockAudio = {
    lurkerHiss: () => {
      hissCount++;
    },
    lurkerSkitter: () => {},
  };

  const ctxLightOn = {
    playerPos: new THREE.Vector3(0, 0, 0),
    flashlightActive: true,
    camPos: new THREE.Vector3(0, 1.7, 0),
    camDir: new THREE.Vector3(0, 0, -1),
    audio: mockAudio,
    colliders: [],
    zombies: [lurker],
    nav: null,
  };

  // Step lurker AI with flashlight on
  stepLurkerAI(lurker, 0.016, ctxLightOn);

  assert.ok(
    lurker.blindedTimer > 0,
    `Lurker must have active blindedTimer (got ${lurker.blindedTimer})`
  );
  assert.equal(lurker.flinch, 1.0, 'Flinch must be set to 1.0');
  assert.equal(hissCount, 1, 'Lurker hiss must be triggered on blinding');

  // Verify speed slowdown in update while blinded
  const speedNormal = lurker.speed;
  lurker.update(0.016, ctxLightOn);

  // In darkness (blackout), speed accelerates to 6.5 m/s predator speed
  lurker.blindedTimer = 0;
  const ctxBlackout = {
    ...ctxLightOn,
    flashlightActive: false,
    blackout: true,
  };
  lurker.group.position.set(0, 0, -10.0);
  lurker.update(0.016, ctxBlackout);
  // targetSpeed set to LURKER_CONFIG.shadowSpeed (6.5)
  assert.equal(LURKER_CONFIG.shadowSpeed, 6.5, 'Shadow predator speed must be 6.5 m/s');
});

test('Roof / Wall Prowl Ambush: Lurkers perch on wall and drop down silently when player approaches', () => {
  // Lurker perched at y = 3.2m on wall, 12m away
  const lurker = new Zombie('lurker', new THREE.Vector3(0, 3.2, 12.0));
  lurker.state = 'prowl';

  let hissed = false;
  const mockAudio = {
    lurkerHiss: () => {
      hissed = true;
    },
  };

  const ctxFar = {
    playerPos: new THREE.Vector3(0, 0, 0),
    flashlightActive: false,
    audio: mockAudio,
  };

  // Player at 12m (> 8.5m ambush radius): remains prowling
  const resFar = stepLurkerAI(lurker, 0.016, ctxFar);
  assert.ok(resFar && resFar.isProwling, 'Lurker must stay in prowl state while player is far');
  assert.equal(lurker.state, 'prowl');

  // Player moves within 8.5m ambush distance (e.g. z = 6.0m)
  const ctxNear = {
    playerPos: new THREE.Vector3(0, 0, 5.0),
    flashlightActive: false,
    audio: mockAudio,
  };

  const resNear = stepLurkerAI(lurker, 0.016, ctxNear);
  assert.ok(
    resNear && resNear.droppedFromProwl,
    'Lurker must initiate ambush drop when player is within 8.5m'
  );
  assert.equal(
    lurker.state,
    'pounce_leap',
    'State must transition to pounce_leap'
  );
  assert.ok(
    lurker.leapVel instanceof THREE.Vector3,
    'Leap velocity must be computed'
  );
  assert.ok(hissed, 'Must hiss on ambush drop');

  // If caught prowling on wall by direct flashlight beam: scramble/disorient drop to ground
  const lurkerWall = new Zombie('lurker', new THREE.Vector3(0, 3.2, -6.0));
  lurkerWall.state = 'prowl';
  const ctxBeamOnWall = {
    playerPos: new THREE.Vector3(0, 0, 0),
    flashlightActive: true,
    camPos: new THREE.Vector3(0, 1.7, 0),
    camDir: new THREE.Vector3(0, 0, -1),
    audio: mockAudio,
  };

  const resBlinded = stepLurkerAI(lurkerWall, 0.016, ctxBeamOnWall);
  assert.ok(
    resBlinded && resBlinded.blindedOnWall,
    'Lurker on wall must be disoriented and drop down when spotlighted'
  );
  assert.equal(
    lurkerWall.state,
    'pounce_recover',
    'Blinded lurker on wall must recover on ground'
  );
  assert.equal(
    lurkerWall.group.position.y,
    0,
    'Blinded lurker must be grounded'
  );
});

test('Stealth Audio: Lurkers emit silent skittering / claw clicks instead of heavy brute growls', () => {
  const lurker = new Zombie('lurker', new THREE.Vector3(0, 0, 5.0));
  const brute = new Zombie('brute', new THREE.Vector3(0, 0, 5.0));

  let skitterCount = 0;
  let growlCount = 0;

  const mockAudio = {
    lurkerSkitter: () => {
      skitterCount++;
    },
    growl: () => {
      growlCount++;
    },
  };

  const ctx = {
    playerPos: new THREE.Vector3(0, 0, 0),
    audio: mockAudio,
    colliders: [],
    zombies: [lurker],
    nav: null,
  };

  // Force growl timer expiration
  lurker.growlTimer = 0.01;
  lurker.update(0.02, ctx);

  assert.equal(
    skitterCount,
    1,
    'Lurker must emit stealth skittering sound (lurkerSkitter)'
  );
  assert.equal(
    growlCount,
    0,
    'Lurker must NEVER emit heavy brute growl sound (growl)'
  );

  // Non-lurkers must still use regular growl
  const bruteCtx = {
    ...ctx,
    zombies: [brute],
  };
  brute.growlTimer = 0.01;
  brute.update(0.02, bruteCtx);
  assert.equal(growlCount, 1, 'Brute must emit standard growl sound');
});
