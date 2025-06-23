import React from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * Обрабатывает HTML-контент, делая ссылки активными и добавляя иконки внешних ссылок
 */
export const processLinksInHtml = (htmlContent: string): string => {
  if (!htmlContent) return '';

  return htmlContent
    // Сначала удаляем технический блок с JSON изображений
    .replace(/<gallery>(.*?)<\/gallery>/g, "")
    // Обрабатываем URL в тексте с улучшенным регулярным выражением
    .replace(
      /(https?:\/\/[^\s<>"]+)/g,
      (match) => {
        // Проверяем, заканчивается ли URL специальным символом, который НЕ является частью URL
        const lastChar = match.charAt(match.length - 1);
        
        // БЕЗОПАСНАЯ обработка: обрезаем только символы, которые точно НЕ могут быть частью URL
        // Исключаем символы, которые могут быть в реферальных ссылках: ? & = ; : . ) ]
        const shouldTrimChar = [",", "!", "}"].includes(lastChar) && 
          // Дополнительная проверка: обрезаем точку только если перед ней нет цифры или буквы
          (lastChar !== "." || !/[a-zA-Z0-9]\.?$/.test(match.slice(-2)));
        
        if (shouldTrimChar) {
          // Исключаем последний символ из ссылки и добавляем его после тега </a>
          return `<a href="${match.slice(0, -1)}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline inline-flex items-center gap-1">${match.slice(0, -1)}<svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>${lastChar}`;
        }
        
        // Все остальные URL (включая с ? & = ; : . ) ] в конце) обрабатываем как есть
        return `<a href="${match}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline inline-flex items-center gap-1">${match}<svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>`;
      },
    )
    // Обрабатываем двойные переносы строк (пустые строки)
    .replace(/\n\n/g, "<br><br>")
    // Затем обрабатываем обычные переносы строк
    .replace(/\n/g, "<br>");
};

/**
 * Компонент для отображения HTML-контента с активными ссылками
 */
interface LinkifiedHtmlProps {
  content: string;
  searchQuery?: string;
  className?: string;
}

export const LinkifiedHtml: React.FC<LinkifiedHtmlProps> = ({ 
  content, 
  searchQuery = '', 
  className = '' 
}) => {
  const processedContent = React.useMemo(() => {
    let processed = processLinksInHtml(content);

    // Если есть поисковый запрос, применяем подсветку
    if (searchQuery) {
      const searchRegex = new RegExp(
        `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi",
      );
      processed = processed.replace(
        searchRegex,
        '<span class="bg-orange-500 text-white px-0.5 rounded">$1</span>',
      );
    }

    return processed;
  }, [content, searchQuery]);

  return (
    <div
      className={`linkified-content ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
      ref={(element) => {
        if (element) {
          const links = element.querySelectorAll("a");
          links.forEach((link) => {
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener noreferrer");
          });
        }
      }}
    />
  );
}; 