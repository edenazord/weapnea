// Consenti override via variabile d'ambiente Vite (VITE_API_BASE_URL),
// mantenendo l'istanza Render come fallback per retrocompatibilità.
const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL)
  ? (import.meta as any).env.VITE_API_BASE_URL
  : 'https://weapnea-api.onrender.com';

export const backendConfig = {
  mode: 'api' as const,
  apiBaseUrl: API_BASE,
  // Preferisci la chiave dalle variabili d'ambiente; in assenza usa il fallback fornito
  googleMapsKey: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY)
    ? (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY
    : 'AIzaSyD8GJLKLVWr5fQAC2m3oBRudVB3dLfg_Yc',
} as const;
