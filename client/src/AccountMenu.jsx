import { useState } from 'react';
import { Plate, Panel, Btn } from './Ui';

const Item = ({ onClick, children }) => <button onClick={onClick} className="w-full text-left px-3 py-3 hover:bg-white/10 ui-text">{children}</button>;

// アイコンをタップしたときのメニュー（プロフィール／設定／ログアウト）
export default function AccountMenu({ open, onClose, anchor = 'right', profile, adminView, go, onLogout }) {
  const [confirm, setConfirm] = useState(false);
  const nav = (v) => { onClose(); go(v); };

  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={onClose} />
          <Plate className={`fixed z-40 top-[72px] ${anchor === 'right' ? 'right-3' : 'left-3'} w-52 shadow-xl`}>
            <div className="px-3 py-2 text-sm text-[#f6e4b0] border-b border-white/10 truncate">{profile?.displayName}</div>
            <Item onClick={() => nav('profile')}>プロフィール</Item>
            <Item onClick={() => nav('guide')}>遊び方</Item>
            <Item onClick={() => nav('settings')}>設定</Item>
            {profile?.isAdmin && (adminView ? <Item onClick={() => nav('home')}>プレイ画面へ</Item> : <Item onClick={() => nav('admin')}>管理者画面</Item>)}
            <button onClick={() => { onClose(); setConfirm(true); }} className="w-full text-left px-3 py-3 text-red-400 font-bold hover:bg-white/10 border-t border-white/10">
              ログアウト
            </button>
          </Plate>
        </>
      )}
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
          <Panel className="w-full max-w-xs p-4 text-center">
            <p className="ui-title text-lg mb-1">ログアウトしますか？</p>
            <p className="text-sm text-slate-300 mb-5">本当にログアウトしてよろしいですか？</p>
            <div className="flex gap-3">
              <Btn variant="ghost" className="flex-1" onClick={() => setConfirm(false)}>キャンセル</Btn>
              <Btn variant="red" className="flex-1" onClick={onLogout}>ログアウト</Btn>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
