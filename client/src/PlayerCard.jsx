import { Box, fs } from './Stage';
import { Avatar } from './Parts';
import RankBadge from './RankBadge';
import BadgeArt from './Badge';
import { charSrc, itemSrc } from './icons';

export const TIER_LABEL = { rookie: 'ルーキー', bronze: 'ブロンズ', silver: 'シルバー', gold: 'ゴールド', platinum: 'プラチナ', diamond: 'ダイヤ', master: 'マスター', emperor: 'エンペラー' };

// カードフレーム画像ごとの配置（幅・高さに対する割合）。id の接頭辞(cardA/B/C/D)で選ぶ
// aspect=幅/高さ, cx,cy=アイコン円の中心, d=円の直径(幅比), p1,p2=名前/ランク板の中心(高さ比), pl=板の左端, panel=左パネル右端, ph=板の高さ(高さ比), by=バッジ中心y
const LAYOUTS = {
  A: { aspect: 0.592, cx: 0.214, cy: 0.26, d: 0.324, p1: 0.407, p2: 0.497, pl: 0.04, panel: 0.41, ph: 0.065, by: 0.72 },
  B: { aspect: 0.5, cx: 0.215, cy: 0.228, d: 0.33, p1: 0.357, p2: 0.44, pl: 0.04, panel: 0.415, ph: 0.058, by: 0.70 },
  C: { aspect: 0.57, cx: 0.246, cy: 0.257, d: 0.371, p1: 0.42, p2: 0.497, pl: 0.066, panel: 0.44, ph: 0.068, by: 0.80 },
  D: { aspect: 0.541, cx: 0.208, cy: 0.243, d: 0.30, p1: 0.338, p2: 0.393, pl: 0.042, panel: 0.393, ph: 0.048, by: 0.715 },
};
export const layoutOf = (id) => {
  const m = /^card([ABCD])-(\d+)/.exec(id || '');
  if (!m) return LAYOUTS.A;
  return m[1] === 'A' && Number(m[2]) > 40 ? LAYOUTS.B : LAYOUTS[m[1]];
};

const pc = (v) => `${(v * 100).toFixed(3)}%`;

// アイテムのカードフレームを使う描画
function FramedCard({ c, className, onClick, L, name, earned, badge }) {
  const nameLen = name.length;
  const textW = Math.max(0.2, L.panel - L.pl - 0.05);
  const plateHcq = (L.ph / L.aspect) * 100; // 板の高さ(cqw)
  const nameFs = plateHcq * 0.52 * (nameLen <= 6 ? 1 : nameLen <= 9 ? 0.82 : 0.66);
  const rankFs = plateHcq * 0.46 * ((c.rank?.label?.length || 0) > 6 ? 0.8 : 1);
  const dia = L.d * 0.9;
  const plate = (cy) => ({ position: 'absolute', left: pc(L.pl + 0.055), width: pc(textW - 0.04), top: pc(cy - L.ph / 2), height: pc(L.ph), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', whiteSpace: 'nowrap' });
  const bw = (L.panel - L.pl) * 0.8;
  return (
    <div className={`relative w-full overflow-hidden rounded-xl shadow-lg ${className}`} onClick={onClick}
      style={{ aspectRatio: String(L.aspect), containerType: 'inline-size', cursor: onClick ? 'pointer' : undefined }}>
      <img src={itemSrc(c.cardId)} alt="" draggable={false} className="absolute inset-0 w-full h-full" />
      <div className="absolute" style={{ left: pc(L.panel), right: '1%', top: '2%', bottom: '1%' }}>
        <img src={charSrc(c.charId)} alt="" draggable={false} className="w-full h-full" style={{ objectFit: 'contain', objectPosition: 'center bottom' }} />
      </div>
      <div className="absolute" style={{ left: pc(L.cx - dia / 2), top: pc(L.cy - (dia * L.aspect) / 2), width: pc(dia), height: pc(dia * L.aspect) }}>
        <Avatar iconId={c.iconId} frameId={c.frameId} size={0} />
      </div>
      <div style={{ ...plate(L.p1), fontSize: `${nameFs}cqw`, fontWeight: 800, color: '#fff4d2', textShadow: '0 2px 4px #000' }}>{name}</div>
      <div style={{ ...plate(L.p2), fontSize: `${rankFs}cqw`, fontWeight: 800, color: '#e6ecf7', textShadow: '0 2px 4px #000' }}>{c.rank?.label}</div>
      <div className="absolute" style={{ left: pc((L.panel - L.pl) / 2 + L.pl - bw / 2), width: pc(bw), top: pc(L.by - (bw * L.aspect) / 2), height: pc(bw * L.aspect) }}>
        {earned ? <BadgeArt b={earned} /> : badge ? <RankBadge rank={badge} size="fill" showSub={badge === c.rank} /> : null}
      </div>
    </div>
  );
}

// プレイヤーカード（バナー）。cardId があればそのカードフレーム、なければ /ui/card.jpg（1024x1536）の上に、アイコン・バッジ・キャラ・名前を重ねる。
// c = { displayName, iconId, frameId, cardId, charId, badgeId, rank } / 親の幅に合わせて拡大縮小（cqw）
export default function PlayerCard({ c, className = '', onClick }) {
  const earned = /^[bs]:/.test(c.badgeId || '') ? c.badgeInfo : null;
  const badge = c.badgeId === 'none' ? null : (c.badgeId && c.badgeId !== 'auto' ? { key: c.badgeId, label: TIER_LABEL[c.badgeId] } : c.rank);
  const name = c.displayName || '';
  if (c.cardId && c.cardId !== 'none') return <FramedCard c={c} className={className} onClick={onClick} L={layoutOf(c.cardId)} name={name} earned={earned} badge={badge} />;
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
      {earned && <Box x={45} y={770} w={240} h={240}><BadgeArt b={earned} /></Box>}
      {!earned && badge && <Box x={45} y={770} w={240} h={240}><RankBadge rank={badge} size="fill" showSub={badge === c.rank} /></Box>}
    </div>
  );
}
