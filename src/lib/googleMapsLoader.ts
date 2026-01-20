import { backendConfig } from '@/lib/backendConfig';

let mapsPromise: Promise<any> | null = null;

/**
 * Carica lo script di Google Maps JS API (con Places New) una sola volta e restituisce l'oggetto google.
 * Usa la nuova Places API con importLibrary().
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
    // Usa la nuova API con loading=async per supportare importLibrary()
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&language=it&region=IT`;
    script.onload = () => resolve((window as any).google);
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.body.appendChild(script);
  });

  return mapsPromise;
}

/**
 * Carica la libreria Places (New) usando importLibrary
 */
export async function loadPlacesLibrary(): Promise<any> {
  await loadGoogleMaps();
  const google = (window as any).google;
  if (!google?.maps?.importLibrary) {
    throw new Error('Google Maps importLibrary not available');
  }
  return google.maps.importLibrary('places');
}

/**
 * Carica la libreria Geocoding usando importLibrary
 */
export async function loadGeocodingLibrary(): Promise<any> {
  await loadGoogleMaps();
  const google = (window as any).google;
  if (!google?.maps?.importLibrary) {
    throw new Error('Google Maps importLibrary not available');
  }
  return google.maps.importLibrary('geocoding');
}

/**
 * Carica la libreria Maps (core) usando importLibrary
 */
export async function loadMapsLibrary(): Promise<any> {
  await loadGoogleMaps();
  const google = (window as any).google;
  if (!google?.maps?.importLibrary) {
    throw new Error('Google Maps importLibrary not available');
  }
  return google.maps.importLibrary('maps');
}

/**
 * Carica la libreria Marker usando importLibrary
 */
export async function loadMarkerLibrary(): Promise<any> {
  await loadGoogleMaps();
  const google = (window as any).google;
  if (!google?.maps?.importLibrary) {
    throw new Error('Google Maps importLibrary not available');
  }
  return google.maps.importLibrary('marker');
}
