// Road Riot 3D - Intelligent Traffic, Chemical Tankers, Police Spike Strips & High-Speed Highway AI
import * as THREE from 'three';

/**
 * Select spawn lanes respecting heavy convoy discipline:
 * Trucks & tankers prefer right (+6) and center (0) lanes, keeping left (-6) open for overtakes.
 */
export function selectConvoyAwareLanes(availableLanes, isHeavyConvoy = false) {
  if (!availableLanes || availableLanes.length === 0) return [];
  if (!isHeavyConvoy) return [...availableLanes];
  const convoyPreferred = availableLanes.filter(l => l >= 0); // 0 (center) and 6 (right)
  if (convoyPreferred.length > 0) {
    // Prefer right lane (6) first, then center (0)
    return convoyPreferred.sort((a, b) => b - a);
  }
  return [...availableLanes];
}

/**
 * Guarantee at least one viable escape lane or ramp gap exists in the [zMin, zMax] corridor
 * ahead of the player (default 60m corridor: -65m to -5m) without 3-wide clump deadlocks.
 */
export function hasViableEscapeCorridor(vehicles = [], obstacles = [], jumpRamps = [], zMin = -65, zMax = -5) {
  const lanes = [-6, 0, 6];
  const blockerZByLane = new Map([[-6, []], [0, []], [6, []]]);

  const getZ = (item) => (item.mesh ? item.mesh.position.z : (item.z ?? 0));
  const getLane = (item) => (item.targetLane !== undefined ? item.targetLane : item.lane);

  for (const v of vehicles) {
    const z = getZ(v);
    if (z >= zMin && z <= zMax) {
      const lane = lanes.reduce((best, l) => (Math.abs(l - getLane(v)) < Math.abs(best - getLane(v)) ? l : best), 0);
      blockerZByLane.get(lane).push(z);
    }
  }
  for (const o of obstacles) {
    const z = getZ(o);
    if (z >= zMin && z <= zMax) {
      const lane = lanes.reduce((best, l) => (Math.abs(l - (o.lane ?? 0)) < Math.abs(best - (o.lane ?? 0)) ? l : best), 0);
      blockerZByLane.get(lane).push(z);
    }
  }

  // If any lane has zero blockers in the entire corridor, escape is guaranteed
  if (lanes.some(l => blockerZByLane.get(l).length === 0)) return true;

  // Otherwise check if all 3 lanes overlap within a tight 14m longitudinal wall
  for (const zLeft of blockerZByLane.get(-6)) {
    const midOverlap = blockerZByLane.get(0).some(zm => Math.abs(zm - zLeft) < 14);
    const rightOverlap = blockerZByLane.get(6).some(zr => Math.abs(zr - zLeft) < 14);
    if (midOverlap && rightOverlap) {
      // Check if a jump ramp offers a vertical escape over one of those blocked spots
      const hasRampEscape = (jumpRamps || []).some(r => {
        const rz = r.parent ? (r.parent.position.z + r.mesh.position.z) : (r.z ?? 0);
        return Math.abs(rz - zLeft) < 10;
      });
      if (!hasRampEscape) return false;
    }
  }
  return true;
}

/**
 * Dynamically stagger speeds of mobile vehicles whenever longitudinal speed differences
 * threaten to form a 3-wide clump deadlock across [-125, -5] ahead of the player.
 */
export function preventClumpDeadlocks(vehicles = [], obstacles = [], jumpRamps = [], dt = 0.016) {
  const getZ = (item) => (item.mesh ? item.mesh.position.z : (item.z ?? 0));
  const setZ = (item, z) => {
    if (item.mesh) item.mesh.position.z = z;
    else item.z = z;
  };
  const getLane = (item) => (item.targetLane !== undefined ? item.targetLane : item.lane);
  const lanes = [-6, 0, 6];
  const byLane = new Map([[-6, []], [0, []], [6, []]]);

  for (const v of vehicles) {
    const z = getZ(v);
    if (z >= -145 && z <= -5) {
      const lane = lanes.reduce((best, l) => (Math.abs(l - getLane(v)) < Math.abs(best - getLane(v)) ? l : best), 0);
      byLane.get(lane).push({ item: v, z, isVehicle: true });
    }
  }
  for (const o of obstacles) {
    const z = getZ(o);
    if (z >= -145 && z <= -5) {
      const lane = lanes.reduce((best, l) => (Math.abs(l - (o.lane ?? 0)) < Math.abs(best - (o.lane ?? 0)) ? l : best), 0);
      byLane.get(lane).push({ item: o, z, isVehicle: false });
    }
  }

  let adjusted = false;
  for (const leftEntry of byLane.get(-6)) {
    const midMatches = byLane.get(0).filter(m => Math.abs(m.z - leftEntry.z) < 22);
    const rightMatches = byLane.get(6).filter(r => Math.abs(r.z - leftEntry.z) < 22);
    if (midMatches.length === 0 || rightMatches.length === 0) continue;

    const hasRamp = (jumpRamps || []).some(r => {
      const rz = r.parent ? (r.parent.position.z + r.mesh.position.z) : (r.z ?? 0);
      return Math.abs(rz - leftEntry.z) < 10;
    });
    if (hasRamp) continue;

    for (const midEntry of midMatches) {
      for (const rightEntry of rightMatches) {
        if (Math.abs(midEntry.z - leftEntry.z) < 14 && Math.abs(rightEntry.z - leftEntry.z) < 14) {
          const cluster = [leftEntry, midEntry, rightEntry];
          const clusterVehicles = cluster.filter(e => e.isVehicle);
          if (clusterVehicles.length > 0) {
            clusterVehicles.sort((a, b) => a.z - b.z);
            const lead = clusterVehicles[clusterVehicles.length - 1].item;
            const trail = clusterVehicles[0].item;
            lead.speed = Math.min(36, (lead.speed || 22) + 35 * dt);
            if (trail !== lead) {
              trail.speed = Math.max(6, (trail.speed || 18) - 35 * dt);
            }

            // Stagger the cluster so the 3-wide deadlock is broken immediately
            const zVals = cluster.map(c => c.z);
            const minZ = Math.min(...zVals);
            const maxZ = Math.max(...zVals);
            const targetZ = minZ - 16.5;
            if (targetZ >= -145) {
              setZ(trail, targetZ);
              clusterVehicles[0].z = targetZ;
            } else {
              setZ(lead, maxZ + 16.5);
              clusterVehicles[clusterVehicles.length - 1].z = maxZ + 16.5;
            }
            adjusted = true;
          }
        }
      }
    }
  }
  return adjusted;
}

/**
 * Schedule an autonomous lane change with a mandatory 1.2s pre-change turn signal warning.
 */
