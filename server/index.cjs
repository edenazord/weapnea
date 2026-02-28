// Minimal API server to read directly from Postgres and expose REST endpoints
// Version: 2.0.0 - Added chat system endpoints
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
// URL pubblico di produzione usato come fallback per le email
const PRODUCTION_BASE_URL = 'https://www.weapnea.com';
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
  await pool.query("ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS personal_best jsonb");
  await ensureMedicalCertificateTypeColumnAtRuntime();
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
    // Garantisci SEMPRE le colonne del profilo pubblico: l'ALTER è idempotente
  await ensurePublicProfileColumnsAtRuntime();
  // Safeguard: ensure events.fixed_appointment_text exists even if migrations didn't run yet
  await ensureEventsFixedAppointmentTextColumn();
  // Ensure email verification column exists
  await ensureEmailVerificationColumn();
  // Ensure blog tags tables exist
  await ensureBlogTagsTables();
    // Ensure new tables exist even if migration files were not found on deploy
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        blog_id uuid REFERENCES public.blog_articles(id) ON DELETE CASCADE,
        event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
        author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
        body text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_comment_target CHECK (
          (blog_id IS NOT NULL AND event_id IS NULL) OR
          (blog_id IS NULL AND event_id IS NOT NULL)
        )
      );
      CREATE INDEX IF NOT EXISTS idx_comments_blog_id ON public.comments(blog_id) WHERE blog_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_comments_event_id ON public.comments(event_id) WHERE event_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.comments(author_id);
      CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id) WHERE parent_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at DESC);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.event_media (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
        uploader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        url text NOT NULL,
        media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
        caption text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_event_media_event_id ON public.event_media(event_id);
      CREATE INDEX IF NOT EXISTS idx_event_media_uploader_id ON public.event_media(uploader_id);
      CREATE INDEX IF NOT EXISTS idx_event_media_created_at ON public.event_media(created_at DESC);
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS public.profiles
        ADD COLUMN IF NOT EXISTS newsletter_new_events boolean NOT NULL DEFAULT false;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.external_participants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
        added_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        full_name text NOT NULL,
        email text,
        phone text,
        notes text,
        invited_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_external_participants_event_id ON public.external_participants(event_id);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.event_feedback_emails (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        sent_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(event_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_event_feedback_emails_event_id ON public.event_feedback_emails(event_id);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.seo_settings (
        path text PRIMARY KEY,
        title text,
        description text,
        og_image text,
        translations jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE public.seo_settings ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.site_config (
        id int PRIMARY KEY DEFAULT 1,
        gtm_id text,
        ga4_id text,
        gsc_verification text,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT site_config_single_row CHECK (id = 1)
      );
      INSERT INTO public.site_config (id) VALUES (1) ON CONFLICT DO NOTHING;
      UPDATE public.site_config SET gsc_verification = 'FWVlrMAM04NtABc9Z8NvhoN98Op3p2IkUs0RKXeVQaM'
        WHERE id = 1 AND gsc_verification IS NULL;
    `);
    console.log('[startup] ensured comments, event_media, external_participants, event_feedback_emails, seo_settings, site_config tables');
    await detectSchema();
    // Seed email templates if table is empty (idempotente)
    try {
      const { rows: cnt } = await pool.query('SELECT COUNT(*)::int AS n FROM public.email_templates');
      const n = Number(cnt[0]?.n || 0);
      if (n === 0) {
        const entries = Object.entries(DEFAULT_TEMPLATES);
        for (const [type, tpl] of entries) {
          await upsertEmailTemplate(type, tpl.subject, tpl.html);
        }
        console.log('[startup] seeded default email templates:', entries.length);
      }
    } catch (e) {
      console.warn('[startup] email templates seed skipped:', e?.message || e);
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
// Express 5 non accetta '*' come path: usa una RegExp per catturare tutte le OPTIONS
app.options(/.*/, cors({ origin: true, credentials: true }));
// serve static files from public (to expose uploaded images)
app.use('/public', express.static(path.join(__dirname, '..', 'public')));
// Static mount per /public/uploads anche se UPLOADS_DIR è esterno alla cartella public
const DEFAULT_UPLOADS = path.join(__dirname, '..', 'public', 'uploads');
const UPLOADS_DIR = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : DEFAULT_UPLOADS;
try { app.use('/public/uploads', express.static(UPLOADS_DIR)); } catch {}

// If frontend links mistakenly point to the API host (e.g. PUBLIC_BASE_URL not set),
// provide a redirect for SPA routes to the public site to avoid 404s like "Cannot GET /password-reset"
app.get(['/password-reset'], (req, res) => {
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) return res.status(404).send('Not Found');
  const target = base.replace(/\/$/, '') + req.originalUrl;
  res.redirect(302, target);
});

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
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } }); // 15 MB

// Multer error handling wrapper (file too large, unexpected field, etc.)
function handleMulterErrors(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File troppo grande. Massimo 15 MB.' });
        }
        console.error('[multer] upload error:', err?.message || err);
        return res.status(400).json({ error: `Upload error: ${err?.message || 'unknown'}` });
      }
      next();
    });
  };
}

// Simple token-based auth for mutation endpoints
const API_TOKEN = process.env.API_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Feature flags detected at runtime
let HAS_PERSONAL_BEST = false;
let HAS_USER_PACKAGES = false;
let HAS_PUBLIC_PROFILE_FIELDS = false;
let HAS_ORGANIZER_REQUEST = false;
let HAS_OTHER_CERTIFICATIONS = false;

async function ensurePersonalBestColumnAtRuntime() {
  try {
    await pool.query("ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS personal_best jsonb");
    HAS_PERSONAL_BEST = true;
  } catch (e) {
    console.warn('[personal_best] ensure column failed:', e?.message || e);
  }
}

async function ensureOtherCertificationsColumnAtRuntime() {
  try {
    await pool.query("ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS other_certifications jsonb");
    HAS_OTHER_CERTIFICATIONS = true;
  } catch (e) {
    console.warn('[other_certifications] ensure column failed:', e?.message || e);
  }
}
// Ensure column for medical certificate type (agonistico/non_agonistico)
async function ensureMedicalCertificateTypeColumnAtRuntime() {
  try {
    await pool.query(`
      ALTER TABLE IF EXISTS public.profiles
        ADD COLUMN IF NOT EXISTS certificato_medico_tipo text
    `);
    // Optional constraint to allow only specific values when not null
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'chk_profiles_certificato_medico_tipo_values'
            AND conrelid = 'public.profiles'::regclass
        ) THEN
          EXECUTE 'ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_certificato_medico_tipo_values CHECK (certificato_medico_tipo IS NULL OR certificato_medico_tipo IN (''agonistico'',''non_agonistico''))';
        END IF;
      END$$;
    `);
  } catch (e) {
    console.warn('[profiles] ensure certificato_medico_tipo column failed:', e?.message || e);
  }
}
async function ensurePublicProfileColumnsAtRuntime() {
  try {
    await pool.query(`
      ALTER TABLE IF EXISTS public.profiles
        ADD COLUMN IF NOT EXISTS public_profile_enabled boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS public_slug text,
        ADD COLUMN IF NOT EXISTS public_show_bio boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS public_show_instagram boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS public_show_company_info boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS public_show_certifications boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS public_show_events boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS public_show_records boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS public_show_personal boolean DEFAULT true;
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
async function ensureEventsFixedAppointmentTextColumn() {
  try {
    await pool.query("ALTER TABLE IF EXISTS public.events ADD COLUMN IF NOT EXISTS fixed_appointment_text text");
    await pool.query("ALTER TABLE IF EXISTS public.events ADD COLUMN IF NOT EXISTS pdf_url text");
    await pool.query("ALTER TABLE IF EXISTS public.events ADD COLUMN IF NOT EXISTS whatsapp_group_url text");
  } catch (e) {
    console.warn('[events] ensure columns failed:', e?.message || e);
  }
}
async function ensureEmailVerificationColumn() {
  try {
    await pool.query("ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS email_verification_token text");
  } catch (e) {
    console.warn('[profiles] ensure email_verification_token column failed:', e?.message || e);
  }
}
async function ensureBlogTagsTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.blog_tags (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        language text NOT NULL DEFAULT 'it',
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(name, language)
      );
      CREATE TABLE IF NOT EXISTS public.blog_article_tags (
        article_id uuid NOT NULL REFERENCES public.blog_articles(id) ON DELETE CASCADE,
        tag_id uuid NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (article_id, tag_id)
      );
      CREATE INDEX IF NOT EXISTS idx_blog_tags_language ON public.blog_tags(language);
      CREATE INDEX IF NOT EXISTS idx_blog_article_tags_article ON public.blog_article_tags(article_id);
      CREATE INDEX IF NOT EXISTS idx_blog_article_tags_tag ON public.blog_article_tags(tag_id);
    `);
  } catch (e) {
    console.warn('[blog_tags] ensure tables failed:', e?.message || e);
  }
}
async function ensureOrganizerRequestColumnsAtRuntime() {
  try {
    await pool.query(`
      ALTER TABLE IF EXISTS public.profiles
        ADD COLUMN IF NOT EXISTS organizer_upgrade_requested_at timestamptz,
        ADD COLUMN IF NOT EXISTS organizer_upgrade_note text
    `);
    HAS_ORGANIZER_REQUEST = true;
  } catch (e) {
    console.warn('[organizer_request] ensure columns failed:', e?.message || e);
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
    
    // Check other_certifications
    const qoc = `SELECT 1 FROM information_schema.columns 
               WHERE table_schema='public' AND table_name='profiles' AND column_name='other_certifications'`;
    const { rowCount: rcOc } = await pool.query(qoc);
    HAS_OTHER_CERTIFICATIONS = rcOc > 0;
    if (!HAS_OTHER_CERTIFICATIONS) console.warn('[startup] profiles.other_certifications NOT present');
    
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

    const r4 = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='organizer_upgrade_requested_at'`);
    HAS_ORGANIZER_REQUEST = r4.rowCount > 0;
    if (!HAS_ORGANIZER_REQUEST) console.warn('[startup] profiles.organizer_upgrade_requested_at NOT present');
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
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'WeApnea <noreply@send.weapnea.com>';
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const APP_NAME = process.env.APP_NAME || 'WeApnea';
// In-memory log for email attempts (last 50)
const EMAIL_LOG_MAX = 50;
const emailLog = [];

// --- App settings helpers ---
async function ensureAppSettingsTable() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS public.app_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  } catch (e) {
    console.warn('[settings] ensure table failed:', e?.message || e);
    throw e;
  }
}

async function getSettingValue(key, defaultValue = null) {
  try {
    try { await ensureAppSettingsTable(); } catch {}
    const { rows } = await pool.query('SELECT value FROM public.app_settings WHERE key = $1', [key]);
    if (rows[0] && rows[0].value !== undefined && rows[0].value !== null) return rows[0].value;
    return defaultValue;
  } catch (e) {
    const msg = String(e?.message || e).toLowerCase();
    if (msg.includes('relation') && msg.includes('app_settings')) {
      try {
        await ensureAppSettingsTable();
        const { rows } = await pool.query('SELECT value FROM public.app_settings WHERE key = $1', [key]);
        if (rows[0] && rows[0].value !== undefined && rows[0].value !== null) return rows[0].value;
      } catch (e2) {
        console.warn('[settings] get retry failed:', key, e2?.message || e2);
      }
      return defaultValue;
    }
    console.warn('[settings] get failed:', key, e?.message || e);
    return defaultValue;
  }
}

async function setSettingValue(key, value) {
  try {
    try { await ensureAppSettingsTable(); } catch {}
    await pool.query(
      `INSERT INTO public.app_settings(key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value]
    );
    return { ok: true };
  } catch (e) {
    const msg = String(e?.message || e).toLowerCase();
    if (msg.includes('relation') && msg.includes('app_settings')) {
      try {
        await ensureAppSettingsTable();
        await pool.query(
          `INSERT INTO public.app_settings(key, value, updated_at)
           VALUES ($1, $2, now())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [key, value]
        );
        return { ok: true };
      } catch (e2) {
        console.warn('[settings] set retry failed:', key, e2?.message || e2);
        throw e2;
      }
    }
    console.warn('[settings] set failed:', key, e?.message || e);
    throw e;
  }
}

// --- Fallback public profile storage via app_settings ---
const PP_USER_KEY = (userId) => `public_profile:${userId}`;
const PP_SLUG_KEY = (slugLower) => `public_slug:${slugLower}`;
const PP_SLUG_ALIAS_KEY = (slugLower) => `public_slug_alias:${slugLower}`;
const RESERVED_SLUGS = new Set((process.env.RESERVED_SLUGS || 'admin,login,register,signup,signin,api,static,public,assets,images,js,css,events,event,instructor,instructors,blog,forum,privacy,terms,sitemap,robots,category,categories,profile,profiles,user,users,me,account').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));

async function getPublicProfileSettings(userId) {
  const val = await getSettingValue(PP_USER_KEY(userId), null);
  return (val && typeof val === 'object') ? val : null;
}

// --- Email templates helpers (JSON-based multilingual) ---
const LOCALES_PATH = path.join(__dirname, '..', 'public', 'locales', 'lang');

// Helper: get email template from locale JSON file
async function getEmailTemplateFromLocale(type, lang = 'it') {
  try {
    const filePath = path.join(LOCALES_PATH, `${lang}.json`);
    const content = await fsp.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data?.emails?.[type] || null;
  } catch (e) {
    console.warn(`[email] Failed to read template ${type} for lang ${lang}:`, e?.message || e);
    // Fallback to Italian
    if (lang !== 'it') {
      return getEmailTemplateFromLocale(type, 'it');
    }
    return null;
  }
}

function simpleRender(template, vars = {}) {
  if (!template) return '';
  return String(template).replace(/{{\s*([a-zA-Z0-9_\.]+)\s*}}/g, (_m, key) => {
    const v = vars && Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : '';
    return v == null ? '' : String(v);
  });
}

// Branded base template (inline-friendly styles)
const BASE_EMAIL_STYLE = `
  body{margin:0;background:#f4f5f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827}
  .container{max-width:600px;margin:0 auto;padding:24px}
  .card{background:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden}
  .header{background:#0f172a;padding:20px;text-align:center}
  .brand{color:#ffffff;font-size:22px;line-height:24px;font-weight:700;letter-spacing:0.3px;text-decoration:none}
  .content{padding:24px;font-size:15px;line-height:1.6}
  .h1{font-size:20px;margin:0 0 12px 0;color:#0f172a}
  .btn{display:inline-block;background:#2563eb;color:#ffffff !important;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600}
  .muted{color:#6b7280;font-size:13px}
  .divider{height:1px;background:#e5e7eb;margin:16px 0}
  .footer{padding:16px;text-align:center}
`;

// Build branded HTML email from JSON template data
function processConditionals(text, vars) {
  return String(text || '').replace(/{{#if\s+([a-zA-Z0-9_.]+)\s*}}([\s\S]*?){{\s*\/if\s*}}/g, (_m, key, inner) => {
    const v = vars && Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : undefined;
    if (v === undefined || v === null) return '';
    if (typeof v === 'string' && !v.trim()) return '';
    return inner;
  });
}

function buildBrandedEmail(tpl, vars, ctaText = null, ctaUrl = null) {
  const publicBase = vars.public_base || process.env.PUBLIC_BASE_URL || 'https://www.weapnea.com';
  const appName = vars.app_name || APP_NAME;
  
  // Convert body text with \n to HTML paragraphs, processing conditionals first
  const bodyHtml = processConditionals(tpl.body || '', vars)
    .split('\n')
    .filter(line => line.trim())
    .map(line => `<p>${simpleRender(line, vars)}</p>`)
    .join('\n');
  
  const greeting = tpl.greeting ? `<p>${simpleRender(tpl.greeting, vars)}</p>` : '';
  const closing = tpl.closing ? `<p>${simpleRender(tpl.closing, vars)}</p>` : '';
  const signature = tpl.signature ? `<p><strong>${simpleRender(tpl.signature, vars).replace(/\n/g, '<br/>')}</strong></p>` : '';
  const ignoreNotice = tpl.ignore_notice ? `<p class="muted">${simpleRender(tpl.ignore_notice, vars)}</p>` : '';
  
  const ctaButton = ctaText && ctaUrl 
    ? `<p style="margin:20px 0 8px 0;"><a class="btn" href="${simpleRender(ctaUrl, vars)}" target="_blank" rel="noopener noreferrer">${simpleRender(ctaText, vars)}</a></p>` 
    : '';

  // WhatsApp group button (shown when whatsapp_group_url is provided)
  const whatsappButton = vars.whatsapp_group_url
    ? `<p style="margin-top:16px;"><a href="${vars.whatsapp_group_url}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 24px;background-color:#25D366;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">📱 Gruppo WhatsApp evento</a></p>`
    : '';

  return `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${BASE_EMAIL_STYLE}</style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <div class="header">
          <a class="brand" href="${publicBase}" target="_blank" rel="noopener noreferrer">${appName}</a>
        </div>
        <div class="content">
          ${greeting}
          ${bodyHtml}
          ${whatsappButton}
          ${ctaButton}
          ${ignoreNotice}
          <div class="divider"></div>
          ${closing}
          ${signature}
        </div>
      </div>
    </div>
  </body>
</html>`;
}

// Render email with template from JSON locale files (multilingual)
async function renderEmailWithTemplate(type, vars, fallbackSubject, fallbackHtml, lang = 'it') {
  const tpl = await getEmailTemplateFromLocale(type, lang);
  
  if (tpl) {
    const subject = simpleRender(tpl.subject || fallbackSubject, vars);
    
    // Determine CTA button based on template type
    let ctaText = null;
    let ctaUrl = null;
    switch (type) {
      case 'welcome':
        ctaText = 'Apri WeApnea';
        ctaUrl = vars.public_base || process.env.PUBLIC_BASE_URL || 'https://www.weapnea.com';
        break;
      case 'password_reset':
        ctaText = tpl.link_label || 'Reset Password';
        ctaUrl = vars.reset_link;
        break;
      case 'event_registration_user':
        ctaText = 'Contattaci';
        ctaUrl = tpl.contact_link || 'https://www.weapnea.com/contattaci';
        break;
      case 'event_registration_organizer':
        ctaText = 'Apri Area Personale';
        ctaUrl = (vars.public_base || process.env.PUBLIC_BASE_URL || 'https://www.weapnea.com') + '/profile';
        break;
      case 'event_invite':
        ctaText = tpl.link_label || 'Vai all\'evento';
        ctaUrl = vars.event_url || (vars.public_base || process.env.PUBLIC_BASE_URL || 'https://www.weapnea.com');
        break;
      case 'event_invite_external':
        ctaText = tpl.link_label || 'Vai all\'evento';
        ctaUrl = vars.event_url || (vars.public_base || process.env.PUBLIC_BASE_URL || 'https://www.weapnea.com');
        break;
    }
    
    const html = buildBrandedEmail(tpl, vars, ctaText, ctaUrl);
    return { subject, html };
  }
  
  // Fallback to old hardcoded templates if JSON not found
  const subject = simpleRender(fallbackSubject, vars);
  const raw = simpleRender(fallbackHtml, vars);
  const html = String(raw || '').replace(/{{#if\s+([a-zA-Z0-9_\.]+)\s*}}([\s\S]*?){{\/if}}/g, (_m, key, inner) => {
    const v = vars && Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : undefined;
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v.trim() ? inner : '';
    return v ? inner : '';
  });
  return { subject, html };
}

// Old BASE_EMAIL_TEMPLATE kept for backwards compatibility with fallback
const BASE_EMAIL_TEMPLATE = (
  title, bodyHtml, ctaText = null, ctaUrl = null, footerHtml = `Questa è una comunicazione automatica di {{app_name}}.`
) => `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${BASE_EMAIL_STYLE}</style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <div class="header">
          <a class="brand" href="{{public_base}}" target="_blank" rel="noopener noreferrer">{{app_name}}</a>
        </div>
        <div class="content">
          <h1 class="h1">${title}</h1>
          ${bodyHtml}
          ${ctaText && ctaUrl ? `<p style="margin:20px 0 8px 0;"><a class=\"btn\" href=\"${ctaUrl}\" target=\"_blank\" rel=\"noopener noreferrer\">${ctaText}</a></p>` : ''}
          <div class="divider"></div>
          <p class="muted">${footerHtml}</p>
        </div>
      </div>
    </div>
  </body>
</html>`;

const DEFAULT_TEMPLATES = {
  welcome: {
    subject: 'Benvenuto su {{app_name}}',
    html: BASE_EMAIL_TEMPLATE(
      'Benvenuto!',
      `<p>Ciao {{full_name}},</p>
       <p>il tuo account ({{email}}) è stato creato con successo su {{app_name}}.</p>
       <p>Inizia subito ad esplorare eventi, allenamenti e molto altro.</p>`,
      'Apri {{app_name}}', '{{public_base}}'
    )
  },
  password_reset: {
    subject: 'Recupero password {{app_name}}',
    html: BASE_EMAIL_TEMPLATE(
      'Reimposta la tua password',
      `<p>Ciao {{full_name}},</p>
       <p>abbiamo ricevuto una richiesta di reimpostazione password per il tuo account ({{email}}).</p>
       <p>Se non l'hai richiesta tu, ignora pure questa email.</p>`,
      'Reimposta password', '{{reset_link}}'
    )
  },
  event_registration_user: {
    subject: 'Iscrizione confermata: {{event_title}}',
    html: BASE_EMAIL_TEMPLATE(
      'Iscrizione confermata',
      `<p>Ciao {{full_name}},</p>
       <p>Ti confermiamo l'iscrizione all'evento <strong>{{event_title}}</strong> che hai scelto su {{app_name}}.</p>
       {{#if event_dates}}<p><strong>Date:</strong> {{event_dates}}</p>{{/if}}
       <p>Resta in contatto con l'organizzatore utilizzando i contatti che compaiono sul suo profilo (<a href="{{organizer_profile_url}}">CLICCA QUI</a>).</p>
       <p>Per ogni tipo di segnalazione puoi contattare il Team {{app_name}}.</p>`,
      'Contattaci', '{{contact_url}}'
    )
  },
  event_registration_organizer: {
    subject: "Nuova iscrizione all'evento: {{event_title}}",
    html: BASE_EMAIL_TEMPLATE(
      'Nuova iscrizione',
      `<p>Ciao {{organizer_name}},</p>
       <p>{{participant_name}} si è iscritto all'evento <strong>{{event_title}}</strong>.</p>
       {{#if event_dates}}<p><strong>Date:</strong> {{event_dates}}</p>{{/if}}`,
      'Apri evento', '{{event_url}}'
    )
  },
  organizer_upgrade_request_admin: {
    subject: 'Richiesta upgrade organizzatore: {{requester_email}}',
    html: BASE_EMAIL_TEMPLATE(
      'Nuova richiesta upgrade organizzatore',
      `<p>Ciao {{admin_name}},</p>
       <p>L'utente <strong>{{requester_name}}</strong> ({{requester_email}}) ha richiesto l'upgrade a organizzatore.</p>
       <p>Puoi gestire il ruolo dalla dashboard amministratore.</p>`,
      'Apri gestione utenti', '{{admin_url}}'
    )
  },
  event_feedback: {
    subject: 'Com\'è andato "{{event_title}}"?',
    html: BASE_EMAIL_TEMPLATE(
      'Racconta la tua esperienza',
      `<p>Ciao {{full_name}},</p>
       <p>Speriamo che tu abbia apprezzato l'evento <strong>{{event_title}}</strong>!</p>
       <p>Ti va di condividere la tua esperienza? Il tuo feedback aiuta la community e gli organizzatori a migliorare.</p>`,
      'Lascia un commento', '{{event_url}}'
    )
  },
  event_invite_external: {
    subject: 'Sei stato invitato all\'evento: {{event_title}}',
    html: BASE_EMAIL_TEMPLATE(
      'Invito evento',
      `<p>Ciao {{full_name}},</p>
       <p>Sei stato invitato all'evento <strong>{{event_title}}</strong> su {{app_name}}.</p>
       <p>Registrati sulla piattaforma per partecipare!</p>`,
      'Vai all\'evento', '{{event_url}}'
    )
  },
  newsletter_new_event: {
    subject: 'Nuovo evento su {{app_name}}: {{event_title}}',
    html: BASE_EMAIL_TEMPLATE(
      'Nuovo evento disponibile',
      `<p>Ciao {{full_name}},</p>
       <p>È stato appena pubblicato un nuovo evento: <strong>{{event_title}}</strong>.</p>
       <p>Non perdertelo, i posti sono limitati!</p>`,
      'Scopri l\'evento', '{{event_url}}'
    )
  }
};

async function upsertEmailTemplate(type, subject, html) {
  const sql = `INSERT INTO public.email_templates(template_type, subject, html_content)
    VALUES($1,$2,$3)
    ON CONFLICT (template_type) DO UPDATE SET subject = EXCLUDED.subject, html_content = EXCLUDED.html_content, updated_at = now()`;
  await pool.query(sql, [type, subject, html]);
}

async function setPublicProfileSettings(userId, settings) {
  return setSettingValue(PP_USER_KEY(userId), settings || {});
}

async function getSlugOwner(slugLower) {
  const val = await getSettingValue(PP_SLUG_KEY(slugLower), null);
  if (val && typeof val === 'object' && val.user_id) return val.user_id;
  return null;
}

async function claimSlug(userId, slugLower) {
  // Upsert mapping slug->user (non-atomic legacy)
  await setSettingValue(PP_SLUG_KEY(slugLower), { user_id: userId });
}

async function releaseSlug(slugLower) {
  try {
    try { await ensureAppSettingsTable(); } catch {}
    await pool.query('DELETE FROM public.app_settings WHERE key = $1', [PP_SLUG_KEY(slugLower)]);
  } catch (e) {
    console.warn('[public_profile] releaseSlug failed', slugLower, e?.message || e);
  }
}

async function claimSlugAtomic(userId, slugLower) {
  // Claims a slug only if it's free or already owned by this user. Uses a transaction to avoid races.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try { await ensureAppSettingsTable(); } catch {}
    const key = PP_SLUG_KEY(slugLower);
    const { rows } = await client.query('SELECT value FROM public.app_settings WHERE key = $1 FOR UPDATE', [key]);
    if (!rows[0]) {
      await client.query('INSERT INTO public.app_settings(key, value, updated_at) VALUES ($1, $2::jsonb, now())', [key, JSON.stringify({ user_id: userId })]);
      await client.query('COMMIT');
      return { ok: true, mine: true, created: true };
    }
    const owner = rows[0].value?.user_id;
    if (owner && owner !== userId) {
      await client.query('ROLLBACK');
      return { ok: false, conflict: true, owner };
    }
    await client.query('UPDATE public.app_settings SET value = $1::jsonb, updated_at = now() WHERE key = $2', [JSON.stringify({ user_id: userId }), key]);
    await client.query('COMMIT');
    return { ok: true, mine: true, created: false };
  } catch (e) {
    try { await pool.query('ROLLBACK'); } catch {}
    return { ok: false, error: String(e?.message || e) };
  } finally {
    client.release();
  }
}

async function setSlugAlias(oldSlugLower, newSlugLower) {
  if (!oldSlugLower || !newSlugLower || oldSlugLower === newSlugLower) return;
  await setSettingValue(PP_SLUG_ALIAS_KEY(oldSlugLower), { redirect_to: newSlugLower });
}

async function getSlugAliasTarget(slugLower) {
  const val = await getSettingValue(PP_SLUG_ALIAS_KEY(slugLower), null);
  if (val && typeof val === 'object' && val.redirect_to) return String(val.redirect_to);
  return null;
}

function formatFromEmail(fromEnv) {
  const from = String(fromEnv || '').trim();
  if (!from) return `${APP_NAME} <noreply@send.weapnea.com>`;
  // Se già contiene display name, lasciamo invariato
  if (from.includes('<') && from.includes('>')) return from;
  // Se è solo un indirizzo, aggiungiamo il display name
  return `${APP_NAME} <${from}>`;
}

async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.warn('Resend not configured, skipping email:', subject, to);
    const entry = { ts: new Date().toISOString(), to, subject, ok: false, skipped: true, error: 'RESEND_API_KEY not set' };
    emailLog.push(entry); if (emailLog.length > EMAIL_LOG_MAX) emailLog.shift();
    return { skipped: true };
  }
  try {
    const from = formatFromEmail(RESEND_FROM_EMAIL);
    // Generate plain-text fallback from HTML (improves deliverability / anti-spam score)
    const text = html
      ? String(html)
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<\/h[1-6]>/gi, '\n\n')
          .replace(/<a[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/&#39;/gi, "'")
          .replace(/&quot;/gi, '"')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      : subject;
    const { data, error } = await resend.emails.send({ from, to, subject, html, text });
    if (error) throw error;
    const entry = { ts: new Date().toISOString(), to, subject, ok: true, id: data?.id };
    emailLog.push(entry); if (emailLog.length > EMAIL_LOG_MAX) emailLog.shift();
    return { ok: true, id: data?.id };
  } catch (e) {
    console.error('Email send failed:', e);
    const entry = { ts: new Date().toISOString(), to, subject, ok: false, error: String(e?.message || e) };
    emailLog.push(entry); if (emailLog.length > EMAIL_LOG_MAX) emailLog.shift();
    return { ok: false, error: String(e?.message || e) };
  }
}

// Helper: Send chat notification email (max 1 per day per sender->recipient)
async function maybeSendChatNotificationEmail(senderId, recipientId, senderName, messagePreview) {
  try {
    // Get recipient email
    const { rows: recipientRows } = await pool.query(
      `SELECT email, full_name FROM profiles WHERE id = $1`,
      [recipientId]
    );
    if (recipientRows.length === 0 || !recipientRows[0].email) return;
    const recipientEmail = recipientRows[0].email;
    const recipientName = recipientRows[0].full_name || 'Utente';

    // Check if we already sent a notification in the last 24 hours
    const { rows: notifRows } = await pool.query(
      `SELECT last_notified_at FROM chat_email_notifications 
       WHERE recipient_id = $1 AND sender_id = $2 
       AND last_notified_at > NOW() - INTERVAL '24 hours'`,
      [recipientId, senderId]
    );
    if (notifRows.length > 0) {
      // Already notified in last 24h, skip
      return;
    }

    // Truncate message preview
    const preview = messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview;

    // Send email notification
    const subject = `Nuovo messaggio da ${senderName} su ${APP_NAME}`;
    const rawHtml = BASE_EMAIL_TEMPLATE(
      'Hai un nuovo messaggio',
      `<p>Ciao ${recipientName.split(' ')[0]},</p>
       <p><strong>${senderName}</strong> ti ha inviato un messaggio su ${APP_NAME}:</p>
       <p style="background: #f3f4f6; padding: 12px; border-radius: 8px; font-style: italic;">"${preview}"</p>
       <p><a href="https://www.weapnea.com/inbox" style="background: linear-gradient(90deg, #2563eb, #7c3aed); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Leggi il messaggio</a></p>
       <p style="color: #6b7280; font-size: 0.875rem;">Riceverai al massimo una notifica al giorno per i nuovi messaggi.</p>`
    );
    const html = simpleRender(rawHtml, { app_name: APP_NAME, public_base: PRODUCTION_BASE_URL });

    await sendEmail({ to: recipientEmail, subject, html });

    // Upsert notification tracking record
    await pool.query(
      `INSERT INTO chat_email_notifications (recipient_id, sender_id, last_notified_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (recipient_id, sender_id) DO UPDATE SET last_notified_at = NOW()`,
      [recipientId, senderId]
    );

    console.log(`[chat] Sent email notification to ${recipientEmail} from ${senderName}`);
  } catch (e) {
    // Don't fail the message send if notification fails
    console.error('[chat] Email notification error:', e?.message || e);
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

// --- Contact endpoint ---
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    const n = (name || '').toString().trim();
    const e = (email || '').toString().trim();
    const m = (message || '').toString().trim();
    if (!n || !e || !m) return res.status(400).json({ error: 'Missing required fields' });
    if (!/.+@.+\..+/.test(e)) return res.status(400).json({ error: 'Invalid email' });
    if (m.length < 10) return res.status(400).json({ error: 'Message too short' });

    const to = process.env.CONTACT_TO_EMAIL || process.env.ADMIN_EMAIL || 'weapnea@gmail.com';
    const subject = `[Contatti] Messaggio da ${n}`;
    const escaped = (s) => String(s).replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const rawHtml = BASE_EMAIL_TEMPLATE(
      'Nuovo messaggio contatti',
      `<p><strong>Nome:</strong> ${escaped(n)}</p>
       <p><strong>Email:</strong> ${escaped(e)}</p>
       <p><strong>Messaggio:</strong></p>
       <p style="white-space:pre-line">${escaped(m)}</p>`
    );
    const html = simpleRender(rawHtml, { app_name: APP_NAME, public_base: PRODUCTION_BASE_URL });
    await sendEmail({ to, subject, html });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[contact] failed:', err?.message || err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

function requireAdmin(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  // Admin if JWT with role=admin OR if API_TOKEN is used directly
  if (req.user?.role === 'admin') return next();
  if (API_TOKEN && token === API_TOKEN) return next();
  return res.status(403).json({ error: 'Forbidden' });
}

// Optional auth: tries to authenticate but doesn't fail if not authenticated
function optionalAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return next();
  const token = auth.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
  } catch (_) { /* not a valid JWT, ignore */ }
  return next();
}

function requireBloggerOrAdmin(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  if (req.user?.role === 'admin' || req.user?.role === 'blogger' || req.user?.role === 'creator') return next();
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
       VALUES (gen_random_uuid(), $1, $2, $3, false, $4)
       RETURNING id, email, full_name, role, is_active`,
      [email, full_name, role, hash]
    );
    const user = rows[0];

    // Alla registrazione: crea subito lo slug pubblico (disabilitato di default)
    try {
      if (!HAS_PUBLIC_PROFILE_FIELDS) { await ensurePublicProfileColumnsAtRuntime(); await detectSchema(); }
      // Costruisci base slug da Nome Cognome oppure da parte locale dell'email
      const baseName = (full_name && String(full_name).trim()) || String(email).split('@')[0] || '';
      const norm = (s) => String(s || '')
        .toLowerCase()
        .trim()
        .replace(/[@._]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
      let slug = norm(baseName);
      if (!slug || RESERVED_SLUGS.has(slug)) slug = norm(`user-${String(email).split('@')[0] || 'profile'}`) || null;
      // Prova a reclamare lo slug, aggiungendo suffissi numerici in caso di conflitto
      let finalSlug = null;
      if (slug) {
        let attempt = slug;
        for (let i = 0; i < 20; i++) {
          const trySlug = i === 0 ? attempt : `${attempt}-${i+1}`;
          const r = await claimSlugAtomic(user.id, trySlug);
          if (r && r.ok) { finalSlug = trySlug; break; }
          // Se conflitto, riprova con il prossimo suffisso
        }
      }
      // Aggiorna profilo con flag pubblici (disabilitato) e slug se ottenuto
      if (HAS_PUBLIC_PROFILE_FIELDS) {
        await pool.query(
          `UPDATE profiles SET public_profile_enabled = false, public_slug = $1,
             public_show_bio = true, public_show_instagram = true, public_show_company_info = true,
             public_show_certifications = true, public_show_events = true, public_show_records = true, public_show_personal = true
           WHERE id = $2`,
          [finalSlug, user.id]
        );
      }
    } catch (e) {
      console.warn('[register] unable to preset public profile fields:', e?.message || e);
    }
    const jwtToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    // --- Email verification flow ---
    // Generate a verification token (JWT, 24 hours validity)
    const verificationToken = jwt.sign({ id: user.id, email: user.email, t: 'verify' }, JWT_SECRET, { expiresIn: '24h' });
    // Store verification token in profile
    await pool.query('UPDATE profiles SET email_verification_token = $1 WHERE id = $2', [verificationToken, user.id]);
    // Build the verification link
    const verifyBase = process.env.PUBLIC_BASE_URL || PRODUCTION_BASE_URL;
    const verifyLink = `${verifyBase.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(verificationToken)}`;
    // Send verification email instead of welcome email
    renderEmailWithTemplate('email_verification', { full_name: user.full_name || '', email: user.email, app_name: APP_NAME, verify_link: verifyLink },
      'Conferma il tuo account {{app_name}}',
      `<p>Ciao {{full_name}},</p><p>grazie per esserti registrato su {{app_name}}!</p><p>Per attivare il tuo account, clicca sul pulsante qui sotto:</p><p><a href="{{verify_link}}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Conferma email</a></p><p>Il link scade tra 24 ore.</p><p>Se non hai richiesto questa registrazione, ignora questa email.</p>`
    ).then(t => sendEmail({ to: user.email, subject: t.subject, html: t.html })).catch(e => { console.error('[register] verification email failed:', e); });
    // Return success WITHOUT token — user must verify email first
    res.status(201).json({ needsVerification: true, message: "Controlla la tua email per confermare l'account." });
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
    // Block login for unverified accounts
    if (!user.is_active) return res.status(403).json({ error: 'Account non verificato. Controlla la tua email per il link di conferma.', needsVerification: true, email: user.email });
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
  const base = process.env.PUBLIC_BASE_URL || PRODUCTION_BASE_URL;
  const link = `${base.replace(/\/$/, '')}/password-reset?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(user.email)}&type=recovery`;
    const rendered = await renderEmailWithTemplate('password_reset', { full_name: user.full_name || '', email: user.email, app_name: APP_NAME, reset_link: link },
      'Recupero password {{app_name}}',
      `<p>Ciao {{full_name}},</p><p>clicca <a href="{{reset_link}}">qui</a> per reimpostare la tua password. Il link scade tra 30 minuti.</p>`
    );
    await sendEmail({ to: user.email, subject: rendered.subject, html: rendered.html });
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

// API: verify email address using token sent during registration
app.get('/api/auth/verify-email', async (req, res) => {
  const { token } = req.query || {};
  if (!token) return res.status(400).json({ error: 'token is required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.id || payload?.t !== 'verify') return res.status(400).json({ error: 'invalid token' });
    // Check that the token matches the one stored in the profile
    const { rows } = await pool.query(
      'SELECT id, email, full_name, role, is_active, email_verification_token FROM profiles WHERE id = $1 LIMIT 1',
      [payload.id]
    );
    const user = rows[0];
    if (!user) return res.status(400).json({ error: 'user not found' });
    if (user.is_active) return res.json({ ok: true, alreadyVerified: true });
    if (user.email_verification_token !== token) return res.status(400).json({ error: 'invalid or expired token' });
    // Activate the user and clear the verification token
    await pool.query('UPDATE profiles SET is_active = true, email_verification_token = NULL WHERE id = $1', [user.id]);
    // Send welcome email now that the account is verified
    renderEmailWithTemplate('welcome', { full_name: user.full_name || '', email: user.email, app_name: APP_NAME },
      'Benvenuto su {{app_name}}',
      `<p>Ciao {{full_name}},</p><p>benvenuto su {{app_name}}! Il tuo account è stato attivato con successo.</p>`
    ).then(t => sendEmail({ to: user.email, subject: t.subject, html: t.html })).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    if (e?.name === 'TokenExpiredError') return res.status(400).json({ error: 'token expired' });
    res.status(400).json({ error: 'invalid or expired token' });
  }
});

// API: resend verification email
app.post('/api/auth/resend-verification', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });
  try {
    const { rows } = await pool.query('SELECT id, email, full_name, is_active FROM profiles WHERE email = $1 LIMIT 1', [email]);
    const user = rows[0];
    // Don't leak whether user exists
    if (!user || user.is_active) return res.json({ ok: true });
    // Generate new verification token
    const verificationToken = jwt.sign({ id: user.id, email: user.email, t: 'verify' }, JWT_SECRET, { expiresIn: '24h' });
    await pool.query('UPDATE profiles SET email_verification_token = $1 WHERE id = $2', [verificationToken, user.id]);
    const verifyBase = process.env.PUBLIC_BASE_URL || PRODUCTION_BASE_URL;
    const verifyLink = `${verifyBase.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(verificationToken)}`;
    const rendered = await renderEmailWithTemplate('email_verification', { full_name: user.full_name || '', email: user.email, app_name: APP_NAME, verify_link: verifyLink },
      'Conferma il tuo account {{app_name}}',
      `<p>Ciao {{full_name}},</p><p>grazie per esserti registrato su {{app_name}}!</p><p>Per attivare il tuo account, clicca sul pulsante qui sotto:</p><p><a href="{{verify_link}}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Conferma email</a></p><p>Il link scade tra 24 ore.</p>`
    );
    await sendEmail({ to: user.email, subject: rendered.subject, html: rendered.html });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
  if (!HAS_PERSONAL_BEST) { await ensurePersonalBestColumnAtRuntime(); }
  if (!HAS_OTHER_CERTIFICATIONS) { await ensureOtherCertificationsColumnAtRuntime(); }
  const pb = HAS_PERSONAL_BEST
    ? ", COALESCE(personal_best, '{}'::jsonb) AS personal_best"
    : ", '{}'::jsonb AS personal_best";
  const oc = HAS_OTHER_CERTIFICATIONS
    ? ", COALESCE(other_certifications, '[]'::jsonb) AS other_certifications"
    : ", '[]'::jsonb AS other_certifications";
  const pub = HAS_PUBLIC_PROFILE_FIELDS
    ? ", COALESCE(public_profile_enabled,false) AS public_profile_enabled, public_slug, COALESCE(public_show_bio,true) AS public_show_bio, COALESCE(public_show_instagram,true) AS public_show_instagram, COALESCE(public_show_company_info,true) AS public_show_company_info, COALESCE(public_show_certifications,true) AS public_show_certifications, COALESCE(public_show_events,true) AS public_show_events, COALESCE(public_show_records,true) AS public_show_records, COALESCE(public_show_personal,true) AS public_show_personal"
    : ", false AS public_profile_enabled, NULL::text AS public_slug, true AS public_show_bio, true AS public_show_instagram, true AS public_show_company_info, true AS public_show_certifications, true AS public_show_events, true AS public_show_records, true AS public_show_personal";
  const sql = `SELECT 
    id, email, full_name, role, is_active, avatar_url,
    bio, brevetto, scadenza_brevetto, scadenza_certificato_medico, certificato_medico_tipo,
    assicurazione, scadenza_assicurazione, instagram_contact${pb}${oc},
    company_name, vat_number, company_address, phone, club_team${pub}
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

// Email health/status (admin only)
app.get('/api/email/health', requireAuth, requireAdmin, async (_req, res) => {
  try {
    // DNS verification for email deliverability
    const dns = require('dns').promises;
    const fromDomain = (RESEND_FROM_EMAIL || '').split('@').pop()?.replace('>', '') || '';
    let dnsCheck = { domain: fromDomain, spf: null, dkim: null, mx: null };
    if (fromDomain) {
      try {
        const txtRecords = await dns.resolveTxt(fromDomain);
        dnsCheck.spf = txtRecords.flat().find(r => r.startsWith('v=spf1')) || 'NOT FOUND - may cause spam issues';
      } catch (e) { dnsCheck.spf = 'DNS lookup failed: ' + (e?.code || e?.message); }
      try {
        // Check for Resend DKIM records
        const dkimRecords = await dns.resolveCname(`resend._domainkey.${fromDomain}`).catch(() => null);
        dnsCheck.dkim = dkimRecords ? 'OK - CNAME found' : 'NOT FOUND - check Resend dashboard';
      } catch (e) { dnsCheck.dkim = 'Not configured'; }
      try {
        const mxRecords = await dns.resolveMx(fromDomain);
        dnsCheck.mx = mxRecords.map(r => `${r.priority} ${r.exchange}`);
      } catch (e) { dnsCheck.mx = 'No MX records'; }
    }
    res.json({
      configured: !!resend,
      from: RESEND_FROM_EMAIL,
      dns: dnsCheck,
      last: emailLog.slice(-10),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Email test (admin only)
app.post('/api/email/test', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { to, template_type = null, vars = null, subject = 'Test email WeApnea', html = '<p>Questa è una email di test inviata da WeApnea.</p>' } = req.body || {};
    if (!to) return res.status(400).json({ error: 'to is required' });
    let finalSubject = subject;
    let finalHtml = html;
    const public_base = process.env.PUBLIC_BASE_URL || PRODUCTION_BASE_URL;
    const boundVars = { app_name: APP_NAME, public_base, ...(vars || {}) };
    if (template_type) {
      const rendered = await renderEmailWithTemplate(template_type, boundVars, subject, html);
      finalSubject = rendered.subject;
      // Il renderer principale già gestisce {{#if var}}, quindi nessuna sostituzione extra necessaria
      finalHtml = rendered.html;
    }
    const result = await sendEmail({ to, subject: finalSubject, html: finalHtml });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Seed default email templates - DEPRECATED (now using JSON locale files)
// Kept for backwards compatibility but does nothing
app.post('/api/email-templates/seed-defaults', requireAuth, requireAdmin, async (_req, res) => {
  res.json({ ok: true, message: 'Email templates are now managed via JSON locale files', count: 0 });
});

// Profile endpoints (API mode)
app.get('/api/profile', requireAuth, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
  if (!HAS_PERSONAL_BEST) { await ensurePersonalBestColumnAtRuntime(); }
  if (!HAS_OTHER_CERTIFICATIONS) { await ensureOtherCertificationsColumnAtRuntime(); }
  // Prova a garantire le colonne del profilo pubblico anche in GET
  if (!HAS_PUBLIC_PROFILE_FIELDS) {
    try { await ensurePublicProfileColumnsAtRuntime(); await detectSchema(); } catch (_) {}
  }
  if (!HAS_ORGANIZER_REQUEST) { try { await ensureOrganizerRequestColumnsAtRuntime(); await detectSchema(); } catch (_) {} }
  const pb = HAS_PERSONAL_BEST
    ? ", COALESCE(personal_best, '{}'::jsonb) AS personal_best"
    : ", '{}'::jsonb AS personal_best";
  const oc = HAS_OTHER_CERTIFICATIONS
    ? ", COALESCE(other_certifications, '[]'::jsonb) AS other_certifications"
    : ", '[]'::jsonb AS other_certifications";
  const pub = HAS_PUBLIC_PROFILE_FIELDS
    ? ", COALESCE(public_profile_enabled,false) AS public_profile_enabled, public_slug, COALESCE(public_show_bio,true) AS public_show_bio, COALESCE(public_show_instagram,true) AS public_show_instagram, COALESCE(public_show_company_info,true) AS public_show_company_info, COALESCE(public_show_certifications,true) AS public_show_certifications, COALESCE(public_show_events,true) AS public_show_events, COALESCE(public_show_records,true) AS public_show_records, COALESCE(public_show_personal,true) AS public_show_personal"
    : ", false AS public_profile_enabled, NULL::text AS public_slug, true AS public_show_bio, true AS public_show_instagram, true AS public_show_company_info, true AS public_show_certifications, true AS public_show_events, true AS public_show_records, true AS public_show_personal";
  const sql = `SELECT 
    id, email, full_name, role, is_active, avatar_url,
    bio, brevetto, scadenza_brevetto, scadenza_certificato_medico, certificato_medico_tipo,
    assicurazione, scadenza_assicurazione, instagram_contact${pb}${oc},
    company_name, vat_number, company_address, phone, contact_email, club_team${pub}, organizer_upgrade_requested_at
    , didattica_brevetto, numero_brevetto, foto_brevetto_url, numero_assicurazione
    , COALESCE(dichiarazione_brevetto_valido,false) AS dichiarazione_brevetto_valido
    , COALESCE(dichiarazione_assicurazione_valida,false) AS dichiarazione_assicurazione_valida
     FROM profiles WHERE id = $1 LIMIT 1`;
  const { rows } = await pool.query(sql, [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (!HAS_PUBLIC_PROFILE_FIELDS) {
      // Usa fallback da app_settings per i flag pubblici
      const pp = await getPublicProfileSettings(user.id);
      if (pp) {
        user.public_profile_enabled = !!pp.enabled;
        user.public_slug = pp.slug || null;
        user.public_show_bio = pp.show_bio !== false;
        user.public_show_instagram = pp.show_instagram !== false;
        user.public_show_company_info = pp.show_company_info !== false;
        user.public_show_certifications = pp.show_certifications !== false;
        user.public_show_events = pp.show_events !== false;
        user.public_show_records = pp.show_records !== false;
        user.public_show_personal = pp.show_personal !== false;
      }
    }
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.put('/api/profile', requireAuth, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    if (!HAS_PERSONAL_BEST) { await ensurePersonalBestColumnAtRuntime(); }
    if (!HAS_OTHER_CERTIFICATIONS) { await ensureOtherCertificationsColumnAtRuntime(); }
    if (!HAS_PUBLIC_PROFILE_FIELDS) {
      try { await ensurePublicProfileColumnsAtRuntime(); await detectSchema(); } catch (_) {}
    }
    const allowed = [
      'full_name','avatar_url','bio','brevetto','scadenza_brevetto','scadenza_certificato_medico','certificato_medico_tipo',
      'assicurazione','scadenza_assicurazione','instagram_contact',
      'company_name','vat_number','company_address','phone','contact_email','club_team',
      'didattica_brevetto','numero_brevetto','foto_brevetto_url','numero_assicurazione',
      'dichiarazione_brevetto_valido','dichiarazione_assicurazione_valida'
    ];
    // Accetta sempre i flag pubblici; se le colonne mancassero, effettueremo un ensure e un retry sotto
  allowed.push('public_profile_enabled','public_slug','public_show_bio','public_show_instagram','public_show_company_info','public_show_certifications','public_show_events','public_show_records','public_show_personal');
    allowed.push('newsletter_new_events');
    if (HAS_PERSONAL_BEST) allowed.push('personal_best');
    if (HAS_OTHER_CERTIFICATIONS) allowed.push('other_certifications');
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
      if (p.public_slug && RESERVED_SLUGS.has(p.public_slug)) {
        return res.status(400).json({ error: 'reserved_slug' });
      }
    }
    // Normalizza valore certificato_medico_tipo
    if (typeof p.certificato_medico_tipo !== 'undefined') {
      let v = p.certificato_medico_tipo;
      if (v === null || v === undefined || v === '') {
        p.certificato_medico_tipo = null;
      } else if (typeof v === 'string') {
        const norm = v.toLowerCase().replace(/-/g, '_').trim();
        p.certificato_medico_tipo = (norm === 'agonistico' || norm === 'non_agonistico') ? norm : null;
      } else {
        p.certificato_medico_tipo = null;
      }
    }
    const fields = Object.keys(p).filter(k => allowed.includes(k));
    if (fields.length === 0) return res.status(400).json({ error: 'no valid fields to update' });
    // Serialize JSON fields
    const values = fields.map((k) => {
      if ((k === 'personal_best' || k === 'other_certifications') && p[k] && typeof p[k] !== 'string') {
        return JSON.stringify(p[k]);
      }
      return p[k];
    });
    const sets = fields.map((k,i)=> {
      if (k === 'personal_best' || k === 'other_certifications') return `${k} = $${i+1}::jsonb`;
      return `${k} = $${i+1}`;
    }).join(', ');
  const sql = `UPDATE profiles SET ${sets}, updated_at = now() WHERE id = $${fields.length+1} RETURNING *`;
    async function runUpdate(withEnsure = false) {
      if (withEnsure) {
        try { await ensurePublicProfileColumnsAtRuntime(); await detectSchema(); } catch (_) {}
      }
      try {
        // If slug present, ensure atomic claim first, then update profile
        if (fields.includes('public_slug')) {
          const newSlug = (p.public_slug || '').toLowerCase() || null;
          // Load previous slug (if any)
          const { rows: cur } = await pool.query('SELECT public_slug FROM profiles WHERE id = $1 LIMIT 1', [req.user.id]);
          const prevSlug = (cur[0]?.public_slug || '').toLowerCase() || null;
          console.log('[slug-update] userId:', req.user.id, 'prevSlug:', prevSlug, 'newSlug:', newSlug);
          // Se lo slug non è cambiato, nessuna azione speciale
          if (prevSlug && newSlug && prevSlug === newSlug) {
            console.log('[slug-update] slug invariato, update normale');
            // Slug invariato, procedi normalmente
            const { rows } = await pool.query(sql, [...values, req.user.id]);
            return rows;
          }
          // Cambio slug: claim atomico del nuovo + alias di redirect dal vecchio
          if (prevSlug && newSlug && prevSlug !== newSlug) {
            console.log('[slug-update] cambio slug:', prevSlug, '->', newSlug);
            const r = await claimSlugAtomic(req.user.id, newSlug);
            console.log('[slug-update] claimSlugAtomic result:', JSON.stringify(r));
            if (!r.ok && r.conflict) return res.status(409).json({ error: 'public_slug conflict' });
            // Registra alias di redirect dal vecchio slug al nuovo
            try { await setSlugAlias(prevSlug, newSlug); } catch (e) { console.warn('[slug] alias set failed:', e?.message || e); }
            // Rilascia il vecchio slug claim
            try { await pool.query(`DELETE FROM public.app_settings WHERE key = $1`, [PP_SLUG_KEY(prevSlug)]); } catch {}
            const { rows } = await pool.query(sql, [...values, req.user.id]);
            console.log('[slug-update] UPDATE result slug:', rows[0]?.public_slug);
            return rows;
          }
          // Prima assegnazione: claim atomico
          if (!prevSlug && newSlug) {
            console.log('[slug-update] prima assegnazione:', newSlug);
            const r = await claimSlugAtomic(req.user.id, newSlug);
            if (!r.ok && r.conflict) return res.status(409).json({ error: 'public_slug conflict' });
          }
          const { rows } = await pool.query(sql, [...values, req.user.id]);
          return rows;
        } else {
          const { rows } = await pool.query(sql, [...values, req.user.id]);
          return rows;
        }
      } catch (e) {
        const code = e && e.code;
        const msg = String(e?.message || '');
        // unique violation on lower(public_slug) index
        if (code === '23505' || msg.includes('uniq_profiles_public_slug_lower')) {
          return res.status(409).json({ error: 'public_slug conflict' });
        }
        // missing column for public profile flags -> ensure and retry once
        if (msg.toLowerCase().includes('column') && (
          msg.toLowerCase().includes('public_profile_enabled') ||
          msg.toLowerCase().includes('public_slug') ||
          msg.toLowerCase().includes('public_show_bio') ||
          msg.toLowerCase().includes('public_show_instagram') ||
          msg.toLowerCase().includes('public_show_company_info') ||
          msg.toLowerCase().includes('public_show_certifications') ||
          msg.toLowerCase().includes('public_show_events') ||
          msg.toLowerCase().includes('public_show_records') ||
          msg.toLowerCase().includes('public_show_personal')
        )) {
          if (!withEnsure) {
            return runUpdate(true);
          }
          // Se ancora manca, usa fallback app_settings per salvare i flag
          const pp = await getPublicProfileSettings(req.user.id) || {};
          const prevSlug = (pp.slug || '').toString().toLowerCase();
          // Aggiorna i flag dal payload
          if (fields.includes('public_profile_enabled')) pp.enabled = !!p.public_profile_enabled;
          if (fields.includes('public_show_bio')) pp.show_bio = !!p.public_show_bio;
          if (fields.includes('public_show_instagram')) pp.show_instagram = !!p.public_show_instagram;
          if (fields.includes('public_show_company_info')) pp.show_company_info = !!p.public_show_company_info;
          if (fields.includes('public_show_certifications')) pp.show_certifications = !!p.public_show_certifications;
          if (fields.includes('public_show_events')) pp.show_events = !!p.public_show_events;
          if (fields.includes('public_show_records')) pp.show_records = !!p.public_show_records;
          if (fields.includes('public_show_personal')) pp.show_personal = !!p.public_show_personal;
          // Gestione slug fallback con unicità su app_settings
          if (fields.includes('public_slug')) {
            const newSlug = (p.public_slug || '').toString().trim().toLowerCase();
            if (newSlug) {
              const owner = await getSlugOwner(newSlug);
              if (owner && owner !== req.user.id) {
                return res.status(409).json({ error: 'public_slug conflict' });
              }
              if (prevSlug && prevSlug !== newSlug) { await releaseSlug(prevSlug); }
              await claimSlug(req.user.id, newSlug);
              pp.slug = newSlug;
            } else {
              if (prevSlug) await releaseSlug(prevSlug);
              pp.slug = null;
            }
          }
          await setPublicProfileSettings(req.user.id, pp);
          // Ritorna lo user originale senza modifiche DB, ma con flags fusi
          const { rows: r } = await pool.query('SELECT * FROM profiles WHERE id = $1 LIMIT 1', [req.user.id]);
          const userRow = r[0] || { id: req.user.id };
          userRow.public_profile_enabled = !!pp.enabled;
          userRow.public_slug = pp.slug || null;
          userRow.public_show_bio = pp.show_bio !== false;
          userRow.public_show_instagram = pp.show_instagram !== false;
          userRow.public_show_company_info = pp.show_company_info !== false;
          userRow.public_show_certifications = pp.show_certifications !== false;
          userRow.public_show_events = pp.show_events !== false;
          userRow.public_show_records = pp.show_records !== false;
          userRow.public_show_personal = pp.show_personal !== false;
          return [userRow];
        }
        throw e;
      }
    }
    const rows = await runUpdate(false);
    if (!Array.isArray(rows)) return; // response already sent (e.g., 409)
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
  if (RESERVED_SLUGS.has(slug)) return res.json({ available: false, reserved: true });
  try {
    if (!HAS_PUBLIC_PROFILE_FIELDS) {
      try { await ensurePublicProfileColumnsAtRuntime(); await detectSchema(); } catch (_) {}
    }
    const doQuery = async () => {
      if (HAS_PUBLIC_PROFILE_FIELDS) {
        const { rows } = await pool.query(
          `SELECT id FROM profiles WHERE lower(public_slug) = lower($1) LIMIT 1`,
          [slug]
        );
        return rows[0];
      }
      // Fallback su app_settings
      const ownerId = await getSlugOwner(slug);
      return ownerId ? { id: ownerId } : null;
    };
    // Resolve alias: if slug is an old alias redirecting to another, treat as taken
    const aliasTo = await getSlugAliasTarget(slug);
    if (aliasTo) {
      return res.json({ available: false, aliasTo });
    }
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
    // Se autenticato, verifica se appartiene al chiamante
    const auth = req.headers['authorization'] || '';
    let mine = false;
    if (auth.startsWith('Bearer ')) {
      try {
        const token = auth.slice('Bearer '.length);
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload?.id) {
          if (HAS_PUBLIC_PROFILE_FIELDS) {
            const { rows: me } = await pool.query('SELECT id FROM profiles WHERE id = $1 AND lower(public_slug) = lower($2) LIMIT 1', [payload.id, slug]);
            mine = !!me[0];
          } else {
            const ownerId = await getSlugOwner(slug);
            mine = ownerId === payload.id;
          }
        }
      } catch {}
    }
    if (mine) return res.json({ available: true, mine: true });
    return res.json({ available: false, mine: false });
  } catch (e) {
    const msg = String(e?.message || e);
    return res.status(500).json({ available: false, error: msg });
  }
});

// Request organizer upgrade (final users). Idempotent.
app.post('/api/me/request-organizer', requireAuth, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    if (!HAS_ORGANIZER_REQUEST) { try { await ensureOrganizerRequestColumnsAtRuntime(); await detectSchema(); } catch (_) {} }
    // Fetch current role and existing request
    const { rows } = await pool.query('SELECT role, organizer_upgrade_requested_at FROM profiles WHERE id = $1 LIMIT 1', [req.user.id]);
    const r = rows[0];
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.role && r.role !== 'final_user') {
      return res.status(409).json({ error: 'already_organizer' });
    }
    if (r.organizer_upgrade_requested_at) {
      // Even if already requested, notify admins again? Keep idempotent: do not resend.
      return res.json({ ok: true, already_requested: true });
    }
    await pool.query('UPDATE profiles SET organizer_upgrade_requested_at = NOW() WHERE id = $1', [req.user.id]);
    // Notify all admins by email (fire-and-forget)
    ;(async () => {
      try {
        const { rows: meRows } = await pool.query('SELECT email, COALESCE(NULLIF(TRIM(full_name), \'\'), email) AS name FROM profiles WHERE id = $1 LIMIT 1', [req.user.id]);
        const requesterEmail = meRows[0]?.email || '';
        const requesterName = meRows[0]?.name || requesterEmail;
        const { rows: admins } = await pool.query("SELECT email, COALESCE(NULLIF(TRIM(full_name), ''), email) AS name FROM profiles WHERE role = 'admin' AND COALESCE(is_active, true) = true AND email IS NOT NULL");
        if (admins.length === 0) return;
        const base = process.env.PUBLIC_BASE_URL || PRODUCTION_BASE_URL;
        const adminUrl = `${String(base).replace(/\/$/, '')}/admin`;
        for (const a of admins) {
          const tpl = await renderEmailWithTemplate(
            'organizer_upgrade_request_admin',
            { admin_name: a.name || 'Admin', requester_name: requesterName, requester_email: requesterEmail, app_name: APP_NAME, public_base: base, admin_url: adminUrl },
            'Richiesta upgrade organizzatore',
            BASE_EMAIL_TEMPLATE(
              'Nuova richiesta upgrade organizzatore',
              `<p>Un utente ha richiesto l'upgrade a organizzatore: <strong>${requesterName}</strong> (${requesterEmail}).</p>`,
              'Apri gestione utenti', adminUrl
            )
          );
          await sendEmail({ to: a.email, subject: tpl.subject, html: tpl.html });
        }
      } catch (e) { console.warn('[organizer-upgrade] notify admins failed:', e?.message || e); }
    })();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Simple image/file upload endpoint (API mode). Returns public URL under /public/uploads
app.post('/api/upload', requireAuth, handleMulterErrors(upload.single('file')), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    console.log('[upload] file received:', { name: req.file.originalname, size: req.file.size, mime: req.file.mimetype });
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
    e.fixed_appointment_text, e.pdf_url, e.whatsapp_group_url,
    -- Paid participants count for x / y indicator in listings
    COALESCE((SELECT COUNT(*) FROM event_payments ep WHERE ep.event_id = e.id AND ep.status = 'paid'), 0)::int AS participants_paid_count,
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
  const userRole = req.query.userRole ? String(req.query.userRole) : '';
  const userId = req.query.userId ? String(req.query.userId) : '';
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
  // If called by dashboard/manager with a non-admin role, restrict to own events
  if (userRole && userId && userRole !== 'admin') {
    params.push(userId);
    clauses.push(`e.created_by = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const validCols = new Set(['date', 'title', 'nation', 'category']);
  const col = validCols.has(String(sortColumn)) ? String(sortColumn) : 'date';
  const dir = String(sortDirection).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const orderBy = col === 'category' ? `ORDER BY c.name ${dir}` : `ORDER BY e.${col} ${dir}`;
  const sql = `${eventsSelect()} ${where} ${orderBy}`;
  try {
    const { rows } = await pool.query(sql, params);
    // Non mascheriamo più il costo nelle risposte: la modalità free governa solo il flusso di pagamento
    res.json(rows);
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
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/events/slug/:slug', async (req, res) => {
  try {
    const slugParam = req.params.slug;
    // 1) Exact match
    let sql = `${eventsSelect()} WHERE e.slug = $1 LIMIT 1`;
    let { rows } = await pool.query(sql, [slugParam]);
    // 2) Fallback: slug stored with date prefix (YYYY-MM-DD-title) but URL has just title
    if (!rows[0]) {
      sql = `${eventsSelect()} WHERE e.slug LIKE $1 LIMIT 1`;
      ({ rows } = await pool.query(sql, [`%-${slugParam}`]));
    }
    // 3) Fallback: title column match (slugified)
    if (!rows[0]) {
      sql = `${eventsSelect()} WHERE LOWER(REPLACE(e.title, ' ', '-')) = LOWER($1) LIMIT 1`;
      ({ rows } = await pool.query(sql, [slugParam]));
    }
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Organizer contact (phone) for an event — only for eligible, authenticated users
app.get('/api/events/:id/organizer-contact', requireAuth, async (req, res) => {
  try {
    // 1) Carica evento per ottenere organizer_id
    const { rows: evRows } = await pool.query('SELECT id, created_by FROM events WHERE id = $1 LIMIT 1', [req.params.id]);
    const ev = evRows[0];
    if (!ev) return res.status(404).json({ error: 'Not found' });

    // 2) Utente deve essere autenticato e non necessariamente organizzatore (se è organizzatore, ok comunque)
    const viewerId = req.user?.id;
    if (!viewerId) return res.status(401).json({ error: 'Unauthorized' });

    // 3) Verifica idoneità alla pre-iscrizione (stessa logica del pagamento/iscrizione)
    const { rows: profRows } = await pool.query(
      `SELECT phone, assicurazione, scadenza_assicurazione, scadenza_certificato_medico, certificato_medico_tipo
       FROM profiles WHERE id = $1 LIMIT 1`,
      [viewerId]
    );
    const prof = profRows[0];
    if (!prof) return res.status(404).json({ error: 'Profile not found' });
    const isEmpty = (v) => !v || String(v).trim() === '';
    const today = new Date();
    // Tolleranza di 1 mese: chi scade nel mese corrente può ancora iscriversi
    const toleranceDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    const sa = prof.scadenza_assicurazione ? new Date(prof.scadenza_assicurazione) : null;
    const sc = prof.scadenza_certificato_medico ? new Date(prof.scadenza_certificato_medico) : null;
    const tipo = prof.certificato_medico_tipo ? String(prof.certificato_medico_tipo) : '';
    const ok = (
      !isEmpty(prof.phone) &&
      !isEmpty(prof.assicurazione) &&
      sa && sa instanceof Date && !isNaN(sa.getTime()) && sa >= toleranceDate &&
      sc && sc instanceof Date && !isNaN(sc.getTime()) && sc >= toleranceDate &&
      (tipo === 'agonistico' || tipo === 'non_agonistico')
    );
    if (!ok) return res.status(403).json({ error: 'not_eligible' });

    // 4) Recupera telefono dell'organizzatore
    const { rows: orgRows } = await pool.query('SELECT phone FROM profiles WHERE id = $1 LIMIT 1', [ev.created_by]);
    const org = orgRows[0];
    const phone = org?.phone && String(org.phone).trim() !== '' ? String(org.phone).trim() : null;
    if (!phone) return res.status(204).end();

    res.json({ phone });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// -----------------------------
// Blog endpoints
// -----------------------------
app.get('/api/blog', optionalAuth, async (req, res) => {
  // Ensure column exists to avoid runtime errors on fresh DBs
  await ensureBlogLanguageColumn();
  const { searchTerm, published = 'true', sortColumn = 'created_at', sortDirection = 'desc', language, onlyMine, tag } = req.query;
  const params = [];
  const clauses = [];
  if (String(published) === 'true') clauses.push('b.published = true');
  // Creator: solo i propri articoli (quando richiesto o quando non è admin/blogger)
  if (String(onlyMine) === 'true') {
    if (!req.user?.id) {
      // Se onlyMine ma nessun utente autenticato, restituisci lista vuota
      return res.json([]);
    }
    params.push(req.user.id);
    clauses.push(`b.author_id = $${params.length}`);
  }
  if (searchTerm && String(searchTerm).trim()) {
    params.push(`%${String(searchTerm).trim()}%`);
    clauses.push(`b.title ILIKE $${params.length}`);
  }
  if (language && String(language).trim()) {
    params.push(String(language).trim());
    clauses.push(`b.language = $${params.length}`);
  }
  // Filter by tag id
  if (tag && String(tag).trim()) {
    params.push(String(tag).trim());
    clauses.push(`b.id IN (SELECT article_id FROM blog_article_tags WHERE tag_id = $${params.length})`);
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
    // Attach tags to each article
    try {
      await ensureBlogTagsTables();
      if (rows.length > 0) {
        const articleIds = rows.map(r => r.id);
        const { rows: tagRows } = await pool.query(
          `SELECT at.article_id, t.id, t.name, t.language FROM blog_tags t
           JOIN blog_article_tags at ON at.tag_id = t.id
           WHERE at.article_id = ANY($1) ORDER BY t.name`,
          [articleIds]
        );
        const tagMap = {};
        for (const tr of tagRows) {
          if (!tagMap[tr.article_id]) tagMap[tr.article_id] = [];
          tagMap[tr.article_id].push({ id: tr.id, name: tr.name, language: tr.language });
        }
        for (const row of rows) { row.tags = tagMap[row.id] || []; }
      }
    } catch (tagErr) {
      console.warn('[blog] tag fetch failed:', tagErr?.message || tagErr);
      for (const row of rows) row.tags = [];
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/blog/slug/:slug', async (req, res) => {
  await ensureBlogLanguageColumn();
  const slugParam = req.params.slug;
  const baseSql = `
    SELECT b.*, json_build_object('full_name', p.full_name) AS profiles
    FROM blog_articles b
    LEFT JOIN profiles p ON p.id = b.author_id
  `;
  try {
    // 1) Exact match
    let { rows } = await pool.query(`${baseSql} WHERE b.slug = $1 AND b.published = true LIMIT 1`, [slugParam]);
    // 2) Fallback: slug stored with date prefix
    if (!rows[0]) {
      ({ rows } = await pool.query(`${baseSql} WHERE b.slug LIKE $1 AND b.published = true LIMIT 1`, [`%-${slugParam}`]));
    }
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    // Attach tags
    try {
      await ensureBlogTagsTables();
      const { rows: tagRows } = await pool.query(
        `SELECT t.id, t.name, t.language FROM blog_tags t JOIN blog_article_tags at ON at.tag_id = t.id WHERE at.article_id = $1 ORDER BY t.name`,
        [rows[0].id]
      );
      rows[0].tags = tagRows;
    } catch { rows[0].tags = []; }
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
    // Attach tags
    try {
      await ensureBlogTagsTables();
      const { rows: tagRows } = await pool.query(
        `SELECT t.id, t.name, t.language FROM blog_tags t JOIN blog_article_tags at ON at.tag_id = t.id WHERE at.article_id = $1 ORDER BY t.name`,
        [rows[0].id]
      );
      rows[0].tags = tagRows;
    } catch { rows[0].tags = []; }
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/blog', requireAuth, requireBloggerOrAdmin, async (req, res) => {
  await ensureBlogLanguageColumn();
  const b = req.body || {};
  try {
    const cols = ['language','title','subtitle','slug','excerpt','content','cover_image_url','gallery_images','seo_title','seo_description','seo_keywords','hashtags','published','author_id'];
    // Force author_id to current user if not admin
    const authorId = (req.user?.role === 'admin' && b.author_id) ? b.author_id : (req.user?.id || b.author_id);
    const vals = [
      b.language || 'it',
      b.title,
      b.subtitle || null,
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
    const article = rows[0];
    // Save tags if provided
    if (Array.isArray(b.tag_ids) && b.tag_ids.length > 0) {
      try {
        await ensureBlogTagsTables();
        for (const tagId of b.tag_ids) {
          await pool.query('INSERT INTO blog_article_tags(article_id, tag_id) VALUES($1, $2) ON CONFLICT DO NOTHING', [article.id, tagId]);
        }
        const { rows: tagRows } = await pool.query(
          `SELECT t.id, t.name, t.language FROM blog_tags t JOIN blog_article_tags at ON at.tag_id = t.id WHERE at.article_id = $1 ORDER BY t.name`,
          [article.id]
        );
        article.tags = tagRows;
      } catch (tagErr) { article.tags = []; }
    } else { article.tags = []; }
    res.status(201).json(article);
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes('duplicate key')) return res.status(409).json({ error: 'Slug già esistente' });
    res.status(500).json({ error: msg });
  }
});

app.put('/api/blog/:id', requireAuth, requireBloggerOrAdmin, async (req, res) => {
  await ensureBlogLanguageColumn();
  // Creator can only edit own articles
  if (req.user?.role === 'creator') {
    const { rows: check } = await pool.query('SELECT author_id FROM blog_articles WHERE id = $1', [req.params.id]);
    if (!check[0]) return res.status(404).json({ error: 'Not found' });
    if (check[0].author_id !== req.user.id) return res.status(403).json({ error: 'Forbidden: puoi modificare solo i tuoi articoli' });
  }
  const b = req.body || {};
  try {
    const allowed = ['language','title','subtitle','slug','excerpt','content','cover_image_url','gallery_images','seo_title','seo_description','seo_keywords','hashtags','published'];
    const fields = Object.keys(b).filter(k => allowed.includes(k));
    if (fields.length === 0) return res.status(400).json({ error: 'no valid fields to update' });
    const sets = fields.map((k,i)=> `${k} = $${i+1}`).join(', ');
    const sql = `UPDATE blog_articles SET ${sets}, updated_at = now() WHERE id = $${fields.length+1} RETURNING *`;
    const { rows } = await pool.query(sql, [...fields.map(k => b[k]), req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const article = rows[0];
    // Update tags if provided
    if (Array.isArray(b.tag_ids)) {
      try {
        await ensureBlogTagsTables();
        await pool.query('DELETE FROM blog_article_tags WHERE article_id = $1', [req.params.id]);
        for (const tagId of b.tag_ids) {
          await pool.query('INSERT INTO blog_article_tags(article_id, tag_id) VALUES($1, $2) ON CONFLICT DO NOTHING', [req.params.id, tagId]);
        }
        const { rows: tagRows } = await pool.query(
          `SELECT t.id, t.name, t.language FROM blog_tags t JOIN blog_article_tags at ON at.tag_id = t.id WHERE at.article_id = $1 ORDER BY t.name`,
          [req.params.id]
        );
        article.tags = tagRows;
      } catch (tagErr) { article.tags = []; }
    }
    res.json(article);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.delete('/api/blog/:id', requireAuth, requireBloggerOrAdmin, async (req, res) => {
  try {
    // Creator can only delete own articles
    if (req.user?.role === 'creator') {
      const { rows: check } = await pool.query('SELECT author_id FROM blog_articles WHERE id = $1', [req.params.id]);
      if (!check[0]) return res.status(404).json({ error: 'Not found' });
      if (check[0].author_id !== req.user.id) return res.status(403).json({ error: 'Forbidden: puoi eliminare solo i tuoi articoli' });
    }
    const { rowCount } = await pool.query('DELETE FROM blog_articles WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// ===========================
// Blog Tags endpoints
// ===========================

// List all tags, optionally filtered by language
app.get('/api/blog-tags', async (req, res) => {
  try {
    await ensureBlogTagsTables();
    const { language } = req.query;
    let sql = 'SELECT id, name, language, created_at FROM blog_tags';
    const params = [];
    if (language && String(language).trim()) {
      params.push(String(language).trim());
      sql += ` WHERE language = $1`;
    }
    sql += ' ORDER BY name ASC';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Create a tag (admin/blogger only)
app.post('/api/blog-tags', requireAuth, requireBloggerOrAdmin, async (req, res) => {
  const { name, language = 'it' } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  try {
    await ensureBlogTagsTables();
    const { rows } = await pool.query(
      'INSERT INTO blog_tags(name, language) VALUES($1, $2) ON CONFLICT(name, language) DO UPDATE SET name = EXCLUDED.name RETURNING *',
      [String(name).trim(), language]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Update a tag (admin/blogger only)
app.put('/api/blog-tags/:id', requireAuth, requireBloggerOrAdmin, async (req, res) => {
  const { name, language } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const sets = ['name = $1'];
    const params = [String(name).trim()];
    if (language) { sets.push(`language = $${params.length + 1}`); params.push(language); }
    params.push(req.params.id);
    const sql = `UPDATE blog_tags SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`;
    const { rows } = await pool.query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    if (String(e?.message || '').includes('duplicate key')) return res.status(409).json({ error: 'Tag con questo nome esiste già per la lingua selezionata' });
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Delete a tag (admin/blogger only)
app.delete('/api/blog-tags/:id', requireAuth, requireBloggerOrAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM blog_tags WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Get tags for a specific article
app.get('/api/blog/:id/tags', async (req, res) => {
  try {
    await ensureBlogTagsTables();
    const { rows } = await pool.query(
      `SELECT t.id, t.name, t.language FROM blog_tags t
       JOIN blog_article_tags at ON at.tag_id = t.id
       WHERE at.article_id = $1 ORDER BY t.name`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Set tags for an article (replace all)
app.put('/api/blog/:id/tags', requireAuth, requireBloggerOrAdmin, async (req, res) => {
  const { tag_ids } = req.body || {};
  if (!Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids must be an array' });
  try {
    await ensureBlogTagsTables();
    // Remove all existing tags for this article
    await pool.query('DELETE FROM blog_article_tags WHERE article_id = $1', [req.params.id]);
    // Insert new tags
    for (const tagId of tag_ids) {
      await pool.query(
        'INSERT INTO blog_article_tags(article_id, tag_id) VALUES($1, $2) ON CONFLICT DO NOTHING',
        [req.params.id, tagId]
      );
    }
    // Return the updated tags
    const { rows } = await pool.query(
      `SELECT t.id, t.name, t.language FROM blog_tags t
       JOIN blog_article_tags at ON at.tag_id = t.id
       WHERE at.article_id = $1 ORDER BY t.name`,
      [req.params.id]
    );
    res.json(rows);
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
        scadenza_certificato_medico, certificato_medico_tipo, company_address, vat_number
       FROM profiles
       WHERE id = $1 AND role IN ('instructor','company','creator') AND COALESCE(is_active, true) = true
       LIMIT 1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Public: instructor events by user id
app.get('/api/instructors/:id/events', async (req, res) => {
  try {
    const { rows } = await pool.query(`${eventsSelect()} WHERE e.created_by = $1 ORDER BY e.date DESC NULLS LAST`, [req.params.id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Public instructor/company profile by slug (SEO-friendly)
app.get('/api/instructors/slug/:slug', async (req, res) => {
  try {
    let slug = String(req.params.slug || '').trim().toLowerCase();
    // Follow aliases
    const aliasTo = await getSlugAliasTarget(slug);
    if (aliasTo) slug = aliasTo;
    // 1) Prova via colonne native, se presenti
    if (HAS_PUBLIC_PROFILE_FIELDS) {
      try {
        const ocCol = HAS_OTHER_CERTIFICATIONS ? ", COALESCE(other_certifications, '[]'::jsonb) AS other_certifications" : ", '[]'::jsonb AS other_certifications";
        const { rows } = await pool.query(
          `SELECT 
            id, full_name, company_name, bio, avatar_url, instagram_contact, role,
            brevetto, scadenza_brevetto, assicurazione, scadenza_assicurazione,
            scadenza_certificato_medico, certificato_medico_tipo, company_address, vat_number, personal_best, club_team${ocCol},
            public_profile_enabled, public_slug, public_show_bio, public_show_instagram, public_show_company_info, public_show_certifications, public_show_events, public_show_records, public_show_personal
           FROM profiles
           WHERE lower(public_slug) = lower($1)
             AND COALESCE(is_active, true) = true
             AND COALESCE(public_profile_enabled, false) = true
           LIMIT 1`,
          [slug]
        );
  if (rows[0]) return res.json({ ...rows[0], public_slug: rows[0].public_slug || slug });
      } catch (e) {
        // Se la colonna mancasse, andiamo a fallback
      }
    }
    // 2) Fallback: mappa slug->user in app_settings
    const ownerId = await getSlugOwner(slug);
    if (!ownerId) return res.status(404).json({ error: 'Not found' });
    // recupera profilo base
    const ocColFallback = HAS_OTHER_CERTIFICATIONS ? ", COALESCE(other_certifications, '[]'::jsonb) AS other_certifications" : "";
    const { rows: baseRows } = await pool.query(
      `SELECT id, full_name, company_name, bio, avatar_url, instagram_contact, role,
              brevetto, scadenza_brevetto, assicurazione, scadenza_assicurazione,
              scadenza_certificato_medico, certificato_medico_tipo, company_address, vat_number, personal_best, club_team,
              COALESCE(is_active, true) AS is_active${ocColFallback}
         FROM profiles WHERE id = $1 LIMIT 1`,
      [ownerId]
    );
    const base = baseRows[0];
    if (!base || !base.is_active) {
      return res.status(404).json({ error: 'Not found' });
    }
    const pp = await getPublicProfileSettings(ownerId);
    if (!pp || !pp.enabled) return res.status(404).json({ error: 'Not found' });
    // costruiamo payload unificato con flag da fallback
    const out = {
      id: base.id,
      full_name: base.full_name,
      company_name: base.company_name,
      bio: base.bio,
      avatar_url: base.avatar_url,
      instagram_contact: base.instagram_contact,
      role: base.role,
      brevetto: base.brevetto,
      scadenza_brevetto: base.scadenza_brevetto,
      assicurazione: base.assicurazione,
      scadenza_assicurazione: base.scadenza_assicurazione,
      scadenza_certificato_medico: base.scadenza_certificato_medico,
  certificato_medico_tipo: base.certificato_medico_tipo,
      company_address: base.company_address,
      vat_number: base.vat_number,
      personal_best: base.personal_best || null,
      other_certifications: base.other_certifications || [],
      club_team: base.club_team || null,
      public_profile_enabled: true,
  public_slug: pp.slug || slug,
      public_show_bio: pp.show_bio !== false,
      public_show_instagram: pp.show_instagram !== false,
      public_show_company_info: pp.show_company_info !== false,
      public_show_certifications: pp.show_certifications !== false,
      public_show_events: pp.show_events !== false,
      public_show_records: pp.show_records !== false,
      public_show_personal: pp.show_personal !== false,
    };
    return res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Public: instructor events by slug
app.get('/api/instructors/slug/:slug/events', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    let ownerId = null;
    if (HAS_PUBLIC_PROFILE_FIELDS) {
      try {
        const { rows } = await pool.query(`SELECT id FROM profiles WHERE lower(public_slug) = lower($1) AND COALESCE(public_profile_enabled,false) = true LIMIT 1`, [slug]);
        if (rows[0]) ownerId = rows[0].id;
      } catch (_) {}
    }
    if (!ownerId) {
      ownerId = await getSlugOwner(slug);
    }
    if (!ownerId) return res.status(404).json({ error: 'Not found' });
    const { rows } = await pool.query(`${eventsSelect()} WHERE e.created_by = $1 ORDER BY e.date DESC NULLS LAST`, [ownerId]);
    res.json(rows);
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
  // Ensure ownership: if client didn't provide created_by, bind to current user
  if (!e.created_by && req.user?.id) {
    e.created_by = req.user.id;
  }
  // Requisiti per creare un evento: profilo pubblico abilitato e certificazioni valide (per non-admin)
  if (!req.user || req.user.role !== 'admin') {
    try {
      const { rows: profRows } = await pool.query(
        `SELECT public_profile_enabled, public_slug, phone, assicurazione, scadenza_assicurazione, scadenza_certificato_medico
         FROM profiles WHERE id = $1 LIMIT 1`,
        [req.user?.id]
      );
      const prof = profRows[0];
      if (!prof) return res.status(404).json({ error: 'Profile not found' });
      const missing = [];
      // Profilo pubblico deve essere attivo con slug assegnato
      if (!prof.public_profile_enabled) missing.push('public_profile_enabled');
      if (!prof.public_slug) missing.push('public_slug');
      const isEmpty = (v) => !v || String(v).trim() === '';
      if (isEmpty(prof.phone)) missing.push('phone');
      if (isEmpty(prof.assicurazione)) missing.push('assicurazione');
      const today = new Date();
      // Tolleranza di 1 mese: chi scade nel mese corrente può ancora operare
      const toleranceDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      const sa = prof.scadenza_assicurazione ? new Date(prof.scadenza_assicurazione) : null;
      const sc = prof.scadenza_certificato_medico ? new Date(prof.scadenza_certificato_medico) : null;
      if (!sa || isNaN(sa.getTime()) || sa < toleranceDate) missing.push('scadenza_assicurazione');
      if (!sc || isNaN(sc.getTime()) || sc < toleranceDate) missing.push('scadenza_certificato_medico');
      if (missing.length) {
        return res.status(400).json({ error: 'organizer_requirements_missing', missing });
      }
    } catch (err) {
      return res.status(500).json({ error: String(err?.message || err) });
    }
  }
  const cols = [
    'title','slug','description','date','end_date','location','participants','image_url','category_id','cost','nation','discipline','created_by','level','activity_description','language','about_us','objectives','included_in_activity','not_included_in_activity','notes','schedule_logistics','gallery_images','pdf_url','event_type','activity_details','who_we_are','fixed_appointment','fixed_appointment_text','instructors','instructor_certificates','max_participants_per_instructor','schedule_meeting_point','responsibility_waiver_accepted','privacy_accepted','whatsapp_group_url'
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
    const newEvent = rows[0];
    res.status(201).json(newEvent);

    // Async: notify newsletter subscribers about new event
    (async () => {
      try {
        const { rows: subscribers } = await pool.query(
          "SELECT email, full_name FROM profiles WHERE newsletter_new_events = true AND is_active = true AND id != $1",
          [req.user.id]
        );
        if (!subscribers.length) return;
        const eventUrl = `${PRODUCTION_BASE_URL}/${newEvent.slug || newEvent.id}`;
        for (const sub of subscribers) {
          const { subject: subj, html: htmlTpl } = await renderEmailWithTemplate(
            'newsletter_new_event', {
              full_name: sub.full_name || 'Apneista',
              event_title: newEvent.title,
              event_url: eventUrl,
              app_name: APP_NAME,
              public_base: PRODUCTION_BASE_URL,
            },
            `Nuovo evento su ${APP_NAME}: ${newEvent.title}`,
            DEFAULT_TEMPLATES.newsletter_new_event.html
          );
          await sendEmail({ to: sub.email, subject: subj, html: htmlTpl });
        }
        console.log('[newsletter] Notified', subscribers.length, 'subscribers about new event:', newEvent.title);
      } catch (e) {
        console.warn('[newsletter] Error notifying subscribers:', e?.message || e);
      }
    })();
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
    // Tolleranza di 1 mese: chi scade nel mese corrente può ancora iscriversi
    const toleranceDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    const isEmpty = (v) => !v || String(v).trim() === '';
    if (isEmpty(prof.phone)) missing.push('phone');
    if (isEmpty(prof.assicurazione)) missing.push('assicurazione');
    const sa = prof.scadenza_assicurazione ? new Date(prof.scadenza_assicurazione) : null;
    const sc = prof.scadenza_certificato_medico ? new Date(prof.scadenza_certificato_medico) : null;
    if (!sa || !(sa instanceof Date) || isNaN(sa.getTime()) || sa < toleranceDate) missing.push('scadenza_assicurazione');
    if (!sc || !(sc instanceof Date) || isNaN(sc.getTime()) || sc < toleranceDate) missing.push('scadenza_certificato_medico');
    if (missing.length) {
      return res.status(400).json({ error: 'profile_incomplete', missing });
    }
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    const { eventId, title, amount } = req.body || {};
    if (!eventId || typeof amount !== 'number') return res.status(400).json({ error: 'eventId and amount are required' });

    // Amount in cents
    const unit_amount = Math.round(amount * 100);
    const successUrl = (process.env.PUBLIC_BASE_URL || PRODUCTION_BASE_URL) + `/payments/success?eventId=${encodeURIComponent(eventId)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = (process.env.PUBLIC_BASE_URL || PRODUCTION_BASE_URL) + `/events/${encodeURIComponent(req.body.slug || '')}`;

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
    const base = process.env.PUBLIC_BASE_URL || PRODUCTION_BASE_URL;
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
// Email templates endpoints (JSON-based multilingual)
// -----------------------------
const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales', 'lang');
const SUPPORTED_LANGUAGES = ['it', 'en', 'es', 'fr', 'pl'];
const EMAIL_TEMPLATE_TYPES = ['welcome', 'password_reset', 'event_registration_user', 'event_registration_organizer', 'event_invite'];

// Helper: read locale JSON file
async function readLocaleFile(lang) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  try {
    const content = await fsp.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.warn(`[locale] Failed to read ${lang}.json:`, e?.message || e);
    return null;
  }
}

// Helper: write locale JSON file
async function writeLocaleFile(lang, data) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Get all email templates for all languages
app.get('/api/email-templates', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = {};
    for (const lang of SUPPORTED_LANGUAGES) {
      const localeData = await readLocaleFile(lang);
      if (localeData?.emails) {
        result[lang] = localeData.emails;
      }
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Get email templates for a specific language
app.get('/api/email-templates/lang/:lang', requireAuth, requireAdmin, async (req, res) => {
  const { lang } = req.params;
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    return res.status(400).json({ error: 'Unsupported language' });
  }
  try {
    const localeData = await readLocaleFile(lang);
    if (!localeData?.emails) {
      return res.status(404).json({ error: 'Email templates not found for this language' });
    }
    res.json(localeData.emails);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Update a specific email template for a specific language
app.put('/api/email-templates/lang/:lang/:type', requireAuth, requireAdmin, async (req, res) => {
  const { lang, type } = req.params;
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    return res.status(400).json({ error: 'Unsupported language' });
  }
  if (!EMAIL_TEMPLATE_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid template type' });
  }
  const templateData = req.body;
  if (!templateData || typeof templateData !== 'object') {
    return res.status(400).json({ error: 'Invalid template data' });
  }
  try {
    const localeData = await readLocaleFile(lang);
    if (!localeData) {
      return res.status(404).json({ error: 'Locale file not found' });
    }
    if (!localeData.emails) {
      localeData.emails = {};
    }
    localeData.emails[type] = templateData;
    await writeLocaleFile(lang, localeData);
    res.json({ ok: true, lang, type, template: templateData });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Get supported languages
app.get('/api/email-templates/languages', requireAuth, requireAdmin, async (_req, res) => {
  res.json(SUPPORTED_LANGUAGES);
});

// Get template types
app.get('/api/email-templates/types', requireAuth, requireAdmin, async (_req, res) => {
  res.json(EMAIL_TEMPLATE_TYPES);
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
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!HAS_ORGANIZER_REQUEST) { try { await ensureOrganizerRequestColumnsAtRuntime(); await detectSchema(); } catch (_) {} }
    const { search, page = 1, limit = 50, role: filterRole } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE 1=1';
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (full_name ILIKE $${params.length} OR email ILIKE $${params.length} OR company_name ILIKE $${params.length})`;
    }
    if (filterRole) {
      params.push(filterRole);
      where += ` AND role = $${params.length}`;
    }

    const countQuery = `SELECT COUNT(*)::int AS total FROM profiles ${where}`;
    const { rows: countRows } = await pool.query(countQuery, params);
    const total = countRows[0]?.total || 0;

    const dataParams = [...params, limitNum, offset];
    const { rows } = await pool.query(`
      SELECT id, email, created_at, organizer_upgrade_requested_at,
        full_name, role, is_active, avatar_url, company_name, vat_number, company_address
      FROM profiles
      ${where}
      ORDER BY full_name ASC NULLS LAST, email ASC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `, dataParams);
    const out = rows.map(r => ({
      id: r.id,
      email: r.email,
      created_at: r.created_at,
      organizer_upgrade_requested_at: r.organizer_upgrade_requested_at,
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
    res.json({ data: out, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.put('/api/admin/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  const { role } = req.body || {};
  if (!role) return res.status(400).json({ error: 'role is required' });
  try {
    // If upgrading to organizer roles, auto-enable public profile and generate slug
    const isOrganizer = role === 'instructor' || role === 'company' || role === 'creator';
    if (isOrganizer) {
      if (!HAS_PUBLIC_PROFILE_FIELDS) { try { await ensurePublicProfileColumnsAtRuntime(); await detectSchema(); } catch (_) {} }
      if (!HAS_ORGANIZER_REQUEST) { try { await ensureOrganizerRequestColumnsAtRuntime(); await detectSchema(); } catch (_) {} }
      // Fetch base info for slug
      const { rows: baseRows } = await pool.query(
        'SELECT email, COALESCE(NULLIF(TRIM(company_name), \'\'), NULLIF(TRIM(full_name), \'\')) AS name FROM profiles WHERE id = $1 LIMIT 1',
        [req.params.id]
      );
      if (!baseRows[0]) return res.status(404).json({ error: 'Not found' });
      const baseName = baseRows[0].name || (baseRows[0].email || '').split('@')[0] || 'organizer';
      const normalizeSlug = (raw) => raw
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[@._]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
      let candidate = normalizeSlug(baseName);
      if (!candidate) candidate = 'organizer';
      // Ensure uniqueness against lower(public_slug)
      let suffix = 0;
      while (true) {
        const trySlug = suffix === 0 ? candidate : `${candidate}-${suffix}`;
        const { rows: exist } = await pool.query(`SELECT 1 FROM profiles WHERE lower(public_slug) = lower($1) LIMIT 1`, [trySlug]);
        if (!exist[0]) { candidate = trySlug; break; }
        suffix++;
        if (suffix > 1000) { candidate = `${candidate}-${Date.now().toString().slice(-4)}`; break; }
      }
      const { rows } = await pool.query(
        `UPDATE profiles SET 
           role = $1,
           public_profile_enabled = true,
           public_slug = COALESCE(public_slug, $2),
           public_show_bio = true,
           public_show_instagram = true,
           public_show_company_info = true,
           public_show_certifications = true,
           public_show_events = true,
           public_show_records = true,
           public_show_personal = true,
           organizer_upgrade_requested_at = NULL
         WHERE id = $3
         RETURNING id, role, public_profile_enabled, public_slug`,
        [role, candidate, req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Not found' });
      return res.json(rows[0]);
    } else {
      const { rows } = await pool.query('UPDATE profiles SET role = $1 WHERE id = $2 RETURNING id, role', [role, req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Not found' });
      return res.json(rows[0]);
    }
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
  const base = process.env.PUBLIC_BASE_URL || PRODUCTION_BASE_URL;
  const link = `${base.replace(/\/$/, '')}/password-reset?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(user.email)}&type=recovery`;
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
             p.full_name, p.avatar_url, p.company_name, p.phone, p.email, p.role, p.public_profile_enabled, p.public_slug
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

// Remove a participant from an event (admin or event owner only)
app.delete('/api/events/:id/participants/:userId', requireAuth, async (req, res) => {
  const eventId = req.params.id;
  const userId = req.params.userId;
  try {
    // Authorization: only admin or event owner
    const { rows: evRows } = await pool.query('SELECT id, created_by FROM events WHERE id = $1 LIMIT 1', [eventId]);
    const ev = evRows[0];
    if (!ev) return res.status(404).json({ error: 'Event not found' });
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && (!req.user?.id || ev.created_by !== req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    // Delete registration(s) for this user in this event
    const { rowCount } = await pool.query(
      `DELETE FROM event_payments WHERE event_id = $1 AND user_id = $2 AND status = 'paid'`,
      [eventId, userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Participation not found' });
    res.status(204).end();
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

// ─────────────────────────────────────────────────────────────────────────────
// SEND EVENT INVITE EMAIL (organizer → selected users or all participants)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/events/:id/invite', requireAuth, async (req, res) => {
  const eventId = req.params.id;
  try {
    // Load event
    const { rows: evRows } = await pool.query(
      'SELECT id, title, slug, date, end_date, location, created_by FROM events WHERE id = $1 LIMIT 1',
      [eventId]
    );
    const ev = evRows[0];
    if (!ev) return res.status(404).json({ error: 'Event not found' });
    // Only owner / admin / creator
    if (ev.created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'creator') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { emails } = req.body || {};
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails array required' });
    }

    // Fetch organizer name
    const { rows: orgRows } = await pool.query('SELECT full_name FROM profiles WHERE id = $1 LIMIT 1', [ev.created_by]);
    const organizerName = orgRows[0]?.full_name || '';

    const base = process.env.PUBLIC_BASE_URL || PRODUCTION_BASE_URL;
    const safeBase = base.replace(/\/$/, '');
    const eventUrl = ev.slug ? `${safeBase}/events/${encodeURIComponent(ev.slug)}` : `${safeBase}/events/${ev.id}`;

    // Date text
    const fmt = (s) => { try { return new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return s; } };
    const dateText = ev.date ? (ev.end_date && ev.end_date !== ev.date ? `${fmt(ev.date)} – ${fmt(ev.end_date)}` : fmt(ev.date)) : '';

    let sent = 0;
    let failed = 0;
    for (const email of emails) {
      if (!email || typeof email !== 'string') { failed++; continue; }
      // Try to find user by email to personalise
      const { rows: userRows } = await pool.query('SELECT full_name FROM profiles WHERE LOWER(email) = LOWER($1) LIMIT 1', [email.trim()]);
      const fullName = userRows[0]?.full_name || '';

      try {
        const { subject, html } = await renderEmailWithTemplate(
          'event_invite',
          {
            full_name: fullName || email.split('@')[0],
            organizer_name: organizerName,
            event_title: ev.title,
            event_url: eventUrl,
            event_dates: dateText,
            event_location: ev.location || '',
            app_name: APP_NAME,
            public_base: safeBase,
          },
          `Sei stato invitato a: ${ev.title}`,
          BASE_EMAIL_TEMPLATE(
            'Invito evento',
            `<p>Ciao ${fullName || ''},</p>
             <p>Sei stato invitato all'evento <strong>${ev.title}</strong> su ${APP_NAME}.</p>
             ${dateText ? `<p><strong>Date:</strong> ${dateText}</p>` : ''}
             ${ev.location ? `<p><strong>Luogo:</strong> ${ev.location}</p>` : ''}
             <p>Non perdere l'occasione!</p>`,
            'Vai all\'evento', eventUrl
          )
        );
        const result = await sendEmail({ to: email.trim(), subject, html });
        if (result.ok) sent++;
        else failed++;
      } catch (e) {
        console.warn('[event-invite] send failed to', email, e?.message || e);
        failed++;
      }
    }

    res.json({ ok: true, sent, failed, total: emails.length });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Register to an event for free (used when EVENTS_FREE_MODE=true or event cost is 0)
app.post('/api/events/:id/register-free', requireAuth, async (req, res) => {
  const eventId = req.params.id;
  try {
    // Ensure event exists
    const { rows: evRows } = await pool.query('SELECT id, title, slug, date, end_date, location, cost, created_by, whatsapp_group_url FROM events WHERE id = $1 LIMIT 1', [eventId]);
    const ev = evRows[0];
    if (!ev) return res.status(404).json({ error: 'Event not found' });

    // If global free mode is off, allow only when event cost is null/0
    if (!EVENTS_FREE_MODE) {
      const cost = Number(ev.cost || 0);
      if (cost > 0) return res.status(400).json({ error: 'Event is not free' });
    }

    // Enforce user profile requirements before registering
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Login required' });
    }
    try {
      const { rows: profRows } = await pool.query(
        `SELECT phone, assicurazione, scadenza_assicurazione, scadenza_certificato_medico, dichiarazione_assicurazione_valida
         FROM profiles WHERE id = $1 LIMIT 1`,
        [req.user.id]
      );
      const prof = profRows[0];
      if (!prof) return res.status(404).json({ error: 'Profile not found' });
      const missing = [];
      const today = new Date();
      // Tolleranza di 1 mese: chi scade nel mese corrente può ancora iscriversi
      const toleranceDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      const isEmpty = (v) => !v || String(v).trim() === '';
      if (isEmpty(prof.phone)) missing.push('phone');
      // Assicurazione: basta la dichiarazione OPPURE i dati assicurativi completi
      const hasInsuranceDeclaration = Boolean(prof.dichiarazione_assicurazione_valida);
      const hasInsuranceData = !isEmpty(prof.assicurazione);
      const sa = prof.scadenza_assicurazione ? new Date(prof.scadenza_assicurazione) : null;
      const insuranceDateOk = sa && (sa instanceof Date) && !isNaN(sa.getTime()) && sa >= toleranceDate;
      if (!hasInsuranceDeclaration && !hasInsuranceData) missing.push('assicurazione');
      if (!hasInsuranceDeclaration && (!sa || !insuranceDateOk)) missing.push('scadenza_assicurazione');
      const sc = prof.scadenza_certificato_medico ? new Date(prof.scadenza_certificato_medico) : null;
      if (!sc || !(sc instanceof Date) || isNaN(sc.getTime()) || sc < toleranceDate) missing.push('scadenza_certificato_medico');
      if (missing.length) {
        return res.status(400).json({ error: 'profile_incomplete', missing });
      }
    } catch (e) {
      // Hard-fail if profile cannot be loaded reliably
      return res.status(500).json({ error: 'profile_check_failed' });
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
    // Fire-and-forget emails: to participant and organizer (if any)
    (async () => {
      try {
  const base = process.env.PUBLIC_BASE_URL || PRODUCTION_BASE_URL;
  const safeBase = base.replace(/\/$/, '');
  const eventUrl = ev.slug ? `${safeBase}/events/${encodeURIComponent(ev.slug)}` : safeBase;
        // Load current user profile (participant)
        const { rows: userRows } = await pool.query('SELECT email, full_name FROM profiles WHERE id = $1 LIMIT 1', [req.user.id]);
        const participant = userRows[0];
        // Build date range text if available
        const fmt = (s) => {
          try { return new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return s; }
        };
        const dateText = ev?.date ? (ev?.end_date && ev.end_date !== ev.date ? `${fmt(ev.date)} - ${fmt(ev.end_date)}` : fmt(ev.date)) : '';
        const locationText = ev?.location ? `<p><strong>Luogo:</strong> ${ev.location}</p>` : '';
        // Load organizer public profile URL
        let organizerProfileUrl = safeBase + '/contattaci';
        if (ev.created_by) {
          try {
            const { rows: orgSlugRows } = await pool.query(
              'SELECT public_slug, public_profile_enabled FROM profiles WHERE id = $1 LIMIT 1',
              [ev.created_by]
            );
            const orgSlug = orgSlugRows[0];
            if (orgSlug?.public_profile_enabled && orgSlug?.public_slug) {
              organizerProfileUrl = `${safeBase}/profile/${encodeURIComponent(orgSlug.public_slug)}`;
            }
          } catch (e) {
            console.warn('[email] Failed to load organizer slug:', e?.message || e);
          }
        }
        // Email to participant (templated)
        if (participant?.email) {
          const whatsappUrl = ev.whatsapp_group_url || '';
          const whatsappBlock = whatsappUrl
            ? `<p style="margin-top:16px;"><a href="${whatsappUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 24px;background-color:#25D366;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">📱 Gruppo WhatsApp evento</a></p>`
            : '';
          const tpl = await renderEmailWithTemplate(
            'event_registration_user',
            { full_name: participant.full_name || '', participant_email: participant.email, app_name: APP_NAME, event_title: ev.title, event_url: eventUrl, event_dates: dateText, organizer_profile_url: organizerProfileUrl, public_base: safeBase, whatsapp_group_url: whatsappUrl },
            `Iscrizione confermata: ${ev.title}`,
            `
              <p>Ciao {{full_name}},</p>
              <p>la tua iscrizione all'evento <strong>{{event_title}}</strong> è stata registrata correttamente.</p>
              {{#if event_dates}}<p><strong>Date:</strong> {{event_dates}}</p>{{/if}}
              ${whatsappBlock}
              <p>Dettagli evento: <a href="{{event_url}}">{{event_url}}</a></p>
              <p>Grazie da {{app_name}}</p>
            `
          );
          await sendEmail({ to: participant.email, subject: tpl.subject, html: tpl.html.replace(/\{#if [^}]+\}[^]*?\{\/if\}/g, (block) => { // rimuovi blocchi if custom
            if (block.includes('{{event_dates}}') && dateText) return block.replace(/\{#if[^}]+\}/, '').replace('\{/if\}', '');
            return '';
          }) });
        }
        // Email to organizer (optional)
        if (ev.created_by) {
          const { rows: orgRows } = await pool.query('SELECT email, full_name FROM profiles WHERE id = $1 LIMIT 1', [ev.created_by]);
          const org = orgRows[0];
          if (org?.email && participant?.email) {
            const tpl2 = await renderEmailWithTemplate(
              'event_registration_organizer',
              { organizer_name: org.full_name || '', participant_name: participant.full_name || participant.email, app_name: APP_NAME, event_title: ev.title, event_url: eventUrl, event_dates: dateText },
              `Nuova iscrizione all'evento: ${ev.title}`,
              `
                <p>Ciao {{organizer_name}},</p>
                <p>{{participant_name}} si è iscritto all'evento <strong>{{event_title}}</strong>.</p>
                {{#if event_dates}}<p><strong>Date:</strong> {{event_dates}}</p>{{/if}}
                <p>Dettagli evento: <a href="{{event_url}}">{{event_url}}</a></p>
              `
            );
            await sendEmail({ to: org.email, subject: tpl2.subject, html: tpl2.html.replace(/\{#if [^}]+\}[^]*?\{\/if\}/g, (block) => {
              if (block.includes('{{event_dates}}') && dateText) return block.replace(/\{#if[^}]+\}/, '').replace('\{/if\}', '');
              return '';
            }) });
          }
        }
      } catch (e) {
        console.warn('[email] register-free notifications failed:', e?.message || e);
      }
    })().catch(() => {});

    res.status(201).json({ ok: true, id: rows[0]?.id || null });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT SYSTEM API
// ─────────────────────────────────────────────────────────────────────────────

// Get all conversations for current user (grouped by person, not event)
app.get('/api/conversations', requireAuth, async (req, res) => {
  try {
    // Get unique conversations per user (pick the most recent one if multiple exist)
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (other_user_id)
        c.id,
        c.last_message_at,
        c.created_at,
        CASE 
          WHEN c.participant_1 = $1 THEN c.participant_2 
          ELSE c.participant_1 
        END as other_user_id,
        p.full_name as other_user_name,
        p.avatar_url as other_user_avatar,
        CASE WHEN p.public_profile_enabled = true THEN p.public_slug ELSE NULL END as other_user_slug,
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*)::int FROM messages m 
         JOIN conversations cc ON cc.id = m.conversation_id 
         WHERE ((cc.participant_1 = $1 AND cc.participant_2 = CASE WHEN c.participant_1 = $1 THEN c.participant_2 ELSE c.participant_1 END)
            OR (cc.participant_2 = $1 AND cc.participant_1 = CASE WHEN c.participant_1 = $1 THEN c.participant_2 ELSE c.participant_1 END))
           AND m.sender_id != $1 AND m.read_at IS NULL) as unread_count
      FROM conversations c
      JOIN profiles p ON p.id = CASE WHEN c.participant_1 = $1 THEN c.participant_2 ELSE c.participant_1 END
      WHERE (c.participant_1 = $1 OR c.participant_2 = $1)
        AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)
      ORDER BY other_user_id, c.last_message_at DESC
    `, [req.user.id]);
    
    // Sort by last_message_at descending
    rows.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
    
    res.json(rows);
  } catch (e) {
    console.error('[chat] get conversations error:', e?.message || e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Get unread messages count for current user
app.get('/api/conversations/unread-count', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*) as count
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE (c.participant_1 = $1 OR c.participant_2 = $1)
        AND m.sender_id != $1
        AND m.read_at IS NULL
    `, [req.user.id]);
    res.json({ count: parseInt(rows[0]?.count || '0', 10) });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Get or create conversation with another user (one conversation per person pair)
app.post('/api/conversations', requireAuth, async (req, res) => {
  try {
    const { otherUserId } = req.body;
    if (!otherUserId) return res.status(400).json({ error: 'otherUserId required' });
    if (otherUserId === req.user.id) return res.status(400).json({ error: 'Cannot chat with yourself' });

    // Normalize order to avoid duplicates
    const [p1, p2] = [req.user.id, otherUserId].sort();
    
    // Check if conversation already exists (ignore event_id - one chat per person)
    let { rows } = await pool.query(
      `SELECT id FROM conversations WHERE participant_1 = $1 AND participant_2 = $2 ORDER BY last_message_at DESC LIMIT 1`,
      [p1, p2]
    );
    let conversationId;
    let existing = false;
    
    if (rows.length > 0) {
      conversationId = rows[0].id;
      existing = true;
    } else {
      // Create new conversation (without event_id)
      const result = await pool.query(
        `INSERT INTO conversations (participant_1, participant_2) VALUES ($1, $2) RETURNING id`,
        [p1, p2]
      );
      conversationId = result.rows[0].id;
    }

    // Fetch other user info
    const { rows: userRows } = await pool.query(
      `SELECT full_name, avatar_url, CASE WHEN public_profile_enabled = true THEN public_slug ELSE NULL END as public_slug FROM profiles WHERE id = $1`,
      [otherUserId]
    );
    const otherUser = userRows[0] || {};

    res.status(existing ? 200 : 201).json({
      id: conversationId,
      existing,
      other_user_name: otherUser.full_name || '',
      other_user_avatar: otherUser.avatar_url || null,
      other_user_slug: otherUser.public_slug || null
    });
  } catch (e) {
    console.error('[chat] create conversation error:', e?.message || e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Get messages for a conversation (fetch from all conversations with same person)
app.get('/api/conversations/:conversationId/messages', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    // Get conversation and other user
    const { rows: convRows } = await pool.query(
      `SELECT id, participant_1, participant_2 FROM conversations WHERE id = $1 AND (participant_1 = $2 OR participant_2 = $2)`,
      [conversationId, req.user.id]
    );
    if (convRows.length === 0) return res.status(403).json({ error: 'Not a participant' });

    // Get the other user from this conversation
    const conv = convRows[0];
    const otherUserId = conv.participant_1 === req.user.id ? conv.participant_2 : conv.participant_1;

    // Get messages from ALL conversations with this person (merged chat)
    let query = `
      SELECT m.id, m.content, m.sender_id, m.read_at, m.created_at,
             p.full_name as sender_name, p.avatar_url as sender_avatar
      FROM messages m
      JOIN profiles p ON p.id = m.sender_id
      JOIN conversations c ON c.id = m.conversation_id
      WHERE ((c.participant_1 = $1 AND c.participant_2 = $2) OR (c.participant_1 = $2 AND c.participant_2 = $1))
    `;
    const params = [req.user.id, otherUserId];
    
    if (before) {
      query += ` AND m.created_at < $${params.length + 1}`;
      params.push(before);
    }
    
    query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit, 10));

    const { rows } = await pool.query(query, params);
    
    // Mark messages as read in ALL conversations with this person
    await pool.query(`
      UPDATE messages SET read_at = NOW()
      WHERE conversation_id IN (
        SELECT id FROM conversations 
        WHERE (participant_1 = $1 AND participant_2 = $2) OR (participant_1 = $2 AND participant_2 = $1)
      ) AND sender_id != $1 AND read_at IS NULL
    `, [req.user.id, otherUserId]);

    res.json(rows.reverse()); // Return in chronological order
  } catch (e) {
    console.error('[chat] get messages error:', e?.message || e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Send a message
app.post('/api/conversations/:conversationId/messages', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });

    // Verify user is participant
    const { rows: convRows } = await pool.query(
      `SELECT id, participant_1, participant_2, event_id FROM conversations WHERE id = $1 AND (participant_1 = $2 OR participant_2 = $2)`,
      [conversationId, req.user.id]
    );
    if (convRows.length === 0) return res.status(403).json({ error: 'Not a participant' });

    const conv = convRows[0];
    const otherUserId = conv.participant_1 === req.user.id ? conv.participant_2 : conv.participant_1;

    // Insert message
    const { rows } = await pool.query(`
      INSERT INTO messages (conversation_id, sender_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, content, sender_id, created_at
    `, [conversationId, req.user.id, content.trim()]);

    // Update conversation last_message_at
    await pool.query(`UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`, [conversationId]);

    // Send email notification (async, don't wait)
    pool.query(`SELECT full_name, company_name FROM profiles WHERE id = $1`, [req.user.id])
      .then(({ rows: senderRows }) => {
        const senderName = senderRows[0]?.company_name || senderRows[0]?.full_name || 'Utente';
        maybeSendChatNotificationEmail(req.user.id, otherUserId, senderName, content.trim());
      })
      .catch(() => {});

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('[chat] send message error:', e?.message || e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Mark messages as read
app.post('/api/conversations/:conversationId/read', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Verify user is participant
    const { rows: convRows } = await pool.query(
      `SELECT id FROM conversations WHERE id = $1 AND (participant_1 = $2 OR participant_2 = $2)`,
      [conversationId, req.user.id]
    );
    if (convRows.length === 0) return res.status(403).json({ error: 'Not a participant' });

    await pool.query(`
      UPDATE messages SET read_at = NOW()
      WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL
    `, [conversationId, req.user.id]);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.listen(PORT, () => {
  const base = process.env.API_PUBLIC_BASE_URL || `http://0.0.0.0:${PORT}`;
  console.log(`API listening on ${base}`);
});

// =============================================
// COMMENTS SYSTEM (Blog + Events)
// =============================================

// Helper: check if user is participant (paid), organizer or admin for an event
async function isEventParticipantOrOwner(userId, eventId, userRole) {
  if (userRole === 'admin' || userRole === 'creator') return true;
  // Organizer?
  const { rows: evRows } = await pool.query('SELECT created_by FROM events WHERE id = $1 LIMIT 1', [eventId]);
  if (evRows[0] && evRows[0].created_by === userId) return true;
  // Paid participant?
  const { rows } = await pool.query(
    "SELECT id FROM event_payments WHERE event_id = $1 AND user_id = $2 AND status = 'paid' LIMIT 1",
    [eventId, userId]
  );
  return !!rows[0];
}

// GET /api/events/:id/is-participant (auth required)
app.get('/api/events/:id/is-participant', requireAuth, async (req, res) => {
  try {
    const ok = await isEventParticipantOrOwner(req.user.id, req.params.id, req.user.role);
    res.json({ participant: ok });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// GET /api/comments?blog_id=xxx OR ?event_id=xxx
app.get('/api/comments', async (req, res) => {
  try {
    const { blog_id, event_id } = req.query;
    if (!blog_id && !event_id) return res.status(400).json({ error: 'blog_id or event_id required' });
    const col = blog_id ? 'blog_id' : 'event_id';
    const val = blog_id || event_id;
    const { rows } = await pool.query(`
      SELECT c.id, c.blog_id, c.event_id, c.author_id, c.parent_id, c.body,
             c.created_at, c.updated_at,
             p.full_name AS author_name, p.avatar_url AS author_avatar
      FROM public.comments c
      LEFT JOIN public.profiles p ON p.id = c.author_id
      WHERE c.${col} = $1
      ORDER BY c.created_at ASC
    `, [val]);
    res.json(rows);
  } catch (e) {
    // If table doesn't exist yet, return empty array instead of 500
    if (String(e?.message || '').includes('relation') && String(e?.message || '').includes('does not exist')) {
      return res.json([]);
    }
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// POST /api/comments
app.post('/api/comments', requireAuth, async (req, res) => {
  try {
    const { blog_id, event_id, parent_id, body } = req.body;
    if (!body || (!blog_id && !event_id)) return res.status(400).json({ error: 'body and blog_id or event_id required' });
    // For event comments: any authenticated user can comment
    const { rows } = await pool.query(`
      INSERT INTO public.comments (blog_id, event_id, author_id, parent_id, body)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [blog_id || null, event_id || null, req.user.id, parent_id || null, body.trim()]);
    // Join author info
    const comment = rows[0];
    const { rows: pRows } = await pool.query('SELECT full_name, avatar_url FROM profiles WHERE id = $1', [req.user.id]);
    comment.author_name = pRows[0]?.full_name;
    comment.author_avatar = pRows[0]?.avatar_url;
    res.status(201).json(comment);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// DELETE /api/comments/:id (author or admin)
app.delete('/api/comments/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT author_id FROM public.comments WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Comment not found' });
    if (rows[0].author_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'creator') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM public.comments WHERE id = $1', [id]);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// =============================================
// EVENT MEDIA (Photos/Videos by participants)
// =============================================

// GET /api/events/:id/media
app.get('/api/events/:id/media', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT m.id, m.url, m.media_type, m.caption, m.created_at,
             m.uploader_id, p.full_name AS uploader_name, p.avatar_url AS uploader_avatar
      FROM public.event_media m
      LEFT JOIN public.profiles p ON p.id = m.uploader_id
      WHERE m.event_id = $1
      ORDER BY m.created_at DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (e) {
    // If table doesn't exist yet, return empty array instead of 500
    if (String(e?.message || '').includes('relation') && String(e?.message || '').includes('does not exist')) {
      return res.json([]);
    }
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// POST /api/events/:id/media (auth required - participants only)
app.post('/api/events/:id/media', requireAuth, handleMulterErrors(upload.single('file')), async (req, res) => {
  try {
    const eventId = req.params.id;
    // Only participants, organizer or admin can upload media
    const allowed = await isEventParticipantOrOwner(req.user.id, eventId, req.user.role);
    if (!allowed) return res.status(403).json({ error: 'Solo i partecipanti iscritti possono caricare media' });
    const { caption, media_type } = req.body;
    if (!req.file) return res.status(400).json({ error: 'File required' });

    // Upload file using STORAGE_DRIVER (same logic as /api/upload)
    const ext = req.file.originalname ? path.extname(req.file.originalname) : '';
    const mediaName = `event-media-${eventId}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const driver = STORAGE_DRIVER;
    let fileUrl;

    const sftpConfigMissing = (
      driver === 'sftp' && (
        !process.env.SFTP_HOST ||
        !(process.env.SFTP_USERNAME || process.env.SFTP_USER) ||
        !(process.env.SFTP_PASSWORD || process.env.SFTP_PASS)
      )
    );

    if (driver === 's3') {
      if (!S3Client || !PutObjectCommand) return res.status(500).json({ error: 'S3 client not installed.' });
      const region = process.env.S3_REGION || 'auto';
      const endpoint = process.env.S3_ENDPOINT || undefined;
      const bucket = process.env.S3_BUCKET;
      const accessKeyId = process.env.S3_ACCESS_KEY_ID;
      const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
      const publicBase = process.env.S3_PUBLIC_BASE_URL;
      if (!bucket || !accessKeyId || !secretAccessKey || !publicBase) return res.status(500).json({ error: 'S3 config missing' });
      const s3 = new S3Client({ region, endpoint, forcePathStyle: !!endpoint, credentials: { accessKeyId, secretAccessKey } });
      const key = `uploads/${mediaName}`;
      const contentType = req.file.mimetype || 'application/octet-stream';
      const putParams = { Bucket: bucket, Key: key, Body: req.file.buffer, ContentType: contentType };
      if (process.env.S3_ACL) putParams.ACL = process.env.S3_ACL;
      await s3.send(new PutObjectCommand(putParams));
      fileUrl = `${publicBase.replace(/\/$/, '')}/${key}`;
    } else if (driver === 'sftp' && !sftpConfigMissing) {
      let SFTPClient;
      try { SFTPClient = require('ssh2-sftp-client'); } catch (e) {
        return res.status(500).json({ error: 'SFTP client not installed.' });
      }
      const sftpHost = process.env.SFTP_HOST;
      const sftpPort = Number(process.env.SFTP_PORT || 22);
      const sftpUser = process.env.SFTP_USERNAME || process.env.SFTP_USER;
      const sftpPass = process.env.SFTP_PASSWORD || process.env.SFTP_PASS;
      const sftpBaseDir = process.env.SFTP_BASE_DIR || '/weapnea/uploads';
      const publicBaseEnv = process.env.SFTP_PUBLIC_BASE_URL;
      const publicDomain = process.env.SFTP_PUBLIC_DOMAIN || sftpHost;
      const remoteRoot = process.env.SFTP_REMOTE_ROOT || '/weapnea';
      const remoteDir = sftpBaseDir.replace(/\/$/, '');
      const remotePath = `${remoteDir}/${mediaName}`;
      const sftp = new SFTPClient();
      try {
        await sftp.connect({ host: sftpHost, port: sftpPort, username: sftpUser, password: sftpPass });
        const dirExists = await sftp.exists(remoteDir);
        if (!dirExists) {
          await sftp.mkdir(remoteDir, true);
          if (process.env.SFTP_CHMOD_DIRS) {
            try { await sftp.chmod(remoteDir, process.env.SFTP_CHMOD_DIRS); } catch (e) { console.warn('[sftp] chmod dir failed', e?.message); }
          }
        }
        await sftp.put(req.file.buffer, remotePath);
        if (process.env.SFTP_CHMOD_FILES) {
          try { await sftp.chmod(remotePath, process.env.SFTP_CHMOD_FILES); } catch (e) { console.warn('[sftp] chmod file failed', e?.message); }
        }
      } catch (err) {
        try { await sftp.end(); } catch {}
        return res.status(500).json({ error: `SFTP upload failed: ${String(err?.message || err)}` });
      }
      try { await sftp.end(); } catch {}
      let deducedBasePath = '/uploads';
      if (sftpBaseDir.startsWith(remoteRoot)) {
        deducedBasePath = sftpBaseDir.slice(remoteRoot.length);
        if (!deducedBasePath.startsWith('/')) deducedBasePath = `/${deducedBasePath}`;
      }
      const computedBase = `https://${publicDomain}${deducedBasePath}`;
      const finalBase = (publicBaseEnv || computedBase).replace(/\/$/, '');
      fileUrl = `${finalBase}/${mediaName}`;
    } else {
      // LOCAL storage fallback
      const dest = path.join(UPLOADS_DIR, mediaName);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.writeFile(dest, req.file.buffer);
      const baseUrl = getApiPublicBase(req);
      fileUrl = `${baseUrl}/public/uploads/${mediaName}`;
    }

    const { rows } = await pool.query(`
      INSERT INTO public.event_media (event_id, uploader_id, url, media_type, caption)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [eventId, req.user.id, fileUrl, media_type || 'image', caption || null]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// DELETE /api/events/:id/media/:mediaId
app.delete('/api/events/:id/media/:mediaId', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT uploader_id FROM public.event_media WHERE id = $1 AND event_id = $2', [req.params.mediaId, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    // Only uploader, event owner or admin can delete
    const isOwner = rows[0].uploader_id === req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'creator';
    if (!isOwner && !isAdmin) {
      const { rows: ev } = await pool.query('SELECT created_by FROM events WHERE id = $1', [req.params.id]);
      if (!ev[0] || ev[0].created_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM public.event_media WHERE id = $1', [req.params.mediaId]);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// =============================================
// EXTERNAL PARTICIPANTS (added by organizer)
// =============================================

// GET /api/events/:id/external-participants
app.get('/api/events/:id/external-participants', requireAuth, async (req, res) => {
  try {
    const eventId = req.params.id;
    // Only event owner or admin
    const { rows: ev } = await pool.query('SELECT created_by FROM events WHERE id = $1', [eventId]);
    if (!ev[0]) return res.status(404).json({ error: 'Event not found' });
    if (ev[0].created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'creator') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { rows } = await pool.query(
      'SELECT * FROM public.external_participants WHERE event_id = $1 ORDER BY created_at ASC',
      [eventId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// POST /api/events/:id/external-participants
app.post('/api/events/:id/external-participants', requireAuth, async (req, res) => {
  try {
    const eventId = req.params.id;
    const { full_name, email, phone, notes } = req.body;
    if (!full_name) return res.status(400).json({ error: 'full_name required' });
    // Only event owner or admin
    const { rows: ev } = await pool.query('SELECT created_by, title, slug FROM events WHERE id = $1', [eventId]);
    if (!ev[0]) return res.status(404).json({ error: 'Event not found' });
    if (ev[0].created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'creator') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { rows } = await pool.query(`
      INSERT INTO public.external_participants (event_id, added_by, full_name, email, phone, notes, invited_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [eventId, req.user.id, full_name, email || null, phone || null, notes || null, email ? new Date() : null]);

    // If email provided, send invite email
    if (email) {
      const eventUrl = `${PRODUCTION_BASE_URL}/${ev[0].slug || eventId}`;
      const { subject: subj, html: htmlTpl } = await renderEmailWithTemplate(
        'event_invite_external', {
          full_name,
          event_title: ev[0].title,
          event_url: eventUrl,
          app_name: APP_NAME,
          public_base: PRODUCTION_BASE_URL,
        },
        `Sei stato invitato all'evento: ${ev[0].title}`,
        BASE_EMAIL_TEMPLATE(
          'Invito evento',
          `<p>Ciao ${full_name},</p>
           <p>Sei stato invitato all'evento <strong>${ev[0].title}</strong> su ${APP_NAME}.</p>
           <p>Registrati sulla piattaforma per partecipare!</p>`,
          'Vai all\'evento', eventUrl
        )
      );
      sendEmail({ to: email, subject: subj, html: htmlTpl }).catch(() => {});
    }

    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// DELETE /api/events/:id/external-participants/:extId
app.delete('/api/events/:id/external-participants/:extId', requireAuth, async (req, res) => {
  try {
    const { rows: ev } = await pool.query('SELECT created_by FROM events WHERE id = $1', [req.params.id]);
    if (!ev[0]) return res.status(404).json({ error: 'Event not found' });
    if (ev[0].created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'creator') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM public.external_participants WHERE id = $1 AND event_id = $2', [req.params.extId, req.params.id]);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// =============================================
// NEWSLETTER TOGGLE (profile preference)
// =============================================

// GET /api/profile/newsletter
app.get('/api/profile/newsletter', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT newsletter_new_events FROM profiles WHERE id = $1', [req.user.id]);
    res.json({ newsletter_new_events: rows[0]?.newsletter_new_events ?? false });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// PUT /api/profile/newsletter
app.put('/api/profile/newsletter', requireAuth, async (req, res) => {
  try {
    const { newsletter_new_events } = req.body;
    await pool.query('UPDATE profiles SET newsletter_new_events = $1 WHERE id = $2', [!!newsletter_new_events, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// POST /api/newsletter/send (admin only - send newsletter to subscribers)
app.post('/api/newsletter/send', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { subject, html, target_role } = req.body;
    if (!subject || !html) return res.status(400).json({ error: 'subject and html required' });
    let query = 'SELECT email, full_name FROM profiles WHERE newsletter_new_events = true AND is_active = true';
    const params = [];
    if (target_role) {
      query += ' AND role = $1';
      params.push(target_role);
    }
    const { rows: subscribers } = await pool.query(query, params);
    let sent = 0, failed = 0;
    for (const sub of subscribers) {
      const personalizedHtml = html.replace(/\{\{full_name\}\}/g, sub.full_name || 'Utente');
      const result = await sendEmail({ to: sub.email, subject, html: personalizedHtml });
      if (result.ok || result.skipped) sent++; else failed++;
    }
    res.json({ sent, failed, total: subscribers.length });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// =============================================
// AUTO FEEDBACK EMAIL (cron-like, runs every hour)
// =============================================
async function checkAndSendFeedbackEmails() {
  try {
    // Find events that ended between 24h and 72h ago and haven't been sent feedback yet
    const { rows: events } = await pool.query(`
      SELECT e.id, e.title, e.slug, e.end_date, e.date
      FROM events e
      WHERE COALESCE(e.end_date, e.date) < NOW() - INTERVAL '24 hours'
        AND COALESCE(e.end_date, e.date) > NOW() - INTERVAL '72 hours'
        AND e.id NOT IN (SELECT DISTINCT event_id FROM event_feedback_emails)
    `);
    if (!events.length) return;
    console.log('[feedback] Found', events.length, 'events needing feedback emails');

    for (const ev of events) {
      // Get paid participants
      const { rows: participants } = await pool.query(`
        SELECT ep.user_id, p.email, p.full_name
        FROM event_payments ep
        JOIN profiles p ON p.id = ep.user_id
        WHERE ep.event_id = $1 AND ep.status = 'paid'
      `, [ev.id]);

      for (const part of participants) {
        // Check if already sent
        const { rows: existing } = await pool.query(
          'SELECT id FROM event_feedback_emails WHERE event_id = $1 AND user_id = $2',
          [ev.id, part.user_id]
        );
        if (existing.length > 0) continue;

        const eventUrl = `${PRODUCTION_BASE_URL}/${ev.slug || ev.id}`;
        const { subject: subj, html: htmlTpl } = await renderEmailWithTemplate(
          'event_feedback', {
            full_name: part.full_name || 'Apneista',
            event_title: ev.title,
            event_url: eventUrl,
            app_name: APP_NAME,
            public_base: PRODUCTION_BASE_URL,
          },
          `Com'è andato "${ev.title}"?`,
          BASE_EMAIL_TEMPLATE(
            'Racconta la tua esperienza',
            `<p>Ciao ${part.full_name || 'Apneista'},</p>
             <p>Speriamo che tu abbia apprezzato l'evento <strong>${ev.title}</strong>!</p>
             <p>Ti va di condividere la tua esperienza? Il tuo feedback aiuta la community e gli organizzatori a migliorare.</p>`,
            'Lascia un commento', eventUrl
          )
        );
        const result = await sendEmail({ to: part.email, subject: subj, html: htmlTpl });
        if (result.ok || result.skipped) {
          await pool.query(
            'INSERT INTO event_feedback_emails (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [ev.id, part.user_id]
          );
        }
      }
    }
  } catch (e) {
    console.warn('[feedback] Error checking feedback emails:', e?.message || e);
  }
}

// Run feedback check every hour
setInterval(checkAndSendFeedbackEmails, 60 * 60 * 1000);
// Also run once 30s after startup
setTimeout(checkAndSendFeedbackEmails, 30000);

// =============================================
// SEO META (used by Vercel middleware for bot prerendering)
// =============================================
const SUPPORTED_LANGS = ['it', 'en', 'es', 'fr', 'pl', 'ru'];
const DEFAULT_META_BY_LANG = {
  it: { title: 'WeApnea – Community Apnea & Freediving', description: 'La community italiana per apneisti e freediver. Scopri eventi, corsi e allenamenti di apnea.' },
  en: { title: 'WeApnea – Apnea & Freediving Community', description: 'The international community for freedivers. Discover events, courses and training.' },
  es: { title: 'WeApnea – Comunidad de Apnea y Freediving', description: 'La comunidad internacional para apneístas. Descubre eventos, cursos y entrenamientos.' },
  fr: { title: 'WeApnea – Communauté Apnée & Freediving', description: 'La communauté internationale pour les apnéistes. Découvrez événements, cours et entraînements.' },
  pl: { title: 'WeApnea – Społeczność Apnei i Freedivingu', description: 'Międzynarodowa społeczność dla nurków bezdechu. Odkryj wydarzenia, kursy i treningi.' },
  ru: { title: 'WeApnea – Сообщество Фридайвинга', description: 'Международное сообщество для фридайверов. Находите события, курсы и тренировки.' },
};

function resolveLang(acceptLangHeader) {
  if (!acceptLangHeader) return 'it';
  const langs = acceptLangHeader.split(',')
    .map(l => l.split(';')[0].trim().toLowerCase().slice(0, 2));
  for (const l of langs) {
    if (SUPPORTED_LANGS.includes(l)) return l;
  }
  return 'it';
}

app.get('/api/seo-meta', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=120');
  const rawPath = String(req.query.path || '/');
  const langParam = String(req.query.lang || '');
  const lang = SUPPORTED_LANGS.includes(langParam) ? langParam : resolveLang(req.headers['accept-language']);
  const base = process.env.PUBLIC_BASE_URL || 'https://www.weapnea.com';
  const langDefaults = DEFAULT_META_BY_LANG[lang] || DEFAULT_META_BY_LANG['it'];
  const defaultMeta = {
    title: langDefaults.title,
    description: langDefaults.description,
    image: `${base}/images/weapnea-logo.png`,
    url: `${base}${rawPath}`,
    type: 'website',
    lang,
  };

  try {
    // 1) Check custom SEO settings from DB (static pages configured in admin)
    const { rows: dbRows } = await pool.query(
      `SELECT title, description, og_image, translations FROM public.seo_settings WHERE path = $1 LIMIT 1`,
      [rawPath]
    );
    if (dbRows[0]) {
      const s = dbRows[0];
      const tr = (s.translations && typeof s.translations === 'object') ? s.translations : {};
      const langData = tr[lang] || {};
      return res.json({
        ...defaultMeta,
        title: langData.title || s.title || defaultMeta.title,
        description: langData.description || s.description || defaultMeta.description,
        image: s.og_image || defaultMeta.image,
        url: `${base}${rawPath}`,
      });
    }

    // 2) /blog/:slug
    const blogMatch = rawPath.match(/^\/blog\/([^/?#]+)/);
    if (blogMatch) {
      const slug = blogMatch[1];
      const { rows } = await pool.query(
        `SELECT title, excerpt, cover_image_url FROM blog_posts WHERE slug = $1 AND published = true LIMIT 1`,
        [slug]
      );
      if (rows[0]) {
        const p = rows[0];
        return res.json({
          ...defaultMeta,
          title: `${p.title} | WeApnea`,
          description: p.excerpt || defaultMeta.description,
          image: p.cover_image_url || defaultMeta.image,
          url: `${base}${rawPath}`,
          type: 'article',
        });
      }
    }

    // 3) /profile/:slug
    const profileMatch = rawPath.match(/^\/profile\/([^/?#]+)/);
    if (profileMatch) {
      const slug = profileMatch[1];
      const { rows } = await pool.query(
        `SELECT full_name, bio, avatar_url FROM profiles WHERE public_slug = $1 AND public_profile_enabled = true LIMIT 1`,
        [slug]
      );
      if (rows[0]) {
        const p = rows[0];
        return res.json({
          ...defaultMeta,
          title: `${p.full_name} | WeApnea`,
          description: p.bio ? p.bio.slice(0, 160) : `Profilo istruttore di apnea su WeApnea.`,
          image: p.avatar_url || defaultMeta.image,
          url: `${base}${rawPath}`,
          type: 'profile',
        });
      }
    }

    // 4) /:slug (event)
    const eventSlug = rawPath.replace(/^\//, '');
    if (eventSlug && !eventSlug.includes('/')) {
      const { rows } = await pool.query(
        `SELECT title, description, cover_image_url, date, location FROM events WHERE slug = $1 LIMIT 1`,
        [eventSlug]
      );
      if (rows[0]) {
        const ev = rows[0];
        const dateStr = ev.date ? new Date(ev.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
        const desc = ev.description
          ? ev.description.replace(/<[^>]+>/g, '').slice(0, 160)
          : `Evento di apnea${dateStr ? ` – ${dateStr}` : ''}${ev.location ? ` a ${ev.location}` : ''} su WeApnea.`;
        return res.json({
          ...defaultMeta,
          title: `${ev.title} | WeApnea`,
          description: desc,
          image: ev.cover_image_url || defaultMeta.image,
          url: `${base}${rawPath}`,
          type: 'event',
        });
      }
    }

    return res.json(defaultMeta);
  } catch (e) {
    return res.json(defaultMeta);
  }
});

// =============================================
// SITE CONFIG (GTM / GA4 / GSC) — PUBLIC + ADMIN
// =============================================

app.get('/api/public/site-config', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT gtm_id, ga4_id, gsc_verification FROM public.site_config WHERE id = 1 LIMIT 1');
    res.json(rows[0] || {});
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/admin/site-config', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT gtm_id, ga4_id, gsc_verification, updated_at FROM public.site_config WHERE id = 1 LIMIT 1');
    res.json(rows[0] || {});
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.put('/api/admin/site-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { gtm_id, ga4_id, gsc_verification } = req.body;
    const { rows } = await pool.query(
      `UPDATE public.site_config SET gtm_id = $1, ga4_id = $2, gsc_verification = $3, updated_at = now() WHERE id = 1 RETURNING *`,
      [gtm_id || null, ga4_id || null, gsc_verification || null]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// =============================================
// PUBLIC SEO SETTINGS ENDPOINT
// =============================================

// GET /api/public/seo-settings — returns all static page SEO data (no auth needed, used by frontend)
app.get('/api/public/seo-settings', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT path, title, description, og_image, translations FROM public.seo_settings ORDER BY path ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// =============================================
// ADMIN SEO SETTINGS ENDPOINTS
// =============================================

// GET /api/admin/seo-settings — list all configured pages
app.get('/api/admin/seo-settings', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT path, title, description, og_image, translations, updated_at FROM public.seo_settings ORDER BY path ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// PUT /api/admin/seo-settings — upsert SEO settings for a page
app.put('/api/admin/seo-settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { path: pagePath, title, description, og_image, translations } = req.body;
    if (!pagePath) return res.status(400).json({ error: 'path is required' });
    const { rows } = await pool.query(
      `INSERT INTO public.seo_settings (path, title, description, og_image, translations, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (path) DO UPDATE SET title = $2, description = $3, og_image = $4, translations = $5, updated_at = now()
       RETURNING *`,
      [pagePath, title || null, description || null, og_image || null, JSON.stringify(translations || {})]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// =============================================
// DYNAMIC SITEMAP
// =============================================
app.get('/sitemap.xml', async (_req, res) => {
  try {
    const base = PRODUCTION_BASE_URL;
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    const staticPages = ['/', '/eventi-imminenti', '/chi-siamo', '/contattaci', '/blog', '/forum', '/privacy-policy', '/cookie-policy'];
    for (const p of staticPages) {
      xml += `  <url><loc>${base}${p}</loc><changefreq>weekly</changefreq><priority>${p === '/' ? '1.0' : '0.7'}</priority></url>\n`;
    }

    // Events
    const { rows: events } = await pool.query("SELECT slug, date FROM events ORDER BY date DESC LIMIT 500");
    for (const ev of events) {
      if (ev.slug) {
        xml += `  <url><loc>${base}/${ev.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
      }
    }

    // Blog posts
    const { rows: posts } = await pool.query("SELECT slug, created_at FROM blog_posts WHERE published = true ORDER BY created_at DESC LIMIT 500");
    for (const p of posts) {
      if (p.slug) {
        xml += `  <url><loc>${base}/blog/${p.slug}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
      }
    }

    // Public profiles
    const { rows: profiles } = await pool.query("SELECT public_slug FROM profiles WHERE public_profile_enabled = true AND public_slug IS NOT NULL AND public_slug != ''");
    for (const p of profiles) {
      xml += `  <url><loc>${base}/profile/${p.public_slug}</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;
    }

    xml += '</urlset>';
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (e) {
    res.status(500).send('Error generating sitemap');
  }
});
