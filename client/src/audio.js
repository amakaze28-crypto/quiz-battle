// BGM・効果音。ブラウザの自動再生制限のため、最初のタップ以降に再生が始まる。
// 音源は public/audio/ の同名ファイルを差し替えるだけで変更できる（例: bgm-home.mp3 = ホームのBGM）。
const KEY = 'quiz.audio';
const BGM = { title: '/audio/bgm-title.mp3', home: '/audio/bgm-home.mp3', battle: '/audio/bgm-battle.mp3' };
const SE = ['tap', 'ok', 'match', 'question', 'correct', 'wrong', 'secondary', 'coin', 'gacha', 'rare', 'win', 'lose', 'tick'];

const load = () => {
  try { return { bgm: true, se: true, bgmVol: 0.5, seVol: 0.8, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { bgm: true, se: true, bgmVol: 0.5, seVol: 0.8 }; }
};
let state = load();
const listeners = new Set();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても動く */ } listeners.forEach((f) => f(state)); };

let want = null;      // 流したいBGM名
let cur = null;       // { name, el }
let unlocked = false;
let hidden = false;
const els = {};
const seBase = {};

const bgmEl = (name) => {
  if (!els[name]) { const a = new Audio(BGM[name]); a.loop = true; a.preload = 'auto'; els[name] = a; }
  return els[name];
};

function fade(el, to, ms, done) {
  const from = el.volume; const t0 = performance.now();
  clearInterval(el._fade);
  el._fade = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k >= 1) { clearInterval(el._fade); done?.(); }
  }, 40);
}

function apply() {
  const target = state.bgm && !hidden && unlocked ? want : null;
  if (cur && cur.name === target) { cur.el.volume = state.bgmVol; return; }
  if (cur) { const old = cur.el; fade(old, 0, 500, () => old.pause()); cur = null; }
  if (!target) return;
  const el = bgmEl(target);
  el.volume = 0;
  const p = el.play();
  if (p?.catch) p.catch(() => { unlocked = false; }); // 再生を拒否された場合は次のタップで再試行
  cur = { name: target, el };
  fade(el, state.bgmVol, 700);
}

export const playBgm = (name) => { want = name; apply(); };

export function sfx(name) {
  if (!state.se || !unlocked || !SE.includes(name)) return;
  if (!seBase[name]) { seBase[name] = new Audio(`/audio/se-${name}.mp3`); seBase[name].preload = 'auto'; }
  const a = seBase[name].cloneNode();
  a.volume = Math.min(1, state.seVol);
  a.play().catch(() => {});
}

export const getAudio = () => state;
export const setAudio = (patch) => { state = { ...state, ...patch }; save(); apply(); };
export const subscribeAudio = (f) => { listeners.add(f); return () => listeners.delete(f); };

// 最初のタップで再生を解禁し、ボタンを押したら操作音を鳴らす
export function initAudio() {
  const unlock = () => { if (!unlocked) { unlocked = true; apply(); } };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('button, [role=button]');
    if (b && !b.disabled && !b.dataset.nosfx) sfx('tap');
  }, true);
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; apply(); });
  Object.keys(BGM).forEach((n) => bgmEl(n)); // 先読み
  SE.forEach((n) => { seBase[n] = new Audio(`/audio/se-${n}.mp3`); seBase[n].preload = 'auto'; });
}
