import { backendConfig } from '@/lib/backendConfig';

export type PublicConfig = {
  eventsFreeMode: boolean;
  pastEventsCategoryPosition: number | null;
};

let cached: PublicConfig | null = null;

export async function getPublicConfig(): Promise<PublicConfig> {
  if (cached) return cached;
  try {
    const envForce = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FORCE_EVENTS_FREE)
      ? String((import.meta as any).env.VITE_FORCE_EVENTS_FREE).toLowerCase() === 'true'
      : false;
    const res = await fetch(`${backendConfig.apiBaseUrl || ''}/api/public-config`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cached = {
      eventsFreeMode: envForce ? true : Boolean(data?.eventsFreeMode),
      pastEventsCategoryPosition: (typeof data?.pastEventsCategoryPosition === 'number') ? data.pastEventsCategoryPosition : null,
    };
    return cached;
  } catch {
    // Fallback: no flags
    const envForce = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FORCE_EVENTS_FREE)
      ? String((import.meta as any).env.VITE_FORCE_EVENTS_FREE).toLowerCase() === 'true'
      : false;
    // Fallback sicuro: considera eventi gratuiti se non riusciamo a leggere la config
    cached = { eventsFreeMode: envForce ? true : true, pastEventsCategoryPosition: null };
    return cached;
  }
}

export function setPublicConfigForTests(cfg: PublicConfig) {
  cached = cfg;
}
