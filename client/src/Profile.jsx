import RankBadge from './RankBadge';
import { Avatar, Banner, Coin, Sand } from './Parts';
import { Panel, Title } from './Ui';

export default function Profile({ profile }) {
  if (!profile) return <p>読み込み中…</p>;
  const r = profile.rank;
  const progress = r.nextAt ? Math.min(100, Math.max(0, ((profile.pt - r.subStart) / (r.nextAt - r.subStart)) * 100)) : 100;
  const rate = profile.games ? Math.round((profile.wins / profile.games) * 100) : 0;

  return (
    <div className="text-center ui-text">
      <Title>プロフィール</Title>
      {profile.bannerId !== 'none' && <Banner bannerId={profile.bannerId} className="w-full rounded-xl mb-4" style={{ aspectRatio: '4 / 1' }} />}
      <div className="flex justify-center items-end gap-6">
        <RankBadge rank={r} size={150} />
        <Avatar iconId={profile.iconId} frameId={profile.frameId} size={76} className="ring-2 ring-white/30" />
      </div>
      <p className="mt-2 text-3xl font-extrabold">{r.label}</p>
      <p className="text-slate-300">{profile.displayName}</p>
      <p className="mb-4 flex justify-center gap-5"><Coin n={profile.coins} size={20} className="text-amber-300" /><Sand n={profile.sand} size={22} className="text-amber-300" /></p>

      <Panel className="p-3 text-left">
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
      </Panel>
      <Panel className="p-3 mt-3 text-left">
        <p className="text-xs text-slate-400">フレンドコード</p>
        <p className="text-xl font-mono font-extrabold tracking-widest">{profile.friendCode}</p>
      </Panel>
    </div>
  );
}
