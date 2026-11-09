import { TIERS, MASTER_START, MASTER_INITIAL_MR, DEMOTION_FROM_TIER_INDEX, tierIndex, subRankStart } from './rank.js';

/**
 * 試合終了後のレート増減値を計算する関数（スピードボーナス込み）
 */
export function calculateRateChange(myScore, othersAverageScore, myAverageTime, othersAverageTime, myRate, othersAverageRate) {
  const scoreDiff = myScore - othersAverageScore;
  let basePoint = scoreDiff * 5;

  const timeDiff = othersAverageTime - myAverageTime;
  let speedBonus = timeDiff * 2;
  speedBonus = Math.max(-5, Math.min(5, speedBonus));
  basePoint += speedBonus;

  const rateDiff = othersAverageRate - myRate;
  let rateModifier = 1 + (Math.sign(basePoint) * rateDiff) / 1000;
  rateModifier = Math.max(0.5, Math.min(1.5, rateModifier));

  let finalPoint = Math.round(basePoint * rateModifier);
  finalPoint = Math.max(-50, Math.min(50, finalPoint));
  return finalPoint;
}

/**
 * 変動値をプロフィールに反映する。
 * - マスター: MRを増減（マスターから降格しない。MRは0未満にならない）
 * - ルーキー〜ゴールド: 降格なし → 現在のサブランクの下限より下がらない
 * - プラチナ・ダイヤ: サブランクは降格する。ただしティアの下限(3500/5000)は割らない
 * - 7000pt到達でマスター(MR1500)へ昇格
 */
export function applyDelta(p, delta) {
  if (p.isMaster) return { ...p, mr: Math.max(0, (p.mr ?? MASTER_INITIAL_MR) + delta) };

  let pt = p.pt + delta;
  if (delta < 0) {
    const ti = tierIndex(p.pt);
    const floor = ti < DEMOTION_FROM_TIER_INDEX ? subRankStart(p.pt) : TIERS[ti].start;
    pt = Math.max(pt, floor);
  }
  pt = Math.max(0, pt);
  if (pt >= MASTER_START) return { ...p, pt: MASTER_START, isMaster: true, mr: MASTER_INITIAL_MR };
  return { ...p, pt };
}
