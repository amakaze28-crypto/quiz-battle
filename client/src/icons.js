import { SERVER_URL } from './api';

// 初期アイコンは同梱画像、ショップのアイコンはサーバーから配信
export const iconSrc = (id) => (!id || id === 'default' ? '/icons/default.png' : `${SERVER_URL}/icon/${id}`);

export function ago(ts) {
  if (!ts) return 'なし';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'たった今';
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  return `${Math.floor(s / 86400)}日前`;
}
