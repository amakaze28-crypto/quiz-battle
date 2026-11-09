import { sfx, BATTLE_TRACKS, getBattleBgm, setBattleBgm, previewBgm, stopPreview } from './audio';
import { Panel, Btn } from './Ui';
import { useState } from 'react';
import { Stage, Box, Hot, NavHot, fs, cq } from './Stage';
import AccountMenu from './AccountMenu';
import Hud from './Hud';
import { Dot } from './Parts';
import RankDetail from './RankDetail';

export default function Home({ g, summary, go, onLogout, user }) {
  const { profile, conn, phase, queue, error } = g;
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const [bgm, setBgm] = useState(getBattleBgm());
  const closeDetail = () => { stopPreview(); setDetail(false); };
  const online = conn === 'online' && profile;

  return (
    <>
      <Stage bg="/ui/home2.jpg">
        {/* 背景に絵柄がないので、上部のステータス枠はここで描く */}
        <Box x={22} y={30} w={760} h={280} className="rounded-[3.2cqw]"
          style={{ background: 'linear-gradient(180deg,rgba(16,36,78,.82),rgba(8,20,48,.82))', border: `${cq(4)} solid #c9a24a`, boxShadow: '0 6px 22px rgba(0,0,0,.4), inset 0 0 0 2px rgba(255,236,170,.18)', backdropFilter: 'blur(3px)' }} />
        <Box x={40} y={48} w={184} h={184} className="rounded-full" style={{ border: `${cq(7)} solid #e0b64f`, boxShadow: '0 0 14px rgba(255,214,120,.5), inset 0 0 8px rgba(0,0,0,.5)' }} />
        <Box x={742} y={92} w={30} h={96} className="grid place-items-center pointer-events-none" style={{ fontSize: fs(46), color: '#e0b64f', fontWeight: 900 }}>›</Box>
        {profile?.rank && !profile.isMaster && (
          <>
            <Box x={433} y={164} w={288} h={17} className="rounded-full" style={{ background: 'rgba(3,10,28,.75)', border: `${cq(2)} solid rgba(201,162,74,.6)` }} />
            <Box x={433} y={189} w={140} h={32} className="flex items-center" style={{ fontSize: fs(21), color: "#cfd9f0" }}>次のランクまで</Box>
          </>
        )}
        <Hud profile={profile} summary={summary} go={go} onMenu={() => setMenu(true)} />
        {/* ランクの詳細 */}
        <Hot x={262} y={58} w={474} h={178} label="ランクの詳細" onClick={() => setRankOpen(true)} />
        {conn !== 'online' && (
          <Box x={262} y={304} w={488} h={60} className="rounded-lg bg-black/60 px-3 flex items-center" style={{ fontSize: fs(21), color: '#fcd34d' }}>
            {conn === 'error' ? `接続エラー: ${error}` : 'サーバーに接続中…（起動に最大1分ほどかかります）'}
          </Box>
        )}

        {/* ランキング・戦闘BGM */}
        <Box x={68} y={905} w={206} h={55}>
          <button onClick={() => go('ranking')} aria-label="ランキング" className="w-full h-full active:scale-95 transition-transform">
            <img src="/ui/ranking.png" alt="" draggable={false} className="w-full h-full object-contain" style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,.55))' }} />
          </button>
        </Box>
        <Box x={852} y={880} w={104} h={104}>
          <button onClick={() => setDetail(true)} aria-label="戦闘BGMの設定" className="w-full h-full active:scale-90 transition-transform">
            <img src="/ui/note.png" alt="" draggable={false} className="w-full h-full object-contain" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.6))' }} />
          </button>
        </Box>

        {/* ランクマッチ */}
        <Box x={65} y={1010} w={894} h={250}>
          <button onClick={() => { if (online) { sfx('queue'); g.joinQueue(); } }} disabled={!online} aria-label="ランクマッチ"
            className="w-full h-full rounded-[3.4cqw] relative overflow-hidden active:scale-[.98] transition-transform disabled:opacity-60 flex items-center justify-center"
            style={{ background: 'linear-gradient(180deg,#2b63c9 0%,#173c86 48%,#0d2459 100%)', border: `${cq(6)} solid #e0b64f`, boxShadow: `0 0 ${cq(34)} rgba(255,214,120,.55), 0 ${cq(10)} ${cq(22)} rgba(0,0,0,.45), inset 0 ${cq(4)} 0 rgba(255,255,255,.35)` }}>
            <span className="absolute inset-x-0 top-0 h-1/2" style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.25),rgba(255,255,255,0))' }} />
            <span className="relative flex items-center" style={{ gap: cq(26) }}>
              <svg viewBox="0 0 64 64" style={{ width: cq(104), height: cq(104), filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.6))' }}>
                <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 8l30 30M54 8L24 38" stroke="#fff4d2" strokeWidth="5" />
                  <path d="M10 8l30 30M54 8L24 38" stroke="#c9a24a" strokeWidth="1.6" />
                  <path d="M36 42l8 8M28 42l-8 8" stroke="#e0b64f" strokeWidth="5" />
                  <path d="M40 54l5 5M24 54l-5 5" stroke="#e0b64f" strokeWidth="6" />
                </g>
              </svg>
              <span className="flex flex-col items-start">
                <span style={{ fontSize: fs(92), fontWeight: 900, lineHeight: 1.05, color: '#fff4d2', textShadow: '0 4px 0 #6b4a10, 0 6px 12px rgba(0,0,0,.6)', letterSpacing: '0.04em' }}>ランクマッチ</span>
                <span style={{ fontSize: fs(30), fontWeight: 700, color: '#cfe0ff', textShadow: '0 2px 4px #000' }}>4択早押しクイズで勝負！</span>
              </span>
            </span>
          </button>
        </Box>
        {error && conn === 'online' && (
          <Box x={100} y={1146} w={820} h={44} className="text-center" style={{ fontSize: fs(24), color: '#fca5a5', textShadow: '0 1px 4px #000' }}>{error}</Box>
        )}

        <NavHot go={go} active="home" summary={summary} />

        {rankOpen && user && <RankDetail user={user} profile={profile} onClose={() => setRankOpen(false)} />}
        {detail && (
          <div className="stage-overlay z-20 flex items-center justify-center bg-black/60 p-4" onClick={closeDetail}>
            <Panel className="w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-center font-bold text-lg mb-1">♪ 戦闘BGM</h2>
              <p className="text-center text-xs text-slate-300 mb-3">戦闘中に流れるBGMを選べます（選ぶと少しだけ試聴できます）</p>
              <div className="space-y-2 mb-4">
                {BATTLE_TRACKS.map(([k, label]) => (
                  <label key={k} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer ${bgm === k ? 'border-amber-400 bg-amber-400/15' : 'border-white/15 bg-black/20'}`}>
                    <input type="radio" name="bgm" className="accent-amber-400 w-4 h-4" checked={bgm === k} onChange={() => { setBgm(k); setBattleBgm(k); previewBgm(k); }} />
                    <span className="font-semibold">{label}</span>
                  </label>
                ))}
              </div>
              <Btn variant="gold" block onClick={closeDetail}>とじる</Btn>
            </Panel>
          </div>
        )}
        {phase === 'queue' && (
          <div className="stage-overlay z-10 grid place-items-center bg-black/60">
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
