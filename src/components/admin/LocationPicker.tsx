
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';

interface LocationPickerProps {
  value: string;
  onChange: (location: string) => void;
  placeholder?: string;
  onPlaceSelected?: (info: { label: string; address?: Record<string, string> }) => void;
  autoResolveOnBlur?: boolean;
}

type AddressComponents = Record<string, string>;

export function LocationPicker({ value, onChange, placeholder = "Cerca una località...", onPlaceSelected, autoResolveOnBlur = true }: LocationPickerProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [isReady, setIsReady] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any | null>(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled) return;
        const g = (window as any).google;
        if (inputRef.current && g && g.maps && g.maps.places) {
          const opts: any = { /* no restrictions: allow addresses and regions globally */ };
          const ac = new g.maps.places.Autocomplete(inputRef.current, opts);
          ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            const label = place.formatted_address || place.name || inputRef.current?.value || '';
            setInputValue(label);
            onChange(label);
            if (onPlaceSelected) {
              const comps: AddressComponents = {};
              (place.address_components || []).forEach((c: any) => {
                const key = (c.types && c.types[0]) || c.short_name || 'unknown';
                comps[key] = c.long_name || c.short_name;
              });
              onPlaceSelected({ label, address: comps });
            }
          });
          autocompleteRef.current = ac;
          setIsReady(true);
        }
      })
      .catch((e) => {
        console.error('Google Maps Places load error:', e);
        setIsReady(false);
      });
    return () => {
      cancelled = true;
    };
    // onChange/onPlaceSelected sono callback esterne stabili in questo contesto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            onFocus={() => { /* Nessun dropdown custom: gestito da Google */ }}
            onBlur={() => { /* Nessun auto-resolve: gestito da Places */ }}
            placeholder={placeholder}
            ref={inputRef}
            className="pl-10"
          />
          {!isReady && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
