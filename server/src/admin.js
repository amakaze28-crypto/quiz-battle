import express from 'express';
import * as store from './store.js';
import { normalizeQuestion, reloadQuestions, fileName, catOf } from './questions.js';
import { rankInfo, ratingValue } from './rank.js';
import { getEmperorSet } from './emperors.js';
import { saveSettings, settings, setMaintenance } from './settings.js';
import * as missions from './missions.js';
import { listGachas, normalizeGacha, NORMAL_ID, okBannerData, putBanner, clearBannerChunks } from './gachaDefs.js';
import * as sounds from './sounds.js';
import * as badges from './badges.js';
import { rotateSeason } from './seasons.js';
import * as loginstats from './loginstats.js';
import { cardLayouts, frameFits, cleanLayout, cleanFit } from './cardlayouts.js';


export function mountAdmin(app, { io, matchmaker }) {
  const r = express.Router();
  r.use('/sounds', express.json({ limit: '18mb' })); // 音源は大きいので先に専用の上限で読む
  r.use('/gachas', express.json({ limit: '8mb' })); // 高画質バナー用
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

  // ---- Firestoreの読み取り/書き込み回数（このサーバーが起動してからの合計と内訳） ----
  r.get('/store-stats', wrap(async (_req, res) => {
    const by = Object.entries(store.stats.by).map(([k, n]) => ({ kind: k[0] === 'r' ? 'reads' : 'writes', name: k.slice(2), n })).sort((a, b) => b.n - a.n);
    res.json({ since: store.stats.since, reads: store.stats.reads, writes: store.stats.writes, by: by.slice(0, 12), dev: store.isDevMode() });
  }));

  // ---- 問題 ----
  r.get('/questions', wrap(async (_req, res) => {
    const list = await store.listQuestions();
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.json({ questions: list, publishedCount: list.filter((q) => q.published).length });
  }));

  r.post('/questions', wrap(async (req, res) => {
    const n = normalizeQuestion(req.body);
    if (!n.ok) return res.status(400).json({ error: n.error });
    const cats = await fileCats();
    const [created] = await store.createQuestions([{ ...n.value, category: n.value.category || cats.get(n.value.file) || '', published: !!req.body.published }]);
    await reloadQuestions();
    res.json({ question: created });
  }));

  // ファイルごとの分野（そのファイルで設定済みの分野。なければ空=ファイル名）
  const fileCats = async () => {
    const m = new Map();
    for (const q of await store.listQuestions()) if (q.category && !m.has(fileName(q.file))) m.set(fileName(q.file), q.category);
    return m;
  };

  // 先に定義（:id より前）
  r.post('/questions/import', wrap(async (req, res) => {
    const list = Array.isArray(req.body.questions) ? req.body.questions : null;
    if (!list) return res.status(400).json({ error: '"questions" に配列を指定してください' });
    const all = await store.listQuestions();
    const existing = new Set(all.map((q) => q.question));
    const toCreate = []; const errors = []; let skipped = 0;
    const cats = await fileCats();
    // target を指定すると、全問をそのファイルへ入れる。既存のファイルなら、分野もそのファイルの設定に合わせる（JSON内の分野は無視）
    const target = typeof req.body.target === 'string' && req.body.target.trim() ? fileName(req.body.target) : '';
    const targetExists = !!target && all.some((q) => fileName(q.file) === target);
    list.forEach((raw, i) => {
      const n = normalizeQuestion(raw);
      if (!n.ok) return errors.push({ index: i, message: n.error });
      if (existing.has(n.value.question)) { skipped += 1; return; }
      existing.add(n.value.question);
      const file = target || fileName(raw?.file ?? req.body.file);
      const category = targetExists ? (cats.get(file) || '') : (n.value.category || cats.get(file) || '');
      toCreate.push({ ...n.value, file, category, published: !!req.body.published });
    });
    if (toCreate.length) await store.createQuestions(toCreate);
    await reloadQuestions();
    res.json({ imported: toCreate.length, skipped, errors, file: target, category: target ? (cats.get(target) || target) : '', existing: targetExists });
  }));

  // ファイル単位の操作（名前変更・一括公開/非公開・削除）
  const inFile = async (name) => (await store.listQuestions()).filter((q) => fileName(q.file) === name);
  r.post('/questions/files/rename', wrap(async (req, res) => {
    const from = fileName(req.body.from); const to = fileName(req.body.to);
    const list = await inFile(from);
    await store.updateQuestions(list.map((q) => q.id), { file: to });
    await reloadQuestions();
    res.json({ moved: list.length });
  }));
  // ファイル単位で分野を設定（空にするとファイル名に戻る）
  r.post('/questions/files/category', wrap(async (req, res) => {
    const list = await inFile(fileName(req.body.file));
    const category = typeof req.body.category === 'string' ? req.body.category.trim().slice(0, 40) : '';
    await store.updateQuestions(list.map((q) => q.id), { category });
    await reloadQuestions();
    res.json({ changed: list.length });
  }));
  r.post('/questions/files/publish', wrap(async (req, res) => {
    const list = await inFile(fileName(req.body.file));
    await store.updateQuestions(list.map((q) => q.id), { published: !!req.body.published });
    await reloadQuestions();
    res.json({ changed: list.length });
  }));
  r.post('/questions/files/delete', wrap(async (req, res) => {
    const list = await inFile(fileName(req.body.file));
    await store.deleteQuestions(list.map((q) => q.id));
    await reloadQuestions();
    res.json({ deleted: list.length });
  }));
  // 選んだ問題をまとめて別のファイルへ移動
  r.post('/questions/move', wrap(async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const to = fileName(req.body.to);
    const cat = (await fileCats()).get(to) || '';
    await store.updateQuestions(ids.map(String), { file: to, category: cat });
    await reloadQuestions();
    res.json({ moved: ids.length });
  }));

  r.put('/questions/:id', wrap(async (req, res) => {
    const n = normalizeQuestion(req.body);
    if (!n.ok) return res.status(400).json({ error: n.error });
    const fields = { ...n.value };
    if (typeof req.body.file !== 'string') delete fields.file; // 指定がなければファイルは変えない
    if (typeof req.body.category !== 'string') delete fields.category;
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

  // ---- メンテナンス（オンにすると管理者以外はログインできず、接続中の人もタイトルへ戻る） ----
  r.post('/maintenance', wrap(async (req, res) => {
    const m = await setMaintenance(!!req.body.on, req.body.message);
    if (m.on) {
      for (const [, s] of io.sockets.sockets) {
        if (s.data?.isAdmin) continue;
        s.emit('maintenance', { message: m.message });
        s.disconnect(true);
      }
    }
    res.json(m);
  }));

  // ---- ログイン数（現在のオンライン数と、時間別のグラフ） ----
  r.get('/loginstats', wrap(async (req, res) => res.json(await loginstats.dayView(String(req.query.date || '')))));

  // ---- バナー(カードフレーム)の配置。id ごとに上書き保存 ----
  r.get('/card-layouts', wrap(async (_req, res) => res.json({ layouts: await cardLayouts(), fits: await frameFits() })));
  r.put('/card-layouts', wrap(async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String).slice(0, 200) : [];
    const L = cleanLayout(req.body.layout);
    if (!L) return res.status(400).json({ error: '値が不正です' });
    for (const id of ids) await store.colSet('cardlayouts', id, L);
    res.json({ ok: true, count: ids.length });
  }));
  // アイコンフレームの位置・大きさ
  r.put('/frame-fits', wrap(async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String).slice(0, 200) : [];
    const F = cleanFit(req.body.fit);
    if (!F) return res.status(400).json({ error: '値が不正です' });
    for (const id of ids) await store.colSet('framefits', id, F);
    res.json({ ok: true, count: ids.length });
  }));
  r.delete('/frame-fits/:id', wrap(async (req, res) => { await store.colDel('framefits', req.params.id); res.json({ ok: true }); }));
  r.delete('/card-layouts/:id', wrap(async (req, res) => { await store.colDel('cardlayouts', req.params.id); res.json({ ok: true }); }));

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
  const TYPES = ['icon', 'frame', 'card', 'character', 'bgm'];
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
    const isBgm = type === 'bgm';
    if (!isBgm && !okImage(req.body.image)) return res.status(400).json({ error: '画像(PNG/JPEG/WebP・約500KB未満)を指定してください' });
    if (isBgm && !/^data:(audio\/|video\/mp4|application\/octet-stream)/i.test(req.body.audio || '')) return res.status(400).json({ error: '音声ファイル(mp3 / wav / ogg / m4a)を選んでください' });
    const id = await store.colAdd('items', isBgm
      ? { name, type, rarity, price, onShop: !!req.body.onShop, free: !!req.body.free, inGacha: false, createdAt: Date.now() }
      : { name, type, rarity, price, image: req.body.image, onShop: !!req.body.onShop, inGacha: !!req.body.inGacha, createdAt: Date.now() });
    if (isBgm) {
      try { await sounds.saveSound(`bgm_${id}`, req.body.audioName || name, req.body.audio); } catch (e) { await store.colDel('items', id); return res.status(400).json({ error: e.message }); }
    }
    // 追加時に調整した位置（バナー=配置、アイコンフレーム=位置と大きさ）も一緒に保存
    if (type === 'card' && req.body.layout) { const L = cleanLayout(req.body.layout); if (L) await store.colSet('cardlayouts', id, L); }
    if (type === 'frame' && req.body.fit) { const F = cleanFit(req.body.fit); if (F) await store.colSet('framefits', id, F); }
    res.json({ id });
  }));
  r.put('/items/:id', wrap(async (req, res) => {
    const patch = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) patch.name = req.body.name.trim().slice(0, 30);
    if (req.body.price !== undefined && Number.isFinite(Number(req.body.price))) patch.price = Math.max(0, Math.round(Number(req.body.price)));
    if (RAR.includes(req.body.rarity)) patch.rarity = req.body.rarity;
    if (typeof req.body.onShop === 'boolean') patch.onShop = req.body.onShop;
    if (typeof req.body.inGacha === 'boolean') patch.inGacha = req.body.inGacha;
    if (typeof req.body.free === 'boolean') patch.free = req.body.free;
    const cur = await store.colGet('items', req.params.id);
    if (!cur) return res.status(404).json({ error: 'アイテムが見つかりません' });
    if (cur.type === 'bgm') patch.inGacha = false;
    if (cur.type === 'bgm' && req.body.audio) {
      try { await sounds.saveSound(`bgm_${req.params.id}`, req.body.audioName || cur.name, req.body.audio); } catch (e) { return res.status(400).json({ error: e.message }); }
    }
    await store.colSet('items', req.params.id, patch);
    res.json({ ok: true });
  }));

  // アイテムの削除（画像・位置調整も消す）。持っているユーザーの持ち物からは消さず、装備中なら初期の見た目に戻る
  r.delete('/items/:id', wrap(async (req, res) => {
    const id = req.params.id;
    const it = await store.colGet('items', id);
    if (!it) return res.status(404).json({ error: 'アイテムが見つかりません' });
    await store.colDel('items', id);
    if (it.type === 'bgm') await sounds.deleteSound(`bgm_${id}`);
    if (await store.colGet('cardlayouts', id)) await store.colDel('cardlayouts', id);
    if (await store.colGet('framefits', id)) await store.colDel('framefits', id);
    res.json({ ok: true });
  }));

  // ---- セット（レジェンダリーで出る、キャラ・アイコンなどの一式） ----
  r.get('/sets', wrap(async (_req, res) => {
    res.json({ sets: (await store.colList('sets')).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) });
  }));
  const setBody = async (b) => {
    const name = String(b.name || '').trim().slice(0, 30);
    if (!name) throw new Error('セット名を入力してください');
    const all = new Set((await store.colList('items')).map((i) => i.id));
    const itemIds = [...new Set(Array.isArray(b.itemIds) ? b.itemIds : [])].filter((x) => all.has(x)).slice(0, 12);
    if (!itemIds.length) throw new Error('セットに入れるアイテムを1つ以上選んでください');
    return { name, itemIds, inGacha: b.inGacha !== false };
  };
  r.post('/sets', wrap(async (req, res) => {
    try { res.json({ id: await store.colAdd('sets', { ...(await setBody(req.body)), createdAt: Date.now() }) }); } catch (e) { res.status(400).json({ error: e.message }); }
  }));
  r.put('/sets/:id', wrap(async (req, res) => {
    if (!(await store.colGet('sets', req.params.id))) return res.status(404).json({ error: 'セットが見つかりません' });
    try { await store.colSet('sets', req.params.id, await setBody(req.body)); res.json({ ok: true }); } catch (e) { res.status(400).json({ error: e.message }); }
  }));
  r.delete('/sets/:id', wrap(async (req, res) => { await store.colDel('sets', req.params.id); res.json({ ok: true }); }));

  // ---- ガチャ（通常 / 期間限定。名前・バナー・期間・中身を設定） ----
  r.get('/gachas', wrap(async (_req, res) => {
    res.json({ gachas: (await listGachas()).map((g) => ({ ...g, banner: g.banner ? `/gacha-banner/${g.id}?v=${g.updatedAt}` : '' })) });
  }));
  const okBanner = okBannerData;
  r.post('/gachas', wrap(async (req, res) => {
    const g = normalizeGacha('x', { ...req.body, kind: 'limited' });
    if (req.body.banner && !okBanner(req.body.banner)) return res.status(400).json({ error: 'バナー画像が大きすぎます' });
    const { id, ...data } = g;
    const nid = await store.colAdd('gachas', { ...data, banner: '', kind: 'limited', createdAt: Date.now(), updatedAt: Date.now() });
    if (req.body.banner) await store.colSet('gachas', nid, { banner: await putBanner(nid, req.body.banner, '') });
    res.json({ id: nid });
  }));
  r.put('/gachas/:id', wrap(async (req, res) => {
    const id = req.params.id;
    const cur = (await listGachas()).find((x) => x.id === id);
    if (!cur) return res.status(404).json({ error: 'ガチャが見つかりません' });
    const b = req.body;
    let banner = b.banner === undefined ? cur.banner : b.banner; // '' で削除
    if (banner && banner !== cur.banner && !okBanner(banner)) return res.status(400).json({ error: 'バナー画像が大きすぎます（約4MBまで）' });
    if (b.banner !== undefined && banner !== cur.banner) banner = await putBanner(id, banner, cur.banner);
    const { id: _i, ...next } = normalizeGacha(id, { ...cur, ...b, banner, kind: id === NORMAL_ID ? 'normal' : 'limited' });
    await store.colSet('gachas', id, { ...next, createdAt: cur.createdAt || Date.now(), updatedAt: Date.now() });
    res.json({ ok: true });
  }));
  r.delete('/gachas/:id', wrap(async (req, res) => {
    if (req.params.id === NORMAL_ID) return res.status(400).json({ error: '通常ガチャは削除できません' });
    await clearBannerChunks(req.params.id, (await listGachas()).find((x) => x.id === req.params.id)?.banner);
    await store.colDel('gachas', req.params.id);
    res.json({ ok: true });
  }));

  // ---- 音源（場面ごとに差し替え） ----
  r.get('/sounds', wrap(async (_req, res) => res.json({ slots: sounds.SLOTS, sounds: await sounds.listSounds() })));
  r.put('/sounds/:slot', wrap(async (req, res) => {
    try { await sounds.saveSound(req.params.slot, req.body.name, req.body.data); res.json({ ok: true }); } catch (e) { res.status(400).json({ error: e.message }); }
  }));
  r.delete('/sounds/:slot', wrap(async (req, res) => { await sounds.deleteSound(req.params.slot); res.json({ ok: true }); }));

  // ---- バッジ（名前・見た目・条件を管理者が決める） ----
  const badgeBody = (b, partial = false) => {
    const out = {};
    if (!partial || b.name !== undefined) { out.name = String(b.name || '').trim().slice(0, 30); if (!out.name) throw new Error('バッジ名を入力してください'); }
    if (b.desc !== undefined) out.desc = String(b.desc).slice(0, 100);
    if (b.enabled !== undefined) out.enabled = !!b.enabled;
    if (b.image !== undefined && b.image !== null) { if (!okImage(b.image)) throw new Error('画像(PNG/JPEG/WebP・約500KB未満)を指定してください'); out.image = b.image; }
    if (b.cond) {
      const t = b.cond.type;
      if (!badges.COND_TYPES[t]) throw new Error('条件の種類を選んでください');
      const cond = { type: t };
      if (['wins', 'games', 'streak', 'loginDays', 'coins'].includes(t)) { cond.n = Math.max(1, Math.round(Number(b.cond.n) || 0)); }
      if (t === 'rank') { if (badges.rankRequirement(b.cond.rank) === null) throw new Error('ランクを選んでください'); cond.rank = b.cond.rank; }
      if (t === 'periodLogin') { cond.from = Number(b.cond.from) || 0; cond.to = Number(b.cond.to) || 0; if (!cond.from && !cond.to) throw new Error('期間を指定してください'); }
      out.cond = cond;
    } else if (!partial) throw new Error('条件を設定してください');
    return out;
  };
  r.get('/badges', wrap(async (_req, res) => {
    const all = await store.colList('badgedefs');
    res.json({ badges: all.map(({ image, ...d }) => ({ ...d, src: `/badge-img/${d.id}?v=${d.updatedAt || 0}` })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)), types: badges.COND_TYPES, ranks: badges.RANK_SPECS });
  }));
  r.post('/badges', wrap(async (req, res) => {
    try {
      const body = badgeBody(req.body);
      if (!body.image) throw new Error('バッジの画像を選んでください');
      const id = await store.colAdd('badgedefs', { ...body, enabled: body.enabled !== false, createdAt: Date.now(), updatedAt: Date.now() });
      await badges.reloadBadgeDefs(); res.json({ id });
    } catch (e) { res.status(400).json({ error: e.message }); }
  }));
  r.put('/badges/:id', wrap(async (req, res) => {
    if (!(await store.colGet('badgedefs', req.params.id))) return res.status(404).json({ error: 'バッジが見つかりません' });
    try { await store.colSet('badgedefs', req.params.id, { ...badgeBody(req.body, true), updatedAt: Date.now() }); await badges.reloadBadgeDefs(); res.json({ ok: true }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  }));
  r.delete('/badges/:id', wrap(async (req, res) => { await store.colDel('badgedefs', req.params.id); await badges.reloadBadgeDefs(); res.json({ ok: true }); }));

  // ---- シーズンを今すぐ終了して次へ（ランクリセット＋バッジ付与） ----
  r.post('/season/rotate', wrap(async (_req, res) => {
    if (!settings().season.enabled) return res.status(400).json({ error: 'シーズンが無効です。先に有効にして保存してください' });
    res.json(await rotateSeason());
  }));

  // ---- 問題の通報（問題ごとに集計） ----
  const QLABEL = { difficulty: '難易度がおかしい', irrelevant: '看護に関係ない', wrong: '答えが間違っている', tag: 'タグがおかしい', explanation: '解説が間違っている' };
  r.get('/qreports', wrap(async (_req, res) => {
    const [reps, qs] = await Promise.all([store.colList('qreports'), store.listQuestions()]);
    const byId = new Map(qs.map((q) => [q.id, q]));
    const g = new Map();
    for (const x of reps) {
      const e = g.get(x.qid) || { qid: x.qid, counts: {}, total: 0, open: 0, last: 0 };
      e.counts[x.reason] = (e.counts[x.reason] || 0) + 1; e.total += 1; if (!x.resolved) e.open += 1; e.last = Math.max(e.last, x.createdAt || 0);
      g.set(x.qid, e);
    }
    const list = [...g.values()].map((e) => {
      const q = byId.get(e.qid);
      return { ...e, exists: !!q, question: q?.question || '（削除済みの問題）', choices: q?.choices || [], answer: q?.answer ?? 0, explanation: q?.explanation || '', published: !!q?.published, file: q?.file || '未分類' };
    }).sort((a, b) => (b.open > 0) - (a.open > 0) || b.last - a.last);
    res.json({ reports: list, labels: QLABEL, unresolved: list.filter((x) => x.open > 0).length });
  }));
  r.post('/qreports/:qid/resolve', wrap(async (req, res) => {
    const resolved = req.body.resolved !== false;
    const list = (await store.colList('qreports')).filter((x) => x.qid === req.params.qid);
    for (const x of list) await store.colSet('qreports', x.id, { resolved });
    res.json({ changed: list.length });
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
