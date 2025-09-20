const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map(h => h.trim());
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const row = {};
    header.forEach((h, idx) => { row[h] = (cols[idx] ?? '').trim(); });
    out.push(row);
  }
  return out;
}

async function main() {
  const fileArgIdx = process.argv.indexOf('--file');
  const file = fileArgIdx > -1 ? process.argv[fileArgIdx + 1] : process.env.CSV_FILE;
  if (!file) {
    console.error('Specifica il CSV con --file <path> oppure CSV_FILE env. Attesi header: id,email');
    process.exit(1);
  }
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  const text = fs.readFileSync(abs, 'utf8');
  const rows = parseCSV(text);
  if (rows.length === 0) {
    console.error('CSV vuoto o non valido');
    process.exit(1);
  }

  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) { console.error('POSTGRES_URL non impostata'); process.exit(1); }
  const client = new Client({ connectionString: conn, ssl: false });
  await client.connect();
  let updated = 0, skipped = 0;
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      if (!r.id || !r.email) { skipped++; continue; }
      const res = await client.query('UPDATE public.profiles SET email = $1 WHERE id = $2', [r.email, r.id]);
      updated += res.rowCount || 0;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
  console.log(JSON.stringify({ file: abs, updated, skipped }, null, 2));
}

main().catch((e)=>{ console.error(e.message || e); process.exit(1); });
