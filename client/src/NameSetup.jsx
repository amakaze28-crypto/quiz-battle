import { useState } from 'react';
import { Panel, Btn } from './Ui';

// 初めてログインしたときに表示名を決める（初期名は「名もなき旅人」）
export default function NameSetup({ profile, call }) {
  const [name, setName] = useState(profile?.displayName || '名もなき旅人');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = name.trim().length >= 1 && name.trim().length <= 16;
  const save = async () => {
    setBusy(true); setErr('');
    try { await call('/name', { method: 'POST', body: { name: name.trim() } }); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-5">
      <Panel className="w-full max-w-sm p-5 text-center">
        <p className="ui-title text-xl mb-1">ようこそ、看護模試バトルへ</p>
        <p className="text-sm text-slate-300 mb-4">あなたの名前を決めてください。<br />決めずに始めると「名もなき旅人」になります。<br /><span className="text-xs text-slate-400">（あとから設定で変更できます）</span></p>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} autoFocus onKeyDown={(e) => e.key === 'Enter' && ok && !busy && save()}
          className="ui-input mb-1 text-center" placeholder="名もなき旅人" />
        <p className="text-xs text-slate-400 mb-3">{name.trim().length} / 16 文字</p>
        {err && <p className="text-sm text-red-300 mb-2">{err}</p>}
        <Btn variant="gold" block disabled={!ok || busy} onClick={save}>この名前で始める</Btn>
      </Panel>
    </div>
  );
}
