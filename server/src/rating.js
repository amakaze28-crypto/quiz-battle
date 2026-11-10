import { TIERS, MASTER_START, MASTER_INITIAL_MR, PLATINUM_INDEX, PLATINUM_FLOOR, tierIndex } from './rank.js';

// ---------- 試合内スコア（勝敗を決める得点）と、レートpt(pt/mr)は別物 ----------
// 1問の得点 = 100 × タイム倍率。正解のみ。倍率は 0秒=2.0倍 → 制限時間(60秒)=1.0倍 の直線。Secondaryの問題はさらに2倍。
export const BASE_QUESTION_POINTS = 100;
export const timeFactor = (sec, limitSec = 60) => 2 - Math.min(Math.max(sec, 0), limitSec) / limitSec;
export const questionPoints = (sec, limitSec = 60) => Math.round(BASE_QUESTION_POINTS * timeFactor(sec, limitSec));

// ---------- 順位 ----------
// 同点は同率。同率1位が2人なら、次の人は3位（1,1,3,4）。平均解答時間は順位に使わない
export function assignPlaces(scores) {
  return scores.map((s) => 1 + scores.filter((x) => x > s).length);
}

// ---------- レートptの増減（順位ベース） ----------
// 4人: 1位+20 / 2位+7 / 3位-7 / 4位-20。同率の人は、その順位ぶんの基本値の平均をもらう（合計は変わらない）
// 4人以外のときは +20 〜 -20 を等間隔に割り振る
export const RATE_MAX_BASE = 20;
export const MARGIN_PER_100 = 2; // 他の平均との点差100点につき ±2
export const MARGIN_CAP = 10;
export const RATE_CAP = 50;
export function placeBases(n) {
  if (n === 4) return [20, 7, -7, -20];
  if (n < 2) return [0];
  return Array.from({ length: n }, (_, i) => Math.round(RATE_MAX_BASE - (2 * RATE_MAX_BASE * i) / (n - 1)));
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** players: [{ score, rating }] → 各人のレート増減値（同じ並び） */
export function computeDeltas(players) {
  const n = players.length;
  if (n < 2) return players.map(() => 0);
  const places = assignPlaces(players.map((p) => p.score));
  const bases = placeBases(n);
  return players.map((p, i) => {
    const start = places[i]; // 1始まり
    const size = places.filter((x) => x === start).length;
    const base = mean(bases.slice(start - 1, start - 1 + size));
    const others = players.filter((_, j) => j !== i);
    const margin = Math.max(-MARGIN_CAP, Math.min(MARGIN_CAP, ((p.score - mean(others.map((o) => o.score))) / 100) * MARGIN_PER_100));
    const total = base + margin;
    const mod = Math.max(0.5, Math.min(1.5, 1 + (Math.sign(total) * (mean(others.map((o) => o.rating)) - p.rating)) / 1000));
    return (Math.max(-RATE_CAP, Math.min(RATE_CAP, Math.round(total * mod)))) || 0; // -0を0にする
  });
}

/**
 * 変動値をプロフィールに反映する。
 * - マスター: MRを増減（マスターから降格しない。MRは0未満にならない）
 * - ルーキー〜ゴールド: ポイントは下がるが、ティア(メインランク)は降格しない → 現在のティアの下限で止まる
 *   (ティア内のサブランクは上下する)
 * - プラチナ・ダイヤ: サブランクもティアも降格する(ダイヤ→プラチナ)。ただしプラチナの下限(3500)は割らない
 * - 7000pt到達でマスター(MR1500)へ昇格
 */
export function applyDelta(p, delta) {
  if (p.isMaster) return { ...p, mr: Math.max(0, (p.mr ?? MASTER_INITIAL_MR) + delta) };

  let pt = p.pt + delta;
  if (delta < 0) {
    const ti = tierIndex(p.pt);
    const floor = ti < PLATINUM_INDEX ? TIERS[ti].start : PLATINUM_FLOOR;
    pt = Math.max(pt, floor);
  }
  pt = Math.max(0, pt);
  if (pt >= MASTER_START) return { ...p, pt: MASTER_START, isMaster: true, mr: MASTER_INITIAL_MR };
  return { ...p, pt };
}
