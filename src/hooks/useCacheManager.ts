
import { useCallback } from 'react';

export const useCacheManager = () => {
  const forceClearAllCache = useCallback(() => {
    console.log('🧹 Clearing cache...');
    try {
      // Clear only specific localStorage keys
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('app-cache-')) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('✅ Cache cleared successfully');
      return true;
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
      return false;
    }
  }, []);

  const setCacheItem = useCallback((key: string, data: any) => {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(`app-cache-${key}`, JSON.stringify(cacheItem));
    } catch (error) {
      console.error('❌ Error saving to cache:', error);
    }
  }, []);

  const getCacheItem = useCallback((key: string) => {
    try {
      const item = localStorage.getItem(`app-cache-${key}`);
      if (item) {
        const cacheItem = JSON.parse(item);
        return cacheItem.data;
      }
    } catch (error) {
      console.error('❌ Error retrieving from cache:', error);
    }
    return null;
  }, []);

  return {
    setCacheItem,
    getCacheItem,
    forceClearAllCache
  };
};
