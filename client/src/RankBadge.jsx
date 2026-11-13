// ランクアイコン（/public/ranks/*.webp）。サブランク(5〜1)は右下に小さく表示。
// 下の板には現在のシーズン（例: S10）を自動で書く（サーバーから届くプロフィールの season.number）
let seasonNo = null;
export const setSeasonNo = (n) => { seasonNo = Number.isFinite(n) ? n : null; };

// 板の位置（画像に対する割合）。エンペラーだけ王冠があるぶん板が少し上
const PLATE = { default: { top: 66.9, h: 10.8 }, emperor: { top: 64.4, h: 10.8 } };

export default function RankBadge({ rank, size = 64, showSub = true }) {
  const fill = size === 'fill'; // Stage内で親の大きさに合わせる
  const dim = fill ? '100%' : size;
  if (!rank?.key) return <div style={{ width: dim, height: dim }} />;
  const plate = PLATE[rank.key] || PLATE.default;
  const showSeason = seasonNo != null && (fill || size >= 44);
  return (
    <div className={fill ? 'relative w-full h-full' : 'relative shrink-0'} style={fill ? undefined : { width: size, height: size }}>
      <img src={`/ranks/${rank.key}.webp`} alt={rank.label} draggable={false} style={{ width: dim, height: dim }} />
      {showSeason && (
        <div className="absolute inset-0 pointer-events-none" style={{ containerType: 'inline-size' }}>
          <div className="absolute flex items-center justify-center font-black text-white" style={{ left: '25%', width: '50%', top: `${plate.top}%`, height: `${plate.h}%`, fontSize: '8.6cqw', lineHeight: 1, letterSpacing: '0.04em', textShadow: '0 0 6px rgba(255,255,255,.45), 0 1px 2px #000' }}>
            S{seasonNo}
          </div>
        </div>
      )}
      {showSub && rank.sub && (
        <span className="absolute bottom-0 right-0 rounded-md bg-black/70 px-1.5 text-white font-extrabold leading-tight"
          style={{ fontSize: fill ? '2.6cqw' : Math.max(10, size * 0.22) }}>
          {rank.sub}
        </span>
      )}
    </div>
  );
}
