import { useState } from 'react';
import { Coin } from './Parts';

export default function Settings({ profile, call }) {
  const [name, setName] = useState(profile?.displayName || '');
  const [msg, setMsg] = useState(null);
  const free = (profile?.nameChanges ?? 0) === 0;

  const save = async () => {
    const cost = profile.nameCost;
    if (!free && !window.confirm(`表示名の変更には ${cost} コインが必要です。変更しますか？`)) return;
    try { await call('/name', { method: 'POST', body: { name } }); setMsg({ ok: true, text: '変更しました' }); } catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">設定</h1>
      <div className="rounded-2xl bg-[#171a20] p-5">
        <label className="block text-sm text-slate-400 mb-1">表示名（1〜16文字）</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16}
          className="w-full rounded-lg bg-[#0e1013] border border-white/10 px-3 py-2 mb-2" />
        <p className="text-sm text-slate-400 mb-3 flex items-center gap-1">
          {free ? '初回の変更は無料です' : <>変更には <Coin n={profile.nameCost} className="text-amber-300" /> が必要です（所持 <Coin n={profile.coins} className="text-amber-300" />）</>}
        </p>
        <button onClick={save} className="px-5 py-2 rounded-lg bg-emerald-500 font-bold">変更する</button>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
