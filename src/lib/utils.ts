import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { backendConfig } from '@/lib/backendConfig';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Converte un URL potenzialmente relativo ("/public/uploads/...") in assoluto usando la base API.
// Mantiene invariati gli URL già assoluti (http/https/data/blob).
export function ensureAbsoluteUrl(url?: string | null, base?: string): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  if (!u) return undefined;
  if (/^(https?:|data:|blob:)/i.test(u)) return u;
  // Se è un path sotto /public (servito dal backend Express), usa la base API
  if (u.startsWith('/public/')) {
    const api = base || backendConfig.apiBaseUrl || '';
    return `${api}${u}`;
  }
  // Per altri path assoluti (es. /images/...), risolvi rispetto all'origin del frontend
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return new URL(u, window.location.origin).toString();
    }
  } catch {
    // ignore
  }
  // Fallback conservativo
  return u;
}

export function ensureAbsoluteUrls(urls?: (string | null | undefined)[] | null, base?: string): string[] {
  if (!urls || urls.length === 0) return [];
  return urls
    .map(u => ensureAbsoluteUrl(u || undefined, base))
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}
