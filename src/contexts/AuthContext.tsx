/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { apiGet, apiSend } from '@/lib/apiClient';

interface CustomUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'company' | 'instructor' | 'final_user' | 'admin' | 'blogger' | 'creator';
  avatar_url: string | null;
  is_active: boolean;
  bio?: string | null;
  brevetto?: string | null;
  scadenza_brevetto?: string | null;
  scadenza_certificato_medico?: string | null;
  certificato_medico_tipo?: 'agonistico' | 'non_agonistico' | null | string;
  assicurazione?: string | null;
  scadenza_assicurazione?: string | null;
  // Campi estesi certificazioni
  didattica_brevetto?: string | null;
  numero_brevetto?: string | null;
  foto_brevetto_url?: string | null;
  numero_assicurazione?: string | null;
  dichiarazione_brevetto_valido?: boolean;
  dichiarazione_assicurazione_valida?: boolean;
  instagram_contact?: string | null;
  personal_best?: unknown;
  company_name?: string | null;
  vat_number?: string | null;
  company_address?: string | null;
  club_team?: string | null;
  phone?: string | null;
  // Public profile fields (optional, ensured at runtime by API)
  public_profile_enabled?: boolean;
  public_slug?: string | null;
  public_show_bio?: boolean;
  public_show_instagram?: boolean;
  public_show_company_info?: boolean;
  public_show_certifications?: boolean;
  public_show_events?: boolean;
  public_show_records?: boolean;
  public_show_personal?: boolean;
}

type AuthContextType = {
  session: null;
  user: CustomUser | null;
  profile: CustomUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role?: string, companyName?: string, vatNumber?: string, companyAddress?: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ApiAuthProvider = ({ children }: { children: ReactNode }) => {
  type RoleType = 'company' | 'instructor' | 'final_user' | 'admin' | 'blogger' | 'creator';
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CustomUser | null>(() => {
    const raw = localStorage.getItem('auth_user');
    return raw ? (JSON.parse(raw) as CustomUser) : null;
  });

  const persistUser = (u: CustomUser | null) => {
    if (u) localStorage.setItem('auth_user', JSON.stringify(u));
    else localStorage.removeItem('auth_user');
  };

  const persistToken = (token?: string) => {
    if (token) localStorage.setItem('api_token', token);
  };

  const signUp = async (email: string, password: string, fullName: string, role: RoleType = 'final_user') => {
    try {
      const res = await apiSend('/api/auth/register', 'POST', { email, password, full_name: fullName, role });
      if (res?.token && res?.user) {
        persistToken(res.token);
        setUser(res.user);
        persistUser(res.user);
        await refreshProfile();
        return { success: true };
      }
    } catch (e) {
      return { success: false, error: 'Registrazione fallita' };
    }
    return { success: false, error: 'Registrazione fallita' };
  };

  const signIn = async (email: string, password: string) => {
    try {
      const res = await apiSend('/api/auth/login', 'POST', { email, password });
      if (res?.token && res?.user) {
        persistToken(res.token);
        setUser(res.user);
        persistUser(res.user);
        await refreshProfile();
        return { success: true };
      }
      return { success: false, error: 'Credenziali non valide' };
    } catch (e) {
      return { success: false, error: 'Errore di accesso' };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const res = await apiSend('/api/auth/request-password-reset', 'POST', { email });
      if (res?.ok || res?.success || res === null) return { success: true };
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Invio email fallito' };
    }
  };

  const logout = async () => { setUser(null); persistUser(null); localStorage.removeItem('api_token'); };

  const refreshProfile = useCallback(async () => {
    try {
      const res = await apiGet('/api/profile');
      if (res?.user) { setUser(res.user); persistUser(res.user); }
    } catch (e) {
      if (import.meta.env.DEV) console.debug('refreshProfile(api) failed', e);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('api_token');
    (async () => {
      if (token) {
        await refreshProfile();
      }
      setLoading(false);
    })();
  }, [refreshProfile]);

  const value: AuthContextType = {
    session: null,
    user,
    profile: user,
    loading,
    logout,
    refreshProfile,
    signUp,
    signIn,
    resetPassword,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  return <ApiAuthProvider>{children}</ApiAuthProvider>;
};
