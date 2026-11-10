import { useSyncExternalStore } from 'react';
import { SERVER_URL } from './api';

// 管理画面で調整したバナー(カードフレーム)の配置の上書き。{ [itemId]: {cx,cy,...} }
let overrides = {};
let fits = {};
let loaded = false;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

export async function loadCardLayouts(force = false) {
  if (loaded && !force) return;
  loaded = true;
  try {
    const r = await fetch(`${SERVER_URL}/card-layouts`, { cache: 'no-store' });
    if (r.ok) { const d = await r.json(); overrides = d.layouts || {}; fits = d.fits || {}; emit(); }
  } catch { /* 取得できなくても標準の配置で表示する */ }
}

export function useCardLayouts() {
  if (!loaded) loadCardLayouts();
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => overrides);
}

// アイコンフレームの位置・大きさの上書き: { [itemId]: {dx,dy,s} }
export function useFrameFits() {
  if (!loaded) loadCardLayouts();
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => fits);
}
export const DEFAULT_FIT = { dx: 0, dy: 0, s: 1.2 };
