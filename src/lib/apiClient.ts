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
  const res = await fetch(`${getBase()}${path}`, { headers: { ...getAuthHeader() } });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiSend(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
  const res = await fetch(`${getBase()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (method === 'DELETE') {
    if (!res.ok && res.status !== 204) throw new Error(`API error ${res.status}`);
    return null;
  }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
