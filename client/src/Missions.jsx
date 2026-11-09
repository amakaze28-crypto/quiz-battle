import { sfx } from './audio';
import { useEffect, useState } from 'react';
import { callApi } from './api';
import { Stage, Box, BackHome, NavHot, fs } from './Stage';
import { Dot } from './Parts';

const ROWS = [346, 497, 649, 801, 953];
const TABS = [['daily', 'デイリー', 38, 310], ['weekly', 'ウィークリー', 358, 307], ['special', 'スペシャル', 680, 310]];
const gold = 'linear-gradient(180deg,#f1dc9a,#c9a24a)';
const navy = 'linear-gradient(180deg,#13264d,#0a1630)';
const panel = { background: 'linear-gradient(180deg,#0f2147,#0a1530)', border: '3px solid #c9a24a' };

const INFO = {
  daily: ['デイリーミッション', '毎日0時（日本時間）に更新されます。\n達成したら「受け取る」でコインがもらえます。'],
  weekly: ['ウィークリーミッション', '毎週月曜0時（日本時間）に更新されます。\n達成したら「受け取る」で報酬がもらえます。'],
  special: ['スペシャルミッション', '期間限定のミッションです。\n期間が終わる前に受け取りましょう。'],
};
const dateLabel = (ms) => { const d = new Date(ms + 9 * 3600 * 1000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };

function Reward({ m }) {
  const coins = m.coins ?? m.reward ?? 0; const sand = m.sand || 0;
  const Line = ({ src, n }) => (
    <span className="flex items-center justify-center gap-[0.6cqw] whitespace-nowrap" style={{ fontSize: fs(sand && coins ? 21 : 26), fontWeight: 800, color: '#ffe9a8', lineHeight: 1 }}>
      <img src={src} alt="" draggable={false} style={{ width: sand && coins ? '3.8cqw' : '4.6cqw', height: sand && coins ? '3.8cqw' : '4.6cqw', objectFit: 'contain' }} />{n}
    </span>
  );
  return (
    <Box x={623} y={m.y0 + 17} w={101} h={102} className="flex flex-col items-center justify-center gap-[1cqw] rounded-lg" style={{ background: '#17130b', border: '2px solid #c9a24a' }}>
      {coins > 0 && <Line src="/ui/coin.png" n={coins} />}
      {sand > 0 && <Line src="/ui/sand.png" n={sand} />}
    </Box>
  );
}

export default function Missions({ user, call, go, summary, refresh }) {
  const [tab, setTab] = useState('daily');
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { callApi(user, '/missions').then(setData).catch((e) => setMsg(e.message)); }, [user]);

  const claim = async (m) => {
    try {
      const path = m.id ? `/missions/x/${m.id}/claim` : `/missions/${m.key}/claim`;
      const r = await call(path, { method: 'POST' });
      setData((d) => ({ ...d, missions: r.missions, weekly: r.weekly, special: r.special })); refresh(); sfx('coin');
    } catch (e) { setMsg(e.message); }
  };

  const list = data ? (tab === 'daily' ? data.missions : data[tab]) : [];
  const [title, info] = INFO[tab];

  return (
    <Stage bg="/ui/missions.jpg">
      <BackHome go={go} />

      {TABS.map(([k, label, x, w]) => (
        <Box key={k} x={x} y={236} w={w} h={64}>
          <button onClick={() => { setTab(k); setMsg(''); }} className="w-full h-full rounded-t-lg font-bold"
            style={{ background: tab === k ? gold : navy, color: tab === k ? '#2b1d05' : '#cbd5e1', border: '2px solid #c9a24a', borderBottom: 0, fontSize: fs(30) }}>{label}</button>
        </Box>
      ))}

      {list.slice(0, 5).map((m, i) => {
        const y0 = ROWS[i];
        const pct = Math.min(100, (m.progress / m.target) * 100);
        const label = m.endAt ? `${m.label}（〜${dateLabel(m.endAt)}）` : m.label;
        return (
          <div key={m.key}>
            <Box x={207} y={y0 + 14} w={391} h={62} className="flex items-center justify-between px-[1.4cqw] rounded bg-[#1b2a47]"
              style={{ fontSize: fs(label.length > 18 ? 22 : 27), fontWeight: 800, color: '#fff' }}>
              <span className="truncate">{label}</span><span className="shrink-0 ml-[1cqw]" style={{ fontSize: fs(24), color: '#9fd0ff' }}>{m.progress}/{m.target}</span>
            </Box>
            <Box x={207} y={y0 + 84} w={394} h={30} className="rounded-full bg-[#0e1a30] p-[3px]">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#38bdf8,#a5f3fc)' }} />
            </Box>
            <Reward m={{ ...m, y0 }} />
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

      {/* 使わない行・下の宝箱欄を覆う（ミッション数に応じて） */}
      {(() => {
        const n = Math.min(5, list.length);
        const y = n === 0 ? 322 : ROWS[n] - 8;
        return (
          <Box x={28} y={y} w={968} h={1337 - y} className="rounded-xl flex flex-col items-center justify-center text-center p-[3cqw]" style={panel}>
            {n === 0 && data ? <p style={{ fontSize: fs(36), fontWeight: 800, color: '#9fb2d4' }}>いまミッションはありません</p> : (
              <>
                <p style={{ fontSize: fs(34), fontWeight: 800, color: '#f3e3b0' }}>{title}</p>
                <p className="mt-[1.4cqw]" style={{ fontSize: fs(25), color: '#9fb2d4', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{info}</p>
              </>
            )}
            {msg && <p className="mt-[2cqw] text-red-300" style={{ fontSize: fs(22) }}>{msg}</p>}
          </Box>
        );
      })()}

      <NavHot go={go} active="missions" summary={summary} />
    </Stage>
  );
}
