import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

type Language = 'en' | 'ru' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallbackOrParams?: string | Record<string, any>) => string;
  isInitialized: boolean;
}

const LOCAL_STORAGE_LANGUAGE_KEY = 'appUserLanguage';

// Функции для работы с localStorage
function getLanguageFromLocalStorage(): Language | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    const lang = window.localStorage.getItem(LOCAL_STORAGE_LANGUAGE_KEY);
    if (lang === 'en' || lang === 'ru' || lang === 'es') return lang as Language;
  }
  return null;
}

function setLanguageToLocalStorage(lang: Language) {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(LOCAL_STORAGE_LANGUAGE_KEY, lang);
  }
}

// Функция для получения системного языка браузера
const getSystemLanguage = (): Language => {
  return 'en';
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string, fallbackOrParams?: string | Record<string, any>) => {
    return typeof fallbackOrParams === 'string' ? fallbackOrParams : key;
  },
  isInitialized: false,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isInitialized, setIsInitialized] = useState(false);

  // Загрузка сохраненного языка при инициализации
  useEffect(() => {
    const loadLanguage = () => {
      try {
        console.log('[LanguageContext] Loading language...');
        const savedLanguage = getLanguageFromLocalStorage();
        console.log('[LanguageContext] Saved language from localStorage:', savedLanguage);
        
        if (savedLanguage) {
          setLanguageState(savedLanguage);
        } else {
          const systemLang = getSystemLanguage();
          console.log('[LanguageContext] Using system language:', systemLang);
          setLanguageState(systemLang);
          setLanguageToLocalStorage(systemLang);
        }
      } catch (error) {
        console.error('[LanguageContext] Failed to load language from localStorage:', error);
        const systemLang = getSystemLanguage();
        setLanguageState(systemLang);
      } finally {
        console.log('[LanguageContext] Language initialization complete');
        setIsInitialized(true);
      }
    };

    loadLanguage();
  }, []);

  const setLanguage = (lang: Language) => {
    try {
      setLanguageToLocalStorage(lang);
      setLanguageState(lang);
      console.log('[LanguageContext] Language changed to:', lang);
    } catch (error) {
      console.error('[LanguageContext] Failed to save language to localStorage:', error);
      setLanguageState(lang);
    }
  };

  const t = (key: string, fallbackOrParams?: string | Record<string, any>): string => {
    const keys = key.split('.');
    let currentTranslation: any = translations[language];

    for (const k of keys) {
      if (currentTranslation && typeof currentTranslation === 'object' && k in currentTranslation) {
        currentTranslation = currentTranslation[k];
      } else {
        // Fallback: ищем в английском
        let enTranslation: any = translations['en'];
        for (const k2 of keys) {
          if (enTranslation && typeof enTranslation === 'object' && k2 in enTranslation) {
            enTranslation = enTranslation[k2];
          } else {
            return typeof fallbackOrParams === 'string' ? fallbackOrParams : key;
          }
        }
        if (typeof enTranslation === 'string') {
          currentTranslation = enTranslation;
          break;
        }
        return typeof fallbackOrParams === 'string' ? fallbackOrParams : key;
      }
    }

    if (typeof currentTranslation === 'string') {
      let result = currentTranslation;
      
      // Если второй параметр - объект, выполняем интерполяцию
      if (fallbackOrParams && typeof fallbackOrParams === 'object' && !Array.isArray(fallbackOrParams)) {
        for (const [paramKey, paramValue] of Object.entries(fallbackOrParams)) {
          result = result.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue));
        }
      }
      
      return result;
    } else {
      // Fallback: ищем в английском
      let enTranslation: any = translations['en'];
      for (const k2 of keys) {
        if (enTranslation && typeof enTranslation === 'object' && k2 in enTranslation) {
          enTranslation = enTranslation[k2];
        } else {
          return typeof fallbackOrParams === 'string' ? fallbackOrParams : key;
        }
      }
      if (typeof enTranslation === 'string') {
        let result = enTranslation;
        
        // Если второй параметр - объект, выполняем интерполяцию
        if (fallbackOrParams && typeof fallbackOrParams === 'object' && !Array.isArray(fallbackOrParams)) {
          for (const [paramKey, paramValue] of Object.entries(fallbackOrParams)) {
            result = result.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue));
          }
        }
        
        return result;
      }
      return typeof fallbackOrParams === 'string' ? fallbackOrParams : key;
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isInitialized }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);