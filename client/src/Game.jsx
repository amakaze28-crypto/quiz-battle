import { useEffect, useState } from 'react';
import { Stage, Box, fs } from './Stage';
import { Avatar } from './Parts';
import ReportModal, { QuestionReportModal } from './ReportModal';
import { sfx } from './audio';

const CARD_X = [37, 282, 527, 773];
const BTN = [
  { x: 27, y: 925, w: 473, h: 163 },
  { x: 523, y: 925, w: 474, h: 163 },
  { x: 27, y: 1108, w: 473, h: 167 },
  { x: 523, y: 1108, w: 474, h: 167 },
];
const qSize = (t) => (t.length < 28 ? 42 : t.length < 60 ? 34 : t.length < 110 ? 28 : 23);
const cSize = (t) => (t.length < 10 ? 36 : t.length < 20 ? 29 : t.length < 34 ? 24 : 20);

function MarkPop({ kind }) {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setTimeout(() => setOn(false), 1300); return () => clearTimeout(t); }, []);
  if (!on) return null;
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none">
      <svg viewBox="0 0 200 200" className="mark-pop" style={{ width: '62cqw', height: '62cqw', filter: 'drop-shadow(0 8px 14px rgba(0,0,0,.55))' }}>
        {kind === 'o'
          ? <circle cx="100" cy="100" r="68" fill="none" stroke="#ff4d4d" strokeWidth="26" />
          : <g stroke="#3b82f6" strokeWidth="26" strokeLinecap="round"><line x1="36" y1="36" x2="164" y2="164" /><line x1="164" y1="36" x2="36" y2="164" /></g>}
      </svg>
    </div>
  );
}

