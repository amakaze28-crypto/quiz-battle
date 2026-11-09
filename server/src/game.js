import { cfg } from './config.js';
import { calculateRateChange, applyDelta } from './rating.js';
import { rankInfo } from './rank.js';
import * as store from './store.js';
import { getEmperorSet, refreshEmperors } from './emperors.js';

const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);
const limitSec = () => cfg.questionTimeMs / 1000;

export class Room {
  constructor(io, id, entries, questions, onClose) {
    this.io = io;
    this.id = id;
    this.questions = questions;
    this.onClose = onClose;
    this.closed = false;
    this.timers = new Set();
    this.cur = null;
    this.players = entries.map((e) => ({
      uid: e.uid, name: e.name, photoURL: e.photoURL, socket: e.socket,
      rating: e.rating, rankLabel: e.rankLabel, rankKey: e.rankKey, rankSub: e.rankSub,
      score: 0, times: [], connected: true,
    }));
  }

  byUid(uid) { return this.players.find((p) => p.uid === uid); }

  after(ms, fn) {
    const t = setTimeout(() => { this.timers.delete(t); if (!this.closed) fn(); }, ms);
    this.timers.add(t);
    return t;
  }

  clear(t) { if (t) { clearTimeout(t); this.timers.delete(t); } }

  start() {
    this.players.forEach((p) => p.socket.join(this.id));
    this.io.to(this.id).emit('match:found', {
      roomId: this.id,
      total: this.questions.length,
      countdownMs: cfg.countdownMs,
      players: this.players.map((p) => ({ uid: p.uid, name: p.name, photoURL: p.photoURL, rank: p.rankLabel, rankKey: p.rankKey, rankSub: p.rankSub })),
    });
    this.after(cfg.countdownMs, () => this.startQuestion(0));
  }

  startQuestion(index) {
    const q = this.questions[index];
    this.cur = {
      index, startedAt: Date.now(), done: false,
      answered: new Set(), wrong: new Set(), candidates: [],
      firstCorrect: null, resolveTimer: null, timeoutTimer: null,
    };
    this.cur.timeoutTimer = this.after(cfg.questionTimeMs, () => {
      if (this.cur.candidates.length) this.resolveQuestion();
      else this.endQuestion(null, 0);
    });
    // 正解・解説は送らない
    this.io.to(this.id).emit('question', {
      index, total: this.questions.length, id: q.id, question: q.question, choices: q.choices,
      timeLimitMs: cfg.questionTimeMs, serverTime: Date.now(),
    });
  }

  handleAnswer(uid, { index, choice }) {
    const c = this.cur;
    if (!c || c.done || index !== c.index) return;
    const p = this.byUid(uid);
    if (!p || c.answered.has(uid)) return; // 1問につき1回だけ（お手つきしたらその問題は解答権なし）
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;

    // ラグ補正: サーバー受信時刻 − 片道遅延(RTT/2, 上限あり)。クライアント申告タイムは信用しない
    const recv = Date.now() - c.startedAt;
    const comp = Math.min((p.socket.data.rtt || 0) / 2, cfg.maxLagCompMs);
    const adj = Math.max(0, recv - comp);
    c.answered.add(uid);

    if (choice === this.questions[c.index].answer) {
      c.candidates.push({ uid, adj });
      if (!c.firstCorrect) {
        c.firstCorrect = uid;
        this.io.to(this.id).emit('question:locked', { by: uid }); // 他の人の画面をロック
        c.resolveTimer = this.after(cfg.buzzWindowMs, () => this.resolveQuestion());
      }
    } else {
      c.wrong.add(uid); // お手つき
      p.socket.emit('answer:result', { correct: false, choice });
      this.io.to(this.id).emit('player:locked', { uid });
      this.checkAllDone();
    }
  }

  checkAllDone() {
    const c = this.cur;
    if (c.done || c.firstCorrect) return;
    const alive = this.players.filter((p) => p.connected);
    if (alive.every((p) => c.answered.has(p.uid))) this.endQuestion(null, 0);
  }

  resolveQuestion() {
    const c = this.cur;
    if (c.done) return;
    const best = [...c.candidates].sort((a, b) => a.adj - b.adj)[0];
    this.endQuestion(best.uid, best.adj);
  }

