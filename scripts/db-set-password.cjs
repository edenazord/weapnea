const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) { console.error('POSTGRES_URL non impostata'); process.exit(1); }
  const password = process.env.PASSWORD || 'weapena';
  const hash = await bcrypt.hash(password, 10);

  const client = new Client({ connectionString: conn, ssl: false });
  await client.connect();
  try {
    const res = await client.query('UPDATE public.profiles SET password_hash = $1 WHERE email IS NOT NULL', [hash]);
    console.log(JSON.stringify({ updated: res.rowCount, passwordSet: (password ? true : false) }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e)=>{ console.error(e.message || e); process.exit(1); });
