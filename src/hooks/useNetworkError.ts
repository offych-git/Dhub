
import { useState, useEffect } from 'react';

export const useNetworkError = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [retryCount, setRetryCount] = useState(0);
  
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const retryFetch = async (fetchFunc) => {
    const maxRetries = 3;
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        setRetryCount(i + 1);
        return await fetchFunc();
      } catch (err) {
        lastError = err;
        // Увеличиваем время ожидания с каждой попыткой
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
    
    setRetryCount(0);
    throw lastError;
  };
  
  return {
    isOffline,
    retryCount,
    retryFetch
  };
};
