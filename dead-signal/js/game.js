// Dead Signal - first-person zombie survival shooter.
// Static Three.js: no external assets, no build step.
import * as THREE from 'three';
import { buildWorld, resolveCircle, makeRng } from './world.js';
import { Zombie } from './zombie.js';
import { WEAPONS, ViewModel } from './weapons.js';
import { NavGrid, computeHordeSteering } from './nav.js';
import { wavePlan, rollType, MAX_WAVE_ENEMIES, expectedMix } from './waves.js';
import { bossFor, MELEE_TIERS, MELEE_KNOCKBACK, ARMOR_MAX, ARMOR_ABSORB, GRENADE, ALT_FIRE, ATTACHMENTS } from './data.js';
import { SHOP_ITEMS, SHOP_SECTIONS, itemCost, itemMaxed } from './shop.js';
import { challengeFor, markChallengeDone, clearedCount } from './challenges.js';
import { recordRun, noteContractClear, loadCareer, activeStreak } from './career.js';
import { ladderFor, recordLadder, seedForKey } from './ladder.js';
import { endlessEffects } from './endless.js';
import { AudioEngine } from './audio.js';
import { computeSpatialAudio } from './audio-dsp.js';
import {
  sampleCircularSpread,
  rayWorldAll,
  resolveZombieRayHits,
  resolveBallisticPath,
} from './ballistics.js';
import {
  RELOAD_STAGE,
  totalLoaded,
  consumeRound,
  beginReloadState,
  tickReloadState,
  interruptReloadState,
} from './reload.js';
import {
  nextMeleeCombo,
  isTargetInMeleeArc,
  applyMeleeWear,
} from './melee.js';
import {
  THROWABLE_TYPES,
  isExplosionOccluded,
  calculateExplosionDamage,
  stepThrowablePhysics,
  createCookState,
  updateCookState,
  releaseCookState,
  computeTrajectoryArc,
  createFirePool,
  updateFirePool,
  findActiveLureTarget,
} from './throwables.js';
import {
  WEAPON_RECOIL_PROFILES,
  WeaponRecoilSpring,
  ScreenShakeSystem,
} from './gunplay-polish.js';
import {
  GoreDebrisPool,
  ArterialSprayPool,
  severZombieLimb,
  convertToCrawler,
} from './dismemberment.js';
import {
  createAcidPuddle,
  updateAcidPuddle,
  createGasCloud,
  updateGasCloud,
  calculateBloaterBurstDamage,
  stepAcidProjectileCCD,
  evaluateChainReaction,
  HAZARD_CONFIG,
} from './hazards.js';
import {
  compute3DPounceTrajectory,
  samplePounceArcPoints,
  isTargetInFlashlightBeam,
  stepLurkerAI,
  LURKER_CONFIG,
} from './lurker.js';

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.38;
renderer.autoClear = false;

// Quality tiers. The game starts on high and steps down on its own if the
// machine cannot hold the frame rate; nothing here changes gameplay.
const QUALITY_TIERS = [
  { name: 'low', ratio: 1.0, shadow: 1024, grade: false },
  { name: 'medium', ratio: 1.25, shadow: 1536, grade: true },
  { name: 'high', ratio: 1.75, shadow: 2048, grade: true },
];
let qualityTier = 2;

// Post: a single full-screen grade pass (aberration, filmic contrast,
// split-tone, vignette, grain). One extra draw call, no extra scene renders.
const gradeTarget = new THREE.WebGLRenderTarget(1, 1, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  depthBuffer: true,
  stencilBuffer: false,
  samples: 4,
});
const gradeMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uAberration: { value: 0.0035 },
    uVignette: { value: 1.02 },
    uGrain: { value: 0.016 },
  },
  depthTest: false,
  depthWrite: false,
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uGrain;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 centred = vUv - 0.5;
      float r2 = dot(centred, centred);

      // Lens aberration grows toward the edges, like a wide-angle lens.
      vec2 shift = centred * uAberration * r2 * 4.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + shift).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - shift).b;
      col = clamp(col, 0.0, 1.0);

      // Filmic S-curve: deeper shadows, cleaner highlights.
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.24);

      // Cool the shadows, warm the highlights.
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 cool = col * vec3(0.86, 0.96, 1.14);
      vec3 warm = col * vec3(1.1, 1.0, 0.88);
      col = mix(cool, warm, smoothstep(0.22, 0.85, lum));

      // Vignette, heavier as health drops.
      float vig = smoothstep(0.95, 0.22, sqrt(r2) * uVignette);
      col *= mix(1.0, vig, 0.85);

      // Animated grain, weakest in the highlights.
      float n = hash(vUv * uResolution + fract(uTime) * 137.0) - 0.5;
      col += n * uGrain * (1.0 - lum * 0.7);

      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  `,
});
const gradeScene = new THREE.Scene();
const gradeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
gradeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), gradeMat));

// Photo mode carries its own tiny post pass: the world is drawn into a target
// with a depth texture, then a quad blurs each pixel by its circle of
// confusion. It costs nothing unless photo mode has depth of field switched on.
const photoTarget = new THREE.WebGLRenderTarget(1, 1, {
  minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
});
photoTarget.depthTexture = new THREE.DepthTexture(1, 1);

function sizeGradeTarget() {
  const tier = QUALITY_TIERS[qualityTier];
  const ratio = Math.min(window.devicePixelRatio || 1, tier.ratio);
  const w = Math.max(1, Math.floor(window.innerWidth * ratio));
  const h = Math.max(1, Math.floor(window.innerHeight * ratio));
  gradeTarget.setSize(w, h);
  gradeMat.uniforms.uResolution.value.set(w, h);
  photoTarget.setSize(w, h);
  dofMat.uniforms.uTexel.value.set(1 / Math.max(1, w), 1 / Math.max(1, h));
}

function applyQuality() {
  const tier = QUALITY_TIERS[qualityTier];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.ratio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  if (world && world.moon) {
    world.moon.shadow.mapSize.set(tier.shadow, tier.shadow);
    if (world.moon.shadow.map) {
      world.moon.shadow.map.dispose();
      world.moon.shadow.map = null;
    }
  }
  sizeGradeTarget();
}

// If the frame rate cannot hold, drop a tier. It never climbs back on its own,
// so the view cannot oscillate mid-firefight.
let perfAccum = 0;
let perfFrames = 0;
let perfCooldown = 4;
function trackPerf(dt) {
  perfAccum += dt;
  perfFrames++;
  perfCooldown -= dt;
  if (perfAccum < 2.5 || perfCooldown > 0) return;
  const fps = perfFrames / perfAccum;
  perfAccum = 0;
  perfFrames = 0;
  if (fps < 42 && qualityTier > 0) {
    qualityTier--;
    applyQuality();
    perfCooldown = 6;
    showHint(`GRAPHICS: ${QUALITY_TIERS[qualityTier].name.toUpperCase()} \u00b7 ${Math.round(fps)} FPS`);
  }
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.05, 240);
camera.rotation.order = 'YXZ';
scene.add(camera);

// Viewmodel scene (drawn on top of the world, own camera, no fog).
const viewScene = new THREE.Scene();
const viewCamera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.01, 5);
viewScene.add(new THREE.HemisphereLight(0xb8d2e6, 0x2b3324, 1.9));
const viewKey = new THREE.DirectionalLight(0xffe6c0, 2.6);
viewKey.position.set(0.6, 1.2, 0.8);
viewScene.add(viewKey);
const viewFill = new THREE.DirectionalLight(0x9fd8ff, 1.4);
viewFill.position.set(-1.2, 0.4, 0.6);
viewScene.add(viewFill);

const world = buildWorld(scene);
const nav = new NavGrid(world.colliders, 2, world.navExtent, world.navRadius);
let navTimer = 0;
const audio = new AudioEngine();
const viewModel = new ViewModel(viewScene, viewCamera);

// Flashlight rides on the camera.
// Low decay keeps the beam useful at range without nuking whatever is in
// your face once the horde closes in.
const flashlight = new THREE.SpotLight(0xfff0d0, 12, 45, 0.5, 0.8, 1.0);
flashlight.position.set(0.12, -0.06, 0);
flashlight.castShadow = false;
camera.add(flashlight);
camera.add(flashlight.target);
flashlight.target.position.set(0.12, -0.06, -1);
flashlight.visible = true;

// Muzzle flash light in the world (the viewmodel light cannot reach it).
const muzzleLight = new THREE.PointLight(0xffc887, 0, 18, 2);
scene.add(muzzleLight);
let muzzleLightTimer = 0;

// Green flash for a bloater rupture, kept separate so it never tints gunfire.
const burstLight = new THREE.PointLight(0xaaff4d, 0, 14, 2);
scene.add(burstLight);
let burstLightTimer = 0;

// ---------------------------------------------------------------- state
let rng = makeRng(1337);

// ---------------------------------------------------------------- settings
// Player-facing options, persisted next to the best-run record.
const SETTINGS_KEY = 'deadSignalSettings';
const settings = Object.assign({
  sensitivity: 1, fov: 78, invertY: false,
  master: 0.7, effects: 0.85, ambience: 0.75, music: 0.6,
  shake: 1, reduceFlash: false, colorblind: false,
  keybinds: {}, aimAssist: true, muted: false,
}, loadSettings());
if (!settings.keybinds || typeof settings.keybinds !== 'object') settings.keybinds = {};

// Action keys can be rebound; movement stays on WASD so the layout never
// depends on a saved file.
const DEFAULT_BINDS = {
  altFire: 'KeyX', reload: 'KeyR', melee: 'KeyV', grenade: 'KeyG', cycleThrowable: 'KeyT',
  depot: 'KeyB', flashlight: 'KeyF', mute: 'KeyM', photo: 'KeyP',
};
const BIND_ACTIONS = [
  ['altFire', 'ALT-FIRE'], ['reload', 'RELOAD'], ['melee', 'MELEE'],
  ['grenade', 'GRENADE'], ['cycleThrowable', 'CYCLE THROWABLE'], ['depot', 'SUPPLY DEPOT'], ['flashlight', 'FLASHLIGHT'],
  ['mute', 'MUTE'], ['photo', 'PHOTO MODE'],
];
let rebinding = null;

function bindFor(action) {
  return (settings.keybinds && settings.keybinds[action]) || DEFAULT_BINDS[action];
}

function actionFor(code) {
  for (const [action] of BIND_ACTIONS) if (bindFor(action) === code) return action;
  return null;
}

function keyLabel(code) {
  if (!code) return '\u2014';
  return code.replace(/^Key|^Digit|^Numpad/, '').replace('Shift', 'SHIFT').toUpperCase();
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) { return {}; }
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (err) { /* storage can be blocked */ }
}

// ------------------------------------------------------------ launch params
// ?wave=20 starts a run at wave 20, so the late curve is testable in one click.
// ?stats=1 opens the frame-time readout; F3 toggles it at any time.
const params = new URLSearchParams(location.search);
const launchWave = Math.max(0, Math.min(99, Number.parseInt(params.get('wave') || '0', 10) || 0));
// ?credits=N stocks the wallet at the start of a run, so the depot can be
// exercised without grinding a wave first.
const launchCredits = Math.max(0, Math.min(99999, Number.parseInt(params.get('credits') || '0', 10) || 0));

const player = {
  pos: new THREE.Vector3(0, 0, 20),
  vel: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: -0.03,
  height: 1.68,
  radius: 0.36,
  health: 100,
  maxHealth: 100,
  armor: 0,
  maxArmor: ARMOR_MAX,
  stamina: 100,
  maxStamina: 100,
  grenades: GRENADE.startCount,
  grenadeMax: GRENADE.maxCount,
  throwables: { frag: 2, molotov: 1, pipeBomb: 1 },
  activeThrowable: 'frag',
  cookingState: null,
  grounded: true,
  bob: 0,
  lastDamage: -99,
  stepAccum: 0,
  shake: 0,
  ads: false,
  sprinting: false,
  iframes: 0,
};

// Camera recoil is driven by per-weapon harmonic springs & 3-tier screen shake (Day 7).
const recoilSpring = new WeaponRecoilSpring('pistol');
const shakeSystem = new ScreenShakeSystem(2.6);
const recoil = { pitch: 0, yaw: 0 };

const ammo = {
  mag: WEAPONS.map((w) => w.magSize),
  chambered: WEAPONS.map(() => true),
  reloadStage: WEAPONS.map(() => RELOAD_STAGE.READY),
  reserve: WEAPONS.map((w) => (w.reserveMax === Infinity ? Infinity : Math.round(w.reserveMax * 0.7))),
  weapon: 0,
  // The AR-style rifle is standard issue; the heavy LMG has to be recovered
  // from a weapon cache during the run.
  unlocked: WEAPONS.map((w) => !w.locked),
  meleeCooldown: 0,
  meleeUses: 0,
  comboStep: 0,
  lastSwingAt: -99,
  shoveCooldown: 0,
  reloading: false,
  reloadTimer: 0,
  reloadTotal: 0,
  reloadIsPartial: false,
  reloadWeapon: 0,
  autoReloadTimer: 0,
  autoReloadWeapon: -1,
  lastShot: 0,
  triggerHeld: false,
  dryFireLatched: false,
  // Alt-fire state: a burst queue, the two timed stances, the cooldown and the
  // one found attachment per gun.
  altCooldown: 0,
  burstLeft: 0,
  burstTimer: 0,
  burstInterval: 0,
  burstOpts: null,
  steadyTimer: 0,
  bipodTimer: 0,
  attachment: WEAPONS.map(() => null),
};

// Per-run progression. Bought at the depot with credits earned in the run and
// reset when a new run starts, so the shop is a decision, not a grind.
const upgrades = { damage: 0, mag: 0, reload: 0, stability: 0, health: 0, armor: 0, stamina: 0 };

const photo = { active: false, dof: false, pos: new THREE.Vector3(), yaw: 0, pitch: 0, focus: 14 };

// Photo mode carries its own tiny post pass; declared up with the other
// render targets because applyQuality() sizes it during boot.
const dofMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uNear: { value: 0.05 },
    uFar: { value: 240 },
    uFocus: { value: 14 },
    uRange: { value: 18 },
    uMax: { value: 2.2 },
    uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform sampler2D tDepth;',
    'uniform float uNear; uniform float uFar; uniform float uFocus; uniform float uRange; uniform float uMax;',
    'uniform vec2 uTexel; varying vec2 vUv;',
    'float linearDepth(vec2 uv) {',
    '  float d = texture2D(tDepth, uv).x;',
    '  float z = d * 2.0 - 1.0;',
    '  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));',
    '}',
    'void main() {',
    '  float z = linearDepth(vUv);',
    '  float coc = clamp(abs(z - uFocus) / uRange, 0.0, 1.0);',
    '  coc = coc * coc * uMax;',
    '  vec3 col = texture2D(tDiffuse, vUv).rgb;',
    '  if (coc > 0.002) {',
    '    vec3 sum = col; float weight = 1.0;',
    '    for (int i = 0; i < 8; i++) {',
    '      float a = 6.2831853 * float(i) / 8.0;',
    '      vec2 off = vec2(cos(a), sin(a)) * coc * uTexel * 6.0;',
    '      sum += texture2D(tDiffuse, vUv + off).rgb; weight += 1.0;',
    '    }',
    '    col = sum / weight;',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}',
  ].join('\n'),
});
const dofScene = new THREE.Scene();
dofScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dofMat));

function togglePhoto() {
  if (!game.running || game.over) return;
  photo.active = !photo.active;
  if (photo.active) {
    game.paused = true;
    ammo.triggerHeld = false;
    player.ads = false;
    photo.pos.copy(camera.position);
    photo.yaw = player.yaw;
    photo.pitch = player.pitch;
    if (hud.pause) hud.pause.classList.add('hidden');
    document.body.classList.remove('paused');
    document.body.classList.add('photo');
    if (document.pointerLockElement === canvas) {
      suppressLockEvent = true;
      document.exitPointerLock();
    }
    showHint(`PHOTO MODE \u00b7 WASD FLY \u00b7 SPACE/CTRL HEIGHT \u00b7 WHEEL FOCUS \u00b7 ${keyLabel(bindFor('photo'))} EXIT`, 5200);
  } else {
    document.body.classList.remove('photo');
    game.paused = false;
    requestLock();
    showHint('PHOTO MODE OFF', 1000);
  }
}

function updatePhotoCamera(dt) {
  const speed = (keys['ShiftLeft'] || keys['ShiftRight'] ? 14 : 5.5) * dt;
  const forward = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const strafe = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  const lift = (keys['Space'] ? 1 : 0) - (keys['ControlLeft'] || keys['ControlRight'] ? 1 : 0);
  const sin = Math.sin(photo.yaw);
  const cos = Math.cos(photo.yaw);
  photo.pos.x += (-sin * forward + cos * strafe) * speed;
  photo.pos.z += (-cos * forward - sin * strafe) * speed;
  photo.pos.y = Math.max(0.3, Math.min(90, photo.pos.y + lift * speed));
}

const game = {
  running: false,
  paused: true,
  over: false,
  shopOpen: false,
  seed: 1337,
  endlessStacks: [],
  credits: 0,
  wave: 0,
  kills: 0,
  headshots: 0,
  score: 0,
  elapsed: 0,
  shots: 0,
  hits: 0,
  intermission: 0,
  spawnQueue: [],
  spawnTimer: 0,
  zombiesSpawned: 0,
  boss: null,
  hordeTimer: 0,
  moanTimer: 9,
  meleeTier: 0,
  mods: null,
  challenge: null,
};

const zombies = [];
let hitMeshCache = [];
let hitMeshesDirty = true;
const raycaster = new THREE.Raycaster();

const pickups = [];
const pickupProbe = new THREE.Vector3();

// ---------------------------------------------------------------- particles
const bloodMat = new THREE.MeshBasicMaterial({ color: 0x8e1119 });
const bloodMistMat = new THREE.MeshBasicMaterial({ color: 0xb81a24, transparent: true, opacity: 0.78 });
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd08a });
const concreteMat = new THREE.MeshBasicMaterial({ color: 0x9aa0a6 });
const woodMat = new THREE.MeshBasicMaterial({ color: 0xb0824f });
const particleGeo = new THREE.BoxGeometry(0.055, 0.055, 0.055);
const particles = [];
for (let i = 0; i < 240; i++) {
  const mesh = new THREE.Mesh(particleGeo, bloodMat);
  mesh.visible = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  particles.push({ mesh, vel: new THREE.Vector3(), life: 0, max: 1, gravity: 12 });
}
let particleCursor = 0;
const debrisPool = new GoreDebrisPool(scene, 40);
const arterialPool = new ArterialSprayPool(scene, 50);

function spawnParticles(point, count, kind, power = 1, normal = null) {
  const mat = kind === 'blood' ? bloodMat
    : kind === 'bloodMist' ? bloodMistMat
      : kind === 'acid' ? acidParticleMat
        : kind === 'concrete' ? concreteMat
          : kind === 'wood' ? woodMat
            : sparkMat;
  for (let i = 0; i < count; i++) {
    const p = particles[particleCursor];
    particleCursor = (particleCursor + 1) % particles.length;
    p.mesh.material = mat;
    p.mesh.position.set(point.x, point.y, point.z);
    const baseScale = kind === 'bloodMist' ? 1.15 : kind === 'wood' ? 0.8 : 0.55;
    p.mesh.scale.set(
      baseScale + Math.random() * 0.75,
      (kind === 'wood' ? 0.35 : baseScale) + Math.random() * 0.6,
      baseScale + Math.random() * 0.75,
    );
    p.mesh.visible = true;
    const nx = normal ? normal.x * 3.8 * power : 0;
    const ny = normal ? normal.y * 3.8 * power : 0;
    const nz = normal ? normal.z * 3.8 * power : 0;
    p.vel.set(
      nx + (Math.random() - 0.5) * 5.6 * power,
      ny + Math.random() * 4.2 * power,
      nz + (Math.random() - 0.5) * 5.6 * power,
    );
    p.life = p.max = (kind === 'bloodMist' ? 0.45 : 0.3) + Math.random() * 0.42;
    p.gravity = kind === 'bloodMist' ? 4.5 : kind === 'blood' ? 14 : kind === 'spark' ? 15 : 11;
  }
}

// ---------------------------------------------------------------- impact decals
function makeDecalTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);

  if (kind === 'metal') {
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 28);
    grad.addColorStop(0, 'rgba(18, 20, 24, 0.96)');
    grad.addColorStop(0.28, 'rgba(210, 220, 230, 0.85)');
    grad.addColorStop(0.55, 'rgba(255, 165, 70, 0.32)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  } else if (kind === 'wood') {
    ctx.fillStyle = 'rgba(26, 16, 8, 0.92)';
    ctx.beginPath();
    ctx.arc(32, 32, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(195, 150, 95, 0.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(32 + Math.cos(a) * 8, 32 + Math.sin(a) * 8);
      ctx.lineTo(32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24);
      ctx.stroke();
    }
  } else {
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 28);
    grad.addColorStop(0, 'rgba(14, 15, 16, 0.95)');
    grad.addColorStop(0.38, 'rgba(72, 75, 78, 0.82)');
    grad.addColorStop(0.75, 'rgba(155, 158, 160, 0.32)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

const decalGeo = new THREE.PlaneGeometry(0.16, 0.16);
const decalMats = {
  concrete: new THREE.MeshBasicMaterial({ map: makeDecalTexture('concrete'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  metal: new THREE.MeshBasicMaterial({ map: makeDecalTexture('metal'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  wood: new THREE.MeshBasicMaterial({ map: makeDecalTexture('wood'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
};
const decals = [];
for (let i = 0; i < 96; i++) {
  const mesh = new THREE.Mesh(decalGeo, decalMats.concrete);
  mesh.visible = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  decals.push({ mesh, life: 0 });
}
let decalCursor = 0;
const tmpDecalTarget = new THREE.Vector3();

function spawnDecal(point, normal, material = 'concrete') {
  const d = decals[decalCursor];
  decalCursor = (decalCursor + 1) % decals.length;
  d.mesh.material = decalMats[material] || decalMats.concrete;
  const nx = normal ? normal.x : 0;
  const ny = normal ? normal.y : 1;
  const nz = normal ? normal.z : 0;
  d.mesh.position.set(point.x + nx * 0.014, point.y + ny * 0.014, point.z + nz * 0.014);
  tmpDecalTarget.set(d.mesh.position.x + nx, d.mesh.position.y + ny, d.mesh.position.z + nz);
  d.mesh.lookAt(tmpDecalTarget);
  d.mesh.rotateZ(Math.random() * Math.PI * 2);
  const s = material === 'metal' ? 0.72 + Math.random() * 0.25 : 0.9 + Math.random() * 0.45;
  d.mesh.scale.setScalar(s);
  d.mesh.visible = true;
  d.life = 16;
}

function updateDecals(dt) {
  for (const d of decals) {
    if (d.life <= 0) continue;
    d.life -= dt;
    if (d.life <= 0) d.mesh.visible = false;
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    p.vel.y -= p.gravity * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.mesh.position.y < 0.02) {
      p.mesh.position.y = 0.02;
      p.vel.set(0, 0, 0);
    }
    p.mesh.scale.multiplyScalar(1 - dt * 1.2);
    p.mesh.rotation.x += dt * 6;
    p.mesh.rotation.y += dt * 4;
  }
  debrisPool.update(dt, world.colliders);
  arterialPool.update(dt);
}

// ---------------------------------------------------------------- tracers
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe1ad, transparent: true, opacity: 0.85 });
const tracers = [];
for (let i = 0; i < 14; i++) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(geo, tracerMat);
  line.visible = false;
  line.frustumCulled = false;
  scene.add(line);
  tracers.push({ line, life: 0 });
}
let tracerCursor = 0;

function spawnTracer(from, to) {
  const t = tracers[tracerCursor];
  tracerCursor = (tracerCursor + 1) % tracers.length;
  const arr = t.line.geometry.attributes.position.array;
  arr[0] = from.x; arr[1] = from.y; arr[2] = from.z;
  arr[3] = to.x; arr[4] = to.y; arr[5] = to.z;
  t.line.geometry.attributes.position.needsUpdate = true;
  t.line.visible = true;
  t.life = 0.06;
}

function updateTracers(dt) {
  for (const t of tracers) {
    if (t.life <= 0) continue;
    t.life -= dt;
    if (t.life <= 0) t.line.visible = false;
  }
}

// ---------------------------------------------------------------- shell casings
const brassGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.032, 6);
const brassMat = new THREE.MeshStandardMaterial({ color: 0xe3bd54, roughness: 0.28, metalness: 0.85 });
const shellGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.052, 8);
const shellMat = new THREE.MeshStandardMaterial({ color: 0xb82424, roughness: 0.55, metalness: 0.2 });
const casings = [];
for (let i = 0; i < 48; i++) {
  const mesh = new THREE.Mesh(brassGeo, brassMat);
  mesh.visible = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  casings.push({
    mesh,
    vel: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    life: 0,
    bounces: 0,
    kind: 'brass',
  });
}
let casingCursor = 0;
const tmpCasingRight = new THREE.Vector3();
const tmpCasingUp = new THREE.Vector3();

function spawnCasing(weaponId, muzzlePos, aimDir) {
  const c = casings[casingCursor];
  casingCursor = (casingCursor + 1) % casings.length;
  const isShell = weaponId === 'shotgun';
  c.kind = isShell ? 'shell' : 'brass';
  c.mesh.geometry = isShell ? shellGeo : brassGeo;
  c.mesh.material = isShell ? shellMat : brassMat;

  tmpCasingRight.crossVectors(aimDir, camera.up);
  if (tmpCasingRight.lengthSq() < 1e-5) tmpCasingRight.set(1, 0, 0);
  tmpCasingRight.normalize();
  tmpCasingUp.crossVectors(tmpCasingRight, aimDir).normalize();

  c.mesh.position.copy(muzzlePos)
    .addScaledVector(tmpCasingRight, 0.14)
    .addScaledVector(aimDir, -0.18)
    .addScaledVector(tmpCasingUp, 0.03);
  c.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  c.mesh.visible = true;

  const sideSpeed = (isShell ? 2.1 : 2.6) + Math.random() * 1.1;
  const upSpeed = (isShell ? 1.7 : 2.1) + Math.random() * 0.85;
  c.vel.set(
    player.vel.x * 0.35 + tmpCasingRight.x * sideSpeed - aimDir.x * 0.45,
    upSpeed,
    player.vel.z * 0.35 + tmpCasingRight.z * sideSpeed - aimDir.z * 0.45,
  );
  c.spin.set((Math.random() - 0.5) * 28, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 28);
  c.bounces = 0;
  c.life = 4.2;
}

function updateCasings(dt) {
  for (const c of casings) {
    if (c.life <= 0) continue;
    c.life -= dt;
    if (c.life <= 0) {
      c.mesh.visible = false;
      continue;
    }
    c.vel.y -= 16 * dt;
    c.mesh.position.addScaledVector(c.vel, dt);
    c.mesh.rotation.x += c.spin.x * dt;
    c.mesh.rotation.y += c.spin.y * dt;
    c.mesh.rotation.z += c.spin.z * dt;

    if (c.mesh.position.y <= 0.016) {
      c.mesh.position.y = 0.016;
      if (Math.abs(c.vel.y) > 0.65 && c.bounces < 3) {
        if (c.bounces < 2) {
          audio.casingPing(c.kind, panFor(c.mesh.position), c.bounces === 0 ? 1 : 0.45);
        }
        c.vel.y = Math.abs(c.vel.y) * 0.46;
        c.vel.x *= 0.68;
        c.vel.z *= 0.68;
        c.spin.multiplyScalar(0.55);
        c.bounces++;
      } else {
        c.vel.y = 0;
        c.vel.x *= Math.max(0, 1 - 6 * dt);
        c.vel.z *= Math.max(0, 1 - 6 * dt);
        c.spin.set(0, c.spin.y * 0.85, 0);
        c.mesh.rotation.x = Math.PI / 2;
      }
    }
  }
}

// ---------------------------------------------------------------- damage numbers
const dmgLayer = document.getElementById('dmgLayer');
const dmgPool = [];
for (let i = 0; i < 26; i++) {
  const el = document.createElement('div');
  el.className = 'dmg';
  dmgLayer.appendChild(el);
  dmgPool.push({ el, life: 0, pos: new THREE.Vector3(), vy: 0 });
}
let dmgCursor = 0;

function spawnDamageNumber(worldPos, amount, crit) {
  const d = dmgPool[dmgCursor];
  dmgCursor = (dmgCursor + 1) % dmgPool.length;
  d.pos.copy(worldPos);
  d.vy = 1.1 + Math.random() * 0.5;
  d.life = 0.85;
  d.el.textContent = crit ? `${Math.round(amount)}!` : String(Math.round(amount));
  d.el.className = crit ? 'dmg crit' : 'dmg';
  if (settings.colorblind) d.el.classList.add('cb');
  d.el.style.display = 'block';
  d.el.style.opacity = '1';
}

const projVec = new THREE.Vector3();
function updateDamageNumbers(dt) {
  for (const d of dmgPool) {
    if (d.life <= 0) continue;
    d.life -= dt;
    if (d.life <= 0) { d.el.style.display = 'none'; continue; }
    d.pos.y += d.vy * dt;
    projVec.copy(d.pos).project(camera);
    // Behind the camera the projection mirrors onto the screen: hide instead.
    if (projVec.z > 1) { d.el.style.opacity = '0'; continue; }
    const x = (projVec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projVec.y * 0.5 + 0.5) * window.innerHeight;
    d.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${(0.85 + (0.85 - d.life) * 0.5).toFixed(2)})`;
    d.el.style.opacity = String(Math.min(1, d.life * 2.4));
  }
}

