// road-riot/js/npcCar.js – Highway Street Racer AI with Relative Speed & Lane Dynamics
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class NPCCar {
  constructor(scene, pathPoints, color = 0x00d9ff, speed = 21) {
    this.scene = scene;
    this.pathPoints = pathPoints || []; // fallback path support
    this.loader = new GLTFLoader();
    this.car = null;
    this.progress = Math.random();
    this.speed = speed; // units per second (~80 km/h)
    this.color = color;

    // Highway Lane Relative Coordinates (Standard 3-Lane Highway Track)
    this.lanes = [-4.6, 0, 4.6];
    this.currentLane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
    this.targetX = this.currentLane;
    this.laneChangeTimer = 4.0 + Math.random() * 6.0;
    this.isColliding = false;

    this.loadModel();
  }

  async loadModel() {
    try {
      const gltf = await this.loader.loadAsync('assets/models/car_placeholder.glb');
      this.car = gltf.scene;

      let hasGeometry = false;
      this.car.traverse(node => {
        if (node.isMesh && node.geometry) hasGeometry = true;
      });

      if (!hasGeometry) {
        this.buildProceduralCarMesh();
      } else {
        this.car.scale.set(0.7, 0.7, 0.7);
        this.scene.add(this.car);
      }
    } catch (e) {
      this.buildProceduralCarMesh();
    }
  }

  buildProceduralCarMesh() {
    this.car = new THREE.Group();

    // Aerodynamic GT Chassis
    const bodyGeo = new THREE.BoxGeometry(2.0, 0.55, 4.0);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.22,
      metalness: 0.8
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    this.car.add(body);

    // Dark Tinted Glass Canopy
    const roofGeo = new THREE.BoxGeometry(1.5, 0.45, 2.0);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x08101a,
      roughness: 0.08,
      metalness: 0.95,
      transparent: true,
      opacity: 0.85
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 0.95, -0.1);
    this.car.add(roof);

    // Glowing Taillights facing rear (+Z)
    [-0.65, 0.65].forEach(x => {
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.1, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xff1644 })
      );
      tail.position.set(x, 0.55, 2.02);
      this.car.add(tail);
    });

    // Projector Headlights facing forward (-Z)
    [-0.65, 0.65].forEach(x => {
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.1, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xddf4ff })
      );
      head.position.set(x, 0.55, -2.02);
      this.car.add(head);
    });

    // Wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111620, roughness: 0.8 });
    [-1.0, 1.0].forEach(wx => {
      [-1.2, 1.2].forEach(wz => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 16), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.38, wz);
        this.car.add(wheel);
      });
    });

    this.car.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    // Initial position on highway
    const spawnZ = -50 - Math.random() * 120;
    this.car.position.set(this.currentLane, 0, spawnZ);
    this.scene.add(this.car);
  }

  update(delta, playerSpeed = 0) {
    if (!this.car) return;

    if (playerSpeed > 0) {
      // 1. Natural Relative Highway Scrolling:
      // The road moves toward camera at playerSpeed * delta.
      // The NPC drives forward at this.speed * delta.
      // Net change in Z: (playerSpeed - this.speed) * delta.
      this.car.position.z += (playerSpeed - this.speed) * delta;

      // 2. Autonomous Lane Decisions (Smooth Lane Swapping)
      this.laneChangeTimer -= delta;
      if (this.laneChangeTimer <= 0) {
        this.laneChangeTimer = 5.0 + Math.random() * 8.0;
        this.currentLane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
        this.targetX = this.currentLane;
      }

      // Smooth Lane Steer & Yaw Tilt
      const dx = this.targetX - this.car.position.x;
      this.car.position.x += dx * Math.min(1, delta * 3.5);
      this.car.rotation.y = Math.PI - dx * 0.08;

      // 3. Clean Highway Recycling:
      // When vehicle is scrolled past camera (+Z), recycle ahead of player (-Z)
      if (this.car.position.z > 35) {
        this.car.position.z = -180 - Math.random() * 70;
        this.currentLane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
        this.targetX = this.currentLane;
        this.car.position.x = this.targetX;
        this.speed = 19 + Math.random() * 6;
      }
      return;
    }

    // Fallback: Path Interpolation if static path loop is explicitly tested without playerSpeed
    if (this.pathPoints.length < 2) return;
    const len = this.pathLength();
    if (len <= 0) return;

    this.progress += (this.speed * delta) / len;
    if (this.progress > 1) this.progress -= 1;

    const pos = this.interpolate(this.progress);
    this.car.position.copy(pos);

    const nextT = (this.progress + 0.01) % 1;
    const nextPos = this.interpolate(nextT);
    this.car.lookAt(nextPos);
  }

  pathLength() {
    let len = 0;
    for (let i = 0; i < this.pathPoints.length; i++) {
      const p1 = this.pathPoints[i];
      const p2 = this.pathPoints[(i + 1) % this.pathPoints.length];
      len += p1.distanceTo(p2);
    }
    return len;
  }

  interpolate(t) {
    const totalLen = this.pathLength();
    let target = (t % 1) * totalLen;
    if (target < 0) target += totalLen;

    let accumulated = 0;
    const count = this.pathPoints.length;

    for (let i = 0; i < count; i++) {
      const p1 = this.pathPoints[i];
      const p2 = this.pathPoints[(i + 1) % count];
      const segLen = p1.distanceTo(p2);

      if (accumulated + segLen >= target) {
        const segT = segLen > 0.0001 ? (target - accumulated) / segLen : 0;
        return new THREE.Vector3().lerpVectors(p1, p2, segT);
      }
      accumulated += segLen;
    }

    return this.pathPoints[0].clone();
  }

  destroy() {
    if (this.car) {
      this.scene.remove(this.car);
      this.car = null;
    }
  }
}
