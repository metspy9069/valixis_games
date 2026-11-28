// Navigation flow field, Boids swarm flocking & dynamic obstacle avoidance for the horde.
// Implements:
// 1. Coarse flowfield BFS with continuous central-difference corner-smoothing (Day 9).
// 2. Boids-inspired two-tier swarm separation (lateral fan-out across broad avenues, eliminating conga lines).
// 3. Predictive whisker / ray lookahead obstacle avoidance (smoothly steering around building corners and barricades).
// 4. Runner & Lurker perimeter flanking pincer behavior.
// 5. Horde encirclement ring arcs surrounding the player.
import * as THREE from 'three';

export class NavGrid {
  constructor(colliders, cell = 2, extent = 72, radius = 64) {
    this.cell = cell;
    this.extent = extent;
    this.radius = radius;
    this.n = Math.ceil((extent * 2) / cell);
    this.size = this.n * this.n;
    this.blocked = new Uint8Array(this.size);
    this.dist = new Uint16Array(this.size);
    this.queue = new Int32Array(this.size);
    this.blocked.fill(0);
    this.dist.fill(65535);
    this._out = new THREE.Vector3();
    this.build(colliders);
  }

  cellOf(x) {
    return Math.floor((x + this.extent) / this.cell);
  }

  centreOf(i) {
    return -this.extent + (i + 0.5) * this.cell;
  }

  build(colliders) {
    const n = this.n;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = this.centreOf(i);
        const z = this.centreOf(j);
        let blocked = 0;

        if (Math.hypot(x, z) > this.radius) blocked = 1;

        if (!blocked) {
          for (const c of colliders) {
            if (c.height !== undefined && c.height < 0.6) continue;
            if (x > c.minX - 0.5 && x < c.maxX + 0.5 && z > c.minZ - 0.5 && z < c.maxZ + 0.5) {
              blocked = 1;
              break;
            }
          }
        }

        this.blocked[j * n + i] = blocked;
      }
    }
  }

  rebuild(px, pz) {
    const n = this.n;
    const dist = this.dist;
    const queue = this.queue;
    dist.fill(65535);

    const si = this.cellOf(px);
    const sj = this.cellOf(pz);
    if (si < 1 || sj < 1 || si >= n - 1 || sj >= n - 1) return;
    let start = sj * n + si;
    if (this.blocked[start]) return;

    let head = 0;
    let tail = 0;
    dist[start] = 0;
    queue[tail++] = start;

    while (head < tail) {
      const idx = queue[head++];
      const d = dist[idx] + 1;
      const i = idx % n;
      const j = (idx - i) / n;

      if (i > 0) {
        const k = idx - 1;
        if (!this.blocked[k] && dist[k] > d) { dist[k] = d; queue[tail++] = k; }
      }
      if (i < n - 1) {
        const k = idx + 1;
        if (!this.blocked[k] && dist[k] > d) { dist[k] = d; queue[tail++] = k; }
      }
      if (j > 0) {
        const k = idx - n;
        if (!this.blocked[k] && dist[k] > d) { dist[k] = d; queue[tail++] = k; }
      }
      if (j < n - 1) {
        const k = idx + n;
        if (!this.blocked[k] && dist[k] > d) { dist[k] = d; queue[tail++] = k; }
      }
    }
  }

  // Direction toward the player along the flow field, with corner-smoothing gradient fallback.
  direction(x, z, out = this._out) {
    const n = this.n;
    const i = this.cellOf(x);
    const j = this.cellOf(z);
    if (i < 1 || j < 1 || i >= n - 1 || j >= n - 1) return null;

    const here = this.dist[j * n + i];
    let best = here;
    let bi = 0;
    let bj = 0;

    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di;
        const nj = j + dj;
        const k = nj * n + ni;
        if (this.blocked[k]) continue;
        if (di && dj) {
          // No cutting through wall corners.
          if (this.blocked[j * n + ni] || this.blocked[nj * n + i]) continue;
        }
        const d = this.dist[k];
        if (d < best) {
          best = d;
          bi = di;
          bj = dj;
        }
      }
    }

    if (bi === 0 && bj === 0) {
      // Corner Smoothing Fallback (Day 9):
      // When discrete diagonals are blocked by an adjacent corner, evaluate central differences
      // across cardinal neighbors so entities smoothly wrap around building corners without freezing.
      const kLeft = j * n + (i - 1);
      const kRight = j * n + (i + 1);
      const kUp = (j - 1) * n + i;
      const kDown = (j + 1) * n + i;

      let gx = 0;
      let gz = 0;

      if (!this.blocked[kLeft] && !this.blocked[kRight]) {
        gx = (this.dist[kLeft] < 60000 && this.dist[kRight] < 60000) ? (this.dist[kLeft] - this.dist[kRight]) : 0;
      } else if (!this.blocked[kLeft] && this.dist[kLeft] < here) {
        gx = -1;
      } else if (!this.blocked[kRight] && this.dist[kRight] < here) {
        gx = 1;
      }

      if (!this.blocked[kUp] && !this.blocked[kDown]) {
        gz = (this.dist[kUp] < 60000 && this.dist[kDown] < 60000) ? (this.dist[kUp] - this.dist[kDown]) : 0;
      } else if (!this.blocked[kUp] && this.dist[kUp] < here) {
        gz = -1;
      } else if (!this.blocked[kDown] && this.dist[kDown] < here) {
        gz = 1;
      }

      if (Math.abs(gx) + Math.abs(gz) > 1e-4) {
        return out.set(gx, 0, gz).normalize();
      }
      return null;
    }

    return out.set(bi, 0, bj).normalize();
  }
}

