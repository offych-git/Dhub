import { useLanguage } from '../contexts/LanguageContext';

/**
 * Получает локализованный заголовок на основе выбранного языка
 * Логика fallback: нужный язык → английский → русский
 */
export function getLocalizedTitle(
  title: string,
  titleEn?: string,
  titleEs?: string,
  language: string = 'ru'
): string {
  switch (language) {
    case 'en':
      return titleEn || title;
    case 'es':
      return titleEs || titleEn || title; // Испанский → Английский → Русский
    default:
      return title;
  }
}

/**
 * Получает локализованное описание на основе выбранного языка
 * Логика fallback: нужный язык → английский → русский
 */
export function getLocalizedDescription(
  description: string,
  descriptionEn?: string,
  descriptionEs?: string,
  language: string = 'ru'
): string {
  switch (language) {
    case 'en':
      return descriptionEn || description;
    case 'es':
      return descriptionEs || descriptionEn || description; // Испанский → Английский → Русский
    default:
      return description;
  }
}

/**
 * Хук для получения локализованного контента карточки
 */
export function useLocalizedContent() {
  const { language } = useLanguage();
  
  const getLocalizedDealContent = (deal: any) => ({
    title: getLocalizedTitle(
      deal.title,
      deal.title_en,
      deal.title_es,
      language
    ),
    description: getLocalizedDescription(
      deal.description,
      deal.description_en,
      deal.description_es,
      language
    )
  });
  
  const getLocalizedPromoContent = (promo: any) => ({
    title: getLocalizedTitle(
      promo.title,
      promo.title_en,
      promo.title_es,
      language
    ),
    description: getLocalizedDescription(
      promo.description || '',
      promo.description_en,
      promo.description_es,
      language
    )
  });
  
  return {
    getLocalizedDealContent,
    getLocalizedPromoContent,
    language
  };
} 