export function planLaneChangeWithSignal(vehicle, desiredLane, signalLeadTime = 1.2) {
  if (!vehicle || desiredLane === undefined || desiredLane === vehicle.lane) return false;
  if (vehicle.pendingTargetLane === desiredLane && vehicle.signalTimer > 0) return false;
  vehicle.pendingTargetLane = desiredLane;
  vehicle.signalDir = Math.sign(desiredLane - (vehicle.mesh ? vehicle.mesh.position.x : vehicle.lane));
  vehicle.signalTimer = signalLeadTime;
  return true;
}

const SHARED_DEBRIS_GEO = new THREE.BoxGeometry(0.24, 0.24, 0.24);
const SHARED_SPARK_GEO = new THREE.BoxGeometry(0.12, 0.12, 0.35);

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
    this.sharedShadowTex = null;

    try {
      this.colormapTexture = new THREE.TextureLoader().load('./assets/Textures/colormap.png');
      this.colormapTexture.colorSpace = THREE.SRGBColorSpace;
      this.colormapTexture.flipY = false; // MUST be false for glTF UV coordinates!
      this.colormapTexture.anisotropy = 16;
    } catch (e) {
      this.colormapTexture = null;
    }
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

    this.trafficTimer = 2.2;
    this.obstacleTimer = 4.0;
    this.collectibleTimer = 2.0;
  }

  spawnTraffic(currentDistance) {
    const lanes = [-6, 0, 6];
    const occupiedLanes = new Set([
      ...this.vehicles.filter(v => v.mesh.position.z < -118).map(v => v.targetLane ?? v.lane),
      ...this.obstacles.filter(o => o.mesh.position.z < -118).map(o => o.lane)
    ]);
    if (this.jumpRamps) {
      for (const ramp of this.jumpRamps) {
        const rz = ramp.parent.position.z + ramp.mesh.position.z;
        if (Math.abs(rz - (-145)) < 18) {
          occupiedLanes.add(ramp.lane);
        }
      }
    }
    const availableLanes = lanes.filter(l => !occupiedLanes.has(l));
    // Always preserve at least 1 open escape lane in the spawn window (never spawn a 3-wide wall)
    if (availableLanes.length <= 1 && occupiedLanes.size >= 2) return;
    if (!availableLanes.length) return;

    const maxSafeSpawn = Math.max(1, availableLanes.length - 1);
    const desiredCount = currentDistance > 2500 ? (Math.random() < 0.4 ? 2 : 1) : 1;
    const spawnCount = Math.min(maxSafeSpawn, desiredCount);

    // Pre-roll vehicle classes so heavy trucks/tankers can respect right/center convoy lane discipline
    for (let s = 0; s < spawnCount; s++) {
      const remainingLanes = lanes.filter(l => !occupiedLanes.has(l));
      if (remainingLanes.length <= 1) break;

      const roll = Math.random();
      let type = 'sports';
      let speed = 21 + Math.random() * 4;
      let isRival = false;
      let isPolice = false;
      let isTruck = false;
      let isTanker = false;

      if (currentDistance > 1800 && Math.random() < 0.18) {
        type = 'tanker';
        speed = 16 + Math.random() * 3; // ~60 km/h
        isTanker = true;
      } else if (currentDistance > 1400 && Math.random() < 0.22) {
        type = 'rival';
        speed = 26 + Math.random() * 5; // ~98 km/h
        isRival = true;
      } else if (((this.heatLevel || 0) >= 1 && Math.random() < 0.35 + (this.heatLevel || 0) * 0.12) || (currentDistance > 400 && Math.random() < 0.15)) {
        type = 'police';
        speed = 25 + Math.random() * 4; // ~92 km/h
        isPolice = true;
      } else if (roll < 0.12) {
        type = 'truck';
        speed = 17 + Math.random() * 3; // ~64 km/h
        isTruck = true;
      } else if (roll < 0.24) {
        type = 'delivery';
        speed = 18 + Math.random() * 4; // ~70 km/h
      } else if (roll < 0.38) {
        type = 'taxi';
        speed = 21 + Math.random() * 4; // ~80 km/h
      } else if (roll < 0.52) {
        type = 'ambulance';
        speed = 23 + Math.random() * 4; // ~86 km/h
      } else if (roll < 0.68) {
        type = 'sedan';
        speed = 19 + Math.random() * 4; // ~72 km/h
      } else if (roll < 0.84) {
        type = 'suv';
        speed = 18 + Math.random() * 4; // ~70 km/h
      } else {
        type = 'van';
        speed = 18 + Math.random() * 4; // ~70 km/h
      }

      const candidateLanes = selectConvoyAwareLanes(remainingLanes, isTruck || isTanker);
      const lane = (isTruck || isTanker)
        ? candidateLanes[0]
        : candidateLanes[Math.floor(Math.random() * candidateLanes.length)];

      occupiedLanes.add(lane);

      const mesh = this.buildVehicleMesh(type, isRival, isPolice, isTruck, isTanker);
      mesh.position.set(lane, 0, -145);
      this.scene.add(mesh);

      this.vehicles.push({
        mesh,
        lane,
        targetLane: lane,
        pendingTargetLane: lane,
        signalDir: 0,
        signalTimer: 0,
        speed,
        baseSpeed: speed,
        length: isTanker ? 9.2 : (isTruck ? 8.5 : 4.6),
        width: 2.2,
        isRival,
        isPolice,
        isTruck,
        isTanker,
        nearMissAwarded: false,
        hit: false,
        laneChangeTimer: isRival ? 3 + Math.random() * 4 : 0
      });
    }
  }

  buildVehicleMesh(type, isRival, isPolice, isTruck, isTanker) {
    if (isTanker) {
      return this.buildChemicalTanker();
    }
    if (isTruck) {
      return this.buildSemiTruck();
    }

    // Try finding loaded prototype asset
    const proto = this.assetPrototypes[type] ||
      (type === 'sedan' ? this.assetPrototypes['sports'] : null) ||
      (type === 'delivery' ? this.assetPrototypes['van'] : null) ||
      (type === 'taxi' ? this.assetPrototypes['sedan'] || this.assetPrototypes['sports'] : null) ||
      (type === 'ambulance' ? this.assetPrototypes['van'] : null) ||
      this.assetPrototypes.sports;

    if (proto) {
      const model = proto.clone(true);
      const carPalette = [0xd91626, 0x0066cc, 0x111622, 0xe8edf2, 0x159a42, 0x7b2cbf, 0xff9900, 0x00b4d8];
      const carColor = carPalette[Math.floor(Math.random() * carPalette.length)];

      model.traverse(node => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;

        if (node.material) {
          node.material = node.material.clone();
          if (node.material.map) {
            node.material.map.flipY = false;
            node.material.map.colorSpace = THREE.SRGBColorSpace;
            node.material.map.anisotropy = 16;
          } else if (this.colormapTexture) {
            node.material.map = this.colormapTexture;
          }

          // Keep base color pure white so the authentic Kenney texture atlas
          // (tinted glass windows, crisp headlights, red taillights, black rubber tires)
          // renders at full fidelity without becoming a monochrome clay blob!
          node.material.color.setHex(0xffffff);
          node.material.roughness = 0.28;
          node.material.metalness = 0.45;
          node.material.needsUpdate = true;
        }
      });

      // Center model inside an inner group
      const inner = new THREE.Group();
      inner.add(model);

      // Normalize scale and ground model
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetLength = (type === 'delivery' || type === 'ambulance') ? 5.6 : 4.5;
      model.scale.setScalar(targetLength / maxDim);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());
      model.position.x = -center.x;
      model.position.y = -scaledBox.min.y; // Sits flat on the road pavement
      model.position.z = -center.z;

      // Rotate inner group by Math.PI so car nose points forward down highway (-Z)
      // and rear taillights face the camera (+Z)
      inner.rotation.y = Math.PI;

      // Wrapper group in unrotated track space
      const wrapper = new THREE.Group();
      wrapper.add(inner);

      // Attach Highway Taillights facing camera at +Z, headlights pointing down road at -Z
      this.attachTrafficLamps(wrapper, type, isPolice, isRival);

      // Soft Ambient Occlusion Contact Shadow (firmly plants NPC tires onto the asphalt)
      const shadowW = (type === 'delivery' || type === 'ambulance') ? 2.8 : 2.5;
      const shadowL = (type === 'delivery' || type === 'ambulance') ? 5.8 : 4.8;
      this.attachContactShadow(wrapper, shadowW, shadowL);

      return wrapper;
    }

    const palette = [0xff3355, 0xffaa00, 0x00d9ff, 0x9944ff, 0x00ff88, 0xffffff];
    const color = palette[Math.floor(Math.random() * palette.length)];
    return this.buildProceduralTraffic(type, color, isRival, isPolice);
  }

  createContactShadowTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Ambient Occlusion drop shadow under NPC vehicle chassis
    const grad = ctx.createRadialGradient(128, 128, 15, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.54)');
    grad.addColorStop(0.72, 'rgba(0, 0, 0, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(128, 128, 92, 118, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4 Tire Contact Footprints (FL, FR, RL, RR)
    const tirePositions = [
      { x: 68, y: 68, rx: 18, ry: 26 },
      { x: 188, y: 68, rx: 18, ry: 26 },
      { x: 68, y: 188, rx: 20, ry: 30 },
      { x: 188, y: 188, rx: 20, ry: 30 }
    ];
    tirePositions.forEach(tp => {
      const tireGrad = ctx.createRadialGradient(tp.x, tp.y, 4, tp.x, tp.y, tp.rx * 1.4);
      tireGrad.addColorStop(0, 'rgba(0, 0, 0, 0.88)');
      tireGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.55)');
      tireGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = tireGrad;
      ctx.beginPath();
      ctx.ellipse(tp.x, tp.y, tp.rx * 1.2, tp.ry * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    return new THREE.CanvasTexture(canvas);
  }

  attachContactShadow(group, width = 2.6, length = 5.0) {
    if (!this.sharedShadowTex && typeof document !== 'undefined') {
      this.sharedShadowTex = this.createContactShadowTexture();
    }
    const shadowGeo = new THREE.PlaneGeometry(width, length);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.sharedShadowTex || undefined,
      transparent: true,
      opacity: 0.74,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.y = 0.014;
    group.add(shadowMesh);
  }

  attachTrafficLamps(parentGroup, type, isPolice, isRival) {
    // 1. Dual Glowing Red Taillights (+Z in wrapper space = facing player)
    [-0.7, 0.7].forEach(x => {
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.1, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xff1644 })
      );
      tail.position.set(x, 0.65, 2.2);
      parentGroup.add(tail);
    });

    // 2. Dual Forward Xenon Headlights (-Z in wrapper space = pointing down the road)
    [-0.7, 0.7].forEach(x => {
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.1, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xfffae0 })
      );
      head.position.set(x, 0.58, -2.2);
      parentGroup.add(head);
    });

    // 3. Police Strobe Lightbar & Push-Bar (Alternating High-Intensity Beacons)
    if (isPolice || type === 'police') {
      const sirenBar = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.14, 0.28),
        new THREE.MeshStandardMaterial({ color: 0x111622, metalness: 0.8, roughness: 0.2 })
      );
      sirenBar.position.set(0, 1.48, 0.1);
      parentGroup.add(sirenBar);

      const redBeacon = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.12, 0.22),
        new THREE.MeshBasicMaterial({ color: 0xff0044 })
      );
      redBeacon.position.set(-0.35, 1.55, 0.1);
      parentGroup.add(redBeacon);

      const blueBeacon = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.12, 0.22),
        new THREE.MeshBasicMaterial({ color: 0x0088ff })
      );
      blueBeacon.position.set(0.35, 1.55, 0.1);
      parentGroup.add(blueBeacon);

      const sirenLight = new THREE.PointLight(0xff0044, 2.5, 8.0);
      sirenLight.position.set(0, 1.6, 0.1);
      parentGroup.add(sirenLight);

      // Heavy Tactical Front Bullbar / Push-Bar
      const bullMat = new THREE.MeshStandardMaterial({ color: 0x0d121c, metalness: 0.9, roughness: 0.2 });
      [-0.48, 0.48].forEach(bx => {
        const upright = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.15), bullMat);
        upright.position.set(bx, 0.52, -2.32);
        parentGroup.add(upright);
      });
      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.12), bullMat);
      crossbar.position.set(0, 0.62, -2.34);
      parentGroup.add(crossbar);

      parentGroup.userData.sirenRedMesh = redBeacon;
      parentGroup.userData.sirenBlueMesh = blueBeacon;
      parentGroup.userData.sirenLight = sirenLight;
    }

    // 4. Rival Racing Supercar Enhancements (GT Carbon Wing & Underglow)
    if (isRival) {
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.35, metalness: 0.85 });
      const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.05, 0.42), wingMat);
      wingBlade.position.set(0, 1.15, 1.82);
      parentGroup.add(wingBlade);

      // Wing uprights
      [-0.55, 0.55].forEach(wx => {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.22), wingMat);
        strut.position.set(wx, 1.0, 1.82);
        parentGroup.add(strut);
      });

      // Neon Underglow Kit
      const underglow = new THREE.PointLight(0xff2a85, 2.2, 5.0);
      underglow.position.set(0, 0.25, 0);
      parentGroup.add(underglow);
    }

    // 5. Dual Chrome Exhaust Pipes
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0xdde4ec, metalness: 0.95, roughness: 0.1 });
    [-0.52, 0.52].forEach(px => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.25, 8), pipeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(px, 0.35, 2.25);
      parentGroup.add(pipe);
    });

    // 6. Taxi Rooftop Medallion
    if (type === 'taxi') {
      const taxiSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.18, 0.22),
        new THREE.MeshBasicMaterial({ color: 0xffcc00 })
      );
      taxiSign.position.set(0, 1.46, 0.1);
      parentGroup.add(taxiSign);
    }

    // 7. Ambient Occlusion Contact Shadow Plane (Grounds vehicle on pavement)
    const shadowGeo = new THREE.PlaneGeometry(2.5, 4.8);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x040810,
      transparent: true,
      opacity: 0.62,
      depthWrite: false
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = 0.02;
    parentGroup.add(shadow);

    // 8. Amber LED Turn Signal Indicators (1.2s pre-lane-change warning)
    this.attachTurnSignals(parentGroup, 0.92, 0.56, 2.24);
  }

  attachTurnSignals(group, halfW = 0.92, y = 0.56, rearZ = 2.25) {
    const leftMat = new THREE.MeshBasicMaterial({ color: 0xff9500, transparent: true, opacity: 0.15 });
    const rightMat = new THREE.MeshBasicMaterial({ color: 0xff9500, transparent: true, opacity: 0.15 });
    const sigGeo = new THREE.BoxGeometry(0.18, 0.12, 0.10);

    const leftSig = new THREE.Mesh(sigGeo, leftMat);
    leftSig.position.set(-halfW, y, rearZ);
    leftSig.visible = false;
    group.add(leftSig);

    const rightSig = new THREE.Mesh(sigGeo, rightMat);
    rightSig.position.set(halfW, y, rearZ);
    rightSig.visible = false;
    group.add(rightSig);

    group.userData.leftSignalMesh = leftSig;
    group.userData.rightSignalMesh = rightSig;
  }

  buildChemicalTanker() {
    const group = new THREE.Group();
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xd92626, roughness: 0.3, metalness: 0.6 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdbe2ea, metalness: 0.95, roughness: 0.15 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x12151b, roughness: 0.85 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x081624, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.7 });

    // Cab Section (-Z facing forward)
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.9, 2.6), cabMat);
    cab.position.set(0, 1.35, -2.8);
    cab.castShadow = true;
    group.add(cab);

    // Cab Windshield
    const wind = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 0.1), glassMat);
    wind.position.set(0, 1.6, -4.05);
    group.add(wind);

    // Large Cylindrical Chrome Fuel Tank
    const tankGeo = new THREE.CylinderGeometry(1.22, 1.22, 6.2, 24);
    tankGeo.rotateX(Math.PI / 2);
    const tank = new THREE.Mesh(tankGeo, chromeMat);
    tank.position.set(0, 1.65, 1.6);
    tank.castShadow = true;
    group.add(tank);

    // Hazard Placards (Flammable chemical diamonds)
    [-1.28, 1.28].forEach(x => {
      const placard = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.55, 0.55),
        new THREE.MeshBasicMaterial({ color: 0xff3b00 })
      );
      placard.rotation.z = Math.PI / 4;
      placard.position.set(x, 1.65, 1.6);
      group.add(placard);
    });

    // Rear Hazard Chevrons & Taillights at +Z
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 0.15), darkMat);
    rearBumper.position.set(0, 0.5, 4.75);
    group.add(rearBumper);

    [-0.9, 0.9].forEach(x => {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.08), new THREE.MeshBasicMaterial({ color: 0xff1644 }));
      tail.position.set(x, 0.5, 4.85);
      group.add(tail);
    });

    // 10 Heavy Truck Wheels
    [-1.12, 1.12].forEach(x => {
      [-3.2, -2.0, 0.8, 2.2, 3.6].forEach(z => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.35, 16), darkMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(x, 0.48, z);
        group.add(w);
      });
    });

    this.attachContactShadow(group, 3.2, 11.5);
    this.attachTurnSignals(group, 1.15, 0.65, 4.86);

    return group;
  }

  buildSemiTruck() {
    const group = new THREE.Group();
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x0a4fa6, roughness: 0.28, metalness: 0.7 });
    const trailerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.55 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f141c, roughness: 0.85 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xebf2f8, metalness: 0.95, roughness: 0.12 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x081624, metalness: 0.95, roughness: 0.05, transparent: true, opacity: 0.75 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x00d9ff, roughness: 0.3, metalness: 0.7 });

    // Cab Section (-Z facing forward)
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.9, 2.5), cabMat);
    cab.position.set(0, 1.35, -2.7);
    cab.castShadow = true;
    group.add(cab);

    // Front Windshield
    const wind = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 0.08), glassMat);
    wind.position.set(0, 1.6, -3.92);
    group.add(wind);

    // Chrome Front Grille
    const grill = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.75, 0.1), chromeMat);
    grill.position.set(0, 0.85, -3.95);
    group.add(grill);

    // Dual Chrome Exhaust Stacks
    [-1.15, 1.15].forEach(x => {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 12), chromeMat);
      stack.position.set(x, 2.2, -1.6);
      group.add(stack);
    });

    // Detailed Cargo Trailer (Dark Metallic with side livery)
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.45, 2.45, 6.2), trailerMat);
    trailer.position.set(0, 1.7, 1.6);
    trailer.castShadow = true;
    group.add(trailer);

    // Side livery accent bands & amber clearance markers
    [-1.24, 1.24].forEach(x => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 5.6), accentMat);
      stripe.position.set(x, 1.7, 1.6);
      group.add(stripe);

      [-0.8, 0.8, 2.4, 4.0].forEach(z => {
        const marker = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.18), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        marker.position.set(x, 0.85, z);
        group.add(marker);
      });
    });

    // Rear Cargo Doors & Red/White Hazard Striping (+Z facing player)
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.35, 2.3, 0.08), darkMat);
    doorFrame.position.set(0, 1.7, 4.72);
    group.add(doorFrame);

    // Vertical chrome locking rods
    [-0.55, 0.55].forEach(x => {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8), chromeMat);
      rod.position.set(x, 1.7, 4.77);
      group.add(rod);
    });

    // Diagonal Hazard Barricade Tape on Rear Bumper
    const hazardBumper = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.35, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.5 })
    );
    hazardBumper.position.set(0, 0.48, 4.75);
    group.add(hazardBumper);

    // Dual Glowing Red Rear Taillights
    [-0.9, 0.9].forEach(x => {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.08), new THREE.MeshBasicMaterial({ color: 0xff1644 }));
      tail.position.set(x, 0.48, 4.82);
      group.add(tail);
    });

    // 10 Heavy Truck Wheels with Chrome Hubcaps
    [-1.15, 1.15].forEach(x => {
      [-3.2, -2.0, 1.8, 3.2, 4.2].forEach(z => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.34, 16), darkMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(x, 0.48, z);
        group.add(w);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 10), chromeMat);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(x, 0.48, z);
        group.add(hub);
      });
    });

    this.attachContactShadow(group, 3.2, 10.5);
    this.attachTurnSignals(group, 1.15, 0.62, 4.84);

    return group;
  }

  buildProceduralTraffic(type, color, isRival, isPolice) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isPolice ? 0x111622 : color,
      roughness: 0.22,
      metalness: 0.72
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x11151d, roughness: 0.85 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xebf2f8, metalness: 0.95, roughness: 0.12 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x09182a,
      metalness: 0.95,
      roughness: 0.05,
      transparent: true,
      opacity: 0.75
    });

    // Aerodynamic Body (-Z facing forward)
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.48, 4.4), bodyMat);
    base.position.y = 0.52;
    base.castShadow = true;
    group.add(base);

    // Tinted Glass Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.2), glassMat);
    cabin.position.set(0, 0.98, 0.1);
    group.add(cabin);

    // 4 Rubber Wheels with Chrome Hubs
    [-1.05, 1.05].forEach(x => {
      [-1.35, 1.35].forEach(z => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16), darkMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(x, 0.42, z);
        group.add(w);

        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.32, 10), chromeMat);
        rim.rotation.z = Math.PI / 2;
        rim.position.set(x, 0.42, z);
        group.add(rim);
      });
    });

    this.attachTrafficLamps(group, type, isPolice, isRival);
    this.attachContactShadow(group, 2.6, 5.0);
    this.attachTurnSignals(group, 0.94, 0.56, 2.25);

    return group;
  }

  spawnObstacle() {
    const occupiedLanes = new Set([
      ...this.vehicles.filter(v => v.mesh.position.z < -118).map(v => v.targetLane ?? v.lane),
      ...this.obstacles.filter(o => o.mesh.position.z < -118).map(o => o.lane)
    ]);
    if (this.jumpRamps) {
      for (const ramp of this.jumpRamps) {
        const rz = ramp.parent.position.z + ramp.mesh.position.z;
        if (Math.abs(rz - (-145)) < 18) {
          occupiedLanes.add(ramp.lane);
        }
      }
    }
    const availableLanes = this.lanes.filter(l => !occupiedLanes.has(l));
    // Guarantee escape lane: never drop an obstacle if it would seal the final open lane
    if (availableLanes.length <= 1 && occupiedLanes.size >= 2) return;
    if (!availableLanes.length) return;
    const lane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
    const roll = Math.random();
    const mesh = new THREE.Group();
    let isSpike = false;
    let isBarrel = false;
    let isBarrier = false;

    if (roll < 0.25) {
      // Police Spike Strip
      isSpike = true;
      const stripMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
      const spikeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

      const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.06, 0.5), stripMat);
      base.position.y = 0.04;
      mesh.add(base);

      for (let x = -1.6; x <= 1.6; x += 0.35) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6), spikeMat);
        spike.position.set(x, 0.16, 0);
        mesh.add(spike);
      }
    } else if (roll < 0.6) {
      // Construction Hazard Cones / Barrels with Blinking LED
      isBarrel = true;
      if (this.assetPrototypes && this.assetPrototypes['cone']) {
        const coneProto = this.assetPrototypes['cone'];
        [-1.0, 0, 1.0].forEach(x => {
          const c = coneProto.clone(true);
          c.scale.setScalar(2.2);
          c.position.set(x, 0, 0);
          c.traverse(n => {
            if (n.isMesh) {
              n.castShadow = true;
              if (n.material && n.material.map) {
                n.material.map.flipY = false;
                n.material.map.colorSpace = THREE.SRGBColorSpace;
              }
            }
          });
          mesh.add(c);
        });
      } else {
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5 });
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        [-0.8, 0.8].forEach(x => {
          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.1, 12), barrelMat);
          barrel.position.set(x, 0.55, 0);
          mesh.add(barrel);
          const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.25, 12), stripeMat);
          stripe.position.set(x, 0.65, 0);
          mesh.add(stripe);
        });
      }
    } else {
      // Heavy Construction Barrier
      isBarrier = true;
      if (this.assetPrototypes && this.assetPrototypes['barrier']) {
        const barProto = this.assetPrototypes['barrier'];
        const b = barProto.clone(true);
        b.scale.setScalar(2.4);
        b.traverse(n => {
          if (n.isMesh) {
            n.castShadow = true;
            if (n.material && n.material.map) {
              n.material.map.flipY = false;
              n.material.map.colorSpace = THREE.SRGBColorSpace;
            }
          }
        });
        mesh.add(b);
      } else {
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 0.8, 0.3),
          new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.7 })
        );
        bar.position.y = 0.5;
        mesh.add(bar);

        [-1.0, 0, 1.0].forEach(x => {
          const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.82, 0.32),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
          );
          stripe.position.set(x, 0.5, 0);
          stripe.rotation.z = 0.4;
          mesh.add(stripe);
        });
      }
    }

    mesh.position.set(lane, 0, -145);
    this.scene.add(mesh);

    this.obstacles.push({
      mesh,
      lane,
      hit: false,
      isSpike,
      isBarrel,
      isBarrier
    });
  }

  spawnCollectible() {
    const occupiedLanes = new Set([
      ...this.collectibles.filter(c => c.mesh.position.z < -120).map(c => c.mesh.position.x),
      ...this.obstacles.filter(o => o.mesh.position.z < -120).map(o => o.lane)
    ]);
    const availableLanes = this.lanes.filter(l => !occupiedLanes.has(l));
    const lane = availableLanes.length > 0
      ? availableLanes[Math.floor(Math.random() * availableLanes.length)]
      : this.lanes[Math.floor(Math.random() * this.lanes.length)];
    const roll = Math.random();
    // Dynamic pickups: Nitro N2O (40%), Life Pack / Nano-Repair (35%), Gold Coins (25%)
    let type = 'nitro';
    if (roll < 0.40) {
      type = 'nitro'; // 40% chance: Nitro Boost Canister
    } else if (roll < 0.75) {
      type = 'repair'; // 35% chance: Life Pack / Nanotech Repair Kit (+35 HP)
    } else {
      type = 'coin'; // 25% chance: Gold Currency Coin (+100 CR)
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
      if (this.assetPrototypes && this.assetPrototypes['coin']) {
        const c = this.assetPrototypes['coin'].clone(true);
        c.scale.setScalar(2.6);
        c.traverse(n => {
          if (n.isMesh) {
            n.castShadow = true;
            if (n.material) {
              n.material.roughness = 0.15;
              n.material.metalness = 0.95;
            }
          }
        });
        group.add(c);
      } else {
        const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.16, 20);
        coinGeo.rotateX(Math.PI / 2);
        const coinMat = new THREE.MeshStandardMaterial({
          color: 0xffb800,
          emissive: 0xff9900,
          emissiveIntensity: 0.5,
          metalness: 0.95,
          roughness: 0.15
        });
        const coin = new THREE.Mesh(coinGeo, coinMat);
        group.add(coin);
      }
    } else if (type === 'nitro') {
      // High-pressure Dual-chamber Nitrous Oxide Bottle
      const canisterGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.4, 20);
      const canisterMat = new THREE.MeshStandardMaterial({
        color: 0x00d9ff,
        emissive: 0x0099ff,
        emissiveIntensity: 0.85,
        metalness: 0.9,
        roughness: 0.15
      });
      const canister = new THREE.Mesh(canisterGeo, canisterMat);
      canister.castShadow = true;
      group.add(canister);

      // Top Dome
      const domeGeo = new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const dome = new THREE.Mesh(domeGeo, canisterMat);
      dome.position.y = 0.7;
      group.add(dome);

      // Chrome Valve & Pressure Gauge
      const valveMat = new THREE.MeshStandardMaterial({ color: 0x1a2636, metalness: 0.95, roughness: 0.2 });
      const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.35, 12), valveMat);
      valve.position.y = 1.05;
      group.add(valve);

      // Twin Chrome Release Nozzles
      const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.14), valveMat);
      nozzle.position.set(0, 1.15, 0);
      group.add(nozzle);

      // Pulsing Cyan Neon Energy Ring around bottle
      const ringGeo = new THREE.TorusGeometry(0.58, 0.05, 12, 24);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0;
      group.add(ring);

      // Ground Glow Light illuminating the asphalt
      const light = new THREE.PointLight(0x00f0ff, 2.5, 6.0);
      light.position.set(0, 0, 0);
      group.add(light);
    } else if (type === 'repair') {
      // High-Tech Cybernetic Nano-Repair Kit (Life Pack)
      const caseGeo = new THREE.BoxGeometry(0.85, 0.72, 0.52);
      const caseMat = new THREE.MeshStandardMaterial({
        color: 0x0a241a,
        metalness: 0.85,
        roughness: 0.25
      });
      const repairCase = new THREE.Mesh(caseGeo, caseMat);
      repairCase.castShadow = true;
      group.add(repairCase);

      // Glowing Emerald Green Nanotech Cross
      const crossMat = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 2.8,
        roughness: 0.1
      });
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.15, 0.55), crossMat);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.52, 0.55), crossMat);
      group.add(crossH);
      group.add(crossV);

      // Rotating Emerald Halo Ring
      const haloGeo = new THREE.RingGeometry(0.82, 0.98, 24);
      haloGeo.rotateX(Math.PI / 2);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.y = -0.52;
      group.add(halo);

      // Emerald Ground Beacon Light
      const repairLight = new THREE.PointLight(0x00ff88, 2.8, 6.5);
      repairLight.position.set(0, 0, 0);
      group.add(repairLight);
    } else if (type === 'shield') {
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.72, 1),
        new THREE.MeshStandardMaterial({
          color: 0x9d4edd,
          emissive: 0x9d4edd,
          emissiveIntensity: 0.95,
          wireframe: true
        })
      );
      group.add(orb);

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xdf88ff })
      );
      group.add(core);
    } else if (type === 'magnet') {
      const magnet = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.18, 8, 18, Math.PI),
        new THREE.MeshStandardMaterial({
          color: 0xff1644,
          emissive: 0xff002b,
          emissiveIntensity: 0.6,
          metalness: 0.8,
          roughness: 0.25
        })
      );
      group.add(magnet);

      [-0.55, 0.55].forEach(x => {
        const tip = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, 0.25, 0.36),
          new THREE.MeshStandardMaterial({ color: 0xe0e6ed, metalness: 0.95, roughness: 0.1 })
        );
        tip.position.set(x, 0, 0);
        group.add(tip);
      });
    } else if (type === 'repair') {
      // Emergency Repair Hull Kit (Neon Emerald cross)
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.75, 0.45),
        new THREE.MeshStandardMaterial({
          color: 0x059669,
          emissive: 0x10b981,
          emissiveIntensity: 0.5,
          metalness: 0.7,
          roughness: 0.3
        })
      );
      group.add(box);

      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      group.add(crossH);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      group.add(crossV);
    }

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
    if (this.particles.length > 45) {
      const excess = this.particles.splice(0, count);
      excess.forEach(p => {
        this.scene.remove(p.mesh);
        if (p.mesh.material) p.mesh.material.dispose();
      });
    }

    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(SHARED_DEBRIS_GEO, mat.clone());
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

  spawnSparks(pos, count = 14, color = 0xffe066) {
    if (this.particles.length > 55) {
      const excess = this.particles.splice(0, count);
      excess.forEach(p => {
        this.scene.remove(p.mesh);
        if (p.mesh.material) p.mesh.material.dispose();
      });
    }

    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(SHARED_SPARK_GEO, mat.clone());
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.6,
        pos.y + (Math.random() - 0.5) * 0.4,
        pos.z + (Math.random() - 0.5) * 0.6
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        2 + Math.random() * 8,
        (Math.random() - 0.5) * 16
      );

      this.particles.push({ mesh, vel, life: 0.45, maxLife: 0.45 });
    }
  }

  update(dt, playerSpeed, playerX, playerZ, currentDistance, callbacks = {}) {
    if (callbacks.jumpRamps) {
      this.jumpRamps = callbacks.jumpRamps;
    }
    if (typeof callbacks.heatLevel === 'number') {
      this.heatLevel = callbacks.heatLevel;
    }

    // 1. Spawning Timers
    this.trafficTimer -= dt;
    if (this.trafficTimer <= 0) {
      this.spawnTraffic(currentDistance);
      this.trafficTimer = Math.max(0.65, 1.8 - currentDistance / 6000);
    }

    this.obstacleTimer -= dt;
    if (this.obstacleTimer <= 0) {
      this.spawnObstacle();
      this.obstacleTimer = 2.2 + Math.random() * 2.0;
    }

    this.collectibleTimer -= dt;
    if (this.collectibleTimer <= 0) {
      this.spawnCollectible();
      this.collectibleTimer = 2.0 + Math.random() * 2.5;
    }

    // Prevent 3-wide longitudinal convergence clump deadlocks ahead of player
    preventClumpDeadlocks(this.vehicles, this.obstacles, callbacks.jumpRamps || this.jumpRamps, dt);

    // 2. Update Traffic Vehicles
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      v.prevX = v.mesh.position.x;
      v.prevZ = v.mesh.position.z;

      // Adaptive Cruise Control & Highway Spacing (Prevents NPC rear-ending)
      const headway = (v.isTruck || v.isTanker) ? 24 : 18;
      let minAheadDist = headway;
      let leadVehicle = null;

      for (let j = 0; j < this.vehicles.length; j++) {
        if (i === j) continue;
        const other = this.vehicles[j];
        const dx = Math.abs(v.mesh.position.x - other.mesh.position.x);
        const dz = v.mesh.position.z - other.mesh.position.z; // other is ahead when dz > 0
        if (dx < 2.2 && dz > 0 && dz < minAheadDist) {
          minAheadDist = dz;
          leadVehicle = other;
        }
      }

      if (leadVehicle) {
        // Slow down to match lead vehicle speed
        const followSpeed = Math.min(v.baseSpeed, leadVehicle.speed * 0.94);
        v.speed += (followSpeed - v.speed) * Math.min(1, dt * 5.0);

        // Attempt autonomous lane change if blocked (with 1.2s turn signal warning)
        if (minAheadDist < 14.0 && v.laneChangeTimer <= 0 && (v.signalTimer || 0) <= 0) {
          v.laneChangeTimer = 3.2 + Math.random() * 2.8;
          const occupied = new Set();
          this.vehicles.forEach(ov => {
            if (ov !== v && Math.abs(ov.mesh.position.z - v.mesh.position.z) < 20) {
              occupied.add(ov.targetLane ?? ov.lane);
              if (ov.pendingTargetLane !== undefined) occupied.add(ov.pendingTargetLane);
            }
          });
          this.obstacles.forEach(o => {
            if (Math.abs(o.mesh.position.z - v.mesh.position.z) < 24) occupied.add(o.lane);
          });
          let freeLanes = this.lanes.filter(l => !occupied.has(l) && l !== v.lane);
          if (v.isTruck || v.isTanker) {
            freeLanes = selectConvoyAwareLanes(freeLanes, true);
          }
          if (freeLanes.length > 0) {
            planLaneChangeWithSignal(v, freeLanes[0], 1.2);
          }
        }
      } else {
        // Highway ahead is clear, recover to cruising speed
        v.speed += (v.baseSpeed - v.speed) * Math.min(1, dt * 2.5);
      }

      // Stationary Obstacle & Repair-Zone Detection: Early Signaled Evasion or Safe Stop (Zero Clipping)
      for (const o of this.obstacles) {
        const dx = Math.abs(v.mesh.position.x - o.mesh.position.x);
        const dz = v.mesh.position.z - o.mesh.position.z; // obstacle is ahead when dz > 0
        if (dx < 2.25 && dz > 0 && dz < 28.0) {
          // Progressive braking as vehicle approaches stationary obstacle
          const brakeUrgency = dz < 10.0 ? 0.55 : 0.85;
          v.speed = Math.max(0, v.speed * Math.pow(brakeUrgency, dt * 10));
          if (dz < 24.0 && (v.signalTimer || 0) <= 0 && v.targetLane === v.lane) {
            v.laneChangeTimer = 2.5 + Math.random() * 2.0;
            const occupied = new Set();
            this.vehicles.forEach(ov => {
              if (ov !== v && Math.abs(ov.mesh.position.z - v.mesh.position.z) < 18) {
                occupied.add(ov.targetLane ?? ov.lane);
              }
            });
            const freeLanes = this.lanes.filter(l => !occupied.has(l) && Math.abs(l - o.lane) > 1.5);
            if (freeLanes.length > 0) {
              // Emergency close obstacle uses faster 0.35s signal; distant obstacle gives full 1.2s warning
              const leadTime = dz < 11.0 ? 0.35 : 1.2;
              planLaneChangeWithSignal(v, freeLanes[0], leadTime);
            }
          }
        }
      }

      // Stunt Jump Ramp Interaction for Traffic Vehicles
      if (callbacks.jumpRamps) {
        for (const ramp of callbacks.jumpRamps) {
          const rampWorldZ = ramp.parent.position.z + ramp.mesh.position.z;
          const dz = v.mesh.position.z - rampWorldZ;
          const dx = Math.abs(v.mesh.position.x - ramp.lane);
          if (dx < 1.8 && dz > 0 && dz < 22.0) {
            if (v.laneChangeTimer <= 0 && !v.isRival) {
              v.laneChangeTimer = 3.0;
              const freeLanes = this.lanes.filter(l => l !== ramp.lane);
              if (freeLanes.length > 0) {
                v.targetLane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
              }
            }
          }

          const relZ = v.mesh.position.z - rampWorldZ;
          const relX = v.mesh.position.x - ramp.lane;
          const absX = Math.abs(relX);
          if (relZ >= -2.4 && relZ <= 2.4) {
            if (absX < 1.45) {
              // Ride incline deck without interior clipping
              const progress = Math.max(0, Math.min(1, (2.4 - relZ) / 4.8));
              const deckY = 0.03 + progress * 1.32;
              v.mesh.position.y = Math.max(v.mesh.position.y || 0, deckY);
              if (relZ <= -1.8 && !v.isAirborne) {
                v.isAirborne = true;
                v.airVy = 8.0;
                v.mesh.position.y = Math.max(v.mesh.position.y || 0, deckY);
              }
            } else if (absX >= 1.45 && absX <= 2.1) {
              // Solid ramp rail bounce
              const side = Math.sign(relX) || 1;
              v.mesh.position.x = ramp.lane + side * 2.2;
              v.speed *= 0.92;
            }
          }
        }
      }

      // Handle airborne traffic vehicle physics
      if (v.isAirborne) {
        v.airVy = (v.airVy || 0) - dt * 24.0;
        v.mesh.position.y += v.airVy * dt;
        if (v.mesh.position.y <= 0) {
          v.mesh.position.y = 0;
          v.isAirborne = false;
          v.airVy = 0;
          if (Math.abs(v.mesh.position.z - playerZ) < 45) {
            this.spawnExplosion(new THREE.Vector3(v.mesh.position.x, 0.2, v.mesh.position.z), 0xffaa00, 6);
          }
        }
      }

      const relativeSpeed = playerSpeed - v.speed;
      v.mesh.position.z += relativeSpeed * dt;

      // 1.2s Pre-Change Turn Signal Countdown & Amber Flasher Animation
      if ((v.signalTimer || 0) > 0) {
        v.signalTimer = Math.max(0, v.signalTimer - dt);
        if (v.signalTimer <= 0 && v.pendingTargetLane !== undefined) {
          v.targetLane = v.pendingTargetLane;
        }
      }

      if (v.isRival && v.laneChangeTimer <= 0 && (v.signalTimer || 0) <= 0 && v.targetLane === v.lane) {
        v.laneChangeTimer = 3.5 + Math.random() * 3;
        const otherLanes = this.lanes.filter(l => l !== v.lane);
        planLaneChangeWithSignal(v, otherLanes[Math.floor(Math.random() * otherLanes.length)], 1.2);
      }

      if (v.laneChangeTimer > 0) {
        v.laneChangeTimer = Math.max(0, v.laneChangeTimer - dt);
      }

      if (v.targetLane !== v.lane) {
        v.mesh.position.x += (v.targetLane - v.mesh.position.x) * Math.min(1, dt * 3.5);
        if (Math.abs(v.targetLane - v.mesh.position.x) < 0.2) {
          v.lane = v.targetLane;
          v.pendingTargetLane = v.lane;
          v.signalDir = 0;
        }
      }

      // Flash amber turn signal LEDs when signaling or mid-lane transition
      const blinkOn = Math.sin(performance.now() * 0.025) > 0;
      const isSignaling = (v.signalTimer || 0) > 0 || v.targetLane !== v.lane;
      const leftSig = v.mesh.userData?.leftSignalMesh;
      const rightSig = v.mesh.userData?.rightSignalMesh;
      if (leftSig) {
        leftSig.visible = isSignaling && v.signalDir < 0;
        leftSig.material.opacity = blinkOn ? 1.0 : 0.15;
      }
      if (rightSig) {
        rightSig.visible = isSignaling && v.signalDir > 0;
        rightSig.material.opacity = blinkOn ? 1.0 : 0.15;
      }

      if (v.isPolice) {
        const strobe = Math.sin(performance.now() * 0.02) > 0;
        if (v.mesh.userData.sirenRedMesh && v.mesh.userData.sirenBlueMesh) {
          v.mesh.userData.sirenRedMesh.visible = strobe;
          v.mesh.userData.sirenBlueMesh.visible = !strobe;
        }
        if (v.mesh.userData.sirenLight) {
          v.mesh.userData.sirenLight.color.setHex(strobe ? 0xff0044 : 0x0088ff);
        }
      }

      // Near Miss Detection
      const dz = v.mesh.position.z - playerZ;
      const dx = Math.abs(v.mesh.position.x - playerX);
      if (!v.nearMissAwarded && !v.hit && Math.abs(dz) < 3.2 && dx < 2.5 && dx > 1.2 && playerSpeed > 22) {
        v.nearMissAwarded = true;
        if (callbacks.onNearMiss) callbacks.onNearMiss(v);
      }

      // Slipstream Drafting Detection
      if (dz < 0 && dz > -9.5 && dx < 1.1 && !v.hit) {
        if (callbacks.onDrafting) callbacks.onDrafting(dt, v);
      }

      if (v.mesh.position.z > 24) {
        this.scene.remove(v.mesh);
        this.vehicles.splice(i, 1);
      }
    }

    // Mutual Solid Collision & Hard Physical Separation for ALL Traffic Vehicles
    for (let i = 0; i < this.vehicles.length; i++) {
      for (let j = i + 1; j < this.vehicles.length; j++) {
        const v1 = this.vehicles[i];
        const v2 = this.vehicles[j];
        if (v1.hit && v2.hit) continue;

        const halfW = (v1.width + v2.width) * 0.5;
        const halfL = (v1.length + v2.length) * 0.5;
        const dx = v1.mesh.position.x - v2.mesh.position.x;
        const dz = v1.mesh.position.z - v2.mesh.position.z;
        const absX = Math.abs(dx);
        const absZ = Math.abs(dz);

        if (absX < halfW && absZ < halfL) {
          // SOLID IMPASSE: NEVER PASS THROUGH EACH OTHER
          const isV1Trailing = v1.mesh.position.z > v2.mesh.position.z;
          const trailing = isV1Trailing ? v1 : v2;
          const leading = isV1Trailing ? v2 : v1;

          if (absZ >= absX * 0.8) {
            // Longitudinal Rear-End Impasse
            trailing.mesh.position.z = leading.mesh.position.z + halfL + 0.15;
            trailing.speed = Math.min(trailing.speed, leading.speed * 0.85);
            leading.speed = Math.max(leading.speed, trailing.speed + 2.0);
          } else {
            // Lateral Side-Swipe Impasse
            const bounce = dx >= 0 ? 1 : -1;
            const overlap = (halfW - absX) * 0.5 + 0.1;
            v1.mesh.position.x = THREE.MathUtils.clamp(v1.mesh.position.x + bounce * overlap, -8.2, 8.2);
            v2.mesh.position.x = THREE.MathUtils.clamp(v2.mesh.position.x - bounce * overlap, -8.2, 8.2);
            v1.targetLane = v1.lane;
            v2.targetLane = v2.lane;
            v1.speed *= 0.92;
            v2.speed *= 0.92;
          }

          if (Math.abs(v1.mesh.position.z - playerZ) < 45) {
            this.spawnExplosion(
              new THREE.Vector3((v1.mesh.position.x + v2.mesh.position.x) * 0.5, 0.4, (v1.mesh.position.z + v2.mesh.position.z) * 0.5),
              0xffcc00,
              8
            );
          }
        }
      }
    }

    // Solid Mutual Collisions between Traffic Vehicles and Stationary Highway Obstacles
    for (const v of this.vehicles) {
      if (v.hit) continue;
      for (const o of this.obstacles) {
        const obsHalfW = 1.45;
        const obsHalfL = 1.65;
        const halfW = (v.width * 0.5 || 1.1) + obsHalfW;
        const halfL = (v.length * 0.5 || 2.2) + obsHalfL;
        const dx = v.mesh.position.x - o.mesh.position.x;
        const dz = v.mesh.position.z - o.mesh.position.z;
        const absX = Math.abs(dx);
        const absZ = Math.abs(dz);

        if (absX < halfW && absZ < halfL) {
          // SOLID IMPASSE: Separate along minimum penetration axis (rear bumper stop OR clean lateral deflect)
          const overlapX = halfW - absX;
          const overlapZ = halfL - absZ;
          if (overlapZ <= overlapX && dz > 0) {
            // Vehicle approached from behind obstacle: halt cleanly behind obstacle bumper (Zero Clipping)
            v.mesh.position.z = o.mesh.position.z + halfL + 0.15;
            v.speed = 0;
          } else {
            const bounce = dx >= 0 ? 1 : -1;
            v.mesh.position.x = THREE.MathUtils.clamp(o.mesh.position.x + bounce * (halfW + 0.15), -7.5, 7.5);
            v.targetLane = v.lane;
            v.pendingTargetLane = v.lane;
            v.signalDir = 0;
            v.signalTimer = 0;
            v.speed = Math.max(0, v.speed * 0.55);
          }
          if (Math.abs(v.mesh.position.z - playerZ) < 45) {
            this.spawnExplosion(
              new THREE.Vector3((v.mesh.position.x + o.mesh.position.x) * 0.5, 0.4, (v.mesh.position.z + o.mesh.position.z) * 0.5),
              o.isBarrel ? 0xff6600 : (o.isSpike ? 0xff2a44 : 0xffaa00),
              10
            );
          }
        }
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
      p.vel.y -= 14 * dt;
      p.mesh.rotation.x += dt * 5;
      p.mesh.rotation.y += dt * 4;
      p.mesh.scale.setScalar(Math.max(0, p.life / p.maxLife));

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        if (p.mesh.material) p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  getTrafficTelemetry() {
    const signalingVehicles = this.vehicles.filter(v => (v.signalTimer || 0) > 0 || v.targetLane !== v.lane);
    const heavyConvoys = this.vehicles.filter(v => v.isTruck || v.isTanker);
    return {
      activeVehicles: this.vehicles.length,
      activeObstacles: this.obstacles.length,
      signalingCount: signalingVehicles.length,
      signalingDetails: signalingVehicles.map(v => ({
        lane: v.lane,
        pendingTargetLane: v.pendingTargetLane,
        targetLane: v.targetLane,
        signalDir: v.signalDir,
        signalTimer: parseFloat((v.signalTimer || 0).toFixed(3))
      })),
      heavyConvoyLanes: heavyConvoys.map(v => v.lane),
      hasEscapeCorridor: hasViableEscapeCorridor(this.vehicles, this.obstacles, this.jumpRamps)
    };
  }
}
