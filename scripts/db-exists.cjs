const { Client } = require('pg');

async function main() {
  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) {
    console.error('POSTGRES_URL non impostata');
    process.exit(1);
  }
  const client = new Client({ connectionString: conn, ssl: false });
  await client.connect();
  const { rows } = await client.query("select to_regclass('public.password_resets') as t");
  console.log(rows[0]);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });