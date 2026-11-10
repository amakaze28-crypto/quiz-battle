import { useCallback, useEffect, useState } from 'react';
import { adminApi, SERVER_URL } from './api';
import { Avatar, Coin, Sand, RarityTag } from './Parts';
import { RARITY, RARITIES, TYPE_LABEL } from './icons';
import { ItemViewModal, DraftCardEditor, DraftFrameEditor } from './AdminCards';
import { LAYOUTS } from './PlayerCard';
import { DEFAULT_FIT, loadCardLayouts } from './cardLayout';
import { LoginStats, MaintenanceCard, ReadStatsCard } from './AdminStats';

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

/* ---------------- 問題の通報（問題ごとの集計） ---------------- */
const QLABEL = { difficulty: '難易度がおかしい', irrelevant: '看護に関係ない', wrong: '答えが間違っている' };
export function QuestionReports({ user, onCount }) {
  const { data, error, load } = useAdminLoad(user, '/qreports', 'reports');
  useEffect(() => { if (data) onCount?.(data.filter((r) => r.open > 0).length); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn) => { try { await fn(); load(); } catch (e) { alert(e.message); } };
  const resolve = (r) => act(() => adminApi(user, `/qreports/${r.qid}/resolve`, { method: 'POST', body: { resolved: r.open > 0 } }));
  const hide = (r) => act(() => adminApi(user, `/questions/${r.qid}/publish`, { method: 'POST', body: { published: !r.published } }));
  const del = (r) => { if (window.confirm(`この問題を削除しますか？\n\n${r.question}`)) act(async () => { await adminApi(user, `/questions/${r.qid}`, { method: 'DELETE' }); await adminApi(user, `/qreports/${r.qid}/resolve`, { method: 'POST', body: { resolved: true } }); }); };
  return (
    <div>
      <p className="text-sm text-slate-400 mb-3">プレイヤーからの問題通報です（問題ごとに集計・未対応が上）。修正は「問題」タブの編集から行えます。</p>
      {error && <p className="text-red-400">{error}</p>}
      <ul className="space-y-2">
        {data?.map((r) => (
          <li key={r.qid} className={`${card} ${r.open > 0 ? 'border border-amber-500/50' : 'opacity-50'}`}>
            <div className="flex items-center gap-2 flex-wrap text-xs mb-1">
              <span className="text-sky-300">📁 {r.file}</span>
              <span className={`rounded px-2 py-0.5 ${r.published ? 'bg-emerald-600' : 'bg-slate-600'}`}>{r.published ? '公開中' : '非公開'}</span>
              {Object.entries(r.counts).map(([k, n]) => <span key={k} className="rounded bg-red-600/80 px-2 py-0.5">{QLABEL[k]} ×{n}</span>)}
              <span className="ml-auto text-slate-400">{new Date(r.last).toLocaleString('ja-JP')}</span>
            </div>
            <p className="font-semibold">{r.question}</p>
            <p className="text-sm text-slate-400 mt-1">{r.choices.map((c, i) => <span key={i} className={i === r.answer ? 'text-emerald-400 font-bold mr-3' : 'mr-3'}>{'ABCD'[i]}. {c}</span>)}</p>
            {r.explanation && <p className="text-xs text-slate-500 mt-1">解説: {r.explanation}</p>}
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => resolve(r)} className={`${btn} bg-slate-700`}>{r.open > 0 ? '対応済みにする' : '未対応に戻す'}</button>
              {r.exists && <button onClick={() => hide(r)} className={`${btn} bg-slate-700`}>{r.published ? '非公開にする' : '公開する'}</button>}
              {r.exists && <button onClick={() => del(r)} className={`${btn} bg-red-600/80`}>問題を削除</button>}
            </div>
          </li>
        ))}
        {data?.length === 0 && <li className="text-slate-400 text-center py-8">問題の通報はありません</li>}
      </ul>
    </div>
  );
}

