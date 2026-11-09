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

export const NAV_KEYS = ['home', 'shop', 'missions', 'friends', 'gacha'];

// 下部ナビ（背景画像に描かれているボタンの上に透明なボタンを重ねる）
export function NavHot({ go, y = 1345, h = 160 }) {
  return NAV_KEYS.map((k, i) => <Hot key={k} x={i * 205} y={y} w={205} h={h} label={k} onClick={() => go(k)} />);
}

// ナビの赤い通知（背景画像に描かれていたものは消してあるので、必要なときだけ重ねる）
export function NavDots({ summary, y, Dot }) {
  return (
    <>
      {summary?.mission > 0 && <Box x={545} y={y} w={22} h={22}><Dot className="w-full h-full" /></Box>}
      {summary?.friend > 0 && <Box x={745} y={y} w={22} h={22}><Dot className="w-full h-full" /></Box>}
    </>
  );
}

// 子画面共通：左上の「＜」とホームボタン
export function BackHome({ go, homeX = 922 }) {
  return (
    <>
      <Hot x={0} y={12} w={120} h={90} label="戻る" onClick={() => go('home')} />
      <Hot x={homeX} y={20} w={86} h={78} label="ホーム" onClick={() => go('home')} />
    </>
  );
}
