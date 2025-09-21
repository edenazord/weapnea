const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function readJsonIfExists(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error('Errore lettura JSON', p, e.message || e);
    return null;
  }
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

  const base = path.join(__dirname, '..', 'public', 'mock-data');
  const files = {
    categories: path.join(base, 'categories.json'),
    events: path.join(base, 'events.json'),
    forumCategories: path.join(base, 'forum-categories.json'),
    forumTopics: path.join(base, 'forum-topics.json'),
    forumReplies: path.join(base, 'forum-replies.json'),
    // opzionale: blog
    blog: path.join(base, 'blog.json'),
  };

  const categories = readJsonIfExists(files.categories) || [];
  const events = readJsonIfExists(files.events) || [];
  const forumCategories = readJsonIfExists(files.forumCategories) || [];
  const forumTopics = readJsonIfExists(files.forumTopics) || [];
  const forumReplies = readJsonIfExists(files.forumReplies) || [];
  const blog = readJsonIfExists(files.blog) || [];

  const usedProfileIds = new Set();
  for (const e of events) if (e.created_by) usedProfileIds.add(e.created_by);
  for (const b of blog) if (b.author_id) usedProfileIds.add(b.author_id);
  for (const t of forumTopics) if (t.author_id) usedProfileIds.add(t.author_id);
  for (const r of forumReplies) if (r.author_id) usedProfileIds.add(r.author_id);

  try {
    await client.query('BEGIN');

    // Create stub profiles for foreign keys if missing
    if (usedProfileIds.size) {
      for (const id of usedProfileIds) {
        try {
          await client.query('INSERT INTO public.profiles(id, is_active) VALUES ($1, true) ON CONFLICT (id) DO NOTHING', [id]);
        } catch (_) { /* ignore */ }
      }
    }

  // Categories (now UUID ids)
    for (const c of categories) {
      await client.query(
        'INSERT INTO public.categories(id, name, order_index) VALUES ($1,$2,$3)\n         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, order_index = EXCLUDED.order_index',
        [c.id, c.name, c.order_index ?? null]
      );
    }
  // No sequence fix needed for UUID

    // Events
    for (const e of events) {
      const cols = [
        'id','title','slug','description','date','end_date','location','participants','image_url','category_id','cost','nation','discipline','created_by','level','activity_description','language','about_us','objectives','included_in_activity','not_included_in_activity','notes','schedule_logistics','gallery_images','event_type','activity_details','who_we_are','fixed_appointment','instructors','instructor_certificates','max_participants_per_instructor','schedule_meeting_point','responsibility_waiver_accepted','privacy_accepted'
      ];
      const jsonCols = new Set(['participants','included_in_activity','not_included_in_activity','gallery_images','activity_details','who_we_are','instructors','instructor_certificates']);
      const values = cols.map(k => {
        let v = e[k] ?? null;
        if (v !== null && jsonCols.has(k) && typeof v !== 'string') {
          try { v = JSON.stringify(v); } catch (_) {}
        }
        return v;
      });
      const placeholders = cols.map((_,i)=>`$${i+1}`).join(',');
      await client.query(
        `INSERT INTO public.events(${cols.join(',')}) VALUES(${placeholders})\n         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, slug = EXCLUDED.slug, description = EXCLUDED.description,\n           date = EXCLUDED.date, end_date = EXCLUDED.end_date, location = EXCLUDED.location, participants = EXCLUDED.participants,\n           image_url = EXCLUDED.image_url, category_id = EXCLUDED.category_id, cost = EXCLUDED.cost, nation = EXCLUDED.nation,\n           discipline = EXCLUDED.discipline, created_by = EXCLUDED.created_by, level = EXCLUDED.level`,
        values
      );
    }

    // Blog (se presente in blog.json con [{...}])
    for (const b of blog) {
      const cols = ['id','title','slug','excerpt','content','cover_image_url','gallery_images','seo_title','seo_description','seo_keywords','hashtags','published','author_id'];
      const values = cols.map(k => {
        let v = b[k] ?? null;
        // gallery_images è jsonb -> stringifichiamo se è oggetto/array
        if (k === 'gallery_images' && v !== null && typeof v !== 'string') {
          try { v = JSON.stringify(v); } catch (_) {}
        }
        // seo_keywords e hashtags sono text[] -> passiamo array JS tal quale
        if ((k === 'seo_keywords' || k === 'hashtags') && v !== null) {
          if (!Array.isArray(v)) {
            // se arriva stringa JSON, prova a parse
            if (typeof v === 'string') {
              try { const parsed = JSON.parse(v); if (Array.isArray(parsed)) v = parsed; } catch (_) {}
            }
          }
        }
        return v;
      });
      const placeholders = cols.map((_,i)=>`$${i+1}`).join(',');
      await client.query(
        `INSERT INTO public.blog_articles(${cols.join(',')}) VALUES(${placeholders})\n         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, slug = EXCLUDED.slug, excerpt = EXCLUDED.excerpt, content = EXCLUDED.content,\n           cover_image_url = EXCLUDED.cover_image_url, gallery_images = EXCLUDED.gallery_images, seo_title = EXCLUDED.seo_title,\n           seo_description = EXCLUDED.seo_description, seo_keywords = EXCLUDED.seo_keywords, hashtags = EXCLUDED.hashtags, published = EXCLUDED.published, author_id = EXCLUDED.author_id`,
        values
      );
    }

  // Forum categories (now UUID ids)
    for (const c of forumCategories) {
      await client.query(
        'INSERT INTO public.forum_categories(id, name, description, slug, color, order_index) VALUES ($1,$2,$3,$4,$5,$6)\n         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, slug = EXCLUDED.slug, color = EXCLUDED.color, order_index = EXCLUDED.order_index',
        [c.id, c.name, c.description ?? null, c.slug, c.color ?? null, c.order_index ?? null]
      );
    }
  // No sequence fix needed for UUID

    // Forum topics
    for (const t of forumTopics) {
      await client.query(
        `INSERT INTO public.forum_topics(id, title, content, category_id, author_id, is_pinned, is_locked, views_count, replies_count, last_reply_at, last_reply_by)\n         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)\n         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content, category_id = EXCLUDED.category_id, author_id = EXCLUDED.author_id,\n           is_pinned = EXCLUDED.is_pinned, is_locked = EXCLUDED.is_locked, views_count = EXCLUDED.views_count, replies_count = EXCLUDED.replies_count,\n           last_reply_at = EXCLUDED.last_reply_at, last_reply_by = EXCLUDED.last_reply_by`,
        [t.id, t.title, t.content ?? null, t.category_id ?? null, t.author_id ?? null, t.is_pinned ?? false, t.is_locked ?? false, t.views_count ?? 0, t.replies_count ?? 0, t.last_reply_at ?? null, t.last_reply_by ?? null]
      );
    }

    // Forum replies
    for (const r of forumReplies) {
      await client.query(
        `INSERT INTO public.forum_replies(id, content, topic_id, author_id) VALUES ($1,$2,$3,$4)\n         ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, topic_id = EXCLUDED.topic_id, author_id = EXCLUDED.author_id`,
        [r.id, r.content, r.topic_id, r.author_id ?? null]
      );
    }

    await client.query('COMMIT');
    console.log('Import completato.', JSON.stringify({
      categories: categories.length,
      events: events.length,
      blog: blog.length,
      forumCategories: forumCategories.length,
      forumTopics: forumTopics.length,
      forumReplies: forumReplies.length,
    }, null, 2));
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Errore import:', e.message || e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e)=>{ console.error(e.message || e); process.exit(1); });