// ---------------------------------------------------------------- HUD refs
const el = (id) => document.getElementById(id);
const hud = {
  hpFill: el('hpFill'), hpValue: el('hpValue'), stamFill: el('stamFill'),
  armorFill: el('armorFill'), armorValue: el('armorValue'), armorRow: el('armorRow'),
  weaponName: el('weaponName'), ammoMag: el('ammoMag'), ammoReserve: el('ammoReserve'),
  meleeDur: el('meleeDur'), meleeUses: el('meleeUses'), meleeMax: el('meleeMax'),
  meleeDurTouch: el('meleeDurTouch'),
  ammoPanel: el('ammoPanel'), reloadFill: el('reloadFill'),
  wave: el('waveValue'), kills: el('killValue'), left: el('leftValue'), score: el('scoreValue'),
  surgeBadge: el('surgeBadge'),
  boss: el('bossBar'), bossName: el('bossName'), bossFill: el('bossFill'), bossHp: el('bossHp'),
  credits: el('creditValue'), grenadeCount: el('grenadeCount'),
  throwableLabel: el('throwableLabel'), cookBar: el('cookBar'), cookFill: el('cookFill'),
  shop: el('shopScreen'), shopItems: el('shopItems'), shopCredits: el('shopCredits'),
  cross: el('cross'), blood: el('blood'), hurt: el('hurtFlash'),
  crossMiss: el('crossMiss'),
  dmgDir: el('dmgDir'), perf: el('perf'),
  setSens: el('setSens'), setFov: el('setFov'), setInvert: el('setInvert'),
  setSensVal: el('setSensVal'), setFovVal: el('setFovVal'),
  setMaster: el('setMaster'), setEffects: el('setEffects'), setAmbience: el('setAmbience'), setMusic: el('setMusic'),
  setMasterVal: el('setMasterVal'), setEffectsVal: el('setEffectsVal'), setAmbienceVal: el('setAmbienceVal'), setMusicVal: el('setMusicVal'),
  setShake: el('setShake'), setShakeVal: el('setShakeVal'),
  setFlash: el('setFlash'), setColorblind: el('setColorblind'), setAimAssist: el('setAimAssist'),
  binds: el('bindList'), resetBinds: el('resetBinds'),
  altName: el('altName'), altState: el('altState'), attachStrip: el('attachStrip'),
  weeklyLadder: el('weeklyLadder'),
  banner: el('banner'), bannerK: el('bannerK'), bannerT: el('bannerT'), bannerS: el('bannerS'),
  hint: el('hint'), flashBtn: el('flashBtn'), muteBtn: el('muteBtn'),
  menu: el('menuScreen'), pause: el('pauseScreen'), over: el('overScreen'),
  loading: el('loading'), best: el('bestValue'),
};

let bannerTimer = 0;
function showBanner(kicker, title, sub, ms = 2600) {
  hud.bannerK.textContent = kicker;
  hud.bannerT.textContent = title;
  hud.bannerS.textContent = sub || '';
  hud.banner.classList.add('show');
  bannerTimer = ms / 1000;
}

let hintTimer = 0;
function showHint(text, ms = 2200) {
  hud.hint.textContent = text;
  hud.hint.classList.add('show');
  hintTimer = ms / 1000;
}

// ---------------------------------------------------------------- input
const keys = Object.create(null);
const input = { touchMove: { x: 0, y: 0 }, touchFire: false, touchLook: { x: 0, y: 0 } };
// Touch controls only when the primary pointer is coarse. A Windows machine
// with a touch digitizer still reports maxTouchPoints > 0, and switching to
// touch mode there lays the look-zone over the canvas, which swallows every
// mouse click and leaves the player unable to aim or fire.
const coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const isTouch = coarsePointer && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

// A real mouse always wins over touch mode (touchscreens report both).
window.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') document.body.classList.remove('touch-mode');
}, true);

let mouseLocked = false;
let suppressLockEvent = false;

const LOCK_HINT = 'MOUSE LOCK UNAVAILABLE \u2014 MOVE TO AIM, CLICK TO FIRE';
let lockHintUntil = 0;

function showLockHint() {
  const now = performance.now();
  if (now < lockHintUntil) return;
  // A gameplay hint (locked weapon, wave payout) outranks this notice. The
  // lock rejection lands a moment after the click, so without the check it
  // erased whatever the game had just told the player.
  if (hintTimer > 0.6) return;
  lockHintUntil = now + 8000;
  showHint(LOCK_HINT, 5200);
}

function requestLock() {
  if (isTouch) return;
  if (document.pointerLockElement === canvas) return;
  try {
    const p = canvas.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(showLockHint);
  } catch (err) {
    showLockHint();
  }
}

// Lock is refused in some embeds and briefly after Escape. Aiming and firing
// both work without it, so this is a hint rather than a dead end.
document.addEventListener('pointerlockerror', showLockHint);

let pauseArmed = false;

document.addEventListener('pointerlockchange', () => {
  mouseLocked = document.pointerLockElement === canvas;
  // An unlock while actually playing means the player lost control of the look,
  // so the game pauses. Do not re-pause on the unlock that belongs to an
  // Escape-to-pause or a button click: those already own the pause state.
  if (!mouseLocked && game.running && !game.over && !suppressLockEvent && !game.paused) {
    pauseGame();
  }
  suppressLockEvent = false;
  pauseArmed = false;
});

window.addEventListener('keydown', (e) => {
  const k = e.code;
  keys[k] = true;

  // A rebind owns the next key, whatever it is; Escape backs out.
  if (rebinding) {
    e.preventDefault();
    if (k !== 'Escape') {
      settings.keybinds[rebinding] = k;
      saveSettings();
    }
    rebinding = null;
    renderBinds();
    return;
  }

  if (k === 'F3') {
    e.preventDefault();
    hud.perf.classList.toggle('show');
    return;
  }

  const action = actionFor(k);

  if (action === 'photo') { e.preventDefault(); togglePhoto(); return; }
  if (photo.active && k === 'KeyO') {
    photo.dof = !photo.dof;
    showHint(photo.dof ? 'DEPTH OF FIELD ON \u00b7 WHEEL TO FOCUS' : 'DEPTH OF FIELD OFF', 1800);
    return;
  }

  if (k === 'Escape') {
    if (photo.active) { togglePhoto(); return; }
    if (game.shopOpen) { closeShop(); return; }
    if (game.running && !game.paused && !game.over) {
      pauseGame();
      // The pointer lock is about to be released by the browser; the unlock
      // event must not re-pause a game that is already being paused here.
      pauseArmed = true;
    }
    return;
  }
  // The depot toggles even though it holds the game paused.
  if (action === 'depot') {
    if (game.shopOpen) closeShop();
    else if (game.running && !game.over && !photo.active) openShop();
    return;
  }
  if (!game.running || game.paused || game.over) return;
  if (action === 'cycleThrowable' || k === 'KeyT') { cycleThrowable(); return; }
  if (action === 'grenade') { startCookingThrowable(); return; }
  if (action === 'altFire') { altFire(); return; }
  if (action === 'reload') startReload();
  if (action === 'flashlight') toggleFlashlight();
  if (action === 'mute') toggleMute();
  if (k === 'Digit1' || k === 'Numpad1') selectWeapon(0, true);
  if (k === 'Digit2' || k === 'Numpad2') selectWeapon(1, true);
  if (k === 'Digit3' || k === 'Numpad3') selectWeapon(2, true);
  if (k === 'Digit4' || k === 'Numpad4') selectWeapon(3, true);
  if (k === 'Digit5' || k === 'Numpad5') selectWeapon(4, true);
  if (k === 'KeyQ') selectWeapon(ammo.weapon + 1);
  if (action === 'melee') swingMelee();
  if (k === 'Space' && player.grounded) {
    player.vel.y = 4.7;
    player.grounded = false;
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (actionFor(e.code) === 'grenade') {
    if (player.cookingState && player.cookingState.isCooking) {
      releaseCookedThrowable();
    }
  }
});

canvas.addEventListener('mousedown', (e) => {
  if (!game.running || game.paused || game.over) return;
  // Autoplay policy: a context created before a gesture (?wave= launch) is
  // suspended, so the first trigger pull has to wake it as well.
  audio.resume();
  // Firing must never depend on pointer lock succeeding.
  if (!mouseLocked) requestLock();
  if (e.button === 0) { ammo.triggerHeld = true; tryFire(); }
  if (e.button === 2) {
    if (keys['Space']) defensiveShove();
    else player.ads = true;
  }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    ammo.triggerHeld = false;
    ammo.dryFireLatched = false;
  }
  if (e.button === 2) player.ads = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  if (!photo.active) return;
  e.preventDefault();
  photo.focus = Math.max(1.5, Math.min(140, photo.focus + e.deltaY * 0.02));
}, { passive: false });

document.addEventListener('mousemove', (e) => {
  if (photo.active) {
    const mx = e.movementX || 0;
    const my = e.movementY || 0;
    photo.yaw -= mx * 0.0022 * settings.sensitivity;
    photo.pitch = Math.max(-1.45, Math.min(1.45, photo.pitch + (settings.invertY ? my : -my) * 0.0022 * settings.sensitivity));
    return;
  }
  if (!game.running || game.paused || game.over) return;
  // Locked: always look. Unlocked: look while the pointer is over the canvas,
  // a touch slower, so the game stays playable when lock is refused.
  if (!mouseLocked && e.target !== canvas) return;
  const mx = e.movementX || 0;
  const my = e.movementY || 0;
  if (!mx && !my) return;
  const sens = (player.ads ? 0.0011 : 0.0021) * settings.sensitivity * (mouseLocked ? 1 : 0.8);
  player.yaw -= mx * sens;
  const pitchDelta = (settings.invertY ? my : -my) * sens;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch + pitchDelta));
  viewModelUpdateLook(mx, my);
});

let lookDx = 0, lookDy = 0;
function viewModelUpdateLook(dx, dy) { lookDx += dx; lookDy += dy; }

// Touch: stick moves, right side looks, buttons fire/reload/swap.
if (isTouch) {
  document.body.classList.add('touch-mode');
  const stick = el('stick');
  const knob = el('stickKnob');
  let stickId = null;
  const resetStick = () => {
    stickId = null;
    input.touchMove.x = 0; input.touchMove.y = 0;
    knob.style.transform = 'translate(-50%, -50%)';
  };
  stick.addEventListener('touchstart', (e) => {
    stickId = e.changedTouches[0].identifier;
    e.preventDefault();
  }, { passive: false });
  stick.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== stickId) continue;
      const r = stick.getBoundingClientRect();
      const dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(1, len);
      input.touchMove.x = (dx / len) * cl;
      input.touchMove.y = (dy / len) * cl;
      knob.style.transform = `translate(calc(-50% + ${input.touchMove.x * 34}px), calc(-50% + ${input.touchMove.y * 34}px))`;
    }
    e.preventDefault();
  }, { passive: false });
  stick.addEventListener('touchend', resetStick);
  stick.addEventListener('touchcancel', resetStick);

  const lookZone = el('lookZone');
  let lookId = null, lastX = 0, lastY = 0;
  lookZone.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    lookId = t.identifier; lastX = t.clientX; lastY = t.clientY;
    e.preventDefault();
  }, { passive: false });
  lookZone.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookId) continue;
      const dx = t.clientX - lastX;
      const dy = t.clientY - lastY;
      lastX = t.clientX; lastY = t.clientY;
      player.yaw -= dx * 0.004;
      player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - dy * 0.004));
      viewModelUpdateLook(dx * 2, dy * 2);
    }
    e.preventDefault();
  }, { passive: false });
  lookZone.addEventListener('touchend', () => { lookId = null; });

  const fireBtn = el('fireBtn');
  fireBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    ammo.triggerHeld = true;
    tryFire();
  }, { passive: false });
  fireBtn.addEventListener('touchend', () => {
    ammo.triggerHeld = false;
    ammo.dryFireLatched = false;
  });
  el('reloadBtn').addEventListener('click', () => startReload());
  el('swapBtn').addEventListener('click', () => selectWeapon(ammo.weapon + 1));
  el('meleeBtn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    swingMelee();
  }, { passive: false });
  el('meleeBtn').addEventListener('click', () => swingMelee());
  el('nadeBtn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    startCookingThrowable();
  }, { passive: false });
  el('nadeBtn').addEventListener('touchend', (e) => {
    e.preventDefault();
    if (player.cookingState && player.cookingState.isCooking) {
      releaseCookedThrowable();
    } else {
      throwGrenade();
    }
  }, { passive: false });
  el('nadeBtn').addEventListener('click', () => throwGrenade());
  const nadeRow = el('nadeRow');
  if (nadeRow) {
    nadeRow.addEventListener('click', () => cycleThrowable());
  }
}

// ---------------------------------------------------------------- weapons
function weaponDef() { return WEAPONS[ammo.weapon]; }

// ------------------------------------------------------------- upgrades
// Every one of these reads from the depot upgrade table, so the shop and the
// weapon maths can never disagree.
function magSizeFor(def) {
  const index = WEAPONS.indexOf(def);
  let size = def.magSize + upgrades.mag * (def.id === 'shotgun' ? 1 : 4);
  if (ammo.attachment[index] === 'exttube') size += 12;
  return size;
}

