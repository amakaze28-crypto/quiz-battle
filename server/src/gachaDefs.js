import * as store from './store.js';
import { settings, RARITIES, mergeGacha } from './settings.js';

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
    rates: d.rates && typeof d.rates === 'object' ? (({ cost, ...r }) => r)(mergeGacha({ ...settings().gacha, ...d.rates })) : null, // null = 共通の確率設定を使う
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
  const its = items.filter((i) => i.type !== 'bgm' && RARITIES.includes(i.rarity) && (idSet.has(i.id) || (normal && i.inGacha)));
  const byId = new Map(items.map((i) => [i.id, i]));
  const ss = sets
    .filter((s) => sIdSet.has(s.id) || (normal && s.inGacha !== false))
    .map((s) => ({ id: s.id, name: s.name, rarity: 'legendary', isSet: true, items: (s.itemIds || []).map((x) => byId.get(x)).filter(Boolean) }))
    .filter((s) => s.items.length > 0);
  return [...its, ...ss];
}

// ---- バナー画像（高画質）。Firestore の1MB制限を避けるため、大きい画像は分割して保存する ----
const BANNER_CHUNK = 600_000;
const BANNER_RE = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s;
export const BANNER_MAX = 6_000_000; // data URL の最大文字数（約4.5MB）
export const okBannerData = (v) => typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(v) && v.length <= BANNER_MAX;

export async function clearBannerChunks(id, marker) {
  const m = /^chunks:[^:]+:(\d+)$/.exec(marker || '');
  for (let i = 0; i < (m ? Number(m[1]) : 0); i++) await store.colDel('bannerchunks', `${id}__${i}`);
}
// 戻り値を gacha.banner に保存する（小さければdata URLそのまま、大きければ分割して印を返す）
export async function putBanner(id, dataUrl, oldMarker) {
  await clearBannerChunks(id, oldMarker);
  if (!dataUrl) return '';
  if (dataUrl.length < 800_000) return dataUrl;
  const m = BANNER_RE.exec(dataUrl);
  const n = Math.ceil(m[2].length / BANNER_CHUNK);
  for (let i = 0; i < n; i++) await store.colSet('bannerchunks', `${id}__${i}`, { d: m[2].slice(i * BANNER_CHUNK, (i + 1) * BANNER_CHUNK) });
  return `chunks:${m[1]}:${n}`;
}
export async function readBanner(g) {
  if (!g?.banner) return null;
  const c = /^chunks:([^:]+):(\d+)$/.exec(g.banner);
  if (c) {
    const parts = [];
    for (let i = 0; i < Number(c[2]); i++) parts.push((await store.colGet('bannerchunks', `${g.id}__${i}`))?.d || '');
    return { mime: c[1], buf: Buffer.from(parts.join(''), 'base64') };
  }
  const m = BANNER_RE.exec(g.banner);
  return m ? { mime: m[1], buf: Buffer.from(m[2], 'base64') } : null;
}
