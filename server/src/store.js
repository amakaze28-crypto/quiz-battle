import admin from 'firebase-admin';
import { cfg } from './config.js';

const useFirebase = !!process.env.FIREBASE_SERVICE_ACCOUNT;
let db = null;
const mem = new Map(); // 開発モード用 users
const memQ = new Map(); // 開発モード用 questions
let memSeq = 1;

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
  coins: 0, sand: 0, iconId: 'default', frameId: 'none', bannerId: 'none', ownedItems: [...BUILTIN_IDS], charId: 'char-m', badgeId: 'auto', nameChanges: 0, nameSet: false, catStats: {}, wrongQs: [], joinedAt: Date.now(),
  friends: [], incoming: [], outgoing: [], missions: null, mailState: {}, lastLoginAt: 0, lastSeenAt: 0,
  statQ: 0, statCorrect: 0, statAns: 0, statTime: 0, mprog: {},
  badges: [], streak: 0, bestStreak: 0, loginDays: 0, lastLoginDay: '', peakRating: 0, seasonGames: 0,
});

const FILL = { coins: 0, sand: 0, iconId: 'default', frameId: 'none', bannerId: 'none', charId: 'char-m', badgeId: 'auto', ownedItems: ['default'], nameChanges: 0, nameSet: true, catStats: {}, wrongQs: [], friends: [], incoming: [], outgoing: [], missions: null, mailState: {}, joinedAt: 0, lastLoginAt: 0, lastSeenAt: 0, statQ: 0, statCorrect: 0, statAns: 0, statTime: 0, mprog: {}, badges: [], streak: 0, bestStreak: 0, loginDays: 0, lastLoginDay: '', peakRating: 0, seasonGames: 0 };
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

export async function findUserByFriendCode(code) {
  if (useFirebase) {
    const snap = await db.collection('users').where('friendCode', '==', code).limit(1).get();
    return snap.empty ? null : norm({ uid: snap.docs[0].id, ...snap.docs[0].data() });
  }
  const u = [...mem.values()].find((x) => x.friendCode === code);
  return u ? norm(u) : null;
}

export async function getUser(uid) {
  if (useFirebase) {
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? norm({ uid, ...snap.data() }) : null;
  }
  return mem.has(uid) ? norm(mem.get(uid)) : null;
}

export async function getOrCreateUser(uid, name, photoURL, email = '') {
  if (useFirebase) {
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (snap.exists) {
      const u = norm({ uid, ...snap.data() });
      const patch = {};
      if (!u.email && email) { u.email = email; patch.email = email; }
      if (!u.friendCode) { u.friendCode = await uniqueCode(); patch.friendCode = u.friendCode; }
      if (Object.keys(patch).length) await ref.set(patch, { merge: true });
      return u;
    }
    const data = { ...defaults(uid, DEFAULT_NAME, photoURL, email), friendCode: await uniqueCode() };
    const { uid: _u, ...body } = data;
    await ref.set({ ...body, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return data;
  }
  if (!mem.has(uid)) mem.set(uid, { ...defaults(uid, DEFAULT_NAME, photoURL, email), friendCode: await uniqueCode() });
  return norm(mem.get(uid));
}

export async function updateUser(uid, fields) {
  const { uid: _u, ...body } = fields;
  if (useFirebase) await db.collection('users').doc(uid).set(body, { merge: true });
  else mem.set(uid, { ...(mem.get(uid) || {}), ...fields });
}

export async function listUsers(limit = 2000) {
  if (useFirebase) {
    const snap = await db.collection('users').limit(limit).get();
    return snap.docs.map((d) => norm({ uid: d.id, ...d.data() }));
  }
  return [...mem.values()].map((u) => norm(u));
}

export async function getTopMasters(limit = 100) {
  if (useFirebase) {
    // 複合インデックス不要。mrがnullのユーザーは降順の最後に来るので除外する
    const snap = await db.collection('users').orderBy('mr', 'desc').limit(limit).get();
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((u) => u.isMaster && u.mr != null);
  }
  return [...mem.values()].filter((u) => u.isMaster).sort((a, b) => b.mr - a.mr).slice(0, limit);
}

export async function saveMatch(doc) {
  if (useFirebase) await db.collection('matches').add({ ...doc, createdAt: admin.firestore.FieldValue.serverTimestamp() });
}

// ---------- questions ----------
// { id, question, choices[4], answer(0-3), explanation, published, createdAt, updatedAt }
export async function listQuestions() {
  if (useFirebase) {
    const snap = await db.collection('questions').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return [...memQ.values()].map((q) => ({ ...q }));
}

export async function createQuestions(list) {
  const now = Date.now();
  const out = [];
  if (useFirebase) {
    for (let i = 0; i < list.length; i += 400) {
      const batch = db.batch();
      list.slice(i, i + 400).forEach((q) => {
        const ref = db.collection('questions').doc();
        const data = { ...q, createdAt: now, updatedAt: now };
        batch.set(ref, data);
        out.push({ id: ref.id, ...data });
      });
      await batch.commit();
    }
  } else {
    list.forEach((q) => {
      const id = `q${memSeq++}`;
      const data = { id, ...q, createdAt: now, updatedAt: now };
      memQ.set(id, data);
      out.push(data);
    });
  }
  return out;
}

export async function updateQuestion(id, fields) {
  const data = { ...fields, updatedAt: Date.now() };
  if (useFirebase) {
    const ref = db.collection('questions').doc(id);
    if (!(await ref.get()).exists) return false;
    await ref.set(data, { merge: true });
  } else {
    if (!memQ.has(id)) return false;
    memQ.set(id, { ...memQ.get(id), ...data });
  }
  return true;
}

export async function deleteQuestion(id) {
  if (useFirebase) await db.collection('questions').doc(id).delete();
  else memQ.delete(id);
}

// ---------- 汎用コレクション (mails / items / reports / settings) ----------
const memCols = new Map();
const memCol = (n) => { if (!memCols.has(n)) memCols.set(n, new Map()); return memCols.get(n); };

export async function colList(name) {
  if (useFirebase) return (await db.collection(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  return [...memCol(name).values()].map((x) => ({ ...x }));
}
export async function colGet(name, id) {
  if (useFirebase) { const d = await db.collection(name).doc(id).get(); return d.exists ? { id, ...d.data() } : null; }
  const v = memCol(name).get(id);
  return v ? { ...v } : null;
}
export async function colAdd(name, data) {
  if (useFirebase) return (await db.collection(name).add(data)).id;
  const id = `${name[0]}${memSeq++}`;
  memCol(name).set(id, { id, ...data });
  return id;
}
export async function colSet(name, id, data) {
  if (useFirebase) await db.collection(name).doc(id).set(data, { merge: true });
  else memCol(name).set(id, { ...(memCol(name).get(id) || {}), id, ...data });
}
export async function colDel(name, id) {
  if (useFirebase) await db.collection(name).doc(id).delete();
  else memCol(name).delete(id);
}
