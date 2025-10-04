import { backendConfig } from '@/lib/backendConfig';

function getBase() {
  return backendConfig.apiBaseUrl || '';
}

function getAuthHeader() {
  try {
  const token = localStorage.getItem('api_token') || import.meta.env.VITE_API_TOKEN;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function apiGet(path: string) {
  const res = await fetch(`${getBase()}${path}`, { headers: { ...getAuthHeader(), 'Accept': 'application/json' } });
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore parse errors */ }
    const msg = `API GET ${path} failed: ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`;
    console.error(msg);
    throw new Error(msg);
  }
  return res.json();
}

export async function apiSend(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
  const res = await fetch(`${getBase()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...getAuthHeader() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (method === 'DELETE') {
    if (!res.ok && res.status !== 204) {
      let detail = '';
      try { detail = await res.text(); } catch { /* ignore parse errors */ }
      const msg = `API ${method} ${path} failed: ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`;
      console.error(msg);
      throw new Error(msg);
    }
    return null;
  }
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore parse errors */ }
    const msg = `API ${method} ${path} failed: ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`;
    console.error(msg, { body });
    throw new Error(msg);
  }
  return res.json();
}
