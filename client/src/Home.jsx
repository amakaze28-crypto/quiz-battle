import { sfx, getBattleTracks, getBattleBgm, setBattleBgm, setOwnedBgm, previewBgm, stopPreview } from './audio';
import { callApi } from './api';
import { Panel, Btn, LoopText } from './Ui';
import { useState, useEffect } from 'react';
import { Stage, Box, Hot, NavHot, fs, cq } from './Stage';
import AccountMenu from './AccountMenu';
import Hud, { HudFrame } from './Hud';
import { Dot } from './Parts';
import RankDetail from './RankDetail';

export default function Home({ g, summary, go, onLogout, user }) {
  const { profile, conn, phase, queue, error } = g;
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const [bgm, setBgm] = useState(getBattleBgm());
  const [tracks, setTracks] = useState(getBattleTracks());
  // 使える戦闘BGM（買った曲・みんなが使える曲）を取得。選んでいた曲が使えなくなっていたらランダムに戻す
  useEffect(() => {
    let alive = true;
    callApi(user, '/bgm/mine').then((r) => { if (!alive) return; setOwnedBgm(r.tracks); setTracks(getBattleTracks()); setBgm(getBattleBgm()); }).catch(() => {});
    return () => { alive = false; };
  }, [user]);
  const closeDetail = () => { stopPreview(); setDetail(false); };
  const online = conn === 'online' && profile;

  return (
    <>
      <Stage bg="/ui/home2.jpg">
        <HudFrame profile={profile} />
        <Hud profile={profile} summary={summary} go={go} onMenu={() => setMenu(true)} />
        {/* ランクの詳細 */}
        <Hot x={262} y={58} w={474} h={178} label="ランクの詳細" onClick={() => setRankOpen(true)} />
        {conn !== 'online' && (
          <Box x={262} y={304} w={488} h={60} className="rounded-lg bg-black/60 px-3 flex items-center" style={{ fontSize: fs(21), color: '#fcd34d' }}>
            {conn === 'error' ? `接続エラー: ${error}` : <LoopText />}
          </Box>
        )}

        {/* ランクマッチ（画像ボタン）。ランキングは右上、連勝リボンは左上、戦闘BGMは右下 */}
        <Box x={92} y={985} w={840} h={281}>
          <button onClick={() => { if (online) { sfx('queue'); g.joinQueue(); } }} disabled={!online} aria-label="ランクマッチ"
            className="w-full h-full active:scale-[.97] transition-transform disabled:opacity-60">
            <img src="/ui/rankmatch.png" alt="" draggable={false} className="w-full h-full object-contain" style={{ filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.45))' }} />
          </button>
        </Box>
        {/* 連勝中（2連勝から）。ランクマッチの左上に、少し重ねて置く（ランキングボタンは右上へ） */}
        {profile?.streak >= 2 && (
          <Box x={80} y={912} w={300} h={86} className="pointer-events-none">
            <img src="/ui/streak.png" alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain" style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.5))' }} />
            <div className="absolute inset-0 flex items-center justify-center" style={{ paddingLeft: '12%', paddingRight: '8%', fontSize: fs(30), fontWeight: 900, color: '#fff4d2', textShadow: '0 2px 4px #0a1a3a, 0 0 8px #0a1a3a', whiteSpace: 'nowrap' }}>🔥 {profile.streak}連勝中</div>
          </Box>
        )}
        <Box x={748} y={922} w={206} h={55}>
          <button onClick={() => go('ranking')} aria-label="ランキング" className="w-full h-full active:scale-95 transition-transform">
            <img src="/ui/ranking.png" alt="" draggable={false} className="w-full h-full object-contain" style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,.55))' }} />
          </button>
        </Box>
        <Box x={846} y={1258} w={86} h={86}>
          <button onClick={() => setDetail(true)} aria-label="戦闘BGMの設定" className="w-full h-full active:scale-90 transition-transform">
            <img src="/ui/note.png" alt="" draggable={false} className="w-full h-full object-contain" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.6))' }} />
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
              <div className="space-y-2 mb-4 max-h-[50vh] overflow-y-auto">
                {tracks.map(([k, label]) => (
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
              <p className="text-sm text-slate-300 mb-4">{queue ? `${queue.waitSec}秒${queue.size != null ? `（待機${queue.size}人）` : ''}` : ''}</p>
              <button onClick={g.leaveQueue} className="px-5 py-2 rounded-lg bg-slate-700">キャンセル</button>
            </div>
          </div>
        )}
      </Stage>
      <AccountMenu open={menu} onClose={() => setMenu(false)} anchor="left" profile={profile} go={go} onLogout={onLogout} />
    </>
  );
}
