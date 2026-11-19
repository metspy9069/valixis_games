// Dead Signal - first-person zombie survival shooter.
// Static Three.js: no external assets, no build step.
import * as THREE from 'three';
import { buildWorld, resolveCircle, makeRng } from './world.js';
import { Zombie } from './zombie.js';
import { WEAPONS, ViewModel } from './weapons.js';
import { NavGrid } from './nav.js';
import { wavePlan, rollType } from './waves.js';
import { AudioEngine } from './audio.js';

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

function sizeGradeTarget() {
  const tier = QUALITY_TIERS[qualityTier];
  const ratio = Math.min(window.devicePixelRatio || 1, tier.ratio);
  const w = Math.max(1, Math.floor(window.innerWidth * ratio));
  const h = Math.max(1, Math.floor(window.innerHeight * ratio));
  gradeTarget.setSize(w, h);
  gradeMat.uniforms.uResolution.value.set(w, h);
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
    showHint(`GRAPHICS: ${QUALITY_TIERS[qualityTier].name.toUpperCase()} Â· ${Math.round(fps)} FPS`);
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
applyQuality();
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

// ---------------------------------------------------------------- state
const rng = makeRng(1337);

// ---------------------------------------------------------------- settings
// Player-facing options, persisted next to the best-run record.
const SETTINGS_KEY = 'deadSignalSettings';
const settings = Object.assign({ sensitivity: 1, fov: 78, invertY: false }, loadSettings());

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

const player = {
  pos: new THREE.Vector3(0, 0, 20),
  vel: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: -0.03,
  height: 1.68,
  radius: 0.36,
  health: 100,
  maxHealth: 100,
  stamina: 100,
  grounded: true,
  bob: 0,
  lastDamage: -99,
  stepAccum: 0,
  shake: 0,
  ads: false,
  sprinting: false,
  iframes: 0,
};

// Camera recoil is kept separate from aim: it climbs with sustained fire and
// springs back, so the player's actual mouse aim is never permanently moved.
const recoil = { pitch: 0, yaw: 0 };

const ammo = {
  mag: WEAPONS.map((w) => w.magSize),
  reserve: WEAPONS.map((w) => (w.reserveMax === Infinity ? Infinity : Math.round(w.reserveMax * 0.7))),
  weapon: 0,
  reloading: false,
  reloadTimer: 0,
  lastShot: 0,
  triggerHeld: false,
};

const game = {
  running: false,
  paused: true,
  over: false,
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
};

const zombies = [];
let hitMeshCache = [];
let hitMeshesDirty = true;
const raycaster = new THREE.Raycaster();

const pickups = [];

// ---------------------------------------------------------------- particles
const bloodMat = new THREE.MeshBasicMaterial({ color: 0x8e1119 });
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd08a });
const particleGeo = new THREE.BoxGeometry(0.055, 0.055, 0.055);
const particles = [];
for (let i = 0; i < 220; i++) {
  const mesh = new THREE.Mesh(particleGeo, bloodMat);
  mesh.visible = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  particles.push({ mesh, vel: new THREE.Vector3(), life: 0, max: 1, gravity: 12 });
}
let particleCursor = 0;

