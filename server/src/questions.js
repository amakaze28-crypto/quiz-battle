import fs from 'fs';
import { cfg } from './config.js';

// 問題JSON形式: [{ "question": "...", "choices": ["A","B","C","D"], "answer": 0, "explanation": "任意" }, ...]
// ("questions"キーを持つオブジェクトでも可。answerは0始まりの選択肢番号)
let bank = [];

export function loadQuestions(path = process.env.QUESTIONS_PATH || new URL('../questions.json', import.meta.url)) {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.questions;
  const ok = [];
  list.forEach((q, i) => {
    const answer = q.answer ?? q.correctIndex;
    const valid = typeof q.question === 'string' && Array.isArray(q.choices) && q.choices.length === 4
      && q.choices.every((c) => typeof c === 'string') && Number.isInteger(answer) && answer >= 0 && answer < 4;
    if (valid) ok.push({ id: q.id ?? i, question: q.question, choices: q.choices, answer, explanation: q.explanation ?? '' });
    else console.warn(`[questions] #${i} は形式不正のためスキップ`);
  });
  if (ok.length === 0) throw new Error('有効な問題がありません');
  if (ok.length < cfg.questionCount) console.warn(`[questions] 問題数が${cfg.questionCount}未満(${ok.length})です。全問出題します`);
  bank = ok;
  return ok;
}

// 重複なしでランダムに最大10問（フィッシャー–イェーツ）
export function pickQuestions(n = cfg.questionCount) {
  const a = [...bank];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}
