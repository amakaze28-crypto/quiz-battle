import { useCallback, useEffect, useMemo, useState } from 'react';
import { callApi } from './api';
import { Stage, Box, Hot, BackHome, NavHot, NavDots, fs } from './Stage';
import { Avatar, Banner, Dot } from './Parts';
import RankBadge from './RankBadge';
import PlayerCard from './PlayerCard';
import { ago } from './icons';

const TABS = [['list', 'フレンドリスト', 38, 327], ['requests', 'フレンド申請', 370, 298], ['search', 'フレンド検索', 672, 318]];
const gold = 'linear-gradient(180deg,#f1dc9a,#c9a24a)';
const navy = 'linear-gradient(180deg,#13264d,#0a1630)';
const row = 'relative rounded-lg overflow-hidden flex items-center gap-[2cqw] p-[1.2cqw] bg-[#ece8dc] text-[#0b1a36]';

function FriendRow({ f, status, children, onOpen }) {
  return (
    <div className={row}>
      <Banner bannerId={f.bannerId} className="absolute right-0 top-0 h-full w-[55%] opacity-40" style={{ maskImage: 'linear-gradient(90deg,transparent,#000 40%)', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 40%)' }} />
      <div className="relative shrink-0" style={{ width: '10cqw', height: '10cqw' }}>
        <Avatar iconId={f.iconId} frameId={f.frameId} size={0} />
        {status && <span className={`absolute rounded-full ring-2 ring-[#ece8dc] ${f.online ? 'bg-emerald-400' : 'bg-slate-500'}`} style={{ right: '-3%', bottom: '-3%', width: '3cqw', height: '3cqw' }} />}
      </div>
      <div className="relative min-w-0 flex-1 cursor-pointer" onClick={() => onOpen?.(f)}>
        <p className="font-extrabold truncate" style={{ fontSize: fs(30) }}>{f.displayName}</p>
        <p className="flex items-center gap-[1cqw] text-[#334155]" style={{ fontSize: fs(22) }}>
          <span style={{ width: '5cqw', height: '5cqw' }}><RankBadge rank={f.rank} size="fill" showSub={false} /></span>
          <b>{f.rank.label}</b>
        </p>
        {status && <p style={{ fontSize: fs(21), color: f.online ? '#059669' : '#64748b', fontWeight: 700 }}>{f.online ? 'オンライン' : `最終ログイン ${ago(f.lastLoginAt)}`}</p>}
      </div>
      <div className="relative flex gap-[1cqw] shrink-0">{children}</div>
    </div>
  );
}

const Btn = ({ onClick, color = 'bg-[#13264d] text-white', children }) => (
  <button onClick={onClick} className={`rounded-md font-bold px-[2cqw] py-[1.2cqw] ${color}`} style={{ fontSize: fs(22) }}>{children}</button>
);

export default function Friends({ user, go, summary, refresh }) {
  const [tab, setTab] = useState('list');
  const [data, setData] = useState(null);
  const [sort, setSort] = useState('login');
  const [menu, setMenu] = useState(null);
  const [card, setCard] = useState(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => { try { setData(await callApi(user, '/friends')); } catch (e) { setMsg({ ok: false, text: e.message }); } }, [user]);
  useEffect(() => { load(); }, [load]);

  const run = async (path, body, okText) => {
    try { setData(await callApi(user, path, { method: 'POST', body })); setMsg(okText ? { ok: true, text: okText } : null); refresh(); setMenu(null); } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const remove = (f) => { if (window.confirm(`${f.displayName} をフレンドから削除しますか？`)) run('/friends/remove', { uid: f.uid }); };
  const removeAll = () => { if (data?.friends.length && window.confirm('フレンドを全員削除しますか？この操作は取り消せません。')) run('/friends/removeAll', {}, '削除しました'); };
  const request = async () => { await run('/friends/request', { code }, '申請しました（相手が承認するとフレンドになります）'); setCode(''); };

  const friends = useMemo(() => {
    const l = [...(data?.friends || [])];
    return sort === 'rank' ? l.sort((a, b) => b.rating - a.rating) : l.sort((a, b) => Number(b.online) - Number(a.online) || b.lastLoginAt - a.lastLoginAt);
  }, [data, sort]);
  const incoming = data?.incoming.length || 0;

  const panel = { background: '#0c1d3d' };
  return (
    <Stage bg="/ui/friends.jpg">
      <BackHome go={go} homeX={930} />
      <Hot x={836} y={20} w={80} h={78} label="検索" onClick={() => { setTab('search'); setMsg(null); }} />

      {TABS.map(([k, label, x, w]) => (
        <Box key={k} x={x} y={248} w={w} h={64}>
          <button onClick={() => { setTab(k); setMsg(null); }} className="relative w-full h-full rounded-t-lg font-bold"
            style={{ background: tab === k ? gold : navy, color: tab === k ? '#2b1d05' : '#cbd5e1', border: '2px solid #c9a24a', borderBottom: 0, fontSize: fs(27) }}>
            {label}{k === 'requests' && incoming > 0 && <Dot className="absolute top-1 right-2 w-[2.4cqw] h-[2.4cqw]" />}
          </button>
        </Box>
      ))}

      {/* 人数・並び替え */}
      <Box x={40} y={344} w={945} h={50} className="flex items-center justify-between px-[2.4cqw]" style={panel}>
        <span />
        <div className="flex items-center gap-[2cqw]">
          <span style={{ fontSize: fs(26), color: '#e5e7eb', fontWeight: 700 }}>{data?.friends.length ?? 0} / 50</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded border border-[#c9a24a]/70 bg-[#0a1630] text-white px-[1cqw] py-[0.6cqw]" style={{ fontSize: fs(21) }}>
            <option value="login">最終ログイン順</option><option value="rank">ランク順</option>
          </select>
        </div>
      </Box>

      {/* 一覧 */}
      <Box x={40} y={396} w={945} h={794} className="overflow-y-auto p-[1.4cqw] space-y-[1.2cqw]" style={panel}>
        {msg && <p className={msg.ok ? 'text-emerald-300' : 'text-red-300'} style={{ fontSize: fs(22) }}>{msg.text}</p>}

        {tab === 'list' && (
          <>
            {friends.map((f) => (
              <FriendRow key={f.uid} f={f} status onOpen={setCard}>
                <div className="relative">
                  <Btn onClick={() => setMenu(menu === f.uid ? null : f.uid)}>…</Btn>
                  {menu === f.uid && (
                    <div className="absolute right-0 top-full mt-1 z-10 rounded-lg bg-[#0b1a36] border border-[#c9a24a]/70 overflow-hidden whitespace-nowrap">
                      <button onClick={() => remove(f)} className="block px-[3cqw] py-[2cqw] text-red-400 font-bold" style={{ fontSize: fs(22) }}>フレンドを削除</button>
                    </div>
                  )}
                </div>
              </FriendRow>
            ))}
            {friends.length === 0 && <p className="text-center text-slate-400 py-[8cqw]" style={{ fontSize: fs(26) }}>まだフレンドがいません</p>}
          </>
        )}

        {tab === 'requests' && (
          <>
            <p className="text-[#9fb2d4] font-bold" style={{ fontSize: fs(22) }}>届いている申請</p>
            {data?.incoming.map((f) => (
              <FriendRow key={f.uid} f={f} onOpen={setCard}>
                <Btn color="bg-emerald-500 text-white" onClick={() => run('/friends/accept', { uid: f.uid })}>承認</Btn>
                <Btn color="bg-slate-500 text-white" onClick={() => run('/friends/remove', { uid: f.uid })}>拒否</Btn>
              </FriendRow>
            ))}
            {incoming === 0 && <p className="text-slate-500" style={{ fontSize: fs(22) }}>なし</p>}
            <p className="text-[#9fb2d4] font-bold pt-[1.5cqw]" style={{ fontSize: fs(22) }}>申請中</p>
            {data?.outgoing.map((f) => (
              <FriendRow key={f.uid} f={f}><Btn color="bg-slate-500 text-white" onClick={() => run('/friends/remove', { uid: f.uid })}>取り消す</Btn></FriendRow>
            ))}
            {data?.outgoing.length === 0 && <p className="text-slate-500" style={{ fontSize: fs(22) }}>なし</p>}
          </>
        )}

        {tab === 'search' && (
          <div className="text-white">
            <div className="rounded-lg bg-[#0a1630] border border-[#c9a24a]/50 p-[2.4cqw] mb-[2cqw]">
              <p className="text-[#9fb2d4]" style={{ fontSize: fs(21) }}>あなたのフレンドコード</p>
              <div className="flex items-center justify-between">
                <span className="font-mono font-extrabold tracking-widest" style={{ fontSize: fs(46) }}>{data?.code}</span>
                <Btn onClick={() => navigator.clipboard?.writeText(data?.code || '')}>コピー</Btn>
              </div>
            </div>
            <p className="text-[#9fb2d4] mb-[1cqw]" style={{ fontSize: fs(21) }}>相手のフレンドコードを入力して申請</p>
            <div className="flex gap-[1.4cqw]">
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="8文字のコード"
                className="flex-1 min-w-0 rounded-lg bg-[#0a1630] border border-[#c9a24a]/60 px-[2cqw] font-mono tracking-widest" style={{ fontSize: fs(34), padding: '1.4cqw 2cqw' }} />
              <button onClick={request} disabled={code.length < 8} className="rounded-lg bg-emerald-500 font-bold px-[3cqw] disabled:opacity-40" style={{ fontSize: fs(28) }}>申請</button>
            </div>
          </div>
        )}
      </Box>

      {/* 下のボタン */}
      <Box x={58} y={1238} w={514} h={80}>
        <button onClick={() => { setTab('search'); setMsg(null); }} className="w-full h-full rounded-xl font-bold text-white"
          style={{ background: 'linear-gradient(180deg,#1b3b78,#10234a)', border: '2px solid #c9a24a', fontSize: fs(30) }}>＋ フレンドを追加する</button>
      </Box>
      <Box x={598} y={1238} w={367} h={80}>
        <button onClick={removeAll} className="w-full h-full rounded-xl font-bold text-slate-200"
          style={{ background: 'linear-gradient(180deg,#13264d,#0a1630)', border: '2px solid #c9a24a99', fontSize: fs(25) }}>フレンド一括削除</button>
      </Box>

      <NavHot go={go} y={1360} h={145} />
      <NavDots summary={summary} y={1372} Dot={Dot} />
    {card && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-[4cqw]" onClick={() => setCard(null)}>
          <div style={{ width: '62cqw' }}><PlayerCard c={card} /></div>
        </div>
      )}
    </Stage>
  );
}
