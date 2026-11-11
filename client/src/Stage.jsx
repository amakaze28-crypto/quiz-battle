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

const chevron = <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#f6e4b0" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>;
const houseIc = <svg viewBox="0 0 24 24" width="100%" height="100%" fill="#f6e4b0"><path d="M12 3.2 2.8 11.3h2.6V20h5v-5.6h3.2V20h5v-8.7h2.6z" /></svg>;
export const searchIc = <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#f6e4b0" strokeWidth="2.4" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6" /><path d="m15.2 15.2 5 5" /></svg>;

// 背景に絵柄がない画面用の上のバー（戻る・タイトル・ホーム）。右側には children を置ける
export function PageHeader({ title, go, children }) {
  const btn = { background: 'linear-gradient(180deg,#14305f,#0b1a38)', border: `${cq(2.5)} solid #c9a24a`, boxShadow: '0 3px 8px rgba(0,0,0,.45)', padding: cq(14) };
  return (
    <>
      <Box x={0} y={0} w={W} h={112} style={{ background: 'linear-gradient(180deg,rgba(7,18,44,.94),rgba(10,26,60,.78))', borderBottom: `${cq(3)} solid #c9a24a` }} />
      <Box x={16} y={18} w={84} h={76}>
        <button onClick={() => go('home')} aria-label="戻る" className="w-full h-full rounded-xl active:scale-95 transition-transform" style={btn}>{chevron}</button>
      </Box>
      <Box x={118} y={18} w={420} h={76} className="flex items-center" style={{ fontSize: fs(44), fontWeight: 900, color: '#fff4d2', textShadow: '0 2px 6px #000', letterSpacing: '0.06em' }}>{title}</Box>
      {children}
      <Box x={922} y={18} w={86} h={76}>
        <button onClick={() => go('home')} aria-label="ホーム" className="w-full h-full rounded-xl active:scale-95 transition-transform" style={btn}>{houseIc}</button>
      </Box>
    </>
  );
}
