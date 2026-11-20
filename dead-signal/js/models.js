// Sculpted procedural models for Dead Signal.
//
// No model files ship with the game, so every shape here is built from
// capsules, lathes and jittered shells with canvas-painted skin and cloth.
// Geometry and materials are cached per type: forty zombies share the same
// buffers, which is what keeps the horde cheap to draw.
import * as THREE from 'three';

// ---------------------------------------------------------------- textures

function canvasTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

const texCache = new Map();
function cached(key, make) {
  if (!texCache.has(key)) texCache.set(key, make());
  return texCache.get(key);
}

// Necrotic skin: bruised base, veins, and dark open wounds.
export function skinTexture(hex) {
  return cached(`skin${hex}`, () => canvasTexture(256, (ctx, s) => {
    const c = new THREE.Color(hex);
    ctx.fillStyle = `rgb(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0})`;
    ctx.fillRect(0, 0, s, s);

    for (let i = 0; i < 900; i++) {
      const a = 0.04 + Math.random() * 0.12;
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(30,18,16,${a})` : `rgba(190,190,160,${a * 0.7})`;
      const w = 2 + Math.random() * 9;
      ctx.beginPath();
      ctx.ellipse(Math.random() * s, Math.random() * s, w, w * (0.5 + Math.random()), Math.random() * 3, 0, 6.3);
      ctx.fill();
    }
    // Veins.
    for (let v = 0; v < 26; v++) {
      ctx.strokeStyle = `rgba(46,20,40,${0.18 + Math.random() * 0.25})`;
      ctx.lineWidth = 0.6 + Math.random();
      ctx.beginPath();
      let x = Math.random() * s;
      let y = Math.random() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (Math.random() - 0.5) * 34;
        y += (Math.random() - 0.5) * 34;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Wounds.
    for (let w = 0; w < 7; w++) {
      ctx.fillStyle = `rgba(58,8,10,${0.55 + Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * s, Math.random() * s, 3 + Math.random() * 9, 2 + Math.random() * 6, Math.random() * 3, 0, 6.3);
      ctx.fill();
    }
  }));
}

// Torn fabric: weave plus stains and holes.
export function clothTexture(hex) {
  return cached(`cloth${hex}`, () => canvasTexture(128, (ctx, s) => {
    const c = new THREE.Color(hex);
    ctx.fillStyle = `rgb(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0})`;
    ctx.fillRect(0, 0, s, s);
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = i % 2 ? '#000' : '#fff';
      ctx.fillRect(Math.random() * s, Math.random() * s, 1, 1 + Math.random() * 3);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(28,14,10,${0.25 + Math.random() * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * s, Math.random() * s, 3 + Math.random() * 12, 2 + Math.random() * 9, Math.random() * 3, 0, 6.3);
      ctx.fill();
    }
  }));
}

// Soft radial falloff, used for every additive glow in the game.
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return cached(`radial${inner}${outer}`, () => canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.35)'));
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }));
}

// ---------------------------------------------------------------- effects

const glowMats = new Map();
/** Additive camera-facing halo: the cheap stand-in for a bloom pass. */
export function glowSprite(color, size, opacity = 0.85) {
  const key = `${color}|${opacity}`;
  if (!glowMats.has(key)) {
    glowMats.set(key, new THREE.SpriteMaterial({
      map: radialTexture(),
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
  }
  const sprite = new THREE.Sprite(glowMats.get(key));
  sprite.scale.setScalar(size);
  return sprite;
}

const coneMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  uniforms: {
    uColor: { value: new THREE.Color(0xffb066) },
    uIntensity: { value: 0.16 },
  },
  vertexShader: /* glsl */`
    varying float vH;
    varying vec3 vNormalW;
    varying vec3 vViewW;
    void main() {
      vH = clamp(position.y / 6.4 + 0.5, 0.0, 1.0);
      vec4 world = modelMatrix * vec4(position, 1.0);
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vViewW = normalize(cameraPosition - world.xyz);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uColor;
    uniform float uIntensity;
    varying float vH;
    varying vec3 vNormalW;
    varying vec3 vViewW;
    void main() {
      // Edge-on faces are dimmest, which reads as light scattering in dust.
      float facing = pow(abs(dot(normalize(vNormalW), vViewW)), 1.6);
      float fall = pow(vH, 1.5) * 0.85 + 0.15;
      gl_FragColor = vec4(uColor, uIntensity * facing * fall);
    }
  `,
});

/** Faked volumetric shaft under a street lamp. */
const coneGeoCache = new Map();
function coneGeometry(radius, height) {
  const key = `${radius}|${height}`;
  if (!coneGeoCache.has(key)) {
    const geo = new THREE.ConeGeometry(radius, height, 18, 1, true);
    geo.translate(0, -height / 2, 0);
    coneGeoCache.set(key, geo);
  }
  return coneGeoCache.get(key);
}

export function lightCone(color = 0xffb066, radius = 3.2, height = 6.4, intensity = 0.16) {
  const geo = coneGeometry(radius, height);
  const mat = coneMat.clone();
  mat.uniforms = { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity } };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 4;
  return mesh;
}

// ---------------------------------------------------------------- zombies

const bodyCache = new Map();

