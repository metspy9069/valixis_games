// road-riot/js/pedestrians.js – Lifelike Sidewalk Pedestrians with Human Gait & Reactive AI
import * as THREE from 'three';

export class PedestrianManager {
  constructor(scene) {
    this.scene = scene;
    this.pedestrians = [];
    this.spawnCount = 10;
    this.sidewalkOffsets = [-10.8, 10.8]; // Left and right elevated sidewalks

    this.spawnPedestrians();
  }

  spawnPedestrians() {
    const palette = [
      { jacket: 0x00d9ff, pants: 0x141b27, hair: 0x1a1a1a }, // Cyan hoodie
      { jacket: 0xff2a85, pants: 0x182030, hair: 0x3d2314 }, // Magenta windbreaker
      { jacket: 0xffb800, pants: 0x242b35, hair: 0x111111 }, // Ochre jacket
      { jacket: 0xe6edf3, pants: 0x0f141c, hair: 0x4a3728 }, // White minimalist coat
      { jacket: 0x9d4edd, pants: 0x161e2b, hair: 0x222222 }, // Neon purple streetwear
      { jacket: 0x00ff88, pants: 0x111822, hair: 0x332211 }  // Cyber emerald jacket
    ];

    for (let i = 0; i < this.spawnCount; i++) {
      const side = this.sidewalkOffsets[i % 2];
      const zBase = -25 - i * 24;
      const theme = palette[i % palette.length];
      const hasPhone = i % 3 === 0;

      const pedGroup = this.buildLifelikePedestrian(theme, hasPhone);
      pedGroup.position.set(side + (Math.random() - 0.5) * 0.6, 0, zBase);
      this.scene.add(pedGroup);

      this.pedestrians.push({
        mesh: pedGroup,
        baseX: side,
        speed: 1.15 + Math.random() * 0.25, // Natural human walking speed: ~1.2 m/s (4.3 km/h)
        direction: Math.random() < 0.5 ? 1 : -1, // 1: walking +Z, -1: walking -Z
        walkCycle: Math.random() * Math.PI * 2,
        hasPhone,
        targetRotY: 0,
        currentRotY: 0,
        // Articulated limbs
        head: pedGroup.userData.head,
        torso: pedGroup.userData.torso,
        leftLeg: pedGroup.userData.leftLeg,
        rightLeg: pedGroup.userData.rightLeg,
        leftArm: pedGroup.userData.leftArm,
        rightArm: pedGroup.userData.rightArm,
        phoneGlow: pedGroup.userData.phoneGlow
      });
    }
  }

