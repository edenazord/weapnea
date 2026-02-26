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
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|discordbot|slackbot|redditbot|pinterestbot|vkshare|w3c_validator|lighthouse|chrome-lighthouse|prerender/i;

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
}

function buildHtml(meta: SeoMeta, pathname: string): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const img = escapeHtml(meta.image);
  const u = escapeHtml(meta.url);
  const lang = meta.lang || 'it';
  const ogType = meta.type === 'article' ? 'article' : meta.type === 'profile' ? 'profile' : 'website';

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
  <meta property="og:locale" content="${lang}_${lang.toUpperCase()}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@weapnea" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />
</head>
<body>
  <h1>${t}</h1>
  <p>${d}</p>
  <a href="${u}">WeApnea</a>
</body>
</html>`;
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const ua = request.headers.get('user-agent') ?? '';

  // Skip non-bots: let Vercel serve the static SPA normally
  if (!BOT_UA_RE.test(ua)) {
    return undefined;
  }

  const url = new URL(request.url);
  const { pathname } = url;

  // Home page: let the default index.html be served (already has reasonable defaults)
  if (pathname === '/' || pathname === '') {
    return undefined;
  }

  // Detect language from Accept-Language header
  const acceptLang = request.headers.get('accept-language');
  const lang = resolveLang(acceptLang);

  try {
    const metaUrl = `${API_BASE}/api/seo-meta?path=${encodeURIComponent(pathname)}&lang=${lang}`;
    const resp = await fetch(metaUrl, {
      headers: {
        'User-Agent': 'WeApnea-SEO-Middleware/1.0',
        'Accept-Language': acceptLang ?? 'it',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) return undefined;

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
    // On any error (API down, timeout.), fall through to the static SPA
    return undefined;
  }
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
}

function buildHtml(meta: SeoMeta): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const img = escapeHtml(meta.image);
  const u = escapeHtml(meta.url);
  const ogType = meta.type === 'article' ? 'article' : meta.type === 'profile' ? 'profile' : 'website';

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <meta name="author" content="WeApnea" />
  <link rel="canonical" href="${u}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="theme-color" content="#1e40af" />

  <!-- Open Graph -->
  <meta property="og:site_name" content="WeApnea" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:url" content="${u}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="it_IT" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@weapnea" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />
</head>
<body>
  <h1>${t}</h1>
  <p>${d}</p>
  <a href="${u}">Vai su WeApnea</a>
</body>
</html>`;
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const ua = request.headers.get('user-agent') ?? '';

  // Skip non-bots: let Vercel serve the static SPA normally
  if (!BOT_UA_RE.test(ua)) {
    return undefined;
  }

  const url = new URL(request.url);
  const { pathname } = url;

  // Home page: let the default index.html be served (already has reasonable defaults)
  if (pathname === '/' || pathname === '') {
    return undefined;
  }

  try {
    const metaUrl = `${API_BASE}/api/seo-meta?path=${encodeURIComponent(pathname)}`;
    const resp = await fetch(metaUrl, {
      headers: { 'User-Agent': 'WeApnea-SEO-Middleware/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) return undefined;

    const meta = (await resp.json()) as SeoMeta;

    return new Response(buildHtml(meta), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        'X-Robots-Tag': 'index, follow',
      },
    });
  } catch {
    // On any error (API down, timeout…), fall through to the static SPA
    return undefined;
  }
}