function jitterHem(geometry, amount) {
  const pos = geometry.attributes.position;
  let minY = Infinity;
  for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) <= minY + 0.02) {
      pos.setY(i, minY + (Math.random() - 0.35) * amount);
    }
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function sharedBody(typeKey, def) {
  if (bodyCache.has(typeKey)) return bodyCache.get(typeKey);
  const thin = typeKey === 'runner';
  const heavy = typeKey === 'brute';

  const geo = {
    head: new THREE.SphereGeometry(0.145, 14, 12).scale(1, 1.16, 1.02),
    skull: new THREE.SphereGeometry(0.145, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    brow: new THREE.BoxGeometry(0.24, 0.045, 0.1),
    nose: new THREE.ConeGeometry(0.035, 0.09, 6).rotateX(Math.PI / 2),
    jaw: new THREE.CapsuleGeometry(0.075, 0.07, 3, 8).scale(1.25, 1, 1),
    socket: new THREE.SphereGeometry(0.045, 8, 6),
    eye: new THREE.SphereGeometry(0.022, 8, 6),
    neck: new THREE.CapsuleGeometry(0.055, 0.06, 3, 8),
    chest: new THREE.CapsuleGeometry(thin ? 0.145 : heavy ? 0.235 : 0.175, 0.18, 5, 12),
    belly: new THREE.CapsuleGeometry(thin ? 0.125 : heavy ? 0.22 : 0.155, 0.16, 4, 12),
    shoulder: new THREE.SphereGeometry(thin ? 0.075 : heavy ? 0.125 : 0.093, 10, 8),
    upperArm: new THREE.CapsuleGeometry(thin ? 0.048 : heavy ? 0.082 : 0.06, thin ? 0.24 : 0.20, 3, 8),
    foreArm: new THREE.CapsuleGeometry(thin ? 0.042 : heavy ? 0.072 : 0.052, thin ? 0.22 : 0.18, 3, 8),
    hand: new THREE.CapsuleGeometry(0.045, 0.07, 3, 7),
    thigh: new THREE.CapsuleGeometry(thin ? 0.062 : heavy ? 0.105 : 0.077, thin ? 0.26 : 0.21, 3, 8),
    shin: new THREE.CapsuleGeometry(thin ? 0.05 : heavy ? 0.09 : 0.062, thin ? 0.25 : 0.21, 3, 8),
    foot: new THREE.BoxGeometry(0.12, 0.075, 0.26).translate(0, 0, 0.05),
    // Ragged shirt shell: open-ended so the tear reads at the hem.
    shirt: jitterHem(new THREE.CylinderGeometry(
      thin ? 0.16 : heavy ? 0.26 : 0.195,
      thin ? 0.19 : heavy ? 0.3 : 0.225,
      heavy ? 0.52 : 0.46, 14, 3, true), heavy ? 0.16 : 0.11),
    hip: new THREE.CapsuleGeometry(thin ? 0.12 : heavy ? 0.2 : 0.15, 0.08, 3, 10),
    plate: new THREE.BoxGeometry(0.46, 0.34, 0.1),
    // Close-up detail (registered in `detail`, dropped past 40 m).
    rib: new THREE.CapsuleGeometry(0.011, 0.115, 3, 6),
    finger: new THREE.CapsuleGeometry(0.0075, 0.028, 3, 6),
    hair: new THREE.SphereGeometry(0.032, 6, 5),
    tongue: new THREE.CapsuleGeometry(0.017, 0.045, 3, 6),
    strip: new THREE.BoxGeometry(0.04, 0.11, 0.012),
    bandage: new THREE.BoxGeometry(0.2, 0.05, 0.024),
    stain: new THREE.SphereGeometry(0.07, 8, 6),
    tooth: new THREE.BoxGeometry(0.026, 0.038, 0.02),
    sac: new THREE.SphereGeometry(0.145, 14, 10),
  };
  bodyCache.set(typeKey, geo);
  return geo;
}

function part(geo, material, x, y, z, opts = {}) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  if (opts.castShadow) mesh.castShadow = true;
  if (opts.rotate) mesh.rotation.set(opts.rotate[0], opts.rotate[1], opts.rotate[2]);
  return mesh;
}

/**
 * Builds a zombie. The skeleton joint layout is fixed (hips / neck / shoulders /
 * elbows / hips / knees at the same offsets as the original rig) so the
 * animation and hit-detection code keeps working unchanged.
 */
const plateMat = new THREE.MeshStandardMaterial({ color: 0x3a3d38, roughness: 0.7, metalness: 0.35 });

const matCache = new Map();
function matsFor(typeKey, def) {
  if (matCache.has(typeKey)) return matCache.get(typeKey);
  const set = {
    skin: new THREE.MeshStandardMaterial({
      color: def.skin,
      map: skinTexture(def.skin),
      roughness: 0.86,
      metalness: 0.02,
    }),
    cloth: new THREE.MeshStandardMaterial({
      color: def.shirt,
      map: clothTexture(def.shirt),
      roughness: 0.95,
      side: THREE.DoubleSide,
    }),
    pants: new THREE.MeshStandardMaterial({
      color: def.pants,
      map: clothTexture(def.pants),
      roughness: 0.97,
    }),
    eye: new THREE.MeshStandardMaterial({
      color: def.eye,
      emissive: def.eye,
      emissiveIntensity: 4.2,
      roughness: 0.3,
      toneMapped: false,
    }),
    bone: new THREE.MeshStandardMaterial({ color: 0xd8d2b4, roughness: 0.75 }),
    socket: new THREE.MeshStandardMaterial({ color: 0x140c0a, roughness: 1 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x16120f, roughness: 1 }),
    bandage: new THREE.MeshStandardMaterial({
      color: 0xa8a08a, map: clothTexture(0xa8a08a), roughness: 1, side: THREE.DoubleSide,
    }),
    blood: new THREE.MeshStandardMaterial({ color: 0x3f090b, roughness: 0.55 }),
    tongue: new THREE.MeshStandardMaterial({ color: 0x6b2b30, roughness: 0.45 }),
    acid: new THREE.MeshStandardMaterial({
      color: 0x9dff3d, emissive: 0x63ff14, emissiveIntensity: 2.4,
      roughness: 0.35, transparent: true, opacity: 0.92, toneMapped: false,
    }),
  };
  matCache.set(typeKey, set);
  return set;
}

