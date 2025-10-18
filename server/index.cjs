// Minimal API server to read directly from Postgres and expose REST endpoints
// Usage:
//   POSTGRES_URL=postgres://user:pass@host:port/db node server/index.cjs
// Optional:
//   PORT=5174

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
let S3Client, PutObjectCommand;
try { ({ S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')); } catch {}
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');
const { Resend } = require('resend');
const fsp = require('fs/promises');

const PORT = process.env.PORT ? Number(process.env.PORT) : 5174;
const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.RENDER_EXTERNAL_DB_URL;
if (!DATABASE_URL) {
  console.error('Missing POSTGRES_URL env var');
  process.exit(1);
}

// Configure Postgres connection with optional SSL (useful on managed providers like Neon/ElephantSQL)
const sslRequired = (
  process.env.DB_SSL === 'true' ||
  process.env.PGSSLMODE === 'require' ||
  (DATABASE_URL && /(?:^|[?&])sslmode=require(?:&|$)/i.test(DATABASE_URL))
);
const pool = new Pool({
  connectionString: DATABASE_URL,
  // If SSL is required, accept self-signed certs to ease managed provider setups
  ssl: sslRequired ? { rejectUnauthorized: false } : false,
});

// --- Automatic SQL migrations runner (idempotent) ---
async function runMigrationsAtStartup() {
  // Allow disabling via env if needed
  if (String(process.env.AUTO_MIGRATE_DB || 'true').toLowerCase() !== 'true') {
    console.log('[migrate] AUTO_MIGRATE_DB=false, skipping');
    return;
  }
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE TABLE IF NOT EXISTS public._migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

      // Detect migrations directory: env MIGRATIONS_DIR or default to scripts/migrations
      const defaultDir = path.join(__dirname, '..', 'scripts', 'migrations');
      const migrationsDir = process.env.MIGRATIONS_DIR ? path.resolve(process.env.MIGRATIONS_DIR) : defaultDir;
      let files = [];
      try {
        const entries = await fsp.readdir(migrationsDir);
        files = entries.filter(f => f.endsWith('.sql')).sort((a, b) => a.localeCompare(b));
      } catch (e) {
        console.warn('[migrate] migrations dir not found:', migrationsDir);
      }
      if (!files.length) {
        console.log('[migrate] no migrations to apply');
        client.release();
        return;
      }

      const { rows } = await client.query('SELECT filename FROM public._migrations');
      const done = new Set(rows.map(r => r.filename));

      for (const fname of files) {
        if (done.has(fname)) continue;
        const full = path.join(migrationsDir, fname);
        let sql;
        try { sql = await fsp.readFile(full, 'utf8'); } catch (e) { console.warn('[migrate] cannot read', full, e?.message || e); continue; }
        console.log('[migrate] applying', fname);
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('INSERT INTO public._migrations(filename) VALUES($1)', [fname]);
          await client.query('COMMIT');
          console.log('[migrate] ✓', fname);
        } catch (e) {
          await client.query('ROLLBACK');
          console.error('[migrate] failed', fname, e?.message || e);
          // Don't crash the server; continue to allow runtime ensures to fix critical bits
        }
      }
    } finally {
      client.release();
    }
  } catch (e) {
    console.warn('[migrate] startup migrations error:', e?.message || e);
  }
}

// Ensure required schema bits exist (safe to run at startup)
(async () => {
  try {
    // Run full SQL migrations first (idempotent)
    await runMigrationsAtStartup();
    // Ensure optional columns/tables exist to avoid runtime failures if migrations weren't applied yet
    await pool.query("ALTER TABLE IF NOT EXISTS public.profiles ADD COLUMN IF NOT EXISTS personal_best jsonb");
    // Simple key-value app settings store (for UI-configurable options like past-events position)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.app_settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE TABLE IF NOT EXISTS public.user_packages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        package_type text NOT NULL CHECK (package_type IN ('organizer','sponsor')),
        package_id text NOT NULL,
        package_name text NOT NULL,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
        starts_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(user_id, package_type)
      );
      CREATE INDEX IF NOT EXISTS idx_user_packages_user_id ON public.user_packages(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_packages_created_at ON public.user_packages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_packages_status ON public.user_packages(status);
    `);
    await detectSchema();
    if (!HAS_PUBLIC_PROFILE_FIELDS) {
      await ensurePublicProfileColumnsAtRuntime();
      await detectSchema();
    }
    console.log('[startup] ensured/detected flags:', { HAS_PERSONAL_BEST, HAS_USER_PACKAGES, HAS_PUBLIC_PROFILE_FIELDS });
  } catch (e) {
    console.error('[startup] ensure/detect schema failed:', e?.message || e);
  }
})();

const app = express();
// Rispetta i proxy (Render/Ingress) per ottenere host/proto corretti
app.set('trust proxy', true);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
// Rispondi ai preflight CORS per tutte le route
app.options('*', cors({ origin: true, credentials: true }));
// serve static files from public (to expose uploaded images)
app.use('/public', express.static(path.join(__dirname, '..', 'public')));
// Static mount per /public/uploads anche se UPLOADS_DIR è esterno alla cartella public
const DEFAULT_UPLOADS = path.join(__dirname, '..', 'public', 'uploads');
const UPLOADS_DIR = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : DEFAULT_UPLOADS;
try { app.use('/public/uploads', express.static(UPLOADS_DIR)); } catch {}

function getApiPublicBase(req) {
  // Preferisci override esplicito via env (es. https://weapnea-api.onrender.com)
  if (process.env.API_PUBLIC_BASE_URL) return process.env.API_PUBLIC_BASE_URL.replace(/\/$/, '');
  // Altrimenti costruisci dagli header proxy-aware
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0];
  const host = (req.headers['x-forwarded-host'] || req.headers['host'] || '').toString().split(',')[0];
  if (host) return `${proto}://${host}`;
  // Fallback finale: dominio API pubblico di produzione
  return 'https://weapnea-api.onrender.com';
}

// Upload storage driver: 'local' (default), 's3' (S3-compatible e.g. R2, B2), or 'sftp'
const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
// Multer storage config for uploads (supporta UPLOADS_DIR, es. /data/uploads su Render)
const uploadDir = UPLOADS_DIR;
if (STORAGE_DRIVER === 'local') {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = (STORAGE_DRIVER === 's3' || STORAGE_DRIVER === 'sftp')
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '.bin';
        const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        cb(null, name);
      }
    });
const upload = multer({ storage });

// Simple token-based auth for mutation endpoints
const API_TOKEN = process.env.API_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Feature flags detected at runtime
let HAS_PERSONAL_BEST = false;
let HAS_USER_PACKAGES = false;
let HAS_PUBLIC_PROFILE_FIELDS = false;

