import { useAudioSettings } from './useAudio';
import { setAudio, sfx } from './audio';

const Row = ({ label, on, vol, onToggle, onVol }) => (
  <div className="py-1.5">
    <label className="flex items-center justify-between mb-1">
      <span>{label}</span>
      <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} className="w-5 h-5 accent-amber-400" />
    </label>
    <input type="range" min="0" max="1" step="0.05" value={vol} disabled={!on} onChange={(e) => onVol(Number(e.target.value))}
      onPointerUp={() => sfx('ok')} className="w-full accent-amber-400 disabled:opacity-40" />
  </div>
);

// BGM・効果音のオン/オフと音量（端末に保存）
export default function AudioPanel() {
  const s = useAudioSettings();
  return (
    <div>
      <Row label="BGM" on={s.bgm} vol={s.bgmVol} onToggle={(v) => setAudio({ bgm: v })} onVol={(v) => setAudio({ bgmVol: v })} />
      <Row label="効果音" on={s.se} vol={s.seVol} onToggle={(v) => setAudio({ se: v })} onVol={(v) => setAudio({ seVol: v })} />
    </div>
  );
}
