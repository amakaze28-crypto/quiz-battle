import RankBadge from './RankBadge';

export default function Home({ g }) {
  const { profile, conn, phase, queue, error } = g;
  const r = profile?.rank;

  return (
    <div>
      {conn !== 'online' && (
        <div className="mb-4 rounded-lg bg-amber-500/20 p-3 text-sm">
          {conn === 'error' ? `接続エラー: ${error}` : 'サーバーに接続中…（無料枠は起動に最大1分ほどかかることがあります）'}
        </div>
      )}

      {profile ? (
        <div className="rounded-2xl bg-[#171a20] p-5 mb-6 flex items-center gap-4">
          <RankBadge rank={r} size={96} />
          <div className="min-w-0">
            <p className="text-3xl font-extrabold">{r.label}</p>
            {profile.isMaster
              ? <p className="text-lg">{profile.mr} MR</p>
              : <p className="text-lg">{profile.pt} pt<span className="block text-slate-400 text-sm">次のランクまで {r.nextAt - profile.pt} pt</span></p>}
            <p className="mt-1 text-slate-400 text-sm">{profile.games}戦 {profile.wins}勝 {profile.losses}敗</p>
          </div>
        </div>
      ) : <p className="mb-6">プロフィール取得中…</p>}

      {phase === 'queue' ? (
        <div className="text-center">
          <p className="animate-pulse mb-2">マッチング中… {queue ? `${queue.waitSec}秒（待機${queue.size}人）` : ''}</p>
          <button onClick={g.leaveQueue} className="px-5 py-2 rounded-lg bg-slate-700">キャンセル</button>
        </div>
      ) : (
        <button disabled={conn !== 'online' || !profile} onClick={g.joinQueue}
          className="w-full py-4 rounded-2xl bg-emerald-500 text-xl font-bold disabled:opacity-40">
          対戦する
        </button>
      )}
      {error && conn === 'online' && <p className="mt-3 text-red-400 text-sm">{error}</p>}
    </div>
  );
}
