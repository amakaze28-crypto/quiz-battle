export default function Result({ g, myUid }) {
  const { result, goHome } = g;
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">試合結果</h1>
      <div className="space-y-3 mb-6">
        {result.results.map((r) => (
          <div key={r.uid} className={`rounded-xl p-4 ${r.uid === myUid ? 'bg-sky-800' : 'bg-slate-800'}`}>
            <div className="flex justify-between items-baseline">
              <span className="font-bold">{r.place}位　{r.name}</span>
              <span className={`text-xl font-extrabold ${r.delta > 0 ? 'text-emerald-400' : r.delta < 0 ? 'text-red-400' : ''}`}>
                {r.delta > 0 ? '+' : ''}{r.delta}
              </span>
            </div>
            <div className="text-sm text-slate-300">
              正解 {r.score}/{result.total}　平均 {r.avgTime}秒　→ {r.rank}
              {r.mr != null ? `（${r.mr} MR）` : r.pt != null ? `（${r.pt} pt）` : ''}
            </div>
          </div>
        ))}
      </div>
      <button onClick={goHome} className="w-full py-4 rounded-2xl bg-emerald-500 text-xl font-bold">ホームに戻る</button>
    </div>
  );
}
