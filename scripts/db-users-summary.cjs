const { Client } = require('pg');

async function main() {
  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) {
    console.error('POSTGRES_URL non impostata');
    process.exit(1);
  }
  const client = new Client({ connectionString: conn, ssl: false });
  await client.connect();

  const summary = await client.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE email IS NOT NULL)::int AS with_email,
            count(*) FILTER (WHERE password_hash IS NOT NULL)::int AS with_password
     FROM public.profiles`
  );

  const sample = await client.query(
    `SELECT id::text AS id, email, is_active,
            (password_hash IS NOT NULL) AS has_password
     FROM public.profiles
     ORDER BY updated_at DESC NULLS LAST, id DESC
     LIMIT 10`
  );

  await client.end();
  console.log(JSON.stringify({ summary: summary.rows[0], sample: sample.rows }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
