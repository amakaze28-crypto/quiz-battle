// ランク定義。内部は pt(マスター未満) / mr(マスター以上) で管理する。
export const TIERS = [
  { name: 'ルーキー', start: 0, width: 100 },
  { name: 'ブロンズ', start: 500, width: 150 },
  { name: 'シルバー', start: 1250, width: 200 },
  { name: 'ゴールド', start: 2250, width: 250 },
  { name: 'プラチナ', start: 3500, width: 300 },
  { name: 'ダイヤ', start: 5000, width: 400 },
];
export const MASTER_START = 7000;
export const MASTER_INITIAL_MR = 1500;
// 降格が発生するティア(index)。ルーキー〜ゴールド(0〜3)は降格なし
export const DEMOTION_FROM_TIER_INDEX = 4; // プラチナ以上

export function tierIndex(pt) {
  let idx = 0;
  TIERS.forEach((t, i) => { if (pt >= t.start) idx = i; });
  return idx;
}

export function subRankStart(pt) {
  const t = TIERS[tierIndex(pt)];
  return t.start + Math.floor((pt - t.start) / t.width) * t.width;
}

// マッチング・レート計算用の共通レーティング値
export function ratingValue(p) {
  return p.isMaster ? MASTER_START + ((p.mr ?? MASTER_INITIAL_MR) - MASTER_INITIAL_MR) : p.pt;
}

export function rankInfo(p, emperorSet) {
  if (p.isMaster) {
    const emperor = !!emperorSet?.has(p.uid);
    return { label: emperor ? 'エンペラー' : 'マスター', tier: emperor ? 'emperor' : 'master', sub: null, mr: p.mr, subStart: null, nextAt: null };
  }
  const t = TIERS[tierIndex(p.pt)];
  const start = subRankStart(p.pt);
  const sub = 5 - Math.floor((p.pt - t.start) / t.width);
  return { label: `${t.name}${sub}`, tier: t.name, sub, mr: null, subStart: start, nextAt: start + t.width };
}
