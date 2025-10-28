
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
  const [isActivating, setIsActivating] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any | null>(null);
  const lastSelectTs = useRef<number>(0);
  const initializedRef = useRef<boolean>(false);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Lazy init su focus per evitare apertura suggerimenti al mount
  const ensureAutocomplete = async () => {
    if (autocompleteRef.current) return;
    try {
      setIsActivating(true);
      await loadGoogleMaps();
      const g = (window as any).google;
      if (g && g.maps && g.maps.places && inputRef.current && !initializedRef.current) {
        // Usa la classica API Autocomplete agganciata all'input
        const ac = new g.maps.places.Autocomplete(inputRef.current, {
          // types: ['geocode'], // opzionale
          fields: ['formatted_address', 'name', 'address_components', 'geometry'],
        });
        const handler = () => {
          const place = ac.getPlace() || {};
          const label = place.formatted_address || place.name || inputRef.current?.value || '';
          lastSelectTs.current = Date.now();
          setInputValue(label);
          onChange(label);
          if (onPlaceSelected) {
            const comps: AddressComponents = {};
            const addr = (place as any).address_components || [];
            addr.forEach((c: any) => {
              const key = (Array.isArray(c.types) && c.types[0]) || c.short_name || 'unknown';
              comps[key] = c.long_name || c.short_name;
            });
            onPlaceSelected({ label, address: comps });
          }
        };
        ac.addListener('place_changed', handler);
        autocompleteRef.current = ac;
        initializedRef.current = true;
        setIsReady(true);
      }
    } catch (e) {
      console.error('Google Maps Places load error:', e);
      setIsReady(false);
    } finally {
      setIsActivating(false);
    }
  };
  
  // Permetti il click sui suggerimenti senza perdere il focus (lascia la selezione a Google)
  useEffect(() => {
    const isInsidePac = (e: Event) => {
      const path = (e as any).composedPath ? (e as any).composedPath() : undefined;
      const target = e.target as HTMLElement | null;
      if (path && Array.isArray(path)) {
        return path.some((el: any) => el && el.classList && (el.classList.contains('pac-container') || el.classList.contains('pac-item')));
      }
      if (target) {
        return !!target.closest('.pac-container, .pac-item');
      }
      return false;
    };

    const onMouseDown = (e: Event) => {
      if (isInsidePac(e)) {
        // Evita il blur dell'input. Non blocchiamo la propagazione così Google gestisce la selezione.
        e.preventDefault();
      }
    };
    const onTouchStart = (e: Event) => {
      if (isInsidePac(e)) {
        e.preventDefault();
      }
    };

    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('touchstart', onTouchStart as any, { capture: true, passive: false } as any);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('touchstart', onTouchStart as any, { capture: true } as any);
    };
  }, []);
  
  // Cleanup Autocomplete on unmount
  useEffect(() => {
    return () => {
      if (autocompleteRef.current) {
        try {
          // Non esiste un destroy pubblico; rimuovere riferimenti lascia al GC
          autocompleteRef.current = null;
        } catch {
          // ignore
        }
      }
    };
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
              if (!autocompleteRef.current) {
                // Inizializza solo quando l'utente inizia a digitare
                ensureAutocomplete();
              }
              if (Date.now() - lastSelectTs.current < 300) {
                // Evita che un onChange immediatamente successivo alla selezione sovrascriva il valore scelto
                return;
              }
              setInputValue(v);
              onChange(v);
            }}
            onFocus={() => {
              if (!autocompleteRef.current) ensureAutocomplete();
            }}
            onKeyDown={(e) => {
              if (!autocompleteRef.current) ensureAutocomplete();
              if (e.key === 'Enter') {
                // Evita submit del form quando si seleziona un suggerimento
                e.preventDefault();
              }
            }}
            onBlur={() => { /* Nessun auto-resolve: gestito da Places */ }}
            autoComplete="off"
            placeholder={placeholder}
            ref={inputRef}
            className="pl-10"
          />
          {(isActivating || (!isReady && document.activeElement === inputRef.current)) && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
