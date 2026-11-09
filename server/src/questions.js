import fs from 'fs';
import * as store from './store.js';
import { cfg } from './config.js';

// 問題JSON形式: [{ "question": "...", "choices": ["A","B","C","D"], "answer": 0, "explanation": "任意" }, ...]
// ("questions"キーを持つオブジェクトでも可。answerは0始まりの選択肢番号。correctIndexでも可)

// 問題は「ファイル」（グループ）に分けて管理できる。未指定は「未分類」
export const fileName = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : '未分類');

export function normalizeQuestion(q) {
  if (!q || typeof q !== 'object') return { ok: false, error: '形式が不正です' };
  const answer = q.answer ?? q.correctIndex;
  const question = typeof q.question === 'string' ? q.question.trim() : '';
  if (!question) return { ok: false, error: '問題文がありません' };
  if (!Array.isArray(q.choices) || q.choices.length !== 4 || !q.choices.every((c) => typeof c === 'string' && c.trim())) {
    return { ok: false, error: '選択肢は空でない文字列を4つ指定してください' };
  }
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) return { ok: false, error: 'answer は 0〜3 の整数で指定してください' };
  return {
    ok: true,
    value: {
      question, choices: q.choices.map((c) => c.trim()), answer,
      explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
      file: fileName(q.file),
    },
  };
}

let bank = []; // 公開中の問題のみ

export const publishedCount = () => bank.length;

export async function reloadQuestions() {
  const all = await store.listQuestions();
  bank = all.filter((q) => q.published && normalizeQuestion(q).ok);
  return bank.length;
}

// 問題が1件もなければ questions.json から初期投入（公開状態）
export async function seedIfEmpty(path = process.env.QUESTIONS_PATH || new URL('../questions.json', import.meta.url)) {
  if ((await store.listQuestions()).length > 0) return;
  if (!fs.existsSync(path)) return;
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
  const list = (Array.isArray(raw) ? raw : raw.questions || [])
    .map(normalizeQuestion).filter((r) => r.ok).map((r) => ({ ...r.value, published: true }));
  if (list.length) {
    await store.createQuestions(list);
    console.log(`[questions] ${list.length}問を初期投入しました`);
  }
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
