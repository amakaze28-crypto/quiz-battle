import { iconSrc, itemSrc, RARITY } from './icons';

// アイコン＋フレーム（フレームは中央が透明な正方形画像をアイコンに重ねる）
export const Avatar = ({ iconId, frameId, size = 40, className = '' }) => (
  <div className="relative shrink-0" style={size ? { width: size, height: size } : { width: '100%', height: '100%' }}>
    <img src={iconSrc(iconId)} alt="" draggable={false} className={`rounded-full object-cover bg-slate-600 w-full h-full ${className}`} />
    {frameId && frameId !== 'none' && (
      <img src={itemSrc(frameId)} alt="" draggable={false} className="absolute pointer-events-none"
        style={{ left: '-10%', top: '-10%', width: '120%', height: '120%', maxWidth: 'none' }} />
    )}
  </div>
);

export const Banner = ({ bannerId, className = '', style }) => (
  bannerId && bannerId !== 'none'
    ? <img src={itemSrc(bannerId)} alt="" draggable={false} className={`object-cover ${className}`} style={style} />
    : null
);

export const Coin = ({ n, size = 18, className = '' }) => (
  <span className={`inline-flex items-center gap-1 font-bold ${className}`}>
    <img src="/ui/coin.png" alt="" style={{ width: size, height: size }} draggable={false} />
    {typeof n === 'number' ? n.toLocaleString() : n}
  </span>
);

export const Sand = ({ n, size = 18, className = '' }) => (
  <span className={`inline-flex items-center gap-1 font-bold ${className}`}>
    <img src="/ui/sand.png" alt="魔法の砂" style={{ width: size, height: size }} draggable={false} />
    {typeof n === 'number' ? n.toLocaleString() : n}
  </span>
);

export const RarityTag = ({ rarity, className = '' }) => (
  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-black ${className}`} style={{ background: RARITY[rarity]?.color }}>{RARITY[rarity]?.label}</span>
);

export const Dot = ({ className = '' }) => <span className={`inline-block rounded-full bg-red-500 ring-2 ring-white/80 ${className}`} />;
