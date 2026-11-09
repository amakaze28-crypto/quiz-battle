export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

async function req(user, prefix, path, { method = 'GET', body } = {}) {
  const token = await user.getIdToken();
  const res = await fetch(`${SERVER_URL}${prefix}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `エラー (${res.status})`);
  return data;
}

export const adminApi = (user, path, opts) => req(user, '/admin', path, opts);
export const callApi = (user, path, opts) => req(user, '/api', path, opts);
