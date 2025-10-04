export const backendConfig = {
  mode: 'api' as const,
  // Forziamo l'API di produzione per evitare qualunque riferimento a localhost
  apiBaseUrl: 'https://weapnea-api.onrender.com',
  googleMapsKey: undefined,
} as const;
