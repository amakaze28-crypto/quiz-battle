import { Dot } from './Parts';

const ITEMS = [
  { key: 'home', label: 'ホーム', icon: '🏠' },
  { key: 'shop', label: 'ショップ', icon: '🛒' },
  { key: 'missions', label: 'ミッション', icon: '📋', badge: 'mission' },
  { key: 'friends', label: 'フレンド', icon: '👥', badge: 'friend' },
  { key: 'notices', label: 'お知らせ', icon: '🔖', badge: 'notice' },
];

export default function BottomNav({ view, go, summary }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-[#0b1226] border-t border-[#c9a24a]/40">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {ITEMS.map((i) => (
          <button key={i.key} onClick={() => go(i.key)} className={`relative py-2 flex flex-col items-center text-xs ${view === i.key ? 'text-amber-300 font-bold' : 'text-slate-300'}`}>
            <span className="text-xl leading-none">{i.icon}</span>{i.label}
            {i.badge && summary?.[i.badge] > 0 && <Dot className="absolute top-1 right-[22%] w-3 h-3" />}
          </button>
        ))}
      </div>
    </nav>
  );
}
