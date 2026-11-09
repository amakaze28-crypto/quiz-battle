import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from './api';
import RankBadge from './RankBadge';
import { GachasAdmin, SoundsAdmin } from './AdminGacha';
import { Reports, QuestionReports, Delivery, ItemsAdmin, MissionsAdmin, SettingsAdmin } from './AdminExtra';

const input = 'w-full rounded-lg bg-[#0e1013] border border-white/10 px-3 py-2';
const btn = 'px-3 py-1.5 rounded-lg text-sm';

export default function Admin({ user }) {
  const [tab, setTab] = useState('questions');
  const [unresolved, setUnresolved] = useState(0);
  const [qUnresolved, setQUnresolved] = useState(0);
  // メッセージ(通報)の未対応件数をタブに表示
  useEffect(() => {
    adminApi(user, '/reports').then((d) => setUnresolved(d.unresolved)).catch(() => {});
    adminApi(user, '/qreports').then((d) => setQUnresolved(d.unresolved)).catch(() => {});
  }, [user]);
  const tabs = [['questions', '問題'], ['players', 'プレイヤー'], ['reports', `メッセージ${unresolved ? `(${unresolved})` : ''}`], ['qreports', `問題通報${qUnresolved ? `(${qUnresolved})` : ''}`], ['delivery', 'メール'], ['items', 'アイテム'], ['gachas', 'ガチャ'], ['sounds', '音源'], ['missions', 'ミッション'], ['settings', '設定']];
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`${btn} ${tab === k ? 'bg-sky-600 font-bold' : 'bg-[#171a20]'}`}>{label}</button>
        ))}
      </div>
      {tab === 'questions' && <Questions user={user} />}
      {tab === 'players' && <Players user={user} />}
      {tab === 'reports' && <Reports user={user} onCount={setUnresolved} />}
      {tab === 'qreports' && <QuestionReports user={user} onCount={setQUnresolved} />}
      {tab === 'delivery' && <Delivery user={user} />}
      {tab === 'items' && <ItemsAdmin user={user} />}
      {tab === 'gachas' && <GachasAdmin user={user} />}
      {tab === 'sounds' && <SoundsAdmin user={user} />}
      {tab === 'missions' && <MissionsAdmin user={user} />}
      {tab === 'settings' && <SettingsAdmin user={user} />}
    </div>
  );
}