async function ensurePersonalBestColumnAtRuntime() {
  try {
    await pool.query("ALTER TABLE IF NOT EXISTS public.profiles ADD COLUMN IF NOT EXISTS personal_best jsonb");
    HAS_PERSONAL_BEST = true;
  } catch (e) {
    console.warn('[personal_best] ensure column failed:', e?.message || e);
  }
}
async function ensurePublicProfileColumnsAtRuntime() {
  try {
    await pool.query(`
      ALTER TABLE IF NOT EXISTS public.profiles
        ADD COLUMN IF NOT EXISTS public_profile_enabled boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS public_slug text,
        ADD COLUMN IF NOT EXISTS public_show_bio boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS public_show_instagram boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS public_show_company_info boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS public_show_certifications boolean DEFAULT true;
    `);
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uniq_profiles_public_slug_lower'
        ) THEN
          EXECUTE 'CREATE UNIQUE INDEX uniq_profiles_public_slug_lower ON public.profiles (lower(public_slug)) WHERE public_slug IS NOT NULL';
        END IF;
      END$$;
    `);
    HAS_PUBLIC_PROFILE_FIELDS = true;
  } catch (e) {
    console.warn('[public_profile] ensure columns failed:', e?.message || e);
  }
}
let HAS_BLOG_LANGUAGE = false;
async function detectSchema() {
  try {
    const q = `SELECT 1 FROM information_schema.columns 
               WHERE table_schema='public' AND table_name='profiles' AND column_name='personal_best'`;
    const { rowCount } = await pool.query(q);
    HAS_PERSONAL_BEST = rowCount > 0;
    if (!HAS_PERSONAL_BEST) console.warn('[startup] profiles.personal_best NOT present');
    const r2 = await pool.query("SELECT to_regclass('public.user_packages') as t");
    HAS_USER_PACKAGES = !!r2.rows?.[0]?.t;
    if (!HAS_USER_PACKAGES) console.warn('[startup] user_packages table NOT present');

    // Ensure blog_articles.language column exists (auto-migration light)
    await ensureBlogLanguageColumn();

    // Detect public profile fields presence (require both enabled flag and slug column)
    const r3a = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='public_profile_enabled'`);
    const r3b = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='public_slug'`);
    HAS_PUBLIC_PROFILE_FIELDS = (r3a.rowCount > 0) && (r3b.rowCount > 0);
    if (!HAS_PUBLIC_PROFILE_FIELDS) console.warn('[startup] profiles.public_profile_* NOT present');
  } catch (e) {
    console.warn('[startup] schema detection failed:', e?.message || e);
  }
}

// Lightweight ensure for blog language column/constraint (idempotent)
async function ensureBlogLanguageColumn() {
  try {
    await pool.query("ALTER TABLE IF EXISTS public.blog_articles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'it'");

    // Elenco lingue consentite configurabile via env, fallback a set ampliato
    const allowedLangs = (process.env.BLOG_LANGUAGES || 'it,en,es,fr,pl,ru')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    const uniqueLangs = Array.from(new Set(allowedLangs));
    const checkList = uniqueLangs.map(l => `'${l.replace(/'/g, "''")}'`).join(',');
    const expectedDef = `CHECK ((language = ANY (ARRAY[${checkList}])))`;

    // Recupera constraint esistente (se presente)
    const existing = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'blog_articles' AND conname = 'blog_articles_language_check' AND contype = 'c'
    `);

    if (existing.rowCount === 0) {
      await pool.query(`ALTER TABLE public.blog_articles ADD CONSTRAINT blog_articles_language_check CHECK (language IN (${checkList}))`);
      console.log('[blog] added language check constraint with', uniqueLangs);
    } else {
      const currentDef = existing.rows[0].def; // es. CHECK ((language = ANY (ARRAY['it'::text, 'en'::text])))
      // Normalizziamo rimuovendo cast ::text e spazi per confronto semplice
      const normalize = (s) => s.replace(/::text/g, '').replace(/\s+/g, ' ').trim();
      if (!normalize(currentDef).includes(normalize(checkList))) {
        // Se non include tutte le lingue attese, ricreiamo il constraint
        console.log('[blog] updating language constraint from', currentDef, 'to', uniqueLangs);
        await pool.query('ALTER TABLE public.blog_articles DROP CONSTRAINT blog_articles_language_check');
        await pool.query(`ALTER TABLE public.blog_articles ADD CONSTRAINT blog_articles_language_check CHECK (language IN (${checkList}))`);
      }
    }

    const lc = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_articles' AND column_name='language'`);
    HAS_BLOG_LANGUAGE = lc.rowCount > 0;
    if (!HAS_BLOG_LANGUAGE) console.warn('[ensure] blog_articles.language NOT present after ensure');
  } catch (e) {
    console.warn('[blog] ensure language column failed:', e?.message || e);
  }
}
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
// Global toggle: make all events free (bypass checkout)
const EVENTS_FREE_MODE = String(process.env.EVENTS_FREE_MODE || '').toLowerCase() === 'true';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'WeApnea <noreply@example.com>';
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// --- App settings helpers ---
async function getSettingValue(key, defaultValue = null) {
  try {
    const { rows } = await pool.query('SELECT value FROM public.app_settings WHERE key = $1', [key]);
    if (rows[0] && rows[0].value !== undefined && rows[0].value !== null) return rows[0].value;
    return defaultValue;
  } catch (e) {
    console.warn('[settings] get failed:', key, e?.message || e);
    return defaultValue;
  }
}

