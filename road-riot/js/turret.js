// Road Riot 3D - 180-Degree Checkpoint Roof Turret & Airborne Drone Defense System
import * as THREE from 'three';

export class TurretDefenseSystem {
  constructor(scene, player, audio) {
    this.scene = scene;
    this.player = player;
    this.audio = audio;

    // State
    this.isActive = false;
    this.isDeploying = false;
    this.isRetracting = false;
    this.deployProgress = 0; // 0 (hidden inside roof) to 1 (fully mounted)
    this.currentWave = 0;
    this.totalWaves = 3;
    this.drones = [];
    this.plasmaBolts = [];
    this.droneExplosions = [];

    // Aiming angles (radians)
    this.aimYaw = 0;   // -PI/2 (-90 deg) to +PI/2 (+90 deg)
    this.aimPitch = 0.15; // 0 to 0.7 rad (~40 deg elevation)
    this.targetYaw = 0;
    this.targetPitch = 0.15;
    this.isFiring = false;
    this.fireTimer = 0;
    this.fireCadence = 0.11; // ~9 rounds per second
    this.fireBarrelToggle = 0;

    // 3D Meshes
    this.turretGroup = null;
    this.turretBase = null;
    this.turretMantlet = null;
    this.leftBarrel = null;
    this.rightBarrel = null;
    this.roofHatch = null;
    this.muzzleLight = null;
    this.gunnerMesh = null;
    this.gunnerArms = null;
    this.gunnerHead = null;
    this.recoilOffset = 0;

    // Shared Geometries & Materials
    this.plasmaGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8);
    this.plasmaGeo.rotateX(Math.PI / 2);
    this.plasmaMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    this.droneRotorGeo = new THREE.TorusGeometry(0.38, 0.04, 6, 16);
    this.droneRotorGeo.rotateX(Math.PI / 2);
    this.droneRotorMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });

    this.buildTurretMesh();
  }

  buildTurretMesh() {
    this.turretGroup = new THREE.Group();
    this.turretGroup.visible = false;

    // 1. Sliding Roof Hatch (Dark carbon panel)
    const hatchGeo = new THREE.BoxGeometry(0.95, 0.04, 1.1);
    const hatchMat = new THREE.MeshStandardMaterial({ color: 0x121720, roughness: 0.4, metalness: 0.8 });
    this.roofHatch = new THREE.Mesh(hatchGeo, hatchMat);
    this.roofHatch.position.set(0, 0.88, -0.15);
    this.turretGroup.add(this.roofHatch);

    // 2. Heavy Circular Turret Pivot Base
    const baseGeo = new THREE.CylinderGeometry(0.42, 0.48, 0.16, 20);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.5, metalness: 0.85 });
    this.turretBase = new THREE.Mesh(baseGeo, baseMat);
    this.turretBase.position.set(0, 0.82, -0.15);
    this.turretGroup.add(this.turretBase);

    // 3. Aimable Turret Mantlet (Yaw & Pitch mount)
    const mantletGeo = new THREE.BoxGeometry(0.62, 0.35, 0.65);
    const mantletMat = new THREE.MeshStandardMaterial({ color: 0x0e1622, roughness: 0.3, metalness: 0.9 });
    this.turretMantlet = new THREE.Mesh(mantletGeo, mantletMat);
    this.turretMantlet.position.set(0, 0.22, 0);
    this.turretBase.add(this.turretMantlet);

    // Futuristic glowing power core on mantlet
    const coreMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x00d9ff })
    );
    coreMesh.position.set(0, 0.16, -0.1);
    this.turretMantlet.add(coreMesh);

    // 4. Twin Heavy Plasma Barrels
    const barrelGeo = new THREE.CylinderGeometry(0.06, 0.075, 1.1, 12);
    barrelGeo.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x242e3d, roughness: 0.2, metalness: 0.95 });

    const muzzleMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const muzzleRingGeo = new THREE.TorusGeometry(0.09, 0.025, 8, 16);

    // Left Barrel
    this.leftBarrel = new THREE.Mesh(barrelGeo, barrelMat);
    this.leftBarrel.position.set(-0.22, 0.02, -0.55);
    const leftRing = new THREE.Mesh(muzzleRingGeo, muzzleMat);
    leftRing.position.set(0, 0, -0.52);
    this.leftBarrel.add(leftRing);
    this.turretMantlet.add(this.leftBarrel);

    // Right Barrel
    this.rightBarrel = new THREE.Mesh(barrelGeo, barrelMat);
    this.rightBarrel.position.set(0.22, 0.02, -0.55);
    const rightRing = new THREE.Mesh(muzzleRingGeo, muzzleMat);
    rightRing.position.set(0, 0, -0.52);
    this.rightBarrel.add(rightRing);
    this.turretMantlet.add(this.rightBarrel);

    // 5. Muzzle Flash Light
    this.muzzleLight = new THREE.PointLight(0x00f0ff, 0, 8);
    this.muzzleLight.position.set(0, 0, -1.2);
    this.turretMantlet.add(this.muzzleLight);

    // 6. Dual Gunner Control Grips with Trigger Switches on rear of mantlet (+Z)
    [-0.17, 0.17].forEach(hx => {
      const handleBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.24, 8),
        new THREE.MeshStandardMaterial({ color: 0x111622, metalness: 0.9, roughness: 0.2 })
      );
      handleBar.position.set(hx, -0.06, 0.34);
      this.turretMantlet.add(handleBar);

      const trigger = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.06, 0.05),
        new THREE.MeshBasicMaterial({ color: 0x00ffff })
      );
      trigger.position.set(hx, -0.06, 0.36);
      this.turretMantlet.add(trigger);
    });

    // 7. Tactical 3D Human Gunner Character (Emerged on roof behind twin plasma cannons)
    this.gunnerMesh = this.buildGunnerMesh();
    this.turretBase.add(this.gunnerMesh);

    if (this.player && this.player.chassis) {
      this.player.chassis.add(this.turretGroup);
    }
  }

  buildGunnerMesh() {
    const group = new THREE.Group();

    // High-tech Tactical Spec-Ops Pilot materials
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x162232, // Tactical stealth navy
      roughness: 0.65,
      metalness: 0.35
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x090f18, // Matte carbon fiber tactical plates
      roughness: 0.32,
      metalness: 0.88
    });
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x1a2436,
      roughness: 0.22,
      metalness: 0.8
    });
    const visorMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff // Glowing electric cyan holographic targeting visor
    });
    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0x0c1017,
      roughness: 0.85,
      metalness: 0.2
    });
    const cyanCoreMat = new THREE.MeshBasicMaterial({
      color: 0x00d9ff
    });

    // Lower Body Hatch Anchor (Waist emerging from roof hatch)
    const waist = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.25, 0.24), suitMat);
    waist.position.set(0, 0.12, 0);
    group.add(waist);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.08, 0.26), armorMat);
    belt.position.set(0, 0.22, 0);
    group.add(belt);

    // Torso with Tactical Ballistic Armor Plates
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.26), suitMat);
    torso.position.set(0, 0.48, 0);
    torso.castShadow = true;
    group.add(torso);

    // Armored Chest Plate
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.08), armorMat);
    chestPlate.position.set(0, 0.52, -0.13);
    group.add(chestPlate);

    // Glowing Cybernetic HUD Core on Chest
    const chestCore = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), cyanCoreMat);
    chestCore.position.set(0, 0.52, -0.18);
    group.add(chestCore);

    // Tactical Ammo & Power Supply Backpack Unit on back (+Z)
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.14), armorMat);
    pack.position.set(0, 0.50, 0.18);
    group.add(pack);

    // Head & High-Tech Cyber Pilot Helmet with Glowing Visor
    this.gunnerHead = new THREE.Group();
    this.gunnerHead.position.set(0, 0.82, -0.02);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), helmetMat);
    this.gunnerHead.add(helmet);

    // Full-face curved holographic targeting visor (-Z facing forward towards targets)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.09), visorMat);
    visor.position.set(0, 0.02, -0.13);
    this.gunnerHead.add(visor);

    // Tactical Helmet Side Comms & Sensor Pods
    [-0.16, 0.16].forEach(x => {
      const earPod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), armorMat);
      earPod.rotation.z = Math.PI / 2;
      earPod.position.set(x, 0.02, -0.02);
      this.gunnerHead.add(earPod);
    });
    group.add(this.gunnerHead);

    // Dual Shoulders & Arms Gripping the Plasma Turret Controls
    this.gunnerArms = new THREE.Group();
    this.gunnerArms.position.set(0, 0.58, 0);
    group.add(this.gunnerArms);

    [-0.24, 0.24].forEach(sideX => {
      // Armored Shoulder Pauldron
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), armorMat);
      shoulder.position.set(sideX, 0, 0);
      this.gunnerArms.add(shoulder);

      // Upper Arm angled forward towards the turret mantlet handles
      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.34, 8), suitMat);
      upperArm.rotation.x = Math.PI / 3.2;
      upperArm.rotation.z = (sideX < 0 ? -1 : 1) * 0.18;
      upperArm.position.set(sideX * 0.95, -0.11, -0.14);
      this.gunnerArms.add(upperArm);

      // Forearm with Reinforced Gauntlet
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.30, 8), armorMat);
      forearm.rotation.x = Math.PI / 2.1;
      forearm.rotation.z = (sideX < 0 ? 1 : -1) * 0.12;
      forearm.position.set(sideX * 0.8, -0.18, -0.32);
      this.gunnerArms.add(forearm);

      // Combat Glove gripping handle
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.10), gloveMat);
      hand.position.set(sideX * 0.7, -0.20, -0.46);
      this.gunnerArms.add(hand);
    });

    // Position gunner standing behind the turret base and mantlet
    group.position.set(0, 0.08, 0.44);
    return group;
  }

  // --- START TURRET DEFENSE CHECKPOINT SEQUENCE ---
  startDefense(waveIndex = 1) {
    this.isActive = true;
    this.isDeploying = true;
    this.isRetracting = false;
    this.deployProgress = 0;
    this.currentWave = waveIndex;
    this.turretGroup.visible = true;

    // Reset roof hatch and turret position
    this.turretBase.position.y = 0.35; // submerged inside car cabin
    this.roofHatch.position.z = -0.15;
    if (this.gunnerMesh) {
      this.gunnerMesh.position.y = -0.55; // human below roof line
      this.gunnerMesh.scale.setScalar(0.05); // compressed inside car
    }

    // Reset aim
    this.aimYaw = 0;
    this.aimPitch = 0.15;
    this.targetYaw = 0;
    this.targetPitch = 0.15;

    this.audio.play('boost_pad');
    this.spawnWave(this.currentWave);
  }

  spawnWave(wave) {
    // Clear any lingering drones
    this.drones.forEach(d => this.scene.remove(d.mesh));
    this.drones = [];

    // Wave Configurations:
    // Wave 1: 4 Scout Drones swooping in formation
    // Wave 2: 6 Assault Drones strafing
    // Wave 3: 1 Heavy Commander Drone (6 HP) + 4 Escorts
    const droneConfigs = [];
    if (wave === 1) {
      for (let i = 0; i < 4; i++) {
        const spreadX = (i - 1.5) * 4.5;
        droneConfigs.push({
          type: 'scout',
          hp: 2,
          maxHp: 2,
          x: spreadX,
          y: 16 + Math.random() * 4,
          z: -55 - i * 6,
          swoopSpeed: 1.2 + Math.random() * 0.4,
          swoopPhase: i * 0.8,
          scale: 1.0
        });
      }
    } else if (wave === 2) {
      for (let i = 0; i < 6; i++) {
        const spreadX = (i - 2.5) * 3.8;
        droneConfigs.push({
          type: 'assault',
          hp: 2,
          maxHp: 2,
          x: spreadX,
          y: 18 + (i % 2) * 5,
          z: -60 - (i % 3) * 8,
          swoopSpeed: 1.6 + Math.random() * 0.5,
          swoopPhase: i * 0.6,
          scale: 1.1
        });
      }
    } else {
      // Commander Boss Wave
      droneConfigs.push({
        type: 'commander',
        hp: 6,
        maxHp: 6,
        x: 0,
        y: 20,
        z: -65,
        swoopSpeed: 0.9,
        swoopPhase: 0,
        scale: 1.75
      });
      [-6, -3, 3, 6].forEach((spreadX, idx) => {
        droneConfigs.push({
          type: 'escort',
          hp: 2,
          maxHp: 2,
          x: spreadX,
          y: 16 + (idx % 2) * 4,
          z: -55 - idx * 4,
          swoopSpeed: 1.5,
          swoopPhase: idx * 0.9,
          scale: 1.0
        });
      });
    }

    droneConfigs.forEach(cfg => {
      const droneMesh = this.buildDroneMesh(cfg);
      droneMesh.position.set(cfg.x, cfg.y, cfg.z);
      this.scene.add(droneMesh);

      this.drones.push({
        ...cfg,
        mesh: droneMesh,
        baseY: cfg.y,
        baseZ: cfg.z,
        time: 0,
        isDestroyed: false
      });
    });
  }

  buildDroneMesh(cfg) {
    const group = new THREE.Group();
    group.scale.setScalar(cfg.scale);

    const isBoss = cfg.type === 'commander';
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isBoss ? 0x2b1016 : 0x141a24,
      roughness: 0.35,
      metalness: 0.8
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: isBoss ? 0xff0044 : 0x00d9ff });

    // Aerodynamic Diamond Central Fuselage
    const bodyGeo = new THREE.OctahedronGeometry(0.7, 1);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1.4, 0.45, 1.0);
    group.add(body);

    // Glowing Menacing Central Eye Sensor
    const eyeGeo = new THREE.SphereGeometry(0.28, 16, 16);
    const eye = new THREE.Mesh(eyeGeo, glowMat);
    eye.position.set(0, 0, 0.5);
    group.add(eye);

    // 4 Rotor Outriggers with Spinning Glowing Discs
    const rotorOffsets = [
      [-1.1, 0, -0.6],
      [1.1, 0, -0.6],
      [-1.1, 0, 0.6],
      [1.1, 0, 0.6]
    ];
    rotorOffsets.forEach(([rx, ry, rz]) => {
      const armGeo = new THREE.BoxGeometry(0.15, 0.08, 0.9);
      const arm = new THREE.Mesh(armGeo, bodyMat);
      arm.position.set(rx * 0.5, 0, rz * 0.5);
      arm.rotation.y = Math.atan2(rx, rz);
      group.add(arm);

      const rotor = new THREE.Mesh(this.droneRotorGeo, isBoss ? new THREE.MeshBasicMaterial({ color: 0xffaa00 }) : this.droneRotorMat);
      rotor.position.set(rx, 0.08, rz);
      group.add(rotor);
    });

    // Underside Laser Blaster Pods
    [-0.45, 0.45].forEach(lx => {
      const podGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.6, 8);
      podGeo.rotateX(Math.PI / 2);
      const pod = new THREE.Mesh(podGeo, bodyMat);
      pod.position.set(lx, -0.22, 0.2);
      group.add(pod);
    });

    return group;
  }

  // Set Aim from normalized screen coordinates (-1 to +1 horizontal, -1 to +1 vertical)
  setAimNormalized(normX, normY) {
    // 180-Degree Panoramic Aim Arc: Horizontal -PI/2 (-90 deg) to +PI/2 (+90 deg)
    this.targetYaw = -normX * (Math.PI * 0.52);
    // Vertical Elevation: 0 (level) to ~0.7 rad (40 degrees skyward)
    this.targetPitch = THREE.MathUtils.clamp(-normY * 0.5 + 0.15, -0.1, 0.75);
  }

  triggerFire() {
    if (!this.isActive || this.deployProgress < 0.9) return;
    this.isFiring = true;
  }

  stopFire() {
    this.isFiring = false;
  }

  fireSingleBolt() {
    this.fireBarrelToggle = (this.fireBarrelToggle + 1) % 2;
    const isLeft = this.fireBarrelToggle === 0;
    const activeBarrel = isLeft ? this.leftBarrel : this.rightBarrel;

    // Get muzzle world position
    const muzzlePos = new THREE.Vector3();
    activeBarrel.getWorldPosition(muzzlePos);
    muzzlePos.y += 0.05;

    // Calculate aim direction from mantlet rotation & player orientation
    const dir = new THREE.Vector3(0, 0, -1);
    const quat = new THREE.Quaternion();
    this.turretMantlet.getWorldQuaternion(quat);
    dir.applyQuaternion(quat).normalize();

    // Spawn Plasma Bolt Mesh
    const bolt = new THREE.Mesh(this.plasmaGeo, this.plasmaMat);
    bolt.position.copy(muzzlePos);
    bolt.quaternion.copy(quat);
    this.scene.add(bolt);

    this.plasmaBolts.push({
      mesh: bolt,
      dir,
      speed: 210, // 210 m/s
      life: 1.2
    });

    // Muzzle Flash Effect
    if (this.muzzleLight) {
      this.muzzleLight.intensity = 5.0;
      setTimeout(() => { if (this.muzzleLight) this.muzzleLight.intensity = 0; }, 45);
    }

    // Audio SFX
    this.audio.play('laser');
  }

  spawnExplosion(pos, color = 0xff3355) {
    const count = 18;
    const particles = [];
    const pGeo = new THREE.SphereGeometry(0.18, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({ color });

    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        Math.random() * 12 + 2,
        (Math.random() - 0.5) * 16
      );
      this.scene.add(p);
      particles.push({ mesh: p, vel, life: 0.65 });
    }

    this.droneExplosions.push({ particles, mat: pMat });
  }

  update(dt, callbacks = {}) {
    if (!this.isActive) return;

    // 1. Hydraulic Mounting & Dismounting Animation (Human & Turret emerge / retract)
    if (this.isDeploying) {
      this.deployProgress = Math.min(1, this.deployProgress + dt * 2.0);
      // Roof hatch slides open backward
      this.roofHatch.position.z = -0.15 - this.deployProgress * 0.55;
      // Heavy turret base elevates out of car roof
      this.turretBase.position.y = 0.35 + this.deployProgress * 0.55;
      // 3D Human Gunner emerges from the cabin through roof hatch
      if (this.gunnerMesh) {
        this.gunnerMesh.position.y = -0.55 + this.deployProgress * 0.63;
        this.gunnerMesh.scale.setScalar(Math.min(1, 0.1 + this.deployProgress * 0.9));
      }
      if (this.deployProgress >= 1) this.isDeploying = false;
    } else if (this.isRetracting) {
      this.deployProgress = Math.max(0, this.deployProgress - dt * 2.2);
      // Human gunner lowers back inside vehicle cabin
      this.roofHatch.position.z = -0.70 + (1 - this.deployProgress) * 0.55;
      this.turretBase.position.y = 0.35 + this.deployProgress * 0.55;
      if (this.gunnerMesh) {
        this.gunnerMesh.position.y = -0.55 + this.deployProgress * 0.63;
        this.gunnerMesh.scale.setScalar(Math.max(0.05, this.deployProgress));
      }
      if (this.deployProgress <= 0) {
        this.isRetracting = false;
        this.isActive = false;
        this.turretGroup.visible = false;
        if (callbacks.onComplete) callbacks.onComplete();
      }
    }

    // 2. Smooth Aim Tracking across 180° Panoramic Arc (Horizontal & Vertical)
    this.aimYaw += (this.targetYaw - this.aimYaw) * Math.min(1, dt * 14);
    this.aimPitch += (this.targetPitch - this.aimPitch) * Math.min(1, dt * 14);
    if (this.turretBase) this.turretBase.rotation.y = this.aimYaw;
    if (this.turretMantlet) this.turretMantlet.rotation.x = this.aimPitch;
    // Human gunner's arms and pilot helmet pitch in sync with the twin plasma cannons
    if (this.gunnerArms) this.gunnerArms.rotation.x = this.aimPitch * 0.85;
    if (this.gunnerHead) this.gunnerHead.rotation.x = this.aimPitch * 0.45;

    // Recoil recovery
    this.recoilOffset = Math.max(0, this.recoilOffset - dt * 10);
    if (this.gunnerArms) this.gunnerArms.position.z = this.recoilOffset * 0.04;
    if (this.leftBarrel) this.leftBarrel.position.z = -0.55 + (this.fireBarrelToggle === 0 ? this.recoilOffset * 0.06 : 0);
    if (this.rightBarrel) this.rightBarrel.position.z = -0.55 + (this.fireBarrelToggle === 1 ? this.recoilOffset * 0.06 : 0);

    // 3. Continuous Plasma Cannon Firing
    if (this.isFiring && this.deployProgress >= 0.95) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = this.fireCadence;
        this.fireSingleBolt();
        this.recoilOffset = 1.0;
      }
    }

    // 4. Update Plasma Projectiles & Drone Hit Testing
    for (let i = this.plasmaBolts.length - 1; i >= 0; i--) {
      const b = this.plasmaBolts[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.dir, b.speed * dt);

      // Hit check against active drones
      let boltRemoved = false;
      for (const d of this.drones) {
        if (d.isDestroyed) continue;
        const dist = b.mesh.position.distanceTo(d.mesh.position);
        if (dist < 2.0 * d.scale) {
          d.hp -= 1;
          this.spawnExplosion(b.mesh.position, 0x00f0ff);
          this.audio.play('collision');

          if (d.hp <= 0) {
            d.isDestroyed = true;
            this.scene.remove(d.mesh);
            this.spawnExplosion(d.mesh.position, d.type === 'commander' ? 0xffaa00 : 0xff2a44);
            this.audio.play('fever');
            if (callbacks.onDroneKilled) callbacks.onDroneKilled(d);
          }

          this.scene.remove(b.mesh);
          this.plasmaBolts.splice(i, 1);
          boltRemoved = true;
          break;
        }
      }

      if (!boltRemoved && (b.life <= 0 || b.mesh.position.z < -200 || b.mesh.position.y > 100)) {
        this.scene.remove(b.mesh);
        this.plasmaBolts.splice(i, 1);
      }
    }

    // 5. Update Drone Swarm AI & Flight Dynamics
    let aliveDronesCount = 0;
    this.drones.forEach(d => {
      if (d.isDestroyed) return;
      aliveDronesCount++;
      d.time += dt * d.swoopSpeed;

      // Dynamic swooping 3D flight paths
      const swoopX = Math.sin(d.time + d.swoopPhase) * 6.5;
      const swoopY = Math.sin(d.time * 1.5 + d.swoopPhase) * 3.5;
      d.mesh.position.x = d.x + swoopX;
      d.mesh.position.y = d.baseY + swoopY;

      // Slight banking turn rotation
      d.mesh.rotation.z = Math.cos(d.time + d.swoopPhase) * 0.35;
      d.mesh.rotation.x = Math.sin(d.time * 1.5) * 0.2;
    });

    // 6. Update Particle Explosions
    for (let i = this.droneExplosions.length - 1; i >= 0; i--) {
      const exp = this.droneExplosions[i];
      let hasLiveParticles = false;
      exp.particles.forEach(p => {
        p.life -= dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.scale.multiplyScalar(0.96);
        if (p.life > 0) hasLiveParticles = true;
        else this.scene.remove(p.mesh);
      });
      if (!hasLiveParticles) {
        if (exp.mat) exp.mat.dispose();
        this.droneExplosions.splice(i, 1);
      }
    }

    // 7. Wave Clearance Check
    if (aliveDronesCount === 0 && !this.isRetracting && !this.isDeploying) {
      if (this.currentWave < this.totalWaves) {
        this.currentWave++;
        this.spawnWave(this.currentWave);
        if (callbacks.onWaveAdvancing) callbacks.onWaveAdvancing(this.currentWave);
      } else {
        // Complete checkpoint victory!
        this.isRetracting = true;
        if (callbacks.onDefenseSecured) callbacks.onDefenseSecured();
      }
    }
  }

  cleanup() {
    this.isActive = false;
    this.isDeploying = false;
    this.isRetracting = false;
    this.drones.forEach(d => this.scene.remove(d.mesh));
    this.drones = [];
    this.plasmaBolts.forEach(b => this.scene.remove(b.mesh));
    this.plasmaBolts = [];
    if (this.turretGroup) this.turretGroup.visible = false;
    if (this.gunnerMesh) {
      this.gunnerMesh.position.y = -0.55;
      this.gunnerMesh.scale.setScalar(0.05);
    }
  }
}
