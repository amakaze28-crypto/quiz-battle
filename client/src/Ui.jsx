// 共通UI: 背景画像・枠・ボタン（画像から切り抜いたパーツをCSSの9分割枠で使用）
import { useEffect, useState } from 'react';

// 起動・接続中に、文言を順番にループ表示する
export const LOAD_PHRASES = ['サーバーを起動しています…', '世界を読み込んでいます…', '冒険の準備をしています…', '魔法陣を描いています…', 'クイズの塔を整えています…', '旅人を迎える支度をしています…'];
export function LoopText({ phrases = LOAD_PHRASES, ms = 2200, className = '', style }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % phrases.length), ms); return () => clearInterval(t); }, [phrases, ms]);
  return <span key={i} className={`inline-block fade-text ${className}`} style={style}>{phrases[i]}</span>;
}

export const BgLayer = ({ dim = false }) => <div className={`ui-bgfix ${dim ? 'dim' : ''}`} aria-hidden />;

export const Panel = ({ className = '', children, ...p }) => <div className={`ui-panel text-white ${className}`} {...p}>{children}</div>;
export const Plate = ({ className = '', children, ...p }) => <div className={`ui-plate text-white ${className}`} {...p}>{children}</div>;

const VARIANT = { blue: 'ui-btn', gold: 'ui-btn-gold', red: 'ui-btn-red', ghost: 'ui-btn-ghost' };
export function Btn({ variant = 'blue', block = false, className = '', children, ...p }) {
  return <button className={`${VARIANT[variant]} ${block ? 'block w-full' : ''} ${className}`} {...p}>{children}</button>;
}

export const Title = ({ children, className = '' }) => <h1 className={`ui-title text-2xl mb-4 text-center ${className}`}>{children}</h1>;

export const Spinner = () => <div className="ui-spinner" role="status" aria-label="読み込み中" />;

// 読み込み中など、背景画像だけを使う全画面
export function Loading({ children, sub }) {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center text-white">
      <BgLayer />
      <Plate className="px-6 py-5 min-w-[240px]">
        <div className="flex justify-center mb-3"><Spinner /></div>
        <p className="ui-title text-lg">{children ?? '読み込み中…'}</p>
        {sub && <p className="text-sm text-slate-200 mt-2 ui-text"><LoopText /></p>}
      </Plate>
    </div>
  );
}