/** The found attachment on a gun, or null. */
function attachmentFor(index = ammo.weapon) {
  return ammo.attachment[index] || null;
}

function missingAttachmentGuns() {
  return ATTACHMENTS.filter((a) => !ammo.attachment[a.gun]);
}

function reloadTimeFor(def) {
  return def.reloadTime * Math.max(0.5, 1 - upgrades.reload * 0.1);
}

function weaponDamageMul() {
  const mods = game.mods || {};
  return (1 + upgrades.damage * 0.12) * (mods.damageMul || 1);
}

function weaponSpreadMul(index = ammo.weapon) {
  let mul = Math.max(0.6, 1 - upgrades.stability * 0.12);
  const att = attachmentFor(index);
  if (att === 'choke' && index === 2) mul *= 0.6;
  if (att === 'reddot' && index === 0) mul *= 0.7;
  // The rifle's steady breath and the LMG's bipod both narrow the cone; the
  // bipod only while the operator is actually planted.
  if (ammo.steadyTimer > 0) mul *= 0.35;
  if (ammo.bipodTimer > 0 && player.grounded) {
    const speed = Math.hypot(player.vel.x, player.vel.z);
    if (speed < 0.6) mul *= 0.45;
  }
  return mul;
}

function weaponRecoilMul(index = ammo.weapon) {
  let mul = Math.max(0.6, 1 - upgrades.stability * 0.12);
  if (attachmentFor(index) === 'compensator') mul *= 0.65;
  return mul;
}

function weaponAvailable(index) {
  // A challenge can pin the player to one gun for the whole contract.
  if (game.mods && game.mods.weaponLock !== undefined) return index === game.mods.weaponLock;
  return !!ammo.unlocked[index];
}

function selectWeapon(index, strict = false) {
  let next = ((index % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
  if (strict) {
    // A direct number key never quietly hands you a different gun: pressing 5
    // with the LMG still locked should say so, not swap to the pistol.
    if (!weaponAvailable(next)) {
      showHint(game.mods && game.mods.weaponLock !== undefined
        ? 'CONTRACT LOADOUT \u2014 ONE WEAPON ONLY'
        : 'WEAPON LOCKED \u2014 SUPPLY DEPOT [B]', 1500);
      audio.dryFire();
      return;
    }
  } else {
    // Cycling skips anything this run has not unlocked or is not allowed to use.
    for (let i = 0; i < WEAPONS.length && !weaponAvailable(next); i++) {
      next = (next + 1) % WEAPONS.length;
    }
  }
  if (!weaponAvailable(next) || next === ammo.weapon) return;
  // Interrupt any active reload cleanly while keeping each gun's reload checkpoint
  interruptReloadState(ammo);
  ammo.autoReloadTimer = 0;
  ammo.autoReloadWeapon = -1;
  ammo.dryFireLatched = false;
  ammo.weapon = next;
  recoilSpring.setWeapon(WEAPONS[next].id);
  // Recoil bloom belongs to the gun that was being fired; a fresh weapon
  // starts on its own cone instead of inheriting the last one's spread.
  spreadBloom = 0;
  ammo.altCooldown = 0;
  ammo.burstLeft = 0;
  ammo.burstTimer = 0;
  ammo.burstOpts = null;
  ammo.steadyTimer = 0;
  ammo.bipodTimer = 0;
  viewModel.select(next);
  audio.weaponSwap();
  updateAmmoHud();
}

function startReload() {
  const def = weaponDef();
  const started = beginReloadState(ammo, def, magSizeFor(def), reloadTimeFor(def));
  if (!started) return;
  ammo.altCooldown = 0;
  ammo.burstLeft = 0;
  ammo.burstTimer = 0;
  ammo.burstOpts = null;
  ammo.steadyTimer = 0;
  ammo.bipodTimer = 0;
  ammo.autoReloadTimer = 0;
  if (started.stage === RELOAD_STAGE.READY) audio.reloadStart();
  else audio.reloadStep();
  updateAmmoHud();
}

let spreadBloom = 0;

function tryFire() {
  if (!game.running || game.paused || game.over || photo.active) return;
  const def = weaponDef();
  const now = performance.now() / 1000;
  if (ammo.reloading) return;
  if (now - ammo.lastShot < 60 / def.rpm) return;
  if (totalLoaded(ammo, ammo.weapon) <= 0) {
    if (!ammo.dryFireLatched) {
      ammo.dryFireLatched = true;
      audio.dryFire();
    }
    if (!ammo.reloading) startReload();
    return;
  }
  ammo.dryFireLatched = false;
  ammo.lastShot = now;
  fireRound();
}

/**
 * One round: ammo, recoil, tracers and hit resolution. Alt-fire borrows it so
 * a slug and a burst fire the same, honest rays as the normal trigger.
 */
function fireRound(opts = {}) {
  const def = weaponDef();
  if (!consumeRound(ammo, ammo.weapon)) return false;
  const slug = !!opts.slug;
  const damageMul = opts.damageMul || 1;
  const spreadMul = opts.spreadMul || 1;
  const pellets = opts.pellets || def.pellets;

  game.shots += 1;
  updateAmmoHud();

  audio.shot(slug ? 'shotgun' : def.sound);
  viewModel.flash(settings.reduceFlash ? 0.35 : 1);
  viewModel.recoil(def.recoil * weaponRecoilMul() * (slug ? 1.4 : 1));
  muzzleLightTimer = settings.reduceFlash ? 0.03 : 0.06;

  // Spring-driven per-weapon recoil impulse and micro-shake on fire (Day 7)
  const rMul = weaponRecoilMul();
  const kickResult = recoilSpring.kick(def.id, player.ads, rMul, slug);
  shakeSystem.addFireShake(kickResult.fireShake);
  player.shake = shakeSystem.trauma;

  // The round leaves the barrel, not the eye. Aim is resolved from the camera
  // first so the shot still lands under the crosshair, and the muzzle is then
  // the origin of a ray that converges on that point. This is what makes the
  // tracer come out of the gun while keeping the sight honest.
  const eye = new THREE.Vector3();
  const aimDir = new THREE.Vector3();
  camera.getWorldPosition(eye);
  camera.getWorldDirection(aimDir);
  const aimWall = rayWorld(eye, aimDir, 160);
  // Converge on whatever the crosshair is really on, corpse-clear zombie
  // included. Using only the wall distance aimed the barrel at the far end of
  // an open street, and the muzzle offset then put close targets beside the
  // shot even though the crosshair was on them.
  const aimZombie = rayZombies(eye, aimDir, aimWall ? aimWall.distance : 160);
  const aimRange = aimZombie && (!aimWall || aimZombie.distance <= aimWall.distance)
    ? aimZombie.distance
    : (aimWall ? aimWall.distance : 90);
  // The convergence point is the crosshair's actual target. The old 3.5 m
  // floor put it beyond anything closer than that, so a point-blank shell was
  // aimed past and under the zombie and missed entirely.
  const aimPoint = eye.clone().addScaledVector(aimDir, Math.max(1, aimRange));

  const muzzle = new THREE.Vector3();
  viewModel.muzzleWorld(muzzle, camera);
  muzzleLight.position.copy(muzzle);
  spawnCasing(def.id, muzzle, aimDir);

  const baseSpread = (player.ads ? def.adsSpread : def.spread) * weaponSpreadMul() * spreadMul;
  const spread = baseSpread + spreadBloom * (player.ads ? 0.3 : 1) * weaponSpreadMul() * spreadMul;
  // Jitter is applied on the plane the crosshair is actually on, so the cone
  // uses the real target distance. A floor of four metres made point-blank
  // shells and rounds pattern as if fired from across the street.
  const aimDistance = Math.max(1, muzzle.distanceTo(aimPoint));

  let anyMiss = false;
  const lastShotEvents = [];
  const penPower = slug ? 1.85 : (def.penPower || 0.72);
  const maxTargets = slug ? 4 : (def.maxTargets || 1);

  for (let p = 0; p < pellets; p++) {
    const point = jitterPoint(aimPoint, aimDir, Math.tan(spread) * aimDistance, p, pellets);
    const shotDir = point.sub(muzzle).normalize();

    const worldHits = rayWorldAll(muzzle, shotDir, world.colliders, 160);
    const solidWall = worldHits.find((h) => !h.penetrable);
    const maxTraceDist = solidWall ? solidWall.distance : 160;
    const zombieHits = rayZombiesAll(muzzle, shotDir, maxTraceDist);
    const events = resolveBallisticPath(zombieHits, worldHits, { penPower, maxTargets });

    let traceEnd = null;
    for (const ev of events) {
      if (ev.kind === 'zombie') {
        const { zombie, point: hitPoint, distance, part, zone, damageScale, limbId } = ev;
        const head = zone.crit;
        const falloff = damageFalloff(def, distance);
        const mods = game.mods || {};
        const dmg = Math.round(
          def.damage * damageMul * falloff * zone.multiplier * damageScale * weaponDamageMul()
          * (head ? 1 : (mods.headshotOnly ? 0.34 : 1))
        );
        game.hits += 1;
        const killed = zombie.takeDamage(dmg, part, makeContext(), limbId, hitPoint, shotDir);
        if (killed) hitMeshesDirty = true;
        // Fix blood spurting from feet: ensure headshot blood fountain spawns at true head height
        const bloodSpawnPoint = hitPoint.clone();
        if (head && bloodSpawnPoint.y < 1.35) {
          bloodSpawnPoint.y = zombie.group.position.y + (zombie.isCrawler ? 0.38 : 1.62);
        }
        spawnParticles(bloodSpawnPoint, head ? 14 : 7, 'blood', head ? 1.45 : 1);
        if (head || ev.penetrated) {
          spawnParticles(bloodSpawnPoint, head ? 7 : 4, 'bloodMist', 0.65, shotDir);
        }
        spawnDamageNumber(bloodSpawnPoint, dmg, head);
        flashCrosshair(killed ? 'kill' : 'hit');
        traceEnd = hitPoint;
        lastShotEvents.push({ kind: 'zombie', part, multiplier: zone.multiplier, dmg, killed, penetrated: ev.penetrated });
      } else if (ev.kind === 'world') {
        spawnDecal(ev.point, ev.normal, ev.material);
        const pKind = ev.material === 'metal' ? 'spark' : ev.material === 'wood' ? 'wood' : 'concrete';
        spawnParticles(ev.point, ev.material === 'metal' ? 6 : 5, pKind, ev.material === 'metal' ? 0.95 : 0.65, ev.normal);
        traceEnd = ev.point;
        lastShotEvents.push({ kind: 'world', material: ev.material, penetrated: ev.penetrated });
      }
    }

    if (traceEnd) {
      spawnTracer(muzzle, traceEnd);
    } else {
      spawnTracer(muzzle, muzzle.clone().addScaledVector(shotDir, 60));
      anyMiss = true;
    }
  }
  window.__lastShotEvents = lastShotEvents;
  // Bloom is caused by this shot and paid for by the next one, so the round
  // the player just aimed always uses the cone they were shown.
  spreadBloom = Math.min(0.05, spreadBloom + def.spread * 0.5);
  if (anyMiss && hud.crossMiss) {
    hud.crossMiss.classList.add('show');
    setTimeout(() => hud.crossMiss.classList.remove('show'), 70);
  }

  if (totalLoaded(ammo, ammo.weapon) <= 0) {
    // Queue deterministic auto-reload bound to the current weapon slot so
    // rapid weapon swapping never triggers a ghost reload on the next gun.
    if (!ammo.reloading) {
      ammo.autoReloadTimer = 0.12;
      ammo.autoReloadWeapon = ammo.weapon;
    }
  }
}

/**
 * Alt-fire: one cooldown, five different questions. A burst is queued and
 * fired by the simulation step so it cannot outrun the frame clock.
 */
function altFire() {
  if (!game.running || game.paused || game.over || game.shopOpen || photo.active) return;
  if (ammo.reloading) return;
  const def = weaponDef();
  const alt = ALT_FIRE[def.id];
  if (!alt) return;
  if (ammo.altCooldown > 0) {
    showHint(`${alt.name} \u00b7 ${ammo.altCooldown.toFixed(1)}S`, 900);
    return;
  }
  if (totalLoaded(ammo, ammo.weapon) <= 0) { audio.dryFire(); startReload(); return; }

  if (def.id === 'pistol' || def.id === 'smg') {
    const loaded = totalLoaded(ammo, ammo.weapon);
    const need = def.id === 'pistol' ? 2 : 4;
    if (loaded < need) { audio.dryFire(); startReload(); return; }
    ammo.burstLeft = def.id === 'pistol' ? 2 : loaded;
    ammo.burstInterval = def.id === 'pistol' ? 0.075 : 0.052;
    ammo.burstTimer = 0;
    ammo.burstOpts = { spreadMul: def.id === 'pistol' ? 0.4 : 0.8 };
    ammo.altCooldown = alt.cooldown;
    showHint(alt.name, 1000);
    return;
  }
  if (def.id === 'shotgun') {
    ammo.lastShot = performance.now() / 1000;
    if (!fireRound({ slug: true, pellets: 1, damageMul: 5, spreadMul: 0.34 })) return;
    ammo.altCooldown = alt.cooldown;
    showHint('SLUG \u00b7 ONE ROUND', 1000);
    return;
  }
  if (def.id === 'rifle') {
    ammo.steadyTimer = 3.2;
    ammo.altCooldown = alt.cooldown;
    showHint('STEADY BREATH \u00b7 3.2S', 1200);
    return;
  }
  ammo.bipodTimer = 6;
  ammo.altCooldown = alt.cooldown;
  showHint('BIPOD DEPLOYED \u00b7 HOLD STILL', 1400);
}

function damageFalloff(def, distance) {
  if (distance <= def.falloffStart) return 1;
  if (distance >= def.falloffEnd) return def.falloffMin;
  const t = (distance - def.falloffStart) / (def.falloffEnd - def.falloffStart);
  return 1 - t * (1 - def.falloffMin);
}

// ---------------------------------------------------------------- melee
// Melee is always available and free to swing, but each blade has a limited
// life. When a tool wears out it is replaced with a fresh one of the same tier
// so the close-range answer never disappears mid-fight.
let wornMeleeHintUntil = 0;
function swingMelee() {
  if (!game.running || game.paused || game.over) return;
  if (ammo.meleeCooldown > 0) return;
  if (interruptReloadState(ammo)) updateAmmoHud();

  const melee = MELEE_TIERS[game.meleeTier] || MELEE_TIERS[0];
  const combo = nextMeleeCombo(ammo, game.elapsed);
  ammo.meleeCooldown = melee.cooldown * combo.cooldownMul;

  viewModel.swing(combo.step);
  audio.melee();

  const eye = new THREE.Vector3();
  const dir = new THREE.Vector3();
  camera.getWorldPosition(eye);
  camera.getWorldDirection(dir);

  let hits = 0;
  let guardBroken = false;
  for (const z of zombies) {
    if (!z.alive) continue;
    const arc = isTargetInMeleeArc(player.pos, dir, z.group.position, z.radius, melee.range, melee.halfAngle);
    if (!arc.hit) continue;

    // Solid concrete/metal cover blocks swings through walls
    const wall = rayWorld(eye, new THREE.Vector3(arc.dirX, 0, arc.dirZ), arc.dist);
    if (wall && !wall.penetrable && wall.distance < arc.dist - 0.1) continue;

    // Blades scale gently with the wave, plus 3-hit combo multiplier (1.0x -> 1.15x -> 1.75x cleave).
    const dmg = melee.damage * combo.damageMul * (1 + Math.min(1.2, game.wave * 0.03));
    const at = z.group.position.clone();
    at.y = z.isCrawler ? 0.35 : (combo.step === 2 ? 1.68 : 1.15);
    const swingDir = new THREE.Vector3(arc.dirX, 0, arc.dirZ);
    z.takeDamage(dmg, combo.step === 2 ? 'head' : 'body', makeContext(), combo.step === 2 ? 'head' : null, at, swingDir);
    z.group.position.x += arc.dirX * MELEE_KNOCKBACK * combo.knockbackMul;
    z.group.position.z += arc.dirZ * MELEE_KNOCKBACK * combo.knockbackMul;
    resolveCircle(world.colliders, z.group.position, z.radius);
    z.flinch = Math.max(z.flinch, combo.step === 2 ? 1.4 : 1.0);
    z.staggerTimer = Math.max(z.staggerTimer || 0, combo.staggerSec);

    if (combo.breaksGuard && (z.isBoss || z.type === 'brute')) {
      z.abilityWindup = 0;
      z.attackTimer = Math.max(z.attackTimer || 0, 0.9);
      guardBroken = true;
    }

    spawnParticles(at, combo.step === 2 ? 14 : 10, 'blood', combo.step === 2 ? 1.45 : 1.25);
    spawnDamageNumber(at, dmg, combo.step === 2);
    hits++;
  }

  // Consume durability ONLY when a swing actually connects (no drain on missed swings).
  const wear = applyMeleeWear(ammo.meleeUses, melee.maxUses, hits);
  ammo.meleeUses = wear.uses;
  if (wear.replaced) {
    viewModel.setMelee(game.meleeTier);
    viewModel.setMeleeWear(0);
    if (performance.now() > wornMeleeHintUntil) {
      showHint(`${melee.name} BLADE WORN \u2014 REPLACED`, 1400);
      wornMeleeHintUntil = performance.now() + 1500;
    }
  } else {
    viewModel.setMeleeWear(wear.wearRatio);
  }
  updateAmmoHud();

  if (hits) {
    player.shake = Math.min(0.7, player.shake + (combo.step === 2 ? 0.24 : 0.16));
    flashCrosshair('kill');
    audio.meleeHit(combo.step === 2);
    if (guardBroken) showHint('CLEAVE \u2014 GUARD BROKEN!', 1000);
  }
  window.__lastMeleeResult = { step: combo.step, name: combo.name, hits, wearRatio: wear.wearRatio, guardBroken };
}

/** Defensive shove / kick (`Space + Right Click`): pushes back closing zombies. */
function defensiveShove() {
  if (!game.running || game.paused || game.over) return;
  if (ammo.shoveCooldown > 0 || player.stamina < 12) return;
  if (interruptReloadState(ammo)) updateAmmoHud();

  ammo.shoveCooldown = 0.95;
  player.stamina = Math.max(0, player.stamina - 18);
  viewModel.shove();
  audio.shove();
  player.shake = Math.min(0.45, player.shake + 0.1);

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  let pushed = 0;
  for (const z of zombies) {
    if (!z.alive) continue;
    const arc = isTargetInMeleeArc(player.pos, dir, z.group.position, z.radius, 2.35, 0.72);
    if (!arc.hit) continue;

    const pushDist = z.isBoss ? 1.1 : 2.3;
    z.group.position.x += arc.dirX * pushDist;
    z.group.position.z += arc.dirZ * pushDist;
    resolveCircle(world.colliders, z.group.position, z.radius);
    z.takeDamage(18, 'body', makeContext());
    z.flinch = Math.max(z.flinch, 1.35);
    z.staggerTimer = Math.max(z.staggerTimer || 0, 0.85);
    z.attackTimer = Math.max(z.attackTimer || 0, 0.75);
    pushed++;
  }
  if (pushed) flashCrosshair('hit');
  window.__lastShoveResult = { pushed };
  return pushed;
}

// ---------------------------------------------------------------- acid & environmental hazards (Day 10)
// Spitter projectiles: a lobbed glob with its own gravity, trail, swept CCD and persistent acid puddles.
const acidParticleMat = new THREE.MeshBasicMaterial({ color: 0x9dff3d });
const acidShotMat = new THREE.MeshStandardMaterial({
  color: 0xaaff4d, emissive: 0x6cff1a, emissiveIntensity: 2.8, roughness: 0.3, toneMapped: false,
});
const acidShotGeo = new THREE.IcosahedronGeometry(0.16, 1);
const acidShots = [];
for (let i = 0; i < 10; i++) {
  const mesh = new THREE.Mesh(acidShotGeo, acidShotMat);
  mesh.visible = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  acidShots.push({ mesh, vel: new THREE.Vector3(), life: 0 });
}

const acidPuddles = [];
const gasClouds = [];
const acidPuddleGeo = new THREE.CircleGeometry(1, 24);
const acidPuddleMat = new THREE.MeshBasicMaterial({
  color: 0x4df51b,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
});
const acidPuddleMeshes = [];
for (let i = 0; i < 20; i++) {
  const mesh = new THREE.Mesh(acidPuddleGeo, acidPuddleMat.clone());
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.026;
  mesh.visible = false;
  scene.add(mesh);
  acidPuddleMeshes.push(mesh);
}

function spawnAcidPuddle(pos) {
  const puddle = createAcidPuddle(pos);
  acidPuddles.push(puddle);
  const mesh = acidPuddleMeshes.find((m) => !m.visible) || acidPuddleMeshes[0];
  mesh.position.set(pos.x, 0.026, pos.z);
  mesh.scale.set(puddle.radius, puddle.radius, 1);
  mesh.material.opacity = 0.72;
  mesh.visible = true;
  puddle._mesh = mesh;
  return puddle;
}

function spawnGasCloud(pos) {
  const cloud = createGasCloud(pos);
  gasClouds.push(cloud);
  spawnParticles(pos, 35, 'acid', 2.8);
  return cloud;
}

function spitAcid(zombie) {
  const shot = acidShots.find((s) => s.life <= 0) || acidShots[0];
  const from = zombie.group.position.clone();
  from.y = 1.2 * (zombie.def.scale || 1);
  const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.0, player.pos.z);
  const dist = Math.max(2, from.distanceTo(target));
  const speed = 18;
  const flight = Math.max(0.32, dist / speed);

  shot.mesh.position.copy(from);
  shot.mesh.visible = true;
  shot.vel.copy(target).sub(from).divideScalar(flight);
  // Compensate the arc: gravity pulls the glob down over the flight time.
  shot.vel.y += 0.5 * 22 * flight;
  shot.life = flight + 1.4;
  audio.spit();
}

function updateAcid(dt) {
  for (const s of acidShots) {
    if (s.life <= 0) continue;
    s.life -= dt;
    s.mesh.rotation.x += dt * 7;
    s.mesh.rotation.y += dt * 5;
    if (Math.random() < 0.35) spawnParticles(s.mesh.position, 1, 'acid', 0.22);

    const prevPos = s.mesh.position.clone();
    const ccd = stepAcidProjectileCCD({
      from: prevPos,
      vel: s.vel,
      dt,
      gravity: 22,
      colliders: world.colliders,
      playerPos: player.pos,
      playerChestHeight: 0.95,
      playerRadius: 0.45,
    });

    s.mesh.position.copy(ccd.nextPos);
    s.vel.copy(ccd.nextVel);

    let burst = false;
    let burstPos = ccd.nextPos.clone();

    if (ccd.hit) {
      burst = true;
      burstPos = ccd.point ? ccd.point.clone() : ccd.nextPos.clone();
      if (ccd.hitType === 'player') {
        damagePlayer(13 * (game.damageScale || 1), null);
        player.vel.x += s.vel.x * 0.06;
        player.vel.z += s.vel.z * 0.06;
      }
    }

    if (burst || s.life <= 0) {
      spawnParticles(burstPos, 9, 'acid', 0.7);
      spawnAcidPuddle(burstPos);
      s.life = 0;
      s.mesh.visible = false;
    }
  }
}

function updateHazards(dt) {
  player.inAcidPuddle = false;
  player.inToxicGas = false;
  player.hazardSpeedMul = 1.0;

  for (let i = acidPuddles.length - 1; i >= 0; i--) {
    const p = acidPuddles[i];
    updateAcidPuddle(p, dt, player, zombies, {
      audio,
      damagePlayer: (dmg) => damagePlayer(dmg, null),
    });
    if (p._mesh) {
      p._mesh.scale.set(p.radius, p.radius, 1);
      const remain = p.duration - p.elapsed;
      p._mesh.material.opacity = remain < 0.8 ? (remain / 0.8) * 0.72 : 0.72;
      if (Math.random() < 0.22) {
        spawnParticles(new THREE.Vector3(p.pos.x + (Math.random() - 0.5) * p.radius, 0.05, p.pos.z + (Math.random() - 0.5) * p.radius), 1, 'acid', 0.15);
      }
    }
    if (!p.active) {
      if (p._mesh) p._mesh.visible = false;
      acidPuddles.splice(i, 1);
    }
  }

  for (let i = gasClouds.length - 1; i >= 0; i--) {
    const c = gasClouds[i];
    updateGasCloud(c, dt, player, {
      audio,
      damagePlayer: (dmg) => damagePlayer(dmg, null),
    });
    if (Math.random() < 0.3) {
      spawnParticles(new THREE.Vector3(c.pos.x + (Math.random() - 0.5) * c.radius, c.pos.y + (Math.random() - 0.5) * 0.8, c.pos.z + (Math.random() - 0.5) * c.radius), 2, 'acid', 0.6);
    }
    if (!c.active) {
      gasClouds.splice(i, 1);
    }
  }
}

function triggerBarrelChainReaction(origin, radius, damage) {
  if (!world.barrels || !world.barrels.length) return;
  const res = evaluateChainReaction({
    origin,
    blastRadius: radius,
    blastDamage: damage,
    barrels: world.barrels,
    zombies,
    colliders: world.colliders,
    ctx: makeContext(),
  });

  for (const b of res.triggeredBarrels) {
    explodeBarrel(b);
  }

  for (const z of res.triggeredBloaters) {
    if (!z.chainDetonated) {
      z.chainDetonated = true;
      setTimeout(() => { bloaterBurst(z); }, 80);
    }
  }
}

function explodeBarrel(barrel) {
  if (audio && typeof audio.explosion === 'function') audio.explosion(panFor(barrel.pos), barrel.pos.distanceTo(player.pos));
  player.shake = Math.min(1.4, player.shake + 0.6);
  spawnParticles(barrel.pos, 32, barrel.type === 'fuel' ? 'spark' : 'acid', 1.8);
  const cfg = barrel.type === 'fuel' ? HAZARD_CONFIG.barrels.fuel : HAZARD_CONFIG.barrels.biohazard;

  if (barrel.type === 'fuel') {
    spawnFirePool(barrel.pos, { radius: cfg.fireRadius, poolDuration: cfg.fireDuration, dps: 34, burnDuration: 3.0, burnDps: 15 });
  } else {
    spawnAcidPuddle(barrel.pos);
    spawnGasCloud(barrel.pos);
  }

  // Radial damage to player
  const pDist = barrel.pos.distanceTo(player.pos);
  if (pDist <= cfg.blastRadius) {
    const wall = rayWorld(barrel.pos, new THREE.Vector3().subVectors(player.pos, barrel.pos).normalize(), pDist);
    if (!wall || wall.distance >= pDist - 0.25) {
      damagePlayer(Math.round(cfg.peakDamage * (1 - pDist / cfg.blastRadius)), null);
    }
  }

  // Secondary blast propagation
  triggerBarrelChainReaction(barrel.pos, cfg.blastRadius, cfg.peakDamage);
}

// ---------------------------------------------------------------- tactical ordnance & throwables (Day 6)
let pipeBombLures = [];
const firePools = [];

// Trajectory arc visualization
const trajectoryMaxPoints = 28;
const trajectoryPositions = new Float32Array(trajectoryMaxPoints * 3);
const trajectoryGeo = new THREE.BufferGeometry();
trajectoryGeo.setAttribute('position', new THREE.BufferAttribute(trajectoryPositions, 3));
const trajectoryMat = new THREE.LineBasicMaterial({
  color: 0x66ff66,
  transparent: true,
  opacity: 0.75,
});
const trajectoryLine = new THREE.Line(trajectoryGeo, trajectoryMat);
trajectoryLine.visible = false;
trajectoryLine.frustumCulled = false;
scene.add(trajectoryLine);

function updateTrajectoryLine(points) {
  if (!points || points.length === 0) {
    trajectoryLine.visible = false;
    return;
  }
  const posAttr = trajectoryGeo.attributes.position;
  const count = Math.min(points.length, trajectoryMaxPoints);
  for (let i = 0; i < count; i++) {
    posAttr.setXYZ(i, points[i].x, points[i].y, points[i].z);
  }
  for (let i = count; i < trajectoryMaxPoints; i++) {
    const last = points[count - 1];
    posAttr.setXYZ(i, last.x, last.y, last.z);
  }
  posAttr.needsUpdate = true;
  trajectoryGeo.setDrawRange(0, count);
  trajectoryLine.visible = true;
}

function hideTrajectoryLine() {
  trajectoryLine.visible = false;
}

// 12-slot pooled throwable meshes supporting Frag, Molotov, and Pipe Bomb
const grenadePool = [];
for (let i = 0; i < 12; i++) {
  const group = new THREE.Group();
  group.visible = false;
  group.frustumCulled = false;

  // 1. Frag grenade mesh
  const fragMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x39412c, roughness: 0.55, metalness: 0.35 })
  );

  // 2. Molotov cocktail mesh
  const molotovMesh = new THREE.Group();
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.048, 0.22, 10),
    new THREE.MeshStandardMaterial({ color: 0x994411, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.88 })
  );
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.024, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0x994411, roughness: 0.2, metalness: 0.1 })
  );
  neck.position.y = 0.14;
  const cloth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.012, 0.07, 6),
    new THREE.MeshBasicMaterial({ color: 0xffaa33 })
  );
  cloth.position.y = 0.19;
  molotovMesh.add(bottle, neck, cloth);

  // 3. Pipe bomb mesh with blinking red siren LED
  const pipeMesh = new THREE.Group();
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 0.24, 10),
    new THREE.MeshStandardMaterial({ color: 0x777c82, roughness: 0.45, metalness: 0.7 })
  );
  pipe.rotation.z = Math.PI / 2;
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2222 })
  );
  led.position.y = 0.05;
  const light = new THREE.PointLight(0xff2222, 0, 5);
  pipeMesh.add(pipe, led, light);

  group.add(fragMesh, molotovMesh, pipeMesh);
  scene.add(group);

  grenadePool.push({
    mesh: group,
    fragMesh,
    molotovMesh,
    pipeMesh,
    light,
    type: 'frag',
    def: THROWABLE_TYPES.frag,
    vel: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    fuse: 0,
    beepTimer: 0,
    lightTimer: 0,
    live: false,
  });
}