/**
 * Checks if a 2D world coordinate lies inside any static obstacle collider.
 */
export function isPointBlocked(x, z, colliders, margin = 0.25) {
  if (!colliders || !colliders.length) return null;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.height !== undefined && c.height < 0.4) continue;
    if (
      x >= c.minX - margin &&
      x <= c.maxX + margin &&
      z >= c.minZ - margin &&
      z <= c.maxZ + margin
    ) {
      return c;
    }
  }
  return null;
}

/**
 * Predictive Whisker Obstacle Avoidance (Day 9).
 * Projects forward, left, and right tactile whiskers to steer around barricades, cars,
 * and building corner intersections before physical collision occurs.
 */
export function probeWhiskerAvoidance(pos, moveDir, colliders, lookahead = 1.35) {
  if (!moveDir || moveDir.lengthSq() < 1e-4 || !colliders || !colliders.length) return null;

  const steer = new THREE.Vector3();
  const dir = moveDir.clone().normalize();
  const lateral = new THREE.Vector3(-dir.z, 0, dir.x);

  // 1. Center Feeler (ahead 1.35m & 0.7m)
  const hitCenter =
    isPointBlocked(pos.x + dir.x * lookahead, pos.z + dir.z * lookahead, colliders, 0.22) ||
    isPointBlocked(pos.x + dir.x * 0.7, pos.z + dir.z * 0.7, colliders, 0.22);

  // 2. Left Whisker (+35 degrees)
  const lx = pos.x + (dir.x * 0.82 + lateral.x * 0.57) * lookahead * 0.9;
  const lz = pos.z + (dir.z * 0.82 + lateral.z * 0.57) * lookahead * 0.9;
  const hitLeft = isPointBlocked(lx, lz, colliders, 0.18);

  // 3. Right Whisker (-35 degrees)
  const rx = pos.x + (dir.x * 0.82 - lateral.x * 0.57) * lookahead * 0.9;
  const rz = pos.z + (dir.z * 0.82 - lateral.z * 0.57) * lookahead * 0.9;
  const hitRight = isPointBlocked(rx, rz, colliders, 0.18);

  if (hitCenter || hitLeft || hitRight) {
    if (hitLeft && !hitRight) {
      // Steer right away from obstacle on left
      steer.copy(lateral).multiplyScalar(-1.5);
    } else if (hitRight && !hitLeft) {
      // Steer left away from obstacle on right
      steer.copy(lateral).multiplyScalar(1.5);
    } else if (hitCenter) {
      // Direct head-on collision: steer toward open side
      const leftClearance = isPointBlocked(pos.x + lateral.x * 1.5, pos.z + lateral.z * 1.5, colliders, 0.3) === null;
      steer.copy(lateral).multiplyScalar(leftClearance ? 1.5 : -1.5);
    }
    return steer;
  }

  return null;
}

/**
 * Boids-Inspired Swarm Flocking & Lateral Avenue Fan-Out (Day 9).
 * Eliminates single-file conga lines by pushing trailing zombies horizontally across broad streets.
 */
