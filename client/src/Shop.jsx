import { sfx, getBattleBgm, setBattleBgm, setOwnedBgm, previewBgm, stopPreview } from './audio';
import { useCallback, useEffect, useState } from 'react';
import { callApi } from './api';
import { Stage, Box, BackHome, NavHot, fs, cq } from './Stage';
import { Avatar, Sand, Dot, RarityTag } from './Parts';
import ItemPreview from './ItemPreview';
import { RARITY, RARITIES } from './icons';

const TABS = [['icon', 'アイコン', '👤', 255, 140], ['frame', 'アイコン\nフレーム', '▣', 405, 140], ['card', 'バナー', '🖼', 555, 140], ['character', 'キャラ', '🧍', 705, 140], ['bgm', '戦闘\nBGM', '♪', 855, 140]];
const gold = 'linear-gradient(180deg,#f1dc9a,#c9a24a)';
const navy = 'linear-gradient(180deg,#13264d,#0a1630)';

export default function Shop({ user, profile, call, go, summary }) {
  const [tab, setTab] = useState('icon');
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');
  const [sort, setSort] = useState('default'); // default=標準 / cheap=安い順 / rarity=レア度順 / new=新しい順

  const [bgmSel, setBgmSel] = useState(getBattleBgm()); // 選んでいる戦闘BGM（端末に保存）
  const load = useCallback(async () => {
    try {
      const d = await callApi(user, '/shop'); setData(d);
      const m = await callApi(user, '/bgm/mine'); setOwnedBgm(m.tracks); setBgmSel(getBattleBgm());
    } catch (e) { setMsg(e.message); }
  }, [user]);
  useEffect(() => () => stopPreview(), []);
  useEffect(() => { load(); }, [load, profile?.sand]);

  const act = async (fn) => { setMsg(''); try { await fn(); await load(); } catch (e) { setMsg(e.message); } };
  const buy = (i) => { if (window.confirm(`「${i.name}」を 魔法の砂 ${i.price} で購入しますか？`)) act(async () => { const r = await call('/shop/buy', { method: 'POST', body: { itemId: i.id } }); sfx('coin'); return r; }); };
  const equip = (slot, id) => {
    if (slot === 'bgm') { const k = id === 'none' ? 'random' : `bgm_${id}`; setBattleBgm(k); setBgmSel(k); return; } // 戦闘BGMは端末ごとの設定
    return act(() => call('/equip', { method: 'POST', body: { slot, itemId: id } }));
  };

  const rk = (i) => RARITIES.indexOf(i.rarity);
  const SORTERS = {
    default: null,
    cheap: (a, b) => a.price - b.price || rk(b) - rk(a) || b.createdAt - a.createdAt,
    rarity: (a, b) => rk(b) - rk(a) || a.price - b.price || b.createdAt - a.createdAt, // レア度が高い順
    new: (a, b) => b.createdAt - a.createdAt || a.price - b.price,
  };
  const items = (data?.items || []).filter((i) => i.type === tab).sort(SORTERS[sort] || (() => 0));
  const equipped = tab === 'bgm' ? (bgmSel.startsWith('bgm_') ? bgmSel.slice(4) : 'none') : data?.equipped?.[tab];
  const sand = profile?.sand ?? 0;

  const Action = ({ i, small }) => {
    const on = equipped === i.id;
    const base = 'w-full rounded-md font-bold';
    const st = { fontSize: fs(small ? 22 : 21), padding: '0.5cqw 0' };
    if (on) return <div className={`${base} text-center text-black`} style={{ ...st, background: gold }}>装備中</div>;
    if (i.owned) return <button onClick={() => equip(tab, i.id)} className={`${base} bg-sky-600 text-white`} style={st}>装備する</button>;
    return (
      <button onClick={() => buy(i)} disabled={sand < i.price} className={`${base} bg-[#0b1a36] border border-[#c9a24a] text-amber-200 disabled:opacity-40`} style={st}>
        <Sand n={i.price} size={cq(20)} />
      </button>
    );
  };

  return (
    <Stage bg="/ui/shop.jpg">
      <BackHome go={go} />
      <Box x={430} y={26} w={470} h={64} className="flex items-center justify-end pr-2 rounded-lg" style={{ fontSize: fs(34), color: '#ffe9a8', textShadow: '0 2px 6px #000' }}>
        <Sand n={sand} size={cq(50)} />
      </Box>

      {/* 左のタブ */}
      {TABS.map(([k, label, ic, y, h]) => (
        <Box key={k} x={6} y={y} w={158} h={h}>
          <button onClick={() => setTab(k)} className="w-full h-full rounded-lg flex flex-col items-center justify-center font-bold"
            style={{ background: tab === k ? gold : navy, color: tab === k ? '#2b1d05' : '#e5e7eb', border: '2px solid #c9a24a', fontSize: fs(22), whiteSpace: 'pre-line', lineHeight: 1.15 }}>
            <span style={{ fontSize: fs(48) }}>{ic}</span>{label}
          </button>
        </Box>
      ))}

      {/* 商品パネル */}
      <Box x={187} y={278} w={821} h={1057} className="rounded-xl overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(180deg,#0f2147,#0a1530)', border: '3px solid #c9a24a' }}>
        <div className="flex items-center justify-between px-[2.5cqw] py-[1.2cqw] text-[#f3e3b0] font-bold border-b border-[#c9a24a]/50" style={{ fontSize: fs(30) }}>
          <span>{TABS.find((t) => t[0] === tab)[1].replace('\n', '')}</span>
          <span className="flex items-center gap-[1.5cqw]">
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="並び替え" className="rounded-md bg-[#0b1a36] border border-[#c9a24a] text-[#f3e3b0]" style={{ fontSize: fs(20), padding: '0.3cqw 1cqw' }}>
              <option value="default">標準</option>
              <option value="cheap">安い順</option>
              <option value="rarity">レア度順</option>
              <option value="new">新しい順</option>
            </select>
            <span style={{ fontSize: fs(20), color: '#9fb2d4' }}>{items.length}点</span>
          </span>
        </div>
        {msg && <p className="px-[2.5cqw] py-[0.8cqw] text-red-300" style={{ fontSize: fs(20) }}>{msg}</p>}
        <div className="flex-1 overflow-y-auto p-[1.6cqw]">
          {(
            <div className="grid grid-cols-4 gap-[1.2cqw]">
              {(tab === 'frame' || tab === 'card' || tab === 'bgm') && equipped !== 'none' && (
                <button onClick={() => equip(tab, 'none')} className="rounded-lg bg-slate-700 text-white font-bold p-[1cqw]" style={{ fontSize: fs(20) }}>{tab === 'card' ? '標準に戻す' : tab === 'bgm' ? 'ランダムに戻す' : 'フレームを外す'}</button>
              )}
              {items.map((i) => (
                <div key={i.id} className="rounded-lg bg-[#e9e4d6] p-[1cqw] flex flex-col items-center" style={{ border: `3px solid ${RARITY[i.rarity].color}` }}>
                  <RarityTag rarity={i.rarity} className="self-start" />
                  <div className="my-[0.8cqw] flex flex-col items-center gap-[0.6cqw]"><ItemPreview item={i} size="11cqw" />
                    {i.type === 'bgm' && <button onClick={() => previewBgm(`bgm_${i.id}`, 15000)} className="rounded bg-slate-700 text-white px-[1.4cqw]" style={{ fontSize: fs(18) }}>▶ 試聴</button>}
                  </div>
                  <div className="w-full text-center bg-[#0b1a36] text-white rounded truncate px-1 mb-[0.8cqw]" style={{ fontSize: fs(19), padding: '0.4cqw 0' }}>{i.name}</div>
                  <Action i={i} />
                </div>
              ))}
            </div>
          )}
          {items.length === 0 && <p className="text-center text-slate-400 py-[6cqw]" style={{ fontSize: fs(24) }}>商品はまだありません</p>}
        </div>
      </Box>

      <NavHot go={go} active="shop" summary={summary} />
    </Stage>
  );
}
