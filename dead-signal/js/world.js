// Procedural night city for Dead Signal. Three avenues, four cross streets and
// blocks of buildings you can run between. Everything is generated from
// geometry and canvas textures, so the game ships with no model or image files.
import * as THREE from 'three';
import { buildCar, buildLamp, buildDumpster, buildBarrier, buildTree, glowSprite, PROP_GEO, PROP_MAT } from './models.js';

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

function canvasTexture(size, paint, repeat = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat !== 1) tex.repeat.set(repeat, repeat);
  return tex;
}

// ---------------------------------------------------------------- textures

function asphaltTexture(rng) {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#23262a';
    ctx.fillRect(0, 0, s, s);
    // Aggregate speckle.
    for (let i = 0; i < 9000; i++) {
      const v = 24 + rng() * 48;
      ctx.fillStyle = `rgba(${v},${v + 2},${v + 4},${0.16 + rng() * 0.35})`;
      ctx.fillRect(rng() * s, rng() * s, 1 + rng() * 2, 1 + rng() * 2);
    }
    // Cracks.
    for (let c = 0; c < 22; c++) {
      ctx.strokeStyle = `rgba(10,11,12,${0.35 + rng() * 0.4})`;
      ctx.lineWidth = 0.7 + rng() * 1.5;
      ctx.beginPath();
      let x = rng() * s;
      let y = rng() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        x += (rng() - 0.5) * 70;
        y += (rng() - 0.5) * 70;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Old repairs: darker patches.
    for (let p = 0; p < 9; p++) {
      ctx.fillStyle = `rgba(16,18,20,${0.2 + rng() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(rng() * s, rng() * s, 30 + rng() * 90, 20 + rng() * 70, rng() * 3, 0, 6.3);
      ctx.fill();
    }
  }, 8);
}

function sidewalkTexture(rng) {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#3a3c39';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const v = 60 + rng() * 60;
      ctx.fillStyle = `rgba(${v},${v},${v - 6},${0.12 + rng() * 0.2})`;
      ctx.fillRect(rng() * s, rng() * s, 2, 2);
    }
    // Slab seams.
    ctx.strokeStyle = 'rgba(14,15,15,0.75)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (i * s) / 2);
      ctx.lineTo(s, (i * s) / 2);
      ctx.moveTo((i * s) / 2, 0);
      ctx.lineTo((i * s) / 2, s);
      ctx.stroke();
    }
    // Grime in the joints.
    for (let g = 0; g < 40; g++) {
      ctx.fillStyle = `rgba(20,22,20,${0.1 + rng() * 0.25})`;
      ctx.fillRect(rng() * s, rng() * s, 6 + rng() * 30, 3 + rng() * 10);
    }
  }, 2);
}

// Facades are painted twice: a colour map for the wall, and an emissive map
// holding only the lit windows. Keeping them separate is what stops the
// concrete from glowing like a lightbox.
function facadeTextures(rng, tint) {
  const mk = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    return canvas;
  };
  const colorCanvas = mk();
  const emisCanvas = mk();
  const ctx = colorCanvas.getContext('2d');
  const emis = emisCanvas.getContext('2d');

  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 256, 256);
  emis.fillStyle = '#000';
  emis.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 320; i++) {
    ctx.fillStyle = `rgba(${20 + rng() * 40},${22 + rng() * 40},${20 + rng() * 34},${0.05 + rng() * 0.12})`;
    const w = 4 + rng() * 26;
    ctx.fillRect(rng() * 256, rng() * 256, w, w * (0.4 + rng()));
  }

  // Vertical concrete piers break up the window grid.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 4; i++) ctx.fillRect(6 + i * 62, 0, 10, 256);

  const cols = 4;
  const rows = 4;
  const padX = 18;
  const padY = 22;
  const cw = (256 - padX * 2) / cols;
  const ch = (256 - padY * 2) / rows;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() > 0.62;
      const wx = padX + x * cw + cw * 0.18;
      const wy = padY + y * ch + ch * 0.22;
      const ww = cw * 0.62;
      const wh = ch * 0.5;

      // Wall: dark glass with a faint reflection even when unlit.
      ctx.fillStyle = lit ? 'rgba(16,18,20,0.95)' : 'rgba(8,10,12,0.96)';
      ctx.fillRect(wx, wy, ww, wh);
      if (lit) {
        const warm = rng();
        ctx.fillStyle = warm > 0.55 ? 'rgba(255,205,120,0.9)' : 'rgba(170,215,255,0.6)';
        ctx.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx, wy, ww, wh);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(wx, wy + wh, ww, 2);

      if (lit) {
        const warm = rng();
        emis.fillStyle = warm > 0.55 ? 'rgba(255,200,115,1)' : 'rgba(150,205,255,0.8)';
        emis.shadowColor = 'rgba(255,190,110,0.9)';
        emis.shadowBlur = 10;
        emis.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);
        emis.shadowBlur = 0;
      }
    }
  }

  const toTex = (canvas) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };
  return { map: toTex(colorCanvas), emissiveMap: toTex(emisCanvas) };
}

// Box with UVs scaled to real-world size, so a window stays ~3 m wide whether
// the building is 8 m or 40 m long.
function tiledBox(w, h, d, material, metresPerTile = 12.8) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const su = [d, d, w, w, w, w];
  const sv = [h, h, d, d, h, h];
  for (let f = 0; f < 6; f++) {
    const scaleU = su[f] / metresPerTile;
    const scaleV = sv[f] / metresPerTile;
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * scaleU, uv.getY(k) * scaleV);
    }
  }
  uv.needsUpdate = true;
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------- geometry helpers

function box(w, h, d, material, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

const STREETS_X = [-56, 0, 56];
const STREETS_Z = [-72, -24, 24, 72];
const ROAD_HALF_X = 6.4;
const ROAD_HALF_Z = 5.8;
const CITY = 96;            // half extent of the playable city
const CURB = 0.14;          // sidewalk height

export function buildWorld(scene) {
  const rng = makeRng(90210);
  const colliders = [];
  const spawnPoints = [];
  const updaters = [];

  scene.background = new THREE.Color(0x080f13);
  scene.fog = new THREE.FogExp2(0x0b151a, 0.019);

  // ---------- lighting ----------
  const hemi = new THREE.HemisphereLight(0x8fb0c8, 0x20281c, 1.75);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x222c36, 1.05);
  scene.add(ambient);

  const moon = new THREE.DirectionalLight(0xa8c6e4, 2.4);
  moon.position.set(-34, 52, 26);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -46;
  moon.shadow.camera.right = 46;
  moon.shadow.camera.top = 46;
  moon.shadow.camera.bottom = -46;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 160;
  moon.shadow.bias = -0.0014;
  moon.shadow.normalBias = 0.035;
  scene.add(moon);
  scene.add(moon.target);

  // A cool rim light from the opposite side keeps silhouettes from going flat.
  const rim = new THREE.DirectionalLight(0x3f7fb0, 0.55);
  rim.position.set(28, 18, -40);
  scene.add(rim);

  // ---------- ground ----------
  const asphalt = asphaltTexture(rng);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x6a6f66, map: asphalt, roughness: 0.93, metalness: 0.04 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2 + 40, CITY * 2 + 40), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const concrete = sidewalkTexture(rng);
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x8b8d86, map: concrete, roughness: 0.94 });

  // ---------- lane markings ----------
  const lineMat = new THREE.MeshStandardMaterial({ color: 0x9a9a74, roughness: 0.85, emissive: 0x1a1a0d, emissiveIntensity: 0.5 });
  function laneDashes(alongZ, at) {
    for (let t = -CITY + 4; t < CITY; t += 7) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(alongZ ? 0.26 : 2.6, alongZ ? 2.6 : 0.26), lineMat);
      dash.rotation.x = -Math.PI / 2;
      if (alongZ) dash.position.set(at, 0.02, t);
      else dash.position.set(t, 0.02, at);
      scene.add(dash);
    }
  }
  STREETS_X.forEach((x) => laneDashes(true, x));
  STREETS_Z.forEach((z) => laneDashes(false, z));

  // ---------- blockers ----------
  function addCollider(x, z, w, d, h) {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height: h });
  }

  const facades = ['#33363a', '#3d3b33', '#2f353a', '#40382f'].map((t) => facadeTextures(rng, t));
  // One material per facade: every building shares four shader programs
  // instead of allocating its own.
  const facadeMats = facades.map((set) => new THREE.MeshLambertMaterial({
    map: set.map,
    emissiveMap: set.emissiveMap,
    emissive: 0xffffff,
    emissiveIntensity: 1.5,
    color: 0xbfc4bd,
  }));

  // Shared roof/detail materials: a block of the city should not allocate a
  // material per air-conditioning unit.
  const roofMetal = new THREE.MeshStandardMaterial({ color: 0x2a3033, roughness: 0.82, metalness: 0.28 });
  const acMat = new THREE.MeshStandardMaterial({ color: 0x343a3c, roughness: 0.9, metalness: 0.2 });
  const neonMats = [0x3dff9a, 0xff5470, 0x54c4ff, 0xffc247].map(
    (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));

  // ---------- buildings ----------
  function addBuilding(x, z, w, d, h) {
    // Lambert rather than Standard: it carries an emissive map (so the lit
    // windows actually glow) at a fraction of the shader cost.
    const mat = facadeMats[Math.floor(rng() * facadeMats.length)];
    const b = tiledBox(w, h, d, mat);
    b.position.set(x, h / 2, z);
    scene.add(b);
    addCollider(x, z, w, d, h);

    // Roof lip + parapet.
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x171a19, roughness: 0.95 });
    const lip = box(w + 0.6, 0.4, d + 0.6, lipMat);
    lip.position.set(x, h + 0.16, z);
    scene.add(lip);

    if (h > 14) {
      // Setback storey: reads as architecture rather than a cardboard box.
      const capW = w * 0.62;
      const capD = d * 0.62;
      const cap = box(capW, 3.2, capD, mat);
      cap.position.set(x, h + 2.0, z);
      scene.add(cap);
    }

    // Roof plant: tanks, air units and a stair head, so the skyline is not a
    // row of clean boxes when you look up from the street.
    if (rng() > 0.5) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10), roofMetal);
      tank.position.set(x + (rng() - 0.5) * (w * 0.4), h + 1.7, z + (rng() - 0.5) * (d * 0.4));
      tank.castShadow = true;
      scene.add(tank);
    }
    const acCount = h > 15 ? 2 : 1;
    for (let i = 0; i < acCount; i++) {
      const ac = box(1.3 + rng() * 1.1, 0.8 + rng() * 0.4, 1.1 + rng() * 0.7, acMat);
      ac.position.set(
        x + (rng() - 0.5) * Math.max(2, w * 0.55),
        h + 0.95,
        z + (rng() - 0.5) * Math.max(2, d * 0.55),
      );
      scene.add(ac);
    }
    const stair = box(2.1, 2.3, 2.5, roofMetal);
    stair.position.set(x - w * 0.28, h + 1.6, z + d * 0.22);
    scene.add(stair);

    // Parapet railing along the street-facing edge.
    if (h < 28) {
      const railZ = z + (z >= 0 ? -1 : 1) * (d / 2 - 0.2);
      const rail = box(w * 0.94, 0.07, 0.07, roofMetal);
      rail.position.set(x, h + 0.78, railZ);
      scene.add(rail);
      for (let i = -1; i <= 1; i++) {
        const post = box(0.07, 0.72, 0.07, roofMetal);
        post.position.set(x + i * w * 0.35, h + 0.42, railZ);
        scene.add(post);
      }
    }

    // Ground-floor canopy over the pavement, plus the occasional neon blade
    // sign on a side wall. Both are what make a facade read at eye level.
    const faceZ = z >= 0 ? -1 : 1;
    if (h > 6) {
      const canopy = box(Math.min(6, w * 0.55), 0.22, 1.5, roofMetal);
      canopy.position.set(x, 3.45, z + faceZ * (d / 2 + 0.75));
      scene.add(canopy);
    }
    if (rng() > 0.55) {
      const faceX = rng() > 0.5 ? 1 : -1;
      const sign = box(0.12, 1.5 + rng() * 1.8, Math.min(4, d * 0.45), neonMats[Math.floor(rng() * neonMats.length)]);
      sign.position.set(x + faceX * (w / 2 + 0.08), 5.5 + rng() * Math.min(9, h * 0.45), z + (rng() - 0.5) * d * 0.4);
      scene.add(sign);
    }
  }

  // Street intervals create the blocks; buildings are inset from the curb.
  function intervals(streets, half) {
    const edges = [-CITY, ...streets, CITY];
    const blocks = [];
    for (let i = 0; i < edges.length - 1; i++) {
      const lo = edges[i] + (i === 0 ? 0 : half);
      const hi = edges[i + 1] - (i + 1 === edges.length - 1 ? 0 : half);
      if (hi - lo > 6) blocks.push([lo, hi]);
    }
    return blocks;
  }
  const blockX = intervals(STREETS_X, ROAD_HALF_X);
  const blockZ = intervals(STREETS_Z, ROAD_HALF_Z);

  for (const [x0, x1] of blockX) {
    for (const [z0, z1] of blockZ) {
      const bw = x1 - x0;
      const bd = z1 - z0;

      // Sidewalk slab covering the block.
      const walk = box(bw, CURB, bd, curbMat, false);
      walk.position.set((x0 + x1) / 2, CURB / 2, (z0 + z1) / 2);
      walk.castShadow = false;
      scene.add(walk);

      const inset = 2.2;
      const innerX0 = x0 + inset;
      const innerX1 = x1 - inset;
      const innerZ0 = z0 + inset;
      const innerZ1 = z1 - inset;
      if (innerX1 - innerX0 < 5 || innerZ1 - innerZ0 < 5) continue;

      // One to three buildings per block, packed along the longer axis.
      const cols = innerX1 - innerX0 > 26 ? 2 : 1;
      const rows = innerZ1 - innerZ0 > 26 ? 2 : 1;
      const cellW = (innerX1 - innerX0) / cols;
      const cellD = (innerZ1 - innerZ0) / rows;

      for (let cx = 0; cx < cols; cx++) {
        for (let cz = 0; cz < rows; cz++) {
          const w = cellW - 1.6 - rng() * 2.2;
          const d = cellD - 1.6 - rng() * 2.2;
          if (w < 5 || d < 5) continue;
          const px = innerX0 + cellW * (cx + 0.5);
          const pz = innerZ0 + cellD * (cz + 0.5);
          // Taller toward the middle of town.
          const centre = 1 - Math.min(1, Math.hypot(px, pz) / CITY);
          const h = 7 + rng() * 10 + centre * (8 + rng() * 20);
          addBuilding(px, pz, w, d, h);
        }
      }
    }
  }

  // ---------- perimeter walls ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2b302f, roughness: 0.9, metalness: 0.15 });
  for (const s of [-1, 1]) {
    const wx = box(CITY * 2 + 8, 3.2, 1.2, wallMat);
    wx.position.set(0, 1.6, s * (CITY + 1));
    scene.add(wx);
    addCollider(0, s * (CITY + 1), CITY * 2 + 8, 1.2, 3.2);

    const wz = box(1.2, 3.2, CITY * 2 + 8, wallMat);
    wz.position.set(s * (CITY + 1), 1.6, 0);
    scene.add(wz);
    addCollider(s * (CITY + 1), 0, 1.2, CITY * 2 + 8, 3.2);
  }

  // ---------- skyline beyond the walls ----------
  const skyMat = new THREE.MeshStandardMaterial({ color: 0x0b1216, roughness: 1 });
  const skyline = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), skyMat, 70);
  skyline.castShadow = false;
  skyline.receiveShadow = false;
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + rng() * 0.06;
    const r = 112 + rng() * 46;
    const h = 14 + rng() * 40;
    m4.makeScale(9 + rng() * 9, h, 9 + rng() * 9);
    m4.setPosition(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    skyline.setMatrixAt(i, m4);
  }
  skyline.instanceMatrix.needsUpdate = true;
  scene.add(skyline);

  // ---------- relay station ----------
  const station = new THREE.Group();
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x3a4045, roughness: 0.55, metalness: 0.65 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 12, 10), mastMat);
  mast.position.y = 6;
  mast.castShadow = true;
  station.add(mast);

  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9 - i * 0.16, 0.06, 6, 16), mastMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 8.2 + i * 0.9;
    station.add(ring);
  }

  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff5533, emissive: 0xff2a12, emissiveIntensity: 3.2, roughness: 0.4, toneMapped: false });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), beaconMat);
  beacon.position.y = 12.2;
  station.add(beacon);
  const beaconGlow = glowSprite(0xff4422, 5.5, 0.55);
  beaconGlow.position.y = 12.2;
  station.add(beaconGlow);
  const beaconLight = new THREE.PointLight(0xff3a1a, 16, 30, 2);
  beaconLight.position.y = 12.2;
  station.add(beaconLight);

  const hut = box(4.4, 2.9, 3.6, new THREE.MeshStandardMaterial({ map: facades[1].map, color: 0x8e948c, roughness: 0.9 }));
  hut.position.set(0, 1.45, -58);
  scene.add(hut);
  addCollider(0, -58, 4.4, 3.6, 2.9);

  station.position.set(0, 0, -62);
  scene.add(station);
  addCollider(0, -62, 1.0, 1.0, 12);

  // ---------- street lamps ----------
  const lampLights = [];
  let lampCount = 0;
  for (const z of [-88, -58, -34, -12, 10, 32, 56, 80]) {
    for (const side of [-1, 1]) {
      const lamp = buildLamp(side * -1);
      lamp.position.set(side * (ROAD_HALF_X + 1.1), 0, z);
      scene.add(lamp);
      addCollider(lamp.position.x, z, 0.4, 0.4, 6.4);
      // Only a few real lights: the halos and shafts carry the rest.
      if (lampCount < 4) {
        const light = new THREE.PointLight(0xffb26b, 22, 24, 2);
        light.position.set(lamp.position.x + side * -1.3, 6.1, z);
        scene.add(light);
        lampLights.push(light);
      }
      lampCount++;
    }
  }
  for (const x of [-88, -40, 18, 74]) {
    for (const z of [-40, 50]) {
      const lamp = buildLamp(1);
      lamp.position.set(x, 0, z + 7.5);
      lamp.rotation.y = Math.PI / 2;
      scene.add(lamp);
      addCollider(x, z + 7.5, 0.4, 0.4, 6.4);
    }
  }

  // ---------- wrecks ----------
  const carSpots = [
    [-4.6, 6, 0.08], [4.8, 16, -0.2], [-4.4, 42, 0.36], [4.4, -18, 3.02],
    [1.4, -44, 1.55], [-2.6, 58, 0.05], [-52, 30, 1.57], [52, -6, 1.6],
    [12, 24.5, 0.02], [-14, -24.5, 3.1], [60, 46, 0.1], [-60, -36, 1.5],
  ];
  for (const [x, z, rot] of carSpots) {
    const car = buildCar(rng);
    car.position.set(x, 0, z);
    car.rotation.y = rot;
    scene.add(car);
    const along = Math.abs(Math.sin(rot)) > 0.5;
    addCollider(x, z, along ? 2 : 4.4, along ? 4.4 : 2, 1.6);
  }

  // ---------- instanced props ----------
  const crateSpots = [];
  const barrelSpots = [];
  const propRng = makeRng(4242);
  for (let i = 0; i < 34; i++) {
    const onX = propRng() > 0.5;
    const street = onX ? STREETS_Z[Math.floor(propRng() * STREETS_Z.length)] : STREETS_X[Math.floor(propRng() * STREETS_X.length)];
    const along = (propRng() * 2 - 1) * (CITY - 8);
    const off = (propRng() - 0.5) * 3;
    const x = onX ? along : street + off;
    const z = onX ? street + off : along;
    if (Math.hypot(x, z) < 10) continue;
    (propRng() > 0.55 ? crateSpots : barrelSpots).push([x, z, 0.8 + propRng() * 0.5]);
  }
  function instanceProps(list, geo, mat, isCrate) {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    list.forEach(([x, z, s], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI);
      v.set(x, isCrate ? s / 2 : 0.55 * s, z);
      sc.setScalar(s);
      m.compose(v, q, sc);
      mesh.setMatrixAt(i, m);
      addCollider(x, z, s * (isCrate ? 1 : 0.8), s * (isCrate ? 1 : 0.8), s);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }
  instanceProps(crateSpots, PROP_GEO.crate, PROP_MAT.crate, true);
  instanceProps(barrelSpots, PROP_GEO.barrel, PROP_MAT.barrel, false);

  // ---------- dumpsters, barriers, trees ----------
  for (const [x, z] of [[-9.2, -30], [9.4, 12], [-9.6, 46], [9.2, -74], [-40, 20], [38, -52]]) {
    const d = buildDumpster(rng);
    d.position.set(x, CURB, z);
    d.rotation.y = rng() * 0.4;
    scene.add(d);
    addCollider(x, z, 2.4, 1.5, 1.5);
  }

  for (const [x, z] of [[-7.6, -20], [7.6, 36], [-7.4, -66], [7.4, 68], [-30, 8], [24, -30]]) {
    const b = buildBarrier(rng);
    b.position.set(x, 0, z);
    scene.add(b);
    addCollider(x, z, 2.2, 0.9, 1.2);
  }

  for (let i = 0; i < 30; i++) {
    const a = rng() * Math.PI * 2;
    const r = 26 + rng() * 62;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x) < 9 || Math.abs(z) < 9) continue;
    const tree = buildTree(rng);
    tree.position.set(x, CURB, z);
    scene.add(tree);
    addCollider(x, z, 0.9, 0.9, 4);
  }

  // ---------- spawn ring ----------
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = 34 + (i % 3) * 9;
    spawnPoints.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  // A few points deep down the avenues, so waves arrive from the streets.
  for (const z of [-86, -70, -46, 30, 54, 82]) {
    spawnPoints.push(new THREE.Vector3((rng() - 0.5) * 6, 0, z));
    spawnPoints.push(new THREE.Vector3((rng() - 0.5) * 6 - 52, 0, z * 0.6));
    spawnPoints.push(new THREE.Vector3((rng() - 0.5) * 6 + 52, 0, z * 0.6));
  }

  // ---------- blood decals ----------
  const decalGeo = new THREE.CircleGeometry(1, 10);
  const decalMat = new THREE.MeshBasicMaterial({ color: 0x30060a, transparent: true, opacity: 0.5, depthWrite: false });
  function addDecal(x, z, size) {
    const d = new THREE.Mesh(decalGeo, decalMat);
    d.rotation.x = -Math.PI / 2;
    d.scale.setScalar(size);
    d.position.set(x, 0.021 + Math.random() * 0.004, z);
    scene.add(d);
  }

  // ---------- update ----------
  let t = 0;
  updaters.push((dt) => {
    t += dt;
    beaconMat.emissiveIntensity = 2.2 + Math.sin(t * 2.4) * 1.5;
    beaconLight.intensity = 10 + Math.sin(t * 2.4) * 6;
    beaconGlow.material.opacity = 0.45 + Math.sin(t * 2.4) * 0.18;
  });

  return {
    colliders,
    spawnPoints,
    addDecal,
    moon,
    bounds: CITY - 3,
    navExtent: CITY + 4,
    navRadius: CITY - 1,
    update(dt) { for (const fn of updaters) fn(dt); },
    // Blackout waves kill the street lighting and close the fog in.
    setBlackout(on) {
      hemi.intensity = on ? 0.4 : 1.75;
      ambient.intensity = on ? 0.22 : 1.05;
      if (scene.fog) scene.fog.density = on ? 0.05 : 0.019;
      moon.intensity = on ? 1.1 : 2.4;
    },
    // Keep the shadow frustum centred on the player so a big city still gets
    // crisp contact shadows without a huge shadow map.
    setShadowFocus(x, z) {
      moon.position.set(x - 34, 52, z + 26);
      moon.target.position.set(x, 0, z);
      moon.target.updateMatrixWorld();
    },
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
