import { Avatar, Banner } from './Parts';
import { charSrc, itemSrc } from './icons';

// アイテムの見た目（アイコン／フレーム＝初期アイコンに重ねて表示／バナー）。size は CSS の長さ(例 '11cqw')
export default function ItemPreview({ item, size = '11cqw' }) {
  if (item.type === 'bgm') return <div style={{ width: size, height: size, fontSize: `calc(${size} * 0.6)` }} className="grid place-items-center rounded-lg bg-[#0b1a36] text-amber-300">♪</div>;
  if (item.type === 'character') return <img src={charSrc(item.id)} alt="" draggable={false} style={{ height: `calc(${size} * 1.3)`, width: size, objectFit: 'contain' }} />;
  if (item.type === 'card') return <img src={itemSrc(item.id)} alt="" draggable={false} style={{ height: `calc(${size} * 1.5)`, maxWidth: `calc(${size} * 1.1)`, objectFit: 'contain' }} />;
  if (item.type === 'frame') return <Avatar iconId="default" frameId={item.id} size={`calc(${size} * 0.85)`} />;
  return <Avatar iconId={item.id} size={size} />;
}
