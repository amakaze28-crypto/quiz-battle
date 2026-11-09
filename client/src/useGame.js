import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

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
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { qRef.current = q; }, [q]);

  useEffect(() => {
    if (!user) return undefined;
    const s = io(SERVER_URL, { auth: (cb) => { user.getIdToken().then((token) => cb({ token })); } });
    sockRef.current = s;

    s.on('connect', () => { setConn('online'); setError(null); });
    s.on('disconnect', () => setConn('offline'));
    s.on('connect_error', (e) => { setConn('error'); setError(e.message); });
    s.on('sping', (ack) => ack());
    s.on('profile', setProfile);
    s.on('queue:status', setQueue);
    s.on('queue:error', setError);
    s.on('match:found', (m) => {
      setMatch(m); setQueue(null); setPhase('matched');
      setScores(Object.fromEntries(m.players.map((p) => [p.uid, 0])));
    });
    s.on('question', (d) => {
      setQ({ ...d, recvAt: performance.now(), myChoice: null, lockedBy: null, wrong: false, lockedUids: [], result: null });
      setPhase('playing');
    });
    s.on('question:locked', ({ by }) => setQ((x) => x && { ...x, lockedBy: by }));
    s.on('player:locked', ({ uid }) => setQ((x) => x && { ...x, lockedUids: [...x.lockedUids, uid] }));
    s.on('answer:result', ({ correct }) => setQ((x) => x && { ...x, wrong: !correct }));
    s.on('question:result', (r) => { setScores(r.scores); setQ((x) => x && { ...x, result: r }); });
    s.on('match:end', (r) => { setResult(r); setPhase('result'); });

    return () => { s.disconnect(); };
  }, [user]);

  const joinQueue = useCallback(() => { setError(null); setPhase('queue'); sockRef.current?.emit('queue:join'); }, []);
  const leaveQueue = useCallback(() => { sockRef.current?.emit('queue:leave'); setQueue(null); setPhase('home'); }, []);
  const goHome = useCallback(() => { setPhase('home'); setResult(null); setMatch(null); setQ(null); }, []);

  const answer = useCallback((choice) => {
    const x = qRef.current;
    if (!x || x.myChoice !== null || x.lockedBy || x.result) return;
    sockRef.current?.emit('answer', { index: x.index, choice, clientMs: Math.round(performance.now() - x.recvAt) });
    setQ((v) => v && { ...v, myChoice: choice });
  }, []);

  return { conn, profile, phase, queue, match, q, scores, result, error, joinQueue, leaveQueue, goHome, answer };
}
