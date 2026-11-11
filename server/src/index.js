import http from 'http';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { cfg } from './config.js';
import * as store from './store.js';
import { reloadQuestions, seedIfEmpty, pickQuestions, publishedCount } from './questions.js';
import { mountAdmin } from './admin.js';
import { mountApi } from './api.js';
import { loadSettings, maintenance } from './settings.js';
import { profilePayload } from './profile.js';
import * as presence from './presence.js';
import * as loginstats from './loginstats.js';
import * as missions from './missions.js';
import { Matchmaker } from './matchmaker.js';
import { Room } from './game.js';
import { rankInfo, ratingValue } from './rank.js';
import { getEmperorSet, startEmperorRefresh } from './emperors.js';
import * as badges from './badges.js';
import { startSeasonTimer } from './seasons.js';

store.initStore();
await loadSettings();
await seedIfEmpty();
await reloadQuestions();
await missions.reloadDefs();
startEmperorRefresh();
await badges.reloadBadgeDefs();
startSeasonTimer();

const app = express();
app.use(cors({ origin: cfg.origin }));
app.get('/health', (_req, res) => res.json({ ok: true })); // Renderのヘルスチェック／スリープ解除用

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: cfg.origin } });

const roomsByUid = new Map();

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

loginstats.startSampler();
mountAdmin(app, { io, matchmaker });
mountApi(app);

io.use(async (socket, next) => {
  let user;
  try {
    user = await store.verifyToken(socket.handshake.auth?.token);
  } catch {
    return next(new Error('認証に失敗しました'));
  }
  if (maintenance().on && !user.isAdmin) {
    const err = new Error('MAINTENANCE');
    err.data = { message: maintenance().message };
    return next(err);
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
  const wasOnline = presence.isOnline(uid);
  presence.add(uid);
  if (!wasOnline) {
    // ログイン時刻の記録とデイリーミッション「ログインする」の達成
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10); // 日本時間の日付
    const newDay = socket.data.profile.lastLoginDay !== today;
    await store.updateUser(uid, { lastLoginAt: Date.now(), ...(newDay ? { lastLoginDay: today, loginDays: (socket.data.profile.loginDays || 0) + 1 } : {}), missions: missions.touchLogin(socket.data.profile), mprog: missions.recordEvent(socket.data.profile, { login: 1 }) });
  }
  if (!wasOnline) { loginstats.recordLogin(uid); await badges.award(uid, { login: true }); }
  const current = await store.getUser(uid);
  socket.emit('profile', profilePayload(current, isAdmin));
  // 対戦中に切断していたら、ログインし直した時点で自動的に対戦へ戻す
  if (!roomsByUid.get(uid)?.reconnect(uid, socket)) socket.emit('room:none');

  measureRtt(socket);
  const rttTimer = setInterval(() => measureRtt(socket), 5000);

  socket.on('queue:join', async () => {
    if (roomsByUid.has(uid) || matchmaker.has(uid)) return socket.emit('queue:error', 'すでに参加中です');
    if (publishedCount() === 0) return socket.emit('queue:error', '現在出題できる問題がありません');
    const fresh = await store.getOrCreateUser(uid, name, photoURL, email);
    if (fresh.banned) return;
    const info = rankInfo(fresh, getEmperorSet());
    matchmaker.join({
      uid, name: fresh.displayName || name, iconId: fresh.iconId || 'default', frameId: fresh.frameId || 'none', bannerId: fresh.cardId || 'none', // 対戦画面の帯には、バナー(プレイヤーカードの台紙)の絵を使う
       socket, rating: ratingValue(fresh),
      rankLabel: info.label, rankKey: info.key, rankSub: info.sub,
    });
  });

  socket.on('queue:leave', () => matchmaker.leave(uid));

  socket.on('answer', (payload) => {
    const room = roomsByUid.get(uid);
    if (room && payload) room.handleAnswer(uid, payload);
  });

  socket.on('disconnect', () => {
    clearInterval(rttTimer);
    if (presence.remove(uid) === 0) store.updateUser(uid, { lastSeenAt: Date.now() }).catch(() => {});
    matchmaker.leave(uid);
    roomsByUid.get(uid)?.onDisconnect(uid, socket);
  });
});

server.listen(cfg.port, () => console.log(`[server] listening on :${cfg.port}`));
