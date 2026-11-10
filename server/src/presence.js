// オンライン状態（接続中のソケット数をユーザーごとに管理）
const online = new Map();
export const add = (uid) => { online.set(uid, (online.get(uid) || 0) + 1); return online.get(uid); };
export const remove = (uid) => {
  const n = (online.get(uid) || 1) - 1;
  if (n <= 0) online.delete(uid); else online.set(uid, n);
  return n;
};
export const count = () => online.size;
export const isOnline = (uid) => online.has(uid);
