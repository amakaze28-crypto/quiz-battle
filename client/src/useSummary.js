import { useCallback, useEffect, useState } from 'react';
import { callApi } from './api';

// ホームの赤い通知(メール・お知らせ・ミッション・フレンド申請)用
export function useSummary(user, view) {
  const [summary, setSummary] = useState(null);
  const refresh = useCallback(() => { callApi(user, '/summary').then(setSummary).catch(() => {}); }, [user]);
  useEffect(() => { refresh(); }, [refresh, view]);
  useEffect(() => { const t = setInterval(refresh, 60000); return () => clearInterval(t); }, [refresh]);
  return { summary, refresh };
}
