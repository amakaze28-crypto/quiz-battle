import 'dotenv/config';

const origins = (process.env.CLIENT_ORIGIN || '*').split(',').map((s) => s.trim());

export const cfg = {
  adminEmails: (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
  port: Number(process.env.PORT) || 3001,
  origin: origins.includes('*') ? '*' : origins,
  matchSize: Number(process.env.MATCH_SIZE) || 4,
  questionCount: 10,
  questionTimeMs: Number(process.env.QUESTION_TIME_MS) || 60000, // 1問1分
  resultPauseMs: Number(process.env.RESULT_PAUSE_MS) || 3500,
  countdownMs: Number(process.env.COUNTDOWN_MS) || 4000,
  buzzWindowMs: 150, // 最初の正解到着後、この間に届いた正解の中から補正タイムが最速の人を勝者にする
  maxLagCompMs: 250, // ラグ補正の上限（片道遅延の補正は最大この値まで）
  matchBaseRange: 300, // 初期のレート許容差
  matchGrowPerSec: 30, // 待つほど許容差が広がる(1秒あたり)
  emperorCount: 100,
};
