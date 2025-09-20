const { Client } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

function genPass() {
  // 12 chars: letters+digits
  return crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
}

async function main() {
  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) { console.error('POSTGRES_URL non impostata'); process.exit(1); }
  const client = new Client({ connectionString: conn, ssl: false });
  await client.connect();

  const { rows: users } = await client.query(
    `SELECT id::text AS id, COALESCE(email, '') AS email
     FROM public.profiles
     WHERE (password_hash IS NULL OR password_hash = '')
       AND email IS NOT NULL`
  );

  const updates = [];
  try {
    await client.query('BEGIN');
    for (const u of users) {
      const pwd = genPass();
      const hash = await bcrypt.hash(pwd, 10);
      await client.query('UPDATE public.profiles SET password_hash = $1 WHERE id = $2', [hash, u.id]);
      updates.push({ id: u.id, email: u.email, password: pwd });
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }

  console.log(JSON.stringify({ updated: updates.length, accounts: updates }, null, 2));
}

main().catch((e)=>{ console.error(e.message || e); process.exit(1); });
