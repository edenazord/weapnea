
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
  const widgetRef = useRef<HTMLElement | null>(null);
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
        // Nuovo elemento ufficiale PlaceAutocompleteElement
        const el: any = new g.maps.places.PlaceAutocompleteElement();
        // Collega il nostro input esistente
        el.inputElement = inputRef.current;
        // Campi che ci servono quando cambia il place
        el.fields = ['formatted_address','name','address_components','geometry'];
        const handler = () => {
          const place = el.value?.place || el.place || el.value || {};
          const label = place.formattedAddress || place.displayName || place.formatted_address || place.name || inputRef.current?.value || '';
          lastSelectTs.current = Date.now();
          setInputValue(label);
          onChange(label);
          if (onPlaceSelected) {
            const comps: AddressComponents = {};
            const addr = place.addressComponents || place.address_components || [];
            addr.forEach((c: any) => {
              const key = (Array.isArray(c.types) && c.types[0]) || c.shortText || c.short_name || 'unknown';
              comps[key] = c.longText || c.long_name || c.shortText || c.short_name;
            });
            onPlaceSelected({ label, address: comps });
          }
        };
        // L'elemento deve essere nel DOM per funzionare correttamente
        document.body.appendChild(el);
        widgetRef.current = el as HTMLElement;
        // Ascolta sia 'placechange' che varianti gmp per compatibilità
        el.addEventListener('placechange', handler as EventListener);
        el.addEventListener('gmp-placechange', handler as EventListener);
        // Segnaposto per gating init
        autocompleteRef.current = el;
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

  // Evita che il blur dell'input interrompa la selezione: previeni il mousedown sui suggerimenti
  // Affidati al click native di Google: niente prevenzione globale degli eventi
  useEffect(() => {
    const onPointerDownCapture = (e: Event) => {
      const path = (e as any).composedPath ? (e as any).composedPath() : undefined;
      const target = e.target as HTMLElement | null;
      const insideWidget = (path && widgetRef.current && path.includes(widgetRef.current)) || (target && widgetRef.current && widgetRef.current.contains(target));
      if (insideWidget) {
        // Evita che il click nei suggerimenti venga interpretato come outside-click dal modal
        e.stopPropagation();
      }
    };
    document.addEventListener('pointerdown', onPointerDownCapture, true);
    document.addEventListener('mousedown', onPointerDownCapture, true);
    document.addEventListener('touchstart', onPointerDownCapture as any, { capture: true, passive: false } as any);
    return () => {
      document.removeEventListener('pointerdown', onPointerDownCapture, true);
      document.removeEventListener('mousedown', onPointerDownCapture, true);
      document.removeEventListener('touchstart', onPointerDownCapture as any, { capture: true } as any);
    };
  }, []);

  // Cleanup del widget al smontaggio del componente
  useEffect(() => {
    return () => {
      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
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
