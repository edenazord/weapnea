
import { useState, useEffect } from 'react';

/**
 * Hook per "de-rimbalzare" un valore. Utile per ritardare l'esecuzione di
 * un'operazione costosa (es. una chiamata API) finché l'utente non ha smesso
 * di digitare per un certo intervallo di tempo.
 * @param value Il valore da "de-rimbalzare".
 * @param delay Il ritardo in millisecondi.
 * @returns Il valore "de-rimbalzato".
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Imposta un timer per aggiornare il valore "de-rimbalzato" dopo il ritardo specificato.
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Funzione di pulizia: annulla il timer se il valore o il ritardo cambiano prima
    // che il timer scada. Questo previene aggiornamenti non necessari.
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // L'effetto si riattiva solo se il valore o il ritardo cambiano.

  return debouncedValue;
}
