
import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Search } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface LocationPickerProps {
  value: string;
  onChange: (location: string) => void;
  placeholder?: string;
}

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: Record<string, string>;
};

export function LocationPicker({ value, onChange, placeholder = "Cerca una località..." }: LocationPickerProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const debouncedQuery = useDebounce(inputValue, 300);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    let cancelled = false;
    const search = async () => {
      try {
        setIsSearching(true);
        // Primo tentativo: preferisci Italia
        const urlIT = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=it&q=${encodeURIComponent(q)}`;
        const resIT = await fetch(urlIT, {
          headers: {
            'Accept': 'application/json',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            'User-Agent': 'weapnea.com (contact: noreply@weapnea.com)'
          }
        });
        let data: NominatimResult[] = resIT.ok ? await resIT.json() : [];
        if ((!data || data.length === 0)) {
          // Fallback: nessun bias di paese
          const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
          const res = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
              'User-Agent': 'weapnea.com (contact: noreply@weapnea.com)'
            }
          });
          data = res.ok ? await res.json() : [];
        }
        if (!cancelled) {
          setResults(Array.isArray(data) ? data : []);
          setShowResults(true);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Nominatim search error:', e);
          setResults([]);
          setShowResults(true);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };
    search();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const formatResult = (r: NominatimResult) => {
    // Preferisci una forma breve: città/comune + provincia/regione + paese
    const a = r.address || {};
    const city = a.city || a.town || a.village || a.hamlet || '';
    const state = a.state || a.region || a.county || '';
    const country = a.country || '';
    const parts = [city, state, country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : r.display_name;
  };

  const handleSelect = (r: NominatimResult) => {
    const label = formatResult(r);
    setInputValue(label);
    onChange(label);
    setShowResults(false);
    setResults([]);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={inputValue}
            onChange={(e) => {
              const v = e.target.value;
              setInputValue(v);
              onChange(v);
            }}
            onFocus={() => results.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
            placeholder={placeholder}
            className="pl-10"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
            </div>
          )}
        </div>

        {showResults && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {results.length > 0 ? (
              results.map((r) => (
                <button
                  key={r.place_id}
                  type="button"
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0"
                  onClick={() => handleSelect(r)}
                >
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {formatResult(r)}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {r.display_name}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-3 text-sm text-gray-500">Nessun risultato trovato</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
