import { useCallback, useEffect, useState } from 'react';
import { adminApi, SERVER_URL } from './api';

const btn = 'px-3 py-1.5 rounded-lg text-sm';
const shiftDay = (d, n) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

// 現在のログイン数（オンライン人数）と、時間別のログイン数グラフ（日本時間）
export function LoginStats({ user }) {
  const [date, setDate] = useState('');
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try { setD(await adminApi(user, `/loginstats?date=${date}`)); setErr(''); } catch (e) { setErr(e.message); }
  }, [user, date]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  if (!d) return <div className="rounded-xl bg-[#171a20] p-4">{err || '読み込み中…'}</div>;

  const isToday = d.date === d.today;
  const max = Math.max(1, ...d.hours.map((h) => Math.max(h.logins, h.peak)));
  const W = 480; const H = 170; const padL = 28; const padB = 22; const bw = (W - padL) / 24;
  const y = (v) => H - padB - (v / max) * (H - padB - 14);
  const ticks = [0, Math.ceil(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="rounded-xl bg-[#171a20] p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="font-bold">ログイン数</h2>
        <button onClick={load} className={`${btn} bg-slate-700`}>更新</button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div className="rounded-lg bg-[#0e1013] p-2"><div className="text-xs text-slate-400">現在オンライン</div><div className="text-2xl font-extrabold text-emerald-300">{d.online}<span className="text-sm font-normal text-slate-400">人</span></div></div>
        <div className="rounded-lg bg-[#0e1013] p-2"><div className="text-xs text-slate-400">{d.date.slice(5).replace('-', '/')} のログイン人数</div><div className="text-2xl font-extrabold text-sky-300">{d.uniqueDay}<span className="text-sm font-normal text-slate-400">人</span></div></div>
        <div className="rounded-lg bg-[#0e1013] p-2"><div className="text-xs text-slate-400">同時接続の最高</div><div className="text-2xl font-extrabold text-amber-300">{d.peakDay}<span className="text-sm font-normal text-slate-400">人</span></div></div>
      </div>
      <div className="flex items-center justify-center gap-2 mb-2 text-sm">
        <button onClick={() => setDate(shiftDay(d.date, -1))} className={`${btn} bg-slate-700`}>◀ 前の日</button>
        <input type="date" value={d.date} max={d.today} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded bg-[#0e1013] border border-white/10 px-2 py-1" />
        <button onClick={() => setDate(shiftDay(d.date, 1))} disabled={isToday} className={`${btn} bg-slate-700 disabled:opacity-40`}>次の日 ▶</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="時間別ログイン数">
        {ticks.map((t) => (
          <g key={t}><line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#2a2f3a" strokeWidth="1" /><text x={padL - 4} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{t}</text></g>
        ))}
        {d.hours.map((h) => {
          const x = padL + h.h * bw; const cur = isToday && h.h === d.nowHour;
          return (
            <g key={h.h}>
              <rect x={x + 2} y={y(h.logins)} width={bw - 4} height={Math.max(0, H - padB - y(h.logins))} rx="2" fill={cur ? '#38bdf8' : '#0ea5e9'} opacity={cur ? 1 : 0.8}>
                <title>{`${h.h}時台  ログイン ${h.logins}人（${h.events}回） / 同時接続の最高 ${h.peak}人`}</title>
              </rect>
              {h.logins > 0 && <text x={x + bw / 2} y={y(h.logins) - 3} textAnchor="middle" fontSize="9" fill="#e2e8f0">{h.logins}</text>}
              {h.h % 3 === 0 && <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">{h.h}</text>}
            </g>
          );
        })}
        <polyline fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round" points={d.hours.map((h) => `${padL + h.h * bw + bw / 2},${y(h.peak)}`).join(' ')} />
        {d.hours.map((h) => h.peak > 0 && <circle key={h.h} cx={padL + h.h * bw + bw / 2} cy={y(h.peak)} r="2.5" fill="#fbbf24" />)}
      </svg>
      <p className="text-xs text-slate-400 mt-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#0ea5e9] align-middle mr-1" />その時間にログインした人数　<span className="inline-block w-3 h-0.5 bg-amber-400 align-middle mr-1" />同時接続の最高人数（時刻は日本時間）{isToday ? '・今の時間は明るい青' : ''}</p>
      {err && <p className="text-red-300 text-sm">{err}</p>}
    </div>
  );
}

// メンテナンスのオン／オフ。オンの間は管理者以外ログインできず、タイトル画面に「メンテナンス中」と表示される
export function MaintenanceCard({ user }) {
  const [m, setM] = useState(null);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState(null);
  useEffect(() => { fetch(`${SERVER_URL}/maintenance`, { cache: 'no-store' }).then((r) => r.json()).then((d) => { setM(d); setText(d.message || ''); }).catch(() => {}); }, []);
  const set = async (on) => {
    if (on && !window.confirm('メンテナンスを開始します。管理者以外はログインできなくなり、接続中の人もタイトル画面に戻されます（対戦中の人も切断されます）。よろしいですか？')) return;
    try { const d = await adminApi(user, '/maintenance', { method: 'POST', body: { on, message: text } }); setM(d); setMsg({ ok: true, text: on ? 'メンテナンスを開始しました' : 'メンテナンスを終了しました' }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  if (!m) return null;
  return (
    <div className={`rounded-xl p-4 lg:col-span-2 ${m.on ? 'bg-amber-950/60 border border-amber-500/60' : 'bg-[#171a20]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="font-bold">メンテナンス</h2>
        <span className={`text-sm font-bold rounded px-2 py-0.5 ${m.on ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-200'}`}>{m.on ? '🔧 メンテナンス中' : '通常運営中'}</span>
      </div>
      <p className="text-xs text-slate-400 mb-2">オンにすると、タイトル画面に「メンテナンス中」と表示され、管理者アカウント以外はログインできません（タイトル画面までしか進めません）。</p>
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="タイトル画面に出すメッセージ（空なら標準の文）"
        className="w-full rounded-lg bg-[#0e1013] border border-white/10 px-3 py-2 mb-2" />
      <div className="flex gap-2">
        {m.on
          ? <><button onClick={() => set(true)} className={`${btn} bg-slate-700`}>メッセージを更新</button><button onClick={() => set(false)} className={`${btn} bg-emerald-600 font-bold`}>メンテナンスを終了する</button></>
          : <button onClick={() => set(true)} className={`${btn} bg-amber-600 font-bold`}>メンテナンスを開始する</button>}
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
    </div>
  );
}
