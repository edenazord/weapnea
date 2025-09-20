import { validateAndSanitizeInput, checkContentOwnership, checkRateLimit } from "./forum-api-security";
import { apiGet, apiSend } from '@/lib/apiClient';

export type ForumCategory = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  color: string | null;
  created_at: string;
  updated_at: string;
  order_index: number;
};

export type ForumTopic = {
  id: string;
  title: string;
  content: string;
  category_id: string;
  author_id: string;
  is_pinned: boolean | null;
  is_locked: boolean | null;
  views_count: number | null;
  replies_count: number | null;
  last_reply_at: string | null;
  last_reply_by: string | null;
  created_at: string;
  updated_at: string;
  category?: ForumCategory;
  author?: {
    id: string;
    full_name: string | null;
  };
  last_reply_author?: {
    id: string;
    full_name: string | null;
  };
};

export type ForumReply = {
  id: string;
  content: string;
  topic_id: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    full_name: string | null;
  };
};

export type CreateForumTopicData = {
  title: string;
  content: string;
  category_id: string;
  author_id: string;
};

export type CreateForumReplyData = {
  content: string;
  topic_id: string;
  author_id: string;
};

// Get forum categories with ordering
export const getForumCategories = async (): Promise<ForumCategory[]> => {
  const rows = await apiGet('/api/forum/categories');
  return rows as ForumCategory[];
};

// Create forum category
export const createForumCategory = async (categoryData: {
  name: string;
  description?: string;
  slug: string;
  color?: string;
}): Promise<ForumCategory> => {
  const payload = {
    name: validateAndSanitizeInput.title(categoryData.name),
    description: categoryData.description ? validateAndSanitizeInput.content(categoryData.description) : null,
    slug: validateAndSanitizeInput.title(categoryData.slug),
    color: categoryData.color || '#3B82F6',
  };
  const created = await apiSend('/api/forum/categories', 'POST', payload);
  return created as ForumCategory;
};

// Update forum category
export const updateForumCategory = async (id: string, categoryData: {
  name?: string;
  description?: string;
  slug?: string;
  color?: string;
}): Promise<ForumCategory> => {
  const payload: Record<string, unknown> = {};
  if (categoryData.name) payload.name = validateAndSanitizeInput.title(categoryData.name);
  if (categoryData.description !== undefined) payload.description = categoryData.description ? validateAndSanitizeInput.content(categoryData.description) : null;
  if (categoryData.slug) payload.slug = validateAndSanitizeInput.title(categoryData.slug);
  if (categoryData.color) payload.color = categoryData.color;
  const updated = await apiSend(`/api/forum/categories/${encodeURIComponent(id)}`, 'PUT', payload);
  return updated as ForumCategory;
};

// Delete forum category
export const deleteForumCategory = async (id: string): Promise<void> => {
  await apiSend(`/api/forum/categories/${encodeURIComponent(id)}`, 'DELETE');
  return;
};

// Get forum topics with pagination and filtering
export const getForumTopics = async (categoryId?: string, limit = 20, offset = 0): Promise<ForumTopic[]> => {
  const params = new URLSearchParams();
  if (categoryId) params.set('categoryId', categoryId);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  const rows = await apiGet(`/api/forum/topics?${params.toString()}`);
  return rows as ForumTopic[];
};

// Get single forum topic by ID
export const getForumTopicById = async (id: string): Promise<ForumTopic | null> => {
  const res = await apiGet(`/api/forum/topics/${encodeURIComponent(id)}`);
  return res || null;
};

// Get forum replies for a topic
export const getForumReplies = async (topicId: string): Promise<ForumReply[]> => {
  const params = new URLSearchParams({ topicId });
  const rows = await apiGet(`/api/forum/replies?${params.toString()}`);
  return rows as ForumReply[];
};