async function setSettingValue(key, value) {
  try {
    await pool.query(
      `INSERT INTO public.app_settings(key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value]
    );
    return { ok: true };
  } catch (e) {
    console.warn('[settings] set failed:', key, e?.message || e);
    throw e;
  }
}

async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.warn('Resend not configured, skipping email:', subject, to);
    return { skipped: true };
  }
  try {
    const { data, error } = await resend.emails.send({ from: RESEND_FROM_EMAIL, to, subject, html });
    if (error) throw error;
    return { ok: true, id: data?.id };
  } catch (e) {
    console.error('Email send failed:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}
function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) {
    if (API_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
    return next(); // dev: allow if no token provided and no API_TOKEN enforced
  }
  const token = auth.slice('Bearer '.length);
  // Accept static API token (for admin/dev) OR JWT (for users)
  if (API_TOKEN && token === API_TOKEN) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, role }
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  // Admin if JWT with role=admin OR if API_TOKEN is used directly
  if (req.user?.role === 'admin') return next();
  if (API_TOKEN && token === API_TOKEN) return next();
  return res.status(403).json({ error: 'Forbidden' });
}

function requireBloggerOrAdmin(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  if (req.user?.role === 'admin' || req.user?.role === 'blogger') return next();
  if (API_TOKEN && token === API_TOKEN) return next();
  return res.status(403).json({ error: 'Forbidden' });
}

// Auth endpoints (JWT)
app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name = null, role = 'final_user' } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO profiles(id, email, full_name, role, is_active, password_hash)
       VALUES (gen_random_uuid(), $1, $2, $3, true, $4)
       RETURNING id, email, full_name, role, is_active`,
      [email, full_name, role, hash]
    );
    const user = rows[0];
    const jwtToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    // Fire-and-forget welcome email
    sendEmail({
      to: user.email,
      subject: 'Benvenuto su WeApnea',
      html: `<p>Ciao ${user.full_name || ''},</p><p>benvenuto su WeApnea! Il tuo account è stato creato con successo.</p>`
    }).catch(() => {});
    res.status(201).json({ token: jwtToken, user });
  } catch (e) {
    if (String(e.message).includes('duplicate key')) {
      return res.status(409).json({ error: 'Email già registrata' });
    }
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, is_active, password_hash FROM profiles WHERE email = $1 LIMIT 1`,
      [email]
    );
    const user = rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Credenziali non valide' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenziali non valide' });
    const jwtToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    delete user.password_hash;
    res.json({ token: jwtToken, user });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// API: request password reset -> generates token, stores it, sends email via Resend
app.post('/api/auth/request-password-reset', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });
  try {
    const { rows } = await pool.query('SELECT id, email, full_name FROM profiles WHERE email = $1 LIMIT 1', [email]);
    if (!rows[0]) return res.json({ ok: true }); // don't leak
    const user = rows[0];
    // short-lived JWT as reset token
    const resetToken = jwt.sign({ id: user.id, email: user.email, t: 'pwd' }, JWT_SECRET, { expiresIn: '30m' });
    // store token hash + expiry
    await pool.query(
      `INSERT INTO password_resets(user_id, token_hash, expires_at)
       VALUES ($1, crypt($2, gen_salt('bf')), now() + interval '30 minutes')
       ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at`,
      [user.id, resetToken]
    );
    const base = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
    const link = `${base}/password-reset?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(user.email)}&type=recovery`;
    await sendEmail({
      to: user.email,
      subject: 'Recupero password WeApnea',
      html: `<p>Ciao ${user.full_name || ''},</p><p>clicca <a href="${link}">qui</a> per reimpostare la tua password. Il link scade tra 30 minuti.</p>`
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// API: confirm password reset using token
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = payload?.id;
    if (!userId) return res.status(400).json({ error: 'invalid token' });
    // Verify token by matching bcrypt hash
    const { rows } = await pool.query('SELECT token_hash, expires_at FROM password_resets WHERE user_id = $1 LIMIT 1', [userId]);
    const r = rows[0];
    if (!r || new Date(r.expires_at) < new Date()) return res.status(400).json({ error: 'token expired' });
    // Compare plain token with hashed token_hash via crypt
    const { rows: match } = await pool.query('SELECT crypt($1, $2) = $2 as ok', [token, r.token_hash]);
    if (!match[0]?.ok) return res.status(400).json({ error: 'invalid token' });
    // Update password
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE profiles SET password_hash = $1 WHERE id = $2', [hash, userId]);
    // Invalidate token
    await pool.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'invalid or expired token' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
  if (!HAS_PERSONAL_BEST) { await ensurePersonalBestColumnAtRuntime(); }
  const pb = HAS_PERSONAL_BEST
    ? ", COALESCE(personal_best, '{}'::jsonb) AS personal_best"
    : ", '{}'::jsonb AS personal_best";
  const pub = HAS_PUBLIC_PROFILE_FIELDS
    ? ", COALESCE(public_profile_enabled,false) AS public_profile_enabled, public_slug, COALESCE(public_show_bio,true) AS public_show_bio, COALESCE(public_show_instagram,true) AS public_show_instagram, COALESCE(public_show_company_info,true) AS public_show_company_info, COALESCE(public_show_certifications,true) AS public_show_certifications"
    : ", false AS public_profile_enabled, NULL::text AS public_slug, true AS public_show_bio, true AS public_show_instagram, true AS public_show_company_info, true AS public_show_certifications";
  const sql = `SELECT 
    id, email, full_name, role, is_active, avatar_url,
    bio, brevetto, scadenza_brevetto, scadenza_certificato_medico,
    assicurazione, scadenza_assicurazione, instagram_contact${pb},
    company_name, vat_number, company_address, phone${pub}
     FROM profiles WHERE id = $1 LIMIT 1`;
  const { rows } = await pool.query(sql, [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/health', async (_, res) => {
  try {
    const { rows } = await pool.query('select version() as version');
    return res.json({ ok: true, pg: rows[0].version });
  } catch (e) {
    // Return 200 even if DB isn't reachable yet, so platform health checks pass
    return res.json({ ok: false, error: String(e?.message || e) });
  }
});

// Profile endpoints (API mode)
app.get('/api/profile', requireAuth, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
  if (!HAS_PERSONAL_BEST) { await ensurePersonalBestColumnAtRuntime(); }
  // Prova a garantire le colonne del profilo pubblico anche in GET
  if (!HAS_PUBLIC_PROFILE_FIELDS) {
    try { await ensurePublicProfileColumnsAtRuntime(); await detectSchema(); } catch (_) {}
  }
  const pb = HAS_PERSONAL_BEST
    ? ", COALESCE(personal_best, '{}'::jsonb) AS personal_best"
    : ", '{}'::jsonb AS personal_best";
  const pub = HAS_PUBLIC_PROFILE_FIELDS
    ? ", COALESCE(public_profile_enabled,false) AS public_profile_enabled, public_slug, COALESCE(public_show_bio,true) AS public_show_bio, COALESCE(public_show_instagram,true) AS public_show_instagram, COALESCE(public_show_company_info,true) AS public_show_company_info, COALESCE(public_show_certifications,true) AS public_show_certifications"
    : ", false AS public_profile_enabled, NULL::text AS public_slug, true AS public_show_bio, true AS public_show_instagram, true AS public_show_company_info, true AS public_show_certifications";
  const sql = `SELECT 
    id, email, full_name, role, is_active, avatar_url,
    bio, brevetto, scadenza_brevetto, scadenza_certificato_medico,
    assicurazione, scadenza_assicurazione, instagram_contact${pb},
    company_name, vat_number, company_address, phone${pub}
     FROM profiles WHERE id = $1 LIMIT 1`;
  const { rows } = await pool.query(sql, [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.put('/api/profile', requireAuth, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    if (!HAS_PERSONAL_BEST) { await ensurePersonalBestColumnAtRuntime(); }
    if (!HAS_PUBLIC_PROFILE_FIELDS) {
      try { await ensurePublicProfileColumnsAtRuntime(); await detectSchema(); } catch (_) {}
    }
    const allowed = [
      'full_name','avatar_url','bio','brevetto','scadenza_brevetto','scadenza_certificato_medico',
      'assicurazione','scadenza_assicurazione','instagram_contact',
      'company_name','vat_number','company_address','phone'
    ];
    if (HAS_PUBLIC_PROFILE_FIELDS) {
      allowed.push('public_profile_enabled','public_slug','public_show_bio','public_show_instagram','public_show_company_info','public_show_certifications');
    }
    if (HAS_PERSONAL_BEST) allowed.push('personal_best');
    const p = req.body || {};
    // Sanitizza/normalizza slug lato server (sicurezza/coerenza)
    if (typeof p.public_slug === 'string') {
      p.public_slug = p.public_slug
        .toLowerCase()
        .trim()
        .replace(/[@._]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || null;
    }
    const fields = Object.keys(p).filter(k => allowed.includes(k));
    if (fields.length === 0) return res.status(400).json({ error: 'no valid fields to update' });
    // Serialize JSON fields
    const values = fields.map((k) => {
      if (k === 'personal_best' && p[k] && typeof p[k] !== 'string') {
        return JSON.stringify(p[k]);
      }
      return p[k];
    });
    const sets = fields.map((k,i)=> {
      if (k === 'personal_best') return `${k} = $${i+1}::jsonb`;
      return `${k} = $${i+1}`;
    }).join(', ');
    const sql = `UPDATE profiles SET ${sets}, updated_at = now() WHERE id = $${fields.length+1} RETURNING *`;
    let rows;
    try {
      ({ rows } = await pool.query(sql, [...values, req.user.id]));
    } catch (e) {
      const code = e && e.code;
      const msg = String(e?.message || '');
      // unique violation on lower(public_slug) index
      if (code === '23505' || msg.includes('uniq_profiles_public_slug_lower')) {
        return res.status(409).json({ error: 'public_slug conflict' });
      }
      throw e;
    }
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ user: rows[0] });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Slug availability (public). Consider all profiles, even if public disabled.
app.get('/api/profile/slug-availability/:slug', async (req, res) => {
  const raw = String(req.params.slug || '').trim();
  if (!raw) return res.status(400).json({ available: false, error: 'empty slug' });
  // Normalizza come lato update
  const slug = raw
    .toLowerCase()
    .trim()
    .replace(/[@._]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!slug) return res.status(400).json({ available: false, error: 'invalid slug' });
  try {
    if (!HAS_PUBLIC_PROFILE_FIELDS) {
      try { await ensurePublicProfileColumnsAtRuntime(); await detectSchema(); } catch (_) {}
    }
    const doQuery = async () => {
      const { rows } = await pool.query(
        `SELECT id FROM profiles WHERE lower(public_slug) = lower($1) LIMIT 1`,
        [slug]
      );
      return rows[0];
    };
    let row;
    try {
      row = await doQuery();
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('column') && msg.toLowerCase().includes('public_slug')) {
        // Prova a creare le colonne e ritenta una volta
        try { await ensurePublicProfileColumnsAtRuntime(); await detectSchema(); } catch (_) {}
        row = await doQuery();
      } else if (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('profiles')) {
        // Se la tabella non esiste ancora, prova migrazioni automatiche e ritenta
        try { await runMigrationsAtStartup(); await detectSchema(); } catch (_) {}
        row = await doQuery();
      } else {
        throw e;
      }
    }
    if (!row) return res.json({ available: true, mine: false });
    // Senza auth non possiamo sapere se è "mio": restituiamo solo available=false
    return res.json({ available: false });
  } catch (e) {
    const msg = String(e?.message || e);
    return res.status(500).json({ available: false, error: msg });
  }
});

// Simple image upload endpoint (API mode). Returns public URL under /public/uploads
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const ext = req.file.originalname ? path.extname(req.file.originalname) : '';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext || ''}`;
    // Determina driver effettivo (fallback automatico se SFTP configurato male)
    const driver = STORAGE_DRIVER;
    const sftpConfigMissing = (
      driver === 'sftp' && (
        !process.env.SFTP_HOST ||
        !(process.env.SFTP_USERNAME || process.env.SFTP_USER) ||
        !(process.env.SFTP_PASSWORD || process.env.SFTP_PASS)
      )
    );
    if (sftpConfigMissing) {
      console.warn('[upload] STORAGE_DRIVER=sftp ma variabili SFTP mancanti (SFTP_HOST / USERNAME / PASSWORD). Fallback a storage locale.');
    }

    if (driver === 's3') {
      if (!S3Client || !PutObjectCommand) {
        return res.status(500).json({ error: 'S3 client not installed. Please add @aws-sdk/client-s3.' });
      }
      const region = process.env.S3_REGION || 'auto';
      const endpoint = process.env.S3_ENDPOINT || undefined; // e.g. https://<accountid>.r2.cloudflarestorage.com
      const bucket = process.env.S3_BUCKET;
      const accessKeyId = process.env.S3_ACCESS_KEY_ID;
      const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
      const publicBase = process.env.S3_PUBLIC_BASE_URL; // e.g. https://cdn.example.com or https://<bucket>.<provider>/bucket
      if (!bucket || !accessKeyId || !secretAccessKey || !publicBase) {
        return res.status(500).json({ error: 'S3 configuration missing (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_BASE_URL)' });
      }
      const s3 = new S3Client({
        region,
        endpoint,
        forcePathStyle: !!endpoint, // recommended for R2/B2/minio
        credentials: { accessKeyId, secretAccessKey },
      });
  const key = `uploads/${name}`;
  const contentType = req.file.mimetype || 'application/octet-stream';
  const putParams = { Bucket: bucket, Key: key, Body: req.file.buffer, ContentType: contentType };
  if (process.env.S3_ACL) putParams.ACL = process.env.S3_ACL; // e.g. 'public-read' (omit for R2)
  await s3.send(new PutObjectCommand(putParams));
      const url = `${publicBase.replace(/\/$/, '')}/${key}`;
      return res.status(201).json({ url, key });
    }

    if (driver === 'sftp' && !sftpConfigMissing) {
      let SFTPClient;
      try { SFTPClient = require('ssh2-sftp-client'); } catch (e) {
        return res.status(500).json({ error: 'SFTP client not installed. Please add ssh2-sftp-client.' });
      }
      const sftpHost = process.env.SFTP_HOST;
      const sftpPort = Number(process.env.SFTP_PORT || 22);
      const sftpUser = process.env.SFTP_USERNAME || process.env.SFTP_USER;
      const sftpPass = process.env.SFTP_PASSWORD || process.env.SFTP_PASS;
      const sftpBaseDir = process.env.SFTP_BASE_DIR || '/weapnea/uploads';
      const publicBaseEnv = process.env.SFTP_PUBLIC_BASE_URL; // es: https://example.com/uploads
      const publicDomain = process.env.SFTP_PUBLIC_DOMAIN || sftpHost;
      const remoteRoot = process.env.SFTP_REMOTE_ROOT || '/weapnea';
      const sftpDebug = String(process.env.SFTP_DEBUG || 'false').toLowerCase() === 'true';
      if (!sftpHost || !sftpUser || !sftpPass) {
        return res.status(500).json({ error: 'SFTP configuration missing (SFTP_HOST, SFTP_USERNAME, SFTP_PASSWORD)' });
      }
      const remoteDir = sftpBaseDir.replace(/\/$/, '');
      const remotePath = `${remoteDir}/${name}`;
      const sftp = new SFTPClient();
      try {
        await sftp.connect({ host: sftpHost, port: sftpPort, username: sftpUser, password: sftpPass });
        // Ensure directory exists
        const dirExists = await sftp.exists(remoteDir);
        if (!dirExists) {
          await sftp.mkdir(remoteDir, true);
          // Applica permessi directory se richiesto
          if (process.env.SFTP_CHMOD_DIRS) {
            try { await sftp.chmod(remoteDir, process.env.SFTP_CHMOD_DIRS); } catch (e) { console.warn('[sftp] chmod dir failed', e?.message); }
          }
        }
        const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
        if (!buffer) throw new Error('Missing file buffer');
        await sftp.put(buffer, remotePath);
        // Imposta permessi file se configurato
        if (process.env.SFTP_CHMOD_FILES) {
          try { await sftp.chmod(remotePath, process.env.SFTP_CHMOD_FILES); } catch (e) { console.warn('[sftp] chmod file failed', e?.message); }
        }
        if (sftpDebug) {
          console.log('[sftp] uploaded', { remotePath, size: buffer.length, chmodFile: process.env.SFTP_CHMOD_FILES || null, chmodDir: process.env.SFTP_CHMOD_DIRS || null });
        }
      } catch (err) {
        try { await sftp.end(); } catch {}
        return res.status(500).json({ error: `SFTP upload failed: ${String(err?.message || err)}` });
      }
      try { await sftp.end(); } catch {}
      // Costruzione URL pubblico: preferisci SFTP_PUBLIC_BASE_URL se presente,
      // altrimenti deduci da host e struttura directory (assumendo webroot == SFTP_REMOTE_ROOT)
      let deducedBasePath = '/uploads';
      if (sftpBaseDir.startsWith(remoteRoot)) {
        deducedBasePath = sftpBaseDir.slice(remoteRoot.length);
        if (!deducedBasePath.startsWith('/')) deducedBasePath = `/${deducedBasePath}`;
      }
      const computedBase = `https://${publicDomain}${deducedBasePath}`;
      const finalBase = (publicBaseEnv || computedBase).replace(/\/$/, '');
      const url = `${finalBase}/${name}`;
      if (sftpDebug) {
        console.log('[sftp] final URL', { finalBase, url, remoteRoot, sftpBaseDir, deducedBasePath });
      }
      return res.status(201).json({ url, path: url });
    }

  // LOCAL storage (ephemeral on Render unless using a persistent disk)
  // Costruisci URL pubblico usando host/proto della richiesta (o API_PUBLIC_BASE_URL)
  const baseUrl = getApiPublicBase(req);
    const destPath = path.join(uploadDir, name);
    // If using diskStorage, file already saved; if memoryStorage (shouldn't happen here), write it
    if (req.file.buffer && !req.file.path) {
      fs.writeFileSync(destPath, req.file.buffer);
    } else if (req.file.path && path.basename(req.file.path) !== name) {
      // Ensure file name matches our computed name for predictable URLs
      fs.renameSync(req.file.path, destPath);
    }
  const publicUrl = `${baseUrl}/public/uploads/${name}`;
    res.status(201).json({ url: publicUrl, path: `/public/uploads/${name}` });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Categories with event count (UUID ids)
app.get('/api/categories', async (_req, res) => {
  const sql = `
    SELECT c.id, c.name, COALESCE(c.order_index, 0) AS order_index,
           COUNT(e.id)::int AS events_count
    FROM categories c
    LEFT JOIN events e ON e.category_id = c.id
    GROUP BY c.id, c.name, c.order_index
    ORDER BY order_index ASC;
  `;
  try {
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Public config for frontend feature flags
app.get('/api/public-config', async (_req, res) => {
  try {
    const pos = await getSettingValue('past_events_category_position', null);
    res.json({
      eventsFreeMode: EVENTS_FREE_MODE,
      pastEventsCategoryPosition: (pos && typeof pos.index === 'number') ? pos.index : null,
    });
  } catch (e) {
    res.json({ eventsFreeMode: EVENTS_FREE_MODE, pastEventsCategoryPosition: null });
  }
});

// Settings API (protected)
app.get('/api/settings/:key', requireAuth, async (req, res) => {
  const key = String(req.params.key);
  const val = await getSettingValue(key, null);
  res.json({ key, value: val });
});

app.put('/api/settings/:key', requireAuth, async (req, res) => {
  const key = String(req.params.key);
  const value = req.body?.value;
  try {
    await setSettingValue(key, value);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Helper to build SELECT for events including category name
function eventsSelect() {
  const organizerExtras = HAS_PUBLIC_PROFILE_FIELDS
    ? `COALESCE(p.public_profile_enabled, false) AS organizer_public_enabled, p.public_slug AS organizer_public_slug,`
    : `false AS organizer_public_enabled, NULL::text AS organizer_public_slug,`;
  return `
  SELECT 
    e.id, e.created_at, e.title, e.slug, e.description, e.date, e.end_date,
    e.location, e.participants, e.image_url, e.category_id, e.cost, e.nation,
    e.discipline, e.created_by, e.level, e.activity_description, e.language,
    e.about_us, e.objectives, e.included_in_activity, e.not_included_in_activity,
    e.notes, e.schedule_logistics, e.gallery_images, e.event_type,
    e.activity_details, e.who_we_are, e.fixed_appointment, e.instructors,
    e.instructor_certificates, e.max_participants_per_instructor, e.schedule_meeting_point,
    e.responsibility_waiver_accepted, e.privacy_accepted,
    -- Organizer public fields (for UI)
    e.created_by AS organizer_id,
    COALESCE(p.company_name, p.full_name) AS organizer_name,
    p.avatar_url AS organizer_avatar_url,
    ${organizerExtras}
    json_build_object('name', c.name) AS categories
  FROM events e
  LEFT JOIN categories c ON c.id = e.category_id
  LEFT JOIN profiles p ON p.id = e.created_by
`;}

// Events list with basic filters
app.get('/api/events', async (req, res) => {
  const { searchTerm, nation, dateFrom, sortColumn = 'date', sortDirection = 'asc' } = req.query;
  const clauses = [];
  const params = [];
  if (searchTerm && String(searchTerm).trim()) {
    params.push(`%${String(searchTerm).trim()}%`);
    clauses.push(`e.title ILIKE $${params.length}`);
  }
  if (nation && nation !== 'all') {
    params.push(String(nation));
    clauses.push(`e.nation = $${params.length}`);
  }
  if (dateFrom) {
    params.push(String(dateFrom));
    clauses.push(`e.date >= $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const validCols = new Set(['date', 'title', 'nation', 'category']);
  const col = validCols.has(String(sortColumn)) ? String(sortColumn) : 'date';
  const dir = String(sortDirection).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const orderBy = col === 'category' ? `ORDER BY c.name ${dir}` : `ORDER BY e.${col} ${dir}`;
  const sql = `${eventsSelect()} ${where} ${orderBy}`;
  try {
    const { rows } = await pool.query(sql, params);
    // If free mode is enabled, surface cost as 0 to the client
    const out = EVENTS_FREE_MODE ? rows.map(r => ({ ...r, cost: 0 })) : rows;
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/events/:id', async (req, res) => {
  const sql = `${eventsSelect()} WHERE e.id = $1 LIMIT 1`;
  try {
    const { rows } = await pool.query(sql, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    if (EVENTS_FREE_MODE) row.cost = 0;
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/events/slug/:slug', async (req, res) => {
  const sql = `${eventsSelect()} WHERE e.slug = $1 LIMIT 1`;
  try {
    const { rows } = await pool.query(sql, [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    if (EVENTS_FREE_MODE) row.cost = 0;
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// -----------------------------
// Blog endpoints
// -----------------------------
app.get('/api/blog', async (req, res) => {
  // Ensure column exists to avoid runtime errors on fresh DBs
  await ensureBlogLanguageColumn();
  const { searchTerm, published = 'true', sortColumn = 'created_at', sortDirection = 'desc', language } = req.query;
  const params = [];
  const clauses = [];
  if (String(published) === 'true') clauses.push('b.published = true');
  if (searchTerm && String(searchTerm).trim()) {
    params.push(`%${String(searchTerm).trim()}%`);
    clauses.push(`b.title ILIKE $${params.length}`);
  }
  if (language && String(language).trim()) {
    params.push(String(language).trim());
    clauses.push(`b.language = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const validCols = new Set(['created_at','title']);
  const col = validCols.has(String(sortColumn)) ? String(sortColumn) : 'created_at';
  const dir = String(sortDirection).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const orderBy = `ORDER BY b.${col} ${dir}`;
  const sql = `
    SELECT b.*, json_build_object('full_name', p.full_name) AS profiles
    FROM blog_articles b
    LEFT JOIN profiles p ON p.id = b.author_id
    ${where}
    ${orderBy}
  `;
  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/blog/slug/:slug', async (req, res) => {
  await ensureBlogLanguageColumn();
  const sql = `
    SELECT b.*, json_build_object('full_name', p.full_name) AS profiles
    FROM blog_articles b
    LEFT JOIN profiles p ON p.id = b.author_id
    WHERE b.slug = $1 AND b.published = true
    LIMIT 1
  `;
  try {
    const { rows } = await pool.query(sql, [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/blog/:id', async (req, res) => {
  await ensureBlogLanguageColumn();
  const sql = `
    SELECT b.*, json_build_object('full_name', p.full_name) AS profiles
    FROM blog_articles b
    LEFT JOIN profiles p ON p.id = b.author_id
    WHERE b.id = $1
    LIMIT 1
  `;
  try {
    const { rows } = await pool.query(sql, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/blog', requireAuth, requireBloggerOrAdmin, async (req, res) => {
  await ensureBlogLanguageColumn();
  const b = req.body || {};
  try {
    const cols = ['language','title','slug','excerpt','content','cover_image_url','gallery_images','seo_title','seo_description','seo_keywords','hashtags','published','author_id'];
    // Force author_id to current user if not admin
    const authorId = (req.user?.role === 'admin' && b.author_id) ? b.author_id : (req.user?.id || b.author_id);
    const vals = [
      b.language || 'it',
      b.title,
      b.slug || String(b.title || '').toLowerCase().replace(/\s+/g,'-'),
      b.excerpt || null,
      b.content,
      b.cover_image_url || null,
      Array.isArray(b.gallery_images) ? b.gallery_images : null,
      b.seo_title || null,
      b.seo_description || null,
      Array.isArray(b.seo_keywords) ? b.seo_keywords : null,
      Array.isArray(b.hashtags) ? b.hashtags : null,
      Boolean(b.published),
      authorId
    ];
    const placeholders = cols.map((_, i) => `$${i+1}`).join(',');
    const { rows } = await pool.query(`INSERT INTO blog_articles(${cols.join(',')}) VALUES(${placeholders}) RETURNING *`, vals);
    res.status(201).json(rows[0]);
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes('duplicate key')) return res.status(409).json({ error: 'Slug già esistente' });
    res.status(500).json({ error: msg });
  }
});

app.put('/api/blog/:id', requireAuth, requireBloggerOrAdmin, async (req, res) => {
  await ensureBlogLanguageColumn();
  const b = req.body || {};
  try {
    const allowed = ['language','title','slug','excerpt','content','cover_image_url','gallery_images','seo_title','seo_description','seo_keywords','hashtags','published'];
    const fields = Object.keys(b).filter(k => allowed.includes(k));
    if (fields.length === 0) return res.status(400).json({ error: 'no valid fields to update' });
    const sets = fields.map((k,i)=> `${k} = $${i+1}`).join(', ');
    const sql = `UPDATE blog_articles SET ${sets}, updated_at = now() WHERE id = $${fields.length+1} RETURNING *`;
    const { rows } = await pool.query(sql, [...fields.map(k => b[k]), req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.delete('/api/blog/:id', requireAuth, requireBloggerOrAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM blog_articles WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});
// Public instructor/company profile by user id
app.get('/api/instructors/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        id, full_name, company_name, bio, avatar_url, instagram_contact, role,
        brevetto, scadenza_brevetto, assicurazione, scadenza_assicurazione,
        scadenza_certificato_medico, company_address, vat_number
       FROM profiles
       WHERE id = $1 AND role IN ('instructor','company') AND COALESCE(is_active, true) = true
       LIMIT 1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Public instructor/company profile by slug (SEO-friendly)
app.get('/api/instructors/slug/:slug', async (req, res) => {
  if (!HAS_PUBLIC_PROFILE_FIELDS) {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT 
        id, full_name, company_name, bio, avatar_url, instagram_contact, role,
        brevetto, scadenza_brevetto, assicurazione, scadenza_assicurazione,
        scadenza_certificato_medico, company_address, vat_number,
        public_profile_enabled, public_slug, public_show_bio, public_show_instagram, public_show_company_info, public_show_certifications
       FROM profiles
       WHERE lower(public_slug) = lower($1)
         AND role IN ('instructor','company')
         AND COALESCE(is_active, true) = true
         AND COALESCE(public_profile_enabled, false) = true
       LIMIT 1`,
      [req.params.slug]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: categories
app.get('/api/forum/categories', async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, name, description, slug, color, created_at, updated_at, COALESCE(order_index,0) AS order_index FROM forum_categories ORDER BY order_index ASC`);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: topics (optional categoryId, limit, offset)
app.get('/api/forum/topics', async (req, res) => {
  const { categoryId, limit = 20, offset = 0 } = req.query;
  const params = [];
  let where = '';
  if (categoryId) { params.push(categoryId); where = `WHERE t.category_id = $1`; }
  const sql = `
    SELECT t.*, 
      json_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'color', c.color, 'description', c.description, 'created_at', c.created_at, 'updated_at', c.updated_at, 'order_index', COALESCE(c.order_index,0)) AS category
    FROM forum_topics t
    LEFT JOIN forum_categories c ON c.id = t.category_id
    ${where}
    ORDER BY t.is_pinned DESC, t.last_reply_at DESC NULLS LAST, t.created_at DESC
    OFFSET ${Number(offset)} LIMIT ${Number(limit)}
  `;
  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: topic by id
app.get('/api/forum/topics/:id', async (req, res) => {
  const sql = `
    SELECT t.*, 
      json_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'color', c.color, 'description', c.description, 'created_at', c.created_at, 'updated_at', c.updated_at, 'order_index', COALESCE(c.order_index,0)) AS category
    FROM forum_topics t
    LEFT JOIN forum_categories c ON c.id = t.category_id
    WHERE t.id = $1
    LIMIT 1
  `;
  try {
    const { rows } = await pool.query(sql, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: replies by topic
app.get('/api/forum/replies', async (req, res) => {
  const { topicId } = req.query;
  if (!topicId) return res.status(400).json({ error: 'topicId is required' });
  const sql = `SELECT * FROM forum_replies WHERE topic_id = $1 ORDER BY created_at ASC`;
  try {
    const { rows } = await pool.query(sql, [topicId]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: create category (protected)
app.post('/api/forum/categories', requireAuth, async (req, res) => {
  const { name, description = null, slug, color = null } = req.body || {};
  if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO forum_categories(name, description, slug, color) VALUES ($1,$2,$3,$4) RETURNING id, name, description, slug, color, created_at, updated_at, COALESCE(order_index,0) AS order_index',
      [name, description, slug, color]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: update category (protected)
app.put('/api/forum/categories/:id', requireAuth, async (req, res) => {
  const c = req.body || {};
  const fields = Object.keys(c);
  if (fields.length === 0) return res.status(400).json({ error: 'no fields to update' });
  const sets = fields.map((k, i) => `${k} = $${i+1}`).join(', ');
  const sql = `UPDATE forum_categories SET ${sets} WHERE id = $${fields.length+1} RETURNING id, name, description, slug, color, created_at, updated_at, COALESCE(order_index,0) AS order_index`;
  try {
    const { rows } = await pool.query(sql, [...fields.map(k => c[k]), req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: delete category (protected)
app.delete('/api/forum/categories/:id', requireAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM forum_categories WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: reorder categories (protected)
app.post('/api/forum/categories/reorder', requireAuth, async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  try {
    await pool.query('BEGIN');
    for (let i = 0; i < ids.length; i++) {
      await pool.query('UPDATE forum_categories SET order_index = $1 WHERE id = $2', [i, ids[i]]);
    }
    await pool.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Create event
app.post('/api/events', requireAuth, async (req, res) => {
  const e = req.body || {};
  // Minimal validation
  if (!e.title || !e.category_id) return res.status(400).json({ error: 'title and category_id are required' });
  // Default slug if missing
  const slug = e.slug || String(e.title).toLowerCase().replace(/\s+/g, '-');
  const cols = [
    'title','slug','description','date','end_date','location','participants','image_url','category_id','cost','nation','discipline','created_by','level','activity_description','language','about_us','objectives','included_in_activity','not_included_in_activity','notes','schedule_logistics','gallery_images','event_type','activity_details','who_we_are','fixed_appointment','instructors','instructor_certificates','max_participants_per_instructor','schedule_meeting_point','responsibility_waiver_accepted','privacy_accepted'
  ];
  // Columns that are JSON/JSONB in DB; ensure we serialize JS objects/arrays to JSON strings
  const jsonCols = new Set([
    'participants',
    'included_in_activity',
    'not_included_in_activity',
    'gallery_images',
    'activity_details',
    'who_we_are',
    'instructors',
    'instructor_certificates'
  ]);
  const values = cols.map((k) => {
    let v = e[k] ?? null;
    if (k === 'slug') v = slug;
    if (v !== null && jsonCols.has(k)) {
      try { v = JSON.stringify(v); } catch (_) { /* leave as-is */ }
    }
    return v;
  });
  const placeholders = cols.map((_, i) => `$${i+1}`).join(',');
  const sql = `INSERT INTO events(${cols.join(',')}) VALUES(${placeholders}) RETURNING *`;
  try {
    const { rows } = await pool.query(sql, values);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Payments: create checkout session for event
app.post('/api/payments/create-checkout-session', requireAuth, async (req, res) => {
  try {
    // If free mode is ON, prevent starting a paid checkout
    if (EVENTS_FREE_MODE) {
      return res.status(400).json({ error: 'free_mode_enabled' });
    }
    // Enforce user profile requirements before starting payment
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Login required' });
    }
    // Load required profile fields
    const { rows: profRows } = await pool.query(
      `SELECT phone, assicurazione, scadenza_assicurazione, scadenza_certificato_medico
       FROM profiles WHERE id = $1 LIMIT 1`,
      [req.user.id]
    );
    const prof = profRows[0];
    if (!prof) return res.status(404).json({ error: 'Profile not found' });
    const missing = [];
    const today = new Date();
    const isEmpty = (v) => !v || String(v).trim() === '';
    if (isEmpty(prof.phone)) missing.push('phone');
    if (isEmpty(prof.assicurazione)) missing.push('assicurazione');
    const sa = prof.scadenza_assicurazione ? new Date(prof.scadenza_assicurazione) : null;
    const sc = prof.scadenza_certificato_medico ? new Date(prof.scadenza_certificato_medico) : null;
    if (!sa || !(sa instanceof Date) || isNaN(sa.getTime()) || sa < today) missing.push('scadenza_assicurazione');
    if (!sc || !(sc instanceof Date) || isNaN(sc.getTime()) || sc < today) missing.push('scadenza_certificato_medico');
    if (missing.length) {
      return res.status(400).json({ error: 'profile_incomplete', missing });
    }
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    const { eventId, title, amount } = req.body || {};
    if (!eventId || typeof amount !== 'number') return res.status(400).json({ error: 'eventId and amount are required' });

    // Amount in cents
    const unit_amount = Math.round(amount * 100);
    const successUrl = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`) + `/payments/success?eventId=${encodeURIComponent(eventId)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`) + `/events/${encodeURIComponent(req.body.slug || '')}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: title || 'Evento' },
            unit_amount,
          },
          quantity: 1,
        },
      ],
      metadata: { eventId, userId: req.user?.id || '' },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Payments: create checkout session for organizer/sponsor packages
app.post('/api/payments/create-package-checkout', requireAuth, async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    const { kind = 'organizer_package', packageId, packageName, amount, durationMonths } = req.body || {};
    if (!packageId || typeof amount !== 'number') return res.status(400).json({ error: 'packageId and amount are required' });

    const unit_amount = Math.round(amount * 100);
    const base = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
    const successPath = kind === 'organizer_package' ? '/organizer-packages' : '/sponsor-packages';
    const successUrl = `${base}${successPath}?success=true&package=${encodeURIComponent(packageId)}`;
    const cancelUrl = `${base}${successPath}?canceled=true`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: packageName || 'Pacchetto' },
            unit_amount,
          },
          quantity: 1,
        },
      ],
      metadata: { kind, packageId, durationMonths: String(durationMonths || ''), userId: req.user?.id || '' },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// -----------------------------
// User-centric endpoints (participations, wishlist, my events)
// -----------------------------
// My paid participations (from event_payments)
app.get('/api/me/participations', requireAuth, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const sql = `
      SELECT 
        ep.id,
        ep.event_id,
        ep.user_id,
        ep.status,
        ep.paid_at AS registered_at,
        json_build_object(
          'id', e.id,
          'title', e.title,
          'description', e.description,
          'date', e.date,
          'end_date', e.end_date,
          'location', e.location,
          'image_url', e.image_url,
          'cost', e.cost,
          'participants', e.participants,
          'slug', e.slug,
          'created_by', e.created_by,
          'category_id', e.category_id
        ) AS events
      FROM event_payments ep
      LEFT JOIN events e ON e.id = ep.event_id
      WHERE ep.user_id = $1 AND ep.status = 'paid'
      ORDER BY ep.paid_at DESC NULLS LAST
    `;
    const { rows } = await pool.query(sql, [req.user.id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// My wishlist (join with events)
app.get('/api/me/wishlist', requireAuth, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const sql = `
      SELECT 
        w.id,
        w.event_id,
        w.user_id,
        w.created_at,
        json_build_object(
          'id', e.id,
          'title', e.title,
          'description', e.description,
          'date', e.date,
          'end_date', e.end_date,
          'location', e.location,
          'image_url', e.image_url,
          'cost', e.cost,
          'participants', e.participants,
          'slug', e.slug,
          'created_by', e.created_by,
          'category_id', e.category_id
        ) AS events
      FROM event_wishlist w
      LEFT JOIN events e ON e.id = w.event_id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC
    `;
    const { rows } = await pool.query(sql, [req.user.id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Remove item from my wishlist
app.delete('/api/me/wishlist/:id', requireAuth, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { rowCount } = await pool.query('DELETE FROM event_wishlist WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// My events (organizer) or all (admin)
app.get('/api/me/events', requireAuth, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const isAdmin = req.user?.role === 'admin';
  const all = String(req.query.all || 'false').toLowerCase() === 'true';
  try {
    let sql = 'SELECT * FROM events WHERE created_by = $1 ORDER BY created_at DESC';
    let params = [req.user.id];
    if (isAdmin && all) {
      sql = 'SELECT * FROM events ORDER BY created_at DESC';
      params = [];
    }
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// -----------------------------
// i18n endpoints (read-only minimal)
// -----------------------------
app.get('/api/i18n/languages', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT code, name, is_active FROM languages WHERE COALESCE(is_active, true) = true ORDER BY name ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/i18n/translations', async (req, res) => {
  const lang = String(req.query.lang || '').trim();
  if (!lang) return res.status(400).json({ error: 'lang is required' });
  try {
    const { rows } = await pool.query('SELECT key, value FROM translations WHERE language_code = $1', [lang]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/i18n/translations/by-keys', async (req, res) => {
  const lang = String(req.query.lang || '').trim();
  const keys = String(req.query.keys || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!lang) return res.status(400).json({ error: 'lang is required' });
  if (keys.length === 0) return res.status(400).json({ error: 'keys are required' });
  try {
    const { rows } = await pool.query('SELECT key, value FROM translations WHERE language_code = $1 AND key = ANY($2)', [lang, keys]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// -----------------------------
// Email templates endpoints
// -----------------------------
app.get('/api/email-templates', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM email_templates ORDER BY template_type ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/email-templates/:type', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM email_templates WHERE template_type = $1 LIMIT 1', [req.params.type]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.put('/api/email-templates/:type', requireAuth, requireAdmin, async (req, res) => {
  const { subject, html_content, is_active } = req.body || {};
  const fields = [];
  const values = [];
  if (subject !== undefined) { fields.push('subject'); values.push(subject); }
  if (html_content !== undefined) { fields.push('html_content'); values.push(html_content); }
  if (typeof is_active === 'boolean') { fields.push('is_active'); values.push(is_active); }
  if (fields.length === 0) return res.status(400).json({ error: 'no fields to update' });
  const sets = fields.map((k,i)=> `${k} = $${i+1}`).join(', ');
  try {
    const { rows } = await pool.query(`UPDATE email_templates SET ${sets}, updated_at = now() WHERE template_type = $${fields.length+1} RETURNING *`, [...values, req.params.type]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Update event
app.put('/api/events/:id', requireAuth, async (req, res) => {
  const e = req.body || {};
  const fields = Object.keys(e);
  if (fields.length === 0) return res.status(400).json({ error: 'no fields to update' });

  // Colonne JSONB da serializzare in modo sicuro
  const jsonCols = new Set([
    'participants',
    'included_in_activity',
    'not_included_in_activity',
    'gallery_images',
    'activity_details',
    'who_we_are',
    'instructors',
    'instructor_certificates'
  ]);

  const values = fields.map((k) => {
    let v = e[k];
    if (v !== null && v !== undefined && jsonCols.has(k)) {
      try { v = JSON.stringify(v); } catch (_) { /* leave as-is */ }
    }
    return v ?? null;
  });

  const sets = fields.map((k, i) => `${k} = $${i+1}`).join(', ');
  const sql = `UPDATE events SET ${sets} WHERE id = $${fields.length+1} RETURNING *`;
  try {
    const { rows } = await pool.query(sql, [...values, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Delete event
app.delete('/api/events/:id', requireAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Create category
app.post('/api/categories', requireAuth, async (req, res) => {
  const { name, order_index = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query('INSERT INTO categories(name, order_index) VALUES($1,$2) RETURNING *', [name, order_index]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Update category
app.put('/api/categories/:id', requireAuth, async (req, res) => {
  const c = req.body || {};
  const fields = Object.keys(c);
  if (fields.length === 0) return res.status(400).json({ error: 'no fields to update' });
  const sets = fields.map((k, i) => `${k} = $${i+1}`).join(', ');
  const sql = `UPDATE categories SET ${sets} WHERE id = $${fields.length+1} RETURNING *`;
  try {
    const { rows } = await pool.query(sql, [...fields.map(k => c[k]), req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Delete category
app.delete('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Reorder categories
app.post('/api/categories/reorder', requireAuth, async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  try {
    await pool.query('BEGIN');
    for (let i = 0; i < ids.length; i++) {
      await pool.query('UPDATE categories SET order_index = $1 WHERE id = $2', [i, ids[i]]);
    }
    await pool.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Forum: create topic (protected)
app.post('/api/forum/topics', requireAuth, async (req, res) => {
  const { title, content, category_id, author_id } = req.body || {};
  if (!title || !content || !category_id || !author_id) {
    return res.status(400).json({ error: 'title, content, category_id, author_id are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO forum_topics(title, content, category_id, author_id, is_pinned, is_locked, views_count, replies_count)
       VALUES ($1,$2,$3,$4,false,false,0,0)
       RETURNING *`,
      [title, content, category_id, author_id]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: update topic (content and/or status) (protected)
app.put('/api/forum/topics/:id', requireAuth, async (req, res) => {
  const t = req.body || {};
  const fields = Object.keys(t);
  if (fields.length === 0) return res.status(400).json({ error: 'no fields to update' });
  const sets = fields.map((k, i) => `${k} = $${i+1}`).join(', ');
  const sql = `UPDATE forum_topics SET ${sets}, updated_at = now() WHERE id = $${fields.length+1} RETURNING *`;
  try {
    const { rows } = await pool.query(sql, [...fields.map(k => t[k]), req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: delete topic (protected)
app.delete('/api/forum/topics/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('BEGIN');
    await pool.query('DELETE FROM forum_replies WHERE topic_id = $1', [req.params.id]);
    const { rowCount } = await pool.query('DELETE FROM forum_topics WHERE id = $1', [req.params.id]);
    await pool.query('COMMIT');
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: create reply (protected)
app.post('/api/forum/replies', requireAuth, async (req, res) => {
  const { content, topic_id, author_id } = req.body || {};
  if (!content || !topic_id || !author_id) return res.status(400).json({ error: 'content, topic_id, author_id are required' });
  try {
    await pool.query('BEGIN');
    const { rows } = await pool.query(
      'INSERT INTO forum_replies(content, topic_id, author_id) VALUES ($1,$2,$3) RETURNING *',
      [content, topic_id, author_id]
    );
    await pool.query(
      'UPDATE forum_topics SET replies_count = COALESCE(replies_count,0)+1, last_reply_at = now(), last_reply_by = $1 WHERE id = $2',
      [author_id, topic_id]
    );
    await pool.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: update reply (protected)
app.put('/api/forum/replies/:id', requireAuth, async (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content is required' });
  try {
    const { rows } = await pool.query('UPDATE forum_replies SET content = $1, updated_at = now() WHERE id = $2 RETURNING *', [content, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: delete reply (protected)
app.delete('/api/forum/replies/:id', requireAuth, async (req, res) => {
  try {
    // We need topic_id and author_id to update counters; fetch first
    const { rows: r } = await pool.query('SELECT topic_id FROM forum_replies WHERE id = $1', [req.params.id]);
    if (!r[0]) return res.status(404).json({ error: 'Not found' });
    const topicId = r[0].topic_id;
    await pool.query('BEGIN');
    await pool.query('DELETE FROM forum_replies WHERE id = $1', [req.params.id]);
    // decrement count and recompute last_reply
    await pool.query('UPDATE forum_topics SET replies_count = GREATEST(COALESCE(replies_count,1)-1,0) WHERE id = $1', [topicId]);
    const { rows: last } = await pool.query('SELECT author_id, created_at FROM forum_replies WHERE topic_id = $1 ORDER BY created_at DESC LIMIT 1', [topicId]);
    if (last[0]) {
      await pool.query('UPDATE forum_topics SET last_reply_at = $1, last_reply_by = $2 WHERE id = $3', [last[0].created_at, last[0].author_id, topicId]);
    } else {
      await pool.query('UPDATE forum_topics SET last_reply_at = NULL, last_reply_by = NULL WHERE id = $1', [topicId]);
    }
    await pool.query('COMMIT');
    res.status(204).end();
  } catch (e) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Forum: increment views (unprotected)
app.post('/api/forum/topics/:id/views', async (req, res) => {
  try {
    await pool.query('UPDATE forum_topics SET views_count = COALESCE(views_count,0)+1 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// -----------------------------
// Admin: Users management
// -----------------------------
app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id,
        email,
        NULL::timestamp AS created_at,
        full_name,
        role,
        is_active,
        avatar_url,
        company_name,
        vat_number,
        company_address
      FROM profiles
      ORDER BY full_name ASC NULLS LAST, email ASC
    `);
    const out = rows.map(r => ({
      id: r.id,
      email: r.email,
      created_at: r.created_at,
      email_confirmed_at: null,
      last_sign_in_at: null,
      profile: {
        full_name: r.full_name,
        role: r.role,
        is_active: r.is_active,
        avatar_url: r.avatar_url,
        company_name: r.company_name,
        vat_number: r.vat_number,
        company_address: r.company_address,
      }
    }));
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.put('/api/admin/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  const { role } = req.body || {};
  if (!role) return res.status(400).json({ error: 'role is required' });
  try {
    const { rows } = await pool.query('UPDATE profiles SET role = $1 WHERE id = $2 RETURNING id, role', [role, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.put('/api/admin/users/:id/active', requireAuth, requireAdmin, async (req, res) => {
  const { is_active } = req.body || {};
  if (typeof is_active !== 'boolean') return res.status(400).json({ error: 'is_active boolean required' });
  try {
    const { rows } = await pool.query('UPDATE profiles SET is_active = $1 WHERE id = $2 RETURNING id, is_active', [is_active, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.put('/api/admin/users/:id/profile', requireAuth, requireAdmin, async (req, res) => {
  const allowed = ['full_name','avatar_url','company_name','vat_number','company_address','role','is_active'];
  const p = req.body || {};
  const fields = Object.keys(p).filter(k => allowed.includes(k));
  if (fields.length === 0) return res.status(400).json({ error: 'no valid fields to update' });
  const sets = fields.map((k,i)=> `${k} = $${i+1}`).join(', ');
  const sql = `UPDATE profiles SET ${sets} WHERE id = $${fields.length+1} RETURNING *`;
  try {
    const { rows } = await pool.query(sql, [...fields.map(k => p[k]), req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM profiles WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// -----------------------------
// Admin: User packages management
// -----------------------------
app.get('/api/admin/user-packages', requireAuth, requireAdmin, async (_req, res) => {
  if (!HAS_USER_PACKAGES) return res.json([]);
  try {
    const { rows } = await pool.query(`
      SELECT up.*, json_build_object('full_name', p.full_name) AS user_profile
      FROM user_packages up
      LEFT JOIN profiles p ON p.id = up.user_id
      ORDER BY up.created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/admin/user-packages/assign', requireAuth, requireAdmin, async (req, res) => {
  if (!HAS_USER_PACKAGES) return res.status(503).json({ error: 'user_packages not migrated yet' });
  const { targetUserId, packageType, packageId, packageName, durationMonths } = req.body || {};
  if (!targetUserId || !packageType || !packageId || !packageName) {
    return res.status(400).json({ error: 'targetUserId, packageType, packageId, packageName are required' });
  }
  try {
    let expiresAt = null;
    if (durationMonths && Number(durationMonths) > 0) {
      expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + Number(durationMonths));
    }
    const { rows } = await pool.query(`
      INSERT INTO user_packages(user_id, package_type, package_id, package_name, status, starts_at, expires_at)
      VALUES ($1, $2, $3, $4, 'active', now(), $5)
      ON CONFLICT (user_id, package_type)
      DO UPDATE SET package_id = EXCLUDED.package_id,
                    package_name = EXCLUDED.package_name,
                    status = 'active',
                    starts_at = now(),
                    expires_at = EXCLUDED.expires_at,
                    updated_at = now()
      RETURNING *
    `, [targetUserId, packageType, packageId, packageName, expiresAt]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/admin/user-packages/:id/cancel', requireAuth, requireAdmin, async (req, res) => {
  if (!HAS_USER_PACKAGES) return res.status(503).json({ error: 'user_packages not migrated yet' });
  try {
    const { rows } = await pool.query("UPDATE user_packages SET status = 'cancelled', updated_at = now() WHERE id = $1 RETURNING *", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// -----------------------------
// Payments & Participants helpers
// -----------------------------
// Admin-only: trigger password reset by userId (used by admin panel)
app.post('/api/auth/request-password-reset-by-id', requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    const { rows } = await pool.query('SELECT id, email, full_name FROM profiles WHERE id = $1 LIMIT 1', [userId]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const resetToken = jwt.sign({ id: user.id, email: user.email, t: 'pwd' }, JWT_SECRET, { expiresIn: '30m' });
    await pool.query(
      `INSERT INTO password_resets(user_id, token_hash, expires_at)
       VALUES ($1, crypt($2, gen_salt('bf')), now() + interval '30 minutes')
       ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at`,
      [user.id, resetToken]
    );
    const base = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
    const link = `${base}/password-reset?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(user.email)}&type=recovery`;
    await sendEmail({
      to: user.email,
      subject: 'Recupero password WeApnea',
      html: `<p>Ciao ${user.full_name || ''},</p><p>clicca <a href="${link}">qui</a> per reimpostare la tua password. Il link scade tra 30 minuti.</p>`
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Event participants (paid)
app.get('/api/events/:id/participants', requireAuth, async (req, res) => {
  const eventId = req.params.id;
  try {
    const sql = `
      SELECT ep.id, ep.user_id, ep.amount, ep.paid_at,
             p.full_name, p.avatar_url, p.company_name
      FROM event_payments ep
      LEFT JOIN profiles p ON p.id = ep.user_id
      WHERE ep.event_id = $1 AND ep.status = 'paid'
      ORDER BY ep.paid_at DESC NULLS LAST
    `;
    const { rows } = await pool.query(sql, [eventId]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Organizer dashboard stats
app.get('/api/payments/organizer-stats', requireAuth, async (req, res) => {
  const organizerId = req.query.organizerId || req.user?.id;
  if (!organizerId) return res.status(400).json({ error: 'organizerId is required' });
  try {
    // Fetch organizer's events
    const { rows: events } = await pool.query('SELECT id, title, cost FROM events WHERE created_by = $1', [organizerId]);
    const eventIds = events.map(e => e.id);
    if (eventIds.length === 0) {
      return res.json({
        totalEvents: 0,
        totalPaidParticipants: 0,
        totalRevenue: 0,
        paymentsByEvent: []
      });
    }
    // Payments for these events
    const { rows: payments } = await pool.query(
      `SELECT event_id, amount FROM event_payments WHERE status = 'paid' AND event_id = ANY($1::uuid[])`,
      [eventIds]
    );
    const byEvent = new Map();
    for (const ev of events) {
      byEvent.set(ev.id, { eventId: ev.id, totalPaidParticipants: 0, totalRevenue: 0 });
    }
    for (const p of payments) {
      const acc = byEvent.get(p.event_id);
      if (acc) {
        acc.totalPaidParticipants += 1;
        acc.totalRevenue += Number(p.amount || 0);
      }
    }
    const totalPaidParticipants = payments.length;
    const totalRevenue = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    res.json({
      totalEvents: events.length,
      totalPaidParticipants,
      totalRevenue,
      paymentsByEvent: Array.from(byEvent.values())
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Register to an event for free (used when EVENTS_FREE_MODE=true or event cost is 0)
app.post('/api/events/:id/register-free', requireAuth, async (req, res) => {
  const eventId = req.params.id;
  try {
    // Ensure event exists
    const { rows: evRows } = await pool.query('SELECT id, title, cost FROM events WHERE id = $1 LIMIT 1', [eventId]);
    const ev = evRows[0];
    if (!ev) return res.status(404).json({ error: 'Event not found' });

    // If global free mode is off, allow only when event cost is null/0
    if (!EVENTS_FREE_MODE) {
      const cost = Number(ev.cost || 0);
      if (cost > 0) return res.status(400).json({ error: 'Event is not free' });
    }

    // Avoid duplicate registrations
    const { rows: existing } = await pool.query(
      `SELECT id FROM event_payments WHERE event_id = $1 AND user_id = $2 AND status = 'paid' LIMIT 1`,
      [eventId, req.user.id]
    );
    if (existing[0]) {
      return res.json({ ok: true, alreadyRegistered: true });
    }

    // Insert a zero-amount paid record to reuse existing participants logic
    const { rows } = await pool.query(
      `INSERT INTO event_payments(event_id, user_id, amount, status, paid_at)
       VALUES ($1, $2, 0, 'paid', now())
       RETURNING id`,
      [eventId, req.user.id]
    );
    res.status(201).json({ ok: true, id: rows[0]?.id || null });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.listen(PORT, () => {
  const base = process.env.API_PUBLIC_BASE_URL || `http://0.0.0.0:${PORT}`;
  console.log(`API listening on ${base}`);
});
