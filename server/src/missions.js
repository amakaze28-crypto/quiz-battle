import { settings } from './settings.js';

// デイリーミッション: 日本時間(JST)の0時に更新
export const dayKey = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const blank = () => ({ day: dayKey(), login: false, matches: 0, wins: 0, claimed: {} });

export function current(u) {
  const m = u.missions;
  return m && m.day === dayKey() ? { ...blank(), ...m, claimed: { ...(m.claimed || {}) } } : blank();
}

export const touchLogin = (u) => ({ ...current(u), login: true });
export const recordMatch = (u, won) => {
  const m = current(u);
  return { ...m, login: true, matches: m.matches + 1, wins: m.wins + (won ? 1 : 0) };
};

export function view(u) {
  const m = current(u);
  const r = settings().missionRewards;
  const defs = [
    { key: 'login', label: 'ログインする', target: 1, progress: m.login ? 1 : 0, reward: r.login },
    { key: 'play', label: '5マッチプレイする', target: 5, progress: Math.min(5, m.matches), reward: r.play },
    { key: 'win', label: '3勝する', target: 3, progress: Math.min(3, m.wins), reward: r.win },
  ];
  return defs.map((d) => ({ ...d, done: d.progress >= d.target, claimed: !!m.claimed[d.key] }));
}
