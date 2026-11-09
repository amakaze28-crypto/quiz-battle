import express from 'express';
import * as store from './store.js';
import { normalizeQuestion, reloadQuestions } from './questions.js';
import { rankInfo, ratingValue } from './rank.js';
import { getEmperorSet } from './emperors.js';
import { saveSettings, settings } from './settings.js';
import * as missions from './missions.js';

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
        uid: u.uid, displayName: u.displayName, email: u.email || '', iconId: u.iconId || 'default', frameId: u.frameId || 'none', coins: u.coins || 0, sand: u.sand || 0, friendCode: u.friendCode || '',
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

  // ---- コイン・砂の付与（マイナスで減算） ----
  r.post('/players/:uid/coins', wrap(async (req, res) => {
    const u = await store.getUser(req.params.uid);
    const delta = Math.round(Number(req.body.delta));
    const key = req.body.currency === 'sand' ? 'sand' : 'coins';
    if (!u || !Number.isFinite(delta)) return res.status(400).json({ error: '入力が不正です' });
    await store.updateUser(u.uid, { [key]: Math.max(0, (u[key] || 0) + delta) });
    res.json({ ok: true });
  }));

  // ---- メール(プレゼント) ----
  r.get('/mails', wrap(async (_req, res) => {
    res.json({ mails: (await store.colList('mails')).sort((a, b) => b.createdAt - a.createdAt) });
  }));
  r.post('/mails', wrap(async (req, res) => {
    const title = String(req.body.title || '').trim().slice(0, 60);
    const body = String(req.body.body || '').trim().slice(0, 1000);
    const coins = Math.max(0, Math.round(Number(req.body.coins) || 0));
    const sand = Math.max(0, Math.round(Number(req.body.sand) || 0));
    const to = String(req.body.to || 'all').trim() || 'all';
    if (!title) return res.status(400).json({ error: 'タイトルを入力してください' });
    if (to !== 'all' && !(await store.getUser(to))) return res.status(400).json({ error: '宛先のUIDが見つかりません' });
    const id = await store.colAdd('mails', { to, title, body, coins, sand, createdAt: Date.now() });
    res.json({ id });
  }));
  r.delete('/mails/:id', wrap(async (req, res) => { await store.colDel('mails', req.params.id); res.json({ ok: true }); }));

  // ---- 設定（ミッション報酬・改名コスト・Secondary確率） ----
  // ---- ウィークリー／スペシャルミッション ----
  r.get('/missions', wrap(async (_req, res) => res.json({ missions: await missions.reloadDefs(), types: missions.TYPES })));
  r.post('/missions', wrap(async (req, res) => {
    const n = missions.normalizeDef(req.body || {});
    if (n.error) return res.status(400).json({ error: n.error });
    const id = await store.colAdd('missionDefs', n.value);
    await missions.reloadDefs();
    res.json({ id });
  }));
  r.put('/missions/:id', wrap(async (req, res) => {
    const cur = await store.colGet('missionDefs', req.params.id);
    if (!cur) return res.status(404).json({ error: '見つかりません' });
    const n = missions.normalizeDef({ ...cur, ...(req.body || {}) });
    if (n.error) return res.status(400).json({ error: n.error });
    await store.colSet('missionDefs', req.params.id, n.value);
    await missions.reloadDefs();
    res.json({ ok: true });
  }));
  r.delete('/missions/:id', wrap(async (req, res) => { await store.colDel('missionDefs', req.params.id); await missions.reloadDefs(); res.json({ ok: true }); }));

  r.get('/settings', wrap(async (_req, res) => res.json(settings())));
  r.put('/settings', wrap(async (req, res) => res.json(await saveSettings(req.body || {}))));

  // ---- アイテム（アイコン・フレーム・バナー）。画像はブラウザ側で縮小したdata URLを想定 ----
  const TYPES = ['icon', 'frame', 'banner'];
  const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const okImage = (v) => typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(v) && v.length < 700_000;
  r.get('/items', wrap(async (_req, res) => {
    res.json({ items: (await store.colList('items')).map(({ image, ...i }) => i).sort((a, b) => b.createdAt - a.createdAt) });
  }));
  r.post('/items', wrap(async (req, res) => {
    const name = String(req.body.name || '').trim().slice(0, 30);
    const price = Math.max(0, Math.round(Number(req.body.price) || 0));
    const { type, rarity } = req.body;
    if (!name) return res.status(400).json({ error: '名前を入力してください' });
    if (!TYPES.includes(type) || !RAR.includes(rarity)) return res.status(400).json({ error: '種類とレア度を選んでください' });
    if (!okImage(req.body.image)) return res.status(400).json({ error: '画像(PNG/JPEG/WebP・約500KB未満)を指定してください' });
    res.json({ id: await store.colAdd('items', { name, type, rarity, price, image: req.body.image, onShop: !!req.body.onShop, inGacha: !!req.body.inGacha, createdAt: Date.now() }) });
  }));
  r.put('/items/:id', wrap(async (req, res) => {
    const patch = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) patch.name = req.body.name.trim().slice(0, 30);
    if (req.body.price !== undefined && Number.isFinite(Number(req.body.price))) patch.price = Math.max(0, Math.round(Number(req.body.price)));
    if (RAR.includes(req.body.rarity)) patch.rarity = req.body.rarity;
    if (typeof req.body.onShop === 'boolean') patch.onShop = req.body.onShop;
    if (typeof req.body.inGacha === 'boolean') patch.inGacha = req.body.inGacha;
    if (!(await store.colGet('items', req.params.id))) return res.status(404).json({ error: 'アイテムが見つかりません' });
    await store.colSet('items', req.params.id, patch);
    res.json({ ok: true });
  }));

  // ---- 通報メッセージ ----
  r.get('/reports', wrap(async (_req, res) => {
    const list = (await store.colList('reports')).sort((a, b) => b.createdAt - a.createdAt).slice(0, 300);
    res.json({ reports: list, unresolved: list.filter((x) => !x.resolved).length });
  }));
  r.post('/reports/:id/resolve', wrap(async (req, res) => {
    await store.colSet('reports', req.params.id, { resolved: req.body.resolved !== false });
    res.json({ ok: true });
  }));

  app.use('/admin', r);
}
