import { useState } from 'react';

const Item = ({ onClick, children }) => <button onClick={onClick} className="w-full text-left px-4 py-3 hover:bg-white/5">{children}</button>;

// アイコンをタップしたときのメニュー（プロフィール／設定／ログアウト）
export default function AccountMenu({ open, onClose, anchor = 'right', profile, adminView, go, onLogout }) {
  const [confirm, setConfirm] = useState(false);
  const nav = (v) => { onClose(); go(v); };

  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={onClose} />
          <div className={`fixed z-40 top-16 ${anchor === 'right' ? 'right-3' : 'left-3'} w-52 rounded-xl bg-[#1b1f27] shadow-xl border border-white/10 overflow-hidden text-white`}>
            <div className="px-4 py-3 text-sm text-slate-300 border-b border-white/5 truncate">{profile?.displayName}</div>
            <Item onClick={() => nav('profile')}>プロフィール</Item>
            <Item onClick={() => nav('settings')}>設定</Item>
            {profile?.isAdmin && (adminView ? <Item onClick={() => nav('home')}>プレイ画面へ</Item> : <Item onClick={() => nav('admin')}>管理者画面</Item>)}
            <button onClick={() => { onClose(); setConfirm(true); }} className="w-full text-left px-4 py-3 text-red-500 font-bold hover:bg-white/5 border-t border-white/5">
              ログアウト
            </button>
          </div>
        </>
      )}
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
          <div className="w-full max-w-xs rounded-2xl bg-[#1b1f27] p-5 text-center text-white">
            <p className="font-bold mb-1">ログアウトしますか？</p>
            <p className="text-sm text-slate-400 mb-5">本当にログアウトしてよろしいですか？</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(false)} className="flex-1 py-2 rounded-lg bg-slate-700">キャンセル</button>
              <button onClick={onLogout} className="flex-1 py-2 rounded-lg bg-red-600 font-bold">ログアウト</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
