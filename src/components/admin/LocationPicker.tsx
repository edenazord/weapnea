
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Search } from 'lucide-react';

interface LocationPickerProps {
  value: string;
  onChange: (location: string) => void;
  placeholder?: string;
}

export function LocationPicker({ value, onChange, placeholder = "Cerca una località..." }: LocationPickerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  const autocompleteService = useRef<any>(null);
  const placesService = useRef<any>(null);

  // Use the provided API key directly
  const apiKey = 'AIzaSyAqElXam6W92Vr48oD7mFePFhbRlsON7Y4';

  useEffect(() => {
    console.log('🗺️ LocationPicker: Initializing Google Maps...');
    loadGoogleMapsAPI(apiKey);
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const loadGoogleMapsAPI = (key: string) => {
    if (window.google && window.google.maps && window.google.maps.places) {
      console.log('🗺️ LocationPicker: Google Maps already loaded');
      setIsLoaded(true);
      initializeServices();
      return;
    }

    console.log('🗺️ LocationPicker: Loading Google Maps script...');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.onload = () => {
      console.log('🗺️ LocationPicker: Google Maps script loaded successfully');
      setIsLoaded(true);
      initializeServices();
    };
    script.onerror = () => {
      console.error('🗺️ LocationPicker: Failed to load Google Maps script');
    };
    document.head.appendChild(script);
  };

  const initializeServices = () => {
    if (window.google && window.google.maps && window.google.maps.places) {
      try {
        console.log('🗺️ LocationPicker: Initializing services...');
        autocompleteService.current = new window.google.maps.places.AutocompleteService();
        
        // Create a hidden div for PlacesService
        const mapDiv = document.createElement('div');
        const map = new window.google.maps.Map(mapDiv);
        placesService.current = new window.google.maps.places.PlacesService(map);
        console.log('🗺️ LocationPicker: Services initialized successfully');
      } catch (error) {
        console.error('🗺️ LocationPicker: Error initializing services:', error);
      }
    } else {
      console.error('🗺️ LocationPicker: Google Maps not available for service initialization');
    }
  };

  const searchPredictions = useCallback((input: string) => {
    console.log('🔍 LocationPicker: Searching for:', input);
    
    if (!autocompleteService.current) {
      console.warn('🔍 LocationPicker: AutocompleteService not initialized');
      return;
    }

    if (input.length < 2) {
      console.log('🔍 LocationPicker: Input too short, clearing predictions');
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    setIsSearching(true);

    autocompleteService.current.getPlacePredictions(
      {
        input,
        types: ['establishment', 'geocode'],
      },
      (predictions: any, status: any) => {
        setIsSearching(false);
        console.log('🔍 LocationPicker: Predictions response:', { predictions, status });
        
        if (status === window.google?.maps?.places?.PlacesServiceStatus?.OK && predictions) {
          console.log('🔍 LocationPicker: Found', predictions.length, 'predictions');
          setPredictions(predictions);
          setShowPredictions(true);
        } else {
          console.warn('🔍 LocationPicker: No predictions or error:', status);
          setPredictions([]);
          setShowPredictions(false);
        }
      }
    );
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    console.log('🔤 LocationPicker: Input changed to:', newValue);
    setInputValue(newValue);
    
    if (isLoaded && autocompleteService.current) {
      searchPredictions(newValue);
    } else {
      console.warn('🔤 LocationPicker: Services not ready, setting value directly');
      onChange(newValue);
    }
  };

  const handlePredictionClick = (prediction: any) => {
    console.log('🎯 LocationPicker: Prediction selected:', prediction.description);
    setInputValue(prediction.description);
    onChange(prediction.description);
    setShowPredictions(false);
    setPredictions([]);
  };

  const handleInputFocus = () => {
    console.log('🎯 LocationPicker: Input focused, predictions length:', predictions.length);
    if (predictions.length > 0) {
      setShowPredictions(true);
    }
  };

  const handleBlur = () => {
    console.log('🎯 LocationPicker: Input blurred');
    // Delay hiding predictions to allow for clicks
    setTimeout(() => {
      setShowPredictions(false);
    }, 200);
    
    // Update the final value
    onChange(inputValue);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            className="pl-10"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
            </div>
          )}
        </div>
        
        {!isLoaded && (
          <div className="absolute z-50 w-full mt-1 bg-yellow-50 border border-yellow-200 rounded-md p-2">
            <p className="text-sm text-yellow-800">Caricamento Google Maps...</p>
          </div>
        )}
        
        {showPredictions && predictions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {predictions.map((prediction) => (
              <button
                key={prediction.place_id}
                type="button"
                className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0"
                onClick={() => handlePredictionClick(prediction)}
              >
                <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {prediction.structured_formatting?.main_text || prediction.description}
                  </div>
                  {prediction.structured_formatting?.secondary_text && (
                    <div className="text-xs text-gray-500 truncate">
                      {prediction.structured_formatting.secondary_text}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        
        {showPredictions && predictions.length === 0 && inputValue.length >= 2 && !isSearching && isLoaded && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4">
            <p className="text-sm text-gray-500">Nessun risultato trovato</p>
          </div>
        )}
      </div>
    </div>
  );
}
