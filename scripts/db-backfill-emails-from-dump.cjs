const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function extractTuples(sql) {
  const marker = 'INSERT INTO "auth"."users"';
  const idx = sql.indexOf(marker);
  if (idx === -1) return [];
  const rest = sql.slice(idx);
  const valIdx = rest.indexOf('VALUES');
  if (valIdx === -1) return [];
  const after = rest.slice(valIdx + 'VALUES'.length);
  // Collect until the terminating semicolon
  let buf = '';
  for (let i = 0; i < after.length; i++) {
    buf += after[i];
    if (after[i] === ';') break;
  }
  // Split top-level tuples: they start with '(' and are comma-separated
  const tuples = [];
  let depth = 0, start = -1, inQuote = false;
  for (let i = 0; i < buf.length; i++) {
    const ch = buf[i];
    if (ch === "'") {
      // handle doubled single quotes inside
      if (inQuote && buf[i+1] === "'") { i++; continue; }
      inQuote = !inQuote;
    }
    if (inQuote) continue;
    if (ch === '(') {
      if (depth === 0) start = i+1; // content begins after '('
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0 && start !== -1) {
        tuples.push(buf.slice(start, i));
        start = -1;
      }
    }
  }
  return tuples;
}

function splitSqlValues(s) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'") {
      if (inQuote && s[i+1] === "'") { cur += "'"; i++; continue; }
      inQuote = !inQuote;
      cur += ch;
      continue;
    }
    if (!inQuote && ch === ',') {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim().length) out.push(cur.trim());
  return out;
}

function unquote(q) {
  if (!q) return q;
  q = q.trim();
  if (q.startsWith("'") && q.endsWith("'")) {
    q = q.slice(1, -1).replace(/''/g, "'");
  }
  return q;
}

async function main() {
  const file = process.env.DUMP_FILE || path.join(process.cwd(), 'db', 'dump', 'dati.sql');
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  const sql = fs.readFileSync(abs, 'utf8');
  const tuples = extractTuples(sql);
  if (!tuples.length) { console.error('Nessun blocco INSERT auth.users trovato nel dump.'); process.exit(1); }

  const map = new Map(); // id -> email
  for (const t of tuples) {
    const vals = splitSqlValues(t);
    if (vals.length < 5) continue;
    const id = unquote(vals[1]);
    const email = unquote(vals[4]);
    if (id && email) map.set(id, email);
  }

  const pairs = Array.from(map.entries());
  if (!pairs.length) { console.error('Nessuna coppia id/email estratta.'); process.exit(1); }

  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) { console.error('POSTGRES_URL non impostata'); process.exit(1); }
  const client = new Client({ connectionString: conn, ssl: false });
  await client.connect();
  let updated = 0;
  try {
    await client.query('BEGIN');
    for (const [id, email] of pairs) {
      const res = await client.query(
        "UPDATE public.profiles p SET email = $1 " +
        "WHERE p.id = $2 " +
        "  AND (p.email IS NULL OR p.email = '') " +
        "  AND NOT EXISTS (SELECT 1 FROM public.profiles x WHERE x.email = $1 AND x.id <> $2)",
        [email, id]
      );
      updated += res.rowCount || 0;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
  console.log(JSON.stringify({ file: abs, found: pairs.length, updated }, null, 2));
}

main().catch((e)=>{ console.error(e.message || e); process.exit(1); });
