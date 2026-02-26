import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/apiClient';

interface SiteConfig {
  gtm_id?: string | null;
  ga4_id?: string | null;
  gsc_verification?: string | null;
}

export default function TrackingScripts() {
  const { data } = useQuery<SiteConfig>({
    queryKey: ['site-config-public'],
    queryFn: () => apiGet('/api/public/site-config'),
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 2,
    retry: 1,
  });

  useEffect(() => {
    if (!data) return;
    const injected: HTMLElement[] = [];

    // Google Search Console verification meta tag
    if (data.gsc_verification) {
      let meta = document.querySelector('meta[name="google-site-verification"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'google-site-verification';
        document.head.appendChild(meta);
        injected.push(meta);
      }
      meta.content = data.gsc_verification;
    }

    // Google Analytics 4
    if (data.ga4_id) {
      const existing = document.getElementById('__ga4_script__');
      if (!existing) {
        const s1 = document.createElement('script');
        s1.id = '__ga4_script__';
        s1.async = true;
        s1.src = `https://www.googletagmanager.com/gtag/js?id=${data.ga4_id}`;
        document.head.appendChild(s1);
        injected.push(s1);

        const s2 = document.createElement('script');
        s2.id = '__ga4_init__';
        s2.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${data.ga4_id}');`;
        document.head.appendChild(s2);
        injected.push(s2);
      }
    }

    // Google Tag Manager
    if (data.gtm_id) {
      const existing = document.getElementById('__gtm_script__');
      if (!existing) {
        const s = document.createElement('script');
        s.id = '__gtm_script__';
        s.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${data.gtm_id}');`;
        document.head.insertBefore(s, document.head.firstChild);
        injected.push(s);

        // GTM noscript body tag
        const noscript = document.createElement('noscript');
        noscript.id = '__gtm_noscript__';
        noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${data.gtm_id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
        document.body.insertBefore(noscript, document.body.firstChild);
        injected.push(noscript);
      }
    }

    return () => {
      // cleanup on unmount (dev HMR)
      injected.forEach(el => el.parentNode?.removeChild(el));
    };
  }, [data]);

  return null;
}
