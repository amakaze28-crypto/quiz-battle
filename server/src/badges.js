import * as store from './store.js';
import { TIERS, MASTER_START, ratingValue } from './rank.js';

// バッジ（実績）。名前・見た目・条件は管理画面で設定（collection: badgedefs）
export const COND_TYPES = {
  wins: '通算勝利数', games: '通算マッチ数', streak: '最高連勝数', loginDays: 'ログイン日数（累計）',
  rank: '指定ランクに到達', coins: '所持コイン数', periodLogin: '指定期間にログイン',
};
let defs = [];
export const badgeDefs = () => defs;
export async function reloadBadgeDefs() {
  defs = (await store.colList('badgedefs')).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

// 'gold3' → 必要レーティング（pt）。'master' → マスター到達
export function rankRequirement(spec) {
  if (spec === 'master') return MASTER_START;
  const m = /^([a-z]+)([1-5])$/.exec(spec || '');
  const t = m && TIERS.find((x) => x.key === m[1]);
  return t ? t.start + (5 - Number(m[2])) * t.width : null;
}
export const RANK_SPECS = [...TIERS.flatMap((t) => [5, 4, 3, 2, 1].map((s) => ({ spec: `${t.key}${s}`, label: `${t.name}${s}` }))), { spec: 'master', label: 'マスター' }];

function met(d, u, peak, ev) {
  const c = d.cond || {};
  const n = Number(c.n) || 0;
  switch (c.type) {
    case 'wins': return (u.wins || 0) >= n;
    case 'games': return (u.games || 0) >= n;
    case 'streak': return (u.bestStreak || 0) >= n;
    case 'loginDays': return (u.loginDays || 0) >= n;
    case 'coins': return (u.coins || 0) >= n;
    case 'rank': { const need = rankRequirement(c.rank); return need !== null && peak >= need; }
    case 'periodLogin': return !!ev.login && (!c.from || ev.now >= c.from) && (!c.to || ev.now <= c.to);
    default: return false;
  }
}

// 条件を満たした未獲得バッジを付与する（変化があれば保存）。ボットには呼ばない
export async function award(uid, ev = {}) {
  const u = await store.getUser(uid);
  if (!u) return null;
  const now = ev.now || Date.now();
  const peak = Math.max(u.peakRating || 0, ratingValue(u));
  const have = new Set((u.badges || []).map((b) => b.id));
  const add = defs.filter((d) => d.enabled !== false && !have.has(`b:${d.id}`) && met(d, u, peak, { ...ev, now }))
    .map((d) => ({ id: `b:${d.id}`, kind: 'custom', defId: d.id, at: now }));
  if (add.length || peak !== (u.peakRating || 0)) {
    await store.updateUser(uid, { badges: [...(u.badges || []), ...add], peakRating: peak });
    return { ...u, badges: [...(u.badges || []), ...add], peakRating: peak, newBadges: add };
  }
  return u;
}

// 表示用（クライアントに渡す）
export function badgeView(b) {
  if (!b) return null;
  if (b.kind === 'season') return { id: b.id, kind: 'season', name: `シーズン${b.season} ${b.label}${b.place ? ` ${b.place}位` : ''}`, rankKey: b.rankKey, sub: b.sub ?? null, season: b.season, place: b.place || null, at: b.at };
  const d = defs.find((x) => x.id === b.defId);
  if (!d) return null;
  return { id: b.id, kind: 'custom', name: d.name, desc: d.desc || '', src: `/badge-img/${d.id}?v=${d.updatedAt || 0}`, at: b.at };
}
export const badgeList = (u) => (u.badges || []).map(badgeView).filter(Boolean);
export const equippedBadge = (u) => (u.badgeId && /^[bs]:/.test(u.badgeId) ? badgeView((u.badges || []).find((b) => b.id === u.badgeId)) : null);
