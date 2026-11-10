import * as store from './store.js';
import * as presence from './presence.js';

// ログイン数の記録（日本時間の1時間ごと）。docId = 'YYYY-MM-DD-HH'
// { uids: ログインしたユーザー(重複なし), events: ログイン回数, peak: 同時接続の最大 }
const jst = (ms) => new Date(ms + 9 * 3600_000).toISOString();
export const hourKey = (ms = Date.now()) => { const s = jst(ms); return `${s.slice(0, 10)}-${s.slice(11, 13)}`; };

let chain = Promise.resolve();
const queue = (fn) => { chain = chain.then(fn).catch(() => {}); return chain; };

export const recordLogin = (uid) => queue(async () => {
  const id = hourKey();
  const cur = (await store.colGet('loginstats', id)) || { uids: [], events: 0, peak: 0 };
  const uids = cur.uids.includes(uid) ? cur.uids : [...cur.uids, uid].slice(-5000);
  await store.colSet('loginstats', id, { uids, events: (cur.events || 0) + 1, peak: Math.max(cur.peak || 0, presence.count()) });
});

// 1分ごとに同時接続数の最大値を更新
export function startSampler() {
  setInterval(() => queue(async () => {
    const n = presence.count();
    if (!n) return;
    const id = hourKey();
    const cur = await store.colGet('loginstats', id);
    if (!cur || n > (cur.peak || 0)) await store.colSet('loginstats', id, { uids: cur?.uids || [], events: cur?.events || 0, peak: n });
  }), 60_000).unref?.();
}

export async function dayView(date) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : jst(Date.now()).slice(0, 10);
  const hours = [];
  const all = new Set();
  for (let h = 0; h < 24; h++) {
    const d = await store.colGet('loginstats', `${day}-${String(h).padStart(2, '0')}`);
    (d?.uids || []).forEach((u) => all.add(u));
    hours.push({ h, logins: d?.uids?.length || 0, events: d?.events || 0, peak: d?.peak || 0 });
  }
  return { date: day, today: jst(Date.now()).slice(0, 10), nowHour: Number(jst(Date.now()).slice(11, 13)), online: presence.count(), hours, uniqueDay: all.size, peakDay: Math.max(0, ...hours.map((x) => x.peak)) };
}
