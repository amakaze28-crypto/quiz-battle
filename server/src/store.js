import admin from 'firebase-admin';
import crypto from 'crypto';
import { cfg } from './config.js';

const useFirebase = !!process.env.FIREBASE_SERVICE_ACCOUNT;
let db = null;
const mem = new Map(); // 開発モード用 users
let memSeq = 1;

// ---------- 読み取り/書き込み回数の記録（Firestore無料枠の目安。管理画面の設定に表示） ----------
export const stats = { since: Date.now(), reads: 0, writes: 0, by: {} };
const note = (kind, label, n = 1) => {
  const c = Math.max(1, n | 0);
  stats[kind] += c;
  const k = `${kind === 'reads' ? 'r' : 'w'}:${label}`;
  stats.by[k] = (stats.by[k] || 0) + c;
};

// Firestore の set(merge) と同じ動き（オブジェクトは中まで混ぜ、配列は置き換え）
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
function mergeInto(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = isObj(v) && isObj(out[k]) ? mergeInto(out[k], v) : v;
  return out;
}
const clone = (v) => structuredClone(v);

export const isDevMode = () => !useFirebase;

export function initStore() {
  if (useFirebase) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    db = admin.firestore();
    console.log('[store] Firestore を使用します');
  } else {
    if (process.env.NODE_ENV === 'production') throw new Error('本番では FIREBASE_SERVICE_ACCOUNT が必要です');
    console.warn('[store] 開発モード: メモリ保存 / トークンは "dev:名前" を受け付けます（dev:admin は管理者）');
  }
}

export async function verifyToken(token) {
  if (useFirebase) {
    const d = await admin.auth().verifyIdToken(token);
    const email = (d.email || '').toLowerCase();
    return {
      uid: d.uid, name: d.name || 'Player', photoURL: d.picture || '', email,
      isAdmin: !!email && d.email_verified !== false && cfg.adminEmails.includes(email),
    };
  }
  if (typeof token === 'string' && token.startsWith('dev:')) {
    const name = token.slice(4) || 'Dev';
    return { uid: `dev-${name}`, name, photoURL: '', email: `${name}@dev.local`, isAdmin: name === 'admin' };
  }
  throw new Error('invalid token');
}

// ---------- users ----------
// 最初から全員が持っているアイテム（初期アイコン2種・初期キャラ2種）
export const DEFAULT_NAME = '名もなき旅人'; // 新規ユーザーの初期名（初回ログイン時に自分で決める）
export const BUILTIN_IDS = ['default', 'default2', 'char-m', 'char-f'];

const defaults = (uid, name, photoURL, email) => ({
  uid, displayName: name, photoURL, email, pt: 0, mr: null, isMaster: false, wins: 0, losses: 0, games: 0, banned: false,
  coins: 0, sand: 0, iconId: 'default', frameId: 'none', cardId: 'none', bannerId: 'none', ownedItems: [...BUILTIN_IDS], charId: 'char-m', badgeId: 'auto', nameChanges: 0, nameSet: false, catStats: {}, wrongQs: [], joinedAt: Date.now(),
  friends: [], incoming: [], outgoing: [], missions: null, mailState: {}, lastLoginAt: 0, lastSeenAt: 0,
  statQ: 0, statCorrect: 0, statAns: 0, statTime: 0, mprog: {},
  badges: [], streak: 0, bestStreak: 0, loginDays: 0, lastLoginDay: '', peakRating: 0, seasonGames: 0,
});

const FILL = { coins: 0, sand: 0, iconId: 'default', frameId: 'none', cardId: 'none', bannerId: 'none', charId: 'char-m', badgeId: 'auto', ownedItems: ['default'], nameChanges: 0, nameSet: true, catStats: {}, wrongQs: [], friends: [], incoming: [], outgoing: [], missions: null, mailState: {}, joinedAt: 0, lastLoginAt: 0, lastSeenAt: 0, statQ: 0, statCorrect: 0, statAns: 0, statTime: 0, mprog: {}, pity: {}, badges: [], streak: 0, bestStreak: 0, loginDays: 0, lastLoginDay: '', peakRating: 0, seasonGames: 0 };
function norm(u) {
  const o = { ...u };
  for (const [k, v] of Object.entries(FILL)) {
    if (o[k] === undefined) o[k] = Array.isArray(v) ? [...v] : (v && typeof v === 'object' ? { ...v } : v);
  }
  if (Array.isArray(o.ownedIcons)) { // 旧データ(ownedIcons)からの移行
    o.ownedItems = [...new Set([...o.ownedItems, ...o.ownedIcons])];
    delete o.ownedIcons;
  }
  o.ownedItems = [...new Set([...o.ownedItems, ...BUILTIN_IDS])];
  return o;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
async function uniqueCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 8; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!(await findUserByFriendCode(c))) return c;
  }
}

