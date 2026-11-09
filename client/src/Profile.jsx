import RankBadge from './RankBadge';

export default function Profile({ profile }) {
  if (!profile) return <p>読み込み中…</p>;
  const r = profile.rank;
  const progress = r.nextAt ? Math.min(100, ((profile.pt - r.subStart) / (r.nextAt - r.subStart)) * 100) : 100;
  const rate = profile.games ? Math.round((profile.wins / profile.games) * 100) : 0;

  return (
    <div className="text-center">
      <h1 className="text-xl font-bold mb-4">プロフィール</h1>
      <div className="flex justify-center"><RankBadge rank={r} size={160} /></div>
      <p className="mt-2 text-3xl font-extrabold">{r.label}</p>
      <p className="text-slate-300 mb-4">{profile.displayName}</p>

      <div className="rounded-2xl bg-[#171a20] p-5 text-left">
        {profile.isMaster ? (
          <p className="text-lg font-bold">{profile.mr} MR</p>
        ) : (
          <>
            <div className="flex justify-between text-sm mb-1"><span>{profile.pt} pt</span><span className="text-slate-400">次のランク {r.nextAt} pt</span></div>
            <div className="h-2 rounded bg-slate-700"><div className="h-2 rounded bg-emerald-400" style={{ width: `${progress}%` }} /></div>
          </>
        )}
        <div className="grid grid-cols-4 gap-2 mt-5 text-center">
          {[['対戦', profile.games], ['勝ち', profile.wins], ['負け', profile.losses], ['勝率', `${rate}%`]].map(([k, v]) => (
            <div key={k}><div className="text-xs text-slate-400">{k}</div><div className="text-lg font-bold">{v}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}
