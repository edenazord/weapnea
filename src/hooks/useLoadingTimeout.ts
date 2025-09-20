
import { useState, useEffect, useRef } from 'react';

interface UseLoadingTimeoutOptions {
  timeout?: number;
  onTimeout?: () => void;
}

export const useLoadingTimeout = (
  isLoading: boolean,
  options: UseLoadingTimeoutOptions = {}
) => {
  const { timeout = 60000, onTimeout } = options; // Aumentato a 60 secondi
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Solo se è in loading da molto tempo
    if (isLoading && !hasTimedOut) {
      timeoutRef.current = setTimeout(() => {
        setHasTimedOut(true);
        onTimeout?.();
        console.warn('Loading timeout raggiunto dopo 60 secondi');
      }, timeout);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (!isLoading) {
        setHasTimedOut(false);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, timeout, onTimeout, hasTimedOut]);

  return {
    hasTimedOut,
    resetTimeout: () => setHasTimedOut(false)
  };
};