function setupThrowableVisuals(g, type) {
  g.fragMesh.visible = type === 'frag';
  g.molotovMesh.visible = type === 'molotov';
  g.pipeMesh.visible = type === 'pipeBomb';
  if (g.light) g.light.intensity = 0;
}

function cycleThrowable(direction = 1) {
  const types = ['frag', 'molotov', 'pipeBomb'];
  const curIdx = types.indexOf(player.activeThrowable || 'frag');
  const nextIdx = (curIdx + direction + types.length) % types.length;
  player.activeThrowable = types[nextIdx];
  player.grenades = player.throwables ? (player.throwables[player.activeThrowable] || 0) : player.grenades;
  const def = THROWABLE_TYPES[player.activeThrowable];
  showHint(`${def.name} SELECTED`, 1200);
  audio.weaponSwap();
  updateAmmoHud();
}

function startCookingThrowable() {
  if (!game.running || game.paused || game.over) return;
  const activeType = player.activeThrowable || 'frag';
  const count = player.throwables ? (player.throwables[activeType] || 0) : player.grenades;
  if (count <= 0) {
    showHint(`NO ${THROWABLE_TYPES[activeType].shortName}S \u2014 SUPPLY DEPOT [B]`, 1600);
    audio.dryFire();
    return;
  }
  if (player.cookingState && player.cookingState.isCooking) return;

  player.cookingState = createCookState(activeType);
  audio.pinPull();
  updateAmmoHud();
}

function releaseCookedThrowable() {
  if (!player.cookingState || !player.cookingState.isCooking) return;
  const activeType = player.activeThrowable || 'frag';
  const result = releaseCookState(player.cookingState);
  player.cookingState = null;
  hideTrajectoryLine();

  if (result.detonatedInHand) {
    detonateInHand(activeType);
    return;
  }

  doThrowThrowable(activeType, result.fuse);
}

function throwGrenade(forcedType = null) {
  if (!game.running || game.paused || game.over) return;
  const activeType = forcedType || player.activeThrowable || 'frag';
  const count = player.throwables ? (player.throwables[activeType] || 0) : player.grenades;
  if (count <= 0) {
    showHint(`NO ${THROWABLE_TYPES[activeType].shortName}S \u2014 SUPPLY DEPOT [B]`, 1600);
    audio.dryFire();
    return;
  }

  if (player.cookingState && player.cookingState.isCooking) {
    releaseCookedThrowable();
  } else {
    doThrowThrowable(activeType, THROWABLE_TYPES[activeType].fuse);
  }
}

function detonateInHand(type) {
  const at = player.pos.clone();
  at.y += 1.2;
  explodeGrenade(at, type);
  damagePlayer(65, null);
  player.shake = Math.min(2.0, player.shake + 1.4);
  audio.explosion(0, 0);
  if (player.throwables) {
    player.throwables[type] = Math.max(0, (player.throwables[type] || 0) - 1);
    player.grenades = player.throwables[player.activeThrowable];
  } else {
    player.grenades = Math.max(0, player.grenades - 1);
  }
  updateAmmoHud();
}

function doThrowThrowable(type, fuse) {
  const def = THROWABLE_TYPES[type] || THROWABLE_TYPES.frag;
  if (player.throwables) {
    player.throwables[type] = Math.max(0, (player.throwables[type] || 0) - 1);
    player.grenades = player.throwables[player.activeThrowable];
  } else {
    player.grenades = Math.max(0, player.grenades - 1);
  }

  const g = grenadePool.find((x) => !x.live) || grenadePool[0];
  g.type = type;
  g.def = def;
  setupThrowableVisuals(g, type);

  const dir = new THREE.Vector3();
  camera.getWorldPosition(g.mesh.position);
  camera.getWorldDirection(dir);
  g.mesh.position.addScaledVector(dir, 0.55);

  g.vel.copy(dir).multiplyScalar(def.throwSpeed).addScaledVector(player.vel, 0.35);
  g.vel.y += def.upwardVel;
  g.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
  g.fuse = fuse;
  g.live = true;
  g.beepTimer = 0;
  g.lightTimer = 0;
  g.mesh.visible = true;

  if (type === 'pipeBomb') {
    audio.pipeBombBeep(0, 0);
  } else {
    audio.pinPull();
  }
  updateAmmoHud();
}

function spawnFirePool(at, def) {
  const pool = createFirePool(at, def);

  const ringGeo = new THREE.RingGeometry(0.2, 1.0, 20);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff5511,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(ringGeo, ringMat);
  mesh.position.set(at.x, 0.04, at.z);

  const light = new THREE.PointLight(0xff6611, 45, 9.0);
  light.position.set(at.x, 0.5, at.z);

  scene.add(mesh);
  scene.add(light);

  firePools.push({
    pool,
    mesh,
    light,
    active: true,
    particleTimer: 0,
  });
}

function updateActiveFirePools(dt) {
  for (let i = firePools.length - 1; i >= 0; i--) {
    const entry = firePools[i];
    if (!entry.active) {
      scene.remove(entry.mesh);
      scene.remove(entry.light);
      firePools.splice(i, 1);
      continue;
    }

    updateFirePool(
      entry.pool,
      dt,
      zombies,
      player.pos,
      (z, dmg, burnDur, burnDps) => {
        z.takeDamage(dmg, 'body', makeContext());
        if (z.ignite) z.ignite(burnDur, burnDps);
        spawnParticles(z.group.position, 1, 'spark', 0.8);
      },
      (pDmg) => {
        damagePlayer(pDmg, null);
      }
    );

    const scale = entry.pool.radius;
    entry.mesh.scale.set(scale, 1, scale);
    entry.light.intensity = 35 + Math.sin(performance.now() * 0.015) * 12;

    entry.particleTimer -= dt;
    if (entry.particleTimer <= 0) {
      entry.particleTimer = 0.09;
      const rx = (Math.random() - 0.5) * entry.pool.radius * 1.6;
      const rz = (Math.random() - 0.5) * entry.pool.radius * 1.6;
      const firePoint = new THREE.Vector3(entry.pool.pos.x + rx, 0.15, entry.pool.pos.z + rz);
      spawnParticles(firePoint, 2, 'spark', 1.0);
    }

    if (!entry.pool.active) {
      entry.active = false;
    }
  }
}

function updateActivePipeBombLures() {
  pipeBombLures = [];
  for (const g of grenadePool) {
    if (g.live && g.type === 'pipeBomb') {
      pipeBombLures.push({
        pos: g.mesh.position,
        lureRadius: g.def.lureRadius || 22.0,
        active: true,
      });
    }
  }
}

function explodeGrenade(at, type = 'frag', def = null) {
  const d = def || THROWABLE_TYPES[type] || THROWABLE_TYPES.frag;

  if (type === 'molotov') {
    audio.molotovShatter(panFor(at));
    spawnFirePool(at, d);
    shakeSystem.addExplosionShake(player.pos.distanceTo(at), d.radius * 2.2, 0.85);
    player.shake = shakeSystem.trauma;
    muzzleLight.position.copy(at);
    muzzleLight.intensity = 80;
    muzzleLightTimer = 0.25;
    spawnParticles(at, 25, 'spark', 1.8);
    return;
  }

  const blastDist = player.pos.distanceTo(at);
  audio.explosion(panFor(at), blastDist);
  shakeSystem.addExplosionShake(blastDist, d.radius * 2.8, type === 'pipeBomb' ? 1.6 : 1.35);
  player.shake = shakeSystem.trauma;
  muzzleLight.position.copy(at);
  muzzleLight.intensity = type === 'pipeBomb' ? 160 : 120;
  muzzleLightTimer = 0.22;
  spawnParticles(at, type === 'pipeBomb' ? 45 : 30, 'spark', 2.4);

  const radius = d.radius;
  const baseDmg = d.damage;
  const minDmg = d.minDamage;

  for (const z of zombies) {
    if (!z.alive) continue;
    const zPos = z.group.position;
    const dist = zPos.distanceTo(at);
    if (dist > radius) continue;

    // Solid concrete barrier occlusion check (Day 6 bug fix)
    const occluded = isExplosionOccluded(at, zPos, world.colliders);
    if (occluded) continue; // Direct blast wave absorbed by solid wall!

    const blast = calculateExplosionDamage(at, zPos, baseDmg, minDmg, radius, false);
    const dmg = blast.damage;
    const point = zPos.clone();
    point.y = 1.0;
    z.takeDamage(dmg, 'body', makeContext());
    spawnDamageNumber(point, dmg, false);

    const push = new THREE.Vector3(zPos.x - at.x, 0, zPos.z - at.z);
    if (push.lengthSq() > 1e-4) push.normalize();
    z.group.position.addScaledVector(push, blast.falloff * (type === 'pipeBomb' ? 2.4 : 1.6));
    resolveCircle(world.colliders, z.group.position, z.radius);
    z.flinch = 1.2;
    z.staggerTimer = Math.max(z.staggerTimer || 0, 0.6);

    // Explosive close-proximity leg severing / crawler conversion (Day 8)
    if (!z.isBoss && z.type !== 'brute' && !z.isCrawler && blast.falloff > 0.65) {
      severZombieLimb(z, Math.random() < 0.5 ? 'legL' : 'legR', point, push, makeContext());
    }
  }

  // Player self-damage with solid barrier occlusion check
  const playerEye = player.pos.clone();
  playerEye.y += 1.0;
  const selfDist = playerEye.distanceTo(at);
  const reach = radius * 0.85;

  if (selfDist < reach) {
    const playerOccluded = isExplosionOccluded(at, playerEye, world.colliders);
    if (!playerOccluded) {
      const selfDmg = Math.round((type === 'pipeBomb' ? 52 : 38) * (1 - selfDist / reach));
      damagePlayer(selfDmg, null);
    }
  }
}

function updateGrenades(dt) {
  // 1. In-hand fuse cooking & trajectory arc
  if (player.cookingState && player.cookingState.isCooking) {
    updateCookState(player.cookingState, dt);
    if (Math.random() < 0.35) audio.fuseSizzle(0);

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = player.pos.clone();
    origin.y += 1.4;
    const def = player.cookingState.def;
    const arcPts = computeTrajectoryArc(origin, dir, def.throwSpeed, def.upwardVel, def.gravity, world.colliders);
    updateTrajectoryLine(arcPts);

    if (player.cookingState.detonatedInHand) {
      detonateInHand(player.cookingState.typeId);
      player.cookingState = null;
      hideTrajectoryLine();
    }
    updateAmmoHud();
  } else {
    hideTrajectoryLine();
  }

  // 2. Airborne & bouncing throwables with Continuous Collision Detection (CCD)
  for (const g of grenadePool) {
    if (!g.live) continue;

    const result = stepThrowablePhysics(
      { pos: g.mesh.position, vel: g.vel, rot: g.mesh.rotation, spin: g.spin, def: g.def, radius: 0.1 },
      dt,
      world.colliders,
      0.08
    );

    if (g.def.shattersOnImpact && (result.groundHit || result.wallHit)) {
      g.live = false;
      g.mesh.visible = false;
      explodeGrenade(g.mesh.position.clone(), g.type, g.def);
      continue;
    }

    if (result.groundHit && (result.impactSpeed > 1.8 || Math.abs(g.vel.y) > 0.6)) {
      audio.grenadeBounce();
    }

    // Pipe bomb lure beacon pulse
    if (g.type === 'pipeBomb') {
      g.beepTimer = (g.beepTimer || 0) - dt;
      if (g.beepTimer <= 0) {
        g.beepTimer = g.def.beepInterval || 0.26;
        const pan = panFor(g.mesh.position);
        audio.pipeBombBeep(pan, g.def.fuse - g.fuse);
        if (g.light) {
          g.light.intensity = 35;
          g.lightTimer = 0.08;
        }
      }
      if (g.light && g.lightTimer > 0) {
        g.lightTimer -= dt;
        if (g.lightTimer <= 0) g.light.intensity = 0;
      }
    }

    g.fuse -= dt;
    if (g.fuse <= 0) {
      g.live = false;
      g.mesh.visible = false;
      if (g.light) g.light.intensity = 0;
      explodeGrenade(g.mesh.position.clone(), g.type, g.def);
    }
  }

  // 3. Active fire pools & lures
  updateActiveFirePools(dt);
  updateActivePipeBombLures();
}

const tmpRight = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const tmpWallDir = new THREE.Vector3();
const tmpUpFallback = new THREE.Vector3(1, 0, 0);
/**
 * Nudges an aim point sideways using circular Gaussian / Golden-Angle sampling.
 * Working on the target plane keeps every pellet converging where the crosshair
 * points, while avoiding rectangular clamping and vertical-aim NaNs.
 */
