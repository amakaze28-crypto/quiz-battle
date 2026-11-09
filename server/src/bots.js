// bot: ダイヤ帯まで、待ち時間が長いときにマッチングに加わる。
// 正答率 = 同じランク帯のbot以外のプレイヤーの平均正答率、
// 解答時間 = 同じ帯の平均解答秒数 −1 〜 +5 秒 の一様乱数
import crypto from 'crypto';
import * as store from './store.js';
import { cfg } from './config.js';
import { TIERS, tierIndex } from './rank.js';

const NAMES = ['さくら', 'はると', 'みなと', 'ゆうき', 'あおい', 'ひなた', 'そうた', 'りく', 'めい', 'こはる', 'れん', 'いちか', 'かい', 'ゆま', 'たくみ', 'のぞみ', 'しおり', 'けんた', 'まりな', 'ひかる', 'なつき', 'だいち', 'あかね', 'とうま'];
const FALLBACK = { accuracy: 0.6, avgSec: 12 };
const cache = new Map();

export const isBot = (uid) => typeof uid === 'string' && uid.startsWith('bot:');

// ランク帯(tier key)ごとの統計。60秒キャッシュ
export async function bandStats(tierKey) {
  const hit = cache.get(tierKey);
  if (hit && Date.now() - hit.at < 60000) return hit.v;
  let q = 0; let correct = 0; let ans = 0; let time = 0;
  try {
    for (const u of await store.listUsers(5000)) {
      if (u.isMaster || TIERS[tierIndex(u.pt)].key !== tierKey) continue;
      q += u.statQ || 0; correct += u.statCorrect || 0; ans += u.statAns || 0; time += u.statTime || 0;
    }
  } catch { /* 統計が取れなければ既定値 */ }
  const v = {
    accuracy: q >= 20 ? Math.min(0.98, Math.max(0.05, correct / q)) : FALLBACK.accuracy,
    avgSec: ans >= 10 ? time / ans : FALLBACK.avgSec,
  };
  cache.set(tierKey, { at: Date.now(), v });
  return v;
}

// マッチング用のエントリ(Roomがそのまま扱える形)を作る
export async function makeBot(like, usedNames = new Set()) {
  const stats = await bandStats(like.rankKey);
  const pool = NAMES.filter((n) => !usedNames.has(n));
  const name = pool[Math.floor(Math.random() * pool.length)] || 'ゲスト';
  usedNames.add(name);
  const t = TIERS.find((x) => x.key === like.rankKey) || TIERS[0];
  const sub = 1 + Math.floor(Math.random() * 5);
  const noop = () => {};
  return {
    uid: `bot:${crypto.randomUUID()}`, isBot: true, name, iconId: 'default', frameId: 'none', bannerId: 'none',
    socket: { data: { rtt: 0 }, join: noop, emit: noop },
    rating: Math.max(0, like.rating + Math.round((Math.random() - 0.5) * 200)),
    rankLabel: `${t.name}${sub}`, rankKey: t.key, rankSub: sub,
    bot: stats,
  };
}

// 1問ごとの解答（正誤と秒数）を決める
export function planAnswer(bot, correctIndex) {
  const correct = Math.random() < bot.accuracy;
  let choice = correctIndex;
  if (!correct) { do { choice = Math.floor(Math.random() * 4); } while (choice === correctIndex); }
  const sec = bot.avgSec - 1 + Math.random() * 6; // 平均 −1 〜 +5 秒
  const limit = cfg.questionTimeMs / 1000;
  return { choice, delayMs: Math.round(Math.min(limit - 2, Math.max(0.8, sec)) * 1000) };
}