export function buildZombieModel(typeKey, def) {
  const g = sharedBody(typeKey, def);
  const heavy = typeKey === 'brute';
  const thin = typeKey === 'runner';
  const spitter = typeKey === 'spitter';
  const M = matsFor(typeKey, def);
  const skinMat = M.skin;
  const clothMat = M.cloth;
  const pantsMat = M.pants;
  const eyeMat = M.eye;
  const boneMat = M.bone;

  const group = new THREE.Group();
  group.scale.setScalar(def.scale);

  const hips = new THREE.Group();
  hips.position.y = 0.9;
  group.add(hips);

  const pelvis = part(g.hip, pantsMat, 0, 0.02, 0);
  hips.add(pelvis);

  // Belly + chest: two overlapping shells give the torso a ribcage taper.
  const belly = part(g.belly, clothMat, 0, 0.24, 0.005, { castShadow: true });
  hips.add(belly);
  const chest = part(g.chest, clothMat, 0, 0.47, 0.01, { castShadow: true });
  chest.rotation.x = 0.08;
  hips.add(chest);

  const shirt = part(g.shirt, clothMat, 0, 0.34, 0);
  hips.add(shirt);

  if (heavy) {
    // One shared plate material: a fresh MeshStandardMaterial per brute leaked
    // a material every time a heavy spawned during a long run.
    const plate = part(g.plate, plateMat, 0, 0.52, 0.13);
    plate.rotation.x = 0.1;
    hips.add(plate);
    const strap = part(g.bandage, M.bandage, 0, 0.52, 0.19);
    strap.rotation.z = 0.24;
    hips.add(strap);
  }

  // ---- close-up detail ------------------------------------------------
  // Everything built below is registered in `detail`, so it is dropped past
  // 40 m and a forty-body wave stays cheap to draw.
  const detail = [];

  // Torn hem: a ring of loose cloth strips. They catch the light as a body
  // turns, which is most of what sells a ripped shirt at a glance.
  const hemR = heavy ? 0.27 : thin ? 0.19 : 0.22;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    const len = 0.6 + ((i * 37) % 11) / 18;
    const strip = part(g.strip, clothMat, Math.cos(a) * hemR, 0.12 - len * 0.055, Math.sin(a) * hemR);
    strip.rotation.set(Math.sin(a) * 0.32, a, Math.cos(a) * 0.34);
    strip.scale.y = len;
    hips.add(strip);
    detail.push(strip);
  }

  // Ribs showing through the tear on one flank.
  for (let i = 0; i < 4; i++) {
    const rib = part(g.rib, boneMat, heavy ? 0.245 : 0.175, 0.33 + i * 0.052, 0.03);
    rib.rotation.z = Math.PI / 2;
    rib.rotation.y = -0.24;
    rib.scale.setScalar(1 - i * 0.09);
    hips.add(rib);
    detail.push(rib);
  }

  // Bloodied field dressing across the chest, and the dark soak under it.
  const wrap = part(g.bandage, M.bandage, -0.01, 0.5, 0.15);
  wrap.rotation.z = 0.55;
  hips.add(wrap);
  const stain = part(g.stain, M.blood, -0.025, 0.52, 0.155);
  stain.scale.set(1.5, 0.72, 0.32);
  hips.add(stain);
  detail.push(wrap, stain);

  // Neck + head.
  const neck = new THREE.Group();
  neck.position.set(0, 0.63, 0);
  hips.add(neck);
  neck.add(part(g.neck, skinMat, 0, 0.03, 0));

  const head = part(g.head, skinMat, 0, 0.18, 0.01, { castShadow: true });
  neck.add(head);
  const brow = part(g.brow, skinMat, 0, 0.235, 0.115);
  neck.add(brow);
  const nose = part(g.nose, skinMat, 0, 0.175, 0.145);
  neck.add(nose);

  // Sunken sockets + burning pupils.
  const socketL = part(g.socket, M.socket, -0.062, 0.205, 0.112);
  const socketR = socketL.clone();
  socketR.position.x = 0.062;
  neck.add(socketL, socketR);
  neck.add(part(g.eye, eyeMat, -0.062, 0.205, 0.128));
  neck.add(part(g.eye, eyeMat, 0.062, 0.205, 0.128));

  const jaw = part(g.jaw, skinMat, 0, 0.055, 0.055);
  jaw.rotation.x = 0.2;
  neck.add(jaw);
  // Teeth, top and bottom rows, unevenly spaced so the grin reads as broken.
  for (let i = -2; i <= 2; i++) {
    const tooth = part(g.tooth, boneMat, i * 0.038, 0.098, 0.118);
    tooth.rotation.z = i * 0.09;
    neck.add(tooth);
    const lower = part(g.tooth, boneMat, i * 0.034, 0.062, 0.112);
    lower.rotation.z = i * -0.12;
    lower.scale.setScalar(0.8);
    neck.add(lower);
  }
  const tongue = part(g.tongue, M.tongue, 0, 0.088, 0.108);
  tongue.rotation.x = 1.15;
  jaw.add(tongue);
  detail.push(tongue);

  // Matted hair on the crown: a cheap, unmistakable silhouette change.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const tuft = part(g.hair, M.hair, Math.cos(a) * 0.086, 0.285 + (i % 3) * 0.014, Math.sin(a) * 0.086);
    tuft.scale.set(1, 0.65 + (i % 4) * 0.22, 1);
    neck.add(tuft);
    detail.push(tuft);
  }

  if (spitter) {
    // Swollen acid sac: the one thing you need to read from across the street.
    const sac = part(g.sac, M.acid, 0, 0.34, -0.15);
    sac.scale.set(1.05, 0.92, 0.8);
    hips.add(sac);
    const sacGlow = glowSprite(0x9dff3d, 0.85, 0.5);
    sacGlow.position.set(0, 0.36, -0.22);
    hips.add(sacGlow);
    const drool = part(g.tongue, M.acid, 0, 0.045, 0.125);
    drool.scale.set(0.8, 1.5, 0.8);
    jaw.add(drool);
    detail.push(sac, drool);
  }

  // Arms: shoulder -> elbow -> hand.
  const arm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.28, 0.56, 0);
    hips.add(shoulder);
    shoulder.add(part(g.shoulder, clothMat, 0, 0, 0));
    const upper = part(g.upperArm, skinMat, 0, -0.2, 0, { castShadow: true });
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.4, 0);
    shoulder.add(elbow);
    const fore = part(g.foreArm, skinMat, 0, -0.18, 0);
    elbow.add(fore);
    const hand = part(g.hand, skinMat, 0, -0.39, 0.015);
    elbow.add(hand);
    // Fingers and a thumb, parented to the hand so the distance LOD drops
    // them together with it.
    for (let f = 0; f < 4; f++) {
      const finger = part(g.finger, skinMat, -0.021 + f * 0.014, -0.046, 0.014);
      finger.rotation.x = 0.4;
      hand.add(finger);
    }
    const thumb = part(g.finger, skinMat, 0.03, -0.014, 0.004);
    thumb.rotation.z = -0.85;
    hand.add(thumb);
    return { shoulder, elbow, hand, upper, fore };
  };
  const armL = arm(-1);
  const armR = arm(1);

  // Legs: hip -> knee -> foot.
  const leg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.14, 0.02, 0);
    hips.add(hip);
    const thigh = part(g.thigh, pantsMat, 0, -0.23, 0, { castShadow: true });
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.45, 0);
    hip.add(knee);
    const shin = part(g.shin, pantsMat, 0, -0.22, 0);
    knee.add(shin);
    knee.add(part(g.foot, skinMat, 0, -0.45, 0));
    return { hip, knee, thigh, shin };
  };
  const legL = leg(-1);
  const legR = leg(1);

  // Headshot plus two body volumes, exactly as the original rig exposed them.
  head.userData.part = 'head';
  chest.userData.part = 'body';
  belly.userData.part = 'body';
  shirt.userData.part = 'body';
  // Limbs and the loose shirt were not hit volumes, so a round that hit an arm
  // or a leg passed through the zombie and struck the wall behind it.
  const limbHits = [
    shirt,
    armL.upper, armL.fore, armR.upper, armR.fore,
    legL.thigh, legL.shin, legR.thigh, legR.shin,
  ];
  for (const limb of limbHits) limb.userData.part = 'body';

  // Small facial and hand detail is skipped with distance: at forty bodies it
  // is the difference between a few hundred draw calls and a thousand.
  return {
    group,
    rig: { hips, torso: belly, neck, head, jaw, armL, armR, legL, legR },
    hitMeshes: [head, chest, belly, ...limbHits],
    detail: [brow, nose, jaw, socketL, socketR, ...detail, armL.hand, armR.hand],
  };
}

