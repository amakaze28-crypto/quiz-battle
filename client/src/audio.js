// BGM・効果音。ブラウザの自動再生制限のため、最初のタップ以降に再生が始まる。
// 音源は public/audio/ の同名ファイルを差し替えるだけで変更できる（例: bgm-home.mp3 = ホームのBGM）。
const KEY = 'quiz.audio';
import { SERVER_URL } from './api';
const BGM = { gacha: '/audio/bgm-gacha.mp3', title: '/audio/bgm-title.mp3', home: '/audio/bgm-home.mp3', battle1: '/audio/bgm-battle1.mp3', battle2: '/audio/bgm-battle2.mp3', battle3: '/audio/bgm-battle3.mp3' };
// 管理画面で差し替えられた音源（slot → URL）。なければ同梱ファイルを使う
let overrides = {};
const seSlot = (n) => (n === 'gacha' ? 'gacha_se' : n);
// ショップで買える／みんなが使える戦闘BGM（管理画面で追加）。名前は bgm_<アイテムID>
let owned = []; // [{ id, name, slot, v }]
const isOwnedSlot = (n) => owned.some((t) => t.slot === n);
const bgmUrl = (n) => overrides[n] || BGM[n] || (isOwnedSlot(n) ? `${SERVER_URL}/sound/${n}?v=${owned.find((t) => t.slot === n).v}` : /^bgm_[a-f0-9]{20}$/.test(n) ? `${SERVER_URL}/sound/${n}` : undefined); // 未購入の曲も、ショップの試聴用に配信される
export function setOwnedBgm(list) {
  const next = Array.isArray(list) ? list : [];
  if (JSON.stringify(next) === JSON.stringify(owned)) return;
  owned = next; battlePick = null;
  listeners.forEach((f) => f(state));
}
const seUrl = (n) => overrides[seSlot(n)] || `/audio/se-${n}.mp3`;
export const SOUND_SLOTS = [
  ['title', 'タイトル画面', 'bgm'], ['home', 'ホーム・ショップ・ミッションなど', 'bgm'], ['gacha', 'ガチャ画面', 'bgm'],
  ['battle1', '対戦 曲1', 'bgm'], ['battle2', '対戦 曲2', 'bgm'], ['battle3', '対戦 曲3', 'bgm'],
  ['tap', 'ボタンを押す', 'se'], ['queue', 'マッチング開始', 'se'], ['match', 'マッチング成立', 'se'], ['question', '問題表示', 'se'],
  ['correct', '正解', 'se'], ['wrong', '不正解', 'se'], ['secondary', 'Secondary発動', 'se'], ['tick', '残り時間', 'se'],
  ['win', '勝利', 'se'], ['lose', '敗北', 'se'], ['ok', '決定・完了', 'se'], ['coin', 'コイン獲得', 'se'], ['gacha_se', 'ガチャを引く', 'se'], ['dove', 'ガチャ演出：鳩が飛び立つ', 'se'], ['rare', 'レア獲得', 'se'],
];
export async function loadSoundOverrides() {
  try {
    const list = await (await fetch(`${SERVER_URL}/sounds`)).json();
    const next = {};
    for (const [slot, v] of Object.entries(list)) next[slot] = `${SERVER_URL}/sound/${slot}?v=${v.v || 0}`;
    const changed = JSON.stringify(next) !== JSON.stringify(overrides);
    overrides = next;
    if (changed) {
      for (const k of Object.keys(loaded)) delete loaded[k];
      for (const k of Object.keys(seBase)) delete seBase[k];
      if (cur) stopCur(0);
      apply();
    }
  } catch { /* 取得できなければ同梱の音源を使う */ }
}
const BATTLE = ['battle1', 'battle2', 'battle3'];
const SE = ['tap', 'queue', 'ok', 'match', 'question', 'correct', 'wrong', 'secondary', 'coin', 'gacha', 'rare', 'win', 'lose', 'tick', 'dove'];

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
    loaded[name] = fetch(bgmUrl(name)).then((r) => r.arrayBuffer()).then((ab) => new Promise((res, rej) => getCtx().decodeAudioData(ab, res, rej))).then((buffer) => {
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
  } catch { /* 再生できなければ次のタップで再試行（unlock側で再度apply） */ }
}

