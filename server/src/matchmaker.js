import { cfg } from './config.js';
import { settings } from './settings.js';
import { makeBot } from './bots.js';
import { MASTER_START } from './rank.js';

export class Matchmaker {
  constructor(onMatch) {
    this.queue = [];
    this.onMatch = onMatch;
    setInterval(() => this.tick(), 1000).unref();
  }

  has(uid) { return this.queue.some((e) => e.uid === uid); }

  join(entry) {
    this.leave(entry.uid);
    const b = settings().bots;
    // botが加わるまでの待ち時間は人によってばらつかせる
    const botAfterMs = (b.waitMin + Math.random() * (b.waitMax - b.waitMin)) * 1000;
    this.queue.push({ ...entry, joinedAt: Date.now(), botAfterMs });
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
    this.fillWithBots(now);
    for (const e of this.queue) {
      e.socket.emit('queue:status', { waitSec: Math.floor((now - e.joinedAt) / 1000), size: settings().showQueueSize ? this.queue.length : null });
    }
  }

  // ダイヤ帯までは、待ち時間が長いとbotが加わって対戦が始まる
  fillWithBots(now) {
    if (!settings().bots.enabled) return;
    for (const e of [...this.queue]) {
      if (!this.queue.includes(e) || e.rating >= MASTER_START || now - e.joinedAt < e.botAfterMs) continue;
      // 近いレートで待っている人（マスター未満）がいれば一緒に入れる
      const mates = this.queue.filter((o) => o !== e && o.rating < MASTER_START && Math.abs(o.rating - e.rating) <= 400).slice(0, cfg.matchSize - 1);
      const group = [e, ...mates];
      const ids = new Set(group.map((x) => x.uid));
      this.queue = this.queue.filter((x) => !ids.has(x.uid));
      const used = new Set();
      (async () => {
        const entries = [...group];
        while (entries.length < cfg.matchSize) entries.push(await makeBot(e, used));
        this.onMatch(entries);
      })().catch((err) => { console.error('[bot] 作成失敗', err); group.forEach((x) => this.queue.push(x)); });
    }
  }
}
