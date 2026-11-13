import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from './api';
import { setSeasonNo } from './RankBadge';

export function useGame(user) {
  const sockRef = useRef(null);
  const qRef = useRef(null);
  const [conn, setConn] = useState('connecting'); // connecting | online | offline | error
  const [profile, setProfile] = useState(null);
  const [phase, setPhase] = useState('home'); // home | queue | matched | playing | result
  const [queue, setQueue] = useState(null);
  const [match, setMatch] = useState(null);
  const [q, setQ] = useState(null);
  const [scores, setScores] = useState({});
  const [avgTimes, setAvgTimes] = useState({});
  const [secIntro, setSecIntro] = useState(null); // Secondary告知 { at, ms }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [maintMsg, setMaintMsg] = useState('');
  const [offline, setOffline] = useState([]); // 対戦中に切断している人のuid
  const phaseRef = useRef('home');

  const applyProfile = useCallback((p) => { setSeasonNo(p?.season?.number); setProfile(p); }, []);
  useEffect(() => { qRef.current = q; }, [q]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (!user) return undefined;
    const s = io(SERVER_URL, { auth: (cb) => { user.getIdToken().then((token) => cb({ token })); } });
    sockRef.current = s;

    s.on('connect', () => { setConn('online'); setError(null); });
    s.on('disconnect', () => setConn('offline'));
    s.on('connect_error', (e) => {
      if (e.message === 'MAINTENANCE') { setMaintMsg(e.data?.message || ''); setConn('maintenance'); return; }
      if (e.message === 'BANNED') { setBanReason(e.data?.reason || ''); setConn('banned'); return; }
      setConn('error'); setError(e.message);
    });
    s.on('maintenance', ({ message }) => { setMaintMsg(message || ''); setConn('maintenance'); });
    s.on('banned', ({ reason }) => { setBanReason(reason || ''); setConn('banned'); });
    s.on('sping', (ack) => ack());
    s.on('profile', applyProfile);
    s.on('queue:status', setQueue);
    s.on('queue:error', setError);
    s.on('match:found', (m) => {
      setMatch(m); setQueue(null); setPhase('matched');
      setScores(m.scores || Object.fromEntries(m.players.map((p) => [p.uid, 0])));
      setAvgTimes(m.avgTimes || {}); setSecIntro(null);
      setOffline(m.offline || []);
      if (m.resumed) { setQ(null); setResult(null); }
    });
    s.on('player:status', ({ uid, connected }) => setOffline((o) => (connected ? o.filter((x) => x !== uid) : o.includes(uid) ? o : [...o, uid])));
    // 再ログインしたが、対戦はもう終わっていた
    s.on('room:none', () => {
      if (phaseRef.current === 'matched' || phaseRef.current === 'playing') { setPhase('home'); setMatch(null); setQ(null); setSecIntro(null); setOffline([]); }
    });
    s.on('secondary:intro', (d) => setSecIntro({ at: performance.now(), ms: d.ms }));
    s.on('question', (d) => {
      setQ({ ...d, recvAt: performance.now(), myChoice: null, mine: null, answeredUids: [], result: null });
      setSecIntro(null);
      setPhase('playing');
    });
    s.on('player:answered', ({ uid }) => setQ((x) => x && { ...x, answeredUids: [...x.answeredUids, uid] }));
    s.on('answer:result', (r) => setQ((x) => x && { ...x, mine: r, myChoice: x.myChoice ?? r.choice ?? null }));
    s.on('question:result', (r) => { setScores(r.scores); setAvgTimes(r.avgTimes || {}); setQ((x) => x && { ...x, result: r }); });
    s.on('match:end', (r) => { setResult(r); setPhase('result'); });

    return () => { s.disconnect(); };
  }, [user]);

  const joinQueue = useCallback(() => { setError(null); setPhase('queue'); sockRef.current?.emit('queue:join'); }, []);
  const leaveQueue = useCallback(() => { sockRef.current?.emit('queue:leave'); setQueue(null); setPhase('home'); }, []);
  const goHome = useCallback(() => { setSecIntro(null); setPhase('home'); setResult(null); setMatch(null); setQ(null); setOffline([]); }, []);

  const answer = useCallback((choice) => {
    const x = qRef.current;
    if (!x || x.myChoice !== null || x.result) return;
    sockRef.current?.emit('answer', { index: x.index, choice, clientMs: Math.round(performance.now() - x.recvAt) });
    setQ((v) => v && { ...v, myChoice: choice });
  }, []);

  return { conn, maintMsg, banReason, setProfile: applyProfile, profile, phase, queue, match, offline, q, scores, avgTimes, secIntro, result, error, joinQueue, leaveQueue, goHome, answer };
}
