export const backendConfig = {
  mode: 'api' as const,
  // Fallback di sicurezza: se la variabile non è definita, usa l'API pubblica di produzione
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'https://weapnea-api.onrender.com',
  googleMapsKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined,
} as const;
