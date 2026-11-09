import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, provider } from './firebase';
import { useGame } from './useGame';
import Layout from './Layout';
import Home from './Home';
import Game from './Game';
import Result from './Result';
import Profile from './Profile';
import Settings from './Settings';
import Admin from './Admin';
import RankBadge from './RankBadge';

export function Center({ children }) {
  return <div className="min-h-screen grid place-items-center bg-[#0e1013] text-white p-6 text-center"><div>{children}</div></div>;
}

function Authed({ user }) {
  const g = useGame(user);
  const [view, setView] = useState(null);

  // 管理者アカウントは最初に管理者画面を表示
  useEffect(() => {
    if (g.profile && view === null) setView(g.profile.isAdmin ? 'admin' : 'home');
  }, [g.profile, view]);

  if (g.conn === 'banned') {
    return (
      <Center>
        <p className="text-2xl font-bold text-red-500 mb-2">アカウントが停止されています</p>
        {g.banReason && <p className="text-slate-300 mb-4">理由: {g.banReason}</p>}
        <button onClick={() => signOut(auth)} className="px-5 py-2 rounded-lg bg-slate-700">ログアウト</button>
      </Center>
    );
  }

  if (g.phase === 'matched') {
    return (
      <Center>
        <p className="text-2xl font-bold mb-4">対戦相手が見つかりました！</p>
        <ul className="space-y-2 mb-4">
          {g.match.players.map((p) => (
            <li key={p.uid} className="flex items-center gap-3 justify-center">
              <RankBadge rank={{ key: p.rankKey, sub: p.rankSub, label: p.rank }} size={36} showSub={false} />
              <span>{p.name}（{p.rank}）</span>
            </li>
          ))}
        </ul>
        <p className="animate-pulse">まもなく開始…</p>
      </Center>
    );
  }
  if (g.phase === 'playing') return <Game g={g} myUid={g.profile?.uid} />;
  if (g.phase === 'result') return <Result g={g} myUid={g.profile?.uid} />;

  if (view === null) return <Center>読み込み中…{g.conn !== 'online' && <p className="text-sm text-slate-400 mt-2">サーバーに接続中（無料枠は起動に時間がかかることがあります）</p>}</Center>;

  const body = {
    home: <Home g={g} />,
    profile: <Profile profile={g.profile} />,
    settings: <Settings g={g} />,
    admin: g.profile?.isAdmin ? <Admin user={user} /> : <Home g={g} />,
  }[view];

  return (
    <Layout user={user} profile={g.profile} view={view} setView={setView} onLogout={() => signOut(auth)} wide={view === 'admin'}>
      {body}
    </Layout>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return <Center>読み込み中...</Center>;
  if (!user) {
    return (
      <Center>
        <h1 className="text-3xl font-bold mb-6">早押しクイズバトル</h1>
        <button onClick={() => signInWithPopup(auth, provider)} className="px-6 py-3 rounded-xl bg-white text-slate-900 font-bold">
          Googleでログイン
        </button>
      </Center>
    );
  }
  return <Authed user={user} />;
}
