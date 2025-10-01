const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const repoMigrations = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
    : [];

  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) {
    console.error('POSTGRES_URL non impostata');
    process.exit(1);
  }
  const shouldSSL = (
    process.env.DB_SSL === 'true' ||
    process.env.PGSSLMODE === 'require' ||
    (conn && /(?:^|[?&])sslmode=require(?:&|$)/i.test(conn))
  );
  const client = new Client({ connectionString: conn, ssl: shouldSSL ? { rejectUnauthorized: false } : false });
  await client.connect();

  // Migrations table
  const hasMigTable = await client.query("SELECT to_regclass('public._migrations') AS t");
  let dbMigrations = [];
  if (hasMigTable.rows[0].t) {
    const { rows } = await client.query('SELECT filename FROM public._migrations ORDER BY filename');
    dbMigrations = rows.map(r => r.filename);
  }

  const pending = repoMigrations.filter(f => !dbMigrations.includes(f));

  // Schema checks (tabelle/colonne chiave)
  async function existsTable(t) {
    const r = await client.query('SELECT to_regclass($1) AS t', [t]);
    return !!r.rows[0].t;
  }
  async function columnType(tbl, col) {
    const r = await client.query(`SELECT data_type, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [tbl, col]);
    if (!r.rowCount) return null;
    const row = r.rows[0];
    return row.udt_name || row.data_type;
  }

  const checks = [];
  const mustTables = [
    'profiles','password_resets','categories','events','blog_articles',
    'forum_categories','forum_topics','forum_replies','languages','translations','email_templates',
    'event_payments','event_wishlist','user_packages'
  ];
  for (const t of mustTables) {
    const ok = await existsTable(`public.${t}`);
    checks.push({ table: t, exists: ok });
  }

  // Specifiche colonne/Tipi attesi
  const columns = [];
  columns.push({ table: 'profiles', column: 'personal_best', type: await columnType('profiles','personal_best') });
  columns.push({ table: 'categories', column: 'id', type: await columnType('categories','id') });
  columns.push({ table: 'events', column: 'category_id', type: await columnType('events','category_id') });
  columns.push({ table: 'forum_categories', column: 'id', type: await columnType('forum_categories','id') });
  columns.push({ table: 'forum_topics', column: 'category_id', type: await columnType('forum_topics','category_id') });

  await client.end();

  const out = {
    repoMigrations,
    dbMigrations,
    pendingMigrations: pending,
    schema: {
      tables: checks,
      columns
    }
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
