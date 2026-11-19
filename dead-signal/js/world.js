// Procedural night town for Dead Signal. Everything here is generated from
// primitives and canvas textures, so the game ships with no model or image files.
import * as THREE from 'three';

export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lit windows painted onto a dark facade. Repeat-wrapped per building.
function facadeTexture(rng, tint) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 256, 256);

  // Concrete mottling.
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${20 + rng() * 40},${22 + rng() * 40},${20 + rng() * 34},${0.05 + rng() * 0.1})`;
    const w = 4 + rng() * 26;
    ctx.fillRect(rng() * 256, rng() * 256, w, w * (0.4 + rng()));
  }

  const cols = 4;
  const rows = 4;
  const padX = 18;
  const padY = 22;
  const cw = (256 - padX * 2) / cols;
  const ch = (256 - padY * 2) / rows;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() > 0.68;
      const wx = padX + x * cw + cw * 0.18;
      const wy = padY + y * ch + ch * 0.22;
      const ww = cw * 0.64;
      const wh = ch * 0.5;
      if (lit) {
        const warm = rng();
        ctx.fillStyle = warm > 0.55 ? 'rgba(255,205,120,0.92)' : 'rgba(180,220,255,0.5)';
        ctx.shadowColor = 'rgba(255,190,110,0.8)';
        ctx.shadowBlur = 12;
      } else {
        ctx.fillStyle = 'rgba(8,10,12,0.92)';
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(wx, wy, ww, wh);
      ctx.shadowBlur = 0;
      // Frame.
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx, wy, ww, wh);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildWorld(scene) {
  const rng = makeRng(90210);
  const colliders = [];
  const spawnPoints = [];
  const updaters = [];

  scene.background = new THREE.Color(0x0a1216);
  scene.fog = new THREE.FogExp2(0x0c161b, 0.024);

  // ---------- lighting ----------
  const hemi = new THREE.HemisphereLight(0x7d9ab2, 0x1d2718, 1.25);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xa8c6e4, 2.6);
  moon.position.set(-34, 52, 26);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -52;
  moon.shadow.camera.right = 52;
  moon.shadow.camera.top = 52;
  moon.shadow.camera.bottom = -52;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 140;
  moon.shadow.bias = -0.0016;
  moon.shadow.normalBias = 0.03;
  scene.add(moon);
  scene.add(moon.target);

  // ---------- ground ----------
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1b2418, roughness: 0.97, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.9 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(13, 260), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = true;
  scene.add(road);

  const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(12, 260), roadMat);
  crossRoad.rotation.x = -Math.PI / 2;
  crossRoad.position.y = 0.012;
  scene.add(crossRoad);

  // Faded lane markings.
  const lineMat = new THREE.MeshStandardMaterial({ color: 0x8a8b6a, roughness: 0.9, emissive: 0x14140a, emissiveIntensity: 0.4 });
  for (let i = -60; i < 60; i += 6) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 2.6), lineMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.02, i);
    scene.add(dash);
  }

  // ---------- buildings ----------
  const facadeTints = ['#2a2b2c', '#31302b', '#262a2c', '#332d28'];
  const facades = facadeTints.map((t) => facadeTexture(rng, t));
  facades.forEach((t) => { t.repeat.set(2, 2); });

  function addBuilding(x, z, w, d, h) {
    const tex = facades[Math.floor(rng() * facades.length)];
    // Lambert rather than Standard: it carries an emissive map (so the lit
    // windows actually glow) at a fraction of the shader cost, and it is the
    // variant that compiles cleanly on software rasterisers too.
    const mat = new THREE.MeshLambertMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.4,
      color: 0x8e928c,
    });
    const b = box(w, h, d, mat);
    b.position.set(x, h / 2, z);
    scene.add(b);

    // Roof lip.
    const lip = box(w + 0.5, 0.35, d + 0.5, new THREE.MeshStandardMaterial({ color: 0x191b1a, roughness: 0.95 }));
    lip.position.set(x, h + 0.1, z);
    scene.add(lip);

    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height: h });

    // Rooftop clutter reads as a skyline silhouette.
    if (rng() > 0.55) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10),
        new THREE.MeshStandardMaterial({ color: 0x22282a, roughness: 0.9 }));
      tank.position.set(x + (rng() - 0.5) * (w * 0.4), h + 1.4, z + (rng() - 0.5) * (d * 0.4));
      tank.castShadow = true;
      scene.add(tank);
    }
  }

  // Buildings line the two streets. Anything whose footprint overlaps a road
  // is pushed back onto its block, so the streets and spawn stay walkable.
  const ROAD_CLEAR = 7.6;
  function addBuildingSafe(x, z, w, d, h) {
    if (x - w / 2 < ROAD_CLEAR && x + w / 2 > -ROAD_CLEAR) {
      x = (x < 0 ? -1 : 1) * (ROAD_CLEAR + w / 2);
    }
    if (z - d / 2 < ROAD_CLEAR && z + d / 2 > -ROAD_CLEAR) {
      z = (z < 0 ? -1 : 1) * (ROAD_CLEAR + d / 2);
    }
    addBuilding(x, z, w, d, h);
  }

  for (let i = 0; i < 9; i++) {
    const z = -52 + i * 13 + rng() * 3;
    addBuildingSafe(-13 - rng() * 3, z, 8 + rng() * 4, 9 + rng() * 3, 9 + rng() * 9);
    addBuildingSafe(13 + rng() * 3, z + 4, 8 + rng() * 4, 9 + rng() * 3, 8 + rng() * 10);
  }
  for (let i = 0; i < 7; i++) {
    const x = -50 + i * 14 + rng() * 3;
    addBuildingSafe(x, -14 - rng() * 3, 9 + rng() * 3, 8 + rng() * 4, 7 + rng() * 8);
    addBuildingSafe(x + 5, 14 + rng() * 3, 9 + rng() * 3, 8 + rng() * 4, 8 + rng() * 9);
  }

  // Distant silhouette ring so the horizon is not empty.
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + rng() * 0.08;
    const r = 74 + rng() * 30;
    const h = 12 + rng() * 26;
    const b = box(9 + rng() * 8, h, 9 + rng() * 8, new THREE.MeshStandardMaterial({ color: 0x0d1417, roughness: 1 }));
    b.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    b.castShadow = false;
    b.receiveShadow = false;
    scene.add(b);
  }

  // ---------- relay station (the thing you are holding) ----------
  const station = new THREE.Group();
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x3a4045, roughness: 0.6, metalness: 0.55 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 12, 8), mastMat);
  mast.position.y = 6;
  mast.castShadow = true;
  station.add(mast);

  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9 - i * 0.16, 0.06, 6, 16), mastMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 8.2 + i * 0.9;
    station.add(ring);
  }

  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff5533, emissive: 0xff2a12, emissiveIntensity: 3.2, roughness: 0.4 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), beaconMat);
  beacon.position.y = 12.2;
  station.add(beacon);
  const beaconLight = new THREE.PointLight(0xff3a1a, 14, 26, 2);
  beaconLight.position.y = 12.2;
  station.add(beaconLight);

  const hut = box(4.4, 2.9, 3.6, new THREE.MeshStandardMaterial({ map: facades[1], color: 0x8e948c, roughness: 0.9 }));
  hut.position.set(0, 1.45, -58);
  scene.add(hut);
  colliders.push({ minX: -2.2, maxX: 2.2, minZ: -59.8, maxZ: -56.2, height: 2.9 });

  station.position.set(0, 0, -58);
  scene.add(station);
  colliders.push({ minX: -0.5, maxX: 0.5, minZ: -58.5, maxZ: -57.5, height: 12 });

  // ---------- street lights ----------
  const lampGlowMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc070, emissiveIntensity: 2.4 });
  const lampPositions = [
    [-8, -22], [8, -38], [-8, 6], [8, 24], [-8, 42], [8, 54],
  ];
  lampPositions.forEach(([x, z], i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 6.4, 7),
      new THREE.MeshStandardMaterial({ color: 0x20262a, roughness: 0.85, metalness: 0.4 }));
    pole.position.set(x, 3.2, z);
    pole.castShadow = true;
    scene.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.12), pole.material);
    arm.position.set(x + (x > 0 ? -0.7 : 0.7), 6.3, z);
    scene.add(arm);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), lampGlowMat);
    bulb.position.set(x + (x > 0 ? -1.35 : 1.35), 6.2, z);
    scene.add(bulb);

    // Only the two lamps nearest the crossroads get real lights (cheap + bright).
    if (i < 2) {
      const light = new THREE.PointLight(0xffb26b, 26, 26, 2);
      light.position.set(x + (x > 0 ? -1.35 : 1.35), 6.1, z);
      scene.add(light);
    }
  });

  // ---------- wrecks ----------
  const carColors = [0x4a2b2b, 0x2c3a44, 0x3b3b30, 0x40323f];
  function addCar(x, z, rot) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: carColors[Math.floor(rng() * carColors.length)], roughness: 0.62, metalness: 0.35 });
    const body = box(4.3, 0.85, 1.9, bodyMat);
    body.position.y = 0.72;
    g.add(body);
    const cabin = box(2.2, 0.75, 1.75, new THREE.MeshStandardMaterial({ color: 0x10161a, roughness: 0.35, metalness: 0.5 }));
    cabin.position.set(-0.15, 1.45, 0);
    g.add(cabin);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
    [[-1.4, 0.95], [1.4, 0.95], [-1.4, -0.95], [1.4, -0.95]].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12), wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      g.add(wheel);
    });
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    scene.add(g);
    const half = 2.4;
    colliders.push({ minX: x - half, maxX: x + half, minZ: z - 1.5, maxZ: z + 1.5, height: 1.6 });
  }
  addCar(-5.4, -6, 0.12);
  addCar(5.2, 15, -0.22);
  addCar(-4.8, 34, 0.4);
  addCar(4.6, -30, 3.0);
  addCar(1.2, -44, 1.56);
  addCar(-2.4, 50, 0.08);

  // ---------- props ----------
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x4a3b28, roughness: 0.95 });
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x2f4535, roughness: 0.75, metalness: 0.35 });
  const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x3d3a2c, roughness: 1 });

  function addCrate(x, z, s = 1.1) {
    const c = box(s, s, s, crateMat);
    c.position.set(x, s / 2, z);
    c.rotation.y = rng() * 0.6;
    scene.add(c);
    colliders.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2, height: s });
  }

  function addBarrel(x, z) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 12), barrelMat);
    b.position.set(x, 0.58, z);
    b.castShadow = true;
    b.receiveShadow = true;
    scene.add(b);
    colliders.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.45, maxZ: z + 0.45, height: 1.2 });
  }

  function addSandbags(x, z, count, rot) {
    for (let i = 0; i < count; i++) {
      const b = box(0.9, 0.34, 0.55, sandbagMat);
      b.position.set(x + (i % 2) * 0.28, 0.17 + Math.floor(i / 2) * 0.32, z);
      b.rotation.y = rot + (rng() - 0.5) * 0.2;
      scene.add(b);
    }
    colliders.push({ minX: x - 0.6, maxX: x + 0.7, minZ: z - 0.45, maxZ: z + 0.45, height: 0.9 });
  }

  addSandbags(-3.4, -47, 4, 0);
  addSandbags(3.4, -46.4, 4, 0);
  addSandbags(0, 41, 4, 0.1);
  addCrate(2.6, -50.5, 1.2);
  addCrate(-2.9, -51.2, 1.2);
  addCrate(6.6, -18);
  addCrate(-6.9, 20, 1.3);
  addCrate(7.4, 44);
  addBarrel(-7.6, -12);
  addBarrel(-8.2, -11.2);
  addBarrel(8.4, 8);
  addBarrel(7.9, 8.9);
  addBarrel(3.1, 33);

  // ---------- dead trees ----------
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x2a2119, roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2;
    const r = 24 + rng() * 34;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x) < 10 || Math.abs(z) < 10) continue;
    const g = new THREE.Group();
    const h = 4.5 + rng() * 3.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, h, 6), barkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    g.add(trunk);
    const branches = 2 + Math.floor(rng() * 3);
    for (let b = 0; b < branches; b++) {
      const bl = 1.4 + rng() * 1.6;
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, bl, 5), barkMat);
      branch.position.set(0, h * (0.55 + rng() * 0.4), 0);
      branch.rotation.z = (rng() - 0.5) * 1.4;
      branch.rotation.x = (rng() - 0.5) * 1.4;
      branch.translateY(bl / 2);
      g.add(branch);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rng() * Math.PI;
    scene.add(g);
  }

  // ---------- fencing so the arena reads as closed ----------
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x2b3134, roughness: 0.85, metalness: 0.4 });
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const r = 66;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 5), fenceMat);
    post.position.set(x, 1.1, z);
    scene.add(post);
    if (i % 2 === 0) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2 * Math.PI * r / 40, 0.05, 0.05), fenceMat);
      rail.position.set(Math.cos(a + Math.PI / 40) * r, 1.5, Math.sin(a + Math.PI / 40) * r);
      rail.rotation.y = -a;
      scene.add(rail);
    }
  }

  // ---------- spawn ring ----------
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 34 + (i % 3) * 5;
    spawnPoints.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }

  // ---------- blood decals left by corpses ----------
  const decalMat = new THREE.MeshBasicMaterial({ color: 0x31060a, transparent: true, opacity: 0.55, depthWrite: false });
  function addDecal(x, z, size) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(size, 8), decalMat);
    d.rotation.x = -Math.PI / 2;
    d.position.set(x, 0.02 + Math.random() * 0.005, z);
    scene.add(d);
  }

  // ---------- update ----------
  let t = 0;
  updaters.push((dt) => {
    t += dt;
    // Beacon pulse.
    beaconMat.emissiveIntensity = 2.2 + Math.sin(t * 2.4) * 1.5;
    beaconLight.intensity = 10 + Math.sin(t * 2.4) * 6;
  });

  return {
    colliders,
    spawnPoints,
    addDecal,
    update(dt) { for (const fn of updaters) fn(dt); },
    moon,
  };
}

// Axis-aligned box vs circle push-out, used by both player and zombies.
export function resolveCircle(colliders, pos, radius) {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.height !== undefined && c.height < 0.4) continue;
    const nearestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nearestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nearestX;
    const dz = pos.z - nearestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq > radius * radius) continue;

    if (distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      const push = radius - dist;
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
    } else {
      // Centre is inside the box: escape along the shallowest axis.
      const left = pos.x - c.minX;
      const right = c.maxX - pos.x;
      const back = pos.z - c.minZ;
      const front = c.maxZ - pos.z;
      const min = Math.min(left, right, back, front);
      if (min === left) pos.x = c.minX - radius;
      else if (min === right) pos.x = c.maxX + radius;
      else if (min === back) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
}
