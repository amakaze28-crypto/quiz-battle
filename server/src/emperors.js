import { getTopMasters } from './store.js';
import { cfg } from './config.js';

let set = new Set();
export const getEmperorSet = () => set;

export async function refreshEmperors() {
  try {
    const top = await getTopMasters(cfg.emperorCount);
    set = new Set(top.map((u) => u.uid));
  } catch (e) {
    console.error('[emperors] 更新失敗', e.message);
  }
}

export function startEmperorRefresh() {
  refreshEmperors();
  setInterval(refreshEmperors, 60 * 60_000).unref(); // 1時間ごと
}
