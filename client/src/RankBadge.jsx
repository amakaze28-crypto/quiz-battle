// ランクアイコン（/public/ranks/*.png）。サブランク(5〜1)は右下に小さく表示
export default function RankBadge({ rank, size = 64, showSub = true }) {
  if (!rank?.key) return <div style={{ width: size, height: size }} />;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <img
        src={`/ranks/${rank.key}.png`} alt={rank.label} draggable={false}
        style={{ width: size, height: size, WebkitMaskImage: 'radial-gradient(closest-side, #000 84%, transparent 100%)', maskImage: 'radial-gradient(closest-side, #000 84%, transparent 100%)' }}
      />
      {showSub && rank.sub && (
        <span className="absolute bottom-0 right-0 rounded-md bg-black/70 px-1.5 text-white font-extrabold leading-tight"
          style={{ fontSize: Math.max(10, size * 0.22) }}>
          {rank.sub}
        </span>
      )}
    </div>
  );
}
