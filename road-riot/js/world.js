// Road Riot 3D - Procedural Highway, Cyber Billboards, Stunt Ramps & Speed Dash Panels
import * as THREE from 'three';

export class WorldManager {
  constructor(scene) {
    this.scene = scene;
    this.segments = [];
    this.segmentLength = 15;
    this.segmentCount = 30;
    this.roadWidth = 18;
    this.currentTheme = 'cyberpunk';

    // Interactive World Objects (Dash Panels & Jump Ramps)
    this.speedPanels = [];
    this.jumpRamps = [];

    // Billboards and props
    this.billboardTextures = [];

    // Weather & Sky
    this.skyMesh = null;
    this.sunMesh = null;
    this.hemiLight = null;
    this.dirLight = null;

    // Challenge Marker
    this.challengeDistance = null;
    this.challengeMarker = null;
    this.challengePassed = false;

    this.initLighting();
    this.initSky();
    this.initBillboardCanvases();
    this.buildInitialHighway();
  }

  initLighting() {
    this.hemiLight = new THREE.HemisphereLight(0x75c8ff, 0x0c1222, 1.8);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffa550, 2.8);
    this.dirLight.position.set(-45, 55, -85);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 240;
    this.dirLight.shadow.camera.left = -30;
    this.dirLight.shadow.camera.right = 30;
    this.dirLight.shadow.camera.top = 30;
    this.dirLight.shadow.camera.bottom = -30;
    this.scene.add(this.dirLight);

