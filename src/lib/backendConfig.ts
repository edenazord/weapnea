export const backendConfig = {
  mode: 'api' as const,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL as string | undefined,
  googleMapsKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined,
} as const;
