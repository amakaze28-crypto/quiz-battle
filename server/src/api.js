import express from 'express';
import * as store from './store.js';
import * as missions from './missions.js';
import * as presence from './presence.js';
import { settings } from './settings.js';
import { profilePayload } from './profile.js';
import { rankInfo } from './rank.js';
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
    return { id: m.id, title: m.title, body: m.body, coins: m.coins || 0, createdAt: m.createdAt, read: !!st.read, claimed: !!st.claimed };
  };

  r.get('/summary', wrap(async (req, res) => {
    const u = await fresh(req);
    const mails = await visibleMails(u);
    const notices = await store.colList('notices');
    res.json({
      mail: mails.filter((m) => { const s = u.mailState[m.id] || {}; return !s.read || ((m.coins || 0) > 0 && !s.claimed); }).length,
      notice: notices.filter((n) => n.createdAt > Math.max(u.lastNoticeSeen || 0, u.joinedAt || 0)).length,
      mission: missions.view(u).filter((m) => m.done && !m.claimed).length,
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
    await store.updateUser(u.uid, { coins, mailState: { ...u.mailState, [m.id]: { read: true, claimed: true } } });
    res.json(withProfile(req, await fresh(req)));
  }));

  r.post('/mails/:id/read', wrap(async (req, res) => {
    const u = await fresh(req);
    const st = u.mailState[req.params.id] || {};
    if (!st.read) await store.updateUser(u.uid, { mailState: { ...u.mailState, [req.params.id]: { ...st, read: true } } });
    res.json({ ok: true });
  }));

  // ---- お知らせ ----
  r.get('/notices', wrap(async (req, res) => {
    const u = await fresh(req);
    const seen = Math.max(u.lastNoticeSeen || 0, u.joinedAt || 0);
    const list = (await store.colList('notices')).sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
    res.json({ notices: list.map((n) => ({ id: n.id, title: n.title, body: n.body, createdAt: n.createdAt, unread: n.createdAt > seen })) });
  }));

  r.post('/notices/seen', wrap(async (req, res) => {
    await store.updateUser(req.me.uid, { lastNoticeSeen: Date.now() });
    res.json({ ok: true });
  }));

  // ---- ミッション ----
  r.get('/missions', wrap(async (req, res) => res.json({ day: missions.dayKey(), missions: missions.view(await fresh(req)) })));

  r.post('/missions/:key/claim', wrap(async (req, res) => {
    const u = await fresh(req);
    const item = missions.view(u).find((m) => m.key === req.params.key);
    if (!item) return res.status(404).json({ error: 'ミッションが見つかりません' });
    if (!item.done) return res.status(400).json({ error: 'まだ達成していません' });
    if (item.claimed) return res.status(400).json({ error: 'すでに受け取り済みです' });
    const m = missions.current(u);
    m.claimed[item.key] = true;
    await store.updateUser(u.uid, { coins: u.coins + item.reward, missions: m });
    res.json(withProfile(req, await fresh(req), { missions: missions.view(await fresh(req)) }));
  }));

  // ---- フレンド ----
  const friendView = (f) => ({
    uid: f.uid, displayName: f.displayName, iconId: f.iconId || 'default',
    rank: rankInfo(f, getEmperorSet()), online: presence.isOnline(f.uid), lastLoginAt: f.lastLoginAt || 0,
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

  // ---- ショップ / アイコン ----
  r.get('/shop', wrap(async (req, res) => {
    const u = await fresh(req);
    const all = await store.colList('icons');
    const icons = all
      .filter((i) => i.onSale || u.ownedIcons.includes(i.id))
      .sort((a, b) => (a.price - b.price) || (a.createdAt - b.createdAt))
      .map((i) => ({ id: i.id, name: i.name, price: i.price, owned: u.ownedIcons.includes(i.id), onSale: !!i.onSale }));
    icons.unshift({ id: 'default', name: '初期アイコン', price: 0, owned: true, onSale: false });
    res.json({ coins: u.coins, equipped: u.iconId, icons });
  }));

  r.post('/shop/buy', wrap(async (req, res) => {
    const u = await fresh(req);
    const icon = await store.colGet('icons', String(req.body.iconId || ''));
    if (!icon || !icon.onSale) return res.status(404).json({ error: 'このアイコンは購入できません' });
    if (u.ownedIcons.includes(icon.id)) return res.status(400).json({ error: 'すでに持っています' });
    if (u.coins < icon.price) return res.status(400).json({ error: 'コインが足りません' });
    await store.updateUser(u.uid, { coins: u.coins - icon.price, ownedIcons: [...u.ownedIcons, icon.id] });
    res.json(withProfile(req, await fresh(req)));
  }));

  r.post('/icon/equip', wrap(async (req, res) => {
    const u = await fresh(req);
    const id = String(req.body.iconId || '');
    if (!u.ownedIcons.includes(id)) return res.status(400).json({ error: '未所持のアイコンです' });
    await store.updateUser(u.uid, { iconId: id });
    res.json(withProfile(req, await fresh(req)));
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

  app.use('/api', r);

  // アイコン画像の配信（認証不要・不変URL）
  app.get('/icon/:id', async (req, res) => {
    try {
      const icon = await store.colGet('icons', req.params.id);
      const m = icon?.image?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
      if (!m) return res.status(404).end();
      res.set('Content-Type', m[1]).set('Cache-Control', 'public, max-age=31536000, immutable').send(Buffer.from(m[2], 'base64'));
    } catch { res.status(500).end(); }
  });
}
