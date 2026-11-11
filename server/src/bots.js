// bot: ダイヤ帯まで、待ち時間が長いときにマッチングに加わる。
// 正答率 = 同じランク帯のbot以外のプレイヤーの平均正答率、
// 解答時間 = 同じ帯の平均解答秒数の ±3 秒以内。平均あたりが一番多く、離れるほど少しずつ出にくい（山の頂点は平均ぴったりではなく、毎回少しずれる）
import crypto from 'crypto';
import * as store from './store.js';
import { cfg } from './config.js';
import { TIERS, tierIndex } from './rank.js';

const NAMES = ['さくら', 'はると', 'みなと', 'ゆうき', 'あおい', 'ひなた', 'そうた', 'りく', 'めい', 'こはる', 'れん', 'いちか', 'かい', 'ゆま', 'たくみ', 'のぞみ', 'しおり', 'けんた', 'まりな', 'ひかる', 'なつき', 'だいち', 'あかね', 'とうま'];
const FALLBACK = { accuracy: 0.6, avgSec: 12 };

export const isBot = (uid) => typeof uid === 'string' && uid.startsWith('bot:');

// ランク帯(tier key)ごとの統計。全帯を1回の走査でまとめて集計し、10分キャッシュ
let bandCache = { at: 0, agg: null };
let bandLoading = null;
async function bandAgg() {
  if (bandCache.agg && Date.now() - bandCache.at < 600_000) return bandCache.agg;
  if (!bandLoading) {
    bandLoading = (async () => {
      const agg = {};
      try {
        for (const u of await store.listUsers(100)) {
          if (u.isMaster) continue;
          const e = agg[TIERS[tierIndex(u.pt)].key] ||= { q: 0, correct: 0, ans: 0, time: 0 };
          e.q += u.statQ || 0; e.correct += u.statCorrect || 0; e.ans += u.statAns || 0; e.time += u.statTime || 0;
        }
      } catch { /* 統計が取れなければ既定値 */ }
      bandCache = { at: Date.now(), agg };
      return agg;
    })().finally(() => { bandLoading = null; });
  }
  return bandLoading;
}
export async function bandStats(tierKey) {
  const e = (await bandAgg())[tierKey] || { q: 0, correct: 0, ans: 0, time: 0 };
  return {
    accuracy: e.q >= 20 ? Math.min(0.98, Math.max(0.05, e.correct / e.q)) : FALLBACK.accuracy,
    avgSec: e.ans >= 10 ? e.time / e.ans : FALLBACK.avgSec,
  };
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
  // 山の頂点を平均から ±0.6 秒ほどずらし、正規分布（標準偏差1.3秒）で選ぶ。±3 秒の外は引き直す
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  const peak = bot.avgSec + (Math.random() - 0.5) * 1.2;
  let sec = peak + gauss() * 1.3;
  for (let i = 0; i < 20 && Math.abs(sec - bot.avgSec) > 3; i++) sec = peak + gauss() * 1.3;
  sec = Math.min(bot.avgSec + 3, Math.max(bot.avgSec - 3, sec));
  const limit = cfg.questionTimeMs / 1000;
  return { choice, delayMs: Math.round(Math.min(limit - 2, Math.max(0.8, sec)) * 1000) };
}
