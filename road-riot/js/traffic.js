// Road Riot 3D - Intelligent Traffic, Chemical Tankers, Police Spike Strips & Drone AI
import * as THREE from 'three';

const SHARED_DEBRIS_GEO = new THREE.BoxGeometry(0.24, 0.24, 0.24);

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
  }

  spawnTraffic(currentDistance) {
    const lanes = [-6, 0, 6];
    const occupiedLanes = new Set(
      this.vehicles.filter(v => v.mesh.position.z < -120).map(v => v.lane)
    );
    const availableLanes = lanes.filter(l => !occupiedLanes.has(l));
    if (!availableLanes.length) return;

    const spawnCount = currentDistance > 2500 ? (Math.random() < 0.4 ? 2 : 1) : 1;
    const chosenLanes = availableLanes.sort(() => Math.random() - 0.5).slice(0, spawnCount);

    chosenLanes.forEach(lane => {
      const roll = Math.random();
      let type = 'sports';
      let speed = 21 + Math.random() * 4;
      let isRival = false;
      let isPolice = false;
      let isTruck = false;
      let isTanker = false;

      // Rebalanced speeds for 80-120 km/h stock cruising and 150-160 km/h boost
      if (currentDistance > 1800 && Math.random() < 0.18) {
        type = 'tanker';
        speed = 16 + Math.random() * 3; // ~60 km/h
        isTanker = true;
      } else if (currentDistance > 1400 && Math.random() < 0.22) {
        type = 'rival';
        speed = 26 + Math.random() * 5; // ~98 km/h
        isRival = true;
      } else if (currentDistance > 2200 && Math.random() < 0.18) {
        type = 'police';
        speed = 24 + Math.random() * 4; // ~90 km/h
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

      const mesh = this.buildVehicleMesh(type, isRival, isPolice, isTruck, isTanker);
      mesh.position.set(lane, 0, -145);
      this.scene.add(mesh);

      this.vehicles.push({
        mesh,
        lane,
        targetLane: lane,
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
    });
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

      return wrapper;
    }

    const palette = [0xff3355, 0xffaa00, 0x00d9ff, 0x9944ff, 0x00ff88, 0xffffff];
    const color = palette[Math.floor(Math.random() * palette.length)];
    return this.buildProceduralTraffic(type, color, isRival, isPolice);
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

    return group;
  }

  spawnObstacle() {
    const lane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
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
    const lane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
    const roll = Math.random();
    let type = 'coin';

    if (roll < 0.50) {
      type = 'coin';
    } else if (roll < 0.72) {
      type = 'nitro';
    } else if (roll < 0.84) {
      type = 'shield';
    } else if (roll < 0.92) {
      type = 'magnet';
    } else {
      type = 'repair';
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
      const canister = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 1.3, 14),
        new THREE.MeshStandardMaterial({
          color: 0x00d9ff,
          emissive: 0x00f0ff,
          emissiveIntensity: 0.85,
          metalness: 0.8,
          roughness: 0.2
        })
      );
      group.add(canister);

      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10),
        new THREE.MeshStandardMaterial({ color: 0x111620, metalness: 0.9 })
      );
      cap.position.y = 0.75;
      group.add(cap);
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
      this.obstacleTimer = 2.2 + Math.random() * 2.0;
    }

    this.collectibleTimer -= dt;
    if (this.collectibleTimer <= 0) {
      this.spawnCollectible();
      this.collectibleTimer = 2.0 + Math.random() * 2.5;
    }

    // 2. Update Traffic Vehicles
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      const relativeSpeed = playerSpeed - v.speed;
      v.mesh.position.z += relativeSpeed * dt;

      if (v.isRival) {
        v.laneChangeTimer -= dt;
        if (v.laneChangeTimer <= 0) {
          v.laneChangeTimer = 3.5 + Math.random() * 3;
          const otherLanes = this.lanes.filter(l => l !== v.lane);
          v.targetLane = otherLanes[Math.floor(Math.random() * otherLanes.length)];
        }
        v.mesh.position.x += (v.targetLane - v.mesh.position.x) * Math.min(1, dt * 3.5);
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
}
