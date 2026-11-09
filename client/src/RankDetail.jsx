import { useEffect, useRef, useState } from 'react';
import { callApi } from './api';
import { Panel, Btn } from './Ui';

// ランクの詳細（各ランクが何ポイントから何ポイントまでか）
export default function RankDetail({ user, profile, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { callApi(user, '/ranks').then(setData).catch((e) => setErr(e.message)); }, [user]);
  const scroller = useRef(null);
  // 上ほど高ランク。最初は一番下（最低ランク）を見せて、上にスクロールして上位ランクを見る
  useEffect(() => { if (data && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [data]);
  const cur = profile?.rank?.label;
  const rows = data?.rows || [];
  const groups = [];
  [...rows].reverse().forEach((r) => { const g = groups[groups.length - 1]; if (g && g.key === r.key) g.items.push(r); else groups.push({ key: r.key, items: [r] }); });
  return (
    <div className="stage-overlay z-20 flex items-center justify-center bg-black/65 p-4" onClick={onClose}>
      <Panel className="w-full max-w-sm p-4 max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-center font-bold text-lg mb-1">ランクの詳細</h2>
        <p className="text-center text-sm text-slate-300 mb-2">
          現在 <b className="text-amber-300">{cur}</b>{profile?.isMaster ? `（${profile.mr} MR）` : `（${profile?.pt} pt）`}
        </p>
        {err && <p className="text-red-300 text-sm">{err}</p>}
        <div ref={scroller} className="overflow-y-auto flex-1 space-y-1.5 pr-1 min-h-0">
          {data && (
            <>
              <div className={`rounded-lg bg-black/25 p-1.5 flex items-center gap-2 ${cur === 'エンペラー' ? 'ring-1 ring-amber-400' : ''}`}>
                <img src="/ranks/emperor.png" alt="" draggable={false} className="w-11 h-11 shrink-0 object-contain" />
                <div className="text-sm"><b>エンペラー</b><br /><span className="text-slate-200">マスターの MR 上位 {data.emperorCount} 人</span></div>
              </div>
              <div className={`rounded-lg bg-black/25 p-1.5 flex items-center gap-2 ${cur === 'マスター' ? 'ring-1 ring-amber-400' : ''}`}>
                <img src="/ranks/master.png" alt="" draggable={false} className="w-11 h-11 shrink-0 object-contain" />
                <div className="text-sm"><b>マスター</b><br /><span className="text-slate-200">{data.masterStart.toLocaleString()} pt 以上（ここからは MR で競います）</span></div>
              </div>
            </>
          )}
          {groups.map((g) => (
            <div key={g.key} className="rounded-lg bg-black/25 p-1.5 flex items-center gap-2">
              <img src={`/ranks/${g.key}.png`} alt="" draggable={false} className="w-11 h-11 shrink-0 object-contain" />
              <div className="flex-1 grid gap-0.5">
                {g.items.map((r) => (
                  <div key={r.label} className={`flex justify-between text-sm rounded px-2 py-0.5 ${r.label === cur ? 'bg-amber-400/25 ring-1 ring-amber-400 font-bold' : ''}`}>
                    <span>{r.label}</span><span className="tabular-nums text-slate-200">{r.from.toLocaleString()} 〜 {r.to.toLocaleString()} pt</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Btn variant="gold" block className="mt-3" onClick={onClose}>とじる</Btn>
      </Panel>
    </div>
  );
}