function jitterPoint(point, dir, radius, pelletIndex, totalPellets = 1) {
  if (radius <= 1e-5) return point.clone();
  const refUp = Math.abs(dir.y) > 0.98 ? tmpUpFallback : camera.up;
  tmpRight.crossVectors(dir, refUp).normalize();
  tmpUp.crossVectors(tmpRight, dir).normalize();
  const { dx, dy } = sampleCircularSpread(radius, pelletIndex, totalPellets);
  return point.clone()
    .addScaledVector(tmpRight, dx)
    .addScaledVector(tmpUp, dy);
}

// True when a point sits inside a solid volume (building, wreck, wall).
function pointBlocked(x, y, z) {
  for (const c of world.colliders) {
    const h = c.height === undefined ? 4 : c.height;
    if (y > h) continue;
    if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
  }
  return false;
}

function refreshHitMeshes() {
  hitMeshCache = [];
  for (const z of zombies) {
    if (z.alive) hitMeshCache.push(...z.hitMeshes);
  }
  hitMeshesDirty = false;
}

function rayZombiesAll(origin, dir, maxDist) {
  if (hitMeshesDirty) refreshHitMeshes();
  if (!hitMeshCache.length) return [];
  // Raycasting needs current world matrices; in normal play the renderer has
  // just written them, but a shot fired in the same frame as a spawn has not.
  for (const z of zombies) {
    if (z.alive) z.group.updateMatrixWorld(true);
  }
  raycaster.set(origin, dir);
  raycaster.far = maxDist;
  const hits = raycaster.intersectObjects(hitMeshCache, false);
  return resolveZombieRayHits(hits);
}

function rayZombies(origin, dir, maxDist) {
  const hits = rayZombiesAll(origin, dir, maxDist);
  return hits.length ? hits[0] : null;
}

function rayWorld(origin, dir, maxDist) {
  const hits = rayWorldAll(origin, dir, world.colliders, maxDist);
  return hits.length ? hits[0] : null;
}

function flashCrosshair(kind) {
  hud.cross.style.setProperty('--gap', '2px');
  hud.cross.classList.add(kind);
  setTimeout(() => {
    hud.cross.classList.remove('hit');
    hud.cross.classList.remove('kill');
  }, 110);
}

// ---------------------------------------------------------------- waves
// The ramp adds pressure, not bullet sponges: counts, speed and bite climb
// while every enemy keeps the same hit points, so headshots stay one-shot.
// The curve itself lives in waves.js so it can be printed and checked.
function startWave(n) {
  const mods = game.mods || {};
  const plan = wavePlan(n);
  // Challenge overrides: a contract can change the boss cadence or force the
  // spitter mix without touching the shared curve.
  if (mods.bossEvery) {
    const hadBoss = plan.boss;
    plan.boss = plan.wave % mods.bossEvery === 0;
    // A boss the curve did not plan for still has to pay for itself with
    // escort bodies, or a twin-boss contract doubles the wave for free.
    if (plan.boss && !hadBoss) plan.count = Math.max(5, Math.round(plan.count * 0.62));
  }
  if (mods.stalkers) {
    plan.spitterChance = 0.28;
    plan.runnerChance = Math.max(0.3, plan.runnerChance);
    plan.bruteChance = Math.max(0.1, plan.bruteChance);
    plan.walkerChance = Math.max(0.05, 1 - plan.bruteChance - plan.runnerChance - plan.spitterChance);
  }

  // Endless-plus: past wave 20 a permanent stack lands every fifth wave. It
  // raises speed and tightens the delivery gap rather than adding bodies, so
  // the 40-body cap and one-shot headshots stay intact.
  const endless = endlessEffects(plan.wave);
  game.endlessStacks = endless.stacks;
  if (endless.count > 0) {
    plan.speedScale *= endless.speedMul;
    plan.spacing *= endless.spacingMul;
  }

  game.plan = plan;
  game.wave = plan.wave;
  game.speedScale = plan.speedScale * (mods.enemySpeedMul || 1);
  game.damageScale = plan.damageScale;

  game.spawnQueue = [];
  game.spawnTimer = 0;
  game.boss = null;
  game.hordeTimer = plan.horde ? 1.4 : 9 + Math.random() * 9;
  game._lurkersSeenThisWave = 0;

  // The boss lands first, so it is the thing you see instead of one body in a
  // crowd. Its escort follows at the wave's normal spacing.
  if (plan.boss) {
    const boss = bossFor(plan.wave);
    game.spawnQueue.push({ type: boss.base, delay: 0.6, lead: true, boss: true, bossId: boss.id });
  }

  const spacing = plan.spacing * (mods.spawnMul || 1);
  for (let i = 0; i < plan.count; i++) {
    // A surge opens with a burst, so the spike is visible in the first two
    // seconds instead of reading as the wave quietly finishing early.
    const lead = plan.surge && i < plan.burstLead;
    game.spawnQueue.push({
      type: rollType(plan),
      delay: lead ? 0.08 : 0.2 + (i - (plan.surge ? plan.burstLead : 0)) * spacing,
      lead,
      boss: false,
    });
  }

  // Convert the absolute build delays into the gap each body waits after the
  // one before it. A horde pack is inserted mid-delivery, and with absolute
  // delays its tiny delay became the baseline for the next scheduled body:
  // the last two walkers of a wave then waited the whole wave length again.
  let prevDelay = 0;
  for (const entry of game.spawnQueue) {
    entry.gap = Math.max(0.05, entry.delay - prevDelay);
    prevDelay = entry.delay;
  }

  world.setBlackout(!!mods.alwaysBlackout || plan.modifier === 'blackout');
  audio.waveAlarm(plan.surge || plan.boss);
  if (endless.stacks.length) showHint(`ENDLESS-PLUS \u00b7 ${endless.stacks.join(' / ')}`, 3600);
  else if (plan.modifier !== 'none') showHint(`WAVE MODIFIER: ${plan.modifier.toUpperCase()}`, 3200);
  const ramp = `Speed +${Math.round((game.speedScale - 1) * 100)}% \u00b7 bite +${Math.round((plan.damageScale - 1) * 100)}%.`;
  const mix = plan.wave >= 1 ? expectedMix(plan) : null;
  const mixLine = mix && mix.walkers + mix.runners + mix.brutes + mix.spitters + mix.bloaters + mix.lurkers > 0
    ? `~${mix.walkers} walkers ${mix.runners ? mix.runners + ' runners ' : ''} ${mix.brutes ? mix.brutes + ' brutes ' : ''} ${mix.spitters ? mix.spitters + ' spitters ' : ''} ${mix.bloaters ? mix.bloaters + ' bloaters ' : ''} ${mix.lurkers ? mix.lurkers + ' lurkers' : ''}`
    : '';
  const head = plan.wave === 1
    ? 'Keep them off you. One magazine is enough.'
    : plan.wave === 2
      ? 'More footsteps. Watch the cross streets.'
      : plan.boss
        ? `BOSS + ${plan.count} escort. ${ramp}`
        : plan.horde
          ? `${plan.count} inbound, then a flanking pack. ${ramp}`
          : plan.surge
            ? `${plan.count} inbound \u00b7 ${plan.burstLead} at once. ${ramp}`
            : `${plan.count} inbound. ${mixLine ? mixLine + '. ' : ''}${ramp}`;
  const kicker = plan.surge ? 'SURGE WAVE' : plan.boss ? 'BOSS WAVE' : 'WAVE';
  showBanner(kicker, String(plan.wave), head, plan.surge || plan.boss ? 3400 : 3000);
  updateWaveHud();
}

function spawnAt(type, position) {
  const z = new Zombie(type, position, rng);
  scene.add(z.group);
  zombies.push(z);
  hitMeshesDirty = true;

  // Teach the player what they are facing without a tutorial wall: the first
  // lurker of a wave announces itself out loud and on screen.
  if (type === 'lurker' && !game.mods && game.wave >= 2) {
    game._lurkersSeenThisWave = (game._lurkersSeenThisWave || 0) + 1;
    if (game._lurkersSeenThisWave === 1) {
      showHint(`NEW THREAT: LURKERS \u2014 FAST, LOW, HARD TO SPOT`, 2400);
    }
  }

  return z;
}

// A spawn point that is not inside a building or a wreck, so the zombie is
// never born wedged in geometry it cannot walk out of.
function freeSpotNear(base, radius) {
  const blocked = (x, z) => {
    for (const c of world.colliders) {
      if (c.height !== undefined && c.height < 0.6) continue;
      if (x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius) return true;
    }
    return false;
  };

  for (let i = 0; i < 24; i++) {
    const x = base.x + (Math.random() - 0.5) * 12;
    const z = base.z + (Math.random() - 0.5) * 12;
    if (!blocked(x, z)) return new THREE.Vector3(x, 0, z);
  }
  // Last resort: step toward the middle of the road until something is free.
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    const x = base.x * (1 - t) + (Math.random() - 0.5) * 3;
    const z = base.z * (1 - t) + (Math.random() - 0.5) * 3;
    if (!blocked(x, z)) return new THREE.Vector3(x, 0, z);
  }
  return base.clone();
}

function spawnFromQueue() {
  if (!game.spawnQueue.length) return;
  const entry = game.spawnQueue.shift();

  let chosen = null;
  if (entry.lead) {
    // Surge waves arrive from anywhere, including behind you.
    for (let i = 0; i < 4; i++) {
      const p = world.spawnPoints[Math.floor(Math.random() * world.spawnPoints.length)];
      if (p.distanceTo(player.pos) > 18) { chosen = p; break; }
    }
  }

  if (!chosen) {
    // Otherwise spawn at a ring point the player is not staring directly at.
    let bestScore = -Infinity;
    for (const p of world.spawnPoints) {
      const d = p.distanceTo(player.pos);
      if (d < 16) continue;
      const toZ = new THREE.Vector3().subVectors(p, player.pos).normalize();
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const score = -Math.abs(d - 32) - toZ.dot(forward) * 6 + Math.random() * 4;
      if (score > bestScore) { bestScore = score; chosen = p; }
    }
  }

  const pos = freeSpotNear(chosen || world.spawnPoints[0], 1.1);
  const z = spawnAt(entry.type, pos);
  z.speed *= game.speedScale || 1;
  z.damage = Math.round(z.damage * (game.damageScale || 1));
  z.state = 'chase';
  if (entry.boss) {
    // Resolve from the wave, not the queued id, so the tier growth built into
    // bossFor() survives the trip through the spawn queue.
    const boss = bossFor(game.wave);
    z.isBoss = true;
    z.bossName = boss.name;
    z.maxHp = Math.round(z.maxHp * boss.hpMul);
    z.hp = z.maxHp;
    z.damage = Math.round(z.damage * boss.dmgMul);
    z.speed *= boss.speedMul;
    z.group.scale.multiplyScalar(boss.scaleMul);
    z.radius *= boss.scaleMul;
    z.attackCooldown = 1.2;
    z.bossAbility = boss.ability || '';
    // The boss opens on its signature move rather than biting, so the fight
    // announces itself before it can corner you.
    z.abilityCd = 2.2;
    game.boss = z;
    showBanner('BOSS CONTACT', boss.name, boss.line, 3400);
    audio.bossAlarm();
  }
}

function aliveCount() {
  let n = 0;
  for (const z of zombies) if (z.alive) n++;
  return n;
}

// Stereo position of a world point relative to where the player is looking.
function panFor(worldPos) {
  return computeSpatialAudio(player.pos, player.yaw, worldPos).pan;
}

// Contract score multiplier. It was declared on every challenge but nothing
// ever read it, so the harder contracts were paying the same as a normal run.
function scoreMulFor() {
  return (game.mods && game.mods.scoreMul) || 1;
}

/**
 * Bloaters rupture when they die. The horde's own bodies become the hazard:
 * a kill next to the pack turns into damage on the pack, so the correct play
 * is to drop them at range instead of letting one reach the barricade.
 */
function bloaterBurst(zombie) {
  const def = zombie.def || {};
  const at = zombie.group.position.clone();
  at.y = 0.9;
  const radius = def.burstRadius || 4.6;
  const peak = def.burstDamage || 95;

  audio.bloaterBurst();
  player.shake = Math.min(1.3, player.shake + 0.5);
  spawnParticles(at, 26, 'acid', 1.5);
  spawnParticles(at, 10, 'spark', 1.1);
  burstLight.position.copy(at);
  burstLight.intensity = 70;
  burstLightTimer = 0.3;

  // Day 10: Toxic Gas Cloud release
  spawnGasCloud(at);

  // Day 10: Bloater damage to player with true 3D Euclidean distance & catwalk / elevation occlusion check
  const playerDmg = calculateBloaterBurstDamage({
    bloaterPos: at,
    targetPos: new THREE.Vector3(player.pos.x, player.pos.y + 0.95, player.pos.z),
    blastRadius: radius,
    peakDamage: peak,
    colliders: world.colliders,
  });

  if (playerDmg.inRange && !playerDmg.occluded && playerDmg.damage > 0) {
    const toPlayer = new THREE.Vector3(player.pos.x - at.x, 0, player.pos.z - at.z).normalize();
    player.vel.x += toPlayer.x * 3.2;
    player.vel.z += toPlayer.z * 3.2;
    damagePlayer(playerDmg.damage, null);
  }

  // Damage nearby zombies & trigger cascading bloater chain reactions
  for (const other of zombies) {
    if (!other.alive || other === zombie) continue;
    const d = other.group.position.distanceTo(at);
    if (d > radius) continue;
    const t = 1 - d / radius;
    const dmg = peak * (0.35 + 0.65 * t);
    const died = other.takeDamage(dmg, 'body', makeContext());
    other.flinch = 1;
    if (died && other.type === 'bloater' && !other.chainDetonated) {
      other.chainDetonated = true;
      setTimeout(() => { bloaterBurst(other); }, 80);
    }
  }

  // Day 10: Chain reaction with explosive barrels
  triggerBarrelChainReaction(at, radius, peak);
}

/**
 * GATEKEEPER ground slam. A short ring around the boss that hits through the
 * horde but not through a building, so cover and distance both work.
 */
function bossShockwave(zombie) {
  const at = zombie.group.position.clone();
  at.y = 0.35;
  const radius = 6.2;

  audio.bossSlam();
  player.shake = Math.min(1.6, player.shake + 0.85);
  spawnParticles(at, 26, 'spark', 1.5);
  spawnParticles(at, 10, 'blood', 0.8);
  burstLight.position.set(at.x, 1.1, at.z);
  burstLight.intensity = 65;
  burstLightTimer = 0.28;

  const dx = player.pos.x - at.x;
  const dz = player.pos.z - at.z;
  const self = Math.hypot(dx, dz);
  if (self > radius || self < 1e-3) return;
  const dir = new THREE.Vector3(dx / self, 0, dz / self);
  const wall = rayWorld(new THREE.Vector3(at.x, 1.0, at.z), dir, self);
  if (wall && wall.distance < self - 0.25) return;
  player.vel.x += dir.x * 8.5;
  player.vel.z += dir.z * 8.5;
  damagePlayer(Math.round(zombie.damage * 1.1 * (1 - (self / radius) * 0.45)), zombie);
}

/** Boss ability audio: a tell before the move, an impact when it commits. */
function bossCry(zombie, kind) {
  const pan = panFor(zombie.group.position);
  if (kind === 'windup') audio.bossTell(pan);
  else audio.bossRelease(pan);
}

function creditsFor(zombie) {
  if (zombie.isBoss) return 280;
  if (zombie.type === 'bloater') return 65;
  if (zombie.type === 'brute') return 58;
  if (zombie.type === 'spitter') return 36;
  if (zombie.type === 'lurker') return 26;
  if (zombie.type === 'runner') return 22;
  return 14;
}

function onZombieKilled(zombie, head) {
  game.kills++;
  if (head) game.headshots++;
  game.score += Math.round(zombie.def.score * (head ? 1.6 : 1) * scoreMulFor());
  const payout = creditsFor(zombie) + (head ? 3 : 0);
  game.credits += payout;
  game.creditsEarned = (game.creditsEarned || 0) + payout;
  if (zombie.isBoss) game.bossesKilled = (game.bossesKilled || 0) + 1;
  audio.kill();
  world.addDecal(zombie.group.position.x, zombie.group.position.z, 0.55 + Math.random() * 0.35);
  if (zombie.def && zombie.def.explode) bloaterBurst(zombie);

  const roll = Math.random();
  const at = zombie.group.position.clone();
  at.y = 0.35;
  const mods = game.mods || {};
  if (zombie.isBoss) {
    // A boss always pays out: a weapon cache and a fresh plate.
    addPickup('weapon', at);
    addPickup('armor', at.clone().add(new THREE.Vector3(1.1, 0, 0.4)));
    addPickup('health', at.clone().add(new THREE.Vector3(-1.1, 0, -0.4)));
    if (game.meleeTier < MELEE_TIERS.length - 1) addPickup('blade', at.clone().add(new THREE.Vector3(0, 0, 1.2)));
    // The next boss's answer: a guaranteed frag, never left to a roll.
    addPickup('grenade', at.clone().add(new THREE.Vector3(0, 0, -1.2)));
    // A boss is also the reliable place to find a missing attachment.
    if (missingAttachmentGuns().length) addPickup('attachment', at.clone().add(new THREE.Vector3(0, 0, 1.9)));
  } else if (zombie.type === 'spitter' && roll < 0.4) {
    addPickup('ammo', at);
  } else if (roll < 0.2) addPickup('ammo', at);
  else if (roll < 0.3) addPickup('health', at);
  else if (roll < 0.38 && !mods.noArmor) addPickup('armor', at);
  else if (roll < 0.4 && game.meleeTier < MELEE_TIERS.length - 1) addPickup('blade', at);
  else if (roll < 0.42 && !ammo.unlocked[WEAPONS.length - 1]) addPickup('weapon', at);
  else if (roll < 0.47 && missingAttachmentGuns().length) addPickup('attachment', at);

  updateWaveHud();
}

