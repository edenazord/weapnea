const { Client } = require('pg');

async function main() {
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) {
    console.error('POSTGRES_URL non impostata. Esempio: postgres://postgres:dev@localhost:5432/postgres');
    process.exit(1);
  }
  const shouldSSL = (
    process.env.DB_SSL === 'true' ||
    process.env.PGSSLMODE === 'require' ||
    (connString && /(?:^|[?&])sslmode=require(?:&|$)/i.test(connString))
  );
  const client = new Client({ connectionString: connString, ssl: shouldSSL ? { rejectUnauthorized: false } : false });
  await client.connect();

  const ver = await client.query('select version()');
  const ping = await client.query('select 1 as ok');
  async function countSafe(tbl) { try { const r = await client.query(`select count(*)::int as c from ${tbl}`); return r.rows[0].c; } catch { return null; } }
  const counts = {};
  for (const t of ['public.events','public.categories','public.forum_categories','public.forum_topics','public.forum_replies']) {
    counts[t] = await countSafe(t);
  }

  await client.end();
  console.log(JSON.stringify({ version: ver.rows[0].version, ping: ping.rows[0].ok, counts }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
