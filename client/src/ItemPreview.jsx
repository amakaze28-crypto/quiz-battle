import { Avatar, Banner } from './Parts';

// アイテムの見た目（アイコン／フレーム＝初期アイコンに重ねて表示／バナー）。size は CSS の長さ(例 '11cqw')
export default function ItemPreview({ item, size = '11cqw' }) {
  if (item.type === 'banner') return <Banner bannerId={item.id} className="rounded w-full" style={{ aspectRatio: '4 / 1' }} />;
  if (item.type === 'frame') return <Avatar iconId="default" frameId={item.id} size={`calc(${size} * 0.85)`} />;
  return <Avatar iconId={item.id} size={size} />;
}
