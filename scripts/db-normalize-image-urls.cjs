#!/usr/bin/env node
/*
  Normalizza gli URL immagini nel DB per usare URL assoluti basati su TARGET_BASE_URL.
  Tabelle coperte:
    - events.image_url (text)
    - events.gallery_images (jsonb array di stringhe)
    - blog_articles.cover_image_url (text)
    - blog_articles.gallery_images (jsonb array di stringhe)
    - profiles.avatar_url (text)

  Uso:
    POSTGRES_URL=postgres://user:pass@host:port/db \
    TARGET_BASE_URL=https://weapnea-api.onrender.com \
    node ./scripts/db-normalize-image-urls.cjs

  Opzionale:
    DRY_RUN=true  -> esegue ROLLBACK a fine script
*/

const { Pool } = require('pg');

(async () => {
  const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const BASE = (process.env.TARGET_BASE_URL || 'https://weapnea-api.onrender.com').replace(/\/$/, '');
  const DRY = String(process.env.DRY_RUN || '').toLowerCase() === 'true';

  if (!DATABASE_URL) {
    console.error('[error] Missing POSTGRES_URL/DATABASE_URL');
    process.exit(1);
  }

  const sslRequired = (
    process.env.DB_SSL === 'true' ||
    process.env.PGSSLMODE === 'require' ||
    process.env.NODE_ENV === 'production'
  );

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: sslRequired ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    console.log(`[start] Normalizing image URLs using base: ${BASE}  (dryRun=${DRY})`);
    await client.query('BEGIN');

    // 1) events.image_url
    const q1 = `UPDATE events SET image_url = CONCAT($1, image_url)
                WHERE image_url IS NOT NULL AND image_url LIKE '/%'`;
    const r1 = await client.query(q1, [BASE]);
    console.log(`[events] image_url updated rows: ${r1.rowCount}`);

    // 2) events.gallery_images (jsonb)
    const q2 = `WITH gi AS (
                  SELECT id, jsonb_agg(
                    CASE
                      WHEN elem ~* '^(https?:|data:|blob:)' THEN to_jsonb(elem)
                      WHEN left(elem,1) = '/' THEN to_jsonb($1 || elem)
                      ELSE to_jsonb(elem)
                    END
                  ) AS new_gallery
                  FROM (
                    SELECT id, jsonb_array_elements_text(gallery_images) AS elem
                    FROM events
                    WHERE gallery_images IS NOT NULL
                  ) s
                  GROUP BY id
                )
                UPDATE events e
                SET gallery_images = gi.new_gallery
                FROM gi
                WHERE e.id = gi.id
                  AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(e.gallery_images) x WHERE left(x,1) = '/'
                  )`;
    const r2 = await client.query(q2, [BASE]);
    console.log(`[events] gallery_images updated rows: ${r2.rowCount}`);

    // 3) blog_articles.cover_image_url
    const q3 = `UPDATE blog_articles SET cover_image_url = CONCAT($1, cover_image_url)
                WHERE cover_image_url IS NOT NULL AND cover_image_url LIKE '/%'`;
    let r3 = { rowCount: 0 };
    try { r3 = await client.query(q3, [BASE]); } catch { /* table may not exist */ }
    console.log(`[blog] cover_image_url updated rows: ${r3.rowCount}`);

    // 4) blog_articles.gallery_images
    const q4 = `WITH gi AS (
                  SELECT id, jsonb_agg(
                    CASE
                      WHEN elem ~* '^(https?:|data:|blob:)' THEN to_jsonb(elem)
                      WHEN left(elem,1) = '/' THEN to_jsonb($1 || elem)
                      ELSE to_jsonb(elem)
                    END
                  ) AS new_gallery
                  FROM (
                    SELECT id, jsonb_array_elements_text(gallery_images) AS elem
                    FROM blog_articles
                    WHERE gallery_images IS NOT NULL
                  ) s
                  GROUP BY id
                )
                UPDATE blog_articles b
                SET gallery_images = gi.new_gallery
                FROM gi
                WHERE b.id = gi.id
                  AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(b.gallery_images) x WHERE left(x,1) = '/'
                  )`;
    let r4 = { rowCount: 0 };
    try { r4 = await client.query(q4, [BASE]); } catch { /* table may not exist */ }
    console.log(`[blog] gallery_images updated rows: ${r4.rowCount}`);

    // 5) profiles.avatar_url
    const q5 = `UPDATE profiles SET avatar_url = CONCAT($1, avatar_url)
                WHERE avatar_url IS NOT NULL AND avatar_url LIKE '/%'`;
    const r5 = await client.query(q5, [BASE]);
    console.log(`[profiles] avatar_url updated rows: ${r5.rowCount}`);

    if (DRY) {
      await client.query('ROLLBACK');
      console.log('[done] DRY_RUN enabled -> rolled back');
    } else {
      await client.query('COMMIT');
      console.log('[done] COMMIT successful');
    }
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[error] failed:', e?.message || e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