// ---------------------------------------------------------------- props

const propCache = new Map();

function propMat(key, make) {
  if (!propCache.has(key)) propCache.set(key, make());
  return propCache.get(key);
}

/** Beat-up sedan, long axis on X. */
export function buildCar(rng, colors = [0x4a2b2b, 0x2c3a44, 0x3b3b30, 0x40323f]) {
  const color = colors[Math.floor(rng() * colors.length)];
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a1218, roughness: 0.18, metalness: 0.65 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.95 });

  const lower = new THREE.Mesh(new THREE.BoxGeometry(4.25, 0.6, 1.86), paint);
  lower.position.y = 0.62;
  lower.castShadow = true;
  g.add(lower);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 1.8), paint);
  hood.position.set(1.45, 0.99, 0);
  g.add(hood);

  const boot = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.2, 1.8), paint);
  boot.position.set(-1.65, 0.98, 0);
  g.add(boot);

  // Tapered cabin: a scaled capsule reads far better than a box.
  const cabin = new THREE.Mesh(new THREE.CapsuleGeometry(0.86, 1.05, 4, 12), glass);
  cabin.scale.set(1, 0.62, 0.98);
  cabin.position.set(-0.15, 1.24, 0);
  cabin.castShadow = true;
  g.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.26, 14);
  for (const [wx, wz] of [[-1.4, 0.92], [1.4, 0.92], [-1.4, -0.92], [1.4, -0.92]]) {
    const wheel = new THREE.Mesh(wheelGeo, rubber);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    wheel.castShadow = true;
    g.add(wheel);
  }

  const headlightMat = propMat('headlight', () => new THREE.MeshStandardMaterial({
    color: 0xfff3d0, emissive: 0xffd9a0, emissiveIntensity: 0.6, roughness: 0.3,
  }));
  for (const wz of [-0.62, 0.62]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.34), headlightMat);
    lamp.position.set(2.12, 0.86, wz);
    g.add(lamp);
  }

  return g;
}

