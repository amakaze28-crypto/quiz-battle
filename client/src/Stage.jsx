import { createPortal } from 'react-dom';
import { BgLayer } from './Ui';
import BottomNav from './BottomNav';

// 背景画像(1024x1536)の上に、画像内の座標(px)のまま部品を重ねるための土台
export const W = 1024;
export const H = 1536;
const pct = (n, base) => `${(n / base) * 100}%`;
export const fs = (px) => `${px / 10.24}cqw`;
export const cq = fs; // 画像内ピクセル → 画面幅に比例する長さ（画面サイズを変えても比率が崩れない）

export function Stage({ bg, children }) {
  return (
    <div className="fixed inset-0 overflow-hidden flex items-end justify-center overscroll-none touch-manipulation">
      <BgLayer dim />
      <div className="relative overflow-hidden select-none shadow-[0_0_40px_rgba(0,0,0,.6)]"
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

// 下のタスクバーは全画面共通の BottomNav（画面の端から端まで）。Stage の外（body直下）に描く
export function NavHot({ go, active, summary }) {
  return createPortal(<BottomNav view={active} go={go} summary={summary} />, document.body);
}
// 互換用（通知の赤丸は BottomNav が表示する）
export const NavDots = () => null;

// 子画面共通：左上の「＜」とホームボタン
export function BackHome({ go, homeX = 922 }) {
  return (
    <>
      <Hot x={0} y={12} w={120} h={90} label="戻る" onClick={() => go('home')} />
      <Hot x={homeX} y={20} w={86} h={78} label="ホーム" onClick={() => go('home')} />
    </>
  );
}
