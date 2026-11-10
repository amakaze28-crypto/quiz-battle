import { useEffect, useState } from 'react';
import { adminApi, callApi } from './api';
import { Avatar, RarityTag } from './Parts';
import { TYPE_LABEL, itemSrc, charSrc } from './icons';
import PlayerCard, { LAYOUTS, defaultLayout, layoutOf, profileKeyOf, LAYOUT_FIELDS } from './PlayerCard';
import { loadCardLayouts, useCardLayouts, useFrameFits, DEFAULT_FIT } from './cardLayout';

const btn = 'px-3 py-1.5 rounded-lg text-sm';
const SAMPLE = { displayName: 'サンプル', iconId: 'default', frameId: 'none', charId: 'char-m', badgeId: 'auto', rank: { key: 'rookie', label: 'ルーキー5', sub: '5' } };

// プレビュー用の見本プロフィール（自分のアイコン・キャラ・ランクを使う）
export function useSampleProfile(user) {
  const [me, setMe] = useState(SAMPLE);
  useEffect(() => {
    callApi(user, '/me').then((d) => d.profile && setMe({ ...SAMPLE, displayName: d.profile.displayName || 'サンプル', iconId: d.profile.iconId, charId: d.profile.charId, rank: d.profile.rank })).catch(() => {});
  }, [user]);
  return me;
}

const Row = ({ label, children }) => (
  <label className="flex items-center gap-2 text-sm"><span className="w-40 shrink-0 text-slate-300">{label}</span>{children}</label>
);
const numBox = 'w-20 rounded bg-[#0e1013] border border-white/10 px-1.5 py-1 text-right';

// ---- バナー（カード台紙）の配置 ----
export function LayoutSliders({ L, setL }) {
  const set = (k, v) => setL({ ...L, [k]: Number(v) });
  return (
    <div className="space-y-1.5">
      {LAYOUT_FIELDS.map(([k, label]) => (
        <Row key={k} label={label}>
          <input type="range" min={0} max={k === 'd' ? 0.6 : 1} step={0.002} value={L[k]} onChange={(e) => set(k, e.target.value)} className="flex-1 min-w-0" />
          <input type="number" step={0.005} value={Math.round(L[k] * 1000) / 1000} onChange={(e) => set(k, e.target.value)} className={numBox} />
        </Row>
      ))}
    </div>
  );
}

const PRESETS = [['A', 'タイプA（灰・縞など）'], ['B', 'タイプB（水玉）'], ['C', 'タイプC（小さめ板）'], ['D', 'タイプD（夜空など）'], ['E', 'タイプE（Dの上段）']];

