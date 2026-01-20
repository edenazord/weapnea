
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Navigation } from 'lucide-react';
import { loadGeocodingLibrary, loadMapsLibrary, loadMarkerLibrary } from '@/lib/googleMapsLoader';
import { useLanguage } from '@/contexts/LanguageContext';

interface GoogleMapProps {
  location: string;
  eventTitle: string;
}

export function GoogleMap({ location, eventTitle }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<any | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoderRef, setGeocoderRef] = useState<any | null>(null);
  const [MapClass, setMapClass] = useState<any | null>(null);
  const [MarkerClass, setMarkerClass] = useState<any | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    let cancelled = false;
    
    const loadLibraries = async () => {
      try {
        // Carica tutte le librerie necessarie in parallelo
        const [geocodingLib, mapsLib, markerLib] = await Promise.all([
          loadGeocodingLibrary(),
          loadMapsLibrary(),
          loadMarkerLibrary(),
        ]);
        
        if (!cancelled) {
          setGeocoderRef(new geocodingLib.Geocoder());
          setMapClass(() => mapsLib.Map);
          setMarkerClass(() => markerLib.AdvancedMarkerElement || markerLib.Marker);
          setIsLoaded(true);
        }
      } catch (e) {
        console.error('Google Maps load error:', e);
      }
    };
    
    loadLibraries();
    
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !location || !geocoderRef) return;
    geocodeWithGoogle(location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, location, geocoderRef]);

  const geocodeWithGoogle = (address: string) => {
    try {
      if (!geocoderRef) return;
      
      geocoderRef.geocode({ address, region: 'IT' }, (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          const coords = { lat: loc.lat(), lng: loc.lng() };
          setCoordinates(coords);
          initializeGoogleMap(coords);
        } else {
          console.warn('Geocoding fallito:', status);
        }
      });
    } catch (e) {
      console.error('Google Geocoding error:', e);
    }
  };

  const initializeGoogleMap = (coords: { lat: number; lng: number }) => {
    if (!mapRef.current || !MapClass) return;

    let map = mapInstance;
    if (!map) {
      map = new MapClass(mapRef.current, {
        center: coords,
        zoom: 15,
        fullscreenControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        mapId: 'weapnea-map', // Necessario per AdvancedMarkerElement
      });
      setMapInstance(map);
    } else {
      map.setCenter(coords);
      map.setZoom(15);
    }

    // Usa AdvancedMarkerElement se disponibile, altrimenti fallback
    if (MarkerClass) {
      try {
        new MarkerClass({
          position: coords,
          map,
          title: eventTitle,
        });
      } catch (e) {
        // Fallback per marker legacy se AdvancedMarkerElement non funziona
        console.warn('Marker creation warning:', e);
      }
    }
  };

  const handleGetDirections = () => {
    if (coordinates) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}`;
      window.open(url, '_blank');
    } else {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
      window.open(url, '_blank');
    }
  };

  if (!isLoaded) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-2"></div>
          <p className="text-gray-600">{t('common.loading_map', 'Caricamento mappa...')}</p>
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
          Impossibile geocodificare l'indirizzo. Puoi cercarlo direttamente su Google Maps.
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
// Legacy OSM/Leaflet implementation: rimosso in favore di Google Maps
*/
