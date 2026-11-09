import { useEffect, useState } from 'react';

export default function Game({ g, myUid }) {
  const { q, match, scores, answer, conn } = g;
  const [now, setNow] = useState(performance.now());

  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(t);
  }, []);

  if (!q) return null;
  const remain = Math.max(0, q.timeLimitMs - (now - q.recvAt));
  const finished = !!q.result;
  const iLocked = q.myChoice !== null || q.lockedUids.includes(myUid);
  const othersLocked = !!q.lockedBy && q.lockedBy !== myUid;
  const disabled = finished || iLocked || othersLocked;

  let status = '早押し！選択肢をタップ';
  if (finished) {
    const w = match.players.find((p) => p.uid === q.result.winnerUid);
    status = w ? `${w.name} が正解！` : '正解者なし';
  } else if (q.wrong) status = 'お手つき！この問題は解答できません';
  else if (othersLocked) status = '他の人が先に解答しました…';
  else if (q.myChoice !== null) status = '判定中…';

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 max-w-md mx-auto">
      {conn !== 'online' && <p className="mb-2 text-amber-400 text-sm">通信が切断されました</p>}
      <div className="flex justify-between text-sm text-slate-300 mb-1">
        <span>第 {q.index + 1} / {q.total} 問</span>
        <span>{Math.ceil(remain / 1000)} 秒</span>
      </div>
      <div className="h-2 rounded bg-slate-700 mb-4">
        <div className="h-2 rounded bg-sky-400" style={{ width: `${(remain / q.timeLimitMs) * 100}%` }} />
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4 text-center text-xs">
        {match.players.map((p) => (
          <div key={p.uid} className={`rounded-lg p-2 ${p.uid === myUid ? 'bg-sky-700' : 'bg-slate-800'} ${q.lockedUids.includes(p.uid) ? 'opacity-40' : ''}`}>
            <div className="truncate">{p.name}</div>
            <div className="text-lg font-bold">{scores[p.uid] ?? 0}</div>
          </div>
        ))}
      </div>

      <p className="text-lg font-bold mb-4 min-h-[4rem]">{q.question}</p>

      <div className="space-y-3">
        {q.choices.map((c, i) => {
          let style = 'bg-slate-800';
          if (finished) {
            if (i === q.result.correctIndex) style = 'bg-emerald-600';
            else if (i === q.myChoice) style = 'bg-red-600';
            else style = 'bg-slate-800 opacity-50';
          } else if (i === q.myChoice) style = 'bg-sky-600';
          return (
            <button key={i} disabled={disabled} onClick={() => answer(i)}
              className={`w-full text-left rounded-xl px-4 py-4 font-semibold disabled:cursor-not-allowed ${style} ${disabled && !finished ? 'opacity-60' : ''}`}>
              <span className="mr-2 text-slate-300">{'ABCD'[i]}</span>{c}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center text-amber-300 font-semibold">{status}</p>
      {finished && q.result.explanation && <p className="mt-2 text-sm text-slate-300">{q.result.explanation}</p>}
    </div>
  );
}
