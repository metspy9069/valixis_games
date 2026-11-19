// Road Riot 3D - Procedural Highway, Cyber Billboards & World Systems
import * as THREE from 'three';

export class WorldManager {
  constructor(scene) {
    this.scene = scene;
    this.segments = [];
    this.segmentLength = 15;
    this.segmentCount = 30;
    this.roadWidth = 18;
    this.currentTheme = 'cyberpunk'; // 'cyberpunk', 'sunset', 'storm'

    // Billboards and props
    this.billboardTextures = [];
    this.decorGroups = [];

    // Weather & Sky
    this.skyMesh = null;
    this.sunMesh = null;
    this.hemiLight = null;
    this.dirLight = null;
    this.rainParticles = null;

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
    // Synthwave dome with custom gradient shader
    const skyGeo = new THREE.SphereGeometry(260, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x050c1e) },
        midColor: { value: new THREE.Color(0x28123a) },
        botColor: { value: new THREE.Color(0xd94b76) },
        offset: { value: 0.15 },
        exponent: { value: 0.8 }
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
        uniform float exponent;
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
    // Generate high-resolution cyber billboards driving traffic to VALIXIS Games!
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
        tag: 'PLAY FREE NOW &bull; 8 HEROES',
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
        header: 'ROAD RIOT 3D',
        sub: 'VALIXIS HYPERSPEED',
        tag: 'CHALLENGE YOUR FRIENDS',
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

      // Card Background with neon gradient
      const grad = ctx.createLinearGradient(0, 0, 512, 256);
      grad.addColorStop(0, ad.bg);
      grad.addColorStop(1, '#04060a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      // Glowing Neon Border
      ctx.strokeStyle = ad.accent;
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, 496, 240);

