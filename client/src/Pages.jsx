import { useCallback, useEffect, useState } from 'react';
import { callApi } from './api';
import { Coin, Sand, Dot } from './Parts';
import { Panel, Title, Btn } from './Ui';


/* ---------------- メール(運営からのプレゼント) ---------------- */
export function Mails({ user, call, onChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const reload = useCallback(async () => { try { setData(await callApi(user, '/mails')); setError(''); } catch (e) { setError(e.message); } }, [user]);
  useEffect(() => { reload(); }, [reload]);

  const claim = async (m) => { try { await call(`/mails/${m.id}/claim`, { method: 'POST' }); await reload(); onChange(); } catch (e) { setMsg(e.message); } };
  const read = async (m) => { if (!m.read) { await callApi(user, `/mails/${m.id}/read`, { method: 'POST' }).catch(() => {}); reload(); onChange(); } };

  return (
    <div className="ui-text">
      <Title className="!mb-2">メール</Title>
      <p className="text-sm text-slate-300 mb-3 text-center">運営からのプレゼントを受け取れます。</p>
      {(error || msg) && <p className="text-red-400 text-sm mb-2">{error || msg}</p>}
      <div className="space-y-3">
        {data?.mails.map((m) => (
          <Panel key={m.id} className="p-3" onClick={() => read(m)}>
            <div className="flex items-center gap-2"><span className="font-bold">{m.title}</span>{!m.read && <Dot className="w-2.5 h-2.5" />}</div>
            <p className="text-xs text-slate-400 mb-2">{new Date(m.createdAt).toLocaleString('ja-JP')}</p>
            {m.body && <p className="text-sm whitespace-pre-wrap text-slate-200 mb-2">{m.body}</p>}
            {(m.coins > 0 || m.sand > 0) && (
              <div className="flex items-center justify-between">
                <span className="flex gap-3 text-amber-300">
                  {m.coins > 0 && <Coin n={m.coins} size={22} />}
                  {m.sand > 0 && <Sand n={m.sand} size={24} />}
                </span>
                {m.claimed ? <span className="text-sm text-slate-400">受け取り済み</span>
                  : <Btn variant="gold" className="!min-h-[40px] text-sm" onClick={(e) => { e.stopPropagation(); claim(m); }}>受け取る</Btn>}
              </div>
            )}
          </Panel>
        ))}
        {data?.mails.length === 0 && <p className="text-slate-400 text-center py-8">メールはありません</p>}
      </div>
    </div>
  );
}