// 追加前の画像に対して、実際のカードで位置を調整する（追加フォーム用）
export function DraftCardEditor({ user, image, L, setL }) {
  const me = useSampleProfile(user);
  return (
    <div className="rounded-xl bg-[#0e1013] p-3 mt-2">
      <p className="text-sm font-bold mb-2">バナーの位置を調整（このまま追加できます）</p>
      <div className="mx-auto" style={{ maxWidth: 220 }}><PlayerCard c={{ ...me, cardSrc: image }} layout={L} /></div>
      <label className="flex items-center gap-2 text-sm mt-2">
        <span className="text-slate-300 shrink-0">ベースの配置</span>
        <select onChange={(e) => e.target.value && setL({ ...LAYOUTS[e.target.value] })} defaultValue="" className="flex-1 rounded bg-[#171a20] border border-white/10 px-2 py-1">
          <option value="">（選んで下の調整の出発点にする）</option>
          {PRESETS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
      <div className="mt-2"><LayoutSliders L={L} setL={setL} /></div>
    </div>
  );
}

// ---- アイコンフレームの位置・大きさ ----
export function FitSliders({ F, setF }) {
  const set = (k, v) => setF({ ...F, [k]: Number(v) });
  return (
    <div className="space-y-1.5">
      <Row label="大きさ（アイコン比）"><input type="range" min={0.8} max={1.8} step={0.005} value={F.s} onChange={(e) => set('s', e.target.value)} className="flex-1 min-w-0" /><input type="number" step={0.01} value={Math.round(F.s * 1000) / 1000} onChange={(e) => set('s', e.target.value)} className={numBox} /></Row>
      <Row label="横にずらす"><input type="range" min={-0.3} max={0.3} step={0.002} value={F.dx} onChange={(e) => set('dx', e.target.value)} className="flex-1 min-w-0" /><input type="number" step={0.005} value={Math.round(F.dx * 1000) / 1000} onChange={(e) => set('dx', e.target.value)} className={numBox} /></Row>
      <Row label="縦にずらす"><input type="range" min={-0.3} max={0.3} step={0.002} value={F.dy} onChange={(e) => set('dy', e.target.value)} className="flex-1 min-w-0" /><input type="number" step={0.005} value={Math.round(F.dy * 1000) / 1000} onChange={(e) => set('dy', e.target.value)} className={numBox} /></Row>
    </div>
  );
}

export function DraftFrameEditor({ user, image, F, setF }) {
  const me = useSampleProfile(user);
  return (
    <div className="rounded-xl bg-[#0e1013] p-3 mt-2">
      <p className="text-sm font-bold mb-2">フレームの位置・大きさを調整（このまま追加できます）</p>
      <div className="mx-auto w-40 my-3"><Avatar iconId={me.iconId || 'default'} frameSrc={image} fit={F} size={0} /></div>
      <FitSliders F={F} setF={setF} />
    </div>
  );
}

// ---- 一覧のタップで開く確認・調整 ----
export function ItemViewModal({ user, item, items, startEdit = false, onClose }) {
  const me = useSampleProfile(user);
  const [edit, setEdit] = useState(startEdit);
  const overrides = useCardLayouts();
  const same = (items || []).filter((i) => i.type === 'card' && profileKeyOf(i.id) === profileKeyOf(item.id));
  const adjustable = item.type === 'card' || item.type === 'frame';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 grid place-items-center p-3 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[#1b1f27] p-4 my-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold flex items-center gap-2 min-w-0"><span className="truncate">{item.name}</span><RarityTag rarity={item.rarity} /><span className="text-xs text-slate-400 shrink-0">{TYPE_LABEL[item.type]}</span></h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">✕</button>
        </div>
        {item.type === 'card' && !edit && (
          <div className="mx-auto" style={{ maxWidth: 300 }}><PlayerCard c={{ ...me, cardId: item.id }} /></div>
        )}
        {item.type === 'card' && edit && <LayoutEditor user={user} item={item} me={me} same={same} onBack={() => setEdit(false)} />}
        {item.type === 'frame' && !edit && <div className="mx-auto w-40 py-4"><Avatar iconId={me.iconId || 'default'} frameId={item.id} size={0} /></div>}
        {item.type === 'frame' && edit && <FrameFitEditor user={user} item={item} me={me} onBack={() => setEdit(false)} />}
        {item.type === 'banner' && <img src={itemSrc(item.id)} alt="" className="w-full rounded object-cover" style={{ aspectRatio: '4 / 1' }} />}
        {item.type === 'icon' && <div className="mx-auto w-32 py-3"><Avatar iconId={item.id} size={0} /></div>}
        {item.type === 'character' && <img src={charSrc(item.id)} alt="" className="mx-auto max-h-96 object-contain" />}
        {adjustable && !edit && (
          <>
            {item.type === 'card' && <p className="text-xs text-slate-400 mt-2 text-center">実際のプレイヤーカードでの見え方です（あなたのアイコン・キャラを使用）。{overrides[item.id] ? '／ 調整済みの配置' : ''}</p>}
            <button onClick={() => setEdit(true)} className={`${btn} bg-sky-600 font-bold w-full mt-3`}>{item.type === 'card' ? 'アイコンなどの位置を調整する' : 'フレームの位置・大きさを調整する'}</button>
          </>
        )}
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
      <div className="mt-3"><LayoutSliders L={L} setL={setL} /></div>
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

function FrameFitEditor({ user, item, me, onBack }) {
  const fits = useFrameFits();
  const [F, setF] = useState({ ...DEFAULT_FIT, ...(fits[item.id] || {}) });
  const [msg, setMsg] = useState(null);
  const save = async () => {
    try { await adminApi(user, '/frame-fits', { method: 'PUT', body: { ids: [item.id], fit: F } }); await loadCardLayouts(true); setMsg({ ok: true, text: '保存しました' }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const reset = async () => {
    try { await adminApi(user, `/frame-fits/${item.id}`, { method: 'DELETE' }); await loadCardLayouts(true); setF({ ...DEFAULT_FIT }); setMsg({ ok: true, text: '標準に戻しました' }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  return (
    <div>
      <div className="mx-auto w-44 my-3"><Avatar iconId={me.iconId || 'default'} frameId={item.id} fit={F} size={0} /></div>
      <FitSliders F={F} setF={setF} />
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={save} className={`${btn} bg-emerald-600 font-bold flex-1`}>保存</button>
        <button onClick={reset} className={`${btn} bg-slate-700`}>標準に戻す</button>
        <button onClick={onBack} className={`${btn} bg-[#0e1013]`}>戻る</button>
      </div>
    </div>
  );
}
