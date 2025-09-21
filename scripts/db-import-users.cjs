const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return []; }
}

async function main() {
  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) { console.error('POSTGRES_URL non impostata'); process.exit(1); }
  const shouldSSL = (
    process.env.DB_SSL === 'true' ||
    process.env.PGSSLMODE === 'require' ||
    (conn && /(?:^|[?&])sslmode=require(?:&|$)/i.test(conn))
  );
  const client = new Client({ connectionString: conn, ssl: shouldSSL ? { rejectUnauthorized: false } : false });
  await client.connect();

  const file = path.join(__dirname, '..', 'public', 'mock-data', 'users.json');
  if (!fs.existsSync(file)) { console.error('File users.json non trovato'); process.exit(1); }
  const users = readJson(file);

  try {
    await client.query('BEGIN');
    for (const u of users) {
      const cols = ['id','email','full_name','role','is_active','password_hash'];
      const placeholders = cols.map((_,i)=>`$${i+1}`).join(',');
      const vals = cols.map(k => u[k] ?? null);
      await client.query(
        `INSERT INTO public.profiles(${cols.join(',')}) VALUES(${placeholders})
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = EXCLUDED.role,
           is_active = EXCLUDED.is_active, password_hash = COALESCE(EXCLUDED.password_hash, public.profiles.password_hash),
           updated_at = now()`,
        vals
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }

  console.log(JSON.stringify({ imported: users.length }, null, 2));
}

main().catch((e)=>{ console.error(e.message || e); process.exit(1); });