/** Street lamp: pole, arm, lit head, halo and a faked light shaft. */
export function buildLamp(sideSign = 1) {
  const g = new THREE.Group();
  const metal = propMat('lampMetal', () => new THREE.MeshStandardMaterial({
    color: 0x232a2e, roughness: 0.72, metalness: 0.55,
  }));

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.4, 10), metal);
  pole.position.y = 3.2;
  pole.castShadow = true;
  g.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), metal);
  arm.position.set(sideSign * 0.65, 6.3, 0);
  g.add(arm);

  const headMat = propMat('lampHead', () => new THREE.MeshStandardMaterial({
    color: 0xfff0cf, emissive: 0xffc98a, emissiveIntensity: 3.4, roughness: 0.4, toneMapped: false,
  }));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), headMat);
  head.position.set(sideSign * 1.3, 6.15, 0);
  g.add(head);

  const halo = glowSprite(0xffc07a, 2.6, 0.7);
  halo.position.copy(head.position);
  g.add(halo);

  const shaft = lightCone(0xffb066, 2.9, 6.2, 0.13);
  shaft.position.copy(head.position);
  g.add(shaft);

  g.userData.bulb = head.position.clone();
  return g;
}

/** Skip / dumpster with a lid that is always half open. */
export function buildDumpster(rng) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x2c3a33, roughness: 0.85, metalness: 0.35 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.35, 1.35), body);
  box.position.y = 0.7;
  box.castShadow = true;
  box.receiveShadow = true;
  g.add(box);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.08, 1.4), body);
  lid.position.set(0, 1.4, -0.2);
  lid.rotation.x = -0.45 - rng() * 0.3;
  g.add(lid);

  for (const wz of [-0.55, 0.55]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x111314, roughness: 0.9 }));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0.9, 0.14, wz);
    g.add(wheel);
  }
  return g;
}

/** Police barricade. */
export function buildBarrier(rng) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a7448, roughness: 0.95 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.9 });

  const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.34, 0.07), wood);
  plank.position.y = 0.95;
  plank.castShadow = true;
  g.add(plank);

  for (const sx of [-0.7, 0.7]) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.08), stripe);
    mark.position.set(sx, 0.95, 0.01);
    mark.rotation.z = 0.6;
    g.add(mark);
  }

  for (const sx of [-1, 1]) {
    const legA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.07), wood);
    legA.position.set(sx, 0.6, 0.24);
    legA.rotation.x = 0.28;
    g.add(legA);
    const legB = legA.clone();
    legB.position.z = -0.24;
    legB.rotation.x = -0.28;
    g.add(legB);
  }
  g.rotation.y = (rng() - 0.5) * 0.6;
  return g;
}

/** Dead tree with a couple of bare forks. */
export function buildTree(rng) {
  const g = new THREE.Group();
  const bark = propMat('bark', () => new THREE.MeshStandardMaterial({ color: 0x2b221a, roughness: 1 }));
  const h = 4.2 + rng() * 3.4;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.3, h, 7), bark);
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  g.add(trunk);

  const branches = 2 + Math.floor(rng() * 3);
  for (let b = 0; b < branches; b++) {
    const bl = 1.4 + rng() * 1.8;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.1, bl, 5), bark);
    branch.position.set(0, h * (0.55 + rng() * 0.4), 0);
    branch.rotation.z = (rng() - 0.5) * 1.5;
    branch.rotation.x = (rng() - 0.5) * 1.5;
    branch.translateY(bl / 2);
    g.add(branch);
  }
  g.rotation.y = rng() * Math.PI;
  return g;
}

// ---------------------------------------------------------------- weapons

const gunMats = {
  steel: new THREE.MeshStandardMaterial({ color: 0x4c5359, roughness: 0.4, metalness: 0.62 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x24292d, roughness: 0.62, metalness: 0.42 }),
  polymer: new THREE.MeshStandardMaterial({ color: 0x1d2320, roughness: 0.88, metalness: 0.05 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x2b2c26, roughness: 0.95, metalness: 0.02 }),
  glow: new THREE.MeshStandardMaterial({ color: 0xb6ff74, emissive: 0x86f02a, emissiveIntensity: 1.4, roughness: 0.4, toneMapped: false }),
};

function bx(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function cyl(r1, r2, h, mat, x, y, z, rx = 0, ry = 0, rz = 0, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

// A gloved hand: palm mass, four wrapped fingers and a thumb. It is the single
// biggest thing that sells a first-person weapon.
function glovedHand(g, gripY, gripZ, side = 1, tilt = 0) {
  const M = gunMats;
  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.052, 4, 10), M.glove);
  palm.position.set(side * 0.028, gripY + 0.008, gripZ + 0.006);
  palm.rotation.set(0.12 + tilt, 0, side * 0.14);
  g.add(palm);

  for (let f = 0; f < 4; f++) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.026, 3, 7), M.glove);
    finger.position.set(side * 0.02, gripY + 0.026 - f * 0.022, gripZ - 0.026);
    finger.rotation.set(0.35, 0, side * 0.5);
    g.add(finger);
    const knuckle = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.022, 3, 7), M.glove);
    knuckle.position.set(side * 0.006, gripY + 0.024 - f * 0.022, gripZ - 0.036);
    knuckle.rotation.set(0.5, 0, side * 1.15);
    g.add(knuckle);
  }

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.05, 3, 8), M.glove);
  thumb.position.set(side * 0.03, gripY + 0.05, gripZ - 0.008);
  thumb.rotation.set(-0.5, 0, side * 0.35);
  g.add(thumb);

  // Sleeve cuff, so the arm does not end in mid air.
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.12, 10), M.polymer);
  cuff.position.set(side * 0.055, gripY - 0.055, gripZ + 0.075);
  cuff.rotation.set(0.5, 0, side * 0.22);
  g.add(cuff);
}

