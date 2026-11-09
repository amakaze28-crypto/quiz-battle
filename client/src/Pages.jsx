import { useCallback, useEffect, useState } from 'react';
import { callApi } from './api';
import { Avatar, Coin, Dot } from './Parts';
import RankBadge from './RankBadge';
import { ago } from './icons';

const card = 'rounded-2xl bg-[#171a20] p-4';
const Title = ({ children, right }) => <div className="flex items-center justify-between mb-4"><h1 className="text-xl font-bold">{children}</h1>{right}</div>;

function useLoad(user, path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setData(await callApi(user, path)); setError(''); } catch (e) { setError(e.message); }
  }, [user, path]);
  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, setData, error, reload: load };
}

/* ---------------- ショップ ---------------- */
export function Shop({ user, profile, call, onChange }) {
  const { data, error, reload } = useLoad(user, '/shop');
  const [msg, setMsg] = useState('');

  const act = async (fn) => { setMsg(''); try { await fn(); await reload(); onChange(); } catch (e) { setMsg(e.message); } };
  const buy = (i) => { if (window.confirm(`「${i.name}」を ${i.price} コインで購入しますか？`)) act(() => call('/shop/buy', { method: 'POST', body: { iconId: i.id } })); };
  const equip = (i) => act(() => call('/icon/equip', { method: 'POST', body: { iconId: i.id } }));

  return (
    <div>
      <Title right={<Coin n={profile?.coins ?? 0} size={22} className="text-amber-300" />}>ショップ</Title>
      <p className="text-sm text-slate-400 mb-3">コインでアイコンを購入できます。</p>
      {(error || msg) && <p className="text-red-400 text-sm mb-3">{error || msg}</p>}
      <div className="grid grid-cols-2 gap-3">
        {data?.icons.map((i) => {
          const equipped = data.equipped === i.id;
          return (
            <div key={i.id} className={`${card} text-center ${equipped ? 'ring-2 ring-amber-400' : ''}`}>
              <div className="flex justify-center mb-2"><Avatar iconId={i.id} size={84} /></div>
              <p className="font-semibold truncate">{i.name}</p>
              {i.owned
                ? <p className="text-xs text-slate-400 mb-2">所持済み</p>
                : <p className="mb-2"><Coin n={i.price} className="text-amber-300" /></p>}
              {equipped
                ? <span className="inline-block px-3 py-1.5 rounded-lg text-sm bg-amber-500 text-black font-bold">装備中</span>
                : i.owned
                  ? <button onClick={() => equip(i)} className="px-3 py-1.5 rounded-lg text-sm bg-sky-600">装備する</button>
                  : <button onClick={() => buy(i)} disabled={(profile?.coins ?? 0) < i.price} className="px-3 py-1.5 rounded-lg text-sm bg-emerald-500 font-bold disabled:opacity-40">購入</button>}
            </div>
          );
        })}
      </div>
      {data && data.icons.length === 1 && <p className="text-center text-slate-400 mt-6">販売中のアイコンはまだありません</p>}
    </div>
  );
}

