import { settings } from './settings.js';

// デイリーミッション: 日本時間(JST)の0時に更新
export const dayKey = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const blank = () => ({ day: dayKey(), login: false, matches: 0, wins: 0, claimed: {} });

export function current(u) {
  const m = u.missions;
  return m && m.day === dayKey() ? { ...blank(), ...m, claimed: { ...(m.claimed || {}) } } : blank();
}

export const touchLogin = (u) => ({ ...current(u), login: true });
export const recordMatch = (u, won) => {
  const m = current(u);
  return { ...m, login: true, matches: m.matches + 1, wins: m.wins + (won ? 1 : 0) };
};

export function view(u) {
  const m = current(u);
  const r = settings().missionRewards;
  const defs = [
    { key: 'login', label: 'ログインする', target: 1, progress: m.login ? 1 : 0, reward: r.login },
    { key: 'play', label: '5マッチプレイする', target: 5, progress: Math.min(5, m.matches), reward: r.play },
    { key: 'win', label: '3勝する', target: 3, progress: Math.min(3, m.wins), reward: r.win },
  ];
  return defs.map((d) => ({ ...d, done: d.progress >= d.target, claimed: !!m.claimed[d.key] }));
}

// ---------------- ウィークリー / スペシャル（管理者が設定） ----------------
// 定義は 'missionDefs' コレクション: { tab:'weekly'|'special', title, type:'play'|'win'|'login'|'correct', goal, coins, sand, startAt, endAt, enabled, order }
// ウィークリーは月曜0時(JST)に進捗リセット。スペシャルは期間内の累計（リセットなし）
import * as store from './store.js';

export const TYPES = { play: 'マッチをプレイ', win: '勝利する', login: 'ログインする（日数）', correct: '問題に正解する（回数）' };
let defs = [];
export async function reloadDefs() { defs = (await store.colList('missionDefs')).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id))); return defs; }
export const allDefs = () => defs;

export function weekKey(now = Date.now()) {
  const d = new Date(now + 9 * 3600 * 1000); // JSTの暦で計算
  const day = (d.getUTCDay() + 6) % 7;        // 月曜=0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
const keyOf = (d) => (d.tab === 'weekly' ? weekKey() : 'once');
const activeNow = (d, now = Date.now()) => d.enabled !== false && (!d.startAt || now >= d.startAt) && (!d.endAt || now <= d.endAt);

// 出来事(ev: {login, play, win, correct})を反映した mprog を返す
export function recordEvent(u, ev) {
  const prog = { ...(u.mprog || {}) };
  const now = Date.now(); const today = dayKey();
  for (const d of defs) {
    if (!activeNow(d, now)) continue;
    let p = prog[d.id];
    if (!p || p.key !== keyOf(d)) p = { key: keyOf(d), n: 0, claimed: false, day: '' };
    else p = { ...p };
    if (d.type === 'login') { if (ev.login && p.day !== today) { p.n += 1; p.day = today; } }
    else p.n += ev[d.type] || 0;
    prog[d.id] = p;
  }
  return prog;
}

export function extraView(u, tab) {
  const now = Date.now();
  return defs.filter((d) => d.tab === tab && activeNow(d, now)).slice(0, 5).map((d) => {
    const p = u.mprog?.[d.id];
    const valid = p && p.key === keyOf(d);
    const n = valid ? p.n : 0;
    return {
      key: `x:${d.id}`, id: d.id, label: d.title, type: d.type, target: d.goal, progress: Math.min(d.goal, n),
      coins: d.coins || 0, sand: d.sand || 0, endAt: d.endAt || 0,
      done: n >= d.goal, claimed: !!(valid && p.claimed),
    };
  });
}
export const claimableExtra = (u) => [...extraView(u, 'weekly'), ...extraView(u, 'special')].filter((m) => m.done && !m.claimed).length;

export function markClaimed(u, id) {
  const prog = { ...(u.mprog || {}) };
  const d = defs.find((x) => x.id === id);
  prog[id] = { ...(prog[id] || { n: 0, day: '' }), key: d ? keyOf(d) : 'once', claimed: true };
  return prog;
}

export function normalizeDef(b) {
  const tab = b.tab === 'special' ? 'special' : 'weekly';
  const type = Object.keys(TYPES).includes(b.type) ? b.type : 'play';
  const title = String(b.title || '').trim().slice(0, 40);
  const goal = Math.max(1, Math.min(100000, Math.round(Number(b.goal) || 0)));
  if (!title) return { error: 'タイトルを入力してください' };
  const t = (v) => (v ? Number(v) || 0 : 0);
  return { value: {
    tab, type, title, goal,
    coins: Math.max(0, Math.round(Number(b.coins) || 0)), sand: Math.max(0, Math.round(Number(b.sand) || 0)),
    startAt: t(b.startAt), endAt: t(b.endAt), enabled: b.enabled !== false, order: Math.round(Number(b.order) || 0),
  } };
}