// ---------------------------------------------------------------- pickups
const pickupGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
const PICKUP_STYLE = {
  ammo: { color: 0xd8b25a, emissive: 0xffcc66, light: 0xffcc66 },
  health: { color: 0x5aff8a, emissive: 0x2aff6a, light: 0x66ff9c },
  armor: { color: 0x6ab8ff, emissive: 0x2a7dff, light: 0x5aa8ff },
  blade: { color: 0xd6e0e8, emissive: 0x9fb4c8, light: 0xbcd0e4 },
  weapon: { color: 0xd08cff, emissive: 0x8a3cff, light: 0xb46bff },
  grenade: { color: 0x7b8c4a, emissive: 0xb6d24a, light: 0xa8c44a },
  attachment: { color: 0xffd166, emissive: 0xffa51f, light: 0xffc247 },
};
// Colourblind-safe palette: no red/green pair carries meaning on its own, and
// every colour also differs in brightness.
const PICKUP_STYLE_CB = {
  ammo: { color: 0xe8eef2, emissive: 0xbfd4e6, light: 0xd6e3ee },
  health: { color: 0x63d6ff, emissive: 0x2aa8ff, light: 0x74cfff },
  armor: { color: 0xc9a6ff, emissive: 0x8f5cff, light: 0xb388ff },
  blade: { color: 0xffffff, emissive: 0xd8e6f2, light: 0xe6f0fa },
  weapon: { color: 0xffc857, emissive: 0xff9a1f, light: 0xffb44d },
  grenade: { color: 0x9be7ff, emissive: 0x39b6ff, light: 0x8bd8ff },
  attachment: { color: 0xffe08a, emissive: 0xffb020, light: 0xffcf6a },
};
const pickupMats = {};
function addPickup(kind, position) {
  const palette = settings.colorblind ? PICKUP_STYLE_CB : PICKUP_STYLE;
  const style = palette[kind] || palette.ammo || PICKUP_STYLE.ammo;
  const cacheKey = settings.colorblind ? `${kind}:cb` : kind;
  if (!pickupMats[cacheKey]) {
    pickupMats[cacheKey] = new THREE.MeshStandardMaterial({
      color: style.color, emissive: style.emissive, emissiveIntensity: 2.2, roughness: 0.4,
    });
  }
  const mesh = new THREE.Mesh(pickupGeo, pickupMats[cacheKey]);
  mesh.position.copy(position);
  mesh.position.y = 0.45;
  scene.add(mesh);
  let light = null;
  const activeLights = pickups.reduce((acc, p) => acc + (p.light ? 1 : 0), 0);
  if (activeLights < 6) {
    light = new THREE.PointLight(style.light, 3.4, 4.5, 2);
    light.position.copy(mesh.position);
    scene.add(light);
  }
  pickups.push({ kind, mesh, light, life: 32, spin: Math.random() * 3 });
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.life -= dt;
    p.mesh.rotation.y += dt * 2.4;
    p.mesh.position.y = 0.45 + Math.sin(performance.now() * 0.002 + p.spin) * 0.08;

    pickupProbe.set(player.pos.x, 0.45, player.pos.z);
    const d = p.mesh.position.distanceTo(pickupProbe);
    if (d < 1.35) {
      if (p.kind === 'ammo') {
        const def = weaponDef();
        if (def.reserveMax === Infinity) {
          // Pistol is already infinite: top up the other guns instead.
          ammo.reserve[1] = Math.min(WEAPONS[1].reserveMax, ammo.reserve[1] + 32);
          ammo.reserve[2] = Math.min(WEAPONS[2].reserveMax, ammo.reserve[2] + 8);
          ammo.reserve[3] = Math.min(WEAPONS[3].reserveMax, ammo.reserve[3] + 20);
        } else {
          ammo.reserve[ammo.weapon] = Math.min(def.reserveMax, ammo.reserve[ammo.weapon] + Math.ceil(magSizeFor(def) * 1.5));
        }
        showHint('AMMO RECOVERED', 1200);
      } else if (p.kind === 'health') {
        player.health = Math.min(player.maxHealth, player.health + 35);
        showHint('FIELD DRESSING +35', 1200);
      } else if (p.kind === 'armor') {
        player.armor = Math.min(player.maxArmor, player.armor + 55);
        showHint('PLATE CARRIER +55', 1200);
      } else if (p.kind === 'grenade') {
        player.grenades = Math.min(player.grenadeMax, player.grenades + 1);
        showHint('FRAG +1', 1200);
      } else if (p.kind === 'blade') {
        const nextTier = Math.min(MELEE_TIERS.length - 1, game.meleeTier + 1);
        if (nextTier !== game.meleeTier) {
          game.meleeTier = nextTier;
          ammo.meleeUses = 0;
          viewModel.setMelee(nextTier);
          viewModel.setMeleeWear(0);
          const tier = MELEE_TIERS[nextTier];
          showBanner('BLADE RECOVERED', tier.name, `${tier.damage} damage per swing. Press V.`, 2800);
        } else {
          player.stamina = 100;
          showHint('BLADE FLAT \u2014 NOTHING BETTER YET', 1400);
        }
      } else if (p.kind === 'weapon') {
        // The first locked gun in the table is the one this cache unlocks, so
        // the slot it reports is the one that actually got filled.
        const lockedIndex = WEAPONS.findIndex((w, i) => w.locked && !ammo.unlocked[i]);
        if (lockedIndex >= 0) {
          ammo.unlocked[lockedIndex] = true;
          ammo.mag[lockedIndex] = Math.max(0, magSizeFor(WEAPONS[lockedIndex]) - 1);
          ammo.chambered[lockedIndex] = true;
          ammo.reloadStage[lockedIndex] = RELOAD_STAGE.READY;
          ammo.reserve[lockedIndex] = WEAPONS[lockedIndex].reserveMax;
          if (weaponAvailable(lockedIndex)) selectWeapon(lockedIndex);
          showBanner('WEAPON CACHE', WEAPONS[lockedIndex].name,
            `Recovered. Press ${WEAPONS[lockedIndex].key}.`, 3000);
        } else {
          ammo.reserve[1] = Math.min(WEAPONS[1].reserveMax, ammo.reserve[1] + 64);
          ammo.reserve[2] = Math.min(WEAPONS[2].reserveMax, ammo.reserve[2] + 16);
          ammo.reserve[3] = Math.min(WEAPONS[3].reserveMax, ammo.reserve[3] + 30);
          showHint('CACHE SALVAGED \u2014 AMMO', 1400);
        }
      } else if (p.kind === 'attachment') {
        const missing = missingAttachmentGuns();
        if (missing.length) {
          const pick = missing[Math.floor(Math.random() * missing.length)];
          ammo.attachment[pick.gun] = pick.id;
          showBanner('ATTACHMENT FOUND', pick.name,
            `${WEAPONS[pick.gun].name} \u00b7 ${pick.desc}`, 3200);
          updateAmmoHud();
        } else {
          game.credits += 75;
          game.creditsEarned = (game.creditsEarned || 0) + 75;
          showHint('SPARE PARTS SALVAGED +75 CR', 1400);
        }
      }
      audio.pickup();
      scene.remove(p.mesh);
      scene.remove(p.light);
      pickups.splice(i, 1);
      updateAmmoHud();
      updateVitalsHud();
      continue;
    }

    if (p.life <= 0) {
      scene.remove(p.mesh);
      scene.remove(p.light);
      pickups.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- player
function damagePlayer(amount, from) {
  if (!game.running || game.paused || game.over) return;
  if (amount <= 0) return;
  // Short grace window so a ring of zombies cannot delete you in one frame.
  if (player.iframes > 0) return;
  player.iframes = 0.32;
  // Armour eats most of the hit before vitals see it, then breaks away.
  let incoming = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, incoming * ARMOR_ABSORB);
    player.armor = Math.max(0, player.armor - absorbed);
    incoming -= absorbed;
  }
  player.health -= incoming;
  player.lastDamage = game.elapsed;
  shakeSystem.addDamageShake(Math.min(0.55, 0.38 + incoming * 0.005));
  player.shake = shakeSystem.trauma;
  audio.hurt();

  // Tell the player where it came from: an arc that points at the attacker and
  // a damage cue panned to that side. Surges open from random angles, so
  // without this a hit from behind is unreadable.
  if (from) {
    const dx = from.group.position.x - player.pos.x;
    const dz = from.group.position.z - player.pos.z;
    const attacker = Math.atan2(dx, dz);
    const forward = Math.atan2(-Math.sin(player.yaw), -Math.cos(player.yaw));
    let rel = attacker - forward;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    hud.dmgDir.style.transform = `rotate(${(-rel * 180) / Math.PI}deg)`;
    hud.dmgDir.classList.add('show');
    dmgDirTimer = 1.15;
    audio.impact(Math.sin(-rel));
  }

  hud.hurt.style.opacity = '0.85';
  setTimeout(() => { hud.hurt.style.opacity = '0'; }, 140);
  updateVitalsHud();

  if (from) {
    // Shove the player away from the attacker.
    const dx = player.pos.x - from.group.position.x;
    const dz = player.pos.z - from.group.position.z;
    const len = Math.hypot(dx, dz) || 1;
    player.vel.x += (dx / len) * (from.type === 'brute' ? 5.2 : 2.2);
    player.vel.z += (dz / len) * (from.type === 'brute' ? 5.2 : 2.2);
  }

  if (player.health <= 0) {
    player.health = 0;
    endRun();
  }
}

function makeContext(forZombiePos = null) {
  const camDir = new THREE.Vector3();
  if (camera) camera.getWorldDirection(camDir);
  return {
    audio,
    scene,
    playerPos: player.pos,
    playerVel: player.vel,
    flashlightActive: !!(flashlight && flashlight.visible),
    camPos: camera ? camera.position : player.pos,
    camDir: camDir,
    damagePlayer: (dmg, from) => damagePlayer(dmg, from),
    colliders: world.colliders,
    zombies,
    nav,
    debrisPool,
    arterialPool,
    spawnBlood: (pos, count, kind = 'blood') => spawnParticles(pos, count, kind),
    // Nightfall changes how lurkers close; the flag lives on the world.
    blackout: world.blackout,
    damage: (dmg, from) => damagePlayer(dmg, from),
    spit: (z) => spitAcid(z),
    shockwave: (z) => bossShockwave(z),
    abilityCry: (z, kind) => bossCry(z, kind),
    panOf: (worldPos) => panFor(worldPos),
    onDeath: (z, part) => onZombieKilled(z, part === 'head'),
    lurePos: forZombiePos ? findActiveLureTarget(pipeBombLures, forZombiePos) : null,
  };
}

function updatePlayer(dt) {
  player.iframes = Math.max(0, player.iframes - dt);
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));

  let ix = 0, iz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) iz += 1;
  if (keys['KeyS'] || keys['ArrowDown']) iz -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) ix += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
  ix += input.touchMove.x;
  iz -= input.touchMove.y;

  const inputLen = Math.hypot(ix, iz);
  if (inputLen > 1) { ix /= inputLen; iz /= inputLen; }

  const wantsSprint = (keys['ShiftLeft'] || keys['ShiftRight']) && iz > 0.1 && player.stamina > 1 && !player.ads && !player.inToxicGas;
  player.sprinting = wantsSprint;
  if (wantsSprint && interruptReloadState(ammo)) updateAmmoHud();

  const baseSpeed = player.ads ? 2.6 : 4.6;
  let speed = wantsSprint ? 7.3 : baseSpeed;
  if (player.hazardSpeedMul) speed *= player.hazardSpeedMul;

  const targetVX = (forward.x * iz + right.x * ix) * speed;
  const targetVZ = (forward.z * iz + right.z * ix) * speed;

  const accel = player.grounded ? 12 : 3.2;
  player.vel.x += (targetVX - player.vel.x) * Math.min(1, accel * dt);
  player.vel.z += (targetVZ - player.vel.z) * Math.min(1, accel * dt);

  if (wantsSprint) {
    player.stamina = Math.max(0, player.stamina - 20 * dt);
  } else {
    player.stamina = Math.min(player.maxStamina, player.stamina + 16 * (1 + upgrades.stamina * 0.15) * dt);
  }

  // Gravity + jumping.
  player.vel.y -= 19 * dt;
  player.pos.y += player.vel.y * dt;
  if (player.pos.y <= 0) {
    player.pos.y = 0;
    player.vel.y = 0;
    player.grounded = true;
  }

  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  resolveCircle(world.colliders, player.pos, player.radius);

  // BODIES ARE SOLID. Without this you can walk straight through a zombie,
  // which reads as a ghost hitbox the moment the horde closes in.
  for (const z of zombies) {
    if (!z.alive) continue;
    const dx = player.pos.x - z.group.position.x;
    const dz = player.pos.z - z.group.position.z;
    const minD = player.radius + z.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 > 1e-6 && d2 < minD * minD) {
      const d = Math.sqrt(d2);
      const push = minD - d;
      player.pos.x += (dx / d) * push;
      player.pos.z += (dz / d) * push;
    }
  }
  resolveCircle(world.colliders, player.pos, player.radius);
  world.setShadowFocus(player.pos.x, player.pos.z);

  // City bound (the perimeter wall sits just outside it).
  const distFromCenter = Math.hypot(player.pos.x, player.pos.z);
  if (distFromCenter > world.bounds) {
    const k = world.bounds / distFromCenter;
    player.pos.x *= k;
    player.pos.z *= k;
  }

  // Head bob + footsteps.
  const planarSpeed = Math.hypot(player.vel.x, player.vel.z);
  if (player.grounded && planarSpeed > 0.6) {
    player.bob += dt * (5.4 + planarSpeed * 0.95);
    player.stepAccum += planarSpeed * dt;
    const stepEvery = wantsSprint ? 2.5 : 3.4;
    if (player.stepAccum > stepEvery) {
      player.stepAccum = 0;
      audio.footstep(wantsSprint);
    }
  } else {
    player.stepAccum = 0;
  }

  // Health regen after a lull (regenerates up to 50% maxHealth so mistakes matter)
  const regenCap = Math.round(player.maxHealth * 0.5);
  if (game.elapsed - player.lastDamage > 7.0 && player.health < regenCap && player.health > 0) {
    player.health = Math.min(regenCap, player.health + 3.2 * dt);
  }

  // ADS FOV blend with exponential decay (smooth on 60/120/144/240Hz).
  // Sniper rifle (slot 4, index 3) gets 2.2x optical magnification zoom.
  const isSniper = ammo.weapon === 3;
  const wantFov = player.ads ? (isSniper ? settings.fov * 0.44 : settings.fov * 0.74) : settings.fov;
  camera.fov += (wantFov - camera.fov) * (1 - Math.exp(-14 * dt));
  camera.updateProjectionMatrix();

  // Synchronize ADS HUD / body classes
  document.body.classList.toggle('ads-active', !!player.ads);
  document.body.classList.toggle('scoped', !!(player.ads && isSniper));

  updateCamera(dt, planarSpeed);
}

function updateCamera(dt, planarSpeed) {
  const bobAmp = player.grounded ? Math.min(0.055, planarSpeed * 0.0075) : 0;
  const bobY = Math.sin(player.bob * 2) * bobAmp;
  const bobX = Math.cos(player.bob) * bobAmp * 0.7;

  const shake = shakeSystem.update(dt, settings.shake);
  player.shake = shakeSystem.trauma;

  camera.position.set(
    player.pos.x + bobX * 0.5 + (Math.random() - 0.5) * shake * 0.09,
    player.pos.y + player.height + bobY + (Math.random() - 0.5) * shake * 0.09,
    player.pos.z
  );
  // Recover camera recoil via per-weapon harmonic spring simulation (Day 7)
  const springRecoil = recoilSpring.update(dt);
  recoil.pitch = springRecoil.pitch;
  recoil.yaw = springRecoil.yaw;

  camera.rotation.set(
    player.pitch + recoil.pitch + (Math.random() - 0.5) * shake * 0.05,
    player.yaw + recoil.yaw,
    Math.sin(player.bob) * bobAmp * 0.35 + (Math.random() - 0.5) * shake * 0.04
  );
  // Shooting reads the camera's world matrix, which otherwise only updates at
  // render time; keep it fresh so a shot always matches what is on screen.
  camera.updateMatrixWorld(true);
}

// ---------------------------------------------------------------- HUD
let hudTimer = 0;
let dmgDirTimer = 0;
function updateVitalsHud() {
  const hp = Math.max(0, player.health);
  hud.hpFill.style.width = `${(hp / player.maxHealth) * 100}%`;
  hud.hpValue.textContent = String(Math.ceil(hp));
  hud.stamFill.style.width = `${(player.stamina / player.maxStamina) * 100}%`;
  if (hud.armorRow) {
    hud.armorRow.hidden = player.armor <= 0;
    hud.armorFill.style.width = `${(player.armor / player.maxArmor) * 100}%`;
    hud.armorValue.textContent = String(Math.ceil(player.armor));
  }
  document.body.classList.toggle('lowhp', hp > 0 && hp < 35);
  hud.blood.style.opacity = hp < 45 ? String((1 - hp / 45) * 0.85) : '0';
}

function updateAmmoHud() {
  const def = weaponDef();
  hud.weaponName.textContent = def.name;
  hud.ammoMag.textContent = String(totalLoaded(ammo, ammo.weapon));
  hud.ammoReserve.textContent = def.reserveMax === Infinity ? '\u221e' : String(ammo.reserve[ammo.weapon]);
  hud.ammoPanel.classList.toggle('reloading', ammo.reloading);
  const activeTh = player.activeThrowable || 'frag';
  const thCount = player.throwables ? (player.throwables[activeTh] || 0) : player.grenades;
  player.grenades = thCount;
  if (hud.grenadeCount) hud.grenadeCount.textContent = String(thCount);
  if (hud.throwableLabel) {
    const tDef = THROWABLE_TYPES[activeTh];
    hud.throwableLabel.textContent = tDef ? tDef.shortName : 'FRAG';
  }
  if (player.cookingState && player.cookingState.isCooking) {
    if (hud.cookBar) hud.cookBar.style.display = 'block';
    const pct = Math.max(0, Math.min(100, (player.cookingState.fuseRemaining / player.cookingState.totalFuse) * 100));
    if (hud.cookFill) hud.cookFill.style.width = `${pct}%`;
  } else {
    if (hud.cookBar) hud.cookBar.style.display = 'none';
  }
  const alt = ALT_FIRE[def.id];
  if (hud.altName) hud.altName.textContent = alt ? alt.name : '';
  if (hud.altState) {
    hud.altState.textContent = ammo.altCooldown > 0
      ? `${ammo.altCooldown.toFixed(1)}S`
      : alt ? `[${keyLabel(bindFor('altFire'))}]` : '';
    hud.altState.classList.toggle('cooling', ammo.altCooldown > 0);
  }

  // Melee durability is shared across the whole blade tier, not per-gun.
  const melee = game.running ? (MELEE_TIERS[game.meleeTier] || MELEE_TIERS[0]) : null;
  if (melee && melee.maxUses) {
    const max = melee.maxUses;
    const used = Math.min(ammo.meleeUses, max);
    const near = used >= max - 1;
    if (hud.meleeDur) {
      hud.meleeMax.textContent = String(max);
      hud.meleeUses.textContent = String(used);
      hud.meleeDur.hidden = false;
      hud.meleeDur.classList.toggle('worn', near);
    }
    if (hud.meleeDurTouch) {
      hud.meleeDurTouch.textContent = near ? ' ' : ` ${used}/${max} `;
      hud.meleeDurTouch.hidden = false;
    }
  } else {
    if (hud.meleeDur) hud.meleeDur.hidden = true;
    if (hud.meleeDurTouch) hud.meleeDurTouch.hidden = true;
  }

  updateEconomyHud();
}

function updateBossHud() {
  const boss = game.boss;
  if (!boss || !boss.alive) {
    if (hud.boss) hud.boss.classList.remove('show');
    return;
  }
  if (!hud.boss) return;
  hud.boss.classList.add('show');
  hud.bossName.textContent = boss.bossName || 'BOSS';
  hud.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
  hud.bossHp.textContent = `${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`;
}

function updateWaveHud() {
  const surge = !!(game.plan && game.plan.surge);
  // The opening intermission runs at wave 0 internally; showing "WAVE 0" for
  // the first two seconds of a run reads as a bug, so clamp it to one.
  hud.wave.textContent = String(Math.max(1, game.wave));
  hud.surgeBadge.hidden = !surge;
  document.body.classList.toggle('surge', surge);
  hud.kills.textContent = String(game.kills);
  hud.left.textContent = String(aliveCount() + game.spawnQueue.length);
  hud.score.textContent = String(game.score);
  updateEconomyHud();
}

function updateHudTick(dt) {
  audio.setMusicIntensity(musicTarget());
  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = 0.12;
    updateVitalsHud();
    updateWaveHud();
    updateAmmoHud();
    updateBossHud();
    if (ammo.reloading) {
      const def = weaponDef();
      const total = reloadTimeFor(def);
      const pct = total > 0 ? Math.max(0, Math.min(1, 1 - ammo.reloadTimer / total)) : 0;
      hud.reloadFill.style.width = `${pct * 100}%`;
    }
  }
}

// ---------------------------------------------------------------- flow
function startRun(atWave = 0, mods = null, challenge = null) {
  const jumpTo = Number.isFinite(atWave) ? Math.max(0, Math.min(99, Math.round(atWave))) : 0;
  audio.init();
  audio.resume();
  audio.setMuted(!!settings.muted);
  audio.setAmbientLevel(1);
  audio.startMusic();
  audio.setMusicIntensity(0.34);

  for (const z of zombies) scene.remove(z.group);
  zombies.length = 0;
  for (const p of pickups) { scene.remove(p.mesh); scene.remove(p.light); }
  pickups.length = 0;
  for (const p of particles) { p.life = 0; p.mesh.visible = false; }
  for (const d of decals) { d.life = 0; d.mesh.visible = false; }
  for (const t of tracers) { t.life = 0; t.line.visible = false; }
  for (const c of casings) { c.life = 0; c.mesh.visible = false; }
  debrisPool.reset();
  arterialPool.reset();
  // Grenades and acid in flight belong to the old run; without this a live
  // grenade from a run you just lost detonates in the new one.
  for (const s of acidShots) { s.life = 0; s.mesh.visible = false; }
  for (const g of grenadePool) { g.live = false; g.mesh.visible = false; }
  burstLightTimer = 0;
  burstLight.intensity = 0;
  hitMeshesDirty = true;

  player.pos.set(0, 0, 20);
  player.vel.set(0, 0, 0);
  player.yaw = Math.PI;
  player.pitch = -0.02;
  // Progression is per-run: the depot resets alongside the wallet.
  for (const key of Object.keys(upgrades)) upgrades[key] = 0;
  player.maxHealth = Math.round(100 * ((mods && mods.healthMul) || 1));
  player.health = player.maxHealth;
  player.armor = 0;
  player.maxArmor = ARMOR_MAX;
  player.maxStamina = 100;
  player.stamina = 100;
  player.grenades = GRENADE.startCount;
  player.throwables = { frag: 2, molotov: 1, pipeBomb: 1 };
  player.activeThrowable = 'frag';
  player.cookingState = null;
  pipeBombLures = [];
  for (const entry of firePools) {
    scene.remove(entry.mesh);
    scene.remove(entry.light);
  }
  firePools.length = 0;
  recoilSpring.reset();
  shakeSystem.reset();
  player.shake = 0;
  player.grounded = true;
  player.ads = false;
  player.iframes = 0;
  player.lastDamage = -99;
  recoil.pitch = 0;
  recoil.yaw = 0;

  // Attachments are found during the run, never inherited from the last one,
  // and they must be cleared before the magazines are sized.
  ammo.attachment = WEAPONS.map(() => null);
  ammo.mag = WEAPONS.map((w) => Math.max(0, magSizeFor(w) - 1));
  ammo.chambered = WEAPONS.map(() => true);
  ammo.reloadStage = WEAPONS.map(() => RELOAD_STAGE.READY);
  ammo.reserve = WEAPONS.map((w) => (w.reserveMax === Infinity ? Infinity : Math.round(w.reserveMax * 0.7)));
  ammo.unlocked = WEAPONS.map((w) => !w.locked);
  // A contract that pins a weapon also puts it in your hands to begin with.
  if (mods && (mods.weaponLock !== undefined || mods.startWeapon !== undefined)) {
    ammo.unlocked[mods.weaponLock !== undefined ? mods.weaponLock : mods.startWeapon] = true;
  }
  ammo.weapon = mods && mods.startWeapon !== undefined
    ? mods.startWeapon
    : mods && mods.weaponLock !== undefined ? mods.weaponLock : 0;
  ammo.meleeCooldown = 0;
  ammo.meleeUses = 0;
  ammo.comboStep = 0;
  ammo.lastSwingAt = -99;
  ammo.shoveCooldown = 0;
  game.meleeTier = 0;
  viewModel.setMelee(0);
  viewModel.setMeleeWear(0);
  ammo.reloading = false;
  ammo.reloadTimer = 0;
  ammo.reloadTotal = 0;
  ammo.autoReloadTimer = 0;
  ammo.autoReloadWeapon = -1;
  ammo.lastShot = 0;
  ammo.triggerHeld = false;
  ammo.dryFireLatched = false;
  ammo.altCooldown = 0;
  ammo.burstLeft = 0;
  ammo.burstTimer = 0;
  ammo.burstOpts = null;
  ammo.steadyTimer = 0;
  ammo.bipodTimer = 0;
  viewModel.select(ammo.weapon, true);

  game.running = true;
  game.paused = false;
  game.over = false;
  game.wave = 0;
  game.kills = 0;
  game.headshots = 0;
  game.score = 0;
  game.credits = launchCredits;
  game.shopOpen = false;
  shopFromPause = false;
  document.body.classList.remove('shopping', 'paused');
  if (hud.shop) hud.shop.classList.add('hidden');
  game.elapsed = 0;
  game.shots = 0;
  game.hits = 0;
  // Lifetime-of-the-run counters for the career profile: credits actually
  // earned (launch credits do not count) and bosses put down.
  game.creditsEarned = 0;
  game.bossesKilled = 0;
  game.plan = null;
  game.mods = mods || null;
  game.challenge = challenge || null;
  // A weekly contract runs on its own seed, so every ladder entry met the
  // same wave mix. Survival runs get a fresh seed each deploy.
  game.seed = challenge && challenge.kind === 'weekly'
    ? seedForKey(challenge.id)
    : ((Math.random() * 0xffffffff) >>> 0);
  rng = makeRng(game.seed);
  game.endlessStacks = [];
  game.boss = null;
  game.hordeTimer = 0;
  document.body.classList.remove('surge');
  world.setBlackout(false);
  // A launch parameter queues the requested wave; otherwise start from one.
  game.wave = jumpTo > 0 ? jumpTo - 1 : 0;
  game.intermission = jumpTo > 0 ? 0.8 : 2.2;
  game.spawnQueue = [];
  game.spawnTimer = 0;
  game.speedScale = 1;
  game.damageScale = 1;
  if (mods && mods.alwaysBlackout) world.setBlackout(true);

  hud.menu.classList.add('hidden');
  hud.pause.classList.add('hidden');
  hud.over.classList.add('hidden');
  hud.loading.classList.add('hidden');
  document.body.classList.remove('in-menu');
  document.body.classList.add('in-run');

  updateVitalsHud();
  updateAmmoHud();
  updateWaveHud();
  showBanner('OUTBREAK', 'DEAD SIGNAL', 'Hold the relay. They are already coming.', 2600);
  if (!mouseLocked && isTouch) {
    showHint('TOUCH CONTROLS ON', 1600);
  } else if (!mouseLocked) {
    showHint('CLICK TO LOOK \u00b7 MOUSE LOCK UNAVAILABLE', 1600);
  }
  requestLock();
}