/* ---------------- メール（プレゼント） ---------------- */
export function Delivery({ user }) {
  const { data, load } = useAdminLoad(user, '/mails', 'mails');
  const [f, setF] = useState({ to: 'all', title: '', body: '', coins: 0, sand: 0 });
  const [msg, setMsg] = useState(null);
  const send = async () => {
    try { await adminApi(user, '/mails', { method: 'POST', body: { ...f, to: f.to.trim() || 'all' } }); setMsg({ ok: true, text: '送信しました' }); setF({ ...f, title: '', body: '' }); load(); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const del = async (m) => { if (window.confirm('このメールを削除しますか？（未受け取りのプレゼントも消えます）')) { await adminApi(user, `/mails/${m.id}`, { method: 'DELETE' }); load(); } };

  return (
    <div className="max-w-xl">
      <h2 className="font-bold mb-2">メール（プレゼント）送信</h2>
      <div className={`${card} space-y-2`}>
        <input className={input} placeholder='宛先（全員は "all"、個人はUID）' value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <input className={input} placeholder="タイトル" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <textarea className={input} rows={3} placeholder="本文" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm">コイン<input type="number" min={0} className={`${input} w-24`} value={f.coins} onChange={(e) => setF({ ...f, coins: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm">魔法の砂<input type="number" min={0} className={`${input} w-24`} value={f.sand} onChange={(e) => setF({ ...f, sand: e.target.value })} /></label>
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <button onClick={send} className={`${btn} bg-emerald-500 font-bold`}>送信</button>
      </div>
      <ul className="space-y-2 mt-3">
        {data?.slice(0, 20).map((m) => (
          <li key={m.id} className={`${card} !p-3 flex items-center gap-2`}>
            <div className="min-w-0 flex-1"><p className="font-semibold truncate">{m.title}</p>
              <p className="text-xs text-slate-400">{m.to === 'all' ? '全員' : m.to} ・ {m.coins || 0}コイン ・ 砂{m.sand || 0} ・ {new Date(m.createdAt).toLocaleDateString('ja-JP')}</p></div>
            <button onClick={() => del(m)} className={`${btn} bg-red-600/80`}>削除</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- アイテム（アイコン・フレーム・バナー） ---------------- */
// 種類ごとに画像を整える: アイコン=中央を正方形に切り出し256px / フレーム=透過を保って256px / バナー=4:1に切り出し800x200
export async function fileToImage(file, type) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  if (type === 'gachabanner') { // ガチャのバナー: 1.87:1に切り出し。高画質（最大2000px幅・拡大はしない）。大きすぎる時だけ画質を下げる
    const R = 535 / 1000;
    let sw = bmp.width; let sh = sw * R;
    if (sh > bmp.height) { sh = bmp.height; sw = sh / R; }
    const W = Math.round(Math.min(2000, sw)); const H = Math.round(W * R);
    c.width = W; c.height = H;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, W, H);
    let out = '';
    for (const q of [0.95, 0.9, 0.82, 0.74, 0.66, 0.55]) { out = c.toDataURL('image/webp', q); if (out.length < 4_300_000) break; }
    return out;
  }
  if (type === 'card') { // バナー（カード台紙）: 縦横比を保って最大1024x1536。サイズ上限(約65万文字)に収まるまで画質を下げる
    const k = Math.min(1024 / bmp.width, 1536 / bmp.height, 1);
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    let out = '';
    for (const q of [0.9, 0.82, 0.74, 0.66, 0.56, 0.46]) { out = c.toDataURL('image/webp', q); if (out.length < 650_000) break; }
    return out;
  }
  if (type === 'banner') {
    c.width = 800; c.height = 200;
    const r = Math.min(bmp.width / 4, bmp.height); const sw = r * 4;
    ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - r) / 2, sw, r, 0, 0, 800, 200);
  } else if (type === 'character') { // 全身キャラ: 透過を保って縦長(最大700x1100)に収める
    const k = Math.min(700 / bmp.width, 1100 / bmp.height, 1);
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
  } else if (type === 'frame') {
    c.width = 256; c.height = 256;
    const s = Math.max(bmp.width, bmp.height);
    const w = (bmp.width / s) * 256; const h = (bmp.height / s) * 256;
    ctx.drawImage(bmp, (256 - w) / 2, (256 - h) / 2, w, h);
  } else {
    c.width = 256; c.height = 256;
    const s = Math.min(bmp.width, bmp.height);
    ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 256, 256);
  }
  return c.toDataURL('image/webp', type === 'character' ? 0.8 : 0.9);
}

export function ItemsAdmin({ user }) {
  const { data, error, load } = useAdminLoad(user, '/items', 'items');
  const blank = { name: '', type: 'icon', rarity: 'common', price: 100, onShop: true, inGacha: true, image: '' };
  const [f, setF] = useState(blank);
  const [filter, setFilter] = useState('all');
  const [msg, setMsg] = useState(null);
  const [view, setView] = useState(null);
  const [viewEdit, setViewEdit] = useState(false);
  const [layout, setLayout] = useState({ ...LAYOUTS.A }); // 追加するバナーの配置
  const [fit, setFit] = useState({ ...DEFAULT_FIT });      // 追加するアイコンフレームの位置・大きさ

  const pick = async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, image: await fileToImage(file, f.type) }); };
  const add = async () => {
    try {
      await adminApi(user, '/items', { method: 'POST', body: { ...f, layout: f.type === 'card' ? layout : undefined, fit: f.type === 'frame' ? fit : undefined } });
      setMsg({ ok: true, text: '追加しました' }); setF({ ...blank, type: f.type, rarity: f.rarity }); setLayout({ ...LAYOUTS.A }); setFit({ ...DEFAULT_FIT }); loadCardLayouts(true); load();
    }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const patch = async (i, body) => { try { await adminApi(user, `/items/${i.id}`, { method: 'PUT', body }); load(); } catch (e) { alert(e.message); } };
  const shown = data?.filter((i) => filter === 'all' || i.type === filter);

  return (
    <div>
      <h2 className="font-bold mb-2">アイテムを追加</h2>
      <div className={`${card} space-y-3 mb-5 max-w-xl`}>
        <div className="flex gap-2">
          {Object.entries(TYPE_LABEL).map(([k, label]) => (
            <button key={k} onClick={() => setF({ ...f, type: k, image: '' })} className={`${btn} ${f.type === k ? 'bg-sky-600 font-bold' : 'bg-[#0e1013]'}`}>{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {f.image ? <img src={f.image} alt="" className={f.type === 'banner' ? 'w-40 h-10 rounded object-cover' : f.type === 'character' ? 'h-24 object-contain' : 'w-16 h-16 object-cover ' + (f.type === 'icon' ? 'rounded-full' : '')} /> : <div className="w-16 h-16 rounded bg-slate-700" />}
          <input type="file" accept="image/*" onChange={pick} className="text-sm" />
        </div>
        {f.image && f.type === 'card' && <DraftCardEditor user={user} image={f.image} L={layout} setL={setLayout} />}
        {f.image && f.type === 'frame' && <DraftFrameEditor user={user} image={f.image} F={fit} setF={setFit} />}
        <p className="text-xs text-slate-400">
          {f.type === 'icon' && '中央を正方形に切り出して256pxに縮小します。'}
          {f.type === 'card' && 'バナー（プレイヤーカード全体の台紙・縦長の画像）です。画像を選ぶと、この画面でアイコン等の位置を調整できます（追加後も、一覧の「位置調整」から変更できます）。'}
          {f.type === 'frame' && 'アイコンに重ねる枠です。中央が透明な正方形のPNG／WebPを選んでください（透過は保たれます）。'}
          {f.type === 'character' && '全身の立ち絵（背景透過のPNG/WebP推奨・縦長）。プレイヤーカードに表示されます。'}
          {f.type === 'banner' && '横長(4:1)の画像がおすすめです。800×200に整えます。'}
        </p>
        <input className={input} placeholder="名前" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <div className="flex flex-wrap gap-1.5">
          {RARITIES.map((x) => (
            <button key={x} onClick={() => setF({ ...f, rarity: x })} className={`${btn} font-bold ${f.rarity === x ? 'text-black' : 'bg-[#0e1013]'}`}
              style={{ background: f.rarity === x ? RARITY[x].color : undefined, color: f.rarity === x ? undefined : RARITY[x].color }}>{RARITY[x].label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.onShop} onChange={(e) => setF({ ...f, onShop: e.target.checked })} />ショップで販売</label>
          <label className="flex items-center gap-2">価格(魔法の砂)<input type="number" min={0} className={`${input} w-28`} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.inGacha} onChange={(e) => setF({ ...f, inGacha: e.target.checked })} />ガチャに入れる</label>
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <button onClick={add} disabled={!f.image || !f.name} className={`${btn} bg-emerald-500 font-bold disabled:opacity-40`}>追加</button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <h2 className="font-bold mr-2">登録済み</h2>
        {['all', ...Object.keys(TYPE_LABEL)].map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={`${btn} ${filter === k ? 'bg-sky-600' : 'bg-[#171a20]'}`}>{k === 'all' ? 'すべて' : TYPE_LABEL[k]}</button>
        ))}
      </div>
      {error && <p className="text-red-400">{error}</p>}
      <ul className="space-y-2">
        {shown?.map((i) => (
          <li key={i.id} className={`${card} !p-3 flex flex-wrap items-center gap-3`}>
            <button onClick={() => { setViewEdit(false); setView(i); }} className="flex items-center gap-3 min-w-0 flex-1 text-left" title="タップで見た目を確認">
  {i.type === 'banner' ? <img src={`${SERVER_URL}/item/${i.id}`} alt="" className="w-28 h-7 rounded object-cover" /> : (i.type === 'character' || i.type === 'card') ? <img src={`${SERVER_URL}/item/${i.id}`} alt="" className="h-12 w-10 object-contain" /> : <Avatar iconId={i.type === 'icon' ? i.id : 'default'} frameId={i.type === 'frame' ? i.id : 'none'} size={48} />}
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate flex items-center gap-2">{i.name}<RarityTag rarity={i.rarity} /><span className="text-xs text-slate-400">{TYPE_LABEL[i.type]}</span></div>
              <Sand n={i.price} size={18} className="text-amber-300 text-sm" />
            </div>
            </button>
            <select value={i.rarity} onChange={(e) => patch(i, { rarity: e.target.value })} className="rounded bg-[#0e1013] border border-white/10 px-2 py-1 text-sm">
              {RARITIES.map((x) => <option key={x} value={x}>{RARITY[x].label}</option>)}
            </select>
            <button onClick={() => { const p = window.prompt('新しい価格（魔法の砂）', i.price); if (p !== null) patch(i, { price: Number(p) }); }} className={`${btn} bg-slate-700`}>価格</button>
            <button onClick={() => { const n = window.prompt('新しい名前', i.name); if (n) patch(i, { name: n }); }} className={`${btn} bg-slate-700`}>名前</button>
            {(i.type === 'card' || i.type === 'frame') && <button onClick={() => { setViewEdit(true); setView(i); }} className={`${btn} bg-sky-700 font-bold`}>位置調整</button>}
            <button onClick={() => patch(i, { onShop: !i.onShop })} className={`${btn} ${i.onShop ? 'bg-sky-600' : 'bg-slate-600'}`}>{i.onShop ? '販売中' : '非売'}</button>
            <button onClick={() => patch(i, { inGacha: !i.inGacha })} className={`${btn} ${i.inGacha ? 'bg-purple-600' : 'bg-slate-600'}`}>{i.inGacha ? 'ガチャ内' : 'ガチャ外'}</button>
          </li>
        ))}
        {shown?.length === 0 && <li className="text-slate-400 text-center py-6">アイテムがありません</li>}
      </ul>
      {view && <ItemViewModal key={`${view.id}-${viewEdit}`} user={user} item={view} items={data} startEdit={viewEdit} onClose={() => setView(null)} />}
    </div>
  );
}

/* ---------------- 設定 ---------------- */
const num = (v) => (v === '' ? '' : Number(v));
// 入力部品はコンポーネントの外に置く（中に置くと1文字ごとに作り直され、入力が途切れる）
export const Field = ({ label, children }) => <label className="flex items-center justify-between gap-3 py-1.5"><span>{label}</span>{children}</label>;
export const Num = ({ value, onChange, w = 'w-24', ...rest }) => <input type="number" min={0} className={`${input} ${w}`} value={value} onChange={(e) => onChange(num(e.target.value))} {...rest} />;

export function SettingsAdmin({ user }) {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { adminApi(user, '/settings').then(setS).catch((e) => setMsg({ ok: false, text: e.message })); }, [user]);
  if (!s) return <p>{msg?.text || '読み込み中…'}</p>;

  const save = async () => {
    try { setS(await adminApi(user, '/settings', { method: 'PUT', body: s })); setMsg({ ok: true, text: '保存しました' }); } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const g = s.gacha;
  const setG = (patch) => setS({ ...s, gacha: { ...g, ...patch } });

  // 比率の合計を表示（合計が100でなくても按分されます）
  const sum = (o) => RARITIES.reduce((t, x) => t + Number(o[x] || 0), 0);
  const itemSum = sum(g.itemRarityWeights); const sandSum = sum(g.sandRarityWeights);
  const typeSum = Number(g.typeWeights.item) + Number(g.typeWeights.sand);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <MaintenanceCard user={user} />
      <LoginStats user={user} />
      <ReadStatsCard user={user} />
      <div className={card}>
        <h2 className="font-bold mb-1">ミッション報酬（コイン）</h2>
        {[['login', 'ログインする'], ['play', '5マッチプレイする'], ['win', '3勝する']].map(([k, label]) => (
          <Field key={k} label={label}><Num value={s.missionRewards[k]} onChange={(v) => setS({ ...s, missionRewards: { ...s.missionRewards, [k]: v } })} /></Field>
        ))}
        <h2 className="font-bold mt-3 mb-1">その他</h2>
        <label className="flex items-center justify-between gap-3 py-1.5"><span>マッチング中に待機人数を表示する</span><input type="checkbox" checked={s.showQueueSize !== false} onChange={(ev) => setS({ ...s, showQueueSize: ev.target.checked })} /></label>
        <Field label="改名コスト（2回目以降・コイン）"><Num value={s.renameCost} onChange={(v) => setS({ ...s, renameCost: v })} /></Field>
        <Field label="Secondary(その問題が全員2倍)になる確率 %"><Num value={Math.round(s.secondaryChance * 1000) / 10} step={0.5} max={100} onChange={(v) => setS({ ...s, secondaryChance: v / 100 })} /></Field>
      </div>

      <div className={card}>
        <h2 className="font-bold mb-1">bot（ダイヤ帯まで）</h2>
        <Field label="botとのマッチングを有効にする"><input type="checkbox" checked={s.bots.enabled} onChange={(e) => setS({ ...s, bots: { ...s.bots, enabled: e.target.checked } })} /></Field>
        <Field label="botが加わるまでの待ち時間 最短(秒)"><Num value={s.bots.waitMin} onChange={(v) => setS({ ...s, bots: { ...s.bots, waitMin: v } })} /></Field>
        <Field label="botが加わるまでの待ち時間 最長(秒)"><Num value={s.bots.waitMax} onChange={(v) => setS({ ...s, bots: { ...s.bots, waitMax: v } })} /></Field>
        <p className="text-xs text-slate-400 mt-1">botの正答率・解答秒数は、同じランク帯のプレイヤーの平均（秒数は −1〜＋5秒）から自動で決まります。マスター以上には出ません。</p>
      </div>

      <div className={card}>
        <h2 className="font-bold mb-1">ガチャ</h2>
        <Field label="1回あたりのコイン"><Num value={g.cost} onChange={(v) => setG({ cost: v })} /></Field>
        <p className="text-xs text-slate-400 mt-2">何が出るか（比率。合計が100でなくても按分されます）</p>
        <Field label="アイテム"><Num value={g.typeWeights.item} onChange={(v) => setG({ typeWeights: { ...g.typeWeights, item: v } })} /></Field>
        <Field label="魔法の砂"><Num value={g.typeWeights.sand} onChange={(v) => setG({ typeWeights: { ...g.typeWeights, sand: v } })} /></Field>
        <p className="text-xs text-slate-500">→ アイテム {typeSum ? Math.round((g.typeWeights.item / typeSum) * 1000) / 10 : 0}% / 砂 {typeSum ? Math.round((g.typeWeights.sand / typeSum) * 1000) / 10 : 0}%</p>

        <table className="w-full text-sm mt-4">
          <thead><tr className="text-slate-400 text-left"><th className="pb-1">レア度</th><th>アイテム比率</th><th>砂の比率</th><th>砂の量</th><th>被り時の砂</th></tr></thead>
          <tbody>
            {RARITIES.map((x) => (
              <tr key={x}>
                <td className="py-1 font-bold" style={{ color: RARITY[x].color }}>{RARITY[x].label}</td>
                <td><Num w="w-16" value={g.itemRarityWeights[x]} onChange={(v) => setG({ itemRarityWeights: { ...g.itemRarityWeights, [x]: v } })} /></td>
                <td><Num w="w-16" value={g.sandRarityWeights[x]} onChange={(v) => setG({ sandRarityWeights: { ...g.sandRarityWeights, [x]: v } })} /></td>
                <td><Num w="w-20" value={g.sandAmounts[x]} onChange={(v) => setG({ sandAmounts: { ...g.sandAmounts, [x]: v } })} /></td>
                <td><Num w="w-20" value={g.dupSand[x]} onChange={(v) => setG({ dupSand: { ...g.dupSand, [x]: v } })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-500 mt-1">合計 アイテム{itemSum} / 砂{sandSum}。レア度ごとの実際の確率は、ガチャ画面の「提供割合」で確認できます。</p>
      </div>

      <div className="lg:col-span-2">
        {msg && <p className={`text-sm mb-2 ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <button onClick={save} className={`${btn} bg-emerald-500 font-bold`}>保存</button>
      </div>
    </div>
  );
}

/* ---------------- ウィークリー／スペシャルミッション ---------------- */
// datetime-local(端末の時刻)とミリ秒の相互変換
const toLocal = (ms) => { if (!ms) return ''; const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const fromLocal = (v) => (v ? new Date(v).getTime() : 0);
const TAB_LABEL = { weekly: 'ウィークリー', special: 'スペシャル' };

export function MissionsAdmin({ user }) {
  const { data, error, load } = useAdminLoad(user, '/missions', 'missions');
  const [types, setTypes] = useState({ play: 'マッチをプレイ', win: '勝利する', login: 'ログインする（日数）', correct: '問題に正解する（回数）' });
  useEffect(() => { adminApi(user, '/missions').then((d) => d.types && setTypes(d.types)).catch(() => {}); }, [user]);
  const blank = { tab: 'weekly', title: '', type: 'play', goal: 10, coins: 100, sand: 0, startAt: 0, endAt: 0, enabled: true, order: 0 };
  const [f, setF] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);

  const save = async () => {
    try {
      if (editing) await adminApi(user, `/missions/${editing}`, { method: 'PUT', body: f });
      else await adminApi(user, '/missions', { method: 'POST', body: f });
      setMsg({ ok: true, text: editing ? '更新しました' : '追加しました' }); setF(blank); setEditing(null); load();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const edit = (m) => { setEditing(m.id); setF({ ...blank, ...m }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggle = async (m) => { await adminApi(user, `/missions/${m.id}`, { method: 'PUT', body: { enabled: m.enabled === false } }); load(); };
  const del = async (m) => { if (window.confirm(`「${m.title}」を削除しますか？`)) { await adminApi(user, `/missions/${m.id}`, { method: 'DELETE' }); load(); } };

  const status = (m) => {
    const now = Date.now();
    if (m.enabled === false) return ['無効', 'bg-slate-600'];
    if (m.startAt && now < m.startAt) return ['開始前', 'bg-sky-700'];
    if (m.endAt && now > m.endAt) return ['終了', 'bg-slate-600'];
    return ['開催中', 'bg-emerald-600'];
  };

  return (
    <div>
      <h2 className="font-bold mb-2">{editing ? 'ミッションを編集' : 'ミッションを追加'}</h2>
      <div className={`${card} space-y-3 mb-5 max-w-xl`}>
        <div className="flex gap-2">
          {Object.entries(TAB_LABEL).map(([k, label]) => (
            <button key={k} onClick={() => setF({ ...f, tab: k })} className={`${btn} ${f.tab === k ? 'bg-sky-600 font-bold' : 'bg-[#0e1013]'}`}>{label}</button>
          ))}
        </div>
        <input className={input} placeholder="タイトル（例: 今週10勝しよう）" maxLength={40} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">内容
            <select className={`${input} !w-auto`} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {Object.entries(types).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">目標<input type="number" min={1} className={`${input} w-24`} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">報酬コイン<input type="number" min={0} className={`${input} w-24`} value={f.coins} onChange={(e) => setF({ ...f, coins: e.target.value })} /></label>
          <label className="flex items-center gap-2">魔法の砂<input type="number" min={0} className={`${input} w-24`} value={f.sand} onChange={(e) => setF({ ...f, sand: e.target.value })} /></label>
          <label className="flex items-center gap-2">表示順<input type="number" className={`${input} w-20`} value={f.order} onChange={(e) => setF({ ...f, order: e.target.value })} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">開始<input type="datetime-local" className={`${input} !w-auto`} value={toLocal(f.startAt)} onChange={(e) => setF({ ...f, startAt: fromLocal(e.target.value) })} /></label>
          <label className="flex items-center gap-2">終了<input type="datetime-local" className={`${input} !w-auto`} value={toLocal(f.endAt)} onChange={(e) => setF({ ...f, endAt: fromLocal(e.target.value) })} /></label>
        </div>
        <p className="text-xs text-slate-400">
          ウィークリーは毎週月曜0時（日本時間）に進捗がリセットされます。スペシャルは開始〜終了の期間中の累計で、リセットされません（開始・終了は空欄なら無期限）。
          タブごとに最大5件まで表示されます（表示順の小さい順）。「ログインする」は日数で数えます。
        </p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.enabled !== false} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />有効にする</label>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <div className="flex gap-2">
          <button onClick={save} className={`${btn} bg-emerald-500 font-bold`}>{editing ? '更新' : '追加'}</button>
          {editing && <button onClick={() => { setEditing(null); setF(blank); }} className={`${btn} bg-slate-700`}>キャンセル</button>}
        </div>
      </div>

      <h2 className="font-bold mb-2">登録済み</h2>
      {error && <p className="text-red-400">{error}</p>}
      <ul className="space-y-2">
        {data?.map((m) => {
          const [st, cls] = status(m);
          return (
            <li key={m.id} className={`${card} !p-3 flex flex-wrap items-center gap-3`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate flex items-center gap-2">
                  <span className={`text-xs rounded px-2 py-0.5 ${cls}`}>{st}</span>
                  <span className="text-xs rounded px-2 py-0.5 bg-[#0e1013]">{TAB_LABEL[m.tab]}</span>{m.title}
                </p>
                <p className="text-xs text-slate-400">
                  {types[m.type]} {m.goal} ・ <Coin n={m.coins} size={14} className="inline-flex text-amber-300" /> <Sand n={m.sand} size={16} className="inline-flex text-amber-300" />
                  {m.startAt ? ` ・ ${new Date(m.startAt).toLocaleString('ja-JP')}〜` : ''}{m.endAt ? `${m.startAt ? '' : ' ・ 〜'}${new Date(m.endAt).toLocaleString('ja-JP')}` : ''}
                </p>
              </div>
              <button onClick={() => edit(m)} className={`${btn} bg-slate-700`}>編集</button>
              <button onClick={() => toggle(m)} className={`${btn} ${m.enabled === false ? 'bg-slate-600' : 'bg-sky-600'}`}>{m.enabled === false ? '有効にする' : '無効にする'}</button>
              <button onClick={() => del(m)} className={`${btn} bg-red-600/80`}>削除</button>
            </li>
          );
        })}
        {data?.length === 0 && <li className="text-slate-400 text-center py-6">まだ登録されていません</li>}
      </ul>
    </div>
  );
}
