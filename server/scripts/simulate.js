// 4人分のダミークライアントで1試合を通しで動かす動作確認スクリプト（開発モードのサーバー向け）
import { io } from 'socket.io-client';
import fs from 'fs';

const SERVER = process.env.SERVER || 'http://localhost:3001';
const bank = JSON.parse(fs.readFileSync(new URL('../questions.json', import.meta.url), 'utf8'));
const answerOf = new Map(bank.map((q) => [q.question, q.answer]));

const bots = [
  { name: 'P1', minMs: 300, maxMs: 800, acc: 1.0 },
  { name: 'P2', minMs: 800, maxMs: 1500, acc: 0.8 },
  { name: 'P3', minMs: 1200, maxMs: 2500, acc: 0.6 },
  { name: 'P4', minMs: 500, maxMs: 2000, acc: 0.4 },
];

let ended = 0;
for (const b of bots) {
  const s = io(SERVER, { auth: { token: `dev:${b.name}` } });
  s.on('sping', (ack) => ack());
  s.on('connect', () => s.emit('queue:join'));
  s.on('question', (q) => {
    const delay = b.minMs + Math.random() * (b.maxMs - b.minMs);
    setTimeout(() => {
      const correct = answerOf.get(q.question);
      const choice = Math.random() < b.acc ? correct : (correct + 1) % 4;
      s.emit('answer', { index: q.index, choice });
    }, delay);
  });
  s.on('match:end', (r) => {
    if (b.name === 'P1') console.table(r.results.map(({ name, score, avgTime, place, delta, rank, pt }) => ({ name, score, avgTime, place, delta, rank, pt })));
    s.disconnect();
    if (++ended === bots.length) process.exit(0);
  });
}
setTimeout(() => { console.error('タイムアウト'); process.exit(1); }, 120000);
