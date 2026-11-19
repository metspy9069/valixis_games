// Road Riot 3D - Active Weapons, Missiles & EMP Systems
import * as THREE from 'three';

export class WeaponSystem {
  constructor(scene, trafficManager, audio) {
    this.scene = scene;
    this.traffic = trafficManager;
    this.audio = audio;

    this.activeMissiles = [];
    this.activeEmpRings = [];
  }

  clear() {
    this.activeMissiles.forEach(m => this.scene.remove(m.mesh));
    this.activeEmpRings.forEach(e => this.scene.remove(e.mesh));
    this.activeMissiles = [];
    this.activeEmpRings = [];
  }

  fireMissile(startX, startY, startZ) {
    this.audio.play('missile');

    const group = new THREE.Group();
    // Rocket Body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 1.2, 10),
      new THREE.MeshStandardMaterial({ color: 0xff2a85, metalness: 0.8, roughness: 0.2 })
    );
    body.rotation.x = Math.PI / 2;
    group.add(body);

    // Rocket Nose Cone
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.45, 10),
      new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    );
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -0.7;
    group.add(nose);

    // Rocket Thruster Flame
    const flame = new THREE.PointLight(0xff0055, 3.5, 6);
    flame.position.z = 0.8;
    group.add(flame);

    group.position.set(startX, startY, startZ);
    this.scene.add(group);

    // Find nearest vehicle ahead to home onto
    let target = null;
    let closestZ = -999;
    for (const v of this.traffic.vehicles) {
      if (v.mesh.position.z < startZ && v.mesh.position.z > closestZ) {
        closestZ = v.mesh.position.z;
        target = v;
      }
    }

    this.activeMissiles.push({
      mesh: group,
      speed: 68,
      target,
      life: 2.5
    });
  }

  triggerEmp(playerPos) {
    this.audio.play('emp');

    // Expanding EMP Torus Ring
    const geo = new THREE.TorusGeometry(1.5, 0.25, 8, 32);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.95
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.copy(playerPos);
    this.scene.add(ring);

    this.activeEmpRings.push({
      mesh: ring,
      radius: 1.5,
      maxRadius: 36,
      speed: 48,
      life: 0.75
    });

    // Destroy all vehicles and obstacles in range immediately
    this.traffic.vehicles.forEach(v => {
      const dist = v.mesh.position.distanceTo(playerPos);
      if (dist < 36) {
        v.hit = true;
        this.traffic.spawnExplosion(v.mesh.position, 0x00f0ff, 14);
        v.mesh.position.y += 1.8;
        v.mesh.rotation.z += 0.8;
        v.speed = 2;
      }
    });

    this.traffic.obstacles.forEach(o => {
      const dist = o.mesh.position.distanceTo(playerPos);
      if (dist < 36) {
        o.hit = true;
        this.traffic.spawnExplosion(o.mesh.position, 0x00ffff, 8);
        o.mesh.position.y -= 10; // remove
      }
    });
  }

  update(dt, onVehicleDestroyed) {
    // 1. Update Missiles
    for (let i = this.activeMissiles.length - 1; i >= 0; i--) {
      const m = this.activeMissiles[i];
      m.life -= dt;
      m.mesh.position.z -= m.speed * dt;

      // Homing steer towards target
      if (m.target && !m.target.hit && this.traffic.vehicles.includes(m.target)) {
        const dx = m.target.mesh.position.x - m.mesh.position.x;
        m.mesh.position.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 16);
      }

      // Check collision with vehicles
      let exploded = false;
      for (let j = this.traffic.vehicles.length - 1; j >= 0; j--) {
        const v = this.traffic.vehicles[j];
        if (m.mesh.position.distanceTo(v.mesh.position) < 3.2) {
          exploded = true;
          v.hit = true;
          this.audio.play('collision');
          this.traffic.spawnExplosion(v.mesh.position, 0xff2a85, 22);

          // Launch destroyed vehicle cartwheeling away
          v.mesh.position.y += 4.5;
          v.mesh.rotation.x += 1.5;
          v.mesh.rotation.z += 1.2;
          v.speed = 0;

          if (onVehicleDestroyed) onVehicleDestroyed(v);
          break;
        }
      }

      if (exploded || m.life <= 0 || m.mesh.position.z < -200) {
        this.scene.remove(m.mesh);
        this.activeMissiles.splice(i, 1);
      }
    }

    // 2. Update EMP Shockwave Rings
    for (let i = this.activeEmpRings.length - 1; i >= 0; i--) {
      const e = this.activeEmpRings[i];
      e.radius += e.speed * dt;
      e.mesh.scale.set(e.radius, e.radius, e.radius);
      e.mesh.material.opacity = Math.max(0, 1 - e.radius / e.maxRadius);

      if (e.radius >= e.maxRadius) {
        this.scene.remove(e.mesh);
        this.activeEmpRings.splice(i, 1);
      }
    }
  }
}
