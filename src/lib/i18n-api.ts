
// Deprecated: i18n now loads from JSON files in /public/locales. See src/lib/i18n-loader.ts
export type Language = never;
export type Translation = never;

export const getLanguages = async (): Promise<never> => {
  throw new Error('Deprecated: use loadLanguages() from i18n-loader');
};

export const getTranslations = async (_languageCode: string): Promise<never> => {
  throw new Error('Deprecated: use loadTranslations() from i18n-loader');
};

export const getTranslationsByKeys = async (_keys: string[], _languageCode: string): Promise<never> => {
  throw new Error('Deprecated: use loadTranslations() from i18n-loader');
};