// ユーザーは「見たらメモリに置く」。書き込みは Firestore とメモリの両方へ（単一サーバー前提）。
// 30分触られなければメモリから外し、次に必要になったときだけ読み直す。
const ucache = new Map(); // uid -> { doc, at }
const U_TTL = 30 * 60_000;
const U_MAX = 5000;
const ucGet = (uid) => {
  const e = ucache.get(uid);
  if (!e) return null;
  e.at = Date.now(); ucache.delete(uid); ucache.set(uid, e); // 使った順に並べ直す
  return e.doc;
};
const ucPut = (uid, doc) => {
  const d = { ...doc, uid }; delete d.createdAt; // サーバー時刻型は持たない
  ucache.delete(uid); ucache.set(uid, { doc: d, at: Date.now() });
  while (ucache.size > U_MAX) ucache.delete(ucache.keys().next().value);
};
setInterval(() => {
  const now = Date.now();
  for (const [uid, e] of ucache) if (now - e.at > U_TTL) ucache.delete(uid);
}, 5 * 60_000).unref();

// 管理画面のプレイヤー一覧・bot統計用の一覧キャッシュ（120秒）。書き込みは中身にも反映する
const LIST_TTL = 120_000;
const lcache = new Map(); // limit -> { at, list, byUid }
// ランキング(マスター上位)・エンペラーは、順位に関わる変更があったときだけ、最短55分おきに読み直す（実質1時間更新）
const TOP_MIN_INTERVAL = 55 * 60_000; // 1時間ごとの更新に合わせて、少し短めにしておく
const TOP_MIN_SIZE = 100;
let topC = { at: 0, list: null, size: 0 };
let topDirty = true;
const TOP_APPEAR = ['isMaster', 'displayName', 'iconId', 'frameId', 'cardId', 'badgeId'];

export async function findUserByFriendCode(code) {
  for (const e of ucache.values()) if (e.doc.friendCode === code) return clone(norm(e.doc));
  if (useFirebase) {
    const snap = await db.collection('users').where('friendCode', '==', code).limit(1).get();
    note('reads', 'users', snap.size);
    return snap.empty ? null : norm({ uid: snap.docs[0].id, ...snap.docs[0].data() });
  }
  note('reads', 'users');
  const u = [...mem.values()].find((x) => x.friendCode === code);
  return u ? norm(u) : null;
}

// 削除されたアイテムを装備したままのユーザーは、初期の見た目に戻す（画像が出なくなるのを防ぐ）
const EQUIP = [['iconId', ['default', 'default2'], 'default'], ['frameId', ['none'], 'none'], ['cardId', ['none'], 'none'], ['charId', ['char-m', 'char-f'], 'char-m']];
async function equipFixed(u) {
  const m = await iLoad();
  for (const [k, builtin, dflt] of EQUIP) if (u[k] && !builtin.includes(u[k]) && !m.where.has(u[k])) u[k] = dflt;
  return u;
}

export async function getUser(uid) {
  const hit = ucGet(uid);
  if (hit) return equipFixed(clone(norm(hit)));
  let raw = null;
  if (useFirebase) {
    const snap = await db.collection('users').doc(uid).get();
    raw = snap.exists ? snap.data() : null;
  } else {
    raw = mem.has(uid) ? clone(mem.get(uid)) : null;
  }
  note('reads', 'users');
  if (!raw) return null;
  ucPut(uid, raw);
  return equipFixed(clone(norm(ucache.get(uid).doc)));
}

