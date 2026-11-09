import { useState } from 'react';
import { Stage, Box, Hot, fs } from './Stage';
import RankBadge from './RankBadge';
import AccountMenu from './AccountMenu';
import { Avatar, Coin, Dot } from './Parts';

const NAV = ['home', 'shop', 'missions', 'friends', 'notices'];

export default function Home({ g, summary, go, onLogout }) {
  const { profile, conn, phase, queue, error } = g;
  const [menu, setMenu] = useState(false);
  const r = profile?.rank;
  const master = profile?.isMaster;
  const progress = r && r.nextAt ? Math.min(100, Math.max(0, ((profile.pt - r.subStart) / (r.nextAt - r.subStart)) * 100)) : 100;
  const dots = { mail: summary?.mail > 0, bell: summary?.notice > 0, missions: summary?.mission > 0, friends: summary?.friend > 0, notices: summary?.notice > 0 };
  const online = conn === 'online' && profile;

  return (
    <>
      <Stage bg="/ui/home.jpg">
        {/* アイコン（タップでメニュー） */}
        <Box x={36} y={46} w={190} h={190}>
          <button onClick={() => setMenu(true)} className="w-full h-full rounded-full overflow-hidden"><Avatar iconId={profile?.iconId} size={0} /></button>
        </Box>

        {/* 現在のランク */}
        {r && (
          <>
            <Box x={285} y={87} w={122} h={122}><RankBadge rank={r} size="fill" /></Box>
            <Box x={432} y={92} w={290} h={56} className="flex items-center" style={{ fontSize: fs(master ? 30 : 36), fontWeight: 800, color: '#fff4d2', textShadow: '0 2px 6px #000' }}>
              {r.label}
            </Box>
            {master ? (
              <Box x={426} y={160} w={300} h={64} className="rounded bg-[#0d1d3b] flex items-center px-2" style={{ fontSize: fs(30), fontWeight: 800, color: '#fff4d2' }}>
                {profile.mr} MR
              </Box>
            ) : (
              <>
                <Box x={433} y={164} w={288} h={17} className="rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#f5d27a,#e8a93a)' }} />
                </Box>
                <Box x={535} y={189} w={110} h={32} className="text-right" style={{ fontSize: fs(26), fontWeight: 800, color: '#fff' }}>{r.nextAt - profile.pt}</Box>
              </>
            )}
          </>
        )}

        {/* コイン */}
        {profile && (
          <Box x={290} y={244} w={235} h={46} className="flex items-center rounded-full bg-[#0b1a36]/85 border border-[#c9a24a]/70 px-3" style={{ fontSize: fs(26), color: '#ffe9a8' }}>
            <Coin n={profile.coins} size={34} />
          </Box>
        )}
        {conn !== 'online' && (
          <Box x={290} y={300} w={440} h={60} className="rounded-lg bg-black/60 px-3 flex items-center" style={{ fontSize: fs(21), color: '#fcd34d' }}>
            {conn === 'error' ? `接続エラー: ${error}` : 'サーバーに接続中…（起動に最大1分ほどかかります）'}
          </Box>
        )}

        {/* 右上：メール／お知らせ／メニュー */}
        <Hot x={782} y={46} w={56} h={56} label="メール" onClick={() => go('mail')} />
        <Hot x={860} y={46} w={56} h={56} label="お知らせ" onClick={() => go('notices')} />
        <Hot x={944} y={46} w={56} h={56} label="メニュー" onClick={() => setMenu(true)} />
        {dots.mail && <Box x={822} y={44} w={20} h={20}><Dot className="w-full h-full" /></Box>}
        {dots.bell && <Box x={896} y={40} w={20} h={20}><Dot className="w-full h-full" /></Box>}

        {/* ランクマッチ */}
        <Hot x={65} y={850} w={890} h={290} label="ランクマッチ" onClick={() => (online ? g.joinQueue() : null)} />
        {error && conn === 'online' && (
          <Box x={100} y={1150} w={820} h={50} className="text-center" style={{ fontSize: fs(24), color: '#fca5a5', textShadow: '0 1px 4px #000' }}>{error}</Box>
        )}

        {/* 下部ナビ */}
        {NAV.map((k, i) => <Hot key={k} x={i * 205} y={1322} w={205} h={150} label={k} onClick={() => (k === 'home' ? null : go(k))} />)}
        {dots.missions && <Box x={546} y={1332} w={20} h={20}><Dot className="w-full h-full" /></Box>}
        {dots.friends && <Box x={750} y={1332} w={20} h={20}><Dot className="w-full h-full" /></Box>}
        {dots.notices && <Box x={952} y={1332} w={20} h={20}><Dot className="w-full h-full" /></Box>}

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
