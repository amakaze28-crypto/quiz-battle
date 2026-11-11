import { useEffect, useState } from 'react';
import { callApi, SERVER_URL } from './api';
import { sfx } from './audio';
import { Stage, Box, Hot, NavHot, fs, cq } from './Stage';
import ItemPreview from './ItemPreview';
import { Coin, Sand, Dot, RarityTag } from './Parts';
import { RARITY, RARITIES, TYPE_LABEL, itemSrc, iconSrc, charSrc } from './icons';

const srcOf = (i) => (i.type === 'icon' ? iconSrc(i.id) : i.type === 'character' ? charSrc(i.id) : itemSrc(i.id));
const abs = (u) => new URL(u, window.location.href).href;
const DOVE_R = { common: 'R', uncommon: 'R', rare: 'SR', epic: 'SR', legendary: 'SSR' };
let doveLoad = null;
// 演出（dove-gacha.js）は初回だけ読み込む
const loadDove = () => {
  if (window.DoveGacha) return Promise.resolve();
  if (!doveLoad) doveLoad = new Promise((res, rej) => {
    const el = document.createElement('script'); el.src = '/dove-gacha.js?v=2.1'; el.onload = res; el.onerror = () => { doveLoad = null; rej(new Error('演出を読み込めませんでした')); };
    document.head.append(el);
  });
  return doveLoad;
};
const doveResults = (results) => results.map((r, i) => {
  if (r.kind === 'item') return { id: `${i}-${r.item.id}`, name: r.item.name, rarity: DOVE_R[r.item.rarity], image: abs(srcOf(r.item)), description: `${TYPE_LABEL[r.item.type]}　${r.duplicate ? `被り → 砂 +${r.sand}` : 'NEW!'}` };
  if (r.kind === 'set') return { id: `${i}-${r.set.id}`, name: r.set.name, rarity: 'SSR', images: r.items.map((x) => abs(srcOf(x))), description: `セット（${r.items.length}点）${r.sand ? `　被り分の砂 +${r.sand}` : ''}` };
  return { id: `${i}-sand`, name: `魔法の砂 +${r.sand}`, rarity: DOVE_R[r.rarity], image: abs('/ui/sand.png'), description: '' };
});
const rarityOfResult = (r) => (r.kind === 'item' ? r.item.rarity : r.kind === 'set' ? 'legendary' : r.rarity);

const panel = { background: 'linear-gradient(180deg,rgba(15,33,71,.92),rgba(10,21,48,.92))', border: '3px solid #c9a24a' };

function ResultCard({ r, i }) {
  const rar = rarityOfResult(r);
  const color = RARITY[rar].color;
  const strong = rar === 'legendary' || rar === 'epic';
  return (
    <div className={`${strong ? 'glow-card' : 'pop-in'} rounded-xl p-2 flex flex-col items-center text-center bg-[#0f1c38]`}
      style={{ '--c': color, border: `3px solid ${color}`, animationDelay: `${i * 0.12}s` }}>
      {r.kind === 'set' ? (
        <>
          <RarityTag rarity="legendary" className="self-start" />
          <div className="my-2 w-full grid grid-cols-2 gap-1 justify-items-center">
            {r.items.slice(0, 4).map((it) => <ItemPreview key={it.id} item={it} size="30px" />)}
          </div>
          <p className="text-xs font-bold text-white truncate w-full">{r.set.name}</p>
          <p className="text-[10px] text-slate-300">セット（{r.items.length}点）</p>
          {r.sand ? <p className="mt-1 text-[11px] text-amber-300 font-bold">被り分 → 砂 +{r.sand}</p> : <p className="mt-1 text-[11px] text-emerald-300 font-extrabold">NEW!</p>}
        </>
      ) : r.kind === 'item' ? (
        <>
          <RarityTag rarity={r.item.rarity} className="self-start" />
          <div className="my-2 w-full flex justify-center"><ItemPreview item={r.item} size="64px" /></div>
          <p className="text-xs font-bold text-white truncate w-full">{r.item.name}</p>
          <p className="text-[10px] text-slate-300">{TYPE_LABEL[r.item.type]}</p>
          {r.duplicate
            ? <p className="mt-1 text-[11px] text-amber-300 font-bold">被り → 砂 +{r.sand}</p>
            : <p className="mt-1 text-[11px] text-emerald-300 font-extrabold">NEW!</p>}
        </>
      ) : (
        <>
          <RarityTag rarity={r.rarity} className="self-start" />
          <img src="/ui/sand.png" alt="" className="my-2 w-16 h-16 object-contain" />
          <p className="text-xs font-bold text-white">魔法の砂</p>
          <p className="mt-1 text-sm text-amber-300 font-extrabold">+{r.sand}</p>
        </>
      )}
    </div>
  );
}

