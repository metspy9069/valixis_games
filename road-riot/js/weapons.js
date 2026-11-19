// Road Riot 3D - Active Weapons, Homing Missiles, EMP Systems & Cyber Drone Lasers
import * as THREE from 'three';

export class WeaponSystem {
  constructor(scene, trafficManager, audio) {
    this.scene = scene;
    this.traffic = trafficManager;
    this.audio = audio;

    this.activeMissiles = [];
    this.activeEmpRings = [];
    this.activeLasers = [];
  }

  clear() {
    this.activeMissiles.forEach(m => this.scene.remove(m.mesh));
    this.activeEmpRings.forEach(e => this.scene.remove(e.mesh));
    this.activeLasers.forEach(l => this.scene.remove(l.mesh));
    this.activeMissiles = [];
    this.activeEmpRings = [];
    this.activeLasers = [];
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

    // Thruster Flame
    const flame = new THREE.PointLight(0xff0055, 3.5, 6);
    flame.position.z = 0.8;
    group.add(flame);

    group.position.set(startX, startY, startZ);
    this.scene.add(group);

    // Find nearest non-hit vehicle ahead
    let target = null;
    let closestZ = -999;
    for (const v of this.traffic.vehicles) {
      if (!v.hit && v.mesh.position.z < startZ && v.mesh.position.z > closestZ) {
        closestZ = v.mesh.position.z;
        target = v;
      }
    }

    this.activeMissiles.push({
      mesh: group,
      speed: 70,
      target,
      life: 2.5
    });
  }

  fireDroneLaser(startX, startY, startZ, target) {
    this.audio.play('laser');

    // Dual cyan plasma bolts
    [-0.3, 0.3].forEach(offsetX => {
      const boltGeo = new THREE.BoxGeometry(0.12, 0.12, 1.4);
      const boltMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(startX + offsetX, startY, startZ);
      this.scene.add(bolt);

      this.activeLasers.push({
        mesh: bolt,
        speed: 95,
        target,
        life: 1.5
      });
    });
  }

  triggerEmp(playerPos) {
    this.audio.play('emp');

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
      speed: 52,
      life: 0.75
    });

    // Destroy all vehicles and obstacles in range
    this.traffic.vehicles.forEach(v => {
      const dist = v.mesh.position.distanceTo(playerPos);
      if (dist < 36) {
        v.hit = true;
        this.traffic.spawnExplosion(v.mesh.position, 0x00f0ff, 16);
        v.mesh.position.y += 2.5;
        v.mesh.rotation.z += 0.8;
        v.speed = 1;
      }
    });

    this.traffic.obstacles.forEach(o => {
      const dist = o.mesh.position.distanceTo(playerPos);
      if (dist < 36) {
        o.hit = true;
        this.traffic.spawnExplosion(o.mesh.position, 0x00ffff, 8);
        o.mesh.position.y -= 10;
      }
    });
  }

  update(dt, onVehicleDestroyed) {
    // 1. Update Missiles
    for (let i = this.activeMissiles.length - 1; i >= 0; i--) {
      const m = this.activeMissiles[i];
      m.life -= dt;
      m.mesh.position.z -= m.speed * dt;

      if (m.target && !m.target.hit && this.traffic.vehicles.includes(m.target)) {
        const dx = m.target.mesh.position.x - m.mesh.position.x;
        m.mesh.position.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 18);
      }

      let exploded = false;
      for (let j = this.traffic.vehicles.length - 1; j >= 0; j--) {
        const v = this.traffic.vehicles[j];
        if (m.mesh.position.distanceTo(v.mesh.position) < 3.2) {
          exploded = true;
          v.hit = true;
          this.audio.play('collision');

          // Volatile Chemical Tanker chain reaction
          if (v.isTanker) {
            this.traffic.spawnExplosion(v.mesh.position, 0xff4400, 36);
            this.traffic.spawnExplosion(v.mesh.position, 0xffaa00, 24);
          } else {
            this.traffic.spawnExplosion(v.mesh.position, 0xff2a85, 22);
          }

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

    // 2. Update Drone Lasers
    for (let i = this.activeLasers.length - 1; i >= 0; i--) {
      const l = this.activeLasers[i];
      l.life -= dt;
      l.mesh.position.z -= l.speed * dt;

      let hit = false;
      for (const v of this.traffic.vehicles) {
        if (!v.hit && l.mesh.position.distanceTo(v.mesh.position) < 2.5) {
          hit = true;
          v.hit = true;
          this.audio.play('collision');
          this.traffic.spawnExplosion(v.mesh.position, 0x00ffff, 16);
          v.mesh.position.y += 3.0;
          v.speed = 0;
          if (onVehicleDestroyed) onVehicleDestroyed(v);
          break;
        }
      }

      if (hit || l.life <= 0 || l.mesh.position.z < -180) {
        this.scene.remove(l.mesh);
        this.activeLasers.splice(i, 1);
      }
    }

    // 3. Update EMP Shockwave Rings
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
