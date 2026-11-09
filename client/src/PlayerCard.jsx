import { Box, fs } from './Stage';
import { Avatar } from './Parts';
import RankBadge from './RankBadge';
import { charSrc } from './icons';

export const TIER_LABEL = { rookie: 'ルーキー', bronze: 'ブロンズ', silver: 'シルバー', gold: 'ゴールド', platinum: 'プラチナ', diamond: 'ダイヤ', master: 'マスター', emperor: 'エンペラー' };

// プレイヤーカード（バナー）。/ui/card.jpg（1024x1536）の上に、アイコン・バッジ・キャラ・名前を重ねる。
// c = { displayName, iconId, frameId, charId, badgeId, rank } / 親の幅に合わせて拡大縮小（cqw）
export default function PlayerCard({ c, className = '', onClick }) {
  const badge = c.badgeId === 'none' ? null : (c.badgeId && c.badgeId !== 'auto' ? { key: c.badgeId, label: TIER_LABEL[c.badgeId] } : c.rank);
  const name = c.displayName || '';
  const nameSize = name.length <= 6 ? 34 : name.length <= 9 ? 28 : 22;
  return (
    <div className={`relative w-full overflow-hidden rounded-xl shadow-lg ${className}`} onClick={onClick}
      style={{ aspectRatio: '2 / 3', containerType: 'inline-size', cursor: onClick ? 'pointer' : undefined }}>
      <img src="/ui/card.jpg" alt="" draggable={false} className="absolute inset-0 w-full h-full" />
      {/* キャラ（右の大きな面に下揃え） */}
      <Box x={338} y={30} w={672} h={1490}>
        <img src={charSrc(c.charId)} alt="" draggable={false} className="w-full h-full" style={{ objectFit: 'contain', objectPosition: 'center bottom' }} />
      </Box>
      <Box x={48} y={248} w={234} h={234}><Avatar iconId={c.iconId} frameId={c.frameId} size={0} /></Box>
      <Box x={92} y={548} w={205} h={60} className="flex items-center" style={{ fontSize: fs(nameSize), fontWeight: 800, color: '#fff4d2', textShadow: '0 2px 4px #000', whiteSpace: 'nowrap', overflow: 'hidden' }}>{name}</Box>
      <Box x={100} y={652} w={196} h={60} className="flex items-center" style={{ fontSize: fs(c.rank?.label?.length > 6 ? 24 : 30), fontWeight: 800, color: '#e6ecf7', textShadow: '0 2px 4px #000', whiteSpace: 'nowrap' }}>{c.rank?.label}</Box>
      {badge && <Box x={45} y={770} w={240} h={240}><RankBadge rank={badge} size="fill" showSub={badge === c.rank} /></Box>}
    </div>
  );
}
