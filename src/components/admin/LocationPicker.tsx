
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
      if (inputRef.current && g && g.maps && g.maps.places) {
        const opts: any = {
          // restituisci i campi necessari per aggiornare input e nazione
          fields: ['formatted_address', 'name', 'address_components', 'geometry'],
        };
        const ac = new g.maps.places.Autocomplete(inputRef.current, opts);
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          const label = place.formatted_address || place.name || inputRef.current?.value || '';
          lastSelectTs.current = Date.now();
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
          // Chiudi il menu e rimuovi focus per evitare riaperture
          inputRef.current?.blur();
        });
        autocompleteRef.current = ac;
        setIsReady(true);
      }
    } catch (e) {
      console.error('Google Maps Places load error:', e);
      setIsReady(false);
    } finally {
      setIsActivating(false);
    }
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
