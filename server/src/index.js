import http from 'http';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { cfg } from './config.js';
import * as store from './store.js';
import { reloadQuestions, seedIfEmpty, pickQuestions, publishedCount } from './questions.js';
import { mountAdmin } from './admin.js';
import { Matchmaker } from './matchmaker.js';
import { Room } from './game.js';
import { rankInfo, ratingValue } from './rank.js';
import { getEmperorSet, startEmperorRefresh } from './emperors.js';

store.initStore();
await seedIfEmpty();
await reloadQuestions();
startEmperorRefresh();

const app = express();
app.use(cors({ origin: cfg.origin }));
app.get('/health', (_req, res) => res.json({ ok: true })); // Renderのヘルスチェック／スリープ解除用

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: cfg.origin } });

const roomsByUid = new Map();
const profilePayload = (p, isAdmin) => ({
  uid: p.uid, displayName: p.displayName, photoURL: p.photoURL, email: p.email, pt: p.pt, mr: p.mr, isMaster: p.isMaster,
  wins: p.wins, losses: p.losses, games: p.games, isAdmin: !!isAdmin, rank: rankInfo(p, getEmperorSet()),
});

const matchmaker = new Matchmaker((group) => {
  const questions = pickQuestions();
  if (!questions.length) {
    group.forEach((e) => e.socket.emit('queue:error', '現在出題できる問題がありません'));
    return;
  }
  const room = new Room(io, crypto.randomUUID(), group, questions, (r) => {
    r.players.forEach((p) => { if (roomsByUid.get(p.uid) === r) roomsByUid.delete(p.uid); });
  });
  group.forEach((e) => roomsByUid.set(e.uid, room));
  room.start();
});

mountAdmin(app, { io, matchmaker });

io.use(async (socket, next) => {
  let user;
  try {
    user = await store.verifyToken(socket.handshake.auth?.token);
  } catch {
    return next(new Error('認証に失敗しました'));
  }
  const profile = await store.getOrCreateUser(user.uid, user.name, user.photoURL, user.email);
  if (profile.banned) {
    const err = new Error('BANNED');
    err.data = { reason: profile.banReason || '' };
    return next(err);
  }
  Object.assign(socket.data, user, { name: profile.displayName || user.name });
  socket.data.profile = profile;
  next();
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
  const { uid, name, photoURL, email, isAdmin } = socket.data;
  socket.emit('profile', profilePayload(socket.data.profile, isAdmin));

  measureRtt(socket);
  const rttTimer = setInterval(() => measureRtt(socket), 5000);

  socket.on('queue:join', async () => {
    if (roomsByUid.has(uid) || matchmaker.has(uid)) return socket.emit('queue:error', 'すでに参加中です');
    if (publishedCount() === 0) return socket.emit('queue:error', '現在出題できる問題がありません');
    const fresh = await store.getOrCreateUser(uid, name, photoURL, email);
    if (fresh.banned) return;
    const info = rankInfo(fresh, getEmperorSet());
    matchmaker.join({
      uid, name: fresh.displayName || name, photoURL, socket, rating: ratingValue(fresh),
      rankLabel: info.label, rankKey: info.key, rankSub: info.sub,
    });
  });

  socket.on('profile:setName', async (raw, ack) => {
    const n = typeof raw === 'string' ? raw.trim() : '';
    if (n.length < 1 || n.length > 16) return ack?.({ ok: false, error: '表示名は1〜16文字で入力してください' });
    await store.updateUser(uid, { displayName: n });
    const fresh = await store.getOrCreateUser(uid, name, photoURL, email);
    socket.data.name = n;
    socket.emit('profile', profilePayload(fresh, isAdmin));
    ack?.({ ok: true });
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
