
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Navigation } from 'lucide-react';

interface GoogleMapProps {
  location: string;
  eventTitle: string;
}

// OpenStreetMap + Leaflet (via CDN) con geocoding Nominatim (gratuito)
export function GoogleMap({ location, eventTitle }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<any | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    loadLeaflet().then(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    if (!isLoaded || !location) return;
    geocodeWithNominatim(location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, location]);

  const loadLeaflet = async (): Promise<void> => {
    // Se Leaflet è già presente
    if ((window as any).L) return;

    // CSS
    const cssId = 'leaflet-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // JS
    await new Promise<void>((resolve, reject) => {
      const jsId = 'leaflet-js';
      if (document.getElementById(jsId)) return resolve();
      const script = document.createElement('script');
      script.id = jsId;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Leaflet load failed'));
      document.body.appendChild(script);
    });
  };

  const geocodeWithNominatim = async (address: string) => {
    try {
      const normalized = normalizeAddress(address);
      // Primo tentativo: bias Italia
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=it&addressdetails=1&q=${encodeURIComponent(normalized)}&limit=1`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
          // Nominatim raccomanda un User-Agent identificativo
          'User-Agent': 'weapnea.com (contact: noreply@weapnea.com)'
        }
      });
      if (!res.ok) throw new Error('Geocoding failed');
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        // Secondo tentativo: senza bias paese
  const url2 = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(normalized)}&limit=1`;
  const res2 = await fetch(url2, { headers: { 'Accept': 'application/json', 'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7', 'User-Agent': 'weapnea.com (contact: noreply@weapnea.com)' } });
        const data2 = res2.ok ? await res2.json() : [];
        if (!Array.isArray(data2) || data2.length === 0) {
          // Terzo tentativo: fallback a Photon
          const pRes = await fetch(`https://photon.komoot.io/api/?lang=it&q=${encodeURIComponent(normalized)}&limit=1`);
          const pJson = pRes.ok ? await pRes.json() : null;
          const feat = pJson?.features?.[0];
          if (feat?.geometry?.coordinates) {
            const [lon, lat] = feat.geometry.coordinates;
            const coords = { lat, lng: lon };
            setCoordinates(coords);
            initializeLeafletMap(coords);
            return;
          }
          throw new Error('No results');
        } else {
          const lat = parseFloat(data2[0].lat);
          const lon = parseFloat(data2[0].lon);
          const coords = { lat, lng: lon };
          setCoordinates(coords);
          initializeLeafletMap(coords);
          return;
        }
      }

      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      const coords = { lat, lng: lon };
      setCoordinates(coords);
      initializeLeafletMap(coords);
    } catch (e) {
      console.error('🗺️ OSM Geocoding error:', e);
    }
  };

  // Normalizza alcuni elementi comuni italiani per aiutare il geocoder OSM
  const normalizeAddress = (addr: string): string => {
    let s = addr.trim();
    // Espansione province comuni (parziale)
    const provinceMap: Record<string, string> = {
      ' PD': ' Padova',
      ' RM': ' Roma',
      ' MI': ' Milano',
      ' VE': ' Venezia',
    };
    // sostituisci pattern come ", PD" o " PD" in Padova
    for (const abbr in provinceMap) {
      const full = provinceMap[abbr];
      s = s.replace(new RegExp(`,?${abbr}(,|$)`,'g'), `,${full}$1`);
    }
    // Rimuovi doppi spazi
    s = s.replace(/\s{2,}/g, ' ');
    return s;
  };

  const initializeLeafletMap = (coords: { lat: number; lng: number }) => {
    const L = (window as any).L;
    if (!mapRef.current || !L) return;

    // Se la mappa esiste già, aggiorno solo la view/marker
    let map = mapInstance;
    if (!map) {
      map = L.map(mapRef.current).setView([coords.lat, coords.lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      setMapInstance(map);
    } else {
      map.setView([coords.lat, coords.lng], 15);
    }

    // Aggiungi marker
    L.marker([coords.lat, coords.lng]).addTo(map).bindPopup(
      `<div style="padding: 6px; max-width: 220px;">
        <strong style="display:block; color:#1f2937;">${escapeHtml(eventTitle)}</strong>
        <span style="color:#4b5563; font-size:12px;">${escapeHtml(location)}</span>
      </div>`
    );
  };

  const escapeHtml = (s: string) => s.replace(/[&<>"]+/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string));

  const handleGetDirections = () => {
    if (coordinates) {
      const url = `https://www.openstreetmap.org/?mlat=${coordinates.lat}&mlon=${coordinates.lng}#map=16/${coordinates.lat}/${coordinates.lng}`;
      window.open(url, '_blank');
    } else {
      const searchQuery = encodeURIComponent(location);
      const url = `https://www.openstreetmap.org/search?query=${searchQuery}`;
      window.open(url, '_blank');
    }
  };

  if (!isLoaded) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-2"></div>
          <p className="text-gray-600">Caricamento mappa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={mapRef}
        className="w-full h-64 rounded-lg border border-gray-200 shadow-sm"
        style={{ minHeight: '256px' }}
      />
      {!coordinates && (
        <div className="text-xs text-gray-500">
          Impossibile geocodificare l'indirizzo. Puoi cercarlo direttamente su OpenStreetMap.
        </div>
      )}
      <Button onClick={handleGetDirections} className="w-full" variant="outline">
        <Navigation className="mr-2 h-4 w-4" />
        Ottieni indicazioni
      </Button>
    </div>
  );
}

/*
// Legacy Google Maps implementation (con API key): mantenuta per riuso futuro
// Abilitare Billing su Google Cloud e ripristinare questo blocco se si vuole tornare a Google Maps.
*/