export default function Game({ g, user }) {
  const { q, match, scores, avgTimes, secIntro, answer, conn, profile } = g;
  const [now, setNow] = useState(performance.now());
  const [report, setReport] = useState(false);
  const [qReport, setQReport] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(t);
  }, []);

  // ◯×の表示と音（自分の解答結果 / 時間切れ）
  const finishedNow = !!q?.result;
  const markKind = q?.mine ? (q.mine.correct ? 'o' : 'x') : finishedNow && q.myChoice === null ? 'x' : null;
  const markKey = markKind ? `${q.index}-${markKind}` : null;
  useEffect(() => { if (markKey) sfx(markKind === 'o' ? 'correct' : 'wrong'); }, [markKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const introOn = !!secIntro && now - secIntro.at < secIntro.ms;
  useEffect(() => { if (secIntro) sfx('secondary'); }, [secIntro]);

  if (!q || !match) return null;
  const myUid = profile?.uid;
  const finished = !!q.result;
  const remain = Math.max(0, q.timeLimitMs - (now - q.recvAt));
  const answered = q.myChoice !== null;
  const me = match.players.find((p) => p.uid === myUid);
  // 現在の順位: 得点 → 平均解答時間（最終のレート計算と同じ基準）。計算の前から平均時間が順位に効く
  const avg = (uid) => avgTimes?.[uid];
  const order = [...match.players].sort((a, b) => (scores[b.uid] ?? 0) - (scores[a.uid] ?? 0) || (avg(a.uid) ?? 99) - (avg(b.uid) ?? 99));
  const myPlace = order.findIndex((p) => p.uid === myUid) + 1;
  const correctCount = finished ? Object.values(q.result.results).filter((x) => x.correct).length : 0;

  let status = '解答してください！';
  if (conn !== 'online') status = '通信が切断されました';
  else if (finished) status = `正解者 ${correctCount}人`;
  else if (q.mine) status = q.mine.correct ? (q.secondary ? '正解！ +2（SECONDARY）' : '正解！ +1') : 'お手つき…';
  else if (q.secondary && !answered) status = '★ SECONDARY ×2 ★';
  else if (answered) status = '判定中…';

  const mainText = finished
    ? `正解：${'ABCD'[q.result.correctIndex]}　${q.choices[q.result.correctIndex]}`
    : q.question;

  return (
    <>
      <Stage bg="/ui/arena.jpg">
        {/* 自分（左上） */}
        <Box x={26} y={31} w={112} h={112}><Avatar iconId={me?.iconId} frameId={me?.frameId} size={0} /></Box>
        <Box x={165} y={44} w={230} h={40} className="flex items-center truncate" style={{ fontSize: fs(25), fontWeight: 700 }}>{me?.name}</Box>
        <Box x={165} y={97} w={205} h={28} className="flex items-center" style={{ fontSize: fs(20), color: '#cbd5e1' }}>
          {profile?.rank?.label}　{profile?.isMaster ? `${profile.mr}MR` : `${profile?.pt}pt`}
        </Box>

        {/* 問題の通報 */}
        <Box x={420} y={52} w={320} h={72} className="rounded-lg bg-[#0d2347] border border-[#3b7bc4] grid place-items-center">
          <button onClick={() => setQReport(true)} className="w-full h-full font-bold text-amber-300" style={{ fontSize: fs(26) }}>⚠ 問題を通報</button>
        </Box>

        {/* 右上：通報（チャット機能は無し） */}
        <Box x={765} y={52} w={240} h={72} className="rounded-lg bg-[#0d2347] border border-[#3b7bc4] grid place-items-center">
          <button onClick={() => setReport(true)} className="w-full h-full font-bold text-red-300" style={{ fontSize: fs(26) }}>🚩 通報</button>
        </Box>

        {/* 4人のカード（得点順。金枠＝現在トップ） */}
        {order.map((p, i) => {
          const x = CARD_X[i];
          const cx = x + 108;
          const res = q.result?.results?.[p.uid];
          const done = q.answeredUids.includes(p.uid);
          const mark = finished ? (res?.correct ? ['✔', 'bg-emerald-500'] : [res?.choice === null ? '–' : '✖', res?.choice === null ? 'bg-slate-500' : 'bg-red-500']) : done ? ['✔', 'bg-sky-500'] : null;
          return (
            <div key={p.uid}>
              <Box x={cx - 58} y={250} w={116} h={116}><Avatar iconId={p.iconId} frameId={p.frameId} size={0} /></Box>
              {mark && (
                <Box x={cx + 20} y={326} w={44} h={44} className={`rounded-full grid place-items-center font-bold ring-2 ring-white ${mark[1]}`} style={{ fontSize: fs(26) }}>{mark[0]}</Box>
              )}
              <Box x={x + 18} y={372} w={180} h={32} className="flex items-center justify-center truncate" style={{ fontSize: fs(21), fontWeight: 700 }}>{p.name}</Box>
              <Box x={x + 22} y={418} w={172} h={32} className="flex items-center justify-center gap-1" style={{ fontSize: fs(21), fontWeight: 800, color: '#fde68a' }}>
                {scores[p.uid] ?? 0}点
                {res?.gain > 0 && <span style={{ color: q.secondary ? '#fb923c' : '#4ade80' }}>+{res.gain}{q.secondary ? '★' : ''}</span>}
              </Box>
              <Box x={x + 14} y={469} w={188} h={26} className="flex items-center justify-center gap-1" style={{ fontSize: fs(17), fontWeight: 700, color: i === 0 && avg(p.uid) !== undefined ? '#fde68a' : '#bfd6f6', textShadow: '0 1px 3px #000' }}>
                {i === 0 && avg(p.uid) !== undefined && <span>👑</span>}平均 {avg(p.uid) !== undefined ? `${avg(p.uid).toFixed(1)}秒` : '--'}
              </Box>
              {p.uid === myUid && <Box x={x} y={222} w={217} h={244} className="rounded-xl border-4 border-white/80 pointer-events-none" />}
            </div>
          );
        })}

        {/* 問題パネル */}
        <Box x={72} y={526} w={196} h={40} className="flex items-center justify-center" style={{ fontSize: fs(23), fontWeight: 800, color: '#fde68a' }}>第{q.index + 1}問 / {q.total}</Box>
        <Box x={672} y={530} w={262} h={38} className={`flex items-center justify-center ${q.secondary && !finished ? 'animate-pulse' : ''}`}
          style={{ fontSize: fs(21), fontWeight: 800, color: q.secondary && !finished ? '#fdba74' : '#7dd3fc' }}>{status}</Box>
        {/* 現在の順位 */}
        <Box x={300} y={532} w={360} h={34} className="flex items-center justify-center" style={{ fontSize: fs(20), fontWeight: 800, color: '#fff', textShadow: '0 1px 4px #000' }}>
          {Object.keys(avgTimes || {}).length ? `現在 ${myPlace}位` : ''}
        </Box>
        {q.secondary && <Box x={72} y={582} w={880} h={176} className="rounded-2xl pointer-events-none" style={{ boxShadow: '0 0 0 5px rgba(255,170,60,.9), 0 0 36px 8px rgba(255,150,40,.55) inset' }} />}
        <Box x={80} y={590} w={864} h={160} className="flex flex-col items-center justify-center text-center px-2"
          style={{ fontSize: fs(finished ? 36 : qSize(q.question)), fontWeight: 800, lineHeight: 1.35, color: finished ? '#86efac' : '#fff', textShadow: '0 2px 6px #000' }}>
          {mainText}
          {finished && q.result.explanation && <span style={{ fontSize: fs(22), fontWeight: 500, color: '#cbd5e1', marginTop: 8 }}>{q.result.explanation}</span>}
        </Box>

        {/* タイマー */}
        <Box x={130} y={842} w={700} h={36} className="rounded-full bg-[#06142c] border border-[#1b4f86] p-[3px]">
          <div className="h-full rounded-full" style={{ width: `${(remain / q.timeLimitMs) * 100}%`, background: 'linear-gradient(90deg,#38bdf8,#a5f3fc)', transition: 'width .1s linear' }} />
        </Box>
        <Box x={866} y={840} w={104} h={42} className="flex items-center justify-center" style={{ fontSize: fs(30), fontWeight: 800 }}>{Math.ceil(remain / 1000)}</Box>

        {/* 4択 */}
        {q.choices.map((c, i) => {
          const b = BTN[i];
          const isCorrect = finished && i === q.result.correctIndex;
          const isMineWrong = finished && i === q.myChoice && !isCorrect;
          return (
            <Box key={i} {...b}>
              <button disabled={answered || finished || conn !== 'online'} onClick={() => answer(i)}
                className="relative w-full h-full rounded-2xl text-left disabled:cursor-default" style={{ paddingLeft: '23%', paddingRight: '4%' }}>
                <span className="absolute left-[15%] top-1/2 -translate-x-1/2 -translate-y-1/2 font-extrabold" style={{ fontSize: fs(44), textShadow: '0 2px 4px #000' }}>{'ABCD'[i]}</span>
                <span className="block" style={{ fontSize: fs(cSize(c)), fontWeight: 800, lineHeight: 1.25, textShadow: '0 2px 5px #000' }}>{c}</span>
                {/* 状態の重ね表示 */}
                {(answered || finished) && !isCorrect && !isMineWrong && i !== q.myChoice && <span className="absolute inset-0 rounded-2xl bg-black/45" />}
                {i === q.myChoice && !finished && <span className="absolute inset-0 rounded-2xl ring-[6px] ring-white" />}
                {isCorrect && <span className="absolute inset-0 rounded-2xl ring-[7px] ring-emerald-400 bg-emerald-300/20" />}
                {isMineWrong && <span className="absolute inset-0 rounded-2xl ring-[7px] ring-red-500 bg-red-500/25" />}
              </button>
            </Box>
          );
        })}

        {/* Secondary告知（出題の前に表示。この問題は全員2倍） */}
        {introOn && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,140,30,.35), rgba(0,0,0,.75))', animation: `secflash ${secIntro.ms}ms ease-out both` }}>
            <div className="text-center" style={{ animation: `secin ${secIntro.ms}ms cubic-bezier(.2,.9,.3,1.1) both` }}>
              <p style={{ fontSize: fs(120), fontWeight: 900, letterSpacing: '.06em', color: '#ffe3a0', animation: 'secglow 1s ease-in-out infinite' }}>SECONDARY</p>
              <p style={{ fontSize: fs(56), fontWeight: 900, color: '#fff', textShadow: '0 3px 10px #000' }}>この問題の得点は 2倍！</p>
              <p style={{ fontSize: fs(30), fontWeight: 700, color: '#ffd9a0', marginTop: '2cqw' }}>正解した全員が +2点</p>
            </div>
          </div>
        )}

        {/* ◯×（正解は◯・不正解/時間切れは×） */}
        {markKey && <MarkPop key={markKey} kind={markKind} />}
      </Stage>
      {qReport && <QuestionReportModal user={user} question={{ id: q.id, question: q.question }} onClose={() => setQReport(false)} />}
      {report && <ReportModal user={user} roomId={match.roomId} players={match.players.filter((p) => p.uid !== myUid)} onClose={() => setReport(false)} />}
    </>
  );
}
