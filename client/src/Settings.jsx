import { useState } from 'react';
import { Coin } from './Parts';
import { Panel, Title, Btn } from './Ui';

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
    <div className="ui-text">
      <Title>設定</Title>
      <Panel className="p-3">
        <label className="block text-sm text-[#f6e4b0] mb-1">表示名（1〜16文字）</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} className="ui-input mb-2" />
        <p className="text-sm text-slate-300 mb-3 flex items-center gap-1 flex-wrap">
          {free ? '初回の変更は無料です' : <>変更には <Coin n={profile.nameCost} className="text-amber-300" /> が必要です（所持 <Coin n={profile.coins} className="text-amber-300" />）</>}
        </p>
        <Btn variant="blue" onClick={save}>変更する</Btn>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
      </Panel>
    </div>
  );
}
