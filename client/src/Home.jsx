import { useState } from 'react';
import { Stage, Box, Hot, NavHot, NavDots, fs } from './Stage';
import AccountMenu from './AccountMenu';
import Hud from './Hud';
import { Dot } from './Parts';

export default function Home({ g, summary, go, onLogout }) {
  const { profile, conn, phase, queue, error } = g;
  const [menu, setMenu] = useState(false);
  const online = conn === 'online' && profile;

  return (
    <>
      <Stage bg="/ui/home.jpg">
        <Hud profile={profile} summary={summary} go={go} onMenu={() => setMenu(true)} />
        {conn !== 'online' && (
          <Box x={262} y={304} w={488} h={60} className="rounded-lg bg-black/60 px-3 flex items-center" style={{ fontSize: fs(21), color: '#fcd34d' }}>
            {conn === 'error' ? `接続エラー: ${error}` : 'サーバーに接続中…（起動に最大1分ほどかかります）'}
          </Box>
        )}

        <Hot x={65} y={850} w={890} h={290} label="ランクマッチ" onClick={() => (online ? g.joinQueue() : null)} />
        {error && conn === 'online' && (
          <Box x={100} y={1150} w={820} h={50} className="text-center" style={{ fontSize: fs(24), color: '#fca5a5', textShadow: '0 1px 4px #000' }}>{error}</Box>
        )}

        <NavHot go={go} y={1322} h={150} />
        <NavDots summary={summary} y={1332} Dot={Dot} />

        {phase === 'queue' && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/60">
            <div className="rounded-2xl bg-[#0b1a36] border border-[#c9a24a]/70 px-8 py-6 text-center text-white">
              <p className="animate-pulse mb-2 font-bold">マッチング中…</p>
              <p className="text-sm text-slate-300 mb-4">{queue ? `${queue.waitSec}秒（待機${queue.size}人）` : ''}</p>
              <button onClick={g.leaveQueue} className="px-5 py-2 rounded-lg bg-slate-700">キャンセル</button>
            </div>
          </div>
        )}
      </Stage>
      <AccountMenu open={menu} onClose={() => setMenu(false)} anchor="left" profile={profile} go={go} onLogout={onLogout} />
    </>
  );
}