function buildPistol() {
  const M = gunMats;
  const g = new THREE.Group();

  // Slide, with a bevelled top and a separate barrel hood.
  g.add(bx(0.034, 0.038, 0.198, M.steel, 0, 0.012, -0.07));
  g.add(bx(0.026, 0.012, 0.196, M.dark, 0, 0.033, -0.07));
  g.add(bx(0.03, 0.014, 0.05, M.steel, 0, 0.03, -0.155));

  // Cocking serrations.
  for (let i = 0; i < 6; i++) {
    g.add(bx(0.0355, 0.022, 0.003, M.dark, 0, 0.012, 0.004 - i * 0.008));
  }

  // Muzzle, bore and front sight.
  g.add(cyl(0.0105, 0.0105, 0.014, M.dark, 0, 0.012, -0.174, Math.PI / 2));
  g.add(cyl(0.0075, 0.0075, 0.006, new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 1 }), 0, 0.012, -0.178, Math.PI / 2));
  g.add(bx(0.007, 0.011, 0.007, M.dark, 0, 0.043, -0.155));
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 8, 6), M.glow);
  dot.position.set(0, 0.048, -0.155);
  g.add(dot);

  // Rear sight notch.
  g.add(bx(0.008, 0.01, 0.008, M.dark, -0.011, 0.043, 0.012));
  g.add(bx(0.008, 0.01, 0.008, M.dark, 0.011, 0.043, 0.012));

  // Frame, trigger guard, trigger, hammer.
  g.add(bx(0.03, 0.026, 0.12, M.dark, 0, -0.014, -0.03));
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0045, 6, 14, Math.PI * 1.25), M.dark);
  guard.position.set(0, -0.04, -0.03);
  guard.rotation.set(Math.PI / 2, 0, Math.PI * 0.9);
  g.add(guard);
  g.add(bx(0.007, 0.022, 0.006, M.steel, 0, -0.04, -0.028, 0.18));
  g.add(bx(0.011, 0.017, 0.012, M.steel, 0, 0.02, 0.045, -0.35));

  // Grip: raked back, with side panels and a magwell base.
  g.add(bx(0.031, 0.1, 0.042, M.polymer, 0, -0.078, 0.032, -0.17));
  g.add(bx(0.033, 0.092, 0.03, M.polymer, 0, -0.08, 0.03, -0.17));
  g.add(bx(0.036, 0.012, 0.05, M.dark, 0, -0.128, 0.045, -0.17));

  glovedHand(g, -0.08, 0.03, 1, 0);

  g.userData.muzzle = new THREE.Vector3(0, 0.012, -0.2);
  return g;
}

function buildSmg() {
  const M = gunMats;
  const g = new THREE.Group();

  // Receiver with a tapered top cover.
  g.add(bx(0.052, 0.075, 0.3, M.steel, 0, 0.005, -0.08));
  g.add(bx(0.044, 0.026, 0.3, M.dark, 0, 0.05, -0.08));
  g.add(bx(0.05, 0.03, 0.1, M.polymer, 0, -0.03, 0.04));

  // Barrel shroud with vent slots.
  g.add(cyl(0.019, 0.019, 0.16, M.steel, 0, 0.012, -0.28, Math.PI / 2, 0, 0, 14));
  for (let i = 0; i < 5; i++) {
    g.add(bx(0.042, 0.008, 0.016, M.dark, 0, 0.012, -0.24 - i * 0.026));
  }
  g.add(cyl(0.008, 0.008, 0.02, new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 1 }), 0, 0.012, -0.36, Math.PI / 2));

  // Red-dot optic.
  g.add(bx(0.03, 0.03, 0.07, M.dark, 0, 0.078, -0.1));
  g.add(bx(0.026, 0.026, 0.006, M.steel, 0, 0.08, -0.135));
  const reticle = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff5533, emissive: 0xff2a12, emissiveIntensity: 2.2, toneMapped: false }));
  reticle.position.set(0, 0.08, -0.128);
  g.add(reticle);

  // Magazine, forward grip, stock.
  g.add(bx(0.036, 0.16, 0.054, M.polymer, 0, -0.11, -0.06));
  g.add(bx(0.026, 0.1, 0.03, M.polymer, 0, -0.07, -0.22, 0.25));
  g.add(bx(0.03, 0.05, 0.14, M.polymer, 0, 0.0, 0.16));
  g.add(bx(0.036, 0.062, 0.05, M.polymer, 0, -0.028, 0.06, -0.15));

  glovedHand(g, -0.03, 0.055, 1, 0);

  g.userData.muzzle = new THREE.Vector3(0, 0.012, -0.37);
  return g;
}

function buildShotgun() {
  const M = gunMats;
  const g = new THREE.Group();

  // Receiver and long barrel.
  g.add(bx(0.06, 0.085, 0.26, M.dark, 0, 0.005, -0.06));
  g.add(cyl(0.017, 0.017, 0.5, M.steel, 0, 0.026, -0.42, Math.PI / 2, 0, 0, 14));
  g.add(cyl(0.022, 0.022, 0.3, M.dark, 0, -0.006, -0.32, Math.PI / 2, 0, 0, 12));

  // Pump with grooves.
  g.add(bx(0.062, 0.06, 0.14, M.polymer, 0, -0.01, -0.28));
  for (let i = 0; i < 4; i++) {
    g.add(bx(0.064, 0.05, 0.006, M.dark, 0, -0.01, -0.235 - i * 0.022));
  }

  // Bead sight and shell tube cap.
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 6), M.glow);
  bead.position.set(0, 0.045, -0.62);
  g.add(bead);
  g.add(cyl(0.02, 0.02, 0.02, M.steel, 0, 0.026, -0.665, Math.PI / 2));

  // Stock and grip.
  g.add(bx(0.048, 0.09, 0.2, M.polymer, 0, -0.005, 0.16, 0.06));
  g.add(bx(0.05, 0.12, 0.03, M.polymer, 0, -0.02, 0.26, 0.06));
  g.add(bx(0.038, 0.07, 0.05, M.polymer, 0, -0.05, 0.03, -0.2));
  g.add(bx(0.05, 0.05, 0.12, M.dark, 0, -0.05, -0.14));

  glovedHand(g, -0.05, 0.04, 1, 0);

  g.userData.muzzle = new THREE.Vector3(0, 0.026, -0.68);
  return g;
}

