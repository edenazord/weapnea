import { apiGet, apiSend } from '@/lib/apiClient';

export type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  profile?: {
    full_name: string | null;
    role: 'company' | 'instructor' | 'final_user' | 'admin' | 'blogger';
    is_active: boolean | null;
    avatar_url: string | null;
    company_name: string | null;
    vat_number: string | null;
    company_address: string | null;
  };
};

export type UserRole = 'company' | 'instructor' | 'final_user' | 'admin' | 'blogger';

// Ottieni tutti gli utenti con le loro email reali utilizzando la Edge Function
export const getAllUsers = async (): Promise<AdminUser[]> => {
  const users = await apiGet('/api/admin/users');
  return users as AdminUser[];
};

// Elimina un utente
export const deleteUser = async (userId: string) => {
  await apiSend(`/api/admin/users/${encodeURIComponent(userId)}`, 'DELETE');
  return null;
};

// Aggiorna il ruolo di un utente
export const updateUserRole = async (userId: string, role: UserRole) => {
  await apiSend(`/api/admin/users/${encodeURIComponent(userId)}/role`, 'PUT', { role });
};

// Attiva/Disattiva un utente
export const toggleUserActive = async (userId: string, isActive: boolean) => {
  await apiSend(`/api/admin/users/${encodeURIComponent(userId)}/active`, 'PUT', { is_active: isActive });
};

// Aggiorna il profilo utente
export const updateUserProfile = async (userId: string, profileData: Partial<AdminUser['profile']>) => {
  await apiSend(`/api/admin/users/${encodeURIComponent(userId)}/profile`, 'PUT', profileData);
};

// Genera token per reset password
export const generatePasswordResetToken = async (userId: string) => {
  // In API mode il server invia l'email di reset dato l'ID utente
  await apiSend('/api/auth/request-password-reset-by-id', 'POST', { userId });
  return 'email-sent';
};

// Ottieni i token di recupero password
export const getPasswordRecoveryTokens = async () => {
  return [] as any[];
};

// Segna un token come usato
export const markTokenAsUsed = async (_tokenId: string) => {
  return;
};
