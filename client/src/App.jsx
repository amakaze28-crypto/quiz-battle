import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, provider } from './firebase';
import { useGame } from './useGame';
import Home from './Home';
import Game from './Game';
import Result from './Result';

function Authed({ user }) {
  const g = useGame(user);

  if (g.phase === 'matched') {
    return (
      <Center>
        <p className="text-2xl font-bold mb-4">対戦相手が見つかりました！</p>
        <ul className="space-y-1 mb-4">
          {g.match.players.map((p) => <li key={p.uid}>{p.name}（{p.rank}）</li>)}
        </ul>
        <p className="animate-pulse">まもなく開始…</p>
      </Center>
    );
  }
  if (g.phase === 'playing') return <Game g={g} myUid={g.profile?.uid} />;
  if (g.phase === 'result') return <Result g={g} myUid={g.profile?.uid} />;
  return <Home g={g} user={user} onLogout={() => signOut(auth)} />;
}

export function Center({ children }) {
  return <div className="min-h-screen grid place-items-center bg-slate-900 text-white p-6 text-center"><div>{children}</div></div>;
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
