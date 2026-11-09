import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, provider } from './firebase';
import { callApi } from './api';
import { useGame } from './useGame';
import { useSummary } from './useSummary';
import Layout from './Layout';
import Home from './Home';
import Game from './Game';
import Result from './Result';
import Profile from './Profile';
import Settings from './Settings';
import Admin from './Admin';
import { Mails } from './Pages';
import Shop from './Shop';
import Missions from './Missions';
import Friends from './Friends';
import Gacha from './Gacha';
import Title from './Title';
import RankBadge from './RankBadge';
import { BgLayer, Panel, Btn, Loading } from './Ui';
import { Avatar } from './Parts';
import { sfx } from './audio';
import { useBgm } from './useAudio';

export function Center({ children }) {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center text-white">
      <BgLayer />
      <Panel className="px-5 py-6 w-full max-w-sm">{children}</Panel>
    </div>
  );
}

function Authed({ user }) {
  const g = useGame(user);
  const [view, setView] = useState(null);
  const { summary, refresh } = useSummary(user, view);

  // 管理者アカウントは最初に管理者画面を表示
  useEffect(() => {
    if (g.profile && view === null) setView(g.profile.isAdmin ? 'admin' : 'home');
  }, [g.profile, view]);

  // 変更系APIの結果(コイン・名前・アイコン)を即座にプロフィールへ反映
  const call = useCallback(async (path, opts) => {
    const data = await callApi(user, path, opts);
    if (data.profile) g.setProfile(data.profile);
    return data;
  }, [user, g.setProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = () => signOut(auth);

  // BGM: マッチ成立後は対戦曲(3曲からランダム)、それ以外はホーム曲
  useBgm(['matched', 'playing'].includes(g.phase) ? 'battle' : 'home');

  // 効果音
  const qIndex = g.q?.index;
  useEffect(() => { if (g.phase === 'matched') sfx('match'); }, [g.phase]);
  useEffect(() => { if (g.phase === 'playing' && qIndex !== undefined) sfx('question'); }, [qIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (g.phase !== 'result' || !g.result) return;
    const me = g.result.results.find((r) => r.uid === g.profile?.uid);
    sfx(me && me.delta > 0 ? 'win' : 'lose');
  }, [g.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (g.conn === 'banned') {
    return (
      <Center>
        <p className="text-2xl font-bold text-red-500 mb-2">アカウントが停止されています</p>
        {g.banReason && <p className="text-slate-300 mb-4">理由: {g.banReason}</p>}
        <Btn variant="ghost" onClick={logout}>ログアウト</Btn>
      </Center>
    );
  }

  if (g.phase === 'matched') {
    return (
      <Center>
        <p className="ui-title text-2xl mb-4">対戦相手が見つかりました！</p>
        <ul className="space-y-2 mb-4">
          {g.match.players.map((p) => (
            <li key={p.uid} className="flex items-center gap-3 justify-center">
              <Avatar iconId={p.iconId} frameId={p.frameId} size={36} />
              <RankBadge rank={{ key: p.rankKey, sub: p.rankSub, label: p.rank }} size={36} showSub={false} />
              <span>{p.name}（{p.rank}）</span>
            </li>
          ))}
        </ul>
        <p className="animate-pulse">まもなく開始…</p>
      </Center>
    );
  }
  if (g.phase === 'playing') return <Game g={g} user={user} />;
  if (g.phase === 'result') return <Result g={g} user={user} />;

  if (view === null) {
    return <Loading sub={g.conn !== 'online' ? 'サーバーに接続中（無料枠は起動に時間がかかることがあります）' : undefined} />;
  }

  const common = { user, go: setView, summary, refresh };
  if (view === 'home') return <Home g={g} summary={summary} go={setView} onLogout={logout} />;
  if (view === 'shop') return <Shop {...common} profile={g.profile} call={call} />;
  if (view === 'missions') return <Missions {...common} call={call} />;
  if (view === 'friends') return <Friends {...common} />;
  if (view === 'gacha') return <Gacha {...common} g={g} call={call} onLogout={logout} />;

  const body = {
    profile: <Profile profile={g.profile} user={user} call={call} />,
    settings: <Settings profile={g.profile} call={call} />,
    mail: <Mails user={user} call={call} onChange={refresh} />,
    admin: g.profile?.isAdmin ? <Admin user={user} /> : null,
  }[view];

  return (
    <Layout profile={g.profile} view={view} go={setView} summary={summary} onLogout={logout} wide={view === 'admin'} nav={view !== 'admin'}>
      {body}
    </Layout>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); if (!u) setStarted(false); }), []);

  const login = async () => {
    setBusy(true); setError('');
    try { await signInWithPopup(auth, provider); return true; } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') setError('ログインに失敗しました。もう一度お試しください');
      return false;
    } finally { setBusy(false); }
  };
  const start = async () => {
    if (busy) return;
    if (user || (await login())) setStarted(true);
  };

  useBgm(started && user ? null : 'title');
  if (user === undefined) return <Loading />;
  if (!started || !user) return <Title user={user} onStart={start} onLogin={async () => { if (await login()) setStarted(true); }} onLogout={() => signOut(auth)} busy={busy} error={error} />;
  return <Authed user={user} />;
}
