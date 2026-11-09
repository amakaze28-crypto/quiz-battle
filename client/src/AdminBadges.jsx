import { useCallback, useEffect, useState } from 'react';
import { adminApi, SERVER_URL } from './api';
import { fileToImage, Field, Num } from './AdminExtra';

const input = 'w-full rounded-lg bg-[#0e1013] border border-white/10 px-3 py-2';
const btn = 'px-3 py-1.5 rounded-lg text-sm';
const card = 'rounded-xl bg-[#171a20] p-4';
const toLocal = (ms) => { if (!ms) return ''; const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const fromLocal = (v) => (v ? new Date(v).getTime() : 0);

const condText = (c, ranks) => {
  const n = (c.n || 0).toLocaleString();
  switch (c.type) {
    case 'wins': return `通算${n}勝`;
    case 'games': return `通算${n}マッチ`;
    case 'streak': return `${n}連勝`;
    case 'loginDays': return `累計${n}日ログイン`;
    case 'coins': return `${n}コイン所持`;
    case 'rank': return `${ranks.find((r) => r.spec === c.rank)?.label || c.rank}に到達`;
    case 'periodLogin': return `${c.from ? new Date(c.from).toLocaleString('ja-JP') : '〜'} から ${c.to ? new Date(c.to).toLocaleString('ja-JP') : '〜'} の間にログイン`;
    default: return '';
  }
};

function BadgeEditor({ user, b, types, ranks, onSaved, onCancel }) {
  const [f, setF] = useState({ ...b, imageNew: undefined });
  const [msg, setMsg] = useState(null);
  const c = f.cond;
  const setC = (patch) => setF({ ...f, cond: { ...c, ...patch } });
  const pick = async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, imageNew: await fileToImage(file, 'frame') }); };
  const save = async () => {
    const body = { name: f.name, desc: f.desc, enabled: f.enabled, cond: f.cond, ...(f.imageNew ? { image: f.imageNew } : {}) };
    try {
      if (f.id) await adminApi(user, `/badges/${f.id}`, { method: 'PUT', body });
      else await adminApi(user, '/badges', { method: 'POST', body });
      onSaved();
    } catch (e) { setMsg(e.message); }
  };
  const shown = f.imageNew || (f.id ? `${SERVER_URL}${f.src}` : '');
  const numeric = ['wins', 'games', 'streak', 'loginDays', 'coins'].includes(c.type);
  return (
    <div className={`${card} space-y-3 border border-sky-500/40`}>
      <p className="font-bold">{f.id ? 'バッジを編集' : 'バッジを追加'}</p>
      <label className="block text-sm">バッジ名<input className={input} maxLength={30} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="block text-sm">説明（任意）<input className={input} maxLength={100} value={f.desc || ''} onChange={(e) => setF({ ...f, desc: e.target.value })} /></label>
      <div className="flex items-center gap-3 flex-wrap">
        {shown ? <img src={shown} alt="" className="w-20 h-20 object-contain rounded bg-black/40" /> : <div className="w-20 h-20 rounded bg-slate-700 grid place-items-center text-xs text-slate-300">画像</div>}
        <div className="text-sm"><p className="mb-1">バッジの画像（透過PNG推奨・正方形に近いもの）</p><input type="file" accept="image/*" onChange={pick} /></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 text-sm">
        <label>獲得条件
          <select className={input} value={c.type} onChange={(e) => setF({ ...f, cond: { type: e.target.value, n: 10, rank: 'gold5', from: 0, to: 0 } })}>
            {Object.entries(types).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        {numeric && <label>{c.type === 'coins' ? 'コインの数（以上）' : '回数・日数（以上）'}<Num w="w-full" value={c.n ?? ''} onChange={(v) => setC({ n: v })} /></label>}
        {c.type === 'rank' && (
          <label>到達するランク
            <select className={input} value={c.rank} onChange={(e) => setC({ rank: e.target.value })}>
              {ranks.map((r) => <option key={r.spec} value={r.spec}>{r.label}</option>)}
            </select>
          </label>
        )}
        {c.type === 'periodLogin' && (
          <>
            <label>期間の開始<input type="datetime-local" className={input} value={toLocal(c.from)} onChange={(e) => setC({ from: fromLocal(e.target.value) })} /></label>
            <label>期間の終了<input type="datetime-local" className={input} value={toLocal(c.to)} onChange={(e) => setC({ to: fromLocal(e.target.value) })} /></label>
          </>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.enabled !== false} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />有効（オフにすると新しく獲得できなくなります。獲得済みの人は持ったままです）</label>
      {msg && <p className="text-sm text-red-400">{msg}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={!f.name.trim() || (!f.id && !f.imageNew)} className={`${btn} bg-emerald-500 font-bold disabled:opacity-40`}>保存</button>
        <button onClick={onCancel} className={`${btn} bg-slate-700`}>キャンセル</button>
      </div>
    </div>
  );
}

export function BadgesAdmin({ user }) {
  const [data, setData] = useState({ badges: [], types: {}, ranks: [] });
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => { try { setData(await adminApi(user, '/badges')); setErr(''); } catch (e) { setErr(e.message); } }, [user]);
  useEffect(() => { load(); }, [load]);
  const del = async (b) => { if (window.confirm(`バッジ「${b.name}」を削除します。獲得済みの人からも表示されなくなります。`)) { await adminApi(user, `/badges/${b.id}`, { method: 'DELETE' }); load(); } };
  const blank = { id: '', name: '', desc: '', enabled: true, cond: { type: 'wins', n: 10, rank: 'gold5', from: 0, to: 0 } };
  return (
    <div className="max-w-3xl space-y-3">
      {err && <p className="text-red-400">{err}</p>}
      <div className="flex items-center gap-3"><h2 className="font-bold">バッジ</h2><button onClick={() => setEdit(blank)} className={`${btn} bg-sky-600`}>＋ バッジを追加</button></div>
      <p className="text-xs text-slate-400">条件を満たした人に自動で付与されます（ログイン時・対戦後・メニューを開いた時などに判定）。シーズン終了時の最終ランクバッジは自動で付与されるので、ここでは作りません。</p>
      {edit && !edit.id && <BadgeEditor user={user} b={edit} types={data.types} ranks={data.ranks} onSaved={() => { setEdit(null); load(); }} onCancel={() => setEdit(null)} />}
      <ul className="space-y-2">
        {data.badges.map((b) => (
          <li key={b.id}>
            {edit?.id === b.id ? <BadgeEditor user={user} b={edit} types={data.types} ranks={data.ranks} onSaved={() => { setEdit(null); load(); }} onCancel={() => setEdit(null)} /> : (
              <div className={`${card} !p-3 flex items-center gap-3 flex-wrap`}>
                <img src={`${SERVER_URL}${b.src}`} alt="" className="w-14 h-14 object-contain rounded bg-black/40" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{b.name} {b.enabled === false && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-600">無効</span>}</p>
                  <p className="text-xs text-slate-300">{condText(b.cond, data.ranks)}</p>
                  {b.desc && <p className="text-xs text-slate-500 truncate">{b.desc}</p>}
                </div>
                <button onClick={() => setEdit(b)} className={`${btn} bg-slate-700`}>編集</button>
                <button onClick={() => del(b)} className={`${btn} bg-red-800`}>削除</button>
              </div>
            )}
          </li>
        ))}
        {data.badges.length === 0 && <li className="text-slate-400 text-sm">バッジはまだありません</li>}
      </ul>
    </div>
  );
}

// シーズン設定。切り替わるとランクがリセットされ、最終ランクのバッジが付与される
export function SeasonAdmin({ user }) {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => adminApi(user, '/settings').then((d) => setS(d.season)).catch((e) => setMsg({ ok: false, text: e.message })), [user]);
  useEffect(() => { load(); }, [load]);
  if (!s) return <p>{msg?.text || '読み込み中…'}</p>;
  const save = async () => {
    try { const d = await adminApi(user, '/settings', { method: 'PUT', body: { season: s } }); setS(d.season); setMsg({ ok: true, text: '保存しました' }); } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const rotate = async () => {
    if (!window.confirm('今すぐシーズンを終了します。全員のランクがリセットされ、最終ランクのバッジが付与されます。元に戻せません。よろしいですか？')) return;
    try { const r = await adminApi(user, '/season/rotate', { method: 'POST' }); setMsg({ ok: true, text: `シーズン${r.ended}を終了しました（バッジ付与 ${r.given}人）` }); load(); } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const end = s.startAt ? s.startAt + s.lengthDays * 86400000 : 0;
  return (
    <div className={`${card} max-w-xl`}>
      <h2 className="font-bold mb-2">シーズン</h2>
      <label className="flex items-center gap-2 py-1.5"><input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />シーズン制を有効にする（オフ＝シーズン無し・ランクはリセットされません）</label>
      <Field label="現在のシーズン番号"><Num value={s.number} onChange={(v) => setS({ ...s, number: v })} /></Field>
      <Field label="1シーズンの長さ（日）"><Num value={s.lengthDays} onChange={(v) => setS({ ...s, lengthDays: v })} /></Field>
      <Field label="今シーズンの開始日時"><input type="datetime-local" className={`${input} w-56`} value={toLocal(s.startAt)} onChange={(e) => setS({ ...s, startAt: fromLocal(e.target.value) })} /></Field>
      <Field label="リセット後のポイント（0＝ルーキー5から）"><Num value={s.resetPt} onChange={(v) => setS({ ...s, resetPt: v })} /></Field>
      {s.enabled && end > 0 && <p className="text-sm text-amber-200 my-2">今シーズンは {new Date(end).toLocaleString('ja-JP')} に終了し、自動で次のシーズンに切り替わります。</p>}
      <p className="text-xs text-slate-400 mb-3">終了時、そのシーズンに1戦以上した人へ「最終ランクのバッジ」が付与されます。エンペラーは最終順位の数字つきです。</p>
      {msg && <p className={`text-sm mb-2 ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
      <div className="flex gap-2 flex-wrap">
        <button onClick={save} className={`${btn} bg-emerald-500 font-bold`}>保存</button>
        <button onClick={rotate} disabled={!s.enabled} className={`${btn} bg-red-800 disabled:opacity-40`}>今すぐ次のシーズンへ</button>
      </div>
    </div>
  );
}
