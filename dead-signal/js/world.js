// Procedural night city for Dead Signal.
// Expanded layout with distinct districts (Downtown Financial Core, Commercial Nightlife,
// Industrial Warehouse Sector, Quarantine Checkpoint Zone), landmark structures (Relay Citadel,
// Fallen Highway Overpass, Crashed Military APC), road crosswalk markings, reflective puddles,
// steam vents, and instanced props for high performance at 60 FPS.
import * as THREE from 'three';
import {
  buildCar, buildApc, buildLamp, buildDumpster, buildBarrier, buildTree,
  glowSprite, PROP_GEO, PROP_MAT
} from './models.js';

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
    ctx.fillStyle = '#1c1f23';
    ctx.fillRect(0, 0, s, s);
    // Aggregate speckle.
    for (let i = 0; i < 9000; i++) {
      const v = 22 + rng() * 44;
      ctx.fillStyle = `rgba(${v},${v + 2},${v + 4},${0.18 + rng() * 0.35})`;
      ctx.fillRect(rng() * s, rng() * s, 1 + rng() * 2, 1 + rng() * 2);
    }
    // Cracks.
    for (let c = 0; c < 28; c++) {
      ctx.strokeStyle = `rgba(8,9,11,${0.4 + rng() * 0.4})`;
      ctx.lineWidth = 0.8 + rng() * 1.6;
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
    // Old tarmac repair patches.
    for (let p = 0; p < 12; p++) {
      ctx.fillStyle = `rgba(12,14,16,${0.25 + rng() * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(rng() * s, rng() * s, 30 + rng() * 90, 20 + rng() * 70, rng() * 3, 0, 6.3);
      ctx.fill();
    }
  }, 8);
}

function sidewalkTexture(rng) {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#343633';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const v = 50 + rng() * 50;
      ctx.fillStyle = `rgba(${v},${v},${v - 6},${0.14 + rng() * 0.2})`;
      ctx.fillRect(rng() * s, rng() * s, 2, 2);
    }
    // Slab seams.
    ctx.strokeStyle = 'rgba(12,13,13,0.85)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (i * s) / 2);
      ctx.lineTo(s, (i * s) / 2);
      ctx.moveTo((i * s) / 2, 0);
      ctx.lineTo((i * s) / 2, s);
      ctx.stroke();
    }
  }, 2);
}

function districtFacadeTexture(rng, theme = 'office') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const emisCanvas = document.createElement('canvas');
  emisCanvas.width = emisCanvas.height = 256;
  const ctx = canvas.getContext('2d');
  const emis = emisCanvas.getContext('2d');

  let baseColor = '#2b2f33';
  if (theme === 'industrial') baseColor = '#3a2b22';
  else if (theme === 'commercial') baseColor = '#24282c';
  else if (theme === 'quarantine') baseColor = '#26292b';

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);
  emis.fillStyle = '#000';
  emis.fillRect(0, 0, 256, 256);

  // Surface texture / brick or panels
  if (theme === 'industrial') {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < 256; y += 8) {
      ctx.fillRect(0, y, 256, 1.5);
    }
  } else {
    for (let i = 0; i < 350; i++) {
      ctx.fillStyle = `rgba(${20 + rng() * 40},${22 + rng() * 40},${20 + rng() * 34},${0.06 + rng() * 0.12})`;
      const w = 4 + rng() * 26;
      ctx.fillRect(rng() * 256, rng() * 256, w, w * (0.4 + rng()));
    }
  }

  // Windows
  const cols = theme === 'industrial' ? 3 : 4;
  const rows = theme === 'industrial' ? 3 : 4;
  const padX = 16;
  const padY = 20;
  const cw = (256 - padX * 2) / cols;
  const ch = (256 - padY * 2) / rows;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() > (theme === 'industrial' ? 0.78 : theme === 'commercial' ? 0.45 : 0.6);
      const wx = padX + x * cw + cw * 0.18;
      const wy = padY + y * ch + ch * 0.22;
      const ww = cw * 0.64;
      const wh = ch * 0.52;

      ctx.fillStyle = lit ? 'rgba(16,18,22,0.95)' : 'rgba(8,10,12,0.98)';
      ctx.fillRect(wx, wy, ww, wh);

      if (lit) {
        const warm = rng() > 0.4;
        const colorStr = warm ? 'rgba(255,210,130,0.92)' : 'rgba(170,225,255,0.75)';
        ctx.fillStyle = colorStr;
        ctx.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);

        emis.fillStyle = warm ? 'rgba(255,195,110,1)' : 'rgba(145,215,255,0.85)';
        emis.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);
      }

      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx, wy, ww, wh);
    }
  }

  const toTex = (c) => {
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };

  return { map: toTex(canvas), emissiveMap: toTex(emisCanvas) };
}

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

function box(w, h, d, material, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------- city layout

const STREETS_X = [-96, -48, 0, 48, 96];
const STREETS_Z = [-108, -72, -36, 0, 36, 72, 108];
const ROAD_HALF_X = 6.4;
const ROAD_HALF_Z = 5.8;
const CITY = 144;           // playable half-extent of the city
const CURB = 0.14;         // sidewalk curb height

export function buildWorld(scene) {
  const rng = makeRng(90210);
  const colliders = [];
  const spawnPoints = [];
  const updaters = [];

  scene.background = new THREE.Color(0x060c10);
  scene.fog = new THREE.FogExp2(0x081218, 0.016);

  // ---------- lighting ----------
  const hemi = new THREE.HemisphereLight(0x92b6d2, 0x1a241e, 1.8);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x242e38, 1.1);
  scene.add(ambient);

  const moon = new THREE.DirectionalLight(0xaad0f0, 2.5);
  moon.position.set(-36, 56, 28);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -72;
  moon.shadow.camera.right = 72;
  moon.shadow.camera.top = 72;
  moon.shadow.camera.bottom = -72;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 240;
  moon.shadow.bias = -0.0014;
  moon.shadow.normalBias = 0.035;
  scene.add(moon);
  scene.add(moon.target);

  const rim = new THREE.DirectionalLight(0x3878a8, 0.6);
  rim.position.set(30, 20, -42);
  scene.add(rim);

  // ---------- ground & asphalt ----------
  const asphalt = asphaltTexture(rng);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x626760, map: asphalt, roughness: 0.92, metalness: 0.06
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2 + 90, CITY * 2 + 90), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const concrete = sidewalkTexture(rng);
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x848880, map: concrete, roughness: 0.94 });

  // ---------- lane markings & crosswalks ----------
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0x9a9a72, roughness: 0.85, emissive: 0x1a1a0c, emissiveIntensity: 0.5
  });
  const whitePaintMat = new THREE.MeshStandardMaterial({
    color: 0xd6ddd2, roughness: 0.88, emissive: 0x1f221e, emissiveIntensity: 0.4
  });

  function laneDashes(alongZ, at) {
    for (let t = -CITY + 4; t < CITY; t += 8) {
      // Don't draw dashes inside intersections
      let inIntersection = false;
      const crossStreets = alongZ ? STREETS_Z : STREETS_X;
      for (const cs of crossStreets) {
        if (Math.abs(t - cs) < (alongZ ? ROAD_HALF_Z : ROAD_HALF_X) + 1.2) {
          inIntersection = true;
          break;
        }
      }
      if (inIntersection) continue;

      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(alongZ ? 0.28 : 2.8, alongZ ? 2.8 : 0.28),
        lineMat
      );
      dash.rotation.x = -Math.PI / 2;
      if (alongZ) dash.position.set(at, 0.02, t);
      else dash.position.set(t, 0.02, at);
      scene.add(dash);
    }
  }
  STREETS_X.forEach((x) => laneDashes(true, x));
  STREETS_Z.forEach((z) => laneDashes(false, z));

  // Pedestrian zebra crosswalks at intersections
  function buildCrosswalk(cx, cz) {
    for (const offset of [-ROAD_HALF_Z - 1.2, ROAD_HALF_Z + 1.2]) {
      for (let s = -ROAD_HALF_X + 1.2; s <= ROAD_HALF_X - 1.2; s += 1.4) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.2), whitePaintMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(cx + s, 0.021, cz + offset);
        scene.add(stripe);
      }
    }
    for (const offset of [-ROAD_HALF_X - 1.2, ROAD_HALF_X + 1.2]) {
      for (let s = -ROAD_HALF_Z + 1.2; s <= ROAD_HALF_Z - 1.2; s += 1.4) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), whitePaintMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(cx + offset, 0.021, cz + s);
        scene.add(stripe);
      }
    }
  }
  for (const sx of STREETS_X) {
    for (const sz of STREETS_Z) {
      buildCrosswalk(sx, sz);
    }
  }

  // ---------- colliders ----------
  function addCollider(x, z, w, d, h, opts = {}) {
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      height: h,
      material: opts.material || 'concrete',
      penetrable: !!opts.penetrable,
      penCost: opts.penCost !== undefined ? opts.penCost : (opts.penetrable ? 0.35 : 99),
    });
  }

  // ---------- building facades by district ----------
  const themes = ['office', 'commercial', 'industrial', 'quarantine'];
  const districtMats = {};
  for (const th of themes) {
    const f = districtFacadeTexture(rng, th);
    districtMats[th] = new THREE.MeshLambertMaterial({
      map: f.map,
      emissiveMap: f.emissiveMap,
      emissive: 0xffffff,
      emissiveIntensity: 1.45,
      color: 0xbec4bd,
    });
  }

  const roofMetal = new THREE.MeshStandardMaterial({ color: 0x282f33, roughness: 0.82, metalness: 0.3 });
  const acMat = new THREE.MeshStandardMaterial({ color: 0x33393c, roughness: 0.9, metalness: 0.2 });
  const neonMats = [0x3dff9a, 0xff5470, 0x54c4ff, 0xffc247, 0xd048ff].map(
    (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));

  function getDistrict(x, z) {
    if (Math.abs(x) < 45 && Math.abs(z) < 45) return 'office'; // Financial Core
    if (x > 35) return 'commercial'; // Commercial District
    if (x < -35) return 'industrial'; // Industrial District
    return 'quarantine'; // Perimeter
  }

  function addBuilding(x, z, w, d, h, theme) {
    const mat = districtMats[theme] || districtMats.office;
    const b = tiledBox(w, h, d, mat);
    b.position.set(x, h / 2, z);
    scene.add(b);
    addCollider(x, z, w, d, h);

    // Parapet roof rim
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x161817, roughness: 0.95 });
    const lip = box(w + 0.6, 0.45, d + 0.6, lipMat);
    lip.position.set(x, h + 0.18, z);
    scene.add(lip);

    // Setback top floor for highrises
    if (h > 18) {
      const capW = w * 0.64;
      const capD = d * 0.64;
      const capH = 3.6;
      const cap = box(capW, capH, capD, mat);
      cap.position.set(x, h + capH / 2 + 0.3, z);
      scene.add(cap);

      // Rooftop communications antenna
      if (rng() > 0.4) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 5.5, 6), roofMetal);
        ant.position.set(x, h + capH + 2.7, z);
        ant.castShadow = true;
        scene.add(ant);
      }
    }

    // Roof clutter: water tanks and air chillers
    if (rng() > 0.45) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.4, 10), roofMetal);
      tank.position.set(x + (rng() - 0.5) * (w * 0.38), h + 1.8, z + (rng() - 0.5) * (d * 0.38));
      tank.castShadow = true;
      scene.add(tank);
    }
    const acUnits = h > 16 ? 2 : 1;
    for (let i = 0; i < acUnits; i++) {
      const ac = box(1.4 + rng() * 1.0, 0.85 + rng() * 0.4, 1.2 + rng() * 0.6, acMat);
      ac.position.set(
        x + (rng() - 0.5) * Math.max(2, w * 0.5),
        h + 0.95,
        z + (rng() - 0.5) * Math.max(2, d * 0.5)
      );
      scene.add(ac);
    }

    // Ground floor storefront canopies & neon blade signs
    const faceZ = z >= 0 ? -1 : 1;
    if (h > 6 && (theme === 'commercial' || theme === 'office')) {
      const canopy = box(Math.min(6.5, w * 0.6), 0.22, 1.6, roofMetal);
      canopy.position.set(x, 3.45, z + faceZ * (d / 2 + 0.8));
      scene.add(canopy);
    }
    if (rng() > 0.5) {
      const faceX = rng() > 0.5 ? 1 : -1;
      const signMat = neonMats[Math.floor(rng() * neonMats.length)];
      const sign = box(0.12, 1.6 + rng() * 2.2, Math.min(4.2, d * 0.45), signMat);
      sign.position.set(x + faceX * (w / 2 + 0.09), 5.5 + rng() * Math.min(10, h * 0.4), z + (rng() - 0.5) * d * 0.4);
      scene.add(sign);
    }
  }

  // Street intervals
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

      // Sidewalk slab
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

      const midX = (innerX0 + innerX1) / 2;
      const midZ = (innerZ0 + innerZ1) / 2;

      // Leave Central Relay Citadel area clear
      if (Math.hypot(midX, midZ - (-72)) < 16) continue;

      const district = getDistrict(midX, midZ);
      const cols = innerX1 - innerX0 > 28 ? 2 : 1;
      const rows = innerZ1 - innerZ0 > 28 ? 2 : 1;
      const cellW = (innerX1 - innerX0) / cols;
      const cellD = (innerZ1 - innerZ0) / rows;

      for (let cx = 0; cx < cols; cx++) {
        for (let cz = 0; cz < rows; cz++) {
          const w = cellW - 1.8 - rng() * 2.2;
          const d = cellD - 1.8 - rng() * 2.2;
          if (w < 5 || d < 5) continue;
          const px = innerX0 + cellW * (cx + 0.5);
          const pz = innerZ0 + cellD * (cz + 0.5);

          let h = 8 + rng() * 8;
          if (district === 'office') {
            const centreDist = 1 - Math.min(1, Math.hypot(px, pz) / 80);
            h = 24 + rng() * 16 + centreDist * 18;
          } else if (district === 'commercial') {
            h = 14 + rng() * 14;
          } else if (district === 'industrial') {
            h = 7 + rng() * 8;
          } else {
            h = 10 + rng() * 12;
          }

          addBuilding(px, pz, w, d, h, district);

          if (rng() > 0.45 && w > 12 && d > 12) {
            const subW = Math.max(5, cellW * 0.28 - 1.2);
            const subD = Math.max(5, cellD * 0.28 - 1.2);
            const sx = px + (rng() - 0.5) * cellW * 0.4;
            const sz = pz + (rng() - 0.5) * cellD * 0.4;
            addBuilding(sx, sz, subW, subD, 4 + rng() * 5, district);
          }
        }
      }
    }
  }

  // ---------- perimeter security walls & fences ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x252a29, roughness: 0.92, metalness: 0.15 });
  for (const s of [-1, 1]) {
    const wx = box(CITY * 2 + 10, 3.4, 1.4, wallMat);
    wx.position.set(0, 1.7, s * (CITY + 1.2));
    scene.add(wx);
    addCollider(0, s * (CITY + 1.2), CITY * 2 + 10, 1.4, 3.4);

    const wz = box(1.4, 3.4, CITY * 2 + 10, wallMat);
    wz.position.set(s * (CITY + 1.2), 1.7, 0);
    scene.add(wz);
    addCollider(s * (CITY + 1.2), 0, 1.4, CITY * 2 + 10, 3.4);
  }

  // Fence posts and razor rails
  const fencePostMat = new THREE.MeshStandardMaterial({ color: 0x1f2324, roughness: 0.85 });
  const fencePost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), fencePostMat);
  const fenceRail = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 0.05), fencePostMat);

  for (const s of [-1, 1]) {
    const edgeZ = s * (CITY + 1.2);
    for (let x = -CITY; x <= CITY; x += 6) {
      const post = fencePost.clone();
      post.position.set(x, 3.9, edgeZ);
      scene.add(post);
    }
    for (let x = -CITY; x < CITY; x += 6) {
      const rail = fenceRail.clone();
      rail.position.set(x + 3, 4.2, edgeZ);
      scene.add(rail);
    }
    const edgeX = s * (CITY + 1.2);
    for (let z = -CITY; z <= CITY; z += 6) {
      const post = fencePost.clone();
      post.position.set(edgeX, 3.9, z);
      scene.add(post);
    }
    for (let z = -CITY; z < CITY; z += 6) {
      const rail = fenceRail.clone();
      rail.position.set(edgeX, 4.2, z + 3);
      rail.rotation.y = Math.PI / 2;
      scene.add(rail);
    }
  }

  // ---------- skyline beyond the perimeter ----------
  const skyMat = new THREE.MeshStandardMaterial({ color: 0x080f14, roughness: 1 });
  const skyline = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), skyMat, 130);
  skyline.castShadow = false;
  skyline.receiveShadow = false;
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 130; i++) {
    const a = (i / 130) * Math.PI * 2 + rng() * 0.05;
    const r = 165 + rng() * 70;
    const h = 18 + rng() * 52;
    m4.makeScale(10 + rng() * 12, h, 10 + rng() * 12);
    m4.setPosition(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    skyline.setMatrixAt(i, m4);
  }
  skyline.instanceMatrix.needsUpdate = true;
  scene.add(skyline);

  // ---------- LANDMARK 1: Central Relay Citadel (x: 0, z: -72) ----------
  const citadel = new THREE.Group();
  const bunkerMat = new THREE.MeshStandardMaterial({ color: 0x363c3a, roughness: 0.9, metalness: 0.2 });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x485055, roughness: 0.45, metalness: 0.7 });

  // Main concrete bunker building
  const bunker = box(7.2, 3.8, 5.8, bunkerMat);
  bunker.position.set(0, 1.9, -70);
  scene.add(bunker);
  addCollider(0, -70, 7.2, 5.8, 3.8);

  // Antenna Mast Tower
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.48, 16, 12), mastMat);
  mast.position.set(0, 8.0, -74);
  mast.castShadow = true;
  scene.add(mast);
  addCollider(0, -74, 1.2, 1.2, 16);

  // Microwave dishes
  const dishMat = new THREE.MeshStandardMaterial({ color: 0xd2d7dc, roughness: 0.5, metalness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.35), dishMat);
    dish.rotation.x = Math.PI / 2 + (i - 1) * 0.2;
    dish.position.set((i - 1) * 1.1, 10.5 + i * 1.6, -73.6);
    scene.add(dish);
  }

  // Transmission pulse rings
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x4aa3df, emissive: 0x1f66a0, emissiveIntensity: 2.2, roughness: 0.4 });
  const pulseRings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2 - i * 0.22, 0.08, 8, 20), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 11.8 + i * 1.2, -74);
    scene.add(ring);
    pulseRings.push(ring);
  }

  // Beacon & aircraft warning strobe
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff3b24, emissive: 0xff2010, emissiveIntensity: 3.8, roughness: 0.3, toneMapped: false
  });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), beaconMat);
  beacon.position.set(0, 16.2, -74);
  scene.add(beacon);

  const beaconGlow = glowSprite(0xff3311, 6.5, 0.65);
  beaconGlow.position.copy(beacon.position);
  scene.add(beaconGlow);

  const beaconLight = new THREE.PointLight(0xff2b14, 20, 36, 2);
  beaconLight.position.copy(beacon.position);
  scene.add(beaconLight);

  // ---------- LANDMARK 2: Broken Highway Overpass (z = 36) ----------
  const overpassPillarMat = new THREE.MeshStandardMaterial({ color: 0x484d4f, roughness: 0.92 });
  const overpassDeckMat = new THREE.MeshStandardMaterial({ color: 0x33383a, roughness: 0.94 });
  const guardrailMat = new THREE.MeshStandardMaterial({ color: 0x6e767a, roughness: 0.7, metalness: 0.4 });

  // Pillars at intervals across X
  const pillarX = [-88, -44, 44, 88]; // Leave center fractured
  for (const px of pillarX) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 7.6, 12), overpassPillarMat);
    pillar.position.set(px, 3.8, 36);
    pillar.castShadow = true;
    scene.add(pillar);
    addCollider(px, 36, 2.6, 2.6, 7.6);
  }

  // Left highway deck span
  const deckL = box(82, 1.2, 8.8, overpassDeckMat);
  deckL.position.set(-68, 7.8, 36);
  scene.add(deckL);

  // Right highway deck span
  const deckR = box(82, 1.2, 8.8, overpassDeckMat);
  deckR.position.set(68, 7.8, 36);
  scene.add(deckR);

  // Guardrails along spans
  for (const side of [-4.2, 4.2]) {
    const railL = box(82, 0.75, 0.2, guardrailMat);
    railL.position.set(-68, 8.7, 36 + side);
    scene.add(railL);
    const railR = box(82, 0.75, 0.2, guardrailMat);
    railR.position.set(68, 8.7, 36 + side);
    scene.add(railR);
  }

  // Fractured / collapsed center overpass gap (x between -27 and 27)
  // Fallen concrete chunks on the street
  for (let i = 0; i < 5; i++) {
    const rbx = -18 + i * 9 + (rng() - 0.5) * 4;
    const rbz = 36 + (rng() - 0.5) * 6;
    const chunk = box(3.2 + rng() * 2, 1.2 + rng() * 0.8, 2.4 + rng() * 1.5, overpassDeckMat);
    chunk.position.set(rbx, 0.7, rbz);
    chunk.rotation.set((rng() - 0.5) * 0.4, rng() * Math.PI, (rng() - 0.5) * 0.4);
    scene.add(chunk);
    addCollider(rbx, rbz, 3.2, 2.4, 1.4);
  }

  // ---------- LANDMARK 3: Crashed Military APC (x: 0, z: 0) ----------
  const apc = buildApc(rng);
  apc.position.set(0, 0, 0);
  apc.rotation.y = 0.42;
  scene.add(apc);
  addCollider(0, 0, 3.6, 6.8, 2.6, { material: 'metal', penetrable: false });

  // ---------- street lamps ----------
  const lampLights = [];
  let lampCount = 0;
  for (const z of [-96, -68, -40, -14, 14, 40, 68, 96]) {
    for (const side of [-1, 1]) {
      const lamp = buildLamp(side * -1);
      lamp.position.set(side * (ROAD_HALF_X + 1.2), 0, z);
      scene.add(lamp);
      addCollider(lamp.position.x, z, 0.4, 0.4, 6.4, { material: 'metal', penetrable: false });
      if (lampCount < 6) {
        const light = new THREE.PointLight(0xffb068, 22, 26, 2);
        light.position.set(lamp.position.x + side * -1.3, 6.1, z);
        scene.add(light);
        lampLights.push(light);
      }
      lampCount++;
    }
  }
  for (const x of [-96, -48, 48, 96]) {
    for (const z of [-36, 0, 72]) {
      const lamp = buildLamp(1);
      lamp.position.set(x, 0, z + 7.5);
      lamp.rotation.y = Math.PI / 2;
      scene.add(lamp);
      addCollider(x, z + 7.5, 0.4, 0.4, 6.4, { material: 'metal', penetrable: false });
    }
  }

  // ---------- street vehicle wrecks ----------
  const carSpots = [
    [-4.8, 8, 0.1], [5.0, 18, -0.25], [-4.6, 44, 0.4], [4.6, -20, 3.0],
    [1.6, -46, 1.55], [-2.8, 62, 0.05], [-54, 32, 1.57], [54, -8, 1.6],
    [14, 26, 0.02], [-14, -26, 3.1], [62, 48, 0.1], [-62, -38, 1.5],
    [-78, 12, 0.8], [78, -50, 2.1], [-26, -88, 1.2], [26, 88, 0.3],
    [-48, -70, 0.0], [48, 70, 1.57], [-90, -90, 0.6], [90, 90, 2.4]
  ];
  for (const [x, z, rot] of carSpots) {
    const car = buildCar(rng);
    car.position.set(x, 0, z);
    car.rotation.y = rot;
    scene.add(car);
    const along = Math.abs(Math.sin(rot)) > 0.5;
    // Cars have thin sheet-metal panels & cabin glass that high-calibre rifles/LMGs can punch through
    addCollider(x, z, along ? 2.1 : 4.6, along ? 4.6 : 2.1, 1.6, { material: 'metal', penetrable: true, penCost: 0.62 });
  }

  // ---------- instanced props for high performance (60 FPS) ----------
  function makeInstanced(geo, mat, list, isCircle = false, colliderOpts = {}) {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    mesh.castShadow = !isCircle;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();

    list.forEach(([x, y, z, sx, sy, sz, ry, w, d, h], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry || 0);
      if (isCircle) {
        // Flat circle puddle on the ground
        const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        q.multiply(qx);
      }
      v.set(x, y, z);
      sc.set(sx, sy, sz);
      m.compose(v, q, sc);
      mesh.setMatrixAt(i, m);
      if (w && d && h) {
        addCollider(x, z, w, d, h, colliderOpts);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  // 1. Reflective Asphalt Puddles
  const puddleSpots = [];
  const pRng = makeRng(1337);
  for (let i = 0; i < 48; i++) {
    const sx = STREETS_X[Math.floor(pRng() * STREETS_X.length)] + (pRng() - 0.5) * 7.5;
    const sz = (pRng() * 2 - 1) * (CITY - 12);
    const rad = 1.0 + pRng() * 1.5;
    puddleSpots.push([sx, 0.022, sz, rad, rad, 1, pRng() * Math.PI, 0, 0, 0]);
  }
  makeInstanced(PROP_GEO.puddle, PROP_MAT.puddle, puddleSpots, true);

  // 2. Concrete Jersey Barriers
  const barrierSpots = [];
  for (const [x, z, r] of [
    [-7.6, -20, 0.1], [7.6, 38, -0.2], [-7.4, -66, 0], [7.4, 70, 0.3],
    [-32, 10, 1.57], [26, -32, 1.57], [72, -46, 0.4], [-76, 28, -0.3],
    [42, 74, 1.2], [-46, -78, 1.57], [92, 8, 0], [-92, -24, 0.2],
    [-18, 0, 0.5], [18, 0, -0.5], [0, -62, 1.57], [0, 62, 1.57]
  ]) {
    barrierSpots.push([x, 0.48, z, 1, 1, 1, r, 2.4, 0.5, 0.95]);
  }
  makeInstanced(PROP_GEO.barrier, PROP_MAT.barrier, barrierSpots);

  // 3. Sandbags (Relay Station fortification)
  const sandbagSpots = [];
  for (let a = -Math.PI * 0.75; a <= Math.PI * 0.75; a += 0.28) {
    const rx = Math.cos(a) * 9.2;
    const rz = -72 + Math.sin(a) * 9.2;
    sandbagSpots.push([rx, 0.16, rz, 1, 1, 1, a + Math.PI / 2, 0.8, 0.45, 0.32]);
    sandbagSpots.push([rx, 0.46, rz, 1, 1, 1, a + Math.PI / 2, 0.8, 0.45, 0.32]);
  }
  makeInstanced(PROP_GEO.sandbag, PROP_MAT.sandbag, sandbagSpots);

  // 4. Wooden Crates & Military Ammo Crates
  const crateSpots = [];
  const milCrateSpots = [];
  const propRng = makeRng(8812);
  for (let i = 0; i < 42; i++) {
    const onX = propRng() > 0.5;
    const street = onX ? STREETS_Z[Math.floor(propRng() * STREETS_Z.length)] : STREETS_X[Math.floor(propRng() * STREETS_X.length)];
    const along = (propRng() * 2 - 1) * (CITY - 10);
    const off = (propRng() - 0.5) * 3.5;
    const x = onX ? along : street + off;
    const z = onX ? street + off : along;
    if (Math.hypot(x, z) < 10) continue;

    const s = 0.8 + propRng() * 0.45;
    if (propRng() > 0.4) {
      crateSpots.push([x, s / 2, z, s, s, s, propRng() * Math.PI, s, s, s]);
    } else {
      milCrateSpots.push([x, 0.35 * s, z, s, s, s, propRng() * Math.PI, 1.3 * s, 0.85 * s, 0.65 * s]);
    }
  }
  makeInstanced(PROP_GEO.crate, PROP_MAT.crate, crateSpots, false, { material: 'wood', penetrable: true, penCost: 0.32 });
  makeInstanced(PROP_GEO.milCrate, PROP_MAT.milCrate, milCrateSpots, false, { material: 'metal', penetrable: false });

  // 5. Fuel & Biohazard Barrels
  const barrelSpots = [];
  const bioSpots = [];
  const barrels = [];
  for (let i = 0; i < 38; i++) {
    const onX = propRng() > 0.5;
    const street = onX ? STREETS_Z[Math.floor(propRng() * STREETS_Z.length)] : STREETS_X[Math.floor(propRng() * STREETS_X.length)];
    const along = (propRng() * 2 - 1) * (CITY - 10);
    const off = (propRng() - 0.5) * 3.2;
    const x = onX ? along : street + off;
    const z = onX ? street + off : along;
    if (Math.hypot(x, z) < 10) continue;

    const s = 0.85 + propRng() * 0.35;
    if (propRng() > 0.35) {
      barrelSpots.push([x, 0.55 * s, z, s, s, s, propRng() * Math.PI, 0.8 * s, 0.8 * s, 1.1 * s]);
      barrels.push({ id: `barrel_fuel_${i}`, type: 'fuel', pos: new THREE.Vector3(x, 0.55 * s, z), radius: 0.45 * s, hp: 25, active: true });
    } else {
      bioSpots.push([x, 0.58 * s, z, s, s, s, propRng() * Math.PI, 0.84 * s, 0.84 * s, 1.15 * s]);
      barrels.push({ id: `barrel_bio_${i}`, type: 'biohazard', pos: new THREE.Vector3(x, 0.58 * s, z), radius: 0.45 * s, hp: 25, active: true });
    }
  }
  makeInstanced(PROP_GEO.barrel, PROP_MAT.barrel, barrelSpots, false, { material: 'metal', penetrable: false });
  makeInstanced(PROP_GEO.biohazardBarrel, PROP_MAT.biohazardBarrel, bioSpots, false, { material: 'metal', penetrable: false });

  // 6. Dumpsters
  for (const [x, z] of [
    [-9.6, -32], [9.8, 14], [-9.8, 48], [9.6, -76], [-42, 22], [40, -54],
    [66, 42], [-72, -22], [82, -62], [-84, 46], [24, -94], [-30, 88],
    [-60, 80], [60, -90], [-100, 10], [100, -10]
  ]) {
    const d = buildDumpster(rng);
    d.position.set(x, CURB, z);
    d.rotation.y = rng() * 0.4;
    scene.add(d);
    addCollider(x, z, 2.4, 1.5, 1.5, { material: 'metal', penetrable: false });
  }

  // 7. Trees along sidewalks
  for (let i = 0; i < 56; i++) {
    const a = rng() * Math.PI * 2;
    const r = 28 + rng() * 105;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x) < 9 || Math.abs(z) < 9) continue;
    const tree = buildTree(rng);
    tree.position.set(x, CURB, z);
    scene.add(tree);
    addCollider(x, z, 0.9, 0.9, 4, { material: 'wood', penetrable: true, penCost: 0.42 });
  }

  // ---------- animated sewer steam vents ----------
  const steamVents = [
    [-24, 0.05, 12], [24, 0.05, -36], [-48, 0.05, -72], [48, 0.05, 72],
    [0, 0.05, 48], [-72, 0.05, 36], [72, 0.05, -12]
  ];
  const steamSprites = [];
  for (const [sx, sy, sz] of steamVents) {
    const manhole = new THREE.Mesh(PROP_GEO.manhole, PROP_MAT.manhole);
    manhole.position.set(sx, sy, sz);
    scene.add(manhole);

    const steam = glowSprite(0xa8bcc8, 1.8, 0.28);
    steam.position.set(sx, sy + 0.6, sz);
    scene.add(steam);
    steamSprites.push({ mesh: steam, baseY: sy + 0.6, phase: rng() * Math.PI * 2 });
  }

  // ---------- spawn ring & street avenue spawn points ----------
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 42 + (i % 3) * 12;
    spawnPoints.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  // Points along avenues
  for (const z of [-130, -108, -80, -44, 0, 44, 80, 108, 130]) {
    spawnPoints.push(new THREE.Vector3((rng() - 0.5) * 6, 0, z));
    spawnPoints.push(new THREE.Vector3((rng() - 0.5) * 6 - 96, 0, z * 0.7));
    spawnPoints.push(new THREE.Vector3((rng() - 0.5) * 6 + 96, 0, z * 0.7));
    spawnPoints.push(new THREE.Vector3((rng() - 0.5) * 6 - 48, 0, z));
    spawnPoints.push(new THREE.Vector3((rng() - 0.5) * 6 + 48, 0, z));
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

  // ---------- updaters ----------
  let t = 0;
  let blackout = false;
  updaters.push((dt) => {
    t += dt;
    // Relay beacon strobe
    beaconMat.emissiveIntensity = 2.4 + Math.sin(t * 2.6) * 1.6;
    beaconLight.intensity = 12 + Math.sin(t * 2.6) * 7;
    beaconGlow.material.opacity = 0.5 + Math.sin(t * 2.6) * 0.2;

    // Transmission rings rotation and emissive pulse
    pulseRings.forEach((ring, idx) => {
      ring.rotation.z += dt * (0.4 + idx * 0.2);
    });

    // Steam vents rising
    steamSprites.forEach((s) => {
      s.mesh.position.y = s.baseY + Math.sin(t * 1.8 + s.phase) * 0.25;
      s.mesh.material.opacity = 0.22 + Math.sin(t * 2.2 + s.phase) * 0.1;
    });
  });

  return {
    colliders,
    barrels,
    spawnPoints,
    addDecal,
    moon,
    bounds: CITY - 3,
    navExtent: CITY + 6,
    navRadius: CITY - 1,
    update(dt) { for (const fn of updaters) fn(dt); },
    get blackout() { return blackout; },
    setBlackout(on) {
      blackout = !!on;
      hemi.intensity = on ? 0.4 : 1.8;
      ambient.intensity = on ? 0.22 : 1.1;
      if (scene.fog) scene.fog.density = on ? 0.044 : 0.016;
      moon.intensity = on ? 1.1 : 2.5;
    },
    setShadowFocus(x, z) {
      moon.position.set(x - 36, 56, z + 28);
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
