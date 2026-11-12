import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, provider } from './firebase';
import { callApi, SERVER_URL } from './api';
import { useGame } from './useGame';
import { useSummary } from './useSummary';
import Layout from './Layout';
import Terms, { hasAgreed } from './Terms';
import Home from './Home';
import Game from './Game';
import Result from './Result';
import Profile from './Profile';
import Ranking from './Ranking';
import NameSetup from './NameSetup';
import Settings from './Settings';
import Guide from './Guide';
import Admin from './Admin';
import PlayerCard from './PlayerCard';
import { Mails } from './Pages';
import Shop from './Shop';
import Missions from './Missions';
import Friends from './Friends';
import Gacha from './Gacha';
import Title from './Title';
import RankBadge from './RankBadge';
import { BgLayer, Panel, Btn, Loading } from './Ui';
import { Avatar, Banner } from './Parts';
import { sfx } from './audio';
import { useBgm } from './useAudio';

export function Center({ children, wide }) {
  return (
    <div className={`min-h-screen grid place-items-center ${wide ? 'p-2' : 'p-6'} text-center text-white`}>
      <BgLayer />
      <Panel className={wide ? 'px-2 py-6 w-full max-w-2xl' : 'px-5 py-6 w-full max-w-sm'}>{children}</Panel>
    </div>
  );
}

function Authed({ user, onMaintenance }) {
  const g = useGame(user);
  // メンテナンス中（管理者以外）はタイトル画面へ戻す
  useEffect(() => { if (g.conn === 'maintenance') onMaintenance(g.maintMsg); }, [g.conn]); // eslint-disable-line react-hooks/exhaustive-deps
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
  // 初めてのログインでは最初に名前を決める
  const needName = g.profile?.nameSet === false && g.phase !== 'playing' && g.phase !== 'matched';
  const withGate = (el) => <>{el}{needName && <NameSetup profile={g.profile} call={call} />}</>;

  // BGM: マッチ成立後は対戦曲(3曲からランダム)、それ以外はホーム曲
  useBgm(['matched', 'playing'].includes(g.phase) ? 'battle' : view === 'gacha' ? 'gacha' : view === 'admin' ? 'none' : 'home');

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
      <Center wide>
        <p className="ui-title text-2xl mb-4">対戦相手が見つかりました！</p>
        <div className="w-full max-w-2xl grid gap-1.5 sm:gap-3 mb-5" style={{ gridTemplateColumns: `repeat(${g.match.players.length}, minmax(0, 1fr))` }}>
          {g.match.players.map((p, i) => (
            <div key={p.uid} className="pop-in" style={{ animationDelay: `${i * 0.12}s` }}>
              <PlayerCard c={{ displayName: p.name, iconId: p.iconId, frameId: p.frameId, cardId: p.bannerId, charId: p.charId, badgeId: p.badgeId, badgeInfo: p.badgeInfo, rank: { key: p.rankKey, label: p.rank, sub: p.rankSub } }} />
            </div>
          ))}
        </div>
        <p className="animate-pulse">まもなく開始…</p>
      </Center>
    );
  }
  if (g.phase === 'playing') return <Game g={g} user={user} />;
  if (g.phase === 'result') return <Result g={g} user={user} />;

  if (view === null) {
    return <Loading sub={g.conn !== 'online'} />;
  }

  const common = { user, go: setView, summary, refresh };
  if (view === 'home') return withGate(<Home g={g} summary={summary} go={setView} onLogout={logout} user={user} />);
  if (view === 'shop') return withGate(<Shop {...common} profile={g.profile} call={call} />);
  if (view === 'missions') return withGate(<Missions {...common} call={call} />);
  if (view === 'friends') return withGate(<Friends {...common} />);
  if (view === 'gacha') return withGate(<Gacha {...common} g={g} call={call} onLogout={logout} />);

  const body = {
    profile: <Profile profile={g.profile} user={user} call={call} />,
    ranking: <Ranking user={user} />,
    settings: <Settings profile={g.profile} call={call} />,
    guide: <Guide go={setView} />,
    mail: <Mails user={user} call={call} onChange={refresh} />,
    admin: g.profile?.isAdmin ? <Admin user={user} /> : null,
  }[view];

  return withGate(
    <Layout profile={g.profile} view={view} go={setView} summary={summary} onLogout={logout} wide={view === 'admin'} nav={view !== 'admin'}>
      {body}
    </Layout>,
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
  const [terms, setTerms] = useState(null); // null | 'consent' | 'view'
  // メンテナンス中の表示（タイトル画面で30秒ごとに確認）
  const [maint, setMaint] = useState({ on: false, message: '' });
  useEffect(() => {
    if (started && user) return undefined;
    let alive = true;
    const check = () => fetch(`${SERVER_URL}/maintenance`, { cache: 'no-store' }).then((r) => r.json()).then((m) => { if (alive) setMaint({ on: !!m.on, message: m.message || '' }); }).catch(() => {});
    check();
    const t = setInterval(check, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [started, user]);
  // ログインの前に利用規約への同意を確認する（同意済みならそのまま進む）
  const start = async () => {
    if (busy) return;
    if (!hasAgreed()) { setTerms('consent'); return; } // 既存のログイン済みの人も、初回は同意を確認
    if (user || (await login())) setStarted(true);
  };
  const doLogin = async () => {
    if (!hasAgreed()) { setTerms('consent'); return; }
    if (await login()) setStarted(true);
  };

  useBgm(started && user ? null : 'title');
  if (user === undefined) return <Loading />;
  if (!started || !user) {
    return (
      <>
        <Title maintenance={maint} user={user} onStart={start} onLogin={doLogin} onLogout={() => signOut(auth)} busy={busy} error={error} />
        <button onClick={() => setTerms('view')} className="fixed left-1/2 -translate-x-1/2 bottom-2 z-20 text-xs text-white/85 underline drop-shadow-[0_1px_3px_rgba(0,0,0,.9)]">利用規約・お問い合わせ</button>
        {terms && <Terms mode={terms} onClose={() => setTerms(null)} onAgree={async () => { setTerms(null); if (user || (await login())) setStarted(true); }} />}
      </>
    );
  }
  return <Authed user={user} onMaintenance={(msg) => { setMaint({ on: true, message: msg }); setStarted(false); }} />;
}
