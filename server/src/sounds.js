import * as store from './store.js';

// 管理画面から差し替える音源。Firestoreは1件1MBまでなので、base64を分割して保存する
export const SLOTS = ['title', 'home', 'battle1', 'battle2', 'battle3', 'gacha', 'tap', 'queue', 'ok', 'match', 'question', 'correct', 'wrong', 'secondary', 'coin', 'gacha_se', 'rare', 'win', 'lose', 'tick', 'dove'];
const CHUNK = 600_000;
export const MAX_BYTES = 12 * 1024 * 1024;

export async function listSounds() {
  const docs = await store.colList('sounds');
  return Object.fromEntries(docs.filter((d) => SLOTS.includes(d.id)).map((d) => [d.id, { name: d.name, size: d.size, v: d.updatedAt }]));
}

export async function saveSound(slot, name, dataUrl) {
  const m = /^data:(audio\/[a-z0-9.+-]+|video\/mp4|application\/octet-stream);base64,(.+)$/i.exec(dataUrl || '');
  if (!SLOTS.includes(slot) || !m) throw new Error('音声ファイル(mp3 / wav / ogg / m4a)を選んでください');
  const b64 = m[2];
  const size = Math.floor((b64.length * 3) / 4);
  if (size > MAX_BYTES) throw new Error('ファイルが大きすぎます（12MBまで）');
  const old = await store.colGet('sounds', slot);
  const n = Math.ceil(b64.length / CHUNK);
  for (let i = 0; i < n; i++) await store.colSet('soundchunks', `${slot}__${i}`, { d: b64.slice(i * CHUNK, (i + 1) * CHUNK) });
  for (let i = n; i < (old?.chunks || 0); i++) await store.colDel('soundchunks', `${slot}__${i}`);
  const mime = m[1] === 'application/octet-stream' ? 'audio/mpeg' : m[1];
  await store.colSet('sounds', slot, { name: String(name || slot).slice(0, 80), mime, size, chunks: n, updatedAt: Date.now() });
}

export async function deleteSound(slot) {
  const old = await store.colGet('sounds', slot);
  if (!old) return;
  for (let i = 0; i < (old.chunks || 0); i++) await store.colDel('soundchunks', `${slot}__${i}`);
  await store.colDel('sounds', slot);
}

export async function soundData(slot) {
  if (!SLOTS.includes(slot)) return null;
  const d = await store.colGet('sounds', slot);
  if (!d) return null;
  const parts = [];
  for (let i = 0; i < d.chunks; i++) parts.push((await store.colGet('soundchunks', `${slot}__${i}`))?.d || '');
  return { mime: d.mime || 'audio/mpeg', buf: Buffer.from(parts.join(''), 'base64') };
}
