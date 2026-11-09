import { SERVER_URL } from './api';
import RankBadge from './RankBadge';

// 獲得バッジの見た目。custom=管理者が登録した画像 / season=シーズン最終ランク（エンペラーは順位つき）
// size: 'fill'（親いっぱい。Stage内）または px 数
export default function BadgeArt({ b, size = 'fill' }) {
  if (!b) return null;
  const fill = size === 'fill';
  const dim = fill ? '100%' : size;
  if (b.kind === 'custom') return <img src={`${SERVER_URL}${b.src}`} alt={b.name} draggable={false} style={{ width: dim, height: dim, objectFit: 'contain' }} />;
  const small = fill ? '3.4cqw' : Math.max(9, size * 0.2);
  return (
    <div className="relative" style={{ width: dim, height: dim }}>
      <RankBadge rank={{ key: b.rankKey, sub: b.sub, label: b.name }} size="fill" showSub={false} />
      <span className="absolute left-1/2 -translate-x-1/2 bottom-0 rounded-md bg-black/75 text-amber-200 font-extrabold leading-tight px-1.5 whitespace-nowrap" style={{ fontSize: small }}>
        S{b.season}{b.place ? ` ${b.place}位` : b.sub ? ` ${b.sub}` : ''}
      </span>
    </div>
  );
}
