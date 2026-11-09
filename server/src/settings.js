import * as store from './store.js';

// 運営が調整できる値（管理者画面の「設定」から変更）
const DEFAULTS = {
  missionRewards: { login: 50, play: 100, win: 150 }, // ミッション報酬コイン
  renameCost: 100,                                      // 2回目以降の改名コスト
  secondaryChance: 0.05,                                // Secondaryシステム(得点2倍)の発動確率
};

let current = structuredClone(DEFAULTS);
export const settings = () => current;

const num = (v, min, max, fb) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : fb);

export async function loadSettings() {
  const d = (await store.colGet('settings', 'main')) || {};
  current = {
    missionRewards: { ...DEFAULTS.missionRewards, ...(d.missionRewards || {}) },
    renameCost: d.renameCost ?? DEFAULTS.renameCost,
    secondaryChance: d.secondaryChance ?? DEFAULTS.secondaryChance,
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
  };
  await store.colSet('settings', 'main', next);
  current = next;
  return current;
}
