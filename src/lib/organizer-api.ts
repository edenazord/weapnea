import { apiSend } from '@/lib/apiClient';

export const requestOrganizerUpgrade = async (): Promise<{ ok: boolean; already_requested?: boolean } | null> => {
  const res = await apiSend('/api/me/request-organizer', 'POST');
  return res as any;
};
