import { backendConfig } from '@/lib/backendConfig';

export type PublicConfig = {
  eventsFreeMode: boolean;
  pastEventsCategoryPosition: number | null;
};

let cached: PublicConfig | null = null;

export async function getPublicConfig(): Promise<PublicConfig> {
  if (cached) return cached;
  try {
    const res = await fetch(`${backendConfig.apiBaseUrl || ''}/api/public-config`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cached = {
      eventsFreeMode: Boolean(data?.eventsFreeMode),
      pastEventsCategoryPosition: (typeof data?.pastEventsCategoryPosition === 'number') ? data.pastEventsCategoryPosition : null,
    };
    return cached;
  } catch {
    // Fallback: no flags
    cached = { eventsFreeMode: false, pastEventsCategoryPosition: null };
    return cached;
  }
}

export function setPublicConfigForTests(cfg: PublicConfig) {
  cached = cfg;
}
