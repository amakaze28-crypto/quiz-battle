import { useState } from 'react';

function Avatar({ user, size = 40 }) {
  return user.photoURL
    ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="rounded-full object-cover" style={{ width: size, height: size }} />
    : <div className="rounded-full bg-sky-700 grid place-items-center font-bold" style={{ width: size, height: size }}>{(user.displayName || '?').slice(0, 1)}</div>;
}

export default function Layout({ profile, user, view, setView, onLogout, children, wide = false }) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const me = { photoURL: profile?.photoURL || user.photoURL, displayName: profile?.displayName || user.displayName };
  const go = (v) => { setMenu(false); setView(v); };

  return (
    <div className="min-h-screen bg-[#0e1013] text-white">
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#0e1013]/90 backdrop-blur border-b border-white/5">
        <button onClick={() => setView(profile?.isAdmin ? 'admin' : 'home')} className="text-lg font-extrabold tracking-wide">
          早押しクイズバトル{view === 'admin' && <span className="ml-2 text-xs rounded bg-amber-500 text-black px-2 py-0.5 align-middle">管理者</span>}
        </button>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} aria-label="メニュー" className="rounded-full ring-2 ring-white/20">
            <Avatar user={me} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 mt-2 w-48 z-40 rounded-xl bg-[#1b1f27] shadow-xl border border-white/10 overflow-hidden">
                <div className="px-4 py-3 text-sm text-slate-300 border-b border-white/5 truncate">{me.displayName}</div>
                <MenuItem onClick={() => go('profile')}>プロフィール</MenuItem>
                <MenuItem onClick={() => go('settings')}>設定</MenuItem>
                {profile?.isAdmin && (view === 'admin'
                  ? <MenuItem onClick={() => go('home')}>プレイ画面へ</MenuItem>
                  : <MenuItem onClick={() => go('admin')}>管理者画面</MenuItem>)}
                <button onClick={() => { setMenu(false); setConfirm(true); }}
                  className="w-full text-left px-4 py-3 text-red-500 font-bold hover:bg-white/5 border-t border-white/5">
                  ログアウト
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className={`${wide ? 'max-w-4xl' : 'max-w-md'} mx-auto p-5`}>{children}</main>

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
          <div className="w-full max-w-xs rounded-2xl bg-[#1b1f27] p-5 text-center">
            <p className="font-bold mb-1">ログアウトしますか？</p>
            <p className="text-sm text-slate-400 mb-5">本当にログアウトしてよろしいですか？</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(false)} className="flex-1 py-2 rounded-lg bg-slate-700">キャンセル</button>
              <button onClick={onLogout} className="flex-1 py-2 rounded-lg bg-red-600 font-bold">ログアウト</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MenuItem = ({ onClick, children }) => (
  <button onClick={onClick} className="w-full text-left px-4 py-3 hover:bg-white/5">{children}</button>
);
