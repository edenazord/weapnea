
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export interface CustomUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'company' | 'instructor' | 'final_user' | 'admin' | 'blogger';
  avatar_url: string | null;
  is_active: boolean;
  bio?: string | null;
  brevetto?: string | null;
  scadenza_brevetto?: string | null;
  scadenza_certificato_medico?: string | null;
  assicurazione?: string | null;
  scadenza_assicurazione?: string | null;
  instagram_contact?: string | null;
  personal_best?: any;
  company_name?: string | null;
  vat_number?: string | null;
  company_address?: string | null;
}

interface AuthResult {
  success: boolean;
  error?: string;
  user?: CustomUser;
}

export const useCustomAuth = () => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      }
      setLoading(false);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (profile && session?.user) {
        const customUser: CustomUser = {
          id: profile.id,
          email: session.user.email!,
          full_name: profile.full_name,
          role: profile.role,
          avatar_url: profile.avatar_url,
          is_active: profile.is_active || false,
          bio: profile.bio,
          brevetto: profile.brevetto,
          scadenza_brevetto: profile.scadenza_brevetto,
          scadenza_certificato_medico: profile.scadenza_certificato_medico,
          assicurazione: profile.assicurazione,
          scadenza_assicurazione: profile.scadenza_assicurazione,
          instagram_contact: profile.instagram_contact,
          personal_best: profile.personal_best,
          company_name: profile.company_name,
          vat_number: profile.vat_number,
          company_address: profile.company_address,
        };
        setUser(customUser);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  };

  const register = async (
    email: string,
    password: string,
    fullName: string,
    role: string = 'final_user',
    companyName?: string,
    vatNumber?: string,
    companyAddress?: string
  ): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            role: role,
            company_name: companyName,
            vat_number: vatNumber,
            company_address: companyAddress,
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const activateAccount = async (token: string): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'signup'
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const requestPasswordReset = async (email: string): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/password-reset`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const resetPassword = async (token: string, newPassword: string): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const refreshProfile = async (): Promise<void> => {
    if (session?.user) {
      await fetchUserProfile(session.user.id);
    }
  };

  return {
    user,
    loading,
    register,
    login,
    logout,
    activateAccount,
    requestPasswordReset,
    resetPassword,
    refreshProfile
  };
};
