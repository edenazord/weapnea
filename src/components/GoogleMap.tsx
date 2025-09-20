
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Navigation } from 'lucide-react';

interface GoogleMapProps {
  location: string;
  eventTitle: string;
}

export function GoogleMap({ location, eventTitle }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<any | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  // Use the same API key as LocationPicker
  const apiKey = 'AIzaSyAqElXam6W92Vr48oD7mFePFhbRlsON7Y4';

  useEffect(() => {
    console.log('🗺️ GoogleMap: Initializing for location:', location);
    loadGoogleMapsAPI();
  }, []);

  useEffect(() => {
    if (isLoaded && location) {
      geocodeLocation(location);
    }
  }, [isLoaded, location]);

  const loadGoogleMapsAPI = () => {
    if (window.google && window.google.maps) {
      console.log('🗺️ GoogleMap: Google Maps already loaded');
      setIsLoaded(true);
      return;
    }

    console.log('🗺️ GoogleMap: Loading Google Maps script...');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => {
      console.log('🗺️ GoogleMap: Google Maps script loaded successfully');
      setIsLoaded(true);
    };
    script.onerror = () => {
      console.error('🗺️ GoogleMap: Failed to load Google Maps script');
    };
    document.head.appendChild(script);
  };

  const geocodeLocation = async (address: string) => {
    if (!window.google || !window.google.maps) {
      console.error('🗺️ GoogleMap: Google Maps not available for geocoding');
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    
    try {
      const results = await new Promise<any>((resolve, reject) => {
        geocoder.geocode({ address }, (results: any, status: any) => {
          if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
            resolve(results[0]);
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });

      const coords = {
        lat: results.geometry.location.lat(),
        lng: results.geometry.location.lng()
      };
      
      console.log('🗺️ GoogleMap: Geocoded coordinates:', coords);
      setCoordinates(coords);
      initializeMap(coords);
    } catch (error) {
      console.error('🗺️ GoogleMap: Geocoding error:', error);
    }
  };

  const initializeMap = (coords: { lat: number; lng: number }) => {
    if (!mapRef.current || !window.google) return;

    console.log('🗺️ GoogleMap: Initializing map with coordinates:', coords);

    const map = new window.google.maps.Map(mapRef.current, {
      center: coords,
      zoom: 15,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP
    });

    // Add marker
    const marker = new window.google.maps.Marker({
      position: coords,
      map: map,
      title: eventTitle,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#2563eb"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(32, 32),
        anchor: new window.google.maps.Point(16, 32)
      }
    });

    // Add info window
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 200px;">
          <h3 style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold; color: #1f2937;">${eventTitle}</h3>
          <p style="margin: 0; font-size: 12px; color: #6b7280;">${location}</p>
        </div>
      `
    });

    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });

    setMapInstance(map);
  };

  const handleGetDirections = () => {
    if (coordinates) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}&travelmode=driving`;
      window.open(url, '_blank');
    } else {
      // Fallback to search
      const searchQuery = encodeURIComponent(location);
      const url = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
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
      <Button 
        onClick={handleGetDirections}
        className="w-full"
        variant="outline"
      >
        <Navigation className="mr-2 h-4 w-4" />
        Ottieni indicazioni
      </Button>
    </div>
  );
}
