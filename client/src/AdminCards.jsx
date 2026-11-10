import { useEffect, useState } from 'react';
import { adminApi, callApi } from './api';
import { Avatar, RarityTag } from './Parts';
import { TYPE_LABEL, itemSrc, charSrc } from './icons';
import PlayerCard, { defaultLayout, layoutOf, profileKeyOf, LAYOUT_FIELDS } from './PlayerCard';
import { loadCardLayouts, useCardLayouts } from './cardLayout';

const btn = 'px-3 py-1.5 rounded-lg text-sm';
const SAMPLE = { displayName: 'サンプル', iconId: 'default', frameId: 'none', charId: 'char-m', badgeId: 'auto', rank: { key: 'rookie', label: 'ルーキー5', sub: '5' } };

// アイテムをタップした時の見た目の確認（バナー＝カードフレームは、実際のプレイヤーカードで表示）
export function ItemViewModal({ user, item, items, onClose }) {
  const [me, setMe] = useState(SAMPLE);
  const [edit, setEdit] = useState(false);
  const overrides = useCardLayouts();
  useEffect(() => {
    callApi(user, '/me').then((d) => d.profile && setMe({ ...SAMPLE, displayName: d.profile.displayName || 'サンプル', iconId: d.profile.iconId, frameId: d.profile.frameId, charId: d.profile.charId, rank: d.profile.rank })).catch(() => {});
  }, [user]);
  const same = (items || []).filter((i) => i.type === 'card' && profileKeyOf(i.id) === profileKeyOf(item.id));

  return (
    <div className="fixed inset-0 z-50 bg-black/75 grid place-items-center p-3 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[#1b1f27] p-4 my-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold flex items-center gap-2 min-w-0"><span className="truncate">{item.name}</span><RarityTag rarity={item.rarity} /><span className="text-xs text-slate-400 shrink-0">{TYPE_LABEL[item.type]}</span></h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">✕</button>
        </div>
        {item.type === 'card' && !edit && (
          <>
            <div className="mx-auto" style={{ maxWidth: 300 }}><PlayerCard c={{ ...me, cardId: item.id }} /></div>
            <p className="text-xs text-slate-400 mt-2 text-center">実際のプレイヤーカードでの見え方です（あなたのアイコン・キャラを使用）。{overrides[item.id] ? '／ 調整済みの配置' : ''}</p>
            <button onClick={() => setEdit(true)} className={`${btn} bg-sky-600 font-bold w-full mt-3`}>アイコンなどの位置を調整する</button>
          </>
        )}
        {item.type === 'card' && edit && <LayoutEditor user={user} item={item} me={me} same={same} onBack={() => setEdit(false)} />}
        {item.type === 'frame' && <div className="mx-auto w-40 py-4"><Avatar iconId={me.iconId || 'default'} frameId={item.id} size={0} /></div>}
        {item.type === 'banner' && <img src={itemSrc(item.id)} alt="" className="w-full rounded object-cover" style={{ aspectRatio: '4 / 1' }} />}
        {item.type === 'icon' && <div className="mx-auto w-32 py-3"><Avatar iconId={item.id} size={0} /></div>}
        {item.type === 'character' && <img src={charSrc(item.id)} alt="" className="mx-auto max-h-96 object-contain" />}
      </div>
    </div>
  );
}

// アイコン・名前・ランク・バッジ・キャラの位置を、プレビューを見ながら調整する
function LayoutEditor({ user, item, me, same, onBack }) {
  const overrides = useCardLayouts();
  const [L, setL] = useState(() => layoutOf(item.id, overrides));
  const [scope, setScope] = useState('one');
  const [msg, setMsg] = useState(null);
  const ids = scope === 'one' ? [item.id] : same.map((i) => i.id);
  const set = (k, v) => setL((x) => ({ ...x, [k]: Number(v) }));

  const save = async () => {
    try { await adminApi(user, '/card-layouts', { method: 'PUT', body: { ids, layout: L } }); await loadCardLayouts(true); setMsg({ ok: true, text: `${ids.length}枚に保存しました` }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const reset = async () => {
    try {
      for (const id of ids) await adminApi(user, `/card-layouts/${id}`, { method: 'DELETE' });
      await loadCardLayouts(true); setL(defaultLayout(item.id)); setMsg({ ok: true, text: `${ids.length}枚を標準の配置に戻しました` });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  return (
    <div>
      <div className="mx-auto" style={{ maxWidth: 240 }}><PlayerCard c={{ ...me, cardId: item.id }} layout={L} /></div>
      <div className="mt-3 space-y-1.5">
        {LAYOUT_FIELDS.map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <span className="w-40 shrink-0 text-slate-300">{label}</span>
            <input type="range" min={0} max={k === 'd' ? 0.6 : 1} step={0.002} value={L[k]} onChange={(e) => set(k, e.target.value)} className="flex-1 min-w-0" />
            <input type="number" step={0.005} value={Math.round(L[k] * 1000) / 1000} onChange={(e) => set(k, e.target.value)} className="w-20 rounded bg-[#0e1013] border border-white/10 px-1.5 py-1 text-right" />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5"><input type="radio" checked={scope === 'one'} onChange={() => setScope('one')} />この1枚だけ</label>
        <label className="flex items-center gap-1.5"><input type="radio" checked={scope === 'group'} onChange={() => setScope('group')} />同じ台紙タイプ全部（{same.length}枚）</label>
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={save} className={`${btn} bg-emerald-600 font-bold flex-1`}>保存</button>
        <button onClick={reset} className={`${btn} bg-slate-700`}>標準に戻す</button>
        <button onClick={onBack} className={`${btn} bg-[#0e1013]`}>戻る</button>
      </div>
    </div>
  );
}