/* ---------------- ミッション ---------------- */
export function Missions({ user, call, onChange, profile }) {
  const { data, setData, error } = useLoad(user, '/missions');
  const [msg, setMsg] = useState('');
  const claim = async (m) => {
    try { const r = await call(`/missions/${m.key}/claim`, { method: 'POST' }); setData({ ...data, missions: r.missions }); onChange(); } catch (e) { setMsg(e.message); }
  };
  return (
    <div>
      <Title right={<Coin n={profile?.coins ?? 0} size={22} className="text-amber-300" />}>デイリーミッション</Title>
      <p className="text-sm text-slate-400 mb-3">毎日0時（日本時間）に更新されます。</p>
      {(error || msg) && <p className="text-red-400 text-sm mb-3">{error || msg}</p>}
      <div className="space-y-3">
        {data?.missions.map((m) => (
          <div key={m.key} className={card}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">{m.label}</span>
              <Coin n={m.reward} className="text-amber-300" />
            </div>
            <div className="h-2 rounded bg-slate-700 mb-2"><div className="h-2 rounded bg-emerald-400" style={{ width: `${(m.progress / m.target) * 100}%` }} /></div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{m.progress} / {m.target}</span>
              {m.claimed
                ? <span className="text-slate-400">受け取り済み</span>
                : <button disabled={!m.done} onClick={() => claim(m)} className="px-4 py-1.5 rounded-lg bg-amber-500 text-black font-bold disabled:opacity-30">受け取る</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- フレンド ---------------- */
export function Friends({ user, onChange }) {
  const { data, setData, error } = useLoad(user, '/friends');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);

  const run = async (path, body, okText) => {
    try { setData(await callApi(user, path, { method: 'POST', body })); setMsg(okText ? { ok: true, text: okText } : null); onChange(); } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const request = async () => { await run('/friends/request', { code }, '申請しました（相手が承認するとフレンドになります）'); setCode(''); };
  const remove = (f) => { if (window.confirm(`${f.displayName} をフレンドから削除しますか？`)) run('/friends/remove', { uid: f.uid }); };

  return (
    <div>
      <Title>フレンド</Title>
      {data && (
        <div className={`${card} mb-4`}>
          <p className="text-xs text-slate-400">あなたのフレンドコード</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono font-extrabold tracking-widest">{data.code}</span>
            <button onClick={() => navigator.clipboard?.writeText(data.code)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-sm">コピー</button>
          </div>
        </div>
      )}
      <div className="flex gap-2 mb-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="フレンドコードを入力"
          className="flex-1 rounded-lg bg-[#171a20] border border-white/10 px-3 py-2 font-mono tracking-widest" />
        <button onClick={request} disabled={code.length < 8} className="px-4 rounded-lg bg-emerald-500 font-bold disabled:opacity-40">申請</button>
      </div>
      {(error || msg) && <p className={`text-sm mb-3 ${msg?.ok ? 'text-emerald-400' : 'text-red-400'}`}>{error || msg.text}</p>}

      {data?.incoming.length > 0 && (
        <Section title={<>届いている申請 <Dot className="w-2.5 h-2.5" /></>}>
          {data.incoming.map((f) => (
            <Row key={f.uid} f={f}>
              <button onClick={() => run('/friends/accept', { uid: f.uid })} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-sm font-bold">承認</button>
              <button onClick={() => run('/friends/remove', { uid: f.uid })} className="px-3 py-1.5 rounded-lg bg-slate-700 text-sm">拒否</button>
            </Row>
          ))}
        </Section>
      )}

      <Section title={`フレンド（${data?.friends.length ?? 0}）`}>
        {data?.friends.map((f) => (
          <Row key={f.uid} f={f} showStatus><button onClick={() => remove(f)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-xs">削除</button></Row>
        ))}
        {data?.friends.length === 0 && <p className="text-slate-400 text-sm text-center py-4">まだフレンドがいません</p>}
      </Section>

      {data?.outgoing.length > 0 && (
        <Section title="申請中">
          {data.outgoing.map((f) => (
            <Row key={f.uid} f={f}><button onClick={() => run('/friends/remove', { uid: f.uid })} className="px-3 py-1.5 rounded-lg bg-slate-700 text-xs">取り消す</button></Row>
          ))}
        </Section>
      )}
    </div>
  );
}

const Section = ({ title, children }) => <div className="mt-5"><h2 className="text-sm text-slate-400 mb-2 flex items-center gap-2">{title}</h2><div className="space-y-2">{children}</div></div>;

function Row({ f, showStatus, children }) {
  return (
    <div className={`${card} !p-3 flex items-center gap-3`}>
      <div className="relative"><Avatar iconId={f.iconId} size={44} />
        {showStatus && <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-[#171a20] ${f.online ? 'bg-emerald-400' : 'bg-slate-500'}`} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">{f.displayName}</p>
        <p className="text-xs text-slate-400 flex items-center gap-1">
          <RankBadge rank={f.rank} size={20} showSub={false} />{f.rank.label}
          {showStatus && <span className="ml-1">{f.online ? <span className="text-emerald-400">オンライン</span> : `最終ログイン ${ago(f.lastLoginAt)}`}</span>}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">{children}</div>
    </div>
  );
}

/* ---------------- お知らせ ---------------- */
export function Notices({ user, onChange }) {
  const { data, error } = useLoad(user, '/notices');
  useEffect(() => { if (data) callApi(user, '/notices/seen', { method: 'POST' }).then(onChange).catch(() => {}); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <Title>お知らせ</Title>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="space-y-3">
        {data?.notices.map((n) => (
          <div key={n.id} className={card}>
            <div className="flex items-center gap-2"><span className="font-bold">{n.title}</span>{n.unread && <Dot className="w-2.5 h-2.5" />}</div>
            <p className="text-xs text-slate-400 mb-2">{new Date(n.createdAt).toLocaleString('ja-JP')}</p>
            <p className="text-sm whitespace-pre-wrap text-slate-200">{n.body}</p>
          </div>
        ))}
        {data?.notices.length === 0 && <p className="text-slate-400 text-center py-8">お知らせはありません</p>}
      </div>
    </div>
  );
}

/* ---------------- メール(運営からのプレゼント) ---------------- */
export function Mails({ user, call, onChange }) {
  const { data, error, reload } = useLoad(user, '/mails');
  const [msg, setMsg] = useState('');
  const claim = async (m) => { try { await call(`/mails/${m.id}/claim`, { method: 'POST' }); await reload(); onChange(); } catch (e) { setMsg(e.message); } };
  const read = async (m) => { if (!m.read) { await callApi(user, `/mails/${m.id}/read`, { method: 'POST' }).catch(() => {}); reload(); onChange(); } };

  return (
    <div>
      <Title>メール</Title>
      <p className="text-sm text-slate-400 mb-3">運営からのプレゼントを受け取れます。</p>
      {(error || msg) && <p className="text-red-400 text-sm mb-2">{error || msg}</p>}
      <div className="space-y-3">
        {data?.mails.map((m) => (
          <div key={m.id} className={card} onClick={() => read(m)}>
            <div className="flex items-center gap-2"><span className="font-bold">{m.title}</span>{!m.read && <Dot className="w-2.5 h-2.5" />}</div>
            <p className="text-xs text-slate-400 mb-2">{new Date(m.createdAt).toLocaleString('ja-JP')}</p>
            {m.body && <p className="text-sm whitespace-pre-wrap text-slate-200 mb-2">{m.body}</p>}
            {m.coins > 0 && (
              <div className="flex items-center justify-between">
                <Coin n={m.coins} size={22} className="text-amber-300" />
                {m.claimed ? <span className="text-sm text-slate-400">受け取り済み</span>
                  : <button onClick={(e) => { e.stopPropagation(); claim(m); }} className="px-4 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-sm">受け取る</button>}
              </div>
            )}
          </div>
        ))}
        {data?.mails.length === 0 && <p className="text-slate-400 text-center py-8">メールはありません</p>}
      </div>
    </div>
  );
}
