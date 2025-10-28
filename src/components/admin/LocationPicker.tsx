
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
  const [previewValue, setPreviewValue] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any | null>(null);
  const lastSelectTs = useRef<number>(0);
  const initializedRef = useRef<boolean>(false);
  const pacCleanupRef = useRef<(() => void) | null>(null);

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
  
  // Rimuoviamo workaround sul mousedown: lasciamo che Google gestisca completamente il click sui suggerimenti
  // L'eventuale chiusura del modal è già gestita a livello di Sheet (onInteractOutside)

  // Aggancia anteprima al passaggio del mouse sui suggerimenti Google (senza confermare il valore)
  useEffect(() => {
    if (!isReady) return;
    // Potrebbero esserci più container; li gestiamo tutti
    const containers = Array.from(document.querySelectorAll('.pac-container')) as HTMLElement[];
    if (!containers.length) return;

    const getItemText = (el: HTMLElement) => (el.textContent || '').trim();

    const onOver = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const item = target ? target.closest('.pac-item') as HTMLElement | null : null;
      if (item) {
        const text = getItemText(item);
        if (text) setPreviewValue(text);
      }
    };
    const onLeave = () => {
      setPreviewValue(null);
    };

    containers.forEach(c => {
      c.addEventListener('mouseover', onOver, true);
      c.addEventListener('mouseleave', onLeave, true);
    });

    pacCleanupRef.current = () => {
      containers.forEach(c => {
        c.removeEventListener('mouseover', onOver, true);
        c.removeEventListener('mouseleave', onLeave, true);
      });
    };

    return () => {
      if (pacCleanupRef.current) pacCleanupRef.current();
      pacCleanupRef.current = null;
    };
  }, [isReady]);
  
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
            value={previewValue ?? inputValue}
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
              setPreviewValue(null);
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
            onBlur={() => { setPreviewValue(null); /* Nessun auto-resolve: gestito da Places */ }}
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
