import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/apiClient";

export interface SeoSetting {
  path: string;
  title: string | null;
  description: string | null;
  og_image: string | null;
  translations: Record<string, { title?: string | null; description?: string | null }> | null;
}

/**
 * Fetches all static-page SEO settings from the DB once per session.
 * Returns a map keyed by path.
 */
export function useSeoSettings() {
  return useQuery<Record<string, SeoSetting>>({
    queryKey: ["seo-settings-public"],
    queryFn: async () => {
      const rows: SeoSetting[] = await apiGet("/api/public/seo-settings");
      const map: Record<string, SeoSetting> = {};
      for (const r of rows) map[r.path] = r;
      return map;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });
}

/**
 * Given a {title, description} from DB and the current language code,
 * returns the best title/description for that language (with IT fallback).
 */
export function resolveSeoMeta(
  setting: SeoSetting,
  lang: string
): { title: string | null; description: string | null } {
  if (lang === "it") {
    return { title: setting.title ?? null, description: setting.description ?? null };
  }
  const tr = setting.translations?.[lang];
  return {
    title: tr?.title || setting.title || null,
    description: tr?.description || setting.description || null,
  };
}
