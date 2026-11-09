import { Dot } from './Parts';

const ITEMS = [
  { key: 'home', label: 'ホーム' },
  { key: 'shop', label: 'ショップ' },
  { key: 'missions', label: 'ミッション', badge: 'mission' },
  { key: 'friends', label: 'フレンド', badge: 'friend' },
  { key: 'gacha', label: 'ガチャ' },
];

// 全画面共通の下のタスクバー。バーは画面の端から端まで、ボタンは画面幅(最大 2:3 の幅)に収めて並べる。
// 大きさは画面幅に比例（cqw）するので、画面サイズを変えても比率が崩れない。
export const NAV_W = 'min(100vw, calc(100dvh * 2 / 3))';
export const NAV_H = `calc(${NAV_W} * 0.187)`; // = ステージ背景の下端 191/1024

export default function BottomNav({ view, go, summary }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 flex justify-center border-t-2 border-[#c9a24a]/70 select-none"
      style={{ height: NAV_H, background: 'linear-gradient(180deg,#0f1a36,#080f22)', boxShadow: '0 -4px 14px rgba(0,0,0,.45)' }}>
      <div className="grid grid-cols-5 h-full" style={{ width: NAV_W, containerType: 'inline-size' }}>
        {ITEMS.map((i) => {
          const on = view === i.key;
          return (
            <button key={i.key} onClick={() => go(i.key)} className="relative flex flex-col items-center justify-center" style={{ gap: '1.2cqw', color: on ? '#fcd34d' : '#e2e8f0', fontWeight: on ? 800 : 600, paddingBottom: '1cqw' }}>
              <img src={`/ui/nav/${i.key}${on ? '-on' : ''}.png`} alt="" draggable={false} style={{ height: '8.2cqw', width: 'auto', objectFit: 'contain' }} />
              <span style={{ fontSize: '3cqw' }}>{i.label}</span>
              {on && <span className="absolute bottom-0 rounded-full" style={{ width: '60%', height: '0.5cqw', background: 'linear-gradient(90deg,transparent,#fcd34d,transparent)' }} />}
              {i.badge && summary?.[i.badge] > 0 && <Dot className="absolute" style={{ top: '14%', right: '24%', width: '3.2cqw', height: '3.2cqw' }} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
