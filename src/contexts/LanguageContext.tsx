
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadLanguages, loadTranslations, UILanguage } from '@/lib/i18n-loader';

interface LanguageContextType {
  currentLanguage: string;
  setCurrentLanguage: (language: string) => void;
  languages: UILanguage[];
  translations: Record<string, string>;
  t: (key: string, fallbackOrVars?: string | Record<string, string | number>, vars?: Record<string, string | number>) => string;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguageState] = useState(() => {
    return localStorage.getItem('language') || 'it';
  });

  const { data: languages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: loadLanguages,
    staleTime: 1000 * 60 * 60, // 1h
    gcTime: 1000 * 60 * 60,
  });

  const { data: translations = {}, isLoading } = useQuery({
    queryKey: ['translations', currentLanguage],
    queryFn: () => loadTranslations(currentLanguage),
    enabled: !!currentLanguage,
    staleTime: 1000 * 60 * 60, // 1 hour - traduzioni non cambiano spesso
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  const setCurrentLanguage = useCallback((language: string) => {
    if (language === currentLanguage) return; // Evita chiamate inutili se la lingua è la stessa
    
    console.log('🌐 Changing language from', currentLanguage, 'to', language);
    
    // Update state - questo automaticamente trigghera la nuova query grazie alla queryKey
    setCurrentLanguageState(language);
    localStorage.setItem('language', language);
  }, [currentLanguage]);

  const t = useCallback((key: string, fallbackOrVars?: string | Record<string, string | number>, vars?: Record<string, string | number>): string => {
    // Supporta sia t('key', 'fallback') che t('key', 'fallback', {count: 5}) che t('key', {count: 5})
    let fallback: string | undefined;
    let variables: Record<string, string | number> | undefined;
    if (typeof fallbackOrVars === 'string') {
      fallback = fallbackOrVars;
      variables = vars;
    } else if (typeof fallbackOrVars === 'object') {
      variables = fallbackOrVars;
    }
    let result = translations[key] || fallback || key;
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return result;
  }, [translations]);

  useEffect(() => {
    // Detect browser language on first visit
    const savedLanguage = localStorage.getItem('language');
    if (!savedLanguage && languages.length > 0) {
      const browserLanguage = navigator.language.slice(0, 2);
      const supportedLanguages = languages.map(lang => lang.code);
      if (supportedLanguages.includes(browserLanguage)) {
        setCurrentLanguage(browserLanguage);
      }
    }
  }, [languages, setCurrentLanguage]);

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        setCurrentLanguage,
        languages,
        translations,
        t,
        isLoading,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
