import { cfg } from './config.js';

export class Matchmaker {
  constructor(onMatch) {
    this.queue = [];
    this.onMatch = onMatch;
    setInterval(() => this.tick(), 1000).unref();
  }

  has(uid) { return this.queue.some((e) => e.uid === uid); }

  join(entry) {
    this.leave(entry.uid);
    this.queue.push({ ...entry, joinedAt: Date.now() });
    this.tick();
  }

  leave(uid) { this.queue = this.queue.filter((e) => e.uid !== uid); }

  tick() {
    const now = Date.now();
    const N = cfg.matchSize;
    let found = true;
    while (found) {
      found = false;
      const sorted = [...this.queue].sort((a, b) => a.rating - b.rating);
      for (let i = 0; i + N <= sorted.length; i++) {
        const group = sorted.slice(i, i + N);
        const spread = group[N - 1].rating - group[0].rating;
        // 待ち時間が短い人に合わせる(全員が許容できる範囲)
        const allowed = Math.min(...group.map((e) => cfg.matchBaseRange + ((now - e.joinedAt) / 1000) * cfg.matchGrowPerSec));
        if (spread <= allowed) {
          const ids = new Set(group.map((e) => e.uid));
          this.queue = this.queue.filter((e) => !ids.has(e.uid));
          this.onMatch(group);
          found = true;
          break;
        }
      }
    }
    for (const e of this.queue) {
      e.socket.emit('queue:status', { waitSec: Math.floor((now - e.joinedAt) / 1000), size: this.queue.length });
    }
  }
}
