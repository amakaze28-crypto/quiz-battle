import * as store from './store.js';
import { settings, RARITIES } from './settings.js';

// ガチャの定義（管理画面で編集）。通常ガチャは必ず1つある（未設定ならデフォルトを使う）
export const NORMAL_ID = 'normal';
export const DEFAULT_NAME = '魔法のガチャ';

export function normalizeGacha(id, d = {}) {
  const kind = d.kind === 'limited' || (id !== NORMAL_ID && d.kind !== 'normal') ? 'limited' : 'normal';
  return {
    id, kind,
    name: String(d.name || (kind === 'normal' ? DEFAULT_NAME : '期間限定ガチャ')).slice(0, 30),
    banner: typeof d.banner === 'string' ? d.banner : '',
    cost: Number.isFinite(Number(d.cost)) && d.cost !== null && d.cost !== '' ? Math.max(0, Math.round(Number(d.cost))) : null, // null = 共通設定のコスト
    startAt: Number(d.startAt) || 0, endAt: Number(d.endAt) || 0,
    enabled: d.enabled !== false,
    order: Number(d.order) || 0,
    itemIds: Array.isArray(d.itemIds) ? d.itemIds.filter((x) => typeof x === 'string') : [],
    setIds: Array.isArray(d.setIds) ? d.setIds.filter((x) => typeof x === 'string') : [],
    createdAt: d.createdAt || 0, updatedAt: d.updatedAt || 0,
  };
}

export async function listGachas() {
  const docs = await store.colList('gachas');
  const list = docs.map((d) => normalizeGacha(d.id, d));
  if (!list.some((x) => x.id === NORMAL_ID)) list.unshift(normalizeGacha(NORMAL_ID, { kind: 'normal' }));
  return list.sort((a, b) => (a.kind === b.kind ? (a.order - b.order) || (a.createdAt - b.createdAt) : a.kind === 'normal' ? -1 : 1));
}

export const costOf = (g) => (g.cost ?? settings().gacha.cost);
export const isActive = (g, now = Date.now()) =>
  g.kind === 'normal' || (g.enabled && (!g.startAt || g.startAt <= now) && (!g.endAt || g.endAt > now));

// そのガチャから出るもの。通常=「ガチャに入れる」が付いたもの＋指定分 / 期間限定=指定したものだけ
export async function poolFor(g) {
  const [items, sets] = await Promise.all([store.colList('items'), store.colList('sets')]);
  const idSet = new Set(g.itemIds); const sIdSet = new Set(g.setIds);
  const normal = g.kind === 'normal';
  const its = items.filter((i) => RARITIES.includes(i.rarity) && (idSet.has(i.id) || (normal && i.inGacha)));
  const byId = new Map(items.map((i) => [i.id, i]));
  const ss = sets
    .filter((s) => sIdSet.has(s.id) || (normal && s.inGacha !== false))
    .map((s) => ({ id: s.id, name: s.name, rarity: 'legendary', isSet: true, items: (s.itemIds || []).map((x) => byId.get(x)).filter(Boolean) }))
    .filter((s) => s.items.length > 0);
  return [...its, ...ss];
}
