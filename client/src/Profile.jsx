import { useEffect, useState } from 'react';
import { callApi } from './api';
import PlayerCard, { TIER_LABEL } from './PlayerCard';
import { Avatar, Coin, Sand } from './Parts';
import ItemPreview from './ItemPreview';
import { Panel, Title } from './Ui';
import { sfx } from './audio';

const TIERS = ['rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'emperor'];

// プレイヤーカードのカスタマイズ（アイコン・キャラ・バッジ）
function CardEditor({ user, profile, call }) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => { callApi(user, '/shop').then((d) => setItems(d.items.filter((i) => i.owned))).catch((e) => setErr(e.message)); }, [user, profile?.sand]);
  const run = async (fn) => { setErr(''); try { await fn(); sfx('ok'); } catch (e) { setErr(e.message); } };
  const equip = (slot, id) => run(() => call('/equip', { method: 'POST', body: { slot, itemId: id } }));
  const badge = (b) => run(() => call('/badge', { method: 'POST', body: { badge: b } }));
  const mine = TIERS.indexOf(profile.rank.key);
  const sel = 'ring-2 ring-amber-400 bg-amber-400/20';
  const cell = 'rounded-lg p-1.5 bg-black/25 flex items-center justify-center';
  const icons = items.filter((i) => i.type === 'icon');
  const chars = items.filter((i) => i.type === 'character');
  return (
    <Panel className="p-3 mt-3 text-left">
      <h3 className="font-bold mb-2">カードの設定</h3>
      {err && <p className="text-red-300 text-sm mb-2">{err}</p>}
      <p className="text-xs text-slate-300 mb-1">アイコン</p>
      <div className="grid grid-cols-5 gap-2 mb-3">
        {icons.map((i) => <button key={i.id} onClick={() => equip('icon', i.id)} className={`${cell} ${profile.iconId === i.id ? sel : ''}`}><Avatar iconId={i.id} size={48} /></button>)}
      </div>
      <p className="text-xs text-slate-300 mb-1">キャラクター（アイコンとは別）</p>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {chars.map((i) => <button key={i.id} onClick={() => equip('character', i.id)} className={`${cell} ${profile.charId === i.id ? sel : ''}`}><ItemPreview item={i} size="48px" /></button>)}
      </div>
      <p className="text-xs text-slate-300 mb-1">バッジ（到達済みのランクから選べます）</p>
      <div className="flex flex-wrap gap-2">
        {[['auto', '現在のランク'], ...TIERS.slice(0, mine + 1).map((t) => [t, TIER_LABEL[t]]), ['none', 'なし']].map(([k, label]) => (
          <button key={k} onClick={() => badge(k)} className={`px-3 py-1.5 rounded-lg text-sm bg-black/25 ${(profile.badgeId || 'auto') === k ? sel : ''}`}>{label}</button>
        ))}
      </div>
    </Panel>
  );
}

export default function Profile({ profile, user, call }) {
  if (!profile) return <p>読み込み中…</p>;
  const r = profile.rank;
  const progress = r.nextAt ? Math.min(100, Math.max(0, ((profile.pt - r.subStart) / (r.nextAt - r.subStart)) * 100)) : 100;
  const rate = profile.games ? Math.round((profile.wins / profile.games) * 100) : 0;

  return (
    <div className="text-center ui-text">
      <Title>プロフィール</Title>
      <div className="mx-auto mb-4" style={{ maxWidth: 320 }}><PlayerCard c={profile} /></div>
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
      {user && call && <CardEditor user={user} profile={profile} call={call} />}
      <Panel className="p-3 mt-3 text-left">
        <p className="text-xs text-slate-400">フレンドコード</p>
        <p className="text-xl font-mono font-extrabold tracking-widest">{profile.friendCode}</p>
      </Panel>
    </div>
  );
}
