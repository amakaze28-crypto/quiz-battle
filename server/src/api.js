import express from 'express';
import * as store from './store.js';
import * as missions from './missions.js';
import { isBot } from './bots.js';
import * as presence from './presence.js';
import { settings, RARITIES } from './settings.js';
import { profilePayload } from './profile.js';
import { rankInfo, ratingValue } from './rank.js';
import { getEmperorSet } from './emperors.js';
import { getRecent } from './recent.js';

const MAX_FRIENDS = 50;

export function mountApi(app) {
  const r = express.Router();
  r.use(express.json({ limit: '100kb' }));

  r.use(async (req, res, next) => {
    try {
      const token = (req.headers.authorization || '').replace(/^Bearer /, '');
      const a = await store.verifyToken(token);
      const me = await store.getOrCreateUser(a.uid, a.name, a.photoURL, a.email);
      if (me.banned) return res.status(403).json({ error: 'アカウントが停止されています' });
      req.auth = a;
      req.me = me;
      next();
    } catch {
      res.status(401).json({ error: '認証に失敗しました' });
    }
  });

  // 同じユーザーのPOSTは順番に処理する（コイン・砂の二重消費を防ぐ）
  const chains = new Map();
  r.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    const uid = req.me.uid;
    const prev = chains.get(uid) || Promise.resolve();
    let release;
    const cur = new Promise((ok) => { release = ok; });
    const tail = prev.then(() => cur);
    chains.set(uid, tail);
    const done = () => { release(); if (chains.get(uid) === tail) chains.delete(uid); };
    res.on('finish', done); res.on('close', done);
    prev.then(next);
  });

  const wrap = (fn) => async (req, res) => {
    try { await fn(req, res); } catch (e) { console.error('[api]', e); res.status(500).json({ error: 'サーバーエラー' }); }
  };
  const fresh = (req) => store.getUser(req.me.uid);
  const withProfile = (req, u, extra = {}) => ({ profile: profilePayload(u, req.auth.isAdmin), ...extra });

  // ---- メール(運営からのプレゼント) ----
  const visibleMails = async (u) => (await store.colList('mails'))
    .filter((m) => (m.to === 'all' && m.createdAt >= (u.joinedAt || 0)) || m.to === u.uid)
    .sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
  const mailView = (m, u) => {
    const st = u.mailState[m.id] || {};
    return { id: m.id, title: m.title, body: m.body, coins: m.coins || 0, sand: m.sand || 0, createdAt: m.createdAt, read: !!st.read, claimed: !!st.claimed };
  };

  r.get('/summary', wrap(async (req, res) => {
    const u = await fresh(req);
    const mails = await visibleMails(u);
    res.json({
      mail: mails.filter((m) => { const s = u.mailState[m.id] || {}; return !s.read || (((m.coins || 0) > 0 || (m.sand || 0) > 0) && !s.claimed); }).length,
      mission: missions.view(u).filter((m) => m.done && !m.claimed).length + missions.claimableExtra(u),
      friend: u.incoming.length,
    });
  }));

  r.get('/me', wrap(async (req, res) => res.json(withProfile(req, await fresh(req)))));

  r.get('/mails', wrap(async (req, res) => {
    const u = await fresh(req);
    res.json({ mails: (await visibleMails(u)).map((m) => mailView(m, u)) });
  }));

  r.post('/mails/:id/claim', wrap(async (req, res) => {
    const u = await fresh(req);
    const m = await store.colGet('mails', req.params.id);
    if (!m || !(m.to === 'all' || m.to === u.uid)) return res.status(404).json({ error: 'メールが見つかりません' });
    const st = u.mailState[m.id] || {};
    if (st.claimed) return res.status(400).json({ error: 'すでに受け取り済みです' });
    const coins = u.coins + (m.coins || 0);
    const sand = u.sand + (m.sand || 0);
    await store.updateUser(u.uid, { coins, sand, mailState: { ...u.mailState, [m.id]: { read: true, claimed: true } } });
    res.json(withProfile(req, await fresh(req)));
  }));

  r.post('/mails/:id/read', wrap(async (req, res) => {
    const u = await fresh(req);
    const st = u.mailState[req.params.id] || {};
    if (!st.read) await store.updateUser(u.uid, { mailState: { ...u.mailState, [req.params.id]: { ...st, read: true } } });
    res.json({ ok: true });
  }));

  // ---- ミッション ----
  r.get('/missions', wrap(async (req, res) => {
    const u = await fresh(req);
    res.json({ day: missions.dayKey(), missions: missions.view(u), weekly: missions.extraView(u, 'weekly'), special: missions.extraView(u, 'special'), weekKey: missions.weekKey() });
  }));

  // ウィークリー／スペシャルの受け取り
  r.post('/missions/x/:id/claim', wrap(async (req, res) => {
    const u = await fresh(req);
    const item = [...missions.extraView(u, 'weekly'), ...missions.extraView(u, 'special')].find((m) => m.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'ミッションが見つかりません（期間外の可能性があります）' });
    if (!item.done) return res.status(400).json({ error: 'まだ達成していません' });
    if (item.claimed) return res.status(400).json({ error: 'すでに受け取り済みです' });
    await store.updateUser(u.uid, { coins: u.coins + item.coins, sand: (u.sand || 0) + item.sand, mprog: missions.markClaimed(u, item.id) });
    const nu = await fresh(req);
    res.json(withProfile(req, nu, { missions: missions.view(nu), weekly: missions.extraView(nu, 'weekly'), special: missions.extraView(nu, 'special') }));
  }));

  r.post('/missions/:key/claim', wrap(async (req, res) => {
    const u = await fresh(req);
    const item = missions.view(u).find((m) => m.key === req.params.key);
    if (!item) return res.status(404).json({ error: 'ミッションが見つかりません' });
    if (!item.done) return res.status(400).json({ error: 'まだ達成していません' });
    if (item.claimed) return res.status(400).json({ error: 'すでに受け取り済みです' });
    const m = missions.current(u);
    m.claimed[item.key] = true;
    await store.updateUser(u.uid, { coins: u.coins + item.reward, missions: m });
    { const nu = await fresh(req); res.json(withProfile(req, nu, { missions: missions.view(nu), weekly: missions.extraView(nu, 'weekly'), special: missions.extraView(nu, 'special') })); }
  }));

  // ---- フレンド ----
  const friendView = (f) => ({
    uid: f.uid, displayName: f.displayName, iconId: f.iconId || 'default', frameId: f.frameId || 'none', bannerId: f.bannerId || 'none', charId: f.charId || 'char-m', badgeId: f.badgeId || 'auto',
    rank: rankInfo(f, getEmperorSet()), rating: ratingValue(f), online: presence.isOnline(f.uid), lastLoginAt: f.lastLoginAt || 0,
  });
  const viewList = async (uids) => (await Promise.all(uids.map((id) => store.getUser(id)))).filter(Boolean).map(friendView);

  const friendsPayload = async (u) => ({
    code: u.friendCode,
    friends: (await viewList(u.friends)).sort((a, b) => Number(b.online) - Number(a.online) || b.lastLoginAt - a.lastLoginAt),
    incoming: await viewList(u.incoming),
    outgoing: await viewList(u.outgoing),
  });

  const pull = (arr, id) => arr.filter((x) => x !== id);
  const push = (arr, id) => (arr.includes(id) ? arr : [...arr, id]);

  r.get('/friends', wrap(async (req, res) => res.json(await friendsPayload(await fresh(req)))));

  r.post('/friends/request', wrap(async (req, res) => {
    const code = String(req.body.code || '').trim().toUpperCase();
    const me = await fresh(req);
    const target = code ? await store.findUserByFriendCode(code) : null;
    if (!target) return res.status(404).json({ error: 'フレンドコードが見つかりません' });
    if (target.uid === me.uid) return res.status(400).json({ error: '自分自身は追加できません' });
    if (me.friends.includes(target.uid)) return res.status(400).json({ error: 'すでにフレンドです' });
    if (me.friends.length >= MAX_FRIENDS || target.friends.length >= MAX_FRIENDS) return res.status(400).json({ error: 'フレンド数の上限です' });
    if (me.incoming.includes(target.uid)) { // 相手からも申請が来ていたら即成立
      await store.updateUser(me.uid, { friends: push(me.friends, target.uid), incoming: pull(me.incoming, target.uid) });
      await store.updateUser(target.uid, { friends: push(target.friends, me.uid), outgoing: pull(target.outgoing, me.uid) });
    } else {
      await store.updateUser(me.uid, { outgoing: push(me.outgoing, target.uid) });
      await store.updateUser(target.uid, { incoming: push(target.incoming, me.uid) });
    }
    res.json(await friendsPayload(await fresh(req)));
  }));

  r.post('/friends/accept', wrap(async (req, res) => {
    const me = await fresh(req);
    const other = await store.getUser(String(req.body.uid || ''));
    if (!other || !me.incoming.includes(other.uid)) return res.status(404).json({ error: '申請が見つかりません' });
    if (me.friends.length >= MAX_FRIENDS) return res.status(400).json({ error: 'フレンド数の上限です' });
    await store.updateUser(me.uid, { friends: push(me.friends, other.uid), incoming: pull(me.incoming, other.uid) });
    await store.updateUser(other.uid, { friends: push(other.friends, me.uid), outgoing: pull(other.outgoing, me.uid) });
    res.json(await friendsPayload(await fresh(req)));
  }));

  // 申請の拒否・取り消し・フレンド削除
  r.post('/friends/remove', wrap(async (req, res) => {
    const me = await fresh(req);
    const other = await store.getUser(String(req.body.uid || ''));
    if (other) {
      await store.updateUser(other.uid, { friends: pull(other.friends, me.uid), incoming: pull(other.incoming, me.uid), outgoing: pull(other.outgoing, me.uid) });
    }
    await store.updateUser(me.uid, {
      friends: pull(me.friends, req.body.uid), incoming: pull(me.incoming, req.body.uid), outgoing: pull(me.outgoing, req.body.uid),
    });
    res.json(await friendsPayload(await fresh(req)));
  }));

  r.post('/friends/removeAll', wrap(async (req, res) => {
    const me = await fresh(req);
    for (const id of me.friends) {
      const o = await store.getUser(id);
      if (o) await store.updateUser(o.uid, { friends: pull(o.friends, me.uid) });
    }
    await store.updateUser(me.uid, { friends: [] });
    res.json(await friendsPayload(await fresh(req)));
  }));

  // ---- ショップ / ガチャ / 装備 ----
  const meta = (i) => ({ id: i.id, name: i.name, type: i.type, rarity: i.rarity, price: i.price || 0, onShop: !!i.onShop, inGacha: !!i.inGacha });
  const SLOTS = { icon: 'iconId', frame: 'frameId', banner: 'bannerId', character: 'charId' };
  // 同梱の初期アイテム（画像ファイル）。slot ごとの装備可能ID
  const BUILTIN = { icon: ['default', 'default2'], character: ['char-m', 'char-f'] };
  const RANK = Object.fromEntries(RARITIES.map((x, i) => [x, i]));
  const rarityOf = (i) => (RARITIES.includes(i.rarity) ? i.rarity : 'common');

  r.get('/shop', wrap(async (req, res) => {
    const u = await fresh(req);
    const all = await store.colList('items');
    const items = all
      .filter((i) => i.onShop || u.ownedItems.includes(i.id))
      .sort((a, b) => (RANK[rarityOf(a)] - RANK[rarityOf(b)]) || (a.price - b.price) || (a.createdAt - b.createdAt))
      .map((i) => ({ ...meta(i), owned: u.ownedItems.includes(i.id) }));
    const base = (id, name, type) => ({ id, name, type, rarity: 'common', price: 0, owned: true, onShop: false, inGacha: false });
    items.unshift(base('default', '初期アイコン（男性）', 'icon'), base('default2', '初期アイコン（女性）', 'icon'), base('char-m', '初期キャラ（男性）', 'character'), base('char-f', '初期キャラ（女性）', 'character'));
    res.json({ sand: u.sand, coins: u.coins, equipped: { icon: u.iconId, frame: u.frameId, banner: u.bannerId, character: u.charId }, items });
  }));

  r.post('/shop/buy', wrap(async (req, res) => {
    const u = await fresh(req);
    const item = await store.colGet('items', String(req.body.itemId || ''));
    if (!item || !item.onShop) return res.status(404).json({ error: 'この商品は購入できません' });
    if (u.ownedItems.includes(item.id)) return res.status(400).json({ error: 'すでに持っています' });
    if (u.sand < item.price) return res.status(400).json({ error: '魔法の砂が足りません' });
    await store.updateUser(u.uid, { sand: u.sand - item.price, ownedItems: [...u.ownedItems, item.id] });
    res.json(withProfile(req, await fresh(req)));
  }));

  r.post('/equip', wrap(async (req, res) => {
    const u = await fresh(req);
    const slot = String(req.body.slot || '');
    const id = String(req.body.itemId || '');
    if (!SLOTS[slot]) return res.status(400).json({ error: '不正なリクエストです' });
    if (id === 'none') {
      if (slot === 'icon') return res.status(400).json({ error: 'アイコンは外せません' });
    } else {
      if (!u.ownedItems.includes(id)) return res.status(400).json({ error: '未所持のアイテムです' });
      if (BUILTIN[slot]?.includes(id)) { /* 同梱アイテム */ } else {
        const item = await store.colGet('items', id);
        if (!item || item.type !== slot) return res.status(400).json({ error: '装備できません' });
      }
    }
    if (id === 'none' && slot === 'character') return res.status(400).json({ error: 'キャラは外せません' });
    await store.updateUser(u.uid, { [SLOTS[slot]]: id });
    res.json(withProfile(req, await fresh(req)));
  }));

  // バッジ（バナーに表示するランクバッジ）。'auto'=現在のランク、または到達済みのティアを選べる
  r.post('/badge', wrap(async (req, res) => {
    const u = await fresh(req);
    const badge = String(req.body.badge || 'auto');
    if (badge !== 'auto' && badge !== 'none') {
      const mine = rankInfo(u, getEmperorSet());
      const order = ['rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'emperor'];
      if (order.indexOf(badge) < 0 || order.indexOf(badge) > order.indexOf(mine.key)) return res.status(400).json({ error: 'まだ獲得していないバッジです' });
    }
    await store.updateUser(u.uid, { badgeId: badge });
    res.json(withProfile(req, await fresh(req)));
  }));

  // ---- ガチャ ----
  const wpick = (entries) => {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    if (total <= 0) return null;
    let x = Math.random() * total;
    for (const [k, w] of entries) { x -= w; if (x < 0) return k; }
    return entries[entries.length - 1][0];
  };
  const gachaPool = async () => (await store.colList('items')).filter((i) => i.inGacha && RARITIES.includes(i.rarity));

  // 提供割合（表示用）。出るアイテムがいないレア度は除いて按分し直す
  function rates(g, pool) {
    const tw = g.typeWeights;
    const availR = RARITIES.filter((x) => g.itemRarityWeights[x] > 0 && pool.some((i) => i.rarity === x));
    const itemOn = availR.length > 0 && tw.item > 0;
    const sandOn = tw.sand > 0 || !itemOn;
    const tItem = itemOn ? tw.item : 0;
    const tSand = sandOn ? (itemOn ? tw.sand : 1) : 0;
    const tot = tItem + tSand || 1;
    const iw = availR.reduce((s, x) => s + g.itemRarityWeights[x], 0) || 1;
    const sw = RARITIES.reduce((s, x) => s + g.sandRarityWeights[x], 0) || 1;
    const pct = (v) => Math.round(v * 10000) / 100;
    return {
      item: pct(tItem / tot), sand: pct(tSand / tot),
      itemRarity: Object.fromEntries(RARITIES.map((x) => [x, availR.includes(x) ? pct((tItem / tot) * (g.itemRarityWeights[x] / iw)) : 0])),
      sandRarity: Object.fromEntries(RARITIES.map((x) => [x, pct((tSand / tot) * (g.sandRarityWeights[x] / sw))])),
    };
  }

  r.get('/gacha/info', wrap(async (req, res) => {
    const u = await fresh(req);
    const g = settings().gacha;
    const pool = await gachaPool();
    res.json({
      coins: u.coins, sand: u.sand, cost: g.cost, rates: rates(g, pool), sandAmounts: g.sandAmounts, dupSand: g.dupSand,
      pool: pool.sort((a, b) => RANK[a.rarity] - RANK[b.rarity]).map((i) => ({ ...meta(i), owned: u.ownedItems.includes(i.id) })),
    });
  }));

  r.post('/gacha/pull', wrap(async (req, res) => {
    const count = Number(req.body.count) === 10 ? 10 : 1;
    const u = await fresh(req);
    const g = settings().gacha;
    const total = g.cost * count;
    if (u.coins < total) return res.status(400).json({ error: `コインが足りません（${total}コイン必要）` });
    const pool = await gachaPool();
    const rt = rates(g, pool);
    const owned = new Set(u.ownedItems);
    let sandGain = 0;
    const results = [];
    for (let n = 0; n < count; n++) {
      const kind = wpick([['item', rt.item], ['sand', rt.sand]]) || 'sand';
      if (kind === 'item') {
        const rar = wpick(RARITIES.map((x) => [x, rt.itemRarity[x]]));
        const cand = pool.filter((i) => i.rarity === rar);
        const it = cand[Math.floor(Math.random() * cand.length)];
        const dup = owned.has(it.id);
        const sand = dup ? g.dupSand[it.rarity] : 0;
        owned.add(it.id);
        sandGain += sand;
        results.push({ kind: 'item', item: meta(it), duplicate: dup, sand });
      } else {
        const rar = wpick(RARITIES.map((x) => [x, rt.sandRarity[x]])) || 'common';
        const sand = g.sandAmounts[rar];
        sandGain += sand;
        results.push({ kind: 'sand', rarity: rar, sand });
      }
    }
    await store.updateUser(u.uid, { coins: u.coins - total, sand: u.sand + sandGain, ownedItems: [...owned] });
    res.json(withProfile(req, await fresh(req), { results, sandGain }));
  }));

  // ---- 改名（1回目は無料、2回目以降はコイン） ----
  r.post('/name', wrap(async (req, res) => {
    const u = await fresh(req);
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (name.length < 1 || name.length > 16) return res.status(400).json({ error: '表示名は1〜16文字で入力してください' });
    if (name === u.displayName) return res.status(400).json({ error: '現在と同じ名前です' });
    const cost = u.nameChanges === 0 ? 0 : settings().renameCost;
    if (u.coins < cost) return res.status(400).json({ error: `コインが足りません（${cost}コイン必要）` });
    await store.updateUser(u.uid, { displayName: name, nameChanges: u.nameChanges + 1, coins: u.coins - cost });
    res.json(withProfile(req, await fresh(req)));
  }));

  // ---- 通報（対戦中・対戦終了後） ----
  const REASONS = { cheat: 'チート行為', name: '不適切な名前', other: 'その他' };
  r.post('/report', wrap(async (req, res) => {
    const { targetUid, reason, roomId } = req.body;
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 300) : '';
    if (!REASONS[reason]) return res.status(400).json({ error: '通報理由を選んでください' });
    if (reason === 'other' && !comment) return res.status(400).json({ error: '「その他」はコメントを入力してください' });
    const rec = getRecent(req.me.uid);
    const target = rec?.players.find((p) => p.uid === targetUid);
    // botへの通報は、通報したように見せるだけ（管理者には届かない）
    if (rec && rec.roomId === roomId && target && isBot(targetUid)) { rec.reported.add(targetUid); return res.json({ ok: true }); }
    if (!rec || rec.roomId !== roomId || !target || targetUid === req.me.uid) return res.status(400).json({ error: '直近の対戦相手のみ通報できます' });
    if (rec.reported.has(targetUid)) return res.status(400).json({ error: 'この試合ではすでに通報済みです' });
    rec.reported.add(targetUid);
    const from = rec.players.find((p) => p.uid === req.me.uid);
    await store.colAdd('reports', {
      fromUid: req.me.uid, fromName: from?.name || req.me.displayName, toUid: target.uid, toName: target.name,
      reason, reasonLabel: REASONS[reason], comment: reason === 'other' ? comment : comment || '', roomId,
      createdAt: Date.now(), resolved: false,
    });
    res.json({ ok: true });
  }));

  // ---- 問題の通報（難易度がおかしい / 看護に関係ない / 答えが間違っている） ----
  const QREASONS = { difficulty: '難易度がおかしい', irrelevant: '看護に関係ない', wrong: '答えが間違っている' };
  r.post('/report-question', wrap(async (req, res) => {
    const reason = String(req.body.reason || '');
    const qid = String(req.body.questionId || '').slice(0, 80);
    if (!QREASONS[reason]) return res.status(400).json({ error: '通報理由を選んでください' });
    if (!qid) return res.status(400).json({ error: '問題が指定されていません' });
    // 同じ人が同じ問題を同じ理由で何度送っても1件にまとまる
    await store.colSet('qreports', `${req.me.uid}_${qid}_${reason}`, {
      qid, reason, fromUid: req.me.uid, createdAt: Date.now(), resolved: false,
    });
    res.json({ ok: true });
  }));

  app.use('/api', r);

  // アイテム画像（アイコン・フレーム・バナー）の配信（認証不要・不変URL）
  app.get('/item/:id', async (req, res) => {
    try {
      const it = await store.colGet('items', req.params.id);
      const m = it?.image?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
      if (!m) return res.status(404).end();
      res.set('Content-Type', m[1]).set('Cache-Control', 'public, max-age=31536000, immutable').send(Buffer.from(m[2], 'base64'));
    } catch { res.status(500).end(); }
  });
}
