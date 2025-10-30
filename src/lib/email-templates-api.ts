
import { apiGet, apiSend } from '@/lib/apiClient';

export type EmailTemplate = {
  id: string;
  template_type: 'welcome' | 'password_reset' | 'event_registration_user' | 'event_registration_organizer';
  subject: string;
  html_content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const getEmailTemplates = async (): Promise<EmailTemplate[]> => {
  const res = await apiGet('/api/email-templates');
  return (Array.isArray(res) ? res : []) as EmailTemplate[];
};

export const updateEmailTemplate = async (
  templateType: string,
  updates: Partial<Pick<EmailTemplate, 'subject' | 'html_content' | 'is_active'>>
) => {
  await apiSend(`/api/email-templates/${encodeURIComponent(templateType)}`, 'PUT', updates);
};

export const getEmailTemplate = async (templateType: string): Promise<EmailTemplate | null> => {
  try {
    const res = await apiGet(`/api/email-templates/${encodeURIComponent(templateType)}`);
    return res as EmailTemplate;
  } catch (e) {
    return null;
  }
};

export const seedEmailTemplatesDefaults = async (): Promise<any> => {
  try {
    const res = await apiSend('/api/email-templates/seed-defaults', 'POST');
    return res;
  } catch {
    return null;
  }
};
