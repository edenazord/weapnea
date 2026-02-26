import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSeoSettings, resolveSeoMeta } from '@/hooks/useSeoSettings';

interface PageHeadProps {
  title: string;
  description?: string;
}

/**
 * Sets document.title and meta description for SEO.
 * Priority: DB admin settings (per language) → props fallback.
 */
export default function PageHead({ title: propTitle, description: propDesc }: PageHeadProps) {
  const location = useLocation();
  const { currentLanguage } = useLanguage();
  const { data: seoMap } = useSeoSettings();

  useEffect(() => {
    const setting = seoMap?.[location.pathname];
    const lang = currentLanguage || 'it';

    // Resolve effective values: DB first, then props fallback
    let effectiveTitle = propTitle;
    let effectiveDesc = propDesc;

    if (setting) {
      const resolved = resolveSeoMeta(setting, lang);
      if (resolved.title) effectiveTitle = resolved.title;
      if (resolved.description) effectiveDesc = resolved.description;
    }

    const fullTitle = effectiveTitle.includes('WeApnea')
      ? effectiveTitle
      : `${effectiveTitle} | WeApnea`;

    document.title = fullTitle;

    // Meta description
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (effectiveDesc) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = effectiveDesc;
    }

    // OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    if (ogTitle) ogTitle.content = fullTitle;
    const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
    if (ogDesc && effectiveDesc) ogDesc.content = effectiveDesc;

    return () => {
      document.title = 'WeApnea – Community Apnea & Freediving';
    };
  }, [propTitle, propDesc, location.pathname, currentLanguage, seoMap]);

  return null;
}
