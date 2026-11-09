import { useState } from 'react';
import { callApi } from './api';
import { Avatar } from './Parts';

const REASONS = [['cheat', 'チート行為'], ['name', '不適切な名前'], ['other', 'その他']];

export default function ReportModal({ user, roomId, players, initialUid, onClose }) {
  const [target, setTarget] = useState(initialUid || players[0]?.uid);
  const [reason, setReason] = useState('cheat');
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await callApi(user, '/report', { method: 'POST', body: { targetUid: target, reason, comment, roomId } });
      setMsg({ ok: true, text: '通報を送信しました。ご協力ありがとうございます。' });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 overflow-y-auto">
      <div className="ui-panel w-full max-w-sm p-3 text-white my-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-lg">プレイヤーを通報</h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">✕</button>
        </div>
        <p className="text-sm text-slate-400 mb-1">通報する相手</p>
        <div className="space-y-2 mb-3">
          {players.map((p) => (
            <label key={p.uid} className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer ${target === p.uid ? 'bg-sky-800' : 'bg-[#0e1013]'}`}>
              <input type="radio" name="target" checked={target === p.uid} onChange={() => setTarget(p.uid)} />
              <Avatar iconId={p.iconId} frameId={p.frameId} size={28} /><span className="truncate">{p.name}</span>
            </label>
          ))}
        </div>
        <p className="text-sm text-slate-400 mb-1">理由</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {REASONS.map(([k, label]) => (
            <button key={k} onClick={() => setReason(k)} className={`px-3 py-1.5 rounded-lg text-sm ${reason === k ? 'bg-red-600 font-bold' : 'bg-[#0e1013]'}`}>{label}</button>
          ))}
        </div>
        {reason === 'other' && (
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} rows={3} placeholder="通報の内容を入力してください"
            className="w-full rounded-lg bg-[#0e1013] border border-white/10 px-3 py-2 mb-3" />
        )}
        {msg && <p className={`text-sm mb-3 ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-700 text-sm">閉じる</button>
          {!msg?.ok && <button onClick={send} disabled={busy || !target} className="px-4 py-2 rounded-lg bg-red-600 font-bold text-sm disabled:opacity-40">通報する</button>}
        </div>
      </div>
    </div>
  );
}

const QREASONS = [['difficulty', '難易度がおかしい'], ['irrelevant', '看護に関係ない'], ['wrong', '答えが間違っている']];

// 不適切だと思った問題の通報（理由は3種類）
export function QuestionReportModal({ user, question, onClose }) {
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await callApi(user, '/report-question', { method: 'POST', body: { questionId: question.id, reason } });
      setMsg({ ok: true, text: '問題を通報しました。ご協力ありがとうございます。' });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 overflow-y-auto">
      <div className="ui-panel w-full max-w-sm p-3 text-white my-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold text-lg">問題を通報</h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">✕</button>
        </div>
        <p className="text-xs text-slate-300 mb-3 rounded bg-black/30 p-2 line-clamp-3">{question.question}</p>
        <div className="space-y-2 mb-3">
          {QREASONS.map(([k, label]) => (
            <label key={k} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer ${reason === k ? 'bg-sky-800' : 'bg-[#0e1013]'}`}>
              <input type="radio" name="qreason" checked={reason === k} onChange={() => setReason(k)} />{label}
            </label>
          ))}
        </div>
        {msg && <p className={`text-sm mb-2 ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-700">{msg?.ok ? '閉じる' : 'キャンセル'}</button>
          {!msg?.ok && <button onClick={send} disabled={!reason || busy} className="px-4 py-2 rounded-lg bg-red-600 font-bold disabled:opacity-40">通報する</button>}
        </div>
      </div>
    </div>
  );
}
