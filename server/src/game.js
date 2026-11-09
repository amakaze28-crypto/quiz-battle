import { cfg } from './config.js';
import { calculateRateChange, applyDelta } from './rating.js';
import { rankInfo } from './rank.js';
import * as store from './store.js';
import * as missions from './missions.js';
import { settings } from './settings.js';
import { registerRoom } from './recent.js';
import { profilePayload } from './profile.js';
import { getEmperorSet, refreshEmperors } from './emperors.js';
import { planAnswer, isBot } from './bots.js';

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
      uid: e.uid, name: e.name, iconId: e.iconId, frameId: e.frameId, bannerId: e.bannerId, socket: e.socket,
      rating: e.rating, rankLabel: e.rankLabel, rankKey: e.rankKey, rankSub: e.rankSub,
      score: 0, secondaries: 0, times: [], connected: true,
      isBot: !!e.isBot, bot: e.bot || null, stat: { q: 0, correct: 0, ans: 0, time: 0 },
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
    registerRoom(this.id, this.players.filter((p) => !p.isBot)); // 通報の対象はbot以外
    this.players.forEach((p) => p.socket.join(this.id));
    this.hasBots = this.players.some((p) => p.isBot);
    this.io.to(this.id).emit('match:found', {
      roomId: this.id,
      total: this.questions.length,
      countdownMs: cfg.countdownMs,
      players: this.players.map((p) => ({ uid: p.uid, isBot: p.isBot, name: p.name, iconId: p.iconId, frameId: p.frameId, bannerId: p.bannerId, rank: p.rankLabel, rankKey: p.rankKey, rankSub: p.rankSub })),
    });
    this.after(cfg.countdownMs, () => this.startQuestion(0));
  }

  startQuestion(index) {
    const q = this.questions[index];
    this.cur = { index, startedAt: Date.now(), done: false, answers: new Map(), timeoutTimer: null };
    this.cur.timeoutTimer = this.after(cfg.questionTimeMs, () => this.endQuestion());
    // botは、同ランク帯の平均正答率・平均秒数から決めたタイミングで解答する
    for (const p of this.players) {
      if (!p.isBot) continue;
      const plan = planAnswer(p.bot, q.answer);
      this.after(plan.delayMs, () => this.handleAnswer(p.uid, { index, choice: plan.choice }));
    }
    // 正解・解説は送らない
    this.io.to(this.id).emit('question', {
      index, total: this.questions.length, id: q.id, question: q.question, choices: q.choices,
      timeLimitMs: cfg.questionTimeMs, serverTime: Date.now(),
    });
  }

  // 他の人が正解した後も、全員が解答を終えるか制限時間まで解答できる。
  // 正解ごとに1点。Secondary(既定5%)が発動するとその問題の得点が2倍。誤答(お手つき)はその問題の解答権を失う
  handleAnswer(uid, { index, choice }) {
    const c = this.cur;
    if (!c || c.done || index !== c.index) return;
    const p = this.byUid(uid);
    if (!p || c.answers.has(uid)) return;
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;

    // ラグ補正: サーバー受信時刻 − 片道遅延(RTT/2, 上限あり)。クライアント申告タイムは信用しない
    const recv = Date.now() - c.startedAt;
    const comp = Math.min((p.socket.data.rtt || 0) / 2, cfg.maxLagCompMs);
    const adj = Math.max(0, recv - comp);

    const correct = choice === this.questions[c.index].answer;
    const secondary = correct && Math.random() < settings().secondaryChance;
    const gain = correct ? (secondary ? 2 : 1) : 0;
    c.answers.set(uid, { choice, correct, adj, gain, secondary });

    p.socket.emit('answer:result', { correct, gain, secondary, choice });
    this.io.to(this.id).emit('player:answered', { uid }); // 正誤は伏せる
    this.checkAllDone();
  }

  checkAllDone() {
    const c = this.cur;
    if (!c || c.done) return;
    const alive = this.players.filter((p) => p.connected);
    if (alive.every((p) => c.answers.has(p.uid))) this.endQuestion();
  }

  endQuestion() {
    const c = this.cur;
    if (!c || c.done) return;
    c.done = true;
    this.clear(c.timeoutTimer);

    const limit = limitSec();
    const results = {};
    for (const p of this.players) {
      const a = c.answers.get(p.uid);
      const t = a?.correct ? a.adj / 1000 : limit; // 誤答・未回答は60秒扱い
      p.times.push(Math.min(t, limit));
      p.stat.q += 1;
      if (a) { p.stat.ans += 1; p.stat.time += Math.min(a.adj / 1000, limit); if (a.correct) p.stat.correct += 1; }
      if (a) {
        p.score += a.gain;
        if (a.secondary) p.secondaries += 1;
        results[p.uid] = { choice: a.choice, correct: a.correct, gain: a.gain, secondary: a.secondary, timeSec: Math.round(t * 100) / 100 };
      } else {
        results[p.uid] = { choice: null, correct: false, gain: 0, secondary: false, timeSec: limit };
      }
    }

    const q = this.questions[c.index];
    this.io.to(this.id).emit('question:result', {
      index: c.index, correctIndex: q.answer, explanation: q.explanation, results,
      scores: Object.fromEntries(this.players.map((p) => [p.uid, p.score])),
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
        if (p.isBot) continue;
        const fresh = await store.getUser(p.uid);
        if (!fresh) continue;
        const won = p.delta > 0;
        const next = applyDelta(fresh, p.delta);
        next.games = (fresh.games || 0) + 1;
        next.wins = (fresh.wins || 0) + (won ? 1 : 0);
        next.losses = (fresh.losses || 0) + (p.delta < 0 ? 1 : 0);
        next.missions = missions.recordMatch(fresh, won);
        // bot用の統計(正答率・平均解答秒数)
        next.statQ = (fresh.statQ || 0) + p.stat.q; next.statCorrect = (fresh.statCorrect || 0) + p.stat.correct;
        next.statAns = (fresh.statAns || 0) + p.stat.ans; next.statTime = (fresh.statTime || 0) + p.stat.time;
        await store.updateUser(p.uid, next);
        p.profile = next;
      }
      await refreshEmperors();
      await store.saveMatch({
        roomId: this.id,
        results: this.players.map((p) => ({ uid: p.uid, bot: p.isBot, score: p.score, avgTime: p.avgTime, place: p.place, delta: p.delta })),
      });
    } catch (e) {
      console.error('[game] レート保存失敗', e);
    }

    const emperors = getEmperorSet();
    const infoOf = (p) => (p.profile ? rankInfo(p.profile, emperors) : { label: p.rankLabel, key: p.rankKey, sub: p.rankSub });
    this.io.to(this.id).emit('match:end', {
      roomId: this.id,
      total: this.questions.length,
      results: sorted.map((p) => ({
        uid: p.uid, isBot: p.isBot, name: p.name, iconId: p.iconId, frameId: p.frameId, bannerId: p.bannerId, score: p.score, secondaries: p.secondaries,
        avgTime: Math.round(p.avgTime * 100) / 100, place: p.place, delta: p.delta,
        rank: infoOf(p).label, rankKey: infoOf(p).key, rankSub: infoOf(p).sub,
        pt: p.profile?.pt ?? null, mr: p.profile?.mr ?? null,
      })),
    });
    for (const p of this.players) {
      if (p.profile) p.socket.emit('profile', profilePayload(p.profile, p.socket.data.isAdmin));
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