      // Tech Grid Pattern
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let x = 20; x < 512; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 15);
        ctx.lineTo(x, 240);
        ctx.stroke();
      }

      // Title
      ctx.shadowColor = ad.glow;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ad.header, 256, 88);

      // Subtitle
      ctx.shadowBlur = 10;
      ctx.fillStyle = ad.accent;
      ctx.font = 'bold 22px "JetBrains Mono", monospace';
      ctx.fillText(ad.sub, 256, 138);

      // Tagline pill
      ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(70, 172, 372, 46);
      ctx.strokeStyle = ad.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(70, 172, 372, 46);

      ctx.fillStyle = '#f0f6fc';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.fillText(ad.tag.replace('&bull;', '•'), 256, 202);

      const texture = new THREE.CanvasTexture(c);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    });
  }

  buildInitialHighway() {
    for (let i = 0; i < this.segmentCount; i++) {
      this.createSegment(i);
    }

    // Infinite foundation underneath
    const foundationGeo = new THREE.BoxGeometry(this.roadWidth + 4, 0.4, 4000);
    const foundationMat = new THREE.MeshStandardMaterial({ color: 0x0c121e, roughness: 0.9 });
    this.foundation = new THREE.Mesh(foundationGeo, foundationMat);
    this.foundation.position.set(0, -0.4, -1800);
    this.scene.add(this.foundation);
  }

  createSegment(index) {
    const group = new THREE.Group();
    group.position.z = -index * this.segmentLength;

    // Road Surface with asphalt texture look
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

    // Glowing Neon Lane Dividers (Three Lanes: -6, 0, +6)
    // Dividers at x = -3 and x = +3
    [-3, 3].forEach(x => {
      const dashGeo = new THREE.BoxGeometry(0.16, 0.04, 3.8);
      const dashMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff });
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(x, 0.02, 0);
      group.add(dash);
    });

    // Guard Rails & Neon Shoulder Strips
    [-this.roadWidth / 2, this.roadWidth / 2].forEach((x, side) => {
      // Curb
      const curbGeo = new THREE.BoxGeometry(0.8, 0.35, this.segmentLength);
      const curbMat = new THREE.MeshStandardMaterial({ color: 0x222e40, roughness: 0.8 });
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(x + (side === 0 ? -0.4 : 0.4), 0.05, 0);
      group.add(curb);

      // Neon Guide Strip
      const neonStripGeo = new THREE.BoxGeometry(0.12, 0.1, this.segmentLength);
      const neonStripMat = new THREE.MeshBasicMaterial({ color: side === 0 ? 0xff2a85 : 0x00d9ff });
      const neonStrip = new THREE.Mesh(neonStripGeo, neonStripMat);
      neonStrip.position.set(x, 0.18, 0);
      group.add(neonStrip);

      // Sidewalk / Verge
      const walkGeo = new THREE.BoxGeometry(7, 0.2, this.segmentLength);
      const walkMat = new THREE.MeshStandardMaterial({ color: 0x0d1422, roughness: 0.95 });
      const walk = new THREE.Mesh(walkGeo, walkMat);
      walk.position.set(x + (side === 0 ? -4.3 : 4.3), -0.05, 0);
      group.add(walk);
    });

    // Street Light Posts (every 3 segments)
    if (index % 3 === 0) {
      this.createStreetLight(group, -10.2, 1);
      this.createStreetLight(group, 10.2, -1);
    }

    // Overhead Highway Sign Gantry (every 9 segments)
    if (index % 9 === 0) {
      this.createOverheadGantry(group);
    }

    // Neon Cyber Billboard (alternating sides every 5 segments)
    if (index % 5 === 2) {
      const side = (index % 10 === 2) ? -1 : 1;
      this.createCyberBillboard(group, side * 15.5, (index / 5) % this.billboardTextures.length);
    }

    // City Skyscrapers & Buildings
    this.createRoadsideBuildings(group, index);

    this.scene.add(group);
    this.segments.push(group);
  }

  createStreetLight(parent, x, dir) {
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.8, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 2.4, 0);
    parent.add(pole);

    // Lamp Arm
    const armGeo = new THREE.BoxGeometry(1.2, 0.08, 0.08);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(x + dir * 0.5, 4.7, 0);
    parent.add(arm);

    // Glowing Lamp Fixture
    const lampGeo = new THREE.BoxGeometry(0.5, 0.12, 0.3);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe099 });
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(x + dir * 1.0, 4.65, 0);
    parent.add(lamp);
  }

  createOverheadGantry(parent) {
    const gantry = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.4 });

    // Left and Right Posts
    [-10, 10].forEach(x => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.5, 8), frameMat);
      post.position.set(x, 3.25, 0);
      gantry.add(post);
    });

    // Cross Truss
    const truss = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.4, 0.4), frameMat);
    truss.position.set(0, 6.2, 0);
    gantry.add(truss);

    // Overhead Digital Signs
    [-5, 0, 5].forEach(x => {
      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 1.2, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x07111e, emissive: 0x00d9ff, emissiveIntensity: 0.35 })
      );
      signMesh.position.set(x, 5.4, 0);
      gantry.add(signMesh);
    });

    parent.add(gantry);
  }

  createCyberBillboard(parent, x, adIndex) {
    const texture = this.billboardTextures[adIndex] || this.billboardTextures[0];
    const boardMat = new THREE.MeshBasicMaterial({ map: texture });
    const boardGeo = new THREE.BoxGeometry(8.5, 4.25, 0.3);
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(x, 5.8, 0);
    board.rotation.y = x < 0 ? 0.2 : -0.2;

    // Support Pylons
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

      // Lit Windows
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

  // Challenger Marker Support (Viral Ghost / Rival Beacon)
  setChallengeTarget(distance, challengerName = 'Rival') {
    this.challengeDistance = distance;
    this.challengePassed = false;

    // Create glowing neon beacon cylinder reaching up to the sky
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

    // Glowing rings around beacon
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

  setTheme(themeName) {
    this.currentTheme = themeName;
    if (themeName === 'sunset') {
      this.skyMat.uniforms.topColor.value.setHex(0x190826);
      this.skyMat.uniforms.midColor.value.setHex(0x731a4e);
      this.skyMat.uniforms.botColor.value.setHex(0xf57f44);
      this.sunMesh.material.color.setHex(0xff7722);
      this.dirLight.color.setHex(0xff9944);
    } else if (themeName === 'storm') {
      this.skyMat.uniforms.topColor.value.setHex(0x04060c);
      this.skyMat.uniforms.midColor.value.setHex(0x0d1526);
      this.skyMat.uniforms.botColor.value.setHex(0x1b2840);
      this.sunMesh.visible = false;
      this.dirLight.color.setHex(0x6688aa);
      this.hemiLight.color.setHex(0x446699);
    } else {
      // Cyberpunk default
      this.skyMat.uniforms.topColor.value.setHex(0x050c1e);
      this.skyMat.uniforms.midColor.value.setHex(0x28123a);
      this.skyMat.uniforms.botColor.value.setHex(0xd94b76);
      this.sunMesh.visible = true;
      this.sunMesh.material.color.setHex(0xffaa33);
      this.dirLight.color.setHex(0xffa550);
    }
  }

  update(dt, speed, currentDistance, onChallengeDefeated) {
    const trackTotalLength = this.segmentCount * this.segmentLength;

    // Scroll road segments smoothly backward
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      seg.position.z += speed * dt;
      if (seg.position.z > this.segmentLength) {
        seg.position.z -= trackTotalLength;
      }
    }

    // Animate Challenge Beacon
    if (this.challengeMarker) {
      this.challengeMarker.position.z += speed * dt;
      this.challengeMarker.rotation.y += dt * 1.5;

      // Check if player passed the rival mark!
      if (!this.challengePassed && this.challengeMarker.position.z > -8) {
        this.challengePassed = true;
        if (onChallengeDefeated) onChallengeDefeated();
      }
    }

    // Subtle sky rotation for depth
    if (this.skyMesh) {
      this.skyMesh.rotation.y += dt * 0.01;
    }
    if (this.stars) {
      this.stars.rotation.y += dt * 0.005;
    }
  }
}
