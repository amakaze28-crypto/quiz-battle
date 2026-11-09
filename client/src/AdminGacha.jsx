import { useCallback, useEffect, useState } from 'react';
import { adminApi, SERVER_URL } from './api';
import { fileToImage, Field, Num } from './AdminExtra';
import { RARITY, TYPE_LABEL, itemSrc } from './icons';
import { SOUND_SLOTS, getAudio } from './audio';

const input = 'w-full rounded-lg bg-[#0e1013] border border-white/10 px-3 py-2';
const btn = 'px-3 py-1.5 rounded-lg text-sm';
const card = 'rounded-xl bg-[#171a20] p-4';

const toLocal = (ms) => { if (!ms) return ''; const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const fromLocal = (v) => (v ? new Date(v).getTime() : 0);

// アイテムを選ぶチェックリスト（セット／期間限定ガチャの中身）
function ItemPicker({ items, value, onChange, filter }) {
  const [t, setT] = useState('all');
  const list = items.filter((i) => (!filter || filter(i)) && (t === 'all' || i.type === t));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div>
      <div className="flex gap-1.5 mb-1.5 flex-wrap">
        {['all', ...Object.keys(TYPE_LABEL)].map((k) => (
          <button key={k} type="button" onClick={() => setT(k)} className={`${btn} !py-0.5 ${t === k ? 'bg-sky-600' : 'bg-[#0e1013]'}`}>{k === 'all' ? 'すべて' : TYPE_LABEL[k]}</button>
        ))}
        <span className="text-xs text-slate-400 self-center">選択中 {value.length}</span>
      </div>
      <ul className="max-h-56 overflow-y-auto grid gap-1 sm:grid-cols-2 pr-1">
        {list.map((i) => (
          <li key={i.id}>
            <label className={`flex items-center gap-2 rounded-lg px-2 py-1 cursor-pointer ${value.includes(i.id) ? 'bg-sky-900/60' : 'bg-[#0e1013]'}`}>
              <input type="checkbox" checked={value.includes(i.id)} onChange={() => toggle(i.id)} />
              <img src={itemSrc(i.id)} alt="" className="w-8 h-8 object-contain" />
              <span className="truncate text-sm flex-1">{i.name}</span>
              <span className="text-xs font-bold" style={{ color: RARITY[i.rarity]?.color }}>{RARITY[i.rarity]?.label}</span>
            </label>
          </li>
        ))}
        {list.length === 0 && <li className="text-sm text-slate-400">該当するアイテムがありません</li>}
      </ul>
    </div>
  );
}

