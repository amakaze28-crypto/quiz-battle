import * as store from './store.js';
// 管理画面で調整したバナー(カードフレーム)の配置: { [itemId]: {cx,cy,d,p1,p2,pl,panel,ph,by} }
export async function cardLayouts() {
  const out = {};
  for (const d of await store.colList('cardlayouts')) { const { id, ...L } = d; out[id] = L; }
  return out;
}

// アイコンフレームの位置・大きさの調整: { [itemId]: {dx,dy,s} }（dx,dy=アイコンの大きさに対するずれ、s=アイコンに対する枠の大きさ）
export async function frameFits() {
  const out = {};
  for (const d of await store.colList('framefits')) { const { id, ...F } = d; out[id] = F; }
  return out;
}
export const LAYOUT_KEYS = ['cx', 'cy', 'd', 'p1', 'p2', 'pl', 'panel', 'ph', 'by'];
export function cleanLayout(L) {
  const out = {};
  for (const k of LAYOUT_KEYS) { const v = Number(L?.[k]); if (!Number.isFinite(v) || v < 0 || v > 1.2) return null; out[k] = Math.round(v * 10000) / 10000; }
  return out;
}
export function cleanFit(F) {
  const dx = Number(F?.dx); const dy = Number(F?.dy); const s = Number(F?.s);
  if (![dx, dy, s].every(Number.isFinite) || Math.abs(dx) > 1 || Math.abs(dy) > 1 || s < 0.5 || s > 3) return null;
  return { dx: Math.round(dx * 10000) / 10000, dy: Math.round(dy * 10000) / 10000, s: Math.round(s * 10000) / 10000 };
}
