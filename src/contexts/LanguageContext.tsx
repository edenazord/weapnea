
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadLanguages, loadTranslations, UILanguage } from '@/lib/i18n-loader';

interface LanguageContextType {
  currentLanguage: string;
  setCurrentLanguage: (language: string) => void;
  languages: UILanguage[];
  translations: Record<string, string>;
  t: (key: string, fallback?: string) => string;
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

  const t = useCallback((key: string, fallback?: string): string => {
    return translations[key] || fallback || key;
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