  buildLifelikePedestrian(theme, hasPhone = false) {
    const group = new THREE.Group();

    // Natural Materials with realistic PBR skin & clothing textures
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe2b997, roughness: 0.65, metalness: 0.05 });
    const hairMat = new THREE.MeshStandardMaterial({ color: theme.hair, roughness: 0.8 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: theme.jacket, roughness: 0.45, metalness: 0.2 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: theme.pants, roughness: 0.75, metalness: 0.1 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.85 });
    const phoneMat = new THREE.MeshStandardMaterial({ color: 0x050b14, metalness: 0.9, roughness: 0.1 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // 1. Root Pelvis / Lower Body Group
    const pelvis = new THREE.Group();
    pelvis.position.y = 0.82;
    group.add(pelvis);

    // 2. Articulated Legs (Leg Group + Thigh + Shin + Shoe)
    const createLeg = (isLeft) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(isLeft ? -0.15 : 0.15, 0, 0);

      // Thigh & Shin (streamlined human proportions)
      const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.72, 8), pantsMat);
      legMesh.position.y = -0.36;
      legGroup.add(legMesh);

      // Sneaker
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.26), shoeMat);
      shoe.position.set(0, -0.73, -0.04);
      legGroup.add(shoe);

      pelvis.add(legGroup);
      return legGroup;
    };

    const leftLeg = createLeg(true);
    const rightLeg = createLeg(false);

    // 3. Torso & Chest Group (Allows natural upper-body counter-twist)
    const torso = new THREE.Group();
    torso.position.y = 0.85;
    group.add(torso);

    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.25), jacketMat);
    chestMesh.position.y = 0.26;
    torso.add(chestMesh);

    // 4. Head, Hair & Glasses Group (Allows lifelike glancing at supercars)
    const head = new THREE.Group();
    head.position.set(0, 0.56, 0);
    torso.add(head);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skinMat);
    headMesh.scale.set(1.0, 1.15, 1.05);
    head.add(headMesh);

    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), hairMat);
    hairMesh.position.set(0, 0.10, -0.01);
    head.add(hairMesh);

    // Cyber visor / glasses
    const visorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.05, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    visorMesh.position.set(0, 0.02, -0.13);
    head.add(visorMesh);

    // 5. Articulated Arms (Shoulder pivots with natural counter-swing)
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.27, 0.44, 0);
    const leftLimb = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.52, 8), jacketMat);
    leftLimb.position.y = -0.26;
    leftArm.add(leftLimb);
    torso.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.27, 0.44, 0);
    const rightLimb = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.52, 8), jacketMat);
    rightLimb.position.y = -0.26;
    rightArm.add(rightLimb);
    torso.add(rightArm);

    // Smartphone accessory in right hand
    let phoneGlow = null;
    if (hasPhone) {
      rightArm.rotation.x = -0.85; // Raised forearm viewing phone
      rightArm.rotation.z = -0.15;

      const phone = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.02), phoneMat);
      phone.position.set(0.02, -0.48, -0.06);
      rightArm.add(phone);

      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.12), screenMat);
      screen.position.set(0.02, -0.48, -0.05);
      screen.rotation.y = Math.PI;
      rightArm.add(screen);

      phoneGlow = new THREE.PointLight(0x00f0ff, 0.6, 1.2);
      phoneGlow.position.set(0.02, -0.48, -0.1);
      rightArm.add(phoneGlow);

      // Tilt head subtly toward screen
      head.rotation.x = 0.22;
    }

    // Shadows
    group.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    group.userData = {
      head,
      torso,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      phoneGlow
    };

    return group;
  }

  update(delta, playerSpeed = 0, playerX = 0, playerZ = -8) {
    const count = this.pedestrians.length;

    for (let i = 0; i < count; i++) {
      const p = this.pedestrians[i];
      if (!p.mesh) continue;

      // 1. Precise Longitudinal Scroll:
      // The sidewalk moves in +Z at playerSpeed * delta.
      // The pedestrian walks on the sidewalk along Z at p.direction * p.speed.
      // Combined net movement perfectly prevents sliding/ice-skating!
      p.mesh.position.z += (playerSpeed + p.direction * p.speed) * delta;

      // 2. Natural Stride Cadence: ~105-110 steps/min
      p.walkCycle += delta * (p.speed * 2.8);

      // Smooth Cosine Leg Swings
      const legAngle = Math.sin(p.walkCycle) * 0.38;
      if (p.leftLeg && p.rightLeg) {
        p.leftLeg.rotation.x = legAngle;
        p.rightLeg.rotation.x = -legAngle;
      }

      // Natural Counter-Arm Swing (arms swing opposite to legs)
      if (p.leftArm) {
        p.leftArm.rotation.x = -legAngle * 0.72;
      }
      if (p.rightArm && !p.hasPhone) {
        p.rightArm.rotation.x = legAngle * 0.72;
      }

      // Upper-body Counter-Torque & Natural Hip Bounce
      if (p.torso) {
        p.torso.rotation.y = Math.sin(p.walkCycle) * 0.06;
      }
      p.mesh.position.y = Math.abs(Math.sin(p.walkCycle)) * 0.035;

      // 3. Smooth Body Orientation & Turnaround
      p.targetRotY = p.direction > 0 ? Math.PI : 0;
      p.currentRotY = THREE.MathUtils.lerp(p.currentRotY, p.targetRotY, Math.min(1, delta * 5.0));
      p.mesh.rotation.y = p.currentRotY;

      // 4. Reactive AI: Glancing at the roaring Supercar
      if (p.head) {
        const dzToPlayer = p.mesh.position.z - playerZ;
        if (Math.abs(dzToPlayer) < 28 && !p.hasPhone) {
          // Turn head toward highway lane to watch the car
          const streetDir = p.baseX < 0 ? 0.45 : -0.45;
          p.head.rotation.y = THREE.MathUtils.lerp(p.head.rotation.y, streetDir, delta * 6.0);
        } else if (!p.hasPhone) {
          p.head.rotation.y = THREE.MathUtils.lerp(p.head.rotation.y, 0, delta * 4.0);
        }
      }

      // 5. Randomly Turn Around at Patrol Waypoints
      if (Math.random() < 0.002) {
        p.direction *= -1;
      }

      // 6. Seamless Sidewalk Recycling
      // When scrolled behind the camera (+Z), recycle ahead of the roadway (-Z)
      if (p.mesh.position.z > 22) {
        p.mesh.position.z -= 240;
        p.direction = Math.random() < 0.5 ? 1 : -1;
      }
    }
  }

  clear() {
    this.pedestrians.forEach(p => {
      if (p.mesh) this.scene.remove(p.mesh);
    });
    this.pedestrians = [];
  }
}
