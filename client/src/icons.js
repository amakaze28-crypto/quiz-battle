import { SERVER_URL } from './api';

// 初期アイコンは同梱画像、それ以外(アイコン・フレーム・バナー)はサーバーから配信
export const itemSrc = (id) => `${SERVER_URL}/item/${id}`;
export const iconSrc = (id) => (!id || id === 'default' ? '/icons/default.png' : id === 'default2' ? '/icons/default2.png' : itemSrc(id));
// 全身キャラ: 初期2種は同梱画像
export const charSrc = (id) => (!id || id === 'char-m' ? '/chars/m.webp' : id === 'char-f' ? '/chars/f.webp' : itemSrc(id));

export const RARITY = {
  common: { label: 'コモン', color: '#9ca3af' },
  uncommon: { label: 'アンコモン', color: '#4ade80' },
  rare: { label: 'レア', color: '#60a5fa' },
  epic: { label: 'エピック', color: '#c084fc' },
  legendary: { label: 'レジェンダリー', color: '#fbbf24' },
};
export const RARITIES = Object.keys(RARITY);
export const TYPE_LABEL = { icon: 'アイコン', frame: 'アイコンフレーム', card: 'カードフレーム', banner: 'バナー', character: 'キャラ' };

export function ago(ts) {
  if (!ts) return 'なし';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'たった今';
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  return `${Math.floor(s / 86400)}日前`;
}
