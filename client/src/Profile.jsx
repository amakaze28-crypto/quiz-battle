import BadgeArt from './Badge';
import { useEffect, useState } from 'react';
import { callApi } from './api';
import PlayerCard, { TIER_LABEL } from './PlayerCard';
import { Avatar, Coin, Sand } from './Parts';
import ItemPreview from './ItemPreview';
import { Panel, Title } from './Ui';
import { sfx } from './audio';

// 分野別の得意・苦手と、間違えた問題（最新20問）
function Stats({ user }) {
  const [st, setSt] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { callApi(user, '/stats').then(setSt).catch(() => setSt({ cats: [], strong: [], weak: [], wrong: [] })); }, [user]);
  if (!st) return null;
  const Bar = ({ c, color }) => (
    <div className="mb-1.5">
      <div className="flex justify-between text-sm"><span className="truncate pr-2">{c.name}</span><span className="tabular-nums shrink-0">{c.rate}% <span className="text-xs text-slate-400">({c.c}/{c.n})</span></span></div>
      <div className="h-2 rounded bg-slate-700"><div className="h-2 rounded" style={{ width: `${c.rate}%`, background: color }} /></div>
    </div>
  );
  return (
    <>
      <Panel className="p-3 mt-3 text-left">
        <h3 className="font-bold mb-2">得意な分野・苦手な分野</h3>
        {st.cats.length === 0 ? <p className="text-sm text-slate-300">対戦で問題に答えると表示されます（各分野3問以上）。</p> : (
          <>
            <p className="text-xs text-emerald-300 font-bold mb-1">得意</p>
            {st.strong.map((c) => <Bar key={c.name} c={c} color="#34d399" />)}
            {st.weak.length > 0 && <p className="text-xs text-rose-300 font-bold mt-3 mb-1">苦手</p>}
            {st.weak.map((c) => <Bar key={c.name} c={c} color="#fb7185" />)}
          </>
        )}
      </Panel>
      <Panel className="p-3 mt-3 text-left">
        <h3 className="font-bold mb-2">間違えた問題 <span className="text-xs font-normal text-slate-300">（最新{Math.min(20, st.wrong.length)}問 / 最大20問）</span></h3>
        {st.wrong.length === 0 && <p className="text-sm text-slate-300">間違えた問題はまだありません。</p>}
        <ul className="space-y-1.5">
          {st.wrong.map((w, i) => (
            <li key={w.id} className="rounded-lg bg-black/25">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full text-left px-2.5 py-2 flex gap-2 items-start">
                <span className="text-xs text-slate-400 mt-0.5 w-5 shrink-0">{i + 1}</span>
                <span className="flex-1 text-sm">{w.question}</span>
                <span className="text-slate-400">{open === i ? '▲' : '▼'}</span>
              </button>
              {open === i && (
                <div className="px-2.5 pb-2.5 text-sm space-y-1">
                  {w.choices.map((c, k) => (
                    <p key={k} className={`rounded px-2 py-1 ${k === w.answer ? 'bg-emerald-500/25 text-emerald-200 font-bold' : k === w.myChoice ? 'bg-red-500/25 text-red-200' : 'text-slate-300'}`}>
                      {'ABCD'[k]}. {c}{k === w.answer ? '　← 正解' : k === w.myChoice ? '　← あなたの解答' : ''}
                    </p>
                  ))}
                  {w.myChoice === null && <p className="text-xs text-amber-300">時間切れ（未回答）でした</p>}
                  {w.explanation && <p className="text-xs text-slate-300 pt-1">解説: {w.explanation}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

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
  const cards = items.filter((i) => i.type === 'card');
  const frames = items.filter((i) => i.type === 'frame');
  return (
    <Panel className="p-3 mt-3 text-left">
      <h3 className="font-bold mb-2">カードの設定</h3>
      {err && <p className="text-red-300 text-sm mb-2">{err}</p>}
      <p className="text-xs text-slate-300 mb-1">アイコン</p>
      <div className="grid grid-cols-5 gap-2 mb-3">
        {icons.map((i) => <button key={i.id} onClick={() => equip('icon', i.id)} className={`${cell} ${profile.iconId === i.id ? sel : ''}`}><Avatar iconId={i.id} size={48} /></button>)}
      </div>
      <p className="text-xs text-slate-300 mb-1">アイコンフレーム</p>
      <div className="grid grid-cols-5 gap-2 mb-3 max-h-60 overflow-y-auto">
        <button onClick={() => equip('frame', 'none')} className={`${cell} text-[10px] ${(profile.frameId || 'none') === 'none' ? sel : ''}`}>なし</button>
        {frames.map((i) => <button key={i.id} onClick={() => equip('frame', i.id)} className={`${cell} ${profile.frameId === i.id ? sel : ''}`}><Avatar iconId={profile.iconId} frameId={i.id} size={44} /></button>)}
      </div>
      <p className="text-xs text-slate-300 mb-1">カードフレーム（{cards.length}）</p>
      <div className="grid grid-cols-4 gap-2 mb-3 max-h-72 overflow-y-auto">
        <button onClick={() => equip('card', 'none')} className={`${cell} text-[10px] min-h-[60px] ${(profile.cardId || 'none') === 'none' ? sel : ''}`}>標準</button>
        {cards.map((i) => <button key={i.id} onClick={() => equip('card', i.id)} className={`${cell} ${profile.cardId === i.id ? sel : ''}`}><ItemPreview item={i} size="40px" /></button>)}
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
      <p className="text-xs text-slate-300 mt-3 mb-1">獲得したバッジ（{(profile.badges || []).length}）</p>
      {(profile.badges || []).length === 0 && <p className="text-xs text-slate-400">まだありません。勝利やログイン、ランクの到達などで手に入ります。</p>}
      <div className="grid grid-cols-4 gap-2">
        {[...(profile.badges || [])].sort((a, b) => b.at - a.at).map((b) => (
          <button key={b.id} onClick={() => badge(b.id)} className={`rounded-lg p-1.5 bg-black/25 flex flex-col items-center gap-1 ${profile.badgeId === b.id ? sel : ''}`} title={b.desc || b.name}>
            <BadgeArt b={b} size={52} />
            <span className="text-[10px] leading-tight text-center break-all">{b.name}</span>
          </button>
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
      {user && <Stats user={user} />}
      {user && call && <CardEditor user={user} profile={profile} call={call} />}
      <Panel className="p-3 mt-3 text-left">
        <p className="text-xs text-slate-400">フレンドコード</p>
        <p className="text-xl font-mono font-extrabold tracking-widest">{profile.friendCode}</p>
      </Panel>
    </div>
  );
}
