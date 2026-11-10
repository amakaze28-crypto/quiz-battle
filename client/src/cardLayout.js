import { useSyncExternalStore } from 'react';
import { SERVER_URL } from './api';

// 管理画面で調整したバナー(カードフレーム)の配置の上書き。{ [itemId]: {cx,cy,...} }
let overrides = {};
let loaded = false;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

export async function loadCardLayouts(force = false) {
  if (loaded && !force) return;
  loaded = true;
  try {
    const r = await fetch(`${SERVER_URL}/card-layouts`, { cache: 'no-store' });
    if (r.ok) { overrides = (await r.json()).layouts || {}; emit(); }
  } catch { /* 取得できなくても標準の配置で表示する */ }
}

export function useCardLayouts() {
  if (!loaded) loadCardLayouts();
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => overrides);
}
