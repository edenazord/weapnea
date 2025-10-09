const fs = require('fs');
const path = require('path');
// Load .env if present
try { require('dotenv').config(); } catch (e) {}
const { Client } = require('pg');

async function run() {
  let conn = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.RENDER_EXTERNAL_DB_URL;
  // Fallback di sviluppo (coerente con start-api.ps1)
  if (!conn) {
    conn = 'postgres://postgres:dev@127.0.0.1:5434/postgres';
    console.warn('POSTGRES_URL non impostata, uso fallback di sviluppo:', conn);
  }
  const shouldSSL = (
    process.env.DB_SSL === 'true' ||
    process.env.PGSSLMODE === 'require' ||
    (conn && /(?:^|[?&])sslmode=require(?:&|$)/i.test(conn))
  );
  const client = new Client({
    connectionString: conn,
    ssl: shouldSSL ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  // Directory delle migrazioni: per default usa scripts/migrations (se presente),
  // altrimenti consente di specificare MIGRATIONS_DIR o un singolo file via MIGRATION_FILE
  const defaultDir = path.join(__dirname, 'migrations');
  const envDir = process.env.MIGRATIONS_DIR;
  const dir = envDir ? path.resolve(envDir) : defaultDir;
  const single = process.env.MIGRATION_FILE;
  let files;
  if (single) {
    files = [single];
  } else if (fs.existsSync(dir)) {
    files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));
  } else {
    console.warn('Nessuna directory migrazioni trovata. Imposta MIGRATIONS_DIR o MIGRATION_FILE.');
    files = [];
  }

  // Create a simple migrations table if not exists
  await client.query(`CREATE TABLE IF NOT EXISTS public._migrations (
    id SERIAL PRIMARY KEY,
    filename TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const { rows } = await client.query('SELECT filename FROM public._migrations');
  const done = new Set(rows.map(r => r.filename));

  for (const f of files) {
    const fname = path.basename(f);
    if (done.has(fname)) continue;
    const full = path.isAbsolute(f) ? f : path.join(dir, f);
    const sql = fs.readFileSync(full, 'utf8');
    console.log('Applying migration:', fname);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO public._migrations(filename) VALUES($1)', [fname]);
      await client.query('COMMIT');
      console.log('✓', fname);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Errore in migrazione', fname, e.message);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log('Migrazioni applicate.');
}

run().catch(e => { console.error(e); process.exit(1); });
