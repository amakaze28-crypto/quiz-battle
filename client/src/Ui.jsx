// 共通UI: 背景画像・枠・ボタン（画像から切り抜いたパーツをCSSの9分割枠で使用）
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
        {sub && <p className="text-xs text-slate-300 mt-2 ui-text">{sub}</p>}
      </Plate>
    </div>
  );
}