    this.ambientMoon = new THREE.DirectionalLight(0x4088ff, 0.65);
    this.ambientMoon.position.set(40, 25, 40);
    this.scene.add(this.ambientMoon);
  }

  initSky() {
    const skyGeo = new THREE.SphereGeometry(260, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x050c1e) },
        midColor: { value: new THREE.Color(0x28123a) },
        botColor: { value: new THREE.Color(0xd94b76) },
        offset: { value: 0.15 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 botColor;
        uniform float offset;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          vec3 col = mix(botColor, midColor, smoothstep(-0.1, 0.35, h));
          col = mix(col, topColor, smoothstep(0.35, 0.85, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(this.skyMesh);

    // Glowing Retro Sun Disc
    const sunGeo = new THREE.SphereGeometry(12, 32, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.position.set(-65, 52, -220);
    this.scene.add(this.sunMesh);

    // Stars particle field
    const starGeo = new THREE.BufferGeometry();
    const starCount = 350;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9);
      const r = 240;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.max(20, r * Math.cos(phi));
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x99ddff, size: 1.6, transparent: true, opacity: 0.85 });
    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);
  }

  initBillboardCanvases() {
    const ads = [
      {
        header: 'VALIXIS GAMES',
        sub: 'OFFICIAL ARCADE PORTAL',
        tag: 'GAMES.VALIXIS.TECH',
        bg: '#051124',
        accent: '#00d9ff',
        glow: '#00aacc'
      },
      {
        header: 'SOUL EMBER',
        sub: 'SURVIVORS ROGUELIKE',
        tag: 'PLAY FREE NOW • 8 HEROES',
        bg: '#200a05',
        accent: '#ff6a00',
        glow: '#ff4400'
      },
      {
        header: 'DEAD SIGNAL',
        sub: 'ZOMBIE SURVIVAL FPS',
        tag: 'HOLD THE RELAY STATION',
        bg: '#08180c',
        accent: '#9dff4d',
        glow: '#66cc22'
      },
      {
        header: 'DEV TYCOON',
        sub: 'BUILD YOUR STUDIO',
        tag: 'FLUTTER WEB ARCADE',
        bg: '#180518',
        accent: '#ff2a85',
        glow: '#cc0066'
      }
    ];

    this.billboardTextures = ads.map(ad => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 256;
      const ctx = c.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 512, 256);
      grad.addColorStop(0, ad.bg);
      grad.addColorStop(1, '#04060a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      ctx.strokeStyle = ad.accent;
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, 496, 240);

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let x = 20; x < 512; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 15);
        ctx.lineTo(x, 240);
        ctx.stroke();
      }

      ctx.shadowColor = ad.glow;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ad.header, 256, 88);

      ctx.shadowBlur = 10;
      ctx.fillStyle = ad.accent;
      ctx.font = 'bold 22px "JetBrains Mono", monospace';
      ctx.fillText(ad.sub, 256, 138);

      ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(70, 172, 372, 46);
      ctx.strokeStyle = ad.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(70, 172, 372, 46);

      ctx.fillStyle = '#f0f6fc';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.fillText(ad.tag, 256, 202);

      const texture = new THREE.CanvasTexture(c);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 16;
      return texture;
    });

    // Overhead Highway Gantry Electronic Signs
    const gc = document.createElement('canvas');
    gc.width = 1024;
    gc.height = 256;
    const gctx = gc.getContext('2d');
    gctx.fillStyle = '#050c18';
    gctx.fillRect(0, 0, 1024, 256);
    gctx.strokeStyle = '#00d9ff';
    gctx.lineWidth = 8;
    gctx.strokeRect(8, 8, 1008, 240);

    // Subtle LED matrix grid background
    gctx.fillStyle = 'rgba(0, 217, 255, 0.05)';
    for (let x = 16; x < 1008; x += 16) {
      for (let y = 16; y < 240; y += 16) {
        gctx.fillRect(x, y, 4, 4);
      }
    }

    gctx.fillStyle = '#00f0ff';
    gctx.font = 'bold 64px "Orbitron", sans-serif';
    gctx.textAlign = 'center';
    gctx.fillText('VALIXIS EXPRESSWAY', 512, 95);

    gctx.fillStyle = '#ffea00';
    gctx.font = 'bold 36px "JetBrains Mono", monospace';
    gctx.fillText('SPEED LIMIT 320 KM/H • ALL LANES OPEN', 512, 175);

    gctx.fillStyle = '#00ff88';
    gctx.font = 'bold 22px "JetBrains Mono", monospace';
    gctx.fillText('▲ LANE 1: CLEAR ▲   ▲ LANE 2: EXPRESS ▲   ▲ LANE 3: CLEAR ▲', 512, 222);

    this.gantryTexture = new THREE.CanvasTexture(gc);
    this.gantryTexture.colorSpace = THREE.SRGBColorSpace;
    this.gantryTexture.anisotropy = 16;
  }

  setBiome(biomeId = 'midnight') {
    this.currentTheme = biomeId;
    if (!this.skyMat) return;

    if (biomeId === 'canyon') {
      // Sunset Canyon: Amber twilight, rich gold sun, warm red sky
      this.skyMat.uniforms.topColor.value.setHex(0x1a0826);
      this.skyMat.uniforms.midColor.value.setHex(0xb84318);
      this.skyMat.uniforms.botColor.value.setHex(0xffaa33);
      if (this.dirLight) this.dirLight.color.setHex(0xff8833);
      if (this.hemiLight) this.hemiLight.color.setHex(0xffaa66);
      if (this.sunMesh) this.sunMesh.material.color.setHex(0xffcc00);
      if (this.scene.fog) this.scene.fog.color.setHex(0x280e1a);
    } else if (biomeId === 'neotokyo') {
      // Neo-Tokyo Rain: Moody teal and violet skyline, rainy atmosphere
      this.skyMat.uniforms.topColor.value.setHex(0x020712);
      this.skyMat.uniforms.midColor.value.setHex(0x180b2a);
      this.skyMat.uniforms.botColor.value.setHex(0x00d9ff);
      if (this.dirLight) this.dirLight.color.setHex(0x40a0ff);
      if (this.hemiLight) this.hemiLight.color.setHex(0x20e0ff);
      if (this.sunMesh) this.sunMesh.material.color.setHex(0x00f0ff);
      if (this.scene.fog) this.scene.fog.color.setHex(0x061120);
    } else {
      // Midnight Metropolis (Default)
      this.skyMat.uniforms.topColor.value.setHex(0x050c1e);
      this.skyMat.uniforms.midColor.value.setHex(0x28123a);
      this.skyMat.uniforms.botColor.value.setHex(0xd94b76);
      if (this.dirLight) this.dirLight.color.setHex(0xffa550);
      if (this.hemiLight) this.hemiLight.color.setHex(0x75c8ff);
      if (this.sunMesh) this.sunMesh.material.color.setHex(0xffaa33);
      if (this.scene.fog) this.scene.fog.color.setHex(0x0c1322);
    }
  }

  buildInitialHighway() {
    for (let i = 0; i < this.segmentCount; i++) {
      this.createSegment(i);
    }

    const foundationGeo = new THREE.BoxGeometry(this.roadWidth + 4, 0.4, 4000);
    const foundationMat = new THREE.MeshStandardMaterial({ color: 0x0c121e, roughness: 0.9 });
    this.foundation = new THREE.Mesh(foundationGeo, foundationMat);
    this.foundation.position.set(0, -0.4, -1800);
    this.scene.add(this.foundation);
  }

  createSegment(index) {
    const group = new THREE.Group();
    group.position.z = -index * this.segmentLength;

    // Road Surface
    const roadGeo = new THREE.BoxGeometry(this.roadWidth, 0.3, this.segmentLength);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x181e28,
      roughness: 0.75,
      metalness: 0.1
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.position.y = -0.15;
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // Glowing Neon Lane Dividers (Lanes at -6, 0, +6; dividers at -3, +3)
    [-3, 3].forEach(x => {
      const dashGeo = new THREE.BoxGeometry(0.16, 0.04, 3.8);
      const dashMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff });
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(x, 0.02, 0);
      group.add(dash);
    });

    // Guard Rails & Neon Shoulder Strips
    [-this.roadWidth / 2, this.roadWidth / 2].forEach((x, side) => {
      const curbGeo = new THREE.BoxGeometry(0.8, 0.35, this.segmentLength);
      const curbMat = new THREE.MeshStandardMaterial({ color: 0x222e40, roughness: 0.8 });
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(x + (side === 0 ? -0.4 : 0.4), 0.05, 0);
      group.add(curb);

      const neonStripGeo = new THREE.BoxGeometry(0.12, 0.1, this.segmentLength);
      const neonStripMat = new THREE.MeshBasicMaterial({ color: side === 0 ? 0xff2a85 : 0x00d9ff });
      const neonStrip = new THREE.Mesh(neonStripGeo, neonStripMat);
      neonStrip.position.set(x, 0.18, 0);
      group.add(neonStrip);

      const walkGeo = new THREE.BoxGeometry(7, 0.2, this.segmentLength);
      const walkMat = new THREE.MeshStandardMaterial({ color: 0x0d1422, roughness: 0.95 });
      const walk = new THREE.Mesh(walkGeo, walkMat);
      walk.position.set(x + (side === 0 ? -4.3 : 4.3), -0.05, 0);
      group.add(walk);
    });

    // Street Lights (every 3 segments)
    if (index % 3 === 0) {
      this.createStreetLight(group, -10.2, 1);
      this.createStreetLight(group, 10.2, -1);
    }

    // Overhead Gantry Sign (every 8 segments)
    if (index % 8 === 0) {
      this.createOverheadGantry(group);
    }

    // Neon Cyber Billboard (every 5 segments)
    if (index % 5 === 2) {
      const side = (index % 10 === 2) ? -1 : 1;
      this.createCyberBillboard(group, side * 15.5, (index / 5) % this.billboardTextures.length);
    }

    // Roadside Buildings
    this.createRoadsideBuildings(group, index);

    // Interactive Highway Objects:
    // Stunt Jump Ramp (every 11 segments, in one lane)
    if (index % 11 === 4) {
      const rampLane = [-6, 0, 6][(index * 2) % 3];
      this.createJumpRamp(group, rampLane);
    }

    // Highway Speed Booster Panel (every 7 segments, in one lane)
    if (index % 7 === 3) {
      const boostLane = [-6, 0, 6][(index * 3) % 3];
      this.createSpeedPanel(group, boostLane);
    }

    this.scene.add(group);
    this.segments.push(group);
  }

  createJumpRamp(parent, lane) {
    const rampGroup = new THREE.Group();
    const w = 2.8;
    const l = 4.8;
    const hw = w / 2;
    const hl = l / 2;
    const h0 = 0.03; // Flush with asphalt at entrance (+Z)
    const h1 = 1.35; // Elevated takeoff lip at (-Z)

    // Mathematically exact forward-launching wedge geometry
    // Entrance at +Z (hl), Takeoff Lip at -Z (-hl)
    const positions = [
      // Top incline deck (2 triangles)
      -hw, h0, hl,   hw, h0, hl,   hw, h1, -hl,
      -hw, h0, hl,   hw, h1, -hl,  -hw, h1, -hl,
      // Back vertical drop face at takeoff lip (-hl)
      -hw, h1, -hl,  hw, h1, -hl,  hw, 0, -hl,
      -hw, h1, -hl,  hw, 0, -hl,   -hw, 0, -hl,
      // Left side triangular wall
      -hw, 0, hl,    -hw, h0, hl,  -hw, h1, -hl,
      -hw, 0, hl,    -hw, h1, -hl, -hw, 0, -hl,
      // Right side triangular wall
      hw, 0, hl,     hw, h1, -hl,  hw, h0, hl,
      hw, 0, hl,     hw, 0, -hl,   hw, h1, -hl,
      // Bottom face flush on asphalt
      -hw, 0, hl,    hw, 0, hl,    hw, 0, -hl,
      -hw, 0, hl,    hw, 0, -hl,   -hw, 0, -hl
    ];

    const rampGeo = new THREE.BufferGeometry();
    rampGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    rampGeo.computeVertexNormals();

    const rampMat = new THREE.MeshStandardMaterial({
      color: 0xff6a00,
      roughness: 0.4,
      metalness: 0.65
    });
    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    rampGroup.add(rampMesh);

    // Glowing Runway Chevrons on incline pointing forward up to takeoff (-Z)
    const inclineAngle = Math.atan2(h1 - h0, l); // ~15.3 degrees
    const chevMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
    [-1.2, 0.0, 1.2].forEach(relZ => {
      // Calculate height on incline for each chevron
      const t = (hl - relZ) / l;
      const yPos = h0 + t * (h1 - h0) + 0.025;
      const chev = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.03, 0.4), chevMat);
      chev.position.set(0, yPos, relZ);
      chev.rotation.x = -inclineAngle;
      rampGroup.add(chev);
    });

    // Elevated Glowing Takeoff Lip across -Z edge
    const lipMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
    const lipMesh = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.1, 0.16), lipMat);
    lipMesh.position.set(0, h1 + 0.04, -hl);
    rampGroup.add(lipMesh);

    // Takeoff Lip Hazard LED Light
    const lipLight = new THREE.PointLight(0xffaa00, 2.2, 7.0);
    lipLight.position.set(0, h1 + 0.4, -hl);
    rampGroup.add(lipLight);

    // Left and Right Caution Guardrails
    const railMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, metalness: 0.8, roughness: 0.3 });
    [-hw - 0.06, hw + 0.06].forEach(x => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, l), railMat);
      rail.position.set(x, (h1 + h0) / 2 + 0.18, 0);
      rail.rotation.x = -inclineAngle;
      rampGroup.add(rail);

      // Warning hazard stripe on rail
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, l), chevMat);
      stripe.position.set(x, (h1 + h0) / 2 + 0.25, 0);
      stripe.rotation.x = -inclineAngle;
      rampGroup.add(stripe);
    });

    rampGroup.position.set(lane, 0, 0);
    parent.add(rampGroup);

    this.jumpRamps.push({ parent, lane, mesh: rampGroup, triggered: false });
  }

  createSpeedPanel(parent, lane) {
    const panelGroup = new THREE.Group();

    // Dark Carbon Foundation Pad
    const padMat = new THREE.MeshStandardMaterial({ color: 0x07111a, roughness: 0.7, metalness: 0.4 });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.02, 4.4), padMat);
    pad.position.set(0, 0.01, 0);
    panelGroup.add(pad);

    // Glowing Electric Cyan Border Frame
    const borderMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff });
    [-1.25, 1.25].forEach(x => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 4.4), borderMat);
      rail.position.set(x, 0.025, 0);
      panelGroup.add(rail);
    });

    // 4 High-Speed Forward Chevrons pointing toward -Z
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    [-1.3, -0.4, 0.5, 1.4].forEach(z => {
      const chev = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.035, 0.4), arrowMat);
      chev.position.set(0, 0.03, z);
      panelGroup.add(chev);
    });

    // Twin Energy Beacon Pylons with Pulsing Cyan Glow
    [-1.4, 1.4].forEach(x => {
      const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 8), pylonMat);
      pylon.position.set(x, 0.35, 0);
      panelGroup.add(pylon);

      const beaconOrb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), borderMat);
      beaconOrb.position.set(x, 0.72, 0);
      panelGroup.add(beaconOrb);

      const pylonLight = new THREE.PointLight(0x00d9ff, 1.8, 5.0);
      pylonLight.position.set(x, 0.75, 0);
      panelGroup.add(pylonLight);
    });

    panelGroup.position.set(lane, 0, 0);
    parent.add(panelGroup);

    this.speedPanels.push({ parent, lane, mesh: panelGroup, triggered: false });
  }

  createStreetLight(parent, x, dir) {
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.8, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 2.4, 0);
    parent.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), poleMat);
    arm.position.set(x + dir * 0.5, 4.7, 0);
    parent.add(arm);

    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: 0xffe099 }));
    lamp.position.set(x + dir * 1.0, 4.65, 0);
    parent.add(lamp);
  }

  createOverheadGantry(parent) {
    const gantry = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.4 });

    [-10, 10].forEach(x => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.5, 8), frameMat);
      post.position.set(x, 3.25, 0);
      gantry.add(post);
    });

    const truss = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.4, 0.4), frameMat);
    truss.position.set(0, 6.2, 0);
    gantry.add(truss);

    // Dark housing backing
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 2.3, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x09101a, roughness: 0.8, metalness: 0.5 })
    );
    housing.position.set(0, 5.0, 0);
    gantry.add(housing);

    // Front high-res LED Matrix face facing approaching driver (+Z)
    const signMat = new THREE.MeshBasicMaterial({ map: this.gantryTexture });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(14.8, 2.0), signMat);
    signMesh.position.set(0, 5.0, 0.14);
    gantry.add(signMesh);

    parent.add(gantry);
  }

  createCyberBillboard(parent, x, adIndex) {
    const texture = this.billboardTextures[adIndex] || this.billboardTextures[0];
    const boardMat = new THREE.MeshBasicMaterial({ map: texture });
    const boardGeo = new THREE.BoxGeometry(8.5, 4.25, 0.3);
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(x, 5.8, 0);
    board.rotation.y = x < 0 ? 0.2 : -0.2;

    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 4.0, 8), pylonMat);
    pylon.position.set(x, 2.0, 0);

    parent.add(board);
    parent.add(pylon);
  }

  createRoadsideBuildings(parent, index) {
    const palette = [0x0e1726, 0x141f33, 0x1a243b, 0x0a121f];
    [-24, 24].forEach((x, side) => {
      const height = 12 + ((index * 7 + side * 5) % 24);
      const width = 8 + (index % 4) * 2;
      const bGeo = new THREE.BoxGeometry(width, height, 11);
      const bMat = new THREE.MeshStandardMaterial({
        color: palette[(index + side) % palette.length],
        roughness: 0.7,
        metalness: 0.2
      });
      const building = new THREE.Mesh(bGeo, bMat);
      building.position.set(x, height / 2 - 0.2, 0);
      parent.add(building);

      const winGeo = new THREE.BoxGeometry(0.4, 0.6, 0.05);
      const winMatA = new THREE.MeshBasicMaterial({ color: 0x00d9ff });
      const winMatB = new THREE.MeshBasicMaterial({ color: 0xffaa22 });

      for (let r = 2; r < height - 2; r += 2.2) {
        for (let c = -width / 2 + 1.2; c < width / 2 - 1.2; c += 1.8) {
          if (((index + r + c) % 3) === 0) {
            const win = new THREE.Mesh(winGeo, ((index + r) % 2 === 0) ? winMatA : winMatB);
            win.position.set(x + (side === 0 ? width / 2 + 0.05 : -width / 2 - 0.05), r, c);
            win.rotation.y = Math.PI / 2;
            parent.add(win);
          }
        }
      }
    });
  }

  setChallengeTarget(distance, challengerName = 'Rival') {
    this.challengeDistance = distance;
    this.challengePassed = false;

    const beaconGroup = new THREE.Group();
    const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 80, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffb800,
      transparent: true,
      opacity: 0.75
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 40;
    beaconGroup.add(beam);

    [5, 12, 22].forEach(h => {
      const ringGeo = new THREE.TorusGeometry(1.6, 0.15, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2a85 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = h;
      ring.rotation.x = Math.PI / 2;
      beaconGroup.add(ring);
    });

    beaconGroup.position.set(0, 0, -distance);
    this.scene.add(beaconGroup);
    this.challengeMarker = beaconGroup;
  }

  update(dt, speed, currentDistance, callbacks = {}) {
    const trackTotalLength = this.segmentCount * this.segmentLength;

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      seg.position.z += speed * dt;
      if (seg.position.z > this.segmentLength) {
        seg.position.z -= trackTotalLength;
        // Reset interactive triggers for recycled segment
        this.jumpRamps.forEach(r => { if (r.parent === seg) r.triggered = false; });
        this.speedPanels.forEach(p => { if (p.parent === seg) p.triggered = false; });
      }
    }

    // Challenger Beacon
    if (this.challengeMarker) {
      this.challengeMarker.position.z += speed * dt;
      this.challengeMarker.rotation.y += dt * 1.5;

      if (!this.challengePassed && this.challengeMarker.position.z > -8) {
        this.challengePassed = true;
        if (callbacks.onChallengeDefeated) callbacks.onChallengeDefeated();
      }
    }

    if (this.skyMesh) {
      this.skyMesh.rotation.y += dt * 0.01;
    }
    if (this.stars) {
      this.stars.rotation.y += dt * 0.005;
    }
  }
}