function pauseGame() {
  if (!game.running || game.over || game.shopOpen) return;
  game.paused = true;
  document.body.classList.add('paused');
  hud.pause.classList.remove('hidden');
  if (document.pointerLockElement === canvas) {
    suppressLockEvent = true;
    document.exitPointerLock();
  }
  ammo.triggerHeld = false;
  player.ads = false;
  audio.setMusicIntensity(0.18);
}

function resumeGame() {
  if (!game.running || game.shopOpen) return;
  game.paused = false;
  document.body.classList.remove('paused');
  hud.pause.classList.add('hidden');
  audio.resume();
  audio.setMusicIntensity(musicTarget());
  requestLock();
}

function endRun() {
  if (game.over) return;
  game.over = true;
  game.running = false;
  player.ads = false;
  audio.setAmbientLevel(0.25);
  audio.setMusicIntensity(0.14);
  if (document.pointerLockElement === canvas) {
    suppressLockEvent = true;
    document.exitPointerLock();
  }
  document.body.classList.remove('in-run');
  document.body.classList.add('in-menu');

  // Contract result: cleared if the run reached the target wave.
  let challengeLine = '';
  if (game.challenge) {
    const cleared = game.wave >= game.challenge.targetWave;
    if (cleared) {
      const first = markChallengeDone(game.challenge.id);
      challengeLine = first
        ? ` ${game.challenge.name} cleared \u2014 contract logged.`
        : ` ${game.challenge.name} cleared again.`;
    } else {
      challengeLine = ` ${game.challenge.name}: ${game.wave}/${game.challenge.targetWave} waves.`;
    }
    renderChallenges();
  }

  const best = loadBest();
  const score = game.score + (game.challenge && game.wave >= game.challenge.targetWave ? 5000 : 0);
  const isBest = score > best.score;
  if (isBest) saveBest({ wave: game.wave, kills: game.kills, score });
  refreshBestLine();

  el('overWave').textContent = String(game.wave);
  el('overKills').textContent = String(game.kills);
  el('overHeads').textContent = String(game.headshots);
  el('overScore').textContent = String(score);
  // Pellets count as hits but only one shot is fired, so clamp a shotgun
  // pattern from reporting 300% accuracy.
  const accuracy = game.shots > 0 ? Math.min(100, Math.round((game.hits / game.shots) * 100)) : 0;
  el('overAcc').textContent = game.shots > 0 ? `${accuracy}%` : '\u2014';
  el('overBest').textContent = best.score > 0 ? `w${best.wave} ${best.score}` : '\u2014';

  // Career profile: this run joins the record whether it was survived or not.
  const mode = game.challenge ? game.challenge.kind : 'survival';
  const cleared = !!(game.challenge && game.wave >= game.challenge.targetWave);
  recordRun({
    mode,
    wave: game.wave,
    kills: game.kills,
    headshots: game.headshots,
    accuracy,
    credits: game.creditsEarned || 0,
    bosses: game.bossesKilled || 0,
    cleared,
  });
  if (cleared) noteContractClear(mode);
  renderCareer();

  // The weekly ladder is local: best five runs on this contract, with the run
  // seed kept so an entry can be compared like for like.
  let ladderLine = '';
  if (game.challenge && game.challenge.kind === 'weekly') {
    const ladder = recordLadder(game.challenge.id, {
      score, wave: game.wave, kills: game.kills, seed: game.seed,
    });
    ladderLine = ladder.rank
      ? ` Weekly ladder #${ladder.rank} \u00b7 seed ${game.seed.toString(16).toUpperCase()}.`
      : '';
    renderChallenges();
  }
  el('overSub').textContent = (isBest
    ? `New personal best. You held until wave ${game.wave}.`
    : `You held until wave ${game.wave}. The relay kept transmitting without you.`) + challengeLine + ladderLine;
  hud.over.classList.remove('hidden');
}

function loadBest() {
  try {
    const raw = localStorage.getItem('deadSignalBest');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.score === 'number') return parsed;
    }
  } catch (err) { /* storage can be blocked */ }
  return { wave: 0, kills: 0, score: 0 };
}

function saveBest(best) {
  try { localStorage.setItem('deadSignalBest', JSON.stringify(best)); } catch (err) { /* ignore */ }
}

function refreshBestLine() {
  const best = loadBest();
  hud.best.textContent = best.score > 0
    ? `wave ${best.wave} \u00b7 ${best.kills} kills \u00b7 ${best.score} pts`
    : 'no run recorded';
}

// ---------------------------------------------------------------- challenges
// The menu shows the contract for today and for this week. Both are derived
// from the calendar date, so they change on their own without a redeploy.
function renderChallenge(kind, prefix) {
  const card = el(`${prefix}Card`);
  if (!card) return;
  const c = challengeFor(kind);
  const nameEl = el(`${prefix}Name`);
  if (nameEl) nameEl.textContent = c.name;
  const descEl = el(`${prefix}Desc`);
  if (descEl) descEl.textContent = c.desc;
  const targetEl = el(`${prefix}Target`);
  if (targetEl) targetEl.textContent = c.targetLabel;
  const stateEl = el(`${prefix}State`);
  if (stateEl) stateEl.textContent = c.done ? 'CLEARED' : 'OPEN';
  card.classList.toggle('done', c.done);
  const btn = el(`${prefix}Btn`);
  if (btn) {
    btn.textContent = c.done ? 'REPLAY' : 'START';
    btn.onclick = () => startRun(0, c.mods, c);
  }
}

// Both "contracts cleared" readouts come from the same set of cleared
// contract ids, so the menu line and the career panel can never disagree.
function renderContractCounts() {
  const total = String(clearedCount());
  const menu = el('challengeCount');
  if (menu) menu.textContent = total;
  const career = el('careerContracts');
  if (career) career.textContent = total;
}

function renderChallenges() {
  renderChallenge('daily', 'daily');
  renderChallenge('weekly', 'weekly');
  renderContractCounts();
  renderWeeklyLadder();
}

// The weekly card carries its local top five, so a replay has something to
// beat even though there is no server behind it.
function renderWeeklyLadder() {
  const host = el('weeklyLadder');
  if (!host) return;
  const weekly = challengeFor('weekly');
  const rows = ladderFor(weekly.id);
  host.textContent = '';
  if (!rows.length) {
    const empty = document.createElement('span');
    empty.className = 'ladder-empty';
    empty.textContent = 'NO RUNS ON THIS CONTRACT';
    host.appendChild(empty);
    return;
  }
  rows.forEach((run, i) => {
    const row = document.createElement('div');
    row.className = 'ladder-row';
    const rank = document.createElement('span');
    rank.textContent = `${i + 1}.`;
    const score = document.createElement('b');
    score.textContent = String(run.score);
    const meta = document.createElement('span');
    meta.textContent = `W${run.wave} \u00b7 ${run.kills}K \u00b7 ${run.seed.toString(16).toUpperCase().slice(0, 6)}`;
    row.append(rank, score, meta);
    host.appendChild(row);
  });
}

// ---------------------------------------------------------------- career
// The persistent layer: totals, best wave per mode, the last ten runs and the
// daily contract streak. It is written at the end of every run, never mid-run.
function renderCareer() {
  const career = loadCareer();
  const set = (id, text) => { const node = el(id); if (node) node.textContent = text; };
  set('careerKills', String(career.kills));
  set('careerHeads', String(career.headshots));
  set('careerBosses', String(career.bosses));
  set('careerRuns', String(career.runs));
  set('careerBest', `S${career.bestWave.survival || 0} \u00b7 D${career.bestWave.daily || 0} \u00b7 W${career.bestWave.weekly || 0}`);
  renderContractCounts();

  const streak = activeStreak();
  const badge = el('careerStreak');
  if (badge) {
    badge.textContent = streak > 0 ? `${streak} DAY STREAK` : 'NO STREAK';
    badge.classList.toggle('live', streak > 0);
  }

  const list = el('careerHistory');
  if (!list) return;
  list.textContent = '';
  if (!career.history.length) {
    const empty = document.createElement('div');
    empty.className = 'career-empty';
    empty.textContent = 'No runs logged yet.';
    list.appendChild(empty);
    return;
  }
  for (const run of career.history) {
    const row = document.createElement('div');
    row.className = run.cleared ? 'career-row cleared' : 'career-row';
    const cells = [
      run.date.slice(5),
      run.mode === 'survival' ? 'SURV' : run.mode.toUpperCase(),
      `W${run.wave}`,
      `${run.kills} K`,
      `${run.accuracy}%`,
      `${run.credits} CR`,
    ];
    for (const text of cells) {
      const cell = document.createElement('span');
      cell.textContent = text;
      row.appendChild(cell);
    }
    list.appendChild(row);
  }
}

// ---------------------------------------------------------------- depot
// The supply depot: credits earned in the run buy weapons, weapon upgrades and
// body upgrades. It pauses the street while it is open, which is the trade for
// being able to use it at any point in a wave.
function shopLevel(item) {
  if (item.weaponIndex !== undefined) return ammo.unlocked[item.weaponIndex] ? 1 : 0;
  if (item.id === 'grenade') return player.grenades;
  if (item.repeat) return 0;
  // The armoury id and the upgrade key differ here, which is why this read has
  // to be explicit: otherwise REINFORCED PLATES never levelled or maxed.
  if (item.id === 'armorcap') return upgrades.armor || 0;
  return upgrades[item.id] || 0;
}

function shopState(item) {
  const level = shopLevel(item);
  const cost = item.repeat ? item.baseCost : itemCost(item, level);
  // A contract that pins the loadout also locks the armoury: buying a gun the
  // contract will not let you hold is credits thrown away.
  const contract = item.weaponIndex !== undefined && !!game.mods
    && game.mods.weaponLock !== undefined && item.weaponIndex !== game.mods.weaponLock;
  const maxed = contract || (item.weaponIndex !== undefined
    ? !!ammo.unlocked[item.weaponIndex]
    : item.id === 'grenade'
      ? player.grenades >= GRENADE.maxCount
      : itemMaxed(item, level));
  return { level, cost, maxed, contract, affordable: game.credits >= cost };
}

function buyItem(item) {
  if (!game.running || game.over) return;
  const state = shopState(item);
  if (state.maxed || !state.affordable) { audio.dryFire(); return; }
  game.credits -= state.cost;
  audio.pickup();

  switch (item.id) {
    case 'ammo':
      for (let i = 0; i < WEAPONS.length; i++) {
        if (WEAPONS[i].reserveMax !== Infinity) ammo.reserve[i] = WEAPONS[i].reserveMax;
      }
      showHint('RESUPPLIED', 1200);
      break;
    case 'medkit':
      player.health = Math.min(player.maxHealth, player.health + 100);
      break;
    case 'armor':
      player.armor = Math.min(player.maxArmor, player.armor + 60);
      break;
    case 'grenade':
      player.grenades = Math.min(GRENADE.maxCount, player.grenades + 1);
      if (player.throwables) {
        const curType = player.activeThrowable || 'frag';
        player.throwables[curType] = Math.min(GRENADE.maxCount, (player.throwables[curType] || 0) + 1);
      }
      break;
    case 'rifle':
    case 'ripper': {
      const idx = item.weaponIndex;
      ammo.unlocked[idx] = true;
      ammo.mag[idx] = Math.max(0, magSizeFor(WEAPONS[idx]) - 1);
      ammo.chambered[idx] = true;
      ammo.reloadStage[idx] = RELOAD_STAGE.READY;
      ammo.reserve[idx] = WEAPONS[idx].reserveMax;
      selectWeapon(idx);
      break;
    }
    case 'health':
      upgrades.health++;
      player.maxHealth += 20;
      player.health = Math.min(player.maxHealth, player.health + 20);
      break;
    case 'armorcap':
      upgrades.armor++;
      player.maxArmor += 25;
      break;
    case 'stamina':
      upgrades.stamina++;
      player.maxStamina = Math.round(100 * (1 + upgrades.stamina * 0.15));
      player.stamina = player.maxStamina;
      break;
    default:
      upgrades[item.id] = (upgrades[item.id] || 0) + 1;
      break;
  }

  // Purchase feedback lives inside the depot: the in-world hint is hidden
  // while the shop owns the screen, so using it here said nothing.
  const msg = el('shopMsg');
  if (msg) msg.textContent = `${item.name} ACQUIRED`;
  updateVitalsHud();
  updateAmmoHud();
  updateWaveHud();
  renderShop();
}

function renderShop() {
  const host = hud.shopItems;
  if (!host) return;
  if (hud.shopCredits) hud.shopCredits.textContent = String(game.credits);
  host.innerHTML = '';

  // Attachment readout: every weapon card the depot would show, in one strip.
  if (hud.attachStrip) {
    hud.attachStrip.textContent = '';
    for (let i = 0; i < WEAPONS.length; i++) {
      const att = ATTACHMENTS.find((a) => a.id === ammo.attachment[i]);
      const row = document.createElement('div');
      row.className = 'attach-row' + (att ? ' found' : '');
      const name = document.createElement('span');
      name.textContent = WEAPONS[i].name;
      const val = document.createElement('b');
      val.textContent = att ? att.name : 'NO ATTACHMENT';
      row.append(name, val);
      hud.attachStrip.appendChild(row);
    }
  }

  for (const section of SHOP_SECTIONS) {
    const title = document.createElement('div');
    title.className = 'shop-section-title';
    title.textContent = section;
    host.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'shop-grid';
    host.appendChild(grid);

    for (const item of SHOP_ITEMS.filter((i) => i.section === section)) {
      const state = shopState(item);
      const card = document.createElement('div');
      card.className = 'shop-item' + (state.maxed ? ' maxed' : state.affordable ? '' : ' poor');

      const name = document.createElement('div');
      name.className = 'shop-name';
      name.textContent = item.name;

      const level = document.createElement('div');
      level.className = 'shop-level';
      if (item.weaponIndex !== undefined) level.textContent = state.contract ? 'CONTRACT LOCK' : state.maxed ? 'OWNED' : 'LOCKED';
      else if (item.id === 'grenade') level.textContent = `${player.grenades} / ${GRENADE.maxCount}`;
      else if (item.repeat) level.textContent = 'CONSUMABLE';
      else level.textContent = `LEVEL ${state.level} / ${item.max}`;

      const desc = document.createElement('div');
      desc.className = 'shop-desc';
      desc.textContent = item.desc;

      const btn = document.createElement('button');
      btn.className = 'shop-buy';
      btn.textContent = state.contract ? 'CONTRACT' : state.maxed ? (item.weaponIndex !== undefined ? 'OWNED' : 'MAXED') : `${state.cost} CR`;
      btn.disabled = state.maxed || !state.affordable;
      btn.addEventListener('click', () => buyItem(item));

      const foot = document.createElement('div');
      foot.className = 'shop-foot';
      foot.appendChild(level);
      foot.appendChild(btn);

      card.appendChild(name);
      card.appendChild(desc);
      card.appendChild(foot);
      grid.appendChild(card);
    }
  }
}

function updateEconomyHud() {
  if (hud.credits) hud.credits.textContent = String(game.credits);
}

// Opening the depot from the pause menu must return there when it closes, not
// drop the player straight back into a wave they had not resumed yet.
let shopFromPause = false;

function openShop() {
  if (!game.running || game.over || !hud.shop || game.shopOpen) return;
  shopFromPause = game.paused;
  game.shopOpen = true;
  game.paused = true;
  ammo.triggerHeld = false;
  player.ads = false;
  if (document.pointerLockElement === canvas) {
    suppressLockEvent = true;
    document.exitPointerLock();
  }
  hud.pause.classList.add('hidden');
  hud.shop.classList.remove('hidden');
  document.body.classList.add('shopping', 'paused');
  const msg = el('shopMsg');
  if (msg) msg.textContent = '';
  renderShop();
}

function closeShop() {
  if (!game.shopOpen) return;
  game.shopOpen = false;
  hud.shop.classList.add('hidden');
  document.body.classList.remove('shopping');
  if (shopFromPause) {
    game.paused = true;
    document.body.classList.add('paused');
    hud.pause.classList.remove('hidden');
    return;
  }
  game.paused = false;
  document.body.classList.remove('paused');
  requestLock();
}

// ---------------------------------------------------------------- systems
function toggleFlashlight() {
  flashlight.visible = !flashlight.visible;
  hud.flashBtn.textContent = flashlight.visible ? 'FLASHLIGHT [F] ON' : 'FLASHLIGHT [F] OFF';
}

function toggleMute() {
  settings.muted = !audio.muted;
  saveSettings();
  audio.setMuted(settings.muted);
  hud.muteBtn.textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON';
}

let lastFrame = performance.now();
let lastHeartbeat = 0;

