import { backendConfig } from '@/lib/backendConfig';

let mapsPromise: Promise<any> | null = null;

/**
 * Carica lo script di Google Maps JS API (con Places) una sola volta e restituisce l'oggetto google.
 */
export function loadGoogleMaps(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only be loaded in the browser'));
  }
  if ((window as any).google && (window as any).google.maps) {
    return Promise.resolve((window as any).google);
  }
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('google-maps-js');
    if (existing) {
      (existing as HTMLScriptElement).addEventListener('load', () => resolve((window as any).google));
      (existing as HTMLScriptElement).addEventListener('error', () => reject(new Error('Google Maps failed to load')));
      return;
    }

    const apiKey = backendConfig.googleMapsKey;
    if (!apiKey) {
      reject(new Error('Google Maps API key missing'));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-js';
    script.async = true;
    script.defer = true;
    // v=weekly per avere aggiornamenti regolari, libraries=places per Autocomplete
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&language=it&region=IT`;
    script.onload = () => resolve((window as any).google);
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.body.appendChild(script);
  });

  return mapsPromise;
}
