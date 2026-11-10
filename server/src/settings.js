import * as store from './store.js';

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_LABEL = { common: 'コモン', uncommon: 'アンコモン', rare: 'レア', epic: 'エピック', legendary: 'レジェンダリー' };

// 運営が調整できる値（管理者画面の「設定」から変更）
const DEFAULTS = {
  missionRewards: { login: 50, play: 100, win: 150 }, // ミッション報酬コイン
  renameCost: 100,                                      // 2回目以降の改名コスト(コイン)
  secondaryChance: 0.05,                                // Secondaryシステム(得点2倍)の発動確率
  showQueueSize: true,                                  // マッチング中に待機人数を表示するか
  maintenance: { on: false, message: '' },              // メンテナンス中は管理者以外ログイン不可
  season: { enabled: false, lengthDays: 30, number: 1, startAt: 0, resetPt: 0 }, // シーズン（切替でランクリセット）
  bots: { enabled: true, waitMin: 5, waitMax: 12 },     // botマッチ（ダイヤ帯まで）。待ち時間が waitMin〜waitMax 秒を超えるとbotが加わる
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

export const mergeMaintenance = (src = {}) => ({ on: !!src.on, message: String(src.message || '').slice(0, 200) });

function mergeSeason(src = {}) {
  const d = DEFAULTS.season;
  return {
    enabled: src.enabled === undefined ? d.enabled : !!src.enabled,
    lengthDays: num(src.lengthDays, 1, 3650, d.lengthDays),
    number: num(src.number, 1, 100000, d.number),
    startAt: Number.isFinite(Number(src.startAt)) ? Math.max(0, Math.round(Number(src.startAt))) : d.startAt,
    resetPt: num(src.resetPt, 0, 6999, d.resetPt),
  };
}

function mergeBots(src = {}) {
  const d = DEFAULTS.bots;
  const waitMin = num(src.waitMin, 0, 600, d.waitMin);
  const waitMax = Math.max(waitMin, num(src.waitMax, 0, 600, d.waitMax));
  return { enabled: src.enabled === undefined ? d.enabled : !!src.enabled, waitMin, waitMax };
}

export async function loadSettings() {
  const d = (await store.colGet('settings', 'main')) || {};
  current = {
    missionRewards: { ...DEFAULTS.missionRewards, ...(d.missionRewards || {}) },
    renameCost: d.renameCost ?? DEFAULTS.renameCost,
    secondaryChance: d.secondaryChance ?? DEFAULTS.secondaryChance,
    showQueueSize: d.showQueueSize === undefined ? DEFAULTS.showQueueSize : !!d.showQueueSize,
    season: mergeSeason(d.season),
    bots: mergeBots(d.bots),
    gacha: mergeGacha(d.gacha),
    maintenance: mergeMaintenance(d.maintenance),
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
    showQueueSize: p.showQueueSize === undefined ? current.showQueueSize : !!p.showQueueSize,
    season: mergeSeason({ ...current.season, ...(p.season || {}) }),
    bots: mergeBots({ ...current.bots, ...(p.bots || {}) }),
    gacha: mergeGacha({ ...current.gacha, ...(p.gacha || {}) }),
    maintenance: current.maintenance, // メンテナンスは専用の操作でだけ変える（設定の保存で上書きしない）
  };
  await store.colSet('settings', 'main', next);
  current = next;
  return current;
}

export const maintenance = () => current.maintenance || { on: false, message: '' };
export async function setMaintenance(on, message) {
  current = { ...current, maintenance: mergeMaintenance({ on, message }) };
  await store.colSet('settings', 'main', current);
  return current.maintenance;
}
