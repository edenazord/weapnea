// Vercel Edge Middleware – SEO prerendering for bots
// Runs at the edge before serving static files.
// Docs: https://vercel.com/docs/functions/edge-middleware

export const config = {
  matcher: [
    // Match all routes except static assets
    '/((?!_next|images|locales|uploads|favicon|robots\\.txt|sitemap\\.xml|sw\\.js|.*\\..*).*)',
  ],
};

const BOT_UA_RE =
  /googlebot|google-inspectiontool|googleother|google-read-aloud|storebot-google|adsbot-google|mediapartners-google|apis-google|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|discordbot|slackbot|redditbot|pinterestbot|vkshare|w3c_validator|lighthouse|chrome-lighthouse|prerender/i;

// Set SEO_API_BASE_URL in the Vercel dashboard (Environment Variables)
const API_BASE = (process.env.SEO_API_BASE_URL ?? 'https://weapnea-api.onrender.com').replace(/\/$/, '');const SITE_BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.weapnea.com').replace(/\/$/, '');

const SUPPORTED_LANGS = ['it', 'en', 'es', 'fr', 'pl', 'ru'];

function resolveLang(acceptLang: string | null): string {
  if (!acceptLang) return 'it';
  const langs = acceptLang.split(',').map(l => l.split(';')[0].trim().toLowerCase().slice(0, 2));
  for (const l of langs) {
    if (SUPPORTED_LANGS.includes(l)) return l;
  }
  return 'it';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface SeoMeta {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
  lang?: string;
  jsonld?: string;
  body?: string[];
  links?: { href: string; text: string }[];
}

function buildHtml(meta: SeoMeta, pathname: string): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const bodyParagraphs = meta.body && meta.body.length ? meta.body : [meta.description];
  const bodyHtml = bodyParagraphs.map(p => `  <p>${escapeHtml(p)}</p>`).join('\n');
  const linksHtml = meta.links && meta.links.length
    ? `  <h2>Altri eventi</h2>\n  <ul>\n${meta.links.map(l => `    <li><a href="${escapeHtml(l.href)}">${escapeHtml(l.text)}</a></li>`).join('\n')}\n  </ul>`
    : '';
  const img = escapeHtml(meta.image);
  const u = escapeHtml(meta.url);
  const lang = meta.lang || 'it';
  const ogType = meta.type === 'article' ? 'article' : meta.type === 'profile' ? 'profile' : 'website';
  const OG_LOCALE_MAP: Record<string, string> = { it: 'it_IT', en: 'en_US', es: 'es_ES', fr: 'fr_FR', pl: 'pl_PL', ru: 'ru_RU' };
  const ogLocale = OG_LOCALE_MAP[lang] || 'it_IT';
  const orgFallbackJsonLd = `{"@context":"https://schema.org","@type":"Organization","name":"WeApnea","url":"${SITE_BASE}","logo":"${SITE_BASE}/images/weapnea-logo.png"}`;
  const jsonldStr = (meta.jsonld || orgFallbackJsonLd).replace(/<\/script>/gi, '<\\/script>');

  // hreflang alternate links (same URL for all languages – language is chosen client-side)
  const hreflangTags = SUPPORTED_LANGS.map(
    l => `  <link rel="alternate" hreflang="${l}" href="${escapeHtml(SITE_BASE + pathname)}" />`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <meta name="author" content="WeApnea" />
  <link rel="canonical" href="${u}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="theme-color" content="#1e40af" />

  <!-- hreflang (same URL for all languages) -->
${hreflangTags}
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(SITE_BASE + pathname)}" />

  <!-- Open Graph -->
  <meta property="og:site_name" content="WeApnea" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:url" content="${u}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="${ogLocale}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@weapnea" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />
  <script type="application/ld+json">${jsonldStr}</script>
</head>
<body>
  <h1>${t}</h1>
${bodyHtml}
${linksHtml}
  <a href="${u}">WeApnea</a>
</body>
</html>`;
}

// Per i bot non si restituisce mai la shell SPA: non ha canonical e Google
// sceglierebbe un'altra URL. Se l'API non risponde si usa un meta generico.
function botFallback(pathname: string, lang: string): Response {
  const meta: SeoMeta = {
    title: 'WeApnea – Community Apnea & Freediving',
    description: 'La community italiana per apneisti e freediver. Scopri eventi, corsi e allenamenti di apnea.',
    image: `${SITE_BASE}/images/weapnea-logo.png`,
    url: `${SITE_BASE}${pathname}`,
    type: 'website',
    lang,
  };
  return new Response(buildHtml(meta, pathname), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'X-Robots-Tag': 'index, follow',
      'Vary': 'Accept-Language',
    },
  });
}

// Pagine che non esistono o non sono pubbliche: 404 con noindex, così Google
// non le tratta come soft 404 con il meta della home.
function notFoundResponse(pathname: string, lang: string): Response {
  const meta: SeoMeta = {
    title: 'Pagina non trovata | WeApnea',
    description: 'La pagina cercata non esiste o non è pubblica.',
    image: `${SITE_BASE}/images/weapnea-logo.png`,
    url: `${SITE_BASE}${pathname}`,
    type: 'website',
    lang,
  };
  return new Response(buildHtml(meta, pathname), {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Robots-Tag': 'noindex, follow',
      'Vary': 'Accept-Language',
    },
  });
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const ua = request.headers.get('user-agent') ?? '';

  // Skip non-bots: let Vercel serve the static SPA normally
  if (!BOT_UA_RE.test(ua)) {
    return undefined;
  }

  const url = new URL(request.url);
  const { pathname } = url;

  // Detect language from Accept-Language header
  const acceptLang = request.headers.get('accept-language');
  const lang = resolveLang(acceptLang);

  // Home page: serve with WebSite + Organization JSON-LD for bots
  if (pathname === '/' || pathname === '') {
    const homeJsonLd = JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': 'WeApnea',
        'url': SITE_BASE,
        'potentialAction': { '@type': 'SearchAction', 'target': `${SITE_BASE}/?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        'name': 'WeApnea',
        'url': SITE_BASE,
        'logo': `${SITE_BASE}/images/weapnea-logo.png`,
        'description': 'La community italiana per apneisti e freediver. Scopri eventi, corsi e allenamenti di apnea.',
        'email': 'weapnea@gmail.com',
        'sameAs': ['https://www.instagram.com/weapnea/'],
      },
    ]);
    const homeMeta: SeoMeta = {
      title: 'WeApnea – Community Apnea & Freediving',
      description: 'La community italiana per apneisti e freediver. Scopri eventi, corsi e allenamenti di apnea.',
      image: `${SITE_BASE}/images/weapnea-logo.png`,
      url: SITE_BASE,
      type: 'website',
      lang,
      jsonld: homeJsonLd,
    };
    return new Response(buildHtml(homeMeta, pathname), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
        'X-Robots-Tag': 'index, follow',
        'Vary': 'Accept-Language',
      },
    });
  }

  try {
    const metaUrl = `${API_BASE}/api/seo-meta?path=${encodeURIComponent(pathname)}&lang=${lang}`;
    const resp = await fetch(metaUrl, {
      headers: {
        'User-Agent': 'WeApnea-SEO-Middleware/1.0',
        'Accept-Language': acceptLang ?? 'it',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (resp.status === 404) return notFoundResponse(pathname, lang);
    if (!resp.ok) return botFallback(pathname, lang);

    const meta = (await resp.json()) as SeoMeta;

    return new Response(buildHtml(meta, pathname), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        'X-Robots-Tag': 'index, follow',
        'Vary': 'Accept-Language',
      },
    });
  } catch {
    return botFallback(pathname, lang);
  }
}
