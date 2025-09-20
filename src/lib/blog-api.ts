
import { apiGet, apiSend } from '@/lib/apiClient';

// Tipi locali per API-only
export type BlogArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  gallery_images: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  hashtags: string[] | null;
  published: boolean;
  author_id: string;
  created_at: string;
  updated_at: string;
};

export type BlogArticleWithAuthor = BlogArticle & {
  profiles: { full_name: string | null } | null;
};

// Blog Articles API
export const getBlogArticles = async (
  published: boolean = true,
  searchTerm?: string,
  sort: { column: string; direction: string } = { column: 'created_at', direction: 'desc' }
): Promise<BlogArticleWithAuthor[]> => {
  const params = new URLSearchParams();
  if (published) params.set('published', 'true');
  if (searchTerm) params.set('searchTerm', searchTerm);
  if (sort?.column) params.set('sortColumn', sort.column);
  if (sort?.direction) params.set('sortDirection', sort.direction);
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