// 対戦曲は3曲からランダム。対戦の間は同じ曲を流し、対戦から出るたびに選び直す
let battlePick = null;
// 試聴: 選んだ戦闘曲を少しだけ流して、元のBGMに戻す
let prevWant = null; let prevTimer = null;
export function stopPreview() {
  clearTimeout(prevTimer);
  if (prevWant !== null) { want = prevWant; prevWant = null; apply(); }
}
export function previewBgm(name, ms = 8000) {
  clearTimeout(prevTimer);
  if (!BATTLE.includes(name) && !/^bgm_[a-f0-9]{20}$/.test(name)) { stopPreview(); return; } // 「ランダム」は試聴なし
  if (prevWant === null) prevWant = want;
  want = name; apply();
  prevTimer = setTimeout(stopPreview, ms);
}

export const playBgm = (name) => {
  clearTimeout(prevTimer); prevWant = null; // 試聴中に画面が変わったら試聴は終了
  if (name === 'battle') { if (!battlePick) { const c = getBattleBgm(); battlePick = c === 'random' ? randomTrack() : c; } want = battlePick; }
  else { battlePick = null; want = BGM[name] ? name : null; } // 'none' など未定義の名前は「何も流さない」
  apply();
};

// 戦闘BGMの選択（'random' または battle1〜3）。端末に保存
const BKEY = 'quiz.battleBgm';
const DEFAULT_TRACKS = [['battle1', "The God's Gambit"], ['battle2', 'Silver Wind Over Stone'], ['battle3', 'Iron Liturgy']];
// 選べる戦闘曲（ランダム + 同梱の3曲 + 使える追加曲）
export const getBattleTracks = () => [['random', 'ランダム'], ...DEFAULT_TRACKS, ...owned.map((t) => [t.slot, t.name])];
export const BATTLE_TRACKS = getBattleTracks();
const randomTrack = () => { const all = [...BATTLE, ...owned.map((t) => t.slot)]; return all[Math.floor(Math.random() * all.length)]; };
export const getBattleBgm = () => { try { const v = localStorage.getItem(BKEY); return getBattleTracks().some((t) => t[0] === v) ? v : 'random'; } catch { return 'random'; } };
export const setBattleBgm = (v) => { try { localStorage.setItem(BKEY, v); } catch { /* 保存できなくても動く */ } battlePick = null; };

// opt.vol: 音量を指定（設定画面の確認音用）/ opt.force: オフでも鳴らす
export function sfx(name, opt = {}) {
  if ((!state.se && !opt.force) || !unlocked || !SE.includes(name)) return;
  if (!seBase[name]) { seBase[name] = new Audio(seUrl(name)); seBase[name].preload = 'auto'; }
  const a = seBase[name].cloneNode();
  a.volume = Math.min(1, opt.vol ?? state.seVol);
  a.play().catch(() => {});
}

export const getAudio = () => state;
export const setAudio = (patch) => { state = { ...state, ...patch }; save(); apply(); };
export const subscribeAudio = (f) => { listeners.add(f); return () => listeners.delete(f); };

// 最初のタップで再生を解禁し、ボタンを押したら操作音を鳴らす
export function initAudio() {
  // iOSなどでは「タップ操作の中」でresumeしないと音が出ないので、いろいろな操作で何度でも試す。
  // AudioContextが running になり、BGMが流れ始めるまで外さない
  const unlock = () => {
    const c = getCtx();
    try { c?.resume?.(); } catch { /* 無視 */ }
    if (c && c.state !== 'closed' && !unlocked) { // 無音を1回鳴らして音声出力を有効化
      try { const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch { /* 無視 */ }
    }
    unlocked = true;
    if (want && !cur) apply();
  };
  ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => document.addEventListener(ev, unlock, { capture: true, passive: true }));
  document.addEventListener('click', (e) => {
    // タップ音は主要ボタン(ui-btn系)と、data-sfx を付けたボタンだけ。タブ・ナビ・解答・閉じるなどは鳴らさない
    const b = e.target.closest?.('.ui-btn, .ui-btn-gold, .ui-btn-red, [data-sfx]');
    if (b && !b.disabled && !b.dataset.nosfx) sfx('tap');
  }, true);
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; apply(); });
  SE.forEach((n) => { seBase[n] = new Audio(seUrl(n)); seBase[n].preload = 'auto'; });
  loadSoundOverrides();
}