  endQuestion(winnerUid, winnerMs) {
    const c = this.cur;
    if (c.done) return;
    c.done = true;
    this.clear(c.timeoutTimer);
    this.clear(c.resolveTimer);

    const limit = limitSec();
    for (const p of this.players) {
      const cand = c.candidates.find((x) => x.uid === p.uid);
      let t;
      if (cand) t = cand.adj / 1000;                       // 正解した人は自分のタイム
      else if (c.wrong.has(p.uid)) t = limit;              // お手つきは60秒扱い
      else t = winnerUid ? winnerMs / 1000 : limit;        // 未回答は決着時刻(誰も正解なしなら60秒)
      p.times.push(Math.min(t, limit));
    }
    if (winnerUid) this.byUid(winnerUid).score += 1;

    const q = this.questions[c.index];
    this.io.to(this.id).emit('question:result', {
      index: c.index, correctIndex: q.answer, explanation: q.explanation,
      winnerUid, scores: Object.fromEntries(this.players.map((p) => [p.uid, p.score])),
    });

    const last = c.index + 1 >= this.questions.length;
    this.after(cfg.resultPauseMs, () => (last ? this.finish() : this.startQuestion(c.index + 1)));
  }

  onDisconnect(uid) {
    const p = this.byUid(uid);
    if (!p) return;
    p.connected = false;
    if (this.players.every((x) => !x.connected)) return this.close();
    if (this.cur && !this.cur.done) this.checkAllDone();
  }

  async finish() {
    for (const p of this.players) p.avgTime = mean(p.times);
    const sorted = [...this.players].sort((a, b) => b.score - a.score || a.avgTime - b.avgTime);
    sorted.forEach((p, i) => { p.place = i + 1; });

    for (const p of this.players) {
      const others = this.players.filter((o) => o !== p);
      p.delta = calculateRateChange(
        p.score, mean(others.map((o) => o.score)),
        p.avgTime, mean(others.map((o) => o.avgTime)),
        p.rating, mean(others.map((o) => o.rating)),
      );
    }

    try {
      for (const p of this.players) {
        const fresh = await store.getOrCreateUser(p.uid, p.name, p.photoURL);
        const next = applyDelta(fresh, p.delta);
        next.games = (fresh.games || 0) + 1;
        next.wins = (fresh.wins || 0) + (p.delta > 0 ? 1 : 0);
        next.losses = (fresh.losses || 0) + (p.delta < 0 ? 1 : 0);
        await store.updateUser(p.uid, next);
        p.profile = next;
      }
      await refreshEmperors();
      await store.saveMatch({
        roomId: this.id,
        results: this.players.map((p) => ({ uid: p.uid, score: p.score, avgTime: p.avgTime, place: p.place, delta: p.delta })),
      });
    } catch (e) {
      console.error('[game] レート保存失敗', e);
    }

    const emperors = getEmperorSet();
    const infoOf = (p) => (p.profile ? rankInfo(p.profile, emperors) : { label: p.rankLabel, key: p.rankKey, sub: p.rankSub });
    this.io.to(this.id).emit('match:end', {
      total: this.questions.length,
      results: sorted.map((p) => ({
        uid: p.uid, name: p.name, photoURL: p.photoURL, score: p.score,
        avgTime: Math.round(p.avgTime * 100) / 100, place: p.place, delta: p.delta,
        rank: infoOf(p).label, rankKey: infoOf(p).key, rankSub: infoOf(p).sub,
        pt: p.profile?.pt ?? null, mr: p.profile?.mr ?? null,
      })),
    });
    for (const p of this.players) {
      if (p.profile) {
        const x = p.profile;
        p.socket.emit('profile', {
          uid: x.uid, displayName: x.displayName, photoURL: x.photoURL, email: x.email, pt: x.pt, mr: x.mr, isMaster: x.isMaster,
          wins: x.wins, losses: x.losses, games: x.games, isAdmin: !!p.socket.data.isAdmin, rank: rankInfo(x, emperors),
        });
      }
    }
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.onClose(this);
  }
}