function stepSimulation(dt) {
  if (!game.running || game.paused || game.over) {
    world.update(dt);
    return;
  }

  game.elapsed += dt;

  navTimer -= dt;
  if (navTimer <= 0) {
    navTimer = 0.35;
    nav.rebuild(player.pos.x, player.pos.z);
  }

  updatePlayer(dt);

  // Weapon state: staged chambered reloads & deterministic auto-reload queue.
  if (ammo.autoReloadTimer > 0) {
    ammo.autoReloadTimer -= dt;
    if (ammo.autoReloadTimer <= 0) {
      const queuedFor = ammo.autoReloadWeapon;
      ammo.autoReloadTimer = 0;
      ammo.autoReloadWeapon = -1;
      if (queuedFor === ammo.weapon && !ammo.reloading) startReload();
    }
  }
  if (ammo.reloading) {
    const def = weaponDef();
    const reloadEvents = tickReloadState(ammo, def, magSizeFor(def), dt);
    if (reloadEvents) {
      for (const ev of reloadEvents) {
        if (ev === 'drop' || ev === 'insert') audio.reloadStep();
        if (ev === 'chamber' || ev === 'complete') audio.reloadEnd();
      }
      updateAmmoHud();
    }
  }
  if (ammo.triggerHeld && weaponDef().auto && !photo.active) tryFire();
  ammo.meleeCooldown = Math.max(0, ammo.meleeCooldown - dt);
  ammo.shoveCooldown = Math.max(0, ammo.shoveCooldown - dt);
  ammo.altCooldown = Math.max(0, ammo.altCooldown - dt);
  ammo.steadyTimer = Math.max(0, ammo.steadyTimer - dt);
  ammo.bipodTimer = Math.max(0, ammo.bipodTimer - dt);
  // A queued burst fires on the frame clock, one round per interval.
  if (ammo.burstLeft > 0) {
    ammo.burstTimer -= dt;
    while (ammo.burstLeft > 0 && ammo.burstTimer <= 0) {
      if (ammo.reloading || !fireRound(ammo.burstOpts || {})) { ammo.burstLeft = 0; break; }
      ammo.burstLeft -= 1;
      ammo.burstTimer += ammo.burstInterval;
      if (ammo.burstLeft > 0 && Math.random() < 0.4) player.shake = Math.min(0.5, player.shake + 0.02);
    }
  }

  spreadBloom = Math.max(0, spreadBloom - dt * 0.05);

  // Zombies.
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    z.update(dt, makeContext(z.group ? z.group.position : null));
    if (z.removed) {
      zombies.splice(i, 1);
      hitMeshesDirty = true;
    }
  }

  // Wave director.
  if (game.intermission > 0) {
    game.intermission -= dt;
    if (game.intermission <= 0) startWave(game.wave + 1);
  } else {
    // Hordes: an unscripted flanking pack, from a random direction at a random
    // moment, so a wave never arrives on a schedule you can memorise.
    if (game.plan && game.plan.wave >= 4 && !game.plan.boss) {
      game.hordeTimer -= dt;
      if (game.hordeTimer <= 0) {
        game.hordeTimer = 12 + Math.random() * 12;
        const room = MAX_WAVE_ENEMIES - (aliveCount() + game.spawnQueue.length);
        const pack = Math.min(Math.max(0, room), 3 + Math.floor(Math.random() * 4) + Math.floor(game.wave / 8));
        if (pack > 0) {
          for (let i = 0; i < pack; i++) {
            game.spawnQueue.unshift({ type: rollType(game.plan), delay: 0.14, gap: 0.14, lead: true, boss: false });
          }
          // The pack is already here, so it must not wait behind the next
          // scheduled body: pull the spawn clock forward to deliver it now.
          game.spawnTimer = Math.min(game.spawnTimer, 0.14);
          showBanner('HORDE INBOUND', `${pack} MORE`, 'They are flanking the relay.', 2400);
          audio.waveAlarm(true);
        }
      }
    }

    if (game.spawnQueue.length) {
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) {
        const entry = game.spawnQueue[0];
        spawnFromQueue();
        // Each entry's delay is absolute from the wave's start, so the wait for
        // the next body is the gap between the two entries. Reusing the later
        // entry's whole delay compounded the spacing and turned every wave into
        // a one-a-minute trickle after the first few arrivals.
        const next = game.spawnQueue[0];
        game.spawnTimer = next ? Math.max(0.05, next.gap !== undefined ? next.gap : next.delay - entry.delay) : 0.5;
      }
    } else if (aliveCount() === 0 && !game.over) {
      game.intermission = 4.5;
      const bonus = Math.round(250 * game.wave * (game.plan && game.plan.surge ? 1.5 : 1) * scoreMulFor());
      const pay = 45 * game.wave + (game.plan && game.plan.boss ? 150 : 0);
      game.score += bonus;
      game.credits += pay;
      game.creditsEarned = (game.creditsEarned || 0) + pay;
      showBanner('WAVE CLEARED', `+${bonus}`, `+${pay} CR \u00b7 press B for the supply depot.`, 2600);
      updateWaveHud();
    }
  }

  // Distant moans between the close ones: the city is still full of them.
  game.moanTimer -= dt;
  if (game.moanTimer <= 0) {
    game.moanTimer = 16 + Math.random() * 26;
    audio.distantMoan();
  }

  updateParticles(dt);
  updateDecals(dt);
  updateTracers(dt);
  updateCasings(dt);
  updateAcid(dt);
  updateHazards(dt);
  updateGrenades(dt);
  updatePickups(dt);
  updateDamageNumbers(dt);
  world.update(dt);

  if (muzzleLightTimer > 0) {
    muzzleLightTimer -= dt;
    muzzleLight.intensity = Math.max(0, muzzleLightTimer / 0.06) * 60;
  } else {
    muzzleLight.intensity = 0;
  }
  if (burstLightTimer > 0) {
    burstLightTimer -= dt;
    burstLight.intensity = Math.max(0, burstLightTimer / 0.3) * 70;
  } else {
    burstLight.intensity = 0;
  }

  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) hud.banner.classList.remove('show');
  }
  if (hintTimer > 0) {
    hintTimer -= dt;
    if (hintTimer <= 0) hud.hint.classList.remove('show');
  }

  // Crosshair spread grows with bloom and movement.
  const spreadPx = 6 + (spreadBloom / 0.05) * 12 + Math.min(10, Math.hypot(player.vel.x, player.vel.z) * 0.9);
  hud.cross.style.setProperty('--gap', `${spreadPx.toFixed(1)}px`);

  // Forward wall proximity check for anti-clipping tactical weapon tuck
  camera.getWorldDirection(tmpWallDir);
  const wallCheckRay = rayWorld(camera.position, tmpWallDir, 1.2);
  const wallDist = wallCheckRay ? wallCheckRay.distance : 99;

  viewModel.update(dt, {
    moving: Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 5),
    sprinting: player.sprinting,
    ads: player.ads,
    reloading: ammo.reloading,
    aspect: camera.aspect,
    mouseDX: lookDx,
    mouseDY: lookDy,
    grounded: player.grounded,
    wallDist: wallDist,
    staminaRatio: player.maxStamina > 0 ? player.stamina / player.maxStamina : 1,
    strafe: player.vel.x,
  });
  lookDx = 0; lookDy = 0;

  updateHudTick(dt);

  if (player.health < 28 && player.health > 0) {
    const beat = Math.floor(game.elapsed * 1.6);
    if (beat !== lastHeartbeat) {
      lastHeartbeat = beat;
      audio.heartbeat();
    }
  }

  viewModel.root.visible = true;
}

function simulate(dt) {
  if (photo.active) {
    world.update(dt);
    updatePhotoCamera(dt);
    return;
  }
  if (game.running) stepSimulation(dt);
  else {
    world.update(dt);
    menuCamera(dt);
  }
}

function render() {
  // Photo mode renders the world on its own: no viewmodel, no HUD, and an
  // optional depth-of-field pass focused with the wheel.
  if (photo.active) {
    camera.position.copy(photo.pos);
    camera.rotation.set(photo.pitch, photo.yaw, 0);
    if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld(true);
    if (photo.dof) {
      dofMat.uniforms.tDiffuse.value = photoTarget.texture;
      dofMat.uniforms.tDepth.value = photoTarget.depthTexture;
      dofMat.uniforms.uNear.value = camera.near;
      dofMat.uniforms.uFar.value = camera.far;
      dofMat.uniforms.uFocus.value = photo.focus;
      renderer.setRenderTarget(photoTarget);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(dofScene, gradeCamera);
      return;
    }
    renderer.clear();
    renderer.render(scene, camera);
    return;
  }

  // Health and ADS optical focus feed the grade: the frame tightens and bleeds as you go down.
  const hurt = Math.max(0, 1 - player.health / player.maxHealth);
  const adsFactor = viewModel.adsBlend || 0;
  gradeMat.uniforms.uTime.value = performance.now() * 0.001;
  gradeMat.uniforms.uVignette.value = 1.02 + hurt * 0.4 + adsFactor * 0.32;
  gradeMat.uniforms.uAberration.value = 0.0035 + hurt * 0.006 + adsFactor * 0.002;

  if (QUALITY_TIERS[qualityTier].grade) {
    renderer.setRenderTarget(gradeTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(viewScene, viewCamera);
    renderer.setRenderTarget(null);
    gradeMat.uniforms.tDiffuse.value = gradeTarget.texture;
    renderer.clear();
    renderer.render(gradeScene, gradeCamera);
  } else {
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(viewScene, viewCamera);
  }
}

let fpsAvg = 60;
let perfTick = 0;
function updateOverlays(rawDt, dt) {
  if (rawDt > 0) fpsAvg += (1 / rawDt - fpsAvg) * 0.08;
  if (dmgDirTimer > 0) {
    dmgDirTimer -= dt;
    if (dmgDirTimer <= 0) hud.dmgDir.classList.remove('show');
  }
  if (!hud.perf.classList.contains('show')) return;
  perfTick -= dt;
  if (perfTick > 0) return;
  perfTick = 0.25;
  const info = renderer.info.render;
  hud.perf.textContent = `${fpsAvg.toFixed(0)} FPS \u00b7 ${info.calls} calls \u00b7 ${(info.triangles / 1000).toFixed(0)}k tris\nbody ${aliveCount()} \u00b7 tier ${QUALITY_TIERS[qualityTier].name}`;
}

function frame(now) {
  const rawDt = (now - lastFrame) / 1000;
  const dt = Math.min(0.05, rawDt);
  lastFrame = now;
  trackPerf(dt);
  pollGamepad(dt);
  simulate(dt);
  render();
  // After render: renderer.info.render is reset at the start of every draw, so
  // reading it before it would always report zero calls.
  updateOverlays(rawDt, dt);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- menu camera
function menuCamera(dt) {
  const t = performance.now() * 0.00012;
  camera.position.set(Math.sin(t) * 9, 2.1 + Math.sin(t * 2) * 0.2, 26 + Math.cos(t) * 7);
  camera.rotation.set(-0.04, Math.PI + Math.sin(t) * 0.5, 0);
  viewModel.root.visible = false;
}

// ---------------------------------------------------------------- wiring
el('startBtn').addEventListener('click', () => startRun());
el('againBtn').addEventListener('click', () => startRun());
el('resumeBtn').addEventListener('click', () => resumeGame());
el('pauseBtn').addEventListener('click', () => (game.paused ? resumeGame() : pauseGame()));
el('quitBtn').addEventListener('click', () => {
  game.running = false;
  game.paused = false;
  hud.pause.classList.add('hidden');
  document.body.classList.remove('paused', 'in-run');
  document.body.classList.add('in-menu');
  hud.menu.classList.remove('hidden');
  for (const z of zombies) scene.remove(z.group);
  zombies.length = 0;
  hitMeshesDirty = true;
  if (document.pointerLockElement === canvas) {
    suppressLockEvent = true;
    document.exitPointerLock();
  }
});
el('menuBtn').addEventListener('click', () => {
  hud.over.classList.add('hidden');
  hud.menu.classList.remove('hidden');
  document.body.classList.add('in-menu');
});
el('muteBtn').addEventListener('click', toggleMute);
el('flashBtn').addEventListener('click', toggleFlashlight);
el('depotBtn').addEventListener('click', () => openShop());
el('shopBtn').addEventListener('click', () => {
  hud.pause.classList.add('hidden');
  openShop();
});
el('shopClose').addEventListener('click', closeShop);

canvas.addEventListener('click', () => {
  if (game.running && !game.paused && !game.over) requestLock();
});

window.addEventListener('resize', () => {
  applyQuality();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  viewCamera.aspect = camera.aspect;
  viewCamera.updateProjectionMatrix();
});

// Losing focus or hiding the tab pauses immediately: the game keeps running
// even when pointer lock was refused, so this is the only thing stopping a
// horde from eating you while the window is in the background.
function pauseOnLeave() {
  ammo.triggerHeld = false;
  if (game.running && !game.paused && !game.over) pauseGame();
}
window.addEventListener('blur', pauseOnLeave);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseOnLeave();
});

function applyAudioVolumes() {
  audio.setVolumes({
    master: settings.master, effects: settings.effects, ambience: settings.ambience, music: settings.music,
  });
  if (settings.muted) {
    audio.setMuted(true);
    if (hud.muteBtn) hud.muteBtn.textContent = 'SOUND OFF';
  }
}

// The score follows the run, not the clock: hush in the menu, tense between
// waves, urgent while they are in the street, full weight for a boss.
function musicTarget() {
  if (!game.running) return 0.14;
  if (game.paused || game.shopOpen) return 0.18;
  if (game.plan && game.plan.boss) return 1;
  if (game.plan && game.plan.surge) return 0.86;
  if (game.intermission > 0) return 0.34;
  return Math.min(0.78, 0.58 + aliveCount() * 0.012);
}

function renderBinds() {
  const host = hud.binds;
  if (!host) return;
  host.textContent = '';
  for (const [action, label] of BIND_ACTIONS) {
    const row = document.createElement('div');
    row.className = 'bind-row';
    const name = document.createElement('span');
    name.textContent = label;
    const btn = document.createElement('button');
    btn.className = 'bind-key' + (rebinding === action ? ' waiting' : '');
    btn.textContent = rebinding === action ? 'PRESS A KEY' : keyLabel(bindFor(action));
    btn.addEventListener('click', () => { rebinding = action; renderBinds(); });
    row.append(name, btn);
    host.appendChild(row);
  }
}

function bindSettings() {
  if (!hud.setSens) return;
  hud.setSens.value = String(settings.sensitivity);
  hud.setFov.value = String(settings.fov);
  hud.setInvert.checked = !!settings.invertY;
  hud.setSensVal.textContent = settings.sensitivity.toFixed(2);
  hud.setFovVal.textContent = String(settings.fov);

  camera.fov = settings.fov;
  camera.updateProjectionMatrix();

  hud.setSens.addEventListener('input', () => {
    settings.sensitivity = Number(hud.setSens.value);
    hud.setSensVal.textContent = settings.sensitivity.toFixed(2);
    saveSettings();
  });
  hud.setFov.addEventListener('input', () => {
    settings.fov = Number(hud.setFov.value);
    hud.setFovVal.textContent = String(settings.fov);
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();
    saveSettings();
  });
  hud.setInvert.addEventListener('change', () => {
    settings.invertY = hud.setInvert.checked;
    saveSettings();
  });

  // Volume sliders. Each one is a real bus in the audio engine, not a scale
  // applied after the mix.
  const sliders = [
    [hud.setMaster, hud.setMasterVal, 'master', (v) => `${Math.round(v * 100)}%`],
    [hud.setEffects, hud.setEffectsVal, 'effects', (v) => `${Math.round(v * 100)}%`],
    [hud.setAmbience, hud.setAmbienceVal, 'ambience', (v) => `${Math.round(v * 100)}%`],
    [hud.setMusic, hud.setMusicVal, 'music', (v) => `${Math.round(v * 100)}%`],
    [hud.setShake, hud.setShakeVal, 'shake', (v) => `${Math.round(v * 100)}%`],
  ];
  for (const [node, valNode, key, fmt] of sliders) {
    if (!node) continue;
    node.value = String(settings[key]);
    if (valNode) valNode.textContent = fmt(settings[key]);
    node.addEventListener('input', () => {
      settings[key] = Number(node.value);
      if (valNode) valNode.textContent = fmt(settings[key]);
      if (key === 'master' || key === 'effects' || key === 'ambience' || key === 'music') applyAudioVolumes();
      saveSettings();
    });
  }

  const checks = [
    [hud.setFlash, 'reduceFlash'],
    [hud.setColorblind, 'colorblind'],
    [hud.setAimAssist, 'aimAssist'],
  ];
  for (const [node, key] of checks) {
    if (!node) continue;
    node.checked = !!settings[key];
    node.addEventListener('change', () => {
      settings[key] = node.checked;
      saveSettings();
    });
  }

  if (hud.resetBinds) {
    hud.resetBinds.addEventListener('click', () => {
      settings.keybinds = {};
      saveSettings();
      renderBinds();
    });
  }
  renderBinds();
  applyAudioVolumes();
}

// ---------------------------------------------------------------- gamepad
// Standard layout only: sticks move and look, triggers fire and aim, face
// buttons cover melee/reload/grenade/alt-fire. Aim assist nudges rather than
// snaps, and only while the trigger is pulled.
const padState = { lastButtons: [], ads: false };

function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function applyAimAssist() {
  const eye = camera.position;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  let best = null;
  let bestDot = Math.cos(0.2);
  for (const z of zombies) {
    if (!z.alive) continue;
    const dx = z.group.position.x - eye.x;
    const dy = (z.group.position.y + 1.1 * (z.def.scale || 1)) - eye.y;
    const dz = z.group.position.z - eye.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 16 || dist < 1.5) continue;
    const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / dist;
    if (dot > bestDot) { bestDot = dot; best = { x: dx / dist, y: dy / dist, z: dz / dist }; }
  }
  if (!best) return;
  const targetYaw = Math.atan2(-best.x, -best.z);
  const targetPitch = Math.asin(Math.max(-1, Math.min(1, best.y)));
  player.yaw += angleDelta(targetYaw, player.yaw) * 0.3;
  player.pitch += (targetPitch - player.pitch) * 0.3;
}

function pollGamepad(dt) {
  if (!navigator.getGamepads || !game.running || game.over || photo.active) return;
  const pad = Array.from(navigator.getGamepads() || []).find((p) => p && p.connected);
  if (!pad) return;
  const dz = 0.2;
  if (game.paused || game.shopOpen) { padState.lastButtons = pad.buttons.map((b) => b.pressed); return; }
  const lx = Math.abs(pad.axes[0] || 0) > dz ? pad.axes[0] : 0;
  const ly = Math.abs(pad.axes[1] || 0) > dz ? pad.axes[1] : 0;
  keys['KeyW'] = ly < -dz; keys['KeyS'] = ly > dz;
  keys['KeyA'] = lx < -dz; keys['KeyD'] = lx > dz;
  const rx = Math.abs(pad.axes[2] || 0) > dz ? pad.axes[2] : 0;
  const ry = Math.abs(pad.axes[3] || 0) > dz ? pad.axes[3] : 0;
  if (rx || ry) {
    const sens = (player.ads ? 1.1 : 1.9) * settings.sensitivity * dt;
    player.yaw -= rx * sens;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - ry * sens));
  }
  const pressed = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
  const edge = (i) => pressed(i) && !padState.lastButtons[i];
  if (edge(0) && player.grounded) { player.vel.y = 4.7; player.grounded = false; }
  if (edge(1)) swingMelee();
  if (edge(2)) startReload();
  if (edge(3)) throwGrenade();
  if (edge(4)) altFire();
  if (edge(5)) selectWeapon(ammo.weapon + 1);
  if (edge(12)) selectWeapon(ammo.weapon - 1);
  if (edge(13)) selectWeapon(ammo.weapon + 1);
  const aim = pressed(6);
  if (aim) player.ads = true;
  else if (padState.ads) player.ads = false;
  padState.ads = aim;
  if (pressed(7)) {
    if (settings.aimAssist) applyAimAssist();
    ammo.triggerHeld = true;
    tryFire();
  } else {
    ammo.triggerHeld = false;
  }
  padState.lastButtons = pad.buttons.map((b) => b.pressed);
}

// ---------------------------------------------------------------- boot
refreshBestLine();
renderCareer();
updateAmmoHud();
updateVitalsHud();
hud.flashBtn.textContent = 'FLASHLIGHT [F] ON';
hud.loading.classList.add('hidden');
hud.menu.classList.remove('hidden');
document.body.classList.add('in-menu');
bindSettings();
renderChallenges();
applyAudioVolumes();
// Sized after the photo/depth targets exist; nothing renders before this.
applyQuality();
if (params.get('stats') === '1') hud.perf.classList.add('show');
if (launchWave > 0) startRun(launchWave);

// Expose internal references for debug & automation harnesses
window.__game = game;
window.__viewModel = viewModel;
window.__player = player;
window.__ammo = ammo;
window.__selectWeapon = selectWeapon;
window.__startRun = startRun;
window.__camera = camera;
window.__world = world;
window.__zombies = zombies;
window.__fireRound = fireRound;
window.__decals = decals;
window.__spawnAt = spawnAt;
window.__casings = casings;
window.__startReload = startReload;
window.__tryFire = tryFire;
window.__audio = audio;
window.__swingMelee = swingMelee;
window.__defensiveShove = defensiveShove;
window.__throwGrenade = throwGrenade;
window.__startCookingThrowable = startCookingThrowable;
window.__releaseCookedThrowable = releaseCookedThrowable;
window.__cycleThrowable = cycleThrowable;
window.__firePools = firePools;
window.__pipeBombLures = pipeBombLures;
window.__grenadePool = grenadePool;
window.__THREE = THREE;
window.__makeContext = makeContext;
window.__recoilSpring = recoilSpring;
window.__shakeSystem = shakeSystem;
window.__recoilProfiles = WEAPON_RECOIL_PROFILES;
window.__damagePlayer = damagePlayer;
window.__explodeGrenade = explodeGrenade;
window.__debrisPool = debrisPool;
window.__arterialPool = arterialPool;
window.__severZombieLimb = severZombieLimb;
window.__convertToCrawler = convertToCrawler;
window.__nav = nav;
window.__computeHordeSteering = computeHordeSteering;
window.__acidPuddles = acidPuddles;
window.__gasClouds = gasClouds;
window.__spawnAcidPuddle = spawnAcidPuddle;
window.__spawnGasCloud = spawnGasCloud;
window.__calculateBloaterBurstDamage = calculateBloaterBurstDamage;
window.__stepAcidProjectileCCD = stepAcidProjectileCCD;
window.__bloaterBurst = bloaterBurst;
window.__triggerBarrelChainReaction = triggerBarrelChainReaction;
window.__stepLurkerAI = stepLurkerAI;
window.__compute3DPounceTrajectory = compute3DPounceTrajectory;
window.__samplePounceArcPoints = samplePounceArcPoints;
window.__isTargetInFlashlightBeam = isTargetInFlashlightBeam;
window.__LURKER_CONFIG = LURKER_CONFIG;
window.__flashlight = flashlight;

requestAnimationFrame(frame);