export async function getOrCreateUser(uid, name, photoURL, email = '') {
  const u = await getUser(uid);
  if (u) {
    const patch = {};
    if (!u.email && email) { u.email = email; patch.email = email; }
    if (useFirebase && !u.friendCode) { u.friendCode = await uniqueCode(); patch.friendCode = u.friendCode; }
    if (Object.keys(patch).length) await updateUser(uid, patch);
    return u;
  }
  const data = { ...defaults(uid, DEFAULT_NAME, photoURL, email), friendCode: await uniqueCode() };
  const { uid: _u, ...body } = data;
  if (useFirebase) await db.collection('users').doc(uid).set({ ...body, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  else mem.set(uid, clone(data));
  note('writes', 'users');
  ucPut(uid, data);
  return clone(norm(data));
}

export async function updateUser(uid, fields) {
  const { uid: _u, ...body } = fields;
  if (useFirebase) await db.collection('users').doc(uid).set(body, { merge: true });
  else mem.set(uid, mergeInto(mem.get(uid) || {}, clone(fields)));
  note('writes', 'users');
  const patch = clone(body);
  const e = ucache.get(uid);
  if (e) e.doc = mergeInto(e.doc, patch);
  for (const c of lcache.values()) { // 一覧キャッシュにも反映（BAN・コイン付与などがすぐ見えるように）
    const row = c.byUid.get(uid);
    if (row) Object.assign(row, mergeInto(row, patch));
  }
  if (patch.mr != null || (topC.list?.some((x) => x.uid === uid) && (('mr' in patch) || TOP_APPEAR.some((k) => k in patch)))) topDirty = true;
}

export async function listUsers(limit = 2000, { fresh = false } = {}) {
  const c = lcache.get(limit);
  if (!fresh && c && Date.now() - c.at < LIST_TTL) return c.list.map((u) => norm(u));
  let list;
  if (useFirebase) {
    const snap = await db.collection('users').limit(limit).get();
    note('reads', 'users-list', snap.size);
    list = snap.docs.map((d) => { const o = { uid: d.id, ...d.data() }; delete o.createdAt; return o; });
  } else {
    note('reads', 'users-list', mem.size);
    list = [...mem.values()].map((u) => clone(u));
  }
  lcache.set(limit, { at: Date.now(), list, byUid: new Map(list.map((u) => [u.uid, u])) });
  return list.map((u) => norm(u));
}
// シーズン切替など、大きな更新の後に呼ぶ（一覧とランキングを次回すぐ読み直す）
export const dropUserLists = () => { lcache.clear(); topC = { at: 0, list: null, size: 0 }; topDirty = true; };

export async function getTopMasters(limit = 100) {
  const want = Math.max(limit, TOP_MIN_SIZE);
  if (!topC.list || topC.size < want || (topDirty && Date.now() - topC.at > TOP_MIN_INTERVAL)) {
    topDirty = false; // 読んでいる途中の変更は次回に反映される
    let list;
    if (useFirebase) {
      // 複合インデックス不要。mrがnullのユーザーは降順の最後に来るので除外する
      const snap = await db.collection('users').orderBy('mr', 'desc').limit(want).get();
      note('reads', 'ranking', snap.size);
      list = snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((u) => u.isMaster && u.mr != null);
    } else {
      note('reads', 'ranking', mem.size);
      list = [...mem.values()].filter((u) => u.isMaster).sort((a, b) => b.mr - a.mr).slice(0, want);
    }
    topC = { at: Date.now(), list, size: want };
  }
  return topC.list.slice(0, limit).map((u) => ({ ...u }));
}

export async function saveMatch(doc) {
  if (useFirebase) { await db.collection('matches').add({ ...doc, createdAt: admin.firestore.FieldValue.serverTimestamp() }); note('writes', 'matches'); }
}

// ---------- questions ----------
// 数百問ずつ1ドキュメント(qbundles)にまとめて保存し、全問題をメモリに持つ。
//  - 起動時の読み取りは「ドキュメント数」だけ（1万問でも約35回）
//  - 一覧・出題はメモリから。編集すると、その問題が入っているドキュメントだけ書き直す
// { id, question, choices[4], answer(0-3), explanation, file, category, published, createdAt, updatedAt }
const QB = 'qbundles';
const Q_PER = 300; // 1ドキュメントあたりの問題数の上限
const Q_BYTES = 900_000; // 1ドキュメントの上限(Firestoreは1MiB)。超えたら半分に分ける
let qmem = null; // { bundles: Map(bid -> question[]), where: Map(qid -> bid) }
let qloading = null;
let qchain = Promise.resolve();
const qlock = (fn) => { const p = qchain.then(fn); qchain = p.catch(() => {}); return p; };
const bidOf = (n) => `b${String(n).padStart(4, '0')}`;

async function qLoad() {
  if (qmem) return qmem;
  if (!qloading) {
    qloading = (async () => {
      const rows = await rawList(QB);
      const meta = rows.some((r) => r.id === '_meta');
      const m = { bundles: new Map(), where: new Map() };
      for (const r of rows.filter((x) => x.id !== '_meta').sort((a, b) => (a.id < b.id ? -1 : 1))) {
        const items = Array.isArray(r.items) ? r.items : [];
        m.bundles.set(r.id, items);
        items.forEach((q) => m.where.set(q.id, r.id));
      }
      if (!meta) { // 旧形式(questionsコレクション)からの引っ越し。旧データはそのまま残す
        const old = (await rawList('questions')).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        for (let i = 0; i < old.length; i += Q_PER) {
          const bid = bidOf(m.bundles.size + 1);
          const items = old.slice(i, i + Q_PER);
          m.bundles.set(bid, items);
          items.forEach((q) => m.where.set(q.id, bid));
          await qWrite(m, bid);
        }
        await rawSet(QB, '_meta', { migratedAt: Date.now(), from: old.length });
        if (old.length) console.log(`[questions] 旧形式の${old.length}問を${m.bundles.size}個のドキュメントにまとめました（旧データは questions コレクションに残っています。不要なら Firebase コンソールで削除できます）`);
      }
      qmem = m;
      return m;
    })().catch((e) => { qloading = null; throw e; });
  }
  return qloading;
}

async function qWrite(m, bid) {
  let items = m.bundles.get(bid) || [];
  if (!items.length) { m.bundles.delete(bid); await rawDel(QB, bid); return; }
  if (items.length > 1 && Buffer.byteLength(JSON.stringify(items)) > Q_BYTES) { // 大きくなりすぎたら後半を新しいドキュメントへ
    const nb = bidOf(Math.max(0, ...[...m.bundles.keys()].map((k) => Number(k.slice(1)))) + 1);
    const half = items.length >> 1;
    const moved = items.slice(half);
    items = items.slice(0, half);
    m.bundles.set(bid, items); m.bundles.set(nb, moved);
    moved.forEach((q) => m.where.set(q.id, nb));
    await qWrite(m, nb);
  }
  await rawSet(QB, bid, { items, n: items.length });
}
const qFlush = async (m, dirty) => { for (const bid of dirty) await qWrite(m, bid); };
const lastBid = (m) => [...m.bundles.keys()].sort().pop();
const newQid = () => crypto.randomBytes(10).toString('hex');

export async function listQuestions() {
  const m = await qLoad();
  return [...m.bundles.values()].flat().map((q) => ({ ...q }));
}

export const createQuestions = (list) => qlock(async () => {
  const m = await qLoad();
  const now = Date.now();
  const out = []; const dirty = new Set();
  for (const q of list) {
    const data = { ...q, id: newQid(), createdAt: now, updatedAt: now };
    let bid = lastBid(m);
    if (!bid || m.bundles.get(bid).length >= Q_PER) { bid = bidOf(bid ? Number(bid.slice(1)) + 1 : 1); m.bundles.set(bid, []); }
    m.bundles.get(bid).push(data); m.where.set(data.id, bid); dirty.add(bid); out.push(data);
  }
  await qFlush(m, dirty);
  return out.map((q) => ({ ...q }));
});

export const updateQuestions = (ids, fields) => qlock(async () => {
  const m = await qLoad();
  const now = Date.now(); const dirty = new Set(); let n = 0;
  for (const id of ids) {
    const bid = m.where.get(id);
    if (!bid) continue;
    const items = m.bundles.get(bid);
    const i = items.findIndex((q) => q.id === id);
    if (i < 0) continue;
    items[i] = { ...items[i], ...fields, updatedAt: now };
    dirty.add(bid); n += 1;
  }
  await qFlush(m, dirty);
  return n;
});
export const updateQuestion = async (id, fields) => (await updateQuestions([id], fields)) > 0;

export const deleteQuestions = (ids) => qlock(async () => {
  const m = await qLoad();
  const gone = new Set(ids); const dirty = new Set();
  for (const id of gone) { const bid = m.where.get(id); if (bid) { dirty.add(bid); m.where.delete(id); } }
  for (const bid of dirty) m.bundles.set(bid, m.bundles.get(bid).filter((q) => !gone.has(q.id)));
  await qFlush(m, dirty);
  return dirty.size;
});
export const deleteQuestion = (id) => deleteQuestions([id]);

// ---------- 汎用コレクション (mails / items / reports / settings ...) ----------
const memCols = new Map();
const memCol = (n) => { if (!memCols.has(n)) memCols.set(n, new Map()); return memCols.get(n); };

async function rawList(name) {
  if (useFirebase) {
    const snap = await db.collection(name).get();
    note('reads', name, snap.size);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  const rows = [...memCol(name).values()].map((x) => clone(x));
  note('reads', name, rows.length);
  return rows;
}
async function rawGet(name, id) {
  note('reads', name);
  if (useFirebase) { const d = await db.collection(name).doc(id).get(); return d.exists ? { id, ...d.data() } : null; }
  const v = memCol(name).get(id);
  return v ? clone(v) : null;
}
async function rawAdd(name, data) {
  note('writes', name);
  if (useFirebase) return (await db.collection(name).add(data)).id;
  const id = `${name[0]}${memSeq++}`;
  memCol(name).set(id, { id, ...clone(data) });
  return id;
}
async function rawSet(name, id, data, replace = false) {
  note('writes', name);
  if (useFirebase) await db.collection(name).doc(id).set(data, replace ? {} : { merge: true });
  else memCol(name).set(id, { ...(replace ? clone(data) : mergeInto(memCol(name).get(id) || {}, clone(data))), id });
}
async function rawDel(name, id) {
  note('writes', name);
  if (useFirebase) await db.collection(name).doc(id).delete();
  else memCol(name).delete(id);
}

// ほとんど変わらないコレクションは、最初に1回だけ全部読んでメモリに置き、
// 書き込みのときだけ Firestore とメモリの両方を更新する（読み取りは再起動のときだけ）
const CACHED = new Set(['sets', 'gachas', 'cardlayouts', 'framefits', 'badgedefs', 'mails', 'sounds']);
const ccache = new Map(); // name -> Map(id -> doc)
const cloading = new Map(); // name -> Promise<Map>
const cstale = new Set(); // 読み込み中に書き込みがあった → 読み込み後に捨てる
async function ccLoad(name) {
  if (ccache.has(name)) return ccache.get(name);
  if (!cloading.has(name)) {
    cloading.set(name, (async () => {
      try {
        const m = new Map((await rawList(name)).map((r) => [r.id, r]));
        if (cstale.delete(name)) return m; // 今回の呼び出しだけに使い、キャッシュは作らない
        ccache.set(name, m);
        return m;
      } finally { cloading.delete(name); }
    })());
  }
  return cloading.get(name);
}
const ccTouch = (name, fn) => {
  const m = ccache.get(name);
  if (m) fn(m);
  else if (cloading.has(name)) cstale.add(name);
};

// ---------- アイテム ----------
// 文字の情報（名前・価格・レア度など）は500件ずつ1ドキュメント(itembundles)にまとめ、全件をメモリに持つ。
// 画像は大きいので1枚ずつ別ドキュメント(itemimages)に置き、見られたときに読んで、メモリに（上限つきで）覚える。
//  - 起動時の読み取りは「ドキュメント数」だけ（アイテム1,000個でも2回）
//  - 画像の読み取りは、再起動後に最初に表示されたときの1回だけ
// ※旧形式の items コレクション（画像つき）は使いません
const IB = 'itembundles';
const II = 'itemimages';
const I_PER = 500;
const IMG_CACHE_CHARS = 40_000_000; // 画像のメモリ上限（文字数≒バイト数）
let imem = null; // { bundles: Map(bid -> meta[]), where: Map(id -> bid) }
let iloading = null;
let ichain = Promise.resolve();
const ilock = (fn) => { const p = ichain.then(fn); ichain = p.catch(() => {}); return p; };
const imgCache = new Map(); let imgChars = 0;
const imgPut = (id, v) => {
  imgDrop(id); imgCache.set(id, v); imgChars += v.length;
  while (imgChars > IMG_CACHE_CHARS && imgCache.size > 1) { const k = imgCache.keys().next().value; imgDrop(k); }
};
const imgDrop = (id) => { if (imgCache.has(id)) { imgChars -= imgCache.get(id).length; imgCache.delete(id); } };

async function iLoad() {
  if (imem) return imem;
  if (!iloading) {
    iloading = (async () => {
      const m = { bundles: new Map(), where: new Map() };
      for (const r of (await rawList(IB)).sort((a, b) => (a.id < b.id ? -1 : 1))) {
        const items = Array.isArray(r.items) ? r.items : [];
        m.bundles.set(r.id, items);
        items.forEach((it) => m.where.set(it.id, r.id));
      }
      imem = m;
      return m;
    })().catch((e) => { iloading = null; throw e; });
  }
  return iloading;
}
async function iWrite(m, bid) {
  const items = m.bundles.get(bid) || [];
  if (!items.length) { m.bundles.delete(bid); await rawDel(IB, bid); return; }
  await rawSet(IB, bid, { items, n: items.length });
}
const metaOf = (m, id) => { const bid = m.where.get(id); return bid ? m.bundles.get(bid).find((x) => x.id === id) : null; };

export async function getItemImage(id) {
  if (imgCache.has(id)) { const v = imgCache.get(id); imgCache.delete(id); imgCache.set(id, v); return v; }
  await iLoad();
  const d = await rawGet(II, id);
  if (!d?.image) return null;
  imgPut(id, d.image);
  return d.image;
}

const itemAdd = (data) => ilock(async () => {
  const m = await iLoad();
  const { image, ...meta } = data;
  const id = crypto.randomBytes(10).toString('hex');
  if (image) { await rawSet(II, id, { image }); imgPut(id, image); }
  let bid = [...m.bundles.keys()].sort().pop();
  if (!bid || m.bundles.get(bid).length >= I_PER) { bid = `b${String(bid ? Number(bid.slice(1)) + 1 : 1).padStart(4, '0')}`; m.bundles.set(bid, []); }
  m.bundles.get(bid).push({ id, ...meta });
  m.where.set(id, bid);
  await iWrite(m, bid);
  return id;
});
const itemSet = (id, data) => ilock(async () => {
  const m = await iLoad();
  const { image, ...meta } = data;
  if (image) { await rawSet(II, id, { image }); imgPut(id, image); }
  if (Object.keys(meta).length) {
    const bid = m.where.get(id);
    if (!bid) return;
    const items = m.bundles.get(bid);
    const i = items.findIndex((x) => x.id === id);
    items[i] = { ...mergeInto(items[i], clone(meta)), id };
    await iWrite(m, bid);
  }
});
const itemDel = (id) => ilock(async () => {
  const m = await iLoad();
  const bid = m.where.get(id);
  if (bid) { m.where.delete(id); m.bundles.set(bid, m.bundles.get(bid).filter((x) => x.id !== id)); await iWrite(m, bid); }
  imgDrop(id);
  await rawDel(II, id);
});

export async function colList(name) {
  if (name === 'items') return [...(await iLoad()).bundles.values()].flat().map((x) => ({ ...x }));
  if (!CACHED.has(name)) return rawList(name);
  return [...(await ccLoad(name)).values()].map((x) => ({ ...x }));
}
export async function colGet(name, id) {
  if (name === 'items') { const v = metaOf(await iLoad(), id); return v ? { ...v } : null; }
  if (!CACHED.has(name)) return rawGet(name, id);
  const v = (await ccLoad(name)).get(id);
  return v ? { ...v } : null;
}
export async function colAdd(name, data) {
  if (name === 'items') return itemAdd(data);
  const id = await rawAdd(name, data);
  if (CACHED.has(name)) ccTouch(name, (m) => m.set(id, { id, ...clone(data) }));
  return id;
}
// replace: true なら、ドキュメントを丸ごと置き換える（古い項目が残らない）
export async function colSet(name, id, data, { replace = false } = {}) {
  if (name === 'items') return itemSet(id, data);
  await rawSet(name, id, data, replace);
  if (CACHED.has(name)) ccTouch(name, (m) => m.set(id, replace ? { ...clone(data), id } : { ...mergeInto(m.get(id) || {}, clone(data)), id }));
}
export async function colDel(name, id) {
  if (name === 'items') return itemDel(id);
  await rawDel(name, id);
  if (CACHED.has(name)) ccTouch(name, (m) => m.delete(id));
}
