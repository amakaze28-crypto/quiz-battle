import { useState } from 'react';
import { Stage, Box, Hot, fs } from './Stage';
import AudioPanel from './AudioPanel';

// タイトル画面。どこをタップしても開始（未ログインならGoogleログイン）
export default function Title({ maintenance, user, onStart, onLogin, onLogout, busy, error }) {
  const [modal, setModal] = useState(null); // 'transfer' | 'settings'

  return (
    <>
      <Stage bg="/ui/title.jpg">
        <button onClick={onStart} aria-label="タップしてスタート" className="absolute inset-0 w-full h-full cursor-pointer" />
        <Hot x={40} y={1432} w={206} h={70} label="引き継ぎ" onClick={() => setModal('transfer')} />
        <Hot x={805} y={1432} w={190} h={70} label="設定" onClick={() => setModal('settings')} />
        <Hot x={918} y={22} w={76} h={74} label="メニュー" onClick={() => setModal('settings')} />
        {maintenance?.on && (
          <Box x={80} y={930} w={864} h={250} className="flex flex-col items-center justify-center text-center pointer-events-none rounded-2xl"
            style={{ background: 'rgba(8,16,38,.82)', border: '3px solid #e2b13c', color: '#fff', textShadow: '0 2px 4px #000' }}>
            <span style={{ fontSize: fs(54), fontWeight: 800, color: '#ffd166' }}>🔧 メンテナンス中</span>
            <span style={{ fontSize: fs(28), marginTop: '0.6cqw' }}>{maintenance.message || 'ただいまメンテナンス中です。しばらくお待ちください。'}</span>
            <span style={{ fontSize: fs(22), marginTop: '0.4cqw', color: '#cbd5e1' }}>管理者以外はログインできません</span>
          </Box>
        )}
        {(busy || error) && (
          <Box x={100} y={1190} w={824} h={70} className="grid place-items-center text-center pointer-events-none" style={{ fontSize: fs(26), fontWeight: 700, color: error ? '#fca5a5' : '#fff', textShadow: '0 2px 6px #000' }}>
            {busy ? 'ログイン中…' : error}
          </Box>
        )}
      </Stage>

      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5" onClick={() => setModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#14213d] border border-[#c9a24a]/70 p-5 text-white" onClick={(e) => e.stopPropagation()}>
            {modal === 'transfer' ? (
              <>
                <h2 className="font-bold text-lg mb-2">データの引き継ぎ</h2>
                <p className="text-sm text-slate-300 mb-4">ほかの端末で使っていたGoogleアカウントでログインすると、ランク・コイン・砂・アイテム・フレンドをそのまま引き継げます。</p>
                {user ? (
                  <>
                    <p className="text-sm mb-3">現在のログイン: <b>{user.displayName || user.email}</b></p>
                    <button onClick={() => { setModal(null); onLogout(); }} className="w-full py-2.5 rounded-lg bg-slate-600 mb-2">別のアカウントでログインし直す（ログアウト）</button>
                  </>
                ) : (
                  <button onClick={() => { setModal(null); onLogin(); }} className="w-full py-2.5 rounded-lg bg-white text-slate-900 font-bold mb-2">Googleでログイン</button>
                )}
              </>
            ) : (
              <>
                <h2 className="font-bold text-lg mb-2">設定</h2>
                <AudioPanel />
                {user ? (
                  <p className="text-sm text-slate-300 mb-4">ゲームを開始すると、右上のアイコンメニューからプロフィール・設定を開けます。</p>
                ) : (
                  <>
                    <p className="text-sm text-slate-300 mb-4">設定はログイン後にご利用いただけます。</p>
                    <button onClick={() => { setModal(null); onLogin(); }} className="w-full py-2.5 rounded-lg bg-white text-slate-900 font-bold mb-2">Googleでログイン</button>
                  </>
                )}
              </>
            )}
            <button onClick={() => setModal(null)} className="w-full py-2 rounded-lg bg-slate-700 text-sm">閉じる</button>
          </div>
        </div>
      )}
    </>
  );
}
