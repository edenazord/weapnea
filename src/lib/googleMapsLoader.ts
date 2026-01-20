import { backendConfig } from '@/lib/backendConfig';

let mapsPromise: Promise<any> | null = null;

/**
 * Attende che importLibrary sia disponibile (con retry)
 */
async function waitForImportLibrary(maxWait = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const google = (window as any).google;
    if (google?.maps?.importLibrary) {
      return true;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

/**
 * Carica lo script di Google Maps JS API una sola volta.
 * Forza sempre il reload se lo script esistente non supporta importLibrary.
 */
export function loadGoogleMaps(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only be loaded in the browser'));
  }
  
  // Se Google Maps è già caricato con importLibrary, usa quello
  const google = (window as any).google;
  if (google?.maps?.importLibrary) {
    return Promise.resolve(google);
  }
  
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    // Rimuovi script esistente se non supporta importLibrary
    const existing = document.getElementById('google-maps-js');
    if (existing) {
      existing.remove();
      // Pulisci anche l'oggetto google
      delete (window as any).google;
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
    script.onload = async () => {
      // Attendi che importLibrary sia effettivamente disponibile
      const ready = await waitForImportLibrary();
      if (ready) {
        resolve((window as any).google);
      } else {
        reject(new Error('Google Maps importLibrary not available after load'));
      }
    };
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
