export default function Home({ g, user, onLogout }) {
  const { profile, conn, phase, queue, error } = g;
  const r = profile?.rank;
  const progress = r && r.nextAt ? Math.min(100, ((profile.pt - r.subStart) / (r.nextAt - r.subStart)) * 100) : 100;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 max-w-md mx-auto">
      {conn !== 'online' && (
        <div className="mb-4 rounded-lg bg-amber-500/20 p-3 text-sm">
          {conn === 'error' ? `接続エラー: ${error}` : 'サーバーに接続中…（無料枠は起動に最大1分ほどかかることがあります）'}
        </div>
      )}
      <div className="flex items-center gap-4 mb-6">
        {user.photoURL && <img src={user.photoURL} alt="" className="w-16 h-16 rounded-full" />}
        <div>
          <h1 className="text-xl font-bold">{user.displayName}</h1>
          <button onClick={onLogout} className="text-sm underline text-slate-400">ログアウト</button>
        </div>
      </div>

      {profile ? (
        <div className="rounded-2xl bg-slate-800 p-5 mb-6">
          <p className="text-3xl font-extrabold">{r.label}</p>
          {profile.isMaster ? (
            <p className="text-lg">{profile.mr} MR</p>
          ) : (
            <>
              <p className="text-lg">{profile.pt} pt<span className="text-slate-400 text-sm">（次のランクまで {r.nextAt - profile.pt} pt）</span></p>
              <div className="h-2 mt-2 rounded bg-slate-700"><div className="h-2 rounded bg-emerald-400" style={{ width: `${progress}%` }} /></div>
            </>
          )}
          <p className="mt-3 text-slate-300">{profile.games}戦 {profile.wins}勝 {profile.losses}敗</p>
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