/* ---------------- 問題管理 ---------------- */
function Questions({ user }) {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('all'); // all | published | draft
  const [search, setSearch] = useState('');
  const [fileSel, setFileSel] = useState('all'); // 'all' | ファイル名
  const [editing, setEditing] = useState(null); // null | 'new' | question
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setList((await adminApi(user, '/questions')).questions); setError(''); } catch (e) { setError(e.message); }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const fileOf = (q) => q.file || '未分類';
  const files = useMemo(() => {
    const m = new Map();
    list.forEach((q) => { const f = fileOf(q); const e = m.get(f) || { n: 0, p: 0 }; e.n++; if (q.published) e.p++; m.set(f, e); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ja'));
  }, [list]);
  const shown = useMemo(() => list.filter((q) =>
    (fileSel === 'all' || fileOf(q) === fileSel)
    && (filter === 'all' || (filter === 'published') === !!q.published)
    && (!search || q.question.includes(search) || q.choices.some((c) => c.includes(search)))), [list, filter, search, fileSel]);
  const publishedCount = list.filter((q) => q.published).length;

  const act = async (fn) => { try { await fn(); await load(); } catch (e) { alert(e.message); } };
  const toggle = (q) => act(() => adminApi(user, `/questions/${q.id}/publish`, { method: 'POST', body: { published: !q.published } }));
  const fileAct = (path, body, ask) => { if (!ask || window.confirm(ask)) act(() => adminApi(user, `/questions/files/${path}`, { method: 'POST', body })); };
  const moveOne = (q) => {
    const to = window.prompt(`移動先のファイル名（既存: ${files.map((f) => f[0]).join(' / ')}）`, fileOf(q));
    if (to && to.trim()) act(() => adminApi(user, '/questions/move', { method: 'POST', body: { ids: [q.id], to: to.trim() } }));
  };
  const fileCategory = (f) => list.find((q) => fileOf(q) === f && q.category)?.category || f; // 未設定ならファイル名
  const [catDraft, setCatDraft] = useState('');
  useEffect(() => { setCatDraft(fileSel === 'all' ? '' : fileCategory(fileSel)); }, [fileSel, list]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveCategory = () => fileAct('category', { file: fileSel, category: catDraft.trim() === fileSel ? '' : catDraft.trim() });
  const renameFile = () => {
    const to = window.prompt(`「${fileSel}」の新しい名前`, fileSel);
    if (to && to.trim() && to.trim() !== fileSel) { fileAct('rename', { from: fileSel, to: to.trim() }); setFileSel(to.trim().slice(0, 40)); }
  };
  const remove = (q) => { if (window.confirm(`この問題を削除しますか？\n\n${q.question}`)) act(() => adminApi(user, `/questions/${q.id}`, { method: 'DELETE' })); };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={() => setEditing('new')} className={`${btn} bg-emerald-500 font-bold`}>＋ 問題を追加</button>
        <button onClick={() => setImporting(true)} className={`${btn} bg-sky-600`}>JSON取り込み</button>
        <span className="text-sm text-slate-400 ml-auto">公開中 {publishedCount} / 全 {list.length} 問</span>
      </div>
      {publishedCount < 10 && <p className="mb-3 text-sm text-amber-400">公開中の問題が10問未満です（試合は公開中の全問で行われます）。</p>}
      <div className="flex flex-wrap gap-2 mb-3">
        {[['all', 'すべて', list.length, list.filter((q) => q.published).length], ...files.map(([f, e]) => [f, f, e.n, e.p])].map(([k, label, n, p]) => (
          <button key={k} onClick={() => setFileSel(k)} className={`${btn} ${fileSel === k ? 'bg-sky-600 font-bold' : 'bg-[#171a20]'}`}>📁 {label} <span className="text-xs opacity-70">{p}/{n}</span></button>
        ))}
      </div>
      {fileSel !== 'all' && (
        <div className="flex flex-wrap gap-2 mb-3 items-center rounded-lg bg-[#171a20] p-2">
          <span className="text-sm text-slate-300">📁 {fileSel} の操作:</span>
          <button onClick={() => fileAct('publish', { file: fileSel, published: true })} className={`${btn} bg-emerald-600`}>全部公開</button>
          <button onClick={() => fileAct('publish', { file: fileSel, published: false })} className={`${btn} bg-slate-700`}>全部非公開</button>
          <button onClick={renameFile} className={`${btn} bg-slate-700`}>名前変更</button>
          <label className="flex items-center gap-1 text-sm text-slate-300 basis-full sm:basis-auto">分野
            <input className={`${input} !w-40 !py-1`} maxLength={40} value={catDraft} onChange={(e) => setCatDraft(e.target.value)} placeholder="例: 基礎看護学" />
            <button onClick={saveCategory} className={`${btn} bg-sky-600`}>分野を保存</button>
          </label>
          <button onClick={() => fileAct('delete', { file: fileSel }, `ファイル「${fileSel}」の問題 ${files.find((f) => f[0] === fileSel)?.[1].n ?? 0}問をすべて削除しますか？`)} className={`${btn} bg-red-600/80 ml-auto`}>ファイルごと削除</button>
        </div>
      )}
      <div className="flex gap-2 mb-4">
        <input className={input} placeholder="問題文・選択肢を検索" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={`${input} w-32`} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">すべて</option><option value="published">公開</option><option value="draft">非公開</option>
        </select>
      </div>
      {error && <p className="text-red-400 mb-3">{error}</p>}

      <ul className="space-y-2">
        {shown.map((q) => (
          <li key={q.id} className="rounded-xl bg-[#171a20] p-4">
            <div className="flex items-start gap-3">
              <span className={`shrink-0 text-xs rounded px-2 py-0.5 ${q.published ? 'bg-emerald-600' : 'bg-slate-600'}`}>{q.published ? '公開' : '非公開'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-sky-300 mb-0.5">📁 {fileOf(q)}　分野: {q.category || fileOf(q)}</p>
                <p className="font-semibold">{q.question}</p>
                <p className="text-sm text-slate-400 mt-1">
                  {q.choices.map((c, i) => <span key={i} className={i === q.answer ? 'text-emerald-400 font-bold mr-3' : 'mr-3'}>{'ABCD'[i]}. {c}</span>)}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <button onClick={() => toggle(q)} className={`${btn} bg-slate-700`}>{q.published ? '非公開にする' : '公開する'}</button>
              <button onClick={() => moveOne(q)} className={`${btn} bg-slate-700`}>移動</button>
              <button onClick={() => setEditing(q)} className={`${btn} bg-slate-700`}>編集</button>
              <button onClick={() => remove(q)} className={`${btn} bg-red-600/80`}>削除</button>
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="text-slate-400 text-center py-8">問題がありません</li>}
      </ul>

      {editing && <QuestionForm user={user} files={files.map((f) => f[0])} defaultFile={fileSel === 'all' ? '' : fileSel} q={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {importing && <ImportModal user={user} defaultFile={fileSel === 'all' ? '' : fileSel} onClose={() => setImporting(false)} onDone={load} />}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-[#1b1f27] p-5 my-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function QuestionForm({ user, q, files = [], defaultFile = '', onClose, onSaved }) {
  const [file, setFile] = useState(q?.file || defaultFile || '');
  const [question, setQuestion] = useState(q?.question || '');
  const [choices, setChoices] = useState(q?.choices || ['', '', '', '']);
  const [answer, setAnswer] = useState(q?.answer ?? 0);
  const [explanation, setExplanation] = useState(q?.explanation || '');
  const [published, setPublished] = useState(q?.published ?? false);
  const [err, setErr] = useState('');

  const save = async () => {
    try {
      const body = { question, choices, answer, explanation, published, file: file.trim() || '未分類' };
      if (q) await adminApi(user, `/questions/${q.id}`, { method: 'PUT', body });
      else await adminApi(user, '/questions', { method: 'POST', body });
      onSaved();
    } catch (e) { setErr(e.message); }
  };

  return (
    <Modal title={q ? '問題を編集' : '問題を追加'} onClose={onClose}>
      <label className="text-sm text-slate-400">ファイル（空欄は「未分類」）</label>
      <input className={`${input} mb-3`} list="qfiles" maxLength={40} value={file} onChange={(e) => setFile(e.target.value)} placeholder="例: 基礎看護学" />
      <datalist id="qfiles">{files.map((f) => <option key={f} value={f} />)}</datalist>
      <label className="text-sm text-slate-400">問題文</label>
      <textarea className={`${input} mb-3`} rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} />
      <label className="text-sm text-slate-400">選択肢（正解にチェック）</label>
      {choices.map((c, i) => (
        <div key={i} className="flex items-center gap-2 mt-2">
          <input type="radio" name="answer" checked={answer === i} onChange={() => setAnswer(i)} />
          <span className="w-4">{'ABCD'[i]}</span>
          <input className={input} value={c} onChange={(e) => setChoices(choices.map((x, j) => (j === i ? e.target.value : x)))} />
        </div>
      ))}
      <label className="text-sm text-slate-400 block mt-3">解説（任意）</label>
      <textarea className={`${input} mb-3`} rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      <label className="flex items-center gap-2 mb-3"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />公開する</label>
      {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className={`${btn} bg-slate-700`}>キャンセル</button>
        <button onClick={save} className={`${btn} bg-emerald-500 font-bold`}>保存</button>
      </div>
    </Modal>
  );
}

function ImportModal({ user, defaultFile = '', onClose, onDone }) {
  const [fileName, setFileName] = useState(defaultFile);
  const [text, setText] = useState('');
  const [published, setPublished] = useState(false);
  const [msg, setMsg] = useState(null);

  const onFile = async (e) => {
    // 複数ファイルを選ぶと、中の問題をまとめて取り込めます
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    const all = [];
    for (const f of files) {
      try { const d = JSON.parse(await f.text()); const base = f.name.replace(/\.json$/i, '');
        all.push(...(Array.isArray(d) ? d : d.questions || []).map((x) => ({ file: base, ...x }))); }
      catch { return setMsg({ ok: false, text: `${f.name} をJSONとして読み込めません` }); }
    }
    setText(JSON.stringify(all, null, 1)); setMsg({ ok: true, text: `${files.length}ファイル・${all.length}問を読み込みました。「取り込む」を押してください` });
  };

  const run = async () => {
    let data;
    try { data = JSON.parse(text); } catch { return setMsg({ ok: false, text: 'JSONとして読み込めません' }); }
    const questions = Array.isArray(data) ? data : data.questions;
    if (!Array.isArray(questions)) return setMsg({ ok: false, text: '配列（または {"questions":[...]}）で指定してください' });
    try {
      const r = await adminApi(user, '/questions/import', { method: 'POST', body: { questions: fileName.trim() ? questions.map((x) => ({ ...x, file: fileName.trim() })) : questions, published } });
      setMsg({
        ok: true,
        text: `${r.imported}件を取り込みました（重複スキップ ${r.skipped}件 / エラー ${r.errors.length}件）`,
        errors: r.errors,
      });
      onDone();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  return (
    <Modal title="JSON取り込み" onClose={onClose}>
      <p className="text-xs text-slate-400 mb-2">形式: <code>[{'{'}"question":"…","choices":["A","B","C","D"],"answer":0,"explanation":"任意"{'}'}]</code>（answerは0始まり）。同じ問題文は重複としてスキップされます。</p>
      <label className="text-xs text-slate-400">ファイル名（空欄なら、選んだJSONのファイル名がそのままファイル名になります）</label>
      <input className={`${input} mb-2`} maxLength={40} value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="例: 基礎看護学" />
      <input type="file" multiple accept=".json,application/json" onChange={onFile} className="mb-2 text-sm" />
      <textarea className={`${input} font-mono text-xs mb-3`} rows={8} placeholder="ここにJSONを貼り付け、またはファイルを選択" value={text} onChange={(e) => setText(e.target.value)} />
      <label className="flex items-center gap-2 mb-3 text-sm"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />取り込み後すぐに公開する（オフなら非公開で取り込み）</label>
      {msg && (
        <div className={`text-sm mb-3 ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {msg.text}
          {msg.errors?.slice(0, 5).map((e) => <div key={e.index} className="text-amber-400">#{e.index + 1}: {e.message}</div>)}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className={`${btn} bg-slate-700`}>閉じる</button>
        <button onClick={run} disabled={!text.trim()} className={`${btn} bg-sky-600 font-bold disabled:opacity-40`}>取り込む</button>
      </div>
    </Modal>
  );
}

/* ---------------- プレイヤー ---------------- */
function Players({ user }) {
  const [q, setQ] = useState('');
  const [data, setData] = useState({ players: [], total: 0 });
  const [error, setError] = useState('');

  const load = useCallback(async (query) => {
    try { setData(await adminApi(user, `/players?q=${encodeURIComponent(query)}`)); setError(''); } catch (e) { setError(e.message); }
  }, [user]);

  // 入力のたびに少し待ってから検索
  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  const give = async (p, currency) => {
    const label = currency === 'sand' ? '魔法の砂' : 'コイン';
    const v = window.prompt(`${p.displayName} の${label}を増減します（現在 ${currency === 'sand' ? p.sand : p.coins}）。例: 100 / -50`, '100');
    if (v === null) return;
    try { await adminApi(user, `/players/${p.uid}/coins`, { method: 'POST', body: { delta: Number(v), currency } }); load(q); } catch (e) { alert(e.message); }
  };

  const ban = async (p) => {
    let body;
    if (p.banned) {
      if (!window.confirm(`${p.displayName} のBANを解除しますか？`)) return;
      body = { banned: false };
    } else {
      const reason = window.prompt(`${p.displayName} をBANします。理由（任意）を入力してください`, '');
      if (reason === null) return;
      body = { banned: true, reason };
    }
    try { await adminApi(user, `/players/${p.uid}/ban`, { method: 'POST', body }); load(q); } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <input className={`${input} mb-1`} placeholder="名前・メール・UIDで検索" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="text-xs text-slate-400 mb-4">該当 {data.total} 人（上位200人まで表示・レート順）</p>
      {error && <p className="text-red-400 mb-3">{error}</p>}
      <ul className="space-y-2">
        {data.players.map((p) => (
          <li key={p.uid} className={`rounded-xl p-3 flex items-center gap-3 ${p.banned ? 'bg-red-950/50' : 'bg-[#171a20]'}`}>
            <RankBadge rank={p.rank} size={44} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{p.displayName}{p.banned && <span className="ml-2 text-xs bg-red-600 rounded px-1.5 py-0.5">BAN中</span>}</p>
              <p className="text-xs text-slate-400 truncate">{p.email} ・ {p.rank.label}（{p.isMaster ? `${p.mr} MR` : `${p.pt} pt`}）・ {p.games}戦 {p.wins}勝 {p.losses}敗 ・ {p.coins}コイン ・ 砂{p.sand}</p>
              <p className="text-xs text-slate-500 truncate select-all">UID: {p.uid}</p>
              {p.banned && p.banReason && <p className="text-xs text-red-300">理由: {p.banReason}</p>}
            </div>
            <button onClick={() => give(p, 'coins')} className={`${btn} shrink-0 bg-slate-700`}>コイン</button>
            <button onClick={() => give(p, 'sand')} className={`${btn} shrink-0 bg-slate-700`}>砂</button>
            <button onClick={() => ban(p)} className={`${btn} shrink-0 ${p.banned ? 'bg-slate-700' : 'bg-red-600'}`}>{p.banned ? '解除' : 'BAN'}</button>
          </li>
        ))}
        {data.players.length === 0 && <li className="text-slate-400 text-center py-8">プレイヤーがいません</li>}
      </ul>
    </div>
  );
}
