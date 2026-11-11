import { useCallback, useEffect, useState } from 'react';
import { adminApi, SERVER_URL } from './api';
import { fileToImage, Field, Num } from './AdminExtra';
import { RARITY, RARITIES, TYPE_LABEL, itemSrc } from './icons';
import { SOUND_SLOTS, getAudio } from './audio';

const input = 'w-full rounded-lg bg-[#0e1013] border border-white/10 px-3 py-2';
const btn = 'px-3 py-1.5 rounded-lg text-sm';
const card = 'rounded-xl bg-[#171a20] p-4';

const toLocal = (ms) => { if (!ms) return ''; const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const fromLocal = (v) => (v ? new Date(v).getTime() : 0);

// アイテムを選ぶチェックリスト（セット／期間限定ガチャの中身）
function ItemPicker({ items, value, onChange, filter }) {
  const [t, setT] = useState('all');
  const list = items.filter((i) => i.type !== 'bgm' && (!filter || filter(i)) && (t === 'all' || i.type === t));
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


// ---------- ガチャの確率設定（共通 / ガチャ専用 で同じ画面を使う） ----------
// ① アイテムと砂の比率 ② レア度ごとの確率 ③ 砂の量・被りの砂、を別々に設定する
// サーバーから来た確率設定が古い形式・欠けがあっても画面が落ちないように、足りない項目を既定値で補う
const RATE_DEFAULTS = {
  sandPercent: 30,
  rarityPercent: { common: 50, uncommon: 28, rare: 14, epic: 6, legendary: 2 },
  sandAmounts: { common: 20, uncommon: 50, rare: 100, epic: 300, legendary: 1000 },
  dupSand: { common: 10, uncommon: 50, rare: 100, epic: 500, legendary: 1000 },
};
const normRates = (v) => {
  const src = v && typeof v === 'object' ? v : {};
  const per = (k) => ({ ...RATE_DEFAULTS[k], ...(src[k] && typeof src[k] === 'object' ? src[k] : {}) });
  const oldSand = src.typeWeights && Number(src.typeWeights.item) + Number(src.typeWeights.sand) > 0 ? (Number(src.typeWeights.sand) / (Number(src.typeWeights.item) + Number(src.typeWeights.sand))) * 100 : undefined;
  return { ...src, sandPercent: Number.isFinite(Number(src.sandPercent)) ? Number(src.sandPercent) : (oldSand ?? RATE_DEFAULTS.sandPercent), rarityPercent: { ...RATE_DEFAULTS.rarityPercent, ...(src.itemRarityWeights || {}), ...(src.rarityPercent || {}) }, sandAmounts: per('sandAmounts'), dupSand: per('dupSand') };
};
const pctInput = 'w-20 rounded-lg bg-[#0e1013] border border-white/10 px-2 py-1 text-right';
function GachaRatesEditor({ v: raw, onChange }) {
  const v = normRates(raw);
  const set = (p) => onChange({ ...v, ...p });
  const total = Math.round(RARITIES.reduce((t, x) => t + Number(v.rarityPercent[x] || 0), 0) * 10) / 10;
  const fix = () => { // 合計100%になるように按分し直す（端数は一番大きいレア度に寄せる）
    if (!total) return;
    const next = Object.fromEntries(RARITIES.map((x) => [x, Math.round((Number(v.rarityPercent[x] || 0) / total) * 1000) / 10]));
    const diff = Math.round((100 - RARITIES.reduce((t, x) => t + next[x], 0)) * 10) / 10;
    const big = RARITIES.reduce((m, x) => (next[x] > next[m] ? x : m), RARITIES[0]);
    next[big] = Math.round((next[big] + diff) * 10) / 10;
    set({ rarityPercent: next });
  };
  const sand = Number(v.sandPercent) || 0;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold mb-1">① アイテムと砂の比率</p>
        <div className="flex h-6 rounded overflow-hidden text-xs font-bold text-black">
          <div className="grid place-items-center bg-sky-300" style={{ width: `${100 - sand}%` }}>{100 - sand > 12 ? `アイテム ${Math.round((100 - sand) * 10) / 10}%` : ''}</div>
          <div className="grid place-items-center bg-amber-300" style={{ width: `${sand}%` }}>{sand > 12 ? `砂 ${sand}%` : ''}</div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <input type="range" min={0} max={100} step={1} value={sand} onChange={(e) => set({ sandPercent: Number(e.target.value) })} className="flex-1" />
          <label className="text-sm flex items-center gap-1">砂が出る確率<input type="number" min={0} max={100} step={0.5} className={pctInput} value={sand} onChange={(e) => set({ sandPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />%</label>
        </div>
        <p className="text-xs text-slate-400 mt-1">1回引いたとき「砂」が出る確率です。残りがアイテム（アイテムが1つも入っていないときは全部砂になります）。</p>
      </div>
      <div>
        <p className="text-sm font-bold mb-1">② レア度ごとの出る確率</p>
        <ul className="space-y-1.5">
          {RARITIES.map((x) => (
            <li key={x} className="flex items-center gap-2">
              <span className="w-24 text-sm font-bold" style={{ color: RARITY[x].color }}>{RARITY[x].label}</span>
              <div className="flex-1 h-3 rounded bg-slate-700 overflow-hidden"><div className="h-full" style={{ width: `${Math.min(100, Number(v.rarityPercent[x]) || 0)}%`, background: RARITY[x].color }} /></div>
              <input type="number" min={0} max={100} step={0.1} className={pctInput} value={v.rarityPercent[x]} onChange={(e) => set({ rarityPercent: { ...v.rarityPercent, [x]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } })} /><span className="text-sm">%</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className={`text-sm font-bold ${total === 100 ? 'text-emerald-400' : 'text-amber-300'}`}>合計 {total}%</span>
          {total !== 100 && <button type="button" onClick={fix} className={`${btn} bg-slate-700`}>合計を100%に調整</button>}
        </div>
        <p className="text-xs text-slate-400 mt-1">アイテムも砂も、この確率でレア度が決まります（合計が100%でなくても、割合で按分されます）。そのレア度のアイテムがガチャに入っていないときは、入っているレア度の中で按分し直します。</p>
      </div>
      <div>
        <p className="text-sm font-bold mb-1">③ 砂の量</p>
        <table className="w-full text-sm">
          <thead><tr className="text-slate-400 text-left"><th className="pb-1 font-normal">レア度</th><th className="font-normal">砂が出たときの量</th><th className="font-normal">アイテムが被ったときの砂</th></tr></thead>
          <tbody>
            {RARITIES.map((x) => (
              <tr key={x}>
                <td className="py-0.5 font-bold" style={{ color: RARITY[x].color }}>{RARITY[x].label}</td>
                <td><input type="number" min={0} className={pctInput} value={v.sandAmounts[x]} onChange={(e) => set({ sandAmounts: { ...v.sandAmounts, [x]: Math.max(0, Math.round(Number(e.target.value) || 0)) } })} /></td>
                <td><input type="number" min={0} className={pctInput} value={v.dupSand[x]} onChange={(e) => set({ dupSand: { ...v.dupSand, [x]: Math.max(0, Math.round(Number(e.target.value) || 0)) } })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-400 mt-1">「砂が出たときの量」は、①で砂が出たとき、②で決まったレア度ぶんの量です。「被ったとき」は、持っているアイテムがもう一度出たときにもらえる砂です。</p>
      </div>
    </div>
  );
}

// 共通の確率設定（ガチャ専用の設定がないガチャは、これを使う）
function CommonRatesCard({ user, gs, onSaved }) {
  const [v, setV] = useState(gs);
  const [msg, setMsg] = useState(null);
  useEffect(() => { setV(gs); }, [gs]);
  const save = async () => {
    try { await adminApi(user, '/settings', { method: 'PUT', body: { gacha: v } }); setMsg({ ok: true, text: '保存しました' }); onSaved(); } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  return (
    <section className={`${card} space-y-3`}>
      <h2 className="font-bold">共通の確率設定</h2>
      <p className="text-xs text-slate-400">「専用の確率」にしていないガチャは、すべてここの設定で動きます。</p>
      <Field label="1回あたりのコイン（共通）"><Num value={v.cost} onChange={(c) => setV({ ...v, cost: c })} /></Field>
      <GachaRatesEditor v={v} onChange={setV} />
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
      <button onClick={save} className={`${btn} bg-emerald-500 font-bold`}>保存</button>
    </section>
  );
}

function GachaEditor({ user, g, items, sets, common, onSaved, onCancel }) {
  const isNew = !g.id;
  const normal = g.kind === 'normal';
  const [f, setF] = useState({ ...g, bannerNew: undefined });
  const [msg, setMsg] = useState(null);
  const pickBanner = async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, bannerNew: await fileToImage(file, 'gachabanner') }); };
  const save = async () => {
    const body = {
      name: f.name, cost: f.cost === '' || f.cost === null ? null : Number(f.cost), enabled: f.enabled,
      startAt: f.startAt, endAt: f.endAt, itemIds: f.itemIds, setIds: f.setIds,
      rates: f.rates || null,
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
        <p className="text-sm mb-1">バナー画像（ガチャ画面の中央に大きく表示。横長 約1.9:1 がおすすめ。高画質のまま保存されます）</p>
        <div className="flex items-center gap-3 flex-wrap">
          {shownBanner ? <img src={shownBanner} alt="" className="h-24 rounded object-cover aspect-[1000/535]" /> : <div className="h-24 aspect-[1000/535] rounded bg-slate-700 grid place-items-center text-xs text-slate-300">なし（標準の表示）</div>}
          <input type="file" accept="image/*" onChange={pickBanner} className="text-sm" />
          {shownBanner && <button type="button" onClick={() => setF({ ...f, bannerNew: '' })} className={`${btn} bg-slate-700`}>バナーを外す</button>}
        </div>
      </div>
      <Field label="1回あたりのコイン（空欄＝下の「共通の確率設定」のコスト）">
        <input type="number" min={0} className={`${input} w-28`} value={f.cost ?? ''} onChange={(e) => setF({ ...f, cost: e.target.value === '' ? null : Number(e.target.value) })} />
      </Field>
      <div className="rounded-lg bg-black/20 p-3">
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={!!f.rates} onChange={(e) => setF({ ...f, rates: e.target.checked ? structuredClone((({ cost, ...r }) => r)(normRates(common))) : null })} />このガチャ専用の確率にする（オフ＝共通の確率設定を使う）</label>
        {f.rates && <div className="mt-3"><GachaRatesEditor v={f.rates} onChange={(r) => setF({ ...f, rates: r })} /></div>}
      </div>
      {!normal && (
        <>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />開催する（オフなら非表示）</label>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <label>開始（空欄＝すぐ）<input type="datetime-local" className={input} value={toLocal(f.startAt)} onChange={(e) => setF({ ...f, startAt: fromLocal(e.target.value) })} /></label>
            <label>終了（空欄＝期限なし）<input type="datetime-local" className={input} value={toLocal(f.endAt)} onChange={(e) => setF({ ...f, endAt: fromLocal(e.target.value) })} /></label>
          </div>
          <div>
            <p className="text-sm font-bold mb-1">排出するアイテム（レア度は各アイテムの設定。確率は上の設定）</p>
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
  const [common, setCommon] = useState(null);
  const load = useCallback(async () => {
    try {
      const [a, b, c, d] = await Promise.all([adminApi(user, '/gachas'), adminApi(user, '/sets'), adminApi(user, '/items'), adminApi(user, '/settings')]);
      setCommon(normRates(d.gacha));
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
      {common && <CommonRatesCard user={user} gs={common} onSaved={load} />}
      <section>
        <div className="flex items-center gap-3 mb-2"><h2 className="font-bold">ガチャ</h2>
          <button onClick={() => setEg(blankG)} className={`${btn} bg-sky-600`}>＋ 期間限定ガチャを追加</button></div>
        <ul className="space-y-2">
          {gachas.map((g) => (
            <li key={g.id}>
              {eg?.id === g.id && eg.id ? <GachaEditor user={user} g={eg} items={items} sets={sets} common={common} onSaved={() => { setEg(null); load(); }} onCancel={() => setEg(null)} /> : (
                <div className={`${card} !p-3 flex items-center gap-3 flex-wrap`}>
                  {g.banner ? <img src={`${SERVER_URL}${g.banner}`} alt="" className="h-12 rounded aspect-[1000/535] object-cover" /> : <div className="h-12 aspect-[1000/535] rounded bg-slate-700" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{g.name} <span className={`text-xs px-1.5 py-0.5 rounded ${g.kind === 'normal' ? 'bg-slate-600' : 'bg-rose-700'}`}>{g.kind === 'normal' ? '通常' : '期間限定'}</span> <span className="text-xs text-slate-300">{status(g)}</span></p>
                    <p className="text-xs text-slate-400">
                      {g.cost === null ? '共通コスト' : `${g.cost}コイン`}{g.rates ? ' ・ 専用の確率' : ''}
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
        {eg && !eg.id && <div className="mt-2"><GachaEditor user={user} g={eg} items={items} sets={sets} common={common} onSaved={() => { setEg(null); load(); }} onCancel={() => setEg(null)} /></div>}
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

let cur = null; let curTimer = null; // 試聴中のAudio（1つだけ）
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
  const [playing, setPlaying] = useState('');
  const stopAll = () => { if (cur) { cur.pause(); cur.src = ''; cur = null; } clearTimeout(curTimer); };
  useEffect(() => stopAll, []); // 画面を離れたら止める
  // 試聴は常に1つだけ。別の曲を試聴したら前の試聴は止まる（同じ曲をもう一度押すと停止）
  const play = (slot, kind) => {
    const was = playing === slot;
    stopAll(); setPlaying('');
    if (was) return;
    const url = data[slot] ? `${SERVER_URL}/sound/${slot}?v=${data[slot].v}` : kind === 'bgm' ? `/audio/bgm-${slot}.mp3` : `/audio/se-${slot === 'gacha_se' ? 'gacha' : slot}.mp3`;
    const a = new Audio(url); a.volume = Math.min(1, kind === 'bgm' ? getAudio().bgmVol : getAudio().seVol);
    a.onended = () => { if (cur === a) { cur = null; setPlaying(''); } };
    cur = a; setPlaying(slot);
    a.play().catch(() => { setPlaying(''); });
    curTimer = setTimeout(() => { if (cur === a) { stopAll(); setPlaying(''); } }, kind === 'bgm' ? 15000 : 6000);
  };
  const row = (slot, label, kind) => (
    <li key={slot} className={`${card} !p-3 flex items-center gap-3 flex-wrap`}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-slate-400 truncate">{data[slot] ? `差し替え中: ${data[slot].name}（${(data[slot].size / 1024 / 1024).toFixed(1)}MB）` : '標準の音源'}</p>
      </div>
      <button onClick={() => play(slot, kind)} className={`${btn} bg-slate-700`}>{playing === slot ? '■ 停止' : '▶ 試聴'}</button>
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
      <BattleTracksAdmin user={user} />
      {[['bgm', 'BGM'], ['se', '効果音']].map(([k, t]) => (
        <section key={k}>
          <h2 className="font-bold mb-2">{t}</h2>
          <ul className="space-y-2">{SOUND_SLOTS.filter((x) => x[2] === k).map(([slot, label]) => row(slot, label, k))}</ul>
        </section>
      ))}
    </div>
  );
}

// 戦闘曲の追加。「みんなが使える」曲は全員の選択肢とランダムの候補に入り、「ショップで販売」の曲は買った人だけが使える
function BattleTracksAdmin({ user }) {
  const [list, setList] = useState([]);
  const blank = { name: '', mode: 'free', price: 500, rarity: 'common', file: null };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [playing, setPlaying] = useState('');
  const load = useCallback(async () => {
    try { setList((await adminApi(user, '/items')).items.filter((i) => i.type === 'bgm').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))); } catch (e) { setMsg({ ok: false, text: e.message }); }
  }, [user]);
  useEffect(() => { load(); }, [load]);
  const stop = () => { if (cur) { cur.pause(); cur.src = ''; cur = null; } clearTimeout(curTimer); setPlaying(''); };
  useEffect(() => () => { if (cur) { cur.pause(); cur = null; } clearTimeout(curTimer); }, []);
  const play = (i) => {
    const was = playing === i.id; stop(); if (was) return;
    const a = new Audio(`${SERVER_URL}/sound/bgm_${i.id}?t=${Date.now()}`); a.volume = Math.min(1, getAudio().bgmVol);
    a.onended = () => { if (cur === a) stop(); };
    cur = a; setPlaying(i.id); a.play().catch(() => setPlaying(''));
    curTimer = setTimeout(() => { if (cur === a) stop(); }, 15000);
  };
  const add = async () => {
    if (!f.file || !f.name.trim()) return;
    if (f.file.size > 12 * 1024 * 1024) { setMsg({ ok: false, text: '12MB以下のファイルにしてください' }); return; }
    setBusy(true); setMsg(null);
    try {
      await adminApi(user, '/items', { method: 'POST', body: { type: 'bgm', name: f.name, rarity: f.rarity, price: f.mode === 'shop' ? f.price : 0, free: f.mode === 'free', onShop: f.mode === 'shop', audio: await readDataUrl(f.file), audioName: f.file.name } });
      setMsg({ ok: true, text: '追加しました' }); setF(blank); await load();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const patch = async (i, body) => { try { await adminApi(user, `/items/${i.id}`, { method: 'PUT', body }); load(); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  const del = async (i) => { if (!window.confirm(`「${i.name}」を削除しますか？（買ったプレイヤーも使えなくなります）`)) return; try { await adminApi(user, `/items/${i.id}`, { method: 'DELETE' }); load(); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  const replace = async (i, file) => {
    if (!file) return;
    try { await adminApi(user, `/items/${i.id}`, { method: 'PUT', body: { audio: await readDataUrl(file), audioName: file.name } }); setMsg({ ok: true, text: '音源を差し替えました' }); } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  return (
    <section>
      <h2 className="font-bold mb-2">戦闘曲の追加</h2>
      <div className={`${card} space-y-3 mb-3`}>
        <input className={input} placeholder="曲名" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" className="text-sm" onChange={(e) => setF({ ...f, file: e.target.files?.[0] || null })} />
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={f.mode === 'free'} onChange={() => setF({ ...f, mode: 'free' })} />みんなが使える（無料）</label>
          <label className="flex items-center gap-2"><input type="radio" checked={f.mode === 'shop'} onChange={() => setF({ ...f, mode: 'shop' })} />ショップで販売</label>
          {f.mode === 'shop' && <label className="flex items-center gap-2">価格(砂)<input type="number" min={0} className={`${input} w-24`} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>}
        </div>
        {f.mode === 'shop' && (
          <div className="flex flex-wrap gap-1.5">
            {RARITIES.map((x) => (
              <button key={x} onClick={() => setF({ ...f, rarity: x })} className={`${btn} font-bold ${f.rarity === x ? 'text-black' : 'bg-[#0e1013]'}`} style={{ background: f.rarity === x ? RARITY[x].color : undefined, color: f.rarity === x ? undefined : RARITY[x].color }}>{RARITY[x].label}</button>
            ))}
          </div>
        )}
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <button onClick={add} disabled={busy || !f.file || !f.name.trim()} className={`${btn} bg-emerald-500 font-bold disabled:opacity-40`}>{busy ? 'アップロード中…' : '追加'}</button>
      </div>
      <ul className="space-y-2">
        {list.map((i) => (
          <li key={i.id} className={`${card} !p-3 flex items-center gap-3 flex-wrap`}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{i.name}</p>
              <p className="text-xs text-slate-400">{i.free ? 'みんなが使える' : i.onShop ? `ショップ販売 ${i.price}砂 ・${RARITY[i.rarity]?.label}` : '非売'}</p>
            </div>
            <button onClick={() => play(i)} className={`${btn} bg-slate-700`}>{playing === i.id ? '■ 停止' : '▶ 試聴'}</button>
            <button onClick={() => patch(i, i.free ? { free: false, onShop: true } : { free: true })} className={`${btn} ${i.free ? 'bg-emerald-600' : 'bg-slate-600'}`}>{i.free ? '無料公開中' : '無料にする'}</button>
            {!i.free && <button onClick={() => patch(i, { onShop: !i.onShop })} className={`${btn} ${i.onShop ? 'bg-sky-600' : 'bg-slate-600'}`}>{i.onShop ? '販売中' : '非売'}</button>}
            {!i.free && <button onClick={() => { const p = window.prompt('新しい価格（魔法の砂）', i.price); if (p !== null) patch(i, { price: Number(p) }); }} className={`${btn} bg-slate-700`}>価格</button>}
            <label className={`${btn} bg-sky-700 cursor-pointer`}>音源を差し替え<input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" className="hidden" onChange={(e) => { replace(i, e.target.files?.[0]); e.target.value = ''; }} /></label>
            <button onClick={() => del(i)} className={`${btn} bg-red-700`}>削除</button>
          </li>
        ))}
        {list.length === 0 && <li className="text-slate-400 text-sm">追加した戦闘曲はありません（同梱の3曲はいつでも使えます）</li>}
      </ul>
    </section>
  );
}