function buildRifle() {
  const M = gunMats;
  const g = new THREE.Group();

  // Receiver with a flat top rail.
  g.add(bx(0.05, 0.072, 0.36, M.steel, 0, 0.006, -0.1));
  g.add(bx(0.044, 0.016, 0.36, M.dark, 0, 0.049, -0.1));
  for (let i = 0; i < 7; i++) {
    g.add(bx(0.046, 0.008, 0.004, M.steel, 0, 0.057, -0.24 + i * 0.026));
  }

  // Barrel, muzzle brake and handguard venting.
  g.add(cyl(0.0125, 0.0125, 0.42, M.steel, 0, 0.012, -0.48, Math.PI / 2, 0, 0, 14));
  g.add(cyl(0.026, 0.024, 0.2, M.polymer, 0, 0.012, -0.36, Math.PI / 2, 0, 0, 12));
  for (let i = 0; i < 5; i++) {
    g.add(cyl(0.0275, 0.0275, 0.008, M.dark, 0, 0.012, -0.29 - i * 0.036, Math.PI / 2, 0, 0, 12));
  }
  g.add(cyl(0.021, 0.019, 0.07, M.dark, 0, 0.012, -0.71, Math.PI / 2, 0, 0, 12));
  g.add(cyl(0.008, 0.008, 0.012, new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 1 }), 0, 0.012, -0.748, Math.PI / 2));

  // Scope: tube, both bells, mounts, glowing glass.
  g.add(bx(0.022, 0.026, 0.05, M.dark, 0, 0.082, -0.16));
  g.add(bx(0.022, 0.026, 0.05, M.dark, 0, 0.082, -0.05));
  g.add(cyl(0.021, 0.021, 0.19, M.dark, 0, 0.104, -0.105, Math.PI / 2, 0, 0, 14));
  g.add(cyl(0.029, 0.023, 0.05, M.steel, 0, 0.104, -0.215, Math.PI / 2, 0, 0, 14));
  g.add(cyl(0.026, 0.023, 0.04, M.steel, 0, 0.104, 0.005, Math.PI / 2, 0, 0, 14));
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.025, 16), new THREE.MeshStandardMaterial({
    color: 0x1b3a4a, emissive: 0x3fa0c8, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.4,
  }));
  lens.position.set(0, 0.104, -0.241);
  lens.rotation.y = Math.PI;
  g.add(lens);
  g.add(cyl(0.011, 0.011, 0.022, M.steel, 0, 0.128, -0.1));

  // Magazine, pistol grip, trigger, stock and cheek riser.
  g.add(bx(0.036, 0.15, 0.06, M.polymer, 0, -0.11, -0.06, 0.1));
  g.add(bx(0.034, 0.1, 0.048, M.polymer, 0, -0.08, 0.055, -0.22));
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 6, 14, Math.PI * 1.3), M.dark);
  guard.position.set(0, -0.045, 0.008);
  guard.rotation.set(Math.PI / 2, 0, Math.PI * 0.92);
  g.add(guard);
  g.add(bx(0.007, 0.02, 0.006, M.steel, 0, -0.045, 0.005, 0.2));
  g.add(bx(0.036, 0.062, 0.2, M.polymer, 0, 0.0, 0.2, 0.04));
  g.add(bx(0.03, 0.03, 0.16, M.polymer, 0, 0.038, 0.2));
  g.add(bx(0.044, 0.1, 0.026, M.dark, 0, -0.01, 0.3));

  // Folded bipod under the handguard.
  for (const s of [-1, 1]) {
    g.add(bx(0.008, 0.008, 0.14, M.steel, s * 0.018, -0.026, -0.34, 0.3, s * 0.12));
  }

  glovedHand(g, -0.075, 0.075, 1, 0);
  const support = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.16, 4, 10), M.glove);
  support.position.set(-0.03, -0.055, -0.34);
  support.rotation.set(0.35, 0, -0.5);
  g.add(support);

  g.userData.muzzle = new THREE.Vector3(0, 0.012, -0.755);
  return g;
}

function buildLmg() {
  const M = gunMats;
  const g = new THREE.Group();

  // Boxy receiver and top cover with a carry handle.
  g.add(bx(0.075, 0.095, 0.34, M.dark, 0, 0.005, -0.06));
  g.add(bx(0.06, 0.03, 0.3, M.steel, 0, 0.068, -0.06));
  for (const s of [-1, 1]) {
    g.add(bx(0.01, 0.03, 0.02, M.steel, s * 0.03, 0.092, -0.1));
  }
  g.add(bx(0.05, 0.012, 0.02, M.steel, 0, 0.108, -0.1));

  // Barrel shroud with cooling slots and a heavy flash hider.
  g.add(cyl(0.028, 0.028, 0.3, M.polymer, 0, 0.02, -0.34, Math.PI / 2, 0, 0, 14));
  for (let i = 0; i < 4; i++) {
    g.add(bx(0.058, 0.014, 0.022, M.dark, 0, 0.02, -0.26 - i * 0.06));
  }
  g.add(cyl(0.017, 0.017, 0.14, M.steel, 0, 0.02, -0.55, Math.PI / 2, 0, 0, 14));
  g.add(cyl(0.026, 0.022, 0.06, M.dark, 0, 0.02, -0.62, Math.PI / 2, 0, 0, 12));
  g.add(cyl(0.009, 0.009, 0.012, new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 1 }), 0, 0.02, -0.648, Math.PI / 2));

  // Ammo drum: a cylinder lying across the receiver.
  g.add(cyl(0.105, 0.105, 0.075, M.polymer, 0, -0.1, -0.05, 0, 0, Math.PI / 2, 18));
  g.add(cyl(0.108, 0.108, 0.012, M.steel, 0.04, -0.1, -0.05, 0, 0, Math.PI / 2, 18));

  // Bipod, angled out and planted, plus the sling loops.
  for (const s of [-1, 1]) {
    g.add(bx(0.008, 0.1, 0.008, M.steel, s * 0.05, -0.075, -0.4, 0, 0, s * 0.45));
  }
  g.add(bx(0.012, 0.012, 0.03, M.dark, -0.075, 0.0, -0.02));

  // Grip, trigger, stock.
  g.add(bx(0.036, 0.11, 0.052, M.polymer, 0, -0.085, 0.075, -0.2));
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0045, 6, 14, Math.PI * 1.3), M.dark);
  guard.position.set(0, -0.045, 0.03);
  guard.rotation.set(Math.PI / 2, 0, Math.PI * 0.92);
  g.add(guard);
  g.add(bx(0.04, 0.07, 0.2, M.polymer, 0, -0.005, 0.24, 0.05));
  g.add(bx(0.05, 0.11, 0.028, M.dark, 0, -0.02, 0.34, 0.05));

  glovedHand(g, -0.08, 0.09, 1, 0);

  g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.655);
  return g;
}

