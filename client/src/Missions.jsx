import { sfx } from './audio';
import { useEffect, useState } from 'react';
import { callApi } from './api';
import { Stage, Box, BackHome, NavHot, NavDots, fs } from './Stage';
import { Dot } from './Parts';

const ROWS = [346, 497, 649];
const ICON = { login: '📅', play: '⚔️', win: '🏆' };
const TABS = [['daily', 'デイリー', 38, 310], ['weekly', 'ウィークリー', 358, 307], ['special', 'スペシャル', 680, 310]];
const gold = 'linear-gradient(180deg,#f1dc9a,#c9a24a)';
const navy = 'linear-gradient(180deg,#13264d,#0a1630)';
const panel = { background: 'linear-gradient(180deg,#0f2147,#0a1530)', border: '3px solid #c9a24a' };

export default function Missions({ user, call, go, summary, refresh }) {
  const [tab, setTab] = useState('daily');
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { callApi(user, '/missions').then((d) => setList(d.missions)).catch((e) => setMsg(e.message)); }, [user]);

  const claim = async (m) => {
    try { const r = await call(`/missions/${m.key}/claim`, { method: 'POST' }); setList(r.missions); refresh(); sfx('coin'); } catch (e) { setMsg(e.message); }
  };

  return (
    <Stage bg="/ui/missions.jpg">
      <BackHome go={go} />

      {TABS.map(([k, label, x, w]) => (
        <Box key={k} x={x} y={236} w={w} h={64}>
          <button onClick={() => setTab(k)} className="w-full h-full rounded-t-lg font-bold"
            style={{ background: tab === k ? gold : navy, color: tab === k ? '#2b1d05' : '#cbd5e1', border: '2px solid #c9a24a', borderBottom: 0, fontSize: fs(30) }}>{label}</button>
        </Box>
      ))}

      {list && list.map((m, i) => {
        const y0 = ROWS[i];
        const pct = Math.min(100, (m.progress / m.target) * 100);
        return (
          <div key={m.key}>
            <Box x={72} y={y0 + 16} w={110} h={104} className="grid place-items-center rounded-lg"
              style={{ background: '#0d1b38', border: '3px solid #c9a24a', fontSize: fs(56) }}>{ICON[m.key]}</Box>
            <Box x={207} y={y0 + 14} w={391} h={62} className="flex items-center justify-between px-[1.4cqw] rounded bg-[#1b2a47]"
              style={{ fontSize: fs(29), fontWeight: 800, color: '#fff' }}>
              <span className="truncate">{m.label}</span><span style={{ fontSize: fs(24), color: '#9fd0ff' }}>{m.progress}/{m.target}</span>
            </Box>
            <Box x={207} y={y0 + 84} w={394} h={30} className="rounded-full bg-[#0e1a30] p-[3px]">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#38bdf8,#a5f3fc)' }} />
            </Box>
            <Box x={623} y={y0 + 17} w={101} h={102} className="flex flex-col items-center justify-center rounded-lg"
              style={{ background: '#17130b', border: '2px solid #c9a24a' }}>
              <img src="/ui/coin.png" alt="" draggable={false} style={{ width: '62%' }} />
              <span style={{ fontSize: fs(28), fontWeight: 800, color: '#ffe9a8', lineHeight: 1 }}>{m.reward}</span>
            </Box>
            <Box x={752} y={y0 + 31} w={196} h={75}>
              {m.claimed ? (
                <div className="w-full h-full rounded-lg grid place-items-center font-bold text-slate-300 bg-[#344155] border-2 border-slate-500" style={{ fontSize: fs(28) }}>受取済</div>
              ) : (
                <button onClick={() => claim(m)} disabled={!m.done} className="w-full h-full rounded-lg font-extrabold text-white border-2 disabled:opacity-100"
                  style={{ fontSize: fs(30), background: m.done ? 'linear-gradient(180deg,#3b8bff,#1d4fd6)' : 'linear-gradient(180deg,#26324d,#1a2339)', borderColor: m.done ? '#8ec5ff' : '#475569', color: m.done ? '#fff' : '#7b8aa8',
                    boxShadow: m.done ? '0 0 18px #4aa3ff' : 'none' }}>
                  {m.done ? '受け取る' : '未達成'}
                </button>
              )}
            </Box>
          </div>
        );
      })}

      {/* 3つ以外の行・下の宝箱欄は使わないので覆う */}
      <Box x={28} y={796} w={968} h={541} className="rounded-xl flex flex-col items-center justify-center text-center p-[3cqw]" style={panel}>
        <p style={{ fontSize: fs(34), fontWeight: 800, color: '#f3e3b0' }}>デイリーミッション</p>
        <p className="mt-[1.4cqw]" style={{ fontSize: fs(25), color: '#9fb2d4', lineHeight: 1.6 }}>毎日0時（日本時間）に更新されます。<br />達成したら「受け取る」でコインがもらえます。</p>
        {msg && <p className="mt-[2cqw] text-red-300" style={{ fontSize: fs(22) }}>{msg}</p>}
      </Box>

      {tab !== 'daily' && (
        <Box x={28} y={322} w={968} h={1015} className="rounded-xl grid place-items-center" style={panel}>
          <p style={{ fontSize: fs(36), fontWeight: 800, color: '#9fb2d4' }}>準備中です</p>
        </Box>
      )}

      <NavHot go={go} y={1365} h={140} />
      <NavDots summary={summary} y={1372} Dot={Dot} />
    </Stage>
  );
}