function GachaEditor({ user, g, items, sets, onSaved, onCancel }) {
  const isNew = !g.id;
  const normal = g.kind === 'normal';
  const [f, setF] = useState({ ...g, bannerNew: undefined });
  const [msg, setMsg] = useState(null);
  const pickBanner = async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, bannerNew: await fileToImage(file, 'gachabanner') }); };
  const save = async () => {
    const body = {
      name: f.name, cost: f.cost === '' || f.cost === null ? null : Number(f.cost), enabled: f.enabled,
      startAt: f.startAt, endAt: f.endAt, itemIds: f.itemIds, setIds: f.setIds,
      ...(f.bannerNew !== undefined ? { banner: f.bannerNew } : {}),
    };
    try {
      if (isNew) await adminApi(user, '/gachas', { method: 'POST', body: { ...body, banner: f.bannerNew || '' } });
      else await adminApi(user, `/gachas/${g.id}`, { method: 'PUT', body });
      onSaved();
    } catch (e) { setMsg(e.message); }
  };
  const shownBanner = f.bannerNew !== undefined ? f.bannerNew : f.banner ? `${SERVER_URL}${f.banner}` : '';
  return (
    <div className={`${card} space-y-3 border border-sky-500/40`}>
      <p className="font-bold">{isNew ? '期間限定ガチャを追加' : `「${g.name}」を編集`}</p>
      <label className="block text-sm">ガチャ名<input className={input} maxLength={30} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div>
        <p className="text-sm mb-1">バナー画像（ガチャ画面の中央に大きく表示。横長 約1.9:1 がおすすめ）</p>
        <div className="flex items-center gap-3 flex-wrap">
          {shownBanner ? <img src={shownBanner} alt="" className="h-24 rounded object-cover aspect-[1000/535]" /> : <div className="h-24 aspect-[1000/535] rounded bg-slate-700 grid place-items-center text-xs text-slate-300">なし（標準の表示）</div>}
          <input type="file" accept="image/*" onChange={pickBanner} className="text-sm" />
          {shownBanner && <button type="button" onClick={() => setF({ ...f, bannerNew: '' })} className={`${btn} bg-slate-700`}>バナーを外す</button>}
        </div>
      </div>
      <Field label="1回あたりのコイン（空欄＝「設定」タブの共通コスト）">
        <input type="number" min={0} className={`${input} w-28`} value={f.cost ?? ''} onChange={(e) => setF({ ...f, cost: e.target.value === '' ? null : Number(e.target.value) })} />
      </Field>
      {!normal && (
        <>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />開催する（オフなら非表示）</label>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <label>開始（空欄＝すぐ）<input type="datetime-local" className={input} value={toLocal(f.startAt)} onChange={(e) => setF({ ...f, startAt: fromLocal(e.target.value) })} /></label>
            <label>終了（空欄＝期限なし）<input type="datetime-local" className={input} value={toLocal(f.endAt)} onChange={(e) => setF({ ...f, endAt: fromLocal(e.target.value) })} /></label>
          </div>
          <div>
            <p className="text-sm font-bold mb-1">排出するアイテム（レア度は各アイテムの設定・確率は「設定」タブの共通値）</p>
            <ItemPicker items={items} value={f.itemIds} onChange={(v) => setF({ ...f, itemIds: v })} />
          </div>
          <div>
            <p className="text-sm font-bold mb-1">排出するセット（レジェンダリー枠）</p>
            {sets.length === 0 ? <p className="text-sm text-slate-400">セットがまだありません（下の「セット」で作成）</p> : (
              <div className="grid gap-1 sm:grid-cols-2">
                {sets.map((s) => (
                  <label key={s.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm cursor-pointer ${f.setIds.includes(s.id) ? 'bg-sky-900/60' : 'bg-[#0e1013]'}`}>
                    <input type="checkbox" checked={f.setIds.includes(s.id)} onChange={() => setF({ ...f, setIds: f.setIds.includes(s.id) ? f.setIds.filter((x) => x !== s.id) : [...f.setIds, s.id] })} />
                    {s.name}<span className="text-xs text-slate-400">（{s.itemIds.length}点）</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {normal && <p className="text-xs text-slate-400">通常ガチャは、アイテムの「ガチャに入れる」と、セットの「通常ガチャに入れる」が付いたものが出ます。いつでも開催しています。</p>}
      {msg && <p className="text-sm text-red-400">{msg}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={!f.name.trim()} className={`${btn} bg-emerald-500 font-bold disabled:opacity-40`}>保存</button>
        <button onClick={onCancel} className={`${btn} bg-slate-700`}>キャンセル</button>
      </div>
    </div>
  );
}

function SetEditor({ user, s, items, onSaved, onCancel }) {
  const [f, setF] = useState(s);
  const [msg, setMsg] = useState(null);
  const save = async () => {
    try {
      const body = { name: f.name, itemIds: f.itemIds, inGacha: f.inGacha };
      if (f.id) await adminApi(user, `/sets/${f.id}`, { method: 'PUT', body }); else await adminApi(user, '/sets', { method: 'POST', body });
      onSaved();
    } catch (e) { setMsg(e.message); }
  };
  return (
    <div className={`${card} space-y-3 border border-sky-500/40`}>
      <p className="font-bold">{f.id ? 'セットを編集' : 'セットを作成'}（出ると中身がまとめて手に入る・レジェンダリー扱い）</p>
      <label className="block text-sm">セット名<input className={input} maxLength={30} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <ItemPicker items={items} value={f.itemIds} onChange={(v) => setF({ ...f, itemIds: v })} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.inGacha} onChange={(e) => setF({ ...f, inGacha: e.target.checked })} />通常ガチャに入れる</label>
      {msg && <p className="text-sm text-red-400">{msg}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={!f.name.trim() || !f.itemIds.length} className={`${btn} bg-emerald-500 font-bold disabled:opacity-40`}>保存</button>
        <button onClick={onCancel} className={`${btn} bg-slate-700`}>キャンセル</button>
      </div>
    </div>
  );
}

export function GachasAdmin({ user }) {
  const [gachas, setGachas] = useState([]);
  const [sets, setSets] = useState([]);
  const [items, setItems] = useState([]);
  const [eg, setEg] = useState(null);
  const [es, setEs] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([adminApi(user, '/gachas'), adminApi(user, '/sets'), adminApi(user, '/items')]);
      setGachas(a.gachas); setSets(b.sets); setItems(c.items); setErr('');
    } catch (e) { setErr(e.message); }
  }, [user]);
  useEffect(() => { load(); }, [load]);
  const nameOf = new Map(items.map((i) => [i.id, i.name]));
  const now = Date.now();
  const status = (g) => (g.kind === 'normal' ? '常設' : !g.enabled ? '非公開' : g.startAt > now ? '開催前' : g.endAt && g.endAt <= now ? '終了' : '開催中');
  const del = async (path, label) => { if (window.confirm(`${label}を削除します。よろしいですか？`)) { try { await adminApi(user, path, { method: 'DELETE' }); load(); } catch (e) { alert(e.message); } } };
  const blankG = { id: '', kind: 'limited', name: '', banner: '', cost: null, startAt: 0, endAt: 0, enabled: true, itemIds: [], setIds: [] };
  const blankS = { id: '', name: '', itemIds: [], inGacha: true };

  return (
    <div className="space-y-6 max-w-3xl">
      {err && <p className="text-red-400">{err}</p>}
      <section>
        <div className="flex items-center gap-3 mb-2"><h2 className="font-bold">ガチャ</h2>
          <button onClick={() => setEg(blankG)} className={`${btn} bg-sky-600`}>＋ 期間限定ガチャを追加</button></div>
        <ul className="space-y-2">
          {gachas.map((g) => (
            <li key={g.id}>
              {eg?.id === g.id && eg.id ? <GachaEditor user={user} g={eg} items={items} sets={sets} onSaved={() => { setEg(null); load(); }} onCancel={() => setEg(null)} /> : (
                <div className={`${card} !p-3 flex items-center gap-3 flex-wrap`}>
                  {g.banner ? <img src={`${SERVER_URL}${g.banner}`} alt="" className="h-12 rounded aspect-[1000/535] object-cover" /> : <div className="h-12 aspect-[1000/535] rounded bg-slate-700" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{g.name} <span className={`text-xs px-1.5 py-0.5 rounded ${g.kind === 'normal' ? 'bg-slate-600' : 'bg-rose-700'}`}>{g.kind === 'normal' ? '通常' : '期間限定'}</span> <span className="text-xs text-slate-300">{status(g)}</span></p>
                    <p className="text-xs text-slate-400">
                      {g.cost === null ? '共通コスト' : `${g.cost}コイン`}
                      {g.kind === 'limited' && ` ・ ${g.startAt ? new Date(g.startAt).toLocaleString('ja-JP') : '即時'} 〜 ${g.endAt ? new Date(g.endAt).toLocaleString('ja-JP') : '期限なし'}`}
                      {g.kind === 'limited' && ` ・ アイテム${g.itemIds.length}・セット${g.setIds.length}`}
                    </p>
                    {g.kind === 'limited' && g.itemIds.length > 0 && <p className="text-xs text-slate-500 truncate">{g.itemIds.map((x) => nameOf.get(x) || '?').join('、')}</p>}
                  </div>
                  <button onClick={() => setEg(g)} className={`${btn} bg-slate-700`}>編集</button>
                  {g.kind === 'limited' && <button onClick={() => del(`/gachas/${g.id}`, `「${g.name}」`)} className={`${btn} bg-red-800`}>削除</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
        {eg && !eg.id && <div className="mt-2"><GachaEditor user={user} g={eg} items={items} sets={sets} onSaved={() => { setEg(null); load(); }} onCancel={() => setEg(null)} /></div>}
      </section>

      <section>
        <div className="flex items-center gap-3 mb-2"><h2 className="font-bold">セット（キャラ・アイコンなどの一式）</h2>
          <button onClick={() => setEs(blankS)} className={`${btn} bg-sky-600`}>＋ セットを作成</button></div>
        <ul className="space-y-2">
          {sets.map((s) => (
            <li key={s.id}>
              {es?.id === s.id ? <SetEditor user={user} s={es} items={items} onSaved={() => { setEs(null); load(); }} onCancel={() => setEs(null)} /> : (
                <div className={`${card} !p-3 flex items-center gap-3 flex-wrap`}>
                  <div className="flex -space-x-2">{s.itemIds.slice(0, 5).map((id) => <img key={id} src={itemSrc(id)} alt="" className="w-10 h-10 object-contain rounded bg-black/30" />)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{s.name} <span className="text-xs" style={{ color: RARITY.legendary.color }}>レジェンダリー</span></p>
                    <p className="text-xs text-slate-400 truncate">{s.itemIds.map((x) => nameOf.get(x) || '(削除済み)').join('、')}{s.inGacha === false ? ' ・ 通常ガチャには入れない' : ''}</p>
                  </div>
                  <button onClick={() => setEs(s)} className={`${btn} bg-slate-700`}>編集</button>
                  <button onClick={() => del(`/sets/${s.id}`, `セット「${s.name}」`)} className={`${btn} bg-red-800`}>削除</button>
                </div>
              )}
            </li>
          ))}
          {sets.length === 0 && <li className="text-slate-400 text-sm">セットはまだありません</li>}
        </ul>
        {es && !es.id && <div className="mt-2"><SetEditor user={user} s={es} items={items} onSaved={() => { setEs(null); load(); }} onCancel={() => setEs(null)} /></div>}
        <p className="text-xs text-slate-400 mt-2">セットはレジェンダリーの抽選で出ます。出ると中身がまとめて手に入り、すでに持っているものは砂になります。</p>
      </section>
    </div>
  );
}

const readDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

// 音源の追加・差し替え（場面ごと）。差し替えがない場面は同梱の音源が流れる
export function SoundsAdmin({ user }) {
  const [data, setData] = useState({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const load = useCallback(async () => { try { setData((await adminApi(user, '/sounds')).sounds); } catch (e) { setMsg({ ok: false, text: e.message }); } }, [user]);
  useEffect(() => { load(); }, [load]);

  const upload = async (slot, file) => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { setMsg({ ok: false, text: '12MB以下のファイルにしてください' }); return; }
    setBusy(slot); setMsg(null);
    try { await adminApi(user, `/sounds/${slot}`, { method: 'PUT', body: { name: file.name, data: await readDataUrl(file) } }); setMsg({ ok: true, text: '差し替えました（プレイヤーは次回の起動から反映）' }); await load(); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy('');
  };
  const reset = async (slot) => { try { await adminApi(user, `/sounds/${slot}`, { method: 'DELETE' }); load(); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  const play = (slot, kind) => {
    const url = data[slot] ? `${SERVER_URL}/sound/${slot}?v=${data[slot].v}` : kind === 'bgm' ? `/audio/bgm-${slot}.mp3` : `/audio/se-${slot === 'gacha_se' ? 'gacha' : slot}.mp3`;
    const a = new Audio(url); a.volume = getAudio().bgmVol; a.play().catch(() => {}); setTimeout(() => a.pause(), kind === 'bgm' ? 10000 : 4000);
  };
  const row = (slot, label, kind) => (
    <li key={slot} className={`${card} !p-3 flex items-center gap-3 flex-wrap`}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-slate-400 truncate">{data[slot] ? `差し替え中: ${data[slot].name}（${(data[slot].size / 1024 / 1024).toFixed(1)}MB）` : '標準の音源'}</p>
      </div>
      <button onClick={() => play(slot, kind)} className={`${btn} bg-slate-700`}>▶ 試聴</button>
      <label className={`${btn} bg-sky-600 cursor-pointer ${busy === slot ? 'opacity-50' : ''}`}>
        {busy === slot ? 'アップロード中…' : '音源を選ぶ'}
        <input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" className="hidden" disabled={!!busy} onChange={(e) => { upload(slot, e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {data[slot] && <button onClick={() => reset(slot)} className={`${btn} bg-slate-700`}>標準に戻す</button>}
    </li>
  );
  return (
    <div className="max-w-3xl space-y-5">
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
      <p className="text-sm text-slate-300">場面ごとに音源を差し替えられます（mp3推奨・12MBまで）。BGMは自動でループします。</p>
      {[['bgm', 'BGM'], ['se', '効果音']].map(([k, t]) => (
        <section key={k}>
          <h2 className="font-bold mb-2">{t}</h2>
          <ul className="space-y-2">{SOUND_SLOTS.filter((x) => x[2] === k).map(([slot, label]) => row(slot, label, k))}</ul>
        </section>
      ))}
    </div>
  );
}
