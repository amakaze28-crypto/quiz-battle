import * as store from './store.js';
// 管理画面で調整したバナー(カードフレーム)の配置: { [itemId]: {cx,cy,d,p1,p2,pl,panel,ph,by} }
export async function cardLayouts() {
  const out = {};
  for (const d of await store.colList('cardlayouts')) { const { id, ...L } = d; out[id] = L; }
  return out;
}
