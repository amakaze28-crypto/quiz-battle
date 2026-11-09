import { useState } from 'react';

export default function Settings({ g }) {
  const { profile } = g;
  const [name, setName] = useState(profile?.displayName || '');
  const [msg, setMsg] = useState(null);

  const save = async () => {
    const res = await g.setName(name);
    setMsg(res.ok ? { ok: true, text: '保存しました' } : { ok: false, text: res.error });
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">設定</h1>
      <div className="rounded-2xl bg-[#171a20] p-5">
        <label className="block text-sm text-slate-400 mb-1">表示名（1〜16文字）</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16}
          className="w-full rounded-lg bg-[#0e1013] border border-white/10 px-3 py-2 mb-3" />
        <button onClick={save} disabled={g.conn !== 'online'} className="px-5 py-2 rounded-lg bg-emerald-500 font-bold disabled:opacity-40">保存</button>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
