import { Box, Hot, fs } from './Stage';
import RankBadge from './RankBadge';
import { Avatar, Coin, Sand, Dot } from './Parts';

// ホーム・ガチャ共通の上部（アイコン／現在のランク／コイン・砂／メール・メニュー）
export default function Hud({ profile, summary, onMenu, go }) {
  const r = profile?.rank;
  const master = profile?.isMaster;
  const progress = r && r.nextAt ? Math.min(100, Math.max(0, ((profile.pt - r.subStart) / (r.nextAt - r.subStart)) * 100)) : 100;
  return (
    <>
      <Box x={34} y={42} w={196} h={196}>
        <button onClick={onMenu} className="w-full h-full rounded-full"><Avatar iconId={profile?.iconId} frameId={profile?.frameId} size={0} /></button>
      </Box>

      {r && (
        <>
          <Box x={285} y={87} w={122} h={122}><RankBadge rank={r} size="fill" /></Box>
          <Box x={432} y={92} w={290} h={56} className="flex items-center" style={{ fontSize: fs(master ? 30 : 36), fontWeight: 800, color: '#fff4d2', textShadow: '0 2px 6px #000' }}>{r.label}</Box>
          {master ? (
            <Box x={426} y={160} w={300} h={64} className="rounded bg-[#0d1d3b] flex items-center px-2" style={{ fontSize: fs(30), fontWeight: 800, color: '#fff4d2' }}>{profile.mr} MR</Box>
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

      {profile && (
        <>
          <Box x={262} y={244} w={236} h={46} className="flex items-center rounded-full bg-[#0b1a36]/85 border border-[#c9a24a]/70 px-3" style={{ fontSize: fs(26), color: '#ffe9a8' }}><Coin n={profile.coins} size={34} /></Box>
          <Box x={514} y={244} w={236} h={46} className="flex items-center rounded-full bg-[#0b1a36]/85 border border-[#c9a24a]/70 px-3" style={{ fontSize: fs(26), color: '#ffe9a8' }}><Sand n={profile.sand} size={38} /></Box>
        </>
      )}

      {/* 右上：メール／メニュー（お知らせは廃止） */}
      <Hot x={782} y={46} w={70} h={64} label="メール" onClick={() => go('mail')} />
      <Hot x={944} y={46} w={56} h={56} label="メニュー" onClick={onMenu} />
      {summary?.mail > 0 && <Box x={824} y={40} w={20} h={20}><Dot className="w-full h-full" /></Box>}
    </>
  );
}
