import { useEffect, useState } from 'react';
import { getAudio, playBgm, subscribeAudio } from './audio';

export const useBgm = (name) => { useEffect(() => { if (name) playBgm(name); }, [name]); };
export function useAudioSettings() {
  const [s, set] = useState(getAudio());
  useEffect(() => subscribeAudio(set), []);
  return s;
}
