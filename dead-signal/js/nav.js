// Navigation flow field for the horde.
// A coarse grid is marked blocked once from the world colliders; every few
// frames a breadth-first search from the player fills distance values, and each
// zombie simply walks toward its lowest-distance neighbour. That gives real
// pathing around buildings for the cost of one small BFS.
import * as THREE from 'three';

export class NavGrid {
  constructor(colliders, cell = 2, extent = 72) {
    this.cell = cell;
    this.extent = extent;
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

        if (Math.hypot(x, z) > 64) blocked = 1;

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

  // Direction toward the player along the field, or null when unreachable.
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

    if (bi === 0 && bj === 0) return null;
    return out.set(bi, 0, bj).normalize();
  }
}
