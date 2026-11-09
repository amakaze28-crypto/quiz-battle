import { Dot } from './Parts';

const ITEMS = [
  { key: 'home', label: 'ホーム' },
  { key: 'shop', label: 'ショップ' },
  { key: 'missions', label: 'ミッション', badge: 'mission' },
  { key: 'friends', label: 'フレンド', badge: 'friend' },
  { key: 'gacha', label: 'ガチャ' },
];

export default function BottomNav({ view, go, summary }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-[#0b1226]/95 border-t border-[#c9a24a]/50">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {ITEMS.map((i) => (
          <button key={i.key} onClick={() => go(i.key)} className={`relative py-2 flex flex-col items-center gap-1 text-xs ${view === i.key ? 'text-amber-300 font-bold' : 'text-slate-200'}`}>
            <img src={`/ui/nav/${i.key}${view === i.key ? '-on' : ''}.png`} alt="" draggable={false} className="h-6 w-auto object-contain" />{i.label}
            {i.badge && summary?.[i.badge] > 0 && <Dot className="absolute top-1 right-[22%] w-3 h-3" />}
          </button>
        ))}
      </div>
    </nav>
  );
}