function Results({ data, onClose }) {
  const [step, setStep] = useState(0);
  useEffect(() => { const t = setTimeout(() => setStep(1), data.results.length * 120 + 500); return () => clearTimeout(t); }, [data]);
  const best = data.results.reduce((m, r) => Math.max(m, RARITIES.indexOf(rarityOfResult(r))), 0);
  return (
    <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto p-4" onClick={step ? onClose : undefined}>
      <div className="max-w-md mx-auto text-white py-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-center text-xl font-extrabold mb-1" style={{ color: RARITY[RARITIES[best]].color }}>ガチャ結果</h2>
        <div className={`grid gap-2 my-4 ${data.results.length > 1 ? 'grid-cols-3' : 'grid-cols-1 max-w-[180px] mx-auto'}`}>
          {data.results.map((r, i) => <ResultCard key={i} r={r} i={i} />)}
        </div>
        <p className="text-center text-sm text-slate-200">獲得した魔法の砂 <Sand n={data.sandGain} className="text-amber-300" /></p>
        <button onClick={onClose} disabled={!step} className="mt-5 w-full py-3 rounded-xl bg-emerald-500 font-bold disabled:opacity-40">OK</button>
      </div>
    </div>
  );
}

function RatesModal({ info, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 overflow-y-auto p-4" onClick={onClose}>
      <div className="max-w-md mx-auto my-4 rounded-2xl bg-[#14213d] border border-[#c9a24a]/70 p-5 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-lg">提供割合</h2><button onClick={onClose} className="text-slate-400 text-xl">✕</button></div>
        <p className="text-sm mb-1">1回 <Coin n={info.cost} className="text-amber-300" />　／　10回 <Coin n={info.cost * 10} className="text-amber-300" /></p>
        <p className="text-sm mb-3">アイテム {info.rates.item}%　／　魔法の砂 {info.rates.sand}%</p>
        <table className="w-full text-sm mb-4">
          <thead><tr className="text-slate-400 text-left"><th>レア度</th><th>アイテム</th><th>砂(確率)</th><th>砂の量</th><th>被り時</th></tr></thead>
          <tbody>
            {RARITIES.map((x) => (
              <tr key={x} className="border-t border-white/10">
                <td className="py-1.5 font-bold" style={{ color: RARITY[x].color }}>{RARITY[x].label}</td>
                <td>{info.rates.itemRarity[x]}%</td><td>{info.rates.sandRarity[x]}%</td><td>{info.sandAmounts[x]}</td><td>+{info.dupSand[x]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-400 mb-2">※ 出るアイテムがないレア度は除いて按分されています。被ったアイテムは魔法の砂に変わります。</p>
        <h3 className="font-bold mb-2">排出アイテム（{info.pool.length}）</h3>
        <ul className="space-y-1.5">
          {info.pool.map((i) => (
            <li key={i.id} className="flex items-center gap-2 text-sm">
              <RarityTag rarity={i.rarity} /><span className="truncate flex-1">{i.name}</span><span className="text-xs text-slate-400">{i.type === 'set' ? `セット${i.items.length}点` : TYPE_LABEL[i.type]}</span>
              {i.owned && <span className="text-xs text-emerald-400">所持</span>}
            </li>
          ))}
          {info.pool.length === 0 && <li className="text-slate-400 text-sm">まだ排出アイテムはありません（砂のみ）</li>}
        </ul>
      </div>
    </div>
  );
}

export default function Gacha({ user, g, call, go, summary, onLogout }) {
  const { profile } = g;
  const [list, setList] = useState([]);
  const [gid, setGid] = useState('normal');
  const [info, setInfo] = useState(null);
  const [rates, setRates] = useState(false);
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { callApi(user, '/gacha/list').then((d) => { setList(d.gachas); if (!d.gachas.some((x) => x.id === gid)) setGid('normal'); }).catch((e) => setMsg(e.message)); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setInfo(null); callApi(user, `/gacha/info?id=${encodeURIComponent(gid)}`).then(setInfo).catch((e) => setMsg(e.message)); }, [user, gid, result]);

  const pull = async (count) => {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      const r = await call('/gacha/pull', { method: 'POST', body: { count, id: gid } });
      // 抽選・支払いはサーバーで確定済み。ここからは演出だけ
      try {
        await loadDove();
        await window.DoveGacha.play({ results: doveResults(r.results), sound: true });
      } catch (e) { console.error(e); }
      setResult(r);
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const cur = list.find((x) => x.id === gid);
  const cost = info?.cost ?? 0;
  const coins = profile?.coins ?? 0;
  const Btn = ({ x, count, label }) => (
    <Box x={x} y={880} w={430} h={230}>
      <button onClick={() => pull(count)} disabled={!info || busy || coins < cost * count}
        className="w-full h-full rounded-2xl flex flex-col items-center justify-center text-white disabled:opacity-45"
        style={{ background: 'linear-gradient(180deg,#1b3b78,#0e2147)', border: '4px solid #e0b64f', boxShadow: '0 0 28px rgba(255,214,120,.35)' }}>
        <span style={{ fontSize: fs(52), fontWeight: 900, color: '#fff4d2', textShadow: '0 2px 6px #000' }}>{label}</span>
        <span className="mt-[1.5cqw]"><Coin n={cost * count} size={cq(38)} className="text-amber-200" /></span>
      </button>
    </Box>
  );
  const until = cur?.kind === 'limited' && cur.endAt ? `〜 ${new Date(cur.endAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} まで` : '';

  return (
    <>
      <Stage bg="/ui/friends2.jpg">
        {/* ガチャ画面は、コインと砂の所持数だけを表示 */}
        {profile && (
          <>
            <Box x={110} y={196} w={390} h={72} className="flex items-center justify-center rounded-full" style={{ fontSize: fs(38), fontWeight: 800, color: '#ffe9a8', background: 'linear-gradient(180deg,#0e2150,#081230)', border: `${cq(3)} solid #c9a24a`, boxShadow: 'inset 0 2px 6px rgba(0,0,0,.6), 0 3px 8px rgba(0,0,0,.4)' }}><Coin n={profile.coins} size={cq(50)} /></Box>
            <Box x={524} y={196} w={390} h={72} className="flex items-center justify-center rounded-full" style={{ fontSize: fs(38), fontWeight: 800, color: '#ffe9a8', background: 'linear-gradient(180deg,#0e2150,#081230)', border: `${cq(3)} solid #c9a24a`, boxShadow: 'inset 0 2px 6px rgba(0,0,0,.6), 0 3px 8px rgba(0,0,0,.4)' }}><Sand n={profile.sand} size={cq(54)} /></Box>
          </>
        )}

        {list.length > 1 && (
          <Box x={70} y={322} w={884} h={56} className="flex gap-[1.2cqw] overflow-x-auto no-scrollbar">
            {list.map((x) => (
              <button key={x.id} onClick={() => setGid(x.id)} className="shrink-0 rounded-xl px-[2.4cqw] whitespace-nowrap"
                style={{ fontSize: fs(27), fontWeight: 800, color: x.id === gid ? '#2a1a00' : '#fff4d2', background: x.id === gid ? 'linear-gradient(180deg,#ffe9a8,#e0b64f)' : 'rgba(10,21,48,.85)', border: '3px solid #c9a24a', maxWidth: '60cqw', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {x.kind === 'limited' ? '⏳ ' : ''}{x.name}
              </button>
            ))}
          </Box>
        )}

        <Box x={110} y={382} w={804} h={410} className="rounded-2xl overflow-hidden relative flex flex-col items-center justify-center text-center" style={panel}>
          {cur?.hasBanner ? (
            <>
              {/* 画像が読み込まれるまでは、灰色の地に「読み込み中...」を出す（画像が来ると上に重なって隠れる） */}
              <div className="absolute inset-0 grid place-items-center" style={{ background: '#6b7280', color: '#f3f4f6', fontSize: fs(34), fontWeight: 700 }}>読み込み中...</div>
              <img key={cur.banner} src={`${SERVER_URL}${cur.banner}`} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
            </>
          ) : (
            <>
              <p style={{ fontSize: fs(54), fontWeight: 900, color: '#fff4d2', textShadow: '0 3px 8px #000', padding: '0 3cqw' }}>{cur?.name || '魔法のガチャ'}</p>
              <div className="relative my-[2cqw]" style={{ width: '18cqw', height: '18cqw' }}>
                <div className="absolute inset-0 rounded-full" style={{ border: '3px dashed #e0b64f', animation: 'spin 14s linear infinite' }} />
                <img src="/ui/sand.png" alt="" className="absolute inset-[14%] w-[72%] h-[72%] object-contain" draggable={false} />
              </div>
              <p style={{ fontSize: fs(24), color: '#c9d6f2', paddingBottom: cq(34) }}>キャラ・アイコン・フレーム・バナー・魔法の砂が手に入る！</p>
            </>
          )}
          {cur?.kind === 'limited' && <span className="absolute left-[2cqw] top-[2cqw] rounded-full px-[2.5cqw] py-[0.6cqw] font-extrabold bg-rose-600 text-white" style={{ fontSize: fs(24) }}>期間限定</span>}
          {until && <span className="absolute left-[2cqw] bottom-[2cqw] rounded-lg px-[2cqw] py-[0.5cqw] bg-black/65 text-amber-200 font-bold" style={{ fontSize: fs(23) }}>{until}</span>}
          <button onClick={() => setRates(true)} disabled={!info} className="absolute right-[2cqw] bottom-[2cqw] rounded-lg px-[2cqw] py-[0.5cqw] bg-black/65 underline text-sky-300" style={{ fontSize: fs(23) }}>提供割合を見る</button>
        </Box>
        {cur?.hasBanner && <Box x={110} y={800} w={804} h={60} className="text-center" style={{ fontSize: fs(34), fontWeight: 900, color: '#fff4d2', textShadow: '0 2px 6px #000' }}>{cur.name}</Box>}

        <Btn x={70} count={1} label="1回引く" />
        <Btn x={524} count={10} label="10回引く" />
        {msg && <Box x={70} y={1125} w={884} h={50} className="text-center" style={{ fontSize: fs(24), color: '#fca5a5', textShadow: '0 1px 4px #000' }}>{msg}</Box>}
        {info && coins < cost && <Box x={70} y={1170} w={884} h={46} className="text-center rounded-lg bg-black/55 grid place-items-center" style={{ fontSize: fs(22), color: '#fde68a' }}>コインはミッションやメールで手に入ります</Box>}

        <NavHot go={go} active="gacha" summary={summary} />
      </Stage>
      {result && <Results data={result} onClose={() => setResult(null)} />}
      {rates && info && <RatesModal info={info} onClose={() => setRates(false)} />}
    </>
  );
}
