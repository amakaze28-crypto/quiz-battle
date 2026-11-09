import { iconSrc } from './icons';

export const Avatar = ({ iconId, size = 40, className = '' }) => (
  <img src={iconSrc(iconId)} alt="" draggable={false} className={`rounded-full object-cover bg-slate-600 ${className}`}
    style={size ? { width: size, height: size } : { width: '100%', height: '100%' }} />
);

export const Coin = ({ n, size = 18, className = '' }) => (
  <span className={`inline-flex items-center gap-1 font-bold ${className}`}>
    <img src="/ui/coin.png" alt="" style={{ width: size, height: size }} draggable={false} />
    {typeof n === 'number' ? n.toLocaleString() : n}
  </span>
);

export const Dot = ({ className = '' }) => <span className={`inline-block rounded-full bg-red-500 ring-2 ring-white/80 ${className}`} />;
