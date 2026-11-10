import * as store from './store.js';
import * as presence from './presence.js';

// ログイン数の記録（日本時間の1時間ごと）。docId = 'YYYY-MM-DD-HH'
// { uids: ログインしたユーザー(重複なし), events: ログイン回数, peak: 同時接続の最大 }
const jst = (ms) => new Date(ms + 9 * 3600_000).toISOString();
export const hourKey = (ms = Date.now()) => { const s = jst(ms); return `${s.slice(0, 10)}-${s.slice(11, 13)}`; };

// 今の1時間ぶんはメモリに持ち、1分ごとにまとめて書き込む（読み取りは時間が変わったときの1回だけ）。
// 過ぎた時間のぶんは変わらないので、一度読んだらメモリに置く。
let chain = Promise.resolve();
const queue = (fn) => { chain = chain.then(fn).catch(() => {}); return chain; };

let cur = null; // { id, doc, dirty }
const past = new Map(); // docId -> doc（終わった時間）

async function flush() {
  if (cur?.dirty) { cur.dirty = false; await store.colSet('loginstats', cur.id, cur.doc); }
}
async function current() {
  const id = hourKey();
  if (cur?.id === id) return cur;
  await flush(); // 前の時間を書き切ってから切り替える
  if (cur) past.set(cur.id, cur.doc);
  cur = { id, doc: (await store.colGet('loginstats', id)) || { uids: [], events: 0, peak: 0 }, dirty: false };
  cur.doc.uids ||= [];
  return cur;
}

export const recordLogin = (uid) => queue(async () => {
  const c = await current();
  if (!c.doc.uids.includes(uid)) c.doc.uids = [...c.doc.uids, uid].slice(-5000);
  c.doc.events = (c.doc.events || 0) + 1;
  c.doc.peak = Math.max(c.doc.peak || 0, presence.count());
  c.dirty = true;
});

// 1分ごとに同時接続数の最大値を更新し、たまった記録を書き込む
export function startSampler() {
  setInterval(() => queue(async () => {
    const n = presence.count();
    if (n) { const c = await current(); if (n > (c.doc.peak || 0)) { c.doc.peak = n; c.dirty = true; } }
    await flush();
  }), 60_000).unref?.();
}

async function hourDoc(id) {
  if (id > hourKey()) return null; // まだ来ていない時間
  if (cur?.id === id) return cur.doc;
  if (past.has(id)) return past.get(id);
  const d = await store.colGet('loginstats', id);
  if (id < hourKey()) past.set(id, d); // 終わった時間は変わらない（なければnullのまま覚える）
  return d;
}

export async function dayView(date) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : jst(Date.now()).slice(0, 10);
  const hours = [];
  const all = new Set();
  for (let h = 0; h < 24; h++) {
    const d = await hourDoc(`${day}-${String(h).padStart(2, '0')}`);
    (d?.uids || []).forEach((u) => all.add(u));
    hours.push({ h, logins: d?.uids?.length || 0, events: d?.events || 0, peak: d?.peak || 0 });
  }
  return { date: day, today: jst(Date.now()).slice(0, 10), nowHour: Number(jst(Date.now()).slice(11, 13)), online: presence.count(), hours, uniqueDay: all.size, peakDay: Math.max(0, ...hours.map((x) => x.peak)) };
}
