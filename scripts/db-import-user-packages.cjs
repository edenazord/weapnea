const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const file = path.join(__dirname, '..', 'public', 'mock-data', 'user-packages.json');
  if (!fs.existsSync(file)) { console.error('File non trovato:', file); process.exit(1); }

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) { console.error('JSON non è un array'); process.exit(1); }

  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) { console.error('POSTGRES_URL non impostata'); process.exit(1); }
  const shouldSSL = (
    process.env.DB_SSL === 'true' ||
    process.env.PGSSLMODE === 'require' ||
    (conn && /(?:^|[?&])sslmode=require(?:&|$)/i.test(conn))
  );
  const client = new Client({ connectionString: conn, ssl: shouldSSL ? { rejectUnauthorized: false } : false });
  await client.connect();

  let imported = 0;
  for (const p of data) {
    const r = await client.query(`
      INSERT INTO public.user_packages
        (id, user_id, package_type, package_id, package_name, status, starts_at, expires_at, created_at, updated_at)
      VALUES
        ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, COALESCE($9, now()), COALESCE($10, now()))
      ON CONFLICT (user_id, package_type) DO UPDATE SET
        package_id = EXCLUDED.package_id,
        package_name = EXCLUDED.package_name,
        status = EXCLUDED.status,
        starts_at = EXCLUDED.starts_at,
        expires_at = EXCLUDED.expires_at,
        updated_at = now()
      RETURNING id
    `, [p.id, p.user_id, p.package_type, p.package_id, p.package_name, p.status || 'active', p.starts_at, p.expires_at, p.created_at, p.updated_at]);
    if (r.rowCount) imported++;
  }

  console.log('Import completato. user_packages:', imported);
  await client.end();
}

main().catch((e)=>{ console.error(e.message || e); process.exit(1); });
