import http from 'http';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { cfg } from './config.js';
import * as store from './store.js';
import { loadQuestions, pickQuestions } from './questions.js';
import { Matchmaker } from './matchmaker.js';
import { Room } from './game.js';
import { rankInfo, ratingValue } from './rank.js';
import { getEmperorSet, startEmperorRefresh } from './emperors.js';

store.initStore();
loadQuestions();
startEmperorRefresh();

const app = express();
app.use(cors({ origin: cfg.origin }));
app.get('/health', (_req, res) => res.json({ ok: true })); // Renderのヘルスチェック／スリープ解除用

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: cfg.origin } });

const roomsByUid = new Map();
const profilePayload = (p) => ({ ...p, rank: rankInfo(p, getEmperorSet()) });

const matchmaker = new Matchmaker((group) => {
  const room = new Room(io, crypto.randomUUID(), group, pickQuestions(), (r) => {
    r.players.forEach((p) => { if (roomsByUid.get(p.uid) === r) roomsByUid.delete(p.uid); });
  });
  group.forEach((e) => roomsByUid.set(e.uid, room));
  room.start();
});

io.use(async (socket, next) => {
  try {
    const user = await store.verifyToken(socket.handshake.auth?.token);
    Object.assign(socket.data, user);
    next();
  } catch {
    next(new Error('認証に失敗しました'));
  }
});

// 通信遅延(RTT)を定期計測してラグ補正に使う
function measureRtt(socket) {
  const t0 = Date.now();
  socket.timeout(3000).emit('sping', (err) => {
    if (err) return;
    const rtt = Date.now() - t0;
    socket.data.rtt = socket.data.rtt ? socket.data.rtt * 0.6 + rtt * 0.4 : rtt;
  });
}

io.on('connection', async (socket) => {
  const { uid, name, photoURL } = socket.data;
  const profile = await store.getOrCreateUser(uid, name, photoURL);
  socket.emit('profile', profilePayload(profile));

  measureRtt(socket);
  const rttTimer = setInterval(() => measureRtt(socket), 5000);

  socket.on('queue:join', async () => {
    if (roomsByUid.has(uid) || matchmaker.has(uid)) return socket.emit('queue:error', 'すでに参加中です');
    const fresh = await store.getOrCreateUser(uid, name, photoURL);
    matchmaker.join({
      uid, name, photoURL, socket, rating: ratingValue(fresh),
      rankLabel: rankInfo(fresh, getEmperorSet()).label,
    });
  });

  socket.on('queue:leave', () => matchmaker.leave(uid));

  socket.on('answer', (payload) => {
    const room = roomsByUid.get(uid);
    if (room && payload) room.handleAnswer(uid, payload);
  });

  socket.on('disconnect', () => {
    clearInterval(rttTimer);
    matchmaker.leave(uid);
    roomsByUid.get(uid)?.onDisconnect(uid);
  });
});

server.listen(cfg.port, () => console.log(`[server] listening on :${cfg.port}`));
