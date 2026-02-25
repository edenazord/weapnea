import { useEffect } from 'react';

interface PageHeadProps {
  title: string;
  description?: string;
}

/**
 * Sets document.title and meta description for SEO.
 * Mount in any page component to set per-page SEO meta tags.
 */
export default function PageHead({ title, description }: PageHeadProps) {
  useEffect(() => {
    const fullTitle = title.includes('WeApnea') ? title : `${title} | WeApnea`;
    document.title = fullTitle;

    // Update meta description
    if (description) {
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    }

    // Update OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    if (ogTitle) ogTitle.content = fullTitle;
    const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
    if (ogDesc && description) ogDesc.content = description;

    return () => {
      document.title = 'WeApnea – Community Apnea & Freediving';
    };
  }, [title, description]);

  return null;
}
