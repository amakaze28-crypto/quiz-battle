// BGM・効果音。ブラウザの自動再生制限のため、最初のタップ以降に再生が始まる。
// 音源は public/audio/ の同名ファイルを差し替えるだけで変更できる（例: bgm-home.mp3 = ホームのBGM）。
const KEY = 'quiz.audio';
const BGM = { title: '/audio/bgm-title.mp3', home: '/audio/bgm-home.mp3', battle1: '/audio/bgm-battle1.mp3', battle2: '/audio/bgm-battle2.mp3', battle3: '/audio/bgm-battle3.mp3' };
const BATTLE = ['battle1', 'battle2', 'battle3'];
const SE = ['tap', 'queue', 'ok', 'match', 'question', 'correct', 'wrong', 'secondary', 'coin', 'gacha', 'rare', 'win', 'lose', 'tick'];

const load = () => {
  try { return { bgm: true, se: true, bgmVol: 0.5, seVol: 0.8, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { bgm: true, se: true, bgmVol: 0.5, seVol: 0.8 }; }
};
let state = load();
const listeners = new Set();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても動く */ } listeners.forEach((f) => f(state)); };

let want = null;      // 流したいBGM名
let cur = null;       // { name, src, gain }
let unlocked = false;
let hidden = false;
const seBase = {};

// BGMはWeb Audioで途切れなくループさせる（<audio loop>だとループの継ぎ目に隙間ができるため）。
// 曲の先頭・末尾の無音は読み込み時に検出して、ループ範囲から取り除く。
let ctx = null;
const getCtx = () => {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); }
  return ctx;
};
const loaded = {};
function loadBgm(name) {
  if (!loaded[name]) {
    loaded[name] = fetch(BGM[name]).then((r) => r.arrayBuffer()).then((ab) => new Promise((res, rej) => getCtx().decodeAudioData(ab, res, rej))).then((buffer) => {
      const th = 0.004; const n = buffer.length; const ch = [...Array(buffer.numberOfChannels)].map((_, i) => buffer.getChannelData(i));
      const loud = (i) => ch.some((d) => Math.abs(d[i]) > th);
      let s = 0; while (s < n - 1 && !loud(s)) s += 1;
      let e = n - 1; while (e > s && !loud(e)) e -= 1;
      return { buffer, start: s / buffer.sampleRate, end: (e + 1) / buffer.sampleRate };
    }).catch((err) => { delete loaded[name]; throw err; });
  }
  return loaded[name];
}

function stopCur(fadeMs = 500) {
  if (!cur) return;
  const { src, gain } = cur; cur = null;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
  setTimeout(() => { try { src.stop(); } catch { /* 停止済み */ } }, fadeMs + 80);
}

async function apply() {
  const target = state.bgm && !hidden && unlocked ? want : null;
  if (cur && cur.name === target) {
    const t = ctx.currentTime; cur.gain.gain.cancelScheduledValues(t); cur.gain.gain.setValueAtTime(cur.gain.gain.value, t); cur.gain.gain.linearRampToValueAtTime(state.bgmVol, t + 0.1);
    return;
  }
  if (!getCtx()) return;
  stopCur();
  if (!target) return;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    const { buffer, start, end } = await loadBgm(target);
    // 読み込み中に曲が変わっていたら何もしない
    if (want !== target || !(state.bgm && !hidden && unlocked) || (cur && cur.name === target)) return;
    stopCur(0);
    const src = ctx.createBufferSource(); const gain = ctx.createGain();
    src.buffer = buffer; src.loop = true; src.loopStart = start; src.loopEnd = end;
    gain.gain.value = 0; src.connect(gain); gain.connect(ctx.destination);
    src.start(0, start);
    gain.gain.linearRampToValueAtTime(state.bgmVol, ctx.currentTime + 0.7);
    cur = { name: target, src, gain };
    for (const k of Object.keys(loaded)) if (k !== target) delete loaded[k]; // デコード済みデータ(大きい)は使う曲だけ保持
  } catch { unlocked = false; /* 再生できなければ次のタップで再試行 */ }
}

// 対戦曲は3曲からランダム。対戦の間は同じ曲を流し、対戦から出るたびに選び直す
let battlePick = null;
export const playBgm = (name) => {
  if (name === 'battle') { if (!battlePick) battlePick = BATTLE[Math.floor(Math.random() * BATTLE.length)]; want = battlePick; }
  else { battlePick = null; want = name; }
  apply();
};

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
  const unlock = () => { getCtx()?.resume?.(); if (!unlocked) { unlocked = true; apply(); } };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('click', (e) => {
    // タップ音は主要ボタン(ui-btn系)と、data-sfx を付けたボタンだけ。タブ・ナビ・解答・閉じるなどは鳴らさない
    const b = e.target.closest?.('.ui-btn, .ui-btn-gold, .ui-btn-red, [data-sfx]');
    if (b && !b.disabled && !b.dataset.nosfx) sfx('tap');
  }, true);
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; apply(); });
  SE.forEach((n) => { seBase[n] = new Audio(`/audio/se-${n}.mp3`); seBase[n].preload = 'auto'; });
}
