import { useState } from 'react';
import { Avatar } from './Parts';
import AccountMenu from './AccountMenu';
import BottomNav from './BottomNav';

export default function Layout({ profile, view, go, summary, onLogout, children, wide = false, nav = true }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className={`min-h-screen bg-[#0e1013] text-white ${nav ? 'pb-20' : ''}`}>
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#0e1013]/90 backdrop-blur border-b border-white/5">
        <button onClick={() => go(profile?.isAdmin && view === 'admin' ? 'admin' : 'home')} className="text-lg font-extrabold tracking-wide">
          早押しクイズバトル{view === 'admin' && <span className="ml-2 text-xs rounded bg-amber-500 text-black px-2 py-0.5 align-middle">管理者</span>}
        </button>
        <button onClick={() => setMenu((m) => !m)} aria-label="メニュー" className="rounded-full ring-2 ring-white/20">
          <Avatar iconId={profile?.iconId} size={40} />
        </button>
      </header>
      <AccountMenu open={menu} onClose={() => setMenu(false)} anchor="right" profile={profile} adminView={view === 'admin'} go={go} onLogout={onLogout} />
      <main className={`${wide ? 'max-w-4xl' : 'max-w-md'} mx-auto p-5`}>{children}</main>
      {nav && <BottomNav view={view} go={go} summary={summary} />}
    </div>
  );
}
