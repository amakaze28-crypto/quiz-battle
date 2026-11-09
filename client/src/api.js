const BASE = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export async function adminApi(user, path, { method = 'GET', body } = {}) {
  const token = await user.getIdToken();
  const res = await fetch(`${BASE}/admin${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `エラー (${res.status})`);
  return data;
}
