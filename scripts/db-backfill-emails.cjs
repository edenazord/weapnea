const { Client } = require('pg');

async function main() {
  const conn = process.env.POSTGRES_URL;
  if (!conn) {
    console.error('POSTGRES_URL non impostata');
    process.exit(1);
  }
  const client = new Client({ connectionString: conn, ssl: false });
  await client.connect();
  try {
    const { rows: exists } = await client.query(
      "SELECT to_regnamespace('auth') IS NOT NULL AND to_regclass('auth.users') IS NOT NULL AS ok"
    );
    if (!exists[0] || !exists[0].ok) {
      console.error('Tabella auth.users non trovata: impossibile backfillare email automaticamente.');
      process.exit(2);
    }
    const res = await client.query(
      `UPDATE public.profiles p
       SET email = u.email
       FROM auth.users u
       WHERE p.id = u.id AND p.email IS NULL`
    );
    console.log(JSON.stringify({ updated: res.rowCount }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
