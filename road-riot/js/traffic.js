// Road Riot 3D - Intelligent Traffic, Rivals, Obstacles & Power-Up Spawner
import * as THREE from 'three';

export class TrafficManager {
  constructor(scene, assetPrototypes = {}) {
    this.scene = scene;
    this.assetPrototypes = assetPrototypes;

    this.vehicles = [];
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];

    // Spawning Timers
    this.trafficTimer = 0.5;
    this.obstacleTimer = 2.0;
    this.collectibleTimer = 1.2;

    this.lanes = [-6, 0, 6];
  }

  clear() {
    this.vehicles.forEach(v => this.scene.remove(v.mesh));
    this.obstacles.forEach(o => this.scene.remove(o.mesh));
    this.collectibles.forEach(c => this.scene.remove(c.mesh));
    this.particles.forEach(p => this.scene.remove(p.mesh));

    this.vehicles = [];
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
  }

  spawnTraffic(currentDistance) {
    // Dynamic difficulty: higher distance = tighter traffic & aggressive syndicate rivals
    const lanes = [-6, 0, 6];
    const occupiedLanes = new Set(
      this.vehicles.filter(v => v.mesh.position.z < -120).map(v => v.lane)
    );
    const availableLanes = lanes.filter(l => !occupiedLanes.has(l));
    if (!availableLanes.length) return;

    // Pick 1 or 2 lanes to spawn in
    const spawnCount = currentDistance > 2500 ? (Math.random() < 0.4 ? 2 : 1) : 1;
    const chosenLanes = availableLanes.sort(() => Math.random() - 0.5).slice(0, spawnCount);

    chosenLanes.forEach(lane => {
      const roll = Math.random();
      let type = 'sports';
      let speed = 12 + Math.random() * 6;
      let isRival = false;
      let isPolice = false;
      let isTruck = false;

      if (currentDistance > 1500 && Math.random() < 0.22) {
        type = 'rival';
        speed = 18 + Math.random() * 6;
        isRival = true;
      } else if (currentDistance > 3000 && Math.random() < 0.18) {
        type = 'police';
        speed = 20 + Math.random() * 4;
        isPolice = true;
      } else if (roll < 0.2) {
        type = 'truck';
        speed = 9 + Math.random() * 3;
        isTruck = true;
      } else if (roll < 0.5) {
        type = 'suv';
        speed = 11 + Math.random() * 4;
      } else if (roll < 0.75) {
        type = 'van';
        speed = 10 + Math.random() * 4;
      }

      const mesh = this.buildVehicleMesh(type, isRival, isPolice, isTruck);
      mesh.position.set(lane, 0, -145);
      this.scene.add(mesh);

      this.vehicles.push({
        mesh,
        lane,
        targetLane: lane,
        speed,
        baseSpeed: speed,
        length: isTruck ? 8.5 : 4.4,
        width: 2.2,
        isRival,
        isPolice,
        isTruck,
        nearMissAwarded: false,
        hit: false,
        laneChangeTimer: isRival ? 3 + Math.random() * 4 : 0
      });
    });
  }

  buildVehicleMesh(type, isRival, isPolice, isTruck) {
    const palette = [0xff3355, 0xffaa00, 0x00d9ff, 0x9944ff, 0x00ff88, 0xffffff];
    const color = palette[Math.floor(Math.random() * palette.length)];

    // Check if we have 3D models from assets
    if (isTruck) {
      return this.buildSemiTruck();
    }

    const protoName = type === 'suv' ? 'suv' : (type === 'van' ? 'van' : 'sports');
    const proto = this.assetPrototypes[protoName];
    if (proto && !isPolice) {
      const model = proto.clone(true);
      model.traverse(node => {
        if (!node.isMesh) return;
        node.castShadow = true;
        if (node.material) {
          node.material = node.material.clone();
          if (node.material.color && !/glass|window|tire|wheel/i.test(node.name)) {
            node.material.color.setHex(color);
          }
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      model.scale.setScalar(4.6 / Math.max(size.x, size.y, size.z));
      return model;
    }

    // High detail procedural model
    return this.buildProceduralTraffic(type, color, isRival, isPolice);
  }

  buildProceduralTraffic(type, color, isRival, isPolice) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isPolice ? 0x111622 : color,
      roughness: 0.35,
      metalness: 0.6
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0d121c, roughness: 0.8 });

    // Chassis
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 4.2), bodyMat);
    base.position.y = 0.55;
    base.castShadow = true;
    group.add(base);

    // Cabin
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.55, 2.1),
      new THREE.MeshStandardMaterial({ color: 0x142030, roughness: 0.1, metalness: 0.9 })
    );
    cabin.position.set(0, 0.98, 0.1);
    group.add(cabin);

    // Wheels
    [-0.95, 0.95].forEach(x => {
      [-1.3, 1.3].forEach(z => {
        const w = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12),
          darkMat
        );
        w.rotation.z = Math.PI / 2;
        w.position.set(x, 0.42, z);
        group.add(w);
      });
    });

    // Lights
    [-0.7, 0.7].forEach(x => {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.08), new THREE.MeshBasicMaterial({ color: 0xfffae0 }));
      head.position.set(x, 0.6, -2.12);
      group.add(head);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.08), new THREE.MeshBasicMaterial({ color: 0xff1649 }));
      tail.position.set(x, 0.65, 2.12);
      group.add(tail);
    });

    // Police Flashing Siren Bar
    if (isPolice) {
      const sirenBar = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.12, 0.25),
        darkMat
      );
      sirenBar.position.set(0, 1.32, 0.1);
      group.add(sirenBar);

      const redLight = new THREE.PointLight(0xff0044, 2.5, 6);
      redLight.position.set(-0.4, 1.4, 0.1);
      group.add(redLight);

      const blueLight = new THREE.PointLight(0x0066ff, 2.5, 6);
      blueLight.position.set(0.4, 1.4, 0.1);
      group.add(blueLight);

      group.userData.sirenRed = redLight;
      group.userData.sirenBlue = blueLight;
    }

    // Rival Neon Underglow
    if (isRival) {
      const glow = new THREE.PointLight(0xff2a85, 3.0, 7);
      glow.position.set(0, 0.2, 0);
      group.add(glow);
    }

    return group;
  }

  buildSemiTruck() {
    const group = new THREE.Group();
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xcc2233, roughness: 0.4 });
    const trailerMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6, metalness: 0.2 });

    // Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.8, 2.4), cabMat);
    cab.position.set(0, 1.25, -2.6);
    cab.castShadow = true;
    group.add(cab);

    // Long Cargo Trailer
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.45, 2.4, 5.8), trailerMat);
    trailer.position.set(0, 1.6, 1.4);
    trailer.castShadow = true;
    group.add(trailer);

    return group;
  }

  spawnObstacle() {
    const lane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
    const isBarrier = Math.random() < 0.45;
    const mesh = new THREE.Group();

    if (isBarrier) {
      // Construction Barrier
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.8, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.7 })
      );
      bar.position.y = 0.5;
      mesh.add(bar);

      // Hazard Stripes
      [-1.0, 0, 1.0].forEach(x => {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.82, 0.32),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        stripe.position.set(x, 0.5, 0);
        stripe.rotation.z = 0.4;
        mesh.add(stripe);
      });
    } else {
      // Construction Cones row
      [-0.8, 0.8].forEach(x => {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.4, 1.1, 10),
          new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5 })
        );
        cone.position.set(x, 0.55, 0);
        mesh.add(cone);
      });
    }

    mesh.position.set(lane, 0, -145);
    this.scene.add(mesh);

    this.obstacles.push({
      mesh,
      lane,
      hit: false,
      isBarrier
    });
  }

  spawnCollectible() {
    const lane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
    const roll = Math.random();
    let type = 'coin';

    if (roll < 0.48) {
      type = 'coin';
    } else if (roll < 0.62) {
      type = 'nitro';
    } else if (roll < 0.74) {
      type = 'missile';
    } else if (roll < 0.84) {
      type = 'shield';
    } else if (roll < 0.92) {
      type = 'magnet';
    } else {
      type = 'emp';
    }

    const mesh = this.buildCollectibleMesh(type);
    mesh.position.set(lane, 1.1, -140);
    this.scene.add(mesh);

    this.collectibles.push({
      mesh,
      lane,
      type
    });
  }

  buildCollectibleMesh(type) {
    const group = new THREE.Group();

    if (type === 'coin') {
      const coinGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.14, 18);
      coinGeo.rotateX(Math.PI / 2);
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0xffaa00,
        emissiveIntensity: 0.4,
        metalness: 0.95,
        roughness: 0.2
      });
      const coin = new THREE.Mesh(coinGeo, coinMat);
      group.add(coin);
    } else if (type === 'nitro') {
      const canister = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 1.2, 12),
        new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00d9ff, emissiveIntensity: 0.6 })
      );
      group.add(canister);
    } else if (type === 'missile') {
      const rocket = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 1.2, 10),
        new THREE.MeshStandardMaterial({ color: 0xff2a85, emissive: 0xff0066, emissiveIntensity: 0.5 })
      );
      rocket.rotation.x = -Math.PI / 2;
      group.add(rocket);
    } else if (type === 'shield') {
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.7, 1),
        new THREE.MeshStandardMaterial({ color: 0x9d4edd, emissive: 0x9d4edd, emissiveIntensity: 0.7, wireframe: true })
      );
      group.add(orb);
    } else if (type === 'magnet') {
      const magnet = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.18, 8, 16, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0xff0022, emissiveIntensity: 0.4 })
      );
      group.add(magnet);
    } else if (type === 'emp') {
      const emp = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.7),
        new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffaa, emissiveIntensity: 0.7 })
      );
      group.add(emp);
    }

    // Glowing halo ring around every power-up
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.05, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.6;
    group.add(ring);

    return group;
  }

  spawnExplosion(pos, color = 0xff4422, count = 16) {
    for (let i = 0; i < count; i++) {
      const size = 0.15 + Math.random() * 0.25;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshBasicMaterial({ color })
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        4 + Math.random() * 10,
        (Math.random() - 0.5) * 14
      );

      this.particles.push({ mesh, vel, life: 0.75, maxLife: 0.75 });
    }
  }

  update(dt, playerSpeed, playerX, playerZ, currentDistance, callbacks = {}) {
    // 1. Spawning Timers
    this.trafficTimer -= dt;
    if (this.trafficTimer <= 0) {
      this.spawnTraffic(currentDistance);
      this.trafficTimer = Math.max(0.65, 1.8 - currentDistance / 6000);
    }

    this.obstacleTimer -= dt;
    if (this.obstacleTimer <= 0) {
      this.spawnObstacle();
      this.obstacleTimer = 2.4 + Math.random() * 2.2;
    }

    this.collectibleTimer -= dt;
    if (this.collectibleTimer <= 0) {
      this.spawnCollectible();
      this.collectibleTimer = 2.0 + Math.random() * 2.5;
    }

    // 2. Update Traffic Vehicles
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      // Move relative to player speed
      const relativeSpeed = playerSpeed - v.speed;
      v.mesh.position.z += relativeSpeed * dt;

      // Smooth lane changing AI for rivals
      if (v.isRival) {
        v.laneChangeTimer -= dt;
        if (v.laneChangeTimer <= 0) {
          v.laneChangeTimer = 3.5 + Math.random() * 3;
          const otherLanes = this.lanes.filter(l => l !== v.lane);
          v.targetLane = otherLanes[Math.floor(Math.random() * otherLanes.length)];
        }
        v.mesh.position.x += (v.targetLane - v.mesh.position.x) * Math.min(1, dt * 3.5);
      }

      // Police Sirens strobe
      if (v.isPolice && v.mesh.userData.sirenRed) {
        const strobe = Math.sin(performance.now() * 0.02) > 0;
        v.mesh.userData.sirenRed.intensity = strobe ? 4 : 0;
        v.mesh.userData.sirenBlue.intensity = strobe ? 0 : 4;
      }

      // --- NEAR MISS DETECTION ---
      // Near miss occurs if player passes within close horizontal proximity at high relative speed
      const dz = v.mesh.position.z - playerZ;
      const dx = Math.abs(v.mesh.position.x - playerX);
      if (!v.nearMissAwarded && !v.hit && Math.abs(dz) < 3.2 && dx < 2.5 && dx > 1.2 && playerSpeed > 22) {
        v.nearMissAwarded = true;
        if (callbacks.onNearMiss) callbacks.onNearMiss(v);
      }

      // --- SLIPSTREAM DRAFTING DETECTION ---
      // Directly behind vehicle within draft zone
      if (dz < 0 && dz > -9.5 && dx < 1.1 && !v.hit) {
        if (callbacks.onDrafting) callbacks.onDrafting(dt, v);
      }

      // Despawn vehicles behind camera
      if (v.mesh.position.z > 24) {
        this.scene.remove(v.mesh);
        this.vehicles.splice(i, 1);
      }
    }

    // 3. Update Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.mesh.position.z += playerSpeed * dt;
      if (o.mesh.position.z > 24) {
        this.scene.remove(o.mesh);
        this.obstacles.splice(i, 1);
      }
    }

    // 4. Update Collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      c.mesh.position.z += playerSpeed * dt;
      c.mesh.rotation.y += dt * 3.2;

      // Magnet Attractor Logic
      if (callbacks.isMagnetActive) {
        const toPlayer = new THREE.Vector3(playerX, 0.8, playerZ).sub(c.mesh.position);
        if (toPlayer.length() < 35) {
          c.mesh.position.addScaledVector(toPlayer.normalize(), dt * 26);
        }
      }

      if (c.mesh.position.z > 24) {
        this.scene.remove(c.mesh);
        this.collectibles.splice(i, 1);
      }
    }

    // 5. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 14 * dt; // gravity
      p.mesh.rotation.x += dt * 5;
      p.mesh.rotation.y += dt * 4;
      p.mesh.scale.setScalar(Math.max(0, p.life / p.maxLife));

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }
}
