import { backendConfig } from '@/lib/backendConfig';

function getBase() {
  return backendConfig.apiBaseUrl || '';
}

const FALLBACK_API_BASE = 'https://weapnea-api.onrender.com';

function getAuthHeader() {
  try {
  const token = localStorage.getItem('api_token') || import.meta.env.VITE_API_TOKEN;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function apiGet(path: string) {
  const base = getBase();
  const res = await fetch(`${base}${path}`, { headers: { ...getAuthHeader(), 'Accept': 'application/json' } });
  if (res.ok) return res.json();
  // Fallback: se il base URL è vuoto e stiamo chiamando un endpoint /api, riprova contro Render
  if (!base && path.startsWith('/api/')) {
    try {
      const res2 = await fetch(`${FALLBACK_API_BASE}${path}`, { headers: { ...getAuthHeader(), 'Accept': 'application/json' } });
      if (res2.ok) return res2.json();
    } catch (_) {
      // ignora e gestisci errore sotto
    }
  }
  let detail = '';
  try { detail = await res.text(); } catch { /* ignore parse errors */ }
  const msg = `API GET ${path} failed: ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`;
  console.error(msg);
  throw new Error(msg);
}

export async function apiSend(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
  const base = getBase();
  const doFetch = (urlBase: string) => fetch(`${urlBase}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...getAuthHeader() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const res = await doFetch(base);
  if (method === 'DELETE') {
    if (!res.ok && res.status !== 204) {
      // Fallback anche per DELETE
      if (!base && path.startsWith('/api/')) {
        try {
          const res2 = await doFetch(FALLBACK_API_BASE);
          if (res2.ok || res2.status === 204) return null;
        } catch (_) { /* ignore */ }
      }
      let detail = '';
      try { detail = await res.text(); } catch { /* ignore parse errors */ }
      const msg = `API ${method} ${path} failed: ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`;
      console.error(msg);
      throw new Error(msg);
    }
    return null;
  }
  if (!res.ok) {
    // Fallback su POST/PUT
    if (!base && path.startsWith('/api/')) {
      try {
        const res2 = await doFetch(FALLBACK_API_BASE);
        if (res2.ok) return res2.json();
      } catch (_) { /* ignore */ }
    }
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore parse errors */ }
    const msg = `API ${method} ${path} failed: ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`;
    console.error(msg, { body });
    throw new Error(msg);
  }
  return res.json();
}
