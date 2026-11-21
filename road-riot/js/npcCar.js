// road-riot/js/npcCar.js – Traffic Car AI with Circular/Loop Waypoints
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class NPCCar {
  constructor(scene, pathPoints, color = 0x00d9ff, speed = 18) {
    this.scene = scene;
    this.pathPoints = pathPoints || []; // array of THREE.Vector3
    this.loader = new GLTFLoader();
    this.car = null;
    this.progress = Math.random(); // staggered 0..1 along path
    this.speed = speed; // units per second
    this.color = color;
    this.loadModel();
  }

  async loadModel() {
    try {
      const gltf = await this.loader.loadAsync('assets/models/car_placeholder.glb');
      this.car = gltf.scene;

      // Check if loaded model has geometry; if empty placeholder, build stylized procedural car
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

    // Aerodynamic Chassis
    const bodyGeo = new THREE.BoxGeometry(2.0, 0.55, 4.0);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.25,
      metalness: 0.7
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    this.car.add(body);

    // Dark Tinted Glass Canopy
    const roofGeo = new THREE.BoxGeometry(1.5, 0.45, 2.0);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x0a1525,
      roughness: 0.1,
      metalness: 0.9,
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

    // Headlights facing forward (-Z)
    [-0.65, 0.65].forEach(x => {
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.1, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xfffae0 })
      );
      head.position.set(x, 0.55, -2.02);
      this.car.add(head);
    });

    // Wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111620, roughness: 0.8 });
    [-1.0, 1.0].forEach(wx => {
      [-1.2, 1.2].forEach(wz => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 12), wheelMat);
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

    this.scene.add(this.car);
  }

  update(delta) {
    if (!this.car || this.pathPoints.length < 2) return;
    const len = this.pathLength();
    if (len <= 0) return;

    this.progress += (this.speed * delta) / len;
    if (this.progress > 1) this.progress -= 1;

    const pos = this.interpolate(this.progress);
    this.car.position.copy(pos);

    // Orient along tangent
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
