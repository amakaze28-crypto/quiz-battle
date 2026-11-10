import { useState } from 'react';
import RankBadge from './RankBadge';
import { Avatar } from './Parts';
import ReportModal from './ReportModal';
import { BgLayer, Panel, Btn, Title } from './Ui';

export default function Result({ g, user }) {
  const { result, goHome, profile } = g;
  const myUid = profile?.uid;
  const [report, setReport] = useState(null); // 通報対象のuid

  return (
    <div className="min-h-screen text-white p-4 max-w-md mx-auto ui-text">
      <BgLayer dim />
      <Title>試合結果</Title>
      <div className="space-y-3 mb-6">
        {result.results.map((r) => (
          <Panel key={r.uid} className={`p-3 ${r.uid === myUid ? 'ring-2 ring-[#f1d58a]/80' : ''}`}>
            <div className="flex justify-between items-center">
              <span className="font-bold flex items-center gap-2 min-w-0">
                <Avatar iconId={r.iconId} frameId={r.frameId} size={36} />
                <span className="truncate">{r.place}位{r.tie ? '（同率）' : ''}　{r.name}</span>
              </span>
              <span className={`text-xl font-extrabold ${r.delta > 0 ? 'text-emerald-400' : r.delta < 0 ? 'text-red-400' : ''}`}>
                {r.delta > 0 ? '+' : ''}{r.delta}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
              <RankBadge rank={{ key: r.rankKey, sub: r.rankSub, label: r.rank }} size={32} />
              <span>
                {r.score}点{r.secondaries > 0 && <span className="text-orange-300">（★{r.secondaries}回）</span>}　平均 {r.avgTime}秒　→ {r.rank}
                {r.mr != null ? `（${r.mr} MR）` : r.pt != null ? `（${r.pt} pt）` : ''}
              </span>
            </div>
            {r.uid !== myUid && (
              <div className="mt-2 text-right"><button onClick={() => setReport(r.uid)} className="text-xs text-red-300 underline">通報</button></div>
            )}
          </Panel>
        ))}
      </div>
      <Btn variant="gold" block className="w-full !min-h-[56px] text-xl" onClick={goHome}>ホームに戻る</Btn>
      {report && (
        <ReportModal user={user} roomId={result.roomId} initialUid={report}
          players={result.results.filter((r) => r.uid !== myUid).map((r) => ({ uid: r.uid, name: r.name, iconId: r.iconId, frameId: r.frameId }))}
          onClose={() => setReport(null)} />
      )}
    </div>
  );
}
