import { useCallback, useEffect, useState } from 'react';
import { adminApi, SERVER_URL } from './api';
import { Avatar, Coin } from './Parts';

const input = 'w-full rounded-lg bg-[#0e1013] border border-white/10 px-3 py-2';
const btn = 'px-3 py-1.5 rounded-lg text-sm';
const card = 'rounded-xl bg-[#171a20] p-4';

function useAdminLoad(user, path, key) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setData((await adminApi(user, path))[key]); setError(''); } catch (e) { setError(e.message); }
  }, [user, path, key]);
  useEffect(() => { load(); }, [load]);
  return { data, error, load };
}

/* ---------------- 通報メッセージ ---------------- */
export function Reports({ user, onCount }) {
  const { data, error, load } = useAdminLoad(user, '/reports', 'reports');
  useEffect(() => { if (data) onCount?.(data.filter((r) => !r.resolved).length); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolve = async (r) => { await adminApi(user, `/reports/${r.id}/resolve`, { method: 'POST', body: { resolved: !r.resolved } }); load(); };
  const ban = async (r) => {
    const reason = window.prompt(`${r.toName} をBANします。理由（任意）`, r.reasonLabel);
    if (reason === null) return;
    try { await adminApi(user, `/players/${r.toUid}/ban`, { method: 'POST', body: { banned: true, reason } }); await resolve(r); } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <p className="text-sm text-slate-400 mb-3">プレイヤーからの通報が届きます（新しい順）。</p>
      {error && <p className="text-red-400">{error}</p>}
      <ul className="space-y-2">
        {data?.map((r) => (
          <li key={r.id} className={`${card} ${r.resolved ? 'opacity-50' : 'border border-red-500/40'}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold">{r.fromName}</span><span className="text-slate-400">→</span><span className="font-bold text-red-300">{r.toName}</span>
              <span className="ml-auto text-xs text-slate-400">{new Date(r.createdAt).toLocaleString('ja-JP')}</span>
            </div>
            <p className="mt-1 text-sm"><span className="rounded bg-red-600/80 px-2 py-0.5 text-xs mr-2">{r.reasonLabel}</span>{r.comment}</p>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => resolve(r)} className={`${btn} bg-slate-700`}>{r.resolved ? '未対応に戻す' : '対応済みにする'}</button>
              {!r.resolved && <button onClick={() => ban(r)} className={`${btn} bg-red-600`}>通報先をBAN</button>}
            </div>
          </li>
        ))}
        {data?.length === 0 && <li className="text-slate-400 text-center py-8">通報はありません</li>}
      </ul>
    </div>
  );
}

/* ---------------- メール・お知らせ ---------------- */
export function Delivery({ user }) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <MailAdmin user={user} />
      <NoticeAdmin user={user} />
    </div>
  );
}

function MailAdmin({ user }) {
  const { data, load } = useAdminLoad(user, '/mails', 'mails');
  const [f, setF] = useState({ to: 'all', title: '', body: '', coins: 0 });
  const [msg, setMsg] = useState(null);
  const send = async () => {
    try { await adminApi(user, '/mails', { method: 'POST', body: { ...f, to: f.to.trim() || 'all' } }); setMsg({ ok: true, text: '送信しました' }); setF({ ...f, title: '', body: '' }); load(); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const del = async (m) => { if (window.confirm('このメールを削除しますか？（未受け取りのプレゼントも消えます）')) { await adminApi(user, `/mails/${m.id}`, { method: 'DELETE' }); load(); } };

  return (
    <div>
      <h2 className="font-bold mb-2">メール（プレゼント）送信</h2>
      <div className={`${card} space-y-2`}>
        <input className={input} placeholder='宛先（全員は "all"、個人はUID）' value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <input className={input} placeholder="タイトル" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <textarea className={input} rows={3} placeholder="本文" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">プレゼントのコイン<input type="number" min={0} className={`${input} w-28`} value={f.coins} onChange={(e) => setF({ ...f, coins: e.target.value })} /></label>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <button onClick={send} className={`${btn} bg-emerald-500 font-bold`}>送信</button>
      </div>
      <ul className="space-y-2 mt-3">
        {data?.slice(0, 20).map((m) => (
          <li key={m.id} className={`${card} !p-3 flex items-center gap-2`}>
            <div className="min-w-0 flex-1"><p className="font-semibold truncate">{m.title}</p>
              <p className="text-xs text-slate-400">{m.to === 'all' ? '全員' : m.to} ・ {m.coins}コイン ・ {new Date(m.createdAt).toLocaleDateString('ja-JP')}</p></div>
            <button onClick={() => del(m)} className={`${btn} bg-red-600/80`}>削除</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NoticeAdmin({ user }) {
  const { data, load } = useAdminLoad(user, '/notices', 'notices');
  const [f, setF] = useState({ title: '', body: '' });
  const [msg, setMsg] = useState(null);
  const post = async () => {
    try { await adminApi(user, '/notices', { method: 'POST', body: f }); setMsg({ ok: true, text: '投稿しました' }); setF({ title: '', body: '' }); load(); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const del = async (n) => { if (window.confirm('このお知らせを削除しますか？')) { await adminApi(user, `/notices/${n.id}`, { method: 'DELETE' }); load(); } };

  return (
    <div>
      <h2 className="font-bold mb-2">お知らせ投稿</h2>
      <div className={`${card} space-y-2`}>
        <input className={input} placeholder="タイトル" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <textarea className={input} rows={4} placeholder="本文" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <button onClick={post} className={`${btn} bg-emerald-500 font-bold`}>投稿</button>
      </div>
      <ul className="space-y-2 mt-3">
        {data?.slice(0, 20).map((n) => (
          <li key={n.id} className={`${card} !p-3 flex items-center gap-2`}>
            <div className="min-w-0 flex-1"><p className="font-semibold truncate">{n.title}</p><p className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleDateString('ja-JP')}</p></div>
            <button onClick={() => del(n)} className={`${btn} bg-red-600/80`}>削除</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- ショップ（アイコン） ---------------- */
async function fileToIcon(file) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 256, 256); // 中央を正方形に切り出して256pxへ
  return c.toDataURL('image/webp', 0.9);
}

export function ShopAdmin({ user }) {
  const { data, error, load } = useAdminLoad(user, '/icons', 'icons');
  const [f, setF] = useState({ name: '', price: 100, image: '' });
  const [msg, setMsg] = useState(null);

  const pick = async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, image: await fileToIcon(file) }); };
  const add = async () => {
    try { await adminApi(user, '/icons', { method: 'POST', body: f }); setMsg({ ok: true, text: '追加しました' }); setF({ name: '', price: 100, image: '' }); load(); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const patch = async (i, body) => { try { await adminApi(user, `/icons/${i.id}`, { method: 'PUT', body }); load(); } catch (e) { alert(e.message); } };

  return (
    <div>
      <h2 className="font-bold mb-2">アイコンを追加</h2>
      <div className={`${card} space-y-2 mb-5`}>
        <div className="flex items-center gap-3">
          {f.image ? <img src={f.image} alt="" className="w-16 h-16 rounded-full object-cover" /> : <div className="w-16 h-16 rounded-full bg-slate-700" />}
          <input type="file" accept="image/*" onChange={pick} className="text-sm" />
        </div>
        <div className="flex gap-2">
          <input className={input} placeholder="名前" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input type="number" min={0} className={`${input} w-28`} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        </div>
        <p className="text-xs text-slate-400">画像は中央を正方形に切り出して256pxに縮小されます。価格の単位はコインです。</p>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <button onClick={add} disabled={!f.image || !f.name} className={`${btn} bg-emerald-500 font-bold disabled:opacity-40`}>追加（販売開始）</button>
      </div>

      <h2 className="font-bold mb-2">登録済みアイコン</h2>
      {error && <p className="text-red-400">{error}</p>}
      <ul className="space-y-2">
        {data?.map((i) => (
          <li key={i.id} className={`${card} !p-3 flex items-center gap-3 ${i.onSale ? '' : 'opacity-60'}`}>
            <Avatar iconId={i.id} size={48} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{i.name}</p>
              <Coin n={i.price} className="text-amber-300 text-sm" />
            </div>
            <button onClick={() => { const p = window.prompt('新しい価格（コイン）', i.price); if (p !== null) patch(i, { price: Number(p) }); }} className={`${btn} bg-slate-700`}>価格</button>
            <button onClick={() => { const n = window.prompt('新しい名前', i.name); if (n) patch(i, { name: n }); }} className={`${btn} bg-slate-700`}>名前</button>
            <button onClick={() => patch(i, { onSale: !i.onSale })} className={`${btn} ${i.onSale ? 'bg-sky-600' : 'bg-slate-600'}`}>{i.onSale ? '販売中' : '停止中'}</button>
          </li>
        ))}
        {data?.length === 0 && <li className="text-slate-400 text-center py-6">まだアイコンがありません</li>}
      </ul>
    </div>
  );
}

/* ---------------- 設定 ---------------- */
export function SettingsAdmin({ user }) {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { adminApi(user, '/settings').then(setS).catch((e) => setMsg({ ok: false, text: e.message })); }, [user]);
  if (!s) return <p>読み込み中…</p>;

  const num = (v) => (v === '' ? '' : Number(v));
  const save = async () => {
    try { setS(await adminApi(user, '/settings', { method: 'PUT', body: s })); setMsg({ ok: true, text: '保存しました' }); } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const Field = ({ label, children }) => <label className="flex items-center justify-between gap-3 py-2"><span>{label}</span>{children}</label>;

  return (
    <div className={`${card} max-w-md`}>
      <h2 className="font-bold mb-1">ミッション報酬（コイン）</h2>
      {[['login', 'ログインする'], ['play', '5マッチプレイする'], ['win', '3勝する']].map(([k, label]) => (
        <Field key={k} label={label}>
          <input type="number" min={0} className={`${input} w-28`} value={s.missionRewards[k]} onChange={(e) => setS({ ...s, missionRewards: { ...s.missionRewards, [k]: num(e.target.value) } })} />
        </Field>
      ))}
      <h2 className="font-bold mt-3 mb-1">その他</h2>
      <Field label="改名コスト（2回目以降・コイン）">
        <input type="number" min={0} className={`${input} w-28`} value={s.renameCost} onChange={(e) => setS({ ...s, renameCost: num(e.target.value) })} />
      </Field>
      <Field label="Secondary(得点2倍)の確率 %">
        <input type="number" min={0} max={100} step={0.5} className={`${input} w-28`} value={Math.round(s.secondaryChance * 1000) / 10} onChange={(e) => setS({ ...s, secondaryChance: num(e.target.value) / 100 })} />
      </Field>
      {msg && <p className={`text-sm mt-2 ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
      <button onClick={save} className={`${btn} bg-emerald-500 font-bold mt-3`}>保存</button>
    </div>
  );
}
