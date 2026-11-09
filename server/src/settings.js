import * as store from './store.js';

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_LABEL = { common: 'コモン', uncommon: 'アンコモン', rare: 'レア', epic: 'エピック', legendary: 'レジェンダリー' };

// 運営が調整できる値（管理者画面の「設定」から変更）
const DEFAULTS = {
  missionRewards: { login: 50, play: 100, win: 150 }, // ミッション報酬コイン
  renameCost: 100,                                      // 2回目以降の改名コスト(コイン)
  secondaryChance: 0.05,                                // Secondaryシステム(得点2倍)の発動確率
  gacha: {
    cost: 100,                                          // 1回あたりのコイン
    typeWeights: { item: 70, sand: 30 },                // アイテムが出る / 砂が出る
    itemRarityWeights: { common: 50, uncommon: 28, rare: 14, epic: 6, legendary: 2 },
    sandRarityWeights: { common: 50, uncommon: 28, rare: 14, epic: 6, legendary: 2 },
    sandAmounts: { common: 20, uncommon: 50, rare: 100, epic: 300, legendary: 1000 }, // 砂が出たときの量(レア度が高いほど多い)
    dupSand: { common: 10, uncommon: 50, rare: 100, epic: 500, legendary: 1000 },     // アイテムが被ったときの砂
  },
};

let current = structuredClone(DEFAULTS);
export const settings = () => current;

const num = (v, min, max, fb) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : fb);
const wnum = (v, fb) => (Number.isFinite(Number(v)) ? Math.min(100000, Math.max(0, Number(v))) : fb);

function mergeGacha(src = {}) {
  const d = DEFAULTS.gacha;
  const per = (key, fn) => Object.fromEntries(RARITIES.map((r) => [r, fn(src[key]?.[r], d[key][r])]));
  return {
    cost: num(src.cost, 0, 1000000, d.cost),
    typeWeights: { item: wnum(src.typeWeights?.item, d.typeWeights.item), sand: wnum(src.typeWeights?.sand, d.typeWeights.sand) },
    itemRarityWeights: per('itemRarityWeights', wnum),
    sandRarityWeights: per('sandRarityWeights', wnum),
    sandAmounts: per('sandAmounts', (v, fb) => num(v, 0, 10000000, fb)),
    dupSand: per('dupSand', (v, fb) => num(v, 0, 10000000, fb)),
  };
}

export async function loadSettings() {
  const d = (await store.colGet('settings', 'main')) || {};
  current = {
    missionRewards: { ...DEFAULTS.missionRewards, ...(d.missionRewards || {}) },
    renameCost: d.renameCost ?? DEFAULTS.renameCost,
    secondaryChance: d.secondaryChance ?? DEFAULTS.secondaryChance,
    gacha: mergeGacha(d.gacha),
  };
  return current;
}

export async function saveSettings(p) {
  const r = p.missionRewards || {};
  const next = {
    missionRewards: {
      login: num(r.login, 0, 100000, current.missionRewards.login),
      play: num(r.play, 0, 100000, current.missionRewards.play),
      win: num(r.win, 0, 100000, current.missionRewards.win),
    },
    renameCost: num(p.renameCost, 0, 100000, current.renameCost),
    secondaryChance: Math.min(1, Math.max(0, Number.isFinite(Number(p.secondaryChance)) ? Number(p.secondaryChance) : current.secondaryChance)),
    gacha: mergeGacha({ ...current.gacha, ...(p.gacha || {}) }),
  };
  await store.colSet('settings', 'main', next);
  current = next;
  return current;
}
