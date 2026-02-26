
import { apiGet, apiSend } from '@/lib/apiClient';

// Tipi locali per API-only
export type BlogTag = {
  id: string;
  name: string;
  language: string;
  created_at?: string;
};

export type BlogArticle = {
  id: string;
  language?: 'it' | 'en' | 'es' | 'fr' | 'pl' | 'ru';
  title: string;
  subtitle: string | null;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  gallery_images: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  hashtags: string[] | null;
  tags?: BlogTag[];
  published: boolean;
  author_id: string;
  created_at: string;
  updated_at: string;
};

export type BlogArticleWithAuthor = BlogArticle & {
  profiles: { full_name: string | null } | null;
};

// Blog Articles API
// publishedOnly: true = solo pubblicati, false = tutti (incluse bozze per admin)
export const getBlogArticles = async (
  publishedOnly: boolean = true,
  searchTerm?: string,
  sort: { column: string; direction: string } = { column: 'created_at', direction: 'desc' },
  language?: 'it' | 'en' | 'es' | 'fr' | 'pl' | 'ru',
  onlyMine?: boolean,
  tagId?: string
): Promise<BlogArticleWithAuthor[]> => {
  const params = new URLSearchParams();
  // Invia esplicitamente il filtro published
  params.set('published', publishedOnly ? 'true' : 'false');
  if (searchTerm) params.set('searchTerm', searchTerm);
  if (sort?.column) params.set('sortColumn', sort.column);
  if (sort?.direction) params.set('sortDirection', sort.direction);
  if (language) params.set('language', language);
  if (onlyMine) params.set('onlyMine', 'true');
  if (tagId) params.set('tag', tagId);
  const res = await apiGet(`/api/blog?${params.toString()}`);
  return res as BlogArticleWithAuthor[];
};

export const getBlogArticleBySlug = async (slug: string): Promise<BlogArticleWithAuthor> => {
  const res = await apiGet(`/api/blog/slug/${encodeURIComponent(slug)}`);
  return res as BlogArticleWithAuthor;
};

export const getBlogArticleById = async (id: string): Promise<BlogArticleWithAuthor> => {
  const res = await apiGet(`/api/blog/${encodeURIComponent(id)}`);
  return res as BlogArticleWithAuthor;
};

export const createBlogArticle = async (article: Partial<Omit<BlogArticle, 'id' | 'created_at' | 'updated_at'>>) => {
  await apiSend('/api/blog', 'POST', article);
};

// Alias for backwards compatibility
export const createBlogPost = createBlogArticle;

export const updateBlogArticle = async (id: string, article: Partial<BlogArticle>) => {
  await apiSend(`/api/blog/${id}`, 'PUT', article);
};

// Alias for backwards compatibility
export const updateBlogPost = updateBlogArticle;

export const deleteBlogArticle = async (id: string) => {
  await apiSend(`/api/blog/${id}`, 'DELETE');
};

export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// ===========================
// Blog Tags API
// ===========================

export const getBlogTags = async (language?: string): Promise<BlogTag[]> => {
  const params = language ? `?language=${encodeURIComponent(language)}` : '';
  return (await apiGet(`/api/blog-tags${params}`)) as BlogTag[];
};

export const createBlogTag = async (name: string, language: string = 'it'): Promise<BlogTag> => {
  return (await apiSend('/api/blog-tags', 'POST', { name, language })) as BlogTag;
};

export const updateBlogTag = async (id: string, name: string, language?: string): Promise<BlogTag> => {
  return (await apiSend(`/api/blog-tags/${id}`, 'PUT', { name, ...(language ? { language } : {}) })) as BlogTag;
};

export const deleteBlogTag = async (id: string): Promise<void> => {
  await apiSend(`/api/blog-tags/${id}`, 'DELETE');
};

export const setArticleTags = async (articleId: string, tagIds: string[]): Promise<BlogTag[]> => {
  return (await apiSend(`/api/blog/${articleId}/tags`, 'PUT', { tag_ids: tagIds })) as BlogTag[];
};