// Create a new forum topic
export const createForumTopic = async (topicData: CreateForumTopicData): Promise<ForumTopic> => {
  if (!checkRateLimit('create_topic', 5, 300000)) { // 5 topics per 5 minutes
    throw new Error('Troppi topic creati di recente. Riprova tra qualche minuto.');
  }
  const me = (() => { try { const raw = localStorage.getItem('auth_user'); return raw ? JSON.parse(raw) as { id: string } : null; } catch { return null; } })();
  if (!me) throw new Error('Devi essere autenticato per creare un topic');
  const payload = {
    title: validateAndSanitizeInput.title(topicData.title),
    content: validateAndSanitizeInput.content(topicData.content),
    category_id: topicData.category_id,
    author_id: topicData.author_id || me.id
  };
  const created = await apiSend('/api/forum/topics', 'POST', payload);
  return created as ForumTopic;
};

// Create a new forum reply
export const createForumReply = async (replyData: CreateForumReplyData): Promise<ForumReply> => {
  if (!checkRateLimit('create_reply', 10, 60000)) { // 10 replies per minute
    throw new Error('Troppe risposte inviate di recente. Riprova tra qualche secondo.');
  }
  const me = (() => { try { const raw = localStorage.getItem('auth_user'); return raw ? JSON.parse(raw) as { id: string } : null; } catch { return null; } })();
  if (!me) throw new Error('Devi essere autenticato per rispondere');
  const payload = {
    content: validateAndSanitizeInput.content(replyData.content),
    topic_id: replyData.topic_id,
    author_id: replyData.author_id || me.id
  };
  const created = await apiSend('/api/forum/replies', 'POST', payload);
  return created as ForumReply;
};

// Update forum topic content
export const updateForumTopicContent = async (id: string, title: string, content: string): Promise<void> => {
  const validatedId = validateAndSanitizeInput.uuid(id);
  const sanitizedTitle = validateAndSanitizeInput.title(title);
  const sanitizedContent = validateAndSanitizeInput.content(content);

  // Check ownership first
  const topic = await getForumTopicById(validatedId);
  if (!topic) throw new Error('Topic non trovato');

  const canEdit = await checkContentOwnership(topic.author_id);
  if (!canEdit) throw new Error('Non hai i permessi per modificare questo topic');

  await apiSend(`/api/forum/topics/${encodeURIComponent(id)}`, 'PUT', { title: sanitizedTitle, content: sanitizedContent });
  return;
};

// Update forum reply content
export const updateForumReplyContent = async (id: string, content: string): Promise<void> => {
  const validatedId = validateAndSanitizeInput.uuid(id);
  const sanitizedContent = validateAndSanitizeInput.content(content);

  await apiSend(`/api/forum/replies/${encodeURIComponent(id)}`, 'PUT', { content: sanitizedContent });
  return;
};

// Delete forum topic
export const deleteForumTopic = async (id: string): Promise<void> => {
  await apiSend(`/api/forum/topics/${encodeURIComponent(id)}`, 'DELETE');
  return;
};

// Delete forum reply
export const deleteForumReply = async (id: string): Promise<void> => {
  await apiSend(`/api/forum/replies/${encodeURIComponent(id)}`, 'DELETE');
  return;
};

// Increment topic views (with basic rate limiting)
export const incrementTopicViews = async (id: string): Promise<void> => {
  if (!checkRateLimit(`view_${id}`, 1, 60000)) { // 1 view per minute per topic
    return; // Silently ignore if rate limited
  }
  await apiSend(`/api/forum/topics/${encodeURIComponent(id)}/views`, 'POST');
  return;
};

// Update topic status (pin/unpin, lock/unlock) - admin only
export const updateTopicStatus = async (
  id: string, 
  updates: { is_pinned?: boolean; is_locked?: boolean }
): Promise<void> => {
  await apiSend(`/api/forum/topics/${encodeURIComponent(id)}`, 'PUT', updates);
  return;
};

// Reorder forum categories
export const reorderForumCategories = async (categoryIds: string[]): Promise<void> => {
  await apiSend('/api/forum/categories/reorder', 'POST', { ids: categoryIds });
  return;
};