function spawnParticles(point, count, kind, power = 1) {
  for (let i = 0; i < count; i++) {
    const p = particles[particleCursor];
    particleCursor = (particleCursor + 1) % particles.length;
    p.mesh.material = kind === 'blood' ? bloodMat : sparkMat;
    p.mesh.position.copy(point);
    p.mesh.scale.setScalar(0.6 + Math.random() * 0.9);
    p.mesh.visible = true;
    p.vel.set((Math.random() - 0.5) * 6 * power, Math.random() * 4.4 * power, (Math.random() - 0.5) * 6 * power);
    p.life = p.max = 0.35 + Math.random() * 0.45;
    p.gravity = kind === 'blood' ? 14 : 9;
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
  weaponName: el('weaponName'), ammoMag: el('ammoMag'), ammoReserve: el('ammoReserve'),
  ammoPanel: el('ammoPanel'), reloadFill: el('reloadFill'),
  wave: el('waveValue'), kills: el('killValue'), left: el('leftValue'), score: el('scoreValue'),
  surgeBadge: el('surgeBadge'),
  cross: el('cross'), blood: el('blood'), hurt: el('hurtFlash'),
  dmgDir: el('dmgDir'), perf: el('perf'),
  setSens: el('setSens'), setFov: el('setFov'), setInvert: el('setInvert'),
  setSensVal: el('setSensVal'), setFovVal: el('setFovVal'),
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

document.addEventListener('pointerlockchange', () => {
  mouseLocked = document.pointerLockElement === canvas;
  if (!mouseLocked && game.running && !game.over && !suppressLockEvent) pauseGame();
  suppressLockEvent = false;
});

window.addEventListener('keydown', (e) => {
  const k = e.code;
  keys[k] = true;
  if (k === 'F3') {
    e.preventDefault();
    hud.perf.classList.toggle('show');
    return;
  }
  if (k === 'Escape') {
    if (game.running && !game.paused && !game.over) pauseGame();
    return;
  }
  if (!game.running || game.paused || game.over) return;
  if (k === 'KeyR') startReload();
  if (k === 'KeyF') toggleFlashlight();
  if (k === 'KeyM') toggleMute();
  if (k === 'Digit1' || k === 'Numpad1') selectWeapon(0);
  if (k === 'Digit2' || k === 'Numpad2') selectWeapon(1);
  if (k === 'Digit3' || k === 'Numpad3') selectWeapon(2);
  if (k === 'KeyQ') selectWeapon(ammo.weapon + 1);
  if (k === 'Space' && player.grounded) {
    player.vel.y = 4.7;
    player.grounded = false;
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('mousedown', (e) => {
  if (!game.running || game.paused || game.over) return;
  // Firing must never depend on pointer lock succeeding.
  if (!mouseLocked) requestLock();
  if (e.button === 0) { ammo.triggerHeld = true; tryFire(); }
  if (e.button === 2) player.ads = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) ammo.triggerHeld = false;
  if (e.button === 2) player.ads = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('mousemove', (e) => {
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
  fireBtn.addEventListener('touchend', () => { ammo.triggerHeld = false; });
  el('reloadBtn').addEventListener('click', () => startReload());
  el('swapBtn').addEventListener('click', () => selectWeapon(ammo.weapon + 1));
}

// ---------------------------------------------------------------- weapons
function weaponDef() { return WEAPONS[ammo.weapon]; }

function selectWeapon(index) {
  const next = ((index % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
  if (next === ammo.weapon) return;
  ammo.weapon = next;
  ammo.reloading = false;
  ammo.reloadTimer = 0;
  viewModel.select(next);
  audio.weaponSwap();
  updateAmmoHud();
}

function startReload() {
  const def = weaponDef();
  if (ammo.reloading) return;
  if (ammo.mag[ammo.weapon] >= def.magSize) return;
  if (ammo.reserve[ammo.weapon] <= 0 && def.reserveMax !== Infinity) return;
  ammo.reloading = true;
  ammo.reloadTimer = def.reloadTime;
  audio.reloadStart();
  setTimeout(() => { if (ammo.reloading) audio.reloadStep(); }, def.reloadTime * 400);
  setTimeout(() => { if (ammo.reloading) audio.reloadEnd(); }, def.reloadTime * 850);
}

function finishReload() {
  const def = weaponDef();
  const need = def.magSize - ammo.mag[ammo.weapon];
  if (def.reserveMax === Infinity) {
    ammo.mag[ammo.weapon] = def.magSize;
  } else {
    const take = Math.min(need, ammo.reserve[ammo.weapon]);
    ammo.mag[ammo.weapon] += take;
    ammo.reserve[ammo.weapon] -= take;
  }
  ammo.reloading = false;
  updateAmmoHud();
}

let spreadBloom = 0;

function tryFire() {
  if (!game.running || game.paused || game.over) return;
  const def = weaponDef();
  const now = performance.now() / 1000;
  if (ammo.reloading) return;
  if (now - ammo.lastShot < 60 / def.rpm) return;
  if (ammo.mag[ammo.weapon] <= 0) {
    audio.dryFire();
    startReload();
    return;
  }
  ammo.lastShot = now;
  ammo.mag[ammo.weapon] -= 1;
  game.shots += 1;
  updateAmmoHud();

  audio.shot(def.sound);
  viewModel.flash();
  viewModel.recoil(def.recoil);
  muzzleLightTimer = 0.06;
  player.shake = Math.min(0.5, player.shake + def.recoil * 0.016);

  // Recoil pushes the view up; aim down sights halves it.
  recoil.pitch += (def.recoil * 0.0038) * (player.ads ? 0.55 : 1);
  recoil.yaw += (Math.random() - 0.5) * def.recoil * 0.0012;

  spreadBloom = Math.min(0.05, spreadBloom + def.spread * 0.5);

  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();
  camera.getWorldPosition(origin);
  camera.getWorldDirection(dir);

  const muzzle = new THREE.Vector3();
  viewModel.muzzleWorld(muzzle);
  muzzleLight.position.copy(muzzle);

  const baseSpread = player.ads ? def.adsSpread : def.spread;
  const spread = baseSpread + spreadBloom * (player.ads ? 0.3 : 1);

  for (let p = 0; p < def.pellets; p++) {
    const shotDir = applySpread(origin, dir, spread, p);

    const wallHit = rayWorld(origin, shotDir, 90);
    const zombieHit = rayZombies(origin, shotDir, wallHit ? wallHit.distance : 90);

    if (zombieHit) {
      const { zombie, mesh, point, distance } = zombieHit;
      const head = mesh.userData.part === 'head';
      const falloff = damageFalloff(def, distance);
      const dmg = def.damage * falloff * (head ? 2.6 : 1);
      game.hits += 1;
      const killed = zombie.takeDamage(dmg, head ? 'head' : 'body', makeContext());
      spawnParticles(point, head ? 12 : 7, 'blood', head ? 1.35 : 1);
      spawnDamageNumber(point, dmg, head);
      spawnTracer(muzzle, point);
      flashCrosshair(killed ? 'kill' : 'hit');
      // Kill bookkeeping happens in onDeath -> onZombieKilled (no double count).
    } else if (wallHit) {
      spawnParticles(wallHit.point, 4, 'spark', 0.7);
      spawnTracer(muzzle, wallHit.point);
    } else {
      spawnTracer(muzzle, origin.clone().addScaledVector(shotDir, 60));
    }
  }

  if (ammo.mag[ammo.weapon] <= 0) setTimeout(startReload, 160);
}

function damageFalloff(def, distance) {
  if (distance <= def.falloffStart) return 1;
  if (distance >= def.falloffEnd) return def.falloffMin;
  const t = (distance - def.falloffStart) / (def.falloffEnd - def.falloffStart);
  return 1 - t * (1 - def.falloffMin);
}

const tmpRight = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
function applySpread(origin, dir, spread, pelletIndex) {
  if (spread <= 0) return dir.clone();
  tmpRight.crossVectors(dir, camera.up).normalize();
  tmpUp.crossVectors(tmpRight, dir).normalize();
  // Shotgun pellets get a fixed ring pattern plus jitter, so they read as a cone.
  const angle = Math.random() * Math.PI * 2 + pelletIndex * 0.7;
  const radius = Math.sqrt(Math.random()) * spread;
  const out = dir.clone()
    .addScaledVector(tmpRight, Math.cos(angle) * radius)
    .addScaledVector(tmpUp, Math.sin(angle) * radius);
  return out.normalize();
}

function refreshHitMeshes() {
  hitMeshCache = [];
  for (const z of zombies) {
    if (z.alive) hitMeshCache.push(...z.hitMeshes);
  }
  hitMeshesDirty = false;
}

function rayZombies(origin, dir, maxDist) {
  if (hitMeshesDirty) refreshHitMeshes();
  if (!hitMeshCache.length) return null;
  // Raycasting needs current world matrices; in normal play the renderer has
  // just written them, but a shot fired in the same frame as a spawn has not.
  for (const z of zombies) {
    if (z.alive) z.group.updateMatrixWorld(true);
  }
  raycaster.set(origin, dir);
  raycaster.far = maxDist;
  const hits = raycaster.intersectObjects(hitMeshCache, false);
  if (!hits.length) return null;
  const hit = hits[0];
  const zombie = hit.object.userData.zombie;
  if (!zombie || !zombie.alive) return null;
  return { zombie, mesh: hit.object, point: hit.point, distance: hit.distance };
}

function rayWorld(origin, dir, maxDist) {
  let best = null;

  // Ground plane first, so shooting the road does not shoot through it.
  if (dir.y < -0.0001) {
    const tGround = -origin.y / dir.y;
    if (tGround > 0.05 && tGround < maxDist) {
      best = { distance: tGround, point: origin.clone().addScaledVector(dir, tGround) };
    }
  }

  const invX = 1 / (dir.x || 1e-9);
  const invY = 1 / (dir.y || 1e-9);
  const invZ = 1 / (dir.z || 1e-9);

  for (const c of world.colliders) {
    const h = c.height === undefined ? 4 : c.height;
    let t1 = (c.minX - origin.x) * invX;
    let t2 = (c.maxX - origin.x) * invX;
    let tmin = Math.min(t1, t2);
    let tmax = Math.max(t1, t2);

    t1 = 0 - origin.y * invY;
    t2 = h - origin.y * invY;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));

    t1 = (c.minZ - origin.z) * invZ;
    t2 = (c.maxZ - origin.z) * invZ;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));

    if (tmax < Math.max(0, tmin)) continue;
    const t = tmin > 0.05 ? tmin : (tmax > 0.05 ? tmax : -1);
    if (t < 0 || t > maxDist) continue;
    if (!best || t < best.distance) {
      best = { distance: t, point: origin.clone().addScaledVector(dir, t) };
    }
  }
  return best;
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
  const plan = wavePlan(n);
  game.plan = plan;
  game.wave = plan.wave;
  game.speedScale = plan.speedScale;
  game.damageScale = plan.damageScale;

  game.spawnQueue = [];
  game.spawnTimer = 0;
  for (let i = 0; i < plan.count; i++) {
    // A surge opens with a burst, so the spike is visible in the first two
    // seconds instead of reading as the wave quietly finishing early.
    const lead = plan.surge && i < plan.burstLead;
    // One heavy closes every tenth wave. Under the count cap a single dangerous
    // body is both cheaper to draw and easier to read than ten more walkers.
    const boss = plan.boss && i === plan.count - 1;
    game.spawnQueue.push({
      type: boss ? 'brute' : rollType(plan),
      delay: lead ? 0.08 : 0.2 + (i - plan.burstLead) * plan.spacing,
      lead,
      boss,
    });
  }

  world.setBlackout(plan.modifier === 'blackout');
  audio.waveAlarm(plan.surge);
  if (plan.modifier !== 'none') showHint(`WAVE MODIFIER: ${plan.modifier.toUpperCase()}`, 3200);
  const ramp = `Speed +${Math.round((plan.speedScale - 1) * 100)}% \u00b7 bite +${Math.round((plan.damageScale - 1) * 100)}%.`;
  const head = plan.wave === 1
    ? 'They heard the relay. Hold position.'
    : plan.surge
      ? `${plan.count} inbound \u00b7 ${plan.burstLead} at once. ${ramp}`
      : `${plan.count} inbound. ${ramp}`;
  showBanner(plan.surge ? 'SURGE WAVE' : 'WAVE', String(plan.wave), head, plan.surge ? 3400 : 3000);
  updateWaveHud();
}

function spawnAt(type, position) {
  const z = new Zombie(type, position, rng);
  scene.add(z.group);
  zombies.push(z);
  hitMeshesDirty = true;
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
    z.isBoss = true;
    z.maxHp = Math.round(z.maxHp * 2.6);
    z.hp = z.maxHp;
    z.damage = Math.round(z.damage * 1.35);
    z.group.scale.multiplyScalar(1.35);
    z.radius *= 1.35;
    showBanner('HEAVY CONTACT', 'GATEKEEPER', 'It does not flinch. Keep moving.', 3000);
  }
}

function aliveCount() {
  let n = 0;
  for (const z of zombies) if (z.alive) n++;
  return n;
}

function onZombieKilled(zombie, head) {
  game.kills++;
  if (head) game.headshots++;
  game.score += Math.round(zombie.def.score * (head ? 1.6 : 1));
  audio.kill();
  world.addDecal(zombie.group.position.x, zombie.group.position.z, 0.55 + Math.random() * 0.35);

  const roll = Math.random();
  const at = zombie.group.position.clone();
  at.y = 0.35;
  if (roll < 0.16) addPickup('ammo', at);
  else if (roll < 0.26) addPickup('health', at);

  updateWaveHud();
}

// ---------------------------------------------------------------- pickups
const pickupGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
function addPickup(kind, position) {
  const mat = new THREE.MeshStandardMaterial({
    color: kind === 'ammo' ? 0xd8b25a : 0x5aff8a,
    emissive: kind === 'ammo' ? 0xffcc66 : 0x2aff6a,
    emissiveIntensity: 2.2,
    roughness: 0.4,
  });
  const mesh = new THREE.Mesh(pickupGeo, mat);
  mesh.position.copy(position);
  mesh.position.y = 0.45;
  scene.add(mesh);
  const light = new THREE.PointLight(kind === 'ammo' ? 0xffcc66 : 0x66ff9c, 3.4, 4.5, 2);
  light.position.copy(mesh.position);
  scene.add(light);
  pickups.push({ kind, mesh, light, life: 26, spin: Math.random() * 3 });
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.life -= dt;
    p.mesh.rotation.y += dt * 2.4;
    p.mesh.position.y = 0.45 + Math.sin(performance.now() * 0.002 + p.spin) * 0.08;

    const d = p.mesh.position.distanceTo(new THREE.Vector3(player.pos.x, 0.45, player.pos.z));
    if (d < 1.35) {
      if (p.kind === 'ammo') {
        const def = weaponDef();
        if (def.reserveMax === Infinity) {
          // Pistol is already infinite: top up the other guns instead.
          ammo.reserve[1] = Math.min(WEAPONS[1].reserveMax, ammo.reserve[1] + 32);
          ammo.reserve[2] = Math.min(WEAPONS[2].reserveMax, ammo.reserve[2] + 8);
        } else {
          ammo.reserve[ammo.weapon] = Math.min(def.reserveMax, ammo.reserve[ammo.weapon] + Math.ceil(def.magSize * 1.5));
        }
        showHint('AMMO RECOVERED', 1200);
      } else {
        player.health = Math.min(player.maxHealth, player.health + 35);
        showHint('FIELD DRESSING +35', 1200);
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
  player.health -= amount;
  player.lastDamage = game.elapsed;
  player.shake = Math.min(1.1, player.shake + 0.4);
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

function makeContext() {
  return {
    audio,
    scene,
    playerPos: player.pos,
    colliders: world.colliders,
    zombies,
    nav,
    damage: (dmg, from) => damagePlayer(dmg, from),
    onDeath: (z, part) => onZombieKilled(z, part === 'head'),
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

  const wantsSprint = (keys['ShiftLeft'] || keys['ShiftRight']) && iz > 0.1 && player.stamina > 1 && !player.ads;
  player.sprinting = wantsSprint;

  const baseSpeed = player.ads ? 2.6 : 4.6;
  const speed = wantsSprint ? 7.3 : baseSpeed;

  const targetVX = (forward.x * iz + right.x * ix) * speed;
  const targetVZ = (forward.z * iz + right.z * ix) * speed;

  const accel = player.grounded ? 12 : 3.2;
  player.vel.x += (targetVX - player.vel.x) * Math.min(1, accel * dt);
  player.vel.z += (targetVZ - player.vel.z) * Math.min(1, accel * dt);

  if (wantsSprint) {
    player.stamina = Math.max(0, player.stamina - 20 * dt);
  } else {
    player.stamina = Math.min(100, player.stamina + 16 * dt);
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

  // Health regen after a lull.
  if (game.elapsed - player.lastDamage > 6.5 && player.health < player.maxHealth && player.health > 0) {
    player.health = Math.min(player.maxHealth, player.health + 4.2 * dt);
  }

  // ADS FOV blend.
  const wantFov = player.ads ? settings.fov * 0.74 : settings.fov;
  camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 10);
  camera.updateProjectionMatrix();

  updateCamera(dt, planarSpeed);
}

function updateCamera(dt, planarSpeed) {
  const bobAmp = player.grounded ? Math.min(0.055, planarSpeed * 0.0075) : 0;
  const bobY = Math.sin(player.bob * 2) * bobAmp;
  const bobX = Math.cos(player.bob) * bobAmp * 0.7;

  player.shake = Math.max(0, player.shake - dt * 2.6);
  const shake = player.shake * player.shake;

  camera.position.set(
    player.pos.x + bobX * 0.5 + (Math.random() - 0.5) * shake * 0.09,
    player.pos.y + player.height + bobY + (Math.random() - 0.5) * shake * 0.09,
    player.pos.z
  );
  // Recover most of the kick quickly, then settle the last of it slowly.
  recoil.pitch *= Math.exp(-dt * 11);
  recoil.yaw *= Math.exp(-dt * 11);
  if (Math.abs(recoil.pitch) < 1e-4) recoil.pitch = 0;
  if (Math.abs(recoil.yaw) < 1e-4) recoil.yaw = 0;

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
  hud.stamFill.style.width = `${player.stamina}%`;
  document.body.classList.toggle('lowhp', hp > 0 && hp < 35);
  hud.blood.style.opacity = hp < 45 ? String((1 - hp / 45) * 0.85) : '0';
}

function updateAmmoHud() {
  const def = weaponDef();
  hud.weaponName.textContent = def.name;
  hud.ammoMag.textContent = String(ammo.mag[ammo.weapon]);
  hud.ammoReserve.textContent = def.reserveMax === Infinity ? '\u221e' : String(ammo.reserve[ammo.weapon]);
  hud.ammoPanel.classList.toggle('reloading', ammo.reloading);
}

function updateWaveHud() {
  const surge = !!(game.plan && game.plan.surge);
  hud.wave.textContent = String(game.wave);
  hud.surgeBadge.hidden = !surge;
  document.body.classList.toggle('surge', surge);
  hud.kills.textContent = String(game.kills);
  hud.left.textContent = String(aliveCount() + game.spawnQueue.length);
  hud.score.textContent = String(game.score);
}

function updateHudTick(dt) {
  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = 0.12;
    updateVitalsHud();
    updateWaveHud();
    updateAmmoHud();
    if (ammo.reloading) {
      const def = weaponDef();
      hud.reloadFill.style.width = `${(1 - ammo.reloadTimer / def.reloadTime) * 100}%`;
    }
  }
}

// ---------------------------------------------------------------- flow
function startRun(atWave = 0) {
  const jumpTo = Number.isFinite(atWave) ? Math.max(0, Math.min(99, Math.round(atWave))) : 0;
  audio.init();
  audio.resume();
  audio.setMuted(audio.muted);
  audio.setAmbientLevel(1);

  for (const z of zombies) scene.remove(z.group);
  zombies.length = 0;
  for (const p of pickups) { scene.remove(p.mesh); scene.remove(p.light); }
  pickups.length = 0;
  for (const p of particles) { p.life = 0; p.mesh.visible = false; }
  for (const t of tracers) { t.life = 0; t.line.visible = false; }
  hitMeshesDirty = true;

  player.pos.set(0, 0, 20);
  player.vel.set(0, 0, 0);
  player.yaw = Math.PI;
  player.pitch = -0.02;
  player.health = player.maxHealth;
  player.stamina = 100;
  player.shake = 0;
  player.grounded = true;
  player.ads = false;
  player.iframes = 0;
  player.lastDamage = -99;
  recoil.pitch = 0;
  recoil.yaw = 0;

  ammo.mag = WEAPONS.map((w) => w.magSize);
  ammo.reserve = WEAPONS.map((w) => (w.reserveMax === Infinity ? Infinity : Math.round(w.reserveMax * 0.7)));
  ammo.weapon = 0;
  ammo.reloading = false;
  ammo.reloadTimer = 0;
  ammo.lastShot = 0;
  ammo.triggerHeld = false;
  viewModel.select(0, true);

  game.running = true;
  game.paused = false;
  game.over = false;
  game.wave = 0;
  game.kills = 0;
  game.headshots = 0;
  game.score = 0;
  game.elapsed = 0;
  game.shots = 0;
  game.hits = 0;
  game.plan = null;
  document.body.classList.remove('surge');
  world.setBlackout(false);
  // A launch parameter queues the requested wave; otherwise start from one.
  game.wave = jumpTo > 0 ? jumpTo - 1 : 0;
  game.intermission = jumpTo > 0 ? 0.8 : 2.2;
  game.spawnQueue = [];
  game.spawnTimer = 0;
  game.speedScale = 1;
  game.damageScale = 1;

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
  requestLock();
}

function pauseGame() {
  if (!game.running || game.over) return;
  game.paused = true;
  document.body.classList.add('paused');
  hud.pause.classList.remove('hidden');
  if (document.pointerLockElement === canvas) {
    suppressLockEvent = true;
    document.exitPointerLock();
  }
  ammo.triggerHeld = false;
  player.ads = false;
}

function resumeGame() {
  if (!game.running) return;
  game.paused = false;
  document.body.classList.remove('paused');
  hud.pause.classList.add('hidden');
  audio.resume();
  requestLock();
}

function endRun() {
  if (game.over) return;
  game.over = true;
  game.running = false;
  player.ads = false;
  audio.setAmbientLevel(0.25);
  if (document.pointerLockElement === canvas) {
    suppressLockEvent = true;
    document.exitPointerLock();
  }
  document.body.classList.remove('in-run');
  document.body.classList.add('in-menu');

  const best = loadBest();
  const score = game.score;
  const isBest = score > best.score;
  if (isBest) saveBest({ wave: game.wave, kills: game.kills, score });
  refreshBestLine();

  el('overWave').textContent = String(game.wave);
  el('overKills').textContent = String(game.kills);
  el('overHeads').textContent = String(game.headshots);
  el('overScore').textContent = String(score);
  const accuracy = game.shots > 0 ? Math.round((game.hits / game.shots) * 100) : 0;
  el('overAcc').textContent = game.shots > 0 ? `${accuracy}%` : '\u2014';
  el('overBest').textContent = best.score > 0 ? `w${best.wave} ${best.score}` : '\u2014';
  el('overSub').textContent = isBest
    ? `New personal best. You held until wave ${game.wave}.`
    : `You held until wave ${game.wave}. The relay kept transmitting without you.`;
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

// ---------------------------------------------------------------- systems
function toggleFlashlight() {
  flashlight.visible = !flashlight.visible;
  hud.flashBtn.textContent = flashlight.visible ? 'FLASHLIGHT [F] ON' : 'FLASHLIGHT [F] OFF';
}

function toggleMute() {
  audio.setMuted(!audio.muted);
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

  // Weapon state.
  if (ammo.reloading) {
    ammo.reloadTimer -= dt;
    if (ammo.reloadTimer <= 0) finishReload();
  }
  if (ammo.triggerHeld && weaponDef().auto) tryFire();

  spreadBloom = Math.max(0, spreadBloom - dt * 0.05);

  // Zombies.
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    z.update(dt, makeContext());
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
    if (game.spawnQueue.length) {
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) {
        const entry = game.spawnQueue[0];
        game.spawnTimer = entry ? entry.delay : 0.5;
        spawnFromQueue();
      }
    } else if (aliveCount() === 0 && !game.over) {
      game.intermission = 4.5;
      const bonus = Math.round(250 * game.wave * (game.plan && game.plan.surge ? 1.5 : 1));
      game.score += bonus;
      showBanner('WAVE CLEARED', `+${bonus}`, 'Reload. They are regrouping.', 2400);
      updateWaveHud();
    }
  }

  updateParticles(dt);
  updateTracers(dt);
  updatePickups(dt);
  updateDamageNumbers(dt);
  world.update(dt);

  if (muzzleLightTimer > 0) {
    muzzleLightTimer -= dt;
    muzzleLight.intensity = Math.max(0, muzzleLightTimer / 0.06) * 60;
  } else {
    muzzleLight.intensity = 0;
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

  viewModel.update(dt, {
    moving: Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 5),
    sprinting: player.sprinting,
    ads: player.ads,
    reloading: ammo.reloading,
    aspect: camera.aspect,
    mouseDX: lookDx,
    mouseDY: lookDy,
    grounded: player.grounded,
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
  if (game.running) stepSimulation(dt);
  else {
    world.update(dt);
    menuCamera(dt);
  }
}

function render() {
  // Health feeds the grade: the frame tightens and bleeds as you go down.
  const hurt = Math.max(0, 1 - player.health / player.maxHealth);
  gradeMat.uniforms.uTime.value = performance.now() * 0.001;
  gradeMat.uniforms.uVignette.value = 1.02 + hurt * 0.4;
  gradeMat.uniforms.uAberration.value = 0.0035 + hurt * 0.006;

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
}

// ---------------------------------------------------------------- boot
refreshBestLine();
updateAmmoHud();
updateVitalsHud();
hud.flashBtn.textContent = 'FLASHLIGHT [F] ON';
hud.loading.classList.add('hidden');
hud.menu.classList.remove('hidden');
document.body.classList.add('in-menu');
bindSettings();
if (params.get('stats') === '1') hud.perf.classList.add('show');
if (launchWave > 0) startRun(launchWave);
requestAnimationFrame(frame);
