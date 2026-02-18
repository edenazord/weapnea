import { apiGet, apiSend } from '@/lib/apiClient';

// Tipi locali per l'architettura API-only
export interface Event {
  id: string;
  created_at?: string;
  title: string;
  slug: string;
  description?: string | null;
  date?: string | null; // ISO string YYYY-MM-DD o completa
  end_date?: string | null;
  location?: string | null;
  participants?: number | null;
  participants_paid_count?: number | null;
  image_url?: string | null;
  category_id: string;
  cost?: number | null;
  nation?: string | null;
  discipline?: string | null;
  created_by?: string;
  // Campi estesi
  level?: string | null;
  activity_description?: string | null;
  language?: string | null;
  about_us?: string | null;
  objectives?: string | null;
  included_in_activity?: string | null;
  not_included_in_activity?: string | null;
  notes?: string | null;
  schedule_logistics?: string | null;
  gallery_images?: string[] | null;
  pdf_url?: string | null;
  event_type?: string | null;
  // Nuovi campi per allenamenti condivisi
  activity_details?: string | null;
  who_we_are?: string | null;
  fixed_appointment?: boolean | null;
  fixed_appointment_text?: string | null; // Strategia B: descrizione testuale ricorrenza
  instructors?: unknown | null;
  instructor_certificates?: string[] | null;
  max_participants_per_instructor?: number | null;
  schedule_meeting_point?: string | null;
  responsibility_waiver_accepted?: boolean | null;
  privacy_accepted?: boolean | null;
  // Organizer public fields (optional, provided by API to avoid extra fetches)
  organizer_id?: string | null;
  organizer_name?: string | null;
  organizer_avatar_url?: string | null;
}

export type EventWithCategory = Event & {
  categories: { name: string } | null;
  organizer?: {
    id: string;
    full_name: string | null;
    company_name: string | null;
    role: string;
  } | null;
};

export interface Category {
  id: string;
  name: string;
  order_index: number;
}

export type CategoryWithEventCount = Category & { events_count: number };

// EU Countries list
export const EU_COUNTRIES = [
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
  'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece',
  'Hungary', 'Ireland', 'Italia', 'Latvia', 'Lithuania', 'Luxembourg',
  'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia',
  'Slovenia', 'Spain', 'Sweden'
];

// Discipline options
export const DISCIPLINE_OPTIONS = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'indoor&outdoor', label: 'Indoor & Outdoor' }
];

// Get nations with active events
export const getNationsWithEvents = async (): Promise<string[]> => {
  const rows = (await apiGet(`/api/events`)) as EventWithCategory[];
  const nations = [...new Set(rows.map(r => r.nation).filter(Boolean))] as string[];
  return nations.sort();
};

// Events API with role-based filtering
export const getEvents = async (
  searchTerm?: string,
  sort: { column: string; direction: string } = { column: 'date', direction: 'asc' },
  nationFilter?: string,
  dateFilter?: Date,
  userRole?: string,
  userId?: string
): Promise<EventWithCategory[]> => {
  const params = new URLSearchParams();
  if (searchTerm && searchTerm.trim() !== '') params.set('searchTerm', searchTerm);
  if (nationFilter && nationFilter !== 'all') params.set('nation', nationFilter);
  if (dateFilter) {
    const y = dateFilter.getFullYear();
    const m = String(dateFilter.getMonth() + 1).padStart(2, '0');
    const d = String(dateFilter.getDate()).padStart(2, '0');
    params.set('dateFrom', `${y}-${m}-${d}`);
  }
  params.set('sortColumn', sort.column);
  params.set('sortDirection', sort.direction);
  if (userRole) params.set('userRole', userRole);
  if (userId) params.set('userId', userId);
  const rows = await apiGet(`/api/events?${params.toString()}`);
  return rows as EventWithCategory[];
};

export const getEventById = async (id: string): Promise<EventWithCategory> => {
  const row = await apiGet(`/api/events/${id}`);
  return row as EventWithCategory;
};

export const getEventBySlug = async (slug: string): Promise<EventWithCategory> => {
  const row = await apiGet(`/api/events/slug/${encodeURIComponent(slug)}`);
  return row as EventWithCategory;
};

export const createEvent = async (event: Partial<Event>) => {
  const created = await apiSend(`/api/events`, 'POST', event);
  return created as EventWithCategory;
};

export const updateEvent = async (id: string, event: Partial<Event>) => {
  const updated = await apiSend(`/api/events/${encodeURIComponent(id)}`, 'PUT', event);
  return updated as EventWithCategory;
};

export const deleteEvent = async (id: string) => {
  await apiSend(`/api/events/${encodeURIComponent(id)}`, 'DELETE');
};

// Categories API
export const getCategories = async (): Promise<CategoryWithEventCount[]> => {
  const rows = await apiGet(`/api/categories`);
  return rows as CategoryWithEventCount[];
};

export const createCategory = async (category: { name: string; order_index?: number }) => {
  await apiSend(`/api/categories`, 'POST', category);
};

export const updateCategory = async (id: string, category: Partial<Pick<Category, 'name' | 'order_index'>>) => {
  await apiSend(`/api/categories/${encodeURIComponent(id)}`, 'PUT', category);
};

export const deleteCategory = async (id: string) => {
  await apiSend(`/api/categories/${encodeURIComponent(id)}`, 'DELETE');
};

// Update category order
export const updateCategoryOrder = async (categoryId: string, newOrderIndex: number): Promise<void> => {
  await apiSend(`/api/categories/${encodeURIComponent(categoryId)}`, 'PUT', { order_index: newOrderIndex });
};

// Reorder categories
export const reorderCategories = async (categoryIds: string[]): Promise<void> => {
  await apiSend(`/api/categories/reorder`, 'POST', { ids: categoryIds });
};

// App settings API (generic key-value)
export type SettingResponse<T = unknown> = { key: string; value: T | null };

export const getSetting = async <T = unknown>(key: string): Promise<SettingResponse<T>> => {
  const res = await apiGet(`/api/settings/${encodeURIComponent(key)}`);
  return res as SettingResponse<T>;
};

export const setSetting = async (key: string, value: unknown): Promise<void> => {
  await apiSend(`/api/settings/${encodeURIComponent(key)}`, 'PUT', { value });
};
