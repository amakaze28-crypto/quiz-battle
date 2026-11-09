// ランクアイコン（/public/ranks/*.png）。サブランク(5〜1)は右下に小さく表示
export default function RankBadge({ rank, size = 64, showSub = true }) {
  const fill = size === 'fill'; // Stage内で親の大きさに合わせる
  const dim = fill ? '100%' : size;
  if (!rank?.key) return <div style={{ width: dim, height: dim }} />;
  return (
    <div className={fill ? 'relative w-full h-full' : 'relative shrink-0'} style={fill ? undefined : { width: size, height: size }}>
      <img
        src={`/ranks/${rank.key}.png`} alt={rank.label} draggable={false}
        style={{ width: dim, height: dim, WebkitMaskImage: 'radial-gradient(closest-side, #000 84%, transparent 100%)', maskImage: 'radial-gradient(closest-side, #000 84%, transparent 100%)' }}
      />
      {showSub && rank.sub && (
        <span className="absolute bottom-0 right-0 rounded-md bg-black/70 px-1.5 text-white font-extrabold leading-tight"
          style={{ fontSize: fill ? '2.6cqw' : Math.max(10, size * 0.22) }}>
          {rank.sub}
        </span>
      )}
    </div>
  );
}
