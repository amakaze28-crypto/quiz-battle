import express from 'express';
import * as store from './store.js';
import { normalizeQuestion, reloadQuestions } from './questions.js';
import { rankInfo, ratingValue } from './rank.js';
import { getEmperorSet } from './emperors.js';

export function mountAdmin(app, { io, matchmaker }) {
  const r = express.Router();
  r.use(express.json({ limit: '3mb' }));

  r.use(async (req, res, next) => {
    try {
      const token = (req.headers.authorization || '').replace(/^Bearer /, '');
      const u = await store.verifyToken(token);
      if (!u.isAdmin) return res.status(403).json({ error: '管理者権限がありません' });
      req.admin = u;
      next();
    } catch {
      res.status(401).json({ error: '認証に失敗しました' });
    }
  });

  const wrap = (fn) => async (req, res) => {
    try { await fn(req, res); } catch (e) { console.error('[admin]', e); res.status(500).json({ error: 'サーバーエラー' }); }
  };

  // ---- 問題 ----
  r.get('/questions', wrap(async (_req, res) => {
    const list = await store.listQuestions();
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.json({ questions: list, publishedCount: list.filter((q) => q.published).length });
  }));

  r.post('/questions', wrap(async (req, res) => {
    const n = normalizeQuestion(req.body);
    if (!n.ok) return res.status(400).json({ error: n.error });
    const [created] = await store.createQuestions([{ ...n.value, published: !!req.body.published }]);
    await reloadQuestions();
    res.json({ question: created });
  }));

  // 先に定義（:id より前）
  r.post('/questions/import', wrap(async (req, res) => {
    const list = Array.isArray(req.body.questions) ? req.body.questions : null;
    if (!list) return res.status(400).json({ error: '"questions" に配列を指定してください' });
    const existing = new Set((await store.listQuestions()).map((q) => q.question));
    const toCreate = []; const errors = []; let skipped = 0;
    list.forEach((raw, i) => {
      const n = normalizeQuestion(raw);
      if (!n.ok) return errors.push({ index: i, message: n.error });
      if (existing.has(n.value.question)) { skipped += 1; return; }
      existing.add(n.value.question);
      toCreate.push({ ...n.value, published: !!req.body.published });
    });
    if (toCreate.length) await store.createQuestions(toCreate);
    await reloadQuestions();
    res.json({ imported: toCreate.length, skipped, errors });
  }));

  r.put('/questions/:id', wrap(async (req, res) => {
    const n = normalizeQuestion(req.body);
    if (!n.ok) return res.status(400).json({ error: n.error });
    const fields = { ...n.value };
    if (typeof req.body.published === 'boolean') fields.published = req.body.published;
    if (!(await store.updateQuestion(req.params.id, fields))) return res.status(404).json({ error: '問題が見つかりません' });
    await reloadQuestions();
    res.json({ ok: true });
  }));

  r.post('/questions/:id/publish', wrap(async (req, res) => {
    if (!(await store.updateQuestion(req.params.id, { published: !!req.body.published }))) return res.status(404).json({ error: '問題が見つかりません' });
    await reloadQuestions();
    res.json({ ok: true });
  }));

  r.delete('/questions/:id', wrap(async (req, res) => {
    await store.deleteQuestion(req.params.id);
    await reloadQuestions();
    res.json({ ok: true });
  }));

  // ---- プレイヤー ----
  r.get('/players', wrap(async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const emperors = getEmperorSet();
    let users = await store.listUsers();
    if (q) {
      users = users.filter((u) => [u.displayName, u.email, u.uid].some((v) => String(v || '').toLowerCase().includes(q)));
    }
    users.sort((a, b) => ratingValue({ pt: 0, ...b }) - ratingValue({ pt: 0, ...a }));
    res.json({
      total: users.length,
      players: users.slice(0, 200).map((u) => ({
        uid: u.uid, displayName: u.displayName, email: u.email || '', photoURL: u.photoURL || '',
        pt: u.pt ?? 0, mr: u.mr ?? null, isMaster: !!u.isMaster,
        games: u.games || 0, wins: u.wins || 0, losses: u.losses || 0,
        banned: !!u.banned, banReason: u.banReason || '',
        rank: rankInfo({ pt: 0, ...u }, emperors),
      })),
    });
  }));

  r.post('/players/:uid/ban', wrap(async (req, res) => {
    const { uid } = req.params;
    if (uid === req.admin.uid) return res.status(400).json({ error: '自分自身はBANできません' });
    const banned = !!req.body.banned;
    const reason = banned ? String(req.body.reason || '').slice(0, 200) : '';
    await store.updateUser(uid, { banned, banReason: reason, bannedAt: banned ? Date.now() : null });
    if (banned) {
      matchmaker.leave(uid);
      for (const s of io.sockets.sockets.values()) {
        if (s.data.uid === uid) { s.emit('banned', { reason }); s.disconnect(true); }
      }
    }
    res.json({ ok: true });
  }));

  app.use('/admin', r);
}
