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
const defaults = (uid, name, photoURL, email) => ({
  uid, displayName: name, photoURL, email, pt: 0, mr: null, isMaster: false, wins: 0, losses: 0, games: 0, banned: false,
});

export async function getOrCreateUser(uid, name, photoURL, email = '') {
  if (useFirebase) {
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (snap.exists) {
      const u = { uid, ...snap.data() };
      if (!u.email && email) { u.email = email; await ref.set({ email }, { merge: true }); }
      return u;
    }
    const data = defaults(uid, name, photoURL, email);
    const { uid: _u, ...body } = data;
    await ref.set({ ...body, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return data;
  }
  if (!mem.has(uid)) mem.set(uid, defaults(uid, name, photoURL, email));
  return { ...mem.get(uid) };
}

export async function updateUser(uid, fields) {
  const { uid: _u, ...body } = fields;
  if (useFirebase) await db.collection('users').doc(uid).set(body, { merge: true });
  else mem.set(uid, { ...(mem.get(uid) || {}), ...fields });
}

export async function listUsers(limit = 2000) {
  if (useFirebase) {
    const snap = await db.collection('users').limit(limit).get();
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  }
  return [...mem.values()].map((u) => ({ ...u }));
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
