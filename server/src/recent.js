// 通報の検証用: 直近に同じ部屋で対戦した相手のみ通報できる（2時間有効）
const byUid = new Map();
const TTL = 2 * 3600 * 1000;

export function registerRoom(roomId, players) {
  const at = Date.now();
  for (const p of players) {
    byUid.set(p.uid, { roomId, at, players: players.map((x) => ({ uid: x.uid, name: x.name })), reported: new Set() });
  }
}

export function getRecent(uid) {
  const r = byUid.get(uid);
  if (!r) return null;
  if (Date.now() - r.at > TTL) { byUid.delete(uid); return null; }
  return r;
}
