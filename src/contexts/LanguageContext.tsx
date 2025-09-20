
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  console.log('🔄 Current language in context:', currentLanguage);

  const { data: languages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: loadLanguages,
    staleTime: 1000 * 60 * 60, // 1h
    gcTime: 1000 * 60 * 60,
  });

  const { data: translations = {}, isLoading, refetch: refetchTranslations } = useQuery({
    queryKey: ['translations', currentLanguage],
    queryFn: () => loadTranslations(currentLanguage),
    enabled: !!currentLanguage,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  console.log('📚 Loaded translations for', currentLanguage, ':', Object.keys(translations).length, 'keys');
  console.log('📚 Available translation keys:', Object.keys(translations));

  const setCurrentLanguage = useCallback(async (language: string) => {
    console.log('🌐 Changing language from', currentLanguage, 'to', language);
    
    // Update state immediately
    setCurrentLanguageState(language);
    localStorage.setItem('language', language);
    
    // Force immediate refetch of translations with a small delay
    setTimeout(async () => {
      await refetchTranslations();
      console.log('🔄 Translations refetched for language:', language);
      
      // Force a re-render by invalidating the query cache
      queryClient.invalidateQueries({ queryKey: ['translations'] });
    }, 50);
  }, [currentLanguage, queryClient, refetchTranslations]);

  const t = (key: string, fallback?: string): string => {
    const translation = translations[key] || fallback || key;
    console.log(`🔤 Translation for "${key}":`, translation, '(from', Object.keys(translations).length, 'available translations)');
    return translation;
  };

  useEffect(() => {
    // Detect browser language on first visit
    const savedLanguage = localStorage.getItem('language');
    if (!savedLanguage && languages.length > 0) {
      const browserLanguage = navigator.language.slice(0, 2);
      const supportedLanguages = languages.map(lang => lang.code);
      console.log('🌍 Browser language:', browserLanguage, 'Supported:', supportedLanguages);
      if (supportedLanguages.includes(browserLanguage)) {
        setCurrentLanguage(browserLanguage);
      }
    }
  }, [languages, setCurrentLanguage]);

  // Force re-render when translations change
  useEffect(() => {
    console.log('📱 Translations updated, context will re-render components');
  }, [translations, currentLanguage]);

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
