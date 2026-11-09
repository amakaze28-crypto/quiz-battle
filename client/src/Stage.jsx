// 背景画像(1024x1536)の上に、画像内の座標(px)のまま部品を重ねるための土台
export const W = 1024;
export const H = 1536;
const pct = (n, base) => `${(n / base) * 100}%`;
export const fs = (px) => `${px / 10.24}cqw`;

export function Stage({ bg, children }) {
  return (
    <div className="min-h-screen grid place-items-center bg-[#070b14]">
      <div className="relative overflow-hidden select-none"
        style={{ width: 'min(100vw, calc(100dvh * 2 / 3))', aspectRatio: '2 / 3', containerType: 'inline-size' }}>
        <img src={bg} alt="" draggable={false} className="absolute inset-0 w-full h-full" />
        {children}
      </div>
    </div>
  );
}

export function Box({ x, y, w, h, children, className = '', style, ...rest }) {
  return (
    <div className={`absolute ${className}`} style={{ left: pct(x, W), top: pct(y, H), width: pct(w, W), height: pct(h, H), ...style }} {...rest}>
      {children}
    </div>
  );
}

export function Hot({ x, y, w, h, onClick, label }) {
  return (
    <Box x={x} y={y} w={w} h={h}>
      <button onClick={onClick} aria-label={label} className="w-full h-full rounded-lg active:bg-white/10" />
    </Box>
  );
}
