const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const outDir = path.join(__dirname, '..', 'public', 'mock-data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const connString = process.env.POSTGRES_URL;
  const client = new Client(connString ? { connectionString: connString, ssl: false } : { ssl: false });
  await client.connect();

  async function safeQuery(sql) { try { const res = await client.query(sql); return res.rows; } catch { return []; } }

  const categories = await safeQuery(`select id, name, coalesce(order_index,0) as order_index from public.categories`);
  const events = await safeQuery(`select id, title, slug, description, date, end_date, location, participants, image_url, category_id, cost, nation, discipline, created_by, level from public.events`);
  const categoriesWithCount = categories.map(c => ({ ...c, events_count: events.filter(e => e.category_id === c.id).length }));
  const forumCategories = await safeQuery(`select id, name, description, slug, color, created_at, updated_at, coalesce(order_index,0) as order_index from public.forum_categories`);
  const forumTopics = await safeQuery(`select id, title, content, category_id, author_id, is_pinned, is_locked, views_count, replies_count, last_reply_at, last_reply_by, created_at, updated_at from public.forum_topics`);
  const forumReplies = await safeQuery(`select id, content, topic_id, author_id, created_at, updated_at from public.forum_replies`);

  const write = (name, data) => {
    const file = path.join(outDir, name);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    console.log('Scritto', path.relative(process.cwd(), file), `(${data.length} record)`);
  };

  write('categories.json', categoriesWithCount);
  write('events.json', events);
  write('forum-categories.json', forumCategories);
  write('forum-topics.json', forumTopics);
  write('forum-replies.json', forumReplies);

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
