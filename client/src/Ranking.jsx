import { useEffect, useState } from 'react';
import { callApi } from './api';
import { Avatar } from './Parts';
import RankBadge from './RankBadge';
import { Panel, Title } from './Ui';

const score = (x) => (x.isMaster ? `${x.mr} MR` : `${x.pt} pt`);

function Row({ place, name, iconId, frameId, rank, right, me }) {
  const medal = place === 1 ? 'text-amber-300' : place === 2 ? 'text-slate-200' : place === 3 ? 'text-orange-400' : 'text-slate-400';
  return (
    <li className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${me ? 'bg-amber-400/20 ring-1 ring-amber-400' : 'bg-black/25'}`}>
      <span className={`w-9 text-center font-extrabold tabular-nums ${medal}`}>{place}</span>
      <Avatar iconId={iconId} frameId={frameId} size={36} />
      <div className="min-w-0 flex-1">
        <p className="font-bold truncate">{name}</p>
        <p className="flex items-center gap-1 text-xs text-slate-300"><RankBadge rank={rank} size={18} showSub={false} />{rank.label}</p>
      </div>
      <span className="font-extrabold tabular-nums text-amber-200">{right}</span>
    </li>
  );
}

// ランキング: 全体（マスター以上の上位100人）と、フレンド（フレンドのランク・Pt/MR）
export default function Ranking({ user }) {
  const [tab, setTab] = useState('top');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { callApi(user, '/ranking').then(setData).catch((e) => setErr(e.message)); }, [user]);
  const me = data?.me;
  return (
    <div className="ui-text">
      <Title>ランキング</Title>
      {me && (
        <Panel className="p-3 mb-3 flex items-center gap-3">
          <RankBadge rank={me.rank} size={56} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-300">あなたのランク</p>
            <p className="text-xl font-extrabold">{me.rank.label}</p>
            <p className="text-sm text-amber-200 font-bold">{score(me)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-300">全体順位</p>
            <p className="text-xl font-extrabold">{me.place ? `${me.place}位` : '圏外'}</p>
          </div>
        </Panel>
      )}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[['top', '全体 TOP100'], ['friends', 'フレンド']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg py-2 font-bold border-2 ${tab === k ? 'bg-gradient-to-b from-[#f1dc9a] to-[#c9a24a] text-[#2b1d05] border-[#c9a24a]' : 'bg-[#0f1c38] text-slate-200 border-[#c9a24a]/50'}`}>{label}</button>
        ))}
      </div>
      {err && <p className="text-red-300 text-sm mb-2">{err}</p>}
      {!data && !err && <p className="text-center text-slate-300 py-6">読み込み中…</p>}
      {data && tab === 'top' && (
        <>
          <p className="text-xs text-slate-300 mb-2">マスター以上のプレイヤーのうち、MR上位100人です。</p>
          <ul className="space-y-1.5">
            {data.top.map((x) => <Row key={x.uid} place={x.place} name={x.name} iconId={x.iconId} frameId={x.frameId} rank={x.rank} right={`${x.mr} MR`} me={x.me} />)}
            {data.top.length === 0 && <li className="text-center text-slate-400 py-8">まだマスターに到達したプレイヤーがいません</li>}
          </ul>
        </>
      )}
      {data && tab === 'friends' && (
        <ul className="space-y-1.5">
          {data.friends.map((f) => <Row key={f.uid} place={f.place} name={f.displayName} iconId={f.iconId} frameId={f.frameId} rank={f.rank} right={score(f)} me={f.me} />)}
          {data.friends.length <= 1 && <li className="text-center text-slate-400 py-6 text-sm">フレンドを追加すると、ここでランクとポイントを比べられます</li>}
        </ul>
      )}
    </div>
  );
}
