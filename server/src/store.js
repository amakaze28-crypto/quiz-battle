import admin from 'firebase-admin';

const useFirebase = !!process.env.FIREBASE_SERVICE_ACCOUNT;
let db = null;
const mem = new Map(); // 開発モード用

export const isDevMode = () => !useFirebase;

export function initStore() {
  if (useFirebase) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    db = admin.firestore();
    console.log('[store] Firestore を使用します');
  } else {
    if (process.env.NODE_ENV === 'production') throw new Error('本番では FIREBASE_SERVICE_ACCOUNT が必要です');
    console.warn('[store] 開発モード: メモリ保存 / トークンは "dev:名前" を受け付けます');
  }
}

export async function verifyToken(token) {
  if (useFirebase) {
    const d = await admin.auth().verifyIdToken(token);
    return { uid: d.uid, name: d.name || 'Player', photoURL: d.picture || '' };
  }
  if (typeof token === 'string' && token.startsWith('dev:')) {
    const name = token.slice(4) || 'Dev';
    return { uid: `dev-${name}`, name, photoURL: '' };
  }
  throw new Error('invalid token');
}

const defaults = (uid, name, photoURL) => ({
  uid, displayName: name, photoURL, pt: 0, mr: null, isMaster: false, wins: 0, losses: 0, games: 0,
});

export async function getOrCreateUser(uid, name, photoURL) {
  if (useFirebase) {
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (snap.exists) return { uid, ...snap.data() };
    const data = defaults(uid, name, photoURL);
    const { uid: _u, ...body } = data;
    await ref.set({ ...body, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return data;
  }
  if (!mem.has(uid)) mem.set(uid, defaults(uid, name, photoURL));
  return { ...mem.get(uid) };
}

export async function updateUser(uid, fields) {
  const { uid: _u, ...body } = fields;
  if (useFirebase) await db.collection('users').doc(uid).set(body, { merge: true });
  else mem.set(uid, { ...(mem.get(uid) || {}), ...fields });
}

export async function saveMatch(doc) {
  if (useFirebase) await db.collection('matches').add({ ...doc, createdAt: admin.firestore.FieldValue.serverTimestamp() });
}

export async function getTopMasters(limit = 100) {
  if (useFirebase) {
    // 複合インデックス不要。mrがnullのユーザーは降順の最後に来るので除外する
    const snap = await db.collection('users').orderBy('mr', 'desc').limit(limit).get();
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((u) => u.isMaster && u.mr != null);
  }
  return [...mem.values()].filter((u) => u.isMaster).sort((a, b) => b.mr - a.mr).slice(0, limit);
}
