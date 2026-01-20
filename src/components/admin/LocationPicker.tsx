
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { loadPlacesLibrary } from '@/lib/googleMapsLoader';

interface LocationPickerProps {
  value: string;
  onChange: (location: string) => void;
  placeholder?: string;
  onPlaceSelected?: (info: { label: string; address?: Record<string, string> }) => void;
  autoResolveOnBlur?: boolean;
}

type AddressComponents = Record<string, string>;

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

export function LocationPicker({ value, onChange, placeholder = "Cerca una località...", onPlaceSelected, autoResolveOnBlur = true }: LocationPickerProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteServiceRef = useRef<any | null>(null);
  const placesServiceRef = useRef<any | null>(null);
  const sessionTokenRef = useRef<any | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Inizializza Places API (New)
  const ensurePlacesService = useCallback(async () => {
    if (autocompleteServiceRef.current) return;
    try {
      setIsLoading(true);
      const placesLib = await loadPlacesLibrary();
      const google = (window as any).google;
      
      // Crea AutocompleteService e PlacesService per la nuova API
      autocompleteServiceRef.current = new placesLib.AutocompleteService();
      
      // Per Place Details usiamo il nuovo Place class
      placesServiceRef.current = placesLib.Place;
      
      // Session token per raggruppare le richieste (risparmio costi)
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      
      setIsReady(true);
    } catch (e) {
      console.error('Google Places API load error:', e);
      setIsReady(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !autocompleteServiceRef.current) {
      setSuggestions([]);
      return;
    }

    try {
      const request = {
        input: query,
        sessionToken: sessionTokenRef.current,
        language: 'it',
        region: 'it',
      };

      autocompleteServiceRef.current.getPlacePredictions(
        request,
        (predictions: any[] | null, status: string) => {
          if (status === 'OK' && predictions) {
            const mapped: Suggestion[] = predictions.map((p) => ({
              placeId: p.place_id,
              mainText: p.structured_formatting?.main_text || p.description,
              secondaryText: p.structured_formatting?.secondary_text || '',
              fullText: p.description,
            }));
            setSuggestions(mapped);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
          }
        }
      );
    } catch (e) {
      console.error('Error fetching suggestions:', e);
      setSuggestions([]);
    }
  }, []);

  // Debounced search
  const debouncedSearch = useCallback((query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 300);
  }, [fetchSuggestions]);

  // Select a place
  const selectPlace = useCallback(async (suggestion: Suggestion) => {
    setInputValue(suggestion.fullText);
    onChange(suggestion.fullText);
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);

    // Rinnova il session token dopo la selezione
    const google = (window as any).google;
    if (google?.maps?.places?.AutocompleteSessionToken) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }

    // Fetch place details se serve
    if (onPlaceSelected && placesServiceRef.current) {
      try {
        const place = new placesServiceRef.current({
          id: suggestion.placeId,
          requestedLanguage: 'it',
        });
        
        await place.fetchFields({
          fields: ['formattedAddress', 'addressComponents', 'displayName'],
        });

        const comps: AddressComponents = {};
        const addressComponents = place.addressComponents || [];
        addressComponents.forEach((c: any) => {
          const key = (Array.isArray(c.types) && c.types[0]) || 'unknown';
          comps[key] = c.longText || c.shortText;
        });

        onPlaceSelected({
          label: place.formattedAddress || suggestion.fullText,
          address: comps,
        });
      } catch (e) {
        console.error('Error fetching place details:', e);
        onPlaceSelected({ label: suggestion.fullText });
      }
    }
  }, [onChange, onPlaceSelected]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') e.preventDefault();
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          selectPlace(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={inputValue}
            onChange={(e) => {
              const v = e.target.value;
              setInputValue(v);
              onChange(v);
              if (!autocompleteServiceRef.current) {
                ensurePlacesService();
              }
              debouncedSearch(v);
            }}
            onFocus={() => {
              if (!autocompleteServiceRef.current) ensurePlacesService();
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            placeholder={placeholder}
            ref={inputRef}
            className="pl-10"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
            </div>
          )}
        </div>
        
        {/* Dropdown suggerimenti */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.placeId}
                className={`px-4 py-2 cursor-pointer ${
                  index === highlightedIndex 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => selectPlace(suggestion)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="font-medium text-sm">{suggestion.mainText}</div>
                {suggestion.secondaryText && (
                  <div className="text-xs text-gray-500">{suggestion.secondaryText}</div>
                )}
              </div>
            ))}
            <div className="px-4 py-1 text-xs text-gray-400 border-t">
              Powered by Google
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
