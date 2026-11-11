// ランク定義。内部は pt(マスター未満) / mr(マスター以上) で管理する。
export const TIERS = [
  { key: 'rookie', name: 'ルーキー', start: 0, width: 100 },
  { key: 'bronze', name: 'ブロンズ', start: 500, width: 150 },
  { key: 'silver', name: 'シルバー', start: 1250, width: 200 },
  { key: 'gold', name: 'ゴールド', start: 2250, width: 250 },
  { key: 'platinum', name: 'プラチナ', start: 3500, width: 300 },
  { key: 'diamond', name: 'ダイヤ', start: 5000, width: 400 },
];
export const MASTER_START = 7000;
export const MASTER_INITIAL_MR = 1500;
// ポイントは全ランクで下がる。ただしルーキー〜ゴールド(index 0〜3)はティア(メインランク)が降格しない。
// プラチナ・ダイヤはティアを跨いで降格する(ダイヤ→プラチナ)。プラチナの下限はこの値(ゴールドには落ちない)
export const PLATINUM_INDEX = 4;
export const PLATINUM_FLOOR = 3500;

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
    return { key: emperor ? 'emperor' : 'master', label: emperor ? 'エンペラー' : 'マスター', tier: emperor ? 'emperor' : 'master', sub: null, mr: p.mr, subStart: null, nextAt: null };
  }
  const t = TIERS[tierIndex(p.pt)];
  const start = subRankStart(p.pt);
  const sub = 5 - Math.floor((p.pt - t.start) / t.width);
  return { key: t.key, label: `${t.name}${sub}`, tier: t.name, sub, mr: null, subStart: start, nextAt: start + t.width };
}

// ---------- シーズン切替時の「N段階降格」 ----------
// 1段階 = サブランク1つ（ブロンズ3 → ブロンズ4）。ティアをまたいで数える（ブロンズ5 の次はルーキー1）。
// マスター以上はダイヤ1の1つ上として数える（1段階降格でダイヤ1）。降格後は、そのサブランクの一番下のptから始まる。
export const SUB_LEVELS = TIERS.length * 5; // 30（0=ルーキー5 … 29=ダイヤ1、30=マスター）
export const subLevelOf = (p) => (p.isMaster ? SUB_LEVELS : tierIndex(p.pt) * 5 + Math.floor((p.pt - TIERS[tierIndex(p.pt)].start) / TIERS[tierIndex(p.pt)].width));
export const ptAtLevel = (L) => { const t = TIERS[Math.floor(L / 5)]; return t.start + (L % 5) * t.width; };
export const subLevelLabel = (L) => (L >= SUB_LEVELS ? 'マスター' : `${TIERS[Math.floor(L / 5)].name}${5 - (L % 5)}`);
/** steps段階降格した後の { pt, mr, isMaster }。steps=0 のときは空（そのまま） */
export function demotedState(p, steps) {
  if (steps <= 0) return {};
  const L = Math.max(0, subLevelOf(p) - steps);
  return { pt: ptAtLevel(L), mr: null, isMaster: false };
}
