import { useState } from 'react';
import { Avatar } from './Parts';
import AccountMenu from './AccountMenu';
import BottomNav from './BottomNav';
import { BgLayer, Plate } from './Ui';

export default function Layout({ profile, view, go, summary, onLogout, children, wide = false, nav = true }) {
  const [menu, setMenu] = useState(false);
  const admin = view === 'admin';
  return (
    <div className={`min-h-screen text-white ${admin ? 'bg-[#0e1013]' : ''} ${nav ? 'pb-24' : ''}`}>
      {!admin && <BgLayer dim />}
      <header className="sticky top-0 z-20 px-3 pt-3">
        <Plate className="flex items-center justify-between !border-[10px] pl-2 pr-1">
          <button onClick={() => go(profile?.isAdmin && admin ? 'admin' : 'home')} className="ui-title text-lg">
            早押しクイズバトル{admin && <span className="ml-2 text-xs rounded bg-amber-500 text-black px-2 py-0.5 align-middle">管理者</span>}
          </button>
          <button onClick={() => setMenu((m) => !m)} aria-label="メニュー" className="rounded-full ring-2 ring-[#d9b866]/70">
            <Avatar iconId={profile?.iconId} frameId={profile?.frameId} size={38} />
          </button>
        </Plate>
      </header>
      <AccountMenu open={menu} onClose={() => setMenu(false)} anchor="right" profile={profile} adminView={admin} go={go} onLogout={onLogout} />
      <main className={`${wide ? 'max-w-4xl' : 'max-w-md'} mx-auto p-4`}>{children}</main>
      {nav && <BottomNav view={view} go={go} summary={summary} />}
    </div>
  );
}
