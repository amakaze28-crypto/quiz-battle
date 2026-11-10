import * as store from './store.js';
import { settings, saveSettings } from './settings.js';
import { rankInfo } from './rank.js';
import { cfg } from './config.js';
import { refreshEmperors } from './emperors.js';

const DAY = 86_400_000;
export const seasonEnd = (s) => s.startAt + s.lengthDays * DAY;

// 公開用（クライアントに渡す）
export function seasonView() {
  const s = settings().season;
  if (!s.enabled || !s.startAt) return null;
  return { number: s.number, startAt: s.startAt, endAt: seasonEnd(s) };
}

// シーズン終了処理: 最終ランクのバッジを付与し、ランクをリセットして次のシーズンへ
export async function rotateSeason() {
  const s = settings().season;
  const users = await store.listUsers(100000, { fresh: true });
  const top = users.filter((u) => u.isMaster && u.mr != null).sort((a, b) => b.mr - a.mr).slice(0, cfg.emperorCount);
  const place = new Map(top.map((u, i) => [u.uid, i + 1]));
  const now = Date.now();
  let given = 0;
  for (const u of users) {
    const patch = { pt: s.resetPt, mr: null, isMaster: false, seasonGames: 0 };
    if ((u.seasonGames || 0) > 0) {
      const emp = place.has(u.uid);
      const info = emp ? { key: 'emperor', label: 'エンペラー', sub: null } : rankInfo(u, null);
      const id = `s:${s.number}`;
      patch.badges = [...(u.badges || []).filter((b) => b.id !== id), { id, kind: 'season', season: s.number, rankKey: info.key, sub: info.sub, label: info.label, place: emp ? place.get(u.uid) : null, at: now }];
      given += 1;
    }
    await store.updateUser(u.uid, patch);
  }
  store.dropUserLists();
  await saveSettings({ season: { ...s, number: s.number + 1, startAt: now } });
  await refreshEmperors();
  console.log(`[season] シーズン${s.number}を終了。バッジ付与 ${given}人 / ランクをリセット`);
  return { ended: s.number, given };
}

let busy = false;
async function check() {
  if (busy) return;
  const s = settings().season;
  if (!s.enabled) return;
  busy = true;
  try {
    if (!s.startAt) await saveSettings({ season: { ...s, startAt: Date.now() } });
    else if (Date.now() >= seasonEnd(s)) await rotateSeason();
  } catch (e) { console.error('[season]', e); }
  busy = false;
}
export function startSeasonTimer() { check(); setInterval(check, 30_000).unref(); }
