const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const outDir = path.join(__dirname, '..', 'public', 'mock-data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) { console.error('POSTGRES_URL non impostata'); process.exit(1); }
  const shouldSSL = (
    process.env.DB_SSL === 'true' ||
    process.env.PGSSLMODE === 'require' ||
    (conn && /(?:^|[?&])sslmode=require(?:&|$)/i.test(conn))
  );
  const client = new Client({ connectionString: conn, ssl: shouldSSL ? { rejectUnauthorized: false } : false });
  await client.connect();

  const { rows } = await client.query(`
    SELECT 
      id::text,
      user_id::text,
      package_type,
      package_id,
      package_name,
      status,
      starts_at,
      expires_at,
      created_at,
      updated_at
    FROM public.user_packages
    ORDER BY created_at ASC
  `);

  const file = path.join(outDir, 'user-packages.json');
  fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8');
  console.log('Scritto', path.relative(process.cwd(), file), `(${rows.length} record)`);

  await client.end();
}

main().catch((e)=>{ console.error(e.message || e); process.exit(1); });