export function computeSwarmFlocking(zombie, zombies, toPlayer, distToPlayer) {
  const pos = zombie.group ? zombie.group.position : (zombie.pos || new THREE.Vector3());
  const separation = new THREE.Vector3();
  const alignment = new THREE.Vector3();
  let neighborCount = 0;

  const playerDir = toPlayer.clone().normalize();
  const lateralDir = new THREE.Vector3(-playerDir.z, 0, playerDir.x);

  const SEPARATION_RADIUS = 2.4; // 2.4m soft swarm perception
  const CRITICAL_RADIUS = (zombie.radius || 0.4) * 2 + 0.18; // ~0.98m hard collision

  for (let i = 0; i < zombies.length; i++) {
    const other = zombies[i];
    if (other === zombie || !other.alive) continue;
    const oPos = other.group ? other.group.position : (other.pos || new THREE.Vector3());

    const dx = pos.x - oPos.x;
    const dz = pos.z - oPos.z;
    const d2 = dx * dx + dz * dz;

    if (d2 > 1e-5 && d2 < SEPARATION_RADIUS * SEPARATION_RADIUS) {
      const d = Math.sqrt(d2);

      if (d < CRITICAL_RADIUS) {
        // Tier 1: Hard physical collision push
        const push = (CRITICAL_RADIUS - d) / CRITICAL_RADIUS;
        separation.x += (dx / d) * push * 2.4;
        separation.z += (dz / d) * push * 2.4;
      } else {
        // Tier 2: Soft Swarm Fan-Out across avenue
        // If other zombie is in front or parallel along advance vector:
        const toOther = new THREE.Vector3(-dx, 0, -dz).normalize();
        const inFront = toOther.dot(playerDir);
        if (inFront > -0.25) {
          // Push LATERAL (perpendicular to avenue) to break conga lines!
          const lateralDot = dx * lateralDir.x + dz * lateralDir.z;
          const latSign = lateralDot >= 0 ? 1 : -1;
          const softPush = ((SEPARATION_RADIUS - d) / SEPARATION_RADIUS) * 1.45;
          separation.x += lateralDir.x * latSign * softPush;
          separation.z += lateralDir.z * latSign * softPush;
        }
      }

      // Boids Alignment: synchronize forward pack rush
      if (other.moveDir && d < 3.0) {
        alignment.x += other.moveDir.x;
        alignment.z += other.moveDir.z;
        neighborCount++;
      }
    }
  }

  if (neighborCount > 0) {
    alignment.multiplyScalar(1 / neighborCount);
  }

  return { separation, alignment };
}

/**
 * Runner & Lurker Agile Perimeter Flanking Ambush (Day 9).
 * Projects a wide pincer arc around the player's blind spots when approaching from range.
 */
export function computeFlankingVector(zombie, toPlayer, distToPlayer) {
  if (zombie.type !== 'runner' && zombie.type !== 'lurker') return null;
  if (distToPlayer < 4.2 || distToPlayer > 36) return null;

  const flankSign = zombie.flankSign || 1;
  const direct = toPlayer.clone().normalize();
  const tangent = new THREE.Vector3(-direct.z * flankSign, 0, direct.x * flankSign);

  // Flank strength peaks at 12-16m, blends to direct rush inside 4.5m
  const weight = Math.min(0.55, Math.max(0.18, (distToPlayer - 3.8) / 16));
  return tangent.multiplyScalar(weight);
}

/**
 * Horde Encirclement Ring Arc (Day 9).
 * Assigns an angular offset around the player so horde surrounds rather than clumping.
 */
export function computeEncirclementVector(zombie, toPlayer, distToPlayer) {
  if (distToPlayer > 12.0 || distToPlayer < 2.0) return null;

  const offset = zombie.encirclementOffset || 0;
  const direct = toPlayer.clone().normalize();
  const lateral = new THREE.Vector3(-direct.z, 0, direct.x);

  const arcStrength = Math.min(0.45, ((12.0 - distToPlayer) / 12.0) * 0.45);
  return lateral.multiplyScalar(offset * arcStrength);
}

/**
 * Master Horde Steering Integration (Day 9).
 * Combines Flowfield Navigation, Flanking, Encirclement, Swarm Flocking & Obstacle Whiskers.
 */
export function computeHordeSteering({ zombie, zombies, playerPos, colliders, nav, dt }) {
  const pos = zombie.group ? zombie.group.position : (zombie.pos || new THREE.Vector3());
  const toPlayer = new THREE.Vector3(playerPos.x - pos.x, 0, playerPos.z - pos.z);
  const dist = toPlayer.length();

  const move = new THREE.Vector3();

  // 1. Base Goal: Flowfield around buildings when distant; direct when close
  if (nav && dist > 2.8) {
    const navDir = nav.direction(pos.x, pos.z);
    if (navDir) move.copy(navDir);
    else move.copy(toPlayer).normalize();
  } else {
    move.copy(toPlayer).normalize();
  }

  // 2. Runner & Lurker Flanking Pincer Arc
  const flank = computeFlankingVector(zombie, toPlayer, dist);
  if (flank) move.add(flank);

  // 3. Horde Encirclement Ring Distribution
  const encircle = computeEncirclementVector(zombie, toPlayer, dist);
  if (encircle) move.add(encircle);

  // 4. Boids Swarm Separation & Alignment (Breaks Conga Lines!)
  if (zombies && zombies.length > 1) {
    const { separation, alignment } = computeSwarmFlocking(zombie, zombies, toPlayer, dist);
    move.add(separation);
    if (alignment.lengthSq() > 1e-4) {
      move.addScaledVector(alignment, 0.16);
    }
  }

  // 5. Predictive Whisker Obstacle Avoidance
  if (colliders && colliders.length) {
    const obstacleSteer = probeWhiskerAvoidance(pos, move, colliders, 1.4);
    if (obstacleSteer) {
      move.add(obstacleSteer);
    }
  }

  if (move.lengthSq() > 1e-4) move.normalize();
  return { move, toPlayer, dist };
}