/**
 * Left hand melee weapon. Built around the wrist origin, blade forward on -Z,
 * so the viewmodel can bob it with the same root transform as the firearm.
 */
export function buildMelee(kind = 'machete') {
  const M = gunMats;
  const g = new THREE.Group();

  // Forearm + sleeve, entering from the lower left of frame.
  const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.22, 4, 10), M.glove);
  forearm.position.set(0.02, -0.05, 0.17);
  forearm.rotation.x = 0.5;
  g.add(forearm);

  // Glove: palm, wrapped fingers, thumb.
  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.06, 4, 10), M.glove);
  palm.position.set(0, 0, 0.02);
  palm.rotation.set(0.1, 0, 0.2);
  g.add(palm);
  for (let f = 0; f < 4; f++) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0105, 0.03, 3, 7), M.glove);
    finger.position.set(-0.012, 0.026 - f * 0.019, -0.012);
    finger.rotation.set(1.35, 0, 0.1);
    g.add(finger);
  }

  // Handle with grip rings, guard and pommel.
  const handleMat = kind === 'bat' ? M.steel : M.polymer;
  g.add(cyl(0.017, 0.017, 0.14, handleMat, 0, 0, 0.03, Math.PI / 2, 0, 0, 10));
  for (let i = 0; i < 5; i++) {
    g.add(cyl(0.019, 0.019, 0.006, M.dark, 0, 0, -0.02 + i * 0.024, Math.PI / 2, 0, 0, 10));
  }
  if (kind === 'knife') {
    // Short, thin, taped: visibly a worse tool than the machete.
    g.add(bx(0.05, 0.014, 0.012, M.dark, 0, 0, -0.04));
    g.add(bx(0.009, 0.036, 0.24, M.steel, 0, -0.003, -0.16));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.07, 4), M.steel);
    tip.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
    tip.position.set(0, -0.003, -0.315);
    tip.scale.set(0.4, 1, 1);
    g.add(tip);
    g.add(bx(0.015, 0.015, 0.06, M.polymer, 0, 0.018, -0.07));
  } else if (kind === 'bat') {
    // Aluminium bat: thick barrel, taped grip, dented end cap.
    g.add(cyl(0.026, 0.038, 0.52, M.steel, 0, 0, -0.29, Math.PI / 2, 0, 0, 14));
    g.add(cyl(0.04, 0.04, 0.03, M.dark, 0, 0, -0.55, Math.PI / 2, 0, 0, 14));
    for (let i = 0; i < 3; i++) {
      g.add(cyl(0.03, 0.03, 0.018, M.polymer, 0, 0, -0.09 - i * 0.03, Math.PI / 2, 0, 0, 12));
    }
  } else {
    // Machete: guard, wide spine, tapered point.
    g.add(bx(0.075, 0.016, 0.014, M.steel, 0, 0, -0.045));
    const blade = bx(0.012, 0.062, 0.4, M.steel, 0, -0.004, -0.25);
    g.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.031, 0.12, 4), M.steel);
    tip.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
    tip.position.set(0, -0.004, -0.51);
    tip.scale.set(0.4, 1, 1);
    g.add(tip);
    // Old blood down the edge and a taped-up spine.
    g.add(bx(0.004, 0.02, 0.3, new THREE.MeshStandardMaterial({ color: 0x3f090b, roughness: 0.5 }), 0.007, -0.014, -0.22));
    g.add(bx(0.016, 0.016, 0.1, M.polymer, 0, 0.026, -0.11));
  }

  return g;
}

/** First-person weapon, pointing down -Z. */
export function buildGun(kind) {
  if (kind === 'smg') return buildSmg();
  if (kind === 'shotgun') return buildShotgun();
  if (kind === 'rifle') return buildRifle();
  if (kind === 'lmg') return buildLmg();
  return buildPistol();
}

/** Shared instance geometry for the many small props. */
export const PROP_GEO = {
  crate: new THREE.BoxGeometry(1, 1, 1),
  barrel: new THREE.CylinderGeometry(0.4, 0.4, 1.1, 12),
};

export const PROP_MAT = {
  crate: new THREE.MeshStandardMaterial({ color: 0x4a3b28, roughness: 0.95 }),
  barrel: new THREE.MeshStandardMaterial({ color: 0x2f4535, roughness: 0.72, metalness: 0.4 }),
};
